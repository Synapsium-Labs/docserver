// A minimal parent page for the sealed reader frame (docserver L3, the prototype's page kept by Task 5; plan Reference
// §11.1 and §11.2). It stands in for `./host` (Task 10): it is served from https://docreader.test/ by this file's route, mounts a srcdoc the
// test built in Node, and records what the frame does from the parent's side, so the frame's shipped bytes run with no
// test probe of any kind.
//
// The page builds the iframe in the order of Reference §11.1 step 6: sandbox exactly `allow-scripts`, referrerpolicy
// no-referrer, the csp attribute, the title, then srcdoc, BEFORE insertion; the load listener goes on the element
// before insertion too. On the first load it posts hello with one port (or, for the hello row, a battery of hellos),
// and it records every port message (with its time since insertion), every load and every port close. It keeps each
// channel's own end by name, so a row can answer the frame on it (`send`: prefs, a changes.result). It is a test page,
// not `./host`: its window `message` listener only records strays.
//
// The parent page has no policy of its own: a srcdoc frame inherits its embedder's policy container, so a strict one
// here would also bind the frame (design R7; the plan's HB rows measure that).
//
// CSP violations are collected from the parent's side only (brief amendment 4): every console message of the page or
// any of its frames that names a Content Security Policy is kept in `cspConsole`. On Chromium Playwright's console
// events are the DevTools protocol's `Log.entryAdded` and `Runtime.consoleAPICalled` of each frame's session, so this
// is the CDP channel; on WebKit it is the inspector's console capture. The P2 and P3 controls pin that the channel hears
// a refusal, so a zero elsewhere is a measurement.
//
// By default nothing runs in the frame's realm but the srcdoc's own scripts. An init script is added only on request,
// each part named by the row that needs it, and never in the headline rows:
//   - `countCloses` (P3b only): wraps MessagePort.prototype.close before the bootstrap captures it, because the parent
//     cannot see a close where MessagePort's close event is missing (Chromium today);
//   - `observeDiagrams` (P7): a MutationObserver on `data-docreader-diagrams` (it substitutes no built-in);
//   - `diagramsAtReady` (the L3.B6 rows): wraps MessagePort.prototype.postMessage before the bootstrap captures it (its
//     Phase S reads it off the prototype), and when the message posted is the `ready` op, records the content root's
//     `data-docreader-diagrams` at that instant (null when the root or the attribute is absent), then posts it
//     unchanged. It reads the reader's state in the frame's own realm, at the post, so the order of ready and the
//     drawing is not left to when either side's observer runs;
//   - `measure` (the measurement rows): times DOMContentLoaded and the content root's append, wrapping
//     Node.prototype.appendChild before the bootstrap captures it;
//   - `stepWallClock` (the outbox's clock row only): wraps Date.now before the bootstrap could capture it, adding the
//     record's `wallOffset`, so a row can step the frame's wall clock the way a system clock change does, leaving
//     performance.now alone.
// The record sits under a symbol key, so no authored id can shadow it.
import type { Browser, BrowserContext, ConsoleMessage, Frame, Page } from 'playwright-core';
import { ORIGIN } from './harness.js';

/** How the page greets the frame on its first load. */
export type HelloMode = 'auto' | 'none' | 'battery' | 'v2';

export interface PortMessage {
  readonly port: string;
  readonly data: unknown;
  /** ms since the iframe's insertion. */
  readonly at: number;
}

export interface HostRecord {
  readonly messages: readonly PortMessage[];
  /** ms since insertion, one per load event of the iframe element. */
  readonly loads: readonly number[];
  /** The names of the page's ports that saw a `close` event. */
  readonly closes: readonly string[];
  /** Messages that reached the page's window (none are expected). */
  readonly windowMessages: readonly unknown[];
  /** True when MessagePort has an onclose handler property (the close event is supported). */
  readonly closeSupported: boolean;
  /** performance.timeOrigin + the insertion time: the insertion as an absolute time. */
  readonly insertedAt: number;
}

