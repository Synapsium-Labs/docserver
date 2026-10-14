// The block_strip core rule through render() (docserver L1, Task 4; contract section 2). The reference strips
// heading and paragraph text with Python's str.strip(), markdown-it with an ASCII trim; every expected string
// below was produced by the reference renderer from the same input.
import { describe, expect, it } from 'vitest';
import { render } from '../src/render/index.js';

describe('heading and paragraph text is stripped the Python way', () => {
  const CASES: readonly (readonly [string, string, string])[] = [
    ['an ATX heading', '# \u001cfile\u001f\n', '<h1 id="file" data-line="1-1">file</h1>\n'],
    ['an ATX heading of Python whitespace only', '# \u3000\n', '<h1 id="" data-line="1-1"></h1>\n'],
    ['a setext heading', 'a\n\u3000\n===\n', '<h1 id="a" data-line="1-3">a</h1>\n'],
    ['a paragraph', '\u0085para\u0085\n', '<p data-line="1-1">para</p>\n'],
    ['a paragraph of Python whitespace only', '\u3000\n', '<p data-line="1-1"></p>\n'],
    [
      'no-break space and U+2028 at the edges only',
      'x\u00a0\n\ny\u00a0z\u2028\n',
      '<p data-line="1-1">x</p>\n<p data-line="3-3">y\u00a0z</p>\n',
    ],
    [
      "a tight list item's hidden paragraph",
      '- \u001citem\u001f\n',
      '<ul data-line="1-1">\n<li data-line="1-1">item</li>\n</ul>\n',
    ],
    [
      'a paragraph in a blockquote',
      '> \u000bq\u000c\n',
      '<blockquote data-line="1-1">\n<p data-line="1-1">q</p>\n</blockquote>\n',
    ],
    ['U+FEFF, which Python does not strip', '# \ufeff a\n', '<h1 id="-a" data-line="1-1">\ufeff a</h1>\n'],
  ];

  for (const [name, src, html] of CASES) {
    it(name, () => {
      expect(render(src).html).toBe(html);
    });
  }
});

describe('reference labels: departure PD6 (ruling C23)', () => {
  // markdown-it normalises a reference label with JavaScript's trim() and \s before any rule of this library
  // can see it; the reference normalised it with Python's. \x1c-\x1f and U+0085 are whitespace to Python
  // only, U+FEFF to JavaScript only, so a label holding one matches a different definition here. For each
  // shape, `space` is the html when the character counts as whitespace in the label and `text` when it does
  // not; the reference renderer gave `space` for the first five characters and `text` for U+FEFF (measured).
  const p = (line: number, html: string): string => `<p data-line="${line}-${line}">${html}</p>\n`;
  const a = (text: string): string => `<a href="/u">${text}</a>`;
  interface Shape {
    name: string;
    src: (c: string) => string;
    space: (c: string) => string;
    text: (c: string) => string;
  }
  const SHAPES: readonly Shape[] = [
    {
      name: 'between two words, against a definition of [a b]',
      src: (c) => `[a b]: /u\n\n[a${c}b]\n`,
      space: (c) => p(3, a(`a${c}b`)),
      text: (c) => p(3, `[a${c}b]`),
    },
    {
      name: 'at the end of a definition, against a use of [a]',
      src: (c) => `[a${c}]: /u\n\n[a]\n`,
      space: () => p(3, a('a')),
      text: () => p(3, '[a]'),
    },
    {
      name: 'as the whole label, which is empty once stripped',
      src: (c) => `[${c}]: /u\n\n[${c}]\n`,
      space: (c) => p(1, `[${c}]: /u`) + p(3, `[${c}]`),
      text: (c) => p(3, a(c)),
    },
  ];
  for (const c of ['\u001c', '\u001d', '\u001e', '\u001f', '\u0085', '\ufeff']) {
    const code = `U+${c.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')}`;
    const pythonOnly = c !== '\ufeff';
    for (const shape of SHAPES) {
      it(`${code} ${shape.name}`, () => {
        const reference = pythonOnly ? shape.space(c) : shape.text(c);
        const html = pythonOnly ? shape.text(c) : shape.space(c);
        expect(render(shape.src(c)).html).toBe(html);
        expect(html).not.toBe(reference);
      });
    }
  }
});

// Departure PD9: markdown-it matches a reference label by `toLowerCase().toUpperCase()`, so the match follows the
// RUNTIME's Unicode case tables. U+1C89 CYRILLIC CAPITAL LETTER TJE and U+1C8A (its lower case) are assigned from
// Unicode 16.0. For `[\u1c89]: /u` and a use of `[\u1c8a]`, the reference's Python 3.12 (Unicode 15.0) folds neither
// and finds no definition: <p data-line="3-3">[\u1c8a]</p>. No golden holds the pair, so no file moves.
describe('reference label case folding follows the runtime Unicode tables (departure PD9)', () => {
  it('U+1C89 defines the label that U+1C8A uses from Unicode 16.0 on, and not before', () => {
    const unicode = Number.parseFloat(process.versions['unicode'] ?? '');
    expect(Number.isFinite(unicode)).toBe(true);
    const html = render('[\u1c89]: /u\n\n[\u1c8a]\n').html;
    if (unicode >= 16) {
      expect(html).toBe('<p data-line="3-3"><a href="/u">\u1c8a</a></p>\n');
    } else {
      expect(html).toBe('<p data-line="3-3">[\u1c8a]</p>\n');
    }
  });
});
