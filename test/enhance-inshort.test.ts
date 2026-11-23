// @vitest-environment jsdom
// The "In short" option and the comparison base (docserver parity, Task 5; plan choices B8 and B9): the "Headlines | Full"
// switch of the box, on the `inShort` flag (default off, the box as it always was), its two views, the choice kept in the UI
// memory; and the comparison base `changesBase`, asked of `changes` once at the reader's start and shown as "Changes since"
// shows one. The fixtures are real render() output of neutral synthetic Markdown.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { destroyEnhancement, enhance, type EnhanceOptions } from '../src/enhance/index.js';
import { docKey } from '../src/enhance/state.js';
import { render } from '../src/render/index.js';

const DOC = [
  '# Example spec',
  '',
  '**Spec** · 2026-10-19 · Status: Draft',
  '',
  '## In short',
  '',
  '- **One.** The first point, with more words.',
  '- The second point. And a longer tail of explanation after it.',
  '- A third item with no sentence end at all',
  '- **Fourth** lead: the rest of it.',
  '  - a nested point',
  '- `code.sample` first. Then more text.',
  '',
  '## 1. Scope',
  '',
  'Scope text.',
  '',
  '## 2. Design',
  '',
  'Design text.',
  '',
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

afterEach(async () => {
  for (const root of mounted.splice(0)) await destroyEnhancement(root).catch(() => undefined);
  document.body.replaceChildren();
});

const box = (root: Element): HTMLElement => root.querySelector('.short') as HTMLElement;
const items = (root: Element): HTMLElement[] => Array.from(box(root).querySelectorAll(':scope > ul > li')) as HTMLElement[];
const buttons = (root: Element): HTMLButtonElement[] => Array.from(box(root).querySelectorAll('.short-view button')) as HTMLButtonElement[];
const pressed = (root: Element): string[] => buttons(root).filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.textContent ?? '');
const norm = (s: string | null | undefined): string => (s ?? '').replace(/\s+/g, ' ').trim();

/** An item's text as a reader sees it: out of view or out of the accessibility tree (a `hidden` ancestor) left out. */
function shown(n: Node): string {
  if (n.nodeType === 3) return (n as Text).data;
  if (n.nodeType !== 1 || (n as Element).hasAttribute('hidden')) return '';
  return Array.from(n.childNodes).map(shown).join('');
}

describe('the switch is there by the flag, and only then', () => {
  it('with the flag on, the box carries a group of two buttons, Headlines and Full, and Full is pressed', async () => {
    const root = mount();
    await enhance(root, {});
    expect(box(root).querySelector('.short-view')).toBeNull();
    const on = mount();
    await enhance(on, { inShort: true });
    const view = box(on).querySelector('.short-view') as HTMLElement;
    expect(view.getAttribute('role')).toBe('group');
    expect(view.getAttribute('aria-label')).toBe('In short view');
    expect(buttons(on).map((b) => [b.textContent, b.type, b.getAttribute('aria-pressed')])).toEqual([['Headlines', 'button', 'false'], ['Full', 'button', 'true']]);
    // after the heading, inside the box
    expect(view.previousElementSibling?.localName).toBe('h2');
    expect(view.parentElement).toBe(box(on));
  });

  it('with the flag off or left out, the box is 1.1\'s: no switch, no wrapper, and the same nodes whatever the flag says', async () => {
    const plain = mount();
    await enhance(plain, {});
    const off = mount();
    await enhance(off, { inShort: false });
    // the ids the reader gives its chrome count up from one root to the next
    const same = (r: Element): string => r.innerHTML.replace(/docreader\.\d+/g, 'docreader.N');
    expect(same(off)).toBe(same(plain));
    expect(plain.querySelector('.short-view, .rest')).toBeNull();
    expect(box(plain).classList.contains('headlines')).toBe(false);
    // the flag must be a boolean
    await expect(enhance(mount(), { inShort: 'yes' as unknown as boolean })).rejects.toMatchObject({ code: 'invalid-options' });
  });

  it('a document with no "In short" box has no switch either', async () => {
    const root = mount('# Title\n\n**Spec** · 2026-10-19\n\n## 1. Scope\n\nText.\n');
    await enhance(root, { inShort: true });
    expect(root.querySelector('.short-view, .short')).toBeNull();
  });
});

