// The verdict ratchet and the golden-move rule (docserver L1; architecture section D, Task 11).
//
//   node scripts/ratchet.mjs --base <git ref>
//
// Run from the repository root, it compares the working tree with <base> (CI: origin/<base branch> on a pull
// request, the branch's previous tip on a push, origin/main by hand) and exits 1 with one line per problem, 0
// when there is none, 2 on a usage error.
// 1. compareVerdicts: no hostile or generated case of the base's conformance/hostile.json may be removed or
//    weakened (a missing hostile.json at the base is an empty one). The input spec and the outcome stay the
//    same; every bound (maxMs, maxOutputRatio, each maxTagDepth entry, scan.maxImages) stays present and does
//    not rise; forbid, require and balanced keep every string; exact and nullPrototypeFront stay; headingIds
//    and scan.imagesTruncated stay equal. A key this script does not know is refused, so a new verdict arm
//    cannot slip past it: teach VERDICT_KEYS and compareVerdicts first.
// 2. checkGoldenMoves: if a file under conformance/expected/ changed between the merge base and HEAD, the
//    commits in <base>..HEAD carry `Goldens-moved: <id>, <id>` trailers naming exactly those case ids.
// 3. checkHostileInputs: the input of a hostile case of the base (conformance/corpus/<id>.md, for an entry
//    with no input spec) does not change between the merge base and HEAD. A verdict guards its input, so an
//    edited input is a weakened verdict in disguise, as a changed input spec is: add a new case instead.
// 4. Level 2 of the corpus, conformance/layout/<slug>/<id>.{md,options.json,dom.txt} (docserver L2, Task 6):
//    checkLayoutMoves: if a case's expected snapshot (<id>.dom.txt) was modified or deleted between the merge
//    base and HEAD, the commits in <base>..HEAD carry `Layout-moved: <slug>/<id>, ...` trailers naming exactly
//    those cases (a new case is added, not moved, and needs none). checkLayoutHostile: a case whose options file
//    at the base says `"hostile": true` is never removed (none of its three files is deleted), and its .md and
//    options never change; its snapshot may move, named like any other.
// The pure functions are exported for test/ratchet.test.ts; the command runs only when this file is the
// entry point. Node built-ins only; dev tooling, never shipped.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

/** The verdict keys this ratchet knows; test/ratchet.test.ts keeps it equal to src/conformance/verdict.ts's. */
export const VERDICT_KEYS = Object.freeze([
  'outcome', 'maxMs', 'maxOutputRatio', 'maxTagDepth', 'forbid', 'require', 'balanced', 'exact', 'headingIds',
  'scan', 'nullPrototypeFront',
]);

const HOSTILE = 'conformance/hostile.json';
const EXPECTED = 'conformance/expected/';
const CORPUS = 'conformance/corpus/';
const LAYOUT = 'conformance/layout/';
const LAYOUT_FILE = /^conformance\/layout\/([^/]+\/[^/]+?)\.(md|options\.json|dom\.txt)$/;

