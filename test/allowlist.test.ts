// The raw-HTML allowlist and details balancing (docserver L1, Task 5; architecture section C, "The raw-HTML
// allowlist and its rules" and the `balance_details` row; contract sections 2.1-2.3). Every expected html
// string below was produced by the reference renderer from the same input, except in the three blocks that
// say otherwise: the ASCII-only tag names and the nesting cap, where this library deliberately differs (each
// block also holds the reference's own output), and the linear-time inputs, whose output follows from small
// cases of the same shape (the reference takes quadratic time there).
import { describe, expect, it } from 'vitest';
import { ALLOWLIST, COMMENT_ID, DETAILS_LINE, INLINE_TAG } from '../src/render/allowlist.js';
import { MAX_TAG_DEPTH } from '../src/render/details.js';
import { ALLOWLIST as PUBLIC_ALLOWLIST, render } from '../src/render/index.js';
import { PY_WS } from '../src/render/pyText.js';

type Case = readonly [name: string, src: string, html: string];

function cases(list: readonly Case[]): void {
  for (const [name, src, html] of list) {
    it(name, () => {
      expect(render(src).html).toBe(html);
    });
  }
}

describe('ALLOWLIST', () => {
  it('is exactly the allowlist, frozen at every level, and the one ./render exports', () => {
    expect(ALLOWLIST).toEqual({
      inlineTags: ['br', 'sup', 'sub', 'kbd'],
      blockLines: ['<details>', '<details open>', '</details>', '<summary>…</summary>'],
      anchorId: '[A-Za-z0-9_-]{1,100}',
    });
    expect(Object.isFrozen(ALLOWLIST)).toBe(true);
    expect(Object.isFrozen(ALLOWLIST.inlineTags)).toBe(true);
    expect(Object.isFrozen(ALLOWLIST.blockLines)).toBe(true);
    expect(PUBLIC_ALLOWLIST).toBe(ALLOWLIST);
  });

  it("the rules' patterns are built from it and from PY_WS, never from copies", () => {
    expect(COMMENT_ID.source).toContain(`(${ALLOWLIST.anchorId})`);
    expect(COMMENT_ID.source).toContain(`[${PY_WS}]*`);
    expect(COMMENT_ID.flags).toBe('');
    expect(INLINE_TAG.source).toContain(`(${ALLOWLIST.inlineTags.slice(1).join('|')})`);
    expect(INLINE_TAG.source).toContain(`${ALLOWLIST.inlineTags[0]}[${PY_WS}]*`);
    expect(INLINE_TAG.flags).toBe('iy');
    expect(DETAILS_LINE.source).toContain(`[${PY_WS}]+open`);
    expect(DETAILS_LINE.flags).toBe('i');
  });
});

