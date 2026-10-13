# docserver

One shared renderer for spec and plan documents written in Markdown. It turns Markdown into the rich reading layout: a contents sidebar, "In short" and "Where things stand" boxes, status labels, figure cards for Mermaid diagrams, quick jump, a glossary on hover, an Index of defined IDs, "Changes since", read marks, and light and dark themes.

It is pure. It does no network, storage, auth, git or hosting. Each product that uses it brings its own transport, login, content source and hosting, and pins one exact version.

**Status:** pre-release and private until v1, which goes public under the MIT licence as `@synapsium-labs/docserver`.

## What it holds

| Part | Entry point |
|---|---|
| Markdown rules (markdown-it, TypeScript): GitHub-style Markdown, alerts, figure captions, front matter, heading ids, a short raw-HTML allowlist | `render()` |
| The rich layout | `enhance(root, options)` |
| Fonts, a self-hosted Mermaid, and an asset manifest with hashes | `assets/` |
| A sandboxed-frame document builder, and a host helper | `frameDocument()`, `mountDocFrame()` |
| The conformance corpus: Markdown in, expected HTML out, plus hostile cases | `conformance/`, `runCorpus()` |

## Build and test

Node 22 or later. Every dependency is pinned to an exact version and installed from the committed lockfile.

```sh
npm ci                            # install exactly what package-lock.json records
npm run typecheck                 # the whole tree, then src/render alone with no host types
./node_modules/.bin/vitest run    # every test; one file: ./node_modules/.bin/vitest run test/package.test.ts
npm run build                     # dist/ from src/
```

- Run the local `vitest` binary, never a bare `npx vitest`, which can resolve a different global copy.
- Tests never reach a network: `test/setup/no-network.ts` makes `fetch` and every socket connect throw.
- CI (`.github/workflows/ci.yml`) runs the same four steps on Node 22 and 24, on pull requests and on `main`.
- A new or bumped dependency is an exact version at least 14 days old. Add it with
  `npm install --save-exact --before=<a date 14 days back> <name>@<x.y.z>`; npm then refuses a younger version.

## Design

The design lives in ccrc's spec: [Rich Docs reader and a shared renderer](https://github.com/Synapsium-Labs/ccrc-pwa/blob/main/docs/superpowers/specs/2026-10-12-rich-docs-reader-and-shared-renderer-design.md), §3. The programme ledger is [`docs/superpowers/programs/docserver.md`](docs/superpowers/programs/docserver.md).

## Licence

MIT. See [`LICENSE`](LICENSE). Bundled third-party files keep their own licences, listed in `THIRD-PARTY-NOTICES` once they ship.
