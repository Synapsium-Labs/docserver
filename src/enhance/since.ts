// The "Changes since" menu grouped by day, the notice of changes since the last visit, and the one-day version banner
// (the reference layout, section 24b; Task 22). The feature stays root-local: it receives all comparison data through the
// normalized context and calls the host only through changes.ts and openVersion. It constructs no URLs.
import { showChanges } from './changes.js';
import { chrome } from './journal.js';
import { isSha } from './options.js';
import { reviewStrip } from './strip.js';
import type { CommitEntry, FeatureContext } from './types.js';

const EDGE = 16;
const MENU_ROOM = 280;
const DAY_SUBJECTS = 2;
const SUBJECT_MAX = 90;

interface DayGroup {
  readonly key: string;
  readonly date: Date;
  readonly list: readonly CommitEntry[];
  readonly base: string | null;
}

interface Visit {
  readonly base: string;
  readonly at: number;
  readonly places: number;
  /** Commits since the last visit, when the retained history can establish it. */
  readonly commits: number;
}

type MenuAction =
  | { readonly kind: 'show'; readonly key: string; readonly label: string; readonly base: string }
  | { readonly kind: 'only'; readonly sha: string; readonly only: string };

interface SinceState {
  readonly trigger: HTMLButtonElement;
  readonly menu: HTMLElement;
  readonly wrap: HTMLElement;
  readonly groups: readonly DayGroup[];
  readonly daysId: string;
  readonly actions: Map<string, MenuAction>;
  selected: { readonly key: string; readonly what: string } | null;
  visit: Visit | null;
}

interface OnlyState {
  readonly show: HTMLButtonElement | null;
  readonly day: string;
}

let states: WeakMap<FeatureContext, SinceState> | undefined;
let onlyStates: WeakMap<FeatureContext, OnlyState> | undefined;

function dateOf(value: string): Date | null {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? null : date;
}

function dayKey(date: Date): string {
  return `${String(date.getFullYear())}-${String(date.getMonth())}-${String(date.getDate())}`;
}

function dayLabel(ctx: FeatureContext, date: Date): string {
  const current = new Date(ctx.env.now());
  const year = date.getFullYear() === current.getFullYear() ? '' : ` ${String(date.getFullYear())}`;
  return `${ctx.vocab.words.dates.weekdays[date.getDay()] as string} ${String(date.getDate())} ${ctx.vocab.words.dates.months[date.getMonth()] as string}${year}`;
}

function parentOf(entry: CommitEntry): string | null {
  return entry.parents[0] ?? null;
}

function groupsOf(ctx: FeatureContext): readonly DayGroup[] {
  const commits = (ctx.info.commits ?? []).filter((entry) => !ctx.vocab.merge.test(entry.subject));
  const partial: { key: string; date: Date; list: CommitEntry[]; last: number }[] = [];
  const byKey = new Map<string, (typeof partial)[number]>();
  for (let i = 0; i < commits.length; i += 1) {
    const entry = commits[i] as CommitEntry;
    const date = dateOf(entry.date);
    if (date === null) continue;
    const key = dayKey(date);
    let group = byKey.get(key);
    if (group === undefined) {
      group = { key, date, list: [], last: i };
      byKey.set(key, group);
      partial.push(group);
    }
    group.list.push(entry);
    group.last = i;
  }
  return Object.freeze(partial.map((group) => Object.freeze({
    key: group.key,
    date: group.date,
    list: Object.freeze([...group.list]),
    base: commits[group.last + 1]?.sha ?? parentOf(commits[commits.length - 1] as CommitEntry),
  })));
}

function countLabel(n: number, full: boolean): string {
  const suffix = full ? '+' : '';
  return `${String(n)}${suffix} change${n === 1 && !full ? '' : 's'}`;
}

function dateLabel(ctx: FeatureContext, value: number): string {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return '';
  const current = new Date(ctx.env.now());
  const year = date.getFullYear() === current.getFullYear() ? '' : ` ${String(date.getFullYear())}`;
  return ` (${String(date.getDate())} ${ctx.vocab.words.dates.months[date.getMonth()] as string}${year})`;
}

function readSeen(value: unknown): { sha: string; at: number } | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const seen = value as { sha?: unknown; at?: unknown };
  if (!isSha(seen.sha) || typeof seen.at !== 'number' || !Number.isFinite(seen.at)) return null;
  return { sha: seen.sha.toLowerCase(), at: seen.at };
}

