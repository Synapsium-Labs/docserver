# docserver

A shared, pure Markdown renderer and rich reading layout. The design is §3 of ccrc's spec,
`docs/superpowers/specs/2026-10-12-rich-docs-reader-and-shared-renderer-design.md` in
`Synapsium-Labs/ccrc-pwa`. Read that section before changing an API.

## Rules that shape every change

- **Pure.** No network, no `fetch`, no storage backend, no auth, no git, no URLs of its own and no hosting. A host passes data in and receives calls out, through options and adapters.
- **This repo goes public at v1 (MIT).** Write every tracked file as if it were public already:
  - no hostnames, usernames, private paths, project lists or issue-tracker workspace names;
  - no private product names;
  - no defaults that belong to one operator: vocabulary and ID grammars are options, off by default where they are product-specific.
- **One raw-HTML allowlist**, identical in Node and in the browser: `<br>`, `sup`, `sub`, `kbd`, `details`/`summary` lines, and `<!-- id:X -->` comment anchors. Everything else is text.
- **CSP-safe browser code:** no `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `eval` or inline handlers. Document content is only created, moved or cloned.
- **The conformance corpus is the contract.** A change that moves any golden file says so in its commit and in the release notes. A hostile case never loses its expected verdict.
- **Mutation discipline:** every guard ships with a case that goes red when the guard is removed. Measure it; do not assume it.
- **Releases:** exact versions only. Consumers pin one version and never a branch.

## Build and test

Defined by the L1 plan, `docs/superpowers/plans/`. Node >= 22.
