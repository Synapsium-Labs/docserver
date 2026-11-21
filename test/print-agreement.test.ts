// @vitest-environment jsdom
// Print mode agrees with the screen (docserver parity, Task 7): for every corpus document, and for the print fixtures, the
// strip, the marks, the labels and the numbers that render(..., { print: true }) writes equal, by text and class, what the
// enhance step builds on the same document in jsdom. A disagreement is fixed in the transform, never by moving a golden.
// The screen's two departures are the ones print makes on purpose and the test states: a waiting item is clipped to WAIT_CLIP
// on the screen and whole on paper (the screen's text is the clip of print's), and a link or a hidden piece has no print.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { destroyEnhancement, enhance } from '../src/enhance/index.js';
import { findSeparator as screenSeparator } from '../src/enhance/separator.js';
import { WAIT_CLIP } from '../src/enhance/strip.js';
import { clip } from '../src/enhance/text.js';
import { render } from '../src/render/index.js';
import { PLAN_FACT_MIN_STEPS } from '../src/render/print/strip.js';
import { findSeparator } from '../src/render/separator.js';

const ROOT = process.cwd();
const read = (rel: string): string => readFileSync(path.join(ROOT, rel), 'utf8');

const mounted: HTMLElement[] = [];
afterEach(async () => {
  for (const root of mounted.splice(0)) await destroyEnhancement(root).catch(() => undefined);
  document.body.replaceChildren();
});

/** The html in a root element of this document. */
function mountHtml(html: string): HTMLElement {
  const parsed = new DOMParser().parseFromString(`<!doctype html><body>${html}`, 'text/html');
  const root = document.createElement('main');
  root.append(...Array.from(parsed.body.childNodes).map((n) => document.importNode(n, true)));
  document.body.append(root);
  mounted.push(root);
  return root;
}

const sq = (s: string | null | undefined): string => (s ?? '').replace(/\s+/g, ' ').trim();
/** The classes of an element, sorted; `loose` (a step whose item holds blocks) is the screen's layout hook, which print has no use for. */
const cls = (e: Element): string => Array.from(e.classList).filter((c) => c !== 'loose').sort().join(' ');

/** A node's content as the blocks agree on it: a text node is its text, an element its classes and text. */
function piece(n: Node): string | [string, string] {
  return n.nodeType === 3 ? sq(n.textContent) : [cls(n as Element), sq(n.textContent)];
}

const own = (root: Element, sel: string): Element[] => Array.from(root.querySelectorAll(sel));

/** What the two sides must agree on, read from a root with the selectors both use. */
function blocks(root: Element): Record<string, unknown> {
  const strip = root.querySelector('section.review-strip');
  const waiting = own(strip ?? root, 'div.rs-wait > ol > li').map((li) => sq(li.textContent));
  const waitLabel = sq(strip?.querySelector('div.rs-wait > p.rs-label')?.textContent);
  const facts = own(strip ?? root, 'p.rs-facts > *').map((e) => (e.classList.contains('sep') ? ['sep', sq(e.textContent)] : [cls(e), sq(e.childNodes[0]?.textContent), own(e, ':scope > span.cnt').map((c) => [cls(c), sq(c.textContent)])]));
  return {
    eyebrow: own(root, 'div.eyebrow > span').map((s) => sq(s.textContent)),
    byline: own(root, 'dl.byline').map((d) => [cls(d), own(d, ':scope > div').map((f) => [cls(f), sq(f.querySelector('dt')?.textContent), sq(f.querySelector('dd')?.textContent)])]),
    stripPlaced: strip !== null,
    waitLabel,
    waiting,
    facts,
    secNo: own(root, 'h2 > span.sec-no').map((s) => [(s.parentElement as Element).id, sq(s.textContent)]),
    boxes: own(root, 'div.short, div.callout').map((b) => [cls(b), (b.querySelector('h2, h3') as Element | null)?.id ?? '']),
    pills: own(root, 'td span.pill, th span.pill').map((p) => [cls(p), sq(p.textContent)]),
    pillWraps: own(root, 'span.pill-wrap').map((p) => sq(p.textContent)),
    tasks: own(root, 'span.task-id').map((t) => [(t.parentElement as Element).id, Array.from(t.childNodes).map(piece)]),
    taskHeads: own(root, 'h2.task, h3.task').map((h) => h.id),
    steps: own(root, 'span.step-no').map((s) => [Array.from(s.childNodes).map(piece), cls(s.closest('li') as Element)]),
    rules: own(root, 'p.rule').map((p) => [own(p, ':scope > span.rule-head > code').map((c) => sq(c.textContent)), own(p, ':scope > span.rule-head > span.pill').map((c) => [cls(c), sq(c.textContent)])]),
    factPanel: own(root, 'details.doc-facts').map((d) => [
      Array.from(d.querySelector('summary')?.childNodes ?? []).map(piece),
      own(d, 'div.facts-body > dl > dt').map((dt) => [sq(dt.textContent), sq(dt.nextElementSibling?.textContent)]),
      own(d, 'div.facts-body > ol > li').map((li) => [sq(li.querySelector('.rid')?.textContent), sq(li.querySelector('.rtitle')?.textContent), (li.lastElementChild as Element | null) === null ? '' : [cls(li.lastElementChild as Element), sq(li.lastElementChild?.textContent)]]),
    ]),
  };
}

