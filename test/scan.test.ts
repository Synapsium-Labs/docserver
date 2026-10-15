// scanRefs and the consistency invariants (docserver L1, Task 10; architecture section C, the "scanRefs" and
// "Meta" rows; section F, T10; rulings C2 and C3). scanRefs parses and never renders, so the first block
// checks it against render() itself: for every corpus case and for this file's own documents, the images
// and Mermaid sizes scanRefs reports are exactly what render()'s html shows, and render()'s meta agrees
// with its own html (figures, tables, heading ids, title, Mermaid kinds). The later blocks pin scanRefs'
// own rules with exact values. Every non-ASCII character is written as a \u escape.
import { describe, expect, it } from 'vitest';
import { loadCorpus } from '../src/conformance/index.js';
import { createEngine } from '../src/render/engine.js';
import { MAX_MERMAID_KINDS, mermaidKind } from '../src/render/fence.js';
import { DEFAULT_MAX_BYTES, DEFAULT_MAX_IMAGES, render, scanRefs } from '../src/render/index.js';
import { utf8Length } from '../src/render/pyText.js';
import { scanWith } from '../src/render/scan.js';
import type { ScanRefsResult } from '../src/render/types.js';

const NO_MERMAID = { fences: 0, largestBytes: 0, totalBytes: 0 };
const OVER: ScanRefsResult = { outcome: 'over-limit', images: [], imagesTruncated: false, mermaid: NO_MERMAID };

