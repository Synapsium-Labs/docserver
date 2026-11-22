// What the review layout adds to the shared rail (rail.ts, which this layout builds as the default does): at the top of the
// Contents tab a link to what waits on the reader, with its count, and in the rail's footer how many sections are read.
//
// The shared rail is not edited: this module puts two new chrome nodes into the panel and the footer it already made, through
// the journal, so teardown takes them out. The link is an ordinary fragment link to the "Waiting on you" box's heading, which
// the reader's navigation and the rail's own click handling (the drawer closes) already serve. The count reads the marks
// feature's controls and follows its `marks` event, as the header card does.
//
// Built after `rail` and `strip`. Nothing is added when the page has no rail (a page that is not a document).
import { chrome } from '../../journal.js';
import type { FeatureContext } from '../../types.js';
import { readControls } from './header.js';

/** Build the rail additions. */
export function build(ctx: FeatureContext): void {
  const { root, journal } = ctx;
  const doc = root.ownerDocument;
  const rail = root.querySelector('.doc-toc');
  if (rail === null) return;
  // The shared rail always makes both.
  const panel = rail.querySelector('.toc-contents') as HTMLElement;
  const foot = rail.querySelector('.toc-foot') as HTMLElement;
  const heading = ctx.page.waitBox?.querySelector('h3') ?? null;
  if (heading !== null) {
    const link = chrome(doc, 'a', { className: 'rv-wait', attrs: { href: `#${heading.id}` } }, [
      chrome(doc, 'span', { text: 'Waiting on you' }),
      chrome(doc, 'span', { className: 'rv-count', text: String(ctx.page.waiting.length) }),
    ]);
    journal.insert(link, panel, panel.firstChild);
  }
  if (readControls(root).length === 0) return;
  const read = chrome(doc, 'span', { className: 'rv-foot-read' });
  journal.insert(read, foot, foot.firstChild);
  const paint = (): void => {
    const all = readControls(root);
    read.textContent = `${String(all.filter((c) => c.classList.contains('on')).length)} of ${String(all.length)} read`;
  };
  journal.defer(ctx.events.on('marks', paint));
  paint();
}
