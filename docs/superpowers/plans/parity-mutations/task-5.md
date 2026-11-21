# Parity Task 5: mutation rows (the In short option, the comparison base, and the bootstrap split)

Each row was measured in place on this wave's branch: the bytes of the file saved with their sha256, one edit applied, the tests named in the row run through the fleet test wrapper as `./node_modules/.bin/vitest run --maxWorkers=2 --reporter=json`, then the file restored from the saved bytes (`cp`-equivalent, written back) and its sha256 compared (each matched). A row whose file is an input of the frame build was measured with the frame rebuilt under the edit (`node scripts/build-frame.mjs`), so that the manifest agrees with the mutated assets and the row goes red through its own assertion and not through an `asset-mismatch`; the generated files were then rebuilt from the restored sources and `node scripts/build-frame.mjs --check` was green after each. The browser rows run in Chromium (`DOCREADER_BROWSERS=chromium`); WebKit is CI's. Sha256 of each file as restored: `assets/reader.css` `19011025e3f40c49f9585d7d09c6948d7c9861c2d092a2717ff5a7f5f8f2455d`, `src/enhance/editorial.ts` `59d872c62f5fcea4d810d52149c5eaf908dd66390d9a167dbed6102587cec737`, `src/enhance/options.ts` `b2afb5999e4e39f30302c3b94afa0b7e84ef54abb75e58a61c7569626ff8a03d`, `src/enhance/since.ts` `6449f94eaa268213c972ff46de0b7888dcd07c6591559c85fe0798983bd8cfda`, `src/frame-runtime/bootstrap.ts` `03af1c8e0b04c45c37ca70d23752901f2f7d6caa87dcd9a8513b9d91b5a69ef7`, `src/frame/document.ts` `681556823079c622c6bb48a1c1b9bb7c2fe3acf124b14ec9d4d891c1175ea1bf`, `src/frame/seed.ts` `80b2dde63e9ba68f24e54f6585b837a53f92fb3fc0852a348763164f510b38c5`, `src/host/mount.ts` `ca40f85165e6a68d9e19cef3442e8c5add3767e6a5fc96d4655906d5e2a65602`. Rows P5a to P5f are the plan's; P5g to P5t are this task's own guards (P5p: the host's own message, since the bootstrap's validator would refuse a short sha anyway); P5s1 and P5s2 are the bootstrap split's (the vocabulary's words judged on the host side and in the reader; the bundled check holds a plain object only).


