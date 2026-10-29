# L3 Task 15: mutation rows (the operator's environment arrangement)

Task 15 adds no guard of its own; the lane's rows are Task 14's (`task-14.md`). This file holds the rows of one change made at Task 15 step 2 on the operator's ruling (ledger C101): the `npm-release` environment's required reviewer is the maintainer who pushes the tag, so self-review is allowed, and verify-tag's check 6 requires instead that administrators cannot bypass the review. Task 14's row L3.W7f (check 6, prevent self-review) guarded the check this change removes; L3.W7t below shows that putting it back fails the operator's environment. With the self-review check gone, the named-reviewer check is the only guard on the answers that name no reviewer, so L3.W7u measures it again. The ids continue after Task 14's last check-row id, L3.W7q.

**Result.** 4 rows, 4 red, each through failing vitest assertions (`AssertionError`); no row counts a setup, type or timeout error, and the file was restored from its saved bytes and its sha256 compared equal after each row. Measured on this change's final code and tests, 2026-10-29, Node 24.22.1.

**Method.** As Task 14's (C69, C75): one row at a time, in place in the library worktree, never in parallel and never in a copy; the file's original bytes and sha256 saved outside the worktree before the first row; one exact replacement (its old text occurring exactly once); `./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/release-workflow.test.ts` under `ulimit -u` (the measured thread count plus 1500) and `timeout -k 10 600`; then the saved bytes written back and compared by sha256, never `git checkout`.

## L3.W7r to L3.W7u: check 6, administrators cannot bypass the review, and a named reviewer

| Row | Guard | File | Change | Red | Restore |
|---|---|---|---|---|---|
| L3.W7r | check 6, administrators cannot bypass (check deleted) | `.github/workflows/release.yml` | `          if (env?.can_admins_bypass !== false) failures.push('administrators can bypass t…` → (removed) | `test/release-workflow.test.ts`: exit 1, 2 failed \| 67 passed (69). "release.yml: verify-tag (L3.W7, L3.W11) 6. the environment check fails closed when administrators can bypass the review"; "release.yml: verify-tag (L3.W7, L3.W11) 6. the environment check fails closed when whether administrators can bypass the review is not stated" | sha256 2079f4c926a7574282948104aef5060cc50f152203be12cd6cb5f8d28d48c9be restored, equal |
| L3.W7s | check 6, an unstated bypass fails closed | `.github/workflows/release.yml` | `env?.can_admins_bypass !== false)` → `env?.can_admins_bypass === true)` | `test/release-workflow.test.ts`: exit 1, 1 failed \| 68 passed (69). "release.yml: verify-tag (L3.W7, L3.W11) 6. the environment check fails closed when whether administrators can bypass the review is not stated" | sha256 2079f4c926a7574282948104aef5060cc50f152203be12cd6cb5f8d28d48c9be restored, equal |
| L3.W7t | check 6 accepts the single-maintainer arrangement (the old self-review check put back) | `.github/workflows/release.yml` | after `          if (env?.can_admins_bypass !== false) failures.pus…`, added `          if (reviewers.length !== 1 \|\| reviewers[0].prevent_self_review !== true) failures.push('self-review …` | `test/release-workflow.test.ts`: exit 1, 1 failed \| 68 passed (69). "release.yml: verify-tag (L3.W7, L3.W11) 6. the environment check reads the environment and its deployment policies with the job's token, and passes on the protected environment" | sha256 2079f4c926a7574282948104aef5060cc50f152203be12cd6cb5f8d28d48c9be restored, equal |
| L3.W7u | check 6, a named reviewer (check deleted; now the only guard on the no-reviewer answers) | `.github/workflows/release.yml` | `          if (reviewers.length !== 1 \|\| !Array.isArray(reviewers[0].reviewers) \|\| reviewer…` → (removed) | `test/release-workflow.test.ts`: exit 1, 3 failed \| 66 passed (69). "release.yml: verify-tag (L3.W7, L3.W11) 6. the environment check fails closed when no required-reviewers rule"; "release.yml: verify-tag (L3.W7, L3.W11) 6. the environment check fails closed when no protection rules at all"; "release.yml: verify-tag (L3.W7, L3.W11) 6. the environment check fails closed when the reviewers list is empty" | sha256 2079f4c926a7574282948104aef5060cc50f152203be12cd6cb5f8d28d48c9be restored, equal |

