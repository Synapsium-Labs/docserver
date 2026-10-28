# L3 Task 10: mutation rows (`mountDocFrame` and the host browser rows)

Each guard Task 10's rows stand on, changed once, with the row that goes red: the iframe `mountDocFrame` makes, its hello, its remounts, its watchdog and its error handling, the FrameError mapping, and the absence of a window `message` listener or handler, a teardown reachable from host code that a mount step runs, the limiter's rate close, and the classified link's delivery (`src/host/mount.ts`); the frame's own failure paths under a blocking host page policy (`src/frame-runtime/bootstrap.ts`); and the evidence the browser rows stand on: the battery's control, that the mounted battery's attempts ran, its barrier, and the HB2 control's navigation (`test/browser/host-frame.test.ts`). Measured 2026-10-28 (UTC) on branch `l3-t10-mount` (base `85f564b`, the Task 10 changes not yet committed), on the final source and the final test files after the review's fix round (`src/host/mount.ts` `11723a58fbaf…`, `test/host-mount.test.ts` `8898c430a3dd…`, `test/host-walls.test.ts` `cbaf680cbfc5…`, `test/browser/host-frame.test.ts` `6f56a270a976…`, `test/browser/host-policy.test.ts` `396ed53eb603…`, `test/browser/frame-host-page.ts` `a872aa0bfc33…`, `test/browser/frame-shared.ts` `f96bd874155b…`, `test/browser/fixtures/exfil-channels.json` `157ccc1563e5…`). Every browser row ran on Chromium only (C69: WebKit cannot start on this box; CI runs every row on both engines).

**Result.** 27 runs: the plan's 19 rows (L3.H1 three, L3.H2 three, L3.H8 three, L3.HB3, L3.HB4, L3.HB5, L3.HB6 three, L3.H11 two, L3.HB1, L3.HB7), the equivalent mutant the plan names (L3.HB7's "drop the face probe"), and seven rows the review's fix round added for guards its findings named (L3.H2-d, L3.H2-e, L3.H8-d, R11.3-a, L3.HB1-b, L3.HB1-c, L3.HB2-a). All 26 rows are red, each through an `AssertionError` (every red run exits 1). The face-probe row stays green and is recorded as an **equivalent mutant**, as the plan says (P-4: L2's font wait loads the regular faces before ready, so a blocked `data:` font raises its violation without the probe; L3.M21 pins the probe at unit level); it is not counted red and not dropped.

**Method** (Global Constraints, "Low disk"; C69, C75). One row at a time, in place in the task's own worktree, never in parallel and never in a copy of the repository, by a runner outside the worktree (the runner of Task 8, unchanged but for its output folder). For each row: the original bytes of each file it changes, and for a rebuilding row the eight generated outputs (`assets/assets.json`, `src/frame/manifest.generated.ts`, `assets/frame/{guard,bootstrap,enhance}.js`, `assets/frame/reader.css`, `assets/mermaid/{mermaid.frame.js,mermaid.mjs}`), were saved outside the worktree with their sha256; each `old` was checked to occur exactly once and replaced by `new`; a row whose change is a frame build input (`src/frame-runtime/bootstrap.ts`) rebuilt the frame (`node scripts/build-frame.mjs`, because frameDocument verifies every asset against the committed manifest); the thread count was measured (`ps -L -u "$(id -u)" --no-headers | wc -l`, 1425 to 1546 over the runs) and the row ran as the command in its JSON (`ulimit -u <threads + 1500>; timeout -k 10 600 …`), its output captured to a log; every saved file was then restored from the saved bytes and its sha256 checked equal (never `git checkout`). Every restore matched. After the last row, `sha256sum -c` over the changed sources, the generated outputs and the test files matched the hashes taken before the first, and `node scripts/build-frame.mjs --check` exited 0. A run whose failure was not an assertion is recorded as environment and run again; in a first round two jsdom rows (L3.H1-c, L3.H2-b) failed through a `SecurityError` thrown while vitest formatted a jsdom element of an opaque-origin frame for its diff, and L3.HB4-a's browser row through a Playwright "Frame was detached" error: the tests were changed to compare elements as booleans and to read the adapters after a detached frame, and every row was then measured again on the final files. The review's fix round changed the source and the tests again, so every row was measured once more on the files named above (the tables below). In the Change column a line break is shown as ⏎ and a backtick as ˋ; the JSON fence holds the exact text.


## L3.H1: the iframe (src/host/mount.ts)

Reference §11.1 steps 6 and 8, M8.1. The plan's three rows, each on `test/host-mount.test.ts` (jsdom): add `allow-same-origin`; set `src`; focus at ready instead of on mount.

| Row | Guard | Change | Result | Restore |
|---|---|---|---|---|
| L3.H1-a | sandbox exactly allow-scripts: add allow-same-origin | `src/host/mount.ts`: `iframe.setAttribute('sandbox', 'allow-scripts'); ⏎` → `iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin'); ⏎` | rc 1, 1 failed \| 12 passed \| 47 skipped (60). "sandbox is exactly allow-scripts; no src, name, allow, allowfullscreen or loading; referrerpolicy no-referrer; csp equals the meta; title". AssertionError: expected [ Array(2) ] to deeply equal [ 'allow-scripts' ] | `src/host/mount.ts` 11723a58fbaf restored, equal |
| L3.H1-b | never src: set src | `src/host/mount.ts`: `iframe.setAttribute('title', c.title); ⏎` → `iframe.setAttribute('title', c.title); ⏎     iframe.setAttribute('src', 'about:blank'); ⏎` | rc 1, 2 failed \| 11 passed \| 47 skipped (60). "sandbox is exactly allow-scripts; no src, name, allow, allowfullscreen or loading; referrerpolicy no-referrer; csp equals the meta; title"; "every attribute, srcdoc included, is set before the iframe is inserted; the load listener is on the element before insertion". AssertionError: src: expected true to be false // Object.is equality | `src/host/mount.ts` 11723a58fbaf restored, equal |
| L3.H1-c | focus on mount: focus at ready instead | `src/host/mount.ts`: `if (c.focus) iframe.focus(); ⏎` → `⏎`; `src/host/mount.ts`: `call('onReady'); ⏎` → `if (c.focus) iframe.focus(); ⏎       call('onReady'); ⏎` | rc 1, 2 failed \| 11 passed \| 47 skipped (60). "with focus on (the default) the iframe is the active element right after mount; with focus off it is not"; "nothing is focused again at ready". AssertionError: the iframe is the active element: expected false to be true // Object.is equality | `src/host/mount.ts` 11723a58fbaf restored, equal |

```json
[
  {
    "id": "L3.H1-a",
    "guard": "sandbox exactly allow-scripts: add allow-same-origin",
    "changes": [
      {
        "file": "src/host/mount.ts",
        "old": "    iframe.setAttribute('sandbox', 'allow-scripts');\n",
        "new": "    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');\n"
      }
    ],
    "rebuild": "none: the changed file is not a frame build input (the library and the tests run from source)",
    "command": "ulimit -u <threads+1500>; DOCREADER_BROWSERS=chromium timeout -k 10 600 ./node_modules/.bin/vitest run test/host-mount.test.ts --maxWorkers=1 --fileParallelism=false -t \"L3.H1\"",
    "threads": 1425,
    "rc": 1,
    "result": "1 failed | 12 passed | 47 skipped (60)",
    "failing": [
      "test/host-mount.test.ts > L3.H1 the iframe mountDocFrame makes (Reference §11.1 step 6; M8.1) > sandbox is exactly allow-scripts; no src, name, allow, allowfullscreen or loading; referrerpolicy no-referrer; csp equals the meta; title"
    ],
    "assertions": [
      "AssertionError: expected [ Array(2) ] to deeply equal [ 'allow-scripts' ]"
    ],
    "sha256": {
      "src/host/mount.ts": "11723a58fbaf90e84a2c0bae47ab47b6becbe826a0a40b9ec169f4a9fd3d93a5"
    },
    "generated": {},
    "restored": true
  },
  {
    "id": "L3.H1-b",
    "guard": "never src: set src",
    "changes": [
      {
        "file": "src/host/mount.ts",
        "old": "    iframe.setAttribute('title', c.title);\n",
        "new": "    iframe.setAttribute('title', c.title);\n    iframe.setAttribute('src', 'about:blank');\n"
      }
    ],
    "rebuild": "none: the changed file is not a frame build input (the library and the tests run from source)",
    "command": "ulimit -u <threads+1500>; DOCREADER_BROWSERS=chromium timeout -k 10 600 ./node_modules/.bin/vitest run test/host-mount.test.ts --maxWorkers=1 --fileParallelism=false -t \"L3.H1\"",
    "threads": 1498,
    "rc": 1,
    "result": "2 failed | 11 passed | 47 skipped (60)",
    "failing": [
      "test/host-mount.test.ts > L3.H1 the iframe mountDocFrame makes (Reference §11.1 step 6; M8.1) > sandbox is exactly allow-scripts; no src, name, allow, allowfullscreen or loading; referrerpolicy no-referrer; csp equals the meta; title",
      "test/host-mount.test.ts > L3.H1 the iframe mountDocFrame makes (Reference §11.1 step 6; M8.1) > every attribute, srcdoc included, is set before the iframe is inserted; the load listener is on the element before insertion"
    ],
    "assertions": [
      "AssertionError: src: expected true to be false // Object.is equality",
      "AssertionError: expected [ 'csp', 'referrerpolicy', …(4) ] to deeply equal [ 'csp', 'referrerpolicy', …(3) ]"
    ],
    "sha256": {
      "src/host/mount.ts": "11723a58fbaf90e84a2c0bae47ab47b6becbe826a0a40b9ec169f4a9fd3d93a5"
    },
    "generated": {},
    "restored": true
  },
  {
    "id": "L3.H1-c",
    "guard": "focus on mount: focus at ready instead",
    "changes": [
      {
        "file": "src/host/mount.ts",
        "old": "    if (c.focus) iframe.focus();\n",
        "new": "\n"
      },
      {
        "file": "src/host/mount.ts",
        "old": "      call('onReady');\n",
        "new": "      if (c.focus) iframe.focus();\n      call('onReady');\n"
      }
    ],
    "rebuild": "none: the changed file is not a frame build input (the library and the tests run from source)",
    "command": "ulimit -u <threads+1500>; DOCREADER_BROWSERS=chromium timeout -k 10 600 ./node_modules/.bin/vitest run test/host-mount.test.ts --maxWorkers=1 --fileParallelism=false -t \"L3.H1\"",
    "threads": 1485,
    "rc": 1,
    "result": "2 failed | 11 passed | 47 skipped (60)",
    "failing": [
      "test/host-mount.test.ts > L3.H1 the iframe mountDocFrame makes (Reference §11.1 step 6; M8.1) > with focus on (the default) the iframe is the active element right after mount; with focus off it is not",
      "test/host-mount.test.ts > L3.H1 the iframe mountDocFrame makes (Reference §11.1 step 6; M8.1) > nothing is focused again at ready"
    ],
    "assertions": [
      "AssertionError: the iframe is the active element: expected false to be true // Object.is equality",
      "AssertionError: the other button keeps the focus: expected false to be true // Object.is equality"
    ],
    "sha256": {
      "src/host/mount.ts": "11723a58fbaf90e84a2c0bae47ab47b6becbe826a0a40b9ec169f4a9fd3d93a5"
    },
    "generated": {},
    "restored": true
  }
]
```

