# L2 Task 19: mutation rows (settings, lens, and attention)

This journal records the Task 19 guards measured from the uncommitted working tree. It covers settings chrome, root-local radio names, host preference synchronization, preference changes, shared-overlay Escape routing, containment, fold controls, the Product lens, peek bars, attention marks, file-path treatment, technical-code classification, and the sole root preference lens writer.

**Method.** The original Task 1 Step 8 mutation runner was saved outside the checkout and applied one exact replacement per row to a distinct scratch copy. Each copy included tracked and untracked, non-ignored files and linked the checkout's `node_modules`; it froze every row's explicit `freeze` list under the evidence directory before the replacement, ran package-local Vitest in the foreground with a 600-second limit and two workers, then deleted the mutant copy. A normal `rc=1` from an executed assertion/test failure is red. A missing exit status, signal, runner/import/setup error, or failure before the replacement test executes is KILLED and has no verdict. The saved runner's raw `rc=1` label does not make that distinction automatically, so its host WebKit startup failure is retained as a legacy log rather than a mutation red. The fresh M27-M29 campaign uses a compatible local mechanical runner that records `green`, `assertion-red`, `SETUP`, `RUNNER`, or `KILLED` explicitly and ran only in the pinned offline Playwright container. Chromium rows explicitly select Chromium. The checkout was not mutated by either runner.

The baseline was HEAD `3c5e78e9a1cdbc462ba6415d638a04dd96288d06` with pre-existing Task 19 source and standard-file edits. Source hashes, status, diff fingerprint, frozen originals, runner, rows, and logs are outside the repository under the Task 19 recovery evidence directory. The pre-strengthening control had 10 unit tests green; the current nested-pre and host-wins controls have 14 unit tests green.

## Measured rows

| Row | Guard | File | Exact mutation | Test command | Result |
|---|---|---|---|---|---|
| L2-T19-M1 | settings chrome is opt-in | `src/enhance/settings.ts` | `  if (!ctx.options.chrome.settings \|\| ctx.slots === null) return; ⏎ ` -> `  if (false) return; ⏎ ` | `test/enhance-settings.test.ts` | red (`rc=1`) |
| L2-T19-M2 | settings radio names are root-local | `src/enhance/settings.ts` | `name: ctx.chromeId(`settings-${name}`)` -> `name: `settings-${name}`` | `test/enhance-settings.test.ts` | red (`rc=1`) |
| L2-T19-M3 | host preference events synchronize radios | `src/enhance/settings.ts` | `  ctx.events.on('prefs', sync); ⏎ ` -> `` | `test/enhance-settings.test.ts` | red (`rc=1`) |
| L2-T19-M4 | theme changes update preferences | `src/enhance/settings.ts` | `else ctx.setPrefs({ [name]: value } as Pick<Prefs, typeof name>);` -> `else void value;` | `test/enhance-settings.test.ts` | red (`rc=1`) |
| L2-T19-M5 | font changes preserve position and relayout | `src/enhance/settings.ts` | `if (name === 'font' \|\| name === 'width' \|\| name === 'lens')` -> `if (name === 'width' \|\| name === 'lens')` | `DOCREADER_BROWSERS=chromium ./node_modules/.bin/vitest run test/browser/settings.test.ts --maxWorkers=2` | red (`rc=1`) |
| L2-T19-M6 | width changes preserve position and relayout | `src/enhance/settings.ts` | `if (name === 'font' \|\| name === 'width' \|\| name === 'lens')` -> `if (name === 'font' \|\| name === 'lens')` | `DOCREADER_BROWSERS=chromium ./node_modules/.bin/vitest run test/browser/settings.test.ts --maxWorkers=2` | red (`rc=1`) |
| L2-T19-M7 | historical: lens position-preservation branch | `src/enhance/settings.ts` | `if (name === 'font' \|\| name === 'width' \|\| name === 'lens')` -> `if (name === 'font' \|\| name === 'width')` | `test/enhance-settings.test.ts` | historical green (`rc=0`), retained |
| L2-T19-M8 | collapse and expand preserve position | `src/enhance/settings.ts` | `ctx.position.keep(() => ctx.folds.setAll(true))` -> `ctx.folds.setAll(true)` | `test/enhance-settings.test.ts` | historical green (`rc=0`), retained |
| L2-T19-M9 | escape closes through the shared priority router | `src/enhance/settings.ts` | `  ctx.overlays.register('settings', { isOpen: () => !menu.hidden, close }); ⏎ ` -> `` | `test/enhance-settings.test.ts` | red (`rc=1`) |
| L2-T19-M10 | outside pointer containment is realm-safe | `src/enhance/settings.ts` | `    return root.contains(target as Node);` -> `    return true;` | `test/enhance-settings.test.ts` | red (`rc=1`) |
| L2-T19-M11 | historical: containment rejects non-object targets | `src/enhance/settings.ts` | `if (target === null \|\| typeof target !== 'object') return false;` -> `if (target === null) return false;` | `test/enhance-settings.test.ts` | historical green (`rc=0`), retained |
| L2-T19-M12 | collapse folds all sections | `src/enhance/settings.ts` | `ctx.folds.setAll(true)` -> `ctx.folds.setAll(false)` | `test/enhance-settings.test.ts` | red (`rc=1`) |
| L2-T19-M13 | expand unfolds all sections | `src/enhance/settings.ts` | `ctx.folds.setAll(false)` -> `ctx.folds.setAll(true)` | `test/enhance-settings.test.ts` | red (`rc=1`) |
| L2-T19-M14 | initial product lens builds peeks | `src/enhance/attention.ts` | `  if (ctx.state.prefs.lens === 'product') addPeeks();` -> `  if (false) addPeeks();` | `test/enhance-settings.test.ts` | red (`rc=1`) |
| L2-T19-M15 | changed product lens builds peeks | `src/enhance/attention.ts` | `    if (prefs.lens === 'product') addPeeks();` -> `    if (false) addPeeks();` | `test/enhance-settings.test.ts` | red (`rc=1`) |
| L2-T19-M16 | peek bars join their source fold | `src/enhance/attention.ts` | `    ctx.folds.join(bar, block.el);` -> `` | `test/enhance-settings.test.ts` | red (`rc=1`) |
| L2-T19-M17 | peek button toggles source visibility | `src/enhance/attention.ts` | `      ctx.journal.toggleClass(block.el, 'peek-open', shown);` -> `      ctx.journal.toggleClass(block.el, 'peek-open', !shown);` | `test/enhance-settings.test.ts` | red (`rc=1`) |
| L2-T19-M18 | attention table rows mark open, yours, unanswered and blocking | `src/enhance/attention.ts` | `      if (open \|\| yours \|\| unanswered \|\| blocking) ctx.journal.toggleClass(row, 'attn', true);` -> `      if (open \|\| yours \|\| unanswered) ctx.journal.toggleClass(row, 'attn', true);` | `test/enhance-settings.test.ts` | red (`rc=1`) |
| L2-T19-M19 | risk pills mark a row as risk | `src/enhance/attention.ts` | `      if (pill?.classList.contains('no') && ctx.vocab.attention.risk.test(text(pill))) ctx.journal.toggleClass(row, 'risk', true);` -> `` | `test/enhance-settings.test.ts` | red (`rc=1`) |
| L2-T19-M20 | preformatted code is not a path mark | `src/enhance/attention.ts` | `    if (code.closest('pre') === null && ctx.vocab.path.test(text(code))) ctx.journal.toggleClass(code, 'path', true);` -> `    if (ctx.vocab.path.test(text(code))) ctx.journal.toggleClass(code, 'path', true);` | `test/enhance-settings.test.ts` | historical green (`rc=0`) before the nested fixture; fresh replay is red (`rc=1`, assertion failure) |
| L2-T19-M21 | long standalone code is technical | `src/enhance/attention.ts` | `      if (lines > 4 && block.el.closest('.callout, .short') === null) {` -> `      if (lines > 40 && block.el.closest('.callout, .short') === null) {` | `test/enhance-settings.test.ts` | red (`rc=1`) |
| L2-T19-M22 | short code is not technical | `src/enhance/attention.ts` | `      if (lines > 4 && block.el.closest('.callout, .short') === null) {` -> `      if (lines > 3 && block.el.closest('.callout, .short') === null) {` | `test/enhance-settings.test.ts` | red (`rc=1`) |
| L2-T19-M23 | root prefs write the product lens class | `src/enhance/state.ts` | `  journal.toggleClass(root, 'lens-product', prefs.lens === 'product');` -> `` | `test/enhance-settings.test.ts` | red (`rc=1`) |
| L2-T19-M24 | nested preformatted descendant is not a path mark | `src/enhance/attention.ts` | exact M20 replacement | `test/enhance-settings.test.ts` | red (`rc=1`, assertion failure) |
| L2-T19-M25 | lens preference position-preservation branch | `src/enhance/settings.ts` | exact M7 replacement | Chromium + WebKit browser control | historical green (`rc=0`), retained; native scroll anchoring masked the missing caller wrapper |
| L2-T19-M26 | collapse-all position preservation | `src/enhance/settings.ts` | exact M8 replacement | Chromium browser control | red (`rc=1`, assertion failure) |
| L2-T19-M27 | fresh: caller-level lens position preservation is effective without native scroll anchoring | `src/enhance/settings.ts` | exact M7/M25 replacement | Chromium + WebKit browser control with same-origin host stylesheet `overflow-anchor: none` | red (`rc=1`, assertion failure in both engines: 242.375px / 241.75px) |
| L2-T19-M28 | fresh: expand-all position preservation | `src/enhance/settings.ts` | `ctx.position.keep(() => ctx.folds.setAll(false))` -> `ctx.folds.setAll(false)` | Chromium + WebKit browser control with same-origin host stylesheet | red (`rc=1`, assertion failure in both engines) |
| L2-T19-M29 | fresh: conditional class teardown preserves a host edit | `src/enhance/journal.ts` | remove the exact host-wins early return from `toggleClass` undo | unit control | red (`rc=1`, assertion failure) |