describe('inline: safe_inline_html', () => {
  cases([
    [
      '<br> in every accepted form, Python whitespace included, is a hard break',
      'a<br>b<BR/>c<br />d<br\t>e<Br  />f<br\u00a0>g<br\u000c>h\n',
      '<p data-line="1-1">a<br />\nb<br />\nc<br />\nd<br />\ne<br />\nf<br />\ng<br />\nh</p>\n',
    ],
    [
      'any other br form is text',
      'a<br / >b<br onload=x>c<br/ >d<brx>e\n',
      '<p data-line="1-1">a&lt;br / &gt;b&lt;br onload=x&gt;c&lt;br/ &gt;d&lt;brx&gt;e</p>\n',
    ],
    [
      'bare sup, sub, kbd and closers, lower-cased, unbalanced allowed',
      '<sup>1</sup><SUB>2</SUB><Kbd>K</kBD> x </sup> <sup>open\n',
      '<p data-line="1-1"><sup>1</sup><sub>2</sub><kbd>K</kbd> x </sup> <sup>open</p>\n',
    ],
    [
      'any attribute or space makes the tag text, and its closer still passes',
      '<sup class="x">a</sup> <kbd/onmouseover=x>b</kbd> <sup >c</sup> <sub\t>d\n',
      '<p data-line="1-1">&lt;sup class=&quot;x&quot;&gt;a</sup> &lt;kbd/onmouseover=x&gt;b</kbd> ' +
        '&lt;sup &gt;c</sup> &lt;sub\t&gt;d</p>\n',
    ],
    [
      'every other tag is text, details and summary included',
      '<b>b</b> <i>i</i> <script>s</script> <img src=x> <summary>s</summary> <details>\n',
      '<p data-line="1-1">&lt;b&gt;b&lt;/b&gt; &lt;i&gt;i&lt;/i&gt; &lt;script&gt;s&lt;/script&gt; ' +
        '&lt;img src=x&gt; &lt;summary&gt;s&lt;/summary&gt; &lt;details&gt;</p>\n',
    ],
    [
      'comments vanish, multi-line ones and id comments too',
      'a <!-- c --> b <!--\nmulti\n--> c <!-- id:Q --> d\n',
      '<p data-line="1-3">a  b  c  d</p>\n',
    ],
    [
      'a comment ends at the first --> after its <!--; an unterminated one is text',
      'a <!--> b --> c\n\nd <!---> e\n\nf <!-- unterminated\n',
      '<p data-line="1-1">a  c</p>\n<p data-line="3-3">d &lt;!---&gt; e</p>\n<p data-line="5-5">f &lt;!-- unterminated</p>\n',
    ],
    [
      'code spans are untouched',
      '`<sup>x</sup> <br> <!-- c -->` <sup>y</sup>\n',
      '<p data-line="1-1"><code>&lt;sup&gt;x&lt;/sup&gt; &lt;br&gt; &lt;!-- c --&gt;</code> <sup>y</sup></p>\n',
    ],
    [
      'inside link text, where a comment hides a ] from the label',
      '[a <!-- ] --> b](u) [c<br>d](v) [<sup>e</sup>](w)\n',
      '<p data-line="1-1"><a href="u">a  b</a> <a href="v">c<br />\nd</a> <a href="w"><sup>e</sup></a></p>\n',
    ],
    [
      'in a heading, where none of it enters the id',
      '# a<br>b <sup>2</sup> <!-- c -->\n',
      '<h1 id="ab-2" data-line="1-1">a<br />\nb <sup>2</sup> </h1>\n',
    ],
    ['a run of unterminated comments is text', '<!-- '.repeat(3), '<p data-line="1-1">&lt;!-- &lt;!-- &lt;!--</p>\n'],
  ]);
});

