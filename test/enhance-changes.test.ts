// @vitest-environment jsdom
// The review strip and what changed (docserver L2, Task 20): the strip under the byline (strip.ts, the reference
// layout's section 16): what waits on the reader, the decisions' counts and the plan's, where it goes and when, and the
// `w` key; and the marks and stepper for what changed since a commit (changes.ts, section 24): the host's change set
// checked (RF4), the places it makes (one hunk across two rows is one place, nested hits keep the innermost,
// deletions), the stepper and the keys `n` and `p`, Hide, the 'changes' event, showChanges for Task 22 (measure, a
// later show winning, one host call per base), the day view's after(), and nothing written once destroyed (RF5).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CACHE_MAX, MAX_DELETIONS, MAX_RANGES, ONLY_WHAT, readChangeSet, showChanges, WHAT_MAX, type ShowOutcome } from '../src/enhance/changes.js';
import { destroyEnhancement, enhance, type EnhanceOptions } from '../src/enhance/index.js';
import { CHROME_ATTR } from '../src/enhance/journal.js';
import { contextOf } from '../src/enhance/lifecycle.js';
import { WAIT_CLIP } from '../src/enhance/strip.js';
import type { FeatureContext } from '../src/enhance/types.js';
import { render } from '../src/render/index.js';

/** A spec with a byline, a decisions table, a list with a nested item, three sections and a "Waiting" box. */
const DOC = [
  '# Changes sample',
  '',
  '**Spec** · 2026-10-20 · Status: Draft',
  '',
  '## 1. Decisions',
  '',
  'Intro paragraph.',
  '',
  '| ID | What | Status |',
  '|---|---|---|',
  '| D1 | First | Agreed |',
  '| D2 | Second | Pending, see below |',
  '| D3 | Third | Agreed |',
  '| D4 | Fourth | In review |',
  '',
  '- item a',
  '- item b',
  '  - nested c',
  '',
  '## 2. Later',
  '',
  'Closing paragraph.',
  '',
  '## Where things stand',
  '',
  '### Agreed',
  '',
  '- One thing.',
  '',
  '### Waiting on you',
  '',
  '- Pick a **name** for the tool.',
  '- Review the second draft.',
  '',
  '## 3. End',
  '',
  'Last words.',
  '',
].join('\n');

const SHA = 'abcdef1';
const BASE = '1234567';

const mounted: HTMLElement[] = [];

function mount(md = DOC): HTMLElement {
  const parsed = new DOMParser().parseFromString(`<!doctype html><body>${render(md).html}`, 'text/html');
  const root = document.createElement('main');
  root.append(...Array.from(parsed.body.childNodes).map((n) => document.importNode(n, true)));
  document.body.append(root);
  mounted.push(root);
  return root;
}

afterEach(async () => {
  for (const root of mounted.splice(0)) await destroyEnhancement(root).catch(() => undefined);
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function ctxOf(root: HTMLElement): FeatureContext {
  const ctx = contextOf(root);
  if (ctx === undefined) throw new Error('no context: the root is not enhanced');
  return ctx;
}

/** Let queued promise reactions run. */
async function flush(): Promise<void> {
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
}

const key = (target: EventTarget, k: string, init: KeyboardEventInit = {}): KeyboardEvent => {
  const e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(e);
  return e;
};

const click = (el: Element, init: MouseEventInit = {}): MouseEvent => {
  const e = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init });
  el.dispatchEvent(e);
  return e;
};

/** The first element of `root` matching `sel` whose text contains `text`. */
function find(root: Element, sel: string, text: string): HTMLElement {
  const el = (Array.from(root.querySelectorAll(sel)) as HTMLElement[]).find((x) => (x.textContent ?? '').includes(text));
  if (el === undefined) throw new Error(`no ${sel} "${text}"`);
  return el;
}

/** The last element of `root` matching `sel` whose text contains `text`: the innermost, for nested ones. */
function findLast(root: Element, sel: string, text: string): HTMLElement {
  const el = (Array.from(root.querySelectorAll(sel)) as HTMLElement[]).filter((x) => (x.textContent ?? '').includes(text)).pop();
  if (el === undefined) throw new Error(`no ${sel} "${text}"`);
  return el;
}

/** An element's lines, from its data-line. */
function lines(el: Element): [number, number] {
  const m = /^(\d+)-(\d+)$/.exec(el.getAttribute('data-line') ?? '');
  if (m === null) throw new Error(`no data-line on ${el.localName}`);
  return [Number(m[1]), Number(m[2])];
}

const marked = (root: Element, cls: 'chg' | 'chg-del'): string[] => Array.from(root.querySelectorAll(`.${cls}`)).map((e) => `${e.localName}:${(e.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 16)}`);

const stepper = (root: Element): HTMLElement | null => root.querySelector('.chg-nav');

/** The options of a reader with a comparison: `reply` answers every changes() call; calls are recorded in `calls`. */
function withChanges(reply: unknown | ((sha: string) => unknown), extra: EnhanceOptions = {}): { options: EnhanceOptions; calls: string[] } {
  const calls: string[] = [];
  const options: EnhanceOptions = {
    info: { sha: SHA },
    changes: (sha: string) => {
      calls.push(sha);
      return Promise.resolve(typeof reply === 'function' ? (reply as (s: string) => unknown)(sha) : reply);
    },
    ...extra,
  };
  return { options, calls };
}

/** Enhance `md` with a comparison and show `reply` since BASE, without a step unless `jump`. */
async function shown(reply: unknown, how: { jump?: boolean; md?: string; extra?: EnhanceOptions } = {}): Promise<{ root: HTMLElement; ctx: FeatureContext; out: ShowOutcome; calls: string[] }> {
  const root = mount(how.md);
  const { options, calls } = withChanges(reply, how.extra);
  await enhance(root, options);
  const ctx = ctxOf(root);
  const out = await showChanges(ctx, BASE, { what: 'Since Monday', jump: how.jump ?? false });
  return { root, ctx, out, calls };
}

