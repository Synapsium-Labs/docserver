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

## Review 2906 F3

The coordinator's ruling: no departure; `assets` stays live as in 1.1.0 and only `fonts` is read at mount. Row A4j above (the checked copy of `assets`) is superseded by the row below: `frameDocument` is handed a facade that inherits from the host's own object, with the checked faces as its one own property (follow-up: later replaced, see row F3b). The three new rows run in `test/host-mount.test.ts`; their red and green runs were measured with the in-memory frame build standing in for the committed manifest, which is stale until the generated files are rebuilt.

| Row | Guard | Edit | Tests run | Result |
|---|---|---|---|---|
| F3a | Every asset but `fonts` is read live at each mount (an inherited `guard`, `bootstrap`, `enhance` or `css` mounts; a later `assets.mermaid` is seen by `update()`; a throwing Proxy is a fallback, never a throw) | `assetsOf` restored to the one-time snapshot of own properties | `test/host-mount.test.ts` (F3 rows) | red (3 failed: inherited assets fall back, a later `mermaid` is not seen, the Proxy's throw escapes `mountDocFrame`) |

Follow-up to F3: the facade over `Object.create(assets)` is replaced. A host that gives no `fonts` is handed to `frameDocument` as it is; one that gives `fonts` (or inherits one) gets a Proxy over an empty target that answers `fonts` and forwards every other read to the host with the host as receiver, so a getter reading a `#private` field works in both cases.

| Row | Guard | Edit | Tests run | Result |
|---|---|---|---|---|
| F3b | A host with no `fonts` is handed on itself (a class with `#private` getters mounts) | the `Object.create` facade always handed on (the code before this follow-up) | `test/host-mount.test.ts` (the `#private` row) | red (1 failed: the mount fell back) |

```json
[
  {"row":"F3a","guard":"only fonts is read at mount; assets stay live","edit":"assetsOf restored to the snapshot","tests":"test/host-mount.test.ts F3 rows","result":"red"},
  {"row":"F3b","guard":"a host with no fonts is handed on itself","edit":"facade always handed on","tests":"test/host-mount.test.ts #private row","result":"red"}
]
```

## Second review F6

The ruling: `assets` stays live. `fonts` is read and checked at mount when the host gives it then; a host that gave none keeps a live object, each later mount reads it again, and a malformed `fonts` met at `update()` is the same kind of outcome as at mount: a `TypeError` thrown by `update()` before anything is torn down (the current mount stays, no fallback). Measured in `test/host-mount.test.ts` with the rows named `F6` plus the existing `mutating assets.fonts after mount` row (run with `-t`); the in-memory frame build stood in for the committed manifest, which is stale until the generated files are rebuilt. Red first: before the change two `F6` rows failed (a malformed `fonts` fell through frameDocument as a fallback or was ignored, a getter on `fonts` was called by frameDocument).

| Row | Guard | Edit | Tests run | Result |
|---|---|---|---|---|
| F6a | A host that gave no `fonts` at mount has its live `assets` read again by `update()`, before teardown | the re-read in `update()` removed | `test/host-mount.test.ts` (`F6` rows) | red (3 failed) |
| F6b | A host that gave `fonts` at mount has it fixed for the DocFrame's life | the re-read in `update()` made unconditional | `test/host-mount.test.ts` (`mutating assets.fonts after mount` row) | red (1 failed) |
| F6c | An own `fonts` holding `undefined` is none, so the live object is read again | `given` true for any own `fonts` | `test/host-mount.test.ts` (`F6` rows) | red (1 failed) |

```json
[
  {"row":"F6a","guard":"update() reads the live assets again when no fonts was given at mount","edit":"re-read removed","tests":"test/host-mount.test.ts F6 rows","result":"red"},
  {"row":"F6b","guard":"fonts given at mount is fixed","edit":"re-read unconditional","tests":"test/host-mount.test.ts mutating-fonts row","result":"red"},
  {"row":"F6c","guard":"own fonts undefined is none","edit":"given for any own fonts","tests":"test/host-mount.test.ts F6 rows","result":"red"}
]
```
