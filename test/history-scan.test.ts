// The history scan, scripts/history-scan.mjs (docserver L3, Task 14). Before the repository goes public (Task 15),
// `node scripts/history-scan.mjs --all --github --names-file <a file outside the repository>` reads everything that
// becomes public with it: every object of every ref after fetching every remote branch, every tag and every
// pull-request head (`+refs/pull/*:refs/remotes/pull/*`, which a plain clone never holds), every commit and tag
// message, every tree entry's name and every ref name; then every pull request, issue, issue comment, review, review
// comment, commit comment and release text through `gh api --paginate` (with each pull request's head and base branch
// names, which its page keeps after the branch is deleted), and every edit revision of each through
// GraphQL `userContentEdits`. It looks for the shapes the tree test looks for (scripts/public-shapes.mjs) and the
// names the names file lists, and prints locations and shape classes only, never the matched text.
//
// Nothing here reaches a network or GitHub. The fixture repositories are made under the system temp directory and
// removed after: a bare "remote" holding a pull-request ref and a backup branch (and, pushed after the clone, a second
// backup branch and a tag on a commit no branch holds), and a clone of it the scan runs in, so
// the scan's fetch is a local one. GitHub is a fake `gh` first on PATH, answering from a recorded state written at run
// time (the REST pages each endpoint gives, concatenated as `gh api --paginate` prints them, and the edit revisions
// GraphQL gives, two to a page so the scan's own pagination runs). Every planted hit and every listed name is built at
// run time or invented, so this file holds no positive itself and the tree test scans it like any other file.
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SpawnSyncReturns } from 'node:child_process';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LISTED_NAME, SHAPES, findShapes, namesShape, parseNames } from '../scripts/public-shapes.mjs';
import { OTHER_REFS, otherRefspecs } from '../scripts/history-scan.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SCRIPT = path.join(ROOT, 'scripts', 'history-scan.mjs');

/** Join pieces at run time, so this file never holds a positive literally. */
const j = (...parts: string[]): string => parts.join('');
/** One planted hit of each shape class, and two invented names for the names file. */
const HOME = j('/ho', 'me/fixture-user/notes');
const MAIL = j('fixture.person', '@', 'corp-a.com');
const ADDRESS = [10, 20, 30, 40].join('.');
const HOST = j('build-box.', 'internal');
const CREDENTIAL = j('gh', 'p_', 'Q'.repeat(36));
const NAME_A = 'zorvexa';
const NAME_B = 'quillmarsh';
/** Everything the scan must never print. */
const SECRETS = [HOME, MAIL, ADDRESS, HOST, CREDENTIAL, NAME_A, NAME_B];

let work = '';
let bin = '';
let names = '';

/** git with no user or system configuration, a fixed identity and no signing. */
function git(cwd: string, ...args: string[]): string {
  const r = spawnSync('git', ['-c', 'user.name=Fixture', '-c', 'user.email=noreply@example.invalid', '-c', 'commit.gpgsign=false', '-c', 'tag.gpgsign=false', '-c', 'init.defaultBranch=main', ...args], {
    cwd,
    encoding: 'utf8',
    env: gitEnv(),
  });
  expect(r.status, `git ${args.join(' ')}: ${r.stderr}`).toBe(0);
  return r.stdout.trim();
}
function gitEnv(): Record<string, string> {
  return { PATH: process.env['PATH'] ?? '', HOME: work, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', LANG: 'C' };
}

/** Writes a file (making its directory) and commits it with a message. */
function commit(dir: string, file: string, text: string, message: string): string {
  mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
  writeFileSync(path.join(dir, file), text);
  git(dir, 'add', '--', file);
  git(dir, 'commit', '-q', '-m', message);
  return git(dir, 'rev-parse', 'HEAD');
}

/** Writes a file of raw bytes (making its directory) and commits it with a message. */
function commitBytes(dir: string, file: string, bytes: Buffer, message: string): void {
  mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
  writeFileSync(path.join(dir, file), bytes);
  git(dir, 'add', '--', file);
  git(dir, 'commit', '-q', '-m', message);
}

/** Runs the scan's command line in `cwd`, with the fake gh first on PATH and its state at `state` (when given). */
function scan(cwd: string, args: string[], state?: unknown): SpawnSyncReturns<string> & { log: string[][] } {
  const dir = mkdtempSync(path.join(work, 'gh-'));
  const log = path.join(dir, 'log');
  writeFileSync(log, '');
  const stateFile = path.join(dir, 'state.json');
  if (state !== undefined) writeFileSync(stateFile, JSON.stringify(state));
  const r = spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd,
    encoding: 'utf8',
    timeout: 120_000,
    env: { ...gitEnv(), PATH: `${bin}${path.delimiter}${process.env['PATH'] ?? ''}`, FAKE_GH_STATE: stateFile, FAKE_GH_LOG: log },
  });
  const calls = readFileSync(log, 'utf8')
    .split('\n')
    .filter((l) => l !== '')
    .map((l) => JSON.parse(l) as string[]);
  return Object.assign(r, { log: calls });
}

