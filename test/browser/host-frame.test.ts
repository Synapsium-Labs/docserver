// `./host`'s mountDocFrame in real browsers (docserver L3, Task 10; plan Reference §11, FD10, FD22; rows L3.H1, L3.H2,
// L3.HB1 to L3.HB4; the first consumer's M8.1, M8.6, M8.B1, M8.B4 and M8.B5). Each row mounts through the library
// itself, bundled from src/host into the library page of frame-host-page.ts (`openLibHost`), with the frame assets
// built in memory exactly as `node scripts/build-frame.mjs` writes them (frame-shared.ts). The frame runs its release
// bytes; every attempt the rows make in it runs from the parent's side through Playwright's frame access. No row here
// adds an init script.
//
//   L3.H1   the iframe: sandbox exactly allow-scripts, referrerpolicy no-referrer, the csp attribute equal to frameCsp(),
//           the title, no src, name, allow, allowfullscreen or loading; the active element right after mount when focus
//           is on, and not when it is off; ready arrives.
//   L3.H2   one load and one ready per mount; a second load of the frame (it reloads itself) gives navigated with no
//           remount; update makes a new iframe with a new nonce, which reaches its own ready; no window `message`
//           listener is added (a spy on the page's addEventListener).
//   L3.HB1  the exfiltration battery (fixtures/exfil-channels.json, 27 channels, each at origin B and its twin at origin
//           A) reaches nothing from a frame mounted through mountDocFrame. Control: the same srcdoc with its policy meta
//           cut out, in a bare iframe of the frame host page with sandbox="allow-scripts" and no csp attribute, must
//           reach B on at least 20 channels; the channels it reaches are printed per engine as a `host-figure:` line.
//           The mounted row proves its attempts ran (the frame is the srcdoc carrying frameCsp(), and every attempt
//           answers 'ok' or an exception its channel lists), and its quiet window closes only after a barrier: the same
//           channels from the page's own main frame, made after the battery, have reached the route log.
//   L3.HB2  window.open returns null and `top.location =` throws, and neither request reaches the route log. Control:
//           a bare iframe that adds allow-popups and allow-top-navigation opens the window and navigates the top, both
//           seen as requests in the route log.
//   L3.HB3  exactly one load before ready, per engine (Reference §11.1 step 7).
//   L3.HB4  well-formed ops the frame posts to its parent's window have no effect; a link the frame forwards on its
//           port, after them, does.
//
// Waits are the progress wait (frame-shared.ts) or polling on a condition; the battery's quiet window is the only
// timed wait, and it extends while anything new arrives.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { frameCsp, frameDocument, type FrameAssets } from '../../src/frame/index.js';
import { openFrameHost, openLibHost, type LibHost, type LibMountSpec, type LibRecord } from './frame-host-page.js';
import { freshNonce, input, loadFrame, PLAIN, ROOT, sleep, waitProgress } from './frame-shared.js';
import { browserFor, closeBrowsers, describeBrowsers, type BrowserName } from './harness.js';

let assets: FrameAssets;

beforeAll(async () => {
  assets = (await loadFrame()).assets;
}, 300_000);

afterAll(closeBrowsers);

const LINKED = '# Linked\n\nA paragraph with [a link out](https://example.test/out) and more text.\n';

interface Channel {
  readonly id: number;
  readonly slug: string;
  readonly name: string;
  readonly kind: 'script' | 'element' | 'css';
  readonly attempt: string;
  readonly observe: string;
  /** The exceptions the API may throw when the engine refuses the request itself; absent, none. */
  readonly throws?: readonly string[];
}

const CHANNELS = (JSON.parse(readFileSync(path.join(ROOT, 'test', 'browser', 'fixtures', 'exfil-channels.json'), 'utf8')) as { channels: Channel[] }).channels;

const B = 'https://b.docreader.test';
const A = 'https://docreader.test';
const urlB = (c: Channel): string => `${B}/hb1/${c.slug}`;
const urlA = (c: Channel): string => `${A}/hb1/${c.slug}-a`;

