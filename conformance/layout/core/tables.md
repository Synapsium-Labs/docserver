# Tables

**Spec** · 2026-10-20 · Status: Draft

## 1. Status columns

A named status column marks each cell's leading status word.

| # | Decision | Why | Status |
|---|---|---|---|
| D1 | Keep the palette | Readers know it | Agreed |
| D2 | Fold by default | Long pages stay short | Pending review |
| D3 | A rules index | Out of scope here | Deferred |

A column of short answers reads as a status column without a status header.

| Item | Answer | Note |
|---|---|---|
| Q1 | Done | Shipped |
| Q2 | Open | Next week |
| Q3 | Rejected | Too costly |

## 2. Shapes

Two columns keep to the reading column.

| Term | Meaning |
|---|---|
| Fold | A section shown as its heading only |
| Mark | A coloured status label |

A row whose only filled cell is the first is a group heading.

| Area | Owner | State |
|---|---|---|
| Reading | | |
| Title block | project-a team | Done |
| Facts panel | project-a team | Open |

## 3. Not a status column

The first column never marks, and a long-text column does not either.

| Status | Summary |
|---|---|
| Agreed | The first column holds words that are statuses, and it still never marks. |
| Open | A second column of long sentences that start with no status word at all. |
