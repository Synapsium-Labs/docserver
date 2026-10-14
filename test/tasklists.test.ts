// Task lists (docserver L1, Task 8; architecture section C, the "Task lists" row; contract sections 1 and 6
// item 4). Every expected html string in the first block was produced by the reference renderer from the
// same input and is compared after normaliseForCompare (it only touches code blocks). The reference uses a
// Python task-list plugin; this library ports it (tasklists.ts), and these cases pin that the two agree,
// down to the item with whitespace other than a space after its marker, which gets no checkbox. The later
// block pins this library's own parts.
import { describe, expect, it } from 'vitest';
import { normaliseForCompare } from '../src/conformance/normalise.js';
import { checkOutputSafety } from '../src/conformance/oracle.js';
import { createEngine } from '../src/render/engine.js';
import { render } from '../src/render/index.js';
import { CHECKED, TASK, taskLists, UNCHECKED } from '../src/render/tasklists.js';

type Case = readonly [name: string, src: string, html: string];

function cases(list: readonly Case[]): void {
  for (const [name, src, html] of list) {
    it(name, () => {
      expect(normaliseForCompare(render(src).html)).toBe(html);
    });
  }
}

describe('task lists: against the reference', () => {
  cases([
    [
      'unchecked, checked by x or X; the item and its list get their classes; an ordered list keeps start',
      '- [ ] a\n- [x] b\n- [X] c\n\n3. [ ] three\n4. four\n',
      '<ul class="contains-task-list" data-line="1-4">\n' +
        '<li class="task-list-item" data-line="1-1"><input class="task-list-item-checkbox" ' +
        'disabled="disabled" type="checkbox"> a</li>\n' +
        '<li class="task-list-item" data-line="2-2"><input class="task-list-item-checkbox" checked="checked" ' +
        'disabled="disabled" type="checkbox"> b</li>\n' +
        '<li class="task-list-item" data-line="3-4"><input class="task-list-item-checkbox" checked="checked" ' +
        'disabled="disabled" type="checkbox"> c</li>\n</ul>\n' +
        '<ol start="3" class="contains-task-list" data-line="5-6">\n' +
        '<li class="task-list-item" data-line="5-5"><input class="task-list-item-checkbox" ' +
        'disabled="disabled" type="checkbox"> three</li>\n<li data-line="6-6">four</li>\n</ol>\n',
    ],
    [
      'a space after the marker keeps the checkbox; other GFM whitespace makes a task with no checkbox',
      '- [ ]\ttab\n- [x]\n  next line\n- [ ]\u000bvt\n- [ ]  two\n',
      '<ul class="contains-task-list" data-line="1-5">\n' +
        '<li class="task-list-item" data-line="1-1">\ttab</li>\n<li class="task-list-item" data-line="2-3">\n' +
        'next line</li>\n<li class="task-list-item" data-line="4-4">\u000bvt</li>\n' +
        '<li class="task-list-item" data-line="5-5"><input class="task-list-item-checkbox" ' +
        'disabled="disabled" type="checkbox">  two</li>\n</ul>\n',
    ],
    [
      'not tasks: no whitespace, other brackets, Python-only whitespace, an escape, an entity',
      '- [ ]a\n- []\n- [ x]\n- [-] d\n- [ ]\u00a0nbsp\n- [ ]\u3000ideo\n- \\[ ] esc\n- &#91; ] ent\n',
      '<ul data-line="1-8">\n<li data-line="1-1">[ ]a</li>\n<li data-line="2-2">[]</li>\n' +
        '<li data-line="3-3">[ x]</li>\n<li data-line="4-4">[-] d</li>\n' +
        '<li data-line="5-5">[ ]\u00a0nbsp</li>\n<li data-line="6-6">[ ]\u3000ideo</li>\n' +
        '<li data-line="7-7">[ ] esc</li>\n<li data-line="8-8">[ ] ent</li>\n</ul>\n',
    ],
    [
      'nested task lists, a list that mixes tasks and plain items, loose items',
      '- [ ] a\n  - [x] b\n    1. [ ] c\n- plain\n\n- [x] loose\n\n- [ ] loose2\n',
      '<ul class="contains-task-list" data-line="1-8">\n<li class="task-list-item" data-line="1-3">\n' +
        '<p data-line="1-1"><input class="task-list-item-checkbox" disabled="disabled" type="checkbox"> ' +
        'a</p>\n<ul class="contains-task-list" data-line="2-3">\n' +
        '<li class="task-list-item" data-line="2-3"><input class="task-list-item-checkbox" checked="checked" ' +
        'disabled="disabled" type="checkbox"> b\n<ol class="contains-task-list" data-line="3-3">\n' +
        '<li class="task-list-item" data-line="3-3"><input class="task-list-item-checkbox" ' +
        'disabled="disabled" type="checkbox"> c</li>\n</ol>\n</li>\n</ul>\n</li>\n<li data-line="4-5">\n' +
        '<p data-line="4-4">plain</p>\n</li>\n<li class="task-list-item" data-line="6-7">\n' +
        '<p data-line="6-6"><input class="task-list-item-checkbox" checked="checked" disabled="disabled" ' +
        'type="checkbox"> loose</p>\n</li>\n<li class="task-list-item" data-line="8-8">\n' +
        '<p data-line="8-8"><input class="task-list-item-checkbox" disabled="disabled" type="checkbox"> ' +
        'loose2</p>\n</li>\n</ul>\n',
    ],
    [
      'markup after the marker; a reference link [x] still makes a task',
      '[x]: /url\n\n- [x] ref\n- [ ] **b** `c` <br> d\n- [x] [l](u) \\*e\n',
      '<ul class="contains-task-list" data-line="3-5">\n' +
        '<li class="task-list-item" data-line="3-3"><input class="task-list-item-checkbox" checked="checked" ' +
        'disabled="disabled" type="checkbox"><a href="/url">x</a> ref</li>\n' +
        '<li class="task-list-item" data-line="4-4"><input class="task-list-item-checkbox" ' +
        'disabled="disabled" type="checkbox"> <strong>b</strong> <code>c</code> <br />\n d</li>\n' +
        '<li class="task-list-item" data-line="5-5"><input class="task-list-item-checkbox" checked="checked" ' +
        'disabled="disabled" type="checkbox"><a href="/url">x</a> <a href="u">l</a> *e</li>\n</ul>\n',
    ],
    [
      'only the paragraph that opens a list item: not a heading, a code block, a later paragraph or a quote',
      '- # [ ] h\n- ```\n  [ ] code\n  ```\n- text\n\n  [ ] later\n- > [ ] quote\n',
      '<ul data-line="1-8">\n<li data-line="1-1">\n<h1 id="--h" data-line="1-1">[ ] h</h1>\n</li>\n' +
        '<li data-line="2-4">\n<div class="codehilite" data-line="2-4"><pre>[ ] code\n</pre></div>\n</li>\n' +
        '<li data-line="5-7">\n<p data-line="5-5">text</p>\n<p data-line="7-7">[ ] later</p>\n</li>\n' +
        '<li data-line="8-8">\n<blockquote data-line="8-8">\n<p data-line="8-8">[ ] quote</p>\n' +
        '</blockquote>\n</li>\n</ul>\n',
    ],
    [
      'in a blockquote and in a footnote',
      '> - [ ] q\n\nt[^n]\n\n[^n]: - [x] in note\n',
      '<blockquote data-line="1-1">\n<ul class="contains-task-list" data-line="1-1">\n' +
        '<li class="task-list-item" data-line="1-1"><input class="task-list-item-checkbox" ' +
        'disabled="disabled" type="checkbox"> q</li>\n</ul>\n</blockquote>\n' +
        '<p data-line="3-3">t<sup class="footnote-ref"><a href="#fn1" id="fnref1">[1]</a></sup></p>\n' +
        '<hr class="footnotes-sep" />\n<section class="footnotes">\n<ol class="footnotes-list">\n' +
        '<li id="fn1" class="footnote-item"><ul class="contains-task-list" data-line="5-5">\n' +
        '<li class="task-list-item" data-line="5-5"><input class="task-list-item-checkbox" checked="checked" ' +
        'disabled="disabled" type="checkbox"> in note</li>\n</ul>\n' +
        ' <a href="#fnref1" class="footnote-backref">\u21a9\ufe0e</a></li>\n</ol>\n</section>\n',
    ],
    [
      'astral and Greek text after the marker',
      '- [x] \ud83d\ude00 \u039f\u0394\u039f\u03a3\n',
      '<ul class="contains-task-list" data-line="1-1">\n' +
        '<li class="task-list-item" data-line="1-1"><input class="task-list-item-checkbox" checked="checked" ' +
        'disabled="disabled" type="checkbox"> \ud83d\ude00 \u039f\u0394\u039f\u03a3</li>\n</ul>\n',
    ],
  ]);
});