### The rows, as the mutation runner reads them

```json
[
  {
    "id": "L2-T19-M1",
    "guard": "settings chrome is opt-in",
    "file": "src/enhance/settings.ts",
    "old": "  if (!ctx.options.chrome.settings || ctx.slots === null) return;\n",
    "new": "  if (false) return;\n",
    "tests": "test/enhance-settings.test.ts",
    "freeze": [
      "src/enhance/settings.ts",
      "src/enhance/attention.ts",
      "src/enhance/state.ts",
      "test/enhance-settings.test.ts"
    ]
  },
  {
    "id": "L2-T19-M2",
    "guard": "settings radio names are root-local",
    "file": "src/enhance/settings.ts",
    "old": "name: ctx.chromeId(`settings-${name}`)",
    "new": "name: `settings-${name}`",
    "tests": "test/enhance-settings.test.ts",
    "freeze": [
      "src/enhance/settings.ts",
      "src/enhance/attention.ts",
      "src/enhance/state.ts",
      "test/enhance-settings.test.ts"
    ]
  },
  {
    "id": "L2-T19-M3",
    "guard": "host preference events synchronize radios",
    "file": "src/enhance/settings.ts",
    "old": "  ctx.events.on('prefs', sync);\n",
    "new": "",
    "tests": "test/enhance-settings.test.ts",
    "freeze": [
      "src/enhance/settings.ts",
      "src/enhance/attention.ts",
      "src/enhance/state.ts",
      "test/enhance-settings.test.ts"
    ]
  },
  {
    "id": "L2-T19-M4",
    "guard": "theme changes update preferences",
    "file": "src/enhance/settings.ts",
    "old": "else ctx.setPrefs({ [name]: value } as Pick<Prefs, typeof name>);",
    "new": "else void value;",
    "tests": "test/enhance-settings.test.ts",
    "freeze": [
      "src/enhance/settings.ts",
      "src/enhance/attention.ts",
      "src/enhance/state.ts",
      "test/enhance-settings.test.ts"
    ]
  },
  {
    "id": "L2-T19-M5",
    "guard": "font changes preserve position and relayout",
    "file": "src/enhance/settings.ts",
    "old": "if (name === 'font' || name === 'width' || name === 'lens')",
    "new": "if (name === 'width' || name === 'lens')",
    "tests": "DOCREADER_BROWSERS=chromium ./node_modules/.bin/vitest run test/browser/settings.test.ts --maxWorkers=2",
    "freeze": [
      "src/enhance/settings.ts",
      "src/enhance/attention.ts",
      "src/enhance/state.ts",
      "test/browser/settings.test.ts"
    ]
  },
  {
    "id": "L2-T19-M6",
    "guard": "width changes preserve position and relayout",
    "file": "src/enhance/settings.ts",
    "old": "if (name === 'font' || name === 'width' || name === 'lens')",
    "new": "if (name === 'font' || name === 'lens')",
    "tests": "DOCREADER_BROWSERS=chromium ./node_modules/.bin/vitest run test/browser/settings.test.ts --maxWorkers=2",
    "freeze": [
      "src/enhance/settings.ts",
      "src/enhance/attention.ts",
      "src/enhance/state.ts",
      "test/browser/settings.test.ts"
    ]
  },
  {
    "id": "L2-T19-M7",
    "guard": "historical: lens preference position-preservation branch",
    "file": "src/enhance/settings.ts",
    "old": "if (name === 'font' || name === 'width' || name === 'lens')",
    "new": "if (name === 'font' || name === 'width')",
    "tests": "test/enhance-settings.test.ts",
    "freeze": [
      "src/enhance/settings.ts",
      "src/enhance/attention.ts",
      "src/enhance/state.ts",
      "test/enhance-settings.test.ts"
    ]
  },
  {
    "id": "L2-T19-M8",
    "guard": "collapse and expand preserve position",
    "file": "src/enhance/settings.ts",
    "old": "ctx.position.keep(() => ctx.folds.setAll(true))",
    "new": "ctx.folds.setAll(true)",
    "tests": "test/enhance-settings.test.ts",
    "freeze": [
      "src/enhance/settings.ts",
      "src/enhance/attention.ts",
      "src/enhance/state.ts",
      "test/enhance-settings.test.ts"
    ]
  },
  {
    "id": "L2-T19-M9",
    "guard": "escape closes through the shared priority router",
    "file": "src/enhance/settings.ts",
    "old": "  ctx.overlays.register('settings', { isOpen: () => !menu.hidden, close });\n",
    "new": "",
    "tests": "test/enhance-settings.test.ts",
    "freeze": [
      "src/enhance/settings.ts",
      "src/enhance/attention.ts",
      "src/enhance/state.ts",
      "test/enhance-settings.test.ts"
    ]
  },
  {
    "id": "L2-T19-M10",
    "guard": "outside pointer containment is realm-safe",
    "file": "src/enhance/settings.ts",
    "old": "    return root.contains(target as Node);",
    "new": "    return true;",
    "tests": "test/enhance-settings.test.ts",
    "freeze": [
      "src/enhance/settings.ts",
      "src/enhance/attention.ts",
      "src/enhance/state.ts",
      "test/enhance-settings.test.ts"
    ]
  },
  {
    "id": "L2-T19-M11",
    "guard": "historical: containment rejects non-object targets",
    "file": "src/enhance/settings.ts",
    "old": "if (target === null || typeof target !== 'object') return false;",
    "new": "if (target === null) return false;",
    "tests": "test/enhance-settings.test.ts",
    "freeze": [
      "src/enhance/settings.ts",
      "src/enhance/attention.ts",
      "src/enhance/state.ts",
      "test/enhance-settings.test.ts"
    ]
  },
  {
    "id": "L2-T19-M12",
    "guard": "collapse folds all sections",
    "file": "src/enhance/settings.ts",
    "old": "ctx.folds.setAll(true)",
    "new": "ctx.folds.setAll(false)",
    "tests": "test/enhance-settings.test.ts",
    "freeze": [
      "src/enhance/settings.ts",
      "src/enhance/attention.ts",
      "src/enhance/state.ts",
      "test/enhance-settings.test.ts"
    ]
  },
  {
    "id": "L2-T19-M13",
    "guard": "expand unfolds all sections",
    "file": "src/enhance/settings.ts",
    "old": "ctx.folds.setAll(false)",
    "new": "ctx.folds.setAll(true)",
    "tests": "test/enhance-settings.test.ts",
    "freeze": [
      "src/enhance/settings.ts",
      "src/enhance/attention.ts",
      "src/enhance/state.ts",
      "test/enhance-settings.test.ts"
    ]
  },
  {
    "id": "L2-T19-M14",
    "guard": "initial product lens builds peeks",
    "file": "src/enhance/attention.ts",
    "old": "  if (ctx.state.prefs.lens === 'product') addPeeks();",
    "new": "  if (false) addPeeks();",
    "tests": "test/enhance-settings.test.ts",
    "freeze": [
      "src/enhance/settings.ts",
      "src/enhance/attention.ts",
      "src/enhance/state.ts",
      "test/enhance-settings.test.ts"
    ]
  },
  {
    "id": "L2-T19-M15",
    "guard": "changed product lens builds peeks",
    "file": "src/enhance/attention.ts",
    "old": "    if (prefs.lens === 'product') addPeeks();",
    "new": "    if (false) addPeeks();",
    "tests": "test/enhance-settings.test.ts",
    "freeze": [
      "src/enhance/settings.ts",
      "src/enhance/attention.ts",
      "src/enhance/state.ts",
      "test/enhance-settings.test.ts"
    ]
  },
  {
    "id": "L2-T19-M16",
    "guard": "peek bars join their source fold",
    "file": "src/enhance/attention.ts",
    "old": "    ctx.folds.join(bar, block.el);",
    "new": "",
    "tests": "test/enhance-settings.test.ts",
    "freeze": [
      "src/enhance/settings.ts",
      "src/enhance/attention.ts",
      "src/enhance/state.ts",
      "test/enhance-settings.test.ts"
    ]
  },
  {
    "id": "L2-T19-M17",
    "guard": "peek button toggles source visibility",
    "file": "src/enhance/attention.ts",
    "old": "      ctx.journal.toggleClass(block.el, 'peek-open', shown);",
    "new": "      ctx.journal.toggleClass(block.el, 'peek-open', !shown);",
    "tests": "test/enhance-settings.test.ts",
    "freeze": [
      "src/enhance/settings.ts",
      "src/enhance/attention.ts",
      "src/enhance/state.ts",
      "test/enhance-settings.test.ts"
    ]
  },
  {
    "id": "L2-T19-M18",
    "guard": "attention table rows mark open, yours, unanswered and blocking",
    "file": "src/enhance/attention.ts",
    "old": "      if (open || yours || unanswered || blocking) ctx.journal.toggleClass(row, 'attn', true);",
    "new": "      if (open || yours || unanswered) ctx.journal.toggleClass(row, 'attn', true);",
    "tests": "test/enhance-settings.test.ts",
    "freeze": [
      "src/enhance/settings.ts",
      "src/enhance/attention.ts",
      "src/enhance/state.ts",
      "test/enhance-settings.test.ts"
    ]
  },
  {
    "id": "L2-T19-M19",
    "guard": "risk pills mark a row as risk",
    "file": "src/enhance/attention.ts",
    "old": "      if (pill?.classList.contains('no') && ctx.vocab.attention.risk.test(text(pill))) ctx.journal.toggleClass(row, 'risk', true);",
    "new": "",
    "tests": "test/enhance-settings.test.ts",
    "freeze": [
      "src/enhance/settings.ts",
      "src/enhance/attention.ts",
      "src/enhance/state.ts",
      "test/enhance-settings.test.ts"
    ]
  },
  {
    "id": "L2-T19-M20",
    "guard": "preformatted code is not a path mark",
    "file": "src/enhance/attention.ts",
    "old": "    if (code.closest('pre') === null && ctx.vocab.path.test(text(code))) ctx.journal.toggleClass(code, 'path', true);",
    "new": "    if (ctx.vocab.path.test(text(code))) ctx.journal.toggleClass(code, 'path', true);",
    "tests": "test/enhance-settings.test.ts",
    "freeze": [
      "src/enhance/settings.ts",
      "src/enhance/attention.ts",
      "src/enhance/state.ts",
      "test/enhance-settings.test.ts"
    ]
  },
  {
    "id": "L2-T19-M21",
    "guard": "long standalone code is technical",
    "file": "src/enhance/attention.ts",
    "old": "      if (lines > 4 && block.el.closest('.callout, .short') === null) {",
    "new": "      if (lines > 40 && block.el.closest('.callout, .short') === null) {",
    "tests": "test/enhance-settings.test.ts",
    "freeze": [
      "src/enhance/settings.ts",
      "src/enhance/attention.ts",
      "src/enhance/state.ts",
      "test/enhance-settings.test.ts"
    ]
  },
  {
    "id": "L2-T19-M22",
    "guard": "short code is not technical",
    "file": "src/enhance/attention.ts",
    "old": "      if (lines > 4 && block.el.closest('.callout, .short') === null) {",
    "new": "      if (lines > 3 && block.el.closest('.callout, .short') === null) {",
    "tests": "test/enhance-settings.test.ts",
    "freeze": [
      "src/enhance/settings.ts",
      "src/enhance/attention.ts",
      "src/enhance/state.ts",
      "test/enhance-settings.test.ts"
    ]
  },
  {
    "id": "L2-T19-M23",
    "guard": "root prefs write the product lens class",
    "file": "src/enhance/state.ts",
    "old": "  journal.toggleClass(root, 'lens-product', prefs.lens === 'product');",
    "new": "",
    "tests": "test/enhance-settings.test.ts",
    "freeze": [
      "src/enhance/settings.ts",
      "src/enhance/attention.ts",
      "src/enhance/state.ts",
      "test/enhance-settings.test.ts"
    ]
  },
  {
    "id": "L2-T19-M24",
    "guard": "fresh: preformatted descendant is not a path mark",
    "file": "src/enhance/attention.ts",
    "old": "    if (code.closest('pre') === null && ctx.vocab.path.test(text(code))) ctx.journal.toggleClass(code, 'path', true);",
    "new": "    if (ctx.vocab.path.test(text(code))) ctx.journal.toggleClass(code, 'path', true);",
    "tests": "test/enhance-settings.test.ts",
    "freeze": [
      "src/enhance/settings.ts",
      "src/enhance/attention.ts",
      "src/enhance/state.ts",
      "test/enhance-settings.test.ts"
    ]
  },
  {
    "id": "L2-T19-M25",
    "guard": "fresh: lens preference position-preservation branch",
    "file": "src/enhance/settings.ts",
    "old": "if (name === 'font' || name === 'width' || name === 'lens')",
    "new": "if (name === 'font' || name === 'width')",
    "tests": "DOCREADER_BROWSERS=chromium,webkit ./node_modules/.bin/vitest run test/browser/settings.test.ts --maxWorkers=2",
    "freeze": [
      "src/enhance/settings.ts",
      "src/enhance/attention.ts",
      "src/enhance/state.ts",
      "test/browser/settings.test.ts"
    ]
  },
  {
    "id": "L2-T19-M26",
    "guard": "fresh: collapse-all preserves reader position",
    "file": "src/enhance/settings.ts",
    "old": "ctx.position.keep(() => ctx.folds.setAll(true))",
    "new": "ctx.folds.setAll(true)",
    "tests": "DOCREADER_BROWSERS=chromium ./node_modules/.bin/vitest run test/browser/settings.test.ts --maxWorkers=2",
    "freeze": [
      "src/enhance/settings.ts",
      "src/enhance/attention.ts",
      "src/enhance/state.ts",
      "test/browser/settings.test.ts"
    ]
  },
  {
    "id": "L2-T19-M27",
    "guard": "fresh: caller-level lens position preservation is effective without native scroll anchoring",
    "file": "src/enhance/settings.ts",
    "old": "if (name === 'font' || name === 'width' || name === 'lens')",
    "new": "if (name === 'font' || name === 'width')",
    "tests": "DOCREADER_BROWSERS=chromium,webkit ./node_modules/.bin/vitest run test/browser/settings.test.ts --maxWorkers=2",
    "freeze": [
      "assets/reader.css",
      "src/enhance/settings.ts",
      "src/enhance/attention.ts",
      "src/enhance/state.ts",
      "src/enhance/journal.ts",
      "test/browser/harness.ts",
      "test/browser/settings.test.ts"
    ]
  },
  {
    "id": "L2-T19-M28",
    "guard": "fresh: expand-all preserves reader position",
    "file": "src/enhance/settings.ts",
    "old": "ctx.position.keep(() => ctx.folds.setAll(false))",
    "new": "ctx.folds.setAll(false)",
    "tests": "DOCREADER_BROWSERS=chromium,webkit ./node_modules/.bin/vitest run test/browser/settings.test.ts --maxWorkers=2",
    "freeze": [
      "assets/reader.css",
      "src/enhance/settings.ts",
      "src/enhance/attention.ts",
      "src/enhance/state.ts",
      "src/enhance/journal.ts",
      "test/browser/harness.ts",
      "test/browser/settings.test.ts"
    ]
  },
  {
    "id": "L2-T19-M29",
    "guard": "fresh: destroy preserves a host preference class changed after enhancement",
    "file": "src/enhance/journal.ts",
    "old": "          if (el.classList.contains(cls) !== r.last) return; // the host changed it since: the host wins\n",
    "new": "",
    "tests": "./node_modules/.bin/vitest run test/enhance-settings.test.ts --maxWorkers=2",
    "freeze": [
      "src/enhance/settings.ts",
      "src/enhance/attention.ts",
      "src/enhance/state.ts",
      "src/enhance/journal.ts",
      "test/enhance-settings.test.ts"
    ]
  }
]

```

