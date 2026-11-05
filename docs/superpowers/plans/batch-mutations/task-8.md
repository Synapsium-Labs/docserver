# Batch Task 8: browser rows for one bar (`frame-one-bar`), the mutation rows, and the header measurement

This task ships no product code: the rows run the frame's release bytes through the library page (`test/browser/frame-host-page.ts` gained a `features` mount option, an `onProgress` callback and `command`). Chromium only was run locally (`DOCREADER_BROWSERS=chromium`); WebKit runs in CI. Fix round 1 (after review) rewrote the rows: the host page's bar and the viewport are set before the mount; every press first puts the focus on the host button and waits until the frame has lost it; B8.1 also runs as a tap in a touch context; B8.1c, the anchor-click landing, the 8 px trim pins in `scroll.test.ts` and the README sentence were added. `host-frame.test.ts` is not changed: it pins no adapter list, no `DocFrame` shape and no `--bar-h`, and the brief's one-bar intent (command, `onProgress`, `--bar-h`, focus) is met in `frame-one-bar.test.ts`, through the same library page.

## Method

Each row was measured in place on branch `ws/docserver-release-1-1`, one at a time, by a driver, after the fix round's test changes. For each row: the bytes of every edited file and of every generated output (`assets/assets.json`, `src/frame/manifest.generated.ts`, `assets/frame/*`, `assets/mermaid/*`) were saved and hashed; each edit was applied (its old text found exactly once); a row that edits a build input (B8a, B8c, B8d, B8e) ran `npm run build:frame` (its exit code is the row's `buildRc`) so that the committed manifest names the mutated bytes; the named file ran in a bounded run (`timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 <file>`, with `ulimit -u` set to the measured thread count plus 1500); every saved file was restored by byte copy and its sha256 checked equal (`restored`); `node scripts/build-frame.mjs --check` ran after the restore, and its exit code and output are the row's `checkAfterRestore` and `checkLog`. A row is red only through a test assertion (the rows' waits fail through `expect.fail`, an assertion, and name the last value read).

## Rows and verdicts

All five rows are red.

- B8b, against B8.1 itself: dropping `iframe.focus()` leaves B8.1 green, as a mouse press and as a tap, on Chromium. The tool opens its menu and focuses an input inside the frame, and an element's `focus()` inside an iframe makes the iframe the page's active element, so the host's call is invisible to a command whose tool focuses something. The rows that see the call are B8.3 (the 1440 px half, where the command changes nothing, so only the host's own focus call can leave the focus in the frame) and B8.1c (the contents press, refused while the menu is open, leaves the focus in the frame for the same reason). On WebKit, where B8.1's tap is the CR1 row, the same measurement is read in CI.
- B8d and B8e are red in `scroll.test.ts`: the 8 px trim (no bar, 1440 and 390 px) and its absence with a bar. The two are separate rebuild rows on `assets/reader.css`.
- Not a row: dropping the `viewport().w >= RAIL_MIN_WIDTH` check of the contents command. `open()` guards the same width itself and opens nothing where the rail is shown, so the host sees no difference (an equivalent mutant). B8.3's 1440 px half pins what the host sees: no drawer, with the focus still in the frame.

| Row | Guard | File | Change | Red |
|---|---|---|---|---|
| B8a | the prelude rule that gives a root with no bar --bar-h 0px (B6h) | `scripts/build-frame.mjs` | `'[data-docreader-root][data-docreader-root]:not(:has(> .topbar)){--bar-h:0px}\n' +` → (removed), then `npm run build:frame` | `test/browser/frame-one-bar.test.ts`: 1 failed \| 7 passed \| 8 skipped (16) (red); B8.2: with the bar off --bar-h is 0px and an anchor jump lands the target one gap below the top; with the bar on it stays 48px |
| B8b | DocFrame.command focuses the iframe first (B7k) | `src/host/mount.ts` | `iframe.focus(); ⏎       post({ t: 'command', name });` → `post({ t: 'command', name });` | `test/browser/frame-one-bar.test.ts`: 2 failed \| 6 passed \| 8 skipped (16) (red); B8.1c: with the focus away the menu stays open; a contents command while it is open changes nothing; the settings command closes it; B8.3: command(contents) opens the drawer at 390 px and a second command closes it; at 1440 px, where the rail is shown, it opens nothing |
| B8c | the contents command closes an open drawer (B6b, browser half) | `src/enhance/rail.ts` | `if (drawerOpen) { ⏎       close(); ⏎       return true; ⏎     } ⏎     // Where the rail` → `// Where the rail`, then `npm run build:frame` | `test/browser/frame-one-bar.test.ts`: 1 failed \| 7 passed \| 8 skipped (16) (red); B8.3: command(contents) opens the drawer at 390 px and a second command closes it; at 1440 px, where the rail is shown, it opens nothing |
| B8d | the trim of the root top padding to 8px (chrome.topSpace false, Q8) | `assets/reader.css` | `.no-top-space:not(:has(> .topbar)) { padding-top: 8px; }` → `.no-top-space:not(:has(> .topbar)) { }`, then `npm run build:frame` | `test/browser/scroll.test.ts`: 1 failed \| 8 passed \| 9 skipped (18) (red); the bar is the root's sticky top, as wide as the root; the column starts 49 px lower than without it, desktop and phone |
| B8e | the trim leaves a root with a bar alone (T6-b) | `assets/reader.css` | `.no-top-space:not(:has(> .topbar)) { padding-top: 8px; }` → `.no-top-space { padding-top: 8px; }`, then `npm run build:frame` | `test/browser/scroll.test.ts`: 1 failed \| 8 passed \| 9 skipped (18) (red); the bar is the root's sticky top, as wide as the root; the column starts 49 px lower than without it, desktop and phone |