/** The hit lines of a scan's output, without the prefix. */
const hits = (r: SpawnSyncReturns<string>): string[] =>
  r.stdout
    .split('\n')
    .filter((l) => l.startsWith('history-scan: hit: '))
    .map((l) => l.slice('history-scan: hit: '.length));

/** True when the output, stdout and stderr, holds none of the planted texts and names, in any case. */
function printsNoSecret(r: SpawnSyncReturns<string>): string[] {
  const out = `${r.stdout}\n${r.stderr}`.toLowerCase();
  return SECRETS.filter((s) => out.includes(s.toLowerCase()));
}

// The fake gh: answers `gh api <path>` from state.rest[<path>] (a list of pages; all of them with --paginate, the first
// alone without), and `gh api graphql -f query=…` from state.edits (by node id: the edit revisions' texts, two to a
// page; `nodes(ids: […])` gives each node's first page, `node(id: …)` with --paginate gives every page). An unknown
// path, an unknown node or a call that is not `gh api` fails as gh does on an HTTP error.
const FAKE_GH = `#!${process.execPath}
const fs = require('node:fs');
const args = process.argv.slice(2);
fs.appendFileSync(process.env.FAKE_GH_LOG, JSON.stringify(args) + '\\n');
const fail = (m) => { process.stderr.write('gh: ' + m + '\\n'); process.exit(1); };
if (args[0] !== 'api') fail('not an api call');
const state = JSON.parse(fs.readFileSync(process.env.FAKE_GH_STATE, 'utf8'));
const paginate = args.includes('--paginate');
const PAGE = 2;
const pageOf = (id, n) => {
  const all = state.edits[id] ?? [];
  const nodes = all.slice(n * PAGE, n * PAGE + PAGE).map((diff) => ({ diff }));
  const more = (n + 1) * PAGE < all.length;
  return { totalCount: all.length, pageInfo: { hasNextPage: more, endCursor: more ? 'c' + String(n + 1) : null }, nodes };
};
if (args[1] === 'graphql') {
  const f = args.indexOf('-f');
  const q = f >= 0 ? String(args[f + 1]).replace(/^query=/, '') : fail('no query');
  if (!/userContentEdits/.test(q) || !/\\bdiff\\b/.test(q)) fail('a query that reads no edit');
  const many = /nodes\\(ids:\\s*\\[([^\\]]*)\\]\\)/.exec(q);
  if (many !== null) {
    const ids = [...many[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    const nodes = ids.map((id) => (state.known.includes(id) ? { id, userContentEdits: pageOf(id, 0) } : null));
    if (nodes.includes(null)) fail('Could not resolve to a node');
    process.stdout.write(JSON.stringify({ data: { nodes } }));
    process.exit(0);
  }
  const one = /node\\(id:\\s*"([^"]+)"\\)/.exec(q);
  if (one === null || !state.known.includes(one[1])) fail('Could not resolve to a node');
  const pages = [];
  const total = (state.edits[one[1]] ?? []).length;
  for (let n = 0; n === 0 || n * PAGE < total; n++) pages.push({ data: { node: { userContentEdits: pageOf(one[1], n) } } });
  process.stdout.write((paginate ? pages : pages.slice(0, 1)).map((p) => JSON.stringify(p)).join(''));
  process.exit(0);
}
const p = args.find((a) => a.startsWith('repos/'));
const pages = p === undefined ? undefined : state.rest[p];
if (pages === undefined) fail('Not Found (HTTP 404)');
process.stdout.write((paginate ? pages : pages.slice(0, 1)).map((x) => JSON.stringify(x)).join(''));
`;