## Green and unmeasured guards

- **Historical green ledger: M5, M7, M8, M11, and M20.** There were 23 distinct historical IDs, not 21. M5 initially passed the unit run (`13/13` in `mutate-pass-1.log`) before the real-browser geometry control was added; its later browser replay is red, which is the current verdict. M7 removed `lens` from the settings caller's `position.keep` branch and M11 removed the explicit `typeof target !== 'object'` rejection; both were measured green (`13/13`) in `mutate-pass-2.log`. M11 remains plausibly redundant only within the measured domain: native `contains` throws for invalid targets and the catch returns false. That does not establish behavior outside the tested DOM implementation.
- **M20 is historical green, not a redundancy claim.** `li code` admits `<li><pre><code>...</code></pre></li>`; the historical fixture appended its `pre` directly to the root and therefore could not expose the guard. The strengthened nested fixture leaves the historical green recorded and makes the fresh replay of the exact M20 replacement red: the nested code incorrectly gains `path`. M24 is the separately numbered repeat of that now-effective replacement.
- **M8's historical green was jsdom-limited.** M26 replays that exact collapse replacement in Chromium with a real fold-induced scroll-height change and fails the <=2px anchor assertion. Chromium and WebKit controls both pass unmutated. M25 replays the exact M7 replacement across both engines and remains green, but it is historical only: native browser scroll anchoring masks the missing caller wrapper. M27 repeats the exact replacement after a local same-origin host stylesheet sets `html, body { overflow-anchor: none; }`, proves `getComputedStyle(document.body).overflowAnchor === 'none'` and has no CSP violations before any geometry action, then fails the unchanged <=2px lens anchor assertion in Chromium (242.375px) and WebKit (241.75px). `relayout('prefs')` does not make the caller wrapper redundant.
- **Fresh expand and teardown rows:** M28 deletes only the expand wrapper and fails the fold anchor assertion in both engines; M29 deletes only the `toggleClass` host-wins conditional and fails the independent-root teardown assertion (`[false, false]` instead of `[true, false]`). The local runner classifies all three as assertion reds, not raw exit statuses.
- **Fresh campaign provenance:** the complete input tree was frozen once before the M27-M29 controls and mutations, with a manifest, status, diff, copied dependencies, rows, command log, per-row logs and structured records retained under `unmasked-corrections`. Every fresh JSON anchor occurs exactly once. The fresh campaign contains only M27-M29 plus controls; it does not reclassify or replace historical M1-M26 evidence.
- **Not yet measured:** separate index-rule risk/open-status predicates; owner/status header selection; question-answer predicate; table technical classification and its glossary/callout/decision skips; menu focus-return guard. This journal does not claim Task 19 completion or full guard coverage.

