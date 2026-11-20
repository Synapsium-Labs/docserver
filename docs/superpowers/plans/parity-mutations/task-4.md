# Parity Task 4: mutation rows (item values from `render`, item links from the seed)

Each row was measured in place on this wave's branch: the bytes of the file saved with their sha256, one edit applied, the tests named in the row run through the fleet test wrapper as `./node_modules/.bin/vitest run --maxWorkers=2 --reporter=json`, then the file restored from the saved bytes (`cp`) and its sha256 compared (each matched). For rows P4a to P4x, measured at commit 40794ba, the sha256 of each file as restored: `src/conformance/index.ts` `0edec1719ba0202201552bc71ea0b75486689415eef160041695217d8755b6ba`, `src/frame-runtime/adapters.ts` `114008267b452a61fc6f19b3eea1bc004f578e574ae6bb869b13e24a435bce59`, `src/frame-runtime/bootstrap.ts` `7c63c11cc469345a884602d2da437873d7bf2e7477407f4e52440f17bff31d48`, `src/frame-runtime/enhance-entry.ts` `6ab2eebb67511137e6ed1da6e1da5710c3691797967d9214906f69d7919a21d4`, `src/frame/document.ts` `276fc45147720b322aba8b29b6519395c868b45d531ef3b277b23446bbf57314`, `src/frame/items.ts` `1fa950b503a231c4787c52ab587e1ecefa23340290cf3679c3d7269c75a24bab`, `src/frame/seed.ts` `e234b28414d1480429c527d9e846e9986ef182095bc99affeadcf03d613989ee`, `src/host/mount.ts` `22f1b2a9efe45e3a98377d2a9721fd9be3daca4ac583c81e90ffa0485a78fd57`, `src/render/items.ts` `aff71325e66d017783626a215530fd6cf444f0530fdce7f128ff796ab1c0296e`. Every row exited 1 and every failing test failed with an assertion; none went red through a load failure. A row whose file is an input of the frame build (`src/frame/items.ts`, `src/frame-runtime/enhance-entry.ts`, `src/frame-runtime/bootstrap.ts`) was measured with the frame rebuilt under the edit (`node scripts/build-frame.mjs`), so that the manifest agrees with the mutated assets and the row goes red through its own assertion and not through an `asset-mismatch`; the generated files (`assets/assets.json`, `src/frame/manifest.generated.ts` and the files under `assets/frame` and `assets/mermaid`) were saved with their sha256 and restored the same way (each matched, and `node scripts/build-frame.mjs --check` is green after). Rows P4a to P4f are the plan's; P4c-reader, P4c-host and P4g to P4x are this task's own guards. The browser rows run in Chromium (`DOCREADER_BROWSERS=chromium`); WebKit is CI's. Four rows (P4c-host, P4w, P4c, P4m) first came back with 15 tests skipped and no failure on one run (the file's worker killed under the slice's memory cap); each was measured again and the rows below are the complete runs.

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
| P4y | the header-line route removed from meta.items | render reads no header line | `src/render/items.ts` | red: 12 failed \| 51 passed (63). lists the keys of `**Field:** AB-90`, with the colon inside the bold text or right after it, and of ; is read before or after the meta line, and wherever it stands before the first level-2 heading; is used only when the byline has no item fact: the byline keeps its precedence, and a delta key stil |
| P4z | the header-line route removed from the reader | the reader links no header line | `src/enhance/editorial.ts` | red: 11 failed \| 198 passed (209). links the keys where they stand, with a click listener on the paragraph, and leaves the label as it ; is not used once the delta key has a link, and is when it has none; destroy puts the paragraph back as the author wrote it |
| P4aa | the header line read without itemFields (render) | any bold label opens a header line in render | `src/render/items.ts` | red: 4 failed \| 59 passed (63). is no header line when the paragraph has other text, is not a root child, is past the first level-2 ; is off without the item fields (P4: the vocabulary gates it), and never scans the body; fixture: header line, not an item field |
| P4ab | the header line read without itemFields (reader) | any bold label opens a header line in the reader | `src/enhance/editorial.ts` | red: 3 failed \| 206 passed (209). is the third route: no byline item fact and no delta link, and only for a paragraph that stands alon; fixture: header line, not an item field; holds for every fixture under each part of the vocabulary alone |
| P4ac | a paragraph with other text read as a header line (render) | render does not require the paragraph to stand alone | `src/render/items.ts` | red: 3 failed \| 60 passed (63). is no header line when the paragraph has other text, is not a root child, is past the first level-2 ; fixture: header line with other text; holds for every fixture under each part of the vocabulary alone |
| P4ad | a paragraph with other text read as a header line (reader) | the reader does not require the paragraph to stand alone | `src/enhance/editorial.ts` | red: 3 failed \| 206 passed (209). is the third route: no byline item fact and no delta link, and only for a paragraph that stands alon; fixture: header line with other text; holds for every fixture under each part of the vocabulary alone |
| P4ae | the header line read beside a byline item fact (render) | render lists the header line whatever the byline has | `src/render/items.ts` | red: 4 failed \| 59 passed (63). is used only when the byline has no item fact: the byline keeps its precedence, and a delta key stil; fixture: header line with a byline fact; fixture: header line with an empty byline fact |
| P4af | the header line read beside a byline item fact (reader) | the reader asks the header line whatever the byline has | `src/enhance/editorial.ts` | red: 4 failed \| 205 passed (209). is the third route: no byline item fact and no delta link, and only for a paragraph that stands alon; fixture: header line with a byline fact; fixture: header line with an empty byline fact |
| P4ag | a paragraph past the first level-2 heading read (render) | render reads the body for a header line | `src/render/items.ts` | red: 3 failed \| 60 passed (63). is no header line when the paragraph has other text, is not a root child, is past the first level-2 ; fixture: header line past the first section; holds for every fixture under each part of the vocabulary alone |
| P4ah | a paragraph past the first level-2 heading read (reader) | the reader reads the body for a header line | `src/enhance/editorial.ts` | red: 3 failed \| 206 passed (209). is the third route: no byline item fact and no delta link, and only for a paragraph that stands alon; fixture: header line past the first section; holds for every fixture under each part of the vocabulary alone |
| P4ai | the frame's enhance wrapper writes an attribute | the wrapper touches the root | `src/frame-runtime/enhance-wrap.ts` | red: 2 failed \| 92 passed (94). touches no element, attribute or text, in the root or the document, on either path; src/frame-runtime/enhance-wrap.ts names no DOM, global or storage API (the walls test's own kind of  |
| P4aj | the forwarded copy differs in more than itemLink | the wrapper adds a key | `src/frame-runtime/enhance-wrap.ts` | red: 1 failed \| 93 passed (94). with an itemLink function it forwards a copy that differs in itemLink alone, and leaves the host's o |
| P4ak | the options are copied when itemLink is not a function | a copy is forwarded whatever itemLink is | `src/frame-runtime/enhance-wrap.ts` | red: 1 failed \| 93 passed (94). without an itemLink function it forwards the same root and the very same options object, and the rea |
| P4al | the wrapper skips the href check | the wrapper passes any answer on | `src/frame-runtime/enhance-wrap.ts` | red: 2 failed \| 114 passed (116). answers the href only when it is an absolute https: URL, else null; draws only an absolute https: href: http:, javascript:, data:, relative and spaced hrefs are no link |
| P4am | a tracker host planted in a source string | src names a tracker host | `src/frame/items.ts` | red: 1 failed \| 3 passed (4). src/ names no tracker host and no issue URL template |
| P4an | a tracker host planted where the built reader keeps it | the built enhance asset names a tracker host | `src/frame-runtime/enhance-wrap.ts` | red: 2 failed \| 2 passed (4). src/ names no tracker host and no issue URL template; the guard, the bootstrap, the reader and its stylesheet name none |
| P4ao | the answer of the items adapter not judged before the mount | a refused answer reaches frameDocument and fails the mount | `src/host/mount.ts` | red: 1 failed \| 172 passed (173). an answer the frame would refuse is no links: one warning, no items seeded, and the document still m |
| P4ap | a refused answer not warned about | no warning for a refused answer | `src/host/mount.ts` | red: 1 failed \| 172 passed (173). an answer the frame would refuse is no links: one warning, no items seeded, and the document still m |
| P4aq | a getter of the answer read | the answer is read through its accessors | `src/host/mount.ts` | red: 1 failed \| 172 passed (173). an answer the frame would refuse is no links: one warning, no items seeded, and the document still m |