beforeAll(() => {
  work = mkdtempSync(path.join(tmpdir(), 'docserver-history-scan-'));
  bin = path.join(work, 'bin');
  mkdirSync(bin);
  writeFileSync(path.join(bin, 'gh'), FAKE_GH);
  chmodSync(path.join(bin, 'gh'), 0o755);
  names = path.join(work, 'names.txt');
  writeFileSync(names, `# invented names, one per line\n${NAME_A}\n\n${NAME_B}\n`);
});

afterAll(() => {
  if (work !== '') rmSync(work, { recursive: true, force: true });
});

describe('public-shapes: the shapes and the names list', () => {
  it('finds one planted hit of each shape class, and names in any case standing alone, but not inside a longer word', () => {
    expect([HOME, MAIL, ADDRESS, HOST, CREDENTIAL].map((t) => findShapes(t).map((f) => f.shape))).toEqual([
      ['home or mount path'],
      ['e-mail address'],
      ['private address'],
      ['private host suffix'],
      ['credential'],
    ]);
    expect(SHAPES.map((s) => s.name)).toEqual(['home or mount path', 'private host suffix', 'private address', 'e-mail address', 'credential']);
    const listed = [namesShape([NAME_A, NAME_B])];
    expect(findShapes(`a ${NAME_A.toUpperCase()} b; c-${NAME_B}.d`, listed).map((f) => [f.line, f.shape])).toEqual([
      [1, LISTED_NAME],
      [1, LISTED_NAME],
    ]);
    expect(findShapes(`x${NAME_A} ${NAME_B}_y ${NAME_A}9`, listed)).toEqual([]);
  });

  it('reads a names file: one name per line, blank and # lines skipped; an empty list is refused', () => {
    expect(parseNames(`# c\n ${NAME_A} \r\n\n${NAME_B}\n`)).toEqual([NAME_A, NAME_B]);
    expect(() => parseNames('# only a comment\n\n')).toThrow(/lists no name/);
    expect(() => namesShape([])).toThrow(/empty/);
  });
});

