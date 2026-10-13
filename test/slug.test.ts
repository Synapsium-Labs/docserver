// Heading ids, meta.headings and meta.title (docserver L1, Task 4; architecture section C, the "Anchors" and
// "Meta" rows; contract section 3). Every expected id, html string and heading below was produced by the
// reference renderer (its anchors plugin's slugify, and render_md) from the same input.
import { describe, expect, it } from 'vitest';
import { render } from '../src/render/index.js';
import { createSlugState, headingTitle, pySlug, uniqueSlug, type SlugState } from '../src/render/slug.js';

describe('pySlug', () => {
  // [title as the anchors rule joins it, the reference's slug]
  const TABLE: readonly (readonly [string, string])[] = [
    // contract section 3's verified table, its titles as the reference joins them
    ['3. Why x & y?', '3-why-x--y'],
    ['Same', 'same'],
    ['Ünïcode Ça va — dash', 'ünïcode-ça-va--dash'],
    ['中文 标题', '中文-标题'],
    ['a.b.c', 'abc'],
    ['Bold and link  sup', 'bold-and-link--sup'],
    ['A--B -- C', 'a--b----c'],
    ['!', ''],
    ['', ''],
    // Python's whitespace, case and word characters
    ['a\tb', 'ab'],
    ['x\u00a0y', 'xy'],
    ['x\u0085y', 'xy'],
    ['\u001cfile separator\u001f', 'file-separator'],
    ['\u3000ideographic\u3000', 'ideographic'],
    ['\ufeffleading mark', 'leading-mark'],
    ['ΟΔΟΣ', 'οδος'],
    ['İstanbul', 'istanbul'],
    ['Straße STRASSE', 'straße-strasse'],
    ['Cafe\u0301 combining', 'cafe-combining'],
    ['𐐀𐐁 Deseret', '𐐨𐐩-deseret'],
    ['½ ² 1.2.3', '½-²-123'],
    ['snake_case Под', 'snake_case-под'],
    ['__proto__', '__proto__'],
    // the edges are stripped the Python way before spaces become hyphens
    ['  a  ', 'a'],
    ['\u0085 a \u001c', 'a'],
    ['\ufeff a', '-a'],
  ];

  for (const [title, slug] of TABLE) {
    it(`${JSON.stringify(title)} gives ${JSON.stringify(slug)}`, () => {
      expect(pySlug(title)).toBe(slug);
    });
  }
});

describe('headingTitle', () => {
  it('joins text and code_inline children only: no raw HTML, image alt or break', () => {
    const children = [
      { type: 'text', content: 'a ' },
      { type: 'html_inline', content: '<sup>' },
      { type: 'text', content: '2' },
      { type: 'html_inline', content: '</sup>' },
      { type: 'softbreak', content: '' },
      { type: 'image', content: 'alt' },
      { type: 'footnote_ref', content: '' },
      { type: 'code_inline', content: 'c' },
      { type: 'strong_open', content: '' },
      { type: 'text', content: ' d' },
    ];
    expect(headingTitle(children)).toBe('a 2c d');
  });
});

/** The reference's unique_slug, restarting at 1 on every call. */
function referenceUnique(slug: string, taken: Set<string>): string {
  let uniq = slug;
  let i = 1;
  while (taken.has(uniq)) {
    uniq = `${slug}-${i}`;
    i += 1;
  }
  taken.add(uniq);
  return uniq;
}

