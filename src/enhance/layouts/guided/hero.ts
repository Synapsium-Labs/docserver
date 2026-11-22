// The guided layout's hero (the reference's direction C): the title block the shared editorial feature built (the eyebrow,
// the title, the byline and the facts panel) moved into one header, with the "In short" box when it opens the document (within three blocks of the title block),
// and under it a glance: how long "In short" and the whole document take (under the reader's lens), what the document holds and a link to what waits on the reader.
//
// Nothing here reads the document again. The header moves the block's own nodes (journal.wrap, so teardown puts them back);
// the glance is new chrome from what the shared steps published (ctx.sections, ctx.blocks, ctx.page). The bar's "Skip to the
// text" link, which the bar sends to the first node that is not chrome, is sent on to the title, which the header now holds.
//
// Built after `editorial` (the block exists) and `tables`. A page that is not a document gets no hero.
import { CHROME_ATTR, chrome, siblingRun } from '../../journal.js';
import { formatLong, type ReadingContribution } from '../../reading.js';
import type { FeatureContext } from '../../types.js';
import { isStand } from './sections.js';
import { contributionOf, stamp, wholeDocument } from './times.js';

const plural = (n: number, one: string): string => `${String(n)} ${one}${n === 1 ? '' : 's'}`;

/** Build the hero. */
export function build(ctx: FeatureContext): void {
  const { root, journal } = ctx;
  const doc = root.ownerDocument;
  const title = ctx.info.isDocument ? Array.from(root.children).find((c) => c.localName === 'h1' && !c.hasAttribute(CHROME_ATTR)) : undefined;
  if (title === undefined) return;
  let first: Element = title;
  const before = title.previousElementSibling;
  if (before !== null && before.classList.contains('eyebrow') && before.hasAttribute(CHROME_ATTR)) first = before;
  let last: Element = title;
  // The parts that follow the title: the byline and the facts panel, and hidden source nodes (the meta line).
  for (let n = title.nextElementSibling; n !== null; n = n.nextElementSibling) {
    if (n.hasAttribute('hidden') || n.matches('dl.byline, details.doc-facts')) last = n;
    else break;
  }
  const hero = chrome(doc, 'header', { className: 'gd-hero' });
  journal.wrap(siblingRun(first, last.nextSibling), hero);
  // "In short" joins the hero when it opens the document: within the three blocks after the title block.
  let near = hero.nextElementSibling;
  for (let i = 0; i < 2 && near !== null && !near.matches('div.short'); i += 1) near = near.nextElementSibling;
  if (near?.matches('div.short') === true) journal.move(near, hero, null);

  const skip = ctx.slots?.skip ?? null;
  if (skip !== null) {
    journal.listen(skip, 'click', () => {
      journal.setAttribute(title, 'tabindex', '-1');
      (title as HTMLElement).scrollIntoView({ block: 'start' });
      (title as HTMLElement).focus({ preventScroll: true });
    });
  }

  const item = (key: string, value: Node): HTMLElement =>
    chrome(doc, 'span', { className: 'gd-gl' }, [chrome(doc, 'span', { className: 'gd-gk', text: key }), value]);
  const time = (c: ReadingContribution): HTMLElement => stamp(ctx, chrome(doc, 'span'), c, formatLong);
  const glance = chrome(doc, 'div', { className: 'gd-glance' });
  const box = hero.querySelector(':scope > div.short');
  const summary = ctx.sections.find((u) => box?.contains(u.heading) === true);
  if (summary !== undefined) glance.append(item('In short', time(contributionOf(ctx, summary.heading))));
  glance.append(item('Whole document', time(wholeDocument(ctx))));
  const sections = Array.from(root.children).filter((c) => c.localName === 'h2' && !isStand(ctx, c)).length;
  const figures = root.querySelectorAll('figure.mermaid-figure').length;
  const tables = ctx.blocks.filter((b) => b.kind === 'table').length;
  const holds = [sections > 0 ? plural(sections, 'section') : '', figures > 0 ? plural(figures, 'figure') : '', tables > 0 ? plural(tables, 'table') : ''].filter((s) => s !== '');
  if (holds.length > 0) glance.append(item('Contains', doc.createTextNode(holds.join(' · '))));
  const heading = ctx.page.waitBox?.querySelector('h3') ?? null;
  if (heading !== null) {
    const n = ctx.page.waiting.length;
    glance.append(chrome(doc, 'a', { className: 'gd-gl gd-wait', attrs: { href: `#${heading.id}` } }, [
      chrome(doc, 'span', { className: 'gd-gk', text: 'Waiting on you' }),
      doc.createTextNode(`${plural(n, 'item')} →`),
    ]));
  }
  journal.insert(glance, hero, null);
}