## Controls

- Current unit control: `./node_modules/.bin/vitest run test/enhance-settings.test.ts --maxWorkers=2` - 14 passed.
- Current Chromium browser control: `DOCREADER_BROWSERS=chromium ./node_modules/.bin/vitest run test/browser/settings.test.ts --maxWorkers=2` - 2 passed, 2 explicitly excluded.
- Current WebKit browser control used the pinned offline disposable container (`mcr.microsoft.com/playwright:v1.63.0-noble`, `--rm --network none`, writable isolated copy, `HOME=/tmp`) - 2 passed, 2 explicitly excluded.
- Fresh unmasked browser control: the same pinned container selected both engines and passed all 4 tests after the test's intercepted same-origin host CSS disabled native scroll anchoring; computed `body` `overflow-anchor` was `none` and no CSP violations occurred before geometry actions.
- All three TypeScript projects: `npm run typecheck` - passed.
- The extracted M1-M26 JSON fence was replayed with the stated saved runner. M7 and M11 remained green, M24 and M26 failed on assertions, and M25 remained green. Its host WebKit startup `rc=1` in the legacy host replay is a setup error, not a red mutant; the pinned offline replay provides the usable M25 result. The replay data carries the runner-required `freeze` provenance on every row.
- Fresh M27-M29 JSON was mechanically replayed from the one frozen complete input tree in the pinned offline container: 2 green controls and 3 assertion-red mutants, with no setup, runner, import, timeout, or killed result. The archived campaign has 5 rows, 5 per-row logs and a 203-file manifest; the frozen manifest SHA-256 is `2b6975ce9bef1f09fe2483022b192a754ce30313f9a7df478fe34f33553eae8d`.
- Full browser suite: 225/227 tests passed; two existing `test/browser/nav.test.ts` initial-hash tolerance assertions failed in Chromium (3.765625px vs 1px) and WebKit (4.34375px vs 1px). This is outside the owned settings tests and does not alter the focused controls.

