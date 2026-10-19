# L2 prototype: mutation rows (lifecycle core and folds)

Each guard of `src/enhance` (lifecycle, journal, state, options, folds) and of its static walls, deleted or inverted once, with
the test that goes red. Measured 2026-10-19 on branch `l2-prototype`, against the working tree that the lifecycle
commit records.

**Method.** The L1 plan's `mutate.mjs` (Task 1, Step 8), unchanged except that it prints only the failing test names
and the count line: each row is applied to its own throwaway copy of the working tree (tracked and untracked files,
never ignored ones, `node_modules` linked from the checkout), its test file runs there with the local `vitest`, and the
copy is deleted. Each `old` occurs exactly once in its file. The checkout was never edited: `git status --porcelain`
read the same before and after. All 25 rows went red (`rc=1`), the run exited 0.

Two rows stayed green on the first run and were made red by new tests, not by changing the guard: L2P-M8 (the class
restore rule only differs from "restore the original" when the library's last write equals the original, so the test
folds, unfolds, then lets the host add the class) and L2P-M21 (a second destroy at depth 0 is answered by the
post-teardown memo, so the knot test now calls destroy twice inside the action).

The stylesheet scoping check is the sibling task's (`test/enhance-styles.test.ts`) and is not measured here; its rows are
L2P-M78 to L2P-M82, measured with the review fixes (the last section).

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2P-M1 | ownership: another options object on the same root | `src/enhance/lifecycle.ts` | `return Promise.reject(new EnhanceError('ownership', 'docreader: this root is already enhanced, with other o…` → `return other.promise;` | `test/enhance-lifecycle.test.ts`: 1 failed \| 35 passed (36). "a different options object rejects ownership, and so does {} against omitted" |
| L2P-M2 | ownership: an enhanced root contains the new one | `src/enhance/lifecycle.ts` | `return a.contains(b) \|\| b.contains(a);` → `return b.contains(a);` | `test/enhance-lifecycle.test.ts`: 1 failed \| 35 passed (36). "an enhanced root that contains this one rejects ownership" |
| L2P-M3 | ownership: an enhanced root lies inside the new one | `src/enhance/lifecycle.ts` | `return a.contains(b) \|\| b.contains(a);` → `return a.contains(b);` | `test/enhance-lifecycle.test.ts`: 1 failed \| 35 passed (36). "an enhanced root inside this one rejects ownership" |
| L2P-M4 | same identity returns the stored promise | `src/enhance/lifecycle.ts` | `if (other.identity === options) return other.promise;` → `if (other.identity === options) return other.promise.then(() => undefined);` | `test/enhance-lifecycle.test.ts`: 3 failed \| 33 passed (36). "the same options object returns the same promise, while initializing and once active"; "omitted options twice (or undefined) share one identity: the same promise"; "enhance called back from a startup hook with the same options gets the original promise" |
| L2P-M5 | generation check after a call-out (fold write-behind) | `src/enhance/folds.ts` | `if (!ctx.live()) return; // the host's set() ran: it may have destroyed the instance` → `(deleted)` | `test/enhance-lifecycle.test.ts`: 1 failed \| 35 passed (36). "no write follows the destroy call, the teardown runs as the action unwinds, and destroy resolves after it with the subtree restored" |
| L2P-M6 | deferred teardown while an operation is on the stack | `src/enhance/lifecycle.ts` | `if (inst.depth > 0) inst.teardownPending = true; ⏎   else teardown(inst);` → `teardown(inst);` | `test/enhance-lifecycle.test.ts`: 3 failed \| 33 passed (36). "a storage hook that destroys mid-startup: teardown waits for the startup operation, then both promises settle after it"; "an abort while waiting for that teardown rejects aborted and writes nothing"; "no write follows the destroy call, the teardown runs as the action unwinds, and destroy resolves after it with the subtree restored" |
| L2P-M7 | conditional restore: attribute | `src/enhance/journal.ts` | `if (el.getAttribute(name) !== r.last) return; // the host changed it since: the host wins` → `(deleted)` | `test/enhance-lifecycle.test.ts`: 1 failed \| 35 passed (36). "an attribute the host changed after the library wrote it keeps the host value" |
| L2P-M8 | conditional restore: class | `src/enhance/journal.ts` | `if (el.classList.contains(cls) !== r.last) return; // the host changed it since: the host wins` → `(deleted)` | `test/enhance-lifecycle.test.ts`: 1 failed \| 35 passed (36). "a class the library put back as it was, then the host changed, keeps the host value" |
| L2P-M9 | conditional restore: a node the host put in a wrapper | `src/enhance/journal.ts` | `while (wrapper.firstChild !== null) at.insertBefore(wrapper.firstChild, wrapper);` → `for (const n of nodes) at.insertBefore(n, wrapper);` | `test/enhance-lifecycle.test.ts`: 1 failed \| 35 passed (36). "wrap moves a run into the wrapper; undo puts it back, with a node the host inserted inside kept in place" |
| L2P-M10 | CSP wall: the banned list (wall weakened) | `test/enhance-walls.test.ts` | `'innerHTML', 'outerHTML', 'insertAdjacentHTML', 'eval', 'Function', 'cssText',` → `'outerHTML', 'insertAdjacentHTML', 'eval', 'Function', 'cssText',` | `test/enhance-walls.test.ts`: 1 failed \| 6 passed (7). "the scan reads code, not comments or strings, and sees each banned shape" |
| L2P-M11 | CSP wall: an HTML-string sink planted in src/enhance | `src/enhance/editorial.ts` | `ctx.journal.setAttribute(ctx.root, 'data-docreader-root', '');` → `ctx.journal.setAttribute(ctx.root, 'data-docreader-root', ''); ⏎   ctx.root.insertAdjacentHTML('beforeend',…` | `test/enhance-walls.test.ts`: 1 failed \| 6 passed (7). "no source file names a forbidden identifier, a selector with # or built at run time, or a style string" |
| L2P-M12 | id-lookup wall: a # selector planted in src/enhance | `src/enhance/folds.ts` | `const doc = root.ownerDocument;` → `const doc = root.ownerDocument; ⏎   root.querySelector('#top');` | `test/enhance-walls.test.ts`: 1 failed \| 6 passed (7). "no source file names a forbidden identifier, a selector with # or built at run time, or a style string" |
| L2P-M13 | import inertness: a top-level effect planted | `src/enhance/lifecycle.ts` | `let registry: WeakMap<Document, Set<Instance>> \| undefined;` → `let registry: WeakMap<Document, Set<Instance>> \| undefined = new WeakMap();` | `test/enhance-walls.test.ts`: 1 failed \| 6 passed (7). "no source file runs code at its top level" |
| L2P-M14 | invalid-options: unknown keys refused before reserving | `src/enhance/options.ts` | `checkKeys('options', options, OPTION_KEYS);` → `(deleted)` | `test/enhance-lifecycle.test.ts`: 1 failed \| 35 passed (36). "bad options reject invalid-options and reserve nothing: the root is untouched, and enhance(root) then works" |
| L2P-M15 | write-behind: one call per key in flight | `src/enhance/state.ts` | `if (slot.busy) slot.waiting = { value }; ⏎     else issue(key, slot, value);` → `issue(key, slot, value);` | `test/enhance-state.test.ts`: 3 failed \| 22 passed (25). "per key: a newer value waits for the pending call, and only the newest waiting value is sent"; "an older slow value never lands after a newer one, though the newer is quicker"; "once destroyed, no new call is issued: a waiting value is dropped when the pending one completes" |
| L2P-M16 | journal refuses writes once not live | `src/enhance/journal.ts` | `setAttribute(el, name, value) { ⏎       if (!live()) return;` → `setAttribute(el, name, value) {` | `test/enhance-lifecycle.test.ts`: 1 failed \| 35 passed (36). "every write refuses once the instance is not live" |
| L2P-M17 | folds: an author's own hidden block is left alone | `src/enhance/folds.ts` | `if (!m.hasAttribute('hidden')) {` → `if (m.localName !== '') {` | `test/enhance-folds.test.ts`: 1 failed \| 12 passed (13). "an author's own hidden block is never touched: not on fold, not on unfold, not on destroy" |
| L2P-M18 | destroy during startup rejects aborted | `src/enhance/lifecycle.ts` | `throw new EnhanceError('aborted', 'docreader: destroyed during startup', { cause });` → `return;` | `test/enhance-lifecycle.test.ts`: 3 failed \| 33 passed (36). "an abort from a storage read mid-startup: enhance rejects aborted after the rollback, with the subtree restored"; "a storage hook that destroys mid-startup: teardown waits for the startup operation, then both promises settle after it"; "an abort while waiting for that teardown rejects aborted and writes nothing" |
| L2P-M19 | abort signal listened to during startup | `src/enhance/lifecycle.ts` | `signal?.addEventListener('abort', onAbort);` → `(deleted)` | `test/enhance-lifecycle.test.ts`: 3 failed \| 33 passed (36). "an abort from a storage read mid-startup: enhance rejects aborted after the rollback, with the subtree restored"; "a host signal that throws when listened to rejects initialization and releases the root"; "an abort while waiting for that teardown rejects aborted and writes nothing" |
| L2P-M20 | already-aborted signal refused before reserving | `src/enhance/lifecycle.ts` | `if (opts.signal?.aborted === true) {` → `if (opts.signal?.aborted === 'never') {` | `test/enhance-lifecycle.test.ts`: 1 failed \| 35 passed (36). "an already aborted signal rejects aborted and reserves nothing" |
| L2P-M21 | repeated destroy: same promise while tearing down | `src/enhance/lifecycle.ts` | `if (inst.destroyed !== null) return inst.destroyed;` → `(deleted)` | `test/enhance-lifecycle.test.ts`: 1 failed \| 35 passed (36). "no write follows the destroy call, the teardown runs as the action unwinds, and destroy resolves after it with the subtree restored" |
| L2P-M22 | repeated destroy: same promise after the teardown | `src/enhance/lifecycle.ts` | `return lastDestroy?.get(root) ?? Promise.resolve();` → `return Promise.resolve();` | `test/enhance-lifecycle.test.ts`: 1 failed \| 35 passed (36). "repeated calls return the same promise, before and after the teardown" |
| L2P-M23 | startup rollback before any rejection (a host signal that throws) | `src/enhance/lifecycle.ts` | `await settled(destroyInstance(inst)); ⏎     throw e instanceof EnhanceError` → `throw e instanceof EnhanceError` | `test/enhance-lifecycle.test.ts`: 1 failed \| 35 passed (36). "a host signal that throws when listened to rejects initialization and releases the root" |
| L2P-M24 | prefs precedence: explicit over stored | `src/enhance/state.ts` | `prefs = { ...prefs, ...explicit };` → `prefs = { ...explicit, ...prefs };` | `test/enhance-state.test.ts`: 2 failed \| 23 passed (25). "explicit options.prefs override stored ones, field by field"; "explicit options.prefs are not written back; only what changes later is" |
| L2P-M25 | invalid stored JSON ignored, never thrown | `src/enhance/state.ts` | `return JSON.parse(raw) as unknown; ⏎   } catch { ⏎     return undefined; ⏎   }` → `return JSON.parse(raw) as unknown; ⏎   } finally { ⏎     // no catch ⏎   }` | `test/enhance-state.test.ts`: 2 failed \| 23 passed (25). "prefs that are not JSON"; "folds that are not JSON" |