describe('block: comment anchors', () => {
  cases([
    [
      'id comments alone on their lines, with Python whitespace inside, multi-line too',
      '<!-- id:R14 -->\n\n<!--id:A-->\n\n<!--\tid:t\t-->\n\n<!--\u3000id:w\u2028-->\n\n<!--\nid:m\n-->\n\n<!-- id:F-3_x -->\n',
      '<span class="doc-anchor" id="R14"></span>\n<span class="doc-anchor" id="A"></span>\n' +
        '<span class="doc-anchor" id="t"></span>\n<span class="doc-anchor" id="w"></span>\n' +
        '<span class="doc-anchor" id="m"></span>\n<span class="doc-anchor" id="F-3_x"></span>\n',
    ],
    [
      'an id of 100 characters is kept, one of 101 dropped',
      `<!-- id:${'a'.repeat(100)} -->\n\n<!-- id:${'b'.repeat(101)} -->\n`,
      `<span class="doc-anchor" id="${'a'.repeat(100)}"></span>\n`,
    ],
    [
      'every other comment alone on its lines is dropped',
      '<!-- id: bad id -->\n\n<!-- id:"><script> -->\n\n<!-- id:x onmouseover=y -->\n\n<!-- id:a -- > -->\n\n' +
        '<!-- ID:upper -->\n\n<!-- id:\u0430dmin -->\n\n<!-- plain -->\n',
      '',
    ],
    [
      'Python whitespace may follow -->, anything else makes it inline',
      '<!-- id:t -->   \n\n<!-- id:u -->\u3000\u0085\n\n<!-- id:v --> x\n\n<!-- id:w --><b>\n',
      '<span class="doc-anchor" id="t"></span>\n<span class="doc-anchor" id="u"></span>\n' +
        '<p data-line="5-5"> x</p>\n<p data-line="7-7">&lt;b&gt;</p>\n',
    ],
    [
      'unterminated, it is paragraph text',
      '<!-- id:a\n\nafter\n',
      '<p data-line="1-1">&lt;!-- id:a</p>\n<p data-line="3-3">after</p>\n',
    ],
    [
      'unterminated at the end of the document',
      'text\n\n<!-- id:z',
      '<p data-line="1-1">text</p>\n<p data-line="3-3">&lt;!-- id:z</p>\n',
    ],
    [
      'indent 3 is an anchor, indent 4 is code',
      '   <!-- id:i3 -->\n\n    <!-- id:i4 -->\n',
      '<span class="doc-anchor" id="i3"></span>\n<pre data-line="3-3"><code>&lt;!-- id:i4 --&gt;\n</code></pre>\n',
    ],
    [
      'it interrupts a paragraph',
      'para\n<!-- id:X -->\nmore\n',
      '<p data-line="1-1">para</p>\n<span class="doc-anchor" id="X"></span>\n<p data-line="3-3">more</p>\n',
    ],
    [
      'in a list item and in a blockquote',
      '- <!-- id:LI -->\n- text\n\n> <!-- id:BQ -->\n> text\n',
      '<ul data-line="1-3">\n<li data-line="1-1">\n<span class="doc-anchor" id="LI"></span>\n</li>\n' +
        '<li data-line="2-3">text</li>\n</ul>\n<blockquote data-line="4-5">\n' +
        '<span class="doc-anchor" id="BQ"></span>\n<p data-line="5-5">text</p>\n</blockquote>\n',
    ],
    [
      'text after a multi-line comment makes the whole comment inline',
      '<!-- id:a\n--> x\n\n<!-- id:b\n-->\n',
      '<p data-line="1-2"> x</p>\n<span class="doc-anchor" id="b"></span>\n',
    ],
    ['a line that starts with whitespace other than spaces is a paragraph', '\u3000<!-- id:ws -->\n', '<p data-line="1-1"></p>\n'],
    ['<!-->, <!---> and <!-- -- --> alone on a line are dropped', '<!-->\n\n<!--->\n\n<!-- -- -->\n', ''],
    ['lines of unterminated comments are one paragraph', '<!--\n<!--\n<!--\n', '<p data-line="1-3">&lt;!--\n&lt;!--\n&lt;!--</p>\n'],
    [
      'it ends a reference definition',
      '[x]: /u\n<!-- id:r -->\n\n[x]\n',
      '<span class="doc-anchor" id="r"></span>\n<p data-line="4-4"><a href="/u">x</a></p>\n',
    ],
    [
      'it ends a paragraph before a setext underline',
      'Title\n<!-- id:h -->\n===\n',
      '<p data-line="1-1">Title</p>\n<span class="doc-anchor" id="h"></span>\n<p data-line="3-3">===</p>\n',
    ],
    [
      'an anchor after a blockquote that a details line ends (the first search came from inside the quote)',
      '> - x\n> <!-- id:a -->\n<summary>s</summary>\n<!-- id:b -->\n',
      '<blockquote data-line="1-2">\n<ul data-line="1-1">\n<li data-line="1-1">x</li>\n</ul>\n' +
        '<span class="doc-anchor" id="a"></span>\n</blockquote>\n<summary>s</summary>\n' +
        '<span class="doc-anchor" id="b"></span>\n',
    ],
    [
      'anchors after quotes ended by details lines, multi-line, and in a quote in a list item',
      '> <!-- id:a -->\n<details>\n<!-- id:b\n-->\n\n- > <!-- id:c -->\n</details>\n<!-- id:d -->\n',
      '<blockquote data-line="1-1">\n<span class="doc-anchor" id="a"></span>\n</blockquote>\n<details>\n' +
        '<span class="doc-anchor" id="b"></span>\n<ul data-line="6-6">\n<li data-line="6-6">\n' +
        '<blockquote data-line="6-6">\n<span class="doc-anchor" id="c"></span>\n</blockquote>\n</li>\n</ul>\n' +
        '</details>\n<span class="doc-anchor" id="d"></span>\n',
    ],
  ]);
});

