# L3 Task 5: mutation rows (the frame runtime: guard, bootstrap, content, adapters, outbox, pins)

Each guard of Task 5, changed once, with the tests that go red: the outbox (`src/frame-runtime/outbox.ts`), the walls of the frame runtime and its built scripts (`test/frame-runtime-walls.test.ts`), the face probe (`fonts.ts`), the free-global pin (`pin.ts`), and the bootstrap, guard, content and adapters through the browser rows (`test/browser/frame-boot.test.ts`, Chromium). Measured 2026-10-27 (UTC) on branch `l3-t05-frame-runtime` (base `8f29f1b`, the Task 5 changes not yet committed), on the final code and test files.

**Result.** 66 rows: 64 red and 2 green, each green named and explained below (L3.B3d, L3.B7g). The review's fix round re-measured 19 of these rows and added 13 (section "Fix round" at the end, which supersedes the entries above for the rows it names): its measurement found L3.B6a's red timing-dependent (see there). The last section, "Coordinator ruling: L3.B6a deterministic", supersedes every earlier L3.B6a entry: with the reader's drawing state read in the frame at the instant it posts ready, L3.B6a was red in each of its five runs. Every red row exits 1 through failing assertions only (every failing test failed with an `AssertionError`; none through a file that failed to load, an unhandled error or a timeout).

**Method** (Global Constraints, "Low disk"; C69, C75). One row at a time, in place in the task's own worktree, never in parallel and never in a copy of the repository. For each row: the original bytes of each file it changes, and for a rebuilding row the generated outputs (`assets/assets.json`, `src/frame/manifest.generated.ts`, `assets/frame/{guard,bootstrap,enhance}.js`), and their sha256 were saved outside the worktree; each `old` was checked to occur exactly once and replaced by `new`; a browser row rebuilt the frame (`node scripts/build-frame.mjs`); the thread count was measured (`ps -L -u "$(id -u)" --no-headers | wc -l`, 2299 to 2639 over the runs) and the row ran as `ulimit -u <threads + 1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 [-t <rows>] <tests>`, its output captured to a log; every saved file was then restored from the saved bytes and its sha256 checked equal (never `git checkout`). Every restore matched; after the last row `sha256sum -c` over the Task 5 sources, tests and generated outputs matched the hashes taken before the first, and `node scripts/build-frame.mjs --check` was green after every batch. The Red column gives the count line and the failing tests (at most five). In the Change column a line break is shown as ⏎; the JSON fence holds the exact text.