/** What the init script instruments, each part opt-in (none by default: the frame's realm is untouched). */
export interface InitHow {
  readonly measure?: boolean;
  readonly countCloses?: boolean;
  readonly observeDiagrams?: boolean;
  readonly diagramsAtReady?: boolean;
  readonly stepWallClock?: boolean;
}

/** How the page builds the iframe. */
export interface MountHow {
  readonly hello?: HelloMode;
  /** The sandbox attribute; null leaves it off (the fail-closed row). Default exactly `allow-scripts`. */
  readonly sandbox?: string | null;
}

/** The in-frame record the init script keeps. */
export interface FrameRecord {
  readonly dcl: number | null;
  readonly root: number | null;
  /** How many times a MessagePort was closed in the frame. */
  readonly closed: number;
  /** The frame's performance.timeOrigin, so its times can be set against the page's. */
  readonly origin: number;
  /** Each change of a `data-docreader-diagrams` attribute: its new value and when (frame time). */
  readonly diagrams: readonly { readonly state: string | null; readonly at: number }[];
  /** One entry per `ready` op the frame posted: the root's `data-docreader-diagrams` at the post (null: absent), and when. */
  readonly ready: readonly { readonly state: string | null; readonly at: number }[];
}

interface HostApi {
  mount(srcdoc: string, csp: string, hello: HelloMode, sandbox: string | null): void;
  secondHello(): void;
  send(port: string, data: unknown): void;
  record(): HostRecord;
}

declare global {
  interface Window {
    __frameHost?: HostApi;
  }
}

/** The page's script, serialised into the page. Self-contained: it names nothing outside its own body. */
function hostMain(): void {
  const rec = {
    messages: [] as { port: string; data: unknown; at: number }[],
    loads: [] as number[],
    closes: [] as string[],
    windowMessages: [] as unknown[],
    inserted: 0,
  };
  let iframe: HTMLIFrameElement | null = null;
  const ends: Record<string, MessagePort> = {};
  window.addEventListener('message', (e) => {
    rec.windowMessages.push(e.data);
  });
  const channel = (name: string): MessagePort => {
    const ch = new MessageChannel();
    ch.port1.onmessage = (e: MessageEvent): void => {
      rec.messages.push({ port: name, data: e.data, at: performance.now() - rec.inserted });
    };
    ch.port1.addEventListener('close', () => {
      rec.closes.push(name);
    });
    ends[name] = ch.port1;
    return ch.port2;
  };
  const api = {
    mount(srcdoc: string, csp: string, hello: 'auto' | 'none' | 'battery' | 'v2', sandbox: string | null): void {
      const f = document.createElement('iframe');
      if (sandbox !== null) f.setAttribute('sandbox', sandbox);
      f.setAttribute('referrerpolicy', 'no-referrer');
      f.setAttribute('csp', csp);
      f.setAttribute('title', 'Document');
      f.style.cssText = 'width:1000px;height:760px;border:0;display:block';
      f.srcdoc = srcdoc;
      f.addEventListener('load', () => {
        rec.loads.push(performance.now() - rec.inserted);
        if (rec.loads.length !== 1) return;
        const w = f.contentWindow;
        if (w === null || hello === 'none') return;
        if (hello === 'battery') {
          w.postMessage({ t: 'hello', v: 1 }, '*');
          w.postMessage({ t: 'hello', v: 1, x: 1 }, '*', [channel('extra-key')]);
          w.postMessage({ t: 'hello', v: 1 }, '*', [channel('two-a'), channel('two-b')]);
        }
        w.postMessage({ t: 'hello', v: hello === 'v2' ? 2 : 1 }, '*', [channel('main')]);
      });
      iframe = f;
      rec.inserted = performance.now();
      document.body.append(f);
    },
    secondHello(): void {
      iframe?.contentWindow?.postMessage({ t: 'hello', v: 1 }, '*', [channel('second')]);
    },
    send(port: string, data: unknown): void {
      ends[port]?.postMessage(data);
    },
    record() {
      return {
        messages: rec.messages.slice(),
        loads: rec.loads.slice(),
        closes: rec.closes.slice(),
        windowMessages: rec.windowMessages.slice(),
        closeSupported: 'onclose' in MessagePort.prototype,
        insertedAt: performance.timeOrigin + rec.inserted,
      };
    },
  };
  window.__frameHost = api;
}

