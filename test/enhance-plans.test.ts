// @vitest-environment jsdom
// Plans (docserver L2, Task 11): task headings and their badges, step numbers and owners, the reader's own steps,
// the outline mode of a long plan (the root class `outline`, the Outline button in the bar's tray, the `o` key, a
// task's "Show all"), a stored outline applied during the build, reveal opening a collapsed task, the plan published
// on ctx.plan, destroy restoring the text, and RF3's budget on the large plan.
//
// The feature list is mocked with a pass-through: features() is the real list, with the probes a test adds right
// before or right after `plans` (so a probe sees what plans built before any later feature runs), and with plans'
// build timed when a test asks for it. The position seam is wrapped too, so a case sees what changed inside keep().
import { afterEach, describe, expect, it, vi } from 'vitest';
import { destroyEnhancement, enhance, type EnhanceOptions, type ReaderStorage } from '../src/enhance/index.js';
import type { Feature } from '../src/enhance/features.js';
import { CHROME_ATTR, chrome } from '../src/enhance/journal.js';
import { contextOf } from '../src/enhance/lifecycle.js';
import { OUTLINE, OUTLINE_MIN_STEPS } from '../src/enhance/plans.js';
import type { RelayoutReason } from '../src/enhance/registry.js';
import { docKey } from '../src/enhance/state.js';
import type { FeatureContext } from '../src/enhance/types.js';
import { render } from '../src/render/index.js';
import { largePlan } from './fixtures/large-plan.js';

const hooks = vi.hoisted(() => ({
  beforePlans: [] as unknown[],
  afterPlans: [] as unknown[],
  timed: null as number[] | null,
  /** Each position.keep() while `watch` is on: how many roots were outlined before and after it ran its function. */
  kept: [] as [number, number][],
  watch: false,
}));

vi.mock('../src/enhance/nav.js', async (importOriginal) => {
  const real = await importOriginal<typeof import('../src/enhance/nav.js')>();
  const outlined = (): number => document.querySelectorAll('main.outline').length;
  return {
    ...real,
    createPosition: (env: Parameters<typeof real.createPosition>[0]) => {
      const p = real.createPosition(env);
      return Object.freeze({
        ...p,
        keep: <T,>(fn: () => T): T => {
          if (!hooks.watch) return p.keep(fn);
          const was = outlined();
          const out = p.keep(fn);
          hooks.kept.push([was, outlined()]);
          return out;
        },
      });
    },
  };
});

vi.mock('../src/enhance/features.js', async (importOriginal) => {
  const real = await importOriginal<typeof import('../src/enhance/features.js')>();
  const features = (): Feature[] => {
    const list = real.features().map((f): Feature => {
      if (f.name !== 'plans') return f;
      return {
        ...f,
        build: (ctx) => {
          const t0 = performance.now();
          f.build(ctx);
          hooks.timed?.push(performance.now() - t0);
        },
      };
    });
    const at = list.findIndex((f) => f.name === 'plans');
    return [...list.slice(0, at), ...(hooks.beforePlans as Feature[]), list[at] as Feature, ...(hooks.afterPlans as Feature[]), ...list.slice(at + 1)];
  };
  return { ...real, features };
});

/** The plan the cases read: four tasks (three h3s under a numbered section, one h2), 20 steps in all. */
const PLAN = [
  '# Example plan',
  '',
  '**Plan** · 2026-10-20 · Status: Draft',
  '',
  '## In short',
  '',
  '- Three tasks build a small tool, and the last one ships it.',
  '',
  '## 1. Tasks',
  '',
  'The tasks, in order.',
  '',
  '### Task 1: Set up the project',
  '',
  'Who: you.',
  '',
  'Who: a second owner line, never read.',
  '',
  '- [ ] **Step 1: Make the folder** with a readme in it.',
  '- [ ] **Step 2 (you): Pick a name** for the tool.',
  '- [x] **Step 3:** Write the first `config.json`.',
  '- [ ] A step with no title, just text.',
  '- [ ] **Not a step title**, then more text.',
  '',
  '### Task 2. Write the parser',
  '',
  'Who: the build team.',
  '',
  '- [ ] **Step 1: Read the input**',
  '',
  '  The input is one file; this second paragraph says so.',
  '',
  '- [ ] **Step 2 (yours): Check the tokens**',
  '',
  '- [ ] **Step 3 (a reviewer): Review the grammar**',
  '',
  'A table part:',
  '',
  '| Part | Owner |',
  '|---|---|',
  '| Lexer | you |',
  '',
  '### Task P0-1 — An odd number',
  '',
  '- [ ] **Step 1: One**',
  '',
  '## Task 3: Ship it',
  '',
  'Shipping takes eleven steps.',
  '',
  ...Array.from({ length: 11 }, (_, i) => `- [ ] **Step ${String(i + 1)}: Do part ${String(i + 1)}** of the release.`),
  '',
].join('\n');

/** A plan of `n` steps under one task, with a few headings that are not tasks. */
function stepsDoc(n: number): string {
  return [
    '# Steps',
    '',
    '## One',
    '',
    '### Task 1: All the steps',
    '',
    ...Array.from({ length: n }, (_, i) => `- [ ] **Step ${String(i + 1)}: Part ${String(i + 1)}**`),
    '',
    '## Two',
    '',
    '### Task list',
    '',
    '### **Task 9:** in bold',
    '',
    '## 3. Task 5: numbered',
    '',
    'A numbered section.',
    '',
    '## Three',
    '',
    'End.',
    '',
  ].join('\n');
}

