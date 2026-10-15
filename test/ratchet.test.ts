// The verdict ratchet and the golden-move rule (docserver L1, Task 11; architecture section D). The pure
// functions of scripts/ratchet.mjs, one case per kind of weakening and the tightenings that pass; then the
// command itself, run with this Node against throwaway git repositories made in the system temp directory
// (git's global and system configuration are ignored there, and nothing is pushed or fetched).
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import {
  checkGoldenMoves,
  checkHostileInputs,
  compareVerdicts,
  expectedIds,
  parseTrailerIds,
  type RatchetEntry,
} from '../scripts/ratchet.mjs';

const BASE: RatchetEntry[] = [
  {
    id: 'h-case',
    verdict: { outcome: 'rendered', maxMs: 1000, forbid: ['<script', '<img'], require: ['<p>'], balanced: ['details'], exact: true },
  },
  {
    id: 'x-case',
    input: { parts: [{ text: '> ', times: 10 }] },
    verdict: {
      outcome: 'rendered',
      maxMs: 2000,
      maxOutputRatio: 4,
      maxTagDepth: { blockquote: 20, em: 5 },
      headingIds: { base: 'a', count: 3 },
      scan: { maxImages: 512, imagesTruncated: true },
      nullPrototypeFront: true,
    },
  },
];

/** BASE with one entry's verdict changed: `set` merged in, `drop` keys removed. */
function edit(id: string, set: Record<string, unknown>, drop: string[] = []): RatchetEntry[] {
  return BASE.map((e) => {
    if (e.id !== id) return e;
    const verdict: Record<string, unknown> = { ...e.verdict, ...set };
    for (const k of drop) delete verdict[k];
    return { ...e, verdict };
  });
}

describe('compareVerdicts: every weakening is refused', () => {
  const cases: [string, RatchetEntry[], string][] = [
    ['removed case', BASE.slice(0, 1), 'x-case: removed (a hostile or generated case is never removed)'],
    ['raised maxMs', edit('x-case', { maxMs: 2001 }), 'x-case: maxMs raised from 2000 to 2001'],
    ['removed maxMs', edit('h-case', {}, ['maxMs']), 'h-case: maxMs removed'],
    ['raised maxOutputRatio', edit('x-case', { maxOutputRatio: 4.5 }), 'x-case: maxOutputRatio raised from 4 to 4.5'],
    ['raised maxTagDepth', edit('x-case', { maxTagDepth: { blockquote: 21, em: 5 } }), 'x-case: maxTagDepth.blockquote raised from 20 to 21'],
    ['removed maxTagDepth entry', edit('x-case', { maxTagDepth: { blockquote: 20 } }), 'x-case: maxTagDepth.em removed'],
    ['shrunk forbid', edit('h-case', { forbid: ['<script'] }), 'h-case: forbid lost "<img"'],
    ['shrunk require', edit('h-case', {}, ['require']), 'h-case: require lost "<p>"'],
    ['shrunk balanced', edit('h-case', { balanced: [] }), 'h-case: balanced lost "details"'],
    ['changed outcome', edit('h-case', { outcome: 'failed' }), 'h-case: outcome changed from rendered to failed'],
    ['dropped exact', edit('h-case', {}, ['exact']), 'h-case: exact dropped'],
    ['dropped nullPrototypeFront', edit('x-case', {}, ['nullPrototypeFront']), 'x-case: nullPrototypeFront dropped'],
    ['changed headingIds', edit('x-case', { headingIds: { base: 'a', count: 2 } }), 'x-case: headingIds changed'],
    ['removed scan', edit('x-case', {}, ['scan']), 'x-case: scan removed'],
    ['raised scan.maxImages', edit('x-case', { scan: { maxImages: 513, imagesTruncated: true } }), 'x-case: scan.maxImages raised from 512 to 513'],
    ['changed scan.imagesTruncated', edit('x-case', { scan: { maxImages: 512, imagesTruncated: false } }), 'x-case: scan.imagesTruncated changed'],
    ['changed input', BASE.map((e) => (e.input === undefined ? e : { ...e, input: { parts: [{ text: '> ', times: 9 }] } })), 'x-case: input changed (add a new case instead)'],
    ['unknown key', edit('h-case', { maxDepth: 3 }), 'h-case: unknown verdict key "maxDepth" (teach scripts/ratchet.mjs first)'],
  ];
  for (const [name, head, line] of cases) {
    it(name, () => {
      expect(compareVerdicts(BASE, head)).toEqual([line]);
    });
  }

  it('an unknown key is refused on a new case too', () => {
    const head = [...BASE, { id: 'x-new', input: { parts: [{ text: 'a' }] }, verdict: { outcome: 'rendered', fast: true } }];
    expect(compareVerdicts(BASE, head)).toEqual(['x-new: unknown verdict key "fast" (teach scripts/ratchet.mjs first)']);
  });
});