/** Every way `head` weakens `base` (two parsed hostile.json arrays), one line per problem. */
export function compareVerdicts(base, head) {
  const out = [];
  const heads = new Map(head.map((e) => [e.id, e]));
  for (const e of head) {
    for (const key of Object.keys(e.verdict)) {
      if (!VERDICT_KEYS.includes(key)) out.push(`${e.id}: unknown verdict key "${key}" (teach scripts/ratchet.mjs first)`);
    }
  }
  for (const b of base) {
    const h = heads.get(b.id);
    if (h === undefined) {
      out.push(`${b.id}: removed (a hostile or generated case is never removed)`);
      continue;
    }
    const was = b.verdict;
    const now = h.verdict;
    const say = (what) => out.push(`${b.id}: ${what}`);
    if (!isDeepStrictEqual(b.input, h.input)) say('input changed (add a new case instead)');
    if (now.outcome !== was.outcome) say(`outcome changed from ${was.outcome} to ${now.outcome}`);
    for (const key of ['maxMs', 'maxOutputRatio']) {
      if (was[key] === undefined) continue;
      if (now[key] === undefined) say(`${key} removed`);
      else if (now[key] > was[key]) say(`${key} raised from ${was[key]} to ${now[key]}`);
    }
    for (const [tag, bound] of Object.entries(was.maxTagDepth ?? {})) {
      const next = now.maxTagDepth?.[tag];
      if (next === undefined) say(`maxTagDepth.${tag} removed`);
      else if (next > bound) say(`maxTagDepth.${tag} raised from ${bound} to ${next}`);
    }
    for (const key of ['forbid', 'require', 'balanced']) {
      const kept = new Set(now[key] ?? []);
      for (const s of was[key] ?? []) if (!kept.has(s)) say(`${key} lost ${JSON.stringify(s)}`);
    }
    for (const key of ['exact', 'nullPrototypeFront']) {
      if (was[key] === true && now[key] !== true) say(`${key} dropped`);
    }
    if (was.headingIds !== undefined && !isDeepStrictEqual(was.headingIds, now.headingIds)) say('headingIds changed');
    if (was.scan !== undefined) {
      if (now.scan === undefined) say('scan removed');
      else {
        if (now.scan.maxImages > was.scan.maxImages) say(`scan.maxImages raised from ${was.scan.maxImages} to ${now.scan.maxImages}`);
        if (now.scan.imagesTruncated !== was.scan.imagesTruncated) say('scan.imagesTruncated changed');
      }
    }
  }
  return out;
}

/** The ids whose expected files changed but no trailer names, and the ids a trailer names that did not change. */
export function checkGoldenMoves(changedIds, trailerIds) {
  const changed = new Set(changedIds);
  const named = new Set(trailerIds);
  const out = [];
  for (const id of [...changed].sort()) {
    if (!named.has(id)) out.push(`${id}: its expected files changed, and no Goldens-moved trailer names it`);
  }
  for (const id of [...named].sort()) {
    if (!changed.has(id)) out.push(`${id}: a Goldens-moved trailer names it, and its expected files did not change`);
  }
  return out;
}

/**
 * The hostile cases of the base whose input file is among the changed paths, one line each. Only entries
 * with no input spec read conformance/corpus/<id>.md; a generated case's input is its spec, which
 * compareVerdicts already holds equal.
 */
export function checkHostileInputs(base, changedPaths) {
  const changed = new Set(changedPaths);
  return base
    .filter((e) => e.input === undefined && changed.has(`${CORPUS}${e.id}.md`))
    .map((e) => `${e.id}: its input changed (add a new case instead)`);
}

/** The ids in `git log --format=%(trailers:key=Goldens-moved,valueonly,unfold)` output: comma or line separated. */
export function parseTrailerIds(log) {
  return [...new Set(log.split(/[,\n\0]/).map((s) => s.trim()).filter((s) => s !== ''))];
}

/** The case ids of changed paths under conformance/expected/ (<id>.html or <id>.meta.json), each once, sorted. */
export function expectedIds(paths) {
  const ids = paths
    .filter((p) => p.startsWith(EXPECTED))
    .map((p) => p.slice(EXPECTED.length).replace(/\.meta\.json$|\.html$/, ''));
  return [...new Set(ids)].sort();
}

/**
 * The changes under conformance/layout/ in `git diff --name-status --no-renames` output, as { status, path, id, kind }:
 * status one letter (A, M, D, T), id `<slug>/<id>`, kind md, options.json or dom.txt. Other paths are left out.
 */
export function layoutChanges(nameStatus) {
  const out = [];
  for (const line of nameStatus.split('\n')) {
    const tab = line.indexOf('\t');
    if (tab < 0) continue;
    const path = line.slice(tab + 1);
    const m = LAYOUT_FILE.exec(path);
    if (m !== null) out.push({ status: line.slice(0, tab).charAt(0), path, id: m[1], kind: m[2] });
  }
  return out;
}

/** The case ids whose expected snapshot was modified, retyped or deleted, each once, sorted. An added one is not a move. */
export function movedLayoutIds(changes) {
  return [...new Set(changes.filter((c) => c.kind === 'dom.txt' && c.status !== 'A').map((c) => c.id))].sort();
}

