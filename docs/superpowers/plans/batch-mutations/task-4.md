# Batch Task 4: mutation rows (`./host`: `mermaidDraw: 'after-ready'` and `loadMermaid`)

Each row was measured in place on branch `ws/docserver-release-1-1` by the batch method: the bytes of `src/host/mount.ts` saved with their sha256, one edit applied (rows B4f and B4j are two edits and a moved line), `test/host-mount.test.ts` run as `./node_modules/.bin/vitest run --maxWorkers=2 --reporter=json test/host-mount.test.ts` behind `timeout -k 10 600` and a `ulimit -u` of the measured thread count plus 1500, then the file restored from the saved bytes (`cp`) and its sha256 compared. The item is ledger C107. `src/host/mount.ts` is not bundled into a frame asset, so no generated output moved and no build ran. The record is the fix round's: every row was measured again on the tree of the fix-round commit, and again in fix round FR1 (review 1480, A2) at the tip of that round's behaviour half: 100 tests in the file, `src/host/mount.ts` restored to sha256 `a15dbfae176a…` after every row, red or green, equal each time. The counts, the red tests' titles and the restore sha256 below are those last measurements. The B4.10 case is titled as the fix round renamed it (a replaced or destroyed mount; it has no fallback case, which the first text of this record claimed).

Rows B4a to B4j are the brief's. B4c, B4g and B4n differ from their first wording, because the mount changed: the verdict is now held at `DocFrame` level with one reaction and a hook that reaches only the current mount, so a replaced mount is no longer reachable from the answer and the `live` guard of `post` is exercised by a destroy or update from inside an `onReady` adapter (B4.4b) instead; B4g is now "a mount that finds the verdict already known is not given it". Rows B4k to B4v cover every guard the implementation added beyond the brief's list: the cap check (B4k, red only through B4.9's assertion of the warning's reason, because the hash check would refuse an over-cap text too), the type check of `loadMermaid` in `'after-ready'` (B4l), `live` before asking (B4m), the slot filled before the source runs (B4n), the adoption into a fresh promise (B4o), the hook cleared when a mount stops (B4p, through a weak-reference case that proves a replaced or destroyed mount is not retained), the two contained console warnings (B4q, B4u), the contained post (B4r), and the `sent` flag, the try/catch around the checks and the hook cleared once used (B4s, B4t, B4v).