## Controller addition (a): the settings toggle from a host button (rulings T6-c and T6-j)

Row B8.1b presses a host button outside the iframe (open), then presses it again with a real mouse down and up. The ruling is that the menu does not close when the focus leaves the frame, so the second press closes it through the command. On Chromium the menu is open after the second press: while the menu's `focusout` handler runs, `document.hasFocus()` is still true (probed: `blur` and `focusout` of the focused input arrive with `relatedTarget` null and `hasFocus` true; the document's own blur, with `hasFocus` false, comes after), so the guard `to === null && !doc.hasFocus()` does not hold, `close()` runs at the mousedown, and the click's command then opens the menu again. The row is written as the intended behaviour and marked `it.fails` so the file stays green until the controller rules on `src/enhance/settings.ts`; remove `.fails` when the menu is fixed. The unit case of T6-c cannot see it (jsdom answers `hasFocus()` before the event).

Update (Task 6 fix round 5, ruling T6-j): B8.1b is now an assertion, no longer `it.fails`. A `focusout` naming no element never closes the menu, whatever `hasFocus()` reports, and it closes only for focus moving to another element of the same document outside the menu. The row is green on Chromium, and restoring the T6-c exception or letting a null `relatedTarget` close the menu turns it red after a rebuild (rows B6an and B6aw, recorded in `task-6.md`, fix round 5). The rows B8a to B8c above were measured while B8.1b was an expected fail; their counts ("1 expected fail") are left as measured.

## B8.5: the title's top below the iframe's top, 390 px wide (Chromium, a measurement, not an assertion)

| Setting | Title top (px) | Root padding-top |
|---|---|---|
| bar off, `topSpace` true (the default) | 59.73 | 28px |
| bar off, `topSpace` false | 39.73 | 8px |
| bar on (reference) | 108.73 | 28px |

Above the title in the document: the eyebrow line (the front-matter line of the document), 31.73 px tall at this width, which starts at the padding's edge (28 px, or 8 px with the trim). So with `topSpace` false the title sits 40 px below the iframe's top, and 32 px of that is the eyebrow; the 8 px trim is exactly the padding. The WebKit figures arrive from CI.

Ruling T6-j's other half is row B8.1c: with the focus away from the frame the menu stays open; a `contents` command for another tool while it is open changes nothing (the settings command that follows, on the same port, closes the menu, which orders the check); the README says so in the `command` paragraph.

## Generated outputs after every row (unchanged)

