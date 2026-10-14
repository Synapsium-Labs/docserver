// Figure captions (docserver L1, Task 7; architecture section C, the "Caption" row; contract section 2.7).
// Every expected html string in the first block was produced by the reference renderer from the same input
// and is compared after normaliseForCompare (it only touches code blocks; figures and captions are compared
// exactly). The reference finds a caption with a regular expression over its finished HTML; this library
// decides on the token stream (figcaption.ts), and these cases pin that the two agree. Where they differ on
// purpose (rulings C12 and C25, PD7), the last block pins both outputs.
// The later blocks pin this library's own behaviour where the reference has nothing to say, and the one
// place where it differs from the reference on purpose.
import { describe, expect, it } from 'vitest';
import { normaliseForCompare } from '../src/conformance/normalise.js';
import { checkOutputSafety } from '../src/conformance/oracle.js';
import { createEngine } from '../src/render/engine.js';
import { createEnv } from '../src/render/env.js';
import { CAPTION, figcaption, startsCaption } from '../src/render/figcaption.js';
import { render, scanRefs } from '../src/render/index.js';
import { FALLBACK_OPEN } from '../src/render/render.js';

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
      'from the first <em> to the last </em>: a nested em, a link, a break, a second line',
      '```mermaid\nA\n```\n*Figure 8. a *nested* em.*\n\n```mermaid\nB\n```\n*Figure 1. a*\n\n' +
        '```mermaid\nC\n```\n*Figure 2. see [x](y).*\n\n```mermaid\nD\n```\n*Figure 3. a\\\nb*\n\n' +
        '```mermaid\nE\n```\n*Figure 4. line1\nline2*\n',
      '<figure class="mermaid-figure" data-line="1-3"><pre class="mermaid">A\n' +
        '</pre><figcaption>Figure 8. a <em>nested</em> em.</figcaption></figure>\n' +
        '<figure class="mermaid-figure" data-line="6-8"><pre class="mermaid">B\n' +
        '</pre><figcaption>Figure 1. a</figcaption></figure>\n' +
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

  // Ruling C25: a caption is ONE emphasis span. In `*Figure 1. a* *b*` the first <em> is not the one that
  // closes the paragraph, and the reference's pattern took everything from the first <em> to the last </em>,
  // which emitted an unbalanced `Figure 1. a</em> <em>b`. This library leaves the paragraph as it is.
  const TWO = '```mermaid\nA\n```\n*Figure 1. a* *b*\n';
  const TWO_REFERENCE =
    '<figure class="mermaid-figure" data-line="1-3"><pre class="mermaid">A\n' +
    '</pre><figcaption>Figure 1. a</em> <em>b</figcaption></figure>\n';
  const TWO_THIS =
    '<figure class="mermaid-figure" data-line="1-3"><pre class="mermaid">A\n</pre></figure>\n' +
    '<p data-line="4-4"><em>Figure 1. a</em> <em>b</em></p>\n';

  it('a paragraph of two emphasis spans is not a caption: both outputs are pinned', () => {
    const html = render(TWO).html;
    expect(html).toBe(TWO_THIS);
    expect(html).not.toBe(TWO_REFERENCE);
    expect(TWO_REFERENCE).toContain('</em> <em>');
    expect(TWO_REFERENCE.match(/<em>/g)?.length).toBe(1);
    expect(TWO_REFERENCE.match(/<\/em>/g)?.length).toBe(1);
    expect(render(TWO).meta.figures).toBe(1);
  });

  it('emphasis nested inside the one span is still a caption', () => {
    expect(render('```mermaid\nA\n```\n*Figure 1. a *b* c*\n').html).toBe(
      '<figure class="mermaid-figure" data-line="1-3"><pre class="mermaid">A\n' +
        '</pre><figcaption>Figure 1. a <em>b</em> c</figcaption></figure>\n',
    );
  });

  it('the output is balanced: no stray </em>, whatever the emphasis around the caption', () => {
    const shapes = [
      '*Figure 1. a* *b*',
      '*Figure 1. a* b *c*',
      '*Figure 1. a* **b** *c*',
      '*Figure 1. a *b* c*',
      '_Figure 1. a_ _b_',
      '*Figure 1. a*_b_',
    ];
    for (const shape of shapes) {
      const html = render(`\`\`\`mermaid\nA\n\`\`\`\n${shape}\n`).html;
      expect(html.match(/<em>/g)?.length ?? 0, shape).toBe(html.match(/<\/em>/g)?.length ?? 0);
      expect(checkOutputSafety(html), shape).toEqual([]);
    }
    expect(render(TWO).html).not.toMatch(/<figcaption>[^]*<\/em>[^]*<\/figcaption>/);
  });
});