## The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2P-M1",
    "guard": "ownership: another options object on the same root",
    "file": "src/enhance/lifecycle.ts",
    "old": "      return Promise.reject(new EnhanceError('ownership', 'docreader: this root is already enhanced, with other options'));",
    "new": "      return other.promise;",
    "tests": "test/enhance-lifecycle.test.ts"
  },
  {
    "id": "L2P-M2",
    "guard": "ownership: an enhanced root contains the new one",
    "file": "src/enhance/lifecycle.ts",
    "old": "  return a.contains(b) || b.contains(a);",
    "new": "  return b.contains(a);",
    "tests": "test/enhance-lifecycle.test.ts"
  },
  {
    "id": "L2P-M3",
    "guard": "ownership: an enhanced root lies inside the new one",
    "file": "src/enhance/lifecycle.ts",
    "old": "  return a.contains(b) || b.contains(a);",
    "new": "  return a.contains(b);",
    "tests": "test/enhance-lifecycle.test.ts"
  },
  {
    "id": "L2P-M4",
    "guard": "same identity returns the stored promise",
    "file": "src/enhance/lifecycle.ts",
    "old": "      if (other.identity === options) return other.promise;",
    "new": "      if (other.identity === options) return other.promise.then(() => undefined);",
    "tests": "test/enhance-lifecycle.test.ts"
  },
  {
    "id": "L2P-M5",
    "guard": "generation check after a call-out (fold write-behind)",
    "file": "src/enhance/folds.ts",
    "old": "    if (!ctx.live()) return; // the host's set() ran: it may have destroyed the instance\n",
    "new": "",
    "tests": "test/enhance-lifecycle.test.ts"
  },
  {
    "id": "L2P-M6",
    "guard": "deferred teardown while an operation is on the stack",
    "file": "src/enhance/lifecycle.ts",
    "old": "  if (inst.depth > 0) inst.teardownPending = true;\n  else teardown(inst);",
    "new": "  teardown(inst);",
    "tests": "test/enhance-lifecycle.test.ts"
  },
  {
    "id": "L2P-M7",
    "guard": "conditional restore: attribute",
    "file": "src/enhance/journal.ts",
    "old": "          if (el.getAttribute(name) !== r.last) return; // the host changed it since: the host wins\n",
    "new": "",
    "tests": "test/enhance-lifecycle.test.ts"
  },
  {
    "id": "L2P-M8",
    "guard": "conditional restore: class",
    "file": "src/enhance/journal.ts",
    "old": "          if (el.classList.contains(cls) !== r.last) return; // the host changed it since: the host wins\n",
    "new": "",
    "tests": "test/enhance-lifecycle.test.ts"
  },
  {
    "id": "L2P-M9",
    "guard": "conditional restore: a node the host put in a wrapper",
    "file": "src/enhance/journal.ts",
    "old": "        while (wrapper.firstChild !== null) at.insertBefore(wrapper.firstChild, wrapper);",
    "new": "        for (const n of nodes) at.insertBefore(n, wrapper);",
    "tests": "test/enhance-lifecycle.test.ts"
  },
  {
    "id": "L2P-M10",
    "guard": "CSP wall: the banned list (wall weakened)",
    "file": "test/enhance-walls.test.ts",
    "old": "  'innerHTML', 'outerHTML', 'insertAdjacentHTML', 'eval', 'Function', 'cssText',",
    "new": "  'outerHTML', 'insertAdjacentHTML', 'eval', 'Function', 'cssText',",
    "tests": "test/enhance-walls.test.ts"
  },
  {
    "id": "L2P-M11",
    "guard": "CSP wall: an HTML-string sink planted in src/enhance",
    "file": "src/enhance/editorial.ts",
    "old": "  ctx.journal.setAttribute(ctx.root, 'data-docreader-root', '');",
    "new": "  ctx.journal.setAttribute(ctx.root, 'data-docreader-root', '');\n  ctx.root.insertAdjacentHTML('beforeend', '');",
    "tests": "test/enhance-walls.test.ts"
  },
  {
    "id": "L2P-M12",
    "guard": "id-lookup wall: a # selector planted in src/enhance",
    "file": "src/enhance/folds.ts",
    "old": "  const doc = root.ownerDocument;",
    "new": "  const doc = root.ownerDocument;\n  root.querySelector('#top');",
    "tests": "test/enhance-walls.test.ts"
  },
  {
    "id": "L2P-M13",
    "guard": "import inertness: a top-level effect planted",
    "file": "src/enhance/lifecycle.ts",
    "old": "let registry: WeakMap<Document, Set<Instance>> | undefined;",
    "new": "let registry: WeakMap<Document, Set<Instance>> | undefined = new WeakMap();",
    "tests": "test/enhance-walls.test.ts"
  },
  {
    "id": "L2P-M14",
    "guard": "invalid-options: unknown keys refused before reserving",
    "file": "src/enhance/options.ts",
    "old": "  checkKeys('options', options, OPTION_KEYS);\n",
    "new": "",
    "tests": "test/enhance-lifecycle.test.ts"
  },
  {
    "id": "L2P-M15",
    "guard": "write-behind: one call per key in flight",
    "file": "src/enhance/state.ts",
    "old": "    if (slot.busy) slot.waiting = { value };\n    else issue(key, slot, value);",
    "new": "    issue(key, slot, value);",
    "tests": "test/enhance-state.test.ts"
  },
  {
    "id": "L2P-M16",
    "guard": "journal refuses writes once not live",
    "file": "src/enhance/journal.ts",
    "old": "    setAttribute(el, name, value) {\n      if (!live()) return;\n",
    "new": "    setAttribute(el, name, value) {\n",
    "tests": "test/enhance-lifecycle.test.ts"
  },
  {
    "id": "L2P-M17",
    "guard": "folds: an author's own hidden block is left alone",
    "file": "src/enhance/folds.ts",
    "old": "        if (!m.hasAttribute('hidden')) {",
    "new": "        if (m.localName !== '') {",
    "tests": "test/enhance-folds.test.ts"
  },
  {
    "id": "L2P-M18",
    "guard": "destroy during startup rejects aborted",
    "file": "src/enhance/lifecycle.ts",
    "old": "      throw new EnhanceError('aborted', 'docreader: destroyed during startup', { cause });",
    "new": "      return;",
    "tests": "test/enhance-lifecycle.test.ts"
  },
  {
    "id": "L2P-M19",
    "guard": "abort signal listened to during startup",
    "file": "src/enhance/lifecycle.ts",
    "old": "    signal?.addEventListener('abort', onAbort);\n",
    "new": "",
    "tests": "test/enhance-lifecycle.test.ts"
  },
  {
    "id": "L2P-M20",
    "guard": "already-aborted signal refused before reserving",
    "file": "src/enhance/lifecycle.ts",
    "old": "  if (opts.signal?.aborted === true) {",
    "new": "  if (opts.signal?.aborted === 'never') {",
    "tests": "test/enhance-lifecycle.test.ts"
  },
  {
    "id": "L2P-M21",
    "guard": "repeated destroy: same promise while tearing down",
    "file": "src/enhance/lifecycle.ts",
    "old": "  if (inst.destroyed !== null) return inst.destroyed;\n",
    "new": "",
    "tests": "test/enhance-lifecycle.test.ts"
  },
  {
    "id": "L2P-M22",
    "guard": "repeated destroy: same promise after the teardown",
    "file": "src/enhance/lifecycle.ts",
    "old": "  return lastDestroy?.get(root) ?? Promise.resolve();",
    "new": "  return Promise.resolve();",
    "tests": "test/enhance-lifecycle.test.ts"
  },
  {
    "id": "L2P-M23",
    "guard": "startup rollback before any rejection (a host signal that throws)",
    "file": "src/enhance/lifecycle.ts",
    "old": "    await settled(destroyInstance(inst));\n    throw e instanceof EnhanceError",
    "new": "    throw e instanceof EnhanceError",
    "tests": "test/enhance-lifecycle.test.ts"
  },
  {
    "id": "L2P-M24",
    "guard": "prefs precedence: explicit over stored",
    "file": "src/enhance/state.ts",
    "old": "  prefs = { ...prefs, ...explicit };",
    "new": "  prefs = { ...explicit, ...prefs };",
    "tests": "test/enhance-state.test.ts"
  },
  {
    "id": "L2P-M25",
    "guard": "invalid stored JSON ignored, never thrown",
    "file": "src/enhance/state.ts",
    "old": "    return JSON.parse(raw) as unknown;\n  } catch {\n    return undefined;\n  }",
    "new": "    return JSON.parse(raw) as unknown;\n  } finally {\n    // no catch\n  }",
    "tests": "test/enhance-state.test.ts"
  }
]
```

## Editorial core (L2P-M26 to L2P-M41)

The guards of the editorial core (`src/enhance/editorial.ts`, `src/enhance/status.ts`) and of the two journal entries it
added (`move`, `split`), measured 2026-10-19 on branch `l2-prototype` with the same `mutate.mjs`, unchanged, against
the working tree that the editorial commit records. All 16 rows went red (`rc=1`), the run exited 0, and
`git status --porcelain` read the same before and after.

One row stayed green on the first run and was made red by a stronger test, not by changing the guard: L2P-M33 (a
meta line opening on `**Status:** Draft` never makes a lone bold label, so the test now adds `**Note:** · …`, whose
first part is the label alone). L2P-M27 is the row the node-level round trip exists for: with the join deleted, the
serialization after destroy is still identical, and only the comparison of node objects and their text goes red.

| Row | Guard | File | Change | Red (tests in `test/enhance-editorial.test.ts`) |
|---|---|---|---|---|
| L2P-M26 | journal.move: undo puts a moved node back in its place | `src/enhance/journal.ts` | `from.insertBefore(node, next); ⏎` → `(deleted)` | 2 failed \| 17 passed (19). "destroy restores the subtree exactly: the same nodes, with the same text, in the same order"; "split partitions a text node and undo joins it; move undo puts a node back in its place" |
| L2P-M27 | journal.split: undo joins the text again | `src/enhance/journal.ts` | `text.appendData(tail.data); ⏎ tail.parentNode?.removeChild(tail); ⏎` → `(deleted)` | 2 failed \| 17 passed (19). "destroy restores the subtree exactly: the same nodes, with the same text, in the same order"; "split partitions a text node and undo joins it; move undo puts a node back in its place" |
| L2P-M28 | journal.split: a host that moved the second half wins | `src/enhance/journal.ts` | `if (text.nextSibling !== tail) return; // the host moved one of them since: the host wins ⏎` → `(deleted)` | 1 failed \| 18 passed (19). "a split whose second half the host moved stays split: the host wins" |
| L2P-M29 | journal.move refuses once the instance is not live | `src/enhance/journal.ts` | `move(node, parent, before) { ⏎ if (!live()) return;` → `move(node, parent, before) {` | 1 failed \| 18 passed (19). "move does nothing and split throws once the instance is not live" |
| L2P-M30 | journal.split refuses once the instance is not live | `src/enhance/journal.ts` | `if (!live()) throw new Error('docreader: journal.split after a destroy'); ⏎` → `(deleted)` | 1 failed \| 18 passed (19). "move does nothing and split throws once the instance is not live" |
| L2P-M31 | meta line: a paragraph ending on a dangling label is left alone | `src/enhance/editorial.ts` | `if (/ · /.test(t) && !/:\s*$/.test(t)) return n;` → `if (/ · /.test(t)) return n;` | 1 failed \| 18 passed (19). "a paragraph that ends on a dangling label introduces a list, and is not a meta line" |
| L2P-M32 | meta line: hidden once its facts are in the byline | `src/enhance/editorial.ts` | `journal.setAttribute(metaP, 'hidden', ''); ⏎` → `(deleted)` | 1 failed \| 18 passed (19). "turns the meta line into a byline of facts, moving its own nodes, and hides what is left of it" |
| L2P-M33 | meta line: a leading label is a fact, not the kind | `src/enhance/editorial.ts` | `isStrong(lone ?? null) && lone !== undefined && !/:\s*$/.test(lone.textContent ?? '')` → `isStrong(lone ?? null) && lone !== undefined` | 1 failed \| 18 passed (19). "a meta line that opens on a label has no kind: its first fact is that label" |
| L2P-M34 | reading time: only from three minutes up | `src/enhance/editorial.ts` | `if (minutes >= 3) {` → `if (minutes >= 0) {` | 3 failed \| 16 passed (19). "a byline with only the reading time is solo; a short document without a meta line gets none"; "a paragraph that ends on a dangling label introduces a list, and is not a meta line"; "a meta line that opens on a label has no kind: its first fact is that label" |
| L2P-M35 | front-matter strip hidden only when the host gives info.frontList | `src/enhance/editorial.ts` | `if (given !== undefined) {` → `if (true) {` | 1 failed \| 18 passed (19). "without info, render()'s strip stays as it is, and there is no facts panel or front-matter kind" |
| L2P-M36 | byline after the hidden meta line (sibling rules see no hidden paragraph) | `src/enhance/editorial.ts` | `if (meta !== null && h1.nextElementSibling === meta) after = meta; ⏎` → `(deleted)` | 2 failed \| 17 passed (19). "turns the meta line into a byline of facts, moving its own nodes, and hides what is left of it"; "lists the front matter's list keys in a closed details after the byline, and hides render()'s strip" |
| L2P-M37 | "In short" moves into its box | `src/enhance/editorial.ts` | `if (short !== undefined) box(short, 'short', ['h1', 'h2', 'hr']);` → `(deleted)` | 2 failed \| 17 passed (19). "lists the front matter's list keys in a closed details after the byline, and hides render()'s strip"; ""In short" and its blocks move into a div.short, which gets no fold" |
| L2P-M38 | stand index only with two or more counts | `src/enhance/editorial.ts` | `counts.children.length > 1 &&` → `counts.children.length > 0 &&` | 1 failed \| 18 passed (19). "one callout with items gets no index" |
| L2P-M39 | section number: '. ' hidden | `src/enhance/editorial.ts` | `journal.wrap([sep], chrome(doc, 'span', { attrs: { hidden: '' } })); ⏎` → `(deleted)` | 1 failed \| 18 passed (19). "the number moves into a span.sec-no and ". " into a hidden span; the heading's text and name stay whole" |
| L2P-M40 | status marks: only a column that reads as a status column | `src/enhance/status.ts` | `if (!named && !asked && !short) return; ⏎` → `(deleted)` | 1 failed \| 18 passed (19). "a column that does not read as a status column gets no marks" |
| L2P-M41 | status marks: never the first column | `src/enhance/status.ts` | `if (ci === 0) return; ⏎` → `(deleted)` | 1 failed \| 18 passed (19). "short cells mostly opening on a status word mark a column whatever its header; the first column never" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2P-M26",
    "guard": "journal.move: undo puts a moved node back in its place",
    "file": "src/enhance/journal.ts",
    "old": "        from.insertBefore(node, next);\n",
    "new": "\n",
    "tests": "test/enhance-editorial.test.ts"
  },
  {
    "id": "L2P-M27",
    "guard": "journal.split: undo joins the text again",
    "file": "src/enhance/journal.ts",
    "old": "        text.appendData(tail.data);\n        tail.parentNode?.removeChild(tail);\n",
    "new": "\n",
    "tests": "test/enhance-editorial.test.ts"
  },
  {
    "id": "L2P-M28",
    "guard": "journal.split: a host that moved the second half wins",
    "file": "src/enhance/journal.ts",
    "old": "        if (text.nextSibling !== tail) return; // the host moved one of them since: the host wins\n",
    "new": "\n",
    "tests": "test/enhance-editorial.test.ts"
  },
  {
    "id": "L2P-M29",
    "guard": "journal.move refuses once the instance is not live",
    "file": "src/enhance/journal.ts",
    "old": "    move(node, parent, before) {\n      if (!live()) return;",
    "new": "    move(node, parent, before) {",
    "tests": "test/enhance-editorial.test.ts"
  },
  {
    "id": "L2P-M30",
    "guard": "journal.split refuses once the instance is not live",
    "file": "src/enhance/journal.ts",
    "old": "      if (!live()) throw new Error('docreader: journal.split after a destroy');\n",
    "new": "",
    "tests": "test/enhance-editorial.test.ts"
  },
  {
    "id": "L2P-M31",
    "guard": "meta line: a paragraph ending on a dangling label is left alone",
    "file": "src/enhance/editorial.ts",
    "old": "    if (/ · /.test(t) && !/:\\s*$/.test(t)) return n;",
    "new": "    if (/ · /.test(t)) return n;",
    "tests": "test/enhance-editorial.test.ts"
  },
  {
    "id": "L2P-M32",
    "guard": "meta line: hidden once its facts are in the byline",
    "file": "src/enhance/editorial.ts",
    "old": "    journal.setAttribute(metaP, 'hidden', '');\n",
    "new": "",
    "tests": "test/enhance-editorial.test.ts"
  },
  {
    "id": "L2P-M33",
    "guard": "meta line: a leading label is a fact, not the kind",
    "file": "src/enhance/editorial.ts",
    "old": "isStrong(lone ?? null) && lone !== undefined && !/:\\s*$/.test(lone.textContent ?? '')",
    "new": "isStrong(lone ?? null) && lone !== undefined",
    "tests": "test/enhance-editorial.test.ts"
  },
  {
    "id": "L2P-M34",
    "guard": "reading time: only from three minutes up",
    "file": "src/enhance/editorial.ts",
    "old": "  if (minutes >= 3) {",
    "new": "  if (minutes >= 0) {",
    "tests": "test/enhance-editorial.test.ts"
  },
  {
    "id": "L2P-M35",
    "guard": "front-matter strip hidden only when the host gives info.frontList",
    "file": "src/enhance/editorial.ts",
    "old": "  if (given !== undefined) {",
    "new": "  if (true) {",
    "tests": "test/enhance-editorial.test.ts"
  },
  {
    "id": "L2P-M36",
    "guard": "byline after the hidden meta line (sibling rules see no hidden paragraph)",
    "file": "src/enhance/editorial.ts",
    "old": "    if (meta !== null && h1.nextElementSibling === meta) after = meta;\n",
    "new": "",
    "tests": "test/enhance-editorial.test.ts"
  },
  {
    "id": "L2P-M37",
    "guard": "\"In short\" moves into its box",
    "file": "src/enhance/editorial.ts",
    "old": "  if (short !== undefined) box(short, 'short', ['h1', 'h2', 'hr']);",
    "new": "",
    "tests": "test/enhance-editorial.test.ts"
  },
  {
    "id": "L2P-M38",
    "guard": "stand index only with two or more counts",
    "file": "src/enhance/editorial.ts",
    "old": "counts.children.length > 1 &&",
    "new": "counts.children.length > 0 &&",
    "tests": "test/enhance-editorial.test.ts"
  },
  {
    "id": "L2P-M39",
    "guard": "section number: '. ' hidden",
    "file": "src/enhance/editorial.ts",
    "old": "    journal.wrap([sep], chrome(doc, 'span', { attrs: { hidden: '' } }));\n",
    "new": "",
    "tests": "test/enhance-editorial.test.ts"
  },
  {
    "id": "L2P-M40",
    "guard": "status marks: only a column that reads as a status column",
    "file": "src/enhance/status.ts",
    "old": "      if (!named && !asked && !short) return;\n",
    "new": "",
    "tests": "test/enhance-editorial.test.ts"
  },
  {
    "id": "L2P-M41",
    "guard": "status marks: never the first column",
    "file": "src/enhance/status.ts",
    "old": "      if (ci === 0) return;\n",
    "new": "",
    "tests": "test/enhance-editorial.test.ts"
  }
]
```

## Visual pass: tables that stack on a phone

Measured 2026-10-19 by hand (each change applied to `src/enhance/status.ts`, `test/enhance-tables.test.ts` run, the file
restored byte for byte and compared with `cmp`, then green again).

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2P-V1 | only a table of three or more columns stacks | `src/enhance/status.ts` | `if (heads.length < 3) return;` → deleted | `test/enhance-tables.test.ts`: 1 failed \| 1 passed (2). "a table of three columns takes the stack class and labels each cell; two columns stay a table" |
| L2P-V2 | the stack class goes through the journal | `src/enhance/status.ts` | `journal.toggleClass(wrapper, 'stack', true);` → `wrapper.classList.add('stack');` | `test/enhance-tables.test.ts`: 1 failed \| 1 passed (2). "destroy takes the class and the labels away again" |
| L2P-V3 | the cell labels go through the journal | `src/enhance/status.ts` | `journal.setAttribute(c, 'data-label', label);` → `c.setAttribute('data-label', label);` | `test/enhance-tables.test.ts`: 1 failed \| 1 passed (2). "destroy takes the class and the labels away again" |

## Review fixes (L2P-M42 to L2P-M88)

The guards that the review fixes added or changed (lifecycle, safety and visual), with the stylesheet's scoping check,
which the first table left to its sibling task, measured 2026-10-19 on branch `l2-prototype` with the same `mutate.mjs`,
unchanged, against the working tree that the review-fix commits record. All 47 rows went red (`rc=1`) in four
foreground runs (21 rows, 21 rows, the 3 `test/pack.test.ts` rows, and the 5 write-behind rows L2P-M42 to L2P-M44,
L2P-M87 and L2P-M88, measured again after the last fix commit changed how stored prefs merge), each run exited 0, and
`git status --porcelain` read the same before and after each run.

Rows that weaken a test's own check (L2P-M58, L2P-M59, L2P-M64, L2P-M65, L2P-M81) go red on that test's probe, as L2P-M10
does; rows that plant a violation in the shipped tree (L2P-M60 to L2P-M63, L2P-M76, L2P-M78 to L2P-M80, L2P-M82) go red on
the scan of the shipped files, as L2P-M11 does. L2P-M69 reports one skipped test: a copy has no `.git`, so the
tracked-path case skips there, as its own condition says.

Five guards were right before the review and only lacked a red case: L2P-M53 to L2P-M57 (the abort listener removed once
startup ends, the registry releasing a torn-down instance, the destroy promise's own rejection handler, and the two print
conditions). Their tests are new; the guards are unchanged. The scoping rows are L2P-M78 to L2P-M82.

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2P-M42 | write-behind: the slot is claimed before set() is called (a nested write waits) | `src/enhance/state.ts` | `slot.busy = true; ⏎ let result: unknown; ⏎ try { ⏎ result = writer.set(key, value);` → `let result: unknown; ⏎ try { ⏎ result = writer.set(key, value); ⏎ slot.busy = true;` | `test/enhance-state.test.ts`: 1 failed \| 28 passed (29). "a set() that calls back into the reader queues the nested write: the older value lands first" |
| L2P-M43 | write-behind: one queue per storage object, shared by every instance given it | `src/enhance/state.ts` | `const slot = slotOf(storage, key);` → `const slot = slotOf(writer, key);` | `test/enhance-state.test.ts`: 3 failed \| 26 passed (29). "two roots on one storage object: each write keeps the fields the other wrote"; "a successor on the same storage object waits for its predecessor's pending call"; "a later instance merges with a write still in flight when it started, but not with one its snapshot holds" |
| L2P-M44 | write-behind: a change is merged with a newer value another instance queued on that storage object | `src/enhance/state.ts` | `if (prefsSlot !== null && prefsSlot.queued > seenLanded && typeof prefsSlot.latest === 'string') {` → `if (prefsSlot !== null && prefsSlot.queued < 0 && typeof prefsSlot.latest === 'string') {` | `test/enhance-state.test.ts`: 2 failed \| 27 passed (29). "two roots on one storage object: each write keeps the fields the other wrote"; "a later instance merges with a write still in flight when it started, but not with one its snapshot holds" |
| L2P-M45 | ownership checked again after the options are read | `src/enhance/lifecycle.ts` | `const takenSince = claimed(root, options); ⏎ if (takenSince !== null) return takenSince;` → `(deleted)` | `test/enhance-lifecycle.test.ts`: 1 failed \| 42 passed (43). "host code run while the options are read cannot make a second owner: the outer call rejects ownership" |
| L2P-M46 | a root is found by itself, wherever it moved (not by its current document) | `src/enhance/lifecycle.ts` | `const on = byRoot?.get(root as Element);` → `const on = new Set(Array.from(registry?.get((root as Element).ownerDocument as Document) ?? []).filter((i) => …` | `test/enhance-lifecycle.test.ts`: 1 failed \| 42 passed (43). "a root moved to another document is still its instance's: enhance refuses a second owner, destroy tears it down" |
| L2P-M47 | ownership: an enhanced ancestor is found through the new root's ancestors | `src/enhance/lifecycle.ts` | `for (let n: Node \| null = root.parentNode; n !== null; n = n.parentNode) { ⏎ const up = findByRoot(n); ⏎ if (u…` → `(deleted)` | `test/enhance-lifecycle.test.ts`: 1 failed \| 42 passed (43). "a root moved to another document is still its instance's: enhance refuses a second owner, destroy tears it down" |
| L2P-M48 | prefs set before the state exists are applied once it does | `src/enhance/lifecycle.ts` | `if (pending !== null) { ⏎ state.setPrefs(pending); // may call the host's set() ⏎ if (!live()) return; ⏎ }` → `(deleted)` | `test/enhance-lifecycle.test.ts`: 1 failed \| 42 passed (43). "prefs set while startup waits for an earlier teardown apply once it builds" |
| L2P-M49 | options: inherited properties are never read | `src/enhance/options.ts` | `for (const k of names) { ⏎ const d = Object.getOwnPropertyDescriptor(v, k);` → `for (const k of allowed) { ⏎ const d = { value: (v as Record<string, unknown>)[k] };` | `test/enhance-lifecycle.test.ts`: 1 failed \| 42 passed (43). "options are own data properties: an inherited key is not read, an unknown own key is refused, a getter is refused unread" |
| L2P-M50 | options: a getter is refused, unread | `src/enhance/options.ts` | `` if (!('value' in d)) throw invalid(`${where}.${k} must be a plain value, not a getter`); `` → `(deleted)` | `test/enhance-lifecycle.test.ts`: 1 failed \| 42 passed (43). "options are own data properties: an inherited key is not read, an unknown own key is refused, a getter is refused unread" |
| L2P-M51 | options: a non-enumerable own key is read and checked | `src/enhance/options.ts` | `const names = Object.getOwnPropertyNames(v);` → `const names = Object.keys(v);` | `test/enhance-lifecycle.test.ts`: 1 failed \| 42 passed (43). "options are own data properties: an inherited key is not read, an unknown own key is refused, a getter is refused unread" |
| L2P-M52 | journal.move undo: a node whose next sibling left still goes back into its parent | `src/enhance/journal.ts` | `from.insertBefore(node, prev !== null && prev.parentNode === from ? prev.nextSibling : null);` → `(deleted)` | `test/enhance-editorial.test.ts`: 2 failed \| 20 passed (22). "a moved node whose next sibling left goes back into its parent, after its old previous sibling, and says so"; "a host that merges the meta line's text nodes while enhanced loses none of its text on destroy" |
| L2P-M53 | an abort after enhance has resolved does nothing (the listener is removed) | `src/enhance/lifecycle.ts` | `signal?.removeEventListener('abort', onAbort);` → `void 0;` | `test/enhance-lifecycle.test.ts`: 1 failed \| 42 passed (43). "an abort after enhance has resolved does nothing: the layout stays and prefs still apply" |
| L2P-M54 | teardown releases the registry's hold on the instance | `src/enhance/lifecycle.ts` | `all.delete(inst);` → `(deleted)` | `test/enhance-lifecycle.test.ts`: 1 failed \| 42 passed (43). "teardown releases the registry's hold on the instance" |
| L2P-M55 | an unawaited cleanup fault is no unhandled rejection | `src/enhance/lifecycle.ts` | `destroyed.catch(() => undefined);` → `(deleted)` | `test/enhance-lifecycle.test.ts`: 1 failed \| 42 passed (43). "a cleanup fault nobody awaits is no unhandled rejection" |
| L2P-M56 | print: a block the host hid itself while folded stays hidden | `src/enhance/folds.ts` | `for (const m of s.hid) if (m.getAttribute('hidden') === 'until-found') journal.setAttribute(m, 'hidden', null)…` → `for (const m of s.hid) if (m.localName !== '') journal.setAttribute(m, 'hidden', null);` | `test/enhance-folds.test.ts`: 1 failed \| 14 passed (15). "a block the host hid itself while its section was folded stays hidden when printing starts" |
| L2P-M57 | print: a block the host hid while printing is not folded over | `src/enhance/folds.ts` | `for (const m of s.hid) if (!m.hasAttribute('hidden')) journal.setAttribute(m, 'hidden', 'until-found');` → `for (const m of s.hid) if (m.localName !== '') journal.setAttribute(m, 'hidden', 'until-found');` | `test/enhance-folds.test.ts`: 1 failed \| 14 passed (15). "a block the host hid while printing is not folded over when printing ends" |
| L2P-M58 | CSP wall: a string key is read like a dot (wall weakened) | `test/enhance-walls.test.ts` | `` if (banned.has(key.text) \|\| members.has(key.text)) at(key, `['${key.text}']`); `` → `void key;` | `test/enhance-walls.test.ts`: 1 failed \| 10 passed (11). "the scan sees string keys, keys built at run time, page members, URL and handler attributes, and id matches" |
| L2P-M59 | CSP wall: a member name built from strings (wall weakened) | `test/enhance-walls.test.ts` | `} else if (builtString(key)) at(key, '[<member built at run time>]');` → `}` | `test/enhance-walls.test.ts`: 1 failed \| 10 passed (11). "the scan sees string keys, keys built at run time, page members, URL and handler attributes, and id matches" |
| L2P-M60 | CSP wall: a page member (.body) planted in src/enhance | `src/enhance/editorial.ts` | `const { root, journal } = ctx; ⏎ const doc = root.ownerDocument;` → `const { root, journal } = ctx; ⏎ const doc = root.ownerDocument; ⏎ void doc.body;` | `test/enhance-walls.test.ts`: 1 failed \| 10 passed (11). "no source file names a forbidden identifier, a selector with # or built at run time, or a style string" |
| L2P-M61 | CSP wall: the root's window used at a second site | `src/enhance/folds.ts` | `const view = doc.defaultView;` → `const view = doc.defaultView; ⏎ void doc.defaultView;` | `test/enhance-walls.test.ts`: 2 failed \| 9 passed (11). "no source file names a forbidden identifier, a selector with # or built at run time, or a style string"; "the one allowed site is used exactly as allowed, so the exception cannot widen unseen" |
| L2P-M62 | CSP wall: an inline-handler attribute planted in src/enhance | `src/enhance/editorial.ts` | `ctx.journal.setAttribute(ctx.root, 'data-docreader-root', '');` → `ctx.journal.setAttribute(ctx.root, 'data-docreader-root', ''); ⏎ ctx.journal.setAttribute(ctx.root, 'onclick',…` | `test/enhance-walls.test.ts`: 1 failed \| 10 passed (11). "no source file names a forbidden identifier, a selector with # or built at run time, or a style string" |
| L2P-M63 | globals wall: a DOM global no name list holds (a timer) planted in src/enhance | `src/enhance/folds.ts` | `const view = doc.defaultView;` → `setTimeout(() => undefined, 0); ⏎ const view = doc.defaultView;` | `test/enhance-walls.test.ts`: 1 failed \| 10 passed (11). "no source file names a DOM-library global beyond the language's own objects" |
| L2P-M64 | globals wall: the check itself (wall weakened) | `test/enhance-walls.test.ts` | `if (isGlobal && !GLOBALS.has(node.text)) {` → `if (isGlobal && GLOBALS.has('never')) {` | `test/enhance-walls.test.ts`: 1 failed \| 10 passed (11). "the global scan resolves names: a global is caught however it is named, a local of the same name is not" |
| L2P-M65 | id-lookup wall: an [id=...] selector (wall weakened) | `test/enhance-walls.test.ts` | `const ID_SELECTOR = /#\|\[\s*id\s*[~\|^$*]?=/i;` → `const ID_SELECTOR = /#/;` | `test/enhance-walls.test.ts`: 1 failed \| 10 passed (11). "the scan sees string keys, keys built at run time, page members, URL and handler attributes, and id matches" |
| L2P-M66 | status marks: a header names a status as a whole word | `src/enhance/status.ts` | `const STATUS_HEADER = /\b(?:status(?:es)?\|states?\|results?\|verdicts?\|outcomes?\|stands\|fate)\b/i;` → `const STATUS_HEADER = /status\|state\|result\|verdict\|outcome\|stands\|fate/i;` | `test/enhance-editorial.test.ts`: 1 failed \| 21 passed (22). "a header names a status as a whole word: Statement and Restated do not, Current status and States do" |
| L2P-M67 | package: the stylesheets keep their side effects | `package.json` | `"sideEffects": [ ⏎ "*.css" ⏎ ],` → `"sideEffects": false,` | `test/package.test.ts`: 1 failed \| 15 passed (16). "declares its modules free of side effects, but not its stylesheets" |
| L2P-M68 | fonts: each woff2 carries the sha256 its README records | `assets/fonts/README.md` | `` `f2ea9c12d2fe9bd3a9589b02ad2c0909da88f30938c91adc838c4f4098f9f9e0` `` → `` `02ea9c12d2fe9bd3a9589b02ad2c0909da88f30938c91adc838c4f4098f9f9e0` `` | `test/enhance-styles.test.ts`: 1 failed \| 17 passed (18). "every woff2 in assets/fonts is one the README lists, with the sha256 it records, and none is missing" |
| L2P-M69 | public-ready: only woff2 files directly in assets/fonts are left unread | `test/public-ready.test.ts` | `const SKIP_PATH = /^assets\/fonts\/[^/]+\.woff2$/;` → `const SKIP_PATH = /\.woff2$/;` | `test/public-ready.test.ts`: 1 failed \| 7 passed \| 1 skipped (9). "a woff2 is skipped only directly in assets/fonts: one anywhere else, or deeper, is scanned" |
| L2P-M70 | pack: THIRD-PARTY-NOTICES ships with the fonts | `package.json` | `"THIRD-PARTY-NOTICES",` → `(deleted)` | `test/pack.test.ts`: 1 failed \| 9 passed (10). "holds the three entries with their types, the corpus files, the licence, the readme, the assets and their notices" |
| L2P-M71 | consumer smoke: the assets resolve through ./assets/* to the installed files | `package.json` | `"./assets/*": "./assets/*",` → `"./assets/*": "./dist/*",` | `test/pack.test.ts`: 2 failed \| 8 passed (10). "passes the whole corpus through the consumer smoke"; "fails, naming the case, when the packed corpus does not pass" |
| L2P-M72 | consumer smoke: ./enhance imports in Node from the installed package | `package.json` | `"import": "./dist/enhance/index.js"` → `"import": "./dist/enhance/missing.js"` | `test/pack.test.ts`: 2 failed \| 8 passed (10). "passes the whole corpus through the consumer smoke"; "fails, naming the case, when the packed corpus does not pass" |
| L2P-M73 | tables: two columns take cols-2 | `src/enhance/status.ts` | `if (heads.length === 2) journal.toggleClass(wrapper, 'cols-2', true);` → `(deleted)` | `test/enhance-tables.test.ts`: 1 failed \| 4 passed (5). "a table of two columns keeps to the reading column: its wrapper takes cols-2, and only it" |
| L2P-M74 | tables: cols-2 goes through the journal | `src/enhance/status.ts` | `if (heads.length === 2) journal.toggleClass(wrapper, 'cols-2', true);` → `if (heads.length === 2) wrapper.classList.add('cols-2');` | `test/enhance-tables.test.ts`: 1 failed \| 4 passed (5). "destroy takes the class and the labels away again" |
| L2P-M75 | tables: a row whose only filled cell is the first is tr.group | `src/enhance/status.ts` | `if (first !== undefined && rest.length > 0 && txt(first) !== '' && rest.every((c) => txt(c) === '')) journal.t…` → `void first; ⏎ void rest;` | `test/enhance-tables.test.ts`: 1 failed \| 4 passed (5). "a body row whose only filled cell is the first is a group heading" |
| L2P-M76 | Mermaid: enhance never marks the root for the Mermaid feature | `src/enhance/editorial.ts` | `ctx.journal.setAttribute(ctx.root, 'data-docreader-root', '');` → `ctx.journal.setAttribute(ctx.root, 'data-docreader-root', ''); ⏎ ctx.journal.setAttribute(ctx.root, 'data-docr…` | `test/enhance-tables.test.ts`: 1 failed \| 4 passed (5). "a Mermaid figure keeps its source readable: enhance does not mark the root for the Mermaid feature" |
| L2P-M77 | stylesheet: the source under a diagram is hidden only on a marked root | `assets/reader.css` | `[data-docreader-root][data-docreader-root][data-docreader-mermaid]:not(i) figure.mermaid-figure pre.mermaid:no…` → `[data-docreader-root][data-docreader-root][data-docreader-root]:not(i) figure.mermaid-figure pre.mermaid:not([…` | `test/enhance-styles.test.ts`: 1 failed \| 17 passed (18). "hides a diagram's source only where the Mermaid feature has marked the root, so an unmarked root shows it" |
| L2P-M78 | scoping: a second selector of a list without the root | `assets/reader.css` | `[data-docreader-root] .h-mark:hover, ⏎ [data-docreader-root] .h-fold:hover {` → `[data-docreader-root] .h-mark:hover, ⏎ .h-fold:hover {` | `test/enhance-styles.test.ts`: 1 failed \| 17 passed (18). "the shipped sheet has no scope problem" |
| L2P-M79 | scoping: a selector inside the dark media block without the root | `assets/reader.css` | `[data-docreader-root]:not([data-theme="light"]) .codehilite .language-python .hljs-meta {` → `.codehilite .language-python .hljs-meta {` | `test/enhance-styles.test.ts`: 1 failed \| 17 passed (18). "the shipped sheet has no scope problem" |
| L2P-M80 | scoping: a sibling combinator leaves the root (planted in the sheet) | `assets/reader.css` | `[data-docreader-root] .fold-note[hidden] { display: none; }` → `[data-docreader-root] ~ .fold-note[hidden] { display: none; }` | `test/enhance-styles.test.ts`: 1 failed \| 17 passed (18). "the shipped sheet has no scope problem" |
| L2P-M81 | scoping: the sibling-combinator check itself (wall weakened) | `test/enhance-styles.test.ts` | `return rest === '' \|\| selector[i] === ' ' ? !/^[~+]/.test(rest) : rest.startsWith('>');` → `return true;` | `test/enhance-styles.test.ts`: 1 failed \| 17 passed (18). "flags a selector that leaves the root for its siblings, and passes one that stays on it or goes inside" |
| L2P-M82 | stylesheet: keyframes are docreader-prefixed | `assets/reader.css` | `@keyframes docreader-flow {` → `@keyframes doc-flow {` | `test/enhance-styles.test.ts`: 1 failed \| 17 passed (18). "the shipped sheet has no scope problem" |
| L2P-M83 | stylesheet: every custom property read is declared on the root | `assets/reader.css` | `--fig-w: initial; --thead-h: initial;` → `(deleted)` | `test/enhance-styles.test.ts`: 1 failed \| 17 passed (18). "reads no custom property it does not declare, so none inherits in from the host page" |
| L2P-M84 | stylesheet: every @font-face family is the library's own | `assets/reader.css` | `font-family: "Docreader Sans"; font-style: italic;` → `font-family: "Source Sans 3"; font-style: italic;` | `test/enhance-styles.test.ts`: 1 failed \| 17 passed (18). "every @font-face family is the library's own (Docreader ...), so no host face of the same name is taken over" |
| L2P-M85 | stylesheet: no size in rem | `assets/reader.css` | `--measure: calc(44 * var(--rem)); /* about 80 characters of 18px serif */` → `--measure: 44rem; /* about 80 characters of 18px serif */` | `test/enhance-styles.test.ts`: 1 failed \| 17 passed (18). "sizes nothing in rem: rem follows the host page's html font-size, which the reader does not own" |
| L2P-M86 | stylesheet: the root's gutter is its own, not a percentage of its parent | `assets/reader.css` | `padding: 52px var(--pad) 96px; }` → `padding: 52px max(var(--pad), calc((100% - var(--wide)) / 2)) 96px; }` | `test/enhance-styles.test.ts`: 1 failed \| 17 passed (18). "pads the root by its own gutter, never by a percentage, which would be of the host's width" |
| L2P-M87 | write-behind: the snapshot wins over a value that had landed before it was read | `src/enhance/state.ts` | `const seenLanded = prefsSlot?.landed ?? 0;` → `const seenLanded = 0;` | `test/enhance-state.test.ts`: 1 failed \| 28 passed (29). "a later instance merges with a write still in flight when it started, but not with one its snapshot holds" |
| L2P-M88 | write-behind: each completed call counts as landed | `src/enhance/state.ts` | `slot.landed = Math.max(slot.landed, seq);` → `(deleted)` | `test/enhance-state.test.ts`: 1 failed \| 28 passed (29). "a later instance merges with a write still in flight when it started, but not with one its snapshot holds" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2P-M42",
    "guard": "write-behind: the slot is claimed before set() is called (a nested write waits)",
    "file": "src/enhance/state.ts",
    "old": "  slot.busy = true;\n  let result: unknown;\n  try {\n    result = writer.set(key, value);\n",
    "new": "  let result: unknown;\n  try {\n    result = writer.set(key, value);\n    slot.busy = true;\n",
    "tests": "test/enhance-state.test.ts"
  },
  {
    "id": "L2P-M43",
    "guard": "write-behind: one queue per storage object, shared by every instance given it",
    "file": "src/enhance/state.ts",
    "old": "    const slot = slotOf(storage, key);\n",
    "new": "    const slot = slotOf(writer, key);\n",
    "tests": "test/enhance-state.test.ts"
  },
  {
    "id": "L2P-M44",
    "guard": "write-behind: a change is merged with a newer value another instance queued on that storage object",
    "file": "src/enhance/state.ts",
    "old": "    if (prefsSlot !== null && prefsSlot.queued > seenLanded && typeof prefsSlot.latest === 'string') {",
    "new": "    if (prefsSlot !== null && prefsSlot.queued < 0 && typeof prefsSlot.latest === 'string') {",
    "tests": "test/enhance-state.test.ts"
  },
  {
    "id": "L2P-M45",
    "guard": "ownership checked again after the options are read",
    "file": "src/enhance/lifecycle.ts",
    "old": "  const takenSince = claimed(root, options);\n  if (takenSince !== null) return takenSince;\n",
    "new": "",
    "tests": "test/enhance-lifecycle.test.ts"
  },
  {
    "id": "L2P-M46",
    "guard": "a root is found by itself, wherever it moved (not by its current document)",
    "file": "src/enhance/lifecycle.ts",
    "old": "  const on = byRoot?.get(root as Element);\n",
    "new": "  const on = new Set(Array.from(registry?.get((root as Element).ownerDocument as Document) ?? []).filter((i) => i.root === root));\n",
    "tests": "test/enhance-lifecycle.test.ts"
  },
  {
    "id": "L2P-M47",
    "guard": "ownership: an enhanced ancestor is found through the new root's ancestors",
    "file": "src/enhance/lifecycle.ts",
    "old": "  for (let n: Node | null = root.parentNode; n !== null; n = n.parentNode) {\n    const up = findByRoot(n);\n    if (up !== undefined && isLive(up)) return refuse();\n  }\n",
    "new": "",
    "tests": "test/enhance-lifecycle.test.ts"
  },
  {
    "id": "L2P-M48",
    "guard": "prefs set before the state exists are applied once it does",
    "file": "src/enhance/lifecycle.ts",
    "old": "  if (pending !== null) {\n    state.setPrefs(pending); // may call the host's set()\n    if (!live()) return;\n  }\n",
    "new": "",
    "tests": "test/enhance-lifecycle.test.ts"
  },
  {
    "id": "L2P-M49",
    "guard": "options: inherited properties are never read",
    "file": "src/enhance/options.ts",
    "old": "  for (const k of names) {\n    const d = Object.getOwnPropertyDescriptor(v, k);\n",
    "new": "  for (const k of allowed) {\n    const d = { value: (v as Record<string, unknown>)[k] };\n",
    "tests": "test/enhance-lifecycle.test.ts"
  },
  {
    "id": "L2P-M50",
    "guard": "options: a getter is refused, unread",
    "file": "src/enhance/options.ts",
    "old": "    if (!('value' in d)) throw invalid(`${where}.${k} must be a plain value, not a getter`);\n",
    "new": "",
    "tests": "test/enhance-lifecycle.test.ts"
  },
  {
    "id": "L2P-M51",
    "guard": "options: a non-enumerable own key is read and checked",
    "file": "src/enhance/options.ts",
    "old": "  const names = Object.getOwnPropertyNames(v);\n",
    "new": "  const names = Object.keys(v);\n",
    "tests": "test/enhance-lifecycle.test.ts"
  },
  {
    "id": "L2P-M52",
    "guard": "journal.move undo: a node whose next sibling left still goes back into its parent",
    "file": "src/enhance/journal.ts",
    "old": "        from.insertBefore(node, prev !== null && prev.parentNode === from ? prev.nextSibling : null);\n",
    "new": "",
    "tests": "test/enhance-editorial.test.ts"
  },
  {
    "id": "L2P-M53",
    "guard": "an abort after enhance has resolved does nothing (the listener is removed)",
    "file": "src/enhance/lifecycle.ts",
    "old": "    signal?.removeEventListener('abort', onAbort);",
    "new": "    void 0;",
    "tests": "test/enhance-lifecycle.test.ts"
  },
  {
    "id": "L2P-M54",
    "guard": "teardown releases the registry's hold on the instance",
    "file": "src/enhance/lifecycle.ts",
    "old": "    all.delete(inst);\n",
    "new": "",
    "tests": "test/enhance-lifecycle.test.ts"
  },
  {
    "id": "L2P-M55",
    "guard": "an unawaited cleanup fault is no unhandled rejection",
    "file": "src/enhance/lifecycle.ts",
    "old": "  destroyed.catch(() => undefined);\n",
    "new": "",
    "tests": "test/enhance-lifecycle.test.ts"
  },
  {
    "id": "L2P-M56",
    "guard": "print: a block the host hid itself while folded stays hidden",
    "file": "src/enhance/folds.ts",
    "old": "        for (const m of s.hid) if (m.getAttribute('hidden') === 'until-found') journal.setAttribute(m, 'hidden', null);",
    "new": "        for (const m of s.hid) if (m.localName !== '') journal.setAttribute(m, 'hidden', null);",
    "tests": "test/enhance-folds.test.ts"
  },
  {
    "id": "L2P-M57",
    "guard": "print: a block the host hid while printing is not folded over",
    "file": "src/enhance/folds.ts",
    "old": "        for (const m of s.hid) if (!m.hasAttribute('hidden')) journal.setAttribute(m, 'hidden', 'until-found');",
    "new": "        for (const m of s.hid) if (m.localName !== '') journal.setAttribute(m, 'hidden', 'until-found');",
    "tests": "test/enhance-folds.test.ts"
  },
  {
    "id": "L2P-M58",
    "guard": "CSP wall: a string key is read like a dot (wall weakened)",
    "file": "test/enhance-walls.test.ts",
    "old": "        if (banned.has(key.text) || members.has(key.text)) at(key, `['${key.text}']`);\n",
    "new": "        void key;\n",
    "tests": "test/enhance-walls.test.ts"
  },
  {
    "id": "L2P-M59",
    "guard": "CSP wall: a member name built from strings (wall weakened)",
    "file": "test/enhance-walls.test.ts",
    "old": "      } else if (builtString(key)) at(key, '[<member built at run time>]');\n",
    "new": "      }\n",
    "tests": "test/enhance-walls.test.ts"
  },
  {
    "id": "L2P-M60",
    "guard": "CSP wall: a page member (.body) planted in src/enhance",
    "file": "src/enhance/editorial.ts",
    "old": "  const { root, journal } = ctx;\n  const doc = root.ownerDocument;\n",
    "new": "  const { root, journal } = ctx;\n  const doc = root.ownerDocument;\n  void doc.body;\n",
    "tests": "test/enhance-walls.test.ts"
  },
  {
    "id": "L2P-M61",
    "guard": "CSP wall: the root's window used at a second site",
    "file": "src/enhance/folds.ts",
    "old": "  const view = doc.defaultView;\n",
    "new": "  const view = doc.defaultView;\n  void doc.defaultView;\n",
    "tests": "test/enhance-walls.test.ts"
  },
  {
    "id": "L2P-M62",
    "guard": "CSP wall: an inline-handler attribute planted in src/enhance",
    "file": "src/enhance/editorial.ts",
    "old": "  ctx.journal.setAttribute(ctx.root, 'data-docreader-root', '');",
    "new": "  ctx.journal.setAttribute(ctx.root, 'data-docreader-root', '');\n  ctx.journal.setAttribute(ctx.root, 'onclick', '');",
    "tests": "test/enhance-walls.test.ts"
  },
  {
    "id": "L2P-M63",
    "guard": "globals wall: a DOM global no name list holds (a timer) planted in src/enhance",
    "file": "src/enhance/folds.ts",
    "old": "  const view = doc.defaultView;\n",
    "new": "  setTimeout(() => undefined, 0);\n  const view = doc.defaultView;\n",
    "tests": "test/enhance-walls.test.ts"
  },
  {
    "id": "L2P-M64",
    "guard": "globals wall: the check itself (wall weakened)",
    "file": "test/enhance-walls.test.ts",
    "old": "        if (isGlobal && !GLOBALS.has(node.text)) {",
    "new": "        if (isGlobal && GLOBALS.has('never')) {",
    "tests": "test/enhance-walls.test.ts"
  },
  {
    "id": "L2P-M65",
    "guard": "id-lookup wall: an [id=...] selector (wall weakened)",
    "file": "test/enhance-walls.test.ts",
    "old": "const ID_SELECTOR = /#|\\[\\s*id\\s*[~|^$*]?=/i;",
    "new": "const ID_SELECTOR = /#/;",
    "tests": "test/enhance-walls.test.ts"
  },
  {
    "id": "L2P-M66",
    "guard": "status marks: a header names a status as a whole word",
    "file": "src/enhance/status.ts",
    "old": "const STATUS_HEADER = /\\b(?:status(?:es)?|states?|results?|verdicts?|outcomes?|stands|fate)\\b/i;",
    "new": "const STATUS_HEADER = /status|state|result|verdict|outcome|stands|fate/i;",
    "tests": "test/enhance-editorial.test.ts"
  },
  {
    "id": "L2P-M67",
    "guard": "package: the stylesheets keep their side effects",
    "file": "package.json",
    "old": "  \"sideEffects\": [\n    \"*.css\"\n  ],\n",
    "new": "  \"sideEffects\": false,\n",
    "tests": "test/package.test.ts"
  },
  {
    "id": "L2P-M68",
    "guard": "fonts: each woff2 carries the sha256 its README records",
    "file": "assets/fonts/README.md",
    "old": "`f2ea9c12d2fe9bd3a9589b02ad2c0909da88f30938c91adc838c4f4098f9f9e0`",
    "new": "`02ea9c12d2fe9bd3a9589b02ad2c0909da88f30938c91adc838c4f4098f9f9e0`",
    "tests": "test/enhance-styles.test.ts"
  },
  {
    "id": "L2P-M69",
    "guard": "public-ready: only woff2 files directly in assets/fonts are left unread",
    "file": "test/public-ready.test.ts",
    "old": "const SKIP_PATH = /^assets\\/fonts\\/[^/]+\\.woff2$/;",
    "new": "const SKIP_PATH = /\\.woff2$/;",
    "tests": "test/public-ready.test.ts"
  },
  {
    "id": "L2P-M70",
    "guard": "pack: THIRD-PARTY-NOTICES ships with the fonts",
    "file": "package.json",
    "old": "    \"THIRD-PARTY-NOTICES\",\n",
    "new": "",
    "tests": "test/pack.test.ts"
  },
  {
    "id": "L2P-M71",
    "guard": "consumer smoke: the assets resolve through ./assets/* to the installed files",
    "file": "package.json",
    "old": "    \"./assets/*\": \"./assets/*\",",
    "new": "    \"./assets/*\": \"./dist/*\",",
    "tests": "test/pack.test.ts"
  },
  {
    "id": "L2P-M72",
    "guard": "consumer smoke: ./enhance imports in Node from the installed package",
    "file": "package.json",
    "old": "      \"import\": \"./dist/enhance/index.js\"",
    "new": "      \"import\": \"./dist/enhance/missing.js\"",
    "tests": "test/pack.test.ts"
  },
  {
    "id": "L2P-M73",
    "guard": "tables: two columns take cols-2",
    "file": "src/enhance/status.ts",
    "old": "  if (heads.length === 2) journal.toggleClass(wrapper, 'cols-2', true);\n",
    "new": "",
    "tests": "test/enhance-tables.test.ts"
  },
  {
    "id": "L2P-M74",
    "guard": "tables: cols-2 goes through the journal",
    "file": "src/enhance/status.ts",
    "old": "  if (heads.length === 2) journal.toggleClass(wrapper, 'cols-2', true);\n",
    "new": "  if (heads.length === 2) wrapper.classList.add('cols-2');\n",
    "tests": "test/enhance-tables.test.ts"
  },
  {
    "id": "L2P-M75",
    "guard": "tables: a row whose only filled cell is the first is tr.group",
    "file": "src/enhance/status.ts",
    "old": "    if (first !== undefined && rest.length > 0 && txt(first) !== '' && rest.every((c) => txt(c) === '')) journal.toggleClass(r, 'group', true);\n",
    "new": "    void first;\n    void rest;\n",
    "tests": "test/enhance-tables.test.ts"
  },
  {
    "id": "L2P-M76",
    "guard": "Mermaid: enhance never marks the root for the Mermaid feature",
    "file": "src/enhance/editorial.ts",
    "old": "  ctx.journal.setAttribute(ctx.root, 'data-docreader-root', '');",
    "new": "  ctx.journal.setAttribute(ctx.root, 'data-docreader-root', '');\n  ctx.journal.setAttribute(ctx.root, 'data-docreader-mermaid', '');",
    "tests": "test/enhance-tables.test.ts"
  },
  {
    "id": "L2P-M77",
    "guard": "stylesheet: the source under a diagram is hidden only on a marked root",
    "file": "assets/reader.css",
    "old": "[data-docreader-root][data-docreader-root][data-docreader-mermaid]:not(i) figure.mermaid-figure pre.mermaid:not([data-processed])",
    "new": "[data-docreader-root][data-docreader-root][data-docreader-root]:not(i) figure.mermaid-figure pre.mermaid:not([data-processed])",
    "tests": "test/enhance-styles.test.ts"
  },
  {
    "id": "L2P-M78",
    "guard": "scoping: a second selector of a list without the root",
    "file": "assets/reader.css",
    "old": "[data-docreader-root] .h-mark:hover,\n[data-docreader-root] .h-fold:hover {",
    "new": "[data-docreader-root] .h-mark:hover,\n.h-fold:hover {",
    "tests": "test/enhance-styles.test.ts"
  },
  {
    "id": "L2P-M79",
    "guard": "scoping: a selector inside the dark media block without the root",
    "file": "assets/reader.css",
    "old": "  [data-docreader-root]:not([data-theme=\"light\"]) .codehilite .language-python .hljs-meta {",
    "new": "  .codehilite .language-python .hljs-meta {",
    "tests": "test/enhance-styles.test.ts"
  },
  {
    "id": "L2P-M80",
    "guard": "scoping: a sibling combinator leaves the root (planted in the sheet)",
    "file": "assets/reader.css",
    "old": "[data-docreader-root] .fold-note[hidden] { display: none; }",
    "new": "[data-docreader-root] ~ .fold-note[hidden] { display: none; }",
    "tests": "test/enhance-styles.test.ts"
  },
  {
    "id": "L2P-M81",
    "guard": "scoping: the sibling-combinator check itself (wall weakened)",
    "file": "test/enhance-styles.test.ts",
    "old": "  return rest === '' || selector[i] === ' ' ? !/^[~+]/.test(rest) : rest.startsWith('>');",
    "new": "  return true;",
    "tests": "test/enhance-styles.test.ts"
  },
  {
    "id": "L2P-M82",
    "guard": "stylesheet: keyframes are docreader-prefixed",
    "file": "assets/reader.css",
    "old": "@keyframes docreader-flow {",
    "new": "@keyframes doc-flow {",
    "tests": "test/enhance-styles.test.ts"
  },
  {
    "id": "L2P-M83",
    "guard": "stylesheet: every custom property read is declared on the root",
    "file": "assets/reader.css",
    "old": "  --fig-w: initial; --thead-h: initial;\n",
    "new": "",
    "tests": "test/enhance-styles.test.ts"
  },
  {
    "id": "L2P-M84",
    "guard": "stylesheet: every @font-face family is the library's own",
    "file": "assets/reader.css",
    "old": "font-family: \"Docreader Sans\"; font-style: italic;",
    "new": "font-family: \"Source Sans 3\"; font-style: italic;",
    "tests": "test/enhance-styles.test.ts"
  },
  {
    "id": "L2P-M85",
    "guard": "stylesheet: no size in rem",
    "file": "assets/reader.css",
    "old": "  --measure: calc(44 * var(--rem)); /* about 80 characters of 18px serif */",
    "new": "  --measure: 44rem; /* about 80 characters of 18px serif */",
    "tests": "test/enhance-styles.test.ts"
  },
  {
    "id": "L2P-M86",
    "guard": "stylesheet: the root's gutter is its own, not a percentage of its parent",
    "file": "assets/reader.css",
    "old": "padding: 52px var(--pad) 96px; }",
    "new": "padding: 52px max(var(--pad), calc((100% - var(--wide)) / 2)) 96px; }",
    "tests": "test/enhance-styles.test.ts"
  },
  {
    "id": "L2P-M87",
    "guard": "write-behind: the snapshot wins over a value that had landed before it was read",
    "file": "src/enhance/state.ts",
    "old": "  const seenLanded = prefsSlot?.landed ?? 0;\n",
    "new": "  const seenLanded = 0;\n",
    "tests": "test/enhance-state.test.ts"
  },
  {
    "id": "L2P-M88",
    "guard": "write-behind: each completed call counts as landed",
    "file": "src/enhance/state.ts",
    "old": "  slot.landed = Math.max(slot.landed, seq);\n",
    "new": "",
    "tests": "test/enhance-state.test.ts"
  }
]
```
