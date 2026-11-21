// What print mode emits over the conformance corpus and the print fixtures, with `rules` on (docserver parity, Task 7): the
// elements and classes of conformance/print/vocabulary.json, which the first consumer derives its print allow-list from.
// Shared by test/print-surface.test.ts, which holds the file equal to this, by test/render-print.test.ts (the fixtures and how they are pinned), and by the one-off that writes the file.
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

/**
 * Print's html as the pinned `.html` files hold it: reformatted for review, with a line break between two tags (which adds white
 * space between touching inline tags). A pinned file is read by a reviewer and compared as this form of the output; the byte
 * comparison is not its purpose, and the assertions of test/render-print.test.ts are what hold the blocks.
 */
export const pinned = (html: string): string => `${html.replace(/></g, '>\n<')}\n`;

export const PRINT = { print: true, reader: { rules: true } } as const;

/** Every input of the corpus that renders, under a megabyte, and every print fixture. */
export function inputs(): string[] {
  const out: string[] = [];
  for (const c of loadCorpus()) if (c.input.length <= 1_000_000) out.push(c.input);
  for (const n of fixtureNames()) out.push(fixture(n));
  return out;
}

/** The two open class families of the vocabulary: highlight.js's token classes and a code block's language classes. */
export const FAMILIES: readonly string[] = ['hljs-', 'language-'];
export const inFamily = (c: string): boolean => FAMILIES.some((f) => c.startsWith(f));

/** The languages src/render/highlight.ts registers. */
const LANGUAGES = ['bash', 'css', 'diff', 'dockerfile', 'go', 'ini', 'java', 'javascript', 'json', 'markdown', 'plaintext', 'python', 'rust', 'shell', 'sql', 'typescript', 'xml', 'yaml'];

/**
 * The classes highlight.js gives a dotted scope of those languages after the first piece ("title.function.invoke" is
 * `hljs-title function_ invoke__`): `function_` and `invoke__`. They are finite for the registered languages, so the file lists
 * them, whether or not the corpus has a code block that reaches each.
 */
export function highlightSubScopeClasses(): string[] {
  const out = new Set<string>();
  for (const l of LANGUAGES) {
    const src = readFileSync(path.join(ROOT, 'node_modules/highlight.js/lib/languages', `${l}.js`), 'utf8');
    for (const m of src.matchAll(/[A-Za-z_]+["']?\s*:\s*["']([a-z_]+(?:\.[a-z_]+)+)["']/g)) {
      (m[1] ?? '').split('.').slice(1).forEach((x, i) => out.add(`${x}${'_'.repeat(i + 1)}`));
    }
  }
  return [...out].sort();
}

/** The elements and classes print mode writes over `inputs()`, sorted, with the open families' classes left to their families. */
export function emitted(): { elements: string[]; classes: string[]; all: string[] } {
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
  const listed = new Set([...cls].filter((c) => !inFamily(c)));
  for (const c of highlightSubScopeClasses()) listed.add(c);
  return { elements: [...elements].sort(), classes: [...listed].sort(), all: [...cls].sort() };
}
