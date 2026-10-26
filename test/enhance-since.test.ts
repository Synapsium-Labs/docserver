// @vitest-environment jsdom
// The "Changes since" menu and day view (docserver L2, Task 22): local-day groups, last-visit state,
// root-local menus and the one-day version banner. The since-unit Vitest project pins Asia/Kolkata, so the two
// UTC times below prove the grouping uses the local civil day rather than UTC.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { destroyEnhancement, enhance, type EnhanceOptions } from '../src/enhance/index.js';
import { CHROME_ATTR } from '../src/enhance/journal.js';
import { contextOf } from '../src/enhance/lifecycle.js';
import { reviewStrip } from '../src/enhance/strip.js';
import { docKey } from '../src/enhance/state.js';
import type { FeatureContext } from '../src/enhance/types.js';
import { render } from '../src/render/index.js';

const SHA = 'abcdef1';
const OLDER = '1234567';
const OLDEST = '2345678';

const DOC = [
  '# Changes since sample',
  '',
  '**Spec** · 2026-10-24 · Status: Draft',
  '',
  '## 1. Scope',
  '',
  'Scope text.',
  '',
  '## 2. Design',
  '',
  'Design text.',
  '',
  '## 3. Plan',
  '',
  'Plan text.',
].join('\n');

const mounted: HTMLElement[] = [];

function mount(md = DOC): HTMLElement {
  const parsed = new DOMParser().parseFromString(`<!doctype html><body>${render(md).html}`, 'text/html');
  const root = document.createElement('main');
  root.append(...Array.from(parsed.body.childNodes).map((n) => document.importNode(n, true)));
  document.body.append(root);
  mounted.push(root);
  return root;
}

function commits(): NonNullable<EnhanceOptions['info']> {
  return {
    sha: SHA,
    commits: [
      { sha: SHA, subject: 'feat: newer change', date: '2026-01-01T18:45:00Z', parents: [OLDER] },
      { sha: OLDER, subject: 'fix: older change', date: '2026-01-01T18:15:00Z', parents: [OLDEST] },
    ],
  };
}

function key(target: EventTarget, value: string): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
}

function ctxOf(root: HTMLElement): FeatureContext {
  const ctx = contextOf(root);
  if (ctx === undefined) throw new Error('no context');
  return ctx;
}

async function flush(): Promise<void> {
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
}