## L3.H2: one hello per mount, a full remount, no window message listener (src/host/mount.ts)

Reference §11.2, §11.4, M8.6, M8.B5. The plan's three rows: hello on every load; reassign srcdoc on update (the mutant keeps the old iframe, so `update` replaces its `srcdoc`); add a window message listener, which both the runtime spy (`test/host-mount.test.ts`) and the source scan (`test/host-walls.test.ts`) see.

| Row | Guard | Change | Result | Restore |
|---|---|---|---|---|
| L3.H2-a | hello on the first load only: hello on every load | `src/host/mount.ts`: `if (loads === 1) { ⏎` → `if (loads >= 1) { ⏎` | rc 1, 2 failed \| 4 passed \| 54 skipped (60). "a second load closes the port and gives navigated, once, with no second hello and no remount"; "a second load after ready gives navigated too". AssertionError: expected [ { …(3) }, { …(3) } ] to have a length of 1 but got 2 | `src/host/mount.ts` 11723a58fbaf restored, equal |
| L3.H2-b | update is a full remount: reassign srcdoc on update (the old iframe kept, its srcdoc replaced) | `src/host/mount.ts`: `teardown?.(); ⏎       teardown = null; ⏎       sendPrefs = () => undefined; ⏎       mount(d); ⏎` → `sendPrefs = () => undefined; ⏎       mount(d); ⏎`; `src/host/mount.ts`: `const iframe = doc.createElement('iframe'); ⏎` → `const iframe = (el.querySelector('iframe') as HTMLIFrameElement \| null) ?? doc.createElement('iframe'); ⏎` | rc 1, 1 failed \| 5 passed \| 54 skipped (60). "update makes a new iframe, a new channel and a new nonce, and leaves the old iframe and port behind". AssertionError: the iframe is a new element: expected true to be false // Object.is equality | `src/host/mount.ts` 11723a58fbaf restored, equal |
| L3.H2-c | no window message listener: add one | `src/host/mount.ts`: `port.onmessageerror = (): void => { ⏎` → `(win as unknown as Window).addEventListener('message', () => undefined); ⏎     port.onmessageerror = (): void => { ⏎` | rc 1, 3 failed \| 66 passed \| 59 skipped (128). "no 'message' listener is ever added to the window (mount, load, ready, every op, update, destroy)"; "no src/host file names a forbidden name, opens a window, sets an attribute outside the list, or listens for messages; every guarded site is at its allowed count"; "a planted extra site in mount.ts goes red: a third postMessage, a second contentWindow, a second focus(), a third port.onmessage". AssertionError: expected [ 'message', 'message' ] to deeply equal [] | `src/host/mount.ts` 11723a58fbaf restored, equal |
| L3.H2-d | the handles are published before host code can run: publish them after focus again (destroy or update from a focusout inside update) | `src/host/mount.ts`: `// The handles are published before the first step that can run host code: insertion (a mutation event) and focus ⏎     // (blur and focusout on the element that had it) run the host's listeners synchronously, and one of them may call ⏎     // destroy() or update(). Each finds this mount's teardown and stops it; this mount then sets nothing more. ⏎     sendPrefs = (p) => { ⏎       if (!live) return; ⏎       if (ready) post({ t: 'prefs', ...p }); ⏎       else pending = { ...(pending ?? {}), ...p }; ⏎     }; ⏎     teardown = () => { ⏎       if (live) stop(); ⏎     }; ⏎     el.append(iframe); ⏎     if (!live) return; ⏎` → `el.append(iframe); ⏎`; `src/host/mount.ts`: `if (c.focus) iframe.focus(); ⏎   }; ⏎` → `if (c.focus) iframe.focus(); ⏎     sendPrefs = (p) => { ⏎       if (!live) return; ⏎       if (ready) post({ t: 'prefs', ...p }); ⏎       else pending = { ...(pending ?? {}), ...p }; ⏎     }; ⏎     teardown = () => { ⏎       if (live) stop(); ⏎     }; ⏎   }; ⏎` | rc 1, 2 failed \| 0 passed \| 58 skipped (60). "destroy called by host code that runs inside update (a focusout at the new iframe's focus) tears the new mount down: no iframe, a closed port, no adapter call after"; "update called by host code that runs inside update leaves exactly one live mount, the innermost". AssertionError: expected 1 to be +0 // Object.is equality | `src/host/mount.ts` 11723a58fbaf restored, equal |
| L3.H2-e | no window message handler by any spelling: set the window's onmessage through Reflect.set | `src/host/mount.ts`: `port.onmessageerror = (): void => { ⏎` → `Reflect.set(win, 'onmessage', () => undefined); ⏎     port.onmessageerror = (): void => { ⏎` | rc 1, 3 failed \| 66 passed \| 59 skipped (128). "no 'message' listener is ever added to the window (mount, load, ready, every op, update, destroy)"; "no src/host file names a forbidden name, opens a window, sets an attribute outside the list, or listens for messages; every guarded site is at its allowed count"; "a planted extra site in mount.ts goes red: a third postMessage, a second contentWindow, a second focus(), a third port.onmessage". AssertionError: expected [ [ 'mount', false, true ], …(3) ] to deeply equal [ [ 'mount', true, true ], …(3) ] | `src/host/mount.ts` 11723a58fbaf restored, equal |

L3.H2-d and L3.H2-e come from the review's fix round. L3.H2-d: a host listener that runs inside `update()` (a `focusout` at the new iframe's focus) calls `destroy()` or `update()`; with the handles published after focus again, that call finds no teardown and the new mount stays live. L3.H2-e: the window's `onmessage` set through `Reflect.set`, which the runtime check of the window's handlers and the source scan's string rule both see.