function quickRanges(ctx: FeatureContext, visit: Visit | null): readonly { key: string; label: string; base: string | null; n: number }[] {
  const commits = (ctx.info.commits ?? []).filter((entry) => !ctx.vocab.merge.test(entry.subject));
  const now = new Date(ctx.env.now());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const out: { key: string; label: string; base: string | null; n: number }[] = [];
  let previous = visit === null ? -1 : visit.commits;
  for (const [key, label, days] of [['today', 'Today', 0], ['d7', 'Last 7 days', 6], ['d30', 'Last 30 days', 29]] as const) {
    const from = new Date(today);
    from.setDate(from.getDate() - days);
    let n = commits.findIndex((entry) => {
      const date = dateOf(entry.date);
      return date !== null && date < from;
    });
    if (n < 0) n = commits.length;
    if (n === 0 || n === previous) continue;
    previous = n;
    out.push({ key, label, n, base: commits[n]?.sha ?? parentOf(commits[commits.length - 1] as CommitEntry) });
  }
  return Object.freeze(out);
}

function menuItems(menu: HTMLElement): HTMLElement[] {
  return Array.from(menu.querySelectorAll('[role^="menuitem"]')) as HTMLElement[];
}

function close(ctx: FeatureContext, state: SinceState, focus = true): void {
  if (state.menu.hidden) return;
  const inside = state.menu.contains(state.menu.ownerDocument.activeElement);
  state.menu.hidden = true;
  state.trigger.setAttribute('aria-expanded', 'false');
  if (focus && inside && ctx.live()) state.trigger.focus({ preventScroll: true });
}

function position(ctx: FeatureContext, state: SinceState): void {
  const { menu, trigger, wrap } = state;
  ctx.journal.setStyle(menu, 'left', null);
  ctx.journal.setStyle(menu, 'right', null);
  ctx.journal.setStyle(menu, 'max-height', null);
  let triggerBox = trigger.getBoundingClientRect();
  if (!ctx.live()) return;
  const view = ctx.env.viewport();
  if (!ctx.live()) return;
  const bar = ctx.slots?.bar ?? null;
  const barBottom = bar === null || ctx.root.classList.contains('bar-hidden') ? 0 : bar.getBoundingClientRect().bottom;
  if (!ctx.live()) return;
  const clearance = Math.max(EDGE, barBottom + 12);
  if (view.h - triggerBox.bottom < MENU_ROOM && triggerBox.top > clearance) {
    ctx.env.scrollTo(Math.max(0, view.scrollY + triggerBox.top - clearance), false);
    if (!ctx.live()) return;
    triggerBox = trigger.getBoundingClientRect();
    if (!ctx.live()) return;
  }
  const width = menu.offsetWidth;
  if (!ctx.live()) return;
  const wrapBox = wrap.getBoundingClientRect();
  if (!ctx.live()) return;
  const left = Math.min(Math.max(EDGE, triggerBox.right - width), Math.max(EDGE, view.w - EDGE - width));
  ctx.journal.setStyle(menu, 'left', `${String(Math.round(left - wrapBox.left))}px`);
  ctx.journal.setStyle(menu, 'right', 'auto');
  const popupTop = menu.getBoundingClientRect().top;
  if (!ctx.live()) return;
  ctx.journal.setStyle(menu, 'max-height', `${String(Math.max(0, Math.floor(view.h - popupTop - EDGE)))}px`);
}

function show(ctx: FeatureContext, state: SinceState, what: string, base: string, key: string): void {
  close(ctx, state, false);
  const selected = { key, what };
  state.selected = selected;
  sync(state);
  void showChanges(ctx, base, { what, onHide: () => {
    if (state.selected === selected) state.selected = null;
    sync(state);
  } }).then((outcome) => {
    if (!ctx.live()) return;
    if ('skipped' in outcome && state.selected === selected) state.selected = null;
    sync(state);
  });
}

function sync(state: SinceState): void {
  const selected = state.selected;
  state.trigger.classList.toggle('on', selected !== null);
  state.trigger.querySelector('.ct-label')?.replaceChildren(state.trigger.ownerDocument.createTextNode(selected?.what ?? 'Changes since…'));
  for (const item of Array.from(state.menu.querySelectorAll('[role="menuitemradio"]'))) {
    item.setAttribute('aria-checked', String(selected?.key === item.getAttribute('data-key')));
  }
}

