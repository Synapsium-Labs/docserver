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

## Follow-up: apt archive cache and the leftover apt-get

**What failed.** On PR #48 (run 40443380148, Node 22) the browser cache hit, but `--with-deps` downloaded the system libraries' `.deb` files again, from a mirror that stalled. Attempt 1 reached its 10-minute `timeout`; its `sudo apt-get` (pid 2606) outlived that timeout, because a `timeout` running as the runner cannot signal a root process, and kept the dpkg lock. Attempt 2 then waited the full 300 s `DPkg::Lock::Timeout` and failed with "Unable to acquire the dpkg frontend lock".

> The fix round at the end of this section changes four things described below. The directory is now the fixed `/var/cache/docserver-apt-archives`, made by the apt step, which now runs before the two cache steps. The apt key now rolls weekly, with a fallback. And `dpkg --configure -a` is now bounded and counted in the step budget, a run the budget sentence below left out.

**What changed** (`.github/workflows/ci.yml`; every guard above stays, and so do its tests):

- The version step also names apt's archive directory, `$RUNNER_TEMP/docserver-apt-archives` (output `archives`), and refuses one that is not an absolute path of letters, digits, `.`, `_`, `-` and `/`, so it can never end the quoted value in apt's configuration.
- A second `actions/cache` step, the same sha-pinned v6.1.0 as the browser cache, restores and saves that directory before the apt step and the install, keyed `apt-archives-<runner OS>-<arch>-<OS release>-playwright-core-<version>` with no fallback key; the browser cache keeps its own key and its entries.
- The apt step, given the directory as `ARCHIVES`, checks it again, makes `$ARCHIVES/partial`, and adds two lines to `/etc/apt/apt.conf.d/80-docserver-ci`: `APT::Keep-Downloaded-Packages "true";` and `Dir::Cache::Archives "<dir>/";`. So a warm job finds every `.deb` it needs and downloads none of them.
- Right after the install, a step hands the directory back to the runner (`sudo chown -R` to the runner's uid and gid, then `chmod -R u+rwX`). apt writes there as root and leaves its lock `0640` and `partial/` `0700` to its download user, which the cache's save, running as the runner, could not read.
- Before attempt 2 only, the install step runs `sudo pkill -TERM -x 'apt-get|dpkg'`, waits 5 s, runs `sudo pkill -KILL -x 'apt-get|dpkg'` (each `|| true`, since pkill answers 1 when nothing matched), then `sudo dpkg --configure -a`. A failure there is reported as a warning, and attempt 2 still runs and decides the step. The step budget still fits: 2 × (600 + 30) s + 5 s = 1,265 s, under the 22-minute (1,320 s) step limit, and the CI2 budget row now counts the wait.

**Tests first.** The follow-up's tests (rows L3.CI5 to L3.CI7, and the widened existing rows) were written before `ci.yml` changed. Against the unchanged file (`ci.yml` sha256 `cece7638…`) they ran 19 failed | 26 passed (45), every failure an assertion. With the change they ran 45 passed (45). The stand-ins that keep the step rows off real processes are fakes `pkill` (it signals nothing), `sleep` and `dpkg`, first on PATH beside `sudo`, `tee` and `npx`. Each records its call, `sudo` included, in one ordered log. The apt, readable and install steps run in a scratch directory, so a mutant that lets a relative path through writes nothing into the worktree.

**Method** as at the top of this file, one row at a time on the final code: `.github/workflows/ci.yml` sha256 `bd900ed534be4a3cecf0cc530503ee5a0f7d36e0afebc409182478f8d52c22c9`, `test/ci-workflow.test.ts` sha256 `d060058abad9af23e24793b7fde8deebdd7229c719ea779384cf762d95d1ad39`. The 33 new rows and the 25 re-measured ones were all red (exit 1), through assertion failures only, and all 58 restores matched the saved sha256. A first measurement had L3.CI5b and L3.CI5c red through an `ENOENT` thrown by `statSync`, not an assertion. They did not count: the check became an assertion (`statSync(…, { throwIfNoEntry: false })?.isDirectory()`), the file's sha256 above is the one after that change, and every row in this section was measured on it.

The rows the coordinator named: the archive directory in the apt file (L3.CI5a) and its creation (L3.CI5b, L3.CI5c); the cache step's path (L3.CI6e), key (L3.CI6a to L3.CI6c, L3.CI6g, L3.CI6h) and place before the install (L3.CI6d); the cleanup before attempt 2 only (L3.CI7a, L3.CI7l). The others are added guards.

### L3.CI5: apt's archive directory, in the apt configuration file and made before the install

| Row | Guard | File | Change | Exit | Red (tests in the named file) | Restore |
|---|---|---|---|---|---|---|
| L3.CI5a | the archive directory in the apt configuration file | `.github/workflows/ci.yml` | ` "Dir::Cache::Archives \"$ARCHIVES/\";"` → (deleted) | 1 | `test/ci-workflow.test.ts`: 2 failed \| 43 passed (45). "L3.CI1: an apt step before the install writes the retries and the two timeouts to its own apt configuration file"; "L3.CI5: the apt step points apt's archive cache at that directory and makes its partial/ subdirectory, which apt needs before it downloads". | sha256 matched |
| L3.CI5b | partial/ made before the install | `.github/workflows/ci.yml` | `          mkdir -p "$ARCHIVES/partial"⏎ ` → (deleted) | 1 | `test/ci-workflow.test.ts`: 1 failed \| 44 passed (45). "L3.CI5: the apt step points apt's archive cache at that directory and makes its partial/ subdirectory, which apt needs before it downloads". | sha256 matched |
| L3.CI5c | partial/ itself, not only the archive directory | `.github/workflows/ci.yml` | `mkdir -p "$ARCHIVES/partial"` → `mkdir -p "$ARCHIVES"` | 1 | `test/ci-workflow.test.ts`: 1 failed \| 44 passed (45). "L3.CI5: the apt step points apt's archive cache at that directory and makes its partial/ subdirectory, which apt needs before it downloads". | sha256 matched |
| L3.CI5d | apt-get keeps what it downloads | `.github/workflows/ci.yml` | ` 'APT::Keep-Downloaded-Packages "true";'` → (deleted) | 1 | `test/ci-workflow.test.ts`: 2 failed \| 43 passed (45). "L3.CI1: an apt step before the install writes the retries and the two timeouts to its own apt configuration file"; "L3.CI5: the apt step points apt's archive cache at that directory and makes its partial/ subdirectory, which apt needs before it downloads". | sha256 matched |
| L3.CI5e | the apt step refuses a directory apt's configuration cannot hold | `.github/workflows/ci.yml` | `          [[ "${ARCHIVES:?}" =~ ^/[A-Za-z0-9._/-]+$ ]]⏎ ` → (deleted) | 1 | `test/ci-workflow.test.ts`: 2 failed \| 43 passed (45). "L3.CI5: the apt step fails, and writes no apt configuration, given a relative one"; "L3.CI5: the apt step fails, and writes no apt configuration, given one holding a double quote, which would end the configuration value". | sha256 matched |
| L3.CI5f | the apt step is given the version step's directory | `.github/workflows/ci.yml` | `      - name: apt retries and timeouts⏎         env:⏎           ARCHIVES: ${{ steps.playwr…` → `      - name: apt retries and timeouts⏎ ` | 1 | `test/ci-workflow.test.ts`: 2 failed \| 43 passed (45). "the ratchet reads from the base branch on a pull request, the previous tip on a push, main by hand"; "L3.CI5: the apt step points apt's archive cache at that directory and makes its partial/ subdirectory, which apt needs before it downloads". | sha256 matched |
| L3.CI5g | the version step outputs the archive directory | `.github/workflows/ci.yml` | `"browsers=$browsers" "archives=$archives"` → `"browsers=$browsers"` | 1 | `test/ci-workflow.test.ts`: 3 failed \| 42 passed (45). "L3.CI3: the version step reads exactly the playwright-core pin from package.json, so the key embeds it, and names the directory playwright-core installs into with XDG_CACHE_HOME unset: .cache/ms-playwright under HOME"; "L3.CI3: the version step reads exactly the playwright-core pin from package.json, so the key embeds it, and names the directory playwright-core installs into with XDG_CACHE_HOME set: ms-playwright under it"; "L3.CI5: the version step names apt's archive directory under the runner's temporary directory, and fails, writing no output, without one or with one apt's configuration cannot quote". | sha256 matched |
| L3.CI5h | the version step refuses a directory apt's configuration cannot hold | `.github/workflows/ci.yml` | `          [[ "$archives" =~ ^/[A-Za-z0-9._/-]+$ ]]⏎ ` → (deleted) | 1 | `test/ci-workflow.test.ts`: 1 failed \| 44 passed (45). "L3.CI5: the version step names apt's archive directory under the runner's temporary directory, and fails, writing no output, without one or with one apt's configuration cannot quote". | sha256 matched |
| L3.CI5i | the directory is under the runner's temporary directory | `.github/workflows/ci.yml` | `archives="${RUNNER_TEMP:?}/docserver-apt-archives"` → `archives="${HOME:?}/docserver-apt-archives"` | 1 | `test/ci-workflow.test.ts`: 3 failed \| 42 passed (45). "L3.CI3: the version step reads exactly the playwright-core pin from package.json, so the key embeds it, and names the directory playwright-core installs into with XDG_CACHE_HOME unset: .cache/ms-playwright under HOME"; "L3.CI3: the version step reads exactly the playwright-core pin from package.json, so the key embeds it, and names the directory playwright-core installs into with XDG_CACHE_HOME set: ms-playwright under it"; "L3.CI5: the version step names apt's archive directory under the runner's temporary directory, and fails, writing no output, without one or with one apt's configuration cannot quote". | sha256 matched |

```json
[
  {
    "id": "L3.CI5a",
    "guard": "the archive directory in the apt configuration file",
    "file": ".github/workflows/ci.yml",
    "old": " \"Dir::Cache::Archives \\\"$ARCHIVES/\\\";\"",
    "new": "",
    "tests": "test/ci-workflow.test.ts",
    "command": "ulimit -u 3497; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
    "threads": 1997,
    "exit": 1,
    "result": "2 failed | 43 passed (45)",
    "failed": [
      "L3.CI1: an apt step before the install writes the retries and the two timeouts to its own apt configuration file",
      "L3.CI5: the apt step points apt's archive cache at that directory and makes its partial/ subdirectory, which apt needs before it downloads"
    ],
    "assertions": [
      "expected 'Acquire::Retries \"5\";\\nAcquire::http:…' to be 'Acquire::Retries \"5\";\\nAcquire::http:…' // Object.is equality",
      "expected [] to deeply equal [ Array(1) ]"
    ],
    "at": [
      "test/ci-workflow.test.ts:350",
      "test/ci-workflow.test.ts:513"
    ],
    "restored_sha256": "bd900ed534be4a3cecf0cc530503ee5a0f7d36e0afebc409182478f8d52c22c9",
    "restore_matches": true
  },
  {
    "id": "L3.CI5b",
    "guard": "partial/ made before the install",
    "file": ".github/workflows/ci.yml",
    "old": "          mkdir -p \"$ARCHIVES/partial\"\n",
    "new": "",
    "tests": "test/ci-workflow.test.ts",
    "command": "ulimit -u 3498; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
    "threads": 1998,
    "exit": 1,
    "result": "1 failed | 44 passed (45)",
    "failed": [
      "L3.CI5: the apt step points apt's archive cache at that directory and makes its partial/ subdirectory, which apt needs before it downloads"
    ],
    "assertions": [
      "expected undefined to be true // Object.is equality"
    ],
    "at": [
      "test/ci-workflow.test.ts:511"
    ],
    "restored_sha256": "bd900ed534be4a3cecf0cc530503ee5a0f7d36e0afebc409182478f8d52c22c9",
    "restore_matches": true
  },
  {
    "id": "L3.CI5c",
    "guard": "partial/ itself, not only the archive directory",
    "file": ".github/workflows/ci.yml",
    "old": "mkdir -p \"$ARCHIVES/partial\"",
    "new": "mkdir -p \"$ARCHIVES\"",
    "tests": "test/ci-workflow.test.ts",
    "command": "ulimit -u 3478; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
    "threads": 1978,
    "exit": 1,
    "result": "1 failed | 44 passed (45)",
    "failed": [
      "L3.CI5: the apt step points apt's archive cache at that directory and makes its partial/ subdirectory, which apt needs before it downloads"
    ],
    "assertions": [
      "expected undefined to be true // Object.is equality"
    ],
    "at": [
      "test/ci-workflow.test.ts:511"
    ],
    "restored_sha256": "bd900ed534be4a3cecf0cc530503ee5a0f7d36e0afebc409182478f8d52c22c9",
    "restore_matches": true
  },
  {
    "id": "L3.CI5d",
    "guard": "apt-get keeps what it downloads",
    "file": ".github/workflows/ci.yml",
    "old": " 'APT::Keep-Downloaded-Packages \"true\";'",
    "new": "",
    "tests": "test/ci-workflow.test.ts",
    "command": "ulimit -u 3471; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
    "threads": 1971,
    "exit": 1,
    "result": "2 failed | 43 passed (45)",
    "failed": [
      "L3.CI1: an apt step before the install writes the retries and the two timeouts to its own apt configuration file",
      "L3.CI5: the apt step points apt's archive cache at that directory and makes its partial/ subdirectory, which apt needs before it downloads"
    ],
    "assertions": [
      "expected 'Acquire::Retries \"5\";\\nAcquire::http:…' to be 'Acquire::Retries \"5\";\\nAcquire::http:…' // Object.is equality",
      "expected [ 'Acquire::Retries \"5\";', …(5) ] to include 'APT::Keep-Downloaded-Packages \"true\";'"
    ],
    "at": [
      "test/ci-workflow.test.ts:350",
      "test/ci-workflow.test.ts:514"
    ],
    "restored_sha256": "bd900ed534be4a3cecf0cc530503ee5a0f7d36e0afebc409182478f8d52c22c9",
    "restore_matches": true
  },
  {
    "id": "L3.CI5e",
    "guard": "the apt step refuses a directory apt's configuration cannot hold",
    "file": ".github/workflows/ci.yml",
    "old": "          [[ \"${ARCHIVES:?}\" =~ ^/[A-Za-z0-9._/-]+$ ]]\n",
    "new": "",
    "tests": "test/ci-workflow.test.ts",
    "command": "ulimit -u 3512; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
    "threads": 2012,
    "exit": 1,
    "result": "2 failed | 43 passed (45)",
    "failed": [
      "L3.CI5: the apt step fails, and writes no apt configuration, given a relative one",
      "L3.CI5: the apt step fails, and writes no apt configuration, given one holding a double quote, which would end the configuration value"
    ],
    "assertions": [
      "expected +0 not to be +0 // Object.is equality"
    ],
    "at": [
      "test/ci-workflow.test.ts:527"
    ],
    "restored_sha256": "bd900ed534be4a3cecf0cc530503ee5a0f7d36e0afebc409182478f8d52c22c9",
    "restore_matches": true
  },
  {
    "id": "L3.CI5f",
    "guard": "the apt step is given the version step's directory",
    "file": ".github/workflows/ci.yml",
    "old": "      - name: apt retries and timeouts\n        env:\n          ARCHIVES: ${{ steps.playwright.outputs.archives }}\n",
    "new": "      - name: apt retries and timeouts\n",
    "tests": "test/ci-workflow.test.ts",
    "command": "ulimit -u 3442; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
    "threads": 1942,
    "exit": 1,
    "result": "2 failed | 43 passed (45)",
    "failed": [
      "the ratchet reads from the base branch on a pull request, the previous tip on a push, main by hand",
      "L3.CI5: the apt step points apt's archive cache at that directory and makes its partial/ subdirectory, which apt needs before it downloads"
    ],
    "assertions": [
      "expected [ [ …(2) ], [ 'ratchet', …(1) ] ] to deeply equal [ [ …(2) ], [ …(2) ], …(1) ]",
      "expected undefined to deeply equal { Object (ARCHIVES) }"
    ],
    "at": [
      "test/ci-workflow.test.ts:311",
      "test/ci-workflow.test.ts:503"
    ],
    "restored_sha256": "bd900ed534be4a3cecf0cc530503ee5a0f7d36e0afebc409182478f8d52c22c9",
    "restore_matches": true
  },
  {
    "id": "L3.CI5g",
    "guard": "the version step outputs the archive directory",
    "file": ".github/workflows/ci.yml",
    "old": "\"browsers=$browsers\" \"archives=$archives\"",
    "new": "\"browsers=$browsers\"",
    "tests": "test/ci-workflow.test.ts",
    "command": "ulimit -u 3486; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
    "threads": 1986,
    "exit": 1,
    "result": "3 failed | 42 passed (45)",
    "failed": [
      "L3.CI3: the version step reads exactly the playwright-core pin from package.json, so the key embeds it, and names the directory playwright-core installs into with XDG_CACHE_HOME unset: .cache/ms-playwright under HOME",
      "L3.CI3: the version step reads exactly the playwright-core pin from package.json, so the key embeds it, and names the directory playwright-core installs into with XDG_CACHE_HOME set: ms-playwright under it",
      "L3.CI5: the version step names apt's archive directory under the runner's temporary directory, and fails, writing no output, without one or with one apt's configuration cannot quote"
    ],
    "assertions": [
      "expected 'version=1.63.0\\nos=ubuntu24.04\\nbrows…' to be 'version=1.63.0\\nos=ubuntu24.04\\nbrows…' // Object.is equality",
      "expected 'version=1.63.0\\nos=ubuntu24.04\\nbrows…' to be 'version=1.63.0\\nos=ubuntu24.04\\nbrows…' // Object.is equality",
      "/tmp/docserver-ci-steps-JekaZ5/runner-temp-LDZ5R1: expected [ 'version=1.63.0', …(2) ] to deeply equal ArrayContaining{…}"
    ],
    "at": [
      "test/ci-workflow.test.ts:410",
      "test/ci-workflow.test.ts:498"
    ],
    "restored_sha256": "bd900ed534be4a3cecf0cc530503ee5a0f7d36e0afebc409182478f8d52c22c9",
    "restore_matches": true
  },
  {
    "id": "L3.CI5h",
    "guard": "the version step refuses a directory apt's configuration cannot hold",
    "file": ".github/workflows/ci.yml",
    "old": "          [[ \"$archives\" =~ ^/[A-Za-z0-9._/-]+$ ]]\n",
    "new": "",
    "tests": "test/ci-workflow.test.ts",
    "command": "ulimit -u 3500; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
    "threads": 2000,
    "exit": 1,
    "result": "1 failed | 44 passed (45)",
    "failed": [
      "L3.CI5: the version step names apt's archive directory under the runner's temporary directory, and fails, writing no output, without one or with one apt's configuration cannot quote"
    ],
    "assertions": [
      "/tmp/docserver-ci-steps-0C8K0E/a \"quoted\" temp: : expected true to be false // Object.is equality"
    ],
    "at": [
      "test/ci-workflow.test.ts:496"
    ],
    "restored_sha256": "bd900ed534be4a3cecf0cc530503ee5a0f7d36e0afebc409182478f8d52c22c9",
    "restore_matches": true
  },
  {
    "id": "L3.CI5i",
    "guard": "the directory is under the runner's temporary directory",
    "file": ".github/workflows/ci.yml",
    "old": "archives=\"${RUNNER_TEMP:?}/docserver-apt-archives\"",
    "new": "archives=\"${HOME:?}/docserver-apt-archives\"",
    "tests": "test/ci-workflow.test.ts",
    "command": "ulimit -u 3466; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
    "threads": 1966,
    "exit": 1,
    "result": "3 failed | 42 passed (45)",
    "failed": [
      "L3.CI3: the version step reads exactly the playwright-core pin from package.json, so the key embeds it, and names the directory playwright-core installs into with XDG_CACHE_HOME unset: .cache/ms-playwright under HOME",
      "L3.CI3: the version step reads exactly the playwright-core pin from package.json, so the key embeds it, and names the directory playwright-core installs into with XDG_CACHE_HOME set: ms-playwright under it",
      "L3.CI5: the version step names apt's archive directory under the runner's temporary directory, and fails, writing no output, without one or with one apt's configuration cannot quote"
    ],
    "assertions": [
      "expected 'version=1.63.0\\nos=ubuntu24.04\\nbrows…' to be 'version=1.63.0\\nos=ubuntu24.04\\nbrows…' // Object.is equality",
      "expected 'version=1.63.0\\nos=ubuntu24.04\\nbrows…' to be 'version=1.63.0\\nos=ubuntu24.04\\nbrows…' // Object.is equality",
      "/tmp/docserver-ci-steps-uJeKtT/runner-temp-tuBmdN: expected [ 'version=1.63.0', …(3) ] to deeply equal ArrayContaining{…}"
    ],
    "at": [
      "test/ci-workflow.test.ts:410",
      "test/ci-workflow.test.ts:498"
    ],
    "restored_sha256": "bd900ed534be4a3cecf0cc530503ee5a0f7d36e0afebc409182478f8d52c22c9",
    "restore_matches": true
  }
]
```

### L3.CI6: the apt archive cache step, its key and its place, and the files readable for its save

| Row | Guard | File | Change | Exit | Red (tests in the named file) | Restore |
|---|---|---|---|---|---|---|
| L3.CI6a | the apt cache key embeds the playwright-core version | `.github/workflows/ci.yml` | `apt-archives-${{ runner.os }}-${{ runner.arch }}-${{ steps.playwright.outputs.os }}-playwr…` → `apt-archives-${{ runner.os }}-${{ runner.arch }}-${{ steps.playwright.outputs.os }}` | 1 | `test/ci-workflow.test.ts`: 2 failed \| 43 passed (45). "checks out full history, keeps no credentials in the workspace, sets up the matrix Node with the npm cache, and caches the browsers, each action pinned by commit sha"; "L3.CI6: a second cache step, with the browser cache's pinned action, restores and saves apt's archive directory before the apt step and the install, keyed on the runner OS, architecture, OS release and the pinned playwright-core, with no fallback key". | sha256 matched |
| L3.CI6b | the apt cache key embeds the OS release | `.github/workflows/ci.yml` | `apt-archives-${{ runner.os }}-${{ runner.arch }}-${{ steps.playwright.outputs.os }}-playwr…` → `apt-archives-${{ runner.os }}-${{ runner.arch }}-playwright-core-${{ steps.playwright.outp…` | 1 | `test/ci-workflow.test.ts`: 2 failed \| 43 passed (45). "checks out full history, keeps no credentials in the workspace, sets up the matrix Node with the npm cache, and caches the browsers, each action pinned by commit sha"; "L3.CI6: a second cache step, with the browser cache's pinned action, restores and saves apt's archive directory before the apt step and the install, keyed on the runner OS, architecture, OS release and the pinned playwright-core, with no fallback key". | sha256 matched |
| L3.CI6c | the apt cache key embeds the architecture | `.github/workflows/ci.yml` | `apt-archives-${{ runner.os }}-${{ runner.arch }}-${{ steps.playwright.outputs.os }}-playwr…` → `apt-archives-${{ runner.os }}-${{ steps.playwright.outputs.os }}-playwright-core-${{ steps…` | 1 | `test/ci-workflow.test.ts`: 2 failed \| 43 passed (45). "checks out full history, keeps no credentials in the workspace, sets up the matrix Node with the npm cache, and caches the browsers, each action pinned by commit sha"; "L3.CI6: a second cache step, with the browser cache's pinned action, restores and saves apt's archive directory before the apt step and the install, keyed on the runner OS, architecture, OS release and the pinned playwright-core, with no fallback key". | sha256 matched |
| L3.CI6d | the apt cache restores before the install | `.github/workflows/ci.yml` | `      - uses: actions/cache@55cc8345863c7cc4c66a329aec7e433d2d1c52a9 #…` moved after `            echo "::warning::browser install attempt ${attem…` | 1 | `test/ci-workflow.test.ts`: 3 failed \| 42 passed (45). "installs from the lock, reads the playwright-core pin, restores the browser cache and the apt archive cache, configures apt, installs the browsers, makes the apt archive cache readable, typechecks, tests, checks the tests wrote no layout snapshot, builds, runs the ratchet, then packs and smokes the tarball"; "L3.CI6: a second cache step, with the browser cache's pinned action, restores and saves apt's archive directory before the apt step and the install, keyed on the runner OS, architecture, OS release and the pinned playwright-core, with no fallback key"; "L3.CI6: right after the install, a step hands apt's archive directory back to the runner and makes everything in it readable, so the cache's save can read what apt wrote as root". | sha256 matched |
| L3.CI6e | the apt cache's path is the archive directory | `.github/workflows/ci.yml` | `          path: ${{ steps.playwright.outputs.archives }}⏎           key: apt-` → `          path: /var/cache/apt/archives⏎           key: apt-` | 1 | `test/ci-workflow.test.ts`: 2 failed \| 43 passed (45). "checks out full history, keeps no credentials in the workspace, sets up the matrix Node with the npm cache, and caches the browsers, each action pinned by commit sha"; "L3.CI6: a second cache step, with the browser cache's pinned action, restores and saves apt's archive directory before the apt step and the install, keyed on the runner OS, architecture, OS release and the pinned playwright-core, with no fallback key". | sha256 matched |
| L3.CI6f | the apt cache step exists | `.github/workflows/ci.yml` | `      - uses: actions/cache@55cc8345863c7cc4c66a329aec7e433d2d1c52a9 # v6.1.0⏎         wit…` → (deleted) | 1 | `test/ci-workflow.test.ts`: 3 failed \| 42 passed (45). "checks out full history, keeps no credentials in the workspace, sets up the matrix Node with the npm cache, and caches the browsers, each action pinned by commit sha"; "installs from the lock, reads the playwright-core pin, restores the browser cache and the apt archive cache, configures apt, installs the browsers, makes the apt archive cache readable, typechecks, tests, checks the tests wrote no layout snapshot, builds, runs the ratchet, then packs and smokes the tarball"; "L3.CI6: a second cache step, with the browser cache's pinned action, restores and saves apt's archive directory before the apt step and the install, keyed on the runner OS, architecture, OS release and the pinned playwright-core, with no fallback key". | sha256 matched |
| L3.CI6g | the apt cache has its own key | `.github/workflows/ci.yml` | `          key: apt-archives-${{ runner.os }}-${{ runner.arch }}-${{ steps.playwright.outpu…` → `          key: ms-playwright-${{ runner.os }}-${{ runner.arch }}-${{ steps.playwright.outp…` | 1 | `test/ci-workflow.test.ts`: 2 failed \| 43 passed (45). "checks out full history, keeps no credentials in the workspace, sets up the matrix Node with the npm cache, and caches the browsers, each action pinned by commit sha"; "L3.CI6: a second cache step, with the browser cache's pinned action, restores and saves apt's archive directory before the apt step and the install, keyed on the runner OS, architecture, OS release and the pinned playwright-core, with no fallback key". | sha256 matched |
| L3.CI6h | no fallback key | `.github/workflows/ci.yml` | `          key: apt-archives-${{ runner.os }}-${{ runner.arch }}-${{ steps.playwright.outpu…` → `          key: apt-archives-${{ runner.os }}-${{ runner.arch }}-${{ steps.playwright.outpu…` | 1 | `test/ci-workflow.test.ts`: 2 failed \| 43 passed (45). "checks out full history, keeps no credentials in the workspace, sets up the matrix Node with the npm cache, and caches the browsers, each action pinned by commit sha"; "L3.CI6: a second cache step, with the browser cache's pinned action, restores and saves apt's archive directory before the apt step and the install, keyed on the runner OS, architecture, OS release and the pinned playwright-core, with no fallback key". | sha256 matched |
| L3.CI6i | the readable step exists | `.github/workflows/ci.yml` | `      - name: the apt archive cache is readable for its save⏎         env:⏎           ARCH…` → (deleted) | 1 | `test/ci-workflow.test.ts`: 3 failed \| 42 passed (45). "installs from the lock, reads the playwright-core pin, restores the browser cache and the apt archive cache, configures apt, installs the browsers, makes the apt archive cache readable, typechecks, tests, checks the tests wrote no layout snapshot, builds, runs the ratchet, then packs and smokes the tarball"; "the ratchet reads from the base branch on a pull request, the previous tip on a push, main by hand"; "L3.CI6: right after the install, a step hands apt's archive directory back to the runner and makes everything in it readable, so the cache's save can read what apt wrote as root". | sha256 matched |
| L3.CI6j | the directory is handed back to the runner | `.github/workflows/ci.yml` | `          sudo chown -R "$(id -u):$(id -g)" "${ARCHIVES:?}"⏎ ` → (deleted) | 1 | `test/ci-workflow.test.ts`: 1 failed \| 44 passed (45). "L3.CI6: right after the install, a step hands apt's archive directory back to the runner and makes everything in it readable, so the cache's save can read what apt wrote as root". | sha256 matched |
| L3.CI6k | everything in it is made readable | `.github/workflows/ci.yml` | `          chmod -R u+rwX "$ARCHIVES"⏎ ` → (deleted) | 1 | `test/ci-workflow.test.ts`: 1 failed \| 44 passed (45). "L3.CI6: right after the install, a step hands apt's archive directory back to the runner and makes everything in it readable, so the cache's save can read what apt wrote as root". | sha256 matched |
| L3.CI6l | the readable step runs right after the install | `.github/workflows/ci.yml` | `      - name: the apt archive cache is readable for its save⏎         …` moved after `      - run: npm run build⏎ ` | 1 | `test/ci-workflow.test.ts`: 2 failed \| 43 passed (45). "installs from the lock, reads the playwright-core pin, restores the browser cache and the apt archive cache, configures apt, installs the browsers, makes the apt archive cache readable, typechecks, tests, checks the tests wrote no layout snapshot, builds, runs the ratchet, then packs and smokes the tarball"; "L3.CI6: right after the install, a step hands apt's archive directory back to the runner and makes everything in it readable, so the cache's save can read what apt wrote as root". | sha256 matched |

```json
[
  {
    "id": "L3.CI6a",
    "guard": "the apt cache key embeds the playwright-core version",
    "file": ".github/workflows/ci.yml",
    "old": "apt-archives-${{ runner.os }}-${{ runner.arch }}-${{ steps.playwright.outputs.os }}-playwright-core-${{ steps.playwright.outputs.version }}",
    "new": "apt-archives-${{ runner.os }}-${{ runner.arch }}-${{ steps.playwright.outputs.os }}",
    "tests": "test/ci-workflow.test.ts",
    "command": "ulimit -u 3494; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
    "threads": 1994,
    "exit": 1,
    "result": "2 failed | 43 passed (45)",
    "failed": [
      "checks out full history, keeps no credentials in the workspace, sets up the matrix Node with the npm cache, and caches the browsers, each action pinned by commit sha",
      "L3.CI6: a second cache step, with the browser cache's pinned action, restores and saves apt's archive directory before the apt step and the install, keyed on the runner OS, architecture, OS release and the pinned playwright-core, with no fallback key"
    ],
    "assertions": [
      "expected [ [ …(2) ], [ …(2) ], [ …(2) ], …(1) ] to deeply equal [ [ …(2) ], [ …(2) ], [ …(2) ], …(1) ]",
      "expected { …(2) } to deeply equal { …(2) }"
    ],
    "at": [
      "test/ci-workflow.test.ts:262",
      "test/ci-workflow.test.ts:536"
    ],
    "restored_sha256": "bd900ed534be4a3cecf0cc530503ee5a0f7d36e0afebc409182478f8d52c22c9",
    "restore_matches": true
  },
  {
    "id": "L3.CI6b",
    "guard": "the apt cache key embeds the OS release",
    "file": ".github/workflows/ci.yml",
    "old": "apt-archives-${{ runner.os }}-${{ runner.arch }}-${{ steps.playwright.outputs.os }}-playwright-core-${{ steps.playwright.outputs.version }}",
    "new": "apt-archives-${{ runner.os }}-${{ runner.arch }}-playwright-core-${{ steps.playwright.outputs.version }}",
    "tests": "test/ci-workflow.test.ts",
    "command": "ulimit -u 3467; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
    "threads": 1967,
    "exit": 1,
    "result": "2 failed | 43 passed (45)",
    "failed": [
      "checks out full history, keeps no credentials in the workspace, sets up the matrix Node with the npm cache, and caches the browsers, each action pinned by commit sha",
      "L3.CI6: a second cache step, with the browser cache's pinned action, restores and saves apt's archive directory before the apt step and the install, keyed on the runner OS, architecture, OS release and the pinned playwright-core, with no fallback key"
    ],
    "assertions": [
      "expected [ [ …(2) ], [ …(2) ], [ …(2) ], …(1) ] to deeply equal [ [ …(2) ], [ …(2) ], [ …(2) ], …(1) ]",
      "expected { …(2) } to deeply equal { …(2) }"
    ],
    "at": [
      "test/ci-workflow.test.ts:262",
      "test/ci-workflow.test.ts:536"
    ],
    "restored_sha256": "bd900ed534be4a3cecf0cc530503ee5a0f7d36e0afebc409182478f8d52c22c9",
    "restore_matches": true
  },
  {
    "id": "L3.CI6c",
    "guard": "the apt cache key embeds the architecture",
    "file": ".github/workflows/ci.yml",
    "old": "apt-archives-${{ runner.os }}-${{ runner.arch }}-${{ steps.playwright.outputs.os }}-playwright-core-${{ steps.playwright.outputs.version }}",
    "new": "apt-archives-${{ runner.os }}-${{ steps.playwright.outputs.os }}-playwright-core-${{ steps.playwright.outputs.version }}",
    "tests": "test/ci-workflow.test.ts",
    "command": "ulimit -u 3476; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
    "threads": 1976,
    "exit": 1,
    "result": "2 failed | 43 passed (45)",
    "failed": [
      "checks out full history, keeps no credentials in the workspace, sets up the matrix Node with the npm cache, and caches the browsers, each action pinned by commit sha",
      "L3.CI6: a second cache step, with the browser cache's pinned action, restores and saves apt's archive directory before the apt step and the install, keyed on the runner OS, architecture, OS release and the pinned playwright-core, with no fallback key"
    ],
    "assertions": [
      "expected [ [ …(2) ], [ …(2) ], [ …(2) ], …(1) ] to deeply equal [ [ …(2) ], [ …(2) ], [ …(2) ], …(1) ]",
      "expected { …(2) } to deeply equal { …(2) }"
    ],
    "at": [
      "test/ci-workflow.test.ts:262",
      "test/ci-workflow.test.ts:536"
    ],
    "restored_sha256": "bd900ed534be4a3cecf0cc530503ee5a0f7d36e0afebc409182478f8d52c22c9",
    "restore_matches": true
  },
  {
    "id": "L3.CI6d",
    "guard": "the apt cache restores before the install",
    "file": ".github/workflows/ci.yml",
    "old": "      - uses: actions/cache@55cc8345863c7cc4c66a329aec7e433d2d1c52a9 # v6.1.0\n        with:\n          path: ${{ steps.playwright.outputs.archives }}\n          key: apt-archives-${{ runner.os }}-${{ runner.arch }}-${{ steps.playwright.outputs.os }}-playwright-core-${{ steps.playwright.outputs.version }}\n",
    "new": "",
    "after": {
      "anchor": "            echo \"::warning::browser install attempt ${attempt} of 2 failed or timed out\"\n          done\n          exit 1\n",
      "insert": "      - uses: actions/cache@55cc8345863c7cc4c66a329aec7e433d2d1c52a9 # v6.1.0\n        with:\n          path: ${{ steps.playwright.outputs.archives }}\n          key: apt-archives-${{ runner.os }}-${{ runner.arch }}-${{ steps.playwright.outputs.os }}-playwright-core-${{ steps.playwright.outputs.version }}\n"
    },
    "tests": "test/ci-workflow.test.ts",
    "command": "ulimit -u 3470; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
    "threads": 1970,
    "exit": 1,
    "result": "3 failed | 42 passed (45)",
    "failed": [
      "installs from the lock, reads the playwright-core pin, restores the browser cache and the apt archive cache, configures apt, installs the browsers, makes the apt archive cache readable, typechecks, tests, checks the tests wrote no layout snapshot, builds, runs the ratchet, then packs and smokes the tarball",
      "L3.CI6: a second cache step, with the browser cache's pinned action, restores and saves apt's archive directory before the apt step and the install, keyed on the runner OS, architecture, OS release and the pinned playwright-core, with no fallback key",
      "L3.CI6: right after the install, a step hands apt's archive directory back to the runner and makes everything in it readable, so the cache's save can read what apt wrote as root"
    ],
    "assertions": [
      "expected [ 'actions/checkout', …(15) ] to deeply equal [ 'actions/checkout', …(15) ]",
      "expected 7 to be less than 5",
      "expected 8 to be 7 // Object.is equality"
    ],
    "at": [
      "test/ci-workflow.test.ts:277",
      "test/ci-workflow.test.ts:533",
      "test/ci-workflow.test.ts:545"
    ],
    "restored_sha256": "bd900ed534be4a3cecf0cc530503ee5a0f7d36e0afebc409182478f8d52c22c9",
    "restore_matches": true
  },
  {
    "id": "L3.CI6e",
    "guard": "the apt cache's path is the archive directory",
    "file": ".github/workflows/ci.yml",
    "old": "          path: ${{ steps.playwright.outputs.archives }}\n          key: apt-",
    "new": "          path: /var/cache/apt/archives\n          key: apt-",
    "tests": "test/ci-workflow.test.ts",
    "command": "ulimit -u 3469; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
    "threads": 1969,
    "exit": 1,
    "result": "2 failed | 43 passed (45)",
    "failed": [
      "checks out full history, keeps no credentials in the workspace, sets up the matrix Node with the npm cache, and caches the browsers, each action pinned by commit sha",
      "L3.CI6: a second cache step, with the browser cache's pinned action, restores and saves apt's archive directory before the apt step and the install, keyed on the runner OS, architecture, OS release and the pinned playwright-core, with no fallback key"
    ],
    "assertions": [
      "expected [ [ …(2) ], [ …(2) ], [ …(2) ], …(1) ] to deeply equal [ [ …(2) ], [ …(2) ], [ …(2) ], …(1) ]",
      "expected -1 to be greater than 3"
    ],
    "at": [
      "test/ci-workflow.test.ts:262",
      "test/ci-workflow.test.ts:532"
    ],
    "restored_sha256": "bd900ed534be4a3cecf0cc530503ee5a0f7d36e0afebc409182478f8d52c22c9",
    "restore_matches": true
  },
  {
    "id": "L3.CI6f",
    "guard": "the apt cache step exists",
    "file": ".github/workflows/ci.yml",
    "old": "      - uses: actions/cache@55cc8345863c7cc4c66a329aec7e433d2d1c52a9 # v6.1.0\n        with:\n          path: ${{ steps.playwright.outputs.archives }}\n          key: apt-archives-${{ runner.os }}-${{ runner.arch }}-${{ steps.playwright.outputs.os }}-playwright-core-${{ steps.playwright.outputs.version }}\n",
    "new": "",
    "tests": "test/ci-workflow.test.ts",
    "command": "ulimit -u 3478; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
    "threads": 1978,
    "exit": 1,
    "result": "3 failed | 42 passed (45)",
    "failed": [
      "checks out full history, keeps no credentials in the workspace, sets up the matrix Node with the npm cache, and caches the browsers, each action pinned by commit sha",
      "installs from the lock, reads the playwright-core pin, restores the browser cache and the apt archive cache, configures apt, installs the browsers, makes the apt archive cache readable, typechecks, tests, checks the tests wrote no layout snapshot, builds, runs the ratchet, then packs and smokes the tarball",
      "L3.CI6: a second cache step, with the browser cache's pinned action, restores and saves apt's archive directory before the apt step and the install, keyed on the runner OS, architecture, OS release and the pinned playwright-core, with no fallback key"
    ],
    "assertions": [
      "expected [ [ …(2) ], [ …(2) ], [ …(2) ] ] to deeply equal [ [ …(2) ], [ …(2) ], [ …(2) ], …(1) ]",
      "expected [ 'actions/checkout', …(14) ] to deeply equal [ 'actions/checkout', …(15) ]",
      "expected -1 to be greater than 3"
    ],
    "at": [
      "test/ci-workflow.test.ts:262",
      "test/ci-workflow.test.ts:277",
      "test/ci-workflow.test.ts:532"
    ],
    "restored_sha256": "bd900ed534be4a3cecf0cc530503ee5a0f7d36e0afebc409182478f8d52c22c9",
    "restore_matches": true
  },
  {
    "id": "L3.CI6g",
    "guard": "the apt cache has its own key",
    "file": ".github/workflows/ci.yml",
    "old": "          key: apt-archives-${{ runner.os }}-${{ runner.arch }}-${{ steps.playwright.outputs.os }}-playwright-core-${{ steps.playwright.outputs.version }}\n",
    "new": "          key: ms-playwright-${{ runner.os }}-${{ runner.arch }}-${{ steps.playwright.outputs.os }}-playwright-core-${{ steps.playwright.outputs.version }}\n",
    "tests": "test/ci-workflow.test.ts",
    "command": "ulimit -u 3475; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
    "threads": 1975,
    "exit": 1,
    "result": "2 failed | 43 passed (45)",
    "failed": [
      "checks out full history, keeps no credentials in the workspace, sets up the matrix Node with the npm cache, and caches the browsers, each action pinned by commit sha",
      "L3.CI6: a second cache step, with the browser cache's pinned action, restores and saves apt's archive directory before the apt step and the install, keyed on the runner OS, architecture, OS release and the pinned playwright-core, with no fallback key"
    ],
    "assertions": [
      "expected [ [ …(2) ], [ …(2) ], [ …(2) ], …(1) ] to deeply equal [ [ …(2) ], [ …(2) ], [ …(2) ], …(1) ]",
      "expected { …(2) } to deeply equal { …(2) }"
    ],
    "at": [
      "test/ci-workflow.test.ts:262",
      "test/ci-workflow.test.ts:536"
    ],
    "restored_sha256": "bd900ed534be4a3cecf0cc530503ee5a0f7d36e0afebc409182478f8d52c22c9",
    "restore_matches": true
  },
  {
    "id": "L3.CI6h",
    "guard": "no fallback key",
    "file": ".github/workflows/ci.yml",
    "old": "          key: apt-archives-${{ runner.os }}-${{ runner.arch }}-${{ steps.playwright.outputs.os }}-playwright-core-${{ steps.playwright.outputs.version }}\n",
    "new": "          key: apt-archives-${{ runner.os }}-${{ runner.arch }}-${{ steps.playwright.outputs.os }}-playwright-core-${{ steps.playwright.outputs.version }}\n          restore-keys: apt-archives-\n",
    "tests": "test/ci-workflow.test.ts",
    "command": "ulimit -u 3476; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
    "threads": 1976,
    "exit": 1,
    "result": "2 failed | 43 passed (45)",
    "failed": [
      "checks out full history, keeps no credentials in the workspace, sets up the matrix Node with the npm cache, and caches the browsers, each action pinned by commit sha",
      "L3.CI6: a second cache step, with the browser cache's pinned action, restores and saves apt's archive directory before the apt step and the install, keyed on the runner OS, architecture, OS release and the pinned playwright-core, with no fallback key"
    ],
    "assertions": [
      "expected [ [ …(2) ], [ …(2) ], [ …(2) ], …(1) ] to deeply equal [ [ …(2) ], [ …(2) ], [ …(2) ], …(1) ]",
      "expected { …(3) } to deeply equal { …(2) }"
    ],
    "at": [
      "test/ci-workflow.test.ts:262",
      "test/ci-workflow.test.ts:536"
    ],
    "restored_sha256": "bd900ed534be4a3cecf0cc530503ee5a0f7d36e0afebc409182478f8d52c22c9",
    "restore_matches": true
  },
  {
    "id": "L3.CI6i",
    "guard": "the readable step exists",
    "file": ".github/workflows/ci.yml",
    "old": "      - name: the apt archive cache is readable for its save\n        env:\n          ARCHIVES: ${{ steps.playwright.outputs.archives }}\n        run: |\n          sudo chown -R \"$(id -u):$(id -g)\" \"${ARCHIVES:?}\"\n          chmod -R u+rwX \"$ARCHIVES\"\n",
    "new": "",
    "tests": "test/ci-workflow.test.ts",
    "command": "ulimit -u 3475; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
    "threads": 1975,
    "exit": 1,
    "result": "3 failed | 42 passed (45)",
    "failed": [
      "installs from the lock, reads the playwright-core pin, restores the browser cache and the apt archive cache, configures apt, installs the browsers, makes the apt archive cache readable, typechecks, tests, checks the tests wrote no layout snapshot, builds, runs the ratchet, then packs and smokes the tarball",
      "the ratchet reads from the base branch on a pull request, the previous tip on a push, main by hand",
      "L3.CI6: right after the install, a step hands apt's archive directory back to the runner and makes everything in it readable, so the cache's save can read what apt wrote as root"
    ],
    "assertions": [
      "expected [ 'actions/checkout', …(14) ] to deeply equal [ 'actions/checkout', …(15) ]",
      "expected [ [ …(2) ], [ 'ratchet', …(1) ] ] to deeply equal [ [ …(2) ], [ …(2) ], …(1) ]",
      "expected -1 to be 8 // Object.is equality"
    ],
    "at": [
      "test/ci-workflow.test.ts:277",
      "test/ci-workflow.test.ts:311",
      "test/ci-workflow.test.ts:545"
    ],
    "restored_sha256": "bd900ed534be4a3cecf0cc530503ee5a0f7d36e0afebc409182478f8d52c22c9",
    "restore_matches": true
  },
  {
    "id": "L3.CI6j",
    "guard": "the directory is handed back to the runner",
    "file": ".github/workflows/ci.yml",
    "old": "          sudo chown -R \"$(id -u):$(id -g)\" \"${ARCHIVES:?}\"\n",
    "new": "",
    "tests": "test/ci-workflow.test.ts",
    "command": "ulimit -u 3405; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
    "threads": 1905,
    "exit": 1,
    "result": "1 failed | 44 passed (45)",
    "failed": [
      "L3.CI6: right after the install, a step hands apt's archive directory back to the runner and makes everything in it readable, so the cache's save can read what apt wrote as root"
    ],
    "assertions": [
      "expected [] to deeply equal [ Array(1) ]"
    ],
    "at": [
      "test/ci-workflow.test.ts:561"
    ],
    "restored_sha256": "bd900ed534be4a3cecf0cc530503ee5a0f7d36e0afebc409182478f8d52c22c9",
    "restore_matches": true
  },
  {
    "id": "L3.CI6k",
    "guard": "everything in it is made readable",
    "file": ".github/workflows/ci.yml",
    "old": "          chmod -R u+rwX \"$ARCHIVES\"\n",
    "new": "",
    "tests": "test/ci-workflow.test.ts",
    "command": "ulimit -u 3400; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
    "threads": 1900,
    "exit": 1,
    "result": "1 failed | 44 passed (45)",
    "failed": [
      "L3.CI6: right after the install, a step hands apt's archive directory back to the runner and makes everything in it readable, so the cache's save can read what apt wrote as root"
    ],
    "assertions": [
      "lib.deb: expected [Function] to not throw an error but 'Error: EACCES: permission denied, acc…' was thrown"
    ],
    "at": [
      "test/ci-workflow.test.ts:563"
    ],
    "restored_sha256": "bd900ed534be4a3cecf0cc530503ee5a0f7d36e0afebc409182478f8d52c22c9",
    "restore_matches": true
  },
  {
    "id": "L3.CI6l",
    "guard": "the readable step runs right after the install",
    "file": ".github/workflows/ci.yml",
    "old": "      - name: the apt archive cache is readable for its save\n        env:\n          ARCHIVES: ${{ steps.playwright.outputs.archives }}\n        run: |\n          sudo chown -R \"$(id -u):$(id -g)\" \"${ARCHIVES:?}\"\n          chmod -R u+rwX \"$ARCHIVES\"\n",
    "new": "",
    "after": {
      "anchor": "      - run: npm run build\n",
      "insert": "      - name: the apt archive cache is readable for its save\n        env:\n          ARCHIVES: ${{ steps.playwright.outputs.archives }}\n        run: |\n          sudo chown -R \"$(id -u):$(id -g)\" \"${ARCHIVES:?}\"\n          chmod -R u+rwX \"$ARCHIVES\"\n"
    },
    "tests": "test/ci-workflow.test.ts",
    "command": "ulimit -u 3378; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
    "threads": 1878,
    "exit": 1,
    "result": "2 failed | 43 passed (45)",
    "failed": [
      "installs from the lock, reads the playwright-core pin, restores the browser cache and the apt archive cache, configures apt, installs the browsers, makes the apt archive cache readable, typechecks, tests, checks the tests wrote no layout snapshot, builds, runs the ratchet, then packs and smokes the tarball",
      "L3.CI6: right after the install, a step hands apt's archive directory back to the runner and makes everything in it readable, so the cache's save can read what apt wrote as root"
    ],
    "assertions": [
      "expected [ 'actions/checkout', …(15) ] to deeply equal [ 'actions/checkout', …(15) ]",
      "expected 12 to be 8 // Object.is equality"
    ],
    "at": [
      "test/ci-workflow.test.ts:277",
      "test/ci-workflow.test.ts:545"
    ],
    "restored_sha256": "bd900ed534be4a3cecf0cc530503ee5a0f7d36e0afebc409182478f8d52c22c9",
    "restore_matches": true
  }
]
```

### L3.CI7: before attempt 2 only, stop a leftover apt-get or dpkg and finish dpkg's configuration

| Row | Guard | File | Change | Exit | Red (tests in the named file) | Restore |
|---|---|---|---|---|---|---|
| L3.CI7a | the cleanup runs before attempt 2 only | `.github/workflows/ci.yml` | `if [ "$attempt" = 2 ]; then` → `if true; then` | 1 | `test/ci-workflow.test.ts`: 5 failed \| 40 passed (45). "L3.CI7: before attempt 2 only, the install step stops a leftover apt-get or dpkg (TERM, a wait, then KILL, by exact name, under sudo) and finishes dpkg's configuration: an install that fails twice: the cleanup runs once, between the attempts"; "L3.CI7: before attempt 2 only, the install step stops a leftover apt-get or dpkg (TERM, a wait, then KILL, by exact name, under sudo) and finishes dpkg's configuration: an install that fails, then succeeds: the cleanup runs once, before attempt 2"; "L3.CI7: before attempt 2 only, the install step stops a leftover apt-get or dpkg (TERM, a wait, then KILL, by exact name, under sudo) and finishes dpkg's configuration: an install that succeeds at once: no cleanup at all"; "L3.CI7: with no leftover process to stop, the cleanup goes on to attempt 2 (pkill answering 1 does not end the step)"; "L3.CI7: a failing `dpkg --configure -a` is reported, and attempt 2 still runs and decides the step". | sha256 matched |
| L3.CI7b | TERM first | `.github/workflows/ci.yml` | `              sudo pkill -TERM -x 'apt-get\|dpkg' \|\| true⏎ ` → (deleted) | 1 | `test/ci-workflow.test.ts`: 4 failed \| 41 passed (45). "L3.CI7: before attempt 2 only, the install step stops a leftover apt-get or dpkg (TERM, a wait, then KILL, by exact name, under sudo) and finishes dpkg's configuration: an install that fails twice: the cleanup runs once, between the attempts"; "L3.CI7: before attempt 2 only, the install step stops a leftover apt-get or dpkg (TERM, a wait, then KILL, by exact name, under sudo) and finishes dpkg's configuration: an install that fails, then succeeds: the cleanup runs once, before attempt 2"; "L3.CI7: with no leftover process to stop, the cleanup goes on to attempt 2 (pkill answering 1 does not end the step)"; "L3.CI7: a failing `dpkg --configure -a` is reported, and attempt 2 still runs and decides the step". | sha256 matched |
| L3.CI7c | a short wait between TERM and KILL | `.github/workflows/ci.yml` | `              sleep 5⏎ ` → (deleted) | 1 | `test/ci-workflow.test.ts`: 5 failed \| 40 passed (45). "L3.CI2: the install step runs INSTALL under `timeout -k 30 600`, in a loop of exactly two attempts that both fit in its own step timeout"; "L3.CI7: before attempt 2 only, the install step stops a leftover apt-get or dpkg (TERM, a wait, then KILL, by exact name, under sudo) and finishes dpkg's configuration: an install that fails twice: the cleanup runs once, between the attempts"; "L3.CI7: before attempt 2 only, the install step stops a leftover apt-get or dpkg (TERM, a wait, then KILL, by exact name, under sudo) and finishes dpkg's configuration: an install that fails, then succeeds: the cleanup runs once, before attempt 2"; "L3.CI7: with no leftover process to stop, the cleanup goes on to attempt 2 (pkill answering 1 does not end the step)"; "L3.CI7: a failing `dpkg --configure -a` is reported, and attempt 2 still runs and decides the step". | sha256 matched |
| L3.CI7d | KILL after the wait | `.github/workflows/ci.yml` | `              sudo pkill -KILL -x 'apt-get\|dpkg' \|\| true⏎ ` → (deleted) | 1 | `test/ci-workflow.test.ts`: 4 failed \| 41 passed (45). "L3.CI7: before attempt 2 only, the install step stops a leftover apt-get or dpkg (TERM, a wait, then KILL, by exact name, under sudo) and finishes dpkg's configuration: an install that fails twice: the cleanup runs once, between the attempts"; "L3.CI7: before attempt 2 only, the install step stops a leftover apt-get or dpkg (TERM, a wait, then KILL, by exact name, under sudo) and finishes dpkg's configuration: an install that fails, then succeeds: the cleanup runs once, before attempt 2"; "L3.CI7: with no leftover process to stop, the cleanup goes on to attempt 2 (pkill answering 1 does not end the step)"; "L3.CI7: a failing `dpkg --configure -a` is reported, and attempt 2 still runs and decides the step". | sha256 matched |
| L3.CI7e | dpkg finishes an interrupted configuration | `.github/workflows/ci.yml` | `              sudo dpkg --configure -a \|\| echo "::warning::dpkg --configure -a failed befo…` → (deleted) | 1 | `test/ci-workflow.test.ts`: 4 failed \| 41 passed (45). "L3.CI7: before attempt 2 only, the install step stops a leftover apt-get or dpkg (TERM, a wait, then KILL, by exact name, under sudo) and finishes dpkg's configuration: an install that fails twice: the cleanup runs once, between the attempts"; "L3.CI7: before attempt 2 only, the install step stops a leftover apt-get or dpkg (TERM, a wait, then KILL, by exact name, under sudo) and finishes dpkg's configuration: an install that fails, then succeeds: the cleanup runs once, before attempt 2"; "L3.CI7: with no leftover process to stop, the cleanup goes on to attempt 2 (pkill answering 1 does not end the step)"; "L3.CI7: a failing `dpkg --configure -a` is reported, and attempt 2 still runs and decides the step". | sha256 matched |
| L3.CI7f | pkill runs under sudo | `.github/workflows/ci.yml` | `sudo pkill -TERM` → `pkill -TERM` | 1 | `test/ci-workflow.test.ts`: 4 failed \| 41 passed (45). "L3.CI7: before attempt 2 only, the install step stops a leftover apt-get or dpkg (TERM, a wait, then KILL, by exact name, under sudo) and finishes dpkg's configuration: an install that fails twice: the cleanup runs once, between the attempts"; "L3.CI7: before attempt 2 only, the install step stops a leftover apt-get or dpkg (TERM, a wait, then KILL, by exact name, under sudo) and finishes dpkg's configuration: an install that fails, then succeeds: the cleanup runs once, before attempt 2"; "L3.CI7: with no leftover process to stop, the cleanup goes on to attempt 2 (pkill answering 1 does not end the step)"; "L3.CI7: a failing `dpkg --configure -a` is reported, and attempt 2 still runs and decides the step". | sha256 matched |
| L3.CI7g | by exact process name | `.github/workflows/ci.yml` | `pkill -TERM -x 'apt-get\|dpkg'` → `pkill -TERM 'apt-get\|dpkg'` | 1 | `test/ci-workflow.test.ts`: 4 failed \| 41 passed (45). "L3.CI7: before attempt 2 only, the install step stops a leftover apt-get or dpkg (TERM, a wait, then KILL, by exact name, under sudo) and finishes dpkg's configuration: an install that fails twice: the cleanup runs once, between the attempts"; "L3.CI7: before attempt 2 only, the install step stops a leftover apt-get or dpkg (TERM, a wait, then KILL, by exact name, under sudo) and finishes dpkg's configuration: an install that fails, then succeeds: the cleanup runs once, before attempt 2"; "L3.CI7: with no leftover process to stop, the cleanup goes on to attempt 2 (pkill answering 1 does not end the step)"; "L3.CI7: a failing `dpkg --configure -a` is reported, and attempt 2 still runs and decides the step". | sha256 matched |
| L3.CI7h | nothing to stop does not end the step | `.github/workflows/ci.yml` | `sudo pkill -TERM -x 'apt-get\|dpkg' \|\| true` → `sudo pkill -TERM -x 'apt-get\|dpkg'` | 1 | `test/ci-workflow.test.ts`: 1 failed \| 44 passed (45). "L3.CI7: with no leftover process to stop, the cleanup goes on to attempt 2 (pkill answering 1 does not end the step)". | sha256 matched |
| L3.CI7i | a failed dpkg --configure -a is reported, not fatal | `.github/workflows/ci.yml` | ` \|\| echo "::warning::dpkg --configure -a failed before browser install attempt 2"` → (deleted) | 1 | `test/ci-workflow.test.ts`: 1 failed \| 44 passed (45). "L3.CI7: a failing `dpkg --configure -a` is reported, and attempt 2 still runs and decides the step". | sha256 matched |
| L3.CI7j | dpkg --configure -a runs under sudo | `.github/workflows/ci.yml` | `              sudo dpkg --configure -a` → `              dpkg --configure -a` | 1 | `test/ci-workflow.test.ts`: 4 failed \| 41 passed (45). "L3.CI7: before attempt 2 only, the install step stops a leftover apt-get or dpkg (TERM, a wait, then KILL, by exact name, under sudo) and finishes dpkg's configuration: an install that fails twice: the cleanup runs once, between the attempts"; "L3.CI7: before attempt 2 only, the install step stops a leftover apt-get or dpkg (TERM, a wait, then KILL, by exact name, under sudo) and finishes dpkg's configuration: an install that fails, then succeeds: the cleanup runs once, before attempt 2"; "L3.CI7: with no leftover process to stop, the cleanup goes on to attempt 2 (pkill answering 1 does not end the step)"; "L3.CI7: a failing `dpkg --configure -a` is reported, and attempt 2 still runs and decides the step". | sha256 matched |
| L3.CI7k | the wait fits the step limit with both attempts | `.github/workflows/ci.yml` | `              sleep 5⏎ ` → `              sleep 61⏎ ` | 1 | `test/ci-workflow.test.ts`: 5 failed \| 40 passed (45). "L3.CI2: the install step runs INSTALL under `timeout -k 30 600`, in a loop of exactly two attempts that both fit in its own step timeout"; "L3.CI7: before attempt 2 only, the install step stops a leftover apt-get or dpkg (TERM, a wait, then KILL, by exact name, under sudo) and finishes dpkg's configuration: an install that fails twice: the cleanup runs once, between the attempts"; "L3.CI7: before attempt 2 only, the install step stops a leftover apt-get or dpkg (TERM, a wait, then KILL, by exact name, under sudo) and finishes dpkg's configuration: an install that fails, then succeeds: the cleanup runs once, before attempt 2"; "L3.CI7: with no leftover process to stop, the cleanup goes on to attempt 2 (pkill answering 1 does not end the step)"; "L3.CI7: a failing `dpkg --configure -a` is reported, and attempt 2 still runs and decides the step". | sha256 matched |
| L3.CI7l | the cleanup comes before attempt 2, not after it | `.github/workflows/ci.yml` | `            if [ "$attempt" = 2 ]; then⏎               sudo pkill -TER…` moved after `            echo "::warning::browser install attempt ${attem…` | 1 | `test/ci-workflow.test.ts`: 4 failed \| 41 passed (45). "L3.CI7: before attempt 2 only, the install step stops a leftover apt-get or dpkg (TERM, a wait, then KILL, by exact name, under sudo) and finishes dpkg's configuration: an install that fails twice: the cleanup runs once, between the attempts"; "L3.CI7: before attempt 2 only, the install step stops a leftover apt-get or dpkg (TERM, a wait, then KILL, by exact name, under sudo) and finishes dpkg's configuration: an install that fails, then succeeds: the cleanup runs once, before attempt 2"; "L3.CI7: with no leftover process to stop, the cleanup goes on to attempt 2 (pkill answering 1 does not end the step)"; "L3.CI7: a failing `dpkg --configure -a` is reported, and attempt 2 still runs and decides the step". | sha256 matched |

```json
[
  {
    "id": "L3.CI7a",
    "guard": "the cleanup runs before attempt 2 only",
    "file": ".github/workflows/ci.yml",
    "old": "if [ \"$attempt\" = 2 ]; then",
    "new": "if true; then",
    "tests": "test/ci-workflow.test.ts",
    "command": "ulimit -u 3391; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
    "threads": 1891,
    "exit": 1,
    "result": "5 failed | 40 passed (45)",
    "failed": [
      "L3.CI7: before attempt 2 only, the install step stops a leftover apt-get or dpkg (TERM, a wait, then KILL, by exact name, under sudo) and finishes dpkg's configuration: an install that fails twice: the cleanup runs once, between the attempts",
      "L3.CI7: before attempt 2 only, the install step stops a leftover apt-get or dpkg (TERM, a wait, then KILL, by exact name, under sudo) and finishes dpkg's configuration: an install that fails, then succeeds: the cleanup runs once, before attempt 2",
      "L3.CI7: before attempt 2 only, the install step stops a leftover apt-get or dpkg (TERM, a wait, then KILL, by exact name, under sudo) and finishes dpkg's configuration: an install that succeeds at once: no cleanup at all",
      "L3.CI7: with no leftover process to stop, the cleanup goes on to attempt 2 (pkill answering 1 does not end the step)",
      "L3.CI7: a failing `dpkg --configure -a` is reported, and attempt 2 still runs and decides the step"
    ],
    "assertions": [
      "expected [ …(16) ] to deeply equal [ …(9) ]",
      "expected [ …(8) ] to deeply equal [ Array(1) ]",
      "expected [ …(16) ] to deeply equal [ …(9) ]",
      "expected [ …(16) ] to deeply equal [ …(9) ]"
    ],
    "at": [
      "test/ci-workflow.test.ts:587",
      "test/ci-workflow.test.ts:596",
      "test/ci-workflow.test.ts:605"
    ],
    "restored_sha256": "bd900ed534be4a3cecf0cc530503ee5a0f7d36e0afebc409182478f8d52c22c9",
    "restore_matches": true
  },
  {
    "id": "L3.CI7b",
    "guard": "TERM first",
    "file": ".github/workflows/ci.yml",
    "old": "              sudo pkill -TERM -x 'apt-get|dpkg' || true\n",
    "new": "",
    "tests": "test/ci-workflow.test.ts",
    "command": "ulimit -u 3432; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
    "threads": 1932,
    "exit": 1,
    "result": "4 failed | 41 passed (45)",
    "failed": [
      "L3.CI7: before attempt 2 only, the install step stops a leftover apt-get or dpkg (TERM, a wait, then KILL, by exact name, under sudo) and finishes dpkg's configuration: an install that fails twice: the cleanup runs once, between the attempts",
      "L3.CI7: before attempt 2 only, the install step stops a leftover apt-get or dpkg (TERM, a wait, then KILL, by exact name, under sudo) and finishes dpkg's configuration: an install that fails, then succeeds: the cleanup runs once, before attempt 2",
      "L3.CI7: with no leftover process to stop, the cleanup goes on to attempt 2 (pkill answering 1 does not end the step)",
      "L3.CI7: a failing `dpkg --configure -a` is reported, and attempt 2 still runs and decides the step"
    ],
    "assertions": [
      "expected [ …(7) ] to deeply equal [ …(9) ]",
      "expected [ …(7) ] to deeply equal [ …(9) ]",
      "expected [ …(7) ] to deeply equal [ …(9) ]"
    ],
    "at": [
      "test/ci-workflow.test.ts:587",
      "test/ci-workflow.test.ts:596",
      "test/ci-workflow.test.ts:605"
    ],
    "restored_sha256": "bd900ed534be4a3cecf0cc530503ee5a0f7d36e0afebc409182478f8d52c22c9",
    "restore_matches": true
  },
  {
    "id": "L3.CI7c",
    "guard": "a short wait between TERM and KILL",
    "file": ".github/workflows/ci.yml",
    "old": "              sleep 5\n",
    "new": "",
    "tests": "test/ci-workflow.test.ts",
    "command": "ulimit -u 3454; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
    "threads": 1954,
    "exit": 1,
    "result": "5 failed | 40 passed (45)",
    "failed": [
      "L3.CI2: the install step runs INSTALL under `timeout -k 30 600`, in a loop of exactly two attempts that both fit in its own step timeout",
      "L3.CI7: before attempt 2 only, the install step stops a leftover apt-get or dpkg (TERM, a wait, then KILL, by exact name, under sudo) and finishes dpkg's configuration: an install that fails twice: the cleanup runs once, between the attempts",
      "L3.CI7: before attempt 2 only, the install step stops a leftover apt-get or dpkg (TERM, a wait, then KILL, by exact name, under sudo) and finishes dpkg's configuration: an install that fails, then succeeds: the cleanup runs once, before attempt 2",
      "L3.CI7: with no leftover process to stop, the cleanup goes on to attempt 2 (pkill answering 1 does not end the step)",
      "L3.CI7: a failing `dpkg --configure -a` is reported, and attempt 2 still runs and decides the step"
    ],
    "assertions": [
      "expected [] to have a length of 1 but got +0",
      "expected [ …(8) ] to deeply equal [ …(9) ]",
      "expected [ …(8) ] to deeply equal [ …(9) ]",
      "expected [ …(8) ] to deeply equal [ …(9) ]"
    ],
    "at": [
      "test/ci-workflow.test.ts:362",
      "test/ci-workflow.test.ts:587",
      "test/ci-workflow.test.ts:596",
      "test/ci-workflow.test.ts:605"
    ],
    "restored_sha256": "bd900ed534be4a3cecf0cc530503ee5a0f7d36e0afebc409182478f8d52c22c9",
    "restore_matches": true
  },
  {
    "id": "L3.CI7d",
    "guard": "KILL after the wait",
    "file": ".github/workflows/ci.yml",
    "old": "              sudo pkill -KILL -x 'apt-get|dpkg' || true\n",
    "new": "",
    "tests": "test/ci-workflow.test.ts",
    "command": "ulimit -u 3431; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
    "threads": 1931,
    "exit": 1,
    "result": "4 failed | 41 passed (45)",
    "failed": [
      "L3.CI7: before attempt 2 only, the install step stops a leftover apt-get or dpkg (TERM, a wait, then KILL, by exact name, under sudo) and finishes dpkg's configuration: an install that fails twice: the cleanup runs once, between the attempts",
      "L3.CI7: before attempt 2 only, the install step stops a leftover apt-get or dpkg (TERM, a wait, then KILL, by exact name, under sudo) and finishes dpkg's configuration: an install that fails, then succeeds: the cleanup runs once, before attempt 2",
      "L3.CI7: with no leftover process to stop, the cleanup goes on to attempt 2 (pkill answering 1 does not end the step)",
      "L3.CI7: a failing `dpkg --configure -a` is reported, and attempt 2 still runs and decides the step"
    ],
    "assertions": [
      "expected [ …(7) ] to deeply equal [ …(9) ]",
      "expected [ …(7) ] to deeply equal [ …(9) ]",
      "expected [ …(7) ] to deeply equal [ …(9) ]"
    ],
    "at": [
      "test/ci-workflow.test.ts:587",
      "test/ci-workflow.test.ts:596",
      "test/ci-workflow.test.ts:605"
    ],
    "restored_sha256": "bd900ed534be4a3cecf0cc530503ee5a0f7d36e0afebc409182478f8d52c22c9",
    "restore_matches": true
  },
  {
    "id": "L3.CI7e",
    "guard": "dpkg finishes an interrupted configuration",
    "file": ".github/workflows/ci.yml",
    "old": "              sudo dpkg --configure -a || echo \"::warning::dpkg --configure -a failed before browser install attempt 2\"\n",
    "new": "",
    "tests": "test/ci-workflow.test.ts",
    "command": "ulimit -u 3432; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
    "threads": 1932,
    "exit": 1,
    "result": "4 failed | 41 passed (45)",
    "failed": [
      "L3.CI7: before attempt 2 only, the install step stops a leftover apt-get or dpkg (TERM, a wait, then KILL, by exact name, under sudo) and finishes dpkg's configuration: an install that fails twice: the cleanup runs once, between the attempts",
      "L3.CI7: before attempt 2 only, the install step stops a leftover apt-get or dpkg (TERM, a wait, then KILL, by exact name, under sudo) and finishes dpkg's configuration: an install that fails, then succeeds: the cleanup runs once, before attempt 2",
      "L3.CI7: with no leftover process to stop, the cleanup goes on to attempt 2 (pkill answering 1 does not end the step)",
      "L3.CI7: a failing `dpkg --configure -a` is reported, and attempt 2 still runs and decides the step"
    ],
    "assertions": [
      "expected [ …(7) ] to deeply equal [ …(9) ]",
      "expected [ …(7) ] to deeply equal [ …(9) ]",
      "expected [ …(7) ] to deeply equal [ …(9) ]"
    ],
    "at": [
      "test/ci-workflow.test.ts:587",
      "test/ci-workflow.test.ts:596",
      "test/ci-workflow.test.ts:605"
    ],
    "restored_sha256": "bd900ed534be4a3cecf0cc530503ee5a0f7d36e0afebc409182478f8d52c22c9",
    "restore_matches": true
  },
  {
    "id": "L3.CI7f",
    "guard": "pkill runs under sudo",
    "file": ".github/workflows/ci.yml",
    "old": "sudo pkill -TERM",
    "new": "pkill -TERM",
    "tests": "test/ci-workflow.test.ts",
    "command": "ulimit -u 3408; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
    "threads": 1908,
    "exit": 1,
    "result": "4 failed | 41 passed (45)",
    "failed": [
      "L3.CI7: before attempt 2 only, the install step stops a leftover apt-get or dpkg (TERM, a wait, then KILL, by exact name, under sudo) and finishes dpkg's configuration: an install that fails twice: the cleanup runs once, between the attempts",
      "L3.CI7: before attempt 2 only, the install step stops a leftover apt-get or dpkg (TERM, a wait, then KILL, by exact name, under sudo) and finishes dpkg's configuration: an install that fails, then succeeds: the cleanup runs once, before attempt 2",
      "L3.CI7: with no leftover process to stop, the cleanup goes on to attempt 2 (pkill answering 1 does not end the step)",
      "L3.CI7: a failing `dpkg --configure -a` is reported, and attempt 2 still runs and decides the step"
    ],
    "assertions": [
      "expected [ …(8) ] to deeply equal [ …(9) ]",
      "expected [ …(8) ] to deeply equal [ …(9) ]",
      "expected [ …(8) ] to deeply equal [ …(9) ]"
    ],
    "at": [
      "test/ci-workflow.test.ts:587",
      "test/ci-workflow.test.ts:596",
      "test/ci-workflow.test.ts:605"
    ],
    "restored_sha256": "bd900ed534be4a3cecf0cc530503ee5a0f7d36e0afebc409182478f8d52c22c9",
    "restore_matches": true
  },
  {
    "id": "L3.CI7g",
    "guard": "by exact process name",
    "file": ".github/workflows/ci.yml",
    "old": "pkill -TERM -x 'apt-get|dpkg'",
    "new": "pkill -TERM 'apt-get|dpkg'",
    "tests": "test/ci-workflow.test.ts",
    "command": "ulimit -u 3406; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
    "threads": 1906,
    "exit": 1,
    "result": "4 failed | 41 passed (45)",
    "failed": [
      "L3.CI7: before attempt 2 only, the install step stops a leftover apt-get or dpkg (TERM, a wait, then KILL, by exact name, under sudo) and finishes dpkg's configuration: an install that fails twice: the cleanup runs once, between the attempts",
      "L3.CI7: before attempt 2 only, the install step stops a leftover apt-get or dpkg (TERM, a wait, then KILL, by exact name, under sudo) and finishes dpkg's configuration: an install that fails, then succeeds: the cleanup runs once, before attempt 2",
      "L3.CI7: with no leftover process to stop, the cleanup goes on to attempt 2 (pkill answering 1 does not end the step)",
      "L3.CI7: a failing `dpkg --configure -a` is reported, and attempt 2 still runs and decides the step"
    ],
    "assertions": [
      "expected [ …(9) ] to deeply equal [ …(9) ]",
      "expected [ …(9) ] to deeply equal [ …(9) ]",
      "expected [ …(9) ] to deeply equal [ …(9) ]"
    ],
    "at": [
      "test/ci-workflow.test.ts:587",
      "test/ci-workflow.test.ts:596",
      "test/ci-workflow.test.ts:605"
    ],
    "restored_sha256": "bd900ed534be4a3cecf0cc530503ee5a0f7d36e0afebc409182478f8d52c22c9",
    "restore_matches": true
  },
  {
    "id": "L3.CI7h",
    "guard": "nothing to stop does not end the step",
    "file": ".github/workflows/ci.yml",
    "old": "sudo pkill -TERM -x 'apt-get|dpkg' || true",
    "new": "sudo pkill -TERM -x 'apt-get|dpkg'",
    "tests": "test/ci-workflow.test.ts",
    "command": "ulimit -u 3428; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
    "threads": 1928,
    "exit": 1,
    "result": "1 failed | 44 passed (45)",
    "failed": [
      "L3.CI7: with no leftover process to stop, the cleanup goes on to attempt 2 (pkill answering 1 does not end the step)"
    ],
    "assertions": [
      "::warning::browser install attempt 1 of 2 failed or timed out"
    ],
    "at": [
      "test/ci-workflow.test.ts:595"
    ],
    "restored_sha256": "bd900ed534be4a3cecf0cc530503ee5a0f7d36e0afebc409182478f8d52c22c9",
    "restore_matches": true
  },
  {
    "id": "L3.CI7i",
    "guard": "a failed dpkg --configure -a is reported, not fatal",
    "file": ".github/workflows/ci.yml",
    "old": " || echo \"::warning::dpkg --configure -a failed before browser install attempt 2\"",
    "new": "",
    "tests": "test/ci-workflow.test.ts",
    "command": "ulimit -u 3416; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
    "threads": 1916,
    "exit": 1,
    "result": "1 failed | 44 passed (45)",
    "failed": [
      "L3.CI7: a failing `dpkg --configure -a` is reported, and attempt 2 still runs and decides the step"
    ],
    "assertions": [
      "::warning::browser install attempt 1 of 2 failed or timed out"
    ],
    "at": [
      "test/ci-workflow.test.ts:604"
    ],
    "restored_sha256": "bd900ed534be4a3cecf0cc530503ee5a0f7d36e0afebc409182478f8d52c22c9",
    "restore_matches": true
  },
  {
    "id": "L3.CI7j",
    "guard": "dpkg --configure -a runs under sudo",
    "file": ".github/workflows/ci.yml",
    "old": "              sudo dpkg --configure -a",
    "new": "              dpkg --configure -a",
    "tests": "test/ci-workflow.test.ts",
    "command": "ulimit -u 3410; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
    "threads": 1910,
    "exit": 1,
    "result": "4 failed | 41 passed (45)",
    "failed": [
      "L3.CI7: before attempt 2 only, the install step stops a leftover apt-get or dpkg (TERM, a wait, then KILL, by exact name, under sudo) and finishes dpkg's configuration: an install that fails twice: the cleanup runs once, between the attempts",
      "L3.CI7: before attempt 2 only, the install step stops a leftover apt-get or dpkg (TERM, a wait, then KILL, by exact name, under sudo) and finishes dpkg's configuration: an install that fails, then succeeds: the cleanup runs once, before attempt 2",
      "L3.CI7: with no leftover process to stop, the cleanup goes on to attempt 2 (pkill answering 1 does not end the step)",
      "L3.CI7: a failing `dpkg --configure -a` is reported, and attempt 2 still runs and decides the step"
    ],
    "assertions": [
      "expected [ …(8) ] to deeply equal [ …(9) ]",
      "expected [ …(8) ] to deeply equal [ …(9) ]",
      "expected [ …(8) ] to deeply equal [ …(9) ]"
    ],
    "at": [
      "test/ci-workflow.test.ts:587",
      "test/ci-workflow.test.ts:596",
      "test/ci-workflow.test.ts:605"
    ],
    "restored_sha256": "bd900ed534be4a3cecf0cc530503ee5a0f7d36e0afebc409182478f8d52c22c9",
    "restore_matches": true
  },
  {
    "id": "L3.CI7k",
    "guard": "the wait fits the step limit with both attempts",
    "file": ".github/workflows/ci.yml",
    "old": "              sleep 5\n",
    "new": "              sleep 61\n",
    "tests": "test/ci-workflow.test.ts",
    "command": "ulimit -u 3428; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
    "threads": 1928,
    "exit": 1,
    "result": "5 failed | 40 passed (45)",
    "failed": [
      "L3.CI2: the install step runs INSTALL under `timeout -k 30 600`, in a loop of exactly two attempts that both fit in its own step timeout",
      "L3.CI7: before attempt 2 only, the install step stops a leftover apt-get or dpkg (TERM, a wait, then KILL, by exact name, under sudo) and finishes dpkg's configuration: an install that fails twice: the cleanup runs once, between the attempts",
      "L3.CI7: before attempt 2 only, the install step stops a leftover apt-get or dpkg (TERM, a wait, then KILL, by exact name, under sudo) and finishes dpkg's configuration: an install that fails, then succeeds: the cleanup runs once, before attempt 2",
      "L3.CI7: with no leftover process to stop, the cleanup goes on to attempt 2 (pkill answering 1 does not end the step)",
      "L3.CI7: a failing `dpkg --configure -a` is reported, and attempt 2 still runs and decides the step"
    ],
    "assertions": [
      "expected 1321 to be less than 1320",
      "expected [ …(9) ] to deeply equal [ …(9) ]",
      "expected [ …(9) ] to deeply equal [ …(9) ]",
      "expected [ …(9) ] to deeply equal [ …(9) ]"
    ],
    "at": [
      "test/ci-workflow.test.ts:363",
      "test/ci-workflow.test.ts:587",
      "test/ci-workflow.test.ts:596",
      "test/ci-workflow.test.ts:605"
    ],
    "restored_sha256": "bd900ed534be4a3cecf0cc530503ee5a0f7d36e0afebc409182478f8d52c22c9",
    "restore_matches": true
  },
  {
    "id": "L3.CI7l",
    "guard": "the cleanup comes before attempt 2, not after it",
    "file": ".github/workflows/ci.yml",
    "old": "            if [ \"$attempt\" = 2 ]; then\n              sudo pkill -TERM -x 'apt-get|dpkg' || true\n              sleep 5\n              sudo pkill -KILL -x 'apt-get|dpkg' || true\n              sudo dpkg --configure -a || echo \"::warning::dpkg --configure -a failed before browser install attempt 2\"\n            fi\n",
    "new": "",
    "after": {
      "anchor": "            echo \"::warning::browser install attempt ${attempt} of 2 failed or timed out\"\n",
      "insert": "            if [ \"$attempt\" = 2 ]; then\n              sudo pkill -TERM -x 'apt-get|dpkg' || true\n              sleep 5\n              sudo pkill -KILL -x 'apt-get|dpkg' || true\n              sudo dpkg --configure -a || echo \"::warning::dpkg --configure -a failed before browser install attempt 2\"\n            fi\n"
    },
    "tests": "test/ci-workflow.test.ts",
    "command": "ulimit -u 3421; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
    "threads": 1921,
    "exit": 1,
    "result": "4 failed | 41 passed (45)",
    "failed": [
      "L3.CI7: before attempt 2 only, the install step stops a leftover apt-get or dpkg (TERM, a wait, then KILL, by exact name, under sudo) and finishes dpkg's configuration: an install that fails twice: the cleanup runs once, between the attempts",
      "L3.CI7: before attempt 2 only, the install step stops a leftover apt-get or dpkg (TERM, a wait, then KILL, by exact name, under sudo) and finishes dpkg's configuration: an install that fails, then succeeds: the cleanup runs once, before attempt 2",
      "L3.CI7: with no leftover process to stop, the cleanup goes on to attempt 2 (pkill answering 1 does not end the step)",
      "L3.CI7: a failing `dpkg --configure -a` is reported, and attempt 2 still runs and decides the step"
    ],
    "assertions": [
      "expected [ …(9) ] to deeply equal [ …(9) ]",
      "expected [ …(2) ] to deeply equal [ …(9) ]",
      "expected [ …(2) ] to deeply equal [ …(9) ]",
      "expected [ …(2) ] to deeply equal [ …(9) ]"
    ],
    "at": [
      "test/ci-workflow.test.ts:587",
      "test/ci-workflow.test.ts:596",
      "test/ci-workflow.test.ts:605"
    ],
    "restored_sha256": "bd900ed534be4a3cecf0cc530503ee5a0f7d36e0afebc409182478f8d52c22c9",
    "restore_matches": true
  }
]
```

### The existing Task 17 rows, re-measured on the follow-up's final code

Every row recorded above this section, run again on the follow-up's final `ci.yml` with the follow-up's test file. Twenty apply unchanged. Five are marked "adapted": their recorded `old` text now occurs twice in the file (the second cache step repeats the pinned `uses:` line and the key's tail: L3.CI3a, L3.CI3e, L3.CI3f, L3.CI4b) or no longer at all (the apt step gained lines: L3.CI1b), so the same mutation is applied to the browser cache step or to the current apt step. All 25 are red through assertion failures only, so every existing guard still holds.

| Row | Change on the final `ci.yml` | Exit | Red (tests in `test/ci-workflow.test.ts`) | Restore |
|---|---|---|---|---|
| L3.CI1a | as recorded above | 1 | 1 failed \| 44 passed (45). "L3.CI1: an apt step before the install writes the retries and the two timeouts to its own apt configuration file". | sha256 matched |
| L3.CI1b | adapted: `      - name: apt retries and timeouts⏎         env:⏎           ARCHIV…` moved after `            echo "::warning::browser install attem…` | 1 | 3 failed \| 42 passed (45). "installs from the lock, reads the playwright-core pin, restores the browser cache and the apt archive cache, configures apt, installs the browsers, makes the apt archive cache readable, typechecks, tests, checks the tests wrote no layout snapshot, builds, runs the ratchet, then packs and smokes the tarball"; "L3.CI1: an apt step before the install writes the retries and the two timeouts to its own apt configuration file"; "L3.CI6: right after the install, a step hands apt's archive directory back to the runner and makes everything in it readable, so the cache's save can read what apt wrote as root". | sha256 matched |
| L3.CI1c | as recorded above | 1 | 1 failed \| 44 passed (45). "L3.CI1: an apt step before the install writes the retries and the two timeouts to its own apt configuration file". | sha256 matched |
| L3.CI1d | as recorded above | 1 | 1 failed \| 44 passed (45). "L3.CI1: an apt step before the install writes the retries and the two timeouts to its own apt configuration file". | sha256 matched |
| L3.CI2a | as recorded above | 1 | 6 failed \| 39 passed (45). "L3.CI2: an install that fails twice: two attempts, then the step fails"; "L3.CI2: an install that fails, then succeeds: two attempts, and the step passes"; "L3.CI7: before attempt 2 only, the install step stops a leftover apt-get or dpkg (TERM, a wait, then KILL, by exact name, under sudo) and finishes dpkg's configuration: an install that fails twice: the cleanup runs once, between the attempts"; "L3.CI7: before attempt 2 only, the install step stops a leftover apt-get or dpkg (TERM, a wait, then KILL, by exact name, under sudo) and finishes dpkg's configuration: an install that fails, then succeeds: the cleanup runs once, before attempt 2"; "L3.CI7: with no leftover process to stop, the cleanup goes on to attempt 2 (pkill answering 1 does not end the step)"; "L3.CI7: a failing `dpkg --configure -a` is reported, and attempt 2 still runs and decides the step". | sha256 matched |
| L3.CI2b | as recorded above | 1 | 1 failed \| 44 passed (45). "L3.CI2: the install step runs INSTALL under `timeout -k 30 600`, in a loop of exactly two attempts that both fit in its own step timeout". | sha256 matched |
| L3.CI2c | as recorded above | 1 | 1 failed \| 44 passed (45). "L3.CI2: the install step runs INSTALL under `timeout -k 30 600`, in a loop of exactly two attempts that both fit in its own step timeout". | sha256 matched |
| L3.CI2d | as recorded above | 1 | 1 failed \| 44 passed (45). "runs on Node 22 and 24, both legs to the end, within 45 minutes (L3.CI2: two install attempts and the suite fit)". | sha256 matched |
| L3.CI2e | as recorded above | 1 | 6 failed \| 39 passed (45). "L3.CI2: an install that succeeds at once: one attempt"; "L3.CI2: an install that fails, then succeeds: two attempts, and the step passes"; "L3.CI7: before attempt 2 only, the install step stops a leftover apt-get or dpkg (TERM, a wait, then KILL, by exact name, under sudo) and finishes dpkg's configuration: an install that fails, then succeeds: the cleanup runs once, before attempt 2"; "L3.CI7: before attempt 2 only, the install step stops a leftover apt-get or dpkg (TERM, a wait, then KILL, by exact name, under sudo) and finishes dpkg's configuration: an install that succeeds at once: no cleanup at all"; "L3.CI7: with no leftover process to stop, the cleanup goes on to attempt 2 (pkill answering 1 does not end the step)"; "L3.CI7: a failing `dpkg --configure -a` is reported, and attempt 2 still runs and decides the step". | sha256 matched |
| L3.CI3a | adapted: `key: ms-playwright-${{ runner.os }}-${{ runner.arch }}-${{ steps.playw…` → `key: ms-playwright-${{ runner.os }}-${{ runner.arch }}-${{ steps.playw…` | 1 | 2 failed \| 43 passed (45). "checks out full history, keeps no credentials in the workspace, sets up the matrix Node with the npm cache, and caches the browsers, each action pinned by commit sha"; "L3.CI3: the cache step restores the Playwright browser directory before the install, keyed on the runner OS, architecture and OS release and the pinned playwright-core version, with no fallback key". | sha256 matched |
| L3.CI3b | as recorded above | 1 | 4 failed \| 41 passed (45). "checks out full history, keeps no credentials in the workspace, sets up the matrix Node with the npm cache, and caches the browsers, each action pinned by commit sha"; "installs from the lock, reads the playwright-core pin, restores the browser cache and the apt archive cache, configures apt, installs the browsers, makes the apt archive cache readable, typechecks, tests, checks the tests wrote no layout snapshot, builds, runs the ratchet, then packs and smokes the tarball"; "L3.CI3: the cache step restores the Playwright browser directory before the install, keyed on the runner OS, architecture and OS release and the pinned playwright-core version, with no fallback key"; "L3.CI6: right after the install, a step hands apt's archive directory back to the runner and makes everything in it readable, so the cache's save can read what apt wrote as root". | sha256 matched |
| L3.CI3c | as recorded above | 1 | 2 failed \| 43 passed (45). "L3.CI3: the version step fails, and writes no key part, on a range (never a floating key)"; "L3.CI3: the version step fails, and writes no key part, on a missing pin (never a floating key)". | sha256 matched |
| L3.CI3d | as recorded above | 1 | 3 failed \| 42 passed (45). "checks out full history, keeps no credentials in the workspace, sets up the matrix Node with the npm cache, and caches the browsers, each action pinned by commit sha"; "L3.CI3: the cache step restores the Playwright browser directory before the install, keyed on the runner OS, architecture and OS release and the pinned playwright-core version, with no fallback key"; "L3.CI6: a second cache step, with the browser cache's pinned action, restores and saves apt's archive directory before the apt step and the install, keyed on the runner OS, architecture, OS release and the pinned playwright-core, with no fallback key". | sha256 matched |
| L3.CI3e | adapted: `key: ms-playwright-${{ runner.os }}-${{ runner.arch }}-${{ steps.playw…` → `key: ms-playwright-${{ runner.os }}-${{ runner.arch }}-playwright-core…` | 1 | 2 failed \| 43 passed (45). "checks out full history, keeps no credentials in the workspace, sets up the matrix Node with the npm cache, and caches the browsers, each action pinned by commit sha"; "L3.CI3: the cache step restores the Playwright browser directory before the install, keyed on the runner OS, architecture and OS release and the pinned playwright-core version, with no fallback key". | sha256 matched |
| L3.CI3f | adapted: `key: ms-playwright-${{ runner.os }}-${{ runner.arch }}-${{ steps.playw…` → `key: ms-playwright-${{ runner.os }}-${{ steps.playwright.outputs.os }}…` | 1 | 2 failed \| 43 passed (45). "checks out full history, keeps no credentials in the workspace, sets up the matrix Node with the npm cache, and caches the browsers, each action pinned by commit sha"; "L3.CI3: the cache step restores the Playwright browser directory before the install, keyed on the runner OS, architecture and OS release and the pinned playwright-core version, with no fallback key". | sha256 matched |
| L3.CI3g | as recorded above | 1 | 6 failed \| 39 passed (45). "L3.CI3: the version step reads exactly the playwright-core pin from package.json, so the key embeds it, and names the directory playwright-core installs into with XDG_CACHE_HOME unset: .cache/ms-playwright under HOME"; "L3.CI3: the version step reads exactly the playwright-core pin from package.json, so the key embeds it, and names the directory playwright-core installs into with XDG_CACHE_HOME set: ms-playwright under it"; "L3.CI3: the version step names the OS release playwright-core picks its builds by, so a new runner release is a new key: Ubuntu 22.04"; "L3.CI3: the version step names the OS release playwright-core picks its builds by, so a new runner release is a new key: Ubuntu 24.04"; "L3.CI3: the version step names the OS release playwright-core picks its builds by, so a new runner release is a new key: Ubuntu 26.04, unquoted"; "L3.CI3: the version step names the OS release playwright-core picks its builds by, so a new runner release is a new key: Debian 12". | sha256 matched |
| L3.CI3h | as recorded above | 1 | 2 failed \| 43 passed (45). "L3.CI3: the version step fails, and writes no key part, on an OS release with no VERSION_ID (never a floating key)"; "L3.CI3: the version step fails, and writes no key part, on an OS release with no ID (never a floating key)". | sha256 matched |
| L3.CI3i | as recorded above | 1 | 1 failed \| 44 passed (45). "L3.CI3: the version step fails, and writes no key part, on an OS release with no ID or VERSION_ID, while the environment carries both (never a floating key)". | sha256 matched |
| L3.CI4a | as recorded above | 1 | 3 failed \| 42 passed (45). "checks out full history, keeps no credentials in the workspace, sets up the matrix Node with the npm cache, and caches the browsers, each action pinned by commit sha"; "L3.CI4: every remote `uses:` is a full commit sha with its release tag in a trailing comment, and ci.yml holds no local `uses:`"; "L3.CI4: each pin names the release its tag comment names". | sha256 matched |
| L3.CI4b | adapted: `      - uses: actions/cache@55cc8345863c7cc4c66a329aec7e433d2d1c52a9 #…` → `      - uses: actions/cache@55cc8345863c7cc4c66a329aec7e433d2d1c52a9⏎ …` | 1 | 1 failed \| 44 passed (45). "L3.CI4: every remote `uses:` is a full commit sha with its release tag in a trailing comment, and ci.yml holds no local `uses:`". | sha256 matched |
| L3.CI4c | as recorded above | 1 | 3 failed \| 42 passed (45). "checks out full history, keeps no credentials in the workspace, sets up the matrix Node with the npm cache, and caches the browsers, each action pinned by commit sha"; "installs from the lock, reads the playwright-core pin, restores the browser cache and the apt archive cache, configures apt, installs the browsers, makes the apt archive cache readable, typechecks, tests, checks the tests wrote no layout snapshot, builds, runs the ratchet, then packs and smokes the tarball"; "L3.CI4: every remote `uses:` is a full commit sha with its release tag in a trailing comment, and ci.yml holds no local `uses:`". | sha256 matched |
| L3.CI4d | as recorded above | 1 | 3 failed \| 42 passed (45). "checks out full history, keeps no credentials in the workspace, sets up the matrix Node with the npm cache, and caches the browsers, each action pinned by commit sha"; "installs from the lock, reads the playwright-core pin, restores the browser cache and the apt archive cache, configures apt, installs the browsers, makes the apt archive cache readable, typechecks, tests, checks the tests wrote no layout snapshot, builds, runs the ratchet, then packs and smokes the tarball"; "L3.CI4: every remote `uses:` is a full commit sha with its release tag in a trailing comment, and ci.yml holds no local `uses:`". | sha256 matched |
| L3.CI4e | as recorded above | 1 | 2 failed \| 43 passed (45). "is the only job"; "L3.CI4: every remote `uses:` is a full commit sha with its release tag in a trailing comment, and ci.yml holds no local `uses:`". | sha256 matched |
| L3.R1 | as recorded above | 1 | 1 failed \| 44 passed (45). "the ratchet reads from the base branch on a pull request, the previous tip on a push, main by hand". | sha256 matched |
| L3.R2 | as recorded above | 1 | 1 failed \| 44 passed (45). "the ratchet reads from the base branch on a pull request, the previous tip on a push, main by hand". | sha256 matched |

```json
[
  {
    "id": "L3.CI1a",
    "command": "ulimit -u 3479; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
    "threads": 1979,
    "exit": 1,
    "result": "1 failed | 44 passed (45)",
    "at": [
      "test/ci-workflow.test.ts:350"
    ],
    "restored_sha256": "bd900ed534be4a3cecf0cc530503ee5a0f7d36e0afebc409182478f8d52c22c9",
    "restore_matches": true
  },
  {
    "id": "L3.CI1b",
    "adapted": true,
    "old": "      - name: apt retries and timeouts\n        env:\n          ARCHIVES: ${{ steps.playwright.outputs.archives }}\n        run: |\n          [[ \"${ARCHIVES:?}\" =~ ^/[A-Za-z0-9._/-]+$ ]]\n          mkdir -p \"$ARCHIVES/partial\"\n          printf '%s\\n' 'Acquire::Retries \"5\";' 'Acquire::http::Timeout \"30\";' 'Acquire::https::Timeout \"30\";' \\\n            'DPkg::Lock::Timeout \"300\";' \\\n            'APT::Keep-Downloaded-Packages \"true\";' \"Dir::Cache::Archives \\\"$ARCHIVES/\\\";\" \\\n            | sudo tee /etc/apt/apt.conf.d/80-docserver-ci > /dev/null\n",
    "new": "",
    "after": {
      "anchor": "            echo \"::warning::browser install attempt ${attempt} of 2 failed or timed out\"\n          done\n          exit 1\n",
      "insert": "      - name: apt retries and timeouts\n        env:\n          ARCHIVES: ${{ steps.playwright.outputs.archives }}\n        run: |\n          [[ \"${ARCHIVES:?}\" =~ ^/[A-Za-z0-9._/-]+$ ]]\n          mkdir -p \"$ARCHIVES/partial\"\n          printf '%s\\n' 'Acquire::Retries \"5\";' 'Acquire::http::Timeout \"30\";' 'Acquire::https::Timeout \"30\";' \\\n            'DPkg::Lock::Timeout \"300\";' \\\n            'APT::Keep-Downloaded-Packages \"true\";' \"Dir::Cache::Archives \\\"$ARCHIVES/\\\";\" \\\n            | sudo tee /etc/apt/apt.conf.d/80-docserver-ci > /dev/null\n"
    },
    "command": "ulimit -u 3577; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
    "threads": 2077,
    "exit": 1,
    "result": "3 failed | 42 passed (45)",
    "at": [
      "test/ci-workflow.test.ts:277",
      "test/ci-workflow.test.ts:341",
      "test/ci-workflow.test.ts:545"
    ],
    "restored_sha256": "bd900ed534be4a3cecf0cc530503ee5a0f7d36e0afebc409182478f8d52c22c9",
    "restore_matches": true
  },
  {
    "id": "L3.CI1c",
    "command": "ulimit -u 3546; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
    "threads": 2046,
    "exit": 1,
    "result": "1 failed | 44 passed (45)",
    "at": [
      "test/ci-workflow.test.ts:350"
    ],
    "restored_sha256": "bd900ed534be4a3cecf0cc530503ee5a0f7d36e0afebc409182478f8d52c22c9",
    "restore_matches": true
  },
  {
    "id": "L3.CI1d",
    "command": "ulimit -u 3500; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
    "threads": 2000,
    "exit": 1,
    "result": "1 failed | 44 passed (45)",
    "at": [
      "test/ci-workflow.test.ts:350"
    ],
    "restored_sha256": "bd900ed534be4a3cecf0cc530503ee5a0f7d36e0afebc409182478f8d52c22c9",
    "restore_matches": true
  },
  {
    "id": "L3.CI2a",
    "command": "ulimit -u 3512; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
    "threads": 2012,
    "exit": 1,
    "result": "6 failed | 39 passed (45)",
    "at": [
      "test/ci-workflow.test.ts:376",
      "test/ci-workflow.test.ts:374",
      "test/ci-workflow.test.ts:587",
      "test/ci-workflow.test.ts:586",
      "test/ci-workflow.test.ts:595",
      "test/ci-workflow.test.ts:604"
    ],
    "restored_sha256": "bd900ed534be4a3cecf0cc530503ee5a0f7d36e0afebc409182478f8d52c22c9",
    "restore_matches": true
  },
  {
    "id": "L3.CI2b",
    "command": "ulimit -u 3524; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
    "threads": 2024,
    "exit": 1,
    "result": "1 failed | 44 passed (45)",
    "at": [
      "test/ci-workflow.test.ts:357"
    ],
    "restored_sha256": "bd900ed534be4a3cecf0cc530503ee5a0f7d36e0afebc409182478f8d52c22c9",
    "restore_matches": true
  },
  {
    "id": "L3.CI2c",
    "command": "ulimit -u 3497; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
    "threads": 1997,
    "exit": 1,
    "result": "1 failed | 44 passed (45)",
    "at": [
      "test/ci-workflow.test.ts:356"
    ],
    "restored_sha256": "bd900ed534be4a3cecf0cc530503ee5a0f7d36e0afebc409182478f8d52c22c9",
    "restore_matches": true
  },
  {
    "id": "L3.CI2d",
    "command": "ulimit -u 3580; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
    "threads": 2080,
    "exit": 1,
    "result": "1 failed | 44 passed (45)",
    "at": [
      "test/ci-workflow.test.ts:256"
    ],
    "restored_sha256": "bd900ed534be4a3cecf0cc530503ee5a0f7d36e0afebc409182478f8d52c22c9",
    "restore_matches": true
  },
  {
    "id": "L3.CI2e",
    "command": "ulimit -u 3561; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
    "threads": 2061,
    "exit": 1,
    "result": "6 failed | 39 passed (45)",
    "at": [
      "test/ci-workflow.test.ts:374",
      "test/ci-workflow.test.ts:586",
      "test/ci-workflow.test.ts:595",
      "test/ci-workflow.test.ts:604"
    ],
    "restored_sha256": "bd900ed534be4a3cecf0cc530503ee5a0f7d36e0afebc409182478f8d52c22c9",
    "restore_matches": true
  },
  {
    "id": "L3.CI3a",
    "adapted": true,
    "old": "key: ms-playwright-${{ runner.os }}-${{ runner.arch }}-${{ steps.playwright.outputs.os }}-playwright-core-${{ steps.playwright.outputs.version }}",
    "new": "key: ms-playwright-${{ runner.os }}-${{ runner.arch }}-${{ steps.playwright.outputs.os }}-playwright-core",
    "command": "ulimit -u 3555; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
    "threads": 2055,
    "exit": 1,
    "result": "2 failed | 43 passed (45)",
    "at": [
      "test/ci-workflow.test.ts:262",
      "test/ci-workflow.test.ts:390"
    ],
    "restored_sha256": "bd900ed534be4a3cecf0cc530503ee5a0f7d36e0afebc409182478f8d52c22c9",
    "restore_matches": true
  },
  {
    "id": "L3.CI3b",
    "command": "ulimit -u 3540; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
    "threads": 2040,
    "exit": 1,
    "result": "4 failed | 41 passed (45)",
    "at": [
      "test/ci-workflow.test.ts:262",
      "test/ci-workflow.test.ts:277",
      "test/ci-workflow.test.ts:381",
      "test/ci-workflow.test.ts:545"
    ],
    "restored_sha256": "bd900ed534be4a3cecf0cc530503ee5a0f7d36e0afebc409182478f8d52c22c9",
    "restore_matches": true
  },
  {
    "id": "L3.CI3c",
    "command": "ulimit -u 3543; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
    "threads": 2043,
    "exit": 1,
    "result": "2 failed | 43 passed (45)",
    "at": [
      "test/ci-workflow.test.ts:460"
    ],
    "restored_sha256": "bd900ed534be4a3cecf0cc530503ee5a0f7d36e0afebc409182478f8d52c22c9",
    "restore_matches": true
  },
  {
    "id": "L3.CI3d",
    "command": "ulimit -u 3469; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
    "threads": 1969,
    "exit": 1,
    "result": "3 failed | 42 passed (45)",
    "at": [
      "test/ci-workflow.test.ts:262",
      "test/ci-workflow.test.ts:380",
      "test/ci-workflow.test.ts:535"
    ],
    "restored_sha256": "bd900ed534be4a3cecf0cc530503ee5a0f7d36e0afebc409182478f8d52c22c9",
    "restore_matches": true
  },
  {
    "id": "L3.CI3e",
    "adapted": true,
    "old": "key: ms-playwright-${{ runner.os }}-${{ runner.arch }}-${{ steps.playwright.outputs.os }}-playwright-core-${{ steps.playwright.outputs.version }}",
    "new": "key: ms-playwright-${{ runner.os }}-${{ runner.arch }}-playwright-core-${{ steps.playwright.outputs.version }}",
    "command": "ulimit -u 3456; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
    "threads": 1956,
    "exit": 1,
    "result": "2 failed | 43 passed (45)",
    "at": [
      "test/ci-workflow.test.ts:262",
      "test/ci-workflow.test.ts:389"
    ],
    "restored_sha256": "bd900ed534be4a3cecf0cc530503ee5a0f7d36e0afebc409182478f8d52c22c9",
    "restore_matches": true
  },
  {
    "id": "L3.CI3f",
    "adapted": true,
    "old": "key: ms-playwright-${{ runner.os }}-${{ runner.arch }}-${{ steps.playwright.outputs.os }}-playwright-core-${{ steps.playwright.outputs.version }}",
    "new": "key: ms-playwright-${{ runner.os }}-${{ steps.playwright.outputs.os }}-playwright-core-${{ steps.playwright.outputs.version }}",
    "command": "ulimit -u 3456; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
    "threads": 1956,
    "exit": 1,
    "result": "2 failed | 43 passed (45)",
    "at": [
      "test/ci-workflow.test.ts:262",
      "test/ci-workflow.test.ts:388"
    ],
    "restored_sha256": "bd900ed534be4a3cecf0cc530503ee5a0f7d36e0afebc409182478f8d52c22c9",
    "restore_matches": true
  },
  {
    "id": "L3.CI3g",
    "command": "ulimit -u 3462; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
    "threads": 1962,
    "exit": 1,
    "result": "6 failed | 39 passed (45)",
    "at": [
      "test/ci-workflow.test.ts:410",
      "test/ci-workflow.test.ts:430"
    ],
    "restored_sha256": "bd900ed534be4a3cecf0cc530503ee5a0f7d36e0afebc409182478f8d52c22c9",
    "restore_matches": true
  },
  {
    "id": "L3.CI3h",
    "command": "ulimit -u 3455; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
    "threads": 1955,
    "exit": 1,
    "result": "2 failed | 43 passed (45)",
    "at": [
      "test/ci-workflow.test.ts:460"
    ],
    "restored_sha256": "bd900ed534be4a3cecf0cc530503ee5a0f7d36e0afebc409182478f8d52c22c9",
    "restore_matches": true
  },
  {
    "id": "L3.CI3i",
    "command": "ulimit -u 3429; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
    "threads": 1929,
    "exit": 1,
    "result": "1 failed | 44 passed (45)",
    "at": [
      "test/ci-workflow.test.ts:460"
    ],
    "restored_sha256": "bd900ed534be4a3cecf0cc530503ee5a0f7d36e0afebc409182478f8d52c22c9",
    "restore_matches": true
  },
  {
    "id": "L3.CI4a",
    "command": "ulimit -u 3398; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
    "threads": 1898,
    "exit": 1,
    "result": "3 failed | 42 passed (45)",
    "at": [
      "test/ci-workflow.test.ts:262",
      "test/ci-workflow.test.ts:470",
      "test/ci-workflow.test.ts:478"
    ],
    "restored_sha256": "bd900ed534be4a3cecf0cc530503ee5a0f7d36e0afebc409182478f8d52c22c9",
    "restore_matches": true
  },
  {
    "id": "L3.CI4b",
    "adapted": true,
    "old": "      - uses: actions/cache@55cc8345863c7cc4c66a329aec7e433d2d1c52a9 # v6.1.0\n        with:\n          path: ${{ steps.playwright.outputs.browsers }}\n",
    "new": "      - uses: actions/cache@55cc8345863c7cc4c66a329aec7e433d2d1c52a9\n        with:\n          path: ${{ steps.playwright.outputs.browsers }}\n",
    "command": "ulimit -u 3400; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
    "threads": 1900,
    "exit": 1,
    "result": "1 failed | 44 passed (45)",
    "at": [
      "test/ci-workflow.test.ts:470"
    ],
    "restored_sha256": "bd900ed534be4a3cecf0cc530503ee5a0f7d36e0afebc409182478f8d52c22c9",
    "restore_matches": true
  },
  {
    "id": "L3.CI4c",
    "command": "ulimit -u 3411; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
    "threads": 1911,
    "exit": 1,
    "result": "3 failed | 42 passed (45)",
    "at": [
      "test/ci-workflow.test.ts:262",
      "test/ci-workflow.test.ts:277",
      "test/ci-workflow.test.ts:471"
    ],
    "restored_sha256": "bd900ed534be4a3cecf0cc530503ee5a0f7d36e0afebc409182478f8d52c22c9",
    "restore_matches": true
  },
  {
    "id": "L3.CI4d",
    "command": "ulimit -u 3446; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
    "threads": 1946,
    "exit": 1,
    "result": "3 failed | 42 passed (45)",
    "at": [
      "test/ci-workflow.test.ts:262",
      "test/ci-workflow.test.ts:277",
      "test/ci-workflow.test.ts:473"
    ],
    "restored_sha256": "bd900ed534be4a3cecf0cc530503ee5a0f7d36e0afebc409182478f8d52c22c9",
    "restore_matches": true
  },
  {
    "id": "L3.CI4e",
    "command": "ulimit -u 3469; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
    "threads": 1969,
    "exit": 1,
    "result": "2 failed | 43 passed (45)",
    "at": [
      "test/ci-workflow.test.ts:250",
      "test/ci-workflow.test.ts:474"
    ],
    "restored_sha256": "bd900ed534be4a3cecf0cc530503ee5a0f7d36e0afebc409182478f8d52c22c9",
    "restore_matches": true
  },
  {
    "id": "L3.R1",
    "command": "ulimit -u 3489; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
    "threads": 1989,
    "exit": 1,
    "result": "1 failed | 44 passed (45)",
    "at": [
      "test/ci-workflow.test.ts:303"
    ],
    "restored_sha256": "bd900ed534be4a3cecf0cc530503ee5a0f7d36e0afebc409182478f8d52c22c9",
    "restore_matches": true
  },
  {
    "id": "L3.R2",
    "command": "ulimit -u 3476; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
    "threads": 1976,
    "exit": 1,
    "result": "1 failed | 44 passed (45)",
    "at": [
      "test/ci-workflow.test.ts:303"
    ],
    "restored_sha256": "bd900ed534be4a3cecf0cc530503ee5a0f7d36e0afebc409182478f8d52c22c9",
    "restore_matches": true
  }
]
```

### Fix round: the review's findings (contract-1, S1, E1, S2, S3)

Five confirmed findings, from three review lenses, on the follow-up above. Three of them (contract-1, S1, E1) are one defect. The rows above stay as measured; where the fix changed the text a row mutates, the row is re-measured below, adapted or retired.

**What the review found.**

- **contract-1, S1, E1: the step budget left out the cleanup.** `sudo dpkg --configure -a` ran between the attempts with no bound of its own, and L3.CI2 summed only `2 × 630 s + 5 s = 1,265 s`. The sentence above ("The step budget still fits … the CI2 budget row now counts the wait") was true of the wait and silent about the configure run. After an attempt 1 cut off in the middle of dpkg, a configure run with triggers longer than the 55 s left over would have let the 22-minute step limit cut attempt 2 short of its own `timeout -k 30 600`, with L3.CI2 still green.
- **S2: the archive directory under `$RUNNER_TEMP` probably cost apt its download sandbox.** apt downloads as its `_apt` user only when that user can reach `partial/`. `RUNNER_TEMP` sits under the runner's home, and a home directory closed to other users would make apt fall back to "Download is performed unsandboxed as root". Before the follow-up, the archive directory was apt's own `/var/cache/apt/archives`.
- **S3: an exact key with no fallback is saved once and never refreshed.** `actions/cache` skips the save on an exact hit, so every package Ubuntu updates after the first save would be fetched from the mirror on every warm job, for as long as the playwright-core pin and the OS release stood. That is the exposure the follow-up exists to remove.

**What changed** (`.github/workflows/ci.yml`; every Task 17 guard stays: apt retries and timeouts, the lock timeout, two attempts under `timeout -k 30 600`, the 22-minute step, the 45-minute job, the browser cache, sha pins, no local `uses:`):

- **The configure run is bounded and counted.** It is now `sudo timeout -k 5 40 dpkg --configure -a`, with the `timeout` inside sudo so that its signals reach the root dpkg. A failure, a timeout included, is still a warning, and attempt 2 still runs and decides the step. The budget is 2 × (600 + 30) s + 5 s + (40 + 5) s = 1,310 s. That leaves 10 s of the 1,320 s step limit for the two `sudo pkill` calls, which send one signal each and return; they are now the only commands in the step with no bound of their own. L3.CI2 requires every `dpkg --configure` line to run as `sudo timeout -k K N dpkg`, adds every `timeout` bound other than the attempts' and every `sleep` to the sum, and requires the total to leave that 10 s allowance. A configure run killed at its bound leaves dpkg interrupted, and attempt 2's apt then refuses to run, so that job fails. It still fails within the step limit, and nothing in it runs past its own bound.
- **The archive directory is the fixed path `/var/cache/docserver-apt-archives`.** `/var/cache` is apt's own cache root, which `_apt` can traverse. The version step names it (output `archives`). It no longer reads `RUNNER_TEMP`, so its `RUNNER_TEMP` check went with it. The apt step now runs **before** the two cache steps. It checks the directory as before, then makes it and `partial/` with `sudo install -d -o <runner uid> -g <runner gid> -m 0755`. The cache step therefore restores into a directory the runner owns: without that, a restore into `/var/cache` would fail as the runner, and every job would be cold. The apt step then runs `sudo -u _apt test -x "$ARCHIVES/partial"` and fails the step with an `::error::` line, before any apt configuration is written, if `_apt` cannot reach `partial/`. So an unsandboxed download is refused in CI, not just warned about in a log nobody reads.
- **The apt cache key rolls weekly and falls back.** The version step also outputs the ISO week (`date -u +%G-W%V`, checked as `NNNN-WNN`). The key is `apt-archives-<runner OS>-<arch>-<OS release>-playwright-core-<version>-<week>`, and `restore-keys` is that key without its week: the same four inputs, ended by the separator, so it never matches another pin's entries. A job in a new week restores the newest entry with the same four inputs and saves a fresh one that also holds whatever Ubuntu updated since. Within a week an exact hit saves nothing, as before. The browser cache keeps its exact key with no fallback (L3.CI3, unchanged).
- The version step's name gains "the ISO week".

**Tests first.** The new and changed tests were written before `ci.yml` changed. Against the unfixed file (`ci.yml` sha256 `bd900ed534be4a3cecf0cc530503ee5a0f7d36e0afebc409182478f8d52c22c9`) they ran 17 failed | 33 passed (50), every failure an assertion. With the fix they ran 50 passed (50). Two fakes join the stand-ins. `date` answers only `-u +%G-W%V`, with a fixed week or the row's `FAKE_WEEK`. `sudo` given `-u <user>` runs the command as the caller, or fails when `FAKE_SUDO_U=deny`. The apt step's calls are recorded in the same ordered log as the cleanup's. The rows cover:

- L3.CI2: the budget, as above.
- L3.CI5:
  - the fixed path, whatever `RUNNER_TEMP` and `HOME` say;
  - four week refusals, each writing no output;
  - the apt step's exact calls (`install -d`, the `_apt` check, `tee`), with both directories owned by the runner at mode 0755;
  - the unreachable-`partial/` refusal, which writes no configuration;
  - the four existing refusals, each now also making no directory.
- L3.CI6: the apt cache sits after the apt step and before the install, with `with` exactly `{path, key, restore-keys}`, the key equal to the prefix plus the week, and neither cache's key a prefix of the other's.

**Method** as at the top of this file, one row at a time on the fixed code: `.github/workflows/ci.yml` sha256 `945f4404a3f07d48488e75e12e1f31a706452c589bd5d6b0adcbabc500dad5b2`, `test/ci-workflow.test.ts` sha256 `24bf3d4ebe855ec1ea0ee61ca6e91e5723d0d1aafc59c94c9571f2735c8bed73`. The 16 new rows and the 56 re-measured or adapted ones were all red (exit 1), through assertion failures only, and all 72 restores matched the saved sha256. Two rows are retired, each with its reason in the table. Every command was `ulimit -u <threads + 1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts`; each row's thread count is in its JSON.

#### New rows

| Row | Guard | Change | Exit | Red (tests in `test/ci-workflow.test.ts`) | Restore |
|---|---|---|---|---|---|
| L3.CI2f | dpkg --configure -a runs under a bound of its own | `              sudo timeout -k 5 40 dpkg --configure -a` → `              sudo dpkg --configure -a` | 1 | 5 failed \| 45 passed (50). "L3.CI2: the install step runs INSTALL under `timeout -k 30 600`, in a loop of exactly two attempts that both fit in its own step timeout, with everything between them bounded and counted"; "L3.CI7: before attempt 2 only, the install step stops a leftover apt-get or dpkg (TERM, a wait, then KILL, by exact name, under sudo) and finishes dpkg's configuration: an install that fails twice: the cleanup runs once, between the attempts"; "L3.CI7: before attempt 2 only, the install step stops a leftover apt-get or dpkg (TERM, a wait, then KILL, by exact name, under sudo) and finishes dpkg's configuration: an install that fails, then succeeds: the cleanup runs once, before attempt 2"; "L3.CI7: with no leftover process to stop, the cleanup goes on to attempt 2 (pkill answering 1 does not end the step)"; "L3.CI7: a failing `dpkg --configure -a` is reported, and attempt 2 still runs and decides the step". | sha256 matched |
| L3.CI2g | the configure bound fits the step budget | `sudo timeout -k 5 40 dpkg` → `sudo timeout -k 5 41 dpkg` | 1 | 5 failed \| 45 passed (50). "L3.CI2: the install step runs INSTALL under `timeout -k 30 600`, in a loop of exactly two attempts that both fit in its own step timeout, with everything between them bounded and counted"; "L3.CI7: before attempt 2 only, the install step stops a leftover apt-get or dpkg (TERM, a wait, then KILL, by exact name, under sudo) and finishes dpkg's configuration: an install that fails twice: the cleanup runs once, between the attempts"; "L3.CI7: before attempt 2 only, the install step stops a leftover apt-get or dpkg (TERM, a wait, then KILL, by exact name, under sudo) and finishes dpkg's configuration: an install that fails, then succeeds: the cleanup runs once, before attempt 2"; "L3.CI7: with no leftover process to stop, the cleanup goes on to attempt 2 (pkill answering 1 does not end the step)"; "L3.CI7: a failing `dpkg --configure -a` is reported, and attempt 2 still runs and decides the step". | sha256 matched |
| L3.CI2h | the bound runs inside sudo, so it reaches the root dpkg | `sudo timeout -k 5 40 dpkg` → `timeout -k 5 40 sudo dpkg` | 1 | 5 failed \| 45 passed (50). "L3.CI2: the install step runs INSTALL under `timeout -k 30 600`, in a loop of exactly two attempts that both fit in its own step timeout, with everything between them bounded and counted"; "L3.CI7: before attempt 2 only, the install step stops a leftover apt-get or dpkg (TERM, a wait, then KILL, by exact name, under sudo) and finishes dpkg's configuration: an install that fails twice: the cleanup runs once, between the attempts"; "L3.CI7: before attempt 2 only, the install step stops a leftover apt-get or dpkg (TERM, a wait, then KILL, by exact name, under sudo) and finishes dpkg's configuration: an install that fails, then succeeds: the cleanup runs once, before attempt 2"; "L3.CI7: with no leftover process to stop, the cleanup goes on to attempt 2 (pkill answering 1 does not end the step)"; "L3.CI7: a failing `dpkg --configure -a` is reported, and attempt 2 still runs and decides the step". | sha256 matched |
| L3.CI5j | the directory is under /var/cache, not the runner's temporary directory | `archives=/var/cache/docserver-apt-archives` → `archives="${RUNNER_TEMP:?}/docserver-apt-archives"` | 1 | 7 failed \| 43 passed (50). "L3.CI3: the version step reads exactly the playwright-core pin from package.json, so the key embeds it, and names the directory playwright-core installs into with XDG_CACHE_HOME unset: .cache/ms-playwright under HOME"; "L3.CI3: the version step reads exactly the playwright-core pin from package.json, so the key embeds it, and names the directory playwright-core installs into with XDG_CACHE_HOME set: ms-playwright under it"; "L3.CI3: the version step names the OS release playwright-core picks its builds by, so a new runner release is a new key: Ubuntu 22.04"; "L3.CI3: the version step names the OS release playwright-core picks its builds by, so a new runner release is a new key: Ubuntu 24.04"; "L3.CI3: the version step names the OS release playwright-core picks its builds by, so a new runner release is a new key: Ubuntu 26.04, unquoted"; "L3.CI3: the version step names the OS release playwright-core picks its builds by, so a new runner release is a new key: Debian 12"; "L3.CI5: the version step names apt's archive directory, a fixed path under /var/cache that apt's download user can traverse, whatever the runner's temporary or home directory says". | sha256 matched |
| L3.CI5k | the directory is made under sudo | `          sudo install -d -o` → `          install -d -o` | 1 | 1 failed \| 49 passed (50). "L3.CI5: the apt step makes the archive directory and its partial/ subdirectory, owned by the runner, checks that apt's download user can reach partial/, then points apt's archive cache there". | sha256 matched |
| L3.CI5l | the directory is owned by the runner, so the cache can restore into it | `install -d -o "$(id -u)" -g "$(id -g)" -m 0755` → `install -d -m 0755` | 1 | 1 failed \| 49 passed (50). "L3.CI5: the apt step makes the archive directory and its partial/ subdirectory, owned by the runner, checks that apt's download user can reach partial/, then points apt's archive cache there". | sha256 matched |
| L3.CI5m | partial/ is made too | `-m 0755 "$ARCHIVES" "$ARCHIVES/partial"` → `-m 0755 "$ARCHIVES"` | 1 | 2 failed \| 48 passed (50). "L3.CI1: an apt step before the install writes the retries and the two timeouts to its own apt configuration file"; "L3.CI5: the apt step makes the archive directory and its partial/ subdirectory, owned by the runner, checks that apt's download user can reach partial/, then points apt's archive cache there". | sha256 matched |
| L3.CI5n | the _apt reach check runs | `          sudo -u _apt test -x "$ARCHIVES/partial" \|\| { ⏎             echo ":…` → (deleted) | 1 | 2 failed \| 48 passed (50). "L3.CI5: the apt step makes the archive directory and its partial/ subdirectory, owned by the runner, checks that apt's download user can reach partial/, then points apt's archive cache there"; "L3.CI5: the apt step fails, and writes no apt configuration, when apt's download user cannot reach partial/ (apt would then download as root, unsandboxed)". | sha256 matched |
| L3.CI5o | an unreachable partial/ fails the step | `            exit 1 ⏎           } ⏎ ` → `          } ⏎ ` | 1 | 1 failed \| 49 passed (50). "L3.CI5: the apt step fails, and writes no apt configuration, when apt's download user cannot reach partial/ (apt would then download as root, unsandboxed)". | sha256 matched |
| L3.CI5p | the version step refuses a malformed week | `          [[ "$week" =~ ^[0-9]{4}-W[0-9]{2}$ ]] ⏎ ` → (deleted) | 1 | 4 failed \| 46 passed (50). "L3.CI5: the version step fails, and writes no key part, when the ISO week reads as an empty answer"; "L3.CI5: the version step fails, and writes no key part, when the ISO week reads as a week with no year"; "L3.CI5: the version step fails, and writes no key part, when the ISO week reads as a week with no W"; "L3.CI5: the version step fails, and writes no key part, when the ISO week reads as a week with a quote". | sha256 matched |
| L3.CI5q | the version step outputs the week | `"os=$os" "week=$week"` → `"os=$os"` | 1 | 2 failed \| 48 passed (50). "L3.CI3: the version step reads exactly the playwright-core pin from package.json, so the key embeds it, and names the directory playwright-core installs into with XDG_CACHE_HOME unset: .cache/ms-playwright under HOME"; "L3.CI3: the version step reads exactly the playwright-core pin from package.json, so the key embeds it, and names the directory playwright-core installs into with XDG_CACHE_HOME set: ms-playwright under it". | sha256 matched |
| L3.CI5r | the week is read in UTC | `date -u +%G-W%V` → `date +%G-W%V` | 1 | 7 failed \| 43 passed (50). "L3.CI3: the version step reads exactly the playwright-core pin from package.json, so the key embeds it, and names the directory playwright-core installs into with XDG_CACHE_HOME unset: .cache/ms-playwright under HOME"; "L3.CI3: the version step reads exactly the playwright-core pin from package.json, so the key embeds it, and names the directory playwright-core installs into with XDG_CACHE_HOME set: ms-playwright under it"; "L3.CI3: the version step names the OS release playwright-core picks its builds by, so a new runner release is a new key: Ubuntu 22.04"; "L3.CI3: the version step names the OS release playwright-core picks its builds by, so a new runner release is a new key: Ubuntu 24.04"; "L3.CI3: the version step names the OS release playwright-core picks its builds by, so a new runner release is a new key: Ubuntu 26.04, unquoted"; "L3.CI3: the version step names the OS release playwright-core picks its builds by, so a new runner release is a new key: Debian 12"; "L3.CI5: the version step names apt's archive directory, a fixed path under /var/cache that apt's download user can traverse, whatever the runner's temporary or home directory says". | sha256 matched |
| L3.CI6m | the apt key rolls with the week | `${{ steps.playwright.outputs.version }}-${{ steps.playwright.outputs.week }} ⏎ ` → `${{ steps.playwright.outputs.version }} ⏎ ` | 1 | 2 failed \| 48 passed (50). "checks out full history, keeps no credentials in the workspace, sets up the matrix Node with the npm cache, and caches the browsers, each action pinned by commit sha"; "L3.CI6: a second cache step, with the browser cache's pinned action, restores and saves apt's archive directory after the apt step made it and before the install, keyed on the runner OS, architecture, OS release, the pinned playwright-core and the ISO week, falling back to the newest entry with the same four". | sha256 matched |
| L3.CI6n | the apt cache falls back to the last week's entry | `          restore-keys: apt-archives-${{ runner.os }}-${{ runner.arch }}-${{ st…` → (deleted) | 1 | 2 failed \| 48 passed (50). "checks out full history, keeps no credentials in the workspace, sets up the matrix Node with the npm cache, and caches the browsers, each action pinned by commit sha"; "L3.CI6: a second cache step, with the browser cache's pinned action, restores and saves apt's archive directory after the apt step made it and before the install, keyed on the runner OS, architecture, OS release, the pinned playwright-core and the ISO week, falling back to the newest entry with the same four". | sha256 matched |
| L3.CI6o | the fallback keeps the playwright-core version | `playwright-core-${{ steps.playwright.outputs.version }}- ⏎ ` → `playwright-core- ⏎ ` | 1 | 2 failed \| 48 passed (50). "checks out full history, keeps no credentials in the workspace, sets up the matrix Node with the npm cache, and caches the browsers, each action pinned by commit sha"; "L3.CI6: a second cache step, with the browser cache's pinned action, restores and saves apt's archive directory after the apt step made it and before the install, keyed on the runner OS, architecture, OS release, the pinned playwright-core and the ISO week, falling back to the newest entry with the same four". | sha256 matched |
| L3.CI6p | the directory exists, owned by the runner, before the apt cache restores into it | `      - name: apt retries and timeouts ⏎         env: ⏎           ARCHIVES: ${{…` → (deleted), moved after `          restore-keys: apt-archives-${{ runner.os }}-${{ r…` | 1 | 2 failed \| 48 passed (50). "installs from the lock, reads the playwright-core pin, configures apt and makes its archive directory, restores the browser cache and the apt archive cache, installs the browsers, makes the apt archive cache readable, typechecks, tests, checks the tests wrote no layout snapshot, builds, runs the ratchet, then packs and smokes the tarball"; "L3.CI6: a second cache step, with the browser cache's pinned action, restores and saves apt's archive directory after the apt step made it and before the install, keyed on the runner OS, architecture, OS release, the pinned playwright-core and the ISO week, falling back to the newest entry with the same four". | sha256 matched |

```json
[
 {
  "id": "L3.CI2f",
  "guard": "dpkg --configure -a runs under a bound of its own",
  "old": "              sudo timeout -k 5 40 dpkg --configure -a",
  "new": "              sudo dpkg --configure -a",
  "command": "ulimit -u 3384; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
  "threads": 1884,
  "exit": 1,
  "result": "5 failed | 45 passed (50)",
  "at": [
   "test/ci-workflow.test.ts:395",
   "test/ci-workflow.test.ts:665",
   "test/ci-workflow.test.ts:674",
   "test/ci-workflow.test.ts:683"
  ],
  "restored_sha256": "945f4404a3f07d48488e75e12e1f31a706452c589bd5d6b0adcbabc500dad5b2",
  "restore_matches": true
 },
 {
  "id": "L3.CI2g",
  "guard": "the configure bound fits the step budget",
  "old": "sudo timeout -k 5 40 dpkg",
  "new": "sudo timeout -k 5 41 dpkg",
  "command": "ulimit -u 3377; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
  "threads": 1877,
  "exit": 1,
  "result": "5 failed | 45 passed (50)",
  "at": [
   "test/ci-workflow.test.ts:400",
   "test/ci-workflow.test.ts:665",
   "test/ci-workflow.test.ts:674",
   "test/ci-workflow.test.ts:683"
  ],
  "restored_sha256": "945f4404a3f07d48488e75e12e1f31a706452c589bd5d6b0adcbabc500dad5b2",
  "restore_matches": true
 },
 {
  "id": "L3.CI2h",
  "guard": "the bound runs inside sudo, so it reaches the root dpkg",
  "old": "sudo timeout -k 5 40 dpkg",
  "new": "timeout -k 5 40 sudo dpkg",
  "command": "ulimit -u 3379; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
  "threads": 1879,
  "exit": 1,
  "result": "5 failed | 45 passed (50)",
  "at": [
   "test/ci-workflow.test.ts:395",
   "test/ci-workflow.test.ts:665",
   "test/ci-workflow.test.ts:674",
   "test/ci-workflow.test.ts:683"
  ],
  "restored_sha256": "945f4404a3f07d48488e75e12e1f31a706452c589bd5d6b0adcbabc500dad5b2",
  "restore_matches": true
 },
 {
  "id": "L3.CI5j",
  "guard": "the directory is under /var/cache, not the runner's temporary directory",
  "old": "archives=/var/cache/docserver-apt-archives",
  "new": "archives=\"${RUNNER_TEMP:?}/docserver-apt-archives\"",
  "command": "ulimit -u 3398; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
  "threads": 1898,
  "exit": 1,
  "result": "7 failed | 43 passed (50)",
  "at": [
   "test/ci-workflow.test.ts:444",
   "test/ci-workflow.test.ts:463",
   "test/ci-workflow.test.ts:528"
  ],
  "restored_sha256": "945f4404a3f07d48488e75e12e1f31a706452c589bd5d6b0adcbabc500dad5b2",
  "restore_matches": true
 },
 {
  "id": "L3.CI5k",
  "guard": "the directory is made under sudo",
  "old": "          sudo install -d -o",
  "new": "          install -d -o",
  "command": "ulimit -u 3372; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
  "threads": 1872,
  "exit": 1,
  "result": "1 failed | 49 passed (50)",
  "at": [
   "test/ci-workflow.test.ts:559"
  ],
  "restored_sha256": "945f4404a3f07d48488e75e12e1f31a706452c589bd5d6b0adcbabc500dad5b2",
  "restore_matches": true
 },
 {
  "id": "L3.CI5l",
  "guard": "the directory is owned by the runner, so the cache can restore into it",
  "old": "install -d -o \"$(id -u)\" -g \"$(id -g)\" -m 0755",
  "new": "install -d -m 0755",
  "command": "ulimit -u 3382; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
  "threads": 1882,
  "exit": 1,
  "result": "1 failed | 49 passed (50)",
  "at": [
   "test/ci-workflow.test.ts:559"
  ],
  "restored_sha256": "945f4404a3f07d48488e75e12e1f31a706452c589bd5d6b0adcbabc500dad5b2",
  "restore_matches": true
 },
 {
  "id": "L3.CI5m",
  "guard": "partial/ is made too",
  "old": "-m 0755 \"$ARCHIVES\" \"$ARCHIVES/partial\"",
  "new": "-m 0755 \"$ARCHIVES\"",
  "command": "ulimit -u 3379; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
  "threads": 1879,
  "exit": 1,
  "result": "2 failed | 48 passed (50)",
  "at": [
   "test/ci-workflow.test.ts:375",
   "test/ci-workflow.test.ts:556"
  ],
  "restored_sha256": "945f4404a3f07d48488e75e12e1f31a706452c589bd5d6b0adcbabc500dad5b2",
  "restore_matches": true
 },
 {
  "id": "L3.CI5n",
  "guard": "the _apt reach check runs",
  "old": "          sudo -u _apt test -x \"$ARCHIVES/partial\" || {\n            echo \"::error::_apt cannot reach $ARCHIVES/partial, so apt would download as root, unsandboxed\"\n            exit 1\n          }\n",
  "new": "",
  "command": "ulimit -u 3401; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
  "threads": 1901,
  "exit": 1,
  "result": "2 failed | 48 passed (50)",
  "at": [
   "test/ci-workflow.test.ts:559",
   "test/ci-workflow.test.ts:584"
  ],
  "restored_sha256": "945f4404a3f07d48488e75e12e1f31a706452c589bd5d6b0adcbabc500dad5b2",
  "restore_matches": true
 },
 {
  "id": "L3.CI5o",
  "guard": "an unreachable partial/ fails the step",
  "old": "            exit 1\n          }\n",
  "new": "          }\n",
  "command": "ulimit -u 3412; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
  "threads": 1912,
  "exit": 1,
  "result": "1 failed | 49 passed (50)",
  "at": [
   "test/ci-workflow.test.ts:584"
  ],
  "restored_sha256": "945f4404a3f07d48488e75e12e1f31a706452c589bd5d6b0adcbabc500dad5b2",
  "restore_matches": true
 },
 {
  "id": "L3.CI5p",
  "guard": "the version step refuses a malformed week",
  "old": "          [[ \"$week\" =~ ^[0-9]{4}-W[0-9]{2}$ ]]\n",
  "new": "",
  "command": "ulimit -u 3405; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
  "threads": 1905,
  "exit": 1,
  "result": "4 failed | 46 passed (50)",
  "at": [
   "test/ci-workflow.test.ts:542"
  ],
  "restored_sha256": "945f4404a3f07d48488e75e12e1f31a706452c589bd5d6b0adcbabc500dad5b2",
  "restore_matches": true
 },
 {
  "id": "L3.CI5q",
  "guard": "the version step outputs the week",
  "old": "\"os=$os\" \"week=$week\"",
  "new": "\"os=$os\"",
  "command": "ulimit -u 3444; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
  "threads": 1944,
  "exit": 1,
  "result": "2 failed | 48 passed (50)",
  "at": [
   "test/ci-workflow.test.ts:445"
  ],
  "restored_sha256": "945f4404a3f07d48488e75e12e1f31a706452c589bd5d6b0adcbabc500dad5b2",
  "restore_matches": true
 },
 {
  "id": "L3.CI5r",
  "guard": "the week is read in UTC",
  "old": "date -u +%G-W%V",
  "new": "date +%G-W%V",
  "command": "ulimit -u 3441; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
  "threads": 1941,
  "exit": 1,
  "result": "7 failed | 43 passed (50)",
  "at": [
   "test/ci-workflow.test.ts:444",
   "test/ci-workflow.test.ts:463",
   "test/ci-workflow.test.ts:528"
  ],
  "restored_sha256": "945f4404a3f07d48488e75e12e1f31a706452c589bd5d6b0adcbabc500dad5b2",
  "restore_matches": true
 },
 {
  "id": "L3.CI6m",
  "guard": "the apt key rolls with the week",
  "old": "${{ steps.playwright.outputs.version }}-${{ steps.playwright.outputs.week }}\n",
  "new": "${{ steps.playwright.outputs.version }}\n",
  "command": "ulimit -u 3419; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
  "threads": 1919,
  "exit": 1,
  "result": "2 failed | 48 passed (50)",
  "at": [
   "test/ci-workflow.test.ts:289",
   "test/ci-workflow.test.ts:610"
  ],
  "restored_sha256": "945f4404a3f07d48488e75e12e1f31a706452c589bd5d6b0adcbabc500dad5b2",
  "restore_matches": true
 },
 {
  "id": "L3.CI6n",
  "guard": "the apt cache falls back to the last week's entry",
  "old": "          restore-keys: apt-archives-${{ runner.os }}-${{ runner.arch }}-${{ steps.playwright.outputs.os }}-playwright-core-${{ steps.playwright.outputs.version }}-\n",
  "new": "",
  "command": "ulimit -u 3403; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
  "threads": 1903,
  "exit": 1,
  "result": "2 failed | 48 passed (50)",
  "at": [
   "test/ci-workflow.test.ts:289",
   "test/ci-workflow.test.ts:610"
  ],
  "restored_sha256": "945f4404a3f07d48488e75e12e1f31a706452c589bd5d6b0adcbabc500dad5b2",
  "restore_matches": true
 },
 {
  "id": "L3.CI6o",
  "guard": "the fallback keeps the playwright-core version",
  "old": "playwright-core-${{ steps.playwright.outputs.version }}-\n",
  "new": "playwright-core-\n",
  "command": "ulimit -u 3397; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
  "threads": 1897,
  "exit": 1,
  "result": "2 failed | 48 passed (50)",
  "at": [
   "test/ci-workflow.test.ts:289",
   "test/ci-workflow.test.ts:610"
  ],
  "restored_sha256": "945f4404a3f07d48488e75e12e1f31a706452c589bd5d6b0adcbabc500dad5b2",
  "restore_matches": true
 },
 {
  "id": "L3.CI6p",
  "guard": "the directory exists, owned by the runner, before the apt cache restores into it",
  "old": "      - name: apt retries and timeouts\n        env:\n          ARCHIVES: ${{ steps.playwright.outputs.archives }}\n        run: |\n          [[ \"${ARCHIVES:?}\" =~ ^/[A-Za-z0-9._/-]+$ ]]\n          sudo install -d -o \"$(id -u)\" -g \"$(id -g)\" -m 0755 \"$ARCHIVES\" \"$ARCHIVES/partial\"\n          sudo -u _apt test -x \"$ARCHIVES/partial\" || {\n            echo \"::error::_apt cannot reach $ARCHIVES/partial, so apt would download as root, unsandboxed\"\n            exit 1\n          }\n          printf '%s\\n' 'Acquire::Retries \"5\";' 'Acquire::http::Timeout \"30\";' 'Acquire::https::Timeout \"30\";' \\\n            'DPkg::Lock::Timeout \"300\";' \\\n            'APT::Keep-Downloaded-Packages \"true\";' \"Dir::Cache::Archives \\\"$ARCHIVES/\\\";\" \\\n            | sudo tee /etc/apt/apt.conf.d/80-docserver-ci > /dev/null\n",
  "new": "",
  "after": {
   "anchor": "          restore-keys: apt-archives-${{ runner.os }}-${{ runner.arch }}-${{ steps.playwright.outputs.os }}-playwright-core-${{ steps.playwright.outputs.version }}-\n",
   "insert": "      - name: apt retries and timeouts\n        env:\n          ARCHIVES: ${{ steps.playwright.outputs.archives }}\n        run: |\n          [[ \"${ARCHIVES:?}\" =~ ^/[A-Za-z0-9._/-]+$ ]]\n          sudo install -d -o \"$(id -u)\" -g \"$(id -g)\" -m 0755 \"$ARCHIVES\" \"$ARCHIVES/partial\"\n          sudo -u _apt test -x \"$ARCHIVES/partial\" || {\n            echo \"::error::_apt cannot reach $ARCHIVES/partial, so apt would download as root, unsandboxed\"\n            exit 1\n          }\n          printf '%s\\n' 'Acquire::Retries \"5\";' 'Acquire::http::Timeout \"30\";' 'Acquire::https::Timeout \"30\";' \\\n            'DPkg::Lock::Timeout \"300\";' \\\n            'APT::Keep-Downloaded-Packages \"true\";' \"Dir::Cache::Archives \\\"$ARCHIVES/\\\";\" \\\n            | sudo tee /etc/apt/apt.conf.d/80-docserver-ci > /dev/null\n"
  },
  "command": "ulimit -u 3429; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
  "threads": 1929,
  "exit": 1,
  "result": "2 failed | 48 passed (50)",
  "at": [
   "test/ci-workflow.test.ts:304",
   "test/ci-workflow.test.ts:607"
  ],
  "restored_sha256": "945f4404a3f07d48488e75e12e1f31a706452c589bd5d6b0adcbabc500dad5b2",
  "restore_matches": true
 }
]
```

#### Every earlier follow-up row and every existing Task 17 row, re-measured on the fixed code

Forty-three rows apply unchanged ("as recorded above"). Thirteen are adapted, because the text they mutate changed: the apt step moved and gained lines (L3.CI1b, L3.CI5b), the directory is fixed (L3.CI5i), the key line now ends in the week and the prefix occurs a second time in `restore-keys` (L3.CI6a to L3.CI6d, L3.CI6f, L3.CI6g), the configure line gained its bound (L3.CI7e, L3.CI7j, L3.CI7l), and L3.CI6h ("no fallback key") is inverted by S3: it now mutates the fallback into one broader than the four inputs (`restore-keys: apt-archives-`), which the tests refuse. L3.CI5c and L3.CI5h are retired.

| Row | On the fixed `ci.yml` | Exit | Red (`test/ci-workflow.test.ts`; failing tests named for adapted rows, in the logs for the rest) | Restore |
|---|---|---|---|---|
| L3.CI5a | as recorded above | 1 | 2 failed \| 48 passed (50) | sha256 matched |
| L3.CI5b | adapted: `          sudo install -d -o "$(id -u)" -g "$(id -g)" -m 07…` → (deleted) | 1 | 2 failed \| 48 passed (50). "L3.CI1: an apt step before the install writes the retries and the two timeouts to its own apt configuration file"; "L3.CI5: the apt step makes the archive directory and its partial/ subdirectory, owned by the runner, checks that apt's download user can reach partial/, then points apt's archive cache there". | sha256 matched |
| L3.CI5c | retired: superseded by L3.CI5m (the line it mutated, `mkdir -p "$ARCHIVES/partial"`, became the `sudo install -d` line; dropping partial/ from it is L3.CI5m) | — | — | — |
| L3.CI5d | as recorded above | 1 | 2 failed \| 48 passed (50) | sha256 matched |
| L3.CI5e | as recorded above | 1 | 4 failed \| 46 passed (50) | sha256 matched |
| L3.CI5f | as recorded above | 1 | 2 failed \| 48 passed (50) | sha256 matched |
| L3.CI5g | as recorded above | 1 | 3 failed \| 47 passed (50) | sha256 matched |
| L3.CI5h | retired: the version step no longer checks the directory, which is now the fixed `/var/cache/docserver-apt-archives` pinned by L3.CI5; the apt step's own check stays (L3.CI5e) | — | — | — |
| L3.CI5i | adapted: `archives=/var/cache/docserver-apt-archives` → `archives="${HOME:?}/docserver-apt-archives"` | 1 | 3 failed \| 47 passed (50). "L3.CI3: the version step reads exactly the playwright-core pin from package.json, so the key embeds it, and names the directory playwright-core installs into with XDG_CACHE_HOME unset: .cache/ms-playwright under HOME"; "L3.CI3: the version step reads exactly the playwright-core pin from package.json, so the key embeds it, and names the directory playwright-core installs into with XDG_CACHE_HOME set: ms-playwright under it"; "L3.CI5: the version step names apt's archive directory, a fixed path under /var/cache that apt's download user can traverse, whatever the runner's temporary or home directory says". | sha256 matched |
| L3.CI6a | adapted: `key: apt-archives-${{ runner.os }}-${{ runner.arch }}-${{ s…` → `key: apt-archives-${{ runner.os }}-${{ runner.arch }}-${{ s…` | 1 | 2 failed \| 48 passed (50). "checks out full history, keeps no credentials in the workspace, sets up the matrix Node with the npm cache, and caches the browsers, each action pinned by commit sha"; "L3.CI6: a second cache step, with the browser cache's pinned action, restores and saves apt's archive directory after the apt step made it and before the install, keyed on the runner OS, architecture, OS release, the pinned playwright-core and the ISO week, falling back to the newest entry with the same four". | sha256 matched |
| L3.CI6b | adapted: `key: apt-archives-${{ runner.os }}-${{ runner.arch }}-${{ s…` → `key: apt-archives-${{ runner.os }}-${{ runner.arch }}-playw…` | 1 | 2 failed \| 48 passed (50). "checks out full history, keeps no credentials in the workspace, sets up the matrix Node with the npm cache, and caches the browsers, each action pinned by commit sha"; "L3.CI6: a second cache step, with the browser cache's pinned action, restores and saves apt's archive directory after the apt step made it and before the install, keyed on the runner OS, architecture, OS release, the pinned playwright-core and the ISO week, falling back to the newest entry with the same four". | sha256 matched |
| L3.CI6c | adapted: `key: apt-archives-${{ runner.os }}-${{ runner.arch }}-${{ s…` → `key: apt-archives-${{ runner.os }}-${{ steps.playwright.out…` | 1 | 2 failed \| 48 passed (50). "checks out full history, keeps no credentials in the workspace, sets up the matrix Node with the npm cache, and caches the browsers, each action pinned by commit sha"; "L3.CI6: a second cache step, with the browser cache's pinned action, restores and saves apt's archive directory after the apt step made it and before the install, keyed on the runner OS, architecture, OS release, the pinned playwright-core and the ISO week, falling back to the newest entry with the same four". | sha256 matched |
| L3.CI6d | adapted: `      - uses: actions/cache@55cc8345863c7cc4c66a3…` moved after `            echo "::warning::browser install atte…` | 1 | 3 failed \| 47 passed (50). "installs from the lock, reads the playwright-core pin, configures apt and makes its archive directory, restores the browser cache and the apt archive cache, installs the browsers, makes the apt archive cache readable, typechecks, tests, checks the tests wrote no layout snapshot, builds, runs the ratchet, then packs and smokes the tarball"; "L3.CI6: a second cache step, with the browser cache's pinned action, restores and saves apt's archive directory after the apt step made it and before the install, keyed on the runner OS, architecture, OS release, the pinned playwright-core and the ISO week, falling back to the newest entry with the same four"; "L3.CI6: right after the install, a step hands apt's archive directory back to the runner and makes everything in it readable, so the cache's save can read what apt wrote as root". | sha256 matched |
| L3.CI6e | as recorded above | 1 | 2 failed \| 48 passed (50) | sha256 matched |
| L3.CI6f | adapted: `      - uses: actions/cache@55cc8345863c7cc4c66a329aec7e433…` → (deleted) | 1 | 3 failed \| 47 passed (50). "checks out full history, keeps no credentials in the workspace, sets up the matrix Node with the npm cache, and caches the browsers, each action pinned by commit sha"; "installs from the lock, reads the playwright-core pin, configures apt and makes its archive directory, restores the browser cache and the apt archive cache, installs the browsers, makes the apt archive cache readable, typechecks, tests, checks the tests wrote no layout snapshot, builds, runs the ratchet, then packs and smokes the tarball"; "L3.CI6: a second cache step, with the browser cache's pinned action, restores and saves apt's archive directory after the apt step made it and before the install, keyed on the runner OS, architecture, OS release, the pinned playwright-core and the ISO week, falling back to the newest entry with the same four". | sha256 matched |
| L3.CI6g | adapted: `key: apt-archives-${{ runner.os }}-${{ runner.arch }}-${{ s…` → `key: ms-playwright-${{ runner.os }}-${{ runner.arch }}-${{ …` | 1 | 2 failed \| 48 passed (50). "checks out full history, keeps no credentials in the workspace, sets up the matrix Node with the npm cache, and caches the browsers, each action pinned by commit sha"; "L3.CI6: a second cache step, with the browser cache's pinned action, restores and saves apt's archive directory after the apt step made it and before the install, keyed on the runner OS, architecture, OS release, the pinned playwright-core and the ISO week, falling back to the newest entry with the same four". | sha256 matched |
| L3.CI6h | adapted: `          restore-keys: apt-archives-${{ runner.os }}-${{ r…` → `          restore-keys: apt-archives- ⏎ ` | 1 | 2 failed \| 48 passed (50). "checks out full history, keeps no credentials in the workspace, sets up the matrix Node with the npm cache, and caches the browsers, each action pinned by commit sha"; "L3.CI6: a second cache step, with the browser cache's pinned action, restores and saves apt's archive directory after the apt step made it and before the install, keyed on the runner OS, architecture, OS release, the pinned playwright-core and the ISO week, falling back to the newest entry with the same four". | sha256 matched |
| L3.CI6i | as recorded above | 1 | 3 failed \| 47 passed (50) | sha256 matched |
| L3.CI6j | as recorded above | 1 | 1 failed \| 49 passed (50) | sha256 matched |
| L3.CI6k | as recorded above | 1 | 1 failed \| 49 passed (50) | sha256 matched |
| L3.CI6l | as recorded above | 1 | 2 failed \| 48 passed (50) | sha256 matched |
| L3.CI7a | as recorded above | 1 | 5 failed \| 45 passed (50) | sha256 matched |
| L3.CI7b | as recorded above | 1 | 4 failed \| 46 passed (50) | sha256 matched |
| L3.CI7c | as recorded above | 1 | 5 failed \| 45 passed (50) | sha256 matched |
| L3.CI7d | as recorded above | 1 | 4 failed \| 46 passed (50) | sha256 matched |
| L3.CI7e | adapted: `              sudo timeout -k 5 40 dpkg --configure -a \|\|…` → (deleted) | 1 | 5 failed \| 45 passed (50). "L3.CI2: the install step runs INSTALL under `timeout -k 30 600`, in a loop of exactly two attempts that both fit in its own step timeout, with everything between them bounded and counted"; "L3.CI7: before attempt 2 only, the install step stops a leftover apt-get or dpkg (TERM, a wait, then KILL, by exact name, under sudo) and finishes dpkg's configuration: an install that fails twice: the cleanup runs once, between the attempts"; "L3.CI7: before attempt 2 only, the install step stops a leftover apt-get or dpkg (TERM, a wait, then KILL, by exact name, under sudo) and finishes dpkg's configuration: an install that fails, then succeeds: the cleanup runs once, before attempt 2"; "L3.CI7: with no leftover process to stop, the cleanup goes on to attempt 2 (pkill answering 1 does not end the step)"; "L3.CI7: a failing `dpkg --configure -a` is reported, and attempt 2 still runs and decides the step". | sha256 matched |
| L3.CI7f | as recorded above | 1 | 4 failed \| 46 passed (50) | sha256 matched |
| L3.CI7g | as recorded above | 1 | 4 failed \| 46 passed (50) | sha256 matched |
| L3.CI7h | as recorded above | 1 | 1 failed \| 49 passed (50) | sha256 matched |
| L3.CI7i | as recorded above | 1 | 1 failed \| 49 passed (50) | sha256 matched |
| L3.CI7j | adapted: `              sudo timeout -k 5 40 dpkg` → `              timeout -k 5 40 dpkg` | 1 | 5 failed \| 45 passed (50). "L3.CI2: the install step runs INSTALL under `timeout -k 30 600`, in a loop of exactly two attempts that both fit in its own step timeout, with everything between them bounded and counted"; "L3.CI7: before attempt 2 only, the install step stops a leftover apt-get or dpkg (TERM, a wait, then KILL, by exact name, under sudo) and finishes dpkg's configuration: an install that fails twice: the cleanup runs once, between the attempts"; "L3.CI7: before attempt 2 only, the install step stops a leftover apt-get or dpkg (TERM, a wait, then KILL, by exact name, under sudo) and finishes dpkg's configuration: an install that fails, then succeeds: the cleanup runs once, before attempt 2"; "L3.CI7: with no leftover process to stop, the cleanup goes on to attempt 2 (pkill answering 1 does not end the step)"; "L3.CI7: a failing `dpkg --configure -a` is reported, and attempt 2 still runs and decides the step". | sha256 matched |
| L3.CI7k | as recorded above | 1 | 5 failed \| 45 passed (50) | sha256 matched |
| L3.CI7l | adapted: `            if [ "$attempt" = 2 ]; then ⏎        …` moved after `            echo "::warning::browser install atte…` | 1 | 4 failed \| 46 passed (50). "L3.CI7: before attempt 2 only, the install step stops a leftover apt-get or dpkg (TERM, a wait, then KILL, by exact name, under sudo) and finishes dpkg's configuration: an install that fails twice: the cleanup runs once, between the attempts"; "L3.CI7: before attempt 2 only, the install step stops a leftover apt-get or dpkg (TERM, a wait, then KILL, by exact name, under sudo) and finishes dpkg's configuration: an install that fails, then succeeds: the cleanup runs once, before attempt 2"; "L3.CI7: with no leftover process to stop, the cleanup goes on to attempt 2 (pkill answering 1 does not end the step)"; "L3.CI7: a failing `dpkg --configure -a` is reported, and attempt 2 still runs and decides the step". | sha256 matched |
| L3.CI1a | as recorded above | 1 | 1 failed \| 49 passed (50) | sha256 matched |
| L3.CI1b | adapted: `      - name: apt retries and timeouts ⏎         …` moved after `            echo "::warning::browser install atte…` | 1 | 4 failed \| 46 passed (50). "installs from the lock, reads the playwright-core pin, configures apt and makes its archive directory, restores the browser cache and the apt archive cache, installs the browsers, makes the apt archive cache readable, typechecks, tests, checks the tests wrote no layout snapshot, builds, runs the ratchet, then packs and smokes the tarball"; "L3.CI1: an apt step before the install writes the retries and the two timeouts to its own apt configuration file"; "L3.CI6: a second cache step, with the browser cache's pinned action, restores and saves apt's archive directory after the apt step made it and before the install, keyed on the runner OS, architecture, OS release, the pinned playwright-core and the ISO week, falling back to the newest entry with the same four"; "L3.CI6: right after the install, a step hands apt's archive directory back to the runner and makes everything in it readable, so the cache's save can read what apt wrote as root". | sha256 matched |
| L3.CI1c | as recorded above | 1 | 1 failed \| 49 passed (50) | sha256 matched |
| L3.CI1d | as recorded above | 1 | 1 failed \| 49 passed (50) | sha256 matched |
| L3.CI2a | as recorded above | 1 | 6 failed \| 44 passed (50) | sha256 matched |
| L3.CI2b | as recorded above | 1 | 1 failed \| 49 passed (50) | sha256 matched |
| L3.CI2c | as recorded above | 1 | 1 failed \| 49 passed (50) | sha256 matched |
| L3.CI2d | as recorded above | 1 | 1 failed \| 49 passed (50) | sha256 matched |
| L3.CI2e | as recorded above | 1 | 6 failed \| 44 passed (50) | sha256 matched |
| L3.CI3a | as recorded above | 1 | 2 failed \| 48 passed (50) | sha256 matched |
| L3.CI3b | as recorded above | 1 | 4 failed \| 46 passed (50) | sha256 matched |
| L3.CI3c | as recorded above | 1 | 2 failed \| 48 passed (50) | sha256 matched |
| L3.CI3d | as recorded above | 1 | 3 failed \| 47 passed (50) | sha256 matched |
| L3.CI3e | as recorded above | 1 | 2 failed \| 48 passed (50) | sha256 matched |
| L3.CI3f | as recorded above | 1 | 2 failed \| 48 passed (50) | sha256 matched |
| L3.CI3g | as recorded above | 1 | 6 failed \| 44 passed (50) | sha256 matched |
| L3.CI3h | as recorded above | 1 | 2 failed \| 48 passed (50) | sha256 matched |
| L3.CI3i | as recorded above | 1 | 1 failed \| 49 passed (50) | sha256 matched |
| L3.CI4a | as recorded above | 1 | 3 failed \| 47 passed (50) | sha256 matched |
| L3.CI4b | as recorded above | 1 | 1 failed \| 49 passed (50) | sha256 matched |
| L3.CI4c | as recorded above | 1 | 3 failed \| 47 passed (50) | sha256 matched |
| L3.CI4d | as recorded above | 1 | 3 failed \| 47 passed (50) | sha256 matched |
| L3.CI4e | as recorded above | 1 | 2 failed \| 48 passed (50) | sha256 matched |
| L3.R1 | as recorded above | 1 | 1 failed \| 49 passed (50) | sha256 matched |
| L3.R2 | as recorded above | 1 | 1 failed \| 49 passed (50) | sha256 matched |

```json
[
{"id": "L3.CI5a", "threads": 1862, "exit": 1, "result": "2 failed | 48 passed (50)", "restore_matches": true},
{"id": "L3.CI5b", "guard": "(adapted) the archive directory and partial/ are made before the install", "old": "          sudo install -d -o \"$(id -u)\" -g \"$(id -g)\" -m 0755 \"$ARCHIVES\" \"$ARCHIVES/partial\"\n", "new": "", "command": "ulimit -u 3450; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts", "threads": 1950, "exit": 1, "result": "2 failed | 48 passed (50)", "at": ["test/ci-workflow.test.ts:375", "test/ci-workflow.test.ts:556"], "restored_sha256": "945f4404a3f07d48488e75e12e1f31a706452c589bd5d6b0adcbabc500dad5b2", "restore_matches": true},
{"id": "L3.CI5d", "threads": 1859, "exit": 1, "result": "2 failed | 48 passed (50)", "restore_matches": true},
{"id": "L3.CI5e", "threads": 1879, "exit": 1, "result": "4 failed | 46 passed (50)", "restore_matches": true},
{"id": "L3.CI5f", "threads": 1903, "exit": 1, "result": "2 failed | 48 passed (50)", "restore_matches": true},
{"id": "L3.CI5g", "threads": 1903, "exit": 1, "result": "3 failed | 47 passed (50)", "restore_matches": true},
{"id": "L3.CI5i", "guard": "(adapted) the directory is not under the runner's home", "old": "archives=/var/cache/docserver-apt-archives", "new": "archives=\"${HOME:?}/docserver-apt-archives\"", "command": "ulimit -u 3455; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts", "threads": 1955, "exit": 1, "result": "3 failed | 47 passed (50)", "at": ["test/ci-workflow.test.ts:445", "test/ci-workflow.test.ts:529"], "restored_sha256": "945f4404a3f07d48488e75e12e1f31a706452c589bd5d6b0adcbabc500dad5b2", "restore_matches": true},
{"id": "L3.CI6a", "guard": "(adapted) the apt cache key embeds the playwright-core version", "old": "key: apt-archives-${{ runner.os }}-${{ runner.arch }}-${{ steps.playwright.outputs.os }}-playwright-core-${{ steps.playwright.outputs.version }}-${{ steps.playwright.outputs.week }}", "new": "key: apt-archives-${{ runner.os }}-${{ runner.arch }}-${{ steps.playwright.outputs.os }}-${{ steps.playwright.outputs.week }}", "command": "ulimit -u 3453; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts", "threads": 1953, "exit": 1, "result": "2 failed | 48 passed (50)", "at": ["test/ci-workflow.test.ts:289", "test/ci-workflow.test.ts:610"], "restored_sha256": "945f4404a3f07d48488e75e12e1f31a706452c589bd5d6b0adcbabc500dad5b2", "restore_matches": true},
{"id": "L3.CI6b", "guard": "(adapted) the apt cache key embeds the OS release", "old": "key: apt-archives-${{ runner.os }}-${{ runner.arch }}-${{ steps.playwright.outputs.os }}-playwright-core-${{ steps.playwright.outputs.version }}-${{ steps.playwright.outputs.week }}", "new": "key: apt-archives-${{ runner.os }}-${{ runner.arch }}-playwright-core-${{ steps.playwright.outputs.version }}-${{ steps.playwright.outputs.week }}", "command": "ulimit -u 3436; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts", "threads": 1936, "exit": 1, "result": "2 failed | 48 passed (50)", "at": ["test/ci-workflow.test.ts:289", "test/ci-workflow.test.ts:610"], "restored_sha256": "945f4404a3f07d48488e75e12e1f31a706452c589bd5d6b0adcbabc500dad5b2", "restore_matches": true},
{"id": "L3.CI6c", "guard": "(adapted) the apt cache key embeds the architecture", "old": "key: apt-archives-${{ runner.os }}-${{ runner.arch }}-${{ steps.playwright.outputs.os }}-playwright-core-${{ steps.playwright.outputs.version }}-${{ steps.playwright.outputs.week }}", "new": "key: apt-archives-${{ runner.os }}-${{ steps.playwright.outputs.os }}-playwright-core-${{ steps.playwright.outputs.version }}-${{ steps.playwright.outputs.week }}", "command": "ulimit -u 3405; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts", "threads": 1905, "exit": 1, "result": "2 failed | 48 passed (50)", "at": ["test/ci-workflow.test.ts:289", "test/ci-workflow.test.ts:610"], "restored_sha256": "945f4404a3f07d48488e75e12e1f31a706452c589bd5d6b0adcbabc500dad5b2", "restore_matches": true},
{"id": "L3.CI6d", "guard": "(adapted) the apt cache restores before the install", "old": "      - uses: actions/cache@55cc8345863c7cc4c66a329aec7e433d2d1c52a9 # v6.1.0\n        with:\n          path: ${{ steps.playwright.outputs.archives }}\n          key: apt-archives-${{ runner.os }}-${{ runner.arch }}-${{ steps.playwright.outputs.os }}-playwright-core-${{ steps.playwright.outputs.version }}-${{ steps.playwright.outputs.week }}\n          restore-keys: apt-archives-${{ runner.os }}-${{ runner.arch }}-${{ steps.playwright.outputs.os }}-playwright-core-${{ steps.playwright.outputs.version }}-\n", "new": "", "after": {"anchor": "            echo \"::warning::browser install attempt ${attempt} of 2 failed or timed out\"\n          done\n          exit 1\n", "insert": "      - uses: actions/cache@55cc8345863c7cc4c66a329aec7e433d2d1c52a9 # v6.1.0\n        with:\n          path: ${{ steps.playwright.outputs.archives }}\n          key: apt-archives-${{ runner.os }}-${{ runner.arch }}-${{ steps.playwright.outputs.os }}-playwright-core-${{ steps.playwright.outputs.version }}-${{ steps.playwright.outputs.week }}\n          restore-keys: apt-archives-${{ runner.os }}-${{ runner.arch }}-${{ steps.playwright.outputs.os }}-playwright-core-${{ steps.playwright.outputs.version }}-\n"}, "command": "ulimit -u 3356; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts", "threads": 1856, "exit": 1, "result": "3 failed | 47 passed (50)", "at": ["test/ci-workflow.test.ts:304", "test/ci-workflow.test.ts:608", "test/ci-workflow.test.ts:623"], "restored_sha256": "945f4404a3f07d48488e75e12e1f31a706452c589bd5d6b0adcbabc500dad5b2", "restore_matches": true},
{"id": "L3.CI6e", "threads": 1935, "exit": 1, "result": "2 failed | 48 passed (50)", "restore_matches": true},
{"id": "L3.CI6f", "guard": "(adapted) the apt cache step exists", "old": "      - uses: actions/cache@55cc8345863c7cc4c66a329aec7e433d2d1c52a9 # v6.1.0\n        with:\n          path: ${{ steps.playwright.outputs.archives }}\n          key: apt-archives-${{ runner.os }}-${{ runner.arch }}-${{ steps.playwright.outputs.os }}-playwright-core-${{ steps.playwright.outputs.version }}-${{ steps.playwright.outputs.week }}\n          restore-keys: apt-archives-${{ runner.os }}-${{ runner.arch }}-${{ steps.playwright.outputs.os }}-playwright-core-${{ steps.playwright.outputs.version }}-\n", "new": "", "command": "ulimit -u 3366; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts", "threads": 1866, "exit": 1, "result": "3 failed | 47 passed (50)", "at": ["test/ci-workflow.test.ts:289", "test/ci-workflow.test.ts:304", "test/ci-workflow.test.ts:606"], "restored_sha256": "945f4404a3f07d48488e75e12e1f31a706452c589bd5d6b0adcbabc500dad5b2", "restore_matches": true},
{"id": "L3.CI6g", "guard": "(adapted) the apt cache has its own key", "old": "key: apt-archives-${{ runner.os }}-${{ runner.arch }}-${{ steps.playwright.outputs.os }}-playwright-core-${{ steps.playwright.outputs.version }}-${{ steps.playwright.outputs.week }}", "new": "key: ms-playwright-${{ runner.os }}-${{ runner.arch }}-${{ steps.playwright.outputs.os }}-playwright-core-${{ steps.playwright.outputs.version }}", "command": "ulimit -u 3374; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts", "threads": 1874, "exit": 1, "result": "2 failed | 48 passed (50)", "at": ["test/ci-workflow.test.ts:289", "test/ci-workflow.test.ts:610"], "restored_sha256": "945f4404a3f07d48488e75e12e1f31a706452c589bd5d6b0adcbabc500dad5b2", "restore_matches": true},
{"id": "L3.CI6h", "guard": "(adapted, inverted by the fix round) the fallback is no broader than the four inputs", "old": "          restore-keys: apt-archives-${{ runner.os }}-${{ runner.arch }}-${{ steps.playwright.outputs.os }}-playwright-core-${{ steps.playwright.outputs.version }}-\n", "new": "          restore-keys: apt-archives-\n", "command": "ulimit -u 3404; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts", "threads": 1904, "exit": 1, "result": "2 failed | 48 passed (50)", "at": ["test/ci-workflow.test.ts:289", "test/ci-workflow.test.ts:610"], "restored_sha256": "945f4404a3f07d48488e75e12e1f31a706452c589bd5d6b0adcbabc500dad5b2", "restore_matches": true},
{"id": "L3.CI6i", "threads": 1922, "exit": 1, "result": "3 failed | 47 passed (50)", "restore_matches": true},
{"id": "L3.CI6j", "threads": 1918, "exit": 1, "result": "1 failed | 49 passed (50)", "restore_matches": true},
{"id": "L3.CI6k", "threads": 1923, "exit": 1, "result": "1 failed | 49 passed (50)", "restore_matches": true},
{"id": "L3.CI6l", "threads": 1912, "exit": 1, "result": "2 failed | 48 passed (50)", "restore_matches": true},
{"id": "L3.CI7a", "threads": 1895, "exit": 1, "result": "5 failed | 45 passed (50)", "restore_matches": true},
{"id": "L3.CI7b", "threads": 1901, "exit": 1, "result": "4 failed | 46 passed (50)", "restore_matches": true},
{"id": "L3.CI7c", "threads": 1917, "exit": 1, "result": "5 failed | 45 passed (50)", "restore_matches": true},
{"id": "L3.CI7d", "threads": 1898, "exit": 1, "result": "4 failed | 46 passed (50)", "restore_matches": true},
{"id": "L3.CI7e", "guard": "(adapted) dpkg finishes an interrupted configuration", "old": "              sudo timeout -k 5 40 dpkg --configure -a || echo \"::warning::dpkg --configure -a failed before browser install attempt 2\"\n", "new": "", "command": "ulimit -u 3446; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts", "threads": 1946, "exit": 1, "result": "5 failed | 45 passed (50)", "at": ["test/ci-workflow.test.ts:394", "test/ci-workflow.test.ts:665", "test/ci-workflow.test.ts:674", "test/ci-workflow.test.ts:683"], "restored_sha256": "945f4404a3f07d48488e75e12e1f31a706452c589bd5d6b0adcbabc500dad5b2", "restore_matches": true},
{"id": "L3.CI7f", "threads": 1892, "exit": 1, "result": "4 failed | 46 passed (50)", "restore_matches": true},
{"id": "L3.CI7g", "threads": 1881, "exit": 1, "result": "4 failed | 46 passed (50)", "restore_matches": true},
{"id": "L3.CI7h", "threads": 1893, "exit": 1, "result": "1 failed | 49 passed (50)", "restore_matches": true},
{"id": "L3.CI7i", "threads": 1871, "exit": 1, "result": "1 failed | 49 passed (50)", "restore_matches": true},
{"id": "L3.CI7j", "guard": "(adapted) dpkg --configure -a runs under sudo", "old": "              sudo timeout -k 5 40 dpkg", "new": "              timeout -k 5 40 dpkg", "command": "ulimit -u 3431; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts", "threads": 1931, "exit": 1, "result": "5 failed | 45 passed (50)", "at": ["test/ci-workflow.test.ts:395", "test/ci-workflow.test.ts:665", "test/ci-workflow.test.ts:674", "test/ci-workflow.test.ts:683"], "restored_sha256": "945f4404a3f07d48488e75e12e1f31a706452c589bd5d6b0adcbabc500dad5b2", "restore_matches": true},
{"id": "L3.CI7k", "threads": 1893, "exit": 1, "result": "5 failed | 45 passed (50)", "restore_matches": true},
{"id": "L3.CI7l", "guard": "(adapted) the cleanup comes before attempt 2, not after it", "old": "            if [ \"$attempt\" = 2 ]; then\n              sudo pkill -TERM -x 'apt-get|dpkg' || true\n              sleep 5\n              sudo pkill -KILL -x 'apt-get|dpkg' || true\n              sudo timeout -k 5 40 dpkg --configure -a || echo \"::warning::dpkg --configure -a failed before browser install attempt 2\"\n            fi\n", "new": "", "after": {"anchor": "            echo \"::warning::browser install attempt ${attempt} of 2 failed or timed out\"\n", "insert": "            if [ \"$attempt\" = 2 ]; then\n              sudo pkill -TERM -x 'apt-get|dpkg' || true\n              sleep 5\n              sudo pkill -KILL -x 'apt-get|dpkg' || true\n              sudo timeout -k 5 40 dpkg --configure -a || echo \"::warning::dpkg --configure -a failed before browser install attempt 2\"\n            fi\n"}, "command": "ulimit -u 3446; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts", "threads": 1946, "exit": 1, "result": "4 failed | 46 passed (50)", "at": ["test/ci-workflow.test.ts:665", "test/ci-workflow.test.ts:674", "test/ci-workflow.test.ts:683"], "restored_sha256": "945f4404a3f07d48488e75e12e1f31a706452c589bd5d6b0adcbabc500dad5b2", "restore_matches": true},
{"id": "L3.CI1a", "threads": 1902, "exit": 1, "result": "1 failed | 49 passed (50)", "restore_matches": true},
{"id": "L3.CI1b", "guard": "(adapted) the apt step precedes the install", "old": "      - name: apt retries and timeouts\n        env:\n          ARCHIVES: ${{ steps.playwright.outputs.archives }}\n        run: |\n          [[ \"${ARCHIVES:?}\" =~ ^/[A-Za-z0-9._/-]+$ ]]\n          sudo install -d -o \"$(id -u)\" -g \"$(id -g)\" -m 0755 \"$ARCHIVES\" \"$ARCHIVES/partial\"\n          sudo -u _apt test -x \"$ARCHIVES/partial\" || {\n            echo \"::error::_apt cannot reach $ARCHIVES/partial, so apt would download as root, unsandboxed\"\n            exit 1\n          }\n          printf '%s\\n' 'Acquire::Retries \"5\";' 'Acquire::http::Timeout \"30\";' 'Acquire::https::Timeout \"30\";' \\\n            'DPkg::Lock::Timeout \"300\";' \\\n            'APT::Keep-Downloaded-Packages \"true\";' \"Dir::Cache::Archives \\\"$ARCHIVES/\\\";\" \\\n            | sudo tee /etc/apt/apt.conf.d/80-docserver-ci > /dev/null\n", "new": "", "after": {"anchor": "            echo \"::warning::browser install attempt ${attempt} of 2 failed or timed out\"\n          done\n          exit 1\n", "insert": "      - name: apt retries and timeouts\n        env:\n          ARCHIVES: ${{ steps.playwright.outputs.archives }}\n        run: |\n          [[ \"${ARCHIVES:?}\" =~ ^/[A-Za-z0-9._/-]+$ ]]\n          sudo install -d -o \"$(id -u)\" -g \"$(id -g)\" -m 0755 \"$ARCHIVES\" \"$ARCHIVES/partial\"\n          sudo -u _apt test -x \"$ARCHIVES/partial\" || {\n            echo \"::error::_apt cannot reach $ARCHIVES/partial, so apt would download as root, unsandboxed\"\n            exit 1\n          }\n          printf '%s\\n' 'Acquire::Retries \"5\";' 'Acquire::http::Timeout \"30\";' 'Acquire::https::Timeout \"30\";' \\\n            'DPkg::Lock::Timeout \"300\";' \\\n            'APT::Keep-Downloaded-Packages \"true\";' \"Dir::Cache::Archives \\\"$ARCHIVES/\\\";\" \\\n            | sudo tee /etc/apt/apt.conf.d/80-docserver-ci > /dev/null\n"}, "command": "ulimit -u 3440; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts", "threads": 1940, "exit": 1, "result": "4 failed | 46 passed (50)", "at": ["test/ci-workflow.test.ts:304", "test/ci-workflow.test.ts:368", "test/ci-workflow.test.ts:607", "test/ci-workflow.test.ts:623"], "restored_sha256": "945f4404a3f07d48488e75e12e1f31a706452c589bd5d6b0adcbabc500dad5b2", "restore_matches": true},
{"id": "L3.CI1c", "threads": 1903, "exit": 1, "result": "1 failed | 49 passed (50)", "restore_matches": true},
{"id": "L3.CI1d", "threads": 1895, "exit": 1, "result": "1 failed | 49 passed (50)", "restore_matches": true},
{"id": "L3.CI2a", "threads": 1891, "exit": 1, "result": "6 failed | 44 passed (50)", "restore_matches": true},
{"id": "L3.CI2b", "threads": 1873, "exit": 1, "result": "1 failed | 49 passed (50)", "restore_matches": true},
{"id": "L3.CI2c", "threads": 1871, "exit": 1, "result": "1 failed | 49 passed (50)", "restore_matches": true},
{"id": "L3.CI2d", "threads": 1845, "exit": 1, "result": "1 failed | 49 passed (50)", "restore_matches": true},
{"id": "L3.CI2e", "threads": 1853, "exit": 1, "result": "6 failed | 44 passed (50)", "restore_matches": true},
{"id": "L3.CI3a", "threads": 1864, "exit": 1, "result": "2 failed | 48 passed (50)", "restore_matches": true},
{"id": "L3.CI3b", "threads": 1888, "exit": 1, "result": "4 failed | 46 passed (50)", "restore_matches": true},
{"id": "L3.CI3c", "threads": 1907, "exit": 1, "result": "2 failed | 48 passed (50)", "restore_matches": true},
{"id": "L3.CI3d", "threads": 1916, "exit": 1, "result": "3 failed | 47 passed (50)", "restore_matches": true},
{"id": "L3.CI3e", "threads": 1929, "exit": 1, "result": "2 failed | 48 passed (50)", "restore_matches": true},
{"id": "L3.CI3f", "threads": 1928, "exit": 1, "result": "2 failed | 48 passed (50)", "restore_matches": true},
{"id": "L3.CI3g", "threads": 1912, "exit": 1, "result": "6 failed | 44 passed (50)", "restore_matches": true},
{"id": "L3.CI3h", "threads": 1915, "exit": 1, "result": "2 failed | 48 passed (50)", "restore_matches": true},
{"id": "L3.CI3i", "threads": 1925, "exit": 1, "result": "1 failed | 49 passed (50)", "restore_matches": true},
{"id": "L3.CI4a", "threads": 1916, "exit": 1, "result": "3 failed | 47 passed (50)", "restore_matches": true},
{"id": "L3.CI4b", "threads": 1905, "exit": 1, "result": "1 failed | 49 passed (50)", "restore_matches": true},
{"id": "L3.CI4c", "threads": 1919, "exit": 1, "result": "3 failed | 47 passed (50)", "restore_matches": true},
{"id": "L3.CI4d", "threads": 1905, "exit": 1, "result": "3 failed | 47 passed (50)", "restore_matches": true},
{"id": "L3.CI4e", "threads": 1898, "exit": 1, "result": "2 failed | 48 passed (50)", "restore_matches": true},
{"id": "L3.R1", "threads": 1887, "exit": 1, "result": "1 failed | 49 passed (50)", "restore_matches": true},
{"id": "L3.R2", "threads": 1884, "exit": 1, "result": "1 failed | 49 passed (50)", "restore_matches": true}
]
```
