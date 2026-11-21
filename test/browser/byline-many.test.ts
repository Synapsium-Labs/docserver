// A byline of many separators in a real browser (review 3088 F3). The screen used to cut the meta line's text with two
// `journal.split`s per separator and to undo each with an `appendData` (quadratic: 32 000 took seconds, 64 000 minutes). One
// `journal.splitAll` per text child cuts at every separator and undoes with one write and one range deletion. The bound is a
// count of DOM operations in the page, never a clock: `splitText` and `appendData` are not called at all, `removeChild`
// only for the handful of chrome nodes, `createRange` once per text child of the paragraph (never per separator), and
// destroy restores the root's html exactly. jsdom is quadratic in a parent's children, so the large cases live here and
// test/enhance-editorial.test.ts holds the same counts at 500.
//
// The number of text children is the engine's to decide, so it is measured in the page before enhance, never assumed to be
// one: WebKit's parser cuts a long text into nodes of at most 65 536 code units (Blink's does not; this limit is read from
// WebKit's source and has not been run, until CI confirms it), so the same 32 000-separator paragraph came out as five text
// nodes there and `createRange` was called five times (CI, review 3088 F3). The second case makes that shape on every
// engine: the text is cut into five nodes at separators before enhance runs. The WebKit large case is sized over the limit
// (10 000 separators, about 78 900 code units) and asserts at least two text nodes, which a red there would disprove.
//
// The size is per engine, for a stated reason. Chromium runs 32 000 separators in about 0.6 s here (linear: 4 000 to 32 000
// took 0.09 s to 0.58 s). CI's run of this case at 32 000 in WebKit took 53 695 ms on the Node 22 leg (it failed only on
// the range count) while Chromium took 3 207 ms and 2 126 ms on the same runners; only the Node 24 leg reached the 120 s
// timeout, so it was the same work at about twice the runner variance, not a hang. WebKit could not be run where this was
// written, so its scaling is unmeasured and its case is 10 000, with a longer clock backstop. Each case prints one
// `console.info` line (texts, build and undo ms) so the next CI log splits WebKit's time. The counts do not depend on size.
import { afterAll, expect, it } from 'vitest';
import { closeBrowsers, describeBrowsers, openDoc, type BrowserName } from './harness.js';

afterAll(closeBrowsers);

/** The separators of the large case per engine, and the clock backstop for the build and for the undo, in ms. */
const LARGE: Record<BrowserName, { k: number; backstopMs: number }> = {
  chromium: { k: 32000, backstopMs: 20000 },
  webkit: { k: 10000, backstopMs: 60000 },
};
/** The separators of the case whose text is cut into FRAGMENTS nodes first. */
const FRAGMENT_K = 4000;
const FRAGMENTS = 5;

function markdown(k: number): string {
  return `# T\n\n**Spec** · ${Array.from({ length: k }, (_, i) => `w${String(i)}`).join(' · ')}\n\n## Body\n\nText.\n`;
}

async function measure(name: BrowserName, k: number, fragments: number) {
  const doc = await openDoc(markdown(k), {}, { browser: name, enhance: false });
  try {
    return await doc.page.evaluate(
      async (cut: number) => {
        const api = window.__docreaderHarness;
        if (api === undefined) throw new Error('no harness');
        const byline = Array.from(api.root.querySelectorAll('p')).find((p) => (p.textContent ?? '').includes(' · '));
        if (byline === undefined) throw new Error('no byline paragraph');
        if (cut > 1) {
          // Cut the one text into `cut` nodes, each cut at the start of a separator so none is split across two nodes.
          const text = Array.from(byline.childNodes).find((n): n is Text => n.nodeType === 3);
          if (text === undefined) throw new Error('no text in the byline paragraph');
          const data = text.data;
          const offsets: number[] = [];
          for (let i = 1; i < cut; i += 1) offsets.push(data.indexOf(' · ', Math.floor((data.length * i) / cut)));
          for (const o of offsets.reverse()) text.splitText(o);
        }
        const texts = Array.from(byline.childNodes).filter((n) => n.nodeType === 3).length;
        const calls: Record<string, number> = { splitText: 0, appendData: 0, removeChild: 0, createRange: 0 };
        const targets: [string, object][] = [
          ['splitText', Text.prototype],
          ['appendData', CharacterData.prototype],
          ['removeChild', Node.prototype],
          ['createRange', Document.prototype],
        ];
        const originals = targets.map(([key, proto]) => {
          const record = proto as Record<string, (...a: unknown[]) => unknown>;
          const original = record[key] as (...a: unknown[]) => unknown;
          record[key] = function (this: unknown, ...a: unknown[]): unknown {
            calls[key] = (calls[key] ?? 0) + 1;
            return original.apply(this, a);
          };
          return () => {
            record[key] = original;
          };
        });
        // Writes to a large live parent (review 3088 F3, WebKit cycle 2): a call of insertBefore, appendChild, removeChild,
        // replaceChild, splitText or a range's deleteContents on a connected parent of more than 64 children, or that takes a
        // node out of one. A structural count: WebKit is quadratic in such writes, in the build and in the undo.
        let largeWrites = 0;
        const isLarge = (p: Node | null): boolean => p !== null && p.isConnected && p.childNodes.length > 64;
        const leaves = (a: unknown[]): Node | null => (a[0] as Node | null | undefined)?.parentNode ?? null;
        const guards: [object, string, (self: Node, a: unknown[]) => (Node | null)[]][] = [
          [Node.prototype, 'insertBefore', (self, a) => [self, leaves(a)]],
          [Node.prototype, 'appendChild', (self, a) => [self, leaves(a)]],
          [Node.prototype, 'removeChild', (self) => [self]],
          [Node.prototype, 'replaceChild', (self, a) => [self, leaves(a)]],
          [Text.prototype, 'splitText', (self) => [self.parentNode]],
          [Range.prototype, 'deleteContents', (self) => [(self as unknown as Range).commonAncestorContainer]],
        ];
        const guardRestores = guards.map(([proto, key, parentsOf]) => {
          const record = proto as Record<string, (...a: unknown[]) => unknown>;
          const original = record[key] as (...a: unknown[]) => unknown;
          record[key] = function (this: unknown, ...a: unknown[]): unknown {
            if (parentsOf(this as Node, a).some(isLarge)) largeWrites += 1;
            return original.apply(this, a);
          };
          return () => {
            record[key] = original;
          };
        });
        const before = api.root.innerHTML;
        const t0 = performance.now();
        const outcome = await api.enhance();
        const enhanceMs = performance.now() - t0;
        const enhanced = { ...calls };
        const largeBuild = largeWrites;
        largeWrites = 0;
        const facts = api.root.querySelectorAll('dl.byline > div').length;
        for (const key of Object.keys(calls)) calls[key] = 0;
        const t1 = performance.now();
        await api.destroy();
        const destroyMs = performance.now() - t1;
        const undone = { ...calls };
        const largeUndo = largeWrites;
        for (const restore of [...originals, ...guardRestores]) restore();
        return { texts, outcome, enhanced, undone, facts, restored: api.root.innerHTML === before, enhanceMs, destroyMs, largeBuild, largeUndo };
      },
      fragments,
    );
  } finally {
    await doc.close();
  }
}

