# Review layout scrub audit

## Design

The review layout is the reference review workbench (a header card that says what the document is, its status and what waits on the reader; a rail with Contents, with per-section read marks, and an Index of every defined ID; ID chips in running text that preview their row; a sticky bar naming the section being read; keyboard first). Most of that is what the shared reader already does, so the layout is a feature list over the shared modules plus two small modules of its own, and a stylesheet.

**The feature list** (`src/enhance/layouts/review/features.ts`) selects the shared modules in their standard relative order (the header of `src/enhance/features.ts` says why each step follows the ones before it): `editorial`, `rules`, `tables`, `status`, `ids`, `plans`, `code`, `figures`, `xrefs`, `glossary`, `attention`, `marks`, `rail`, `strip`, `scroll`, `cards`, `jump`, `settings`, `changes`, `keysheet`, `diagrams`, `diagram-tools`, `position`, behind the layout mark. It leaves out `folds` and `since`: the workbench has no section folding and no "changes since" menu (the change stepper stays). The list is the default's with those two removed and two layout features added.

| Layout module | Placed | Why it is the layout's, and not shared |
|---|---|---|
| `review/header.ts` (`review-header`) | after `strip`, before `scroll` | No shared module draws a card round the title block. The strip is in the block by then, and the marks' controls exist, which the card's progress counts. |
| `review/context.ts` (`review-context`) | after `jump` | No shared module puts a read-mark toggle in the bar. It follows the spy and marks events, which the shared modules already emit. |
| `layouts/mark.ts` | first | Shared by every non-default layout. |

Everything else is imported from `src/enhance/`, never copied. The rail (Contents and Index tabs, drawer), the chips and preview cards (`xrefs`, `cards`), the strip, the running head and progress line (`scroll`), the keys (`keys`, `keysheet`), the quick jump and the marks are the default's modules, so their behaviour, accessibility and hosted contract are the default's.

**State.** The layout holds no state of its own and no new store key or document field. The read marks are the marks feature's (`doc:<key>:marks`, an existing document field), the rail's tab is the reader's `ui` pref as the default's, and the card's counts and the bar toggle read the marks feature's controls (`button.h-mark`) and its `marks` and `spy` events. The toggle presses the unit's own control, so there is one writer. The bootstrap, the document fields and the store keys are unchanged.

**Budgets.** The layout's enhance bundle is 207,786 characters and its stylesheet 5,029, 212,815 together, against the default enhance bundle's 225,709. The five entries the default frame inlines keep their sha256 and bytes, and the bootstrap stays at 32,740 bytes.

## In short

Review selects the shared reader's rail, chips, strip, running head and keys, adds a header card with the reader's progress and a mark toggle in the bar, and has its own stylesheet. This is a source-level mapping of the reference lanes, not a claim of pixel or complete behavioural parity. The layout corpus pins scoped DOM output of the shared cases; it does not name the card or the toggle, which are pinned by the interaction rows.

## 1. Reference lanes

| Reference lane | Review implementation and boundary |
|---|---|
| Header card | `review/header.ts` moves the title block the shared `editorial` and `strip` features built (eyebrow, title, hidden meta line, byline, review strip, facts panel) into one `header.rv-card`, through the journal, so teardown puts every node back. The reference rebuilt the meta line as its own list and parsed front matter a second time; the shared title block is used instead, so the card holds what the default shows. |
| What waits on the reader, decisions and plan counts | The shared `strip` (the "Waiting on you" list, decision and status counts, plan counts). Unlike the reference, its wait items have no `waiting-N` ids; they link to the box's heading. |
| Reading progress and next unread | The card's progress row counts the marks feature's controls: how many are read, how many changed since they were read, a bar and a button to the next unread unit. The reference's `n` key for the next unread section is not bound: the reader's `n` is the change stepper (one binding per key). |
| Rail with Contents and Index | Shared `rail.ts`: a Contents tab with per-section read marks and an Index tab grouping every defined ID, a drawer on narrow screens (modal, focus trap, Escape, focus restored), the `i` key. The Index lists the IDs the shared `ids` and `rules` modules define. |
| ID chips and previews | Shared `xrefs`, `glossary` and `cards`: the first mention of a defined ID is a link, previewed by a card on hover or focus. The stylesheet draws the link as a chip (a border, a rounded surface) in running text outside tables. |
| Sticky bar naming the section | Shared `scroll.ts` and the bar's skeleton: the running head names the section being read, with the progress line. `review/context.ts` adds one tool to the tray, a button that marks that section read or unread and says which in its name. The reference's second sub-section crumb is not shown. |
| Read marks | Shared `marks.ts` and its `m` key, in the heading's controls, the rail and the card. |
| Keyboard | `/` and Ctrl or Cmd+K, `j` `k`, `w`, `n` `p` (changes), `m`, `o` (plans), `i`, `?` are the shared bindings; the sheet lists the keys that apply. |
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
| Section folding, and the "changes since" menu | Not part of the workbench; `folds` and `since` are not in the list. |
| `n` as next unread | The reader binds `n` to the next change. |
| Direct DOM replacement and inline handlers | Chrome is created with the document's API; document nodes are moved through the journal. |
| Site footer, top bar and readiness assumptions | Page-level elements belong to the host. |

## 3. Evidence limits

The 54 shared Level 2 cases are pinned under `conformance/layouts/review/`. Their scopes are the shared cases' class lists, none of which names the card (`rv-card`, `rv-read`) or the bar toggle (`rv-mark`), so those two are pinned by the interaction rows of `test/browser/layout-review.test.ts` and the unit rows of `test/enhance-layouts.test.ts`, not by snapshots. A new shared case would add files under the default's and every other layout's directories, which this task may not move.

Under review, the first heading sits lower than under the default (the card is taller than the shared title block), so the rail's initial active entry differs in `review/rail/drawer` and its marks cases. That is the layout's geometry, not a flaw, and the snapshots were read back unchanged.

The interaction rows run in Chromium locally: three widths with no horizontal scroll and the contents reachable; the card and its progress; the bar toggle with the card and the rail in step; the two rail tabs; chips and their preview; the keys; the drawer's focus trap, dismissal and focus restore; the touch floor of 44 px against a 56 px hosted row; the fine-pointer slot at 40 and 56 px; and teardown with the drawer open and work queued. The twelve hosted fixture appearances, the pair floors, the closed grounds and the cue rows run for this layout in `appearance-style` and `appearance-cues`. WebKit is proven in CI only.
