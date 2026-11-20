# Parity Task 4: mutation rows (item values from `render`, item links from the seed)

Each row was measured in place on this wave's branch: the bytes of the file saved with their sha256, one edit applied, the tests named in the row run through the fleet test wrapper as `./node_modules/.bin/vitest run --maxWorkers=2 --reporter=json`, then the file restored from the saved bytes (`cp`) and its sha256 compared (each matched). The sha256 of each file as restored: `src/conformance/index.ts` `0edec1719ba0202201552bc71ea0b75486689415eef160041695217d8755b6ba`, `src/frame-runtime/adapters.ts` `114008267b452a61fc6f19b3eea1bc004f578e574ae6bb869b13e24a435bce59`, `src/frame-runtime/bootstrap.ts` `7c63c11cc469345a884602d2da437873d7bf2e7477407f4e52440f17bff31d48`, `src/frame-runtime/enhance-entry.ts` `6ab2eebb67511137e6ed1da6e1da5710c3691797967d9214906f69d7919a21d4`, `src/frame/document.ts` `276fc45147720b322aba8b29b6519395c868b45d531ef3b277b23446bbf57314`, `src/frame/items.ts` `1fa950b503a231c4787c52ab587e1ecefa23340290cf3679c3d7269c75a24bab`, `src/frame/seed.ts` `e234b28414d1480429c527d9e846e9986ef182095bc99affeadcf03d613989ee`, `src/host/mount.ts` `22f1b2a9efe45e3a98377d2a9721fd9be3daca4ac583c81e90ffa0485a78fd57`, `src/render/items.ts` `aff71325e66d017783626a215530fd6cf444f0530fdce7f128ff796ab1c0296e`. Every row exited 1 and every failing test failed with an assertion; none went red through a load failure. A row whose file is an input of the frame build (`src/frame/items.ts`, `src/frame-runtime/enhance-entry.ts`, `src/frame-runtime/bootstrap.ts`) was measured with the frame rebuilt under the edit (`node scripts/build-frame.mjs`), so that the manifest agrees with the mutated assets and the row goes red through its own assertion and not through an `asset-mismatch`; the generated files (`assets/assets.json`, `src/frame/manifest.generated.ts` and the files under `assets/frame` and `assets/mermaid`) were saved with their sha256 and restored the same way (each matched, and `node scripts/build-frame.mjs --check` is green after). Rows P4a to P4f are the plan's; P4c-reader, P4c-host and P4g to P4x are this task's own guards. The browser rows run in Chromium (`DOCREADER_BROWSERS=chromium`); WebKit is CI's. Four rows (P4c-host, P4w, P4c, P4m) first came back with 15 tests skipped and no failure on one run (the file's worker killed under the slice's memory cap); each was measured again and the rows below are the complete runs.