describe("task lists: this library's own parts", () => {
  it('lineAttrs: false leaves the classes and the checkbox, and drops every data-line', () => {
    expect(render('- [x] a\n- b\n', { lineAttrs: false }).html).toBe(
      `<ul class="contains-task-list">\n<li class="task-list-item">${CHECKED} a</li>\n<li>b</li>\n</ul>\n`,
    );
  });

  it('the marker and the two checkboxes are fixed text, and the checkboxes pass the output oracle', () => {
    expect(TASK.source).toBe('^\\[[ xX]\\][ \\t\\n\\v\\f\\r]+');
    expect(TASK.flags).toBe('');
    expect(UNCHECKED).toBe('<input class="task-list-item-checkbox" disabled="disabled" type="checkbox">');
    expect(CHECKED).toBe(
      '<input class="task-list-item-checkbox" checked="checked" disabled="disabled" type="checkbox">',
    );
    expect(checkOutputSafety(render('- [ ] a\n- [x] b\n').html)).toEqual([]);
  });

  it('a list of 20000 tasks is marked in linear time', () => {
    const started = performance.now();
    const html = render('- [ ] t\n'.repeat(20000)).html;
    const ms = performance.now() - started;
    expect(html.match(/<li class="task-list-item"/g)).toHaveLength(20000);
    expect(html.match(/class="contains-task-list"/g)).toHaveLength(1);
    expect(ms).toBeLessThan(5000);
  });

  it('is a core rule of the engine', () => {
    const core = createEngine().core.ruler as unknown as { __rules__: { name: string; fn: unknown }[] };
    expect(core.__rules__.find((r) => r.name === 'task_lists')?.fn).toBe(taskLists);
  });
});