```json
[
  {
    "id": "L3.H2-a",
    "guard": "hello on the first load only: hello on every load",
    "changes": [
      {
        "file": "src/host/mount.ts",
        "old": "      if (loads === 1) {\n",
        "new": "      if (loads >= 1) {\n"
      }
    ],
    "rebuild": "none: the changed file is not a frame build input (the library and the tests run from source)",
    "command": "ulimit -u <threads+1500>; DOCREADER_BROWSERS=chromium timeout -k 10 600 ./node_modules/.bin/vitest run test/host-mount.test.ts --maxWorkers=1 --fileParallelism=false -t \"L3.H2\"",
    "threads": 1490,
    "rc": 1,
    "result": "2 failed | 4 passed | 54 skipped (60)",
    "failing": [
      "test/host-mount.test.ts > L3.H2 one hello per mount, on the first load (Reference §11.1 step 7, §11.2, §11.4; M8.6, M8.B5) > a second load closes the port and gives navigated, once, with no second hello and no remount",
      "test/host-mount.test.ts > L3.H2 one hello per mount, on the first load (Reference §11.1 step 7, §11.2, §11.4; M8.6, M8.B5) > a second load after ready gives navigated too"
    ],
    "assertions": [
      "AssertionError: expected [ { …(3) }, { …(3) } ] to have a length of 1 but got 2",
      "AssertionError: expected [] to deeply equal [ 'navigated' ]"
    ],
    "sha256": {
      "src/host/mount.ts": "11723a58fbaf90e84a2c0bae47ab47b6becbe826a0a40b9ec169f4a9fd3d93a5"
    },
    "generated": {},
    "restored": true
  },
  {
    "id": "L3.H2-b",
    "guard": "update is a full remount: reassign srcdoc on update (the old iframe kept, its srcdoc replaced)",
    "changes": [
      {
        "file": "src/host/mount.ts",
        "old": "      teardown?.();\n      teardown = null;\n      sendPrefs = () => undefined;\n      mount(d);\n",
        "new": "      sendPrefs = () => undefined;\n      mount(d);\n"
      },
      {
        "file": "src/host/mount.ts",
        "old": "    const iframe = doc.createElement('iframe');\n",
        "new": "    const iframe = (el.querySelector('iframe') as HTMLIFrameElement | null) ?? doc.createElement('iframe');\n"
      }
    ],
    "rebuild": "none: the changed file is not a frame build input (the library and the tests run from source)",
    "command": "ulimit -u <threads+1500>; DOCREADER_BROWSERS=chromium timeout -k 10 600 ./node_modules/.bin/vitest run test/host-mount.test.ts --maxWorkers=1 --fileParallelism=false -t \"L3.H2\"",
    "threads": 1453,
    "rc": 1,
    "result": "1 failed | 5 passed | 54 skipped (60)",
    "failing": [
      "test/host-mount.test.ts > L3.H2 one hello per mount, on the first load (Reference §11.1 step 7, §11.2, §11.4; M8.6, M8.B5) > update makes a new iframe, a new channel and a new nonce, and leaves the old iframe and port behind"
    ],
    "assertions": [
      "AssertionError: the iframe is a new element: expected true to be false // Object.is equality"
    ],
    "sha256": {
      "src/host/mount.ts": "11723a58fbaf90e84a2c0bae47ab47b6becbe826a0a40b9ec169f4a9fd3d93a5"
    },
    "generated": {},
    "restored": true
  },
  {
    "id": "L3.H2-c",
    "guard": "no window message listener: add one",
    "changes": [
      {
        "file": "src/host/mount.ts",
        "old": "    port.onmessageerror = (): void => {\n",
        "new": "    (win as unknown as Window).addEventListener('message', () => undefined);\n    port.onmessageerror = (): void => {\n"
      }
    ],
    "rebuild": "none: the changed file is not a frame build input (the library and the tests run from source)",
    "command": "ulimit -u <threads+1500>; DOCREADER_BROWSERS=chromium timeout -k 10 600 ./node_modules/.bin/vitest run test/host-mount.test.ts test/host-walls.test.ts --maxWorkers=1 --fileParallelism=false -t \"L3.H2|window message listener|forbidden name\"",
    "threads": 1432,
    "rc": 1,
    "result": "3 failed | 66 passed | 59 skipped (128)",
    "failing": [
      "test/host-mount.test.ts > L3.H2 one hello per mount, on the first load (Reference §11.1 step 7, §11.2, §11.4; M8.6, M8.B5) > no 'message' listener is ever added to the window (mount, load, ready, every op, update, destroy)",
      "test/host-walls.test.ts > host walls: CSP, the page and the window message listener > no src/host file names a forbidden name, opens a window, sets an attribute outside the list, or listens for messages; every guarded site is at its allowed count",
      "test/host-walls.test.ts > host walls: CSP, the page and the window message listener > a planted extra site in mount.ts goes red: a third postMessage, a second contentWindow, a second focus(), a third port.onmessage"
    ],
    "assertions": [
      "AssertionError: expected [ 'message', 'message' ] to deeply equal []",
      "AssertionError: expected [ Array(1) ] to deeply equal []",
      "AssertionError: x.postMessage(1);: expected 2 to be 1 // Object.is equality"
    ],
    "sha256": {
      "src/host/mount.ts": "11723a58fbaf90e84a2c0bae47ab47b6becbe826a0a40b9ec169f4a9fd3d93a5"
    },
    "generated": {},
    "restored": true
  },
  {
    "id": "L3.H2-d",
    "guard": "the handles are published before host code can run: publish them after focus again (destroy or update from a focusout inside update)",
    "changes": [
      {
        "file": "src/host/mount.ts",
        "old": "    // The handles are published before the first step that can run host code: insertion (a mutation event) and focus\n    // (blur and focusout on the element that had it) run the host's listeners synchronously, and one of them may call\n    // destroy() or update(). Each finds this mount's teardown and stops it; this mount then sets nothing more.\n    sendPrefs = (p) => {\n      if (!live) return;\n      if (ready) post({ t: 'prefs', ...p });\n      else pending = { ...(pending ?? {}), ...p };\n    };\n    teardown = () => {\n      if (live) stop();\n    };\n    el.append(iframe);\n    if (!live) return;\n",
        "new": "    el.append(iframe);\n"
      },
      {
        "file": "src/host/mount.ts",
        "old": "    if (c.focus) iframe.focus();\n  };\n",
        "new": "    if (c.focus) iframe.focus();\n    sendPrefs = (p) => {\n      if (!live) return;\n      if (ready) post({ t: 'prefs', ...p });\n      else pending = { ...(pending ?? {}), ...p };\n    };\n    teardown = () => {\n      if (live) stop();\n    };\n  };\n"
      }
    ],
    "rebuild": "none: the changed file is not a frame build input (the library and the tests run from source)",
    "command": "ulimit -u <threads+1500>; DOCREADER_BROWSERS=chromium timeout -k 10 600 ./node_modules/.bin/vitest run test/host-mount.test.ts --maxWorkers=1 --fileParallelism=false -t \"inside update\"",
    "threads": 1468,
    "rc": 1,
    "result": "2 failed | 0 passed | 58 skipped (60)",
    "failing": [
      "test/host-mount.test.ts > setPrefs, update and destroy (Reference §11.4) > destroy called by host code that runs inside update (a focusout at the new iframe's focus) tears the new mount down: no iframe, a closed port, no adapter call after",
      "test/host-mount.test.ts > setPrefs, update and destroy (Reference §11.4) > update called by host code that runs inside update leaves exactly one live mount, the innermost"
    ],
    "assertions": [
      "AssertionError: expected 1 to be +0 // Object.is equality",
      "AssertionError: expected 2 to be 1 // Object.is equality"
    ],
    "sha256": {
      "src/host/mount.ts": "11723a58fbaf90e84a2c0bae47ab47b6becbe826a0a40b9ec169f4a9fd3d93a5"
    },
    "generated": {},
    "restored": true
  },
  {
    "id": "L3.H2-e",
    "guard": "no window message handler by any spelling: set the window's onmessage through Reflect.set",
    "changes": [
      {
        "file": "src/host/mount.ts",
        "old": "    port.onmessageerror = (): void => {\n",
        "new": "    Reflect.set(win, 'onmessage', () => undefined);\n    port.onmessageerror = (): void => {\n"
      }
    ],
    "rebuild": "none: the changed file is not a frame build input (the library and the tests run from source)",
    "command": "ulimit -u <threads+1500>; DOCREADER_BROWSERS=chromium timeout -k 10 600 ./node_modules/.bin/vitest run test/host-mount.test.ts test/host-walls.test.ts --maxWorkers=1 --fileParallelism=false -t \"L3.H2|window message listener|forbidden name\"",
    "threads": 1462,
    "rc": 1,
    "result": "3 failed | 66 passed | 59 skipped (128)",
    "failing": [
      "test/host-mount.test.ts > L3.H2 one hello per mount, on the first load (Reference §11.1 step 7, §11.2, §11.4; M8.6, M8.B5) > no 'message' listener is ever added to the window (mount, load, ready, every op, update, destroy)",
      "test/host-walls.test.ts > host walls: CSP, the page and the window message listener > no src/host file names a forbidden name, opens a window, sets an attribute outside the list, or listens for messages; every guarded site is at its allowed count",
      "test/host-walls.test.ts > host walls: CSP, the page and the window message listener > a planted extra site in mount.ts goes red: a third postMessage, a second contentWindow, a second focus(), a third port.onmessage"
    ],
    "assertions": [
      "AssertionError: expected [ [ 'mount', false, true ], …(3) ] to deeply equal [ [ 'mount', true, true ], …(3) ]",
      "AssertionError: expected [ Array(1) ] to deeply equal []",
      "AssertionError: x.postMessage(1);: expected 2 to be 1 // Object.is equality"
    ],
    "sha256": {
      "src/host/mount.ts": "11723a58fbaf90e84a2c0bae47ab47b6becbe826a0a40b9ec169f4a9fd3d93a5"
    },
    "generated": {},
    "restored": true
  }
]
```

## L3.H8: the watchdog, no remount, error terminal by itself (src/host/mount.ts)

Reference §11.3, §11.4, FD10, M8.11. The plan's three rows: remove the timer; a remount loop (every fallback mounts again); wait for a close after `error` (the parent cannot see the close, prototype finding P-3, so the mutant never falls back).

| Row | Guard | Change | Result | Restore |
|---|---|---|---|---|
| L3.H8-a | the watchdog: remove the timer | `src/host/mount.ts`: `watchdog = win.setTimeout(() => fail('timeout'), c.watchdogMs); ⏎` → `watchdog = null; ⏎` | rc 1, 1 failed \| 6 passed \| 53 skipped (60). "no ready within watchdogMs: onFallback("timeout") exactly once, the iframe removed, no remount". AssertionError: expected [] to deeply equal [ 'timeout' ] | `src/host/mount.ts` 11723a58fbaf restored, equal |
| L3.H8-b | never remount: a remount loop | `src/host/mount.ts`: `teardown = null; ⏎       call('onFallback', reason); ⏎` → `teardown = null; ⏎       call('onFallback', reason); ⏎       mount(d); ⏎` | rc 1, 4 failed \| 3 passed \| 53 skipped (60). "no ready within watchdogMs: onFallback("timeout") exactly once, the iframe removed, no remount"; "a ready with a wrong nonce: onFallback("nonce") once, nothing more acted on"; "a ready with protocol 2: onFallback("protocol") once"; "an error after ready: onFallback('error') at once, without waiting for the port to close; why is logged, never in the DOM". AssertionError: expected 1 to be +0 // Object.is equality | `src/host/mount.ts` 11723a58fbaf restored, equal |
| L3.H8-c | error is terminal by itself (FD10): wait for a close after error | `src/host/mount.ts`: `console.warn('docserver frame:', msg.why); ⏎           fail('error'); ⏎` → `console.warn('docserver frame:', msg.why); ⏎           (port as unknown as { onclose: unknown }).onclose = () => fail('error'); ⏎` | rc 1, 1 failed \| 6 passed \| 53 skipped (60). "an error after ready: onFallback('error') at once, without waiting for the port to close; why is logged, never in the DOM". AssertionError: expected [] to deeply equal [ 'error' ] | `src/host/mount.ts` 11723a58fbaf restored, equal |
| L3.H8-d | the sixteenth refusal closes when the limiter refuses for rate: drop the admit branch's fail('refusals') | `src/host/mount.ts`: `if (!admitted.ok && admitted.closes) fail('refusals'); ⏎` → `void admitted; ⏎` | rc 1, 1 failed \| 1 passed \| 58 skipped (60). "sixteen rate refusals close the frame through the limiter: onFallback("refusals") once, the iframe removed, the port closed". AssertionError: expected [] to deeply equal [ 'refusals' ] | `src/host/mount.ts` 11723a58fbaf restored, equal |

L3.H8-d comes from the review's fix round: the sixteenth refusal reached through the limiter's rate refusals (C88(2), the refused `error` included), not the parser's.