const mounted: HTMLElement[] = [];

function mount(md = PLAN): HTMLElement {
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
  hooks.beforePlans.length = 0;
  hooks.afterPlans.length = 0;
  hooks.kept.length = 0;
  hooks.watch = false;
  hooks.timed = null;
  vi.restoreAllMocks();
});

function ctxOf(root: HTMLElement): FeatureContext {
  const ctx = contextOf(root);
  if (ctx === undefined) throw new Error('no context: the root is not enhanced');
  return ctx;
}

/** A probe feature that runs `fn` with the context right after plans built, before any later feature. */
function afterPlans(fn: (ctx: FeatureContext) => void): void {
  hooks.afterPlans.push({ name: 'probe', build: fn } satisfies Feature);
}

/** A probe feature that runs `fn` with the context right before plans builds. */
function beforePlans(fn: (ctx: FeatureContext) => void): void {
  hooks.beforePlans.push({ name: 'probe', build: fn } satisfies Feature);
}

/** The heading of this level whose name (its aria-label, else its text with chrome left out) starts with `text`. */
function heading(root: Element, tag: 'h2' | 'h3', text: string): HTMLElement {
  const h = (Array.from(root.querySelectorAll(tag)) as HTMLElement[]).find((x) => (x.getAttribute('aria-label') ?? sourceText(x)).startsWith(text));
  if (h === undefined) throw new Error(`no ${tag} "${text}"`);
  return h;
}

/** The step item whose text (chrome left out) contains `text`. */
function step(root: Element, text: string): HTMLLIElement {
  const li = (Array.from(root.querySelectorAll('li.task-list-item')) as HTMLLIElement[]).find((x) => x.textContent?.includes(text) === true);
  if (li === undefined) throw new Error(`no step "${text}"`);
  return li;
}

/** An element's text with every hidden chrome node and every chrome control (a button) left out. */
function shownText(el: Element): string {
  let out = '';
  for (const n of Array.from(el.childNodes)) {
    if (n.nodeType === 3) out += (n as Text).data;
    else if (n.nodeType === 1) {
      const e = n as Element;
      if (e.hasAttribute(CHROME_ATTR) && (e.hasAttribute('hidden') || e.localName === 'button')) continue;
      out += shownText(e);
    }
  }
  return out;
}

/** An element's source text: its text with every chrome element (and what it holds) left out. */
function sourceText(el: Element): string {
  let out = '';
  for (const n of Array.from(el.childNodes)) {
    if (n.nodeType === 3) out += (n as Text).data;
    else if (n.nodeType === 1 && !(n as Element).hasAttribute(CHROME_ATTR)) out += sourceText(n as Element);
  }
  return out;
}

const key = (target: EventTarget, k: string, init: KeyboardEventInit = {}): KeyboardEvent => {
  const e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(e);
  return e;
};

const click = (el: Element): void => {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
};

/** Resolve after `ms` of real time. */
const wait = (ms: number): Promise<void> =>
  new Promise((r) => {
    setTimeout(r, ms);
  });

/** A storage whose snapshot holds `stored` under the plan's outline key (storageKey "k"), recording every set(). */
function storageWith(stored: string | undefined): { storage: ReaderStorage; sets: [string, string | null][] } {
  const sets: [string, string | null][] = [];
  const snapshot: Record<string, string> = stored === undefined ? {} : { [docKey('k', OUTLINE)]: stored };
  return {
    sets,
    storage: {
      snapshot,
      set: (k, v) => {
        sets.push([k, v]);
      },
    },
  };
}

const toolOf = (root: HTMLElement): HTMLButtonElement | null => root.querySelector('.bar-tools .outline-btn');