describe('history-scan: the history (--all)', () => {
  let remote = '';
  let clone = '';
  let pullOnly = '';
  let tagObject = '';
  let lateBlob = '';
  let lateTag = '';
  let noted = '';
  let noteBlob = '';
  let keptBlob = '';

  beforeAll(() => {
    // The remote: a bare repository. The work repository pushes main, a backup branch, an annotated tag and a
    // pull-request head to it; the scan then runs in a fresh clone, which holds no refs/pull/* until the scan fetches.
    remote = path.join(work, 'remote.git');
    git(work, 'init', '-q', '--bare', remote);
    const dir = path.join(work, 'author');
    git(work, 'init', '-q', dir);
    commit(dir, 'README.md', 'clean text\n', 'start');
    commit(dir, 'notes/old.txt', `line one\nsee ${HOME}\n`, 'add notes');
    git(dir, 'rm', '-q', 'notes/old.txt');
    git(dir, 'commit', '-q', '-m', 'remove notes');
    commit(dir, `docs/${NAME_B}-plan.txt`, 'plain\n', 'add a plan');
    commit(dir, `team/${NAME_A}/contact.txt`, `write to ${MAIL}\n`, 'add a contact');
    commit(dir, 'src/a.txt', 'a\n', `fix\n\nreviewed with ${NAME_A}`);
    git(dir, 'tag', '-a', 'v0.0.1', '-m', `release\n\nask ${MAIL}`);
    tagObject = git(dir, 'rev-parse', 'refs/tags/v0.0.1');
    git(dir, 'checkout', '-q', '-b', 'backup/one');
    commit(dir, 'cfg.txt', `token ${CREDENTIAL}\n`, 'backup');
    // Bytes that are not UTF-8: outside assets/fonts such a blob is still read (a credential among binary bytes is
    // found); a woff2 font directly in assets/fonts is the one binary the scan skips, and counts.
    commitBytes(dir, 'data/blob.bin', Buffer.concat([Buffer.from([0xff, 0xfe, 0x00, 0x81]), Buffer.from(`\ntoken ${CREDENTIAL}\n`)]), 'binary');
    commitBytes(dir, 'assets/fonts/fixture.woff2', Buffer.from([0x77, 0x4f, 0x46, 0x32, 0xff, 0xfe, 0x80, 0x00]), 'font');
    git(dir, 'checkout', '-q', 'main');
    git(dir, 'checkout', '-q', '-b', 'pr-head');
    pullOnly = commit(dir, 'hosts.txt', `deploy to ${ADDRESS}\n`, `deploy\n\nvia ${HOST}`);
    git(dir, 'checkout', '-q', 'main');
    git(dir, 'push', '-q', remote, 'main', 'backup/one', 'v0.0.1', `pr-head:refs/pull/1/head`, `main:refs/heads/feature/${NAME_A}-x`);
    git(dir, 'branch', '-q', '-D', 'pr-head');
    clone = path.join(work, 'clone');
    git(work, 'clone', '-q', remote, clone);
    expect(git(clone, 'for-each-ref', '--format=%(refname)', 'refs/remotes/pull')).toBe('');
    // Pushed after the clone, so only the scan's own fetch brings them: a backup branch, and an annotated tag on a
    // commit no branch holds (git's tag following would not bring it with the branches).
    git(dir, 'checkout', '-q', '-b', 'backup/two', 'main');
    commit(dir, 'late.txt', `ship from ${HOST}\n`, 'late');
    lateBlob = git(dir, 'rev-parse', 'HEAD:late.txt');
    git(dir, 'checkout', '-q', '--detach', 'main');
    commit(dir, 'loose.txt', 'loose\n', 'loose');
    git(dir, 'tag', '-a', 'v0.0.2', '-m', `late\n\nsee ${HOME}`);
    lateTag = git(dir, 'rev-parse', 'refs/tags/v0.0.2');
    git(dir, 'checkout', '-q', 'main');
    // Refs outside branches, tags and pull requests, which a public repository serves to anyone who fetches them: a
    // note on main's tip (refs/notes/commits), and a ref in a namespace of its own on a commit nothing else holds.
    noted = git(dir, 'rev-parse', 'main');
    git(dir, 'notes', 'add', '-m', `built on ${HOST}`, noted);
    noteBlob = git(dir, 'rev-parse', `refs/notes/commits:${noted}`);
    git(dir, 'checkout', '-q', '--detach', 'main');
    commit(dir, 'kept.txt', `kept at ${HOME}\n`, 'kept');
    keptBlob = git(dir, 'rev-parse', 'HEAD:kept.txt');
    git(dir, 'update-ref', 'refs/keep/old-1', 'HEAD');
    git(dir, 'checkout', '-q', 'main');
    git(dir, 'push', '-q', remote, 'backup/two', 'v0.0.2', 'refs/notes/commits', 'refs/keep/old-1');
    expect(git(clone, 'for-each-ref', '--format=%(refname)', 'refs/remotes/origin/backup/two', 'refs/tags/v0.0.2', 'refs/notes', 'refs/keep')).toBe('');
  });

  it('fetches every branch, every tag and every pull-request head, then finds every planted hit: blob, commit message, tag message, tree entry, ref name, a backup branch, a pull-request head, and a branch and a tag pushed after the clone', () => {
    const r = scan(clone, ['--all', '--names-file', names]);
    expect(r.stderr).toBe('');
    expect(r.status).toBe(1);
    const found = hits(r);
    // The pull-request head is fetched, so its commit and its blob are read.
    expect(git(clone, 'rev-parse', 'refs/remotes/pull/1/head')).toBe(pullOnly);
    const blob = (file: string): string => git(clone, 'rev-parse', `${pullOnly}:${file}`);
    const notes = git(clone, 'rev-parse', 'HEAD~4:notes/old.txt');
    const contact = git(clone, 'rev-parse', `HEAD:team/${NAME_A}/contact.txt`);
    const cfg = git(clone, 'rev-parse', 'refs/remotes/origin/backup/one:cfg.txt');
    const named = git(clone, 'log', '--format=%H', '-1', '--grep=reviewed', 'refs/remotes/origin/main');
    const planTree = git(clone, 'rev-parse', 'HEAD^{tree}');
    const docsTree = git(clone, 'rev-parse', 'HEAD:docs');
    expect(planTree).not.toBe(docsTree);
    expect(found).toEqual(
      expect.arrayContaining([
        `blob ${notes} notes/old.txt line 2: home or mount path`,
        `commit ${named} line 8: listed name`,
        `tag ${tagObject} line 8: e-mail address`,
        `blob ${cfg} cfg.txt line 1: credential`,
        `blob ${blob('hosts.txt')} hosts.txt line 1: private address`,
        `commit ${pullOnly} line 8: private host suffix`,
        `tree ${docsTree} entry 1: listed name`,
        // The blob's path holds a listed name, so the blob is located by its object id alone.
        `blob ${contact} line 1: e-mail address`,
        // A branch and a tag the clone did not hold: the scan's fetch of every branch and every tag brought them.
        `blob ${lateBlob} late.txt line 1: private host suffix`,
        `tag ${lateTag} line 8: home or mount path`,
        // Bytes that are not UTF-8, outside assets/fonts: read all the same.
        `blob ${git(clone, 'rev-parse', 'refs/remotes/origin/backup/one:data/blob.bin')} data/blob.bin line 2: credential`,
        // Refs outside branches, tags and pull requests: the remote advertised them, and the scan fetched and read them.
        `blob ${noteBlob} ${noted} line 1: private host suffix`,
        `blob ${keptBlob} kept.txt line 1: home or mount path`,
      ]),
    );
    // Nothing is read from the font: its bytes are not UTF-8 and it lies directly in assets/fonts.
    const font = git(clone, 'rev-parse', 'refs/remotes/origin/backup/one:assets/fonts/fixture.woff2');
    expect(found.filter((h) => h.startsWith(`blob ${font}`))).toEqual([]);
    // The ref named for a listed name is found, and its name is not printed: the ref is located by what it points at.
    expect(found.filter((h) => h.startsWith('ref ') && h.endsWith(': listed name'))).toHaveLength(1);
    expect(printsNoSecret(r)).toEqual([]);
  });

  it('a path or ref that itself holds a hit is never printed as the location', () => {
    const r = scan(clone, ['--all', '--names-file', names]);
    const locations = hits(r).map((h) => h.slice(0, h.lastIndexOf(': ')));
    expect(locations.filter((l) => l.toLowerCase().includes(NAME_A) || l.toLowerCase().includes(NAME_B))).toEqual([]);
  });

  it('reports what it read: commits, trees, blobs, tags and refs, and the number of hits', () => {
    const r = scan(clone, ['--all', '--names-file', names]);
    const read = r.stdout.split('\n').find((l) => l.startsWith('history-scan: read ') && l.includes('commits')) ?? '';
    expect(read).toMatch(/^history-scan: read \d+ commits, \d+ trees, \d+ blobs, 2 tags, \d+ refs$/);
    expect(r.stdout).toContain('\nhistory-scan: skipped 1 binary fonts under assets/fonts (pinned by hash in assets/fonts/README.md)\n');
    expect(r.stdout).toContain('\nhistory-scan: fetched 2 refs outside branches, tags and pull requests\n');
    expect(r.stdout.trim().split('\n').at(-1)).toBe(`history-scan: ${String(hits(r).length)} hits`);
  });

  it('a clean history exits 0 and reports no hit', () => {
    const bare = path.join(work, 'clean.git');
    git(work, 'init', '-q', '--bare', bare);
    const dir = path.join(work, 'clean-author');
    git(work, 'init', '-q', dir);
    commit(dir, 'a.txt', 'nothing here\n', 'start');
    git(dir, 'push', '-q', bare, 'main');
    const c = path.join(work, 'clean-clone');
    git(work, 'clone', '-q', bare, c);
    const r = scan(c, ['--all', '--names-file', names]);
    expect([r.status, r.stderr, hits(r)]).toEqual([0, '', []]);
    expect(r.stdout.trim().split('\n').at(-1)).toBe('history-scan: 0 hits');
  });

  it('fetches every advertised ref outside branches, tags and pull requests, each to its own name, and refuses an answer it cannot read', () => {
    const id = 'c'.repeat(40);
    const answer = [
      `${id}\tHEAD`,
      `${id}\trefs/heads/main`,
      `${id}\trefs/tags/v1.0.0`,
      `${id}\trefs/tags/v1.0.0^{}`,
      `${id}\trefs/pull/7/head`,
      `${id}\trefs/notes/commits`,
      `${id}\trefs/keep/old-1`,
      '',
    ].join('\n');
    expect(OTHER_REFS).toBe('refs/history-scan/');
    expect(otherRefspecs(answer)).toEqual(['+refs/notes/commits:refs/history-scan/notes/commits', '+refs/keep/old-1:refs/history-scan/keep/old-1']);
    expect(otherRefspecs('')).toEqual([]);
    expect(() => otherRefspecs('not a ref list\n')).toThrow(/not a ref list/);
    expect(() => otherRefspecs(`${id}\tFETCH_HEAD\n`)).toThrow(/outside refs/);
  });

  it('fails closed (exit 2) when the fetch fails, never reporting a clean history', () => {
    const dir = path.join(work, 'no-remote');
    git(work, 'init', '-q', dir);
    commit(dir, 'a.txt', 'nothing\n', 'start');
    git(dir, 'remote', 'add', 'origin', path.join(work, 'missing.git'));
    const r = scan(dir, ['--all', '--names-file', names]);
    expect(r.status).toBe(2);
    expect(r.stdout).not.toContain('0 hits');
    expect(r.stderr).toMatch(/^history-scan: /);
  });
});