describe('block: details lines', () => {
  cases([
    [
      'the four forms, any ASCII case',
      '<details>\n<summary>S</summary>\n\nbody\n\n</details>\n\n<details open>\n</details>\n\n<DETAILS OPEN>\n</Details>\n',
      '<details>\n<summary>S</summary>\n<p data-line="4-4">body</p>\n</details>\n' +
        '<details open>\n</details>\n<details open>\n</details>\n',
    ],
    [
      'open after any Python whitespace, and nothing after it',
      '<details\topen>\n</details>\n\n<details\u00a0open>\n</details>\n\n<details  open>\n</details>\n\n' +
        '<details open >\n</details>\n\n<detailsopen>\n',
      '<details open>\n</details>\n<details open>\n</details>\n<details open>\n</details>\n' +
        '<p data-line="10-10">&lt;details open &gt;</p>\n<p data-line="13-13">&lt;detailsopen&gt;</p>\n',
    ],
    [
      'attributes, two tags on a line, or text after the summary make it text',
      '<details class="x">\n\n<details ontoggle=x open>\n\n<details><summary>x</summary>\n\n<summary>a</summary>b\n',
      '<p data-line="1-1">&lt;details class=&quot;x&quot;&gt;</p>\n<p data-line="3-3">&lt;details ontoggle=x open&gt;</p>\n' +
        '<p data-line="5-5">&lt;details&gt;&lt;summary&gt;x&lt;/summary&gt;</p>\n' +
        '<p data-line="7-7">&lt;summary&gt;a&lt;/summary&gt;b</p>\n',
    ],
    [
      "summary text is escaped the Python way: ' becomes &#x27;, and entities are not decoded",
      '<details>\n<summary>a "q" \'x\' &amp; <i>i</i> & <script></summary>\n</details>\n',
      '<details>\n<summary>a &quot;q&quot; &#x27;x&#x27; &amp;amp; &lt;i&gt;i&lt;/i&gt; &amp; &lt;script&gt;</summary>\n</details>\n',
    ],
    [
      'summary text runs to the last </summary>, and may be empty',
      '<details>\n<summary>a</summary>b</summary>\n<summary></summary>\n<SUMMARY>Up</SUMMARY>\n</details>\n',
      '<details>\n<summary>a&lt;/summary&gt;b</summary>\n<summary></summary>\n<summary>Up</summary>\n</details>\n',
    ],
    [
      'summary text may hold U+2028, U+2029 and U+0085',
      '<details>\n<summary>a\u2028b\u2029c\u0085d</summary>\n</details>\n',
      '<details>\n<summary>a\u2028b\u2029c\u0085d</summary>\n</details>\n',
    ],
    ['the line is stripped the Python way', '\u3000<details>\u3000\n\u0085</details>\u000b\n', '<details>\n</details>\n'],
    [
      'indent 3 is a details line, indent 4 is code',
      '   <details>\n   </details>\n\n    <details>\n',
      '<details>\n</details>\n<pre data-line="4-4"><code>&lt;details&gt;\n</code></pre>\n',
    ],
    [
      'it interrupts a paragraph',
      'para\n<details>\n<summary>S</summary>\n\nx\n\n</details>\n',
      '<p data-line="1-1">para</p>\n<details>\n<summary>S</summary>\n<p data-line="5-5">x</p>\n</details>\n',
    ],
    [
      "it ends a blockquote's lazy continuation",
      '> a\n<details>\n</details>\n',
      '<blockquote data-line="1-1">\n<p data-line="1-1">a</p>\n</blockquote>\n<details>\n</details>\n',
    ],
    [
      "at indent 4 it is a blockquote's lazy continuation, not the end of the blockquote",
      '> a\n    <details>\n\n> b\n    <!-- id:x -->\n\n> c\n   <details>\n',
      '<blockquote data-line="1-2">\n<p data-line="1-2">a\n&lt;details&gt;</p>\n</blockquote>\n' +
        '<blockquote data-line="4-5">\n<p data-line="4-5">b\n</p>\n</blockquote>\n' +
        '<blockquote data-line="7-7">\n<p data-line="7-7">c</p>\n</blockquote>\n<details open>\n</details>\n',
    ],
    [
      'it does not end a list item',
      '- a\n  <details>\n- b\n',
      '<ul data-line="1-3">\n<li data-line="1-2">a<details open>\n</li>\n<li data-line="3-3">b</li>\n</ul>\n</details>\n',
    ],
  ]);
});

describe('block: details lines and tables', () => {
  it('a details line ends a table (Task 8 wraps the table; the reference wraps it already)', () => {
    expect(render('| a |\n|---|\n| b |\n<details>\n</details>\n').html).toMatch(
      /<td>b<\/td>\n<\/tr>\n<\/tbody>\n<\/table>(?:<\/div>)?\n<details>\n<\/details>\n$/,
    );
  });
});

