// The guided layout's Contents: the shared Contents-only rail and drawer (src/enhance/layouts/contents.ts, which the
// editorial layout builds too) with each section's reading time beside its link, as the reference's direction C shows it.
//
// The shared build is called as it is; this adds one chrome span to each top-level link of the rail it made, stamped with the
// section's time under the reader's lens (times.ts), so it changes with the lens. A section under a minute (Engineering's
// reckoning) gets no span; one that shrinks below a minute under Product gets an empty one, which the stylesheet hides. Nothing is added when the page has no rail (not a document, a host that built
// its own, no headings), and a link whose heading is not a section of the document has no time.
import { chrome } from '../../journal.js';
import { contributionMinutes, formatMinutes } from '../../reading.js';
import type { FeatureContext } from '../../types.js';
import { build as buildContents } from '../contents.js';
import { contributionOf, stamp } from './times.js';

/** Build the rail, then the times. */
export function build(ctx: FeatureContext): void {
  buildContents(ctx, 'editorial');
  const rail = ctx.root.querySelector('nav.doc-toc');
  if (rail === null) return;
  const sections = new Map<string, Element>(ctx.sections.map((u) => [`#${u.heading.id}`, u.heading]));
  for (const link of Array.from(rail.querySelectorAll(':scope > ul > li > a'))) {
    const heading = sections.get(link.getAttribute('href') as string);
    if (heading === undefined) continue;
    const c = contributionOf(ctx, heading);
    // A section under a minute under Engineering has no time to show; under Product one that shrinks below it shows none either.
    if (contributionMinutes(c[0], c[1], c[2]) >= 1) ctx.journal.insert(stamp(ctx, chrome(ctx.root.ownerDocument, 'span', { className: 'gd-rt' }), c, formatMinutes), link, null);
  }
}