describe('tasks: headings, badges and owners (the reference layout, section 7)', () => {
  it('a task heading, an h3 or an h2, in either grammar, takes its number into a badge, keeps its text and is named by it', async () => {
    const root = mount();
    await enhance(root);
    const want: [string, 'h2' | 'h3', string, string, string][] = [
      ['Task 1: Set up the project', 'h3', 'Task 1', ': ', 'Set up the project'],
      ['Task 2. Write the parser', 'h3', 'Task 2', '. ', 'Write the parser'],
      ['Task P0-1 — An odd number', 'h3', 'Task P0-1', ' — ', 'An odd number'],
      ['Task 3: Ship it', 'h2', 'Task 3', ': ', 'Ship it'],
    ];
    const tasks = ctxOf(root).plan.tasks;
    expect(tasks).toHaveLength(4);
    want.forEach(([whole, tag, no, sep, rest], i) => {
      const h = tasks[i] as HTMLElement;
      expect(h.localName).toBe(tag);
      expect(h.classList.contains('task')).toBe(true);
      expect(sourceText(h)).toBe(rest);
      const [badge, hidden, text] = Array.from(h.childNodes);
      expect((badge as Element).className).toBe('task-id');
      expect((badge as Element).hasAttribute(CHROME_ATTR)).toBe(true);
      expect(badge?.firstChild?.nodeType).toBe(3);
      expect((badge?.firstChild as Text).data).toBe(no);
      expect((hidden as Element).hasAttribute('hidden')).toBe(true);
      expect((hidden as Element).hasAttribute(CHROME_ATTR)).toBe(true);
      expect(hidden?.textContent).toBe(sep);
      expect((text as Text).data).toBe(rest);
      expect(h.getAttribute('aria-label')).toBe(whole);
    });
    // No ids written, and no attribute naming the task.
    for (const h of tasks) expect(Array.from(h.attributes).map((a) => a.name).sort()).toEqual(['aria-label', 'class', 'data-line', 'id']);
    expect(ctxOf(root).plan.published).toBe(true);
  });

  it('a heading that does not open with a task number, or whose first child is not text, is no task', async () => {
    const root = mount(stepsDoc(3));
    await enhance(root);
    expect(ctxOf(root).plan.tasks.map((h) => sourceText(h))).toEqual(['All the steps']);
    expect(heading(root, 'h3', 'Task list').classList.contains('task')).toBe(false);
    const bold = Array.from(root.querySelectorAll('h3')).find((h) => h.textContent?.includes('in bold') === true);
    expect(bold?.classList.contains('task')).toBe(false);
    expect(bold?.querySelector('.task-id')).toBeNull();
    // A numbered section is no task either: its first child is the section number.
    expect(heading(root, 'h2', '3. Task 5').classList.contains('task')).toBe(false);
    expect(heading(root, 'h2', '3. Task 5').querySelector('.task-id')).toBeNull();
  });

  it('an empty heading is no task; a task with nothing after its separator keeps an empty title', async () => {
    const root = mount(['# P', '', '###', '', '### Task 7:', '', 'Text.', '', '### Task k: A number its word holds too', ''].join('\n'));
    await enhance(root);
    const [empty, bare, k] = Array.from(root.querySelectorAll('h3'));
    expect(k?.querySelector('.task-id')?.textContent).toBe('Task k');
    expect(k?.querySelector('.task-id + span[hidden]')?.textContent).toBe(': ');
    expect(empty?.childNodes).toHaveLength(0);
    expect(bare?.classList.contains('task')).toBe(true);
    expect(Array.from(bare?.childNodes ?? []).map((n) => [(n as Element).className, n.textContent])).toEqual([
      ['task-id', 'Task 7'],
      ['', ':'],
    ]);
    expect(bare?.getAttribute('aria-label')).toBe('Task 7:');
    expect(ctxOf(root).plan.tasks).toEqual([bare, k]);
  });

  it('a heading whose first child is a comment that reads like a task is no task (a host\'s edit)', async () => {
    const root = mount(stepsDoc(2));
    const h = heading(root, 'h3', 'Task list');
    h.prepend(document.createComment('Task 4: in a comment'));
    await enhance(root);
    expect(h.classList.contains('task')).toBe(false);
    expect(h.firstChild?.nodeType).toBe(8);
  });

  it('a chrome heading an earlier feature made is no task', async () => {
    beforePlans((ctx) => {
      const h = ctx.root.ownerDocument.createElement('h3');
      h.textContent = 'Task 8: made by a feature';
      ctx.journal.insert(h, ctx.root, null);
    });
    const root = mount(stepsDoc(2));
    await enhance(root);
    const made = Array.from(root.querySelectorAll('h3')).find((h) => h.hasAttribute(CHROME_ATTR));
    expect(made?.textContent).toBe('Task 8: made by a feature');
    expect(made?.classList.contains('task')).toBe(false);
    expect(ctxOf(root).plan.tasks).toHaveLength(1);
  });

  it('a heading keeps a label it already has, by aria-label or aria-labelledby', async () => {
    const root = mount();
    const h = heading(root, 'h3', 'Task 1:');
    h.setAttribute('aria-label', 'The first task, by its author');
    const by = heading(root, 'h3', 'Task 2.');
    by.setAttribute('aria-labelledby', 'x');
    await enhance(root);
    expect(h.getAttribute('aria-label')).toBe('The first task, by its author');
    expect(h.classList.contains('task')).toBe(true);
    expect(by.hasAttribute('aria-label')).toBe(false);
    expect(by.classList.contains('task')).toBe(true);
  });

  it('the badge counts the task\'s steps and names the owner its first owner line gives; "yours" when that names the reader', async () => {
    const root = mount();
    await enhance(root);
    const metas = (text: string): string[][] =>
      Array.from(heading(root, text.startsWith('Task 3') ? 'h2' : 'h3', text).querySelectorAll('.task-id > .tmeta')).map((m) => [m.className, m.textContent ?? '']);
    expect(metas('Task 1')).toEqual([
      ['tmeta', '5 steps'],
      ['tmeta yours', 'you'],
    ]);
    expect(metas('Task 2')).toEqual([
      ['tmeta', '3 steps'],
      ['tmeta', 'the build team'],
    ]);
    expect(metas('Task P0-1')).toEqual([['tmeta', '1 step']]);
    expect(metas('Task 3')).toEqual([['tmeta', '11 steps']]);
    for (const m of Array.from(root.querySelectorAll('.tmeta'))) expect(m.hasAttribute(CHROME_ATTR)).toBe(true);
  });

  it('an owner line is a paragraph that opens with "Who:" and names the owner up to its first full stop; anything else is not', async () => {
    const root = mount(
      [
        '# P',
        '',
        '### Task 1: A',
        '',
        '> Who: you, in a quote.',
        '',
        'Who: You, Again. More.',
        '',
        '### Task 2: B',
        '',
        'Who has no colon. Who: you.',
        '',
        '- Who: you, in a list.',
        '',
        '#### Who: a heading.',
        '',
        '&#32;Who: you, after a space.',
        '',
        '### Task 3: C',
        '',
        `Who: ${'x'.repeat(200_000)}`,
        '',
        '1. [ ] **Step 1: An ordered step**',
        '',
      ].join('\n'),
    );
    const t0 = performance.now();
    await enhance(root);
    expect(performance.now() - t0).toBeLessThan(5000);
    const metas = (n: number): string[] => Array.from((ctxOf(root).plan.tasks[n] as Element).querySelectorAll('.tmeta')).map((m) => `${m.className}|${m.textContent ?? ''}`);
    expect(metas(0)).toEqual(['tmeta yours|You, Again']);
    expect(metas(1)).toEqual([]); // a plain list holds no steps
    expect(metas(2)).toEqual(['tmeta|1 step']); // an ordered task list does
  });
});