```json
[
  {
    "id": "L3.H8-a",
    "guard": "the watchdog: remove the timer",
    "changes": [
      {
        "file": "src/host/mount.ts",
        "old": "    watchdog = win.setTimeout(() => fail('timeout'), c.watchdogMs);\n",
        "new": "    watchdog = null;\n"
      }
    ],
    "rebuild": "none: the changed file is not a frame build input (the library and the tests run from source)",
    "command": "ulimit -u <threads+1500>; DOCREADER_BROWSERS=chromium timeout -k 10 600 ./node_modules/.bin/vitest run test/host-mount.test.ts --maxWorkers=1 --fileParallelism=false -t \"L3.H8\"",
    "threads": 1470,
    "rc": 1,
    "result": "1 failed | 6 passed | 53 skipped (60)",
    "failing": [
      "test/host-mount.test.ts > L3.H8 no ready, a wrong ready, and error (Reference §11.3, §11.4, FD10; M8.11) > no ready within watchdogMs: onFallback(\"timeout\") exactly once, the iframe removed, no remount"
    ],
    "assertions": [
      "AssertionError: expected [] to deeply equal [ 'timeout' ]"
    ],
    "sha256": {
      "src/host/mount.ts": "11723a58fbaf90e84a2c0bae47ab47b6becbe826a0a40b9ec169f4a9fd3d93a5"
    },
    "generated": {},
    "restored": true
  },
  {
    "id": "L3.H8-b",
    "guard": "never remount: a remount loop",
    "changes": [
      {
        "file": "src/host/mount.ts",
        "old": "      teardown = null;\n      call('onFallback', reason);\n",
        "new": "      teardown = null;\n      call('onFallback', reason);\n      mount(d);\n"
      }
    ],
    "rebuild": "none: the changed file is not a frame build input (the library and the tests run from source)",
    "command": "ulimit -u <threads+1500>; DOCREADER_BROWSERS=chromium timeout -k 10 600 ./node_modules/.bin/vitest run test/host-mount.test.ts --maxWorkers=1 --fileParallelism=false -t \"L3.H8\"",
    "threads": 1477,
    "rc": 1,
    "result": "4 failed | 3 passed | 53 skipped (60)",
    "failing": [
      "test/host-mount.test.ts > L3.H8 no ready, a wrong ready, and error (Reference §11.3, §11.4, FD10; M8.11) > no ready within watchdogMs: onFallback(\"timeout\") exactly once, the iframe removed, no remount",
      "test/host-mount.test.ts > L3.H8 no ready, a wrong ready, and error (Reference §11.3, §11.4, FD10; M8.11) > a ready with a wrong nonce: onFallback(\"nonce\") once, nothing more acted on",
      "test/host-mount.test.ts > L3.H8 no ready, a wrong ready, and error (Reference §11.3, §11.4, FD10; M8.11) > a ready with protocol 2: onFallback(\"protocol\") once",
      "test/host-mount.test.ts > L3.H8 no ready, a wrong ready, and error (Reference §11.3, §11.4, FD10; M8.11) > an error after ready: onFallback('error') at once, without waiting for the port to close; why is logged, never in the DOM"
    ],
    "assertions": [
      "AssertionError: expected 1 to be +0 // Object.is equality",
      "AssertionError: expected 1 to be +0 // Object.is equality",
      "AssertionError: expected 1 to be +0 // Object.is equality",
      "AssertionError: expected 1 to be +0 // Object.is equality"
    ],
    "sha256": {
      "src/host/mount.ts": "11723a58fbaf90e84a2c0bae47ab47b6becbe826a0a40b9ec169f4a9fd3d93a5"
    },
    "generated": {},
    "restored": true
  },
  {
    "id": "L3.H8-c",
    "guard": "error is terminal by itself (FD10): wait for a close after error",
    "changes": [
      {
        "file": "src/host/mount.ts",
        "old": "          console.warn('docserver frame:', msg.why);\n          fail('error');\n",
        "new": "          console.warn('docserver frame:', msg.why);\n          (port as unknown as { onclose: unknown }).onclose = () => fail('error');\n"
      }
    ],
    "rebuild": "none: the changed file is not a frame build input (the library and the tests run from source)",
    "command": "ulimit -u <threads+1500>; DOCREADER_BROWSERS=chromium timeout -k 10 600 ./node_modules/.bin/vitest run test/host-mount.test.ts --maxWorkers=1 --fileParallelism=false -t \"L3.H8\"",
    "threads": 1481,
    "rc": 1,
    "result": "1 failed | 6 passed | 53 skipped (60)",
    "failing": [
      "test/host-mount.test.ts > L3.H8 no ready, a wrong ready, and error (Reference §11.3, §11.4, FD10; M8.11) > an error after ready: onFallback('error') at once, without waiting for the port to close; why is logged, never in the DOM"
    ],
    "assertions": [
      "AssertionError: expected [] to deeply equal [ 'error' ]"
    ],
    "sha256": {
      "src/host/mount.ts": "11723a58fbaf90e84a2c0bae47ab47b6becbe826a0a40b9ec169f4a9fd3d93a5"
    },
    "generated": {},
    "restored": true
  },
  {
    "id": "L3.H8-d",
    "guard": "the sixteenth refusal closes when the limiter refuses for rate: drop the admit branch's fail('refusals')",
    "changes": [
      {
        "file": "src/host/mount.ts",
        "old": "      if (!admitted.ok && admitted.closes) fail('refusals');\n",
        "new": "      void admitted;\n"
      }
    ],
    "rebuild": "none: the changed file is not a frame build input (the library and the tests run from source)",
    "command": "ulimit -u <threads+1500>; DOCREADER_BROWSERS=chromium timeout -k 10 600 ./node_modules/.bin/vitest run test/host-mount.test.ts --maxWorkers=1 --fileParallelism=false -t \"rate refusal\"",
    "threads": 1478,
    "rc": 1,
    "result": "1 failed | 1 passed | 58 skipped (60)",
    "failing": [
      "test/host-mount.test.ts > after ready: the limiter, then one effect per op (Reference §11.3) > sixteen rate refusals close the frame through the limiter: onFallback(\"refusals\") once, the iframe removed, the port closed"
    ],
    "assertions": [
      "AssertionError: expected [] to deeply equal [ 'refusals' ]"
    ],
    "sha256": {
      "src/host/mount.ts": "11723a58fbaf90e84a2c0bae47ab47b6becbe826a0a40b9ec169f4a9fd3d93a5"
    },
    "generated": {},
    "restored": true
  }
]
```

## Reference §11.3: one effect per op after ready (src/host/mount.ts)

From the review's fix round. The navigate rows send one href per 250 ms window, so every href reaches classifyLink; the mutant delivers external links only, which the earlier row (two hrefs in one window, the second still held when it asserted) could not see.

| Row | Guard | Change | Result | Restore |
|---|---|---|---|---|
| R11.3-a | every href classifyLink accepts reaches onLink: deliver external links only | `src/host/mount.ts`: `if (link !== null) call('onLink', link); ⏎` → `if (link !== null && link.kind === 'external') call('onLink', link); ⏎` | rc 1, 1 failed \| 3 passed \| 56 skipped (60). "navigate is classified and handed to onLink; a refused href is not". AssertionError: expected [ { kind: 'external', …(3) } ] to deeply equal [ { kind: 'external', …(3) }, …(1) ] | `src/host/mount.ts` 11723a58fbaf restored, equal |

```json
[
  {
    "id": "R11.3-a",
    "guard": "every href classifyLink accepts reaches onLink: deliver external links only",
    "changes": [
      {
        "file": "src/host/mount.ts",
        "old": "          if (link !== null) call('onLink', link);\n",
        "new": "          if (link !== null && link.kind === 'external') call('onLink', link);\n"
      }
    ],
    "rebuild": "none: the changed file is not a frame build input (the library and the tests run from source)",
    "command": "ulimit -u <threads+1500>; DOCREADER_BROWSERS=chromium timeout -k 10 600 ./node_modules/.bin/vitest run test/host-mount.test.ts --maxWorkers=1 --fileParallelism=false -t \"navigate\"",
    "threads": 1456,
    "rc": 1,
    "result": "1 failed | 3 passed | 56 skipped (60)",
    "failing": [
      "test/host-mount.test.ts > after ready: the limiter, then one effect per op (Reference §11.3) > navigate is classified and handed to onLink; a refused href is not"
    ],
    "assertions": [
      "AssertionError: expected [ { kind: 'external', …(3) } ] to deeply equal [ { kind: 'external', …(3) }, …(1) ]"
    ],
    "sha256": {
      "src/host/mount.ts": "11723a58fbaf90e84a2c0bae47ab47b6becbe826a0a40b9ec169f4a9fd3d93a5"
    },
    "generated": {},
    "restored": true
  }
]
```

## L3.H11: FrameErrorCode to FallbackReason, no iframe on a refusal (src/host/mount.ts)

Reference §11.1 step 5. The plan's two rows: map every code to `assets`; create the iframe before mapping (the mutant creates it, unattached, before frameDocument runs).

| Row | Guard | Change | Result | Restore |
|---|---|---|---|---|
| L3.H11-a | each FrameErrorCode to its FallbackReason: map every code to assets | `src/host/mount.ts`: `call('onFallback', FALLBACK_OF[code]); ⏎` → `call('onFallback', 'assets'); ⏎` | rc 1, 4 failed \| 5 passed \| 51 skipped (60). "not-rendered (an over-limit document): invalid-input"; "invalid-input (a bad lang): invalid-input"; "too-large (an html over the seed cap): too-large"; "an update whose document is refused falls back once and leaves no iframe". AssertionError: expected [ 'assets' ] to deeply equal [ 'invalid-input' ] | `src/host/mount.ts` 11723a58fbaf restored, equal |
| L3.H11-b | no iframe before the srcdoc is accepted: create the iframe before mapping | `src/host/mount.ts`: `// Step 6: the iframe, every attribute before insertion. ⏎     const iframe = doc.createElement('iframe'); ⏎` → `// Step 6: the iframe, every attribute before insertion. ⏎`; `src/host/mount.ts`: `let page: string; ⏎` → `const iframe = doc.createElement('iframe'); ⏎     let page: string; ⏎` | rc 1, 8 failed \| 1 passed \| 51 skipped (60). "not-rendered (an over-limit document): invalid-input"; "invalid-input (a bad lang): invalid-input"; "too-large (an html over the seed cap): too-large"; "asset-mismatch (a flipped asset byte): assets"; "missing-asset (a document whose gate lets Mermaid in, with no Mermaid asset): assets"; "unsafe-asset (a planted CR in an asset): assets"; "nonce (reached through a stubbed frameDocument): assets, after the internal warning"; "csp (reached through a stubbed frameDocument): assets, after the internal warning". AssertionError: expected [ [ 'iframe' ] ] to deeply equal [] | `src/host/mount.ts` 11723a58fbaf restored, equal |

