# Batch Task 8: browser rows for one bar (`frame-one-bar`), the mutation rows, and the header measurement

This task ships no product code: the rows run the frame's release bytes through the library page (`test/browser/frame-host-page.ts` gained a `features` mount option, an `onProgress` callback and `command`). Chromium only was run locally (`DOCREADER_BROWSERS=chromium`); WebKit runs in CI.

## Method

Each row was measured in place on branch `ws/docserver-release-1-1`, one at a time, by a driver. For each row: the bytes of the edited file and of every generated output (`assets/assets.json`, `src/frame/manifest.generated.ts`, `assets/frame/*`, `assets/mermaid/*`) were saved and hashed; the edit was applied (its old text found exactly once); a row that edits a build input (B8a, B8c) ran `npm run build:frame` so that the committed manifest names the mutated bytes; the named file ran in a bounded run (`timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/browser/frame-one-bar.test.ts`, with `ulimit -u` set to the measured thread count plus 1500); every saved file was restored by byte copy and its sha256 checked equal; `node scripts/build-frame.mjs --check` ran after the restore. A row is red only through a test assertion (the rows' waits fail through `expect.fail`, an assertion).

## Rows and verdicts

All three rows are red. Row B8b first stayed green: every tool that opens (settings, jump, the drawer) moves the focus into the frame itself, and an element's `focus()` inside an iframe makes the iframe the page's active element on Chromium, so the host's `iframe.focus()` is invisible there. The row that sees it alone is B8.3's second half: `command('contents')` at 1440 px, where the rail is shown and the command changes nothing, leaves the focus in the frame only because the host focused the iframe (the first press of a button took it). WebKit, where the same row also runs, is read in CI.

| Row | Guard | File | Change | Red |
|---|---|---|---|---|
| B8a | the prelude rule `--bar-h:0px` for a root with no bar (B6h) | `scripts/build-frame.mjs` | `  '[data-docreader-root][data-docreader-root]:not(:has(> .topbar)){--bar-h:0px}\n' +` → (removed), then `npm run build:frame` | `test/browser/frame-one-bar.test.ts`: 1 failed | 4 passed | 1 expected fail | 6 skipped (12) (red) |
| B8b | DocFrame.command focuses the iframe first (B7k) | `src/host/mount.ts` | `      iframe.focus(); ⏎       post({ t: 'command', name });` → `      post({ t: 'command', name });` | `test/browser/frame-one-bar.test.ts`: 1 failed | 4 passed | 1 expected fail | 6 skipped (12) (red) |
| B8c | the contents command closes an open drawer (B6b, browser half) | `src/enhance/rail.ts` | `    if (drawerOpen) { ⏎       close(); ⏎       return true; ⏎     } ⏎     // Where the rail…` → `    // Where the rail…`, then `npm run build:frame` | `test/browser/frame-one-bar.test.ts`: 1 failed | 4 passed | 1 expected fail | 6 skipped (12) (red) |

## Controller addition (a): the settings toggle from a host button (ruling T6-c), MEASURED RED on Chromium

Row B8.1b presses a host button outside the iframe (open), then presses it again with a real mouse down and up. The ruling is that the menu does not close when the focus leaves the frame, so the second press closes it through the command. On Chromium the menu is open after the second press: while the menu's `focusout` handler runs, `document.hasFocus()` is still true (probed: `blur` and `focusout` of the focused input arrive with `relatedTarget` null and `hasFocus` true; the document's own blur, with `hasFocus` false, comes after), so the guard `to === null && !doc.hasFocus()` does not hold, `close()` runs at the mousedown, and the click's command then opens the menu again. The row is written as the intended behaviour and marked `it.fails` so the file stays green until the controller rules on `src/enhance/settings.ts`; remove `.fails` when the menu is fixed. The unit case of T6-c cannot see it (jsdom answers `hasFocus()` before the event).

## B8.5: the title's top below the iframe's top, 390 px wide (Chromium, a measurement, not an assertion)

| Setting | Title top (px) | Root padding-top |
|---|---|---|
| bar off, `topSpace` true (the default) | 59.73 | 28px |
| bar off, `topSpace` false | 39.73 | 8px |
| bar on (reference) | 108.73 | 28px |