const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Frame host test page</title>
</head>
<body style="margin:0">
<script>(${hostMain.toString()})();</script>
</body>
</html>
`;

/** The init script, or null when nothing is asked for: in the srcdoc document only, each part opt-in. */
function initScript(how: InitHow): string | null {
  if (how.measure !== true && how.countCloses !== true && how.observeDiagrams !== true && how.diagramsAtReady !== true && how.stepWallClock !== true) return null;
  return `(() => {
  if (location.href !== 'about:srcdoc') return;
  const rec = { dcl: null, root: null, closed: 0, diagrams: [], ready: [], wallOffset: 0 };
  Object.defineProperty(window, Symbol.for('frame-test.record'), { value: rec });
  if (${String(how.stepWallClock === true)}) {
    const now = Date.now;
    Date.now = function () {
      return now.call(Date) + rec.wallOffset;
    };
  }
  if (${String(how.countCloses === true)}) {
    const close = MessagePort.prototype.close;
    MessagePort.prototype.close = function () {
      rec.closed++;
      return close.call(this);
    };
  }
  if (${String(how.observeDiagrams === true)}) {
    new MutationObserver((list) => {
      for (const m of list) rec.diagrams.push({ state: m.target.getAttribute('data-docreader-diagrams'), at: performance.now() });
    }).observe(document, { subtree: true, attributes: true, attributeFilter: ['data-docreader-diagrams'] });
  }
  if (${String(how.diagramsAtReady === true)}) {
    const post = MessagePort.prototype.postMessage;
    const query = Document.prototype.querySelector;
    const getAttribute = Element.prototype.getAttribute;
    const perf = performance;
    const perfNow = Performance.prototype.now;
    MessagePort.prototype.postMessage = function (...args) {
      const m = args[0];
      if (typeof m === 'object' && m !== null && m.t === 'ready') {
        const root = query.call(document, 'body > article');
        rec.ready.push({ state: root === null ? null : getAttribute.call(root, 'data-docreader-diagrams'), at: perfNow.call(perf) });
      }
      return post.apply(this, args);
    };
  }
  if (${String(how.measure === true)}) {
    document.addEventListener('DOMContentLoaded', () => { rec.dcl = performance.now(); });
    const append = Node.prototype.appendChild;
    Node.prototype.appendChild = function (child) {
      const out = append.call(this, child);
      if (this === document.body && child instanceof Element && child.localName === 'article' && rec.root === null) rec.root = performance.now();
      return out;
    };
  }
})();`;
}

export interface FrameHost {
  readonly page: Page;
  /** Every request the context saw, in order, with whether the page's main frame made it. */
  readonly requests: readonly { readonly url: string; readonly main: boolean }[];
  /** Console messages that name a Content Security Policy. */
  readonly cspConsole: readonly string[];
  /** Console errors and uncaught errors, from any frame of the page. */
  readonly errors: readonly string[];
  mount(srcdoc: string, csp: string, how?: HelloMode | MountHow): Promise<void>;
  secondHello(): Promise<void>;
  /** Post `data` on the page's end of the channel named `port` (the frame's port messages: prefs, changes.result). */
  send(port: string, data: unknown): Promise<void>;
  record(): Promise<HostRecord>;
  /** The mounted frame (Playwright's handle; it evaluates in the frame whatever its policy). */
  frame(): Frame;
  /** The init script's record: only for a host opened with an InitHow part. */
  frameRecord(): Promise<FrameRecord>;
  /** Wait until the page's ports hold `n` messages, or `ms` pass; answers the record. */
  waitMessages(n: number, ms: number): Promise<HostRecord>;
  close(): Promise<void>;
}

/** Open the host page in a fresh context of `browser`. */
export async function openFrameHost(browser: Browser, how: InitHow = {}): Promise<FrameHost> {
  const context: BrowserContext = await browser.newContext({
    viewport: { width: 1200, height: 900 },
    deviceScaleFactor: 1,
    colorScheme: 'light',
    // No `serviceWorkers: 'block'`: Playwright enforces it with a script that reads navigator.serviceWorker in every
    // frame, which throws in a sandboxed opaque-origin frame and would show as the frame's own error.
  });
  const requests: { url: string; main: boolean }[] = [];
  const cspConsole: string[] = [];
  const errors: string[] = [];
  let page: Page | null = null;
  await context.route('**/*', async (route) => {
    const req = route.request();
    let main = true;
    try {
      main = page !== null && req.frame() === page.mainFrame();
    } catch {
      main = false;
    }
    requests.push({ url: req.url(), main });
    const url = new URL(req.url());
    if (url.origin === ORIGIN && url.pathname === '/') {
      await route.fulfill({ status: 200, headers: { 'content-type': 'text/html; charset=utf-8' }, body: PAGE });
    } else if (url.origin === ORIGIN) {
      await route.fulfill({ status: 404, body: '' });
    } else {
      await route.abort('blockedbyclient');
    }
  });
  const init = initScript(how);
  if (init !== null) await context.addInitScript({ content: init });
  const p = await context.newPage();
  page = p;
  p.on('console', (m: ConsoleMessage) => {
    if (/Content Security Policy/i.test(m.text())) cspConsole.push(m.text());
    else if (m.type() === 'error') errors.push(m.text());
  });
  p.on('pageerror', (e) => {
    errors.push(`pageerror: ${e.message}`);
  });
  try {
    await p.goto(`${ORIGIN}/`);
    await p.waitForFunction(() => window.__frameHost !== undefined);
  } catch (e) {
    await context.close().catch(() => undefined);
    throw e;
  }
  const record = (): Promise<HostRecord> => p.evaluate(() => (window.__frameHost as HostApi).record());
  const frame = (): Frame => {
    const f = p.frames().find((x) => x.parentFrame() === p.mainFrame());
    if (f === undefined) throw new Error('frame host: no frame is mounted');
    return f;
  };
  return {
    page: p,
    requests,
    cspConsole,
    errors,
    mount: (srcdoc, csp, how = 'auto') => {
      const m: MountHow = typeof how === 'string' ? { hello: how } : how;
      const args = [srcdoc, csp, m.hello ?? 'auto', m.sandbox === undefined ? 'allow-scripts' : m.sandbox] as const;
      return p.evaluate(([s, c, h, sb]) => (window.__frameHost as HostApi).mount(s, c, h, sb), args);
    },
    secondHello: () => p.evaluate(() => (window.__frameHost as HostApi).secondHello()),
    send: (port, data) => p.evaluate(([n, d]) => (window.__frameHost as HostApi).send(n, d), [port, data] as const),
    record,
    frame,
    frameRecord: () =>
      frame().evaluate(() => {
        const r = (window as unknown as Record<symbol, FrameRecord | undefined>)[Symbol.for('frame-test.record')];
        return r === undefined
          ? { dcl: null, root: null, closed: -1, origin: -1, diagrams: [], ready: [] }
          : { dcl: r.dcl, root: r.root, closed: r.closed, origin: performance.timeOrigin, diagrams: [...r.diagrams], ready: [...r.ready] };
      }),
    async waitMessages(n, ms) {
      const until = Date.now() + ms;
      for (;;) {
        const r = await record();
        if (r.messages.length >= n || Date.now() >= until) return r;
        await new Promise((res) => setTimeout(res, 25));
      }
    },
    close: () => context.close(),
  };
}