function item(ctx: FeatureContext, state: SinceState, key: string, label: string, base: string | null, content: readonly Node[]): HTMLButtonElement | null {
  if (base === null) return null;
  state.actions.set(key, { kind: 'show', key, label, base });
  return chrome(ctx.root.ownerDocument, 'button', {
    className: 'cm-item',
    attrs: { type: 'button', role: 'menuitemradio', tabindex: '-1', 'aria-checked': 'false', 'data-key': key, 'aria-label': label },
  }, content);
}

function onlyItem(ctx: FeatureContext, state: SinceState, group: DayGroup, day: string): HTMLButtonElement | null {
  if (group.base === null || !ctx.host.present.has('openVersion')) return null;
  const sha = group.list[0]?.sha ?? null;
  if (sha === null) return null;
  const key = `only:${group.key}`;
  state.actions.set(key, { kind: 'only', sha, only: group.base });
  return chrome(ctx.root.ownerDocument, 'button', {
    className: 'cm-only',
    text: 'Only this day',
    attrs: { type: 'button', role: 'menuitem', tabindex: '-1', 'data-key': key, 'aria-label': `Only this day: ${day}` },
  });
}

function render(ctx: FeatureContext, state: SinceState, focusKey: string | null = null): void {
  const doc = ctx.root.ownerDocument;
  const children: Node[] = [];
  const comparisons = ctx.host.present.has('changes');
  state.actions.clear();
  const quick = chrome(doc, 'div', { className: 'cm-group', attrs: { role: 'group', 'aria-label': 'Quick ranges' } });
  if (comparisons && state.visit !== null) {
    const count = state.visit.commits > 0 ? countLabel(state.visit.commits, state.visit.commits === 100) : `${String(state.visit.places)} place${state.visit.places === 1 ? '' : 's'}`;
    const visit = item(ctx, state, 'visit', 'Since your last visit', state.visit.base, [
      chrome(doc, 'span', { className: 'cm-main' }, [
        chrome(doc, 'span', { className: 'cm-t', text: 'Since your last visit' }),
        chrome(doc, 'span', { className: 'cm-d', text: dateLabel(ctx, state.visit.at) }),
      ]),
      chrome(doc, 'span', { className: 'cm-n', text: count }),
    ]);
    if (visit !== null) quick.appendChild(visit);
  }
  if (comparisons) {
    for (const range of quickRanges(ctx, state.visit)) {
      const button = item(ctx, state, range.key, range.key === 'today' ? `Since ${range.label.toLowerCase()}` : `Since the ${range.label.toLowerCase()}`, range.base, [
        chrome(doc, 'span', { className: 'cm-main' }, [chrome(doc, 'span', { className: 'cm-t', text: range.label })]),
        chrome(doc, 'span', { className: 'cm-n', text: countLabel(range.n, range.n === 100) }),
      ]);
      if (button !== null) quick.appendChild(button);
    }
  }
  if (quick.children.length > 0) children.push(quick);
  const label = chrome(doc, 'div', { className: 'cm-lab', attrs: { id: state.daysId, 'aria-hidden': 'true' } }, [
    chrome(doc, 'span', { text: 'By day' }), chrome(doc, 'span', { className: 'cm-hint', text: 'since: until now · only: that day' }),
  ]);
  const days = chrome(doc, 'div', { className: 'cm-group cm-days', attrs: { role: 'group', 'aria-labelledby': state.daysId } });
  for (const group of state.groups) {
    const day = dayLabel(ctx, group.date);
    const snippets = group.list.slice(0, DAY_SUBJECTS).map((entry) => ctx.text.clip(entry.subject.replace(ctx.vocab.commitPrefix, '') || entry.sha.slice(0, 7), SUBJECT_MAX));
    const more = group.list.length - snippets.length;
    const since = comparisons ? item(ctx, state, `day:${group.key}`, `Since ${day}`, group.base, [
      chrome(doc, 'span', { className: 'cm-main' }, [
        chrome(doc, 'span', { className: 'cm-t', text: `Since ${day}` }),
        chrome(doc, 'span', { className: 'cm-n', text: countLabel(group.list.length, false) }),
      ]),
      ...snippets.map((snippet, index) => chrome(doc, 'span', { className: 'cm-s' }, [
        chrome(doc, 'span', { className: 'cm-st', text: snippet }),
        index === snippets.length - 1 && more > 0 ? chrome(doc, 'span', { className: 'cm-more', text: `+${String(more)} more` }) : doc.createTextNode(''),
      ])),
    ]) : null;
    const only = onlyItem(ctx, state, group, day);
    const summary = comparisons ? null : chrome(doc, 'span', { className: 'cm-item' }, [
      chrome(doc, 'span', { className: 'cm-main' }, [chrome(doc, 'span', { className: 'cm-t', text: `Version of ${day}` })]),
    ]);
    const row = chrome(doc, 'div', { className: `cm-row${only === null ? ' no-only' : ''}`, attrs: { role: 'none' } });
    if (since !== null) row.appendChild(since);
    if (summary !== null) row.appendChild(summary);
    if (only !== null) row.appendChild(only);
    days.appendChild(row);
  }
  children.push(chrome(doc, 'div', { className: 'cm-days-wrap', attrs: { role: 'none' } }, [label, days]));
  state.menu.replaceChildren(...children);
  sync(state);
  if (focusKey !== null) {
    const focused = Array.from(state.menu.querySelectorAll('[data-key]')).find((el) => el.getAttribute('data-key') === focusKey) as HTMLElement | undefined;
    if (focused !== undefined) focus(ctx, state, focused, false);
  }
}

