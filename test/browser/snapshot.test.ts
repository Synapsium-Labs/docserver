// @vitest-environment jsdom
// The Level 2 snapshot (test/browser/page/snapshot.ts) and the source-text tracking it relies on
// (test/browser/page/source.ts), under jsdom: the snapshot reads structure only, so no layout is needed here. Pinned:
// what a source node shows; that chrome outside the scope is transparent, with its own text left out and the texts
// around it joined, so a feature built later moves no earlier case; what a scope entry brings in; the text rules; and
// that a tail split off a source text is still source text.
import { describe, expect, it } from 'vitest';
import { CHROME_ATTR, snapshot } from './page/snapshot.js';
import { trackSource } from './page/source.js';

/** A root holding `html`, its texts tracked as source. */
function setup(html: string): { root: HTMLElement; isSource: (t: Text) => boolean } {
  const parsed = new DOMParser().parseFromString(`<!doctype html><body><main>${html}</main>`, 'text/html');
  const root = document.createElement('main');
  root.append(...Array.from((parsed.body.firstElementChild as Element).childNodes));
  document.body.replaceChildren(root);
  return { root, isSource: trackSource(root, Text) };
}

/** A new chrome element, as the layout makes one: the mark, classes, an optional own text. */
function chrome(tag: string, cls = '', text?: string): HTMLElement {
  const el = document.createElement(tag);
  el.setAttribute(CHROME_ATTR, '');
  if (cls !== '') el.className = cls;
  if (text !== undefined) el.textContent = text;
  return el;
}

describe('snapshot: source nodes', () => {
  it('lists every source element by tag and every source text, nested by two spaces, and nothing else out of scope', () => {
    const { root, isSource } = setup('<h2 id="a" class="x" aria-label="A" hidden>Title</h2><p>One <em>two</em> three</p>');
    expect(snapshot(root, [], isSource)).toBe(['h2', '  "Title"', 'p', '  "One"', '  em', '    "two"', '  "three"', ''].join('\n'));
  });

  it('a later feature\'s chrome, outside the scope, moves nothing: its children stand in its place and texts join', () => {
    const { root, isSource } = setup('<h2>3. Design</h2><p>Status: done</p>');
    const before = snapshot(root, ['pill'], isSource);
    const h2 = root.querySelector('h2') as HTMLElement;
    const t = h2.firstChild as Text;
    const rest = t.splitText(1); // "3" | ". Design"
    rest.splitText(2); // ". " | "Design"
    const no = chrome('span', 'sec-no');
    h2.insertBefore(no, t);
    no.append(t);
    const hide = chrome('span');
    hide.setAttribute('hidden', '');
    h2.insertBefore(hide, rest);
    hide.append(rest);
    const ctl = chrome('span', 'h-ctl');
    ctl.append(chrome('button', 'h-fold', 'Fold'));
    h2.append(ctl);
    expect(snapshot(root, ['pill'], isSource)).toBe(before);
    expect(before).toBe(['h2', '  "3. Design"', 'p', '  "Status: done"', ''].join('\n'));
  });

  it('a chrome wrapper outside the scope keeps the source nodes it holds, in its place', () => {
    const { root, isSource } = setup('<h2>In short</h2><p>Lead.</p><h2>Next</h2>');
    const box = chrome('div', 'short');
    root.insertBefore(box, root.firstChild);
    box.append(root.children[1] as Element, root.children[2] as Element);
    expect(snapshot(root, [], isSource)).toBe(['h2', '  "In short"', 'p', '  "Lead."', 'h2', '  "Next"', ''].join('\n'));
  });
});

