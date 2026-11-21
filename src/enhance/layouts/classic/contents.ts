import { chrome } from '../../journal.js';
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
    const anchor = chrome(doc, 'a', { text: headingText(heading, (el) => el.hasAttribute('data-docreader-chrome')), attrs: { href: `#${heading.id}` } });
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
    collapse.focus({ preventScroll: true });
  };
  journal.listen(button, 'click', () => { if (opened) close(); else open(); });
  journal.listen(scrim, 'click', close);
  journal.listen(rail, 'keydown', (event) => { if ((event as KeyboardEvent).key === 'Escape' && opened) { event.preventDefault(); close(); } });
  journal.listen(rail, 'click', (event) => {
    const link = (event.target as Element).closest('a[href^="#"]');
    if (link !== null && ctx.nav.byId((link.getAttribute('href') ?? '').slice(1)) !== null) close();
  });
  journal.listen(collapse, 'click', () => { for (const item of items.values()) journal.toggleClass(item.top, 'open', false); });
  journal.defer(ctx.overlays.register('drawer', { isOpen: () => opened, close }));
  journal.defer(close);
  journal.defer(ctx.events.on('spy', ({ section, unit }) => {
    const active = items.get(unit ?? section as HTMLElement);
    for (const item of items.values()) {
      const current = item === active;
      journal.toggleClass(item.anchor, 'active', current);
      journal.setAttribute(item.anchor, 'aria-current', current ? 'location' : null);
      journal.toggleClass(item.top, 'open', active?.top === item.top);
    }
  }));
  journal.insert(rail, root, root.firstChild);
  journal.insert(scrim, root, null);
  if (ctx.slots !== null) ctx.slots.tool('contents', button);
  journal.toggleClass(root, 'has-toc', true);
}
