# Batch Task 1: mutation rows (the copy check names U+2028 and U+2029)

Each row was measured in place on branch `ws/docserver-release-1-1` by the batch method: the bytes of `src/host/copy.ts` saved with their sha256, one edit applied, the named test files run as `./node_modules/.bin/vitest run --maxWorkers=2 --reporter=json <files>` behind `timeout -k 10 600` and a `ulimit -u` of the measured thread count plus 1500, then the file restored from the saved bytes (`cp`) and its sha256 compared. Every row exited 1; every failing test failed with an `AssertionError` (no row went red through a load or compile failure). The `copy.ts` restore sha256 for this task is `e29884084c7c6759415868c7b648c5b20846ab99c9f759bc858add63de62f2d5`.

Test files per row. Rows B1a to B1c, L3.H7c, L3.H7c1, L3.H7d, L3.H7e, L3.H7h, L3.H7i, L3.H7k and L3.H7r ran `test/host-copy.test.ts` and `test/host-links.test.ts` together (39 and 22 tests); rows L3.H7a, L3.H7b, L3.H7f, L3.H7g, L3.H7j, L3.H7l, L3.H7m, L3.H7n, L3.H7o, L3.H7p, L3.H7q and L3.H7s ran `test/host-copy.test.ts` alone (39 tests), as in the C103 record, because the links test does not depend on what they change. A row's Red cell names each file it ran; a file that stays green is stated.

## The new rows (B1a to B1c)

The separator class, its width and its names (ledger C106). B1a: `test/host-links.test.ts` stays green, because `WHITE_SPACE` in the link classifier still refuses both separators.

| Row | Guard | File | Change | Red | Restore |
|---|---|---|---|---|---|
| B1a | the separator class | `src/host/copy.ts` | `  // line and paragraph separators (ledger C106; Zl and Zp, not controls, so they carry their character names) ⏎   0x2028: 'LINE SEPARATOR', ⏎   0x2029: 'PARAGRAPH SEPARATOR', ⏎ ` → (removed) | `test/host-copy.test.ts`: 3 failed \| 36 passed (39). "L3.H7 each hidden character is reported with its index and name the separator U+2028 LINE SEPARATOR"; "L3.H7 each hidden character is reported with its index and name the separator U+2029 PARAGRAPH SEPARATOR"; "L3.H7 hasHiddenChar is true for a directional mark and for a tag character, false for clean text". `test/host-links.test.ts`: stays green (22 passed (22)). | sha256 `e29884084c7c…` restored, equal |
| B1b | the class's width | `src/host/copy.ts` | `  0x2060: 'WORD JOINER', ⏎ ` → `  0x2060: 'WORD JOINER', ⏎   0x2027: 'HYPHENATION POINT', ⏎ ` | `test/host-copy.test.ts`: 1 failed \| 38 passed (39). "L3.H7 what is not hidden clean text, tab, newline, ordinary non-ASCII and the marks beside the listed ranges give nothing". `test/host-links.test.ts`: stays green (22 passed (22)). | sha256 `e29884084c7c…` restored, equal |
| B1c | the right name | `src/host/copy.ts` | `0x2028: 'LINE SEPARATOR', ⏎   0x2029: 'PARAGRAPH SEPARATOR',` → `0x2028: 'PARAGRAPH SEPARATOR', ⏎   0x2029: 'LINE SEPARATOR',` | `test/host-copy.test.ts`: 2 failed \| 37 passed (39). "L3.H7 each hidden character is reported with its index and name the separator U+2028 LINE SEPARATOR"; "L3.H7 each hidden character is reported with its index and name the separator U+2029 PARAGRAPH SEPARATOR". `test/host-links.test.ts`: stays green (22 passed (22)). | sha256 `e29884084c7c…` restored, equal |

```json
[
  {
    "id": "B1a",
    "guard": "the separator class",
    "file": "src/host/copy.ts",
    "old": "  // line and paragraph separators (ledger C106; Zl and Zp, not controls, so they carry their character names)\n  0x2028: 'LINE SEPARATOR',\n  0x2029: 'PARAGRAPH SEPARATOR',\n",
    "new": "",
    "tests": "test/host-copy.test.ts test/host-links.test.ts",
    "rc": 1,
    "red": "test/host-copy.test.ts: 3 failed | 36 passed (39); test/host-links.test.ts: 0 failed | 22 passed (22)",
    "failing": [
      "test/host-copy.test.ts: L3.H7 each hidden character is reported with its index and name the separator U+2028 LINE SEPARATOR",
      "test/host-copy.test.ts: L3.H7 each hidden character is reported with its index and name the separator U+2029 PARAGRAPH SEPARATOR",
      "test/host-copy.test.ts: L3.H7 hasHiddenChar is true for a directional mark and for a tag character, false for clean text"
    ],
    "assertionErrorsOnly": true,
    "sha256": "e29884084c7c6759415868c7b648c5b20846ab99c9f759bc858add63de62f2d5",
    "restored": true
  },
  {
    "id": "B1b",
    "guard": "the class's width",
    "file": "src/host/copy.ts",
    "old": "  0x2060: 'WORD JOINER',\n",
    "new": "  0x2060: 'WORD JOINER',\n  0x2027: 'HYPHENATION POINT',\n",
    "tests": "test/host-copy.test.ts test/host-links.test.ts",
    "rc": 1,
    "red": "test/host-copy.test.ts: 1 failed | 38 passed (39); test/host-links.test.ts: 0 failed | 22 passed (22)",
    "failing": [
      "test/host-copy.test.ts: L3.H7 what is not hidden clean text, tab, newline, ordinary non-ASCII and the marks beside the listed ranges give nothing"
    ],
    "assertionErrorsOnly": true,
    "sha256": "e29884084c7c6759415868c7b648c5b20846ab99c9f759bc858add63de62f2d5",
    "restored": true
  },
  {
    "id": "B1c",
    "guard": "the right name",
    "file": "src/host/copy.ts",
    "old": "0x2028: 'LINE SEPARATOR',\n  0x2029: 'PARAGRAPH SEPARATOR',",
    "new": "0x2028: 'PARAGRAPH SEPARATOR',\n  0x2029: 'LINE SEPARATOR',",
    "tests": "test/host-copy.test.ts test/host-links.test.ts",
    "rc": 1,
    "red": "test/host-copy.test.ts: 2 failed | 37 passed (39); test/host-links.test.ts: 0 failed | 22 passed (22)",
    "failing": [
      "test/host-copy.test.ts: L3.H7 each hidden character is reported with its index and name the separator U+2028 LINE SEPARATOR",
      "test/host-copy.test.ts: L3.H7 each hidden character is reported with its index and name the separator U+2029 PARAGRAPH SEPARATOR"
    ],
    "assertionErrorsOnly": true,
    "sha256": "e29884084c7c6759415868c7b648c5b20846ab99c9f759bc858add63de62f2d5",
    "restored": true
  }
]
```

