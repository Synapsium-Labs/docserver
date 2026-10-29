# L3 Task 14: mutation rows (the release lane)

Each guard of Task 14, changed once, with what goes red: the release workflow's rows L3.W1 to L3.W9 and L3.W11 (`test/release-workflow.test.ts`), L3.W10 (`test/public-ready.test.ts`), `ci.yml`'s `workflow_call` and its concurrency group (L3.CI8a, L3.CI8b), the release files `test/public-ready.test.ts` pins (L3.PR1 to L3.PR11), the notices generator (L3.N1 to L3.N4), the history scan (L3.HS1 to L3.HS29) and the shared shapes (L3.S1 to L3.S3). The plan's own rows map as follows: each of L3.W1 to L3.W11 deletes its step, key or condition at least once; L3.W1c drops the test job's grant; L3.W8a pins `actions/checkout@v4` by tag; the history scan's five are L3.HS1 (skip tag messages), L3.HS2 (print the match), L3.HS3 (skip the pull-request refspec), L3.HS4 (skip edit revisions) and L3.HS5 (skip release notes). The other rows guard what the task added beside them. The prefixes L3.PR, L3.N, L3.HS and L3.S are this task's own: the plan names only the W and CI8 rows of Task 14, and L3.H and L3.P already name rows of Tasks 1, 9, 10 and 12, so these rows take prefixes no other task uses.

**Result.** 104 rows, 104 red, every one through failing vitest assertions (`AssertionError`); no row counts a setup, type or timeout error, and every file was restored and its sha256 compared equal. Measured on the final code and tests of this task, 2026-10-28, Node 24.22.1; none of these rows drives a browser.

**Method** (Global Constraints, "Low disk"; C69, C75). One row at a time, in place in the task's own worktree, never in parallel and never in a copy of the repository. For each row: the file's original bytes and their sha256 were saved in a scratch directory outside the worktree (and the file was checked to equal them before the row); the `old` text was checked to occur exactly once and replaced by `new`; the thread count was measured (`ps -L -u "$(id -u)" --no-headers | wc -l`, the `threads` field) and the command ran under `ulimit -u` that count plus 1500 and `timeout -k 10 600`, with a JSON report beside its log; the file was then restored from the saved bytes and its sha256 compared (never `git checkout`). The test fixtures (fake `git`, `gh` and `npm`, fixture repositories, recorded GitHub answers) live under the system temporary directory and are removed by the tests; nothing reaches a network or GitHub.

Notes on the measurement.
- The review's fix round changed release.yml (the tag step's commit comparison, github-release's prerelease refusal), ci.yml (the called run's concurrency group), the history scan (refs outside branches, tags and pull requests) and four test files, so every row was measured again on that final tree, with the originals saved afresh; the rows below are that measurement. The tag step changed once more within the round (it now peels GITHUB_SHA before comparing), so every row on `release.yml` or read by `test/release-workflow.test.ts` was measured again after that change; the earlier run of those rows is not used. It added L3.W4e, L3.W4f, L3.W7m to L3.W7q, L3.CI8b, L3.PR10, L3.PR11 and L3.HS19 to L3.HS29, and renamed the earlier L3.H and L3.P rows L3.HS and L3.PR with their numbers kept.
- Before the fix round, every row was measured again on the final tree. A first round had measured the release rows while `test/release-workflow.test.ts` was still being edited (its last change fell in the middle of that run), so the whole set was re-run once the code and the tests stood; the reds are the same rows with the same counts.
- L3.HS14 (fetch every branch) stayed green in the first round: the fixture's backup branch was already in the clone, so dropping the branches refspec changed nothing the test could see. The fixture now pushes a second backup branch, and an annotated tag on a commit no branch holds, after the clone, so only the scan's own fetch brings them; L3.HS14 is red, and L3.HS17 (fetch every tag) was added for the tag refspec. A tag on a branch's history would not do for L3.HS17: git follows tags that point into fetched history.
- L3.HS16 and L3.HS18 guard an addition of this task's fix pass: each pull request's head and base branch names are read, because a pull request's page keeps them after the branch is deleted.
- L3.N3 was first measured against `test/public-ready.test.ts` alone and stayed green (0 failed | 23 passed (23)): that tree test reads the committed THIRD-PARTY-NOTICES, not the generator. The row below is measured against `test/mermaid-bundle.test.ts`, which compares the committed section with the generator's output. Its first measurement is kept in the JSON fence of its section as `L3.N3-pr`.
- L3.W7f measured a check that Task 15 step 2 removed on the operator's ruling (ledger C101): check 6 now requires that administrators cannot bypass the review and allows self-review. Its rows, L3.W7r to L3.W7t, are in `task-15.md`; the row below stays as measured on Task 14's tree.
- L3.W7d and L3.W7e change the same verify-tag step (the key-line check and the principal check); each row reverts the one check only.
- L3.HS19 to L3.HS24 each delete one GitHub read whose text the first fixtures held clean (a pull request's title and body, an issue's body, a review's body, a commit comment's body, a release's name); the fixture now plants one hit in each. L3.HS25 and L3.HS26 guard the font skip from both sides: a blob that is not UTF-8 outside assets/fonts is read (a credential among its bytes is found), and a woff2 directly in assets/fonts is skipped and counted.
- L3.PR10 plants its pin as a comment line in `test/browser/harness.test.ts`: the pin scan reads text, so a comment counts, and the row needs no change to what that file runs.

## L3.W1: permissions per job; the top level grants nothing; the test job grants what ci.yml declares

| Row | Guard | File | Change | Red | Restore |
|---|---|---|---|---|---|
| L3.W1a | the top-level token grants nothing | `.github/workflows/release.yml` | `\npermissions: {}\n` → `\n` | `test/release-workflow.test.ts`: exit 1, 1 failed \| 67 passed (68). "release.yml: permissions (L3.W1, L3.W2) L3.W1: the top-level token grants nothing" | sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal |
| L3.W1b | verify-tag's Actions read (the environment check's read) | `.github/workflows/release.yml` | `…ctions read permission.\n      actions: read\n` → `…ctions read permission.\n` | `test/release-workflow.test.ts`: exit 1, 1 failed \| 67 passed (68). "release.yml: permissions (L3.W1, L3.W2) L3.W1: each job asks for exactly its own permissions" | sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal |
| L3.W1c | the test job's grant (plan: drop the test job's grant) | `.github/workflows/release.yml` | `…    needs: [verify-tag]\n    permissions:\n      contents: read\n` → `…    needs: [verify-tag]\n` | `test/release-workflow.test.ts`: exit 1, 2 failed \| 66 passed (68). "release.yml: permissions (L3.W1, L3.W2) L3.W1: each job asks for exactly its own permissions"; "release.yml: permissions (L3.W1, L3.W2) L3.W1: the test job, which calls ci.yml, grants at least every permission ci.yml declares (a called workflow can only narrow its caller's grant)" | sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal |
| L3.W1d | post-verify reads attestations only | `.github/workflows/release.yml` | `…     attestations: read\n` → `…     attestations: read\n      packages: write\n` | `test/release-workflow.test.ts`: exit 1, 1 failed \| 67 passed (68). "release.yml: permissions (L3.W1, L3.W2) L3.W1: each job asks for exactly its own permissions" | sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal |

```json
[
  {
    "id": "L3.W1a",
    "guard": "the top-level token grants nothing",
    "file": ".github/workflows/release.yml",
    "old": "\npermissions: {}\n",
    "new": "\n",
    "tests": "test/release-workflow.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/release-workflow.test.ts",
    "rc": 1,
    "threads": 1618,
    "red": "1 failed | 67 passed (68)",
    "failing": [
      "release.yml: permissions (L3.W1, L3.W2) L3.W1: the top-level token grants nothing"
    ],
    "assertions": [
      "AssertionError: expected undefined to deeply equal {}"
    ],
    "restore": "sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal"
  },
  {
    "id": "L3.W1b",
    "guard": "verify-tag's Actions read (the environment check's read)",
    "file": ".github/workflows/release.yml",
    "old": "      # which a fine-grained token reads with the Actions read permission.\n      actions: read\n",
    "new": "      # which a fine-grained token reads with the Actions read permission.\n",
    "tests": "test/release-workflow.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/release-workflow.test.ts",
    "rc": 1,
    "threads": 1595,
    "red": "1 failed | 67 passed (68)",
    "failing": [
      "release.yml: permissions (L3.W1, L3.W2) L3.W1: each job asks for exactly its own permissions"
    ],
    "assertions": [
      "AssertionError: expected [ 'verify-tag', { contents: 'read' } ] to deeply equal [ 'verify-tag', …(1) ]"
    ],
    "restore": "sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal"
  },
  {
    "id": "L3.W1c",
    "guard": "the test job's grant (plan: drop the test job's grant)",
    "file": ".github/workflows/release.yml",
    "old": "  test:\n    needs: [verify-tag]\n    permissions:\n      contents: read\n",
    "new": "  test:\n    needs: [verify-tag]\n",
    "tests": "test/release-workflow.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/release-workflow.test.ts",
    "rc": 1,
    "threads": 1603,
    "red": "2 failed | 66 passed (68)",
    "failing": [
      "release.yml: permissions (L3.W1, L3.W2) L3.W1: each job asks for exactly its own permissions",
      "release.yml: permissions (L3.W1, L3.W2) L3.W1: the test job, which calls ci.yml, grants at least every permission ci.yml declares (a called workflow can only narrow its caller's grant)"
    ],
    "assertions": [
      "AssertionError: expected [ 'test', undefined ] to deeply equal [ 'test', { contents: 'read' } ]",
      "AssertionError: expected [ [ 'contents', 'read' ] ] to deeply equal []"
    ],
    "restore": "sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal"
  },
  {
    "id": "L3.W1d",
    "guard": "post-verify reads attestations only",
    "file": ".github/workflows/release.yml",
    "old": "    permissions:\n      contents: read\n      attestations: read\n",
    "new": "    permissions:\n      contents: read\n      attestations: read\n      packages: write\n",
    "tests": "test/release-workflow.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/release-workflow.test.ts",
    "rc": 1,
    "threads": 1603,
    "red": "1 failed | 67 passed (68)",
    "failing": [
      "release.yml: permissions (L3.W1, L3.W2) L3.W1: each job asks for exactly its own permissions"
    ],
    "assertions": [
      "AssertionError: expected [ 'post-verify', …(1) ] to deeply equal [ 'post-verify', …(1) ]"
    ],
    "restore": "sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal"
  }
]
```

## L3.W2: `id-token: write` only in attest and publish; `contents: write` only in github-release

| Row | Guard | File | Change | Red | Restore |
|---|---|---|---|---|---|
| L3.W2a | attest's id-token: write | `.github/workflows/release.yml` | `    permissions:\n      id-token: write\n      …` → `    permissions:\n      …` | `test/release-workflow.test.ts`: exit 1, 2 failed \| 66 passed (68). "release.yml: permissions (L3.W1, L3.W2) L3.W1: each job asks for exactly its own permissions"; "release.yml: permissions (L3.W1, L3.W2) L3.W2: id-token: write is granted in attest and publish only; contents: write in github-release only" | sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal |
| L3.W2b | publish's id-token: write | `.github/workflows/release.yml` | `    permissions:\n      id-token: write\n      …` → `    permissions:\n      …` | `test/release-workflow.test.ts`: exit 1, 2 failed \| 66 passed (68). "release.yml: permissions (L3.W1, L3.W2) L3.W1: each job asks for exactly its own permissions"; "release.yml: permissions (L3.W1, L3.W2) L3.W2: id-token: write is granted in attest and publish only; contents: write in github-release only" | sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal |
| L3.W2c | contents: write only in github-release (build widened) | `.github/workflows/release.yml` | `…ssions:\n      contents: read…` → `…ssions:\n      contents: write…` | `test/release-workflow.test.ts`: exit 1, 2 failed \| 66 passed (68). "release.yml: permissions (L3.W1, L3.W2) L3.W1: each job asks for exactly its own permissions"; "release.yml: permissions (L3.W1, L3.W2) L3.W2: id-token: write is granted in attest and publish only; contents: write in github-release only" | sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal |
| L3.W2d | id-token: write only in attest and publish (github-release widened) | `.github/workflows/release.yml` | `…:\n      contents: write\n` → `…:\n      contents: write\n      id-token: write\n` | `test/release-workflow.test.ts`: exit 1, 2 failed \| 66 passed (68). "release.yml: permissions (L3.W1, L3.W2) L3.W1: each job asks for exactly its own permissions"; "release.yml: permissions (L3.W1, L3.W2) L3.W2: id-token: write is granted in attest and publish only; contents: write in github-release only" | sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal |

```json
[
  {
    "id": "L3.W2a",
    "guard": "attest's id-token: write",
    "file": ".github/workflows/release.yml",
    "old": "    permissions:\n      id-token: write\n      attestations: write\n",
    "new": "    permissions:\n      attestations: write\n",
    "tests": "test/release-workflow.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/release-workflow.test.ts",
    "rc": 1,
    "threads": 1603,
    "red": "2 failed | 66 passed (68)",
    "failing": [
      "release.yml: permissions (L3.W1, L3.W2) L3.W1: each job asks for exactly its own permissions",
      "release.yml: permissions (L3.W1, L3.W2) L3.W2: id-token: write is granted in attest and publish only; contents: write in github-release only"
    ],
    "assertions": [
      "AssertionError: expected [ 'attest', { attestations: 'write' } ] to deeply equal [ 'attest', …(1) ]",
      "AssertionError: expected [ 'publish' ] to deeply equal [ 'attest', 'publish' ]"
    ],
    "restore": "sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal"
  },
  {
    "id": "L3.W2b",
    "guard": "publish's id-token: write",
    "file": ".github/workflows/release.yml",
    "old": "    permissions:\n      id-token: write\n      contents: read\n",
    "new": "    permissions:\n      contents: read\n",
    "tests": "test/release-workflow.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/release-workflow.test.ts",
    "rc": 1,
    "threads": 1634,
    "red": "2 failed | 66 passed (68)",
    "failing": [
      "release.yml: permissions (L3.W1, L3.W2) L3.W1: each job asks for exactly its own permissions",
      "release.yml: permissions (L3.W1, L3.W2) L3.W2: id-token: write is granted in attest and publish only; contents: write in github-release only"
    ],
    "assertions": [
      "AssertionError: expected [ 'publish', { contents: 'read' } ] to deeply equal [ 'publish', …(1) ]",
      "AssertionError: expected [ 'attest' ] to deeply equal [ 'attest', 'publish' ]"
    ],
    "restore": "sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal"
  },
  {
    "id": "L3.W2c",
    "guard": "contents: write only in github-release (build widened)",
    "file": ".github/workflows/release.yml",
    "old": "    timeout-minutes: 30\n    permissions:\n      contents: read\n",
    "new": "    timeout-minutes: 30\n    permissions:\n      contents: write\n",
    "tests": "test/release-workflow.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/release-workflow.test.ts",
    "rc": 1,
    "threads": 1623,
    "red": "2 failed | 66 passed (68)",
    "failing": [
      "release.yml: permissions (L3.W1, L3.W2) L3.W1: each job asks for exactly its own permissions",
      "release.yml: permissions (L3.W1, L3.W2) L3.W2: id-token: write is granted in attest and publish only; contents: write in github-release only"
    ],
    "assertions": [
      "AssertionError: expected [ 'build', { contents: 'write' } ] to deeply equal [ 'build', { contents: 'read' } ]",
      "AssertionError: expected [ 'build', 'github-release' ] to deeply equal [ 'github-release' ]"
    ],
    "restore": "sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal"
  },
  {
    "id": "L3.W2d",
    "guard": "id-token: write only in attest and publish (github-release widened)",
    "file": ".github/workflows/release.yml",
    "old": "    permissions:\n      contents: write\n",
    "new": "    permissions:\n      contents: write\n      id-token: write\n",
    "tests": "test/release-workflow.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/release-workflow.test.ts",
    "rc": 1,
    "threads": 1624,
    "red": "2 failed | 66 passed (68)",
    "failing": [
      "release.yml: permissions (L3.W1, L3.W2) L3.W1: each job asks for exactly its own permissions",
      "release.yml: permissions (L3.W1, L3.W2) L3.W2: id-token: write is granted in attest and publish only; contents: write in github-release only"
    ],
    "assertions": [
      "AssertionError: expected [ 'github-release', …(1) ] to deeply equal [ 'github-release', …(1) ]",
      "AssertionError: expected [ 'attest', 'publish', …(1) ] to deeply equal [ 'attest', 'publish' ]"
    ],
    "restore": "sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal"
  }
]
```

## L3.W3: no `NPM_TOKEN` or `NODE_AUTH_TOKEN` in any workflow

| Row | Guard | File | Change | Red | Restore |
|---|---|---|---|---|---|
| L3.W3a | no NODE_AUTH_TOKEN | `.github/workflows/release.yml` | `…s.prerelease }}\n        …` → `…s.prerelease }}\n          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}\n        …` | `test/release-workflow.test.ts`: exit 1, 2 failed \| 66 passed (68). "release.yml: no token for npm (L3.W3) L3.W3: no workflow of the repository names NPM_TOKEN or NODE_AUTH_TOKEN, and the release reads no secret"; "release.yml: one tarball, attested and published (L3.W4, L3.W5, L3.W6, L3.W11) L3.W6: attest and publish each download the release artifact into release/ and re-check it before using it; attest attests the file publish publishes" | sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal |
| L3.W3b | no registry-url on setup-node | `.github/workflows/release.yml` | `…  node-version: 22.23.3\n` → `…  node-version: 22.23.3\n          registry-url: https://registry.npmjs.org\n` | `test/release-workflow.test.ts`: exit 1, 2 failed \| 66 passed (68). "release.yml: no token for npm (L3.W3) L3.W3: no setup-node step sets registry-url, which would write a NODE_AUTH_TOKEN reference into the job's .npmrc"; "release.yml: one tarball, attested and published (L3.W4, L3.W5, L3.W6, L3.W11) publish installs an exact npm that publishes through trusted publishing, on exact Node 22, and checks the version it got" | sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal |

```json
[
  {
    "id": "L3.W3a",
    "guard": "no NODE_AUTH_TOKEN",
    "file": ".github/workflows/release.yml",
    "old": "          TARBALL: ${{ needs.build.outputs.tarball }}\n          PRERELEASE: ${{ needs.verify-tag.outputs.prerelease }}\n        run: |\n          case",
    "new": "          TARBALL: ${{ needs.build.outputs.tarball }}\n          PRERELEASE: ${{ needs.verify-tag.outputs.prerelease }}\n          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}\n        run: |\n          case",
    "tests": "test/release-workflow.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/release-workflow.test.ts",
    "rc": 1,
    "threads": 1620,
    "red": "2 failed | 66 passed (68)",
    "failing": [
      "release.yml: no token for npm (L3.W3) L3.W3: no workflow of the repository names NPM_TOKEN or NODE_AUTH_TOKEN, and the release reads no secret",
      "release.yml: one tarball, attested and published (L3.W4, L3.W5, L3.W6, L3.W11) L3.W6: attest and publish each download the release artifact into release/ and re-check it before using it; attest attests the file publish publishes"
    ],
    "assertions": [
      "AssertionError: expected [ 'release.yml' ] to deeply equal []",
      "AssertionError: expected { …(3) } to deeply equal { …(2) }"
    ],
    "restore": "sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal"
  },
  {
    "id": "L3.W3b",
    "guard": "no registry-url on setup-node",
    "file": ".github/workflows/release.yml",
    "old": "          sha256sum --check --strict -- SHA256SUMS\n          test \"$(sha256sum -- \"${TARBALL:?}\" | cut -d ' ' -f 1)\" = \"${SHA256:?}\"\n      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0\n        with:\n          node-version: 22.23.3\n",
    "new": "          sha256sum --check --strict -- SHA256SUMS\n          test \"$(sha256sum -- \"${TARBALL:?}\" | cut -d ' ' -f 1)\" = \"${SHA256:?}\"\n      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0\n        with:\n          node-version: 22.23.3\n          registry-url: https://registry.npmjs.org\n",
    "tests": "test/release-workflow.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/release-workflow.test.ts",
    "rc": 1,
    "threads": 1624,
    "red": "2 failed | 66 passed (68)",
    "failing": [
      "release.yml: no token for npm (L3.W3) L3.W3: no setup-node step sets registry-url, which would write a NODE_AUTH_TOKEN reference into the job's .npmrc",
      "release.yml: one tarball, attested and published (L3.W4, L3.W5, L3.W6, L3.W11) publish installs an exact npm that publishes through trusted publishing, on exact Node 22, and checks the version it got"
    ],
    "assertions": [
      "AssertionError: expected [ { …(2) } ] to deeply equal []",
      "AssertionError: expected { 'node-version': '22.23.3', …(1) } to deeply equal { 'node-version': '22.23.3' }"
    ],
    "restore": "sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal"
  }
]
```

## L3.W4: `--provenance` and `--access public` on publish; `--tag next` for an rc