/** A node id the fake GitHub knows, by kind and number. */
const node = (kind: string, n: number): string => `${kind}_${String(n)}`;

/** The recorded GitHub state for repository owner-a/repo-a: one hit in each place only that place holds. */
function githubState(): { rest: Record<string, unknown[][]>; edits: Record<string, string[]>; known: string[] } {
  const R = 'repos/owner-a/repo-a';
  // A pull request's head and base branch names stay on its page after the branch is deleted, so they are read too.
  const pull = (n: number, body: string, head = `topic-${String(n)}`, base = 'main', title = `change ${String(n)}`): unknown => ({ number: n, node_id: node('PR', n), title, body, head: { ref: head }, base: { ref: base } });
  return {
    rest: {
      [`${R}/pulls?state=all&per_page=100`]: [
        [pull(1, `clean\n\ncc ${NAME_B}`), pull(2, null as unknown as string, 'topic-2', `release-${NAME_A}`)],
        [pull(3, 'clean too', `${NAME_B}-fix`, 'main', `retry on ${ADDRESS}`)],
      ],
      [`${R}/issues?state=all&per_page=100`]: [
        [
          { number: 1, node_id: node('PR', 1), title: 'change 1', body: 'clean', pull_request: {} },
          { number: 4, node_id: node('I', 4), title: `issue on ${HOST}`, body: `steps\nrun from ${HOME}` },
        ],
      ],
      [`${R}/issues/comments?per_page=100`]: [[{ id: 11, node_id: node('IC', 11), body: 'fine' }], [{ id: 12, node_id: node('IC', 12), body: `line\nsee ${HOME}` }]],
      [`${R}/pulls/comments?per_page=100`]: [[{ id: 21, node_id: node('RC', 21), body: `ping ${MAIL}` }]],
      [`${R}/pulls/1/reviews?per_page=100`]: [[{ id: 31, node_id: node('RV', 31), body: 'looks fine' }]],
      [`${R}/pulls/2/reviews?per_page=100`]: [[]],
      [`${R}/pulls/3/reviews?per_page=100`]: [[{ id: 32, node_id: node('RV', 32), body: '' }, { id: 33, node_id: node('RV', 33), body: `ok\nwith ${MAIL}` }]],
      [`${R}/comments?per_page=100`]: [[{ id: 41, node_id: node('CC', 41), body: `ok\nfrom ${HOST}` }]],
      [`${R}/releases?per_page=100`]: [[{ id: 51, tag_name: 'v0.0.1', name: `first for ${NAME_B}`, body: `notes\nthanks ${NAME_A}` }]],
    },
    edits: {
      [node('PR', 1)]: ['clean', 'clean again', `first draft by ${NAME_B}`],
      [node('RV', 31)]: [`was ${CREDENTIAL}`],
      [node('IC', 11)]: ['fine'],
    },
    known: [node('PR', 1), node('PR', 2), node('PR', 3), node('I', 4), node('IC', 11), node('IC', 12), node('RC', 21), node('RV', 31), node('RV', 32), node('RV', 33), node('CC', 41)],
  };
}