## Reconciliation: residual guards (2026-10-21)

The method, rows M1-M29 and controls above are historical epochs, not a claim about the latest test count. The previously unmeasured guards were subsequently investigated on a 22-test input, then strengthened through a 23-test input to the 28-test permanent control below. Earlier greens and runner failures remain recorded; a later assertion red does not rewrite them.

### Historical residual campaign: M30-M39

The 22-test control passed. The historical exact replacements are reproduced in the following JSON block, including the nonmatching indentation in M32/M33. Every numbered result belongs to that input, not the later actual-pill implementation.

| Row | Guard/replacement | Historical result |
| --- | --- | --- |
| L2-T19-M30 | Remove the negative-status requirement from the rule risk predicate that read the whole entry | Green, 22/22; not a redundancy ruling |
| L2-T19-M31 | Replace the whole-entry open-status predicate with `true` | Green, 22/22; not a redundancy ruling |
| L2-T19-M32 | Remove the owner-header inner `index > 0` test | RUNNER: the four-space anchor occurred zero times; no mutation verdict |
| L2-T19-M33 | Remove the status-header inner `index > 0` test | RUNNER: the four-space anchor occurred zero times; no mutation verdict |
| L2-T19-M34 | Treat any two-column table as a question table | Assertion red: `marks only unanswered question rows from the answer column` |
| L2-T19-M35 | Remove the group-row skip | Assertion red: `does not mark a grouped row even when its cells otherwise match attention predicates` and `skips grouped table rows, preformatted paths and short code from attention marks` |
| L2-T19-M36 | Remove code-share technical table classification | Assertion red: `classifies technical tables by code share or technical headers and skips excluded tables` |
| L2-T19-M37 | Remove technical-header classification | Assertion red: the same technical-table control |
| L2-T19-M38 | Remove the combined excluded/decision table skip | Assertion red: the same technical-table control; not independent proof of every disjunct |
| L2-T19-M39 | Return focus unconditionally when Settings closes | Green, 22/22; the original fixture closed on ordinary focusout before the outside-pointer path could discriminate |