describe('steps: numbers, owners and bodies', () => {
  it('a step title\'s number moves into a badge before the title, its separator is hidden, and its checkbox is named', async () => {
    const root = mount();
    await enhance(root);
    const li = step(root, 'Make the folder');
    const [no, strong] = Array.from(li.children).filter((c) => c.localName !== 'input');
    expect(no?.className).toBe('step-no');
    expect(no?.hasAttribute(CHROME_ATTR)).toBe(true);
    expect(no?.textContent).toBe('Step 1');
    expect(strong?.localName).toBe('strong');
    expect(shownText(strong as Element)).toBe('Make the folder');
    expect(strong?.textContent).toBe(': Make the folder'); // the separator stays, hidden
    expect(li.querySelector('input')?.getAttribute('aria-label')).toBe('Step 1: Make the folder');
    expect(li.classList.contains('attn')).toBe(false);
    expect(li.id).toBe('');
  });

  it('an owner in brackets goes into the badge; the reader\'s own step is marked and counted', async () => {
    const root = mount();
    await enhance(root);
    const mine = step(root, 'Pick a name');
    const no = mine.querySelector('.step-no');
    expect(no?.firstChild?.textContent).toBe('Step 2');
    const who = no?.querySelector('.who');
    expect(who?.textContent).toBe('you');
    expect(who?.hasAttribute(CHROME_ATTR)).toBe(true);
    expect(shownText(mine.querySelector('strong') as Element)).toBe('Pick a name');
    expect(mine.querySelector('strong')?.textContent).toBe(' (): Pick a name');
    expect(mine.classList.contains('attn')).toBe(true);
    expect(mine.querySelector('input')?.getAttribute('aria-label')).toBe('Step 2: Pick a name');
    // "(yours)" names the reader too (the words anywhere in the bracket); "(a reviewer)" does not.
    const yours = step(root, 'Check the tokens');
    expect(yours.querySelector('.who')?.textContent).toBe('yours');
    expect(yours.classList.contains('attn')).toBe(true);
    const theirs = step(root, 'Review the grammar');
    expect(theirs.querySelector('.who')?.textContent).toBe('a reviewer');
    expect(theirs.classList.contains('attn')).toBe(false);
    expect(ctxOf(root).plan.yours).toBe(2);
    expect(Array.from(root.querySelectorAll('li.attn'))).toEqual([mine, yours]);
  });

  it('what follows the title is the step\'s body: elements are marked, text is wrapped; a loose step marks its later blocks', async () => {
    const root = mount();
    await enhance(root);
    const tight = step(root, 'Write the first');
    expect(shownText(tight.querySelector('strong') as Element)).toBe('');
    const rest = Array.from(tight.children).filter((c) => c.classList.contains('step-rest'));
    expect(rest.map((c) => [c.localName, c.hasAttribute(CHROME_ATTR), c.textContent])).toEqual([
      ['span', true, ' Write the first '],
      ['code', false, 'config.json'],
      ['span', true, '.'],
    ]);
    expect(tight.querySelector('input')?.getAttribute('aria-label')).toBe('Step 3: ');
    const loose = step(root, 'Read the input');
    expect(loose.classList.contains('loose')).toBe(true);
    const [first, second] = Array.from(loose.children);
    expect(first?.localName).toBe('p');
    expect(first?.classList.contains('step-rest')).toBe(false);
    expect(first?.querySelector('.step-no')?.textContent).toBe('Step 1');
    expect(second?.classList.contains('step-rest')).toBe(true);
    expect(loose.querySelector('input')?.getAttribute('aria-label')).toBe('Step 1: Read the input');
  });

  it('an item with no step title keeps its text; its checkbox is named by its bold lead, or by its text', async () => {
    const root = mount();
    await enhance(root);
    const plain = step(root, 'A step with no title');
    expect(plain.querySelector('.step-no, .step-rest')).toBeNull();
    expect(plain.querySelector('input')?.getAttribute('aria-label')).toBe('A step with no title, just text.');
    const bold = step(root, 'Not a step title');
    expect(bold.querySelector('.step-no')).toBeNull();
    expect(Array.from(bold.querySelectorAll('.step-rest')).map((c) => c.textContent)).toEqual([', then more text.']);
    expect(bold.querySelector('input')?.getAttribute('aria-label')).toBe('Not a step title');
  });

  it('an owner longer than 24 characters is no owner, and the step title is left as written', async () => {
    const root = mount(['# P', '', `- [ ] **Step 1 (${'o'.repeat(25)}): Long owner**`, '- [ ] **Step 2 (you)** no colon', ''].join('\n'));
    await enhance(root);
    expect(root.querySelector('.step-no')).toBeNull();
    expect(ctxOf(root).plan.yours).toBe(0);
    expect(ctxOf(root).plan.steps).toHaveLength(2);
  });

  it('a checkbox\'s name is cut to 90 characters, and an item\'s text is read to 300 for it', async () => {
    const long = 'word '.repeat(30).trim();
    const root = mount(['# P', '', `- [ ] **Step 1: ${long}**`, `- [ ] a${' '.repeat(310)}b`, ''].join('\n'));
    await enhance(root);
    const [a = '', b = ''] = Array.from(root.querySelectorAll('input')).map((i) => i.getAttribute('aria-label') ?? '');
    expect(a).toBe(`Step 1: ${ctxOf(root).text.clip(long, 90)}`);
    expect(a.endsWith('…')).toBe(true);
    expect(b).toBe('a'); // the "b" lies past the first 300 characters
  });

  it('a title whose first child is not text is no title, and the rest of its item is left as written', async () => {
    const root = mount(['# P', '', '- [ ] **`Step 1:` code first** then text', ''].join('\n'));
    await enhance(root);
    const li = step(root, 'code first');
    expect(li.querySelector('.step-no, .step-rest')).toBeNull();
    expect(li.querySelector('input')?.getAttribute('aria-label')).toBe('Step 1: code first');
  });

  it('a body\'s blank text is left alone; a nested list after the title is part of the body', async () => {
    const root = mount(['# P', '', '- [ ] **Step 2: Nested** text', '  - inner', ''].join('\n'));
    await enhance(root);
    const li = step(root, 'Nested');
    const after = Array.from(li.childNodes).slice(Array.from(li.childNodes).indexOf(li.querySelector('strong') as ChildNode) + 1);
    expect(after.map((n) => [n.nodeName, (n as Element).className ?? null, n.textContent])).toEqual([
      ['SPAN', 'step-rest', ' text\n'],
      ['UL', 'step-rest', '\ninner\n'],
      ['#text', null, '\n'],
    ]);
  });

  it('an item the host changed: no checkbox, or no text, is still built without a throw', async () => {
    const root = mount(['# P', '', '- [ ] **Step 1: Titled** text', '- [ ] Untitled', '- [ ] Emptied', ''].join('\n'));
    const items = Array.from(root.querySelectorAll('li.task-list-item'));
    for (const li of items.slice(0, 2)) li.querySelector('input')?.remove();
    const last = items[2] as Element;
    for (const n of Array.from(last.childNodes)) if (n.nodeType === 3) n.remove();
    await enhance(root);
    expect(items[0]?.querySelector('.step-no')?.textContent).toBe('Step 1');
    expect(root.querySelectorAll('input')).toHaveLength(1);
    expect(last.querySelector('input')?.getAttribute('aria-label')).toBe('Step');
  });

  it('every step is listed in document order, a nested one too, and the plan carries its counts', async () => {
    const root = mount();
    await enhance(root);
    const { plan } = ctxOf(root);
    expect(plan.steps).toEqual(Array.from(root.querySelectorAll('li.task-list-item')));
    expect(plan.steps).toHaveLength(20);
    expect(plan.outlineable).toBe(true);
    expect(Object.isFrozen(plan.steps) && Object.isFrozen(plan.tasks)).toBe(true);
  });
});