```json
{
  "generatedOutputs": {
    "assets/assets.json": "a7e8c2cb2badb961c01e3cf307cae0ca759954c44007182176207ebda55869d3",
    "src/frame/manifest.generated.ts": "24b9188cec59053a5780e345ceff1b58fc3d9e68501a74d1090dccddc2325938",
    "assets/frame/bootstrap.js": "dc49ce7dffeb1d2f9ebba065ec6a53ecbdf3ab1439f67c63c17763dda459c424",
    "assets/frame/enhance.js": "daa25c84fd193dc9c8a734e6ab5705bba5d6a29fc5be73d29ed478249a9ffa7f",
    "assets/frame/guard.js": "ff3c25da5703bc06d40ca0412b2e760c619a73a4153306f4d0f3b662bda65c4d",
    "assets/frame/reader.css": "83176e0055183256fdd131a602f847a16a17a8944812071672550e64c8dc9e9f",
    "assets/mermaid/mermaid.frame.js": "7585b2055ba386b9acff71b9c8a0c40b36dec79c2106a4aa56048c8fe59832c3",
    "assets/mermaid/mermaid.mjs": "dfba66fc5c75e030c35bf16d5e7a62bbee7be5496cabec94ec93f85d626b38df"
  },
  "rows": [
    {
      "id": "B8a",
      "guard": "the prelude rule that gives a root with no bar --bar-h 0px (B6h)",
      "edits": [
        {
          "file": "scripts/build-frame.mjs",
          "old": "  '[data-docreader-root][data-docreader-root]:not(:has(> .topbar)){--bar-h:0px}\\n' +\n",
          "new": ""
        }
      ],
      "tests": "test/browser/frame-one-bar.test.ts",
      "rebuilt": true,
      "buildRc": 0,
      "rc": 1,
      "red": "1 failed | 7 passed | 8 skipped (16)",
      "failing": [
        "B8.2: with the bar off --bar-h is 0px and an anchor jump lands the target one gap below the top; with the bar on it stays 48px"
      ],
      "sha256": {
        "scripts/build-frame.mjs": "44c8dd26f26f247a79fd69a46513dcd041318995c09fa94b2c06ca8246830df2"
      },
      "sha256After": {
        "scripts/build-frame.mjs": "44c8dd26f26f247a79fd69a46513dcd041318995c09fa94b2c06ca8246830df2"
      },
      "restored": true,
      "checkAfterRestore": 0,
      "checkLog": "build-frame: --check: the outputs equal a fresh build",
      "generatedOutputsUnchanged": true,
      "verdict": "red"
    },
    {
      "id": "B8b",
      "guard": "DocFrame.command focuses the iframe first (B7k)",
      "edits": [
        {
          "file": "src/host/mount.ts",
          "old": "      iframe.focus();\n      post({ t: 'command', name });",
          "new": "      post({ t: 'command', name });"
        }
      ],
      "tests": "test/browser/frame-one-bar.test.ts",
      "rebuilt": false,
      "rc": 1,
      "red": "2 failed | 6 passed | 8 skipped (16)",
      "failing": [
        "B8.1c: with the focus away the menu stays open; a contents command while it is open changes nothing; the settings command closes it",
        "B8.3: command(contents) opens the drawer at 390 px and a second command closes it; at 1440 px, where the rail is shown, it opens nothing"
      ],
      "sha256": {
        "src/host/mount.ts": "a15dbfae176a8be53d57201d6fcd8d697438a57374bd67666390a2bf029fcc0f"
      },
      "sha256After": {
        "src/host/mount.ts": "a15dbfae176a8be53d57201d6fcd8d697438a57374bd67666390a2bf029fcc0f"
      },
      "restored": true,
      "checkAfterRestore": 0,
      "checkLog": "build-frame: --check: the outputs equal a fresh build",
      "generatedOutputsUnchanged": true,
      "verdict": "red"
    },
    {
      "id": "B8c",
      "guard": "the contents command closes an open drawer (B6b, browser half)",
      "edits": [
        {
          "file": "src/enhance/rail.ts",
          "old": "    if (drawerOpen) {\n      close();\n      return true;\n    }\n    // Where the rail",
          "new": "    // Where the rail"
        }
      ],
      "tests": "test/browser/frame-one-bar.test.ts",
      "rebuilt": true,
      "buildRc": 0,
      "rc": 1,
      "red": "1 failed | 7 passed | 8 skipped (16)",
      "failing": [
        "B8.3: command(contents) opens the drawer at 390 px and a second command closes it; at 1440 px, where the rail is shown, it opens nothing"
      ],
      "sha256": {
        "src/enhance/rail.ts": "b174209d1564bafe5201ca194b55330b5e36d031bfb895548644561e39bac619"
      },
      "sha256After": {
        "src/enhance/rail.ts": "b174209d1564bafe5201ca194b55330b5e36d031bfb895548644561e39bac619"
      },
      "restored": true,
      "checkAfterRestore": 0,
      "checkLog": "build-frame: --check: the outputs equal a fresh build",
      "generatedOutputsUnchanged": true,
      "verdict": "red"
    },
    {
      "id": "B8d",
      "guard": "the trim of the root top padding to 8px (chrome.topSpace false, Q8)",
      "edits": [
        {
          "file": "assets/reader.css",
          "old": ".no-top-space:not(:has(> .topbar)) { padding-top: 8px; }",
          "new": ".no-top-space:not(:has(> .topbar)) { }"
        }
      ],
      "tests": "test/browser/scroll.test.ts",
      "rebuilt": true,
      "buildRc": 0,
      "rc": 1,
      "red": "1 failed | 8 passed | 9 skipped (18)",
      "failing": [
        "the bar is the root's sticky top, as wide as the root; the column starts 49 px lower than without it, desktop and phone"
      ],
      "sha256": {
        "assets/reader.css": "505092a2299c6824834a3289d23d829a529bacfaefa5328d7e7daf3232dda5c0"
      },
      "sha256After": {
        "assets/reader.css": "505092a2299c6824834a3289d23d829a529bacfaefa5328d7e7daf3232dda5c0"
      },
      "restored": true,
      "checkAfterRestore": 0,
      "checkLog": "build-frame: --check: the outputs equal a fresh build",
      "generatedOutputsUnchanged": true,
      "verdict": "red"
    },
    {
      "id": "B8e",
      "guard": "the trim leaves a root with a bar alone (T6-b)",
      "edits": [
        {
          "file": "assets/reader.css",
          "old": ".no-top-space:not(:has(> .topbar)) { padding-top: 8px; }",
          "new": ".no-top-space { padding-top: 8px; }"
        }
      ],
      "tests": "test/browser/scroll.test.ts",
      "rebuilt": true,
      "buildRc": 0,
      "rc": 1,
      "red": "1 failed | 8 passed | 9 skipped (18)",
      "failing": [
        "the bar is the root's sticky top, as wide as the root; the column starts 49 px lower than without it, desktop and phone"
      ],
      "sha256": {
        "assets/reader.css": "505092a2299c6824834a3289d23d829a529bacfaefa5328d7e7daf3232dda5c0"
      },
      "sha256After": {
        "assets/reader.css": "505092a2299c6824834a3289d23d829a529bacfaefa5328d7e7daf3232dda5c0"
      },
      "restored": true,
      "checkAfterRestore": 0,
      "checkLog": "build-frame: --check: the outputs equal a fresh build",
      "generatedOutputsUnchanged": true,
      "verdict": "red"
    }
  ]
}
```