Correcting only the indentation in M32/M33 made both replacements execute, but the 22-test controls still passed. A later private combined-header diagnostic is not usable red-green evidence: its first control never started a worker, its retry failed the same assertion without a mutation, and its two mutant failures therefore do not prove those guards. The permanent literal-vocabulary controls below replace that inadequate diagnostic; they do not erase it.

Separate private diagnostic cases made historical M30/M31 assertion-red with a green 24-test control, but those cases were not themselves permanent coverage. The subsequent rule implementation reads the actual `.rule-head .pill`, rather than all entry prose. M43/M44 below reverse distinct actual-pill behavior; they are not renamed M30/M31. Individual glossary, callout, minimum-row and decision-skip diagnostics also failed the technical-table assertion, but are not silently added to M38's combined-guard verdict.

### Permanent five-control follow-up: M40-M44

The follow-up added five tests (139 lines, zero removals) to the prior 23-test file; those prior tests were byte-identical in the reviewed input. Production source did not change in this follow-up. Only the explanatory mutation labels were subsequently reconciled to the canonical IDs below; test statements and assertions were unchanged.

| Row | Exact behavioral reversal | Permanent assertion and measured result |
| --- | --- | --- |
| L2-T19-M40 | Repeat M39's unconditional focus return | Capture suppresses focusout, leaving Settings open while a real outside button owns focus; outside pointer must close without stealing it. One intended assertion failed, 27 passed; restoration 28/28 |
| L2-T19-M41 | Remove only `statusCell`'s inner `index > 0 &&`, retaining outer `at > 0` | Literal replacement `status: ['ID', 'Status']` must select the later status column and mark the waiting row; `['ID']` must select none. One intended assertion failed, 27 passed; restoration 28/28 |
| L2-T19-M42 | Remove only `ownerCell`'s inner `index > 0 &&`, retaining outer `at > 0` | Literal replacement `who: ['ID', 'Owner']` must select the later owner column; `['ID']` must select none. One intended assertion failed, 27 passed; restoration 28/28 |
| L2-T19-M43 | Read risk words from `text(entry.target)` instead of `text(pill)` after the negative-status guard | Negative rules with risk words only in body prose or a later note must not gain `risk`. One intended assertion failed, 27 passed; restoration 28/28 |
| L2-T19-M44 | Replace normalized `text(pill)` with raw trimmed `textContent` in the open-status predicate | The real rule pill contains nested strong text and a line break; literal `queued for review` must match normalized internal whitespace. One intended assertion failed, 27 passed; restoration 28/28 |

**Canonical ID reconciliation.** Historical M32 is owner and M33 is status. The follow-up's private filenames and original test comments accidentally used `m32` for status and `m33` for owner. Those artifacts are retained verbatim, not relabeled as historical evidence. Their exact patches map to canonical M41 (status) and M42 (owner); private `m39`, `rule-risk` and `rule-open` map to M40, M43 and M44 respectively. Permanent comments now use M40-M44. In particular, the outer `at > 0` does not make either inner guard redundant: `findIndex` stops at the matching identifier header without it.

### Fresh verification and limits

- The independent permanent control and each restoration passed 28/28. Each of M40-M44 failed exactly its intended DOM/focus assertion with 27 passing tests; no setup, import, runner, timeout or killed result was counted as assertion-red.
- Independent offline browser probes exercised actual rule pills and literal vocabulary in Chromium and WebKit using the pinned Playwright 1.63.0 container (`--rm --network none --pull never`, isolated writable copy, `HOME=/tmp`). The control and restoration passed 10/10 across both engines. M43 and M44 each caused one intended assertion failure per engine (2 failed, 2 passed); the initial writer's browser report did not supply M44, which the independent replay supplied. These disposable probes are not claimed as permanent browser tests.
- All three TypeScript projects passed on the independently frozen Task 19 input. This does not claim that peer-owned Task 18 inputs typechecked.
- The fresh physical-copy audit covered 16,251 entries, including source, tests, configuration, dependencies, modes and symlink targets. Original, frozen and replay final manifests matched their expected inputs. There were no shared regular-file inodes, multiply linked regular files or escaping dependency symlinks. Only `node_modules/.vite/vitest/da39a3ee5e6b4b0d3255bfef95601890afd80709/results.json` was separately mutable. This complete-copy campaign supersedes neither the weaker historical copy method nor its recorded results.
- Reviewed behavioral input hashes: `test/enhance-settings.test.ts` SHA-256 `17c8cf4d4fa22e8e8eeab48c83f18c6293a9867d797f8fd5f93ab3eb4e365b92`; `src/enhance/attention.ts` SHA-256 `236b5083a4f8e7b140838d610fb01d4c33811cbbc3e8836ab2037f86ca0e649d`; `src/enhance/settings.ts` SHA-256 `d0b4a868dce64f537fe2ca329f57f5fc9e0e5c8504b8fb1058ffd0f0a952b780`. The first hash identifies the pre-label-reconciliation test bytes, not a fabricated current hash.
- The completed full `npm test -- --maxWorkers=2` on the matched follow-up input remained red: 2,301 passed, 95 skipped, 7 failed tests; 61 passed and 15 failed files. The independent review retained, rather than reran, that full result. Focused browser probes do not erase full-suite failures.

The seven full-run failing test identities were:

| File | Exact failing test | Classification |
| --- | --- | --- |
| `test/enhance-ids.test.ts` | `ID rows (ids.ts; the reference layout, section 8) > RF3: on the large plan every one of its 2,000 rows is defined` | afterEach 10,000ms timeout, not assertion-red |
| `test/enhance-jump.test.ts` | `the keys sheet > "?" opens it, listing the keys that apply now in the sheet's order, then Esc; the focus goes to Close` | Unexpected real j/k binding |
| `test/enhance-jump.test.ts` | `the keys sheet > a key bound by a later feature is listed, in the sheet's order; one that does not apply now, or is unlisted, is not` | Unexpected real j/k binding |
| `test/enhance-jump.test.ts` | `the keys sheet > keys next to each other with one label share a row; only keys next to each other do` | Unexpected real j/k binding |
| `test/enhance-jump.test.ts` | `the keys sheet > the reference's pairs share a row whatever their labels: "j k" and "n p"; one of a pair alone has a row of its own` | Unexpected real j/k binding |
| `test/enhance-jump.test.ts` | `the keys sheet > a document with no jump still has its sheet, without "/"` | Unexpected real j/k binding |
| `test/browser/nav.test.ts` | `chromium > the initial hash lands under the bar, at the stylesheet's margin; a row with no id lands below the bar and the head's room` | 3.765625px exceeds the unchanged 1px tolerance |

