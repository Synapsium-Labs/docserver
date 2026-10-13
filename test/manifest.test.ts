// The corpus bookkeeping (docserver L1, Task 2; architecture sections D and E). manifest.json names every case
// once; a golden or hostile case has one input under corpus/, a reference under reference/ and an expected
// pair under expected/; a generated case (Task 11) has no input file. Every probe of the original scout run
// is folded into exactly one case (probes.txt is the committed list of their names). PROVENANCE.json ties
// each reference to the exact bytes of its input, so an edited input without regenerated references is red.
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('../conformance/', import.meta.url));
const at = (rel: string): string => path.join(ROOT, rel);
const readText = (rel: string): string => readFileSync(at(rel), 'utf8');
const sha256 = (rel: string): string => createHash('sha256').update(readFileSync(at(rel))).digest('hex');

/** Every file under a conformance/ subdirectory, as sorted paths relative to it ('/' separators). */
function filesUnder(dir: string): string[] {
  if (!existsSync(at(dir))) return [];
  return readdirSync(at(dir), { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => path.relative(at(dir), path.join(e.parentPath, e.name)).split(path.sep).join('/'))
    .sort();
}

type Kind = 'golden' | 'hostile' | 'generated';
interface Case {
  id: string;
  kind: Kind;
  pins: string;
  probes: string[];
  options?: Record<string, unknown>;
}

const manifest = JSON.parse(readText('manifest.json')) as Case[];
const withInput = manifest.filter((c) => c.kind !== 'generated');
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)?$/;
const PROBE = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;
const KEYS = new Set(['id', 'kind', 'pins', 'probes', 'options']);
const KINDS = new Set<string>(['golden', 'hostile', 'generated']);

describe('manifest.json', () => {
  it('is an array of entries with known keys, a known kind and a probes array', () => {
    expect(Array.isArray(manifest)).toBe(true);
    const bad = manifest.filter(
      (c) =>
        Object.keys(c).some((k) => !KEYS.has(k)) ||
        !KINDS.has(c.kind) ||
        !Array.isArray(c.probes) ||
        (c.options !== undefined && (typeof c.options !== 'object' || c.options === null || Array.isArray(c.options))),
    );
    expect(bad.map((c) => c.id)).toEqual([]);
  });

  it('ids are unique and well-formed', () => {
    const ids = manifest.map((c) => c.id);
    expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([]);
    expect(ids.filter((id) => !ID.test(id))).toEqual([]);
  });

  it('pins is non-empty', () => {
    expect(manifest.filter((c) => typeof c.pins !== 'string' || c.pins.trim() === '').map((c) => c.id)).toEqual([]);
  });

  it('every corpus file has an entry and every golden or hostile entry has a corpus file', () => {
    expect(filesUnder('corpus')).toEqual(withInput.map((c) => `${c.id}.md`).sort());
  });

  it('a generated case has no corpus file', () => {
    const generated = manifest.filter((c) => c.kind === 'generated');
    expect(generated.filter((c) => existsSync(at(`corpus/${c.id}.md`))).map((c) => c.id)).toEqual([]);
  });
});

describe('probes', () => {
  const listed = readText('probes.txt').split('\n');

  it('probes.txt is sorted, unique, one name per line, newline-terminated', () => {
    expect(listed.at(-1)).toBe('');
    const names = listed.slice(0, -1);
    expect(names.filter((n) => !PROBE.test(n))).toEqual([]);
    expect(names).toEqual([...new Set(names)].sort());
  });

  it('probe union: every probe is folded into exactly one case', () => {
    const folded = manifest.flatMap((c) => c.probes);
    expect(folded.filter((p, i) => folded.indexOf(p) !== i)).toEqual([]);
    expect([...folded].sort()).toEqual(listed.slice(0, -1));
  });
});

describe('reference/ and expected/', () => {
  const pairs = (ids: string[]): string[] => ids.flatMap((id) => [`${id}.html`, `${id}.meta.json`]).sort();
  const ids = withInput.map((c) => c.id);

  it('every golden and hostile case has reference html and meta, and nothing else is there', () => {
    expect(filesUnder('reference')).toEqual([...pairs(ids), 'PROVENANCE.json'].sort());
  });

  it('every golden and hostile case has expected html and meta, and nothing else is there', () => {
    expect(filesUnder('expected')).toEqual(pairs(ids));
  });

  it('no reference renders the failure fallback', () => {
    expect(ids.filter((id) => readText(`reference/${id}.html`).includes('could not be rendered'))).toEqual([]);
  });
});

describe('reference/PROVENANCE.json', () => {
  interface Provenance {
    python: string;
    packages: Record<string, string>;
    renderer: string;
    inputs: Record<string, string>;
    date: string;
  }
  const prov = (): Provenance => JSON.parse(readText('reference/PROVENANCE.json')) as Provenance;
  const VERSION = /^\d+\.\d+\.\d+$/;
  const SHA = /^[0-9a-f]{64}$/;

  it('names every input by its current sha256', () => {
    const expected = Object.fromEntries(withInput.map((c) => [c.id, sha256(`corpus/${c.id}.md`)]));
    expect(prov().inputs).toEqual(expected);
  });

  it('records versions and hashes only', () => {
    const p = prov();
    expect(Object.keys(p)).toEqual(['python', 'packages', 'renderer', 'inputs', 'date']);
    expect(p.python).toMatch(VERSION);
    expect(Object.keys(p.packages)).toEqual(['markdown-it-py', 'mdit-py-plugins', 'Pygments', 'PyYAML']);
    expect(Object.values(p.packages).filter((v) => !VERSION.test(v))).toEqual([]);
    expect(p.renderer).toMatch(SHA);
    expect(Object.values(p.inputs).filter((v) => !SHA.test(v))).toEqual([]);
    expect(p.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
