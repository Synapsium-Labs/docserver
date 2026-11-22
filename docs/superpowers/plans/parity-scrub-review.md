# Review layout scrub audit

## Design

The review layout is the reference's direction B, the review workbench: a header card that says what the document is, its status and what waits on the reader; a rail with Contents, with per-section read marks, and an Index of every defined ID; ID links in running text that preview their row; a sticky bar naming the section being read; keyboard first. Most of that is what the shared reader already does, so the layout is a feature list over the shared modules, four small modules of its own, and a stylesheet. It is not the default reader with two parts removed: it leaves out what direction B does not have.

**The feature list** (`src/enhance/layouts/review/features.ts`) selects the shared modules in their standard relative order (the header of `src/enhance/features.ts` says why each step follows the ones before it): `editorial`, `rules`, `tables`, `status`, `ids`, `plans`, `code`, `figures`, `xrefs`, `marks`, `rail`, `strip`, `scroll`, `cards`, `jump`, `keysheet`, `diagrams`, `diagram-tools`, `position`, behind the layout mark. It leaves out `folds`, `since`, `changes` (the change stepper and its `n` and `p` keys), `glossary` (term links), `attention` (the lens) and `settings` (the Aa menu): direction B has none of them. A unit row holds the list to that.

| Layout module | Placed | Why it is the layout's, and not shared |
|---|---|---|
| `review/header.ts` (`review-header`) | after `strip`, before `scroll` | No shared module draws a card round the title block, and the shared modules have no next-unread key. The strip is in the block by then and the marks' controls exist, which the card's progress counts. It also sends the bar's "Skip to the text" link on to the title the card now holds. |
| `review/rail.ts` (`review-rail`) | after `header` | Adds chrome to the rail the shared module made, without editing it: a link to what waits at the top of the Contents tab, and the read count in the rail's footer. |
| `review/context.ts` (`review-context`) | after `jump` | No shared module puts a read-mark toggle in the bar. It takes the tray's slot of the change stepper, which this layout does not build, through the bar's own `tool` method, so the bar's landmark bookkeeping runs. It follows the spy and marks events. |
| `review/compact.ts` (`review-compact`) | after `cards` | No shared module clips long table rows. It runs after the table, status, ID, link and card modules: they read cells by position only while they build, and after that only text (the filter), descendants (the rail's pills) and copies of a cell's children (preview cards), none of which a wrapper changes. |
| `layouts/mark.ts` | first | Shared by every non-default layout. |

Everything else is imported from `src/enhance/`, never copied, and no default asset is edited: the rail, the strip and the bar are the default bundle's modules and this layout only adds nodes beside them through the journal. The rail (Contents and Index tabs, drawer), the ID links and preview cards (`xrefs`, `cards`), the strip, the running head and progress line (`scroll`), the keys (`keys`, `keysheet`), the quick jump and the marks are the default's, so their behaviour, accessibility and hosted contract are the default's.

**State.** The layout holds no state of its own and no new store key or document field. The read marks are the marks feature's (`doc:<key>:marks`, an existing document field), the rail's tab is the reader's `ui` pref as the default's, and the card's counts, the rail's count, the `n` key and the bar toggle read the marks feature's controls (`button.h-mark`) and its `marks` and `spy` events. The toggle presses the unit's own control, so there is one writer. The bootstrap, the document fields and the store keys are unchanged.

**Budgets.** The layout's enhance bundle is 192,369 characters and its stylesheet 8,860, 201,229 together, against the default enhance bundle's 225,709. The five entries the default frame inlines and the B1 layouts' entries keep their sha256 and bytes, and the bootstrap stays at 32,740 bytes.

## In short

Review selects the shared reader's rail, ID links, strip, running head and keys, drops what direction B lacks, adds a header card with the reader's progress and the `n` key, a waiting link and read count in the rail, and a mark toggle in the bar, and has its own stylesheet. This is a source-level mapping of the reference lanes, not a claim of pixel or complete behavioural parity. The layout corpus pins scoped DOM output of the shared cases; it does not name the card or the toggle, which are pinned by the interaction rows.

## 1. Reference lanes

| Reference lane | Review implementation and boundary |
|---|---|
| Header card | `review/header.ts` moves the title block the shared `editorial` and `strip` features built (eyebrow, title, hidden meta line, byline, review strip, facts panel) into one `header.rv-card`, through the journal, so teardown puts every node back. The reference rebuilt the meta line as its own list and parsed front matter a second time; the shared title block is used instead, so the card holds what the default shows. |
| What waits on the reader, decisions and plan counts | The shared `strip` (the "Waiting on you" list, decision and status counts, plan counts). Unlike the reference, its wait items have no `waiting-N` ids; they link to the box's heading. |
| Reading progress and next unread | The card's progress row counts the marks feature's controls: how many are read, how many changed since they were read, a bar and a button to the next unread unit. The key `n` goes to that unit through the reader's keys service and is listed on the keys sheet; this layout has no change stepper, so `n` is free. |
| Rail with Contents and Index | Shared `rail.ts`: a Contents tab with per-section read marks and an Index tab grouping every defined ID, a drawer on narrow screens (modal, focus trap, Escape, focus restored), the `i` key. The Index lists the IDs the shared `ids` and `rules` modules define. |
| The Contents tab's "Waiting on you" link | `review/rail.ts` puts a link with the count at the top of the Contents tab, to the "Waiting on you" box's heading. It is an ordinary fragment link, so the reader's navigation and the rail's click handling (the drawer closes) serve it. None when the document has no such box. |
| The rail footer's "N of M read" | `review/rail.ts` puts the count at the start of the rail's footer and follows the `marks` event. |
| ID links and previews | Shared `xrefs` and `cards`: the first mention of a defined ID is a link, previewed by a card on hover or focus. The reference drew a chip with a dotted underline and a hover tint; this layout keeps the reader's own underline, which the hosted appearance makes dashed for an ID link, and adds a hover and open tint on the surface, so the hosted cue is untouched. |
| Sticky bar naming the section | Shared `scroll.ts` and the bar's skeleton: the running head names the section being read, with the progress line. `review/context.ts` adds one tool to the tray, a button that marks that section read or unread and says which in its name. The reference's sub-section crumb is not shown. |
| Skip to the text | The bar's own link goes to the first node that is not chrome, which the card changes; `review/header.ts` sends focus on to the title. |
| Read marks | Shared `marks.ts` and its `m` key, in the heading's controls, the rail and the card. |
| Keyboard | `/` and Ctrl or Cmd+K, `j` `k`, `w`, `n` (next unread), `m`, `o` (plans), `i`, `?` : the shared bindings and `n`; the sheet lists the keys that apply. The reference's `p` has no use without the change stepper. |
| Compact clipped rows and "Open all rows" (section 5) | `review/compact.ts`, with the reference's thresholds (six rows or more, rows averaging over 240 characters): each cell's children move into a chrome wrapper through the journal, overflow is measured in the relayout run (reads, then writes), and the stylesheet clips to a few lines. A button in the first cell opens a row (keyboard reachable, `aria-expanded`), and "Open all rows" sits in the table's tools (the filter's, for twelve rows or more). Differences: clicking a clipped row's text does not open it (the button does), and nothing is clipped on a phone, where rows stack as cards (the hint and Open all rows are hidden there). In print the rows are whole: no clip, no fade, no row button, no hint. A relayout while the root is hidden is skipped, so the marks survive being shown again. |
| Tables, status pills, code copy, figures and their tools | The shared `tables`, `status`, `code`, `figures`, `diagrams` and `diagram-tools`, as the default's. |
| Alerts, boxes and numbered sections | Renderer output and the shared `editorial`, styled by shared reader assets. |

