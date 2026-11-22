// The guided layout's Contents: the shared Contents-only rail and drawer (src/enhance/layouts/contents.ts, which the
// editorial layout builds too) with each section's reading time beside its link, as the reference's direction C shows it.
//
// The shared build is called as it is; this adds one chrome span to each top-level link of the rail it made, from the
// document's sections as the shared steps measured them (ctx.sections: a section's minutes, before any feature moved a
// node). A section under a minute shows none, as the fold notes of the default layout do. Nothing is added when the page
// has no rail (not a document, a host that built its own, no headings).
import { chrome } from '../../journal.js';
import { formatMinutes } from '../../reading.js';
import type { FeatureContext } from '../../types.js';
import { build as buildContents } from '../contents.js';

/** Build the rail, then the times. */
export function build(ctx: FeatureContext): void {
  buildContents(ctx, 'editorial');
  const rail = ctx.root.querySelector('nav.doc-toc');
  if (rail === null) return;
  const minutes = new Map<string, number>(ctx.sections.map((u) => [`#${u.heading.id}`, u.minutes]));
  for (const link of Array.from(rail.querySelectorAll(':scope > ul > li > a'))) {
    const time = formatMinutes(minutes.get(link.getAttribute('href') as string) ?? 0);
    if (time !== '') ctx.journal.insert(chrome(ctx.root.ownerDocument, 'span', { className: 'gd-rt', text: time }), link, null);
  }
}