describe('the review strip', () => {
  it('sits right after the byline, before the facts panel: what waits on the reader, then the decisions\' counts', async () => {
    const root = mount();
    await enhance(root, { info: { title: 'Changes sample', frontList: [{ key: 'tags', list: true, vals: ['a'] }] } });
    const strip = root.querySelector('section.review-strip') as HTMLElement;
    expect(strip.hasAttribute(CHROME_ATTR)).toBe(true);
    expect(strip.getAttribute('aria-label')).toBe('Review');
    expect(strip.previousElementSibling?.classList.contains('byline')).toBe(true);
    expect(strip.nextElementSibling?.classList.contains('doc-facts')).toBe(true);
    const wait = strip.querySelector('.rs-wait') as HTMLElement;
    expect(wait.querySelector('.rs-label')?.textContent).toBe('Waiting on you · 2');
    expect(wait.querySelector('.rs-label')?.firstElementChild?.className).toBe('dot');
    expect(Array.from(wait.querySelectorAll('ol > li > a')).map((a) => a.textContent)).toEqual(['Pick a name for the tool.', 'Review the second draft.']);
    expect(Array.from(wait.querySelectorAll('a')).map((a) => a.getAttribute('href'))).toEqual(['#waiting-on-you', '#waiting-on-you']);
    const facts = strip.querySelector('p.rs-facts') as HTMLElement;
    expect(facts.previousElementSibling).toBe(wait);
    const fact = facts.querySelector('.fact') as HTMLElement;
    expect(fact.querySelector('a')?.textContent).toBe('4 decisions');
    expect(fact.querySelector('a')?.getAttribute('href')).toBe('#1-decisions');
    // Counted by the first word of each pill, in lower case; most first, a tie in the order first seen.
    expect(Array.from(fact.querySelectorAll('.cnt')).map((c) => `${c.className}=${c.textContent}`)).toEqual(['cnt ok=2 agreed', 'cnt wait=1 pending', 'cnt wait=1 in']);
    expect(facts.querySelector('.sep')).toBeNull(); // one fact: no separator
  });

  it('a waiting item\'s text is clipped, and its link goes to the item through goTo; a modified click is left alone', async () => {
    const long = `- ${'word '.repeat(40)}end`;
    const root = mount(DOC.replace('- Review the second draft.', long));
    const onHash = vi.fn();
    await enhance(root, { onHash });
    const links = Array.from(root.querySelectorAll('.rs-wait a')) as HTMLAnchorElement[];
    const text = links[1]?.textContent ?? '';
    expect(text.length).toBeLessThanOrEqual(WAIT_CLIP);
    expect(text.endsWith('…')).toBe(true);
    const item = find(root, '.callout.waiting li', 'Pick a');
    const e = click(links[0] as HTMLAnchorElement);
    expect(e.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(item); // goTo focused it
    expect(onHash).not.toHaveBeenCalled(); // the item has no id
    for (const mod of ['ctrlKey', 'metaKey', 'shiftKey', 'altKey'] as const) {
      expect(click(links[0] as HTMLAnchorElement, { [mod]: true }).defaultPrevented, mod).toBe(false);
    }
    const other = click(links[0] as HTMLAnchorElement, { button: 1 });
    expect(other.defaultPrevented).toBe(false);
    // A click a handler before it already took: left alone, the focus where it was.
    (document.activeElement as HTMLElement).blur();
    root.addEventListener('click', (ev) => ev.preventDefault(), { capture: true });
    click(links[1] as HTMLAnchorElement);
    expect(document.activeElement).toBe(document.body);
  });

  it('w goes to the waiting box\'s heading, a new entry in the host\'s history; without waiting items there is no w', async () => {
    const root = mount();
    const onHash = vi.fn();
    await enhance(root, { onHash });
    const ctx = ctxOf(root);
    expect(ctx.keys.bindings().find((b) => b.key === 'w')).toEqual({ key: 'w', label: 'What is waiting on you' });
    expect(key(root.querySelector('h1') as HTMLElement, 'w').defaultPrevented).toBe(true);
    const h = root.querySelector('#waiting-on-you') as HTMLElement;
    expect(document.activeElement).toBe(h);
    expect(onHash).toHaveBeenCalledWith('waiting-on-you', { push: true, from: null });

    // A waiting box with no list: no items, so no w and nothing to show of it.
    const empty = mount(DOC.replace('- Pick a **name** for the tool.\n- Review the second draft.', 'Nothing yet.'));
    await enhance(empty);
    expect(ctxOf(empty).page.waitBox).not.toBeNull();
    expect(ctxOf(empty).keys.bindings().map((b) => b.key)).not.toContain('w');
    expect(empty.querySelector('.rs-wait')).toBeNull();

    const plain = mount(DOC.replace('### Waiting on you', '### Later'));
    await enhance(plain);
    expect(ctxOf(plain).keys.bindings().map((b) => b.key)).not.toContain('w');
    expect(plain.querySelector('.rs-wait')).toBeNull();
  });

  it('w is bound with waiting items where no strip is placed: on a root that is no document', async () => {
    const root = mount(['## Where things stand', '', '### Waiting on you', '', '- Decide.', ''].join('\n'));
    const onHash = vi.fn();
    await enhance(root, { onHash });
    const ctx = ctxOf(root);
    expect(ctx.info.isDocument).toBe(false);
    expect(root.querySelector('.review-strip')).toBeNull();
    expect(ctx.keys.bindings().find((b) => b.key === 'w')).toEqual({ key: 'w', label: 'What is waiting on you' });
    expect(key(root.querySelector('li') as HTMLElement, 'w').defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(root.querySelector('#waiting-on-you'));
    expect(onHash).toHaveBeenCalledWith('waiting-on-you', { push: true, from: null });
  });

  it('the decisions: the largest index table with a status column; a tie goes to the first (pinned); group rows are not counted', async () => {
    const table = (h: string, ids: string[], group = false): string[] => [
      `## ${h}`,
      '',
      '| ID | What | Current status |',
      '|---|---|---|',
      ...(group ? ['| Group one | | |'] : []),
      ...ids.map((id) => `| ${id} | Thing | Done |`),
      '',
    ];
    const head = ['# Two tables', '', '**Spec** · 2026-10-20', ''];
    const tie = mount([...head, ...table('Choices', ['C1', 'C2', 'C3']), ...table('2. Rulings', ['R1', 'R2'], true), '## Notes', '', 'Text.', ''].join('\n'));
    await enhance(tie);
    // Three body rows each (the second's group row counts here, as the reference's sort counted it): the first.
    expect(tie.querySelector('.rs-facts .fact a')?.textContent).toBe('3 choices');
    const big = mount([...head, ...table('Choices', ['C1', 'C2']), ...table('2. Ruling', ['R1', 'R2', 'R3'], true), '## Notes', '', 'Text.', ''].join('\n'));
    await enhance(big);
    // The group row is not counted, and a name that does not end in "s" takes "rows".
    expect(big.querySelector('.rs-facts .fact a')?.textContent).toBe('3 ruling rows');
    expect(Array.from(big.querySelectorAll('.rs-facts .cnt')).map((c) => c.textContent)).toEqual(['3 done']);
    // The counts, most first: one "open" before two "done"; a group's white space as one space.
    const mixed = mount([...head, '## Wide   gap', '', '| ID | What | Status |', '|---|---|---|', '| M1 | x | Open |', '| M2 | y | Done |', '| M3 | z | Done |', '', '## Notes', '', 'a', '', '## More', '', 'b', ''].join('\n'));
    await enhance(mixed);
    expect(mixed.querySelector('.rs-facts .fact a')?.textContent).toBe('3 wide gap rows');
    expect(Array.from(mixed.querySelectorAll('.rs-facts .cnt')).map((c) => `${c.className}=${c.textContent}`)).toEqual(['cnt ok=2 done', 'cnt wait=1 open']);
  });

  it('a row the host left short of the status column counts with no word; only a chrome pill is read', async () => {
    const root = mount();
    const d1 = find(root, 'tr', 'D1') as HTMLTableRowElement;
    d1.removeChild(d1.cells[2] as HTMLTableCellElement);
    const d3 = find(root, 'tr', 'D3') as HTMLTableRowElement;
    const own = document.createElement('span');
    own.className = 'pill';
    own.textContent = 'zzz';
    (d3.cells[2] as HTMLTableCellElement).prepend(own);
    await enhance(root);
    expect(root.querySelector('.rs-facts .fact a')?.textContent).toBe('4 decisions');
    expect(Array.from(root.querySelectorAll('.rs-facts .cnt')).map((c) => c.textContent)).toEqual(['1 pending', '1 in']);
  });

  it('the group: the nearest h2 or h3 with an id, by earlier siblings, then ancestors\', or a box by its heading', async () => {
    const idTable = ['| ID | What | Status |', '|---|---|---|', '| A1 | x | Done |', '| A2 | y | Done |', ''];
    const tail = ['## Two', '', 'x', '', '## Three', '', 'y', ''];
    const name = async (md: string[]): Promise<string | null | undefined> => {
      const root = mount(md.join('\n'));
      await enhance(root);
      return root.querySelector('.rs-facts .fact a')?.textContent;
    };
    // A heading with no id is passed over.
    expect(await name(['# A', '', '## 1. Earlier', '', 'Text.', '', '## ???', '', ...idTable, ...tail])).toBe('2 earlier rows');
    // A level-3 heading counts; a task heading by its whole name (its aria-label), number and all, not by its text,
    // which the plans' badge now holds with its step count.
    expect(await name(['# A', '', '## One', '', '### Task 1: Pick', '', '- [ ] **Step 1: One**', '- [ ] **Step 2: Two**', '', ...idTable, ...tail])).toBe('2 task 1: pick rows');
    // In a details: up to the details, then its earlier siblings.
    expect(await name(['# A', '', '## Group', '', '<details>', '<summary>More</summary>', '', ...idTable, '</details>', '', ...tail])).toBe('2 group rows');
    // After a box: the box's heading.
    expect(await name(['# A', '', '## In short', '', '- A point.', '', '---', '', ...idTable, ...tail])).toBe('2 in short rows');
    expect(await name(['# A', '', '## Where things stand', '', '### Agreed', '', '- One.', '', '---', '', ...idTable, ...tail])).toBe('2 agreed rows');
  });

  it('only an index of definitions with a status header is the decisions table; with no group heading it is "Decisions"', async () => {
    const notIndex = mount(['# A', '', '**Spec** · 2026-10-20', '', '## One', '', '| Name | Status |', '|---|---|', '| Alpha | Done |', '| Beta | Done |', '', '## Two', '', 'x', '', '## Three', '', 'y', ''].join('\n'));
    await enhance(notIndex);
    expect(notIndex.querySelector('.review-strip')).toBeNull();
    const noStatus = mount(['# A', '', '**Spec** · 2026-10-20', '', '## One', '', '| ID | What |', '|---|---|', '| A1 | x |', '| A2 | y |', '', '## Two', '', 'x', '', '## Three', '', 'y', ''].join('\n'));
    await enhance(noStatus);
    expect(noStatus.querySelector('.review-strip')).toBeNull();
    // The table before any heading with an id: no group; its link goes to its first row, by the row's ID.
    const ungrouped = mount(['# A', '', '| ID | What | Status |', '|---|---|---|', '| A1 | x | Done |', '| A2 | y | Open |', '', '## One', '', 'x', '', '## Two', '', 'y', '', '## Three', '', 'z', ''].join('\n'));
    const onHash = vi.fn();
    await enhance(ungrouped, { onHash });
    const a = ungrouped.querySelector('.rs-facts .fact a') as HTMLAnchorElement;
    expect([a.textContent, a.getAttribute('href')]).toEqual(['2 decisions', '#A1']);
    click(a);
    expect(onHash).toHaveBeenCalledWith('A1', { push: true, from: null });
  });

  it('the plan: tasks and steps on a long plan, and the reader\'s own steps; a separator between two facts', async () => {
    const steps = (n: number, from: number): string[] => Array.from({ length: n }, (_, i) => `- [ ] **Step ${String(from + i)}${i % 4 === 0 ? ' (you)' : ''}: Part** of it.`);
    const plan = [
      '# A plan',
      '',
      '**Plan** · 2026-10-20',
      '',
      '## 1. Decisions',
      '',
      '| ID | What | Status |',
      '|---|---|---|',
      '| P1 | x | Agreed |',
      '| P2 | y | Agreed |',
      '',
      '## 2. Tasks',
      '',
      '### Task 1: One',
      '',
      ...steps(12, 1),
      '',
      '### Task 2: Two',
      '',
      ...steps(10, 1),
      '',
      '## 3. Notes',
      '',
      'End.',
      '',
    ].join('\n');
    const root = mount(plan);
    await enhance(root);
    const facts = root.querySelector('.rs-facts') as HTMLElement;
    expect(Array.from(facts.children).map((c) => c.className)).toEqual(['fact', 'sep', 'fact']);
    const sep = facts.querySelector('.sep') as HTMLElement;
    expect([sep.textContent, sep.getAttribute('aria-hidden')]).toEqual(['·', 'true']);
    const fact = facts.lastElementChild as HTMLElement;
    expect(Array.from(fact.children).map((c) => `${c.className}|${c.textContent}`)).toEqual(['|2 tasks · 22 steps', 'cnt wait|6 yours']);

    const short = mount(plan.replace(/- \[ \] \*\*Step 1[0-2].*\n/g, ''));
    await enhance(short);
    expect(ctxOf(short).plan.outlineable).toBe(false);
    expect(short.querySelectorAll('.rs-facts .fact')).toHaveLength(1);

    const oneTask = mount(plan.replace('### Task 2: Two\n\n', ''));
    await enhance(oneTask);
    expect((oneTask.querySelector('.rs-facts') as HTMLElement).lastElementChild?.firstElementChild?.textContent).toBe('1 task · 22 steps');

    const notYours = mount(plan.replaceAll(' (you)', '').replace(/### Task \d: \w+\n\n/g, ''));
    await enhance(notYours);
    expect((notYours.querySelector('.rs-facts') as HTMLElement).lastElementChild?.textContent).toBe('22 steps');
  });

  it('goes after the title (past the hidden meta line) with no byline, and first in a root with no title', async () => {
    // A meta line that is all its kind (the separator inside the bold) makes no byline; it is hidden all the same.
    const noByline = mount(DOC.replace('**Spec** · 2026-10-20 · Status: Draft', '**Spec · Draft**'));
    await enhance(noByline);
    expect(noByline.querySelector('.byline')).toBeNull();
    const meta = noByline.querySelector('h1')?.nextElementSibling as HTMLElement;
    expect([meta.localName, meta.hasAttribute('hidden')]).toEqual(['p', true]);
    expect(meta.nextElementSibling?.classList.contains('review-strip')).toBe(true);

    const bare = mount(DOC.replace('**Spec** · 2026-10-20 · Status: Draft', 'A plain paragraph.'));
    await enhance(bare);
    expect(bare.querySelector('h1')?.nextElementSibling?.classList.contains('review-strip')).toBe(true);

    const untitled = mount(['## Rules', '', '| ID | What | Status |', '|---|---|---|', '| A1 | x | Done |', '| A2 | y | Done |', ''].join('\n'));
    const front = [{ key: 'rules', list: true, vals: ['AB-ONE', 'AB-TWO'] }];
    await enhance(untitled, { rules: true, info: { frontList: front } });
    const strip = untitled.querySelector('.review-strip');
    expect(strip).not.toBeNull();
    // First in the root, ahead of the document, after the bar's skeleton.
    expect(Array.from(untitled.children).find((c) => !c.hasAttribute(CHROME_ATTR) || c.classList.contains('review-strip'))).toBe(strip);
  });

  it('only for a document or a rules document (rules: true, a list key of rule IDs only), and only when it holds something', async () => {
    const small = ['# Small', '', '**Spec** · 2026-10-20', '', '## One', '', '| ID | What | Status |', '|---|---|---|', '| A1 | x | Done |', '| A2 | y | Done |', ''].join('\n');
    const rules = [{ key: 'rules', list: true, vals: ['AB-ONE', 'AB-TWO'] }];
    const cases: [EnhanceOptions, boolean][] = [
      [{}, false],
      [{ rules: true }, false],
      [{ rules: true, info: { frontList: rules } }, true],
      [{ rules: false, info: { frontList: rules } }, false],
      [{ rules: true, info: { frontList: [{ key: 'rules', list: true, vals: ['AB-ONE', 'not a rule'] }] } }, false],
      [{ rules: true, info: { frontList: [{ key: 'rules', list: false, vals: ['AB-ONE'] }] } }, false],
      [{ rules: true, info: { frontList: [{ key: 'rules', list: true, vals: [] }] } }, false],
    ];
    for (const [options, placed] of cases) {
      const root = mount(small);
      await enhance(root, options);
      expect(root.querySelector('.review-strip') !== null, JSON.stringify(options)).toBe(placed);
    }
    // A document with waiting items only: a strip.
    const waitingOnly = mount(['# W', '', '## One', '', 'a', '', '## Where things stand', '', '### Waiting on you', '', '- Decide.', '', '## Three', '', 'c', ''].join('\n'));
    await enhance(waitingOnly);
    expect(waitingOnly.querySelector('.review-strip .rs-wait')).not.toBeNull();
    expect(waitingOnly.querySelector('.review-strip .rs-facts')?.childElementCount).toBe(0);
    // A document with nothing to show: no strip.
    const empty = mount(['# Empty', '', '## One', '', 'a', '', '## Two', '', 'b', '', '## Three', '', 'c', ''].join('\n'));
    await enhance(empty);
    expect(empty.querySelector('.review-strip')).toBeNull();
  });

  it('destroy removes the strip and its links', async () => {
    const root = mount();
    const before = root.innerHTML;
    await enhance(root);
    expect(root.querySelector('.review-strip')).not.toBeNull();
    await destroyEnhancement(root);
    expect(root.innerHTML).toBe(before);
  });
});

describe('what changed: the host\'s change set (RF4)', () => {
  it('a reply with no changed array is no change set; a malformed one reads as no changes', () => {
    const fn = Object.assign(() => undefined, { changed: [[1, 2]] });
    for (const v of [null, undefined, 1, 'x', fn, [], {}, { changed: 'x' }, { changed: {} }, { removedAfter: [] }]) expect(readChangeSet(v), String(v)).toBeNull();
    const none = { changed: [], removedAfter: [] };
    const bad: unknown[] = [
      { changed: [[1, Number.NaN]] },
      { changed: [[Number.NaN, 2]] },
      { changed: [[1, Infinity]] },
      { changed: [[1.5, 2]] },
      { changed: [[3, 2]] },
      { changed: [[1, 2, 3]] },
      { changed: [[1]] },
      { changed: ['1-2'] },
      { changed: [{ 0: 1, 1: 2, length: 2 }] },
      { changed: [[1, '2']] },
      { changed: [[1, 2]], removedAfter: 'x' },
      { changed: [[1, 2]], removedAfter: [1.5] },
      { changed: [[1, 2]], removedAfter: [Number.NaN] },
      { changed: [[1, 2]], removedAfter: [null] },
      { changed: [[1, 2]], removedAfter: null },
      { changed: Array.from({ length: MAX_RANGES + 1 }, () => [1, 1]) },
      { changed: [], removedAfter: Array.from({ length: MAX_DELETIONS + 1 }, () => 1) },
    ];
    for (const v of bad) expect(readChangeSet(v)).toEqual(none);
    expect(readChangeSet({ changed: [[2, 2], [-3, 1e9]] })).toEqual({ changed: [[2, 2], [-3, 1e9]], removedAfter: [] });
    expect(readChangeSet({ changed: Array.from({ length: MAX_RANGES }, () => [1, 1]), removedAfter: Array.from({ length: MAX_DELETIONS }, () => 0) })?.changed).toHaveLength(MAX_RANGES);
    const set = readChangeSet({ changed: [[1, 2]], removedAfter: [4] });
    expect(Object.isFrozen(set) && Object.isFrozen(set?.changed) && Object.isFrozen(set?.changed[0]) && Object.isFrozen(set?.removedAfter)).toBe(true);
  });

  it('a getter that throws is no change set; a getter is read once per base, never past the bounds', () => {
    expect(
      readChangeSet({
        get changed(): unknown {
          throw new Error('host');
        },
      }),
    ).toBeNull();
    const reads: number[] = [];
    const big = new Proxy(Array.from({ length: MAX_RANGES + 5 }, () => [1, 1]), {
      get(t, k, r) {
        if (typeof k === 'string' && /^\d+$/.test(k)) reads.push(Number(k));
        return Reflect.get(t, k, r) as unknown;
      },
    });
    expect(readChangeSet({ changed: big })).toEqual({ changed: [], removedAfter: [] });
    expect(reads).toEqual([]); // refused by its length, read no further
  });

  it('a hostile set on a long document is bounded: whole-document ranges read as no changes past the work bound', async () => {
    const md = ['# Long', '', ...Array.from({ length: 800 }, (_, i) => `Paragraph ${String(i)}.\n`), '## A', '', 'a', '', '## B', '', 'b', '', '## C', '', 'c', ''].join('\n');
    const whole = { changed: Array.from({ length: MAX_RANGES }, (_, i) => [0, 1e9 - i]), removedAfter: Array.from({ length: MAX_DELETIONS }, () => 1e9) };
    const t0 = performance.now();
    const { root, out } = await shown(whole, { md });
    const took = performance.now() - t0;
    expect(out).toEqual({ places: 0 });
    expect(marked(root, 'chg')).toEqual([]);
    expect(took).toBeLessThan(5000);
    // Disjoint one-line ranges over every paragraph, each twelve times: each paragraph its own place, quickly.
    const ps = Array.from(root.querySelectorAll('p')).filter((p) => /^Paragraph/.test(p.textContent ?? ''));
    const fine = { changed: ps.flatMap((p) => Array.from({ length: 12 }, () => lines(p))) };
    expect(fine.changed.length).toBe(9600);
    const t1 = performance.now();
    const { root: other, out: out2 } = await shown(fine, { md });
    expect(out2).toEqual({ places: 800 });
    expect(other.querySelectorAll('.chg')).toHaveLength(800);
    expect(performance.now() - t1).toBeLessThan(5000);
  });

  it('a range past the last line marks nothing, and a step over no places does nothing', async () => {
    const { root, ctx, out } = await shown({ changed: [[90_000, 1e12]], removedAfter: [-5] });
    expect(out).toEqual({ places: 0 });
    expect(marked(root, 'chg')).toEqual([]);
    expect(marked(root, 'chg-del')).toEqual([]);
    // Shown again with its step: there is no place to go to.
    expect(await showChanges(ctx, '7654321', { what: 'All' })).toEqual({ places: 0 });
    expect(stepper(root)?.querySelector('.cn')?.textContent).toBe('0 changes');
    expect(root.querySelector('.flash')).toBeNull();
  });

  it('one range around the whole document marks its innermost blocks, as one place', async () => {
    const root = mount();
    const last = Math.max(...Array.from(root.querySelectorAll('[data-line]')).map((e) => Number(/(\d+)$/.exec(e.getAttribute('data-line') ?? '')?.[1] ?? 0)));
    const { options } = withChanges({ changed: [[1, last]] });
    await enhance(root, options);
    expect(await showChanges(ctxOf(root), BASE, { what: 'All', jump: false })).toEqual({ places: 1 });
    expect(stepper(root)?.querySelector('.cn')?.textContent).toBe('1 change');
    // The innermost: the rows and not their table, the items and not their list, "item b" not (it holds "nested c").
    expect(marked(root, 'chg')).toEqual([
      'h1:Changes sample',
      'dl:Date2026-10-20St',
      'h2:1. DecisionsFold',
      'p:Intro paragraph.',
      'tr:ID What Status',
      'tr:D1 First Agreed',
      'tr:D2 Second Pendin',
      'tr:D3 Third Agreed',
      'tr:D4 Fourth In rev',
      'li:item a',
      'li:nested c',
      'h2:2. LaterFold',
      'p:Closing paragrap',
      'h2:Where things sta',
      'h3:Agreed',
      'li:One thing.',
      'h3:Waiting on you',
      'li:Pick a name for ',
      'li:Review the secon',
      'h2:3. EndFold',
      'p:Last words.',
    ]);
  });
});

describe('what changed: the places', () => {
  it('one hunk across two table rows is one place; nested hits keep the innermost', async () => {
    const root = mount();
    const rows: unknown[] = [];
    const { options } = withChanges((sha: string) => rows[sha === BASE ? 0 : sha === '0abcdef' ? 1 : 2]);
    await enhance(root, options);
    const ctx = ctxOf(root);
    const d2 = find(root, 'tr', 'D2');
    const d3 = find(root, 'tr', 'D3');
    const nested = findLast(root, 'li', 'nested c');
    expect(nested.textContent).toBe('nested c');
    rows.push({ changed: [[lines(d2)[0], lines(d3)[0]]] });
    expect(await showChanges(ctx, BASE, { what: 'Rows', jump: false })).toEqual({ places: 1 });
    expect(marked(root, 'chg')).toEqual(['tr:D2 Second Pendin', 'tr:D3 Third Agreed']);
    // A range whose first block is in a place already and whose second is in none: it joins that place.
    rows.push({ changed: [lines(d2), [lines(d2)[0], lines(d3)[0]]] });
    expect(await showChanges(ctx, '0abcdef', { what: 'Joined', jump: false })).toEqual({ places: 1 });
    // The nested item only: not its list, nor the item and list that hold it.
    rows.push({ changed: [[lines(nested)[0], lines(nested)[0]]] });
    expect(await showChanges(ctx, 'fedcba9', { what: 'Nested', jump: false })).toEqual({ places: 1 });
    expect(marked(root, 'chg')).toEqual(['li:nested c']);
  });

  it('ranges that share a block join the first place; ranges apart are places apart, in document order', async () => {
    const root = mount();
    const p = find(root, 'p', 'Intro');
    const later = find(root, 'p', 'Closing');
    const d1 = find(root, 'tr', 'D1');
    const d2 = find(root, 'tr', 'D2');
    const set = { changed: [[lines(later)[0], lines(later)[0]], [lines(d1)[0], lines(d1)[0]], [lines(d2)[0], lines(d2)[0]], [lines(d1)[0], lines(d2)[0]], [lines(p)[0], lines(p)[0]]] };
    const { options } = withChanges(set);
    await enhance(root, options);
    const ctx = ctxOf(root);
    expect(await showChanges(ctx, BASE, { what: 'x', jump: false })).toEqual({ places: 4 });
    expect(stepper(root)?.querySelector('.cn')?.textContent).toBe('4 changes');
    // In document order: the intro, D1 (with D2 joined by the range that held both: the first place holding one of
    // them, D1's), D2 (its own place first), Closing.
    const flashed = (): string[] => Array.from(root.querySelectorAll('.flash')).map((e) => (e.textContent ?? '').trim().slice(0, 5));
    key(root.querySelector('h1') as HTMLElement, 'n');
    expect(flashed()).toEqual(['Intro']);
    key(root.querySelector('h1') as HTMLElement, 'n');
    expect(flashed()).toEqual(['Intro', 'D1\nFi', 'D2\nSe']);
    key(root.querySelector('h1') as HTMLElement, 'n');
    expect(stepper(root)?.querySelector('.cn')?.textContent).toBe('3 of 4');
  });

  it('a deletion marks the innermost blocks ending on the last line at or before it, a place of its own', async () => {
    const root = mount();
    const nested = findLast(root, 'li', 'nested c');
    const later = find(root, 'p', 'Closing');
    const { options } = withChanges({ changed: [[lines(later)[0], lines(later)[0]]], removedAfter: [lines(nested)[1], lines(later)[1] + 1, 0] });
    await enhance(root, options);
    const out = await showChanges(ctxOf(root), BASE, { what: 'x', jump: false });
    // After the list: the nested item ends there (and the items and lists around it, which hold it); after the closing
    // paragraph's line plus one (a blank line): the paragraph itself, already a place; at 0, nothing.
    expect(marked(root, 'chg-del')).toEqual(['li:nested c', 'p:Closing paragrap']);
    expect(marked(root, 'chg')).toEqual(['p:Closing paragrap']);
    expect(out).toEqual({ places: 2 });
  });

  it('the byline carries the meta line; the hidden meta paragraph, and a block whose data-line is not a line, are no blocks', async () => {
    const root = mount();
    const bad = find(root, 'p', 'Closing');
    const intro = find(root, 'p', 'Intro');
    bad.setAttribute('data-line', 'x-1');
    const meta = root.querySelector('h1')?.nextElementSibling as HTMLElement;
    const [m] = lines(meta);
    const { options } = withChanges({ changed: [[m, m], [lines(intro)[0], lines(intro)[0]], [21, 23]] });
    await enhance(root, options);
    await showChanges(ctxOf(root), BASE, { what: 'x', jump: false });
    expect(meta.hasAttribute('hidden')).toBe(true);
    expect(meta.classList.contains('chg')).toBe(false);
    expect((root.querySelector('.byline') as HTMLElement).classList.contains('chg')).toBe(true);
    expect(bad.classList.contains('chg')).toBe(false);
  });

  it('a block of one line ("7") is a block; a range inside a multi-line block hits it alone, whatever order the ranges come in', async () => {
    const md = DOC.replace('Closing paragraph.', '```\nline one\nline two\nline three\n```');
    const root = mount(md);
    const intro = find(root, 'p', 'Intro');
    const [i] = lines(intro);
    intro.setAttribute('data-line', String(i));
    const code = root.querySelector('.codehilite') as HTMLElement;
    const [c0, c1] = lines(code);
    const last = find(root, 'p', 'Last words');
    const { options } = withChanges({ changed: [lines(last), [c0 + 2, c0 + 2], [i, i]] });
    await enhance(root, options);
    expect(c1 - c0).toBeGreaterThanOrEqual(3);
    expect(await showChanges(ctxOf(root), BASE, { what: 'x', jump: false })).toEqual({ places: 3 });
    expect(marked(root, 'chg')).toEqual(['p:Intro paragraph.', 'div:line one line tw', 'p:Last words.']);
  });

  it('a folded section\'s blocks are blocks: a step reveals them', async () => {
    const root = mount();
    const closing = find(root, 'p', 'Closing');
    const { options } = withChanges({ changed: [[lines(closing)[0], lines(closing)[0]]] }, { storageKey: 'k', storage: { snapshot: { 'docreader:doc:k:folds': '["2-later"]' } } });
    await enhance(root, options);
    expect(closing.getAttribute('hidden')).toBe('until-found');
    await showChanges(ctxOf(root), BASE, { what: 'x' });
    expect(closing.classList.contains('chg')).toBe(true);
    expect(closing.hasAttribute('hidden')).toBe(false);
  });
});

describe('what changed: the stepper and the keys', () => {
  it('without changes(), a draft or a sha: no stepper, no keys, and showChanges answers unavailable', async () => {
    const cases: EnhanceOptions[] = [
      { info: { sha: SHA } },
      { info: { sha: SHA, draft: true }, changes: () => Promise.resolve({ changed: [] }) },
      { info: { sha: null }, changes: () => Promise.resolve({ changed: [] }) },
      { changes: () => Promise.resolve({ changed: [] }) },
    ];
    for (const options of cases) {
      const root = mount();
      await enhance(root, options);
      const ctx = ctxOf(root);
      expect(stepper(root)).toBeNull();
      expect(ctx.keys.bindings().map((b) => b.key)).not.toContain('n');
      expect(await showChanges(ctx, BASE, { what: 'x' })).toEqual({ skipped: 'unavailable' });
    }
  });

  it('the stepper sits in the bar\'s tray, hidden until a set is shown; then it names the comparison and counts the places', async () => {
    const root = mount();
    const { options } = withChanges({ changed: [[7, 7]] });
    await enhance(root, options);
    const nav = stepper(root) as HTMLElement;
    expect(nav.parentElement?.classList.contains('bar-tools')).toBe(true);
    expect([nav.hidden, nav.getAttribute('role'), nav.getAttribute('aria-label')]).toEqual([true, 'group', 'Changes']);
    expect(Array.from(nav.children).map((c) => `${c.localName}.${c.className}`)).toEqual(['span.what', 'span.cn', 'button.ic', 'button.ic', 'button.hide']);
    const [prev, next, off] = Array.from(nav.querySelectorAll('button'));
    expect([prev?.getAttribute('aria-label'), next?.getAttribute('aria-label'), off?.textContent]).toEqual(['Previous change', 'Next change', 'Hide']);
    expect(nav.querySelector('.cn')?.getAttribute('aria-live')).toBe('polite');
    const ctx = ctxOf(root);
    expect(ctx.keys.bindings().map((b) => b.key)).not.toContain('n');
    await showChanges(ctx, BASE, { what: `  Since   ${'x'.repeat(200)}`, jump: false });
    expect(nav.hidden).toBe(false);
    const what = nav.querySelector('.what')?.textContent ?? '';
    expect(what.startsWith('Since x')).toBe(true);
    expect(what.length).toBeLessThanOrEqual(WHAT_MAX);
    expect(nav.querySelector('.cn')?.textContent).toBe('1 change');
    expect(ctx.keys.bindings().map((b) => b.key)).toEqual(expect.arrayContaining(['n', 'p']));
    await showChanges(ctx, 'fedcba9', { what: '   ', jump: false });
    expect(nav.querySelector('.what')?.textContent).toBe('Changes');
  });

  it('a step starts from where the reader is, then moves on from the last place; p goes back; both wrap around', async () => {
    const root = mount();
    const els = [find(root, 'p', 'Intro'), find(root, 'p', 'Closing'), find(root, 'p', 'Last words')];
    const { options } = withChanges({ changed: els.map((e) => lines(e)) });
    await enhance(root, options);
    const ctx = ctxOf(root);
    const tops = [-400, 200, 900];
    els.forEach((e, i) => vi.spyOn(e, 'getBoundingClientRect').mockImplementation(() => ({ top: tops[i] as number }) as DOMRect));
    let now = 10_000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    await showChanges(ctx, BASE, { what: 'x', jump: false });
    const count = (): string => stepper(root)?.querySelector('.cn')?.textContent ?? '';
    const h1 = root.querySelector('h1') as HTMLElement;
    // The first place below the reading line (the bar's bottom, 0 here, plus 60): the second.
    expect(key(h1, 'n').defaultPrevented).toBe(true);
    expect(count()).toBe('2 of 3');
    now += 100;
    key(h1, 'n');
    expect(count()).toBe('3 of 3');
    now += 100;
    key(h1, 'n');
    expect(count()).toBe('1 of 3');
    now += 100;
    key(h1, 'p');
    expect(count()).toBe('3 of 3');
    // Not recent, and the last place (top 900) more than a screen (768) from the line: from where the reader is again.
    now += 5000;
    key(h1, 'p');
    expect(count()).toBe('1 of 3');
    // Not recent, but the last place (top -400) within a screen of the line: on from it.
    now += 5000;
    key(h1, 'n');
    expect(count()).toBe('2 of 3');
    // The buttons step too.
    const [prev, next] = Array.from(stepper(root)?.querySelectorAll('button.ic') ?? []) as HTMLButtonElement[];
    now += 100;
    click(next as HTMLButtonElement);
    expect(count()).toBe('3 of 3');
    now += 100;
    click(prev as HTMLButtonElement);
    expect(count()).toBe('2 of 3');
    // Not recent, the last place (top 200) within a screen of the line: on from it to the third, where from the
    // reader's position the first place below the line would be the second again.
    now += 5000;
    key(h1, 'n');
    expect(count()).toBe('3 of 3');
  });

  it('from where the reader is: p before the first place below the line, and past every place n wraps to the first', async () => {
    const root = mount();
    const els = [find(root, 'p', 'Intro'), find(root, 'p', 'Closing'), find(root, 'p', 'Last words')];
    const { options } = withChanges({ changed: els.map((e) => lines(e)) });
    await enhance(root, options);
    const ctx = ctxOf(root);
    const tops = [-900, -500, -100];
    els.forEach((e, i) => vi.spyOn(e, 'getBoundingClientRect').mockImplementation(() => ({ top: tops[i] as number }) as DOMRect));
    await showChanges(ctx, BASE, { what: 'x', jump: false });
    const count = (): string => stepper(root)?.querySelector('.cn')?.textContent ?? '';
    key(root.querySelector('h1') as HTMLElement, 'p');
    expect(count()).toBe('3 of 3'); // every place above the line: the last
    await showChanges(ctx, 'fedcba9', { what: 'x', jump: false });
    key(root.querySelector('h1') as HTMLElement, 'n');
    expect(count()).toBe('1 of 3'); // none below: wrap to the first
    // A place exactly 4 px below the line is not below it.
    tops.splice(0, 3, 64, 65, 300);
    await showChanges(ctx, '0123456', { what: 'x', jump: false });
    key(root.querySelector('h1') as HTMLElement, 'n');
    expect(count()).toBe('2 of 3');
  });

  it('a step goes through goTo (no new entry, no focus) and flashes each block of its place; the flash ends', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const root = mount();
    const d1 = find(root, 'tr', 'D1');
    const d2 = find(root, 'tr', 'D2');
    const h2 = root.querySelector('[id="2-later"]') as HTMLElement;
    const onHash = vi.fn();
    const { options } = withChanges((sha: string) => (sha === BASE ? { changed: [[lines(d1)[0], lines(d2)[0]], lines(h2)] } : { changed: [lines(d2), [lines(d1)[0], lines(d2)[0]]] }), { onHash });
    await enhance(root, options);
    const ctx = ctxOf(root);
    const active = document.activeElement;
    await showChanges(ctx, BASE, { what: 'x' }); // jump: true by default: the first place
    expect(stepper(root)?.querySelector('.cn')?.textContent).toBe('1 of 2');
    expect([d1.classList.contains('flash'), d2.classList.contains('flash')]).toEqual([true, true]);
    expect(document.activeElement).toBe(active);
    expect(onHash).toHaveBeenCalledWith('D1', { push: false, from: null }); // the row defines an ID
    vi.advanceTimersByTime(1000);
    key(root.querySelector('h1') as HTMLElement, 'n');
    expect(onHash).toHaveBeenLastCalledWith('2-later', { push: false, from: null });
    expect(h2.classList.contains('flash')).toBe(true);
    vi.advanceTimersByTime(950);
    expect([d1.classList.contains('flash'), h2.classList.contains('flash')]).toEqual([false, true]);
    // A second flash of a block restarts its time.
    vi.advanceTimersByTime(500);
    key(root.querySelector('h1') as HTMLElement, 'n'); // recent: on to the first place again
    key(root.querySelector('h1') as HTMLElement, 'n');
    vi.advanceTimersByTime(1500);
    expect(h2.classList.contains('flash')).toBe(true);
    vi.advanceTimersByTime(500);
    expect(h2.classList.contains('flash')).toBe(false);
    // A place whose blocks came in another order goes to the first in the document: D2's place, joined by D1 later.
    expect(await showChanges(ctx, 'fedcba9', { what: 'y' })).toEqual({ places: 1 });
    expect(onHash).toHaveBeenLastCalledWith('D1', { push: false, from: null });
  });

  it('Hide clears every mark and the stepper, calls the onHide of what it hid, and emits no sections', async () => {
    const root = mount();
    const { options } = withChanges({ changed: [[7, 7], [20, 22]], removedAfter: [25] });
    await enhance(root, options);
    const ctx = ctxOf(root);
    const heard: number[] = [];
    ctx.events.on('changes', (p) => heard.push(p.sections.length));
    const onHide = vi.fn();
    await showChanges(ctx, BASE, { what: 'x', jump: false, onHide });
    expect(marked(root, 'chg').length + marked(root, 'chg-del').length).toBeGreaterThan(1);
    click(stepper(root)?.querySelector('button.hide') as HTMLElement);
    expect([marked(root, 'chg'), marked(root, 'chg-del')]).toEqual([[], []]);
    expect(stepper(root)?.hidden).toBe(true);
    expect(onHide).toHaveBeenCalledTimes(1);
    expect(heard.slice(-1)).toEqual([0]);
    expect(ctx.keys.bindings().map((b) => b.key)).not.toContain('n');
    expect(key(root.querySelector('h1') as HTMLElement, 'n').defaultPrevented).toBe(false);
  });

  it('with no places, n does nothing but keep the key', async () => {
    const { root } = await shown({ changed: [] });
    expect(stepper(root)?.querySelector('.cn')?.textContent).toBe('0 changes');
    expect(key(root.querySelector('h1') as HTMLElement, 'n').defaultPrevented).toBe(true);
    expect(stepper(root)?.querySelector('.cn')?.textContent).toBe('0 changes');
  });

  it('the reading line is the bar\'s bottom (never above the window\'s top) plus 60 px, or 60 px with the bar hidden', async () => {
    const root = mount();
    const els = [find(root, 'p', 'Intro'), find(root, 'p', 'Closing'), find(root, 'p', 'Last words')];
    const { options } = withChanges({ changed: els.map((e) => lines(e)) });
    await enhance(root, options);
    const ctx = ctxOf(root);
    const tops = [-300, 100, 400];
    els.forEach((e, i) => vi.spyOn(e, 'getBoundingClientRect').mockImplementation(() => ({ top: tops[i] as number }) as DOMRect));
    let bottom = 100;
    vi.spyOn(ctx.slots?.bar as HTMLElement, 'getBoundingClientRect').mockImplementation(() => ({ bottom }) as DOMRect);
    const first = async (): Promise<string> => {
      await showChanges(ctx, BASE, { what: 'x', jump: false });
      key(root.querySelector('h1') as HTMLElement, 'n');
      return stepper(root)?.querySelector('.cn')?.textContent ?? '';
    };
    expect(await first()).toBe('3 of 3'); // the line at 160: 100 is above it
    bottom = -500;
    expect(await first()).toBe('2 of 3'); // the line at 60, not at -440 (where -300 would be below it)
    bottom = 100;
    root.classList.add('bar-hidden');
    expect(await first()).toBe('2 of 3'); // the line at 60
  });

  it('a Hide clicked with nothing shown emits nothing; an onHide that destroys stops the show that replaced it', async () => {
    const root = mount();
    const { options } = withChanges({ changed: [[7, 7]] });
    await enhance(root, options);
    const ctx = ctxOf(root);
    const heard = vi.fn();
    ctx.events.on('changes', heard);
    click(stepper(root)?.querySelector('button.hide') as HTMLElement);
    expect(heard).not.toHaveBeenCalled();
    await showChanges(ctx, BASE, { what: 'x', jump: false, onHide: 5 as unknown as () => void });
    click(stepper(root)?.querySelector('button.hide') as HTMLElement); // not a function: not called
    expect(heard).toHaveBeenCalledTimes(2);
    await showChanges(ctx, BASE, {
      what: 'x',
      jump: false,
      onHide: () => {
        void destroyEnhancement(root);
      },
    });
    expect(heard).toHaveBeenCalledTimes(3);
    expect(await showChanges(ctx, 'fedcba9', { what: 'y' })).toEqual({ places: 1 });
    expect(heard).toHaveBeenCalledTimes(3); // destroyed by the onHide: no event, no step
    await flush();
    expect(root.querySelector('.chg, .flash')).toBeNull();
  });

  it('a step button clicked with nothing shown does nothing; a listener that destroys on Hide stops its onHide', async () => {
    const root = mount();
    const { options } = withChanges({ changed: [[7, 7]] });
    await enhance(root, options);
    const ctx = ctxOf(root);
    const [, next] = Array.from(stepper(root)?.querySelectorAll('button.ic') ?? []) as HTMLButtonElement[];
    click(next as HTMLButtonElement);
    expect(root.querySelector('.flash')).toBeNull();
    const onHide = vi.fn();
    await showChanges(ctx, BASE, { what: 'x', jump: false, onHide });
    ctx.events.on('changes', (p) => {
      if (p.sections.length === 0) void destroyEnhancement(root);
    });
    click(stepper(root)?.querySelector('button.hide') as HTMLElement);
    expect(onHide).not.toHaveBeenCalled();
  });

  it('a show stops once destroyed by the onHide it calls, or by a listener of its event: no step, no scroll', async () => {
    const scrolled = vi.fn();
    Object.defineProperty(Element.prototype, 'scrollIntoView', { value: scrolled, configurable: true, writable: true });
    try {
      for (const by of ['onHide', 'listener'] as const) {
        const root = mount();
        const { options } = withChanges({ changed: [[7, 7]] });
        await enhance(root, options);
        const ctx = ctxOf(root);
        const kill = (): void => {
          void destroyEnhancement(root);
        };
        await showChanges(ctx, BASE, by === 'onHide' ? { what: 'x', jump: false, onHide: kill } : { what: 'x', jump: false });
        if (by === 'listener') ctx.events.on('changes', kill);
        scrolled.mockClear();
        await showChanges(ctx, 'fedcba9', { what: 'y' });
        expect(scrolled, by).not.toHaveBeenCalled();
        await flush();
      }
      // A control: with nothing destroying it, the same show steps, and goTo scrolls.
      const root = mount();
      const { options } = withChanges({ changed: [[7, 7]] });
      await enhance(root, options);
      scrolled.mockClear();
      await showChanges(ctxOf(root), BASE, { what: 'x' });
      expect(scrolled).toHaveBeenCalledTimes(1);
    } finally {
      delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
    }
  });

  it('without the bar: the marks and the keys, no stepper', async () => {
    const root = mount();
    const { options } = withChanges({ changed: [[7, 7]] }, { chrome: { bar: false } });
    await enhance(root, options);
    const ctx = ctxOf(root);
    expect(await showChanges(ctx, BASE, { what: 'x', jump: false })).toEqual({ places: 1 });
    expect(stepper(root)).toBeNull();
    expect(marked(root, 'chg')).toEqual(['p:Intro paragraph.']);
    expect(key(root.querySelector('h1') as HTMLElement, 'n').defaultPrevented).toBe(true);
    expect(root.querySelector('.flash')?.textContent).toBe('Intro paragraph.');
  });
});

describe('what changed: showChanges and the event', () => {
  it('a shown set emits changes with the sections of its places, in order, each once; a hidden one with none (done when)', async () => {
    const root = mount();
    const intro = find(root, 'p', 'Intro');
    const d1 = find(root, 'tr', 'D1');
    const last = find(root, 'p', 'Last words');
    const h2 = root.querySelector('[id="2-later"]') as HTMLElement;
    const { options } = withChanges({ changed: [lines(intro), lines(d1), lines(h2), lines(last), [3, 3]] });
    await enhance(root, options);
    const ctx = ctxOf(root);
    const heard: string[][] = [];
    ctx.events.on('changes', (p) => heard.push(p.sections.map((h) => h.id)));
    await showChanges(ctx, BASE, { what: 'x', jump: false });
    // The byline's place is before every section; a heading's own place is its section.
    expect(heard).toEqual([['1-decisions', '2-later', '3-end']]);
    // A second show replaces the first and emits once, its own sections only.
    await showChanges(ctx, 'fedcba9', { what: 'y', jump: false });
    expect(heard).toHaveLength(2);
    click(stepper(root)?.querySelector('button.hide') as HTMLElement);
    expect(heard[2]).toEqual([]);
  });

  it('a second show clears the first\'s marks and calls its onHide once', async () => {
    const root = mount();
    const intro = find(root, 'p', 'Intro');
    const later = find(root, 'p', 'Closing');
    const { options } = withChanges((sha: string) => ({ changed: [lines(sha === BASE ? intro : later)] }));
    await enhance(root, options);
    const ctx = ctxOf(root);
    const first = vi.fn();
    await showChanges(ctx, BASE, { what: 'x', jump: false, onHide: first });
    await showChanges(ctx, 'fedcba9', { what: 'y', jump: false });
    expect(marked(root, 'chg')).toEqual(['p:Closing paragrap']);
    expect(first).toHaveBeenCalledTimes(1);
  });

  it('measure counts the places and marks, shows and emits nothing', async () => {
    const root = mount();
    const { options } = withChanges({ changed: [[7, 7], [20, 22]] });
    await enhance(root, options);
    const ctx = ctxOf(root);
    const heard = vi.fn();
    ctx.events.on('changes', heard);
    expect(await showChanges(ctx, BASE, { what: 'x', measure: true })).toEqual({ places: 2 });
    expect(marked(root, 'chg')).toEqual([]);
    expect(stepper(root)?.hidden).toBe(true);
    expect(heard).not.toHaveBeenCalled();
  });

  it('one host call per base, its reply kept; the bases kept are bounded; a base that is no sha is unavailable', async () => {
    const root = mount();
    const { options, calls } = withChanges({ changed: [[7, 7]] });
    await enhance(root, options);
    const ctx = ctxOf(root);
    const both = await Promise.all([showChanges(ctx, 'deadbee', { what: 'x', jump: false }), showChanges(ctx, 'DEADBEE', { what: 'x', measure: true })]);
    expect(both).toEqual([{ places: 1 }, { places: 1 }]); // a measure supersedes no show
    await showChanges(ctx, 'DeadBee', { what: 'x', jump: false });
    expect(calls).toEqual(['deadbee']);
    await showChanges(ctx, BASE, { what: 'x', jump: false });
    const bases = Array.from({ length: CACHE_MAX + 1 }, (_, i) => `a${String(i).padStart(6, '0')}`);
    for (const b of bases) await showChanges(ctx, b, { what: 'x', measure: true });
    await showChanges(ctx, bases[CACHE_MAX] as string, { what: 'x', measure: true });
    await showChanges(ctx, BASE, { what: 'x', measure: true });
    expect(calls.filter((c) => c === BASE)).toHaveLength(2); // BASE was dropped, the newest kept
    expect(calls.filter((c) => c === bases[CACHE_MAX])).toHaveLength(1);
    for (const b of ['', 'xyz1234', '123456', 'a'.repeat(41), 'a'.repeat(63)]) expect(await showChanges(ctx, b, { what: 'x' })).toEqual({ skipped: 'unavailable' });
    expect(await showChanges(ctx, BASE, { what: 1 as unknown as string })).toEqual({ skipped: 'unavailable' });
    expect(await showChanges(ctx, BASE, null as unknown as { what: string })).toEqual({ skipped: 'unavailable' });
    expect(await showChanges(ctx, BASE, undefined as unknown as { what: string })).toEqual({ skipped: 'unavailable' });
  });

  it('a reply that is no change set is unavailable and leaves what is shown; a later show wins over an earlier reply', async () => {
    const root = mount();
    const intro = find(root, 'p', 'Intro');
    const later = find(root, 'p', 'Closing');
    const pending = new Map<string, (v: unknown) => void>();
    await enhance(root, {
      info: { sha: SHA },
      changes: (sha: string) => (sha === 'eeeeeee' ? Promise.resolve({ nope: true }) : new Promise((r) => pending.set(sha, r))),
    });
    const ctx = ctxOf(root);
    const a = showChanges(ctx, BASE, { what: 'a', jump: false });
    const b = showChanges(ctx, 'fedcba9', { what: 'b', jump: false });
    pending.get('fedcba9')?.({ changed: [lines(later)] });
    expect(await b).toEqual({ places: 1 });
    pending.get(BASE)?.({ changed: [lines(intro)] });
    expect(await a).toEqual({ skipped: 'superseded' });
    expect(marked(root, 'chg')).toEqual(['p:Closing paragrap']);
    expect(await showChanges(ctx, 'eeeeeee', { what: 'c', jump: false })).toEqual({ skipped: 'unavailable' });
    expect(marked(root, 'chg')).toEqual(['p:Closing paragrap']);
  });

  it('RF5: a reply after destroy writes nothing and answers gone; destroy clears the marks', async () => {
    const root = mount();
    const before = root.innerHTML;
    let resolve: (v: unknown) => void = () => undefined;
    await enhance(root, { info: { sha: SHA }, changes: () => new Promise((r) => (resolve = r)) });
    const ctx = ctxOf(root);
    const late = showChanges(ctx, BASE, { what: 'x' });
    await destroyEnhancement(root);
    resolve({ changed: [[1, 40]] });
    expect(await late).toEqual({ skipped: 'gone' });
    expect(root.innerHTML).toBe(before);
    expect(await showChanges(ctx, BASE, { what: 'x' })).toEqual({ skipped: 'gone' });

    const again = mount();
    const html = again.innerHTML;
    const { options } = withChanges({ changed: [[1, 40]], removedAfter: [30] });
    await enhance(again, options);
    await showChanges(ctxOf(again), BASE, { what: 'x' });
    expect(again.querySelectorAll('.chg').length).toBeGreaterThan(0);
    await destroyEnhancement(again);
    expect(again.innerHTML).toBe(html);
  });

  it('a listener of the event that destroys stops the step; the show answers its places', async () => {
    const root = mount();
    const { options } = withChanges({ changed: [[7, 7]] });
    await enhance(root, options);
    const ctx = ctxOf(root);
    ctx.events.on('changes', () => {
      void destroyEnhancement(root);
    });
    expect(await showChanges(ctx, BASE, { what: 'x' })).toEqual({ places: 1 });
    await flush();
    expect(root.querySelector('.flash')).toBeNull();
    expect(root.querySelector('.chg')).toBeNull();
  });
});

describe('what changed: another feature\'s throw, and a failed call', () => {
  it('a listener\'s throw is caught: the show answers its places, emits to every listener and steps; Hide still calls onHide', async () => {
    const root = mount();
    const intro = find(root, 'p', 'Intro');
    const { options } = withChanges({ changed: [lines(intro)] });
    await enhance(root, options);
    const ctx = ctxOf(root);
    const heard: number[] = [];
    ctx.events.on('changes', () => {
      throw new Error('a listener');
    });
    ctx.events.on('changes', (p) => heard.push(p.sections.length));
    const onHide = vi.fn();
    expect(await showChanges(ctx, BASE, { what: 'x', onHide })).toEqual({ places: 1 });
    expect(heard).toEqual([1]);
    expect(stepper(root)?.querySelector('.cn')?.textContent).toBe('1 of 1');
    expect(intro.classList.contains('flash')).toBe(true);
    click(stepper(root)?.querySelector('button.hide') as HTMLElement);
    expect(heard).toEqual([1, 0]);
    expect(onHide).toHaveBeenCalledTimes(1);
    expect(marked(root, 'chg')).toEqual([]);
  });

  it('a throw of the onHide a show replaces is caught: the new set is marked and its event emitted', async () => {
    const root = mount();
    const intro = find(root, 'p', 'Intro');
    const later = find(root, 'p', 'Closing');
    const { options } = withChanges((sha: string) => ({ changed: [lines(sha === BASE ? intro : later)] }));
    await enhance(root, options);
    const ctx = ctxOf(root);
    const heard: number[] = [];
    ctx.events.on('changes', (p) => heard.push(p.sections.length));
    const bad = (): void => {
      throw new Error('an onHide');
    };
    expect(await showChanges(ctx, BASE, { what: 'x', jump: false, onHide: bad })).toEqual({ places: 1 });
    expect(await showChanges(ctx, 'fedcba9', { what: 'y', onHide: bad })).toEqual({ places: 1 });
    expect(marked(root, 'chg')).toEqual(['p:Closing paragrap']);
    expect(heard).toEqual([1, 1]);
    expect(stepper(root)?.querySelector('.cn')?.textContent).toBe('1 of 1'); // and it stepped
    // Hide: the event is emitted before the onHide that throws.
    click(stepper(root)?.querySelector('button.hide') as HTMLElement);
    expect(heard).toEqual([1, 1, 0]);
  });

  it('a throw reached by the step (a listener of reveal) is caught: the show answers its places', async () => {
    const root = mount();
    const { options } = withChanges({ changed: [[7, 7]] });
    await enhance(root, options);
    const ctx = ctxOf(root);
    ctx.events.on('reveal', () => {
      throw new Error('a reveal listener');
    });
    expect(await showChanges(ctx, BASE, { what: 'x' })).toEqual({ places: 1 });
    expect(marked(root, 'chg')).toEqual(['p:Intro paragraph.']);
  });

  it('a failed call, or a reply that is no change set, is not kept: the next show of that base asks again', async () => {
    const root = mount();
    let n = 0;
    await enhance(root, {
      info: { sha: SHA },
      changes: () => {
        n += 1;
        if (n === 1) return Promise.reject(new Error('a network blip'));
        return Promise.resolve(n === 2 ? { nope: true } : { changed: [[7, 7]] });
      },
    });
    const ctx = ctxOf(root);
    expect(await showChanges(ctx, BASE, { what: 'x', jump: false })).toEqual({ skipped: 'unavailable' });
    expect(await showChanges(ctx, BASE, { what: 'x', jump: false })).toEqual({ skipped: 'unavailable' });
    expect(await showChanges(ctx, BASE, { what: 'x', jump: false })).toEqual({ places: 1 });
    expect(await showChanges(ctx, BASE, { what: 'x', jump: false })).toEqual({ places: 1 });
    expect(n).toBe(3); // the reply that read as a change set is kept
  });

  it('a failed call settling late drops only its own entry: a newer call for that base, made once it was bounded out, is kept', async () => {
    const root = mount();
    const calls: string[] = [];
    const held: ((v: unknown) => void)[] = [];
    await enhance(root, {
      info: { sha: SHA },
      changes: (sha: string) => {
        calls.push(sha);
        // BASE's first two calls are held; any later call answers at once.
        return sha === BASE && held.length < 2 ? new Promise((r) => held.push(r)) : Promise.resolve({ changed: [[7, 7]] });
      },
    });
    const ctx = ctxOf(root);
    const first = showChanges(ctx, BASE, { what: 'x', measure: true });
    for (let i = 0; i < CACHE_MAX; i += 1) await showChanges(ctx, `b${String(i).padStart(6, '0')}`, { what: 'x', measure: true }); // BASE bounded out
    const second = showChanges(ctx, BASE, { what: 'x', measure: true });
    expect(calls.filter((c) => c === BASE)).toHaveLength(2);
    held[0]?.({ nope: true });
    expect(await first).toEqual({ skipped: 'unavailable' });
    held[1]?.({ changed: [[7, 7]] });
    expect(await second).toEqual({ places: 1 });
    expect(await showChanges(ctx, BASE, { what: 'x', measure: true })).toEqual({ places: 1 });
    expect(calls.filter((c) => c === BASE)).toHaveLength(2);
  });
});

describe('what changed: the day view (after)', () => {
  it('with info.only, the changes since it are shown at once, without a step, as "Only that day"', async () => {
    const root = mount();
    const calls: string[] = [];
    const intro = find(root, 'p', 'Intro');
    await enhance(root, {
      info: { sha: SHA, only: 'ABCDEF0' },
      changes: (sha: string) => {
        calls.push(sha);
        return Promise.resolve({ changed: [lines(intro)] });
      },
    });
    await flush();
    expect(calls).toEqual(['abcdef0']);
    expect(marked(root, 'chg')).toEqual(['p:Intro paragraph.']);
    expect(stepper(root)?.querySelector('.what')?.textContent).toBe(ONLY_WHAT);
    expect(stepper(root)?.querySelector('.cn')?.textContent).toBe('1 change');
    expect(root.querySelector('.flash')).toBeNull();
  });

  it('not for a root that is no document, and not without only', async () => {
    const calls: string[] = [];
    const changes = (sha: string): Promise<unknown> => {
      calls.push(sha);
      return Promise.resolve({ changed: [[1, 1]] });
    };
    const small = mount('# Small\n\nText.\n');
    await enhance(small, { info: { sha: SHA, only: BASE }, changes });
    const plain = mount();
    await enhance(plain, { info: { sha: SHA }, changes });
    await flush();
    expect(calls).toEqual([]);
  });
});