## Fix round FR1: the bar-off menu ends inside the frame (advisory A6)

Fix round FR1, item A6 (the review's advisory A6): with the bar off inside the frame, the frame's prelude sets `--bar-h` to 0 (question Q10: it stays 0), the settings menu's `max-height` is `calc(100vh - var(--bar-h) - 24px)`, and the sticky Aa sits 8px from the top and 34px high. Does the menu run past the frame's bottom, and does Aa cover a control? Measured in Chromium (`test/browser/frame-one-bar.test.ts`, B8.6), bar off, 390 px wide, inside the frame, with a drawn two-column-table document: the figure's tools stuck at the top (a tall figure scrolled into) and the table's head stuck (a 40-row two-column table scrolled into; a table of three or more columns stacks into cards on a phone and has no head).

(a) The menu: its natural height is 628px, so in a frame 804px high (viewport 844px, the host's 40px bar above the iframe) it ends inside: top 51px, bottom 681px (122.8px to spare, stuck) and top 71px, bottom 701px (102.8px to spare, at the top of the document, where Aa has not stuck and sits 28px down). In a frame 520px high (viewport 560px) the menu's `max-height` is 496px and it runs past the frame's bottom edge: stuck, top 51px, bottom 547px, 27px past; at the top, top 71px, bottom 567px, 47px past; with `chrome.topSpace` false, top 51px and bottom 547px in both positions, 27px past. TRUE for a frame shorter than about 650px. Fix, CSS only: a rule for a root with no bar, `max-height: calc(100vh - 80px)` (the menu starts at most 71px down), in `assets/reader.css`; `--bar-h` stays 0.

(b) Aa over a control: Aa is the box 343px to 378px across and 8px to 35px down. At the centre of the stuck figure tools' last button (`Full screen`, 297px to 367px across and 13px to 36px down) `elementFromPoint` finds the button itself, not Aa: not covered at its centre, so by the measure asked for the answer is no and nothing is changed for it. Aa does overlap the button's right 24px (about a third of its width), a measured fact left to the coordinator. At the centre of the stuck table head's last cell (179px to 374px across, 0px to 36px down) it finds the `th`, not Aa; the cell is not a control, and Aa overlaps its right 31px. The assertions of B8.6 pin the centres.

Red before the fix: B8.6 failed on the unfixed stylesheet with `a menu runs past the frame's bottom edge` (four entries: stuck and at the top, in the 520px frame with top space and in the one without; the 804px frame is clean). Green after: `test/browser/frame-one-bar.test.ts` 9 passed | 9 skipped (WebKit).

Method as above, with a rebuild for each row (the stylesheet feeds the frame build): the bytes of `assets/reader.css` saved with the sha256 of the fixed file, one edit, the frame rebuilt, a bounded run behind a `ulimit -u` of the measured thread count plus 1500 (2003 and 2207 threads, limits 3503 and 3707), the file and the generated outputs restored by `cp` and every sha256 compared, then `node scripts/build-frame.mjs --check`.

| Row | Guard | File | Change | Red | Restore |
|---|---|---|---|---|---|
| B8f | the bar-off menu's own max-height (FR1, A6) | `assets/reader.css` | the rule `... > .aa-wrap .aa-menu { max-height: calc(100vh - 80px); }` removed | test/browser/frame-one-bar.test.ts -t B8.6 (Chromium): 1 failed \| 17 skipped (18). test/browser/frame-one-bar.test.ts: B8.6 (A6): bar off at 390 px, the open menu ends inside the frame and the sticky Aa covers neither the stuck figure tools nor the stuck table head (a menu runs past the frame's bottom edge: 4 entries) | sha256 `191c50eaa2a2a297a50d8eb4975163843d8a6aecb8b0ed432078438e4223148b` restored, equal ; the generated outputs (assets/assets.json, src/frame/manifest.generated.ts, assets/frame/*) saved before and restored from the saved bytes after, each sha256 equal, then `node scripts/build-frame.mjs --check` green |
| B8g | the bar-off menu's max-height leaves room for Aa | `assets/reader.css` | `max-height: calc(100vh - 80px)` -> `max-height: calc(100vh - 24px)` (the room of the rule it overrides, with the bar's height gone) | test/browser/frame-one-bar.test.ts -t B8.6 (Chromium): 1 failed \| 17 skipped (18). test/browser/frame-one-bar.test.ts: B8.6 (A6): bar off at 390 px, the open menu ends inside the frame and the sticky Aa covers neither the stuck figure tools nor the stuck table head (a menu runs past the frame's bottom edge: 4 entries) | sha256 `191c50eaa2a2a297a50d8eb4975163843d8a6aecb8b0ed432078438e4223148b` restored, equal ; the generated outputs (assets/assets.json, src/frame/manifest.generated.ts, assets/frame/*) saved before and restored from the saved bytes after, each sha256 equal, then `node scripts/build-frame.mjs --check` green |

```json
[
  {
    "id": "B8f",
    "guard": "the bar-off menu's own max-height (FR1, A6)",
    "file": "assets/reader.css",
    "change": "the rule `... > .aa-wrap .aa-menu { max-height: calc(100vh - 80px); }` removed",
    "tests": "test/browser/frame-one-bar.test.ts -t B8.6 (Chromium)",
    "rc": 1,
    "red": "1 failed | 17 skipped (18)",
    "failing": [
      "test/browser/frame-one-bar.test.ts: B8.6 (A6): bar off at 390 px, the open menu ends inside the frame and the sticky Aa covers neither the stuck figure tools nor the stuck table head (a menu runs past the frame's bottom edge: 4 entries)"
    ],
    "assertionErrorsOnly": true,
    "sha256": "191c50eaa2a2a297a50d8eb4975163843d8a6aecb8b0ed432078438e4223148b",
    "restored": true
  },
  {
    "id": "B8g",
    "guard": "the bar-off menu's max-height leaves room for Aa",
    "file": "assets/reader.css",
    "change": "`max-height: calc(100vh - 80px)` -> `max-height: calc(100vh - 24px)` (the room of the rule it overrides, with the bar's height gone)",
    "tests": "test/browser/frame-one-bar.test.ts -t B8.6 (Chromium)",
    "rc": 1,
    "red": "1 failed | 17 skipped (18)",
    "failing": [
      "test/browser/frame-one-bar.test.ts: B8.6 (A6): bar off at 390 px, the open menu ends inside the frame and the sticky Aa covers neither the stuck figure tools nor the stuck table head (a menu runs past the frame's bottom edge: 4 entries)"
    ],
    "assertionErrorsOnly": true,
    "sha256": "191c50eaa2a2a297a50d8eb4975163843d8a6aecb8b0ed432078438e4223148b",
    "restored": true
  }
]
```
