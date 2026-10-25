// @vitest-environment jsdom
// Stored read marks (docserver L2, Task 18): bounded, source-only and root-isolated.
import { afterEach, describe, expect, it } from 'vitest';
import { contextOf } from '../src/enhance/lifecycle.js';
import { destroyEnhancement, enhance, type ReaderStorage } from '../src/enhance/index.js';
import { docKey } from '../src/enhance/state.js';
import { hash } from '../src/enhance/text.js';
import { render } from '../src/render/index.js';

const DOC = [
  '# Reader example',
  '',
  '## In short',
  '',
  'The first summary.',
  '',
  '## 1. Context',
  '',
  'The first section.',
  '',
  '## 2. Design',
  '',
  'The second section.',
  '',
  '## 3. Notes',
  '',
  'The third section.',
].join('\n');

const LONG_PLAN = [
  '# Plan',
  '',
  '## Tasks',
  '',
  ...Array.from({ length: 4 }, (_, task) => [
    `### Task ${String(task + 1)}: Store read marks`,
    '',
    ...Array.from({ length: 5 }, (_, step) => `- [ ] Step ${String(task * 5 + step + 1)}: Keep source fingerprints stable.`),
    '',
  ]).flat(),
].join('\n');

const SHORT_TASK_PLAN = [
  '# Plan',
  '',
  '## In short',
  '',
  'Summary.',
  '',
  '## 1. Tasks',
  '',
  '### Task 1: Small task',
  '',
  '- [ ] One step.',
  '',
  '## 2. Other tasks',
  '',
  '### Task 2: Other task',
  '',
  '- [ ] Second step.',
].join('\n');

const MIXED_LONG_PLAN = [
  '# Plan',
  '',
  '## In short',
  '',
  'Summary.',
  '',
  '## 1. Context',
  '',
  'Context text.',
  '',
  '## 2. Tasks',
  '',
  ...Array.from({ length: 4 }, (_, task) => [
    `### Task ${String(task + 1)}: Store read marks`,
    '',
    ...Array.from({ length: 5 }, (_, step) => `- [ ] Step ${String(task * 5 + step + 1)}: Keep source fingerprints stable.`),
    '',
  ]).flat(),
  '## 3. Notes',
  '',
  'Notes text.',
].join('\n');

const mounted: HTMLElement[] = [];
const MARKS_KEY = docKey('case', 'marks');
const HASH_BOUND = (0xffff_ffff).toString(36).length; // text.ts hashes a uint32 then encodes it in base 36.

function mount(md = DOC): HTMLElement {
  const parsed = new DOMParser().parseFromString(`<!doctype html><body>${render(md).html}`, 'text/html');
  const root = document.createElement('main');
  root.append(...Array.from(parsed.body.childNodes).map((node) => document.importNode(node, true)));
  document.body.append(root);
  mounted.push(root);
  return root;
}

function control(root: Element, id: string): HTMLButtonElement {
  const heading = Array.from(root.querySelectorAll('h2, h3')).find((node) => node.id === id);
  if (heading === undefined) throw new Error(`no heading ${id}`);
  const mark = heading.querySelector('.h-mark');
  if (!(mark instanceof HTMLButtonElement)) throw new Error(`no mark for ${id}`);
  return mark;
}

function store(snapshot: Record<string, string> = {}): { readonly storage: ReaderStorage; readonly writes: [string, string | null][] } {
  const writes: [string, string | null][] = [];
  return { storage: { snapshot, set: (key, value) => { writes.push([key, value]); } }, writes };
}

function remove(root: HTMLElement): void {
  const at = mounted.indexOf(root);
  if (at >= 0) mounted.splice(at, 1);
  root.remove();
}

function key(target: EventTarget, name: string): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
}

afterEach(async () => {
  for (const root of mounted.splice(0)) await destroyEnhancement(root).catch(() => undefined);
  document.body.replaceChildren();
});

