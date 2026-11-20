# Parity Task 1: mutation rows (the wire)

Each row was measured in place on this wave's branch: the bytes of the file saved with their sha256, one edit applied, the tests named in the row run through the fleet test wrapper as `./node_modules/.bin/vitest run --maxWorkers=1 --reporter=json`, then the file restored from the saved bytes (`cp`) and its sha256 compared. The restore sha256 of each file is `src/frame-runtime/dispatch.ts` `759f38563e886a2903511802d0012a09f5c648e57a9d1b4a85db28eef2ecfb03`; `src/frame-runtime/inbound.ts` `2e684ba08883bd9ed2fabf4c02f0c780ca927a3d5932245e83225d9218d2e090`; `src/frame/anchor.ts` `e2595021d1b32393d307a5b8f8472a54e919943d063a8f8efd5be53e48133c26`; `src/frame/document.ts` `f0d337ab95f4f67c141a50eb9b747b29b4109b21ff8d989039434dd2df87e3fe`; `src/frame/protocol.ts` `cba5d6e7996e55b2f7604028c8be90faedfbd771fee8943ae099752ba46a11df`. Every row exited 1 and every failing test failed with an `AssertionError`; none went red through a load or compile failure. Rows P1a to P1c and P1h measure `test/frame-runtime.test.ts`, P1d `test/frame-protocol.test.ts` and `test/frame-boundaries.test.ts`, P1e `test/frame-document.test.ts` and `test/frame-seed.test.ts`, P1f, P1g and P1i `test/frame-anchor.test.ts`.

| Row | Guard | Edit | File | Result |
|---|---|---|---|---|
| P1a | goto needs an id | the port parser accepts a `goto` whose `id` is absent | `src/frame-runtime/inbound.ts` | red: 2 failed \| 89 passed (91). parseParentMessage: what the frame accepts on the port (Reference §6.5, §8.2) command: every parent-to-frame fixture of the op is judged as its verdict says, by the frame's own parser (B7.1); parseParentMessage: what the frame accepts on the port (Reference §6.5, §8.2) command: close-overlay, goto and print-figures (docserver parity T1, ruling R1) goto: an id by the fragment grammar, a from optional; the id is required (P1a) |
| P1b | only goto carries id or from | the port parser accepts an `id` or a `from` on every command (the size check of the other names removed) | `src/frame-runtime/inbound.ts` | red: 3 failed \| 88 passed (91). parseParentMessage: what the frame accepts on the port (Reference §6.5, §8.2) command: every parent-to-frame fixture of the op is judged as its verdict says, by the frame's own parser (B7.1); parseParentMessage: what the frame accepts on the port (Reference §6.5, §8.2) command: close-overlay, goto and print-figures (docserver parity T1, ruling R1) close-overlay and print-figures: exactly {name}; an id or a from on either is ignored (P1b); parseParentMessage: what the frame accepts on the port (Reference §6.5, §8.2) command: close-overlay, goto and print-figures (docserver parity T1, ruling R1) the four older names take no id or from either |
| P1c | from at most 4096 | the cap on `from` is 4097 code units | `src/frame-runtime/inbound.ts` | red: 2 failed \| 89 passed (91). parseParentMessage: what the frame accepts on the port (Reference §6.5, §8.2) command: every parent-to-frame fixture of the op is judged as its verdict says, by the frame's own parser (B7.1); parseParentMessage: what the frame accepts on the port (Reference §6.5, §8.2) command: close-overlay, goto and print-figures (docserver parity T1, ruling R1) goto: from is a string of at most 4096 code units, and nothing deeper (P1c, B4) |
| P1d | FRAME_ACCEPTS is unchanged | `FRAME_ACCEPTS` gains the word `place` | `src/frame/protocol.ts` | red: 5 failed \| 270 passed (275). the record: its shape and its newest entries the newest entry equals the values computed now: FRAME_OPS, FRAME_ACCEPTS and the masked frameCsp(); the record: its shape and its newest entries the computed lists are the newest entry's: FRAME_OPS ends with `place` and `print-figure`, and FRAME_ACCEPTS is the five ops it was after the appearance contract; the port parser accepts exactly FRAME_ACCEPTS: one well-formed message per op name, and a planted name the names it accepts, as the same op back, are exactly FRAME_ACCEPTS; and 2 more |
| P1e | places is off by default | `places` defaults to true in the seed's bridge (it leaves the off-by-default list) | `src/frame/document.ts` | red: 10 failed \| 406 passed (416). L3.M7 the real version, images, snapshot, features and bridge: seeded as given, refused invalid-input outside their caps every field at a real value is seeded as given, and the seed passes the bootstrap's validator; L3.M7 the real version, images, snapshot, features and bridge: seeded as given, refused invalid-input outside their caps absent fields are seeded at their defaults; L3.M7 the real version, images, snapshot, features and bridge: seeded as given, refused invalid-input outside their caps a value whose key is undefined counts as absent, as JSON writes it; and 7 more |
| P1f | padding counted | `pngBytesOfBase64` takes its size from the length alone, ignoring the padding | `src/frame/anchor.ts` | red: 4 failed \| 47 passed (51). pngBytesOfBase64: the decoded size of canonical base64, from its length and padding, else null is the decoded size for every length from 0 to 40, and agrees with Node's decoder; pngBytesOfBase64: the decoded size of canonical base64, from its length and padding, else null counts the padding: one and two bytes in the last group are two and three characters of data; pngBytesOfBase64: the decoded size of canonical base64, from its length and padding, else null measures the print-figure edges: 1 048 575, 1 048 576 and 1 048 577 bytes, and 16 MiB; and 1 more |
| P1g | y not negative | `isAnchorToken` accepts a `y` below zero | `src/frame/anchor.ts` | red: 3 failed \| 48 passed (51). isAnchorToken: every rejected shape of nav's check is rejected, and the two agree on every row a y below zero: refused, as nav refuses it; isAnchorToken: every rejected shape of nav's check is rejected, and the two agree on every row a y just below zero: refused, as nav refuses it; isAnchorToken: every rejected shape of nav's check is rejected, and the two agree on every row agrees with nav on a sweep of generated texts: every combination of line, offset and y, edges and breakers |
| P1h | dispatch hands goto on | dispatch drops `goto` (the reader is never called for it) | `src/frame-runtime/dispatch.ts` | red: 1 failed \| 90 passed (91). B7.4 the frame's port: a command reaches the reader, and a command that fails never stops the port (batch 1.1, C108) goto hands the reader its id and from as a third argument; close-overlay and print-figures hand nothing more (ruling R1, P1h) |
| P1i | a padded text has its unused bits zero | the canonical-bits check of a padded last character is removed (`QR==` and `QUK=` are then sized, not refused) | `src/frame/anchor.ts` | red: 1 failed \| 50 passed (51). pngBytesOfBase64: the decoded size of canonical base64, from its length and padding, else null wants the unused bits of the last character to be zero (canonical): QR== and QUK= are not the text that Node writes |

