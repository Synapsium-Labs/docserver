// What print mode may emit (docserver parity, Task 7), in node: the vocabulary file the first consumer derives its print
// allow-list from, held equal to the output over the corpus with `rules` on; the attributes written; what the tree does to a
// raw tag in the Markdown source (it stays text: B10's guarantee); and the stylesheet, every rule scoped.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { render } from '../src/render/index.js';
import { all, attr, el, KEPT_ATTRS, insert, KEPT_IMG_ATTRS, nextEl, nextSibling, parse, prevEl, serialize, setAttr, text, wrap, type ElN, type N } from '../src/render/print/tree.js';
import { emitted, FAMILIES, fixture, fixtureNames, highlightSubScopeClasses, inFamily, inputs, PRINT, registeredLanguages, ROOT } from './print-vocabulary.js';

const read = (rel: string): string => readFileSync(path.join(ROOT, rel), 'utf8');

describe('conformance/print/vocabulary.json', () => {
  const file = JSON.parse(read('conformance/print/vocabulary.json')) as { elements: string[]; classes: string[]; families: string[] };

  it('lists every element and class print mode emits over the corpus and the fixtures, with rules on, and no other (P7h)', () => {
    const now = emitted();
    expect(file.elements).toEqual(now.elements);
    expect(file.classes).toEqual(now.classes);
  });

  it('is sorted, without repeats, and names the print root and each class of the strip and the plan marks', () => {
    expect(file.classes).toEqual([...new Set(file.classes)].sort());
    for (const c of ['docreader-print', 'review-strip', 'rs-wait', 'rs-label', 'rs-facts', 'fact', 'cnt', 'sep', 'task-id', 'tmeta', 'step-no', 'who', 'attn', 'yours', 'sec-no', 'eyebrow', 'byline', 'pill', 'rule-head', 'task-check']) {
      expect(file.classes).toContain(c);
    }
    expect(file.elements).not.toContain('input');
    expect(file.elements).not.toContain('script');
  });

  it('is complete for what the consumer derives from it: every alert kind, every heading level, and every class print emits is listed or in a family (P7an)', () => {
    for (const k of ['note', 'tip', 'important', 'warning', 'caution']) expect(file.classes).toContain(`gh-${k}`);
    for (const h of ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']) expect(file.elements).toContain(h);
    for (const c of emitted().all) expect(file.classes.includes(c) || file.families.some((f) => c.startsWith(f)), c).toBe(true);
  });

  it('declares two open families, hljs- and language-, and no other: no listed class is in one, and no other family is declared (P7ao)', () => {
    expect(file.families).toEqual(['hljs-', 'language-']);
    expect(file.families).toEqual([...FAMILIES]);
    expect(file.classes.filter(inFamily)).toEqual([]);
    expect(file.classes).toContain('hljs');
    // What highlight.js writes besides the families is finite for the languages registered: its sub-scope classes are listed.
    expect(highlightSubScopeClasses()).toEqual(expect.arrayContaining(['function_', 'class_', 'prompt_']));
    for (const c of highlightSubScopeClasses()) expect(file.classes).toContain(c);
    // A numbered capture (`7: "title.class.inherited"`) names a scope; a `label` names a mode and is no class (P7ay, P7az).
    expect(highlightSubScopeClasses()).toContain('inherited__');
    expect(highlightSubScopeClasses()).not.toContain('def_');
    expect(file.classes).not.toContain('def_');
    expect(registeredLanguages()).toEqual(expect.arrayContaining(['bash', 'javascript', 'python', 'yaml']));
    expect(registeredLanguages()).toHaveLength(18);
  });
});

describe('the attributes and the elements', () => {
  it('writes no attribute but class, id, data-line, open, colspan, rowspan, align, alt, title and href, and an img\'s src, over the corpus', () => {
    expect(KEPT_ATTRS).toEqual(['class', 'id', 'data-line', 'open', 'colspan', 'rowspan', 'align', 'alt', 'title', 'href']);
    expect(KEPT_IMG_ATTRS).toEqual(['src']);
    const seen = new Set<string>();
    const onImg = new Set<string>();
    for (const md of inputs()) {
      const r = render(md, PRINT);
      if (r.outcome !== 'rendered') continue;
      for (const e of all(parse(r.html), () => true)) for (const [k] of e.attrs) (k === 'src' ? onImg : seen).add(k === 'src' ? e.name : k);
    }
    for (const k of seen) expect(KEPT_ATTRS).toContain(k);
    expect([...seen].sort()).toEqual(expect.arrayContaining(['class', 'id', 'data-line', 'open', 'href', 'alt']));
    expect([...onImg]).toEqual(['img']);
  });

  it('writes no hidden attribute even from a node that has one (P7d), and no event handler or style', () => {
    const e = el('span', 'x', ['t']);
    setAttr(e, 'hidden', '');
    setAttr(e, 'onclick', 'x()');
    setAttr(e, 'style', 'color:red');
    expect(serialize(e)).toBe('<span class="x">t</span>');
  });

  it('keeps src on an img only, and on no other element (P7ap)', () => {
    const img = el('img');
    setAttr(img, 'src', 'a.png');
    setAttr(img, 'alt', 'x');
    expect(serialize(img)).toBe('<img src="a.png" alt="x" />');
    for (const name of ['a', 'span', 'div', 'script', 'iframe', 'input', 'td']) {
      const e = el(name);
      setAttr(e, 'src', 'a.png');
      expect(serialize(e)).not.toContain('src');
    }
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
  it('are the section 6 plan, one per block group, the alerts and the plain blocks', () => {
    expect(fixtureNames()).toEqual(['alerts', 'blocks', 'boxes', 'plan', 'rules', 'status', 'title']);
    expect(fixture('plan')).toContain('### Waiting on you');
  });
});

describe('the cost of print mode is linear in the document', () => {
  /** A document of `n` blocks with every kind of walk in it: a long box, many sections, a long Waiting box, tasks and steps. */
  const big = (n: number): string => {
    const lines = ['# Big', '', '**Spec** · 2026-11-20 · Status: Draft', '', '## In short', ''];
    for (let i = 0; i < n; i += 1) lines.push(`Paragraph ${String(i)}.`, '');
    lines.push('## 1. Tasks', '', '### Task 1: Many', '');
    for (let i = 0; i < n; i += 1) lines.push(`- [ ] **Step ${String(i + 1)} (you):** do it`);
    lines.push('', '## 2. Table', '', '| ID | Status |', '|---|---|');
    for (let i = 0; i < Math.min(n, 500); i += 1) lines.push(`| R${String(i)} | Agreed |`);
    lines.push('', '## 3. End', '', 'x', '', '## Where things stand', '', '### Waiting on you', '');
    for (let i = 0; i < n; i += 1) lines.push(`- item ${String(i)}`);
    lines.push('', '### Agreed', '', '- one', '');
    return lines.join('\n');
  };

  /** The calls of Array's position searches on an array longer than 500 during `fn`: a plain patch of the three methods, restored in `finally`. */
  function longSearches(fn: () => void): number {
    let long = 0;
    const proto = Array.prototype as unknown as Record<string, (...a: unknown[]) => unknown>;
    const names = ['indexOf', 'lastIndexOf', 'findIndex'] as const;
    const originals = names.map((n) => proto[n] as (...a: unknown[]) => unknown);
    names.forEach((n, i) => {
      proto[n] = function (this: unknown[], ...a: unknown[]): unknown {
        if (this.length > 500) long += 1;
        return (originals[i] as (...b: unknown[]) => unknown).apply(this, a);
      };
    });
    try {
      fn();
    } finally {
      names.forEach((n, i) => {
        proto[n] = originals[i] as (...a: unknown[]) => unknown;
      });
    }
    return long;
  }

  /** A coarse backstop only: the reads guard below is the deterministic one. It also holds that the big document renders and gets its strip. */
  it('backstop: 20000 blocks print within 10 times the plain render\'s time plus 1.5 s, and print\'s strip is there', () => {
    const md = `# Big\n\n## In short\n\n${Array.from({ length: 20000 }, (_, i) => `Paragraph ${String(i)}.`).join('\n\n')}\n\n## 1. A\n\nx\n\n## 2. B\n\nx\n\n## Where things stand\n\n### Waiting on you\n\n- one\n`;
    const time = (fn: () => void): number => {
      const t = performance.now();
      fn();
      return performance.now() - t;
    };
    const plain = time(() => void render(md));
    let result: ReturnType<typeof render> | null = null;
    const printed = time(() => {
      result = render(md, PRINT);
    });
    expect((result as unknown as ReturnType<typeof render>).outcome).toBe('rendered');
    expect((result as unknown as ReturnType<typeof render>).html).toContain('class="review-strip"');
    expect(printed, `plain ${plain.toFixed(0)} ms`).toBeLessThan(10 * plain + 1500);
  });

  it('reads the children of a parent of 5000 a few times each, not in proportion to their positions: next, previous, after insert and wrap, with stale hints (P7am2, P7ax, P7bb)', () => {
    const N = 5000;
    const parent = el('div', undefined, Array.from({ length: N }, () => el('i')));
    let reads = 0;
    parent.kids = new Proxy(parent.kids, {
      get(target, key, receiver) {
        if (typeof key === 'string' && /^\d+$/.test(key)) reads += 1;
        return Reflect.get(target, key, receiver) as unknown;
      },
    });
    const walk = (): number => {
      let seen = 0;
      for (let n: N | null = parent.kids[0] ?? null; n !== null; n = nextSibling(n)) seen += 1;
      for (let n: ElN | null = parent.kids[0] as ElN; n !== null; n = nextEl(n)) seen += 1;
      for (let n: ElN | null = parent.kids[parent.kids.length - 1] as ElN; n !== null; n = prevEl(n)) seen += 1;
      return seen;
    };
    // Exact hints, as parse leaves them.
    expect(walk()).toBe(3 * N);
    // After an insert and a wrap (each renumbers what follows), then with hints three positions out, so the outward search runs.
    insert(parent, el('b'), parent.kids[10] as N);
    wrap(parent.kids.slice(100, 200), el('w'));
    const total = parent.kids.length;
    for (const k of parent.kids) k.at += 3;
    expect(walk()).toBe(3 * total);
    expect(reads, `reads for ${String(total)} children`).toBeLessThan(60 * N);
  });

  it('searches no long array for a node\'s position: print adds few such searches to a render, however many blocks (P7am, P7ax)', () => {
    for (const n of [1000, 4000]) {
      const md = big(n);
      const plain = longSearches(() => void render(md));
      const printed = longSearches(() => {
        const r = render(md, PRINT);
        expect(r.outcome).toBe('rendered');
        expect(r.html).toContain('class="review-strip"');
      });
      expect(printed - plain, `n = ${String(n)}`).toBeLessThan(50);
    }
  });
});

describe('wrap', () => {
  it('takes adjacent siblings of one parent, in order, and throws on anything else (P7ba)', () => {
    const p = el('div', undefined, [el('a'), el('b'), el('c'), el('d')]);
    const [a, b, c, d] = p.kids as [N, N, N, N];
    expect(() => wrap([a, c], el('x'))).toThrow(/adjacent siblings/);
    expect(() => wrap([b, a], el('x'))).toThrow(/adjacent siblings/);
    expect(() => wrap([a, el('z')], el('x'))).toThrow(/adjacent siblings/);
    expect(p.kids).toHaveLength(4);
    const w = wrap([b, c], el('x'));
    expect(p.kids.map((k) => (k as ElN).name)).toEqual(['a', 'x', 'd']);
    expect(w.kids).toEqual([b, c]);
    expect(d.up).toBe(p);
  });
});
