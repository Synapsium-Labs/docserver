// What a live Range, the document Selection and a MutationObserver see across the screen byline's off-document build and its
// undo, in a real browser (landing A's review, recorded as cosmetic; readiness Task 6). The build takes the meta paragraph out of
// its parent into a fragment, cuts and gathers it there, and puts it back (two journaled moves); destroy undoes them in reverse
// (out again, the cut joined, back). So a boundary inside the paragraph leaves it when it is taken out, and a childList
// observer on the parent sees the paragraph removed and added back, in the build and again in the undo.
//
// Only what the DOM standard defines is asserted, because WebKit runs in CI and cannot run where this was written:
//  - a live range whose boundary node is removed has that boundary moved to (the removed node's parent, its index), so a range
//    with both boundaries inside the paragraph is collapsed in the parent, outside the paragraph, and stays collapsed there;
//  - a childList observer with `subtree` on the parent records the paragraph's removal and its insertion, in that order, each
//    exactly once per phase (a count, never a timing);
//  - the library's own invariants: nothing throws, the paragraph's text content and the root's html are what they were.
// The asserted range is never added to the Selection (a second range with the same boundaries is); the engine's treatment of a
// selection cannot reach the range rows.
// What an engine decides for itself is printed and not asserted: the document Selection (whether it keeps a range over hidden
// content, and where), the transient records of the changes made inside the paragraph while it is off the document, and the
// records of the other chrome's moves. One `byline-live` line per phase carries them, per case.
import { afterAll, expect, it } from 'vitest';
import { closeBrowsers, describeBrowsers, openDoc, type BrowserName } from './harness.js';

afterAll(closeBrowsers);

/** The cases: a byline of the size real documents have, and a large one in a few text nodes. */
const CASES: readonly { readonly label: string; readonly k: number; readonly fragments: number }[] = [
  { label: 'tens', k: 40, fragments: 1 },
  { label: 'large', k: 4000, fragments: 5 },
];

function markdown(k: number): string {
  return `# T\n\n**Spec** · ${Array.from({ length: k }, (_, i) => `w${String(i)}`).join(' · ')}\n\n## Body\n\nText.\n`;
}

interface Where {
  readonly container: string;
  readonly offset: number;
  readonly inParagraph: boolean;
  readonly inParent: boolean;
}
interface RangeView {
  readonly start: Where;
  readonly end: Where;
  readonly collapsed: boolean;
  readonly text: string;
}
interface SelectionView {
  readonly rangeCount: number;
  readonly anchor: Where | null;
  readonly focus: Where | null;
  readonly text: string;
}
interface Phase {
  readonly range: RangeView;
  readonly selection: SelectionView;
  /** Records by type, and what they say of the paragraph. */
  readonly records: number;
  readonly byType: Record<string, number>;
  readonly removedParagraph: number;
  readonly addedParagraph: number;
  /** Index, among this phase's records, of the paragraph's first removal and first insertion (-1 for none). */
  readonly removedAt: number;
  readonly addedAt: number;
  /** Records whose target is the paragraph or a node inside it (transient observers; the engine's own timing). */
  readonly insideParagraph: number;
  /** The parent's own childList records, as "removed:..|added:.." lists of node names. */
  readonly parentRecords: string[];
}
interface Live {
  readonly outcome: unknown;
  readonly texts: number;
  readonly startText: string;
  readonly beforeHtml: string;
  readonly beforeParagraphText: string;
  readonly paragraphKept: boolean;
  readonly paragraphTextAfter: string;
  readonly htmlRestored: boolean;
  readonly before: { readonly range: RangeView; readonly selection: SelectionView };
  readonly enhance: Phase;
  readonly destroy: Phase;
}

