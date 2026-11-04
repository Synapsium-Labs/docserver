# Batch Task 6: mutation rows (the tools without the bar, commands, progress, `--bar-h`, `topSpace`)

Step 1 of the task wrote the tests before the code, but the first bounded run queued behind other work for many minutes, and the source edits were made while it waited, so there is no separate run of the new tests against the old code. The red of each guard is shown by its row below instead: the row removes that guard (or takes the guard's opposite) and the named tests go red through assertions.

## Method

Each row was measured in place on branch `ws/docserver-release-1-1`, one at a time, by a driver. The first round was three driver runs, not one: B6a to B6l and B6n in the first (B6m was green there), B6m again after a registry case was added (B6o green there), and B6m, B6o and B6p in the third after a second fix of that case; the logs of each run are kept in the session's scratch directory. For each row: the bytes of every edited file and of every generated output (`assets/assets.json`, `src/frame/manifest.generated.ts`, `assets/frame/*`) were saved and hashed; the edit was applied; the named tests ran in a bounded run (`timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 <files>`, with `ulimit -u` set to the measured thread count plus 1500); the edited files were restored from the saved bytes (byte copy) and their sha256 checked against the saved one; the generated outputs were hashed again (a row edits sources but never rebuilds, so they must be unchanged) and `node scripts/build-frame.mjs --check` ran after each restore. A row is red only through test assertions (no compile or import failure).

Row B6h (the prelude rule `[data-docreader-root][data-docreader-root]:not(:has(> .topbar)){--bar-h:0px}` deleted from `scripts/build-frame.mjs`) is measured in Task 8: its red is a browser row there.

Rows B6a to B6g are the brief's. B6i to B6p are this task's own: B6i (`topSpace` class), B6j (outline command), B6k (settings toggles), B6l (`onProgress` is read from the options), B6m and B6o (the registry's two live checks, red through the direct registry test), B6n (Aa in the tray when the bar exists), B6p (below).

## Verdicts

Every row is red through assertions except:

- B6m and B6o were first measured green (their new case, the direct registry test, did not yet exist for B6m, and for B6o its first form built the "dead" registry with a live check that never turned true), and each got a case before being measured red, as the rule says. B6a, B6f, B6k and B6n were measured against the 32-case settings file; the later case is additive, so their verdicts stand.
- B6p stays green: an equivalent mutant (ledger C108): Map.get does no prototype lookup and register throws for an unknown name; the check stays for type narrowing (`handlers.get(name: string)` on a `Map<CommandName, ...>` fails the typecheck without it). The registry's `known()` check in `run` only guards a lookup in a map whose keys are all known names (`register` throws for any other), so a name that is not known finds no handler and answers false either way. B6f is the guard that matters (an unknown name must not reach any handler), and it is red.

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

## Fix round 1 (ledger C108): rows B6q to B6ai

Measured the same way, on the tree of the fix-round commit, against the new cases (every row measured again after the last source edit of the round; a draft of row B6u, the keydown clear of the settings flag, was dropped with the listener, because the services case that counts one keydown listener per document went red on it). B6aa was first measured green: its first cases (a later spy event, a running-head write) saw nothing, because the events and the journal already refuse writes once the instance is not live. It got a case that counts heading rect reads after the destroy (red), and was measured again. B6ac, B6ad and B6ae stay green and are recorded as possible equivalent mutants (reasons below); B6ab, the phase guard that matters (a command called from inside a feature build), is red. B6p keeps the ruling of the first round (ledger C108).

| Row | Guard | File | Change | Red |
|---|---|---|---|---|
| B6q | topSpace trims only a root with no bar (CSS scope) | `assets/reader.css` | `.no-top-space:not(:has(> .topbar)) { padding-top: 8px; }` → `.no-top-space { padding-top: 8px; }` | `test/enhance-options.test.ts`: 1 failed \| 158 passed (159) |
| B6r | the same gesture's command leaves a menu closed by an outside press closed | `src/enhance/settings.ts` | `    if (closedByOutside) {` → `    if (false as boolean) {` | `test/enhance-settings.test.ts`: 1 failed \| 38 passed (39) |
| B6s | focus leaving the document does not close the menu | `src/enhance/settings.ts` | `    if (to === null && !doc.hasFocus()) return; ⏎ ` → `(removed)` | `test/enhance-settings.test.ts`: 1 failed \| 38 passed (39) |
| B6t | the flag is cleared after the gesture's click | `src/enhance/settings.ts` | `ctx.journal.listen(doc, 'click', () => { ⏎     closedByOutside = false;` → `ctx.journal.listen(doc, 'click', () => { ⏎     void 0;` | `test/enhance-settings.test.ts`: 1 failed \| 38 passed (39) |
| B6v | settings does not open over another overlay | `src/enhance/settings.ts` | `    if (ctx.overlays.any()) return false; ⏎     show();` → `    show();` | `test/enhance-settings.test.ts`: 1 failed \| 38 passed (39) |
| B6w | jump does not open over another overlay | `src/enhance/jump.ts` | `    if (ctx.overlays.any()) return false; ⏎     openJump();` → `    openJump();` | `test/enhance-jump.test.ts`: 1 failed \| 56 passed (57) |
| B6x | contents answers false where the rail is shown | `src/enhance/rail.ts` | `ctx.env.viewport().w >= RAIL_MIN_WIDTH \|\| ctx.overlays.any()` → `ctx.overlays.any()` | `test/enhance-rail.test.ts`: 1 failed \| 19 passed (20) |
| B6x2 | contents does not open over another overlay | `src/enhance/rail.ts` | `ctx.env.viewport().w >= RAIL_MIN_WIDTH \|\| ctx.overlays.any()` → `ctx.env.viewport().w >= RAIL_MIN_WIDTH` | `test/enhance-settings.test.ts`: 1 failed \| 38 passed (39) |
| B6y | a stored outline is applied with the bar and the keyboard off | `src/enhance/plans.ts` | `  // (The outline command is registered above` → `  if (ctx.slots === null && !ctx.options.keyboard) return; ⏎   // (The outline command is re` | `test/enhance-plans.test.ts`: 1 failed \| 41 passed (42) |
| B6z | the frame's api carries runEnhancementCommand | `src/frame-runtime/enhance-entry.ts` | `goToHash, runEnhancementCommand })` → `goToHash })` | `test/enhance-frame-wire.test.ts`: 1 failed \| 4 passed (5) |
| B6aa | no write or event after onProgress destroyed the instance | `src/enhance/scroll.ts` | `          ctx.host.onProgress(Math.round(share * 1000) / 100000); ⏎           if (!ctx.live(` → `          ctx.host.onProgress(Math.round(share * 1000) / 100000);` | `test/enhance-scroll.test.ts`: 1 failed \| 41 passed (42) |
| B6ab | a command during startup answers false (the phase guard) | `src/enhance/lifecycle.ts` | `inst.phase !== 'active' \|\| ctx === null) return false; ⏎   return operate` → `ctx === null) return false; ⏎   return operate` | `test/enhance-plans.test.ts`: 1 failed \| 41 passed (42) |
| B6ac | a root that is no element (isElement guard) | `src/enhance/lifecycle.ts` | `if (!isElement(root) \|\| typeof name !== 'string') return false;` → `if (typeof name !== 'string') return false;` | `test/enhance-settings.test.ts`: 39 passed (39) (stays green, possible equivalent mutant: equivalent: WeakMap.get of a non-object answers undefined, so findByRoot answers undefined and the call is false either way) |
| B6ad | a name that is no string (lifecycle guard) | `src/enhance/lifecycle.ts` | `if (!isElement(root) \|\| typeof name !== 'string') return false;` → `if (!isElement(root)) return false;` | `test/enhance-settings.test.ts`: 39 passed (39) (stays green, possible equivalent mutant: equivalent: the registry's own `typeof name` check in run() answers false for a non-string either way) |
| B6ae | a destroyed or destroying root (ctx and operate guards) | `src/enhance/lifecycle.ts` | `  return operate(inst, () => ctx.commands.run(name)) === true;` → `  return ctx.commands.run(name);` | `test/enhance-settings.test.ts`: 39 passed (39) (stays green, possible equivalent mutant: equivalent: a destroying or destroyed instance is not live, so the registry's live() check in run() answers false either way; operate() is a second guard of the same fact) |
| B6af | progress computed only with the bar or onProgress | `src/enhance/scroll.ts` | `    if (slots !== null \|\| reportsProgress) {` → `    if (true as boolean) {` | `test/enhance-scroll.test.ts`: 2 failed \| 40 passed (42) |
| B6ag | no contents command with chrome.rail false | `src/enhance/rail.ts` | `if (!ctx.info.isDocument \|\| !ctx.options.chrome.rail) return;` → `if (!ctx.info.isDocument) return;` | `test/enhance-rail.test.ts`: 1 failed \| 19 passed (20) |
| B6ah | no outline command on a document that is no plan | `src/enhance/plans.ts` | `  if (!outlineable) return; ⏎ ` → `  if (!outlineable) { ⏎     ctx.commands.register('outline', () => undefined); ⏎     return; ⏎  ` | `test/enhance-plans.test.ts`: 1 failed \| 41 passed (42) |
| B6ai | no jump command on a document with too few entries | `src/enhance/jump.ts` | `  if (entries.length <= MIN_ENTRIES) return;` → `  if (entries.length <= MIN_ENTRIES) { ⏎     ctx.commands.register('jump', () => true); ⏎     ` | `test/enhance-jump.test.ts`: 1 failed \| 56 passed (57) |

```json
{
  "generatedOutputs": {
    "assets/assets.json": "34d64fa574978d3d0a0ad86287aedc2462fa69ad07cf74c403b70e34b5dbee95",
    "src/frame/manifest.generated.ts": "06fd3c79d86079da8a16305625cbb0f05adada2985f626a4c47d283f68f36369",
    "assets/frame/bootstrap.js": "2792621f7d625f289f6caf5e7b8c6dce96a0b50c110d00d52c75dbda0b727db3",
    "assets/frame/enhance.js": "4b7aebf65dfd81d440a3f441353b23e393ce1e1ac3dde80af90cbfc7323452a7",
    "assets/frame/guard.js": "ff3c25da5703bc06d40ca0412b2e760c619a73a4153306f4d0f3b662bda65c4d",
    "assets/frame/reader.css": "83176e0055183256fdd131a602f847a16a17a8944812071672550e64c8dc9e9f"
  },
  "rows": [
    {
      "id": "B6q",
      "guard": "topSpace trims only a root with no bar (CSS scope)",
      "edits": [
        {
          "file": "assets/reader.css",
          "old": ".no-top-space:not(:has(> .topbar)) { padding-top: 8px; }",
          "new": ".no-top-space { padding-top: 8px; }"
        }
      ],
      "tests": [
        "test/enhance-options.test.ts"
      ],
      "rc": 1,
      "red": "1 failed | 158 passed (159)",
      "failing": [
        "with the bar on and topSpace false the root has its bar and the class; the stylesheet trims only a root with n"
      ],
      "verdict": "red",
      "sha256": {
        "assets/reader.css": "505092a2299c6824834a3289d23d829a529bacfaefa5328d7e7daf3232dda5c0"
      },
      "sha256After": {
        "assets/reader.css": "505092a2299c6824834a3289d23d829a529bacfaefa5328d7e7daf3232dda5c0"
      },
      "restored": true,
      "generatedOutputsUnchanged": true,
      "checkAfterRestore": 0
    },
    {
      "id": "B6r",
      "guard": "the same gesture's command leaves a menu closed by an outside press closed",
      "edits": [
        {
          "file": "src/enhance/settings.ts",
          "old": "    if (closedByOutside) {",
          "new": "    if (false as boolean) {"
        }
      ],
      "tests": [
        "test/enhance-settings.test.ts"
      ],
      "rc": 1,
      "red": "1 failed | 38 passed (39)",
      "failing": [
        "a button outside the root: the first press opens, the second closes, a third opens again"
      ],
      "verdict": "red",
      "sha256": {
        "src/enhance/settings.ts": "60934831686e0e4663b5820ce5c2dc9976ee8d5c0a7bca434f38de7ecc2e924e"
      },
      "sha256After": {
        "src/enhance/settings.ts": "60934831686e0e4663b5820ce5c2dc9976ee8d5c0a7bca434f38de7ecc2e924e"
      },
      "restored": true,
      "generatedOutputsUnchanged": true,
      "checkAfterRestore": 0
    },
    {
      "id": "B6s",
      "guard": "focus leaving the document does not close the menu",
      "edits": [
        {
          "file": "src/enhance/settings.ts",
          "old": "    if (to === null && !doc.hasFocus()) return;\n",
          "new": ""
        }
      ],
      "tests": [
        "test/enhance-settings.test.ts"
      ],
      "rc": 1,
      "red": "1 failed | 38 passed (39)",
      "failing": [
        "focus leaving the document (a focusout naming no element while the document has lost focus) keeps the menu ope"
      ],
      "verdict": "red",
      "sha256": {
        "src/enhance/settings.ts": "60934831686e0e4663b5820ce5c2dc9976ee8d5c0a7bca434f38de7ecc2e924e"
      },
      "sha256After": {
        "src/enhance/settings.ts": "60934831686e0e4663b5820ce5c2dc9976ee8d5c0a7bca434f38de7ecc2e924e"
      },
      "restored": true,
      "generatedOutputsUnchanged": true,
      "checkAfterRestore": 0
    },
    {
      "id": "B6t",
      "guard": "the flag is cleared after the gesture's click",
      "edits": [
        {
          "file": "src/enhance/settings.ts",
          "old": "ctx.journal.listen(doc, 'click', () => {\n    closedByOutside = false;",
          "new": "ctx.journal.listen(doc, 'click', () => {\n    void 0;"
        }
      ],
      "tests": [
        "test/enhance-settings.test.ts"
      ],
      "rc": 1,
      "red": "1 failed | 38 passed (39)",
      "failing": [
        "the swallowed half does not outlive its gesture: a later command opens it"
      ],
      "verdict": "red",
      "sha256": {
        "src/enhance/settings.ts": "60934831686e0e4663b5820ce5c2dc9976ee8d5c0a7bca434f38de7ecc2e924e"
      },
      "sha256After": {
        "src/enhance/settings.ts": "60934831686e0e4663b5820ce5c2dc9976ee8d5c0a7bca434f38de7ecc2e924e"
      },
      "restored": true,
      "generatedOutputsUnchanged": true,
      "checkAfterRestore": 0
    },
    {
      "id": "B6v",
      "guard": "settings does not open over another overlay",
      "edits": [
        {
          "file": "src/enhance/settings.ts",
          "old": "    if (ctx.overlays.any()) return false;\n    show();",
          "new": "    show();"
        }
      ],
      "tests": [
        "test/enhance-settings.test.ts"
      ],
      "rc": 1,
      "red": "1 failed | 38 passed (39)",
      "failing": [
        "settings answers false and changes nothing while the drawer is open; closing its own still works"
      ],
      "verdict": "red",
      "sha256": {
        "src/enhance/settings.ts": "60934831686e0e4663b5820ce5c2dc9976ee8d5c0a7bca434f38de7ecc2e924e"
      },
      "sha256After": {
        "src/enhance/settings.ts": "60934831686e0e4663b5820ce5c2dc9976ee8d5c0a7bca434f38de7ecc2e924e"
      },
      "restored": true,
      "generatedOutputsUnchanged": true,
      "checkAfterRestore": 0
    },
    {
      "id": "B6w",
      "guard": "jump does not open over another overlay",
      "edits": [
        {
          "file": "src/enhance/jump.ts",
          "old": "    if (ctx.overlays.any()) return false;\n    openJump();",
          "new": "    openJump();"
        }
      ],
      "tests": [
        "test/enhance-jump.test.ts"
      ],
      "rc": 1,
      "red": "1 failed | 56 passed (57)",
      "failing": [
        "T6-d: the jump command answers false and changes nothing while another dialog is open"
      ],
      "verdict": "red",
      "sha256": {
        "src/enhance/jump.ts": "280b630bb83c2561ac2c74a5ad38adbf475c99574adea8832b1d64260fdcd908"
      },
      "sha256After": {
        "src/enhance/jump.ts": "280b630bb83c2561ac2c74a5ad38adbf475c99574adea8832b1d64260fdcd908"
      },
      "restored": true,
      "generatedOutputsUnchanged": true,
      "checkAfterRestore": 0
    },
    {
      "id": "B6x",
      "guard": "contents answers false where the rail is shown",
      "edits": [
        {
          "file": "src/enhance/rail.ts",
          "old": "ctx.env.viewport().w >= RAIL_MIN_WIDTH || ctx.overlays.any()",
          "new": "ctx.overlays.any()"
        }
      ],
      "tests": [
        "test/enhance-rail.test.ts"
      ],
      "rc": 1,
      "red": "1 failed | 19 passed (20)",
      "failing": [
        "T6-e: where the rail is shown (1240 px or more) there is no drawer: the command answers false and changes noth"
      ],
      "verdict": "red",
      "sha256": {
        "src/enhance/rail.ts": "b174209d1564bafe5201ca194b55330b5e36d031bfb895548644561e39bac619"
      },
      "sha256After": {
        "src/enhance/rail.ts": "b174209d1564bafe5201ca194b55330b5e36d031bfb895548644561e39bac619"
      },
      "restored": true,
      "generatedOutputsUnchanged": true,
      "checkAfterRestore": 0
    },
    {
      "id": "B6x2",
      "guard": "contents does not open over another overlay",
      "edits": [
        {
          "file": "src/enhance/rail.ts",
          "old": "ctx.env.viewport().w >= RAIL_MIN_WIDTH || ctx.overlays.any()",
          "new": "ctx.env.viewport().w >= RAIL_MIN_WIDTH"
        }
      ],
      "tests": [
        "test/enhance-settings.test.ts"
      ],
      "rc": 1,
      "red": "1 failed | 38 passed (39)",
      "failing": [
        "settings answers false and changes nothing while the drawer is open; closing its own still works"
      ],
      "verdict": "red",
      "sha256": {
        "src/enhance/rail.ts": "b174209d1564bafe5201ca194b55330b5e36d031bfb895548644561e39bac619"
      },
      "sha256After": {
        "src/enhance/rail.ts": "b174209d1564bafe5201ca194b55330b5e36d031bfb895548644561e39bac619"
      },
      "restored": true,
      "generatedOutputsUnchanged": true,
      "checkAfterRestore": 0
    },
    {
      "id": "B6y",
      "guard": "a stored outline is applied with the bar and the keyboard off",
      "edits": [
        {
          "file": "src/enhance/plans.ts",
          "old": "  // (The outline command is registered above",
          "new": "  if (ctx.slots === null && !ctx.options.keyboard) return;\n  // (The outline command is registered above"
        }
      ],
      "tests": [
        "test/enhance-plans.test.ts"
      ],
      "rc": 1,
      "red": "1 failed | 41 passed (42)",
      "failing": [
        "a stored outline is applied whatever the bar and the keyboard are: the outline command can always leave it (T6"
      ],
      "verdict": "red",
      "sha256": {
        "src/enhance/plans.ts": "47de9edb6a99316635c1e96a16bdb95e42f01b5eab3a5eeca228c2698ef8f8d6"
      },
      "sha256After": {
        "src/enhance/plans.ts": "47de9edb6a99316635c1e96a16bdb95e42f01b5eab3a5eeca228c2698ef8f8d6"
      },
      "restored": true,
      "generatedOutputsUnchanged": true,
      "checkAfterRestore": 0
    },
    {
      "id": "B6z",
      "guard": "the frame's api carries runEnhancementCommand",
      "edits": [
        {
          "file": "src/frame-runtime/enhance-entry.ts",
          "old": "goToHash, runEnhancementCommand })",
          "new": "goToHash })"
        }
      ],
      "tests": [
        "test/enhance-frame-wire.test.ts"
      ],
      "rc": 1,
      "red": "1 failed | 4 passed (5)",
      "failing": [
        "the enhance entry registers exactly the five members, runEnhancementCommand among them"
      ],
      "verdict": "red",
      "sha256": {
        "src/frame-runtime/enhance-entry.ts": "563fb837adb9efbfb8dce1e7165a23a9b58f39e572d1aea9aec936c890944c3e"
      },
      "sha256After": {
        "src/frame-runtime/enhance-entry.ts": "563fb837adb9efbfb8dce1e7165a23a9b58f39e572d1aea9aec936c890944c3e"
      },
      "restored": true,
      "generatedOutputsUnchanged": true,
      "checkAfterRestore": 0
    },
    {
      "id": "B6aa",
      "guard": "no write or event after onProgress destroyed the instance",
      "edits": [
        {
          "file": "src/enhance/scroll.ts",
          "old": "          ctx.host.onProgress(Math.round(share * 1000) / 100000);\n          if (!ctx.live()) return;",
          "new": "          ctx.host.onProgress(Math.round(share * 1000) / 100000);"
        }
      ],
      "tests": [
        "test/enhance-scroll.test.ts"
      ],
      "rc": 1,
      "red": "1 failed | 41 passed (42)",
      "failing": [
        "a destroy requested inside onProgress ends the frame there: no heading rect is read afterwards"
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
      "id": "B6ab",
      "guard": "a command during startup answers false (the phase guard)",
      "edits": [
        {
          "file": "src/enhance/lifecycle.ts",
          "old": "inst.phase !== 'active' || ctx === null) return false;\n  return operate",
          "new": "ctx === null) return false;\n  return operate"
        }
      ],
      "tests": [
        "test/enhance-plans.test.ts"
      ],
      "rc": 1,
      "red": "1 failed | 41 passed (42)",
      "failing": [
        "a command called from a feature build, before the instance is active, answers false and changes nothing"
      ],
      "verdict": "red",
      "sha256": {
        "src/enhance/lifecycle.ts": "ea5a7413a7c8a22e1fdde5deac0d540a298c3398965a6916d8460ea19e0af0ef"
      },
      "sha256After": {
        "src/enhance/lifecycle.ts": "ea5a7413a7c8a22e1fdde5deac0d540a298c3398965a6916d8460ea19e0af0ef"
      },
      "restored": true,
      "generatedOutputsUnchanged": true,
      "checkAfterRestore": 0
    },
    {
      "id": "B6ac",
      "guard": "a root that is no element (isElement guard)",
      "edits": [
        {
          "file": "src/enhance/lifecycle.ts",
          "old": "if (!isElement(root) || typeof name !== 'string') return false;",
          "new": "if (typeof name !== 'string') return false;"
        }
      ],
      "tests": [
        "test/enhance-settings.test.ts"
      ],
      "rc": 0,
      "red": "39 passed (39)",
      "failing": [],
      "verdict": "green (possible equivalent mutant)",
      "sha256": {
        "src/enhance/lifecycle.ts": "ea5a7413a7c8a22e1fdde5deac0d540a298c3398965a6916d8460ea19e0af0ef"
      },
      "sha256After": {
        "src/enhance/lifecycle.ts": "ea5a7413a7c8a22e1fdde5deac0d540a298c3398965a6916d8460ea19e0af0ef"
      },
      "restored": true,
      "generatedOutputsUnchanged": true,
      "checkAfterRestore": 0
    },
    {
      "id": "B6ad",
      "guard": "a name that is no string (lifecycle guard)",
      "edits": [
        {
          "file": "src/enhance/lifecycle.ts",
          "old": "if (!isElement(root) || typeof name !== 'string') return false;",
          "new": "if (!isElement(root)) return false;"
        }
      ],
      "tests": [
        "test/enhance-settings.test.ts"
      ],
      "rc": 0,
      "red": "39 passed (39)",
      "failing": [],
      "verdict": "green (possible equivalent mutant)",
      "sha256": {
        "src/enhance/lifecycle.ts": "ea5a7413a7c8a22e1fdde5deac0d540a298c3398965a6916d8460ea19e0af0ef"
      },
      "sha256After": {
        "src/enhance/lifecycle.ts": "ea5a7413a7c8a22e1fdde5deac0d540a298c3398965a6916d8460ea19e0af0ef"
      },
      "restored": true,
      "generatedOutputsUnchanged": true,
      "checkAfterRestore": 0
    },
    {
      "id": "B6ae",
      "guard": "a destroyed or destroying root (ctx and operate guards)",
      "edits": [
        {
          "file": "src/enhance/lifecycle.ts",
          "old": "  return operate(inst, () => ctx.commands.run(name)) === true;",
          "new": "  return ctx.commands.run(name);"
        }
      ],
      "tests": [
        "test/enhance-settings.test.ts"
      ],
      "rc": 0,
      "red": "39 passed (39)",
      "failing": [],
      "verdict": "green (possible equivalent mutant)",
      "sha256": {
        "src/enhance/lifecycle.ts": "ea5a7413a7c8a22e1fdde5deac0d540a298c3398965a6916d8460ea19e0af0ef"
      },
      "sha256After": {
        "src/enhance/lifecycle.ts": "ea5a7413a7c8a22e1fdde5deac0d540a298c3398965a6916d8460ea19e0af0ef"
      },
      "restored": true,
      "generatedOutputsUnchanged": true,
      "checkAfterRestore": 0
    },
    {
      "id": "B6af",
      "guard": "progress computed only with the bar or onProgress",
      "edits": [
        {
          "file": "src/enhance/scroll.ts",
          "old": "    if (slots !== null || reportsProgress) {",
          "new": "    if (true as boolean) {"
        }
      ],
      "tests": [
        "test/enhance-scroll.test.ts"
      ],
      "rc": 1,
      "red": "2 failed | 40 passed (42)",
      "failing": [
        "spy events come without the bar too (chrome.bar false), and no bar rect is read",
        "with neither the bar nor onProgress, no progress is computed: the root's rect is never read"
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
      "id": "B6ag",
      "guard": "no contents command with chrome.rail false",
      "edits": [
        {
          "file": "src/enhance/rail.ts",
          "old": "if (!ctx.info.isDocument || !ctx.options.chrome.rail) return;",
          "new": "if (!ctx.info.isDocument) return;"
        }
      ],
      "tests": [
        "test/enhance-rail.test.ts"
      ],
      "rc": 1,
      "red": "1 failed | 19 passed (20)",
      "failing": [
        "B6.3: with chrome.rail false the contents command answers false and the drawer stays shut"
      ],
      "verdict": "red",
      "sha256": {
        "src/enhance/rail.ts": "b174209d1564bafe5201ca194b55330b5e36d031bfb895548644561e39bac619"
      },
      "sha256After": {
        "src/enhance/rail.ts": "b174209d1564bafe5201ca194b55330b5e36d031bfb895548644561e39bac619"
      },
      "restored": true,
      "generatedOutputsUnchanged": true,
      "checkAfterRestore": 0
    },
    {
      "id": "B6ah",
      "guard": "no outline command on a document that is no plan",
      "edits": [
        {
          "file": "src/enhance/plans.ts",
          "old": "  if (!outlineable) return;\n",
          "new": "  if (!outlineable) {\n    ctx.commands.register('outline', () => undefined);\n    return;\n  }\n"
        }
      ],
      "tests": [
        "test/enhance-plans.test.ts"
      ],
      "rc": 1,
      "red": "1 failed | 41 passed (42)",
      "failing": [
        "B6.3: a document that is no plan has no outline command"
      ],
      "verdict": "red",
      "sha256": {
        "src/enhance/plans.ts": "47de9edb6a99316635c1e96a16bdb95e42f01b5eab3a5eeca228c2698ef8f8d6"
      },
      "sha256After": {
        "src/enhance/plans.ts": "47de9edb6a99316635c1e96a16bdb95e42f01b5eab3a5eeca228c2698ef8f8d6"
      },
      "restored": true,
      "generatedOutputsUnchanged": true,
      "checkAfterRestore": 0
    },
    {
      "id": "B6ai",
      "guard": "no jump command on a document with too few entries",
      "edits": [
        {
          "file": "src/enhance/jump.ts",
          "old": "  if (entries.length <= MIN_ENTRIES) return;",
          "new": "  if (entries.length <= MIN_ENTRIES) {\n    ctx.commands.register('jump', () => true);\n    return;\n  }"
        }
      ],
      "tests": [
        "test/enhance-jump.test.ts"
      ],
      "rc": 1,
      "red": "1 failed | 56 passed (57)",
      "failing": [
        "B6.3: the jump command answers false for a root with too few entries to jump over"
      ],
      "verdict": "red",
      "sha256": {
        "src/enhance/jump.ts": "280b630bb83c2561ac2c74a5ad38adbf475c99574adea8832b1d64260fdcd908"
      },
      "sha256After": {
        "src/enhance/jump.ts": "280b630bb83c2561ac2c74a5ad38adbf475c99574adea8832b1d64260fdcd908"
      },
      "restored": true,
      "generatedOutputsUnchanged": true,
      "checkAfterRestore": 0
    }
  ]
}
```