describe('history-scan: the GitHub texts (--github)', () => {
  let repo = '';
  beforeAll(() => {
    repo = path.join(work, 'gh-repo');
    git(work, 'init', '-q', repo);
    commit(repo, 'a.txt', 'nothing\n', 'start');
  });

  it('reads every pull request (its head and base branch names too), issue, comment, review, review comment, commit comment and release, every page of each, and every edit revision, and finds each planted hit', () => {
    const r = scan(repo, ['--github', '--repo', 'owner-a/repo-a', '--names-file', names], githubState());
    expect(r.stderr).toBe('');
    expect(r.status).toBe(1);
    expect(hits(r).sort()).toEqual(
      [
        'github issue #4 title line 1: private host suffix',
        'github issue #4 body line 2: home or mount path',
        'github pull #1 body line 3: listed name',
        'github pull #3 title line 1: private address',
        'github review 33 body line 2: e-mail address',
        'github commit-comment 41 body line 2: private host suffix',
        'github release 51 name line 1: listed name',
        'github pull #3 head branch name line 1: listed name',
        'github pull #2 base branch name line 1: listed name',
        'github issue-comment 12 body line 2: home or mount path',
        'github review-comment 21 body line 1: e-mail address',
        'github release 51 body line 2: listed name',
        'github edit of pull #1, revision 3 of 3, line 1: listed name',
        'github edit of review 31, revision 1 of 1, line 1: credential',
      ].sort(),
    );
    expect(printsNoSecret(r)).toEqual([]);
  });

  it('asks gh for every page of every list (--paginate), and for the edits of every object that has them', () => {
    const r = scan(repo, ['--github', '--repo', 'owner-a/repo-a', '--names-file', names], githubState());
    const rest = r.log.filter((a) => a[1] !== 'graphql');
    expect(rest.filter((a) => !a.includes('--paginate'))).toEqual([]);
    expect(rest.map((a) => a.find((x) => x.startsWith('repos/'))).sort()).toEqual(Object.keys(githubState().rest).sort());
    const graphql = r.log.filter((a) => a[1] === 'graphql');
    const asked = graphql.flatMap((a) => [...String(a[a.indexOf('-f') + 1]).matchAll(/"([A-Z]+_\d+)"/g)].map((m) => m[1]));
    expect([...new Set(asked)].sort()).toEqual([...githubState().known].sort());
    expect(r.stdout).toMatch(/^history-scan: read 3 pulls, 1 issues, 2 issue comments, 1 review comments, 3 reviews, 1 commit comments, 1 releases, 5 edit revisions$/m);
  });

  it('fails closed (exit 2) when gh fails on any read, never reporting a clean GitHub', () => {
    const state = githubState();
    delete state.rest['repos/owner-a/repo-a/releases?per_page=100'];
    const r = scan(repo, ['--github', '--repo', 'owner-a/repo-a', '--names-file', names], state);
    expect(r.status).toBe(2);
    expect(r.stdout).not.toMatch(/hits$/m);
    const unknown = githubState();
    unknown.known = unknown.known.filter((k) => k !== node('RV', 31));
    expect(scan(repo, ['--github', '--repo', 'owner-a/repo-a', '--names-file', names], unknown).status).toBe(2);
  });

  it('reads the repository name from the origin URL when --repo is not given, and refuses an origin that is not on GitHub', () => {
    const dir = path.join(work, 'gh-origin');
    git(work, 'init', '-q', dir);
    commit(dir, 'a.txt', 'nothing\n', 'start');
    git(dir, 'remote', 'add', 'origin', 'https://github.com/owner-a/repo-a.git');
    const r = scan(dir, ['--github', '--names-file', names], githubState());
    expect(r.status).toBe(1);
    git(dir, 'remote', 'set-url', 'origin', 'https://example.test/owner-a/repo-a.git');
    expect(scan(dir, ['--github', '--names-file', names], githubState()).status).toBe(2);
  });
});

