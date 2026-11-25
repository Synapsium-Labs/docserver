// @vitest-environment jsdom
// Task 5 of the appearance contract (docserver appearance plan; the first consumer's design, section 10: tests 3, 6
// (rendered) and 7 (frame half)): the reader applies a host's verdict. The seed's appearance is applied in the same
// synchronous run that applies the prefs, an op applies in place, hosted mounts ignore the stored theme and never write
// one, Aa trades its theme row for one static line, and the frame runtime loads the host's faces and marks its `html`
// element. Judged in jsdom; the computed values at the first `ready` are the Chromium file's (test/browser/frame-appearance.test.ts).
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { APPEARANCE_LABEL_DEFAULT, APPEARANCE_SLOTS, SLOT_PROPERTY, type Appearance, type AppearanceColourSlot } from '../src/enhance/appearance.js';
import { destroyEnhancement, enhance, setEnhancementAppearance, setEnhancementPrefs } from '../src/enhance/index.js';
import { createJournal } from '../src/enhance/journal.js';
import { wrapEnhance } from '../src/frame-runtime/enhance-wrap.js';
import { contextOf } from '../src/enhance/lifecycle.js';
import { EVENT_NAMES } from '../src/enhance/registry.js';
import type { ReaderStorage } from '../src/enhance/types.js';
import { SEED_LIMITS } from '../src/frame/seed.js';
import { loadHostFonts } from '../src/frame-runtime/host-fonts.js';
import { render } from '../src/render/index.js';

// The palettes as the verdict gives them back: a colour comes out as lower-case `#rrggbb` (ccrc D-9019), so the rows that
// compare what the reader wrote with what was handed in hand in that form. Case handling itself is in the contract's rows.
const FIXTURES = (JSON.parse(readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'conformance', 'appearance', 'fixtures.json'), 'utf8')) as {
  name: string;
  mode: 'light' | 'dark';
  colour: Record<AppearanceColourSlot, string>;
}[]).map((f) => ({ ...f, colour: Object.fromEntries(Object.entries(f.colour).map(([k, v]) => [k, v.toLowerCase()])) as Record<AppearanceColourSlot, string> }));
const PHOSPHOR = FIXTURES.find((f) => f.name === 'Phosphor & Ink')!;
const DAYLIGHT = FIXTURES.find((f) => f.name === 'Phosphor Daylight')!;

const COLOUR_PROPS = APPEARANCE_SLOTS.colour.map((s) => SLOT_PROPERTY.colour[s]);
const SKIN_PROPS = APPEARANCE_SLOTS.skin.map((s) => SLOT_PROPERTY.skin[s]);

const dark = (over: Partial<Appearance> = {}): Appearance => ({ mode: 'dark', colour: PHOSPHOR.colour, ...over });
const light = (over: Partial<Appearance> = {}): Appearance => ({ mode: 'light', colour: DAYLIGHT.colour, ...over });

const DOC = ['# Hosted', '', '**Spec** · 2026-11-20 · Status: Draft', '', '## 1. One', '', 'Text.', '', '## 2. Two', '', 'More.', '', '## 3. Three', '', 'End.'].join('\n');
const mounted: HTMLElement[] = [];

function mount(): HTMLElement {
  const parsed = new DOMParser().parseFromString(`<!doctype html><body>${render(DOC).html}`, 'text/html');
  const root = document.createElement('main');
  root.append(...Array.from(parsed.body.childNodes).map((n) => document.importNode(n, true)));
  document.body.append(root);
  mounted.push(root);
  return root;
}

const prop = (root: HTMLElement, name: string): string => root.style.getPropertyValue(name);
const set = (root: HTMLElement, names: readonly string[]): string[] => names.filter((n) => prop(root, n) !== '');
const click = (el: Element): void => void el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
const menu = (root: Element): HTMLElement => root.querySelector('.aa-menu') as HTMLElement;
const themeRadios = (root: Element): HTMLInputElement[] => Array.from(root.querySelectorAll<HTMLInputElement>('input[data-pref="theme"]'));
/** The root's attributes and inline style as one comparable string. */
const stamp = (root: HTMLElement): string => [...root.getAttributeNames()].sort().map((n) => `${n}=${root.getAttribute(n) ?? ''}`).join(';');

