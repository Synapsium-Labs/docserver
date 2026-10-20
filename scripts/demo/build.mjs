// Builds a demo page for the reading layout: a sample (scripts/demo/samples/core.md unless --sample names another
// Markdown file) rendered by the repo's own render(), inserted in a root element, then enhanced. It writes demo-out/
// (git-ignored; --out names another directory, which must not exist yet): index.html, demo.js and assets/ (a copy
// of the stylesheet and fonts). Open index.html in a browser; the query parameters theme (auto, light, dark), width
// (standard, wide) and font (serif, sans) choose the prefs, through setEnhancementPrefs. The page's <html> carries
// data-ready="false" until the layout is built and the prefs applied, then "true": scripts/visual/compare.mjs waits
// for it.
//
// Run it from the repository root: node scripts/demo/build.mjs [--sample <file>] [--out <dir>]
import { existsSync } from 'node:fs';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const USAGE = 'usage: node scripts/demo/build.mjs [--sample <file>] [--out <dir>]';
const repo = fileURLToPath(new URL('../../', import.meta.url));
const args = process.argv.slice(2);
const given = {};
for (let i = 0; i < args.length; i += 2) {
  const key = { '--sample': 'sample', '--out': 'out' }[args[i]];
  const value = args[i + 1];
  if (key === undefined || value === undefined || value === '' || Object.hasOwn(given, key)) {
    console.error(USAGE);
    process.exit(2);
  }
  given[key] = value;
}
const sample = given.sample === undefined ? path.join(repo, 'scripts', 'demo', 'samples', 'core.md') : path.resolve(given.sample);
const out = given.out === undefined ? path.join(repo, 'demo-out') : path.resolve(given.out);
if (given.out !== undefined && existsSync(out)) {
  console.error(`demo: ${out} exists; --out names a directory that does not exist yet`);
  process.exit(2);
}

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

// render() from the source tree, bundled for Node into a scratch file inside demo-out.
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
const result = render(await readFile(sample, 'utf8'));
if (result.outcome !== 'rendered') throw new Error(`the sample did not render: ${result.outcome}`);
await rm(renderFile);

// The page script: enhance the root, then apply the prefs from the query.
const entry = `
import { enhance, setEnhancementPrefs } from ${JSON.stringify(path.join(repo, 'src', 'enhance', 'index.ts'))};
const root = document.querySelector('[data-demo-root]');
const info = JSON.parse(document.querySelector('script[data-demo-info]').textContent);
const q = new URLSearchParams(location.search);
enhance(root, { info }).then(() => {
  const prefs = {};
  for (const key of ['theme', 'width', 'font']) if (q.has(key)) prefs[key] = q.get(key);
  setEnhancementPrefs(root, prefs);
  document.documentElement.dataset.ready = 'true';
});
`;
await build({
  stdin: { contents: entry, resolveDir: repo, sourcefile: 'demo-entry.ts', loader: 'ts' },
  outfile: path.join(out, 'demo.js'),
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'es2022',
  logLevel: 'error',
});

await cp(path.join(repo, 'assets'), path.join(out, 'assets'), { recursive: true });

// Data in a JSON script block, with the characters that could close or open a tag written as escapes.
const json = JSON.stringify({ title: result.meta.title, frontList: result.meta.frontList })
  .replaceAll('<', '\\u003c')
  .replaceAll('>', '\\u003e')
  .replaceAll('&', '\\u0026');

const title = (result.meta.title ?? 'Sample').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const page = `<!doctype html>
<html lang="en" data-ready="false">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<link rel="stylesheet" href="assets/reader.css">
<style>html, body { margin: 0; } [data-demo-root] { min-height: 100vh; }</style>
</head>
<body>
<div data-demo-root>
${result.html}
</div>
<script type="application/json" data-demo-info>${json}</script>
<script src="demo.js"></script>
</body>
</html>
`;
await writeFile(path.join(out, 'index.html'), page);
console.log(`wrote ${path.join(out, 'index.html')}`);
