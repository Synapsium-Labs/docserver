# Batch Task 9: mutation rows (the release commit)

Task 9 adds no guard to the library: it changes the version, the lockfile's root version, the changelog, the README's status line and one sentence, the plan's deviations table (BX-5) and the programme ledger, and it regenerates `assets/assets.json` (its `version`) with `npm run build:frame`. No source file gains a branch, so there is nothing in the library to mutate. The one test added, in `test/package.test.ts`, pins the changelog's top entry to the package version, the lockfile's two version fields and the asset hashes and csp values in `assets/assets.json`; its four rows follow.

## Method

Each row was measured in place on branch `ws/docserver-release-1-1`, one at a time, after the fix round: the bytes of the target file (and its sha256) were saved, one edit applied, `test/package.test.ts` ran in a bounded run (`timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/package.test.ts`, with `ulimit -u` set to the measured thread count plus 1500), the file was restored by byte copy and its sha256 checked equal. The unmutated file passes 23 tests. A row is red only through a test assertion. No row edits a build input, so the generated outputs were not touched; `node scripts/build-frame.mjs --check` after the rows reports "the outputs equal a fresh build" (exit 0).

| Row | Guard | File | Change | Red | Restore |
|---|---|---|---|---|---|
| B9a | the changelog names each moved hash | `CHANGELOG.md` | the first `dc49ce7dffeb` becomes `dc49ce7dffec` | `test/package.test.ts`: 1 failed \| 22 passed (23); "CHANGELOG.md: the newest entry names the new sha256 (and csp) of each moved asset, each equal to assets.json" | sha256 equal |
| B9b | the entry's heading is the package's version | `CHANGELOG.md` | `## 1.1.0` becomes `## 1.1.1` | `test/package.test.ts`: 1 failed \| 22 passed (23); "CHANGELOG.md: the newest entry is headed by the package's version, which assets.json and the lockfile's root share" | sha256 equal |
| B9c | the changelog's csp values equal the manifest's | `CHANGELOG.md` | the first `3EnOff/rHS` becomes `3EnOff/rHT` | `test/package.test.ts`: 1 failed \| 22 passed (23); the same "names the new sha256 (and csp)" test | sha256 equal |
| B9d | the lockfile root entry's version | `package-lock.json` | line 9 `"version": "1.1.0"` becomes `"1.1.1"` | `test/package.test.ts`: 1 failed \| 22 passed (23); the same "is headed by the package's version" test | sha256 equal |

```json
[
  {"id": "B9a", "file": "CHANGELOG.md", "old": "dc49ce7dffeb", "new": "dc49ce7dffec", "tests": "test/package.test.ts", "rc": 1, "red": "1 failed | 22 passed (23)", "failing": ["CHANGELOG.md: the newest entry names the new sha256 (and csp) of each moved asset, each equal to assets.json"]},
  {"id": "B9b", "file": "CHANGELOG.md", "old": "## 1.1.0\n", "new": "## 1.1.1\n", "tests": "test/package.test.ts", "rc": 1, "red": "1 failed | 22 passed (23)", "failing": ["CHANGELOG.md: the newest entry is headed by the package's version, which assets.json and the lockfile's root share"]},
  {"id": "B9c", "file": "CHANGELOG.md", "old": "3EnOff/rHS", "new": "3EnOff/rHT", "tests": "test/package.test.ts", "rc": 1, "red": "1 failed | 22 passed (23)", "failing": ["CHANGELOG.md: the newest entry names the new sha256 (and csp) of each moved asset, each equal to assets.json"]},
  {"id": "B9d", "file": "package-lock.json", "old": "\"version\": \"1.1.0\" (line 9)", "new": "\"version\": \"1.1.1\"", "tests": "test/package.test.ts", "rc": 1, "red": "1 failed | 22 passed (23)", "failing": ["CHANGELOG.md: the newest entry is headed by the package's version, which assets.json and the lockfile's root share"]}
]
```
