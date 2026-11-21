// @vitest-environment jsdom
// Print mode of render() (docserver parity, Task 7; the first consumer's design, section 6): the pinned output of the section 6
// fixture and of one fixture per block group, one assertion per block on elements and classes as well as text, the options'
// checks held to the reader's own, and the patterns held to the reader's vocabulary. The agreement with the screen is
// test/print-agreement.test.ts; the vocabulary file, the stylesheet and the hostile cases are test/print-surface.test.ts.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { normalizeOptions } from '../src/enhance/options.js';
import { WAIT_CLIP } from '../src/enhance/strip.js';
import { compileVocab, defaultVocabulary, mergeVocabulary } from '../src/enhance/vocab.js';
import { render } from '../src/render/index.js';
import { PLAN_FACT_MIN_STEPS } from '../src/render/print/strip.js';
import { printVocab } from '../src/render/print/vocab.js';
import { checkReader } from '../src/render/reader.js';
import type { ReaderVocabulary } from '../src/render/types.js';
import { pinned } from './print-vocabulary.js';

const ROOT = process.cwd();
const read = (rel: string): string => readFileSync(path.join(ROOT, rel), 'utf8');
const NAMES = ['plan', 'title', 'boxes', 'status', 'rules', 'alerts', 'blocks'] as const;
const PRINT = { print: true, reader: { rules: true } } as const;

const dom = (html: string): Document => new DOMParser().parseFromString(`<!doctype html><body>${html}`, 'text/html');
const q = (d: ParentNode, sel: string): Element[] => Array.from(d.querySelectorAll(sel));
const sq = (s: string | null | undefined): string => (s ?? '').replace(/\s+/g, ' ').trim();
const printed = (name: string, reader: ReaderVocabulary = PRINT.reader): Document => dom(render(read(`conformance/print/${name}.md`), { print: true, reader }).html);

describe('the pinned output', () => {
  for (const n of NAMES) {
    it(`${n}: render(…, { print: true, reader: { rules: true } }) is conformance/print/${n}.html`, () => {
      const r = render(read(`conformance/print/${n}.md`), PRINT);
      expect(r.outcome).toBe('rendered');
      expect(pinned(r.html)).toBe(read(`conformance/print/${n}.html`));
    });
  }

  it('is one div.docreader-print around the whole document', () => {
    for (const n of NAMES) {
      const body = printed(n).body;
      expect(Array.from(body.children).map((c) => `${c.localName}.${c.className}`)).toEqual(['div.docreader-print']);
    }
  });

  it('without print the html is what it was, byte for byte, and the meta is the same', () => {
    for (const n of NAMES) {
      const md = read(`conformance/print/${n}.md`);
      expect(render(md, { print: false })).toEqual(render(md));
      expect(render(md, { reader: { rules: true } }).html).toBe(render(md).html);
      expect(render(md, PRINT).meta).toEqual(render(md, { reader: { rules: true } }).meta);
    }
  });

  it('is bounded like the html: a print that would pass maxHtmlBytes falls back, as render does', () => {
    const md = read('conformance/print/plan.md');
    const plain = render(md).html.length;
    const r = render(md, { ...PRINT, maxHtmlBytes: plain + 10 });
    expect(r.outcome).toBe('output-over-limit');
    expect(render(md, { ...PRINT, maxHtmlBytes: 1_000_000 }).outcome).toBe('rendered');
  });
});