| Row | Guard | Edit | File | Result |
|---|---|---|---|---|
| P4a | a 101-unit value cut instead of left out | a value over 100 code units is cut to 100 and listed | `src/render/items.ts` | red: 3 failed \| 41 passed (44). leaves out a value of 101 code units, never cuts it, and does not count it (P4a); fixture: a long key; holds for every fixture under each part of the vocabulary alone |
| P4b | the 51st value kept | the cap is 51, not 50 | `src/render/items.ts` | red: 2 failed \| 42 passed (44). lists at most 50 values: the 50th is kept and the 51st is not (P4b); counts a value once however often it is named, so repeats do not use the 50 |
| P4c | `http:` accepted | the href grammar accepts `http:` (host side and reader share the one check) | `src/frame/items.ts` | red: 2 failed \| 266 passed (268). draws only an absolute https: href: http:, javascript:, data:, relative and spaced hrefs are no link, and the ; takes an absolute https: URL of at most 4096 code units: `https:` passes; `http:`, other schemes, relative and |
| P4c-reader | the reader draws any string href | the reader's own https check removed (the bootstrap passes the seed's href through) | `src/frame-runtime/enhance-entry.ts` | red: 2 failed \| 23 passed (28). an href that is not an absolute https: URL, put in the seed after frameDocument, is never drawn: the value sta; draws only an absolute https: href: http:, javascript:, data:, relative and spaced hrefs are no link, and the  |
| P4c-host | frameDocument does not judge the items | the host-side full check removed | `src/frame/document.ts` | red: 2 failed \| 244 passed (246). takes an absolute https: URL of at most 4096 code units: `https:` passes; `http:`, other schemes, relative and; takes plain data only: a list of plain { value, href } objects; a getter, a class, extra or missing keys, a no |
| P4d | prefix match instead of exact | the adapter answers an item whose value is a prefix of the key asked | `src/frame-runtime/adapters.ts` | red: 3 failed \| 19 passed (22). the adapter answers the seeded href of the value asked for, exactly, else null (P4d: never a prefix, a case or; draws a seeded item as the reader's item-link and leaves an unseeded one as text; the click goes to onLink as ; draws only an absolute https: href: http:, javascript:, data:, relative and spaced hrefs are no link, and the  |
| P4e | body text scanned for items | every text of the document is scanned for keys | `src/render/items.ts` | red: 12 failed \| 32 passed (44). reads a code element whose whole text is a key, and leaves a link, other code and other facts alone; reads the labels in any case and the label as strong text, and only the first fact of an item field; lists nothing for a byline with no item field, a meta line the reader does not take, or no title |
| P4f | the cap leaves out `items` | SEED_FIELDS_MAX_CHARS does not count the field | `src/frame/seed.ts` | red: 3 failed \| 413 passed (431). SEED_FIELDS_MAX_CHARS, and so MAX_SRCDOC_CHARS_DEFAULT, is 1.1.0's plus 2 x 174764 + the largest appearance te; a maximal seed passes the validator, and its length outside the html and the image URLs is SEED_FIELDS_MAX_CHA; the two fields' share of SEED_FIELDS_MAX_CHARS is both faces at their cap, the appearance's longest text and t |
| P4g | the bundled seed check skips items | validateSeed does not check the items key | `src/frame/seed.ts` | red: 4 failed \| 181 passed (185). holds at most 50 links: 49 and 50 pass, 51 is refused naming items; holds a value of 1 to 100 code units: 1 and 100 pass, 0 and 101 are refused; holds an href of 1 to hrefMaxChars code units: 1 and 4096 pass, 0 and 4097 are refused |
| P4h | more than 50 links admitted by the seed check | seed check cap 50 -> 51 | `src/frame/seed.ts` | red: 1 failed \| 184 passed (185). holds at most 50 links: 49 and 50 pass, 51 is refused naming items |
| P4i | a 101-unit value admitted by the seed check | seed check value cap 100 -> 101 | `src/frame/seed.ts` | red: 1 failed \| 184 passed (185). holds a value of 1 to 100 code units: 1 and 100 pass, 0 and 101 are refused |
| P4j | an empty value admitted by the seed check | seed check value minimum 1 -> 0 | `src/frame/seed.ts` | red: 1 failed \| 184 passed (185). holds a value of 1 to 100 code units: 1 and 100 pass, 0 and 101 are refused |
| P4k | a 4097-unit href admitted by the seed check | seed check href cap 4096 -> 4097 | `src/frame/seed.ts` | red: 1 failed \| 184 passed (185). holds an href of 1 to hrefMaxChars code units: 1 and 4096 pass, 0 and 4097 are refused |
| P4l | host side admits 51 links | ITEM_LIMITS.max 50 -> 51 | `src/frame/items.ts` | red: 4 failed \| 427 passed (431). SEED_FIELDS_MAX_CHARS, and so MAX_SRCDOC_CHARS_DEFAULT, is 1.1.0's plus 2 x 174764 + the largest appearance te; a maximal seed passes the validator, and its length outside the html and the image URLs is SEED_FIELDS_MAX_CHA; the two fields' share of SEED_FIELDS_MAX_CHARS is both faces at their cap, the appearance's longest text and t |
| P4m | user information in an href admitted | the `@` of the authority allowed | `src/frame/items.ts` | red: 1 failed \| 245 passed (246). takes an absolute https: URL of at most 4096 code units: `https:` passes; `http:`, other schemes, relative and |
| P4n | the comparator strips any `items` | a non-empty `items` left out of the golden compare too | `src/conformance/index.ts` | red: 1 failed \| 103 passed (104). keeps a value in: a render that lists items for a document rendered with no reader fails on its meta |
| P4o | every item-field fact read, not the first only | the loop goes on past the first item fact | `src/render/items.ts` | red: 1 failed \| 43 passed (44). reads the labels in any case and the label as strong text, and only the first fact of an item field |
| P4p | a section whose first code block names no key is not passed on | the delta route ends at the first section whose block names none | `src/render/items.ts` | red: 3 failed \| 41 passed (44). passes a section whose first code block names no key to the next item heading; fixture: delta second section; holds for every fixture under each part of the vocabulary alone |
| P4q | a host word matched as a pattern | words not escaped | `src/render/items.ts` | red: 2 failed \| 42 passed (44). matches a word as itself, not as a pattern; each pattern here is the vocabulary's own: the field, the heading, the key, its scan and the item line |
| P4r | an unknown reader key accepted | the key check removed | `src/render/items.ts` | red: 1 failed \| 43 passed (44). is checked: a plain object, only the vocabulary keys, item lists of at most 200 words of 1 to 64 code units |
| P4s | entities left as written | decode is the identity | `src/render/items.ts` | red: 1 failed \| 43 passed (44). reads a heading with an entity or code in it as its text |
| P4t | the items adapter called with no values | called for a document that names no item | `src/host/mount.ts` | red: 2 failed \| 169 passed (171). is not called, and seeds nothing, for a document whose meta lists no item (or has no `items` at all); reads the meta's items as data: only strings of 1 to 100 code units, at most 50, never a getter |
| P4u | more than 50 values handed to the adapter | the adapter's list not bounded | `src/host/mount.ts` | red: 1 failed \| 170 passed (171). reads the meta's items as data: only strings of 1 to 100 code units, at most 50, never a getter |
| P4v | an itemLink with no items | the frame offers itemLink when the seed has no items | `src/frame-runtime/adapters.ts` | red: 1 failed \| 21 passed (22). with no items the adapter has no itemLink: the option is an empty object, spread to nothing |
| P4w | an empty list seeded | an empty items key written | `src/frame/document.ts` | red: 1 failed \| 245 passed (246). seeds the links as given, in order, and with none the srcdoc is the one without the option, byte for byte |
| P4x | the bootstrap does not hand itemLink to the reader | the one bootstrap line removed | `src/frame-runtime/bootstrap.ts` | red: 1 failed \| 2 passed (6). a seeded value is drawn as the reader's item link and an unseeded one stays text; the click goes out as naviga |

## Choices

- **Rows that need the frame rebuilt.** The reader's own https check lives in `src/frame/items.ts`, which both `frameDocument` and the reader's script import, so one edit there moves the enhance and bootstrap bytes; measured without a rebuild every test that builds frames goes red on `asset-mismatch`, which proves nothing about the guard.
- **P4g to P4k are the bundled check's own bounds**, written out as numbers in `itemsOk` (not read from `ITEM_LIMITS`) to keep the bootstrap in its budget; `test/frame-seed.test.ts` holds them equal to `ITEM_LIMITS`.
- **P4x** is the one bootstrap line, `...adapters.itemOption`; only a real frame sees it (`test/browser/frame-items.test.ts`).

```json
[
  {
    "id": "P4a",
    "guard": "a 101-unit value cut instead of left out",
    "edit": "a value over 100 code units is cut to 100 and listed",
    "file": "src/render/items.ts",
    "tests": "test/render-items.test.ts",
    "rc": 1,
    "failed": 3,
    "passed": 41,
    "total": 44,
    "red": [
      "meta.items: both routes, order and bounds > leaves out a value of 101 code units, never cuts it, and does not count it (P4a)",
      "meta.items equals the keys the enhance step asks itemLink for > fixture: a long key",
      "meta.items equals the keys the enhance step asks itemLink for > holds for every fixture under each part of the vocabulary alone"
    ]
  },
  {
    "id": "P4b",
    "guard": "the 51st value kept",
    "edit": "the cap is 51, not 50",
    "file": "src/render/items.ts",
    "tests": "test/render-items.test.ts",
    "rc": 1,
    "failed": 2,
    "passed": 42,
    "total": 44,
    "red": [
      "meta.items: both routes, order and bounds > lists at most 50 values: the 50th is kept and the 51st is not (P4b)",
      "meta.items: both routes, order and bounds > counts a value once however often it is named, so repeats do not use the 50"
    ]
  },
  {
    "id": "P4c",
    "guard": "`http:` accepted",
    "edit": "the href grammar accepts `http:` (host side and reader share the one check)",
    "file": "src/frame/items.ts",
    "tests": "test/frame-document.test.ts,test/enhance-frame-wire.test.ts",
    "rc": 1,
    "failed": 2,
    "passed": 266,
    "total": 268,
    "red": [
      "the item link of the frame: seeded hrefs, drawn by the reader (docserver parity T4) > draws only an absolute https: href: http:, javascript:, data:, relative and spaced hrefs are no link, and the value stays text (the reader's own check, P4c)",
      "the resolved item links (docserver parity, Task 4): FrameOptions.items, an optional seed field judged in full here > takes an absolute https: URL of at most 4096 code units: `https:` passes; `http:`, other schemes, relative and malformed hrefs are refused (P4c at the seed)"
    ]
  },
  {
    "id": "P4c-reader",
    "guard": "the reader draws any string href",
    "edit": "the reader's own https check removed (the bootstrap passes the seed's href through)",
    "file": "src/frame-runtime/enhance-entry.ts",
    "tests": "test/enhance-frame-wire.test.ts,test/browser/frame-items.test.ts",
    "rc": 1,
    "failed": 2,
    "passed": 23,
    "total": 28,
    "red": [
      "chromium > an href that is not an absolute https: URL, put in the seed after frameDocument, is never drawn: the value stays text",
      "the item link of the frame: seeded hrefs, drawn by the reader (docserver parity T4) > draws only an absolute https: href: http:, javascript:, data:, relative and spaced hrefs are no link, and the value stays text (the reader's own check, P4c)"
    ]
  },
  {
    "id": "P4c-host",
    "guard": "frameDocument does not judge the items",
    "edit": "the host-side full check removed",
    "file": "src/frame/document.ts",
    "tests": "test/frame-document.test.ts",
    "rc": 1,
    "failed": 2,
    "passed": 244,
    "total": 246,
    "red": [
      "the resolved item links (docserver parity, Task 4): FrameOptions.items, an optional seed field judged in full here > takes an absolute https: URL of at most 4096 code units: `https:` passes; `http:`, other schemes, relative and malformed hrefs are refused (P4c at the seed)",
      "the resolved item links (docserver parity, Task 4): FrameOptions.items, an optional seed field judged in full here > takes plain data only: a list of plain { value, href } objects; a getter, a class, extra or missing keys, a non-string are refused"
    ]
  },
  {
    "id": "P4d",
    "guard": "prefix match instead of exact",
    "edit": "the adapter answers an item whose value is a prefix of the key asked",
    "file": "src/frame-runtime/adapters.ts",
    "tests": "test/enhance-frame-wire.test.ts",
    "rc": 1,
    "failed": 3,
    "passed": 19,
    "total": 22,
    "red": [
      "the item link of the frame: seeded hrefs, drawn by the reader (docserver parity T4) > the adapter answers the seeded href of the value asked for, exactly, else null (P4d: never a prefix, a case or a trim)",
      "the item link of the frame: seeded hrefs, drawn by the reader (docserver parity T4) > draws a seeded item as the reader's item-link and leaves an unseeded one as text; the click goes to onLink as a new tab",
      "the item link of the frame: seeded hrefs, drawn by the reader (docserver parity T4) > draws only an absolute https: href: http:, javascript:, data:, relative and spaced hrefs are no link, and the value stays text (the reader's own check, P4c)"
    ]
  },
  {
    "id": "P4e",
    "guard": "body text scanned for items",
    "edit": "every text of the document is scanned for keys",
    "file": "src/render/items.ts",
    "tests": "test/render-items.test.ts",
    "rc": 1,
    "failed": 12,
    "passed": 32,
    "total": 44,
    "red": [
      "meta.items: the byline route > reads a code element whose whole text is a key, and leaves a link, other code and other facts alone",
      "meta.items: the byline route > reads the labels in any case and the label as strong text, and only the first fact of an item field",
      "meta.items: the byline route > lists nothing for a byline with no item field, a meta line the reader does not take, or no title",
      "meta.items: the byline route > does not scan the body, a heading or a table for a key (P4e)",
      "meta.items: the delta route > reads an indented code block no more than a fence, and a mermaid figure not at all",
      "meta.items: both routes, order and bounds > answers [] with no reader, with a reader that names no item field or heading, and for a result that is not rendered"
    ]
  },
  {
    "id": "P4f",
    "guard": "the cap leaves out `items`",
    "edit": "SEED_FIELDS_MAX_CHARS does not count the field",
    "file": "src/frame/seed.ts",
    "tests": "test/frame-seed.test.ts,test/frame-document.test.ts",
    "rc": 1,
    "failed": 3,
    "passed": 413,
    "total": 431,
    "red": [
      "the appearance contract: the derived srcdoc cap rises by both fields at their caps (section 2.2) > SEED_FIELDS_MAX_CHARS, and so MAX_SRCDOC_CHARS_DEFAULT, is 1.1.0's plus 2 x 174764 + the largest appearance text + the keys' own characters (the two bridge members of the parity wire among them)",
      "L3.M20 IMAGE_BUDGET_CHARS and SEED_FIELDS_MAX_CHARS recompute from their formulas > a maximal seed passes the validator, and its length outside the html and the image URLs is SEED_FIELDS_MAX_CHARS less the padding slack",
      "L3.M20 IMAGE_BUDGET_CHARS and SEED_FIELDS_MAX_CHARS recompute from their formulas > the two fields' share of SEED_FIELDS_MAX_CHARS is both faces at their cap, the appearance's longest text and their keys: 2 x 174764 + the appearance + the key overhead"
    ]
  },
  {
    "id": "P4g",
    "guard": "the bundled seed check skips items",
    "edit": "validateSeed does not check the items key",
    "file": "src/frame/seed.ts",
    "tests": "test/frame-seed.test.ts",
    "rc": 1,
    "failed": 4,
    "passed": 181,
    "total": 185,
    "red": [
      "the seed carries items (docserver parity, Task 4): the outer shape only > holds at most 50 links: 49 and 50 pass, 51 is refused naming items",
      "the seed carries items (docserver parity, Task 4): the outer shape only > holds a value of 1 to 100 code units: 1 and 100 pass, 0 and 101 are refused",
      "the seed carries items (docserver parity, Task 4): the outer shape only > holds an href of 1 to hrefMaxChars code units: 1 and 4096 pass, 0 and 4097 are refused",
      "the seed carries items (docserver parity, Task 4): the outer shape only > is a list of plain objects with exactly value and href, both strings"
    ]
  },
  {
    "id": "P4h",
    "guard": "more than 50 links admitted by the seed check",
    "edit": "seed check cap 50 -> 51",
    "file": "src/frame/seed.ts",
    "tests": "test/frame-seed.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 184,
    "total": 185,
    "red": [
      "the seed carries items (docserver parity, Task 4): the outer shape only > holds at most 50 links: 49 and 50 pass, 51 is refused naming items"
    ]
  },
  {
    "id": "P4i",
    "guard": "a 101-unit value admitted by the seed check",
    "edit": "seed check value cap 100 -> 101",
    "file": "src/frame/seed.ts",
    "tests": "test/frame-seed.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 184,
    "total": 185,
    "red": [
      "the seed carries items (docserver parity, Task 4): the outer shape only > holds a value of 1 to 100 code units: 1 and 100 pass, 0 and 101 are refused"
    ]
  },
  {
    "id": "P4j",
    "guard": "an empty value admitted by the seed check",
    "edit": "seed check value minimum 1 -> 0",
    "file": "src/frame/seed.ts",
    "tests": "test/frame-seed.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 184,
    "total": 185,
    "red": [
      "the seed carries items (docserver parity, Task 4): the outer shape only > holds a value of 1 to 100 code units: 1 and 100 pass, 0 and 101 are refused"
    ]
  },
  {
    "id": "P4k",
    "guard": "a 4097-unit href admitted by the seed check",
    "edit": "seed check href cap 4096 -> 4097",
    "file": "src/frame/seed.ts",
    "tests": "test/frame-seed.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 184,
    "total": 185,
    "red": [
      "the seed carries items (docserver parity, Task 4): the outer shape only > holds an href of 1 to hrefMaxChars code units: 1 and 4096 pass, 0 and 4097 are refused"
    ]
  },
  {
    "id": "P4l",
    "guard": "host side admits 51 links",
    "edit": "ITEM_LIMITS.max 50 -> 51",
    "file": "src/frame/items.ts",
    "tests": "test/frame-document.test.ts,test/frame-seed.test.ts",
    "rc": 1,
    "failed": 4,
    "passed": 427,
    "total": 431,
    "red": [
      "the appearance contract: the derived srcdoc cap rises by both fields at their caps (section 2.2) > SEED_FIELDS_MAX_CHARS, and so MAX_SRCDOC_CHARS_DEFAULT, is 1.1.0's plus 2 x 174764 + the largest appearance text + the keys' own characters (the two bridge members of the parity wire among them)",
      "L3.M20 IMAGE_BUDGET_CHARS and SEED_FIELDS_MAX_CHARS recompute from their formulas > a maximal seed passes the validator, and its length outside the html and the image URLs is SEED_FIELDS_MAX_CHARS less the padding slack",
      "L3.M20 IMAGE_BUDGET_CHARS and SEED_FIELDS_MAX_CHARS recompute from their formulas > the two fields' share of SEED_FIELDS_MAX_CHARS is both faces at their cap, the appearance's longest text and their keys: 2 x 174764 + the appearance + the key overhead",
      "the seed carries items (docserver parity, Task 4): the outer shape only > the caps written out in the bundled check are ITEM_LIMITS', and the href's is the bridge's"
    ]
  },
  {
    "id": "P4m",
    "guard": "user information in an href admitted",
    "edit": "the `@` of the authority allowed",
    "file": "src/frame/items.ts",
    "tests": "test/frame-document.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 245,
    "total": 246,
    "red": [
      "the resolved item links (docserver parity, Task 4): FrameOptions.items, an optional seed field judged in full here > takes an absolute https: URL of at most 4096 code units: `https:` passes; `http:`, other schemes, relative and malformed hrefs are refused (P4c at the seed)"
    ]
  },
  {
    "id": "P4n",
    "guard": "the comparator strips any `items`",
    "edit": "a non-empty `items` left out of the golden compare too",
    "file": "src/conformance/index.ts",
    "tests": "test/corpus.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 103,
    "total": 104,
    "red": [
      "runCorpus: the meta of the goldens and `items` (docserver parity, Task 4) > keeps a value in: a render that lists items for a document rendered with no reader fails on its meta"
    ]
  },
  {
    "id": "P4o",
    "guard": "every item-field fact read, not the first only",
    "edit": "the loop goes on past the first item fact",
    "file": "src/render/items.ts",
    "tests": "test/render-items.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 43,
    "total": 44,
    "red": [
      "meta.items: the byline route > reads the labels in any case and the label as strong text, and only the first fact of an item field"
    ]
  },
  {
    "id": "P4p",
    "guard": "a section whose first code block names no key is not passed on",
    "edit": "the delta route ends at the first section whose block names none",
    "file": "src/render/items.ts",
    "tests": "test/render-items.test.ts",
    "rc": 1,
    "failed": 3,
    "passed": 41,
    "total": 44,
    "red": [
      "meta.items: the delta route > passes a section whose first code block names no key to the next item heading",
      "meta.items equals the keys the enhance step asks itemLink for > fixture: delta second section",
      "meta.items equals the keys the enhance step asks itemLink for > holds for every fixture under each part of the vocabulary alone"
    ]
  },
  {
    "id": "P4q",
    "guard": "a host word matched as a pattern",
    "edit": "words not escaped",
    "file": "src/render/items.ts",
    "tests": "test/render-items.test.ts",
    "rc": 1,
    "failed": 2,
    "passed": 42,
    "total": 44,
    "red": [
      "the reader option > matches a word as itself, not as a pattern",
      "one vocabulary for the screen and for render() > each pattern here is the vocabulary's own: the field, the heading, the key, its scan and the item line"
    ]
  },
  {
    "id": "P4r",
    "guard": "an unknown reader key accepted",
    "edit": "the key check removed",
    "file": "src/render/items.ts",
    "tests": "test/render-items.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 43,
    "total": 44,
    "red": [
      "the reader option > is checked: a plain object, only the vocabulary keys, item lists of at most 200 words of 1 to 64 code units"
    ]
  },
  {
    "id": "P4s",
    "guard": "entities left as written",
    "edit": "decode is the identity",
    "file": "src/render/items.ts",
    "tests": "test/render-items.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 43,
    "total": 44,
    "red": [
      "meta.items: the delta route > reads a heading with an entity or code in it as its text"
    ]
  },
  {
    "id": "P4t",
    "guard": "the items adapter called with no values",
    "edit": "called for a document that names no item",
    "file": "src/host/mount.ts",
    "tests": "test/host-mount.test.ts",
    "rc": 1,
    "failed": 2,
    "passed": 169,
    "total": 171,
    "red": [
      "docserver parity T4: the items adapter resolves the document's item values into seeded links > is not called, and seeds nothing, for a document whose meta lists no item (or has no `items` at all)",
      "docserver parity T4: the items adapter resolves the document's item values into seeded links > reads the meta's items as data: only strings of 1 to 100 code units, at most 50, never a getter"
    ]
  },
  {
    "id": "P4u",
    "guard": "more than 50 values handed to the adapter",
    "edit": "the adapter's list not bounded",
    "file": "src/host/mount.ts",
    "tests": "test/host-mount.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 170,
    "total": 171,
    "red": [
      "docserver parity T4: the items adapter resolves the document's item values into seeded links > reads the meta's items as data: only strings of 1 to 100 code units, at most 50, never a getter"
    ]
  },
  {
    "id": "P4v",
    "guard": "an itemLink with no items",
    "edit": "the frame offers itemLink when the seed has no items",
    "file": "src/frame-runtime/adapters.ts",
    "tests": "test/enhance-frame-wire.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 21,
    "total": 22,
    "red": [
      "the item link of the frame: seeded hrefs, drawn by the reader (docserver parity T4) > with no items the adapter has no itemLink: the option is an empty object, spread to nothing"
    ]
  },
  {
    "id": "P4w",
    "guard": "an empty list seeded",
    "edit": "an empty items key written",
    "file": "src/frame/document.ts",
    "tests": "test/frame-document.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 245,
    "total": 246,
    "red": [
      "the resolved item links (docserver parity, Task 4): FrameOptions.items, an optional seed field judged in full here > seeds the links as given, in order, and with none the srcdoc is the one without the option, byte for byte"
    ]
  },
  {
    "id": "P4x",
    "guard": "the bootstrap does not hand itemLink to the reader",
    "edit": "the one bootstrap line removed",
    "file": "src/frame-runtime/bootstrap.ts",
    "tests": "test/browser/frame-items.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 2,
    "total": 6,
    "red": [
      "chromium > a seeded value is drawn as the reader's item link and an unseeded one stays text; the click goes out as navigate"
    ]
  }
]
```
