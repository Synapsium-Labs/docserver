# Task 3 mutation rows (the wire: FRAME_ACCEPTS, the op, the seed fields, test 9)

Each row mutated one source file in place (original bytes saved, sha256 checked after each restore), one at a time, and ran the named tests with `DOCSERVER_BOUNDARY_BASE=origin/main` (the genesis landing's simulated first parent). A3a to A3j are the plan's rows; A3k to A3p are the guards this task added beyond them (the face's signature and decoded-byte caps, the `fonts` shape, the seed's nested shape, the `v` value and the verdict being seeded). A3m's first run was killed by the shared test slice's memory cap (no verdict) and was run again: red.

| Row | Guard | File | Edit | Tests run | Result |
|---|---|---|---|---|---|
| A3a | appearance needs v | `src/frame-runtime/inbound.ts` | accept `appearance` without `v` | `test/frame-runtime.test.ts` | red (2 failed / 81 passed (83)) |
| A3b | appearance must be a plain object | `src/frame-runtime/inbound.ts` | accept a non-plain `appearance` | `test/frame-runtime.test.ts` | red (3 failed / 80 passed (83)) |
| A3c | the port parser accepts only FRAME_ACCEPTS | `src/frame-runtime/inbound.ts` | hard-code a fifth accepted op (`hello`) beside the list | `test/frame-boundaries.test.ts test/frame-runtime.test.ts` | red (3 failed / 97 passed (100)) |
| A3d | FRAME_ACCEPTS holds appearance | `src/frame/protocol.ts` | FRAME_ACCEPTS loses `appearance` | `test/frame-protocol.test.ts test/frame-boundaries.test.ts test/frame-runtime.test.ts` | red (7 failed / 318 passed (325)) |
| A3e | fonts has only sans and mono | `src/frame/seed.ts` | the seed accepts `fonts` with a third key | `test/frame-seed.test.ts` | red (1 failed / 171 passed (172)) |
| A3f | a face is base64 | `src/frame/seed.ts` | the seed accepts a non-base64 face | `test/frame-seed.test.ts` | red (1 failed / 171 passed (172)) |
| A3g | the cap counts the fonts | `src/frame/seed.ts` | the cap formula leaves out the fonts | `test/frame-seed.test.ts` | red (2 failed / 170 passed (172)) |
| A3h | the cap counts the appearance | `src/frame/seed.ts` | the cap formula leaves out the appearance | `test/frame-seed.test.ts` | red (2 failed / 170 passed (172)) |
| A3i | dispatch routes appearance to the reader | `src/frame-runtime/dispatch.ts` | dispatch drops the op | `test/frame-runtime.test.ts` | red (1 failed / 82 passed (83)) |
| A3j | the mask touches hash sources only | `test/frame-boundaries.test.ts` | a mask that also matches `'none'` | `test/frame-boundaries.test.ts` | red (1 failed / 16 passed (17)) |
| A3k | a face carries the wOF2 signature | `src/frame/document.ts` | the signature check is dropped | `test/frame-document.test.ts` | red (1 failed / 226 passed (235)) |
| A3l | a face is at most 131072 decoded bytes | `src/frame/document.ts` | the decoded-byte cap is dropped | `test/frame-document.test.ts` | red (2 failed / 222 passed (235)) |
| A3m | fonts must be a plain object | `src/frame/document.ts` | a non-plain `fonts` is not refused | `test/frame-document.test.ts` | red (1 failed / 234 passed (235)) |
| A3n | appearance is at most two levels deep | `src/frame/seed.ts` | the seed accepts a nested group of any shape | `test/frame-seed.test.ts` | red (1 failed / 171 passed (172)) |
| A3o | v is the number 1 | `src/frame-runtime/inbound.ts` | accept any `v` that is present | `test/frame-runtime.test.ts` | red (2 failed / 81 passed (83)) |
| A3p | the host value goes through parseAppearance | `src/frame/document.ts` | the raw value is seeded, not the verdict | `test/frame-document.test.ts` | red (3 failed / 224 passed (235)) |

```json
[
 {
  "row": "A3a",
  "guard": "appearance needs v",
  "edit": "accept `appearance` without `v`",
  "file": "src/frame-runtime/inbound.ts",
  "tests": "test/frame-runtime.test.ts",
  "result": "red (2 failed | 81 passed (83))"
 },
 {
  "row": "A3b",
  "guard": "appearance must be a plain object",
  "edit": "accept a non-plain `appearance`",
  "file": "src/frame-runtime/inbound.ts",
  "tests": "test/frame-runtime.test.ts",
  "result": "red (3 failed | 80 passed (83))"
 },
 {
  "row": "A3c",
  "guard": "the port parser accepts only FRAME_ACCEPTS",
  "edit": "hard-code a fifth accepted op (`hello`) beside the list",
  "file": "src/frame-runtime/inbound.ts",
  "tests": "test/frame-boundaries.test.ts test/frame-runtime.test.ts",
  "result": "red (3 failed | 97 passed (100))"
 },
 {
  "row": "A3d",
  "guard": "FRAME_ACCEPTS holds appearance",
  "edit": "FRAME_ACCEPTS loses `appearance`",
  "file": "src/frame/protocol.ts",
  "tests": "test/frame-protocol.test.ts test/frame-boundaries.test.ts test/frame-runtime.test.ts",
  "result": "red (7 failed | 318 passed (325))"
 },
 {
  "row": "A3e",
  "guard": "fonts has only sans and mono",
  "edit": "the seed accepts `fonts` with a third key",
  "file": "src/frame/seed.ts",
  "tests": "test/frame-seed.test.ts",
  "result": "red (1 failed | 171 passed (172))"
 },
 {
  "row": "A3f",
  "guard": "a face is base64",
  "edit": "the seed accepts a non-base64 face",
  "file": "src/frame/seed.ts",
  "tests": "test/frame-seed.test.ts",
  "result": "red (1 failed | 171 passed (172))"
 },
 {
  "row": "A3g",
  "guard": "the cap counts the fonts",
  "edit": "the cap formula leaves out the fonts",
  "file": "src/frame/seed.ts",
  "tests": "test/frame-seed.test.ts",
  "result": "red (2 failed | 170 passed (172))"
 },
 {
  "row": "A3h",
  "guard": "the cap counts the appearance",
  "edit": "the cap formula leaves out the appearance",
  "file": "src/frame/seed.ts",
  "tests": "test/frame-seed.test.ts",
  "result": "red (2 failed | 170 passed (172))"
 },
 {
  "row": "A3i",
  "guard": "dispatch routes appearance to the reader",
  "edit": "dispatch drops the op",
  "file": "src/frame-runtime/dispatch.ts",
  "tests": "test/frame-runtime.test.ts",
  "result": "red (1 failed | 82 passed (83))"
 },
 {
  "row": "A3j",
  "guard": "the mask touches hash sources only",
  "edit": "a mask that also matches `'none'`",
  "file": "test/frame-boundaries.test.ts",
  "tests": "test/frame-boundaries.test.ts",
  "result": "red (1 failed | 16 passed (17))"
 },
 {
  "row": "A3k",
  "guard": "a face carries the wOF2 signature",
  "edit": "the signature check is dropped",
  "file": "src/frame/document.ts",
  "tests": "test/frame-document.test.ts",
  "result": "red (1 failed | 226 passed (235))"
 },
 {
  "row": "A3l",
  "guard": "a face is at most 131072 decoded bytes",
  "edit": "the decoded-byte cap is dropped",
  "file": "src/frame/document.ts",
  "tests": "test/frame-document.test.ts",
  "result": "red (2 failed | 222 passed (235))"
 },
 {
  "row": "A3m",
  "guard": "fonts must be a plain object",
  "edit": "a non-plain `fonts` is not refused",
  "file": "src/frame/document.ts",
  "tests": "test/frame-document.test.ts",
  "result": "red (1 failed | 234 passed (235))"
 },
 {
  "row": "A3n",
  "guard": "appearance is at most two levels deep",
  "edit": "the seed accepts a nested group of any shape",
  "file": "src/frame/seed.ts",
  "tests": "test/frame-seed.test.ts",
  "result": "red (1 failed | 171 passed (172))"
 },
 {
  "row": "A3o",
  "guard": "v is the number 1",
  "edit": "accept any `v` that is present",
  "file": "src/frame-runtime/inbound.ts",
  "tests": "test/frame-runtime.test.ts",
  "result": "red (2 failed | 81 passed (83))"
 },
 {
  "row": "A3p",
  "guard": "the host value goes through parseAppearance",
  "edit": "the raw value is seeded, not the verdict",
  "file": "src/frame/document.ts",
  "tests": "test/frame-document.test.ts",
  "result": "red (3 failed | 224 passed (235))"
 }
]
```