## 2. Scrubbed or deliberately not shipped

| Reference default or mechanism | Boundary and reason |
|---|---|
| Page-global startup, body classes, global IDs and window listeners | The host mounts a root-scoped instance; every chrome node and listener goes through the journal and is undone at teardown. |
| A CDN import of the diagram library | Mermaid is supplied by the host adapter; no network is added. |
| Local storage for read marks and other state | Marks go through the reader's state service (the bridge's store), as the default's. The layout adds no store key and no document field. |
| Direct history, clipboard and location writes | Navigation goes through the reader's `nav` service and its host seam; copy through the host's copy adapter. |
| Fixed palette and dark-mode rules | The stylesheet uses the reader's tokens and the host's appearance slots only; it holds no literal colour (a unit row scans it), and the hosted control-row size applies under a fine pointer only, a coarse pointer keeping 44 px. |
| Operator-specific vocabulary, ID prefixes, status words and front-matter kinds | The shared vocabulary options (`vocab.ts`) supply them; the private defaults are empty or off. The reference's own document kinds (vision and promise) are not ported. |
| Section folding, the "changes since" menu and change stepper, the glossary, the attention lens, the reading settings menu | Direction B has none of them; they are not in the list. |
| Direct DOM replacement and inline handlers | Chrome is created with the document's API; document nodes are moved through the journal. |
| Site footer, top bar and readiness assumptions | Page-level elements belong to the host. |

## 3. Evidence limits

None of the 54 shared Level 2 cases has a table that is compact, so the compact rows are pinned by the interaction rows and a synthetic hosted fixture, not by snapshots. The 54 shared Level 2 cases are pinned under `conformance/layouts/review/`. Their scopes are the shared cases' class lists, none of which names the card (`rv-card`, `rv-read`), the bar toggle (`rv-mark`) or the rail additions (`rv-wait`, `rv-foot-read`, although the footer's count shows in the rail snapshots), so those are pinned by the interaction rows of `test/browser/layout-review.test.ts` and the unit rows of `test/enhance-layouts.test.ts`, not by snapshots. A new shared case would add files under the default's and every other layout's directories, which this task may not move.

Under review, the first heading sits lower than under the default (the card is taller than the shared title block), so the rail's initial active entry differs in `review/rail/drawer` and its marks cases. Dropping the glossary and the settings menu removed the term links from the `links` cases, emptied the settings cases, and removed the definition cue from the two diagram cases that name a glossary term in an edge label; the corpus waits for no cue there.

The interaction rows run in Chromium locally: three widths with no horizontal scroll and the contents reachable; the card and its progress; the skip link; the bar toggle with the card and the rail in step; the two rail tabs; ID links, their hover tint and preview; the keys, `n` among them; the drawer's focus trap, dismissal and focus restore; the touch floor of 44 px against a 56 px hosted row; the fine-pointer slot at 40 and 56 px; and teardown with the drawer open and work queued. The twelve hosted fixture appearances, the pair floors and the closed grounds run for this layout in `appearance-style`, including the bar toggle pressed and changed and the card's changed text; `appearance-cues` runs the cue rows for what review still draws (marks, status dots, ID links, the drawer's control row, the quick jump, the In short switch, the table filter, the waiting callout, and the attention mark on a task item, which its `plans` writes) through the shared mechanism, and none for a feature it no longer has. WebKit is proven in CI only.
