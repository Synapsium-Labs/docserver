// What print mode may emit (docserver parity, Task 7), in node: the vocabulary file the first consumer derives its print
// allow-list from, held equal to the output over the corpus with `rules` on; the attributes written; what the tree does to a
// raw tag in the Markdown source (it stays text: B10's guarantee); and the stylesheet, every rule scoped.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { render } from '../src/render/index.js';
import { all, attr, el, KEPT_ATTRS, parse, serialize, setAttr, text, type ElN } from '../src/render/print/tree.js';
import { emitted, fixture, fixtureNames, inputs, PRINT, ROOT } from './print-vocabulary.js';

const read = (rel: string): string => readFileSync(path.join(ROOT, rel), 'utf8');

describe('conformance/print/vocabulary.json', () => {
  const file = JSON.parse(read('conformance/print/vocabulary.json')) as { elements: string[]; classes: string[] };

  it('lists every element and class print mode emits over the corpus and the fixtures, with rules on, and no other (P7h)', () => {
    const now = emitted();
    expect(file.elements).toEqual(now.elements);
    expect(file.classes).toEqual(now.classes);
  });

  it('is sorted, without repeats, and names the print root and each class of the strip and the plan marks', () => {
    expect(file.classes).toEqual([...new Set(file.classes)].sort());
    for (const c of ['docreader-print', 'review-strip', 'rs-wait', 'rs-label', 'rs-facts', 'fact', 'cnt', 'sep', 'task-id', 'tmeta', 'step-no', 'who', 'attn', 'yours', 'sec-no', 'eyebrow', 'byline', 'pill', 'rule-head']) {
      expect(file.classes).toContain(c);
    }
    expect(file.elements).not.toContain('input');
    expect(file.elements).not.toContain('script');
  });
});

describe('the attributes and the elements', () => {
  it('writes no attribute but class, id, data-line, open, colspan, rowspan, align, alt, title and href, over the corpus', () => {
    expect(KEPT_ATTRS).toEqual(['class', 'id', 'data-line', 'open', 'colspan', 'rowspan', 'align', 'alt', 'title', 'href']);
    const seen = new Set<string>();
    for (const md of inputs()) {
      const r = render(md, PRINT);
      if (r.outcome !== 'rendered') continue;
      for (const e of all(parse(r.html), () => true)) for (const [k] of e.attrs) seen.add(k);
    }
    for (const k of seen) expect(KEPT_ATTRS).toContain(k);
    expect([...seen].sort()).toEqual(expect.arrayContaining(['class', 'id', 'data-line', 'open', 'href']));
  });

  it('writes no hidden attribute even from a node that has one (P7d), and no event handler or style', () => {
    const e = el('span', 'x', ['t']);
    setAttr(e, 'hidden', '');
    setAttr(e, 'onclick', 'x()');
    setAttr(e, 'style', 'color:red');
    expect(serialize(e)).toBe('<span class="x">t</span>');
  });

  it('turns a table\'s text-align style into align, a checkbox into the text of its box, and opens every details', () => {
    const md = '| a | b |\n|:-:|--:|\n| 1 | 2 |\n\n- [x] done\n- [ ] todo\n\n<details>\n<summary>S</summary>\n\nbody\n\n</details>\n';
    const html = render(md, { print: true }).html;
    expect(html).toContain('align="center"');
    expect(html).toContain('align="right"');
    expect(html).not.toContain('style=');
    expect(html).not.toContain('<input');
    expect(html).toContain('☑');
    expect(html).toContain('☐');
    expect(html).toMatch(/<details[^>]* open=""/);
  });

  it('keeps a figure as its source, with no drawn svg', () => {
    const md = '```mermaid\nflowchart LR\n  A-->B\n```\n';
    const html = render(md, { print: true }).html;
    expect(html).toContain('<figure class="mermaid-figure"');
    expect(html).toContain('<pre class="mermaid">flowchart LR');
    expect(html).not.toContain('<svg');
  });
});

