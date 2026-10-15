// Tables (docserver L1, Task 8; architecture section C, the "Tables" row; contract section 2.9).
// Every expected html string in the first block was produced by the reference renderer from the same input
// and is compared after normaliseForCompare (it only touches code blocks). The reference parses tables with
// a Python port of markdown-it's table rule, which strips the Python way, then rewrites its finished HTML
// twice: `\|` in a table's code spans, and the wrapper around every table. This library ports the rule
// with Python's strip and makes both rewrites on the token stream (tables.ts); these cases pin that the
// two agree. The later block pins this library's own parts.
import { describe, expect, it } from 'vitest';
import { normaliseForCompare } from '../src/conformance/normalise.js';
import { checkOutputSafety } from '../src/conformance/oracle.js';
import { createEngine } from '../src/render/engine.js';
import { render } from '../src/render/index.js';
import { pyTable, renderTableClose, renderTableOpen, tableCode } from '../src/render/tables.js';

type Case = readonly [name: string, src: string, html: string];

function cases(list: readonly Case[]): void {
  for (const [name, src, html] of list) {
    it(name, () => {
      expect(normaliseForCompare(render(src).html)).toBe(html);
    });
  }
}

interface RuleEntry {
  name: string;
  fn: unknown;
  alt: string[];
}

/** markdown-it's internal rule list (Ruler.__rules__), which its published types do not declare. */
function rules(ruler: unknown): RuleEntry[] {
  return (ruler as { __rules__: RuleEntry[] }).__rules__;
}