function focus(ctx: FeatureContext, state: SinceState, target: HTMLElement, scroll = true): void {
  for (const item of menuItems(state.menu)) item.tabIndex = -1;
  target.tabIndex = 0;
  target.focus({ preventScroll: true });
  if (!ctx.live() || state.menu.ownerDocument.activeElement !== target || !scroll) return;
  if (typeof target.scrollIntoView === 'function') target.scrollIntoView({ block: 'nearest' });
}

function open(ctx: FeatureContext, state: SinceState, last = false): void {
  if (!state.menu.hidden) return;
  render(ctx, state);
  state.menu.hidden = false;
  state.trigger.setAttribute('aria-expanded', 'true');
  position(ctx, state);
  if (!ctx.live()) return;
  const items = menuItems(state.menu);
  const current = items.find((entry) => entry.getAttribute('aria-checked') === 'true') ?? (last ? items.at(-1) : items[0]);
  if (current !== undefined) focus(ctx, state, current);
}

function activate(ctx: FeatureContext, state: SinceState, target: HTMLElement): void {
  const action = state.actions.get(target.getAttribute('data-key') ?? '');
  if (action === undefined) return;
  if (action.kind === 'show') show(ctx, state, action.label, action.base, action.key);
  else ctx.host.openVersion({ sha: action.sha, only: action.only });
}

function bindKeys(ctx: FeatureContext, state: SinceState): void {
  ctx.journal.listen(state.trigger, 'click', () => {
    if (state.menu.hidden) open(ctx, state);
    else close(ctx, state);
  });
  ctx.journal.listen(state.trigger, 'keydown', (event) => {
    const key = (event as KeyboardEvent).key;
    if (key !== 'ArrowDown' && key !== 'ArrowUp') return;
    event.preventDefault();
    open(ctx, state, key === 'ArrowUp');
  });
  ctx.journal.listen(state.menu, 'click', (event) => {
    const target = (event.target as Element | null)?.closest('[data-key]') as HTMLElement | null;
    if (target !== null && state.menu.contains(target)) activate(ctx, state, target);
  });
  ctx.journal.listen(state.menu, 'keydown', (event) => {
    const keyboard = event as KeyboardEvent;
    const items = menuItems(state.menu);
    const active = state.menu.ownerDocument.activeElement as HTMLElement;
    const index = items.indexOf(active);
    const move = (to: number): void => {
      const target = items[(to + items.length) % items.length];
      if (target !== undefined) focus(ctx, state, target);
    };
    const row = (active as Element | null)?.closest('.cm-row') ?? null;
    if (keyboard.key === 'ArrowDown') { keyboard.preventDefault(); move(index + 1); }
    else if (keyboard.key === 'ArrowUp') { keyboard.preventDefault(); move(index - 1); }
    else if (keyboard.key === 'Home') { keyboard.preventDefault(); move(0); }
    else if (keyboard.key === 'End') { keyboard.preventDefault(); move(items.length - 1); }
    else if (keyboard.key === 'Tab') { keyboard.preventDefault(); close(ctx, state); }
    else if ((keyboard.key === 'ArrowRight' || keyboard.key === 'ArrowLeft') && row !== null) {
      const pair = Array.from(row.querySelectorAll('[role^="menuitem"]')) as HTMLElement[];
      const at = pair.indexOf(active);
      const other = pair[at === 0 ? 1 : 0];
      if (pair.length > 1 && other !== undefined) { keyboard.preventDefault(); focus(ctx, state, other); }
    } else if (keyboard.key.length === 1 && /\S/.test(keyboard.key) && !keyboard.ctrlKey && !keyboard.metaKey && !keyboard.altKey) {
      const letter = keyboard.key.toLowerCase();
      for (let n = 1; n <= items.length; n += 1) {
        const target = items[(index + n) % items.length] as HTMLElement;
        const text = (target.getAttribute('aria-label') ?? target.textContent ?? '').toLowerCase().replace(/^(since|only) /, '');
        if (text.startsWith(letter)) { keyboard.preventDefault(); move(index + n); break; }
      }
    }
  });
  ctx.journal.listen(state.wrap, 'focusout', (event) => {
    const next = (event as FocusEvent).relatedTarget as Node | null;
    if (next !== null && !state.wrap.contains(next)) close(ctx, state, false);
  });
  ctx.journal.listen(ctx.root.ownerDocument, 'pointerdown', (event) => {
    if (!state.menu.hidden && !state.wrap.contains(event.target as Node)) close(ctx, state, false);
  });
  ctx.journal.defer(ctx.overlays.register('changes', { isOpen: () => !state.menu.hidden, close: () => close(ctx, state) }));
  ctx.journal.defer(() => close(ctx, state, false));
}

