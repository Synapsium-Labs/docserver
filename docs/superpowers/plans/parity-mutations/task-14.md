# Parity Task 14: B1 closeout and first review fix mutations

P14a calls the size test's pure `judge` over Landing A (`1c2120d`) and B1's manifest and committed-row inputs. The probe changes only an in-memory manifest: it removes Classic's stylesheet entry and adds its characters to the shared stylesheet while retaining the measured growth row. The unmodified control has no violations. Sizes are UTF-16 code units.

The pointer and corpus rows were measured one file at a time through the test wrapper, with Chromium selected for browser files. The original CSS measured 56 px on coarse pointers in both layouts with a 56 px host slot, and the stylesheet walk found two Close rules per layout referring to the slot (one unguarded and one coarse). The restored CSS measured 44 px on coarse pointers and followed both hosted values (40 and 56 px) on fine pointers. The hostile ratchet CLI case uses a scratch Git fixture, not the shipped snapshots.

| Row | Guard | Mutation | Measured result |
|---|---|---|---|
| P14a | Layout CSS is counted only in its own frame | Move Classic's 4,205 stylesheet characters into shared `reader.css`, keeping the original B1 growth row | Red: `total` stays 4,885,103, `frame` rises from 4,571,331 to 4,575,536; the judge rejects the stale row |
| B1F1c | Classic's Close rule uses `controlRow` only with a fine pointer | Remove `(pointer: fine)` from Classic's Close control-row rule only | Red: stylesheet walk 1 failed, 1 passed, 78 skipped; drawer 1 failed, 3 passed, 38 skipped (touch measured 56 px instead of 44 px) |
| B1F1e | Editorial's Close rule uses `controlRow` only with a fine pointer | Remove `(pointer: fine)` from Editorial's Close control-row rule only | Red: stylesheet walk 1 failed, 1 passed, 78 skipped; drawer 1 failed, 3 passed, 38 skipped (touch measured 56 px instead of 44 px) |
| B1A1d | Every shipped alternate must have a snapshot directory | Bypass the missing-directory error in `layoutsWithSnapshots` | Red: 1 failed, 337 skipped; the absent alternate directory no longer throws |
| B1A1h | A per-layout hostile snapshot cannot be deleted even with its trailer | Bypass the per-layout hostile deletion check | Red: 2 failed, 54 skipped; both the unit case and the actual ratchet command accept the forbidden deletion |
| B1A1t | A per-layout hostile snapshot edit requires its own trailer | Call `checkLayoutMoves` with no detected moves | Red: 1 failed, 55 skipped; the ratchet command accepts an unnamed modification |

```json
[
  {"id":"P14a","guard":"do not charge layout-only CSS to every frame","edit":"move 4205 Classic stylesheet code units into the in-memory shared asset and leave the growth row unchanged","file":"test/size-rules.ts","tests":"judge (pure entry)","rc":1,"control":{"total":4885103,"frame":4571331,"violations":[]},"mutant":{"total":4885103,"frame":4575536,"violations":["the rule: the newest growth row is not the recomputation from the judged commit"]}},
  {"id":"B1F1c","guard":"Classic Close controlRow only under a fine pointer","edit":"unguard Classic's Close controlRow rule","file":"assets/layouts/classic.css","runs":[{"tests":"test/browser/appearance-cues.test.ts","rc":1,"failed":1,"passed":1,"skipped":78},{"tests":"test/browser/layout-editorial.test.ts","rc":1,"failed":1,"passed":3,"skipped":38}],"observedTouchPx":56,"expectedTouchPx":44},
  {"id":"B1F1e","guard":"Editorial Close controlRow only under a fine pointer","edit":"unguard Editorial's Close controlRow rule","file":"assets/layouts/editorial.css","runs":[{"tests":"test/browser/appearance-cues.test.ts","rc":1,"failed":1,"passed":1,"skipped":78},{"tests":"test/browser/layout-editorial.test.ts","rc":1,"failed":1,"passed":3,"skipped":38}],"observedTouchPx":56,"expectedTouchPx":44},
  {"id":"B1A1d","guard":"reject missing shipped-layout directories","edit":"disable missing.length > 0 branch","file":"test/browser/layout-cases.ts","tests":"test/browser/layout-corpus.test.ts","rc":1,"failed":1,"skipped":337,"red":["a missing shipped layout snapshot directory is refused"]},
  {"id":"B1A1h","guard":"refuse deletion even when named","edit":"disable the per-layout hostile deletion check","file":"scripts/ratchet.mjs","tests":"test/ratchet.test.ts","rc":1,"failed":2,"skipped":54,"red":["per-layout hostile snapshots cannot be deleted, while moves and additions remain allowed","the CLI refuses a named hostile per-layout deletion and accepts named edits and additions"]},
  {"id":"B1A1t","guard":"require an exact trailer for a per-layout snapshot edit","edit":"call checkLayoutMoves with no detected moves","file":"scripts/ratchet.mjs","tests":"test/ratchet.test.ts","rc":1,"failed":1,"skipped":55,"red":["the CLI refuses a named hostile per-layout deletion and accepts named edits and additions"]}
]
```
