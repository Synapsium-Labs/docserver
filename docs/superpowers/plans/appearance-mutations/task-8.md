# Task 8 mutation rows (size by contract)

Each row edits `test/size-rules.ts` in place (the original saved and its sha256 `f17c1f54e271393196a6c8a760d16616b84a4d8725b8a8a00bd7263f763ba8e4 (after the fix round; A8a to A8x were measured on the first version, the guards unchanged)` checked after the run), runs `test/size-rules.test.ts` through the fleet wrapper, and restores. A8a to A8h are the plan's rows; A8i to A8x are further guards of the same module.

| Row | Guard | Edit | Tests run | Result |
|---|---|---|---|---|
| A8a | the byte-equal check | `if (h.lines[i] !== line) v.push(  ->  if (h.lines[i] === "never") v.push(` | test/size-rules.test.ts | red |
| A8b | one line only | `if (words.length !== 1) v.push(  ->  if (words.length < 1) v.push(` | test/size-rules.test.ts | red |
| A8c | shares read from the first parent | `const share = shareOf(base.shares as Table, design);  ->  const share = shareOf(head.shares as Table, design);` | test/size-rules.test.ts | red |
| A8d | growth within the share | `if (grown.total > share.total \|\| grown.frame > share.frame) v.push(  ->  if (false) v.push(` | test/size-rules.test.ts | red |
| A8e | a design row on an asset-free landing | `} else if (g.length > 0) v.push(`${word}: the landing changes no frame  ->  } else if (false) v.push(`${word}: the landing changes no frame` | test/size-rules.test.ts | red |
| A8f | a correction's second row equals the recomputation | `if (right.total !== now.total \|\| right.frame !== now.frame) v.push(  ->  if (false) v.push(` | test/size-rules.test.ts | red |
| A8g | a superseding share not below growth | `if (r.total < grown.total \|\| r.frame < grown.frame) v.push(  ->  if (false) v.push(` | test/size-rules.test.ts | red |
| A8h | a layout at most the default | `if (size > defaults) v.push(  ->  if (false) v.push(` | test/size-rules.test.ts | red |
| A8i | none appends no growth row | `if (g.length > 0) v.push('none: the landing appends a growth row');  ->  if (false) v.push('none: the landing appends a growth row');` | test/size-rules.test.ts | red |
| A8j | the newest row is the recomputation | `if (newest === undefined \|\| newest.total !== now.total \|\| newest.frame !== now.frame) v.push(  ->  if (false) v.push(` | test/size-rules.test.ts | red |
| A8k | baseline is a reserved word | `if (word === 'baseline') v.push(  ->  if (word === 'baseline-x') v.push(` | test/size-rules.test.ts | red |
| A8l | a growth row needs a base share row | `if (shareOf(base.shares as Table, design) !== undefined) return true;  ->  if (shareOf(base.shares as Table, design) !== undefined \|\| true) return true;` | test/size-rules.test.ts | red |
| A8m | genesis: exactly two share rows | `if (s.length !== 2) v.push(`genesis: the shares  ->  if (s.length < 2) v.push(`genesis: the shares` | test/size-rules.test.ts | red |
| A8n | genesis: the baseline equals the parent's manifest | `if (!sameRow(g[0] as Row, { design: 'baseline', ...before }))  ->  if (false)` | test/size-rules.test.ts | red |
| A8o | a correction's first row is lowered | `if (wrong.total > baseNewest.total \|\| wrong.frame > baseNewest.frame) v.push(  ->  if (false) v.push(` | test/size-rules.test.ts | red |
| A8p | a share row only under shares | `if (s.length > 0) v.push('a share row lands only under  ->  if (false) v.push('a share row lands only under` | test/size-rules.test.ts | red |
| A8q | a changed sha256 is a frame-asset change | `if (base[n]?.sha256 !== head[n]?.sha256) return true;  ->  if (false) return true;` | test/size-rules.test.ts | red |
| A8r | the word is trimmed | `.map((l) => l.slice(SIZE_DESIGN_PREFIX.length).trim());  ->  .map((l) => l.slice(SIZE_DESIGN_PREFIX.length));` | test/size-rules.test.ts | red |
| A8s | frame counts the largest layout | `frame: rest + Math.max(0, ...Object.values(layoutSizes(m)))  ->  frame: rest` | test/size-rules.test.ts | red |
| A8t | genesis: the word is x1 | `if (word !== null && word !== 'x1')  ->  if (false)` | test/size-rules.test.ts | red |
| A8u | shares: at least one share row | `if (s.length === 0) v.push('shares: the landing appends no share row');  ->  if (false) v.push('shares: the landing appends no share row');` | test/size-rules.test.ts | red |
| A8v | genesis: exactly two growth rows | `if (g.length !== 2) v.push(`genesis:  ->  if (g.length < 2) v.push(`genesis:` | test/size-rules.test.ts | red |
| A8w | a correction names two designs | `if (wrong.design === right.design) v.push(  ->  if (false) v.push(` | test/size-rules.test.ts | red |
| A8x | the table parse refuses a non-canonical row | `if (rowText(row) !== body) throw  ->  if (false) throw` | test/size-rules.test.ts | red |
| A8y | genesis: x1 judged against the shares the landing adds | `if (grew.total > own.total \|\| grew.frame > own.frame) v.push(  ->  if (false) v.push(` | test/size-rules.test.ts | red |
| A8z | a correction names a design or rebaseline only | `if (d !== 'rebaseline' && RESERVED_WORDS.includes(d)) v.push(  ->  if (false) v.push(` | test/size-rules.test.ts | red |
| A8aa | a layout is compared with the enhance entry's chars | `const defaults = bundle?.layout === 'default' ? bundle.chars : undefined;  ->  const defaults = bundle?.layout === 'default' ? layouts['default'] : undefined;` | test/size-rules.test.ts | red |
| A8ab | genesis total share held on its own total only (frame side) | `grew.total > own.total \|\| grew.frame > own.frame  ->  grew.total > own.total` | test/size-rules.test.ts | red (review 2906 F6: first recorded as an equivalent mutant, which it is not; the argument held only for the real 1.1.0 base, and the pure rule accepts any first parent. A synthetic genesis, a base of two layouts of 40000 characters and a head whose enhance is 80000 with the other layout gone, grows the frame 40000 with the total unchanged, and the new row of `test/size-rules.test.ts` reds: 1 failed \| 61 passed (62)) |

```json
[
 {
  "row": "A8a",
  "guard": "the byte-equal check",
  "edit": "if (h.lines[i] !== line) v.push(  ->  if (h.lines[i] === \"never\") v.push(",
  "tests": "test/size-rules.test.ts",
  "result": "red"
 },
 {
  "row": "A8b",
  "guard": "one line only",
  "edit": "if (words.length !== 1) v.push(  ->  if (words.length < 1) v.push(",
  "tests": "test/size-rules.test.ts",
  "result": "red"
 },
 {
  "row": "A8c",
  "guard": "shares read from the first parent",
  "edit": "const share = shareOf(base.shares as Table, design);  ->  const share = shareOf(head.shares as Table, design);",
  "tests": "test/size-rules.test.ts",
  "result": "red"
 },
 {
  "row": "A8d",
  "guard": "growth within the share",
  "edit": "if (grown.total > share.total || grown.frame > share.frame) v.push(  ->  if (false) v.push(",
  "tests": "test/size-rules.test.ts",
  "result": "red"
 },
 {
  "row": "A8e",
  "guard": "a design row on an asset-free landing",
  "edit": "} else if (g.length > 0) v.push(`${word}: the landing changes no frame  ->  } else if (false) v.push(`${word}: the landing changes no frame",
  "tests": "test/size-rules.test.ts",
  "result": "red"
 },
 {
  "row": "A8f",
  "guard": "a correction's second row equals the recomputation",
  "edit": "if (right.total !== now.total || right.frame !== now.frame) v.push(  ->  if (false) v.push(",
  "tests": "test/size-rules.test.ts",
  "result": "red"
 },
 {
  "row": "A8g",
  "guard": "a superseding share not below growth",
  "edit": "if (r.total < grown.total || r.frame < grown.frame) v.push(  ->  if (false) v.push(",
  "tests": "test/size-rules.test.ts",
  "result": "red"
 },
 {
  "row": "A8h",
  "guard": "a layout at most the default",
  "edit": "if (size > defaults) v.push(  ->  if (false) v.push(",
  "tests": "test/size-rules.test.ts",
  "result": "red"
 },
 {
  "row": "A8i",
  "guard": "none appends no growth row",
  "edit": "if (g.length > 0) v.push('none: the landing appends a growth row');  ->  if (false) v.push('none: the landing appends a growth row');",
  "tests": "test/size-rules.test.ts",
  "result": "red"
 },
 {
  "row": "A8j",
  "guard": "the newest row is the recomputation",
  "edit": "if (newest === undefined || newest.total !== now.total || newest.frame !== now.frame) v.push(  ->  if (false) v.push(",
  "tests": "test/size-rules.test.ts",
  "result": "red"
 },
 {
  "row": "A8k",
  "guard": "baseline is a reserved word",
  "edit": "if (word === 'baseline') v.push(  ->  if (word === 'baseline-x') v.push(",
  "tests": "test/size-rules.test.ts",
  "result": "red"
 },
 {
  "row": "A8l",
  "guard": "a growth row needs a base share row",
  "edit": "if (shareOf(base.shares as Table, design) !== undefined) return true;  ->  if (shareOf(base.shares as Table, design) !== undefined || true) return true;",
  "tests": "test/size-rules.test.ts",
  "result": "red"
 },
 {
  "row": "A8m",
  "guard": "genesis: exactly two share rows",
  "edit": "if (s.length !== 2) v.push(`genesis: the shares  ->  if (s.length < 2) v.push(`genesis: the shares",
  "tests": "test/size-rules.test.ts",
  "result": "red"
 },
 {
  "row": "A8n",
  "guard": "genesis: the baseline equals the parent's manifest",
  "edit": "if (!sameRow(g[0] as Row, { design: 'baseline', ...before }))  ->  if (false)",
  "tests": "test/size-rules.test.ts",
  "result": "red"
 },
 {
  "row": "A8o",
  "guard": "a correction's first row is lowered",
  "edit": "if (wrong.total > baseNewest.total || wrong.frame > baseNewest.frame) v.push(  ->  if (false) v.push(",
  "tests": "test/size-rules.test.ts",
  "result": "red"
 },
 {
  "row": "A8p",
  "guard": "a share row only under shares",
  "edit": "if (s.length > 0) v.push('a share row lands only under  ->  if (false) v.push('a share row lands only under",
  "tests": "test/size-rules.test.ts",
  "result": "red"
 },
 {
  "row": "A8q",
  "guard": "a changed sha256 is a frame-asset change",
  "edit": "if (base[n]?.sha256 !== head[n]?.sha256) return true;  ->  if (false) return true;",
  "tests": "test/size-rules.test.ts",
  "result": "red"
 },
 {
  "row": "A8r",
  "guard": "the word is trimmed",
  "edit": ".map((l) => l.slice(SIZE_DESIGN_PREFIX.length).trim());  ->  .map((l) => l.slice(SIZE_DESIGN_PREFIX.length));",
  "tests": "test/size-rules.test.ts",
  "result": "red"
 },
 {
  "row": "A8s",
  "guard": "frame counts the largest layout",
  "edit": "frame: rest + Math.max(0, ...Object.values(layoutSizes(m)))  ->  frame: rest",
  "tests": "test/size-rules.test.ts",
  "result": "red"
 },
 {
  "row": "A8t",
  "guard": "genesis: the word is x1",
  "edit": "if (word !== null && word !== 'x1')  ->  if (false)",
  "tests": "test/size-rules.test.ts",
  "result": "red"
 },
 {
  "row": "A8u",
  "guard": "shares: at least one share row",
  "edit": "if (s.length === 0) v.push('shares: the landing appends no share row');  ->  if (false) v.push('shares: the landing appends no share row');",
  "tests": "test/size-rules.test.ts",
  "result": "red"
 },
 {
  "row": "A8v",
  "guard": "genesis: exactly two growth rows",
  "edit": "if (g.length !== 2) v.push(`genesis:  ->  if (g.length < 2) v.push(`genesis:",
  "tests": "test/size-rules.test.ts",
  "result": "red"
 },
 {
  "row": "A8w",
  "guard": "a correction names two designs",
  "edit": "if (wrong.design === right.design) v.push(  ->  if (false) v.push(",
  "tests": "test/size-rules.test.ts",
  "result": "red"
 },
 {
  "row": "A8x",
  "guard": "the table parse refuses a non-canonical row",
  "edit": "if (rowText(row) !== body) throw  ->  if (false) throw",
  "tests": "test/size-rules.test.ts",
  "result": "red"
 },
 {
  "row": "A8y",
  "guard": "genesis: x1 judged against the shares the landing adds",
  "edit": "if (grew.total > own.total || grew.frame > own.frame) v.push(  ->  if (false) v.push(",
  "tests": "test/size-rules.test.ts",
  "result": "red"
 },
 {
  "row": "A8z",
  "guard": "a correction names a design or rebaseline only",
  "edit": "if (d !== 'rebaseline' && RESERVED_WORDS.includes(d)) v.push(  ->  if (false) v.push(",
  "tests": "test/size-rules.test.ts",
  "result": "red"
 },
 {
  "row": "A8aa",
  "guard": "a layout is compared with the enhance entry's chars",
  "edit": "const defaults = bundle?.layout === 'default' ? bundle.chars : undefined;  ->  const defaults = bundle?.layout === 'default' ? layouts['default'] : undefined;",
  "tests": "test/size-rules.test.ts",
  "result": "red"
 },
 {
  "row": "A8ab",
  "guard": "genesis total share held on its own total only (frame side)",
  "edit": "grew.total > own.total || grew.frame > own.frame  ->  grew.total > own.total",
  "tests": "test/size-rules.test.ts",
  "result": "red (review 2906 F6; first recorded as an equivalent mutant, which it is not: a synthetic genesis whose frame grows with the total unchanged reds it; 1 failed | 61 passed (62))"
 }
]
```

## Second review F13: the package guard of F17

`package.json`'s `sideEffects` names `./dist/frame/appearance.js`, the one module that freezes the appearance contract's lists in place at its top level, so a bundler keeps its body; `test/package.test.ts` pins the entry and pins that `src/frame/appearance.ts` still holds a top-level freeze. Unmutated, `test/package.test.ts` is 23 passed (23).

| Row | Guard | Edit | Tests run | Result |
|---|---|---|---|---|
| F17-side | the `sideEffects` list names the freezing module | the `./dist/frame/appearance.js` entry removed from package.json (restored from a saved copy, sha256 checked) | `test/package.test.ts` | red: 1 failed, 22 passed (the sideEffects row) |
| F17-freeze-3 | the freezing module still freezes | the first three `Object.freeze` lines of src/frame/appearance.ts commented out | `test/package.test.ts` | green (23 passed): the pin is a pattern for any top-level freeze, and three more remain. Not a gap: the guard is "no freeze at all" |
| F17-freeze | the freezing module still freezes | every top-level `Object.freeze` line of src/frame/appearance.ts (lines 8 to 13) commented out (restored from a saved copy, sha256 checked) | `test/package.test.ts` | red: 1 failed, 22 passed (the same row) |

```json
[
 {"row":"F17-side","guard":"the sideEffects list names the freezing module","edit":"the ./dist/frame/appearance.js entry removed from package.json","tests":"test/package.test.ts","result":"red (1 failed | 22 passed)"},
 {"row":"F17-freeze-3","guard":"the freezing module still freezes","edit":"the first three Object.freeze lines of src/frame/appearance.ts commented out","tests":"test/package.test.ts","result":"green (23 passed): equivalent for this guard, three top-level freezes remain, and the pin asks for any"},
 {"row":"F17-freeze","guard":"the freezing module still freezes","edit":"every top-level Object.freeze line of src/frame/appearance.ts commented out","tests":"test/package.test.ts","result":"red (1 failed | 22 passed)"}
]
```
