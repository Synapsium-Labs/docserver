# L2 Task 22: mutation rows (Changes since)

These rows name the guards introduced by Task 22: local civil-day grouping, bounded normalized commits, one normal-load seen write, late review-strip placement, host-only version actions, and post-call liveness. They are recorded for the approved feature surface. No mutation campaign was run in this task because its required throwaway-copy runner is out of scope; L2-T22-M1 has one approved in-place semantic reversal, while every other row remains pending a later bounded semantic proof.

| Row | Guard | File | Test | Status |
|---|---|---|---|---|
| L2-T22-M1 | day keys use local `Date` fields, not UTC fields | `src/enhance/since.ts` | `test/enhance-since.test.ts` local-midnight case | killed 2026-10-25: one in-place UTC-field reversal red; source SHA-256 restored |
| L2-T22-M2 | merge subjects stay out of day groups | `src/enhance/since.ts` | `test/enhance-since.test.ts` menu cases | pending semantic proof |
| L2-T22-M3 | quick ranges omit zero or duplicate counts | `src/enhance/since.ts` | `test/enhance-since.test.ts` menu cases | pending semantic proof |
| L2-T22-M4 | only-day control requires a base and host callback | `src/enhance/since.ts` | `test/enhance-since.test.ts` unavailable-control case | pending semantic proof |
| L2-T22-M5 | normal mode reads seen before writing it once | `src/enhance/since.ts` | `test/enhance-since.test.ts` seen-write case | pending semantic proof |
| L2-T22-M6 | day mode never writes seen | `src/enhance/since.ts` | `test/enhance-since.test.ts` day-view case | pending semantic proof |
| L2-T22-M7 | a reply after destroy adds no notice | `src/enhance/since.ts` | `test/enhance-since.test.ts` async-destroy case | pending semantic proof |
| L2-T22-M8 | strip placement remains in the context-keyed facade | `src/enhance/strip.ts` | `test/enhance-since.test.ts` detached-facade case | pending semantic proof |
| L2-T22-M9 | menu geometry goes only through journal styles | `src/enhance/since.ts` | `test/browser/since.test.ts` geometry case | pending semantic proof |
| L2-T22-M10 | host input is already normalized before menu work | `src/enhance/since.ts` | `test/enhance-since.test.ts` hostile-input case | pending semantic proof |

```json
[
  {"id":"L2-T22-M1","file":"src/enhance/since.ts","old":"date.getFullYear()/getMonth()/getDate()","new":"date.getUTCFullYear()/getUTCMonth()/getUTCDate()","tests":"test/enhance-since.test.ts","status":"killed 2026-10-25; restored SHA-256 c6ab1b122aa6cfd604532e7cb464dca608da0b11e2d3e7f7f0756b7d66075542"},
  {"id":"L2-T22-M4","file":"src/enhance/since.ts","old":"!ctx.host.present.has('openVersion')","new":"false","tests":"test/enhance-since.test.ts","status":"pending"},
  {"id":"L2-T22-M5","file":"src/enhance/since.ts","old":"const prior = readSeen(ctx.state.readDoc('seen'));","new":"const prior = null;","tests":"test/enhance-since.test.ts","status":"pending"},
  {"id":"L2-T22-M7","file":"src/enhance/since.ts","old":"if (!ctx.live() || !('places' in outcome) || outcome.places === 0) return;","new":"if (!('places' in outcome) || outcome.places === 0) return;","tests":"test/enhance-since.test.ts","status":"pending"},
  {"id":"L2-T22-M8","file":"src/enhance/strip.ts","old":"return strip === undefined || !ctx.live() ? null : strip;","new":"return strip ?? null;","tests":"test/enhance-since.test.ts","status":"pending"}
]
```
