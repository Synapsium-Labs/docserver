// GitHub alerts (docserver L1, Task 7; architecture section C, the "Alerts" row; contract section 2.8).
// Every expected html string in the first block was produced by the reference renderer from the same input
// and is compared after normaliseForCompare (it only touches code blocks). The reference turns a blockquote
// into an alert with a regular expression over its finished HTML; this library decides on the token stream
// (alerts.ts), and these cases pin that the two agree. The later blocks pin this library's own parts.
import { describe, expect, it } from 'vitest';
import { normaliseForCompare } from '../src/conformance/normalise.js';
import { ALERT_TITLES, MARKER, renderAlertClose, renderAlertOpen } from '../src/render/alerts.js';
import { createEngine } from '../src/render/engine.js';
import { render } from '../src/render/index.js';

type Case = readonly [name: string, src: string, html: string];

function cases(list: readonly Case[]): void {
  for (const [name, src, html] of list) {
    it(name, () => {
      expect(normaliseForCompare(render(src).html)).toBe(html);
    });
  }
}

describe('alerts: against the reference', () => {
  cases([
    [
      'the five kinds, each with its title; data-line on the div, none on the rebuilt paragraph',
      '> [!NOTE]\n> a\n\n> [!TIP]\n> b\n\n> [!IMPORTANT]\n> c\n\n> [!WARNING]\n> d\n\n> [!CAUTION]\n> e\n',
      '<div class="gh-alert gh-note" data-line="1-2"><p class="gh-alert-title">Note</p><p>a</p>\n</div>\n' +
        '<div class="gh-alert gh-tip" data-line="4-5"><p class="gh-alert-title">Tip</p><p>b</p>\n</div>\n' +
        '<div class="gh-alert gh-important" data-line="7-8"><p class="gh-alert-title">Important</p><p>c' +
        '</p>\n</div>\n' +
        '<div class="gh-alert gh-warning" data-line="10-11"><p class="gh-alert-title">Warning</p><p>d</p>\n' +
        '</div>\n' +
        '<div class="gh-alert gh-caution" data-line="13-14"><p class="gh-alert-title">Caution</p><p>e</p>\n' +
        '</div>\n',
    ],
    [
      'upper case only, and exactly the five kinds',
      '> [!note]\n> a\n\n> [!Note]\n> b\n\n> [!INFO]\n> c\n\n> [!NOTE"><script>alert(1)</script>]\n> d\n' +
        '\n> [! NOTE]\n> e\n',
      '<blockquote data-line="1-2">\n<p data-line="1-2">[!note]\na</p>\n</blockquote>\n' +
        '<blockquote data-line="4-5">\n<p data-line="4-5">[!Note]\nb</p>\n</blockquote>\n' +
        '<blockquote data-line="7-8">\n<p data-line="7-8">[!INFO]\nc</p>\n</blockquote>\n' +
        '<blockquote data-line="10-11">\n' +
        '<p data-line="10-11">[!NOTE&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;]\nd</p>\n' +
        '</blockquote>\n<blockquote data-line="13-14">\n<p data-line="13-14">[! NOTE]\ne</p>\n' +
        '</blockquote>\n',
    ],
    [
      'the marker must start the blockquote\'s first paragraph',
      '> text\n> [!NOTE]\n\n> see [!NOTE] here\n\n> a\n>\n> [!NOTE] b\n\n> # [!NOTE] c\n\n> - [!NOTE] d\n',
      '<blockquote data-line="1-2">\n<p data-line="1-2">text\n[!NOTE]</p>\n</blockquote>\n' +
        '<blockquote data-line="4-4">\n<p data-line="4-4">see [!NOTE] here</p>\n</blockquote>\n' +
        '<blockquote data-line="6-8">\n<p data-line="6-6">a</p>\n<p data-line="8-8">[!NOTE] b</p>\n' +
        '</blockquote>\n<blockquote data-line="10-10">\n<h1 id="note-c" data-line="10-10">[!NOTE] c</h1>\n' +
        '</blockquote>\n<blockquote data-line="12-12">\n<ul data-line="12-12">\n' +
        '<li data-line="12-12">[!NOTE] d</li>\n</ul>\n</blockquote>\n',
    ],
    [
      'after the marker: spaces and tabs, then one line break of any form',
      '> [!NOTE] \t x\n\n> [!NOTE]\t\n> soft\n\n> [!NOTE]  \n> hard\n\n> [!NOTE]\\\n> backslash\n\n' +
        '> [!NOTE] <br/>br\n\n> [!NOTE]&#10;entity\n\n> [!NOTE]<br><br>two\n\n> [!NOTE] x  \n> y\n',
      '<div class="gh-alert gh-note" data-line="1-1"><p class="gh-alert-title">Note</p><p>x</p>\n</div>\n' +
        '<div class="gh-alert gh-note" data-line="3-4"><p class="gh-alert-title">Note</p><p>soft</p>\n' +
        '</div>\n' +
        '<div class="gh-alert gh-note" data-line="6-7"><p class="gh-alert-title">Note</p><p>hard</p>\n' +
        '</div>\n' +
        '<div class="gh-alert gh-note" data-line="9-10"><p class="gh-alert-title">Note</p><p>backslash' +
        '</p>\n</div>\n' +
        '<div class="gh-alert gh-note" data-line="12-12"><p class="gh-alert-title">Note</p><p>br</p>\n' +
        '</div>\n' +
        '<div class="gh-alert gh-note" data-line="14-14"><p class="gh-alert-title">Note</p><p>entity</p>\n' +
        '</div>\n' +
        '<div class="gh-alert gh-note" data-line="16-16"><p class="gh-alert-title">Note</p><p><br />\n' +
        'two</p>\n</div>\n' +
        '<div class="gh-alert gh-note" data-line="18-19"><p class="gh-alert-title">Note</p><p>x<br />\n' +
        'y</p>\n</div>\n',
    ],
    [
      'other Python whitespace after the marker stays',
      '> [!NOTE]\u3000\n> x\n\n> [!NOTE]\u00a0y\n',
      '<div class="gh-alert gh-note" data-line="1-2"><p class="gh-alert-title">Note</p><p>\u3000\nx</p>\n' +
        '</div>\n' +
        '<div class="gh-alert gh-note" data-line="4-4"><p class="gh-alert-title">Note</p><p>\u00a0y</p>\n' +
        '</div>\n',
    ],
    [
      'a first paragraph of only the marker is dropped; the next block starts on its own line',
      '> [!WARNING]\n\n> [!TIP]\n> ```js\n> a\n> ```\n\n> [!NOTE]<br>\n\n> [!NOTE]\n>\n> para1\n>\n' +
        '> para2\n\n> [!CAUTION]\n> - a\n> - b\n',
      '<div class="gh-alert gh-warning" data-line="1-1"><p class="gh-alert-title">Warning</p>\n</div>\n' +
        '<div class="gh-alert gh-tip" data-line="3-6"><p class="gh-alert-title">Tip</p>\n' +
        '<div class="codehilite" data-line="4-6"><pre>a\n</pre></div>\n</div>\n' +
        '<div class="gh-alert gh-note" data-line="8-8"><p class="gh-alert-title">Note</p>\n</div>\n' +
        '<div class="gh-alert gh-note" data-line="10-14"><p class="gh-alert-title">Note</p>\n' +
        '<p data-line="12-12">para1</p>\n<p data-line="14-14">para2</p>\n</div>\n' +
        '<div class="gh-alert gh-caution" data-line="16-18"><p class="gh-alert-title">Caution</p>\n' +
        '<ul data-line="17-18">\n<li data-line="17-17">a</li>\n<li data-line="18-18">b</li>\n</ul>\n' +
        '</div>\n',
    ],
    [
      'the marker is read as text: escaped and entity forms and a dropped comment count; a link does not',
      '> \\[!NOTE] a\n\n> &#91;!TIP&#93; b\n\n> [!NO<!-- c -->TE] c\n\n> [!NOTE](u) d\n\n> [!TIP] e\n\n' +
        '[!TIP]: /ref\n',
      '<div class="gh-alert gh-note" data-line="1-1"><p class="gh-alert-title">Note</p><p>a</p>\n</div>\n' +
        '<div class="gh-alert gh-tip" data-line="3-3"><p class="gh-alert-title">Tip</p><p>b</p>\n</div>\n' +
        '<div class="gh-alert gh-note" data-line="5-5"><p class="gh-alert-title">Note</p><p>c</p>\n</div>\n' +
        '<blockquote data-line="7-7">\n<p data-line="7-7"><a href="u">!NOTE</a> d</p>\n</blockquote>\n' +
        '<blockquote data-line="9-9">\n<p data-line="9-9"><a href="/ref">!TIP</a> e</p>\n</blockquote>\n',
    ],
    [
      'blocks that render nothing before the paragraph are stepped over; an anchor is not',
      '> <!-- dropped -->\n> [!NOTE]\n> a\n\n> </details>\n> [!TIP]\n> b\n\n> <!-- id:x -->\n> [!NOTE]\n' +
        '> c\n',
      '<div class="gh-alert gh-note" data-line="1-3"><p class="gh-alert-title">Note</p><p>a</p>\n</div>\n' +
        '<div class="gh-alert gh-tip" data-line="5-7"><p class="gh-alert-title">Tip</p><p>b</p>\n</div>\n' +
        '<blockquote data-line="9-11">\n<span class="doc-anchor" id="x"></span>\n' +
        '<p data-line="10-11">[!NOTE]\nc</p>\n</blockquote>\n',
    ],
    [
      'no alert inside an alert; one inside a plain blockquote, and alerts side by side, are made',
      '> [!NOTE]\n> > [!TIP]\n> > a\n\n> [!CAUTION]\n> c\n\n> plain\n>\n> > [!TIP]\n> > b\n>\n' +
        '> > [!NOTE]\n> > c\n',
      '<div class="gh-alert gh-note" data-line="1-3"><p class="gh-alert-title">Note</p>\n' +
        '<blockquote data-line="2-3">\n<p data-line="2-3">[!TIP]\na</p>\n</blockquote>\n</div>\n' +
        '<div class="gh-alert gh-caution" data-line="5-6"><p class="gh-alert-title">Caution</p><p>c</p>\n' +
        '</div>\n<blockquote data-line="8-14">\n<p data-line="8-8">plain</p>\n' +
        '<div class="gh-alert gh-tip" data-line="10-11"><p class="gh-alert-title">Tip</p><p>b</p>\n</div>\n' +
        '<div class="gh-alert gh-note" data-line="13-14"><p class="gh-alert-title">Note</p><p>c</p>\n' +
        '</div>\n</blockquote>\n',
    ],
    [
      'in a list item, with markup after the marker',
      '- > [!NOTE]**b** and `c`\n  > d\n',
      '<ul data-line="1-2">\n<li data-line="1-2">\n' +
        '<div class="gh-alert gh-note" data-line="1-2"><p class="gh-alert-title">Note</p><p><strong>b' +
        '</strong> and <code>c</code>\nd</p>\n</div>\n</li>\n</ul>\n',
    ],
  ]);
});

