---
type: spec
area: reading layout
status: draft
rules: [R1, R2]
tags: [example, demo]
---

# Example spec

**Spec** · 2026-10-19 · Status: Draft · **Owner:** project-a team

## In short

This example spec shows how the reading layout draws a document. It is made up for the demo: every name in it is a stand-in. **R1** says a reader sees the title first, and **R2** says a section can fold. Check the table in section 3 and the open questions at the end.

## 1. Context

Readers open a spec to decide something, so the page leads with the decision and keeps the detail below it. This section says why the layout exists and what it builds on, in a few plain sentences. The second paragraph carries a [link to the next section](#2-design), some `inline code`, and a footnote[^1] to check the marker.

A longer paragraph makes the measure and the line height visible: the line should hold about seventy characters, the spacing between lines should feel calm, and the paragraph break should leave a little air without a full blank line. A reader who skims should still catch the shape of the argument from the first sentence of each paragraph.

> A quoted line sets the voice of the document apart from the author's own words, and it should read as a quiet aside, not as a warning.

## 2. Design

The design has three parts, and each part is small. The list below names them.

- The renderer turns Markdown into safe markup.
- The enhancer builds the title block, the boxes and the section numbers.
- The stylesheet gives the page its look and holds no logic.

A fenced code block shows how a host would call it:

```typescript
import { render } from '@example/docs/render';
import { enhance } from '@example/docs/enhance';

const result = render(markdown);
const ready = true;
const root = document.createElement('main');
show(root, result.html); // the host inserts the safe html
// Start the layout; the title comes from the render.
await enhance(root, { info: { title: result.meta.title } });
```

> [!NOTE]
> An alert draws attention to one fact. This one is a note, and it keeps to one short paragraph.

> [!WARNING]
> A warning is rarer than a note, and it should look different enough to be seen at a glance.

## 3. Decisions

Each decision has a status, and the status column shows as a coloured label.

| # | Decision | Chosen, and why | Status |
|---|---|---|---|
| D1 | Keep the warm palette | The reading page stays recognisable | Agreed |
| D2 | Fold sections by default | Long specs stay short to scan | Proposed |
| D3 | Add a rules index | Out of scope for this example | Later |
| D4 | Drop the old layout | Nothing else reads it any more | Rejected |

## 4. Open questions

Two things are still open. Neither blocks the work, and each is named so a reader can answer it in a line.

1. Should a fold remember its state across visits?
2. Should the stylesheet ship a print layout?

## Where things stand

### Agreed

- R1: the title block comes first.
- D1: the warm palette stays.

### Waiting on you

- D2: whether sections fold by default.
- Q1: the fold memory question in section 4.

### Later

- D3: a rules index.
- A print layout.

[^1]: A footnote holds a source or a caveat that would interrupt the sentence it belongs to.