describe('the two views', () => {
  it('Headlines shows each item\'s lead (its first strong run, else its first sentence) and hides the rest from view and from the accessibility tree', async () => {
    const root = mount();
    await enhance(root, { inShort: true });
    const full = items(root).map((li) => norm(li.textContent));
    buttons(root)[0]?.click();
    expect(pressed(root)).toEqual(['Headlines']);
    expect(box(root).classList.contains('headlines')).toBe(true);
    expect(items(root).map((li) => norm(shown(li)))).toEqual([
      'One.',
      'The second point.',
      'A third item with no sentence end at all',
      'Fourth',
      'code.sample first.',
    ]);
    // the rest is in the tree but out of it by `hidden`, and nothing was removed or re-typed
    for (const rest of Array.from(box(root).querySelectorAll('.rest'))) expect(rest.hasAttribute('hidden')).toBe(true);
    expect(box(root).querySelectorAll('.rest')).toHaveLength(4);
    expect(items(root).map((li) => norm(li.textContent))).toEqual(full);
    // the lead is never inside a hidden node
    for (const li of items(root)) expect(norm(shown(li)).length).toBeGreaterThan(0);
  });

  it('Full shows every item again, as written', async () => {
    const root = mount();
    await enhance(root, { inShort: true });
    const before = items(root).map((li) => norm(shown(li)));
    buttons(root)[0]?.click();
    buttons(root)[1]?.click();
    expect(pressed(root)).toEqual(['Full']);
    expect(box(root).classList.contains('headlines')).toBe(false);
    expect(items(root).map((li) => norm(shown(li)))).toEqual(before);
    expect(box(root).querySelector('.rest[hidden]')).toBeNull();
    expect(norm(shown(items(root)[1] as Element))).toBe('The second point. And a longer tail of explanation after it.');
  });

  it('cuts a nested list and the text after a strong run into the rest, and an item with no sentence end keeps all its text', async () => {
    const root = mount();
    await enhance(root, { inShort: true });
    buttons(root)[0]?.click();
    const fourth = items(root)[3] as HTMLElement;
    expect(norm(shown(fourth))).toBe('Fourth');
    expect(fourth.querySelector('.rest ul')).not.toBeNull();
    const third = items(root)[2] as HTMLElement;
    expect(third.querySelector('.rest')).toBeNull();
  });

  it('a loose list (items in paragraphs) with no bold shows each item\'s first paragraph in Headlines and hides only the paragraphs after it (final review I2)', async () => {
    const md = ['# Loose', '', '**Spec** · 2026-10-19 · Status: Draft', '', '## In short', '', '- First point. More text.', '', '  A second paragraph of the first.', '', '- Second point.', '', '- **Bold.** A third, with a lead.', '', '## 1. Scope', '', 'Scope text.', ''].join('\n');
    const root = mount(md);
    await enhance(root, { inShort: true });
    buttons(root)[0]?.click();
    expect(items(root).map((li) => norm(shown(li)))).toEqual(['First point. More text.', 'Second point.', 'Bold. A third, with a lead.']);
    // Only the first item's later paragraph is a rest: the second has none, and the third's strong run is in its one paragraph (the child that holds it is the lead).
    expect(norm(items(root)[0]?.querySelector('.rest')?.textContent)).toBe('A second paragraph of the first.');
    expect(items(root)[1]?.querySelector('.rest')).toBeNull();
    expect(box(root).querySelectorAll('.rest')).toHaveLength(1);
    buttons(root)[1]?.click();
    expect(items(root).map((li) => norm(shown(li)))).toEqual(['First point. More text. A second paragraph of the first.', 'Second point.', 'Bold. A third, with a lead.']);
  });

  it('a paragraph that follows inline text is a block of the rest, not the lead (the first paragraph is the lead only when it opens the item)', async () => {
    // render() never writes inline text before a paragraph in one item, so the DOM is built from render()'s own output by hand.
    const root = mount();
    const li = root.querySelector('ul li') as HTMLElement;
    li.replaceChildren(document.createTextNode('Opening words with no end'), Object.assign(document.createElement('p'), { textContent: 'A paragraph after them.' }));
    await enhance(root, { inShort: true });
    buttons(root)[0]?.click();
    const first = items(root)[0] as HTMLElement;
    expect(norm(shown(first))).toBe('Opening words with no end');
    expect(norm(first.querySelector('.rest')?.textContent)).toBe('A paragraph after them.');
  });

  it('is undone whole by destroyEnhancement: the box is the document\'s again, node for node', async () => {
    const before = mount();
    const snapshot = before.innerHTML;
    const root = mount();
    expect(root.innerHTML).toBe(snapshot);
    await enhance(root, { inShort: true });
    buttons(root)[0]?.click();
    await destroyEnhancement(root);
    expect(root.innerHTML).toBe(snapshot);
  });
});

