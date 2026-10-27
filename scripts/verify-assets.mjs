// npm's prepack (docserver L3, Task 6; plan Reference §10 and §12): the package packs only the asset bytes
// assets/assets.json names.
//
//   node scripts/verify-assets.mjs [--root <dir>]     check the package at <dir> (default: this package)
//
// Refuses, naming each: an assets.json that does not parse, is not manifest 1, or names another package or version
// than package.json; a listing that is not sorted by path in code-unit order or names a path twice; a listed file
// that is missing, or whose bytes, sha256 or CSP hash source differ from the listing; and any file under assets/
// (but assets.json) the listing does not name. So a stale build, a hand edit or a stray file stops `npm pack` (and
// `npm publish`) before the tarball exists. Writes only to stderr, so `npm pack --json` keeps a clean stdout.
//
// Exit codes: 0 every byte is named; 1 a refusal (the reasons on stderr); 2 a usage error. Dev tooling, never
// shipped; types in verify-assets.d.mts.
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** The package root this script belongs to. */
const ROOT = fileURLToPath(new URL('../', import.meta.url));

const order = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/** Every file under `dir`, as paths relative to it with `/`, sorted. */
function filesUnder(dir) {
  const out = [];
  const walk = (rel) => {
    for (const e of readdirSync(path.join(dir, rel), { withFileTypes: true })) {
      const r = rel === '' ? e.name : `${rel}/${e.name}`;
      if (e.isDirectory()) walk(r);
      else out.push(r);
    }
  };
  walk('');
  return out.sort(order);
}

/** Every reason the package at `root` holds asset bytes its assets/assets.json does not name; empty when it holds none. */
export function verifyAssets(root = ROOT) {
  const problems = [];
  const assets = path.join(root, 'assets');
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(path.join(assets, 'assets.json'), 'utf8'));
  } catch (e) {
    return [`assets/assets.json: unreadable (${e instanceof Error ? e.message : String(e)})`];
  }
  const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
  if (manifest === null || typeof manifest !== 'object' || manifest.manifest !== 1 || !Array.isArray(manifest.files)) {
    return ['assets/assets.json: not a manifest 1 with a files list'];
  }
  if (manifest.package !== pkg.name) problems.push(`assets/assets.json: package ${String(manifest.package)}, not ${String(pkg.name)}`);
  if (manifest.version !== pkg.version) problems.push(`assets/assets.json: version ${String(manifest.version)}, not package.json's ${String(pkg.version)}`);
  const paths = manifest.files.map((f) => (f !== null && typeof f === 'object' ? f.path : undefined));
  if (paths.some((p) => typeof p !== 'string' || p === '' || p.startsWith('/') || p.split('/').includes('..'))) {
    return [...problems, 'assets/assets.json: a listed path is not a relative path under assets/'];
  }
  if (paths.join('\n') !== [...paths].sort(order).join('\n')) problems.push('assets/assets.json: the files are not sorted by path');
  if (new Set(paths).size !== paths.length) problems.push('assets/assets.json: a path is listed twice');
  for (const f of manifest.files) {
    const at = path.join(assets, f.path);
    if (!existsSync(at)) {
      problems.push(`assets/${f.path}: listed, but missing (run npm run build)`);
      continue;
    }
    const data = readFileSync(at);
    const digest = createHash('sha256').update(data).digest();
    if (data.length !== f.bytes) problems.push(`assets/${f.path}: ${String(data.length)} bytes, listed as ${String(f.bytes)}`);
    if (digest.toString('hex') !== f.sha256) problems.push(`assets/${f.path}: its sha256 is not the listed one`);
    if (f.csp !== undefined && f.csp !== `'sha256-${digest.toString('base64')}'`) problems.push(`assets/${f.path}: its CSP hash source is not the listed one`);
  }
  const listed = new Set(paths);
  for (const rel of filesUnder(assets)) {
    if (rel !== 'assets.json' && !listed.has(rel)) problems.push(`assets/${rel}: not listed in assets/assets.json`);
  }
  return problems;
}

function main(argv) {
  let root = ROOT;
  if (argv.length === 2 && argv[0] === '--root') root = path.resolve(argv[1]);
  else if (argv.length !== 0) {
    console.error('usage: node scripts/verify-assets.mjs [--root <dir>]');
    return 2;
  }
  const problems = verifyAssets(root);
  if (problems.length > 0) {
    for (const p of problems) console.error(`verify-assets: ${p}`);
    return 1;
  }
  console.error('verify-assets: every file under assets/ is named by assets/assets.json');
  return 0;
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