/** A small seeded generator (mulberry32), so the random sequences are the same on every run. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('uniqueSlug', () => {
  const run = (slugs: readonly string[]): string[] => {
    const state = createSlugState();
    return slugs.map((s) => uniqueSlug(s, state));
  };

  it('gives the verified suffixes', () => {
    expect(run(['same', 'same', 'same', 'same-1'])).toEqual(['same', 'same-1', 'same-2', 'same-1-1']);
    expect(run(['a', 'a-1', 'a'])).toEqual(['a', 'a-1', 'a-2']);
    expect(run(['', '', '', ''])).toEqual(['', '-1', '-2', '-3']);
    expect(run(['constructor', 'constructor', '__proto__', '__proto__'])).toEqual([
      'constructor',
      'constructor-1',
      '__proto__',
      '__proto__-1',
    ]);
  });

  it("equals the reference's restart-from-1 loop on 50 random sequences of 1000 slugs from {a, a-1, a-2, b}", () => {
    const pool = ['a', 'a-1', 'a-2', 'b'];
    for (let seed = 1; seed <= 50; seed += 1) {
      const next = seeded(seed);
      const slugs = Array.from({ length: 1000 }, () => pool[Math.floor(next() * pool.length)] ?? 'a');
      const taken = new Set<string>();
      expect(run(slugs), `seed ${seed}`).toEqual(slugs.map((s) => referenceUnique(s, taken)));
    }
  });

  it('resumes from the last suffix: 2000 equal slugs take at most 4000 lookups, not 2 million', () => {
    let lookups = 0;
    class CountingSet extends Set<string> {
      override has(v: string): boolean {
        lookups += 1;
        return super.has(v);
      }
    }
    const state: SlugState = { taken: new CountingSet(), next: new Map() };
    const ids = Array.from({ length: 2000 }, () => uniqueSlug('a', state));
    expect(ids.at(-1)).toBe('a-1999');
    expect(lookups).toBeLessThanOrEqual(4000);
  });
});

describe('render: heading ids, meta.headings and meta.title', () => {
  it('sets id before data-line, on every level, with the verified suffixes', () => {
    const r = render('# Same\n\n## Same\n\n### Same\n\n#### Same-1\n\n# A\n\n# A-1\n\n# A\n\n#\n\n# !\n\n# ?\n');
    expect(r.html).toBe(
      '<h1 id="same" data-line="1-1">Same</h1>\n' +
        '<h2 id="same-1" data-line="3-3">Same</h2>\n' +
        '<h3 id="same-2" data-line="5-5">Same</h3>\n' +
        '<h4 id="same-1-1" data-line="7-7">Same-1</h4>\n' +
        '<h1 id="a" data-line="9-9">A</h1>\n' +
        '<h1 id="a-1" data-line="11-11">A-1</h1>\n' +
        '<h1 id="a-2" data-line="13-13">A</h1>\n' +
        '<h1 id="" data-line="15-15"></h1>\n' +
        '<h1 id="-1" data-line="17-17">!</h1>\n' +
        '<h1 id="-2" data-line="19-19">?</h1>\n',
    );
    expect(r.meta.headings.map((h) => `${h.level} ${h.id} ${h.text}`)).toEqual([
      '1 same Same',
      '2 same-1 Same',
      '3 same-2 Same',
      '4 same-1-1 Same-1',
      '1 a A',
      '1 a-1 A-1',
      '1 a-2 A',
      '1  ',
      '1 -1 !',
      '1 -2 ?',
    ]);
  });

  it('takes the title from text and code spans only, after inline parsing and text_join', () => {
    const r = render('# *em* **strong** [link](http://x) ![alt](i.png) `code` &amp; \\*\n');
    expect(r.html).toBe(
      '<h1 id="em-strong-link--code--" data-line="1-1"><em>em</em> <strong>strong</strong> ' +
        '<a href="http://x">link</a> <img src="i.png" alt="alt" /> <code>code</code> &amp; *</h1>\n',
    );
    expect(r.meta.headings).toEqual([{ level: 1, id: 'em-strong-link--code--', text: 'em strong link  code & *' }]);
  });

  it('meta.headings: level, id and the stripped (not lowered) title, in document order, nested ones included', () => {
    expect(render('# T\n\n## `c` x\n\n# Second\n').meta).toEqual({
      front: null,
      frontList: null,
      title: 'T',
      headings: [
        { level: 1, id: 't', text: 'T' },
        { level: 2, id: 'c-x', text: 'c x' },
        { level: 1, id: 'second', text: 'Second' },
      ],
      figures: 0,
      tables: 0,
      mermaidKinds: [],
    });
    expect(render('- # in list\n\n> ## in quote\n').meta.headings).toEqual([
      { level: 1, id: 'in-list', text: 'in list' },
      { level: 2, id: 'in-quote', text: 'in quote' },
    ]);
    expect(render('# \u3000Hello\u3000\n').meta.headings).toEqual([{ level: 1, id: 'hello', text: 'Hello' }]);
    expect(render('a\nb\n===\n\nc\n---\n').meta.headings).toEqual([
      { level: 1, id: 'ab', text: 'ab' },
      { level: 2, id: 'c', text: 'c' },
    ]);
  });

  it('meta.title is the first level-1 heading, else null', () => {
    expect(render('## pre\n\n# Main\n\n# Later\n').meta.title).toBe('Main');
    expect(render('## a\n\n### b\n').meta.title).toBeNull();
    expect(render('plain\n').meta).toMatchObject({ title: null, headings: [] });
  });

  it('strips the title the Python way: an image before it leaves " \\x85 a", which is slug and text "a"', () => {
    const r = render('# ![i](x.png) \u0085 a\n');
    expect(r.html).toBe('<h1 id="a" data-line="1-1"><img src="x.png" alt="i" /> \u0085 a</h1>\n');
    expect(r.meta.headings).toEqual([{ level: 1, id: 'a', text: 'a' }]);
    expect(render('# \ufeff a\n').meta.headings).toEqual([{ level: 1, id: '-a', text: '\ufeff a' }]);
  });

  it('object-property names are ordinary slugs', () => {
    const r = render('# `__proto__`\n\n# constructor\n\n# constructor\n\n# toString\n\n# `__proto__`\n');
    expect(r.meta.headings.map((h) => h.id)).toEqual([
      '__proto__',
      'constructor',
      'constructor-1',
      'tostring',
      '__proto__-1',
    ]);
  });

  it('ids do not depend on lineAttrs', () => {
    const src = '# Same\n\n# Same\n';
    expect(render(src, { lineAttrs: false }).html).toBe('<h1 id="same">Same</h1>\n<h1 id="same-1">Same</h1>\n');
    expect(render(src, { lineAttrs: false }).meta).toEqual(render(src).meta);
  });

  it('20000 equal headings get a, a-1, ..., a-19999', () => {
    const r = render('# a\n'.repeat(20000));
    expect(r.outcome).toBe('rendered');
    expect(r.meta.headings).toHaveLength(20000);
    expect(r.meta.headings.every((h, i) => h.id === (i === 0 ? 'a' : `a-${i}`))).toBe(true);
  });
});
