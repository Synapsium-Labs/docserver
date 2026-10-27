// The conformance corpus against this library's render() (docserver L1, Task 3; architecture section F,
// "How tasks hand over"). test/corpus-pending.json names the cases a later task makes pass, each with that
// task (`"T<n>"`): a pending case must FAIL, so a case that starts passing is removed from the list in the
// same change, and every other case must pass. Each task removed its own cases, and at the end of L1 the list
// is empty (Task 12). The first blocks test runCorpus and loadCorpus themselves with stand-in render functions.
// Task 11 adds the verdicts of conformance/hostile.json: a hostile case is judged by its golden and its
// verdict, a generated case (built from a spec, with no golden) by its verdict alone, and the oracle runs
// on every case. Every non-ASCII character is written as a \u escape.
import { Buffer } from 'node:buffer';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadCorpus, runCorpus, type RenderFn } from '../src/conformance/index.js';
import { render, scanRefs } from '../src/render/index.js';
import type { RenderMeta, RenderResult } from '../src/render/types.js';

const pending = JSON.parse(readFileSync(new URL('./corpus-pending.json', import.meta.url), 'utf8')) as Record<
  string,
  string
>;
const cases = loadCorpus();

/** A stand-in renderer that returns one case's expected output, plus `extra` appended to the HTML. */
function replay(id: string, extra = ''): RenderFn {
  const expected = cases.find((x) => x.id === id)?.expected;
  if (expected === undefined || expected === null) throw new Error(`no golden case ${id}`);
  return () => ({
    html: expected.html + extra,
    outcome: 'rendered',
    bytes: 0,
    meta: JSON.parse(expected.meta) as RenderMeta,
  });
}

/** A stand-in renderer that returns `html` for any input. */
function fixed(html: string): RenderFn {
  const meta = JSON.parse(cases.find((x) => x.id === 'empty-docs/empty')?.expected?.meta ?? '') as RenderMeta;
  return (): RenderResult => ({ html, outcome: 'rendered', bytes: 0, meta });
}

describe('loadCorpus', () => {
  it('loads every case of the manifest, in order, with its input and expected files', () => {
    const manifest = JSON.parse(
      readFileSync(new URL('../conformance/manifest.json', import.meta.url), 'utf8'),
    ) as { id: string }[];
    expect(cases.map((c) => c.id)).toEqual(manifest.map((m) => m.id));
    expect(cases.filter((c) => c.kind === 'golden')).toHaveLength(37);
    expect(cases.filter((c) => c.kind === 'hostile')).toHaveLength(17);
    expect(cases.filter((c) => c.kind === 'generated')).toHaveLength(30);
    expect(cases.filter((c) => c.expected !== null && !c.expected.meta.endsWith('}\n')).map((c) => c.id)).toEqual([]);
  });

  it('a golden case has expected files and no verdict; a hostile case has both; a generated case a verdict only', () => {
    const shape = (k: string): string[] => [
      ...new Set(cases.filter((c) => c.kind === k).map((c) => `${String(c.expected !== null)} ${String(c.verdict !== null)}`)),
    ];
    expect(shape('golden')).toEqual(['true false']);
    expect(shape('hostile')).toEqual(['true true']);
    expect(shape('generated')).toEqual(['false true']);
    expect(cases.filter((c) => c.kind === 'hostile' && c.verdict?.exact !== true)).toEqual([]);
  });

  it('keeps a BOM and CRLF in the input, as the reference read it', () => {
    expect(cases.find((c) => c.id === 'line-endings/bom')?.input.startsWith('\ufeff')).toBe(true);
    expect(cases.find((c) => c.id === 'line-endings/crlf')?.input.includes('\r\n')).toBe(true);
  });

  it('builds a generated input from its spec', () => {
    const over = cases.find((c) => c.id === 'x-limits/over-limit')?.input ?? '';
    expect(Buffer.byteLength(over, 'utf8')).toBe(4_194_305);
    expect(over.endsWith('a\u00e9')).toBe(true);
    const images = cases.find((c) => c.id === 'x-limits/images-many')?.input ?? '';
    expect(images.startsWith('![i](0.png)\n![i](1.png)\n')).toBe(true);
    expect(images.endsWith('![i](9999.png)\n')).toBe(true);
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

describe('runCorpus: verdicts', () => {
  it('judges a hostile case by its golden and by its verdict', () => {
    const run = runCorpus(replay('h-script-and-tags', '<SCRIPT>'), { only: ['h-script-and-tags'] });
    expect(run.results[0]?.failures.map((f) => f.split(' ')[0])).toEqual(['html', 'forbid:', 'oracle:']);
  });

  it('judges a generated case by its verdict and the oracle alone', () => {
    const deep = `${'<blockquote>\n'.repeat(21)}${'</blockquote>\n'.repeat(21)}`;
    const run = runCorpus(fixed(deep), { only: ['x-blockquote-10000'] });
    expect(run.results[0]?.failures).toEqual(['maxTagDepth: blockquote nests 21 deep, bound 20']);
    expect(runCorpus(fixed('<p>x</p>\n'), { only: ['x-blockquote-10000'] }).ok).toBe(true);
  });

  it('a verdict states the outcome: an over-limit case fails a render that parses it', () => {
    const run = runCorpus(fixed('<p>a</p>\n'), { only: ['x-limits/over-limit'] });
    expect(run.results[0]?.failures).toEqual([
      'outcome: expected "over-limit", got "rendered"',
      'outcome: an over-limit render has empty html, got 9 characters',
    ]);
  });

  it('a scan verdict needs scanRefs, and says so', () => {
    expect(runCorpus(render, { only: ['x-limits/images-many'] }).results[0]?.failures).toEqual([
      'scan: no scanRefs function was given; pass runCorpus(render, { scanRefs })',
    ]);
    expect(runCorpus(render, { only: ['x-limits/images-many'], scanRefs }).ok).toBe(true);
  });

  it('a scanRefs that throws is the scan arm\'s failure, not an exception', () => {
    const run = runCorpus(render, {
      only: ['x-limits/images-many'],
      scanRefs: () => {
        throw new Error('no scan');
      },
    });
    expect(run.results[0]?.failures).toEqual(['scan: scanRefs threw: Error: no scan']);
  });

  it('timeScale multiplies every maxMs, and must be a positive finite number', () => {
    const tight = runCorpus(render, { only: ['x-delimiters/emph-nest-100'], timeScale: 1e-9 });
    expect(tight.results[0]?.failures.map((f) => f.split(' ')[0])).toEqual(['maxMs:']);
    for (const timeScale of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => runCorpus(render, { only: [], timeScale })).toThrow(
        /runCorpus: timeScale must be a positive finite number/,
      );
    }
  });
});

describe('the corpus against render()', () => {
  const run = runCorpus(render, { scanRefs });
  const ids = new Set(cases.map((c) => c.id));

  it('pending is empty: every case of the corpus passes (Task 12)', () => {
    expect(pending).toEqual({});
    expect(run.total).toBe(ids.size);
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