/** markdown-it's escapeHtml undone: the four entities it writes into an attribute value. */
function unescapeMd(s: string): string {
  return s.replace(/&(?:amp|lt|gt|quot);/g, (e) => ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"' })[e] ?? e);
}

/** Python's html.escape undone (pyEscape): the five entities it writes. */
function unescapePy(s: string): string {
  return unescapeMd(s.replaceAll('&#x27;', "'"));
}

/**
 * What render()'s html itself shows. Every `<` that markdown-it or this library's rules escape is `&lt;`, so
 * each pattern below only meets markup the renderer emitted: an image's src, a figure's escaped source
 * (which holds no `<`), a table wrapper, a heading's id.
 */
function fromHtml(html: string): { images: string[]; sources: string[]; tables: number; headings: string[] } {
  const images = [...html.matchAll(/<img src="([^"]*)"/g)].map((m) => unescapeMd(m[1] ?? ''));
  return {
    images: [...new Set(images)],
    sources: [...html.matchAll(/<figure class="mermaid-figure"[^>]*><pre class="mermaid">([^<]*)<\/pre>/g)].map(
      (m) => unescapePy(m[1] ?? ''),
    ),
    tables: html.split('<div class="table-wrapper"><table').length - 1,
    headings: [...html.matchAll(/<h([1-6]) id="([^"]*)"/g)].map((m) => `${m[1] ?? ''}#${m[2] ?? ''}`),
  };
}

/** scanRefs against render() on one document, and render()'s meta against its own html. */
function consistent(markdown: string): void {
  const r = render(markdown);
  const s = scanRefs(markdown);
  expect(r.outcome).toBe('rendered');
  const h = fromHtml(r.html);
  expect(s.outcome).toBe('scanned');
  expect(s.images).toEqual(h.images.slice(0, DEFAULT_MAX_IMAGES));
  expect(s.imagesTruncated).toBe(h.images.length > DEFAULT_MAX_IMAGES);
  const sizes = h.sources.map((x) => utf8Length(x, Number.MAX_SAFE_INTEGER));
  expect(s.mermaid).toEqual({
    fences: h.sources.length,
    largestBytes: sizes.reduce((a, b) => Math.max(a, b), 0),
    totalBytes: sizes.reduce((a, b) => a + b, 0),
  });
  expect(s.mermaid.fences).toBe(r.meta.figures);
  expect(r.meta.tables).toBe(h.tables);
  expect(r.meta.headings.map((x) => `${x.level}#${x.id}`)).toEqual(h.headings);
  expect(r.meta.title).toBe(r.meta.headings.find((x) => x.level === 1)?.text ?? null);
  const kinds = [...new Set(h.sources.map(mermaidKind).filter((k) => k !== null))].slice(0, MAX_MERMAID_KINDS);
  expect(r.meta.mermaidKinds).toEqual(kinds);
  // The byte gate is the same gate: one byte less than the document is over the limit for both.
  if (r.bytes > 0) {
    expect(render(markdown, { maxBytes: r.bytes - 1 }).outcome).toBe('over-limit');
    expect(scanRefs(markdown, { maxBytes: r.bytes - 1 })).toEqual(OVER);
  }
}

/** This file's own documents, each run through the same invariants as the corpus. */
const DOCUMENTS: readonly (readonly [name: string, markdown: string])[] = [
  ['images in a heading, a link, a list, a table, a blockquote and an alert', [
    '# A ![h](h.png)', '', '[![l](l.png)](x)', '', '- ![i](i.png)', '', '| a |', '|---|', '| ![t](t.png) |', '',
    '> ![q](q.png)', '', '> [!NOTE]', '> ![n](n.png)', '',
  ].join('\n')],
  ['an image inside an alt is alt text, never an image', '![![in](inner.png)](outer.png)\n'],
  ['footnotes: a referenced note and an inline note show their images; an unreferenced one does not',
    'x[^1] ![m](main.png) y ^[![i](inline.png)]\n\n[^1]: ![f](foot.png)\n\n[^2]: ![u](unref.png)\n'],
  [
    'a caption keeps its image inside the figure',
    '```mermaid\nA\n```\n*Figure 1. ![a](cap.png) x*\n\n![b](after.png)\n',
  ],
  ['only exact `mermaid` fences are figures', [
    '```Mermaid', 'graph TD', '```', '', '```mermaid extra', 'flowchart', '```', '', '``` mermaid', 'pie', '```', '',
    '~~~mermaid', 'sequenceDiagram', '~~~', '', '    ```mermaid', '    indented code', '', '- ```mermaid',
    '  gantt', '  ```', '', '> ```mermaid', '> classDiagram', '> ```', '',
  ].join('\n')],
  [
    'Mermaid sources with escapes and non-ASCII text',
    "```mermaid\nA['\u00e9 & <b>'] --> \"\ud83d\ude00\"\n```\n\n```mermaid\n```\n",
  ],
  ['duplicates and normalised sources', '![a](<a b>) ![b](x&amp;y) ![c](a b) ![d](a%20b) ![e](x&y)\n'],
  ['a BOM file: its front matter hides the image line', '\ufeff---\nx: ![a](fm.png)\n---\n![b](body.png)\n'],
  ['CRLF line endings', '# T\r\n\r\n![a](a.png)\r\n\r\n```mermaid\r\ngraph\r\n```\r\n'],
  [
    'details lines and comments carry no images',
    '<details>\n<summary>![s](s.png)</summary>\n\n![d](d.png)\n</details>\n<!-- ![c](c.png) -->\n',
  ],
  ['forty Mermaid kinds: meta keeps the first 32',
    Array.from({ length: 40 }, (_, i) => `\`\`\`mermaid\nkind${String(i)}\n\`\`\`\n`).join('\n')],
];

describe('scanRefs and meta agree with the html render() emits', () => {
  // Generated cases (Task 11) are judged by their verdicts. Two of them do not render by design:
  // x-limits/over-limit is over the byte cap and x-limits/html-expansion over maxHtmlBytes.
  for (const c of loadCorpus().filter((x) => x.kind !== 'generated')) {
    it(`corpus: ${c.id}`, () => {
      expect(c.options).toEqual({});
      consistent(c.input);
    });
  }
  for (const [name, markdown] of DOCUMENTS) {
    it(name, () => {
      consistent(markdown);
    });
  }
});

describe('scanRefs: images', () => {
  it('each source as render() writes it: normalizeLink applied, entities decoded, in document order, once', () => {
    const md = '![a](<a b>) ![b](x&amp;y) ![c](%41) ![d](\u00e9.png) ![e](2.png) ![f](a%20b)\n';
    expect(scanRefs(md).images).toEqual(['a%20b', 'x&y', '%41', '%C3%A9.png', '2.png']);
  });

  it('a link markdown-it refuses is no image; an allowed data:image is one', () => {
    const md = '![x](javascript:alert(1)) ![y](data:text/html,x) ![z](data:image/png;base64,AA)\n';
    expect(scanRefs(md).images).toEqual(['data:image/png;base64,AA']);
  });

  it('an image inside an alt is not an image; a caption and a footnote are read where render() writes them', () => {
    expect(scanRefs('![![in](inner.png)](outer.png)\n').images).toEqual(['outer.png']);
    expect(scanRefs('```mermaid\nA\n```\n*Figure 1. ![a](cap.png) x*\n\n![b](after.png)\n').images).toEqual([
      'cap.png',
      'after.png',
    ]);
    const notes = 'x[^1] ![m](main.png) ^[![i](inline.png)]\n\n[^1]: ![f](foot.png)\n\n[^2]: ![u](u.png)\n';
    expect(scanRefs(notes).images).toEqual(['main.png', 'foot.png', 'inline.png']);
  });

  it('a leading BOM is removed first, as render() removes it (PD4)', () => {
    expect(scanRefs('\ufeff---\nx: ![a](fm.png)\n---\n![b](body.png)\n').images).toEqual(['body.png']);
    expect(scanRefs('---\nx: ![a](fm.png)\n---\n![b](body.png)\n').images).toEqual(['body.png']);
  });
});

describe('scanRefs: the image cap', () => {
  const doc = (n: number): string => Array.from({ length: n }, (_, i) => `![i](${String(i)}.png)`).join(' ');

  it(`the default keeps ${String(DEFAULT_MAX_IMAGES)} distinct sources and says when more exist`, () => {
    const exact = scanRefs(`${doc(DEFAULT_MAX_IMAGES)} ${doc(5)}\n`);
    expect(exact.images).toHaveLength(DEFAULT_MAX_IMAGES);
    expect(exact.imagesTruncated).toBe(false);
    const over = scanRefs(`${doc(DEFAULT_MAX_IMAGES + 1)}\n`);
    expect(over.images).toEqual(exact.images);
    expect(over.imagesTruncated).toBe(true);
  });

  it('10000 distinct images: the first 512, truncated', () => {
    const s = scanRefs(`${doc(10000)}\n`);
    expect(s.images).toHaveLength(512);
    expect(s.images[511]).toBe('511.png');
    expect(s.imagesTruncated).toBe(true);
  });

  it('maxImages is the host\'s: 2 keeps two; 0 keeps none and still says whether any exists', () => {
    expect(scanRefs(`${doc(3)}\n`, { maxImages: 2 })).toMatchObject({
      images: ['0.png', '1.png'],
      imagesTruncated: true,
    });
    expect(scanRefs(`${doc(2)} ${doc(2)}\n`, { maxImages: 2 })).toMatchObject({ imagesTruncated: false });
    expect(scanRefs(`${doc(1)}\n`, { maxImages: 0 })).toMatchObject({ images: [], imagesTruncated: true });
    expect(scanRefs('no images\n', { maxImages: 0 })).toMatchObject({ images: [], imagesTruncated: false });
  });

  it('an invalid maxImages or maxBytes is a RangeError, not a cap that lets everything through', () => {
    for (const v of [Number.NaN, -1, 1.5, Number.POSITIVE_INFINITY]) {
      expect(() => scanRefs('x', { maxImages: v })).toThrow(RangeError);
      expect(() => scanRefs('x', { maxBytes: v })).toThrow(RangeError);
    }
  });
});

describe('scanRefs: Mermaid fences', () => {
  it('counts only the fences render() turns into figures', () => {
    const md =
      '```Mermaid\nA\n```\n\n```mermaid extra\nB\n```\n\n``` mermaid\nC\n```\n\n~~~mermaid\nD\n~~~\n\n    ```mermaid\n';
    expect(scanRefs(md).mermaid).toEqual({ fences: 3, largestBytes: 2, totalBytes: 6 });
    expect(render(md).meta.figures).toBe(3);
  });

  it('sizes are UTF-8 bytes of the source: the largest one, and the sum', () => {
    const md = '```mermaid\ngraph TD\nA-->B\n```\n\n```mermaid\n\u00e9\ud83d\ude00\n```\n\n```mermaid\n```\n';
    expect(scanRefs(md).mermaid).toEqual({ fences: 3, largestBytes: 15, totalBytes: 22 });
  });
});

describe('scanRefs: the byte gate', () => {
  it('over maxBytes nothing is parsed; a multi-byte character decides at the boundary', () => {
    expect(scanRefs('\u00e9![a](a.png)', { maxBytes: 13 })).toMatchObject({ outcome: 'scanned', images: ['a.png'] });
    expect(scanRefs('\u00e9![a](a.png)', { maxBytes: 12 })).toEqual(OVER);
    expect(scanRefs('', { maxBytes: 0 }).outcome).toBe('scanned');
  });

  it(`the default cap is DEFAULT_MAX_BYTES, as render()'s`, () => {
    expect(scanRefs('\n'.repeat(DEFAULT_MAX_BYTES + 1))).toEqual(OVER);
    expect(scanRefs('\n'.repeat(DEFAULT_MAX_BYTES)).outcome).toBe('scanned');
  });

  it('the gate comes before the engine', () => {
    const md = createEngine();
    md.core.ruler.push('fault', () => {
      throw new Error('injected fault');
    });
    expect(scanWith('xx', { maxBytes: 1 }, md)).toEqual(OVER);
    expect(() => scanWith('xx', undefined, md)).toThrow('injected fault');
  });
});

describe('scanRefs: parse only, state per call', () => {
  it('never renders: an engine whose renderer throws still scans', () => {
    const md = createEngine();
    md.renderer.render = () => {
      throw new Error('rendered');
    };
    md.renderer.rules.fence = () => {
      throw new Error('rendered');
    };
    expect(scanWith('![a](a.png)\n\n```mermaid\nA\n```\n', undefined, md)).toEqual({
      outcome: 'scanned',
      images: ['a.png'],
      imagesTruncated: false,
      mermaid: { fences: 1, largestBytes: 2, totalBytes: 2 },
    });
  });

  it('is deterministic, and no call sees another call\'s state', () => {
    const a = 'x[^1] ![a](a.png)\n\n[^1]: ![f](f.png)\n';
    const b = '![b](b.png)\n\n```mermaid\nB\n```\n';
    const first = scanRefs(a);
    expect(first.images).toEqual(['a.png', 'f.png']);
    first.images.push('changed');
    expect(scanRefs(b)).toEqual({
      outcome: 'scanned',
      images: ['b.png'],
      imagesTruncated: false,
      mermaid: { fences: 1, largestBytes: 2, totalBytes: 2 },
    });
    expect(scanRefs(a)).toEqual({
      outcome: 'scanned',
      images: ['a.png', 'f.png'],
      imagesTruncated: false,
      mermaid: NO_MERMAID,
    });
  });
});
