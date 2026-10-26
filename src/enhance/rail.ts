// The contents rail, with its Contents and Index tabs, and its drawer on a narrow screen (the reference layout,
// section 15). Built by L2 Task 18.
//
// Consumes ctx.sections, ctx.plan, ctx.index, events (`spy`, `marks`, `changes`), keys (`i`), overlays, chromeId and
// slots.tools. Stores `<ns>:doc:<key>:ixfold`, and the tab in the UI memory (state.readUi/writeUi('sidetab')).
//
// Standard files, slug `rail`: test/enhance-rail.test.ts and test/enhance-rail-interaction.test.ts.
// Registered in features.ts, whose header says where in the build order and why.
import { queueFrameWork, type Cancel } from './env.js';
import { headingText } from './headctl.js';
import { chrome } from './journal.js';
import { showKeys } from './keysheet.js';
import type { IndexEntry, MarkState } from './registry.js';
import type { FeatureContext } from './types.js';

const INDEX_FOLD = 'ixfold';
const SIDE_TAB = 'sidetab';
const RAIL_MIN_WIDTH = 1240;

type ContentsItem = {
  readonly anchor: HTMLAnchorElement;
  readonly item: HTMLLIElement;
  readonly top: HTMLLIElement;
  readonly mark: HTMLElement;
  readonly changed: HTMLElement;
};

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readFolds(value: unknown): Set<string> {
  if (!isPlainRecord(value)) return new Set();
  return new Set(Object.entries(value).filter(([, folded]) => folded === true || folded === 1).map(([group]) => group));
}

function sourceHeadings(ctx: FeatureContext): HTMLElement[] {
  return Array.from(ctx.root.querySelectorAll('h2[id], h3[id]')).filter((heading) => !heading.hasAttribute('data-docreader-chrome')) as HTMLElement[];
}

function hasClientRects(element: Element): boolean {
  return typeof element.getClientRects === 'function' && element.getClientRects().length > 0;
}

function drawerFocusables(rail: HTMLElement): HTMLElement[] {
  return Array.from(rail.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]'))
    .filter((control) => control.tabIndex >= 0 && !control.matches(':disabled') && control.closest('[hidden]') === null && hasClientRects(control));
}

