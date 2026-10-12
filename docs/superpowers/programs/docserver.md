# Program: docserver

Spec: [Rich Docs reader and a shared renderer](https://github.com/Synapsium-Labs/ccrc-pwa/blob/main/docs/superpowers/specs/2026-10-12-rich-docs-reader-and-shared-renderer-design.md), §3 (the library) and §8 (sequencing). It was approved by the operator on 2026-10-12 (R-g).
Plan: one plan per wave, under `docs/superpowers/plans/`.
Coordinator: ccrc session `ccrc-pwa-calm-canyon`. It also coordinates ccrc's `native-docs-reader` programme, which is this library's first consumer.

## Waves

| # | scope | PRs | state |
|---|---|---|---|
| L1 | Scaffold and rules. A TypeScript package with ESM entry points and `.d.ts`. `render()` on markdown-it with the raw-HTML allowlist, alerts, figure captions, front matter, heading ids, `data-line` attributes and `meta`. The conformance corpus: golden HTML generated from today's renderer, hostile cases, and `runCorpus()`. CI. | — | planning |
| L2 | The layout. `enhance(root, options)` made embeddable: host adapters, namespaced storage keys, operator-specific defaults scrubbed into off-by-default options, CSP-safe. The styles, and the fonts with `OFL.txt`. A self-hosted single-file Mermaid with pinned limits. `THIRD-PARTY-NOTICES`. | — | after L1 |
| L3 | The frame and the release. `frameDocument()`, the frame bootstrap and click guard as hashed assets, `mountDocFrame()` for other hosts, and `assets.json`. Then v1: the repo goes public, and the package is published to npm with provenance as `@synapsium-labs/docserver`. | — | after L2 |

## Decisions & deviations

- **2026-10-12: the programme (operator).** Each product keeps its own docs server. The rendering is this one library: MIT, pinned by exact version, named `docserver`, scope `@synapsium-labs`. It starts now, and it is private until v1, which goes public. ccrc's spec is approved as written (R-a, R-c, R-f, R-g).
- **2026-10-12: consumers' needs.** ccrc's needs are its spec's §3-§4. Another viewer, which pins the library for its own phase, sent eight needs. They are met by §3.2 as written, and that viewer's coordinator confirmed it the same day. A first release before that viewer's phase is the date that matters. Interim builds are fine for its development.
- **Deviation numbers.** This repo's specs and plans name no allocator-issued numbers, so the ccrc allocator has nothing to seed from. Coordinator rulings are recorded here as `C<n>`, each with what, why and what it costs if wrong.

## Carried constraints (reviewers get these)

- Public-ready text from the first commit (`CLAUDE.md`): no hosts, users, private paths, project lists, issue-tracker workspaces, private product names or operator defaults.
- Pure library: no network, storage backend, auth, git or hosting.
- One raw-HTML allowlist, identical in Node and the browser.
- Browser code is CSP-safe: no `innerHTML`, `eval` or inline handlers.
- The corpus is the contract: a golden change is stated, and a hostile verdict never weakens.

## Next-wave brief (L1)

Written once the L1 plan is reviewed.