describe('balance_details', () => {
  cases([
    [
      'a closer with nothing open renders nothing',
      '</details>\n\n<details>\n</details>\n</details>\n\ntext\n',
      '<details>\n</details>\n<p data-line="7-7">text</p>\n',
    ],
    [
      'an unclosed details is forced open and closed at the end',
      '<details>\n<summary>u</summary>\n\nrest\n',
      '<details open>\n<summary>u</summary>\n<p data-line="4-4">rest</p>\n</details>\n',
    ],
    [
      'across nesting levels: one stream, closers after everything',
      '<details>\n<details open>\n</details>\n\n> <details>\n> q\n\nend\n',
      '<details open>\n<details open>\n</details>\n<blockquote data-line="5-6">\n<details open>\n' +
        '<p data-line="6-6">q</p>\n</blockquote>\n<p data-line="8-8">end</p>\n</details>\n</details>\n',
    ],
    [
      'an unclosed details in a blockquote closes at the end of the document',
      '> <details>\n> <summary>s</summary>\n\nafter\n',
      '<blockquote data-line="1-2">\n<details open>\n<summary>s</summary>\n</blockquote>\n' +
        '<p data-line="4-4">after</p>\n</details>\n',
    ],
    [
      'details lines in tight list items',
      '1. <details>\n2. </details>\n',
      '<ol data-line="1-2">\n<li data-line="1-1">\n<details>\n</li>\n<li data-line="2-2">\n</details>\n</li>\n</ol>\n',
    ],
  ]);

  it('10000 stray closers render nothing', () => {
    expect(render('</details>\n'.repeat(10000)).html).toBe('');
  });
});

describe('nesting is capped at 64 levels per tag kind (this library, deliberately unlike the reference)', () => {
  // Departure PD8 (ruling C21). The reference nests without end: 10000 unclosed <details> lines became 10000
  // nested <details open>, deep enough to overflow a consumer's recursive walk. Here an opener past 64 open
  // levels of its kind is escaped text, and so is the closer that pairs with it, so the html stays balanced.
  // No ordinary document comes near it, and no golden moves.
  it('10000 unclosed details: 64 forced open and closed at the end, the rest escaped text', () => {
    const reference = '<details open>\n'.repeat(10000) + '</details>\n'.repeat(10000);
    const html = render('<details>\n'.repeat(10000)).html;
    expect(MAX_TAG_DEPTH).toBe(64);
    expect(html).toBe('<details open>\n'.repeat(64) + '&lt;details&gt;\n'.repeat(9936) + '</details>\n'.repeat(64));
    expect(html).not.toBe(reference);
  });

  it('65 nested details: the 65th and the closer that pairs with it are text, the rest pair as written', () => {
    const reference = '<details>\n'.repeat(65) + '</details>\n'.repeat(65);
    const html = render('<details>\n'.repeat(65) + '</details>\n'.repeat(65)).html;
    expect(html).toBe(
      '<details>\n'.repeat(64) + '&lt;details&gt;\n&lt;/details&gt;\n' + '</details>\n'.repeat(64),
    );
    expect(html).not.toBe(reference);
  });

  it('65 nested sup: the 65th and the closer that pairs with it are text', () => {
    const reference = `<p data-line="1-1">${'<sup>'.repeat(65)}x${'</sup>'.repeat(65)}</p>\n`;
    const html = render(`${'<sup>'.repeat(65)}x${'</sup>'.repeat(65)}\n`).html;
    expect(html).toBe(`<p data-line="1-1">${'<sup>'.repeat(64)}&lt;sup&gt;x&lt;/sup&gt;${'</sup>'.repeat(64)}</p>\n`);
    expect(html).not.toBe(reference);
  });

  it('each kind has its own 64 levels', () => {
    const html = render(`${'<sup>'.repeat(65)}${'<sub>'.repeat(65)}${'<kbd>'.repeat(65)}x\n`).html;
    expect(html).toBe(
      `<p data-line="1-1">${'<sup>'.repeat(64)}&lt;sup&gt;${'<sub>'.repeat(64)}&lt;sub&gt;` +
        `${'<kbd>'.repeat(64)}&lt;kbd&gt;x</p>\n`,
    );
  });

  it('the count spans the document: the 65th unclosed sup is text in its own paragraph too', () => {
    const html = render('<sup>a\n\n'.repeat(65)).html;
    const para = (k: number, body: string): string => `<p data-line="${2 * k + 1}-${2 * k + 1}">${body}a</p>\n`;
    expect(html).toBe(Array.from({ length: 64 }, (_, k) => para(k, '<sup>')).join('') + para(64, '&lt;sup&gt;'));
  });

  it("an image's alt text renders no tag, so its sup does not count", () => {
    const image = '<img src="x" alt="&lt;sup&gt;" />';
    const html = render(`${'![<sup>](x) '.repeat(100)}${'<sup>'.repeat(64)}y\n`).html;
    expect(html).toBe(`<p data-line="1-1">${`${image} `.repeat(100)}${'<sup>'.repeat(64)}y</p>\n`);
  });
});

