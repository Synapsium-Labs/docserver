// The universal output-safety oracle (docserver L1, Task 3; architecture section F, Task 3). One synthetic
// violation per rule, a clean sample of every shape the renderer emits, and the whole contract: every
// expected file of the corpus passes, so the oracle is exactly as strict as the goldens allow.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { checkOutputSafety, decodeCharRefs } from '../src/conformance/oracle.js';

/** The rule word of each violation, in order. */
const rulesOf = (html: string): string[] => checkOutputSafety(html).map((v) => v.split(' ')[0] ?? '');

const CLEAN = [
  '<h2 id="3-why-x--y" data-line="5-5">3. Why <code>x</code> &amp; y?</h2>',
  '<p data-line="1-2">a<br />\nb <sup>1</sup> <sub>2</sub> <kbd>K</kbd> <em>e</em> <strong>s</strong> <s>x</s></p>',
  '<p><a href="http://x" title="t &quot;q&quot;">a</a> <a href="mailto:a@b.c">m</a> <a href="#fn1" id="fnref1">[1]</a></p>',
  '<p><img src="a.png" alt="i" title="t" /> <img src="data:image/png;base64,AAAA" alt="d" /></p>',
  '<a href="data:image/gif;base64,AA">g</a>',
  '<span class="doc-anchor" id="R14"></span>',
  '<details open>\n<summary>S &#x27;q&#x27;</summary>\n</details>\n<details>\n</details>',
  '<div class="codehilite" data-line="1-3"><pre><code class="hljs language-python"><span class="hljs-title function_">f</span>' +
    '<span class="hljs-title class_ inherited__">B</span></code></pre></div>',
  '<figure class="mermaid-figure" data-line="1-4"><pre class="mermaid">A --&gt; B</pre><figcaption>Figure 1. <em>x</em></figcaption></figure>',
  '<div class="gh-alert gh-note" data-line="1-3"><p class="gh-alert-title">Note</p><p>x</p>\n</div>',
  '<div class="table-wrapper"><table data-line="1-3">\n<thead>\n<tr data-line="1-1">\n<th style="text-align:right">x</th>\n</tr>\n</thead>',
  '<tbody>\n<tr data-line="3-3">\n<td style="text-align:center">y</td>\n</tr>\n</tbody>\n</table></div>',
  '<ol start="3" class="contains-task-list" data-line="1-2">\n<li class="task-list-item" data-line="1-1">',
  '<input class="task-list-item-checkbox" checked="checked" disabled="disabled" type="checkbox"> a</li>',
  '<li class="task-list-item"><input class="task-list-item-checkbox" disabled="disabled" type="checkbox"> b</li>\n</ol>',
  '<hr class="footnotes-sep" />\n<section class="footnotes">\n<ol class="footnotes-list">\n<li id="fn1" class="footnote-item">',
  '<p>n <a href="#fnref1:1" class="footnote-backref">\u21a9\ufe0e</a></p>\n</li>\n</ol>\n</section>',
  '<dl class="doc-meta" data-line="1-3"><div><dt>k</dt><dd>v</dd></div></dl>',
  '<p class="page-subtitle">This document could not be rendered; its source follows.</p><pre>&lt;x&gt;</pre>',
  '<pre data-line="3-4"><code>x &lt; y\n</code></pre>',
  '<blockquote data-line="1-1">\n</blockquote>\n<ul>\n<li></li>\n</ul>\n<hr />\n<h1 id="">x</h1>',
].join('\n');

describe('checkOutputSafety: a clean sample', () => {
  it('passes every shape the renderer emits', () => {
    expect(checkOutputSafety(CLEAN)).toEqual([]);
  });

  it('passes text with no tags at all', () => {
    expect(checkOutputSafety('a &lt;script&gt; b &amp; c')).toEqual([]);
    expect(checkOutputSafety('')).toEqual([]);
  });
});