async function measureLive(name: BrowserName, k: number, fragments: number): Promise<Live> {
  const doc = await openDoc(markdown(k), {}, { browser: name, enhance: false });
  try {
    return await doc.page.evaluate(
      async (cut: number): Promise<Live> => {
        const api = window.__docreaderHarness;
        if (api === undefined) throw new Error('no harness');
        const p = Array.from(api.root.querySelectorAll('p')).find((q) => (q.textContent ?? '').includes(' · '));
        if (p === undefined) throw new Error('no byline paragraph');
        const parent = p.parentNode as Node;
        if (cut > 1) {
          const text = Array.from(p.childNodes).find((n): n is Text => n.nodeType === 3);
          if (text === undefined) throw new Error('no text in the byline paragraph');
          const data = text.data;
          const offsets: number[] = [];
          for (let i = 1; i < cut; i += 1) offsets.push(data.indexOf(' · ', Math.floor((data.length * i) / cut)));
          for (const o of offsets.reverse()) text.splitText(o);
        }
        const texts = Array.from(p.childNodes).filter((n) => n.nodeType === 3).length;
        const strong = p.firstChild as Node;
        const last = p.lastChild as Node;
        if (strong.firstChild === null || last.nodeType !== 3) throw new Error('the paragraph is not a strong and then text');
        const startText = (strong.firstChild as Text).data;
        const beforeParagraphText = p.textContent ?? '';
        const beforeHtml = api.root.innerHTML;

        // (a) a live range from inside the bold text to inside the last text node, never given to the Selection: it is the one
        // whose boundaries are asserted, so what an engine does to a selection's own range cannot reach the assertions. (b) A
        // second range with the same boundaries, which is the Selection's; the Selection is only printed.
        const endAt = Math.max(1, (last as Text).data.length - 2);
        const range = document.createRange();
        range.setStart(strong.firstChild, 1);
        range.setEnd(last, endAt);
        const picked = document.createRange();
        picked.setStart(strong.firstChild, 1);
        picked.setEnd(last, endAt);
        const selection = window.getSelection();
        if (selection === null) throw new Error('no selection');
        selection.removeAllRanges();
        selection.addRange(picked);

        const nodeName = (n: Node | null): string => (n === null ? 'null' : n.nodeName.toLowerCase());
        const where = (n: Node | null, offset: number): Where => ({
          container: nodeName(n),
          offset,
          inParagraph: n !== null && p.contains(n),
          inParent: n === parent,
        });
        const rangeView = (r: Range): RangeView => ({
          start: where(r.startContainer, r.startOffset),
          end: where(r.endContainer, r.endOffset),
          collapsed: r.collapsed,
          text: r.toString().slice(0, 40),
        });
        const selectionView = (s: Selection): SelectionView => ({
          rangeCount: s.rangeCount,
          anchor: s.anchorNode === null ? null : where(s.anchorNode, s.anchorOffset),
          focus: s.focusNode === null ? null : where(s.focusNode, s.focusOffset),
          text: s.toString().slice(0, 40),
        });

        // (c) the observer on the paragraph's parent. Records reach the callback in a microtask; takeRecords at the end of a
        // phase collects what has not been delivered, and the phase holds both, in order.
        let current: MutationRecord[] = [];
        const observer = new MutationObserver((records) => {
          current.push(...records);
        });
        observer.observe(parent, { childList: true, subtree: true, characterData: true });
        const phaseOf = (): Pick<
          Phase,
          'records' | 'byType' | 'removedParagraph' | 'addedParagraph' | 'removedAt' | 'addedAt' | 'insideParagraph' | 'parentRecords'
        > => {
          current.push(...observer.takeRecords());
          const records = current;
          current = [];
          const byType: Record<string, number> = {};
          for (const r of records) byType[r.type] = (byType[r.type] ?? 0) + 1;
          const removed = (r: MutationRecord): boolean => Array.from(r.removedNodes).includes(p);
          const added = (r: MutationRecord): boolean => Array.from(r.addedNodes).includes(p);
          return {
            records: records.length,
            byType,
            removedParagraph: records.filter(removed).length,
            addedParagraph: records.filter(added).length,
            removedAt: records.findIndex(removed),
            addedAt: records.findIndex(added),
            insideParagraph: records.filter((r) => p.contains(r.target)).length,
            parentRecords: records
              .filter((r) => r.target === parent && r.type === 'childList')
              .map((r) => `removed:${Array.from(r.removedNodes).map(nodeName).join(',')}|added:${Array.from(r.addedNodes).map(nodeName).join(',')}`),
          };
        };

        const before = { range: rangeView(range), selection: selectionView(selection) };
        const outcome = await api.enhance();
        const enhance = { range: rangeView(range), selection: selectionView(selection), ...phaseOf() };
        const paragraphKept = parent.contains(p);
        await api.destroy();
        const destroy = { range: rangeView(range), selection: selectionView(selection), ...phaseOf() };
        observer.disconnect();
        return {
          outcome,
          texts,
          startText,
          beforeHtml,
          beforeParagraphText,
          paragraphKept,
          paragraphTextAfter: p.textContent ?? '',
          htmlRestored: api.root.innerHTML === beforeHtml,
          before,
          enhance,
          destroy,
        };
      },
      fragments,
    );
  } finally {
    await doc.close();
  }
}

