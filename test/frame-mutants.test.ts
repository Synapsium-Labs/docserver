// The labelled srcdoc mutants (docserver L3, Task 7): conformance/frame-mutants/ ships, beside a clean template, one
// srcdoc per defect the first consumer's checks must catch, each naming the row it must trip (M8.3, M8.4 or M8.8), so a
// consumer's check cannot go green vacuously. Here each committed file is checked against the clean template and the
// mutation that makes it, and against the library's own scan of its row (test/frame-scans.ts); the clean template
// passes every scan. test/frame-document.test.ts checks clean.html against a fresh frameDocument output and runs the
// same scans on the real, expanded texts.
//
// UPDATE_FRAME_MUTANTS=1 (exactly) writes every mutant from the committed clean.html (frame-document.test.ts writes
// clean.html itself).
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { MUTANTS, PLACEHOLDER_NAMES, placeholder, SCANS, updateRequested, type Row } from './frame-scans.js';

const DIR = fileURLToPath(new URL('../conformance/frame-mutants/', import.meta.url));
const read = (file: string): string => readFileSync(path.join(DIR, file), 'utf8');
const UPDATE = updateRequested(process.env);

interface Index {
  readonly format: number;
  readonly about: string;
  readonly clean: string;
  readonly placeholders: Readonly<Record<string, string>>;
  readonly mutants: readonly { readonly file: string; readonly row: Row; readonly mutation: string }[];
}

const index = (): Index => JSON.parse(read('index.json')) as Index;
const clean = (): string => read('clean.html');

if (UPDATE) {
  for (const m of MUTANTS) writeFileSync(path.join(DIR, m.file), m.make(clean()));
}

describe('L3.M1/M2 mutants: index.json lists every file, each with the row it must trip', () => {
  it('has format 1, names clean.html, and lists exactly the mutants MUTANTS makes, in order, with their rows and mutations', () => {
    const ix = index();
    expect(ix.format).toBe(1);
    expect(ix.clean).toBe('clean.html');
    expect(ix.mutants).toEqual(MUTANTS.map(({ file, row, mutation }) => ({ file, row, mutation })));
  });

  it('names one placeholder per asset and the policy, each with what replaces it', () => {
    expect(Object.keys(index().placeholders)).toEqual(PLACEHOLDER_NAMES.map(placeholder));
  });

  it('the directory holds exactly index.json, clean.html and the listed mutants', () => {
    const want = ['clean.html', 'index.json', ...MUTANTS.map((m) => m.file)].sort();
    expect(readdirSync(DIR).sort()).toEqual(want);
  });

  it("a mutant fails its own row's check, not every check: the one that passes M8.3's and M8.4's is named, and index.json tells a consumer to run each mutant against its row's check", () => {
    const passesBoth = MUTANTS.filter((m) => SCANS['M8.3'](read(m.file)).length === 0 && SCANS['M8.4'](read(m.file)).length === 0).map((m) => m.file);
    expect(passesBoth).toEqual(['seed-raw-line-separators.html']);
    expect(index().about).toContain("Check each mutant with its own row's check");
    expect(index().about).toContain('seed-raw-line-separators.html');
  });

  it('every row is one of M8.3, M8.4 and M8.8, and each is tripped by at least two mutants', () => {
    for (const row of ['M8.3', 'M8.4', 'M8.8'] as const) expect(MUTANTS.filter((m) => m.row === row).length, row).toBeGreaterThanOrEqual(2);
    expect(new Set(MUTANTS.map((m) => m.row))).toEqual(new Set(['M8.3', 'M8.4', 'M8.8']));
  });
});

describe('L3.M1/M2 mutants: the clean template passes every scan', () => {
  for (const [row, scan] of Object.entries(SCANS)) {
    it(`${row}: no problem`, () => {
      expect(scan(clean())).toEqual([]);
    });
  }

  it('holds every placeholder once, Mermaid included', () => {
    for (const name of PLACEHOLDER_NAMES) expect(clean().split(placeholder(name)).length - 1, name).toBe(1);
  });
});

describe('L3.M1/M2 mutants: every mutant is the clean template with its one defect, and fails the scan of its row', () => {
  for (const m of MUTANTS) {
    it(`${m.file} (${m.row}): ${m.mutation}`, () => {
      expect(existsSync(path.join(DIR, m.file)), m.file).toBe(true);
      const text = read(m.file);
      expect(text, 'the committed file is what the mutation makes of clean.html (UPDATE_FRAME_MUTANTS=1 rewrites it)').toBe(m.make(clean()));
      expect(text).not.toBe(clean());
      expect(SCANS[m.row](text), `the ${m.row} scan`).not.toEqual([]);
    });
  }

  it('no two mutants are the same file', () => {
    const texts = MUTANTS.map((m) => m.make(clean()));
    expect(new Set(texts).size).toBe(texts.length);
  });
});
