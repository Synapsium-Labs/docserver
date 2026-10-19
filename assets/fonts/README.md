# Fonts

Four variable fonts, Latin subset, taken unchanged from two npm packages published by Fontsource. `reader.css` loads them
by relative URL (`./fonts/...`).

| Package | Version | File | sha256 | Licence |
|---|---|---|---|---|
| `@fontsource-variable/source-serif-4` | 5.3.0 | `source-serif-4-latin-opsz-normal.woff2` | `f2ea9c12d2fe9bd3a9589b02ad2c0909da88f30938c91adc838c4f4098f9f9e0` | SIL OFL 1.1 |
| `@fontsource-variable/source-serif-4` | 5.3.0 | `source-serif-4-latin-opsz-italic.woff2` | `96e6393209728ab93c334ae739af8a040cd2006c82e8614d6465a8084db88f89` | SIL OFL 1.1 |
| `@fontsource-variable/source-sans-3` | 5.3.0 | `source-sans-3-latin-wght-normal.woff2` | `7a19a7027e125257d310c6dbd78ae3a30b5ea1e3794d60b12bb28227a003bfda` | SIL OFL 1.1 |
| `@fontsource-variable/source-sans-3` | 5.3.0 | `source-sans-3-latin-wght-italic.woff2` | `9a15dafc2c2b2414aaa9d6c30830d9aab4361329d8495b1574633603b994b411` | SIL OFL 1.1 |

The families are Source Serif 4 and Source Sans 3, in the Latin subsets Fontsource publishes; the packages name "Google
Inc." as author and carry the SIL OFL 1.1. The fonts' own copyright notices (name ID 0 of each file) are Adobe's:

- Source Serif 4: `© 2014 - 2021 Adobe Systems Incorporated (http://www.adobe.com/), with Reserved Font Name ‘Source’.`
- Source Sans 3: `© 2023 Adobe (http://www.adobe.com/), with Reserved Font Name ‘Source’`

`THIRD-PARTY-NOTICES` repeats them. The licence is in `OFL.txt`, copied from each package's `LICENSE`; the two files
are byte-identical (sha256 `18aabf190848725e2576eefb5c29ba06aac1029d02132252a7f312eac2e50cf3`), so one copy is kept.

## Provenance

Each package was fetched with `npm pack` (no install, no scripts) into an empty directory and extracted with `tar` into
another; the hashes above are of the extracted `files/*.woff2`, and they equal the copies the earlier reader served.
Version 5.3.0 is used for both families although 5.3.1 exists: the Source Sans 3 files differ in 5.3.1 (the normal file is
28872 bytes, sha256 `19143dca...`; the italic file 28460 bytes, sha256 `5fbc14d5...`), and that release is younger than the
14-day age rule for new dependencies. The Source Serif 4 files are identical in both releases.

To refresh: `npm pack` the two packages at the version wanted, extract, compare the hashes, copy the four files and
`LICENSE` here, and update this table, `THIRD-PARTY-NOTICES` and the age check.