const show = (w: Where | null): string => (w === null ? 'none' : `${w.container}@${String(w.offset)}${w.inParagraph ? ' in-p' : ''}${w.inParent ? ' in-parent' : ''}`);

function line(name: BrowserName, label: string, k: number, fragments: number, phase: string, v: { range: RangeView; selection: SelectionView }, rec: Phase | null): string {
  const r = v.range;
  const s = v.selection;
  const head = `byline-live ${name} ${label} k=${String(k)} fragments=${String(fragments)} ${phase}:`;
  const mid = ` range=${show(r.start)}..${show(r.end)} collapsed=${String(r.collapsed)} text=${JSON.stringify(r.text)}; selection ranges=${String(s.rangeCount)} anchor=${show(s.anchor)} focus=${show(s.focus)} text=${JSON.stringify(s.text)}`;
  if (rec === null) return head + mid;
  return `${head}${mid}; observer records=${String(rec.records)} types=${JSON.stringify(rec.byType)} removedParagraph=${String(rec.removedParagraph)} addedParagraph=${String(rec.addedParagraph)} insideParagraph=${String(rec.insideParagraph)} parent=${JSON.stringify(rec.parentRecords)}`;
}

describeBrowsers((name: BrowserName) => {
  for (const { label, k, fragments } of CASES) {
    it(`${name}: ${label} byline (${String(k)} separators): a live range, the selection and an observer across the off-document build and undo`, async () => {
      const out = await measureLive(name, k, fragments);
      console.info(line(name, label, k, fragments, 'before', out.before, null));
      console.info(line(name, label, k, fragments, 'enhance', out.enhance, out.enhance));
      console.info(line(name, label, k, fragments, 'destroy', out.destroy, out.destroy));

      // The library's own invariants.
      expect(out.outcome).toEqual({ ok: true });
      expect(out.texts).toBeGreaterThanOrEqual(fragments);
      expect(out.paragraphKept, 'the paragraph is back in its parent after the build').toBe(true);
      expect(out.paragraphTextAfter, 'the paragraph keeps its text after the undo').toBe(out.beforeParagraphText);
      expect(out.htmlRestored, 'destroy restores the root html').toBe(true);

      // The fixture is what it says: the range began inside the paragraph, over the text it was placed on.
      expect(out.before.range.start.inParagraph).toBe(true);
      expect(out.before.range.end.inParagraph).toBe(true);
      expect(out.before.range.collapsed).toBe(false);
      expect(out.before.range.text.startsWith(out.startText.slice(1))).toBe(true);

      // DOM standard (live ranges): taking the paragraph out moves both boundaries to the parent, at the paragraph's index. A
      // range with both boundaries inside it is therefore collapsed in the parent and outside the paragraph, with no text, and
      // neither the build's return nor the undo's gives the boundaries back.
      for (const [phase, v] of [['enhance', out.enhance.range], ['destroy', out.destroy.range]] as const) {
        expect(v.start.inParagraph, `${phase}: the range start is outside the paragraph`).toBe(false);
        expect(v.end.inParagraph, `${phase}: the range end is outside the paragraph`).toBe(false);
        expect(v.start.inParent, `${phase}: the range start is in the paragraph's parent`).toBe(true);
        expect(v.end.inParent, `${phase}: the range end is in the paragraph's parent`).toBe(true);
        expect(v.collapsed, `${phase}: the range is collapsed`).toBe(true);
        expect(v.text, `${phase}: the range holds no text`).toBe('');
      }

      // DOM standard (MutationObserver): the paragraph's removal and its insertion are each one childList record of the
      // parent, the removal first, in the build and again in the undo. A count and an order, never a time.
      for (const [phase, rec] of [['enhance', out.enhance], ['destroy', out.destroy]] as const) {
        expect(rec.removedParagraph, `${phase}: the paragraph is removed once`).toBe(1);
        expect(rec.addedParagraph, `${phase}: the paragraph is inserted once`).toBe(1);
        expect(rec.removedAt, `${phase}: removed before inserted`).toBeLessThan(rec.addedAt);
        expect(rec.removedAt).toBeGreaterThanOrEqual(0);
      }

      // Not asserted: the Selection (what an engine keeps of a selection over content that leaves, and over hidden content),
      // and the records of the changes inside the paragraph while it is off the document. Printed above.
    }, 120000);
  }
});