describe('compareVerdicts: tightening passes', () => {
  it('the same verdicts, in another order', () => {
    expect(compareVerdicts(BASE, [...BASE].reverse())).toEqual([]);
  });

  it('lower bounds, more strings, new arms and new cases', () => {
    const head = [
      ...edit('h-case', { maxMs: 500, forbid: ['<img', '<script', '<svg'], require: ['<p>', '<em>'], maxOutputRatio: 3 }).map(
        (e) => (e.id === 'x-case' ? { ...e, verdict: { ...e.verdict, maxTagDepth: { blockquote: 19, em: 0, strong: 3 }, scan: { maxImages: 100, imagesTruncated: true } } } : e),
      ),
      { id: 'x-new', input: { parts: [{ text: 'a' }] }, verdict: { outcome: 'over-limit' } },
    ];
    expect(compareVerdicts(BASE, head)).toEqual([]);
  });

  it('an empty base keeps nothing, and every weakening of one base is listed', () => {
    expect(compareVerdicts([], BASE)).toEqual([]);
    expect(compareVerdicts(BASE, edit('x-case', { maxMs: 3000, outcome: 'failed' }))).toEqual([
      'x-case: outcome changed from rendered to failed',
      'x-case: maxMs raised from 2000 to 3000',
    ]);
  });
});

describe('checkGoldenMoves', () => {
  it('passes when the trailers name exactly the changed ids', () => {
    expect(checkGoldenMoves([], [])).toEqual([]);
    expect(checkGoldenMoves(['b', 'a'], ['a', 'b'])).toEqual([]);
  });

  it('a golden move without a trailer is red', () => {
    expect(checkGoldenMoves(['headings'], [])).toEqual([
      'headings: its expected files changed, and no Goldens-moved trailer names it',
    ]);
  });

  it('a missing id and an extra id are red', () => {
    expect(checkGoldenMoves(['a', 'b'], ['a', 'c'])).toEqual([
      'b: its expected files changed, and no Goldens-moved trailer names it',
      'c: a Goldens-moved trailer names it, and its expected files did not change',
    ]);
  });
});

describe('checkHostileInputs', () => {
  it("a hostile case's input file may not change; a generated case's spec is compareVerdicts' to hold", () => {
    expect(
      checkHostileInputs(BASE, ['conformance/corpus/h-case.md', 'conformance/corpus/x-case.md', 'conformance/corpus/other.md']),
    ).toEqual(['h-case: its input changed (add a new case instead)']);
    expect(checkHostileInputs(BASE, ['conformance/corpus/h-case-2.md', 'conformance/expected/h-case.html'])).toEqual([]);
  });
});

describe('parseTrailerIds and expectedIds', () => {
  it('trailer values are split on commas and lines, trimmed, each id once', () => {
    expect(parseTrailerIds('a, b\nc\n\0\n x/y ,a\0')).toEqual(['a', 'b', 'c', 'x/y']);
    expect(parseTrailerIds('\0\n\0')).toEqual([]);
  });

  it('changed paths become case ids', () => {
    expect(
      expectedIds([
        'conformance/expected/h-frontmatter-hostile/caps.html',
        'conformance/expected/h-frontmatter-hostile/caps.meta.json',
        'conformance/expected/alerts.meta.json',
        'conformance/reference/alerts.html',
      ]),
    ).toEqual(['alerts', 'h-frontmatter-hostile/caps']);
  });
});