## Choices

- **No frame-to-parent fixtures yet.** `place`, `print-figure` and the `push` and `from` of `hash` are in the tables (`OP_KEYS`, `FRAME_OPS`) and in the types, but `conformance/bridge-cases.json` gains only the parent-to-frame `command` cases of this task: `test/host-parse.test.ts` replays every frame-to-parent case through `./host`'s parser, which reads none of them until the host task writes its grammar and its gating by the seed's `bridge`. Until then `./host`'s parser refuses `place` and `print-figure` as `unknown-op` and a `hash` carrying `push` or `from` as `keys`, so no frame of this version can reach an adapter with them. The one existing case that used `push` as a key outside the op's set, `a key outside the op set`, now uses another key.
- **`from` is judged by length at the port.** The frame's port parser checks `from` as a string of at most `ANCHOR_LIMITS.from` UTF-16 code units and nothing deeper; the token's grammar (`isAnchorToken`) is `./host`'s and the reader's, and the bootstrap does not bundle it. Held equal to the reader's own check by `test/frame-anchor.test.ts`.
- **Canonical base64.** `pngBytesOfBase64` also requires the unused low bits of the last character to be zero when the text is padded, so a figure has one spelling per byte string; Node's decoder accepts the non-canonical spellings, so the refusal is this function's.
- **Where the defaults live.** The bridge switches that default to false are listed in `src/frame/document.ts`, the host side, and not in `src/frame/seed.ts`: the seed's module is bundled into the bootstrap, and a frozen list there would cost the bootstrap bytes it does not use.
- **Bootstrap growth.** The bootstrap went from 31 161 to 31 915 bytes (+754) against its budget of 32 768; the other four assets did not move.