/** The screen's blocks for `md`, enhanced with rules on, and print's, both with rules on. */
async function both(md: string): Promise<{ screen: Record<string, unknown>; print: Record<string, unknown> }> {
  const r = render(md);
  const root = mountHtml(r.html);
  await enhance(root, { rules: true, info: { title: r.meta.title, frontList: r.meta.frontList } });
  const printed = render(md, { print: true, reader: { rules: true } }).html;
  const proot = mountHtml(printed);
  return { screen: blocks(root), print: blocks(proot) };
}

/** Print's list for a key, with each waiting item as the screen clips it. */
function clipped(b: Record<string, unknown>): Record<string, unknown> {
  return { ...b, waiting: (b['waiting'] as string[]).map((w) => clip(w, WAIT_CLIP)) };
}

/** Every corpus case that has a file as its input. */
function corpusInputs(): { id: string; md: string }[] {
  const manifest = JSON.parse(read('conformance/manifest.json')) as { id: string }[];
  const out: { id: string; md: string }[] = [];
  for (const m of manifest) {
    const file = path.join(ROOT, 'conformance/corpus', `${m.id}.md`);
    if (existsSync(file)) out.push({ id: m.id, md: readFileSync(file, 'utf8') });
  }
  return out;
}

/** The plan fixture with exactly `n` steps over three tasks. */
function planWith(n: number): string {
  const lines = [
    '# Boundary plan', '', '**Plan** · 2026-11-20 · Status: Draft', '', '## 1. One', '', 'Text.', '', '## 2. Two', '', 'Text.', '', '## 3. Three', '',
  ];
  let left = n;
  for (let t = 1; t <= 3; t += 1) {
    lines.push(`### Task ${String(t)}: Part`, '');
    const here = t === 3 ? left : Math.ceil(left / (4 - t));
    for (let s = 1; s <= here; s += 1) lines.push(`- [ ] **Step ${String(s)}${s % 3 === 0 ? ' (you)' : ''}:** do it`);
    left -= here;
    lines.push('');
  }
  return lines.join('\n');
}

