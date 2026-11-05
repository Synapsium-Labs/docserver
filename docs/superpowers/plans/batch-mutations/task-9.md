# Batch Task 9: mutation rows (the release commit)

Task 9 adds no guard to the library: it changes the version, the lockfile's root version, the changelog, the README's status line and one sentence, the plan's deviations table (BX-5) and the programme ledger, and it regenerates `assets/assets.json` (its `version`) with `npm run build:frame`. No source file gains a branch, so there is nothing in the library to mutate. The one test added, in `test/package.test.ts`, pins the changelog's top entry to the package version and the lockfile's two version fields, and each asset hash the entry names (and its csp, where the manifest carries one) to `assets/assets.json`. It does not learn which assets moved since the last release, and it does not require the entry to name any: review 1480 measured the moved set for 1.1.0 (four assets) from the manifest at the previous tag and at the tip. Fix round FR1 restated the test to that claim (see "Fix round FR1" below); the first four rows were measured on the first text, the last section on the restated test.

## Method

Each row was measured in place on branch `ws/docserver-release-1-1`, one at a time, after the fix round: the bytes of the target file (and its sha256) were saved, one edit applied, `test/package.test.ts` ran in a bounded run (`timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/package.test.ts`, with `ulimit -u` set to the measured thread count plus 1500), the file was restored by byte copy and its sha256 checked equal. The unmutated file passes 23 tests, in both texts of the test. A row is red only through a test assertion. No row edits a build input, so the generated outputs were not touched; `node scripts/build-frame.mjs --check` after the rows reports "the outputs equal a fresh build" (exit 0).

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

## Fix round FR1: the guard restated, and what it does not claim (review 1480, F3)

The test's check was `bullets.length >= 4`, with the csp group optional. It now compares every hash bullet of the top entry to the manifest for that path, requires the csp value exactly when the manifest carries one for the asset, and drops the count, so a patch entry with no moved asset passes. Method as above, on the restated test (`test/package.test.ts`: 23 tests, a bounded run per row, `ulimit -u` at the measured thread count plus 1500, restore by byte copy, sha256 equal: `CHANGELOG.md` 52c613caee45a49a9300a2ce46cac9fe566f8b171611bf83c9c85e45011e3b76, the committed file at the tip after the changelog's last FR1 edit (the frame's enhance hash moved with the last behaviour fix); the rows were run again on exactly these bytes, `package-lock.json` 6068765b09ae93be9b84d6d4e8ff268cb91cc38c91e827e22066e7660d10737c). B9a to B9d were re-measured on the restated test (the failing test's title changed with it). B9e and B9f are new; B9x and B9y are probes that stay green by design and record what the test does not claim.

| Row | Guard | File | Change | Red | Restore |
|---|---|---|---|---|---|
| B9a | each named hash equals the manifest's | `CHANGELOG.md` | the first `dc49ce7dffeb` becomes `dc49ce7dffec` | 1 failed \| 22 passed (23); "every hash bullet names a manifest asset with its sha256 and, where the manifest carries one, its csp" | sha256 equal |
| B9b | the entry's heading is the package's version | `CHANGELOG.md` | `## 1.1.0` becomes `## 1.1.1` | 1 failed \| 22 passed (23); "is headed by the package's version, which assets.json and the lockfile's root share" | sha256 equal |
| B9c | a named csp equals the manifest's | `CHANGELOG.md` | the first `3EnOff/rHS` becomes `3EnOff/rHT` | 1 failed \| 22 passed (23); the "every hash bullet" test | sha256 equal |
| B9d | the lockfile root entry's version | `package-lock.json` | the root entry's `"version": "1.1.0"` becomes `"1.1.1"` | 1 failed \| 22 passed (23); the "is headed by" test | sha256 equal |
| B9e | the csp is required where the manifest carries one | `CHANGELOG.md` | the `, csp ...` part of the `assets/frame/bootstrap.js` bullet is removed | 1 failed \| 22 passed (23); the "every hash bullet" test | sha256 equal |
| B9f | a bullet must name a manifest asset | `CHANGELOG.md` | `assets/frame/bootstrap.js` in its bullet becomes `assets/frame/bootstrap2.js` | 1 failed \| 22 passed (23); the "every hash bullet" test | sha256 equal |
| B9x | probe: which assets moved is not learned | `CHANGELOG.md` | the `assets/reader.css` bullet is replaced by a correct bullet for the unmoved `assets/fonts/OFL.txt` | green: 23 passed (23), by design | sha256 equal |
| B9y | probe: an entry may name no asset (a patch) | `CHANGELOG.md` | the four asset bullets are deleted | green: 23 passed (23), by design | sha256 equal |

