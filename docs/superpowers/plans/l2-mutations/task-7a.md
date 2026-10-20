# L2 Task 7a: mutation rows (seams: window, registration, state, vocabulary)

Each guard of Task 7a, deleted or inverted once, with the tests that go red: the window behind `src/enhance/env.ts`,
`journal.setStyle` (LD11), the reading position and the UI memory in the reader state (LD8), section 0's units, the
per-instance chrome ids (RF2), the feature list and the second phase (LD5), the word lists of `src/enhance/vocab.ts`
and the status marks that read them, the text helpers, and the walls with their new sites. Measured 2026-10-20 on
branch `l2-t7a-seams`, on its final code: every row, L2-T7a-M1 to L2-T7a-M161, in one run of three batches.

**Method.** The L1 plan's `mutate.mjs` (Task 1, Step 8) with the two changes its results section records (a 512 MiB
output buffer, and a run that ends with no exit status reported as KILLED and counted as no verdict): each row is
applied to its own throwaway copy of the working tree (tracked and untracked files, never ignored ones, `node_modules`
linked from the checkout), its test file runs there with the local `vitest`, and the copy is deleted. Each `old`
occurs exactly once in its file. The rows ran with `DOCREADER_BROWSERS=chromium` (C45): the one browser row ran in
Chromium, and WebKit was reported as excluded. The checkout was never edited: `git status --porcelain` read the same
(empty) before and after, and so did the hash of `git diff`. All 161 rows went red (`rc=1`). The Red column gives the
count line and the failing tests the run printed (at most five here; the run prints at most 20 failing lines).

Notes on the measurement.
- A first pass over the rows, before the final tree, left a few rows green; each was made red by a case, never by
  dropping the row: a cancel called twice, the env's after-destroy paths (scheduling, listening, observing, a fonts
  wait with no font set), an element whose host left its style attribute empty, a UI read after startup before a
  write, the vocabulary's ruling-header words, a blocker's whole word and the clip's 60% cut. One code change came of
  it: the list of features an instance builds is recorded before the first build, so the second phase's placement is
  the one guard that keeps an `after` from starting on a startup that fails (a destroyed one is also refused by its
  operations), and a case pins the failing startup.
- `env.matches` keeps one check, its `try`: a window with no `matchMedia` throws there and answers false, so a second
  check for the function could not be reddened.
- L2-T7a-M63 is red only in a real browser: Chromium serializes the CSSOM into the `style` attribute lazily, so
  removing an attribute it has not yet written does not stick, and the next read brings it back empty. jsdom
  serializes at once, so no jsdom case can see it; `test/browser/seams.test.ts` does.
- The site rows put a use of a refused name into another module (`folds.ts`, `status.ts`, `text.ts`, `editorial.ts`, a
  stub) and show the walls catch each one; the pack row shows `test/pack.test.ts` would refuse the dashed module name
  `diagram-tools` without its widened pattern.

## The window: `src/enhance/env.ts` (L2-T7a-M1 to L2-T7a-M47)

