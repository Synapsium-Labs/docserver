# Example blocks

**Spec** · 2026-10-20 · Status: Draft · **Owner:** project-a team

This made-up sample shows the code blocks and tables of the reading layout: the Copy buttons, a long and a wide code block, bullet cells, a wide table and a table with a filter. Every name in it is a stand-in.

## Code

A short block has one Copy button above its corner.

```ts
const ready = await enhance(root, { copy: (text) => clipboard.write(text) });
```

A block taller than a screen has a second Copy button at its foot, and its long lines take the wide width.

```python
def pipeline(sources, defaults):
  step_01 = run(stage='01')
  step_02 = run(stage='02')
  step_03 = run(stage='03')
  step_04 = run(stage='04')
  step_05 = run(stage='05')
  step_06 = run(stage='06')
  step_07 = run(stage='07')
  step_08 = run(stage='08')
  step_09 = run(stage='09')
  step_10 = run(stage='10', inputs=collect(sources, depth=10), options=defaults.merge(limit=100, retries=3, timeout=30))
  step_11 = run(stage='11')
  step_12 = run(stage='12')
  step_13 = run(stage='13')
  step_14 = run(stage='14')
  step_15 = run(stage='15')
  step_16 = run(stage='16')
  step_17 = run(stage='17')
  step_18 = run(stage='18')
  step_19 = run(stage='19')
  step_20 = run(stage='20', inputs=collect(sources, depth=20), options=defaults.merge(limit=200, retries=3, timeout=30))
  step_21 = run(stage='21')
  step_22 = run(stage='22')
  step_23 = run(stage='23')
  step_24 = run(stage='24')
  step_25 = run(stage='25')
  step_26 = run(stage='26')
  step_27 = run(stage='27')
  step_28 = run(stage='28')
  step_29 = run(stage='29')
  step_30 = run(stage='30', inputs=collect(sources, depth=30), options=defaults.merge(limit=300, retries=3, timeout=30))
  step_31 = run(stage='31')
  step_32 = run(stage='32')
  step_33 = run(stage='33')
  step_34 = run(stage='34')
  step_35 = run(stage='35')
  step_36 = run(stage='36')
  step_37 = run(stage='37')
  step_38 = run(stage='38')
  step_39 = run(stage='39')
  step_40 = run(stage='40', inputs=collect(sources, depth=40), options=defaults.merge(limit=400, retries=3, timeout=30))
  return step_40
```

A block whose line is longer than the wide width scrolls sideways, and the keyboard reaches it.

```sh
curl --silent --show-error --retry 3 --header 'Accept: application/json' 'https://example.test/api/v1/items?page=1&per_page=100&sort=updated&order=desc&fields=id,title,status,owner'
```

- A block in a list item has less room:

  ```sh
  make test && make build && make release VERSION=1.2.3 CHANNEL=stable NOTES=docs/release-notes.md
  ```

## Tables

A cell can hold lines, and a line can open on a bullet.

| Area | What it does | Status |
|---|---|---|
| Reading | • The title comes first<br>• The sections fold | Agreed |
| Tables | • A filter on long tables<br>• Lines in a cell | Pending review |
| Code | A Copy button<br>A wide width for long lines | Done |

A table wider than the column scrolls sideways.

| Column 1 | Column 2 | Column 3 | Column 4 | Column 5 | Column 6 | Column 7 | Column 8 | Column 9 | Column 10 |
|---|---|---|---|---|---|---|---|---|---|
| value 1 | value 2 | value 3 | value 4 | value 5 | value 6 | value 7 | value 8 | value 9 | value 10 |

A table of twelve rows or more has a filter above it.

| # | Task | Status |
|---|---|---|
| R1 | Parse the input | Done |
| R2 | Check the bounds | Done |
| R3 | Build the title block | Done |
| R4 | Mark the status words | Done |
| R5 | Split the bullet cells | Pending |
| R6 | Add the table filter | Pending |
| R7 | Measure the tables | Pending |
| R8 | Add the Copy buttons | Pending |
| R9 | Size the code blocks | Open |
| R10 | Draw the diagrams | Later |
| R11 | Show what changed | Later |
| R12 | Keep the reading position | Later |
| R13 | Print the page | Later |
| R14 | Ship the release | Later |