describe("alerts: this library's own parts", () => {
  it('lineAttrs: false leaves the alert and its paragraphs without data-line', () => {
    expect(render('> [!TIP]\n> a\n>\n> b\n', { lineAttrs: false }).html).toBe(
      '<div class="gh-alert gh-tip"><p class="gh-alert-title">Tip</p><p>a</p>\n<p>b</p>\n</div>\n',
    );
  });

  it('the five kinds and their titles are one frozen table, and the marker is built from it', () => {
    expect(ALERT_TITLES).toEqual({
      NOTE: 'Note',
      TIP: 'Tip',
      IMPORTANT: 'Important',
      WARNING: 'Warning',
      CAUTION: 'Caution',
    });
    expect(Object.isFrozen(ALERT_TITLES)).toBe(true);
    expect(MARKER.source).toBe('^\\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\\][ \\t]*');
    expect(MARKER.flags).toBe('');
  });

  it('a blockquote nested deeper than the engine allows still ends in one alert', () => {
    const src = Array.from({ length: 25 }, (_, i) => `${'> '.repeat(i + 1)}[!NOTE] level ${i + 1}\n`).join('');
    const html = render(src).html;
    expect(html.match(/<div class="gh-alert/g)).toHaveLength(1);
    expect(html.match(/<blockquote/g)).toHaveLength(19);
    expect(html.match(/<\/blockquote>/g)).toHaveLength(19);
  });

  it("are the engine's alert_open and alert_close render rules", () => {
    const rules = createEngine().renderer.rules;
    expect(rules.alert_open).toBe(renderAlertOpen);
    expect(rules.alert_close).toBe(renderAlertClose);
  });
});