describe('the choice is kept in the UI memory', () => {
  const UI = 'docreader:ui';

  it('writes the choice as the `inshort` field of the reader-wide UI memory, and starts in it', async () => {
    const writes: [string, string | null][] = [];
    const root = mount();
    await enhance(root, { inShort: true, storage: { set: (k, v) => void writes.push([k, v]) } });
    buttons(root)[0]?.click();
    expect(writes.filter(([k]) => k === UI).map(([, v]) => JSON.parse(v as string))).toEqual([{ inshort: 'headlines' }]);
    buttons(root)[1]?.click();
    expect(writes.filter(([k]) => k === UI).map(([, v]) => JSON.parse(v as string))).toEqual([{ inshort: 'headlines' }, { inshort: 'full' }]);

    const again = mount();
    await enhance(again, { inShort: true, storage: { snapshot: { [UI]: JSON.stringify({ inshort: 'headlines' }) } } });
    expect(pressed(again)).toEqual(['Headlines']);
    expect(box(again).classList.contains('headlines')).toBe(true);
    expect(items(again).map((li) => norm(shown(li)))[1]).toBe('The second point.');
  });

  it('reads anything but "headlines" as Full, and starts without writing', async () => {
    const writes: [string, string | null][] = [];
    for (const stored of [{ inshort: 'full' }, { inshort: 'x' }, { inshort: 7 }, {}]) {
      const root = mount();
      await enhance(root, { inShort: true, storage: { snapshot: { [UI]: JSON.stringify(stored) }, set: (k, v) => void writes.push([k, v]) } });
      expect(pressed(root), JSON.stringify(stored)).toEqual(['Full']);
    }
    expect(writes).toEqual([]);
  });

  it('leaves the other fields of the UI memory as they were', async () => {
    const writes: [string, string | null][] = [];
    const root = mount();
    await enhance(root, { inShort: true, storage: { snapshot: { [UI]: JSON.stringify({ sidetab: 'index' }) }, set: (k, v) => void writes.push([k, v]) } });
    buttons(root)[0]?.click();
    expect(JSON.parse(writes.find(([k]) => k === UI)?.[1] as string)).toEqual({ sidetab: 'index', inshort: 'headlines' });
  });

  it('keeps no choice when the flag is off: a stored Headlines changes nothing', async () => {
    const root = mount();
    await enhance(root, { storage: { snapshot: { [UI]: JSON.stringify({ inshort: 'headlines' }) } } });
    expect(box(root).classList.contains('headlines')).toBe(false);
    expect(root.querySelector('.rest, .short-view')).toBeNull();
  });
});