| Row | Guard | File | Change | Red | Restore |
|---|---|---|---|---|---|
| L3.W4a | --provenance on publish | `.github/workflows/release.yml` | `…release/${TARBALL:?}" --provenance --…` → `…release/${TARBALL:?}" --…` | `test/release-workflow.test.ts`: exit 1, 1 failed \| 67 passed (68). "release.yml: one tarball, attested and published (L3.W4, L3.W5, L3.W6, L3.W11) L3.W4: publish publishes the tarball with provenance, for the public; a release candidate goes to the next dist-tag" | sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal |
| L3.W4b | --access public on publish | `.github/workflows/release.yml` | `…ARBALL:?}" --provenance --access public …` → `…ARBALL:?}" --provenance …` | `test/release-workflow.test.ts`: exit 1, 1 failed \| 67 passed (68). "release.yml: one tarball, attested and published (L3.W4, L3.W5, L3.W6, L3.W11) L3.W4: publish publishes the tarball with provenance, for the public; a release candidate goes to the next dist-tag" | sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal |
| L3.W4c | --tag next for an rc | `.github/workflows/release.yml` | `…venance --access public --tag next …` → `…venance --access public …` | `test/release-workflow.test.ts`: exit 1, 1 failed \| 67 passed (68). "release.yml: one tarball, attested and published (L3.W4, L3.W5, L3.W6, L3.W11) L3.W4: publish publishes the tarball with provenance, for the public; a release candidate goes to the next dist-tag" | sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal |
| L3.W4d | an unknown prerelease value publishes nothing | `.github/workflows/release.yml` | `…ublic ;;\n            *) echo "::error::prerelease is ${PRERELEASE}, not true or false"; …` → `…ublic ;;\n            *) npm publish "./release/${TARBALL:?}" --provenance --access publi…` | `test/release-workflow.test.ts`: exit 1, 1 failed \| 67 passed (68). "release.yml: one tarball, attested and published (L3.W4, L3.W5, L3.W6, L3.W11) L3.W6: attest and publish each download the release artifact into release/ and re-check it before using it; attest attests the file publish publishes" | sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal |
| L3.W4e | a release candidate is a GitHub prerelease | `.github/workflows/release.yml` | `            true) flags+=(--prerelease) …` → `            true) …` | `test/release-workflow.test.ts`: exit 1, 1 failed \| 67 passed (68). "release.yml: one tarball, attested and published (L3.W4, L3.W5, L3.W6, L3.W11) github-release marks a release candidate as a GitHub prerelease, and only a release candidate" | sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal |
| L3.W4f | github-release refuses a prerelease value that is neither true nor false | `.github/workflows/release.yml` | `…alse) ;;\n            *) echo "::error::prerelease is ${PRERELEASE}, not true or false"; …` → `…alse) ;;\n            *) …` | `test/release-workflow.test.ts`: exit 1, 1 failed \| 67 passed (68). "release.yml: one tarball, attested and published (L3.W4, L3.W5, L3.W6, L3.W11) github-release creates nothing when prerelease is neither true nor false" | sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal |

```json
[
  {
    "id": "L3.W4a",
    "guard": "--provenance on publish",
    "file": ".github/workflows/release.yml",
    "old": "false) npm publish \"./release/${TARBALL:?}\" --provenance --access public ;;",
    "new": "false) npm publish \"./release/${TARBALL:?}\" --access public ;;",
    "tests": "test/release-workflow.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/release-workflow.test.ts",
    "rc": 1,
    "threads": 1626,
    "red": "1 failed | 67 passed (68)",
    "failing": [
      "release.yml: one tarball, attested and published (L3.W4, L3.W5, L3.W6, L3.W11) L3.W4: publish publishes the tarball with provenance, for the public; a release candidate goes to the next dist-tag"
    ],
    "assertions": [
      "AssertionError: expected [ +0, …(1) ] to deeply equal [ +0, …(1) ]"
    ],
    "restore": "sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal"
  },
  {
    "id": "L3.W4b",
    "guard": "--access public on publish",
    "file": ".github/workflows/release.yml",
    "old": "false) npm publish \"./release/${TARBALL:?}\" --provenance --access public ;;",
    "new": "false) npm publish \"./release/${TARBALL:?}\" --provenance ;;",
    "tests": "test/release-workflow.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/release-workflow.test.ts",
    "rc": 1,
    "threads": 1570,
    "red": "1 failed | 67 passed (68)",
    "failing": [
      "release.yml: one tarball, attested and published (L3.W4, L3.W5, L3.W6, L3.W11) L3.W4: publish publishes the tarball with provenance, for the public; a release candidate goes to the next dist-tag"
    ],
    "assertions": [
      "AssertionError: expected [ +0, …(1) ] to deeply equal [ +0, …(1) ]"
    ],
    "restore": "sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal"
  },
  {
    "id": "L3.W4c",
    "guard": "--tag next for an rc",
    "file": ".github/workflows/release.yml",
    "old": "true) npm publish \"./release/${TARBALL:?}\" --provenance --access public --tag next ;;",
    "new": "true) npm publish \"./release/${TARBALL:?}\" --provenance --access public ;;",
    "tests": "test/release-workflow.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/release-workflow.test.ts",
    "rc": 1,
    "threads": 1662,
    "red": "1 failed | 67 passed (68)",
    "failing": [
      "release.yml: one tarball, attested and published (L3.W4, L3.W5, L3.W6, L3.W11) L3.W4: publish publishes the tarball with provenance, for the public; a release candidate goes to the next dist-tag"
    ],
    "assertions": [
      "AssertionError: expected [ +0, …(1) ] to deeply equal [ +0, …(1) ]"
    ],
    "restore": "sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal"
  },
  {
    "id": "L3.W4d",
    "guard": "an unknown prerelease value publishes nothing",
    "file": ".github/workflows/release.yml",
    "old": "--access public ;;\n            *) echo \"::error::prerelease is ${PRERELEASE}, not true or false\"; exit 1 ;;\n",
    "new": "--access public ;;\n            *) npm publish \"./release/${TARBALL:?}\" --provenance --access public ;;\n",
    "tests": "test/release-workflow.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/release-workflow.test.ts",
    "rc": 1,
    "threads": 1644,
    "red": "1 failed | 67 passed (68)",
    "failing": [
      "release.yml: one tarball, attested and published (L3.W4, L3.W5, L3.W6, L3.W11) L3.W6: attest and publish each download the release artifact into release/ and re-check it before using it; attest attests the file publish publishes"
    ],
    "assertions": [
      "AssertionError: expected [ …(3) ] to have a length of 2 but got 3"
    ],
    "restore": "sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal"
  },
  {
    "id": "L3.W4e",
    "guard": "a release candidate is a GitHub prerelease",
    "file": ".github/workflows/release.yml",
    "old": "            true) flags+=(--prerelease) ;;\n",
    "new": "            true) ;;\n",
    "tests": "test/release-workflow.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/release-workflow.test.ts",
    "rc": 1,
    "threads": 1598,
    "red": "1 failed | 67 passed (68)",
    "failing": [
      "release.yml: one tarball, attested and published (L3.W4, L3.W5, L3.W6, L3.W11) github-release marks a release candidate as a GitHub prerelease, and only a release candidate"
    ],
    "assertions": [
      "AssertionError: expected [ +0, …(1) ] to deeply equal [ +0, …(1) ]"
    ],
    "restore": "sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal"
  },
  {
    "id": "L3.W4f",
    "guard": "github-release refuses a prerelease value that is neither true nor false",
    "file": ".github/workflows/release.yml",
    "old": "            false) ;;\n            *) echo \"::error::prerelease is ${PRERELEASE}, not true or false\"; exit 1 ;;\n",
    "new": "            false) ;;\n            *) ;;\n",
    "tests": "test/release-workflow.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/release-workflow.test.ts",
    "rc": 1,
    "threads": 1575,
    "red": "1 failed | 67 passed (68)",
    "failing": [
      "release.yml: one tarball, attested and published (L3.W4, L3.W5, L3.W6, L3.W11) github-release creates nothing when prerelease is neither true nor false"
    ],
    "assertions": [
      "AssertionError: expected [ true, …(1) ] to deeply equal [ false, [] ]"
    ],
    "restore": "sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal"
  }
]
```

## L3.W5: `environment: npm-release` on publish

| Row | Guard | File | Change | Red | Restore |
|---|---|---|---|---|---|
| L3.W5a | environment: npm-release on publish | `.github/workflows/release.yml` | `    environment: npm-release\n` → (removed) | `test/release-workflow.test.ts`: exit 1, 1 failed \| 67 passed (68). "release.yml: one tarball, attested and published (L3.W4, L3.W5, L3.W6, L3.W11) L3.W5: publish runs in the npm-release environment, the operator-approved one; no other job names an environment" | sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal |

```json
[
  {
    "id": "L3.W5a",
    "guard": "environment: npm-release on publish",
    "file": ".github/workflows/release.yml",
    "old": "    environment: npm-release\n",
    "new": "(removed)",
    "tests": "test/release-workflow.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/release-workflow.test.ts",
    "rc": 1,
    "threads": 1649,
    "red": "1 failed | 67 passed (68)",
    "failing": [
      "release.yml: one tarball, attested and published (L3.W4, L3.W5, L3.W6, L3.W11) L3.W5: publish runs in the npm-release environment, the operator-approved one; no other job names an environment"
    ],
    "assertions": [
      "AssertionError: expected undefined to be 'npm-release' // Object.is equality"
    ],
    "restore": "sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal"
  }
]
```

## L3.W6: the attested file is the published file

| Row | Guard | File | Change | Red | Restore |
|---|---|---|---|---|---|
| L3.W6a | publish's sha256 re-check step | `.github/workflows/release.yml` | `      - name: the downloaded tarball is the one build packed\n        working-directory: r…` → `      - …` | `test/release-workflow.test.ts`: exit 1, 3 failed \| 65 passed (68). "release.yml: one tarball, attested and published (L3.W4, L3.W5, L3.W6, L3.W11) L3.W6: attest and publish each download the release artifact into release/ and re-check it before using it; attest attests the file publish publishes"; "release.yml: one tarball, attested and published (L3.W4, L3.W5, L3.W6, L3.W11) L3.W6: the re-check passes on the tarball build packed, and fails on a changed byte, a changed SHA256SUMS or a sha256 build did not hand on" (+1 more) | sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal |
| L3.W6b | the re-check against build's own sha256 | `.github/workflows/release.yml` | `          test "$(sha256sum -- "${TARBALL:?}" \| cut -d ' ' -f 1)" = "${SHA256:?}"\n      …` → `      …` | `test/release-workflow.test.ts`: exit 1, 1 failed \| 67 passed (68). "release.yml: one tarball, attested and published (L3.W4, L3.W5, L3.W6, L3.W11) L3.W6: the re-check passes on the tarball build packed, and fails on a changed byte, a changed SHA256SUMS or a sha256 build did not hand on" | sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal |
| L3.W6c | attest attests the file publish publishes | `.github/workflows/release.yml` | `subject-path: release/${{ needs.build.outputs.tarball }}` → `subject-path: release/*.tgz` | `test/release-workflow.test.ts`: exit 1, 1 failed \| 67 passed (68). "release.yml: one tarball, attested and published (L3.W4, L3.W5, L3.W6, L3.W11) L3.W6: attest and publish each download the release artifact into release/ and re-check it before using it; attest attests the file publish publishes" | sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal |
| L3.W6d | publish downloads the release artifact into release/ | `.github/workflows/release.yml` | `…release\n          path: release…` → `…release\n          path: dist…` | `test/release-workflow.test.ts`: exit 1, 1 failed \| 67 passed (68). "release.yml: one tarball, attested and published (L3.W4, L3.W5, L3.W6, L3.W11) L3.W6: attest and publish each download the release artifact into release/ and re-check it before using it; attest attests the file publish publishes" | sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal |

```json
[
  {
    "id": "L3.W6a",
    "guard": "publish's sha256 re-check step",
    "file": ".github/workflows/release.yml",
    "old": "      - name: the downloaded tarball is the one build packed\n        working-directory: release\n        env:\n          TARBALL: ${{ needs.build.outputs.tarball }}\n          SHA256: ${{ needs.build.outputs.sha256 }}\n        run: |\n          sha256sum --check --strict -- SHA256SUMS\n          test \"$(sha256sum -- \"${TARBALL:?}\" | cut -d ' ' -f 1)\" = \"${SHA256:?}\"\n      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0",
    "new": "      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0",
    "tests": "test/release-workflow.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/release-workflow.test.ts",
    "rc": 1,
    "threads": 1652,
    "red": "3 failed | 65 passed (68)",
    "failing": [
      "release.yml: one tarball, attested and published (L3.W4, L3.W5, L3.W6, L3.W11) L3.W6: attest and publish each download the release artifact into release/ and re-check it before using it; attest attests the file publish publishes",
      "release.yml: one tarball, attested and published (L3.W4, L3.W5, L3.W6, L3.W11) L3.W6: the re-check passes on the tarball build packed, and fails on a changed byte, a changed SHA256SUMS or a sha256 build did not hand on",
      "release.yml: one tarball, attested and published (L3.W4, L3.W5, L3.W6, L3.W11) publish installs an exact npm that publishes through trusted publishing, on exact Node 22, and checks the version it got"
    ],
    "assertions": [
      "AssertionError: expected [ 'publish', -1 ] to deeply equal [ 'publish', 1 ]",
      "AssertionError: expected 99 to be +0 // Object.is equality",
      "AssertionError: expected [ 'actions/download-artifact', …(3) ] to deeply equal [ 'actions/download-artifact', …(4) ]"
    ],
    "restore": "sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal"
  },
  {
    "id": "L3.W6b",
    "guard": "the re-check against build's own sha256",
    "file": ".github/workflows/release.yml",
    "old": "          test \"$(sha256sum -- \"${TARBALL:?}\" | cut -d ' ' -f 1)\" = \"${SHA256:?}\"\n      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0\n        with:\n          node-version: 22.23.3\n      - name: npm 11.21.0",
    "new": "      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0\n        with:\n          node-version: 22.23.3\n      - name: npm 11.21.0",
    "tests": "test/release-workflow.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/release-workflow.test.ts",
    "rc": 1,
    "threads": 1624,
    "red": "1 failed | 67 passed (68)",
    "failing": [
      "release.yml: one tarball, attested and published (L3.W4, L3.W5, L3.W6, L3.W11) L3.W6: the re-check passes on the tarball build packed, and fails on a changed byte, a changed SHA256SUMS or a sha256 build did not hand on"
    ],
    "assertions": [
      "AssertionError: expected +0 not to be +0 // Object.is equality"
    ],
    "restore": "sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal"
  },
  {
    "id": "L3.W6c",
    "guard": "attest attests the file publish publishes",
    "file": ".github/workflows/release.yml",
    "old": "subject-path: release/${{ needs.build.outputs.tarball }}",
    "new": "subject-path: release/*.tgz",
    "tests": "test/release-workflow.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/release-workflow.test.ts",
    "rc": 1,
    "threads": 1628,
    "red": "1 failed | 67 passed (68)",
    "failing": [
      "release.yml: one tarball, attested and published (L3.W4, L3.W5, L3.W6, L3.W11) L3.W6: attest and publish each download the release artifact into release/ and re-check it before using it; attest attests the file publish publishes"
    ],
    "assertions": [
      "AssertionError: expected { 'subject-path': 'release/*.tgz' } to deeply equal { Object (subject-path) }"
    ],
    "restore": "sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal"
  },
  {
    "id": "L3.W6d",
    "guard": "publish downloads the release artifact into release/",
    "file": ".github/workflows/release.yml",
    "old": "    environment: npm-release\n    permissions:\n      id-token: write\n      contents: read\n    steps:\n      - uses: actions/download-artifact@9000827ccba6bdab643e8b6fd33ac0654aef8333 # v8.0.2\n        with:\n          name: release\n          path: release\n",
    "new": "    environment: npm-release\n    permissions:\n      id-token: write\n      contents: read\n    steps:\n      - uses: actions/download-artifact@9000827ccba6bdab643e8b6fd33ac0654aef8333 # v8.0.2\n        with:\n          name: release\n          path: dist\n",
    "tests": "test/release-workflow.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/release-workflow.test.ts",
    "rc": 1,
    "threads": 1613,
    "red": "1 failed | 67 passed (68)",
    "failing": [
      "release.yml: one tarball, attested and published (L3.W4, L3.W5, L3.W6, L3.W11) L3.W6: attest and publish each download the release artifact into release/ and re-check it before using it; attest attests the file publish publishes"
    ],
    "assertions": [
      "AssertionError: expected [ 'publish', …(1) ] to deeply equal [ Array(2) ]"
    ],
    "restore": "sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal"
  }
]
```

## L3.W7: verify-tag precedes every job and runs Reference §13 step 1's six checks

| Row | Guard | File | Change | Red | Restore |
|---|---|---|---|---|---|
| L3.W7a | build needs verify-tag | `.github/workflows/release.yml` | `    needs: [verify-tag, …` → `    needs: […` | `test/release-workflow.test.ts`: exit 1, 1 failed \| 67 passed (68). "release.yml: triggers and the job graph L3.W7: verify-tag needs nothing and every other job needs verify-tag and the job before it, so verify-tag precedes every job" | sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal |
| L3.W7b | check 4, the tag is on main (step deleted) | `.github/workflows/release.yml` | `      - name: 4. the tag is on main\n        if: github.event_name == 'push' && startsWith…` → (removed) | `test/release-workflow.test.ts`: exit 1, 3 failed \| 65 passed (68). "release.yml: verify-tag (L3.W7, L3.W11) checks out the whole history (main and the tags) with no credentials kept, then runs its two tag-free checks and its tag step and six tag-only checks, in order"; "release.yml: verify-tag (L3.W7, L3.W11) L3.W11: the tag step and the six tag-only checks run only on a pushed tag; the two tag-free checks run on a dispatch too" (+1 more) | sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal |
| L3.W7c | check 6, the environment check (step deleted) | `.github/workflows/release.yml` | `      - name: 6. the npm-release environment needs a reviewer, prevents self-review and de…` → (removed) | `test/release-workflow.test.ts`: exit 1, 3 failed \| 65 passed (68). "release.yml: verify-tag (L3.W7, L3.W11) checks out the whole history (main and the tags) with no credentials kept, then runs its two tag-free checks and its tag step and six tag-only checks, in order"; "release.yml: verify-tag (L3.W7, L3.W11) L3.W11: the tag step and the six tag-only checks run only on a pushed tag; the two tag-free checks run on a dispatch too" (+1 more) | sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal |
| L3.W7d | check 2, the key-line check | `.github/workflows/release.yml` | `          if [ -z "$keys" ]; then\n            echo "::error::.github/release-signers hold…` → (removed) | `test/release-workflow.test.ts`: exit 1, 2 failed \| 66 passed (68). "release.yml: verify-tag (L3.W7, L3.W11) 2. the signature check fails, verifying nothing and saying why, when the file holds only its header (no key line)"; "release.yml: verify-tag (L3.W7, L3.W11) 2. the signature check fails, verifying nothing and saying why, when the file is empty" | sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal |
| L3.W7e | check 2, the principal check | `.github/workflows/release.yml` | `          if …` → `          if false && …` | `test/release-workflow.test.ts`: exit 1, 2 failed \| 66 passed (68). "release.yml: verify-tag (L3.W7, L3.W11) 2. the signature check fails, verifying nothing and saying why, when a key line names another principal"; "release.yml: verify-tag (L3.W7, L3.W11) 2. the signature check fails, verifying nothing and saying why, when a key line carries no key" | sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal |
| L3.W7f | check 6, prevent self-review | `.github/workflows/release.yml` | ` \|\| reviewers[0].prevent_self_review !== true…` → (removed) | `test/release-workflow.test.ts`: exit 1, 2 failed \| 66 passed (68). "release.yml: verify-tag (L3.W7, L3.W11) 6. the environment check fails closed when self-review is allowed"; "release.yml: verify-tag (L3.W7, L3.W11) 6. the environment check fails closed when self-review is not stated" | sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal |
| L3.W7g | check 6, the v* tag policy | `.github/workflows/release.yml` | `if (list.length !== 1 \|\| list[0]?.name !== 'v*' \|\| list[0]?.type !== 'tag'…` → `if (list.length < 1…` | `test/release-workflow.test.ts`: exit 1, 3 failed \| 65 passed (68). "release.yml: verify-tag (L3.W7, L3.W11) 6. the environment check fails closed when the policy names a branch, not a tag"; "release.yml: verify-tag (L3.W7, L3.W11) 6. the environment check fails closed when the policy admits every tag" (+1 more) | sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal |
| L3.W7h | check 1, the annotated tag (step deleted) | `.github/workflows/release.yml` | `      - name: 1. the tag is an annotated tag object\n        if: github.event_name == 'pus…` → (removed) | `test/release-workflow.test.ts`: exit 1, 3 failed \| 65 passed (68). "release.yml: verify-tag (L3.W7, L3.W11) checks out the whole history (main and the tags) with no credentials kept, then runs its two tag-free checks and its tag step and six tag-only checks, in order"; "release.yml: verify-tag (L3.W7, L3.W11) L3.W11: the tag step and the six tag-only checks run only on a pushed tag; the two tag-free checks run on a dispatch too" (+1 more) | sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal |
| L3.W7i | the tag-free check: package.json's version equals assets.json's | `.github/workflows/release.yml` | `          if [ "$version" != "$assets" ]; then\n            echo "::error::package.json's …` → (removed) | `test/release-workflow.test.ts`: exit 1, 1 failed \| 67 passed (68). "release.yml: verify-tag (L3.W7, L3.W11) the version check fails, handing on nothing, when assets.json names another version" | sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal |
| L3.W7j | check 3, the tag is v + version | `.github/workflows/release.yml` | `run: test "${TAG:?}" = "v${VERSION…` → `run: test -n "${TAG…` | `test/release-workflow.test.ts`: exit 1, 1 failed \| 67 passed (68). "release.yml: verify-tag (L3.W7, L3.W11) 3. the version check passes only when the tag is v + package.json's version" | sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal |
| L3.W7k | check 5, not private | `.github/workflows/release.yml` | `if (Object.hasOwn(require('./package.json'), 'private')…` → `if (require('./package.json').private === true…` | `test/release-workflow.test.ts`: exit 1, 1 failed \| 67 passed (68). "release.yml: verify-tag (L3.W7, L3.W11) 5. the private check fails while package.json carries private, in any value" | sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal |
| L3.W7l | the signers file equals main's copy | `.github/workflows/release.yml` | `          cmp -- "$RUNNER_TEMP/release-signers" .github/release-signers\n` → (removed) | `test/release-workflow.test.ts`: exit 1, 1 failed \| 67 passed (68). "release.yml: verify-tag (L3.W7, L3.W11) the signers check passes only when the checkout's .github/release-signers is main's copy, byte for byte, and keeps main's copy for the signature check" | sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal |
| L3.W7m | the fetched tag names the pushed commit (the whole comparison deleted) | `.github/workflows/release.yml` | `          if [ -z "$pushed" ] \|\| [ "$commit" != "$pushed" ] \|\| [ "$head" != "$pushed" ]; t…` → (removed) | `test/release-workflow.test.ts`: exit 1, 5 failed \| 63 passed (68). "release.yml: verify-tag (L3.W7, L3.W11) the tag step fails, handing on no tag, when the fetched tag now points at another commit (moved, or deleted and pushed again, after this run was queued): every check reads the commit that test and build use"; "release.yml: verify-tag (L3.W7, L3.W11) the tag step fails, handing on no tag, when the checkout is not the pushed commit: every check reads the commit that test and build use" (+3 more) | sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal |
| L3.W7n | the fetched tag's commit is compared with the pushed commit | `.github/workflows/release.yml` | ` \|\| [ "$commit" != "$pushed" ]` → (removed) | `test/release-workflow.test.ts`: exit 1, 2 failed \| 66 passed (68). "release.yml: verify-tag (L3.W7, L3.W11) the tag step fails, handing on no tag, when the fetched tag now points at another commit (moved, or deleted and pushed again, after this run was queued): every check reads the commit that test and build use"; "release.yml: verify-tag (L3.W7, L3.W11) the tag step fails, handing on no tag, when git names no commit for the tag: every check reads the commit that test and build use" | sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal |
| L3.W7o | the checkout is compared with the pushed commit | `.github/workflows/release.yml` | ` \|\| [ "$head" != "$pushed" ]` → (removed) | `test/release-workflow.test.ts`: exit 1, 1 failed \| 67 passed (68). "release.yml: verify-tag (L3.W7, L3.W11) the tag step fails, handing on no tag, when the checkout is not the pushed commit: every check reads the commit that test and build use" | sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal |
| L3.W7p | the pushed id is peeled to its commit (GitHub may give the tag object) | `.github/workflows/release.yml` | `pushed="$(git rev-parse --verify "${GITHUB_SHA:?}^{commit}")…` → `pushed="${GITHUB_SHA:?}…` | `test/release-workflow.test.ts`: exit 1, 1 failed \| 67 passed (68). "release.yml: verify-tag (L3.W7, L3.W11) the tag step names the tag from a pushed release ref and fetches it as the object it is; any other ref fails before any fetch" | sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal |
| L3.W7q | a pushed id that names no commit fails the step | `.github/workflows/release.yml` | `if [ -z "$pushed" ] \|\| [ …` → `if [ …` | `test/release-workflow.test.ts`: exit 1, 1 failed \| 67 passed (68). "release.yml: verify-tag (L3.W7, L3.W11) the tag step fails when GitHub gave no pushed commit, or one git cannot peel to a commit" | sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal |

