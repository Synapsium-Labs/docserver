// The data-line attribute through render() (docserver L1, Task 4; architecture section C, the `data-line`
// row; contract section 2.4). Task 3's engine test pins the rule's token set; this file pins what a reader
// of the HTML sees: the attribute on each of the ten block types, after `id` and `start`, and the
// `lineAttrs: false` option, which removes the attribute and changes nothing else, in every corpus case.
import { describe, expect, it } from 'vitest';
import { loadCorpus } from '../src/conformance/index.js';
import { render } from '../src/render/index.js';

const DATA_LINE = / data-line="\d+-\d+"/g;

describe('data-line through render()', () => {
  it('marks each of the reference\'s ten block types, after id and start', () => {
    const src = '# H\n\n3. a\n4. b\n\n- c\n\n> q\n\n***\n\n    code\n\n| x |\n|---|\n| y |\n';
    const html = render(src).html;
    for (const open of [
      '<h1 id="h" data-line="1-1">',
      '<ol start="3" data-line="3-5">',
      '<li data-line="3-3">',
      '<li data-line="4-5">',
      '<ul data-line="6-7">',
      '<li data-line="6-7">',
      '<blockquote data-line="8-8">',
      '<p data-line="8-8">',
      '<hr data-line="10-10" />',
      '<pre data-line="12-12"><code>',
      '<table data-line="14-16">',
      '<tr data-line="14-14">',
      '<tr data-line="16-16">',
    ]) {
      expect(html).toContain(open);
    }
    expect(html.match(DATA_LINE)).toHaveLength(13);
  });

  it('puts data-line last: id then data-line, start then data-line', () => {
    expect(render('# H\n\n3. a\n').html).toBe(
      '<h1 id="h" data-line="1-1">H</h1>\n<ol start="3" data-line="3-3">\n<li data-line="3-3">a</li>\n</ol>\n',
    );
  });

  it('lineAttrs: false keeps id and start', () => {
    expect(render('# H\n\n3. a\n', { lineAttrs: false }).html).toBe(
      '<h1 id="h">H</h1>\n<ol start="3">\n<li>a</li>\n</ol>\n',
    );
  });
});

describe('lineAttrs: false over the corpus', () => {
  for (const c of loadCorpus()) {
    it(`${c.id}: no data-line, and otherwise the default output`, () => {
      const on = render(c.input, { ...c.options, lineAttrs: true });
      const off = render(c.input, { ...c.options, lineAttrs: false });
      expect(off.html).not.toContain('data-line');
      expect(off.html).toBe(on.html.replace(DATA_LINE, ''));
      expect(off.meta).toEqual(on.meta);
    });
  }
});