describe('tables: against the reference', () => {
  cases([
    [
      'the wrapper, the alignments, data-line on the table and its rows; short rows padded, long rows cut',
      '| a | b | c |\n|:--|:-:|--:|\n| 1 |\n| 1 | 2 | 3 | 4 |\n',
      '<div class="table-wrapper"><table data-line="1-4">\n<thead>\n<tr data-line="1-1">\n' +
        '<th style="text-align:left">a</th>\n<th style="text-align:center">b</th>\n' +
        '<th style="text-align:right">c</th>\n</tr>\n</thead>\n<tbody>\n<tr data-line="3-3">\n' +
        '<td style="text-align:left">1</td>\n<td style="text-align:center"></td>\n' +
        '<td style="text-align:right"></td>\n</tr>\n<tr data-line="4-4">\n' +
        '<td style="text-align:left">1</td>\n<td style="text-align:center">2</td>\n' +
        '<td style="text-align:right">3</td>\n</tr>\n</tbody>\n</table></div>\n',
    ],
    [
      'no outer pipes, one column, and a table right after a paragraph line',
      'a | b\n--|--\n1 | 2\n\n|a|\n|-|\n|b|\n\npara\n| x |\n|---|\n| y |\n',
      '<div class="table-wrapper"><table data-line="1-3">\n<thead>\n<tr data-line="1-1">\n' +
        '<th>a</th>\n<th>b</th>\n</tr>\n</thead>\n<tbody>\n<tr data-line="3-3">\n<td>1</td>\n<td>2</td>\n' +
        '</tr>\n</tbody>\n</table></div>\n<div class="table-wrapper"><table data-line="5-7">\n<thead>\n' +
        '<tr data-line="5-5">\n<th>a</th>\n</tr>\n</thead>\n<tbody>\n<tr data-line="7-7">\n<td>b</td>\n' +
        '</tr>\n</tbody>\n</table></div>\n<p data-line="9-9">para</p>\n' +
        '<div class="table-wrapper"><table data-line="10-12">\n<thead>\n<tr data-line="10-10">\n<th>x</th>\n' +
        '</tr>\n</thead>\n<tbody>\n<tr data-line="12-12">\n<td>y</td>\n</tr>\n</tbody>\n</table></div>\n',
    ],
    [
      'in a table only, a code span\'s \\| becomes |; an escaped pipe splits no cell',
      '| a | b | c |\n|---|---|---|\n| `x\\|y` | `a\\\\|b` | p\\|q |\n' +
        '| `a\\\\\\|b` | `\\\\|` | <br> |\n\n`a\\\\|b` outside\n',
      '<div class="table-wrapper"><table data-line="1-4">\n<thead>\n<tr data-line="1-1">\n' +
        '<th>a</th>\n<th>b</th>\n<th>c</th>\n</tr>\n</thead>\n<tbody>\n<tr data-line="3-3">\n' +
        '<td><code>x|y</code></td>\n<td><code>a|b</code></td>\n<td>p|q</td>\n</tr>\n<tr data-line="4-4">\n' +
        '<td><code>a\\|b</code></td>\n<td><code>|</code></td>\n<td><br />\n</td>\n</tr>\n</tbody>\n' +
        '</table></div>\n<p data-line="6-6"><code>a\\\\|b</code> outside</p>\n',
    ],
    [
      'Python whitespace at a cell edge is stripped; U+FEFF is kept',
      '| \u0085a\u001c | \ufeffb\ufeff |\n|---|---|\n|\u001fc\u0085|\u3000d\u00a0|\n',
      '<div class="table-wrapper"><table data-line="1-3">\n<thead>\n<tr data-line="1-1">\n' +
        '<th>a</th>\n<th>\ufeffb\ufeff</th>\n</tr>\n</thead>\n<tbody>\n<tr data-line="3-3">\n<td>c</td>\n' +
        '<td>d</td>\n</tr>\n</tbody>\n</table></div>\n',
    ],
    [
      'Python whitespace at a line edge: a \\x85 before the header pipe still makes a table, a U+FEFF does ' +
        'not, and a line of \\x85 ends a table',
      '\u0085| a | b |\u0085\n|---|---|\n| c | d |\n\u0085\nafter\n\n\ufeff| e |\n|---|\n',
      '<div class="table-wrapper"><table data-line="1-3">\n<thead>\n<tr data-line="1-1">\n' +
        '<th>a</th>\n<th>b</th>\n</tr>\n</thead>\n<tbody>\n<tr data-line="3-3">\n<td>c</td>\n<td>d</td>\n' +
        '</tr>\n</tbody>\n</table></div>\n<p data-line="4-5">after</p>\n<p data-line="7-8">\ufeff| e |\n' +
        '|---|</p>\n',
    ],
    [
      'after a tight list item\'s paragraph, in a blockquote and in an alert',
      '- a\n  | x |\n  |---|\n  | y |\n- b\n\n> | q |\n> |---|\n\n> [!TIP]\n> | t |\n> |---|\n' +
        '> | `a\\\\|b` |\n',
      '<ul data-line="1-6">\n<li data-line="1-4">a\n' +
        '<div class="table-wrapper"><table data-line="2-4">\n<thead>\n<tr data-line="2-2">\n<th>x</th>\n' +
        '</tr>\n</thead>\n<tbody>\n<tr data-line="4-4">\n<td>y</td>\n</tr>\n</tbody>\n</table></div>\n</li>\n' +
        '<li data-line="5-6">b</li>\n</ul>\n<blockquote data-line="7-8">\n' +
        '<div class="table-wrapper"><table data-line="7-8">\n<thead>\n<tr data-line="7-7">\n<th>q</th>\n' +
        '</tr>\n</thead>\n</table></div>\n</blockquote>\n' +
        '<div class="gh-alert gh-tip" data-line="10-13"><p class="gh-alert-title">Tip</p>\n' +
        '<div class="table-wrapper"><table data-line="11-13">\n<thead>\n<tr data-line="11-11">\n<th>t</th>\n' +
        '</tr>\n</thead>\n<tbody>\n<tr data-line="13-13">\n<td><code>a|b</code></td>\n</tr>\n</tbody>\n' +
        '</table></div>\n</div>\n',
    ],
    [
      'a table ends at a blockquote, a list or an anchor; a row indented four is not a row',
      '| a |\n|---|\n> q\n\n| b |\n|---|\n- l\n\n| c |\n|---|\n<!-- id:x -->\n\n| d |\n|---|\n' +
        '    | code |\n',
      '<div class="table-wrapper"><table data-line="1-2">\n<thead>\n<tr data-line="1-1">\n' +
        '<th>a</th>\n</tr>\n</thead>\n</table></div>\n<blockquote data-line="3-3">\n' +
        '<p data-line="3-3">q</p>\n</blockquote>\n<div class="table-wrapper"><table data-line="5-6">\n' +
        '<thead>\n<tr data-line="5-5">\n<th>b</th>\n</tr>\n</thead>\n</table></div>\n<ul data-line="7-8">\n' +
        '<li data-line="7-8">l</li>\n</ul>\n<div class="table-wrapper"><table data-line="9-10">\n<thead>\n' +
        '<tr data-line="9-9">\n<th>c</th>\n</tr>\n</thead>\n</table></div>\n' +
        '<span class="doc-anchor" id="x"></span>\n<div class="table-wrapper"><table data-line="13-14">\n' +
        '<thead>\n<tr data-line="13-13">\n<th>d</th>\n</tr>\n</thead>\n</table></div>\n' +
        '<pre data-line="15-15"><code>| code |\n</code></pre>\n',
    ],
    [
      'cells hold inline markup, the allowlist, comments, images and footnote references',
      '| a | b |\n|---|---|\n' +
        '| **b** <sup>s</sup> <!-- c --> | ![i](x.png "t") x[^1] ^[in `a\\\\|b`] |\n\n[^1]: note `a\\\\|b`\n',
      '<div class="table-wrapper"><table data-line="1-3">\n<thead>\n<tr data-line="1-1">\n' +
        '<th>a</th>\n<th>b</th>\n</tr>\n</thead>\n<tbody>\n<tr data-line="3-3">\n' +
        '<td><strong>b</strong> <sup>s</sup> </td>\n' +
        '<td><img src="x.png" alt="i" title="t" /> x<sup class="footnote-ref"><a href="#fn1" ' +
        'id="fnref1">[1]</a></sup> <sup class="footnote-ref"><a href="#fn2" id="fnref2">[2]</a></sup></td>\n' +
        '</tr>\n</tbody>\n</table></div>\n<hr class="footnotes-sep" />\n<section class="footnotes">\n' +
        '<ol class="footnotes-list">\n' +
        '<li id="fn1" class="footnote-item"><p data-line="5-5">note <code>a\\\\|b</code> <a href="#fnref1" ' +
        'class="footnote-backref">\u21a9\ufe0e</a></p>\n</li>\n' +
        '<li id="fn2" class="footnote-item"><p>in <code>a\\|b</code> <a href="#fnref2" ' +
        'class="footnote-backref">\u21a9\ufe0e</a></p>\n</li>\n</ol>\n</section>\n',
    ],
  ]);
});

