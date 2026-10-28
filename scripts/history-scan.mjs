// The history scan (docserver L3, Task 14): everything that becomes public with the repository, read once before the
// flip (Task 15 step 1), for the shapes of private detail and the names a names file lists.
//
//   node scripts/history-scan.mjs [--all] [--github] [--repo <owner/name>] [--remote <name>] --names-file <path>
//
// --all     First fetches every branch of the remote (backup branches included), every tag, and every pull-request
//           head (`+refs/pull/*:refs/remotes/pull/*`: a plain clone holds no pull-request refs, and superseded heads
//           become public with the repository), and every other ref the remote advertises (`git ls-remote`: notes, a
//           backup namespace, anything outside those three), each into refs/history-scan/, since anyone can fetch it
//           once the repository is public. Then reads every object `git rev-list --objects --all` lists: each
//           blob's text, each commit and tag object whole (message, author and tagger lines), each tree entry's name,
//           and every ref name.
// --github  Reads, through `gh api --paginate`, every pull request (title, body, and its head and base branch names,
//           which its page keeps after the branch is deleted), issue (title and body), issue
//           comment, review (per pull request), review comment, commit comment and release (name and notes); then,
//           through GraphQL `userContentEdits`, every edit revision of each of those but the releases, which keep none.
//           GitHub keeps revisions its API cannot delete, and they become public too. The repository is --repo, or
//           the remote's URL when it names a GitHub repository.
// --names-file is required and must lie outside the repository, so the list never reaches a commit. One name per
//           line; blank lines and lines starting with `#` are skipped; it must list at least one name.
//
// Output: one line per hit, `history-scan: hit: <where>: <shape>`, then what was read and the count of hits. A hit
// names its location and its shape class (scripts/public-shapes.mjs's shapes, which the tree test reads too, or
// `listed name`) and never the matched text. A location that would itself show a hit (a path or a ref named for a
// listed name, say) is not printed: a ref is located by its number and the object it points at, a tree entry by its
// number, and a blob whose path holds a hit by its object id alone. Any hit, an edit revision's included, returns the
// flip decision to the operator.
//
// Exit codes: 0 no hit; 1 at least one hit; 2 a usage error, or any read that failed (git, gh, an answer that is not
// what was asked): the scan fails closed and never reports a clean result it did not read. Dev tooling, never shipped;
// types in history-scan.d.mts.
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SHAPES, findShapes, namesShape, parseNames } from './public-shapes.mjs';

export const USAGE =
  'usage: node scripts/history-scan.mjs [--all] [--github] [--repo <owner/name>] [--remote <name>] --names-file <path outside the repository>';

/** The refspecs the history mode fetches before it reads: every branch, every pull-request head, every tag. */
export function fetchRefspecs(remote) {
  return [`+refs/heads/*:refs/remotes/${remote}/*`, '+refs/pull/*:refs/remotes/pull/*', '+refs/tags/*:refs/tags/*'];
}

/** Where a ref the remote advertises outside branches, tags and pull requests is fetched to: its name under this prefix. */
export const OTHER_REFS = 'refs/history-scan/';

/**
 * The refspecs that fetch every ref of a `git ls-remote` answer outside refs/heads/, refs/tags/ and refs/pull/, each to
 * its own name under OTHER_REFS. HEAD and the peeled `^{}` lines are skipped; a line that is not `<id>\t<ref>` throws.
 */