/** Build the contents rail and its narrow drawer. */
export function build(ctx: FeatureContext): void {
  if (!ctx.info.isDocument || !ctx.options.chrome.rail) return;
  const headings = sourceHeadings(ctx);
  if (headings.length === 0) return;
  const { root, journal } = ctx;
  const doc = root.ownerDocument;
  const railId = ctx.chromeId('toc');
  const contentsId = ctx.chromeId('toc-contents');
  const indexId = ctx.chromeId('toc-index');
  const tabs = chrome(doc, 'div', { className: 'toc-tabs', attrs: { role: 'tablist', 'aria-label': 'Contents and index' } });
  const contents = chrome(doc, 'div', { className: 'toc-panel toc-contents', attrs: { id: contentsId, role: 'tabpanel' } });
  const index = chrome(doc, 'div', { className: 'toc-panel toc-index', attrs: { id: indexId, role: 'tabpanel', hidden: '' } });
  const rail = chrome(doc, 'nav', { className: 'doc-toc', attrs: { id: railId, 'aria-label': 'Contents and index' } }, [tabs, contents, index]);
  const tabByName = new Map<string, { readonly button: HTMLButtonElement; readonly panel: HTMLElement }>();
  const entries = ctx.index.all();
  const contentsItems = new Map<HTMLElement, ContentsItem>();
  let tab = ctx.state.readUi(SIDE_TAB) === 'index' && entries.length > 0 ? 'index' : 'contents';
  let opener: Element | null = null;
  let drawerOpen = false;
  let fallbackPrepared = false;
  let active: ContentsItem | null = null;
  let pendingFollow: ContentsItem | null = null;
  let scheduledFollow: Cancel | null = null;

  const setTab = (name: string, remember: boolean): void => {
    const next = tabByName.get(name) ?? tabByName.get('contents');
    if (next === undefined) return;
    tab = name;
    for (const [, pair] of tabByName) {
      const selected = pair === next;
      journal.setAttribute(pair.button, 'aria-selected', String(selected));
      journal.setAttribute(pair.button, 'tabindex', selected ? '0' : '-1');
      journal.setAttribute(pair.panel, 'hidden', selected ? null : '');
    }
    if (remember) ctx.state.writeUi(SIDE_TAB, name);
  };

  const addTab = (name: string, panel: HTMLElement, count: number | null = null): void => {
    const id = ctx.chromeId(`tab-${name.toLowerCase()}`);
    const children: Node[] = [doc.createTextNode(name)];
    if (count !== null) children.push(chrome(doc, 'span', { className: 'count', text: ` ${String(count)}` }));
    const button = chrome(doc, 'button', { attrs: { type: 'button', id, role: 'tab', 'aria-controls': panel.id, 'aria-selected': 'false', tabindex: '-1' } }, children);
    panel.setAttribute('aria-labelledby', id);
    tabs.append(button);
    tabByName.set(name.toLowerCase(), { button, panel });
    journal.listen(button, 'click', () => setTab(name.toLowerCase(), true));
  };

  addTab('Contents', contents);
  if (entries.length > 0) addTab('Index', index, entries.length);

  const list = chrome(doc, 'ul');
  let top: HTMLLIElement | null = null;
  let subitems: HTMLUListElement | null = null;
  for (const heading of headings) {
    if (heading.localName === 'h2') {
      top = chrome(doc, 'li');
      subitems = null;
      list.append(top);
    } else if (top === null) {
      continue;
    } else if (subitems === null) {
      subitems = chrome(doc, 'ul');
      top.append(subitems);
    }
    const item = heading.localName === 'h2' ? top : chrome(doc, 'li');
    if (item === null) continue;
    const mark = chrome(doc, 'span', { className: 'mk', attrs: { 'aria-hidden': 'true' } });
    const changed = chrome(doc, 'span', { className: 'cd', attrs: { title: 'Changed in the comparison you are viewing' } });
    const label = chrome(doc, 'span', { className: 't', text: headingText(heading, (element) => element.hasAttribute('data-docreader-chrome')) });
    const meta = chrome(doc, 'span', { className: 'meta' }, [changed, mark]);
    const anchor = chrome(doc, 'a', { attrs: { href: `#${heading.id}` } }, [label, meta]);
    item.append(anchor);
    if (subitems !== null && heading.localName === 'h3') subitems.append(item);
    contentsItems.set(heading, { anchor, item, top: top as HTMLLIElement, mark, changed });
  }
  contents.append(list);

  const folded = readFolds(ctx.state.readDoc(INDEX_FOLD));
  const groups = new Map<string, IndexEntry[]>();
  for (const entry of entries) {
    const group = entry.group === '' ? 'Definitions' : entry.group;
    const held = groups.get(group);
    if (held === undefined) groups.set(group, [entry]);
    else held.push(entry);
  }
  const groupOrder = [...groups].map(([group, groupEntries], order) => ({
    group,
    groupEntries,
    order,
    statuses: groupEntries.filter((entry) => entry.status !== null).length,
  })).sort((left, right) => {
    const leftDense = left.statuses >= 3;
    const rightDense = right.statuses >= 3;
    return Number(rightDense) - Number(leftDense) || (leftDense ? right.statuses - left.statuses : 0) || left.order - right.order;
  });
  const statusText = (entry: IndexEntry): string | null => {
    if (entry.status === null) return null;
    if (entry.kind === 'rule') {
      const pill = entry.target.querySelector('.rule-head > .pill');
      return pill?.textContent?.replace(/\s+/g, ' ').trim() || null;
    }
    if (entry.kind === 'row') {
      const pills = Array.from(entry.target.querySelectorAll('.pill')).filter((pill) => pill.hasAttribute('data-docreader-chrome'));
      return pills.at(-1)?.textContent?.replace(/\s+/g, ' ').trim() || null;
    }
    return null;
  };
  for (const { group, groupEntries } of groupOrder) {
    const groupId = ctx.chromeId('index-group');
    const closed = folded.has(group);
    const button = chrome(doc, 'button', { className: 'ix-group', attrs: { type: 'button', 'aria-controls': groupId, 'aria-expanded': String(!closed) } }, [
      chrome(doc, 'span', { className: 'gt', text: group }),
      chrome(doc, 'span', { className: 'c', text: String(groupEntries.length) }),
    ]);
    const groupList = chrome(doc, 'ul', { attrs: { id: groupId, ...(closed ? { hidden: '' } : {}) } });
    for (const entry of groupEntries) {
      const status = statusText(entry);
      const tooltip = `${entry.id} · ${entry.title}${status === null ? '' : ` (${status})`}`;
      const dot = entry.status === null
        ? chrome(doc, 'span', { className: 'dot none', attrs: { 'aria-hidden': 'true' } })
        : chrome(doc, 'span', { className: `dot ${entry.status}`, attrs: { role: 'img', 'aria-label': status ?? entry.status } });
      const id = chrome(doc, 'span', { className: `ix-id${entry.id.length > 6 ? ' long' : ''}`, text: entry.id });
      const title = chrome(doc, 'span', { className: 't', text: entry.title });
      const anchor = chrome(doc, 'a', { className: 'ix', attrs: { href: `#${entry.id}`, title: tooltip } }, [id, title, dot]);
      groupList.append(chrome(doc, 'li', {}, [anchor]));
    }
    journal.listen(button, 'click', () => {
      const open = groupList.hasAttribute('hidden');
      journal.setAttribute(groupList, 'hidden', open ? null : '');
      journal.setAttribute(button, 'aria-expanded', String(open));
      if (open) folded.delete(group);
      else folded.add(group);
      if (folded.size === 0) ctx.state.writeDoc(INDEX_FOLD, null);
      else {
        const saved = Object.create(null) as Record<string, true>;
        for (const name of folded) saved[name] = true;
        ctx.state.writeDoc(INDEX_FOLD, saved);
      }
    });
    index.append(button, groupList);
  }

  const contentsButton = chrome(doc, 'button', { className: 'toc-btn', text: 'Contents', attrs: { type: 'button', 'aria-controls': railId, 'aria-expanded': 'false' } });
  const scrim = chrome(doc, 'div', { className: 'toc-scrim', attrs: { hidden: '' } });
  const focusBack = (fromScrim = false): void => {
    const focused = doc.activeElement;
    const parent = focused?.parentElement ?? null;
    const focusedBody = focused !== null
      && parent?.localName === 'html'
      && parent.namespaceURI === 'http://www.w3.org/1999/xhtml'
      && parent.parentNode === doc
      && Array.from(parent.children).find((child) => child.namespaceURI === 'http://www.w3.org/1999/xhtml' && (child.localName === 'body' || child.localName === 'frameset')) === focused;
    if (!focusedBody && !rail.contains(focused) && !(fromScrim === true && focused === root)) return;
    if (opener !== null && opener.isConnected) {
      (opener as HTMLElement).focus({ preventScroll: true });
      return;
    }
    if (contentsButton.isConnected) contentsButton.focus({ preventScroll: true });
    else root.focus({ preventScroll: true });
  };
  const close = (fromScrim = false): void => {
    if (!drawerOpen) return;
    drawerOpen = false;
    journal.toggleClass(root, 'toc-open', false);
    journal.setAttribute(contentsButton, 'aria-expanded', 'false');
    journal.setAttribute(scrim, 'hidden', '');
    journal.setAttribute(rail, 'role', null);
    journal.setAttribute(rail, 'aria-modal', null);
    focusBack(fromScrim);
  };
  const indexControl = (): HTMLElement | null => tabByName.get('index')?.button ?? null;
  const open = (focusIndex = false): void => {
    if (ctx.env.viewport().w >= RAIL_MIN_WIDTH) {
      if (focusIndex) indexControl()?.focus({ preventScroll: true });
      return;
    }
    if (drawerOpen) {
      if (focusIndex) indexControl()?.focus({ preventScroll: true });
      return;
    }
    opener = doc.activeElement;
    if (!fallbackPrepared) {
      fallbackPrepared = true;
      if (!root.hasAttribute('tabindex')) journal.setAttribute(root, 'tabindex', '-1');
      // This is registered after the attribute so reverse undo returns focus before restoring it.
      journal.defer(close);
    }
    drawerOpen = true;
    journal.toggleClass(root, 'toc-open', true);
    journal.setAttribute(contentsButton, 'aria-expanded', 'true');
    journal.setAttribute(scrim, 'hidden', null);
    journal.setAttribute(rail, 'role', 'dialog');
    journal.setAttribute(rail, 'aria-modal', 'true');
    (focusIndex ? indexControl() : tabByName.get(tab)?.button ?? contentsButton)?.focus({ preventScroll: true });
  };
  const trapTab = (event: KeyboardEvent): void => {
    if (event.key !== 'Tab' || !drawerOpen) return;
    const controls = drawerFocusables(rail);
    if (controls.length === 0) return;
    const first = controls[0] as HTMLElement;
    const last = controls.at(-1) as HTMLElement;
    if (event.shiftKey && doc.activeElement === first) {
      event.preventDefault();
      last.focus({ preventScroll: true });
    } else if (!event.shiftKey && doc.activeElement === last) {
      event.preventDefault();
      first.focus({ preventScroll: true });
    }
  };
  journal.listen(contentsButton, 'click', () => {
    if (drawerOpen) close();
    else open();
  });
  journal.listen(scrim, 'click', () => close(true));
  journal.listen(rail, 'click', (event) => {
    const mouse = event as MouseEvent;
    if (mouse.defaultPrevented || mouse.button !== 0 || mouse.ctrlKey || mouse.metaKey || mouse.shiftKey || mouse.altKey) return;
    const link = (mouse.target as Element).closest('a[href]');
    if (link === null || !rail.contains(link)) return;
    const href = link.getAttribute('href') ?? '';
    if (!href.startsWith('#')) return;
    let id = href.slice(1);
    try {
      id = decodeURIComponent(id);
    } catch {
      // Keep the drawer open when navigation cannot resolve the malformed fragment.
    }
    if (ctx.nav.byId(id) !== null) close();
  });
  journal.listen(rail, 'keydown', (event) => {
    const key = (event as KeyboardEvent).key;
    if (key === 'Escape' && drawerOpen) {
      event.preventDefault();
      close();
    } else trapTab(event as KeyboardEvent);
  });
  journal.defer(ctx.overlays.register('drawer', { isOpen: () => drawerOpen, close }));
  journal.insert(rail, root, root.firstChild);
  journal.insert(scrim, root, null);
  if (ctx.slots !== null) ctx.slots.tool('contents', contentsButton);
  journal.toggleClass(root, 'has-toc', true);
  journal.listen(tabs, 'keydown', (event) => {
    const key = (event as KeyboardEvent).key;
    if ((key !== 'ArrowLeft' && key !== 'ArrowRight') || tabByName.size < 2) return;
    const name = tab === 'contents' ? 'index' : 'contents';
    setTab(name, true);
    if (!ctx.live()) return;
    tabByName.get(name)?.button.focus({ preventScroll: true });
    event.preventDefault();
  });
  ctx.keys.bind({
    key: 'i',
    label: 'Open index',
    when: () => tabByName.has('index'),
    run: () => {
      setTab('index', true);
      if (!ctx.live()) return;
      open(true);
    },
  });
  const keys = chrome(doc, 'button', { className: 'linkish keys-btn', text: 'Keys', attrs: { type: 'button' } });
  journal.listen(keys, 'click', () => showKeys(ctx));
  const foot = chrome(doc, 'div', { className: 'toc-foot' }, [keys]);
  journal.insert(foot, rail, null);

  const paintMark = (item: ContentsItem, state: MarkState): void => {
    journal.toggleClass(item.mark, 'read', state === 'read');
    journal.toggleClass(item.mark, 'changed', state === 'changed');
    item.mark.textContent = state === 'read' ? '✓' : '';
    journal.setAttribute(item.anchor, 'aria-description', state === 'unread' ? null : state === 'read' ? 'read' : 'changed since you read it');
  };
  for (const [heading, item] of contentsItems) {
    const control = heading.querySelector('.h-mark');
    paintMark(item, control?.classList.contains('changed') ? 'changed' : control?.classList.contains('on') ? 'read' : 'unread');
  }
  journal.defer(ctx.events.on('marks', ({ units }) => {
    for (const { heading, state } of units) {
      const item = contentsItems.get(heading);
      if (item !== undefined) paintMark(item, state);
    }
  }));
  journal.defer(ctx.events.on('changes', ({ sections }) => {
    const changed = new Set(sections);
    for (const [heading, item] of contentsItems) {
      const on = heading.localName === 'h2' && changed.has(heading);
      journal.toggleClass(item.item, 'has-chg', on);
      journal.toggleClass(item.changed, 'on', on);
    }
  }));
  const ownsFollow = (next: ContentsItem): boolean =>
    ctx.live()
    && root.isConnected
    && contents.isConnected
    && next.anchor.isConnected
    && active === next
    && root.contains(contents)
    && contents.contains(next.anchor)
    && tab === 'contents'
    && !drawerOpen
    && !contents.hasAttribute('hidden');
  const follow = (): void => {
    scheduledFollow = null;
    const next = pendingFollow;
    pendingFollow = null;
    if (next === null || !ownsFollow(next)) return;
    if (!ownsFollow(next) || !hasClientRects(next.anchor)) return;
    if (!ownsFollow(next)) return;
    const linkRect = next.anchor.getBoundingClientRect();
    if (!ownsFollow(next)) return;
    const panelRect = contents.getBoundingClientRect();
    if (!ownsFollow(next) || !(panelRect.height > 0)) return;
    if (linkRect.top >= panelRect.top + 60 && linkRect.bottom <= panelRect.bottom - 60) return;
    const before = contents.scrollTop;
    if (!ownsFollow(next)) return;
    contents.scrollTop = before + linkRect.top - panelRect.top - panelRect.height / 2;
  };
  const scheduleFollow = (next: ContentsItem): void => {
    pendingFollow = next;
    scheduledFollow?.();
    scheduledFollow = queueFrameWork(root, 'rail', follow);
  };
  journal.defer(() => {
    scheduledFollow?.();
    scheduledFollow = null;
    pendingFollow = null;
  });
  journal.defer(ctx.events.on('spy', ({ section, unit }) => {
    const target = unit ?? section;
    const next = target === null ? null : contentsItems.get(target) ?? null;
    if (next === active) return;
    if (active !== null) {
      journal.toggleClass(active.anchor, 'active', false);
      journal.setAttribute(active.anchor, 'aria-current', null);
      journal.toggleClass(active.top, 'open', false);
    }
    active = next;
    if (next === null) {
      pendingFollow = null;
      scheduledFollow?.();
      scheduledFollow = null;
      return;
    }
    journal.toggleClass(next.anchor, 'active', true);
    journal.setAttribute(next.anchor, 'aria-current', 'location');
    journal.toggleClass(next.top, 'open', true);
    scheduleFollow(next);
  }));

  setTab(tab, false);
}