afterEach(async () => {
  for (const root of mounted.splice(0)) await destroyEnhancement(root).catch(() => undefined);
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe('test 3: the seed paints before the first yield', () => {
  it('the colour and skin properties and the hosted attributes are on the root when enhance() returns its promise', () => {
    const root = mount();
    const p = enhance(root, { appearance: dark({ skin: { radius: '4px', popShadow: '0 0 0 1px #5F697C' } }) });
    // No await yet: the same synchronous run that applies the prefs.
    expect(root.hasAttribute('data-docreader-hosted')).toBe(true);
    expect(root.hasAttribute('data-docreader-colours')).toBe(true);
    expect(root.getAttribute('data-docreader-skin')).toBe('radius popShadow');
    expect(root.getAttribute('data-theme')).toBe('dark');
    expect(prop(root, '--bg')).toBe(PHOSPHOR.colour.bg);
    expect(prop(root, '--syn-deleted')).toBe(PHOSPHOR.colour['syn-deleted']);
    expect(prop(root, '--dr-radius')).toBe('4px');
    expect(prop(root, '--dr-pop-shadow')).toBe('0 0 0 1px #5F697C');
    void p.catch(() => undefined);
    return p;
  });

  it('writes every colour slot to its SLOT_PROPERTY name and nothing else of the colours', async () => {
    const root = mount();
    await enhance(root, { appearance: dark() });
    expect(set(root, COLOUR_PROPS)).toEqual(COLOUR_PROPS);
    for (const s of APPEARANCE_SLOTS.colour) expect(prop(root, SLOT_PROPERTY.colour[s])).toBe(PHOSPHOR.colour[s]);
    expect(set(root, SKIN_PROPS)).toEqual([]);
    expect(root.hasAttribute('data-docreader-skin')).toBe(false);
  });

  it('with no appearance nothing is written: no attribute, no property', async () => {
    const root = mount();
    const before = stamp(root);
    await enhance(root);
    for (const a of ['data-docreader-hosted', 'data-docreader-colours', 'data-docreader-skin']) expect(root.hasAttribute(a)).toBe(false);
    expect(set(root, [...COLOUR_PROPS, ...SKIN_PROPS])).toEqual([]);
    expect(stamp(root).includes('style=')).toBe(before.includes('style='));
  });

  it('the option accepts any value; one that is not a plain object leaves the mount unhosted', async () => {
    for (const v of [5, 'x', null, [], () => 1, Symbol('s')]) {
      const root = mount();
      await enhance(root, { appearance: v });
      expect(root.hasAttribute('data-docreader-hosted'), String(typeof v)).toBe(false);
    }
  });

  it('a hostile value (a getter, a Proxy that throws) never throws and hosts in the library colours for auto', async () => {
    const root = mount();
    const bad = { mode: 'dark', get colour() { throw new Error('boom'); } };
    await enhance(root, { appearance: bad });
    expect(root.hasAttribute('data-docreader-hosted')).toBe(true);
    expect(root.hasAttribute('data-docreader-colours')).toBe(false);
    const root2 = mount();
    await enhance(root2, { appearance: new Proxy({}, { ownKeys: () => { throw new Error('trap'); } }) });
    expect(root2.hasAttribute('data-docreader-hosted')).toBe(true);
    expect(root2.hasAttribute('data-theme')).toBe(false);
  });

  it('D-9019: an upper-case, a short and a named colour are written as lower-case #rrggbb, the verdict, never the text handed in', async () => {
    const root = mount();
    await enhance(root, { appearance: { mode: 'dark', colour: { ...PHOSPHOR.colour, bg: '#ABCDEF', surface: '#FFF', text: 'tan' }, skin: { sectionTracking: '-.011em' } } });
    expect([prop(root, '--bg'), prop(root, '--surface'), prop(root, '--text')]).toEqual(['#abcdef', '#ffffff', '#d2b48c']);
    expect(prop(root, '--dr-section-tracking')).toBe('-.011em');
  });

  it('a bad colour value drops the whole colour group, keeps the skin and stays hosted', async () => {
    const root = mount();
    await enhance(root, { appearance: { mode: 'light', colour: { ...PHOSPHOR.colour, bg: 'blue' }, skin: { radius: '3px' } } }); // a name outside the table (D-9019)
    expect(root.hasAttribute('data-docreader-hosted')).toBe(true);
    expect(root.hasAttribute('data-docreader-colours')).toBe(false);
    expect(set(root, COLOUR_PROPS)).toEqual([]);
    expect(prop(root, '--dr-radius')).toBe('3px');
    expect(root.getAttribute('data-theme')).toBe('light');
  });

  it("a verdict with no colour group removes only the colour properties the last one wrote: a host's own inline token survives", async () => {
    const root = mount();
    root.style.setProperty('--bg', '#123456'); // the host's own token, never set by an appearance
    root.style.setProperty('--dr-radius', '7px');
    await enhance(root, { appearance: { mode: 'dark', skin: { sectionCase: 'none' } } });
    expect(prop(root, '--bg')).toBe('#123456');
    setEnhancementAppearance(root, { mode: 'dark' });
    expect(prop(root, '--bg')).toBe('#123456');
    expect(prop(root, '--dr-radius')).toBe('7px');
    expect(prop(root, '--dr-section-case')).toBe(''); // what the first verdict wrote goes with it
    // Two verdicts that write other slots do not touch it either.
    setEnhancementAppearance(root, { mode: 'dark', colour: { ...PHOSPHOR.colour, bg: '#000000' } });
    setEnhancementAppearance(root, { mode: 'dark', colour: PHOSPHOR.colour });
    expect(prop(root, '--dr-radius')).toBe('7px');
  });

  it('a slot written by the last verdict is removed when the next leaves it out, colour or skin', async () => {
    const root = mount();
    await enhance(root, { appearance: dark({ skin: { radius: '4px' } }) });
    setEnhancementAppearance(root, { mode: 'dark' });
    expect(set(root, [...COLOUR_PROPS, ...SKIN_PROPS])).toEqual([]);
  });

  it('destroy undoes every attribute and property the verdict wrote', async () => {
    const root = mount();
    await enhance(root, { appearance: dark({ skin: { radius: '4px' } }) });
    await destroyEnhancement(root);
    expect(root.getAttributeNames().filter((n) => n.startsWith('data-'))).toEqual([]);
    expect(root.hasAttribute('style')).toBe(false);
  });
});

describe('test 3: an op applies in place', () => {
  it('the same root and the same chrome nodes, new values, no remount', async () => {
    const root = mount();
    await enhance(root, { appearance: dark() });
    const button = root.querySelector('.aa-btn');
    const kids = Array.from(root.children);
    setEnhancementAppearance(root, light({ skin: { radius: '9px' } }));
    expect(root.querySelector('.aa-btn')).toBe(button);
    expect(Array.from(root.children)).toEqual(kids);
    expect(prop(root, '--bg')).toBe(DAYLIGHT.colour.bg);
    expect(prop(root, '--dr-radius')).toBe('9px');
    expect(root.getAttribute('data-theme')).toBe('light');
    expect(root.getAttribute('data-docreader-skin')).toBe('radius');
  });

  it('an op with no colour group removes every colour property, keeps the hosted state and the skin', async () => {
    const root = mount();
    await enhance(root, { appearance: dark({ skin: { radius: '4px' } }) });
    setEnhancementAppearance(root, { mode: 'dark', skin: { radius: '5px' } });
    expect(set(root, COLOUR_PROPS)).toEqual([]);
    expect(root.hasAttribute('data-docreader-colours')).toBe(false);
    expect(root.hasAttribute('data-docreader-hosted')).toBe(true);
    expect(prop(root, '--dr-radius')).toBe('5px');
    expect(root.getAttribute('data-theme')).toBe('dark');
  });

  it('an op that leaves a skin slot out removes its property; one with no skin removes the attribute', async () => {
    const root = mount();
    await enhance(root, { appearance: dark({ skin: { radius: '4px', sectionCase: 'uppercase' } }) });
    expect(root.getAttribute('data-docreader-skin')).toBe('radius sectionCase');
    setEnhancementAppearance(root, dark({ skin: { sectionCase: 'none' } }));
    expect(prop(root, '--dr-radius')).toBe('');
    expect(prop(root, '--dr-section-case')).toBe('none');
    expect(root.getAttribute('data-docreader-skin')).toBe('sectionCase');
    setEnhancementAppearance(root, dark());
    expect(set(root, SKIN_PROPS)).toEqual([]);
    expect(root.hasAttribute('data-docreader-skin')).toBe(false);
  });

  it('mode sets data-theme (light, dark) or removes it (auto), over the reader theme pref', async () => {
    const root = mount();
    await enhance(root, { appearance: dark(), prefs: { theme: 'light' } });
    expect(root.getAttribute('data-theme')).toBe('dark');
    setEnhancementAppearance(root, { mode: 'auto' });
    expect(root.hasAttribute('data-theme')).toBe(false);
    setEnhancementAppearance(root, light());
    expect(root.getAttribute('data-theme')).toBe('light');
  });

  it('an op on an unhosted mount makes it hosted, for good', async () => {
    const root = mount();
    await enhance(root);
    expect(root.hasAttribute('data-docreader-hosted')).toBe(false);
    setEnhancementAppearance(root, { mode: 'dark' });
    expect(root.hasAttribute('data-docreader-hosted')).toBe(true);
    expect(root.getAttribute('data-theme')).toBe('dark');
    setEnhancementAppearance(root, { mode: 'auto', skin: { radius: '1px' } });
    expect(root.hasAttribute('data-docreader-hosted')).toBe(true);
  });

  it('a malformed op changes nothing: not an object, null, an array, a function, a string', async () => {
    const root = mount();
    await enhance(root, { appearance: dark({ skin: { radius: '4px' } }) });
    const before = stamp(root);
    const css = root.style.cssText;
    for (const v of [undefined, null, 5, 'dark', [], [1], () => 1, true, Symbol('x')]) {
      expect(() => setEnhancementAppearance(root, v)).not.toThrow();
      expect(stamp(root), String(typeof v)).toBe(before);
      expect(root.style.cssText).toBe(css);
    }
  });

  it('an op for a root that is not enhanced does nothing and does not throw', () => {
    const root = mount();
    expect(() => setEnhancementAppearance(root, dark())).not.toThrow();
    expect(root.hasAttribute('data-docreader-hosted')).toBe(false);
    expect(() => setEnhancementAppearance({} as HTMLElement, dark())).not.toThrow();
  });

  it("emits the reader's 'prefs' event and a new 'appearance' event carrying the verdict", async () => {
    const root = mount();
    await enhance(root);
    const ctx = contextOf(root)!;
    const seen: [string, unknown][] = [];
    ctx.events.on('prefs', (p) => void seen.push(['prefs', p.theme]));
    ctx.events.on('appearance', (a) => void seen.push(['appearance', a]));
    const a = light({ label: 'Mine' });
    setEnhancementAppearance(root, a);
    expect(seen).toEqual([['prefs', 'light'], ['appearance', a]]);
    expect(EVENT_NAMES).toContain('appearance');
  });

  it('a skin change leaves the layout alone; a controlRow change closes an open popover and asks for one relayout', async () => {
    const root = mount();
    await enhance(root, { appearance: dark({ skin: { controlRow: '44px' } }) });
    const ctx = contextOf(root)!;
    const reasons: string[] = [];
    ctx.events.on('relayout', (e) => void reasons.push(...e.reasons));
    click(root.querySelector('.aa-btn')!);
    expect(menu(root).hidden).toBe(false);
    setEnhancementAppearance(root, dark({ skin: { controlRow: '44px', radius: '3px' } }));
    expect(menu(root).hidden).toBe(false); // controlRow unchanged: the popover stays where it is
    setEnhancementAppearance(root, dark({ skin: { controlRow: '36px' } }));
    expect(menu(root).hidden).toBe(true); // closed, never moved
    await new Promise((r) => setTimeout(r, 60));
    expect(reasons).toContain('prefs');
  });

  it('a skin op that leaves controlRow alone asks for no relayout', async () => {
    const root = mount();
    await enhance(root, { appearance: dark({ skin: { controlRow: '44px' } }) });
    await new Promise((r) => setTimeout(r, 60));
    const ctx = contextOf(root)!;
    const reasons: string[] = [];
    ctx.events.on('relayout', (e) => void reasons.push(...e.reasons));
    setEnhancementAppearance(root, dark({ skin: { controlRow: '44px', radius: '3px' } }));
    setEnhancementAppearance(root, light({ skin: { controlRow: '44px' } }));
    await new Promise((r) => setTimeout(r, 60));
    expect(reasons).toEqual([]);
  });
});

describe('test 3: the stored theme', () => {
  const stored = (theme: string): ReaderStorage => ({ snapshot: { 'docreader:prefs': JSON.stringify({ theme, width: 'wide' }) } });

  it('stored {"theme":"dark"} is ignored with an appearance, whose mode wins', async () => {
    const root = mount();
    await enhance(root, { storage: stored('dark'), appearance: light() });
    expect(root.getAttribute('data-theme')).toBe('light');
    expect(root.getAttribute('data-width')).toBe('wide'); // the rest of the stored prefs stand
  });

  it('stored {"theme":"dark"} is honoured without one', async () => {
    const root = mount();
    await enhance(root, { storage: stored('dark') });
    expect(root.getAttribute('data-theme')).toBe('dark');
  });

  it('an explicit theme in options.prefs does not win over the verdict either', async () => {
    const root = mount();
    await enhance(root, { prefs: { theme: 'dark' }, appearance: { mode: 'auto' } });
    expect(root.hasAttribute('data-theme')).toBe(false);
  });

  it('a prefs change while hosted never writes theme, and drops the stored one from what it writes', async () => {
    const sets: [string, string | null][] = [];
    const storage: ReaderStorage = { snapshot: { 'docreader:prefs': JSON.stringify({ theme: 'dark', width: 'standard' }) }, set: (k, v) => void sets.push([k, v]) };
    const root = mount();
    await enhance(root, { storage, appearance: light() });
    setEnhancementPrefs(root, { width: 'wide' });
    expect(sets).toHaveLength(1);
    const written = JSON.parse(sets[0]![1] as string) as Record<string, unknown>;
    expect(written).toEqual({ width: 'wide' });
    expect('theme' in written).toBe(false);
  });

  it('setEnhancementPrefs({theme}) while hosted is ignored for theme, and writes nothing for it', async () => {
    const sets: [string, string | null][] = [];
    const root = mount();
    await enhance(root, { storage: { set: (k, v) => void sets.push([k, v]) }, appearance: light() });
    const ctx = contextOf(root)!;
    const seen: string[] = [];
    ctx.events.on('prefs', (p) => void seen.push(p.theme));
    setEnhancementPrefs(root, { theme: 'dark' });
    expect(root.getAttribute('data-theme')).toBe('light');
    setEnhancementPrefs(root, { theme: 'dark', font: 'sans' });
    expect(root.getAttribute('data-theme')).toBe('light');
    expect(root.getAttribute('data-font')).toBe('sans');
    for (const [, v] of sets) expect(JSON.parse(v as string)).not.toHaveProperty('theme');
    for (const t of seen) expect(t).toBe('light');
  });

  it('a setEnhancementPrefs({theme}) queued beside a queued appearance during startup is ignored for theme: the mount is hosted and nothing stored carries theme', async () => {
    const sets: [string, string | null][] = [];
    const root = mount();
    const storage: ReaderStorage = {
      // The snapshot is read while the state is being made: both calls are queued, the appearance first by the host's own order.
      get snapshot(): Record<string, string> {
        setEnhancementAppearance(root, { mode: 'light' });
        setEnhancementPrefs(root, { theme: 'dark' });
        return {};
      },
      set: (k, v) => void sets.push([k, v]),
    };
    await enhance(root, { storage });
    expect(root.hasAttribute('data-docreader-hosted')).toBe(true);
    expect(root.getAttribute('data-theme')).toBe('light');
    expect(contextOf(root)!.state.prefs.theme).toBe('light');
    setEnhancementPrefs(root, { width: 'wide' }); // a write that does happen
    expect(sets.length).toBeGreaterThan(0);
    for (const [, v] of sets) expect(JSON.parse(v as string)).not.toHaveProperty('theme');
  });

  it('a queued appearance is applied, never dropped: the mount it was queued on is hosted and shows its colours', async () => {
    const root = mount();
    const storage: ReaderStorage = {
      get snapshot(): Record<string, string> {
        setEnhancementAppearance(root, dark({ label: 'Queued' }));
        return {};
      },
    };
    await enhance(root, { storage });
    expect(root.hasAttribute('data-docreader-hosted')).toBe(true);
    expect(prop(root, '--bg')).toBe(PHOSPHOR.colour.bg);
    expect(root.querySelector('p.aa-hosted')!.textContent).toBe('Queued');
  });

  it('a mount with no appearance still writes theme (1.1.0)', async () => {
    const sets: [string, string | null][] = [];
    const root = mount();
    await enhance(root, { storage: { set: (k, v) => void sets.push([k, v]) } });
    setEnhancementPrefs(root, { theme: 'dark' });
    expect(JSON.parse(sets.at(-1)![1] as string)).toMatchObject({ theme: 'dark' });
  });
});

describe('test 6 (rendered): the label, and test 3: Aa has no theme row', () => {
  const line = (root: Element): HTMLElement | null => root.querySelector('p.aa-hosted');

  it('with an appearance Aa has no theme row (no radios, no Theme legend) and one static line in its place', async () => {
    const root = mount();
    await enhance(root, { appearance: dark({ label: 'Follows the host' }) });
    expect(themeRadios(root)).toEqual([]);
    expect(Array.from(menu(root).querySelectorAll('legend'), (l) => l.textContent)).not.toContain('Theme');
    const p = line(root)!;
    expect(p.textContent).toBe('Follows the host');
    expect(menu(root).firstElementChild).toBe(p); // where the theme row was
    expect(menu(root).querySelectorAll('p.aa-hosted')).toHaveLength(1);
    // The other rows stand.
    expect(root.querySelectorAll('input[data-pref="font"], input[data-pref="width"], input[data-pref="lens"]').length).toBe(6);
  });

  it('the line is plain text: not focusable, no role, no tabindex, no control inside', async () => {
    const root = mount();
    await enhance(root, { appearance: dark() });
    const p = line(root)!;
    expect(p.localName).toBe('p');
    expect(p.hasAttribute('tabindex')).toBe(false);
    expect(p.hasAttribute('role')).toBe(false);
    expect(p.querySelectorAll('*')).toHaveLength(0);
    expect(p.matches('a, button, input, [tabindex]')).toBe(false);
  });

  it('with no label the line is the default; so for a refused label (65 units, empty, a bidi mark)', async () => {
    for (const label of [undefined, 'x'.repeat(65), '', 'a‮b']) {
      const root = mount();
      await enhance(root, { appearance: { mode: 'dark', ...(label === undefined ? {} : { label }) } });
      expect(line(root)!.textContent, JSON.stringify(label)).toBe(APPEARANCE_LABEL_DEFAULT);
    }
  });

  it('a label of 64 code units shows whole; 32 astral characters count 64', async () => {
    const root = mount();
    await enhance(root, { appearance: dark({ label: 'x'.repeat(64) }) });
    expect(line(root)!.textContent).toBe('x'.repeat(64));
    const root2 = mount();
    await enhance(root2, { appearance: dark({ label: '\u{1F600}'.repeat(32) }) });
    expect(line(root2)!.textContent).toBe('\u{1F600}'.repeat(32));
    const root3 = mount();
    await enhance(root3, { appearance: dark({ label: '\u{1F600}'.repeat(33) }) });
    expect(line(root3)!.textContent).toBe(APPEARANCE_LABEL_DEFAULT);
  });

  it('a label of <b>x</b> shows those eight characters and the line holds no element', async () => {
    const root = mount();
    await enhance(root, { appearance: dark({ label: '<b>x</b>' }) });
    const p = line(root)!;
    expect(p.textContent).toBe('<b>x</b>');
    expect(p.textContent).toHaveLength(8);
    expect(p.childElementCount).toBe(0);
    expect(p.querySelector('b')).toBeNull();
  });

  it('the line follows each appearance change, label or default', async () => {
    const root = mount();
    await enhance(root, { appearance: dark({ label: 'One' }) });
    setEnhancementAppearance(root, dark({ label: 'Two' }));
    expect(line(root)!.textContent).toBe('Two');
    setEnhancementAppearance(root, dark());
    expect(line(root)!.textContent).toBe(APPEARANCE_LABEL_DEFAULT);
    expect(menu(root).querySelectorAll('p.aa-hosted')).toHaveLength(1);
  });

  it('without an appearance Aa keeps its theme row and has no hosted line', async () => {
    const root = mount();
    await enhance(root);
    expect(themeRadios(root).map((r) => r.value)).toEqual(['auto', 'light', 'dark']);
    expect(line(root)).toBeNull();
  });

  it('an op on a mount that was not hosted replaces the theme row by the line, in place', async () => {
    const root = mount();
    await enhance(root);
    const first = menu(root).firstElementChild;
    expect(first?.querySelector('input[data-pref="theme"]')).not.toBeNull();
    setEnhancementAppearance(root, dark({ label: 'Now hosted' }));
    expect(themeRadios(root)).toEqual([]);
    expect(menu(root).firstElementChild).toBe(line(root));
    expect(line(root)!.textContent).toBe('Now hosted');
  });
});

describe('the journal: the slot properties are a closed list derived from SLOT_PROPERTY', () => {
  const styled = (): { el: HTMLElement; setStyle: ReturnType<typeof createJournal>['journal']['setStyle'] } => {
    const el = document.createElement('div');
    return { el, setStyle: createJournal(() => true, (fn) => fn()).journal.setStyle };
  };

  it('every colour and skin property of SLOT_PROPERTY is accepted, and writing null removes it', () => {
    const { el, setStyle } = styled();
    for (const name of [...COLOUR_PROPS, ...SKIN_PROPS]) {
      setStyle(el, name as never, '#112233');
      expect(el.style.getPropertyValue(name), name).toBe('#112233');
      setStyle(el, name as never, null);
      expect(el.style.getPropertyValue(name), name).toBe('');
    }
  });

  it('a property that is no slot property, or not with the right priority, is refused', () => {
    const { el, setStyle } = styled();
    for (const name of ['--evil', '--dr-evil', '--bg2', 'color', '--dr-tip', '--dr-tip-bg2', '--syn-evil']) expect(() => setStyle(el, name as never, '#112233'), name).toThrow(/refuses the property/);
    expect(() => setStyle(el, '--bg' as never, '#112233', true)).toThrow(/important/);
  });

  it('a value that could escape or load a resource is refused for a slot property too', () => {
    const { el, setStyle } = styled();
    for (const v of ['url(x)', '#fff; color: red', '}', 'x'.repeat(201)]) expect(() => setStyle(el, '--bg' as never, v)).toThrow(/refuses this value/);
  });

  it('the list holds exactly the 43 slot properties: no two slots share one', () => {
    expect(new Set([...COLOUR_PROPS, ...SKIN_PROPS]).size).toBe(43);
  });
});

describe('test 7: the host faces (a fake FontFace)', () => {
  let faces: FakeFace[];
  let added: FakeFace[];
  let deleted: FakeFace[];
  let rejectLoads: boolean;
  let ctorThrows: boolean;

  class FakeFace {
    status = 'unloaded';
    family: string;
    source: unknown;
    descriptors: Record<string, string> | undefined;
    constructor(family: string, source: unknown, descriptors?: Record<string, string>) {
      if (ctorThrows) throw new Error('ctor');
      this.family = family;
      this.source = source;
      this.descriptors = descriptors;
      faces.push(this);
    }
    load(): Promise<FakeFace> {
      return rejectLoads ? Promise.reject(new Error('bad font')) : Promise.resolve(this);
    }
  }

  const b64 = (bytes: Uint8Array): string => Buffer.from(bytes).toString('base64');
  const woff2 = (n = 64): Uint8Array => {
    const b = new Uint8Array(n);
    b.set([0x77, 0x4f, 0x46, 0x32]);
    return b;
  };

  beforeEach(() => {
    faces = [];
    added = [];
    deleted = [];
    rejectLoads = false;
    ctorThrows = false;
    vi.stubGlobal('FontFace', FakeFace);
    Object.defineProperty(document, 'fonts', { configurable: true, value: { add: (f: FakeFace) => void added.push(f), delete: (f: FakeFace) => void deleted.push(f) } });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(document, 'fonts');
  });

  it('a good face loads under its fixed family name from the decoded bytes and is added to the document', async () => {
    const bytes = woff2(100);
    await expect(loadHostFonts({ sans: b64(bytes), mono: b64(woff2(7)) })).resolves.toBeUndefined();
    expect(faces.map((f) => f.family)).toEqual(['Docreader Host Sans', 'Docreader Host Mono']);
    expect(Array.from(new Uint8Array((faces[0]!.source as { buffer?: ArrayBuffer }).buffer ?? (faces[0]!.source as ArrayBuffer)))).toEqual(Array.from(bytes));
    expect(added).toEqual(faces);
    expect(deleted).toEqual([]);
  });

  // A synthetic WOFF2: the 48-byte header (numTables at offset 12) and a table directory of the given entries.
  const entry = {
    cmap: [0, 0x05], // flags (index 0), origLength; no transform
    glyf: [10, 0x81, 0x00, 0x03], // transform version 0: origLength (two bytes), transformLength
    loca: [11, 0x05, 0x00],
    hmtx: [3 | (1 << 6), 0x10, 0x08], // version 1: transformLength follows
    fvar: [47, 0x20],
    arbitrary: [63, 0x61, 0x62, 0x63, 0x64, 0x05], // an explicit tag 'abcd', then origLength
  };
  const directory = (entries: number[][], numTables = entries.length): Uint8Array => {
    const b = new Uint8Array(48);
    b.set([0x77, 0x4f, 0x46, 0x32]);
    b[13] = numTables;
    return Uint8Array.from([...b, ...entries.flat()]);
  };
  const descriptorsOf = async (bytes: Uint8Array): Promise<Record<string, string> | undefined> => {
    faces.length = 0;
    await expect(loadHostFonts({ sans: b64(bytes) })).resolves.toBeUndefined();
    expect(faces).toHaveLength(1);
    return faces[0]!.descriptors;
  };

  it("every face is added with display 'swap', a static one with no weight range", async () => {
    await loadHostFonts({ sans: b64(woff2()), mono: b64(directory([entry.cmap, entry.glyf, entry.hmtx])) });
    expect(faces.map((f) => f.descriptors)).toEqual([{ display: 'swap' }, { display: 'swap' }]);
  });

  it('a variable face (an fvar entry in the directory) gets the weight range, after glyf, loca and hmtx entries whose transform lengths are skipped', async () => {
    expect(await descriptorsOf(directory([entry.fvar]))).toEqual({ display: 'swap', weight: '100 900' });
    expect(await descriptorsOf(directory([entry.cmap, entry.glyf, entry.loca, entry.hmtx, entry.fvar]))).toEqual({ display: 'swap', weight: '100 900' });
    expect(await descriptorsOf(directory([entry.arbitrary, entry.glyf, entry.fvar]))).toEqual({ display: 'swap', weight: '100 900' });
  });

  it('a directory with no fvar entry, whatever else it names, is static', async () => {
    expect(await descriptorsOf(directory([entry.cmap, entry.glyf, entry.loca, entry.hmtx, entry.arbitrary]))).toEqual({ display: 'swap' });
    // glyf at version 0 carries a transformLength (here 0x00) after its origLength: skipped, so the entry after it is read as fvar.
    expect(await descriptorsOf(directory([[10, 0x05, 0x00], [47, 0x20]]))).toEqual({ display: 'swap', weight: '100 900' });
  });

  it('a truncated directory, an integer that never ends, or a count beyond the buffer is static, and nothing throws', async () => {
    expect(await descriptorsOf(directory([entry.cmap, [10, 0x81]], 5))).toEqual({ display: 'swap' }); // ends inside glyf's lengths
    expect(await descriptorsOf(directory([[0, 0x81, 0x81, 0x81, 0x81, 0x81, 0x81], entry.fvar]))).toEqual({ display: 'swap' }); // six continuation bytes
    expect(await descriptorsOf(directory([entry.cmap], 60))).toEqual({ display: 'swap' }); // 60 entries promised, one present
    expect(await descriptorsOf(directory([entry.cmap], 255))).toEqual({ display: 'swap' }); // beyond the 64 bound
    const short = Uint8Array.from([0x77, 0x4f, 0x46, 0x32, 1, 2, 3]); // not even a header
    expect(await descriptorsOf(short)).toEqual({ display: 'swap' });
  });

  it("the library's own variable faces are read as variable (the fvar index is the spec's 47)", async () => {
    for (const file of ['source-sans-3-latin-wght-normal.woff2', 'source-serif-4-latin-opsz-normal.woff2']) {
      expect(await descriptorsOf(new Uint8Array(readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'fonts', file)))), file).toEqual({ display: 'swap', weight: '100 900' });
    }
  });

  it('each role stands alone: only sans, only mono', async () => {
    await loadHostFonts({ mono: b64(woff2()) });
    expect(faces.map((f) => f.family)).toEqual(['Docreader Host Mono']);
  });

  it.each([
    ['a base64 alphabet violation', 'not base64!!'],
    ['a URL-safe alphabet', 'AAAA-_8='],
    ['whitespace', 'd09G\nMg=='],
    ['a missing signature', b64(new Uint8Array([0x77, 0x4f, 0x46, 0x46, 1, 2, 3]))],
    ['a signature one byte short', b64(new Uint8Array([0x77, 0x4f, 0x46]))],
    ['an empty string', ''],
    // The bootstrap's seed check is the alphabet only, so a string atob itself refuses reaches here: dropped, never thrown.
    ['a string atob refuses (length 9)', 'd09GMgAAA'],
    ['a string atob refuses (bad padding)', 'd09GMg='],
    ['over the cap by one decoded byte', b64(woff2(131073))],
  ])('%s: the face is dropped, nothing is constructed, the call resolves', async (_why, text) => {
    await expect(loadHostFonts({ sans: text })).resolves.toBeUndefined();
    expect(faces).toEqual([]);
    expect(added).toEqual([]);
  });

  it('the two atob-refused strings really do make atob throw (the rows above are not vacuous)', () => {
    expect(() => atob('d09GMgAAA')).toThrow();
    expect(() => atob('d09GMg=')).toThrow();
  });

  it('exactly the cap (131 072 bytes) is accepted', async () => {
    await loadHostFonts({ sans: b64(woff2(131072)) });
    expect(faces).toHaveLength(1);
  });

  // Review 2906 F9: the pre-decode guard is the contract's face cap in characters (SEED_LIMITS.fontFaceMaxChars), not a looser
  // bound. No string just over it decodes to a face the byte check would pass, so the guard's effect is its cost: the decoder
  // is not run on it. A string at the cap reaches the decoder (and the byte check drops it); one character more does not.
  it("a string over the contract's face cap in characters is never decoded; one at the cap is", async () => {
    const atobSpy = vi.spyOn(globalThis, 'atob');
    const cap = SEED_LIMITS.fontFaceMaxChars;
    expect(cap).toBe(174764);
    for (const over of [cap + 1, cap + 4, 183_500, 183_501, 400_000]) {
      await expect(loadHostFonts({ sans: 'A'.repeat(over) })).resolves.toBeUndefined();
      expect(atobSpy, `${String(over)} characters`).not.toHaveBeenCalled();
    }
    await expect(loadHostFonts({ sans: 'A'.repeat(cap) })).resolves.toBeUndefined(); // 131 073 bytes, no signature: dropped after the decode
    expect(atobSpy).toHaveBeenCalledTimes(1);
    expect(faces).toEqual([]);
    expect(added).toEqual([]);
  });

  it('a face whose load rejects is dropped from the document font set, and the call still resolves', async () => {
    rejectLoads = true;
    await expect(loadHostFonts({ sans: b64(woff2()), mono: b64(woff2()) })).resolves.toBeUndefined();
    expect(added).toHaveLength(2);
    expect(deleted).toEqual(added);
  });

  it('a constructor that throws drops that face; the other role still loads', async () => {
    ctorThrows = true;
    await expect(loadHostFonts({ sans: b64(woff2()) })).resolves.toBeUndefined();
    expect(added).toEqual([]);
  });

  it('a bad face in one role leaves the other role loading (each face is judged on its own)', async () => {
    await loadHostFonts({ sans: 'd09GMgAAA', mono: b64(woff2()) });
    expect(faces.map((f) => f.family)).toEqual(['Docreader Host Mono']);
    faces.length = 0;
    ctorThrows = false;
    await loadHostFonts({ sans: 'not base64!!', mono: b64(woff2()) });
    expect(faces.map((f) => f.family)).toEqual(['Docreader Host Mono']);
  });

  it('never throws, whatever it is handed', async () => {
    const hostile = [undefined, null, 5, 'x', [], () => 1, { get sans(): string { throw new Error('getter'); } }, { sans: 5, mono: {} }, new Proxy({}, { ownKeys: () => { throw new Error('trap'); } })];
    for (const v of hostile) await expect(loadHostFonts(v)).resolves.toBeUndefined();
    expect(faces).toEqual([]);
  });

  it('a getter is never called: a face written as an accessor is dropped', async () => {
    const spy = vi.fn(() => b64(woff2()));
    await loadHostFonts(Object.defineProperty({}, 'sans', { get: spy, enumerable: true }));
    expect(spy).not.toHaveBeenCalled();
    expect(faces).toEqual([]);
  });

  it('a document with no font set does not throw', async () => {
    Reflect.deleteProperty(document, 'fonts');
    await expect(loadHostFonts({ sans: b64(woff2()) })).resolves.toBeUndefined();
  });
});