/** The channels whose path appears in the request log or the WebSocket log, from `from` on in each. */
function reached(requests: readonly { url: string }[], websockets: readonly string[], from: { requests: number; websockets: number }): Channel[] {
  const paths = new Set<string>();
  for (const r of requests.slice(from.requests)) paths.add(new URL(r.url).pathname);
  for (const w of websockets.slice(from.websockets)) paths.add(new URL(w).pathname);
  return CHANNELS.filter((c) => paths.has(`/hb1/${c.slug}`) || paths.has(`/hb1/${c.slug}-a`));
}

/** Only origin B's requests and sockets: what the control must reach. */
function reachedB(requests: readonly { url: string }[], websockets: readonly string[], from: { requests: number; websockets: number }): Channel[] {
  const paths = new Set<string>();
  for (const r of requests.slice(from.requests)) if (new URL(r.url).host === 'b.docreader.test') paths.add(new URL(r.url).pathname);
  for (const w of websockets.slice(from.websockets)) if (new URL(w).host === 'b.docreader.test') paths.add(new URL(w).pathname);
  return CHANNELS.filter((c) => paths.has(`/hb1/${c.slug}`));
}

/**
 * Run every channel's attempt in `frame`, at B then at A (`at` names the URL for each), answering what each attempt
 * threw, or 'ok', keyed by the URL's path segment (`<slug>` at B, `<slug>-a` at A). An evaluate that failed answers
 * 'evaluate: <message>': that attempt never ran.
 */
async function attemptAll(frame: { evaluate(expr: string): Promise<unknown> }, at: (c: Channel) => readonly string[] = (c) => [urlB(c), urlA(c)]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const c of CHANNELS) {
    for (const url of at(c)) {
      const expr = `(() => { try { (${c.attempt})(${JSON.stringify(url)}); return 'ok'; } catch (e) { return String((e && e.name) || e); } })()`;
      let got: string;
      try {
        got = String(await frame.evaluate(expr));
      } catch (e) {
        got = `evaluate: ${(e instanceof Error ? e.message : String(e)).split('\n')[0] ?? ''}`;
      }
      out[new URL(url).pathname.split('/').pop() ?? url] = got;
    }
  }
  return out;
}

/**
 * The attempts that did not run: every answer but 'ok' and the exceptions the fixture lists for its channel (an
 * evaluate that failed, a TypeError before the request, a missing answer). Empty when every attempt ran.
 */
function notRun(thrown: Readonly<Record<string, string>>): string[] {
  return CHANNELS.flatMap((c) =>
    [c.slug, `${c.slug}-a`]
      .map((k) => [k, thrown[k] ?? 'no answer'] as const)
      .filter(([, got]) => got !== 'ok' && !(c.throws ?? []).includes(got))
      .map(([k, got]) => `${k}: ${got}`),
  );
}

/**
 * L3.HB1's barrier: after the battery, the same channels at origin B under /hb1-probe/ from the page's own main frame
 * (no sandbox, no policy), whose requests must reach the route log before the mounted row's quiet window may close. A
 * loaded machine delays the probe's requests as it would a late leak, so the window waits for them instead of ending at
 * a fixed time. The form is left out: submitted from the main frame it would navigate the page away.
 */
const PROBE_SKIP: readonly string[] = ['form'];
const PROBE = '/hb1-probe/';
const urlProbe = (c: Channel): string => `${B}${PROBE}${c.slug}`;
const isProbe = (url: string): boolean => new URL(url).pathname.startsWith(PROBE);

/** The channels the probe reached at B. */
function probeReached(requests: readonly { url: string }[], websockets: readonly string[], from: { requests: number; websockets: number }): Channel[] {
  const paths = new Set<string>();
  for (const u of [...requests.slice(from.requests).map((r) => r.url), ...websockets.slice(from.websockets)]) {
    const url = new URL(u);
    if (url.host === 'b.docreader.test' && url.pathname.startsWith(PROBE)) paths.add(url.pathname);
  }
  return CHANNELS.filter((c) => paths.has(`${PROBE}${c.slug}`));
}

