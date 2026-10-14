// Footnotes (docserver L1, Task 8; architecture section C; contract section 2.13). Every expected html
// string in the first block was produced by the reference renderer from the same input and is compared
// after normaliseForCompare (it only touches code blocks). The reference uses a Python port of
// markdown-it-footnote; this library uses markdown-it-footnote 4.0.0 as it ships (engine.ts), and these
// cases pin that the two agree, with this library's other rules (task lists, tables, alerts, captions,
// heading ids, details balancing) working inside notes as the reference's do. The later block pins the
// parts that are this library's choice.
import { describe, expect, it } from 'vitest';
import { normaliseForCompare } from '../src/conformance/normalise.js';
import { checkOutputSafety } from '../src/conformance/oracle.js';
import { render } from '../src/render/index.js';

type Case = readonly [name: string, src: string, html: string];

function cases(list: readonly Case[]): void {
  for (const [name, src, html] of list) {
    it(name, () => {
      expect(normaliseForCompare(render(src).html)).toBe(html);
    });
  }
}

describe('footnotes: against the reference', () => {
  cases([
    [
      'references, a second reference to one note, numbering by first reference, a note of two paragraphs',
      'a[^b] c[^a] d[^b]\n\n[^a]: first\n[^b]: second\n    continued\n\n    second para\n',
      '<p data-line="1-1">a<sup class="footnote-ref"><a href="#fn1" id="fnref1">[1]</a></sup> c<sup ' +
        'class="footnote-ref"><a href="#fn2" id="fnref2">[2]</a></sup> d<sup class="footnote-ref"><a ' +
        'href="#fn1" id="fnref1:1">[1:1]</a></sup></p>\n<hr class="footnotes-sep" />\n' +
        '<section class="footnotes">\n<ol class="footnotes-list">\n' +
        '<li id="fn1" class="footnote-item"><p data-line="4-5">second\ncontinued</p>\n' +
        '<p data-line="7-7">second para <a href="#fnref1" class="footnote-backref">\u21a9\ufe0e</a> <a ' +
        'href="#fnref1:1" class="footnote-backref">\u21a9\ufe0e</a></p>\n</li>\n' +
        '<li id="fn2" class="footnote-item"><p data-line="3-3">first <a href="#fnref2" ' +
        'class="footnote-backref">\u21a9\ufe0e</a></p>\n</li>\n</ol>\n</section>\n',
    ],
    [
      'inline notes; an undefined label, a label with a space, an empty label and an unused note stay out',
      'x^[inline *em* `c`] y[^zz] z[^a b] w[^]\n\n[^unused]: never shown\n',
      '<p data-line="1-1">x<sup class="footnote-ref"><a href="#fn1" id="fnref1">[1]</a></sup> y[^zz] z[^a ' +
        'b] w[^]</p>\n<hr class="footnotes-sep" />\n<section class="footnotes">\n' +
        '<ol class="footnotes-list">\n' +
        '<li id="fn1" class="footnote-item"><p>inline <em>em</em> <code>c</code> <a href="#fnref1" ' +
        'class="footnote-backref">\u21a9\ufe0e</a></p>\n</li>\n</ol>\n</section>\n',
    ],
    [
      'a note defined twice keeps the last; __proto__ and constructor are ordinary labels',
      't[^a] u[^__proto__] v[^constructor]\n\n[^a]: one\n\n[^a]: two\n\n[^__proto__]: p\n' +
        '[^constructor]: c\n',
      '<p data-line="1-1">t<sup class="footnote-ref"><a href="#fn1" id="fnref1">[1]</a></sup> u<sup ' +
        'class="footnote-ref"><a href="#fn2" id="fnref2">[2]</a></sup> v<sup class="footnote-ref"><a ' +
        'href="#fn3" id="fnref3">[3]</a></sup></p>\n<hr class="footnotes-sep" />\n' +
        '<section class="footnotes">\n<ol class="footnotes-list">\n' +
        '<li id="fn1" class="footnote-item"><p data-line="5-5">two <a href="#fnref1" ' +
        'class="footnote-backref">\u21a9\ufe0e</a></p>\n</li>\n' +
        '<li id="fn2" class="footnote-item"><p data-line="7-7">p <a href="#fnref2" ' +
        'class="footnote-backref">\u21a9\ufe0e</a></p>\n</li>\n' +
        '<li id="fn3" class="footnote-item"><p data-line="8-8">c <a href="#fnref3" ' +
        'class="footnote-backref">\u21a9\ufe0e</a></p>\n</li>\n</ol>\n</section>\n',
    ],
    [
      'block content in a note; a heading in a note takes its id after the headings of the body',
      't[^n]\n\n[^n]: # Note\n    > q\n    - [x] t\n\n    | a |\n    |---|\n    | `x\\\\|y` |\n\n' +
        '# Note\n',
      '<p data-line="1-1">t<sup class="footnote-ref"><a href="#fn1" id="fnref1">[1]</a></sup></p>\n' +
        '<h1 id="note" data-line="11-11">Note</h1>\n<hr class="footnotes-sep" />\n' +
        '<section class="footnotes">\n<ol class="footnotes-list">\n' +
        '<li id="fn1" class="footnote-item"><h1 id="note-1" data-line="3-3">Note</h1>\n' +
        '<blockquote data-line="4-4">\n<p data-line="4-4">q</p>\n</blockquote>\n' +
        '<ul class="contains-task-list" data-line="5-6">\n' +
        '<li class="task-list-item" data-line="5-6"><input class="task-list-item-checkbox" checked="checked" ' +
        'disabled="disabled" type="checkbox"> t</li>\n</ul>\n' +
        '<div class="table-wrapper"><table data-line="7-9">\n<thead>\n<tr data-line="7-7">\n<th>a</th>\n' +
        '</tr>\n</thead>\n<tbody>\n<tr data-line="9-9">\n<td><code>x|y</code></td>\n</tr>\n</tbody>\n' +
        '</table></div>\n <a href="#fnref1" class="footnote-backref">\u21a9\ufe0e</a></li>\n</ol>\n' +
        '</section>\n',
    ],
    [
      'a note in a blockquote and in a list; an unclosed details is closed after the notes',
      '<details>\n\n> t[^q]\n>\n> [^q]: in a quote\n\n- u[^l]\n\n  [^l]: in a list\n',
      '<details open>\n<blockquote data-line="3-5">\n' +
        '<p data-line="3-3">t<sup class="footnote-ref"><a href="#fn1" id="fnref1">[1]</a></sup></p>\n' +
        '</blockquote>\n<ul data-line="7-9">\n<li data-line="7-9">\n' +
        '<p data-line="7-7">u<sup class="footnote-ref"><a href="#fn2" id="fnref2">[2]</a></sup></p>\n</li>\n' +
        '</ul>\n<hr class="footnotes-sep" />\n<section class="footnotes">\n<ol class="footnotes-list">\n' +
        '<li id="fn1" class="footnote-item"><p data-line="5-5">in a quote <a href="#fnref1" ' +
        'class="footnote-backref">\u21a9\ufe0e</a></p>\n</li>\n' +
        '<li id="fn2" class="footnote-item"><p data-line="9-9">in a list <a href="#fnref2" ' +
        'class="footnote-backref">\u21a9\ufe0e</a></p>\n</li>\n</ol>\n</section>\n</details>\n',
    ],
    [
      'a note\'s last paragraph carries its back-references, so it is never a figure caption',
      't[^x] u[^y]\n\n[^x]: ```mermaid\n    A\n    ```\n    *Figure 1. last*\n\n[^y]: ```mermaid\n' +
        '    B\n    ```\n    *Figure 2. not last*\n\n    after\n',
      '<p data-line="1-1">t<sup class="footnote-ref"><a href="#fn1" id="fnref1">[1]</a></sup> u<sup ' +
        'class="footnote-ref"><a href="#fn2" id="fnref2">[2]</a></sup></p>\n<hr class="footnotes-sep" />\n' +
        '<section class="footnotes">\n<ol class="footnotes-list">\n' +
        '<li id="fn1" class="footnote-item"><figure class="mermaid-figure" data-line="3-5"><pre ' +
        'class="mermaid">A\n</pre></figure>\n' +
        '<p data-line="6-6"><em>Figure 1. last</em> <a href="#fnref1" ' +
        'class="footnote-backref">\u21a9\ufe0e</a></p>\n</li>\n' +
        '<li id="fn2" class="footnote-item"><figure class="mermaid-figure" data-line="8-10"><pre ' +
        'class="mermaid">B\n</pre><figcaption>Figure 2. not last</figcaption></figure>\n' +
        '<p data-line="13-13">after <a href="#fnref2" class="footnote-backref">\u21a9\ufe0e</a></p>\n</li>\n' +
        '</ol>\n</section>\n',
    ],
    [
      'an alert in a note',
      't[^n]\n\n[^n]: > [!TIP]\n    > in a note\n',
      '<p data-line="1-1">t<sup class="footnote-ref"><a href="#fn1" id="fnref1">[1]</a></sup></p>\n' +
        '<hr class="footnotes-sep" />\n<section class="footnotes">\n<ol class="footnotes-list">\n' +
        '<li id="fn1" class="footnote-item"><div class="gh-alert gh-tip" data-line="3-4"><p ' +
        'class="gh-alert-title">Tip</p><p>in a note</p>\n</div>\n' +
        ' <a href="#fnref1" class="footnote-backref">\u21a9\ufe0e</a></li>\n</ol>\n</section>\n',
    ],
  ]);
});