export function otherRefspecs(lsRemote) {
  const out = [];
  for (const line of lsRemote.split('\n')) {
    if (line === '') continue;
    const m = /^[0-9a-f]{40,64}\t(\S+)$/.exec(line);
    if (m === null) throw new ScanError('git ls-remote: an answer that is not a ref list');
    const ref = m[1];
    if (ref === 'HEAD' || ref.endsWith('^{}')) continue;
    if (!ref.startsWith('refs/')) throw new ScanError('git ls-remote: a ref outside refs/');
    if (/^refs\/(?:heads|tags|pull)\//.test(ref)) continue;
    out.push(`+${ref}:${OTHER_REFS}${ref.slice('refs/'.length)}`);
  }
  return out;
}

/** A shipped font: binary, pinned by hash in assets/fonts/README.md; skipped only when its bytes are not UTF-8 text. */
const FONT_PATH = /^assets\/fonts\/[^/]+\.woff2$/;

class ScanError extends Error {}

/** Run a command to completion; throws a ScanError naming it when it fails. stdout as a Buffer. */
function run(cmd, args, cwd, env) {
  const r = spawnSync(cmd, args, { cwd, env, maxBuffer: 1024 * 1024 * 1024 });
  if (r.error !== undefined) throw new ScanError(`${cmd} ${args[0] ?? ''} could not run: ${r.error.message}`);
  if (r.status !== 0) {
    const said = String(r.stderr ?? '').trim().split('\n').filter((l) => l !== '').slice(0, 5).join(' | ');
    throw new ScanError(`${cmd} ${args.slice(0, 2).join(' ')} exited ${String(r.status)}${said === '' ? '' : `: ${said}`}`);
  }
  return r.stdout;
}

/** Each object of `shas`, read through one `git cat-file --batch`: calls `each(sha, type, bytes)` in order. */
function readObjects(cwd, shas, each) {
  return new Promise((resolve, reject) => {
    const child = spawn('git', ['cat-file', '--batch'], { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
    let buf = Buffer.alloc(0);
    let failed = null;
    let err = '';
    child.stderr.on('data', (d) => {
      err += String(d);
    });
    child.stdout.on('data', (d) => {
      buf = buf.length === 0 ? d : Buffer.concat([buf, d]);
      for (;;) {
        const nl = buf.indexOf(10);
        if (nl < 0) return;
        const header = buf.subarray(0, nl).toString('utf8').split(' ');
        if (header[1] === 'missing') {
          failed ??= new ScanError(`git cat-file: object ${header[0] ?? ''} is missing`);
          buf = buf.subarray(nl + 1);
          continue;
        }
        const size = Number(header[2]);
        if (!Number.isInteger(size) || header.length !== 3) {
          failed ??= new ScanError('git cat-file: an answer that is not an object header');
          child.kill();
          return;
        }
        if (buf.length < nl + 1 + size + 1) return;
        try {
          each(header[0], header[1], buf.subarray(nl + 1, nl + 1 + size));
        } catch (e) {
          failed ??= e;
        }
        buf = buf.subarray(nl + 1 + size + 1);
      }
    });
    child.on('error', (e) => reject(new ScanError(`git cat-file could not run: ${e.message}`)));
    child.on('close', (code) => {
      if (failed !== null) reject(failed);
      else if (code !== 0) reject(new ScanError(`git cat-file exited ${String(code)}: ${err.trim()}`));
      else if (buf.length !== 0) reject(new ScanError('git cat-file: a truncated answer'));
      else resolve();
    });
    child.stdin.end(shas.length === 0 ? '' : `${shas.join('\n')}\n`);
  });
}

/** The names of a raw tree object's entries, in order (`<mode> <name>\0<20-byte id>` each). */
function treeEntries(bytes) {
  const names = [];
  let at = 0;
  while (at < bytes.length) {
    const space = bytes.indexOf(32, at);
    const nul = bytes.indexOf(0, space);
    if (space < 0 || nul < 0) throw new ScanError('git cat-file: a tree that does not parse');
    names.push(bytes.subarray(space + 1, nul).toString('utf8'));
    at = nul + 21;
  }
  return names;
}

/** The text of a blob, or null when it is not valid UTF-8. */
function utf8(bytes) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

/**
 * Scan the history of the repository at `cwd`: fetch (unless `fetch` is false), then read every object, every ref name.
 * Resolves with `{hits, counts}`; each hit is `{where, shape}`.
 */
export async function scanHistory({ cwd, remote = 'origin', shapes, fetch = true }) {
  const hits = [];
  const hit = (where, text) => {
    for (const f of findShapes(text, shapes)) hits.push({ where: `${where} line ${String(f.line)}`, shape: f.shape });
  };
  /** A location to print: itself, unless it would show a hit. */
  const shown = (text) => (findShapes(text, shapes).length === 0 ? text : null);
  let other = 0;
  if (fetch) {
    const others = otherRefspecs(String(run('git', ['ls-remote', remote], cwd)));
    other = others.length;
    run('git', ['fetch', '--quiet', '--no-write-fetch-head', remote, ...fetchRefspecs(remote), ...others], cwd);
  }
  const refs = String(run('git', ['for-each-ref', '--format=%(objectname) %(refname)'], cwd))
    .split('\n')
    .filter((l) => l !== '');
  refs.forEach((line, i) => {
    const sp = line.indexOf(' ');
    const name = line.slice(sp + 1);
    for (const f of findShapes(name, shapes)) hits.push({ where: `ref ${String(i + 1)} of ${String(refs.length)} (at ${line.slice(0, sp)})`, shape: f.shape });
  });
  const listed = String(run('git', ['rev-list', '--objects', '--all'], cwd))
    .split('\n')
    .filter((l) => l !== '');
  const pathOf = new Map();
  for (const l of listed) {
    const sp = l.indexOf(' ');
    pathOf.set(sp < 0 ? l : l.slice(0, sp), sp < 0 ? '' : l.slice(sp + 1));
  }
  // Tag objects a ref names directly, should rev-list leave one out.
  for (const line of String(run('git', ['for-each-ref', '--format=%(objectname) %(objecttype)'], cwd)).split('\n')) {
    const [sha, type] = line.split(' ');
    if (type === 'tag' && sha !== undefined && !pathOf.has(sha)) pathOf.set(sha, '');
  }
  const counts = { commits: 0, trees: 0, blobs: 0, fonts: 0, tags: 0, refs: refs.length, other };
  await readObjects(cwd, [...pathOf.keys()], (sha, type, bytes) => {
    if (type === 'commit') {
      counts.commits += 1;
      hit(`commit ${sha}`, bytes.toString('utf8'));
    } else if (type === 'tag') {
      counts.tags += 1;
      hit(`tag ${sha}`, bytes.toString('utf8'));
    } else if (type === 'tree') {
      counts.trees += 1;
      treeEntries(bytes).forEach((name, i) => {
        for (const f of findShapes(name, shapes)) hits.push({ where: `tree ${sha} entry ${String(i + 1)}`, shape: f.shape });
      });
    } else if (type === 'blob') {
      const where = pathOf.get(sha) ?? '';
      const text = utf8(bytes);
      if (text === null && FONT_PATH.test(where)) {
        counts.fonts += 1;
        return;
      }
      counts.blobs += 1;
      const at = shown(where);
      hit(at === null || at === '' ? `blob ${sha}` : `blob ${sha} ${at}`, text ?? bytes.toString('utf8'));
    } else {
      throw new ScanError(`git cat-file: an object of type ${String(type)}`);
    }
  });
  return { hits, counts };
}

/**
 * Every JSON value of a text that holds several, one after another (what `gh api --paginate` prints: one JSON document
 * per page, with or without white space between them). Throws on anything else.
 */
export function parseJsonStream(text) {
  const out = [];
  let i = 0;
  const n = text.length;
  while (i < n) {
    while (i < n && /\s/.test(text[i])) i += 1;
    if (i >= n) break;
    const start = i;
    let depth = 0;
    let inString = false;
    for (; i < n; i += 1) {
      const c = text[i];
      if (inString) {
        if (c === '\\') i += 1;
        else if (c === '"') inString = false;
      } else if (c === '"') inString = true;
      else if (c === '{' || c === '[') depth += 1;
      else if (c === '}' || c === ']') {
        depth -= 1;
        if (depth === 0) {
          i += 1;
          break;
        }
      } else if (depth === 0) throw new ScanError('gh: an answer that is not JSON');
    }
    if (depth !== 0) throw new ScanError('gh: a truncated JSON answer');
    try {
      out.push(JSON.parse(text.slice(start, i)));
    } catch {
      throw new ScanError('gh: an answer that is not JSON');
    }
  }
  return out;
}

/** A gh caller that runs the `gh` on PATH in `cwd` and returns the JSON values it printed. */
export function ghCli(cwd) {
  return (args) => parseJsonStream(String(run('gh', args, cwd)));
}

/** A GitHub node id, as the REST answers give it: safe to write into a GraphQL string. */
const NODE_ID = /^[A-Za-z0-9_=-]+$/;

const EDITS_FIELDS = 'userContentEdits(first: 100) { totalCount pageInfo { hasNextPage endCursor } nodes { diff } }';

/**
 * Scan the GitHub texts of `repo` (`owner/name`) through `gh` (a function from gh's arguments to the JSON values it
 * printed). Resolves with `{hits, counts}`.
 */
export async function scanGithub({ repo, gh, shapes }) {
  const hits = [];
  const hit = (where, text) => {
    if (typeof text !== 'string') return;
    for (const f of findShapes(text, shapes)) hits.push({ where: `${where} line ${String(f.line)}`, shape: f.shape });
  };
  /** Every item of a paginated REST list: the pages gh printed, each an array, flattened. */
  const list = (endpoint) => {
    const pages = gh(['api', '--paginate', `repos/${repo}/${endpoint}`]);
    if (!pages.every((p) => Array.isArray(p))) throw new ScanError(`gh: ${endpoint} did not answer a list`);
    return pages.flat();
  };
  const objects = [];
  const pulls = list('pulls?state=all&per_page=100');
  for (const p of pulls) {
    hit(`github pull #${String(p.number)} title`, p.title);
    hit(`github pull #${String(p.number)} body`, p.body);
    hit(`github pull #${String(p.number)} head branch name`, p.head?.ref);
    hit(`github pull #${String(p.number)} base branch name`, p.base?.ref);
    objects.push({ id: p.node_id, label: `pull #${String(p.number)}` });
  }
  const issues = list('issues?state=all&per_page=100').filter((i) => i.pull_request === undefined);
  for (const i of issues) {
    hit(`github issue #${String(i.number)} title`, i.title);
    hit(`github issue #${String(i.number)} body`, i.body);
    objects.push({ id: i.node_id, label: `issue #${String(i.number)}` });
  }
  const comments = list('issues/comments?per_page=100');
  for (const c of comments) {
    hit(`github issue-comment ${String(c.id)} body`, c.body);
    objects.push({ id: c.node_id, label: `issue-comment ${String(c.id)}` });
  }
  const reviewComments = list('pulls/comments?per_page=100');
  for (const c of reviewComments) {
    hit(`github review-comment ${String(c.id)} body`, c.body);
    objects.push({ id: c.node_id, label: `review-comment ${String(c.id)}` });
  }
  let reviews = 0;
  for (const p of pulls) {
    for (const r of list(`pulls/${String(p.number)}/reviews?per_page=100`)) {
      reviews += 1;
      hit(`github review ${String(r.id)} body`, r.body);
      objects.push({ id: r.node_id, label: `review ${String(r.id)}` });
    }
  }
  const commitComments = list('comments?per_page=100');
  for (const c of commitComments) {
    hit(`github commit-comment ${String(c.id)} body`, c.body);
    objects.push({ id: c.node_id, label: `commit-comment ${String(c.id)}` });
  }
  const releases = list('releases?per_page=100');
  for (const r of releases) {
    hit(`github release ${String(r.id)} name`, r.name);
    hit(`github release ${String(r.id)} body`, r.body);
  }
  let edits = 0;
  for (const o of objects) if (typeof o.id !== 'string' || !NODE_ID.test(o.id)) throw new ScanError(`gh: ${o.label} has no node id`);
  for (let at = 0; at < objects.length; at += 100) {
    const batch = objects.slice(at, at + 100);
    const query = `query { nodes(ids: [${batch.map((o) => `"${o.id}"`).join(', ')}]) { id ... on Comment { ${EDITS_FIELDS} } } }`;
    const [answer] = gh(['api', 'graphql', '-f', `query=${query}`]);
    const nodes = answer?.data?.nodes;
    if (!Array.isArray(nodes) || nodes.length !== batch.length || answer.errors !== undefined) throw new ScanError('gh: the edits query was not answered in full');
    for (const [k, o] of batch.entries()) {
      const node = nodes[k];
      const conn = node?.userContentEdits;
      if (node === null || node?.id !== o.id || conn === undefined) throw new ScanError(`gh: no edit history for ${o.label}`);
      let diffs = conn.nodes.map((e) => e?.diff);
      if (conn.pageInfo?.hasNextPage === true) {
        const q = `query($endCursor: String) { node(id: "${o.id}") { ... on Comment { userContentEdits(first: 100, after: $endCursor) { pageInfo { hasNextPage endCursor } nodes { diff } } } } }`;
        const pages = gh(['api', 'graphql', '--paginate', '-f', `query=${q}`]);
        diffs = pages.flatMap((p) => {
          const c = p?.data?.node?.userContentEdits;
          if (c === undefined || p.errors !== undefined) throw new ScanError(`gh: the edit history of ${o.label} was not answered`);
          return c.nodes.map((e) => e?.diff);
        });
        if (diffs.length !== conn.totalCount) throw new ScanError(`gh: ${o.label} has ${String(conn.totalCount)} edits, read ${String(diffs.length)}`);
      }
      edits += diffs.length;
      diffs.forEach((d, i) => hit(`github edit of ${o.label}, revision ${String(i + 1)} of ${String(diffs.length)},`, d));
    }
  }
  const counts = {
    pulls: pulls.length,
    issues: issues.length,
    'issue comments': comments.length,
    'review comments': reviewComments.length,
    reviews,
    'commit comments': commitComments.length,
    releases: releases.length,
    'edit revisions': edits,
  };
  return { hits, counts };
}

/** `owner/name` of a GitHub remote URL (https or ssh form), or null. */
export function githubRepoOf(url) {
  const m = /^(?:https:\/\/github\.com\/|ssh:\/\/git@github\.com\/|git@github\.com:)([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/.exec(url.trim());
  return m === null ? null : `${m[1]}/${m[2]}`;
}

/** The command line, or null when it is malformed. */
export function parseArgs(argv) {
  const out = { all: false, github: false, repo: null, remote: 'origin', namesFile: null };
  const seen = new Set();
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (seen.has(a)) return null;
    seen.add(a);
    if (a === '--all') out.all = true;
    else if (a === '--github') out.github = true;
    else if (a === '--repo' || a === '--remote' || a === '--names-file') {
      const v = argv[i + 1];
      if (v === undefined || v.startsWith('--')) return null;
      i += 1;
      if (a === '--repo') out.repo = v;
      else if (a === '--remote') out.remote = v;
      else out.namesFile = v;
    } else return null;
  }
  if ((!out.all && !out.github) || out.namesFile === null) return null;
  if (out.repo !== null && !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(out.repo)) return null;
  if (!/^[A-Za-z0-9_.-]+$/.test(out.remote)) return null;
  return out;
}

async function main(argv) {
  const args = parseArgs(argv);
  if (args === null) {
    console.error(USAGE);
    return 2;
  }
  const say = (line) => console.log(`history-scan: ${line}`);
  try {
    const cwd = process.cwd();
    const top = realpathSync(String(run('git', ['rev-parse', '--show-toplevel'], cwd)).trim());
    let namesPath;
    try {
      namesPath = realpathSync(args.namesFile);
    } catch {
      throw new ScanError('the names file cannot be read');
    }
    if (namesPath === top || namesPath.startsWith(`${top}${path.sep}`)) throw new ScanError('the names file lies inside the repository; keep it outside, so the list never reaches a commit');
    let names;
    try {
      names = parseNames(readFileSync(namesPath, 'utf8'));
    } catch (e) {
      throw new ScanError(e instanceof Error ? e.message : 'the names file cannot be read');
    }
    const shapes = [...SHAPES, namesShape(names)];
    let repo = args.repo;
    if (args.github && repo === null) {
      repo = githubRepoOf(String(run('git', ['remote', 'get-url', args.remote], cwd)));
      if (repo === null) throw new ScanError(`the remote ${args.remote} is not a GitHub repository; name it with --repo`);
    }
    const found = [];
    const lines = [];
    if (args.all) {
      const h = await scanHistory({ cwd, remote: args.remote, shapes });
      found.push(...h.hits);
      const c = h.counts;
      lines.push(`read ${String(c.commits)} commits, ${String(c.trees)} trees, ${String(c.blobs)} blobs, ${String(c.tags)} tags, ${String(c.refs)} refs`);
      if (c.other > 0) lines.push(`fetched ${String(c.other)} refs outside branches, tags and pull requests`);
      if (c.fonts > 0) lines.push(`skipped ${String(c.fonts)} binary fonts under assets/fonts (pinned by hash in assets/fonts/README.md)`);
    }
    if (args.github) {
      const g = await scanGithub({ repo, gh: ghCli(cwd), shapes });
      found.push(...g.hits);
      lines.push(`read ${Object.entries(g.counts).map(([k, v]) => `${String(v)} ${k}`).join(', ')}`);
    }
    const unique = [...new Set(found.map((h) => `${h.where}: ${h.shape}`))];
    for (const h of unique) say(`hit: ${h}`);
    for (const l of lines) say(l);
    say(`${String(unique.length)} hits`);
    return unique.length === 0 ? 0 : 1;
  } catch (e) {
    console.error(`history-scan: ${e instanceof ScanError ? e.message : 'failed: '.concat(e instanceof Error ? e.name : 'an error')}`);
    return 2;
  }
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}