describe('stored marks', () => {
  it('keeps section marks when short task plans do not take outline mode', async () => {
    const root = mount(SHORT_TASK_PLAN);
    await enhance(root, { storageKey: 'case' });

    expect(root.querySelectorAll('h2 .h-mark')).toHaveLength(2);
    expect(root.querySelectorAll('h3 .h-mark')).toHaveLength(0);
  });

  it('keeps non-holder sections alongside task marks on a long plan', async () => {
    const root = mount(MIXED_LONG_PLAN);
    await enhance(root, { storageKey: 'case' });

    expect(root.querySelectorAll('h2 .h-mark')).toHaveLength(2);
    expect(root.querySelectorAll('h3 .h-mark')).toHaveLength(4);
  });

  it('keeps an h2 task as one task mark rather than taking the mark slot twice', async () => {
    const root = mount([
      '# Plan',
      '',
      ...Array.from({ length: 2 }, (_, task) => [
        `## Task ${String(task + 1)}: Part ${String(task + 1)}`,
        '',
        ...Array.from({ length: 10 }, (_, step) => `- [ ] Step ${String(task * 10 + step + 1)}.`),
        '',
      ]).flat(),
      '## Notes',
      '',
      'Notes.',
    ].join('\n'));
    await enhance(root, { storageKey: 'case' });

    expect(root.querySelectorAll('h2 .h-mark')).toHaveLength(3);
  });

  it('does not let a host short class suppress marks inside its root', async () => {
    const root = mount();
    const host = document.createElement('div');
    host.className = 'short';
    root.before(host);
    host.append(root);

    await enhance(root, { storageKey: 'case' });

    expect(root.querySelectorAll('.h-mark')).toHaveLength(3);
  });

  it('starts each section as read, changed or unread from its own source fingerprint', async () => {
    const root = mount();
    const snapshot = {
      [MARKS_KEY]: JSON.stringify({
        '1-context': hash('1. Context\u0001The first section.'),
        '2-design': 'old',
      }),
    };

    await enhance(root, { storageKey: 'case', storage: { snapshot } });

    expect([control(root, '1-context').textContent, control(root, '2-design').textContent, control(root, '3-notes').textContent]).toEqual([
      'Read',
      'Changed since you read it',
      'Mark read',
    ]);
  });

  it.each([
    ['null', 'null'],
    ['array', '[]'],
    ['boolean', 'true'],
    ['number', '7'],
    ['string', '"not a record"'],
    ['invalid record value', '{"1-context":7}'],
    ['record-shaped fingerprint', '{"1-context":{"length":1}}'],
  ])('ignores a %s marks value', async (_name, raw) => {
    const root = mount();
    await enhance(root, { storageKey: 'case', storage: { snapshot: { [MARKS_KEY]: raw } } });

    expect(control(root, '1-context').textContent).toBe('Mark read');
  });

  it('rejects restored records with more entries than its measured units', async () => {
    const root = mount();
    const entries = {
      '1-context': 'old',
      ...Object.fromEntries(Array.from({ length: 3 }, (_, at) => [`unknown-${String(at)}`, 'old'])),
    };
    await enhance(root, { storageKey: 'case', storage: { snapshot: { [MARKS_KEY]: JSON.stringify(entries) } } });

    expect(control(root, '1-context').textContent).toBe('Mark read');
  });

  it('prunes unknown ids, selector-shaped ids and values wider than the FNV hash on write', async () => {
    const root = mount();
    const { storage, writes } = store({
      [MARKS_KEY]: JSON.stringify({
        '1-context': 'x'.repeat(HASH_BOUND + 1),
        '2-design': 'old',
        'bad"] [data-x="injected': 'old',
      }),
    });

    await enhance(root, { storageKey: 'case', storage });
    expect(control(root, '1-context').textContent).toBe('Mark read');
    expect(control(root, '2-design').textContent).toBe('Changed since you read it');

    control(root, '1-context').click();

    const persisted = JSON.parse(writes.at(-1)?.[1] ?? '{}') as Record<string, string>;
    expect(Object.keys(persisted).sort()).toEqual(['1-context', '2-design']);
    expect(persisted['1-context']?.length).toBeLessThanOrEqual(HASH_BOUND);
  });

  it('round-trips own __proto__ and constructor ids without changing a prototype or interpolating ids', async () => {
    const root = mount();
    const headings = Array.from(root.querySelectorAll('h2')) as HTMLElement[];
    headings.find((heading) => heading.id === '1-context')!.id = '__proto__';
    headings.find((heading) => heading.id === '2-design')!.id = 'constructor';
    const stored = Object.create(null) as Record<string, string>;
    stored.__proto__ = 'old';
    stored['constructor'] = 'old';
    stored['bad"] [data-x="injected'] = 'old';
    const { storage, writes } = store({ [MARKS_KEY]: JSON.stringify(stored) });

    await enhance(root, { storageKey: 'case', storage });
    control(root, '__proto__').click();
    control(root, 'constructor').click();

    const persisted = JSON.parse(writes.at(-1)?.[1] ?? '{}') as Record<string, string>;
    expect(Object.keys(persisted).sort()).toEqual(['__proto__', 'constructor']);
    expect(Object.hasOwn(persisted, '__proto__')).toBe(true);
    expect(Object.hasOwn(persisted, 'constructor')).toBe(true);
    expect(({} as Record<string, unknown>).injected).toBeUndefined();
  });

  it('writes the measured source fingerprint, not text inserted as heading chrome', async () => {
    const root = mount();
    const { storage, writes } = store();
    await enhance(root, { storageKey: 'case', storage });

    control(root, '1-context').click();

    const persisted = JSON.parse(writes.at(-1)?.[1] ?? '{}') as Record<string, string>;
    expect(persisted['1-context']).toBe(hash('1. Context\u0001The first section.'));
    expect(control(root, '1-context').parentElement?.textContent).toContain('Read');
  });

  it('deletes stored marks with null after toggling the last mark off', async () => {
    const root = mount();
    const { storage, writes } = store();
    await enhance(root, { storageKey: 'case', storage });

    control(root, '1-context').click();
    control(root, '1-context').click();

    expect(writes.at(-1)).toEqual([MARKS_KEY, null]);
  });

  it('does not refresh a mark after its synchronous storage write destroys the enhancement', async () => {
    const root = mount();
    let teardown: Promise<void> | undefined;
    await enhance(root, {
      storageKey: 'case',
      storage: {
        snapshot: {},
        set: () => { teardown = destroyEnhancement(root); },
      },
    });
    const mark = control(root, '1-context');

    mark.click();

    expect(mark.textContent).toBe('Mark read');
    await teardown;
  });

  it('routes m only to the current marked spy unit', async () => {
    const root = mount();
    await enhance(root, { storageKey: 'case' });
    const ctx = contextOf(root);
    if (ctx === undefined) throw new Error('missing context');
    const first = control(root, '1-context');
    const second = control(root, '2-design');

    ctx.events.emit('spy', Object.freeze({ section: null, unit: second.closest('h2, h3') as HTMLElement }));
    const event = key(root, 'm');

    expect([first.textContent, second.textContent, event.defaultPrevented]).toEqual(['Mark read', 'Read', true]);
  });

  it('keeps a long-plan task read across reloads despite the plan chrome it inserts', async () => {
    const first = mount(LONG_PLAN);
    const seed = store();
    await enhance(first, { storageKey: 'case', storage: seed.storage });
    const task = first.querySelector('h3') as HTMLElement;
    control(first, task.id).click();
    const snapshot = { [MARKS_KEY]: seed.writes.at(-1)?.[1] ?? '{}' };
    await destroyEnhancement(first);
    remove(first);

    const second = mount(LONG_PLAN);
    await enhance(second, { storageKey: 'case', storage: { snapshot } });

    expect(control(second, task.id).textContent).toBe('Read');
  });

  it('keeps two roots and their mark records separate, and cannot write after destroy', async () => {
    const first = mount();
    const second = mount();
    const { storage, writes } = store();
    await enhance(first, { storageKey: 'first', storage });
    await enhance(second, { storageKey: 'second', storage });
    control(first, '1-context').click();
    control(second, '2-design').click();
    expect(writes.map(([key]) => key)).toEqual([docKey('first', 'marks'), docKey('second', 'marks')]);

    const detached = control(first, '1-context');
    await destroyEnhancement(first);
    detached.click();
    expect(writes).toHaveLength(2);
  });
});