| Row | Guard | Edit | File | Result |
|---|---|---|---|---|
| P5a | the switch is drawn only with the flag on | the box gets its switch whatever `inShort` says | `src/enhance/editorial.ts` | red: 3 failed \| 15 passed (18). the switch is there by the flag, and only then with the flag on, the box carries a group of two buttons, Headl; the switch is there by the flag, and only then with the flag off or left out, the box is 1.1's: no switch, no ; the choice is kept in the UI memory keeps no choice when the flag is off: a stored Headlines changes nothing |
| P5b | Headlines hides the rest, never the lead | the rest of a strong-lead item begins at the item's start, so Headlines hides the lead too | `src/enhance/editorial.ts` | red: 2 failed \| 16 passed (18). the two views Headlines shows each item's lead (its first strong run, else its first sentence) and hides the r; the two views cuts a nested list and the text after a strong run into the rest, and an item with no sentence e |
| P5c | the choice is kept in the UI memory | the choice is not written | `src/enhance/editorial.ts` | red: 2 failed \| 16 passed (18). the choice is kept in the UI memory writes the choice as the `inshort` field of the reader-wide UI memory, and; the choice is kept in the UI memory leaves the other fields of the UI memory as they were |
| P5d | the base is asked of the host once | the seeded base is also asked of the host directly, beside the menu's own show | `src/enhance/since.ts` | red: 3 failed \| 19 passed (26). the comparison base: asked of `changes` once, and shown as a comparison asks once, for the base, and shows the; the comparison base: asked of `changes` once, and shown as a comparison is asked of the host once however the ; the comparison base: asked of `changes` once, and shown as a comparison shows nothing when the host cannot ans |
| P5e | the seed check takes a full sha only | the bundled check for `changesBase` accepts 7 to 64 hex digits | `src/frame/seed.ts` | red: 5 failed \| 186 passed (191). L3.M4 validateSeed: each bad field refused by its own name, with the nonce kept changesBase = "abc1234": chang; L3.M4 validateSeed: each bad field refused by its own name, with the nonce kept changesBase = "aaaaaaaaaaaaaaa; L3.M4 validateSeed: each bad field refused by its own name, with the nonce kept changesBase = "aaaaaaaaaaaaaaa |
| P5f | the pressed button is told by weight and bar, not by colour alone | the hosted rule for the pressed view button is removed (colour only) | `assets/reader.css` | red: 2 failed \| 27 passed (58). chromium the summary box's pressed view button is at 600 with an inset bottom bar of 2px in accent, and the un; chromium the switch the reader draws has the same pressed button: at 600 with an inset bottom bar of 2px in ac |
| P5g | a sentence ends the lead of an item with no strong run | no text is a sentence end, so an item with no strong run keeps all of it in Headlines | `src/enhance/editorial.ts` | red: 2 failed \| 16 passed (18). the two views Headlines shows each item's lead (its first strong run, else its first sentence) and hides the r; the choice is kept in the UI memory writes the choice as the `inshort` field of the reader-wide UI memory, and |
| P5h | the rest is out of the accessibility tree by `hidden`, not by the stylesheet alone | the `hidden` attribute is never set on a rest | `src/enhance/editorial.ts` | red: 3 failed \| 15 passed (18). the two views Headlines shows each item's lead (its first strong run, else its first sentence) and hides the r; the two views cuts a nested list and the text after a strong run into the rest, and an item with no sentence e; the choice is kept in the UI memory writes the choice as the `inshort` field of the reader-wide UI memory, and |
| P5i | the switch starts in the stored choice | the choice is not read at start (always Full) | `src/enhance/editorial.ts` | red: 1 failed \| 17 passed (18). the choice is kept in the UI memory writes the choice as the `inshort` field of the reader-wide UI memory, and |
| P5j | only the word `headlines` is Headlines | any stored word but `full` reads as Headlines | `src/enhance/editorial.ts` | red: 3 failed \| 15 passed (18). the switch is there by the flag, and only then with the flag on, the box carries a group of two buttons, Headl; the two views Full shows every item again, as written; the choice is kept in the UI memory reads anything but "headlines" as Full, and starts without writing |
| P5k | the pressed state follows the choice | both buttons stay `aria-pressed="false"` | `src/enhance/editorial.ts` | red: 5 failed \| 13 passed (18). the switch is there by the flag, and only then with the flag on, the box carries a group of two buttons, Headl; the two views Headlines shows each item's lead (its first strong run, else its first sentence) and hides the r; the two views Full shows every item again, as written |
| P5l | a seeded comparison does not move the reader | the seeded comparison steps to its first place (jump on) | `src/enhance/since.ts` | red: 1 failed \| 17 passed (18). the comparison base: asked of `changes` once, and shown as a comparison shows the base without moving the read |
| P5m | the comparison is labelled by the base's commit when the commits name it | the label is always `Since your comparison` | `src/enhance/since.ts` | red: 1 failed \| 17 passed (18). the comparison base: asked of `changes` once, and shown as a comparison asks once, for the base, and shows the |
| P5n | the bootstrap hands the seeded base to the reader | the bootstrap's one line passing `changesBase` removed | `src/frame-runtime/bootstrap.ts` | red: 1 failed \| 3 passed (8). chromium changesBase makes the reader ask the parent for that commit once, after ready |
| P5o | the host adapter seeds the base | mount does not pass `changesBase` to frameDocument | `src/host/mount.ts` | red: 1 failed \| 175 passed (176). docserver parity T5: adapters.changesBase seeds the comparison base seeds a full sha, in every mount, and a ho |
| P5p | frameDocument names the base's own check, before the bootstrap's validator | the host check takes any string (the bootstrap's validator then refuses a short sha, under its own message) | `src/frame/document.ts` | red: 1 failed \| 267 passed (268). the comparison base and the In short flag (docserver parity, Task 5): FrameOptions.changesBase, FrameFeatures. |
| P5q | the cap counts the new key | SEED_FIELDS_MAX_CHARS leaves out the `changesBase` member | `src/frame/seed.ts` | red: 3 failed \| 455 passed (458). the appearance contract: the derived srcdoc cap rises by both fields at their caps (section 2.2) SEED_FIELDS_M; L3.M20 IMAGE_BUDGET_CHARS and SEED_FIELDS_MAX_CHARS recompute from their formulas a maximal seed passes the va; L3.M20 IMAGE_BUDGET_CHARS and SEED_FIELDS_MAX_CHARS recompute from their formulas the two fields' share of SEE |
| P5r | the reader's option check takes a sha only | `changesBase` is taken whatever it holds | `src/enhance/options.ts` | red: 1 failed \| 17 passed (18). the comparison base: asked of `changes` once, and shown as a comparison takes a sha of 7 to 40 hex characters  |
| P5t | the host adapter seeds a full sha only | a string that is not a full sha is seeded as given (the frame then refuses it) | `src/host/mount.ts` | red: 1 failed \| 175 passed (176). docserver parity T5: adapters.changesBase seeds the comparison base a string that is not a full sha is logged  |
| P5s1 | the vocabulary's words judged on the host side | the host-only check (src/frame/vocabulary.ts) is never run by frameDocument | `src/frame/document.ts` | red: 15 failed \| 444 passed (459). L3.M7 the real version, images, snapshot, features and bridge: seeded as given, refused invalid-input outside ; features.vocabulary: judged in full on the host side before the bootstrap's own check (docserver parity, Task ; features.vocabulary: judged in full on the host side before the bootstrap's own check (docserver parity, Task  |
| P5s2 | the reader refuses a forged vocabulary | the reader's word check drops the white-space rule, so a forged word with a leading space is taken (a seed edited after frameDocument reaches the frame, which is ready and fails nothing) | `src/enhance/options.ts` | red: 1 failed \| 1 passed (4). chromium a vocabulary the host side would refuse, put in the seed after frameDocument, fails the render: ready |

```json
[
  {
    "id": "P5a",
    "guard": "the switch is drawn only with the flag on",
    "edit": "the box gets its switch whatever `inShort` says",
    "file": "src/enhance/editorial.ts",
    "tests": "test/enhance-inshort.test.ts",
    "rc": 1,
    "failed": 3,
    "passed": 15,
    "total": 18,
    "red": [
      "the switch is there by the flag, and only then with the flag on, the box carries a group of two buttons, Headlines and Full, and Full is pressed",
      "the switch is there by the flag, and only then with the flag off or left out, the box is 1.1's: no switch, no wrapper, and the same nodes whatever the flag says",
      "the choice is kept in the UI memory keeps no choice when the flag is off: a stored Headlines changes nothing"
    ]
  },
  {
    "id": "P5b",
    "guard": "Headlines hides the rest, never the lead",
    "edit": "the rest of a strong-lead item begins at the item's start, so Headlines hides the lead too",
    "file": "src/enhance/editorial.ts",
    "tests": "test/enhance-inshort.test.ts",
    "rc": 1,
    "failed": 2,
    "passed": 16,
    "total": 18,
    "red": [
      "the two views Headlines shows each item's lead (its first strong run, else its first sentence) and hides the rest from view and from the accessibility tree",
      "the two views cuts a nested list and the text after a strong run into the rest, and an item with no sentence end keeps all its text"
    ]
  },
  {
    "id": "P5c",
    "guard": "the choice is kept in the UI memory",
    "edit": "the choice is not written",
    "file": "src/enhance/editorial.ts",
    "tests": "test/enhance-inshort.test.ts",
    "rc": 1,
    "failed": 2,
    "passed": 16,
    "total": 18,
    "red": [
      "the choice is kept in the UI memory writes the choice as the `inshort` field of the reader-wide UI memory, and starts in it",
      "the choice is kept in the UI memory leaves the other fields of the UI memory as they were"
    ]
  },
  {
    "id": "P5d",
    "guard": "the base is asked of the host once",
    "edit": "the seeded base is also asked of the host directly, beside the menu's own show",
    "file": "src/enhance/since.ts",
    "tests": "test/enhance-inshort.test.ts,test/browser/frame-inshort.test.ts",
    "rc": 1,
    "failed": 3,
    "passed": 19,
    "total": 26,
    "red": [
      "the comparison base: asked of `changes` once, and shown as a comparison asks once, for the base, and shows the comparison labelled by the base's commit",
      "the comparison base: asked of `changes` once, and shown as a comparison is asked of the host once however the reader builds: the menu's picking it later does not ask again",
      "the comparison base: asked of `changes` once, and shown as a comparison shows nothing when the host cannot answer, as an unanswered `changes` does today"
    ]
  },
  {
    "id": "P5e",
    "guard": "the seed check takes a full sha only",
    "edit": "the bundled check for `changesBase` accepts 7 to 64 hex digits",
    "file": "src/frame/seed.ts",
    "tests": "test/frame-seed.test.ts",
    "rc": 1,
    "failed": 5,
    "passed": 186,
    "total": 191,
    "red": [
      "L3.M4 validateSeed: each bad field refused by its own name, with the nonce kept changesBase = \"abc1234\": changesBase",
      "L3.M4 validateSeed: each bad field refused by its own name, with the nonce kept changesBase = \"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\": changesBase",
      "L3.M4 validateSeed: each bad field refused by its own name, with the nonce kept changesBase = \"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\": changesBase",
      "L3.M4 validateSeed: each bad field refused by its own name, with the nonce kept changesBase = \"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa...: changesBase",
      "the seed carries changesBase (docserver parity, Task 5): a full sha, optional refuses a short sha and any value that is not a full sha, naming changesBase and keeping the nonce"
    ]
  },
  {
    "id": "P5f",
    "guard": "the pressed button is told by weight and bar, not by colour alone",
    "edit": "the hosted rule for the pressed view button is removed (colour only)",
    "file": "assets/reader.css",
    "tests": "test/browser/appearance-cues.test.ts",
    "rc": 1,
    "failed": 2,
    "passed": 27,
    "total": 58,
    "red": [
      "chromium the summary box's pressed view button is at 600 with an inset bottom bar of 2px in accent, and the unpressed one neither",
      "chromium the switch the reader draws has the same pressed button: at 600 with an inset bottom bar of 2px in accent, in Full and in Headlines, and the unpressed one neither"
    ]
  },
  {
    "id": "P5g",
    "guard": "a sentence ends the lead of an item with no strong run",
    "edit": "no text is a sentence end, so an item with no strong run keeps all of it in Headlines",
    "file": "src/enhance/editorial.ts",
    "tests": "test/enhance-inshort.test.ts",
    "rc": 1,
    "failed": 2,
    "passed": 16,
    "total": 18,
    "red": [
      "the two views Headlines shows each item's lead (its first strong run, else its first sentence) and hides the rest from view and from the accessibility tree",
      "the choice is kept in the UI memory writes the choice as the `inshort` field of the reader-wide UI memory, and starts in it"
    ]
  },
  {
    "id": "P5h",
    "guard": "the rest is out of the accessibility tree by `hidden`, not by the stylesheet alone",
    "edit": "the `hidden` attribute is never set on a rest",
    "file": "src/enhance/editorial.ts",
    "tests": "test/enhance-inshort.test.ts",
    "rc": 1,
    "failed": 3,
    "passed": 15,
    "total": 18,
    "red": [
      "the two views Headlines shows each item's lead (its first strong run, else its first sentence) and hides the rest from view and from the accessibility tree",
      "the two views cuts a nested list and the text after a strong run into the rest, and an item with no sentence end keeps all its text",
      "the choice is kept in the UI memory writes the choice as the `inshort` field of the reader-wide UI memory, and starts in it"
    ]
  },
  {
    "id": "P5i",
    "guard": "the switch starts in the stored choice",
    "edit": "the choice is not read at start (always Full)",
    "file": "src/enhance/editorial.ts",
    "tests": "test/enhance-inshort.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 17,
    "total": 18,
    "red": [
      "the choice is kept in the UI memory writes the choice as the `inshort` field of the reader-wide UI memory, and starts in it"
    ]
  },
  {
    "id": "P5j",
    "guard": "only the word `headlines` is Headlines",
    "edit": "any stored word but `full` reads as Headlines",
    "file": "src/enhance/editorial.ts",
    "tests": "test/enhance-inshort.test.ts",
    "rc": 1,
    "failed": 3,
    "passed": 15,
    "total": 18,
    "red": [
      "the switch is there by the flag, and only then with the flag on, the box carries a group of two buttons, Headlines and Full, and Full is pressed",
      "the two views Full shows every item again, as written",
      "the choice is kept in the UI memory reads anything but \"headlines\" as Full, and starts without writing"
    ]
  },
  {
    "id": "P5k",
    "guard": "the pressed state follows the choice",
    "edit": "both buttons stay `aria-pressed=\"false\"`",
    "file": "src/enhance/editorial.ts",
    "tests": "test/enhance-inshort.test.ts",
    "rc": 1,
    "failed": 5,
    "passed": 13,
    "total": 18,
    "red": [
      "the switch is there by the flag, and only then with the flag on, the box carries a group of two buttons, Headlines and Full, and Full is pressed",
      "the two views Headlines shows each item's lead (its first strong run, else its first sentence) and hides the rest from view and from the accessibility tree",
      "the two views Full shows every item again, as written",
      "the choice is kept in the UI memory writes the choice as the `inshort` field of the reader-wide UI memory, and starts in it",
      "the choice is kept in the UI memory reads anything but \"headlines\" as Full, and starts without writing"
    ]
  },
  {
    "id": "P5l",
    "guard": "a seeded comparison does not move the reader",
    "edit": "the seeded comparison steps to its first place (jump on)",
    "file": "src/enhance/since.ts",
    "tests": "test/enhance-inshort.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 17,
    "total": 18,
    "red": [
      "the comparison base: asked of `changes` once, and shown as a comparison shows the base without moving the reader: it does not step to the first place"
    ]
  },
  {
    "id": "P5m",
    "guard": "the comparison is labelled by the base's commit when the commits name it",
    "edit": "the label is always `Since your comparison`",
    "file": "src/enhance/since.ts",
    "tests": "test/enhance-inshort.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 17,
    "total": 18,
    "red": [
      "the comparison base: asked of `changes` once, and shown as a comparison asks once, for the base, and shows the comparison labelled by the base's commit"
    ]
  },
  {
    "id": "P5n",
    "guard": "the bootstrap hands the seeded base to the reader",
    "edit": "the bootstrap's one line passing `changesBase` removed",
    "file": "src/frame-runtime/bootstrap.ts",
    "tests": "test/browser/frame-inshort.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 3,
    "total": 8,
    "red": [
      "chromium changesBase makes the reader ask the parent for that commit once, after ready"
    ]
  },
  {
    "id": "P5o",
    "guard": "the host adapter seeds the base",
    "edit": "mount does not pass `changesBase` to frameDocument",
    "file": "src/host/mount.ts",
    "tests": "test/host-mount.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 175,
    "total": 176,
    "red": [
      "docserver parity T5: adapters.changesBase seeds the comparison base seeds a full sha, in every mount, and a host with none seeds no key (the seed 1.1 wrote)"
    ]
  },
  {
    "id": "P5p",
    "guard": "frameDocument names the base's own check, before the bootstrap's validator",
    "edit": "the host check takes any string (the bootstrap's validator then refuses a short sha, under its own message)",
    "file": "src/frame/document.ts",
    "tests": "test/frame-document.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 267,
    "total": 268,
    "red": [
      "the comparison base and the In short flag (docserver parity, Task 5): FrameOptions.changesBase, FrameFeatures.inShort refuses it by its own check, before the bootstrap's validator: the message names the option and the grammar"
    ]
  },
  {
    "id": "P5q",
    "guard": "the cap counts the new key",
    "edit": "SEED_FIELDS_MAX_CHARS leaves out the `changesBase` member",
    "file": "src/frame/seed.ts",
    "tests": "test/frame-seed.test.ts,test/frame-document.test.ts",
    "rc": 1,
    "failed": 3,
    "passed": 455,
    "total": 458,
    "red": [
      "the appearance contract: the derived srcdoc cap rises by both fields at their caps (section 2.2) SEED_FIELDS_MAX_CHARS, and so MAX_SRCDOC_CHARS_DEFAULT, is 1.1.0's plus 2 x 174764 + the largest appearance text + the keys' own characters (the two bridge members of the parity wire, the In short flag and the comparison base among them)",
      "L3.M20 IMAGE_BUDGET_CHARS and SEED_FIELDS_MAX_CHARS recompute from their formulas a maximal seed passes the validator, and its length outside the html and the image URLs is SEED_FIELDS_MAX_CHARS less the padding slack",
      "L3.M20 IMAGE_BUDGET_CHARS and SEED_FIELDS_MAX_CHARS recompute from their formulas the two fields' share of SEED_FIELDS_MAX_CHARS is both faces at their cap, the appearance's longest text and their keys: 2 x 174764 + the appearance + the key overhead"
    ]
  },
  {
    "id": "P5r",
    "guard": "the reader's option check takes a sha only",
    "edit": "`changesBase` is taken whatever it holds",
    "file": "src/enhance/options.ts",
    "tests": "test/enhance-inshort.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 17,
    "total": 18,
    "red": [
      "the comparison base: asked of `changes` once, and shown as a comparison takes a sha of 7 to 40 hex characters or 64, and refuses anything else"
    ],
    "note": "the reader's option check: `changesBase` of the wrong shape reaches the reader only from a host that builds options by hand (the frame's seed is checked before)"
  },
  {
    "id": "P5t",
    "guard": "the host adapter seeds a full sha only",
    "edit": "a string that is not a full sha is seeded as given (the frame then refuses it)",
    "file": "src/host/mount.ts",
    "tests": "test/host-mount.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 175,
    "total": 176,
    "red": [
      "docserver parity T5: adapters.changesBase seeds the comparison base a string that is not a full sha is logged once and not seeded: the document still mounts"
    ]
  },
  {
    "id": "P5s1",
    "guard": "the vocabulary's words judged on the host side",
    "edit": "the host-only check (src/frame/vocabulary.ts) is never run by frameDocument",
    "file": "src/frame/document.ts",
    "tests": "test/frame-document.test.ts,test/frame-seed.test.ts",
    "rc": 1,
    "failed": 15,
    "passed": 444,
    "total": 459,
    "red": [
      "L3.M7 the real version, images, snapshot, features and bridge: seeded as given, refused invalid-input outside their caps a vocabulary word list of 201 words: invalid-input",
      "features.vocabulary: judged in full on the host side before the bootstrap's own check (docserver parity, Task 5, the bootstrap split) refuses a key the vocabulary does not have, naming features.vocabulary, as invalid-input",
      "features.vocabulary: judged in full on the host side before the bootstrap's own check (docserver parity, Task 5, the bootstrap split) refuses an empty word, naming features.vocabulary, as invalid-input",
      "features.vocabulary: judged in full on the host side before the bootstrap's own check (docserver parity, Task 5, the bootstrap split) refuses a word with a leading space, naming features.vocabulary, as invalid-input",
      "features.vocabulary: judged in full on the host side before the bootstrap's own check (docserver parity, Task 5, the bootstrap split) refuses a word with a trailing no-break space, naming features.vocabulary, as invalid-input",
      "features.vocabulary: judged in full on the host side before the bootstrap's own check (docserver parity, Task 5, the bootstrap split) refuses a word of 65 code units, naming features.vocabulary, as invalid-input"
    ]
  },
  {
    "id": "P5s2",
    "guard": "the reader refuses a forged vocabulary",
    "edit": "the reader's word check drops the white-space rule, so a forged word with a leading space is taken (a seed edited after frameDocument reaches the frame, which is ready and fails nothing)",
    "file": "src/enhance/options.ts",
    "tests": "test/browser/frame-vocabulary.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 1,
    "total": 4,
    "red": [
      "chromium a vocabulary the host side would refuse, put in the seed after frameDocument, fails the render: ready, then error render"
    ]
  }
]
```
