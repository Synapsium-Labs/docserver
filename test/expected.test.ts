// The contract files (docserver L1, Task 2; architecture section D). For every golden and hostile case,
// expected/<id>.html is normaliseForCompare(reference/<id>.html) and expected/<id>.meta.json is
// reference/<id>.meta.json, byte for byte, unless DEPARTURES.json lists that file: a listed file must differ
// (no stale entry) and an unlisted one must not (no silent edit). Departures are PD2-PD4 (ruling C1) and
// PD7 (ruling C25).
//
// Regenerate the unlisted files with `UPDATE_EXPECTED=1 ./node_modules/.bin/vitest run test/expected.test.ts`;
// listed files are edited by hand. CI never sets UPDATE_EXPECTED (test/ci-workflow.test.ts).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { normaliseForCompare } from '../src/conformance/normalise.js';

const ROOT = fileURLToPath(new URL('../conformance/', import.meta.url));
const at = (rel: string): string => path.join(ROOT, rel);
const readText = (rel: string): string => readFileSync(at(rel), 'utf8');

type File = 'html' | 'meta';
const FILES: readonly File[] = ['html', 'meta'];
const CATEGORIES = new Set(['PD2', 'PD3', 'PD4', 'PD7']);
interface Case {
  id: string;
  kind: 'golden' | 'hostile' | 'generated';
}
interface Departure {
  case: string;
  files: File[];
  category: string;
  reason: string;
}

const manifest = JSON.parse(readText('manifest.json')) as Case[];
const departures = JSON.parse(readText('DEPARTURES.json')) as Departure[];
const ids = manifest.filter((c) => c.kind !== 'generated').map((c) => c.id);
const listed = new Set(departures.flatMap((d) => d.files.map((f) => `${d.case} ${f}`)));
const name = (id: string, file: File): string => (file === 'html' ? `${id}.html` : `${id}.meta.json`);

/** What expected/ holds for a file no departure lists: derived from the reference. */
function derived(id: string, file: File): string {
  const ref = readText(`reference/${name(id, file)}`);
  return file === 'html' ? normaliseForCompare(ref) : ref;
}

if (process.env['UPDATE_EXPECTED'] === '1') {
  for (const id of ids) {
    for (const file of FILES) {
      if (listed.has(`${id} ${file}`)) continue;
      const target = at(`expected/${name(id, file)}`);
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, derived(id, file), 'utf8');
    }
  }
}

describe('DEPARTURES.json', () => {
  it('is a list of {case, files, category, reason}, one entry per known case', () => {
    expect(Array.isArray(departures)).toBe(true);
    const bad = departures.filter(
      (d) =>
        Object.keys(d).sort().join() !== 'case,category,files,reason' ||
        !ids.includes(d.case) ||
        !Array.isArray(d.files) ||
        d.files.length === 0 ||
        new Set(d.files).size !== d.files.length ||
        d.files.some((f) => !FILES.includes(f)) ||
        !CATEGORIES.has(d.category) ||
        typeof d.reason !== 'string' ||
        d.reason.trim() === '',
    );
    expect(bad).toEqual([]);
    const cases = departures.map((d) => d.case);
    expect(cases.filter((c, i) => cases.indexOf(c) !== i)).toEqual([]);
  });
});

describe('expected/: unlisted equals reference', () => {
  for (const id of ids) {
    for (const file of FILES) {
      if (listed.has(`${id} ${file}`)) continue;
      it(`${id} ${file}`, () => {
        expect(readText(`expected/${name(id, file)}`)).toBe(derived(id, file));
      });
    }
  }
});

describe('expected/: listed differs', () => {
  it('every file DEPARTURES.json lists differs from its derived reference', () => {
    const stale = [...listed].filter((entry) => {
      const [id = '', file = 'html'] = entry.split(' ') as [string, File];
      return readText(`expected/${name(id, file)}`) === derived(id, file);
    });
    expect(stale).toEqual([]);
  });
});