/** The bar the HB1 control must reach, and the probe barrier too: at least 20 of the 27 channels at B. */
const REACH_BAR = 20;

/**
 * Wait until `signature()` has not changed for `quietMs`, and at least `minMs` have passed, or `capMs`; and, while
 * `more()` says so, keep waiting (to the cap) for something new. A loaded machine delays a request, so the window
 * extends with every change rather than ending at a fixed time.
 */
async function settle(signature: () => string, o: { quietMs: number; minMs: number; capMs: number; more?: () => boolean }): Promise<number> {
  const start = Date.now();
  let last = signature();
  let changed = start;
  for (;;) {
    await sleep(100);
    const now = Date.now();
    const sig = signature();
    if (sig !== last) {
      last = sig;
      changed = now;
    }
    const quiet = now - changed >= o.quietMs && now - start >= o.minMs;
    if (now - start >= o.capMs) return now - start;
    if (quiet && !(o.more?.() ?? false)) return now - start;
  }
}

/** A library mount of `markdown` with the plain assets; `over` on top. */
const spec = (markdown: string, over: Partial<LibMountSpec> = {}): LibMountSpec => ({ document: input(markdown), assets, watchdogMs: 60_000, ...over });

/**
 * The window listeners for messages added since the page script started, and the window's own message handlers that
 * are set. Playwright's own injected script adds input listeners to the window when a row drives the page, so the row
 * reads only the message types.
 */
const messageListeners = (r: LibRecord): string[] => [...r.windowListeners.filter((t) => t === 'message' || t === 'messageerror'), ...r.windowHandlers];

/** The adapters' events, by kind. */
const kinds = (r: LibRecord): string[] => r.events.map((e) => e.kind);

/** Wait for `n` adapter events (the progress wait: it tolerates a loaded machine). */
async function events(host: LibHost, n: number, label: string): Promise<LibRecord> {
  const w = await waitProgress(host, n, label);
  expect(w.gaveUp, `${label}: the frame stopped moving`).toBe(false);
  return host.lib();
}

/** Poll `fn` until it answers true (true), or until `capMs` has passed (false): a load-tolerant cap, never a fixed sleep. */
async function poll(fn: () => Promise<boolean> | boolean, capMs = 120_000): Promise<boolean> {
  const start = Date.now();
  for (;;) {
    if (await Promise.resolve().then(fn).catch(() => false)) return true;
    if (Date.now() - start > capMs) return false;
    await sleep(100);
  }
}

/** A setup wait: poll `fn`, and throw (an error, not an assertion) when it never answers true. */
async function until(fn: () => Promise<boolean>, label: string, capMs = 120_000): Promise<void> {
  if (!(await poll(fn, capMs))) throw new Error(`${label}: not within ${String(capMs)} ms`);
}