```json
[
  {
    "id": "L3.W7a",
    "guard": "build needs verify-tag",
    "file": ".github/workflows/release.yml",
    "old": "    needs: [verify-tag, test]\n",
    "new": "    needs: [test]\n",
    "tests": "test/release-workflow.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/release-workflow.test.ts",
    "rc": 1,
    "threads": 1635,
    "red": "1 failed | 67 passed (68)",
    "failing": [
      "release.yml: triggers and the job graph L3.W7: verify-tag needs nothing and every other job needs verify-tag and the job before it, so verify-tag precedes every job"
    ],
    "assertions": [
      "AssertionError: expected [ 'build', [ 'test' ] ] to deeply equal [ 'build', [ 'verify-tag', 'test' ] ]"
    ],
    "restore": "sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal"
  },
  {
    "id": "L3.W7b",
    "guard": "check 4, the tag is on main (step deleted)",
    "file": ".github/workflows/release.yml",
    "old": "      - name: 4. the tag is on main\n        if: github.event_name == 'push' && startsWith(github.ref, 'refs/tags/v')\n        env:\n          TAG: ${{ steps.tag.outputs.tag }}\n        run: git merge-base --is-ancestor \"refs/tags/${TAG:?}\" origin/main\n",
    "new": "(removed)",
    "tests": "test/release-workflow.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/release-workflow.test.ts",
    "rc": 1,
    "threads": 1613,
    "red": "3 failed | 65 passed (68)",
    "failing": [
      "release.yml: verify-tag (L3.W7, L3.W11) checks out the whole history (main and the tags) with no credentials kept, then runs its two tag-free checks and its tag step and six tag-only checks, in order",
      "release.yml: verify-tag (L3.W7, L3.W11) L3.W11: the tag step and the six tag-only checks run only on a pushed tag; the two tag-free checks run on a dispatch too",
      "release.yml: verify-tag (L3.W7, L3.W11) 4. the main check asks git whether the tag is an ancestor of origin/main, and fails when it is not"
    ],
    "assertions": [
      "AssertionError: expected [ …(8) ] to deeply equal [ …(9) ]",
      "AssertionError: expected [ '4. the tag is on main', undefined ] to deeply equal [ '4. the tag is on main', …(1) ]",
      "AssertionError: expected [ 99, [] ] to deeply equal [ +0, …(1) ]"
    ],
    "restore": "sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal"
  },
  {
    "id": "L3.W7c",
    "guard": "check 6, the environment check (step deleted)",
    "file": ".github/workflows/release.yml",
    "old": "      - name: 6. the npm-release environment needs a reviewer, prevents self-review and deploys v* tags only\n        if: github.event_name == 'push' && startsWith(github.ref, 'refs/tags/v')\n        env:\n          GH_TOKEN: ${{ github.token }}\n          REPO: ${{ github.repository }}\n        run: |\n          gh api \"repos/${REPO:?}/environments/npm-release\" > \"${RUNNER_TEMP:?}/environment.json\"\n          gh api \"repos/${REPO}/environments/npm-release/deployment-branch-policies\" > \"$RUNNER_TEMP/policies.json\"\n          node - \"$RUNNER_TEMP/environment.json\" \"$RUNNER_TEMP/policies.json\" <<'EOF'\n          const { readFileSync } = require('node:fs');\n          const [env, policies] = process.argv.slice(2).map((f) => JSON.parse(readFileSync(f, 'utf8')));\n          const rules = Array.isArray(env?.protection_rules) ? env.protection_rules : [];\n          const reviewers = rules.filter((r) => r?.type === 'required_reviewers');\n          const deployment = env?.deployment_branch_policy;\n          const list = Array.isArray(policies?.branch_policies) ? policies.branch_policies : [];\n          const failures = [];\n          if (reviewers.length !== 1 || !Array.isArray(reviewers[0].reviewers) || reviewers[0].reviewers.length === 0) failures.push('no required reviewer');\n          if (reviewers.length !== 1 || reviewers[0].prevent_self_review !== true) failures.push('self-review is not prevented');\n          if (deployment?.custom_branch_policies !== true || deployment?.protected_branches !== false) failures.push('deployments are not limited to named refs');\n          if (list.length !== 1 || list[0]?.name !== 'v*' || list[0]?.type !== 'tag') failures.push('the deployment policy is not exactly the tag pattern v*');\n          for (const f of failures) console.error(`::error::npm-release environment: ${f}`);\n          process.exit(failures.length === 0 ? 0 : 1);\n          EOF\n",
    "new": "(removed)",
    "tests": "test/release-workflow.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/release-workflow.test.ts",
    "rc": 1,
    "threads": 1609,
    "red": "3 failed | 65 passed (68)",
    "failing": [
      "release.yml: verify-tag (L3.W7, L3.W11) checks out the whole history (main and the tags) with no credentials kept, then runs its two tag-free checks and its tag step and six tag-only checks, in order",
      "release.yml: verify-tag (L3.W7, L3.W11) L3.W11: the tag step and the six tag-only checks run only on a pushed tag; the two tag-free checks run on a dispatch too",
      "release.yml: verify-tag (L3.W7, L3.W11) 6. the environment check reads the environment and its deployment policies with the job's token, and passes on the protected environment"
    ],
    "assertions": [
      "AssertionError: expected [ …(8) ] to deeply equal [ …(9) ]",
      "AssertionError: expected [ …(2) ] to deeply equal [ …(2) ]",
      "AssertionError: expected 99 to be +0 // Object.is equality"
    ],
    "restore": "sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal"
  },
  {
    "id": "L3.W7d",
    "guard": "check 2, the key-line check",
    "file": ".github/workflows/release.yml",
    "old": "          if [ -z \"$keys\" ]; then\n            echo \"::error::.github/release-signers holds no key line: the operator's line for release-signer lands before a tag\"\n            exit 1\n          fi\n",
    "new": "(removed)",
    "tests": "test/release-workflow.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/release-workflow.test.ts",
    "rc": 1,
    "threads": 1632,
    "red": "2 failed | 66 passed (68)",
    "failing": [
      "release.yml: verify-tag (L3.W7, L3.W11) 2. the signature check fails, verifying nothing and saying why, when the file holds only its header (no key line)",
      "release.yml: verify-tag (L3.W7, L3.W11) 2. the signature check fails, verifying nothing and saying why, when the file is empty"
    ],
    "assertions": [
      "AssertionError: expected [ Array(1) ] to deeply equal [ Array(1) ]",
      "AssertionError: expected [ Array(1) ] to deeply equal [ Array(1) ]"
    ],
    "restore": "sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal"
  },
  {
    "id": "L3.W7e",
    "guard": "check 2, the principal check",
    "file": ".github/workflows/release.yml",
    "old": "          if printf '%s\\n' \"$keys\" | grep -Evq",
    "new": "          if false && printf '%s\\n' \"$keys\" | grep -Evq",
    "tests": "test/release-workflow.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/release-workflow.test.ts",
    "rc": 1,
    "threads": 1645,
    "red": "2 failed | 66 passed (68)",
    "failing": [
      "release.yml: verify-tag (L3.W7, L3.W11) 2. the signature check fails, verifying nothing and saying why, when a key line names another principal",
      "release.yml: verify-tag (L3.W7, L3.W11) 2. the signature check fails, verifying nothing and saying why, when a key line carries no key"
    ],
    "assertions": [
      "AssertionError: expected [ true, …(1) ] to deeply equal [ false, [] ]",
      "AssertionError: expected [ true, …(1) ] to deeply equal [ false, [] ]"
    ],
    "restore": "sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal"
  },
  {
    "id": "L3.W7f",
    "guard": "check 6, prevent self-review",
    "file": ".github/workflows/release.yml",
    "old": " || reviewers[0].prevent_self_review !== true) failures.push",
    "new": ") failures.push",
    "tests": "test/release-workflow.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/release-workflow.test.ts",
    "rc": 1,
    "threads": 1647,
    "red": "2 failed | 66 passed (68)",
    "failing": [
      "release.yml: verify-tag (L3.W7, L3.W11) 6. the environment check fails closed when self-review is allowed",
      "release.yml: verify-tag (L3.W7, L3.W11) 6. the environment check fails closed when self-review is not stated"
    ],
    "assertions": [
      "AssertionError: expected +0 not to be +0 // Object.is equality",
      "AssertionError: expected +0 not to be +0 // Object.is equality"
    ],
    "restore": "sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal"
  },
  {
    "id": "L3.W7g",
    "guard": "check 6, the v* tag policy",
    "file": ".github/workflows/release.yml",
    "old": "if (list.length !== 1 || list[0]?.name !== 'v*' || list[0]?.type !== 'tag')",
    "new": "if (list.length < 1)",
    "tests": "test/release-workflow.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/release-workflow.test.ts",
    "rc": 1,
    "threads": 1638,
    "red": "3 failed | 65 passed (68)",
    "failing": [
      "release.yml: verify-tag (L3.W7, L3.W11) 6. the environment check fails closed when the policy names a branch, not a tag",
      "release.yml: verify-tag (L3.W7, L3.W11) 6. the environment check fails closed when the policy admits every tag",
      "release.yml: verify-tag (L3.W7, L3.W11) 6. the environment check fails closed when a second policy admits a branch too"
    ],
    "assertions": [
      "AssertionError: expected +0 not to be +0 // Object.is equality",
      "AssertionError: expected +0 not to be +0 // Object.is equality",
      "AssertionError: expected +0 not to be +0 // Object.is equality"
    ],
    "restore": "sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal"
  },
  {
    "id": "L3.W7h",
    "guard": "check 1, the annotated tag (step deleted)",
    "file": ".github/workflows/release.yml",
    "old": "      - name: 1. the tag is an annotated tag object\n        if: github.event_name == 'push' && startsWith(github.ref, 'refs/tags/v')\n        env:\n          TAG: ${{ steps.tag.outputs.tag }}\n        run: test \"$(git cat-file -t \"refs/tags/${TAG:?}\")\" = tag\n",
    "new": "(removed)",
    "tests": "test/release-workflow.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/release-workflow.test.ts",
    "rc": 1,
    "threads": 1574,
    "red": "3 failed | 65 passed (68)",
    "failing": [
      "release.yml: verify-tag (L3.W7, L3.W11) checks out the whole history (main and the tags) with no credentials kept, then runs its two tag-free checks and its tag step and six tag-only checks, in order",
      "release.yml: verify-tag (L3.W7, L3.W11) L3.W11: the tag step and the six tag-only checks run only on a pushed tag; the two tag-free checks run on a dispatch too",
      "release.yml: verify-tag (L3.W7, L3.W11) 1. the annotated-tag check fails on a lightweight tag (git answers commit)"
    ],
    "assertions": [
      "AssertionError: expected [ …(8) ] to deeply equal [ …(9) ]",
      "AssertionError: expected [ …(2) ] to deeply equal [ …(2) ]",
      "AssertionError: expected 99 to be +0 // Object.is equality"
    ],
    "restore": "sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal"
  },
  {
    "id": "L3.W7i",
    "guard": "the tag-free check: package.json's version equals assets.json's",
    "file": ".github/workflows/release.yml",
    "old": "          if [ \"$version\" != \"$assets\" ]; then\n            echo \"::error::package.json's version ${version} is not assets.json's version ${assets}\"\n            exit 1\n          fi\n",
    "new": "(removed)",
    "tests": "test/release-workflow.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/release-workflow.test.ts",
    "rc": 1,
    "threads": 1580,
    "red": "1 failed | 67 passed (68)",
    "failing": [
      "release.yml: verify-tag (L3.W7, L3.W11) the version check fails, handing on nothing, when assets.json names another version"
    ],
    "assertions": [
      "AssertionError: expected [ true, [ 'version=1.0.0', …(1) ] ] to deeply equal [ false, [] ]"
    ],
    "restore": "sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal"
  },
  {
    "id": "L3.W7j",
    "guard": "check 3, the tag is v + version",
    "file": ".github/workflows/release.yml",
    "old": "run: test \"${TAG:?}\" = \"v${VERSION:?}\"",
    "new": "run: test -n \"${TAG:?}\"",
    "tests": "test/release-workflow.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/release-workflow.test.ts",
    "rc": 1,
    "threads": 1580,
    "red": "1 failed | 67 passed (68)",
    "failing": [
      "release.yml: verify-tag (L3.W7, L3.W11) 3. the version check passes only when the tag is v + package.json's version"
    ],
    "assertions": [
      "AssertionError: expected +0 not to be +0 // Object.is equality"
    ],
    "restore": "sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal"
  },
  {
    "id": "L3.W7k",
    "guard": "check 5, not private",
    "file": ".github/workflows/release.yml",
    "old": "if (Object.hasOwn(require('./package.json'), 'private'))",
    "new": "if (require('./package.json').private === true)",
    "tests": "test/release-workflow.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/release-workflow.test.ts",
    "rc": 1,
    "threads": 1586,
    "red": "1 failed | 67 passed (68)",
    "failing": [
      "release.yml: verify-tag (L3.W7, L3.W11) 5. the private check fails while package.json carries private, in any value"
    ],
    "assertions": [
      "AssertionError: expected +0 not to be +0 // Object.is equality"
    ],
    "restore": "sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal"
  },
  {
    "id": "L3.W7l",
    "guard": "the signers file equals main's copy",
    "file": ".github/workflows/release.yml",
    "old": "          cmp -- \"$RUNNER_TEMP/release-signers\" .github/release-signers\n",
    "new": "(removed)",
    "tests": "test/release-workflow.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/release-workflow.test.ts",
    "rc": 1,
    "threads": 1574,
    "red": "1 failed | 67 passed (68)",
    "failing": [
      "release.yml: verify-tag (L3.W7, L3.W11) the signers check passes only when the checkout's .github/release-signers is main's copy, byte for byte, and keeps main's copy for the signature check"
    ],
    "assertions": [
      "AssertionError: expected +0 not to be +0 // Object.is equality"
    ],
    "restore": "sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal"
  },
  {
    "id": "L3.W7m",
    "guard": "the fetched tag names the pushed commit (the whole comparison deleted)",
    "file": ".github/workflows/release.yml",
    "old": "          if [ -z \"$pushed\" ] || [ \"$commit\" != \"$pushed\" ] || [ \"$head\" != \"$pushed\" ]; then\n            echo \"::error::the tag ${tag} names ${commit:-no commit} and the checkout is ${head:-no commit}, but the pushed commit is ${pushed:-unknown}\"\n            exit 1\n          fi\n",
    "new": "(removed)",
    "tests": "test/release-workflow.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/release-workflow.test.ts",
    "rc": 1,
    "threads": 1588,
    "red": "5 failed | 63 passed (68)",
    "failing": [
      "release.yml: verify-tag (L3.W7, L3.W11) the tag step fails, handing on no tag, when the fetched tag now points at another commit (moved, or deleted and pushed again, after this run was queued): every check reads the commit that test and build use",
      "release.yml: verify-tag (L3.W7, L3.W11) the tag step fails, handing on no tag, when the checkout is not the pushed commit: every check reads the commit that test and build use",
      "release.yml: verify-tag (L3.W7, L3.W11) the tag step fails, handing on no tag, when git names no commit for the tag: every check reads the commit that test and build use",
      "release.yml: verify-tag (L3.W7, L3.W11) the tag step fails, handing on no tag, when git names no commit for the tag or the checkout: every check reads the commit that test and build use",
      "release.yml: verify-tag (L3.W7, L3.W11) the tag step fails when GitHub gave no pushed commit, or one git cannot peel to a commit"
    ],
    "assertions": [
      "AssertionError: expected [ true, [ 'tag=v1.0.0' ] ] to deeply equal [ false, [] ]",
      "AssertionError: expected [ true, [ 'tag=v1.0.0' ] ] to deeply equal [ false, [] ]",
      "AssertionError: expected [ true, [ 'tag=v1.0.0' ] ] to deeply equal [ false, [] ]",
      "AssertionError: expected [ true, [ 'tag=v1.0.0' ] ] to deeply equal [ false, [] ]",
      "AssertionError: expected [ true, [ 'tag=v1.0.0' ] ] to deeply equal [ false, [] ]"
    ],
    "restore": "sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal"
  },
  {
    "id": "L3.W7n",
    "guard": "the fetched tag's commit is compared with the pushed commit",
    "file": ".github/workflows/release.yml",
    "old": " || [ \"$commit\" != \"$pushed\" ]",
    "new": "(removed)",
    "tests": "test/release-workflow.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/release-workflow.test.ts",
    "rc": 1,
    "threads": 1570,
    "red": "2 failed | 66 passed (68)",
    "failing": [
      "release.yml: verify-tag (L3.W7, L3.W11) the tag step fails, handing on no tag, when the fetched tag now points at another commit (moved, or deleted and pushed again, after this run was queued): every check reads the commit that test and build use",
      "release.yml: verify-tag (L3.W7, L3.W11) the tag step fails, handing on no tag, when git names no commit for the tag: every check reads the commit that test and build use"
    ],
    "assertions": [
      "AssertionError: expected [ true, [ 'tag=v1.0.0' ] ] to deeply equal [ false, [] ]",
      "AssertionError: expected [ true, [ 'tag=v1.0.0' ] ] to deeply equal [ false, [] ]"
    ],
    "restore": "sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal"
  },
  {
    "id": "L3.W7o",
    "guard": "the checkout is compared with the pushed commit",
    "file": ".github/workflows/release.yml",
    "old": " || [ \"$head\" != \"$pushed\" ]",
    "new": "(removed)",
    "tests": "test/release-workflow.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/release-workflow.test.ts",
    "rc": 1,
    "threads": 1553,
    "red": "1 failed | 67 passed (68)",
    "failing": [
      "release.yml: verify-tag (L3.W7, L3.W11) the tag step fails, handing on no tag, when the checkout is not the pushed commit: every check reads the commit that test and build use"
    ],
    "assertions": [
      "AssertionError: expected [ true, [ 'tag=v1.0.0' ] ] to deeply equal [ false, [] ]"
    ],
    "restore": "sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal"
  },
  {
    "id": "L3.W7p",
    "guard": "the pushed id is peeled to its commit (GitHub may give the tag object)",
    "file": ".github/workflows/release.yml",
    "old": "pushed=\"$(git rev-parse --verify \"${GITHUB_SHA:?}^{commit}\")\"",
    "new": "pushed=\"${GITHUB_SHA:?}\"",
    "tests": "test/release-workflow.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/release-workflow.test.ts",
    "rc": 1,
    "threads": 1577,
    "red": "1 failed | 67 passed (68)",
    "failing": [
      "release.yml: verify-tag (L3.W7, L3.W11) the tag step names the tag from a pushed release ref and fetches it as the object it is; any other ref fails before any fetch"
    ],
    "assertions": [
      "AssertionError: expected [ …(3) ] to deeply equal [ …(4) ]"
    ],
    "restore": "sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal"
  },
  {
    "id": "L3.W7q",
    "guard": "a pushed id that names no commit fails the step",
    "file": ".github/workflows/release.yml",
    "old": "if [ -z \"$pushed\" ] || [ \"$commit\"",
    "new": "if [ \"$commit\"",
    "tests": "test/release-workflow.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/release-workflow.test.ts",
    "rc": 1,
    "threads": 1591,
    "red": "1 failed | 67 passed (68)",
    "failing": [
      "release.yml: verify-tag (L3.W7, L3.W11) the tag step fails when GitHub gave no pushed commit, or one git cannot peel to a commit"
    ],
    "assertions": [
      "AssertionError: expected [ true, [ 'tag=v1.0.0' ] ] to deeply equal [ false, [] ]"
    ],
    "restore": "sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal"
  }
]
```