## The L3.H7 rows, measured again (L3.H7a to L3.H7s and L3.H7c1)

Ledger C106 adds two entries to `OTHER_NAMES` and two cases to the per-character loop, one to the `hasHiddenChar` row and two neighbours to the "not hidden" row, so `test/host-copy.test.ts` counts 39 tests (it counted 37 under C103) and `copy.ts`'s restore sha256 changes from `10f83c087996…` to `e29884084c7c…`. Every row below was run again on this tree; each goes red as before, with the same failing tests, and the count lines move from 37 to 39 only. The earlier record in `l3-mutations/task-9.md` is left as it was.

| Row | Guard | File | Change | Red | Restore |
|---|---|---|---|---|---|
| L3.H7a | drop a class: C0 controls (ESC among them) | `src/host/copy.ts` | `  if (c < 0x20) return c === TAB \|\| c === NEWLINE ? null : (C0_NAMES[c] ?? null);` → `  if (c < 0x20) return null;` | `test/host-copy.test.ts`: 4 failed \| 35 passed (39). "L3.H7 each hidden character is reported with its index and name ESC"; "L3.H7 each hidden character is reported with its index and name DEL, NUL, BEL, BACKSPACE, VT, FF and CR"; "L3.H7 each hidden character is reported with its index and name every C0 control but tab and newline, each with a name of its own"; "L3.H7 indices are UTF-16 code units, in order every hidden character of a mixed text, in order". | sha256 `e29884084c7c…` restored, equal |
| L3.H7b | drop a class: DEL | `src/host/copy.ts` | `  0x7f: 'DELETE', ⏎ ` → (removed) | `test/host-copy.test.ts`: 1 failed \| 38 passed (39). "L3.H7 each hidden character is reported with its index and name DEL, NUL, BEL, BACKSPACE, VT, FF and CR". | sha256 `e29884084c7c…` restored, equal |
| L3.H7c | drop a class: the bidi embeddings and overrides (U+202A to U+202E) | `src/host/copy.ts` | `  0x202a: 'LEFT-TO-RIGHT EMBEDDING', ⏎   0x202b: 'RIGHT-TO-LEFT EMBEDDING', ⏎   0x202c: 'POP DIRECTIONAL FORMATTING', ⏎   0x202d: 'LEFT-TO-RIGHT OVERRIDE', ⏎   0x202e: 'RIGHT-TO-LEFT OVERRIDE', ⏎ ` → (removed) | `test/host-copy.test.ts`: 6 failed \| 33 passed (39). "L3.H7 each hidden character is reported with its index and name the bidi control U+202A LEFT-TO-RIGHT EMBEDDING"; "L3.H7 each hidden character is reported with its index and name the bidi control U+202B RIGHT-TO-LEFT EMBEDDING"; "L3.H7 each hidden character is reported with its index and name the bidi control U+202C POP DIRECTIONAL FORMATTING"; "L3.H7 each hidden character is reported with its index and name the bidi control U+202D LEFT-TO-RIGHT OVERRIDE"; "L3.H7 each hidden character is reported with its index and name the bidi control U+202E RIGHT-TO-LEFT OVERRIDE"; and 1 more. `test/host-links.test.ts`: 1 failed \| 21 passed (22). "L3.H6 refused: controls, white space and length the copy check's bidi controls and zero-width characters, anywhere, in every kind of link". | sha256 `e29884084c7c…` restored, equal |
| L3.H7d | drop a class: the bidi isolates (U+2066 to U+2069) | `src/host/copy.ts` | `  0x2066: 'LEFT-TO-RIGHT ISOLATE', ⏎   0x2067: 'RIGHT-TO-LEFT ISOLATE', ⏎   0x2068: 'FIRST STRONG ISOLATE', ⏎   0x2069: 'POP DIRECTIONAL ISOLATE', ⏎ ` → (removed) | `test/host-copy.test.ts`: 5 failed \| 34 passed (39). "L3.H7 each hidden character is reported with its index and name the bidi control U+2066 LEFT-TO-RIGHT ISOLATE"; "L3.H7 each hidden character is reported with its index and name the bidi control U+2067 RIGHT-TO-LEFT ISOLATE"; "L3.H7 each hidden character is reported with its index and name the bidi control U+2068 FIRST STRONG ISOLATE"; "L3.H7 each hidden character is reported with its index and name the bidi control U+2069 POP DIRECTIONAL ISOLATE"; "L3.H7 indices are UTF-16 code units, in order every hidden character of a mixed text, in order". `test/host-links.test.ts`: 1 failed \| 21 passed (22). "L3.H6 refused: controls, white space and length the copy check's bidi controls and zero-width characters, anywhere, in every kind of link". | sha256 `e29884084c7c…` restored, equal |
| L3.H7e | drop a class: the zero-width characters | `src/host/copy.ts` | `  0x200b: 'ZERO WIDTH SPACE', ⏎   0x200c: 'ZERO WIDTH NON-JOINER', ⏎   0x200d: 'ZERO WIDTH JOINER', ⏎   0x2060: 'WORD JOINER', ⏎   0xfeff: 'ZERO WIDTH NO-BREAK SPACE', ⏎ ` → (removed) | `test/host-copy.test.ts`: 7 failed \| 32 passed (39). "L3.H7 each hidden character is reported with its index and name the zero-width character U+200B ZERO WIDTH SPACE"; "L3.H7 each hidden character is reported with its index and name the zero-width character U+200C ZERO WIDTH NON-JOINER"; "L3.H7 each hidden character is reported with its index and name the zero-width character U+200D ZERO WIDTH JOINER"; "L3.H7 each hidden character is reported with its index and name the zero-width character U+2060 WORD JOINER"; "L3.H7 each hidden character is reported with its index and name the zero-width character U+FEFF ZERO WIDTH NO-BREAK SPACE"; and 2 more. `test/host-links.test.ts`: 1 failed \| 21 passed (22). "L3.H6 refused: controls, white space and length the copy check's bidi controls and zero-width characters, anywhere, in every kind of link". | sha256 `e29884084c7c…` restored, equal |
| L3.H7f | report tab and newline as hidden | `src/host/copy.ts` | `return c === TAB \|\| c === NEWLINE ? null : (C0_NAMES[c] ?? null);` → `return C0_NAMES[c] ?? null;` | `test/host-copy.test.ts`: 2 failed \| 37 passed (39). "L3.H7 each hidden character is reported with its index and name every C0 control but tab and newline, each with a name of its own"; "L3.H7 what is not hidden clean text, tab, newline, ordinary non-ASCII and the marks beside the listed ranges give nothing". | sha256 `e29884084c7c…` restored, equal |
| L3.H7g | index by code points, not UTF-16 code units | `src/host/copy.ts` | `  const out: HiddenChar[] = []; ⏎   for (let i = 0; i < text.length; ) { ⏎     const c = text.codePointAt(i) ?? 0; ⏎     const name = hiddenName(c); ⏎     if (name !== null) out.push({ index: i, codePoint: c, name }); ⏎     i += c > 0xffff ? 2 : 1; ⏎   }` → `  const out: HiddenChar[] = []; ⏎   let i = -1; ⏎   for (const ch of text) { ⏎     i += 1; ⏎     const c = ch.codePointAt(0) ?? 0; ⏎     const name = hiddenName(c); ⏎     if (name !== null) out.push({ index: i, codePoint: c, name }); ⏎   }` | `test/host-copy.test.ts`: 4 failed \| 35 passed (39). "L3.H7 indices are UTF-16 code units, in order an astral character before a hidden one counts two"; "L3.H7 the tag characters, U+E0000 to U+E007F (ledger C103) the whole block: 128 entries in order, two code units apart, each with a name of its own"; "L3.H7 the tag characters, U+E0000 to U+E007F (ledger C103) the England flag: the flag is visible, its six tag characters are not"; "L3.H7 the walk is by code point (ledger C103) an index stays right after an astral visible character". | sha256 `e29884084c7c…` restored, equal |
| L3.H7h | drop a class: the directional marks (U+061C, U+200E, U+200F) | `src/host/copy.ts` | `  // directional marks (ledger C103) ⏎   0x061c: 'ARABIC LETTER MARK', ⏎   0x200e: 'LEFT-TO-RIGHT MARK', ⏎   0x200f: 'RIGHT-TO-LEFT MARK', ⏎ ` → (removed) | `test/host-copy.test.ts`: 8 failed \| 31 passed (39). "L3.H7 each hidden character is reported with its index and name the directional mark U+061C ARABIC LETTER MARK"; "L3.H7 each hidden character is reported with its index and name the directional mark U+200E LEFT-TO-RIGHT MARK"; "L3.H7 each hidden character is reported with its index and name the directional mark U+200F RIGHT-TO-LEFT MARK"; "L3.H7 the walk is by code point (ledger C103) an index stays right after an astral visible character"; "L3.H7 the walk is by code point (ledger C103) a lone high surrogate before a mark does not break the walk; alone it is not hidden"; and 3 more. `test/host-links.test.ts`: 2 failed \| 20 passed (22). "L3.H6 refused: controls, white space and length the copy check's directional marks and tag characters, anywhere, in every kind of link (ledger C103)"; "L3.H6 refused: controls, white space and length a mark right after U+FFFF (one code unit, no step of two) is refused (ledger C103)". | sha256 `e29884084c7c…` restored, equal |
| L3.H7i | drop a class: the tag block (U+E0000 to U+E007F) | `src/host/copy.ts` | `  if (c >= TAG_FIRST && c <= TAG_LAST) return tagName(c); ⏎ ` → (removed) | `test/host-copy.test.ts`: 7 failed \| 32 passed (39). "L3.H7 the tag characters, U+E0000 to U+E007F (ledger C103) LANGUAGE TAG and CANCEL TAG, each with its name"; "L3.H7 the tag characters, U+E0000 to U+E007F (ledger C103) the whole block: 128 entries in order, two code units apart, each with a name of its own"; "L3.H7 the tag characters, U+E0000 to U+E007F (ledger C103) the England flag: the flag is visible, its six tag characters are not"; "L3.H7 the tag names, all 95 of them, against a list derived apart from the source table (ledger C103) every U+E0020 to U+E007E is TAG plus the name of its ASCII twin"; "L3.H7 the walk is by code point (ledger C103) the step threshold: the mark after U+FFFF (one code unit) is not skipped"; and 2 more. `test/host-links.test.ts`: 1 failed \| 21 passed (22). "L3.H6 refused: controls, white space and length the copy check's directional marks and tag characters, anywhere, in every kind of link (ledger C103)". | sha256 `e29884084c7c…` restored, equal |
| L3.H7j | walk hiddenChars by code unit, not by code point | `src/host/copy.ts` | `    const c = text.codePointAt(i) ?? 0; ⏎     const name = hiddenName(c); ⏎     if (name !== null) out.push({ index: i, codePoint: c, name }); ⏎     i += c > 0xffff ? 2 : 1;` → `    const c = text.charCodeAt(i); ⏎     const name = hiddenName(c); ⏎     if (name !== null) out.push({ index: i, codePoint: c, name }); ⏎     i += 1;` | `test/host-copy.test.ts`: 6 failed \| 33 passed (39). "L3.H7 the tag characters, U+E0000 to U+E007F (ledger C103) LANGUAGE TAG and CANCEL TAG, each with its name"; "L3.H7 the tag characters, U+E0000 to U+E007F (ledger C103) the whole block: 128 entries in order, two code units apart, each with a name of its own"; "L3.H7 the tag characters, U+E0000 to U+E007F (ledger C103) the England flag: the flag is visible, its six tag characters are not"; "L3.H7 the tag names, all 95 of them, against a list derived apart from the source table (ledger C103) every U+E0020 to U+E007E is TAG plus the name of its ASCII twin"; "L3.H7 the walk is by code point (ledger C103) the step threshold: the mark after U+FFFF (one code unit) is not skipped"; and 1 more. | sha256 `e29884084c7c…` restored, equal |
| L3.H7k | walk hasHiddenChar by code unit, not by code point | `src/host/copy.ts` | `    const c = text.codePointAt(i) ?? 0; ⏎     if (hiddenName(c) !== null) return true; ⏎     i += c > 0xffff ? 2 : 1;` → `    const c = text.charCodeAt(i); ⏎     if (hiddenName(c) !== null) return true; ⏎     i += 1;` | `test/host-copy.test.ts`: 1 failed \| 38 passed (39). "L3.H7 hasHiddenChar is true for a directional mark and for a tag character, false for clean text". `test/host-links.test.ts`: 1 failed \| 21 passed (22). "L3.H6 refused: controls, white space and length the copy check's directional marks and tag characters, anywhere, in every kind of link (ledger C103)". | sha256 `e29884084c7c…` restored, equal |
| L3.H7l | off by one: the tag block without its upper bound (U+E007F) | `src/host/copy.ts` | `c >= TAG_FIRST && c <= TAG_LAST` → `c >= TAG_FIRST && c < TAG_LAST` | `test/host-copy.test.ts`: 4 failed \| 35 passed (39). "L3.H7 the tag characters, U+E0000 to U+E007F (ledger C103) LANGUAGE TAG and CANCEL TAG, each with its name"; "L3.H7 the tag characters, U+E0000 to U+E007F (ledger C103) the whole block: 128 entries in order, two code units apart, each with a name of its own"; "L3.H7 the tag characters, U+E0000 to U+E007F (ledger C103) the England flag: the flag is visible, its six tag characters are not"; "L3.H7 hasHiddenChar is true for a directional mark and for a tag character, false for clean text". | sha256 `e29884084c7c…` restored, equal |
| L3.H7m | off by one: the tag block without its lower bound (U+E0000) | `src/host/copy.ts` | `c >= TAG_FIRST && c <= TAG_LAST` → `c > TAG_FIRST && c <= TAG_LAST` | `test/host-copy.test.ts`: 1 failed \| 38 passed (39). "L3.H7 the tag characters, U+E0000 to U+E007F (ledger C103) the whole block: 128 entries in order, two code units apart, each with a name of its own". | sha256 `e29884084c7c…` restored, equal |
| L3.H7n | name U+E0001 by the code point label, not LANGUAGE TAG | `src/host/copy.ts` | `  if (c === TAG_LANGUAGE) return 'LANGUAGE TAG'; ⏎ ` → (removed) | `test/host-copy.test.ts`: 1 failed \| 38 passed (39). "L3.H7 the tag characters, U+E0000 to U+E007F (ledger C103) LANGUAGE TAG and CANCEL TAG, each with its name". | sha256 `e29884084c7c…` restored, equal |
| L3.H7o | name U+E007F by the code point label, not CANCEL TAG | `src/host/copy.ts` | `  if (c === TAG_CANCEL) return 'CANCEL TAG'; ⏎ ` → (removed) | `test/host-copy.test.ts`: 2 failed \| 37 passed (39). "L3.H7 the tag characters, U+E0000 to U+E007F (ledger C103) LANGUAGE TAG and CANCEL TAG, each with its name"; "L3.H7 the tag characters, U+E0000 to U+E007F (ledger C103) the England flag: the flag is visible, its six tag characters are not". | sha256 `e29884084c7c…` restored, equal |
| L3.H7p | write the code point label of an unassigned tag in lower case | `src/host/copy.ts` | `c.toString(16).toUpperCase().padStart(5, '0')` → `c.toString(16).padStart(5, '0')` | `test/host-copy.test.ts`: 1 failed \| 38 passed (39). "L3.H7 the tag characters, U+E0000 to U+E007F (ledger C103) the whole block: 128 entries in order, two code units apart, each with a name of its own". | sha256 `e29884084c7c…` restored, equal |
| L3.H7q | step threshold: hiddenChars steps two from U+FFFF (>= 0xffff) | `src/host/copy.ts` | `    if (name !== null) out.push({ index: i, codePoint: c, name }); ⏎     i += c > 0xffff ? 2 : 1;` → `    if (name !== null) out.push({ index: i, codePoint: c, name }); ⏎     i += c >= 0xffff ? 2 : 1;` | `test/host-copy.test.ts`: 1 failed \| 38 passed (39). "L3.H7 the walk is by code point (ledger C103) the step threshold: the mark after U+FFFF (one code unit) is not skipped". | sha256 `e29884084c7c…` restored, equal |
| L3.H7r | step threshold: hasHiddenChar steps two from U+FFFF (>= 0xffff) | `src/host/copy.ts` | `    if (hiddenName(c) !== null) return true; ⏎     i += c > 0xffff ? 2 : 1;` → `    if (hiddenName(c) !== null) return true; ⏎     i += c >= 0xffff ? 2 : 1;` | `test/host-copy.test.ts`: 1 failed \| 38 passed (39). "L3.H7 hasHiddenChar the step threshold: the mark after U+FFFF (one code unit) is seen". `test/host-links.test.ts`: 1 failed \| 21 passed (22). "L3.H6 refused: controls, white space and length a mark right after U+FFFF (one code unit, no step of two) is refused (ledger C103)". | sha256 `e29884084c7c…` restored, equal |
| L3.H7s | swap two names of the ASCII table (LATIN SMALL LETTER C and D) | `src/host/copy.ts` | `'LATIN SMALL LETTER C', 'LATIN SMALL LETTER D'` → `'LATIN SMALL LETTER D', 'LATIN SMALL LETTER C'` | `test/host-copy.test.ts`: 1 failed \| 38 passed (39). "L3.H7 the tag names, all 95 of them, against a list derived apart from the source table (ledger C103) every U+E0020 to U+E007E is TAG plus the name of its ASCII twin". | sha256 `e29884084c7c…` restored, equal |
| L3.H7c1 | the C1 controls are hidden | `src/host/copy.ts` | `  if (c >= 0x80 && c <= 0x9f) return C1_NAMES[c - 0x80] ?? null; ⏎ ` → (removed) | `test/host-copy.test.ts`: 2 failed \| 37 passed (39). "L3.H7 the C1 controls are hidden too (ledger C88) CSI, the one-code-point form of ESC [, is reported by name"; "L3.H7 the C1 controls are hidden too (ledger C88) every C1 control, U+0080 to U+009F, each with a name of its own". `test/host-links.test.ts`: stays green (22 passed (22)). | sha256 `e29884084c7c…` restored, equal |

