# Batch Task 6: mutation rows (the tools without the bar, commands, progress, `--bar-h`, `topSpace`)

Step 1 of the task wrote the tests before the code, but the first bounded run queued behind other work for many minutes, and the source edits were made while it waited, so there is no separate run of the new tests against the old code. The red of each guard is shown by its row below instead: the row removes that guard (or takes the guard's opposite) and the named tests go red through assertions.

## Method

Each row was measured in place on branch `ws/docserver-release-1-1`, one at a time, by one driver run. For each row: the bytes of every edited file and of every generated output (`assets/assets.json`, `src/frame/manifest.generated.ts`, `assets/frame/*`) were saved and hashed; the edit was applied; the named tests ran in a bounded run (`timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 <files>`, with `ulimit -u` set to the measured thread count plus 1500); the edited files were restored from the saved bytes (byte copy) and their sha256 checked against the saved one; the generated outputs were hashed again (a row edits sources but never rebuilds, so they must be unchanged) and `node scripts/build-frame.mjs --check` ran after each restore. A row is red only through test assertions (no compile or import failure).

Row B6h (the prelude rule `[data-docreader-root][data-docreader-root]:not(:has(> .topbar)){--bar-h:0px}` deleted from `scripts/build-frame.mjs`) is measured in Task 8: its red is a browser row there.

Rows B6a to B6g are the brief's. B6i to B6p are this task's own: B6i (`topSpace` class), B6j (outline command), B6k (settings toggles), B6l (`onProgress` is read from the options), B6m and B6o (the registry's two live checks, red through the direct registry test), B6n (Aa in the tray when the bar exists), B6p (below).

## Verdicts

Every row is red through assertions except:

- B6p stays green: an equivalent mutant. The registry's `known()` check in `run` only guards a lookup in a map whose keys are all known names (`register` throws for any other), so a name that is not known finds no handler and answers false either way. B6f is the guard that matters (an unknown name must not reach any handler), and it is red.

## The rows

| Row | Guard | File | Change | Red |
|---|---|---|---|---|
| B6a | Aa without the bar | `src/enhance/settings.ts` | `  if (!ctx.options.chrome.settings) return;` → `  if (!ctx.options.chrome.settings \|\| ctx.slots === null) return;` | `test/enhance-settings.test.ts`: 2 failed \| 30 passed (32) |
| B6b | toggle, not open | `src/enhance/rail.ts` | `  ctx.commands.register('contents', () => { ⏎     if (drawerOpen) close(); ⏎     else open(); ⏎ ` → `  ctx.commands.register('contents', () => { ⏎     open(); ⏎   });` | `test/enhance-rail.test.ts`: 1 failed \| 18 passed (19) |
| B6c | jump reachable | `src/enhance/jump.ts` | `  ctx.commands.register('jump', () => {` → `  if (ctx.slots !== null) ctx.commands.register('jump', () => {` | `test/enhance-jump.test.ts`: 1 failed \| 55 passed (56) |
| B6d | progress without the bar | `src/enhance/scroll.ts` | `    if (slots !== null \|\| reportsProgress) {` → `    if (slots !== null) {` | `test/enhance-scroll.test.ts`: 1 failed \| 38 passed (39) |
| B6e | report on change only | `src/enhance/scroll.ts` | `      if (w !== width) { ⏎         width = w; ⏎         if (slots !== null)` → `      if (w !== width \|\| reportsProgress) { ⏎         width = w; ⏎         if (slots !== null)` | `test/enhance-scroll.test.ts`: 1 failed \| 38 passed (39) |
| B6f | unknown name | `src/enhance/commands.ts` | `typeof name !== 'string' \|\| !known(name)) return false; ⏎       const run = handlers.get(nam` → `typeof name !== 'string') return false; ⏎       const run = handlers.get(known(name) ? name ` | `test/enhance-settings.test.ts` (+1): 1 failed \| 87 passed (88) |
| B6g | seed key | `src/frame/seed.ts` | `chrome: Object.freeze(['bar', 'rail', 'settings', 'topSpace'] as const),` → `chrome: Object.freeze(['bar', 'rail', 'settings'] as const),` | `test/frame-seed.test.ts`: 2 failed \| 156 passed (158) |
| B6i | topSpace class | `src/enhance/lifecycle.ts` | `  if (!options.chrome.topSpace) journal.toggleClass(root, 'no-top-space', true);` → `(removed)` | `test/enhance-options.test.ts`: 1 failed \| 157 passed (158) |
| B6j | outline command | `src/enhance/plans.ts` | `  ctx.commands.register('outline', () => { ⏎     setOutline(!outlined); ⏎   }); ⏎ ` → `(removed)` | `test/enhance-plans.test.ts`: 1 failed \| 40 passed (41) |
| B6k | settings toggle, not open | `src/enhance/settings.ts` | `  ctx.commands.register('settings', () => { ⏎     if (menu.hidden) show(); ⏎     else close();` → `  ctx.commands.register('settings', () => { ⏎     show(); ⏎   });` | `test/enhance-settings.test.ts`: 1 failed \| 31 passed (32) |
| B6l | onProgress is a host callback of the options | `src/enhance/options.ts` | `    onProgress: callback('onProgress', fields['onProgress'], options),` → `    onProgress: null,` | `test/enhance-scroll.test.ts` (+1): 7 failed \| 190 passed (197) |
| B6m | the registry runs a command only while live (the run's live check dropped) | `src/enhance/commands.ts` | `      if (!live() \|\| typeof name` → `      if (typeof name` | `test/enhance-settings.test.ts`: 1 failed \| 32 passed (33) |
| B6n | no Aa in the tray when the bar exists (Aa always on the root) | `src/enhance/settings.ts` | `  if (ctx.slots !== null) ctx.slots.tool('settings', wrap); ⏎   else ctx.journal.insert` → `  ctx.journal.insert` | `test/enhance-settings.test.ts`: 1 failed \| 31 passed (32) |
| B6o | the registry drops a registration made while not live (the register's live check dropped) | `src/enhance/commands.ts` | `      if (!live()) return () => undefined; ⏎       handlers.set` → `      handlers.set` | `test/enhance-settings.test.ts`: 1 failed \| 32 passed (33) |
| B6p | an unknown name is refused by the registry (the known() check dropped from run, no fallback handler) | `src/enhance/commands.ts` | `typeof name !== 'string' \|\| !known(name)) return false;` → `typeof name !== 'string') return false;` | `test/enhance-settings.test.ts`: 33 passed (33) (stays green) |
| B6h | `--bar-h` rule | `scripts/build-frame.mjs` | the prelude rule deleted (a rebuild row) | measured in Task 8 |

```json
{
  "generatedOutputs": {
    "assets/assets.json": "9c456ba32130184053d6060e24a14b6b2e8bb1b71f8f791cd84311bb3e768107",
    "src/frame/manifest.generated.ts": "32b20a2bfb1c0cd37330e64777921631f33d4fc6340b142e78db4ddc42c31076",
    "assets/frame/bootstrap.js": "2792621f7d625f289f6caf5e7b8c6dce96a0b50c110d00d52c75dbda0b727db3",
    "assets/frame/enhance.js": "7b23628446e3a96d99ec9e691c499ca3b24cc2c342c434e10935aa0ed9059027",
    "assets/frame/guard.js": "ff3c25da5703bc06d40ca0412b2e760c619a73a4153306f4d0f3b662bda65c4d",
    "assets/frame/reader.css": "2a897678d74de4a3723e85fcc321857b5ec102bb189b9f6e7bc89eb65d3e2524"
  },
  "rows": [
    {
      "id": "B6a",
      "guard": "Aa without the bar",
      "edits": [
        {
          "file": "src/enhance/settings.ts",
          "old": "  if (!ctx.options.chrome.settings) return;",
          "new": "  if (!ctx.options.chrome.settings || ctx.slots === null) return;"
        }
      ],
      "tests": [
        "test/enhance-settings.test.ts"
      ],
      "rc": 1,
      "red": "2 failed | 30 passed (32)",
      "failing": [
        "B6.1: with the bar off, Aa is built on the root, and the settings command opens then closes it; Escape closes ",
        "B6.3: chrome.settings false answers false and builds nothing; an unknown name or root answers false"
      ],
      "verdict": "red",
      "sha256": {
        "src/enhance/settings.ts": "7db5324cae88fc4ddec128e2edaeb19fcb251c7d814eb901c0b68d41be970ea5"
      },
      "sha256After": {
        "src/enhance/settings.ts": "7db5324cae88fc4ddec128e2edaeb19fcb251c7d814eb901c0b68d41be970ea5"
      },
      "restored": true,
      "generatedOutputsUnchanged": true,
      "checkAfterRestore": 0
    },
    {
      "id": "B6b",
      "guard": "toggle, not open",
      "edits": [
        {
          "file": "src/enhance/rail.ts",
          "old": "  ctx.commands.register('contents', () => {\n    if (drawerOpen) close();\n    else open();\n  });",
          "new": "  ctx.commands.register('contents', () => {\n    open();\n  });"
        }
      ],
      "tests": [
        "test/enhance-rail.test.ts"
      ],
      "rc": 1,
      "red": "1 failed | 18 passed (19)",
      "failing": [
        "B6.2: with the bar off, the contents command toggles the drawer; Escape closes it"
      ],
      "verdict": "red",
      "sha256": {
        "src/enhance/rail.ts": "5013739678747f8b6949a5970d1631a6d9e77382d2438a1f8cd3ca65975f114b"
      },
      "sha256After": {
        "src/enhance/rail.ts": "5013739678747f8b6949a5970d1631a6d9e77382d2438a1f8cd3ca65975f114b"
      },
      "restored": true,
      "generatedOutputsUnchanged": true,
      "checkAfterRestore": 0
    },
    {
      "id": "B6c",
      "guard": "jump reachable",
      "edits": [
        {
          "file": "src/enhance/jump.ts",
          "old": "  ctx.commands.register('jump', () => {",
          "new": "  if (ctx.slots !== null) ctx.commands.register('jump', () => {"
        }
      ],
      "tests": [
        "test/enhance-jump.test.ts"
      ],
      "rc": 1,
      "red": "1 failed | 55 passed (56)",
      "failing": [
        "B6.2: with the bar off, the jump command opens then closes the dialog, and Escape closes it"
      ],
      "verdict": "red",
      "sha256": {
        "src/enhance/jump.ts": "37b7ec55911e388574c3a8588a7036d53c09d88af03243d2ecedc0a07e00af7c"
      },
      "sha256After": {
        "src/enhance/jump.ts": "37b7ec55911e388574c3a8588a7036d53c09d88af03243d2ecedc0a07e00af7c"
      },
      "restored": true,
      "generatedOutputsUnchanged": true,
      "checkAfterRestore": 0
    },
    {
      "id": "B6d",
      "guard": "progress without the bar",
      "edits": [
        {
          "file": "src/enhance/scroll.ts",
          "old": "    if (slots !== null || reportsProgress) {",
          "new": "    if (slots !== null) {"
        }
      ],
      "tests": [
        "test/enhance-scroll.test.ts"
      ],
      "rc": 1,
      "red": "1 failed | 38 passed (39)",
      "failing": [
        "with the bar off and onProgress given, scrolling reports the share once per change"
      ],
      "verdict": "red",
      "sha256": {
        "src/enhance/scroll.ts": "23faa39683d213601d561cc1abf2aefb11a0ac8f84664a945c59f75fd3d4e87b"
      },
      "sha256After": {
        "src/enhance/scroll.ts": "23faa39683d213601d561cc1abf2aefb11a0ac8f84664a945c59f75fd3d4e87b"
      },
      "restored": true,
      "generatedOutputsUnchanged": true,
      "checkAfterRestore": 0
    },
    {
      "id": "B6e",
      "guard": "report on change only",
      "edits": [
        {
          "file": "src/enhance/scroll.ts",
          "old": "      if (w !== width) {\n        width = w;\n        if (slots !== null)",
          "new": "      if (w !== width || reportsProgress) {\n        width = w;\n        if (slots !== null)"
        }
      ],
      "tests": [
        "test/enhance-scroll.test.ts"
      ],
      "rc": 1,
      "red": "1 failed | 38 passed (39)",
      "failing": [
        "with the bar off and onProgress given, scrolling reports the share once per change"
      ],
      "verdict": "red",
      "sha256": {
        "src/enhance/scroll.ts": "23faa39683d213601d561cc1abf2aefb11a0ac8f84664a945c59f75fd3d4e87b"
      },
      "sha256After": {
        "src/enhance/scroll.ts": "23faa39683d213601d561cc1abf2aefb11a0ac8f84664a945c59f75fd3d4e87b"
      },
      "restored": true,
      "generatedOutputsUnchanged": true,
      "checkAfterRestore": 0
    },
    {
      "id": "B6f",
      "guard": "unknown name",
      "edits": [
        {
          "file": "src/enhance/commands.ts",
          "old": "typeof name !== 'string' || !known(name)) return false;\n      const run = handlers.get(name);",
          "new": "typeof name !== 'string') return false;\n      const run = handlers.get(known(name) ? name : 'jump');"
        }
      ],
      "tests": [
        "test/enhance-settings.test.ts",
        "test/enhance-jump.test.ts"
      ],
      "rc": 1,
      "red": "1 failed | 87 passed (88)",
      "failing": [
        "B6.3: chrome.settings false answers false and builds nothing; an unknown name or root answers false"
      ],
      "verdict": "red",
      "sha256": {
        "src/enhance/commands.ts": "5fd26e0e3200b6f7603dcecc28e67221ee234d71bbdae26df628e0ad009ab727"
      },
      "sha256After": {
        "src/enhance/commands.ts": "5fd26e0e3200b6f7603dcecc28e67221ee234d71bbdae26df628e0ad009ab727"
      },
      "restored": true,
      "generatedOutputsUnchanged": true,
      "checkAfterRestore": 0
    },
    {
      "id": "B6g",
      "guard": "seed key",
      "edits": [
        {
          "file": "src/frame/seed.ts",
          "old": "chrome: Object.freeze(['bar', 'rail', 'settings', 'topSpace'] as const),",
          "new": "chrome: Object.freeze(['bar', 'rail', 'settings'] as const),"
        }
      ],
      "tests": [
        "test/frame-seed.test.ts"
      ],
      "rc": 1,
      "red": "2 failed | 156 passed (158)",
      "failing": [
        "FEATURE_KEYS equals the key lists L2's normalizeOptions reads (options.ts)",
        "features.chrome.topSpace is accepted by the seed and by L2's normalizeOptions"
      ],
      "verdict": "red",
      "sha256": {
        "src/frame/seed.ts": "4f0d2b408e9b358dd7a14732c2c2598813cd138bb161329035c28440a2480bde"
      },
      "sha256After": {
        "src/frame/seed.ts": "4f0d2b408e9b358dd7a14732c2c2598813cd138bb161329035c28440a2480bde"
      },
      "restored": true,
      "generatedOutputsUnchanged": true,
      "checkAfterRestore": 0
    },
    {
      "id": "B6i",
      "guard": "topSpace class",
      "edits": [
        {
          "file": "src/enhance/lifecycle.ts",
          "old": "  if (!options.chrome.topSpace) journal.toggleClass(root, 'no-top-space', true);",
          "new": ""
        }
      ],
      "tests": [
        "test/enhance-options.test.ts"
      ],
      "rc": 1,
      "red": "1 failed | 157 passed (158)",
      "failing": [
        "chrome.topSpace false puts a root class; true leaves the root as it was"
      ],
      "verdict": "red",
      "sha256": {
        "src/enhance/lifecycle.ts": "08ff87ea48075532cb5175caf835fbb6a000161ac23d2ccffb85d3cfd64aa7a6"
      },
      "sha256After": {
        "src/enhance/lifecycle.ts": "08ff87ea48075532cb5175caf835fbb6a000161ac23d2ccffb85d3cfd64aa7a6"
      },
      "restored": true,
      "generatedOutputsUnchanged": true,
      "checkAfterRestore": 0
    },
    {
      "id": "B6j",
      "guard": "outline command",
      "edits": [
        {
          "file": "src/enhance/plans.ts",
          "old": "  ctx.commands.register('outline', () => {\n    setOutline(!outlined);\n  });\n",
          "new": ""
        }
      ],
      "tests": [
        "test/enhance-plans.test.ts"
      ],
      "rc": 1,
      "red": "1 failed | 40 passed (41)",
      "failing": [
        "B6.2: the outline command toggles a plan's Outline with the bar off"
      ],
      "verdict": "red",
      "sha256": {
        "src/enhance/plans.ts": "9a05fafe7d9c9544a91b85df9a751da502f3924f6a0fc1a38e86d943d8d482a4"
      },
      "sha256After": {
        "src/enhance/plans.ts": "9a05fafe7d9c9544a91b85df9a751da502f3924f6a0fc1a38e86d943d8d482a4"
      },
      "restored": true,
      "generatedOutputsUnchanged": true,
      "checkAfterRestore": 0
    },
    {
      "id": "B6k",
      "guard": "settings toggle, not open",
      "edits": [
        {
          "file": "src/enhance/settings.ts",
          "old": "  ctx.commands.register('settings', () => {\n    if (menu.hidden) show();\n    else close();\n  });",
          "new": "  ctx.commands.register('settings', () => {\n    show();\n  });"
        }
      ],
      "tests": [
        "test/enhance-settings.test.ts"
      ],
      "rc": 1,
      "red": "1 failed | 31 passed (32)",
      "failing": [
        "B6.1: with the bar off, Aa is built on the root, and the settings command opens then closes it; Escape closes "
      ],
      "verdict": "red",
      "sha256": {
        "src/enhance/settings.ts": "7db5324cae88fc4ddec128e2edaeb19fcb251c7d814eb901c0b68d41be970ea5"
      },
      "sha256After": {
        "src/enhance/settings.ts": "7db5324cae88fc4ddec128e2edaeb19fcb251c7d814eb901c0b68d41be970ea5"
      },
      "restored": true,
      "generatedOutputsUnchanged": true,
      "checkAfterRestore": 0
    },
    {
      "id": "B6l",
      "guard": "onProgress is a host callback of the options",
      "edits": [
        {
          "file": "src/enhance/options.ts",
          "old": "    onProgress: callback('onProgress', fields['onProgress'], options),",
          "new": "    onProgress: null,"
        }
      ],
      "tests": [
        "test/enhance-scroll.test.ts",
        "test/enhance-options.test.ts"
      ],
      "rc": 1,
      "red": "7 failed | 190 passed (197)",
      "failing": [
        "onProgress a string",
        "onProgress null",
        "through enhance(), every one rejects invalid-options and the root is untouched",
        "neither normalizeOptions nor the whole startup touches a function option, mermaid.load included",
        "chrome.topSpace defaults to true, takes false, and onProgress is kept as a host callback",
        "with the bar off and onProgress given, scrolling reports the share once per change",
        "with the bar on, the same share is reported and the bar line draws it"
      ],
      "verdict": "red",
      "sha256": {
        "src/enhance/options.ts": "feafff7f8fd0de945e550ac88faa804125a95086094d9361edc8c6210ef90eba"
      },
      "sha256After": {
        "src/enhance/options.ts": "feafff7f8fd0de945e550ac88faa804125a95086094d9361edc8c6210ef90eba"
      },
      "restored": true,
      "generatedOutputsUnchanged": true,
      "checkAfterRestore": 0
    },
    {
      "id": "B6m",
      "guard": "the registry runs a command only while live (the run's live check dropped)",
      "edits": [
        {
          "file": "src/enhance/commands.ts",
          "old": "      if (!live() || typeof name",
          "new": "      if (typeof name"
        }
      ],
      "tests": [
        "test/enhance-settings.test.ts"
      ],
      "rc": 1,
      "red": "1 failed | 32 passed (33)",
      "failing": [
        "names four commands, runs a registered one only while live, and answers false otherwise"
      ],
      "verdict": "red",
      "sha256": {
        "src/enhance/commands.ts": "5fd26e0e3200b6f7603dcecc28e67221ee234d71bbdae26df628e0ad009ab727"
      },
      "sha256After": {
        "src/enhance/commands.ts": "5fd26e0e3200b6f7603dcecc28e67221ee234d71bbdae26df628e0ad009ab727"
      },
      "restored": true,
      "generatedOutputsUnchanged": true,
      "checkAfterRestore": 0
    },
    {
      "id": "B6n",
      "guard": "no Aa in the tray when the bar exists (Aa always on the root)",
      "edits": [
        {
          "file": "src/enhance/settings.ts",
          "old": "  if (ctx.slots !== null) ctx.slots.tool('settings', wrap);\n  else ctx.journal.insert",
          "new": "  ctx.journal.insert"
        }
      ],
      "tests": [
        "test/enhance-settings.test.ts"
      ],
      "rc": 1,
      "red": "1 failed | 31 passed (32)",
      "failing": [
        "with the bar on, the same command works and Aa stays in the bar tray"
      ],
      "verdict": "red",
      "sha256": {
        "src/enhance/settings.ts": "7db5324cae88fc4ddec128e2edaeb19fcb251c7d814eb901c0b68d41be970ea5"
      },
      "sha256After": {
        "src/enhance/settings.ts": "7db5324cae88fc4ddec128e2edaeb19fcb251c7d814eb901c0b68d41be970ea5"
      },
      "restored": true,
      "generatedOutputsUnchanged": true,
      "checkAfterRestore": 0
    },
    {
      "id": "B6o",
      "guard": "the registry drops a registration made while not live (the register's live check dropped)",
      "edits": [
        {
          "file": "src/enhance/commands.ts",
          "old": "      if (!live()) return () => undefined;\n      handlers.set",
          "new": "      handlers.set"
        }
      ],
      "tests": [
        "test/enhance-settings.test.ts"
      ],
      "rc": 1,
      "red": "1 failed | 32 passed (33)",
      "failing": [
        "names four commands, runs a registered one only while live, and answers false otherwise"
      ],
      "verdict": "red",
      "sha256": {
        "src/enhance/commands.ts": "5fd26e0e3200b6f7603dcecc28e67221ee234d71bbdae26df628e0ad009ab727"
      },
      "sha256After": {
        "src/enhance/commands.ts": "5fd26e0e3200b6f7603dcecc28e67221ee234d71bbdae26df628e0ad009ab727"
      },
      "restored": true,
      "generatedOutputsUnchanged": true,
      "checkAfterRestore": 0
    },
    {
      "id": "B6p",
      "guard": "an unknown name is refused by the registry (the known() check dropped from run, no fallback handler)",
      "edits": [
        {
          "file": "src/enhance/commands.ts",
          "old": "typeof name !== 'string' || !known(name)) return false;",
          "new": "typeof name !== 'string') return false;"
        }
      ],
      "tests": [
        "test/enhance-settings.test.ts"
      ],
      "rc": 0,
      "red": "33 passed (33)",
      "failing": [],
      "verdict": "green (equivalent mutant)",
      "sha256": {
        "src/enhance/commands.ts": "5fd26e0e3200b6f7603dcecc28e67221ee234d71bbdae26df628e0ad009ab727"
      },
      "sha256After": {
        "src/enhance/commands.ts": "5fd26e0e3200b6f7603dcecc28e67221ee234d71bbdae26df628e0ad009ab727"
      },
      "restored": true,
      "generatedOutputsUnchanged": true,
      "checkAfterRestore": 0
    }
  ],
  "measuredElsewhere": {
    "B6h": "measured in Task 8"
  }
}
```