## L3.W8: remote actions pinned by full sha with a tag comment; the one local `uses:` is ci.yml

| Row | Guard | File | Change | Red | Restore |
|---|---|---|---|---|---|
| L3.W8a | remote actions pinned by sha (plan: actions/checkout@v4) | `.github/workflows/release.yml` | `… uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262…` → `… uses: actions/checkout@v4…` | `test/release-workflow.test.ts`: exit 1, 3 failed \| 65 passed (68). "release.yml: verify-tag (L3.W7, L3.W11) checks out the whole history (main and the tags) with no credentials kept, then runs its two tag-free checks and its tag step and six tag-only checks, in order"; "release.yml: pinned actions (L3.W8) L3.W8: every remote 'uses:' is a full commit sha with its release tag in a trailing comment; the only local one is ci.yml, in the test job" (+1 more) | sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal |
| L3.W8b | the tag comment on each pin | `.github/workflows/release.yml` | `…81f78447822ac1eab6504dd8 # v4.2.2` → `…81f78447822ac1eab6504dd8` | `test/release-workflow.test.ts`: exit 1, 2 failed \| 66 passed (68). "release.yml: pinned actions (L3.W8) L3.W8: every remote 'uses:' is a full commit sha with its release tag in a trailing comment; the only local one is ci.yml, in the test job"; "release.yml: pinned actions (L3.W8) L3.W8: each pin names the release its tag comment names, and ci.yml pins the same sha for the same action" | sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal |
| L3.W8c | the only local uses is ci.yml, in the test job | `.github/workflows/release.yml` | `…es: ./.github/workflows/ci…` → `…es: ./.github/workflows/other…` | `test/release-workflow.test.ts`: exit 1, 2 failed \| 66 passed (68). "release.yml: test and build L3.W8: the test job is the one local 'uses:', ci.yml at the same commit, run in full"; "release.yml: pinned actions (L3.W8) L3.W8: every remote 'uses:' is a full commit sha with its release tag in a trailing comment; the only local one is ci.yml, in the test job" | sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal |

```json
[
  {
    "id": "L3.W8a",
    "guard": "remote actions pinned by sha (plan: actions/checkout@v4)",
    "file": ".github/workflows/release.yml",
    "old": "      prerelease: ${{ steps.version.outputs.prerelease }}\n    steps:\n      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4.4.0\n",
    "new": "      prerelease: ${{ steps.version.outputs.prerelease }}\n    steps:\n      - uses: actions/checkout@v4 # v4.4.0\n",
    "tests": "test/release-workflow.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/release-workflow.test.ts",
    "rc": 1,
    "threads": 1560,
    "red": "3 failed | 65 passed (68)",
    "failing": [
      "release.yml: verify-tag (L3.W7, L3.W11) checks out the whole history (main and the tags) with no credentials kept, then runs its two tag-free checks and its tag step and six tag-only checks, in order",
      "release.yml: pinned actions (L3.W8) L3.W8: every remote `uses:` is a full commit sha with its release tag in a trailing comment; the only local one is ci.yml, in the test job",
      "release.yml: pinned actions (L3.W8) L3.W8: each pin names the release its tag comment names, and ci.yml pins the same sha for the same action"
    ],
    "assertions": [
      "AssertionError: expected { uses: 'actions/checkout@v4', …(1) } to deeply equal { …(2) }",
      "AssertionError:       - uses: actions/checkout@v4 # v4.4.0: expected 'actions/checkout@v4' to match /^[A-Za-z0-9_.-]+\\/…/[A-Za-z0-9_.-]+(?:\\",
      "AssertionError: expected [ …(6) ] to deeply equal [ …(5) ]"
    ],
    "restore": "sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal"
  },
  {
    "id": "L3.W8b",
    "guard": "the tag comment on each pin",
    "file": ".github/workflows/release.yml",
    "old": "actions/attest-build-provenance@4d101475d8b20a2381f78447822ac1eab6504dd8 # v4.2.2",
    "new": "actions/attest-build-provenance@4d101475d8b20a2381f78447822ac1eab6504dd8",
    "tests": "test/release-workflow.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/release-workflow.test.ts",
    "rc": 1,
    "threads": 1553,
    "red": "2 failed | 66 passed (68)",
    "failing": [
      "release.yml: pinned actions (L3.W8) L3.W8: every remote `uses:` is a full commit sha with its release tag in a trailing comment; the only local one is ci.yml, in the test job",
      "release.yml: pinned actions (L3.W8) L3.W8: each pin names the release its tag comment names, and ci.yml pins the same sha for the same action"
    ],
    "assertions": [
      "AssertionError:       - uses: actions/attest-build-provenance@4d101475d8b20a2381f78447822ac1eab6504dd8: expected null not to be null",
      "AssertionError: expected [ …(5) ] to deeply equal [ …(5) ]"
    ],
    "restore": "sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal"
  },
  {
    "id": "L3.W8c",
    "guard": "the only local uses is ci.yml, in the test job",
    "file": ".github/workflows/release.yml",
    "old": "    uses: ./.github/workflows/ci.yml",
    "new": "    uses: ./.github/workflows/other.yml",
    "tests": "test/release-workflow.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/release-workflow.test.ts",
    "rc": 1,
    "threads": 1542,
    "red": "2 failed | 66 passed (68)",
    "failing": [
      "release.yml: test and build L3.W8: the test job is the one local `uses:`, ci.yml at the same commit, run in full",
      "release.yml: pinned actions (L3.W8) L3.W8: every remote `uses:` is a full commit sha with its release tag in a trailing comment; the only local one is ci.yml, in the test job"
    ],
    "assertions": [
      "AssertionError: expected './.github/workflows/other.yml' to be './.github/workflows/ci.yml' // Object.is equality",
      "AssertionError: expected [ Array(1) ] to deeply equal [ 'uses: ./.github/workflows/ci.yml' ]"
    ],
    "restore": "sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal"
  }
]
```

## L3.W9: post-verify runs the README's five commands verbatim

| Row | Guard | File | Change | Red | Restore |
|---|---|---|---|---|---|
| L3.W9a | post-verify runs npm audit signatures | `.github/workflows/release.yml` | `…ERSION --ignore-scripts\n          npm audit signatures\n` → `…ERSION --ignore-scripts\n` | `test/release-workflow.test.ts`: exit 1, 1 failed \| 67 passed (68). "release.yml: post-verify (L3.W9) L3.W9: post-verify runs the README's five verification commands, verbatim, in a scratch directory, with the released version" | sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal |
| L3.W9b | post-verify installs with --ignore-scripts | `.github/workflows/release.yml` | `…-labs/docserver@$VERSION --ignore-scripts…` → `…-labs/docserver@$VERSION…` | `test/release-workflow.test.ts`: exit 1, 1 failed \| 67 passed (68). "release.yml: post-verify (L3.W9) L3.W9: post-verify runs the README's five verification commands, verbatim, in a scratch directory, with the released version" | sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal |
| L3.W9c | post-verify compares the integrity | `.github/workflows/release.yml` | `          test…` → `          echo…` | `test/release-workflow.test.ts`: exit 1, 1 failed \| 67 passed (68). "release.yml: post-verify (L3.W9) L3.W9: post-verify runs the README's five verification commands, verbatim, in a scratch directory, with the released version" | sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal |

```json
[
  {
    "id": "L3.W9a",
    "guard": "post-verify runs npm audit signatures",
    "file": ".github/workflows/release.yml",
    "old": "          npm install @synapsium-labs/docserver@$VERSION --ignore-scripts\n          npm audit signatures\n",
    "new": "          npm install @synapsium-labs/docserver@$VERSION --ignore-scripts\n",
    "tests": "test/release-workflow.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/release-workflow.test.ts",
    "rc": 1,
    "threads": 1550,
    "red": "1 failed | 67 passed (68)",
    "failing": [
      "release.yml: post-verify (L3.W9) L3.W9: post-verify runs the README's five verification commands, verbatim, in a scratch directory, with the released version"
    ],
    "assertions": [
      "AssertionError: expected [ …(4) ] to deeply equal [ …(5) ]"
    ],
    "restore": "sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal"
  },
  {
    "id": "L3.W9b",
    "guard": "post-verify installs with --ignore-scripts",
    "file": ".github/workflows/release.yml",
    "old": "          npm install @synapsium-labs/docserver@$VERSION --ignore-scripts\n",
    "new": "          npm install @synapsium-labs/docserver@$VERSION\n",
    "tests": "test/release-workflow.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/release-workflow.test.ts",
    "rc": 1,
    "threads": 1563,
    "red": "1 failed | 67 passed (68)",
    "failing": [
      "release.yml: post-verify (L3.W9) L3.W9: post-verify runs the README's five verification commands, verbatim, in a scratch directory, with the released version"
    ],
    "assertions": [
      "AssertionError: expected [ …(5) ] to deeply equal [ …(5) ]"
    ],
    "restore": "sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal"
  },
  {
    "id": "L3.W9c",
    "guard": "post-verify compares the integrity",
    "file": ".github/workflows/release.yml",
    "old": "          test \"$(npm view @synapsium-labs/docserver@$VERSION dist.integrity)\"",
    "new": "          echo \"$(npm view @synapsium-labs/docserver@$VERSION dist.integrity)\"",
    "tests": "test/release-workflow.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/release-workflow.test.ts",
    "rc": 1,
    "threads": 1579,
    "red": "1 failed | 67 passed (68)",
    "failing": [
      "release.yml: post-verify (L3.W9) L3.W9: post-verify runs the README's five verification commands, verbatim, in a scratch directory, with the released version"
    ],
    "assertions": [
      "AssertionError: expected [ …(5) ] to deeply equal [ …(5) ]"
    ],
    "restore": "sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal"
  }
]
```

## L3.W10: the signers file and `private` (`test/public-ready.test.ts`)

| Row | Guard | File | Change | Red | Restore |
|---|---|---|---|---|---|
| L3.W10a | no key line while private (a key line planted in the signers file) | `.github/release-signers` | `…ey line once it is not.\n` → `…ey line once it is not.\nrelease-signer ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIFixtureKeyMa…` | `test/public-ready.test.ts`: exit 1, 1 failed \| 23 passed (24). "public-ready: the release files (L3 Task 14) L3.W10: .github/release-signers names the principal and holds no key line while the package is private" | sha256 086e6d94243894d7065a5d05a38b7068c800021fa3d8786c65c9165e567e0164 restored, equal |
| L3.W10b | at least one key line once public (the rule deleted) | `test/public-ready.test.ts` | `  if (!isPrivate && keys.length === 0) out.push('no key line once the package is public');…` → (removed) | `test/public-ready.test.ts`: exit 1, 1 failed \| 23 passed (24). "public-ready: the release files (L3 Task 14) L3.W10: the rule refuses a key line while private, and once public refuses a file with no key line or a foreign principal" | sha256 48c850427f8ca887ac0ccde3cc9b6174227545eddd31b1b63fd9f2b4f4d7c012 restored, equal |
| L3.W10c | no key line while private (the rule deleted) | `test/public-ready.test.ts` | `  if (isPrivate && keys.length > 0) out.push('a key line while the package is private');\n` → (removed) | `test/public-ready.test.ts`: exit 1, 1 failed \| 23 passed (24). "public-ready: the release files (L3 Task 14) L3.W10: the rule refuses a key line while private, and once public refuses a file with no key line or a foreign principal" | sha256 48c850427f8ca887ac0ccde3cc9b6174227545eddd31b1b63fd9f2b4f4d7c012 restored, equal |
| L3.W10d | every key line names release-signer (the rule deleted) | `test/public-ready.test.ts` | `  for (const k of keys) if (!KEY_LINE.test(k)) out.push('not a release-signer key line: li…` → (removed) | `test/public-ready.test.ts`: exit 1, 1 failed \| 23 passed (24). "public-ready: the release files (L3 Task 14) L3.W10: the rule refuses a key line while private, and once public refuses a file with no key line or a foreign principal" | sha256 48c850427f8ca887ac0ccde3cc9b6174227545eddd31b1b63fd9f2b4f4d7c012 restored, equal |

```json
[
  {
    "id": "L3.W10a",
    "guard": "no key line while private (a key line planted in the signers file)",
    "file": ".github/release-signers",
    "old": "# release-signer key line once it is not.\n",
    "new": "# release-signer key line once it is not.\nrelease-signer ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIFixtureKeyMaterialOnlyForTests0000000000 fixture\n",
    "tests": "test/public-ready.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/public-ready.test.ts",
    "rc": 1,
    "threads": 1515,
    "red": "1 failed | 23 passed (24)",
    "failing": [
      "public-ready: the release files (L3 Task 14) L3.W10: .github/release-signers names the principal and holds no key line while the package is private"
    ],
    "assertions": [
      "AssertionError: expected [ Array(1) ] to deeply equal []"
    ],
    "restore": "sha256 086e6d94243894d7065a5d05a38b7068c800021fa3d8786c65c9165e567e0164 restored, equal"
  },
  {
    "id": "L3.W10b",
    "guard": "at least one key line once public (the rule deleted)",
    "file": "test/public-ready.test.ts",
    "old": "  if (!isPrivate && keys.length === 0) out.push('no key line once the package is public');\n",
    "new": "(removed)",
    "tests": "test/public-ready.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/public-ready.test.ts",
    "rc": 1,
    "threads": 1506,
    "red": "1 failed | 23 passed (24)",
    "failing": [
      "public-ready: the release files (L3 Task 14) L3.W10: the rule refuses a key line while private, and once public refuses a file with no key line or a foreign principal"
    ],
    "assertions": [
      "AssertionError: expected [] to deeply equal [ Array(1) ]"
    ],
    "restore": "sha256 48c850427f8ca887ac0ccde3cc9b6174227545eddd31b1b63fd9f2b4f4d7c012 restored, equal"
  },
  {
    "id": "L3.W10c",
    "guard": "no key line while private (the rule deleted)",
    "file": "test/public-ready.test.ts",
    "old": "  if (isPrivate && keys.length > 0) out.push('a key line while the package is private');\n",
    "new": "(removed)",
    "tests": "test/public-ready.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/public-ready.test.ts",
    "rc": 1,
    "threads": 1498,
    "red": "1 failed | 23 passed (24)",
    "failing": [
      "public-ready: the release files (L3 Task 14) L3.W10: the rule refuses a key line while private, and once public refuses a file with no key line or a foreign principal"
    ],
    "assertions": [
      "AssertionError: expected [] to deeply equal [ Array(1) ]"
    ],
    "restore": "sha256 48c850427f8ca887ac0ccde3cc9b6174227545eddd31b1b63fd9f2b4f4d7c012 restored, equal"
  },
  {
    "id": "L3.W10d",
    "guard": "every key line names release-signer (the rule deleted)",
    "file": "test/public-ready.test.ts",
    "old": "  for (const k of keys) if (!KEY_LINE.test(k)) out.push(`not a release-signer key line: line ${String(lines.indexOf(k) + 1)}`);\n",
    "new": "(removed)",
    "tests": "test/public-ready.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/public-ready.test.ts",
    "rc": 1,
    "threads": 1475,
    "red": "1 failed | 23 passed (24)",
    "failing": [
      "public-ready: the release files (L3 Task 14) L3.W10: the rule refuses a key line while private, and once public refuses a file with no key line or a foreign principal"
    ],
    "assertions": [
      "AssertionError: expected [] to deeply equal [ Array(1) ]"
    ],
    "restore": "sha256 48c850427f8ca887ac0ccde3cc9b6174227545eddd31b1b63fd9f2b4f4d7c012 restored, equal"
  }
]
```

## L3.W11: dispatch mode: the tag-push conditions

