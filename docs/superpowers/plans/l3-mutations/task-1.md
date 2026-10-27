# L3 Task 1: mutation rows (protocol single definition, fragment grammar, DOC_FIELDS)

Each guard of Task 1, changed once, with the tests that go red: the fragment grammar (`src/frame/fragment.ts`), the
DOC_FIELDS generator and its committed output (`scripts/gen-doc-fields.mjs`, `src/frame/doc-fields.generated.ts`), the
bridge limits, `./frame`'s public surface and the prefs' values (`src/frame/protocol.ts`, `src/frame/index.ts`), the
DOM-free copies of L2's shapes (`src/frame/wire-types.ts`) and a bridge case's stated size
(`conformance/bridge-cases.json`). Measured 2026-10-27 (UTC) on branch `l3-t01-protocol`, on the Task 1 tree after its
review fix round (base `836edc1`, the Task 1 changes not yet committed). Every row was measured again on that tree, the
fourteen of the first round included, because the fix round changed each row's test file.

**Result.** 49 rows, 48 red: every red vitest row exits 1 through failing assertions only, and every type-level row exits 2 with its errors at the pinning test's `expectTypeOf` lines alone. One row stays green, L3.M11y, an equivalent mutant argued below and waiting on the coordinator's C-ruling.

**Method** (Global Constraints, "Low disk"; C69, C75). One row at a time, in place in the task's own worktree, never
in parallel and never in a copy of the repository. For each row: the file's original bytes and their sha256 were
saved outside the worktree; `old` was checked to occur exactly once and replaced by `new`; the thread count was
measured (`ps -L -u "$(id -u)" --no-headers | wc -l`, 1758 to 2002 over the runs) and the row ran as
`ulimit -u <threads + 1500>; timeout -k 10 600 <command>`, its output captured to a log, the command being
`./node_modules/.bin/vitest run --maxWorkers=2 <tests>` (or, for a type-level row, the named `tsc` project); the file was
then restored from the saved bytes and its sha256 checked equal to the saved one (never `git checkout`). Every restore
matched, and after the last row `sha256sum -c` over every file a row touches, and over the frame build's two committed
outputs and the generated DOC_FIELDS file, matched the hashes taken before the first. No row needs a rebuild: the only
mutated input of the frame build is `src/frame/protocol.ts`, whose rows run only tests that read the source, and
`node scripts/build-frame.mjs --check` is green on the restored tree. A vitest row counts as red only when the run
exits 1 and every failing test failed through an `AssertionError` (none through a file that failed to load, an
unhandled error or a timeout). The Red column gives the count line and the failing tests the run printed (at most five
here). In the Change column a raw character a row writes is shown as `<U+XXXX>`; the JSON fence holds the exact text.

Notes on the measurement.
- L3.M10a, L3.M10b and L3.M10c each also redden the exact-source pin ("is the frozen source...") and the one-home
  scan's control (its pattern needs the whole class with its four punctuation marks). Each is red through behaviour as
  well: a footnote back-reference and corpus ids (`:`), `D2.1a` and the generated ID shapes (`.`), a decomposed letter
  (`\p{M}`). L3.M10h pins that the decomposed letter stays decomposed, so L3.M10c cannot lose that witness to an NFC
  rewrite of the test file.
- L3.M11a adds the call to `src/enhance/since.ts`, the scanned tree, not to a fixture: the plan's row is "add
  `writeDoc('x')` without regenerating", and only the real tree has a committed output that can fall behind. A call added
  to a fixture is covered by the fixture's exact field list instead.
- Two rows are red through the failure's reason only, because the generator still fails closed without the guard:
  L3.M11l (without the spread check at the call, a spread fails as "an expression the generator does not follow
  (SpreadElement)") and L3.M11o (without the destructured-binding refusal, a destructured name fails at the catch-all
  that L3.M11p pins). Each check stays for its clearer reason. L3.M11m is different: without it,
  `save(...head, 'shown')` resolves `shown` while the field at run time is `hidden`, so the call is credited with the
  wrong field and nothing fails.
- Three rows are red through the generator crashing instead of reporting: L3.M11q (a binding cycle recurses until the
  stack overflows), L3.M11w (a call with no argument) and L3.M11x (a parameter of an anonymous callback). The fixture
  rows assert that the generator reports and never throws (`expect(...).not.toThrow()`), so each crash is an assertion
  failure, and the CLI would exit 1 with a stack trace rather than a file and line.
- The destructured-parameter refusal moved in the fix round. It was the first half of
  `!ts.isIdentifier(decl.name) || decl.dotDotDotToken !== undefined` in the parameter branch, which no input can reach:
  the checker resolves a name bound by a destructuring pattern to its binding element, never to the parameter. It is now
  `ts.isBindingElement(decl)`, checked before the const and parameter branches, where a destructured parameter (and a
  destructured const) arrives; the parameter branch keeps the rest-parameter half.
