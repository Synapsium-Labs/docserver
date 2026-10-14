// Fences and Mermaid figures (docserver L1, Task 6; architecture section C, the "Fence info" and "Meta" rows;
// contract sections 2.5 and 2.6). Every expected html string and every expected figure count and kind list
// in the first four blocks was produced by the reference renderer and the golden generator's mermaid-kind
// rule from the same input. Code blocks are compared after normaliseForCompare (departure PD1: the
// reference highlights with Pygments and this library with highlight.js, so only the wrapper and the text
// can be equal); figures are left alone by it, so they are compared exactly. The later blocks pin this
// library's own markup inside the wrapper, which no reference has. Captions are Task 7's: no case here puts
// a `*Figure N. …*` paragraph after a figure.
import { describe, expect, it } from 'vitest';
import { loadCorpus } from '../src/conformance/index.js';
import { normaliseForCompare } from '../src/conformance/normalise.js';
import { checkOutputSafety } from '../src/conformance/oracle.js';
import { createEngine } from '../src/render/engine.js';
import { renderFence } from '../src/render/fence.js';
import { render } from '../src/render/index.js';

type Case = readonly [name: string, src: string, html: string];
type MetaCase = readonly [name: string, src: string, figures: number, kinds: readonly string[]];

function cases(list: readonly Case[]): void {
  for (const [name, src, html] of list) {
    it(name, () => {
      expect(normaliseForCompare(render(src).html)).toBe(html);
    });
  }
}

/** The class attribute of the <code> in every codehilite wrapper, in document order. */
function codeClasses(html: string): string[] {
  return [...html.matchAll(/<div class="codehilite"[^>]*><pre><code class="([^"]*)">/g)].map((m) => m[1] ?? '');
}

/** One fence per info string, each holding the line `x`. */
function fences(infos: readonly string[]): string {
  return infos.map((info) => `\`\`\`${info}\nx\n\`\`\`\n`).join('\n');
}

describe('fence: code blocks, against the reference', () => {
  cases([
    [
      'a known language: the wrapper with data-line, then the code text and one newline',
      '```python\nprint(\'hi\')\nx = 1 # c\n```\n',
      '<div class="codehilite" data-line="1-4"><pre>print(\'hi\')\nx = 1 # c\n</pre></div>\n',
    ],
    [
      'leading and trailing blank lines are stripped, inner ones and spaces kept',
      '```py\n\n\n  x \n\n y\n\n\n```\n',
      '<div class="codehilite" data-line="1-9"><pre>  x \n\n y\n</pre></div>\n',
    ],
    [
      'an empty fence, and a fence of blank lines, hold one newline',
      '```\n```\n\n```\n\n\n```\n',
      '<div class="codehilite" data-line="1-2"><pre>\n</pre></div>\n' +
        '<div class="codehilite" data-line="4-7"><pre>\n</pre></div>\n',
    ],
    [
      'one leading BOM is removed, as the reference highlighter removes it; any other stays',
      '```py\n\ufeffx=1\n```\n\n```\n\ufeff\n\nx\ufeff\n```\n\n```\n\ufeff\ufeffy\n```\n',
      '<div class="codehilite" data-line="1-3"><pre>x=1\n</pre></div>\n' +
        '<div class="codehilite" data-line="5-9"><pre>x\ufeff\n</pre></div>\n' +
        '<div class="codehilite" data-line="11-13"><pre>\ufeffy\n</pre></div>\n',
    ],
    [
      'an unclosed fence runs to the end of the document',
      'para\n\n```py\nx=1\n\ny\n',
      '<p data-line="1-1">para</p>\n<div class="codehilite" data-line="3-6"><pre>x=1\n\ny\n</pre></div>\n',
    ],
    [
      'tilde fences, longer fences, and fences in a list item and a blockquote',
      '~~~bash\necho $HOME | grep x\n~~~\n\n````\n```\ninner\n```\n````\n\n- a\n\n  ```python\n  x=1\n  ```\n' +
        '\n> ```js\n> let a\n> ```\n',
      '<div class="codehilite" data-line="1-3"><pre>echo $HOME | grep x\n</pre></div>\n' +
        '<div class="codehilite" data-line="5-9"><pre>```\ninner\n```\n</pre></div>\n<ul data-line="11-16">\n' +
        '<li data-line="11-16">\n<p data-line="11-11">a</p>\n' +
        '<div class="codehilite" data-line="13-15"><pre>x=1\n</pre></div>\n</li>\n</ul>\n' +
        '<blockquote data-line="17-19">\n<div class="codehilite" data-line="17-19"><pre>let a\n</pre></div>\n' +
        '</blockquote>\n',
    ],
    [
      'indented code is not a fence',
      '    x = 1\n',
      '<pre data-line="1-1"><code>x = 1\n</code></pre>\n',
    ],
    [
      'unknown, absent and hostile info strings render the same text',
      '```nonsense-lang\nx\n```\n\n```\nplain <b> \'q\' & "d"\n```\n\n```"><script>alert(1)</script>\ncode\n' +
        '```\n\n```x" class="y\nthree\n```\n',
      '<div class="codehilite" data-line="1-3"><pre>x\n</pre></div>\n' +
        '<div class="codehilite" data-line="5-7"><pre>plain &lt;b&gt; \'q\' &amp; &quot;d&quot;\n</pre></div>\n' +
        '<div class="codehilite" data-line="9-11"><pre>code\n</pre></div>\n' +
        '<div class="codehilite" data-line="13-15"><pre>three\n</pre></div>\n',
    ],
  ]);
});

