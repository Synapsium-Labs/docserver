import { chrome } from '../../journal.js';
import { queueFrameWork, type Cancel } from '../../env.js';
import { headingText } from '../../headctl.js';
import type { FeatureContext } from '../../types.js';

/** Classic's contents and narrow-screen drawer. */
export function build(ctx: FeatureContext): void {
  if (!ctx.info.isDocument || !ctx.options.chrome.rail) return;
  const { root, journal } = ctx;
  const doc = root.ownerDocument;
  const headings = Array.from(root.querySelectorAll<HTMLElement>('h2[id], h3[id]'));
  if (headings.length === 0) return;
  const id = ctx.chromeId('toc');
  const collapse = chrome(doc, 'button', { text: 'Collapse', attrs: { type: 'button' } });
  const head = chrome(doc, 'div', { className: 'toc-head' }, [chrome(doc, 'span', { className: 'toc-title', text: 'Contents' }), collapse]);
  const list = chrome(doc, 'ul');
  const rail = chrome(doc, 'nav', { className: 'doc-toc', attrs: { id, 'aria-label': 'Contents' } }, [head, list]);
  const button = chrome(doc, 'button', { className: 'toc-btn', text: 'Contents', attrs: { type: 'button', 'aria-controls': id, 'aria-expanded': 'false' } });
  const scrim = chrome(doc, 'div', { className: 'toc-scrim', attrs: { hidden: '' } });
  const chips = chrome(doc, 'nav', { className: 'chips', attrs: { 'aria-label': 'Sections' } });
  // Numbered headings retain their original label when the badge and separator become chrome.
  const link = (heading: HTMLElement): HTMLAnchorElement => chrome(doc, 'a', {
    text: heading.getAttribute('aria-label') ?? headingText(heading, (el) => el.hasAttribute('data-docreader-chrome')),
    attrs: { href: `#${heading.id}` },
  });
  for (const heading of headings.filter((h) => h.localName === 'h2')) chips.append(link(heading));
  const title = root.querySelector('h1');
  if (title !== null && title.parentNode === root) {
    const next = title.nextElementSibling;
    const after = next?.localName === 'p' ? next : title;
    journal.insert(chips, root, after.nextSibling);
  }
  const items = new Map<HTMLElement, { anchor: HTMLAnchorElement; top: HTMLLIElement }>();
  let top: HTMLLIElement | null = null;
  let sub: HTMLUListElement | null = null;
  for (const heading of headings) {
    if (heading.localName === 'h2') {
      top = chrome(doc, 'li');
      list.append(top);
      sub = null;
    } else if (top === null) continue;
    else if (sub === null) {
      sub = chrome(doc, 'ul');
      top.append(sub);
    }
    const anchor = link(heading);
    if (heading.localName === 'h2') top!.prepend(anchor);
    else sub!.append(chrome(doc, 'li', {}, [anchor]));
    items.set(heading, { anchor, top: top! });
  }
  let opened = false;
  let opener: HTMLElement | null = null;
  const close = (): void => {
    if (!opened) return;
    opened = false;
    journal.toggleClass(root, 'toc-open', false);
    journal.setAttribute(button, 'aria-expanded', 'false');
    journal.setAttribute(scrim, 'hidden', '');
    journal.setAttribute(rail, 'role', null);
    journal.setAttribute(rail, 'aria-modal', null);
    if (opener?.isConnected) opener.focus({ preventScroll: true });
  };
  const open = (): void => {
    if (ctx.env.viewport().w >= 1240 || ctx.overlays.any()) return;
    opener = doc.activeElement as HTMLElement | null;
    opened = true;
    journal.toggleClass(root, 'toc-open', true);
    journal.setAttribute(button, 'aria-expanded', 'true');
    journal.setAttribute(scrim, 'hidden', null);
    journal.setAttribute(rail, 'role', 'dialog');
    journal.setAttribute(rail, 'aria-modal', 'true');
    if (active !== undefined) {
      journal.toggleClass(active.top, 'open', true);
      follow(active);
    }
    collapse.focus({ preventScroll: true });
  };
  journal.listen(button, 'click', () => { if (opened) close(); else open(); });
  ctx.commands.register('contents', () => {
    if (opened) { close(); return true; }
    if (ctx.env.viewport().w >= 1240 || ctx.overlays.any()) return false;
    open();
    return true;
  });
  journal.listen(scrim, 'click', close);
  journal.listen(rail, 'keydown', (event) => {
    const key = event as KeyboardEvent;
    if (!opened) return;
    if (key.key === 'Escape') { key.preventDefault(); close(); return; }
    if (key.key !== 'Tab') return;
    const controls = Array.from(rail.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'))
      .filter((el) => el.tabIndex >= 0 && !el.matches(':disabled') && el.closest('[hidden]') === null && el.getClientRects().length > 0);
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (first === undefined || last === undefined) { key.preventDefault(); return; }
    if (key.shiftKey && doc.activeElement === first) { key.preventDefault(); last.focus(); }
    else if (!key.shiftKey && doc.activeElement === last) { key.preventDefault(); first.focus(); }
  });
  ctx.env.onResize(() => { if (opened && ctx.env.viewport().w >= 1240) close(); });
  journal.listen(rail, 'click', (event) => {
    const target = event.target as Node | null;
    const element = target?.nodeType === 1 ? target as Element : target?.parentElement;
    const href = element?.closest('a[href]')?.getAttribute('href');
    if (href?.startsWith('#') === true && ctx.nav.byId(href.slice(1)) !== null) close();
  });
  journal.listen(collapse, 'click', () => { for (const item of items.values()) journal.toggleClass(item.top, 'open', false); });
  journal.defer(ctx.overlays.register('drawer', { isOpen: () => opened, close }));
  journal.defer(close);
  const tracked = headings.filter((heading) => items.has(heading));
  let active: { anchor: HTMLAnchorElement; top: HTMLLIElement } | undefined;
  let scheduled: Cancel | null = null;
  function follow(item: { anchor: HTMLAnchorElement }): void {
    if (rail.getClientRects().length === 0 || item.anchor.getClientRects().length === 0) return;
    const panel = rail.getBoundingClientRect();
    const link = item.anchor.getBoundingClientRect();
    if (panel.height > 0 && (link.top < panel.top + 40 || link.bottom > panel.bottom - 20)) {
      rail.scrollTop += link.top - panel.top - panel.height / 2;
    }
  }
  const spy = (): void => {
    scheduled = null;
    const line = Math.max(150, ctx.env.viewport().h * 0.3);
    let lo = 0;
    let hi = tracked.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (tracked[mid]!.getBoundingClientRect().top < line) lo = mid + 1;
      else hi = mid;
    }
    const next = lo === 0 ? undefined : items.get(tracked[lo - 1]!);
    if (next === active) return;
    if (active !== undefined) {
      journal.toggleClass(active.anchor, 'active', false);
      journal.setAttribute(active.anchor, 'aria-current', null);
      journal.toggleClass(active.top, 'open', false);
    }
    active = next;
    if (next === undefined) return;
    journal.toggleClass(next.anchor, 'active', true);
    journal.setAttribute(next.anchor, 'aria-current', 'location');
    journal.toggleClass(next.top, 'open', true);
    follow(next);
  };
  const schedule = (): void => { scheduled ??= queueFrameWork(root, 'rail', spy); };
  ctx.env.onScroll(schedule);
  journal.defer(ctx.events.on('relayout', () => {
    scheduled?.();
    scheduled = null;
    spy();
  }));
  journal.defer(() => { scheduled?.(); scheduled = null; });
  journal.insert(rail, root, root.firstChild);
  journal.insert(scrim, root, null);
  if (ctx.slots !== null) ctx.slots.tool('contents', button);
  journal.toggleClass(root, 'has-toc', true);
  spy();
}