describe('section 6 fixture: a plan of three tasks, the reader as an owner, a Waiting box and a decisions table', () => {
  const d = printed('plan');

  it('the review strip follows the byline, before the first section, and is a section.review-strip', () => {
    const strip = q(d, 'section.review-strip');
    expect(strip).toHaveLength(1);
    expect((strip[0] as Element).previousElementSibling?.matches('dl.byline')).toBe(true);
  });

  it('the waiting list is div.rs-wait > ol > li, three of them, with its label in p.rs-label', () => {
    expect(q(d, 'section.review-strip > div.rs-wait > ol > li')).toHaveLength(3);
    expect(q(d, 'div.rs-wait > p.rs-label').map((e) => sq(e.textContent))).toEqual(['Waiting on you · 3']);
    expect(q(d, 'div.rs-wait .dot')).toHaveLength(0);
  });

  it(`the long item is whole (past WAIT_CLIP, ${String(WAIT_CLIP)}) and no waiting item is a link (P7a, P7b)`, () => {
    const items = q(d, 'div.rs-wait > ol > li').map((e) => sq(e.textContent));
    expect(items[2]?.length).toBeGreaterThan(WAIT_CLIP);
    expect(items[2]).toBe('Review the long item that runs well past the ninety-two character clip of the screen, so that it prints whole on paper and not cut.');
    expect(items.some((t) => t.includes('…'))).toBe(false);
    expect(q(d, 'section.review-strip a')).toHaveLength(0);
    expect(q(d, 'section.review-strip [href]')).toHaveLength(0);
  });

  it('p.rs-facts holds the decisions fact and the plan fact, joined by span.sep', () => {
    const facts = q(d, 'p.rs-facts > *').map((e) => `${e.localName}.${e.className}`);
    expect(facts).toEqual(['span.fact', 'span.sep', 'span.fact']);
    expect(sq(q(d, 'p.rs-facts > span.sep')[0]?.textContent)).toBe('·');
  });

  it('the decisions counts are span.cnt, each its number and its word, most first (P7g)', () => {
    const cnts = q(d, 'p.rs-facts > span.fact:first-child > span.cnt').map((e) => [e.className, sq(e.textContent)]);
    expect(cnts).toEqual([['cnt ok', '2 agreed'], ['cnt wait', '1 pending'], ['cnt no', '1 rejected']]);
    expect(sq(q(d, 'p.rs-facts > span.fact')[0]?.firstChild?.textContent)).toBe('4 decisions');
  });

  it(`the plan facts are "3 tasks · 21 steps" and "2 yours", the screen's words, at the screen's gate of ${String(PLAN_FACT_MIN_STEPS)} steps`, () => {
    const plan = q(d, 'p.rs-facts > span.fact')[1] as Element;
    expect(sq(plan.firstElementChild?.textContent)).toBe('3 tasks · 21 steps');
    expect(q(plan, 'span.cnt').map((e) => [e.className, sq(e.textContent)])).toEqual([['cnt wait', '2 yours']]);
  });

  it('each task heading has span.task-id with its step count and owner as span.tmeta', () => {
    const chips = q(d, 'h3.task > span.task-id').map((c) => [sq(c.firstChild?.textContent), q(c, 'span.tmeta').map((m) => [m.className, sq(m.textContent)])]);
    expect(chips).toEqual([
      ['Task 1', [['tmeta', '6 steps'], ['tmeta yours', 'you']]],
      ['Task 2', [['tmeta', '7 steps'], ['tmeta', 'the operator']]],
      ['Task 3', [['tmeta', '8 steps']]],
    ]);
    expect(q(d, 'h3.task').map((h) => sq(h.lastChild?.textContent))).toEqual(['Part 1', 'Part 2', 'Part 3']);
  });

  it('each step has span.step-no with its owner as span.who, and li.attn on the two that name the reader', () => {
    expect(q(d, 'li.task-list-item > span.step-no')).toHaveLength(21);
    const attn = q(d, 'li.attn').map((li) => [sq(li.querySelector('span.step-no')?.firstChild?.textContent), sq(li.querySelector('span.who')?.textContent)]);
    expect(attn).toEqual([['Step 2', 'you'], ['Step 5', 'you']]);
    const task1 = q(d, 'li.task-list-item').slice(0, 6).map((li) => [sq(li.querySelector('span.step-no')?.firstChild?.textContent), q(li, 'span.who').map((w) => sq(w.textContent))]);
    expect(task1).toEqual([['Step 1', []], ['Step 2', ['you']], ['Step 3', ['reviewer']], ['Step 4', []], ['Step 5', ['operator']], ['Step 6', ['reviewer']]]);
  });

  it('prints no bracket or colon of a step\'s owner (P7c)', () => {
    for (const s of q(d, 'li.task-list-item')) {
      const text = sq(s.textContent);
      expect(text).toMatch(/^[☐☑] Step \d+(?:you|reviewer|operator)? do part \d step \d+$/);
      expect(q(s, 'strong')).toHaveLength(0);
    }
    expect(sq(d.body.textContent)).not.toMatch(/Step \d+ \(/);
    expect(sq(d.body.textContent)).not.toMatch(/\((?:you|operator|reviewer)\)/);
  });

  it('prints no hidden element, every details open and a figure as its source', () => {
    expect(q(d, '[hidden]')).toHaveLength(0);
    const f = printed('title');
    for (const det of q(f, 'details')) expect(det.hasAttribute('open')).toBe(true);
  });
});

describe('the block groups', () => {
  it('alerts: every kind render emits keeps its class (gh-note, gh-tip, gh-important, gh-warning, gh-caution) and its title', () => {
    const d = printed('alerts');
    expect(q(d, 'div.gh-alert').map((a) => a.className)).toEqual(['gh-alert gh-note', 'gh-alert gh-tip', 'gh-alert gh-important', 'gh-alert gh-warning', 'gh-alert gh-caution']);
    expect(q(d, 'p.gh-alert-title').map((t) => t.textContent)).toEqual(['Note', 'Tip', 'Important', 'Warning', 'Caution']);
  });

  it('an image keeps its src, as render wrote it, with its alt and title; a link keeps its href', () => {
    const d = printed('boxes');
    const img = q(d, 'img')[0] as Element;
    expect(img.getAttribute('src')).toBe('pictures/one.png');
    expect([img.getAttribute('alt'), img.getAttribute('title')]).toEqual(['A picture', 'Title']);
    expect(q(d, 'a').map((a) => a.getAttribute('href'))).toEqual(['https://example.com/a']);
    expect(q(d, '[src]').map((e) => e.localName)).toEqual(['img']);
  });

  it('title: the eyebrow, the byline with its reading time, and the facts panel from the front matter', () => {
    const d = printed('title');
    expect(q(d, 'div.eyebrow > span').map((s) => s.textContent)).toEqual(['Spec', 'Design', 'Docs']);
    expect(q(d, 'h1')[0]?.previousElementSibling?.className).toBe('eyebrow');
    const facts = q(d, 'dl.byline > div').map((f) => [f.className, sq(f.querySelector('dt')?.textContent), sq(f.querySelector('dd')?.textContent).slice(0, 19)]);
    expect(facts).toEqual([['', 'Date', '2026-11-20'], ['', 'Status', 'Draft'], ['', 'Owner', 'project-a'], ['rt', 'Reading time', '≈ 4 min'], ['wide', '', 'A note that runs on']]);
    expect(q(d, 'h1 ~ details.doc-facts')).toHaveLength(1);
    expect(q(d, 'details.doc-facts')[0]?.hasAttribute('open')).toBe(true);
    expect(q(d, '.doc-meta, dl.doc-meta')).toHaveLength(0);
    expect(q(d, 'p').some((p) => sq(p.textContent).startsWith('Spec ·'))).toBe(false);
  });

  it('boxes: In short and Where things stand, the callouts by kind, and the section numbers', () => {
    const d = printed('boxes');
    expect(q(d, 'div.short > h2').map((h) => sq(h.textContent))).toEqual(['In short']);
    expect(q(d, 'div.callout').map((c) => c.className)).toEqual(['callout agreed', 'callout waiting', 'callout later', 'callout waiting', 'callout other']);
    expect(q(d, 'h2 > span.sec-no').map((s) => sq(s.textContent))).toEqual(['1', 'A2', '4b']);
    expect(q(d, 'h2').map((h) => sq(h.textContent))).toContain('1Scope');
    expect(q(d, 'nav')).toHaveLength(0);
  });

  it('status: a leading status word is span.pill.<role>, with its comma in span.pill-wrap, in a status column only', () => {
    const d = printed('status');
    expect(q(d, 'td > span.pill-wrap')).toHaveLength(2);
    expect(q(d, 'span.pill').map((p) => [p.className, sq(p.textContent)])).toEqual([
      ['pill ok', 'Agreed'], ['pill wait', 'Pending'], ['pill ok', 'Done here'], ['pill wait', 'Open'], ['pill wait', 'Open'],
    ]);
  });

  it('rules: paragraphs with heads and pills, and the index in the facts panel; off with rules off (P7f)', () => {
    const d = printed('rules');
    expect(q(d, 'p.rule > span.rule-head:first-child')).toHaveLength(4);
    expect(sq(q(d, 'p.rule:nth-of-type(2) > span.rule-head')[0]?.textContent)).not.toMatch(/ and |—|\(/);
    expect(q(d, 'p.rule:nth-of-type(2) > span.rule-head > *').map((e) => `${e.localName}.${e.className}`)).toEqual(['code.', 'code.', 'span.pill ok', 'span.pill info']);
    expect(q(d, 'details.doc-facts > summary > span.fs-k').map((s) => sq(s.textContent))).toEqual(['Rules index · 5 rules']);
    expect(q(d, 'details.doc-facts ol > li')).toHaveLength(5);
    const off = printed('rules', {});
    expect(q(off, 'p.rule, span.rule-head, span.fs-k, details.doc-facts ol')).toHaveLength(0);
    expect(sq(q(off, 'details.doc-facts > summary')[0]?.textContent)).toBe('5 rules · 2 tags');
    expect(sq(off.body.textContent)).toContain('AB-ONE — First rule.');
  });
});

describe('the options', () => {
  it('print must be a boolean', () => {
    for (const bad of ['yes', 1, null, {}]) expect(() => render('# T\n', { print: bad as unknown as boolean })).toThrow(TypeError);
    expect(() => render('# T\n', { print: undefined as unknown as boolean })).not.toThrow();
  });

  /** A reader shape and whether the reader's own features.vocabulary takes it; `rules` is print's own and checked here only. */
  const shapes: [string, unknown][] = [
    ['empty', {}],
    ['all lists', { status: { ok: ['done'], wait: ['pending'], no: ['no'], info: ['later'] }, statusHeaders: ['status'], rulingHeaders: ['ruling'], qualifiers: ['annex'], addressees: ['you', 'ops'], itemFields: ['Tracker'], itemHeadings: ['Delta'] }],
    ['attention', { attention: { status: ['status'], who: ['who'], question: ['question'], openAnswers: ['open'], blocking: ['blocking'], risk: ['diverge'], openStatus: ['open'] } }],
    ['plan', { plan: { task: ['Task'], step: ['Step'], who: ['Who'] } }],
    ['ids false', { ids: false }],
    ['ids prefixes', { ids: { prefixes: ['R', 'F'] }, ruleIds: { prefixes: ['AB'] } }],
    ['ids empty object', { ids: {}, ruleIds: {} }],
    ['dups dropped', { addressees: ['you', 'you'] }],
    ['a word list that is not an array', { addressees: 'you' }],
    ['a word over 64', { addressees: ['x'.repeat(65)] }],
    ['a word of 64', { addressees: ['x'.repeat(64)] }],
    ['an empty word', { addressees: [''] }],
    ['a padded word', { addressees: [' you'] }],
    ['a number word', { addressees: [1] }],
    ['201 words', { addressees: Array.from({ length: 201 }, (_, i) => `w${String(i)}`) }],
    ['200 words', { addressees: Array.from({ length: 200 }, (_, i) => `w${String(i)}`) }],
    ['status not an object', { status: ['done'] }],
    ['status unknown role', { status: { maybe: ['x'] } }],
    ['status list bad', { status: { ok: [3] } }],
    ['attention unknown key', { attention: { other: ['x'] } }],
    ['plan not an object', { plan: 'Task' }],
    ['plan bad word', { plan: { task: [''] } }],
    ['ids true', { ids: true }],
    ['ids prefixes bad', { ids: { prefixes: [''] } }],
    ['ids unknown key', { ids: { other: [] } }],
    ['ruleIds not an object', { ruleIds: false }],
    ['ruleIds unknown key', { ruleIds: { x: 1 } }],
    ['unknown key', { nope: ['x'] }],
    ['a getter', Object.defineProperty({}, 'addressees', { get: () => ['you'], enumerable: true })],
  ];

  for (const [name, shape] of shapes) {
    it(`reader ${name}: render takes it exactly when the reader's features.vocabulary does`, () => {
      const takes = (): boolean => {
        try {
          normalizeOptions({ vocabulary: shape });
          return true;
        } catch {
          return false;
        }
      };
      const mine = (): boolean => {
        try {
          checkReader(shape as ReaderVocabulary);
          render('# T\n', { reader: shape as ReaderVocabulary });
          return true;
        } catch (e) {
          if (!(e instanceof TypeError)) throw e;
          return false;
        }
      };
      expect(mine()).toBe(takes());
    });
  }

  it('reader.rules is a boolean (print\'s own flag), and a value of another type is a TypeError', () => {
    for (const bad of ['yes', 1, null, {}]) expect(() => render('# T\n', { reader: { rules: bad as unknown as boolean } })).toThrow(TypeError);
    expect(() => render('# T\n', { reader: { rules: false } })).not.toThrow();
  });

  it('a reader with a getter, a class instance or an array is refused, and a null-prototype object is taken', () => {
    class V {}
    expect(() => render('# T\n', { reader: new V() as ReaderVocabulary })).toThrow(TypeError);
    expect(() => render('# T\n', { reader: [] as unknown as ReaderVocabulary })).toThrow(TypeError);
    expect(() => render('# T\n', { reader: Object.assign(Object.create(null) as object, { addressees: ['you'] }) as ReaderVocabulary })).not.toThrow();
  });
});

describe("the patterns are the reader's own", () => {
  const sets: ReaderVocabulary[] = [
    {},
    { status: { ok: ['done', 'ok (x)'], wait: ['a.b'], no: [], info: ['later'] }, statusHeaders: ['status', 'état', 'status'], rulingHeaders: [], addressees: ['you', 'ops'], ids: false, ruleIds: { prefixes: ['AB', 'C.D'] } },
    { ids: { prefixes: ['R', 'F'] }, plan: { task: ['Task', 'Chantier'], step: ['Step'], who: ['Who', 'Owner'] }, addressees: ['vous'] },
  ];
  for (const [i, set] of sets.entries()) {
    it(`set ${String(i)}: every pattern print mode reads has the reader's source and flags`, () => {
      const theirs = compileVocab(mergeVocabulary(defaultVocabulary(), normalizeOptions({ vocabulary: set }).vocabulary));
      const mine = printVocab(checkReader(set));
      const same = (a: RegExp, b: RegExp): void => {
        expect([a.source, a.flags]).toEqual([b.source, b.flags]);
      };
      mine.status.forEach((s, k) => {
        const t = theirs.status[k] as (typeof theirs.status)[number];
        expect(s.role).toBe(t.role);
        same(s.re, t.re);
      });
      same(mine.statusHeader, theirs.statusHeader);
      same(mine.rulingHeader, theirs.rulingHeader);
      same(mine.id, theirs.id);
      same(mine.ruleId, theirs.ruleId);
      same(mine.ruleIdJoin, theirs.ruleIdJoin);
      same(mine.addressee, theirs.addressee);
      same(mine.addresseeAnywhere, theirs.addresseeAnywhere);
      same(mine.plan.task, theirs.plan.task);
      same(mine.plan.step, theirs.plan.step);
      same(mine.plan.who, theirs.plan.who);
      same(mine.decisionTable, theirs.decisionTable);
      same(mine.box.short, theirs.box.short);
      same(mine.box.stand, theirs.box.stand);
      same(mine.callout.agreed, theirs.callout.agreed);
      same(mine.callout.waiting, theirs.callout.waiting);
      same(mine.callout.later, theirs.callout.later);
      same(mine.kindKey, theirs.kindKey);
    });
  }

  it('a host\'s lists change what is printed: its addressee is the reader, its status word a pill', () => {
    const md = '# T\n\n## 1. A\n\n### Task 1: x\n\nWho: ops.\n\n- [ ] **Step 1 (ops):** a\n\n| ID | Status |\n|---|---|\n| R1 | fait |\n| R2 | fait |\n';
    const d = dom(render(md, { print: true, reader: { addressees: ['ops'], status: { ok: ['fait'] } } }).html);
    expect(q(d, 'span.tmeta.yours').map((e) => e.textContent)).toEqual(['ops']);
    expect(q(d, 'li.attn')).toHaveLength(1);
    expect(q(d, 'span.pill.ok').map((e) => e.textContent)).toEqual(['fait', 'fait']);
    const plain = dom(render(md, { print: true }).html);
    expect(q(plain, 'span.tmeta.yours, li.attn, span.pill')).toHaveLength(0);
  });
});