describe('fence: Mermaid figures, against the reference', () => {
  cases([
    [
      'a mermaid fence is a figure; its source is escaped the Python way and not stripped',
      '```mermaid\n\nflowchart LR\n  A["a <b>"] --> B & C \'q\'\n\n```\n',
      '<figure class="mermaid-figure" data-line="1-6"><pre class="mermaid">\nflowchart LR\n' +
        '  A[&quot;a &lt;b&gt;&quot;] --&gt; B &amp; C &#x27;q&#x27;\n\n</pre></figure>\n',
    ],
    [
      'an empty mermaid fence',
      '```mermaid\n```\n',
      '<figure class="mermaid-figure" data-line="1-2"><pre class="mermaid"></pre></figure>\n',
    ],
    [
      'the first space-separated word after a Python strip decides',
      '```mermaid extra\nA\n```\n\n``` \u3000mermaid\nB\n```\n\n```\tmermaid\nC\n```\n\n```\u0085mermaid\nD\n' +
        '```\n',
      '<figure class="mermaid-figure" data-line="1-3"><pre class="mermaid">A\n</pre></figure>\n' +
        '<figure class="mermaid-figure" data-line="5-7"><pre class="mermaid">B\n</pre></figure>\n' +
        '<figure class="mermaid-figure" data-line="9-11"><pre class="mermaid">C\n</pre></figure>\n' +
        '<figure class="mermaid-figure" data-line="13-15"><pre class="mermaid">D\n</pre></figure>\n',
    ],
    [
      'exactly mermaid: these are code',
      '```Mermaid\nA\n```\n\n```mermaidx\nB\n```\n\n```mermaid\tx\nC\n```\n\n```mermaid\u3000x\nD\n```\n\n' +
        '```MERMAID\nE\n```\n',
      '<div class="codehilite" data-line="1-3"><pre>A\n</pre></div>\n' +
        '<div class="codehilite" data-line="5-7"><pre>B\n</pre></div>\n' +
        '<div class="codehilite" data-line="9-11"><pre>C\n</pre></div>\n' +
        '<div class="codehilite" data-line="13-15"><pre>D\n</pre></div>\n' +
        '<div class="codehilite" data-line="17-19"><pre>E\n</pre></div>\n',
    ],
    [
      'a BOM in mermaid source stays',
      '```mermaid\n\ufeffA\n```\n',
      '<figure class="mermaid-figure" data-line="1-3"><pre class="mermaid">\ufeffA\n</pre></figure>\n',
    ],
    [
      'tilde, in a list item, in a blockquote',
      '~~~mermaid\ngraph TD\n~~~\n\n- item\n\n  ```mermaid\n  graph TD\n  A-->B\n  ```\n\n> ```mermaid\n' +
        '> graph LR\n> ```\n',
      '<figure class="mermaid-figure" data-line="1-3"><pre class="mermaid">graph TD\n</pre></figure>\n' +
        '<ul data-line="5-11">\n<li data-line="5-11">\n<p data-line="5-5">item</p>\n' +
        '<figure class="mermaid-figure" data-line="7-10"><pre class="mermaid">graph TD\nA--&gt;B\n' +
        '</pre></figure>\n</li>\n</ul>\n<blockquote data-line="12-14">\n' +
        '<figure class="mermaid-figure" data-line="12-14"><pre class="mermaid">graph LR\n</pre></figure>\n' +
        '</blockquote>\n',
    ],
    [
      'markup in the source stays text',
      '```mermaid\nflowchart LR\n  A["<b onclick=x>l</b>"] --> B\n  click A "javascript:alert(1)"\n' +
        '  B --> C</pre><script>alert(1)</script>\n```\n',
      '<figure class="mermaid-figure" data-line="1-6"><pre class="mermaid">flowchart LR\n' +
        '  A[&quot;&lt;b onclick=x&gt;l&lt;/b&gt;&quot;] --&gt; B\n  click A &quot;javascript:alert(1)&quot;\n' +
        '  B --&gt; C&lt;/pre&gt;&lt;script&gt;alert(1)&lt;/script&gt;\n</pre></figure>\n',
    ],
  ]);
});

