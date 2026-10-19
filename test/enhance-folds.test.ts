// @vitest-environment jsdom
// Section folding in `./enhance` (L2 prototype), ported from the reference reader's heading controls and setFold:
// the controls, folding with hidden="until-found", the note, find-in-page (beforematch), the per-document state
// (persisted, restored), an author's own hidden block left alone, printing, and `folds: false`.
import { afterEach, describe, expect, it } from 'vitest';
import { destroyEnhancement, enhance } from '../src/enhance/index.js';
import { formatMinutes } from '../src/enhance/folds.js';
import { docKey } from '../src/enhance/state.js';
import { render } from '../src/render/index.js';

const LONG = Array.from({ length: 520 }, (_, i) => `word${String(i)}`).join(' ');

const DOC = [
  '# Example spec',
  '',
  '## 1. Scope',
  '',
  'What this covers.',
  '',
  'A second paragraph.',
  '',
  '## 2. Design',
  '',
  LONG,
  '',
  '```js',
  'const a = 1;',
  '```',
  '',
  '## 3. Plan',
  '',
  'The plan.',
  '',
  '## 4. Empty',
  '',
].join('\n');

const mounted: HTMLElement[] = [];

function mount(md = DOC): HTMLElement {
  const parsed = new DOMParser().parseFromString(`<!doctype html><body>${render(md).html}`, 'text/html');
  const root = document.createElement('main');
  root.append(...Array.from(parsed.body.childNodes));
  document.body.append(root);
  mounted.push(root);
  return root;
}

afterEach(async () => {
  for (const root of mounted.splice(0)) await destroyEnhancement(root).catch(() => undefined);
  document.body.replaceChildren();
});

/** The h2 with this id, found by walking the root's children (never by id lookup). */
function heading(root: Element, id: string): HTMLElement {
  const h = Array.from(root.children).find((c) => c.localName === 'h2' && c.id === id);
  if (h === undefined) throw new Error(`no h2 ${id}`);
  return h as HTMLElement;
}

/** The blocks of a section: the elements after its heading, up to the next h2, minus the library's note. */
function blocks(h: Element): Element[] {
  const out: Element[] = [];
  for (let n = h.nextElementSibling; n !== null && n.localName !== 'h2'; n = n.nextElementSibling) {
    if (!n.classList.contains('fold-note')) out.push(n);
  }
  return out;
}

const foldButton = (h: Element): HTMLButtonElement => h.querySelector('.h-ctl > button.h-fold') as HTMLButtonElement;
const note = (h: Element): HTMLButtonElement => h.nextElementSibling as HTMLButtonElement;

describe('fold controls', () => {
  it('each h2 with blocks gets an .h-fold button in an .h-ctl at its end, and a hidden .fold-note right after it', async () => {
    const root = mount();
    await enhance(root);
    const withControls = Array.from(root.children).filter((c) => c.localName === 'h2' && foldButton(c) !== null).map((h) => h.id);
    expect(withControls).toEqual(['1-scope', '2-design', '3-plan']); // '4-empty' has no blocks
    const h = heading(root, '1-scope');
    expect(h.lastElementChild?.className).toBe('h-ctl');
    const btn = foldButton(h);
    expect([btn.textContent, btn.getAttribute('aria-expanded'), btn.getAttribute('aria-label'), btn.type]).toEqual(['Fold', 'true', 'Fold or unfold: Scope', 'button']);
    expect(note(h).className).toBe('fold-note');
    expect(note(h).hidden).toBe(true);
    expect(note(h).getAttribute('aria-label')).toBe('Unfold: Scope');
  });

  it('the heading is named by its own text, not by its controls', async () => {
    const root = mount();
    await enhance(root);
    expect(heading(root, '1-scope').getAttribute('aria-label')).toBe('1. Scope');
  });

  it("the note carries the section's reading time when it is a minute or more", async () => {
    const root = mount();
    await enhance(root);
    expect(note(heading(root, '2-design')).querySelector('.fn-m')?.textContent).toBe('2 min');
    expect(note(heading(root, '1-scope')).querySelector('.fn-m')).toBeNull();
    expect([...note(heading(root, '1-scope')).children].map((c) => c.textContent)).toEqual(['Folded', 'Show']);
    expect([formatMinutes(0.4), formatMinutes(12.4), formatMinutes(59.4), formatMinutes(90)]).toEqual(['', '12 min', '59 min', '1.5 h']);
  });

  it('no controls when folds is false, or when the page is not a document', async () => {
    const off = mount();
    await enhance(off, { folds: false });
    expect(off.querySelectorAll('.h-fold, .fold-note').length).toBe(0);
    const notDoc = mount('## A\n\ntext\n\n## B\n\ntext\n\n## C\n\ntext\n');
    await enhance(notDoc);
    expect(notDoc.querySelectorAll('.h-fold').length).toBe(0);
  });
});