function addNotice(ctx: FeatureContext, state: SinceState | null, seen: { sha: string; at: number }): void {
  void showChanges(ctx, seen.sha, { what: 'Since your last visit', measure: true }).then((outcome) => {
    if (!ctx.live() || !('places' in outcome) || outcome.places === 0) return;
    if (state !== null) {
      const commits = (ctx.info.commits ?? []).filter((entry) => !ctx.vocab.merge.test(entry.subject));
      let count = commits.findIndex((entry) => entry.sha === seen.sha);
      if (count < 0) {
        const at = new Date(seen.at);
        count = Number.isNaN(at.valueOf()) ? 0 : commits.filter((entry) => {
          const date = dateOf(entry.date);
          return date !== null && date > at;
        }).length;
      }
      state.visit = { base: seen.sha, at: seen.at, places: outcome.places, commits: count };
      attachPicker(ctx, state);
    }
    const strip = reviewStrip(ctx);
    if (strip === null) return;
    const show = chrome(ctx.root.ownerDocument, 'button', { className: 'linkish', text: 'Show', attrs: { type: 'button' } });
    ctx.journal.listen(show, 'click', () => {
      void showChanges(ctx, seen.sha, { what: 'Since your last visit' });
    });
    const notice = chrome(ctx.root.ownerDocument, 'p', { className: 'rs-notice' }, [
      chrome(ctx.root.ownerDocument, 'span', { className: 'dot', attrs: { 'aria-hidden': 'true' } }),
      ctx.root.ownerDocument.createTextNode(`Changed since your last visit${dateLabel(ctx, seen.at)} · ${String(outcome.places)} place${outcome.places === 1 ? '' : 's'} · `),
      show,
    ]);
    ctx.operate(() => {
      if (!ctx.live()) return;
      const focused = state !== null && !state.menu.hidden
        ? (state.menu.ownerDocument.activeElement as HTMLElement | null)?.getAttribute('data-key') ?? null
        : null;
      ctx.journal.insert(notice, strip.element, strip.element.firstChild);
      strip.place();
      if (state !== null && !state.menu.hidden) render(ctx, state, focused);
    });
  });
}

/** Attach a picker to the strip through its own journaled placement, once it has a useful comparison. */
function attachPicker(ctx: FeatureContext, state: SinceState): void {
  if (state.wrap.parentNode !== null) return;
  const strip = reviewStrip(ctx);
  if (strip === null) return;
  ctx.journal.insert(state.wrap, strip.tools, null);
  strip.place();
}