describe("test 7: the frame runtime's entry (the html mark and the registered members)", () => {
  type Api = {
    enhance(root: HTMLElement, options?: unknown): Promise<void>;
    setEnhancementAppearance(root: HTMLElement, value: unknown): void;
    loadHostFonts(fonts: unknown): Promise<void>;
  } & Record<string, unknown>;

  const html = document.documentElement;
  const tip = (): string[] => ['--dr-tip-bg', '--dr-tip-fg', '--dr-tip-edge'].map((p) => html.style.getPropertyValue(p));

  async function register(): Promise<Api> {
    const script = document.createElement('script');
    const seen: { api: Api }[] = [];
    script.addEventListener('docserver:register', (e) => void seen.push((e as CustomEvent<{ api: Api }>).detail));
    Object.defineProperty(document, 'currentScript', { configurable: true, get: () => script });
    try {
      vi.resetModules();
      await import('../src/frame-runtime/enhance-entry.js');
    } finally {
      Reflect.deleteProperty(document, 'currentScript');
    }
    return seen[0]!.api;
  }

  afterEach(() => {
    html.removeAttribute('data-docreader-hosted');
    for (const p of ['--dr-tip-bg', '--dr-tip-fg', '--dr-tip-edge']) html.style.removeProperty(p);
  });

  it('registers the reader api with the two appearance members and the reader mode member', async () => {
    const api = await register();
    expect(Object.keys(api).sort()).toEqual(['destroyEnhancement', 'enhance', 'goToHash', 'loadHostFonts', 'runEnhancementCommand', 'setEnhancementAppearance', 'setEnhancementPrefs', 'setEnhancementReading']);
  });

  it('an op with a colour group marks html and sets the three tooltip properties from surface, text and border', async () => {
    const api = await register();
    const root = mount();
    await api.enhance(root, {});
    api.setEnhancementAppearance(root, dark());
    expect(html.hasAttribute('data-docreader-hosted')).toBe(true);
    expect(tip()).toEqual([PHOSPHOR.colour.surface, PHOSPHOR.colour.text, PHOSPHOR.colour.border]);
    // and the reader got the same value
    expect(root.hasAttribute('data-docreader-colours')).toBe(true);
  });

  it('the initial enhance option sets them before the reader runs', async () => {
    const api = await register();
    const root = mount();
    const p = api.enhance(root, { appearance: dark() });
    expect(html.hasAttribute('data-docreader-hosted')).toBe(true);
    expect(tip()).toEqual([PHOSPHOR.colour.surface, PHOSPHOR.colour.text, PHOSPHOR.colour.border]);
    await p;
  });

  it('a verdict with no colour group removes the mark and the three properties', async () => {
    const api = await register();
    const root = mount();
    await api.enhance(root, { appearance: dark() });
    api.setEnhancementAppearance(root, { mode: 'dark' });
    expect(html.hasAttribute('data-docreader-hosted')).toBe(false);
    expect(tip()).toEqual(['', '', '']);
    expect(root.hasAttribute('data-docreader-hosted')).toBe(true); // the root stays hosted
  });

  it('a bad colour value is a verdict with no colour group: the properties clear', async () => {
    const api = await register();
    const root = mount();
    await api.enhance(root, { appearance: dark() });
    api.setEnhancementAppearance(root, { mode: 'dark', colour: { ...PHOSPHOR.colour, surface: 'nope' } });
    expect(html.hasAttribute('data-docreader-hosted')).toBe(false);
    expect(tip()).toEqual(['', '', '']);
  });

  it('the mark follows the reader (review 2906 F11): an op on a root the reader does not hold leaves html unmarked', async () => {
    const api = await register();
    const never = mount();
    api.setEnhancementAppearance(never, dark());
    expect(html.hasAttribute('data-docreader-hosted')).toBe(false);
    expect(tip()).toEqual(['', '', '']);
    // a root that was enhanced and is gone is no longer held either
    const gone = mount();
    await api.enhance(gone, {});
    await (api as unknown as { destroyEnhancement(root: HTMLElement): Promise<void> }).destroyEnhancement(gone);
    api.setEnhancementAppearance(gone, dark());
    expect(html.hasAttribute('data-docreader-hosted')).toBe(false);
    expect(tip()).toEqual(['', '', '']);
  });

  it('the entry hands the reader\'s own functions over, but `enhance` (wrapped for the item link\'s href only) and so touches no element itself (review 2906 F10)', async () => {
    const api = await register();
    const reader = await import('../src/enhance/index.js'); // the registry register() left: the entry's own copy
    expect(api['setEnhancementAppearance']).toBe(reader.setEnhancementAppearance);
    // `enhance` is the one wrapped member (docserver parity T4): wrapEnhance(reader.enhance), whose behaviour is held with a fake
    // `enhance` below (the same options object, or a copy that differs in `itemLink` alone, and no element touched).
    // That the registered `enhance` is that wrapper over the reader's own, and not some other function, is pinned end to end by the
    // item-link rows of test/enhance-frame-wire.test.ts, which call the registered api.enhance on a document and read the reader's
    // own item links (`a.item-link`, the root's marks) and its https check from the result: a wrapper that dropped the reader, or
    // one that passed an href on unchecked, would fail there. A comparison of source text here would pin nothing more.
    expect(api['destroyEnhancement']).toBe(reader.destroyEnhancement);
  });

  it('the mark is the reader\'s journaled write: a host\'s own value on html comes back at teardown, and the reader\'s do not outlast it (review 2906 F10)', async () => {
    const api = await register();
    html.setAttribute('data-docreader-hosted', 'host');
    html.style.setProperty('--dr-tip-bg', 'red');
    const root = mount();
    await api.enhance(root, { appearance: dark() });
    expect(html.getAttribute('data-docreader-hosted')).toBe('');
    expect(tip()).toEqual([PHOSPHOR.colour.surface, PHOSPHOR.colour.text, PHOSPHOR.colour.border]);
    await (api as unknown as { destroyEnhancement(root: HTMLElement): Promise<void> }).destroyEnhancement(root);
    expect(html.getAttribute('data-docreader-hosted')).toBe('host');
    expect(tip()).toEqual(['red', '', '']);
  });

  it('a root that is the document element needs no mark, and loses none of its own (review 2906 F10)', async () => {
    const api = await register();
    const parsed = new DOMParser().parseFromString(`<!doctype html><html><body>${render(DOC).html}</body></html>`, 'text/html');
    const top = parsed.documentElement;
    await api.enhance(top, { appearance: { mode: 'dark' } });
    expect(top.hasAttribute('data-docreader-hosted'), 'its own hosted attribute').toBe(true);
    expect(top.hasAttribute('data-docreader-colours')).toBe(false);
    expect(top.getAttribute('style') ?? '').not.toContain('--dr-tip');
    await (api as unknown as { destroyEnhancement(root: HTMLElement): Promise<void> }).destroyEnhancement(top);
  });

  it('destroying the reader clears the mark and the three tooltip properties', async () => {
    const api = await register();
    const root = mount();
    await api.enhance(root, { appearance: dark() });
    expect(html.hasAttribute('data-docreader-hosted')).toBe(true);
    await (api as unknown as { destroyEnhancement(root: HTMLElement): Promise<void> }).destroyEnhancement(root);
    expect(html.hasAttribute('data-docreader-hosted')).toBe(false);
    expect(tip()).toEqual(['', '', '']);
  });

  it('a value that is not a plain object leaves the mark as it was', async () => {
    const api = await register();
    const root = mount();
    await api.enhance(root, { appearance: dark() });
    for (const v of [null, 5, 'x', []]) api.setEnhancementAppearance(root, v);
    expect(html.hasAttribute('data-docreader-hosted')).toBe(true);
    expect(tip()[0]).toBe(PHOSPHOR.colour.surface);
  });

  it('with no appearance the html element is left alone', async () => {
    const api = await register();
    await api.enhance(mount(), {});
    expect(html.hasAttribute('data-docreader-hosted')).toBe(false);
    expect(tip()).toEqual(['', '', '']);
  });

  it('a later op with another colour group replaces the values', async () => {
    const api = await register();
    const root = mount();
    await api.enhance(root, { appearance: dark() });
    api.setEnhancementAppearance(root, light());
    expect(tip()).toEqual([DAYLIGHT.colour.surface, DAYLIGHT.colour.text, DAYLIGHT.colour.border]);
  });
});