describe('the comparison base: asked of `changes` once, and shown as a comparison', () => {
  const BASE = '1234567890abcdef1234567890abcdef12345678';
  const HEAD = 'abcdef1';
  const info = (more: Partial<NonNullable<EnhanceOptions['info']>> = {}): NonNullable<EnhanceOptions['info']> => ({
    sha: HEAD,
    commits: [
      { sha: HEAD, subject: 'feat: newer change', date: '2026-01-02T10:00:00Z', parents: [BASE] },
      { sha: BASE, subject: 'fix: the base commit', date: '2026-01-01T10:00:00Z', parents: ['2345678'] },
    ],
    ...more,
  });
  const flush = async (): Promise<void> => {
    for (let i = 0; i < 20; i += 1) await Promise.resolve();
  };
  const marked = (root: Element): number => root.querySelectorAll('.chg, .chg-del').length;
  const what = (root: Element): string => norm(root.querySelector('.chg-nav .what')?.textContent);

  it('asks once, for the base, and shows the comparison labelled by the base\'s commit', async () => {
    const asked: string[] = [];
    const root = mount();
    await enhance(root, { info: info(), changesBase: BASE, changes: (b) => (asked.push(b), Promise.resolve({ changed: [[1, 1]] })) });
    await flush();
    expect(asked).toEqual([BASE]);
    expect(marked(root)).toBeGreaterThan(0);
    expect(what(root)).toContain('the base commit');
    expect(what(root)).toMatch(/^Since /);
    expect(norm(root.querySelector('.chg-trig .ct-label')?.textContent)).toBe(what(root));
  });

  it('finds the base commit whichever side holds the short sha: a short sha in `info.commits`, or a short base', async () => {
    const SHORT = BASE.slice(0, 7);
    const two = (sha: string): { sha: string; subject: string; date: string; parents: string[] }[] => [
      { sha: HEAD, subject: 'feat: newer change', date: '2026-01-02T10:00:00Z', parents: [sha] },
      { sha, subject: 'fix: the base commit', date: '2026-01-01T10:00:00Z', parents: ['2345678'] },
    ];
    for (const [name, commitSha, base] of [['short commit, full base', SHORT, BASE], ['full commit, short base', BASE, SHORT], ['equal', BASE, BASE]] as const) {
      const root = mount();
      await enhance(root, { info: info({ commits: two(commitSha) }), changesBase: base, changes: () => Promise.resolve({ changed: [[1, 1]] }) });
      await flush();
      expect(what(root), name).toContain('the base commit');
    }
    const other = mount();
    await enhance(other, { info: info({ commits: two('7654321') }), changesBase: BASE, changes: () => Promise.resolve({ changed: [[1, 1]] }) });
    await flush();
    expect(what(other)).toBe('Since your comparison');
  });

  it('an upper-case commit sha still names the base, and a commit sha under 7 characters never reaches the label (the options check refuses it; baseLabel keeps its own floor of 7 as defence in depth)', async () => {
    const two = (sha: string): { sha: string; subject: string; date: string; parents: string[] }[] => [
      { sha: HEAD, subject: 'feat: newer change', date: '2026-01-02T10:00:00Z', parents: [sha] },
      { sha, subject: 'fix: the base commit', date: '2026-01-01T10:00:00Z', parents: ['2345678'] },
    ];
    await expect(enhance(mount(), { info: info({ commits: two(BASE.slice(0, 3)) }), changesBase: BASE, changes: () => Promise.resolve({ changed: [[1, 1]] }) })).rejects.toThrow(/7 to 40 hex/);
    const upper = mount();
    await enhance(upper, { info: info({ commits: two(BASE.slice(0, 9).toUpperCase()) }), changesBase: BASE, changes: () => Promise.resolve({ changed: [[1, 1]] }) });
    await flush();
    expect(what(upper)).toContain('the base commit');
  });

  it('is labelled "Since your comparison" when the commits do not name the base', async () => {
    const root = mount();
    await enhance(root, { info: info({ commits: [{ sha: HEAD, subject: 'feat: x', date: '2026-01-02T10:00:00Z', parents: ['2345678'] }, { sha: '3456789', subject: 'fix: y', date: '2026-01-01T10:00:00Z', parents: ['4567890'] }] }), changesBase: BASE, changes: () => Promise.resolve({ changed: [[1, 1]] }) });
    await flush();
    expect(what(root)).toBe('Since your comparison');
    const bare = mount();
    await enhance(bare, { info: { sha: HEAD }, changesBase: BASE, changes: () => Promise.resolve({ changed: [[1, 1]] }) });
    await flush();
    expect(what(bare)).toBe('Since your comparison');
    expect(marked(bare)).toBeGreaterThan(0);
  });

  it('is asked of the host once however the reader builds: the menu\'s picking it later does not ask again', async () => {
    const asked: string[] = [];
    const root = mount();
    await enhance(root, { info: info(), changesBase: BASE, changes: (b) => (asked.push(b), Promise.resolve({ changed: [[1, 1]] })) });
    await flush();
    (root.querySelector('.chg-trig') as HTMLButtonElement).click();
    const row = Array.from(root.querySelectorAll('[role="menuitemradio"]')).find((el) => el.getAttribute('data-key')?.startsWith('day:')) as HTMLElement | undefined;
    row?.click();
    await flush();
    expect(asked.filter((b) => b === BASE)).toHaveLength(1);
  });

  it('is never asked for with no base, no `changes`, a draft or a day view: no other source sets it', async () => {
    const cases: [string, EnhanceOptions][] = [
      ['no base', { info: info(), changes: () => Promise.resolve({ changed: [[1, 1]] }) }],
      ['no changes', { info: info(), changesBase: BASE }],
      ['a draft', { info: info({ draft: true }), changesBase: BASE, changes: () => Promise.resolve({ changed: [[1, 1]] }) }],
      ['a day view', { info: info({ only: '2345678' }), changesBase: BASE, changes: () => Promise.resolve({ changed: [] }) }],
      ['no sha', { info: { title: null }, changesBase: BASE, changes: () => Promise.resolve({ changed: [[1, 1]] }) }],
    ];
    for (const [name, options] of cases) {
      const asked: string[] = [];
      const fn = options.changes;
      const root = mount();
      await enhance(root, { ...options, ...(fn === undefined ? {} : { changes: (b: string) => (asked.push(b), fn(b)) }) });
      await flush();
      expect(asked.filter((b) => b === BASE), name).toEqual([]);
    }
  });

  it('shows nothing when the host cannot answer, as an unanswered `changes` does today', async () => {
    const asked: string[] = [];
    const root = mount();
    await enhance(root, { info: info(), changesBase: BASE, changes: (b) => (asked.push(b), Promise.resolve(null)) });
    await flush();
    expect(asked).toEqual([BASE]);
    expect(marked(root)).toBe(0);
    expect(root.querySelector('.chg-nav')?.hasAttribute('hidden') ?? true).toBe(true);
    expect(norm(root.querySelector('.chg-trig .ct-label')?.textContent)).toBe('Changes since…');
  });

  it('shows the base without moving the reader: it does not step to the first place', async () => {
    const root = mount();
    let scrolled = 0;
    root.scrollIntoView = (): void => void (scrolled += 1);
    await enhance(root, { info: info(), changesBase: BASE, changes: () => Promise.resolve({ changed: [[1, 1]] }) });
    await flush();
    expect(norm(root.querySelector('.chg-nav .cn')?.textContent)).not.toMatch(/^1 of /);
    expect(scrolled).toBe(0);
  });

  it('takes a sha of 7 to 40 hex characters or 64, and refuses anything else', async () => {
    for (const ok of ['abcdef1', BASE, 'a'.repeat(64)]) {
      await expect(enhance(mount(), { changesBase: ok }), ok).resolves.toBeUndefined();
    }
    for (const bad of ['abcde', 'a'.repeat(41), 7, null, '']) {
      await expect(enhance(mount(), { changesBase: bad as unknown as string }), String(bad)).rejects.toMatchObject({ code: 'invalid-options' });
    }
  });
});