```json
[
  {
    "id": "L3.H11-a",
    "guard": "each FrameErrorCode to its FallbackReason: map every code to assets",
    "changes": [
      {
        "file": "src/host/mount.ts",
        "old": "      call('onFallback', FALLBACK_OF[code]);\n",
        "new": "      call('onFallback', 'assets');\n"
      }
    ],
    "rebuild": "none: the changed file is not a frame build input (the library and the tests run from source)",
    "command": "ulimit -u <threads+1500>; DOCREADER_BROWSERS=chromium timeout -k 10 600 ./node_modules/.bin/vitest run test/host-mount.test.ts --maxWorkers=1 --fileParallelism=false -t \"L3.H11\"",
    "threads": 1478,
    "rc": 1,
    "result": "4 failed | 5 passed | 51 skipped (60)",
    "failing": [
      "test/host-mount.test.ts > L3.H11 each FrameErrorCode maps to its FallbackReason; no iframe is created (Reference §11.1 step 5) > not-rendered (an over-limit document): invalid-input",
      "test/host-mount.test.ts > L3.H11 each FrameErrorCode maps to its FallbackReason; no iframe is created (Reference §11.1 step 5) > invalid-input (a bad lang): invalid-input",
      "test/host-mount.test.ts > L3.H11 each FrameErrorCode maps to its FallbackReason; no iframe is created (Reference §11.1 step 5) > too-large (an html over the seed cap): too-large",
      "test/host-mount.test.ts > L3.H11 each FrameErrorCode maps to its FallbackReason; no iframe is created (Reference §11.1 step 5) > an update whose document is refused falls back once and leaves no iframe"
    ],
    "assertions": [
      "AssertionError: expected [ 'assets' ] to deeply equal [ 'invalid-input' ]",
      "AssertionError: expected [ 'assets' ] to deeply equal [ 'invalid-input' ]",
      "AssertionError: expected [ 'assets' ] to deeply equal [ 'too-large' ]",
      "AssertionError: expected [ 'assets' ] to deeply equal [ 'invalid-input' ]"
    ],
    "sha256": {
      "src/host/mount.ts": "11723a58fbaf90e84a2c0bae47ab47b6becbe826a0a40b9ec169f4a9fd3d93a5"
    },
    "generated": {},
    "restored": true
  },
  {
    "id": "L3.H11-b",
    "guard": "no iframe before the srcdoc is accepted: create the iframe before mapping",
    "changes": [
      {
        "file": "src/host/mount.ts",
        "old": "    // Step 6: the iframe, every attribute before insertion.\n    const iframe = doc.createElement('iframe');\n",
        "new": "    // Step 6: the iframe, every attribute before insertion.\n"
      },
      {
        "file": "src/host/mount.ts",
        "old": "    let page: string;\n",
        "new": "    const iframe = doc.createElement('iframe');\n    let page: string;\n"
      }
    ],
    "rebuild": "none: the changed file is not a frame build input (the library and the tests run from source)",
    "command": "ulimit -u <threads+1500>; DOCREADER_BROWSERS=chromium timeout -k 10 600 ./node_modules/.bin/vitest run test/host-mount.test.ts --maxWorkers=1 --fileParallelism=false -t \"L3.H11\"",
    "threads": 1465,
    "rc": 1,
    "result": "8 failed | 1 passed | 51 skipped (60)",
    "failing": [
      "test/host-mount.test.ts > L3.H11 each FrameErrorCode maps to its FallbackReason; no iframe is created (Reference §11.1 step 5) > not-rendered (an over-limit document): invalid-input",
      "test/host-mount.test.ts > L3.H11 each FrameErrorCode maps to its FallbackReason; no iframe is created (Reference §11.1 step 5) > invalid-input (a bad lang): invalid-input",
      "test/host-mount.test.ts > L3.H11 each FrameErrorCode maps to its FallbackReason; no iframe is created (Reference §11.1 step 5) > too-large (an html over the seed cap): too-large",
      "test/host-mount.test.ts > L3.H11 each FrameErrorCode maps to its FallbackReason; no iframe is created (Reference §11.1 step 5) > asset-mismatch (a flipped asset byte): assets",
      "test/host-mount.test.ts > L3.H11 each FrameErrorCode maps to its FallbackReason; no iframe is created (Reference §11.1 step 5) > missing-asset (a document whose gate lets Mermaid in, with no Mermaid asset): assets",
      "test/host-mount.test.ts > L3.H11 each FrameErrorCode maps to its FallbackReason; no iframe is created (Reference §11.1 step 5) > unsafe-asset (a planted CR in an asset): assets",
      "test/host-mount.test.ts > L3.H11 each FrameErrorCode maps to its FallbackReason; no iframe is created (Reference §11.1 step 5) > nonce (reached through a stubbed frameDocument): assets, after the internal warning",
      "test/host-mount.test.ts > L3.H11 each FrameErrorCode maps to its FallbackReason; no iframe is created (Reference §11.1 step 5) > csp (reached through a stubbed frameDocument): assets, after the internal warning"
    ],
    "assertions": [
      "AssertionError: expected [ [ 'iframe' ] ] to deeply equal []",
      "AssertionError: expected [ [ 'iframe' ] ] to deeply equal []",
      "AssertionError: expected [ [ 'iframe' ] ] to deeply equal []",
      "AssertionError: expected [ [ 'iframe' ] ] to deeply equal []",
      "AssertionError: expected [ [ 'iframe' ] ] to deeply equal []",
      "AssertionError: expected [ [ 'iframe' ] ] to deeply equal []",
      "AssertionError: expected [ [ 'iframe' ] ] to deeply equal []",
      "AssertionError: expected [ [ 'iframe' ] ] to deeply equal []"
    ],
    "sha256": {
      "src/host/mount.ts": "11723a58fbaf90e84a2c0bae47ab47b6becbe826a0a40b9ec169f4a9fd3d93a5"
    },
    "generated": {},
    "restored": true
  }
]
```

## L3.HB3: exactly one load before ready (src/host/mount.ts)

Reference §11.1 step 7. The plan's row: set srcdoc after insertion. On Chromium the iframe then loads `about:blank` first, the hello reaches the replaced document, and the srcdoc's load is the second load, so the mount falls back (`navigated`) before any ready: both rows that read the loads go red.

| Row | Guard | Change | Result | Restore |
|---|---|---|---|---|
| L3.HB3-a | srcdoc before insertion: set srcdoc after insertion | `src/host/mount.ts`: `iframe.setAttribute('srcdoc', page); ⏎` → `(empty)`; `src/host/mount.ts`: `el.append(iframe); ⏎` → `el.append(iframe); ⏎     iframe.setAttribute('srcdoc', page); ⏎` | rc 1, 2 failed \| 0 passed \| 18 skipped (20). "L3.H2 and L3.HB3: exactly one load before ready; a second load of the frame gives navigated once, with no remount"; "L3.HB3: per engine, the srcdoc is the first and only load before ready (Reference §11.1 step 7)". AssertionError: expected [ 'fallback' ] to deeply equal [ 'ready' ] | `src/host/mount.ts` 11723a58fbaf restored, equal |

```json
[
  {
    "id": "L3.HB3-a",
    "guard": "srcdoc before insertion: set srcdoc after insertion",
    "changes": [
      {
        "file": "src/host/mount.ts",
        "old": "    iframe.setAttribute('srcdoc', page);\n",
        "new": ""
      },
      {
        "file": "src/host/mount.ts",
        "old": "    el.append(iframe);\n",
        "new": "    el.append(iframe);\n    iframe.setAttribute('srcdoc', page);\n"
      }
    ],
    "rebuild": "none: the changed file is not a frame build input (the library and the tests run from source)",
    "command": "ulimit -u <threads+1500>; DOCREADER_BROWSERS=chromium timeout -k 10 600 ./node_modules/.bin/vitest run test/browser/host-frame.test.ts --maxWorkers=1 --fileParallelism=false -t \"L3.HB3\"",
    "threads": 1453,
    "rc": 1,
    "result": "2 failed | 0 passed | 18 skipped (20)",
    "failing": [
      "test/browser/host-frame.test.ts > chromium > L3.H2 and L3.HB3: exactly one load before ready; a second load of the frame gives navigated once, with no remount",
      "test/browser/host-frame.test.ts > chromium > L3.HB3: per engine, the srcdoc is the first and only load before ready (Reference §11.1 step 7)"
    ],
    "assertions": [
      "AssertionError: expected [ 'fallback' ] to deeply equal [ 'ready' ]",
      "AssertionError: expected [ 'fallback' ] to deeply equal [ 'ready' ]"
    ],
    "sha256": {
      "src/host/mount.ts": "11723a58fbaf90e84a2c0bae47ab47b6becbe826a0a40b9ec169f4a9fd3d93a5"
    },
    "generated": {},
    "restored": true
  }
]
```

## L3.HB4: a well-formed op on the parent's window has no effect (src/host/mount.ts)

M8.B5. The plan's row: a window message listener in the host that feeds the port's handler. The strays then act (a link, a hash, a copy, and the error's fallback).

| Row | Guard | Change | Result | Restore |
|---|---|---|---|---|
| L3.HB4-a | no window message listener in the host: add one that feeds the port handler | `src/host/mount.ts`: `port.onmessageerror = (): void => { ⏎` → `(win as unknown as Window).addEventListener('message', (e) => port.onmessage?.call(port, e as MessageEvent)); ⏎     port.onmessageerror = (): void => { ⏎` | rc 1, 1 failed \| 0 passed \| 19 skipped (20). "L3.HB4: well-formed ops posted to the parent's window have no effect; the link forwarded on the port after them does". AssertionError: expected [ [ 'ready', null ], …(4) ] to deeply equal [ [ 'ready', null ], …(1) ] | `src/host/mount.ts` 11723a58fbaf restored, equal |

```json
[
  {
    "id": "L3.HB4-a",
    "guard": "no window message listener in the host: add one that feeds the port handler",
    "changes": [
      {
        "file": "src/host/mount.ts",
        "old": "    port.onmessageerror = (): void => {\n",
        "new": "    (win as unknown as Window).addEventListener('message', (e) => port.onmessage?.call(port, e as MessageEvent));\n    port.onmessageerror = (): void => {\n"
      }
    ],
    "rebuild": "none: the changed file is not a frame build input (the library and the tests run from source)",
    "command": "ulimit -u <threads+1500>; DOCREADER_BROWSERS=chromium timeout -k 10 600 ./node_modules/.bin/vitest run test/browser/host-frame.test.ts --maxWorkers=1 --fileParallelism=false -t \"L3.HB4\"",
    "threads": 1450,
    "rc": 1,
    "result": "1 failed | 0 passed | 19 skipped (20)",
    "failing": [
      "test/browser/host-frame.test.ts > chromium > L3.HB4: well-formed ops posted to the parent's window have no effect; the link forwarded on the port after them does"
    ],
    "assertions": [
      "AssertionError: expected [ [ 'ready', null ], …(4) ] to deeply equal [ [ 'ready', null ], …(1) ]"
    ],
    "sha256": {
      "src/host/mount.ts": "11723a58fbaf90e84a2c0bae47ab47b6becbe826a0a40b9ec169f4a9fd3d93a5"
    },
    "generated": {},
    "restored": true
  }
]
```

## L3.HB5: no ready is a fallback (src/host/mount.ts)

Reference §11.5, ruling R7. The plan's row: treat a missing ready as success (the watchdog calls onReady).

| Row | Guard | Change | Result | Restore |
|---|---|---|---|---|
| L3.HB5-a | no ready is a fallback: treat a missing ready as success | `src/host/mount.ts`: `watchdog = win.setTimeout(() => fail('timeout'), c.watchdogMs); ⏎` → `watchdog = win.setTimeout(() => call('onReady'), c.watchdogMs); ⏎` | rc 1, 1 failed \| 0 passed \| 17 skipped (18). "L3.HB5: a page whose script-src is nonce-based blocks every frame script: no ready, onFallback('timeout') once, no frame left". AssertionError: expected [ [ 'ready', null ] ] to deeply equal [ [ 'fallback', 'timeout' ] ] | `src/host/mount.ts` 11723a58fbaf restored, equal |

```json
[
  {
    "id": "L3.HB5-a",
    "guard": "no ready is a fallback: treat a missing ready as success",
    "changes": [
      {
        "file": "src/host/mount.ts",
        "old": "    watchdog = win.setTimeout(() => fail('timeout'), c.watchdogMs);\n",
        "new": "    watchdog = win.setTimeout(() => call('onReady'), c.watchdogMs);\n"
      }
    ],
    "rebuild": "none: the changed file is not a frame build input (the library and the tests run from source)",
    "command": "ulimit -u <threads+1500>; DOCREADER_BROWSERS=chromium timeout -k 10 600 ./node_modules/.bin/vitest run test/browser/host-policy.test.ts --maxWorkers=1 --fileParallelism=false -t \"L3.HB5\"",
    "threads": 1469,
    "rc": 1,
    "result": "1 failed | 0 passed | 17 skipped (18)",
    "failing": [
      "test/browser/host-policy.test.ts > chromium > L3.HB5: a page whose script-src is nonce-based blocks every frame script: no ready, onFallback('timeout') once, no frame left"
    ],
    "assertions": [
      "AssertionError: expected [ [ 'ready', null ] ] to deeply equal [ [ 'fallback', 'timeout' ] ]"
    ],
    "sha256": {
      "src/host/mount.ts": "11723a58fbaf90e84a2c0bae47ab47b6becbe826a0a40b9ec169f4a9fd3d93a5"
    },
    "generated": {},
    "restored": true
  }
]
```

## L3.HB6: a blocked frame script ends in ready, error, fallback (src/frame-runtime/bootstrap.ts)

Reference §6.2 step 1, §11.5, FD19, C96(1). The plan's three rows, each rebuilt: drop the registration check (read as the check that turns "no enhance registered" into `FAILED('assets')`; without it the frame still errors, but with `render`, which the row reads in the frame); drop self-check (d) (the guard's hash missing then gives ready with no error); treat a missing Mermaid as no wait (the mutant goes on without Mermaid when the seed asks for it: ready, no error). The second and third are red through the progress wait giving up on the second event, an assertion.

