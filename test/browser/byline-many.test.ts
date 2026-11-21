// A byline of 32 000 separators in a real browser (review 3088 F3). The screen used to cut the meta line's text with two
// `journal.split`s per separator and to undo each with an `appendData` (quadratic: 32 000 took seconds, 64 000 minutes). One
// `journal.splitAll` per text child cuts at every separator and undoes with one write and one range deletion. The bound is a
// count of DOM operations in the page, never a clock: `splitText` and `appendData` are not called at all, `removeChild`
// only for the handful of chrome nodes, and destroy restores the root's html exactly. jsdom is quadratic in a parent's
// children, so the 32 000 case lives here and test/enhance-editorial.test.ts holds the same counts at 500.
import { afterAll, expect, it } from 'vitest';
import { closeBrowsers, describeBrowsers, openDoc, type BrowserName } from './harness.js';

afterAll(closeBrowsers);

const K = 32000;
const MD = `# T\n\n**Spec** · ${Array.from({ length: K }, (_, i) => `w${String(i)}`).join(' · ')}\n\n## Body\n\nText.\n`;

describeBrowsers((name: BrowserName) => {
  it(`${name}: ${String(K)} separators are cut and joined with a bounded count of DOM operations, and destroy restores the html`, async () => {
    const doc = await openDoc(MD, {}, { browser: name, enhance: false });
    try {
      const out = await doc.page.evaluate(async () => {
        const api = window.__docreaderHarness;
        if (api === undefined) throw new Error('no harness');
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
        const before = api.root.innerHTML;
        const t0 = performance.now();
        const outcome = await api.enhance();
        const enhanceMs = performance.now() - t0;
        const enhanced = { ...calls };
        const facts = api.root.querySelectorAll('dl.byline > div').length;
        for (const key of Object.keys(calls)) calls[key] = 0;
        const t1 = performance.now();
        await api.destroy();
        const destroyMs = performance.now() - t1;
        const undone = { ...calls };
        for (const restore of originals) restore();
        return { outcome, enhanced, undone, facts, restored: api.root.innerHTML === before, enhanceMs, destroyMs };
      });
      expect(out.outcome).toEqual({ ok: true });
      expect(out.facts).toBeGreaterThanOrEqual(K);
      expect(out.enhanced['splitText']).toBeLessThanOrEqual(4);
      expect(out.undone['appendData']).toBeLessThanOrEqual(4);
      expect(out.undone['removeChild']).toBeLessThanOrEqual(40);
      expect(out.undone['createRange']).toBeGreaterThanOrEqual(1);
      expect(out.undone['createRange']).toBeLessThanOrEqual(4);
      expect(out.restored).toBe(true);
      // A backstop, not the bound: the old loop took many seconds here.
      expect(out.enhanceMs).toBeLessThan(20000);
      expect(out.destroyMs).toBeLessThan(20000);
    } finally {
      await doc.close();
    }
  }, 120000);
});