## Review round 1

Rows P4y to P4aq guard the review round's four items: the header-line route in `meta.items` and in the reader (P4y to P4ah), the frame's `enhance` wrapper (P4ai to P4al), the tracker scan (P4am, P4an) and the `items` adapter's answer judged by `./host` (P4ao to P4aq). Each was measured as above (`--maxWorkers=2 --reporter=json`, saved bytes and sha256 restored; each matched); the sha256 of each file as restored: `src/enhance/editorial.ts` `e2efe51145f36bd8df9b9dcb06ca9a9a03509167f65d0a525a69d8d32214289a`, `src/frame-runtime/enhance-wrap.ts` `955028ffb80d859de32594b2ac2c87a1c5c50f89d1b11a87c95f1d5482348891`, `src/frame/items.ts` `1fa950b503a231c4787c52ab587e1ecefa23340290cf3679c3d7269c75a24bab`, `src/host/mount.ts` `067b3d647d9b392c971282aa0d0ecc3fbac82a9d0ac1a6c95a2cdfad56a692aa`, `src/render/items.ts` `f9a4ab2b5034823f1e1c90e66d1d5848afc6dca9210a5ba7b91f56acd9658059`. P4aj's first edit (adding `folds: false` to a copy of options that already held it) stayed green because it changed nothing, and was replaced by one that adds a key (`extra: 1`); the row above is the second. P4ao to P4aq were measured again after the warning's wording changed (a semicolon in it broke the policy-reader scan of `test/frame-csp.test.ts`).

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
  },
  {
    "id": "P4y",
    "guard": "the header-line route removed from meta.items",
    "edit": "render reads no header line",
    "file": "src/render/items.ts",
    "tests": "test/render-items.test.ts",
    "rc": 1,
    "failed": 12,
    "passed": 51,
    "total": 63,
    "red": [
      "meta.items: the header-line route (a paragraph that stands alone as an item field's label and its keys) > lists the keys of `**Field:** AB-90`, with the colon inside the bold text or right after it, and of several keys",
      "meta.items: the header-line route (a paragraph that stands alone as an item field's label and its keys) > is read before or after the meta line, and wherever it stands before the first level-2 heading",
      "meta.items: the header-line route (a paragraph that stands alone as an item field's label and its keys) > is used only when the byline has no item fact: the byline keeps its precedence, and a delta key still lists",
      "meta.items: the header-line route (a paragraph that stands alone as an item field's label and its keys) > is off without the item fields (P4: the vocabulary gates it), and never scans the body",
      "meta.items equals the keys the enhance step asks itemLink for > fixture: header line",
      "meta.items equals the keys the enhance step asks itemLink for > fixture: header line, colon outside"
    ]
  },
  {
    "id": "P4z",
    "guard": "the header-line route removed from the reader",
    "edit": "the reader links no header line",
    "file": "src/enhance/editorial.ts",
    "tests": "test/render-items.test.ts,test/enhance-vocab.test.ts",
    "rc": 1,
    "failed": 11,
    "passed": 198,
    "total": 209,
    "red": [
      "the item link, by the header-line route: a paragraph standing alone as an item field's label and its keys > links the keys where they stand, with a click listener on the paragraph, and leaves the label as it was",
      "the item link, by the header-line route: a paragraph standing alone as an item field's label and its keys > is not used once the delta key has a link, and is when it has none",
      "the item link, by the header-line route: a paragraph standing alone as an item field's label and its keys > destroy puts the paragraph back as the author wrote it",
      "meta.items equals the keys the enhance step asks itemLink for > fixture: header line",
      "meta.items equals the keys the enhance step asks itemLink for > fixture: header line, colon outside",
      "meta.items equals the keys the enhance step asks itemLink for > fixture: header line with several keys and code"
    ]
  },
  {
    "id": "P4aa",
    "guard": "the header line read without itemFields (render)",
    "edit": "any bold label opens a header line in render",
    "file": "src/render/items.ts",
    "tests": "test/render-items.test.ts",
    "rc": 1,
    "failed": 4,
    "passed": 59,
    "total": 63,
    "red": [
      "meta.items: the header-line route (a paragraph that stands alone as an item field's label and its keys) > is no header line when the paragraph has other text, is not a root child, is past the first level-2 heading or has no key",
      "meta.items: the header-line route (a paragraph that stands alone as an item field's label and its keys) > is off without the item fields (P4: the vocabulary gates it), and never scans the body",
      "meta.items equals the keys the enhance step asks itemLink for > fixture: header line, not an item field",
      "meta.items equals the keys the enhance step asks itemLink for > holds for every fixture under each part of the vocabulary alone"
    ]
  },
  {
    "id": "P4ab",
    "guard": "the header line read without itemFields (reader)",
    "edit": "any bold label opens a header line in the reader",
    "file": "src/enhance/editorial.ts",
    "tests": "test/render-items.test.ts,test/enhance-vocab.test.ts",
    "rc": 1,
    "failed": 3,
    "passed": 206,
    "total": 209,
    "red": [
      "the item link, by the header-line route: a paragraph standing alone as an item field's label and its keys > is the third route: no byline item fact and no delta link, and only for a paragraph that stands alone",
      "meta.items equals the keys the enhance step asks itemLink for > fixture: header line, not an item field",
      "meta.items equals the keys the enhance step asks itemLink for > holds for every fixture under each part of the vocabulary alone"
    ]
  },
  {
    "id": "P4ac",
    "guard": "a paragraph with other text read as a header line (render)",
    "edit": "render does not require the paragraph to stand alone",
    "file": "src/render/items.ts",
    "tests": "test/render-items.test.ts",
    "rc": 1,
    "failed": 3,
    "passed": 60,
    "total": 63,
    "red": [
      "meta.items: the header-line route (a paragraph that stands alone as an item field's label and its keys) > is no header line when the paragraph has other text, is not a root child, is past the first level-2 heading or has no key",
      "meta.items equals the keys the enhance step asks itemLink for > fixture: header line with other text",
      "meta.items equals the keys the enhance step asks itemLink for > holds for every fixture under each part of the vocabulary alone"
    ]
  },
  {
    "id": "P4ad",
    "guard": "a paragraph with other text read as a header line (reader)",
    "edit": "the reader does not require the paragraph to stand alone",
    "file": "src/enhance/editorial.ts",
    "tests": "test/render-items.test.ts,test/enhance-vocab.test.ts",
    "rc": 1,
    "failed": 3,
    "passed": 206,
    "total": 209,
    "red": [
      "the item link, by the header-line route: a paragraph standing alone as an item field's label and its keys > is the third route: no byline item fact and no delta link, and only for a paragraph that stands alone",
      "meta.items equals the keys the enhance step asks itemLink for > fixture: header line with other text",
      "meta.items equals the keys the enhance step asks itemLink for > holds for every fixture under each part of the vocabulary alone"
    ]
  },
  {
    "id": "P4ae",
    "guard": "the header line read beside a byline item fact (render)",
    "edit": "render lists the header line whatever the byline has",
    "file": "src/render/items.ts",
    "tests": "test/render-items.test.ts",
    "rc": 1,
    "failed": 4,
    "passed": 59,
    "total": 63,
    "red": [
      "meta.items: the header-line route (a paragraph that stands alone as an item field's label and its keys) > is used only when the byline has no item fact: the byline keeps its precedence, and a delta key still lists",
      "meta.items equals the keys the enhance step asks itemLink for > fixture: header line with a byline fact",
      "meta.items equals the keys the enhance step asks itemLink for > fixture: header line with an empty byline fact",
      "meta.items equals the keys the enhance step asks itemLink for > holds for every fixture under each part of the vocabulary alone"
    ]
  },
  {
    "id": "P4af",
    "guard": "the header line read beside a byline item fact (reader)",
    "edit": "the reader asks the header line whatever the byline has",
    "file": "src/enhance/editorial.ts",
    "tests": "test/render-items.test.ts,test/enhance-vocab.test.ts",
    "rc": 1,
    "failed": 4,
    "passed": 205,
    "total": 209,
    "red": [
      "the item link, by the header-line route: a paragraph standing alone as an item field's label and its keys > is the third route: no byline item fact and no delta link, and only for a paragraph that stands alone",
      "meta.items equals the keys the enhance step asks itemLink for > fixture: header line with a byline fact",
      "meta.items equals the keys the enhance step asks itemLink for > fixture: header line with an empty byline fact",
      "meta.items equals the keys the enhance step asks itemLink for > holds for every fixture under each part of the vocabulary alone"
    ]
  },
  {
    "id": "P4ag",
    "guard": "a paragraph past the first level-2 heading read (render)",
    "edit": "render reads the body for a header line",
    "file": "src/render/items.ts",
    "tests": "test/render-items.test.ts",
    "rc": 1,
    "failed": 3,
    "passed": 60,
    "total": 63,
    "red": [
      "meta.items: the header-line route (a paragraph that stands alone as an item field's label and its keys) > is no header line when the paragraph has other text, is not a root child, is past the first level-2 heading or has no key",
      "meta.items equals the keys the enhance step asks itemLink for > fixture: header line past the first section",
      "meta.items equals the keys the enhance step asks itemLink for > holds for every fixture under each part of the vocabulary alone"
    ]
  },
  {
    "id": "P4ah",
    "guard": "a paragraph past the first level-2 heading read (reader)",
    "edit": "the reader reads the body for a header line",
    "file": "src/enhance/editorial.ts",
    "tests": "test/render-items.test.ts,test/enhance-vocab.test.ts",
    "rc": 1,
    "failed": 3,
    "passed": 206,
    "total": 209,
    "red": [
      "the item link, by the header-line route: a paragraph standing alone as an item field's label and its keys > is the third route: no byline item fact and no delta link, and only for a paragraph that stands alone",
      "meta.items equals the keys the enhance step asks itemLink for > fixture: header line past the first section",
      "meta.items equals the keys the enhance step asks itemLink for > holds for every fixture under each part of the vocabulary alone"
    ]
  },
  {
    "id": "P4ai",
    "guard": "the frame's enhance wrapper writes an attribute",
    "edit": "the wrapper touches the root",
    "file": "src/frame-runtime/enhance-wrap.ts",
    "tests": "test/enhance-appearance.test.ts",
    "rc": 1,
    "failed": 2,
    "passed": 92,
    "total": 94,
    "red": [
      "the frame's enhance (docserver parity T4, review round 1): wrapEnhance forwards the options, and touches no element > touches no element, attribute or text, in the root or the document, on either path",
      "the frame's enhance (docserver parity T4, review round 1): wrapEnhance forwards the options, and touches no element > src/frame-runtime/enhance-wrap.ts names no DOM, global or storage API (the walls test's own kind of scan)"
    ]
  },
  {
    "id": "P4aj",
    "guard": "the forwarded copy differs in more than itemLink",
    "edit": "the wrapper adds a key",
    "file": "src/frame-runtime/enhance-wrap.ts",
    "tests": "test/enhance-appearance.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 93,
    "total": 94,
    "red": [
      "the frame's enhance (docserver parity T4, review round 1): wrapEnhance forwards the options, and touches no element > with an itemLink function it forwards a copy that differs in itemLink alone, and leaves the host's object as it was"
    ]
  },
  {
    "id": "P4ak",
    "guard": "the options are copied when itemLink is not a function",
    "edit": "a copy is forwarded whatever itemLink is",
    "file": "src/frame-runtime/enhance-wrap.ts",
    "tests": "test/enhance-appearance.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 93,
    "total": 94,
    "red": [
      "the frame's enhance (docserver parity T4, review round 1): wrapEnhance forwards the options, and touches no element > without an itemLink function it forwards the same root and the very same options object, and the reader's answer"
    ]
  },
  {
    "id": "P4al",
    "guard": "the wrapper skips the href check",
    "edit": "the wrapper passes any answer on",
    "file": "src/frame-runtime/enhance-wrap.ts",
    "tests": "test/enhance-appearance.test.ts,test/enhance-frame-wire.test.ts",
    "rc": 1,
    "failed": 2,
    "passed": 114,
    "total": 116,
    "red": [
      "the frame's enhance (docserver parity T4, review round 1): wrapEnhance forwards the options, and touches no element > answers the href only when it is an absolute https: URL, else null",
      "the item link of the frame: seeded hrefs, drawn by the reader (docserver parity T4) > draws only an absolute https: href: http:, javascript:, data:, relative and spaced hrefs are no link, and the value stays text (the reader's own check, P4c)"
    ]
  },
  {
    "id": "P4am",
    "guard": "a tracker host planted in a source string",
    "edit": "src names a tracker host",
    "file": "src/frame/items.ts",
    "tests": "test/no-tracker.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 3,
    "total": 4,
    "red": [
      "no default tracker anywhere in the library > src/ names no tracker host and no issue URL template"
    ]
  },
  {
    "id": "P4an",
    "guard": "a tracker host planted where the built reader keeps it",
    "edit": "the built enhance asset names a tracker host",
    "file": "src/frame-runtime/enhance-wrap.ts",
    "tests": "test/no-tracker.test.ts",
    "rc": 1,
    "failed": 2,
    "passed": 2,
    "total": 4,
    "red": [
      "no default tracker anywhere in the library > src/ names no tracker host and no issue URL template",
      "the built frame assets > the guard, the bootstrap, the reader and its stylesheet name none"
    ]
  },
  {
    "id": "P4ao",
    "guard": "the answer of the items adapter not judged before the mount",
    "edit": "a refused answer reaches frameDocument and fails the mount",
    "file": "src/host/mount.ts",
    "tests": "test/host-mount.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 172,
    "total": 173,
    "red": [
      "docserver parity T4: the items adapter resolves the document's item values into seeded links > an answer the frame would refuse is no links: one warning, no items seeded, and the document still mounts (S2)"
    ]
  },
  {
    "id": "P4ap",
    "guard": "a refused answer not warned about",
    "edit": "no warning for a refused answer",
    "file": "src/host/mount.ts",
    "tests": "test/host-mount.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 172,
    "total": 173,
    "red": [
      "docserver parity T4: the items adapter resolves the document's item values into seeded links > an answer the frame would refuse is no links: one warning, no items seeded, and the document still mounts (S2)"
    ]
  },
  {
    "id": "P4aq",
    "guard": "a getter of the answer read",
    "edit": "the answer is read through its accessors",
    "file": "src/host/mount.ts",
    "tests": "test/host-mount.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 172,
    "total": 173,
    "red": [
      "docserver parity T4: the items adapter resolves the document's item values into seeded links > an answer the frame would refuse is no links: one warning, no items seeded, and the document still mounts (S2)"
    ]
  }
]
```
