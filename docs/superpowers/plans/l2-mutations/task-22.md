# L2 Task 22: mutation rows (Changes since)

The parent measured these finite in-place reversals sequentially, restoring original bytes after every row. The final control `task24-guard-final-control-20261025.log` passes 75 tests. Later full non-layout verification passes 2,636 tests in 79 files; Chromium layout passes 273 in 34 files, with 233 excluded, and all three TypeScript projects pass. These are not packed-consumer, built-artifact mutation, WebKit, CI, whole-branch or requested-model acceptance.

`since.ts` restores to SHA-256 `3a9858b475884b4e0985764f16b3b8bac7ce063741aca8bfc5bf9d5138b2beb6`. Options and strip originals are also byte-restored. Historical M1 restored SHA-256 `c6ab1b122aa6cfd604532e7cb464dca608da0b11e2d3e7f7f0756b7d66075542` predates the range-label correction.

## Results

Receipt names below are prefixed `task24-since-guard-` and suffixed `-20261025.log`, except the explicitly named final M9 receipt. Each red is an assertion failure, not just a nonzero exit.

| Row | Guard | Result and receipt suffix | Public witness |
|---|---|---|---|
| L2-T22-M1 | local civil dates | Historical approved in-place UTC-field reversal red; restoration SHA above | Local-midnight groups |
| L2-T22-M2groups | omit merges from day groups | ASSERTION RED; `M2groups` | `omits merge commits from quick-range counts as well as day groups`: unexpected merge snippet |
| L2-T22-M2quick | omit merges from quick counts | ASSERTION RED; `M2quick` | Same test: 2/3 changes instead of 1/2 |
| L2-T22-M3zero | omit empty ranges | ASSERTION RED; `M3zero` | `omits an empty Today range while retaining a positive seven-day range`: extra zero Today |
| L2-T22-M3duplicate | omit duplicate ranges | ASSERTION RED; `M3duplicate-targeted` | Same test: duplicate d30 appears |
| L2-T22-M4host | only-day needs host callback | ASSERTION RED; `M4host` | `does not build host-only version controls without its host callback` |
| L2-T22-M4base | only-day needs older base | ASSERTION RED; `M4base` | `offers only-day actions only where a day has a valid older base` |
| L2-T22-M5read | read previous seen state | ASSERTION RED; `M5read-assertion` | `reads seen before the once-per-load write and adds a notice only after a real changed place`: notice absent |
| L2-T22-M5write | write seen once per normal load | ASSERTION RED; `M5write` | Same test: zero writes instead of one |
| L2-T22-M6 | day mode does not write seen | ASSERTION RED; `M6` | `keeps a valid empty-history day banner and its host action without writing seen` |
| L2-T22-M7 | addNotice outer live conjunct | SURVIVED; `M7`; redundant for inspected DOM behavior | `starts a measured comparison before destroy and lets its late reply mutate nothing` |
| L2-T22-M8 | refuse nonlive strip facade | ASSERTION RED; `M8` | `rejects nonlive and unknown strip facades before teardown, preserving placed siblings` |
| L2-T22-M9 | apply dynamic popup height | ASSERTION RED; `task24-final-guard-M9-dynamic-20261025.log` | Browser `opens a clamped desktop menu with local-day rows, roving focus and no CSP violation`: CSS fallback 490px instead of dynamic 349px |
| L2-T22-M10 | upstream commit cap | ASSERTION RED; `M10-assertion` | `reads only normalized commits and keeps hostile source sizes out of the rendered menu`: index-100 descriptor read |
| L2-T22-M11 | show continuation live check | ASSERTION RED; `M11show` | `keeps a selected comparison menu unchanged when its host reply arrives after destroy`: detached DOM changes |
| L2-T22-M12 | after outer live conjunct | SURVIVED; `M12afterlive`; separately measured | Existing roving day-action/day-banner witness |
| L2-T22-M13 | empty places keep Show hidden | ASSERTION RED; `M13emptyday` | `builds roving day actions and sends exact only-day and latest-version host payloads` |

M7 is not called red: `changes.ts` returns `skipped: 'gone'` after destroy, rejected by the remaining outcome predicate. If destruction follows a positive outcome, `reviewStrip`, `operate` and journal liveness still refuse exposed DOM work. M12 independently retains its outcome filter, operation boundary and inner live check. Read-only review identified no supported DOM witness for these exact two conjunct deletions. Neither surviving row establishes redundancy of M11, which has its own assertion-red receipt. This distinction requires the coordinator's scoped redundancy ruling, not an every-row-red claim.