describe('outline mode (the reference layout, section 23)', () => {
  it(`starts at ${String(OUTLINE_MIN_STEPS)} steps: below that, no parts, no buttons, no tool and no key`, async () => {
    expect(OUTLINE_MIN_STEPS).toBe(20);
    const short = mount(stepsDoc(19));
    await enhance(short);
    const s = ctxOf(short);
    expect(s.plan.outlineable).toBe(false);
    expect(short.querySelector('.task-part, .task-open, .outline-btn')).toBeNull();
    expect(s.keys.bindings().map((b) => b.key)).not.toContain('o');
    const long = mount(stepsDoc(20));
    await enhance(long);
    const l = ctxOf(long);
    expect(l.plan.outlineable).toBe(true);
    expect(long.querySelectorAll('.task-open')).toHaveLength(1);
    expect(toolOf(long)).not.toBeNull();
    expect(l.keys.bindings()).toContainEqual({ key: 'o', label: 'Outline: step titles only' });
  });

  it('a task\'s parts run to the next heading of its level or above; an h2 task\'s stop at a box that holds an h2 too', async () => {
    const root = mount();
    await enhance(root);
    /** The task parts after `h`, up to the first sibling that is not one (chrome a later feature put there passed over). */
    const parts = (h: Element): string[] => {
      const out: string[] = [];
      for (let n = h.nextElementSibling; n !== null; n = n.nextElementSibling) {
        if (!n.classList.contains('task-part')) {
          if (n.hasAttribute(CHROME_ATTR)) continue;
          break;
        }
        out.push(n.localName);
      }
      return out;
    };
    expect(parts(heading(root, 'h3', 'Task 1'))).toEqual(['p', 'p', 'ul']);
    expect(parts(heading(root, 'h3', 'Task 2'))).toEqual(['p', 'ul', 'p', 'div']);
    expect(parts(heading(root, 'h3', 'Task P0-1'))).toEqual(['ul']);
    expect(parts(heading(root, 'h2', 'Task 3'))).toEqual(['p', 'ul']);
    expect(heading(root, 'h2', '1. Tasks').classList.contains('task-part')).toBe(false);
    expect(root.querySelector('p')?.classList.contains('task-part')).toBe(false);
    const boxed = mount(['# P', '', '## Task 1: A', '', 'Text.', '', '## In short', '', '- One.', '', 'After.', '', ...Array.from({ length: 20 }, (_, i) => `- [ ] Step ${String(i)}`), ''].join('\n'));
    await enhance(boxed);
    const box = boxed.querySelector('.short');
    expect(box?.classList.contains('task-part')).toBe(false);
    expect(heading(boxed, 'h2', 'Task 1').nextElementSibling?.classList.contains('task-part')).toBe(true);
    // An h3 task ends at that box too: it holds a heading above the task's level.
    const h3boxed = mount(['# P', '', '### Task 1: A', '', 'Text.', '', '## In short', '', '- One.', '', ...Array.from({ length: 20 }, (_, i) => `- [ ] Step ${String(i)}`), ''].join('\n'));
    await enhance(h3boxed);
    expect(h3boxed.querySelector('.short')?.classList.contains('task-part')).toBe(false);
    expect(heading(h3boxed, 'h3', 'Task 1').nextElementSibling?.classList.contains('task-part')).toBe(true);
  });

  it('every task gets a "Show all" button, before the heading\'s controls', async () => {
    const root = mount();
    // An earlier feature that made a task heading's controls already: the button goes before them.
    beforePlans((ctx) => {
      ctx.headCtl(heading(ctx.root, 'h3', 'Task 2.'), 'mark', chrome(ctx.root.ownerDocument, 'button', { className: 'h-mark', text: 'Mark read' }));
    });
    await enhance(root);
    for (const h of ctxOf(root).plan.tasks) {
      const btn = Array.from(h.children).find((c) => c.classList.contains('task-open')) as HTMLButtonElement | undefined;
      expect(btn?.hasAttribute(CHROME_ATTR)).toBe(true);
      expect([btn?.textContent, btn?.getAttribute('type'), btn?.getAttribute('aria-expanded')]).toEqual(['Show all', 'button', 'false']);
      const ctl = Array.from(h.children).find((c) => c.classList.contains('h-ctl'));
      if (ctl !== undefined) expect(btn?.nextElementSibling).toBe(ctl);
    }
    // The h2 task has its fold control: the button is before it.
    expect(heading(root, 'h2', 'Task 3').querySelector('.h-ctl')).not.toBeNull();
  });

  it('a stored outline is applied during the build, so the full plan is never shown first', async () => {
    const seen: [boolean, string | null | undefined][] = [];
    afterPlans((ctx) => {
      seen.push([ctx.root.classList.contains('outline'), ctx.slots?.tools.querySelector('.outline-btn')?.getAttribute('aria-pressed')]);
    });
    const root = mount();
    const { storage, sets } = storageWith('true');
    await enhance(root, { storage, storageKey: 'k' });
    // The tool is in the tray (the bar goes into the root once every feature is built), pressed already.
    expect(seen).toEqual([[true, 'true']]);
    expect(root.classList.contains('outline')).toBe(true);
    expect(toolOf(root)?.getAttribute('aria-pressed')).toBe('true');
    expect(sets).toEqual([]);
    // The stored outline is the one in force: o turns it off.
    key(document.body, 'o');
    expect(root.classList.contains('outline')).toBe(false);
    expect(sets).toEqual([[docKey('k', OUTLINE), null]]);
  });

  it('a stored value other than true is no outline, and a short plan never reads the key', async () => {
    for (const stored of ['false', '"true"', '1', '{}', 'null', '[true]', 'not json']) {
      const root = mount();
      await enhance(root, { storage: storageWith(stored).storage, storageKey: 'k' });
      expect([stored, root.classList.contains('outline')]).toEqual([stored, false]);
      expect([stored, toolOf(root)?.getAttribute('aria-pressed')]).toEqual([stored, 'false']);
      await destroyEnhancement(root);
    }
    let reads = 0;
    const snapshot = {
      get [docKey('k', OUTLINE)]() {
        reads += 1;
        return 'true';
      },
    };
    const short = mount(stepsDoc(19));
    await enhance(short, { storage: { snapshot }, storageKey: 'k' });
    expect(short.classList.contains('outline')).toBe(false);
    expect(reads).toBe(0);
    const long = mount(stepsDoc(20));
    await enhance(long, { storage: { snapshot }, storageKey: 'k' });
    expect(long.classList.contains('outline')).toBe(true);
    expect(reads).toBe(1);
  });

  it('o and the Outline button turn the outline on and off; each change is written behind and asks for a relayout', async () => {
    const root = mount();
    const { storage, sets } = storageWith(undefined);
    await enhance(root, { storage, storageKey: 'k' });
    const ctx = ctxOf(root);
    const runs: RelayoutReason[][] = [];
    ctx.onRelayout((reasons) => {
      runs.push([...reasons]);
    });
    await wait(60); // the start run has gone
    runs.length = 0;
    const tool = toolOf(root);
    expect([tool?.textContent, tool?.getAttribute('type'), tool?.getAttribute('aria-pressed'), tool?.getAttribute('title')]).toEqual([
      'Outline',
      'button',
      'false',
      'Show each task as its step titles (o)',
    ]);
    const e = key(document.body, 'o');
    expect(e.defaultPrevented).toBe(true);
    expect(root.classList.contains('outline')).toBe(true);
    expect(tool?.getAttribute('aria-pressed')).toBe('true');
    expect(sets).toEqual([[docKey('k', OUTLINE), 'true']]);
    await wait(60);
    expect(runs).toEqual([['outline']]);
    click(tool as Element);
    expect(root.classList.contains('outline')).toBe(false);
    expect(tool?.getAttribute('aria-pressed')).toBe('false');
    expect(sets).toEqual([
      [docKey('k', OUTLINE), 'true'],
      [docKey('k', OUTLINE), null],
    ]);
    await wait(60);
    expect(runs).toEqual([['outline'], ['outline']]);
  });

  it('turning the outline on or off keeps the reader\'s place: the root\'s class changes inside position.keep', async () => {
    const root = mount();
    await enhance(root);
    hooks.watch = true;
    key(document.body, 'o');
    expect(hooks.kept).toContainEqual([0, 1]);
    hooks.kept.length = 0;
    key(document.body, 'o');
    expect(hooks.kept).toContainEqual([1, 0]);
    expect(root.classList.contains('outline')).toBe(false);
  });

  it('without the bar there is no tool, and o still works; with keyboard false, o does nothing and the tool says no key', async () => {
    const bare = mount();
    await enhance(bare, { chrome: { bar: false } });
    expect(bare.querySelector('.outline-btn')).toBeNull();
    key(document.body, 'o');
    expect(bare.classList.contains('outline')).toBe(true);
    await destroyEnhancement(bare);
    const quiet = mount();
    await enhance(quiet, { keyboard: false });
    key(document.body, 'o');
    expect(quiet.classList.contains('outline')).toBe(false);
    expect(toolOf(quiet)?.getAttribute('title')).toBe('Show each task as its step titles');
    click(toolOf(quiet) as Element);
    expect(quiet.classList.contains('outline')).toBe(true);
  });

  it('"Show all" opens one task in the outline, its parts with it; turning the outline off closes every task', async () => {
    const root = mount();
    await enhance(root);
    const t1 = heading(root, 'h3', 'Task 1');
    const t2 = heading(root, 'h3', 'Task 2');
    const btn = t1.querySelector('.task-open') as HTMLButtonElement;
    key(document.body, 'o');
    click(btn);
    expect(t1.classList.contains('t-open')).toBe(true);
    expect([btn.textContent, btn.getAttribute('aria-expanded')]).toEqual(['Outline', 'true']);
    const opened = Array.from(root.querySelectorAll('.t-open')).filter((n) => n !== t1);
    expect(opened.map((n) => n.localName)).toEqual(['p', 'p', 'ul']);
    expect(opened.every((n) => n.classList.contains('task-part'))).toBe(true);
    expect(t2.classList.contains('t-open')).toBe(false);
    click(btn);
    expect(root.querySelector('.t-open')).toBeNull();
    expect([btn.textContent, btn.getAttribute('aria-expanded')]).toEqual(['Show all', 'false']);
    click(btn);
    click(t2.querySelector('.task-open') as Element);
    expect(root.querySelectorAll('h3.t-open')).toHaveLength(2);
    key(document.body, 'o');
    expect(root.classList.contains('outline')).toBe(false);
    expect(root.querySelector('.t-open')).toBeNull();
    expect(Array.from(root.querySelectorAll('.task-open')).map((b) => [b.textContent, b.getAttribute('aria-expanded')])).toEqual(
      Array.from({ length: 4 }, () => ['Show all', 'false']),
    );
  });

  it('reveal opens the task that holds its target, in the outline only, and leaves the others closed', async () => {
    const root = mount();
    await enhance(root);
    const ctx = ctxOf(root);
    const t2 = heading(root, 'h3', 'Task 2');
    const cell = Array.from(root.querySelectorAll('td')).find((c) => c.textContent === 'Lexer') as Element;
    ctx.reveal(cell);
    expect(t2.classList.contains('t-open')).toBe(false); // not in the outline: nothing is collapsed
    key(document.body, 'o');
    ctx.reveal(t2); // the heading is shown in the outline already
    expect(t2.classList.contains('t-open')).toBe(false);
    ctx.reveal(cell);
    expect(t2.classList.contains('t-open')).toBe(true);
    expect(t2.querySelector('.task-open')?.getAttribute('aria-expanded')).toBe('true');
    expect(Array.from(root.querySelectorAll('h3.t-open, h2.t-open'))).toEqual([t2]);
    // nav.goTo reveals too.
    const t1 = heading(root, 'h3', 'Task 1');
    ctx.nav.goTo(step(root, 'Make the folder').querySelector('.step-rest') as Element, { focus: false });
    expect(t1.classList.contains('t-open')).toBe(true);
  });

  it('revealing what an open task holds changes nothing and measures nothing again', async () => {
    const root = mount();
    await enhance(root);
    const ctx = ctxOf(root);
    const runs: RelayoutReason[][] = [];
    ctx.onRelayout((reasons) => {
      runs.push([...reasons]);
    });
    key(document.body, 'o');
    await wait(60);
    runs.length = 0;
    const t2 = heading(root, 'h3', 'Task 2');
    click(t2.querySelector('.task-open') as Element);
    await wait(60);
    expect(runs).toEqual([['outline']]); // showing a task whole moves what follows it
    runs.length = 0;
    ctx.reveal(Array.from(root.querySelectorAll('td')).find((c) => c.textContent === 'Lexer') as Element);
    await wait(60);
    expect(runs).toEqual([]);
    expect(t2.classList.contains('t-open')).toBe(true);
  });

  it('a part belongs to its innermost task, and two tasks with the same number are told apart', async () => {
    const root = mount(
      [
        '# P',
        '',
        '## Task 1: Outer',
        '',
        'Outer text.',
        '',
        '### Task 1: Inner',
        '',
        'Inner text.',
        '',
        ...Array.from({ length: 20 }, (_, i) => `- [ ] **Step ${String(i + 1)}: S${String(i + 1)}**`),
        '',
      ].join('\n'),
    );
    await enhance(root);
    const outer = heading(root, 'h2', 'Task 1');
    const inner = heading(root, 'h3', 'Task 1');
    key(document.body, 'o');
    click(inner.querySelector('.task-open') as Element);
    expect(Array.from(root.querySelectorAll('.t-open')).map((n) => n.localName)).toEqual(['h3', 'p', 'ul']);
    expect(outer.classList.contains('t-open')).toBe(false);
    click(inner.querySelector('.task-open') as Element);
    click(outer.querySelector('.task-open') as Element);
    // The outer task's own parts: its text and the inner heading (the inner task's parts are the inner task's).
    expect(Array.from(root.querySelectorAll('.t-open')).map((n) => n.localName)).toEqual(['h2', 'p', 'h3']);
    expect(inner.classList.contains('task-part')).toBe(true);
  });

  it('a key on another root\'s element toggles that root only (RF2)', async () => {
    const a = mount();
    const b = mount();
    await enhance(a);
    await enhance(b);
    key(heading(b, 'h3', 'Task 1'), 'o');
    expect([a.classList.contains('outline'), b.classList.contains('outline')]).toEqual([false, true]);
    key(document.body, 'o'); // two live roots: a key on the page goes to neither
    expect([a.classList.contains('outline'), b.classList.contains('outline')]).toEqual([false, true]);
  });
});

