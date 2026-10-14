// Figure captions (docserver L1, Task 7; architecture section C, the "Caption" row; contract section 2.7).
// Every expected html string in the first block was produced by the reference renderer from the same input
// and is compared after normaliseForCompare (it only touches code blocks; figures and captions are compared
// exactly). The reference finds a caption with a regular expression over its finished HTML; this library
// decides on the token stream (figcaption.ts), and these cases pin that the two agree, quirks included.
// The later blocks pin this library's own behaviour where the reference has nothing to say, and the one
// place where it differs from the reference on purpose.
import { describe, expect, it } from 'vitest';
import { normaliseForCompare } from '../src/conformance/normalise.js';
import { checkOutputSafety } from '../src/conformance/oracle.js';
import { createEngine } from '../src/render/engine.js';
import { CAPTION, figcaption } from '../src/render/figcaption.js';
import { render } from '../src/render/index.js';

type Case = readonly [name: string, src: string, html: string];

function cases(list: readonly Case[]): void {
  for (const [name, src, html] of list) {
    it(name, () => {
      expect(normaliseForCompare(render(src).html)).toBe(html);
    });
  }
}

describe('figcaption: against the reference', () => {
  cases([
    [
      'a caption right after the figure, or after blank lines; its inline markup is kept',
      '```mermaid\nA\n```\n*Figure 1. Caption with `code` and **bold**.*\n\n```mermaid\nB\n```\n\n\n' +
        '_Figure 12. far_\n\ntext\n',
      '<figure class="mermaid-figure" data-line="1-3"><pre class="mermaid">A\n' +
        '</pre><figcaption>Figure 1. Caption with <code>code</code> and <strong>bold</strong>.</figcaption>' +
        '</figure>\n<figure class="mermaid-figure" data-line="6-8"><pre class="mermaid">B\n' +
        '</pre><figcaption>Figure 12. far</figcaption></figure>\n<p data-line="13-13">text</p>\n',
    ],
    [
      'from the first <em> to the last </em>: a nested em, the two-em quirk, a link, a break, a second line',
      '```mermaid\nA\n```\n*Figure 8. a *nested* em.*\n\n```mermaid\nB\n```\n*Figure 1. a* *b*\n\n' +
        '```mermaid\nC\n```\n*Figure 2. see [x](y).*\n\n```mermaid\nD\n```\n*Figure 3. a\\\nb*\n\n' +
        '```mermaid\nE\n```\n*Figure 4. line1\nline2*\n',
      '<figure class="mermaid-figure" data-line="1-3"><pre class="mermaid">A\n' +
        '</pre><figcaption>Figure 8. a <em>nested</em> em.</figcaption></figure>\n' +
        '<figure class="mermaid-figure" data-line="6-8"><pre class="mermaid">B\n' +
        '</pre><figcaption>Figure 1. a</em> <em>b</figcaption></figure>\n' +
        '<figure class="mermaid-figure" data-line="11-13"><pre class="mermaid">C\n' +
        '</pre><figcaption>Figure 2. see <a href="y">x</a>.</figcaption></figure>\n' +
        '<figure class="mermaid-figure" data-line="16-18"><pre class="mermaid">D\n' +
        '</pre><figcaption>Figure 3. a<br />\nb</figcaption></figure>\n' +
        '<figure class="mermaid-figure" data-line="22-24"><pre class="mermaid">E\n' +
        '</pre><figcaption>Figure 4. line1\nline2</figcaption></figure>\n',
    ],
    [
      'after Figure, any Python whitespace; then any run of Unicode decimal digits and a dot',
      '```mermaid\nA\n```\n*Figure\u00a01. nbsp*\n\n```mermaid\nB\n```\n*Figure\u001f2. unit separator*\n' +
        '\n```mermaid\nC\n```\n*Figure \u0661. arabic-indic*\n\n```mermaid\nD\n```\n' +
        '*Figure \uff11\uff12. fullwidth*\n\n```mermaid\nE\n```\n*Figure 01.x*\n\n```mermaid\nF\n```\n' +
        '*Figure 2.*\n',
      '<figure class="mermaid-figure" data-line="1-3"><pre class="mermaid">A\n' +
        '</pre><figcaption>Figure\u00a01. nbsp</figcaption></figure>\n' +
        '<figure class="mermaid-figure" data-line="6-8"><pre class="mermaid">B\n' +
        '</pre><figcaption>Figure\u001f2. unit separator</figcaption></figure>\n' +
        '<figure class="mermaid-figure" data-line="11-13"><pre class="mermaid">C\n' +
        '</pre><figcaption>Figure \u0661. arabic-indic</figcaption></figure>\n' +
        '<figure class="mermaid-figure" data-line="16-18"><pre class="mermaid">D\n' +
        '</pre><figcaption>Figure \uff11\uff12. fullwidth</figcaption></figure>\n' +
        '<figure class="mermaid-figure" data-line="21-23"><pre class="mermaid">E\n' +
        '</pre><figcaption>Figure 01.x</figcaption></figure>\n' +
        '<figure class="mermaid-figure" data-line="26-28"><pre class="mermaid">F\n' +
        '</pre><figcaption>Figure 2.</figcaption></figure>\n',
    ],
    [
      'not captions: Fig, figure, 3a, no dot, no number, strong, trailing text, an escaped star, a heading',
      '```mermaid\nA\n```\n*Fig 1. a*\n\n```mermaid\nB\n```\n*figure 1. b*\n\n```mermaid\nC\n```\n' +
        '*Figure 3a. c*\n\n```mermaid\nD\n```\n*Figure 7 d*\n\n```mermaid\nE\n```\n*Figure . e*\n\n' +
        '```mermaid\nF\n```\n**Figure 1. f**\n\n```mermaid\nG\n```\n*Figure 1. g* more\n\n```mermaid\nH\n' +
        '```\n\\*Figure 1. h*\n\n```mermaid\nI\n```\n*Figure 1. i*\n---\n',
      '<figure class="mermaid-figure" data-line="1-3"><pre class="mermaid">A\n</pre></figure>\n' +
        '<p data-line="4-4"><em>Fig 1. a</em></p>\n' +
        '<figure class="mermaid-figure" data-line="6-8"><pre class="mermaid">B\n</pre></figure>\n' +
        '<p data-line="9-9"><em>figure 1. b</em></p>\n' +
        '<figure class="mermaid-figure" data-line="11-13"><pre class="mermaid">C\n</pre></figure>\n' +
        '<p data-line="14-14"><em>Figure 3a. c</em></p>\n' +
        '<figure class="mermaid-figure" data-line="16-18"><pre class="mermaid">D\n</pre></figure>\n' +
        '<p data-line="19-19"><em>Figure 7 d</em></p>\n' +
        '<figure class="mermaid-figure" data-line="21-23"><pre class="mermaid">E\n</pre></figure>\n' +
        '<p data-line="24-24"><em>Figure . e</em></p>\n' +
        '<figure class="mermaid-figure" data-line="26-28"><pre class="mermaid">F\n</pre></figure>\n' +
        '<p data-line="29-29"><strong>Figure 1. f</strong></p>\n' +
        '<figure class="mermaid-figure" data-line="31-33"><pre class="mermaid">G\n</pre></figure>\n' +
        '<p data-line="34-34"><em>Figure 1. g</em> more</p>\n' +
        '<figure class="mermaid-figure" data-line="36-38"><pre class="mermaid">H\n</pre></figure>\n' +
        '<p data-line="39-39">*Figure 1. h*</p>\n' +
        '<figure class="mermaid-figure" data-line="41-43"><pre class="mermaid">I\n</pre></figure>\n' +
        '<h2 id="figure-1-i" data-line="44-45"><em>Figure 1. i</em></h2>\n',
    ],
    [
      'the next block only: a dropped comment or a stray </details> is stepped over; nothing else is',
      '```mermaid\nA\n```\n<!-- dropped -->\n*Figure 1. a*\n\n```mermaid\nB\n```\n</details>\n' +
        '*Figure 2. b*\n\n```mermaid\nC\n```\n<!-- id:c -->\n*Figure 3. c*\n\n```mermaid\nD\n```\n' +
        '<details>\n*Figure 4. d*\n</details>\n\n```mermaid\nE\n```\n```mermaid\nF\n```\n*Figure 5. f*\n',
      '<figure class="mermaid-figure" data-line="1-3"><pre class="mermaid">A\n' +
        '</pre><figcaption>Figure 1. a</figcaption></figure>\n' +
        '<figure class="mermaid-figure" data-line="7-9"><pre class="mermaid">B\n' +
        '</pre><figcaption>Figure 2. b</figcaption></figure>\n' +
        '<figure class="mermaid-figure" data-line="13-15"><pre class="mermaid">C\n</pre></figure>\n' +
        '<span class="doc-anchor" id="c"></span>\n<p data-line="17-17"><em>Figure 3. c</em></p>\n' +
        '<figure class="mermaid-figure" data-line="19-21"><pre class="mermaid">D\n</pre></figure>\n' +
        '<details>\n<p data-line="23-23"><em>Figure 4. d</em></p>\n</details>\n' +
        '<figure class="mermaid-figure" data-line="26-28"><pre class="mermaid">E\n</pre></figure>\n' +
        '<figure class="mermaid-figure" data-line="29-31"><pre class="mermaid">F\n' +
        '</pre><figcaption>Figure 5. f</figcaption></figure>\n',
    ],
    [
      'in a blockquote, a loose list item and an alert',
      '> ```mermaid\n> A\n> ```\n> *Figure 1. in a quote*\n\n- item\n\n  ```mermaid\n  B\n  ```\n' +
        '  *Figure 2. in a list*\n\n> [!NOTE]\n> ```mermaid\n> C\n> ```\n> *Figure 3. in an alert*\n',
      '<blockquote data-line="1-4">\n' +
        '<figure class="mermaid-figure" data-line="1-3"><pre class="mermaid">A\n' +
        '</pre><figcaption>Figure 1. in a quote</figcaption></figure>\n</blockquote>\n' +
        '<ul data-line="6-12">\n<li data-line="6-12">\n<p data-line="6-6">item</p>\n' +
        '<figure class="mermaid-figure" data-line="8-10"><pre class="mermaid">B\n' +
        '</pre><figcaption>Figure 2. in a list</figcaption></figure>\n</li>\n</ul>\n' +
        '<div class="gh-alert gh-note" data-line="13-17"><p class="gh-alert-title">Note</p>\n' +
        '<figure class="mermaid-figure" data-line="14-16"><pre class="mermaid">C\n' +
        '</pre><figcaption>Figure 3. in an alert</figcaption></figure>\n</div>\n',
    ],
    [
      'a tight list item\'s paragraph renders no <p> and is never a caption',
      '- ```mermaid\n  A\n  ```\n  *Figure 1. hidden*\n- b\n',
      '<ul data-line="1-5">\n<li data-line="1-4">\n' +
        '<figure class="mermaid-figure" data-line="1-3"><pre class="mermaid">A\n</pre></figure>\n' +
        '<em>Figure 1. hidden</em></li>\n<li data-line="5-5">b</li>\n</ul>\n',
    ],
    [
      'only after a Mermaid figure: not after code, Mermaid spelled another way, or a paragraph',
      '```js\nlet a = 1;\n```\n*Figure 1. after code*\n\n```Mermaid\nB\n```\n*Figure 2. after Mermaid*\n' +
        '\npara\n*Figure 3. same paragraph*\n\npara\n\n*Figure 4. after a paragraph*\n',
      '<div class="codehilite" data-line="1-3"><pre>let a = 1;\n</pre></div>\n' +
        '<p data-line="4-4"><em>Figure 1. after code</em></p>\n' +
        '<div class="codehilite" data-line="6-8"><pre>B\n</pre></div>\n' +
        '<p data-line="9-9"><em>Figure 2. after Mermaid</em></p>\n<p data-line="11-12">para\n' +
        '<em>Figure 3. same paragraph</em></p>\n<p data-line="14-14">para</p>\n' +
        '<p data-line="16-16"><em>Figure 4. after a paragraph</em></p>\n',
    ],
    [
      'text in a caption is escaped as paragraph text is',
      '```mermaid\nA\n```\n*Figure 1. <script>alert(1)</script> & "q" \'a\' <b onclick=x>*\n',
      '<figure class="mermaid-figure" data-line="1-3"><pre class="mermaid">A\n' +
        '</pre><figcaption>Figure 1. &lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;q&quot; \'a\' &lt;b' +
        ' onclick=x&gt;</figcaption></figure>\n',
    ],
  ]);
});