describe('which `changes` request is a comparison the reader chose (docserver readiness T5)', () => {
  // The seam: a host sees only `changes(sha)`. It tells the reader's own pick from what it seeded itself, with its own seed:
  // the snapshot's last visit (the automatic measure), the `changesBase`, and a one-day version's `only`.
  const HEAD = 'a'.repeat(40);
  const BASE = '1234567890abcdef1234567890abcdef12345678';
  const SEEN = 'c'.repeat(40);
  const OLDER = 'b'.repeat(40);
  const ONLY = 'd'.repeat(40);
  const commits = [
    { sha: HEAD, subject: 'feat: newer change', date: '2026-01-03T10:00:00Z', parents: [BASE] },
    { sha: BASE, subject: 'fix: the base commit', date: '2026-01-02T10:00:00Z', parents: [SEEN] },
    { sha: SEEN, subject: 'fix: older change', date: '2026-01-01T10:00:00Z', parents: [OLDER] },
  ];
  const storage = { snapshot: { [docKey('doc', 'seen')]: JSON.stringify({ sha: SEEN, at: 0 }) } };
  const flush = async (): Promise<void> => {
    for (let i = 0; i < 40; i += 1) await Promise.resolve();
  };
  const SET = { changed: [[1, 1]] as [number, number][] };
  /** The rule as the README states it: a request is the reader's pick when the mount is no day view and its sha is none of the seeded ones. */
  const chosen = (sha: string, seed: { only: string | null; seen: string; base: string }): boolean =>
    seed.only === null && ![seed.seen, seed.base].includes(sha.toLowerCase());
  const seed = { only: null, seen: SEEN, base: BASE };
  /** A mount that records each sha asked of `changes`; `answer` decides the reply (a set by default). */
  async function open(over: Partial<EnhanceOptions> = {}, answer: (sha: string) => Promise<unknown> = () => Promise.resolve(SET)) {
    const asked: string[] = [];
    const root = mount();
    await enhance(root, {
      storage, storageKey: 'doc', info: { title: 'Title', sha: HEAD, commits }, changesBase: BASE,
      changes: (sha: string) => (asked.push(sha), answer(sha) as Promise<{ changed: [number, number][] }>),
      ...over,
    });
    await flush();
    return { root, asked };
  }
  const trigger = (root: Element): HTMLButtonElement => root.querySelector('.chg-trig') as HTMLButtonElement;
  const label = (root: Element): string => norm(root.querySelector('.chg-trig .ct-label')?.textContent);
  const days = (root: Element): HTMLElement[] => Array.from(root.querySelectorAll('[role="menuitemradio"][data-key^="day:"]')) as HTMLElement[];
  /** Open the menu and pick a row; days are taken by their order, newest first, because their keys are local-day labels. */
  async function pick(root: Element, row: () => HTMLElement | undefined): Promise<void> {
    trigger(root).click();
    const el = row();
    expect(el).toBeDefined();
    el?.click();
    await flush();
  }

  it('T5.1 the requests made at start are the seeded shas: the last visit\'s, then the base', async () => {
    const { asked } = await open();
    expect(asked).toEqual([SEEN, BASE]);
    expect(asked.filter((sha) => chosen(sha, seed))).toEqual([]);
  });

  it('T5.2 the reader\'s own uses of a seeded sha send nothing: the notice\'s Show, the visit row, a day row whose base is the base or the last visit', async () => {
    const { root, asked } = await open();
    (root.querySelector('.rs-notice button') as HTMLButtonElement).click();
    await flush();
    await pick(root, () => root.querySelector('[data-key="visit"]') as HTMLElement);
    await pick(root, () => days(root)[0]);
    await pick(root, () => days(root)[1]);
    expect(asked).toEqual([SEEN, BASE]);
  });

  it('T5.3 a pick of any other comparison is the one request outside the seed, and once', async () => {
    const { root, asked } = await open();
    await pick(root, () => days(root)[2]);
    await pick(root, () => days(root)[2]);
    expect(asked).toEqual([SEEN, BASE, OLDER]);
    expect(asked.filter((sha) => chosen(sha, seed))).toEqual([OLDER]);
  });

  it('T5.4 a one-day version asks for its own day only, and no request in it is a pick', async () => {
    const { root, asked } = await open({ info: { title: 'Title', sha: HEAD, commits, only: ONLY }, openVersion: () => undefined });
    expect(asked).toEqual([ONLY]);
    expect(root.querySelector('.chg-trig')).toBeNull();
    (root.querySelector('.ver-show') as HTMLButtonElement).click();
    await flush();
    expect(asked).toEqual([ONLY]);
    expect(asked.filter((sha) => chosen(sha, { ...seed, only: ONLY }))).toEqual([]);
  });

  it('T5.5 the known limit: with no answer for the last visit, a row whose base is that sha asks it again and reads as the measure', async () => {
    const { root, asked } = await open({}, (sha) => Promise.resolve(sha === SEEN ? null : SET));
    expect(asked).toEqual([SEEN, BASE]);
    expect(root.querySelector('[data-key="visit"]')).toBeNull();
    await pick(root, () => days(root)[1]);
    // The day whose base is the last visit asks that sha a second time. It is documented (README, "Which request to record").
    expect(asked).toEqual([SEEN, BASE, SEEN]);
  });

  describe('the seeded base waits for the last-visit measure', () => {
    /** A mount whose measure the test answers by hand; every other request is answered at once. */
    async function held(over: Partial<EnhanceOptions> = {}) {
      let answer!: (reply: unknown) => void;
      const measure = new Promise<unknown>((resolve) => { answer = resolve; });
      const opened = await open(over, (sha) => (sha === SEEN ? measure : Promise.resolve(SET)));
      return { ...opened, answer };
    }

    it('asks the measure alone while it is in flight, then the base once it settles, and the notice appears', async () => {
      const { root, asked, answer } = await held();
      expect(asked).toEqual([SEEN]);
      expect(root.querySelector('.rs-notice')).toBeNull();
      answer(SET);
      await flush();
      expect(asked).toEqual([SEEN, BASE]);
      expect(root.querySelector('.rs-notice')?.textContent).toContain('Changed since your last visit');
      expect(label(root)).toContain('the base commit');
    });

    it('asks the base after a measure that got no answer, too', async () => {
      const { root, asked, answer } = await held();
      answer(null);
      await flush();
      expect(asked).toEqual([SEEN, BASE]);
      expect(root.querySelector('.rs-notice')).toBeNull();
      expect(label(root)).toContain('the base commit');
    });

    it('a comparison the reader picked while the measure was in flight keeps its place: the late base is not asked and does not replace it', async () => {
      const { root, asked, answer } = await held();
      await pick(root, () => days(root)[2]);
      const picked = label(root);
      expect(picked).not.toBe('Changes since…');
      expect(asked).toEqual([SEEN, OLDER]);
      answer(SET);
      await flush();
      expect(asked).toEqual([SEEN, OLDER]);
      expect(label(root)).toBe(picked);
      expect(label(root)).not.toContain('the base commit');
      expect(root.querySelector('.rs-notice')).not.toBeNull();
      expect(root.querySelector('[data-key="visit"]')).toBeNull();
      trigger(root).click();
      expect(root.querySelector('[data-key="visit"]')).not.toBeNull();
    });

    it('asks the base after a measure with no places, too', async () => {
      const { root, asked, answer } = await held();
      answer({ changed: [] });
      await flush();
      expect(asked).toEqual([SEEN, BASE]);
      expect(root.querySelector('.rs-notice')).toBeNull();
      expect(label(root)).toContain('the base commit');
    });

    it('asks the base when the measure\'s own chain fails, and leaves that failure as it was: an unhandled rejection', async () => {
      const { root, asked, answer } = await held();
      const seen: unknown[] = [];
      const listeners = process.listeners('unhandledRejection');
      process.removeAllListeners('unhandledRejection');
      process.on('unhandledRejection', (reason) => void seen.push(reason));
      const text = document.createTextNode.bind(document);
      const spy = vi.spyOn(document, 'createTextNode').mockImplementation((data: string) => {
        if (data.startsWith('Changed since your last visit')) throw new Error('the notice failed');
        return text(data);
      });
      try {
        answer(SET);
        await flush();
        await new Promise((resolve) => setTimeout(resolve, 0)); // one turn of the event loop, for the rejection to be reported
      } finally {
        spy.mockRestore();
        process.removeAllListeners('unhandledRejection');
        for (const listener of listeners) process.on('unhandledRejection', listener);
      }
      expect(asked).toEqual([SEEN, BASE]);
      expect(label(root)).toContain('the base commit');
      expect((seen as Error[]).map((reason) => reason.message)).toEqual(['the notice failed']);
    });

    it('a comparison the reader picked and then hid while the measure was in flight is a choice too: the late base is not asked', async () => {
      const { root, asked, answer } = await held();
      await pick(root, () => days(root)[2]);
      expect(asked).toEqual([SEEN, OLDER]);
      expect(label(root)).not.toBe('Changes since…');
      (root.querySelector('.chg-nav .hide') as HTMLButtonElement).click();
      await flush();
      expect(label(root)).toBe('Changes since…');
      answer(SET);
      await flush();
      expect(asked).toEqual([SEEN, OLDER]);
      expect(label(root)).toBe('Changes since…');
      expect(root.querySelector('.rs-notice')).not.toBeNull();
    });

    it('a mount destroyed while the measure is in flight asks no base and touches nothing', async () => {
      const { root, asked, answer } = await held();
      const picker = trigger(root);
      await destroyEnhancement(root);
      answer(SET);
      await flush();
      expect(asked).toEqual([SEEN]);
      expect(norm(picker.querySelector('.ct-label')?.textContent)).toBe('Changes since…');
    });

    it('applying the late base moves the reader nowhere: no scroll call, as with a base asked at start', async () => {
      const scrolled = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
      try {
        const { root, asked, answer } = await held();
        const before = scrolled.mock.calls.length;
        answer(SET);
        await flush();
        expect(asked).toEqual([SEEN, BASE]);
        expect(label(root)).toContain('the base commit');
        expect(norm(root.querySelector('.chg-nav .cn')?.textContent)).not.toMatch(/^1 of /);
        expect(scrolled.mock.calls.length).toBe(before);
      } finally {
        scrolled.mockRestore();
      }
    });

    it('with no prior visit the base is asked at once, as before', async () => {
      const { asked } = await open({ storage: {} });
      expect(asked).toEqual([BASE]);
    });
  });
});