```json
[
  {"id": "B9a", "file": "CHANGELOG.md", "old": "dc49ce7dffeb", "new": "dc49ce7dffec", "tests": "test/package.test.ts", "rc": 1, "red": "1 failed | 22 passed (23)", "failing": ["CHANGELOG.md: the newest entry > every hash bullet names a manifest asset with its sha256 and, where the manifest carries one, its csp"]},
  {"id": "B9b", "file": "CHANGELOG.md", "old": "## 1.1.0\n", "new": "## 1.1.1\n", "tests": "test/package.test.ts", "rc": 1, "red": "1 failed | 22 passed (23)", "failing": ["CHANGELOG.md: the newest entry > is headed by the package's version, which assets.json and the lockfile's root share"]},
  {"id": "B9c", "file": "CHANGELOG.md", "old": "3EnOff/rHS", "new": "3EnOff/rHT", "tests": "test/package.test.ts", "rc": 1, "red": "1 failed | 22 passed (23)", "failing": ["CHANGELOG.md: the newest entry > every hash bullet names a manifest asset with its sha256 and, where the manifest carries one, its csp"]},
  {"id": "B9d", "file": "package-lock.json", "old": "\"version\": \"1.1.0\" (the root entry)", "new": "\"version\": \"1.1.1\"", "tests": "test/package.test.ts", "rc": 1, "red": "1 failed | 22 passed (23)", "failing": ["CHANGELOG.md: the newest entry > is headed by the package's version, which assets.json and the lockfile's root share"]},
  {"id": "B9e", "file": "CHANGELOG.md", "old": ", csp `'sha256-3EnOff/rHS+eu6Bl7GpT7L3zqxQ59nxjwXdj3aRZxCQ='` (the bootstrap bullet)", "new": "(removed)", "tests": "test/package.test.ts", "rc": 1, "red": "1 failed | 22 passed (23)", "failing": ["CHANGELOG.md: the newest entry > every hash bullet names a manifest asset with its sha256 and, where the manifest carries one, its csp"]},
  {"id": "B9f", "file": "CHANGELOG.md", "old": "assets/frame/bootstrap.js (its bullet)", "new": "assets/frame/bootstrap2.js", "tests": "test/package.test.ts", "rc": 1, "red": "1 failed | 22 passed (23)", "failing": ["CHANGELOG.md: the newest entry > every hash bullet names a manifest asset with its sha256 and, where the manifest carries one, its csp"]},
  {"id": "B9x", "file": "CHANGELOG.md", "old": "the assets/reader.css bullet", "new": "a correct bullet for assets/fonts/OFL.txt", "tests": "test/package.test.ts", "rc": 0, "red": "none: 23 passed (23), by design (the test does not learn which assets moved)", "failing": []},
  {"id": "B9y", "file": "CHANGELOG.md", "old": "the four asset bullets", "new": "(removed)", "tests": "test/package.test.ts", "rc": 0, "red": "none: 23 passed (23), by design (a patch entry names no asset)", "failing": []}
]
```

## Fix round FR2: B9z, a malformed hash bullet (review F11)

The changelog guard matched hash bullets with a regex and checked the matches, so a bullet that stopped matching (63 hex digits, an upper-case digit, a csp without backticks) was skipped and the test stayed green while the changelog printed a wrong hash. The test now also asserts, one `expect` per line, that every line of the top entry starting with ``- `assets/`` matches the whole bullet pattern. B9z is the probe: the sha of the `assets/frame/enhance.js` bullet of the top entry shortened to 63 hex digits. Method as above (`test/package.test.ts`: 23 tests, a bounded run, `ulimit -u` at the measured thread count (2312 and 2303) plus 1500, restore by byte copy, sha256 equal: `CHANGELOG.md` 3c4896bf94f0a2a05a4b6b4ab829c924aa4fbe297889c58736493d186ff3d938, `test/package.test.ts` dcb9f32dd7ef5804146beb8a50067ad4209da72dc1aba0af1a54b4820d4b7d5e, both the committed bytes of the fix-round tip before the probe; the changelog's hash lines had moved with the FR2 asset build, so the rows above were measured on earlier bytes of it). The probe was run twice: on the test with the new assertion (red), and on the same test with only that assertion line removed (the test as it was; green), then the test file was restored from the saved bytes. Control: the unmutated changelog with the new test passes (the package and README files together: 70 passed).

| Row | Guard | File | Change | Red | Restore |
|---|---|---|---|---|---|
| B9z | a malformed hash bullet fails the test (a short sha is not skipped) | `CHANGELOG.md` | the `assets/frame/enhance.js` bullet's sha shortened by its last digit, 63 hex digits | with the new assertion: 1 failed \| 22 passed (23); "every hash bullet names a manifest asset with its sha256 and, where the manifest carries one, its csp" (the line named in the message). With the assertion line removed (the old test): green, 23 passed (23) | sha256 equal for both files |

```json
[
  {
    "id": "B9z",
    "file": "CHANGELOG.md",
    "old": "the assets/frame/enhance.js bullet's sha, 64 hex digits",
    "new": "the same sha with its last digit removed (63)",
    "tests": "test/package.test.ts",
    "rc": 1,
    "red": "1 failed | 22 passed (23)",
    "failing": [
      "CHANGELOG.md: the newest entry > every hash bullet names a manifest asset with its sha256 and, where the manifest carries one, its csp"
    ],
    "against_old_test": {
      "rc": 0,
      "red": "none: 23 passed (23), the assertion line removed"
    },
    "sha256": {
      "changelog": "3c4896bf94f0a2a05a4b6b4ab829c924aa4fbe297889c58736493d186ff3d938",
      "test": "dcb9f32dd7ef5804146beb8a50067ad4209da72dc1aba0af1a54b4820d4b7d5e"
    },
    "restored": true
  }
]
```
