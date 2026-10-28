# Security

`@synapsium-labs/docserver` renders untrusted Markdown, builds a sealed reader frame, and mounts that frame for a host page, so a flaw in it can reach every reader of every host that uses it. Reports are welcome.

## Reporting a vulnerability

Please report a vulnerability privately, through GitHub's private vulnerability reporting: open a draft security advisory at <https://github.com/Synapsium-Labs/docserver/security/advisories/new>. Do not open a public issue, pull request or discussion about it, and do not include a working exploit anywhere public.

Say which version you tested (`npm ls @synapsium-labs/docserver`), which entry is involved (`./render`, `./enhance`, `./frame`, `./host`, `./highlight` or a shipped asset), and the smallest input that shows the problem. A Markdown document, the options you passed, and what you expected beside what happened are usually enough.

## What happens next

The maintainers acknowledge a report in the advisory, agree a fix and a release with you there, and publish the advisory once a fixed version is on npm. A fix ships as a new exact version; consumers pin one version, so the advisory names the first fixed one.

## Supported versions

Only the latest published version receives fixes. Before v1.0.0 the package is not published.

## Verifying what you install

Every release is built once from a signed tag, attested, and published with provenance through npm trusted publishing. The README's Release verification section gives the commands that check a published version against the build that made it.