describe("figcaption: this library's own cases", () => {
  it('lineAttrs: false leaves the figure and its caption without data-line', () => {
    expect(render('```mermaid\nA\n```\n*Figure 1. a*\n', { lineAttrs: false }).html).toBe(
      '<figure class="mermaid-figure"><pre class="mermaid">A\n</pre><figcaption>Figure 1. a</figcaption></figure>\n',
    );
  });

  it('a caption changes neither meta.figures nor meta.mermaidKinds', () => {
    const { meta } = render('```mermaid\nflowchart\n```\n*Figure 1. a*\n\n```mermaid\npie\n```\n');
    expect({ figures: meta.figures, mermaidKinds: meta.mermaidKinds }).toEqual({
      figures: 2,
      mermaidKinds: ['flowchart', 'pie'],
    });
  });

  it('a caption is checked against the inline HTML as rendered, and is safe output', () => {
    expect(CAPTION.exec('<em>Figure 1. a</em> <em>b</em>')?.[1]).toBe('Figure 1. a</em> <em>b');
    expect(CAPTION.exec('<em>Figure 1. a</em> b')).toBeNull();
    const html = render('```mermaid\nA\n```\n*Figure 1. <img src=x onerror=y> [a](javascript:b)*\n').html;
    expect(html).toContain('<figcaption>Figure 1. &lt;img src=x onerror=y&gt; [a](javascript:b)</figcaption>');
    expect(checkOutputSafety(html)).toEqual([]);
  });

  it('is a core rule of the engine', () => {
    const core = createEngine().core.ruler as unknown as { __rules__: { name: string; fn: unknown }[] };
    expect(core.__rules__.find((r) => r.name === 'figcaption')?.fn).toBe(figcaption);
  });
});