afterEach(async () => {
  for (const root of mounted.splice(0)) await destroyEnhancement(root).catch(() => undefined);
  document.body.replaceChildren();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('Changes since', () => {
  it('reads only normalized commits and keeps hostile source sizes out of the rendered menu', async () => {
    const root = mount();
    let beyondCapDescriptors = 0;
    const hostile = new Array<{ sha: string; subject: string; date: string; parents: string[] }>(100_001);
    for (let index = 0; index < 100; index += 1) {
      hostile[index] = { sha: `a${String(index).padStart(6, '0')}`, subject: index === 0 ? 'x'.repeat(1_000_000) : 'feat: kept', date: '2026-01-01T18:15:00Z', parents: [OLDER] };
    }
    hostile[0] = { sha: SHA, subject: 'feat: one', date: '2026-01-01T18:45:00Z', parents: [OLDER] };
    hostile[1] = { sha: OLDER, subject: 'fix: two', date: '2026-01-01T18:15:00Z', parents: [OLDEST] };
    hostile[2] = { sha: 'a000002', subject: 'x'.repeat(1_000_000), date: '2026-01-01T18:15:00Z', parents: [OLDEST] };
    hostile[100] = { sha: 'a000100', subject: 'feat: beyond cap', date: '2026-01-01T18:15:00Z', parents: [OLDEST] };
    const observed = new Proxy(hostile, {
      getOwnPropertyDescriptor(target, key) {
        if (key === '100') beyondCapDescriptors += 1;
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
    });
    await enhance(root, { info: { sha: SHA, commits: observed }, changes: () => Promise.resolve({ changed: [] }) });
    (root.querySelector('.chg-trig') as HTMLButtonElement).click();
    const snippets = Array.from(root.querySelectorAll('.cm-st'));
    expect([beyondCapDescriptors, snippets.length > 0, snippets.every((el) => (el.textContent ?? '').length <= 90)]).toEqual([0, true, true]);
  });

  it('groups two UTC dates on opposite sides of local midnight into two civil-day rows', async () => {
    vi.setSystemTime(new Date('2026-01-03T12:00:00Z'));
    const root = mount();
    await enhance(root, { info: commits(), changes: () => Promise.resolve({ changed: [] }) });
    const trigger = root.querySelector('.chg-trig') as HTMLButtonElement;
    trigger.click();
    const labels = Array.from(root.querySelectorAll('.cm-days .cm-t')).map((el) => el.textContent);
    expect(labels).toEqual(['Since Fri 2 Jan', 'Since Thu 1 Jan']);
  });

  it('omits merge commits from quick-range counts as well as day groups', async () => {
    vi.setSystemTime(new Date('2026-01-02T20:00:00Z'));
    const root = mount();
    await enhance(root, {
      info: {
        sha: SHA,
        commits: [
          { sha: SHA, subject: 'feat: current', date: '2026-01-02T18:45:00Z', parents: [OLDER] },
          { sha: '3456789', subject: 'Merge branch', date: '2026-01-02T18:30:00Z', parents: [OLDER] },
          { sha: OLDER, subject: 'fix: older', date: '2026-01-01T18:15:00Z', parents: [OLDEST] },
        ],
      },
      changes: () => Promise.resolve({ changed: [] }),
    });
    (root.querySelector('.chg-trig') as HTMLButtonElement).click();
    expect(Array.from(root.querySelectorAll('.cm-days .cm-st')).map((el) => el.textContent)).toEqual(['current', 'older']);
    expect(Array.from(root.querySelectorAll('.cm-group[aria-label="Quick ranges"] .cm-n')).map((el) => el.textContent)).toEqual(['1 change', '2 changes']);
    expect(root.textContent).not.toContain('Merge branch');
  });

  it('omits an empty Today range while retaining a positive seven-day range', async () => {
    vi.setSystemTime(new Date('2026-01-04T12:00:00Z'));
    const root = mount();
    await enhance(root, { info: commits(), changes: () => Promise.resolve({ changed: [] }) });
    (root.querySelector('.chg-trig') as HTMLButtonElement).click();
    const quick = Array.from(root.querySelectorAll('.cm-group[aria-label="Quick ranges"] [role="menuitemradio"]'));
    expect(quick.map((item) => [item.getAttribute('data-key'), item.querySelector('.cm-n')?.textContent])).toEqual([
      ['d7', '2 changes'],
    ]);
  });

  it('offers only-day actions only where a day has a valid older base', async () => {
    vi.setSystemTime(new Date('2026-01-03T12:00:00Z'));
    const root = mount();
    await enhance(root, {
      info: {
        sha: SHA,
        commits: [
          { sha: SHA, subject: 'feat: newest', date: '2026-01-01T18:45:00Z', parents: [OLDER] },
          { sha: OLDER, subject: 'fix: middle', date: '2025-12-31T18:15:00Z', parents: [OLDEST] },
          { sha: OLDEST, subject: 'fix: oldest', date: '2025-12-30T18:15:00Z', parents: [] },
        ],
      },
      changes: () => Promise.resolve({ changed: [] }),
      openVersion: () => undefined,
    });
    (root.querySelector('.chg-trig') as HTMLButtonElement).click();
    const days = Array.from(root.querySelectorAll('.cm-days .cm-row'));
    expect(days.map((day) => [day.querySelector('.cm-t')?.textContent, day.querySelector('.cm-only')?.textContent ?? null])).toEqual([
      ['Since Fri 2 Jan', 'Only this day'],
      ['Since Wed 31 Dec 2025', 'Only this day'],
      [undefined, null],
    ]);
  });

  it('gives the root-local menu a generated id declared by its trigger', async () => {
    const root = mount();
    await enhance(root, { info: commits(), changes: () => Promise.resolve({ changed: [] }) });
    const trigger = root.querySelector('.chg-trig') as HTMLButtonElement;
    const menu = root.querySelector('.chg-menu') as HTMLElement;
    expect([trigger.getAttribute('aria-controls'), menu.id]).toEqual([menu.id, expect.stringMatching(/^docreader\./)]);
  });

  it('builds roving day actions and sends exact only-day and latest-version host payloads', async () => {
    const root = mount();
    const opened: unknown[] = [];
    await enhance(root, {
      info: commits(),
      changes: () => Promise.resolve({ changed: [] }),
      openVersion: (value) => void opened.push(value),
    });
    const trigger = root.querySelector('.chg-trig') as HTMLButtonElement;
    trigger.click();
    const first = root.querySelector('.cm-row .cm-item') as HTMLButtonElement;
    expect(first.tabIndex).toBe(0);
    expect(root.querySelector('.cm-row .cm-only')?.textContent).toBe('Only this day');
    key(first, 'ArrowRight');
    const only = root.querySelector('.cm-row .cm-only') as HTMLButtonElement;
    expect(document.activeElement).toBe(only);
    only.click();
    expect(opened).toEqual([{ sha: SHA, only: OLDER }]);

    await destroyEnhancement(root);
    const dayRoot = mount();
    await enhance(dayRoot, {
      info: { ...commits(), only: OLDER },
      changes: () => Promise.resolve({ changed: [] }),
      openVersion: (value) => void opened.push(value),
    });
    expect(dayRoot.classList.contains('ver-on')).toBe(true);
    await flush();
    expect((dayRoot.querySelector('.ver-show') as HTMLButtonElement).hidden).toBe(true);
    const back = dayRoot.querySelector('.ver-banner button:last-child') as HTMLButtonElement;
    back.click();
    expect(opened).toEqual([{ sha: SHA, only: OLDER }, { sha: null, only: null }]);
  });

  it('adds the measured last visit before quick ranges without duplicating its range', async () => {
    const root = mount();
    await enhance(root, {
      info: commits(),
      storage: { snapshot: { [docKey('doc', 'seen')]: JSON.stringify({ sha: OLDER, at: 0 }) } },
      storageKey: 'doc',
      changes: () => Promise.resolve({ changed: [[1, 1]] }),
    });
    await flush();
    (root.querySelector('.chg-trig') as HTMLButtonElement).click();
    expect(Array.from(root.querySelectorAll('.cm-group[aria-label="Quick ranges"] .cm-t')).map((el) => el.textContent)).toEqual(['Since your last visit']);
  });

  it('clears a selected menu action when its comparison is unavailable', async () => {
    const root = mount();
    await enhance(root, { info: commits(), changes: () => Promise.resolve(null) });
    (root.querySelector('.chg-trig') as HTMLButtonElement).click();
    (root.querySelector('.cm-row .cm-item') as HTMLButtonElement).click();
    await flush();
    expect(root.querySelector('.chg-trig')?.classList.contains('on')).toBe(false);
  });

  it('reads seen before the once-per-load write and adds a notice only after a real changed place', async () => {
    const root = mount();
    const calls: [string, string | null][] = [];
    const storage = {
      snapshot: { [docKey('doc', 'seen')]: JSON.stringify({ sha: OLDER, at: 0 }) },
      set: (name: string, value: string | null) => void calls.push([name, value]),
    };
    await enhance(root, {
      info: commits(),
      storage,
      storageKey: 'doc',
      changes: (base) => Promise.resolve(base === OLDER ? { changed: [[1, 1]] } : { changed: [] }),
    });
    await flush();
    expect(calls).toHaveLength(1);
    expect(calls[0]?.[0]).toBe(docKey('doc', 'seen'));
    expect(JSON.parse(calls[0]?.[1] ?? '{}')).toEqual({ sha: SHA, at: expect.any(Number) });
    const notice = root.querySelector('.rs-notice');
    expect(notice).not.toBeNull();
    expect(notice?.textContent).toContain('Changed since your last visit');
    expect(notice?.hasAttribute(CHROME_ATTR)).toBe(true);
  });

  it('keeps a detached strip facade for a document without initial facts, and clears it after destroy', async () => {
    const root = mount(['# Short', '', '## One', '', 'x', ''].join('\n'));
    await enhance(root, { info: { sha: SHA, commits: [{ sha: SHA, subject: 'feat: one', date: '2026-01-01T18:15:00Z', parents: [OLDER] }] } });
    const ctx = ctxOf(root);
    const strip = reviewStrip(ctx);
    expect([strip?.element.isConnected, strip?.tools.children.length]).toEqual([false, 0]);
    await destroyEnhancement(root);
    expect(reviewStrip(ctx)).toBeNull();
  });

  it('does not build host-only version controls without its host callback', async () => {
    const root = mount();
    await enhance(root, { info: commits(), changes: () => Promise.resolve({ changed: [] }) });
    (root.querySelector('.chg-trig') as HTMLButtonElement).click();
    expect(root.querySelector('.cm-only')).toBeNull();

    const dayRoot = mount();
    await enhance(dayRoot, { info: { ...commits(), only: OLDER }, changes: () => Promise.resolve({ changed: [] }) });
    expect(dayRoot.querySelector('.ver-back')).toBeNull();
  });

  it('keeps a newer selection when an older comparison resolves superseded', async () => {
    let first: (value: unknown) => void = () => undefined;
    let second: (value: unknown) => void = () => undefined;
    const one = new Promise<unknown>((resolve) => { first = resolve; });
    const two = new Promise<unknown>((resolve) => { second = resolve; });
    const root = mount();
    await enhance(root, {
      info: commits(),
      changes: (base) => base === OLDER ? one : two,
    });
    (root.querySelector('.chg-trig') as HTMLButtonElement).click();
    const items = Array.from(root.querySelectorAll('.cm-row .cm-item')) as HTMLButtonElement[];
    (items[0] as HTMLButtonElement).click();
    (root.querySelector('.chg-trig') as HTMLButtonElement).click();
    (items[1] as HTMLButtonElement).click();
    first({ changed: [[1, 1]] });
    await flush();
    expect(root.querySelector('.chg-trig')?.classList.contains('on')).toBe(true);
    second({ changed: [[1, 1]] });
    await flush();
  });

  it('keeps a selected comparison menu unchanged when its host reply arrives after destroy', async () => {
    let settle: (value: unknown) => void = () => undefined;
    const pending = new Promise<unknown>((resolve) => { settle = resolve; });
    const calls: string[] = [];
    const root = mount();
    await enhance(root, {
      info: commits(),
      changes: (base) => {
        calls.push(base);
        return pending;
      },
    });
    const trigger = root.querySelector('.chg-trig') as HTMLButtonElement;
    trigger.click();
    const menu = root.querySelector('.chg-menu') as HTMLElement;
    const action = root.querySelector('.cm-row .cm-item') as HTMLButtonElement;
    action.click();
    expect(calls).toEqual([OLDER]);
    await destroyEnhancement(root);
    expect([trigger.isConnected, menu.isConnected]).toEqual([false, false]);
    const before = [trigger.outerHTML, menu.outerHTML];
    settle({ changed: [[1, 1]] });
    await new Promise<void>((done) => setTimeout(done, 0));
    expect([trigger.outerHTML, menu.outerHTML].every((html, index) => html === before[index])).toBe(true);
  });

  it('does not write seen in the day view or after an asynchronous comparison settles after destroy', async () => {
    let reply: (value: unknown) => void = () => undefined;
    const pending = new Promise<unknown>((resolve) => {
      reply = resolve;
    });
    const root = mount();
    const writes: [string, string | null][] = [];
    await enhance(root, {
      info: commits(),
      storage: { set: (name, value) => void writes.push([name, value]) },
      storageKey: 'doc',
      changes: () => pending,
    });
    await flush();
    await destroyEnhancement(root);
    const writesAtDestroy = [...writes];
    reply({ changed: [[1, 1]] });
    await flush();
    expect([writes, root.querySelector('.rs-notice')]).toEqual([writesAtDestroy, null]);

    const dayRoot = mount();
    await enhance(dayRoot, {
      info: { ...commits(), only: OLDER },
      storage: { set: (name, value) => void writes.push([name, value]) },
      storageKey: 'day',
      changes: () => Promise.resolve({ changed: [] }),
    });
    await flush();
    expect(writes).toEqual(writesAtDestroy);
  });

  it('keeps the initial day comparison owned by the banner through show, hide, and show again', async () => {
    let settle: (value: unknown) => void = () => undefined;
    const pending = new Promise<unknown>((resolve) => { settle = resolve; });
    const calls: string[] = [];
    const root = mount();
    await enhance(root, {
      info: { ...commits(), only: OLDER },
      changes: (base) => {
        calls.push(base);
        return pending;
      },
    });
    expect(calls).toEqual([OLDER]);
    settle({ changed: [[1, 1]] });
    await flush();
    const show = root.querySelector('.ver-show') as HTMLButtonElement;
    expect(show.hidden).toBe(false);
    (root.querySelector('.chg-nav .hide') as HTMLButtonElement).click();
    show.click();
    await flush();
    expect(root.querySelector('.chg-nav')?.hasAttribute('hidden')).toBe(false);
  });

  it('places an initially factual strip once in a detached reader root', async () => {
    const root = mount([
      '# Detached', '', '**Spec** · 2026-10-24 · Status: Draft', '',
      '## 1. Scope', '', 'x', '', '## 2. Design', '', 'y', '',
      '## Where things stand', '', '### Waiting on you', '', '- Decide.', '',
    ].join('\n'));
    root.remove();
    await enhance(root, { info: commits(), changes: () => Promise.resolve({ changed: [] }) });
    const ctx = ctxOf(root);
    const strip = reviewStrip(ctx) as NonNullable<ReturnType<typeof reviewStrip>>;
    strip.place();
    strip.place();
    expect([strip.element.parentElement, root.querySelectorAll('section.review-strip').length]).toEqual([root, 1]);
  });

  it('keeps a valid empty-history day banner and its host action without writing seen', async () => {
    const opened: unknown[] = [];
    const writes: unknown[] = [];
    const root = mount();
    await enhance(root, {
      info: { sha: SHA, only: OLDER, commits: [] },
      storage: { set: (_key, value) => void writes.push(value) },
      storageKey: 'empty-day',
      changes: () => Promise.resolve({ changed: [] }),
      openVersion: (value) => void opened.push(value),
    });
    expect(root.classList.contains('ver-on')).toBe(true);
    (root.querySelector('.ver-back') as HTMLButtonElement).click();
    expect([opened, writes]).toEqual([[{ sha: null, only: null }], []]);
  });

  it('retains normal only-day actions but suppresses comparisons when the changes host is absent', async () => {
    const root = mount();
    const writes: [string, string | null][] = [];
    const opened: unknown[] = [];
    await enhance(root, {
      info: commits(),
      storage: { set: (name, value) => void writes.push([name, value]) },
      storageKey: 'without-changes',
      openVersion: (value) => void opened.push(value),
    });
    const trigger = root.querySelector('.chg-trig') as HTMLButtonElement;
    trigger.click();
    const summaries = Array.from(root.querySelectorAll('.cm-row .cm-item')) as HTMLElement[];
    const only = root.querySelector('.cm-only') as HTMLButtonElement;
    only.click();
    expect([
      writes,
      root.querySelectorAll('[role="menuitemradio"]').length,
      summaries.map((summary) => [summary.localName, summary.getAttribute('role'), summary.textContent]),
      opened,
    ]).toEqual([[
      [docKey('without-changes', 'seen'), expect.any(String)],
    ], 0, [
      ['span', null, 'Version of Fri 2 Jan'],
      ['span', null, 'Version of Thu 1 Jan'],
    ], [{ sha: SHA, only: OLDER }]]);

    const inert = mount();
    await enhance(inert, { info: commits() });
    expect(inert.querySelector('.chg-trig')).toBeNull();
  });

  it('adds the late last-visit picker for one current commit and describes an unseen prior SHA by timestamp', async () => {
    vi.setSystemTime(new Date('2026-01-03T12:00:00Z'));
    const root = mount();
    await enhance(root, {
      info: {
        sha: SHA,
        commits: [{ sha: SHA, subject: 'feat: current', date: '2026-01-02T18:45:00Z', parents: [OLDER] }],
      },
      storage: { snapshot: { [docKey('late', 'seen')]: JSON.stringify({ sha: '3456789', at: Date.parse('2026-01-01T18:00:00Z') }) } },
      storageKey: 'late',
      changes: () => Promise.resolve({ changed: [[1, 1]] }),
    });
    await flush();
    const trigger = root.querySelector('.chg-trig') as HTMLButtonElement;
    expect(trigger).not.toBeNull();
    trigger.click();
    const visit = root.querySelector('[data-key="visit"]') as HTMLButtonElement;
    expect([visit.textContent, visit.querySelector('.cm-d')?.textContent]).toEqual([expect.stringContaining('1 change'), ' (1 Jan)']);
  });

  it('does not mark a complete short quick range as truncated', async () => {
    vi.setSystemTime(new Date('2026-01-03T12:00:00Z'));
    const root = mount();
    await enhance(root, { info: commits(), changes: () => Promise.resolve({ changed: [] }) });
    (root.querySelector('.chg-trig') as HTMLButtonElement).click();
    expect(root.querySelector('.cm-group[aria-label="Quick ranges"]')?.textContent).toContain('2 changes');
    expect(root.querySelector('.cm-group[aria-label="Quick ranges"]')?.textContent).not.toContain('2+ changes');
  });

  it('labels selected seven- and thirty-day comparisons with the reference range phrasing', async () => {
    vi.setSystemTime(new Date('2026-01-30T12:00:00Z'));
    const root = mount();
    await enhance(root, {
      info: {
        sha: SHA,
        commits: [
          { sha: SHA, subject: 'feat: now', date: '2026-01-30T12:00:00Z', parents: [OLDER] },
          { sha: OLDER, subject: 'fix: seven days', date: '2026-01-24T12:00:00Z', parents: [OLDEST] },
          { sha: OLDEST, subject: 'fix: thirty days', date: '2026-01-01T12:00:00Z', parents: ['3456789'] },
          { sha: '3456789', subject: 'fix: older', date: '2025-12-01T12:00:00Z', parents: [] },
        ],
      },
      changes: () => Promise.resolve({ changed: [] }),
    });
    const trigger = root.querySelector('.chg-trig') as HTMLButtonElement;
    for (const [key, label] of [['d7', 'Since the last 7 days'], ['d30', 'Since the last 30 days']] as const) {
      trigger.click();
      const action = root.querySelector(`[role="menuitemradio"][data-key="${key}"]`);
      if (!(action instanceof HTMLButtonElement)) throw new Error(`missing quick range ${key}`);
      action.click();
      await flush();
      expect(root.querySelector('.chg-nav .what')?.textContent).toBe(label);
    }
  });

  it('toggles the menu and preserves its selected radio and roving focus on reopen', async () => {
    const root = mount();
    await enhance(root, { info: commits(), changes: () => Promise.resolve({ changed: [[1, 1]] }) });
    const trigger = root.querySelector('.chg-trig') as HTMLButtonElement;
    trigger.click();
    const selected = root.querySelector('.cm-row .cm-item') as HTMLButtonElement;
    selected.click();
    await flush();
    trigger.click();
    expect((root.querySelector('.chg-menu') as HTMLElement).hidden).toBe(false);
    trigger.click();
    expect((root.querySelector('.chg-menu') as HTMLElement).hidden).toBe(true);
    trigger.click();
    const restored = root.querySelector(`[data-key="${selected.dataset.key as string}"]`) as HTMLButtonElement;
    expect([restored.getAttribute('aria-checked'), document.activeElement]).toEqual(['true', restored]);
  });

  it('closes on Tab and keeps exactly one roving item after paired menu navigation', async () => {
    const root = mount();
    await enhance(root, { info: commits(), changes: () => Promise.resolve({ changed: [] }), openVersion: () => undefined });
    const trigger = root.querySelector('.chg-trig') as HTMLButtonElement;
    trigger.click();
    const first = root.querySelector('.cm-row .cm-item') as HTMLButtonElement;
    key(first, 'ArrowRight');
    expect(Array.from(root.querySelectorAll('[role^="menuitem"]')).filter((item) => (item as HTMLElement).tabIndex === 0)).toHaveLength(1);
    const tab = key(document.activeElement as HTMLElement, 'Tab');
    expect([tab.defaultPrevented, (root.querySelector('.chg-menu') as HTMLElement).hidden, document.activeElement]).toEqual([true, true, trigger]);
  });

  it('retains focus on the same menu action when a late notice re-renders it', async () => {
    let settle: (value: unknown) => void = () => undefined;
    const pending = new Promise<unknown>((resolve) => { settle = resolve; });
    const root = mount();
    await enhance(root, {
      info: commits(),
      storage: { snapshot: { [docKey('focus', 'seen')]: JSON.stringify({ sha: OLDER, at: 0 }) } },
      storageKey: 'focus',
      changes: () => pending,
    });
    (root.querySelector('.chg-trig') as HTMLButtonElement).click();
    const focused = root.querySelector('.cm-row .cm-item') as HTMLButtonElement;
    focused.focus();
    settle({ changed: [[1, 1]] });
    await flush();
    expect([document.activeElement?.getAttribute('data-key'), (root.querySelector('.chg-menu') as HTMLElement).hidden]).toEqual([focused.dataset.key, false]);
  });

  it('journals independently moved picker and notice children so destroy removes only chrome', async () => {
    const root = mount();
    await enhance(root, {
      info: commits(),
      storage: { snapshot: { [docKey('moved', 'seen')]: JSON.stringify({ sha: OLDER, at: 0 }) } },
      storageKey: 'moved',
      changes: () => Promise.resolve({ changed: [[1, 1]] }),
    });
    await flush();
    const wrap = root.querySelector('.chg-pick') as HTMLElement;
    const notice = root.querySelector('.rs-notice') as HTMLElement;
    document.body.append(wrap, notice);
    await destroyEnhancement(root);
    expect([document.body.contains(wrap), document.body.contains(notice)]).toEqual([false, false]);
  });

  it('starts a measured comparison before destroy and lets its late reply mutate nothing', async () => {
    let settle: (value: unknown) => void = () => undefined;
    const pending = new Promise<unknown>((resolve) => { settle = resolve; });
    const calls: string[] = [];
    const writes: unknown[] = [];
    const root = mount();
    await enhance(root, {
      info: commits(),
      storage: {
        snapshot: { [docKey('pending', 'seen')]: JSON.stringify({ sha: OLDER, at: 0 }) },
        set: (_key, value) => void writes.push(value),
      },
      storageKey: 'pending',
      changes: (base) => {
        calls.push(base);
        return pending;
      },
    });
    expect(calls).toEqual([OLDER]);
    await destroyEnhancement(root);
    const before = [...writes];
    settle({ changed: [[1, 1]] });
    await flush();
    expect([writes, root.querySelector('.rs-notice'), calls]).toEqual([before, null, [OLDER]]);
  });

  it('rejects nonlive and unknown strip facades before teardown, preserving placed siblings', async () => {
    const root = mount();
    await enhance(root, { info: commits(), changes: () => Promise.resolve({ changed: [] }) });
    const ctx = ctxOf(root);
    const facade = reviewStrip(ctx) as NonNullable<ReturnType<typeof reviewStrip>>;
    const before = facade.element.previousElementSibling;
    const after = facade.element.nextElementSibling;
    facade.place();
    expect([facade.element.previousElementSibling, facade.element.nextElementSibling]).toEqual([before, after]);
    ctx.operate(() => {
      void destroyEnhancement(root);
      facade.place();
      expect(reviewStrip(ctx)).toBeNull();
      expect(facade.element.parentNode).toBe(root);
    });
    await flush();
    expect(reviewStrip({} as FeatureContext)).toBeNull();
  });
});
