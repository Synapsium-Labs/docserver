// What print mode emits over the conformance corpus and the print fixtures, with `rules` on (docserver parity, Task 7): the
// elements and classes of conformance/print/vocabulary.json, which the first consumer derives its print allow-list from.
// Shared by test/render-print.test.ts, which holds the file equal to this, and by the one-off that writes it.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { loadCorpus } from '../src/conformance/index.js';
import { render } from '../src/render/index.js';
import { parse, classes, all, type ElN } from '../src/render/print/tree.js';

export const ROOT = process.cwd();

/** The print fixtures: each Markdown file of conformance/print, by name. */
export function fixtureNames(): string[] {
  return readdirSync(path.join(ROOT, 'conformance/print')).filter((f) => f.endsWith('.md')).map((f) => f.slice(0, -3)).sort();
}

export const fixture = (name: string): string => readFileSync(path.join(ROOT, 'conformance/print', `${name}.md`), 'utf8');

/** Print's html as a fixture pins it: a line break between two tags, which changes no text. */
export const pinned = (html: string): string => `${html.replace(/></g, '>\n<')}\n`;

export const PRINT = { print: true, reader: { rules: true } } as const;

/** Every input of the corpus that renders, under a megabyte, and every print fixture. */
export function inputs(): string[] {
  const out: string[] = [];
  for (const c of loadCorpus()) if (c.input.length <= 1_000_000) out.push(c.input);
  for (const n of fixtureNames()) out.push(fixture(n));
  return out;
}

/** The elements, classes and attributes print mode writes over `inputs()`, sorted. */
export function emitted(): { elements: string[]; classes: string[] } {
  const elements = new Set<string>();
  const cls = new Set<string>();
  for (const md of inputs()) {
    const r = render(md, PRINT);
    if (r.outcome !== 'rendered') continue;
    const root = parse(r.html);
    elements.add('div');
    for (const e of all(root, () => true) as ElN[]) {
      elements.add(e.name);
      for (const c of classes(e)) cls.add(c);
    }
  }
  return { elements: [...elements].sort(), classes: [...cls].sort() };
}
