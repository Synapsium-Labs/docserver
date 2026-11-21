# Editorial layout scrub audit

## In short

Editorial brings the reference's title block, margin numbers, plan labels, running head and Contents-only rail into the shared reader. It uses the reader's front matter, rule and table builders, navigation and figure services. It does not enable the default layout's review or settings chrome.

## 1. Reference lanes

| Lane | Port and boundary |
|---|---|
| Title and summary | Shared `editorial.ts` builds the eyebrow, byline, facts, numbered headings, In short and standing callouts. The standing links count direct items in each populated callout. The explicit `inShort` option continues to work; the switch is off by default. The reader's front matter, labels and link resolution are used in place of a separate parser. |
| Rules and tables | Shared `rules.ts` and `ids.ts` provide host-configured rules and row targets for quick jump. Shared `tables.ts` and `status.ts` supply group rows, bullet lines, a filter at 12 rows, phone stacks and labels. Unlike the reference's cell scan, status words are drawn only in columns the shared contract qualifies. |
| Plans | `layouts/editorial/plans.ts` adds H3 task labels with step and owner metadata, step labels and accessible checkbox names, using the shared plan vocabulary and journal. It publishes the original task members and fingerprints to the existing registry. No outline toggle, task expansion, stored outline state or outline key is registered. The shared vocabulary accepts additional separators. Source-supplied step anchors work; the port does not mint step IDs that the shared navigation cannot resolve. |
| Contents and document position | `layouts/contents.ts` shares the H2/H3 rail, modal drawer, local follow and focus restoration with Classic. Editorial draws neither Classic phone chips nor an Index tab. The rail uses complete accessible heading labels rather than a separate number column. Shared scroll, nav and position builders handle progress, the running head, section anchors, the bar and navigation. This also retains the shared `j`/`k` section shortcuts. |
| Quick jump | Shared `jump.ts` reaches headings, task titles, configured rules, eligible rows and captioned figures. It uses the existing host and navigation adapters, not page-global history. |
| Reveal | `layouts/reveal.ts` watches below-fold figures and callouts for Editorial with the reference's 6% bottom margin. It also responds to navigation reveal and respects reduced motion. |
| Code and figures | Shared code copy needs the host copy adapter. Shared figures, diagrams and tools retain caption anchors, source fallback, play, edge animation, copy and full screen when the host supplies their dependencies. Editorial keeps the rule and row registry for jump but gives the diagram-tools builder an empty definition index: without a preview feature it must not draw a button that cannot open a definition. |

## 2. Scrubbed defaults

| Reference mechanism | Port boundary |
|---|---|
| Fixed palette and font choices | The scoped Editorial stylesheet uses the shared reader's colour, surface and type slots. Hosted type overrides apply to the drawer, not the docked rail. The drawer's Close button and links use the hosted control-row slot only with a fine pointer. With a coarse pointer they keep the shared 44px floor without using that slot. |
| Site IDs, qualifiers, tracker destinations and other operator vocabulary | No site defaults are copied. Shared vocabulary and item resolution are host options, with no default tracker or destinations. |
| Global document, scroll and history, direct clipboard and remote Mermaid | The library uses root-scoped builders, the environment and navigation adapter, the host's copy adapter and host-supplied Mermaid. No layout owns network, storage or history. |
| Page shell, footer and document loading | The host supplies the frame and its lifecycle; all layout structure and listeners are journaled, with no dependence on the reference's surrounding page. |

## 3. Evidence and limits

The first Editorial corpus generation wrote 52 of 54 snapshots. The two glossary-edge cases expected definition cues, but Editorial has no glossary; the two ID cases did get cues through the shared rule and row index, despite having no preview dialog. The final layout requires the shared drawing and real Full screen button in all four cases, and asserts no definition controls. The default cases still require their original positive cue counts. The final generation passed 54; Chromium read back 172 rows across the three layouts, with 165 excluded or skipped. No default or Classic snapshot moved in this task.

Chromium interactions cover the three widths, the drawer, labels without outline, filter and phone stacks, rule/row/figure navigation, reveal, linked callout counts and heading anchors. The hosted sweep and cue tests check painted content, not pixel parity with the reference. The [mutation log](parity-mutations/task-11.md) records measured failures and the clean controls. WebKit is verified in CI, not by this local audit.
