// The markdown-it instance behind render() (docserver L1, Task 3; architecture section C, "Engine").
// The options, the nesting limit and the enabled rule chains are pinned as lists, so a rule added, dropped
// or moved is a deliberate edit here. Later tasks extend these lists as they add rules: front_matter and
// safe_block_html in the block chain, safe_inline_html and the footnote rules in the inline chain, and
// footnote_tail, task_lists, anchors, balance_details, alerts, figcaption and table_code in the core chain,
// each before line_attrs.
import MarkdownIt from 'markdown-it';
import { describe, expect, it } from 'vitest';
import { createEngine } from '../src/render/engine.js';
import { createEnv } from '../src/render/env.js';

interface RuleEntry {
  name: string;
  enabled: boolean;
  alt: string[];
}

/** markdown-it's internal rule list (Ruler.__rules__), which its published types do not declare. */
function rules(ruler: unknown): RuleEntry[] {
  return (ruler as { __rules__: RuleEntry[] }).__rules__;
}
const enabled = (ruler: unknown): string[] => rules(ruler).filter((r) => r.enabled).map((r) => r.name);

describe('createEngine: options', () => {
  const md = createEngine();

  it('is the CommonMark preset with raw HTML, linkify, typographer and breaks off, and XHTML output', () => {
    expect(md.options).toEqual({
      html: false,
      xhtmlOut: true,
      breaks: false,
      langPrefix: 'language-',
      linkify: false,
      typographer: false,
      quotes: '“”‘’',
      highlight: null,
      maxNesting: 20,
    });
  });

  it('maxNesting is the preset 20', () => {
    expect((md.options as { maxNesting?: unknown }).maxNesting).toBe(20);
  });

  it("validateLink and normalizeLink are markdown-it's own", () => {
    const stock = new MarkdownIt('commonmark');
    expect(md.validateLink).toBe(stock.validateLink);
    expect(md.normalizeLink).toBe(stock.normalizeLink);
    expect(md.normalizeLinkText).toBe(stock.normalizeLinkText);
  });

  it('each call returns a separate instance', () => {
    expect(createEngine()).not.toBe(md);
  });
});

describe('createEngine: rule chains', () => {
  const md = createEngine();

  it('core: footnote_tail, task_lists before text_join; anchors to table_code after it; line_attrs last', () => {
    expect(enabled(md.core.ruler)).toEqual([
      'normalize',
      'block',
      'block_strip',
      'inline',
      'footnote_tail',
      'task_lists',
      'text_join',
      'anchors',
      'balance_details',
      'alerts',
      'figcaption',
      'table_code',
      'line_attrs',
    ]);
  });

  it('block: front_matter first, then table, CommonMark, footnote_def; safe_block_html before html_block', () => {
    expect(enabled(md.block.ruler)).toEqual([
      'front_matter',
      'table',
      'code',
      'fence',
      'blockquote',
      'hr',
      'list',
      'footnote_def',
      'reference',
      'safe_block_html',
      'html_block',
      'heading',
      'lheading',
      'paragraph',
    ]);
  });

  it("front_matter carries the reference plugin's alternatives", () => {
    const rule = rules(md.block.ruler).find((r) => r.name === 'front_matter');
    expect(rule?.alt).toEqual(['paragraph', 'reference', 'blockquote', 'list']);
  });

  it('safe_block_html interrupts a paragraph, a reference and a blockquote, and does not end a list', () => {
    const rule = rules(md.block.ruler).find((r) => r.name === 'safe_block_html');
    expect(rule?.alt).toEqual(['paragraph', 'reference', 'blockquote']);
  });

  it('inline: CommonMark plus strikethrough and the footnote rules; safe_inline_html before html_inline', () => {
    expect(enabled(md.inline.ruler)).toEqual([
      'text',
      'newline',
      'escape',
      'backticks',
      'strikethrough',
      'emphasis',
      'link',
      'image',
      'footnote_inline',
      'footnote_ref',
      'autolink',
      'safe_inline_html',
      'html_inline',
      'entity',
    ]);
    expect(enabled(md.inline.ruler2)).toEqual(['balance_pairs', 'strikethrough', 'emphasis', 'fragments_join']);
  });
});

describe('createEngine: the raw-HTML wall and links', () => {
  const md = createEngine();

  it('escapes raw HTML in block and inline position', () => {
    const src = '<script>alert(1)</script>\n\nx <b onclick="y">b</b>\n';
    expect(md.render(src, createEnv({ lineAttrs: true }))).toBe(
      '<p data-line="1-1">&lt;script&gt;alert(1)&lt;/script&gt;</p>\n' +
        '<p data-line="3-3">x &lt;b onclick=&quot;y&quot;&gt;b&lt;/b&gt;</p>\n',
    );
  });

  it('leaves javascript:, vbscript:, file: and non-image data: links as text', () => {
    const src = '[a](javascript:x) [b](vbscript:x) [c](file:///x) [d](data:text/html,x) [e](data:image/png;base64,AA)\n';
    expect(md.render(src, createEnv({ lineAttrs: true }))).toBe(
      '<p data-line="1-1">[a](javascript:x) [b](vbscript:x) [c](file:///x) [d](data:text/html,x) ' +
        '<a href="data:image/png;base64,AA">e</a></p>\n',
    );
  });

  it("puts only text, not a code span's content, into an image's alt (markdown-it 14, as the reference)", () => {
    expect(md.render('![a *b* `c`](x.png)\n', createEnv({ lineAttrs: true }))).toBe(
      '<p data-line="1-1"><img src="x.png" alt="a b " /></p>\n',
    );
  });
});

describe('line_attrs', () => {
  const md = createEngine();
  const SRC = '# H\n\n3. a\n4. b\n\n- c\n\n> q\n\n***\n\n    code\n\n| x |\n|---|\n| y |\n\n```\nf\n```\n';

  /** `type data-line` for every token that carries one, in order. */
  const marked = (lineAttrs: boolean): string[] =>
    md
      .parse(SRC, createEnv({ lineAttrs }))
      .filter((t) => t.attrGet('data-line') !== null)
      .map((t) => `${t.type} ${t.attrGet('data-line') ?? ''}`);

  it("marks every block type of the reference's set, 1-based and inclusive, and nothing else", () => {
    expect(marked(true)).toEqual([
      'heading_open 1-1',
      'ordered_list_open 3-5',
      'list_item_open 3-3',
      'paragraph_open 3-3',
      'list_item_open 4-5',
      'paragraph_open 4-4',
      'bullet_list_open 6-7',
      'list_item_open 6-7',
      'paragraph_open 6-6',
      'blockquote_open 8-8',
      'paragraph_open 8-8',
      'hr 10-10',
      'code_block 12-12',
      'table_open 14-16',
      'tr_open 14-14',
      'tr_open 16-16',
    ]);
  });

  it('sets data-line after every other attribute of the token', () => {
    const tokens = md.parse(SRC, createEnv({ lineAttrs: true })).filter((t) => t.attrs !== null);
    expect(tokens.filter((t) => t.attrs?.at(-1)?.[0] !== 'data-line').map((t) => t.type)).toEqual([]);
    expect(md.render('3. a\n', createEnv({ lineAttrs: true }))).toBe(
      '<ol start="3" data-line="1-1">\n<li data-line="1-1">a</li>\n</ol>\n',
    );
  });

  it('marks nothing when the env says lineAttrs: false', () => {
    expect(marked(false)).toEqual([]);
  });
});
