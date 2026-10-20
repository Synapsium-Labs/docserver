# L2 Task 6: mutation rows (real-browser harness, Level 2 runner, visual compare)

Each guard Task 6 adds, deleted or inverted once, with the tests that go red. Measured 2026-10-20 on branch
`l2-t6-browser`, after the review's fix round, on its final code: every row, L2-T6-M1 to L2-T6-M93, was measured
again there, in one run, with the results recorded here.

**Method.** The L1 plan's `mutate.mjs` (Task 1, Step 8) with the two changes its results section records (a
512 MiB output buffer, and a run that ends with no exit status reported as KILLED and counted as no verdict):
each row is applied to its own throwaway copy of the working tree (tracked and untracked files, never ignored
ones, `node_modules` linked from the checkout), its test file runs there with the local `vitest`, and the copy
is deleted. Each `old` occurs exactly once in its file. The rows ran with `DOCREADER_BROWSERS=chromium`: the
measuring machine's WebKit cannot start (its system libraries are not installed there), so every browser row ran
in Chromium and WebKit was reported as excluded. The checkout was never edited: `git status --porcelain` read the
same (empty) before and after. All 93 rows went red (`rc=1`).

Notes on the measurement.
- Before the fix round, two rows stayed green on their first run and were made red by changing the code, not by
  dropping them: L2-T6-M31 (an unreachable second chrome check, removed) and L2-T6-M40 (the runner compared only
  when a snapshot differed; the comparison is now `holdSnapshot()`, with cases of its own).
- The fix round changed the snapshot's scope rules, so three snapshot rows name the new code's guards: L2-T6-M30
  (a source element shows only what the scope names), L2-T6-M31 (an attribute entry never brings chrome in) and
  L2-T6-M32 (a class on chrome brings its whole subtree in).
- One row of the fix round stayed green and its guard was removed: the harness exempted `/favicon.ico` from the
  missing paths, but playwright-core aborts every request for a path ending in `/favicon.ico` before any route
  sees it, in every browser, so the exemption could never run. The missing-path case now pins that a favicon
  request never reaches the route.
- L2-T6-M18 (WebKit's closed proxy) is red here through the case that pins each browser's launch options. The
  behavioural case (a listener on loopback that a browser without the wall connects to, by name and by address)
  runs in WebKit for the first time in CI; in Chromium it is what makes L2-T6-M17 red.
- Not covered by a row: where `compare.mjs` passes `OFFLINE_ARGS` to the launch (the constant itself is
  L2-T6-M85; every request of an offline run is also refused by its route, L2-T6-M86, so a launch without the
  rule changes no output), and `compare.mjs`'s wait for `data-ready` (the demo case compares a page with itself,
  so an unready page still matches; the demo's ready flag is L2-T6-M93, red through that case's 30 s wait).

