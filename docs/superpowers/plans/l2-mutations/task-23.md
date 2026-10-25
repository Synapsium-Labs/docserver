# L2 Task 23: mutation rows (diagram tools)

These rows name the definition-cue guards in `src/enhance/diagram-tools.ts`: label separation, vocabulary-owned matching, accessible controls, batched geometry, independently journalled cue chrome, and SVG source identity. The required throwaway-copy mutation runner is out of scope, so each row remains pending semantic proof; the targeted unit and Chromium browser tests are ordinary regression evidence, not a mutation campaign.

| Row | Guard | File | Test | Status |
|---|---|---|---|---|
| L2-T23-M1 | label boundaries preserve terms split across SVG text nodes | `src/enhance/diagram-tools.ts` | `test/enhance-diagram-tools.test.ts` definition controls | pending semantic proof |
| L2-T23-M2 | terms sort longest-first before IDs are considered | `src/enhance/diagram-tools.ts` | `test/enhance-diagram-tools.test.ts` definition controls | pending semantic proof |
| L2-T23-M3 | IDs use `ctx.vocab.idScan()` and its qualifier window | `src/enhance/diagram-tools.ts` | `test/enhance-diagram-tools.test.ts` configured vocabulary case | pending semantic proof |
| L2-T23-M4 | a definition block has dialog keyboard semantics | `src/enhance/diagram-tools.ts` | `test/enhance-diagram-tools.test.ts` definition controls | pending semantic proof |
| L2-T23-M5 | all cue geometry reads complete before cue writes | `src/enhance/diagram-tools.ts` | `test/browser/diagram-tools.test.ts` internal structures | pending semantic proof |
| L2-T23-M6 | cue chrome is independently journalled and removed after a move | `src/enhance/diagram-tools.ts` | `test/enhance-diagram-tools.test.ts` moved-node teardown | pending semantic proof |
| L2-T23-M7 | generated Mermaid node, edge-label, and cluster-label shapes remain discoverable | `src/enhance/diagram-tools.ts` | `test/browser/diagram-tools.test.ts` internal structures | pending semantic proof |