describe('teardown, names and safety', () => {
  it('destroy restores the document byte for byte, after the outline was used', async () => {
    const root = mount();
    const html = root.innerHTML;
    const { storage } = storageWith('true');
    await enhance(root, { storage, storageKey: 'k' });
    click(heading(root, 'h3', 'Task 2').querySelector('.task-open') as Element);
    key(document.body, 'o');
    key(document.body, 'o');
    click(heading(root, 'h2', 'Task 3').querySelector('.task-open') as Element);
    await destroyEnhancement(root);
    expect(root.innerHTML).toBe(html);
    expect(root.getAttribute('class')).toBeNull();
  });

  it('the "Show all" button is never in a heading\'s name, nor in its fold\'s', async () => {
    const root = mount();
    await enhance(root);
    const h2 = heading(root, 'h2', 'Task 3');
    const fold = h2.querySelector('.h-fold');
    const names = (): (string | null | undefined)[] => [h2.getAttribute('aria-label'), fold?.getAttribute('aria-label'), heading(root, 'h3', 'Task 1').getAttribute('aria-label')];
    const want = ['Task 3: Ship it', 'Fold or unfold: Ship it', 'Task 1: Set up the project'];
    expect(names()).toEqual(want);
    key(document.body, 'o');
    click(h2.querySelector('.task-open') as Element);
    expect(names()).toEqual(want);
    const note = h2.nextElementSibling;
    expect([note?.className, note?.getAttribute('aria-label')]).toEqual(['fold-note', 'Unfold: Ship it']);
  });

  it('a destroy from the host\'s set() while the outline changes: nothing is written after it, and the root is restored', async () => {
    const root = mount();
    const html = root.innerHTML;
    let destroyed: Promise<void> | null = null;
    await enhance(root, {
      storageKey: 'k',
      storage: {
        set: () => {
          destroyed = destroyEnhancement(root);
        },
      },
    });
    const tool = toolOf(root) as HTMLButtonElement;
    const t1 = heading(root, 'h3', 'Task 1');
    const open = t1.querySelector('.task-open') as HTMLButtonElement;
    key(document.body, 'o');
    expect(destroyed).not.toBeNull();
    await destroyed;
    expect(root.innerHTML).toBe(html);
    expect(tool.getAttribute('aria-pressed')).toBe('false');
    expect(open.getAttribute('aria-expanded')).toBe('false');
  });

  it('without storage the outline is kept for the visit only, as local state', async () => {
    const root = mount();
    const opts: EnhanceOptions = { storageKey: 'k' };
    await enhance(root, opts);
    key(document.body, 'o');
    expect(ctxOf(root).state.readDoc(OUTLINE)).toBe(true);
    key(document.body, 'o');
    expect(ctxOf(root).state.readDoc(OUTLINE)).toBeNull();
  });
});