- **L3.M11y, an equivalent mutant (for the coordinator's C-ruling).** `if (wrapper === undefined) throw ...` cannot be
  reached: the wrapper's name is the declared name of a function declaration or of a const, and the checker always gives
  a declared name its symbol. Removing the line leaves every test green, and no input can tell the two apart. It stays
  as a defence: were the symbol ever missing, `callSites` would match every identifier that has none.
- The type-level rows (L3.P1c to L3.P1g) are red as compile errors, by nature; see their section.

## The fragment grammar: `src/frame/fragment.ts` (L3.M10a to L3.M10h)

The grammar of Reference §9 (ruling R1): its colon, dot and marks, its length in code units, its width beyond the anchor grammar, and its one home. L3.M10g and L3.M10h are the fix round's: ruling R6's raw-character scan, and the decomposed letter that is L3.M10c's behavioural witness.

| Row | Guard | File | Change | Red | Restore |
|---|---|---|---|---|---|
| L3.M10a | the grammar admits ':' (footnote back-reference ids) | `src/frame/fragment.ts` | `source: '^[\\p{L}\\p{M}\\p{N}_.:-]+$',` → `source: '^[\\p{L}\\p{M}\\p{N}_.-]+$',` | `test/frame-fragment.test.ts`: 7 failed \| 51 passed (58). "is the frozen source, flags and code-unit cap of ruling R1"; "accepts a footnote, a slug, an anchor, D2.1a and a 256-code-unit id"; "accepts letters, combining marks and numbers of any script, and the four punctuation marks"; "every non-empty id in every committed expected output (goldens and hostile cases, footnotes included)"; "every non-empty id in every generated hostile output, rendered here"; and 2 more | sha256 `769fea9dcb3f…` restored, equal |
| L3.M10b | the grammar admits '.' (defined IDs such as D2.1a) | `src/frame/fragment.ts` | `source: '^[\\p{L}\\p{M}\\p{N}_.:-]+$',` → `source: '^[\\p{L}\\p{M}\\p{N}_:-]+$',` | `test/frame-fragment.test.ts`: 7 failed \| 51 passed (58). "is the frozen source, flags and code-unit cap of ruling R1"; "accepts a footnote, a slug, an anchor, D2.1a and a 256-code-unit id"; "accepts letters, combining marks and numbers of any script, and the four punctuation marks"; "the generated ID shapes: each recognised by the default ID grammar, each a fragment id"; "a sample of the corpus's defined IDs: R14, OP-6, D2.1a, AB-12-C"; and 2 more | sha256 `769fea9dcb3f…` restored, equal |
| L3.M10c | the grammar admits combining marks (\p{M}) | `src/frame/fragment.ts` | `source: '^[\\p{L}\\p{M}\\p{N}_.:-]+$',` → `source: '^[\\p{L}\\p{N}_.:-]+$',` | `test/frame-fragment.test.ts`: 4 failed \| 54 passed (58). "is the frozen source, flags and code-unit cap of ruling R1"; "accepts letters, combining marks and numbers of any script, and the four punctuation marks"; "the scan finds it in the definition (a control: the scan can see the pattern)"; "no other source file under src/ or scripts/ holds the pattern" | sha256 `769fea9dcb3f…` restored, equal |
| L3.M10d | the length is counted in UTF-16 code units | `src/frame/fragment.ts` | `s.length >= 1 && s.length <= FRAGMENT_ID_GRAMMAR.maxCodeUnits` → `[...s].length >= 1 && [...s].length <= FRAGMENT_ID_GRAMMAR.maxCodeUnits` | `test/frame-fragment.test.ts`: 1 failed \| 57 passed (58). "refuses '', '#x', 'a b', 'a/b', 257 code units and 129 astral letters (258 code units)" | sha256 `769fea9dcb3f…` restored, equal |
| L3.M10e | the grammar is wider than the anchor grammar | `src/frame/fragment.ts` | `source: '^[\\p{L}\\p{M}\\p{N}_.:-]+$',` → `source: '^[A-Za-z0-9_-]{1,100}$',` | `test/frame-fragment.test.ts`: 10 failed \| 48 passed (58). "is the frozen source, flags and code-unit cap of ruling R1"; "accepts a footnote, a slug, an anchor, D2.1a and a 256-code-unit id"; "counts code units, not code points: 128 astral letters (256 code units) pass"; "accepts letters, combining marks and numbers of any script, and the four punctuation marks"; "every non-empty id in every committed expected output (goldens and hostile cases, footnotes included)"; and 5 more | sha256 `769fea9dcb3f…` restored, equal |
| L3.M10f | one definition: the pattern lives in fragment.ts alone | `src/frame/protocol.ts` | `export const SEED_SCHEMA = 1; ⏎ ` → `export const SEED_SCHEMA = 1; ⏎  ⏎ export const HASH_PATTERN = '^[\\p{L}\\p{M}\\p{N}_.:-]+$'; ⏎ ` | `test/frame-fragment.test.ts`: 1 failed \| 57 passed (58). "no other source file under src/ or scripts/ holds the pattern" | sha256 `7093af8a2604…` restored, equal |
| L3.M10g | ruling R6: a raw invisible character in a test string is caught by the scan | `test/frame-fragment.test.ts` | `'a\u200bb'` → `'a<U+200B>b'` | `test/frame-fragment.test.ts`: 1 failed \| 57 passed (58). "test/frame-fragment.test.ts" | sha256 `a45130a163be…` restored, equal |
| L3.M10h | the \p{M} witness is a decomposed letter (an NFC rewrite of it is caught) | `test/frame-fragment.test.ts` | `const decomposed = 'cafe\u0301';` → `const decomposed = 'caf\u00e9';` | `test/frame-fragment.test.ts`: 1 failed \| 57 passed (58). "accepts letters, combining marks and numbers of any script, and the four punctuation marks" | sha256 `a45130a163be…` restored, equal |

```json
[
  {
    "id": "L3.M10a",
    "guard": "the grammar admits ':' (footnote back-reference ids)",
    "file": "src/frame/fragment.ts",
    "old": "source: '^[\\\\p{L}\\\\p{M}\\\\p{N}_.:-]+$',",
    "new": "source: '^[\\\\p{L}\\\\p{M}\\\\p{N}_.-]+$',",
    "tests": "test/frame-fragment.test.ts",
    "rc": 1,
    "red": "7 failed | 51 passed (58)",
    "sha256": "769fea9dcb3fa3485cc9140787c5721ac45d551448f43517b18a670bc5232a17",
    "restored": true
  },
  {
    "id": "L3.M10b",
    "guard": "the grammar admits '.' (defined IDs such as D2.1a)",
    "file": "src/frame/fragment.ts",
    "old": "source: '^[\\\\p{L}\\\\p{M}\\\\p{N}_.:-]+$',",
    "new": "source: '^[\\\\p{L}\\\\p{M}\\\\p{N}_:-]+$',",
    "tests": "test/frame-fragment.test.ts",
    "rc": 1,
    "red": "7 failed | 51 passed (58)",
    "sha256": "769fea9dcb3fa3485cc9140787c5721ac45d551448f43517b18a670bc5232a17",
    "restored": true
  },
  {
    "id": "L3.M10c",
    "guard": "the grammar admits combining marks (\\p{M})",
    "file": "src/frame/fragment.ts",
    "old": "source: '^[\\\\p{L}\\\\p{M}\\\\p{N}_.:-]+$',",
    "new": "source: '^[\\\\p{L}\\\\p{N}_.:-]+$',",
    "tests": "test/frame-fragment.test.ts",
    "rc": 1,
    "red": "4 failed | 54 passed (58)",
    "sha256": "769fea9dcb3fa3485cc9140787c5721ac45d551448f43517b18a670bc5232a17",
    "restored": true
  },
  {
    "id": "L3.M10d",
    "guard": "the length is counted in UTF-16 code units",
    "file": "src/frame/fragment.ts",
    "old": "s.length >= 1 && s.length <= FRAGMENT_ID_GRAMMAR.maxCodeUnits",
    "new": "[...s].length >= 1 && [...s].length <= FRAGMENT_ID_GRAMMAR.maxCodeUnits",
    "tests": "test/frame-fragment.test.ts",
    "rc": 1,
    "red": "1 failed | 57 passed (58)",
    "sha256": "769fea9dcb3fa3485cc9140787c5721ac45d551448f43517b18a670bc5232a17",
    "restored": true
  },
  {
    "id": "L3.M10e",
    "guard": "the grammar is wider than the anchor grammar",
    "file": "src/frame/fragment.ts",
    "old": "source: '^[\\\\p{L}\\\\p{M}\\\\p{N}_.:-]+$',",
    "new": "source: '^[A-Za-z0-9_-]{1,100}$',",
    "tests": "test/frame-fragment.test.ts",
    "rc": 1,
    "red": "10 failed | 48 passed (58)",
    "sha256": "769fea9dcb3fa3485cc9140787c5721ac45d551448f43517b18a670bc5232a17",
    "restored": true
  },
  {
    "id": "L3.M10f",
    "guard": "one definition: the pattern lives in fragment.ts alone",
    "file": "src/frame/protocol.ts",
    "old": "export const SEED_SCHEMA = 1;\n",
    "new": "export const SEED_SCHEMA = 1;\n\nexport const HASH_PATTERN = '^[\\\\p{L}\\\\p{M}\\\\p{N}_.:-]+$';\n",
    "tests": "test/frame-fragment.test.ts",
    "rc": 1,
    "red": "1 failed | 57 passed (58)",
    "sha256": "7093af8a2604cb1d1185bea1dda360ecef386c8378884387fe7ba5736f25ee2a",
    "restored": true
  },
  {
    "id": "L3.M10g",
    "guard": "ruling R6: a raw invisible character in a test string is caught by the scan",
    "file": "test/frame-fragment.test.ts",
    "old": "'a\\u200bb'",
    "new": "'a\u200bb'",
    "tests": "test/frame-fragment.test.ts",
    "rc": 1,
    "red": "1 failed | 57 passed (58)",
    "sha256": "a45130a163bececb453297ea2ad6f557730f4c0ce4b71a952f770e6eeacee7c9",
    "restored": true
  },
  {
    "id": "L3.M10h",
    "guard": "the \\p{M} witness is a decomposed letter (an NFC rewrite of it is caught)",
    "file": "test/frame-fragment.test.ts",
    "old": "const decomposed = 'cafe\\u0301';",
    "new": "const decomposed = 'caf\\u00e9';",
    "tests": "test/frame-fragment.test.ts",
    "rc": 1,
    "red": "1 failed | 57 passed (58)",
    "sha256": "a45130a163bececb453297ea2ad6f557730f4c0ce4b71a952f770e6eeacee7c9",
    "restored": true
  }
]
```

## DOC_FIELDS and its generator: `scripts/gen-doc-fields.mjs` (L3.M11a to L3.M11ac)

The committed list against src/enhance, and the generator's resolution and failure rules (Reference §8.3). L3.M11a to L3.M11c are the plan's three rows; L3.M11d to L3.M11f were added with the task; L3.M11g to L3.M11ac are the fix round's (review findings S1 and E1): one row for each failure rule and each check of the generator, and one for each of the CLI's exits, so that every `throw` and every `fail(...)` has a row of its own or a row that removes its whole branch (L3.M11b removes the report of every failure caught from the resolver, which the computed, template, let-binding and mutable-object fixtures need). The ids run on past `z` as `aa`, `ab` and `ac`. L3.M11y stays green: an equivalent mutant, argued above.

| Row | Guard | File | Change | Red | Restore |
|---|---|---|---|---|---|
| L3.M11a | the committed DOC_FIELDS follows src/enhance (a call added without regenerating) | `src/enhance/since.ts` | `  ctx.state.writeDoc('seen', { sha: ctx.info.sha, at: ctx.env.now() }); ⏎ ` → `  ctx.state.writeDoc('seen', { sha: ctx.info.sha, at: ctx.env.now() }); ⏎   ctx.state.writeDoc('x', null); ⏎ ` | `test/frame-doc-fields.test.ts`: 4 failed \| 33 passed (37). "--check exits 0: src/frame/doc-fields.generated.ts is what the generator writes"; "the module text is the generated text for the scan of src/enhance, with pos"; "--check exits 1 on a file that differs, and the CLI writes the file when not checking"; "by an independent AST scan, which reads every call there" | sha256 `9e16717123f7…` restored, equal |
| L3.M11b | an unresolvable call fails the generator, never skipped | `scripts/gen-doc-fields.mjs` | `          fail(err.node, err.message); ⏎ ` → `          void err.node; ⏎ ` | `test/frame-doc-fields.test.ts`: 20 failed \| 17 passed (37). "computed: fails at s.readDoc(KEYS[k]);"; "template: fails at s.writeDoc(\`field-${n}\`, 1);"; "fifth-wrapper: fails at w4(s, n);"; "value-wrapper: fails at export const HANDLERS = [save];"; "inline-callback: fails at ['a', 'b'].forEach"; and 15 more | sha256 `4ba9a2d75ef3…` restored, equal |
| L3.M11c | the generator follows a wrapper's parameter to its call sites | `scripts/gen-doc-fields.mjs` | `      if (ts.isParameter(decl)) { ⏎ ` → `      if (ts.isParameter(decl)) { ⏎         return []; ⏎ ` | `test/frame-doc-fields.test.ts`: 10 failed \| 27 passed (37). "a literal, a template, an imported const, as-const members, a re-export, a const alias, a conditional, two …"; "four wrapper levels resolve (the boundary)"; "fifth-wrapper: fails at w4(s, n);"; "value-wrapper: fails at export const HANDLERS = [save];"; "inline-callback: fails at ['a', 'b'].forEach"; and 5 more | sha256 `4ba9a2d75ef3…` restored, equal |
| L3.M11d | at most 4 wrapper levels are followed | `scripts/gen-doc-fields.mjs` | `export const MAX_WRAPPERS = 4;` → `export const MAX_WRAPPERS = 5;` | `test/frame-doc-fields.test.ts`: 1 failed \| 36 passed (37). "fifth-wrapper: fails at w4(s, n);" | sha256 `4ba9a2d75ef3…` restored, equal |
| L3.M11e | a wrapper passed as a value fails the generator | `scripts/gen-doc-fields.mjs` | `        else if (!(ts.isImportSpecifier(p) \|\| ts.isExportSpecifier(p) \|\| ts.isImportClause(p) \|\| ts.isNames…` → `        else if (false) {` | `test/frame-doc-fields.test.ts`: 1 failed \| 36 passed (37). "value-wrapper: fails at export const HANDLERS = [save];" | sha256 `4ba9a2d75ef3…` restored, equal |
| L3.M11f | writeDoc or readDoc taken as a value fails the generator | `scripts/gen-doc-fields.mjs` | ``       if (!named && !called) fail(n, `${n.text} taken as a value: its later calls cannot be followed`); `` → `      void named, called;` | `test/frame-doc-fields.test.ts`: 1 failed \| 36 passed (37). "method-value: fails at return s.writeDoc;" | sha256 `4ba9a2d75ef3…` restored, equal |
| L3.M11g | writeDoc or readDoc taken as a value through an element access fails the generator | `scripts/gen-doc-fields.mjs` | ``       if (!called) fail(n, `${n.argumentExpression.text} taken as a value: its later calls cannot be follow… `` → `      void called;` | `test/frame-doc-fields.test.ts`: 2 failed \| 35 passed (37). "element-value: fails at const f = s['writeDoc'];"; "element-value: both element-access values fail, and no field is credited past them" | sha256 `4ba9a2d75ef3…` restored, equal |
| L3.M11h | a wrapper with no call site in the scanned directory fails the generator | `scripts/gen-doc-fields.mjs` | ``         if (sites.length === 0) throw new Unresolved(e, `${wrapperName.text} has no call site in the scanne… `` → (the line removed) | `test/frame-doc-fields.test.ts`: 1 failed \| 36 passed (37). "no-call-site: fails at s.writeDoc(n, 1);" | sha256 `4ba9a2d75ef3…` restored, equal |
| L3.M11i | a string-literal element-access callee is read as a writeDoc/readDoc call | `scripts/gen-doc-fields.mjs` | `    if (ts.isElementAccessExpression(e) && ts.isStringLiteralLike(e.argumentExpression)) return e.argumentE…` → (the line removed) | `test/frame-doc-fields.test.ts`: 2 failed \| 35 passed (37). "a literal, a template, an imported const, as-const members, a re-export, a const alias, a conditional, two …"; "element-callee: fails at s['writeDoc'](parts.join('-'), 1);" | sha256 `4ba9a2d75ef3…` restored, equal |
| L3.M11j | a writeDoc/readDoc naming pos fails the generator | `scripts/gen-doc-fields.mjs` | `if (f === POS) fail(` → `if (false && f === POS) fail(` | `test/frame-doc-fields.test.ts`: 1 failed \| 36 passed (37). "pos-field: fails at s.writeDoc('pos', 1);" | sha256 `4ba9a2d75ef3…` restored, equal |
| L3.M11k | a field outside FIELD fails the generator | `scripts/gen-doc-fields.mjs` | `else if (!FIELD.test(f)) fail(` → `else if (false && !FIELD.test(f)) fail(` | `test/frame-doc-fields.test.ts`: 1 failed \| 36 passed (37). "field-grammar: fails at s.readDoc('a:b');" | sha256 `4ba9a2d75ef3…` restored, equal |
| L3.M11l | a spread as writeDoc/readDoc's field argument fails as a call without its field | `scripts/gen-doc-fields.mjs` | `if (arg === undefined \|\| ts.isSpreadElement(arg)) fail(n,` → `if (arg === undefined) fail(n,` | `test/frame-doc-fields.test.ts`: 1 failed \| 36 passed (37). "spread-call: fails at s.writeDoc(...ARGS);" | sha256 `4ba9a2d75ef3…` restored, equal |
| L3.M11m | a spread before a wrapper's field argument fails the generator | `scripts/gen-doc-fields.mjs` | `          if (args.slice(0, index + 1).some((a) => ts.isSpreadElement(a))) throw new Unresolved(call, 'a sp…` → (the line removed) | `test/frame-doc-fields.test.ts`: 1 failed \| 36 passed (37). "spread-wrapper: fails at save(...head, 'shown');" | sha256 `4ba9a2d75ef3…` restored, equal |
| L3.M11n | a rest parameter as the field fails the generator | `scripts/gen-doc-fields.mjs` | `        if (decl.dotDotDotToken !== undefined) throw new Unresolved(e, 'a rest parameter'); ⏎ ` → (the line removed) | `test/frame-doc-fields.test.ts`: 1 failed \| 36 passed (37). "rest-param: fails at s.writeDoc(names as unknown as string, 1);" | sha256 `4ba9a2d75ef3…` restored, equal |
| L3.M11o | a destructured binding (a parameter or a const) fails the generator | `scripts/gen-doc-fields.mjs` | ``       if (ts.isBindingElement(decl)) throw new Unresolved(e, `${name.text} is a destructured binding`); ⏎  `` → (the line removed) | `test/frame-doc-fields.test.ts`: 1 failed \| 36 passed (37). "destructured-param: fails at s.writeDoc(name, 1);" | sha256 `4ba9a2d75ef3…` restored, equal |
| L3.M11p | a name bound by anything else (a class member, a function) fails the generator | `scripts/gen-doc-fields.mjs` | `` throw new Unresolved(e, `${name.text} is not a const, a const object member or a wrapper parameter`); `` → `return [];` | `test/frame-doc-fields.test.ts`: 1 failed \| 36 passed (37). "static-member: fails at s.readDoc(Fields.seen);" | sha256 `4ba9a2d75ef3…` restored, equal |
| L3.M11q | a chain of bindings longer than 64 steps (a cycle) fails the generator | `scripts/gen-doc-fields.mjs` | `    if (steps > 64) throw new Unresolved(expr, 'a chain of bindings too long to follow'); ⏎ ` → (the line removed) | `test/frame-doc-fields.test.ts`: 1 failed \| 36 passed (37). "binding-cycle: fails at export const A: string = B;" | sha256 `4ba9a2d75ef3…` restored, equal |
| L3.M11r | a name with no declaration fails the generator | `scripts/gen-doc-fields.mjs` | `` if (decl === undefined) throw new Unresolved(e, `${name.text} does not resolve to a declaration`); `` → `if (decl === undefined) return [];` | `test/frame-doc-fields.test.ts`: 1 failed \| 36 passed (37). "undeclared: fails at s.readDoc(undefined as unknown as string);" | sha256 `4ba9a2d75ef3…` restored, equal |
| L3.M11s | a const with no initialiser fails the generator | `scripts/gen-doc-fields.mjs` | `` if (decl.initializer === undefined) throw new Unresolved(e, `${name.text} has no initialiser`); `` → `if (decl.initializer === undefined) return [];` | `test/frame-doc-fields.test.ts`: 1 failed \| 36 passed (37). "no-initialiser: fails at s.readDoc(NAME);" | sha256 `4ba9a2d75ef3…` restored, equal |
| L3.M11t | a member of an object that is not a const's initialiser fails the generator | `scripts/gen-doc-fields.mjs` | `` else throw new Unresolved(e, `${name.text} is a member of an object that is not the initialiser of a const`); `` → `else break;` | `test/frame-doc-fields.test.ts`: 1 failed \| 36 passed (37). "let-object: fails at s.readDoc(KEYS.a);" | sha256 `4ba9a2d75ef3…` restored, equal |
| L3.M11u | a wrapper bound to a let is not followed | `scripts/gen-doc-fields.mjs` | `if (isConstDeclaration(d) && ts.isIdentifier(d.name)) return { fn, name: d.name };` → `if (ts.isIdentifier(d.name)) return { fn, name: d.name };` | `test/frame-doc-fields.test.ts`: 1 failed \| 36 passed (37). "let-wrapper: fails at s.writeDoc(n, 1);" | sha256 `4ba9a2d75ef3…` restored, equal |
| L3.M11v | a wrapper called without its field argument fails the generator | `scripts/gen-doc-fields.mjs` | `` if (arg === undefined) throw new Unresolved(call, `a call of ${wrapperName.text} without its field argument`); `` → `if (arg === undefined) continue;` | `test/frame-doc-fields.test.ts`: 1 failed \| 36 passed (37). "missing-argument: fails at save(s);" | sha256 `4ba9a2d75ef3…` restored, equal |
| L3.M11w | a writeDoc/readDoc call with no argument fails the generator (it never throws) | `scripts/gen-doc-fields.mjs` | `if (arg === undefined \|\| ts.isSpreadElement(arg)) fail(n,` → `if (ts.isSpreadElement(arg)) fail(n,` | `test/frame-doc-fields.test.ts`: 1 failed \| 36 passed (37). "no-argument: fails at s.readDoc();" | sha256 `4ba9a2d75ef3…` restored, equal |
| L3.M11x | a parameter of anything but a named function wrapper fails the generator (it never throws) | `scripts/gen-doc-fields.mjs` | `    throw new Unresolved(at, 'a parameter of a function that is not a named function wrapper (a function de…` → (the line removed) | `test/frame-doc-fields.test.ts`: 2 failed \| 35 passed (37). "inline-callback: fails at ['a', 'b'].forEach"; "let-wrapper: fails at s.writeDoc(n, 1);" | sha256 `4ba9a2d75ef3…` restored, equal |
| L3.M11y | a wrapper's name that does not resolve fails the generator | `scripts/gen-doc-fields.mjs` | ``         if (wrapper === undefined) throw new Unresolved(e, `${wrapperName.text} does not resolve`); ⏎  `` → (the line removed) | `test/frame-doc-fields.test.ts`: 37 passed (37). **Stays green: an equivalent mutant (see the notes above).** | sha256 `4ba9a2d75ef3…` restored, equal |
| L3.M11z | a --src directory that does not exist is a usage error (exit 2) | `scripts/gen-doc-fields.mjs` | `if (!existsSync(path.resolve(ROOT, src))) {` → `if (false) {` | `test/frame-doc-fields.test.ts`: 1 failed \| 36 passed (37). "a usage error exits 2, a directory that does not exist included" | sha256 `4ba9a2d75ef3…` restored, equal |
| L3.M11aa | the CLI exits 1 on a failure and writes nothing | `scripts/gen-doc-fields.mjs` | `if (failures.length > 0) {` → `if (false) {` | `test/frame-doc-fields.test.ts`: 1 failed \| 36 passed (37). "the CLI reports a failure with its file and line, writes nothing and exits 1" | sha256 `4ba9a2d75ef3…` restored, equal |
| L3.M11ab | --check exits 1 when the committed file differs | `scripts/gen-doc-fields.mjs` | `if (now !== text) {` → `if (false) {` | `test/frame-doc-fields.test.ts`: 1 failed \| 36 passed (37). "--check exits 1 on a file that differs, and the CLI writes the file when not checking" | sha256 `4ba9a2d75ef3…` restored, equal |
| L3.M11ac | an unknown or incomplete argument is a usage error (exit 2) | `scripts/gen-doc-fields.mjs` | `process.stderr.write('usage: node scripts/gen-doc-fields.mjs [--check] [--src <dir>] [--out <file>]\n'); ⏎ …` → `process.stderr.write('usage: node scripts/gen-doc-fields.mjs [--check] [--src <dir>] [--out <file>]\n'); ⏎ …` | `test/frame-doc-fields.test.ts`: 1 failed \| 36 passed (37). "a usage error exits 2, a directory that does not exist included" | sha256 `4ba9a2d75ef3…` restored, equal |

```json
[
  {
    "id": "L3.M11a",
    "guard": "the committed DOC_FIELDS follows src/enhance (a call added without regenerating)",
    "file": "src/enhance/since.ts",
    "old": "  ctx.state.writeDoc('seen', { sha: ctx.info.sha, at: ctx.env.now() });\n",
    "new": "  ctx.state.writeDoc('seen', { sha: ctx.info.sha, at: ctx.env.now() });\n  ctx.state.writeDoc('x', null);\n",
    "tests": "test/frame-doc-fields.test.ts",
    "rc": 1,
    "red": "4 failed | 33 passed (37)",
    "sha256": "9e16717123f746c3a4f9262a85d471168b32f67d9a36f07801e67e54037400bb",
    "restored": true
  },
  {
    "id": "L3.M11b",
    "guard": "an unresolvable call fails the generator, never skipped",
    "file": "scripts/gen-doc-fields.mjs",
    "old": "          fail(err.node, err.message);\n",
    "new": "          void err.node;\n",
    "tests": "test/frame-doc-fields.test.ts",
    "rc": 1,
    "red": "20 failed | 17 passed (37)",
    "sha256": "4ba9a2d75ef3da403f55bb7b6f952efd44d247622a416c55be67db5b2dc94cda",
    "restored": true
  },
  {
    "id": "L3.M11c",
    "guard": "the generator follows a wrapper's parameter to its call sites",
    "file": "scripts/gen-doc-fields.mjs",
    "old": "      if (ts.isParameter(decl)) {\n",
    "new": "      if (ts.isParameter(decl)) {\n        return [];\n",
    "tests": "test/frame-doc-fields.test.ts",
    "rc": 1,
    "red": "10 failed | 27 passed (37)",
    "sha256": "4ba9a2d75ef3da403f55bb7b6f952efd44d247622a416c55be67db5b2dc94cda",
    "restored": true
  },
  {
    "id": "L3.M11d",
    "guard": "at most 4 wrapper levels are followed",
    "file": "scripts/gen-doc-fields.mjs",
    "old": "export const MAX_WRAPPERS = 4;",
    "new": "export const MAX_WRAPPERS = 5;",
    "tests": "test/frame-doc-fields.test.ts",
    "rc": 1,
    "red": "1 failed | 36 passed (37)",
    "sha256": "4ba9a2d75ef3da403f55bb7b6f952efd44d247622a416c55be67db5b2dc94cda",
    "restored": true
  },
  {
    "id": "L3.M11e",
    "guard": "a wrapper passed as a value fails the generator",
    "file": "scripts/gen-doc-fields.mjs",
    "old": "        else if (!(ts.isImportSpecifier(p) || ts.isExportSpecifier(p) || ts.isImportClause(p) || ts.isNamespaceImport(p))) {",
    "new": "        else if (false) {",
    "tests": "test/frame-doc-fields.test.ts",
    "rc": 1,
    "red": "1 failed | 36 passed (37)",
    "sha256": "4ba9a2d75ef3da403f55bb7b6f952efd44d247622a416c55be67db5b2dc94cda",
    "restored": true
  },
  {
    "id": "L3.M11f",
    "guard": "writeDoc or readDoc taken as a value fails the generator",
    "file": "scripts/gen-doc-fields.mjs",
    "old": "      if (!named && !called) fail(n, `${n.text} taken as a value: its later calls cannot be followed`);",
    "new": "      void named, called;",
    "tests": "test/frame-doc-fields.test.ts",
    "rc": 1,
    "red": "1 failed | 36 passed (37)",
    "sha256": "4ba9a2d75ef3da403f55bb7b6f952efd44d247622a416c55be67db5b2dc94cda",
    "restored": true
  },
  {
    "id": "L3.M11g",
    "guard": "writeDoc or readDoc taken as a value through an element access fails the generator",
    "file": "scripts/gen-doc-fields.mjs",
    "old": "      if (!called) fail(n, `${n.argumentExpression.text} taken as a value: its later calls cannot be followed`);",
    "new": "      void called;",
    "tests": "test/frame-doc-fields.test.ts",
    "rc": 1,
    "red": "2 failed | 35 passed (37)",
    "sha256": "4ba9a2d75ef3da403f55bb7b6f952efd44d247622a416c55be67db5b2dc94cda",
    "restored": true
  },
  {
    "id": "L3.M11h",
    "guard": "a wrapper with no call site in the scanned directory fails the generator",
    "file": "scripts/gen-doc-fields.mjs",
    "old": "        if (sites.length === 0) throw new Unresolved(e, `${wrapperName.text} has no call site in the scanned directory`);\n",
    "new": "",
    "tests": "test/frame-doc-fields.test.ts",
    "rc": 1,
    "red": "1 failed | 36 passed (37)",
    "sha256": "4ba9a2d75ef3da403f55bb7b6f952efd44d247622a416c55be67db5b2dc94cda",
    "restored": true
  },
  {
    "id": "L3.M11i",
    "guard": "a string-literal element-access callee is read as a writeDoc/readDoc call",
    "file": "scripts/gen-doc-fields.mjs",
    "old": "    if (ts.isElementAccessExpression(e) && ts.isStringLiteralLike(e.argumentExpression)) return e.argumentExpression.text;\n",
    "new": "",
    "tests": "test/frame-doc-fields.test.ts",
    "rc": 1,
    "red": "2 failed | 35 passed (37)",
    "sha256": "4ba9a2d75ef3da403f55bb7b6f952efd44d247622a416c55be67db5b2dc94cda",
    "restored": true
  },
  {
    "id": "L3.M11j",
    "guard": "a writeDoc/readDoc naming pos fails the generator",
    "file": "scripts/gen-doc-fields.mjs",
    "old": "if (f === POS) fail(",
    "new": "if (false && f === POS) fail(",
    "tests": "test/frame-doc-fields.test.ts",
    "rc": 1,
    "red": "1 failed | 36 passed (37)",
    "sha256": "4ba9a2d75ef3da403f55bb7b6f952efd44d247622a416c55be67db5b2dc94cda",
    "restored": true
  },
  {
    "id": "L3.M11k",
    "guard": "a field outside FIELD fails the generator",
    "file": "scripts/gen-doc-fields.mjs",
    "old": "else if (!FIELD.test(f)) fail(",
    "new": "else if (false && !FIELD.test(f)) fail(",
    "tests": "test/frame-doc-fields.test.ts",
    "rc": 1,
    "red": "1 failed | 36 passed (37)",
    "sha256": "4ba9a2d75ef3da403f55bb7b6f952efd44d247622a416c55be67db5b2dc94cda",
    "restored": true
  },
  {
    "id": "L3.M11l",
    "guard": "a spread as writeDoc/readDoc's field argument fails as a call without its field",
    "file": "scripts/gen-doc-fields.mjs",
    "old": "if (arg === undefined || ts.isSpreadElement(arg)) fail(n,",
    "new": "if (arg === undefined) fail(n,",
    "tests": "test/frame-doc-fields.test.ts",
    "rc": 1,
    "red": "1 failed | 36 passed (37)",
    "sha256": "4ba9a2d75ef3da403f55bb7b6f952efd44d247622a416c55be67db5b2dc94cda",
    "restored": true
  },
  {
    "id": "L3.M11m",
    "guard": "a spread before a wrapper's field argument fails the generator",
    "file": "scripts/gen-doc-fields.mjs",
    "old": "          if (args.slice(0, index + 1).some((a) => ts.isSpreadElement(a))) throw new Unresolved(call, 'a spread argument to a wrapper');\n",
    "new": "",
    "tests": "test/frame-doc-fields.test.ts",
    "rc": 1,
    "red": "1 failed | 36 passed (37)",
    "sha256": "4ba9a2d75ef3da403f55bb7b6f952efd44d247622a416c55be67db5b2dc94cda",
    "restored": true
  },
  {
    "id": "L3.M11n",
    "guard": "a rest parameter as the field fails the generator",
    "file": "scripts/gen-doc-fields.mjs",
    "old": "        if (decl.dotDotDotToken !== undefined) throw new Unresolved(e, 'a rest parameter');\n",
    "new": "",
    "tests": "test/frame-doc-fields.test.ts",
    "rc": 1,
    "red": "1 failed | 36 passed (37)",
    "sha256": "4ba9a2d75ef3da403f55bb7b6f952efd44d247622a416c55be67db5b2dc94cda",
    "restored": true
  },
  {
    "id": "L3.M11o",
    "guard": "a destructured binding (a parameter or a const) fails the generator",
    "file": "scripts/gen-doc-fields.mjs",
    "old": "      if (ts.isBindingElement(decl)) throw new Unresolved(e, `${name.text} is a destructured binding`);\n",
    "new": "",
    "tests": "test/frame-doc-fields.test.ts",
    "rc": 1,
    "red": "1 failed | 36 passed (37)",
    "sha256": "4ba9a2d75ef3da403f55bb7b6f952efd44d247622a416c55be67db5b2dc94cda",
    "restored": true
  },
  {
    "id": "L3.M11p",
    "guard": "a name bound by anything else (a class member, a function) fails the generator",
    "file": "scripts/gen-doc-fields.mjs",
    "old": "throw new Unresolved(e, `${name.text} is not a const, a const object member or a wrapper parameter`);",
    "new": "return [];",
    "tests": "test/frame-doc-fields.test.ts",
    "rc": 1,
    "red": "1 failed | 36 passed (37)",
    "sha256": "4ba9a2d75ef3da403f55bb7b6f952efd44d247622a416c55be67db5b2dc94cda",
    "restored": true
  },
  {
    "id": "L3.M11q",
    "guard": "a chain of bindings longer than 64 steps (a cycle) fails the generator",
    "file": "scripts/gen-doc-fields.mjs",
    "old": "    if (steps > 64) throw new Unresolved(expr, 'a chain of bindings too long to follow');\n",
    "new": "",
    "tests": "test/frame-doc-fields.test.ts",
    "rc": 1,
    "red": "1 failed | 36 passed (37)",
    "sha256": "4ba9a2d75ef3da403f55bb7b6f952efd44d247622a416c55be67db5b2dc94cda",
    "restored": true
  },
  {
    "id": "L3.M11r",
    "guard": "a name with no declaration fails the generator",
    "file": "scripts/gen-doc-fields.mjs",
    "old": "if (decl === undefined) throw new Unresolved(e, `${name.text} does not resolve to a declaration`);",
    "new": "if (decl === undefined) return [];",
    "tests": "test/frame-doc-fields.test.ts",
    "rc": 1,
    "red": "1 failed | 36 passed (37)",
    "sha256": "4ba9a2d75ef3da403f55bb7b6f952efd44d247622a416c55be67db5b2dc94cda",
    "restored": true
  },
  {
    "id": "L3.M11s",
    "guard": "a const with no initialiser fails the generator",
    "file": "scripts/gen-doc-fields.mjs",
    "old": "if (decl.initializer === undefined) throw new Unresolved(e, `${name.text} has no initialiser`);",
    "new": "if (decl.initializer === undefined) return [];",
    "tests": "test/frame-doc-fields.test.ts",
    "rc": 1,
    "red": "1 failed | 36 passed (37)",
    "sha256": "4ba9a2d75ef3da403f55bb7b6f952efd44d247622a416c55be67db5b2dc94cda",
    "restored": true
  },
  {
    "id": "L3.M11t",
    "guard": "a member of an object that is not a const's initialiser fails the generator",
    "file": "scripts/gen-doc-fields.mjs",
    "old": "else throw new Unresolved(e, `${name.text} is a member of an object that is not the initialiser of a const`);",
    "new": "else break;",
    "tests": "test/frame-doc-fields.test.ts",
    "rc": 1,
    "red": "1 failed | 36 passed (37)",
    "sha256": "4ba9a2d75ef3da403f55bb7b6f952efd44d247622a416c55be67db5b2dc94cda",
    "restored": true
  },
  {
    "id": "L3.M11u",
    "guard": "a wrapper bound to a let is not followed",
    "file": "scripts/gen-doc-fields.mjs",
    "old": "if (isConstDeclaration(d) && ts.isIdentifier(d.name)) return { fn, name: d.name };",
    "new": "if (ts.isIdentifier(d.name)) return { fn, name: d.name };",
    "tests": "test/frame-doc-fields.test.ts",
    "rc": 1,
    "red": "1 failed | 36 passed (37)",
    "sha256": "4ba9a2d75ef3da403f55bb7b6f952efd44d247622a416c55be67db5b2dc94cda",
    "restored": true
  },
  {
    "id": "L3.M11v",
    "guard": "a wrapper called without its field argument fails the generator",
    "file": "scripts/gen-doc-fields.mjs",
    "old": "if (arg === undefined) throw new Unresolved(call, `a call of ${wrapperName.text} without its field argument`);",
    "new": "if (arg === undefined) continue;",
    "tests": "test/frame-doc-fields.test.ts",
    "rc": 1,
    "red": "1 failed | 36 passed (37)",
    "sha256": "4ba9a2d75ef3da403f55bb7b6f952efd44d247622a416c55be67db5b2dc94cda",
    "restored": true
  },
  {
    "id": "L3.M11w",
    "guard": "a writeDoc/readDoc call with no argument fails the generator (it never throws)",
    "file": "scripts/gen-doc-fields.mjs",
    "old": "if (arg === undefined || ts.isSpreadElement(arg)) fail(n,",
    "new": "if (ts.isSpreadElement(arg)) fail(n,",
    "tests": "test/frame-doc-fields.test.ts",
    "rc": 1,
    "red": "1 failed | 36 passed (37)",
    "sha256": "4ba9a2d75ef3da403f55bb7b6f952efd44d247622a416c55be67db5b2dc94cda",
    "restored": true
  },
  {
    "id": "L3.M11x",
    "guard": "a parameter of anything but a named function wrapper fails the generator (it never throws)",
    "file": "scripts/gen-doc-fields.mjs",
    "old": "    throw new Unresolved(at, 'a parameter of a function that is not a named function wrapper (a function declaration, or a function bound to a const)');\n",
    "new": "",
    "tests": "test/frame-doc-fields.test.ts",
    "rc": 1,
    "red": "2 failed | 35 passed (37)",
    "sha256": "4ba9a2d75ef3da403f55bb7b6f952efd44d247622a416c55be67db5b2dc94cda",
    "restored": true
  },
  {
    "id": "L3.M11y",
    "guard": "a wrapper's name that does not resolve fails the generator",
    "file": "scripts/gen-doc-fields.mjs",
    "old": "        if (wrapper === undefined) throw new Unresolved(e, `${wrapperName.text} does not resolve`);\n",
    "new": "",
    "tests": "test/frame-doc-fields.test.ts",
    "rc": 0,
    "red": "37 passed (37)",
    "equivalent": true,
    "sha256": "4ba9a2d75ef3da403f55bb7b6f952efd44d247622a416c55be67db5b2dc94cda",
    "restored": true
  },
  {
    "id": "L3.M11z",
    "guard": "a --src directory that does not exist is a usage error (exit 2)",
    "file": "scripts/gen-doc-fields.mjs",
    "old": "if (!existsSync(path.resolve(ROOT, src))) {",
    "new": "if (false) {",
    "tests": "test/frame-doc-fields.test.ts",
    "rc": 1,
    "red": "1 failed | 36 passed (37)",
    "sha256": "4ba9a2d75ef3da403f55bb7b6f952efd44d247622a416c55be67db5b2dc94cda",
    "restored": true
  },
  {
    "id": "L3.M11aa",
    "guard": "the CLI exits 1 on a failure and writes nothing",
    "file": "scripts/gen-doc-fields.mjs",
    "old": "if (failures.length > 0) {",
    "new": "if (false) {",
    "tests": "test/frame-doc-fields.test.ts",
    "rc": 1,
    "red": "1 failed | 36 passed (37)",
    "sha256": "4ba9a2d75ef3da403f55bb7b6f952efd44d247622a416c55be67db5b2dc94cda",
    "restored": true
  },
  {
    "id": "L3.M11ab",
    "guard": "--check exits 1 when the committed file differs",
    "file": "scripts/gen-doc-fields.mjs",
    "old": "if (now !== text) {",
    "new": "if (false) {",
    "tests": "test/frame-doc-fields.test.ts",
    "rc": 1,
    "red": "1 failed | 36 passed (37)",
    "sha256": "4ba9a2d75ef3da403f55bb7b6f952efd44d247622a416c55be67db5b2dc94cda",
    "restored": true
  },
  {
    "id": "L3.M11ac",
    "guard": "an unknown or incomplete argument is a usage error (exit 2)",
    "file": "scripts/gen-doc-fields.mjs",
    "old": "process.stderr.write('usage: node scripts/gen-doc-fields.mjs [--check] [--src <dir>] [--out <file>]\\n');\n      return 2;",
    "new": "process.stderr.write('usage: node scripts/gen-doc-fields.mjs [--check] [--src <dir>] [--out <file>]\\n');\n      return 0;",
    "tests": "test/frame-doc-fields.test.ts",
    "rc": 1,
    "red": "1 failed | 36 passed (37)",
    "sha256": "4ba9a2d75ef3da403f55bb7b6f952efd44d247622a416c55be67db5b2dc94cda",
    "restored": true
  }
]
```

## The limits, the public surface and the fixtures: `src/frame/protocol.ts`, `src/frame/index.ts`, `conformance/bridge-cases.json` (U9a to U9d, L3.P1a, L3.P1b, BCa)

BRIDGE_LIMITS exactly as Reference §8.4 states it (the prototype's U9 rows, moved to `test/frame-protocol.test.ts`), the margin between the frame's window and the strict reading's refusal points (U9c, U9d; finding E3), `./frame`'s public surface (L3.P1a; finding C2), the prefs' values held to L2's (L3.P1b; finding C3), and a bridge case's stated size (BCa; finding S6).

| Row | Guard | File | Change | Red | Restore |
|---|---|---|---|---|---|
| U9a | the frame's window holds at most 16 messages | `src/frame/protocol.ts` | `  frameMaxPerWindow: 16, ⏎ ` → `  frameMaxPerWindow: 21, ⏎ ` | `test/frame-protocol.test.ts`: 4 failed \| 161 passed (165). "the parent reads its limits as token buckets, and the frame paces by a sliding window that neither reading …"; "the frame window fits under the strict reading of both parent limits, and the frame outlasts the parent on …"; "ten saturated windows: no refusal from the bucket or the strict window"; "the strict reading accepts a 17th message and a 9th store.set at one instant, and refuses the 21st and the …" | sha256 `7093af8a2604…` restored, equal |
| U9b | no burst allowance beyond the window (the prototype's frameBurst stays removed) | `src/frame/protocol.ts` | `  frameChangesTimeoutMs: 35000, ⏎ ` → `  frameChangesTimeoutMs: 35000, ⏎   frameBurst: 32, ⏎ ` | `test/frame-protocol.test.ts`: 1 failed \| 164 passed (165). "the parent reads its limits as token buckets, and the frame paces by a sliding window that neither reading …" | sha256 `7093af8a2604…` restored, equal |
| U9c | the frame window sits strictly below the strict reading's refusal point (messages) | `src/frame/protocol.ts` | `  frameMaxPerWindow: 16,` → `  frameMaxPerWindow: 20,` | `test/frame-protocol.test.ts`: 2 failed \| 163 passed (165). "the parent reads its limits as token buckets, and the frame paces by a sliding window that neither reading …"; "the strict reading accepts a 17th message and a 9th store.set at one instant, and refuses the 21st and the …" | sha256 `7093af8a2604…` restored, equal |
| U9d | the frame window sits strictly below the strict reading's refusal point (store.set) | `src/frame/protocol.ts` | `  frameStoreSetMaxPerWindow: 8,` → `  frameStoreSetMaxPerWindow: 10,` | `test/frame-protocol.test.ts`: 2 failed \| 163 passed (165). "the parent reads its limits as token buckets, and the frame paces by a sliding window that neither reading …"; "the strict reading accepts a 17th message and a 9th store.set at one instant, and refuses the 21st and the …" | sha256 `7093af8a2604…` restored, equal |
| L3.P1a | ./frame exports no internal wire helper (FD20) | `src/frame/index.ts` | `  ERROR_WHY, ⏎   OP_KEYS,` → `  ERROR_WHY, ⏎   FRAME_OPS, ⏎   OP_KEYS,` | `test/frame-protocol.test.ts`: 1 failed \| 164 passed (165). "exports none of the internal wire helpers, as a value or as a type" | sha256 `fe40b9fa3f4c…` restored, equal |
| L3.P1b | FRAME_PREF_VALUES equals L2's PREF_VALUES without the lens | `src/frame/protocol.ts` | `width: Object.freeze(['standard', 'wide'] as const),` → `width: Object.freeze(['standard', 'wide', 'full'] as const),` | `test/enhance-frame-wire.test.ts`: 1 failed \| 3 passed (4). "the same prefs, in the same order, each with the same values in the same order (the first the default)" | sha256 `7093af8a2604…` restored, equal |
| BCa | a bridge case's stated size is the size of its value | `conformance/bridge-cases.json` | `copy exactly 65536 UTF-8 bytes in 21846 code units` → `copy 65535 UTF-8 bytes in 21845 code units` | `test/frame-protocol.test.ts`: 1 failed \| 164 passed (165). "a label that states a size states the size of the value it carries (UTF-8 bytes, code units)" | sha256 `af10ed46703a…` restored, equal |

```json
[
  {
    "id": "U9a",
    "guard": "the frame's window holds at most 16 messages",
    "file": "src/frame/protocol.ts",
    "old": "  frameMaxPerWindow: 16,\n",
    "new": "  frameMaxPerWindow: 21,\n",
    "tests": "test/frame-protocol.test.ts",
    "rc": 1,
    "red": "4 failed | 161 passed (165)",
    "sha256": "7093af8a2604cb1d1185bea1dda360ecef386c8378884387fe7ba5736f25ee2a",
    "restored": true
  },
  {
    "id": "U9b",
    "guard": "no burst allowance beyond the window (the prototype's frameBurst stays removed)",
    "file": "src/frame/protocol.ts",
    "old": "  frameChangesTimeoutMs: 35000,\n",
    "new": "  frameChangesTimeoutMs: 35000,\n  frameBurst: 32,\n",
    "tests": "test/frame-protocol.test.ts",
    "rc": 1,
    "red": "1 failed | 164 passed (165)",
    "sha256": "7093af8a2604cb1d1185bea1dda360ecef386c8378884387fe7ba5736f25ee2a",
    "restored": true
  },
  {
    "id": "U9c",
    "guard": "the frame window sits strictly below the strict reading's refusal point (messages)",
    "file": "src/frame/protocol.ts",
    "old": "  frameMaxPerWindow: 16,",
    "new": "  frameMaxPerWindow: 20,",
    "tests": "test/frame-protocol.test.ts",
    "rc": 1,
    "red": "2 failed | 163 passed (165)",
    "sha256": "7093af8a2604cb1d1185bea1dda360ecef386c8378884387fe7ba5736f25ee2a",
    "restored": true
  },
  {
    "id": "U9d",
    "guard": "the frame window sits strictly below the strict reading's refusal point (store.set)",
    "file": "src/frame/protocol.ts",
    "old": "  frameStoreSetMaxPerWindow: 8,",
    "new": "  frameStoreSetMaxPerWindow: 10,",
    "tests": "test/frame-protocol.test.ts",
    "rc": 1,
    "red": "2 failed | 163 passed (165)",
    "sha256": "7093af8a2604cb1d1185bea1dda360ecef386c8378884387fe7ba5736f25ee2a",
    "restored": true
  },
  {
    "id": "L3.P1a",
    "guard": "./frame exports no internal wire helper (FD20)",
    "file": "src/frame/index.ts",
    "old": "  ERROR_WHY,\n  OP_KEYS,",
    "new": "  ERROR_WHY,\n  FRAME_OPS,\n  OP_KEYS,",
    "tests": "test/frame-protocol.test.ts",
    "rc": 1,
    "red": "1 failed | 164 passed (165)",
    "sha256": "fe40b9fa3f4cd1b068bc67da9cd8cd8eabc00094054cc22d47b83c9abc41af9f",
    "restored": true
  },
  {
    "id": "L3.P1b",
    "guard": "FRAME_PREF_VALUES equals L2's PREF_VALUES without the lens",
    "file": "src/frame/protocol.ts",
    "old": "width: Object.freeze(['standard', 'wide'] as const),",
    "new": "width: Object.freeze(['standard', 'wide', 'full'] as const),",
    "tests": "test/enhance-frame-wire.test.ts",
    "rc": 1,
    "red": "1 failed | 3 passed (4)",
    "sha256": "7093af8a2604cb1d1185bea1dda360ecef386c8378884387fe7ba5736f25ee2a",
    "restored": true
  },
  {
    "id": "BCa",
    "guard": "a bridge case's stated size is the size of its value",
    "file": "conformance/bridge-cases.json",
    "old": "copy exactly 65536 UTF-8 bytes in 21846 code units",
    "new": "copy 65535 UTF-8 bytes in 21845 code units",
    "tests": "test/frame-protocol.test.ts",
    "rc": 1,
    "red": "1 failed | 164 passed (165)",
    "sha256": "af10ed46703a627a8c39dfa145a9e13be32738ee5b7ef463d77995e75db41b9c",
    "restored": true
  }
]
```

## Type-level guards: `src/frame/protocol.ts`, `src/frame/wire-types.ts` (L3.P1c to L3.P1g)

These guards are types, so their red is a compile error by nature: each row runs the typecheck project that holds the `expectTypeOf` pin and names the errors it printed, every one at an `expectTypeOf` line of the pinning test file and none elsewhere (the type assertion failing, not a file that stopped compiling). They are listed apart because a type wall cannot fail at run time; that reading of "an assertion failure" needs the coordinator's confirmation. L3.P1c pins finding S4's closed `doc:<field>` union; L3.P1d to L3.P1g pin finding C1's DOM-free shapes against L2's own (CommitEntry, VocabularyOptions, ChromeOptions and FramePrefs).

| Row | Guard | File | Change | Red | Restore |
|---|---|---|---|---|---|
| L3.P1c | BridgeStoreKey's doc:<field> is closed at compile time | `src/frame/protocol.ts` | `` \| `doc:${(typeof DOC_FIELDS)[number]}`; `` → `` \| `doc:${string}`; `` | `tsc --noEmit -p tsconfig.json`: exit 2, 2 error(s), each at an `expectTypeOf` line of `test/frame-protocol.test.ts`: `test/frame-protocol.test.ts(135) TS2554`; `test/frame-protocol.test.ts(136) TS2554` | sha256 `7093af8a2604…` restored, equal |
| L3.P1d | wire-types CommitEntry equals L2's | `src/frame/wire-types.ts` | `  readonly subject: string;` → `  readonly subject: string \| null;` | `tsc --noEmit -p tsconfig.enhance.json`: exit 2, 1 error(s), each at an `expectTypeOf` line of `test/enhance-frame-wire.test.ts`: `test/enhance-frame-wire.test.ts(16) TS2344` | sha256 `f30b090c652b…` restored, equal |
| L3.P1e | wire-types VocabularyOptions equals L2's | `src/frame/wire-types.ts` | `  readonly qualifiers?: readonly string[];` → `  readonly qualifiers?: readonly string[]; ⏎   readonly extra?: boolean;` | `tsc --noEmit -p tsconfig.enhance.json`: exit 2, 1 error(s), each at an `expectTypeOf` line of `test/enhance-frame-wire.test.ts`: `test/enhance-frame-wire.test.ts(18) TS2344` | sha256 `f30b090c652b…` restored, equal |
| L3.P1f | wire-types ChromeOptions equals L2's | `src/frame/wire-types.ts` | `  readonly settings?: boolean;` → `  settings?: boolean;` | `tsc --noEmit -p tsconfig.enhance.json`: exit 2, 1 error(s), each at an `expectTypeOf` line of `test/enhance-frame-wire.test.ts`: `test/enhance-frame-wire.test.ts(17) TS2554` | sha256 `f30b090c652b…` restored, equal |
| L3.P1g | wire-types FramePrefs equals L2's Pick<Prefs, 'theme' \| 'width' \| 'font'> | `src/frame/wire-types.ts` | `export type FramePrefs = Required<FramePrefValues>;` → `export type FramePrefs = FramePrefValues;` | `tsc --noEmit -p tsconfig.enhance.json`: exit 2, 1 error(s), each at an `expectTypeOf` line of `test/enhance-frame-wire.test.ts`: `test/enhance-frame-wire.test.ts(23) TS2344` | sha256 `f30b090c652b…` restored, equal |

```json
[
  {
    "id": "L3.P1c",
    "guard": "BridgeStoreKey's doc:<field> is closed at compile time",
    "file": "src/frame/protocol.ts",
    "old": "| `doc:${(typeof DOC_FIELDS)[number]}`;",
    "new": "| `doc:${string}`;",
    "command": "./node_modules/.bin/tsc --noEmit -p tsconfig.json",
    "pin": "test/frame-protocol.test.ts",
    "rc": 2,
    "red": [
      "test/frame-protocol.test.ts(135) TS2554",
      "test/frame-protocol.test.ts(136) TS2554"
    ],
    "sha256": "7093af8a2604cb1d1185bea1dda360ecef386c8378884387fe7ba5736f25ee2a",
    "restored": true
  },
  {
    "id": "L3.P1d",
    "guard": "wire-types CommitEntry equals L2's",
    "file": "src/frame/wire-types.ts",
    "old": "  readonly subject: string;",
    "new": "  readonly subject: string | null;",
    "command": "./node_modules/.bin/tsc --noEmit -p tsconfig.enhance.json",
    "pin": "test/enhance-frame-wire.test.ts",
    "rc": 2,
    "red": [
      "test/enhance-frame-wire.test.ts(16) TS2344"
    ],
    "sha256": "f30b090c652b63a8f72b47a3f31d2bcc78cff51c1b1d1b54358a790eda7de9b7",
    "restored": true
  },
  {
    "id": "L3.P1e",
    "guard": "wire-types VocabularyOptions equals L2's",
    "file": "src/frame/wire-types.ts",
    "old": "  readonly qualifiers?: readonly string[];",
    "new": "  readonly qualifiers?: readonly string[];\n  readonly extra?: boolean;",
    "command": "./node_modules/.bin/tsc --noEmit -p tsconfig.enhance.json",
    "pin": "test/enhance-frame-wire.test.ts",
    "rc": 2,
    "red": [
      "test/enhance-frame-wire.test.ts(18) TS2344"
    ],
    "sha256": "f30b090c652b63a8f72b47a3f31d2bcc78cff51c1b1d1b54358a790eda7de9b7",
    "restored": true
  },
  {
    "id": "L3.P1f",
    "guard": "wire-types ChromeOptions equals L2's",
    "file": "src/frame/wire-types.ts",
    "old": "  readonly settings?: boolean;",
    "new": "  settings?: boolean;",
    "command": "./node_modules/.bin/tsc --noEmit -p tsconfig.enhance.json",
    "pin": "test/enhance-frame-wire.test.ts",
    "rc": 2,
    "red": [
      "test/enhance-frame-wire.test.ts(17) TS2554"
    ],
    "sha256": "f30b090c652b63a8f72b47a3f31d2bcc78cff51c1b1d1b54358a790eda7de9b7",
    "restored": true
  },
  {
    "id": "L3.P1g",
    "guard": "wire-types FramePrefs equals L2's Pick<Prefs, 'theme' | 'width' | 'font'>",
    "file": "src/frame/wire-types.ts",
    "old": "export type FramePrefs = Required<FramePrefValues>;",
    "new": "export type FramePrefs = FramePrefValues;",
    "command": "./node_modules/.bin/tsc --noEmit -p tsconfig.enhance.json",
    "pin": "test/enhance-frame-wire.test.ts",
    "rc": 2,
    "red": [
      "test/enhance-frame-wire.test.ts(23) TS2344"
    ],
    "sha256": "f30b090c652b63a8f72b47a3f31d2bcc78cff51c1b1d1b54358a790eda7de9b7",
    "restored": true
  }
]
```