describe('the shipped hostile.json', () => {
  it('keeps every verdict against itself', () => {
    const shipped = JSON.parse(
      readFileSync(new URL('../conformance/hostile.json', import.meta.url), 'utf8'),
    ) as RatchetEntry[];
    expect(compareVerdicts(shipped, shipped)).toEqual([]);
  });
});

describe('the ratchet command', () => {
  const RATCHET = fileURLToPath(new URL('../scripts/ratchet.mjs', import.meta.url));
  const dirs: string[] = [];
  // Git sees no global or system configuration and none of this process's GIT_* variables.
  const env: NodeJS.ProcessEnv = {
    ...Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('GIT_'))),
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_AUTHOR_NAME: 'Test',
    GIT_AUTHOR_EMAIL: 'noreply@example.invalid',
    GIT_COMMITTER_NAME: 'Test',
    GIT_COMMITTER_EMAIL: 'noreply@example.invalid',
  };

  function git(dir: string, ...args: string[]): string {
    const r = spawnSync('git', args, { cwd: dir, env, encoding: 'utf8' });
    if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
    return r.stdout;
  }

  function repo(): string {
    const dir = mkdtempSync(path.join(tmpdir(), 'docserver-ratchet-'));
    dirs.push(dir);
    git(dir, 'init', '-q', '-b', 'main');
    return dir;
  }

  function commit(dir: string, files: Record<string, string>, message: string): void {
    for (const [rel, text] of Object.entries(files)) {
      mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
      writeFileSync(path.join(dir, rel), text);
    }
    git(dir, 'add', '-A');
    git(dir, 'commit', '-q', '-m', message);
  }

  function ratchet(dir: string, ...args: string[]): { status: number | null; out: string; err: string } {
    const r = spawnSync(process.execPath, [RATCHET, ...args], { cwd: dir, env, encoding: 'utf8' });
    return { status: r.status, out: r.stdout, err: r.stderr };
  }

  const hostile = (maxMs: number): string =>
    `${JSON.stringify([{ id: 'x-case', input: { parts: [{ text: 'a' }] }, verdict: { outcome: 'rendered', maxMs } }])}\n`;

  afterAll(() => {
    for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
  });

  it('a first hostile.json has nothing to keep; an unchanged one keeps every verdict', () => {
    const dir = repo();
    commit(dir, { 'README.md': 'x\n' }, 'start');
    commit(dir, { 'conformance/hostile.json': hostile(1000) }, 'verdicts');
    expect(ratchet(dir, '--base', 'HEAD^')).toEqual({ status: 0, out: 'ratchet: 0 verdicts kept, 0 golden moves named\n', err: '' });
    commit(dir, { 'README.md': 'y\n' }, 'readme');
    expect(ratchet(dir, '--base', 'HEAD^')).toEqual({ status: 0, out: 'ratchet: 1 verdicts kept, 0 golden moves named\n', err: '' });
  });

  it('a weaker verdict exits 1 and names it; a tighter one passes', () => {
    const dir = repo();
    commit(dir, { 'conformance/hostile.json': hostile(1000) }, 'verdicts');
    commit(dir, { 'conformance/hostile.json': hostile(2000) }, 'looser');
    expect(ratchet(dir, '--base', 'HEAD^')).toEqual({ status: 1, out: '', err: 'ratchet: x-case: maxMs raised from 1000 to 2000\n' });
    commit(dir, { 'conformance/hostile.json': hostile(900) }, 'tighter');
    expect(ratchet(dir, '--base', 'HEAD^').status).toBe(0);
  });

  it('a moved golden needs a Goldens-moved trailer naming exactly its id', () => {
    const dir = repo();
    commit(dir, { 'conformance/hostile.json': '[]\n', 'conformance/expected/a.html': '<p>1</p>\n' }, 'start');
    commit(dir, { 'conformance/expected/a.html': '<p>2</p>\n' }, 'move a golden');
    expect(ratchet(dir, '--base', 'HEAD^')).toEqual({
      status: 1,
      out: '',
      err: 'ratchet: a: its expected files changed, and no Goldens-moved trailer names it\n',
    });
    git(dir, 'commit', '-q', '--amend', '-m', 'move a golden\n\nGoldens-moved: a, b\nCo-Authored-By: Test <noreply@example.invalid>');
    expect(ratchet(dir, '--base', 'HEAD^')).toEqual({
      status: 1,
      out: '',
      err: 'ratchet: b: a Goldens-moved trailer names it, and its expected files did not change\n',
    });
    git(dir, 'commit', '-q', '--amend', '-m', 'move a golden\n\nGoldens-moved: a\nCo-Authored-By: Test <noreply@example.invalid>');
    expect(ratchet(dir, '--base', 'HEAD^')).toEqual({ status: 0, out: 'ratchet: 0 verdicts kept, 1 golden moves named\n', err: '' });
  });

  it('on a branch, only the branch is read: a move on the base after the fork is not the branch\'s', () => {
    const dir = repo();
    commit(dir, { 'conformance/hostile.json': '[]\n', 'conformance/expected/a.html': '<p>1</p>\n' }, 'start');
    git(dir, 'checkout', '-q', '-b', 'topic');
    commit(dir, { 'README.md': 'x\n' }, 'topic work');
    git(dir, 'checkout', '-q', 'main');
    commit(dir, { 'conformance/expected/a.html': '<p>2</p>\n' }, 'move on main\n\nGoldens-moved: a');
    git(dir, 'checkout', '-q', 'topic');
    expect(ratchet(dir, '--base', 'main')).toEqual({ status: 0, out: 'ratchet: 0 verdicts kept, 0 golden moves named\n', err: '' });
  });

  it('an edited input of a hostile case exits 1 and names it; a new case beside it passes', () => {
    const dir = repo();
    const verdicts = `${JSON.stringify([{ id: 'h-case', verdict: { outcome: 'rendered', exact: true } }])}\n`;
    commit(dir, { 'conformance/hostile.json': verdicts, 'conformance/corpus/h-case.md': '<script>x</script>\n' }, 'start');
    commit(dir, { 'conformance/corpus/h-case-2.md': 'more\n' }, 'a new input');
    expect(ratchet(dir, '--base', 'HEAD^')).toEqual({ status: 0, out: 'ratchet: 1 verdicts kept, 0 golden moves named\n', err: '' });
    commit(dir, { 'conformance/corpus/h-case.md': 'x\n' }, 'weaken the input');
    expect(ratchet(dir, '--base', 'HEAD^')).toEqual({
      status: 1,
      out: '',
      err: 'ratchet: h-case: its input changed (add a new case instead)\n',
    });
  });

  it('a base hostile.json that does not parse is an error, not an empty base', () => {
    const dir = repo();
    commit(dir, { 'conformance/hostile.json': '[{' }, 'broken');
    commit(dir, { 'conformance/hostile.json': '[]\n' }, 'fixed');
    const r = ratchet(dir, '--base', 'HEAD^');
    expect(r.status).toBe(1);
    expect(r.err).toContain('SyntaxError');
  });

  it('usage errors exit 2', () => {
    const dir = repo();
    commit(dir, { 'conformance/hostile.json': '[]\n' }, 'start');
    expect(ratchet(dir)).toEqual({ status: 2, out: '', err: 'usage: node scripts/ratchet.mjs --base <git ref>\n' });
    expect(ratchet(dir, '--base', 'no-such-ref')).toEqual({ status: 2, out: '', err: 'ratchet: unknown base "no-such-ref"\n' });
  });
});