describe('print mode agrees with the screen', () => {
  const inputs = corpusInputs();

  it('has the corpus documents to read', () => {
    expect(inputs.length).toBeGreaterThan(30);
  });

  for (const { id, md } of inputs) {
    it(`corpus ${id}: the strip, marks, labels and numbers are the screen's`, async () => {
      const { screen, print } = await both(md);
      expect(clipped(print)).toEqual(screen);
    });
  }

  for (const name of ['plan', 'title', 'boxes', 'status', 'rules', 'alerts', 'blocks']) {
    it(`print fixture ${name}: the same`, async () => {
      const { screen, print } = await both(read(`conformance/print/${name}.md`));
      expect(clipped(print)).toEqual(screen);
    });
  }

  it('the fixtures exercise what they claim (not agreement of two empties)', async () => {
    const plan = (await both(read('conformance/print/plan.md'))).print;
    expect((plan['facts'] as unknown[]).length).toBe(3);
    expect(plan['waiting']).toHaveLength(3);
    expect((plan['tasks'] as unknown[]).length).toBe(3);
    expect((plan['steps'] as unknown[]).length).toBe(21);
    const rules = (await both(read('conformance/print/rules.md'))).print;
    expect((rules['rules'] as unknown[]).length).toBeGreaterThan(2);
    expect((rules['factPanel'] as unknown[]).length).toBe(1);
    const title = (await both(read('conformance/print/title.md'))).print;
    expect((title['byline'] as unknown[]).length).toBe(1);
    expect((title['eyebrow'] as unknown[]).length).toBeGreaterThan(1);
    const status = (await both(read('conformance/print/status.md'))).print;
    expect((status['pills'] as unknown[]).length).toBeGreaterThan(4);
    const boxes = (await both(read('conformance/print/boxes.md'))).print;
    expect((boxes['secNo'] as unknown[]).length).toBe(3);
  });

  it('the plan fact has the screen\'s gate: none at 19 steps on either side, both at 20 (ccrc D-8868)', async () => {
    const at = async (n: number): Promise<{ screen: number; print: number }> => {
      const { screen, print } = await both(planWith(n));
      const has = (b: Record<string, unknown>): number => (b['facts'] as unknown[][]).filter((f) => f[0] === 'fact' && /steps$/.test(String(f[1]))).length;
      expect(clipped(print)).toEqual(screen);
      return { screen: has(screen), print: has(print) };
    };
    expect(PLAN_FACT_MIN_STEPS).toBe(20);
    expect(await at(19)).toEqual({ screen: 0, print: 0 });
    // The marks of a plan have no gate of their own on the screen, so a plan of any length prints them: at 19 steps all three
    // task chips and all nineteen step labels are there, on both sides (the equality above) and not by accident of the gate.
    const short = (await both(planWith(19))).print;
    expect((short['tasks'] as unknown[]).length).toBe(3);
    expect((short['steps'] as unknown[]).length).toBe(19);
    expect(await at(20)).toEqual({ screen: 1, print: 1 });
    expect(await at(21)).toEqual({ screen: 1, print: 1 });
  });
});

describe('the byline separator scan (review 3081 F1)', () => {
  const MARK = '// --- twin: byte-equal from here on\n';
  const tail = (rel: string): string => {
    const text = read(rel);
    const at = text.indexOf(MARK);
    expect(at, rel).toBeGreaterThan(0);
    return text.slice(at + MARK.length);
  };

  it('the render and the reader keep twin copies, byte-equal from the marker line on', () => {
    expect(tail('src/enhance/separator.ts')).toBe(tail('src/render/separator.ts'));
  });

  it('finds what the pattern it replaced finds: the same start and the same length, whole runs of white space included', () => {
    const SEP = /\s+·\s+/;
    // Every string of up to six of these (a dot, ASCII and Unicode white space, the zero-width space, which is no white space, a letter, a colon).
    const alphabet = ['·', ' ', '\t', '\u00a0', '\u2028', '\ufeff', '\u200b', 'a', ':'];
    let checked = 0;
    const walk = (prefix: string, depth: number): void => {
      const m = SEP.exec(prefix);
      const want = m === null ? null : { index: m.index, length: m[0].length };
      expect(findSeparator(prefix), JSON.stringify(prefix)).toEqual(want);
      expect(screenSeparator(prefix), JSON.stringify(prefix)).toEqual(want);
      checked += 1;
      if (depth === 0) return;
      for (const c of alphabet) walk(prefix + c, depth - 1);
    };
    walk('', 6);
    expect(checked).toBe(Array.from({ length: 7 }, (_c, i) => 9 ** i).reduce((a, b) => a + b, 0));
  });

  it('reads white space as the pattern class does, over every UTF-16 code unit', () => {
    const differ: string[] = [];
    for (let c = 0; c < 0x10000; c += 1) {
      const ch = String.fromCharCode(c);
      if ((findSeparator(`a${ch}·${ch}b`) !== null) !== /\s/.test(ch)) differ.push(c.toString(16));
    }
    expect(differ).toEqual([]);
  });
});