Every callback inside an operation and only while live, every schedule and subscription cancelled by its own handle
and by teardown with the window's own cancel, nothing new once the instance is gone, the bounded delays and fallbacks,
the media queries, the viewport and scrolling, the bounded fonts wait that never settles after destroy, the observers,
the canvas, the clock and the two root-scoped lookups, and a document with no window.

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T7a-M1 | a callback runs inside an operation, and only while live | `src/enhance/env.ts` | `    if (live()) operate(fn);` → `    fn();` | `test/enhance-seams.test.ts`: 4 failed \| 84 passed (88). "timeout, frame and idle run their callback inside an operation of the instance"; "a callback already queued when the instance is destroyed does nothing"; "a scroll handler that destroys the instance runs to its end first, inside the operation"; "observeResize and observeIntersection: null without the API; otherwise callbacks inside operations, cancelled by destroy" |
| L2-T7a-M2 | teardown cancels every schedule and subscription still pending | `src/enhance/env.ts` | `    for (const cancel of [...pending]) cancel(); ⏎ ` → (deleted) | `test/enhance-seams.test.ts`: 4 failed \| 84 passed (88). "destroy cancels every pending timeout, frame and idle callback with the window's own cancel"; "idle waits through requestIdleCallback, with its bound, where the window has one"; "onScroll, onResize, onPrint and onPageHide listen on the window inside operations, and destroy removes them"; "observeResize and observeIntersection: null without the API; otherwise callbacks inside operations, cancelled by destroy" |
| L2-T7a-M3 | nothing is scheduled once the instance is not live | `src/enhance/env.ts` | `    if (!live()) return () => undefined; ⏎     let cancelled = false;` → `    let cancelled = false;` | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "a callback already queued when the instance is destroyed does nothing" |
| L2-T7a-M4 | a cancelled callback never runs, even if the window calls it | `src/enhance/env.ts` | `      if (cancelled) return; ⏎       cancelled = true;` → `      cancelled = true;` | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "each schedule returns its own cancel, which cancels that one alone" |
| L2-T7a-M5 | a callback that ran is forgotten, so teardown does not cancel it again | `src/enhance/env.ts` | `      if (tracked !== null) pending.delete(tracked); ⏎ ` → (deleted) | `test/enhance-seams.test.ts`: 2 failed \| 86 passed (88). "each schedule returns its own cancel, which cancels that one alone"; "idle waits through requestIdleCallback, with its bound, where the window has one" |
| L2-T7a-M6 | a cancel stops only once | `src/enhance/env.ts` | `      if (done) return; ⏎       done = true;` → `      done = true;` | `test/enhance-seams.test.ts`: 2 failed \| 86 passed (88). "each schedule returns its own cancel, which cancels that one alone"; "an observer cancelled by its own handle disconnects once, and destroy leaves it alone" |
| L2-T7a-M7 | timeout cancels with the window's clearTimeout | `src/enhance/env.ts` | `      const id = view.setTimeout(call, delay(ms)); ⏎       return () => { ⏎         view.clearTim…` → `      const id = view.setTimeout(call, delay(ms)); ⏎       return () => { ⏎         void id; ⏎   …` | `test/enhance-seams.test.ts`: 2 failed \| 86 passed (88). "destroy cancels every pending timeout, frame and idle callback with the window's own cancel"; "each schedule returns its own cancel, which cancels that one alone" |
| L2-T7a-M8 | a delay that is not a number is 0 | `src/enhance/env.ts` | `  if (Number.isNaN(ms) \|\| ms <= 0) return 0;` → `  if (ms <= 0) return 0;` | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "a timeout delay is clamped to a finite, non-negative number" |
| L2-T7a-M9 | a delay is at most 2^31 - 1 | `src/enhance/env.ts` | `  return Math.min(ms, MAX_DELAY);` → `  return ms;` | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "a timeout delay is clamped to a finite, non-negative number" |
| L2-T7a-M10 | frame: a 16 ms timeout where the window has no frames | `src/enhance/env.ts` | `        if (typeof view.requestAnimationFrame !== 'function') {` → `        if (false) {` | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "a timeout delay is clamped to a finite, non-negative number" |
| L2-T7a-M11 | frame cancels with the window's cancelAnimationFrame | `src/enhance/env.ts` | `          view.cancelAnimationFrame(id); ⏎ ` → (deleted) | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "destroy cancels every pending timeout, frame and idle callback with the window's own cancel" |
| L2-T7a-M12 | idle: requestIdleCallback with its bound | `src/enhance/env.ts` | `        const id = view.requestIdleCallback(call, { timeout: delay(maxMs) });` → `        const id = view.requestIdleCallback(call);` | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "idle waits through requestIdleCallback, with its bound, where the window has one" |
| L2-T7a-M13 | idle cancels with the window's cancelIdleCallback | `src/enhance/env.ts` | `          view.cancelIdleCallback(id); ⏎ ` → (deleted) | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "idle waits through requestIdleCallback, with its bound, where the window has one" |
| L2-T7a-M14 | idle without requestIdleCallback waits at most 200 ms | `src/enhance/env.ts` | `          const id = view.setTimeout(call, Math.min(200, delay(maxMs)));` → `          const id = view.setTimeout(call, delay(maxMs));` | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "a timeout delay is clamped to a finite, non-negative number" |
| L2-T7a-M15 | idle's default bound is 2000 ms | `src/enhance/env.ts` | `    idle: (fn, maxMs = 2000) =>` → `    idle: (fn, maxMs = 1000) =>` | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "idle waits through requestIdleCallback, with its bound, where the window has one" |
| L2-T7a-M16 | listening starts nothing once the instance is not live | `src/enhance/env.ts` | `    if (view === null \|\| !live()) return () => undefined; ⏎     const handler` → `    if (view === null) return () => undefined; ⏎     const handler` | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "a callback already queued when the instance is destroyed does nothing" |
| L2-T7a-M17 | a window event's handler runs inside an operation | `src/enhance/env.ts` | `    const handler = (): void => { ⏎       run(fn); ⏎     };` → `    const handler = (): void => { ⏎       fn(); ⏎     };` | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "a scroll handler that destroys the instance runs to its end first, inside the operation" |
| L2-T7a-M18 | a window listener is removed by its cancel and by teardown | `src/enhance/env.ts` | `      view.removeEventListener(type, handler); ⏎ ` → (deleted) | `test/enhance-seams.test.ts`: 2 failed \| 86 passed (88). "onScroll, onResize, onPrint and onPageHide listen on the window inside operations, and destroy removes them"; "a window listener cancelled by its own handle stops at once" |
| L2-T7a-M19 | onPrint: true when printing starts, false when it ends | `src/enhance/env.ts` | `      const start = listen('beforeprint', () => { ⏎         fn(true);` → `      const start = listen('beforeprint', () => { ⏎         fn(false);` | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "onScroll, onResize, onPrint and onPageHide listen on the window inside operations, and destroy removes them" |
| L2-T7a-M20 | a window without media queries answers false | `src/enhance/env.ts` | `    try { ⏎       return view.matchMedia(query).matches === true; ⏎     } catch { ⏎       return …` → `    return view.matchMedia(query).matches === true;` | `test/enhance-seams.test.ts`: 2 failed \| 86 passed (88). "matches and reducedMotion read the window's media queries; without matchMedia they are false"; "viewport reads the window's width, height and scroll position; scrollTo scrolls it, smoothly only when motion is allowed" |
| L2-T7a-M21 | reducedMotion asks for reduced motion | `src/enhance/env.ts` | `    reducedMotion: () => matches('(prefers-reduced-motion: reduce)'),` → `    reducedMotion: () => matches('(prefers-reduced-motion: no-preference)'),` | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "matches and reducedMotion read the window's media queries; without matchMedia they are false" |
| L2-T7a-M22 | viewport: width, height and scroll position, in that order | `src/enhance/env.ts` | `{ w: view.innerWidth, h: view.innerHeight, scrollY: view.scrollY }` → `{ w: view.innerHeight, h: view.innerWidth, scrollY: view.scrollY }` | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "viewport reads the window's width, height and scroll position; scrollTo scrolls it, smoothly only when motion is allowed" |
| L2-T7a-M23 | viewport is frozen | `src/enhance/env.ts` | `    viewport: () => Object.freeze(view === null ?` → `    viewport: () => (view === null ?` | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "viewport reads the window's width, height and scroll position; scrollTo scrolls it, smoothly only when motion is allowed" |
| L2-T7a-M24 | scrollTo ignores a top that is not finite | `src/enhance/env.ts` | `      if (view === null \|\| !Number.isFinite(top) \|\| !live()) return;` → `      if (view === null \|\| !live()) return;` | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "viewport reads the window's width, height and scroll position; scrollTo scrolls it, smoothly only when motion is allowed" |
| L2-T7a-M25 | scrollTo does nothing once the instance is not live | `src/enhance/env.ts` | `      if (view === null \|\| !Number.isFinite(top) \|\| !live()) return;` → `      if (view === null \|\| !Number.isFinite(top)) return;` | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "viewport reads the window's width, height and scroll position; scrollTo scrolls it, smoothly only when motion is allowed" |
| L2-T7a-M26 | scrollTo is smooth only when the reader allows motion | `src/enhance/env.ts` | `behavior: smooth && !matches('(prefers-reduced-motion: reduce)') ? 'smooth' : 'auto'` → `behavior: smooth ? 'smooth' : 'auto'` | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "viewport reads the window's width, height and scroll position; scrollTo scrolls it, smoothly only when motion is allowed" |
| L2-T7a-M27 | fonts: a wait asked for once not live never settles | `src/enhance/env.ts` | `        if (!live()) return; // never settles: nothing after the wait runs ⏎ ` → (deleted) | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "fonts: a wait that ends after destroy never settles, so nothing after it runs (RF5)" |
| L2-T7a-M28 | fonts: a wait that ends once not live never settles | `src/enhance/env.ts` | `          if (live()) resolve(loaded);` → `          resolve(loaded);` | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "fonts: a wait that ends after destroy never settles, so nothing after it runs (RF5)" |
| L2-T7a-M29 | fonts: the wait is bounded by maxMs | `src/enhance/env.ts` | `        const stop = timeout(() => { ⏎           finish(false); ⏎         }, maxMs);` → `        const stop = (): void => undefined;` | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "fonts: false at once without a font set; true once the faces load; false when the wait runs out" |
| L2-T7a-M30 | fonts: both of the reader's faces | `src/enhance/env.ts` | `const FACES = ['1em "Docreader Serif"', '1em "Docreader Sans"'] as const;` → `const FACES = ['1em "Docreader Serif"'] as const;` | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "fonts: false at once without a font set; true once the faces load; false when the wait runs out" |
| L2-T7a-M31 | fonts: a failed load answers false | `src/enhance/env.ts` | `          () => { ⏎             finish(false); ⏎           }, ⏎         );` → `          () => { ⏎             finish(true); ⏎           }, ⏎         );` | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "fonts: false at once without a font set; true once the faces load; false when the wait runs out" |
| L2-T7a-M32 | fonts: false at once without a font set | `src/enhance/env.ts` | `        if (set === null) { ⏎           resolve(false); ⏎           return; ⏎         }` → `        if (set === null) { ⏎           resolve(true); ⏎           return; ⏎         }` | `test/enhance-seams.test.ts`: 2 failed \| 86 passed (88). "fonts: false at once without a font set; true once the faces load; false when the wait runs out"; "a root in a document with no window: nothing is scheduled or heard, and nothing throws" |
| L2-T7a-M33 | observeResize: null without ResizeObserver | `src/enhance/env.ts` | `        if (view === null \|\| typeof view.ResizeObserver !== 'function') return null;` → `        if (view === null) return null;` | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "observeResize and observeIntersection: null without the API; otherwise callbacks inside operations, cancelled by destroy" |
| L2-T7a-M34 | observeIntersection: null without IntersectionObserver | `src/enhance/env.ts` | `        if (view === null \|\| typeof view.IntersectionObserver !== 'function') return null;` → `        if (view === null) return null;` | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "observeResize and observeIntersection: null without the API; otherwise callbacks inside operations, cancelled by destroy" |
| L2-T7a-M35 | no observer is made once the instance is not live | `src/enhance/env.ts` | `    if (!live()) return null; ⏎     const o = make();` → `    const o = make();` | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "observeResize and observeIntersection: null without the API; otherwise callbacks inside operations, cancelled by destroy" |
| L2-T7a-M36 | a disconnected observer is not started again once not live | `src/enhance/env.ts` | `        if (live()) o.observe(el);` → `        o.observe(el);` | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "observeResize and observeIntersection: null without the API; otherwise callbacks inside operations, cancelled by destroy" |
| L2-T7a-M37 | an observer is disconnected by its cancel and by teardown | `src/enhance/env.ts` | `      o.disconnect(); ⏎ ` → (deleted) | `test/enhance-seams.test.ts`: 2 failed \| 86 passed (88). "observeResize and observeIntersection: null without the API; otherwise callbacks inside operations, cancelled by destroy"; "an observer cancelled by its own handle disconnects once, and destroy leaves it alone" |
| L2-T7a-M38 | a resize report runs inside an operation | `src/enhance/env.ts` | `        return new view.ResizeObserver((entries) => { ⏎           run(() => {` → `        return new view.ResizeObserver((entries) => { ⏎           ((f: () => void) => f())(() => {` | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "observeResize and observeIntersection: null without the API; otherwise callbacks inside operations, cancelled by destroy" |
| L2-T7a-M39 | an intersection report runs inside an operation | `src/enhance/env.ts` | `        return new view.IntersectionObserver((entries) => { ⏎           run(() => {` → `        return new view.IntersectionObserver((entries) => { ⏎           ((f: () => void) => f())(…` | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "observeResize and observeIntersection: null without the API; otherwise callbacks inside operations, cancelled by destroy" |
| L2-T7a-M40 | an intersection report carries the ratio | `src/enhance/env.ts` | `ratio: e.intersectionRatio` → `ratio: 0` | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "observeResize and observeIntersection: null without the API; otherwise callbacks inside operations, cancelled by destroy" |
| L2-T7a-M41 | IntersectionObserver gets the feature's options | `src/enhance/env.ts` | `        if (init?.rootMargin !== undefined) options.rootMargin = init.rootMargin; ⏎ ` → (deleted) | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "observeResize and observeIntersection: null without the API; otherwise callbacks inside operations, cancelled by destroy" |
| L2-T7a-M42 | textWidth is null without a canvas context | `src/enhance/env.ts` | `      if (canvas === null) return null; ⏎ ` → (deleted) | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "textWidth is null without a canvas context, and measures with one" |
| L2-T7a-M43 | now is the clock | `src/enhance/env.ts` | `    now: () => Date.now(),` → `    now: () => 0,` | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "now is the clock, and elementFromPoint answers only inside the root" |
| L2-T7a-M44 | elementFromPoint answers only inside the root | `src/enhance/env.ts` | `      return hit !== null && root.contains(hit) ? hit : null;` → `      return hit;` | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "now is the clock, and elementFromPoint answers only inside the root" |
| L2-T7a-M45 | elementFromPoint is null where the document has none | `src/enhance/env.ts` | `      if (typeof at !== 'function') return null; ⏎ ` → (deleted) | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "now is the clock, and elementFromPoint answers only inside the root" |
| L2-T7a-M46 | computed answers only inside the root | `src/enhance/env.ts` | ` \|\| !root.contains(el)) return '';` → `) return '';` | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "computed reads a computed value of an element inside the root" |
| L2-T7a-M47 | a document with no window schedules nothing | `src/enhance/env.ts` | `    once(fn, (call) => { ⏎       if (view === null) return null; ⏎       const id = view.setTimeo…` → `    once(fn, (call) => { ⏎       const id = (view as Window).setTimeout(call, delay(ms));` | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "a root in a document with no window: nothing is scheduled or heard, and nothing throws" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T7a-M1",
    "guard": "a callback runs inside an operation, and only while live",
    "file": "src/enhance/env.ts",
    "old": "    if (live()) operate(fn);",
    "new": "    fn();",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M2",
    "guard": "teardown cancels every schedule and subscription still pending",
    "file": "src/enhance/env.ts",
    "old": "    for (const cancel of [...pending]) cancel();\n",
    "new": "",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M3",
    "guard": "nothing is scheduled once the instance is not live",
    "file": "src/enhance/env.ts",
    "old": "    if (!live()) return () => undefined;\n    let cancelled = false;",
    "new": "    let cancelled = false;",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M4",
    "guard": "a cancelled callback never runs, even if the window calls it",
    "file": "src/enhance/env.ts",
    "old": "      if (cancelled) return;\n      cancelled = true;",
    "new": "      cancelled = true;",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M5",
    "guard": "a callback that ran is forgotten, so teardown does not cancel it again",
    "file": "src/enhance/env.ts",
    "old": "      if (tracked !== null) pending.delete(tracked);\n",
    "new": "",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M6",
    "guard": "a cancel stops only once",
    "file": "src/enhance/env.ts",
    "old": "      if (done) return;\n      done = true;",
    "new": "      done = true;",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M7",
    "guard": "timeout cancels with the window's clearTimeout",
    "file": "src/enhance/env.ts",
    "old": "      const id = view.setTimeout(call, delay(ms));\n      return () => {\n        view.clearTimeout(id);\n      };",
    "new": "      const id = view.setTimeout(call, delay(ms));\n      return () => {\n        void id;\n      };",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M8",
    "guard": "a delay that is not a number is 0",
    "file": "src/enhance/env.ts",
    "old": "  if (Number.isNaN(ms) || ms <= 0) return 0;",
    "new": "  if (ms <= 0) return 0;",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M9",
    "guard": "a delay is at most 2^31 - 1",
    "file": "src/enhance/env.ts",
    "old": "  return Math.min(ms, MAX_DELAY);",
    "new": "  return ms;",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M10",
    "guard": "frame: a 16 ms timeout where the window has no frames",
    "file": "src/enhance/env.ts",
    "old": "        if (typeof view.requestAnimationFrame !== 'function') {",
    "new": "        if (false) {",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M11",
    "guard": "frame cancels with the window's cancelAnimationFrame",
    "file": "src/enhance/env.ts",
    "old": "          view.cancelAnimationFrame(id);\n",
    "new": "",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M12",
    "guard": "idle: requestIdleCallback with its bound",
    "file": "src/enhance/env.ts",
    "old": "        const id = view.requestIdleCallback(call, { timeout: delay(maxMs) });",
    "new": "        const id = view.requestIdleCallback(call);",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M13",
    "guard": "idle cancels with the window's cancelIdleCallback",
    "file": "src/enhance/env.ts",
    "old": "          view.cancelIdleCallback(id);\n",
    "new": "",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M14",
    "guard": "idle without requestIdleCallback waits at most 200 ms",
    "file": "src/enhance/env.ts",
    "old": "          const id = view.setTimeout(call, Math.min(200, delay(maxMs)));",
    "new": "          const id = view.setTimeout(call, delay(maxMs));",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M15",
    "guard": "idle's default bound is 2000 ms",
    "file": "src/enhance/env.ts",
    "old": "    idle: (fn, maxMs = 2000) =>",
    "new": "    idle: (fn, maxMs = 1000) =>",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M16",
    "guard": "listening starts nothing once the instance is not live",
    "file": "src/enhance/env.ts",
    "old": "    if (view === null || !live()) return () => undefined;\n    const handler",
    "new": "    if (view === null) return () => undefined;\n    const handler",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M17",
    "guard": "a window event's handler runs inside an operation",
    "file": "src/enhance/env.ts",
    "old": "    const handler = (): void => {\n      run(fn);\n    };",
    "new": "    const handler = (): void => {\n      fn();\n    };",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M18",
    "guard": "a window listener is removed by its cancel and by teardown",
    "file": "src/enhance/env.ts",
    "old": "      view.removeEventListener(type, handler);\n",
    "new": "",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M19",
    "guard": "onPrint: true when printing starts, false when it ends",
    "file": "src/enhance/env.ts",
    "old": "      const start = listen('beforeprint', () => {\n        fn(true);",
    "new": "      const start = listen('beforeprint', () => {\n        fn(false);",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M20",
    "guard": "a window without media queries answers false",
    "file": "src/enhance/env.ts",
    "old": "    try {\n      return view.matchMedia(query).matches === true;\n    } catch {\n      return false;\n    }",
    "new": "    return view.matchMedia(query).matches === true;",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M21",
    "guard": "reducedMotion asks for reduced motion",
    "file": "src/enhance/env.ts",
    "old": "    reducedMotion: () => matches('(prefers-reduced-motion: reduce)'),",
    "new": "    reducedMotion: () => matches('(prefers-reduced-motion: no-preference)'),",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M22",
    "guard": "viewport: width, height and scroll position, in that order",
    "file": "src/enhance/env.ts",
    "old": "{ w: view.innerWidth, h: view.innerHeight, scrollY: view.scrollY }",
    "new": "{ w: view.innerHeight, h: view.innerWidth, scrollY: view.scrollY }",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M23",
    "guard": "viewport is frozen",
    "file": "src/enhance/env.ts",
    "old": "    viewport: () => Object.freeze(view === null ?",
    "new": "    viewport: () => (view === null ?",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M24",
    "guard": "scrollTo ignores a top that is not finite",
    "file": "src/enhance/env.ts",
    "old": "      if (view === null || !Number.isFinite(top) || !live()) return;",
    "new": "      if (view === null || !live()) return;",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M25",
    "guard": "scrollTo does nothing once the instance is not live",
    "file": "src/enhance/env.ts",
    "old": "      if (view === null || !Number.isFinite(top) || !live()) return;",
    "new": "      if (view === null || !Number.isFinite(top)) return;",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M26",
    "guard": "scrollTo is smooth only when the reader allows motion",
    "file": "src/enhance/env.ts",
    "old": "behavior: smooth && !matches('(prefers-reduced-motion: reduce)') ? 'smooth' : 'auto'",
    "new": "behavior: smooth ? 'smooth' : 'auto'",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M27",
    "guard": "fonts: a wait asked for once not live never settles",
    "file": "src/enhance/env.ts",
    "old": "        if (!live()) return; // never settles: nothing after the wait runs\n",
    "new": "",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M28",
    "guard": "fonts: a wait that ends once not live never settles",
    "file": "src/enhance/env.ts",
    "old": "          if (live()) resolve(loaded);",
    "new": "          resolve(loaded);",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M29",
    "guard": "fonts: the wait is bounded by maxMs",
    "file": "src/enhance/env.ts",
    "old": "        const stop = timeout(() => {\n          finish(false);\n        }, maxMs);",
    "new": "        const stop = (): void => undefined;",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M30",
    "guard": "fonts: both of the reader's faces",
    "file": "src/enhance/env.ts",
    "old": "const FACES = ['1em \"Docreader Serif\"', '1em \"Docreader Sans\"'] as const;",
    "new": "const FACES = ['1em \"Docreader Serif\"'] as const;",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M31",
    "guard": "fonts: a failed load answers false",
    "file": "src/enhance/env.ts",
    "old": "          () => {\n            finish(false);\n          },\n        );",
    "new": "          () => {\n            finish(true);\n          },\n        );",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M32",
    "guard": "fonts: false at once without a font set",
    "file": "src/enhance/env.ts",
    "old": "        if (set === null) {\n          resolve(false);\n          return;\n        }",
    "new": "        if (set === null) {\n          resolve(true);\n          return;\n        }",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M33",
    "guard": "observeResize: null without ResizeObserver",
    "file": "src/enhance/env.ts",
    "old": "        if (view === null || typeof view.ResizeObserver !== 'function') return null;",
    "new": "        if (view === null) return null;",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M34",
    "guard": "observeIntersection: null without IntersectionObserver",
    "file": "src/enhance/env.ts",
    "old": "        if (view === null || typeof view.IntersectionObserver !== 'function') return null;",
    "new": "        if (view === null) return null;",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M35",
    "guard": "no observer is made once the instance is not live",
    "file": "src/enhance/env.ts",
    "old": "    if (!live()) return null;\n    const o = make();",
    "new": "    const o = make();",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M36",
    "guard": "a disconnected observer is not started again once not live",
    "file": "src/enhance/env.ts",
    "old": "        if (live()) o.observe(el);",
    "new": "        o.observe(el);",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M37",
    "guard": "an observer is disconnected by its cancel and by teardown",
    "file": "src/enhance/env.ts",
    "old": "      o.disconnect();\n",
    "new": "",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M38",
    "guard": "a resize report runs inside an operation",
    "file": "src/enhance/env.ts",
    "old": "        return new view.ResizeObserver((entries) => {\n          run(() => {",
    "new": "        return new view.ResizeObserver((entries) => {\n          ((f: () => void) => f())(() => {",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M39",
    "guard": "an intersection report runs inside an operation",
    "file": "src/enhance/env.ts",
    "old": "        return new view.IntersectionObserver((entries) => {\n          run(() => {",
    "new": "        return new view.IntersectionObserver((entries) => {\n          ((f: () => void) => f())(() => {",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M40",
    "guard": "an intersection report carries the ratio",
    "file": "src/enhance/env.ts",
    "old": "ratio: e.intersectionRatio",
    "new": "ratio: 0",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M41",
    "guard": "IntersectionObserver gets the feature's options",
    "file": "src/enhance/env.ts",
    "old": "        if (init?.rootMargin !== undefined) options.rootMargin = init.rootMargin;\n",
    "new": "",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M42",
    "guard": "textWidth is null without a canvas context",
    "file": "src/enhance/env.ts",
    "old": "      if (canvas === null) return null;\n",
    "new": "",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M43",
    "guard": "now is the clock",
    "file": "src/enhance/env.ts",
    "old": "    now: () => Date.now(),",
    "new": "    now: () => 0,",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M44",
    "guard": "elementFromPoint answers only inside the root",
    "file": "src/enhance/env.ts",
    "old": "      return hit !== null && root.contains(hit) ? hit : null;",
    "new": "      return hit;",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M45",
    "guard": "elementFromPoint is null where the document has none",
    "file": "src/enhance/env.ts",
    "old": "      if (typeof at !== 'function') return null;\n",
    "new": "",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M46",
    "guard": "computed answers only inside the root",
    "file": "src/enhance/env.ts",
    "old": " || !root.contains(el)) return '';",
    "new": ") return '';",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M47",
    "guard": "a document with no window schedules nothing",
    "file": "src/enhance/env.ts",
    "old": "    once(fn, (call) => {\n      if (view === null) return null;\n      const id = view.setTimeout(call, delay(ms));",
    "new": "    once(fn, (call) => {\n      const id = (view as Window).setTimeout(call, delay(ms));",
    "tests": "test/enhance-seams.test.ts"
  }
]
```

## Styles: `journal.setStyle` (LD11) (L2-T7a-M48 to L2-T7a-M63)

The closed list, `important` for its three names only, the refused values, the conditional restore of value and
priority, and the style attribute the CSSOM leaves: removed only when the element had none, and read first so a
browser that serializes it lazily cannot bring it back (the last row is measured in Chromium, the one browser that
shows it).

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T7a-M48 | setStyle refuses a property off the list | `src/enhance/journal.ts` | `      if (!plain && !loud) throw new Error` → `      if (false) throw new Error` | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "refuses a name off the list" |
| L2-T7a-M49 | setStyle takes important only for fill, stroke and stroke-width, and those only with it | `src/enhance/journal.ts` | `      if (loud !== important) throw new Error` → `      if (false) throw new Error` | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "takes important only for fill, stroke and stroke-width, and those only with it" |
| L2-T7a-M50 | the closed list (a name added) | `src/enhance/journal.ts` | `  '--thead-h', '--fig-w', '--bar-h', 'left',` → `  '--thead-h', '--fig-w', '--bar-h', 'color', 'left',` | `test/enhance-seams.test.ts`: 3 failed \| 85 passed (88). "the closed list is the plan's, and fill, stroke and stroke-width go only with important"; "every listed name is written, and undo restores the element byte for byte (no style attribute left)"; "refuses a name off the list" |
| L2-T7a-M51 | the important list (a name added) | `src/enhance/journal.ts` | `export const IMPORTANT_STYLE_PROPS = ['fill', 'stroke', 'stroke-width'] as const;` → `export const IMPORTANT_STYLE_PROPS = ['fill', 'stroke', 'stroke-width', 'opacity'] as const;` | `test/enhance-seams.test.ts`: 4 failed \| 84 passed (88). "the closed list is the plan's, and fill, stroke and stroke-width go only with important"; "every listed name is written, and undo restores the element byte for byte (no style attribute left)"; "a host's own declarations survive, and the attribute stays when the host had one"; "takes important only for fill, stroke and stroke-width, and those only with it" |
| L2-T7a-M52 | a value over 200 code units is refused | `src/enhance/journal.ts` | `value.length > STYLE_VALUE_MAX \|\| ` → (deleted) | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "refuses a value that could load a resource, escape or end the declaration, or is over 200 code units" |
| L2-T7a-M53 | a value with url() is refused | `src/enhance/journal.ts` | `(?:url\|src\|image\|` → `(?:src\|image\|` | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "refuses a value that could load a resource, escape or end the declaration, or is over 200 code units" |
| L2-T7a-M54 | a value with a backslash is refused | `src/enhance/journal.ts` | `/[\\;{}]\|` → `/[;{}]\|` | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "refuses a value that could load a resource, escape or end the declaration, or is over 200 code units" |
| L2-T7a-M55 | a value that could end the declaration is refused | `src/enhance/journal.ts` | `/[\\;{}]\|` → `/[\\]\|` | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "refuses a value that could load a resource, escape or end the declaration, or is over 200 code units" |
| L2-T7a-M56 | setStyle writes nothing once not live | `src/enhance/journal.ts` | `      if (!live()) return; ⏎       const style = el.style;` → `      const style = el.style;` | `test/enhance-seams.test.ts`: 2 failed \| 86 passed (88). "writes nothing once the instance is not live"; "a write after an await, once destroyed, is refused (RF5)" |
| L2-T7a-M57 | undo restores only while the value and priority are still the library's | `src/enhance/journal.ts` | `if (style.getPropertyValue(name) !== r.last.value \|\| style.getPropertyPriority(name) !== r.last.p…` → (deleted) | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "restores conditionally: a value or a priority the host changed since stays the host's" |
| L2-T7a-M58 | undo restores the original priority too | `src/enhance/journal.ts` | `          else style.setProperty(name, r.value, r.priority);` → `          else style.setProperty(name, r.value);` | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "a host's own declarations survive, and the attribute stays when the host had one" |
| L2-T7a-M59 | the last written value is what the browser holds after the write | `src/enhance/journal.ts` | `      rec.last = { value: style.getPropertyValue(name), priority: style.getPropertyPriority(name) };` → `      void rec;` | `test/enhance-seams.test.ts`: 6 failed \| 82 passed (88). "every listed name is written, and undo restores the element byte for byte (no style attribute left)"; "a value written twice is restored to the original, once"; "a host's own declarations survive, and the attribute stays when the host had one"; "an element whose style attribute the host left empty keeps it, empty"; "an element the host gave an inline style after the library's first write keeps it, attribute and all"; and 1 more |
| L2-T7a-M60 | important is written with its priority | `src/enhance/journal.ts` | `      else style.setProperty(name, value, important ? 'important' : '');` → `      else style.setProperty(name, value);` | `test/enhance-seams.test.ts`: 2 failed \| 86 passed (88). "every listed name is written, and undo restores the element byte for byte (no style attribute left)"; "restores conditionally: a value or a priority the host changed since stays the host's" |
| L2-T7a-M61 | undo removes the empty style attribute the CSSOM leaves | `src/enhance/journal.ts` | `            if (style.length === 0 && el.getAttribute('style') !== null) el.removeAttribute('styl…` → (deleted) | `test/enhance-seams.test.ts`: 3 failed \| 85 passed (88). "every listed name is written, and undo restores the element byte for byte (no style attribute left)"; "a value written twice is restored to the original, once"; "through enhance: a style written by a feature is undone by destroy" |
| L2-T7a-M62 | an attribute the element had stays, even empty | `src/enhance/journal.ts` | `        if (!el.hasAttribute('style')) { ⏎           undo.push(` → `        if (true) { ⏎           undo.push(` | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "an element whose style attribute the host left empty keeps it, empty" |
| L2-T7a-M63 | the attribute is read before it is removed, so a lazy serialization cannot bring it back (a real browser) | `src/enhance/journal.ts` | `style.length === 0 && el.getAttribute('style') !== null` → `style.length === 0` | `test/browser/seams.test.ts`: 1 failed \| 1 passed \| 2 skipped (4). "setStyle applies under the strict policy, important included, where a style attribute is refused; undo leaves no attribute" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T7a-M48",
    "guard": "setStyle refuses a property off the list",
    "file": "src/enhance/journal.ts",
    "old": "      if (!plain && !loud) throw new Error",
    "new": "      if (false) throw new Error",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M49",
    "guard": "setStyle takes important only for fill, stroke and stroke-width, and those only with it",
    "file": "src/enhance/journal.ts",
    "old": "      if (loud !== important) throw new Error",
    "new": "      if (false) throw new Error",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M50",
    "guard": "the closed list (a name added)",
    "file": "src/enhance/journal.ts",
    "old": "  '--thead-h', '--fig-w', '--bar-h', 'left',",
    "new": "  '--thead-h', '--fig-w', '--bar-h', 'color', 'left',",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M51",
    "guard": "the important list (a name added)",
    "file": "src/enhance/journal.ts",
    "old": "export const IMPORTANT_STYLE_PROPS = ['fill', 'stroke', 'stroke-width'] as const;",
    "new": "export const IMPORTANT_STYLE_PROPS = ['fill', 'stroke', 'stroke-width', 'opacity'] as const;",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M52",
    "guard": "a value over 200 code units is refused",
    "file": "src/enhance/journal.ts",
    "old": "value.length > STYLE_VALUE_MAX || ",
    "new": "",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M53",
    "guard": "a value with url() is refused",
    "file": "src/enhance/journal.ts",
    "old": "(?:url|src|image|",
    "new": "(?:src|image|",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M54",
    "guard": "a value with a backslash is refused",
    "file": "src/enhance/journal.ts",
    "old": "/[\\\\;{}]|",
    "new": "/[;{}]|",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M55",
    "guard": "a value that could end the declaration is refused",
    "file": "src/enhance/journal.ts",
    "old": "/[\\\\;{}]|",
    "new": "/[\\\\]|",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M56",
    "guard": "setStyle writes nothing once not live",
    "file": "src/enhance/journal.ts",
    "old": "      if (!live()) return;\n      const style = el.style;",
    "new": "      const style = el.style;",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M57",
    "guard": "undo restores only while the value and priority are still the library's",
    "file": "src/enhance/journal.ts",
    "old": "if (style.getPropertyValue(name) !== r.last.value || style.getPropertyPriority(name) !== r.last.priority) return; // the host changed it since\n",
    "new": "",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M58",
    "guard": "undo restores the original priority too",
    "file": "src/enhance/journal.ts",
    "old": "          else style.setProperty(name, r.value, r.priority);",
    "new": "          else style.setProperty(name, r.value);",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M59",
    "guard": "the last written value is what the browser holds after the write",
    "file": "src/enhance/journal.ts",
    "old": "      rec.last = { value: style.getPropertyValue(name), priority: style.getPropertyPriority(name) };",
    "new": "      void rec;",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M60",
    "guard": "important is written with its priority",
    "file": "src/enhance/journal.ts",
    "old": "      else style.setProperty(name, value, important ? 'important' : '');",
    "new": "      else style.setProperty(name, value);",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M61",
    "guard": "undo removes the empty style attribute the CSSOM leaves",
    "file": "src/enhance/journal.ts",
    "old": "            if (style.length === 0 && el.getAttribute('style') !== null) el.removeAttribute('style');\n",
    "new": "",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M62",
    "guard": "an attribute the element had stays, even empty",
    "file": "src/enhance/journal.ts",
    "old": "        if (!el.hasAttribute('style')) {\n          undo.push(",
    "new": "        if (true) {\n          undo.push(",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M63",
    "guard": "the attribute is read before it is removed, so a lazy serialization cannot bring it back (a real browser)",
    "file": "src/enhance/journal.ts",
    "old": "style.length === 0 && el.getAttribute('style') !== null",
    "new": "style.length === 0",
    "tests": "test/browser/seams.test.ts"
  }
]
```

## Reader state: the position and the UI memory (LD8) (L2-T7a-M64 to L2-T7a-M78)

The two keys, the local values read back, the write-behind and its deletes, own fields only, nothing read after
startup and no UI write over fields never read, and the shared-object merge the prefs and the UI memory now use.

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T7a-M64 | the position key | `src/enhance/state.ts` | ``   return `docreader:pos:${posKey}`; `` → ``   return `docreader:position:${posKey}`; `` | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "the keys: docreader:pos:<posKey> and docreader:ui, beside the prototype's two" |
| L2-T7a-M65 | the UI key | `src/enhance/state.ts` | `export const UI_KEY = 'docreader:ui';` → `export const UI_KEY = 'docreader:ui-memory';` | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "the keys: docreader:pos:<posKey> and docreader:ui, beside the prototype's two" |
| L2-T7a-M66 | a position written since startup reads back locally | `src/enhance/state.ts` | `      if (posLocal.has(posKey)) return posLocal.get(posKey); ⏎ ` → (deleted) | `test/enhance-seams.test.ts`: 2 failed \| 86 passed (88). "writePos writes behind, as JSON, under the position key; null deletes it; the local value reads back"; "without storage the position and the UI memory are local only" |
| L2-T7a-M67 | a position is written behind | `src/enhance/state.ts` | `      writeBehind(posKeyOf(posKey), value === null ? null : JSON.stringify(value));` → `      void value;` | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "writePos writes behind, as JSON, under the position key; null deletes it; the local value reads back" |
| L2-T7a-M68 | a null position deletes it | `src/enhance/state.ts` | `      writeBehind(posKeyOf(posKey), value === null ? null : JSON.stringify(value));` → `      writeBehind(posKeyOf(posKey), JSON.stringify(value));` | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "writePos writes behind, as JSON, under the position key; null deletes it; the local value reads back" |
| L2-T7a-M69 | a UI field is an own field of the stored object | `src/enhance/state.ts` | `      return Object.hasOwn(held, name) ? held[name] : undefined;` → `      return held[name];` | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "a field named like a prototype key reads as absent and round-trips as an own field" |
| L2-T7a-M70 | a UI read after startup, with the key never read, does not read it | `src/enhance/state.ts` | `      if (!ui.loaded && sealed) return undefined; ⏎ ` → (deleted) | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "a UI write after startup, with the key never read, stays local: the stored fields it cannot see are never overwritten" |
| L2-T7a-M71 | a UI write after startup, with the key never read, stays local | `src/enhance/state.ts` | `      if (!ui.loaded && sealed) { ⏎         uiLocal.set(name, value === null ? undefined : value)…` → (deleted) | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "a UI write after startup, with the key never read, stays local: the stored fields it cannot see are never overwritten" |
| L2-T7a-M72 | a UI field written locally reads back | `src/enhance/state.ts` | `      if (uiLocal.has(name)) return uiLocal.get(name); ⏎ ` → (deleted) | `test/enhance-seams.test.ts`: 2 failed \| 86 passed (88). "without storage the position and the UI memory are local only"; "a UI write after startup, with the key never read, stays local: the stored fields it cannot see are never overwritten" |
| L2-T7a-M73 | seal marks the snapshot closed | `src/enhance/state.ts` | `      sealed = true; ⏎ ` → (deleted) | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "a UI write after startup, with the key never read, stays local: the stored fields it cannot see are never overwritten" |
| L2-T7a-M74 | a write keeps the stored fields it does not know | `src/enhance/state.ts` | `        let next: Record<string, unknown> = { ...base };` → `        let next: Record<string, unknown> = {};` | `test/enhance-seams.test.ts`: 3 failed \| 85 passed (88). "writeUi merges one field into the stored object, keeping the fields it does not know; null deletes a field"; "a field named like a prototype key reads as absent and round-trips as an own field"; "two roots on one storage object: a UI field one wrote is never dropped by the other's write" |
| L2-T7a-M75 | a field set to undefined (a UI null) is deleted | `src/enhance/state.ts` | `          if (v === undefined) delete next[k];` → `          if (v === undefined) next = { ...next, [k]: null };` | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "writeUi merges one field into the stored object, keeping the fields it does not know; null deletes a field" |
| L2-T7a-M76 | a shared object merges the newest value another root queued | `src/enhance/state.ts` | `          if (isPlainRecord(r)) base = { ...base, ...r };` → `          void r;` | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "two roots on one storage object: a UI field one wrote is never dropped by the other's write" |
| L2-T7a-M77 | an unchanged object is not written again | `src/enhance/state.ts` | `        if (after !== before) writeBehind(key, after);` → `        writeBehind(key, after);` | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "writeUi merges one field into the stored object, keeping the fields it does not know; null deletes a field" |
| L2-T7a-M78 | a stored UI value that is not an object reads as empty | `src/enhance/state.ts` | `          held = isPlainRecord(r) ? { ...r } : {};` → `          held = (r ?? {}) as Record<string, unknown>;` | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "a stored UI value that is not an object is ignored, and the first write replaces it" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T7a-M64",
    "guard": "the position key",
    "file": "src/enhance/state.ts",
    "old": "  return `docreader:pos:${posKey}`;",
    "new": "  return `docreader:position:${posKey}`;",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M65",
    "guard": "the UI key",
    "file": "src/enhance/state.ts",
    "old": "export const UI_KEY = 'docreader:ui';",
    "new": "export const UI_KEY = 'docreader:ui-memory';",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M66",
    "guard": "a position written since startup reads back locally",
    "file": "src/enhance/state.ts",
    "old": "      if (posLocal.has(posKey)) return posLocal.get(posKey);\n",
    "new": "",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M67",
    "guard": "a position is written behind",
    "file": "src/enhance/state.ts",
    "old": "      writeBehind(posKeyOf(posKey), value === null ? null : JSON.stringify(value));",
    "new": "      void value;",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M68",
    "guard": "a null position deletes it",
    "file": "src/enhance/state.ts",
    "old": "      writeBehind(posKeyOf(posKey), value === null ? null : JSON.stringify(value));",
    "new": "      writeBehind(posKeyOf(posKey), JSON.stringify(value));",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M69",
    "guard": "a UI field is an own field of the stored object",
    "file": "src/enhance/state.ts",
    "old": "      return Object.hasOwn(held, name) ? held[name] : undefined;",
    "new": "      return held[name];",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M70",
    "guard": "a UI read after startup, with the key never read, does not read it",
    "file": "src/enhance/state.ts",
    "old": "      if (!ui.loaded && sealed) return undefined;\n",
    "new": "",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M71",
    "guard": "a UI write after startup, with the key never read, stays local",
    "file": "src/enhance/state.ts",
    "old": "      if (!ui.loaded && sealed) {\n        uiLocal.set(name, value === null ? undefined : value);\n        return;\n      }\n",
    "new": "",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M72",
    "guard": "a UI field written locally reads back",
    "file": "src/enhance/state.ts",
    "old": "      if (uiLocal.has(name)) return uiLocal.get(name);\n",
    "new": "",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M73",
    "guard": "seal marks the snapshot closed",
    "file": "src/enhance/state.ts",
    "old": "      sealed = true;\n",
    "new": "",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M74",
    "guard": "a write keeps the stored fields it does not know",
    "file": "src/enhance/state.ts",
    "old": "        let next: Record<string, unknown> = { ...base };",
    "new": "        let next: Record<string, unknown> = {};",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M75",
    "guard": "a field set to undefined (a UI null) is deleted",
    "file": "src/enhance/state.ts",
    "old": "          if (v === undefined) delete next[k];",
    "new": "          if (v === undefined) next = { ...next, [k]: null };",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M76",
    "guard": "a shared object merges the newest value another root queued",
    "file": "src/enhance/state.ts",
    "old": "          if (isPlainRecord(r)) base = { ...base, ...r };",
    "new": "          void r;",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M77",
    "guard": "an unchanged object is not written again",
    "file": "src/enhance/state.ts",
    "old": "        if (after !== before) writeBehind(key, after);",
    "new": "        writeBehind(key, after);",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M78",
    "guard": "a stored UI value that is not an object reads as empty",
    "file": "src/enhance/state.ts",
    "old": "          held = isPlainRecord(r) ? { ...r } : {};",
    "new": "          held = (r ?? {}) as Record<string, unknown>;",
    "tests": "test/enhance-seams.test.ts"
  }
]
```

## The lifecycle, the feature list and folds (L2-T7a-M79 to L2-T7a-M101)

Section 0's units and fingerprints measured before any feature builds, per-instance chrome ids (RF2), the build
through the list and its stop, the second phase (LD5), the build order, and the folds feature reading its own option
and printing through env.

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T7a-M79 | the sections are measured before any feature builds | `src/enhance/lifecycle.ts` | `    sections, ⏎     vocab: createVocab(options),` → `    get sections() { ⏎       return measureSections(root); ⏎     }, ⏎     vocab: createVocab(opti…` | `test/enhance-seams.test.ts`: 4 failed \| 84 passed (88). "one unit per level-2 heading with an id among the root's children, its blocks up to the next h1 or h2"; "a fingerprint ignores chrome text: it is the source's, though the fold controls now sit in every heading"; "a heading with no id ends the unit before it and starts none; script and dl count neither in the fingerprint nor the minutes"; "minutes are the section's reading time, measured on the source before the chrome" |
| L2-T7a-M80 | a section heading has an id | `src/enhance/lifecycle.ts` | `      heading = c.localName === 'h2' && c.id !== '' ? (c as HTMLElement) : null;` → `      heading = c.localName === 'h2' ? (c as HTMLElement) : null;` | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "a heading with no id ends the unit before it and starts none; script and dl count neither in the fingerprint nor the minutes" |
| L2-T7a-M81 | an h1 ends a section | `src/enhance/lifecycle.ts` | `    if (c.localName === 'h1' \|\| c.localName === 'h2') {` → `    if (c.localName === 'h2') {` | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "one unit per level-2 heading with an id among the root's children, its blocks up to the next h1 or h2" |
| L2-T7a-M82 | script and dl blocks are left out of the fingerprint | `src/enhance/lifecycle.ts` | `    for (const m of members) if (m.localName !== 'script' && m.localName !== 'dl') text += ` → `    for (const m of members) if (true) text += ` | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "a heading with no id ends the unit before it and starts none; script and dl count neither in the fingerprint nor the minutes" |
| L2-T7a-M83 | the separator between a section's texts | `src/enhance/lifecycle.ts` | `` text += `\u0001${m.textContent ?? ''}` `` → `` text += `${m.textContent ?? ''}` `` | `test/enhance-seams.test.ts`: 3 failed \| 85 passed (88). "one unit per level-2 heading with an id among the root's children, its blocks up to the next h1 or h2"; "a fingerprint ignores chrome text: it is the source's, though the fold controls now sit in every heading"; "a heading with no id ends the unit before it and starts none; script and dl count neither in the fingerprint nor the minutes" |
| L2-T7a-M84 | the sections are frozen | `src/enhance/lifecycle.ts` | `  flush(); ⏎   return Object.freeze(out);` → `  flush(); ⏎   return out;` | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "the units and their member lists are frozen" |
| L2-T7a-M85 | a chrome id skips the document's ids | `src/enhance/lifecycle.ts` | `    for (let k = 2; taken.has(id) \|\| issued.has(id); k += 1)` → `    for (let k = 2; issued.has(id); k += 1)` | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "skips an id the document already has, inside the root or outside it, and one another instance issued" |
| L2-T7a-M86 | a chrome id skips every id issued in the document | `src/enhance/lifecycle.ts` | `    for (let k = 2; taken.has(id) \|\| issued.has(id); k += 1)` → `    for (let k = 2; taken.has(id); k += 1)` | `test/enhance-seams.test.ts`: 2 failed \| 86 passed (88). "two roots in one document get disjoint ids for the same names"; "skips an id the document already has, inside the root or outside it, and one another instance issued" |
| L2-T7a-M87 | the document's ids are read from the whole document | `src/enhance/lifecycle.ts` | `inst.root.ownerDocument.querySelectorAll('[id]')` → `inst.root.querySelectorAll('[id]')` | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "skips an id the document already has, inside the root or outside it, and one another instance issued" |
| L2-T7a-M88 | each instance of a document has its own number | `src/enhance/lifecycle.ts` | `  reg.next += 1; ⏎ ` → (deleted) | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "skips an id the document already has, inside the root or outside it, and one another instance issued" |
| L2-T7a-M89 | a chrome id's name is checked | `src/enhance/lifecycle.ts` | `    if (typeof name !== 'string' \|\| !CHROME_ID_NAME.test(name)) {` → `    if (false) {` | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "refuses a name that is not 1 to 32 lower-case letters, digits and dashes, starting with a letter" |
| L2-T7a-M90 | an instance's chrome ids are released at teardown | `src/enhance/lifecycle.ts` | `    for (const id of mine) issued.delete(id); ⏎ ` → (deleted) | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "an instance's ids are released when it is torn down" |
| L2-T7a-M91 | the build stops once the instance is not live | `src/enhance/lifecycle.ts` | `    f.build(ctx); ⏎     if (!live()) return;` → `    f.build(ctx);` | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "the startup builds through the list, in order, inside the startup operation, and stops once destroyed" |
| L2-T7a-M92 | the second phase starts once the layout is built | `src/enhance/lifecycle.ts` | `    inst.state?.seal(); ⏎     secondPhase(inst);` → `    inst.state?.seal();` | `test/enhance-seams.test.ts`: 3 failed \| 85 passed (88). "starts each after in order, once the startup has built every feature, inside an operation"; "enhance resolves without waiting for the second phase"; "a rejected or throwing after is swallowed: no unhandled rejection, and the others still run" |
| L2-T7a-M93 | no second phase when the startup was destroyed | `src/enhance/lifecycle.ts` | `    if (!isLive(inst)) { ⏎       const cleanup = await settled(destroyInstance(inst));` → `    secondPhase(inst); ⏎     if (!isLive(inst)) { ⏎       const cleanup = await settled(destroyIn…` | `test/enhance-seams.test.ts`: 3 failed \| 85 passed (88). "starts each after in order, once the startup has built every feature, inside an operation"; "a rejected or throwing after is swallowed: no unhandled rejection, and the others still run"; "no after starts when the startup failed or was destroyed" |
| L2-T7a-M94 | each after starts inside an operation | `src/enhance/lifecycle.ts` | `    operate(inst, () => { ⏎       try { ⏎         // A rejection` → `    ((g: () => void) => g())(() => { ⏎       try { ⏎         // A rejection` | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "starts each after in order, once the startup has built every feature, inside an operation" |
| L2-T7a-M95 | a rejected after is never unhandled | `src/enhance/lifecycle.ts` | `        Promise.resolve(after(ctx)).catch(() => undefined);` → `        void after(ctx);` | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "a rejected or throwing after is swallowed: no unhandled rejection, and the others still run" |
| L2-T7a-M96 | an after that throws is swallowed | `src/enhance/lifecycle.ts` | `      } catch { ⏎         // a throw before its first await, likewise ⏎       }` → `      } finally { ⏎         // a throw before its first await, likewise ⏎       }` | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "a rejected or throwing after is swallowed: no unhandled rejection, and the others still run" |
| L2-T7a-M97 | features: the build order | `src/enhance/features.ts` | `    { name: 'ids', build: buildIds }, ⏎     { name: 'plans', build: buildPlans },` → `    { name: 'plans', build: buildPlans }, ⏎     { name: 'ids', build: buildIds },` | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "lists every feature once, in the reference's build order" |
| L2-T7a-M98 | features: a feature that waits on the host has its after | `src/enhance/features.ts` | `    { name: 'since', build: buildSince, after: afterSince },` → `    { name: 'since', build: buildSince },` | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "every module of src/enhance that exports build is registered, under its file name, and every stub exports build (and after when it waits on the host)" |
| L2-T7a-M99 | features: folds are built through the list | `src/enhance/features.ts` | `    { name: 'folds', build: buildFolds }, ⏎ ` → (deleted) | `test/enhance-folds.test.ts`: 12 failed \| 3 passed (15). "each h2 with blocks gets an .h-fold button in an .h-ctl at its end, and a hidden .fold-note right after it"; "the note carries the section's reading time when it is a minute or more"; "the button folds: blocks hidden until found, heading .folded, note shown, button says Unfold; again unfolds"; "the note unfolds"; "find-in-page opens a fold: beforematch on a hidden block unfolds its section"; and 1 more |
| L2-T7a-M100 | folds: the folds option is read by the feature | `src/enhance/folds.ts` | `  if (!ctx.options.folds \|\| !ctx.info.isDocument) return;` → `  if (!ctx.info.isDocument) return;` | `test/enhance-folds.test.ts`: 1 failed \| 14 passed (15). "no controls when folds is false, or when the page is not a document" |
| L2-T7a-M101 | folds: printing shows folded sections, and they fold again after | `src/enhance/folds.ts` | `        if (printing && m.getAttribute('hidden') === 'until-found')` → `        if (!printing && m.getAttribute('hidden') === 'until-found')` | `test/enhance-folds.test.ts`: 3 failed \| 12 passed (15). "printing shows folded sections, and they fold again after"; "a block the host hid itself while its section was folded stays hidden when printing starts"; "a block the host hid while printing is not folded over when printing ends" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T7a-M79",
    "guard": "the sections are measured before any feature builds",
    "file": "src/enhance/lifecycle.ts",
    "old": "    sections,\n    vocab: createVocab(options),",
    "new": "    get sections() {\n      return measureSections(root);\n    },\n    vocab: createVocab(options),",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M80",
    "guard": "a section heading has an id",
    "file": "src/enhance/lifecycle.ts",
    "old": "      heading = c.localName === 'h2' && c.id !== '' ? (c as HTMLElement) : null;",
    "new": "      heading = c.localName === 'h2' ? (c as HTMLElement) : null;",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M81",
    "guard": "an h1 ends a section",
    "file": "src/enhance/lifecycle.ts",
    "old": "    if (c.localName === 'h1' || c.localName === 'h2') {",
    "new": "    if (c.localName === 'h2') {",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M82",
    "guard": "script and dl blocks are left out of the fingerprint",
    "file": "src/enhance/lifecycle.ts",
    "old": "    for (const m of members) if (m.localName !== 'script' && m.localName !== 'dl') text += ",
    "new": "    for (const m of members) if (true) text += ",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M83",
    "guard": "the separator between a section's texts",
    "file": "src/enhance/lifecycle.ts",
    "old": "text += `\\u0001${m.textContent ?? ''}`",
    "new": "text += `${m.textContent ?? ''}`",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M84",
    "guard": "the sections are frozen",
    "file": "src/enhance/lifecycle.ts",
    "old": "  flush();\n  return Object.freeze(out);",
    "new": "  flush();\n  return out;",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M85",
    "guard": "a chrome id skips the document's ids",
    "file": "src/enhance/lifecycle.ts",
    "old": "    for (let k = 2; taken.has(id) || issued.has(id); k += 1)",
    "new": "    for (let k = 2; issued.has(id); k += 1)",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M86",
    "guard": "a chrome id skips every id issued in the document",
    "file": "src/enhance/lifecycle.ts",
    "old": "    for (let k = 2; taken.has(id) || issued.has(id); k += 1)",
    "new": "    for (let k = 2; taken.has(id); k += 1)",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M87",
    "guard": "the document's ids are read from the whole document",
    "file": "src/enhance/lifecycle.ts",
    "old": "inst.root.ownerDocument.querySelectorAll('[id]')",
    "new": "inst.root.querySelectorAll('[id]')",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M88",
    "guard": "each instance of a document has its own number",
    "file": "src/enhance/lifecycle.ts",
    "old": "  reg.next += 1;\n",
    "new": "",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M89",
    "guard": "a chrome id's name is checked",
    "file": "src/enhance/lifecycle.ts",
    "old": "    if (typeof name !== 'string' || !CHROME_ID_NAME.test(name)) {",
    "new": "    if (false) {",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M90",
    "guard": "an instance's chrome ids are released at teardown",
    "file": "src/enhance/lifecycle.ts",
    "old": "    for (const id of mine) issued.delete(id);\n",
    "new": "",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M91",
    "guard": "the build stops once the instance is not live",
    "file": "src/enhance/lifecycle.ts",
    "old": "    f.build(ctx);\n    if (!live()) return;",
    "new": "    f.build(ctx);",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M92",
    "guard": "the second phase starts once the layout is built",
    "file": "src/enhance/lifecycle.ts",
    "old": "    inst.state?.seal();\n    secondPhase(inst);",
    "new": "    inst.state?.seal();",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M93",
    "guard": "no second phase when the startup was destroyed",
    "file": "src/enhance/lifecycle.ts",
    "old": "    if (!isLive(inst)) {\n      const cleanup = await settled(destroyInstance(inst));",
    "new": "    secondPhase(inst);\n    if (!isLive(inst)) {\n      const cleanup = await settled(destroyInstance(inst));",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M94",
    "guard": "each after starts inside an operation",
    "file": "src/enhance/lifecycle.ts",
    "old": "    operate(inst, () => {\n      try {\n        // A rejection",
    "new": "    ((g: () => void) => g())(() => {\n      try {\n        // A rejection",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M95",
    "guard": "a rejected after is never unhandled",
    "file": "src/enhance/lifecycle.ts",
    "old": "        Promise.resolve(after(ctx)).catch(() => undefined);",
    "new": "        void after(ctx);",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M96",
    "guard": "an after that throws is swallowed",
    "file": "src/enhance/lifecycle.ts",
    "old": "      } catch {\n        // a throw before its first await, likewise\n      }",
    "new": "      } finally {\n        // a throw before its first await, likewise\n      }",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M97",
    "guard": "features: the build order",
    "file": "src/enhance/features.ts",
    "old": "    { name: 'ids', build: buildIds },\n    { name: 'plans', build: buildPlans },",
    "new": "    { name: 'plans', build: buildPlans },\n    { name: 'ids', build: buildIds },",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M98",
    "guard": "features: a feature that waits on the host has its after",
    "file": "src/enhance/features.ts",
    "old": "    { name: 'since', build: buildSince, after: afterSince },",
    "new": "    { name: 'since', build: buildSince },",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M99",
    "guard": "features: folds are built through the list",
    "file": "src/enhance/features.ts",
    "old": "    { name: 'folds', build: buildFolds },\n",
    "new": "",
    "tests": "test/enhance-folds.test.ts"
  },
  {
    "id": "L2-T7a-M100",
    "guard": "folds: the folds option is read by the feature",
    "file": "src/enhance/folds.ts",
    "old": "  if (!ctx.options.folds || !ctx.info.isDocument) return;",
    "new": "  if (!ctx.info.isDocument) return;",
    "tests": "test/enhance-folds.test.ts"
  },
  {
    "id": "L2-T7a-M101",
    "guard": "folds: printing shows folded sections, and they fold again after",
    "file": "src/enhance/folds.ts",
    "old": "        if (printing && m.getAttribute('hidden') === 'until-found')",
    "new": "        if (!printing && m.getAttribute('hidden') === 'until-found')",
    "tests": "test/enhance-folds.test.ts"
  }
]
```

## Status marks read `ctx.vocab` (L2-T7a-M102 to L2-T7a-M104)

Each of the three word lists the status marks use comes from the vocabulary, not from a list of status.ts's own.

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T7a-M102 | statusOf reads the vocabulary's status words | `src/enhance/status.ts` | `  for (const { re, role } of vocab.status) {` → `  for (const { re, role } of [{ re: /^(agreed\|pending)\b/i, role: 'ok' as const }]) {` | `test/enhance-seams.test.ts`: 5 failed \| 83 passed (88). "status words: the first a text opens with, as a whole word, any case; the role by list"; "a word list is literal: every metacharacter is escaped when it is compiled (LD9)"; "an empty list matches nothing"; "the defaults reproduce the prototype's marks"; "a vocabulary of other words marks those words instead, and the header words decide the column" |
| L2-T7a-M103 | a status column is named by the vocabulary's header words | `src/enhance/status.ts` | `      const named = vocab.statusHeader.test(head);` → `      const named = /\bstatus\b/i.test(head);` | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "a vocabulary of other words marks those words instead, and the header words decide the column" |
| L2-T7a-M104 | a ruling column is named by the vocabulary's ruling words | `src/enhance/status.ts` | `      const asked = vocab.rulingHeader.test(head) && ` → `      const asked = /ruling\|ruled\|answer\|\?$/i.test(head) && ` | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "the ruling-header words are the vocabulary's too" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T7a-M102",
    "guard": "statusOf reads the vocabulary's status words",
    "file": "src/enhance/status.ts",
    "old": "  for (const { re, role } of vocab.status) {",
    "new": "  for (const { re, role } of [{ re: /^(agreed|pending)\\b/i, role: 'ok' as const }]) {",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M103",
    "guard": "a status column is named by the vocabulary's header words",
    "file": "src/enhance/status.ts",
    "old": "      const named = vocab.statusHeader.test(head);",
    "new": "      const named = /\\bstatus\\b/i.test(head);",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M104",
    "guard": "a ruling column is named by the vocabulary's ruling words",
    "file": "src/enhance/status.ts",
    "old": "      const asked = vocab.rulingHeader.test(head) && ",
    "new": "      const asked = /ruling|ruled|answer|\\?$/i.test(head) && ",
    "tests": "test/enhance-seams.test.ts"
  }
]
```

## Word lists: `src/enhance/vocab.ts` (L2-T7a-M105 to L2-T7a-M132)

Literal words, an empty list that matches nothing, the defaults, and each list's match: whole words, cases, the ID and
rule-ID grammars and their prefixes, and the frozen copies.

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T7a-M105 | a word is literal: every metacharacter escaped | `src/enhance/vocab.ts` | `  return word.replace(/[.*+?^${}()\|[\]\\]/g, '\\$&');` → `  return word;` | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "a word list is literal: every metacharacter is escaped when it is compiled (LD9)" |
| L2-T7a-M106 | an empty list matches nothing | `src/enhance/vocab.ts` | ``   return words.length === 0 ? NEVER : `(?:${words.map(literal).join('\|')})`; `` → ``   return `(?:${words.map(literal).join('\|')})`; `` | `test/enhance-seams.test.ts`: 2 failed \| 86 passed (88). "an empty list matches nothing"; "a vocabulary of other words marks those words instead, and the header words decide the column" |
| L2-T7a-M107 | the default status words | `src/enhance/vocab.ts` | `      ok: ['ruled', 'accepted', 'agreed', 'kept',` → `      ok: ['ruled', 'accepted', 'kept',` | `test/enhance-seams.test.ts`: 4 failed \| 84 passed (88). "the defaults are the documented lists"; "status words: the first a text opens with, as a whole word, any case; the role by list"; "the defaults reproduce the prototype's marks"; "the ruling-header words are the vocabulary's too" |
| L2-T7a-M108 | the default status-header words | `src/enhance/vocab.ts` | `    statusHeaders: ['status', 'statuses', 'state',` → `    statusHeaders: ['status', 'statuses', 'statement', 'state',` | `test/enhance-seams.test.ts`: 2 failed \| 86 passed (88). "the defaults are the documented lists"; "status headers: named as a whole word; a ruling header by a word anywhere, or a question" |
| L2-T7a-M109 | the default addressees: you alone | `src/enhance/vocab.ts` | `    addressees: ['you'],` → `    addressees: ['you', 'reviewer'],` | `test/enhance-seams.test.ts`: 2 failed \| 86 passed (88). "the defaults are the documented lists"; "qualifiers and addressees, as whole words" |
| L2-T7a-M110 | the default qualifiers: none | `src/enhance/vocab.ts` | `    qualifiers: [],` → `    qualifiers: ['annex'],` | `test/enhance-seams.test.ts`: 2 failed \| 86 passed (88). "the defaults are the documented lists"; "an empty list matches nothing" |
| L2-T7a-M111 | a status word opens the text as a whole word | `src/enhance/vocab.ts` | `` new RegExp(`^(${anyOf(w.status[r])})\\b`, 'i') `` → `` new RegExp(`^(${anyOf(w.status[r])})`, 'i') `` | `test/enhance-seams.test.ts`: 2 failed \| 86 passed (88). "status words: the first a text opens with, as a whole word, any case; the role by list"; "a word list is literal: every metacharacter is escaped when it is compiled (LD9)" |
| L2-T7a-M112 | a status-header word is a whole word | `src/enhance/vocab.ts` | ``     statusHeader: new RegExp(`\\b${anyOf(w.statusHeaders)}\\b`, 'i'), `` → ``     statusHeader: new RegExp(`${anyOf(w.statusHeaders)}\\b`, 'i'), `` | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "status headers: named as a whole word; a ruling header by a word anywhere, or a question" |
| L2-T7a-M113 | a header that ends in a question mark asks one | `src/enhance/vocab.ts` | `` w.rulingHeaders.length === 0 ? '\\?$' : `${anyOf(w.rulingHeaders)}\|\\?$` `` → `w.rulingHeaders.length === 0 ? NEVER : anyOf(w.rulingHeaders)` | `test/enhance-seams.test.ts`: 2 failed \| 86 passed (88). "status headers: named as a whole word; a ruling header by a word anywhere, or a question"; "an empty list matches nothing" |
| L2-T7a-M114 | an ID opens with 1 to 4 capitals | `src/enhance/vocab.ts` | `w.ids.prefixes === null ? '[A-Z]{1,4}' : anyOf(w.ids.prefixes)` → `w.ids.prefixes === null ? '[A-Z]{1,5}' : anyOf(w.ids.prefixes)` | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "the ID grammar: 1 to 4 capitals, an optional dash, a number with dotted or dashed parts, an optional letter" |
| L2-T7a-M115 | an ID ends at the end, white space or , . : ; ) | `src/enhance/vocab.ts` | ``     id: new RegExp(`^(${idBody})(?=$\|[\\s,.:;)])`), `` → ``     id: new RegExp(`^(${idBody})`), `` | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "the ID grammar: 1 to 4 capitals, an optional dash, a number with dotted or dashed parts, an optional letter" |
| L2-T7a-M116 | ids false: no IDs at all | `src/enhance/vocab.ts` | `  const idHead = w.ids === false ? null :` → `  const idHead = w.ids === false ? '[A-Z]{1,4}' :` | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "the ID grammar with prefixes, and off" |
| L2-T7a-M117 | ID prefixes narrow the grammar | `src/enhance/vocab.ts` | `w.ids.prefixes === null ? '[A-Z]{1,4}' : anyOf(w.ids.prefixes)` → `w.ids.prefixes === null \|\| true ? '[A-Z]{1,4}' : anyOf(w.ids.prefixes)` | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "the ID grammar with prefixes, and off" |
| L2-T7a-M118 | idScan is global and fresh | `src/enhance/vocab.ts` | ``     idScan: () => new RegExp(`\\b(${idBody})\\b`, 'g'), `` → ``     idScan: () => new RegExp(`\\b(${idBody})\\b`), `` | `test/enhance-seams.test.ts`: 2 failed \| 86 passed (88). "the ID grammar: 1 to 4 capitals, an optional dash, a number with dotted or dashed parts, an optional letter"; "the ID grammar with prefixes, and off" |
| L2-T7a-M119 | a rule ID opens with two or more capitals | `src/enhance/vocab.ts` | `  const ruleHead = w.ruleIds.prefixes === null ? '[A-Z]{2,}' : anyOf(w.ruleIds.prefixes);` → `  const ruleHead = w.ruleIds.prefixes === null ? '[A-Z]{1,}' : anyOf(w.ruleIds.prefixes);` | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "the rule-ID grammar: two or more capitals, then dash-separated parts of capitals or digits; prefixes narrow it" |
| L2-T7a-M120 | rule-ID prefixes narrow the grammar | `src/enhance/vocab.ts` | `  const ruleHead = w.ruleIds.prefixes === null ? '[A-Z]{2,}' : anyOf(w.ruleIds.prefixes);` → `  const ruleHead = '[A-Z]{2,}';` | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "the rule-ID grammar: two or more capitals, then dash-separated parts of capitals or digits; prefixes narrow it" |
| L2-T7a-M121 | a qualifier is a whole word before the mention | `src/enhance/vocab.ts` | ``     qualifier: new RegExp(`\\b${anyOf(w.qualifiers)}\\s+$`, 'i'), `` → ``     qualifier: new RegExp(`${anyOf(w.qualifiers)}\\s+$`, 'i'), `` | `test/enhance-seams.test.ts`: no tests. "(the file failed to load)" |
| L2-T7a-M122 | an addressee matches in any case | `src/enhance/vocab.ts` | ``     addressee: new RegExp(`\\b${anyOf(w.addressees)}\\b`, 'i'), `` → ``     addressee: new RegExp(`\\b${anyOf(w.addressees)}\\b`), `` | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "qualifiers and addressees, as whole words" |
| L2-T7a-M123 | a task heading's word keeps its case | `src/enhance/vocab.ts` | ``       task: new RegExp(`^(${anyOf(w.plan.task)})\\s+([\\w.-]*\\w)\\s*[:.—–]\\s*`), `` → ``       task: new RegExp(`^(${anyOf(w.plan.task)})\\s+([\\w.-]*\\w)\\s*[:.—–]\\s*`, 'i'), `` | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "the plan grammars: a task heading, a step title with its owner, and the owner line" |
| L2-T7a-M124 | an owner column opens with a whole word | `src/enhance/vocab.ts` | ``       who: new RegExp(`^${anyOf(w.attention.who)}\\b`, 'i'), `` → ``       who: new RegExp(`^${anyOf(w.attention.who)}`, 'i'), `` | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "attention words" |
| L2-T7a-M125 | a blocking answer opens with a whole word | `src/enhance/vocab.ts` | ``       blocking: new RegExp(`^\\s*${anyOf(w.attention.blocking)}\\b`, 'i'), `` → ``       blocking: new RegExp(`^\\s*${anyOf(w.attention.blocking)}`, 'i'), `` | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "attention words" |
| L2-T7a-M126 | an item key: a capital and 1 to 9 capitals or digits | `src/enhance/vocab.ts` | `    itemKey: /^[A-Z][A-Z0-9]{1,9}-\d+$/,` → `    itemKey: /^[A-Z][A-Z0-9]{1,10}-\d+$/,` | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "git's merge subjects, the commit-prefix rule and the item-key shape" |
| L2-T7a-M127 | an item heading takes a space or a dash between words | `src/enhance/vocab.ts` | `words.map((h) => h.split(/[- ]+/).map(literal).join('[- ]')).join('\|')` → `words.map((h) => literal(h)).join('\|')` | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "git's merge subjects, the commit-prefix rule and the item-key shape" |
| L2-T7a-M128 | a path may end in a fragment | `src/enhance/vocab.ts` | `` (?:#[\\w-]+)?$`), `` → `` $`), `` | `test/enhance-seams.test.ts`: no tests. "(the file failed to load)" |
| L2-T7a-M129 | a glossary term header is the whole header | `src/enhance/vocab.ts` | ``       term: new RegExp(`^${anyOf(w.glossary.termHeaders)}$`, 'i'), `` → ``       term: new RegExp(`^${anyOf(w.glossary.termHeaders)}`, 'i'), `` | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "the glossary contract" |
| L2-T7a-M130 | a merge subject is git's own, case and all | `src/enhance/vocab.ts` | ``     merge: new RegExp(`^Merge ${anyOf(w.mergeForms)}\\b`), `` → ``     merge: new RegExp(`^Merge ${anyOf(w.mergeForms)}\\b`, 'i'), `` | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "git's merge subjects, the commit-prefix rule and the item-key shape" |
| L2-T7a-M131 | the compiled lists are frozen | `src/enhance/vocab.ts` | `  const list = (a: readonly string[]): string[] => Object.freeze([...a]) as string[];` → `  const list = (a: readonly string[]): string[] => [...a];` | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "the defaults are a fresh object each time, and the compiled vocabulary holds a frozen copy" |
| L2-T7a-M132 | the compiled lists are copies | `src/enhance/vocab.ts` | `  const list = (a: readonly string[]): string[] => Object.freeze([...a]) as string[];` → `  const list = (a: readonly string[]): string[] => a as string[];` | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "the defaults are a fresh object each time, and the compiled vocabulary holds a frozen copy" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T7a-M105",
    "guard": "a word is literal: every metacharacter escaped",
    "file": "src/enhance/vocab.ts",
    "old": "  return word.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&');",
    "new": "  return word;",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M106",
    "guard": "an empty list matches nothing",
    "file": "src/enhance/vocab.ts",
    "old": "  return words.length === 0 ? NEVER : `(?:${words.map(literal).join('|')})`;",
    "new": "  return `(?:${words.map(literal).join('|')})`;",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M107",
    "guard": "the default status words",
    "file": "src/enhance/vocab.ts",
    "old": "      ok: ['ruled', 'accepted', 'agreed', 'kept',",
    "new": "      ok: ['ruled', 'accepted', 'kept',",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M108",
    "guard": "the default status-header words",
    "file": "src/enhance/vocab.ts",
    "old": "    statusHeaders: ['status', 'statuses', 'state',",
    "new": "    statusHeaders: ['status', 'statuses', 'statement', 'state',",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M109",
    "guard": "the default addressees: you alone",
    "file": "src/enhance/vocab.ts",
    "old": "    addressees: ['you'],",
    "new": "    addressees: ['you', 'reviewer'],",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M110",
    "guard": "the default qualifiers: none",
    "file": "src/enhance/vocab.ts",
    "old": "    qualifiers: [],",
    "new": "    qualifiers: ['annex'],",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M111",
    "guard": "a status word opens the text as a whole word",
    "file": "src/enhance/vocab.ts",
    "old": "new RegExp(`^(${anyOf(w.status[r])})\\\\b`, 'i')",
    "new": "new RegExp(`^(${anyOf(w.status[r])})`, 'i')",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M112",
    "guard": "a status-header word is a whole word",
    "file": "src/enhance/vocab.ts",
    "old": "    statusHeader: new RegExp(`\\\\b${anyOf(w.statusHeaders)}\\\\b`, 'i'),",
    "new": "    statusHeader: new RegExp(`${anyOf(w.statusHeaders)}\\\\b`, 'i'),",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M113",
    "guard": "a header that ends in a question mark asks one",
    "file": "src/enhance/vocab.ts",
    "old": "w.rulingHeaders.length === 0 ? '\\\\?$' : `${anyOf(w.rulingHeaders)}|\\\\?$`",
    "new": "w.rulingHeaders.length === 0 ? NEVER : anyOf(w.rulingHeaders)",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M114",
    "guard": "an ID opens with 1 to 4 capitals",
    "file": "src/enhance/vocab.ts",
    "old": "w.ids.prefixes === null ? '[A-Z]{1,4}' : anyOf(w.ids.prefixes)",
    "new": "w.ids.prefixes === null ? '[A-Z]{1,5}' : anyOf(w.ids.prefixes)",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M115",
    "guard": "an ID ends at the end, white space or , . : ; )",
    "file": "src/enhance/vocab.ts",
    "old": "    id: new RegExp(`^(${idBody})(?=$|[\\\\s,.:;)])`),",
    "new": "    id: new RegExp(`^(${idBody})`),",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M116",
    "guard": "ids false: no IDs at all",
    "file": "src/enhance/vocab.ts",
    "old": "  const idHead = w.ids === false ? null :",
    "new": "  const idHead = w.ids === false ? '[A-Z]{1,4}' :",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M117",
    "guard": "ID prefixes narrow the grammar",
    "file": "src/enhance/vocab.ts",
    "old": "w.ids.prefixes === null ? '[A-Z]{1,4}' : anyOf(w.ids.prefixes)",
    "new": "w.ids.prefixes === null || true ? '[A-Z]{1,4}' : anyOf(w.ids.prefixes)",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M118",
    "guard": "idScan is global and fresh",
    "file": "src/enhance/vocab.ts",
    "old": "    idScan: () => new RegExp(`\\\\b(${idBody})\\\\b`, 'g'),",
    "new": "    idScan: () => new RegExp(`\\\\b(${idBody})\\\\b`),",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M119",
    "guard": "a rule ID opens with two or more capitals",
    "file": "src/enhance/vocab.ts",
    "old": "  const ruleHead = w.ruleIds.prefixes === null ? '[A-Z]{2,}' : anyOf(w.ruleIds.prefixes);",
    "new": "  const ruleHead = w.ruleIds.prefixes === null ? '[A-Z]{1,}' : anyOf(w.ruleIds.prefixes);",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M120",
    "guard": "rule-ID prefixes narrow the grammar",
    "file": "src/enhance/vocab.ts",
    "old": "  const ruleHead = w.ruleIds.prefixes === null ? '[A-Z]{2,}' : anyOf(w.ruleIds.prefixes);",
    "new": "  const ruleHead = '[A-Z]{2,}';",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M121",
    "guard": "a qualifier is a whole word before the mention",
    "file": "src/enhance/vocab.ts",
    "old": "    qualifier: new RegExp(`\\\\b${anyOf(w.qualifiers)}\\\\s+$`, 'i'),",
    "new": "    qualifier: new RegExp(`${anyOf(w.qualifiers)}\\\\s+$`, 'i'),",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M122",
    "guard": "an addressee matches in any case",
    "file": "src/enhance/vocab.ts",
    "old": "    addressee: new RegExp(`\\\\b${anyOf(w.addressees)}\\\\b`, 'i'),",
    "new": "    addressee: new RegExp(`\\\\b${anyOf(w.addressees)}\\\\b`),",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M123",
    "guard": "a task heading's word keeps its case",
    "file": "src/enhance/vocab.ts",
    "old": "      task: new RegExp(`^(${anyOf(w.plan.task)})\\\\s+([\\\\w.-]*\\\\w)\\\\s*[:.—–]\\\\s*`),",
    "new": "      task: new RegExp(`^(${anyOf(w.plan.task)})\\\\s+([\\\\w.-]*\\\\w)\\\\s*[:.—–]\\\\s*`, 'i'),",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M124",
    "guard": "an owner column opens with a whole word",
    "file": "src/enhance/vocab.ts",
    "old": "      who: new RegExp(`^${anyOf(w.attention.who)}\\\\b`, 'i'),",
    "new": "      who: new RegExp(`^${anyOf(w.attention.who)}`, 'i'),",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M125",
    "guard": "a blocking answer opens with a whole word",
    "file": "src/enhance/vocab.ts",
    "old": "      blocking: new RegExp(`^\\\\s*${anyOf(w.attention.blocking)}\\\\b`, 'i'),",
    "new": "      blocking: new RegExp(`^\\\\s*${anyOf(w.attention.blocking)}`, 'i'),",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M126",
    "guard": "an item key: a capital and 1 to 9 capitals or digits",
    "file": "src/enhance/vocab.ts",
    "old": "    itemKey: /^[A-Z][A-Z0-9]{1,9}-\\d+$/,",
    "new": "    itemKey: /^[A-Z][A-Z0-9]{1,10}-\\d+$/,",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M127",
    "guard": "an item heading takes a space or a dash between words",
    "file": "src/enhance/vocab.ts",
    "old": "words.map((h) => h.split(/[- ]+/).map(literal).join('[- ]')).join('|')",
    "new": "words.map((h) => literal(h)).join('|')",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M128",
    "guard": "a path may end in a fragment",
    "file": "src/enhance/vocab.ts",
    "old": "(?:#[\\\\w-]+)?$`),",
    "new": "$`),",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M129",
    "guard": "a glossary term header is the whole header",
    "file": "src/enhance/vocab.ts",
    "old": "      term: new RegExp(`^${anyOf(w.glossary.termHeaders)}$`, 'i'),",
    "new": "      term: new RegExp(`^${anyOf(w.glossary.termHeaders)}`, 'i'),",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M130",
    "guard": "a merge subject is git's own, case and all",
    "file": "src/enhance/vocab.ts",
    "old": "    merge: new RegExp(`^Merge ${anyOf(w.mergeForms)}\\\\b`),",
    "new": "    merge: new RegExp(`^Merge ${anyOf(w.mergeForms)}\\\\b`, 'i'),",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M131",
    "guard": "the compiled lists are frozen",
    "file": "src/enhance/vocab.ts",
    "old": "  const list = (a: readonly string[]): string[] => Object.freeze([...a]) as string[];",
    "new": "  const list = (a: readonly string[]): string[] => [...a];",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M132",
    "guard": "the compiled lists are copies",
    "file": "src/enhance/vocab.ts",
    "old": "  const list = (a: readonly string[]): string[] => Object.freeze([...a]) as string[];",
    "new": "  const list = (a: readonly string[]): string[] => a as string[];",
    "tests": "test/enhance-seams.test.ts"
  }
]
```

## Text helpers: `src/enhance/text.ts` (L2-T7a-M133 to L2-T7a-M140)

clip, hash, document order, the colour key and the frozen helpers.

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T7a-M133 | clip never cuts a surrogate pair | `src/enhance/text.ts` | `  if (end > 0 && isHighSurrogate(t.charCodeAt(end - 1))) end -= 1; ⏎ ` → (deleted) | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "clip never cuts a surrogate pair in two" |
| L2-T7a-M134 | clip cuts at a space only past 60% | `src/enhance/text.ts` | `  let end = space > n * 0.6 ? space : n - 1;` → `  let end = space > 0 ? space : n - 1;` | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "clip collapses white space and cuts at a word, with an ellipsis, within n code units" |
| L2-T7a-M135 | clip drops trailing punctuation before the ellipsis | `src/enhance/text.ts` | `` .replace(/[\s,;:(—–-]+$/, '')}…`; `` → `` }…`; `` | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "clip collapses white space and cuts at a word, with an ellipsis, within n code units" |
| L2-T7a-M136 | clip collapses white space | `src/enhance/text.ts` | `  const t = s.replace(/\s+/g, ' ').trim();` → `  const t = s.trim();` | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "clip collapses white space and cuts at a word, with an ellipsis, within n code units" |
| L2-T7a-M137 | hash is FNV-1a | `src/enhance/text.ts` | `    h = Math.imul(h, 16777619);` → `    h = Math.imul(h, 16777617);` | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "hash is the 32-bit FNV-1a of the code units, in base 36" |
| L2-T7a-M138 | before reads the following bit | `src/enhance/text.ts` | `const FOLLOWING = 4;` → `const FOLLOWING = 2;` | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "before and inOrder follow document order" |
| L2-T7a-M139 | the colour key's swatches are hidden from assistive technology | `src/enhance/text.ts` | `` chrome(doc, 'span', { className: `sw k-${e.role}`, attrs: { 'aria-hidden': 'true' } }) `` → `` chrome(doc, 'span', { className: `sw k-${e.role}` }) `` | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "colourKey builds the key as chrome: one item per colour role, with a swatch and a neutral label" |
| L2-T7a-M140 | the text helpers are frozen | `src/enhance/text.ts` | `  return Object.freeze({ clip, hash, before, inOrder, colourKey });` → `  return { clip, hash, before, inOrder, colourKey };` | `test/enhance-seams.test.ts`: 1 failed \| 87 passed (88). "the context carries the helpers, frozen, the same functions" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T7a-M133",
    "guard": "clip never cuts a surrogate pair",
    "file": "src/enhance/text.ts",
    "old": "  if (end > 0 && isHighSurrogate(t.charCodeAt(end - 1))) end -= 1;\n",
    "new": "",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M134",
    "guard": "clip cuts at a space only past 60%",
    "file": "src/enhance/text.ts",
    "old": "  let end = space > n * 0.6 ? space : n - 1;",
    "new": "  let end = space > 0 ? space : n - 1;",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M135",
    "guard": "clip drops trailing punctuation before the ellipsis",
    "file": "src/enhance/text.ts",
    "old": ".replace(/[\\s,;:(—–-]+$/, '')}…`;",
    "new": "}…`;",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M136",
    "guard": "clip collapses white space",
    "file": "src/enhance/text.ts",
    "old": "  const t = s.replace(/\\s+/g, ' ').trim();",
    "new": "  const t = s.trim();",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M137",
    "guard": "hash is FNV-1a",
    "file": "src/enhance/text.ts",
    "old": "    h = Math.imul(h, 16777619);",
    "new": "    h = Math.imul(h, 16777617);",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M138",
    "guard": "before reads the following bit",
    "file": "src/enhance/text.ts",
    "old": "const FOLLOWING = 4;",
    "new": "const FOLLOWING = 2;",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M139",
    "guard": "the colour key's swatches are hidden from assistive technology",
    "file": "src/enhance/text.ts",
    "old": "chrome(doc, 'span', { className: `sw k-${e.role}`, attrs: { 'aria-hidden': 'true' } })",
    "new": "chrome(doc, 'span', { className: `sw k-${e.role}` })",
    "tests": "test/enhance-seams.test.ts"
  },
  {
    "id": "L2-T7a-M140",
    "guard": "the text helpers are frozen",
    "file": "src/enhance/text.ts",
    "old": "  return Object.freeze({ clip, hash, before, inOrder, colourKey });",
    "new": "  return { clip, hash, before, inOrder, colourKey };",
    "tests": "test/enhance-seams.test.ts"
  }
]
```

## The walls, their sites, and the pack allowlist (L2-T7a-M141 to L2-T7a-M161)

Each new wall (the window, timers, observers, fonts, sizes, lookups, the clock and inline style), the one receiver let
through (`env`), the exact allowances of env.ts and journal.ts, the language's Date, the dashed module name; then a
use of each refused name put into another file, which the walls catch; and the pack test's allowlist for
`diagram-tools`.

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T7a-M141 | walls: inline style is refused outside journal.ts | `test/enhance-walls.test.ts` | `const STYLE_MEMBERS: readonly string[] = ['style'];` → `const STYLE_MEMBERS: readonly string[] = [];` | `test/enhance-walls.test.ts`: 3 failed \| 10 passed (13). "each allowed site is used exactly as allowed, so an exception cannot widen unseen"; "the scan sees the window, its timers, observers, fonts and sizes, the clock and inline style, and lets env through"; "the scan reads code, not comments or strings, and sees each banned shape" |
| L2-T7a-M142 | walls: the window is refused outside env.ts | `test/enhance-walls.test.ts` | `  'defaultView', 'view', ⏎ ` → (deleted) | `test/enhance-walls.test.ts`: 3 failed \| 10 passed (13). "each allowed site is used exactly as allowed, so an exception cannot widen unseen"; "the scan sees the window, its timers, observers, fonts and sizes, the clock and inline style, and lets env through"; "the scan sees string keys, keys built at run time, page members, URL and handler attributes, and id matches" |
| L2-T7a-M143 | walls: timers are refused outside env.ts | `test/enhance-walls.test.ts` | `  'setTimeout', 'clearTimeout', ` → `  'clearTimeout', ` | `test/enhance-walls.test.ts`: 2 failed \| 11 passed (13). "each allowed site is used exactly as allowed, so an exception cannot widen unseen"; "the scan sees the window, its timers, observers, fonts and sizes, the clock and inline style, and lets env through" |
| L2-T7a-M144 | walls: observers are refused outside env.ts | `test/enhance-walls.test.ts` | `  'ResizeObserver', 'IntersectionObserver', 'MutationObserver', 'PerformanceObserver', ⏎ ` → (deleted) | `test/enhance-walls.test.ts`: 2 failed \| 11 passed (13). "each allowed site is used exactly as allowed, so an exception cannot widen unseen"; "the scan sees the window, its timers, observers, fonts and sizes, the clock and inline style, and lets env through" |
| L2-T7a-M145 | walls: the fonts, media queries and sizes are refused outside env.ts | `test/enhance-walls.test.ts` | `  'fonts', 'matchMedia', 'innerWidth', ` → `  'innerWidth', ` | `test/enhance-walls.test.ts`: 2 failed \| 11 passed (13). "each allowed site is used exactly as allowed, so an exception cannot widen unseen"; "the scan sees the window, its timers, observers, fonts and sizes, the clock and inline style, and lets env through" |
| L2-T7a-M146 | walls: a point lookup and computed styles are refused outside env.ts | `test/enhance-walls.test.ts` | `  'elementFromPoint', 'getComputedStyle', ⏎ ` → (deleted) | `test/enhance-walls.test.ts`: 2 failed \| 11 passed (13). "each allowed site is used exactly as allowed, so an exception cannot widen unseen"; "the scan sees the window, its timers, observers, fonts and sizes, the clock and inline style, and lets env through" |
| L2-T7a-M147 | walls: env itself is the one receiver let through | `test/enhance-walls.test.ts` | `!/(?:^\|\.)env$/.test(node.expression.getText(sf))` → `true` | `test/enhance-walls.test.ts`: 1 failed \| 12 passed (13). "the scan sees the window, its timers, observers, fonts and sizes, the clock and inline style, and lets env through" |
| L2-T7a-M148 | walls: the clock is refused outside env.ts | `test/enhance-walls.test.ts` | `&& node.name.text === 'now') at(node, 'Date.now');` → `&& node.name.text === 'now') void 0;` | `test/enhance-walls.test.ts`: 2 failed \| 11 passed (13). "each allowed site is used exactly as allowed, so an exception cannot widen unseen"; "the scan sees the window, its timers, observers, fonts and sizes, the clock and inline style, and lets env through" |
| L2-T7a-M149 | walls: new Date() with no argument is refused | `test/enhance-walls.test.ts` | `&& (node.arguments?.length ?? 0) === 0) at(node, 'new Date()');` → `&& (node.arguments?.length ?? 0) === 0) void 0;` | `test/enhance-walls.test.ts`: 1 failed \| 12 passed (13). "the scan sees the window, its timers, observers, fonts and sizes, the clock and inline style, and lets env through" |
| L2-T7a-M150 | walls: a window member by a string key is refused | `test/enhance-walls.test.ts` | `\|\| members.has(key.text) \|\| windowMembers.has(key.text)) at(` → `\|\| members.has(key.text)) at(` | `test/enhance-walls.test.ts`: 1 failed \| 12 passed (13). "the scan sees the window, its timers, observers, fonts and sizes, the clock and inline style, and lets env through" |
| L2-T7a-M151 | walls: env.ts's allowance is exact | `test/enhance-walls.test.ts` | `    '.setTimeout': 3,` → `    '.setTimeout': 4,` | `test/enhance-walls.test.ts`: 1 failed \| 12 passed (13). "each allowed site is used exactly as allowed, so an exception cannot widen unseen" |
| L2-T7a-M152 | walls: journal.ts's allowance is exact | `test/enhance-walls.test.ts` | `  'src/enhance/journal.ts': { '.style': 1 },` → `  'src/enhance/journal.ts': { '.style': 2 },` | `test/enhance-walls.test.ts`: 1 failed \| 12 passed (13). "each allowed site is used exactly as allowed, so an exception cannot widen unseen" |
| L2-T7a-M153 | walls: folds.ts no longer reaches the window | `test/enhance-walls.test.ts` | `  'src/enhance/journal.ts': { '.style': 1 },` → `  'src/enhance/journal.ts': { '.style': 1 }, ⏎   'src/enhance/folds.ts': { '.defaultView': 1 },` | `test/enhance-walls.test.ts`: 1 failed \| 12 passed (13). "each allowed site is used exactly as allowed, so an exception cannot widen unseen" |
| L2-T7a-M154 | walls: the language's Date is allowed | `test/enhance-walls.test.ts` | `'AggregateError', 'Array', 'Boolean', 'Date', 'Error',` → `'AggregateError', 'Array', 'Boolean', 'Error',` | `test/enhance-walls.test.ts`: 2 failed \| 11 passed (13). "no source file names a DOM-library global beyond the language's own objects"; "the language's own objects are allowed; the DOM's clock and timers are not" |
| L2-T7a-M155 | walls: a dashed module name is a sibling file | `test/enhance-walls.test.ts` | `.filter((spec) => !/^\.\/[a-z]+(?:-[a-z]+)*\.js$/.test(spec))` → `.filter((spec) => !/^\.\/[a-z]+\.js$/.test(spec))` | `test/enhance-walls.test.ts`: 1 failed \| 12 passed (13). "every source imports only sibling files of src/enhance, named in lower-case words joined by dashes" |
| L2-T7a-M156 | site: the window outside env.ts is caught | `src/enhance/folds.ts` | `  ctx.env.onPrint((printing) => {` → `  void root.ownerDocument.defaultView; ⏎   ctx.env.onPrint((printing) => {` | `test/enhance-walls.test.ts`: 1 failed \| 12 passed (13). "no source file names a forbidden identifier, a selector with # or built at run time, or a style string" |
| L2-T7a-M157 | site: inline style outside journal.ts is caught | `src/enhance/status.ts` | `  const { root, journal, vocab } = ctx;` → `  const { root, journal, vocab } = ctx; ⏎   void root.style;` | `test/enhance-walls.test.ts`: 1 failed \| 12 passed (13). "no source file names a forbidden identifier, a selector with # or built at run time, or a style string" |
| L2-T7a-M158 | site: the clock outside env.ts is caught | `src/enhance/text.ts` | `  let h = 0x811c9dc5;` → `  let h = 0x811c9dc5 + Date.now() * 0;` | `test/enhance-walls.test.ts`: 1 failed \| 12 passed (13). "no source file names a forbidden identifier, a selector with # or built at run time, or a style string" |
| L2-T7a-M159 | site: the fonts outside env.ts are caught | `src/enhance/editorial.ts` | `  const doc = root.ownerDocument; ⏎  ⏎   // ── 0.` → `  const doc = root.ownerDocument; ⏎   void doc.fonts; ⏎  ⏎   // ── 0.` | `test/enhance-walls.test.ts`: 1 failed \| 12 passed (13). "no source file names a forbidden identifier, a selector with # or built at run time, or a style string" |
| L2-T7a-M160 | site: a timer on an event's window is caught | `src/enhance/scroll.ts` | `  void ctx; ⏎ ` → `  void ctx; ⏎   void ((ctx as unknown as { e: UIEvent }).e.view?.setTimeout); ⏎ ` | `test/enhance-walls.test.ts`: 1 failed \| 12 passed (13). "no source file names a forbidden identifier, a selector with # or built at run time, or a style string" |
| L2-T7a-M161 | pack: a dashed module name may be packed | `test/pack.test.ts` | `/^dist\/(?:render\|conformance\|enhance)\/[A-Za-z]+(?:-[a-z]+)*\.(?:js\|d\.ts)$/` → `/^dist\/(?:render\|conformance\|enhance)\/[A-Za-z]+\.(?:js\|d\.ts)$/` | `test/pack.test.ts`: 1 failed \| 9 passed (10). "holds nothing else: no references, scripts, sources, tests, CI files or working papers" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T7a-M141",
    "guard": "walls: inline style is refused outside journal.ts",
    "file": "test/enhance-walls.test.ts",
    "old": "const STYLE_MEMBERS: readonly string[] = ['style'];",
    "new": "const STYLE_MEMBERS: readonly string[] = [];",
    "tests": "test/enhance-walls.test.ts"
  },
  {
    "id": "L2-T7a-M142",
    "guard": "walls: the window is refused outside env.ts",
    "file": "test/enhance-walls.test.ts",
    "old": "  'defaultView', 'view',\n",
    "new": "",
    "tests": "test/enhance-walls.test.ts"
  },
  {
    "id": "L2-T7a-M143",
    "guard": "walls: timers are refused outside env.ts",
    "file": "test/enhance-walls.test.ts",
    "old": "  'setTimeout', 'clearTimeout', ",
    "new": "  'clearTimeout', ",
    "tests": "test/enhance-walls.test.ts"
  },
  {
    "id": "L2-T7a-M144",
    "guard": "walls: observers are refused outside env.ts",
    "file": "test/enhance-walls.test.ts",
    "old": "  'ResizeObserver', 'IntersectionObserver', 'MutationObserver', 'PerformanceObserver',\n",
    "new": "",
    "tests": "test/enhance-walls.test.ts"
  },
  {
    "id": "L2-T7a-M145",
    "guard": "walls: the fonts, media queries and sizes are refused outside env.ts",
    "file": "test/enhance-walls.test.ts",
    "old": "  'fonts', 'matchMedia', 'innerWidth', ",
    "new": "  'innerWidth', ",
    "tests": "test/enhance-walls.test.ts"
  },
  {
    "id": "L2-T7a-M146",
    "guard": "walls: a point lookup and computed styles are refused outside env.ts",
    "file": "test/enhance-walls.test.ts",
    "old": "  'elementFromPoint', 'getComputedStyle',\n",
    "new": "",
    "tests": "test/enhance-walls.test.ts"
  },
  {
    "id": "L2-T7a-M147",
    "guard": "walls: env itself is the one receiver let through",
    "file": "test/enhance-walls.test.ts",
    "old": "!/(?:^|\\.)env$/.test(node.expression.getText(sf))",
    "new": "true",
    "tests": "test/enhance-walls.test.ts"
  },
  {
    "id": "L2-T7a-M148",
    "guard": "walls: the clock is refused outside env.ts",
    "file": "test/enhance-walls.test.ts",
    "old": "&& node.name.text === 'now') at(node, 'Date.now');",
    "new": "&& node.name.text === 'now') void 0;",
    "tests": "test/enhance-walls.test.ts"
  },
  {
    "id": "L2-T7a-M149",
    "guard": "walls: new Date() with no argument is refused",
    "file": "test/enhance-walls.test.ts",
    "old": "&& (node.arguments?.length ?? 0) === 0) at(node, 'new Date()');",
    "new": "&& (node.arguments?.length ?? 0) === 0) void 0;",
    "tests": "test/enhance-walls.test.ts"
  },
  {
    "id": "L2-T7a-M150",
    "guard": "walls: a window member by a string key is refused",
    "file": "test/enhance-walls.test.ts",
    "old": "|| members.has(key.text) || windowMembers.has(key.text)) at(",
    "new": "|| members.has(key.text)) at(",
    "tests": "test/enhance-walls.test.ts"
  },
  {
    "id": "L2-T7a-M151",
    "guard": "walls: env.ts's allowance is exact",
    "file": "test/enhance-walls.test.ts",
    "old": "    '.setTimeout': 3,",
    "new": "    '.setTimeout': 4,",
    "tests": "test/enhance-walls.test.ts"
  },
  {
    "id": "L2-T7a-M152",
    "guard": "walls: journal.ts's allowance is exact",
    "file": "test/enhance-walls.test.ts",
    "old": "  'src/enhance/journal.ts': { '.style': 1 },",
    "new": "  'src/enhance/journal.ts': { '.style': 2 },",
    "tests": "test/enhance-walls.test.ts"
  },
  {
    "id": "L2-T7a-M153",
    "guard": "walls: folds.ts no longer reaches the window",
    "file": "test/enhance-walls.test.ts",
    "old": "  'src/enhance/journal.ts': { '.style': 1 },",
    "new": "  'src/enhance/journal.ts': { '.style': 1 },\n  'src/enhance/folds.ts': { '.defaultView': 1 },",
    "tests": "test/enhance-walls.test.ts"
  },
  {
    "id": "L2-T7a-M154",
    "guard": "walls: the language's Date is allowed",
    "file": "test/enhance-walls.test.ts",
    "old": "'AggregateError', 'Array', 'Boolean', 'Date', 'Error',",
    "new": "'AggregateError', 'Array', 'Boolean', 'Error',",
    "tests": "test/enhance-walls.test.ts"
  },
  {
    "id": "L2-T7a-M155",
    "guard": "walls: a dashed module name is a sibling file",
    "file": "test/enhance-walls.test.ts",
    "old": ".filter((spec) => !/^\\.\\/[a-z]+(?:-[a-z]+)*\\.js$/.test(spec))",
    "new": ".filter((spec) => !/^\\.\\/[a-z]+\\.js$/.test(spec))",
    "tests": "test/enhance-walls.test.ts"
  },
  {
    "id": "L2-T7a-M156",
    "guard": "site: the window outside env.ts is caught",
    "file": "src/enhance/folds.ts",
    "old": "  ctx.env.onPrint((printing) => {",
    "new": "  void root.ownerDocument.defaultView;\n  ctx.env.onPrint((printing) => {",
    "tests": "test/enhance-walls.test.ts"
  },
  {
    "id": "L2-T7a-M157",
    "guard": "site: inline style outside journal.ts is caught",
    "file": "src/enhance/status.ts",
    "old": "  const { root, journal, vocab } = ctx;",
    "new": "  const { root, journal, vocab } = ctx;\n  void root.style;",
    "tests": "test/enhance-walls.test.ts"
  },
  {
    "id": "L2-T7a-M158",
    "guard": "site: the clock outside env.ts is caught",
    "file": "src/enhance/text.ts",
    "old": "  let h = 0x811c9dc5;",
    "new": "  let h = 0x811c9dc5 + Date.now() * 0;",
    "tests": "test/enhance-walls.test.ts"
  },
  {
    "id": "L2-T7a-M159",
    "guard": "site: the fonts outside env.ts are caught",
    "file": "src/enhance/editorial.ts",
    "old": "  const doc = root.ownerDocument;\n\n  // ── 0.",
    "new": "  const doc = root.ownerDocument;\n  void doc.fonts;\n\n  // ── 0.",
    "tests": "test/enhance-walls.test.ts"
  },
  {
    "id": "L2-T7a-M160",
    "guard": "site: a timer on an event's window is caught",
    "file": "src/enhance/scroll.ts",
    "old": "  void ctx;\n",
    "new": "  void ctx;\n  void ((ctx as unknown as { e: UIEvent }).e.view?.setTimeout);\n",
    "tests": "test/enhance-walls.test.ts"
  },
  {
    "id": "L2-T7a-M161",
    "guard": "pack: a dashed module name may be packed",
    "file": "test/pack.test.ts",
    "old": "/^dist\\/(?:render|conformance|enhance)\\/[A-Za-z]+(?:-[a-z]+)*\\.(?:js|d\\.ts)$/",
    "new": "/^dist\\/(?:render|conformance|enhance)\\/[A-Za-z]+\\.(?:js|d\\.ts)$/",
    "tests": "test/pack.test.ts"
  }
]
```

## Visual check

Task 7a builds no visible part: its check is that the demo is pixel-identical to the demo before it. The demo
(`scripts/demo/build.mjs`, the core sample) was built from the branch's parent, before any change of this task, and
again from its final code; `scripts/visual/compare.mjs --offline` compared the two at 1440×1000 and 390×844, in light,
dark and sans with wide. In each of the six combinations, 48 blocks are in both pages, with 0 differences in any box
or computed value, and the two full-page screenshots are byte-identical (the same sha256 for each pair). The
comparison with the reference layout is not repeated here: Task 6's report stands, since nothing it measures moved.