```json
[
  {
    "id": "L3.H7a",
    "guard": "drop a class: C0 controls (ESC among them)",
    "file": "src/host/copy.ts",
    "old": "  if (c < 0x20) return c === TAB || c === NEWLINE ? null : (C0_NAMES[c] ?? null);",
    "new": "  if (c < 0x20) return null;",
    "tests": "test/host-copy.test.ts",
    "rc": 1,
    "red": "test/host-copy.test.ts: 4 failed | 35 passed (39)",
    "failing": [
      "test/host-copy.test.ts: L3.H7 each hidden character is reported with its index and name ESC",
      "test/host-copy.test.ts: L3.H7 each hidden character is reported with its index and name DEL, NUL, BEL, BACKSPACE, VT, FF and CR",
      "test/host-copy.test.ts: L3.H7 each hidden character is reported with its index and name every C0 control but tab and newline, each with a name of its own",
      "test/host-copy.test.ts: L3.H7 indices are UTF-16 code units, in order every hidden character of a mixed text, in order"
    ],
    "assertionErrorsOnly": true,
    "sha256": "e29884084c7c6759415868c7b648c5b20846ab99c9f759bc858add63de62f2d5",
    "restored": true
  },
  {
    "id": "L3.H7b",
    "guard": "drop a class: DEL",
    "file": "src/host/copy.ts",
    "old": "  0x7f: 'DELETE',\n",
    "new": "",
    "tests": "test/host-copy.test.ts",
    "rc": 1,
    "red": "test/host-copy.test.ts: 1 failed | 38 passed (39)",
    "failing": [
      "test/host-copy.test.ts: L3.H7 each hidden character is reported with its index and name DEL, NUL, BEL, BACKSPACE, VT, FF and CR"
    ],
    "assertionErrorsOnly": true,
    "sha256": "e29884084c7c6759415868c7b648c5b20846ab99c9f759bc858add63de62f2d5",
    "restored": true
  },
  {
    "id": "L3.H7c",
    "guard": "drop a class: the bidi embeddings and overrides (U+202A to U+202E)",
    "file": "src/host/copy.ts",
    "old": "  0x202a: 'LEFT-TO-RIGHT EMBEDDING',\n  0x202b: 'RIGHT-TO-LEFT EMBEDDING',\n  0x202c: 'POP DIRECTIONAL FORMATTING',\n  0x202d: 'LEFT-TO-RIGHT OVERRIDE',\n  0x202e: 'RIGHT-TO-LEFT OVERRIDE',\n",
    "new": "",
    "tests": "test/host-copy.test.ts test/host-links.test.ts",
    "rc": 1,
    "red": "test/host-copy.test.ts: 6 failed | 33 passed (39); test/host-links.test.ts: 1 failed | 21 passed (22)",
    "failing": [
      "test/host-copy.test.ts: L3.H7 each hidden character is reported with its index and name the bidi control U+202A LEFT-TO-RIGHT EMBEDDING",
      "test/host-copy.test.ts: L3.H7 each hidden character is reported with its index and name the bidi control U+202B RIGHT-TO-LEFT EMBEDDING",
      "test/host-copy.test.ts: L3.H7 each hidden character is reported with its index and name the bidi control U+202C POP DIRECTIONAL FORMATTING",
      "test/host-copy.test.ts: L3.H7 each hidden character is reported with its index and name the bidi control U+202D LEFT-TO-RIGHT OVERRIDE",
      "test/host-copy.test.ts: L3.H7 each hidden character is reported with its index and name the bidi control U+202E RIGHT-TO-LEFT OVERRIDE",
      "test/host-copy.test.ts: L3.H7 indices are UTF-16 code units, in order every hidden character of a mixed text, in order",
      "test/host-links.test.ts: L3.H6 refused: controls, white space and length the copy check's bidi controls and zero-width characters, anywhere, in every kind of link"
    ],
    "assertionErrorsOnly": true,
    "sha256": "e29884084c7c6759415868c7b648c5b20846ab99c9f759bc858add63de62f2d5",
    "restored": true
  },
  {
    "id": "L3.H7d",
    "guard": "drop a class: the bidi isolates (U+2066 to U+2069)",
    "file": "src/host/copy.ts",
    "old": "  0x2066: 'LEFT-TO-RIGHT ISOLATE',\n  0x2067: 'RIGHT-TO-LEFT ISOLATE',\n  0x2068: 'FIRST STRONG ISOLATE',\n  0x2069: 'POP DIRECTIONAL ISOLATE',\n",
    "new": "",
    "tests": "test/host-copy.test.ts test/host-links.test.ts",
    "rc": 1,
    "red": "test/host-copy.test.ts: 5 failed | 34 passed (39); test/host-links.test.ts: 1 failed | 21 passed (22)",
    "failing": [
      "test/host-copy.test.ts: L3.H7 each hidden character is reported with its index and name the bidi control U+2066 LEFT-TO-RIGHT ISOLATE",
      "test/host-copy.test.ts: L3.H7 each hidden character is reported with its index and name the bidi control U+2067 RIGHT-TO-LEFT ISOLATE",
      "test/host-copy.test.ts: L3.H7 each hidden character is reported with its index and name the bidi control U+2068 FIRST STRONG ISOLATE",
      "test/host-copy.test.ts: L3.H7 each hidden character is reported with its index and name the bidi control U+2069 POP DIRECTIONAL ISOLATE",
      "test/host-copy.test.ts: L3.H7 indices are UTF-16 code units, in order every hidden character of a mixed text, in order",
      "test/host-links.test.ts: L3.H6 refused: controls, white space and length the copy check's bidi controls and zero-width characters, anywhere, in every kind of link"
    ],
    "assertionErrorsOnly": true,
    "sha256": "e29884084c7c6759415868c7b648c5b20846ab99c9f759bc858add63de62f2d5",
    "restored": true
  },
  {
    "id": "L3.H7e",
    "guard": "drop a class: the zero-width characters",
    "file": "src/host/copy.ts",
    "old": "  0x200b: 'ZERO WIDTH SPACE',\n  0x200c: 'ZERO WIDTH NON-JOINER',\n  0x200d: 'ZERO WIDTH JOINER',\n  0x2060: 'WORD JOINER',\n  0xfeff: 'ZERO WIDTH NO-BREAK SPACE',\n",
    "new": "",
    "tests": "test/host-copy.test.ts test/host-links.test.ts",
    "rc": 1,
    "red": "test/host-copy.test.ts: 7 failed | 32 passed (39); test/host-links.test.ts: 1 failed | 21 passed (22)",
    "failing": [
      "test/host-copy.test.ts: L3.H7 each hidden character is reported with its index and name the zero-width character U+200B ZERO WIDTH SPACE",
      "test/host-copy.test.ts: L3.H7 each hidden character is reported with its index and name the zero-width character U+200C ZERO WIDTH NON-JOINER",
      "test/host-copy.test.ts: L3.H7 each hidden character is reported with its index and name the zero-width character U+200D ZERO WIDTH JOINER",
      "test/host-copy.test.ts: L3.H7 each hidden character is reported with its index and name the zero-width character U+2060 WORD JOINER",
      "test/host-copy.test.ts: L3.H7 each hidden character is reported with its index and name the zero-width character U+FEFF ZERO WIDTH NO-BREAK SPACE",
      "test/host-copy.test.ts: L3.H7 indices are UTF-16 code units, in order an astral character before a hidden one counts two",
      "test/host-copy.test.ts: L3.H7 indices are UTF-16 code units, in order every hidden character of a mixed text, in order",
      "test/host-links.test.ts: L3.H6 refused: controls, white space and length the copy check's bidi controls and zero-width characters, anywhere, in every kind of link"
    ],
    "assertionErrorsOnly": true,
    "sha256": "e29884084c7c6759415868c7b648c5b20846ab99c9f759bc858add63de62f2d5",
    "restored": true
  },
  {
    "id": "L3.H7f",
    "guard": "report tab and newline as hidden",
    "file": "src/host/copy.ts",
    "old": "return c === TAB || c === NEWLINE ? null : (C0_NAMES[c] ?? null);",
    "new": "return C0_NAMES[c] ?? null;",
    "tests": "test/host-copy.test.ts",
    "rc": 1,
    "red": "test/host-copy.test.ts: 2 failed | 37 passed (39)",
    "failing": [
      "test/host-copy.test.ts: L3.H7 each hidden character is reported with its index and name every C0 control but tab and newline, each with a name of its own",
      "test/host-copy.test.ts: L3.H7 what is not hidden clean text, tab, newline, ordinary non-ASCII and the marks beside the listed ranges give nothing"
    ],
    "assertionErrorsOnly": true,
    "sha256": "e29884084c7c6759415868c7b648c5b20846ab99c9f759bc858add63de62f2d5",
    "restored": true
  },
  {
    "id": "L3.H7g",
    "guard": "index by code points, not UTF-16 code units",
    "file": "src/host/copy.ts",
    "old": "  const out: HiddenChar[] = [];\n  for (let i = 0; i < text.length; ) {\n    const c = text.codePointAt(i) ?? 0;\n    const name = hiddenName(c);\n    if (name !== null) out.push({ index: i, codePoint: c, name });\n    i += c > 0xffff ? 2 : 1;\n  }",
    "new": "  const out: HiddenChar[] = [];\n  let i = -1;\n  for (const ch of text) {\n    i += 1;\n    const c = ch.codePointAt(0) ?? 0;\n    const name = hiddenName(c);\n    if (name !== null) out.push({ index: i, codePoint: c, name });\n  }",
    "tests": "test/host-copy.test.ts",
    "rc": 1,
    "red": "test/host-copy.test.ts: 4 failed | 35 passed (39)",
    "failing": [
      "test/host-copy.test.ts: L3.H7 indices are UTF-16 code units, in order an astral character before a hidden one counts two",
      "test/host-copy.test.ts: L3.H7 the tag characters, U+E0000 to U+E007F (ledger C103) the whole block: 128 entries in order, two code units apart, each with a name of its own",
      "test/host-copy.test.ts: L3.H7 the tag characters, U+E0000 to U+E007F (ledger C103) the England flag: the flag is visible, its six tag characters are not",
      "test/host-copy.test.ts: L3.H7 the walk is by code point (ledger C103) an index stays right after an astral visible character"
    ],
    "assertionErrorsOnly": true,
    "sha256": "e29884084c7c6759415868c7b648c5b20846ab99c9f759bc858add63de62f2d5",
    "restored": true
  },
  {
    "id": "L3.H7h",
    "guard": "drop a class: the directional marks (U+061C, U+200E, U+200F)",
    "file": "src/host/copy.ts",
    "old": "  // directional marks (ledger C103)\n  0x061c: 'ARABIC LETTER MARK',\n  0x200e: 'LEFT-TO-RIGHT MARK',\n  0x200f: 'RIGHT-TO-LEFT MARK',\n",
    "new": "",
    "tests": "test/host-copy.test.ts test/host-links.test.ts",
    "rc": 1,
    "red": "test/host-copy.test.ts: 8 failed | 31 passed (39); test/host-links.test.ts: 2 failed | 20 passed (22)",
    "failing": [
      "test/host-copy.test.ts: L3.H7 each hidden character is reported with its index and name the directional mark U+061C ARABIC LETTER MARK",
      "test/host-copy.test.ts: L3.H7 each hidden character is reported with its index and name the directional mark U+200E LEFT-TO-RIGHT MARK",
      "test/host-copy.test.ts: L3.H7 each hidden character is reported with its index and name the directional mark U+200F RIGHT-TO-LEFT MARK",
      "test/host-copy.test.ts: L3.H7 the walk is by code point (ledger C103) an index stays right after an astral visible character",
      "test/host-copy.test.ts: L3.H7 the walk is by code point (ledger C103) a lone high surrogate before a mark does not break the walk; alone it is not hidden",
      "test/host-copy.test.ts: L3.H7 the walk is by code point (ledger C103) the step threshold: the mark after U+FFFF (one code unit) is not skipped",
      "test/host-copy.test.ts: L3.H7 hasHiddenChar is true for a directional mark and for a tag character, false for clean text",
      "test/host-copy.test.ts: L3.H7 hasHiddenChar the step threshold: the mark after U+FFFF (one code unit) is seen",
      "test/host-links.test.ts: L3.H6 refused: controls, white space and length the copy check's directional marks and tag characters, anywhere, in every kind of link (ledger C103)",
      "test/host-links.test.ts: L3.H6 refused: controls, white space and length a mark right after U+FFFF (one code unit, no step of two) is refused (ledger C103)"
    ],
    "assertionErrorsOnly": true,
    "sha256": "e29884084c7c6759415868c7b648c5b20846ab99c9f759bc858add63de62f2d5",
    "restored": true
  },
  {
    "id": "L3.H7i",
    "guard": "drop a class: the tag block (U+E0000 to U+E007F)",
    "file": "src/host/copy.ts",
    "old": "  if (c >= TAG_FIRST && c <= TAG_LAST) return tagName(c);\n",
    "new": "",
    "tests": "test/host-copy.test.ts test/host-links.test.ts",
    "rc": 1,
    "red": "test/host-copy.test.ts: 7 failed | 32 passed (39); test/host-links.test.ts: 1 failed | 21 passed (22)",
    "failing": [
      "test/host-copy.test.ts: L3.H7 the tag characters, U+E0000 to U+E007F (ledger C103) LANGUAGE TAG and CANCEL TAG, each with its name",
      "test/host-copy.test.ts: L3.H7 the tag characters, U+E0000 to U+E007F (ledger C103) the whole block: 128 entries in order, two code units apart, each with a name of its own",
      "test/host-copy.test.ts: L3.H7 the tag characters, U+E0000 to U+E007F (ledger C103) the England flag: the flag is visible, its six tag characters are not",
      "test/host-copy.test.ts: L3.H7 the tag names, all 95 of them, against a list derived apart from the source table (ledger C103) every U+E0020 to U+E007E is TAG plus the name of its ASCII twin",
      "test/host-copy.test.ts: L3.H7 the walk is by code point (ledger C103) the step threshold: the mark after U+FFFF (one code unit) is not skipped",
      "test/host-copy.test.ts: L3.H7 the walk is by code point (ledger C103) a lone high surrogate before a tag character reads as that tag character after the surrogate",
      "test/host-copy.test.ts: L3.H7 hasHiddenChar is true for a directional mark and for a tag character, false for clean text",
      "test/host-links.test.ts: L3.H6 refused: controls, white space and length the copy check's directional marks and tag characters, anywhere, in every kind of link (ledger C103)"
    ],
    "assertionErrorsOnly": true,
    "sha256": "e29884084c7c6759415868c7b648c5b20846ab99c9f759bc858add63de62f2d5",
    "restored": true
  },
  {
    "id": "L3.H7j",
    "guard": "walk hiddenChars by code unit, not by code point",
    "file": "src/host/copy.ts",
    "old": "    const c = text.codePointAt(i) ?? 0;\n    const name = hiddenName(c);\n    if (name !== null) out.push({ index: i, codePoint: c, name });\n    i += c > 0xffff ? 2 : 1;",
    "new": "    const c = text.charCodeAt(i);\n    const name = hiddenName(c);\n    if (name !== null) out.push({ index: i, codePoint: c, name });\n    i += 1;",
    "tests": "test/host-copy.test.ts",
    "rc": 1,
    "red": "test/host-copy.test.ts: 6 failed | 33 passed (39)",
    "failing": [
      "test/host-copy.test.ts: L3.H7 the tag characters, U+E0000 to U+E007F (ledger C103) LANGUAGE TAG and CANCEL TAG, each with its name",
      "test/host-copy.test.ts: L3.H7 the tag characters, U+E0000 to U+E007F (ledger C103) the whole block: 128 entries in order, two code units apart, each with a name of its own",
      "test/host-copy.test.ts: L3.H7 the tag characters, U+E0000 to U+E007F (ledger C103) the England flag: the flag is visible, its six tag characters are not",
      "test/host-copy.test.ts: L3.H7 the tag names, all 95 of them, against a list derived apart from the source table (ledger C103) every U+E0020 to U+E007E is TAG plus the name of its ASCII twin",
      "test/host-copy.test.ts: L3.H7 the walk is by code point (ledger C103) the step threshold: the mark after U+FFFF (one code unit) is not skipped",
      "test/host-copy.test.ts: L3.H7 the walk is by code point (ledger C103) a lone high surrogate before a tag character reads as that tag character after the surrogate"
    ],
    "assertionErrorsOnly": true,
    "sha256": "e29884084c7c6759415868c7b648c5b20846ab99c9f759bc858add63de62f2d5",
    "restored": true
  },
  {
    "id": "L3.H7k",
    "guard": "walk hasHiddenChar by code unit, not by code point",
    "file": "src/host/copy.ts",
    "old": "    const c = text.codePointAt(i) ?? 0;\n    if (hiddenName(c) !== null) return true;\n    i += c > 0xffff ? 2 : 1;",
    "new": "    const c = text.charCodeAt(i);\n    if (hiddenName(c) !== null) return true;\n    i += 1;",
    "tests": "test/host-copy.test.ts test/host-links.test.ts",
    "rc": 1,
    "red": "test/host-copy.test.ts: 1 failed | 38 passed (39); test/host-links.test.ts: 1 failed | 21 passed (22)",
    "failing": [
      "test/host-copy.test.ts: L3.H7 hasHiddenChar is true for a directional mark and for a tag character, false for clean text",
      "test/host-links.test.ts: L3.H6 refused: controls, white space and length the copy check's directional marks and tag characters, anywhere, in every kind of link (ledger C103)"
    ],
    "assertionErrorsOnly": true,
    "sha256": "e29884084c7c6759415868c7b648c5b20846ab99c9f759bc858add63de62f2d5",
    "restored": true
  },
  {
    "id": "L3.H7l",
    "guard": "off by one: the tag block without its upper bound (U+E007F)",
    "file": "src/host/copy.ts",
    "old": "c >= TAG_FIRST && c <= TAG_LAST",
    "new": "c >= TAG_FIRST && c < TAG_LAST",
    "tests": "test/host-copy.test.ts",
    "rc": 1,
    "red": "test/host-copy.test.ts: 4 failed | 35 passed (39)",
    "failing": [
      "test/host-copy.test.ts: L3.H7 the tag characters, U+E0000 to U+E007F (ledger C103) LANGUAGE TAG and CANCEL TAG, each with its name",
      "test/host-copy.test.ts: L3.H7 the tag characters, U+E0000 to U+E007F (ledger C103) the whole block: 128 entries in order, two code units apart, each with a name of its own",
      "test/host-copy.test.ts: L3.H7 the tag characters, U+E0000 to U+E007F (ledger C103) the England flag: the flag is visible, its six tag characters are not",
      "test/host-copy.test.ts: L3.H7 hasHiddenChar is true for a directional mark and for a tag character, false for clean text"
    ],
    "assertionErrorsOnly": true,
    "sha256": "e29884084c7c6759415868c7b648c5b20846ab99c9f759bc858add63de62f2d5",
    "restored": true
  },
  {
    "id": "L3.H7m",
    "guard": "off by one: the tag block without its lower bound (U+E0000)",
    "file": "src/host/copy.ts",
    "old": "c >= TAG_FIRST && c <= TAG_LAST",
    "new": "c > TAG_FIRST && c <= TAG_LAST",
    "tests": "test/host-copy.test.ts",
    "rc": 1,
    "red": "test/host-copy.test.ts: 1 failed | 38 passed (39)",
    "failing": [
      "test/host-copy.test.ts: L3.H7 the tag characters, U+E0000 to U+E007F (ledger C103) the whole block: 128 entries in order, two code units apart, each with a name of its own"
    ],
    "assertionErrorsOnly": true,
    "sha256": "e29884084c7c6759415868c7b648c5b20846ab99c9f759bc858add63de62f2d5",
    "restored": true
  },
  {
    "id": "L3.H7n",
    "guard": "name U+E0001 by the code point label, not LANGUAGE TAG",
    "file": "src/host/copy.ts",
    "old": "  if (c === TAG_LANGUAGE) return 'LANGUAGE TAG';\n",
    "new": "",
    "tests": "test/host-copy.test.ts",
    "rc": 1,
    "red": "test/host-copy.test.ts: 1 failed | 38 passed (39)",
    "failing": [
      "test/host-copy.test.ts: L3.H7 the tag characters, U+E0000 to U+E007F (ledger C103) LANGUAGE TAG and CANCEL TAG, each with its name"
    ],
    "assertionErrorsOnly": true,
    "sha256": "e29884084c7c6759415868c7b648c5b20846ab99c9f759bc858add63de62f2d5",
    "restored": true
  },
  {
    "id": "L3.H7o",
    "guard": "name U+E007F by the code point label, not CANCEL TAG",
    "file": "src/host/copy.ts",
    "old": "  if (c === TAG_CANCEL) return 'CANCEL TAG';\n",
    "new": "",
    "tests": "test/host-copy.test.ts",
    "rc": 1,
    "red": "test/host-copy.test.ts: 2 failed | 37 passed (39)",
    "failing": [
      "test/host-copy.test.ts: L3.H7 the tag characters, U+E0000 to U+E007F (ledger C103) LANGUAGE TAG and CANCEL TAG, each with its name",
      "test/host-copy.test.ts: L3.H7 the tag characters, U+E0000 to U+E007F (ledger C103) the England flag: the flag is visible, its six tag characters are not"
    ],
    "assertionErrorsOnly": true,
    "sha256": "e29884084c7c6759415868c7b648c5b20846ab99c9f759bc858add63de62f2d5",
    "restored": true
  },
  {
    "id": "L3.H7p",
    "guard": "write the code point label of an unassigned tag in lower case",
    "file": "src/host/copy.ts",
    "old": "c.toString(16).toUpperCase().padStart(5, '0')",
    "new": "c.toString(16).padStart(5, '0')",
    "tests": "test/host-copy.test.ts",
    "rc": 1,
    "red": "test/host-copy.test.ts: 1 failed | 38 passed (39)",
    "failing": [
      "test/host-copy.test.ts: L3.H7 the tag characters, U+E0000 to U+E007F (ledger C103) the whole block: 128 entries in order, two code units apart, each with a name of its own"
    ],
    "assertionErrorsOnly": true,
    "sha256": "e29884084c7c6759415868c7b648c5b20846ab99c9f759bc858add63de62f2d5",
    "restored": true
  },
  {
    "id": "L3.H7q",
    "guard": "step threshold: hiddenChars steps two from U+FFFF (>= 0xffff)",
    "file": "src/host/copy.ts",
    "old": "    if (name !== null) out.push({ index: i, codePoint: c, name });\n    i += c > 0xffff ? 2 : 1;",
    "new": "    if (name !== null) out.push({ index: i, codePoint: c, name });\n    i += c >= 0xffff ? 2 : 1;",
    "tests": "test/host-copy.test.ts",
    "rc": 1,
    "red": "test/host-copy.test.ts: 1 failed | 38 passed (39)",
    "failing": [
      "test/host-copy.test.ts: L3.H7 the walk is by code point (ledger C103) the step threshold: the mark after U+FFFF (one code unit) is not skipped"
    ],
    "assertionErrorsOnly": true,
    "sha256": "e29884084c7c6759415868c7b648c5b20846ab99c9f759bc858add63de62f2d5",
    "restored": true
  },
  {
    "id": "L3.H7r",
    "guard": "step threshold: hasHiddenChar steps two from U+FFFF (>= 0xffff)",
    "file": "src/host/copy.ts",
    "old": "    if (hiddenName(c) !== null) return true;\n    i += c > 0xffff ? 2 : 1;",
    "new": "    if (hiddenName(c) !== null) return true;\n    i += c >= 0xffff ? 2 : 1;",
    "tests": "test/host-copy.test.ts test/host-links.test.ts",
    "rc": 1,
    "red": "test/host-copy.test.ts: 1 failed | 38 passed (39); test/host-links.test.ts: 1 failed | 21 passed (22)",
    "failing": [
      "test/host-copy.test.ts: L3.H7 hasHiddenChar the step threshold: the mark after U+FFFF (one code unit) is seen",
      "test/host-links.test.ts: L3.H6 refused: controls, white space and length a mark right after U+FFFF (one code unit, no step of two) is refused (ledger C103)"
    ],
    "assertionErrorsOnly": true,
    "sha256": "e29884084c7c6759415868c7b648c5b20846ab99c9f759bc858add63de62f2d5",
    "restored": true
  },
  {
    "id": "L3.H7s",
    "guard": "swap two names of the ASCII table (LATIN SMALL LETTER C and D)",
    "file": "src/host/copy.ts",
    "old": "'LATIN SMALL LETTER C', 'LATIN SMALL LETTER D'",
    "new": "'LATIN SMALL LETTER D', 'LATIN SMALL LETTER C'",
    "tests": "test/host-copy.test.ts",
    "rc": 1,
    "red": "test/host-copy.test.ts: 1 failed | 38 passed (39)",
    "failing": [
      "test/host-copy.test.ts: L3.H7 the tag names, all 95 of them, against a list derived apart from the source table (ledger C103) every U+E0020 to U+E007E is TAG plus the name of its ASCII twin"
    ],
    "assertionErrorsOnly": true,
    "sha256": "e29884084c7c6759415868c7b648c5b20846ab99c9f759bc858add63de62f2d5",
    "restored": true
  },
  {
    "id": "L3.H7c1",
    "guard": "the C1 controls are hidden",
    "file": "src/host/copy.ts",
    "old": "  if (c >= 0x80 && c <= 0x9f) return C1_NAMES[c - 0x80] ?? null;\n",
    "new": "",
    "tests": "test/host-copy.test.ts test/host-links.test.ts",
    "rc": 1,
    "red": "test/host-copy.test.ts: 2 failed | 37 passed (39); test/host-links.test.ts: 0 failed | 22 passed (22)",
    "failing": [
      "test/host-copy.test.ts: L3.H7 the C1 controls are hidden too (ledger C88) CSI, the one-code-point form of ESC [, is reported by name",
      "test/host-copy.test.ts: L3.H7 the C1 controls are hidden too (ledger C88) every C1 control, U+0080 to U+009F, each with a name of its own"
    ],
    "assertionErrorsOnly": true,
    "sha256": "e29884084c7c6759415868c7b648c5b20846ab99c9f759bc858add63de62f2d5",
    "restored": true
  }
]
```
