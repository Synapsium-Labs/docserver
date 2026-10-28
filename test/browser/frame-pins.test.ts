// The frame's free-global pins and its snapshot round trip, on the integrated build (docserver L3, Task 8; plan
// Reference §3, §5.5, §8.3, ruling R2, FD6; rows L3.B3p and L3.B8s, the halves of L3.B3 and L3.B8 that only the
// integrated build can show).
//
//   L3.B3p  The free-global half of L3.B3. Only the integrated build carries the real scanned list: the bootstrap's
//           DOCSERVER_FREE_GLOBALS, Task 6's binder scan of the four bundled scripts (Mermaid's probed names among them).
//           One anchor for every name on that list, ahead of a document holding one figure of each diagram kind below,
//           so that every name is an element id before any script reads it lazily: the frame still readies with the
//           right nonce and no error or violation, every figure draws with the same SVG text as the clean document's,
//           and a link still routes. An id shadows a name only where the window has no own property of it (what it
//           inherits, such as `addEventListener`, and what it lacks, such as `cytoscape`); the pin makes each such name
//           an own read-only property first (src/frame-runtime/pin.ts).
//   L3.B8s  The snapshot half of L3.B8. The store writes one mount sends (`pref:prefs` from a prefs message,
//           `pref:ui` from the rail's Index tab, `doc:folds` from a folded section) come back on the next mount through
//           frameDocument's `snapshot`, and the reader starts from them: the theme, the tab and the fold.
//
// The diagram kinds: the corpus draws flowcharts and sequence diagrams only, so the kinds the pinned names are read in
// are added here (Mermaid's layout code reads several of the names the scan lists, such as cytoscape's in the mindmap,
// C91 (3)). Release bytes only: no init script, violations and errors read from the parent's side.
import { afterAll, beforeAll, expect, it } from 'vitest';
import { frameCsp, frameDocument, type BridgeStoreKey, type FrameAssets } from '../../src/frame/index.js';
import { openFrameHost, type FrameHost } from './frame-host-page.js';
import { data, figure, freshNonce, input, KINDS, KINDS_DOC, loadFrame, opsOf, readyOf, sleep, svgTexts, waitProgress } from './frame-shared.js';
import { browserFor, closeBrowsers, describeBrowsers } from './harness.js';

let assets: FrameAssets;
let mermaidText = '';
let freeGlobals: readonly string[] = [];

beforeAll(async () => {
  const built = await loadFrame();
  assets = built.assets;
  mermaidText = built.mermaid;
  freeGlobals = built.freeGlobals;
}, 300_000);

afterAll(closeBrowsers);

/** The anchor grammar render() admits (`<!-- id:X -->`, src/render/allowlist.ts). */
const ANCHOR = /^[A-Za-z0-9_-]{1,100}$/;

const mermaidOn = (md: string, nonce: string): string => frameDocument(input(md), { csp: frameCsp(), nonce, assets: { ...assets, mermaid: mermaidText }, mermaid: {} });