| Row | Guard | Change | Result | Restore |
|---|---|---|---|---|
| L3.HB6-a | the registration check (no enhance registered: FAILED('assets')): drop it | `src/frame-runtime/bootstrap.ts`: `if (enhanceApi === null) { ⏎       fail('assets'); ⏎       return; ⏎     } ⏎` → `(empty)` | rc 1, 1 failed \| 2 passed \| 15 skipped (18). "L3.HB6: a page whose script-src lists the frame's hashes without enhance's hash: ready, then error (why 'assets' in the frame), then onFallback('error'), no frame left". AssertionError: expected [ { t: 'ready' }, …(1) ] to deeply equal [ { t: 'ready' }, …(1) ] | `src/frame-runtime/bootstrap.ts` 64a0c426ca5c restored, equal; the generated outputs restored, equal |
| L3.HB6-b | self-check (d), the guard ran: drop it | `src/frame-runtime/bootstrap.ts`: `fnToString.call(stopPropagation).indexOf('[native code]') === -1; ⏎` → `true; ⏎` | rc 1, 1 failed \| 2 passed \| 15 skipped (18). "L3.HB6: a page whose script-src lists the frame's hashes without the guard's hash: ready, then error (why 'boot' in the frame), then onFallback('error'), no frame left". AssertionError: HB6 boot: the adapters saw 1 of 2 events: expected true to be false // Object.is equality | `src/frame-runtime/bootstrap.ts` 64a0c426ca5c restored, equal; the generated outputs restored, equal |
| L3.HB6-c | a missing Mermaid is FAILED('mermaid'): treat it as no wait (go on without Mermaid) | `src/frame-runtime/bootstrap.ts`: `if (seed.mermaid !== null) { ⏎` → `if (seed.mermaid !== null && mermaidModule !== null) { ⏎` | rc 1, 1 failed \| 2 passed \| 15 skipped (18). "L3.HB6: a page whose script-src lists the frame's hashes without Mermaid's hash, on a document whose gate lets Mermaid in: ready, then error (why 'mermaid' in the frame), then onFallback('error'), no frame left". AssertionError: HB6 mermaid: the adapters saw 1 of 2 events: expected true to be false // Object.is equality | `src/frame-runtime/bootstrap.ts` 64a0c426ca5c restored, equal; the generated outputs restored, equal |

```json
[
  {
    "id": "L3.HB6-a",
    "guard": "the registration check (no enhance registered: FAILED('assets')): drop it",
    "changes": [
      {
        "file": "src/frame-runtime/bootstrap.ts",
        "old": "    if (enhanceApi === null) {\n      fail('assets');\n      return;\n    }\n",
        "new": ""
      }
    ],
    "rebuild": "node scripts/build-frame.mjs before the run; the generated outputs restored after it",
    "command": "ulimit -u <threads+1500>; DOCREADER_BROWSERS=chromium timeout -k 10 600 ./node_modules/.bin/vitest run test/browser/host-policy.test.ts --maxWorkers=1 --fileParallelism=false -t \"L3.HB6\"",
    "threads": 1454,
    "rc": 1,
    "result": "1 failed | 2 passed | 15 skipped (18)",
    "failing": [
      "test/browser/host-policy.test.ts > chromium > L3.HB6: a page whose script-src lists the frame's hashes without enhance's hash: ready, then error (why 'assets' in the frame), then onFallback('error'), no frame left"
    ],
    "assertions": [
      "AssertionError: expected [ { t: 'ready' }, …(1) ] to deeply equal [ { t: 'ready' }, …(1) ]"
    ],
    "sha256": {
      "src/frame-runtime/bootstrap.ts": "64a0c426ca5cd8d61968c951b99484f0c86d14c736ccd38c0c0acbef490ee8a2"
    },
    "generated": {
      "assets/assets.json": "0ff290c4762f909013912d5cedada95106f39cee61e2398b36e598fed636084d",
      "src/frame/manifest.generated.ts": "7efe6c75a2d51cd423c8682391fe28197110ac41c4997adce2b36d0b40d36cbb",
      "assets/frame/guard.js": "ff3c25da5703bc06d40ca0412b2e760c619a73a4153306f4d0f3b662bda65c4d",
      "assets/frame/bootstrap.js": "7660d62d5edc48db520205fd2d24041f409b35270b2739d5f43497abef06310c",
      "assets/frame/enhance.js": "0079625cc30a573a36959fbf93573d5ca50ec2cd6e2541391517db6ccaaf2929",
      "assets/frame/reader.css": "99c87d57f9e2a944e2cec431705e5aa6004a4daf9af9738b32e1ed9d45a97489",
      "assets/mermaid/mermaid.frame.js": "7585b2055ba386b9acff71b9c8a0c40b36dec79c2106a4aa56048c8fe59832c3",
      "assets/mermaid/mermaid.mjs": "dfba66fc5c75e030c35bf16d5e7a62bbee7be5496cabec94ec93f85d626b38df"
    },
    "restored": true
  },
  {
    "id": "L3.HB6-b",
    "guard": "self-check (d), the guard ran: drop it",
    "changes": [
      {
        "file": "src/frame-runtime/bootstrap.ts",
        "old": "      fnToString.call(stopPropagation).indexOf('[native code]') === -1;\n",
        "new": "      true;\n"
      }
    ],
    "rebuild": "node scripts/build-frame.mjs before the run; the generated outputs restored after it",
    "command": "ulimit -u <threads+1500>; DOCREADER_BROWSERS=chromium timeout -k 10 600 ./node_modules/.bin/vitest run test/browser/host-policy.test.ts --maxWorkers=1 --fileParallelism=false -t \"L3.HB6\"",
    "threads": 1453,
    "rc": 1,
    "result": "1 failed | 2 passed | 15 skipped (18)",
    "failing": [
      "test/browser/host-policy.test.ts > chromium > L3.HB6: a page whose script-src lists the frame's hashes without the guard's hash: ready, then error (why 'boot' in the frame), then onFallback('error'), no frame left"
    ],
    "assertions": [
      "AssertionError: HB6 boot: the adapters saw 1 of 2 events: expected true to be false // Object.is equality"
    ],
    "sha256": {
      "src/frame-runtime/bootstrap.ts": "64a0c426ca5cd8d61968c951b99484f0c86d14c736ccd38c0c0acbef490ee8a2"
    },
    "generated": {
      "assets/assets.json": "0ff290c4762f909013912d5cedada95106f39cee61e2398b36e598fed636084d",
      "src/frame/manifest.generated.ts": "7efe6c75a2d51cd423c8682391fe28197110ac41c4997adce2b36d0b40d36cbb",
      "assets/frame/guard.js": "ff3c25da5703bc06d40ca0412b2e760c619a73a4153306f4d0f3b662bda65c4d",
      "assets/frame/bootstrap.js": "7660d62d5edc48db520205fd2d24041f409b35270b2739d5f43497abef06310c",
      "assets/frame/enhance.js": "0079625cc30a573a36959fbf93573d5ca50ec2cd6e2541391517db6ccaaf2929",
      "assets/frame/reader.css": "99c87d57f9e2a944e2cec431705e5aa6004a4daf9af9738b32e1ed9d45a97489",
      "assets/mermaid/mermaid.frame.js": "7585b2055ba386b9acff71b9c8a0c40b36dec79c2106a4aa56048c8fe59832c3",
      "assets/mermaid/mermaid.mjs": "dfba66fc5c75e030c35bf16d5e7a62bbee7be5496cabec94ec93f85d626b38df"
    },
    "restored": true
  },
  {
    "id": "L3.HB6-c",
    "guard": "a missing Mermaid is FAILED('mermaid'): treat it as no wait (go on without Mermaid)",
    "changes": [
      {
        "file": "src/frame-runtime/bootstrap.ts",
        "old": "    if (seed.mermaid !== null) {\n",
        "new": "    if (seed.mermaid !== null && mermaidModule !== null) {\n"
      }
    ],
    "rebuild": "node scripts/build-frame.mjs before the run; the generated outputs restored after it",
    "command": "ulimit -u <threads+1500>; DOCREADER_BROWSERS=chromium timeout -k 10 600 ./node_modules/.bin/vitest run test/browser/host-policy.test.ts --maxWorkers=1 --fileParallelism=false -t \"L3.HB6\"",
    "threads": 1499,
    "rc": 1,
    "result": "1 failed | 2 passed | 15 skipped (18)",
    "failing": [
      "test/browser/host-policy.test.ts > chromium > L3.HB6: a page whose script-src lists the frame's hashes without Mermaid's hash, on a document whose gate lets Mermaid in: ready, then error (why 'mermaid' in the frame), then onFallback('error'), no frame left"
    ],
    "assertions": [
      "AssertionError: HB6 mermaid: the adapters saw 1 of 2 events: expected true to be false // Object.is equality"
    ],
    "sha256": {
      "src/frame-runtime/bootstrap.ts": "64a0c426ca5cd8d61968c951b99484f0c86d14c736ccd38c0c0acbef490ee8a2"
    },
    "generated": {
      "assets/assets.json": "0ff290c4762f909013912d5cedada95106f39cee61e2398b36e598fed636084d",
      "src/frame/manifest.generated.ts": "7efe6c75a2d51cd423c8682391fe28197110ac41c4997adce2b36d0b40d36cbb",
      "assets/frame/guard.js": "ff3c25da5703bc06d40ca0412b2e760c619a73a4153306f4d0f3b662bda65c4d",
      "assets/frame/bootstrap.js": "7660d62d5edc48db520205fd2d24041f409b35270b2739d5f43497abef06310c",
      "assets/frame/enhance.js": "0079625cc30a573a36959fbf93573d5ca50ec2cd6e2541391517db6ccaaf2929",
      "assets/frame/reader.css": "99c87d57f9e2a944e2cec431705e5aa6004a4daf9af9738b32e1ed9d45a97489",
      "assets/mermaid/mermaid.frame.js": "7585b2055ba386b9acff71b9c8a0c40b36dec79c2106a4aa56048c8fe59832c3",
      "assets/mermaid/mermaid.mjs": "dfba66fc5c75e030c35bf16d5e7a62bbee7be5496cabec94ec93f85d626b38df"
    },
    "restored": true
  }
]
```

