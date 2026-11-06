// Builds the decision log as local pages for the reading layout: every Markdown file of docs/decisions/ rendered by
// the repo's own render(), inserted in a root element, then enhanced, one page each. README.md becomes index.html and
// C84.md becomes C84.html. A link between two decisions is written as the relative `.md` link that works on GitHub
// and in a host that serves the Markdown (docs/decisions/README.md, "Adding a decision"); the page script points it
// at the built page before the layout starts. It writes decisions-out/ (git-ignored; --out names another directory,
// which must not exist yet): the pages, decisions.js and assets/ (a copy of the stylesheet and fonts).
//
// This script is a host of the library, like the demo, and never part of the package: it reads git, which the
// library never does. From git it gives each page its commits (DocumentInfo.commits) and, for "what changed", the
// change set since each of them (the `changes` option), taken now with `git diff -U0` against the version shown. A
// file with uncommitted edits is shown as a draft, with no comparison, since its lines are not those of any commit.
//
// Run it from the repository root: node scripts/decisions/build.mjs [--out <dir>]   (npm run decisions)
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const USAGE = 'usage: node scripts/decisions/build.mjs [--out <dir>]';
const repo = fileURLToPath(new URL('../../', import.meta.url));
const args = process.argv.slice(2);
if (!(args.length === 0 || (args.length === 2 && args[0] === '--out' && args[1] !== ''))) {
  console.error(USAGE);
  process.exit(2);
}
const out = args.length === 0 ? path.join(repo, 'decisions-out') : path.resolve(args[1]);
if (args.length === 2 && existsSync(out)) {
  console.error(`decisions: ${out} exists; --out names a directory that does not exist yet`);
  process.exit(2);
}
const source = path.join(repo, 'docs', 'decisions');
/** At most this many earlier versions of one file get a change set; the reader reads only the first 100 commits. */
const MAX_BASES = 30;

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

const renderFile = path.join(out, 'render.mjs');
await build({
  entryPoints: [path.join(repo, 'src', 'render', 'index.ts')],
  outfile: renderFile,
  bundle: true,
  format: 'esm',
  platform: 'node',
  logLevel: 'error',
});
const { render } = await import(pathToFileURL(renderFile).href);
await rm(renderFile);

/** git's output, or null where there is no git or no repository (a copy of the tree still builds, with no history). */
function git(...a) {
  try {
    return execFileSync('git', a, { cwd: repo, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return null;
  }
}

/** A change set in the version shown's lines from `git diff -U0 base -- file` (the working file is the version shown). */
function changeSet(base, file) {
  const diff = git('diff', '-U0', '--no-color', base, '--', file);
  if (diff === null) return null;
  const changed = [];
  const removedAfter = [];
  for (const m of diff.matchAll(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/gm)) {
    const start = Number(m[1]);
    const count = m[2] === undefined ? 1 : Number(m[2]);
    if (count === 0) removedAfter.push(start);
    else changed.push([start, start + count - 1]);
  }
  return { changed, removedAfter };
}

/** The page's DocumentInfo history and its change sets, or none when git has nothing for the file. */
function history(file) {
  const log = git('log', '-n', '100', '--format=%H%x1f%s%x1f%cI%x1f%P', '--', file);
  const commits = (log ?? '')
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [sha, subject, date, parents] = line.split('\x1f');
      return { sha, subject: subject.slice(0, 200), date, parents: parents.split(' ').filter(Boolean).slice(0, 16) };
    });
  if (commits.length === 0) return { sha: null, draft: true, commits: null, changes: {} };
  const draft = (git('status', '--porcelain', '--', file) ?? '') !== '';
  const changes = {};
  if (!draft) for (const c of commits.slice(1, MAX_BASES + 1)) changes[c.sha] = changeSet(c.sha, file);
  return { sha: commits[0].sha, draft, commits, changes };
}

const pageName = (md) => (md === 'README.md' ? 'index.html' : md.replace(/\.md$/, '.html'));
const escapeText = (s) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
/** JSON in a script block, with the characters that could close or open a tag written as escapes. */
const scriptJson = (v) => JSON.stringify(v).replaceAll('<', '\\u003c').replaceAll('>', '\\u003e').replaceAll('&', '\\u0026');

const files = (await readdir(source)).filter((f) => f.endsWith('.md')).sort();
if (!files.includes('README.md')) throw new Error('decisions: docs/decisions/README.md, the index, is missing');
for (const md of files) {
  const file = path.join(source, md);
  const result = render(await readFile(file, 'utf8'));
  if (result.outcome !== 'rendered') throw new Error(`decisions: ${md} did not render: ${result.outcome}`);
  const { changes, ...h } = history(path.relative(repo, file));
  const data = { info: { title: result.meta.title, frontList: result.meta.frontList, ...h }, changes };
  const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeText(result.meta.title ?? md)}</title>
<link rel="stylesheet" href="assets/reader.css">
<style>html, body { margin: 0; } [data-decisions-root] { min-height: 100vh; }</style>
</head>
<body>
<div data-decisions-root>
${result.html}
</div>
<script type="application/json" data-decisions-info>${scriptJson(data)}</script>
<script src="decisions.js"></script>
</body>
</html>
`;
  await writeFile(path.join(out, pageName(md)), page);
}

// The page script: point same-folder `.md` links at their pages, then enhance the root with the page's history.
const entry = `
import { enhance } from ${JSON.stringify(path.join(repo, 'src', 'enhance', 'index.ts'))};
const root = document.querySelector('[data-decisions-root]');
const { info, changes } = JSON.parse(document.querySelector('script[data-decisions-info]').textContent);
for (const a of root.querySelectorAll('a[href]')) {
  const m = /^([A-Za-z0-9_-]+)\\.md(#.*)?$/.exec(a.getAttribute('href'));
  if (m) a.setAttribute('href', (m[1] === 'README' ? 'index' : m[1]) + '.html' + (m[2] ?? ''));
}
// The reader's state (prefs, read marks, the last visit) in this browser's localStorage, under the namespace's keys.
// A page with no storage (a private window, blocked site data) still reads, with nothing kept.
const snapshot = {};
let store = null;
try {
  store = window.localStorage;
  for (let i = 0; i < store.length; i++) {
    const k = store.key(i);
    if (k !== null && k.startsWith('decisions:')) snapshot[k] = store.getItem(k) ?? '';
  }
} catch {
  store = null;
}
enhance(root, {
  info,
  namespace: 'decisions',
  storageKey: location.pathname.split('/').pop() || 'index.html',
  storage: store === null ? undefined : { snapshot, set: (k, v) => (v === null ? store.removeItem(k) : store.setItem(k, v)) },
  changes: (sha) => Promise.resolve(Object.hasOwn(changes, sha) ? changes[sha] : null),
});
`;
await build({
  stdin: { contents: entry, resolveDir: repo, sourcefile: 'decisions-entry.ts', loader: 'ts' },
  outfile: path.join(out, 'decisions.js'),
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'es2022',
  logLevel: 'error',
});
await cp(path.join(repo, 'assets'), path.join(out, 'assets'), { recursive: true });
console.log(`wrote ${files.length} pages; open ${path.join(out, 'index.html')}`);
