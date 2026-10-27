# L3 Task 3: mutation rows (the seed: schema, serialiser, validator, html cap)

Each guard of Task 3, changed once, with the tests that go red: the seed's escaping, its validator and its caps
(`src/frame/seed.ts`), the ratio measurement (`scripts/measure-seed-ratio.mjs`), the seed `frameDocument` emits at its
defaults and within its own validator's caps (`src/frame/document.ts`), the bootstrap's Mermaid settings
(`src/frame-runtime/bootstrap.ts`) and what the bootstrap bundles. Measured 2026-10-27 (UTC) on branch `l3-t03-seed`
(base `74c6b30`, the Task 3 changes not yet committed), on the final code after the review's fix round: every row was
measured again there, so the counts below are the fix round's.

**Result.** 31 rows: 30 red and one equivalent mutant, L3.M4d. Every red run exits 1, and every failing test failed
through an `AssertionError` (none through a file that failed to load, an unhandled error or a timeout).

**The equivalent mutant (L3.M4d), ruled equivalent under ledger C86 (an unreachable defensive check, kept).** `snapshotOk`'s last check, the snapshot's total
at most `BRIDGE_LIMITS.storeBudgetBytes` (Reference §3's "the total at most 1 MiB"), cannot fail today. Keys must be on
the store allow-list and unique, and the allow-list has 8 keys (`PREF_KEYS` 2 + `DOC_FIELDS` 6), each value at most
`valueMaxBytes` (65,536), so a snapshot totals at most 524,288 bytes against a 1,048,576 budget. Replacing the check with
`return true` leaves the suite green. The check stays, because the Reference states the cap, and the row "the snapshot
total cannot bind today" in `test/frame-seed.test.ts` asserts the arithmetic, so it goes red the day the allow-list
outgrows the budget. Ledger C86 rules such a row an equivalent mutant: recorded with its reason, never counted red.

**The html cap differs from the plan's estimate (ruled by ledger C87: the formula stands).** Reference §3 expects "about
21.1 million" (r about 10.06 on `footnotes.md`). The plan's normative formula (the largest ratio over every golden corpus
document, fixed keys excluded) measures r = 27.3061 on the 49-byte `nesting-limit.md`, so `SEED_HTML_MAX_CHARS` is
57,265,090, about 2.7 times the estimate. `MAX_SRCDOC_CHARS_DEFAULT` (Task 7) grows by about 36 million characters and
risk R1 widens with it. C87 keeps the formula: the nesting that sets r is sustained by repetition (a legal 2 MiB document
of repeated 49-deep blockquotes reaches it), so a smaller cap would refuse legal documents, against FD17. A host may
lower its own `maxSrcdocChars` after measuring. A minimum-size variant was tried and withdrawn: the corpus has one
document of 1 KiB or more, which gave r = 3.74 and would refuse a document as dense as `fences/main.md` at about 795 KB.
Rows L3.M20a to L3.M20e pin the figure.

**Method** (Global Constraints, "Low disk"; C69, C75). One row at a time, in place in the task's own worktree, never in
parallel and never in a copy of the repository. For each row, the file's original bytes and their sha256 were saved
outside the worktree. Each `old` text was checked to occur exactly once and replaced by its `new`. The thread count was
measured (`ps -L -u "$(id -u)" --no-headers | wc -l`, 1875 to 2089 over the runs) and the row ran as
`ulimit -u <threads + 1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 <tests>`, with its output
captured to a log named by the row id. The file was then restored from the saved bytes and its sha256 checked equal to
the saved one (never `git checkout`). Every restore matched. A row that mutates `src/frame/seed.ts` runs
`test/frame-seed.test.ts` only, because the bootstrap bundles that file: `test/frame-document.test.ts`, which compares a
fresh in-memory frame build with the committed manifest, would redden on the manifest and not on the guard.

The rebuild rows (L3.T3e, L3.T3n, L3.T3o) mutate a bundled input on purpose. Each saved the mutated source and every
frame build output (`assets/assets.json`, `src/frame/manifest.generated.ts`, `assets/frame/*`,
`assets/mermaid/mermaid.frame.js`) with their sha256, rebuilt with `node scripts/build-frame.mjs`, and ran its test:
L3.T3e the browser row on Chromium (`DOCREADER_BROWSERS=chromium`; WebKit is CI's), L3.T3n and L3.T3o
`test/frame-document.test.ts`. Each then restored every saved file, checked `sha256sum -c` over all of them, and ran
`node scripts/build-frame.mjs --check`, which exited 0.

The Red column gives the count line and the failing tests the run printed (at most five here; the JSON fence lists all).
In the Change column a line break is shown as ` ⏎ `; the JSON fence holds the exact text.

Notes on the measurement.
- The plan's "compute `r` over the unescaped html" has two places to live: the measuring script (L3.M20c, red through
  the script disagreeing with the test's own measurement and `--check` exiting 1) and the committed constant (L3.M20d,
  set to the cap that measurement gives, 36764359, red through the constant no longer being `ceil(2097152 x r)`).
- L3.M20b plants the higher-ratio document in the test's own fixture corpus (`FIXTURE_EXTRA`), as the plan says, and
  leaves the constant alone. Three rows go red: the constant, the script's agreement, and the script's `--check`, which
  measures the real corpus but is compared with the test's corpus.
- L3.M4a is the whole "records as objects" design: the serialiser writes `images` and `snapshot` as objects and the
  validator reads an object back as its entries. The `__proto__` image ref and the `constructor` snapshot key are then
  refused as proto keys, and an object where pairs belong passes.
- L3.M20g (`ESC` set to 5) now also moves `validateSeed`'s unmeasured-html shortcut, so it reddens the escaped-html row
  as well as the maximal-seed row. L3.T3g mutates the shortcut alone.
- L3.T3e was first observed before its guard existed: with the seed carrying `draw`, the prototype bootstrap's
  `{ ...seed.mermaid, load }` reached L2's option check, which refuses an unknown mermaid key, so the frame sent
  `error{why:'render'}` after ready ("P7 (stretch): Mermaid as a classic IIFE draws ...").

## The escaping: `serializeSeed` (L3.M3a to L3.M3d)

Reference §3's visible escapes: `<`, `>`, `&`, U+2028 and U+2029 written as their ASCII six-character forms, so the seed text holds no `<` and JSON.parse returns exactly what was written.

