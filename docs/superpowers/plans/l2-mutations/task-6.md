# L2 Task 6: mutation rows (real-browser harness, Level 2 runner, visual compare)

Each guard Task 6 adds, deleted or inverted once, with the tests that go red. Measured 2026-10-20 on branch
`l2-t6-browser`, against the tree its last code commit records.

**Method.** The L1 plan's `mutate.mjs` (Task 1, Step 8) with the two changes its results section records (a
512 MiB output buffer, and a run that ends with no exit status reported as KILLED and counted as no verdict):
each row is applied to its own throwaway copy of the working tree (tracked and untracked files, never ignored
ones, `node_modules` linked from the checkout), its test file runs there with the local `vitest`, and the copy
is deleted. Each `old` occurs exactly once in its file. The rows ran with `DOCREADER_BROWSERS=chromium`: the
measuring machine's WebKit cannot start (its system libraries are not installed there), so every browser row ran
in Chromium and WebKit was reported as excluded. The checkout was never edited: `git status --porcelain` read the
same (empty) before and after. All 53 rows went red (`rc=1`).

Notes on the measurement. Two runs were killed by the machine's memory limit (rc 137, a shared cap that other
work had filled), never by a row: each was run again, alone, and went red. Two rows stayed green on their first
run and were made red by changing the code, not by dropping them: L2-T6-M31 (the snapshot's attribute test
excluded chrome a second time, after chrome outside the scope had already been made transparent, so the check was
unreachable: it was removed, and the row now widens the transparency test instead) and L2-T6-M40 (the runner only
compares when a snapshot differs, and every expected file was equal: the comparison is now `holdSnapshot()`, with
cases of its own for a moved snapshot and a missing file). L2-T6-M18 (WebKit's proxy) is red through the static
case that pins each browser's launch options; a WebKit page was not run on the measuring machine.

## Configuration, CI and the public-ready walk (L2-T6-M1 to L2-T6-M7)

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T6-M1 | the unit project leaves the layout tests out | `vitest.config.ts` | `exclude: [BROWSER, PACK, LAYOUT]` → `exclude: [BROWSER, PACK]` | `test/vitest-config.test.ts`: 1 failed \| 2 passed (3). "runs every other test file first, then the browser bundle alone, then the packed tarball alone, then the layout tests" |
| L2-T6-M2 | the layout project runs last | `vitest.config.ts` | `hookTimeout: 60_000, sequence: { groupOrder: 3 }` → `hookTimeout: 60_000, sequence: { groupOrder: 1 }` | `test/vitest-config.test.ts`: 2 failed \| 1 passed (3). "runs every other test file first, then the browser bundle alone, then the packed tarball alone, then the layout tests"; "the layout project, last, waits up to 60 s in a hook (launching a browser); the others keep the default" |
| L2-T6-M3 | the layout project waits 60 s in a hook | `vitest.config.ts` | `hookTimeout: 60_000, sequence` → `sequence` | `test/vitest-config.test.ts`: 1 failed \| 2 passed (3). "the layout project, last, waits up to 60 s in a hook (launching a browser); the others keep the default" |
| L2-T6-M4 | CI installs the browsers before the tests | `.github/workflows/ci.yml` | `      - run: npx playwright-core install --with-deps chromium webkit ⏎ ` → (deleted) | `test/ci-workflow.test.ts`: 1 failed \| 8 passed (9). "installs from the lock and the browsers, typechecks, tests, builds, runs the ratchet, then packs and smokes the tarball" |
| L2-T6-M5 | the public-ready walk skips visual-out/ at the root | `test/public-ready.test.ts` | `  'visual-out': 'the screenshots and reports scripts/visual/compare.mjs writes (a measured page may name anyth…` → (deleted) | `test/public-ready.test.ts`: 2 failed \| 7 passed \| 1 skipped (10). "skips a root .git file, a root .git directory and each named root scratch directory"; "each root directory a script of this repository writes is git-ignored, so it never reaches a commit" |
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
| L2-T6-M8 | ratchet: a moved layout snapshot needs a Layout-moved trailer | `scripts/ratchet.mjs` | `    if (!named.has(id)) out.push(`${id}: its layout snapshot changed, and no Layout-moved trailer names it`); …` → (deleted) | `test/ratchet.test.ts`: 2 failed \| 41 passed (43). "the trailers name exactly the moved cases"; "a moved layout snapshot needs a Layout-moved trailer naming exactly its case; a new case needs none" |
| L2-T6-M9 | ratchet: a Layout-moved trailer names only moved cases | `scripts/ratchet.mjs` | `    if (!moved.has(id)) out.push(`${id}: a Layout-moved trailer names it, and its layout snapshot did not chan…` → (deleted) | `test/ratchet.test.ts`: 2 failed \| 41 passed (43). "the trailers name exactly the moved cases"; "a moved layout snapshot needs a Layout-moved trailer naming exactly its case; a new case needs none" |
| L2-T6-M10 | ratchet: an added case is not a move | `scripts/ratchet.mjs` | `c.kind === 'dom.txt' && c.status !== 'A'` → `c.kind === 'dom.txt'` | `test/ratchet.test.ts`: 2 failed \| 41 passed (43). "a modified, retyped or deleted snapshot is a move; an added one is a new case"; "a moved layout snapshot needs a Layout-moved trailer naming exactly its case; a new case needs none" |
| L2-T6-M11 | ratchet: a hostile layout case is never removed | `scripts/ratchet.mjs` | `    if (mine.some((c) => c.status === 'D')) out.push(`${id}: a hostile layout case was removed (a hostile case…` → `    if` | `test/ratchet.test.ts`: 2 failed \| 41 passed (43). "a hostile case is never removed and its input and options never change; its snapshot may move"; "a hostile layout case is never removed or edited; its snapshot moves with a trailer; another case may change" |
| L2-T6-M12 | ratchet: a hostile layout case's input and options never change | `scripts/ratchet.mjs` | `    else if (mine.some((c) => c.kind !== 'dom.txt')) out.push(`${id}: a hostile layout case's input or options…` → (deleted) | `test/ratchet.test.ts`: 2 failed \| 41 passed (43). "a hostile case is never removed and its input and options never change; its snapshot may move"; "a hostile layout case is never removed or edited; its snapshot moves with a trailer; another case may change" |
| L2-T6-M13 | ratchet: only a case the base marks hostile is held | `scripts/ratchet.mjs` | `    if (JSON.parse(f.text).hostile === true) ids.push(m[1]);` → `    ids.push(m[1]);` | `test/ratchet.test.ts`: 3 failed \| 40 passed (43). "the hostile cases are those whose options file says hostile: true"; "a moved layout snapshot needs a Layout-moved trailer naming exactly its case; a new case needs none"; "a hostile layout case is never removed or edited; its snapshot moves with a trailer; another case may change" |
| L2-T6-M14 | ratchet: the command runs the layout-move check | `scripts/ratchet.mjs` | `    ...checkLayoutMoves(moved, layoutNamed), ⏎ ` → (deleted) | `test/ratchet.test.ts`: 1 failed \| 42 passed (43). "a moved layout snapshot needs a Layout-moved trailer naming exactly its case; a new case needs none" |
| L2-T6-M15 | ratchet: the command runs the hostile layout check | `scripts/ratchet.mjs` | `    ...checkLayoutHostile(hostileLayout, layout), ⏎ ` → (deleted) | `test/ratchet.test.ts`: 1 failed \| 42 passed (43). "a hostile layout case is never removed or edited; its snapshot moves with a trailer; another case may change" |

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
| L2-T6-M16 | a routed request to another origin is aborted and counted | `test/browser/harness.ts` | `    aborted.push(url.href); ⏎     await route.abort('blockedbyclient');` → `    await route.fallback();` | `test/browser/harness.test.ts`: 1 failed \| 12 passed \| 5 skipped (18). "a routed request to another origin is aborted and counted" |
| L2-T6-M17 | Chromium resolves no host name | `test/browser/harness.ts` | `{ args: ['--host-resolver-rules=MAP * ~NOTFOUND'] }` → `{ args: [] }` | `test/browser/harness.test.ts`: 2 failed \| 11 passed \| 5 skipped (18). "each browser is kept off the network: Chromium resolves no name, WebKit proxies to a closed loopback port"; "a request let past the route fails: the browser itself reaches no host" |
| L2-T6-M18 | WebKit sends every request to a closed proxy port | `test/browser/harness.ts` | `{ proxy: { server: `http://127.0.0.1:${String(CLOSED_PORT)}` } }` → `{}` | `test/browser/harness.test.ts`: 1 failed \| 12 passed \| 5 skipped (18). "each browser is kept off the network: Chromium resolves no name, WebKit proxies to a closed loopback port" |
| L2-T6-M19 | a browser that cannot start names the install command | `test/browser/harness.ts` | `  } catch (e) { ⏎     const lines` → `  } catch (e) { ⏎     throw e; ⏎     const lines` | `test/browser/harness.test.ts`: 1 failed \| 12 passed \| 5 skipped (18). "a browser that cannot start is an error naming the install command" |
| L2-T6-M20 | the browser is driven over a pipe: the test process opens no socket | `test/browser/harness.ts` | `    return await type.launch({ ...launchOptions(name), ...extra });` → `    return await type.connect((await type.launchServer({ ...launchOptions(name), ...extra })).wsEndpoint());` | `test/browser/harness.test.ts`: 6 failed \| 7 passed \| 5 skipped (18). "the test process opens no socket: the browser is driven over a pipe"; "opens a page from its own origin, enhanced, with the fonts, nothing missing, aborted or refused"; "a routed request to another origin is aborted and counted"; "a request let past the route fails: the browser itself reaches no host"; "strict: no eval or Function, no fetch, no inline styles"; "reader: no eval or Function, no fetch, but inline styles" |
| L2-T6-M21 | strict refuses inline styles | `test/browser/harness.ts` | `  strict: `default-src 'none'; script-src ${ORIGIN}; style-src ${ORIGIN}; font-src` → `  strict: `default-src 'none'; script-src ${ORIGIN}; style-src ${ORIGIN} 'unsafe-inline'; font-src` | `test/browser/harness.test.ts`: 1 failed \| 12 passed \| 5 skipped (18). "strict: no eval or Function, no fetch, no inline styles" |
| L2-T6-M22 | strict has no 'unsafe-eval' | `test/browser/harness.ts` | `  strict: `default-src 'none'; script-src ${ORIGIN}; style-src` → `  strict: `default-src 'none'; script-src ${ORIGIN} 'unsafe-eval'; style-src` | `test/browser/harness.test.ts`: 1 failed \| 12 passed \| 5 skipped (18). "strict: no eval or Function, no fetch, no inline styles" |
| L2-T6-M23 | strict is default-src 'none' | `test/browser/harness.ts` | `  strict: `default-src 'none'; script-src` → `  strict: `script-src` | `test/browser/harness.test.ts`: 1 failed \| 12 passed \| 5 skipped (18). "strict: no eval or Function, no fetch, no inline styles" |
| L2-T6-M24 | the page is served under its policy | `test/browser/harness.ts` | `      if (url.pathname === '/') headers['content-security-policy'] = policy; ⏎ ` → (deleted) | `test/browser/harness.test.ts`: 2 failed \| 11 passed \| 5 skipped (18). "strict: no eval or Function, no fetch, no inline styles"; "reader: no eval or Function, no fetch, but inline styles" |
| L2-T6-M25 | DOCREADER_BROWSERS: an unknown name is an error | `test/browser/harness.ts` | `  if (names.length === 0 \|\| unknown.length > 0) {` → `  if (names.length === 0) {` | `test/browser/harness.test.ts`: 1 failed \| 12 passed \| 5 skipped (18). "an unknown name or an empty entry is an error, never a silent skip" |
| L2-T6-M26 | an excluded browser is reported, never silently skipped | `test/browser/harness.ts` | `    else describe.skip(excludedTitle(name, selection), () => fn(name)); ⏎ ` → (deleted) | `test/browser/harness.test.ts`: 1 failed \| 12 passed (13). "this file has one block per browser: a selected one runs, an excluded one is skipped under its title" |
| L2-T6-M27 | the page records its policy violations | `test/browser/page/bootstrap.ts` | `  violations.push(`${e.effectiveDirective} ${e.blockedURI === '' ? 'inline' : e.blockedURI}`); ⏎ ` → (deleted) | `test/browser/harness.test.ts`: 2 failed \| 11 passed \| 5 skipped (18). "strict: no eval or Function, no fetch, no inline styles"; "reader: no eval or Function, no fetch, but inline styles" |

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
    "old": "    else describe.skip(excludedTitle(name, selection), () => fn(name));\n",
    "new": "",
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
| L2-T6-M28 | snapshot: chrome outside the scope is transparent | `test/browser/page/snapshot.ts` | `      walkChildren(el, false, scope, isSource, into); // transparent ⏎       continue; ⏎ ` → (deleted) | `test/browser/snapshot.test.ts`: 4 failed \| 7 passed (11). "a later feature's chrome, outside the scope, moves nothing: its children stand in its place and texts join"; "a chrome wrapper outside the scope keeps the source nodes it holds, in its place"; "[name] brings in a source element that carries it, by itself; never chrome, and not its children"; "chrome text is left out of the snapshot outside the scope, and kept inside it" |
| L2-T6-M29 | snapshot: chrome's own text is left out outside the scope | `test/browser/page/snapshot.ts` | `if (inScope \|\| isSource(n as Text)) into.push` → `if (true) into.push` | `test/browser/snapshot.test.ts`: 3 failed \| 8 passed (11). "a later feature's chrome, outside the scope, moves nothing: its children stand in its place and texts join"; "[name] brings in a source element that carries it, by itself; never chrome, and not its children"; "chrome text is left out of the snapshot outside the scope, and kept inside it" |
| L2-T6-M30 | snapshot: marks are recorded only in the scope | `test/browser/page/snapshot.ts` | `  if (!inScope) return tag; ⏎ ` → (deleted) | `test/browser/snapshot.test.ts`: 2 failed \| 9 passed (11). "lists every source element by tag and every source text, nested by two spaces, and nothing else out of scope"; "[name] brings in a source element that carries it, by itself; never chrome, and not its children" |
| L2-T6-M31 | snapshot: an [attribute] entry never brings chrome in | `test/browser/page/snapshot.ts` | `    if (chrome && !inScope && !byClass) {` → `    if (chrome && !inScope && !byClass && !scope.attrs.some((a) => el.hasAttribute(a))) {` | `test/browser/snapshot.test.ts`: 1 failed \| 10 passed (11). "[name] brings in a source element that carries it, by itself; never chrome, and not its children" |
| L2-T6-M32 | snapshot: a class brings its element's whole subtree in | `test/browser/page/snapshot.ts` | `    const subtree = inScope \|\| byClass;` → `    const subtree = byClass;` | `test/browser/snapshot.test.ts`: 1 failed \| 10 passed (11). "a class brings its element and the whole subtree in: classes, the chrome mark, role, aria-*, hidden, data-docreader-*, data-label" |
| L2-T6-M33 | snapshot: adjacent texts join | `test/browser/page/snapshot.ts` | `      pending = (pending ?? '') + o.text;` → `      flush(); ⏎       pending = o.text;` | `test/browser/snapshot.test.ts`: 1 failed \| 10 passed (11). "a later feature's chrome, outside the scope, moves nothing: its children stand in its place and texts join" |
| L2-T6-M34 | snapshot: texts are cut to 40 code points | `test/browser/page/snapshot.ts` | `export const TEXT_CUT = 40;` → `export const TEXT_CUT = 400;` | `test/browser/snapshot.test.ts`: 2 failed \| 9 passed (11). "a text is cut to 40 code points, and a cut one ends in … after its quote"; "an attribute value is cut the same way" |
| L2-T6-M35 | snapshot: an invalid scope entry is refused | `test/browser/page/snapshot.ts` | `  if (bad.length > 0) throw new Error(`snapshot: invalid scope entries ${JSON.stringify(bad)}`); ⏎ ` → (deleted) | `test/browser/snapshot.test.ts`: 1 failed \| 10 passed (11). "an entry that is neither a class name nor [attribute] is refused" |
| L2-T6-M36 | source texts: a tail split off a source text is source | `test/browser/page/source.ts` | `      if (known.has(this)) known.add(tail); ⏎ ` → (deleted) | `test/browser/snapshot.test.ts`: 2 failed \| 9 passed (11). "a later feature's chrome, outside the scope, moves nothing: its children stand in its place and texts join"; "a text present when tracked is source; a tail split off it is source; a text made later is not" |

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
    "guard": "snapshot: marks are recorded only in the scope",
    "file": "test/browser/page/snapshot.ts",
    "old": "  if (!inScope) return tag;\n",
    "new": "",
    "tests": "test/browser/snapshot.test.ts"
  },
  {
    "id": "L2-T6-M31",
    "guard": "snapshot: an [attribute] entry never brings chrome in",
    "file": "test/browser/page/snapshot.ts",
    "old": "    if (chrome && !inScope && !byClass) {",
    "new": "    if (chrome && !inScope && !byClass && !scope.attrs.some((a) => el.hasAttribute(a))) {",
    "tests": "test/browser/snapshot.test.ts"
  },
  {
    "id": "L2-T6-M32",
    "guard": "snapshot: a class brings its element's whole subtree in",
    "file": "test/browser/page/snapshot.ts",
    "old": "    const subtree = inScope || byClass;",
    "new": "    const subtree = byClass;",
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
| L2-T6-M37 | Level 2: the expected file is written only with UPDATE_LAYOUT | `test/browser/layout-cases.ts` | `  if (update) {` → `  if (true) {` | `test/browser/layout-corpus.test.ts`: 1 failed \| 7 passed \| 5 skipped (13). "a case directory holds whole cases only, and the expected file is written only on request" |
| L2-T6-M38 | Level 2: an options file with an unknown key is refused | `test/browser/layout-cases.ts` | `  if (unknown.length > 0) throw bad(`unknown keys ${JSON.stringify(unknown)}`); ⏎ ` → (deleted) | `test/browser/layout-corpus.test.ts`: 1 failed \| 7 passed \| 5 skipped (13). "an options file is checked: unknown keys, an empty or bad scope, and wrong types are refused" |
| L2-T6-M39 | Level 2: hostile is true or absent | `test/browser/layout-cases.ts` | `  if (hostile !== undefined && hostile !== true) throw bad('"hostile" is true or absent'); ⏎ ` → (deleted) | `test/browser/layout-corpus.test.ts`: 1 failed \| 7 passed \| 5 skipped (13). "an options file is checked: unknown keys, an empty or bad scope, and wrong types are refused" |
| L2-T6-M40 | Level 2: a moved snapshot fails the case (the runner holds it) | `test/browser/layout-cases.ts` | `  if (verdict === 'differs') expect(actual, `${id}: the snapshot moved`).toBe(readFileSync(expected, 'utf8'));…` → (deleted) | `test/browser/layout-corpus.test.ts`: 1 failed \| 7 passed \| 5 skipped (13). "a case directory holds whole cases only, and the expected file is written only on request" |
| L2-T6-M41 | Level 2: an expected snapshot is held exactly | `conformance/layout/core/tables.dom.txt` | `div .stack.table-wrapper ⏎   table ⏎     thead ⏎       tr ⏎         th ⏎           "#"` → `div .stack.table-wrapper ⏎   table ⏎     thead ⏎       tr ⏎         th ⏎           "No."` | `test/browser/layout-corpus.test.ts`: 1 failed \| 7 passed \| 5 skipped (13). "core/tables" |
| L2-T6-M42 | Level 2 holds the layout: a table of three columns stacks | `src/enhance/status.ts` | `  journal.toggleClass(wrapper, 'stack', true); ⏎ ` → (deleted) | `test/browser/layout-corpus.test.ts`: 1 failed \| 7 passed \| 5 skipped (13). "core/tables" |
| L2-T6-M43 | Level 2 holds the layout: the eyebrow | `src/enhance/editorial.ts` | `    if (kinds.length > 0) {` → `    if (kinds.length > 99) {` | `test/browser/layout-corpus.test.ts`: 1 failed \| 7 passed \| 5 skipped (13). "core/editorial" |
| L2-T6-M44 | DOM clobbering: stored folds are looked up as a set, never by a property of an object | `src/enhance/folds.ts` | `    if (!want.has(s.id)) continue;` → `    if (!(s.id in Object.fromEntries([...want].map((x) => [x, 1])))) continue;` | `test/browser/layout-corpus.test.ts`: 2 failed \| 6 passed \| 5 skipped (13). "core/clobbering"; "DOM clobbering: the same document with those ids renamed gives the same snapshot, and the page is clobbered" |

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
| L2-T6-M45 | compare: the tolerance is 0.1 px | `scripts/visual/compare.mjs` | `export const TOLERANCE = 0.1;` → `export const TOLERANCE = 1;` | `test/visual-compare.test.ts`: 2 failed \| 9 passed (11). "lengths within 0.1 px are equal, and further apart are not"; "boxes are measured from the first block both pages hold, within 0.1 px" |
| L2-T6-M46 | compare: boxes are compared | `scripts/visual/compare.mjs` | `      if (!near(a, b)) out.push(` → `      if (false) out.push(` | `test/visual-compare.test.ts`: 2 failed \| 9 passed (11). "boxes are measured from the first block both pages hold, within 0.1 px"; "a computed value that differs is named with both values; a block in one page only is "present"" |
| L2-T6-M47 | compare: computed values are compared | `scripts/visual/compare.mjs` | `      if (!sameValue(prop, o.style[prop], r.style[prop])) out.push(` → `      if (false) out.push(` | `test/visual-compare.test.ts`: 1 failed \| 10 passed (11). "a computed value that differs is named with both values; a block in one page only is "present"" |
| L2-T6-M48 | compare: a block in our page only is reported | `scripts/visual/compare.mjs` | `      out.push({ block: o.key, prop: 'present', ours: 'yes', reference: 'no' }); ⏎ ` → (deleted) | `test/visual-compare.test.ts`: 1 failed \| 10 passed (11). "a computed value that differs is named with both values; a block in one page only is "present"" |
| L2-T6-M49 | compare: x is measured from the column's origin | `scripts/visual/compare.mjs` | `  const ox = origin?.box.x ?? 0;` → `  const ox = 0;` | `test/visual-compare.test.ts`: 1 failed \| 10 passed (11). "boxes are measured from the first block both pages hold, within 0.1 px" |
| L2-T6-M50 | compare: font-family by its generic family | `scripts/visual/compare.mjs` | `  if (prop === 'fontFamily') return generic(a) === generic(b); ⏎ ` → (deleted) | `test/visual-compare.test.ts`: 1 failed \| 10 passed (11). "any other value is compared as text; font-family by its generic family" |
| L2-T6-M51 | compare: a difference no entry names is unexpected | `scripts/visual/compare.mjs` | `    if (hit === undefined) unexpected.push(d);` → `    if (true) unexpected.push(d);` | `test/visual-compare.test.ts`: 2 failed \| 9 passed (11). "an entry names the differences it matches, by block, prop and combo patterns; the rest are unexpected"; "an entry with no patterns matches everything; with none, every difference is unexpected" |
| L2-T6-M52 | compare: a repeated flag is a usage error | `scripts/visual/compare.mjs` | `seen.has(key)) throw new Error(USAGE);` → `false) throw new Error(USAGE);` | `test/visual-compare.test.ts`: 1 failed \| 10 passed (11). "refuses a missing page, an unknown or repeated flag, and a bad state name" |
| L2-T6-M53 | compare: an unexpected difference exits 1 | `scripts/visual/compare.mjs` | `  return unexpectedCount === 0 ? 0 : 1;` → `  return 0;` | `test/browser/visual-compare.test.ts`: 1 failed \| 2 passed (3). "a block 1 px wider exits 1 and is named; an expected entry that names it exits 0 and reports it by name" |

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

## Visual check

On the core sample (`scripts/demo/samples/core.md`), `scripts/visual/compare.mjs` compared the demo page with a
temporary copy of the reference layout serving the same sample, at 1440×1000 and 390×844, in light, dark and sans
with wide: 46 blocks in both pages in each of the six combinations, every box equal to 0.1 px, and 0 unexpected
differences. The expected ones, each named, are parts not yet built or a ruled design:

| Name | Blocks | Values | Where |
|---|---|---|---|
| Hidden, not removed (C43): the front-matter strip and the meta line stay in the document, hidden, where the reference drops them | the strip, the meta line | present in ours only | all six |
| Contents rail not built (Task 18): the reference sets its column beside the rail, so its auto margins resolve differently; every box is equal | every block | margin-left, margin-right | desktop |
| Code block tools not built (Task 10): the reference's code block takes max-width 100% on a phone; the box is equal | the code block | max-width | phone |
| Attention marks not built (Task 19): the reference tints the table row that waits on the reader | one table row | background-color | phone |

The screenshots also show what no block measures, all of it chrome the prototype does not build yet: the bar, the
contents rail, the review strip, the Copy button, and the ID colours and links.