describeBrowsers((browser: BrowserName) => {
  it('L3.H1: sandbox exactly allow-scripts, referrerpolicy no-referrer, csp equal to frameCsp(), the title, no other attribute; focused right after mount; ready arrives', async () => {
    const host = await openLibHost(await browserFor(browser));
    try {
      await host.mount(spec(PLAIN()));
      const first = await host.lib();
      expect(first.iframe?.attributes).toEqual({ sandbox: 'allow-scripts', referrerpolicy: 'no-referrer', csp: frameCsp(), title: 'Document' });
      expect(first.activeAfterMount).toBe(true);
      const r = await events(host, 1, 'H1');
      expect(kinds(r)).toEqual(['ready']);
      const sandbox = await host.page.evaluate(() => Array.from(document.querySelector('iframe')?.sandbox ?? []));
      expect(sandbox).toEqual(['allow-scripts']);
    } finally {
      await host.close();
    }
  }, 180_000);

  it('L3.H1: with focus off the iframe is not the active element after mount', async () => {
    const host = await openLibHost(await browserFor(browser));
    try {
      await host.mount(spec(PLAIN(), { focus: false, title: 'Release notes' }));
      const r = await host.lib();
      expect(r.activeAfterMount).toBe(false);
      expect(r.iframe?.attributes['title']).toBe('Release notes');
      expect(kinds(await events(host, 1, 'H1 focus off'))).toEqual(['ready']);
    } finally {
      await host.close();
    }
  }, 180_000);

  it('L3.H2 and L3.HB3: exactly one load before ready; a second load of the frame gives navigated once, with no remount', async () => {
    const host = await openLibHost(await browserFor(browser));
    try {
      await host.mount(spec(PLAIN()));
      const r = await events(host, 1, 'H2 first ready');
      expect(kinds(r)).toEqual(['ready']);
      expect(r.loads).toHaveLength(1);
      expect(r.loads.filter((l) => l.readyBefore === 0)).toHaveLength(1);
      // The frame navigates itself (a reload of its srcdoc): its element's second load.
      await host
        .frame()
        .evaluate(() => {
          location.reload();
        })
        .catch(() => undefined);
      const after = await events(host, 2, 'H2 navigated');
      expect(kinds(after)).toEqual(['ready', 'fallback']);
      expect(after.events[1]?.value).toBe('navigated');
      expect(after.iframes).toBe(0);
      expect(messageListeners(after)).toEqual([]);
    } finally {
      await host.close();
    }
  }, 180_000);

  it('L3.H2: update makes a new iframe with a new nonce, which reaches its own ready; no window listener is added', async () => {
    const host = await openLibHost(await browserFor(browser));
    try {
      await host.mount(spec(PLAIN()));
      const first = await events(host, 1, 'H2 update first');
      const nonce = first.iframe?.nonce;
      expect(nonce).toMatch(/^[0-9a-f]{32}$/);
      await host.update(input(LINKED));
      const second = await events(host, 2, 'H2 update second');
      expect(kinds(second)).toEqual(['ready', 'ready']);
      expect(second.iframes).toBe(1);
      expect(second.iframe?.nonce).toMatch(/^[0-9a-f]{32}$/);
      expect(second.iframe?.nonce).not.toBe(nonce);
      expect(second.loads).toHaveLength(2);
      expect(messageListeners(second)).toEqual([]);
    } finally {
      await host.close();
    }
  }, 180_000);

  it('L3.HB3: per engine, the srcdoc is the first and only load before ready (Reference §11.1 step 7)', async () => {
    const host = await openLibHost(await browserFor(browser));
    try {
      await host.mount(spec(LINKED));
      const r = await events(host, 1, 'HB3');
      expect(kinds(r)).toEqual(['ready']);
      expect(r.loads.map((l) => l.readyBefore)).toEqual([0]);
      console.warn(`host-figure: HB3 ${browser} loadsBeforeReady=${String(r.loads.filter((l) => l.readyBefore === 0).length)}`);
    } finally {
      await host.close();
    }
  }, 180_000);

  it('L3.HB2: in a frame mounted through mountDocFrame, window.open returns null and top.location = throws', async () => {
    const host = await openLibHost(await browserFor(browser));
    try {
      await host.mount(spec(PLAIN()));
      expect(kinds(await events(host, 1, 'HB2'))).toEqual(['ready']);
      const got = await host.frame().evaluate(() => {
        const w = window.open('https://b.docreader.test/hb2-popup');
        let threw = false;
        try {
          (top as Window).location.href = 'https://b.docreader.test/hb2-top';
        } catch {
          threw = true;
        }
        return { opened: w !== null, threw };
      });
      expect(got).toEqual({ opened: false, threw: true });
      // A barrier for the absence check: a request the page makes after the attempts has reached the route log.
      await host.page.evaluate(() => fetch('/hb2-barrier').then(
        () => undefined,
        () => undefined,
      ));
      expect(host.requests.some((r) => new URL(r.url).pathname === '/hb2-barrier')).toBe(true);
      expect(host.requests.filter((r) => /\/hb2-(popup|top)$/.test(new URL(r.url).pathname)).map((r) => r.url)).toEqual([]);
      expect(host.page.context().pages()).toHaveLength(1);
      expect(host.page.url()).toBe('https://docreader.test/');
    } finally {
      await host.close();
    }
  }, 180_000);

  it('L3.HB2 control: a bare iframe with allow-popups and allow-top-navigation opens the window and sets the location', async () => {
    const host = await openFrameHost(await browserFor(browser));
    try {
      const nonce = freshNonce();
      await host.mount(frameDocument(input(PLAIN()), { csp: frameCsp(), nonce, assets }), frameCsp(), { hello: 'none', sandbox: 'allow-scripts allow-popups allow-top-navigation' });
      await until(() => host.frame().evaluate(() => document.readyState === 'complete'), 'HB2 control frame loaded');
      const seen = (p: string): boolean => host.requests.some((r) => new URL(r.url).pathname === p);
      const opened = await host.frame().evaluate(() => window.open('https://b.docreader.test/hb2-popup') !== null);
      expect(opened).toBe(true);
      expect(await poll(() => seen('/hb2-popup')), 'the popup request reached the route log').toBe(true);
      // The top navigation may take the frame's context with it before the evaluate answers, so the answer may be a
      // rejection; the request in the route log is the evidence, and a throw the frame reports is a failure.
      const threw = await host
        .frame()
        .evaluate(() => {
          try {
            (top as Window).location.href = 'https://b.docreader.test/hb2-top';
            return false;
          } catch {
            return true;
          }
        })
        .catch(() => 'no answer' as const);
      expect(threw).not.toBe(true);
      expect(await poll(() => seen('/hb2-top')), 'the top navigation request reached the route log').toBe(true);
      expect(host.requests.find((r) => new URL(r.url).pathname === '/hb2-top')?.main).toBe(true);
    } finally {
      await host.close();
    }
  }, 180_000);

  it("L3.HB4: well-formed ops posted to the parent's window have no effect; the link forwarded on the port after them does", async () => {
    const host = await openLibHost(await browserFor(browser));
    try {
      await host.mount(spec(LINKED));
      const r = await events(host, 1, 'HB4 ready');
      expect(kinds(r)).toEqual(['ready']);
      const nonce = r.iframe?.nonce ?? '';
      await host.frame().evaluate((n) => {
        parent.postMessage({ t: 'navigate', href: 'https://b.docreader.test/hb4' }, '*');
        parent.postMessage({ t: 'hash', id: 'hb4' }, '*');
        parent.postMessage({ t: 'copy', text: 'hb4' }, '*');
        parent.postMessage({ t: 'ready', v: 1, nonce: n }, '*');
        parent.postMessage({ t: 'error', why: 'boot' }, '*');
      }, nonce);
      // The forwarded link is the barrier: it reaches the host after the strays were posted. A host that acted on a
      // stray (a fallback at the stray error) has removed the frame by now, so the click may find none; the row then
      // reads what the adapters saw.
      await host
        .frame()
        .evaluate(() => {
          (document.querySelector('a[href="https://example.test/out"]') as HTMLAnchorElement).click();
        })
        .catch(() => undefined);
      const after = await events(host, 2, 'HB4 link');
      expect(after.events.map((e) => [e.kind, e.value])).toEqual([
        ['ready', null],
        ['onLink', { kind: 'external', url: 'https://example.test/out', scheme: 'https', host: 'example.test' }],
      ]);
      expect(after.iframes).toBe(1);
      expect(messageListeners(after)).toEqual([]);
    } finally {
      await host.close();
    }
  }, 180_000);

  it('L3.HB1: the exfiltration battery reaches nothing, at origin B or A, from a frame mounted through mountDocFrame', async () => {
    const host = await openLibHost(await browserFor(browser));
    try {
      await host.mount(spec(PLAIN()));
      expect(kinds(await events(host, 1, 'HB1 ready'))).toEqual(['ready']);
      // The attacked frame is the one mountDocFrame made: the srcdoc document, carrying the frame's own policy.
      const where = await host.frame().evaluate(() => ({
        href: location.href,
        policy: document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.getAttribute('content') ?? null,
      }));
      expect(where).toEqual({ href: 'about:srcdoc', policy: frameCsp() });
      const from = { requests: host.requests.length, websockets: host.websockets.length };
      const thrown = await attemptAll(host.frame());
      const probed = await attemptAll(host.page.mainFrame(), (c) => (PROBE_SKIP.includes(c.slug) ? [] : [urlProbe(c)]));
      const notProbe = (): number => host.requests.slice(from.requests).filter((r) => !isProbe(r.url)).length;
      const ms = await settle(
        () =>
          `${reached(host.requests, host.websockets, from).map((c) => c.slug).join(',')}|${String(notProbe())}|${String(host.cspConsole.length)}|${probeReached(host.requests, host.websockets, from).map((c) => c.slug).join(',')}`,
        { quietMs: 3000, minMs: 4000, capMs: 90_000, more: () => probeReached(host.requests, host.websockets, from).length < REACH_BAR },
      );
      const leaked = reached(host.requests, host.websockets, from);
      const barrier = probeReached(host.requests, host.websockets, from);
      console.warn(`host-figure: HB1 ${browser} mountedReached=${String(leaked.length)} channels=${leaked.map((c) => c.slug).join(',')} settledMs=${String(ms)}`);
      console.warn(`host-figure: HB1 ${browser} probeReached=${String(barrier.length)} channels=${barrier.map((c) => c.slug).join(',')}`);
      console.warn(`host-measure: ${JSON.stringify({ row: 'HB1 mounted', browser, thrown, probed })}`);
      expect(CHANNELS).toHaveLength(27);
      // Every attempt ran: it answered 'ok' or an exception its channel lists, never a failed evaluate.
      expect(notRun(thrown)).toEqual([]);
      // The barrier passed: the probe's requests, made after the battery, reached the route log.
      expect(barrier.length).toBeGreaterThanOrEqual(REACH_BAR);
      expect(leaked.map((c) => c.slug)).toEqual([]);
      expect(host.requests.slice(from.requests).filter((r) => !isProbe(r.url)).map((r) => r.url)).toEqual([]);
      expect(host.websockets.slice(from.websockets).filter((u) => !isProbe(u))).toEqual([]);
      // The frame is still the one mounted: no fallback, one iframe.
      const after = await host.lib();
      expect(kinds(after)).toEqual(['ready']);
      expect(after.iframes).toBe(1);
    } finally {
      await host.close();
    }
  }, 300_000);

  it('L3.HB1 control: the same srcdoc without its policy meta, in a bare iframe with sandbox="allow-scripts" and no csp attribute, reaches B on at least 20 of the 27 channels', async () => {
    const host = await openFrameHost(await browserFor(browser));
    try {
      const policy = frameCsp();
      const meta = `<meta http-equiv="Content-Security-Policy" content="${policy}">`;
      const srcdoc = frameDocument(input(PLAIN()), { csp: policy, nonce: freshNonce(), assets });
      expect(srcdoc.startsWith(meta)).toBe(true);
      await host.mount(srcdoc.slice(meta.length), policy, { hello: 'none', cspAttribute: false });
      await until(() => host.frame().evaluate(() => document.readyState === 'complete'), 'HB1 control frame loaded');
      const from = { requests: host.requests.length, websockets: host.websockets.length };
      const thrown = await attemptAll(host.frame());
      // The signature is the set of channels reached, not the raw log: an EventSource reconnects every few seconds.
      const ms = await settle(() => reachedB(host.requests, host.websockets, from).map((c) => c.slug).join(','), {
        quietMs: 3000,
        minMs: 4000,
        capMs: 90_000,
        more: () => reachedB(host.requests, host.websockets, from).length < REACH_BAR,
      });
      const got = reachedB(host.requests, host.websockets, from);
      console.warn(`host-figure: HB1 ${browser} controlReached=${String(got.length)} channels=${got.map((c) => c.slug).join(',')} settledMs=${String(ms)}`);
      console.warn(`host-measure: ${JSON.stringify({ row: 'HB1 control', browser, thrown, missed: CHANNELS.filter((c) => !got.includes(c)).map((c) => c.slug) })}`);
      expect(got.length).toBeGreaterThanOrEqual(REACH_BAR);
    } finally {
      await host.close();
    }
  }, 300_000);
});