describe('figcaption: where this library differs from the reference', () => {
  // A tight list item's paragraph renders no <p>, so the reference's pattern, which ends at `</em></p>`,
  // looks further: past the end of the list item and the list, to the first paragraph that ends in an
  // emphasis. It then moves all of that into the figure's caption, which leaves the figure, the list and
  // that paragraph unbalanced. This library never looks past the block after the figure: the hidden
  // paragraph is not a caption, and the HTML stays balanced. No corpus case has this shape.
  const SRC = '- ```mermaid\n  A\n  ```\n  *Figure 1. x*\n\n*y*\n';
  const REFERENCE =
    '<ul data-line="1-5">\n<li data-line="1-5">\n' +
    '<figure class="mermaid-figure" data-line="1-3"><pre class="mermaid">A\n</pre><figcaption>Figure 1. x</em></li>\n' +
    '</ul>\n<p data-line="6-6"><em>y</figcaption></figure>\n';
  const THIS =
    '<ul data-line="1-5">\n<li data-line="1-5">\n' +
    '<figure class="mermaid-figure" data-line="1-3"><pre class="mermaid">A\n</pre></figure>\n' +
    '<em>Figure 1. x</em></li>\n</ul>\n<p data-line="6-6"><em>y</em></p>\n';

  it('a caption never reaches past the block after its figure', () => {
    const html = render(SRC).html;
    expect(html).toBe(THIS);
    expect(html).not.toBe(REFERENCE);
  });
});