describe('checkOutputSafety: one violation per rule', () => {
  it('a raw < that begins no tag', () => {
    expect(rulesOf('<p>a < b</p>')).toEqual(['unparsable']);
    expect(rulesOf('<P>x</P>')).toEqual(['unparsable', 'unparsable']);
    expect(rulesOf("<a href='x'>y</a>")).toEqual(['unparsable']);
    expect(rulesOf('<a href="x>y</a>')).toEqual(['unparsable']);
  });

  it('a comment', () => {
    expect(rulesOf('<p>x</p><!-- id:a -->')).toEqual(['comment']);
  });

  it('a tag outside the list', () => {
    expect(rulesOf('<script>alert(1)</script>')).toEqual(['tag', 'tag']);
    expect(rulesOf('<iframe src="x"></iframe><style></style><svg></svg><b>x</b>')).toEqual(
      Array.from({ length: 8 }, () => 'tag'),
    );
  });

  it('on* rejected, and any other attribute outside the per-tag lists', () => {
    expect(rulesOf('<img src="x" onerror="alert(1)" />')).toEqual(['attribute']);
    expect(rulesOf('<sup onclick="x">1</sup>')).toEqual(['attribute']);
    expect(rulesOf('<details open ontoggle="x">')).toEqual(['attribute']);
    expect(rulesOf('<p style="color:red">x</p>')).toEqual(['attribute']);
    expect(rulesOf('<a href="x" target="_blank">x</a>')).toEqual(['attribute']);
    expect(rulesOf('<div href="x"></div>')).toEqual(['attribute']);
  });

  it('a duplicated attribute, and a bare attribute other than open on details', () => {
    expect(rulesOf('<p class="footnotes" class="footnotes">a</p>')).toEqual(['attribute']);
    expect(rulesOf('<input class="task-list-item-checkbox" checked disabled="disabled" type="checkbox">')).toEqual([
      'attribute',
      'input',
    ]);
    expect(rulesOf('<a href>x</a>')).toEqual(['attribute']);
  });

  it('a class token outside the vocabulary', () => {
    expect(rulesOf('<p class="evil">x</p>')).toEqual(['class']);
    expect(rulesOf('<code class="hljs language-&quot;&gt;">x</code>')).toEqual(['class']);
    expect(rulesOf('<code class="language-Python">x</code>')).toEqual(['class']);
    expect(rulesOf('<span class="function_">x</span>')).toEqual(['class']);
  });

  it('an id with a quote, space, angle bracket, ampersand or equals sign', () => {
    expect(rulesOf('<span class="doc-anchor" id="a b"></span>')).toEqual(['id']);
    expect(rulesOf('<h1 id="a&amp;b">x</h1>')).toEqual(['id']);
    expect(rulesOf('<h1 id="a=b">x</h1>')).toEqual(['id']);
  });

  it('a data-line or start that is not digits', () => {
    expect(rulesOf('<p data-line="1-x">a</p>')).toEqual(['attribute']);
    expect(rulesOf('<ol start="1 onclick">\n</ol>')).toEqual(['attribute']);
  });

  it('a style other than text-align', () => {
    expect(rulesOf('<td style="text-align:left;position:fixed">x</td>')).toEqual(['style']);
    expect(rulesOf('<th style="background:url(x)">x</th>')).toEqual(['style']);
  });

  it('an input other than the disabled task-list checkbox', () => {
    expect(rulesOf('<input type="text" disabled="disabled">')).toEqual(['input']);
    expect(rulesOf('<input type="checkbox">')).toEqual(['input']);
    expect(rulesOf('<input type="checkbox" disabled="disabled" checked="">')).toEqual(['input']);
  });

  it('a closing tag with attributes, and a self-closing non-void element', () => {
    expect(rulesOf('<p>x</p class="y">')).toEqual(['closing']);
    expect(rulesOf('<p />')).toEqual(['closing']);
  });

  it('javascript:, vbscript: and file: in href or src, in any case', () => {
    expect(rulesOf('<a href="javascript:alert(1)">x</a>')).toEqual(['scheme']);
    expect(rulesOf('<a href="JaVaScRiPt:x">x</a>')).toEqual(['scheme']);
    expect(rulesOf('<a href="vbscript:x">x</a>')).toEqual(['scheme']);
    expect(rulesOf('<img src="file:///etc/x" alt="" />')).toEqual(['scheme']);
  });

  it('&#106;avascript: (a character reference hides the scheme)', () => {
    expect(rulesOf('<a href="&#106;avascript:x">x</a>')).toEqual(['scheme']);
    expect(rulesOf('<a href="&#x6A;avascript:x">x</a>')).toEqual(['scheme']);
    expect(rulesOf('<a href="&#106avascript:x">x</a>')).toEqual(['scheme']);
    expect(rulesOf('<a href="javascript&colon;x">x</a>')).toEqual(['scheme']);
  });

  it('a scheme split by controls or whitespace', () => {
    expect(rulesOf('<a href="java\tscript:x">x</a>')).toEqual(['scheme']);
    expect(rulesOf('<a href="java&#9;script:x">x</a>')).toEqual(['scheme']);
    expect(rulesOf('<a href=" \u0001javascript:x">x</a>')).toEqual(['scheme']);
  });

  it('a data: URL other than a raster image', () => {
    expect(rulesOf('<a href="data:text/html,x">x</a>')).toEqual(['scheme']);
    expect(rulesOf('<img src="data:image/svg+xml;base64,PHN2Zz4=" alt="" />')).toEqual(['scheme']);
  });
});

describe('decodeCharRefs', () => {
  it('decodes numeric references with or without the semicolon, and the named ones a scheme check needs', () => {
    expect(decodeCharRefs('&#106;&#x61;&#118a&colon;&Tab;&amp;&unknown;')).toBe('java:\t&&unknown;');
  });

  it('decodes once, so an escaped reference stays text', () => {
    expect(decodeCharRefs('&amp;#106;')).toBe('&#106;');
  });
});

describe('checkOutputSafety: the contract', () => {
  const ROOT = new URL('../conformance/', import.meta.url);
  const manifest = JSON.parse(readFileSync(new URL('manifest.json', ROOT), 'utf8')) as { id: string; kind: string }[];

  it('accepts every expected file of the corpus', () => {
    const flagged = manifest
      .filter((c) => c.kind !== 'generated')
      .flatMap((c) => checkOutputSafety(readFileSync(new URL(`expected/${c.id}.html`, ROOT), 'utf8')).map((v) => `${c.id}: ${v}`));
    expect(flagged).toEqual([]);
  });
});