describe('meta: figures and mermaidKinds, against the reference', () => {
  const metas: readonly MetaCase[] = [
    [
      'figures and kinds are counted per document, distinct, in order',
      '```mermaid\nflowchart LR\n```\n\n```mermaid\nsequenceDiagram\n```\n\n```mermaid\nflowchart TD\n```\n\n' +
        '```Mermaid\nclassDiagram\n```\n\n- ```mermaid\n  pie\n  ```\n\n> ```mermaid\n> gantt\n> ```\n',
      5,
      ['flowchart', 'sequenceDiagram', 'pie', 'gantt'],
    ],
    [
      'blank and %% lines are skipped, then a --- block, then blank and %% lines again',
      '```mermaid\n\n%% c\n  %%{init: {}}%%\n---\ntitle: T\n---\n\n%% d\n\u3000stateDiagram-v2\n```\n',
      1,
      ['stateDiagram-v2'],
    ],
    [
      'a --- block that never closes, a non-keyword first line, and an empty source give no kind',
      '```mermaid\n---\ntitle: T\n```\n\n```mermaid\n1 flowchart\n```\n\n```mermaid\n```\n\n```mermaid\n' +
        '%% only\n```\n',
      4,
      [],
    ],
    [
      'a keyword is at most 40 characters, letters first, then letters, digits, _ and -',
      '```mermaid\n' + 'a'.repeat(50) + '\n```\n\n```mermaid\nx_y-2.z\n```\n',
      2,
      ['a'.repeat(40), 'x_y-2'],
    ],
  ];
  for (const [name, src, figures, kinds] of metas) {
    it(name, () => {
      const { meta } = render(src);
      expect({ figures: meta.figures, mermaidKinds: meta.mermaidKinds }).toEqual({ figures, mermaidKinds: kinds });
    });
  }

  it('at most 32 kinds, the first 32 in document order; every figure still counts', () => {
    const src = Array.from({ length: 40 }, (_, i) => `\`\`\`mermaid\nk${i}\n\`\`\`\n`).join('\n');
    const { meta } = render(src);
    expect(meta.figures).toBe(40);
    expect(meta.mermaidKinds).toEqual(Array.from({ length: 32 }, (_, i) => `k${i}`));
  });

  it("mermaid-figures: the meta is the case's expected meta (its html waits for Task 7's captions)", () => {
    const c = loadCorpus().find((x) => x.id === 'mermaid-figures');
    expect(c).toBeDefined();
    expect(`${JSON.stringify(render(c?.input ?? '', c?.options).meta, null, 2)}\n`).toBe(c?.expected.meta);
  });

  it('in every corpus case, meta.figures is the number of figures in the html', () => {
    const wrong = loadCorpus()
      .map((c) => ({ id: c.id, r: render(c.input, c.options) }))
      .filter(({ r }) => r.meta.figures !== r.html.split('<figure class="mermaid-figure"').length - 1)
      .map(({ id }) => id);
    expect(wrong).toEqual([]);
  });
});

