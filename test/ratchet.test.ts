// The verdict ratchet and the golden-move rule (docserver L1, Task 11; architecture section D), and the Level 2
// rules (docserver L2, Task 6): a moved layout snapshot is named in a Layout-moved trailer, and a hostile layout case
// is never removed or edited. The pure functions of scripts/ratchet.mjs, one case per kind of weakening and the
// tightenings that pass; then the command itself, run with this Node against throwaway git repositories made in the
// system temp directory (git's global and system configuration are ignored there, and nothing is pushed or fetched).
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import {
  checkGoldenMoves,
  checkHostileInputs,
  checkLayoutHostile,
  checkLayoutMoves,
  compareVerdicts,
  expectedIds,
  hostileLayoutIds,
  layoutChanges,
  movedLayoutIds,
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

  it('none, exactly and in lower case, names no case; beside real ids it is dropped and they stay', () => {
    expect(parseTrailerIds('none\0')).toEqual([]);
    expect(parseTrailerIds(' none \n\0none\0')).toEqual([]);
    expect(parseTrailerIds('none, a\0')).toEqual(['a']);
    expect(parseTrailerIds('a\nnone\n b/c\0')).toEqual(['a', 'b/c']);
    // Only the exact word is reserved: another spelling is an id like any other, and refused as one when nothing moved.
    expect(parseTrailerIds('None, NONE, nonex, none/x\0')).toEqual(['None', 'NONE', 'nonex', 'none/x']);
  });

  it('a none trailer passes when nothing moved; a move is still named by its own id', () => {
    expect(checkGoldenMoves([], parseTrailerIds('none\0'))).toEqual([]);
    expect(checkLayoutMoves([], parseTrailerIds('none\0'))).toEqual([]);
    expect(checkGoldenMoves(['a'], parseTrailerIds('none\0'))).toEqual([
      'a: its expected files changed, and no Goldens-moved trailer names it',
    ]);
    expect(checkLayoutMoves(['core/a'], parseTrailerIds('none\0'))).toEqual([
      'core/a: its layout snapshot changed, and no Layout-moved trailer names it',
    ]);
    expect(checkGoldenMoves(['a'], parseTrailerIds('none, a\0'))).toEqual([]);
    expect(checkLayoutMoves(['core/a'], parseTrailerIds('none, core/a\0'))).toEqual([]);
    expect(checkGoldenMoves(['a', 'b'], parseTrailerIds('none, a\0'))).toEqual([
      'b: its expected files changed, and no Goldens-moved trailer names it',
    ]);
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

describe('Level 2: layout moves and hostile layout cases', () => {
  const L = 'conformance/layout/';
  const changes = layoutChanges(
    [`M\t${L}core/a.dom.txt`, `A\t${L}core/new.dom.txt`, `D\t${L}core/gone.dom.txt`, `T\t${L}core/b.dom.txt`, `M\t${L}core/c.md`, `M\tREADME.md`, `M\t${L}core/x/deep.md`, ''].join('\n'),
  );

  it('reads the name-status lines under conformance/layout/ only, as case ids and kinds', () => {
    expect(changes.map((c) => [c.status, c.id, c.kind])).toEqual([
      ['M', 'core/a', 'dom.txt'],
      ['A', 'core/new', 'dom.txt'],
      ['D', 'core/gone', 'dom.txt'],
      ['T', 'core/b', 'dom.txt'],
      ['M', 'core/c', 'md'],
    ]);
  });

  it('a modified, retyped or deleted snapshot is a move; an added one is a new case', () => {
    expect(movedLayoutIds(changes)).toEqual(['core/a', 'core/b', 'core/gone']);
  });

  it('the trailers name exactly the moved cases', () => {
    expect(checkLayoutMoves(['core/a'], ['core/a'])).toEqual([]);
    expect(checkLayoutMoves(['core/a', 'core/b'], ['core/a', 'core/z'])).toEqual([
      'core/b: its layout snapshot changed, and no Layout-moved trailer names it',
      'core/z: a Layout-moved trailer names it, and its layout snapshot did not change',
    ]);
  });

  it('the hostile cases are those whose options file says hostile: true', () => {
    const files = [
      { path: `${L}core/h.options.json`, text: '{"options":{},"scope":["x"],"hostile":true}' },
      { path: `${L}core/p.options.json`, text: '{"options":{},"scope":["x"]}' },
      { path: `${L}core/h.md`, text: 'not json' },
    ];
    expect(hostileLayoutIds(files)).toEqual(['core/h']);
    expect(() => hostileLayoutIds([{ path: `${L}core/q.options.json`, text: '{' }])).toThrow(SyntaxError);
  });

  it('a hostile case is never removed and its input and options never change; its snapshot may move', () => {
    const at = (status: string, file: string): string => `${status}\t${L}core/h.${file}`;
    const verdict = (...lines: string[]): string[] => checkLayoutHostile(['core/h'], layoutChanges(lines.join('\n')));
    expect(verdict(at('M', 'dom.txt'))).toEqual([]);
    expect(verdict(at('M', 'md'))).toEqual(["core/h: a hostile layout case's input or options changed (add a new case instead)"]);
    expect(verdict(at('M', 'options.json'))).toEqual(["core/h: a hostile layout case's input or options changed (add a new case instead)"]);
    for (const file of ['md', 'options.json', 'dom.txt']) {
      expect(verdict(at('D', file))).toEqual(['core/h: a hostile layout case was removed (a hostile case is never removed)']);
    }
    expect(checkLayoutHostile(['core/h'], layoutChanges(`M\t${L}core/p.md`))).toEqual([]);
  });
});

describe('Level 2, per layout: conformance/layouts/<name>/<slug>/<id>.dom.txt (parity Task 9)', () => {
  const P = 'conformance/layouts/';
  const changes = layoutChanges(
    [
      `M\t${P}classic/core/a.dom.txt`,
      `A\t${P}classic/core/new.dom.txt`,
      `D\t${P}review/core/gone.dom.txt`,
      `T\t${P}guided/core/b.dom.txt`,
      `M\tconformance/layout/core/a.dom.txt`,
      `M\t${P}classic/core/a.md`,
      `M\t${P}classic/core.dom.txt`,
      `M\t${P}classic/core/x/deep.dom.txt`,
      '',
    ].join('\n'),
  );

  it("reads a layout's own snapshot as `<name>/<slug>/<id>`, beside the shared cases, and nothing else under conformance/layouts/", () => {
    expect(changes.map((c) => [c.status, c.id, c.kind])).toEqual([
      ['M', 'classic/core/a', 'dom.txt'],
      ['A', 'classic/core/new', 'dom.txt'],
      ['D', 'review/core/gone', 'dom.txt'],
      ['T', 'guided/core/b', 'dom.txt'],
      ['M', 'core/a', 'dom.txt'],
    ]);
  });

  it('a modified, retyped or deleted per-layout snapshot is a move; an added one is not', () => {
    expect(movedLayoutIds(changes)).toEqual(['classic/core/a', 'core/a', 'guided/core/b', 'review/core/gone']);
    expect(movedLayoutIds(layoutChanges(`A\t${P}classic/core/new.dom.txt`))).toEqual([]);
  });

  it('a layout snapshot and the shared case of the same slug and id are two cases, each named by its own id', () => {
    expect(checkLayoutMoves(['classic/core/a', 'core/a'], ['core/a'])).toEqual(['classic/core/a: its layout snapshot changed, and no Layout-moved trailer names it']);
    expect(checkLayoutMoves(['classic/core/a'], ['classic/core/a'])).toEqual([]);
    expect(checkLayoutMoves(['classic/core/a'], ['core/a'])).toEqual([
      'classic/core/a: its layout snapshot changed, and no Layout-moved trailer names it',
      'core/a: a Layout-moved trailer names it, and its layout snapshot did not change',
    ]);
  });

  it('per-layout hostile snapshots cannot be deleted, while moves and additions remain allowed', () => {
    const verdict = (status: string, name: string): string[] =>
      checkLayoutHostile(['core/h'], layoutChanges(`${status}\t${P}${name}/core/h.dom.txt`));
    expect(verdict('D', 'classic')).toEqual(['classic/core/h: a hostile layout case was removed (a hostile case is never removed)']);
    expect(verdict('D', 'editorial')).toEqual(['editorial/core/h: a hostile layout case was removed (a hostile case is never removed)']);
    expect(verdict('M', 'classic')).toEqual([]);
    expect(verdict('T', 'classic')).toEqual([]);
    expect(verdict('A', 'classic')).toEqual([]);
    expect(checkLayoutHostile(['classic/h'], layoutChanges(`D\t${P}classic/core/h.dom.txt`))).toEqual([]);
    expect(checkLayoutHostile(['classic/h'], layoutChanges('D\tconformance/layout/classic/h.dom.txt'))).toEqual([
      'classic/h: a hostile layout case was removed (a hostile case is never removed)',
    ]);
    expect(checkLayoutHostile(['core/h'], layoutChanges(`D\t${P}classic/core/other.dom.txt`))).toEqual([]);
  });
});

describe('the reserved word none', () => {
  const ROOT = fileURLToPath(new URL('../conformance/', import.meta.url));
  /** Every file under a conformance/ subdirectory, relative to it with '/' separators. */
  const filesUnder = (dir: string): string[] =>
    readdirSync(path.join(ROOT, dir), { recursive: true, withFileTypes: true })
      .filter((e) => e.isFile())
      .map((e) => path.relative(path.join(ROOT, dir), path.join(e.parentPath, e.name)).split(path.sep).join('/'));
  const idsOf = (rels: string[]): string[] => [...new Set(rels.map((r) => r.replace(/\.(meta\.json|html|md|options\.json|dom\.txt)$/, '')))];

  it('no conformance case is called none, so the reserved word of the moved-trailers can never hide one', () => {
    const manifest = (JSON.parse(readFileSync(path.join(ROOT, 'manifest.json'), 'utf8')) as { id: string }[]).map((e) => e.id);
    const hostile = (JSON.parse(readFileSync(path.join(ROOT, 'hostile.json'), 'utf8')) as { id: string }[]).map((e) => e.id);
    const expected = idsOf(filesUnder('expected'));
    const corpus = idsOf(filesUnder('corpus'));
    const layout = idsOf(filesUnder('layout'));
    expect(manifest.length).toBeGreaterThan(0);
    expect(expected.length).toBeGreaterThan(0);
    expect(layout.length).toBeGreaterThan(0);
    // The ids a trailer would name: a corpus case id, or a layout case's <slug>/<id>. A case may not be called none
    // in any directory, nor under a directory called none, so the word never reads as part of a name either.
    for (const id of [...manifest, ...hostile, ...expected, ...corpus, ...layout]) {
      expect(id.split('/'), id).not.toContain('none');
    }
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
    expect(ratchet(dir, '--base', 'HEAD^')).toEqual({ status: 0, out: 'ratchet: 0 verdicts kept, 0 golden moves named, 0 hostile layout cases kept, 0 layout moves named\n', err: '' });
    commit(dir, { 'README.md': 'y\n' }, 'readme');
    expect(ratchet(dir, '--base', 'HEAD^')).toEqual({ status: 0, out: 'ratchet: 1 verdicts kept, 0 golden moves named, 0 hostile layout cases kept, 0 layout moves named\n', err: '' });
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
    expect(ratchet(dir, '--base', 'HEAD^')).toEqual({ status: 0, out: 'ratchet: 0 verdicts kept, 1 golden moves named, 0 hostile layout cases kept, 0 layout moves named\n', err: '' });
  });

  it('on a branch, only the branch is read: a move on the base after the fork is not the branch\'s', () => {
    const dir = repo();
    commit(dir, { 'conformance/hostile.json': '[]\n', 'conformance/expected/a.html': '<p>1</p>\n' }, 'start');
    git(dir, 'checkout', '-q', '-b', 'topic');
    commit(dir, { 'README.md': 'x\n' }, 'topic work');
    git(dir, 'checkout', '-q', 'main');
    commit(dir, { 'conformance/expected/a.html': '<p>2</p>\n' }, 'move on main\n\nGoldens-moved: a');
    git(dir, 'checkout', '-q', 'topic');
    expect(ratchet(dir, '--base', 'main')).toEqual({ status: 0, out: 'ratchet: 0 verdicts kept, 0 golden moves named, 0 hostile layout cases kept, 0 layout moves named\n', err: '' });
  });

  it('an edited input of a hostile case exits 1 and names it; a new case beside it passes', () => {
    const dir = repo();
    const verdicts = `${JSON.stringify([{ id: 'h-case', verdict: { outcome: 'rendered', exact: true } }])}\n`;
    commit(dir, { 'conformance/hostile.json': verdicts, 'conformance/corpus/h-case.md': '<script>x</script>\n' }, 'start');
    commit(dir, { 'conformance/corpus/h-case-2.md': 'more\n' }, 'a new input');
    expect(ratchet(dir, '--base', 'HEAD^')).toEqual({ status: 0, out: 'ratchet: 1 verdicts kept, 0 golden moves named, 0 hostile layout cases kept, 0 layout moves named\n', err: '' });
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

  const layoutCase = (hostile: boolean, dom: string): Record<string, string> => ({
    'conformance/layout/core/a.md': '# A\n',
    'conformance/layout/core/a.options.json': JSON.stringify({ options: {}, scope: ['x'], ...(hostile ? { hostile: true } : {}) }),
    'conformance/layout/core/a.dom.txt': dom,
  });
  const moved = (n: number, kept = 0): { status: number; out: string; err: string } => ({
    status: 0,
    out: `ratchet: 0 verdicts kept, 0 golden moves named, ${String(kept)} hostile layout cases kept, ${String(n)} layout moves named\n`,
    err: '',
  });

  it('a moved layout snapshot needs a Layout-moved trailer naming exactly its case; a new case needs none', () => {
    const dir = repo();
    commit(dir, { 'conformance/hostile.json': '[]\n', ...layoutCase(false, 'h1\n') }, 'start');
    commit(dir, { 'conformance/layout/core/b.md': '# B\n', 'conformance/layout/core/b.options.json': '{"options":{},"scope":["x"]}', 'conformance/layout/core/b.dom.txt': 'h1\n' }, 'a new case');
    expect(ratchet(dir, '--base', 'HEAD^')).toEqual(moved(0));
    commit(dir, { 'conformance/layout/core/a.dom.txt': 'h2\n' }, 'move a snapshot');
    expect(ratchet(dir, '--base', 'HEAD^')).toEqual({
      status: 1,
      out: '',
      err: 'ratchet: core/a: its layout snapshot changed, and no Layout-moved trailer names it\n',
    });
    git(dir, 'commit', '-q', '--amend', '-m', 'move a snapshot\n\nLayout-moved: core/a, core/b');
    expect(ratchet(dir, '--base', 'HEAD^')).toEqual({
      status: 1,
      out: '',
      err: 'ratchet: core/b: a Layout-moved trailer names it, and its layout snapshot did not change\n',
    });
    git(dir, 'commit', '-q', '--amend', '-m', 'move a snapshot\n\nLayout-moved: core/a\nCo-Authored-By: Test <noreply@example.invalid>');
    expect(ratchet(dir, '--base', 'HEAD^')).toEqual(moved(1));
  });

  it("a moved or deleted per-layout snapshot (conformance/layouts/<name>/...) needs a Layout-moved trailer naming `<name>/<slug>/<id>`; a new one needs none (parity Task 9)", () => {
    const dir = repo();
    const snap = (name: string, text: string): Record<string, string> => ({ [`conformance/layouts/${name}/core/a.dom.txt`]: text });
    commit(dir, { 'conformance/hostile.json': '[]\n', ...layoutCase(false, 'h1\n'), ...snap('classic', 'c1\n') }, 'start');
    // A layout's first snapshot, and a second layout's: additions, named by nothing.
    commit(dir, { ...snap('editorial', 'r1\n'), 'conformance/layouts/classic/core/b.dom.txt': 'c1\n' }, 'new snapshots');
    expect(ratchet(dir, '--base', 'HEAD^')).toEqual(moved(0));
    commit(dir, snap('classic', 'c2\n'), 'move a layout snapshot');
    expect(ratchet(dir, '--base', 'HEAD^')).toEqual({
      status: 1,
      out: '',
      err: 'ratchet: classic/core/a: its layout snapshot changed, and no Layout-moved trailer names it\n',
    });
    // The shared case's name is not the layout snapshot's.
    git(dir, 'commit', '-q', '--amend', '-m', 'move a layout snapshot\n\nLayout-moved: core/a');
    expect(ratchet(dir, '--base', 'HEAD^')).toEqual({
      status: 1,
      out: '',
      err:
        'ratchet: classic/core/a: its layout snapshot changed, and no Layout-moved trailer names it\n' +
        'ratchet: core/a: a Layout-moved trailer names it, and its layout snapshot did not change\n',
    });
    git(dir, 'commit', '-q', '--amend', '-m', 'move a layout snapshot\n\nLayout-moved: classic/core/a');
    expect(ratchet(dir, '--base', 'HEAD^')).toEqual(moved(1));
    // A snapshot of another layout does not stand for it, and a deletion is a move.
    git(dir, 'rm', '-q', 'conformance/layouts/editorial/core/a.dom.txt');
    git(dir, 'add', '-A');
    git(dir, 'commit', '-q', '-m', 'delete a layout snapshot');
    expect(ratchet(dir, '--base', 'HEAD^')).toEqual({
      status: 1,
      out: '',
      err: 'ratchet: editorial/core/a: its layout snapshot changed, and no Layout-moved trailer names it\n',
    });
  });

  it('the CLI refuses a named hostile per-layout deletion and accepts named edits and additions', () => {
    const dir = repo();
    commit(dir, { 'conformance/hostile.json': '[]\n', ...layoutCase(true, 'h1\n'), 'conformance/layouts/classic/core/a.dom.txt': 'c1\n' }, 'start');
    commit(dir, { 'conformance/layouts/editorial/core/a.dom.txt': 'e1\n' }, 'add');
    expect(ratchet(dir, '--base', 'HEAD^')).toEqual(moved(0, 1));
    commit(dir, { 'conformance/layouts/classic/core/a.dom.txt': 'c2\n' }, 'edit');
    expect(ratchet(dir, '--base', 'HEAD^').status).toBe(1);
    git(dir, 'commit', '-q', '--amend', '-m', 'edit\n\nLayout-moved: classic/core/a');
    expect(ratchet(dir, '--base', 'HEAD^')).toEqual(moved(1, 1));
    git(dir, 'rm', '-q', 'conformance/layouts/classic/core/a.dom.txt');
    git(dir, 'commit', '-q', '-m', 'delete\n\nLayout-moved: classic/core/a');
    expect(ratchet(dir, '--base', 'HEAD^')).toEqual({
      status: 1, out: '',
      err: 'ratchet: classic/core/a: a hostile layout case was removed (a hostile case is never removed)\n',
    });
  });

  it('a hostile layout case is never removed or edited; its snapshot moves with a trailer; another case may change', () => {
    const dir = repo();
    commit(dir, { 'conformance/hostile.json': '[]\n', ...layoutCase(true, 'h1\n'), 'conformance/layout/core/p.md': '# P\n', 'conformance/layout/core/p.options.json': '{"options":{},"scope":["x"]}', 'conformance/layout/core/p.dom.txt': 'h1\n' }, 'start');
    commit(dir, { 'conformance/layout/core/p.md': '# P, edited\n' }, 'edit an ordinary case');
    expect(ratchet(dir, '--base', 'HEAD^')).toEqual(moved(0, 1));
    commit(dir, { 'conformance/layout/core/a.dom.txt': 'h2\n' }, 'move the hostile snapshot\n\nLayout-moved: core/a');
    expect(ratchet(dir, '--base', 'HEAD^')).toEqual(moved(1, 1));
    commit(dir, { 'conformance/layout/core/a.md': '# A, weaker\n' }, 'edit the hostile input');
    expect(ratchet(dir, '--base', 'HEAD^')).toEqual({
      status: 1,
      out: '',
      err: "ratchet: core/a: a hostile layout case's input or options changed (add a new case instead)\n",
    });
    commit(dir, { 'conformance/layout/core/a.md': '# A\n' }, 'restore');
    git(dir, 'rm', '-q', 'conformance/layout/core/a.md', 'conformance/layout/core/a.options.json', 'conformance/layout/core/a.dom.txt');
    git(dir, 'commit', '-q', '-m', 'remove the hostile case\n\nLayout-moved: core/a');
    expect(ratchet(dir, '--base', 'HEAD^')).toEqual({
      status: 1,
      out: '',
      err: 'ratchet: core/a: a hostile layout case was removed (a hostile case is never removed)\n',
    });
  });

  it('a hostile layout case moved to a new name is a removal: renames are not followed', () => {
    const dir = repo();
    commit(dir, { 'conformance/hostile.json': '[]\n', ...layoutCase(true, 'h1\n') }, 'start');
    for (const kind of ['md', 'options.json', 'dom.txt']) {
      git(dir, 'mv', `conformance/layout/core/a.${kind}`, `conformance/layout/core/renamed.${kind}`);
    }
    git(dir, 'commit', '-q', '-m', 'rename the hostile case\n\nLayout-moved: core/a');
    expect(git(dir, 'diff', '--name-status', 'HEAD^', 'HEAD')).toMatch(/^R100\t/m); // git itself sees renames here
    expect(ratchet(dir, '--base', 'HEAD^')).toEqual({
      status: 1,
      out: '',
      err: 'ratchet: core/a: a hostile layout case was removed (a hostile case is never removed)\n',
    });
  });

  const trailered = (subject: string, trailer: string): string =>
    `${subject}\n\n${trailer}\nCo-Authored-By: Test <noreply@example.invalid>`;
  const goldenMoved = (n: number): { status: number; out: string; err: string } => ({
    status: 0,
    out: `ratchet: 0 verdicts kept, ${String(n)} golden moves named, 0 hostile layout cases kept, 0 layout moves named\n`,
    err: '',
  });

  it('a none trailer names no case: it passes when nothing moved, in either trailer', () => {
    const dir = repo();
    commit(dir, { 'conformance/hostile.json': '[]\n', 'conformance/expected/a.html': '<p>1</p>\n', ...layoutCase(false, 'h1\n') }, 'start');
    commit(dir, { 'README.md': 'x\n' }, trailered('a pushed commit', 'Goldens-moved: none'));
    expect(ratchet(dir, '--base', 'HEAD^')).toEqual(goldenMoved(0));
    commit(dir, { 'README.md': 'y\n' }, trailered('another', 'Layout-moved: none'));
    expect(ratchet(dir, '--base', 'HEAD^')).toEqual(moved(0));
    commit(dir, { 'README.md': 'z\n' }, trailered('both', 'Goldens-moved: none\nLayout-moved: none'));
    expect(ratchet(dir, '--base', 'HEAD~3')).toEqual(moved(0));
  });

  it('a move no trailer names is refused, also when the only trailer is none', () => {
    const golden = repo();
    commit(golden, { 'conformance/hostile.json': '[]\n', 'conformance/expected/a.html': '<p>1</p>\n' }, 'start');
    commit(golden, { 'conformance/expected/a.html': '<p>2</p>\n' }, trailered('move a golden', 'Goldens-moved: none'));
    expect(ratchet(golden, '--base', 'HEAD^')).toEqual({
      status: 1,
      out: '',
      err: 'ratchet: a: its expected files changed, and no Goldens-moved trailer names it\n',
    });
    const layout = repo();
    commit(layout, { 'conformance/hostile.json': '[]\n', ...layoutCase(false, 'h1\n') }, 'start');
    commit(layout, { 'conformance/layout/core/a.dom.txt': 'h2\n' }, trailered('move a snapshot', 'Layout-moved: none'));
    expect(ratchet(layout, '--base', 'HEAD^')).toEqual({
      status: 1,
      out: '',
      err: 'ratchet: core/a: its layout snapshot changed, and no Layout-moved trailer names it\n',
    });
  });

  it('none beside a real move does not hide it: the move is named by its own id, and only by it', () => {
    const golden = repo();
    commit(golden, { 'conformance/hostile.json': '[]\n', 'conformance/expected/a.html': '<p>1</p>\n', 'conformance/expected/b.html': '<p>1</p>\n' }, 'start');
    commit(golden, { 'conformance/expected/a.html': '<p>2</p>\n', 'conformance/expected/b.html': '<p>2</p>\n' }, trailered('move two', 'Goldens-moved: none, a'));
    expect(ratchet(golden, '--base', 'HEAD^')).toEqual({
      status: 1,
      out: '',
      err: 'ratchet: b: its expected files changed, and no Goldens-moved trailer names it\n',
    });
    commit(golden, { 'conformance/expected/a.html': '<p>3</p>\n' }, trailered('move a', 'Goldens-moved: none, a'));
    expect(ratchet(golden, '--base', 'HEAD^')).toEqual(goldenMoved(1));
    const layout = repo();
    commit(layout, { 'conformance/hostile.json': '[]\n', ...layoutCase(false, 'h1\n') }, 'start');
    commit(layout, { 'conformance/layout/core/a.dom.txt': 'h2\n' }, trailered('move a snapshot', 'Layout-moved: none, core/a'));
    expect(ratchet(layout, '--base', 'HEAD^')).toEqual(moved(1));
  });

  it('usage errors exit 2', () => {
    const dir = repo();
    commit(dir, { 'conformance/hostile.json': '[]\n' }, 'start');
    expect(ratchet(dir)).toEqual({ status: 2, out: '', err: 'usage: node scripts/ratchet.mjs --base <git ref>\n' });
    expect(ratchet(dir, '--base', 'no-such-ref')).toEqual({ status: 2, out: '', err: 'ratchet: unknown base "no-such-ref"\n' });
  });
});