describe('ASCII-only tag names (this library, deliberately unlike the reference)', () => {
  // The reference's Python re.I lets U+0130 and U+0131 match i, U+212A k and U+017F s: it emits the author's
  // raw <U+017Fup> tag and reads <U+017Fummary>x</U+017Fummary> as a <details> line. Here only ASCII letters
  // fold, so these stay text; no corpus case holds them.
  cases([
    [
      'inline: look-alike letters are text',
      '<\u017fup>x</\u017fup> <\u212abd>y</\u212abd> <sub>z</sub>\n',
      '<p data-line="1-1">&lt;\u017fup&gt;x&lt;/\u017fup&gt; &lt;\u212abd&gt;y&lt;/\u212abd&gt; <sub>z</sub></p>\n',
    ],
    [
      'block: look-alike letters are text',
      '<deta\u0130ls>\n\n<\u017fummary>s</\u017fummary>\n\n</deta\u0131ls>\n',
      '<p data-line="1-1">&lt;deta\u0130ls&gt;</p>\n<p data-line="3-3">&lt;\u017fummary&gt;s&lt;/\u017fummary&gt;</p>\n' +
        '<p data-line="5-5">&lt;/deta\u0131ls&gt;</p>\n',
    ],
  ]);
});

describe('comment search is linear (the reference rescans to the end from every <!--)', () => {
  // The output follows from 'lines of unterminated comments are one paragraph' and 'a run of unterminated
  // comments is text' above. The bound is a backstop: measured while planning, these take under 0.6 s here
  // and over 20 s each when the search restarts at every <!--, as the reference's does.
  it('20000 lines of unterminated <!-- render in under 5 s', () => {
    const n = 20_000;
    const started = performance.now();
    const html = render('<!--\n'.repeat(n)).html;
    expect(performance.now() - started).toBeLessThan(5000);
    expect(html).toBe(`<p data-line="1-${n}">${'&lt;!--\n'.repeat(n - 1)}&lt;!--</p>\n`);
  });

  it('40000 unterminated <!-- in one paragraph render in under 5 s', () => {
    const n = 40_000;
    const started = performance.now();
    const html = render('<!-- '.repeat(n)).html;
    expect(performance.now() - started).toBeLessThan(5000);
    expect(html).toBe(`<p data-line="1-1">${'&lt;!-- '.repeat(n - 1)}&lt;!--</p>\n`);
  });

  it('40000 images whose alt text opens a comment, each followed by an unterminated <!--, render in under 5 s', () => {
    // An image's alt text is parsed in an inline state of its own; its search must not evict the paragraph's.
    const n = 40_000;
    const started = performance.now();
    const html = render('![<!--](b) <!-- '.repeat(n)).html;
    expect(performance.now() - started).toBeLessThan(5000);
    const image = '<img src="b" alt="&lt;!--" /> &lt;!--';
    expect(html).toBe(`<p data-line="1-1">${`${image} `.repeat(n - 1)}${image}</p>\n`);
  });

  it('4000 <!-- lines that all reach one long closing line render in under 5 s', () => {
    // Every <!-- line's silent probe reaches the same closing line; its `-->` and the text after it are read once.
    const n = 4000;
    const m = 40_000;
    const started = performance.now();
    const html = render(`${'<!--\n'.repeat(n)}${'x'.repeat(m)}-->${' '.repeat(m)}y\n`).html;
    expect(performance.now() - started).toBeLessThan(5000);
    expect(html).toBe(`<p data-line="1-${n + 1}">${' '.repeat(m)}y</p>\n`);
  });
});