describeBrowsers((browser) => {
  it("L3.B3p: one anchor for every name of the built bootstrap's free-global list: ready with the right nonce, every diagram kind draws as in the clean document, a link routes", async () => {
    // The list is the one the built bootstrap carries, exactly once, as the build's define writes it.
    expect(freeGlobals.length).toBeGreaterThan(0);
    expect(assets.bootstrap.split(JSON.stringify(freeGlobals)).length).toBe(2);
    expect(freeGlobals.filter((n) => !ANCHOR.test(n))).toEqual([]);
    const handle = await browserFor(browser);
    let clean: string[] = [];
    let host: FrameHost = await openFrameHost(handle);
    try {
      const nonce = freshNonce();
      await host.mount(mermaidOn(KINDS_DOC, nonce), frameCsp());
      await waitProgress(host, 1, `L3.B3p clean ${browser}`, 30_000);
      await sleep(300);
      expect({ messages: data(await host.record()), violations: host.cspConsole, errors: host.errors }).toEqual({ messages: [readyOf(nonce)], violations: [], errors: [] });
      const drawn = await host.frame().evaluate(() => Array.from(document.querySelectorAll('figure.mermaid-figure'), (f) => f.querySelector('svg') !== null));
      expect(drawn, 'every kind draws in the clean document').toEqual(KINDS.map(() => true));
      clean = await svgTexts(host);
      expect(clean.every((t) => t.length > 0)).toBe(true);
    } finally {
      await host.close();
    }
    host = await openFrameHost(handle);
    try {
      const nonce = freshNonce();
      const anchors = freeGlobals.map((n) => `<!-- id:${n} -->\n\nText about ${n}, [a link](to-${n}.md).\n`).join('\n');
      await host.mount(mermaidOn(`# Pinned\n\n${anchors}\n${KINDS_DOC.replace(/^# Kinds\n/, '## Kinds\n')}`, nonce), frameCsp());
      const { rec } = await waitProgress(host, 1, `L3.B3p anchored ${browser}`, 30_000);
      await sleep(300);
      expect({ messages: data(await host.record()), violations: host.cspConsole, errors: host.errors }).toEqual({ messages: [readyOf(nonce)], violations: [], errors: [] });
      // The clobbering is real: every name is an element id in the frame.
      const missing = await host.frame().evaluate((ns) => ns.filter((n) => document.getElementById(n) === null), [...freeGlobals]);
      expect(missing).toEqual([]);
      expect(await svgTexts(host)).toEqual(clean);
      const link = 'to-addEventListener.md';
      expect(freeGlobals).toContain('addEventListener');
      await host.frame().locator(`article a[href="${link}"]`).click();
      await sleep(400);
      const after = await host.record();
      expect(opsOf(after, ['navigate', 'error'])).toEqual([{ t: 'navigate', href: link }]);
      expect(after.loads).toHaveLength(1);
      figure('L3.B3p', browser, 'pinnedNames', freeGlobals.length);
      figure('L3.B3p', browser, 'insertionToReadyMs', rec.messages[0]?.at ?? -1);
    } finally {
      await host.close();
    }
  }, 300_000);

  it('L3.B8s: pref:prefs, pref:ui and doc:folds written in one mount come back through the snapshot on the next, and the reader starts from them', async () => {
    const handle = await browserFor(browser);
    // A document by L2's measure (an h1 and more than two h2s), so its sections fold, with a table of defined IDs, so
    // the rail has an Index tab.
    const md = '# Store\n\nIntro.\n\n## First\n\nOne.\n\n| ID | Decision |\n|---|---|\n| D1 | First |\n| D2 | Second |\n\n## Second\n\nTwo.\n\n## Third\n\nThree.\n';
    let snapshot: Partial<Record<BridgeStoreKey, string>> = {};
    let host = await openFrameHost(handle);
    try {
      const nonce = freshNonce();
      await host.mount(frameDocument(input(md), { csp: frameCsp(), nonce, assets }), frameCsp());
      await waitProgress(host, 1, `L3.B8s first ${browser}`);
      expect(data(await host.record())[0]).toEqual(readyOf(nonce));
      await host.send('main', { t: 'prefs', theme: 'dark' });
      await sleep(300);
      // The rail's Index tab, chosen through the frame handle (on a 1000 px frame the rail is a drawer).
      const tab = await host.frame().evaluate(() => {
        const b = Array.from(document.querySelectorAll('[role="tab"]')).find((x) => (x.textContent ?? '').startsWith('Index'));
        if (!(b instanceof HTMLElement)) return null;
        b.click();
        return b.getAttribute('aria-selected');
      });
      expect(tab).toBe('true');
      await host.frame().evaluate(() => {
        const btn = document.querySelector('article h2 .h-fold');
        if (!(btn instanceof HTMLElement)) throw new Error('no fold button');
        btn.click();
      });
      await sleep(1200);
      const sets = opsOf(await host.record(), ['store.set']) as { t: 'store.set'; key: BridgeStoreKey; value: string }[];
      for (const s of sets) snapshot[s.key] = s.value;
      expect(Object.keys(snapshot).sort()).toEqual(expect.arrayContaining(['doc:folds', 'pref:prefs', 'pref:ui']));
      expect(JSON.parse(snapshot['pref:prefs'] ?? '{}')).toMatchObject({ theme: 'dark' });
      expect(JSON.parse(snapshot['pref:ui'] ?? '{}')).toMatchObject({ sidetab: 'index' });
      expect(snapshot['doc:folds']).not.toBe('null');
      // Only the three keys this row reads are carried, each as the parent would store it.
      snapshot = { 'pref:prefs': snapshot['pref:prefs'], 'pref:ui': snapshot['pref:ui'], 'doc:folds': snapshot['doc:folds'] } as Partial<Record<BridgeStoreKey, string>>;
    } finally {
      await host.close();
    }
    host = await openFrameHost(handle);
    try {
      const nonce = freshNonce();
      await host.mount(frameDocument(input(md), { csp: frameCsp(), nonce, assets, snapshot }), frameCsp());
      await waitProgress(host, 1, `L3.B8s second ${browser}`);
      await sleep(300);
      expect({ messages: data(await host.record()).slice(0, 1), violations: host.cspConsole, errors: host.errors }).toEqual({ messages: [readyOf(nonce)], violations: [], errors: [] });
      const state = await host.frame().evaluate(() => {
        const root = document.body.querySelector(':scope > article');
        const index = Array.from(document.querySelectorAll('[role="tab"]')).find((x) => (x.textContent ?? '').startsWith('Index'));
        const h2 = document.querySelector('article h2');
        return {
          theme: root?.getAttribute('data-theme') ?? null,
          indexTab: index?.getAttribute('aria-selected') ?? null,
          folded: h2?.classList.contains('folded') ?? null,
          expanded: h2?.querySelector('.h-fold')?.getAttribute('aria-expanded') ?? null,
        };
      });
      expect(state).toEqual({ theme: 'dark', indexTab: 'true', folded: true, expanded: 'false' });
      // Starting from the snapshot sends nothing back: the reader writes only after a local change.
      expect(opsOf(await host.record(), ['store.set', 'error'])).toEqual([]);
    } finally {
      await host.close();
    }
  }, 180_000);
});
