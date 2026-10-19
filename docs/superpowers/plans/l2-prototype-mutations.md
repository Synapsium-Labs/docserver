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

The stylesheet scoping check is the sibling task's (`test/enhance-styles.test.ts`) and is not measured here.

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