```json
[
  {
    "id": "P1a",
    "guard": "goto needs an id",
    "edit": "the port parser accepts a `goto` whose `id` is absent",
    "file": "src/frame-runtime/inbound.ts",
    "tests": "test/frame-runtime.test.ts",
    "rc": 1,
    "failed": 2,
    "passed": 89,
    "total": 91,
    "red": [
      "parseParentMessage: what the frame accepts on the port (Reference \u00a76.5, \u00a78.2) command: every parent-to-frame fixture of the op is judged as its verdict says, by the frame's own parser (B7.1)",
      "parseParentMessage: what the frame accepts on the port (Reference \u00a76.5, \u00a78.2) command: close-overlay, goto and print-figures (docserver parity T1, ruling R1) goto: an id by the fragment grammar, a from optional; the id is required (P1a)"
    ]
  },
  {
    "id": "P1b",
    "guard": "only goto carries id or from",
    "edit": "the port parser accepts an `id` or a `from` on every command (the size check of the other names removed)",
    "file": "src/frame-runtime/inbound.ts",
    "tests": "test/frame-runtime.test.ts",
    "rc": 1,
    "failed": 3,
    "passed": 88,
    "total": 91,
    "red": [
      "parseParentMessage: what the frame accepts on the port (Reference \u00a76.5, \u00a78.2) command: every parent-to-frame fixture of the op is judged as its verdict says, by the frame's own parser (B7.1)",
      "parseParentMessage: what the frame accepts on the port (Reference \u00a76.5, \u00a78.2) command: close-overlay, goto and print-figures (docserver parity T1, ruling R1) close-overlay and print-figures: exactly {name}; an id or a from on either is ignored (P1b)",
      "parseParentMessage: what the frame accepts on the port (Reference \u00a76.5, \u00a78.2) command: close-overlay, goto and print-figures (docserver parity T1, ruling R1) the four older names take no id or from either"
    ]
  },
  {
    "id": "P1c",
    "guard": "from at most 4096",
    "edit": "the cap on `from` is 4097 code units",
    "file": "src/frame-runtime/inbound.ts",
    "tests": "test/frame-runtime.test.ts",
    "rc": 1,
    "failed": 2,
    "passed": 89,
    "total": 91,
    "red": [
      "parseParentMessage: what the frame accepts on the port (Reference \u00a76.5, \u00a78.2) command: every parent-to-frame fixture of the op is judged as its verdict says, by the frame's own parser (B7.1)",
      "parseParentMessage: what the frame accepts on the port (Reference \u00a76.5, \u00a78.2) command: close-overlay, goto and print-figures (docserver parity T1, ruling R1) goto: from is a string of at most 4096 code units, and nothing deeper (P1c, B4)"
    ]
  },
  {
    "id": "P1d",
    "guard": "FRAME_ACCEPTS is unchanged",
    "edit": "`FRAME_ACCEPTS` gains the word `place`",
    "file": "src/frame/protocol.ts",
    "tests": "test/frame-protocol.test.ts, test/frame-boundaries.test.ts",
    "rc": 1,
    "failed": 5,
    "passed": 270,
    "total": 275,
    "red": [
      "the record: its shape and its newest entries the newest entry equals the values computed now: FRAME_OPS, FRAME_ACCEPTS and the masked frameCsp()",
      "the record: its shape and its newest entries the computed lists are the newest entry's: FRAME_OPS ends with `place` and `print-figure`, and FRAME_ACCEPTS is the five ops it was after the appearance contract",
      "the port parser accepts exactly FRAME_ACCEPTS: one well-formed message per op name, and a planted name the names it accepts, as the same op back, are exactly FRAME_ACCEPTS",
      "OP_KEYS: the op key sets per t, one table for both parsers FRAME_ACCEPTS is the port parser's list: the four ops of 1.1.0 and `appearance`, frozen, with no `hello`, and inside PARENT_OPS",
      "the parity wire (docserver parity T1): the places, the print figures and the goto command FRAME_ACCEPTS did not grow: place and print-figure go to the parent, and goto is a command (P1d)"
    ]
  },
  {
    "id": "P1e",
    "guard": "places is off by default",
    "edit": "`places` defaults to true in the seed's bridge (it leaves the off-by-default list)",
    "file": "src/frame/document.ts",
    "tests": "test/frame-document.test.ts, test/frame-seed.test.ts",
    "rc": 1,
    "failed": 10,
    "passed": 406,
    "total": 416,
    "red": [
      "L3.M7 the real version, images, snapshot, features and bridge: seeded as given, refused invalid-input outside their caps every field at a real value is seeded as given, and the seed passes the bootstrap's validator",
      "L3.M7 the real version, images, snapshot, features and bridge: seeded as given, refused invalid-input outside their caps absent fields are seeded at their defaults",
      "L3.M7 the real version, images, snapshot, features and bridge: seeded as given, refused invalid-input outside their caps a value whose key is undefined counts as absent, as JSON writes it",
      "B7.2 the progress switch: absent is false while the five answered bridge switches default to true (batch 1.1, C108) no bridge at all seeds progress false and the other switches true",
      "B7.2 the progress switch: absent is false while the five answered bridge switches default to true (batch 1.1, C108) a bridge that leaves progress out seeds it false, whatever it sets of the others",
      "B7.2 the progress switch: absent is false while the five answered bridge switches default to true (batch 1.1, C108) progress: true and progress: false are seeded as given; the others keep their defaults",
      "B7.2 the progress switch: absent is false while the five answered bridge switches default to true (batch 1.1, C108) places and printFigures are off unless asked for, in any bridge that leaves them out (P1e)",
      "B7.2 the progress switch: absent is false while the five answered bridge switches default to true (batch 1.1, C108) places: true and printFigures: true are seeded as given, each alone, and the seed passes the validator",
      "L3.M7 Task 3 the default keys: frameDocument's seed holds every schema 1 key at its default mermaid off: exactly SEED_KEYS, each new key at its default, and the seed passes validateSeed",
      "L3.M1/M2 the frame mutants: the clean template is this version's frameDocument output, and every mutant fails its row with the real texts clean.html is the fixture's srcdoc with the policy and each asset as its placeholder (UPDATE_FRAME_MUTANTS=1 rewrites it)"
    ]
  },
  {
    "id": "P1f",
    "guard": "padding counted",
    "edit": "`pngBytesOfBase64` takes its size from the length alone, ignoring the padding",
    "file": "src/frame/anchor.ts",
    "tests": "test/frame-anchor.test.ts",
    "rc": 1,
    "failed": 4,
    "passed": 47,
    "total": 51,
    "red": [
      "pngBytesOfBase64: the decoded size of canonical base64, from its length and padding, else null is the decoded size for every length from 0 to 40, and agrees with Node's decoder",
      "pngBytesOfBase64: the decoded size of canonical base64, from its length and padding, else null counts the padding: one and two bytes in the last group are two and three characters of data",
      "pngBytesOfBase64: the decoded size of canonical base64, from its length and padding, else null measures the print-figure edges: 1 048 575, 1 048 576 and 1 048 577 bytes, and 16 MiB",
      "pngBytesOfBase64: the decoded size of canonical base64, from its length and padding, else null wants the unused bits of the last character to be zero (canonical): QR== and QUK= are not the text that Node writes"
    ]
  },
  {
    "id": "P1g",
    "guard": "y not negative",
    "edit": "`isAnchorToken` accepts a `y` below zero",
    "file": "src/frame/anchor.ts",
    "tests": "test/frame-anchor.test.ts",
    "rc": 1,
    "failed": 3,
    "passed": 48,
    "total": 51,
    "red": [
      "isAnchorToken: every rejected shape of nav's check is rejected, and the two agree on every row a y below zero: refused, as nav refuses it",
      "isAnchorToken: every rejected shape of nav's check is rejected, and the two agree on every row a y just below zero: refused, as nav refuses it",
      "isAnchorToken: every rejected shape of nav's check is rejected, and the two agree on every row agrees with nav on a sweep of generated texts: every combination of line, offset and y, edges and breakers"
    ]
  },
  {
    "id": "P1h",
    "guard": "dispatch hands goto on",
    "edit": "dispatch drops `goto` (the reader is never called for it)",
    "file": "src/frame-runtime/dispatch.ts",
    "tests": "test/frame-runtime.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 90,
    "total": 91,
    "red": [
      "B7.4 the frame's port: a command reaches the reader, and a command that fails never stops the port (batch 1.1, C108) goto hands the reader its id and from as a third argument; close-overlay and print-figures hand nothing more (ruling R1, P1h)"
    ]
  },
  {
    "id": "P1i",
    "guard": "a padded text has its unused bits zero",
    "edit": "the canonical-bits check of a padded last character is removed (`QR==` and `QUK=` are then sized, not refused)",
    "file": "src/frame/anchor.ts",
    "tests": "test/frame-anchor.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 50,
    "total": 51,
    "red": [
      "pngBytesOfBase64: the decoded size of canonical base64, from its length and padding, else null wants the unused bits of the last character to be zero (canonical): QR== and QUK= are not the text that Node writes"
    ]
  }
]
```