describe('history-scan: the command line', () => {
  let repo = '';
  beforeAll(() => {
    repo = path.join(work, 'cli-repo');
    git(work, 'init', '-q', repo);
    commit(repo, 'a.txt', 'nothing\n', 'start');
  });

  it.each([
    ['no mode', ['--names-file', 'NAMES']],
    ['no names file', ['--all']],
    ['an unknown option', ['--all', '--names-file', 'NAMES', '--fast']],
    ['a names file given twice', ['--all', '--names-file', 'NAMES', '--names-file', 'NAMES']],
    ['a missing value', ['--all', '--names-file']],
  ])('refuses %s with exit 2 and the usage line', (_what, args) => {
    const r = scan(repo, args.map((a) => (a === 'NAMES' ? names : a)));
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('usage: node scripts/history-scan.mjs [--all] [--github] [--repo <owner/name>] [--remote <name>] --names-file <path outside the repository>');
    expect(r.log).toEqual([]);
  });

  it('refuses a names file inside the repository it scans, so the list never lands in a commit', () => {
    writeFileSync(path.join(repo, 'names.txt'), `${NAME_A}\n`);
    const r = scan(repo, ['--all', '--names-file', path.join(repo, 'names.txt')]);
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/names file .*inside the repository/);
    rmSync(path.join(repo, 'names.txt'));
  });

  it('refuses a names file that lists no name, or that cannot be read', () => {
    const empty = path.join(work, 'empty-names.txt');
    writeFileSync(empty, '# nothing\n');
    expect(scan(repo, ['--all', '--names-file', empty]).status).toBe(2);
    expect(scan(repo, ['--all', '--names-file', path.join(work, 'absent.txt')]).status).toBe(2);
  });
});