describe('fence: the language comes from the registry, never from the input', () => {
  it('the first space-separated word after a Python strip, looked up in any case', () => {
    const infos = ['python title="x"', 'Python', 'PY', ' \u3000python', '\u0085python', '\u001fpy', 'js', 'jsx'];
    const more = ['tsx', 'html', 'svg', 'toml', 'yml', 'text', 'console', 'zsh', 'md', 'dockerfile', 'go'];
    expect(codeClasses(render(fences([...infos, ...more])).html)).toEqual([
      'hljs language-python',
      'hljs language-python',
      'hljs language-python',
      'hljs language-python',
      'hljs language-python',
      'hljs language-python',
      'hljs language-javascript',
      'hljs language-javascript',
      'hljs language-typescript',
      'hljs language-xml',
      'hljs language-xml',
      'hljs language-ini',
      'hljs language-yaml',
      'hljs language-plaintext',
      'hljs language-shell',
      'hljs language-bash',
      'hljs language-markdown',
      'hljs language-dockerfile',
      'hljs language-go',
    ]);
  });

  it('anything else gets no language class: a tab is not a separator, entities are not decoded', () => {
    const infos = ['', 'python\ttitle', 'promise-delta', 'nonsense-lang', 'py&amp;', 'gyp', 'patch', 'golang'];
    const more = ['constructor', '__proto__', 'toString', '"><script>alert(1)</script>', 'x" class="y', 'Mermaid'];
    const html = render(fences([...infos, ...more, 'mermaid\tx', 'mermaid\u3000x'])).html;
    expect(codeClasses(html)).toEqual(Array.from({ length: 16 }, () => 'hljs'));
    expect(checkOutputSafety(html)).toEqual([]);
  });
});

describe("fence: this library's markup inside the wrapper", () => {
  it('a known language: highlight.js spans in <code class="hljs language-NAME">', () => {
    expect(render("```python\nprint('hi')\n```\n").html).toBe(
      '<div class="codehilite" data-line="1-3"><pre><code class="hljs language-python">' +
        '<span class="hljs-built_in">print</span>(<span class="hljs-string">&#x27;hi&#x27;</span>)\n' +
        '</code></pre></div>\n',
    );
  });

  it('no language: <code class="hljs">, the text escaped as markdown-it escapes it (an apostrophe stays)', () => {
    expect(render('```\nplain <b> \'q\' & "d"\n```\n').html).toBe(
      '<div class="codehilite" data-line="1-3"><pre><code class="hljs">plain &lt;b&gt; \'q\' &amp; &quot;d&quot;\n' +
        '</code></pre></div>\n',
    );
  });

  it('code cannot close its wrapper, highlighted or not', () => {
    const src =
      '```js\nconst s = "</code></pre><script>alert(1)</script>";\n```\n\n' +
      '~~~\n</code></pre></div><script>alert(2)</script>\n~~~\n\n' +
      '```xml\n<div onclick="x"><script>var a=1</script><style>a{}</style></div>\n```\n';
    const html = render(src).html;
    expect(html).not.toContain('<script');
    expect(checkOutputSafety(html)).toEqual([]);
  });

  it('a fence with a line over 256 code units keeps its language class and shows escaped text', () => {
    // Several grammars take time quadratic in a line's length, so such a fence is not highlighted at all.
    const fence = (line: string): string => render(`\`\`\`js\nlet a = 'x';\n${line}\n\`\`\`\n`).html;
    expect(fence('_'.repeat(256))).toContain('<span class="hljs-keyword">let</span>');
    expect(fence(`<b>${'_'.repeat(254)}`)).toBe(
      `<div class="codehilite" data-line="1-4"><pre><code class="hljs language-javascript">let a = 'x';\n&lt;b&gt;${'_'.repeat(254)}\n` +
        '</code></pre></div>\n',
    );
  });

  it('at most 262144 code units of a document are highlighted; a fence that would pass that shows escaped text', () => {
    const block = "let a = 'x';\n".repeat(10_000);
    const html = render(`\`\`\`js\n${block}\`\`\`\n\n\`\`\`js\n${block}\`\`\`\n\n\`\`\`js\n${block}\`\`\`\n`).html;
    const codes = [...html.matchAll(/<code class="hljs language-javascript">([^]*?)<\/code>/g)].map((m) => m[1] ?? '');
    expect(codes.map((code) => code.includes('<span'))).toEqual([true, true, false]);
    expect(codes[2]).toBe(block);
  });

  it('lineAttrs: false leaves the wrapper and the figure without data-line', () => {
    expect(render('```py\nx\n```\n\n```mermaid\nA\n```\n', { lineAttrs: false }).html).toBe(
      '<div class="codehilite"><pre><code class="hljs language-python">x\n</code></pre></div>\n' +
        '<figure class="mermaid-figure"><pre class="mermaid">A\n</pre></figure>\n',
    );
  });

  it("is the engine's fence render rule", () => {
    expect(createEngine().renderer.rules.fence).toBe(renderFence);
  });
});