| Row | Guard | File | Change | Red | Restore |
|---|---|---|---|---|---|
| L3.W11a | attest's tag-push condition | `.github/workflows/release.yml` | `…ds: [verify-tag, build]\n    if: github.event_name == 'push' && startsWith(github.ref, 'r…` → `…ds: [verify-tag, build]\n` | `test/release-workflow.test.ts`: exit 1, 1 failed \| 67 passed (68). "release.yml: one tarball, attested and published (L3.W4, L3.W5, L3.W6, L3.W11) L3.W11: attest, publish, github-release and post-verify each run only on a pushed tag; verify-tag, test and build run on a dispatch too" | sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal |
| L3.W11b | publish's tag-push condition | `.github/workflows/release.yml` | `…ify-tag, build, attest]\n    if: github.event_name == 'push' && startsWith(github.ref, 'r…` → `…ify-tag, build, attest]\n` | `test/release-workflow.test.ts`: exit 1, 1 failed \| 67 passed (68). "release.yml: one tarball, attested and published (L3.W4, L3.W5, L3.W6, L3.W11) L3.W11: attest, publish, github-release and post-verify each run only on a pushed tag; verify-tag, test and build run on a dispatch too" | sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal |
| L3.W11c | github-release's tag-push condition | `.github/workflows/release.yml` | `…build, attest, publish]\n    if: github.event_name == 'push' && startsWith(github.ref, 'r…` → `…build, attest, publish]\n` | `test/release-workflow.test.ts`: exit 1, 1 failed \| 67 passed (68). "release.yml: one tarball, attested and published (L3.W4, L3.W5, L3.W6, L3.W11) L3.W11: attest, publish, github-release and post-verify each run only on a pushed tag; verify-tag, test and build run on a dispatch too" | sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal |
| L3.W11d | post-verify's tag-push condition | `.github/workflows/release.yml` | `…fy-tag, github-release]\n    if: github.event_name == 'push' && startsWith(github.ref, 'r…` → `…fy-tag, github-release]\n` | `test/release-workflow.test.ts`: exit 1, 1 failed \| 67 passed (68). "release.yml: one tarball, attested and published (L3.W4, L3.W5, L3.W6, L3.W11) L3.W11: attest, publish, github-release and post-verify each run only on a pushed tag; verify-tag, test and build run on a dispatch too" | sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal |
| L3.W11e | a tag-only check's condition (check 5) | `.github/workflows/release.yml` | `…age.json is not private\n        if: github.event_name == 'push' && startsWith(github.ref…` → `…age.json is not private\n` | `test/release-workflow.test.ts`: exit 1, 1 failed \| 67 passed (68). "release.yml: verify-tag (L3.W7, L3.W11) L3.W11: the tag step and the six tag-only checks run only on a pushed tag; the two tag-free checks run on a dispatch too" | sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal |
| L3.W11f | a tag-free check runs on a dispatch (gains the tag condition) | `.github/workflows/release.yml` | `…als main's copy\n        …` → `…als main's copy\n        if: github.event_name == 'push' && startsWith(github.ref, 'refs/…` | `test/release-workflow.test.ts`: exit 1, 1 failed \| 67 passed (68). "release.yml: verify-tag (L3.W7, L3.W11) L3.W11: the tag step and the six tag-only checks run only on a pushed tag; the two tag-free checks run on a dispatch too" | sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal |
| L3.W11g | the dispatch trigger | `.github/workflows/release.yml` | `…0-9]+.[0-9]+-rc.[0-9]+'\n  workflow_dispatch:\n` → `…0-9]+.[0-9]+-rc.[0-9]+'\n` | `test/release-workflow.test.ts`: exit 1, 1 failed \| 67 passed (68). "release.yml: triggers and the job graph runs on a pushed release tag (vX.Y.Z or vX.Y.Z-rc.N) and by hand as a dry run, and on nothing else" | sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal |

```json
[
  {
    "id": "L3.W11a",
    "guard": "attest's tag-push condition",
    "file": ".github/workflows/release.yml",
    "old": "  attest:\n    needs: [verify-tag, build]\n    if: github.event_name == 'push' && startsWith(github.ref, 'refs/tags/v')\n",
    "new": "  attest:\n    needs: [verify-tag, build]\n",
    "tests": "test/release-workflow.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/release-workflow.test.ts",
    "rc": 1,
    "threads": 1583,
    "red": "1 failed | 67 passed (68)",
    "failing": [
      "release.yml: one tarball, attested and published (L3.W4, L3.W5, L3.W6, L3.W11) L3.W11: attest, publish, github-release and post-verify each run only on a pushed tag; verify-tag, test and build run on a dispatch too"
    ],
    "assertions": [
      "AssertionError: expected [ 'attest', undefined ] to deeply equal [ 'attest', …(1) ]"
    ],
    "restore": "sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal"
  },
  {
    "id": "L3.W11b",
    "guard": "publish's tag-push condition",
    "file": ".github/workflows/release.yml",
    "old": "  publish:\n    needs: [verify-tag, build, attest]\n    if: github.event_name == 'push' && startsWith(github.ref, 'refs/tags/v')\n",
    "new": "  publish:\n    needs: [verify-tag, build, attest]\n",
    "tests": "test/release-workflow.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/release-workflow.test.ts",
    "rc": 1,
    "threads": 1570,
    "red": "1 failed | 67 passed (68)",
    "failing": [
      "release.yml: one tarball, attested and published (L3.W4, L3.W5, L3.W6, L3.W11) L3.W11: attest, publish, github-release and post-verify each run only on a pushed tag; verify-tag, test and build run on a dispatch too"
    ],
    "assertions": [
      "AssertionError: expected [ 'publish', undefined ] to deeply equal [ 'publish', …(1) ]"
    ],
    "restore": "sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal"
  },
  {
    "id": "L3.W11c",
    "guard": "github-release's tag-push condition",
    "file": ".github/workflows/release.yml",
    "old": "  github-release:\n    needs: [verify-tag, build, attest, publish]\n    if: github.event_name == 'push' && startsWith(github.ref, 'refs/tags/v')\n",
    "new": "  github-release:\n    needs: [verify-tag, build, attest, publish]\n",
    "tests": "test/release-workflow.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/release-workflow.test.ts",
    "rc": 1,
    "threads": 1586,
    "red": "1 failed | 67 passed (68)",
    "failing": [
      "release.yml: one tarball, attested and published (L3.W4, L3.W5, L3.W6, L3.W11) L3.W11: attest, publish, github-release and post-verify each run only on a pushed tag; verify-tag, test and build run on a dispatch too"
    ],
    "assertions": [
      "AssertionError: expected [ 'github-release', undefined ] to deeply equal [ 'github-release', …(1) ]"
    ],
    "restore": "sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal"
  },
  {
    "id": "L3.W11d",
    "guard": "post-verify's tag-push condition",
    "file": ".github/workflows/release.yml",
    "old": "  post-verify:\n    needs: [verify-tag, github-release]\n    if: github.event_name == 'push' && startsWith(github.ref, 'refs/tags/v')\n",
    "new": "  post-verify:\n    needs: [verify-tag, github-release]\n",
    "tests": "test/release-workflow.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/release-workflow.test.ts",
    "rc": 1,
    "threads": 1595,
    "red": "1 failed | 67 passed (68)",
    "failing": [
      "release.yml: one tarball, attested and published (L3.W4, L3.W5, L3.W6, L3.W11) L3.W11: attest, publish, github-release and post-verify each run only on a pushed tag; verify-tag, test and build run on a dispatch too"
    ],
    "assertions": [
      "AssertionError: expected [ 'post-verify', undefined ] to deeply equal [ 'post-verify', …(1) ]"
    ],
    "restore": "sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal"
  },
  {
    "id": "L3.W11e",
    "guard": "a tag-only check's condition (check 5)",
    "file": ".github/workflows/release.yml",
    "old": "      - name: 5. package.json is not private\n        if: github.event_name == 'push' && startsWith(github.ref, 'refs/tags/v')\n",
    "new": "      - name: 5. package.json is not private\n",
    "tests": "test/release-workflow.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/release-workflow.test.ts",
    "rc": 1,
    "threads": 1594,
    "red": "1 failed | 67 passed (68)",
    "failing": [
      "release.yml: verify-tag (L3.W7, L3.W11) L3.W11: the tag step and the six tag-only checks run only on a pushed tag; the two tag-free checks run on a dispatch too"
    ],
    "assertions": [
      "AssertionError: expected [ …(2) ] to deeply equal [ …(2) ]"
    ],
    "restore": "sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal"
  },
  {
    "id": "L3.W11f",
    "guard": "a tag-free check runs on a dispatch (gains the tag condition)",
    "file": ".github/workflows/release.yml",
    "old": "      - name: .github/release-signers equals main's copy\n        run: |",
    "new": "      - name: .github/release-signers equals main's copy\n        if: github.event_name == 'push' && startsWith(github.ref, 'refs/tags/v')\n        run: |",
    "tests": "test/release-workflow.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/release-workflow.test.ts",
    "rc": 1,
    "threads": 1577,
    "red": "1 failed | 67 passed (68)",
    "failing": [
      "release.yml: verify-tag (L3.W7, L3.W11) L3.W11: the tag step and the six tag-only checks run only on a pushed tag; the two tag-free checks run on a dispatch too"
    ],
    "assertions": [
      "AssertionError: expected [ …(2) ] to deeply equal [ …(2) ]"
    ],
    "restore": "sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal"
  },
  {
    "id": "L3.W11g",
    "guard": "the dispatch trigger",
    "file": ".github/workflows/release.yml",
    "old": "      - 'v[0-9]+.[0-9]+.[0-9]+-rc.[0-9]+'\n  workflow_dispatch:\n",
    "new": "      - 'v[0-9]+.[0-9]+.[0-9]+-rc.[0-9]+'\n",
    "tests": "test/release-workflow.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/release-workflow.test.ts",
    "rc": 1,
    "threads": 1606,
    "red": "1 failed | 67 passed (68)",
    "failing": [
      "release.yml: triggers and the job graph runs on a pushed release tag (vX.Y.Z or vX.Y.Z-rc.N) and by hand as a dry run, and on nothing else"
    ],
    "assertions": [
      "AssertionError: expected [ 'push' ] to deeply equal [ 'push', 'workflow_dispatch' ]"
    ],
    "restore": "sha256 5a05e852eddd9593e9a0ea9d66fd33c0620a55e9bcd634f24e528b47415afead restored, equal"
  }
]
```

## L3.CI8: `ci.yml` gains `on: workflow_call`, and a called run gets a concurrency group of its own

| Row | Guard | File | Change | Red | Restore |
|---|---|---|---|---|---|
| L3.CI8a | ci.yml runs when the release workflow calls it | `.github/workflows/ci.yml` | `  workflow_dispatch:\n  workflow_call:\n` → `  workflow_dispatch:\n` | `test/ci-workflow.test.ts`: exit 1, 2 failed \| 59 passed (61). "ci.yml: triggers runs on pushes to main, on pull requests, by hand, and when the release workflow calls it"; "ci.yml: triggers L3 Task 14: a call takes no inputs and no secrets, so the release runs exactly what a push runs" | sha256 77d82bb0be6cd7d31d676c089b97de6eb50f6ec2b4106add58e76a151b35cfe1 restored, equal |
| L3.CI8b | a called run's concurrency group names the calling workflow | `.github/workflows/ci.yml` | `  group: ci-${{ github.workflow }}-${{ github.…` → `  group: ci-${{ github.…` | `test/ci-workflow.test.ts`: exit 1, 1 failed \| 60 passed (61). "ci.yml: triggers L3 Task 14: a called run has a concurrency group of its own, so a release never queues behind, or is cancelled by, main's own CI" | sha256 77d82bb0be6cd7d31d676c089b97de6eb50f6ec2b4106add58e76a151b35cfe1 restored, equal |

```json
[
  {
    "id": "L3.CI8a",
    "guard": "ci.yml runs when the release workflow calls it",
    "file": ".github/workflows/ci.yml",
    "old": "  workflow_dispatch:\n  workflow_call:\n",
    "new": "  workflow_dispatch:\n",
    "tests": "test/ci-workflow.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/ci-workflow.test.ts",
    "rc": 1,
    "threads": 1533,
    "red": "2 failed | 59 passed (61)",
    "failing": [
      "ci.yml: triggers runs on pushes to main, on pull requests, by hand, and when the release workflow calls it",
      "ci.yml: triggers L3 Task 14: a call takes no inputs and no secrets, so the release runs exactly what a push runs"
    ],
    "assertions": [
      "AssertionError: expected [ 'pull_request', 'push', …(1) ] to deeply equal [ 'pull_request', 'push', …(2) ]",
      "AssertionError: expected false to be true // Object.is equality"
    ],
    "restore": "sha256 77d82bb0be6cd7d31d676c089b97de6eb50f6ec2b4106add58e76a151b35cfe1 restored, equal"
  },
  {
    "id": "L3.CI8b",
    "guard": "a called run's concurrency group names the calling workflow",
    "file": ".github/workflows/ci.yml",
    "old": "  group: ci-${{ github.workflow }}-${{ github.ref }}\n",
    "new": "  group: ci-${{ github.ref }}\n",
    "tests": "test/ci-workflow.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/ci-workflow.test.ts",
    "rc": 1,
    "threads": 1660,
    "red": "1 failed | 60 passed (61)",
    "failing": [
      "ci.yml: triggers L3 Task 14: a called run has a concurrency group of its own, so a release never queues behind, or is cancelled by, main's own CI"
    ],
    "assertions": [
      "AssertionError: expected { group: 'ci-${{ github.ref }}', …(1) } to deeply equal { …(2) }"
    ],
    "restore": "sha256 77d82bb0be6cd7d31d676c089b97de6eb50f6ec2b4106add58e76a151b35cfe1 restored, equal"
  }
]
```

## L3.PR: the release files `test/public-ready.test.ts` pins

| Row | Guard | File | Change | Red | Restore |
|---|---|---|---|---|---|
| L3.PR1 | one private pin among the tests (a second pin planted in package.test.ts) | `test/package.test.ts` | `…docserver');\n    expect(…` → `…docserver');\n    expect((pkg as unknown as { private: boolean }).private).toBe(true);\n …` | `test/public-ready.test.ts`: exit 1, 1 failed \| 23 passed (24). "public-ready: the release files (L3 Task 14) this file holds the only pin of package.json's private field among the tests, so Task 15 flips exactly one" | sha256 7cf62db6e9960f873e775fcd0888d4349fcc2ba37c00d08b54271d6559ce579e restored, equal |
| L3.PR2 | the package is still private (private removed from package.json) | `package.json` | `  "private": true,\n` → (removed) | `test/public-ready.test.ts`: exit 1, 2 failed \| 22 passed (24). "public-ready: the release files (L3 Task 14) package.json is still private: Task 15 flips this pin, and only this one, in the v1 release PR"; "public-ready: the release files (L3 Task 14) L3.W10: .github/release-signers names the principal and holds no key line while the package is private" | sha256 afa7099973048777e36e3b8c53b3f8b09402341c9797a1ffab7d6da120daaead restored, equal |
| L3.PR3 | publishConfig provenance | `package.json` | `    "provenance": tru…` → `    "provenance": fals…` | `test/public-ready.test.ts`: exit 1, 1 failed \| 23 passed (24). "public-ready: the release files (L3 Task 14) publishes for the public, with provenance, from exactly this repository (npm compares the provenance to repository.url)" | sha256 afa7099973048777e36e3b8c53b3f8b09402341c9797a1ffab7d6da120daaead restored, equal |
| L3.PR4 | repository.url exact | `package.json` | `…Synapsium-Labs/docserver.git…` → `…Synapsium-Labs/docserver…` | `test/public-ready.test.ts`: exit 1, 1 failed \| 23 passed (24). "public-ready: the release files (L3 Task 14) publishes for the public, with provenance, from exactly this repository (npm compares the provenance to repository.url)" | sha256 afa7099973048777e36e3b8c53b3f8b09402341c9797a1ffab7d6da120daaead restored, equal |
| L3.PR5 | SECURITY.md sends reports to a private advisory | `SECURITY.md` | `open a draft security advisory at <https://github.com/Synapsium-Labs/docserver/security/ad…` → `open an issue at <https://github.com/Synapsium-Labs/docserver/issu…` | `test/public-ready.test.ts`: exit 1, 1 failed \| 23 passed (24). "public-ready: the release files (L3 Task 14) SECURITY.md sends a vulnerability to a private advisory, never a public issue" | sha256 de38907bcbc5ab3791b10bf4db9ca9c2d49cbd76b2c903e4bab3f25cd905333d restored, equal |
| L3.PR6 | CODEOWNERS covers src/host | `.github/CODEOWNERS` | `/src/host/ @Synapsium-Labs/maintainers\n` → (removed) | `test/public-ready.test.ts`: exit 1, 1 failed \| 23 passed (24). "public-ready: the release files (L3 Task 14) .github/CODEOWNERS asks a code owner to review the workflows and signers, the assets, the frame and the host" | sha256 226cae030760fde58f51c7221c8058eb319a80aa3680cb3098b8fc00a81857f6 restored, equal |
| L3.PR7 | the notices heading names both Mermaid files | `THIRD-PARTY-NOTICES` | `…sets/mermaid/mermaid.mjs and assets/mermaid/mermaid.frame.js)\n--------------------------…` → `…sets/mermaid/mermaid.mjs)\n…` | `test/public-ready.test.ts`: exit 1, 1 failed \| 23 passed (24). "public-ready: the release files (L3 Task 14) THIRD-PARTY-NOTICES covers both Mermaid files, under one heading and in the generated section" | sha256 2a853e20ad51e9deadf17acdd048417877fa8de04ca9439b86a0ddf8d7a8231c restored, equal |
| L3.PR8 | the notices list every runtime library (js-yaml deleted) | `THIRD-PARTY-NOTICES` | `================================================================================\njs-yaml …` → (removed) | `test/public-ready.test.ts`: exit 1, 1 failed \| 23 passed (24). "public-ready: the release files (L3 Task 14) THIRD-PARTY-NOTICES lists the four runtime libraries, highlight.js, markdown-it, markdown-it-footnote and js-yaml, each with its version, licence and licence text" | sha256 2a853e20ad51e9deadf17acdd048417877fa8de04ca9439b86a0ddf8d7a8231c restored, equal |
| L3.PR9 | the font licence ships (assets dropped from files) | `package.json` | `    "assets",\n` → (removed) | `test/public-ready.test.ts`: exit 1, 1 failed \| 23 passed (24). "public-ready: the release files (L3 Task 14) ships the font licence: assets/ is in files, and assets.json lists fonts/OFL.txt" | sha256 afa7099973048777e36e3b8c53b3f8b09402341c9797a1ffab7d6da120daaead restored, equal |
| L3.PR10 | one private pin among the tests, at any depth and in any assertion form (a toEqual pin planted in test/browser/) | `test/browser/harness.test.ts` | `// …` → `// expect(pkg.private).toEqual(true);\n// …` | `test/public-ready.test.ts`: exit 1, 1 failed \| 23 passed (24). "public-ready: the release files (L3 Task 14) this file holds the only pin of package.json's private field among the tests, so Task 15 flips exactly one" | sha256 fd9b2ed8f6be83275a7696bb0cce9b2b39d70512d60487eb8d5bdb366c7fec10 restored, equal |
| L3.PR11 | one private pin among the tests, in any assertion form (a toHaveProperty pin planted in package.test.ts) | `test/package.test.ts` | `…server');\n    expect(pkg…` → `…server');\n    expect(pkg).toHaveProperty('private', true);\n    expect(pkg…` | `test/public-ready.test.ts`: exit 1, 1 failed \| 23 passed (24). "public-ready: the release files (L3 Task 14) this file holds the only pin of package.json's private field among the tests, so Task 15 flips exactly one" | sha256 7cf62db6e9960f873e775fcd0888d4349fcc2ba37c00d08b54271d6559ce579e restored, equal |

```json
[
  {
    "id": "L3.PR1",
    "guard": "one private pin among the tests (a second pin planted in package.test.ts)",
    "file": "test/package.test.ts",
    "old": "    expect(pkg.name).toBe('@synapsium-labs/docserver');\n    expect(pkg.type).toBe('module');",
    "new": "    expect(pkg.name).toBe('@synapsium-labs/docserver');\n    expect((pkg as unknown as { private: boolean }).private).toBe(true);\n    expect(pkg.type).toBe('module');",
    "tests": "test/public-ready.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/public-ready.test.ts",
    "rc": 1,
    "threads": 1504,
    "red": "1 failed | 23 passed (24)",
    "failing": [
      "public-ready: the release files (L3 Task 14) this file holds the only pin of package.json's private field among the tests, so Task 15 flips exactly one"
    ],
    "assertions": [
      "AssertionError: expected [ 'test/package.test.ts', …(1) ] to deeply equal [ 'test/public-ready.test.ts' ]"
    ],
    "restore": "sha256 7cf62db6e9960f873e775fcd0888d4349fcc2ba37c00d08b54271d6559ce579e restored, equal"
  },
  {
    "id": "L3.PR2",
    "guard": "the package is still private (private removed from package.json)",
    "file": "package.json",
    "old": "  \"private\": true,\n",
    "new": "(removed)",
    "tests": "test/public-ready.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/public-ready.test.ts",
    "rc": 1,
    "threads": 1481,
    "red": "2 failed | 22 passed (24)",
    "failing": [
      "public-ready: the release files (L3 Task 14) package.json is still private: Task 15 flips this pin, and only this one, in the v1 release PR",
      "public-ready: the release files (L3 Task 14) L3.W10: .github/release-signers names the principal and holds no key line while the package is private"
    ],
    "assertions": [
      "AssertionError: expected undefined to be true // Object.is equality",
      "AssertionError: expected [ Array(1) ] to deeply equal []"
    ],
    "restore": "sha256 afa7099973048777e36e3b8c53b3f8b09402341c9797a1ffab7d6da120daaead restored, equal"
  },
  {
    "id": "L3.PR3",
    "guard": "publishConfig provenance",
    "file": "package.json",
    "old": "    \"provenance\": true\n",
    "new": "    \"provenance\": false\n",
    "tests": "test/public-ready.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/public-ready.test.ts",
    "rc": 1,
    "threads": 1487,
    "red": "1 failed | 23 passed (24)",
    "failing": [
      "public-ready: the release files (L3 Task 14) publishes for the public, with provenance, from exactly this repository (npm compares the provenance to repository.url)"
    ],
    "assertions": [
      "AssertionError: expected { access: 'public', provenance: false } to deeply equal { access: 'public', provenance: true }"
    ],
    "restore": "sha256 afa7099973048777e36e3b8c53b3f8b09402341c9797a1ffab7d6da120daaead restored, equal"
  },
  {
    "id": "L3.PR4",
    "guard": "repository.url exact",
    "file": "package.json",
    "old": "\"url\": \"git+https://github.com/Synapsium-Labs/docserver.git\"",
    "new": "\"url\": \"git+https://github.com/Synapsium-Labs/docserver\"",
    "tests": "test/public-ready.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/public-ready.test.ts",
    "rc": 1,
    "threads": 1457,
    "red": "1 failed | 23 passed (24)",
    "failing": [
      "public-ready: the release files (L3 Task 14) publishes for the public, with provenance, from exactly this repository (npm compares the provenance to repository.url)"
    ],
    "assertions": [
      "AssertionError: expected { type: 'git', …(1) } to deeply equal { type: 'git', …(1) }"
    ],
    "restore": "sha256 afa7099973048777e36e3b8c53b3f8b09402341c9797a1ffab7d6da120daaead restored, equal"
  },
  {
    "id": "L3.PR5",
    "guard": "SECURITY.md sends reports to a private advisory",
    "file": "SECURITY.md",
    "old": "open a draft security advisory at <https://github.com/Synapsium-Labs/docserver/security/advisories/new>",
    "new": "open an issue at <https://github.com/Synapsium-Labs/docserver/issues/new>",
    "tests": "test/public-ready.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/public-ready.test.ts",
    "rc": 1,
    "threads": 1446,
    "red": "1 failed | 23 passed (24)",
    "failing": [
      "public-ready: the release files (L3 Task 14) SECURITY.md sends a vulnerability to a private advisory, never a public issue"
    ],
    "assertions": [
      "AssertionError: expected '# Security\\n\\n`@synapsium-labs/docser…' to contain 'https://github.com/Synapsium-Labs/doc…'"
    ],
    "restore": "sha256 de38907bcbc5ab3791b10bf4db9ca9c2d49cbd76b2c903e4bab3f25cd905333d restored, equal"
  },
  {
    "id": "L3.PR6",
    "guard": "CODEOWNERS covers src/host",
    "file": ".github/CODEOWNERS",
    "old": "/src/host/ @Synapsium-Labs/maintainers\n",
    "new": "(removed)",
    "tests": "test/public-ready.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/public-ready.test.ts",
    "rc": 1,
    "threads": 1460,
    "red": "1 failed | 23 passed (24)",
    "failing": [
      "public-ready: the release files (L3 Task 14) .github/CODEOWNERS asks a code owner to review the workflows and signers, the assets, the frame and the host"
    ],
    "assertions": [
      "AssertionError: expected [ '/.github/', '/assets/', …(1) ] to deeply equal [ '/.github/', '/assets/', …(2) ]"
    ],
    "restore": "sha256 226cae030760fde58f51c7221c8058eb319a80aa3680cb3098b8fc00a81857f6 restored, equal"
  },
  {
    "id": "L3.PR7",
    "guard": "the notices heading names both Mermaid files",
    "file": "THIRD-PARTY-NOTICES",
    "old": "Mermaid (assets/mermaid/mermaid.mjs and assets/mermaid/mermaid.frame.js)\n------------------------------------------------------------------------\n",
    "new": "Mermaid (assets/mermaid/mermaid.mjs)\n------------------------------------\n",
    "tests": "test/public-ready.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/public-ready.test.ts",
    "rc": 1,
    "threads": 1470,
    "red": "1 failed | 23 passed (24)",
    "failing": [
      "public-ready: the release files (L3 Task 14) THIRD-PARTY-NOTICES covers both Mermaid files, under one heading and in the generated section"
    ],
    "assertions": [
      "AssertionError: expected 'Third-party files shipped with @synap…' to contain '\\nMermaid (assets/mermaid/mermaid.mjs…'"
    ],
    "restore": "sha256 2a853e20ad51e9deadf17acdd048417877fa8de04ca9439b86a0ddf8d7a8231c restored, equal"
  },
  {
    "id": "L3.PR8",
    "guard": "the notices list every runtime library (js-yaml deleted)",
    "file": "THIRD-PARTY-NOTICES",
    "old": "================================================================================\njs-yaml 4.3.2 (MIT)\n--------------------------------------------------------------------------------\nLICENSE:\n\n(The MIT License)\n\nCopyright (C) 2011-2015 by Vitaly Puzrin\n\nPermission is hereby granted, free of charge, to any person obtaining a copy\nof this software and associated documentation files (the \"Software\"), to deal\nin the Software without restriction, including without limitation the rights\nto use, copy, modify, merge, publish, distribute, sublicense, and/or sell\ncopies of the Software, and to permit persons to whom the Software is\nfurnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in\nall copies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\nIMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\nFITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE\nAUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\nLIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,\nOUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN\nTHE SOFTWARE.\n\n",
    "new": "(removed)",
    "tests": "test/public-ready.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/public-ready.test.ts",
    "rc": 1,
    "threads": 1477,
    "red": "1 failed | 23 passed (24)",
    "failing": [
      "public-ready: the release files (L3 Task 14) THIRD-PARTY-NOTICES lists the four runtime libraries, highlight.js, markdown-it, markdown-it-footnote and js-yaml, each with its version, licence and licence text"
    ],
    "assertions": [
      "AssertionError: expected '[generated by scripts/build-mermaid.m…' to be '[generated by scripts/build-mermaid.m…' // Object.is equality"
    ],
    "restore": "sha256 2a853e20ad51e9deadf17acdd048417877fa8de04ca9439b86a0ddf8d7a8231c restored, equal"
  },
  {
    "id": "L3.PR9",
    "guard": "the font licence ships (assets dropped from files)",
    "file": "package.json",
    "old": "    \"assets\",\n",
    "new": "(removed)",
    "tests": "test/public-ready.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/public-ready.test.ts",
    "rc": 1,
    "threads": 1488,
    "red": "1 failed | 23 passed (24)",
    "failing": [
      "public-ready: the release files (L3 Task 14) ships the font licence: assets/ is in files, and assets.json lists fonts/OFL.txt"
    ],
    "assertions": [
      "AssertionError: expected [ 'dist', 'THIRD-PARTY-NOTICES', …(9) ] to include 'assets'"
    ],
    "restore": "sha256 afa7099973048777e36e3b8c53b3f8b09402341c9797a1ffab7d6da120daaead restored, equal"
  },
  {
    "id": "L3.PR10",
    "guard": "one private pin among the tests, at any depth and in any assertion form (a toEqual pin planted in test/browser/)",
    "file": "test/browser/harness.test.ts",
    "old": "// The real-browser harness (test/browser/harness.ts; docserver L2, Task 6). Pinned: ",
    "new": "// expect(pkg.private).toEqual(true);\n// The real-browser harness (test/browser/harness.ts; docserver L2, Task 6). Pinned: ",
    "tests": "test/public-ready.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/public-ready.test.ts",
    "rc": 1,
    "threads": 1658,
    "red": "1 failed | 23 passed (24)",
    "failing": [
      "public-ready: the release files (L3 Task 14) this file holds the only pin of package.json's private field among the tests, so Task 15 flips exactly one"
    ],
    "assertions": [
      "AssertionError: expected [ Array(2) ] to deeply equal [ 'test/public-ready.test.ts' ]"
    ],
    "restore": "sha256 fd9b2ed8f6be83275a7696bb0cce9b2b39d70512d60487eb8d5bdb366c7fec10 restored, equal"
  },
  {
    "id": "L3.PR11",
    "guard": "one private pin among the tests, in any assertion form (a toHaveProperty pin planted in package.test.ts)",
    "file": "test/package.test.ts",
    "old": "    expect(pkg.name).toBe('@synapsium-labs/docserver');\n    expect(pkg.type).toBe('module');",
    "new": "    expect(pkg.name).toBe('@synapsium-labs/docserver');\n    expect(pkg).toHaveProperty('private', true);\n    expect(pkg.type).toBe('module');",
    "tests": "test/public-ready.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/public-ready.test.ts",
    "rc": 1,
    "threads": 1659,
    "red": "1 failed | 23 passed (24)",
    "failing": [
      "public-ready: the release files (L3 Task 14) this file holds the only pin of package.json's private field among the tests, so Task 15 flips exactly one"
    ],
    "assertions": [
      "AssertionError: expected [ 'test/package.test.ts', …(1) ] to deeply equal [ 'test/public-ready.test.ts' ]"
    ],
    "restore": "sha256 7cf62db6e9960f873e775fcd0888d4349fcc2ba37c00d08b54271d6559ce579e restored, equal"
  }
]
```

## L3.N: THIRD-PARTY-NOTICES: both Mermaid files and the runtime libraries (`scripts/build-mermaid.mjs`)

| Row | Guard | File | Change | Red | Restore |
|---|---|---|---|---|---|
| L3.N1 | the runtime libraries leave out the @types packages | `scripts/build-mermaid.mjs` | `    .filter((name) => !name.startsWith('@types/'))\n` → (removed) | `test/public-ready.test.ts`: exit 1, 1 failed \| 23 passed (24). "public-ready: the release files (L3 Task 14) THIRD-PARTY-NOTICES lists the four runtime libraries, highlight.js, markdown-it, markdown-it-footnote and js-yaml, each with its version, licence and licence text" | sha256 a5c9ea6baf4080cda009a3ef5bf298930555604fd8898245829e01008d7ece09 restored, equal |
| L3.N2 | the notices cover the union of both builds | `scripts/build-mermaid.mjs` | `…or (const m of metafiles…` → `…or (const m of metafiles.slice(0, 1)…` | `test/mermaid-bundle.test.ts`: exit 1, 1 failed \| 28 passed (29). "THIRD-PARTY-NOTICES mergeMetafiles takes the union of the inputs: a package only one build bundles is still listed" | sha256 a5c9ea6baf4080cda009a3ef5bf298930555604fd8898245829e01008d7ece09 restored, equal |
| L3.N3 | the generated section names both Mermaid files | `scripts/build-mermaid.mjs` | `…ets/mermaid/mermaid.mjs and assets/mermaid/mermaid.frame.js are…` → `…ets/mermaid/mermaid.mjs is…` | `test/mermaid-bundle.test.ts`: exit 1, 2 failed \| 27 passed (29). "THIRD-PARTY-NOTICES covers both Mermaid files (L3 Task 14): the section is what the union of both builds' metafiles gives, which is one list, since both bundle one input"; "THIRD-PARTY-NOTICES names every package the metafile names, and only those, exactly as it gives them" | sha256 a5c9ea6baf4080cda009a3ef5bf298930555604fd8898245829e01008d7ece09 restored, equal |
| L3.N4 | --notices writes the runtime libraries section | `scripts/build-mermaid.mjs` | `      const text = withDependencyNoticesSection(withNoticesSection(readFileSync(file, 'utf…` → `      const text = withNoticesSection(readFileSync(file, 'utf8'), noticesSection(packag…` | `test/mermaid-bundle.test.ts`: exit 1, 1 failed \| 28 passed (29). "scripts/build-mermaid.mjs: the command line --notices builds the file and writes both generated sections, the Mermaid files' and the runtime libraries', after the hand-written text" | sha256 a5c9ea6baf4080cda009a3ef5bf298930555604fd8898245829e01008d7ece09 restored, equal |

```json
[
  {
    "id": "L3.N1",
    "guard": "the runtime libraries leave out the @types packages",
    "file": "scripts/build-mermaid.mjs",
    "old": "    .filter((name) => !name.startsWith('@types/'))\n",
    "new": "(removed)",
    "tests": "test/public-ready.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/public-ready.test.ts",
    "rc": 1,
    "threads": 1492,
    "red": "1 failed | 23 passed (24)",
    "failing": [
      "public-ready: the release files (L3 Task 14) THIRD-PARTY-NOTICES lists the four runtime libraries, highlight.js, markdown-it, markdown-it-footnote and js-yaml, each with its version, licence and licence text"
    ],
    "assertions": [
      "AssertionError: expected [ '@types/js-yaml', …(5) ] to deeply equal [ 'highlight.js', 'js-yaml', …(2) ]"
    ],
    "restore": "sha256 a5c9ea6baf4080cda009a3ef5bf298930555604fd8898245829e01008d7ece09 restored, equal"
  },
  {
    "id": "L3.N2",
    "guard": "the notices cover the union of both builds",
    "file": "scripts/build-mermaid.mjs",
    "old": "  for (const m of metafiles) for (const [k, v] of Object.entries(m.inputs))",
    "new": "  for (const m of metafiles.slice(0, 1)) for (const [k, v] of Object.entries(m.inputs))",
    "tests": "test/mermaid-bundle.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/mermaid-bundle.test.ts",
    "rc": 1,
    "threads": 1499,
    "red": "1 failed | 28 passed (29)",
    "failing": [
      "THIRD-PARTY-NOTICES mergeMetafiles takes the union of the inputs: a package only one build bundles is still listed"
    ],
    "assertions": [
      "AssertionError: expected [ 'node_modules/a/x.js' ] to deeply equal [ 'node_modules/a/x.js', …(1) ]"
    ],
    "restore": "sha256 a5c9ea6baf4080cda009a3ef5bf298930555604fd8898245829e01008d7ece09 restored, equal"
  },
  {
    "id": "L3.N3",
    "guard": "the generated section names both Mermaid files",
    "file": "scripts/build-mermaid.mjs",
    "old": "`assets/mermaid/mermaid.mjs and assets/mermaid/mermaid.frame.js are Mermaid${version}, bundled twice`",
    "new": "`assets/mermaid/mermaid.mjs is Mermaid${version}, bundled twice`",
    "tests": "test/mermaid-bundle.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/mermaid-bundle.test.ts",
    "rc": 1,
    "threads": 1488,
    "red": "2 failed | 27 passed (29)",
    "failing": [
      "THIRD-PARTY-NOTICES covers both Mermaid files (L3 Task 14): the section is what the union of both builds' metafiles gives, which is one list, since both bundle one input",
      "THIRD-PARTY-NOTICES names every package the metafile names, and only those, exactly as it gives them"
    ],
    "assertions": [
      "AssertionError: expected '[generated by scripts/build-mermaid.m…' to be '[generated by scripts/build-mermaid.m…' // Object.is equality",
      "AssertionError: expected '[generated by scripts/build-mermaid.m…' to be '[generated by scripts/build-mermaid.m…' // Object.is equality"
    ],
    "restore": "sha256 a5c9ea6baf4080cda009a3ef5bf298930555604fd8898245829e01008d7ece09 restored, equal"
  },
  {
    "id": "L3.N4",
    "guard": "--notices writes the runtime libraries section",
    "file": "scripts/build-mermaid.mjs",
    "old": "      const text = withDependencyNoticesSection(withNoticesSection(readFileSync(file, 'utf8'), noticesSection(packages)), dependencyNoticesSection(libraries));",
    "new": "      const text = withNoticesSection(readFileSync(file, 'utf8'), noticesSection(packages));",
    "tests": "test/mermaid-bundle.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/mermaid-bundle.test.ts",
    "rc": 1,
    "threads": 1484,
    "red": "1 failed | 28 passed (29)",
    "failing": [
      "scripts/build-mermaid.mjs: the command line --notices builds the file and writes both generated sections, the Mermaid files' and the runtime libraries', after the hand-written text"
    ],
    "assertions": [
      "AssertionError: expected 'Hand-written notices.\\n\\nMermaid (ass…' to be 'Hand-written notices.\\n\\nMermaid (ass…' // Object.is equality"
    ],
    "restore": "sha256 a5c9ea6baf4080cda009a3ef5bf298930555604fd8898245829e01008d7ece09 restored, equal"
  },
  {
    "id": "L3.N3-pr",
    "guard": "the generated section names both Mermaid files",
    "file": "scripts/build-mermaid.mjs",
    "old": "`assets/mermaid/mermaid.mjs and assets/mermaid/mermaid.frame.js are Mermaid${version}, bundled twice`",
    "new": "`assets/mermaid/mermaid.mjs is Mermaid${version}, bundled twice`",
    "tests": "test/public-ready.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/public-ready.test.ts",
    "rc": 0,
    "threads": 1501,
    "red": "0 failed | 23 passed (23)",
    "failing": [],
    "assertions": [],
    "restore": "sha256 a5c9ea6baf4080cda009a3ef5bf298930555604fd8898245829e01008d7ece09 restored, equal",
    "note": "green: this file reads the committed notices, not the generator; re-measured as L3.N3 against test/mermaid-bundle.test.ts"
  }
]
```

## L3.HS: the history scan (`scripts/history-scan.mjs`)

| Row | Guard | File | Change | Red | Restore |
|---|---|---|---|---|---|
| L3.HS1 | tag messages are read (plan: skip tag messages) | `scripts/history-scan.mjs` | `      counts.tags += 1;\n      hit('tag ${sha}', bytes.toString('utf8'));\n` → `      counts.tags += 1;\n` | `test/history-scan.test.ts`: exit 1, 1 failed \| 18 passed (19). "history-scan: the history (--all) fetches every branch, every tag and every pull-request head, then finds every planted hit: blob, commit message, tag message, tree entry, ref name, a backup branch, a pull-request head, and a branch and a tag pushed after the clone" | sha256 d5d040a06f7cc30a799537050bc5ef587929c497f3489fb961545c543074e96c restored, equal |
| L3.HS2 | the match is never printed (plan: print the match) | `scripts/history-scan.mjs` | `…tring(f.line)}', shape: f.shape…` → `…tring(f.line)}', shape: '${f.shape} (${f.match})'…` | `test/history-scan.test.ts`: exit 1, 1 failed \| 18 passed (19). "history-scan: the history (--all) fetches every branch, every tag and every pull-request head, then finds every planted hit: blob, commit message, tag message, tree entry, ref name, a backup branch, a pull-request head, and a branch and a tag pushed after the clone" | sha256 d5d040a06f7cc30a799537050bc5ef587929c497f3489fb961545c543074e96c restored, equal |
| L3.HS3 | pull-request heads are fetched (plan: skip the pull-request refspec) | `scripts/history-scan.mjs` | `'+refs/pull/*:refs/remotes/pull/*', ` → (removed) | `test/history-scan.test.ts`: exit 1, 1 failed \| 18 passed (19). "history-scan: the history (--all) fetches every branch, every tag and every pull-request head, then finds every planted hit: blob, commit message, tag message, tree entry, ref name, a backup branch, a pull-request head, and a branch and a tag pushed after the clone" | sha256 d5d040a06f7cc30a799537050bc5ef587929c497f3489fb961545c543074e96c restored, equal |
| L3.HS4 | edit revisions are read (plan: skip edit revisions) | `scripts/history-scan.mjs` | `      diffs.forEach((d, i) => hit('github edit of ${o.label}, revision ${String(i + 1)} of…` → (removed) | `test/history-scan.test.ts`: exit 1, 1 failed \| 18 passed (19). "history-scan: the GitHub texts (--github) reads every pull request (its head and base branch names too), issue, comment, review, review comment, commit comment and release, every page of each, and every edit revision, and finds each planted hit" | sha256 d5d040a06f7cc30a799537050bc5ef587929c497f3489fb961545c543074e96c restored, equal |
| L3.HS5 | release notes are read (plan: skip release notes) | `scripts/history-scan.mjs` | `    hit('github release ${String(r.id)} body', r.body);\n` → (removed) | `test/history-scan.test.ts`: exit 1, 1 failed \| 18 passed (19). "history-scan: the GitHub texts (--github) reads every pull request (its head and base branch names too), issue, comment, review, review comment, commit comment and release, every page of each, and every edit revision, and finds each planted hit" | sha256 d5d040a06f7cc30a799537050bc5ef587929c497f3489fb961545c543074e96c restored, equal |
| L3.HS6 | every page of every list (--paginate) | `scripts/history-scan.mjs` | `…onst pages = gh(['api', '--paginate', …` → `…onst pages = gh(['api', …` | `test/history-scan.test.ts`: exit 1, 2 failed \| 17 passed (19). "history-scan: the GitHub texts (--github) reads every pull request (its head and base branch names too), issue, comment, review, review comment, commit comment and release, every page of each, and every edit revision, and finds each planted hit"; "history-scan: the GitHub texts (--github) asks gh for every page of every list (--paginate), and for the edits of every object that has them" | sha256 d5d040a06f7cc30a799537050bc5ef587929c497f3489fb961545c543074e96c restored, equal |
| L3.HS7 | a failed gh read fails the scan closed | `scripts/history-scan.mjs` | `const pages = gh(['api', '--paginate', 'repos/${repo}/${endpoint}']);` → `let pages;\n    try {\n      pages = gh(['api', '--paginate', 'repos/${repo}/${endpoint}']…` | `test/history-scan.test.ts`: exit 1, 1 failed \| 18 passed (19). "history-scan: the GitHub texts (--github) fails closed (exit 2) when gh fails on any read, never reporting a clean GitHub" | sha256 d5d040a06f7cc30a799537050bc5ef587929c497f3489fb961545c543074e96c restored, equal |
| L3.HS8 | the names file lies outside the repository | `scripts/history-scan.mjs` | `    if (namesPath === top \|\| namesPath.startsWith('${top}${path.sep}')…` → `    if (false…` | `test/history-scan.test.ts`: exit 1, 1 failed \| 18 passed (19). "history-scan: the command line refuses a names file inside the repository it scans, so the list never lands in a commit" | sha256 d5d040a06f7cc30a799537050bc5ef587929c497f3489fb961545c543074e96c restored, equal |
| L3.HS9 | a location that would show a hit is not printed | `scripts/history-scan.mjs` | `…const shown = (text) => (findShapes(text, shapes).length === 0 ? text : null)…` → `…const shown = (text) => text…` | `test/history-scan.test.ts`: exit 1, 2 failed \| 17 passed (19). "history-scan: the history (--all) fetches every branch, every tag and every pull-request head, then finds every planted hit: blob, commit message, tag message, tree entry, ref name, a backup branch, a pull-request head, and a branch and a tag pushed after the clone"; "history-scan: the history (--all) a path or ref that itself holds a hit is never printed as the location" | sha256 d5d040a06f7cc30a799537050bc5ef587929c497f3489fb961545c543074e96c restored, equal |
| L3.HS10 | tree entry names are read | `scripts/history-scan.mjs` | `      treeEntries(bytes).forEach((name, i) => {\n        for (const f of findShapes(name, …` → `      treeEntries(bytes)…` | `test/history-scan.test.ts`: exit 1, 1 failed \| 18 passed (19). "history-scan: the history (--all) fetches every branch, every tag and every pull-request head, then finds every planted hit: blob, commit message, tag message, tree entry, ref name, a backup branch, a pull-request head, and a branch and a tag pushed after the clone" | sha256 d5d040a06f7cc30a799537050bc5ef587929c497f3489fb961545c543074e96c restored, equal |
| L3.HS11 | ref names are read | `scripts/history-scan.mjs` | `    for (const f of findShapes(name, shapes)) hits.push({ where: 'ref ${String(i + 1)} of …` → `    void name…` | `test/history-scan.test.ts`: exit 1, 1 failed \| 18 passed (19). "history-scan: the history (--all) fetches every branch, every tag and every pull-request head, then finds every planted hit: blob, commit message, tag message, tree entry, ref name, a backup branch, a pull-request head, and a branch and a tag pushed after the clone" | sha256 d5d040a06f7cc30a799537050bc5ef587929c497f3489fb961545c543074e96c restored, equal |
| L3.HS12 | every page of an edit history | `scripts/history-scan.mjs` | `      if (conn.pageInfo?.hasNextPage === tru…` → `      if (fals…` | `test/history-scan.test.ts`: exit 1, 2 failed \| 17 passed (19). "history-scan: the GitHub texts (--github) reads every pull request (its head and base branch names too), issue, comment, review, review comment, commit comment and release, every page of each, and every edit revision, and finds each planted hit"; "history-scan: the GitHub texts (--github) asks gh for every page of every list (--paginate), and for the edits of every object that has them" | sha256 d5d040a06f7cc30a799537050bc5ef587929c497f3489fb961545c543074e96c restored, equal |
| L3.HS13 | a failed ls-remote or fetch fails the scan closed | `scripts/history-scan.mjs` | `  if (fetch) {\n    const others = otherRefspecs(String(run('git', ['ls-remote', remote], …` → `  if (fetch) {\n    try {\n      const others = otherRefspecs(String(run('git', ['ls-remot…` | `test/history-scan.test.ts`: exit 1, 1 failed \| 18 passed (19). "history-scan: the history (--all) fails closed (exit 2) when the fetch fails, never reporting a clean history" | sha256 d5d040a06f7cc30a799537050bc5ef587929c497f3489fb961545c543074e96c restored, equal |
| L3.HS14 | every branch is fetched (backup branches) | `scripts/history-scan.mjs` | `  return ['+refs/heads/*:refs/remotes/${remote}/*', ` → `  return [` | `test/history-scan.test.ts`: exit 1, 1 failed \| 18 passed (19). "history-scan: the history (--all) fetches every branch, every tag and every pull-request head, then finds every planted hit: blob, commit message, tag message, tree entry, ref name, a backup branch, a pull-request head, and a branch and a tag pushed after the clone" | sha256 d5d040a06f7cc30a799537050bc5ef587929c497f3489fb961545c543074e96c restored, equal |
| L3.HS15 | issues are read (a pull request listed as an issue is skipped, an issue is not) | `scripts/history-scan.mjs` | `…r((i) => i.pull_request =…` → `…r((i) => i.pull_request !…` | `test/history-scan.test.ts`: exit 1, 2 failed \| 17 passed (19). "history-scan: the GitHub texts (--github) reads every pull request (its head and base branch names too), issue, comment, review, review comment, commit comment and release, every page of each, and every edit revision, and finds each planted hit"; "history-scan: the GitHub texts (--github) asks gh for every page of every list (--paginate), and for the edits of every object that has them" | sha256 d5d040a06f7cc30a799537050bc5ef587929c497f3489fb961545c543074e96c restored, equal |
| L3.HS16 | each pull request's head branch name is read (its page keeps it after the branch is deleted) | `scripts/history-scan.mjs` | `    hit('github pull #${String(p.number)} head branch name', p.head?.ref);\n` → (removed) | `test/history-scan.test.ts`: exit 1, 1 failed \| 18 passed (19). "history-scan: the GitHub texts (--github) reads every pull request (its head and base branch names too), issue, comment, review, review comment, commit comment and release, every page of each, and every edit revision, and finds each planted hit" | sha256 d5d040a06f7cc30a799537050bc5ef587929c497f3489fb961545c543074e96c restored, equal |
| L3.HS17 | every tag is fetched (a tag on a commit no branch holds) | `scripts/history-scan.mjs` | `, '+refs/tags/*:refs/tags/*'…` → (removed) | `test/history-scan.test.ts`: exit 1, 2 failed \| 17 passed (19). "history-scan: the history (--all) fetches every branch, every tag and every pull-request head, then finds every planted hit: blob, commit message, tag message, tree entry, ref name, a backup branch, a pull-request head, and a branch and a tag pushed after the clone"; "history-scan: the history (--all) reports what it read: commits, trees, blobs, tags and refs, and the number of hits" | sha256 d5d040a06f7cc30a799537050bc5ef587929c497f3489fb961545c543074e96c restored, equal |
| L3.HS18 | each pull request's base branch name is read | `scripts/history-scan.mjs` | `    hit('github pull #${String(p.number)} base branch name', p.base?.ref);\n` → (removed) | `test/history-scan.test.ts`: exit 1, 1 failed \| 18 passed (19). "history-scan: the GitHub texts (--github) reads every pull request (its head and base branch names too), issue, comment, review, review comment, commit comment and release, every page of each, and every edit revision, and finds each planted hit" | sha256 d5d040a06f7cc30a799537050bc5ef587929c497f3489fb961545c543074e96c restored, equal |
| L3.HS19 | each pull request's title is read | `scripts/history-scan.mjs` | `    hit('github pull #${String(p.number)} title', p.title);\n` → (removed) | `test/history-scan.test.ts`: exit 1, 1 failed \| 18 passed (19). "history-scan: the GitHub texts (--github) reads every pull request (its head and base branch names too), issue, comment, review, review comment, commit comment and release, every page of each, and every edit revision, and finds each planted hit" | sha256 d5d040a06f7cc30a799537050bc5ef587929c497f3489fb961545c543074e96c restored, equal |
| L3.HS20 | each pull request's body is read | `scripts/history-scan.mjs` | `    hit('github pull #${String(p.number)} body', p.body);\n` → (removed) | `test/history-scan.test.ts`: exit 1, 1 failed \| 18 passed (19). "history-scan: the GitHub texts (--github) reads every pull request (its head and base branch names too), issue, comment, review, review comment, commit comment and release, every page of each, and every edit revision, and finds each planted hit" | sha256 d5d040a06f7cc30a799537050bc5ef587929c497f3489fb961545c543074e96c restored, equal |
| L3.HS21 | each issue's body is read | `scripts/history-scan.mjs` | `    hit('github issue #${String(i.number)} body', i.body);\n` → (removed) | `test/history-scan.test.ts`: exit 1, 1 failed \| 18 passed (19). "history-scan: the GitHub texts (--github) reads every pull request (its head and base branch names too), issue, comment, review, review comment, commit comment and release, every page of each, and every edit revision, and finds each planted hit" | sha256 d5d040a06f7cc30a799537050bc5ef587929c497f3489fb961545c543074e96c restored, equal |
| L3.HS22 | each review's body is read | `scripts/history-scan.mjs` | `      hit('github review ${String(r.id)} body', r.body);\n` → (removed) | `test/history-scan.test.ts`: exit 1, 1 failed \| 18 passed (19). "history-scan: the GitHub texts (--github) reads every pull request (its head and base branch names too), issue, comment, review, review comment, commit comment and release, every page of each, and every edit revision, and finds each planted hit" | sha256 d5d040a06f7cc30a799537050bc5ef587929c497f3489fb961545c543074e96c restored, equal |
| L3.HS23 | each commit comment's body is read | `scripts/history-scan.mjs` | `    hit('github commit-comment ${String(c.id)} body', c.body);\n` → (removed) | `test/history-scan.test.ts`: exit 1, 1 failed \| 18 passed (19). "history-scan: the GitHub texts (--github) reads every pull request (its head and base branch names too), issue, comment, review, review comment, commit comment and release, every page of each, and every edit revision, and finds each planted hit" | sha256 d5d040a06f7cc30a799537050bc5ef587929c497f3489fb961545c543074e96c restored, equal |
| L3.HS24 | each release's name is read | `scripts/history-scan.mjs` | `    hit('github release ${String(r.id)} name', r.name);\n` → (removed) | `test/history-scan.test.ts`: exit 1, 1 failed \| 18 passed (19). "history-scan: the GitHub texts (--github) reads every pull request (its head and base branch names too), issue, comment, review, review comment, commit comment and release, every page of each, and every edit revision, and finds each planted hit" | sha256 d5d040a06f7cc30a799537050bc5ef587929c497f3489fb961545c543074e96c restored, equal |
| L3.HS25 | only a font in assets/fonts is skipped unread (bytes that are not UTF-8 elsewhere are read) | `scripts/history-scan.mjs` | `      if (text === null && FONT_PATH.test(where)…` → `      if (text === null…` | `test/history-scan.test.ts`: exit 1, 2 failed \| 17 passed (19). "history-scan: the history (--all) fetches every branch, every tag and every pull-request head, then finds every planted hit: blob, commit message, tag message, tree entry, ref name, a backup branch, a pull-request head, and a branch and a tag pushed after the clone"; "history-scan: the history (--all) reports what it read: commits, trees, blobs, tags and refs, and the number of hits" | sha256 d5d040a06f7cc30a799537050bc5ef587929c497f3489fb961545c543074e96c restored, equal |
| L3.HS26 | a font in assets/fonts is skipped and counted | `scripts/history-scan.mjs` | `      if (text === null && FONT_PATH.test(where)…` → `      if (false…` | `test/history-scan.test.ts`: exit 1, 1 failed \| 18 passed (19). "history-scan: the history (--all) reports what it read: commits, trees, blobs, tags and refs, and the number of hits" | sha256 d5d040a06f7cc30a799537050bc5ef587929c497f3489fb961545c543074e96c restored, equal |
| L3.HS27 | every advertised ref outside branches, tags and pull requests is fetched | `scripts/history-scan.mjs` | `...fetchRefspecs(remote), ...others…` → `...fetchRefspecs(remote)…` | `test/history-scan.test.ts`: exit 1, 1 failed \| 18 passed (19). "history-scan: the history (--all) fetches every branch, every tag and every pull-request head, then finds every planted hit: blob, commit message, tag message, tree entry, ref name, a backup branch, a pull-request head, and a branch and a tag pushed after the clone" | sha256 d5d040a06f7cc30a799537050bc5ef587929c497f3489fb961545c543074e96c restored, equal |
| L3.HS28 | an ls-remote answer that is not a ref list fails the scan closed | `scripts/history-scan.mjs` | `    if (m === null) throw new ScanError('git ls-remote: an answer that is not a ref list')…` → `    if (m === null) continue…` | `test/history-scan.test.ts`: exit 1, 1 failed \| 18 passed (19). "history-scan: the history (--all) fetches every advertised ref outside branches, tags and pull requests, each to its own name, and refuses an answer it cannot read" | sha256 d5d040a06f7cc30a799537050bc5ef587929c497f3489fb961545c543074e96c restored, equal |
| L3.HS29 | an advertised name outside refs/ fails the scan closed | `scripts/history-scan.mjs` | `    if (!ref.startsWith('refs/')) throw new ScanError('git ls-remote: a ref outside refs/'…` → (removed) | `test/history-scan.test.ts`: exit 1, 1 failed \| 18 passed (19). "history-scan: the history (--all) fetches every advertised ref outside branches, tags and pull requests, each to its own name, and refuses an answer it cannot read" | sha256 d5d040a06f7cc30a799537050bc5ef587929c497f3489fb961545c543074e96c restored, equal |

```json
[
  {
    "id": "L3.HS1",
    "guard": "tag messages are read (plan: skip tag messages)",
    "file": "scripts/history-scan.mjs",
    "old": "      counts.tags += 1;\n      hit(`tag ${sha}`, bytes.toString('utf8'));\n",
    "new": "      counts.tags += 1;\n",
    "tests": "test/history-scan.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/history-scan.test.ts",
    "rc": 1,
    "threads": 1488,
    "red": "1 failed | 18 passed (19)",
    "failing": [
      "history-scan: the history (--all) fetches every branch, every tag and every pull-request head, then finds every planted hit: blob, commit message, tag message, tree entry, ref name, a backup branch, a pull-request head, and a branch and a tag pushed after the clone"
    ],
    "assertions": [
      "AssertionError: expected [ …(13) ] to deeply equal ArrayContaining{…}"
    ],
    "restore": "sha256 d5d040a06f7cc30a799537050bc5ef587929c497f3489fb961545c543074e96c restored, equal"
  },
  {
    "id": "L3.HS2",
    "guard": "the match is never printed (plan: print the match)",
    "file": "scripts/history-scan.mjs",
    "old": "  const hit = (where, text) => {\n    for (const f of findShapes(text, shapes)) hits.push({ where: `${where} line ${String(f.line)}`, shape: f.shape });",
    "new": "  const hit = (where, text) => {\n    for (const f of findShapes(text, shapes)) hits.push({ where: `${where} line ${String(f.line)}`, shape: `${f.shape} (${f.match})` });",
    "tests": "test/history-scan.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/history-scan.test.ts",
    "rc": 1,
    "threads": 1486,
    "red": "1 failed | 18 passed (19)",
    "failing": [
      "history-scan: the history (--all) fetches every branch, every tag and every pull-request head, then finds every planted hit: blob, commit message, tag message, tree entry, ref name, a backup branch, a pull-request head, and a branch and a tag pushed after the clone"
    ],
    "assertions": [
      "AssertionError: expected [ …(15) ] to deeply equal ArrayContaining{…}"
    ],
    "restore": "sha256 d5d040a06f7cc30a799537050bc5ef587929c497f3489fb961545c543074e96c restored, equal"
  },
  {
    "id": "L3.HS3",
    "guard": "pull-request heads are fetched (plan: skip the pull-request refspec)",
    "file": "scripts/history-scan.mjs",
    "old": "'+refs/pull/*:refs/remotes/pull/*', ",
    "new": "(removed)",
    "tests": "test/history-scan.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/history-scan.test.ts",
    "rc": 1,
    "threads": 1489,
    "red": "1 failed | 18 passed (19)",
    "failing": [
      "history-scan: the history (--all) fetches every branch, every tag and every pull-request head, then finds every planted hit: blob, commit message, tag message, tree entry, ref name, a backup branch, a pull-request head, and a branch and a tag pushed after the clone"
    ],
    "assertions": [
      "AssertionError: git rev-parse refs/remotes/pull/1/head: fatal: ambiguous argument 'refs/remotes/pull/1/head': unknown revision or path not in the working tree."
    ],
    "restore": "sha256 d5d040a06f7cc30a799537050bc5ef587929c497f3489fb961545c543074e96c restored, equal"
  },
  {
    "id": "L3.HS4",
    "guard": "edit revisions are read (plan: skip edit revisions)",
    "file": "scripts/history-scan.mjs",
    "old": "      diffs.forEach((d, i) => hit(`github edit of ${o.label}, revision ${String(i + 1)} of ${String(diffs.length)},`, d));\n",
    "new": "(removed)",
    "tests": "test/history-scan.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/history-scan.test.ts",
    "rc": 1,
    "threads": 1474,
    "red": "1 failed | 18 passed (19)",
    "failing": [
      "history-scan: the GitHub texts (--github) reads every pull request (its head and base branch names too), issue, comment, review, review comment, commit comment and release, every page of each, and every edit revision, and finds each planted hit"
    ],
    "assertions": [
      "AssertionError: expected [ …(12) ] to deeply equal [ …(14) ]"
    ],
    "restore": "sha256 d5d040a06f7cc30a799537050bc5ef587929c497f3489fb961545c543074e96c restored, equal"
  },
  {
    "id": "L3.HS5",
    "guard": "release notes are read (plan: skip release notes)",
    "file": "scripts/history-scan.mjs",
    "old": "    hit(`github release ${String(r.id)} body`, r.body);\n",
    "new": "(removed)",
    "tests": "test/history-scan.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/history-scan.test.ts",
    "rc": 1,
    "threads": 1471,
    "red": "1 failed | 18 passed (19)",
    "failing": [
      "history-scan: the GitHub texts (--github) reads every pull request (its head and base branch names too), issue, comment, review, review comment, commit comment and release, every page of each, and every edit revision, and finds each planted hit"
    ],
    "assertions": [
      "AssertionError: expected [ …(13) ] to deeply equal [ …(14) ]"
    ],
    "restore": "sha256 d5d040a06f7cc30a799537050bc5ef587929c497f3489fb961545c543074e96c restored, equal"
  },
  {
    "id": "L3.HS6",
    "guard": "every page of every list (--paginate)",
    "file": "scripts/history-scan.mjs",
    "old": "const pages = gh(['api', '--paginate', `repos/${repo}/${endpoint}`]);",
    "new": "const pages = gh(['api', `repos/${repo}/${endpoint}`]);",
    "tests": "test/history-scan.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/history-scan.test.ts",
    "rc": 1,
    "threads": 1477,
    "red": "2 failed | 17 passed (19)",
    "failing": [
      "history-scan: the GitHub texts (--github) reads every pull request (its head and base branch names too), issue, comment, review, review comment, commit comment and release, every page of each, and every edit revision, and finds each planted hit",
      "history-scan: the GitHub texts (--github) asks gh for every page of every list (--paginate), and for the edits of every object that has them"
    ],
    "assertions": [
      "AssertionError: expected [ …(10) ] to deeply equal [ …(14) ]",
      "AssertionError: expected [ [ 'api', …(1) ], …(7) ] to deeply equal []"
    ],
    "restore": "sha256 d5d040a06f7cc30a799537050bc5ef587929c497f3489fb961545c543074e96c restored, equal"
  },
  {
    "id": "L3.HS7",
    "guard": "a failed gh read fails the scan closed",
    "file": "scripts/history-scan.mjs",
    "old": "const pages = gh(['api', '--paginate', `repos/${repo}/${endpoint}`]);",
    "new": "let pages;\n    try {\n      pages = gh(['api', '--paginate', `repos/${repo}/${endpoint}`]);\n    } catch {\n      return [];\n    }",
    "tests": "test/history-scan.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/history-scan.test.ts",
    "rc": 1,
    "threads": 1500,
    "red": "1 failed | 18 passed (19)",
    "failing": [
      "history-scan: the GitHub texts (--github) fails closed (exit 2) when gh fails on any read, never reporting a clean GitHub"
    ],
    "assertions": [
      "AssertionError: expected 1 to be 2 // Object.is equality"
    ],
    "restore": "sha256 d5d040a06f7cc30a799537050bc5ef587929c497f3489fb961545c543074e96c restored, equal"
  },
  {
    "id": "L3.HS8",
    "guard": "the names file lies outside the repository",
    "file": "scripts/history-scan.mjs",
    "old": "    if (namesPath === top || namesPath.startsWith(`${top}${path.sep}`)) throw new ScanError(",
    "new": "    if (false) throw new ScanError(",
    "tests": "test/history-scan.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/history-scan.test.ts",
    "rc": 1,
    "threads": 1487,
    "red": "1 failed | 18 passed (19)",
    "failing": [
      "history-scan: the command line refuses a names file inside the repository it scans, so the list never lands in a commit"
    ],
    "assertions": [
      "AssertionError: expected 'history-scan: git ls-remote origin ex…' to match /names file .*inside the repository/"
    ],
    "restore": "sha256 d5d040a06f7cc30a799537050bc5ef587929c497f3489fb961545c543074e96c restored, equal"
  },
  {
    "id": "L3.HS9",
    "guard": "a location that would show a hit is not printed",
    "file": "scripts/history-scan.mjs",
    "old": "  const shown = (text) => (findShapes(text, shapes).length === 0 ? text : null);",
    "new": "  const shown = (text) => text;",
    "tests": "test/history-scan.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/history-scan.test.ts",
    "rc": 1,
    "threads": 1507,
    "red": "2 failed | 17 passed (19)",
    "failing": [
      "history-scan: the history (--all) fetches every branch, every tag and every pull-request head, then finds every planted hit: blob, commit message, tag message, tree entry, ref name, a backup branch, a pull-request head, and a branch and a tag pushed after the clone",
      "history-scan: the history (--all) a path or ref that itself holds a hit is never printed as the location"
    ],
    "assertions": [
      "AssertionError: expected [ …(15) ] to deeply equal ArrayContaining{…}",
      "AssertionError: expected [ Array(1) ] to deeply equal []"
    ],
    "restore": "sha256 d5d040a06f7cc30a799537050bc5ef587929c497f3489fb961545c543074e96c restored, equal"
  },
  {
    "id": "L3.HS10",
    "guard": "tree entry names are read",
    "file": "scripts/history-scan.mjs",
    "old": "      treeEntries(bytes).forEach((name, i) => {\n        for (const f of findShapes(name, shapes)) hits.push({ where: `tree ${sha} entry ${String(i + 1)}`, shape: f.shape });\n      });\n",
    "new": "      treeEntries(bytes);\n",
    "tests": "test/history-scan.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/history-scan.test.ts",
    "rc": 1,
    "threads": 1507,
    "red": "1 failed | 18 passed (19)",
    "failing": [
      "history-scan: the history (--all) fetches every branch, every tag and every pull-request head, then finds every planted hit: blob, commit message, tag message, tree entry, ref name, a backup branch, a pull-request head, and a branch and a tag pushed after the clone"
    ],
    "assertions": [
      "AssertionError: expected [ …(13) ] to deeply equal ArrayContaining{…}"
    ],
    "restore": "sha256 d5d040a06f7cc30a799537050bc5ef587929c497f3489fb961545c543074e96c restored, equal"
  },
  {
    "id": "L3.HS11",
    "guard": "ref names are read",
    "file": "scripts/history-scan.mjs",
    "old": "    for (const f of findShapes(name, shapes)) hits.push({ where: `ref ${String(i + 1)} of ${String(refs.length)} (at ${line.slice(0, sp)})`, shape: f.shape });\n",
    "new": "    void name;\n",
    "tests": "test/history-scan.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/history-scan.test.ts",
    "rc": 1,
    "threads": 1503,
    "red": "1 failed | 18 passed (19)",
    "failing": [
      "history-scan: the history (--all) fetches every branch, every tag and every pull-request head, then finds every planted hit: blob, commit message, tag message, tree entry, ref name, a backup branch, a pull-request head, and a branch and a tag pushed after the clone"
    ],
    "assertions": [
      "AssertionError: expected [] to have a length of 1 but got +0"
    ],
    "restore": "sha256 d5d040a06f7cc30a799537050bc5ef587929c497f3489fb961545c543074e96c restored, equal"
  },
  {
    "id": "L3.HS12",
    "guard": "every page of an edit history",
    "file": "scripts/history-scan.mjs",
    "old": "      if (conn.pageInfo?.hasNextPage === true) {",
    "new": "      if (false) {",
    "tests": "test/history-scan.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/history-scan.test.ts",
    "rc": 1,
    "threads": 1507,
    "red": "2 failed | 17 passed (19)",
    "failing": [
      "history-scan: the GitHub texts (--github) reads every pull request (its head and base branch names too), issue, comment, review, review comment, commit comment and release, every page of each, and every edit revision, and finds each planted hit",
      "history-scan: the GitHub texts (--github) asks gh for every page of every list (--paginate), and for the edits of every object that has them"
    ],
    "assertions": [
      "AssertionError: expected [ …(13) ] to deeply equal [ …(14) ]",
      "AssertionError: expected 'history-scan: hit: github pull #1 bod…' to match /^history-scan: read 3 pulls, 1 issue…/m"
    ],
    "restore": "sha256 d5d040a06f7cc30a799537050bc5ef587929c497f3489fb961545c543074e96c restored, equal"
  },
  {
    "id": "L3.HS13",
    "guard": "a failed ls-remote or fetch fails the scan closed",
    "file": "scripts/history-scan.mjs",
    "old": "  if (fetch) {\n    const others = otherRefspecs(String(run('git', ['ls-remote', remote], cwd)));\n    other = others.length;\n    run('git', ['fetch', '--quiet', '--no-write-fetch-head', remote, ...fetchRefspecs(remote), ...others], cwd);\n  }\n",
    "new": "  if (fetch) {\n    try {\n      const others = otherRefspecs(String(run('git', ['ls-remote', remote], cwd)));\n      other = others.length;\n      run('git', ['fetch', '--quiet', '--no-write-fetch-head', remote, ...fetchRefspecs(remote), ...others], cwd);\n    } catch {\n      // ignored\n    }\n  }\n",
    "tests": "test/history-scan.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/history-scan.test.ts",
    "rc": 1,
    "threads": 1499,
    "red": "1 failed | 18 passed (19)",
    "failing": [
      "history-scan: the history (--all) fails closed (exit 2) when the fetch fails, never reporting a clean history"
    ],
    "assertions": [
      "AssertionError: expected +0 to be 2 // Object.is equality"
    ],
    "restore": "sha256 d5d040a06f7cc30a799537050bc5ef587929c497f3489fb961545c543074e96c restored, equal"
  },
  {
    "id": "L3.HS14",
    "guard": "every branch is fetched (backup branches)",
    "file": "scripts/history-scan.mjs",
    "old": "  return [`+refs/heads/*:refs/remotes/${remote}/*`, ",
    "new": "  return [",
    "tests": "test/history-scan.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/history-scan.test.ts",
    "rc": 1,
    "threads": 1500,
    "red": "1 failed | 18 passed (19)",
    "failing": [
      "history-scan: the history (--all) fetches every branch, every tag and every pull-request head, then finds every planted hit: blob, commit message, tag message, tree entry, ref name, a backup branch, a pull-request head, and a branch and a tag pushed after the clone"
    ],
    "assertions": [
      "AssertionError: expected [ …(14) ] to deeply equal ArrayContaining{…}"
    ],
    "restore": "sha256 d5d040a06f7cc30a799537050bc5ef587929c497f3489fb961545c543074e96c restored, equal"
  },
  {
    "id": "L3.HS15",
    "guard": "issues are read (a pull request listed as an issue is skipped, an issue is not)",
    "file": "scripts/history-scan.mjs",
    "old": "const issues = list('issues?state=all&per_page=100').filter((i) => i.pull_request === undefined);",
    "new": "const issues = list('issues?state=all&per_page=100').filter((i) => i.pull_request !== undefined);",
    "tests": "test/history-scan.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/history-scan.test.ts",
    "rc": 1,
    "threads": 1481,
    "red": "2 failed | 17 passed (19)",
    "failing": [
      "history-scan: the GitHub texts (--github) reads every pull request (its head and base branch names too), issue, comment, review, review comment, commit comment and release, every page of each, and every edit revision, and finds each planted hit",
      "history-scan: the GitHub texts (--github) asks gh for every page of every list (--paginate), and for the edits of every object that has them"
    ],
    "assertions": [
      "AssertionError: expected [ …(13) ] to deeply equal [ …(14) ]",
      "AssertionError: expected [ 'CC_41', 'IC_11', 'IC_12', …(7) ] to deeply equal [ 'CC_41', 'IC_11', 'IC_12', …(8) ]"
    ],
    "restore": "sha256 d5d040a06f7cc30a799537050bc5ef587929c497f3489fb961545c543074e96c restored, equal"
  },
  {
    "id": "L3.HS16",
    "guard": "each pull request's head branch name is read (its page keeps it after the branch is deleted)",
    "file": "scripts/history-scan.mjs",
    "old": "    hit(`github pull #${String(p.number)} head branch name`, p.head?.ref);\n",
    "new": "(removed)",
    "tests": "test/history-scan.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/history-scan.test.ts",
    "rc": 1,
    "threads": 1480,
    "red": "1 failed | 18 passed (19)",
    "failing": [
      "history-scan: the GitHub texts (--github) reads every pull request (its head and base branch names too), issue, comment, review, review comment, commit comment and release, every page of each, and every edit revision, and finds each planted hit"
    ],
    "assertions": [
      "AssertionError: expected [ …(13) ] to deeply equal [ …(14) ]"
    ],
    "restore": "sha256 d5d040a06f7cc30a799537050bc5ef587929c497f3489fb961545c543074e96c restored, equal"
  },
  {
    "id": "L3.HS17",
    "guard": "every tag is fetched (a tag on a commit no branch holds)",
    "file": "scripts/history-scan.mjs",
    "old": ", '+refs/tags/*:refs/tags/*'];",
    "new": "];",
    "tests": "test/history-scan.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/history-scan.test.ts",
    "rc": 1,
    "threads": 1472,
    "red": "2 failed | 17 passed (19)",
    "failing": [
      "history-scan: the history (--all) fetches every branch, every tag and every pull-request head, then finds every planted hit: blob, commit message, tag message, tree entry, ref name, a backup branch, a pull-request head, and a branch and a tag pushed after the clone",
      "history-scan: the history (--all) reports what it read: commits, trees, blobs, tags and refs, and the number of hits"
    ],
    "assertions": [
      "AssertionError: expected [ …(14) ] to deeply equal ArrayContaining{…}",
      "AssertionError: expected 'history-scan: read 13 commits, 20 tre…' to match /^history-scan: read \\d+ commits, \\d+ …/"
    ],
    "restore": "sha256 d5d040a06f7cc30a799537050bc5ef587929c497f3489fb961545c543074e96c restored, equal"
  },
  {
    "id": "L3.HS18",
    "guard": "each pull request's base branch name is read",
    "file": "scripts/history-scan.mjs",
    "old": "    hit(`github pull #${String(p.number)} base branch name`, p.base?.ref);\n",
    "new": "(removed)",
    "tests": "test/history-scan.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/history-scan.test.ts",
    "rc": 1,
    "threads": 1476,
    "red": "1 failed | 18 passed (19)",
    "failing": [
      "history-scan: the GitHub texts (--github) reads every pull request (its head and base branch names too), issue, comment, review, review comment, commit comment and release, every page of each, and every edit revision, and finds each planted hit"
    ],
    "assertions": [
      "AssertionError: expected [ …(13) ] to deeply equal [ …(14) ]"
    ],
    "restore": "sha256 d5d040a06f7cc30a799537050bc5ef587929c497f3489fb961545c543074e96c restored, equal"
  },
  {
    "id": "L3.HS19",
    "guard": "each pull request's title is read",
    "file": "scripts/history-scan.mjs",
    "old": "    hit(`github pull #${String(p.number)} title`, p.title);\n",
    "new": "(removed)",
    "tests": "test/history-scan.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/history-scan.test.ts",
    "rc": 1,
    "threads": 1509,
    "red": "1 failed | 18 passed (19)",
    "failing": [
      "history-scan: the GitHub texts (--github) reads every pull request (its head and base branch names too), issue, comment, review, review comment, commit comment and release, every page of each, and every edit revision, and finds each planted hit"
    ],
    "assertions": [
      "AssertionError: expected [ …(13) ] to deeply equal [ …(14) ]"
    ],
    "restore": "sha256 d5d040a06f7cc30a799537050bc5ef587929c497f3489fb961545c543074e96c restored, equal"
  },
  {
    "id": "L3.HS20",
    "guard": "each pull request's body is read",
    "file": "scripts/history-scan.mjs",
    "old": "    hit(`github pull #${String(p.number)} body`, p.body);\n",
    "new": "(removed)",
    "tests": "test/history-scan.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/history-scan.test.ts",
    "rc": 1,
    "threads": 1510,
    "red": "1 failed | 18 passed (19)",
    "failing": [
      "history-scan: the GitHub texts (--github) reads every pull request (its head and base branch names too), issue, comment, review, review comment, commit comment and release, every page of each, and every edit revision, and finds each planted hit"
    ],
    "assertions": [
      "AssertionError: expected [ …(13) ] to deeply equal [ …(14) ]"
    ],
    "restore": "sha256 d5d040a06f7cc30a799537050bc5ef587929c497f3489fb961545c543074e96c restored, equal"
  },
  {
    "id": "L3.HS21",
    "guard": "each issue's body is read",
    "file": "scripts/history-scan.mjs",
    "old": "    hit(`github issue #${String(i.number)} body`, i.body);\n",
    "new": "(removed)",
    "tests": "test/history-scan.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/history-scan.test.ts",
    "rc": 1,
    "threads": 1517,
    "red": "1 failed | 18 passed (19)",
    "failing": [
      "history-scan: the GitHub texts (--github) reads every pull request (its head and base branch names too), issue, comment, review, review comment, commit comment and release, every page of each, and every edit revision, and finds each planted hit"
    ],
    "assertions": [
      "AssertionError: expected [ …(13) ] to deeply equal [ …(14) ]"
    ],
    "restore": "sha256 d5d040a06f7cc30a799537050bc5ef587929c497f3489fb961545c543074e96c restored, equal"
  },
  {
    "id": "L3.HS22",
    "guard": "each review's body is read",
    "file": "scripts/history-scan.mjs",
    "old": "      hit(`github review ${String(r.id)} body`, r.body);\n",
    "new": "(removed)",
    "tests": "test/history-scan.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/history-scan.test.ts",
    "rc": 1,
    "threads": 1523,
    "red": "1 failed | 18 passed (19)",
    "failing": [
      "history-scan: the GitHub texts (--github) reads every pull request (its head and base branch names too), issue, comment, review, review comment, commit comment and release, every page of each, and every edit revision, and finds each planted hit"
    ],
    "assertions": [
      "AssertionError: expected [ …(13) ] to deeply equal [ …(14) ]"
    ],
    "restore": "sha256 d5d040a06f7cc30a799537050bc5ef587929c497f3489fb961545c543074e96c restored, equal"
  },
  {
    "id": "L3.HS23",
    "guard": "each commit comment's body is read",
    "file": "scripts/history-scan.mjs",
    "old": "    hit(`github commit-comment ${String(c.id)} body`, c.body);\n",
    "new": "(removed)",
    "tests": "test/history-scan.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/history-scan.test.ts",
    "rc": 1,
    "threads": 1582,
    "red": "1 failed | 18 passed (19)",
    "failing": [
      "history-scan: the GitHub texts (--github) reads every pull request (its head and base branch names too), issue, comment, review, review comment, commit comment and release, every page of each, and every edit revision, and finds each planted hit"
    ],
    "assertions": [
      "AssertionError: expected [ …(13) ] to deeply equal [ …(14) ]"
    ],
    "restore": "sha256 d5d040a06f7cc30a799537050bc5ef587929c497f3489fb961545c543074e96c restored, equal"
  },
  {
    "id": "L3.HS24",
    "guard": "each release's name is read",
    "file": "scripts/history-scan.mjs",
    "old": "    hit(`github release ${String(r.id)} name`, r.name);\n",
    "new": "(removed)",
    "tests": "test/history-scan.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/history-scan.test.ts",
    "rc": 1,
    "threads": 1538,
    "red": "1 failed | 18 passed (19)",
    "failing": [
      "history-scan: the GitHub texts (--github) reads every pull request (its head and base branch names too), issue, comment, review, review comment, commit comment and release, every page of each, and every edit revision, and finds each planted hit"
    ],
    "assertions": [
      "AssertionError: expected [ …(13) ] to deeply equal [ …(14) ]"
    ],
    "restore": "sha256 d5d040a06f7cc30a799537050bc5ef587929c497f3489fb961545c543074e96c restored, equal"
  },
  {
    "id": "L3.HS25",
    "guard": "only a font in assets/fonts is skipped unread (bytes that are not UTF-8 elsewhere are read)",
    "file": "scripts/history-scan.mjs",
    "old": "      if (text === null && FONT_PATH.test(where)) {\n",
    "new": "      if (text === null) {\n",
    "tests": "test/history-scan.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/history-scan.test.ts",
    "rc": 1,
    "threads": 1533,
    "red": "2 failed | 17 passed (19)",
    "failing": [
      "history-scan: the history (--all) fetches every branch, every tag and every pull-request head, then finds every planted hit: blob, commit message, tag message, tree entry, ref name, a backup branch, a pull-request head, and a branch and a tag pushed after the clone",
      "history-scan: the history (--all) reports what it read: commits, trees, blobs, tags and refs, and the number of hits"
    ],
    "assertions": [
      "AssertionError: expected [ …(14) ] to deeply equal ArrayContaining{…}",
      "AssertionError: expected 'history-scan: hit: ref 7 of 11 (at 0d…' to contain '\\nhistory-scan: skipped 1 binary font…'"
    ],
    "restore": "sha256 d5d040a06f7cc30a799537050bc5ef587929c497f3489fb961545c543074e96c restored, equal"
  },
  {
    "id": "L3.HS26",
    "guard": "a font in assets/fonts is skipped and counted",
    "file": "scripts/history-scan.mjs",
    "old": "      if (text === null && FONT_PATH.test(where)) {\n",
    "new": "      if (false) {\n",
    "tests": "test/history-scan.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/history-scan.test.ts",
    "rc": 1,
    "threads": 1505,
    "red": "1 failed | 18 passed (19)",
    "failing": [
      "history-scan: the history (--all) reports what it read: commits, trees, blobs, tags and refs, and the number of hits"
    ],
    "assertions": [
      "AssertionError: expected 'history-scan: hit: ref 7 of 11 (at 1d…' to contain '\\nhistory-scan: skipped 1 binary font…'"
    ],
    "restore": "sha256 d5d040a06f7cc30a799537050bc5ef587929c497f3489fb961545c543074e96c restored, equal"
  },
  {
    "id": "L3.HS27",
    "guard": "every advertised ref outside branches, tags and pull requests is fetched",
    "file": "scripts/history-scan.mjs",
    "old": "...fetchRefspecs(remote), ...others], cwd);",
    "new": "...fetchRefspecs(remote)], cwd);",
    "tests": "test/history-scan.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/history-scan.test.ts",
    "rc": 1,
    "threads": 1504,
    "red": "1 failed | 18 passed (19)",
    "failing": [
      "history-scan: the history (--all) fetches every branch, every tag and every pull-request head, then finds every planted hit: blob, commit message, tag message, tree entry, ref name, a backup branch, a pull-request head, and a branch and a tag pushed after the clone"
    ],
    "assertions": [
      "AssertionError: expected [ …(13) ] to deeply equal ArrayContaining{…}"
    ],
    "restore": "sha256 d5d040a06f7cc30a799537050bc5ef587929c497f3489fb961545c543074e96c restored, equal"
  },
  {
    "id": "L3.HS28",
    "guard": "an ls-remote answer that is not a ref list fails the scan closed",
    "file": "scripts/history-scan.mjs",
    "old": "    if (m === null) throw new ScanError('git ls-remote: an answer that is not a ref list');\n",
    "new": "    if (m === null) continue;\n",
    "tests": "test/history-scan.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/history-scan.test.ts",
    "rc": 1,
    "threads": 1503,
    "red": "1 failed | 18 passed (19)",
    "failing": [
      "history-scan: the history (--all) fetches every advertised ref outside branches, tags and pull requests, each to its own name, and refuses an answer it cannot read"
    ],
    "assertions": [
      "AssertionError: expected [Function] to throw an error"
    ],
    "restore": "sha256 d5d040a06f7cc30a799537050bc5ef587929c497f3489fb961545c543074e96c restored, equal"
  },
  {
    "id": "L3.HS29",
    "guard": "an advertised name outside refs/ fails the scan closed",
    "file": "scripts/history-scan.mjs",
    "old": "    if (!ref.startsWith('refs/')) throw new ScanError('git ls-remote: a ref outside refs/');\n",
    "new": "(removed)",
    "tests": "test/history-scan.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/history-scan.test.ts",
    "rc": 1,
    "threads": 1513,
    "red": "1 failed | 18 passed (19)",
    "failing": [
      "history-scan: the history (--all) fetches every advertised ref outside branches, tags and pull requests, each to its own name, and refuses an answer it cannot read"
    ],
    "assertions": [
      "AssertionError: expected [Function] to throw an error"
    ],
    "restore": "sha256 d5d040a06f7cc30a799537050bc5ef587929c497f3489fb961545c543074e96c restored, equal"
  }
]
```

## L3.S: the shared shapes and the names list (`scripts/public-shapes.mjs`)

| Row | Guard | File | Change | Red | Restore |
|---|---|---|---|---|---|
| L3.S1 | names match in any case | `scripts/public-shapes.mjs` | `…(?![\\p{L}\\p{N}_])', 'gi…` → `…(?![\\p{L}\\p{N}_])', 'g…` | `test/history-scan.test.ts`: exit 1, 1 failed \| 18 passed (19). "public-shapes: the shapes and the names list finds one planted hit of each shape class, and names in any case standing alone, but not inside a longer word" | sha256 4b1acee5cb6fc72cadbdaa1873bef0e1c696ee0f914b70dd3901e9e5830c0e51 restored, equal |
| L3.S2 | names match standing alone | `scripts/public-shapes.mjs` | `'(?<![\\p{L}\\p{N}_])(?:${escaped.join('\|')})(?![\\p{L}\\p{N}_]…` → `'(?:${escaped.join('\|')}…` | `test/history-scan.test.ts`: exit 1, 1 failed \| 18 passed (19). "public-shapes: the shapes and the names list finds one planted hit of each shape class, and names in any case standing alone, but not inside a longer word" | sha256 4b1acee5cb6fc72cadbdaa1873bef0e1c696ee0f914b70dd3901e9e5830c0e51 restored, equal |
| L3.S3 | an empty names list is refused | `scripts/public-shapes.mjs` | `  if (names.length === 0) throw new Error('public-shapes: the names file lists no name');\…` → (removed) | `test/history-scan.test.ts`: exit 1, 1 failed \| 18 passed (19). "public-shapes: the shapes and the names list reads a names file: one name per line, blank and # lines skipped; an empty list is refused" | sha256 4b1acee5cb6fc72cadbdaa1873bef0e1c696ee0f914b70dd3901e9e5830c0e51 restored, equal |

```json
[
  {
    "id": "L3.S1",
    "guard": "names match in any case",
    "file": "scripts/public-shapes.mjs",
    "old": "`(?<![\\\\p{L}\\\\p{N}_])(?:${escaped.join('|')})(?![\\\\p{L}\\\\p{N}_])`, 'giu'",
    "new": "`(?<![\\\\p{L}\\\\p{N}_])(?:${escaped.join('|')})(?![\\\\p{L}\\\\p{N}_])`, 'gu'",
    "tests": "test/history-scan.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/history-scan.test.ts",
    "rc": 1,
    "threads": 1481,
    "red": "1 failed | 18 passed (19)",
    "failing": [
      "public-shapes: the shapes and the names list finds one planted hit of each shape class, and names in any case standing alone, but not inside a longer word"
    ],
    "assertions": [
      "AssertionError: expected [ [ 1, 'listed name' ] ] to deeply equal [ [ 1, 'listed name' ], …(1) ]"
    ],
    "restore": "sha256 4b1acee5cb6fc72cadbdaa1873bef0e1c696ee0f914b70dd3901e9e5830c0e51 restored, equal"
  },
  {
    "id": "L3.S2",
    "guard": "names match standing alone",
    "file": "scripts/public-shapes.mjs",
    "old": "`(?<![\\\\p{L}\\\\p{N}_])(?:${escaped.join('|')})(?![\\\\p{L}\\\\p{N}_])`, 'giu'",
    "new": "`(?:${escaped.join('|')})`, 'giu'",
    "tests": "test/history-scan.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/history-scan.test.ts",
    "rc": 1,
    "threads": 1474,
    "red": "1 failed | 18 passed (19)",
    "failing": [
      "public-shapes: the shapes and the names list finds one planted hit of each shape class, and names in any case standing alone, but not inside a longer word"
    ],
    "assertions": [
      "AssertionError: expected [ { line: 1, …(2) }, …(2) ] to deeply equal []"
    ],
    "restore": "sha256 4b1acee5cb6fc72cadbdaa1873bef0e1c696ee0f914b70dd3901e9e5830c0e51 restored, equal"
  },
  {
    "id": "L3.S3",
    "guard": "an empty names list is refused",
    "file": "scripts/public-shapes.mjs",
    "old": "  if (names.length === 0) throw new Error('public-shapes: the names file lists no name');\n",
    "new": "(removed)",
    "tests": "test/history-scan.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/history-scan.test.ts",
    "rc": 1,
    "threads": 1475,
    "red": "1 failed | 18 passed (19)",
    "failing": [
      "public-shapes: the shapes and the names list reads a names file: one name per line, blank and # lines skipped; an empty list is refused"
    ],
    "assertions": [
      "AssertionError: expected [Function] to throw an error"
    ],
    "restore": "sha256 4b1acee5cb6fc72cadbdaa1873bef0e1c696ee0f914b70dd3901e9e5830c0e51 restored, equal"
  }
]
```