Verdicts. Every row but three went red through assertions in at least one named test (the Red column names each by its B4.x title). Rows B4e, B4j and B4o also fail some tests by a thrown error (a RangeError, a TypeError, or the loader's own exception escaping `mountDocFrame`), and each has an assertion-red test as well: B4e B4.0, B4j B4.9, B4o B4.9 and B4.5. Three rows stay green. B4s and B4v are reported as equivalent mutants; B4t is not reachable by any test input and is ruled kept as containment:

- B4s, the `sent` flag. `deliver` runs from `onReady`, which runs at most once per mount (a second `ready` is refused before it reaches `onReady`), and from the verdict hook, which runs at most once per DocFrame and only reaches a mount that is the current one. After a valid ready both entries cannot both post: the hook's call either comes before ready (nothing is posted) or after it (and `onReady` already ran, finding no answer). So `sent` never changes what is posted.
- B4t, the try/catch around the checks. Not reachable by any test input: the only throw inside the checks is an allocation failure while hashing an at-cap text; ruled kept as containment, not an equivalent mutant (ledger C107). A first run of this row lost its worker on the shared box (40 tests ran, 0 failed) and was run again (at that time the file held 81 tests: 81 passed); at FR1 it passed 100.
- B4v, clearing the hook once it is used. The hook runs once, for the current mount, which is then the only mount that holds it; a later update, destroy or fallback of that mount clears the hook through `stop` (B4p). What is retained between the answer and that stop is the current mount, which is live anyway.

## The rows (B4a to B4v)

| Row | Guard | File | Change | Red | Restore |
|---|---|---|---|---|---|
| B4a | post after ready | `src/host/mount.ts` | `if (!ready \|\| sent \|\| answer === null) return;` → `if (sent \|\| answer === null) return;` | `test/host-mount.test.ts`: 3 failed \| 97 passed (100). Red tests: B4.1, B4.4b, B4.5 | sha256 `a15dbfae176a…` restored, equal |
| B4b | hash check | `src/host/mount.ts` | `if (hex(sha256Text(text)) !== FRAME_MANIFEST.mermaid.sha256) return none('the build is not the shipped one');` → (removed) | `test/host-mount.test.ts`: 3 failed \| 97 passed (100). Red tests: B4.3, B4.5b, B4.9c | sha256 `a15dbfae176a…` restored, equal |
| B4c | replaced mount silent (post's live flag) | `src/host/mount.ts` | `if (live) port.postMessage(m);` → `port.postMessage(m);` | `test/host-mount.test.ts`: 1 failed \| 99 passed (100). Red tests: B4.4b | sha256 `a15dbfae176a…` restored, equal |
| B4d | a source is required | `src/host/mount.ts` | `else throw new TypeError("docserver host: mermaidDraw 'after-ready' needs adapters.loadMermaid or adapters.assets.mermaid");` → `else mermaidSource = null;` | `test/host-mount.test.ts`: 1 failed \| 99 passed (100). Red tests: B4.5 | sha256 `a15dbfae176a…` restored, equal |
| B4e | mode accepted | `src/host/mount.ts` | `Object.freeze(['auto', 'on-request', 'after-ready'])` → `Object.freeze(['auto', 'on-request'])` | `test/host-mount.test.ts`: 19 failed \| 81 passed (100). Red tests: B4.0, B4.1, B4.2, B4.3, B4.4, B4.4b, B4.5, B4.5b, B4.7, B4.7a, B4.7b, B4.8, B4.8b, B4.9, B4.9c, B4.9d, B4.9b, B4.9e, B4.10 | sha256 `a15dbfae176a…` restored, equal |
| B4f | other modes untouched | `src/host/mount.ts` | `if (draw === 'after-ready') { ⏎     // A source is required` → `if (draw === 'after-ready' \|\| typeof loader === 'function') { ⏎     // A source is required` ; `late = c.draw === 'after-ready' && gated !== null && gated.inline;` → `late = gated !== null && gated.inline;` | `test/host-mount.test.ts`: 1 failed \| 99 passed (100). Red tests: B4.6 | sha256 `a15dbfae176a…` restored, equal |
| B4g | re-delivery to a mount that finds the verdict known | `src/host/mount.ts` | `if (verdict !== null) answer = verdict;` → `if (verdict !== null) answer = null;` | `test/host-mount.test.ts`: 2 failed \| 98 passed (100). Red tests: B4.7, B4.7a | sha256 `a15dbfae176a…` restored, equal |
| B4h | gate first | `src/host/mount.ts` | `late = c.draw === 'after-ready' && gated !== null && gated.inline;` → `late = c.draw === 'after-ready';` | `test/host-mount.test.ts`: 3 failed \| 97 passed (100). Red tests: B4.8, B4.8b, B4.9b | sha256 `a15dbfae176a…` restored, equal |
| B4i | untrusted answer: typeof string | `src/host/mount.ts` | `if (typeof text !== 'string') return none('the loader did not answer a string');` → (removed) | `test/host-mount.test.ts`: 1 failed \| 99 passed (100). Red tests: B4.9 | sha256 `a15dbfae176a…` restored, equal |
| B4j | sync throw contained | `src/host/mount.ts` | `let answer: Promise<unknown>; ⏎     try { ⏎       const asked: unknown = typeof source === 'string' ? source : Reflect.apply(source, c.raw, []);` → `let answer: Promise<unknown>; ⏎     const before: unknown = typeof source === 'string' ? source : Reflect.apply(source, c.raw, []); ⏎     try { ⏎       const asked: unknown = before;` | `test/host-mount.test.ts`: 2 failed \| 98 passed (100). Red tests: B4.9, B4.9c | sha256 `a15dbfae176a…` restored, equal |
| B4k | the cap check | `src/host/mount.ts` | `if (text.length > BRIDGE_LIMITS.mermaidMaxChars) return none('the build is over the bridge cap');` → (removed) | `test/host-mount.test.ts`: 1 failed \| 99 passed (100). Red tests: B4.9 | sha256 `a15dbfae176a…` restored, equal |
| B4l | a non-function loader is refused in after-ready | `src/host/mount.ts` | `if (loader !== undefined && typeof loader !== 'function') throw new TypeError('docserver host: adapters.loadMermaid must be a function');` → (removed) | `test/host-mount.test.ts`: 1 failed \| 99 passed (100). Red tests: B4.5 | sha256 `a15dbfae176a…` restored, equal |
| B4m | live before asking | `src/host/mount.ts` | `if (live && late && c.mermaidSource !== null) {` → `if (late && c.mermaidSource !== null) {` | `test/host-mount.test.ts`: 1 failed \| 99 passed (100). Red tests: B4.8b | sha256 `a15dbfae176a…` restored, equal |
| B4n | slot filled before the source runs | `src/host/mount.ts` | `if (asked) return; ⏎     asked = true; ⏎     void ask(source).then((b) => {` → `if (asked) return; ⏎     const pending = ask(source); ⏎     asked = true; ⏎     void pending.then((b) => {` | `test/host-mount.test.ts`: 1 failed \| 99 passed (100). Red tests: B4.9b | sha256 `a15dbfae176a…` restored, equal |
| B4o | the answer is adopted into a fresh native promise | `src/host/mount.ts` | `answer = new Promise<unknown>((resolve) => resolve(asked));` → `answer = asked as Promise<unknown>;` | `test/host-mount.test.ts`: 4 failed \| 96 passed (100). Red tests: B4.5, B4.9, B4.9d, B4.10 | sha256 `a15dbfae176a…` restored, equal |
| B4p | the verdict hook is cleared when a mount stops (retention) | `src/host/mount.ts` | `onVerdict = noop; // only the current mount is ever stopped, and it is the one that holds the hook` → (removed) | `test/host-mount.test.ts`: 1 failed \| 99 passed (100). Red tests: B4.10 | sha256 `a15dbfae176a…` restored, equal |
| B4q | the warning in none() is contained | `src/host/mount.ts` | `try { ⏎         console.warn('docserver host: the Mermaid build is unavailable', reason); ⏎       } catch { ⏎         // a console that throws is no reason to lose the answer ⏎       }` → `console.warn('docserver host: the Mermaid build is unavailable', reason);` | `test/host-mount.test.ts`: 1 failed \| 99 passed (100). Red tests: B4.9c | sha256 `a15dbfae176a…` restored, equal |
| B4r | the post in deliver is contained | `src/host/mount.ts` | `try { ⏎         post('text' in answer ? { t: 'mermaid', text: answer.text } : { t: 'mermaid', unavailable: true }); ⏎       } catch {` → `post('text' in answer ? { t: 'mermaid', text: answer.text } : { t: 'mermaid', unavailable: true }); ⏎       if (answer === null) {` | `test/host-mount.test.ts`: 1 failed \| 99 passed (100). Red tests: B4.9d | sha256 `a15dbfae176a…` restored, equal |
| B4s | the sent flag | `src/host/mount.ts` | `if (!ready \|\| sent \|\| answer === null) return; ⏎       sent = true;` → `if (!ready \|\| answer === null) return;` | `test/host-mount.test.ts`: 0 failed \| 100 passed (100). Stays green (equivalent mutant, argued above) | sha256 `a15dbfae176a…` restored, equal |
| B4t | the try/catch around the checks | `src/host/mount.ts` | `} catch { ⏎           return none('the build could not be checked'); ⏎         }` → `} finally { ⏎           // no catch ⏎         }` | `test/host-mount.test.ts`: 0 failed \| 100 passed (100). Stays green: not reachable by any test input, kept as containment (see the verdicts) | sha256 `a15dbfae176a…` restored, equal |
| B4u | the warning in deliver is contained | `src/host/mount.ts` | `try { ⏎           console.warn('docserver host: the Mermaid build could not be posted'); ⏎         } catch { ⏎           // a console that throws is no reason to fail the port ⏎         }` → `console.warn('docserver host: the Mermaid build could not be posted');` | `test/host-mount.test.ts`: 1 failed \| 99 passed (100). Red tests: B4.9d | sha256 `a15dbfae176a…` restored, equal |
| B4v | the hook is cleared once used | `src/host/mount.ts` | `const hook = onVerdict; ⏎       onVerdict = noop; ⏎       hook();` → `onVerdict();` | `test/host-mount.test.ts`: 0 failed \| 100 passed (100). Stays green (equivalent mutant, argued above) | sha256 `a15dbfae176a…` restored, equal |

```json
[
  {
    "id": "B4a",
    "guard": "post after ready",
    "file": "src/host/mount.ts",
    "tests": "test/host-mount.test.ts",
    "edits": [
      {
        "old": "      if (!ready || sent || answer === null) return;",
        "new": "      if (sent || answer === null) return;"
      }
    ],
    "rc": 1,
    "red": "3 failed | 97 passed (100)",
    "failingTitles": [
      "B4.1",
      "B4.4b",
      "B4.5"
    ],
    "failing": [
      "B4 mermaidDraw 'after-ready': the build is fetched in parallel with the boot and posted after ready (ledger C107) B4.1: for a document the gate admits, the loader is called at mount, before ready; nothing is posted before ready; the op follows a valid ready",
      "B4 mermaidDraw 'after-ready': the build is fetched in parallel with the boot and posted after ready (ledger C107) B4.4b: an onReady adapter that destroys or updates, with the answer already known, leaves the replaced mount silent",
      "B4 mermaidDraw 'after-ready': the build is fetched in parallel with the boot and posted after ready (ledger C107) B4.5: 'after-ready' with neither source is a TypeError; with assets.mermaid only, that text is posted after ready"
    ],
    "assertionErrorsOnly": true,
    "equivalentMutant": false,
    "sha256": "a15dbfae176a8be53d57201d6fcd8d697438a57374bd67666390a2bf029fcc0f",
    "restored": true
  },
  {
    "id": "B4b",
    "guard": "hash check",
    "file": "src/host/mount.ts",
    "tests": "test/host-mount.test.ts",
    "edits": [
      {
        "old": "          if (hex(sha256Text(text)) !== FRAME_MANIFEST.mermaid.sha256) return none('the build is not the shipped one');\n",
        "new": ""
      }
    ],
    "rc": 1,
    "red": "3 failed | 97 passed (100)",
    "failingTitles": [
      "B4.3",
      "B4.5b",
      "B4.9c"
    ],
    "failing": [
      "B4 mermaidDraw 'after-ready': the build is fetched in parallel with the boot and posted after ready (ledger C107) B4.3: a wrong text posts unavailable and warns; so does a rejection",
      "B4 mermaidDraw 'after-ready': the build is fetched in parallel with the boot and posted after ready (ledger C107) B4.5b: with both sources, the loader is used: it is called once and its wrong answer gives unavailable, though assets.mermaid holds the true build",
      "B4 mermaidDraw 'after-ready': the build is fetched in parallel with the boot and posted after ready (ledger C107) B4.9c: a console that throws, and a value whose formatting throws, change nothing: the verdict still arrives and nothing throws out of mountDocFrame, update() or the port"
    ],
    "assertionErrorsOnly": true,
    "equivalentMutant": false,
    "sha256": "a15dbfae176a8be53d57201d6fcd8d697438a57374bd67666390a2bf029fcc0f",
    "restored": true
  },
  {
    "id": "B4c",
    "guard": "replaced mount silent (post's live flag)",
    "file": "src/host/mount.ts",
    "tests": "test/host-mount.test.ts",
    "edits": [
      {
        "old": "    if (live) port.postMessage(m);",
        "new": "    port.postMessage(m);"
      }
    ],
    "rc": 1,
    "red": "1 failed | 99 passed (100)",
    "failingTitles": [
      "B4.4b"
    ],
    "failing": [
      "B4 mermaidDraw 'after-ready': the build is fetched in parallel with the boot and posted after ready (ledger C107) B4.4b: an onReady adapter that destroys or updates, with the answer already known, leaves the replaced mount silent"
    ],
    "assertionErrorsOnly": true,
    "equivalentMutant": false,
    "sha256": "a15dbfae176a8be53d57201d6fcd8d697438a57374bd67666390a2bf029fcc0f",
    "restored": true
  },
  {
    "id": "B4d",
    "guard": "a source is required",
    "file": "src/host/mount.ts",
    "tests": "test/host-mount.test.ts",
    "edits": [
      {
        "old": "    else throw new TypeError(\"docserver host: mermaidDraw 'after-ready' needs adapters.loadMermaid or adapters.assets.mermaid\");",
        "new": "    else mermaidSource = null;"
      }
    ],
    "rc": 1,
    "red": "1 failed | 99 passed (100)",
    "failingTitles": [
      "B4.5"
    ],
    "failing": [
      "B4 mermaidDraw 'after-ready': the build is fetched in parallel with the boot and posted after ready (ledger C107) B4.5: 'after-ready' with neither source is a TypeError; with assets.mermaid only, that text is posted after ready"
    ],
    "assertionErrorsOnly": true,
    "equivalentMutant": false,
    "sha256": "a15dbfae176a8be53d57201d6fcd8d697438a57374bd67666390a2bf029fcc0f",
    "restored": true
  },
  {
    "id": "B4e",
    "guard": "mode accepted",
    "file": "src/host/mount.ts",
    "tests": "test/host-mount.test.ts",
    "edits": [
      {
        "old": "Object.freeze(['auto', 'on-request', 'after-ready'])",
        "new": "Object.freeze(['auto', 'on-request'])"
      }
    ],
    "rc": 1,
    "red": "19 failed | 81 passed (100)",
    "failingTitles": [
      "B4.0",
      "B4.1",
      "B4.2",
      "B4.3",
      "B4.4",
      "B4.4b",
      "B4.5",
      "B4.5b",
      "B4.7",
      "B4.7a",
      "B4.7b",
      "B4.8",
      "B4.8b",
      "B4.9",
      "B4.9c",
      "B4.9d",
      "B4.9b",
      "B4.9e",
      "B4.10"
    ],
    "failing": [
      "B4 mermaidDraw 'after-ready': the build is fetched in parallel with the boot and posted after ready (ledger C107) B4.0: 'after-ready' is an accepted mode: a mount with a loader does not throw, and the srcdoc seeds it",
      "B4 mermaidDraw 'after-ready': the build is fetched in parallel with the boot and posted after ready (ledger C107) B4.1: for a document the gate admits, the loader is called at mount, before ready; nothing is posted before ready; the op follows a valid ready",
      "B4 mermaidDraw 'after-ready': the build is fetched in parallel with the boot and posted after ready (ledger C107) B4.2: an answer that arrives after ready is posted at once",
      "B4 mermaidDraw 'after-ready': the build is fetched in parallel with the boot and posted after ready (ledger C107) B4.3: a wrong text posts unavailable and warns; so does a rejection",
      "B4 mermaidDraw 'after-ready': the build is fetched in parallel with the boot and posted after ready (ledger C107) B4.4: an answer that arrives after destroy() posts nothing",
      "B4 mermaidDraw 'after-ready': the build is fetched in parallel with the boot and posted after ready (ledger C107) B4.4b: an onReady adapter that destroys or updates, with the answer already known, leaves the replaced mount silent",
      "B4 mermaidDraw 'after-ready': the build is fetched in parallel with the boot and posted after ready (ledger C107) B4.5: 'after-ready' with neither source is a TypeError; with assets.mermaid only, that text is posted after ready",
      "B4 mermaidDraw 'after-ready': the build is fetched in parallel with the boot and posted after ready (ledger C107) B4.5b: with both sources, the loader is used: it is called once and its wrong answer gives unavailable, though assets.mermaid holds the true build",
      "B4 mermaidDraw 'after-ready': the build is fetched in parallel with the boot and posted after ready (ledger C107) B4.7: an update before the loader resolves: the new mount gets exactly one op, the replaced mount none, the loader one call; a later update re-posts without a call",
      "B4 mermaidDraw 'after-ready': the build is fetched in parallel with the boot and posted after ready (ledger C107) B4.7a: a failed answer warns once per DocFrame: a remount after it is told unavailable, with no second warning",
      "B4 mermaidDraw 'after-ready': the build is fetched in parallel with the boot and posted after ready (ledger C107) B4.7b: a replaced mount that is not replaced by a Mermaid mount still posts nothing when the answer arrives",
      "B4 mermaidDraw 'after-ready': the build is fetched in parallel with the boot and posted after ready (ledger C107) B4.8: a document with no fences never calls loadMermaid and posts no op; an update that brings figures calls it once",
      "B4 mermaidDraw 'after-ready': the build is fetched in parallel with the boot and posted after ready (ledger C107) B4.8b: a destroy at the step-8 focus (a focusout handler) means the loader is never called",
      "B4 mermaidDraw 'after-ready': the build is fetched in parallel with the boot and posted after ready (ledger C107) B4.9: a loader that throws, resolves to a non-string, or resolves over the cap posts unavailable and warns once with its reason; nothing throws out of mountDocFrame",
      "B4 mermaidDraw 'after-ready': the build is fetched in parallel with the boot and posted after ready (ledger C107) B4.9c: a console that throws, and a value whose formatting throws, change nothing: the verdict still arrives and nothing throws out of mountDocFrame, update() or the port",
      "B4 mermaidDraw 'after-ready': the build is fetched in parallel with the boot and posted after ready (ledger C107) B4.9d: a port that throws on the mermaid post, with a console that throws too, never throws out of the port",
      "B4 mermaidDraw 'after-ready': the build is fetched in parallel with the boot and posted after ready (ledger C107) B4.9b: a loader that calls update() or destroy() from inside itself never loops, never throws and is called once; the current mount, not the outer one, receives the verdict",
      "B4 mermaidDraw 'after-ready': the build is fetched in parallel with the boot and posted after ready (ledger C107) B4.9e: a ready with a wrong nonce is not a ready: the frame falls back, and an answer that arrives after it posts nothing",
      "B4 mermaidDraw 'after-ready': the build is fetched in parallel with the boot and posted after ready (ledger C107) B4.10: while the loader stays pending, a replaced or destroyed mount is not retained: only the current mount can be reached from the verdict hook"
    ],
    "assertionErrorsOnly": false,
    "equivalentMutant": false,
    "sha256": "a15dbfae176a8be53d57201d6fcd8d697438a57374bd67666390a2bf029fcc0f",
    "restored": true
  },
  {
    "id": "B4f",
    "guard": "other modes untouched",
    "file": "src/host/mount.ts",
    "tests": "test/host-mount.test.ts",
    "edits": [
      {
        "old": "  if (draw === 'after-ready') {\n    // A source is required",
        "new": "  if (draw === 'after-ready' || typeof loader === 'function') {\n    // A source is required"
      },
      {
        "old": "      late = c.draw === 'after-ready' && gated !== null && gated.inline;",
        "new": "      late = gated !== null && gated.inline;"
      }
    ],
    "rc": 1,
    "red": "1 failed | 99 passed (100)",
    "failingTitles": [
      "B4.6"
    ],
    "failing": [
      "B4 mermaidDraw 'after-ready': the build is fetched in parallel with the boot and posted after ready (ledger C107) B4.6: 'auto' and 'on-request' never call loadMermaid and post no mermaid op"
    ],
    "assertionErrorsOnly": true,
    "equivalentMutant": false,
    "sha256": "a15dbfae176a8be53d57201d6fcd8d697438a57374bd67666390a2bf029fcc0f",
    "restored": true
  },
  {
    "id": "B4g",
    "guard": "re-delivery to a mount that finds the verdict known",
    "file": "src/host/mount.ts",
    "tests": "test/host-mount.test.ts",
    "edits": [
      {
        "old": "      if (verdict !== null) answer = verdict;\n",
        "new": "      if (verdict !== null) answer = null;\n"
      }
    ],
    "rc": 1,
    "red": "2 failed | 98 passed (100)",
    "failingTitles": [
      "B4.7",
      "B4.7a"
    ],
    "failing": [
      "B4 mermaidDraw 'after-ready': the build is fetched in parallel with the boot and posted after ready (ledger C107) B4.7: an update before the loader resolves: the new mount gets exactly one op, the replaced mount none, the loader one call; a later update re-posts without a call",
      "B4 mermaidDraw 'after-ready': the build is fetched in parallel with the boot and posted after ready (ledger C107) B4.7a: a failed answer warns once per DocFrame: a remount after it is told unavailable, with no second warning"
    ],
    "assertionErrorsOnly": true,
    "equivalentMutant": false,
    "sha256": "a15dbfae176a8be53d57201d6fcd8d697438a57374bd67666390a2bf029fcc0f",
    "restored": true
  },
  {
    "id": "B4h",
    "guard": "gate first",
    "file": "src/host/mount.ts",
    "tests": "test/host-mount.test.ts",
    "edits": [
      {
        "old": "      late = c.draw === 'after-ready' && gated !== null && gated.inline;",
        "new": "      late = c.draw === 'after-ready';"
      }
    ],
    "rc": 1,
    "red": "3 failed | 97 passed (100)",
    "failingTitles": [
      "B4.8",
      "B4.8b",
      "B4.9b"
    ],
    "failing": [
      "B4 mermaidDraw 'after-ready': the build is fetched in parallel with the boot and posted after ready (ledger C107) B4.8: a document with no fences never calls loadMermaid and posts no op; an update that brings figures calls it once",
      "B4 mermaidDraw 'after-ready': the build is fetched in parallel with the boot and posted after ready (ledger C107) B4.8b: a destroy at the step-8 focus (a focusout handler) means the loader is never called",
      "B4 mermaidDraw 'after-ready': the build is fetched in parallel with the boot and posted after ready (ledger C107) B4.9b: a loader that calls update() or destroy() from inside itself never loops, never throws and is called once; the current mount, not the outer one, receives the verdict"
    ],
    "assertionErrorsOnly": true,
    "equivalentMutant": false,
    "sha256": "a15dbfae176a8be53d57201d6fcd8d697438a57374bd67666390a2bf029fcc0f",
    "restored": true
  },
  {
    "id": "B4i",
    "guard": "untrusted answer: typeof string",
    "file": "src/host/mount.ts",
    "tests": "test/host-mount.test.ts",
    "edits": [
      {
        "old": "          if (typeof text !== 'string') return none('the loader did not answer a string');\n",
        "new": ""
      }
    ],
    "rc": 1,
    "red": "1 failed | 99 passed (100)",
    "failingTitles": [
      "B4.9"
    ],
    "failing": [
      "B4 mermaidDraw 'after-ready': the build is fetched in parallel with the boot and posted after ready (ledger C107) B4.9: a loader that throws, resolves to a non-string, or resolves over the cap posts unavailable and warns once with its reason; nothing throws out of mountDocFrame"
    ],
    "assertionErrorsOnly": true,
    "equivalentMutant": false,
    "sha256": "a15dbfae176a8be53d57201d6fcd8d697438a57374bd67666390a2bf029fcc0f",
    "restored": true
  },
  {
    "id": "B4j",
    "guard": "sync throw contained",
    "file": "src/host/mount.ts",
    "tests": "test/host-mount.test.ts",
    "edits": [
      {
        "old": "    let answer: Promise<unknown>;\n    try {\n      const asked: unknown = typeof source === 'string' ? source : Reflect.apply(source, c.raw, []);",
        "new": "    let answer: Promise<unknown>;\n    const before: unknown = typeof source === 'string' ? source : Reflect.apply(source, c.raw, []);\n    try {\n      const asked: unknown = before;"
      }
    ],
    "rc": 1,
    "red": "2 failed | 98 passed (100)",
    "failingTitles": [
      "B4.9",
      "B4.9c"
    ],
    "failing": [
      "B4 mermaidDraw 'after-ready': the build is fetched in parallel with the boot and posted after ready (ledger C107) B4.9: a loader that throws, resolves to a non-string, or resolves over the cap posts unavailable and warns once with its reason; nothing throws out of mountDocFrame",
      "B4 mermaidDraw 'after-ready': the build is fetched in parallel with the boot and posted after ready (ledger C107) B4.9c: a console that throws, and a value whose formatting throws, change nothing: the verdict still arrives and nothing throws out of mountDocFrame, update() or the port"
    ],
    "assertionErrorsOnly": false,
    "equivalentMutant": false,
    "sha256": "a15dbfae176a8be53d57201d6fcd8d697438a57374bd67666390a2bf029fcc0f",
    "restored": true
  },
  {
    "id": "B4k",
    "guard": "the cap check",
    "file": "src/host/mount.ts",
    "tests": "test/host-mount.test.ts",
    "edits": [
      {
        "old": "          if (text.length > BRIDGE_LIMITS.mermaidMaxChars) return none('the build is over the bridge cap');\n",
        "new": ""
      }
    ],
    "rc": 1,
    "red": "1 failed | 99 passed (100)",
    "failingTitles": [
      "B4.9"
    ],
    "failing": [
      "B4 mermaidDraw 'after-ready': the build is fetched in parallel with the boot and posted after ready (ledger C107) B4.9: a loader that throws, resolves to a non-string, or resolves over the cap posts unavailable and warns once with its reason; nothing throws out of mountDocFrame"
    ],
    "assertionErrorsOnly": true,
    "equivalentMutant": false,
    "sha256": "a15dbfae176a8be53d57201d6fcd8d697438a57374bd67666390a2bf029fcc0f",
    "restored": true
  },
  {
    "id": "B4l",
    "guard": "a non-function loader is refused in after-ready",
    "file": "src/host/mount.ts",
    "tests": "test/host-mount.test.ts",
    "edits": [
      {
        "old": "    if (loader !== undefined && typeof loader !== 'function') throw new TypeError('docserver host: adapters.loadMermaid must be a function');\n",
        "new": ""
      }
    ],
    "rc": 1,
    "red": "1 failed | 99 passed (100)",
    "failingTitles": [
      "B4.5"
    ],
    "failing": [
      "B4 mermaidDraw 'after-ready': the build is fetched in parallel with the boot and posted after ready (ledger C107) B4.5: 'after-ready' with neither source is a TypeError; with assets.mermaid only, that text is posted after ready"
    ],
    "assertionErrorsOnly": true,
    "equivalentMutant": false,
    "sha256": "a15dbfae176a8be53d57201d6fcd8d697438a57374bd67666390a2bf029fcc0f",
    "restored": true
  },
  {
    "id": "B4m",
    "guard": "live before asking",
    "file": "src/host/mount.ts",
    "tests": "test/host-mount.test.ts",
    "edits": [
      {
        "old": "    if (live && late && c.mermaidSource !== null) {",
        "new": "    if (late && c.mermaidSource !== null) {"
      }
    ],
    "rc": 1,
    "red": "1 failed | 99 passed (100)",
    "failingTitles": [
      "B4.8b"
    ],
    "failing": [
      "B4 mermaidDraw 'after-ready': the build is fetched in parallel with the boot and posted after ready (ledger C107) B4.8b: a destroy at the step-8 focus (a focusout handler) means the loader is never called"
    ],
    "assertionErrorsOnly": true,
    "equivalentMutant": false,
    "sha256": "a15dbfae176a8be53d57201d6fcd8d697438a57374bd67666390a2bf029fcc0f",
    "restored": true
  },
  {
    "id": "B4n",
    "guard": "slot filled before the source runs",
    "file": "src/host/mount.ts",
    "tests": "test/host-mount.test.ts",
    "edits": [
      {
        "old": "    if (asked) return;\n    asked = true;\n    void ask(source).then((b) => {",
        "new": "    if (asked) return;\n    const pending = ask(source);\n    asked = true;\n    void pending.then((b) => {"
      }
    ],
    "rc": 1,
    "red": "1 failed | 99 passed (100)",
    "failingTitles": [
      "B4.9b"
    ],
    "failing": [
      "B4 mermaidDraw 'after-ready': the build is fetched in parallel with the boot and posted after ready (ledger C107) B4.9b: a loader that calls update() or destroy() from inside itself never loops, never throws and is called once; the current mount, not the outer one, receives the verdict"
    ],
    "assertionErrorsOnly": true,
    "equivalentMutant": false,
    "sha256": "a15dbfae176a8be53d57201d6fcd8d697438a57374bd67666390a2bf029fcc0f",
    "restored": true
  },
  {
    "id": "B4o",
    "guard": "the answer is adopted into a fresh native promise",
    "file": "src/host/mount.ts",
    "tests": "test/host-mount.test.ts",
    "edits": [
      {
        "old": "      answer = new Promise<unknown>((resolve) => resolve(asked));",
        "new": "      answer = asked as Promise<unknown>;"
      }
    ],
    "rc": 1,
    "red": "4 failed | 96 passed (100)",
    "failingTitles": [
      "B4.5",
      "B4.9",
      "B4.9d",
      "B4.10"
    ],
    "failing": [
      "B4 mermaidDraw 'after-ready': the build is fetched in parallel with the boot and posted after ready (ledger C107) B4.5: 'after-ready' with neither source is a TypeError; with assets.mermaid only, that text is posted after ready",
      "B4 mermaidDraw 'after-ready': the build is fetched in parallel with the boot and posted after ready (ledger C107) B4.9: a loader that throws, resolves to a non-string, or resolves over the cap posts unavailable and warns once with its reason; nothing throws out of mountDocFrame",
      "B4 mermaidDraw 'after-ready': the build is fetched in parallel with the boot and posted after ready (ledger C107) B4.9d: a port that throws on the mermaid post, with a console that throws too, never throws out of the port",
      "B4 mermaidDraw 'after-ready': the build is fetched in parallel with the boot and posted after ready (ledger C107) B4.10: while the loader stays pending, a replaced or destroyed mount is not retained: only the current mount can be reached from the verdict hook"
    ],
    "assertionErrorsOnly": false,
    "equivalentMutant": false,
    "sha256": "a15dbfae176a8be53d57201d6fcd8d697438a57374bd67666390a2bf029fcc0f",
    "restored": true
  },
  {
    "id": "B4p",
    "guard": "the verdict hook is cleared when a mount stops (retention)",
    "file": "src/host/mount.ts",
    "tests": "test/host-mount.test.ts",
    "edits": [
      {
        "old": "      onVerdict = noop; // only the current mount is ever stopped, and it is the one that holds the hook\n",
        "new": ""
      }
    ],
    "rc": 1,
    "red": "1 failed | 99 passed (100)",
    "failingTitles": [
      "B4.10"
    ],
    "failing": [
      "B4 mermaidDraw 'after-ready': the build is fetched in parallel with the boot and posted after ready (ledger C107) B4.10: while the loader stays pending, a replaced or destroyed mount is not retained: only the current mount can be reached from the verdict hook"
    ],
    "assertionErrorsOnly": true,
    "equivalentMutant": false,
    "sha256": "a15dbfae176a8be53d57201d6fcd8d697438a57374bd67666390a2bf029fcc0f",
    "restored": true
  },
  {
    "id": "B4q",
    "guard": "the warning in none() is contained",
    "file": "src/host/mount.ts",
    "tests": "test/host-mount.test.ts",
    "edits": [
      {
        "old": "      try {\n        console.warn('docserver host: the Mermaid build is unavailable', reason);\n      } catch {\n        // a console that throws is no reason to lose the answer\n      }\n",
        "new": "      console.warn('docserver host: the Mermaid build is unavailable', reason);\n"
      }
    ],
    "rc": 1,
    "red": "1 failed | 99 passed (100)",
    "failingTitles": [
      "B4.9c"
    ],
    "failing": [
      "B4 mermaidDraw 'after-ready': the build is fetched in parallel with the boot and posted after ready (ledger C107) B4.9c: a console that throws, and a value whose formatting throws, change nothing: the verdict still arrives and nothing throws out of mountDocFrame, update() or the port"
    ],
    "assertionErrorsOnly": true,
    "equivalentMutant": false,
    "sha256": "a15dbfae176a8be53d57201d6fcd8d697438a57374bd67666390a2bf029fcc0f",
    "restored": true
  },
  {
    "id": "B4r",
    "guard": "the post in deliver is contained",
    "file": "src/host/mount.ts",
    "tests": "test/host-mount.test.ts",
    "edits": [
      {
        "old": "      try {\n        post('text' in answer ? { t: 'mermaid', text: answer.text } : { t: 'mermaid', unavailable: true });\n      } catch {",
        "new": "      post('text' in answer ? { t: 'mermaid', text: answer.text } : { t: 'mermaid', unavailable: true });\n      if (answer === null) {"
      }
    ],
    "rc": 1,
    "red": "1 failed | 99 passed (100)",
    "failingTitles": [
      "B4.9d"
    ],
    "failing": [
      "B4 mermaidDraw 'after-ready': the build is fetched in parallel with the boot and posted after ready (ledger C107) B4.9d: a port that throws on the mermaid post, with a console that throws too, never throws out of the port"
    ],
    "assertionErrorsOnly": true,
    "equivalentMutant": false,
    "sha256": "a15dbfae176a8be53d57201d6fcd8d697438a57374bd67666390a2bf029fcc0f",
    "restored": true
  },
  {
    "id": "B4s",
    "guard": "the sent flag",
    "file": "src/host/mount.ts",
    "tests": "test/host-mount.test.ts",
    "edits": [
      {
        "old": "      if (!ready || sent || answer === null) return;\n      sent = true;\n",
        "new": "      if (!ready || answer === null) return;\n"
      }
    ],
    "rc": 0,
    "red": "0 failed | 100 passed (100)",
    "failingTitles": [],
    "failing": [],
    "assertionErrorsOnly": true,
    "equivalentMutant": true,
    "sha256": "a15dbfae176a8be53d57201d6fcd8d697438a57374bd67666390a2bf029fcc0f",
    "restored": true
  },
  {
    "id": "B4t",
    "guard": "the try/catch around the checks",
    "file": "src/host/mount.ts",
    "tests": "test/host-mount.test.ts",
    "edits": [
      {
        "old": "        } catch {\n          return none('the build could not be checked');\n        }",
        "new": "        } finally {\n          // no catch\n        }"
      }
    ],
    "rc": 0,
    "red": "0 failed | 100 passed (100)",
    "failingTitles": [],
    "failing": [],
    "assertionErrorsOnly": true,
    "equivalentMutant": false,
    "ruling": "Not reachable by any test input: the only throw inside the checks is an allocation failure while hashing an at-cap text; ruled kept as containment, not an equivalent mutant (ledger C107).",
    "sha256": "a15dbfae176a8be53d57201d6fcd8d697438a57374bd67666390a2bf029fcc0f",
    "restored": true
  },
  {
    "id": "B4u",
    "guard": "the warning in deliver is contained",
    "file": "src/host/mount.ts",
    "tests": "test/host-mount.test.ts",
    "edits": [
      {
        "old": "        try {\n          console.warn('docserver host: the Mermaid build could not be posted');\n        } catch {\n          // a console that throws is no reason to fail the port\n        }\n",
        "new": "        console.warn('docserver host: the Mermaid build could not be posted');\n"
      }
    ],
    "rc": 1,
    "red": "1 failed | 99 passed (100)",
    "failingTitles": [
      "B4.9d"
    ],
    "failing": [
      "B4 mermaidDraw 'after-ready': the build is fetched in parallel with the boot and posted after ready (ledger C107) B4.9d: a port that throws on the mermaid post, with a console that throws too, never throws out of the port"
    ],
    "assertionErrorsOnly": true,
    "equivalentMutant": false,
    "sha256": "a15dbfae176a8be53d57201d6fcd8d697438a57374bd67666390a2bf029fcc0f",
    "restored": true
  },
  {
    "id": "B4v",
    "guard": "the hook is cleared once used",
    "file": "src/host/mount.ts",
    "tests": "test/host-mount.test.ts",
    "edits": [
      {
        "old": "      const hook = onVerdict;\n      onVerdict = noop;\n      hook();",
        "new": "      onVerdict();"
      }
    ],
    "rc": 0,
    "red": "0 failed | 100 passed (100)",
    "failingTitles": [],
    "failing": [],
    "assertionErrorsOnly": true,
    "equivalentMutant": true,
    "sha256": "a15dbfae176a8be53d57201d6fcd8d697438a57374bd67666390a2bf029fcc0f",
    "restored": true
  }
]
```