## L3.HB7: a blocked style, font or image ends in ready, error, fallback (src/frame-runtime/bootstrap.ts)

Reference §6.1 step 5, §6.2 step 5, §11.5. The plan's row: drop the `securitypolicyviolation` listener (all three HB7 rows red). The plan's equivalent mutant: drop the face probe, green, as P-4 predicts.

| Row | Guard | Change | Result | Restore |
|---|---|---|---|---|
| L3.HB7-a | the securitypolicyviolation listener: drop it | `src/frame-runtime/bootstrap.ts`: `add.call(doc, 'securitypolicyviolation', onViolation, true); ⏎` → `void onViolation; ⏎` | rc 1, 3 failed \| 0 passed \| 15 skipped (18). "L3.HB7: a page that allows the four hashes but sets style-src 'self': ready, then error, then onFallback('error'), no frame left"; "L3.HB7: a page that allows the four hashes but sets font-src 'self': ready, then error, then onFallback('error'), no frame left"; "L3.HB7: a page that allows the four hashes but sets img-src 'self', on a document with an image: ready, then error, then onFallback('error'), no frame left". AssertionError: HB7 style-src 'self': the adapters saw 1 of 2 events: expected true to be false // Object.is equality | `src/frame-runtime/bootstrap.ts` 64a0c426ca5c restored, equal; the generated outputs restored, equal |
| L3.HB7-e | the face probe: drop it (recorded as equivalent while L2 loads the regular faces at start, P-4) | `src/frame-runtime/bootstrap.ts`: `await probeFaces(set === null \|\| set === undefined \|\| loadFaces === undefined ? null : { load: (f: string) => loadFaces.call(set, f) }, FACES, FONT_WAIT_MS); ⏎` → `void probeFaces; void set; void loadFaces; void FACES; void FONT_WAIT_MS; ⏎` | rc 0, 0 failed \| 3 passed \| 15 skipped (18) | `src/frame-runtime/bootstrap.ts` 64a0c426ca5c restored, equal; the generated outputs restored, equal |

**L3.HB7-e is an equivalent mutant** (the plan: "Recorded as equivalent, not green"; P-4). Without the face probe the `font-src 'self'` row stays green: L2's own font wait (`src/enhance/relayout.ts`, through `env.fonts`) loads the regular faces before `enhance()` resolves, so the blocked `data:` font raises its violation before ready all the same. L3.M21 pins the probe at unit level (Task 5); the probe stays.

```json
[
  {
    "id": "L3.HB7-a",
    "guard": "the securitypolicyviolation listener: drop it",
    "changes": [
      {
        "file": "src/frame-runtime/bootstrap.ts",
        "old": "  add.call(doc, 'securitypolicyviolation', onViolation, true);\n",
        "new": "  void onViolation;\n"
      }
    ],
    "rebuild": "node scripts/build-frame.mjs before the run; the generated outputs restored after it",
    "command": "ulimit -u <threads+1500>; DOCREADER_BROWSERS=chromium timeout -k 10 600 ./node_modules/.bin/vitest run test/browser/host-policy.test.ts --maxWorkers=1 --fileParallelism=false -t \"L3.HB7\"",
    "threads": 1546,
    "rc": 1,
    "result": "3 failed | 0 passed | 15 skipped (18)",
    "failing": [
      "test/browser/host-policy.test.ts > chromium > L3.HB7: a page that allows the four hashes but sets style-src 'self': ready, then error, then onFallback('error'), no frame left",
      "test/browser/host-policy.test.ts > chromium > L3.HB7: a page that allows the four hashes but sets font-src 'self': ready, then error, then onFallback('error'), no frame left",
      "test/browser/host-policy.test.ts > chromium > L3.HB7: a page that allows the four hashes but sets img-src 'self', on a document with an image: ready, then error, then onFallback('error'), no frame left"
    ],
    "assertions": [
      "AssertionError: HB7 style-src 'self': the adapters saw 1 of 2 events: expected true to be false // Object.is equality",
      "AssertionError: HB7 font-src 'self': the adapters saw 1 of 2 events: expected true to be false // Object.is equality",
      "AssertionError: HB7 img-src 'self': the adapters saw 1 of 2 events: expected true to be false // Object.is equality"
    ],
    "sha256": {
      "src/frame-runtime/bootstrap.ts": "64a0c426ca5cd8d61968c951b99484f0c86d14c736ccd38c0c0acbef490ee8a2"
    },
    "generated": {
      "assets/assets.json": "0ff290c4762f909013912d5cedada95106f39cee61e2398b36e598fed636084d",
      "src/frame/manifest.generated.ts": "7efe6c75a2d51cd423c8682391fe28197110ac41c4997adce2b36d0b40d36cbb",
      "assets/frame/guard.js": "ff3c25da5703bc06d40ca0412b2e760c619a73a4153306f4d0f3b662bda65c4d",
      "assets/frame/bootstrap.js": "7660d62d5edc48db520205fd2d24041f409b35270b2739d5f43497abef06310c",
      "assets/frame/enhance.js": "0079625cc30a573a36959fbf93573d5ca50ec2cd6e2541391517db6ccaaf2929",
      "assets/frame/reader.css": "99c87d57f9e2a944e2cec431705e5aa6004a4daf9af9738b32e1ed9d45a97489",
      "assets/mermaid/mermaid.frame.js": "7585b2055ba386b9acff71b9c8a0c40b36dec79c2106a4aa56048c8fe59832c3",
      "assets/mermaid/mermaid.mjs": "dfba66fc5c75e030c35bf16d5e7a62bbee7be5496cabec94ec93f85d626b38df"
    },
    "restored": true
  },
  {
    "id": "L3.HB7-e",
    "guard": "the face probe: drop it (recorded as equivalent while L2 loads the regular faces at start, P-4)",
    "changes": [
      {
        "file": "src/frame-runtime/bootstrap.ts",
        "old": "    await probeFaces(set === null || set === undefined || loadFaces === undefined ? null : { load: (f: string) => loadFaces.call(set, f) }, FACES, FONT_WAIT_MS);\n",
        "new": "    void probeFaces; void set; void loadFaces; void FACES; void FONT_WAIT_MS;\n"
      }
    ],
    "rebuild": "node scripts/build-frame.mjs before the run; the generated outputs restored after it",
    "command": "ulimit -u <threads+1500>; DOCREADER_BROWSERS=chromium timeout -k 10 600 ./node_modules/.bin/vitest run test/browser/host-policy.test.ts --maxWorkers=1 --fileParallelism=false -t \"L3.HB7\"",
    "threads": 1532,
    "rc": 0,
    "result": "0 failed | 3 passed | 15 skipped (18)",
    "failing": [],
    "assertions": [],
    "sha256": {
      "src/frame-runtime/bootstrap.ts": "64a0c426ca5cd8d61968c951b99484f0c86d14c736ccd38c0c0acbef490ee8a2"
    },
    "generated": {
      "assets/assets.json": "0ff290c4762f909013912d5cedada95106f39cee61e2398b36e598fed636084d",
      "src/frame/manifest.generated.ts": "7efe6c75a2d51cd423c8682391fe28197110ac41c4997adce2b36d0b40d36cbb",
      "assets/frame/guard.js": "ff3c25da5703bc06d40ca0412b2e760c619a73a4153306f4d0f3b662bda65c4d",
      "assets/frame/bootstrap.js": "7660d62d5edc48db520205fd2d24041f409b35270b2739d5f43497abef06310c",
      "assets/frame/enhance.js": "0079625cc30a573a36959fbf93573d5ca50ec2cd6e2541391517db6ccaaf2929",
      "assets/frame/reader.css": "99c87d57f9e2a944e2cec431705e5aa6004a4daf9af9738b32e1ed9d45a97489",
      "assets/mermaid/mermaid.frame.js": "7585b2055ba386b9acff71b9c8a0c40b36dec79c2106a4aa56048c8fe59832c3",
      "assets/mermaid/mermaid.mjs": "dfba66fc5c75e030c35bf16d5e7a62bbee7be5496cabec94ec93f85d626b38df"
    },
    "restored": true
  }
]
```

## L3.HB1: the battery's control (test/browser/host-frame.test.ts)

M8.B1. The plan's row: the control keeps the `csp` attribute. On Chromium the attribute is a second enforced policy (P-9), so the control reaches nothing and the row refuses it as vacuous (fewer than 20). On WebKit the attribute is not implemented, so this mutant is a Chromium measurement only.