/** Build this feature during startup: the day menu and either the normal seen state or a day-version banner. */
export function build(ctx: FeatureContext): void {
  const commits = ctx.info.commits ?? [];
  if (!ctx.info.isDocument || ctx.info.sha === null || ctx.info.draft) return;
  if (ctx.info.only !== null) {
    if (!isSha(ctx.info.only) || ctx.slots === null) return;
    const entry = commits.find((commit) => ctx.info.sha?.startsWith(commit.sha) || commit.sha.startsWith(ctx.info.sha ?? '')) ?? commits[0];
    const date = entry === undefined ? null : dateOf(entry.date);
    const day = date === null ? 'an earlier day' : dayLabel(ctx, date);
    const show = ctx.host.present.has('changes') ? chrome(ctx.root.ownerDocument, 'button', { className: 'linkish ver-show', text: 'Show the changes', attrs: { type: 'button', hidden: '' } }) : null;
    const back = ctx.host.present.has('openVersion') ? chrome(ctx.root.ownerDocument, 'button', { className: 'ver-back', text: 'Back to the latest', attrs: { type: 'button' } }) : null;
    const bannerChildren: Node[] = [
      chrome(ctx.root.ownerDocument, 'span', { className: 'dot', attrs: { 'aria-hidden': 'true' } }),
      chrome(ctx.root.ownerDocument, 'span', { className: 'vb-long', text: `You're reading the version of ${day}, with that day's changes marked` }),
      chrome(ctx.root.ownerDocument, 'span', { className: 'vb-short', text: `Version of ${day} · its changes marked` }),
    ];
    if (show !== null) bannerChildren.push(chrome(ctx.root.ownerDocument, 'span', { className: 'sep', text: '·', attrs: { 'aria-hidden': 'true' } }), show);
    if (back !== null) bannerChildren.push(back);
    const banner = chrome(ctx.root.ownerDocument, 'div', { className: 'ver-banner', attrs: { role: 'region', 'aria-label': 'Older version' } }, [
      chrome(ctx.root.ownerDocument, 'p', {}, bannerChildren),
    ]);
    ctx.journal.insert(banner, ctx.slots.bar, null);
    ctx.journal.toggleClass(ctx.root, 'ver-on', true);
    if (back !== null) ctx.journal.listen(back, 'click', () => { ctx.host.openVersion({ sha: null, only: null }); });
    if (show !== null) ctx.journal.listen(show, 'click', () => { void showChanges(ctx, ctx.info.only as string, { what: `Only ${day}` }); });
    const state: OnlyState = { show, day };
    (onlyStates ??= new WeakMap()).set(ctx, state);
    ctx.journal.defer(() => {
      if (onlyStates?.get(ctx) === state) onlyStates.delete(ctx);
    });
    return;
  }
  const prior = readSeen(ctx.state.readDoc('seen'));
  ctx.state.writeDoc('seen', { sha: ctx.info.sha, at: ctx.env.now() });
  const comparisons = ctx.host.present.has('changes');
  const groups = groupsOf(ctx);
  const hasPrior = prior !== null && prior.sha !== ctx.info.sha;
  const onlyActions = ctx.host.present.has('openVersion') && groups.some((group) => group.base !== null);
  if ((!comparisons && !onlyActions) || (groups.length === 0 && !hasPrior && !onlyActions) || (commits.length < 2 && groups.length < 2 && !hasPrior && !onlyActions)) return;
  const doc = ctx.root.ownerDocument;
  const menuId = ctx.chromeId('changes-menu');
  const wrap = chrome(doc, 'span', { className: 'fact chg-pick' });
  const trigger = chrome(doc, 'button', { className: 'chg-trig', attrs: { type: 'button', 'aria-haspopup': 'menu', 'aria-expanded': 'false', 'aria-controls': menuId } }, [
    chrome(doc, 'span', { className: 'ct-label', text: 'Changes since…' }), chrome(doc, 'span', { className: 'ct-caret', text: '▾', attrs: { 'aria-hidden': 'true' } }),
  ]);
  const menu = chrome(doc, 'div', { className: 'chg-menu', attrs: { id: menuId, role: 'menu', 'aria-label': 'Show what changed', hidden: '' } });
  wrap.append(trigger, menu);
  const state: SinceState = { wrap, trigger, menu, groups, daysId: ctx.chromeId('changes-days'), actions: new Map(), selected: null, visit: null };
  (states ??= new WeakMap()).set(ctx, state);
  ctx.journal.defer(() => {
    if (states?.get(ctx) === state) states.delete(ctx);
  });
  bindKeys(ctx, state);
  if (commits.length >= 2 || groups.length >= 2 || onlyActions) attachPicker(ctx, state);
  if (hasPrior) {
    addNotice(ctx, state, prior as { sha: string; at: number });
  }
}

/** The second phase follows changes.ts's initial day view and gives the banner the winning show ticket. */
export async function after(ctx: FeatureContext): Promise<void> {
  const state = onlyStates?.get(ctx);
  const show = state?.show ?? null;
  if (state === undefined || show === null || ctx.info.only === null) return;
  await Promise.resolve();
  const outcome = await showChanges(ctx, ctx.info.only, { what: 'Only that day', jump: false });
  if (!ctx.live() || !('places' in outcome) || outcome.places === 0) return;
  ctx.operate(() => {
    if (ctx.live()) show.hidden = false;
  });
}
