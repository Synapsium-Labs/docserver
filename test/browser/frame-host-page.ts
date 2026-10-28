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
// The parent page has no policy of its own unless a row asks for one (`PageHow.policy`, sent as the page's
// Content-Security-Policy header): a srcdoc frame inherits its embedder's policy container, so a strict one here also
// binds the frame (design R7; the plan's HB rows measure that, and Task 16's on-request row its inline-style half).
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
//   - `posts` (Task 10's host-policy rows): wraps MessagePort.prototype.postMessage before the bootstrap captures it and
//     records every op the frame posts (its `t`, and an error's `why`), because `./host` never lets `why` reach the
//     host page (Reference §11.3), and the rows that mirror L3.B6b read it in the frame. Each entry is also written to
//     the frame's console (a `docserver-test-post ` line, with the console method captured before any frame script
//     runs), which the parent's console channel collects as `framePosts`: `./host` removes the frame at an error, so
//     the record in the frame may be gone before a row can read it.
// The record sits under a symbol key, so no authored id can shadow it.
//
// The library page (Task 10, `openLibHost`): the same context, route and violation channel, but the parent is
// `./host` itself. The page loads the bundled `src/host` (esbuild, in memory, once per process) from /host.js and a
// small page script from /host-page.js, both from the page's origin and, when the row serves a page policy with a
// script nonce, carrying it; the page script mounts through mountDocFrame into a container and records what the
// adapters see (ready, fallback, links, hashes, copies, versions, changes), every load of every iframe in the container
// (a capture-phase listener on the container, so a load fired during insertion is seen too), the iframe's attributes
// and the window listeners added after it started, and which of the window's own message handlers are set. Nothing of the library is replaced: the rows run it as it ships.
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import type { Browser, BrowserContext, ConsoleMessage, Frame, Page } from 'playwright-core';
import type { FrameAssets, RenderInput } from '../../src/frame/index.js';
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
  readonly posts?: boolean;
}

/** How the host page itself is served. */
export interface PageHow {
  /** The page's own Content-Security-Policy header; absent, the page has none. */
  readonly policy?: string;
}

/** How the page builds the iframe. */
export interface MountHow {
  readonly hello?: HelloMode;
  /** The sandbox attribute; null leaves it off (the fail-closed row). Default exactly `allow-scripts`. */
  readonly sandbox?: string | null;
  /** Set the csp attribute; default true. False is L3.HB1's control: a bare iframe bound by no policy of its own. */
  readonly cspAttribute?: boolean;
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
  /** Every op the frame posted on a MessagePort (with `posts`): its `t`, and an error's `why`. */
  readonly posts: readonly { readonly t: string; readonly why?: string }[];
}