describe("tables: this library's own parts", () => {
  it('meta.tables counts every table; lineAttrs: false leaves the wrapper and drops every data-line', () => {
    const src = '| a |\n|---|\n| b |\n\n> | c |\n> |---|\n\n- | d |\n  |---|\n';
    expect(render(src).meta.tables).toBe(3);
    expect(render('| a |\n|---|\n| b |\n', { lineAttrs: false }).html).toBe(
      '<div class="table-wrapper"><table>\n<thead>\n<tr>\n<th>a</th>\n</tr>\n</thead>\n<tbody>\n<tr>\n' +
        '<td>b</td>\n</tr>\n</tbody>\n</table></div>\n',
    );
    expect(render('no table | here\n').meta.tables).toBe(0);
  });

  it('short rows add at most 65536 empty cells to one table; the rows after that are a paragraph', () => {
    const src = `|${' h |'.repeat(2000)}\n|${'-|'.repeat(2000)}\n${'| b |\n'.repeat(40)}`;
    const html = render(src).html;
    expect(html.match(/<tr /g)).toHaveLength(33);
    expect(html.match(/<td>/g)).toHaveLength(64000);
    expect(html.endsWith(`</table></div>\n<p data-line="35-42">${'| b |\n'.repeat(7)}| b |</p>\n`)).toBe(true);
    expect(checkOutputSafety(html)).toEqual([]);
  });

  it('the 65536-cell limit holds for the whole document too: a later table adds no empty cell past it', () => {
    // markdown-it counts per table only, so many small tables could each add 65536 empty cells.
    const table = `|${' h |'.repeat(2000)}\n|${'-|'.repeat(2000)}\n${'| b |\n'.repeat(32)}`;
    const html = render(`${table}\n${table}`).html;
    expect(html.match(/<table[ >]/g)).toHaveLength(2);
    expect(html.match(/<td>/g)).toHaveLength(64000);
    expect(html.endsWith(`</table></div>\n<p data-line="38-69">${'| b |\n'.repeat(31)}| b |</p>\n`)).toBe(true);
    expect(checkOutputSafety(html)).toEqual([]);
  });

  it("the table rule is this library's port, in markdown-it's place and with its alternatives", () => {
    const md = createEngine();
    const table = rules(md.block.ruler).find((r) => r.name === 'table');
    expect(table?.fn).toBe(pyTable);
    expect(table?.alt).toEqual(['paragraph', 'reference']);
  });

  it("table_code and the two wrapper rules are the engine's", () => {
    const md = createEngine();
    expect(rules(md.core.ruler).find((r) => r.name === 'table_code')?.fn).toBe(tableCode);
    expect(md.renderer.rules.table_open).toBe(renderTableOpen);
    expect(md.renderer.rules.table_close).toBe(renderTableClose);
  });
});