describe("footnotes: this library's own parts", () => {
  it('lineAttrs: false drops the data-line of a note\'s paragraphs', () => {
    expect(render('t[^n]\n\n[^n]: note\n', { lineAttrs: false }).html).toBe(
      '<p>t<sup class="footnote-ref"><a href="#fn1" id="fnref1">[1]</a></sup></p>\n' +
        '<hr class="footnotes-sep" />\n<section class="footnotes">\n<ol class="footnotes-list">\n' +
        '<li id="fn1" class="footnote-item"><p>note <a href="#fnref1" class="footnote-backref">' +
        '\u21a9\ufe0e</a></p>\n</li>\n</ol>\n</section>\n',
    );
  });

  it('meta.headings lists a heading inside a note after the headings of the body', () => {
    expect(render('t[^n]\n\n[^n]: # In note\n\n# Body\n').meta.headings).toEqual([
      { level: 1, id: 'body', text: 'Body' },
      { level: 1, id: 'in-note', text: 'In note' },
    ]);
  });

  it('10000 references to one note: one note, 10000 back-references, and safe output', () => {
    const html = render(`${'x[^a] '.repeat(10000)}\n\n[^a]: n\n`).html;
    expect(html.match(/<li id="fn/g)).toHaveLength(1);
    expect(html.match(/class="footnote-backref"/g)).toHaveLength(10000);
    expect(html).toContain('<a href="#fn1" id="fnref1:9999">[1:9999]</a>');
    expect(checkOutputSafety(html)).toEqual([]);
  });
});