describe('folding and unfolding', () => {
  it('the button folds: blocks hidden until found, heading .folded, note shown, button says Unfold; again unfolds', async () => {
    const root = mount();
    await enhance(root);
    const h = heading(root, '1-scope');
    const btn = foldButton(h);
    btn.click();
    expect(blocks(h).map((b) => b.getAttribute('hidden'))).toEqual(['until-found', 'until-found']);
    expect([h.classList.contains('folded'), note(h).hidden, btn.textContent, btn.getAttribute('aria-expanded')]).toEqual([true, false, 'Unfold', 'false']);
    expect(blocks(heading(root, '2-design')).every((b) => !b.hasAttribute('hidden'))).toBe(true);
    btn.click();
    expect(blocks(h).map((b) => b.hasAttribute('hidden'))).toEqual([false, false]);
    expect([h.classList.contains('folded'), note(h).hidden, btn.textContent, btn.getAttribute('aria-expanded')]).toEqual([false, true, 'Fold', 'true']);
  });

  it('the note unfolds', async () => {
    const root = mount();
    await enhance(root);
    const h = heading(root, '3-plan');
    foldButton(h).click();
    note(h).click();
    expect(h.classList.contains('folded')).toBe(false);
    expect(blocks(h).some((b) => b.hasAttribute('hidden'))).toBe(false);
  });

  it('find-in-page opens a fold: beforematch on a hidden block unfolds its section', async () => {
    const root = mount();
    await enhance(root);
    const h = heading(root, '2-design');
    foldButton(h).click();
    (blocks(h)[1] as Element).dispatchEvent(new Event('beforematch'));
    expect(h.classList.contains('folded')).toBe(false);
    expect(blocks(h).some((b) => b.hasAttribute('hidden'))).toBe(false);
  });

  it("an author's own hidden block is never touched: not on fold, not on unfold, not on destroy", async () => {
    const root = mount();
    const h = heading(root, '1-scope');
    const [first, second] = blocks(h) as [Element, Element];
    second.setAttribute('hidden', '');
    const before = root.outerHTML;
    await enhance(root);
    foldButton(h).click();
    expect([first.getAttribute('hidden'), second.getAttribute('hidden')]).toEqual(['until-found', '']);
    foldButton(h).click();
    expect([first.getAttribute('hidden'), second.getAttribute('hidden')]).toEqual([null, '']);
    foldButton(h).click();
    await destroyEnhancement(root);
    expect(second.getAttribute('hidden')).toBe('');
    expect(root.outerHTML).toBe(before);
  });

  it('printing shows folded sections, and they fold again after', async () => {
    const root = mount();
    await enhance(root);
    const h = heading(root, '1-scope');
    foldButton(h).click();
    const view = root.ownerDocument.defaultView as Window;
    view.dispatchEvent(new Event('beforeprint'));
    expect(blocks(h).some((b) => b.hasAttribute('hidden'))).toBe(false);
    view.dispatchEvent(new Event('afterprint'));
    expect(blocks(h).map((b) => b.getAttribute('hidden'))).toEqual(['until-found', 'until-found']);
  });
});

describe('folds are per-document state', () => {
  it('a fold is written behind under docreader:doc:<storageKey>:folds, in document order; none folded deletes it', async () => {
    const root = mount();
    const calls: [string, string | null][] = [];
    await enhance(root, { storage: { set: (k, v) => void calls.push([k, v]) }, storageKey: 'project-a:specs:x.md' });
    foldButton(heading(root, '3-plan')).click();
    foldButton(heading(root, '1-scope')).click();
    foldButton(heading(root, '3-plan')).click();
    foldButton(heading(root, '1-scope')).click();
    const key = docKey('project-a:specs:x.md', 'folds');
    expect(key).toBe('docreader:doc:project-a:specs:x.md:folds');
    expect(calls).toEqual([
      [key, '["3-plan"]'],
      [key, '["1-scope","3-plan"]'],
      [key, '["1-scope"]'],
      [key, null],
    ]);
  });

  it('stored folds are restored at startup, without a write; an id that names no heading is ignored', async () => {
    const root = mount();
    const calls: unknown[] = [];
    const snapshot = { [docKey('k', 'folds')]: '["2-design","gone",7]' };
    await enhance(root, { storage: { snapshot, set: (k, v) => void calls.push([k, v]) }, storageKey: 'k' });
    expect(Array.from(root.querySelectorAll('h2.folded')).map((h) => h.id)).toEqual(['2-design']);
    expect(blocks(heading(root, '2-design')).every((b) => b.getAttribute('hidden') === 'until-found')).toBe(true);
    expect(foldButton(heading(root, '2-design')).textContent).toBe('Unfold');
    expect(calls).toEqual([]);
    foldButton(heading(root, '1-scope')).click();
    expect(calls).toEqual([[docKey('k', 'folds'), '["1-scope","2-design"]']]);
  });

  it('another document key restores nothing', async () => {
    const root = mount();
    const snapshot = { [docKey('other', 'folds')]: '["2-design"]' };
    await enhance(root, { storage: { snapshot }, storageKey: 'k' });
    expect(root.querySelectorAll('h2.folded').length).toBe(0);
  });

  it('without a storageKey folds work but nothing is written or restored', async () => {
    const root = mount();
    const calls: unknown[] = [];
    const snapshot = { [docKey('k', 'folds')]: '["2-design"]' };
    await enhance(root, { storage: { snapshot, set: (k, v) => void calls.push([k, v]) } });
    expect(root.querySelectorAll('h2.folded').length).toBe(0);
    foldButton(heading(root, '1-scope')).click();
    expect(heading(root, '1-scope').classList.contains('folded')).toBe(true);
    expect(calls).toEqual([]);
  });
});
