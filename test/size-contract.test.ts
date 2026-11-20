// Size by contract (the appearance contract, spec section 10, test 8; plan Task 8). The library keeps two append-only tables as
// committed source, conformance/size/shares.json (each design's share, as the coordinator set it) and
// conformance/size/growth.json (the sizes in characters, measured when each landing landed). Their shape is in
// test/size-rules.ts's header: one row per line, the comma leading each row but the first, so an append touches no earlier line
// and `git log -L <line>,<line>:conformance/size/growth.json --first-parent` names the landing that measured a row.
//
// This file judges one landing at a time: the judged commit against its first parent. It reads both sides with `git show`, never
// a build and never the working tree, so what it judges is what is committed. The rules themselves are pure functions in
// test/size-rules.ts, driven row by row with synthetic states in test/size-rules.test.ts.
//
//   DOCSERVER_SIZE_BASE=<ref>   the base (default `HEAD^1`). A branch that is not a merge commit has no `HEAD^1` that means its
//                               base, so a local run names it: DOCSERVER_SIZE_BASE=origin/main DOCSERVER_SIZE_TEXT='Size-Design: x1'.
//                               A base that cannot be resolved, or that is not a proper ancestor of the judged commit, fails; it
//                               is never skipped.
//   DOCSERVER_SIZE_HEAD=<ref>   the judged commit (default `HEAD`); a local run points it at a commit made from the working tree.
//   DOCSERVER_SIZE_TEXT=<text>  the landing's text. When set and non-empty it is the pull request's description (CI hands it over on
//                               a pull request, through a job-level env, never interpolated into a script); otherwise the judged
//                               commit's message (`git log -1 --format=%B`), which on the main line is the landing commit's.
//
// CI fetches the full history, so the base is there; the test reads no further back than the judged commit and its first parent
// (and, to print a row's measuring commit, the table's own history when the clone has it: printed, never asserted).
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { judge, parseManifest, parseTable, sizeDesignWords, type State } from './size-rules.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const SHARES = 'conformance/size/shares.json';
const GROWTH = 'conformance/size/growth.json';
const MANIFEST = 'src/frame/manifest.generated.ts';

function git(args: readonly string[]): { status: number | null; stdout: string; stderr: string } {
  const r = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

const BASE = process.env['DOCSERVER_SIZE_BASE'] ?? 'HEAD^1';
const HEAD = process.env['DOCSERVER_SIZE_HEAD'] ?? 'HEAD';
const resolve = (ref: string): string => git(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]).stdout.trim();

/** A file at a commit, or null when the commit does not hold it. */
function showAt(ref: string, file: string): string | null {
  if (git(['cat-file', '-e', `${ref}:${file}`]).status !== 0) return null;
  const r = git(['show', `${ref}:${file}`]);
  expect(r.status, `git show ${ref}:${file}: ${r.stderr}`).toBe(0);
  return r.stdout;
}

function stateAt(ref: string): State {
  const manifest = showAt(ref, MANIFEST);
  expect(manifest, `${MANIFEST} at ${ref}`).not.toBeNull();
  const shares = showAt(ref, SHARES);
  const growth = showAt(ref, GROWTH);
  return {
    shares: shares === null ? null : parseTable(shares),
    growth: growth === null ? null : parseTable(growth),
    manifest: parseManifest(manifest ?? ''),
  };
}

const landingText = (): string => {
  const env = process.env['DOCSERVER_SIZE_TEXT'];
  if (env !== undefined && env !== '') return env;
  const r = git(['log', '-1', '--format=%B', HEAD]);
  expect(r.status, `git log -1 ${HEAD}: ${r.stderr}`).toBe(0);
  return r.stdout;
};

describe('the first parent: the landing is judged against it, never guessed', () => {
  it(`the base \`${BASE}\` and the judged commit \`${HEAD}\` are in the checkout (a missing one fails; it is never skipped)`, () => {
    expect(resolve(BASE), `git cannot resolve ${BASE}: fetch the base (CI fetches full history), or set DOCSERVER_SIZE_BASE`).not.toBe('');
    expect(resolve(HEAD), `git cannot resolve ${HEAD}`).not.toBe('');
  });

  it(`the base is a proper ancestor of the judged commit (a base equal to it, or off its history, would judge the tables against themselves or a stranger)`, () => {
    const base = resolve(BASE);
    const head = resolve(HEAD);
    expect(base).not.toBe('');
    expect(base, 'the base is the judged commit itself').not.toBe(head);
    expect(git(['merge-base', '--is-ancestor', base, head]).status, `${BASE} is not an ancestor of ${HEAD}`).toBe(0);
  });
});

describe('the landing, judged against its first parent', () => {
  it('the text holds exactly one Size-Design line', () => {
    expect(sizeDesignWords(landingText())).toHaveLength(1);
  });

  it('every rule of test 8 holds: the byte-equal rows, the newest row, what the word appends, the share, the layouts', () => {
    const head = stateAt(HEAD);
    const violations = judge(stateAt(BASE), head, landingText());
    expect(violations).toEqual([]);
  });

  it('prints each growth row with the landing that measured it, when the history holds it (printed, never asserted)', () => {
    const growth = showAt(HEAD, GROWTH);
    if (growth === null) return;
    const lines = growth.split('\n');
    const out: string[] = [];
    parseTable(growth).rows.forEach((row, i) => {
      const n = i + 2; // `[` is line 1
      const r = git(['log', '-L', `${String(n)},${String(n)}:${GROWTH}`, '--first-parent', '--format=%H', '-s', HEAD]);
      const sha = r.status === 0 ? (r.stdout.split('\n').find((l) => /^[0-9a-f]{40}$/.test(l)) ?? 'not in this history') : 'not in this history';
      out.push(`${row.design}: total ${String(row.total)}, frame ${String(row.frame)}, measured at ${sha}`);
    });
    expect(lines.length).toBeGreaterThan(2);
    console.info(`growth rows of ${GROWTH}:\n${out.join('\n')}`);
  });
});