M9 proves dynamic height application, not exclusive journal ownership. M10 belongs to `src/enhance/options.ts`, not a duplicated local since guard. Existing source-size tests do not separately prove every upstream subject bound.

## Exact Reversals

Each substitution must match once in the specified scope. Unit commands use `./node_modules/.bin/vitest run --project since-unit test/enhance-since.test.ts -t <witness> --maxWorkers=1 --fileParallelism=false`. M9 uses `--project layout test/browser/since.test.ts`, with `DOCREADER_BROWSERS=chromium`. Raw receipts retain exact argv, environment, deadline, output cap and actual exit.

| Row | File and scope | FROM | TO |
|---|---|---|---|
| M2groups | `src/enhance/since.ts`, `groupsOf` only | `const commits = (ctx.info.commits ?? []).filter((entry) => !ctx.vocab.merge.test(entry.subject));` | `const commits = ctx.info.commits ?? [];` |
| M2quick | `src/enhance/since.ts`, `quickRanges` only | Same filter declaration | `const commits = ctx.info.commits ?? [];` |
| M3zero | `src/enhance/since.ts` | `if (n === 0 || n === previous) continue;` | `if (n === previous) continue;` |
| M3duplicate | `src/enhance/since.ts` | `if (n === 0 || n === previous) continue;` | `if (n === 0) continue;` |
| M4host | `src/enhance/since.ts` | `if (group.base === null || !ctx.host.present.has('openVersion')) return null;` | `if (group.base === null) return null;` |
| M4base | `src/enhance/since.ts` | Same only-day guard | `if (!ctx.host.present.has('openVersion')) return null;` |
| M5read | `src/enhance/since.ts` | `const prior = readSeen(ctx.state.readDoc('seen'));` | `const prior = null;` |
| M5write | `src/enhance/since.ts`, normal build | `ctx.state.writeDoc('seen', { sha: ctx.info.sha, at: ctx.env.now() });` | Omit call |
| M6 | `src/enhance/since.ts`, terminal day-branch return immediately before `const prior` | `return;` | Insert `ctx.state.writeDoc('seen', { sha: ctx.info.sha, at: ctx.env.now() });` before the return; preserve banner branch |
| M7 | `src/enhance/since.ts`, `addNotice` only | `if (!ctx.live() || !('places' in outcome) || outcome.places === 0) return;` | `if (!('places' in outcome) || outcome.places === 0) return;` |
| M8 | `src/enhance/strip.ts` | `return strip === undefined || !ctx.live() ? null : strip;` | `return strip ?? null;` |
| M9 | `src/enhance/since.ts`, `position` final height call | `ctx.journal.setStyle(menu, 'max-height', `${String(Math.max(0, Math.floor(view.h - popupTop - EDGE)))}px`);` | Omit call |
| M10 | `src/enhance/options.ts` | `firstItems(v, LIMITS.commits).map(commitEntry)` | `firstItems(v, LIMITS.commits + 1).map(commitEntry)` |
| M11 | `src/enhance/since.ts`, `show` continuation immediately before skipped-outcome check | `if (!ctx.live()) return;` | Omit guard |
| M12 | `src/enhance/since.ts`, `after` outer outcome guard only | `if (!ctx.live() || !('places' in outcome) || outcome.places === 0) return;` | `if (!('places' in outcome) || outcome.places === 0) return;` |
| M13 | `src/enhance/since.ts`, `after` outer outcome guard only | `if (!ctx.live() || !('places' in outcome) || outcome.places === 0) return;` | `if (!ctx.live() || !('places' in outcome)) return;` |

## Retained Limitations

The first duplicate-range probe survived because it selected a fixture with no applicable current quick ranges; the pinned empty-Today fixture later distinguishes d7/d30 duplication. The first M5read probe dereferenced a missing notice, and the first M10 probe read an invalid absent index-100 entry; later explicit absence and valid boundary-entry assertions replace those as assertion-red evidence, without deleting the earlier receipts. The first M9 probe survived the CSS fallback; the dynamic-height assertion distinguishes it. These qualifications do not rewrite old receipts or waive the remaining acceptance gates.
