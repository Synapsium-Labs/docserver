// normaliseForCompare (docserver L1, Task 2; architecture section D, departure PD1): highlighted code blocks
// compare by wrapper and text, everything else byte for byte. The two block shapes below are the reference
// renderer's (Pygments: no <code>, a leading empty span, &#39;) and this library's (highlight.js: a
// <code class="hljs language-…"> wrapper, &#x27;).
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { normaliseForCompare } from '../src/conformance/normalise.js';

const PYGMENTS =
  '<div class="codehilite" data-line="1-3"><pre><span></span><span class="nb">print</span>' +
  '<span class="p">(</span><span class="s1">&#39;a &lt; b &amp;&amp; &quot;c&quot;&#39;</span>' +
  '<span class="p">)</span>\n</pre></div>\n';
const HLJS =
  '<div class="codehilite" data-line="1-3"><pre><code class="hljs language-python">' +
  '<span class="hljs-built_in">print</span>(<span class="hljs-string">&#x27;a &lt; b &amp;&amp; &quot;c&quot;&#x27;</span>)' +
  '\n</code></pre></div>\n';
const CANONICAL = '<div class="codehilite" data-line="1-3"><pre>print(\'a &lt; b &amp;&amp; &quot;c&quot;\')\n</pre></div>\n';
const MERMAID =
  '<figure class="mermaid-figure" data-line="5-8"><pre class="mermaid">A --&gt; B &#x27;q&#x27; &amp;amp;\n' +
  '</pre><figcaption>Figure 1. <em>x</em></figcaption></figure>\n';
const INDENTED = '<pre data-line="10-11"><code>x &lt; y <span>\n</code></pre>\n';

describe('normaliseForCompare: highlighted blocks', () => {
  it('two codehilite blocks with different spans but equal text normalise equal', () => {
    expect(normaliseForCompare(PYGMENTS)).toBe(CANONICAL);
    expect(normaliseForCompare(HLJS)).toBe(CANONICAL);
  });

  it('different text normalises unequal', () => {
    const other = HLJS.replace('print', 'input');
    expect(normaliseForCompare(other)).not.toBe(normaliseForCompare(PYGMENTS));
    expect(normaliseForCompare(other)).toBe(CANONICAL.replace('print', 'input'));
  });

  it("the wrapper's data-line is preserved, and a wrapper without one is normalised too", () => {
    expect(normaliseForCompare(PYGMENTS.replace('1-3', '7-9'))).toBe(CANONICAL.replace('1-3', '7-9'));
    const bare = HLJS.replace(' data-line="1-3"', '');
    expect(normaliseForCompare(bare)).toBe(CANONICAL.replace(' data-line="1-3"', ''));
  });

  it('decodes entities in one pass, so an escaped entity stays text', () => {
    const block = '<div class="codehilite"><pre><span></span>&amp;lt;b&amp;gt; &amp;amp;\n</pre></div>\n';
    expect(normaliseForCompare(block)).toBe(block.replace('<span></span>', ''));
  });

  it('an empty fence keeps its single newline', () => {
    expect(normaliseForCompare('<div class="codehilite" data-line="1-2"><pre><span></span>\n</pre></div>\n')).toBe(
      '<div class="codehilite" data-line="1-2"><pre>\n</pre></div>\n',
    );
  });
});

describe('normaliseForCompare: everything else is untouched', () => {
  it('mermaid pre untouched', () => {
    expect(normaliseForCompare(MERMAID)).toBe(MERMAID);
    expect(normaliseForCompare(MERMAID + PYGMENTS)).toBe(MERMAID + CANONICAL);
  });

  it('indented pre code untouched', () => {
    expect(normaliseForCompare(INDENTED)).toBe(INDENTED);
    expect(normaliseForCompare(PYGMENTS + INDENTED)).toBe(CANONICAL + INDENTED);
  });

  it('HTML with no codehilite block is returned identical', () => {
    const html = '<h1 id="t" data-line="1-1">T &amp; &#39;q&#39;</h1>\n<p data-line="3-3"><code>&lt;b&gt;</code></p>\n';
    expect(normaliseForCompare(html)).toBe(html);
  });

  it('is idempotent', () => {
    const doc = `${MERMAID}${PYGMENTS}${INDENTED}${HLJS}`;
    const once = normaliseForCompare(doc);
    expect(normaliseForCompare(once)).toBe(once);
  });
});

describe('normaliseForCompare: on every reference', () => {
  const REFERENCE = fileURLToPath(new URL('../conformance/reference/', import.meta.url));
  const BLOCK = /<div class="codehilite"(?: data-line="[^"]*")?><pre>[\s\S]*?<\/pre><\/div>/g;
  const referenceFiles = (): string[] =>
    readdirSync(REFERENCE, { recursive: true, encoding: 'utf8' })
      .filter((f) => f.endsWith('.html'))
      .sort();

  it('finds the references', () => {
    expect(referenceFiles().length).toBeGreaterThan(0);
  });

  it('changes nothing outside highlighted blocks, leaves no tag inside one, and is idempotent', () => {
    const changed: string[] = [];
    for (const f of referenceFiles()) {
      const ref = readFileSync(path.join(REFERENCE, f), 'utf8');
      const out = normaliseForCompare(ref);
      if (ref.replace(BLOCK, '') !== out.replace(BLOCK, '')) changed.push(`${f}: outside a block`);
      for (const block of out.match(BLOCK) ?? []) {
        const inner = block.slice(block.indexOf('<pre>') + 5, -'</pre></div>'.length);
        if (inner.includes('<')) changed.push(`${f}: a tag left inside a block`);
      }
      if (normaliseForCompare(out) !== out) changed.push(`${f}: not idempotent`);
    }
    expect(changed).toEqual([]);
  });
});