describe('RF3: the large plan', () => {
  /** Plans' build and an outline toggle (on, then off) on the large plan at `scale`, each the best of `runs`. */
  async function cost(scale: number, runs: number): Promise<{ build: number; toggle: number; steps: number }> {
    const root = mount(largePlan(scale).markdown);
    let build = Infinity;
    let toggle = Infinity;
    let steps = 0;
    for (let i = 0; i < runs; i += 1) {
      hooks.timed = [];
      await enhance(root);
      build = Math.min(build, hooks.timed[0] ?? Infinity);
      steps = ctxOf(root).plan.steps.length;
      const t0 = performance.now();
      key(document.body, 'o');
      key(document.body, 'o');
      toggle = Math.min(toggle, performance.now() - t0);
      await destroyEnhancement(root);
    }
    hooks.timed = null;
    root.remove();
    return { build, toggle, steps };
  }

  it('the build and an outline toggle stay within a measured budget, and a 2× plan takes at most 2.5× the time', async () => {
    const one = await cost(1, 3);
    const two = await cost(2, 3);
    expect([one.steps, two.steps]).toEqual([1000, 2000]);
    // Measured in jsdom on a loaded box (load average 18), best of three: the build about 330 ms at scale 1 and 670 ms
    // at scale 2, a toggle about 1 ms and 2 ms. The budgets leave room for a slower machine; the ratio is what catches
    // a cost that grows faster than the plan. A toggle is too quick to time closely, so its ratio has a 5 ms floor.
    expect(one.build).toBeLessThan(1500);
    expect(one.toggle).toBeLessThan(50);
    expect(two.build).toBeLessThanOrEqual(2.5 * one.build);
    expect(two.toggle).toBeLessThanOrEqual(Math.max(2.5 * one.toggle, 5));
  }, 600_000);
});