// Ruling C28: the caption is decided on tokens and rendered in the render phase, so the html bound counts it.
describe('figcaption: the caption is bounded (ruling C28)', () => {
  /** A reference definition with a `size`-character destination, a Mermaid figure, and a caption of `uses` links to it, spaced: `[a][a]` is one link. */
  function expansion(size: number, uses: number): string {
    return `[a]: /${'u'.repeat(size)}\n\n\`\`\`mermaid\nA\n\`\`\`\n\n*Figure 1. ${Array.from({ length: uses }, () => '[a]').join(' ')}*\n`;
  }

  it('a caption that expands past the html bound is output-over-limit, not failed, and scanRefs does not throw', () => {
    // 700 uses of a 1 MB destination: 700 MB of html, past V8's longest string (about 512 MiB) when it was built
    // whole at parse time, which gave outcome 'failed' for render() and a RangeError out of scanRefs().
    const src = expansion(1_000_000, 700);
    const r = render(src);
    expect(r.outcome).toBe('output-over-limit');
    expect(r.html.startsWith(FALLBACK_OPEN)).toBe(true);
    expect(Buffer.byteLength(r.html, 'utf8')).toBeLessThanOrEqual(16_777_216);
    expect(r.html).not.toContain('<a ');
    const s = scanRefs(src);
    expect(s.outcome).toBe('scanned');
    expect(s.mermaid.fences).toBe(1);
  });

  it('a caption is counted against maxHtmlBytes piece by piece', () => {
    const src = expansion(4000, 200);
    expect(render(src, { maxHtmlBytes: 100_000 }).outcome).toBe('output-over-limit');
    const whole = render(src);
    expect(whole.outcome).toBe('rendered');
    const bytes = Buffer.byteLength(whole.html, 'utf8');
    expect(render(src, { maxHtmlBytes: bytes }).html).toBe(whole.html);
    expect(render(src, { maxHtmlBytes: bytes - 1 }).outcome).toBe('output-over-limit');
  });

  it('parsing renders none of the caption: only the start of the span is looked at', () => {
    const md = createEngine();
    let links = 0;
    md.renderer.rules['link_open'] = (tokens, idx, options, _env, self) => {
      links += 1;
      return self.renderToken(tokens, idx, options);
    };
    const tokens = md.parse(expansion(10, 1000), createEnv({ lineAttrs: true }));
    expect(links).toBe(0);
    expect(tokens.map((t) => t.type)).toEqual(['fence', 'figcaption_open', 'inline', 'figcaption_close']);
    expect(tokens[2]?.children?.filter((t) => t.type === 'link_open')).toHaveLength(1000);
    expect(render(expansion(10, 1000)).html).toContain('Figure 1. <a href="/uuuuuuuuuu">a</a>');
  });

  // Review 458, F2: the decision renders the span's `<em>` and its leading text and softbreak children, and
  // nothing else. A link or an image right after `<em>` (or after `Figure `) used to be rendered whole, once
  // per figure, only for the decision to reject it, so a long destination cost its length at every figure.
  it('parsing renders no link or image, whether or not the span is a caption (review 458, F2)', () => {
    const counts = (caption: string, alsoRender = false): Record<string, number> => {
      const md = createEngine();
      const seen: Record<string, number> = {};
      for (const [name, rule] of Object.entries(md.renderer.rules)) {
        if (rule === undefined) continue;
        md.renderer.rules[name] = (tokens, idx, options, env, self) => {
          seen[name] = (seen[name] ?? 0) + 1;
          return rule(tokens, idx, options, env, self);
        };
      }
      for (const name of ['link_open', 'image']) {
        if (md.renderer.rules[name] !== undefined) continue;
        md.renderer.rules[name] = (tokens, idx, options, _env, self) => {
          seen[name] = (seen[name] ?? 0) + 1;
          return self.renderToken(tokens, idx, options);
        };
      }
      const env = createEnv({ lineAttrs: true });
      const tokens = md.parse(`[a]: /x\n\n\`\`\`mermaid\nA\n\`\`\`\n\n${caption}\n`, env);
      if (alsoRender) md.renderer.render(tokens, md.options, env);
      return seen;
    };
    for (const caption of ['*[a]*', '*Figure [a]*', '*![a]*', '*Figure 1. [a]*', '*Figure 1. ![a]*']) {
      const seen = counts(caption);
      expect(seen['link_open'] ?? 0, caption).toBe(0);
      expect(seen['image'] ?? 0, caption).toBe(0);
    }
    // The control for the helper: the same `counts`, on a path that must render a link and an image (the render
    // phase of a caption holding both), sees both, so its spies are shown to fire.
    const rendered = counts('*Figure 1. [a] ![b](/i)*', true);
    expect(rendered['link_open'] ?? 0).toBeGreaterThan(0);
    expect(rendered['image'] ?? 0).toBeGreaterThan(0);
    // A token between the digits and the dot is never skipped: a tag, code or an image there is no caption.
    for (const shape of ['Figure 1<sup></sup>. a', 'Figure 1`x`. a', 'Figure 1![](u). a', 'Figure <kbd></kbd>1. a']) {
      expect(render(`\`\`\`mermaid\nA\n\`\`\`\n*${shape}*\n`).html, shape).not.toContain('<figcaption>');
    }
    // The control: the spy does see a render when one happens (the render phase renders the link).
    const md = createEngine();
    let links = 0;
    md.renderer.rules['link_open'] = (tokens, idx, options, _env, self) => {
      links += 1;
      return self.renderToken(tokens, idx, options);
    };
    const tokens = md.parse('[a]: /x\n\n*[a]*\n', createEnv({ lineAttrs: true }));
    expect(links).toBe(0);
    md.renderer.render(tokens, md.options, createEnv({ lineAttrs: true }));
    expect(links).toBe(1);
  });

  // C28's claim that the decision reads only a prefix, measured: one candidate paragraph of 1000 lines (about
  // 2000 text and softbreak children) after a Mermaid fence. The lazy decision stops inside the first text
  // child, so it calls the text rule once and the softbreak rule never (exactly 1 and 0); spreading every
  // piece would call them about 1000 times each. The bound of 4 leaves a wide margin.
  it('parsing reads only a prefix of a long caption: the text and softbreak rules are called at most a few times', () => {
    const lines = (first: string): string => `${first}\n${Array.from({ length: 999 }, (_, i) => `l${i}`).join('\n')}`;
    const calls = (caption: string): { text: number; softbreak: number; children: number } => {
      const md = createEngine();
      const seen = { text: 0, softbreak: 0, children: 0 };
      for (const name of ['text', 'softbreak'] as const) {
        const rule = md.renderer.rules[name];
        if (rule === undefined) throw new Error(`no ${name} rule`);
        md.renderer.rules[name] = (tokens, idx, options, env, self) => {
          seen[name] += 1;
          return rule(tokens, idx, options, env, self);
        };
      }
      const tokens = md.parse(`\`\`\`mermaid\nA\n\`\`\`\n\n${caption}\n`, createEnv({ lineAttrs: true }));
      seen.children = tokens.find((t) => t.type === 'inline')?.children?.length ?? 0;
      return seen;
    };
    // A real caption: decided inside its first text child.
    const real = calls(`*${lines('Figure 1. a')}*`);
    expect(real.children).toBeGreaterThan(1900);
    expect(real.text).toBeLessThanOrEqual(4);
    expect(real.softbreak).toBeLessThanOrEqual(4);
    // A non-caption decided early too: `Fig x` fails at the space.
    const fake = calls(`*${lines('Fig x')}*`);
    expect(fake.children).toBeGreaterThan(1900);
    expect(fake.text).toBeLessThanOrEqual(4);
    expect(fake.softbreak).toBeLessThanOrEqual(4);
  });

  it('a caption is the figcaption_open, the inline token and figcaption_close right after the fence', () => {
    const tokens = createEngine().parse('```mermaid\nA\n```\n\n</details>\n\n*Figure 1. a*\n\nz\n', createEnv({ lineAttrs: true }));
    const types = tokens.map((t) => t.type);
    const at = types.indexOf('fence');
    expect(types.slice(at, at + 4)).toEqual(['fence', 'figcaption_open', 'inline', 'figcaption_close']);
    expect(types[at + 4]).toBe('html_block');
    expect(tokens[at + 2]?.children?.map((t) => t.type)).toEqual(['text']);
  });

  // The decision is CAPTION's, taken on a prefix. Every shape below is compared with CAPTION on the whole
  // rendered paragraph, so the two cannot disagree.
  const SHAPES = [
    'Figure 1. a', 'Figure 1.', 'Figure\n7.x', 'Figure\u00a01. a', 'Figure\u1680\u2003 \t12. a', 'Figure\u001f2. a',
    'Figure \u0661. a', 'Figure \uff11\uff12. a', 'Figure \u{1d7ce}. a', 'Figure 01.x', 'Figure &nbsp;1. a', 'Figure &#49;. a',
    'Figure 1\\. a', 'Figure 1 . a', 'Figure 1', 'Figure 1,', 'Figure .', 'Figure', 'Figure  ', 'figure 1. a', 'FIGURE 1. a',
    'Figures 1. a', 'Figure1. a', 'Figure \u2160. a', 'Figure \u00b2. a', 'Figure \ufeff1. a', 'Fig\\ure 1. a',
    'Figure **1**. a', 'Figure `1`. a', 'Figure 1<sup>x</sup>. a', 'Figure <br>1. a', 'Figure ![i](u). a', 'Figure [1](u). a',
    '**Figure 1.** a', '*Figure 1.* a', 'a *Figure 1.* b', 'Figure 1.\u2028a', 'Figure 1. *b* c', 'Figure 1. [x](y) ![i](j)',
  ];

  it("startsCaption agrees with CAPTION on a paragraph's rendered start", () => {
    const md = createEngine();
    for (const shape of SHAPES) {
      const tokens = md.parse(`*${shape}*\n`, createEnv({ lineAttrs: true }));
      const children = tokens.find((t) => t.type === 'inline')?.children ?? [];
      const pieces = children.map((_, j) => {
        const rule = md.renderer.rules[children[j]?.type ?? ''];
        return rule === undefined ? md.renderer.renderToken(children, j, md.options) : rule(children, j, md.options, {}, md.renderer);
      });
      const html = pieces.join('');
      const first = children[0]?.type === 'em_open' && children.at(-1)?.type === 'em_close';
      if (!first) continue;
      expect(startsCaption(pieces), shape).toBe(CAPTION.test(html));
    }
    // And the shapes that are captions really are: through render(), not only through the predicate.
    const yes = ['Figure 1. a', 'Figure\n7.x', 'Figure\u00a01. a', 'Figure \u{1d7ce}. a', 'Figure &#49;. a', 'Figure 1\\. a'];
    for (const shape of yes) {
      expect(render(`\`\`\`mermaid\nA\n\`\`\`\n*${shape}*\n`).html, shape).toContain('<figcaption>');
    }
    const no = ['Figure 1', 'Figure .', 'figure 1. a', 'Figure1. a', 'Figure **1**. a', 'Figure 1<sup>x</sup>. a'];
    for (const shape of no) {
      expect(render(`\`\`\`mermaid\nA\n\`\`\`\n*${shape}*\n`).html, shape).not.toContain('<figcaption>');
    }
  });

  it('startsCaption stops at the first piece that decides, and a long whitespace run is read in full', () => {
    let asked = 0;
    function* pieces(): Generator<string> {
      for (const p of ['<em>', 'Figure 1.', 'never', 'asked']) {
        asked += 1;
        yield p;
      }
    }
    expect(startsCaption(pieces())).toBe(true);
    expect(asked).toBe(2);
    asked = 0;
    function* wrong(): Generator<string> {
      for (const p of ['<em>', 'Figures', 'never']) {
        asked += 1;
        yield p;
      }
    }
    expect(startsCaption(wrong())).toBe(false);
    expect(asked).toBe(2);
    const long = `*Figure${'\u00a0'.repeat(200_000)}7. a*`;
    expect(render(`\`\`\`mermaid\nA\n\`\`\`\n${long}\n`).html).toContain('<figcaption>Figure');
  });
});