Notes on the measurement.
- **L3.B3d is the plan's recorded equivalent mutant (P-6):** reading the seed with `querySelector('script[type="application/json"]')` in Phase S leaves every `L3.B` row green, because in Phase S no authored node exists, so the selector finds the seed itself. Recorded, not counted red; "read the seed by id" (L3.B3a) is its own red row.
- **L3.B7g is red on WebKit only (P-13), and unmeasured locally:** moving `preventDefault` after the button check leaves auxclicks of buttons 2 to 4 unprevented, which Chromium does not follow, so every Chromium row stays green; WebKit follows them in place, which the "P6 other buttons" row catches (the prototype's CI runs). WebKit cannot start locally (C69), so this row's red is CI's to show; it is recorded green here, never as passing.
- **Rows that needed a test before they could go red.** L3.B3b (content inserted before the scripts) stayed green against every clobbering row: with Task 5's empty pin list no script reads an inherited global at evaluation, so early content changes nothing they see. A row that times the root's append with the opt-in `measure` init script ("no authored node exists while a script evaluates") makes it red. L3.B6a (ready on enhance resolve) stayed green against the three-figure set, which draws within the face probe; a set of 16 forty-node flowcharts, timed with the opt-in `observeDiagrams` init script, makes it red. L3.B3c (registration without the position check) needed the impostor row (enhance blocked, a script at Mermaid's position registering as enhance). L3.M22b needed the source-order row (the bootstrap calls the pin once, in Phase S). The first runs of L3.B7a, L3.B7c to L3.B7e failed partly by Playwright timeouts (a navigated frame loses the next link); each click now asserts the frame's one load right after it (`stays`), so the reds are assertions.
- **The outbox's 64-entry cap is not a row:** with the coalescing (8 store keys, one navigate, version, hash and changes, at most 4 copies) the queue holds at most 16 entries, so dropping the cap is unreachable from any input (C86 (3)); the cap is kept and a unit row pins only that the flush still sends everything queued.

## The outbox: `src/frame-runtime/outbox.ts` (L3.M12a to L3.M12d)

Reference §8.1, §8.4 and §6.5. The plan's four rows: the pacer as a 16/s bucket with a burst of 32, the flush unpaced, copy queued behind store.set, the terminal timeout dropped. Each is red through L3.M12's random runs (`test/frame-outbox.test.ts`, three seeds of 10,000 calls) and through the unit rows of the pacer, the copy share and the changes slot.

| Row | Guard | Change | Red | Restore |
|---|---|---|---|---|
| L3.M12a | the pacer as a 16/s bucket with a burst of 32 (not a sliding window) | `src/frame-runtime/outbox.ts`: `  let pacerTimer: unknown;` → `  let pacerTimer: unknown; ⏎   let bucket = 32; ⏎   let bucketAt = clock.now();`<br>`src/frame-runtime/outbox.ts`: `      let wait = 0; ⏎       if (recent(sentOther, now) >= otherMax) wait = Math.max(wait, (sentOther[sentOther.length - otherMax] as number) + L.frameWindowMs + 1 - now); ⏎       if (isStore && recent(sentStore, now) >= L.frameStoreSetMaxPerWindow) { ⏎         wait = Math.max(wait, (sentStore[sentStore.length - L.frameStoreSetMaxPerWindow] as number) + L.frameWindowMs + 1 - now); ⏎       }` → `      bucket = Math.min(32, bucket + ((now - bucketAt) * 16) / 1000); ⏎       bucketAt = now; ⏎       const wait = bucket >= 1 ? 0 * Number(isStore) : Math.ceil(((1 - bucket) * 1000) / 16); ⏎       if (wait === 0) bucket -= 1;` | `test/frame-outbox.test.ts`: 4 failed | 11 passed (15). "sends at most 12 ops that are not copies in any 1000 ms, holding the next until the oldest is more than 1000 ms old"; "seed 1: 0 refusals from the token buckets and from a strict 20/10 sliding window; no 1000 ms holds more than 16 messages or 8 store.set; a copy is never delayed; every changes ends exactly once"; "seed 2: 0 refusals from the token buckets and from a strict 20/10 sliding window; no 1000 ms holds more than 16 messages or 8 store.set; a copy is never delayed; every changes ends exactly once"; "seed 3: 0 refusals from the token buckets and from a strict 20/10 sliding window; no 1000 ms holds more than 16 messages or 8 store.set; a copy is never delayed; every changes ends exactly once" | `src/frame-runtime/outbox.ts` sha256 `af79ea70f71e…` restored, equal |
| L3.M12b | flush unpaced: the queue posted at once on open(), outside the pacer and its records | `src/frame-runtime/outbox.ts`: `        else if (e.kind === 'changes' \|\| e.op.t === 'hash' \|\| e.op.t === 'store.set') enqueue(e); ⏎         else lead(lanes[e.op.t], e.op);` → `        else if (e.kind === 'changes') enqueue(e); ⏎         else post(e.op);` | `test/frame-outbox.test.ts`: 2 failed | 13 passed (15). "seed 1: 0 refusals from the token buckets and from a strict 20/10 sliding window; no 1000 ms holds more than 16 messages or 8 store.set; a copy is never delayed; every changes ends exactly once"; "seed 2: 0 refusals from the token buckets and from a strict 20/10 sliding window; no 1000 ms holds more than 16 messages or 8 store.set; a copy is never delayed; every changes ends exactly once" | `src/frame-runtime/outbox.ts` sha256 `af79ea70f71e…` restored, equal |
| L3.M12c | copy queued behind store.set: a copy waits in the pacer's line | `src/frame-runtime/outbox.ts`: `      postEntry({ kind: 'copy', text }, now); ⏎       return true;` → `      line.push({ kind: 'copy', text }); ⏎       pump(); ⏎       return true;` | `test/frame-outbox.test.ts`: 4 failed | 11 passed (15). "a store.set burst never delays a copy: the copy is posted at the instant it is asked for"; "seed 1: 0 refusals from the token buckets and from a strict 20/10 sliding window; no 1000 ms holds more than 16 messages or 8 store.set; a copy is never delayed; every changes ends exactly once"; "seed 2: 0 refusals from the token buckets and from a strict 20/10 sliding window; no 1000 ms holds more than 16 messages or 8 store.set; a copy is never delayed; every changes ends exactly once"; "seed 3: 0 refusals from the token buckets and from a strict 20/10 sliding window; no 1000 ms holds more than 16 messages or 8 store.set; a copy is never delayed; every changes ends exactly once" | `src/frame-runtime/outbox.ts` sha256 `af79ea70f71e…` restored, equal |
| L3.M12d | drop the terminal timeout: a sent changes left unanswered never ends | `src/frame-runtime/outbox.ts`: `      req.timer = clock.setTimeout(() => { ⏎         req.timer = undefined; ⏎         if (current !== req) return; ⏎         end(req, null); ⏎         advance(); ⏎       }, L.frameChangesTimeoutMs); ⏎ ` → (removed) | `test/frame-outbox.test.ts`: 4 failed | 11 passed (15). "a sent request unanswered after 35 s resolves null and frees the slot for the queued one"; "seed 1: 0 refusals from the token buckets and from a strict 20/10 sliding window; no 1000 ms holds more than 16 messages or 8 store.set; a copy is never delayed; every changes ends exactly once"; "seed 2: 0 refusals from the token buckets and from a strict 20/10 sliding window; no 1000 ms holds more than 16 messages or 8 store.set; a copy is never delayed; every changes ends exactly once"; "seed 3: 0 refusals from the token buckets and from a strict 20/10 sliding window; no 1000 ms holds more than 16 messages or 8 store.set; a copy is never delayed; every changes ends exactly once" | `src/frame-runtime/outbox.ts` sha256 `af79ea70f71e…` restored, equal |

```json
[
  {
    "id": "L3.M12a",
    "guard": "the pacer as a 16/s bucket with a burst of 32 (not a sliding window)",
    "changes": [
      {
        "file": "src/frame-runtime/outbox.ts",
        "old": "  let pacerTimer: unknown;",
        "new": "  let pacerTimer: unknown;\n  let bucket = 32;\n  let bucketAt = clock.now();"
      },
      {
        "file": "src/frame-runtime/outbox.ts",
        "old": "      let wait = 0;\n      if (recent(sentOther, now) >= otherMax) wait = Math.max(wait, (sentOther[sentOther.length - otherMax] as number) + L.frameWindowMs + 1 - now);\n      if (isStore && recent(sentStore, now) >= L.frameStoreSetMaxPerWindow) {\n        wait = Math.max(wait, (sentStore[sentStore.length - L.frameStoreSetMaxPerWindow] as number) + L.frameWindowMs + 1 - now);\n      }",
        "new": "      bucket = Math.min(32, bucket + ((now - bucketAt) * 16) / 1000);\n      bucketAt = now;\n      const wait = bucket >= 1 ? 0 * Number(isStore) : Math.ceil(((1 - bucket) * 1000) / 16);\n      if (wait === 0) bucket -= 1;"
      }
    ],
    "tests": "test/frame-outbox.test.ts",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/frame-outbox.test.ts",
    "rc": 1,
    "red": "4 failed | 11 passed (15)",
    "failing": [
      "test/frame-outbox.test.ts > the outbox after ready: the pacer > sends at most 12 ops that are not copies in any 1000 ms, holding the next until the oldest is more than 1000 ms old",
      "test/frame-outbox.test.ts > L3.M12: 10,000 random adapter calls, timer and transit jitter, fed into both readings of the parent limits > seed 1: 0 refusals from the token buckets and from a strict 20/10 sliding window; no 1000 ms holds more than 16 messages or 8 store.set; a copy is never delayed; every changes ends exactly once",
      "test/frame-outbox.test.ts > L3.M12: 10,000 random adapter calls, timer and transit jitter, fed into both readings of the parent limits > seed 2: 0 refusals from the token buckets and from a strict 20/10 sliding window; no 1000 ms holds more than 16 messages or 8 store.set; a copy is never delayed; every changes ends exactly once",
      "test/frame-outbox.test.ts > L3.M12: 10,000 random adapter calls, timer and transit jitter, fed into both readings of the parent limits > seed 3: 0 refusals from the token buckets and from a strict 20/10 sliding window; no 1000 ms holds more than 16 messages or 8 store.set; a copy is never delayed; every changes ends exactly once"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "src/frame-runtime/outbox.ts": "af79ea70f71e restored, equal"
    }
  },
  {
    "id": "L3.M12b",
    "guard": "flush unpaced: the queue posted at once on open(), outside the pacer and its records",
    "file": "src/frame-runtime/outbox.ts",
    "old": "        else if (e.kind === 'changes' || e.op.t === 'hash' || e.op.t === 'store.set') enqueue(e);\n        else lead(lanes[e.op.t], e.op);",
    "new": "        else if (e.kind === 'changes') enqueue(e);\n        else post(e.op);",
    "tests": "test/frame-outbox.test.ts",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/frame-outbox.test.ts",
    "rc": 1,
    "red": "2 failed | 13 passed (15)",
    "failing": [
      "test/frame-outbox.test.ts > L3.M12: 10,000 random adapter calls, timer and transit jitter, fed into both readings of the parent limits > seed 1: 0 refusals from the token buckets and from a strict 20/10 sliding window; no 1000 ms holds more than 16 messages or 8 store.set; a copy is never delayed; every changes ends exactly once",
      "test/frame-outbox.test.ts > L3.M12: 10,000 random adapter calls, timer and transit jitter, fed into both readings of the parent limits > seed 2: 0 refusals from the token buckets and from a strict 20/10 sliding window; no 1000 ms holds more than 16 messages or 8 store.set; a copy is never delayed; every changes ends exactly once"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "src/frame-runtime/outbox.ts": "af79ea70f71e restored, equal"
    }
  },
  {
    "id": "L3.M12c",
    "guard": "copy queued behind store.set: a copy waits in the pacer's line",
    "file": "src/frame-runtime/outbox.ts",
    "old": "      postEntry({ kind: 'copy', text }, now);\n      return true;",
    "new": "      line.push({ kind: 'copy', text });\n      pump();\n      return true;",
    "tests": "test/frame-outbox.test.ts",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/frame-outbox.test.ts",
    "rc": 1,
    "red": "4 failed | 11 passed (15)",
    "failing": [
      "test/frame-outbox.test.ts > the outbox after ready: the pacer > a store.set burst never delays a copy: the copy is posted at the instant it is asked for",
      "test/frame-outbox.test.ts > L3.M12: 10,000 random adapter calls, timer and transit jitter, fed into both readings of the parent limits > seed 1: 0 refusals from the token buckets and from a strict 20/10 sliding window; no 1000 ms holds more than 16 messages or 8 store.set; a copy is never delayed; every changes ends exactly once",
      "test/frame-outbox.test.ts > L3.M12: 10,000 random adapter calls, timer and transit jitter, fed into both readings of the parent limits > seed 2: 0 refusals from the token buckets and from a strict 20/10 sliding window; no 1000 ms holds more than 16 messages or 8 store.set; a copy is never delayed; every changes ends exactly once",
      "test/frame-outbox.test.ts > L3.M12: 10,000 random adapter calls, timer and transit jitter, fed into both readings of the parent limits > seed 3: 0 refusals from the token buckets and from a strict 20/10 sliding window; no 1000 ms holds more than 16 messages or 8 store.set; a copy is never delayed; every changes ends exactly once"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "src/frame-runtime/outbox.ts": "af79ea70f71e restored, equal"
    }
  },
  {
    "id": "L3.M12d",
    "guard": "drop the terminal timeout: a sent changes left unanswered never ends",
    "file": "src/frame-runtime/outbox.ts",
    "old": "      req.timer = clock.setTimeout(() => {\n        req.timer = undefined;\n        if (current !== req) return;\n        end(req, null);\n        advance();\n      }, L.frameChangesTimeoutMs);\n",
    "new": "",
    "tests": "test/frame-outbox.test.ts",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/frame-outbox.test.ts",
    "rc": 1,
    "red": "4 failed | 11 passed (15)",
    "failing": [
      "test/frame-outbox.test.ts > the changes slot and its terminal rule (Reference §6.5) > a sent request unanswered after 35 s resolves null and frees the slot for the queued one",
      "test/frame-outbox.test.ts > L3.M12: 10,000 random adapter calls, timer and transit jitter, fed into both readings of the parent limits > seed 1: 0 refusals from the token buckets and from a strict 20/10 sliding window; no 1000 ms holds more than 16 messages or 8 store.set; a copy is never delayed; every changes ends exactly once",
      "test/frame-outbox.test.ts > L3.M12: 10,000 random adapter calls, timer and transit jitter, fed into both readings of the parent limits > seed 2: 0 refusals from the token buckets and from a strict 20/10 sliding window; no 1000 ms holds more than 16 messages or 8 store.set; a copy is never delayed; every changes ends exactly once",
      "test/frame-outbox.test.ts > L3.M12: 10,000 random adapter calls, timer and transit jitter, fed into both readings of the parent limits > seed 3: 0 refusals from the token buckets and from a strict 20/10 sliding window; no 1000 ms holds more than 16 messages or 8 store.set; a copy is never delayed; every changes ends exactly once"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "src/frame-runtime/outbox.ts": "af79ea70f71e restored, equal"
    }
  }
]
```

## The walls: `test/frame-runtime-walls.test.ts` (L3.M19p01 to L3.M19p27, L3.M19g1, L3.M19g2)

Reference §5.3, §5.4, §6 and the Global Constraints. Each forbidden name, the page names, code from strings, a selector by id, a member key built from strings, and the guarded built-ins outside their sites, planted one at a time in `src/frame-runtime/adapters.ts` (which the bootstrap bundles, so the built scan sees most of them twice); and a test-only branch planted in the guard, in two shapes (a `__TEST` flag and a branch on a test-named binding), seen in the built `guard.js`. No rebuild: the walls test builds the scripts in memory.

| Row | Guard | Change | Red | Restore |
|---|---|---|---|---|
| L3.M19p01 | plant innerHTML in src/frame-runtime/adapters.ts | `src/frame-runtime/adapters.ts`: `/** The adapters for one frame over its outbox and seed (see the header). */` → `export const planted = (globalThis as unknown as Record<string, unknown>).innerHTML; ⏎  ⏎ /** The adapters for one frame over its outbox and seed (see the header). */` | `test/frame-runtime-walls.test.ts`: 4 failed | 46 passed (50). "no source names a forbidden name, a page name of the global, code from strings, a selector by id, or a member key built from strings; every guarded site is at its allowed count"; "a planted (x: { location: string }): string => x.location; in adapters.ts is not a violation"; "a local binding named location, top or open is not a global reference (the binder, not the text)"; "guard.js and bootstrap.js pass the same scan, with the sites of the sources they bundle" | `src/frame-runtime/adapters.ts` sha256 `fe54ea7b07ae…` restored, equal |
| L3.M19p02 | plant outerHTML in src/frame-runtime/adapters.ts | `src/frame-runtime/adapters.ts`: `/** The adapters for one frame over its outbox and seed (see the header). */` → `export const planted = (globalThis as unknown as Record<string, unknown>).outerHTML; ⏎  ⏎ /** The adapters for one frame over its outbox and seed (see the header). */` | `test/frame-runtime-walls.test.ts`: 4 failed | 46 passed (50). "no source names a forbidden name, a page name of the global, code from strings, a selector by id, or a member key built from strings; every guarded site is at its allowed count"; "a planted (x: { location: string }): string => x.location; in adapters.ts is not a violation"; "a local binding named location, top or open is not a global reference (the binder, not the text)"; "guard.js and bootstrap.js pass the same scan, with the sites of the sources they bundle" | `src/frame-runtime/adapters.ts` sha256 `fe54ea7b07ae…` restored, equal |
| L3.M19p03 | plant insertAdjacentHTML in src/frame-runtime/adapters.ts | `src/frame-runtime/adapters.ts`: `/** The adapters for one frame over its outbox and seed (see the header). */` → `export const planted = (globalThis as unknown as Record<string, unknown>).insertAdjacentHTML; ⏎  ⏎ /** The adapters for one frame over its outbox and seed (see the header). */` | `test/frame-runtime-walls.test.ts`: 4 failed | 46 passed (50). "no source names a forbidden name, a page name of the global, code from strings, a selector by id, or a member key built from strings; every guarded site is at its allowed count"; "a planted (x: { location: string }): string => x.location; in adapters.ts is not a violation"; "a local binding named location, top or open is not a global reference (the binder, not the text)"; "guard.js and bootstrap.js pass the same scan, with the sites of the sources they bundle" | `src/frame-runtime/adapters.ts` sha256 `fe54ea7b07ae…` restored, equal |
| L3.M19p04 | plant fetch in src/frame-runtime/adapters.ts | `src/frame-runtime/adapters.ts`: `/** The adapters for one frame over its outbox and seed (see the header). */` → `export const planted = (globalThis as unknown as Record<string, unknown>).fetch; ⏎  ⏎ /** The adapters for one frame over its outbox and seed (see the header). */` | `test/frame-runtime-walls.test.ts`: 4 failed | 46 passed (50). "no source names a forbidden name, a page name of the global, code from strings, a selector by id, or a member key built from strings; every guarded site is at its allowed count"; "a planted (x: { location: string }): string => x.location; in adapters.ts is not a violation"; "a local binding named location, top or open is not a global reference (the binder, not the text)"; "guard.js and bootstrap.js pass the same scan, with the sites of the sources they bundle" | `src/frame-runtime/adapters.ts` sha256 `fe54ea7b07ae…` restored, equal |
| L3.M19p05 | plant XMLHttpRequest in src/frame-runtime/adapters.ts | `src/frame-runtime/adapters.ts`: `/** The adapters for one frame over its outbox and seed (see the header). */` → `export const planted = (globalThis as unknown as Record<string, unknown>).XMLHttpRequest; ⏎  ⏎ /** The adapters for one frame over its outbox and seed (see the header). */` | `test/frame-runtime-walls.test.ts`: 4 failed | 46 passed (50). "no source names a forbidden name, a page name of the global, code from strings, a selector by id, or a member key built from strings; every guarded site is at its allowed count"; "a planted (x: { location: string }): string => x.location; in adapters.ts is not a violation"; "a local binding named location, top or open is not a global reference (the binder, not the text)"; "guard.js and bootstrap.js pass the same scan, with the sites of the sources they bundle" | `src/frame-runtime/adapters.ts` sha256 `fe54ea7b07ae…` restored, equal |
| L3.M19p06 | plant WebSocket in src/frame-runtime/adapters.ts | `src/frame-runtime/adapters.ts`: `/** The adapters for one frame over its outbox and seed (see the header). */` → `export const planted = (globalThis as unknown as Record<string, unknown>).WebSocket; ⏎  ⏎ /** The adapters for one frame over its outbox and seed (see the header). */` | `test/frame-runtime-walls.test.ts`: 4 failed | 46 passed (50). "no source names a forbidden name, a page name of the global, code from strings, a selector by id, or a member key built from strings; every guarded site is at its allowed count"; "a planted (x: { location: string }): string => x.location; in adapters.ts is not a violation"; "a local binding named location, top or open is not a global reference (the binder, not the text)"; "guard.js and bootstrap.js pass the same scan, with the sites of the sources they bundle" | `src/frame-runtime/adapters.ts` sha256 `fe54ea7b07ae…` restored, equal |
| L3.M19p07 | plant EventSource in src/frame-runtime/adapters.ts | `src/frame-runtime/adapters.ts`: `/** The adapters for one frame over its outbox and seed (see the header). */` → `export const planted = (globalThis as unknown as Record<string, unknown>).EventSource; ⏎  ⏎ /** The adapters for one frame over its outbox and seed (see the header). */` | `test/frame-runtime-walls.test.ts`: 4 failed | 46 passed (50). "no source names a forbidden name, a page name of the global, code from strings, a selector by id, or a member key built from strings; every guarded site is at its allowed count"; "a planted (x: { location: string }): string => x.location; in adapters.ts is not a violation"; "a local binding named location, top or open is not a global reference (the binder, not the text)"; "guard.js and bootstrap.js pass the same scan, with the sites of the sources they bundle" | `src/frame-runtime/adapters.ts` sha256 `fe54ea7b07ae…` restored, equal |
| L3.M19p08 | plant sendBeacon in src/frame-runtime/adapters.ts | `src/frame-runtime/adapters.ts`: `/** The adapters for one frame over its outbox and seed (see the header). */` → `export const planted = (globalThis as unknown as Record<string, unknown>).sendBeacon; ⏎  ⏎ /** The adapters for one frame over its outbox and seed (see the header). */` | `test/frame-runtime-walls.test.ts`: 4 failed | 46 passed (50). "no source names a forbidden name, a page name of the global, code from strings, a selector by id, or a member key built from strings; every guarded site is at its allowed count"; "a planted (x: { location: string }): string => x.location; in adapters.ts is not a violation"; "a local binding named location, top or open is not a global reference (the binder, not the text)"; "guard.js and bootstrap.js pass the same scan, with the sites of the sources they bundle" | `src/frame-runtime/adapters.ts` sha256 `fe54ea7b07ae…` restored, equal |
| L3.M19p09 | plant localStorage in src/frame-runtime/adapters.ts | `src/frame-runtime/adapters.ts`: `/** The adapters for one frame over its outbox and seed (see the header). */` → `export const planted = (globalThis as unknown as Record<string, unknown>).localStorage; ⏎  ⏎ /** The adapters for one frame over its outbox and seed (see the header). */` | `test/frame-runtime-walls.test.ts`: 4 failed | 46 passed (50). "no source names a forbidden name, a page name of the global, code from strings, a selector by id, or a member key built from strings; every guarded site is at its allowed count"; "a planted (x: { location: string }): string => x.location; in adapters.ts is not a violation"; "a local binding named location, top or open is not a global reference (the binder, not the text)"; "guard.js and bootstrap.js pass the same scan, with the sites of the sources they bundle" | `src/frame-runtime/adapters.ts` sha256 `fe54ea7b07ae…` restored, equal |
| L3.M19p10 | plant sessionStorage in src/frame-runtime/adapters.ts | `src/frame-runtime/adapters.ts`: `/** The adapters for one frame over its outbox and seed (see the header). */` → `export const planted = (globalThis as unknown as Record<string, unknown>).sessionStorage; ⏎  ⏎ /** The adapters for one frame over its outbox and seed (see the header). */` | `test/frame-runtime-walls.test.ts`: 4 failed | 46 passed (50). "no source names a forbidden name, a page name of the global, code from strings, a selector by id, or a member key built from strings; every guarded site is at its allowed count"; "a planted (x: { location: string }): string => x.location; in adapters.ts is not a violation"; "a local binding named location, top or open is not a global reference (the binder, not the text)"; "guard.js and bootstrap.js pass the same scan, with the sites of the sources they bundle" | `src/frame-runtime/adapters.ts` sha256 `fe54ea7b07ae…` restored, equal |
| L3.M19p11 | plant indexedDB in src/frame-runtime/adapters.ts | `src/frame-runtime/adapters.ts`: `/** The adapters for one frame over its outbox and seed (see the header). */` → `export const planted = (globalThis as unknown as Record<string, unknown>).indexedDB; ⏎  ⏎ /** The adapters for one frame over its outbox and seed (see the header). */` | `test/frame-runtime-walls.test.ts`: 4 failed | 46 passed (50). "no source names a forbidden name, a page name of the global, code from strings, a selector by id, or a member key built from strings; every guarded site is at its allowed count"; "a planted (x: { location: string }): string => x.location; in adapters.ts is not a violation"; "a local binding named location, top or open is not a global reference (the binder, not the text)"; "guard.js and bootstrap.js pass the same scan, with the sites of the sources they bundle" | `src/frame-runtime/adapters.ts` sha256 `fe54ea7b07ae…` restored, equal |
| L3.M19p12 | plant caches in src/frame-runtime/adapters.ts | `src/frame-runtime/adapters.ts`: `/** The adapters for one frame over its outbox and seed (see the header). */` → `export const planted = (globalThis as unknown as Record<string, unknown>).caches; ⏎  ⏎ /** The adapters for one frame over its outbox and seed (see the header). */` | `test/frame-runtime-walls.test.ts`: 4 failed | 46 passed (50). "no source names a forbidden name, a page name of the global, code from strings, a selector by id, or a member key built from strings; every guarded site is at its allowed count"; "a planted (x: { location: string }): string => x.location; in adapters.ts is not a violation"; "a local binding named location, top or open is not a global reference (the binder, not the text)"; "guard.js and bootstrap.js pass the same scan, with the sites of the sources they bundle" | `src/frame-runtime/adapters.ts` sha256 `fe54ea7b07ae…` restored, equal |
| L3.M19p13 | plant cookie in src/frame-runtime/adapters.ts | `src/frame-runtime/adapters.ts`: `/** The adapters for one frame over its outbox and seed (see the header). */` → `export const planted = (globalThis as unknown as Record<string, unknown>).cookie; ⏎  ⏎ /** The adapters for one frame over its outbox and seed (see the header). */` | `test/frame-runtime-walls.test.ts`: 4 failed | 46 passed (50). "no source names a forbidden name, a page name of the global, code from strings, a selector by id, or a member key built from strings; every guarded site is at its allowed count"; "a planted (x: { location: string }): string => x.location; in adapters.ts is not a violation"; "a local binding named location, top or open is not a global reference (the binder, not the text)"; "guard.js and bootstrap.js pass the same scan, with the sites of the sources they bundle" | `src/frame-runtime/adapters.ts` sha256 `fe54ea7b07ae…` restored, equal |
| L3.M19p14 | plant getElementById in src/frame-runtime/adapters.ts | `src/frame-runtime/adapters.ts`: `/** The adapters for one frame over its outbox and seed (see the header). */` → `export const planted = (globalThis as unknown as Record<string, unknown>).getElementById; ⏎  ⏎ /** The adapters for one frame over its outbox and seed (see the header). */` | `test/frame-runtime-walls.test.ts`: 4 failed | 46 passed (50). "no source names a forbidden name, a page name of the global, code from strings, a selector by id, or a member key built from strings; every guarded site is at its allowed count"; "a planted (x: { location: string }): string => x.location; in adapters.ts is not a violation"; "a local binding named location, top or open is not a global reference (the binder, not the text)"; "guard.js and bootstrap.js pass the same scan, with the sites of the sources they bundle" | `src/frame-runtime/adapters.ts` sha256 `fe54ea7b07ae…` restored, equal |
| L3.M19p15 | plant eval in src/frame-runtime/adapters.ts | `src/frame-runtime/adapters.ts`: `/** The adapters for one frame over its outbox and seed (see the header). */` → `export const planted = eval('1'); ⏎  ⏎ /** The adapters for one frame over its outbox and seed (see the header). */` | `test/frame-runtime-walls.test.ts`: 4 failed | 46 passed (50). "no source names a forbidden name, a page name of the global, code from strings, a selector by id, or a member key built from strings; every guarded site is at its allowed count"; "a planted (x: { location: string }): string => x.location; in adapters.ts is not a violation"; "a local binding named location, top or open is not a global reference (the binder, not the text)"; "guard.js and bootstrap.js pass the same scan, with the sites of the sources they bundle" | `src/frame-runtime/adapters.ts` sha256 `fe54ea7b07ae…` restored, equal |
| L3.M19p16 | plant new Function in src/frame-runtime/adapters.ts | `src/frame-runtime/adapters.ts`: `/** The adapters for one frame over its outbox and seed (see the header). */` → `export const planted = new Function('return 1'); ⏎  ⏎ /** The adapters for one frame over its outbox and seed (see the header). */` | `test/frame-runtime-walls.test.ts`: 4 failed | 46 passed (50). "no source names a forbidden name, a page name of the global, code from strings, a selector by id, or a member key built from strings; every guarded site is at its allowed count"; "a planted (x: { location: string }): string => x.location; in adapters.ts is not a violation"; "a local binding named location, top or open is not a global reference (the binder, not the text)"; "guard.js and bootstrap.js pass the same scan, with the sites of the sources they bundle" | `src/frame-runtime/adapters.ts` sha256 `fe54ea7b07ae…` restored, equal |
| L3.M19p17 | plant global open in src/frame-runtime/adapters.ts | `src/frame-runtime/adapters.ts`: `/** The adapters for one frame over its outbox and seed (see the header). */` → `export const planted = (): unknown => open('x'); ⏎  ⏎ /** The adapters for one frame over its outbox and seed (see the header). */` | `test/frame-runtime-walls.test.ts`: 3 failed | 47 passed (50). "no source names a forbidden name, a page name of the global, code from strings, a selector by id, or a member key built from strings; every guarded site is at its allowed count"; "a planted (x: { location: string }): string => x.location; in adapters.ts is not a violation"; "a local binding named location, top or open is not a global reference (the binder, not the text)" | `src/frame-runtime/adapters.ts` sha256 `fe54ea7b07ae…` restored, equal |
| L3.M19p18 | plant window.open in src/frame-runtime/adapters.ts | `src/frame-runtime/adapters.ts`: `/** The adapters for one frame over its outbox and seed (see the header). */` → `export const planted = (): unknown => window.open('x'); ⏎  ⏎ /** The adapters for one frame over its outbox and seed (see the header). */` | `test/frame-runtime-walls.test.ts`: 7 failed | 43 passed (50). "no source names a forbidden name, a page name of the global, code from strings, a selector by id, or a member key built from strings; every guarded site is at its allowed count"; "the allowed sites are measured, not assumed: the counts above are what the sources hold"; "a planted extra use in adapters.ts goes red: .open x1, allowed x0"; "a planted window.open('x'); in adapters.ts is  a violation"; "a planted document.open(); in adapters.ts is  a violation"; and 2 more | `src/frame-runtime/adapters.ts` sha256 `fe54ea7b07ae…` restored, equal |
| L3.M19p19 | plant document.open in src/frame-runtime/adapters.ts | `src/frame-runtime/adapters.ts`: `/** The adapters for one frame over its outbox and seed (see the header). */` → `export const planted = (): unknown => document.open(); ⏎  ⏎ /** The adapters for one frame over its outbox and seed (see the header). */` | `test/frame-runtime-walls.test.ts`: 7 failed | 43 passed (50). "no source names a forbidden name, a page name of the global, code from strings, a selector by id, or a member key built from strings; every guarded site is at its allowed count"; "the allowed sites are measured, not assumed: the counts above are what the sources hold"; "a planted extra use in adapters.ts goes red: .open x1, allowed x0"; "a planted window.open('x'); in adapters.ts is  a violation"; "a planted document.open(); in adapters.ts is  a violation"; and 2 more | `src/frame-runtime/adapters.ts` sha256 `fe54ea7b07ae…` restored, equal |
| L3.M19p20 | plant global location in src/frame-runtime/adapters.ts | `src/frame-runtime/adapters.ts`: `/** The adapters for one frame over its outbox and seed (see the header). */` → `export const planted = (): unknown => location.href; ⏎  ⏎ /** The adapters for one frame over its outbox and seed (see the header). */` | `test/frame-runtime-walls.test.ts`: 3 failed | 47 passed (50). "no source names a forbidden name, a page name of the global, code from strings, a selector by id, or a member key built from strings; every guarded site is at its allowed count"; "a planted (x: { location: string }): string => x.location; in adapters.ts is not a violation"; "a local binding named location, top or open is not a global reference (the binder, not the text)" | `src/frame-runtime/adapters.ts` sha256 `fe54ea7b07ae…` restored, equal |
| L3.M19p21 | plant window.history in src/frame-runtime/adapters.ts | `src/frame-runtime/adapters.ts`: `/** The adapters for one frame over its outbox and seed (see the header). */` → `export const planted = (): unknown => window.history; ⏎  ⏎ /** The adapters for one frame over its outbox and seed (see the header). */` | `test/frame-runtime-walls.test.ts`: 3 failed | 47 passed (50). "no source names a forbidden name, a page name of the global, code from strings, a selector by id, or a member key built from strings; every guarded site is at its allowed count"; "a planted (x: { location: string }): string => x.location; in adapters.ts is not a violation"; "a local binding named location, top or open is not a global reference (the binder, not the text)" | `src/frame-runtime/adapters.ts` sha256 `fe54ea7b07ae…` restored, equal |
| L3.M19p22 | plant global top in src/frame-runtime/adapters.ts | `src/frame-runtime/adapters.ts`: `/** The adapters for one frame over its outbox and seed (see the header). */` → `export const planted = (): unknown => top; ⏎  ⏎ /** The adapters for one frame over its outbox and seed (see the header). */` | `test/frame-runtime-walls.test.ts`: 3 failed | 47 passed (50). "no source names a forbidden name, a page name of the global, code from strings, a selector by id, or a member key built from strings; every guarded site is at its allowed count"; "a planted (x: { location: string }): string => x.location; in adapters.ts is not a violation"; "a local binding named location, top or open is not a global reference (the binder, not the text)" | `src/frame-runtime/adapters.ts` sha256 `fe54ea7b07ae…` restored, equal |
| L3.M19p23 | plant DOMParser outside content.ts in src/frame-runtime/adapters.ts | `src/frame-runtime/adapters.ts`: `/** The adapters for one frame over its outbox and seed (see the header). */` → `export const planted = (): unknown => new DOMParser(); ⏎  ⏎ /** The adapters for one frame over its outbox and seed (see the header). */` | `test/frame-runtime-walls.test.ts`: 5 failed | 45 passed (50). "no source names a forbidden name, a page name of the global, code from strings, a selector by id, or a member key built from strings; every guarded site is at its allowed count"; "the allowed sites are measured, not assumed: the counts above are what the sources hold"; "a planted extra use in adapters.ts goes red: DOMParser x1, allowed x0"; "a planted (x: { location: string }): string => x.location; in adapters.ts is not a violation"; "a local binding named location, top or open is not a global reference (the binder, not the text)" | `src/frame-runtime/adapters.ts` sha256 `fe54ea7b07ae…` restored, equal |
| L3.M19p24 | plant postMessage outside the bootstrap in src/frame-runtime/adapters.ts | `src/frame-runtime/adapters.ts`: `/** The adapters for one frame over its outbox and seed (see the header). */` → `export const planted = (w: Window): void => w.postMessage(1, '*'); ⏎  ⏎ /** The adapters for one frame over its outbox and seed (see the header). */` | `test/frame-runtime-walls.test.ts`: 5 failed | 45 passed (50). "no source names a forbidden name, a page name of the global, code from strings, a selector by id, or a member key built from strings; every guarded site is at its allowed count"; "the allowed sites are measured, not assumed: the counts above are what the sources hold"; "a planted extra use in adapters.ts goes red: postMessage x1, allowed x0"; "a planted (x: { location: string }): string => x.location; in adapters.ts is not a violation"; "a local binding named location, top or open is not a global reference (the binder, not the text)" | `src/frame-runtime/adapters.ts` sha256 `fe54ea7b07ae…` restored, equal |
| L3.M19p25 | plant addEventListener('message' outside the bootstrap in src/frame-runtime/adapters.ts | `src/frame-runtime/adapters.ts`: `/** The adapters for one frame over its outbox and seed (see the header). */` → `export const planted = (w: Window): void => w.addEventListener('message', () => undefined); ⏎  ⏎ /** The adapters for one frame over its outbox and seed (see the header). */` | `test/frame-runtime-walls.test.ts`: 4 failed | 46 passed (50). "no source names a forbidden name, a page name of the global, code from strings, a selector by id, or a member key built from strings; every guarded site is at its allowed count"; "the allowed sites are measured, not assumed: the counts above are what the sources hold"; "a planted (x: { location: string }): string => x.location; in adapters.ts is not a violation"; "a local binding named location, top or open is not a global reference (the binder, not the text)" | `src/frame-runtime/adapters.ts` sha256 `fe54ea7b07ae…` restored, equal |
| L3.M19p26 | plant querySelector('#…') in src/frame-runtime/adapters.ts | `src/frame-runtime/adapters.ts`: `/** The adapters for one frame over its outbox and seed (see the header). */` → `export const planted = (d: Document): unknown => d.querySelector('#seed'); ⏎  ⏎ /** The adapters for one frame over its outbox and seed (see the header). */` | `test/frame-runtime-walls.test.ts`: 3 failed | 47 passed (50). "no source names a forbidden name, a page name of the global, code from strings, a selector by id, or a member key built from strings; every guarded site is at its allowed count"; "a planted (x: { location: string }): string => x.location; in adapters.ts is not a violation"; "a local binding named location, top or open is not a global reference (the binder, not the text)" | `src/frame-runtime/adapters.ts` sha256 `fe54ea7b07ae…` restored, equal |
| L3.M19p27 | plant a member key built from strings in src/frame-runtime/adapters.ts | `src/frame-runtime/adapters.ts`: `/** The adapters for one frame over its outbox and seed (see the header). */` → `export const planted = (d: Document): unknown => (d.body as unknown as Record<string, unknown>)['inner' + 'HTML']; ⏎  ⏎ /** The adapters for one frame over its outbox and seed (see the header). */` | `test/frame-runtime-walls.test.ts`: 3 failed | 47 passed (50). "no source names a forbidden name, a page name of the global, code from strings, a selector by id, or a member key built from strings; every guarded site is at its allowed count"; "a planted (x: { location: string }): string => x.location; in adapters.ts is not a violation"; "a local binding named location, top or open is not a global reference (the binder, not the text)" | `src/frame-runtime/adapters.ts` sha256 `fe54ea7b07ae…` restored, equal |
| L3.M19g1 | plant a test-only branch in the guard (`if (globalThis.__TEST) ...`) | `src/frame-runtime/guard.ts`: `  add.call(window, 'submit', (e: Event) => preventDefault.call(e), true);` → `  add.call(window, 'submit', (e: Event) => preventDefault.call(e), true); ⏎   if ((globalThis as unknown as { __TEST?: boolean }).__TEST === true) add.call(window, 'click', () => undefined, true);` | `test/frame-runtime-walls.test.ts`: 2 failed | 48 passed (50). "none of the three carries a test marker"; "a planted test-only branch is seen, in each of its shapes" | `src/frame-runtime/guard.ts` sha256 `9165060de41e…` restored, equal |
| L3.M19g2 | plant a branch on a test-named flag in the guard (`if (testHook) ...`) | `src/frame-runtime/guard.ts`: `  add.call(window, 'submit', (e: Event) => preventDefault.call(e), true);` → `  add.call(window, 'submit', (e: Event) => preventDefault.call(e), true); ⏎   const testHook = (me as unknown as { dataset?: { hook?: string } }).dataset?.hook; ⏎   if (testHook !== undefined) add.call(window, 'click', () => undefined, true);` | `test/frame-runtime-walls.test.ts`: 2 failed | 48 passed (50). "none of the three carries a test marker"; "a planted test-only branch is seen, in each of its shapes" | `src/frame-runtime/guard.ts` sha256 `9165060de41e…` restored, equal |

```json
[
  {
    "id": "L3.M19p01",
    "guard": "plant innerHTML in src/frame-runtime/adapters.ts",
    "file": "src/frame-runtime/adapters.ts",
    "old": "/** The adapters for one frame over its outbox and seed (see the header). */",
    "new": "export const planted = (globalThis as unknown as Record<string, unknown>).innerHTML;\n\n/** The adapters for one frame over its outbox and seed (see the header). */",
    "tests": "test/frame-runtime-walls.test.ts",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/frame-runtime-walls.test.ts",
    "rc": 1,
    "red": "4 failed | 46 passed (50)",
    "failing": [
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > no source names a forbidden name, a page name of the global, code from strings, a selector by id, or a member key built from strings; every guarded site is at its allowed count",
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > a planted (x: { location: string }): string => x.location; in adapters.ts is not a violation",
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > a local binding named location, top or open is not a global reference (the binder, not the text)",
      "test/frame-runtime-walls.test.ts > L3.M19: the built guard.js, bootstrap.js and enhance.js > guard.js and bootstrap.js pass the same scan, with the sites of the sources they bundle"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "src/frame-runtime/adapters.ts": "fe54ea7b07ae restored, equal"
    }
  },
  {
    "id": "L3.M19p02",
    "guard": "plant outerHTML in src/frame-runtime/adapters.ts",
    "file": "src/frame-runtime/adapters.ts",
    "old": "/** The adapters for one frame over its outbox and seed (see the header). */",
    "new": "export const planted = (globalThis as unknown as Record<string, unknown>).outerHTML;\n\n/** The adapters for one frame over its outbox and seed (see the header). */",
    "tests": "test/frame-runtime-walls.test.ts",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/frame-runtime-walls.test.ts",
    "rc": 1,
    "red": "4 failed | 46 passed (50)",
    "failing": [
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > no source names a forbidden name, a page name of the global, code from strings, a selector by id, or a member key built from strings; every guarded site is at its allowed count",
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > a planted (x: { location: string }): string => x.location; in adapters.ts is not a violation",
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > a local binding named location, top or open is not a global reference (the binder, not the text)",
      "test/frame-runtime-walls.test.ts > L3.M19: the built guard.js, bootstrap.js and enhance.js > guard.js and bootstrap.js pass the same scan, with the sites of the sources they bundle"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "src/frame-runtime/adapters.ts": "fe54ea7b07ae restored, equal"
    }
  },
  {
    "id": "L3.M19p03",
    "guard": "plant insertAdjacentHTML in src/frame-runtime/adapters.ts",
    "file": "src/frame-runtime/adapters.ts",
    "old": "/** The adapters for one frame over its outbox and seed (see the header). */",
    "new": "export const planted = (globalThis as unknown as Record<string, unknown>).insertAdjacentHTML;\n\n/** The adapters for one frame over its outbox and seed (see the header). */",
    "tests": "test/frame-runtime-walls.test.ts",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/frame-runtime-walls.test.ts",
    "rc": 1,
    "red": "4 failed | 46 passed (50)",
    "failing": [
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > no source names a forbidden name, a page name of the global, code from strings, a selector by id, or a member key built from strings; every guarded site is at its allowed count",
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > a planted (x: { location: string }): string => x.location; in adapters.ts is not a violation",
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > a local binding named location, top or open is not a global reference (the binder, not the text)",
      "test/frame-runtime-walls.test.ts > L3.M19: the built guard.js, bootstrap.js and enhance.js > guard.js and bootstrap.js pass the same scan, with the sites of the sources they bundle"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "src/frame-runtime/adapters.ts": "fe54ea7b07ae restored, equal"
    }
  },
  {
    "id": "L3.M19p04",
    "guard": "plant fetch in src/frame-runtime/adapters.ts",
    "file": "src/frame-runtime/adapters.ts",
    "old": "/** The adapters for one frame over its outbox and seed (see the header). */",
    "new": "export const planted = (globalThis as unknown as Record<string, unknown>).fetch;\n\n/** The adapters for one frame over its outbox and seed (see the header). */",
    "tests": "test/frame-runtime-walls.test.ts",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/frame-runtime-walls.test.ts",
    "rc": 1,
    "red": "4 failed | 46 passed (50)",
    "failing": [
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > no source names a forbidden name, a page name of the global, code from strings, a selector by id, or a member key built from strings; every guarded site is at its allowed count",
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > a planted (x: { location: string }): string => x.location; in adapters.ts is not a violation",
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > a local binding named location, top or open is not a global reference (the binder, not the text)",
      "test/frame-runtime-walls.test.ts > L3.M19: the built guard.js, bootstrap.js and enhance.js > guard.js and bootstrap.js pass the same scan, with the sites of the sources they bundle"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "src/frame-runtime/adapters.ts": "fe54ea7b07ae restored, equal"
    }
  },
  {
    "id": "L3.M19p05",
    "guard": "plant XMLHttpRequest in src/frame-runtime/adapters.ts",
    "file": "src/frame-runtime/adapters.ts",
    "old": "/** The adapters for one frame over its outbox and seed (see the header). */",
    "new": "export const planted = (globalThis as unknown as Record<string, unknown>).XMLHttpRequest;\n\n/** The adapters for one frame over its outbox and seed (see the header). */",
    "tests": "test/frame-runtime-walls.test.ts",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/frame-runtime-walls.test.ts",
    "rc": 1,
    "red": "4 failed | 46 passed (50)",
    "failing": [
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > no source names a forbidden name, a page name of the global, code from strings, a selector by id, or a member key built from strings; every guarded site is at its allowed count",
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > a planted (x: { location: string }): string => x.location; in adapters.ts is not a violation",
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > a local binding named location, top or open is not a global reference (the binder, not the text)",
      "test/frame-runtime-walls.test.ts > L3.M19: the built guard.js, bootstrap.js and enhance.js > guard.js and bootstrap.js pass the same scan, with the sites of the sources they bundle"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "src/frame-runtime/adapters.ts": "fe54ea7b07ae restored, equal"
    }
  },
  {
    "id": "L3.M19p06",
    "guard": "plant WebSocket in src/frame-runtime/adapters.ts",
    "file": "src/frame-runtime/adapters.ts",
    "old": "/** The adapters for one frame over its outbox and seed (see the header). */",
    "new": "export const planted = (globalThis as unknown as Record<string, unknown>).WebSocket;\n\n/** The adapters for one frame over its outbox and seed (see the header). */",
    "tests": "test/frame-runtime-walls.test.ts",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/frame-runtime-walls.test.ts",
    "rc": 1,
    "red": "4 failed | 46 passed (50)",
    "failing": [
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > no source names a forbidden name, a page name of the global, code from strings, a selector by id, or a member key built from strings; every guarded site is at its allowed count",
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > a planted (x: { location: string }): string => x.location; in adapters.ts is not a violation",
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > a local binding named location, top or open is not a global reference (the binder, not the text)",
      "test/frame-runtime-walls.test.ts > L3.M19: the built guard.js, bootstrap.js and enhance.js > guard.js and bootstrap.js pass the same scan, with the sites of the sources they bundle"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "src/frame-runtime/adapters.ts": "fe54ea7b07ae restored, equal"
    }
  },
  {
    "id": "L3.M19p07",
    "guard": "plant EventSource in src/frame-runtime/adapters.ts",
    "file": "src/frame-runtime/adapters.ts",
    "old": "/** The adapters for one frame over its outbox and seed (see the header). */",
    "new": "export const planted = (globalThis as unknown as Record<string, unknown>).EventSource;\n\n/** The adapters for one frame over its outbox and seed (see the header). */",
    "tests": "test/frame-runtime-walls.test.ts",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/frame-runtime-walls.test.ts",
    "rc": 1,
    "red": "4 failed | 46 passed (50)",
    "failing": [
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > no source names a forbidden name, a page name of the global, code from strings, a selector by id, or a member key built from strings; every guarded site is at its allowed count",
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > a planted (x: { location: string }): string => x.location; in adapters.ts is not a violation",
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > a local binding named location, top or open is not a global reference (the binder, not the text)",
      "test/frame-runtime-walls.test.ts > L3.M19: the built guard.js, bootstrap.js and enhance.js > guard.js and bootstrap.js pass the same scan, with the sites of the sources they bundle"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "src/frame-runtime/adapters.ts": "fe54ea7b07ae restored, equal"
    }
  },
  {
    "id": "L3.M19p08",
    "guard": "plant sendBeacon in src/frame-runtime/adapters.ts",
    "file": "src/frame-runtime/adapters.ts",
    "old": "/** The adapters for one frame over its outbox and seed (see the header). */",
    "new": "export const planted = (globalThis as unknown as Record<string, unknown>).sendBeacon;\n\n/** The adapters for one frame over its outbox and seed (see the header). */",
    "tests": "test/frame-runtime-walls.test.ts",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/frame-runtime-walls.test.ts",
    "rc": 1,
    "red": "4 failed | 46 passed (50)",
    "failing": [
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > no source names a forbidden name, a page name of the global, code from strings, a selector by id, or a member key built from strings; every guarded site is at its allowed count",
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > a planted (x: { location: string }): string => x.location; in adapters.ts is not a violation",
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > a local binding named location, top or open is not a global reference (the binder, not the text)",
      "test/frame-runtime-walls.test.ts > L3.M19: the built guard.js, bootstrap.js and enhance.js > guard.js and bootstrap.js pass the same scan, with the sites of the sources they bundle"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "src/frame-runtime/adapters.ts": "fe54ea7b07ae restored, equal"
    }
  },
  {
    "id": "L3.M19p09",
    "guard": "plant localStorage in src/frame-runtime/adapters.ts",
    "file": "src/frame-runtime/adapters.ts",
    "old": "/** The adapters for one frame over its outbox and seed (see the header). */",
    "new": "export const planted = (globalThis as unknown as Record<string, unknown>).localStorage;\n\n/** The adapters for one frame over its outbox and seed (see the header). */",
    "tests": "test/frame-runtime-walls.test.ts",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/frame-runtime-walls.test.ts",
    "rc": 1,
    "red": "4 failed | 46 passed (50)",
    "failing": [
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > no source names a forbidden name, a page name of the global, code from strings, a selector by id, or a member key built from strings; every guarded site is at its allowed count",
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > a planted (x: { location: string }): string => x.location; in adapters.ts is not a violation",
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > a local binding named location, top or open is not a global reference (the binder, not the text)",
      "test/frame-runtime-walls.test.ts > L3.M19: the built guard.js, bootstrap.js and enhance.js > guard.js and bootstrap.js pass the same scan, with the sites of the sources they bundle"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "src/frame-runtime/adapters.ts": "fe54ea7b07ae restored, equal"
    }
  },
  {
    "id": "L3.M19p10",
    "guard": "plant sessionStorage in src/frame-runtime/adapters.ts",
    "file": "src/frame-runtime/adapters.ts",
    "old": "/** The adapters for one frame over its outbox and seed (see the header). */",
    "new": "export const planted = (globalThis as unknown as Record<string, unknown>).sessionStorage;\n\n/** The adapters for one frame over its outbox and seed (see the header). */",
    "tests": "test/frame-runtime-walls.test.ts",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/frame-runtime-walls.test.ts",
    "rc": 1,
    "red": "4 failed | 46 passed (50)",
    "failing": [
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > no source names a forbidden name, a page name of the global, code from strings, a selector by id, or a member key built from strings; every guarded site is at its allowed count",
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > a planted (x: { location: string }): string => x.location; in adapters.ts is not a violation",
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > a local binding named location, top or open is not a global reference (the binder, not the text)",
      "test/frame-runtime-walls.test.ts > L3.M19: the built guard.js, bootstrap.js and enhance.js > guard.js and bootstrap.js pass the same scan, with the sites of the sources they bundle"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "src/frame-runtime/adapters.ts": "fe54ea7b07ae restored, equal"
    }
  },
  {
    "id": "L3.M19p11",
    "guard": "plant indexedDB in src/frame-runtime/adapters.ts",
    "file": "src/frame-runtime/adapters.ts",
    "old": "/** The adapters for one frame over its outbox and seed (see the header). */",
    "new": "export const planted = (globalThis as unknown as Record<string, unknown>).indexedDB;\n\n/** The adapters for one frame over its outbox and seed (see the header). */",
    "tests": "test/frame-runtime-walls.test.ts",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/frame-runtime-walls.test.ts",
    "rc": 1,
    "red": "4 failed | 46 passed (50)",
    "failing": [
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > no source names a forbidden name, a page name of the global, code from strings, a selector by id, or a member key built from strings; every guarded site is at its allowed count",
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > a planted (x: { location: string }): string => x.location; in adapters.ts is not a violation",
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > a local binding named location, top or open is not a global reference (the binder, not the text)",
      "test/frame-runtime-walls.test.ts > L3.M19: the built guard.js, bootstrap.js and enhance.js > guard.js and bootstrap.js pass the same scan, with the sites of the sources they bundle"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "src/frame-runtime/adapters.ts": "fe54ea7b07ae restored, equal"
    }
  },
  {
    "id": "L3.M19p12",
    "guard": "plant caches in src/frame-runtime/adapters.ts",
    "file": "src/frame-runtime/adapters.ts",
    "old": "/** The adapters for one frame over its outbox and seed (see the header). */",
    "new": "export const planted = (globalThis as unknown as Record<string, unknown>).caches;\n\n/** The adapters for one frame over its outbox and seed (see the header). */",
    "tests": "test/frame-runtime-walls.test.ts",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/frame-runtime-walls.test.ts",
    "rc": 1,
    "red": "4 failed | 46 passed (50)",
    "failing": [
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > no source names a forbidden name, a page name of the global, code from strings, a selector by id, or a member key built from strings; every guarded site is at its allowed count",
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > a planted (x: { location: string }): string => x.location; in adapters.ts is not a violation",
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > a local binding named location, top or open is not a global reference (the binder, not the text)",
      "test/frame-runtime-walls.test.ts > L3.M19: the built guard.js, bootstrap.js and enhance.js > guard.js and bootstrap.js pass the same scan, with the sites of the sources they bundle"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "src/frame-runtime/adapters.ts": "fe54ea7b07ae restored, equal"
    }
  },
  {
    "id": "L3.M19p13",
    "guard": "plant cookie in src/frame-runtime/adapters.ts",
    "file": "src/frame-runtime/adapters.ts",
    "old": "/** The adapters for one frame over its outbox and seed (see the header). */",
    "new": "export const planted = (globalThis as unknown as Record<string, unknown>).cookie;\n\n/** The adapters for one frame over its outbox and seed (see the header). */",
    "tests": "test/frame-runtime-walls.test.ts",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/frame-runtime-walls.test.ts",
    "rc": 1,
    "red": "4 failed | 46 passed (50)",
    "failing": [
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > no source names a forbidden name, a page name of the global, code from strings, a selector by id, or a member key built from strings; every guarded site is at its allowed count",
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > a planted (x: { location: string }): string => x.location; in adapters.ts is not a violation",
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > a local binding named location, top or open is not a global reference (the binder, not the text)",
      "test/frame-runtime-walls.test.ts > L3.M19: the built guard.js, bootstrap.js and enhance.js > guard.js and bootstrap.js pass the same scan, with the sites of the sources they bundle"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "src/frame-runtime/adapters.ts": "fe54ea7b07ae restored, equal"
    }
  },
  {
    "id": "L3.M19p14",
    "guard": "plant getElementById in src/frame-runtime/adapters.ts",
    "file": "src/frame-runtime/adapters.ts",
    "old": "/** The adapters for one frame over its outbox and seed (see the header). */",
    "new": "export const planted = (globalThis as unknown as Record<string, unknown>).getElementById;\n\n/** The adapters for one frame over its outbox and seed (see the header). */",
    "tests": "test/frame-runtime-walls.test.ts",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/frame-runtime-walls.test.ts",
    "rc": 1,
    "red": "4 failed | 46 passed (50)",
    "failing": [
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > no source names a forbidden name, a page name of the global, code from strings, a selector by id, or a member key built from strings; every guarded site is at its allowed count",
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > a planted (x: { location: string }): string => x.location; in adapters.ts is not a violation",
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > a local binding named location, top or open is not a global reference (the binder, not the text)",
      "test/frame-runtime-walls.test.ts > L3.M19: the built guard.js, bootstrap.js and enhance.js > guard.js and bootstrap.js pass the same scan, with the sites of the sources they bundle"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "src/frame-runtime/adapters.ts": "fe54ea7b07ae restored, equal"
    }
  },
  {
    "id": "L3.M19p15",
    "guard": "plant eval in src/frame-runtime/adapters.ts",
    "file": "src/frame-runtime/adapters.ts",
    "old": "/** The adapters for one frame over its outbox and seed (see the header). */",
    "new": "export const planted = eval('1');\n\n/** The adapters for one frame over its outbox and seed (see the header). */",
    "tests": "test/frame-runtime-walls.test.ts",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/frame-runtime-walls.test.ts",
    "rc": 1,
    "red": "4 failed | 46 passed (50)",
    "failing": [
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > no source names a forbidden name, a page name of the global, code from strings, a selector by id, or a member key built from strings; every guarded site is at its allowed count",
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > a planted (x: { location: string }): string => x.location; in adapters.ts is not a violation",
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > a local binding named location, top or open is not a global reference (the binder, not the text)",
      "test/frame-runtime-walls.test.ts > L3.M19: the built guard.js, bootstrap.js and enhance.js > guard.js and bootstrap.js pass the same scan, with the sites of the sources they bundle"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "src/frame-runtime/adapters.ts": "fe54ea7b07ae restored, equal"
    }
  },
  {
    "id": "L3.M19p16",
    "guard": "plant new Function in src/frame-runtime/adapters.ts",
    "file": "src/frame-runtime/adapters.ts",
    "old": "/** The adapters for one frame over its outbox and seed (see the header). */",
    "new": "export const planted = new Function('return 1');\n\n/** The adapters for one frame over its outbox and seed (see the header). */",
    "tests": "test/frame-runtime-walls.test.ts",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/frame-runtime-walls.test.ts",
    "rc": 1,
    "red": "4 failed | 46 passed (50)",
    "failing": [
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > no source names a forbidden name, a page name of the global, code from strings, a selector by id, or a member key built from strings; every guarded site is at its allowed count",
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > a planted (x: { location: string }): string => x.location; in adapters.ts is not a violation",
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > a local binding named location, top or open is not a global reference (the binder, not the text)",
      "test/frame-runtime-walls.test.ts > L3.M19: the built guard.js, bootstrap.js and enhance.js > guard.js and bootstrap.js pass the same scan, with the sites of the sources they bundle"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "src/frame-runtime/adapters.ts": "fe54ea7b07ae restored, equal"
    }
  },
  {
    "id": "L3.M19p17",
    "guard": "plant global open in src/frame-runtime/adapters.ts",
    "file": "src/frame-runtime/adapters.ts",
    "old": "/** The adapters for one frame over its outbox and seed (see the header). */",
    "new": "export const planted = (): unknown => open('x');\n\n/** The adapters for one frame over its outbox and seed (see the header). */",
    "tests": "test/frame-runtime-walls.test.ts",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/frame-runtime-walls.test.ts",
    "rc": 1,
    "red": "3 failed | 47 passed (50)",
    "failing": [
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > no source names a forbidden name, a page name of the global, code from strings, a selector by id, or a member key built from strings; every guarded site is at its allowed count",
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > a planted (x: { location: string }): string => x.location; in adapters.ts is not a violation",
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > a local binding named location, top or open is not a global reference (the binder, not the text)"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "src/frame-runtime/adapters.ts": "fe54ea7b07ae restored, equal"
    }
  },
  {
    "id": "L3.M19p18",
    "guard": "plant window.open in src/frame-runtime/adapters.ts",
    "file": "src/frame-runtime/adapters.ts",
    "old": "/** The adapters for one frame over its outbox and seed (see the header). */",
    "new": "export const planted = (): unknown => window.open('x');\n\n/** The adapters for one frame over its outbox and seed (see the header). */",
    "tests": "test/frame-runtime-walls.test.ts",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/frame-runtime-walls.test.ts",
    "rc": 1,
    "red": "7 failed | 43 passed (50)",
    "failing": [
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > no source names a forbidden name, a page name of the global, code from strings, a selector by id, or a member key built from strings; every guarded site is at its allowed count",
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > the allowed sites are measured, not assumed: the counts above are what the sources hold",
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > a planted extra use in adapters.ts goes red: .open x1, allowed x0",
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > a planted window.open('x'); in adapters.ts is  a violation",
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > a planted document.open(); in adapters.ts is  a violation",
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > a planted (x: { location: string }): string => x.location; in adapters.ts is not a violation",
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > a local binding named location, top or open is not a global reference (the binder, not the text)"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "src/frame-runtime/adapters.ts": "fe54ea7b07ae restored, equal"
    }
  },
  {
    "id": "L3.M19p19",
    "guard": "plant document.open in src/frame-runtime/adapters.ts",
    "file": "src/frame-runtime/adapters.ts",
    "old": "/** The adapters for one frame over its outbox and seed (see the header). */",
    "new": "export const planted = (): unknown => document.open();\n\n/** The adapters for one frame over its outbox and seed (see the header). */",
    "tests": "test/frame-runtime-walls.test.ts",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/frame-runtime-walls.test.ts",
    "rc": 1,
    "red": "7 failed | 43 passed (50)",
    "failing": [
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > no source names a forbidden name, a page name of the global, code from strings, a selector by id, or a member key built from strings; every guarded site is at its allowed count",
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > the allowed sites are measured, not assumed: the counts above are what the sources hold",
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > a planted extra use in adapters.ts goes red: .open x1, allowed x0",
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > a planted window.open('x'); in adapters.ts is  a violation",
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > a planted document.open(); in adapters.ts is  a violation",
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > a planted (x: { location: string }): string => x.location; in adapters.ts is not a violation",
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > a local binding named location, top or open is not a global reference (the binder, not the text)"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "src/frame-runtime/adapters.ts": "fe54ea7b07ae restored, equal"
    }
  },
  {
    "id": "L3.M19p20",
    "guard": "plant global location in src/frame-runtime/adapters.ts",
    "file": "src/frame-runtime/adapters.ts",
    "old": "/** The adapters for one frame over its outbox and seed (see the header). */",
    "new": "export const planted = (): unknown => location.href;\n\n/** The adapters for one frame over its outbox and seed (see the header). */",
    "tests": "test/frame-runtime-walls.test.ts",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/frame-runtime-walls.test.ts",
    "rc": 1,
    "red": "3 failed | 47 passed (50)",
    "failing": [
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > no source names a forbidden name, a page name of the global, code from strings, a selector by id, or a member key built from strings; every guarded site is at its allowed count",
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > a planted (x: { location: string }): string => x.location; in adapters.ts is not a violation",
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > a local binding named location, top or open is not a global reference (the binder, not the text)"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "src/frame-runtime/adapters.ts": "fe54ea7b07ae restored, equal"
    }
  },
  {
    "id": "L3.M19p21",
    "guard": "plant window.history in src/frame-runtime/adapters.ts",
    "file": "src/frame-runtime/adapters.ts",
    "old": "/** The adapters for one frame over its outbox and seed (see the header). */",
    "new": "export const planted = (): unknown => window.history;\n\n/** The adapters for one frame over its outbox and seed (see the header). */",
    "tests": "test/frame-runtime-walls.test.ts",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/frame-runtime-walls.test.ts",
    "rc": 1,
    "red": "3 failed | 47 passed (50)",
    "failing": [
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > no source names a forbidden name, a page name of the global, code from strings, a selector by id, or a member key built from strings; every guarded site is at its allowed count",
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > a planted (x: { location: string }): string => x.location; in adapters.ts is not a violation",
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > a local binding named location, top or open is not a global reference (the binder, not the text)"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "src/frame-runtime/adapters.ts": "fe54ea7b07ae restored, equal"
    }
  },
  {
    "id": "L3.M19p22",
    "guard": "plant global top in src/frame-runtime/adapters.ts",
    "file": "src/frame-runtime/adapters.ts",
    "old": "/** The adapters for one frame over its outbox and seed (see the header). */",
    "new": "export const planted = (): unknown => top;\n\n/** The adapters for one frame over its outbox and seed (see the header). */",
    "tests": "test/frame-runtime-walls.test.ts",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/frame-runtime-walls.test.ts",
    "rc": 1,
    "red": "3 failed | 47 passed (50)",
    "failing": [
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > no source names a forbidden name, a page name of the global, code from strings, a selector by id, or a member key built from strings; every guarded site is at its allowed count",
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > a planted (x: { location: string }): string => x.location; in adapters.ts is not a violation",
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > a local binding named location, top or open is not a global reference (the binder, not the text)"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "src/frame-runtime/adapters.ts": "fe54ea7b07ae restored, equal"
    }
  },
  {
    "id": "L3.M19p23",
    "guard": "plant DOMParser outside content.ts in src/frame-runtime/adapters.ts",
    "file": "src/frame-runtime/adapters.ts",
    "old": "/** The adapters for one frame over its outbox and seed (see the header). */",
    "new": "export const planted = (): unknown => new DOMParser();\n\n/** The adapters for one frame over its outbox and seed (see the header). */",
    "tests": "test/frame-runtime-walls.test.ts",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/frame-runtime-walls.test.ts",
    "rc": 1,
    "red": "5 failed | 45 passed (50)",
    "failing": [
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > no source names a forbidden name, a page name of the global, code from strings, a selector by id, or a member key built from strings; every guarded site is at its allowed count",
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > the allowed sites are measured, not assumed: the counts above are what the sources hold",
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > a planted extra use in adapters.ts goes red: DOMParser x1, allowed x0",
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > a planted (x: { location: string }): string => x.location; in adapters.ts is not a violation",
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > a local binding named location, top or open is not a global reference (the binder, not the text)"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "src/frame-runtime/adapters.ts": "fe54ea7b07ae restored, equal"
    }
  },
  {
    "id": "L3.M19p24",
    "guard": "plant postMessage outside the bootstrap in src/frame-runtime/adapters.ts",
    "file": "src/frame-runtime/adapters.ts",
    "old": "/** The adapters for one frame over its outbox and seed (see the header). */",
    "new": "export const planted = (w: Window): void => w.postMessage(1, '*');\n\n/** The adapters for one frame over its outbox and seed (see the header). */",
    "tests": "test/frame-runtime-walls.test.ts",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/frame-runtime-walls.test.ts",
    "rc": 1,
    "red": "5 failed | 45 passed (50)",
    "failing": [
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > no source names a forbidden name, a page name of the global, code from strings, a selector by id, or a member key built from strings; every guarded site is at its allowed count",
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > the allowed sites are measured, not assumed: the counts above are what the sources hold",
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > a planted extra use in adapters.ts goes red: postMessage x1, allowed x0",
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > a planted (x: { location: string }): string => x.location; in adapters.ts is not a violation",
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > a local binding named location, top or open is not a global reference (the binder, not the text)"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "src/frame-runtime/adapters.ts": "fe54ea7b07ae restored, equal"
    }
  },
  {
    "id": "L3.M19p25",
    "guard": "plant addEventListener('message' outside the bootstrap in src/frame-runtime/adapters.ts",
    "file": "src/frame-runtime/adapters.ts",
    "old": "/** The adapters for one frame over its outbox and seed (see the header). */",
    "new": "export const planted = (w: Window): void => w.addEventListener('message', () => undefined);\n\n/** The adapters for one frame over its outbox and seed (see the header). */",
    "tests": "test/frame-runtime-walls.test.ts",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/frame-runtime-walls.test.ts",
    "rc": 1,
    "red": "4 failed | 46 passed (50)",
    "failing": [
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > no source names a forbidden name, a page name of the global, code from strings, a selector by id, or a member key built from strings; every guarded site is at its allowed count",
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > the allowed sites are measured, not assumed: the counts above are what the sources hold",
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > a planted (x: { location: string }): string => x.location; in adapters.ts is not a violation",
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > a local binding named location, top or open is not a global reference (the binder, not the text)"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "src/frame-runtime/adapters.ts": "fe54ea7b07ae restored, equal"
    }
  },
  {
    "id": "L3.M19p26",
    "guard": "plant querySelector('#…') in src/frame-runtime/adapters.ts",
    "file": "src/frame-runtime/adapters.ts",
    "old": "/** The adapters for one frame over its outbox and seed (see the header). */",
    "new": "export const planted = (d: Document): unknown => d.querySelector('#seed');\n\n/** The adapters for one frame over its outbox and seed (see the header). */",
    "tests": "test/frame-runtime-walls.test.ts",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/frame-runtime-walls.test.ts",
    "rc": 1,
    "red": "3 failed | 47 passed (50)",
    "failing": [
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > no source names a forbidden name, a page name of the global, code from strings, a selector by id, or a member key built from strings; every guarded site is at its allowed count",
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > a planted (x: { location: string }): string => x.location; in adapters.ts is not a violation",
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > a local binding named location, top or open is not a global reference (the binder, not the text)"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "src/frame-runtime/adapters.ts": "fe54ea7b07ae restored, equal"
    }
  },
  {
    "id": "L3.M19p27",
    "guard": "plant a member key built from strings in src/frame-runtime/adapters.ts",
    "file": "src/frame-runtime/adapters.ts",
    "old": "/** The adapters for one frame over its outbox and seed (see the header). */",
    "new": "export const planted = (d: Document): unknown => (d.body as unknown as Record<string, unknown>)['inner' + 'HTML'];\n\n/** The adapters for one frame over its outbox and seed (see the header). */",
    "tests": "test/frame-runtime-walls.test.ts",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/frame-runtime-walls.test.ts",
    "rc": 1,
    "red": "3 failed | 47 passed (50)",
    "failing": [
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > no source names a forbidden name, a page name of the global, code from strings, a selector by id, or a member key built from strings; every guarded site is at its allowed count",
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > a planted (x: { location: string }): string => x.location; in adapters.ts is not a violation",
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > a local binding named location, top or open is not a global reference (the binder, not the text)"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "src/frame-runtime/adapters.ts": "fe54ea7b07ae restored, equal"
    }
  },
  {
    "id": "L3.M19g1",
    "guard": "plant a test-only branch in the guard (`if (globalThis.__TEST) ...`)",
    "file": "src/frame-runtime/guard.ts",
    "old": "  add.call(window, 'submit', (e: Event) => preventDefault.call(e), true);",
    "new": "  add.call(window, 'submit', (e: Event) => preventDefault.call(e), true);\n  if ((globalThis as unknown as { __TEST?: boolean }).__TEST === true) add.call(window, 'click', () => undefined, true);",
    "tests": "test/frame-runtime-walls.test.ts",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/frame-runtime-walls.test.ts",
    "rc": 1,
    "red": "2 failed | 48 passed (50)",
    "failing": [
      "test/frame-runtime-walls.test.ts > L3.M19: the built guard.js, bootstrap.js and enhance.js > none of the three carries a test marker",
      "test/frame-runtime-walls.test.ts > L3.M19: the built guard.js, bootstrap.js and enhance.js > a planted test-only branch is seen, in each of its shapes"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "src/frame-runtime/guard.ts": "9165060de41e restored, equal"
    }
  },
  {
    "id": "L3.M19g2",
    "guard": "plant a branch on a test-named flag in the guard (`if (testHook) ...`)",
    "file": "src/frame-runtime/guard.ts",
    "old": "  add.call(window, 'submit', (e: Event) => preventDefault.call(e), true);",
    "new": "  add.call(window, 'submit', (e: Event) => preventDefault.call(e), true);\n  const testHook = (me as unknown as { dataset?: { hook?: string } }).dataset?.hook;\n  if (testHook !== undefined) add.call(window, 'click', () => undefined, true);",
    "tests": "test/frame-runtime-walls.test.ts",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/frame-runtime-walls.test.ts",
    "rc": 1,
    "red": "2 failed | 48 passed (50)",
    "failing": [
      "test/frame-runtime-walls.test.ts > L3.M19: the built guard.js, bootstrap.js and enhance.js > none of the three carries a test marker",
      "test/frame-runtime-walls.test.ts > L3.M19: the built guard.js, bootstrap.js and enhance.js > a planted test-only branch is seen, in each of its shapes"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "src/frame-runtime/guard.ts": "9165060de41e restored, equal"
    }
  }
]
```

## The face probe and the pin: `fonts.ts`, `pin.ts`, `bootstrap.ts` (L3.M21a, L3.M21b, L3.M22a to L3.M22e)

Reference §5.5 step 2 and §6.2 step 5, prototype finding P-4. Unit rows in `test/frame-runtime.test.ts` (jsdom). L3.M22b (the bootstrap never calls the pin) is red through the source-order row, because with Task 5's interim empty list no browser row can tell the pin apart (the plan: "the pin is proven here at unit level"). L3.M22e (pin configurable) is an extra row beside the plan's three.

| Row | Guard | Change | Red | Restore |
|---|---|---|---|---|
| L3.M21a | drop the probe: the bootstrap settles without loading the faces | `src/frame-runtime/bootstrap.ts`: `    await probeFaces(set === null \|\| set === undefined \|\| loadFaces === undefined ? null : { load: (f: string) => loadFaces.call(set, f) }, FACES, FONT_WAIT_MS); ⏎ ` → `    void set; ⏎ ` | `test/frame-runtime.test.ts`: 1 failed | 48 passed (49). "the bootstrap runs the probe with FACES and FONT_WAIT_MS after enhance and before the state becomes SETTLED" | `src/frame-runtime/bootstrap.ts` sha256 `eee5f23f9ba8…` restored, equal |
| L3.M21b | probe the regular faces only | `src/frame-runtime/fonts.ts`: `  'normal 400 1em "Docreader Serif"', ⏎   'italic 400 1em "Docreader Serif"', ⏎   'normal 400 1em "Docreader Sans"', ⏎   'italic 400 1em "Docreader Sans"',` → `  'normal 400 1em "Docreader Serif"', ⏎   'normal 400 1em "Docreader Sans"',` | `test/frame-runtime.test.ts`: 1 failed | 48 passed (49). "loads each of the four faces the frame CSS declares once: serif and sans, normal and italic" | `src/frame-runtime/fonts.ts` sha256 `306d03b717d9…` restored, equal |
| L3.M22a | skip the pin: pinFreeGlobals defines nothing | `src/frame-runtime/pin.ts`: `  for (const name of names) { ⏎     if (hasOwn.call(win, name)) continue;` → `  for (const name of names) { ⏎     if (hasOwn.call(win, name) \|\| name !== '') continue;` | `test/frame-runtime.test.ts`: 1 failed | 48 passed (49). "pins an absent and an inherited name as own non-writable, non-configurable properties; leaves an own one; an id cannot change them" | `src/frame-runtime/pin.ts` sha256 `f206b0e379ab…` restored, equal |
| L3.M22b | skip the pin: the bootstrap never calls it | `src/frame-runtime/bootstrap.ts`: `    pinFreeGlobals(win, DOCSERVER_FREE_GLOBALS); ⏎ ` → `    void DOCSERVER_FREE_GLOBALS; ⏎ ` | `test/frame-runtime.test.ts`: 1 failed | 48 passed (49). "the bootstrap pins the build's list in Phase S: once, before the adapters, the listeners and any content" | `src/frame-runtime/bootstrap.ts` sha256 `eee5f23f9ba8…` restored, equal |
| L3.M22c | pin only absent names (an inherited name is left to an id) | `src/frame-runtime/pin.ts`: `    if (hasOwn.call(win, name)) continue;` → `    if (hasOwn.call(win, name) \|\| name in win) continue;` | `test/frame-runtime.test.ts`: 1 failed | 48 passed (49). "pins an absent and an inherited name as own non-writable, non-configurable properties; leaves an own one; an id cannot change them" | `src/frame-runtime/pin.ts` sha256 `f206b0e379ab…` restored, equal |
| L3.M22d | pin writable | `src/frame-runtime/pin.ts`: `define(win, name, { value, writable: false, configurable: false });` → `define(win, name, { value, writable: true, configurable: false });` | `test/frame-runtime.test.ts`: 1 failed | 48 passed (49). "pins an absent and an inherited name as own non-writable, non-configurable properties; leaves an own one; an id cannot change them" | `src/frame-runtime/pin.ts` sha256 `f206b0e379ab…` restored, equal |
| L3.M22e | pin configurable | `src/frame-runtime/pin.ts`: `define(win, name, { value, writable: false, configurable: false });` → `define(win, name, { value, writable: false, configurable: true });` | `test/frame-runtime.test.ts`: 1 failed | 48 passed (49). "pins an absent and an inherited name as own non-writable, non-configurable properties; leaves an own one; an id cannot change them" | `src/frame-runtime/pin.ts` sha256 `f206b0e379ab…` restored, equal |

```json
[
  {
    "id": "L3.M21a",
    "guard": "drop the probe: the bootstrap settles without loading the faces",
    "file": "src/frame-runtime/bootstrap.ts",
    "old": "    await probeFaces(set === null || set === undefined || loadFaces === undefined ? null : { load: (f: string) => loadFaces.call(set, f) }, FACES, FONT_WAIT_MS);\n",
    "new": "    void set;\n",
    "tests": "test/frame-runtime.test.ts",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/frame-runtime.test.ts",
    "rc": 1,
    "red": "1 failed | 48 passed (49)",
    "failing": [
      "test/frame-runtime.test.ts > L3.M21: the face probe > the bootstrap runs the probe with FACES and FONT_WAIT_MS after enhance and before the state becomes SETTLED"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "src/frame-runtime/bootstrap.ts": "eee5f23f9ba8 restored, equal"
    }
  },
  {
    "id": "L3.M21b",
    "guard": "probe the regular faces only",
    "file": "src/frame-runtime/fonts.ts",
    "old": "  'normal 400 1em \"Docreader Serif\"',\n  'italic 400 1em \"Docreader Serif\"',\n  'normal 400 1em \"Docreader Sans\"',\n  'italic 400 1em \"Docreader Sans\"',",
    "new": "  'normal 400 1em \"Docreader Serif\"',\n  'normal 400 1em \"Docreader Sans\"',",
    "tests": "test/frame-runtime.test.ts",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/frame-runtime.test.ts",
    "rc": 1,
    "red": "1 failed | 48 passed (49)",
    "failing": [
      "test/frame-runtime.test.ts > L3.M21: the face probe > loads each of the four faces the frame CSS declares once: serif and sans, normal and italic"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "src/frame-runtime/fonts.ts": "306d03b717d9 restored, equal"
    }
  },
  {
    "id": "L3.M22a",
    "guard": "skip the pin: pinFreeGlobals defines nothing",
    "file": "src/frame-runtime/pin.ts",
    "old": "  for (const name of names) {\n    if (hasOwn.call(win, name)) continue;",
    "new": "  for (const name of names) {\n    if (hasOwn.call(win, name) || name !== '') continue;",
    "tests": "test/frame-runtime.test.ts",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/frame-runtime.test.ts",
    "rc": 1,
    "red": "1 failed | 48 passed (49)",
    "failing": [
      "test/frame-runtime.test.ts > L3.M22: pinFreeGlobals > pins an absent and an inherited name as own non-writable, non-configurable properties; leaves an own one; an id cannot change them"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "src/frame-runtime/pin.ts": "f206b0e379ab restored, equal"
    }
  },
  {
    "id": "L3.M22b",
    "guard": "skip the pin: the bootstrap never calls it",
    "file": "src/frame-runtime/bootstrap.ts",
    "old": "    pinFreeGlobals(win, DOCSERVER_FREE_GLOBALS);\n",
    "new": "    void DOCSERVER_FREE_GLOBALS;\n",
    "tests": "test/frame-runtime.test.ts",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/frame-runtime.test.ts",
    "rc": 1,
    "red": "1 failed | 48 passed (49)",
    "failing": [
      "test/frame-runtime.test.ts > L3.M22: pinFreeGlobals > the bootstrap pins the build's list in Phase S: once, before the adapters, the listeners and any content"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "src/frame-runtime/bootstrap.ts": "eee5f23f9ba8 restored, equal"
    }
  },
  {
    "id": "L3.M22c",
    "guard": "pin only absent names (an inherited name is left to an id)",
    "file": "src/frame-runtime/pin.ts",
    "old": "    if (hasOwn.call(win, name)) continue;",
    "new": "    if (hasOwn.call(win, name) || name in win) continue;",
    "tests": "test/frame-runtime.test.ts",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/frame-runtime.test.ts",
    "rc": 1,
    "red": "1 failed | 48 passed (49)",
    "failing": [
      "test/frame-runtime.test.ts > L3.M22: pinFreeGlobals > pins an absent and an inherited name as own non-writable, non-configurable properties; leaves an own one; an id cannot change them"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "src/frame-runtime/pin.ts": "f206b0e379ab restored, equal"
    }
  },
  {
    "id": "L3.M22d",
    "guard": "pin writable",
    "file": "src/frame-runtime/pin.ts",
    "old": "define(win, name, { value, writable: false, configurable: false });",
    "new": "define(win, name, { value, writable: true, configurable: false });",
    "tests": "test/frame-runtime.test.ts",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/frame-runtime.test.ts",
    "rc": 1,
    "red": "1 failed | 48 passed (49)",
    "failing": [
      "test/frame-runtime.test.ts > L3.M22: pinFreeGlobals > pins an absent and an inherited name as own non-writable, non-configurable properties; leaves an own one; an id cannot change them"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "src/frame-runtime/pin.ts": "f206b0e379ab restored, equal"
    }
  },
  {
    "id": "L3.M22e",
    "guard": "pin configurable",
    "file": "src/frame-runtime/pin.ts",
    "old": "define(win, name, { value, writable: false, configurable: false });",
    "new": "define(win, name, { value, writable: false, configurable: true });",
    "tests": "test/frame-runtime.test.ts",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/frame-runtime.test.ts",
    "rc": 1,
    "red": "1 failed | 48 passed (49)",
    "failing": [
      "test/frame-runtime.test.ts > L3.M22: pinFreeGlobals > pins an absent and an inherited name as own non-writable, non-configurable properties; leaves an own one; an id cannot change them"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "src/frame-runtime/pin.ts": "f206b0e379ab restored, equal"
    }
  }
]
```

## The browser rows: `test/browser/frame-boot.test.ts` on Chromium (L3.B3a to L3.B11a)

Reference §5.2, §6, §7, §8.3 and §6.2 step 2. Each row rebuilds the frame (`node scripts/build-frame.mjs`), because frameDocument verifies every asset against the committed manifest, runs the named rows with `DOCREADER_BROWSERS=chromium` (WebKit is proven by CI), and restores the source and the generated outputs. L3.B8a, L3.B8b and L3.B10a to L3.B10c also run `test/frame-runtime.test.ts`, whose unit halves go red too.

| Row | Guard | Change | Red | Restore |
|---|---|---|---|---|
| L3.B3a | read the seed by id (an id lookup: no seed has one, so the frame never readies) | `src/frame-runtime/bootstrap.ts`: `  const seedEl = prevSibling.call(bs);` → `  const seedEl = doc.getElementById('seed');` | `test/browser/frame-boot.test.ts`: 4 failed | 74 skipped (78). "L3.B3 (P5): headings and anchors named after the handoff still ready with the right nonce"; "L3.B3: headings and anchors named after the handoff, the globals and the scripts: ready with the right nonce, every diagram kind draws as in the clean document, links route"; "L3.B3 (instrumented: `measure` wraps appendChild before the bootstrap captures it, to time the root): no authored node exists while a script evaluates, the root is appended at DOMContentLoaded"; "L3.B3: registration is by position: with enhance blocked, an impostor at the Mermaid position that registers as enhance is refused (ready, then error assets)" | `src/frame-runtime/bootstrap.ts` sha256 `eee5f23f9ba8…` restored, equal; the generated outputs (assets.json, manifest.generated.ts, assets/frame/*.js) restored, equal |
| L3.B3b | insert content before the scripts: the root materialised in Phase S, into a body made early | `src/frame-runtime/bootstrap.ts`: `  const adapters = createAdapters(outbox, seed);` → `  appendChild.call(documentElement.call(doc) as Element, doc.createElement('body')); ⏎   root = materialise(doc, seed.html, seed.lang, new Map(seed.images), content); ⏎   const adapters = createAdapters(outbox, seed);`<br>`src/frame-runtime/bootstrap.ts`: `      root = materialise(doc, seed.html, seed.lang, new Map(seed.images), content);` → `      root = root ?? materialise(doc, seed.html, seed.lang, new Map(seed.images), content);`<br>`src/frame-runtime/bootstrap.ts`: `  const startPort = MessagePort.prototype.start;` → `  const startPort = MessagePort.prototype.start; ⏎   const appendChild = Node.prototype.appendChild;` | `test/browser/frame-boot.test.ts`: 1 failed | 3 passed | 74 skipped (78). "L3.B3 (instrumented: `measure` wraps appendChild before the bootstrap captures it, to time the root): no authored node exists while a script evaluates, the root is appended at DOMContentLoaded" | `src/frame-runtime/bootstrap.ts` sha256 `eee5f23f9ba8…` restored, equal; the generated outputs (assets.json, manifest.generated.ts, assets/frame/*.js) restored, equal |
| L3.B3c | accept registration without the position check | `src/frame-runtime/bootstrap.ts`: `    if (d['name'] === 'enhance' && from === enhanceEl && api === null) {` → `    if (d['name'] === 'enhance' && api === null) {` | `test/browser/frame-boot.test.ts`: 1 failed | 3 passed | 74 skipped (78). "L3.B3: registration is by position: with enhance blocked, an impostor at the Mermaid position that registers as enhance is refused (ready, then error assets)" | `src/frame-runtime/bootstrap.ts` sha256 `eee5f23f9ba8…` restored, equal; the generated outputs (assets.json, manifest.generated.ts, assets/frame/*.js) restored, equal |
| L3.B3d | read the seed with querySelector in Phase S instead of by position | `src/frame-runtime/bootstrap.ts`: `  const seedEl = prevSibling.call(bs);` → `  const seedEl = doc.querySelector('script[type="application/json"]');` | `test/browser/frame-boot.test.ts`: 33 passed | 45 skipped (78) (green).  | `src/frame-runtime/bootstrap.ts` sha256 `eee5f23f9ba8…` restored, equal; the generated outputs (assets.json, manifest.generated.ts, assets/frame/*.js) restored, equal |
| L3.B4a | accept any hello: the key check dropped (a hello with an extra key binds) | `src/frame-runtime/bootstrap.ts`: `    if (k.length !== 2 \|\| !k.includes('t') \|\| !k.includes('v')) return; ⏎ ` → (removed) | `test/browser/frame-boot.test.ts`: 1 failed | 1 passed | 76 skipped (78). "L3.B4 (P4): hellos with no port, an extra key or two ports get no answer; the first valid one binds; a second gets nothing" | `src/frame-runtime/bootstrap.ts` sha256 `eee5f23f9ba8…` restored, equal; the generated outputs (assets.json, manifest.generated.ts, assets/frame/*.js) restored, equal |
| L3.B4b | keep the window listener after hello | `src/frame-runtime/bootstrap.ts`: `    remove.call(win, 'message', onMessage, false); ⏎     port = p;` → `    port = p;` | `test/browser/frame-boot.test.ts`: 1 failed | 2 passed | 75 skipped (78). "L3.B11: no MessagePort is reachable from the window's own properties, and after hello no window listener takes a second hello" | `src/frame-runtime/bootstrap.ts` sha256 `eee5f23f9ba8…` restored, equal; the generated outputs (assets.json, manifest.generated.ts, assets/frame/*.js) restored, equal |
| L3.B5a | send ops at hello: the outbox opens when the port arrives, before ready | `src/frame-runtime/bootstrap.ts`: `    port = p; ⏎ ` → `    port = p; ⏎     outbox.open(); ⏎ ` | `test/browser/frame-boot.test.ts`: 1 failed | 3 passed | 74 skipped (78). "L3.B5: ops the reader made before hello cross after ready, in order: ready first, then the navigate, then the hash" | `src/frame-runtime/bootstrap.ts` sha256 `eee5f23f9ba8…` restored, equal; the generated outputs (assets.json, manifest.generated.ts, assets/frame/*.js) restored, equal |
| L3.B5b | error before ready | `src/frame-runtime/bootstrap.ts`: `    post({ t: 'ready', v: 1, nonce }); ⏎     if (state === 'failed' \|\| mismatch) { ⏎       post({ t: 'error', why: mismatch ? 'protocol' : why });` → `    if (state === 'failed' \|\| mismatch) post({ t: 'error', why: mismatch ? 'protocol' : why }); ⏎     post({ t: 'ready', v: 1, nonce }); ⏎     if (state === 'failed' \|\| mismatch) {` | `test/browser/frame-boot.test.ts`: 3 failed | 1 passed | 74 skipped (78). "L3.B5 (P3): an enhance byte flipped after verification gives ready, then error assets (and the close event, where the engine has one)"; "L3.B5 (P3b, instrumented: a close counter wraps MessagePort.prototype.close before the bootstrap runs): the frame closes its port once"; "L3.B5 (P4b): a hello with v:2 binds, and gets ready, then error protocol" | `src/frame-runtime/bootstrap.ts` sha256 `eee5f23f9ba8…` restored, equal; the generated outputs (assets.json, manifest.generated.ts, assets/frame/*.js) restored, equal |
| L3.B6a | ready on enhance resolve: no wait for Mermaid's first pass | `src/frame-runtime/bootstrap.ts`: `      if (seed.mermaid !== null) await diagramsSettled(root); ⏎ ` → (removed) | `test/browser/frame-boot.test.ts`: 2 failed | 5 passed | 71 skipped (78). "L3.B6 (P7): Mermaid as a classic IIFE draws a flowchart, a sequence and a gantt under the hash-only policy; ready waits for it"; "L3.B6 (instrumented: `observeDiagrams` times the attribute): with a set that takes longer to draw than the face probe, ready still comes only once the attribute is final" | `src/frame-runtime/bootstrap.ts` sha256 `eee5f23f9ba8…` restored, equal; the generated outputs (assets.json, manifest.generated.ts, assets/frame/*.js) restored, equal |
| L3.B6b-a | treat a missing Mermaid as assets | `src/frame-runtime/bootstrap.ts`: `      if (mermaidModule === null) { ⏎         fail('mermaid');` → `      if (mermaidModule === null) { ⏎         fail('assets');` | `test/browser/frame-boot.test.ts`: 1 failed | 1 passed | 76 skipped (78). "L3.B6b (P7): a policy that blocks the Mermaid script gives ready, then error mermaid (default Q3)" | `src/frame-runtime/bootstrap.ts` sha256 `eee5f23f9ba8…` restored, equal; the generated outputs (assets.json, manifest.generated.ts, assets/frame/*.js) restored, equal |
| L3.B6b-b | treat a missing or incomplete Mermaid as no wait: ready with no error | `src/frame-runtime/bootstrap.ts`: `      if (mermaidModule === null) { ⏎         fail('mermaid'); ⏎         return; ⏎       } ⏎       if (typeof mermaidModule['initialize'] !== 'function' \|\| typeof mermaidModule['run'] !== 'function') { ⏎         fail('mermaid'); ⏎         return; ⏎       }` → `      if (mermaidModule === null \|\| typeof mermaidModule['run'] !== 'function') mermaidApi = null;` | `test/browser/frame-boot.test.ts`: 2 failed | 76 skipped (78). "L3.B6b (P7): a policy that blocks the Mermaid script gives ready, then error mermaid (default Q3)"; "L3.B6b: a Mermaid script replaced by one that registers an API without run (its hash re-pinned) gives ready, then error mermaid" | `src/frame-runtime/bootstrap.ts` sha256 `eee5f23f9ba8…` restored, equal; the generated outputs (assets.json, manifest.generated.ts, assets/frame/*.js) restored, equal |
| L3.B7a | remove the net | `src/frame-runtime/guard.ts`: `  add.call(window, 'click', net, false); ⏎   add.call(window, 'auxclick', net, false); ⏎ ` → (removed) | `test/browser/frame-boot.test.ts`: 6 failed | 1 passed | 71 skipped (78). "L3.B7 (P6) before enhance: the guard alone keeps every link shape from navigating, stopped clicks and submit included (its guard-less twin navigates on a plain click)"; "L3.B7 (P6) after enhance, with Ctrl held and with the middle button: no second load, every link reaches navigate; stopped clicks and an in-document fragment do not"; "L3.B7 (P6) other buttons: a right click and auxclicks of buttons 2, 3 and 4 on a link send nothing; button 1 on the same path sends navigate"; "L3.B7: protocol-relative, target=_blank, area and SVG links, before enhance, keep the frame on its one load"; "L3.B7: after a failed enhance (an enhance that rejects, its hash re-pinned) the content keeps its links from navigating, and nothing crosses after the error"; and 1 more | `src/frame-runtime/guard.ts` sha256 `9165060de41e…` restored, equal; the generated outputs (assets.json, manifest.generated.ts, assets/frame/*.js) restored, equal |
| L3.B7b | a capture-phase net (P-7) | `src/frame-runtime/guard.ts`: `  add.call(window, 'click', net, false); ⏎   add.call(window, 'auxclick', net, false);` → `  add.call(window, 'click', net, true); ⏎   add.call(window, 'auxclick', net, true);` | `test/browser/frame-boot.test.ts`: 1 failed | 6 passed | 71 skipped (78). "L3.B7 (P6) after enhance, with Ctrl held and with the middle button: no second load, every link reaches navigate; stopped clicks and an in-document fragment do not" | `src/frame-runtime/guard.ts` sha256 `9165060de41e…` restored, equal; the generated outputs (assets.json, manifest.generated.ts, assets/frame/*.js) restored, equal |
| L3.B7c | remove the stopPropagation wrapper | `src/frame-runtime/guard.ts`: `  for (const name of ['stopPropagation', 'stopImmediatePropagation'] as const) {` → `  for (const name of ['stopImmediatePropagation'] as const) {` | `test/browser/frame-boot.test.ts`: 6 failed | 1 passed | 71 skipped (78). "L3.B7 (P6) before enhance: the guard alone keeps every link shape from navigating, stopped clicks and submit included (its guard-less twin navigates on a plain click)"; "L3.B7 (P6) after enhance, with Ctrl held and with the middle button: no second load, every link reaches navigate; stopped clicks and an in-document fragment do not"; "L3.B7 (P6) other buttons: a right click and auxclicks of buttons 2, 3 and 4 on a link send nothing; button 1 on the same path sends navigate"; "L3.B7: after enhance, a protocol-relative link and the missing-image chip reach navigate; no second load"; "L3.B7: after a failed enhance (an enhance that rejects, its hash re-pinned) the content keeps its links from navigating, and nothing crosses after the error"; and 1 more | `src/frame-runtime/guard.ts` sha256 `9165060de41e…` restored, equal; the generated outputs (assets.json, manifest.generated.ts, assets/frame/*.js) restored, equal |
| L3.B7d | remove the stopImmediatePropagation wrapper | `src/frame-runtime/guard.ts`: `  for (const name of ['stopPropagation', 'stopImmediatePropagation'] as const) {` → `  for (const name of ['stopPropagation'] as const) {` | `test/browser/frame-boot.test.ts`: 2 failed | 5 passed | 71 skipped (78). "L3.B7 (P6) before enhance: the guard alone keeps every link shape from navigating, stopped clicks and submit included (its guard-less twin navigates on a plain click)"; "L3.B7 (P6) after enhance, with Ctrl held and with the middle button: no second load, every link reaches navigate; stopped clicks and an in-document fragment do not" | `src/frame-runtime/guard.ts` sha256 `9165060de41e…` restored, equal; the generated outputs (assets.json, manifest.generated.ts, assets/frame/*.js) restored, equal |
| L3.B7e | remove the cancelBubble wrapper | `src/frame-runtime/guard.ts`: `  if (cancel !== undefined && cancelSet !== undefined) {` → `  if (cancel !== undefined && cancelSet !== undefined && cancel === null) {` | `test/browser/frame-boot.test.ts`: 2 failed | 5 passed | 71 skipped (78). "L3.B7 (P6) before enhance: the guard alone keeps every link shape from navigating, stopped clicks and submit included (its guard-less twin navigates on a plain click)"; "L3.B7 (P6) after enhance, with Ctrl held and with the middle button: no second load, every link reaches navigate; stopped clicks and an in-document fragment do not" | `src/frame-runtime/guard.ts` sha256 `9165060de41e…` restored, equal; the generated outputs (assets.json, manifest.generated.ts, assets/frame/*.js) restored, equal |
| L3.B7f | drop the button rule: every button's auxclick is forwarded | `src/frame-runtime/guard.ts`: `    if (typeOf.call(event) === 'auxclick' && button !== 1) return; ⏎ ` → (removed) | `test/browser/frame-boot.test.ts`: 1 failed | 6 passed | 71 skipped (78). "L3.B7 (P6) other buttons: a right click and auxclicks of buttons 2, 3 and 4 on a link send nothing; button 1 on the same path sends navigate" | `src/frame-runtime/guard.ts` sha256 `9165060de41e…` restored, equal; the generated outputs (assets.json, manifest.generated.ts, assets/frame/*.js) restored, equal |
| L3.B7g | prevent only the forwarded buttons (P-13: red on WebKit only) | `src/frame-runtime/guard.ts`: `    preventDefault.call(event); ⏎     const button = buttonOf.call(event); ⏎     if (typeOf.call(event) === 'auxclick' && button !== 1) return;` → `    const button = buttonOf.call(event); ⏎     if (typeOf.call(event) === 'auxclick' && button !== 1) return; ⏎     preventDefault.call(event);` | `test/browser/frame-boot.test.ts`: 7 passed | 71 skipped (78) (green).  | `src/frame-runtime/guard.ts` sha256 `9165060de41e…` restored, equal; the generated outputs (assets.json, manifest.generated.ts, assets/frame/*.js) restored, equal |
| L3.B8a | a raw L2 key: the store key sent unmapped | `src/frame-runtime/adapters.ts`: `        outbox.send({ t: 'store.set', key: k, value: text });` → `        outbox.send({ t: 'store.set', key: key as BridgeStoreKey, value: text });` | `test/browser/frame-boot.test.ts`, `test/frame-runtime.test.ts`: 2 failed | 8 passed | 117 skipped (127). "L3.B8: the store crosses only under pref:prefs, pref:ui and doc:<DOC_FIELDS>; a delete is the JSON literal null"; "storage: the snapshot in L2 keys; set sends store.set with the bridge key, the literal null for a delete, and drops other keys and oversize values" | `src/frame-runtime/adapters.ts` sha256 `fe54ea7b07ae…` restored, equal; the generated outputs (assets.json, manifest.generated.ts, assets/frame/*.js) restored, equal |
| L3.B8b | '' for delete | `src/frame-runtime/adapters.ts`: `        const text = value === null ? 'null' : value; ⏎         if (typeof text !== 'string' \|\| utf8Bytes(text) > BRIDGE_LIMITS.valueMaxBytes) return; ⏎         try { ⏎           parse(text); ⏎         } catch { ⏎           return; ⏎         }` → `        const text = value === null ? '' : value; ⏎         if (typeof text !== 'string' \|\| utf8Bytes(text) > BRIDGE_LIMITS.valueMaxBytes) return; ⏎         try { ⏎           if (text !== '') parse(text); ⏎         } catch { ⏎           return; ⏎         }` | `test/browser/frame-boot.test.ts`, `test/frame-runtime.test.ts`: 2 failed | 8 passed | 117 skipped (127). "L3.B8: the store crosses only under pref:prefs, pref:ui and doc:<DOC_FIELDS>; a delete is the JSON literal null"; "storage: the snapshot in L2 keys; set sends store.set with the bridge key, the literal null for a delete, and drops other keys and oversize values" | `src/frame-runtime/adapters.ts` sha256 `fe54ea7b07ae…` restored, equal; the generated outputs (assets.json, manifest.generated.ts, assets/frame/*.js) restored, equal |
| L3.B9a | drop check (a): the opaque origin | `src/frame-runtime/bootstrap.ts`: `      origin === 'null' && ⏎ ` → (removed) | `test/browser/frame-boot.test.ts`: 2 failed | 1 passed | 75 skipped (78). "L3.B9 (P11): mounted with no sandbox attribute, the frame gives ready, then error boot (self-check (a): an opaque origin)"; "L3.B9 (P11): mounted with sandbox="allow-scripts allow-same-origin", the frame gives ready, then error boot (self-check (a): an opaque origin)" | `src/frame-runtime/bootstrap.ts` sha256 `eee5f23f9ba8…` restored, equal; the generated outputs (assets.json, manifest.generated.ts, assets/frame/*.js) restored, equal |
| L3.B9b | drop check (b): the policy floor | `src/frame-runtime/bootstrap.ts`: `      cspFloor(getAttribute.call(meta, 'content') ?? '').ok && ⏎ ` → (removed) | `test/browser/frame-boot.test.ts`: 1 failed | 2 passed | 75 skipped (78). "L3.B9: a meta that adds connect-src * gives ready, then error boot (self-check (b): the policy floor)" | `src/frame-runtime/bootstrap.ts` sha256 `eee5f23f9ba8…` restored, equal; the generated outputs (assets.json, manifest.generated.ts, assets/frame/*.js) restored, equal |
| L3.B10a | allow any tag | `src/frame-runtime/content.ts`: `    if (!TAGS.has(el.localName)) return no(`<${el.localName}>`); ⏎ ` → (removed) | `test/browser/frame-boot.test.ts`, `test/frame-runtime.test.ts`: 7 failed | 25 passed | 95 skipped (127). "L3.B10: a planted script, iframe, img onerror, fixed style, base, form, meta, object, embed or img name each give ready, then error render"; "refuses <script>"; "refuses <iframe>"; "refuses <form>"; "refuses <object>"; and 2 more | `src/frame-runtime/content.ts` sha256 `49a4ebd98e34…` restored, equal; the generated outputs (assets.json, manifest.generated.ts, assets/frame/*.js) restored, equal |
| L3.B10b | drop `open` from the vocabulary | `src/frame-runtime/vocabulary.ts`: `'id', 'open', 'src'` → `'id', 'src'` | `test/browser/frame-boot.test.ts`, `test/frame-runtime.test.ts`: 5 failed | 27 passed | 95 skipped (127). "L3.B10: every golden and hostile corpus output readies with no error, `<details open>` among them"; "the committed vocabulary.ts equals a fresh scan: `node scripts/gen-frame-vocabulary.mjs --check` exits 0"; "the lists hold no `name` attribute, no `on...` attribute, and none of embed, form, iframe or object"; "every golden and hostile corpus output is accepted, `<details open>` and task lists included"; "accepts the same documents without the planted part (the refusals above are the parts, not the shapes)" | `src/frame-runtime/vocabulary.ts` sha256 `f080694e16ac…` restored, equal; the generated outputs (assets.json, manifest.generated.ts, assets/frame/*.js) restored, equal |
| L3.B10c | admit `name` | `src/frame-runtime/content.ts`: `    if (/^on/i.test(name) \|\| name === 'name' \|\| !ATTRIBUTES.has(name)) return `<${tag} ${name}>`;` → `    if (/^on/i.test(name) \|\| (!ATTRIBUTES.has(name) && name !== 'name')) return `<${tag} ${name}>`;` | `test/browser/frame-boot.test.ts`, `test/frame-runtime.test.ts`: 3 failed | 29 passed | 95 skipped (127). "L3.B10: a planted script, iframe, img onerror, fixed style, base, form, meta, object, embed or img name each give ready, then error render"; "refuses <img name=x>"; "refuses <a name=x>" | `src/frame-runtime/content.ts` sha256 `49a4ebd98e34…` restored, equal; the generated outputs (assets.json, manifest.generated.ts, assets/frame/*.js) restored, equal |
| L3.B11a | store the port on a property of the window | `src/frame-runtime/bootstrap.ts`: `    port = p; ⏎ ` → `    port = p; ⏎     (win as unknown as Record<string, unknown>)['docserverPort'] = p; ⏎ ` | `test/browser/frame-boot.test.ts`: 1 failed | 77 skipped (78). "L3.B11: no MessagePort is reachable from the window's own properties, and after hello no window listener takes a second hello" | `src/frame-runtime/bootstrap.ts` sha256 `eee5f23f9ba8…` restored, equal; the generated outputs (assets.json, manifest.generated.ts, assets/frame/*.js) restored, equal |

```json
[
  {
    "id": "L3.B3a",
    "guard": "read the seed by id (an id lookup: no seed has one, so the frame never readies)",
    "file": "src/frame-runtime/bootstrap.ts",
    "old": "  const seedEl = prevSibling.call(bs);",
    "new": "  const seedEl = doc.getElementById('seed');",
    "tests": "test/browser/frame-boot.test.ts",
    "filter": "L3.B3",
    "rebuild": "node scripts/build-frame.mjs before the run; the generated outputs restored after it",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 -t \"L3.B3\" test/browser/frame-boot.test.ts",
    "rc": 1,
    "red": "4 failed | 74 skipped (78)",
    "failing": [
      "test/browser/frame-boot.test.ts > chromium > L3.B3 (P5): headings and anchors named after the handoff still ready with the right nonce",
      "test/browser/frame-boot.test.ts > chromium > L3.B3: headings and anchors named after the handoff, the globals and the scripts: ready with the right nonce, every diagram kind draws as in the clean document, links route",
      "test/browser/frame-boot.test.ts > chromium > L3.B3 (instrumented: `measure` wraps appendChild before the bootstrap captures it, to time the root): no authored node exists while a script evaluates, the root is appended at DOMContentLoaded",
      "test/browser/frame-boot.test.ts > chromium > L3.B3: registration is by position: with enhance blocked, an impostor at the Mermaid position that registers as enhance is refused (ready, then error assets)"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "src/frame-runtime/bootstrap.ts": "eee5f23f9ba8 restored, equal",
      "assets/assets.json": "301a9f4b1f18 restored, equal",
      "src/frame/manifest.generated.ts": "9ecaf8b12741 restored, equal",
      "assets/frame/guard.js": "ff3c25da5703 restored, equal",
      "assets/frame/bootstrap.js": "eebfd00a3621 restored, equal",
      "assets/frame/enhance.js": "33232f70834a restored, equal"
    }
  },
  {
    "id": "L3.B3b",
    "guard": "insert content before the scripts: the root materialised in Phase S, into a body made early",
    "changes": [
      {
        "file": "src/frame-runtime/bootstrap.ts",
        "old": "  const adapters = createAdapters(outbox, seed);",
        "new": "  appendChild.call(documentElement.call(doc) as Element, doc.createElement('body'));\n  root = materialise(doc, seed.html, seed.lang, new Map(seed.images), content);\n  const adapters = createAdapters(outbox, seed);"
      },
      {
        "file": "src/frame-runtime/bootstrap.ts",
        "old": "      root = materialise(doc, seed.html, seed.lang, new Map(seed.images), content);",
        "new": "      root = root ?? materialise(doc, seed.html, seed.lang, new Map(seed.images), content);"
      },
      {
        "file": "src/frame-runtime/bootstrap.ts",
        "old": "  const startPort = MessagePort.prototype.start;",
        "new": "  const startPort = MessagePort.prototype.start;\n  const appendChild = Node.prototype.appendChild;"
      }
    ],
    "tests": "test/browser/frame-boot.test.ts",
    "filter": "L3.B3",
    "rebuild": "node scripts/build-frame.mjs before the run; the generated outputs restored after it",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 -t \"L3.B3\" test/browser/frame-boot.test.ts",
    "rc": 1,
    "red": "1 failed | 3 passed | 74 skipped (78)",
    "failing": [
      "test/browser/frame-boot.test.ts > chromium > L3.B3 (instrumented: `measure` wraps appendChild before the bootstrap captures it, to time the root): no authored node exists while a script evaluates, the root is appended at DOMContentLoaded"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "src/frame-runtime/bootstrap.ts": "eee5f23f9ba8 restored, equal",
      "assets/assets.json": "301a9f4b1f18 restored, equal",
      "src/frame/manifest.generated.ts": "9ecaf8b12741 restored, equal",
      "assets/frame/guard.js": "ff3c25da5703 restored, equal",
      "assets/frame/bootstrap.js": "eebfd00a3621 restored, equal",
      "assets/frame/enhance.js": "33232f70834a restored, equal"
    }
  },
  {
    "id": "L3.B3c",
    "guard": "accept registration without the position check",
    "file": "src/frame-runtime/bootstrap.ts",
    "old": "    if (d['name'] === 'enhance' && from === enhanceEl && api === null) {",
    "new": "    if (d['name'] === 'enhance' && api === null) {",
    "tests": "test/browser/frame-boot.test.ts",
    "filter": "L3.B3",
    "rebuild": "node scripts/build-frame.mjs before the run; the generated outputs restored after it",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 -t \"L3.B3\" test/browser/frame-boot.test.ts",
    "rc": 1,
    "red": "1 failed | 3 passed | 74 skipped (78)",
    "failing": [
      "test/browser/frame-boot.test.ts > chromium > L3.B3: registration is by position: with enhance blocked, an impostor at the Mermaid position that registers as enhance is refused (ready, then error assets)"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "src/frame-runtime/bootstrap.ts": "eee5f23f9ba8 restored, equal",
      "assets/assets.json": "301a9f4b1f18 restored, equal",
      "src/frame/manifest.generated.ts": "9ecaf8b12741 restored, equal",
      "assets/frame/guard.js": "ff3c25da5703 restored, equal",
      "assets/frame/bootstrap.js": "eebfd00a3621 restored, equal",
      "assets/frame/enhance.js": "33232f70834a restored, equal"
    }
  },
  {
    "id": "L3.B3d",
    "guard": "read the seed with querySelector in Phase S instead of by position",
    "file": "src/frame-runtime/bootstrap.ts",
    "old": "  const seedEl = prevSibling.call(bs);",
    "new": "  const seedEl = doc.querySelector('script[type=\"application/json\"]');",
    "tests": "test/browser/frame-boot.test.ts",
    "filter": "L3.B",
    "rebuild": "node scripts/build-frame.mjs before the run; the generated outputs restored after it",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 -t \"L3.B\" test/browser/frame-boot.test.ts",
    "rc": 0,
    "red": "33 passed | 45 skipped (78) (green)",
    "failing": [],
    "errors": [],
    "restore": {
      "src/frame-runtime/bootstrap.ts": "eee5f23f9ba8 restored, equal",
      "assets/assets.json": "301a9f4b1f18 restored, equal",
      "src/frame/manifest.generated.ts": "9ecaf8b12741 restored, equal",
      "assets/frame/guard.js": "ff3c25da5703 restored, equal",
      "assets/frame/bootstrap.js": "eebfd00a3621 restored, equal",
      "assets/frame/enhance.js": "33232f70834a restored, equal"
    }
  },
  {
    "id": "L3.B4a",
    "guard": "accept any hello: the key check dropped (a hello with an extra key binds)",
    "file": "src/frame-runtime/bootstrap.ts",
    "old": "    if (k.length !== 2 || !k.includes('t') || !k.includes('v')) return;\n",
    "new": "",
    "tests": "test/browser/frame-boot.test.ts",
    "filter": "L3.B4",
    "rebuild": "node scripts/build-frame.mjs before the run; the generated outputs restored after it",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 -t \"L3.B4\" test/browser/frame-boot.test.ts",
    "rc": 1,
    "red": "1 failed | 1 passed | 76 skipped (78)",
    "failing": [
      "test/browser/frame-boot.test.ts > chromium > L3.B4 (P4): hellos with no port, an extra key or two ports get no answer; the first valid one binds; a second gets nothing"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "src/frame-runtime/bootstrap.ts": "eee5f23f9ba8 restored, equal",
      "assets/assets.json": "301a9f4b1f18 restored, equal",
      "src/frame/manifest.generated.ts": "9ecaf8b12741 restored, equal",
      "assets/frame/guard.js": "ff3c25da5703 restored, equal",
      "assets/frame/bootstrap.js": "eebfd00a3621 restored, equal",
      "assets/frame/enhance.js": "33232f70834a restored, equal"
    }
  },
  {
    "id": "L3.B4b",
    "guard": "keep the window listener after hello",
    "file": "src/frame-runtime/bootstrap.ts",
    "old": "    remove.call(win, 'message', onMessage, false);\n    port = p;",
    "new": "    port = p;",
    "tests": "test/browser/frame-boot.test.ts",
    "filter": "L3.B4|L3.B11",
    "rebuild": "node scripts/build-frame.mjs before the run; the generated outputs restored after it",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 -t \"L3.B4|L3.B11\" test/browser/frame-boot.test.ts",
    "rc": 1,
    "red": "1 failed | 2 passed | 75 skipped (78)",
    "failing": [
      "test/browser/frame-boot.test.ts > chromium > L3.B11: no MessagePort is reachable from the window's own properties, and after hello no window listener takes a second hello"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "src/frame-runtime/bootstrap.ts": "eee5f23f9ba8 restored, equal",
      "assets/assets.json": "301a9f4b1f18 restored, equal",
      "src/frame/manifest.generated.ts": "9ecaf8b12741 restored, equal",
      "assets/frame/guard.js": "ff3c25da5703 restored, equal",
      "assets/frame/bootstrap.js": "eebfd00a3621 restored, equal",
      "assets/frame/enhance.js": "33232f70834a restored, equal"
    }
  },
  {
    "id": "L3.B5a",
    "guard": "send ops at hello: the outbox opens when the port arrives, before ready",
    "file": "src/frame-runtime/bootstrap.ts",
    "old": "    port = p;\n",
    "new": "    port = p;\n    outbox.open();\n",
    "tests": "test/browser/frame-boot.test.ts",
    "filter": "L3.B5",
    "rebuild": "node scripts/build-frame.mjs before the run; the generated outputs restored after it",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 -t \"L3.B5\" test/browser/frame-boot.test.ts",
    "rc": 1,
    "red": "1 failed | 3 passed | 74 skipped (78)",
    "failing": [
      "test/browser/frame-boot.test.ts > chromium > L3.B5: ops the reader made before hello cross after ready, in order: ready first, then the navigate, then the hash"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "src/frame-runtime/bootstrap.ts": "eee5f23f9ba8 restored, equal",
      "assets/assets.json": "301a9f4b1f18 restored, equal",
      "src/frame/manifest.generated.ts": "9ecaf8b12741 restored, equal",
      "assets/frame/guard.js": "ff3c25da5703 restored, equal",
      "assets/frame/bootstrap.js": "eebfd00a3621 restored, equal",
      "assets/frame/enhance.js": "33232f70834a restored, equal"
    }
  },
  {
    "id": "L3.B5b",
    "guard": "error before ready",
    "file": "src/frame-runtime/bootstrap.ts",
    "old": "    post({ t: 'ready', v: 1, nonce });\n    if (state === 'failed' || mismatch) {\n      post({ t: 'error', why: mismatch ? 'protocol' : why });",
    "new": "    if (state === 'failed' || mismatch) post({ t: 'error', why: mismatch ? 'protocol' : why });\n    post({ t: 'ready', v: 1, nonce });\n    if (state === 'failed' || mismatch) {",
    "tests": "test/browser/frame-boot.test.ts",
    "filter": "L3.B5",
    "rebuild": "node scripts/build-frame.mjs before the run; the generated outputs restored after it",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 -t \"L3.B5\" test/browser/frame-boot.test.ts",
    "rc": 1,
    "red": "3 failed | 1 passed | 74 skipped (78)",
    "failing": [
      "test/browser/frame-boot.test.ts > chromium > L3.B5 (P3): an enhance byte flipped after verification gives ready, then error assets (and the close event, where the engine has one)",
      "test/browser/frame-boot.test.ts > chromium > L3.B5 (P3b, instrumented: a close counter wraps MessagePort.prototype.close before the bootstrap runs): the frame closes its port once",
      "test/browser/frame-boot.test.ts > chromium > L3.B5 (P4b): a hello with v:2 binds, and gets ready, then error protocol"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "src/frame-runtime/bootstrap.ts": "eee5f23f9ba8 restored, equal",
      "assets/assets.json": "301a9f4b1f18 restored, equal",
      "src/frame/manifest.generated.ts": "9ecaf8b12741 restored, equal",
      "assets/frame/guard.js": "ff3c25da5703 restored, equal",
      "assets/frame/bootstrap.js": "eebfd00a3621 restored, equal",
      "assets/frame/enhance.js": "33232f70834a restored, equal"
    }
  },
  {
    "id": "L3.B6a",
    "guard": "ready on enhance resolve: no wait for Mermaid's first pass",
    "file": "src/frame-runtime/bootstrap.ts",
    "old": "      if (seed.mermaid !== null) await diagramsSettled(root);\n",
    "new": "",
    "tests": "test/browser/frame-boot.test.ts",
    "filter": "L3.B6",
    "rebuild": "node scripts/build-frame.mjs before the run; the generated outputs restored after it",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 -t \"L3.B6\" test/browser/frame-boot.test.ts",
    "rc": 1,
    "red": "2 failed | 5 passed | 71 skipped (78)",
    "failing": [
      "test/browser/frame-boot.test.ts > chromium > L3.B6 (P7): Mermaid as a classic IIFE draws a flowchart, a sequence and a gantt under the hash-only policy; ready waits for it",
      "test/browser/frame-boot.test.ts > chromium > L3.B6 (instrumented: `observeDiagrams` times the attribute): with a set that takes longer to draw than the face probe, ready still comes only once the attribute is final"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "src/frame-runtime/bootstrap.ts": "eee5f23f9ba8 restored, equal",
      "assets/assets.json": "301a9f4b1f18 restored, equal",
      "src/frame/manifest.generated.ts": "9ecaf8b12741 restored, equal",
      "assets/frame/guard.js": "ff3c25da5703 restored, equal",
      "assets/frame/bootstrap.js": "eebfd00a3621 restored, equal",
      "assets/frame/enhance.js": "33232f70834a restored, equal"
    }
  },
  {
    "id": "L3.B6b-a",
    "guard": "treat a missing Mermaid as assets",
    "file": "src/frame-runtime/bootstrap.ts",
    "old": "      if (mermaidModule === null) {\n        fail('mermaid');",
    "new": "      if (mermaidModule === null) {\n        fail('assets');",
    "tests": "test/browser/frame-boot.test.ts",
    "filter": "L3.B6b",
    "rebuild": "node scripts/build-frame.mjs before the run; the generated outputs restored after it",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 -t \"L3.B6b\" test/browser/frame-boot.test.ts",
    "rc": 1,
    "red": "1 failed | 1 passed | 76 skipped (78)",
    "failing": [
      "test/browser/frame-boot.test.ts > chromium > L3.B6b (P7): a policy that blocks the Mermaid script gives ready, then error mermaid (default Q3)"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "src/frame-runtime/bootstrap.ts": "eee5f23f9ba8 restored, equal",
      "assets/assets.json": "301a9f4b1f18 restored, equal",
      "src/frame/manifest.generated.ts": "9ecaf8b12741 restored, equal",
      "assets/frame/guard.js": "ff3c25da5703 restored, equal",
      "assets/frame/bootstrap.js": "eebfd00a3621 restored, equal",
      "assets/frame/enhance.js": "33232f70834a restored, equal"
    }
  },
  {
    "id": "L3.B6b-b",
    "guard": "treat a missing or incomplete Mermaid as no wait: ready with no error",
    "file": "src/frame-runtime/bootstrap.ts",
    "old": "      if (mermaidModule === null) {\n        fail('mermaid');\n        return;\n      }\n      if (typeof mermaidModule['initialize'] !== 'function' || typeof mermaidModule['run'] !== 'function') {\n        fail('mermaid');\n        return;\n      }",
    "new": "      if (mermaidModule === null || typeof mermaidModule['run'] !== 'function') mermaidApi = null;",
    "tests": "test/browser/frame-boot.test.ts",
    "filter": "L3.B6b",
    "rebuild": "node scripts/build-frame.mjs before the run; the generated outputs restored after it",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 -t \"L3.B6b\" test/browser/frame-boot.test.ts",
    "rc": 1,
    "red": "2 failed | 76 skipped (78)",
    "failing": [
      "test/browser/frame-boot.test.ts > chromium > L3.B6b (P7): a policy that blocks the Mermaid script gives ready, then error mermaid (default Q3)",
      "test/browser/frame-boot.test.ts > chromium > L3.B6b: a Mermaid script replaced by one that registers an API without run (its hash re-pinned) gives ready, then error mermaid"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "src/frame-runtime/bootstrap.ts": "eee5f23f9ba8 restored, equal",
      "assets/assets.json": "301a9f4b1f18 restored, equal",
      "src/frame/manifest.generated.ts": "9ecaf8b12741 restored, equal",
      "assets/frame/guard.js": "ff3c25da5703 restored, equal",
      "assets/frame/bootstrap.js": "eebfd00a3621 restored, equal",
      "assets/frame/enhance.js": "33232f70834a restored, equal"
    }
  },
  {
    "id": "L3.B7a",
    "guard": "remove the net",
    "file": "src/frame-runtime/guard.ts",
    "old": "  add.call(window, 'click', net, false);\n  add.call(window, 'auxclick', net, false);\n",
    "new": "",
    "tests": "test/browser/frame-boot.test.ts",
    "filter": "L3.B7",
    "rebuild": "node scripts/build-frame.mjs before the run; the generated outputs restored after it",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 -t \"L3.B7\" test/browser/frame-boot.test.ts",
    "rc": 1,
    "red": "6 failed | 1 passed | 71 skipped (78)",
    "failing": [
      "test/browser/frame-boot.test.ts > chromium > L3.B7 (P6) before enhance: the guard alone keeps every link shape from navigating, stopped clicks and submit included (its guard-less twin navigates on a plain click)",
      "test/browser/frame-boot.test.ts > chromium > L3.B7 (P6) after enhance, with Ctrl held and with the middle button: no second load, every link reaches navigate; stopped clicks and an in-document fragment do not",
      "test/browser/frame-boot.test.ts > chromium > L3.B7 (P6) other buttons: a right click and auxclicks of buttons 2, 3 and 4 on a link send nothing; button 1 on the same path sends navigate",
      "test/browser/frame-boot.test.ts > chromium > L3.B7: protocol-relative, target=_blank, area and SVG links, before enhance, keep the frame on its one load",
      "test/browser/frame-boot.test.ts > chromium > L3.B7: after a failed enhance (an enhance that rejects, its hash re-pinned) the content keeps its links from navigating, and nothing crosses after the error",
      "test/browser/frame-boot.test.ts > chromium > L3.B7: a link inside a drawn Mermaid figure (an SVG a) reaches navigate; no second load"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "src/frame-runtime/guard.ts": "9165060de41e restored, equal",
      "assets/assets.json": "301a9f4b1f18 restored, equal",
      "src/frame/manifest.generated.ts": "9ecaf8b12741 restored, equal",
      "assets/frame/guard.js": "ff3c25da5703 restored, equal",
      "assets/frame/bootstrap.js": "eebfd00a3621 restored, equal",
      "assets/frame/enhance.js": "33232f70834a restored, equal"
    }
  },
  {
    "id": "L3.B7b",
    "guard": "a capture-phase net (P-7)",
    "file": "src/frame-runtime/guard.ts",
    "old": "  add.call(window, 'click', net, false);\n  add.call(window, 'auxclick', net, false);",
    "new": "  add.call(window, 'click', net, true);\n  add.call(window, 'auxclick', net, true);",
    "tests": "test/browser/frame-boot.test.ts",
    "filter": "L3.B7",
    "rebuild": "node scripts/build-frame.mjs before the run; the generated outputs restored after it",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 -t \"L3.B7\" test/browser/frame-boot.test.ts",
    "rc": 1,
    "red": "1 failed | 6 passed | 71 skipped (78)",
    "failing": [
      "test/browser/frame-boot.test.ts > chromium > L3.B7 (P6) after enhance, with Ctrl held and with the middle button: no second load, every link reaches navigate; stopped clicks and an in-document fragment do not"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "src/frame-runtime/guard.ts": "9165060de41e restored, equal",
      "assets/assets.json": "301a9f4b1f18 restored, equal",
      "src/frame/manifest.generated.ts": "9ecaf8b12741 restored, equal",
      "assets/frame/guard.js": "ff3c25da5703 restored, equal",
      "assets/frame/bootstrap.js": "eebfd00a3621 restored, equal",
      "assets/frame/enhance.js": "33232f70834a restored, equal"
    }
  },
  {
    "id": "L3.B7c",
    "guard": "remove the stopPropagation wrapper",
    "file": "src/frame-runtime/guard.ts",
    "old": "  for (const name of ['stopPropagation', 'stopImmediatePropagation'] as const) {",
    "new": "  for (const name of ['stopImmediatePropagation'] as const) {",
    "tests": "test/browser/frame-boot.test.ts",
    "filter": "L3.B7",
    "rebuild": "node scripts/build-frame.mjs before the run; the generated outputs restored after it",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 -t \"L3.B7\" test/browser/frame-boot.test.ts",
    "rc": 1,
    "red": "6 failed | 1 passed | 71 skipped (78)",
    "failing": [
      "test/browser/frame-boot.test.ts > chromium > L3.B7 (P6) before enhance: the guard alone keeps every link shape from navigating, stopped clicks and submit included (its guard-less twin navigates on a plain click)",
      "test/browser/frame-boot.test.ts > chromium > L3.B7 (P6) after enhance, with Ctrl held and with the middle button: no second load, every link reaches navigate; stopped clicks and an in-document fragment do not",
      "test/browser/frame-boot.test.ts > chromium > L3.B7 (P6) other buttons: a right click and auxclicks of buttons 2, 3 and 4 on a link send nothing; button 1 on the same path sends navigate",
      "test/browser/frame-boot.test.ts > chromium > L3.B7: after enhance, a protocol-relative link and the missing-image chip reach navigate; no second load",
      "test/browser/frame-boot.test.ts > chromium > L3.B7: after a failed enhance (an enhance that rejects, its hash re-pinned) the content keeps its links from navigating, and nothing crosses after the error",
      "test/browser/frame-boot.test.ts > chromium > L3.B7: a link inside a drawn Mermaid figure (an SVG a) reaches navigate; no second load"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "src/frame-runtime/guard.ts": "9165060de41e restored, equal",
      "assets/assets.json": "301a9f4b1f18 restored, equal",
      "src/frame/manifest.generated.ts": "9ecaf8b12741 restored, equal",
      "assets/frame/guard.js": "ff3c25da5703 restored, equal",
      "assets/frame/bootstrap.js": "eebfd00a3621 restored, equal",
      "assets/frame/enhance.js": "33232f70834a restored, equal"
    }
  },
  {
    "id": "L3.B7d",
    "guard": "remove the stopImmediatePropagation wrapper",
    "file": "src/frame-runtime/guard.ts",
    "old": "  for (const name of ['stopPropagation', 'stopImmediatePropagation'] as const) {",
    "new": "  for (const name of ['stopPropagation'] as const) {",
    "tests": "test/browser/frame-boot.test.ts",
    "filter": "L3.B7",
    "rebuild": "node scripts/build-frame.mjs before the run; the generated outputs restored after it",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 -t \"L3.B7\" test/browser/frame-boot.test.ts",
    "rc": 1,
    "red": "2 failed | 5 passed | 71 skipped (78)",
    "failing": [
      "test/browser/frame-boot.test.ts > chromium > L3.B7 (P6) before enhance: the guard alone keeps every link shape from navigating, stopped clicks and submit included (its guard-less twin navigates on a plain click)",
      "test/browser/frame-boot.test.ts > chromium > L3.B7 (P6) after enhance, with Ctrl held and with the middle button: no second load, every link reaches navigate; stopped clicks and an in-document fragment do not"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "src/frame-runtime/guard.ts": "9165060de41e restored, equal",
      "assets/assets.json": "301a9f4b1f18 restored, equal",
      "src/frame/manifest.generated.ts": "9ecaf8b12741 restored, equal",
      "assets/frame/guard.js": "ff3c25da5703 restored, equal",
      "assets/frame/bootstrap.js": "eebfd00a3621 restored, equal",
      "assets/frame/enhance.js": "33232f70834a restored, equal"
    }
  },
  {
    "id": "L3.B7e",
    "guard": "remove the cancelBubble wrapper",
    "file": "src/frame-runtime/guard.ts",
    "old": "  if (cancel !== undefined && cancelSet !== undefined) {",
    "new": "  if (cancel !== undefined && cancelSet !== undefined && cancel === null) {",
    "tests": "test/browser/frame-boot.test.ts",
    "filter": "L3.B7",
    "rebuild": "node scripts/build-frame.mjs before the run; the generated outputs restored after it",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 -t \"L3.B7\" test/browser/frame-boot.test.ts",
    "rc": 1,
    "red": "2 failed | 5 passed | 71 skipped (78)",
    "failing": [
      "test/browser/frame-boot.test.ts > chromium > L3.B7 (P6) before enhance: the guard alone keeps every link shape from navigating, stopped clicks and submit included (its guard-less twin navigates on a plain click)",
      "test/browser/frame-boot.test.ts > chromium > L3.B7 (P6) after enhance, with Ctrl held and with the middle button: no second load, every link reaches navigate; stopped clicks and an in-document fragment do not"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "src/frame-runtime/guard.ts": "9165060de41e restored, equal",
      "assets/assets.json": "301a9f4b1f18 restored, equal",
      "src/frame/manifest.generated.ts": "9ecaf8b12741 restored, equal",
      "assets/frame/guard.js": "ff3c25da5703 restored, equal",
      "assets/frame/bootstrap.js": "eebfd00a3621 restored, equal",
      "assets/frame/enhance.js": "33232f70834a restored, equal"
    }
  },
  {
    "id": "L3.B7f",
    "guard": "drop the button rule: every button's auxclick is forwarded",
    "file": "src/frame-runtime/guard.ts",
    "old": "    if (typeOf.call(event) === 'auxclick' && button !== 1) return;\n",
    "new": "",
    "tests": "test/browser/frame-boot.test.ts",
    "filter": "L3.B7",
    "rebuild": "node scripts/build-frame.mjs before the run; the generated outputs restored after it",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 -t \"L3.B7\" test/browser/frame-boot.test.ts",
    "rc": 1,
    "red": "1 failed | 6 passed | 71 skipped (78)",
    "failing": [
      "test/browser/frame-boot.test.ts > chromium > L3.B7 (P6) other buttons: a right click and auxclicks of buttons 2, 3 and 4 on a link send nothing; button 1 on the same path sends navigate"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "src/frame-runtime/guard.ts": "9165060de41e restored, equal",
      "assets/assets.json": "301a9f4b1f18 restored, equal",
      "src/frame/manifest.generated.ts": "9ecaf8b12741 restored, equal",
      "assets/frame/guard.js": "ff3c25da5703 restored, equal",
      "assets/frame/bootstrap.js": "eebfd00a3621 restored, equal",
      "assets/frame/enhance.js": "33232f70834a restored, equal"
    }
  },
  {
    "id": "L3.B7g",
    "guard": "prevent only the forwarded buttons (P-13: red on WebKit only)",
    "file": "src/frame-runtime/guard.ts",
    "old": "    preventDefault.call(event);\n    const button = buttonOf.call(event);\n    if (typeOf.call(event) === 'auxclick' && button !== 1) return;",
    "new": "    const button = buttonOf.call(event);\n    if (typeOf.call(event) === 'auxclick' && button !== 1) return;\n    preventDefault.call(event);",
    "tests": "test/browser/frame-boot.test.ts",
    "filter": "L3.B7",
    "rebuild": "node scripts/build-frame.mjs before the run; the generated outputs restored after it",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 -t \"L3.B7\" test/browser/frame-boot.test.ts",
    "rc": 0,
    "red": "7 passed | 71 skipped (78) (green)",
    "failing": [],
    "errors": [],
    "restore": {
      "src/frame-runtime/guard.ts": "9165060de41e restored, equal",
      "assets/assets.json": "301a9f4b1f18 restored, equal",
      "src/frame/manifest.generated.ts": "9ecaf8b12741 restored, equal",
      "assets/frame/guard.js": "ff3c25da5703 restored, equal",
      "assets/frame/bootstrap.js": "eebfd00a3621 restored, equal",
      "assets/frame/enhance.js": "33232f70834a restored, equal"
    }
  },
  {
    "id": "L3.B8a",
    "guard": "a raw L2 key: the store key sent unmapped",
    "file": "src/frame-runtime/adapters.ts",
    "old": "        outbox.send({ t: 'store.set', key: k, value: text });",
    "new": "        outbox.send({ t: 'store.set', key: key as BridgeStoreKey, value: text });",
    "tests": "test/browser/frame-boot.test.ts test/frame-runtime.test.ts",
    "filter": "L3.B8|adapters",
    "rebuild": "node scripts/build-frame.mjs before the run; the generated outputs restored after it",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 -t \"L3.B8|adapters\" test/browser/frame-boot.test.ts test/frame-runtime.test.ts",
    "rc": 1,
    "red": "2 failed | 8 passed | 117 skipped (127)",
    "failing": [
      "test/browser/frame-boot.test.ts > chromium > L3.B8: the store crosses only under pref:prefs, pref:ui and doc:<DOC_FIELDS>; a delete is the JSON literal null",
      "test/frame-runtime.test.ts > adapters: the enhance callbacks over the outbox (Reference §8.1, §8.3; row L3.B8 unit half) > storage: the snapshot in L2 keys; set sends store.set with the bridge key, the literal null for a delete, and drops other keys and oversize values"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "src/frame-runtime/adapters.ts": "fe54ea7b07ae restored, equal",
      "assets/assets.json": "301a9f4b1f18 restored, equal",
      "src/frame/manifest.generated.ts": "9ecaf8b12741 restored, equal",
      "assets/frame/guard.js": "ff3c25da5703 restored, equal",
      "assets/frame/bootstrap.js": "eebfd00a3621 restored, equal",
      "assets/frame/enhance.js": "33232f70834a restored, equal"
    }
  },
  {
    "id": "L3.B8b",
    "guard": "'' for delete",
    "file": "src/frame-runtime/adapters.ts",
    "old": "        const text = value === null ? 'null' : value;\n        if (typeof text !== 'string' || utf8Bytes(text) > BRIDGE_LIMITS.valueMaxBytes) return;\n        try {\n          parse(text);\n        } catch {\n          return;\n        }",
    "new": "        const text = value === null ? '' : value;\n        if (typeof text !== 'string' || utf8Bytes(text) > BRIDGE_LIMITS.valueMaxBytes) return;\n        try {\n          if (text !== '') parse(text);\n        } catch {\n          return;\n        }",
    "tests": "test/browser/frame-boot.test.ts test/frame-runtime.test.ts",
    "filter": "L3.B8|adapters",
    "rebuild": "node scripts/build-frame.mjs before the run; the generated outputs restored after it",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 -t \"L3.B8|adapters\" test/browser/frame-boot.test.ts test/frame-runtime.test.ts",
    "rc": 1,
    "red": "2 failed | 8 passed | 117 skipped (127)",
    "failing": [
      "test/browser/frame-boot.test.ts > chromium > L3.B8: the store crosses only under pref:prefs, pref:ui and doc:<DOC_FIELDS>; a delete is the JSON literal null",
      "test/frame-runtime.test.ts > adapters: the enhance callbacks over the outbox (Reference §8.1, §8.3; row L3.B8 unit half) > storage: the snapshot in L2 keys; set sends store.set with the bridge key, the literal null for a delete, and drops other keys and oversize values"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "src/frame-runtime/adapters.ts": "fe54ea7b07ae restored, equal",
      "assets/assets.json": "301a9f4b1f18 restored, equal",
      "src/frame/manifest.generated.ts": "9ecaf8b12741 restored, equal",
      "assets/frame/guard.js": "ff3c25da5703 restored, equal",
      "assets/frame/bootstrap.js": "eebfd00a3621 restored, equal",
      "assets/frame/enhance.js": "33232f70834a restored, equal"
    }
  },
  {
    "id": "L3.B9a",
    "guard": "drop check (a): the opaque origin",
    "file": "src/frame-runtime/bootstrap.ts",
    "old": "      origin === 'null' &&\n",
    "new": "",
    "tests": "test/browser/frame-boot.test.ts",
    "filter": "L3.B9",
    "rebuild": "node scripts/build-frame.mjs before the run; the generated outputs restored after it",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 -t \"L3.B9\" test/browser/frame-boot.test.ts",
    "rc": 1,
    "red": "2 failed | 1 passed | 75 skipped (78)",
    "failing": [
      "test/browser/frame-boot.test.ts > chromium > L3.B9 (P11): mounted with no sandbox attribute, the frame gives ready, then error boot (self-check (a): an opaque origin)",
      "test/browser/frame-boot.test.ts > chromium > L3.B9 (P11): mounted with sandbox=\"allow-scripts allow-same-origin\", the frame gives ready, then error boot (self-check (a): an opaque origin)"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "src/frame-runtime/bootstrap.ts": "eee5f23f9ba8 restored, equal",
      "assets/assets.json": "301a9f4b1f18 restored, equal",
      "src/frame/manifest.generated.ts": "9ecaf8b12741 restored, equal",
      "assets/frame/guard.js": "ff3c25da5703 restored, equal",
      "assets/frame/bootstrap.js": "eebfd00a3621 restored, equal",
      "assets/frame/enhance.js": "33232f70834a restored, equal"
    }
  },
  {
    "id": "L3.B9b",
    "guard": "drop check (b): the policy floor",
    "file": "src/frame-runtime/bootstrap.ts",
    "old": "      cspFloor(getAttribute.call(meta, 'content') ?? '').ok &&\n",
    "new": "",
    "tests": "test/browser/frame-boot.test.ts",
    "filter": "L3.B9",
    "rebuild": "node scripts/build-frame.mjs before the run; the generated outputs restored after it",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 -t \"L3.B9\" test/browser/frame-boot.test.ts",
    "rc": 1,
    "red": "1 failed | 2 passed | 75 skipped (78)",
    "failing": [
      "test/browser/frame-boot.test.ts > chromium > L3.B9: a meta that adds connect-src * gives ready, then error boot (self-check (b): the policy floor)"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "src/frame-runtime/bootstrap.ts": "eee5f23f9ba8 restored, equal",
      "assets/assets.json": "301a9f4b1f18 restored, equal",
      "src/frame/manifest.generated.ts": "9ecaf8b12741 restored, equal",
      "assets/frame/guard.js": "ff3c25da5703 restored, equal",
      "assets/frame/bootstrap.js": "eebfd00a3621 restored, equal",
      "assets/frame/enhance.js": "33232f70834a restored, equal"
    }
  },
  {
    "id": "L3.B10a",
    "guard": "allow any tag",
    "file": "src/frame-runtime/content.ts",
    "old": "    if (!TAGS.has(el.localName)) return no(`<${el.localName}>`);\n",
    "new": "",
    "tests": "test/browser/frame-boot.test.ts test/frame-runtime.test.ts",
    "filter": "L3.B10|B10",
    "rebuild": "node scripts/build-frame.mjs before the run; the generated outputs restored after it",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 -t \"L3.B10|B10\" test/browser/frame-boot.test.ts test/frame-runtime.test.ts",
    "rc": 1,
    "red": "7 failed | 25 passed | 95 skipped (127)",
    "failing": [
      "test/browser/frame-boot.test.ts > chromium > L3.B10: a planted script, iframe, img onerror, fixed style, base, form, meta, object, embed or img name each give ready, then error render",
      "test/frame-runtime.test.ts > L3.B10 (unit half): the closed vocabulary, generated from render() over the corpus > refuses <script>",
      "test/frame-runtime.test.ts > L3.B10 (unit half): the closed vocabulary, generated from render() over the corpus > refuses <iframe>",
      "test/frame-runtime.test.ts > L3.B10 (unit half): the closed vocabulary, generated from render() over the corpus > refuses <form>",
      "test/frame-runtime.test.ts > L3.B10 (unit half): the closed vocabulary, generated from render() over the corpus > refuses <object>",
      "test/frame-runtime.test.ts > L3.B10 (unit half): the closed vocabulary, generated from render() over the corpus > refuses <embed>",
      "test/frame-runtime.test.ts > L3.B10 (unit half): the closed vocabulary, generated from render() over the corpus > refuses an unknown tag"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "src/frame-runtime/content.ts": "49a4ebd98e34 restored, equal",
      "assets/assets.json": "301a9f4b1f18 restored, equal",
      "src/frame/manifest.generated.ts": "9ecaf8b12741 restored, equal",
      "assets/frame/guard.js": "ff3c25da5703 restored, equal",
      "assets/frame/bootstrap.js": "eebfd00a3621 restored, equal",
      "assets/frame/enhance.js": "33232f70834a restored, equal"
    }
  },
  {
    "id": "L3.B10b",
    "guard": "drop `open` from the vocabulary",
    "file": "src/frame-runtime/vocabulary.ts",
    "old": "'id', 'open', 'src'",
    "new": "'id', 'src'",
    "tests": "test/browser/frame-boot.test.ts test/frame-runtime.test.ts",
    "filter": "L3.B10|B10",
    "rebuild": "node scripts/build-frame.mjs before the run; the generated outputs restored after it",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 -t \"L3.B10|B10\" test/browser/frame-boot.test.ts test/frame-runtime.test.ts",
    "rc": 1,
    "red": "5 failed | 27 passed | 95 skipped (127)",
    "failing": [
      "test/browser/frame-boot.test.ts > chromium > L3.B10: every golden and hostile corpus output readies with no error, `<details open>` among them",
      "test/frame-runtime.test.ts > L3.B10 (unit half): the closed vocabulary, generated from render() over the corpus > the committed vocabulary.ts equals a fresh scan: `node scripts/gen-frame-vocabulary.mjs --check` exits 0",
      "test/frame-runtime.test.ts > L3.B10 (unit half): the closed vocabulary, generated from render() over the corpus > the lists hold no `name` attribute, no `on...` attribute, and none of embed, form, iframe or object",
      "test/frame-runtime.test.ts > L3.B10 (unit half): the closed vocabulary, generated from render() over the corpus > every golden and hostile corpus output is accepted, `<details open>` and task lists included",
      "test/frame-runtime.test.ts > L3.B10 (unit half): the closed vocabulary, generated from render() over the corpus > accepts the same documents without the planted part (the refusals above are the parts, not the shapes)"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "src/frame-runtime/vocabulary.ts": "f080694e16ac restored, equal",
      "assets/assets.json": "301a9f4b1f18 restored, equal",
      "src/frame/manifest.generated.ts": "9ecaf8b12741 restored, equal",
      "assets/frame/guard.js": "ff3c25da5703 restored, equal",
      "assets/frame/bootstrap.js": "eebfd00a3621 restored, equal",
      "assets/frame/enhance.js": "33232f70834a restored, equal"
    }
  },
  {
    "id": "L3.B10c",
    "guard": "admit `name`",
    "file": "src/frame-runtime/content.ts",
    "old": "    if (/^on/i.test(name) || name === 'name' || !ATTRIBUTES.has(name)) return `<${tag} ${name}>`;",
    "new": "    if (/^on/i.test(name) || (!ATTRIBUTES.has(name) && name !== 'name')) return `<${tag} ${name}>`;",
    "tests": "test/browser/frame-boot.test.ts test/frame-runtime.test.ts",
    "filter": "L3.B10|B10",
    "rebuild": "node scripts/build-frame.mjs before the run; the generated outputs restored after it",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 -t \"L3.B10|B10\" test/browser/frame-boot.test.ts test/frame-runtime.test.ts",
    "rc": 1,
    "red": "3 failed | 29 passed | 95 skipped (127)",
    "failing": [
      "test/browser/frame-boot.test.ts > chromium > L3.B10: a planted script, iframe, img onerror, fixed style, base, form, meta, object, embed or img name each give ready, then error render",
      "test/frame-runtime.test.ts > L3.B10 (unit half): the closed vocabulary, generated from render() over the corpus > refuses <img name=x>",
      "test/frame-runtime.test.ts > L3.B10 (unit half): the closed vocabulary, generated from render() over the corpus > refuses <a name=x>"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "src/frame-runtime/content.ts": "49a4ebd98e34 restored, equal",
      "assets/assets.json": "301a9f4b1f18 restored, equal",
      "src/frame/manifest.generated.ts": "9ecaf8b12741 restored, equal",
      "assets/frame/guard.js": "ff3c25da5703 restored, equal",
      "assets/frame/bootstrap.js": "eebfd00a3621 restored, equal",
      "assets/frame/enhance.js": "33232f70834a restored, equal"
    }
  },
  {
    "id": "L3.B11a",
    "guard": "store the port on a property of the window",
    "file": "src/frame-runtime/bootstrap.ts",
    "old": "    port = p;\n",
    "new": "    port = p;\n    (win as unknown as Record<string, unknown>)['docserverPort'] = p;\n",
    "tests": "test/browser/frame-boot.test.ts",
    "filter": "L3.B11",
    "rebuild": "node scripts/build-frame.mjs before the run; the generated outputs restored after it",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 -t \"L3.B11\" test/browser/frame-boot.test.ts",
    "rc": 1,
    "red": "1 failed | 77 skipped (78)",
    "failing": [
      "test/browser/frame-boot.test.ts > chromium > L3.B11: no MessagePort is reachable from the window's own properties, and after hello no window listener takes a second hello"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "src/frame-runtime/bootstrap.ts": "eee5f23f9ba8 restored, equal",
      "assets/assets.json": "301a9f4b1f18 restored, equal",
      "src/frame/manifest.generated.ts": "9ecaf8b12741 restored, equal",
      "assets/frame/guard.js": "ff3c25da5703 restored, equal",
      "assets/frame/bootstrap.js": "eebfd00a3621 restored, equal",
      "assets/frame/enhance.js": "33232f70834a restored, equal"
    }
  }
]
```

## Fix round (review findings; measured 2026-10-27 UTC)

The review's fix round changed the outbox (a transit margin on the pacer; L3.M12 (b) now reads the jittered arrivals), the bootstrap (the outbox paces by `performance.now`, not `Date.now`; the bootstrap is built minified, names included), `parseParentMessage` (counts capped first, elements read by index), the face probe's bound row, and the walls' test-marker rule (a test-named member read off the global counts; only RegExp's `.test(...)` call is exempt). Every row whose file or test those changes touched was measured again, by the same method, and new rows were added for each new guard. These entries supersede the ones above for the same ids (L3.M12a's anchor moved with the pacer's new lines).

New rows: L3.M12e (the transit margin dropped), L3.M12f (the outbox paced by the wall clock; red through the instrumented `stepWallClock` row), L3.M19g3 (a branch on a test-named flag read off the global), L3.M21c (the probe's bound dropped) and L3.M21d (the probe bounded by FONT_WAIT_MS whatever `ms` it is given), T5.INa to T5.INc (`parseParentMessage`: arrays read with `every`, which skips holes; each count cap dropped), T5.T3a (a seed size formula bundled into the bootstrap: Task 3's check, now read from the bootstrap's metafile and from the same build with its names kept), and L3.B4c (the hello's parent-window source check dropped; red through the self-post row).

Re-measured: L3.M12a to L3.M12d, L3.M19g1, L3.M19g2, L3.M21a, L3.M21b, L3.M22b, and every browser row whose code the bootstrap bundles (L3.B3a to L3.B3d, L3.B4a, L3.B4b, L3.B5a, L3.B5b, L3.B6a, L3.B6b-a, L3.B6b-b, L3.B8a, L3.B8b, L3.B9a, L3.B9b, L3.B10a to L3.B10c, L3.B11a), since the bootstrap is now built minified. The guard's build did not change (its sha256 is the same), so the L3.B7 rows were not re-run.

**Result.** 38 rows measured: 36 red, every red through AssertionErrors only; 2 green: L3.B3d (the recorded equivalent mutant, P-6, as before) and L3.B6a. Threads 2,257 to 2,476; every restore was sha256-equal, `sha256sum -c` over the Task 5 sources, tests and generated outputs matched after every batch, and `node scripts/build-frame.mjs --check` exited 0 after the last row.

- **L3.B6a is timing-dependent, not reliably red.** Six runs in this round: red in four, green in two; on the final test file, one red and two green. Every red came through the P7 row (three figures, "ready waits for it"), by 157 to 183 ms; the slow-set row ("with a set that takes longer to draw than the face probe") stayed green in all six, also with 32 charts and with 120-node charts tried in place (since reverted). The record above says the slow set makes it red; that held in its one measured run and does not hold now. L2's `enhance()` does not wait for its second phase (`src/enhance/lifecycle.ts`), so under this mutation `ready` races the drawing: it waits on the face probe and one task, and a long drawing pass appears to hold that task until it ends. This needs a row that does not race (left open for the coordinator; no test was changed for it). Superseded by the section "Coordinator ruling: L3.B6a deterministic" below.

| Row | Guard | Change | Red | Restore |
|---|---|---|---|---|
| L3.M12a | the pacer as a 16/s bucket with a burst of 32 (not a sliding window) | `src/frame-runtime/outbox.ts`: `  let pacerTimer: unknown;` → `  let pacerTimer: unknown; ⏎   let bucket = 32; ⏎   let bucketAt = clock.now();`<br>`src/frame-runtime/outbox.ts`: `      let wait = 0; ⏎       if (recent(sentOther, now, paceMs) >= otherMax) wait = Math.max(wait, (sentOther[sentOther.length - otherMax] as number) + paceMs + 1 - now); ⏎       if (isStore && recent(sentStore, now, paceMs) >= L.frameStoreSetMaxPerWindow) { ⏎         wait = Math.max(wait, (sentStore[sentStore.length - L.frameStoreSetMaxPerWindow] as number) + paceMs + 1 - now); ⏎       }` → `      bucket = Math.min(32, bucket + ((now - bucketAt) * 16) / 1000); ⏎       bucketAt = now; ⏎       const wait = bucket >= 1 ? 0 * Number(isStore) : Math.ceil(((1 - bucket) * 1000) / 16); ⏎       if (wait === 0) bucket -= 1;` | `test/frame-outbox.test.ts`: 4 failed \| 11 passed (15). "sends at most 12 ops that are not copies in any 1000 ms plus the transit margin, holding the next until the oldest is older than that"; "seed 1: 0 refusals from the token buckets and from a strict 20/10 sliding window, both reading the jittered arrivals; no 1000 ms holds more than 16 messages or 8 store.set; a copy is never delayed; every changes ends exactly once"; "seed 2: 0 refusals from the token buckets and from a strict 20/10 sliding window, both reading the jittered arrivals; no 1000 ms holds more than 16 messages or 8 store.set; a copy is never delayed; every changes ends exactly once"; "seed 3: 0 refusals from the token buckets and from a strict 20/10 sliding window, both reading the jittered arrivals; no 1000 ms holds more than 16 messages or 8 store.set; a copy is never delayed; every changes ends exactly once" | `src/frame-runtime/outbox.ts` sha256 `6c55f15c6413…` restored, equal |
| L3.M12b | flush unpaced: the queue posted at once on open(), outside the pacer and its records | `src/frame-runtime/outbox.ts`: `        else if (e.kind === 'changes' \|\| e.op.t === 'hash' \|\| e.op.t === 'store.set') enqueue(e); ⏎         else lead(lanes[e.op.t], e.op);` → `        else if (e.kind === 'changes') enqueue(e); ⏎         else post(e.op);` | `test/frame-outbox.test.ts`: 2 failed \| 13 passed (15). "seed 1: 0 refusals from the token buckets and from a strict 20/10 sliding window, both reading the jittered arrivals; no 1000 ms holds more than 16 messages or 8 store.set; a copy is never delayed; every changes ends exactly once"; "seed 2: 0 refusals from the token buckets and from a strict 20/10 sliding window, both reading the jittered arrivals; no 1000 ms holds more than 16 messages or 8 store.set; a copy is never delayed; every changes ends exactly once" | `src/frame-runtime/outbox.ts` sha256 `6c55f15c6413…` restored, equal |
| L3.M12c | copy queued behind store.set: a copy waits in the pacer's line | `src/frame-runtime/outbox.ts`: `      postEntry({ kind: 'copy', text }, now); ⏎       return true;` → `      line.push({ kind: 'copy', text }); ⏎       pump(); ⏎       return true;` | `test/frame-outbox.test.ts`: 4 failed \| 11 passed (15). "a store.set burst never delays a copy: the copy is posted at the instant it is asked for"; "seed 1: 0 refusals from the token buckets and from a strict 20/10 sliding window, both reading the jittered arrivals; no 1000 ms holds more than 16 messages or 8 store.set; a copy is never delayed; every changes ends exactly once"; "seed 2: 0 refusals from the token buckets and from a strict 20/10 sliding window, both reading the jittered arrivals; no 1000 ms holds more than 16 messages or 8 store.set; a copy is never delayed; every changes ends exactly once"; "seed 3: 0 refusals from the token buckets and from a strict 20/10 sliding window, both reading the jittered arrivals; no 1000 ms holds more than 16 messages or 8 store.set; a copy is never delayed; every changes ends exactly once" | `src/frame-runtime/outbox.ts` sha256 `6c55f15c6413…` restored, equal |
| L3.M12d | drop the terminal timeout: a sent changes left unanswered never ends | `src/frame-runtime/outbox.ts`: `      req.timer = clock.setTimeout(() => { ⏎         req.timer = undefined; ⏎         if (current !== req) return; ⏎         end(req, null); ⏎         advance(); ⏎       }, L.frameChangesTimeoutMs); ⏎ ` → (removed) | `test/frame-outbox.test.ts`: 4 failed \| 11 passed (15). "a sent request unanswered after 35 s resolves null and frees the slot for the queued one"; "seed 1: 0 refusals from the token buckets and from a strict 20/10 sliding window, both reading the jittered arrivals; no 1000 ms holds more than 16 messages or 8 store.set; a copy is never delayed; every changes ends exactly once"; "seed 2: 0 refusals from the token buckets and from a strict 20/10 sliding window, both reading the jittered arrivals; no 1000 ms holds more than 16 messages or 8 store.set; a copy is never delayed; every changes ends exactly once"; "seed 3: 0 refusals from the token buckets and from a strict 20/10 sliding window, both reading the jittered arrivals; no 1000 ms holds more than 16 messages or 8 store.set; a copy is never delayed; every changes ends exactly once" | `src/frame-runtime/outbox.ts` sha256 `6c55f15c6413…` restored, equal |
| L3.M12e | pace by the parent window alone: the transit margin dropped | `src/frame-runtime/outbox.ts`: `  const paceMs = L.frameWindowMs + TRANSIT_MARGIN_MS;` → `  const paceMs = L.frameWindowMs;` | `test/frame-outbox.test.ts`: 4 failed \| 11 passed (15). "sends at most 12 ops that are not copies in any 1000 ms plus the transit margin, holding the next until the oldest is older than that"; "seed 1: 0 refusals from the token buckets and from a strict 20/10 sliding window, both reading the jittered arrivals; no 1000 ms holds more than 16 messages or 8 store.set; a copy is never delayed; every changes ends exactly once"; "seed 2: 0 refusals from the token buckets and from a strict 20/10 sliding window, both reading the jittered arrivals; no 1000 ms holds more than 16 messages or 8 store.set; a copy is never delayed; every changes ends exactly once"; "seed 3: 0 refusals from the token buckets and from a strict 20/10 sliding window, both reading the jittered arrivals; no 1000 ms holds more than 16 messages or 8 store.set; a copy is never delayed; every changes ends exactly once" | `src/frame-runtime/outbox.ts` sha256 `6c55f15c6413…` restored, equal |
| L3.M12f | the outbox paced by the wall clock (Date.now) instead of the monotonic performance.now | `src/frame-runtime/bootstrap.ts`: `now: () => perfNow.call(perf),` → `now: () => Date.now(),` | `test/browser/frame-boot.test.ts` (-t `stepWallClock`): 1 failed \| 79 skipped (80). "L3.M12 (instrumented: `stepWallClock` wraps Date.now before the bootstrap runs, to step the wall clock): the pacer reads a monotonic clock, so a wall clock stepped back an hour after a send stalls nothing" | `src/frame-runtime/bootstrap.ts` sha256 `46e771af805b…` restored, equal; `assets/assets.json` sha256 `87a67570c717…` restored, equal; `src/frame/manifest.generated.ts` sha256 `a8637f9517ef…` restored, equal; `assets/frame/guard.js` sha256 `ff3c25da5703…` restored, equal; `assets/frame/bootstrap.js` sha256 `3b69498221b6…` restored, equal; `assets/frame/enhance.js` sha256 `33232f70834a…` restored, equal |
| L3.M19g1 | plant a test-only branch in the guard (`if (globalThis.__TEST) ...`) | `src/frame-runtime/guard.ts`: `  add.call(window, 'submit', (e: Event) => preventDefault.call(e), true);` → `  add.call(window, 'submit', (e: Event) => preventDefault.call(e), true); ⏎   if ((globalThis as unknown as { __TEST?: boolean }).__TEST === true) add.call(window, 'click', () => undefined, true);` | `test/frame-runtime-walls.test.ts`: 2 failed \| 48 passed (50). "none of the three carries a test marker"; "a planted test-only branch is seen, in each of its shapes" | `src/frame-runtime/guard.ts` sha256 `9165060de41e…` restored, equal |
| L3.M19g2 | plant a branch on a test-named flag in the guard (`if (testHook) ...`) | `src/frame-runtime/guard.ts`: `  add.call(window, 'submit', (e: Event) => preventDefault.call(e), true);` → `  add.call(window, 'submit', (e: Event) => preventDefault.call(e), true); ⏎   const testHook = (me as unknown as { dataset?: { hook?: string } }).dataset?.hook; ⏎   if (testHook !== undefined) add.call(window, 'click', () => undefined, true);` | `test/frame-runtime-walls.test.ts`: 2 failed \| 48 passed (50). "none of the three carries a test marker"; "a planted test-only branch is seen, in each of its shapes" | `src/frame-runtime/guard.ts` sha256 `9165060de41e…` restored, equal |
| L3.M19g3 | plant a branch on a test-named flag read off the global in the guard (`if (globalThis.isTesting) ...`) | `src/frame-runtime/guard.ts`: `  add.call(window, 'submit', (e: Event) => preventDefault.call(e), true);` → `  add.call(window, 'submit', (e: Event) => preventDefault.call(e), true); ⏎   if ((globalThis as unknown as { isTesting?: boolean }).isTesting === true) add.call(window, 'click', () => undefined, true);` | `test/frame-runtime-walls.test.ts`: 2 failed \| 48 passed (50). "none of the three carries a test marker"; "a planted test-only branch is seen, in each of its shapes" | `src/frame-runtime/guard.ts` sha256 `9165060de41e…` restored, equal |
| L3.M21a | drop the probe: the bootstrap settles without loading the faces | `src/frame-runtime/bootstrap.ts`: `    await probeFaces(set === null \|\| set === undefined \|\| loadFaces === undefined ? null : { load: (f: string) => loadFaces.call(set, f) }, FACES, FONT_WAIT_MS); ⏎ ` → `    void set; ⏎ ` | `test/frame-runtime.test.ts`: 1 failed \| 50 passed (51). "the bootstrap runs the probe with FACES and FONT_WAIT_MS after enhance and before the state becomes SETTLED" | `src/frame-runtime/bootstrap.ts` sha256 `46e771af805b…` restored, equal |
| L3.M21b | probe the regular faces only | `src/frame-runtime/fonts.ts`: `  'normal 400 1em "Docreader Serif"', ⏎   'italic 400 1em "Docreader Serif"', ⏎   'normal 400 1em "Docreader Sans"', ⏎   'italic 400 1em "Docreader Sans"',` → `  'normal 400 1em "Docreader Serif"', ⏎   'normal 400 1em "Docreader Sans"',` | `test/frame-runtime.test.ts`: 1 failed \| 50 passed (51). "loads each of the four faces the frame CSS declares once: serif and sans, normal and italic" | `src/frame-runtime/fonts.ts` sha256 `306d03b717d9…` restored, equal |
| L3.M21c | drop the probe bound: never-settling loads keep the probe open | `src/frame-runtime/fonts.ts`: `    later(resolve, ms); ⏎ ` → (removed) | `test/frame-runtime.test.ts`: 1 failed \| 50 passed (51). "is bounded by its wait: loads that never settle end it at the bound; a rejecting load is not an error" | `src/frame-runtime/fonts.ts` sha256 `306d03b717d9…` restored, equal |
| L3.M21d | bound the probe by FONT_WAIT_MS whatever ms it is given | `src/frame-runtime/fonts.ts`: `    later(resolve, ms); ⏎ ` → `    later(resolve, FONT_WAIT_MS); ⏎ ` | `test/frame-runtime.test.ts`: 1 failed \| 50 passed (51). "is bounded by its wait: loads that never settle end it at the bound; a rejecting load is not an error" | `src/frame-runtime/fonts.ts` sha256 `306d03b717d9…` restored, equal |
| L3.M22b | skip the pin: the bootstrap never calls it | `src/frame-runtime/bootstrap.ts`: `    pinFreeGlobals(win, DOCSERVER_FREE_GLOBALS); ⏎ ` → `    void DOCSERVER_FREE_GLOBALS; ⏎ ` | `test/frame-runtime.test.ts`: 1 failed \| 50 passed (51). "the bootstrap pins the build's list in Phase S: once, before the adapters, the listeners and any content" | `src/frame-runtime/bootstrap.ts` sha256 `46e771af805b…` restored, equal |
| T5.INa | parseParentMessage reads arrays with every (holes skipped) instead of by index | `src/frame-runtime/inbound.ts`: `  for (let i = 0; i < v.length; i++) { ⏎     if (!isInteger(v[i])) return false; ⏎   } ⏎   return true;` → `  return v.every((x) => isInteger(x));` | `test/frame-runtime.test.ts`: 1 failed \| 50 passed (51). "changes.result: a pair or a removedAfter with a hole is malformed, as it arrives on a port (structured clone keeps holes)" | `src/frame-runtime/inbound.ts` sha256 `3788dee0af52…` restored, equal |
| T5.INb | drop the ranges count cap | `src/frame-runtime/inbound.ts`: `  if (!isArray(ranges) \|\| ranges.length > CHANGES_MAX_RANGES) return null;` → `  if (!isArray(ranges)) return null;` | `test/frame-runtime.test.ts`: 1 failed \| 50 passed (51). "changes.result: counts are capped at L2's own caps before any element is read; a huge sparse array is refused at once" | `src/frame-runtime/inbound.ts` sha256 `3788dee0af52…` restored, equal |
| T5.INc | drop the removedAfter count cap | `src/frame-runtime/inbound.ts`: `intList(removedAfter, CHANGES_MAX_DELETIONS)` → `intList(removedAfter, Infinity)` | `test/frame-runtime.test.ts`: 1 failed \| 50 passed (51). "changes.result: counts are capped at L2's own caps before any element is read; a huge sparse array is refused at once" | `src/frame-runtime/inbound.ts` sha256 `3788dee0af52…` restored, equal |
| T5.T3a | bundle a seed size formula into the bootstrap (Task 3's check, now read from the metafile and a names-kept build) | `src/frame-runtime/bootstrap.ts`: `import { validateSeed, type Seed, type SeedMermaid } from '../frame/seed.js';` → `import { SEED_FIELDS_MAX_CHARS, validateSeed, type Seed, type SeedMermaid } from '../frame/seed.js';`<br>`src/frame-runtime/bootstrap.ts`: `  const check = validateSeed(raw); ⏎ ` → `  if (raw === SEED_FIELDS_MAX_CHARS) return; ⏎   const check = validateSeed(raw); ⏎ ` | `test/frame-document.test.ts` (-t `size formulas`): 1 failed \| 48 skipped (49). "none of the size formulas reaches bootstrap.js, and it is within its 32 KiB budget" | `src/frame-runtime/bootstrap.ts` sha256 `46e771af805b…` restored, equal |
| L3.B4c | accept a hello from any source: the parent-window check dropped (a hello the frame posts to itself binds) | `src/frame-runtime/bootstrap.ts`: `    if (sourceOf.call(e) !== parentWin) return; ⏎ ` → (removed) | `test/browser/frame-boot.test.ts` (-t `L3.B4`): 1 failed \| 1 passed \| 78 skipped (80). "L3.B4: a hello the frame posts to itself, with a port, binds nothing: the parent's first valid hello binds afterwards" | `src/frame-runtime/bootstrap.ts` sha256 `46e771af805b…` restored, equal; `assets/assets.json` sha256 `87a67570c717…` restored, equal; `src/frame/manifest.generated.ts` sha256 `a8637f9517ef…` restored, equal; `assets/frame/guard.js` sha256 `ff3c25da5703…` restored, equal; `assets/frame/bootstrap.js` sha256 `3b69498221b6…` restored, equal; `assets/frame/enhance.js` sha256 `33232f70834a…` restored, equal |
| L3.B3a | read the seed by id (an id lookup: no seed has one, so the frame never readies) | `src/frame-runtime/bootstrap.ts`: `  const seedEl = prevSibling.call(bs);` → `  const seedEl = doc.getElementById('seed');` | `test/browser/frame-boot.test.ts` (-t `L3.B3`): 4 failed \| 76 skipped (80). "L3.B3 (P5): headings and anchors named after the handoff still ready with the right nonce"; "L3.B3: headings and anchors named after the handoff, the globals and the scripts: ready with the right nonce, every diagram kind draws as in the clean document, links route"; "L3.B3 (instrumented: `measure` wraps appendChild before the bootstrap captures it, to time the root): no authored node exists while a script evaluates, the root is appended at DOMContentLoaded"; "L3.B3: registration is by position: with enhance blocked, an impostor at the Mermaid position that registers as enhance is refused (ready, then error assets)" | `src/frame-runtime/bootstrap.ts` sha256 `46e771af805b…` restored, equal; `assets/assets.json` sha256 `87a67570c717…` restored, equal; `src/frame/manifest.generated.ts` sha256 `a8637f9517ef…` restored, equal; `assets/frame/guard.js` sha256 `ff3c25da5703…` restored, equal; `assets/frame/bootstrap.js` sha256 `3b69498221b6…` restored, equal; `assets/frame/enhance.js` sha256 `33232f70834a…` restored, equal |
| L3.B3b | insert content before the scripts: the root materialised in Phase S, into a body made early | `src/frame-runtime/bootstrap.ts`: `  const adapters = createAdapters(outbox, seed);` → `  appendChild.call(documentElement.call(doc) as Element, doc.createElement('body')); ⏎   root = materialise(doc, seed.html, seed.lang, new Map(seed.images), content); ⏎   const adapters = createAdapters(outbox, seed);`<br>`src/frame-runtime/bootstrap.ts`: `      root = materialise(doc, seed.html, seed.lang, new Map(seed.images), content);` → `      root = root ?? materialise(doc, seed.html, seed.lang, new Map(seed.images), content);`<br>`src/frame-runtime/bootstrap.ts`: `  const startPort = MessagePort.prototype.start;` → `  const startPort = MessagePort.prototype.start; ⏎   const appendChild = Node.prototype.appendChild;` | `test/browser/frame-boot.test.ts` (-t `L3.B3`): 1 failed \| 3 passed \| 76 skipped (80). "L3.B3 (instrumented: `measure` wraps appendChild before the bootstrap captures it, to time the root): no authored node exists while a script evaluates, the root is appended at DOMContentLoaded" | `src/frame-runtime/bootstrap.ts` sha256 `46e771af805b…` restored, equal; `assets/assets.json` sha256 `87a67570c717…` restored, equal; `src/frame/manifest.generated.ts` sha256 `a8637f9517ef…` restored, equal; `assets/frame/guard.js` sha256 `ff3c25da5703…` restored, equal; `assets/frame/bootstrap.js` sha256 `3b69498221b6…` restored, equal; `assets/frame/enhance.js` sha256 `33232f70834a…` restored, equal |
| L3.B3c | accept registration without the position check | `src/frame-runtime/bootstrap.ts`: `    if (d['name'] === 'enhance' && from === enhanceEl && api === null) {` → `    if (d['name'] === 'enhance' && api === null) {` | `test/browser/frame-boot.test.ts` (-t `L3.B3`): 1 failed \| 3 passed \| 76 skipped (80). "L3.B3: registration is by position: with enhance blocked, an impostor at the Mermaid position that registers as enhance is refused (ready, then error assets)" | `src/frame-runtime/bootstrap.ts` sha256 `46e771af805b…` restored, equal; `assets/assets.json` sha256 `87a67570c717…` restored, equal; `src/frame/manifest.generated.ts` sha256 `a8637f9517ef…` restored, equal; `assets/frame/guard.js` sha256 `ff3c25da5703…` restored, equal; `assets/frame/bootstrap.js` sha256 `3b69498221b6…` restored, equal; `assets/frame/enhance.js` sha256 `33232f70834a…` restored, equal |
| L3.B3d | read the seed with querySelector in Phase S instead of by position | `src/frame-runtime/bootstrap.ts`: `  const seedEl = prevSibling.call(bs);` → `  const seedEl = doc.querySelector('script[type="application/json"]');` | **green**: 33 passed \| 47 skipped (80) (see the notes) | `src/frame-runtime/bootstrap.ts` sha256 `46e771af805b…` restored, equal; `assets/assets.json` sha256 `87a67570c717…` restored, equal; `src/frame/manifest.generated.ts` sha256 `a8637f9517ef…` restored, equal; `assets/frame/guard.js` sha256 `ff3c25da5703…` restored, equal; `assets/frame/bootstrap.js` sha256 `3b69498221b6…` restored, equal; `assets/frame/enhance.js` sha256 `33232f70834a…` restored, equal |
| L3.B4a | accept any hello: the key check dropped (a hello with an extra key binds) | `src/frame-runtime/bootstrap.ts`: `    if (k.length !== 2 \|\| !k.includes('t') \|\| !k.includes('v')) return; ⏎ ` → (removed) | `test/browser/frame-boot.test.ts` (-t `L3.B4`): 1 failed \| 1 passed \| 78 skipped (80). "L3.B4 (P4): hellos with no port, an extra key or two ports get no answer; the first valid one binds; a second gets nothing" | `src/frame-runtime/bootstrap.ts` sha256 `46e771af805b…` restored, equal; `assets/assets.json` sha256 `87a67570c717…` restored, equal; `src/frame/manifest.generated.ts` sha256 `a8637f9517ef…` restored, equal; `assets/frame/guard.js` sha256 `ff3c25da5703…` restored, equal; `assets/frame/bootstrap.js` sha256 `3b69498221b6…` restored, equal; `assets/frame/enhance.js` sha256 `33232f70834a…` restored, equal |
| L3.B4b | keep the window listener after hello | `src/frame-runtime/bootstrap.ts`: `    remove.call(win, 'message', onMessage, false); ⏎     port = p;` → `    port = p;` | `test/browser/frame-boot.test.ts` (-t `L3.B4\|L3.B11`): 1 failed \| 2 passed \| 77 skipped (80). "L3.B11: no MessagePort is reachable from the window's own properties, and after hello no window listener takes a second hello" | `src/frame-runtime/bootstrap.ts` sha256 `46e771af805b…` restored, equal; `assets/assets.json` sha256 `87a67570c717…` restored, equal; `src/frame/manifest.generated.ts` sha256 `a8637f9517ef…` restored, equal; `assets/frame/guard.js` sha256 `ff3c25da5703…` restored, equal; `assets/frame/bootstrap.js` sha256 `3b69498221b6…` restored, equal; `assets/frame/enhance.js` sha256 `33232f70834a…` restored, equal |
| L3.B5a | send ops at hello: the outbox opens when the port arrives, before ready | `src/frame-runtime/bootstrap.ts`: `    port = p; ⏎ ` → `    port = p; ⏎     outbox.open(); ⏎ ` | `test/browser/frame-boot.test.ts` (-t `L3.B5`): 1 failed \| 3 passed \| 76 skipped (80). "L3.B5: ops the reader made before hello cross after ready, in order: ready first, then the navigate, then the hash" | `src/frame-runtime/bootstrap.ts` sha256 `46e771af805b…` restored, equal; `assets/assets.json` sha256 `87a67570c717…` restored, equal; `src/frame/manifest.generated.ts` sha256 `a8637f9517ef…` restored, equal; `assets/frame/guard.js` sha256 `ff3c25da5703…` restored, equal; `assets/frame/bootstrap.js` sha256 `3b69498221b6…` restored, equal; `assets/frame/enhance.js` sha256 `33232f70834a…` restored, equal |
| L3.B5b | error before ready | `src/frame-runtime/bootstrap.ts`: `    post({ t: 'ready', v: 1, nonce }); ⏎     if (state === 'failed' \|\| mismatch) { ⏎       post({ t: 'error', why: mismatch ? 'protocol' : why });` → `    if (state === 'failed' \|\| mismatch) post({ t: 'error', why: mismatch ? 'protocol' : why }); ⏎     post({ t: 'ready', v: 1, nonce }); ⏎     if (state === 'failed' \|\| mismatch) {` | `test/browser/frame-boot.test.ts` (-t `L3.B5`): 3 failed \| 1 passed \| 76 skipped (80). "L3.B5 (P3): an enhance byte flipped after verification gives ready, then error assets (and the close event, where the engine has one)"; "L3.B5 (P3b, instrumented: a close counter wraps MessagePort.prototype.close before the bootstrap runs): the frame closes its port once"; "L3.B5 (P4b): a hello with v:2 binds, and gets ready, then error protocol" | `src/frame-runtime/bootstrap.ts` sha256 `46e771af805b…` restored, equal; `assets/assets.json` sha256 `87a67570c717…` restored, equal; `src/frame/manifest.generated.ts` sha256 `a8637f9517ef…` restored, equal; `assets/frame/guard.js` sha256 `ff3c25da5703…` restored, equal; `assets/frame/bootstrap.js` sha256 `3b69498221b6…` restored, equal; `assets/frame/enhance.js` sha256 `33232f70834a…` restored, equal |
| L3.B6a | ready on enhance resolve: no wait for Mermaid's first pass | `src/frame-runtime/bootstrap.ts`: `      if (seed.mermaid !== null) await diagramsSettled(root); ⏎ ` → (removed) | **green**: 7 passed \| 73 skipped (80) (see the notes) | `src/frame-runtime/bootstrap.ts` sha256 `46e771af805b…` restored, equal; `assets/assets.json` sha256 `87a67570c717…` restored, equal; `src/frame/manifest.generated.ts` sha256 `a8637f9517ef…` restored, equal; `assets/frame/guard.js` sha256 `ff3c25da5703…` restored, equal; `assets/frame/bootstrap.js` sha256 `3b69498221b6…` restored, equal; `assets/frame/enhance.js` sha256 `33232f70834a…` restored, equal |
| L3.B6b-a | treat a missing Mermaid as assets | `src/frame-runtime/bootstrap.ts`: `      if (mermaidModule === null) { ⏎         fail('mermaid');` → `      if (mermaidModule === null) { ⏎         fail('assets');` | `test/browser/frame-boot.test.ts` (-t `L3.B6b`): 1 failed \| 1 passed \| 78 skipped (80). "L3.B6b (P7): a policy that blocks the Mermaid script gives ready, then error mermaid (default Q3)" | `src/frame-runtime/bootstrap.ts` sha256 `46e771af805b…` restored, equal; `assets/assets.json` sha256 `87a67570c717…` restored, equal; `src/frame/manifest.generated.ts` sha256 `a8637f9517ef…` restored, equal; `assets/frame/guard.js` sha256 `ff3c25da5703…` restored, equal; `assets/frame/bootstrap.js` sha256 `3b69498221b6…` restored, equal; `assets/frame/enhance.js` sha256 `33232f70834a…` restored, equal |
| L3.B6b-b | treat a missing or incomplete Mermaid as no wait: ready with no error | `src/frame-runtime/bootstrap.ts`: `      if (mermaidModule === null) { ⏎         fail('mermaid'); ⏎         return; ⏎       } ⏎       if (typeof mermaidModule['initialize'] !== 'function' \|\| typeof mermaidModule['run'] !== 'function') { ⏎         fail('mermaid'); ⏎         return; ⏎       }` → `      if (mermaidModule === null \|\| typeof mermaidModule['run'] !== 'function') mermaidApi = null;` | `test/browser/frame-boot.test.ts` (-t `L3.B6b`): 2 failed \| 78 skipped (80). "L3.B6b (P7): a policy that blocks the Mermaid script gives ready, then error mermaid (default Q3)"; "L3.B6b: a Mermaid script replaced by one that registers an API without run (its hash re-pinned) gives ready, then error mermaid" | `src/frame-runtime/bootstrap.ts` sha256 `46e771af805b…` restored, equal; `assets/assets.json` sha256 `87a67570c717…` restored, equal; `src/frame/manifest.generated.ts` sha256 `a8637f9517ef…` restored, equal; `assets/frame/guard.js` sha256 `ff3c25da5703…` restored, equal; `assets/frame/bootstrap.js` sha256 `3b69498221b6…` restored, equal; `assets/frame/enhance.js` sha256 `33232f70834a…` restored, equal |
| L3.B8a | a raw L2 key: the store key sent unmapped | `src/frame-runtime/adapters.ts`: `        outbox.send({ t: 'store.set', key: k, value: text });` → `        outbox.send({ t: 'store.set', key: key as BridgeStoreKey, value: text });` | `test/browser/frame-boot.test.ts`, `test/frame-runtime.test.ts` (-t `L3.B8\|adapters`): 2 failed \| 8 passed \| 121 skipped (131). "L3.B8: the store crosses only under pref:prefs, pref:ui and doc:<DOC_FIELDS>; a delete is the JSON literal null"; "storage: the snapshot in L2 keys; set sends store.set with the bridge key, the literal null for a delete, and drops other keys and oversize values" | `src/frame-runtime/adapters.ts` sha256 `fe54ea7b07ae…` restored, equal; `assets/assets.json` sha256 `87a67570c717…` restored, equal; `src/frame/manifest.generated.ts` sha256 `a8637f9517ef…` restored, equal; `assets/frame/guard.js` sha256 `ff3c25da5703…` restored, equal; `assets/frame/bootstrap.js` sha256 `3b69498221b6…` restored, equal; `assets/frame/enhance.js` sha256 `33232f70834a…` restored, equal |
| L3.B8b | '' for delete | `src/frame-runtime/adapters.ts`: `        const text = value === null ? 'null' : value; ⏎         if (typeof text !== 'string' \|\| utf8Bytes(text) > BRIDGE_LIMITS.valueMaxBytes) return; ⏎         try { ⏎           parse(text); ⏎         } catch { ⏎           return; ⏎         }` → `        const text = value === null ? '' : value; ⏎         if (typeof text !== 'string' \|\| utf8Bytes(text) > BRIDGE_LIMITS.valueMaxBytes) return; ⏎         try { ⏎           if (text !== '') parse(text); ⏎         } catch { ⏎           return; ⏎         }` | `test/browser/frame-boot.test.ts`, `test/frame-runtime.test.ts` (-t `L3.B8\|adapters`): 2 failed \| 8 passed \| 121 skipped (131). "L3.B8: the store crosses only under pref:prefs, pref:ui and doc:<DOC_FIELDS>; a delete is the JSON literal null"; "storage: the snapshot in L2 keys; set sends store.set with the bridge key, the literal null for a delete, and drops other keys and oversize values" | `src/frame-runtime/adapters.ts` sha256 `fe54ea7b07ae…` restored, equal; `assets/assets.json` sha256 `87a67570c717…` restored, equal; `src/frame/manifest.generated.ts` sha256 `a8637f9517ef…` restored, equal; `assets/frame/guard.js` sha256 `ff3c25da5703…` restored, equal; `assets/frame/bootstrap.js` sha256 `3b69498221b6…` restored, equal; `assets/frame/enhance.js` sha256 `33232f70834a…` restored, equal |
| L3.B9a | drop check (a): the opaque origin | `src/frame-runtime/bootstrap.ts`: `      origin === 'null' && ⏎ ` → (removed) | `test/browser/frame-boot.test.ts` (-t `L3.B9`): 2 failed \| 1 passed \| 77 skipped (80). "L3.B9 (P11): mounted with no sandbox attribute, the frame gives ready, then error boot (self-check (a): an opaque origin)"; "L3.B9 (P11): mounted with sandbox="allow-scripts allow-same-origin", the frame gives ready, then error boot (self-check (a): an opaque origin)" | `src/frame-runtime/bootstrap.ts` sha256 `46e771af805b…` restored, equal; `assets/assets.json` sha256 `87a67570c717…` restored, equal; `src/frame/manifest.generated.ts` sha256 `a8637f9517ef…` restored, equal; `assets/frame/guard.js` sha256 `ff3c25da5703…` restored, equal; `assets/frame/bootstrap.js` sha256 `3b69498221b6…` restored, equal; `assets/frame/enhance.js` sha256 `33232f70834a…` restored, equal |
| L3.B9b | drop check (b): the policy floor | `src/frame-runtime/bootstrap.ts`: `      cspFloor(getAttribute.call(meta, 'content') ?? '').ok && ⏎ ` → (removed) | `test/browser/frame-boot.test.ts` (-t `L3.B9`): 1 failed \| 2 passed \| 77 skipped (80). "L3.B9: a meta that adds connect-src * gives ready, then error boot (self-check (b): the policy floor)" | `src/frame-runtime/bootstrap.ts` sha256 `46e771af805b…` restored, equal; `assets/assets.json` sha256 `87a67570c717…` restored, equal; `src/frame/manifest.generated.ts` sha256 `a8637f9517ef…` restored, equal; `assets/frame/guard.js` sha256 `ff3c25da5703…` restored, equal; `assets/frame/bootstrap.js` sha256 `3b69498221b6…` restored, equal; `assets/frame/enhance.js` sha256 `33232f70834a…` restored, equal |
| L3.B10a | allow any tag | `src/frame-runtime/content.ts`: `    if (!TAGS.has(el.localName)) return no(`<${el.localName}>`); ⏎ ` → (removed) | `test/browser/frame-boot.test.ts`, `test/frame-runtime.test.ts` (-t `L3.B10\|B10`): 7 failed \| 25 passed \| 99 skipped (131). "L3.B10: a planted script, iframe, img onerror, fixed style, base, form, meta, object, embed or img name each give ready, then error render"; "refuses <script>"; "refuses <iframe>"; "refuses <form>"; "refuses <object>" | `src/frame-runtime/content.ts` sha256 `49a4ebd98e34…` restored, equal; `assets/assets.json` sha256 `87a67570c717…` restored, equal; `src/frame/manifest.generated.ts` sha256 `a8637f9517ef…` restored, equal; `assets/frame/guard.js` sha256 `ff3c25da5703…` restored, equal; `assets/frame/bootstrap.js` sha256 `3b69498221b6…` restored, equal; `assets/frame/enhance.js` sha256 `33232f70834a…` restored, equal |
| L3.B10b | drop `open` from the vocabulary | `src/frame-runtime/vocabulary.ts`: `'id', 'open', 'src'` → `'id', 'src'` | `test/browser/frame-boot.test.ts`, `test/frame-runtime.test.ts` (-t `L3.B10\|B10`): 5 failed \| 27 passed \| 99 skipped (131). "L3.B10: every golden and hostile corpus output readies with no error, `<details open>` among them"; "the committed vocabulary.ts equals a fresh scan: `node scripts/gen-frame-vocabulary.mjs --check` exits 0"; "the lists hold no `name` attribute, no `on...` attribute, and none of embed, form, iframe or object"; "every golden and hostile corpus output is accepted, `<details open>` and task lists included"; "accepts the same documents without the planted part (the refusals above are the parts, not the shapes)" | `src/frame-runtime/vocabulary.ts` sha256 `f080694e16ac…` restored, equal; `assets/assets.json` sha256 `87a67570c717…` restored, equal; `src/frame/manifest.generated.ts` sha256 `a8637f9517ef…` restored, equal; `assets/frame/guard.js` sha256 `ff3c25da5703…` restored, equal; `assets/frame/bootstrap.js` sha256 `3b69498221b6…` restored, equal; `assets/frame/enhance.js` sha256 `33232f70834a…` restored, equal |
| L3.B10c | admit `name` | `src/frame-runtime/content.ts`: `    if (/^on/i.test(name) \|\| name === 'name' \|\| !ATTRIBUTES.has(name)) return `<${tag} ${name}>`;` → `    if (/^on/i.test(name) \|\| (!ATTRIBUTES.has(name) && name !== 'name')) return `<${tag} ${name}>`;` | `test/browser/frame-boot.test.ts`, `test/frame-runtime.test.ts` (-t `L3.B10\|B10`): 3 failed \| 29 passed \| 99 skipped (131). "L3.B10: a planted script, iframe, img onerror, fixed style, base, form, meta, object, embed or img name each give ready, then error render"; "refuses <img name=x>"; "refuses <a name=x>" | `src/frame-runtime/content.ts` sha256 `49a4ebd98e34…` restored, equal; `assets/assets.json` sha256 `87a67570c717…` restored, equal; `src/frame/manifest.generated.ts` sha256 `a8637f9517ef…` restored, equal; `assets/frame/guard.js` sha256 `ff3c25da5703…` restored, equal; `assets/frame/bootstrap.js` sha256 `3b69498221b6…` restored, equal; `assets/frame/enhance.js` sha256 `33232f70834a…` restored, equal |
| L3.B11a | store the port on a property of the window | `src/frame-runtime/bootstrap.ts`: `    port = p; ⏎ ` → `    port = p; ⏎     (win as unknown as Record<string, unknown>)['docserverPort'] = p; ⏎ ` | `test/browser/frame-boot.test.ts` (-t `L3.B11`): 1 failed \| 79 skipped (80). "L3.B11: no MessagePort is reachable from the window's own properties, and after hello no window listener takes a second hello" | `src/frame-runtime/bootstrap.ts` sha256 `46e771af805b…` restored, equal; `assets/assets.json` sha256 `87a67570c717…` restored, equal; `src/frame/manifest.generated.ts` sha256 `a8637f9517ef…` restored, equal; `assets/frame/guard.js` sha256 `ff3c25da5703…` restored, equal; `assets/frame/bootstrap.js` sha256 `3b69498221b6…` restored, equal; `assets/frame/enhance.js` sha256 `33232f70834a…` restored, equal |

```json
[
  {
    "id": "L3.M12a",
    "guard": "the pacer as a 16/s bucket with a burst of 32 (not a sliding window)",
    "changes": [
      {
        "file": "src/frame-runtime/outbox.ts",
        "old": "  let pacerTimer: unknown;",
        "new": "  let pacerTimer: unknown;\n  let bucket = 32;\n  let bucketAt = clock.now();"
      },
      {
        "file": "src/frame-runtime/outbox.ts",
        "old": "      let wait = 0;\n      if (recent(sentOther, now, paceMs) >= otherMax) wait = Math.max(wait, (sentOther[sentOther.length - otherMax] as number) + paceMs + 1 - now);\n      if (isStore && recent(sentStore, now, paceMs) >= L.frameStoreSetMaxPerWindow) {\n        wait = Math.max(wait, (sentStore[sentStore.length - L.frameStoreSetMaxPerWindow] as number) + paceMs + 1 - now);\n      }",
        "new": "      bucket = Math.min(32, bucket + ((now - bucketAt) * 16) / 1000);\n      bucketAt = now;\n      const wait = bucket >= 1 ? 0 * Number(isStore) : Math.ceil(((1 - bucket) * 1000) / 16);\n      if (wait === 0) bucket -= 1;"
      }
    ],
    "tests": [
      "test/frame-outbox.test.ts"
    ]
  },
  {
    "id": "L3.M12b",
    "guard": "flush unpaced: the queue posted at once on open(), outside the pacer and its records",
    "changes": [
      {
        "file": "src/frame-runtime/outbox.ts",
        "old": "        else if (e.kind === 'changes' || e.op.t === 'hash' || e.op.t === 'store.set') enqueue(e);\n        else lead(lanes[e.op.t], e.op);",
        "new": "        else if (e.kind === 'changes') enqueue(e);\n        else post(e.op);"
      }
    ],
    "tests": [
      "test/frame-outbox.test.ts"
    ]
  },
  {
    "id": "L3.M12c",
    "guard": "copy queued behind store.set: a copy waits in the pacer's line",
    "changes": [
      {
        "file": "src/frame-runtime/outbox.ts",
        "old": "      postEntry({ kind: 'copy', text }, now);\n      return true;",
        "new": "      line.push({ kind: 'copy', text });\n      pump();\n      return true;"
      }
    ],
    "tests": [
      "test/frame-outbox.test.ts"
    ]
  },
  {
    "id": "L3.M12d",
    "guard": "drop the terminal timeout: a sent changes left unanswered never ends",
    "changes": [
      {
        "file": "src/frame-runtime/outbox.ts",
        "old": "      req.timer = clock.setTimeout(() => {\n        req.timer = undefined;\n        if (current !== req) return;\n        end(req, null);\n        advance();\n      }, L.frameChangesTimeoutMs);\n",
        "new": ""
      }
    ],
    "tests": [
      "test/frame-outbox.test.ts"
    ]
  },
  {
    "id": "L3.M12e",
    "guard": "pace by the parent window alone: the transit margin dropped",
    "changes": [
      {
        "file": "src/frame-runtime/outbox.ts",
        "old": "  const paceMs = L.frameWindowMs + TRANSIT_MARGIN_MS;",
        "new": "  const paceMs = L.frameWindowMs;"
      }
    ],
    "tests": [
      "test/frame-outbox.test.ts"
    ]
  },
  {
    "id": "L3.M12f",
    "guard": "the outbox paced by the wall clock (Date.now) instead of the monotonic performance.now",
    "changes": [
      {
        "file": "src/frame-runtime/bootstrap.ts",
        "old": "now: () => perfNow.call(perf),",
        "new": "now: () => Date.now(),"
      }
    ],
    "tests": [
      "test/browser/frame-boot.test.ts"
    ],
    "filter": "stepWallClock",
    "rebuild": true,
    "env": {
      "DOCREADER_BROWSERS": "chromium"
    }
  },
  {
    "id": "L3.M19g1",
    "guard": "plant a test-only branch in the guard (`if (globalThis.__TEST) ...`)",
    "changes": [
      {
        "file": "src/frame-runtime/guard.ts",
        "old": "  add.call(window, 'submit', (e: Event) => preventDefault.call(e), true);",
        "new": "  add.call(window, 'submit', (e: Event) => preventDefault.call(e), true);\n  if ((globalThis as unknown as { __TEST?: boolean }).__TEST === true) add.call(window, 'click', () => undefined, true);"
      }
    ],
    "tests": [
      "test/frame-runtime-walls.test.ts"
    ]
  },
  {
    "id": "L3.M19g2",
    "guard": "plant a branch on a test-named flag in the guard (`if (testHook) ...`)",
    "changes": [
      {
        "file": "src/frame-runtime/guard.ts",
        "old": "  add.call(window, 'submit', (e: Event) => preventDefault.call(e), true);",
        "new": "  add.call(window, 'submit', (e: Event) => preventDefault.call(e), true);\n  const testHook = (me as unknown as { dataset?: { hook?: string } }).dataset?.hook;\n  if (testHook !== undefined) add.call(window, 'click', () => undefined, true);"
      }
    ],
    "tests": [
      "test/frame-runtime-walls.test.ts"
    ]
  },
  {
    "id": "L3.M19g3",
    "guard": "plant a branch on a test-named flag read off the global in the guard (`if (globalThis.isTesting) ...`)",
    "changes": [
      {
        "file": "src/frame-runtime/guard.ts",
        "old": "  add.call(window, 'submit', (e: Event) => preventDefault.call(e), true);",
        "new": "  add.call(window, 'submit', (e: Event) => preventDefault.call(e), true);\n  if ((globalThis as unknown as { isTesting?: boolean }).isTesting === true) add.call(window, 'click', () => undefined, true);"
      }
    ],
    "tests": [
      "test/frame-runtime-walls.test.ts"
    ]
  },
  {
    "id": "L3.M21a",
    "guard": "drop the probe: the bootstrap settles without loading the faces",
    "changes": [
      {
        "file": "src/frame-runtime/bootstrap.ts",
        "old": "    await probeFaces(set === null || set === undefined || loadFaces === undefined ? null : { load: (f: string) => loadFaces.call(set, f) }, FACES, FONT_WAIT_MS);\n",
        "new": "    void set;\n"
      }
    ],
    "tests": [
      "test/frame-runtime.test.ts"
    ]
  },
  {
    "id": "L3.M21b",
    "guard": "probe the regular faces only",
    "changes": [
      {
        "file": "src/frame-runtime/fonts.ts",
        "old": "  'normal 400 1em \"Docreader Serif\"',\n  'italic 400 1em \"Docreader Serif\"',\n  'normal 400 1em \"Docreader Sans\"',\n  'italic 400 1em \"Docreader Sans\"',",
        "new": "  'normal 400 1em \"Docreader Serif\"',\n  'normal 400 1em \"Docreader Sans\"',"
      }
    ],
    "tests": [
      "test/frame-runtime.test.ts"
    ]
  },
  {
    "id": "L3.M21c",
    "guard": "drop the probe bound: never-settling loads keep the probe open",
    "changes": [
      {
        "file": "src/frame-runtime/fonts.ts",
        "old": "    later(resolve, ms);\n",
        "new": ""
      }
    ],
    "tests": [
      "test/frame-runtime.test.ts"
    ]
  },
  {
    "id": "L3.M21d",
    "guard": "bound the probe by FONT_WAIT_MS whatever ms it is given",
    "changes": [
      {
        "file": "src/frame-runtime/fonts.ts",
        "old": "    later(resolve, ms);\n",
        "new": "    later(resolve, FONT_WAIT_MS);\n"
      }
    ],
    "tests": [
      "test/frame-runtime.test.ts"
    ]
  },
  {
    "id": "L3.M22b",
    "guard": "skip the pin: the bootstrap never calls it",
    "changes": [
      {
        "file": "src/frame-runtime/bootstrap.ts",
        "old": "    pinFreeGlobals(win, DOCSERVER_FREE_GLOBALS);\n",
        "new": "    void DOCSERVER_FREE_GLOBALS;\n"
      }
    ],
    "tests": [
      "test/frame-runtime.test.ts"
    ]
  },
  {
    "id": "T5.INa",
    "guard": "parseParentMessage reads arrays with every (holes skipped) instead of by index",
    "changes": [
      {
        "file": "src/frame-runtime/inbound.ts",
        "old": "  for (let i = 0; i < v.length; i++) {\n    if (!isInteger(v[i])) return false;\n  }\n  return true;",
        "new": "  return v.every((x) => isInteger(x));"
      }
    ],
    "tests": [
      "test/frame-runtime.test.ts"
    ]
  },
  {
    "id": "T5.INb",
    "guard": "drop the ranges count cap",
    "changes": [
      {
        "file": "src/frame-runtime/inbound.ts",
        "old": "  if (!isArray(ranges) || ranges.length > CHANGES_MAX_RANGES) return null;",
        "new": "  if (!isArray(ranges)) return null;"
      }
    ],
    "tests": [
      "test/frame-runtime.test.ts"
    ]
  },
  {
    "id": "T5.INc",
    "guard": "drop the removedAfter count cap",
    "changes": [
      {
        "file": "src/frame-runtime/inbound.ts",
        "old": "intList(removedAfter, CHANGES_MAX_DELETIONS)",
        "new": "intList(removedAfter, Infinity)"
      }
    ],
    "tests": [
      "test/frame-runtime.test.ts"
    ]
  },
  {
    "id": "T5.T3a",
    "guard": "bundle a seed size formula into the bootstrap (Task 3's check, now read from the metafile and a names-kept build)",
    "changes": [
      {
        "file": "src/frame-runtime/bootstrap.ts",
        "old": "import { validateSeed, type Seed, type SeedMermaid } from '../frame/seed.js';",
        "new": "import { SEED_FIELDS_MAX_CHARS, validateSeed, type Seed, type SeedMermaid } from '../frame/seed.js';"
      },
      {
        "file": "src/frame-runtime/bootstrap.ts",
        "old": "  const check = validateSeed(raw);\n",
        "new": "  if (raw === SEED_FIELDS_MAX_CHARS) return;\n  const check = validateSeed(raw);\n"
      }
    ],
    "tests": [
      "test/frame-document.test.ts"
    ],
    "filter": "size formulas"
  },
  {
    "id": "L3.B4c",
    "guard": "accept a hello from any source: the parent-window check dropped (a hello the frame posts to itself binds)",
    "changes": [
      {
        "file": "src/frame-runtime/bootstrap.ts",
        "old": "    if (sourceOf.call(e) !== parentWin) return;\n",
        "new": ""
      }
    ],
    "tests": [
      "test/browser/frame-boot.test.ts"
    ],
    "filter": "L3.B4",
    "rebuild": true,
    "env": {
      "DOCREADER_BROWSERS": "chromium"
    }
  },
  {
    "id": "L3.B3a",
    "guard": "read the seed by id (an id lookup: no seed has one, so the frame never readies)",
    "changes": [
      {
        "file": "src/frame-runtime/bootstrap.ts",
        "old": "  const seedEl = prevSibling.call(bs);",
        "new": "  const seedEl = doc.getElementById('seed');"
      }
    ],
    "tests": [
      "test/browser/frame-boot.test.ts"
    ],
    "filter": "L3.B3",
    "rebuild": true,
    "env": {
      "DOCREADER_BROWSERS": "chromium"
    }
  },
  {
    "id": "L3.B3b",
    "guard": "insert content before the scripts: the root materialised in Phase S, into a body made early",
    "changes": [
      {
        "file": "src/frame-runtime/bootstrap.ts",
        "old": "  const adapters = createAdapters(outbox, seed);",
        "new": "  appendChild.call(documentElement.call(doc) as Element, doc.createElement('body'));\n  root = materialise(doc, seed.html, seed.lang, new Map(seed.images), content);\n  const adapters = createAdapters(outbox, seed);"
      },
      {
        "file": "src/frame-runtime/bootstrap.ts",
        "old": "      root = materialise(doc, seed.html, seed.lang, new Map(seed.images), content);",
        "new": "      root = root ?? materialise(doc, seed.html, seed.lang, new Map(seed.images), content);"
      },
      {
        "file": "src/frame-runtime/bootstrap.ts",
        "old": "  const startPort = MessagePort.prototype.start;",
        "new": "  const startPort = MessagePort.prototype.start;\n  const appendChild = Node.prototype.appendChild;"
      }
    ],
    "tests": [
      "test/browser/frame-boot.test.ts"
    ],
    "filter": "L3.B3",
    "rebuild": true,
    "env": {
      "DOCREADER_BROWSERS": "chromium"
    }
  },
  {
    "id": "L3.B3c",
    "guard": "accept registration without the position check",
    "changes": [
      {
        "file": "src/frame-runtime/bootstrap.ts",
        "old": "    if (d['name'] === 'enhance' && from === enhanceEl && api === null) {",
        "new": "    if (d['name'] === 'enhance' && api === null) {"
      }
    ],
    "tests": [
      "test/browser/frame-boot.test.ts"
    ],
    "filter": "L3.B3",
    "rebuild": true,
    "env": {
      "DOCREADER_BROWSERS": "chromium"
    }
  },
  {
    "id": "L3.B3d",
    "guard": "read the seed with querySelector in Phase S instead of by position",
    "changes": [
      {
        "file": "src/frame-runtime/bootstrap.ts",
        "old": "  const seedEl = prevSibling.call(bs);",
        "new": "  const seedEl = doc.querySelector('script[type=\"application/json\"]');"
      }
    ],
    "tests": [
      "test/browser/frame-boot.test.ts"
    ],
    "filter": "L3.B",
    "rebuild": true,
    "env": {
      "DOCREADER_BROWSERS": "chromium"
    }
  },
  {
    "id": "L3.B4a",
    "guard": "accept any hello: the key check dropped (a hello with an extra key binds)",
    "changes": [
      {
        "file": "src/frame-runtime/bootstrap.ts",
        "old": "    if (k.length !== 2 || !k.includes('t') || !k.includes('v')) return;\n",
        "new": ""
      }
    ],
    "tests": [
      "test/browser/frame-boot.test.ts"
    ],
    "filter": "L3.B4",
    "rebuild": true,
    "env": {
      "DOCREADER_BROWSERS": "chromium"
    }
  },
  {
    "id": "L3.B4b",
    "guard": "keep the window listener after hello",
    "changes": [
      {
        "file": "src/frame-runtime/bootstrap.ts",
        "old": "    remove.call(win, 'message', onMessage, false);\n    port = p;",
        "new": "    port = p;"
      }
    ],
    "tests": [
      "test/browser/frame-boot.test.ts"
    ],
    "filter": "L3.B4|L3.B11",
    "rebuild": true,
    "env": {
      "DOCREADER_BROWSERS": "chromium"
    }
  },
  {
    "id": "L3.B5a",
    "guard": "send ops at hello: the outbox opens when the port arrives, before ready",
    "changes": [
      {
        "file": "src/frame-runtime/bootstrap.ts",
        "old": "    port = p;\n",
        "new": "    port = p;\n    outbox.open();\n"
      }
    ],
    "tests": [
      "test/browser/frame-boot.test.ts"
    ],
    "filter": "L3.B5",
    "rebuild": true,
    "env": {
      "DOCREADER_BROWSERS": "chromium"
    }
  },
  {
    "id": "L3.B5b",
    "guard": "error before ready",
    "changes": [
      {
        "file": "src/frame-runtime/bootstrap.ts",
        "old": "    post({ t: 'ready', v: 1, nonce });\n    if (state === 'failed' || mismatch) {\n      post({ t: 'error', why: mismatch ? 'protocol' : why });",
        "new": "    if (state === 'failed' || mismatch) post({ t: 'error', why: mismatch ? 'protocol' : why });\n    post({ t: 'ready', v: 1, nonce });\n    if (state === 'failed' || mismatch) {"
      }
    ],
    "tests": [
      "test/browser/frame-boot.test.ts"
    ],
    "filter": "L3.B5",
    "rebuild": true,
    "env": {
      "DOCREADER_BROWSERS": "chromium"
    }
  },
  {
    "id": "L3.B6a",
    "guard": "ready on enhance resolve: no wait for Mermaid's first pass",
    "changes": [
      {
        "file": "src/frame-runtime/bootstrap.ts",
        "old": "      if (seed.mermaid !== null) await diagramsSettled(root);\n",
        "new": ""
      }
    ],
    "tests": [
      "test/browser/frame-boot.test.ts"
    ],
    "filter": "L3.B6",
    "rebuild": true,
    "env": {
      "DOCREADER_BROWSERS": "chromium"
    }
  },
  {
    "id": "L3.B6b-a",
    "guard": "treat a missing Mermaid as assets",
    "changes": [
      {
        "file": "src/frame-runtime/bootstrap.ts",
        "old": "      if (mermaidModule === null) {\n        fail('mermaid');",
        "new": "      if (mermaidModule === null) {\n        fail('assets');"
      }
    ],
    "tests": [
      "test/browser/frame-boot.test.ts"
    ],
    "filter": "L3.B6b",
    "rebuild": true,
    "env": {
      "DOCREADER_BROWSERS": "chromium"
    }
  },
  {
    "id": "L3.B6b-b",
    "guard": "treat a missing or incomplete Mermaid as no wait: ready with no error",
    "changes": [
      {
        "file": "src/frame-runtime/bootstrap.ts",
        "old": "      if (mermaidModule === null) {\n        fail('mermaid');\n        return;\n      }\n      if (typeof mermaidModule['initialize'] !== 'function' || typeof mermaidModule['run'] !== 'function') {\n        fail('mermaid');\n        return;\n      }",
        "new": "      if (mermaidModule === null || typeof mermaidModule['run'] !== 'function') mermaidApi = null;"
      }
    ],
    "tests": [
      "test/browser/frame-boot.test.ts"
    ],
    "filter": "L3.B6b",
    "rebuild": true,
    "env": {
      "DOCREADER_BROWSERS": "chromium"
    }
  },
  {
    "id": "L3.B8a",
    "guard": "a raw L2 key: the store key sent unmapped",
    "changes": [
      {
        "file": "src/frame-runtime/adapters.ts",
        "old": "        outbox.send({ t: 'store.set', key: k, value: text });",
        "new": "        outbox.send({ t: 'store.set', key: key as BridgeStoreKey, value: text });"
      }
    ],
    "tests": [
      "test/browser/frame-boot.test.ts",
      "test/frame-runtime.test.ts"
    ],
    "filter": "L3.B8|adapters",
    "rebuild": true,
    "env": {
      "DOCREADER_BROWSERS": "chromium"
    }
  },
  {
    "id": "L3.B8b",
    "guard": "'' for delete",
    "changes": [
      {
        "file": "src/frame-runtime/adapters.ts",
        "old": "        const text = value === null ? 'null' : value;\n        if (typeof text !== 'string' || utf8Bytes(text) > BRIDGE_LIMITS.valueMaxBytes) return;\n        try {\n          parse(text);\n        } catch {\n          return;\n        }",
        "new": "        const text = value === null ? '' : value;\n        if (typeof text !== 'string' || utf8Bytes(text) > BRIDGE_LIMITS.valueMaxBytes) return;\n        try {\n          if (text !== '') parse(text);\n        } catch {\n          return;\n        }"
      }
    ],
    "tests": [
      "test/browser/frame-boot.test.ts",
      "test/frame-runtime.test.ts"
    ],
    "filter": "L3.B8|adapters",
    "rebuild": true,
    "env": {
      "DOCREADER_BROWSERS": "chromium"
    }
  },
  {
    "id": "L3.B9a",
    "guard": "drop check (a): the opaque origin",
    "changes": [
      {
        "file": "src/frame-runtime/bootstrap.ts",
        "old": "      origin === 'null' &&\n",
        "new": ""
      }
    ],
    "tests": [
      "test/browser/frame-boot.test.ts"
    ],
    "filter": "L3.B9",
    "rebuild": true,
    "env": {
      "DOCREADER_BROWSERS": "chromium"
    }
  },
  {
    "id": "L3.B9b",
    "guard": "drop check (b): the policy floor",
    "changes": [
      {
        "file": "src/frame-runtime/bootstrap.ts",
        "old": "      cspFloor(getAttribute.call(meta, 'content') ?? '').ok &&\n",
        "new": ""
      }
    ],
    "tests": [
      "test/browser/frame-boot.test.ts"
    ],
    "filter": "L3.B9",
    "rebuild": true,
    "env": {
      "DOCREADER_BROWSERS": "chromium"
    }
  },
  {
    "id": "L3.B10a",
    "guard": "allow any tag",
    "changes": [
      {
        "file": "src/frame-runtime/content.ts",
        "old": "    if (!TAGS.has(el.localName)) return no(`<${el.localName}>`);\n",
        "new": ""
      }
    ],
    "tests": [
      "test/browser/frame-boot.test.ts",
      "test/frame-runtime.test.ts"
    ],
    "filter": "L3.B10|B10",
    "rebuild": true,
    "env": {
      "DOCREADER_BROWSERS": "chromium"
    }
  },
  {
    "id": "L3.B10b",
    "guard": "drop `open` from the vocabulary",
    "changes": [
      {
        "file": "src/frame-runtime/vocabulary.ts",
        "old": "'id', 'open', 'src'",
        "new": "'id', 'src'"
      }
    ],
    "tests": [
      "test/browser/frame-boot.test.ts",
      "test/frame-runtime.test.ts"
    ],
    "filter": "L3.B10|B10",
    "rebuild": true,
    "env": {
      "DOCREADER_BROWSERS": "chromium"
    }
  },
  {
    "id": "L3.B10c",
    "guard": "admit `name`",
    "changes": [
      {
        "file": "src/frame-runtime/content.ts",
        "old": "    if (/^on/i.test(name) || name === 'name' || !ATTRIBUTES.has(name)) return `<${tag} ${name}>`;",
        "new": "    if (/^on/i.test(name) || (!ATTRIBUTES.has(name) && name !== 'name')) return `<${tag} ${name}>`;"
      }
    ],
    "tests": [
      "test/browser/frame-boot.test.ts",
      "test/frame-runtime.test.ts"
    ],
    "filter": "L3.B10|B10",
    "rebuild": true,
    "env": {
      "DOCREADER_BROWSERS": "chromium"
    }
  },
  {
    "id": "L3.B11a",
    "guard": "store the port on a property of the window",
    "changes": [
      {
        "file": "src/frame-runtime/bootstrap.ts",
        "old": "    port = p;\n",
        "new": "    port = p;\n    (win as unknown as Record<string, unknown>)['docserverPort'] = p;\n"
      }
    ],
    "tests": [
      "test/browser/frame-boot.test.ts"
    ],
    "filter": "L3.B11",
    "rebuild": true,
    "env": {
      "DOCREADER_BROWSERS": "chromium"
    }
  }
]
```

## Coordinator ruling: L3.B6a deterministic (measured 2026-10-27 UTC)

This section supersedes every earlier L3.B6a entry: the row in "The browser rows", its JSON entry, the note under "Rows that needed a test before they could go red", and the Fix round's row, note and JSON entry.

**The ruling.** The row must read the reader's drawing state at the exact moment the frame posts `ready`, through test-side instrumentation only: no test-only path in the shipped scripts (guard, bootstrap, enhance bundle, Mermaid file). The earlier rows compared two clocks: the parent's arrival time of `ready` on its port, against the frame's MutationObserver time for the attribute leaving `drawing`. Under the mutation, `ready` can be posted during the drawing and still arrive after it, so the comparison raced.

**The instrument.** `test/browser/frame-host-page.ts` has a new opt-in init part, `diagramsAtReady`, beside `countCloses`, `observeDiagrams`, `measure` and `stepWallClock`. It wraps `MessagePort.prototype.postMessage` in the srcdoc document. When the message is the `ready` op, it records the content root's `data-docreader-diagrams` at that instant, or null when the root or the attribute is absent, then posts the message unchanged. `frameRecord()` returns these entries as `ready`.
- **Capture order.** The bootstrap reads the method off the prototype in Phase S (`src/frame-runtime/bootstrap.ts` line 108, `const postMessage = MessagePort.prototype.postMessage;`) and posts only through it (line 158, `postMessage.call(port, m)`). The built `assets/frame/bootstrap.js` reads `MessagePort.prototype.postMessage` exactly once. Playwright's init script (`context.addInitScript`) runs in the srcdoc document before any of its scripts, so the bootstrap captures the wrapper. The `countCloses` part already relies on this order for `MessagePort.prototype.close`.
- **Nothing shipped changed.** `src/frame-runtime/*.ts`, `assets/assets.json`, `src/frame/manifest.generated.ts` and `assets/frame/{guard,bootstrap,enhance}.js` hash the same before and after this change, and no Mermaid file in the tree is changed.

**The rows** (`test/browser/frame-boot.test.ts`). Both existing L3.B6 rows are kept with every assertion they had; each also opens its host with `diagramsAtReady`.
- `expectSettledAtReady` asserts exactly one `ready` was posted, and that the state then was one of `drawn`, `partial` or `failed`, never absent and never `drawing`.
- The P7 row (three figures) also asserts that the state at ready equals the one the root still holds (`drawn`).
- The slow-set row asserts `drawn` at ready, and its title now names the instrument: "L3.B6 (instrumented: `observeDiagrams` times the attribute, `diagramsAtReady` reads it at the ready post): with a set that takes longer to draw than the face probe, ready still comes only once the attribute is final".
- The `failed`, no-figure and `mermaid: null` rows are unchanged.

**Stable green, unmutated.**
- `DOCREADER_BROWSERS=chromium timeout -k 10 900 ./node_modules/.bin/vitest run --maxWorkers=2 -t "L3.B6" test/browser/frame-boot.test.ts`: six runs, each rc 0, `7 passed | 73 skipped (80)`.
- The whole file on Chromium: rc 0, `39 passed | 41 skipped (80)`.

**The mutation, measured five times.** The method is the one above, once per run:
- The original bytes and sha256 of `bootstrap.ts` and of the generated outputs were saved outside the worktree, and `old` was checked to occur exactly once.
- The frame was rebuilt (`node scripts/build-frame.mjs`; the mutated `assets/frame/bootstrap.js` hashed `fa109427337f…` in every run), and the row ran as `ulimit -u <threads + 1500>; timeout -k 10 600 …`.
- Each file was then restored from its saved bytes with its sha256 checked equal (never `git checkout`), and `node scripts/build-frame.mjs --check` exited 0.

**Result: red in 5 of 5 runs, every time through an `AssertionError` and only through one.**
- The P7 row failed in all five, each time at the new assertion: the state when the frame posted ready was `drawing`.
- The slow-set row failed in 3 of 5, through the same assertion. In the other runs its drawing ended before the mutant's ready, so it does not carry the red alone; the P7 row does.
- The earlier arrival-time comparison caught P7 by 157 to 183 ms in its red runs, so the drawing outlasts the mutant's ready by a wide margin. In this round the state at the post was `drawing` in every run.
- After the last run, `sha256sum -c` over the Task 5 sources and generated outputs matched, and `build-frame --check` exited 0.

| Row | Guard | Change | Red | Restore |
|---|---|---|---|---|
| L3.B6a (run 1) | ready on enhance resolve: no wait for Mermaid's first pass | `src/frame-runtime/bootstrap.ts`: `      if (seed.mermaid !== null) await diagramsSettled(root); ⏎ ` → (removed) | `test/browser/frame-boot.test.ts` (-t `L3.B6`, threads 2,328): 2 failed \| 5 passed \| 73 skipped (80). "L3.B6 (P7): Mermaid as a classic IIFE draws a flowchart, a sequence and a gantt under the hash-only policy; ready waits for it"; "L3.B6 (instrumented: `observeDiagrams` times the attribute, `diagramsAtReady` reads it at the ready post): with a set that takes longer to draw than the face probe, ready still comes only once the attribute is final"; each through `AssertionError: the diagrams state when the frame posted ready was drawing: expected [ 'drawn', 'partial', 'failed' ] to include 'drawing'` | `src/frame-runtime/bootstrap.ts` sha256 `46e771af805b…` restored, equal; `assets/assets.json` sha256 `87a67570c717…` restored, equal; `src/frame/manifest.generated.ts` sha256 `a8637f9517ef…` restored, equal; `assets/frame/guard.js` sha256 `ff3c25da5703…` restored, equal; `assets/frame/bootstrap.js` sha256 `3b69498221b6…` restored, equal; `assets/frame/enhance.js` sha256 `33232f70834a…` restored, equal; then `node scripts/build-frame.mjs --check` exited 0 |
| L3.B6a (run 2) | ready on enhance resolve: no wait for Mermaid's first pass | `src/frame-runtime/bootstrap.ts`: `      if (seed.mermaid !== null) await diagramsSettled(root); ⏎ ` → (removed) | `test/browser/frame-boot.test.ts` (-t `L3.B6`, threads 2,338): 1 failed \| 6 passed \| 73 skipped (80). "L3.B6 (P7): Mermaid as a classic IIFE draws a flowchart, a sequence and a gantt under the hash-only policy; ready waits for it", through `AssertionError: the diagrams state when the frame posted ready was drawing: expected [ 'drawn', 'partial', 'failed' ] to include 'drawing'` | `src/frame-runtime/bootstrap.ts` sha256 `46e771af805b…` restored, equal; `assets/assets.json` sha256 `87a67570c717…` restored, equal; `src/frame/manifest.generated.ts` sha256 `a8637f9517ef…` restored, equal; `assets/frame/guard.js` sha256 `ff3c25da5703…` restored, equal; `assets/frame/bootstrap.js` sha256 `3b69498221b6…` restored, equal; `assets/frame/enhance.js` sha256 `33232f70834a…` restored, equal; then `node scripts/build-frame.mjs --check` exited 0 |
| L3.B6a (run 3) | ready on enhance resolve: no wait for Mermaid's first pass | `src/frame-runtime/bootstrap.ts`: `      if (seed.mermaid !== null) await diagramsSettled(root); ⏎ ` → (removed) | `test/browser/frame-boot.test.ts` (-t `L3.B6`, threads 2,356): 2 failed \| 5 passed \| 73 skipped (80). "L3.B6 (P7): Mermaid as a classic IIFE draws a flowchart, a sequence and a gantt under the hash-only policy; ready waits for it"; "L3.B6 (instrumented: `observeDiagrams` times the attribute, `diagramsAtReady` reads it at the ready post): with a set that takes longer to draw than the face probe, ready still comes only once the attribute is final"; each through `AssertionError: the diagrams state when the frame posted ready was drawing: expected [ 'drawn', 'partial', 'failed' ] to include 'drawing'` | `src/frame-runtime/bootstrap.ts` sha256 `46e771af805b…` restored, equal; `assets/assets.json` sha256 `87a67570c717…` restored, equal; `src/frame/manifest.generated.ts` sha256 `a8637f9517ef…` restored, equal; `assets/frame/guard.js` sha256 `ff3c25da5703…` restored, equal; `assets/frame/bootstrap.js` sha256 `3b69498221b6…` restored, equal; `assets/frame/enhance.js` sha256 `33232f70834a…` restored, equal; then `node scripts/build-frame.mjs --check` exited 0 |
| L3.B6a (run 4) | ready on enhance resolve: no wait for Mermaid's first pass | `src/frame-runtime/bootstrap.ts`: `      if (seed.mermaid !== null) await diagramsSettled(root); ⏎ ` → (removed) | `test/browser/frame-boot.test.ts` (-t `L3.B6`, threads 2,338): 2 failed \| 5 passed \| 73 skipped (80). "L3.B6 (P7): Mermaid as a classic IIFE draws a flowchart, a sequence and a gantt under the hash-only policy; ready waits for it"; "L3.B6 (instrumented: `observeDiagrams` times the attribute, `diagramsAtReady` reads it at the ready post): with a set that takes longer to draw than the face probe, ready still comes only once the attribute is final"; each through `AssertionError: the diagrams state when the frame posted ready was drawing: expected [ 'drawn', 'partial', 'failed' ] to include 'drawing'` | `src/frame-runtime/bootstrap.ts` sha256 `46e771af805b…` restored, equal; `assets/assets.json` sha256 `87a67570c717…` restored, equal; `src/frame/manifest.generated.ts` sha256 `a8637f9517ef…` restored, equal; `assets/frame/guard.js` sha256 `ff3c25da5703…` restored, equal; `assets/frame/bootstrap.js` sha256 `3b69498221b6…` restored, equal; `assets/frame/enhance.js` sha256 `33232f70834a…` restored, equal; then `node scripts/build-frame.mjs --check` exited 0 |
| L3.B6a (run 5) | ready on enhance resolve: no wait for Mermaid's first pass | `src/frame-runtime/bootstrap.ts`: `      if (seed.mermaid !== null) await diagramsSettled(root); ⏎ ` → (removed) | `test/browser/frame-boot.test.ts` (-t `L3.B6`, threads 2,311): 1 failed \| 6 passed \| 73 skipped (80). "L3.B6 (P7): Mermaid as a classic IIFE draws a flowchart, a sequence and a gantt under the hash-only policy; ready waits for it", through `AssertionError: the diagrams state when the frame posted ready was drawing: expected [ 'drawn', 'partial', 'failed' ] to include 'drawing'` | `src/frame-runtime/bootstrap.ts` sha256 `46e771af805b…` restored, equal; `assets/assets.json` sha256 `87a67570c717…` restored, equal; `src/frame/manifest.generated.ts` sha256 `a8637f9517ef…` restored, equal; `assets/frame/guard.js` sha256 `ff3c25da5703…` restored, equal; `assets/frame/bootstrap.js` sha256 `3b69498221b6…` restored, equal; `assets/frame/enhance.js` sha256 `33232f70834a…` restored, equal; then `node scripts/build-frame.mjs --check` exited 0 |

```json
{
  "id": "L3.B6a",
  "guard": "ready on enhance resolve: no wait for Mermaid's first pass",
  "changes": [
    {
      "file": "src/frame-runtime/bootstrap.ts",
      "old": "      if (seed.mermaid !== null) await diagramsSettled(root);\n",
      "new": ""
    }
  ],
  "tests": [
    "test/browser/frame-boot.test.ts"
  ],
  "filter": "L3.B6",
  "rebuild": true,
  "env": {
    "DOCREADER_BROWSERS": "chromium"
  },
  "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 -t \"L3.B6\" test/browser/frame-boot.test.ts",
  "runs": [
    {
      "run": 1,
      "at": "2026-10-27T07:24:22.663Z",
      "threads": 2328,
      "rc": 1,
      "red": "2 failed | 5 passed | 73 skipped (80)",
      "failing": [
        "L3.B6 (P7): Mermaid as a classic IIFE draws a flowchart, a sequence and a gantt under the hash-only policy; ready waits for it",
        "L3.B6 (instrumented: `observeDiagrams` times the attribute, `diagramsAtReady` reads it at the ready post): with a set that takes longer to draw than the face probe, ready still comes only once the attribute is final"
      ],
      "errors": [
        "AssertionError"
      ],
      "assertions": [
        "AssertionError: the diagrams state when the frame posted ready was drawing: expected [ 'drawn', 'partial', 'failed' ] to include 'drawing'",
        "AssertionError: the diagrams state when the frame posted ready was drawing: expected [ 'drawn', 'partial', 'failed' ] to include 'drawing'"
      ],
      "restore": {
        "src/frame-runtime/bootstrap.ts": "46e771af805b restored, equal",
        "assets/assets.json": "87a67570c717 restored, equal",
        "src/frame/manifest.generated.ts": "a8637f9517ef restored, equal",
        "assets/frame/guard.js": "ff3c25da5703 restored, equal",
        "assets/frame/bootstrap.js": "3b69498221b6 restored, equal",
        "assets/frame/enhance.js": "33232f70834a restored, equal"
      },
      "checkRc": 0
    },
    {
      "run": 2,
      "at": "2026-10-27T07:24:36.830Z",
      "threads": 2338,
      "rc": 1,
      "red": "1 failed | 6 passed | 73 skipped (80)",
      "failing": [
        "L3.B6 (P7): Mermaid as a classic IIFE draws a flowchart, a sequence and a gantt under the hash-only policy; ready waits for it"
      ],
      "errors": [
        "AssertionError"
      ],
      "assertions": [
        "AssertionError: the diagrams state when the frame posted ready was drawing: expected [ 'drawn', 'partial', 'failed' ] to include 'drawing'"
      ],
      "restore": {
        "src/frame-runtime/bootstrap.ts": "46e771af805b restored, equal",
        "assets/assets.json": "87a67570c717 restored, equal",
        "src/frame/manifest.generated.ts": "a8637f9517ef restored, equal",
        "assets/frame/guard.js": "ff3c25da5703 restored, equal",
        "assets/frame/bootstrap.js": "3b69498221b6 restored, equal",
        "assets/frame/enhance.js": "33232f70834a restored, equal"
      },
      "checkRc": 0
    },
    {
      "run": 3,
      "at": "2026-10-27T07:24:51.706Z",
      "threads": 2356,
      "rc": 1,
      "red": "2 failed | 5 passed | 73 skipped (80)",
      "failing": [
        "L3.B6 (P7): Mermaid as a classic IIFE draws a flowchart, a sequence and a gantt under the hash-only policy; ready waits for it",
        "L3.B6 (instrumented: `observeDiagrams` times the attribute, `diagramsAtReady` reads it at the ready post): with a set that takes longer to draw than the face probe, ready still comes only once the attribute is final"
      ],
      "errors": [
        "AssertionError"
      ],
      "assertions": [
        "AssertionError: the diagrams state when the frame posted ready was drawing: expected [ 'drawn', 'partial', 'failed' ] to include 'drawing'",
        "AssertionError: the diagrams state when the frame posted ready was drawing: expected [ 'drawn', 'partial', 'failed' ] to include 'drawing'"
      ],
      "restore": {
        "src/frame-runtime/bootstrap.ts": "46e771af805b restored, equal",
        "assets/assets.json": "87a67570c717 restored, equal",
        "src/frame/manifest.generated.ts": "a8637f9517ef restored, equal",
        "assets/frame/guard.js": "ff3c25da5703 restored, equal",
        "assets/frame/bootstrap.js": "3b69498221b6 restored, equal",
        "assets/frame/enhance.js": "33232f70834a restored, equal"
      },
      "checkRc": 0
    },
    {
      "run": 4,
      "at": "2026-10-27T07:25:13.689Z",
      "threads": 2338,
      "rc": 1,
      "red": "2 failed | 5 passed | 73 skipped (80)",
      "failing": [
        "L3.B6 (P7): Mermaid as a classic IIFE draws a flowchart, a sequence and a gantt under the hash-only policy; ready waits for it",
        "L3.B6 (instrumented: `observeDiagrams` times the attribute, `diagramsAtReady` reads it at the ready post): with a set that takes longer to draw than the face probe, ready still comes only once the attribute is final"
      ],
      "errors": [
        "AssertionError"
      ],
      "assertions": [
        "AssertionError: the diagrams state when the frame posted ready was drawing: expected [ 'drawn', 'partial', 'failed' ] to include 'drawing'",
        "AssertionError: the diagrams state when the frame posted ready was drawing: expected [ 'drawn', 'partial', 'failed' ] to include 'drawing'"
      ],
      "restore": {
        "src/frame-runtime/bootstrap.ts": "46e771af805b restored, equal",
        "assets/assets.json": "87a67570c717 restored, equal",
        "src/frame/manifest.generated.ts": "a8637f9517ef restored, equal",
        "assets/frame/guard.js": "ff3c25da5703 restored, equal",
        "assets/frame/bootstrap.js": "3b69498221b6 restored, equal",
        "assets/frame/enhance.js": "33232f70834a restored, equal"
      },
      "checkRc": 0
    },
    {
      "run": 5,
      "at": "2026-10-27T07:25:28.221Z",
      "threads": 2311,
      "rc": 1,
      "red": "1 failed | 6 passed | 73 skipped (80)",
      "failing": [
        "L3.B6 (P7): Mermaid as a classic IIFE draws a flowchart, a sequence and a gantt under the hash-only policy; ready waits for it"
      ],
      "errors": [
        "AssertionError"
      ],
      "assertions": [
        "AssertionError: the diagrams state when the frame posted ready was drawing: expected [ 'drawn', 'partial', 'failed' ] to include 'drawing'"
      ],
      "restore": {
        "src/frame-runtime/bootstrap.ts": "46e771af805b restored, equal",
        "assets/assets.json": "87a67570c717 restored, equal",
        "src/frame/manifest.generated.ts": "a8637f9517ef restored, equal",
        "assets/frame/guard.js": "ff3c25da5703 restored, equal",
        "assets/frame/bootstrap.js": "3b69498221b6 restored, equal",
        "assets/frame/enhance.js": "33232f70834a restored, equal"
      },
      "checkRc": 0
    }
  ]
}
```