## Configuration, CI and the public-ready walk (L2-T6-M1 to L2-T6-M7)

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T6-M1 | the unit project leaves the layout tests out | `vitest.config.ts` | `exclude: [BROWSER, PACK, LAYOUT]` → `exclude: [BROWSER, PACK]` | `test/vitest-config.test.ts`: 1 failed \| 2 passed (3). "runs every other test file first, then the browser bundle alone, then the packed tarball alone, then the layout tests" |
| L2-T6-M2 | the layout project runs last | `vitest.config.ts` | `hookTimeout: 60_000, sequence: { groupOrder: 3 }` → `hookTimeout: 60_000, sequence: { groupOrder: 1 }` | `test/vitest-config.test.ts`: 2 failed \| 1 passed (3). "runs every other test file first, then the browser bundle alone, then the packed tarball alone, then the layout tests"; "the layout project, last, waits up to 60 s in a hook (each browser block launches its browser in beforeAll); the others keep the default" |
| L2-T6-M3 | the layout project waits 60 s in a hook | `vitest.config.ts` | `hookTimeout: 60_000, sequence` → `sequence` | `test/vitest-config.test.ts`: 1 failed \| 2 passed (3). "the layout project, last, waits up to 60 s in a hook (each browser block launches its browser in beforeAll); the others keep the default" |
| L2-T6-M4 | CI installs the browsers before the tests | `.github/workflows/ci.yml` | `      - run: npx playwright-core install --with-deps chromium webkit ⏎ ` → (deleted) | `test/ci-workflow.test.ts`: 2 failed \| 9 passed (11). "installs from the lock and the browsers, typechecks, tests, checks the tests wrote no layout snapshot, builds, runs the ratchet, then packs and smokes the tarball"; "installs the browsers with the one install command the harness, the compare script and the README name" |
| L2-T6-M5 | the public-ready walk skips visual-out/ at the root | `test/public-ready.test.ts` | `  'visual-out': 'the screenshots and reports scripts/visual/compare.mjs writes (a measured page may …` → (deleted) | `test/public-ready.test.ts`: 2 failed \| 7 passed \| 1 skipped (10). "skips a root .git file, a root .git directory and each named root scratch directory"; "each root directory a script of this repository writes is git-ignored, so it never reaches a commit" |
| L2-T6-M6 | the root-level skips apply at the root only (a nested visual-out/ or demo-out/ is scanned) | `test/public-ready.test.ts` | `if (atRoot && Object.hasOwn(ROOT_SKIP, e.name)) continue;` → `if (Object.hasOwn(ROOT_SKIP, e.name)) continue;` | `test/public-ready.test.ts`: 1 failed \| 8 passed \| 1 skipped (10). "a nested directory that shares a skipped name, and a nested .git file or directory, are scanned" |
| L2-T6-M7 | visual-out/ is git-ignored | `.gitignore` | `visual-out/ ⏎ ` → (deleted) | `test/public-ready.test.ts`: 1 failed \| 8 passed \| 1 skipped (10). "each root directory a script of this repository writes is git-ignored, so it never reaches a commit" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T6-M1",
    "guard": "the unit project leaves the layout tests out",
    "file": "vitest.config.ts",
    "old": "exclude: [BROWSER, PACK, LAYOUT]",
    "new": "exclude: [BROWSER, PACK]",
    "tests": "test/vitest-config.test.ts"
  },
  {
    "id": "L2-T6-M2",
    "guard": "the layout project runs last",
    "file": "vitest.config.ts",
    "old": "hookTimeout: 60_000, sequence: { groupOrder: 3 }",
    "new": "hookTimeout: 60_000, sequence: { groupOrder: 1 }",
    "tests": "test/vitest-config.test.ts"
  },
  {
    "id": "L2-T6-M3",
    "guard": "the layout project waits 60 s in a hook",
    "file": "vitest.config.ts",
    "old": "hookTimeout: 60_000, sequence",
    "new": "sequence",
    "tests": "test/vitest-config.test.ts"
  },
  {
    "id": "L2-T6-M4",
    "guard": "CI installs the browsers before the tests",
    "file": ".github/workflows/ci.yml",
    "old": "      - run: npx playwright-core install --with-deps chromium webkit\n",
    "new": "",
    "tests": "test/ci-workflow.test.ts"
  },
  {
    "id": "L2-T6-M5",
    "guard": "the public-ready walk skips visual-out/ at the root",
    "file": "test/public-ready.test.ts",
    "old": "  'visual-out': 'the screenshots and reports scripts/visual/compare.mjs writes (a measured page may name anything); git-ignored',\n",
    "new": "",
    "tests": "test/public-ready.test.ts"
  },
  {
    "id": "L2-T6-M6",
    "guard": "the root-level skips apply at the root only (a nested visual-out/ or demo-out/ is scanned)",
    "file": "test/public-ready.test.ts",
    "old": "if (atRoot && Object.hasOwn(ROOT_SKIP, e.name)) continue;",
    "new": "if (Object.hasOwn(ROOT_SKIP, e.name)) continue;",
    "tests": "test/public-ready.test.ts"
  },
  {
    "id": "L2-T6-M7",
    "guard": "visual-out/ is git-ignored",
    "file": ".gitignore",
    "old": "visual-out/\n",
    "new": "",
    "tests": "test/public-ready.test.ts"
  }
]
```

## The ratchet: Layout-moved trailers and hostile layout cases (L2-T6-M8 to L2-T6-M15)

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T6-M8 | ratchet: a moved layout snapshot needs a Layout-moved trailer | `scripts/ratchet.mjs` | ``     if (!named.has(id)) out.push(`${id}: its layout snapshot changed, and no Layout-moved trailer na… `` → (deleted) | `test/ratchet.test.ts`: 2 failed \| 42 passed (44). "the trailers name exactly the moved cases"; "a moved layout snapshot needs a Layout-moved trailer naming exactly its case; a new case needs none" |
| L2-T6-M9 | ratchet: a Layout-moved trailer names only moved cases | `scripts/ratchet.mjs` | ``     if (!moved.has(id)) out.push(`${id}: a Layout-moved trailer names it, and its layout snapshot di… `` → (deleted) | `test/ratchet.test.ts`: 2 failed \| 42 passed (44). "the trailers name exactly the moved cases"; "a moved layout snapshot needs a Layout-moved trailer naming exactly its case; a new case needs none" |
| L2-T6-M10 | ratchet: an added case is not a move | `scripts/ratchet.mjs` | `c.kind === 'dom.txt' && c.status !== 'A'` → `c.kind === 'dom.txt'` | `test/ratchet.test.ts`: 3 failed \| 41 passed (44). "a modified, retyped or deleted snapshot is a move; an added one is a new case"; "a moved layout snapshot needs a Layout-moved trailer naming exactly its case; a new case needs none"; "a hostile layout case moved to a new name is a removal: renames are not followed" |
| L2-T6-M11 | ratchet: a hostile layout case is never removed | `scripts/ratchet.mjs` | ``     if (mine.some((c) => c.status === 'D')) out.push(`${id}: a hostile layout case was removed (a ho… `` → `    if` | `test/ratchet.test.ts`: 3 failed \| 41 passed (44). "a hostile case is never removed and its input and options never change; its snapshot may move"; "a hostile layout case is never removed or edited; its snapshot moves with a trailer; another case may change"; "a hostile layout case moved to a new name is a removal: renames are not followed" |
| L2-T6-M12 | ratchet: a hostile layout case's input and options never change | `scripts/ratchet.mjs` | ``     else if (mine.some((c) => c.kind !== 'dom.txt')) out.push(`${id}: a hostile layout case's input … `` → (deleted) | `test/ratchet.test.ts`: 2 failed \| 42 passed (44). "a hostile case is never removed and its input and options never change; its snapshot may move"; "a hostile layout case is never removed or edited; its snapshot moves with a trailer; another case may change" |
| L2-T6-M13 | ratchet: only a case the base marks hostile is held | `scripts/ratchet.mjs` | `    if (JSON.parse(f.text).hostile === true) ids.push(m[1]);` → `    ids.push(m[1]);` | `test/ratchet.test.ts`: 3 failed \| 41 passed (44). "the hostile cases are those whose options file says hostile: true"; "a moved layout snapshot needs a Layout-moved trailer naming exactly its case; a new case needs none"; "a hostile layout case is never removed or edited; its snapshot moves with a trailer; another case may change" |
| L2-T6-M14 | ratchet: the command runs the layout-move check | `scripts/ratchet.mjs` | `    ...checkLayoutMoves(moved, layoutNamed), ⏎ ` → (deleted) | `test/ratchet.test.ts`: 1 failed \| 43 passed (44). "a moved layout snapshot needs a Layout-moved trailer naming exactly its case; a new case needs none" |
| L2-T6-M15 | ratchet: the command runs the hostile layout check | `scripts/ratchet.mjs` | `    ...checkLayoutHostile(hostileLayout, layout), ⏎ ` → (deleted) | `test/ratchet.test.ts`: 2 failed \| 42 passed (44). "a hostile layout case is never removed or edited; its snapshot moves with a trailer; another case may change"; "a hostile layout case moved to a new name is a removal: renames are not followed" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T6-M8",
    "guard": "ratchet: a moved layout snapshot needs a Layout-moved trailer",
    "file": "scripts/ratchet.mjs",
    "old": "    if (!named.has(id)) out.push(`${id}: its layout snapshot changed, and no Layout-moved trailer names it`);\n",
    "new": "",
    "tests": "test/ratchet.test.ts"
  },
  {
    "id": "L2-T6-M9",
    "guard": "ratchet: a Layout-moved trailer names only moved cases",
    "file": "scripts/ratchet.mjs",
    "old": "    if (!moved.has(id)) out.push(`${id}: a Layout-moved trailer names it, and its layout snapshot did not change`);\n",
    "new": "",
    "tests": "test/ratchet.test.ts"
  },
  {
    "id": "L2-T6-M10",
    "guard": "ratchet: an added case is not a move",
    "file": "scripts/ratchet.mjs",
    "old": "c.kind === 'dom.txt' && c.status !== 'A'",
    "new": "c.kind === 'dom.txt'",
    "tests": "test/ratchet.test.ts"
  },
  {
    "id": "L2-T6-M11",
    "guard": "ratchet: a hostile layout case is never removed",
    "file": "scripts/ratchet.mjs",
    "old": "    if (mine.some((c) => c.status === 'D')) out.push(`${id}: a hostile layout case was removed (a hostile case is never removed)`);\n    else if",
    "new": "    if",
    "tests": "test/ratchet.test.ts"
  },
  {
    "id": "L2-T6-M12",
    "guard": "ratchet: a hostile layout case's input and options never change",
    "file": "scripts/ratchet.mjs",
    "old": "    else if (mine.some((c) => c.kind !== 'dom.txt')) out.push(`${id}: a hostile layout case's input or options changed (add a new case instead)`);\n",
    "new": "",
    "tests": "test/ratchet.test.ts"
  },
  {
    "id": "L2-T6-M13",
    "guard": "ratchet: only a case the base marks hostile is held",
    "file": "scripts/ratchet.mjs",
    "old": "    if (JSON.parse(f.text).hostile === true) ids.push(m[1]);",
    "new": "    ids.push(m[1]);",
    "tests": "test/ratchet.test.ts"
  },
  {
    "id": "L2-T6-M14",
    "guard": "ratchet: the command runs the layout-move check",
    "file": "scripts/ratchet.mjs",
    "old": "    ...checkLayoutMoves(moved, layoutNamed),\n",
    "new": "",
    "tests": "test/ratchet.test.ts"
  },
  {
    "id": "L2-T6-M15",
    "guard": "ratchet: the command runs the hostile layout check",
    "file": "scripts/ratchet.mjs",
    "old": "    ...checkLayoutHostile(hostileLayout, layout),\n",
    "new": "",
    "tests": "test/ratchet.test.ts"
  }
]
```

## The harness: browsers, routing, policies and the selection (L2-T6-M16 to L2-T6-M27)

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T6-M16 | a routed request to another origin is aborted and counted | `test/browser/harness.ts` | `    aborted.push(url.href); ⏎     await route.abort('blockedbyclient');` → `    await route.fallback();` | `test/browser/harness.test.ts`: 1 failed \| 14 passed \| 7 skipped (22). "a routed request to another origin is aborted and counted" |
| L2-T6-M17 | Chromium resolves no host name | `test/browser/harness.ts` | `{ args: ['--host-resolver-rules=MAP * ~NOTFOUND'] }` → `{ args: [] }` | `test/browser/harness.test.ts`: 2 failed \| 13 passed \| 7 skipped (22). "each browser is kept off the network: Chromium resolves no name, WebKit proxies to a closed loopback port"; "a request let past the route reaches no host: neither a name nor an address on this machine" |
| L2-T6-M18 | WebKit sends every request to a closed proxy port | `test/browser/harness.ts` | `` { proxy: { server: `http://127.0.0.1:${String(CLOSED_PORT)}` } } `` → `{}` | `test/browser/harness.test.ts`: 1 failed \| 14 passed \| 7 skipped (22). "each browser is kept off the network: Chromium resolves no name, WebKit proxies to a closed loopback port" |
| L2-T6-M19 | a browser that cannot start names the install command | `test/browser/harness.ts` | `  } catch (e) { ⏎     const lines` → `  } catch (e) { ⏎     throw e; ⏎     const lines` | `test/browser/harness.test.ts`: 1 failed \| 14 passed \| 7 skipped (22). "a browser that cannot start is an error naming the install command" |
| L2-T6-M20 | the browser is driven over a pipe: the test process opens no socket | `test/browser/harness.ts` | `    return await type.launch({ ...launchOptions(name), ...extra });` → `    return await type.connect((await type.launchServer({ ...launchOptions(name), ...extra })).wsEndp…` | `test/browser/harness.test.ts`: 1 failed \| 7 passed \| 14 skipped (22). "chromium"; "the test process opens no socket: the browser is driven over a pipe" |
| L2-T6-M21 | strict refuses inline styles | `test/browser/harness.ts` | ``   strict: `default-src 'none'; script-src ${ORIGIN}; style-src ${ORIGIN}; font-src `` → ``   strict: `default-src 'none'; script-src ${ORIGIN}; style-src ${ORIGIN} 'unsafe-inline'; font-src `` | `test/browser/harness.test.ts`: 1 failed \| 14 passed \| 7 skipped (22). "strict: no eval or Function, no fetch, no inline styles" |
| L2-T6-M22 | strict has no 'unsafe-eval' | `test/browser/harness.ts` | ``   strict: `default-src 'none'; script-src ${ORIGIN}; style-src `` → ``   strict: `default-src 'none'; script-src ${ORIGIN} 'unsafe-eval'; style-src `` | `test/browser/harness.test.ts`: 1 failed \| 14 passed \| 7 skipped (22). "strict: no eval or Function, no fetch, no inline styles" |
| L2-T6-M23 | strict is default-src 'none' | `test/browser/harness.ts` | ``   strict: `default-src 'none'; script-src `` → ``   strict: `script-src `` | `test/browser/harness.test.ts`: 1 failed \| 14 passed \| 7 skipped (22). "strict: no eval or Function, no fetch, no inline styles" |
| L2-T6-M24 | the page is served under its policy | `test/browser/harness.ts` | `      if (url.pathname === '/') headers['content-security-policy'] = policy; ⏎ ` → (deleted) | `test/browser/harness.test.ts`: 2 failed \| 13 passed \| 7 skipped (22). "strict: no eval or Function, no fetch, no inline styles"; "reader: no eval or Function, no fetch, but inline styles" |
| L2-T6-M25 | DOCREADER_BROWSERS: an unknown name is an error | `test/browser/harness.ts` | `  if (names.length === 0 \|\| unknown.length > 0) {` → `  if (names.length === 0) {` | `test/browser/harness.test.ts`: 1 failed \| 14 passed \| 7 skipped (22). "an unknown name or an empty entry is an error, never a silent skip" |
| L2-T6-M26 | an excluded browser is reported, never silently skipped | `test/browser/harness.ts` | `    } else describe.skip(excludedTitle(name, selection), () => fn(name)); ⏎ ` → `    } ⏎ ` | `test/browser/harness.test.ts`: 1 failed \| 14 passed (15). "this file has one block per browser: a selected one runs, an excluded one is skipped under its title" |
| L2-T6-M27 | the page records its policy violations | `test/browser/page/bootstrap.ts` | ``   violations.push(`${e.effectiveDirective} ${e.blockedURI === '' ? 'inline' : e.blockedURI}`); ⏎  `` → (deleted) | `test/browser/harness.test.ts`: 2 failed \| 13 passed \| 7 skipped (22). "strict: no eval or Function, no fetch, no inline styles"; "reader: no eval or Function, no fetch, but inline styles" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T6-M16",
    "guard": "a routed request to another origin is aborted and counted",
    "file": "test/browser/harness.ts",
    "old": "    aborted.push(url.href);\n    await route.abort('blockedbyclient');",
    "new": "    await route.fallback();",
    "tests": "test/browser/harness.test.ts"
  },
  {
    "id": "L2-T6-M17",
    "guard": "Chromium resolves no host name",
    "file": "test/browser/harness.ts",
    "old": "{ args: ['--host-resolver-rules=MAP * ~NOTFOUND'] }",
    "new": "{ args: [] }",
    "tests": "test/browser/harness.test.ts"
  },
  {
    "id": "L2-T6-M18",
    "guard": "WebKit sends every request to a closed proxy port",
    "file": "test/browser/harness.ts",
    "old": "{ proxy: { server: `http://127.0.0.1:${String(CLOSED_PORT)}` } }",
    "new": "{}",
    "tests": "test/browser/harness.test.ts"
  },
  {
    "id": "L2-T6-M19",
    "guard": "a browser that cannot start names the install command",
    "file": "test/browser/harness.ts",
    "old": "  } catch (e) {\n    const lines",
    "new": "  } catch (e) {\n    throw e;\n    const lines",
    "tests": "test/browser/harness.test.ts"
  },
  {
    "id": "L2-T6-M20",
    "guard": "the browser is driven over a pipe: the test process opens no socket",
    "file": "test/browser/harness.ts",
    "old": "    return await type.launch({ ...launchOptions(name), ...extra });",
    "new": "    return await type.connect((await type.launchServer({ ...launchOptions(name), ...extra })).wsEndpoint());",
    "tests": "test/browser/harness.test.ts"
  },
  {
    "id": "L2-T6-M21",
    "guard": "strict refuses inline styles",
    "file": "test/browser/harness.ts",
    "old": "  strict: `default-src 'none'; script-src ${ORIGIN}; style-src ${ORIGIN}; font-src",
    "new": "  strict: `default-src 'none'; script-src ${ORIGIN}; style-src ${ORIGIN} 'unsafe-inline'; font-src",
    "tests": "test/browser/harness.test.ts"
  },
  {
    "id": "L2-T6-M22",
    "guard": "strict has no 'unsafe-eval'",
    "file": "test/browser/harness.ts",
    "old": "  strict: `default-src 'none'; script-src ${ORIGIN}; style-src",
    "new": "  strict: `default-src 'none'; script-src ${ORIGIN} 'unsafe-eval'; style-src",
    "tests": "test/browser/harness.test.ts"
  },
  {
    "id": "L2-T6-M23",
    "guard": "strict is default-src 'none'",
    "file": "test/browser/harness.ts",
    "old": "  strict: `default-src 'none'; script-src",
    "new": "  strict: `script-src",
    "tests": "test/browser/harness.test.ts"
  },
  {
    "id": "L2-T6-M24",
    "guard": "the page is served under its policy",
    "file": "test/browser/harness.ts",
    "old": "      if (url.pathname === '/') headers['content-security-policy'] = policy;\n",
    "new": "",
    "tests": "test/browser/harness.test.ts"
  },
  {
    "id": "L2-T6-M25",
    "guard": "DOCREADER_BROWSERS: an unknown name is an error",
    "file": "test/browser/harness.ts",
    "old": "  if (names.length === 0 || unknown.length > 0) {",
    "new": "  if (names.length === 0) {",
    "tests": "test/browser/harness.test.ts"
  },
  {
    "id": "L2-T6-M26",
    "guard": "an excluded browser is reported, never silently skipped",
    "file": "test/browser/harness.ts",
    "old": "    } else describe.skip(excludedTitle(name, selection), () => fn(name));\n",
    "new": "    }\n",
    "tests": "test/browser/harness.test.ts"
  },
  {
    "id": "L2-T6-M27",
    "guard": "the page records its policy violations",
    "file": "test/browser/page/bootstrap.ts",
    "old": "  violations.push(`${e.effectiveDirective} ${e.blockedURI === '' ? 'inline' : e.blockedURI}`);\n",
    "new": "",
    "tests": "test/browser/harness.test.ts"
  }
]
```

## The snapshot and the source texts (L2-T6-M28 to L2-T6-M36)

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T6-M28 | snapshot: chrome outside the scope is transparent | `test/browser/page/snapshot.ts` | `      walkChildren(el, false, scope, isSource, into); // transparent ⏎       continue; ⏎ ` → (deleted) | `test/browser/snapshot.test.ts`: 5 failed \| 9 passed (14). "a later feature's chrome, outside the scope, moves nothing: its children stand in its place and texts join"; "a chrome wrapper outside the scope keeps the source nodes it holds, in its place"; "[name] brings in a source element that carries it, by itself, showing only that attribute; never chrome, and not its children"; "a class on a source element brings in that element alone: chrome a later feature puts inside it moves nothing"; "chrome text is left out of the snapshot outside the scope, and kept inside it" |
| L2-T6-M29 | snapshot: chrome's own text is left out outside the scope | `test/browser/page/snapshot.ts` | `if (inScope \|\| isSource(n as Text)) into.push` → `if (true) into.push` | `test/browser/snapshot.test.ts`: 4 failed \| 10 passed (14). "a later feature's chrome, outside the scope, moves nothing: its children stand in its place and texts join"; "[name] brings in a source element that carries it, by itself, showing only that attribute; never chrome, and not its children"; "a class on a source element brings in that element alone: chrome a later feature puts inside it moves nothing"; "chrome text is left out of the snapshot outside the scope, and kept inside it" |
| L2-T6-M30 | snapshot: a source element shows only what the scope names on it | `test/browser/page/snapshot.ts` | `head: namedHead(el, classes, namedAttrs(el, scope))` → `head: fullHead(el)` | `test/browser/snapshot.test.ts`: 4 failed \| 10 passed (14). "lists every source element by tag and every source text, nested by two spaces, and nothing else out of scope"; "[name] brings in a source element that carries it, by itself, showing only that attribute; never chrome, and not its children"; "tag[name] brings in only a source element of that tag that carries the attribute"; "a source element in scope shows only what the scope names: a later feature's label or mark on it moves nothing" |
| L2-T6-M31 | snapshot: an [attribute] entry never brings chrome in | `test/browser/page/snapshot.ts` | `    if (inScope \|\| (chrome && classes.length > 0)) {` → `    if (inScope \|\| (chrome && (classes.length > 0 \|\| namedAttrs(el, scope).length > 0))) {` | `test/browser/snapshot.test.ts`: 1 failed \| 13 passed (14). "[name] brings in a source element that carries it, by itself, showing only that attribute; never chrome, and not its children" |
| L2-T6-M32 | snapshot: a class on chrome brings its whole subtree in | `test/browser/page/snapshot.ts` | `      walkChildren(el, true, scope, isSource, children);` → `      walkChildren(el, false, scope, isSource, children);` | `test/browser/snapshot.test.ts`: 2 failed \| 12 passed (14). "a class on chrome brings its element and the whole subtree in: classes, the chrome mark, role, aria-*, hidden, data-docreader-*, data-label"; "chrome text is left out of the snapshot outside the scope, and kept inside it" |
| L2-T6-M33 | snapshot: adjacent texts join | `test/browser/page/snapshot.ts` | `      pending = (pending ?? '') + o.text;` → `      flush(); ⏎       pending = o.text;` | `test/browser/snapshot.test.ts`: 1 failed \| 13 passed (14). "a later feature's chrome, outside the scope, moves nothing: its children stand in its place and texts join" |
| L2-T6-M34 | snapshot: texts are cut to 40 code points | `test/browser/page/snapshot.ts` | `export const TEXT_CUT = 40;` → `export const TEXT_CUT = 400;` | `test/browser/snapshot.test.ts`: 2 failed \| 12 passed (14). "a text is cut to 40 code points, and a cut one ends in … after its quote"; "an attribute value is cut the same way" |
| L2-T6-M35 | snapshot: an invalid scope entry is refused | `test/browser/page/snapshot.ts` | ``   if (bad.length > 0) throw new Error(`snapshot: invalid scope entries ${JSON.stringify(bad)}`); ⏎  `` → (deleted) | `test/browser/snapshot.test.ts`: 1 failed \| 13 passed (14). "an entry that is neither a class name nor [attribute] nor tag[attribute] is refused" |
| L2-T6-M36 | source texts: a tail split off a source text is source | `test/browser/page/source.ts` | `      if (known.has(this)) known.add(tail); ⏎ ` → (deleted) | `test/browser/snapshot.test.ts`: 2 failed \| 12 passed (14). "a later feature's chrome, outside the scope, moves nothing: its children stand in its place and texts join"; "a text present when tracked is source; a tail split off it is source; a text made later is not" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T6-M28",
    "guard": "snapshot: chrome outside the scope is transparent",
    "file": "test/browser/page/snapshot.ts",
    "old": "      walkChildren(el, false, scope, isSource, into); // transparent\n      continue;\n",
    "new": "",
    "tests": "test/browser/snapshot.test.ts"
  },
  {
    "id": "L2-T6-M29",
    "guard": "snapshot: chrome's own text is left out outside the scope",
    "file": "test/browser/page/snapshot.ts",
    "old": "if (inScope || isSource(n as Text)) into.push",
    "new": "if (true) into.push",
    "tests": "test/browser/snapshot.test.ts"
  },
  {
    "id": "L2-T6-M30",
    "guard": "snapshot: a source element shows only what the scope names on it",
    "file": "test/browser/page/snapshot.ts",
    "old": "head: namedHead(el, classes, namedAttrs(el, scope))",
    "new": "head: fullHead(el)",
    "tests": "test/browser/snapshot.test.ts"
  },
  {
    "id": "L2-T6-M31",
    "guard": "snapshot: an [attribute] entry never brings chrome in",
    "file": "test/browser/page/snapshot.ts",
    "old": "    if (inScope || (chrome && classes.length > 0)) {",
    "new": "    if (inScope || (chrome && (classes.length > 0 || namedAttrs(el, scope).length > 0))) {",
    "tests": "test/browser/snapshot.test.ts"
  },
  {
    "id": "L2-T6-M32",
    "guard": "snapshot: a class on chrome brings its whole subtree in",
    "file": "test/browser/page/snapshot.ts",
    "old": "      walkChildren(el, true, scope, isSource, children);",
    "new": "      walkChildren(el, false, scope, isSource, children);",
    "tests": "test/browser/snapshot.test.ts"
  },
  {
    "id": "L2-T6-M33",
    "guard": "snapshot: adjacent texts join",
    "file": "test/browser/page/snapshot.ts",
    "old": "      pending = (pending ?? '') + o.text;",
    "new": "      flush();\n      pending = o.text;",
    "tests": "test/browser/snapshot.test.ts"
  },
  {
    "id": "L2-T6-M34",
    "guard": "snapshot: texts are cut to 40 code points",
    "file": "test/browser/page/snapshot.ts",
    "old": "export const TEXT_CUT = 40;",
    "new": "export const TEXT_CUT = 400;",
    "tests": "test/browser/snapshot.test.ts"
  },
  {
    "id": "L2-T6-M35",
    "guard": "snapshot: an invalid scope entry is refused",
    "file": "test/browser/page/snapshot.ts",
    "old": "  if (bad.length > 0) throw new Error(`snapshot: invalid scope entries ${JSON.stringify(bad)}`);\n",
    "new": "",
    "tests": "test/browser/snapshot.test.ts"
  },
  {
    "id": "L2-T6-M36",
    "guard": "source texts: a tail split off a source text is source",
    "file": "test/browser/page/source.ts",
    "old": "      if (known.has(this)) known.add(tail);\n",
    "new": "",
    "tests": "test/browser/snapshot.test.ts"
  }
]
```

## The Level 2 runner and the core cases (L2-T6-M37 to L2-T6-M44)

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T6-M37 | Level 2: the expected file is written only with UPDATE_LAYOUT | `test/browser/layout-cases.ts` | `  if (update) {` → `  if (true) {` | `test/browser/layout-corpus.test.ts`: 1 failed \| 12 passed \| 8 skipped (21). "a case directory holds whole cases only, and the expected file is written only on request" |
| L2-T6-M38 | Level 2: an options file with an unknown key is refused | `test/browser/layout-cases.ts` | ``   if (unknown.length > 0) throw bad(`unknown keys ${JSON.stringify(unknown)}`); ⏎  `` → (deleted) | `test/browser/layout-corpus.test.ts`: 1 failed \| 12 passed \| 8 skipped (21). "an options file is checked: unknown keys, an empty or bad scope, and wrong types are refused" |
| L2-T6-M39 | Level 2: hostile is true or absent | `test/browser/layout-cases.ts` | `  if (hostile !== undefined && hostile !== true) throw bad('"hostile" is true or absent'); ⏎ ` → (deleted) | `test/browser/layout-corpus.test.ts`: 1 failed \| 12 passed \| 8 skipped (21). "an options file is checked: unknown keys, an empty or bad scope, and wrong types are refused" |
| L2-T6-M40 | Level 2: a moved snapshot fails the case (the runner holds it) | `test/browser/layout-cases.ts` | ``   if (verdict === 'differs') expect(actual, `${id}: the snapshot moved`).toBe(readFileSync(expected,… `` → (deleted) | `test/browser/layout-corpus.test.ts`: 1 failed \| 12 passed \| 8 skipped (21). "a case directory holds whole cases only, and the expected file is written only on request" |
| L2-T6-M41 | Level 2: an expected snapshot is held exactly | `conformance/layout/core/tables.dom.txt` | `div .stack.table-wrapper ⏎   table ⏎     thead ⏎       tr ⏎         th ⏎           "#"` → `div .stack.table-wrapper ⏎   table ⏎     thead ⏎       tr ⏎         th ⏎           "No."` | `test/browser/layout-corpus.test.ts`: 1 failed \| 12 passed \| 8 skipped (21). "core/tables" |
| L2-T6-M42 | Level 2 holds the layout: a table of three columns stacks | `src/enhance/status.ts` | `  journal.toggleClass(wrapper, 'stack', true); ⏎ ` → (deleted) | `test/browser/layout-corpus.test.ts`: 1 failed \| 12 passed \| 8 skipped (21). "core/tables" |
| L2-T6-M43 | Level 2 holds the layout: the eyebrow | `src/enhance/editorial.ts` | `    if (kinds.length > 0) {` → `    if (kinds.length > 99) {` | `test/browser/layout-corpus.test.ts`: 1 failed \| 12 passed \| 8 skipped (21). "core/editorial" |
| L2-T6-M44 | DOM clobbering: stored folds are looked up as a set, never by a property of an object | `src/enhance/folds.ts` | `    if (!want.has(s.id)) continue;` → `    if (!(s.id in Object.fromEntries([...want].map((x) => [x, 1])))) continue;` | `test/browser/layout-corpus.test.ts`: 2 failed \| 11 passed \| 8 skipped (21). "core/clobbering"; "DOM clobbering, core/clobbering: the ids renamed give the same snapshot, the page is clobbered, and no prototype gains a name" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T6-M37",
    "guard": "Level 2: the expected file is written only with UPDATE_LAYOUT",
    "file": "test/browser/layout-cases.ts",
    "old": "  if (update) {",
    "new": "  if (true) {",
    "tests": "test/browser/layout-corpus.test.ts"
  },
  {
    "id": "L2-T6-M38",
    "guard": "Level 2: an options file with an unknown key is refused",
    "file": "test/browser/layout-cases.ts",
    "old": "  if (unknown.length > 0) throw bad(`unknown keys ${JSON.stringify(unknown)}`);\n",
    "new": "",
    "tests": "test/browser/layout-corpus.test.ts"
  },
  {
    "id": "L2-T6-M39",
    "guard": "Level 2: hostile is true or absent",
    "file": "test/browser/layout-cases.ts",
    "old": "  if (hostile !== undefined && hostile !== true) throw bad('\"hostile\" is true or absent');\n",
    "new": "",
    "tests": "test/browser/layout-corpus.test.ts"
  },
  {
    "id": "L2-T6-M40",
    "guard": "Level 2: a moved snapshot fails the case (the runner holds it)",
    "file": "test/browser/layout-cases.ts",
    "old": "  if (verdict === 'differs') expect(actual, `${id}: the snapshot moved`).toBe(readFileSync(expected, 'utf8'));\n",
    "new": "",
    "tests": "test/browser/layout-corpus.test.ts"
  },
  {
    "id": "L2-T6-M41",
    "guard": "Level 2: an expected snapshot is held exactly",
    "file": "conformance/layout/core/tables.dom.txt",
    "old": "div .stack.table-wrapper\n  table\n    thead\n      tr\n        th\n          \"#\"",
    "new": "div .stack.table-wrapper\n  table\n    thead\n      tr\n        th\n          \"No.\"",
    "tests": "test/browser/layout-corpus.test.ts"
  },
  {
    "id": "L2-T6-M42",
    "guard": "Level 2 holds the layout: a table of three columns stacks",
    "file": "src/enhance/status.ts",
    "old": "  journal.toggleClass(wrapper, 'stack', true);\n",
    "new": "",
    "tests": "test/browser/layout-corpus.test.ts"
  },
  {
    "id": "L2-T6-M43",
    "guard": "Level 2 holds the layout: the eyebrow",
    "file": "src/enhance/editorial.ts",
    "old": "    if (kinds.length > 0) {",
    "new": "    if (kinds.length > 99) {",
    "tests": "test/browser/layout-corpus.test.ts"
  },
  {
    "id": "L2-T6-M44",
    "guard": "DOM clobbering: stored folds are looked up as a set, never by a property of an object",
    "file": "src/enhance/folds.ts",
    "old": "    if (!want.has(s.id)) continue;",
    "new": "    if (!(s.id in Object.fromEntries([...want].map((x) => [x, 1])))) continue;",
    "tests": "test/browser/layout-corpus.test.ts"
  }
]
```

## The visual comparison script (L2-T6-M45 to L2-T6-M53)

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T6-M45 | compare: the tolerance is 0.1 px | `scripts/visual/compare.mjs` | `export const TOLERANCE = 0.1;` → `export const TOLERANCE = 1;` | `test/visual-compare.test.ts`: 3 failed \| 11 passed (14). "lengths within 0.1 px are equal, and further apart are not"; "boxes are measured from the first block both pages hold, within 0.1 px"; "a block with no box (not laid out) has no gap, and the next gap is measured from the block before it" |
| L2-T6-M46 | compare: boxes are compared | `scripts/visual/compare.mjs` | `      if (!near(a, b)) out.push(` → `      if (false) out.push(` | `test/visual-compare.test.ts`: 4 failed \| 10 passed (14). "boxes are measured from the first block both pages hold, within 0.1 px"; "the gap from the block before that both pages hold is held to 0.1 px; a shift of the whole column is not a gap"; "a block with no box (not laid out) has no gap, and the next gap is measured from the block before it"; "a computed value that differs is named with both values; a block in one page only is "present"" |
| L2-T6-M47 | compare: computed values are compared | `scripts/visual/compare.mjs` | `      if (!sameValue(prop, o.style[prop], r.style[prop])) out.push(` → `      if (false) out.push(` | `test/visual-compare.test.ts`: 1 failed \| 13 passed (14). "a computed value that differs is named with both values; a block in one page only is "present"" |
| L2-T6-M48 | compare: a block in our page only is reported | `scripts/visual/compare.mjs` | `      out.push({ block: o.key, prop: 'present', ours: 'yes', reference: 'no' }); ⏎ ` → (deleted) | `test/visual-compare.test.ts`: 1 failed \| 13 passed (14). "a computed value that differs is named with both values; a block in one page only is "present"" |
| L2-T6-M49 | compare: x is measured from the column's origin | `scripts/visual/compare.mjs` | `  const ox = origin?.box.x ?? 0;` → `  const ox = 0;` | `test/visual-compare.test.ts`: 1 failed \| 13 passed (14). "boxes are measured from the first block both pages hold, within 0.1 px" |
| L2-T6-M50 | compare: font-family by its generic family | `scripts/visual/compare.mjs` | `  if (prop === 'fontFamily') return generic(a) === generic(b); ⏎ ` → (deleted) | `test/visual-compare.test.ts`: 1 failed \| 13 passed (14). "any other value is compared as text; font-family by its generic family" |
| L2-T6-M51 | compare: a difference no entry names is unexpected | `scripts/visual/compare.mjs` | `    if (hit === undefined) unexpected.push(d);` → `    if (true) unexpected.push(d);` | `test/visual-compare.test.ts`: 2 failed \| 12 passed (14). "an entry names the differences it matches, by block, prop and combo patterns; the rest are unexpected"; "an entry with no patterns matches everything; with none, every difference is unexpected" |
| L2-T6-M52 | compare: a repeated flag is a usage error | `scripts/visual/compare.mjs` | `seen.has(key)) throw new Error(USAGE);` → `false) throw new Error(USAGE);` | `test/visual-compare.test.ts`: 1 failed \| 13 passed (14). "refuses a missing page, an unknown or repeated flag, and a bad state name" |
| L2-T6-M53 | compare: an unexpected difference exits 1 | `scripts/visual/compare.mjs` | `  return unexpectedCount === 0 ? 0 : 1;` → `  return 0;` | `test/browser/visual-compare.test.ts`: 2 failed \| 8 passed (10). "a block 1 px wider exits 1 and is named; an expected entry that names it exits 0 and reports it by name"; "extra space between two blocks exits 1 as a gap difference" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T6-M45",
    "guard": "compare: the tolerance is 0.1 px",
    "file": "scripts/visual/compare.mjs",
    "old": "export const TOLERANCE = 0.1;",
    "new": "export const TOLERANCE = 1;",
    "tests": "test/visual-compare.test.ts"
  },
  {
    "id": "L2-T6-M46",
    "guard": "compare: boxes are compared",
    "file": "scripts/visual/compare.mjs",
    "old": "      if (!near(a, b)) out.push(",
    "new": "      if (false) out.push(",
    "tests": "test/visual-compare.test.ts"
  },
  {
    "id": "L2-T6-M47",
    "guard": "compare: computed values are compared",
    "file": "scripts/visual/compare.mjs",
    "old": "      if (!sameValue(prop, o.style[prop], r.style[prop])) out.push(",
    "new": "      if (false) out.push(",
    "tests": "test/visual-compare.test.ts"
  },
  {
    "id": "L2-T6-M48",
    "guard": "compare: a block in our page only is reported",
    "file": "scripts/visual/compare.mjs",
    "old": "      out.push({ block: o.key, prop: 'present', ours: 'yes', reference: 'no' });\n",
    "new": "",
    "tests": "test/visual-compare.test.ts"
  },
  {
    "id": "L2-T6-M49",
    "guard": "compare: x is measured from the column's origin",
    "file": "scripts/visual/compare.mjs",
    "old": "  const ox = origin?.box.x ?? 0;",
    "new": "  const ox = 0;",
    "tests": "test/visual-compare.test.ts"
  },
  {
    "id": "L2-T6-M50",
    "guard": "compare: font-family by its generic family",
    "file": "scripts/visual/compare.mjs",
    "old": "  if (prop === 'fontFamily') return generic(a) === generic(b);\n",
    "new": "",
    "tests": "test/visual-compare.test.ts"
  },
  {
    "id": "L2-T6-M51",
    "guard": "compare: a difference no entry names is unexpected",
    "file": "scripts/visual/compare.mjs",
    "old": "    if (hit === undefined) unexpected.push(d);",
    "new": "    if (true) unexpected.push(d);",
    "tests": "test/visual-compare.test.ts"
  },
  {
    "id": "L2-T6-M52",
    "guard": "compare: a repeated flag is a usage error",
    "file": "scripts/visual/compare.mjs",
    "old": "seen.has(key)) throw new Error(USAGE);",
    "new": "false) throw new Error(USAGE);",
    "tests": "test/visual-compare.test.ts"
  },
  {
    "id": "L2-T6-M53",
    "guard": "compare: an unexpected difference exits 1",
    "file": "scripts/visual/compare.mjs",
    "old": "  return unexpectedCount === 0 ? 0 : 1;",
    "new": "  return 0;",
    "tests": "test/browser/visual-compare.test.ts"
  }
]
```

## The review fixes: CI, the ratchet, the harness, the snapshot, the runner, the compare script and the demo (L2-T6-M54 to L2-T6-M93)

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T6-M54 | CI fails a run whose tests leave conformance/layout/ changed | `.github/workflows/ci.yml` | `      - name: the tests wrote no layout snapshot ⏎         run: test -z "$(git status --porcelain --…` → (deleted) | `test/ci-workflow.test.ts`: 2 failed \| 9 passed (11). "installs from the lock and the browsers, typechecks, tests, checks the tests wrote no layout snapshot, builds, runs the ratchet, then packs and smokes the tarball"; "the step after the tests fails when they leave conformance/layout/ changed" |
| L2-T6-M55 | CI never sets UPDATE_LAYOUT | `.github/workflows/ci.yml` | `      - run: ./node_modules/.bin/vitest run ⏎ ` → `      - run: UPDATE_LAYOUT=1 ./node_modules/.bin/vitest run ⏎ ` | `test/ci-workflow.test.ts`: 3 failed \| 8 passed (11). "installs from the lock and the browsers, typechecks, tests, checks the tests wrote no layout snapshot, builds, runs the ratchet, then packs and smokes the tarball"; "the step after the tests fails when they leave conformance/layout/ changed"; "never runs a bare npx vitest, never sets UPDATE_EXPECTED or UPDATE_LAYOUT, and never narrows the browsers" |
| L2-T6-M56 | CI never narrows the browsers | `.github/workflows/ci.yml` | `      - run: ./node_modules/.bin/vitest run ⏎ ` → `      - run: DOCREADER_BROWSERS=chromium ./node_modules/.bin/vitest run ⏎ ` | `test/ci-workflow.test.ts`: 3 failed \| 8 passed (11). "installs from the lock and the browsers, typechecks, tests, checks the tests wrote no layout snapshot, builds, runs the ratchet, then packs and smokes the tarball"; "the step after the tests fails when they leave conformance/layout/ changed"; "never runs a bare npx vitest, never sets UPDATE_EXPECTED or UPDATE_LAYOUT, and never narrows the browsers" |
| L2-T6-M57 | the README names the one install command | `README.md` | `` install them once with `npx playwright-core install --with-deps chromium webkit` `` → `` install them once with `npx playwright install chromium webkit` `` | `test/ci-workflow.test.ts`: 1 failed \| 10 passed (11). "installs the browsers with the one install command the harness, the compare script and the README name" |
| L2-T6-M58 | ratchet: renames are not followed in the layout diff (a renamed hostile case is a removal) | `scripts/ratchet.mjs` | `` git(['diff', '--name-status', '--no-renames', `${base}...HEAD`, '--', LAYOUT]) `` → `` git(['diff', '--name-status', `${base}...HEAD`, '--', LAYOUT]) `` | `test/ratchet.test.ts`: 1 failed \| 43 passed (44). "a hostile layout case moved to a new name is a removal: renames are not followed" |
| L2-T6-M59 | reader is default-src 'none' | `test/browser/harness.ts` | ``   reader: `default-src 'none'; script-src `` → ``   reader: `script-src `` | `test/browser/harness.test.ts`: 1 failed \| 14 passed \| 7 skipped (22). "reader: no eval or Function, no fetch, but inline styles" |
| L2-T6-M60 | reader has no 'unsafe-eval' | `test/browser/harness.ts` | ``   reader: `default-src 'none'; script-src ${ORIGIN}; style-src `` → ``   reader: `default-src 'none'; script-src ${ORIGIN} 'unsafe-eval'; style-src `` | `test/browser/harness.test.ts`: 1 failed \| 14 passed \| 7 skipped (22). "reader: no eval or Function, no fetch, but inline styles" |
| L2-T6-M61 | an unserved path on the page origin is counted as missing | `test/browser/harness.ts` | `        missing.push(url.pathname); ⏎ ` → (deleted) | `test/browser/harness.test.ts`: 1 failed \| 14 passed \| 7 skipped (22). "an unserved path on the page's origin is counted as missing; a favicon request never reaches the route" |
| L2-T6-M62 | each selected browser starts in its block's beforeAll hook | `test/browser/harness.ts` | `        beforeAll(async () => { ⏎           await browserFor(name); ⏎         }); ⏎ ` → (deleted) | `test/browser/harness.test.ts`: 1 failed \| 14 passed \| 7 skipped (22). "the browser was started in the block's hook, before its first test" |
| L2-T6-M63 | snapshot: a class on a source element brings in that element alone | `test/browser/page/snapshot.ts` | `    if (inScope \|\| (chrome && classes.length > 0)) {` → `    if (inScope \|\| classes.length > 0) {` | `test/browser/snapshot.test.ts`: 2 failed \| 12 passed (14). "a class on a source element brings in that element alone: chrome a later feature puts inside it moves nothing"; "a source element in scope shows only what the scope names: a later feature's label or mark on it moves nothing" |
| L2-T6-M64 | snapshot: tag[attribute] is narrowed to its tag | `test/browser/page/snapshot.ts` | `(a.tag === null \|\| a.tag === el.localName) && ` → (deleted) | `test/browser/snapshot.test.ts`: 1 failed \| 13 passed (14). "tag[name] brings in only a source element of that tag that carries the attribute" |
| L2-T6-M65 | snapshot: data-label is recorded in scope | `test/browser/page/snapshot.ts` | `n === 'hidden' \|\| n === 'data-label' \|\| n.startsWith` → `n === 'hidden' \|\| n.startsWith` | `test/browser/snapshot.test.ts`: 1 failed \| 13 passed (14). "a class on chrome brings its element and the whole subtree in: classes, the chrome mark, role, aria-*, hidden, data-docreader-*, data-label" |
| L2-T6-M66 | Level 2: the expected files are written only when UPDATE_LAYOUT is exactly "1" | `test/browser/layout-cases.ts` | `  return env['UPDATE_LAYOUT'] === '1';` → `  return env['UPDATE_LAYOUT'] !== undefined;` | `test/browser/layout-corpus.test.ts`: 1 failed \| 12 passed \| 8 skipped (21). "the expected files are written only when UPDATE_LAYOUT is exactly "1", and this run reads it so" |
| L2-T6-M67 | Level 2: the runner reads UPDATE_LAYOUT through updateRequested | `test/browser/layout-corpus.test.ts` | `const UPDATE = updateRequested(process.env);` → `const UPDATE = process.env['UPDATE_LAYOUT'] !== '1';` | `test/browser/layout-corpus.test.ts`: 1 failed \| 12 passed \| 8 skipped (21). "the expected files are written only when UPDATE_LAYOUT is exactly "1", and this run reads it so" |
| L2-T6-M68 | Level 2: an update run writes each case once and holds every later browser to it | `test/browser/layout-cases.ts` | `    holdSnapshot(id, actual, expected, update && first);` → `    holdSnapshot(id, actual, expected, update);` | `test/browser/layout-corpus.test.ts`: 1 failed \| 12 passed \| 8 skipped (21). "a case directory holds whole cases only, and the expected file is written only on request" |
| L2-T6-M69 | Level 2: holdClean fails a page that was refused, reached another origin or missed a file | `test/browser/layout-cases.ts` | `  ).toEqual({ violations: [], aborted: [], missing: [] });` → `  ).toBeDefined();` | `test/browser/layout-corpus.test.ts`: 2 failed \| 11 passed \| 8 skipped (21). "a case page that was refused something, reached another origin or asked for an unserved file fails"; "a case whose page is refused something fails, whatever its snapshot" |
| L2-T6-M70 | Level 2: every case runs holdClean | `test/browser/layout-corpus.test.ts` | `    holdClean(c.id, { violations: await doc.violations(), aborted: doc.aborted, missing: doc.missing…` → (deleted) | `test/browser/layout-corpus.test.ts`: 1 failed \| 12 passed \| 8 skipped (21). "a case whose page is refused something fails, whatever its snapshot" |
| L2-T6-M71 | Level 2: the scope is checked | `test/browser/layout-cases.ts` | ` \|\| !scope.every((s) => typeof s === 'string' && SCOPE_ENTRY.test(s))` → (deleted) | `test/browser/layout-corpus.test.ts`: 1 failed \| 12 passed \| 8 skipped (21). "an options file is checked: unknown keys, an empty or bad scope, and wrong types are refused" |
| L2-T6-M72 | Level 2: the viewport is checked | `test/browser/layout-cases.ts` | `    throw bad('"viewport" must be { width, height } in whole pixels');` → `    void 0;` | `test/browser/layout-corpus.test.ts`: 1 failed \| 12 passed \| 8 skipped (21). "an options file is checked: unknown keys, an empty or bad scope, and wrong types are refused" |
| L2-T6-M73 | Level 2: the policy name is checked | `test/browser/layout-cases.ts` | `  if (csp !== undefined && csp !== 'strict' && csp !== 'reader') throw bad('"csp" is "strict" or "re…` → (deleted) | `test/browser/layout-corpus.test.ts`: 1 failed \| 12 passed \| 8 skipped (21). "an options file is checked: unknown keys, an empty or bad scope, and wrong types are refused" |
| L2-T6-M74 | Level 2: a file that belongs to no case is refused | `test/browser/layout-cases.ts` | `if (m === null \|\| !ids.includes(m[1] ?? '')) throw` → `if (m === null) throw` | `test/browser/layout-corpus.test.ts`: 1 failed \| 12 passed \| 8 skipped (21). "a case directory holds whole cases only, and the expected file is written only on request" |
| L2-T6-M75 | Level 2: a case with no options file is refused by name | `test/browser/layout-cases.ts` | ``       if (!existsSync(optionsFile)) throw new Error(`layout case ${id}: no ${name}.options.json`); ⏎… `` → (deleted) | `test/browser/layout-corpus.test.ts`: 1 failed \| 12 passed \| 8 skipped (21). "a case directory holds whole cases only, and the expected file is written only on request" |
| L2-T6-M76 | compare: a block in the reference only is reported | `scripts/visual/compare.mjs` | `  for (const r of reference) if (!mine.has(r.key)) out.push({ block: r.key, prop: 'present', ours: '…` → (deleted) | `test/visual-compare.test.ts`: 2 failed \| 12 passed (14). "the gap from the block before that both pages hold is held to 0.1 px; a shift of the whole column is not a gap"; "a computed value that differs is named with both values; a block in one page only is "present"" |
| L2-T6-M77 | compare: the gap from the block before is compared | `scripts/visual/compare.mjs` | `    if (placed && before !== undefined) boxes.push(['box.gap', o.box.y - before[0].box.y, r.box.y - …` → (deleted) | `test/visual-compare.test.ts`: 2 failed \| 12 passed (14). "the gap from the block before that both pages hold is held to 0.1 px; a shift of the whole column is not a gap"; "a block with no box (not laid out) has no gap, and the next gap is measured from the block before it" |
| L2-T6-M78 | compare: a block with no box has no gap and is not a block before | `scripts/visual/compare.mjs` | `    const placed = laidOut(o) && laidOut(r);` → `    const placed = true;` | `test/visual-compare.test.ts`: 1 failed \| 13 passed (14). "a block with no box (not laid out) has no gap, and the next gap is measured from the block before it" |
| L2-T6-M79 | compare: the expected file is a list | `scripts/visual/compare.mjs` | `  if (!Array.isArray(list)) throw new Error('compare: the expected file is a JSON list'); ⏎ ` → (deleted) | `test/visual-compare.test.ts`: 1 failed \| 13 passed (14). "an expected file is a list of named entries with lists of patterns, and nothing else" |
| L2-T6-M80 | compare: an expected entry is an object | `scripts/visual/compare.mjs` | ``     if (typeof e !== 'object' \|\| e === null \|\| Array.isArray(e)) throw new Error(`${where} is not an… `` → (deleted) | `test/visual-compare.test.ts`: 1 failed \| 13 passed (14). "an expected file is a list of named entries with lists of patterns, and nothing else" |
| L2-T6-M81 | compare: an expected entry has no unknown keys | `scripts/visual/compare.mjs` | ``     if (unknown.length > 0) throw new Error(`${where} has unknown keys ${JSON.stringify(unknown)}`);… `` → (deleted) | `test/visual-compare.test.ts`: 1 failed \| 13 passed (14). "an expected file is a list of named entries with lists of patterns, and nothing else" |
| L2-T6-M82 | compare: an expected entry has a name | `scripts/visual/compare.mjs` | ``     if (typeof e.name !== 'string' \|\| e.name === '') throw new Error(`${where} needs a name`); ⏎  `` → (deleted) | `test/visual-compare.test.ts`: 1 failed \| 13 passed (14). "an expected file is a list of named entries with lists of patterns, and nothing else" |
| L2-T6-M83 | compare: an expected entry's patterns are non-empty lists | `scripts/visual/compare.mjs` | `e[k] !== undefined && !(Array.isArray(e[k]) && e[k].length > 0 && ` → `e[k] !== undefined && !(Array.isArray(e[k]) && ` | `test/visual-compare.test.ts`: 1 failed \| 13 passed (14). "an expected file is a list of named entries with lists of patterns, and nothing else" |
| L2-T6-M84 | compare: --offline is given at most once | `scripts/visual/compare.mjs` | `      if (out.offline) throw new Error(USAGE); ⏎ ` → (deleted) | `test/visual-compare.test.ts`: 1 failed \| 13 passed (14). "refuses a missing page, an unknown or repeated flag, and a bad state name" |
| L2-T6-M85 | compare: --offline resolves no host in Chromium | `scripts/visual/compare.mjs` | `export const OFFLINE_ARGS = Object.freeze(['--host-resolver-rules=MAP * ~NOTFOUND']);` → `export const OFFLINE_ARGS = Object.freeze([]);` | `test/visual-compare.test.ts`: 1 failed \| 13 passed (14). "--offline maps every host name and address to "not found" in Chromium" |
| L2-T6-M86 | compare: --offline refuses and reports every request that is not for a file | `scripts/visual/compare.mjs` | `                refused.push(url); ⏎                 return route.abort('blockedbyclient');` → `                return route.fallback();` | `test/browser/visual-compare.test.ts`: 1 failed \| 9 passed (10). "--offline refuses and reports every request that is not for a file" |
| L2-T6-M87 | compare: a browser that cannot start names the install command | `scripts/visual/compare.mjs` | ``     throw new Error(`chromium could not start (${first}). Install the pinned browsers with: ${INSTAL… `` → `    throw e;` | `test/browser/visual-compare.test.ts`: 1 failed \| 9 passed (10). "a browser that cannot start exits 3 and names the install command" |
| L2-T6-M88 | compare: a crash exits 3, never 1 | `scripts/visual/compare.mjs` | ``     console.error(`compare: nothing was compared: ${e instanceof Error ? e.message.split('\n')[0] : … `` → ``     console.error(`compare: nothing was compared: ${e instanceof Error ? e.message.split('\n')[0] : … `` | `test/browser/visual-compare.test.ts`: 2 failed \| 8 passed (10). "a browser that cannot start exits 3 and names the install command"; "a page that does not open exits 3, never the exit status of a difference" |
| L2-T6-M89 | compare: pages that share no block exit 3 | `scripts/visual/compare.mjs` | `        if (both === 0) {` → `        if (false) {` | `test/browser/visual-compare.test.ts`: 1 failed \| 9 passed (10). "pages that share no measured block exit 3: nothing was compared" |
| L2-T6-M90 | compare: an unreadable --expected file is a usage error | `scripts/visual/compare.mjs` | ``     console.error(`compare: ${e instanceof Error ? e.message.replace(/^compare: /, '') : String(e)}`… `` → `    throw e;` | `test/browser/visual-compare.test.ts`: 1 failed \| 9 passed (10). "a usage error exits 2; a named state with no setup module, and an unreadable expected file, are refused" |
| L2-T6-M91 | demo: --sample and --out each take a value, once | `scripts/demo/build.mjs` | `if (key === undefined \|\| value === undefined \|\| value === '' \|\| Object.hasOwn(given, key)) {` → `if (key === undefined) {` | `test/browser/visual-compare.test.ts`: 1 failed \| 9 passed (10). "the demo build reads --sample and --out, each once, and refuses anything else" |
| L2-T6-M92 | demo: --out names a directory that does not exist yet | `scripts/demo/build.mjs` | `if (given.out !== undefined && existsSync(out)) {` → `if (false) {` | `test/browser/visual-compare.test.ts`: 1 failed \| 9 passed (10). "the demo build reads --sample and --out, each once, and refuses anything else" |
| L2-T6-M93 | demo: the page marks itself ready once the layout is built | `scripts/demo/build.mjs` | `  document.documentElement.dataset.ready = 'true'; ⏎ ` → (deleted) | `test/browser/visual-compare.test.ts`: 1 failed \| 9 passed (10). "the demo page of a sample marks itself ready, and the script compares it" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T6-M54",
    "guard": "CI fails a run whose tests leave conformance/layout/ changed",
    "file": ".github/workflows/ci.yml",
    "old": "      - name: the tests wrote no layout snapshot\n        run: test -z \"$(git status --porcelain -- conformance/layout)\"\n",
    "new": "",
    "tests": "test/ci-workflow.test.ts"
  },
  {
    "id": "L2-T6-M55",
    "guard": "CI never sets UPDATE_LAYOUT",
    "file": ".github/workflows/ci.yml",
    "old": "      - run: ./node_modules/.bin/vitest run\n",
    "new": "      - run: UPDATE_LAYOUT=1 ./node_modules/.bin/vitest run\n",
    "tests": "test/ci-workflow.test.ts"
  },
  {
    "id": "L2-T6-M56",
    "guard": "CI never narrows the browsers",
    "file": ".github/workflows/ci.yml",
    "old": "      - run: ./node_modules/.bin/vitest run\n",
    "new": "      - run: DOCREADER_BROWSERS=chromium ./node_modules/.bin/vitest run\n",
    "tests": "test/ci-workflow.test.ts"
  },
  {
    "id": "L2-T6-M57",
    "guard": "the README names the one install command",
    "file": "README.md",
    "old": "install them once with `npx playwright-core install --with-deps chromium webkit`",
    "new": "install them once with `npx playwright install chromium webkit`",
    "tests": "test/ci-workflow.test.ts"
  },
  {
    "id": "L2-T6-M58",
    "guard": "ratchet: renames are not followed in the layout diff (a renamed hostile case is a removal)",
    "file": "scripts/ratchet.mjs",
    "old": "git(['diff', '--name-status', '--no-renames', `${base}...HEAD`, '--', LAYOUT])",
    "new": "git(['diff', '--name-status', `${base}...HEAD`, '--', LAYOUT])",
    "tests": "test/ratchet.test.ts"
  },
  {
    "id": "L2-T6-M59",
    "guard": "reader is default-src 'none'",
    "file": "test/browser/harness.ts",
    "old": "  reader: `default-src 'none'; script-src",
    "new": "  reader: `script-src",
    "tests": "test/browser/harness.test.ts"
  },
  {
    "id": "L2-T6-M60",
    "guard": "reader has no 'unsafe-eval'",
    "file": "test/browser/harness.ts",
    "old": "  reader: `default-src 'none'; script-src ${ORIGIN}; style-src",
    "new": "  reader: `default-src 'none'; script-src ${ORIGIN} 'unsafe-eval'; style-src",
    "tests": "test/browser/harness.test.ts"
  },
  {
    "id": "L2-T6-M61",
    "guard": "an unserved path on the page origin is counted as missing",
    "file": "test/browser/harness.ts",
    "old": "        missing.push(url.pathname);\n",
    "new": "",
    "tests": "test/browser/harness.test.ts"
  },
  {
    "id": "L2-T6-M62",
    "guard": "each selected browser starts in its block's beforeAll hook",
    "file": "test/browser/harness.ts",
    "old": "        beforeAll(async () => {\n          await browserFor(name);\n        });\n",
    "new": "",
    "tests": "test/browser/harness.test.ts"
  },
  {
    "id": "L2-T6-M63",
    "guard": "snapshot: a class on a source element brings in that element alone",
    "file": "test/browser/page/snapshot.ts",
    "old": "    if (inScope || (chrome && classes.length > 0)) {",
    "new": "    if (inScope || classes.length > 0) {",
    "tests": "test/browser/snapshot.test.ts"
  },
  {
    "id": "L2-T6-M64",
    "guard": "snapshot: tag[attribute] is narrowed to its tag",
    "file": "test/browser/page/snapshot.ts",
    "old": "(a.tag === null || a.tag === el.localName) && ",
    "new": "",
    "tests": "test/browser/snapshot.test.ts"
  },
  {
    "id": "L2-T6-M65",
    "guard": "snapshot: data-label is recorded in scope",
    "file": "test/browser/page/snapshot.ts",
    "old": "n === 'hidden' || n === 'data-label' || n.startsWith",
    "new": "n === 'hidden' || n.startsWith",
    "tests": "test/browser/snapshot.test.ts"
  },
  {
    "id": "L2-T6-M66",
    "guard": "Level 2: the expected files are written only when UPDATE_LAYOUT is exactly \"1\"",
    "file": "test/browser/layout-cases.ts",
    "old": "  return env['UPDATE_LAYOUT'] === '1';",
    "new": "  return env['UPDATE_LAYOUT'] !== undefined;",
    "tests": "test/browser/layout-corpus.test.ts"
  },
  {
    "id": "L2-T6-M67",
    "guard": "Level 2: the runner reads UPDATE_LAYOUT through updateRequested",
    "file": "test/browser/layout-corpus.test.ts",
    "old": "const UPDATE = updateRequested(process.env);",
    "new": "const UPDATE = process.env['UPDATE_LAYOUT'] !== '1';",
    "tests": "test/browser/layout-corpus.test.ts"
  },
  {
    "id": "L2-T6-M68",
    "guard": "Level 2: an update run writes each case once and holds every later browser to it",
    "file": "test/browser/layout-cases.ts",
    "old": "    holdSnapshot(id, actual, expected, update && first);",
    "new": "    holdSnapshot(id, actual, expected, update);",
    "tests": "test/browser/layout-corpus.test.ts"
  },
  {
    "id": "L2-T6-M69",
    "guard": "Level 2: holdClean fails a page that was refused, reached another origin or missed a file",
    "file": "test/browser/layout-cases.ts",
    "old": "  ).toEqual({ violations: [], aborted: [], missing: [] });",
    "new": "  ).toBeDefined();",
    "tests": "test/browser/layout-corpus.test.ts"
  },
  {
    "id": "L2-T6-M70",
    "guard": "Level 2: every case runs holdClean",
    "file": "test/browser/layout-corpus.test.ts",
    "old": "    holdClean(c.id, { violations: await doc.violations(), aborted: doc.aborted, missing: doc.missing });\n",
    "new": "",
    "tests": "test/browser/layout-corpus.test.ts"
  },
  {
    "id": "L2-T6-M71",
    "guard": "Level 2: the scope is checked",
    "file": "test/browser/layout-cases.ts",
    "old": " || !scope.every((s) => typeof s === 'string' && SCOPE_ENTRY.test(s))",
    "new": "",
    "tests": "test/browser/layout-corpus.test.ts"
  },
  {
    "id": "L2-T6-M72",
    "guard": "Level 2: the viewport is checked",
    "file": "test/browser/layout-cases.ts",
    "old": "    throw bad('\"viewport\" must be { width, height } in whole pixels');",
    "new": "    void 0;",
    "tests": "test/browser/layout-corpus.test.ts"
  },
  {
    "id": "L2-T6-M73",
    "guard": "Level 2: the policy name is checked",
    "file": "test/browser/layout-cases.ts",
    "old": "  if (csp !== undefined && csp !== 'strict' && csp !== 'reader') throw bad('\"csp\" is \"strict\" or \"reader\"');\n",
    "new": "",
    "tests": "test/browser/layout-corpus.test.ts"
  },
  {
    "id": "L2-T6-M74",
    "guard": "Level 2: a file that belongs to no case is refused",
    "file": "test/browser/layout-cases.ts",
    "old": "if (m === null || !ids.includes(m[1] ?? '')) throw",
    "new": "if (m === null) throw",
    "tests": "test/browser/layout-corpus.test.ts"
  },
  {
    "id": "L2-T6-M75",
    "guard": "Level 2: a case with no options file is refused by name",
    "file": "test/browser/layout-cases.ts",
    "old": "      if (!existsSync(optionsFile)) throw new Error(`layout case ${id}: no ${name}.options.json`);\n",
    "new": "",
    "tests": "test/browser/layout-corpus.test.ts"
  },
  {
    "id": "L2-T6-M76",
    "guard": "compare: a block in the reference only is reported",
    "file": "scripts/visual/compare.mjs",
    "old": "  for (const r of reference) if (!mine.has(r.key)) out.push({ block: r.key, prop: 'present', ours: 'no', reference: 'yes' });\n",
    "new": "",
    "tests": "test/visual-compare.test.ts"
  },
  {
    "id": "L2-T6-M77",
    "guard": "compare: the gap from the block before is compared",
    "file": "scripts/visual/compare.mjs",
    "old": "    if (placed && before !== undefined) boxes.push(['box.gap', o.box.y - before[0].box.y, r.box.y - before[1].box.y]);\n",
    "new": "",
    "tests": "test/visual-compare.test.ts"
  },
  {
    "id": "L2-T6-M78",
    "guard": "compare: a block with no box has no gap and is not a block before",
    "file": "scripts/visual/compare.mjs",
    "old": "    const placed = laidOut(o) && laidOut(r);",
    "new": "    const placed = true;",
    "tests": "test/visual-compare.test.ts"
  },
  {
    "id": "L2-T6-M79",
    "guard": "compare: the expected file is a list",
    "file": "scripts/visual/compare.mjs",
    "old": "  if (!Array.isArray(list)) throw new Error('compare: the expected file is a JSON list');\n",
    "new": "",
    "tests": "test/visual-compare.test.ts"
  },
  {
    "id": "L2-T6-M80",
    "guard": "compare: an expected entry is an object",
    "file": "scripts/visual/compare.mjs",
    "old": "    if (typeof e !== 'object' || e === null || Array.isArray(e)) throw new Error(`${where} is not an object`);\n",
    "new": "",
    "tests": "test/visual-compare.test.ts"
  },
  {
    "id": "L2-T6-M81",
    "guard": "compare: an expected entry has no unknown keys",
    "file": "scripts/visual/compare.mjs",
    "old": "    if (unknown.length > 0) throw new Error(`${where} has unknown keys ${JSON.stringify(unknown)}`);\n",
    "new": "",
    "tests": "test/visual-compare.test.ts"
  },
  {
    "id": "L2-T6-M82",
    "guard": "compare: an expected entry has a name",
    "file": "scripts/visual/compare.mjs",
    "old": "    if (typeof e.name !== 'string' || e.name === '') throw new Error(`${where} needs a name`);\n",
    "new": "",
    "tests": "test/visual-compare.test.ts"
  },
  {
    "id": "L2-T6-M83",
    "guard": "compare: an expected entry's patterns are non-empty lists",
    "file": "scripts/visual/compare.mjs",
    "old": "e[k] !== undefined && !(Array.isArray(e[k]) && e[k].length > 0 && ",
    "new": "e[k] !== undefined && !(Array.isArray(e[k]) && ",
    "tests": "test/visual-compare.test.ts"
  },
  {
    "id": "L2-T6-M84",
    "guard": "compare: --offline is given at most once",
    "file": "scripts/visual/compare.mjs",
    "old": "      if (out.offline) throw new Error(USAGE);\n",
    "new": "",
    "tests": "test/visual-compare.test.ts"
  },
  {
    "id": "L2-T6-M85",
    "guard": "compare: --offline resolves no host in Chromium",
    "file": "scripts/visual/compare.mjs",
    "old": "export const OFFLINE_ARGS = Object.freeze(['--host-resolver-rules=MAP * ~NOTFOUND']);",
    "new": "export const OFFLINE_ARGS = Object.freeze([]);",
    "tests": "test/visual-compare.test.ts"
  },
  {
    "id": "L2-T6-M86",
    "guard": "compare: --offline refuses and reports every request that is not for a file",
    "file": "scripts/visual/compare.mjs",
    "old": "                refused.push(url);\n                return route.abort('blockedbyclient');",
    "new": "                return route.fallback();",
    "tests": "test/browser/visual-compare.test.ts"
  },
  {
    "id": "L2-T6-M87",
    "guard": "compare: a browser that cannot start names the install command",
    "file": "scripts/visual/compare.mjs",
    "old": "    throw new Error(`chromium could not start (${first}). Install the pinned browsers with: ${INSTALL}`);",
    "new": "    throw e;",
    "tests": "test/browser/visual-compare.test.ts"
  },
  {
    "id": "L2-T6-M88",
    "guard": "compare: a crash exits 3, never 1",
    "file": "scripts/visual/compare.mjs",
    "old": "    console.error(`compare: nothing was compared: ${e instanceof Error ? e.message.split('\\n')[0] : String(e)}`);\n    return 3;",
    "new": "    console.error(`compare: nothing was compared: ${e instanceof Error ? e.message.split('\\n')[0] : String(e)}`);\n    return 1;",
    "tests": "test/browser/visual-compare.test.ts"
  },
  {
    "id": "L2-T6-M89",
    "guard": "compare: pages that share no block exit 3",
    "file": "scripts/visual/compare.mjs",
    "old": "        if (both === 0) {",
    "new": "        if (false) {",
    "tests": "test/browser/visual-compare.test.ts"
  },
  {
    "id": "L2-T6-M90",
    "guard": "compare: an unreadable --expected file is a usage error",
    "file": "scripts/visual/compare.mjs",
    "old": "    console.error(`compare: ${e instanceof Error ? e.message.replace(/^compare: /, '') : String(e)}`);\n    return 2;",
    "new": "    throw e;",
    "tests": "test/browser/visual-compare.test.ts"
  },
  {
    "id": "L2-T6-M91",
    "guard": "demo: --sample and --out each take a value, once",
    "file": "scripts/demo/build.mjs",
    "old": "if (key === undefined || value === undefined || value === '' || Object.hasOwn(given, key)) {",
    "new": "if (key === undefined) {",
    "tests": "test/browser/visual-compare.test.ts"
  },
  {
    "id": "L2-T6-M92",
    "guard": "demo: --out names a directory that does not exist yet",
    "file": "scripts/demo/build.mjs",
    "old": "if (given.out !== undefined && existsSync(out)) {",
    "new": "if (false) {",
    "tests": "test/browser/visual-compare.test.ts"
  },
  {
    "id": "L2-T6-M93",
    "guard": "demo: the page marks itself ready once the layout is built",
    "file": "scripts/demo/build.mjs",
    "old": "  document.documentElement.dataset.ready = 'true';\n",
    "new": "",
    "tests": "test/browser/visual-compare.test.ts"
  }
]
```
## Visual check

On the core sample (`scripts/demo/samples/core.md`), `scripts/visual/compare.mjs` compared the demo page with a
temporary copy of the reference layout serving the same sample, at 1440×1000 and 390×844, in light, dark and sans
with wide. In each of the six combinations, 46 blocks are in both pages and there are 0 unexpected differences.
Of each block's box, x (from the column's origin), width and height are equal to 0.1 px everywhere, and so is the
gap from the block before, except the one gap named below. The expected differences, each named, are parts not
yet built or a ruled design:

| Name | Blocks | Values | Where |
|---|---|---|---|
| Hidden, not removed (C43): the front-matter strip and the meta line stay in the document, hidden, where the reference drops them | the strip, the meta line | present in ours only | all six |
| Review strip not built (Task 20): the reference puts its review strip between the byline and the first section | the first section's heading | the gap from the byline (195.33 vs 380.14 px on desktop in light) | all six |
| Contents rail not built (Task 18): the reference sets its column beside the rail, so its auto margins resolve differently; every box is equal | every block | margin-left, margin-right | desktop |
| Code block tools not built (Task 10): the reference's code block takes max-width 100% on a phone; the box is equal | the code block | max-width | phone |
| Attention marks not built (Task 19): the reference tints the table row that waits on the reader | one table row | background-color | phone |

The screenshots also show what no block measures, all of it chrome the prototype does not build yet: the bar, the
contents rail, the review strip, the Copy button, and the ID colours and links.
