# Classic layout scrub audit

## In short

Classic selects its own editorial, contents and reveal features and reuses the reader's shared services. This is a source-level mapping of the reference lanes, not a claim of pixel or complete behavioral parity. The layout corpus pins scoped DOM output; it does not establish all interactions, visual states or browser engines.

## 1. Reference lanes

| Reference lane | Classic implementation and boundary |
|---|---|
| Summary and standing boxes | `src/enhance/layouts/classic/editorial.ts` wraps the matching headings and their siblings using the journal. Box and callout vocabulary is the shared format contract in `vocab.ts`; original document nodes are retained. |
| Numbered section badges | The same module wraps the number and hides the separator while retaining the heading's accessible label. |
| Section chips, contents and drawer | `layouts/contents.ts` builds H2 chips and an H2/H3 rail for documents when the host enables the rail. It supplies collapse, modal drawer focus and navigation wiring. Chips and rail links preserve the heading number in their accessible names, without the reference's separate number styling. The docked rail retains compact sizing; the open drawer uses the hosted type and control row slots and keeps coarse-pointer controls at least 44px tall. |
| Spy, progress and links | The contents module tracks H2 and H3 items with a binary search and follows the active link inside the rail without scrolling the document. The shared `scroll.ts` supplies progress, and `nav.ts` handles navigation through the reader and host seams. Progress chrome requires the host's bar slot. The reference's direct history mutation is not copied. |
| Table filters and status pills | Shared `tables.ts` adds filters at 12 rows; `status.ts` marks eligible status columns using configurable shared vocabulary. Unlike the reference's scan of every simple cell, the shared column qualification excludes the first column and can leave a matching word unmarked. Table shape and phone cards also follow the shared reader rather than the reference's exact markup. |
| Code copy | Shared `code.ts` builds copy controls only when the host supplies the copy adapter; it does not access the clipboard directly. |
| Reveal | `layouts/reveal.ts` observes the reference's four block classes below the viewport, respects reduced motion and cancels its observer. It also responds to the reader's reveal event. |
| Quick jump | Shared `jump.ts` provides heading search and keyboard navigation. Its shared-reader overlay and navigation replace the reference's page-global implementation, not an exact DOM or interaction copy. |
| Figure tools | Shared `figures.ts`, `diagrams.ts` and `diagram-tools.ts` provide source fallback, drawing, copy via the host, playback, edge animation and expanded view when their prerequisites are met. Drawing depends on the supplied Mermaid adapter; copy depends on the host copy adapter. Classic does not register the ID index or previews, so definition cues are absent even in diagrams containing definition-shaped text. |
| Alerts and styling | Alert markup is produced by the renderer and styled by shared reader assets. Classic's stylesheet uses the reader's tokens and appearance surfaces rather than the reference's literal palette or page-global selectors. |

## 2. Scrubbed or deliberately not shipped

| Reference default or mechanism | Boundary and reason |
|---|---|
| Page-global startup, body classes, global IDs and global listeners | The host mounts a root-scoped instance; journaled chrome and listeners are reversible. This keeps the library embeddable and avoids collisions between documents. |
| Direct clipboard, history and remote diagram-module loading | Copy and navigation go through host services; Mermaid is host-supplied. No library-owned network or routing is introduced. |
| Fixed reference colours, including dark-mode rules | Reader tokens and host appearance slots supply colours; the layout does not carry a separate palette. |
| Operator-specific vocabulary, ID prefixes, qualifiers and byline fields | Shared `vocab.ts` centralizes configurable lists. Private qualifiers and item-field defaults are empty; ID prefix restrictions are host options, not copied operator-specific defaults. The neutral format headings and shared status defaults remain. Classic does not register the index feature. |
| Direct DOM text replacement and inline event properties | Reader chrome is created or document nodes moved and split through the journal; event listeners use the reader lifecycle. This preserves the source and supports the CSP-safe contract. |
| Site footer, top bar and page readiness assumptions | Those page-level elements and readiness belong to the host; classic works within the supplied root and slots instead. |

## 3. Evidence limits

The initial Chromium update run passed 50 cases and failed four diagram-tools cases waiting for definition cues: each reported zero targets. Classic does not register the index that supplies those cues. After the test was adjusted to require a real drawing and tool wiring while asserting zero cues, the second update again passed 50 and failed four: its visibility wait targeted the toolbar container, which deliberately has zero height. The revised wait targets the real Full screen button instead.

The first complete Chromium update passed all 54 classic cases; the subsequent non-update corpus run passed 118 tests, with 112 excluded or skipped. After the H3 spy and rail follow were added, one run reported a changed initial active rail link in `classic/rail/plan-marks`. A targeted regeneration did not change its bytes and the next non-update run passed 118 tests. The held-out review then reproduced the mismatch in both the full and isolated read-backs: `Work` was active and its branch open, where the snapshot expected neither. That result reopened the initial rail-state check; a passing rerun alone did not close it.

The review fix updates the spy synchronously on reader relayout, while scroll updates still share the animation-frame queue. The Classic plan-marks test samples a 600px-high viewport so the first heading is safely below the reading line, and waits for the neutral rail state as well as that geometry. Neither the shared fixture nor the default snapshot changed. Six of this landing's new Classic rail snapshots were regenerated; only numbered link text changed. The full Chromium corpus read-back passed all 118 selected rows, and the isolated plan-marks case passed on a subsequent run.

The layout-corpus cases exercise scoped snapshots and strict-page cleanliness, not pixel parity. Classic's 19 Chromium interaction rows exercise three widths, keyboard focus wrap and dismissal (including activation where the Contents button never took focus), rail follow after opening, numbered link names, hosted skin, touch targets, filters, navigation, progress, reveal and teardown with pending work. The no-bar command has a separate lifecycle test. Twelve hosted colour fixtures and four Classic cue tests passed, including the painted 3px waiting-callout bar with colliding colours. ID-index cues are intentionally absent. These are local Chromium results; WebKit is checked in CI.
