# Parity Task 14 (B2): size closeout mutations

These rows use the pure `judge` in `test/size-rules.ts` over Landing B1's merge (`f46f498`, the first parent) and B2's manifest and committed growth row. The mutation target is the in-memory manifest, not the judge or a file: a scratch script outside the tree parses the real `src/frame/manifest.generated.ts` and the real tables, changes one entry in memory, and judges it with the text `Size-Design: x2`. No shipped asset, table or test is edited by a row. The unmodified control has no violations. Sizes are UTF-16 code units.

The measured row is `{"design":"x2","total":5279256,"frame":4571331}`: B1's `total` 4,885,103 plus the four new entries (review script 192,264, review stylesheet 8,860, guided script 181,476, guided stylesheet 11,553; 394,153 together), and the parent's `frame`, because the five default entries keep their sha256.

P14a keeps that row and moves the review stylesheet's 8,860 characters into the shared stylesheet. `total` does not move, but `frame` rises by the 8,860 characters every frame would then carry. P14b and P14c re-measure, at the final tip of this landing, what Lr-d (Task 12) and Lg-d (Task 13) measured on earlier tips: each layout's characters against the default enhance bundle's 225,709. Review is 201,124 and guided 193,029 at this tip; each is padded in memory to one character past the default's bundle, and the control one character short is accepted.

| Row | Guard | Mutation | Measured result |
|---|---|---|---|
| P14a | Layout-only CSS is counted only in its own frame | Move review's 8,860 stylesheet characters into the shared `reader.css` entry, keeping the measured growth row | Red: `total` stays 5,279,256, `frame` rises from 4,571,331 to 4,580,191, and the judge rejects the stale row ("the rule: the newest growth row is not the recomputation from the judged commit"); the control has no violation |
| P14b | The review layout is at most the default enhance bundle (test 8's layout row) | Pad the review script's characters by 24,586, so review is 225,710 | Red: "layouts: review is 225710 characters, over the default enhance bundle's 225709"; padding by 24,585 (225,709) has no violation |
| P14c | The guided layout is at most the default enhance bundle (test 8's layout row) | Pad the guided script's characters by 32,681, so guided is 225,710 | Red: "layouts: guided is 225710 characters, over the default enhance bundle's 225709"; padding by 32,680 (225,709) has no violation |

```json
[
  {"id":"P14a","guard":"do not charge layout-only CSS to every frame","edit":"move 8860 review stylesheet code units into the shared asset and leave the growth row unchanged","target":"in-memory manifest","tests":"test/size-rules.ts (pure judge)","rc":1,"control":{"total":5279256,"frame":4571331,"violations":[]},"mutant":{"total":5279256,"frame":4580191,"violations":["the rule: the newest growth row is not the recomputation from the judged commit"]}},
  {"id":"P14b","guard":"review stays at most the default enhance bundle","edit":"pad the review script's manifest characters by 24586","target":"in-memory manifest","tests":"test/size-rules.ts (pure judge)","rc":1,"control":{"review":201124,"defaultBundle":225709,"paddedToDefault":{"review":225709,"violations":[]},"violations":[]},"mutant":{"review":225710,"violations":["layouts: review is 225710 characters, over the default enhance bundle's 225709"]},"note":"re-measures Lr-d at the final tip"},
  {"id":"P14c","guard":"guided stays at most the default enhance bundle","edit":"pad the guided script's manifest characters by 32681","target":"in-memory manifest","tests":"test/size-rules.ts (pure judge)","rc":1,"control":{"guided":193029,"defaultBundle":225709,"paddedToDefault":{"guided":225709,"violations":[]},"violations":[]},"mutant":{"guided":225710,"violations":["layouts: guided is 225710 characters, over the default enhance bundle's 225709"]},"note":"re-measures Lg-d at the final tip"}
]
```
