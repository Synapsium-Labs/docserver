// The sealed frame's policy and its isolation, on the bytes that ship (docserver L3, Task 8; plan Reference §2, §10, the
// Global Constraints "Hash-only CSP" and "No network"; rows L3.B1, L3.B2 and L3.B13). Each row mounts a frameDocument
// output, under frameCsp(), in the parent page of frame-host-page.ts, with the assets built in memory exactly as
// `node scripts/build-frame.mjs` writes them (frame-shared.ts) and verified by frameDocument against the committed
// manifest. Violations are read from the parent's side (the console messages of the page's frames), requests from the
// context's route (every request the page or its frame makes, the page itself included), and the frame's state through
// Playwright's frame handle. No row adds an init script: the frame's realm runs only the srcdoc's own scripts.
//
//   L3.B1   the policy admits exactly what ships: zero violations, a standards-mode document, enhance resolved, a
//           flowchart, a sequence diagram and a gantt drawn with no 'unsafe-eval', and the fonts loaded from data:
//           URLs; one message on any port, the ready with exactly its keys; the request log holds the page's own load
//           and nothing else. Its control: a policy without the bootstrap's hash gives no port message, and the parent
//           hears the refusal (so the zero violations above are a measurement, not a deaf collector). Prototype rows
//           P1, P2 and P7's half.
//   (wait)  the progress wait's control: a frame whose thread never yields is given up on within the stall plus the
//           busy allowance (frame-shared.ts's waitProgress), never only at its cap.
//   L3.B2   no request leaves the frame, over every golden and hostile corpus document and the Level 2 hostile Mermaid
//           cases, each mounted with Mermaid on. Its control: with no policy an image the frame loads from another
//           origin is logged as the frame's request, and under frameCsp() the same image is refused with no request
//           (so the request log's zero is a measurement, not a deaf collector).
//   L3.B13  the frame's opaque origin has no storage: Web Storage, the cookie and the Cache API each throw or are empty,
//           IndexedDB refuses to open, and booting raises no uncaught error. Its control: the same probe in the parent
//           page opens IndexedDB, which the check reads as usable.
//
// Figures (insertion to ready) print as `frame-figure:` lines, one per figure, with the engine's name.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { frameCsp, FRAME_MANIFEST, type FrameAssets } from '../../src/frame/index.js';
import { render } from '../../src/render/index.js';
import { openFrameHost, type FrameHost } from './frame-host-page.js';
import {
  corpusDocuments,
  data,
  DIAGRAMS,
  figure,
  freshNonce,
  loadFrame,
  PLAIN,
  readyOf,
  refusals,
  ROOT,
  sleep,
  srcdocFor,
  waitProgress,
  withPolicy,
} from './frame-shared.js';
import { browserFor, closeBrowsers, describeBrowsers, ORIGIN } from './harness.js';

let assets: FrameAssets;
let mermaidText = '';

beforeAll(async () => {
  const built = await loadFrame();
  assets = built.assets;
  mermaidText = built.mermaid;
}, 300_000);

afterAll(closeBrowsers);

/** The Level 2 cases that carry the spec's hostile Mermaid inputs (conformance/layout/diagrams/), with their limits. */
const HOSTILE_MERMAID: readonly { readonly id: string; readonly mermaid: { maxTextSize?: number; maxEdges?: number } }[] = [
  { id: 'theme-css', mermaid: {} },
  { id: 'click', mermaid: {} },
  { id: 'html-label', mermaid: {} },
  { id: 'label-style', mermaid: {} },
  { id: 'too-long', mermaid: { maxTextSize: 120 } },
  { id: 'edges', mermaid: { maxEdges: 3 } },
];

const layoutCase = (id: string): string => readFileSync(path.join(ROOT, 'conformance', 'layout', 'diagrams', `${id}.md`), 'utf8');

/** The requests other than the page's own load: none is expected. A data: URL never reaches the route. */
const leaks = (host: FrameHost): string[] => host.requests.filter((r) => !(r.main && r.url === `${ORIGIN}/`)).map((r) => r.url);

/**
 * What each store answers in the realm it runs in: `threw:<name>`, or `value:<JSON>`. IndexedDB is opened (version 1):
 * `opened:upgraded` or `opened:existing` is a usable store, `refused:<name>` an error event, and `pending` no answer
 * within 3 s. Passed whole to evaluate, so it runs in the frame (L3.B13) and in the parent page (its control).
 */
