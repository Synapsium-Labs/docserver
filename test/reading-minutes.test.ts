// @vitest-environment jsdom
// Reading time in render()'s meta (LX6.3): `meta.readingMinutes` is the reader's own rule (prose 230 words a minute, code 520,
// half a minute a figure; src/enhance/reading.ts) read from the html render() made, so a host that has the document before it
// mounts the frame (a time left, a card) says what the frame's byline says. For every case of the conformance corpus the number
// equals, to the last bit, the enhance step's documentMinutes of that html in a DOM, and, where the byline shows a reading time,
// the byline's own text for it. It is this library's own key: the goldens' meta files do not carry it (src/conformance/index.ts).
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { destroyEnhancement, enhance } from '../src/enhance/index.js';
import { documentMinutes, formatLong } from '../src/enhance/reading.js';
import { render } from '../src/render/index.js';
import type { RenderOptions } from '../src/render/types.js';

const mounted: HTMLElement[] = [];
afterEach(async () => {
  for (const root of mounted.splice(0)) await destroyEnhancement(root).catch(() => undefined);
  document.body.replaceChildren();
});

/** The html as the frame holds it before any feature moves a node: the children of one root element. */
function mountHtml(html: string): HTMLElement {
  const parsed = new DOMParser().parseFromString(`<!doctype html><body>${html}`, 'text/html');
  const root = document.createElement('main');
  root.append(...Array.from(parsed.body.childNodes).map((n) => document.importNode(n, true)));
  document.body.append(root);
  mounted.push(root);
  return root;
}

const ROOT = process.cwd();

/** Every corpus case that has a file as its input (a generated case has none), with the options its manifest row names. */
function corpusCases(): { id: string; input: string; options: RenderOptions }[] {
  const manifest = JSON.parse(readFileSync(path.join(ROOT, 'conformance/manifest.json'), 'utf8')) as { id: string; options?: RenderOptions }[];
  const out: { id: string; input: string; options: RenderOptions }[] = [];
  for (const m of manifest) {
    const file = path.join(ROOT, 'conformance/corpus', `${m.id}.md`);
    if (existsSync(file)) out.push({ id: m.id, input: readFileSync(file, 'utf8'), options: m.options ?? {} });
  }
  return out;
}

const cases = corpusCases();

describe('meta.readingMinutes equals the byline\'s minutes', () => {
  it('has the corpus to read', () => {
    expect(cases.length).toBeGreaterThan(30);
  });

  for (const c of cases) {
    it(`corpus ${c.id}: the number is the enhance step's documentMinutes of the same html`, () => {
      const r = render(c.input, c.options);
      expect(typeof r.meta.readingMinutes).toBe('number');
      expect(r.meta.readingMinutes).toBe(documentMinutes(mountHtml(r.html)));
    });
  }

  /** A spec header (so the byline is built) and `prose` words, `code` words of code and `figures` figures, in two sections. */
  const spec = (prose: number, code: number, figures: number): string => {
    const words = (n: number): string => Array.from({ length: n }, (_, i) => `w${String(i % 9)}`).join(' ');
    return [
      '# Timed', '', '**Spec** · 2026-10-21 · Status: Draft', '', '## 1. One', '', words(prose), '', '```text', words(code), '```', '',
      '## 2. Two', '', ...Array.from({ length: figures }, (_, i) => `\`\`\`mermaid\nflowchart LR\n  A${String(i)} --> B\n\`\`\`\n\n*Figure ${String(i + 1)}. Drawn.*\n`), words(7),
    ].join('\n');
  };

  it.each([[700, 0, 0], [900, 600, 0], [100, 1040, 2], [2300, 0, 0], [30000, 5200, 4], [600, 0, 1], [724, 0, 0]])(
    'a document of %i prose words, %i code words and %i figures: the byline says the time of the number',
    async (prose, code, figures) => {
      const r = render(spec(prose, code, figures));
      const root = mountHtml(r.html);
      await enhance(root, { info: { title: r.meta.title, frontList: r.meta.frontList } });
      const facts = Array.from(root.querySelectorAll('dl.byline > div'));
      const rt = facts.find((d) => d.querySelector('dt')?.textContent === 'Reading time');
      expect(rt, 'the byline has a reading time (3 minutes or more)').toBeDefined();
      expect(r.meta.readingMinutes).toBeGreaterThanOrEqual(3);
      expect(rt?.querySelector('dd')?.textContent).toBe(`≈ ${formatLong(r.meta.readingMinutes)}`);
      expect(r.meta.readingMinutes).toBe(documentMinutes(mountHtml(r.html)));
    },
  );

  it('counts by the rule: 230 words of prose, 520 of code and half a minute a figure, sectioned at h1 and h2', () => {
    const prose = (n: number): string => Array.from({ length: n }, () => 'word').join(' ');
    expect(render(`# T\n\n${prose(230)}\n`).meta.readingMinutes).toBeCloseTo(1 + 1 / 230, 10);
    expect(render(`# T\n\n\`\`\`text\n${prose(520)}\n\`\`\`\n`).meta.readingMinutes).toBeCloseTo(1 + 1 / 230, 10);
    expect(render('```mermaid\nflowchart LR\n  A --> B\n```\n').meta.readingMinutes).toBeCloseTo(0.5, 10);
    expect(render('').meta.readingMinutes).toBe(0);
  });
});
