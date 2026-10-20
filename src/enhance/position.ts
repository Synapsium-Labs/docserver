// The reading position, kept across reloads, the section link and the `j` and `k` keys (docserver L2, Task 14), from
// the reference layout's sections 27, 19 (its `#` link) and 25 (`j` and `k`). Navigation itself, the place, the pin
// and the flash are nav.ts's; this feature uses them through ctx.nav and placeOf(ctx.nav).
//
//   The section link   a chrome `a.h-anchor` ("#", href `#<id>`, titled "Link to this section", named "Link to <the
//                      heading's title without its number>") in the `anchor` slot of each level-2 and level-3 heading
//                      that is the document's element of its id (headCtl), except the "In short" box's heading, as in
//                      the reference. A click is the delegated hash click of nav.ts: goTo, with push true.
//   `j` and `k`        `j`: the next section's heading; `k`: this section's start, or the previous section's when the
//                      reader is within 40 px below this one's start (the bar's bottom less 40 px). Each through goTo with
//                      push false; nothing, and the key's default left alone, past either end. The sections are
//                      ctx.sections' headings. The current section is the last `spy` event's (scroll.ts), once one has
//                      come; before that it is found at the reading line (the reference's: 30% of the viewport's
//                      height, at least 150 px), the last section heading above it.
//   Landing            once every block is built (this feature is built last): `initialHash`, when given, wins: the
//                      element it names (a heading id or a defined ID) is revealed and pinned at the top; otherwise
//                      the stored position, when one is checked good, is restored and pinned there. The pin is
//                      applied again by the first relayout, once the bar is in the root and the sizes are measured.
//                      Neither flashes nor takes the focus, as the reference's first landing did not.
//   The position       with a position key (options.posKey, which defaults to storageKey): read during startup (state,
//                      `<namespace>:pos:<posKey>`), and written behind as the reader's place (placeOf's anchor) when
//                      scrolling has stopped for SAVE_MS and when the page is hidden, unless it is the place already
//                      stored; null (at the top with nothing hit) deletes it. A stored value is checked like a token
//                      (nav.ts's checkAnchor): of the wrong shape, oversized, or with a selector character, it is
//                      ignored. The reference kept it per tab; a host that wants that routes the key to its session
//                      storage.
// Destroy cancels the save's debounce and the pin (env's timers, nav.ts's release), and removes the section links.
//
// Standard files, slug `nav`: test/enhance-nav.test.ts, test/browser/nav.test.ts and conformance/layout/nav/.
// Registered in features.ts, whose header says where in the build order and why.
import type { Cancel } from './env.js';
import { headingText } from './headctl.js';
import { CHROME_ATTR, chrome } from './journal.js';
import { checkAnchor, placeOf, tokenOf } from './nav.js';
import type { FeatureContext } from './types.js';

/** How long scrolling must stop before the position is written, in milliseconds (the reference's). */
const SAVE_MS = 250;

/** How far below a section's start `k` still goes to the previous section, in px (the reference's). */
const BACK_PX = 40;

/** A heading's leading number, as the reference left it out of the link's name: "3. ", "F2. ", "12a. ". */
const NUMBER = /^[A-Z]?\d+[a-z]?\.\s+/;

/** A chrome button: a control, never part of a heading's name (headctl.ts). */
const isControl = (el: Element): boolean => el.localName === 'button' && el.hasAttribute(CHROME_ATTR);

/** True when `el` sits in the "In short" box (editorial.ts's chrome), which takes no section link. */
function inShort(root: Element, el: Element): boolean {
  for (let n = el.parentElement; n !== null && n !== root; n = n.parentElement) if (n.classList.contains('short')) return true;
  return false;
}

/** Build this feature during startup, last. */
export function build(ctx: FeatureContext): void {
  const { root, nav, env, options, state } = ctx;
  const doc = root.ownerDocument;
  const place = placeOf(nav);

  // ── the section link
  for (const h of Array.from(root.querySelectorAll('h2[id], h3[id]')) as HTMLElement[]) {
    if (nav.byId(h.id) !== h || inShort(root, h)) continue;
    // Its name as the heading's own label has it (editorial.ts's or headCtl's, read before any control was added),
    // else as its text reads now, before this first control; less a leading section number.
    const title = (h.getAttribute('aria-label') ?? headingText(h, isControl)).replace(NUMBER, '');
    const link = chrome(doc, 'a', {
      className: 'h-anchor',
      text: '#',
      attrs: { href: `#${h.id}`, title: 'Link to this section', 'aria-label': `Link to ${title}` },
    });
    ctx.headCtl(h, 'anchor', link);
  }

  // ── `j` and `k`
  const heads = ctx.sections.map((s) => s.heading);
  let heard = false;
  let spied: HTMLElement | null = null;
  ctx.events.on('spy', (p) => {
    heard = true;
    spied = p.section;
  });
  const current = (): HTMLElement | null => {
    if (heard) return spied;
    const line = Math.max(150, env.viewport().h * 0.3);
    let at: HTMLElement | null = null;
    for (const h of heads) if (h.getBoundingClientRect().top < line) at = h;
    return at;
  };
  const some = (): boolean => heads.length > 0;
  ctx.keys.bind({
    key: 'j',
    label: 'Next section',
    when: some,
    run: () => {
      const sec = current();
      const next = heads[(sec === null ? -1 : heads.indexOf(sec)) + 1];
      if (next === undefined) return false;
      nav.goTo(next, { push: false });
      return true;
    },
  });
  ctx.keys.bind({
    key: 'k',
    label: 'Previous section',
    when: some,
    run: () => {
      const sec = current();
      const si = sec === null ? -1 : heads.indexOf(sec);
      let back: HTMLElement | null = null;
      if (sec !== null && sec.getBoundingClientRect().top < place.barBottom() - BACK_PX) back = sec;
      else back = heads[si - 1] ?? null; // none before the first section
      if (back === null) return false;
      nav.goTo(back, { push: false });
      return true;
    },
  });

  // ── the stored position, read during startup
  const posKey = options.posKey;
  const stored = posKey === null ? null : checkAnchor(state.readPos(posKey));

  // ── landing: initialHash wins, else the stored position
  if (options.initialHash !== null) {
    const target = nav.byId(options.initialHash);
    if (target !== null) {
      ctx.reveal(target);
      if (!ctx.live()) return;
      place.pin(() => {
        place.reach(target, false);
      });
    }
  } else if (stored !== null) {
    place.pin(() => {
      place.restore(stored);
    });
  }

  // ── writing the position
  if (posKey === null) return;
  let last = tokenOf(stored);
  const save = (): void => {
    const now = place.anchor();
    const text = tokenOf(now);
    if (text === last) return;
    last = text;
    state.writePos(posKey, now);
  };
  let waiting: Cancel | null = null;
  env.onScroll(() => {
    waiting?.(); // a burst of scrolling is one wait
    waiting = env.timeout(save, SAVE_MS);
  });
  env.onPageHide(save); // a wait still pending then finds the same place, and writes nothing
}