Thirteen exact `> webkit` suites also failed to launch on the host because system libraries were unavailable: `test/browser/blocks.test.ts`, `test/browser/harness.test.ts`, `test/browser/ids.test.ts`, `test/browser/jump.test.ts`, `test/browser/layout-corpus.test.ts`, `test/browser/mermaid-file.test.ts`, `test/browser/nav.test.ts`, `test/browser/plans.test.ts`, `test/browser/scroll.test.ts`, `test/browser/seams.test.ts`, `test/browser/services.test.ts`, `test/browser/settings-path.test.ts` and `test/browser/settings.test.ts`. These are startup failures, not product assertion reds. No host packages were installed.

A separate replay after the comment-label reconciliation passed all 28 settings tests and all three TypeScript projects. Its complete physical input differed from the preserved permanent-control input only in this journal and the five explanatory test comments; test statements and production source were unchanged. The comment-reconciled test SHA-256 was `c90fa4cc3583aebd9e92f458d13a7069010afefebc3de2e258a6df73d09281a0`. The copy audit covered 16,251 entries, with no cross-root regular-file inode sharing, no multiply linked files in the copies and no escaping copy symlinks. Source, preserved frozen input and replay remained unchanged outside the separately permitted test cache.

That replay's full `npm test -- --maxWorkers=2` exited 1 after 338.81 seconds: 2,300 passed, 97 skipped, 6 failed tests; 62 passed and 14 failed files. The six failures were the same five `test/enhance-jump.test.ts` identities and the same Chromium `test/browser/nav.test.ts` assertion listed above, again 3.765625px against the unchanged 1px tolerance. The same thirteen WebKit suites failed to launch. The earlier IDs afterEach timeout did not recur in this run; that observation neither erases the earlier timeout nor establishes a flake. These are separate full-run observations, not a green project result.

This appendix accepts only five permanent regression controls. It does not accept Task 19, Task 18, group D, full guard coverage, corpus changes or project health, and changes no RF3 or geometry budget.

### Historical M30-M39 replay rows

The exact old/new strings are historical, including the two zero-occurrence anchors. Apply each to its recorded historical input, not today's source. Every executable replay must first prove a green unmutated control on the same complete frozen input and refuse an anchor count other than one.

```json
[
  {
    "id": "L2-T19-M30",
    "guard": "a risk mark requires the rule entry to have no status",
    "file": "src/enhance/attention.ts",
    "old": "    if (entry.status === 'no' && ctx.vocab.attention.risk.test(text(entry.target))) ctx.journal.toggleClass(entry.target, 'risk', true);\n",
    "new": "    if (ctx.vocab.attention.risk.test(text(entry.target))) ctx.journal.toggleClass(entry.target, 'risk', true);\n",
    "tests": "./node_modules/.bin/vitest run test/enhance-settings.test.ts --maxWorkers=2",
    "freeze": [
      "src/enhance/settings.ts",
      "src/enhance/attention.ts",
      "src/enhance/state.ts",
      "test/enhance-settings.test.ts"
    ]
  },
  {
    "id": "L2-T19-M31",
    "guard": "an attention mark requires an indexed rule's open-status predicate",
    "file": "src/enhance/attention.ts",
    "old": "    else if (ctx.vocab.attention.openStatus.test(text(entry.target))) ctx.journal.toggleClass(entry.target, 'attn', true);\n",
    "new": "    else if (true) ctx.journal.toggleClass(entry.target, 'attn', true);\n",
    "tests": "./node_modules/.bin/vitest run test/enhance-settings.test.ts --maxWorkers=2",
    "freeze": [
      "src/enhance/settings.ts",
      "src/enhance/attention.ts",
      "src/enhance/state.ts",
      "test/enhance-settings.test.ts"
    ]
  },
  {
    "id": "L2-T19-M32",
    "guard": "the owner header is selected after the identifier column",
    "file": "src/enhance/attention.ts",
    "old": "    const at = table.heads.findIndex((head, index) => index > 0 && ctx.vocab.attention.who.test(head));\n",
    "new": "    const at = table.heads.findIndex((head) => ctx.vocab.attention.who.test(head));\n",
    "tests": "./node_modules/.bin/vitest run test/enhance-settings.test.ts --maxWorkers=2",
    "freeze": [
      "src/enhance/settings.ts",
      "src/enhance/attention.ts",
      "src/enhance/state.ts",
      "test/enhance-settings.test.ts"
    ]
  },
  {
    "id": "L2-T19-M33",
    "guard": "the status header is selected after the identifier column",
    "file": "src/enhance/attention.ts",
    "old": "    const at = table.heads.findIndex((head, index) => index > 0 && ctx.vocab.attention.status.test(head));\n",
    "new": "    const at = table.heads.findIndex((head) => ctx.vocab.attention.status.test(head));\n",
    "tests": "./node_modules/.bin/vitest run test/enhance-settings.test.ts --maxWorkers=2",
    "freeze": [
      "src/enhance/settings.ts",
      "src/enhance/attention.ts",
      "src/enhance/state.ts",
      "test/enhance-settings.test.ts"
    ]
  },
  {
    "id": "L2-T19-M34",
    "guard": "the question-table predicate requires a question first header",
    "file": "src/enhance/attention.ts",
    "old": "    const question = block.heads.length === 2 && ctx.vocab.attention.question.test(block.heads[0] ?? '');\n",
    "new": "    const question = block.heads.length === 2;\n",
    "tests": "./node_modules/.bin/vitest run test/enhance-settings.test.ts --maxWorkers=2",
    "freeze": [
      "src/enhance/settings.ts",
      "src/enhance/attention.ts",
      "src/enhance/state.ts",
      "test/enhance-settings.test.ts"
    ]
  },
  {
    "id": "L2-T19-M35",
    "guard": "group table rows skip attention predicates",
    "file": "src/enhance/attention.ts",
    "old": "      if (row.classList.contains('group')) continue;\n",
    "new": "",
    "tests": "./node_modules/.bin/vitest run test/enhance-settings.test.ts --maxWorkers=2",
    "freeze": [
      "src/enhance/settings.ts",
      "src/enhance/attention.ts",
      "src/enhance/state.ts",
      "test/enhance-settings.test.ts"
    ]
  },
  {
    "id": "L2-T19-M36",
    "guard": "code-proportion technical classification applies to qualifying tables",
    "file": "src/enhance/attention.ts",
    "old": "    const technical = cells.length > 0 && codey / cells.length > 0.3 || block.heads.filter((head) => ctx.vocab.techHeader.test(head)).length >= Math.max(1, Math.ceil(block.heads.length / 2));\n",
    "new": "    const technical = block.heads.filter((head) => ctx.vocab.techHeader.test(head)).length >= Math.max(1, Math.ceil(block.heads.length / 2));\n",
    "tests": "./node_modules/.bin/vitest run test/enhance-settings.test.ts --maxWorkers=2",
    "freeze": [
      "src/enhance/settings.ts",
      "src/enhance/attention.ts",
      "src/enhance/state.ts",
      "test/enhance-settings.test.ts"
    ]
  },
  {
    "id": "L2-T19-M37",
    "guard": "technical-header classification applies to qualifying tables",
    "file": "src/enhance/attention.ts",
    "old": "    const technical = cells.length > 0 && codey / cells.length > 0.3 || block.heads.filter((head) => ctx.vocab.techHeader.test(head)).length >= Math.max(1, Math.ceil(block.heads.length / 2));\n",
    "new": "    const technical = cells.length > 0 && codey / cells.length > 0.3;\n",
    "tests": "./node_modules/.bin/vitest run test/enhance-settings.test.ts --maxWorkers=2",
    "freeze": [
      "src/enhance/settings.ts",
      "src/enhance/attention.ts",
      "src/enhance/state.ts",
      "test/enhance-settings.test.ts"
    ]
  },
  {
    "id": "L2-T19-M38",
    "guard": "technical tables exclude glossary, short, callout, and decision blocks",
    "file": "src/enhance/attention.ts",
    "old": "    if (excluded || decision) continue;\n",
    "new": "    if (false) continue;\n",
    "tests": "./node_modules/.bin/vitest run test/enhance-settings.test.ts --maxWorkers=2",
    "freeze": [
      "src/enhance/settings.ts",
      "src/enhance/attention.ts",
      "src/enhance/state.ts",
      "test/enhance-settings.test.ts"
    ]
  },
  {
    "id": "L2-T19-M39",
    "guard": "settings close preserves host focus already outside the menu",
    "file": "src/enhance/settings.ts",
    "old": "    if (menu.contains(doc.activeElement) || doc.activeElement === ctx.root) focus(returnFocus);\n",
    "new": "    focus(returnFocus);\n",
    "tests": "./node_modules/.bin/vitest run test/enhance-settings.test.ts --maxWorkers=2",
    "freeze": [
      "src/enhance/settings.ts",
      "src/enhance/attention.ts",
      "src/enhance/state.ts",
      "test/enhance-settings.test.ts"
    ]
  }
]
```