// Second review F8: the `html` mark and `--dr-tip-*` are one shared write on the document element, and a page may hold
// several hosted roots. The mark is counted (it stays while any hosted root with colours holds it) and the tooltip's three
// properties follow the most recent hosted root with colours, last writer wins, because the tooltip is one element per
// document. This block reads the page's `documentElement`, which the two-root mounts above never did.
describe('second review F8: several hosted roots in one document share the html mark', () => {
  const html = document.documentElement;
  const TIP = ['--dr-tip-bg', '--dr-tip-fg', '--dr-tip-edge'];
  const tip = (): string[] => TIP.map((p) => html.style.getPropertyValue(p));
  const tipOf = (f: { colour: Record<AppearanceColourSlot, string> }): string[] => [f.colour.surface, f.colour.text, f.colour.border];
  const marked = (): boolean => html.hasAttribute('data-docreader-hosted');

  afterEach(() => {
    html.removeAttribute('data-docreader-hosted');
    html.removeAttribute('style');
  });

  it('a host\'s own important value is put back important', () => { html.style.setProperty('--dr-tip-bg', 'red', 'important'); const { journal, undoAll } = createJournal(() => true, (fn) => fn()); journal.setDocumentTip(html, ['blue', 'green', 'black']); expect(tip()[0]).toBe('blue'); expect(undoAll()).toEqual([]); expect(html.style.getPropertyValue('--dr-tip-bg')).toBe('red'); expect(html.style.getPropertyPriority('--dr-tip-bg')).toBe('important'); });

  it('two roots with different colours: html is marked and the tooltip follows the later one; destroying the first keeps both; destroying the last restores what was there', async () => {
    html.setAttribute('data-docreader-hosted', 'host');
    html.style.setProperty('--dr-tip-bg', 'red');
    const a = mount();
    const b = mount();
    await enhance(a, { appearance: dark() });
    await enhance(b, { appearance: light() });
    expect(marked()).toBe(true);
    expect(tip()).toEqual(tipOf(DAYLIGHT));
    await destroyEnhancement(a);
    expect(marked(), 'B is still hosted').toBe(true);
    expect(html.getAttribute('data-docreader-hosted')).toBe('');
    expect(tip(), "B's, untouched by A's teardown").toEqual(tipOf(DAYLIGHT));
    await destroyEnhancement(b);
    expect(html.getAttribute('data-docreader-hosted'), "what was there before the first hosted root").toBe('host');
    expect(tip()).toEqual(['red', '', '']);
  });

  it('destroying the later root hands the tooltip back to the earlier one, which keeps the mark', async () => {
    const a = mount();
    const b = mount();
    await enhance(a, { appearance: dark() });
    await enhance(b, { appearance: light() });
    await destroyEnhancement(b);
    expect(marked()).toBe(true);
    expect(tip()).toEqual(tipOf(PHOSPHOR));
    await destroyEnhancement(a);
    expect(marked()).toBe(false);
    expect(tip()).toEqual(['', '', '']);
    expect(html.hasAttribute('style'), 'the empty style attribute the CSSOM left is gone').toBe(false);
  });

  it('a verdict with no colour group on the later root hands the tooltip to the earlier one; a root with none keeps the mark off while no other holds it', async () => {
    const a = mount();
    const b = mount();
    await enhance(a, { appearance: dark() });
    await enhance(b, { appearance: light() });
    setEnhancementAppearance(b, { mode: 'light' });
    expect(marked()).toBe(true);
    expect(tip(), 'A still has colours, so the tooltip is A\'s').toEqual(tipOf(PHOSPHOR));
    setEnhancementAppearance(a, { mode: 'dark' });
    expect(marked(), 'no hosted root has colours now').toBe(false);
    expect(tip()).toEqual(['', '', '']);
  });

  it('a colourless op on the earlier root leaves the later root\'s tooltip alone', async () => {
    const a = mount();
    const b = mount();
    await enhance(a, { appearance: dark() });
    await enhance(b, { appearance: light() });
    setEnhancementAppearance(a, { mode: 'dark' });
    expect(marked()).toBe(true);
    expect(tip()).toEqual(tipOf(DAYLIGHT));
  });

  it('last writer wins: an op with colours on the earlier root takes the tooltip back', async () => {
    const a = mount();
    const b = mount();
    await enhance(a, { appearance: dark() });
    await enhance(b, { appearance: light() });
    setEnhancementAppearance(a, dark());
    expect(tip()).toEqual(tipOf(PHOSPHOR));
    await destroyEnhancement(a);
    expect(tip(), 'A is gone: the tooltip follows the remaining root').toEqual(tipOf(DAYLIGHT));
    expect(marked()).toBe(true);
  });

  it('a root that never had colours does not hold the mark, and its destroy leaves another\'s alone', async () => {
    const a = mount();
    const b = mount();
    await enhance(a, { appearance: dark() });
    await enhance(b, { appearance: { mode: 'light' } });
    expect(tip()).toEqual(tipOf(PHOSPHOR));
    await destroyEnhancement(b);
    expect(marked()).toBe(true);
    expect(tip()).toEqual(tipOf(PHOSPHOR));
  });

  it('a host that changed the mark or a tooltip property after the reader wrote it keeps its value when the last root leaves', async () => {
    const a = mount();
    await enhance(a, { appearance: dark() });
    html.style.setProperty('--dr-tip-fg', 'orange');
    html.removeAttribute('data-docreader-hosted');
    await destroyEnhancement(a);
    expect(html.style.getPropertyValue('--dr-tip-fg')).toBe('orange');
    expect(marked()).toBe(false);
    expect(html.style.getPropertyValue('--dr-tip-bg'), 'the ones it left alone are restored').toBe('');
  });

  it('a root that is the document element has the three tooltip properties on itself, and its colourless op removes them', async () => {
    const parsed = new DOMParser().parseFromString(`<!doctype html><html><body>${render(DOC).html}</body></html>`, 'text/html');
    const top = parsed.documentElement;
    await enhance(top, { appearance: dark() });
    expect(top.hasAttribute('data-docreader-hosted'), 'its own hosted attribute is the mark').toBe(true);
    expect(TIP.map((p) => top.style.getPropertyValue(p))).toEqual(tipOf(PHOSPHOR));
    setEnhancementAppearance(top, { mode: 'dark' });
    expect(TIP.map((p) => top.style.getPropertyValue(p))).toEqual(['', '', '']);
    setEnhancementAppearance(top, light());
    expect(TIP.map((p) => top.style.getPropertyValue(p))).toEqual(tipOf(DAYLIGHT));
    await destroyEnhancement(top);
    expect(TIP.map((p) => top.style.getPropertyValue(p))).toEqual(['', '', '']);
  });

  it('setDocumentTip on a journal that is not live writes nothing and holds nothing; a refused value throws before any write', () => {
    let alive = true;
    const { journal, undoAll } = createJournal(() => alive, (fn) => fn());
    expect(() => journal.setDocumentTip(html, ['red', 'url(x)', 'blue'])).toThrow(/refuses this value/);
    expect(() => journal.setDocumentTip(html, ['red', 'x'.repeat(201), 'blue'])).toThrow(/refuses this value/);
    expect(marked()).toBe(false);
    alive = false;
    journal.setDocumentTip(html, ['red', 'green', 'blue']);
    expect(marked(), 'a journal that is not live writes nothing').toBe(false);
    expect(tip()).toEqual(['', '', '']);
    alive = true;
    journal.setDocumentTip(html, ['red', 'green', 'blue']);
    expect(tip()).toEqual(['red', 'green', 'blue']);
    expect(undoAll()).toEqual([]);
    expect(marked()).toBe(false);
    expect(tip()).toEqual(['', '', '']);
  });

  it('a document-element root and another root cannot be hosted in one document, so the one never has the other\'s mark to undo (second review F8) while both are attached to it', async () => {
    // Ownership refuses a root that contains, or lies inside, another live root (lifecycle.ts, step 2), and every root attached to a
    // document lies inside its document element: the case "a document-element root is destroyed while another root holds a
    // tip" cannot be reached, whichever is enhanced first.
    const parsed = new DOMParser().parseFromString(`<!doctype html><html><body>${render(DOC).html}</body></html>`, 'text/html');
    const top = parsed.documentElement;
    const inner = parsed.body.firstElementChild as HTMLElement;
    await enhance(inner, { appearance: dark() });
    await expect(enhance(top, { appearance: light() })).rejects.toMatchObject({ code: 'ownership' });
    expect(TIP.map((p) => top.style.getPropertyValue(p)), "the refused root wrote nothing: the inner root's tip stands").toEqual(tipOf(PHOSPHOR));
    await destroyEnhancement(inner);
    expect(TIP.map((p) => top.style.getPropertyValue(p))).toEqual(['', '', '']);
    await enhance(top, { appearance: dark() });
    await expect(enhance(inner, { appearance: light() })).rejects.toMatchObject({ code: 'ownership' });
    expect(TIP.map((p) => top.style.getPropertyValue(p))).toEqual(tipOf(PHOSPHOR));
    await destroyEnhancement(top);
  });

  it('a root of another document keeps its own count: the two documents do not share a mark', async () => {
    const other = document.implementation.createHTMLDocument('other');
    const parsed = new DOMParser().parseFromString(`<!doctype html><body>${render(DOC).html}</body>`, 'text/html');
    const root = other.createElement('main');
    root.append(...Array.from(parsed.body.childNodes).map((n) => other.importNode(n, true)));
    other.body.append(root);
    const here = mount();
    await enhance(here, { appearance: dark() });
    await enhance(root, { appearance: light() });
    expect(tip()).toEqual(tipOf(PHOSPHOR));
    expect(TIP.map((p) => other.documentElement.style.getPropertyValue(p))).toEqual(tipOf(DAYLIGHT));
    await destroyEnhancement(root);
    expect(other.documentElement.hasAttribute('data-docreader-hosted')).toBe(false);
    expect(marked()).toBe(true);
    expect(tip()).toEqual(tipOf(PHOSPHOR));
  });
});