```json
[
  {
    "id": "L3.W7r",
    "guard": "check 6, administrators cannot bypass (check deleted)",
    "file": ".github/workflows/release.yml",
    "old": "          if (env?.can_admins_bypass !== false) failures.push('administrators can bypass the review');\n",
    "new": "",
    "tests": "test/release-workflow.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/release-workflow.test.ts",
    "rc": 1,
    "threads": 1543,
    "red": "2 failed | 67 passed (69)",
    "failing": [
      "release.yml: verify-tag (L3.W7, L3.W11) 6. the environment check fails closed when administrators can bypass the review",
      "release.yml: verify-tag (L3.W7, L3.W11) 6. the environment check fails closed when whether administrators can bypass the review is not stated"
    ],
    "assertions": [
      "AssertionError: expected +0 not to be +0 // Object.is equality",
      "AssertionError: expected +0 not to be +0 // Object.is equality"
    ],
    "restore": "sha256 2079f4c926a7574282948104aef5060cc50f152203be12cd6cb5f8d28d48c9be restored, equal"
  },
  {
    "id": "L3.W7s",
    "guard": "check 6, an unstated bypass fails closed",
    "file": ".github/workflows/release.yml",
    "old": "env?.can_admins_bypass !== false)",
    "new": "env?.can_admins_bypass === true)",
    "tests": "test/release-workflow.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/release-workflow.test.ts",
    "rc": 1,
    "threads": 1546,
    "red": "1 failed | 68 passed (69)",
    "failing": [
      "release.yml: verify-tag (L3.W7, L3.W11) 6. the environment check fails closed when whether administrators can bypass the review is not stated"
    ],
    "assertions": [
      "AssertionError: expected +0 not to be +0 // Object.is equality"
    ],
    "restore": "sha256 2079f4c926a7574282948104aef5060cc50f152203be12cd6cb5f8d28d48c9be restored, equal"
  },
  {
    "id": "L3.W7t",
    "guard": "check 6 accepts the single-maintainer arrangement (the old self-review check put back)",
    "file": ".github/workflows/release.yml",
    "old": "          if (env?.can_admins_bypass !== false) failures.push('administrators can bypass the review');\n",
    "new": "          if (env?.can_admins_bypass !== false) failures.push('administrators can bypass the review');\n          if (reviewers.length !== 1 || reviewers[0].prevent_self_review !== true) failures.push('self-review is not prevented');\n",
    "tests": "test/release-workflow.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/release-workflow.test.ts",
    "rc": 1,
    "threads": 1530,
    "red": "1 failed | 68 passed (69)",
    "failing": [
      "release.yml: verify-tag (L3.W7, L3.W11) 6. the environment check reads the environment and its deployment policies with the job's token, and passes on the protected environment"
    ],
    "assertions": [
      "AssertionError: ::error::npm-release environment: self-review is not prevented"
    ],
    "restore": "sha256 2079f4c926a7574282948104aef5060cc50f152203be12cd6cb5f8d28d48c9be restored, equal"
  },
  {
    "id": "L3.W7u",
    "guard": "check 6, a named reviewer (check deleted; now the only guard on the no-reviewer answers)",
    "file": ".github/workflows/release.yml",
    "old": "          if (reviewers.length !== 1 || !Array.isArray(reviewers[0].reviewers) || reviewers[0].reviewers.length === 0) failures.push('no required reviewer');\n",
    "new": "",
    "tests": "test/release-workflow.test.ts",
    "command": "./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/release-workflow.test.ts",
    "rc": 1,
    "threads": 1544,
    "red": "3 failed | 66 passed (69)",
    "failing": [
      "release.yml: verify-tag (L3.W7, L3.W11) 6. the environment check fails closed when no required-reviewers rule",
      "release.yml: verify-tag (L3.W7, L3.W11) 6. the environment check fails closed when no protection rules at all",
      "release.yml: verify-tag (L3.W7, L3.W11) 6. the environment check fails closed when the reviewers list is empty"
    ],
    "assertions": [
      "AssertionError: expected +0 not to be +0 // Object.is equality",
      "AssertionError: expected +0 not to be +0 // Object.is equality",
      "AssertionError: expected +0 not to be +0 // Object.is equality"
    ],
    "restore": "sha256 2079f4c926a7574282948104aef5060cc50f152203be12cd6cb5f8d28d48c9be restored, equal"
  }
]
```