const probeStores = async (): Promise<Record<'localStorage' | 'sessionStorage' | 'indexedDB' | 'cookie' | 'cookieWrite' | 'caches', string>> => {
  const attempt = async (f: () => unknown): Promise<string> => {
    try {
      const v = await f();
      return `value:${JSON.stringify(v)}`;
    } catch (e) {
      return `threw:${(e as { name?: string } | null)?.name ?? 'unknown'}`;
    }
  };
  return {
    localStorage: await attempt(() => window.localStorage.length),
    sessionStorage: await attempt(() => window.sessionStorage.length),
    indexedDB: await attempt(
      () =>
        new Promise<string>((resolve) => {
          // Opening is the use: a successful open or an upgrade is a usable store, whatever it holds (a fresh database
          // has no stores, so a store count would read empty either way). An error event is a refusal; a throw is caught
          // by attempt. Neither answer within 3 s reads as pending.
          const req = window.indexedDB.open('docreader-probe', 1);
          let upgraded = false;
          req.onupgradeneeded = (): void => {
            upgraded = true;
          };
          req.onsuccess = (): void => {
            req.result.close();
            resolve(`opened:${upgraded ? 'upgraded' : 'existing'}`);
          };
          req.onerror = (): void => {
            resolve(`refused:${req.error?.name ?? 'unknown'}`);
          };
          setTimeout(() => {
            resolve('pending');
          }, 3000);
        }),
    ),
    cookie: await attempt(() => document.cookie),
    cookieWrite: await attempt(() => {
      document.cookie = 'probe=1';
      return document.cookie;
    }),
    caches: await attempt(async () => (typeof caches === 'undefined' ? 'absent' : (await caches.keys()).length)),
  };
};