function expectBounded(out: Awaited<ReturnType<typeof measure>>, k: number, backstopMs: number): void {
  expect(out.outcome).toEqual({ ok: true });
  // One item per separator and one for the Spec; a separator an engine's own cut falls inside is not one (one item per cut).
  expect(out.facts).toBeGreaterThanOrEqual(k - out.texts);
  expect(out.enhanced['splitText']).toBeLessThanOrEqual(4);
  expect(out.undone['appendData']).toBeLessThanOrEqual(4);
  expect(out.undone['removeChild']).toBeLessThanOrEqual(40);
  // One range deletion per text child of the paragraph, however many separators: a count that follows the nodes, not k.
  expect(out.undone['createRange']).toBeGreaterThanOrEqual(1);
  expect(out.undone['createRange']).toBeLessThanOrEqual(out.texts);
  expect(out.restored).toBe(true);
  // The meta paragraph is cut and gathered off the document, so no write touches a large live parent, to build or to undo:
  // a count that is a constant (measured 0), not k. WebKit's time was quadratic in exactly these writes (CI, WebKit cycle 2).
  expect(out.largeBuild, 'writes to a large live parent while building').toBeLessThanOrEqual(4);
  expect(out.largeUndo, 'writes to a large live parent while undoing').toBeLessThanOrEqual(4);
  // A backstop, not the bound: the old loop took many seconds here.
  expect(out.enhanceMs).toBeLessThan(backstopMs);
  expect(out.destroyMs).toBeLessThan(backstopMs);
}

describeBrowsers((name: BrowserName) => {
  const { k, backstopMs } = LARGE[name];
  it(`${name}: ${String(k)} separators are cut and joined with a bounded count of DOM operations, and destroy restores the html`, async () => {
    const out = await measure(name, k, 1);
    console.info(`byline-many ${name} k=${String(k)} fragments=1: texts=${String(out.texts)} enhanceMs=${out.enhanceMs.toFixed(0)} destroyMs=${out.destroyMs.toFixed(0)}`);
    // WebKit only: the case is over its 65 536-unit text-node limit, so the paragraph is at least two nodes there. A red here
    // disproves the diagnosis of the five ranges (the limit is read from WebKit's source, not run).
    if (name === 'webkit') expect(out.texts).toBeGreaterThanOrEqual(2);
    expectBounded(out, k, backstopMs);
  }, 120000);

  it(`${name}: a byline text of ${String(FRAGMENTS)} nodes is undone with one range per node, and destroy restores the html`, async () => {
    const out = await measure(name, FRAGMENT_K, FRAGMENTS);
    console.info(`byline-many ${name} k=${String(FRAGMENT_K)} fragments=${String(FRAGMENTS)}: texts=${String(out.texts)} enhanceMs=${out.enhanceMs.toFixed(0)} destroyMs=${out.destroyMs.toFixed(0)}`);
    expect(out.texts).toBeGreaterThanOrEqual(FRAGMENTS);
    expectBounded(out, FRAGMENT_K, backstopMs);
    // Every node had separators, so every node was joined by a range of its own: the count is the nodes, here, exactly.
    expect(out.undone['createRange']).toBe(out.texts);
  }, 120000);
});