describe('snapshot: the scope', () => {
  it('a class brings its element and the whole subtree in: classes, the chrome mark, role, aria-*, hidden, data-docreader-*, data-label', () => {
    const { root, isSource } = setup('<p>Lead</p>');
    const box = chrome('div', 'zeta alpha');
    box.setAttribute('role', 'note');
    box.setAttribute('aria-label', 'Box');
    box.setAttribute('data-docreader-state', 'open');
    box.setAttribute('data-other', 'not recorded');
    const inner = chrome('span', '', 'own text');
    inner.setAttribute('hidden', 'until-found');
    inner.setAttribute('data-label', 'Col');
    box.append(inner, root.firstElementChild as Element);
    root.append(box);
    expect(snapshot(root, ['alpha'], isSource)).toBe(
      [
        'div .alpha.zeta chrome role="note" aria-label="Box" data-docreader-state="open"',
        '  span chrome hidden="until-found" data-label="Col"',
        '    "own text"',
        '  p',
        '    "Lead"',
        '',
      ].join('\n'),
    );
  });

  it('[name] brings in a source element that carries it, by itself; never chrome, and not its children', () => {
    const { root, isSource } = setup('<h2 aria-label="Two" class="folded">Two</h2><p hidden="until-found"><em class="k">x</em></p>');
    const btn = chrome('button', 'h-fold', 'Fold');
    btn.setAttribute('aria-expanded', 'true');
    btn.setAttribute('hidden', '');
    (root.firstElementChild as Element).append(btn);
    expect(snapshot(root, ['[hidden]', '[aria-label]'], isSource)).toBe(
      ['h2 .folded aria-label="Two"', '  "Two"', 'p hidden="until-found"', '  em', '    "x"', ''].join('\n'),
    );
  });

  it('an entry that is neither a class name nor [attribute] is refused', () => {
    const { root, isSource } = setup('<p>x</p>');
    for (const bad of ['.dot', '#id', 'a b', '[Hidden]', '[x]y', '']) {
      expect(() => snapshot(root, [bad], isSource)).toThrow('invalid scope entries');
    }
  });
});

describe('snapshot: texts', () => {
  it('white space runs collapse to one space, texts are trimmed, and empty ones are dropped', () => {
    const { root, isSource } = setup('<p>\n  a\n\n  b  </p>\n\n<p> </p>');
    expect(snapshot(root, [], isSource)).toBe(['p', '  "a b"', 'p', ''].join('\n'));
  });

  it('a text is cut to 40 code points, and a cut one ends in … after its quote', () => {
    const forty = '😀'.repeat(40);
    const { root, isSource } = setup(`<p>${forty}</p><p>${forty}x</p>`);
    expect(snapshot(root, [], isSource)).toBe(['p', `  "${forty}"`, 'p', `  "${forty}"…`, ''].join('\n'));
  });

  it('an attribute value is cut the same way', () => {
    const { root, isSource } = setup(`<p aria-label="${'a'.repeat(41)}">x</p>`);
    expect(snapshot(root, ['[aria-label]'], isSource)).toBe([`p aria-label="${'a'.repeat(40)}"…`, '  "x"', ''].join('\n'));
  });
});

describe('trackSource', () => {
  it('a text present when tracked is source; a tail split off it is source; a text made later is not', () => {
    const { root, isSource } = setup('<p>abc</p>');
    const t = (root.firstElementChild as Element).firstChild as Text;
    const tail = t.splitText(1);
    const made = document.createTextNode('new');
    root.append(made);
    expect([isSource(t), isSource(tail), isSource(made)]).toEqual([true, true, false]);
    const other = document.createTextNode('elsewhere');
    expect(isSource(other.splitText(2))).toBe(false);
  });

  it('chrome text is left out of the snapshot outside the scope, and kept inside it', () => {
    const { root, isSource } = setup('<p>a</p>');
    const tag = chrome('span', 'tag', 'Label');
    (root.firstElementChild as Element).append(tag);
    expect(snapshot(root, [], isSource)).toBe(['p', '  "a"', ''].join('\n'));
    expect(snapshot(root, ['tag'], isSource)).toBe(['p', '  "a"', '  span .tag chrome', '    "Label"', ''].join('\n'));
  });
});
