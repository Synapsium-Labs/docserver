import { chrome, siblingRun } from '../../journal.js';
import { noFacts } from '../../registry.js';
import type { FeatureContext } from '../../types.js';

/** Classic's boxes and section numbers, without the editorial title block. */
export function build(ctx: FeatureContext): void {
  const { root, journal } = ctx;
  const doc = root.ownerDocument;
  const headings = Array.from(root.querySelectorAll('h2[id]'));
  const label = (h: Element): string => (h.textContent ?? '').trim();
  const wrap = (h: Element, cls: string, stops: readonly string[]): HTMLElement => {
    let end = h.nextElementSibling;
    while (end !== null && !stops.includes(end.localName)) end = end.nextElementSibling;
    const box = chrome(doc, 'div', { className: cls });
    journal.wrap(siblingRun(h, end), box);
    return box;
  };
  const short = headings.find((h) => ctx.vocab.box.short.test(label(h)));
  if (short !== undefined) wrap(short, 'short', ['h1', 'h2', 'hr']);
  let waitBox: HTMLElement | null = null;
  const waiting: HTMLElement[] = [];
  const stand = headings.find((h) => ctx.vocab.box.stand.test(label(h)));
  if (stand !== undefined) {
    const sub: Element[] = [];
    for (let n = stand.nextElementSibling; n !== null && n.localName !== 'h1' && n.localName !== 'h2'; n = n.nextElementSibling) {
      if (n.localName === 'h3') sub.push(n);
    }
    for (const h of sub) {
      const text = label(h);
      const v = ctx.vocab.callout;
      const kind = v.agreed.test(text) ? 'agreed' : v.waiting.test(text) ? 'waiting' : v.later.test(text) ? 'later' : 'other';
      const box = wrap(h, `callout ${kind}`, ['h1', 'h2', 'h3', 'hr']);
      if (kind === 'waiting' && waitBox === null) {
        waitBox = box;
        waiting.push(...Array.from(box.querySelectorAll<HTMLElement>(':scope > ul > li, :scope > ol > li')));
      }
    }
  }
  for (const h of headings) {
    const text = h.firstChild;
    if (text === null || text.nodeType !== 3) continue;
    const match = /^(\d+)\.\s+/.exec((text as Text).data);
    if (match === null || match[1] === undefined) continue;
    if (!h.hasAttribute('aria-label') && !h.hasAttribute('aria-labelledby')) journal.setAttribute(h, 'aria-label', label(h));
    const separator = journal.split(text as Text, match[1].length);
    if (match[0].length - match[1].length < separator.data.length) journal.split(separator, match[0].length - match[1].length);
    journal.wrap([text], chrome(doc, 'span', { className: 'sec-no' }));
    journal.wrap([separator], chrome(doc, 'span', { attrs: { hidden: '' } }));
  }
  ctx.page.publish({ byline: null, facts: noFacts(), waiting, waitBox });
}