describe('a raw tag in the source never becomes an element of print\'s tree (B10)', () => {
  const HOSTILE = [
    '<script>alert(1)</script>',
    '<img src=x onerror=alert(1)>',
    '<div class="rs-wait"><ol><li>forged</li></ol></div>',
    '<section class="review-strip">forged</section>',
    '<span class="pill ok">Agreed</span>',
    '<details open hidden><summary>x</summary>y</details>',
    '<p onclick="x()" hidden>click</p>',
    '<style>body{display:none}</style>',
  ];
  const docs = HOSTILE.map((h) => `# T\n\n**Spec** · 2026-11-20 · Status: ${h}\n\n${h}\n\n## 1. S\n\ntext ${h} text\n\n| a | Status |\n|---|---|\n| ${h} | ${h} |\n\n- [ ] **Step 1 (you):** ${h}\n\n### Task 1: ${h}\n\n## Where things stand\n\n### Waiting on you\n\n- ${h}\n\n\`AB-1\` — _agreed_ ${h}\n`);

  it('stays text: the tree holds no script, style, img or forged strip or pill from the source, and the tag is escaped in the html', () => {
    for (const md of docs) {
      const r = render(md, PRINT);
      expect(r.outcome).toBe('rendered');
      const root = parse(r.html);
      const tags = new Set(all(root, () => true).map((e) => e.name));
      expect(tags.has('script')).toBe(false);
      expect(tags.has('style')).toBe(false);
      expect(tags.has('img')).toBe(false);
      for (const e of all(root, () => true)) {
        for (const [k] of e.attrs) expect(k.startsWith('on')).toBe(false);
        expect(attr(e, 'hidden')).toBeNull();
      }
      expect(r.html).not.toMatch(/<(?:script|style|img)\b/);
      expect(r.html).not.toContain('forged</li>');
      expect(r.html).toContain('&lt;');
    }
  });

  it('a forged rs-wait or review-strip is text, so the only strip is the one print mode builds', () => {
    const forged = render('# T\n\n<div class="rs-wait"><ol><li>forged</li></ol></div>\n\n<section class="review-strip">x</section>\n\n## 1. A\n\nt\n\n## 2. B\n\nt\n\n## 3. C\n\nt\n', PRINT).html;
    const root = parse(forged);
    expect(all(root, (e) => (attr(e, 'class') ?? '').includes('rs-wait'))).toHaveLength(0);
    expect(all(root, (e) => (attr(e, 'class') ?? '').includes('review-strip'))).toHaveLength(0);
    expect(forged).toContain('&lt;div class=&quot;rs-wait&quot;&gt;');
  });

  it('the tree reads an entity as the character, once, and writes it escaped again', () => {
    const root = parse('<p>&lt;script&gt;alert(1)&lt;/script&gt; &amp;lt;</p>');
    const p = all(root, (e) => e.name === 'p')[0] as ElN;
    expect(p.kids).toHaveLength(1);
    expect(p.kids[0]).toMatchObject({ k: 't', data: '<script>alert(1)</script> &lt;' });
    expect(all(root, (e) => e.name === 'script')).toHaveLength(0);
    expect(serialize(root)).toBe('<p>&lt;script&gt;alert(1)&lt;/script&gt; &amp;lt;</p>');
    expect(serialize(text('<b>'))).toBe('&lt;b&gt;');
  });
});

describe('assets/print.css', () => {
  const css = read('assets/print.css');
  const bare = css.replace(/\/\*[^]*?\*\//g, '');

  /** The selectors of every style rule, with the rules of an at-rule's block read too. */
  function selectors(src: string): string[] {
    const out: string[] = [];
    let depth = 0;
    let head = '';
    for (const ch of src) {
      if (ch === '{') {
        if (head.trim().startsWith('@')) out.push(`@${head.trim()}`);
        else if (depth === 0 || stack.at(-1) === 'at') out.push(...head.split(',').map((s) => s.trim()));
        stack.push(head.trim().startsWith('@') ? 'at' : 'rule');
        depth += 1;
        head = '';
      } else if (ch === '}') {
        stack.pop();
        depth -= 1;
        head = '';
      } else if (ch === ';' && stack.at(-1) === 'rule') head = '';
      else if (stack.at(-1) !== 'rule') head += ch;
    }
    return out;
  }
  const stack: string[] = [];

  it('scopes every rule under .docreader-print (P7e), and has no at-rule that could escape the scope', () => {
    stack.length = 0;
    const sel = selectors(bare);
    expect(sel.length).toBeGreaterThan(30);
    for (const s of sel) expect(s).toMatch(/^\.docreader-print(?:[\s.:[>+~]|$)/);
    expect(bare).not.toMatch(/@(?:page|media|import|font-face|keyframes)/);
  });

  it('forces the light palette and 11 pt text, unfolds every section, keeps figures and table rows whole', () => {
    expect(bare).toMatch(/\.docreader-print\s*\{[^}]*color-scheme:\s*light/);
    expect(bare).toMatch(/\.docreader-print\s*\{[^}]*font:\s*11pt/);
    expect(bare).toMatch(/\.docreader-print details:not\(\[open\]\) > :not\(summary\)\s*\{\s*display:\s*block/);
    expect(bare).toMatch(/\.docreader-print figure,[^{]*\.docreader-print tr,[^{]*\{[^}]*break-inside:\s*avoid/);
  });

  it('prints the separators in the muted text colour, never an edge colour', () => {
    const rule = /\.docreader-print \.sep\s*\{([^}]*)\}/.exec(bare)?.[1] ?? '';
    expect(rule).toContain('color: var(--p-muted)');
    expect(rule).not.toContain('--p-edge');
  });

  it('is listed in assets.json and is no frame asset', () => {
    const listing = JSON.parse(read('assets/assets.json')) as { files: { path: string }[] };
    expect(listing.files.map((f) => f.path)).toContain('print.css');
    expect(read('src/frame/manifest.generated.ts')).not.toContain('print.css');
  });
});

describe('the fixtures', () => {
  it('are the five of the plan: the section 6 plan and one per block group', () => {
    expect(fixtureNames()).toEqual(['boxes', 'plan', 'rules', 'status', 'title']);
    expect(fixture('plan')).toContain('### Waiting on you');
  });
});