/** IndexedDB refused the probe: the open threw, or its request failed. */
const idbRefused = (v: string): boolean => /^(threw:|value:"refused:)/.test(v);

describeBrowsers((browser) => {
  it('L3.B1: under frameCsp() with Mermaid on, zero violations, CSS1Compat, enhance resolved, a flowchart, a sequence and a gantt drawn with no unsafe-eval, the fonts from data: URLs', async () => {
    const host = await openFrameHost(await browserFor(browser));
    try {
      const policy = frameCsp();
      expect(policy).not.toContain("'unsafe-eval'");
      expect(policy.split(';').find((d) => d.trim().startsWith('script-src'))?.trim().split(/\s+/).slice(1)).toEqual(
        (['guard', 'bootstrap', 'enhance', 'mermaid'] as const).map((k) => FRAME_MANIFEST[k].csp),
      );
      const nonce = freshNonce();
      const srcdoc = srcdocFor({ ...assets, mermaid: mermaidText }, DIAGRAMS, nonce, { mermaid: {} });
      await host.mount(srcdoc, policy);
      const { rec } = await waitProgress(host, 1, `L3.B1 ${browser}`);
      await sleep(400);
      const after = await host.record();
      expect({ messages: data(after), violations: host.cspConsole, errors: host.errors, loads: after.loads.length, windowMessages: after.windowMessages }).toEqual({
        messages: [readyOf(nonce)],
        violations: [],
        errors: [],
        loads: 1,
        windowMessages: [],
      });
      // One message on any port (data() reads the main port only), and the ready carries exactly its three keys, in order.
      expect(after.messages).toHaveLength(1);
      expect(after.messages[0]?.port).toBe('main');
      expect(Object.keys(after.messages[0]?.data as object)).toEqual(['t', 'v', 'nonce']);
      // The request log heard the page's own load and nothing else (the collector is live: L3.B2's control proves it
      // hears a frame's request too).
      expect(host.requests).toEqual([{ url: `${ORIGIN}/`, main: true }]);
      const state = await host.frame().evaluate(async () => {
        const root = document.body.querySelector(':scope > article');
        // Every @font-face rule of the frame's one stylesheet, and its src: each must be an inlined woff2 data: URL.
        const faces: string[] = [];
        for (const sheet of Array.from(document.styleSheets)) {
          for (const rule of Array.from(sheet.cssRules)) {
            if (rule instanceof CSSFontFaceRule) faces.push(rule.style.getPropertyValue('src'));
          }
        }
        await document.fonts.ready;
        return {
          compat: document.compatMode,
          origin: self.origin,
          root: root === null ? null : root.localName,
          rooted: root !== null && root.hasAttribute('data-docreader-root'),
          diagrams: root?.getAttribute('data-docreader-diagrams') ?? null,
          kinds: Array.from(document.querySelectorAll('figure.mermaid-figure svg'), (s) => s.getAttribute('aria-roledescription')),
          faces,
          loaded: Array.from(document.fonts, (f) => `${f.family.replace(/"/g, '')} ${f.style} ${f.status}`).filter((f) => f.endsWith(' loaded')),
        };
      });
      expect({ compat: state.compat, origin: state.origin, root: state.root, rooted: state.rooted, diagrams: state.diagrams }).toEqual({
        compat: 'CSS1Compat',
        origin: 'null',
        root: 'article',
        rooted: true,
        diagrams: 'drawn',
      });
      expect(state.kinds).toEqual(['flowchart-v2', 'sequence', 'gantt']);
      expect(state.faces.length).toBeGreaterThan(0);
      // Every url( of every face's src is an inlined woff2 font (the fallback faces name local() fonts only), and the
      // four faces of the two families each have one.
      let urled = 0;
      for (const src of state.faces) {
        const urls = src.match(/url\(/g) ?? [];
        if (urls.length > 0) urled++;
        expect(src.match(/url\("?data:font\/woff2;base64,[A-Za-z0-9+/=]+"?\)/g)?.length ?? 0, src.slice(0, 80)).toBe(urls.length);
      }
      expect(urled).toBe(4);
      // The regular faces of both families loaded (the reader waits for them before ready), from those data: URLs.
      expect(state.loaded).toEqual(expect.arrayContaining([expect.stringMatching(/^Docreader Serif normal loaded$/), expect.stringMatching(/^Docreader Sans normal loaded$/)]));
      expect(leaks(host)).toEqual([]);
      figure('L3.B1', browser, 'insertionToReadyMs', rec.messages[0]?.at ?? -1);
      figure('L3.B1', browser, 'srcdocChars', srcdoc.length);
    } finally {
      await host.close();
    }
  }, 180_000);

  it('L3.B1 control: a policy without the bootstrap hash gives no port message, the progress wait gives up once the frame stops moving, and the parent hears the refusal', async () => {
    const host = await openFrameHost(await browserFor(browser));
    try {
      const nonce = freshNonce();
      const good = frameCsp();
      const bad = good.replace(` ${FRAME_MANIFEST.bootstrap.csp}`, '');
      await host.mount(withPolicy(srcdocFor(assets, PLAIN(), nonce), good, bad), bad);
      // The wait the corpus rows use (waitProgress) ends on a frame that stops moving: here after 3 s of stillness,
      // well before its cap, with no message.
      const { rec, ms, extended } = await waitProgress(host, 1, `L3.B1 control ${browser}`, 3000, 60_000);
      expect({ messages: rec.messages, extended }).toEqual({ messages: [], extended: true });
      expect(ms).toBeLessThan(30_000);
      expect(rec.loads).toHaveLength(1);
      expect(refusals(host, /script-src/)).not.toEqual([]);
    } finally {
      await host.close();
    }
  });

  it("the progress wait's control: a frame whose thread never yields is given up on once its busy allowance is spent, long before the frame frees itself", async () => {
    const host = await openFrameHost(await browserFor(browser));
    try {
      // A frame with no policy whose one script holds its thread for 45 s: no message, no load, and every poll that asks
      // the frame (or, where the frame shares the page's thread, the page) waits on it. A busy poll may stretch the wait
      // only by the allowance (6 s here), so the wait gives up within the stall plus the allowance plus a poll or two.
      await host.mount('<!doctype html><title>Busy</title><script>const end = Date.now() + 45000; while (Date.now() < end) {}</script>', '');
      const w = await waitProgress(host, 1, `wait control ${browser}`, 3000, 120_000, 6000);
      expect({ messages: w.rec.messages, extended: w.extended, gaveUp: w.gaveUp }).toEqual({ messages: [], extended: true, gaveUp: true });
      expect(w.ms).toBeLessThan(25_000);
    } finally {
      await host.close().catch(() => undefined);
    }
  }, 180_000);

  it("L3.B2 control: the request log hears a frame's request (with no policy, an image the frame loads from another origin is logged as the frame's), and under frameCsp() the same image makes no request and the parent hears the refusal", async () => {
    // A hand-written document, not a frameDocument output: render() never writes an image the frame would fetch.
    const doc = '<!doctype html><title>Image</title><p><img src="https://elsewhere.docreader.test/probe.png" alt="probe"></p>';
    const open = await openFrameHost(await browserFor(browser));
    try {
      await open.mount(doc, '');
      const until = Date.now() + 20_000;
      while (leaks(open).length === 0 && Date.now() < until) await sleep(100);
      expect(open.requests.filter((r) => !r.main)).toEqual([{ url: 'https://elsewhere.docreader.test/probe.png', main: false }]);
    } finally {
      await open.close();
    }
    const sealed = await openFrameHost(await browserFor(browser));
    try {
      // The policy as the frame carries it: in a meta (every engine) and in the csp attribute (where supported).
      const policy = frameCsp();
      expect(policy).not.toContain('"');
      await sealed.mount(doc.replace('<title>', `<meta http-equiv="Content-Security-Policy" content="${policy}"><title>`), policy);
      const until = Date.now() + 20_000;
      while (refusals(sealed, /img-src/).length === 0 && Date.now() < until) await sleep(100);
      await sleep(500);
      expect(leaks(sealed)).toEqual([]);
      expect(refusals(sealed, /img-src/)).not.toEqual([]);
    } finally {
      await sealed.close();
    }
  });

  it('L3.B2: no request leaves the frame over every golden and hostile corpus document and the hostile Mermaid cases, each with Mermaid on: ready, no error, no violation', async () => {
    const handle = await browserFor(browser);
    const docs = [
      ...corpusDocuments().filter((d) => render(d.markdown).outcome === 'rendered').map((d) => ({ id: d.id, markdown: d.markdown, mermaid: {} })),
      ...HOSTILE_MERMAID.map((c) => ({ id: `layout/diagrams/${c.id}`, markdown: layoutCase(c.id), mermaid: c.mermaid })),
    ];
    const got: Record<string, unknown> = {};
    let images = 0;
    for (const d of docs) {
      const host = await openFrameHost(handle);
      try {
        const nonce = freshNonce();
        await host.mount(srcdocFor({ ...assets, mermaid: mermaidText }, d.markdown, nonce, { mermaid: d.mermaid }), frameCsp());
        await waitProgress(host, 1, `L3.B2 ${browser} ${d.id}`);
        await sleep(150);
        const rec = await host.record();
        const ready = JSON.stringify(data(rec)[0]) === JSON.stringify(readyOf(nonce));
        const errors = data(rec).filter((m) => (m as { t: string }).t === 'error');
        images += await host.frame().evaluate(() => document.querySelectorAll('article .ds-img-missing, article img').length);
        const fault = { ready, errors, leaks: leaks(host), violations: host.cspConsole.length, loads: rec.loads.length };
        if (!ready || errors.length > 0 || fault.leaks.length > 0 || fault.violations > 0 || fault.loads !== 1) got[d.id] = fault;
      } finally {
        await host.close().catch(() => undefined);
      }
    }
    expect(got).toEqual({});
    // The corpus has documents with images (each a chip, the frame carrying no image map here), so the row covers them.
    expect(images).toBeGreaterThan(0);
    figure('L3.B2', browser, 'documents', docs.length);
  }, 900_000);

  it('L3.B13: Web Storage, IndexedDB, the cookie and the Cache API throw or are empty in the frame, and booting raised no uncaught error', async () => {
    const host = await openFrameHost(await browserFor(browser));
    try {
      const nonce = freshNonce();
      await host.mount(srcdocFor({ ...assets, mermaid: mermaidText }, DIAGRAMS, nonce, { mermaid: {} }), frameCsp());
      await waitProgress(host, 1, `L3.B13 ${browser}`);
      await sleep(300);
      expect({ messages: data(await host.record()), errors: host.errors, violations: host.cspConsole }).toEqual({ messages: [readyOf(nonce)], errors: [], violations: [] });
      // Read from the parent's side through Playwright's frame handle: each store either throws or holds nothing.
      const stores = await host.frame().evaluate(probeStores);
      const emptyOrThrew = (v: string, empty: readonly string[]): boolean => v.startsWith('threw:') || empty.includes(v);
      expect(emptyOrThrew(stores.localStorage, ['value:0']), JSON.stringify(stores)).toBe(true);
      expect(emptyOrThrew(stores.sessionStorage, ['value:0']), JSON.stringify(stores)).toBe(true);
      // IndexedDB must refuse: an open that succeeds is a usable store, empty or not (review finding S2).
      expect(idbRefused(stores.indexedDB), JSON.stringify(stores)).toBe(true);
      expect(emptyOrThrew(stores.cookie, ['value:""']), JSON.stringify(stores)).toBe(true);
      expect(emptyOrThrew(stores.cookieWrite, ['value:""']), JSON.stringify(stores)).toBe(true);
      expect(emptyOrThrew(stores.caches, ['value:"absent"', 'value:0']), JSON.stringify(stores)).toBe(true);
      // Nothing above reached the network either.
      expect(leaks(host)).toEqual([]);
      console.warn(`frame-measure: ${JSON.stringify({ label: 'L3.B13 stores', browser, ...stores })}`);
    } finally {
      await host.close();
    }
  }, 120_000);

  it("L3.B13 control: the same probe in the parent page (an ordinary origin) opens IndexedDB, which the row's check reads as a usable store", async () => {
    const host = await openFrameHost(await browserFor(browser));
    try {
      const stores = await host.page.evaluate(probeStores);
      console.warn(`frame-measure: ${JSON.stringify({ label: 'L3.B13 control stores', browser, ...stores })}`);
      expect(stores.indexedDB).toMatch(/^value:"opened:/);
      expect(idbRefused(stores.indexedDB)).toBe(false);
    } finally {
      await host.close();
    }
  });
});