| Row | Guard | Change | Result | Restore |
|---|---|---|---|---|
| L3.HB1-a | the control binds no policy of its own: keep the csp attribute (the row must refuse the control as vacuous) | `test/browser/host-frame.test.ts`: `await host.mount(srcdoc.slice(meta.length), policy, { hello: 'none', cspAttribute: false }); ⏎` → `await host.mount(srcdoc.slice(meta.length), policy, { hello: 'none' }); ⏎` | rc 1, 1 failed \| 0 passed \| 19 skipped (20). "L3.HB1 control: the same srcdoc without its policy meta, in a bare iframe with sandbox="allow-scripts" and no csp attribute, reaches B on at least 20 of the 27 channels". AssertionError: expected 0 to be greater than or equal to 20 | `test/browser/host-frame.test.ts` 6f56a270a976 restored, equal |
| L3.HB1-b | the mounted battery ran: its attempts never reach the frame (every evaluate rejects) | `test/browser/host-frame.test.ts`: `const thrown = await attemptAll(host.frame()); ⏎       const probed` → `const thrown = await attemptAll({ evaluate: () => Promise.reject(new Error('no frame')) }); ⏎       const probed` | rc 1, 1 failed \| 0 passed \| 19 skipped (20). "L3.HB1: the exfiltration battery reaches nothing, at origin B or A, from a frame mounted through mountDocFrame". AssertionError: expected [ 'fetch: evaluate: no frame', …(53) ] to deeply equal [] | `test/browser/host-frame.test.ts` 6f56a270a976 restored, equal |
| L3.HB1-c | the mounted battery's window closes after its barrier: drop the probe | `test/browser/host-frame.test.ts`: `const probed = await attemptAll(host.page.mainFrame(), (c) => (PROBE_SKIP.includes(c.slug) ? [] : [urlProbe(c)])); ⏎` → `const probed = {}; ⏎` | rc 1, 1 failed \| 0 passed \| 19 skipped (20). "L3.HB1: the exfiltration battery reaches nothing, at origin B or A, from a frame mounted through mountDocFrame". AssertionError: expected 0 to be greater than or equal to 20 | `test/browser/host-frame.test.ts` 6f56a270a976 restored, equal |

L3.HB1-b and L3.HB1-c come from the review's fix round. L3.HB1-b: every attempt of the mounted battery fails to reach the frame (an evaluate that rejects, as a missing frame gives); the row used to read that as 0 of 27 leaks, and now refuses it because no attempt answered 'ok' or an exception its channel lists. L3.HB1-c: the probe from the page's main frame dropped; the quiet window then has no barrier, and the row refuses it (the probe reached fewer than 20 channels).

```json
[
  {
    "id": "L3.HB1-a",
    "guard": "the control binds no policy of its own: keep the csp attribute (the row must refuse the control as vacuous)",
    "changes": [
      {
        "file": "test/browser/host-frame.test.ts",
        "old": "      await host.mount(srcdoc.slice(meta.length), policy, { hello: 'none', cspAttribute: false });\n",
        "new": "      await host.mount(srcdoc.slice(meta.length), policy, { hello: 'none' });\n"
      }
    ],
    "rebuild": "none: the changed file is not a frame build input (the library and the tests run from source)",
    "command": "ulimit -u <threads+1500>; DOCREADER_BROWSERS=chromium timeout -k 10 600 ./node_modules/.bin/vitest run test/browser/host-frame.test.ts --maxWorkers=1 --fileParallelism=false -t \"L3.HB1 control\"",
    "threads": 1464,
    "rc": 1,
    "result": "1 failed | 0 passed | 19 skipped (20)",
    "failing": [
      "test/browser/host-frame.test.ts > chromium > L3.HB1 control: the same srcdoc without its policy meta, in a bare iframe with sandbox=\"allow-scripts\" and no csp attribute, reaches B on at least 20 of the 27 channels"
    ],
    "assertions": [
      "AssertionError: expected 0 to be greater than or equal to 20"
    ],
    "sha256": {
      "test/browser/host-frame.test.ts": "6f56a270a9762276033f8b465dca5688eaabe4ccd2e254d37ce3858eaaaa27b0"
    },
    "generated": {},
    "restored": true
  },
  {
    "id": "L3.HB1-b",
    "guard": "the mounted battery ran: its attempts never reach the frame (every evaluate rejects)",
    "changes": [
      {
        "file": "test/browser/host-frame.test.ts",
        "old": "      const thrown = await attemptAll(host.frame());\n      const probed",
        "new": "      const thrown = await attemptAll({ evaluate: () => Promise.reject(new Error('no frame')) });\n      const probed"
      }
    ],
    "rebuild": "none: the changed file is not a frame build input (the library and the tests run from source)",
    "command": "ulimit -u <threads+1500>; DOCREADER_BROWSERS=chromium timeout -k 10 600 ./node_modules/.bin/vitest run test/browser/host-frame.test.ts --maxWorkers=1 --fileParallelism=false -t \"L3.HB1: the exfiltration\"",
    "threads": 1483,
    "rc": 1,
    "result": "1 failed | 0 passed | 19 skipped (20)",
    "failing": [
      "test/browser/host-frame.test.ts > chromium > L3.HB1: the exfiltration battery reaches nothing, at origin B or A, from a frame mounted through mountDocFrame"
    ],
    "assertions": [
      "AssertionError: expected [ 'fetch: evaluate: no frame', …(53) ] to deeply equal []"
    ],
    "sha256": {
      "test/browser/host-frame.test.ts": "6f56a270a9762276033f8b465dca5688eaabe4ccd2e254d37ce3858eaaaa27b0"
    },
    "generated": {},
    "restored": true
  },
  {
    "id": "L3.HB1-c",
    "guard": "the mounted battery's window closes after its barrier: drop the probe",
    "changes": [
      {
        "file": "test/browser/host-frame.test.ts",
        "old": "      const probed = await attemptAll(host.page.mainFrame(), (c) => (PROBE_SKIP.includes(c.slug) ? [] : [urlProbe(c)]));\n",
        "new": "      const probed = {};\n"
      }
    ],
    "rebuild": "none: the changed file is not a frame build input (the library and the tests run from source)",
    "command": "ulimit -u <threads+1500>; DOCREADER_BROWSERS=chromium timeout -k 10 600 ./node_modules/.bin/vitest run test/browser/host-frame.test.ts --maxWorkers=1 --fileParallelism=false -t \"L3.HB1: the exfiltration\"",
    "threads": 1432,
    "rc": 1,
    "result": "1 failed | 0 passed | 19 skipped (20)",
    "failing": [
      "test/browser/host-frame.test.ts > chromium > L3.HB1: the exfiltration battery reaches nothing, at origin B or A, from a frame mounted through mountDocFrame"
    ],
    "assertions": [
      "AssertionError: expected 0 to be greater than or equal to 20"
    ],
    "sha256": {
      "test/browser/host-frame.test.ts": "6f56a270a9762276033f8b465dca5688eaabe4ccd2e254d37ce3858eaaaa27b0"
    },
    "generated": {},
    "restored": true
  }
]
```

## L3.HB2: the control's evidence (test/browser/host-frame.test.ts)

From the review's fix round. The control's frame no longer navigates the top (the assignment removed): the row used to read any answer but a throw as a navigation, and now waits for the top navigation's request in the route log, which never comes.

| Row | Guard | Change | Result | Restore |
|---|---|---|---|---|
| L3.HB2-a | the HB2 control's evidence is the top navigation's request: the control's frame never navigates the top | `test/browser/host-frame.test.ts`: `(top as Window).location.href = 'https://b.docreader.test/hb2-top'; ⏎             return false; ⏎` → `return false; ⏎` | rc 1, 1 failed \| 0 passed \| 19 skipped (20). "L3.HB2 control: a bare iframe with allow-popups and allow-top-navigation opens the window and sets the location". AssertionError: the top navigation request reached the route log: expected false to be true // Object.is equality | `test/browser/host-frame.test.ts` 6f56a270a976 restored, equal |

```json
[
  {
    "id": "L3.HB2-a",
    "guard": "the HB2 control's evidence is the top navigation's request: the control's frame never navigates the top",
    "changes": [
      {
        "file": "test/browser/host-frame.test.ts",
        "old": "            (top as Window).location.href = 'https://b.docreader.test/hb2-top';\n            return false;\n",
        "new": "            return false;\n"
      }
    ],
    "rebuild": "none: the changed file is not a frame build input (the library and the tests run from source)",
    "command": "ulimit -u <threads+1500>; DOCREADER_BROWSERS=chromium timeout -k 10 600 ./node_modules/.bin/vitest run test/browser/host-frame.test.ts --maxWorkers=1 --fileParallelism=false -t \"L3.HB2 control\"",
    "threads": 1459,
    "rc": 1,
    "result": "1 failed | 0 passed | 19 skipped (20)",
    "failing": [
      "test/browser/host-frame.test.ts > chromium > L3.HB2 control: a bare iframe with allow-popups and allow-top-navigation opens the window and sets the location"
    ],
    "assertions": [
      "AssertionError: the top navigation request reached the route log: expected false to be true // Object.is equality"
    ],
    "sha256": {
      "test/browser/host-frame.test.ts": "6f56a270a9762276033f8b465dca5688eaabe4ccd2e254d37ce3858eaaaa27b0"
    },
    "generated": {},
    "restored": true
  }
]
```

## Recorded, not mutated

- **L3.HB1** (the battery itself): on Chromium the frame mounted through `mountDocFrame` reached 0 of 27 channels, at origin B and at origin A; every attempt ran (each answered 'ok', or `SecurityError` for `worker`, `sharedworker` and `serviceworker`). The control reached B on 23 of 27 (`fetch`, `xhr`, `beacon`, `websocket`, `eventsource`, `import`, `script`, `img`, `srcset`, `picture`, `video`, `poster`, `audio`, `track`, `iframe`, `object`, `embed`, `stylesheet`, `prefetch`, `preload`, `background`, `import-rule`, `font-face`), and the barrier probe from the page's main frame reached the same 23. The four the control cannot reach without the meta: `worker`, `sharedworker` and `serviceworker` throw `SecurityError` in an opaque origin, and the sandbox (no `allow-forms`) blocks the form. `track` now carries `crossOrigin` on its video: without it Chromium fetches a text track only from the frame's own origin, which no URL is from an opaque origin's, so the control reached it 0 times (the round before the fix measured `track` missed) and the mounted row's 0 proved nothing for it. WebKit's figures come from CI (`grep 'host-figure: HB1'`).
- **L3.HB2** has a control row (a bare iframe with `allow-popups` and `allow-top-navigation`: the popup's and the top navigation's requests both reach the route log) and no mutation row in the plan; L3.H1-a covers the sandbox token list, and L3.HB2-a the control's evidence.
- **L3.HB3**'s figure: one load before ready on Chromium (`host-figure: HB3 chromium loadsBeforeReady=1`); WebKit's from CI.
- **L3.D5, host half**: no mutation row in the plan; `test/host-mount.test.ts` pins that `mermaidDraw: 'on-request'` seeds `draw: 'on-request'` and that its absence seeds `'auto'`.