| Row | Guard | File | Change | Red | Restore |
|---|---|---|---|---|---|
| L3.M3a | the seed text is escaped at all (raw JSON.stringify) | `src/frame/seed.ts` | `  return escapeSeedJson(JSON.stringify(seed));` → `  return JSON.stringify(seed);` | `test/frame-seed.test.ts`: 8 failed \| 148 passed (156). "the text holds no <, > or &, and neither U+2028 nor U+2029 raw"; "each escape is the ASCII six-character form, so this seed is printable ASCII throughout"; "equals Math.ceil(2097152 * r), and its comment names r to 4 decimals and the document"; "the script's measurement agrees: the same r, document and cap"; "`node scripts/measure-seed-ratio.mjs --check` prints r, the document and the top three, and exits 0" | sha256 `111d2d638b78…` restored, equal |
| L3.M3b | U+2028 is written as its escape | `src/frame/seed.ts` | `    .replace(/\u2028/g, '\\u2028')` removed | `test/frame-seed.test.ts`: 4 failed \| 152 passed (156). "the text holds no <, > or &, and neither U+2028 nor U+2029 raw"; "each escape is the ASCII six-character form, so this seed is printable ASCII throughout"; "counts each escape: `<`, `>`, `&`, U+2028, U+2029 and a lone surrogate six, a quote and a CR two"; "a maximal seed passes the validator, and its length outside the html and the image URLs is SEED_FIELDS_MAX_CHARS less the padding slack" | sha256 `111d2d638b78…` restored, equal |
| L3.M3c | `>` is written as its escape (the prototype's escape-gt-drop) | `src/frame/seed.ts` | `    .replace(/>/g, '\\u003e')` removed | `test/frame-seed.test.ts`: 7 failed \| 149 passed (156). "the text holds no <, > or &, and neither U+2028 nor U+2029 raw"; "each escape is the ASCII six-character form, so this seed is printable ASCII throughout"; "equals Math.ceil(2097152 * r), and its comment names r to 4 decimals and the document"; "the script's measurement agrees: the same r, document and cap"; "`node scripts/measure-seed-ratio.mjs --check` prints r, the document and the top three, and exits 0" | sha256 `111d2d638b78…` restored, equal |
| L3.M3d | `&` is written as its escape (the prototype's escape-amp-drop) | `src/frame/seed.ts` | `    .replace(/&/g, '\\u0026')` removed | `test/frame-seed.test.ts`: 4 failed \| 152 passed (156). "the text holds no <, > or &, and neither U+2028 nor U+2029 raw"; "each escape is the ASCII six-character form, so this seed is printable ASCII throughout"; "counts each escape: `<`, `>`, `&`, U+2028, U+2029 and a lone surrogate six, a quote and a CR two"; "a maximal seed passes the validator, and its length outside the html and the image URLs is SEED_FIELDS_MAX_CHARS less the padding slack" | sha256 `111d2d638b78…` restored, equal |

```json
[
  {
    "id": "L3.M3a",
    "guard": "the seed text is escaped at all (raw JSON.stringify)",
    "file": "src/frame/seed.ts",
    "changes": [
      {
        "old": "  return escapeSeedJson(JSON.stringify(seed));",
        "new": "  return JSON.stringify(seed);"
      }
    ],
    "tests": "test/frame-seed.test.ts",
    "rc": 1,
    "red": "8 failed | 148 passed (156)",
    "failing": [
      "the text holds no <, > or &, and neither U+2028 nor U+2029 raw",
      "each escape is the ASCII six-character form, so this seed is printable ASCII throughout",
      "equals Math.ceil(2097152 * r), and its comment names r to 4 decimals and the document",
      "the script's measurement agrees: the same r, document and cap",
      "`node scripts/measure-seed-ratio.mjs --check` prints r, the document and the top three, and exits 0",
      "equals the body of the html inside serializeSeed, for every corpus and hostile document",
      "counts each escape: `<`, `>`, `&`, U+2028, U+2029 and a lone surrogate six, a quote and a CR two",
      "a maximal seed passes the validator, and its length outside the html and the image URLs is SEED_FIELDS_MAX_CHARS less the padding slack"
    ],
    "sha256": "111d2d638b7894298b63c8cefd39aec46345af2aa96f801c672906013ae507aa",
    "restored": true
  },
  {
    "id": "L3.M3b",
    "guard": "U+2028 is written as its escape",
    "file": "src/frame/seed.ts",
    "changes": [
      {
        "old": "    .replace(/\\u2028/g, '\\\\u2028')",
        "new": ""
      }
    ],
    "tests": "test/frame-seed.test.ts",
    "rc": 1,
    "red": "4 failed | 152 passed (156)",
    "failing": [
      "the text holds no <, > or &, and neither U+2028 nor U+2029 raw",
      "each escape is the ASCII six-character form, so this seed is printable ASCII throughout",
      "counts each escape: `<`, `>`, `&`, U+2028, U+2029 and a lone surrogate six, a quote and a CR two",
      "a maximal seed passes the validator, and its length outside the html and the image URLs is SEED_FIELDS_MAX_CHARS less the padding slack"
    ],
    "sha256": "111d2d638b7894298b63c8cefd39aec46345af2aa96f801c672906013ae507aa",
    "restored": true
  },
  {
    "id": "L3.M3c",
    "guard": "`>` is written as its escape (the prototype's escape-gt-drop)",
    "file": "src/frame/seed.ts",
    "changes": [
      {
        "old": "    .replace(/>/g, '\\\\u003e')",
        "new": ""
      }
    ],
    "tests": "test/frame-seed.test.ts",
    "rc": 1,
    "red": "7 failed | 149 passed (156)",
    "failing": [
      "the text holds no <, > or &, and neither U+2028 nor U+2029 raw",
      "each escape is the ASCII six-character form, so this seed is printable ASCII throughout",
      "equals Math.ceil(2097152 * r), and its comment names r to 4 decimals and the document",
      "the script's measurement agrees: the same r, document and cap",
      "`node scripts/measure-seed-ratio.mjs --check` prints r, the document and the top three, and exits 0",
      "counts each escape: `<`, `>`, `&`, U+2028, U+2029 and a lone surrogate six, a quote and a CR two",
      "a maximal seed passes the validator, and its length outside the html and the image URLs is SEED_FIELDS_MAX_CHARS less the padding slack"
    ],
    "sha256": "111d2d638b7894298b63c8cefd39aec46345af2aa96f801c672906013ae507aa",
    "restored": true
  },
  {
    "id": "L3.M3d",
    "guard": "`&` is written as its escape (the prototype's escape-amp-drop)",
    "file": "src/frame/seed.ts",
    "changes": [
      {
        "old": "    .replace(/&/g, '\\\\u0026')",
        "new": ""
      }
    ],
    "tests": "test/frame-seed.test.ts",
    "rc": 1,
    "red": "4 failed | 152 passed (156)",
    "failing": [
      "the text holds no <, > or &, and neither U+2028 nor U+2029 raw",
      "each escape is the ASCII six-character form, so this seed is printable ASCII throughout",
      "counts each escape: `<`, `>`, `&`, U+2028, U+2029 and a lone surrogate six, a quote and a CR two",
      "a maximal seed passes the validator, and its length outside the html and the image URLs is SEED_FIELDS_MAX_CHARS less the padding slack"
    ],
    "sha256": "111d2d638b7894298b63c8cefd39aec46345af2aa96f801c672906013ae507aa",
    "restored": true
  }
]
```

## The validator: `validateSeed` (L3.M4a to L3.M4d)

Records as pairs, the proto-key refusal at any depth, the depth bound of 32, and the snapshot's 1 MiB total. L3.M4d stays green: it is an equivalent mutant (see the note above), recorded here with its reason and not dropped.

| Row | Guard | File | Change | Red | Restore |
|---|---|---|---|---|---|
| L3.M4a | records are [key, value] pairs (the mutant writes images and snapshot as objects and reads objects back) | `src/frame/seed.ts` | `  return escapeSeedJson(JSON.stringify(seed));` → `  return escapeSeedJson(JSON.stringify({ ...seed, images: Object.fromEntries(seed.images), snapshot: Object.fromEntries(seed.snapshot) }));`; `function imagesOk(v: unknown): boolean { ⏎   const L = SEED_LIMITS; ⏎ ` → `function imagesOk(v0: unknown): boolean { ⏎   const L = SEED_LIMITS; ⏎   const v: unknown = isPlain(v0) ? Object.entries(v0) : v0; ⏎ `; `function snapshotOk(v: unknown): boolean { ⏎ ` → `function snapshotOk(v0: unknown): boolean { ⏎   const v: unknown = isPlain(v0) ? Object.entries(v0) : v0; ⏎ ` | `test/frame-seed.test.ts`: 7 failed \| 149 passed (156). "html, the title, a commit subject and an image ref holding each hostile string round-trip exactly"; "a full seed, every field filled, round-trips and validates"; "an image ref '__proto__' round-trips as a pair and validates"; "a snapshot key 'constructor' round-trips as a pair, and is refused as a key off the allow-list, not as a proto key"; "images = {}: images" | sha256 `111d2d638b78…` restored, equal |
| L3.M4b | a proto key is refused at any depth | `src/frame/seed.ts` | `    if (PROTO_KEYS.includes(k)) return 'proto'; ⏎ ` removed | `test/frame-seed.test.ts`: 2 failed \| 154 passed (156). "the same keys as a record would be refused as proto keys (the reason records are pairs)"; "a proto key at any depth (as JSON.parse makes it, an own key): refused" | sha256 `111d2d638b78…` restored, equal |
| L3.M4c | no value sits deeper than 32 | `src/frame/seed.ts` | `  if (depth > SEED_LIMITS.depth) return 'depth'; ⏎ ` removed | `test/frame-seed.test.ts`: 1 failed \| 155 passed (156). "depth 33 is refused as depth; depth 32 reaches the field check" | sha256 `111d2d638b78…` restored, equal |
| L3.M4d | the snapshot's total is at most storeBudgetBytes (EQUIVALENT: unreachable while 8 allow-listed keys x 65536 bytes = 524288 <= 1048576) | `src/frame/seed.ts` | `  return total <= BRIDGE_LIMITS.storeBudgetBytes;` → `  return true;` | `test/frame-seed.test.ts`: 156 passed (156) (green: equivalent mutant).  | sha256 `111d2d638b78…` restored, equal |

```json
[
  {
    "id": "L3.M4a",
    "guard": "records are [key, value] pairs (the mutant writes images and snapshot as objects and reads objects back)",
    "file": "src/frame/seed.ts",
    "changes": [
      {
        "old": "  return escapeSeedJson(JSON.stringify(seed));",
        "new": "  return escapeSeedJson(JSON.stringify({ ...seed, images: Object.fromEntries(seed.images), snapshot: Object.fromEntries(seed.snapshot) }));"
      },
      {
        "old": "function imagesOk(v: unknown): boolean {\n  const L = SEED_LIMITS;\n",
        "new": "function imagesOk(v0: unknown): boolean {\n  const L = SEED_LIMITS;\n  const v: unknown = isPlain(v0) ? Object.entries(v0) : v0;\n"
      },
      {
        "old": "function snapshotOk(v: unknown): boolean {\n",
        "new": "function snapshotOk(v0: unknown): boolean {\n  const v: unknown = isPlain(v0) ? Object.entries(v0) : v0;\n"
      }
    ],
    "tests": "test/frame-seed.test.ts",
    "rc": 1,
    "red": "7 failed | 149 passed (156)",
    "failing": [
      "html, the title, a commit subject and an image ref holding each hostile string round-trip exactly",
      "a full seed, every field filled, round-trips and validates",
      "an image ref '__proto__' round-trips as a pair and validates",
      "a snapshot key 'constructor' round-trips as a pair, and is refused as a key off the allow-list, not as a proto key",
      "images = {}: images",
      "snapshot = {}: snapshot",
      "a maximal seed passes the validator, and its length outside the html and the image URLs is SEED_FIELDS_MAX_CHARS less the padding slack"
    ],
    "sha256": "111d2d638b7894298b63c8cefd39aec46345af2aa96f801c672906013ae507aa",
    "restored": true
  },
  {
    "id": "L3.M4b",
    "guard": "a proto key is refused at any depth",
    "file": "src/frame/seed.ts",
    "changes": [
      {
        "old": "    if (PROTO_KEYS.includes(k)) return 'proto';\n",
        "new": ""
      }
    ],
    "tests": "test/frame-seed.test.ts",
    "rc": 1,
    "red": "2 failed | 154 passed (156)",
    "failing": [
      "the same keys as a record would be refused as proto keys (the reason records are pairs)",
      "a proto key at any depth (as JSON.parse makes it, an own key): refused"
    ],
    "sha256": "111d2d638b7894298b63c8cefd39aec46345af2aa96f801c672906013ae507aa",
    "restored": true
  },
  {
    "id": "L3.M4c",
    "guard": "no value sits deeper than 32",
    "file": "src/frame/seed.ts",
    "changes": [
      {
        "old": "  if (depth > SEED_LIMITS.depth) return 'depth';\n",
        "new": ""
      }
    ],
    "tests": "test/frame-seed.test.ts",
    "rc": 1,
    "red": "1 failed | 155 passed (156)",
    "failing": [
      "depth 33 is refused as depth; depth 32 reaches the field check"
    ],
    "sha256": "111d2d638b7894298b63c8cefd39aec46345af2aa96f801c672906013ae507aa",
    "restored": true
  },
  {
    "id": "L3.M4d",
    "guard": "the snapshot's total is at most storeBudgetBytes (EQUIVALENT: unreachable while 8 allow-listed keys x 65536 bytes = 524288 <= 1048576)",
    "file": "src/frame/seed.ts",
    "changes": [
      {
        "old": "  return total <= BRIDGE_LIMITS.storeBudgetBytes;",
        "new": "  return true;"
      }
    ],
    "tests": "test/frame-seed.test.ts",
    "rc": 0,
    "red": "156 passed (156) (green: equivalent mutant)",
    "failing": [],
    "sha256": "111d2d638b7894298b63c8cefd39aec46345af2aa96f801c672906013ae507aa",
    "restored": true
  }
]
```

## The caps: `SEED_HTML_MAX_CHARS`, `escapedHtmlLength`, `IMAGE_BUDGET_CHARS`, `SEED_FIELDS_MAX_CHARS` (L3.M20a to L3.M20h)

FD17 and ruling R3: the html cap is ceil(2097152 x r) with r measured over the golden corpus on the escaped html; the other two constants recompute from their formulas. L3.M20a to L3.M20e are the plan's rows (L3.M20c and L3.M20d are its "compute r over the unescaped html", once in the measuring script and once as the constant that measurement would give); L3.M20f to L3.M20h pin the other two constants' formulas.

| Row | Guard | File | Change | Red | Restore |
|---|---|---|---|---|---|
| L3.M20a | the constant equals the measured cap (edited by one) | `src/frame/seed.ts` | `export const SEED_HTML_MAX_CHARS = 57265090;` → `export const SEED_HTML_MAX_CHARS = 57265091;` | `test/frame-seed.test.ts`: 3 failed \| 153 passed (156). "equals Math.ceil(2097152 * r), and its comment names r to 4 decimals and the document"; "the script's measurement agrees: the same r, document and cap"; "`node scripts/measure-seed-ratio.mjs --check` prints r, the document and the top three, and exits 0" | sha256 `111d2d638b78…` restored, equal |
| L3.M20b | a corpus document of a higher ratio moves the cap (a fixture document planted in the test's corpus, the constant left alone) | `test/frame-seed.test.ts` | `const FIXTURE_EXTRA: readonly { id: string; markdown: string }[] = [];` → `const FIXTURE_EXTRA: readonly { id: string; markdown: string }[] = [{ id: 'fixture-higher', markdown: '>'.repeat(30) + ' x' }];` | `test/frame-seed.test.ts`: 3 failed \| 153 passed (156). "equals Math.ceil(2097152 * r), and its comment names r to 4 decimals and the document"; "the script's measurement agrees: the same r, document and cap"; "`node scripts/measure-seed-ratio.mjs --check` prints r, the document and the top three, and exits 0" | sha256 `7ce7a56a26bc…` restored, equal |
| L3.M20c | the measuring script computes r over the escaped html | `scripts/measure-seed-ratio.mjs` | `    const escaped = escapedHtmlLength(r.html);` → `    const escaped = r.html.length;` | `test/frame-seed.test.ts`: 2 failed \| 154 passed (156). "the script's measurement agrees: the same r, document and cap"; "`node scripts/measure-seed-ratio.mjs --check` prints r, the document and the top three, and exits 0" | sha256 `e8057f2ac74c…` restored, equal |
| L3.M20d | the constant is r over the escaped html (set to the cap r over the unescaped html gives, 36764359) | `src/frame/seed.ts` | `export const SEED_HTML_MAX_CHARS = 57265090;` → `export const SEED_HTML_MAX_CHARS = 36764359;` | `test/frame-seed.test.ts`: 3 failed \| 153 passed (156). "equals Math.ceil(2097152 * r), and its comment names r to 4 decimals and the document"; "the script's measurement agrees: the same r, document and cap"; "`node scripts/measure-seed-ratio.mjs --check` prints r, the document and the top three, and exits 0" | sha256 `111d2d638b78…` restored, equal |
| L3.M20e | escapedHtmlLength counts the escaped html | `src/frame/seed.ts` | `  return escapeSeedJson(JSON.stringify(html)).length - 2;` → `  return html.length;` | `test/frame-seed.test.ts`: 6 failed \| 150 passed (156). "the html is capped as the seed carries it (escaped, FD17): at the cap passes, one escaped character over is refused"; "the script's measurement agrees: the same r, document and cap"; "`node scripts/measure-seed-ratio.mjs --check` prints r, the document and the top three, and exits 0"; "equals the body of the html inside serializeSeed, for every corpus and hostile document"; "counts each escape: `<`, `>`, `&`, U+2028, U+2029 and a lone surrogate six, a quote and a CR two" | sha256 `111d2d638b78…` restored, equal |
| L3.M20f | IMAGE_BUDGET_CHARS counts a data-URL prefix per image | `src/frame/seed.ts` | `  return 4 * Math.ceil(SEED_LIMITS.imageBudgetBytes / 3) + SEED_LIMITS.images * prefixMax;` → `  return 4 * Math.ceil(SEED_LIMITS.imageBudgetBytes / 3);` | `test/frame-seed.test.ts`: 1 failed \| 155 passed (156). "IMAGE_BUDGET_CHARS = 4 x ceil(5242880 / 3) + 512 x the longest data-URL prefix" | sha256 `111d2d638b78…` restored, equal |
| L3.M20g | SEED_FIELDS_MAX_CHARS counts six characters per escaping character | `src/frame/seed.ts` | `const ESC = 6;` → `const ESC = 5;` | `test/frame-seed.test.ts`: 2 failed \| 154 passed (156). "the html is capped as the seed carries it (escaped, FD17): at the cap passes, one escaped character over is refused"; "a maximal seed passes the validator, and its length outside the html and the image URLs is SEED_FIELDS_MAX_CHARS less the padding slack" | sha256 `111d2d638b78…` restored, equal |
| L3.M20h | SEED_FIELDS_MAX_CHARS counts the per-image base64 padding | `src/frame/seed.ts` | `  return fields + imagePadding;` → `  return fields;` | `test/frame-seed.test.ts`: 1 failed \| 155 passed (156). "a maximal seed passes the validator, and its length outside the html and the image URLs is SEED_FIELDS_MAX_CHARS less the padding slack" | sha256 `111d2d638b78…` restored, equal |

```json
[
  {
    "id": "L3.M20a",
    "guard": "the constant equals the measured cap (edited by one)",
    "file": "src/frame/seed.ts",
    "changes": [
      {
        "old": "export const SEED_HTML_MAX_CHARS = 57265090;",
        "new": "export const SEED_HTML_MAX_CHARS = 57265091;"
      }
    ],
    "tests": "test/frame-seed.test.ts",
    "rc": 1,
    "red": "3 failed | 153 passed (156)",
    "failing": [
      "equals Math.ceil(2097152 * r), and its comment names r to 4 decimals and the document",
      "the script's measurement agrees: the same r, document and cap",
      "`node scripts/measure-seed-ratio.mjs --check` prints r, the document and the top three, and exits 0"
    ],
    "sha256": "111d2d638b7894298b63c8cefd39aec46345af2aa96f801c672906013ae507aa",
    "restored": true
  },
  {
    "id": "L3.M20b",
    "guard": "a corpus document of a higher ratio moves the cap (a fixture document planted in the test's corpus, the constant left alone)",
    "file": "test/frame-seed.test.ts",
    "changes": [
      {
        "old": "const FIXTURE_EXTRA: readonly { id: string; markdown: string }[] = [];",
        "new": "const FIXTURE_EXTRA: readonly { id: string; markdown: string }[] = [{ id: 'fixture-higher', markdown: '>'.repeat(30) + ' x' }];"
      }
    ],
    "tests": "test/frame-seed.test.ts",
    "rc": 1,
    "red": "3 failed | 153 passed (156)",
    "failing": [
      "equals Math.ceil(2097152 * r), and its comment names r to 4 decimals and the document",
      "the script's measurement agrees: the same r, document and cap",
      "`node scripts/measure-seed-ratio.mjs --check` prints r, the document and the top three, and exits 0"
    ],
    "sha256": "7ce7a56a26bc0c87f1e88219539d8ee6f91cac50bbc6be9726ff08dd5d379f4b",
    "restored": true
  },
  {
    "id": "L3.M20c",
    "guard": "the measuring script computes r over the escaped html",
    "file": "scripts/measure-seed-ratio.mjs",
    "changes": [
      {
        "old": "    const escaped = escapedHtmlLength(r.html);",
        "new": "    const escaped = r.html.length;"
      }
    ],
    "tests": "test/frame-seed.test.ts",
    "rc": 1,
    "red": "2 failed | 154 passed (156)",
    "failing": [
      "the script's measurement agrees: the same r, document and cap",
      "`node scripts/measure-seed-ratio.mjs --check` prints r, the document and the top three, and exits 0"
    ],
    "sha256": "e8057f2ac74cc3dd23c28cc7d22910ed499c5da4bfc858e0f04d1ce65b4d3921",
    "restored": true
  },
  {
    "id": "L3.M20d",
    "guard": "the constant is r over the escaped html (set to the cap r over the unescaped html gives, 36764359)",
    "file": "src/frame/seed.ts",
    "changes": [
      {
        "old": "export const SEED_HTML_MAX_CHARS = 57265090;",
        "new": "export const SEED_HTML_MAX_CHARS = 36764359;"
      }
    ],
    "tests": "test/frame-seed.test.ts",
    "rc": 1,
    "red": "3 failed | 153 passed (156)",
    "failing": [
      "equals Math.ceil(2097152 * r), and its comment names r to 4 decimals and the document",
      "the script's measurement agrees: the same r, document and cap",
      "`node scripts/measure-seed-ratio.mjs --check` prints r, the document and the top three, and exits 0"
    ],
    "sha256": "111d2d638b7894298b63c8cefd39aec46345af2aa96f801c672906013ae507aa",
    "restored": true
  },
  {
    "id": "L3.M20e",
    "guard": "escapedHtmlLength counts the escaped html",
    "file": "src/frame/seed.ts",
    "changes": [
      {
        "old": "  return escapeSeedJson(JSON.stringify(html)).length - 2;",
        "new": "  return html.length;"
      }
    ],
    "tests": "test/frame-seed.test.ts",
    "rc": 1,
    "red": "6 failed | 150 passed (156)",
    "failing": [
      "the html is capped as the seed carries it (escaped, FD17): at the cap passes, one escaped character over is refused",
      "the script's measurement agrees: the same r, document and cap",
      "`node scripts/measure-seed-ratio.mjs --check` prints r, the document and the top three, and exits 0",
      "equals the body of the html inside serializeSeed, for every corpus and hostile document",
      "counts each escape: `<`, `>`, `&`, U+2028, U+2029 and a lone surrogate six, a quote and a CR two",
      "each string field's worst case is six characters per code point: no character escapes longer"
    ],
    "sha256": "111d2d638b7894298b63c8cefd39aec46345af2aa96f801c672906013ae507aa",
    "restored": true
  },
  {
    "id": "L3.M20f",
    "guard": "IMAGE_BUDGET_CHARS counts a data-URL prefix per image",
    "file": "src/frame/seed.ts",
    "changes": [
      {
        "old": "  return 4 * Math.ceil(SEED_LIMITS.imageBudgetBytes / 3) + SEED_LIMITS.images * prefixMax;",
        "new": "  return 4 * Math.ceil(SEED_LIMITS.imageBudgetBytes / 3);"
      }
    ],
    "tests": "test/frame-seed.test.ts",
    "rc": 1,
    "red": "1 failed | 155 passed (156)",
    "failing": [
      "IMAGE_BUDGET_CHARS = 4 x ceil(5242880 / 3) + 512 x the longest data-URL prefix"
    ],
    "sha256": "111d2d638b7894298b63c8cefd39aec46345af2aa96f801c672906013ae507aa",
    "restored": true
  },
  {
    "id": "L3.M20g",
    "guard": "SEED_FIELDS_MAX_CHARS counts six characters per escaping character",
    "file": "src/frame/seed.ts",
    "changes": [
      {
        "old": "const ESC = 6;",
        "new": "const ESC = 5;"
      }
    ],
    "tests": "test/frame-seed.test.ts",
    "rc": 1,
    "red": "2 failed | 154 passed (156)",
    "failing": [
      "the html is capped as the seed carries it (escaped, FD17): at the cap passes, one escaped character over is refused",
      "a maximal seed passes the validator, and its length outside the html and the image URLs is SEED_FIELDS_MAX_CHARS less the padding slack"
    ],
    "sha256": "111d2d638b7894298b63c8cefd39aec46345af2aa96f801c672906013ae507aa",
    "restored": true
  },
  {
    "id": "L3.M20h",
    "guard": "SEED_FIELDS_MAX_CHARS counts the per-image base64 padding",
    "file": "src/frame/seed.ts",
    "changes": [
      {
        "old": "  return fields + imagePadding;",
        "new": "  return fields;"
      }
    ],
    "tests": "test/frame-seed.test.ts",
    "rc": 1,
    "red": "1 failed | 155 passed (156)",
    "failing": [
      "a maximal seed passes the validator, and its length outside the html and the image URLs is SEED_FIELDS_MAX_CHARS less the padding slack"
    ],
    "sha256": "111d2d638b7894298b63c8cefd39aec46345af2aa96f801c672906013ae507aa",
    "restored": true
  }
]
```

## The default keys: `frameDocument`'s seed and the bootstrap (L3.T3a to L3.T3e)

frameDocument emits every schema 1 key at its default, seeds an initialHash only inside FRAGMENT_ID_GRAMMAR, refuses a lang its seed validator would refuse, and completes `mermaid` with `secure: []` and `draw: 'auto'`; the bootstrap passes enhance the seed's Mermaid caps and secure keys but not `draw` until Task 16. L3.T3a is the plan's row ("omit one key from frameDocument's seed"); L3.T3b to L3.T3e pin the guards this task adds to keep frameDocument's output inside its own validator. L3.T3e is a rebuild row (see Method).

| Row | Guard | File | Change | Red | Restore |
|---|---|---|---|---|---|
| L3.T3a | the seed carries `bridge` (one key omitted) | `src/frame/document.ts` | `    bridge: { links: true, hash: true, copy: true, changes: true, versions: true }, ⏎   }; ⏎   const seed = serializeSeed(fields);` → `  }; ⏎   const seed = serializeSeed(fields);` | `test/frame-document.test.ts`: 5 failed \| 44 passed (49). "an id outside FRAGMENT_ID_GRAMMAR (a space, a #, a slash, 129 astral letters) is seeded as null, and the seed validates"; "mermaid off: exactly SEED_KEYS, each new key at its default, and the seed passes validateSeed"; "mermaid on: the mermaid object is completed with secure [] and draw 'auto', and the seed passes validateSeed"; "mermaid.maxTextSize and maxEdges: the seed caps (SEED_LIMITS) pass and validate, one more is refused"; "meta.title: SEED_LIMITS.titleMaxCodeUnits passes and validates, one more is refused" | sha256 `d2de86787762…` restored, equal |
| L3.T3b | an initialHash outside FRAGMENT_ID_GRAMMAR is seeded as null (mutant: the length bounds only) | `src/frame/document.ts` | `  const initialHash = isFragmentId(hash) ? hash : null;` → `  const initialHash = typeof hash === 'string' && hash.length > 0 && hash.length <= 256 ? hash : null;` | `test/frame-document.test.ts`: 1 failed \| 48 passed (49). "an id outside FRAGMENT_ID_GRAMMAR (a space, a #, a slash, 129 astral letters) is seeded as null, and the seed validates" | sha256 `d2de86787762…` restored, equal |
| L3.T3c | a lang over 64 code units is refused invalid-input (mutant: the grammar only) | `src/frame/document.ts` | `  if (!isLang(lang)) throw` → `  if (typeof lang !== 'string' \|\| !/^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/.test(lang)) throw` | `test/frame-document.test.ts`: 1 failed \| 48 passed (49). "a lang over 64 code units (grammar-valid) is refused invalid-input, never seeded for the validator to refuse" | sha256 `d2de86787762…` restored, equal |
| L3.T3d | the mermaid object is completed with secure and draw | `src/frame/document.ts` | `  return { ...out, secure: [], draw: 'auto' };` → `  return out as unknown as SeedMermaid;` | `test/frame-document.test.ts`: 3 failed \| 46 passed (49). "mermaid on: the mermaid object is completed with secure [] and draw 'auto', and the seed passes validateSeed"; "mermaid.maxTextSize and maxEdges: the seed caps (SEED_LIMITS) pass and validate, one more is refused"; "mermaid on: the Mermaid script follows enhance, and the seed carries the caps" | sha256 `d2de86787762…` restored, equal |
| L3.T3e | the bootstrap passes enhance the seed's mermaid without draw (mutant: the whole seed object spread) | `src/frame-runtime/bootstrap.ts` | `{ mermaid: { ...mermaidSettings(seed.mermaid), load:` → `{ mermaid: { ...seed.mermaid, load:` | `test/browser/frame-boot.test.ts`: 1 failed \| 18 passed \| 21 skipped (40). "P7 (stretch): Mermaid as a classic IIFE draws a flowchart, a sequence and a gantt under the hash-only policy; ready waits for it" | sha256 `111e52440487…` restored, equal |

```json
[
  {
    "id": "L3.T3a",
    "guard": "the seed carries `bridge` (one key omitted)",
    "file": "src/frame/document.ts",
    "changes": [
      {
        "old": "    bridge: { links: true, hash: true, copy: true, changes: true, versions: true },\n  };\n  const seed = serializeSeed(fields);",
        "new": "  };\n  const seed = serializeSeed(fields);"
      }
    ],
    "tests": "test/frame-document.test.ts",
    "rc": 1,
    "red": "5 failed | 44 passed (49)",
    "failing": [
      "an id outside FRAGMENT_ID_GRAMMAR (a space, a #, a slash, 129 astral letters) is seeded as null, and the seed validates",
      "mermaid off: exactly SEED_KEYS, each new key at its default, and the seed passes validateSeed",
      "mermaid on: the mermaid object is completed with secure [] and draw 'auto', and the seed passes validateSeed",
      "mermaid.maxTextSize and maxEdges: the seed caps (SEED_LIMITS) pass and validate, one more is refused",
      "meta.title: SEED_LIMITS.titleMaxCodeUnits passes and validates, one more is refused"
    ],
    "sha256": "d2de8678776208841fb2916601e3f8f2a6688a441d97cd76ed9aeac74b2d9688",
    "restored": true
  },
  {
    "id": "L3.T3b",
    "guard": "an initialHash outside FRAGMENT_ID_GRAMMAR is seeded as null (mutant: the length bounds only)",
    "file": "src/frame/document.ts",
    "changes": [
      {
        "old": "  const initialHash = isFragmentId(hash) ? hash : null;",
        "new": "  const initialHash = typeof hash === 'string' && hash.length > 0 && hash.length <= 256 ? hash : null;"
      }
    ],
    "tests": "test/frame-document.test.ts",
    "rc": 1,
    "red": "1 failed | 48 passed (49)",
    "failing": [
      "an id outside FRAGMENT_ID_GRAMMAR (a space, a #, a slash, 129 astral letters) is seeded as null, and the seed validates"
    ],
    "sha256": "d2de8678776208841fb2916601e3f8f2a6688a441d97cd76ed9aeac74b2d9688",
    "restored": true
  },
  {
    "id": "L3.T3c",
    "guard": "a lang over 64 code units is refused invalid-input (mutant: the grammar only)",
    "file": "src/frame/document.ts",
    "changes": [
      {
        "old": "  if (!isLang(lang)) throw",
        "new": "  if (typeof lang !== 'string' || !/^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/.test(lang)) throw"
      }
    ],
    "tests": "test/frame-document.test.ts",
    "rc": 1,
    "red": "1 failed | 48 passed (49)",
    "failing": [
      "a lang over 64 code units (grammar-valid) is refused invalid-input, never seeded for the validator to refuse"
    ],
    "sha256": "d2de8678776208841fb2916601e3f8f2a6688a441d97cd76ed9aeac74b2d9688",
    "restored": true
  },
  {
    "id": "L3.T3d",
    "guard": "the mermaid object is completed with secure and draw",
    "file": "src/frame/document.ts",
    "changes": [
      {
        "old": "  return { ...out, secure: [], draw: 'auto' };",
        "new": "  return out as unknown as SeedMermaid;"
      }
    ],
    "tests": "test/frame-document.test.ts",
    "rc": 1,
    "red": "3 failed | 46 passed (49)",
    "failing": [
      "mermaid on: the mermaid object is completed with secure [] and draw 'auto', and the seed passes validateSeed",
      "mermaid.maxTextSize and maxEdges: the seed caps (SEED_LIMITS) pass and validate, one more is refused",
      "mermaid on: the Mermaid script follows enhance, and the seed carries the caps"
    ],
    "sha256": "d2de8678776208841fb2916601e3f8f2a6688a441d97cd76ed9aeac74b2d9688",
    "restored": true
  },
  {
    "id": "L3.T3e",
    "guard": "the bootstrap passes enhance the seed's mermaid without draw (mutant: the whole seed object spread)",
    "file": "src/frame-runtime/bootstrap.ts",
    "changes": [
      {
        "old": "{ mermaid: { ...mermaidSettings(seed.mermaid), load:",
        "new": "{ mermaid: { ...seed.mermaid, load:"
      }
    ],
    "tests": "test/browser/frame-boot.test.ts (DOCREADER_BROWSERS=chromium)",
    "rc": 1,
    "red": "1 failed | 18 passed | 21 skipped (40)",
    "failing": [
      "P7 (stretch): Mermaid as a classic IIFE draws a flowchart, a sequence and a gantt under the hash-only policy; ready waits for it"
    ],
    "sha256": "111e524404877ee16b94c5e36f7f035976bb7482b27587de76587ff98a50c9bb",
    "restored": true
  }
]
```

## The review fixes: the validator's size bounds, frameDocument's caps, the bootstrap's bundle (L3.T3f to L3.T3o)

Added by the fix round. validateSeed bounds the html by its escaped length (FD17's unit) with a shortcut for an html of at most a sixth of the cap, and the images by their decoded bytes together (the spec's 5 MiB budget); an empty image ref is admitted (scanRefs lists one for `![a]()`); frameDocument refuses `invalid-input` a Mermaid cap above SEED_LIMITS and a title above SEED_LIMITS.titleMaxCodeUnits, so it never writes a seed its bootstrap refuses; the two srcdoc-size formulas are `/* @__PURE__ */` calls, so esbuild leaves them out of the bootstrap (Reference §12's 32 KiB budget). L3.T3n and L3.T3o are rebuild rows (see Method).

| Row | Guard | File | Change | Red | Restore |
|---|---|---|---|---|---|
| L3.T3f | the html is capped by its escaped length (mutant: the parsed length only) | `src/frame/seed.ts` | `  return v.length * ESC <= SEED_HTML_MAX_CHARS \|\| escapedHtmlLength(v) <= SEED_HTML_MAX_CHARS;` → `  return true;` | `test/frame-seed.test.ts`: 1 failed \| 155 passed (156). "the html is capped as the seed carries it (escaped, FD17): at the cap passes, one escaped character over is refused" | sha256 `111d2d638b78…` restored, equal |
| L3.T3g | the unmeasured shortcut admits only an html of at most cap / 6 (mutant: cap / 5) | `src/frame/seed.ts` | `  return v.length * ESC <= SEED_HTML_MAX_CHARS \|\|` → `  return v.length * 5 <= SEED_HTML_MAX_CHARS \|\|` | `test/frame-seed.test.ts`: 1 failed \| 155 passed (156). "the html is capped as the seed carries it (escaped, FD17): at the cap passes, one escaped character over is refused" | sha256 `111d2d638b78…` restored, equal |
| L3.T3h | the images' decoded bytes are within the image budget (mutant: no budget) | `src/frame/seed.ts` | `  return bytes <= L.imageBudgetBytes;` → `  return true;` | `test/frame-seed.test.ts`: 1 failed \| 155 passed (156). "images: their decoded bytes together are capped by the spec's image budget (5 MiB), not each image alone" | sha256 `111d2d638b78…` restored, equal |
| L3.T3i | the budget binds the images together (mutant: each image alone) | `src/frame/seed.ts` | `    bytes += imageDecodedBytes(url);` → `    bytes = Math.max(bytes, imageDecodedBytes(url));` | `test/frame-seed.test.ts`: 1 failed \| 155 passed (156). "images: their decoded bytes together are capped by the spec's image budget (5 MiB), not each image alone" | sha256 `111d2d638b78…` restored, equal |
| L3.T3j | decoded bytes discount the `=` padding (mutant: padding counted as data) | `src/frame/seed.ts` | `  const pad = url.endsWith('==') ? 2 : url.endsWith('=') ? 1 : 0;` → `  const pad = 0;` | `test/frame-seed.test.ts`: 1 failed \| 155 passed (156). "images: their decoded bytes together are capped by the spec's image budget (5 MiB), not each image alone" | sha256 `111d2d638b78…` restored, equal |
| L3.T3k | an empty image ref is admitted (mutant: the old refusal) | `src/frame/seed.ts` | `    if (ref.length > L.imageRefMaxCodeUnits \|\|` → `    if (ref.length < 1 \|\| ref.length > L.imageRefMaxCodeUnits \|\|` | `test/frame-seed.test.ts`: 1 failed \| 155 passed (156). "images: an empty ref passes, as scanRefs lists one for `![a]()` (Reference 1 sets no lower bound)" | sha256 `111d2d638b78…` restored, equal |
| L3.T3l | frameDocument refuses a Mermaid cap above SEED_LIMITS (mutant: no upper bound) | `src/frame/document.ts` | `\|\| v < 1 \|\| v > max) {` → `\|\| v < 1) {` | `test/frame-document.test.ts`: 1 failed \| 48 passed (49). "mermaid.maxTextSize and maxEdges: the seed caps (SEED_LIMITS) pass and validate, one more is refused" | sha256 `d2de86787762…` restored, equal |
| L3.T3m | frameDocument refuses a title above SEED_LIMITS.titleMaxCodeUnits (mutant: the type only) | `src/frame/document.ts` | `(typeof title !== 'string' \|\| title.length > SEED_LIMITS.titleMaxCodeUnits)` → `typeof title !== 'string'` | `test/frame-document.test.ts`: 1 failed \| 48 passed (49). "meta.title: SEED_LIMITS.titleMaxCodeUnits passes and validates, one more is refused" | sha256 `d2de86787762…` restored, equal |
| L3.T3n | SEED_FIELDS_MAX_CHARS stays out of the bootstrap (mutant: its pure annotation removed) | `src/frame/seed.ts` | `= /* @__PURE__ */ seedFieldsMaxChars();` → `= seedFieldsMaxChars();` | `test/frame-document.test.ts`: 1 failed \| 48 passed (49). "none of the size formulas reaches bootstrap.js, and it is within its 32 KiB budget" | sha256 `111d2d638b78…` restored, equal |
| L3.T3o | IMAGE_BUDGET_CHARS stays out of the bootstrap (mutant: its pure annotation removed) | `src/frame/seed.ts` | `= /* @__PURE__ */ imageBudgetChars();` → `= imageBudgetChars();` | `test/frame-document.test.ts`: 1 failed \| 48 passed (49). "none of the size formulas reaches bootstrap.js, and it is within its 32 KiB budget" | sha256 `111d2d638b78…` restored, equal |

```json
[
  {
    "id": "L3.T3f",
    "guard": "the html is capped by its escaped length (mutant: the parsed length only)",
    "file": "src/frame/seed.ts",
    "changes": [
      {
        "old": "  return v.length * ESC <= SEED_HTML_MAX_CHARS || escapedHtmlLength(v) <= SEED_HTML_MAX_CHARS;",
        "new": "  return true;"
      }
    ],
    "tests": "test/frame-seed.test.ts",
    "rc": 1,
    "red": "1 failed | 155 passed (156)",
    "failing": [
      "the html is capped as the seed carries it (escaped, FD17): at the cap passes, one escaped character over is refused"
    ],
    "sha256": "111d2d638b7894298b63c8cefd39aec46345af2aa96f801c672906013ae507aa",
    "restored": true
  },
  {
    "id": "L3.T3g",
    "guard": "the unmeasured shortcut admits only an html of at most cap / 6 (mutant: cap / 5)",
    "file": "src/frame/seed.ts",
    "changes": [
      {
        "old": "  return v.length * ESC <= SEED_HTML_MAX_CHARS ||",
        "new": "  return v.length * 5 <= SEED_HTML_MAX_CHARS ||"
      }
    ],
    "tests": "test/frame-seed.test.ts",
    "rc": 1,
    "red": "1 failed | 155 passed (156)",
    "failing": [
      "the html is capped as the seed carries it (escaped, FD17): at the cap passes, one escaped character over is refused"
    ],
    "sha256": "111d2d638b7894298b63c8cefd39aec46345af2aa96f801c672906013ae507aa",
    "restored": true
  },
  {
    "id": "L3.T3h",
    "guard": "the images' decoded bytes are within the image budget (mutant: no budget)",
    "file": "src/frame/seed.ts",
    "changes": [
      {
        "old": "  return bytes <= L.imageBudgetBytes;",
        "new": "  return true;"
      }
    ],
    "tests": "test/frame-seed.test.ts",
    "rc": 1,
    "red": "1 failed | 155 passed (156)",
    "failing": [
      "images: their decoded bytes together are capped by the spec's image budget (5 MiB), not each image alone"
    ],
    "sha256": "111d2d638b7894298b63c8cefd39aec46345af2aa96f801c672906013ae507aa",
    "restored": true
  },
  {
    "id": "L3.T3i",
    "guard": "the budget binds the images together (mutant: each image alone)",
    "file": "src/frame/seed.ts",
    "changes": [
      {
        "old": "    bytes += imageDecodedBytes(url);",
        "new": "    bytes = Math.max(bytes, imageDecodedBytes(url));"
      }
    ],
    "tests": "test/frame-seed.test.ts",
    "rc": 1,
    "red": "1 failed | 155 passed (156)",
    "failing": [
      "images: their decoded bytes together are capped by the spec's image budget (5 MiB), not each image alone"
    ],
    "sha256": "111d2d638b7894298b63c8cefd39aec46345af2aa96f801c672906013ae507aa",
    "restored": true
  },
  {
    "id": "L3.T3j",
    "guard": "decoded bytes discount the `=` padding (mutant: padding counted as data)",
    "file": "src/frame/seed.ts",
    "changes": [
      {
        "old": "  const pad = url.endsWith('==') ? 2 : url.endsWith('=') ? 1 : 0;",
        "new": "  const pad = 0;"
      }
    ],
    "tests": "test/frame-seed.test.ts",
    "rc": 1,
    "red": "1 failed | 155 passed (156)",
    "failing": [
      "images: their decoded bytes together are capped by the spec's image budget (5 MiB), not each image alone"
    ],
    "sha256": "111d2d638b7894298b63c8cefd39aec46345af2aa96f801c672906013ae507aa",
    "restored": true
  },
  {
    "id": "L3.T3k",
    "guard": "an empty image ref is admitted (mutant: the old refusal)",
    "file": "src/frame/seed.ts",
    "changes": [
      {
        "old": "    if (ref.length > L.imageRefMaxCodeUnits ||",
        "new": "    if (ref.length < 1 || ref.length > L.imageRefMaxCodeUnits ||"
      }
    ],
    "tests": "test/frame-seed.test.ts",
    "rc": 1,
    "red": "1 failed | 155 passed (156)",
    "failing": [
      "images: an empty ref passes, as scanRefs lists one for `![a]()` (Reference 1 sets no lower bound)"
    ],
    "sha256": "111d2d638b7894298b63c8cefd39aec46345af2aa96f801c672906013ae507aa",
    "restored": true
  },
  {
    "id": "L3.T3l",
    "guard": "frameDocument refuses a Mermaid cap above SEED_LIMITS (mutant: no upper bound)",
    "file": "src/frame/document.ts",
    "changes": [
      {
        "old": "|| v < 1 || v > max) {",
        "new": "|| v < 1) {"
      }
    ],
    "tests": "test/frame-document.test.ts",
    "rc": 1,
    "red": "1 failed | 48 passed (49)",
    "failing": [
      "mermaid.maxTextSize and maxEdges: the seed caps (SEED_LIMITS) pass and validate, one more is refused"
    ],
    "sha256": "d2de8678776208841fb2916601e3f8f2a6688a441d97cd76ed9aeac74b2d9688",
    "restored": true
  },
  {
    "id": "L3.T3m",
    "guard": "frameDocument refuses a title above SEED_LIMITS.titleMaxCodeUnits (mutant: the type only)",
    "file": "src/frame/document.ts",
    "changes": [
      {
        "old": "(typeof title !== 'string' || title.length > SEED_LIMITS.titleMaxCodeUnits)",
        "new": "typeof title !== 'string'"
      }
    ],
    "tests": "test/frame-document.test.ts",
    "rc": 1,
    "red": "1 failed | 48 passed (49)",
    "failing": [
      "meta.title: SEED_LIMITS.titleMaxCodeUnits passes and validates, one more is refused"
    ],
    "sha256": "d2de8678776208841fb2916601e3f8f2a6688a441d97cd76ed9aeac74b2d9688",
    "restored": true
  },
  {
    "id": "L3.T3n",
    "guard": "SEED_FIELDS_MAX_CHARS stays out of the bootstrap (mutant: its pure annotation removed)",
    "file": "src/frame/seed.ts",
    "changes": [
      {
        "old": "= /* @__PURE__ */ seedFieldsMaxChars();",
        "new": "= seedFieldsMaxChars();"
      }
    ],
    "tests": "test/frame-document.test.ts",
    "rc": 1,
    "red": "1 failed | 48 passed (49)",
    "failing": [
      "none of the size formulas reaches bootstrap.js, and it is within its 32 KiB budget"
    ],
    "sha256": "111d2d638b7894298b63c8cefd39aec46345af2aa96f801c672906013ae507aa",
    "restored": true
  },
  {
    "id": "L3.T3o",
    "guard": "IMAGE_BUDGET_CHARS stays out of the bootstrap (mutant: its pure annotation removed)",
    "file": "src/frame/seed.ts",
    "changes": [
      {
        "old": "= /* @__PURE__ */ imageBudgetChars();",
        "new": "= imageBudgetChars();"
      }
    ],
    "tests": "test/frame-document.test.ts",
    "rc": 1,
    "red": "1 failed | 48 passed (49)",
    "failing": [
      "none of the size formulas reaches bootstrap.js, and it is within its 32 KiB budget"
    ],
    "sha256": "111d2d638b7894298b63c8cefd39aec46345af2aa96f801c672906013ae507aa",
    "restored": true
  }
]
```
