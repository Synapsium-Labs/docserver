# Classic layout scrub audit

## In short

Classic selects its own editorial, contents and reveal features and reuses the reader's shared services. This is a source-level mapping of the reference lanes, not a claim of pixel or complete behavioral parity. The layout corpus pins scoped DOM output; it does not establish all interactions, visual states or browser engines.

## 1. Reference lanes

| Reference lane | Classic implementation and boundary |
|---|---|
| Summary and standing boxes | `src/enhance/layouts/classic/editorial.ts` wraps the matching headings and their siblings using the journal. Box and callout vocabulary is the shared format contract in `vocab.ts`; original document nodes are retained. |
| Numbered section badges | The same module wraps the number and hides the separator while retaining the heading's accessible label. |
| Section chips, contents and drawer | `classic/contents.ts` builds H2 chips and an H2/H3 rail for documents when the host enables the rail. It supplies collapse, drawer and navigation wiring. The reference's separately styled number inside each rail link is not reproduced: the classic rail uses the complete heading text. |
| Spy, progress and links | The contents module consumes shared spy events; `scroll.ts` supplies spy and progress, and `nav.ts` handles navigation through the reader and host seams. Progress chrome requires the host's bar slot. The shared spy normally tracks H2 sections rather than the reference's H2/H3 items, so classic does not generally activate H3 links. Classic also does not implement the reference's explicit active-link `scrollIntoView` in the rail; the reference's direct history mutation is not copied. |
| Table filters and status pills | Shared `tables.ts` adds filters at 12 rows; `status.ts` marks eligible status columns using configurable shared vocabulary. Unlike the reference's scan of every simple cell, the shared column qualification excludes the first column and can leave a matching word unmarked. Table shape and phone cards also follow the shared reader rather than the reference's exact markup. |
| Code copy | Shared `code.ts` builds copy controls only when the host supplies the copy adapter; it does not access the clipboard directly. |
| Reveal | `classic/reveal.ts` observes the reference's four block classes below the viewport, respects reduced motion and cancels its observer. It also responds to the reader's reveal event. |
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

The final Chromium update passed all 54 classic cases; the subsequent non-update corpus run passed 118 tests, with 112 excluded or skipped. The layout-corpus cases exercise scoped snapshots and strict-page cleanliness in the selected browser, not a visual comparison against the reference. The shared feature tests and classic hosted checks cover additional behavior, but this audit alone does not establish every reference interaction, appearance, size limit or WebKit result. In particular, no ID-index cue parity, H3 spy parity or rail auto-scroll parity is claimed.