describe("the frame's enhance (docserver parity T4, review round 1): wrapEnhance forwards the options, and touches no element", () => {
  const HREF = 'https://tracker.example/AB-1';

  /** A fake `enhance` that records what it was given and writes nothing. */
  function fake(): { readonly inner: (root: HTMLElement, options?: Record<string, unknown>) => string; readonly calls: [HTMLElement, Record<string, unknown> | undefined][] } {
    const calls: [HTMLElement, Record<string, unknown> | undefined][] = [];
    return {
      calls,
      inner: (root, options) => {
        calls.push([root, options]);
        return 'the reader answered';
      },
    };
  }
  const rootOf = (): HTMLElement => {
    const root = document.createElement('main');
    root.innerHTML = '<h1>Title</h1><p>Body</p>';
    document.body.append(root);
    return root;
  };

  it('without an itemLink function it forwards the same root and the very same options object, and the reader\'s answer', () => {
    const { inner, calls } = fake();
    const enhanceInFrame = wrapEnhance(inner);
    const root = rootOf();
    const options = { folds: false, itemLink: 'not a function' };
    expect(enhanceInFrame(root, options)).toBe('the reader answered');
    expect(enhanceInFrame(root)).toBe('the reader answered');
    const noLink = { folds: false };
    enhanceInFrame(root, noLink);
    expect(calls).toHaveLength(3);
    expect(calls[0]?.[0] === root && calls[0]?.[1] === options).toBe(true);
    expect(calls[1]?.[1]).toBeUndefined();
    expect(calls[2]?.[1] === noLink).toBe(true);
    root.remove();
  });

  it('with an itemLink function it forwards a copy that differs in itemLink alone, and leaves the host\'s object as it was', () => {
    const { inner, calls } = fake();
    const root = rootOf();
    const seen: string[] = [];
    const given = (key: string): unknown => (seen.push(key), HREF);
    const storage = { snapshot: {} };
    const options = { folds: false, storage, vocabulary: { itemFields: ['Tracker'] }, itemLink: given };
    wrapEnhance(inner)(root, options);
    const forwarded = calls[0]?.[1] as Record<string, unknown>;
    expect(forwarded === options).toBe(false);
    expect(Object.keys(forwarded).sort()).toEqual(Object.keys(options).sort());
    for (const k of ['folds', 'storage', 'vocabulary']) expect(forwarded[k] === (options as Record<string, unknown>)[k], k).toBe(true);
    expect(options.itemLink === given).toBe(true); // the host's object is not changed
    expect(forwarded['itemLink'] === given).toBe(false);
    const ask = forwarded['itemLink'] as (k: string) => unknown;
    expect(ask('AB-1')).toBe(HREF);
    expect(seen).toEqual(['AB-1']);
    root.remove();
  });

  it('answers the href only when it is an absolute https: URL, else null', () => {
    const { inner, calls } = fake();
    const root = rootOf();
    for (const [answer, want] of [[HREF, HREF], ['http://tracker.example/AB-1', null], ['javascript:alert(1)', null], ['/AB-1', null], ['', null], [null, null], [7, null], [undefined, null]] as const) {
      calls.length = 0;
      wrapEnhance(inner)(root, { itemLink: () => answer });
      expect(((calls[0]?.[1] as Record<string, unknown>)['itemLink'] as () => unknown)(), String(answer)).toBe(want);
    }
    root.remove();
  });

  it('touches no element, attribute or text, in the root or the document, on either path', () => {
    const { inner } = fake();
    const root = rootOf();
    const before = [root.outerHTML, document.documentElement.outerHTML];
    const watch = new MutationObserver(() => undefined);
    watch.observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
    wrapEnhance(inner)(root, { itemLink: () => HREF });
    wrapEnhance(inner)(root, { folds: true });
    wrapEnhance(inner)(root);
    expect(watch.takeRecords()).toEqual([]);
    watch.disconnect();
    expect([root.outerHTML, document.documentElement.outerHTML]).toEqual(before);
    root.remove();
  });

  it('src/frame-runtime/enhance-wrap.ts names no DOM, global or storage API (the walls test\'s own kind of scan)', () => {
    const file = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'frame-runtime', 'enhance-wrap.ts');
    const sf = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.ES2022, true);
    const names: string[] = [];
    const walk = (n: ts.Node): void => {
      if (ts.isIdentifier(n) || ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) names.push(n.text);
      ts.forEachChild(n, walk);
    };
    walk(sf);
    const FORBIDDEN = [
      'document', 'window', 'self', 'globalThis', 'top', 'parent', 'location', 'history', 'navigator',
      'createElement', 'createTextNode', 'setAttribute', 'removeAttribute', 'appendChild', 'append', 'prepend', 'insertBefore', 'replaceChildren', 'remove',
      'innerHTML', 'outerHTML', 'insertAdjacentHTML', 'textContent', 'classList', 'style', 'dataset', 'attributeStyleMap',
      'addEventListener', 'dispatchEvent', 'postMessage', 'fetch', 'localStorage', 'sessionStorage', 'indexedDB', 'eval', 'Function',
    ];
    expect(names.filter((n) => FORBIDDEN.includes(n))).toEqual([]);
    // The control: the scan does see a name it forbids.
    const planted = ts.createSourceFile('planted.ts', 'root.setAttribute("x", "y"); document.body.append(root);', ts.ScriptTarget.ES2022, true);
    const seen: string[] = [];
    const walkPlanted = (n: ts.Node): void => {
      if (ts.isIdentifier(n)) seen.push(n.text);
      ts.forEachChild(n, walkPlanted);
    };
    walkPlanted(planted);
    expect(seen.filter((n) => FORBIDDEN.includes(n))).toEqual(['setAttribute', 'document', 'append']);
  });
});