Above the title in the document: the eyebrow line (the front-matter line of the document), 31.73 px tall at this width, which starts at the padding's edge (28 px, or 8 px with the trim). So with `topSpace` false the title sits 40 px below the iframe's top, and 32 px of that is the eyebrow; the 8 px trim is exactly the padding. The WebKit figures arrive from CI.

## Generated outputs after every row (unchanged)

```json
{
  "generatedOutputs": {
    "assets/assets.json": "da9123c2b4bcd5cc86f179adad13bfda9096fb4f65b9edd0a64fa14000f40bde",
    "src/frame/manifest.generated.ts": "3068ff9749c29f90b3c59208b60ad80c67d0210f6bc1f07f4da7b42e89a4b7f5",
    "assets/frame/bootstrap.js": "dc49ce7dffeb1d2f9ebba065ec6a53ecbdf3ab1439f67c63c17763dda459c424",
    "assets/frame/enhance.js": "3b2cadb728847f1c535dae80c899a4939606602e7ad0d95fcf04de2bf091e1d2",
    "assets/frame/guard.js": "ff3c25da5703bc06d40ca0412b2e760c619a73a4153306f4d0f3b662bda65c4d",
    "assets/frame/reader.css": "83176e0055183256fdd131a602f847a16a17a8944812071672550e64c8dc9e9f",
    "assets/mermaid/mermaid.frame.js": "7585b2055ba386b9acff71b9c8a0c40b36dec79c2106a4aa56048c8fe59832c3",
    "assets/mermaid/mermaid.mjs": "dfba66fc5c75e030c35bf16d5e7a62bbee7be5496cabec94ec93f85d626b38df"
  },
  "rows": [
    {
      "id": "B8a",
      "guard": "the prelude rule `--bar-h:0px` for a root with no bar (B6h)",
      "file": "scripts/build-frame.mjs",
      "tests": "test/browser/frame-one-bar.test.ts",
      "rc": 1,
      "red": "1 failed | 4 passed | 1 expected fail | 6 skipped (12)",
      "failing": [
        "B8.2: with the bar off --bar-h is 0px and an anchor jump lands the target one gap below the top; with the bar on it stays 48px"
      ],
      "verdict": "red",
      "sha256": {
        "scripts/build-frame.mjs": "44c8dd26f26f247a79fd69a46513dcd041318995c09fa94b2c06ca8246830df2"
      },
      "sha256After": {
        "scripts/build-frame.mjs": "44c8dd26f26f247a79fd69a46513dcd041318995c09fa94b2c06ca8246830df2"
      },
      "restored": true,
      "generatedOutputsUnchanged": true,
      "checkAfterRestore": 0,
      "rebuilt": true
    },
    {
      "id": "B8b",
      "guard": "DocFrame.command focuses the iframe first (B7k)",
      "file": "src/host/mount.ts",
      "tests": "test/browser/frame-one-bar.test.ts",
      "rc": 1,
      "red": "1 failed | 4 passed | 1 expected fail | 6 skipped (12)",
      "failing": [
        "B8.3: command(contents) opens the drawer at 390 px and a second command closes it; at 1440 px, where the rail is shown, it opens nothing"
      ],
      "verdict": "red",
      "sha256": {
        "src/host/mount.ts": "a15dbfae176a8be53d57201d6fcd8d697438a57374bd67666390a2bf029fcc0f"
      },
      "sha256After": {
        "src/host/mount.ts": "a15dbfae176a8be53d57201d6fcd8d697438a57374bd67666390a2bf029fcc0f"
      },
      "restored": true,
      "generatedOutputsUnchanged": true,
      "checkAfterRestore": 0,
      "rebuilt": false
    },
    {
      "id": "B8c",
      "guard": "the contents command closes an open drawer (B6b, browser half)",
      "file": "src/enhance/rail.ts",
      "tests": "test/browser/frame-one-bar.test.ts",
      "rc": 1,
      "red": "1 failed | 4 passed | 1 expected fail | 6 skipped (12)",
      "failing": [
        "B8.3: command(contents) opens the drawer at 390 px and a second command closes it; at 1440 px, where the rail is shown, it opens nothing"
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
      "checkAfterRestore": 0,
      "rebuilt": true
    }
  ]
}
```