### Fresh M40-M44 replay rows

All five exact anchors occurred once in the reviewed behavioral input. Use package-local Vitest from the isolated copy root, in the foreground with a 600-second deadline and two workers. Make independent physical replay copies, never mutate the frozen input, and restore control bytes before any subsequent row. The `freeze` list is a compatibility field for the mechanical runner, not permission to omit the rest of the complete input/dependency manifest.

```json
[
  {
    "id": "L2-T19-M40",
    "guard": "fresh M39 replay: settings close preserves actual outside focus",
    "file": "src/enhance/settings.ts",
    "old": "    if (menu.contains(doc.activeElement) || doc.activeElement === ctx.root) focus(returnFocus);",
    "new": "    focus(returnFocus);",
    "tests": "./node_modules/.bin/vitest run test/enhance-settings.test.ts --maxWorkers=2",
    "freeze": [
      "src/enhance/settings.ts",
      "src/enhance/attention.ts",
      "src/enhance/state.ts",
      "test/enhance-settings.test.ts"
    ]
  },
  {
    "id": "L2-T19-M41",
    "guard": "statusCell searches only headers after the identifier column",
    "file": "src/enhance/attention.ts",
    "old": "  const at = table.heads.findIndex((head, index) => index > 0 && ctx.vocab.attention.status.test(head));",
    "new": "  const at = table.heads.findIndex((head, index) => ctx.vocab.attention.status.test(head));",
    "tests": "./node_modules/.bin/vitest run test/enhance-settings.test.ts --maxWorkers=2",
    "freeze": [
      "src/enhance/settings.ts",
      "src/enhance/attention.ts",
      "src/enhance/state.ts",
      "test/enhance-settings.test.ts"
    ]
  },
  {
    "id": "L2-T19-M42",
    "guard": "ownerCell searches only headers after the identifier column",
    "file": "src/enhance/attention.ts",
    "old": "  const at = table.heads.findIndex((head, index) => index > 0 && ctx.vocab.attention.who.test(head));",
    "new": "  const at = table.heads.findIndex((head, index) => ctx.vocab.attention.who.test(head));",
    "tests": "./node_modules/.bin/vitest run test/enhance-settings.test.ts --maxWorkers=2",
    "freeze": [
      "src/enhance/settings.ts",
      "src/enhance/attention.ts",
      "src/enhance/state.ts",
      "test/enhance-settings.test.ts"
    ]
  },
  {
    "id": "L2-T19-M43",
    "guard": "negative rule risk uses only the actual status pill",
    "file": "src/enhance/attention.ts",
    "old": "    if (entry.status === 'no' && ctx.vocab.attention.risk.test(text(pill))) ctx.journal.toggleClass(entry.target, 'risk', true);",
    "new": "    if (entry.status === 'no' && ctx.vocab.attention.risk.test(text(entry.target))) ctx.journal.toggleClass(entry.target, 'risk', true);",
    "tests": "./node_modules/.bin/vitest run test/enhance-settings.test.ts --maxWorkers=2",
    "freeze": [
      "src/enhance/settings.ts",
      "src/enhance/attention.ts",
      "src/enhance/state.ts",
      "test/enhance-settings.test.ts"
    ]
  },
  {
    "id": "L2-T19-M44",
    "guard": "rule open status normalizes actual internal pill whitespace",
    "file": "src/enhance/attention.ts",
    "old": "    else if (ctx.vocab.attention.openStatus.test(text(pill))) ctx.journal.toggleClass(entry.target, 'attn', true);",
    "new": "    else if (ctx.vocab.attention.openStatus.test((pill.textContent ?? '').trim())) ctx.journal.toggleClass(entry.target, 'attn', true);",
    "tests": "./node_modules/.bin/vitest run test/enhance-settings.test.ts --maxWorkers=2",
    "freeze": [
      "src/enhance/settings.ts",
      "src/enhance/attention.ts",
      "src/enhance/state.ts",
      "test/enhance-settings.test.ts"
    ]
  }
]
```

## Deviations found

None.
