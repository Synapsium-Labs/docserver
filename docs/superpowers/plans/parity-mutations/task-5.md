# Parity Task 5: mutation rows (the In short option, the comparison base, and the bootstrap split)

Each row was measured in place on this wave's branch: the bytes of the file saved with their sha256, one edit applied, the tests named in the row run through the fleet test wrapper as `./node_modules/.bin/vitest run --maxWorkers=2 --reporter=json`, then the file restored from the saved bytes (`cp`-equivalent, written back) and its sha256 compared (each matched). A row whose file is an input of the frame build was measured with the frame rebuilt under the edit (`node scripts/build-frame.mjs`), so that the manifest agrees with the mutated assets and the row goes red through its own assertion and not through an `asset-mismatch`; the generated files were then rebuilt from the restored sources and `node scripts/build-frame.mjs --check` was green after each. The browser rows run in Chromium (`DOCREADER_BROWSERS=chromium`); WebKit is CI's. Sha256 of each file as restored: `src/frame/document.ts` `cf185c1a2fa2d69cbea459b6ab5a78d341ff59da3fe1cad51afc3be0d9bce9cf`, `src/enhance/options.ts` `f4f3bd08bbcdadbd3d914bf3cd7904fe17bbc5146dc4e4e0bacaee48969e7071`. Rows P5s1 and P5s2 are the bootstrap split's (the vocabulary's words judged on the host side and in the reader; the bundled check holds a plain object only); rows P5a to P5f are the plan's, and the rest this task's own guards.


| Row | Guard | Edit | File | Result |
|---|---|---|---|---|
| P5s1 | the vocabulary's words judged on the host side | the host-only check (src/frame/vocabulary.ts) is never run by frameDocument | `src/frame/document.ts` | red: 15 failed \| 423 passed (438). L3.M7 the real version, images, snapshot, features and bridge: seeded as given, refused invalid-input outside ; features.vocabulary: judged in full on the host side before the bootstrap's own check (docserver parity, Task ; features.vocabulary: judged in full on the host side before the bootstrap's own check (docserver parity, Task  |
| P5s2 | the reader refuses a forged vocabulary | the reader's word check drops the white-space rule, so a forged word with a leading space is taken (a seed edited after frameDocument reaches the frame, which is ready and fails nothing) | `src/enhance/options.ts` | red: 1 failed \| 1 passed (4). chromium a vocabulary the host side would refuse, put in the seed after frameDocument, fails the render: ready |

```json
[
  {
    "id": "P5s1",
    "guard": "the vocabulary's words judged on the host side",
    "edit": "the host-only check (src/frame/vocabulary.ts) is never run by frameDocument",
    "file": "src/frame/document.ts",
    "tests": "test/frame-document.test.ts,test/frame-seed.test.ts",
    "rc": 1,
    "failed": 15,
    "passed": 423,
    "total": 438,
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
