# Task 4 mutation rows (`./host`: the adapter key, the faces, `setAppearance`)

Each mutant was applied in place, `test/host-mount.test.ts` run through the fleet wrapper, and the file restored from a saved copy (sha256 checked equal).

| Row | Guard | Edit | Tests run | Result |
|---|---|---|---|---|
| A4a | The op is posted only after a valid ready | `if (ready)` in `sendAppearance` becomes `if (true)` | `test/host-mount.test.ts` | red (2 failed) |
| A4b | Before ready the latest verdict wins | `pendingAppearance = a` keeps the first (`pendingAppearance ?? a`) | `test/host-mount.test.ts` | red (1 failed) |
| A4c | A remount is seeded with the latest appearance | The `appearance` seed field is left out of `frameOptions` | `test/host-mount.test.ts` | red (5 failed) |
| A4d | The verdict, not the raw value, is posted | `sendAppearance(a)` in place of `sendAppearance(verdict)` | `test/host-mount.test.ts` | red (1 failed) |
| A4e | A bad face is dropped, never thrown (`fontsOf`, `src/frame/document.ts`) | A face failing `goodFace` throws a `TypeError` | `test/host-mount.test.ts` | red (1 failed) |
| A4f | `adapters.appearance` that is not a plain object throws at step 1 | The plain-object check removed from `check()` | `test/host-mount.test.ts` | red (1 failed) |
| A4g | A malformed `fonts` throws at step 1, not as a fallback | The `fontsOf` call removed from `check()` | `test/host-mount.test.ts` | red (1 failed) |
| A4h | `setAppearance` of a non-plain value throws whatever the state | The plain-object check removed from `setAppearance` | `test/host-mount.test.ts` | red (1 failed) |
| A4i | The queued values are flushed before the host's `onReady` runs | `call('onReady')` moved before the flush | `test/host-mount.test.ts` | red (1 failed) |
| A4j | Every mount is built from the checked copy of `assets` | `frameDocument` handed the host's live `assets` | `test/host-mount.test.ts` | red (2 failed) |
| A4k | A Proxy's own throw never escapes the plain-object check | the `try`/`catch` in `isPlain` removed | `test/host-mount.test.ts` | red (1 failed) |

```json
[
  {"row":"A4a","guard":"post only after ready","edit":"if (ready) -> if (true)","tests":"test/host-mount.test.ts","result":"red"},
  {"row":"A4b","guard":"queue latest wins","edit":"pendingAppearance ?? a","tests":"test/host-mount.test.ts","result":"red"},
  {"row":"A4c","guard":"remount seeds the latest appearance","edit":"seed field omitted","tests":"test/host-mount.test.ts","result":"red"},
  {"row":"A4d","guard":"verdict posted, not the raw value","edit":"sendAppearance(a)","tests":"test/host-mount.test.ts","result":"red"},
  {"row":"A4e","guard":"a bad face is dropped","edit":"bad face throws","tests":"test/host-mount.test.ts","result":"red"},
  {"row":"A4f","guard":"adapters.appearance plain check","edit":"check removed","tests":"test/host-mount.test.ts","result":"red"},
  {"row":"A4g","guard":"fonts shape checked at step 1","edit":"fontsOf call removed","tests":"test/host-mount.test.ts","result":"red"},
  {"row":"A4h","guard":"setAppearance plain check","edit":"check removed","tests":"test/host-mount.test.ts","result":"red"},
  {"row":"A4i","guard":"flush before onReady","edit":"onReady called first","tests":"test/host-mount.test.ts","result":"red"},
  {"row":"A4j","guard":"checked copy of assets","edit":"live assets handed on","tests":"test/host-mount.test.ts","result":"red"},
  {"row":"A4k","guard":"isPlain try/catch","edit":"catch removed","tests":"test/host-mount.test.ts","result":"red"}
]
```
