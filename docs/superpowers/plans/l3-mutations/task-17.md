# L3 Task 17: mutation rows (CI hardening for the browser install)

Each guard Task 17 adds, deleted or inverted once, with the tests that go red. Measured 2026-10-26 on branch
`l3-t17-ci-hardening`, on its final code (`.github/workflows/ci.yml` sha256 `cf077619b87d88801a8b2939f9630bc8b5b7fb8a5981d420e2042903d0e7e0b9`), in one sequential
run (the fix round's re-measurement: every row, including the first round's, ran again on the fixed code). Every
row went red (exit 1) through assertion failures only: no row failed on setup, a type error or a timeout. Each
row's JSON names the failing assertions' lines in `test/ci-workflow.test.ts` (`at`).

**Method** (C69, C75, the plan's "Low disk" constraint). In place in the task's worktree, one row at a time: the
original bytes of `.github/workflows/ci.yml` and their sha256 were saved in a scratch directory outside the
worktree first; each row checked that the file still matched the saved sha256, replaced its `old` text (which
occurs exactly once) with its `new` text (a row with an `after` pair also inserts the removed block after that
anchor, which occurs exactly once), and ran

```
ulimit -u <threads + 1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts
```

where `<threads>` is `ps -L -u "$(id -u)" --no-headers | wc -l`, measured before each row (the value is in each
row's JSON). The file was then rewritten from the saved bytes, never `git checkout`, and its sha256 compared
with the saved one: all 24 restores matched. `sha256sum -c` over both changed files after the run was OK.
No generated file depends on `ci.yml`, so no row needed a rebuild.

Rows L3.CI1a, L3.CI2a, L3.CI2b, L3.CI3a, L3.CI3b, L3.CI4a and L3.CI4b are the plan's; the others are added guards
(the https timeout, the apt step's position, the per-attempt timeout, the job timeout, a successful attempt ending
the loop, the version check that refuses a range, the cache path, the key's OS-release and architecture terms and
the OS-release read behind them, and a local `uses:` in three forms). L3.R1 and L3.R2 pin the ratchet step's
command, which the step-order test compared exactly before this task and by name only in its first round.

The step scripts are measured by running them, not only by reading them: `test/ci-workflow.test.ts` runs the apt,
version and install steps in `bash -e` (as GitHub runs a `run:` step) with fake `sudo`, `tee` and `npx` first on
PATH. A row therefore goes red through the behaviour it breaks (L3.CI2a: the fake `npx` is called once, not twice).

## L3.CI1: apt retries and timeouts before the install

| Row | Guard | File | Change | Exit | Red (tests in the named file) | Restore |
|---|---|---|---|---|---|---|
| L3.CI1a | apt retries | `.github/workflows/ci.yml` | `'Acquire::Retries "5";' ` → (deleted) | 1 | `test/ci-workflow.test.ts`: 1 failed \| 30 passed (31). "L3.CI1: an apt step before the install writes the retries and the two timeouts to its own apt configuration file". | sha256 matched |
| L3.CI1b (added) | the apt step precedes the install | `.github/workflows/ci.yml` | `      - name: apt retries and timeouts ⏎         run: \| ⏎           printf '%s\n' 'Acqui…` moved after `            echo "::warning::browser install attempt ${attempt} of 2 failed or timed out"…` | 1 | `test/ci-workflow.test.ts`: 2 failed \| 29 passed (31). "installs from the lock, reads the playwright-core pin, restores the browser cache, configures apt, installs the browsers, typechecks, tests, checks the tests wrote no layout snapshot, builds, runs the ratchet, then packs and smokes the tarball"; "L3.CI1: an apt step before the install writes the retries and the two timeouts to its own apt configuration file". | sha256 matched |
| L3.CI1c (added) | the https timeout | `.github/workflows/ci.yml` | ` 'Acquire::https::Timeout "30";'` → (deleted) | 1 | `test/ci-workflow.test.ts`: 1 failed \| 30 passed (31). "L3.CI1: an apt step before the install writes the retries and the two timeouts to its own apt configuration file". | sha256 matched |
| L3.CI1d (coordinator) | the dpkg lock timeout | `.github/workflows/ci.yml` | ` 'DPkg::Lock::Timeout "300";' \` line → (deleted) | 1 | `test/ci-workflow.test.ts`: 1 failed \| 30 passed (31). "L3.CI1: an apt step before the install writes the retries and the two timeouts to its own apt configuration file". | sha256 matched |

```json
[
  {
    "id": "L3.CI1a",
    "guard": "apt retries",
    "file": ".github/workflows/ci.yml",
    "old": "'Acquire::Retries \"5\";' ",
    "new": "",
    "tests": "test/ci-workflow.test.ts",
    "command": "ulimit -u 3287; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
    "threads": 1787,
    "exit": 1,
    "result": "1 failed | 30 passed (31)",
    "failed": [
      "L3.CI1: an apt step before the install writes the retries and the two timeouts to its own apt configuration file"
    ],
    "assertions": [
      "expected 'Acquire::http::Timeout \"30\";\\nAcquire…' to be 'Acquire::Retries \"5\";\\nAcquire::http:…' // Object.is equality"
    ],
    "at": [
      "test/ci-workflow.test.ts:255"
    ],
    "restored_sha256": "cf077619b87d88801a8b2939f9630bc8b5b7fb8a5981d420e2042903d0e7e0b9",
    "restore_matches": true
  },
  {
    "id": "L3.CI1b",
    "guard": "the apt step precedes the install",
    "file": ".github/workflows/ci.yml",
    "old": "      - name: apt retries and timeouts\n        run: |\n          printf '%s\\n' 'Acquire::Retries \"5\";' 'Acquire::http::Timeout \"30\";' 'Acquire::https::Timeout \"30\";' \\\n            | sudo tee /etc/apt/apt.conf.d/80-docserver-ci > /dev/null\n",
    "new": "",
    "after": {
      "anchor": "            echo \"::warning::browser install attempt ${attempt} of 2 failed or timed out\"\n          done\n          exit 1\n",
      "insert": "      - name: apt retries and timeouts\n        run: |\n          printf '%s\\n' 'Acquire::Retries \"5\";' 'Acquire::http::Timeout \"30\";' 'Acquire::https::Timeout \"30\";' \\\n            | sudo tee /etc/apt/apt.conf.d/80-docserver-ci > /dev/null\n"
    },
    "tests": "test/ci-workflow.test.ts",
    "command": "ulimit -u 3299; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
    "threads": 1799,
    "exit": 1,
    "result": "2 failed | 29 passed (31)",
    "failed": [
      "installs from the lock, reads the playwright-core pin, restores the browser cache, configures apt, installs the browsers, typechecks, tests, checks the tests wrote no layout snapshot, builds, runs the ratchet, then packs and smokes the tarball",
      "L3.CI1: an apt step before the install writes the retries and the two timeouts to its own apt configuration file"
    ],
    "assertions": [
      "expected [ 'actions/checkout', …(13) ] to deeply equal [ 'actions/checkout', …(13) ]",
      "expected 6 to be less than 5"
    ],
    "at": [
      "test/ci-workflow.test.ts:191",
      "test/ci-workflow.test.ts:248"
    ],
    "restored_sha256": "cf077619b87d88801a8b2939f9630bc8b5b7fb8a5981d420e2042903d0e7e0b9",
    "restore_matches": true
  },
  {
    "id": "L3.CI1c",
    "guard": "the https timeout",
    "file": ".github/workflows/ci.yml",
    "old": " 'Acquire::https::Timeout \"30\";'",
    "new": "",
    "tests": "test/ci-workflow.test.ts",
    "command": "ulimit -u 3273; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
    "threads": 1773,
    "exit": 1,
    "result": "1 failed | 30 passed (31)",
    "failed": [
      "L3.CI1: an apt step before the install writes the retries and the two timeouts to its own apt configuration file"
    ],
    "assertions": [
      "expected 'Acquire::Retries \"5\";\\nAcquire::http:…' to be 'Acquire::Retries \"5\";\\nAcquire::http:…' // Object.is equality"
    ],
    "at": [
      "test/ci-workflow.test.ts:255"
    ],
    "restored_sha256": "cf077619b87d88801a8b2939f9630bc8b5b7fb8a5981d420e2042903d0e7e0b9",
    "restore_matches": true
  }
]
```

## L3.CI2: two bounded install attempts, the step timeout and the job timeout

| Row | Guard | File | Change | Exit | Red (tests in the named file) | Restore |
|---|---|---|---|---|---|---|
| L3.CI2a | two install attempts | `.github/workflows/ci.yml` | `for attempt in 1 2; do` → `for attempt in 1; do` | 1 | `test/ci-workflow.test.ts`: 2 failed \| 29 passed (31). "L3.CI2: an install that fails twice: two attempts, then the step fails"; "L3.CI2: an install that fails, then succeeds: two attempts, and the step passes". | sha256 matched |
| L3.CI2b | the install step timeout | `.github/workflows/ci.yml` | `        timeout-minutes: 22 ⏎ ` → (deleted) | 1 | `test/ci-workflow.test.ts`: 1 failed \| 30 passed (31). "L3.CI2: the install step runs INSTALL under `timeout -k 30 600`, in a loop of exactly two attempts that both fit in its own step timeout". | sha256 matched |
| L3.CI2c (added) | each attempt runs under timeout | `.github/workflows/ci.yml` | `if timeout -k 30 600 npx` → `if npx` | 1 | `test/ci-workflow.test.ts`: 1 failed \| 30 passed (31). "L3.CI2: the install step runs INSTALL under `timeout -k 30 600`, in a loop of exactly two attempts that both fit in its own step timeout". | sha256 matched |
| L3.CI2d (added) | the job timeout is 45 | `.github/workflows/ci.yml` | `    timeout-minutes: 45 ⏎ ` → `    timeout-minutes: 30 ⏎ ` | 1 | `test/ci-workflow.test.ts`: 1 failed \| 30 passed (31). "runs on Node 22 and 24, both legs to the end, within 45 minutes (L3.CI2: two install attempts and the suite fit)". | sha256 matched |
| L3.CI2e (added) | a successful attempt ends the loop | `.github/workflows/ci.yml` | `              exit 0 ⏎ ` → `              true ⏎ ` | 1 | `test/ci-workflow.test.ts`: 2 failed \| 29 passed (31). "L3.CI2: an install that succeeds at once: one attempt"; "L3.CI2: an install that fails, then succeeds: two attempts, and the step passes". | sha256 matched |

```json
[
  {
    "id": "L3.CI2a",
    "guard": "two install attempts",
    "file": ".github/workflows/ci.yml",
    "old": "for attempt in 1 2; do",
    "new": "for attempt in 1; do",
    "tests": "test/ci-workflow.test.ts",
    "command": "ulimit -u 3243; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
    "threads": 1743,
    "exit": 1,
    "result": "2 failed | 29 passed (31)",
    "failed": [
      "L3.CI2: an install that fails twice: two attempts, then the step fails",
      "L3.CI2: an install that fails, then succeeds: two attempts, and the step passes"
    ],
    "assertions": [
      "expected [ Array(1) ] to deeply equal [ …(2) ]",
      "::warning::browser install attempt 1 of 2 failed or timed out"
    ],
    "at": [
      "test/ci-workflow.test.ts:278",
      "test/ci-workflow.test.ts:276"
    ],
    "restored_sha256": "cf077619b87d88801a8b2939f9630bc8b5b7fb8a5981d420e2042903d0e7e0b9",
    "restore_matches": true
  },
  {
    "id": "L3.CI2b",
    "guard": "the install step timeout",
    "file": ".github/workflows/ci.yml",
    "old": "        timeout-minutes: 22\n",
    "new": "",
    "tests": "test/ci-workflow.test.ts",
    "command": "ulimit -u 3290; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
    "threads": 1790,
    "exit": 1,
    "result": "1 failed | 30 passed (31)",
    "failed": [
      "L3.CI2: the install step runs INSTALL under `timeout -k 30 600`, in a loop of exactly two attempts that both fit in its own step timeout"
    ],
    "assertions": [
      "expected undefined to be 22 // Object.is equality"
    ],
    "at": [
      "test/ci-workflow.test.ts:262"
    ],
    "restored_sha256": "cf077619b87d88801a8b2939f9630bc8b5b7fb8a5981d420e2042903d0e7e0b9",
    "restore_matches": true
  },
  {
    "id": "L3.CI2c",
    "guard": "each attempt runs under timeout",
    "file": ".github/workflows/ci.yml",
    "old": "if timeout -k 30 600 npx",
    "new": "if npx",
    "tests": "test/ci-workflow.test.ts",
    "command": "ulimit -u 3202; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
    "threads": 1702,
    "exit": 1,
    "result": "1 failed | 30 passed (31)",
    "failed": [
      "L3.CI2: the install step runs INSTALL under `timeout -k 30 600`, in a loop of exactly two attempts that both fit in its own step timeout"
    ],
    "assertions": [
      "expected 'for attempt in 1 2; do\\n  if npx play…' to contain 'timeout -k 30 600 npx playwright-core…'"
    ],
    "at": [
      "test/ci-workflow.test.ts:261"
    ],
    "restored_sha256": "cf077619b87d88801a8b2939f9630bc8b5b7fb8a5981d420e2042903d0e7e0b9",
    "restore_matches": true
  },
  {
    "id": "L3.CI2d",
    "guard": "the job timeout is 45",
    "file": ".github/workflows/ci.yml",
    "old": "    timeout-minutes: 45\n",
    "new": "    timeout-minutes: 30\n",
    "tests": "test/ci-workflow.test.ts",
    "command": "ulimit -u 3191; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
    "threads": 1691,
    "exit": 1,
    "result": "1 failed | 30 passed (31)",
    "failed": [
      "runs on Node 22 and 24, both legs to the end, within 45 minutes (L3.CI2: two install attempts and the suite fit)"
    ],
    "assertions": [
      "expected 30 to be 45 // Object.is equality"
    ],
    "at": [
      "test/ci-workflow.test.ts:174"
    ],
    "restored_sha256": "cf077619b87d88801a8b2939f9630bc8b5b7fb8a5981d420e2042903d0e7e0b9",
    "restore_matches": true
  },
  {
    "id": "L3.CI2e",
    "guard": "a successful attempt ends the loop",
    "file": ".github/workflows/ci.yml",
    "old": "              exit 0\n",
    "new": "              true\n",
    "tests": "test/ci-workflow.test.ts",
    "command": "ulimit -u 3238; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
    "threads": 1738,
    "exit": 1,
    "result": "2 failed | 29 passed (31)",
    "failed": [
      "L3.CI2: an install that succeeds at once: one attempt",
      "L3.CI2: an install that fails, then succeeds: two attempts, and the step passes"
    ],
    "assertions": [
      "::warning::browser install attempt 1 of 2 failed or timed out"
    ],
    "at": [
      "test/ci-workflow.test.ts:276"
    ],
    "restored_sha256": "cf077619b87d88801a8b2939f9630bc8b5b7fb8a5981d420e2042903d0e7e0b9",
    "restore_matches": true
  }
]
```

## L3.CI3: the browser cache before the install, keyed on the runner and the pinned playwright-core

| Row | Guard | File | Change | Exit | Red (tests in the named file) | Restore |
|---|---|---|---|---|---|---|
| L3.CI3a | the cache key embeds the playwright-core version | `.github/workflows/ci.yml` | `-playwright-core-${{ steps.playwright.outputs.version }}` → `-playwright-core` | 1 | `test/ci-workflow.test.ts`: 2 failed \| 29 passed (31). "checks out full history, keeps no credentials in the workspace, sets up the matrix Node with the npm cache, and caches the browsers, each action pinned by commit sha"; "L3.CI3: the cache step restores the Playwright browser directory before the install, keyed on the runner OS, architecture and OS release and the pinned playwright-core version, with no fallback key". | sha256 matched |
| L3.CI3b | the cache precedes the install | `.github/workflows/ci.yml` | `      - uses: actions/cache@55cc8345863c7cc4c66a329aec7e433d2d1c52a9 # v6.1.0 ⏎         w…` moved after `            echo "::warning::browser install attempt ${attempt} of 2 failed or timed out"…` | 1 | `test/ci-workflow.test.ts`: 2 failed \| 29 passed (31). "installs from the lock, reads the playwright-core pin, restores the browser cache, configures apt, installs the browsers, typechecks, tests, checks the tests wrote no layout snapshot, builds, runs the ratchet, then packs and smokes the tarball"; "L3.CI3: the cache step restores the Playwright browser directory before the install, keyed on the runner OS, architecture and OS release and the pinned playwright-core version, with no fallback key". | sha256 matched |
| L3.CI3c (added) | the version step refuses a range | `.github/workflows/ci.yml` | `          [[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] ⏎ ` → (deleted) | 1 | `test/ci-workflow.test.ts`: 2 failed \| 29 passed (31). "L3.CI3: the version step fails, and writes no key part, on a range (never a floating key)"; "L3.CI3: the version step fails, and writes no key part, on a missing pin (never a floating key)". | sha256 matched |
| L3.CI3d (added) | the cache path is the browser directory | `.github/workflows/ci.yml` | `path: ${{ steps.playwright.outputs.browsers }}` → `path: node_modules/.cache/ms-playwright` | 1 | `test/ci-workflow.test.ts`: 2 failed \| 29 passed (31). "checks out full history, keeps no credentials in the workspace, sets up the matrix Node with the npm cache, and caches the browsers, each action pinned by commit sha"; "L3.CI3: the cache step restores the Playwright browser directory before the install, keyed on the runner OS, architecture and OS release and the pinned playwright-core version, with no fallback key". | sha256 matched |
| L3.CI3e (added) | the cache key names the OS release | `.github/workflows/ci.yml` | `-${{ steps.playwright.outputs.os }}-playwright-core` → `-playwright-core` | 1 | `test/ci-workflow.test.ts`: 2 failed \| 29 passed (31). "checks out full history, keeps no credentials in the workspace, sets up the matrix Node with the npm cache, and caches the browsers, each action pinned by commit sha"; "L3.CI3: the cache step restores the Playwright browser directory before the install, keyed on the runner OS, architecture and OS release and the pinned playwright-core version, with no fallback key". | sha256 matched |
| L3.CI3f (added) | the cache key names the architecture | `.github/workflows/ci.yml` | `-${{ runner.arch }}` → (deleted) | 1 | `test/ci-workflow.test.ts`: 2 failed \| 29 passed (31). "checks out full history, keeps no credentials in the workspace, sets up the matrix Node with the npm cache, and caches the browsers, each action pinned by commit sha"; "L3.CI3: the cache step restores the Playwright browser directory before the install, keyed on the runner OS, architecture and OS release and the pinned playwright-core version, with no fallback key". | sha256 matched |
| L3.CI3g (added) | the version step writes the OS release | `.github/workflows/ci.yml` | ` "os=$os"` → (deleted) | 1 | `test/ci-workflow.test.ts`: 6 failed \| 25 passed (31). "L3.CI3: the version step reads exactly the playwright-core pin from package.json, so the key embeds it, and names the directory playwright-core installs into with XDG_CACHE_HOME unset: .cache/ms-playwright under HOME"; "L3.CI3: the version step reads exactly the playwright-core pin from package.json, so the key embeds it, and names the directory playwright-core installs into with XDG_CACHE_HOME set: ms-playwright under it"; "L3.CI3: the version step names the OS release playwright-core picks its builds by, so a new runner release is a new key: Ubuntu 22.04"; "L3.CI3: the version step names the OS release playwright-core picks its builds by, so a new runner release is a new key: Ubuntu 24.04"; "L3.CI3: the version step names the OS release playwright-core picks its builds by, so a new runner release is a new key: Ubuntu 26.04, unquoted"; "L3.CI3: the version step names the OS release playwright-core picks its builds by, so a new runner release is a new key: Debian 12". | sha256 matched |
| L3.CI3h (added) | the version step refuses an OS release without ID or VERSION_ID | `.github/workflows/ci.yml` | `echo "${ID:?}${VERSION_ID:?}"` → `echo "${ID}${VERSION_ID}"` | 1 | `test/ci-workflow.test.ts`: 2 failed \| 29 passed (31). "L3.CI3: the version step fails, and writes no key part, on an OS release with no VERSION_ID (never a floating key)"; "L3.CI3: the version step fails, and writes no key part, on an OS release with no ID (never a floating key)". | sha256 matched |
| L3.CI3i (added) | the OS release fields come from the file, never the environment | `.github/workflows/ci.yml` | `unset ID VERSION_ID && ` → (deleted) | 1 | `test/ci-workflow.test.ts`: 1 failed \| 30 passed (31). "L3.CI3: the version step fails, and writes no key part, on an OS release with no ID or VERSION_ID, while the environment carries both (never a floating key)". | sha256 matched |

```json
[
  {
    "id": "L3.CI3a",
    "guard": "the cache key embeds the playwright-core version",
    "file": ".github/workflows/ci.yml",
    "old": "-playwright-core-${{ steps.playwright.outputs.version }}",
    "new": "-playwright-core",
    "tests": "test/ci-workflow.test.ts",
    "command": "ulimit -u 3305; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
    "threads": 1805,
    "exit": 1,
    "result": "2 failed | 29 passed (31)",
    "failed": [
      "checks out full history, keeps no credentials in the workspace, sets up the matrix Node with the npm cache, and caches the browsers, each action pinned by commit sha",
      "L3.CI3: the cache step restores the Playwright browser directory before the install, keyed on the runner OS, architecture and OS release and the pinned playwright-core version, with no fallback key"
    ],
    "assertions": [
      "expected [ [ …(2) ], [ …(2) ], [ …(2) ] ] to deeply equal [ [ …(2) ], [ …(2) ], [ …(2) ] ]",
      "expected 'ms-playwright-${{ runner.os }}-${{ ru…' to contain '${{ steps.playwright.outputs.version …'"
    ],
    "at": [
      "test/ci-workflow.test.ts:180",
      "test/ci-workflow.test.ts:292"
    ],
    "restored_sha256": "cf077619b87d88801a8b2939f9630bc8b5b7fb8a5981d420e2042903d0e7e0b9",
    "restore_matches": true
  },
  {
    "id": "L3.CI3b",
    "guard": "the cache precedes the install",
    "file": ".github/workflows/ci.yml",
    "old": "      - uses: actions/cache@55cc8345863c7cc4c66a329aec7e433d2d1c52a9 # v6.1.0\n        with:\n          path: ${{ steps.playwright.outputs.browsers }}\n          key: ms-playwright-${{ runner.os }}-${{ runner.arch }}-${{ steps.playwright.outputs.os }}-playwright-core-${{ steps.playwright.outputs.version }}\n",
    "new": "",
    "after": {
      "anchor": "            echo \"::warning::browser install attempt ${attempt} of 2 failed or timed out\"\n          done\n          exit 1\n",
      "insert": "      - uses: actions/cache@55cc8345863c7cc4c66a329aec7e433d2d1c52a9 # v6.1.0\n        with:\n          path: ${{ steps.playwright.outputs.browsers }}\n          key: ms-playwright-${{ runner.os }}-${{ runner.arch }}-${{ steps.playwright.outputs.os }}-playwright-core-${{ steps.playwright.outputs.version }}\n"
    },
    "tests": "test/ci-workflow.test.ts",
    "command": "ulimit -u 3289; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
    "threads": 1789,
    "exit": 1,
    "result": "2 failed | 29 passed (31)",
    "failed": [
      "installs from the lock, reads the playwright-core pin, restores the browser cache, configures apt, installs the browsers, typechecks, tests, checks the tests wrote no layout snapshot, builds, runs the ratchet, then packs and smokes the tarball",
      "L3.CI3: the cache step restores the Playwright browser directory before the install, keyed on the runner OS, architecture and OS release and the pinned playwright-core version, with no fallback key"
    ],
    "assertions": [
      "expected [ 'actions/checkout', …(13) ] to deeply equal [ 'actions/checkout', …(13) ]",
      "expected 6 to be less than 5"
    ],
    "at": [
      "test/ci-workflow.test.ts:191",
      "test/ci-workflow.test.ts:283"
    ],
    "restored_sha256": "cf077619b87d88801a8b2939f9630bc8b5b7fb8a5981d420e2042903d0e7e0b9",
    "restore_matches": true
  },
  {
    "id": "L3.CI3c",
    "guard": "the version step refuses a range",
    "file": ".github/workflows/ci.yml",
    "old": "          [[ \"$version\" =~ ^[0-9]+\\.[0-9]+\\.[0-9]+$ ]]\n",
    "new": "",
    "tests": "test/ci-workflow.test.ts",
    "command": "ulimit -u 3367; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
    "threads": 1867,
    "exit": 1,
    "result": "2 failed | 29 passed (31)",
    "failed": [
      "L3.CI3: the version step fails, and writes no key part, on a range (never a floating key)",
      "L3.CI3: the version step fails, and writes no key part, on a missing pin (never a floating key)"
    ],
    "assertions": [
      "expected +0 not to be +0 // Object.is equality"
    ],
    "at": [
      "test/ci-workflow.test.ts:352"
    ],
    "restored_sha256": "cf077619b87d88801a8b2939f9630bc8b5b7fb8a5981d420e2042903d0e7e0b9",
    "restore_matches": true
  },
  {
    "id": "L3.CI3d",
    "guard": "the cache path is the browser directory",
    "file": ".github/workflows/ci.yml",
    "old": "path: ${{ steps.playwright.outputs.browsers }}",
    "new": "path: node_modules/.cache/ms-playwright",
    "tests": "test/ci-workflow.test.ts",
    "command": "ulimit -u 3343; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
    "threads": 1843,
    "exit": 1,
    "result": "2 failed | 29 passed (31)",
    "failed": [
      "checks out full history, keeps no credentials in the workspace, sets up the matrix Node with the npm cache, and caches the browsers, each action pinned by commit sha",
      "L3.CI3: the cache step restores the Playwright browser directory before the install, keyed on the runner OS, architecture and OS release and the pinned playwright-core version, with no fallback key"
    ],
    "assertions": [
      "expected [ [ …(2) ], [ …(2) ], [ …(2) ] ] to deeply equal [ [ …(2) ], [ …(2) ], [ …(2) ] ]",
      "expected 'node_modules/.cache/ms-playwright' to be '${{ steps.playwright.outputs.browsers…' // Object.is equality"
    ],
    "at": [
      "test/ci-workflow.test.ts:180",
      "test/ci-workflow.test.ts:287"
    ],
    "restored_sha256": "cf077619b87d88801a8b2939f9630bc8b5b7fb8a5981d420e2042903d0e7e0b9",
    "restore_matches": true
  },
  {
    "id": "L3.CI3e",
    "guard": "the cache key names the OS release",
    "file": ".github/workflows/ci.yml",
    "old": "-${{ steps.playwright.outputs.os }}-playwright-core",
    "new": "-playwright-core",
    "tests": "test/ci-workflow.test.ts",
    "command": "ulimit -u 3318; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
    "threads": 1818,
    "exit": 1,
    "result": "2 failed | 29 passed (31)",
    "failed": [
      "checks out full history, keeps no credentials in the workspace, sets up the matrix Node with the npm cache, and caches the browsers, each action pinned by commit sha",
      "L3.CI3: the cache step restores the Playwright browser directory before the install, keyed on the runner OS, architecture and OS release and the pinned playwright-core version, with no fallback key"
    ],
    "assertions": [
      "expected [ [ …(2) ], [ …(2) ], [ …(2) ] ] to deeply equal [ [ …(2) ], [ …(2) ], [ …(2) ] ]",
      "expected 'ms-playwright-${{ runner.os }}-${{ ru…' to contain '${{ steps.playwright.outputs.os }}'"
    ],
    "at": [
      "test/ci-workflow.test.ts:180",
      "test/ci-workflow.test.ts:291"
    ],
    "restored_sha256": "cf077619b87d88801a8b2939f9630bc8b5b7fb8a5981d420e2042903d0e7e0b9",
    "restore_matches": true
  },
  {
    "id": "L3.CI3f",
    "guard": "the cache key names the architecture",
    "file": ".github/workflows/ci.yml",
    "old": "-${{ runner.arch }}",
    "new": "",
    "tests": "test/ci-workflow.test.ts",
    "command": "ulimit -u 3315; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
    "threads": 1815,
    "exit": 1,
    "result": "2 failed | 29 passed (31)",
    "failed": [
      "checks out full history, keeps no credentials in the workspace, sets up the matrix Node with the npm cache, and caches the browsers, each action pinned by commit sha",
      "L3.CI3: the cache step restores the Playwright browser directory before the install, keyed on the runner OS, architecture and OS release and the pinned playwright-core version, with no fallback key"
    ],
    "assertions": [
      "expected [ [ …(2) ], [ …(2) ], [ …(2) ] ] to deeply equal [ [ …(2) ], [ …(2) ], [ …(2) ] ]",
      "expected 'ms-playwright-${{ runner.os }}-${{ st…' to contain '${{ runner.arch }}'"
    ],
    "at": [
      "test/ci-workflow.test.ts:180",
      "test/ci-workflow.test.ts:290"
    ],
    "restored_sha256": "cf077619b87d88801a8b2939f9630bc8b5b7fb8a5981d420e2042903d0e7e0b9",
    "restore_matches": true
  },
  {
    "id": "L3.CI3g",
    "guard": "the version step writes the OS release",
    "file": ".github/workflows/ci.yml",
    "old": " \"os=$os\"",
    "new": "",
    "tests": "test/ci-workflow.test.ts",
    "command": "ulimit -u 3304; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
    "threads": 1804,
    "exit": 1,
    "result": "6 failed | 25 passed (31)",
    "failed": [
      "L3.CI3: the version step reads exactly the playwright-core pin from package.json, so the key embeds it, and names the directory playwright-core installs into with XDG_CACHE_HOME unset: .cache/ms-playwright under HOME",
      "L3.CI3: the version step reads exactly the playwright-core pin from package.json, so the key embeds it, and names the directory playwright-core installs into with XDG_CACHE_HOME set: ms-playwright under it",
      "L3.CI3: the version step names the OS release playwright-core picks its builds by, so a new runner release is a new key: Ubuntu 22.04",
      "L3.CI3: the version step names the OS release playwright-core picks its builds by, so a new runner release is a new key: Ubuntu 24.04",
      "L3.CI3: the version step names the OS release playwright-core picks its builds by, so a new runner release is a new key: Ubuntu 26.04, unquoted",
      "L3.CI3: the version step names the OS release playwright-core picks its builds by, so a new runner release is a new key: Debian 12"
    ],
    "assertions": [
      "expected 'version=1.63.0\\nbrowsers=/tmp/docserv…' to be 'version=1.63.0\\nos=ubuntu24.04\\nbrows…' // Object.is equality",
      "expected 'version=1.63.0\\nbrowsers=/tmp/docserv…' to be 'version=1.63.0\\nos=ubuntu24.04\\nbrows…' // Object.is equality",
      "expected [] to deeply equal [ 'os=ubuntu22.04' ]",
      "expected [] to deeply equal [ 'os=ubuntu24.04' ]",
      "expected [] to deeply equal [ 'os=ubuntu26.04' ]",
      "expected [] to deeply equal [ 'os=debian12' ]"
    ],
    "at": [
      "test/ci-workflow.test.ts:310",
      "test/ci-workflow.test.ts:310",
      "test/ci-workflow.test.ts:323",
      "test/ci-workflow.test.ts:323",
      "test/ci-workflow.test.ts:323",
      "test/ci-workflow.test.ts:323"
    ],
    "restored_sha256": "cf077619b87d88801a8b2939f9630bc8b5b7fb8a5981d420e2042903d0e7e0b9",
    "restore_matches": true
  },
  {
    "id": "L3.CI3h",
    "guard": "the version step refuses an OS release without ID or VERSION_ID",
    "file": ".github/workflows/ci.yml",
    "old": "echo \"${ID:?}${VERSION_ID:?}\"",
    "new": "echo \"${ID}${VERSION_ID}\"",
    "tests": "test/ci-workflow.test.ts",
    "command": "ulimit -u 3338; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
    "threads": 1838,
    "exit": 1,
    "result": "2 failed | 29 passed (31)",
    "failed": [
      "L3.CI3: the version step fails, and writes no key part, on an OS release with no VERSION_ID (never a floating key)",
      "L3.CI3: the version step fails, and writes no key part, on an OS release with no ID (never a floating key)"
    ],
    "assertions": [
      "expected +0 not to be +0 // Object.is equality"
    ],
    "at": [
      "test/ci-workflow.test.ts:352"
    ],
    "restored_sha256": "cf077619b87d88801a8b2939f9630bc8b5b7fb8a5981d420e2042903d0e7e0b9",
    "restore_matches": true
  },
  {
    "id": "L3.CI3i",
    "guard": "the OS release fields come from the file, never the environment",
    "file": ".github/workflows/ci.yml",
    "old": "unset ID VERSION_ID && ",
    "new": "",
    "tests": "test/ci-workflow.test.ts",
    "command": "ulimit -u 3284; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
    "threads": 1784,
    "exit": 1,
    "result": "1 failed | 30 passed (31)",
    "failed": [
      "L3.CI3: the version step fails, and writes no key part, on an OS release with no ID or VERSION_ID, while the environment carries both (never a floating key)"
    ],
    "assertions": [
      "expected +0 not to be +0 // Object.is equality"
    ],
    "at": [
      "test/ci-workflow.test.ts:352"
    ],
    "restored_sha256": "cf077619b87d88801a8b2939f9630bc8b5b7fb8a5981d420e2042903d0e7e0b9",
    "restore_matches": true
  }
]
```

## L3.CI4: every remote action pinned by commit sha with its tag, and no local `uses:`

| Row | Guard | File | Change | Exit | Red (tests in the named file) | Restore |
|---|---|---|---|---|---|---|
| L3.CI4a | checkout pinned by commit sha | `.github/workflows/ci.yml` | `actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4.4.0` → `actions/checkout@v4` | 1 | `test/ci-workflow.test.ts`: 3 failed \| 28 passed (31). "checks out full history, keeps no credentials in the workspace, sets up the matrix Node with the npm cache, and caches the browsers, each action pinned by commit sha"; "L3.CI4: every remote `uses:` is a full commit sha with its release tag in a trailing comment, and ci.yml holds no local `uses:`"; "L3.CI4: each pin names the release its tag comment names". | sha256 matched |
| L3.CI4b | a sha pin carries its tag comment | `.github/workflows/ci.yml` | `actions/cache@55cc8345863c7cc4c66a329aec7e433d2d1c52a9 # v6.1.0` → `actions/cache@55cc8345863c7cc4c66a329aec7e433d2d1c52a9` | 1 | `test/ci-workflow.test.ts`: 2 failed \| 29 passed (31). "L3.CI4: every remote `uses:` is a full commit sha with its release tag in a trailing comment, and ci.yml holds no local `uses:`"; "L3.CI4: each pin names the release its tag comment names". | sha256 matched |
| L3.CI4c (added) | no local uses | `.github/workflows/ci.yml` | `      - run: npm run typecheck ⏎ ` → `      - uses: ./.github/actions/typecheck # v1.0.0 ⏎       - run: npm run typecheck ⏎ ` | 1 | `test/ci-workflow.test.ts`: 3 failed \| 28 passed (31). "checks out full history, keeps no credentials in the workspace, sets up the matrix Node with the npm cache, and caches the browsers, each action pinned by commit sha"; "installs from the lock, reads the playwright-core pin, restores the browser cache, configures apt, installs the browsers, typechecks, tests, checks the tests wrote no layout snapshot, builds, runs the ratchet, then packs and smokes the tarball"; "L3.CI4: every remote `uses:` is a full commit sha with its release tag in a trailing comment, and ci.yml holds no local `uses:`". This reference has no `@`, so inside the L3.CI4 general test the SHA_PINNED match (line 363) fails first and the no-local assertions after it are not reached; L3.CI4d and L3.CI4e measure those. | sha256 matched |
| L3.CI4d (added) | no local uses, even sha-shaped | `.github/workflows/ci.yml` | `      - run: npm run typecheck ⏎ ` → `      - uses: ./.github/actions/x@aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa # v1.0.0 ⏎    …` | 1 | `test/ci-workflow.test.ts`: 3 failed \| 28 passed (31). "checks out full history, keeps no credentials in the workspace, sets up the matrix Node with the npm cache, and caches the browsers, each action pinned by commit sha"; "installs from the lock, reads the playwright-core pin, restores the browser cache, configures apt, installs the browsers, typechecks, tests, checks the tests wrote no layout snapshot, builds, runs the ratchet, then packs and smokes the tarball"; "L3.CI4: every remote `uses:` is a full commit sha with its release tag in a trailing comment, and ci.yml holds no local `uses:`". A sha-shaped local reference passes the SHA_PINNED match, so inside the L3.CI4 general test the dedicated no-local assertion on the parsed steps (line 365) is the one that fails. | sha256 matched |
| L3.CI4e (added) | no local uses anywhere in the text | `.github/workflows/ci.yml` | `      - run: node scripts/consumer-smoke.mjs ./synapsium-labs-docserver-0.1.0.tgz ⏎ ` → `      - run: node scripts/consumer-smoke.mjs ./synapsium-labs-docserver-0.1.0.tgz ⏎   oth…` | 1 | `test/ci-workflow.test.ts`: 2 failed \| 29 passed (31). "is the only job"; "L3.CI4: every remote `uses:` is a full commit sha with its release tag in a trailing comment, and ci.yml holds no local `uses:`". A local `uses:` in a second job, written flow-style, is outside the test job's steps and outside the line filter, so inside the L3.CI4 general test only the text check (line 366) fails. | sha256 matched |

```json
[
  {
    "id": "L3.CI4a",
    "guard": "checkout pinned by commit sha",
    "file": ".github/workflows/ci.yml",
    "old": "actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4.4.0",
    "new": "actions/checkout@v4",
    "tests": "test/ci-workflow.test.ts",
    "command": "ulimit -u 3208; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
    "threads": 1708,
    "exit": 1,
    "result": "3 failed | 28 passed (31)",
    "failed": [
      "checks out full history, keeps no credentials in the workspace, sets up the matrix Node with the npm cache, and caches the browsers, each action pinned by commit sha",
      "L3.CI4: every remote `uses:` is a full commit sha with its release tag in a trailing comment, and ci.yml holds no local `uses:`",
      "L3.CI4: each pin names the release its tag comment names"
    ],
    "assertions": [
      "expected [ …(3) ] to deeply equal [ [ …(2) ], [ …(2) ], [ …(2) ] ]",
      "- uses: actions/checkout@v4: expected null not to be null",
      "expected 'name: ci\\n\\n# Typecheck, test and bui…' to contain 'uses: actions/checkout@11d5960a326750…'"
    ],
    "at": [
      "test/ci-workflow.test.ts:180",
      "test/ci-workflow.test.ts:362",
      "test/ci-workflow.test.ts:370"
    ],
    "restored_sha256": "cf077619b87d88801a8b2939f9630bc8b5b7fb8a5981d420e2042903d0e7e0b9",
    "restore_matches": true
  },
  {
    "id": "L3.CI4b",
    "guard": "a sha pin carries its tag comment",
    "file": ".github/workflows/ci.yml",
    "old": "actions/cache@55cc8345863c7cc4c66a329aec7e433d2d1c52a9 # v6.1.0",
    "new": "actions/cache@55cc8345863c7cc4c66a329aec7e433d2d1c52a9",
    "tests": "test/ci-workflow.test.ts",
    "command": "ulimit -u 3204; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
    "threads": 1704,
    "exit": 1,
    "result": "2 failed | 29 passed (31)",
    "failed": [
      "L3.CI4: every remote `uses:` is a full commit sha with its release tag in a trailing comment, and ci.yml holds no local `uses:`",
      "L3.CI4: each pin names the release its tag comment names"
    ],
    "assertions": [
      "- uses: actions/cache@55cc8345863c7cc4c66a329aec7e433d2d1c52a9: expected null not to be null",
      "expected 'name: ci\\n\\n# Typecheck, test and bui…' to contain 'uses: actions/cache@55cc8345863c7cc4c…'"
    ],
    "at": [
      "test/ci-workflow.test.ts:362",
      "test/ci-workflow.test.ts:372"
    ],
    "restored_sha256": "cf077619b87d88801a8b2939f9630bc8b5b7fb8a5981d420e2042903d0e7e0b9",
    "restore_matches": true
  },
  {
    "id": "L3.CI4c",
    "guard": "no local uses",
    "note": "This reference has no `@`, so inside the L3.CI4 general test the SHA_PINNED match (line 363) fails first and the no-local assertions after it are not reached; L3.CI4d and L3.CI4e measure those.",
    "file": ".github/workflows/ci.yml",
    "old": "      - run: npm run typecheck\n",
    "new": "      - uses: ./.github/actions/typecheck # v1.0.0\n      - run: npm run typecheck\n",
    "tests": "test/ci-workflow.test.ts",
    "command": "ulimit -u 3233; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
    "threads": 1733,
    "exit": 1,
    "result": "3 failed | 28 passed (31)",
    "failed": [
      "checks out full history, keeps no credentials in the workspace, sets up the matrix Node with the npm cache, and caches the browsers, each action pinned by commit sha",
      "installs from the lock, reads the playwright-core pin, restores the browser cache, configures apt, installs the browsers, typechecks, tests, checks the tests wrote no layout snapshot, builds, runs the ratchet, then packs and smokes the tarball",
      "L3.CI4: every remote `uses:` is a full commit sha with its release tag in a trailing comment, and ci.yml holds no local `uses:`"
    ],
    "assertions": [
      "expected [ [ …(2) ], [ …(2) ], [ …(2) ], …(1) ] to deeply equal [ [ …(2) ], [ …(2) ], [ …(2) ] ]",
      "expected [ 'actions/checkout', …(14) ] to deeply equal [ 'actions/checkout', …(13) ]",
      "- uses: ./.github/actions/typecheck # v1.0.0: expected './.github/actions/typecheck' to match /^[A-Za-z0-9_.-]+\\/…/[A-Za-z0-9_.-]+(?:\\"
    ],
    "at": [
      "test/ci-workflow.test.ts:180",
      "test/ci-workflow.test.ts:191",
      "test/ci-workflow.test.ts:363"
    ],
    "restored_sha256": "cf077619b87d88801a8b2939f9630bc8b5b7fb8a5981d420e2042903d0e7e0b9",
    "restore_matches": true
  },
  {
    "id": "L3.CI4d",
    "guard": "no local uses, even sha-shaped",
    "note": "A sha-shaped local reference passes the SHA_PINNED match, so inside the L3.CI4 general test the dedicated no-local assertion on the parsed steps (line 365) is the one that fails.",
    "file": ".github/workflows/ci.yml",
    "old": "      - run: npm run typecheck\n",
    "new": "      - uses: ./.github/actions/x@aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa # v1.0.0\n      - run: npm run typecheck\n",
    "tests": "test/ci-workflow.test.ts",
    "command": "ulimit -u 3258; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
    "threads": 1758,
    "exit": 1,
    "result": "3 failed | 28 passed (31)",
    "failed": [
      "checks out full history, keeps no credentials in the workspace, sets up the matrix Node with the npm cache, and caches the browsers, each action pinned by commit sha",
      "installs from the lock, reads the playwright-core pin, restores the browser cache, configures apt, installs the browsers, typechecks, tests, checks the tests wrote no layout snapshot, builds, runs the ratchet, then packs and smokes the tarball",
      "L3.CI4: every remote `uses:` is a full commit sha with its release tag in a trailing comment, and ci.yml holds no local `uses:`"
    ],
    "assertions": [
      "expected [ [ …(2) ], [ …(2) ], [ …(2) ], …(1) ] to deeply equal [ [ …(2) ], [ …(2) ], [ …(2) ] ]",
      "expected [ 'actions/checkout', …(14) ] to deeply equal [ 'actions/checkout', …(13) ]",
      "expected [ Array(1) ] to deeply equal []"
    ],
    "at": [
      "test/ci-workflow.test.ts:180",
      "test/ci-workflow.test.ts:191",
      "test/ci-workflow.test.ts:365"
    ],
    "restored_sha256": "cf077619b87d88801a8b2939f9630bc8b5b7fb8a5981d420e2042903d0e7e0b9",
    "restore_matches": true
  },
  {
    "id": "L3.CI4e",
    "guard": "no local uses anywhere in the text",
    "note": "A local `uses:` in a second job, written flow-style, is outside the test job's steps and outside the line filter, so inside the L3.CI4 general test only the text check (line 366) fails.",
    "file": ".github/workflows/ci.yml",
    "old": "      - run: node scripts/consumer-smoke.mjs ./synapsium-labs-docserver-0.1.0.tgz\n",
    "new": "      - run: node scripts/consumer-smoke.mjs ./synapsium-labs-docserver-0.1.0.tgz\n  other:\n    runs-on: ubuntu-latest\n    steps: [{ uses: ./.github/actions/x }]\n",
    "tests": "test/ci-workflow.test.ts",
    "command": "ulimit -u 3247; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
    "threads": 1747,
    "exit": 1,
    "result": "2 failed | 29 passed (31)",
    "failed": [
      "is the only job",
      "L3.CI4: every remote `uses:` is a full commit sha with its release tag in a trailing comment, and ci.yml holds no local `uses:`"
    ],
    "assertions": [
      "expected [ 'test', 'other' ] to deeply equal [ 'test' ]",
      "expected 'name: ci\\n\\n# Typecheck, test and bui…' not to match /uses:\\s*['\"]?\\.\\//"
    ],
    "at": [
      "test/ci-workflow.test.ts:168",
      "test/ci-workflow.test.ts:366"
    ],
    "restored_sha256": "cf077619b87d88801a8b2939f9630bc8b5b7fb8a5981d420e2042903d0e7e0b9",
    "restore_matches": true
  }
]
```

## The ratchet step's command (an existing pin, restored in the fix round)

| Row | Guard | File | Change | Exit | Red (tests in the named file) | Restore |
|---|---|---|---|---|---|---|
| L3.R1 (added) | the ratchet reads the computed base | `.github/workflows/ci.yml` | `node scripts/ratchet.mjs --base "${BASE}"` → `node scripts/ratchet.mjs --base origin/main` | 1 | `test/ci-workflow.test.ts`: 1 failed \| 30 passed (31). "the ratchet reads from the base branch on a pull request, the previous tip on a push, main by hand". Before the fix round the step-order test compared this step by its name only, and this row stayed green. | sha256 matched |
| L3.R2 (added) | the ratchet result fails the step | `.github/workflows/ci.yml` | `node scripts/ratchet.mjs --base "${BASE}"` → `node scripts/ratchet.mjs --base "${BASE}" \|\| true` | 1 | `test/ci-workflow.test.ts`: 1 failed \| 30 passed (31). "the ratchet reads from the base branch on a pull request, the previous tip on a push, main by hand". Before the fix round the step-order test compared this step by its name only, and this row stayed green. | sha256 matched |

```json
[
  {
    "id": "L3.R1",
    "guard": "the ratchet reads the computed base",
    "note": "Before the fix round the step-order test compared this step by its name only, and this row stayed green.",
    "file": ".github/workflows/ci.yml",
    "old": "node scripts/ratchet.mjs --base \"${BASE}\"",
    "new": "node scripts/ratchet.mjs --base origin/main",
    "tests": "test/ci-workflow.test.ts",
    "command": "ulimit -u 3232; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
    "threads": 1732,
    "exit": 1,
    "result": "1 failed | 30 passed (31)",
    "failed": [
      "the ratchet reads from the base branch on a pull request, the previous tip on a push, main by hand"
    ],
    "assertions": [
      "expected 'node scripts/ratchet.mjs --base origi…' to be 'node scripts/ratchet.mjs --base \"${BA…' // Object.is equality"
    ],
    "at": [
      "test/ci-workflow.test.ts:215"
    ],
    "restored_sha256": "cf077619b87d88801a8b2939f9630bc8b5b7fb8a5981d420e2042903d0e7e0b9",
    "restore_matches": true
  },
  {
    "id": "L3.R2",
    "guard": "the ratchet result fails the step",
    "note": "Before the fix round the step-order test compared this step by its name only, and this row stayed green.",
    "file": ".github/workflows/ci.yml",
    "old": "node scripts/ratchet.mjs --base \"${BASE}\"",
    "new": "node scripts/ratchet.mjs --base \"${BASE}\" || true",
    "tests": "test/ci-workflow.test.ts",
    "command": "ulimit -u 3224; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
    "threads": 1724,
    "exit": 1,
    "result": "1 failed | 30 passed (31)",
    "failed": [
      "the ratchet reads from the base branch on a pull request, the previous tip on a push, main by hand"
    ],
    "assertions": [
      "expected 'node scripts/ratchet.mjs --base \"${BA…' to be 'node scripts/ratchet.mjs --base \"${BA…' // Object.is equality"
    ],
    "at": [
      "test/ci-workflow.test.ts:215"
    ],
    "restored_sha256": "cf077619b87d88801a8b2939f9630bc8b5b7fb8a5981d420e2042903d0e7e0b9",
    "restore_matches": true
  }
]
```

## Coordinator addition: the dpkg lock timeout

After the fix round the coordinator added `DPkg::Lock::Timeout "300";` to the apt step, so the install's second attempt waits for an `apt-get` that the first attempt's `timeout` left running under `sudo`, instead of failing at once on the dpkg lock. The test's expected lines gained the value first: against the fix round's `ci.yml` (sha256 `cf077619…`) L3.CI1 failed (1 failed | 30 passed (31), an assertion), then passed with the line added (`ci.yml` sha256 `cece7638…`; with `test/public-ready.test.ts`, 43 passed).

```json
[
  {
    "id": "L3.CI1d",
    "guard": "the dpkg lock timeout",
    "file": ".github/workflows/ci.yml",
    "old": "            'DPkg::Lock::Timeout \"300\";' \\",
    "new": "(deleted)",
    "tests": "test/ci-workflow.test.ts",
    "command": "ulimit -u 3313; timeout -k 10 600 ./node_modules/.bin/vitest run --project unit test/ci-workflow.test.ts --maxWorkers=2",
    "threads": 1813,
    "exit": 1,
    "result": "1 failed | 30 passed (31)",
    "failed": [
      "L3.CI1: an apt step before the install writes the retries and the two timeouts to its own apt configuration file"
    ],
    "restored_sha256": "cece763859ab7cc14582562dfbb778ede797d8a7f2cc327cfe9c4cfcdb8de694",
    "restore_matches": true
  }
]
```

The earlier rows were measured on `ci.yml` `cf077619…`. The only later change is this one added line, which none of their edits touch.