/** The moved cases no Layout-moved trailer names, and the names that match no moved case. */
export function checkLayoutMoves(movedIds, trailerIds) {
  const moved = new Set(movedIds);
  const named = new Set(trailerIds);
  const out = [];
  for (const id of [...moved].sort()) {
    if (!named.has(id)) out.push(`${id}: its layout snapshot changed, and no Layout-moved trailer names it`);
  }
  for (const id of [...named].sort()) {
    if (!moved.has(id)) out.push(`${id}: a Layout-moved trailer names it, and its layout snapshot did not change`);
  }
  return out;
}

/** The ids of the hostile layout cases among options files ({ path, text }, as the base holds them), sorted. */
export function hostileLayoutIds(files) {
  const ids = [];
  for (const f of files) {
    const m = LAYOUT_FILE.exec(f.path);
    if (m === null || m[2] !== 'options.json') continue;
    if (JSON.parse(f.text).hostile === true) ids.push(m[1]);
  }
  return ids.sort();
}

/** Every way the changes remove or edit a hostile layout case, one line per case and problem. */
export function checkLayoutHostile(hostileIds, changes) {
  const hostile = new Set(hostileIds);
  const out = [];
  for (const id of [...hostile].sort()) {
    const mine = changes.filter((c) => c.id === id);
    if (mine.some((c) => c.status === 'D')) out.push(`${id}: a hostile layout case was removed (a hostile case is never removed)`);
    else if (mine.some((c) => c.kind !== 'dom.txt')) out.push(`${id}: a hostile layout case's input or options changed (add a new case instead)`);
  }
  return out;
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function main(argv) {
  const at = argv.indexOf('--base');
  const base = at >= 0 ? argv[at + 1] : undefined;
  if (base === undefined || base === '' || argv.length !== 2) {
    console.error('usage: node scripts/ratchet.mjs --base <git ref>');
    return 2;
  }
  try {
    git(['rev-parse', '--verify', '--quiet', `${base}^{commit}`]);
  } catch {
    console.error(`ratchet: unknown base ${JSON.stringify(base)}`);
    return 2;
  }
  // A base without hostile.json has no verdicts to keep; a base whose hostile.json does not parse is an error.
  let atBase = true;
  try {
    git(['cat-file', '-e', `${base}:${HOSTILE}`]);
  } catch {
    atBase = false;
  }
  const baseHostile = atBase ? JSON.parse(git(['show', `${base}:${HOSTILE}`])) : [];
  const headHostile = JSON.parse(readFileSync(HOSTILE, 'utf8'));
  const changed = expectedIds(
    git(['diff', '--name-only', '--no-renames', `${base}...HEAD`, '--', EXPECTED]).split('\n').filter((p) => p !== ''),
  );
  const named = parseTrailerIds(git(['log', '--format=%(trailers:key=Goldens-moved,valueonly,unfold)%x00', `${base}..HEAD`]));
  const inputs = git(['diff', '--name-only', '--no-renames', `${base}...HEAD`, '--', CORPUS]).split('\n').filter((p) => p !== '');
  // Level 2: the hostile cases as the base defines them (an options file at the base that does not parse is an error).
  const baseLayout = git(['ls-tree', '-r', '--name-only', base, '--', LAYOUT])
    .split('\n')
    .filter((p) => p.endsWith('.options.json'))
    .map((p) => ({ path: p, text: git(['show', `${base}:${p}`]) }));
  const hostileLayout = hostileLayoutIds(baseLayout);
  const layout = layoutChanges(git(['diff', '--name-status', '--no-renames', `${base}...HEAD`, '--', LAYOUT]));
  const moved = movedLayoutIds(layout);
  const layoutNamed = parseTrailerIds(git(['log', '--format=%(trailers:key=Layout-moved,valueonly,unfold)%x00', `${base}..HEAD`]));
  const problems = [
    ...compareVerdicts(baseHostile, headHostile),
    ...checkGoldenMoves(changed, named),
    ...checkHostileInputs(baseHostile, inputs),
    ...checkLayoutMoves(moved, layoutNamed),
    ...checkLayoutHostile(hostileLayout, layout),
  ];
  for (const p of problems) console.error(`ratchet: ${p}`);
  if (problems.length > 0) return 1;
  console.log(
    `ratchet: ${baseHostile.length} verdicts kept, ${changed.length} golden moves named, ` +
      `${hostileLayout.length} hostile layout cases kept, ${moved.length} layout moves named`,
  );
  return 0;
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
