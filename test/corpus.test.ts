// The conformance corpus against this library's render() (docserver L1, Task 3; architecture section F,
// "How tasks hand over"). test/corpus-pending.json names the cases a later task makes pass, each with that
// task (`"T<n>"`): a pending case must FAIL, so a case that starts passing is removed from the list in the
// same change, and every other case must pass. Each task removes its own cases; Task 12 asserts the list
// is empty. The first two blocks test runCorpus and loadCorpus themselves with stand-in render functions.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadCorpus, runCorpus, type RenderFn } from '../src/conformance/index.js';
import { render } from '../src/render/index.js';
import type { RenderMeta } from '../src/render/types.js';

const pending = JSON.parse(readFileSync(new URL('./corpus-pending.json', import.meta.url), 'utf8')) as Record<
  string,
  string
>;
const cases = loadCorpus();

/** A stand-in renderer that returns one case's expected output, plus `extra` appended to the HTML. */
function replay(id: string, extra = ''): RenderFn {
  const c = cases.find((x) => x.id === id);
  if (c === undefined) throw new Error(`no case ${id}`);
  return () => ({
    html: c.expected.html + extra,
    outcome: 'rendered',
    bytes: 0,
    meta: JSON.parse(c.expected.meta) as RenderMeta,
  });
}

describe('loadCorpus', () => {
  it('loads every case of the manifest, in order, with its input and expected files', () => {
    const manifest = JSON.parse(
      readFileSync(new URL('../conformance/manifest.json', import.meta.url), 'utf8'),
    ) as { id: string }[];
    expect(cases.map((c) => c.id)).toEqual(manifest.map((m) => m.id));
    expect(cases.filter((c) => c.kind === 'golden')).toHaveLength(37);
    expect(cases.filter((c) => c.kind === 'hostile')).toHaveLength(14);
    expect(cases.filter((c) => !c.expected.meta.endsWith('}\n')).map((c) => c.id)).toEqual([]);
  });

  it('keeps a BOM and CRLF in the input, as the reference read it', () => {
    expect(cases.find((c) => c.id === 'line-endings/bom')?.input.startsWith('\ufeff')).toBe(true);
    expect(cases.find((c) => c.id === 'line-endings/crlf')?.input.includes('\r\n')).toBe(true);
  });
});

describe('runCorpus', () => {
  it('passes a case whose output is its expected files', () => {
    const run = runCorpus(replay('text-edges'), { only: ['text-edges'] });
    expect(run).toMatchObject({ ok: true, total: 1, passed: 1 });
    expect(run.results[0]?.failures).toEqual([]);
  });

  it('fails a case on its html, and on the oracle, with one line per check', () => {
    const run = runCorpus(replay('text-edges', '<script>x</script>'), { only: ['text-edges'] });
    expect(run.ok).toBe(false);
    expect(run.results[0]?.failures.map((f) => f.split(' ')[0])).toEqual(['html', 'oracle:', 'oracle:']);
  });

  it('fails a case on its meta and on its outcome', () => {
    const good = replay('text-edges')('');
    const run = runCorpus(() => ({ ...good, outcome: 'failed', meta: { ...good.meta, title: 'x' } }), {
      only: ['text-edges'],
    });
    expect(run.results[0]?.failures.map((f) => f.split(' ')[0])).toEqual(['outcome:', 'meta']);
  });

  it('records a render that throws as a failure, not an exception', () => {
    const run = runCorpus(
      () => {
        throw new Error('boom');
      },
      { only: ['empty-docs/empty'] },
    );
    expect(run.results[0]).toMatchObject({ id: 'empty-docs/empty', ok: false, failures: ['render threw: Error: boom'] });
  });

  it('records a result with no html string as a failure', () => {
    const run = runCorpus(() => ({}) as ReturnType<RenderFn>, { only: ['empty-docs/empty'] });
    expect(run.results[0]?.failures).toEqual(['render returned no html string']);
  });

  it('refuses an unknown id, and an empty run is not ok', () => {
    expect(() => runCorpus(render, { only: ['no-such-case'] })).toThrow(/unknown case id\(s\): no-such-case/);
    expect(runCorpus(render, { only: [] })).toEqual({ ok: false, total: 0, passed: 0, results: [] });
  });
});

describe('the corpus against render()', () => {
  const run = runCorpus(render);
  const ids = new Set(cases.map((c) => c.id));

  it('pending names only known cases, each with the later task that makes it pass', () => {
    expect(Object.keys(pending).filter((id) => !ids.has(id))).toEqual([]);
    const bad = Object.entries(pending).filter(([, task]) => !/^T(?:[6-9]|1[0-2])$/.test(task));
    expect(bad).toEqual([]);
  });

  for (const r of run.results) {
    const task = pending[r.id];
    if (task !== undefined) {
      it(`${r.id}: pending must fail (until ${task})`, () => {
        expect(r.ok, `${r.id} passes now: remove it from pending`).toBe(false);
      });
    } else {
      it(`${r.id}: passes`, () => {
        expect(r.failures).toEqual([]);
      });
    }
  }
});