interface HostApi {
  mount(srcdoc: string, csp: string | null, hello: HelloMode, sandbox: string | null): void;
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
    mount(srcdoc: string, csp: string | null, hello: 'auto' | 'none' | 'battery' | 'v2', sandbox: string | null): void {
      const f = document.createElement('iframe');
      if (sandbox !== null) f.setAttribute('sandbox', sandbox);
      f.setAttribute('referrerpolicy', 'no-referrer');
      if (csp !== null) f.setAttribute('csp', csp);
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
  if (how.measure !== true && how.countCloses !== true && how.observeDiagrams !== true && how.diagramsAtReady !== true && how.stepWallClock !== true && how.posts !== true) return null;
  return `(() => {
  if (location.href !== 'about:srcdoc') return;
  const rec = { dcl: null, root: null, closed: 0, diagrams: [], ready: [], posts: [], wallOffset: 0 };
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
  if (${String(how.posts === true)}) {
    const post = MessagePort.prototype.postMessage;
    const debug = console.debug.bind(console);
    const stringify = JSON.stringify;
    MessagePort.prototype.postMessage = function (...args) {
      const m = args[0];
      if (typeof m === 'object' && m !== null && typeof m.t === 'string') {
        const entry = typeof m.why === 'string' ? { t: m.t, why: m.why } : { t: m.t };
        rec.posts.push(entry);
        debug('docserver-test-post ' + stringify(entry));
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
  /** The URL of every WebSocket the page or any of its frames opened (none reaches the network). */
  readonly websockets: readonly string[];
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

/** A file the context serves from the page's origin. */
interface Served {
  readonly body: string;
  readonly type: string;
}

/** What openContext gives back: the page, its logs, and a frame lookup. */
interface Opened {
  readonly context: BrowserContext;
  readonly page: Page;
  readonly requests: { url: string; main: boolean }[];
  readonly websockets: string[];
  readonly cspConsole: string[];
  readonly errors: string[];
  readonly framePosts: { t: string; why?: string }[];
  frame(): Frame;
  frameRecord(): Promise<FrameRecord>;
}

/**
 * A fresh context of `browser` whose route serves `files` from the page's origin (the page, at '/', with `policy` as
 * its own Content-Security-Policy header when given), answers any other path there 404, and aborts every other origin;
 * every request is logged, with whether the page's main frame made it, and so is every WebSocket. The page is opened at
 * '/' and `ready` is awaited in it.
 */
async function openContext(browser: Browser, how: InitHow, files: ReadonlyMap<string, Served>, policy: string | undefined, ready: string): Promise<Opened> {
  const context: BrowserContext = await browser.newContext({
    viewport: { width: 1200, height: 900 },
    deviceScaleFactor: 1,
    colorScheme: 'light',
    // No `serviceWorkers: 'block'`: Playwright enforces it with a script that reads navigator.serviceWorker in every
    // frame, which throws in a sandboxed opaque-origin frame and would show as the frame's own error.
  });
  const requests: { url: string; main: boolean }[] = [];
  const websockets: string[] = [];
  const cspConsole: string[] = [];
  const errors: string[] = [];
  const framePosts: { t: string; why?: string }[] = [];
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
    const file = url.origin === ORIGIN ? files.get(url.pathname) : undefined;
    if (file !== undefined) {
      const headers: Record<string, string> = { 'content-type': file.type };
      if (url.pathname === '/' && policy !== undefined) headers['content-security-policy'] = policy;
      await route.fulfill({ status: 200, headers, body: file.body });
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
  p.on('websocket', (ws) => {
    websockets.push(ws.url());
  });
  p.on('console', (m: ConsoleMessage) => {
    const text = m.text();
    if (text.startsWith('docserver-test-post ')) framePosts.push(JSON.parse(text.slice('docserver-test-post '.length)) as { t: string; why?: string });
    else if (/Content Security Policy/i.test(text)) cspConsole.push(text);
    else if (m.type() === 'error') errors.push(text);
  });
  p.on('pageerror', (e) => {
    errors.push(`pageerror: ${e.message}`);
  });
  try {
    await p.goto(`${ORIGIN}/`);
    await p.waitForFunction(ready);
  } catch (e) {
    await context.close().catch(() => undefined);
    throw e;
  }
  const frame = (): Frame => {
    const f = p.frames().find((x) => x.parentFrame() === p.mainFrame());
    if (f === undefined) throw new Error('frame host: no frame is mounted');
    return f;
  };
  return {
    context,
    page: p,
    requests,
    websockets,
    cspConsole,
    errors,
    framePosts,
    frame,
    frameRecord: () =>
      frame().evaluate(() => {
        const r = (window as unknown as Record<symbol, FrameRecord | undefined>)[Symbol.for('frame-test.record')];
        return r === undefined
          ? { dcl: null, root: null, closed: -1, origin: -1, diagrams: [], ready: [], posts: [] }
          : { dcl: r.dcl, root: r.root, closed: r.closed, origin: performance.timeOrigin, diagrams: [...r.diagrams], ready: [...r.ready], posts: [...r.posts] };
      }),
  };
}

/** Open the host page in a fresh context of `browser`, served with `served.policy` as its own policy when given. */
export async function openFrameHost(browser: Browser, how: InitHow = {}, served: PageHow = {}): Promise<FrameHost> {
  const o = await openContext(browser, how, new Map([['/', { body: PAGE, type: 'text/html; charset=utf-8' }]]), served.policy, 'window.__frameHost !== undefined');
  const p = o.page;
  const record = (): Promise<HostRecord> => p.evaluate(() => (window.__frameHost as HostApi).record());
  return {
    page: p,
    requests: o.requests,
    websockets: o.websockets,
    cspConsole: o.cspConsole,
    errors: o.errors,
    mount: (srcdoc, csp, how = 'auto') => {
      const m: MountHow = typeof how === 'string' ? { hello: how } : how;
      const args = [srcdoc, m.cspAttribute === false ? null : csp, m.hello ?? 'auto', m.sandbox === undefined ? 'allow-scripts' : m.sandbox] as const;
      return p.evaluate(([s, c, h, sb]) => (window.__frameHost as HostApi).mount(s, c, h, sb), args);
    },
    secondHello: () => p.evaluate(() => (window.__frameHost as HostApi).secondHello()),
    send: (port, data) => p.evaluate(([n, d]) => (window.__frameHost as HostApi).send(n, d), [port, data] as const),
    record,
    frame: o.frame,
    frameRecord: o.frameRecord,
    async waitMessages(n, ms) {
      const until = Date.now() + ms;
      for (;;) {
        const r = await record();
        if (r.messages.length >= n || Date.now() >= until) return r;
        await new Promise((res) => setTimeout(res, 25));
      }
    },
    close: () => o.context.close(),
  };
}

// ───────── the library page: `./host` as the parent (Task 10) ─────────

/** The callbacks a library mount gives, each recorded. */
export type LibCallback = 'onLink' | 'onHash' | 'copy' | 'changes' | 'openVersion';

/** One library mount: the document, the assets and the adapters, as plain data the page turns into adapters. */
export interface LibMountSpec {
  readonly document: RenderInput;
  readonly assets: FrameAssets;
  readonly watchdogMs: number;
  readonly focus?: boolean;
  readonly title?: string;
  readonly mermaidDraw?: 'auto' | 'on-request';
  /** Give the mount an in-page store (a Map behind Web Storage's interface). */
  readonly store?: boolean;
  readonly docKey?: string;
  /** The callbacks to give, beside onReady and onFallback (always given); default all five. */
  readonly callbacks?: readonly LibCallback[];
  /** What the changes adapter answers; default null. */
  readonly changesReply?: unknown;
}

/** One thing a library mount's adapters saw. */
export interface LibEvent {
  readonly kind: 'ready' | 'fallback' | LibCallback;
  readonly value: unknown;
  /** ms since the page's latest mount call. */
  readonly at: number;
}

/** What the library page recorded. */
export interface LibRecord {
  readonly events: readonly LibEvent[];
  /** Every load of an iframe in the container: when (ms since the mount call), and how many readies came before it. */
  readonly loads: readonly { readonly at: number; readonly readyBefore: number }[];
  /** How many iframes the container holds now. */
  readonly iframes: number;
  /** The container's iframe now, if any: its attributes, and the nonce its srcdoc's seed carries. */
  readonly iframe: { readonly attributes: Readonly<Record<string, string>>; readonly nonce: string | null } | null;
  /** True when the iframe was the active element right after the latest mount call returned. */
  readonly activeAfterMount: boolean | null;
  /** The types of every listener added to the window after the page script started. */
  readonly windowListeners: readonly string[];
  /** The window's own message handlers that are set now (`onmessage`, `onmessageerror`): by any spelling, they show here. */
  readonly windowHandlers: readonly string[];
}

interface LibApi {
  mount(spec: LibMountSpec): void;
  update(d: RenderInput): void;
  setPrefs(p: unknown): void;
  destroy(): void;
  record(): LibRecord;
}

declare global {
  interface Window {
    __docHostLib?: { readonly mountDocFrame: (el: HTMLElement, o: { document: unknown; adapters: unknown }) => { update(d: unknown): void; setPrefs(p: unknown): void; destroy(): void } };
    __libHost?: LibApi;
  }
}

/** The library page's script, serialised into /host-page.js. Self-contained: it names nothing outside its own body. */
function libMain(): void {
  const lib = window.__docHostLib;
  if (lib === undefined) throw new Error('host page: the library did not load');
  const windowListeners: string[] = [];
  const add = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function (this: EventTarget, ...args: Parameters<EventTarget['addEventListener']>) {
    if (this === window) windowListeners.push(String(args[0]));
    return add.apply(this, args);
  };
  const container = document.createElement('div');
  container.className = 'mount';
  document.body.append(container);
  const rec = {
    events: [] as { kind: string; value: unknown; at: number }[],
    loads: [] as { at: number; readyBefore: number }[],
    activeAfterMount: null as boolean | null,
    started: 0,
  };
  const now = (): number => performance.now() - rec.started;
  const readies = (): number => rec.events.filter((e) => e.kind === 'ready').length;
  container.addEventListener(
    'load',
    (e) => {
      if (e.target instanceof HTMLIFrameElement) rec.loads.push({ at: now(), readyBefore: readies() });
    },
    true,
  );
  let frame: { update(d: unknown): void; setPrefs(p: unknown): void; destroy(): void } | null = null;
  const plain = (v: unknown): unknown => JSON.parse(JSON.stringify(v ?? null)) as unknown;
  const api = {
    mount(spec: {
      document: unknown;
      assets: unknown;
      watchdogMs: number;
      focus?: boolean;
      title?: string;
      mermaidDraw?: string;
      store?: boolean;
      docKey?: string;
      callbacks?: string[];
      changesReply?: unknown;
    }): void {
      const log =
        (kind: string) =>
        (value?: unknown): void => {
          rec.events.push({ kind, value: plain(value), at: now() });
        };
      const map = new Map<string, string>();
      const store = {
        getItem: (k: string) => map.get(k) ?? null,
        setItem: (k: string, v: string) => {
          map.set(k, v);
        },
        removeItem: (k: string) => {
          map.delete(k);
        },
        key: (i: number) => [...map.keys()][i] ?? null,
        get length() {
          return map.size;
        },
      };
      const callbacks = spec.callbacks ?? ['onLink', 'onHash', 'copy', 'changes', 'openVersion'];
      const adapters: Record<string, unknown> = {
        assets: spec.assets,
        watchdogMs: spec.watchdogMs,
        onReady: log('ready'),
        onFallback: log('fallback'),
      };
      if (spec.focus !== undefined) adapters['focus'] = spec.focus;
      if (spec.title !== undefined) adapters['title'] = spec.title;
      if (spec.mermaidDraw !== undefined) adapters['mermaidDraw'] = spec.mermaidDraw;
      if (spec.store === true) adapters['store'] = store;
      if (spec.docKey !== undefined) adapters['docKey'] = spec.docKey;
      if (callbacks.includes('onLink')) adapters['onLink'] = log('onLink');
      if (callbacks.includes('onHash')) adapters['onHash'] = log('onHash');
      if (callbacks.includes('copy')) adapters['copy'] = (text: string, check: unknown) => log('copy')({ text, check });
      if (callbacks.includes('openVersion')) adapters['openVersion'] = log('openVersion');
      if (callbacks.includes('changes')) {
        adapters['changes'] = (sha: string) => {
          log('changes')(sha);
          return Promise.resolve(spec.changesReply ?? null);
        };
      }
      rec.started = performance.now();
      frame = lib.mountDocFrame(container, { document: spec.document, adapters });
      const f = container.querySelector('iframe');
      rec.activeAfterMount = f !== null && document.activeElement === f;
    },
    update(d: unknown): void {
      frame?.update(d);
    },
    setPrefs(p: unknown): void {
      frame?.setPrefs(p);
    },
    destroy(): void {
      frame?.destroy();
    },
    record() {
      const f = container.querySelector('iframe');
      const attributes: Record<string, string> = {};
      if (f !== null) for (const a of Array.from(f.attributes)) if (a.name !== 'srcdoc') attributes[a.name] = a.value;
      const nonce = f === null ? null : (/"nonce":"([0-9a-f]{32})"/.exec(f.getAttribute('srcdoc') ?? '')?.[1] ?? null);
      return {
        events: rec.events.slice(),
        loads: rec.loads.slice(),
        iframes: container.querySelectorAll('iframe').length,
        iframe: f === null ? null : { attributes, nonce },
        activeAfterMount: rec.activeAfterMount,
        windowListeners: windowListeners.slice(),
        windowHandlers: (['onmessage', 'onmessageerror'] as const).filter((h) => window[h] !== null),
      };
    },
  };
  window.__libHost = api as unknown as LibApi;
}

let libBundle: Promise<string> | undefined;

/** `src/host` bundled for the page, once per process: it exposes mountDocFrame as window.__docHostLib, and nothing else. */
function hostBundle(): Promise<string> {
  libBundle ??= build({
    stdin: {
      contents: "import { mountDocFrame } from './src/host/index.ts';\nObject.defineProperty(window, '__docHostLib', { value: Object.freeze({ mountDocFrame }) });\n",
      resolveDir: fileURLToPath(new URL('../../', import.meta.url)),
      sourcefile: 'host-page-entry.ts',
      loader: 'ts',
    },
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    target: 'es2022',
    logLevel: 'silent',
  }).then((r) => r.outputFiles[0]?.text ?? '');
  return libBundle;
}

/** How the library page is served. */
export interface LibPageHow {
  /** The page's own Content-Security-Policy header; absent, the page has none. */
  readonly policy?: string;
  /** A nonce the page's two scripts carry (for a policy whose script-src names it). */
  readonly scriptNonce?: string;
}

export interface LibHost {
  readonly page: Page;
  readonly requests: readonly { readonly url: string; readonly main: boolean }[];
  readonly websockets: readonly string[];
  readonly cspConsole: readonly string[];
  readonly errors: readonly string[];
  /** The ops the frame posted, as its `posts` init script wrote them to its console (InitHow.posts only). */
  readonly framePosts: readonly { readonly t: string; readonly why?: string }[];
  mount(spec: LibMountSpec): Promise<void>;
  update(d: RenderInput): Promise<void>;
  setPrefs(p: unknown): Promise<void>;
  destroy(): Promise<void>;
  /** What the page recorded. */
  lib(): Promise<LibRecord>;
  /** The page's record in the frame host's shape (the adapters' events as messages), for waitProgress. */
  record(): Promise<HostRecord>;
  /** The mounted frame (Playwright's handle); a stand-in whose evaluate rejects when none is mounted. */
  frame(): Frame;
  /** The init script's record (with an InitHow part). */
  frameRecord(): Promise<FrameRecord>;
  close(): Promise<void>;
}

/** Open the library page in a fresh context of `browser`. */
export async function openLibHost(browser: Browser, how: InitHow = {}, served: LibPageHow = {}): Promise<LibHost> {
  const nonce = served.scriptNonce === undefined ? '' : ` nonce="${served.scriptNonce}"`;
  const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Host library test page</title>
<link rel="stylesheet" href="/host-page.css">
</head>
<body>
<script${nonce} src="/host.js"></script>
<script${nonce} src="/host-page.js"></script>
</body>
</html>
`;
  const files = new Map<string, Served>([
    ['/', { body: page, type: 'text/html; charset=utf-8' }],
    ['/host.js', { body: await hostBundle(), type: 'text/javascript; charset=utf-8' }],
    ['/host-page.js', { body: `(${libMain.toString()})();\n`, type: 'text/javascript; charset=utf-8' }],
    ['/host-page.css', { body: 'body { margin: 0; }\niframe { width: 1000px; height: 760px; border: 0; display: block; }\n', type: 'text/css' }],
  ]);
  const o = await openContext(browser, how, files, served.policy, 'window.__libHost !== undefined');
  const p = o.page;
  const lib = (): Promise<LibRecord> => p.evaluate(() => (window.__libHost as LibApi).record());
  const noFrame = { evaluate: () => Promise.reject(new Error('frame host: no frame is mounted')) } as unknown as Frame;
  return {
    page: p,
    requests: o.requests,
    websockets: o.websockets,
    cspConsole: o.cspConsole,
    errors: o.errors,
    framePosts: o.framePosts,
    mount: (spec) => p.evaluate((s) => (window.__libHost as LibApi).mount(s), spec),
    update: (d) => p.evaluate((x) => (window.__libHost as LibApi).update(x), d),
    setPrefs: (x) => p.evaluate((v) => (window.__libHost as LibApi).setPrefs(v), x),
    destroy: () => p.evaluate(() => (window.__libHost as LibApi).destroy()),
    lib,
    async record() {
      const r = await lib();
      return {
        messages: r.events.map((e) => ({ port: 'lib', data: { kind: e.kind, value: e.value }, at: e.at })),
        loads: r.loads.map((l) => l.at),
        closes: [],
        windowMessages: [],
        closeSupported: false,
        insertedAt: 0,
      };
    },
    frame: () => {
      try {
        return o.frame();
      } catch {
        return noFrame;
      }
    },
    frameRecord: o.frameRecord,
    close: () => o.context.close(),
  };
}
