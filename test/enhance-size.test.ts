// @vitest-environment jsdom
// Text size (LX6.3), the stored pref of the reading settings: `size` is `s`, `m`, `l` or `xl` (16, 20 and 22 px for s, l and xl; m is the reader's own size of the face and width: 18, 17, 17.5 or 16.5 px), kept
// beside width and font in the reader's own stored prefs and never on the bridge. Its jsdom cases: the Aa row, the root's
// `data-size`, the stored value, the default for an absent or unknown value, and the wire's prefs left as they were.
// The computed sizes in the real stylesheet are in test/browser/frame-pages.test.ts (T14), the place kept in T12b.
import { afterEach, describe, expect, it } from 'vitest';
import { destroyEnhancement, enhance, setEnhancementPrefs } from '../src/enhance/index.js';
import { contextOf } from '../src/enhance/lifecycle.js';
import { PREF_VALUES } from '../src/enhance/options.js';
import { FRAME_PREF_VALUES } from '../src/frame/protocol.js';
import { parseParentMessage } from '../src/frame-runtime/inbound.js';
import { render } from '../src/render/index.js';

const mounted: HTMLElement[] = [];
afterEach(async () => {
  for (const root of mounted.splice(0)) await destroyEnhancement(root).catch(() => undefined);
  document.body.replaceChildren();
});

function mount(): HTMLElement {
  const parsed = new DOMParser().parseFromString(`<!doctype html><body>${render('# Size\n\nText.\n\n## 1. One\n\nMore text.\n').html}`, 'text/html');
  const root = document.createElement('main');
  root.append(...Array.from(parsed.body.childNodes).map((n) => document.importNode(n, true)));
  document.body.append(root);
  mounted.push(root);
  return root;
}

const radio = (root: Element, value: string): HTMLInputElement => root.querySelector(`input[data-pref="size"][value="${value}"]`) as HTMLInputElement;
const checked = (root: Element): string[] => Array.from(root.querySelectorAll<HTMLInputElement>('input[data-pref="size"]')).filter((i) => i.checked).map((i) => i.value);
function choose(input: HTMLInputElement): void {
  input.checked = true;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}
const storeWith = (value: string): { snapshot: Record<string, string>; sets: [string, string][]; set: (k: string, v: string) => void } => {
  const sets: [string, string][] = [];
  return { snapshot: { 'docreader:prefs': value }, sets, set: (k, v) => void sets.push([k, v]) };
};

describe('text size (default layout)', () => {
  it('the size pref takes s, m, l and xl, the default (m) first, and the Aa menu has one row of four beside width and font', async () => {
    expect(PREF_VALUES.size).toEqual(['m', 's', 'l', 'xl']);
    const root = mount();
    await enhance(root);
    expect(Array.from(root.querySelectorAll('.aa-menu fieldset > legend'), (l) => l.textContent).slice(0, 5)).toEqual(['Theme', 'Typeface', 'Text width', 'Text size', 'Reading lens']);
    expect(Array.from(root.querySelectorAll<HTMLInputElement>('input[data-pref="size"]'), (i) => [i.value, i.labels?.[0]?.textContent])).toEqual([['s', 'S'], ['m', 'M'], ['l', 'L'], ['xl', 'XL']]);
  });

  it('an absent size reads as m: the m radio is checked and the root carries no data-size', async () => {
    const root = mount();
    await enhance(root);
    expect(checked(root)).toEqual(['m']);
    expect(root.hasAttribute('data-size')).toBe(false);
  });

  it.each([JSON.stringify({ size: 'huge' }), JSON.stringify({ size: 18 }), JSON.stringify({ size: null }), JSON.stringify({ size: 'M' }), 'not json'])('an unknown stored size (%s) reads as m', async (stored) => {
    const root = mount();
    await enhance(root, { storage: storeWith(stored) });
    expect(checked(root)).toEqual(['m']);
    expect(root.hasAttribute('data-size')).toBe(false);
  });

  it.each(['s', 'l', 'xl'])('a stored size %s is read: its radio is checked and the root says it', async (size) => {
    const root = mount();
    await enhance(root, { storage: storeWith(JSON.stringify({ size })) });
    expect(checked(root)).toEqual([size]);
    expect(root.getAttribute('data-size')).toBe(size);
  });

  it('choosing a size sets data-size (none for m), writes the stored prefs with it and keeps the other prefs', async () => {
    const root = mount();
    const store = storeWith(JSON.stringify({ width: 'wide' }));
    await enhance(root, { storage: store });
    choose(radio(root, 'xl'));
    expect(root.getAttribute('data-size')).toBe('xl');
    expect(JSON.parse(store.sets.at(-1)?.[1] ?? '{}')).toMatchObject({ width: 'wide', size: 'xl' });
    choose(radio(root, 's'));
    expect(root.getAttribute('data-size')).toBe('s');
    choose(radio(root, 'm'));
    expect(root.hasAttribute('data-size')).toBe(false);
    expect(JSON.parse(store.sets.at(-1)?.[1] ?? '{}')).toMatchObject({ width: 'wide', size: 'm' });
  });

  it('a size set by the host (options.prefs, setEnhancementPrefs) shows in the row and on the root; a bad one is refused', async () => {
    const root = mount();
    await enhance(root, { prefs: { size: 'l' } });
    expect(root.getAttribute('data-size')).toBe('l');
    expect(checked(root)).toEqual(['l']);
    setEnhancementPrefs(root, { size: 's' });
    expect(root.getAttribute('data-size')).toBe('s');
    expect(checked(root)).toEqual(['s']);
    await expect(enhance(mount(), { prefs: { size: 'big' as 'l' } })).rejects.toMatchObject({ code: 'invalid-options' });
  });

  it('a change of size is a relayout for the prefs, as width and font are: from the Aa row, and from the host', async () => {
    const root = mount();
    await enhance(root);
    const reasons: string[] = [];
    contextOf(root)?.onRelayout((r) => void reasons.push(...r));
    choose(radio(root, 'l'));
    await new Promise((r) => setTimeout(r, 60));
    expect(reasons).toContain('prefs');
    reasons.length = 0;
    setEnhancementPrefs(root, { size: 'xl' }); // the host's path: no settings handler runs, only the lifecycle's own comparison
    await new Promise((r) => setTimeout(r, 60));
    expect(reasons).toContain('prefs');
    reasons.length = 0;
    setEnhancementPrefs(root, { size: 'xl' }); // no change, no relayout
    await new Promise((r) => setTimeout(r, 60));
    expect(reasons).not.toContain('prefs');
  });
});

describe('text size stays off the wire (default layout)', () => {
  it('FRAME_PREF_VALUES is still theme, width and font exactly: no size', () => {
    expect(FRAME_PREF_VALUES).toEqual({ theme: ['auto', 'light', 'dark'], width: ['standard', 'wide'], font: ['serif', 'sans'] });
  });

  it('the frame refuses a prefs op that names a size, and still takes one that names a width', () => {
    expect(parseParentMessage({ t: 'prefs', size: 'l' })).toBeNull();
    expect(parseParentMessage({ t: 'prefs', width: 'wide', size: 'l' })).toBeNull();
    expect(parseParentMessage({ t: 'prefs', width: 'wide' })).toEqual({ t: 'prefs', width: 'wide' });
  });
});
