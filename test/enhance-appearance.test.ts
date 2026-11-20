// @vitest-environment jsdom
// Task 5 of the appearance contract (docserver appearance plan; the first consumer's design, section 10: tests 3, 6
// (rendered) and 7 (frame half)): the reader applies a host's verdict. The seed's appearance is applied in the same
// synchronous run that applies the prefs, an op applies in place, hosted mounts ignore the stored theme and never write
// one, Aa trades its theme row for one static line, and the frame runtime loads the host's faces and marks its `html`
// element. Judged in jsdom; the computed values at the first `ready` are the Chromium file's (test/browser/frame-appearance.test.ts).
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { APPEARANCE_LABEL_DEFAULT, APPEARANCE_SLOTS, SLOT_PROPERTY, type Appearance, type AppearanceColourSlot } from '../src/enhance/appearance.js';
import { destroyEnhancement, enhance, setEnhancementAppearance, setEnhancementPrefs } from '../src/enhance/index.js';
import { createJournal } from '../src/enhance/journal.js';
import { contextOf } from '../src/enhance/lifecycle.js';
import { EVENT_NAMES } from '../src/enhance/registry.js';
import type { ReaderStorage } from '../src/enhance/types.js';
import { loadHostFonts } from '../src/frame-runtime/host-fonts.js';
import { render } from '../src/render/index.js';

const FIXTURES = JSON.parse(readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'conformance', 'appearance', 'fixtures.json'), 'utf8')) as {
  name: string;
  mode: 'light' | 'dark';
  colour: Record<AppearanceColourSlot, string>;
}[];
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

  it('a bad colour value drops the whole colour group, keeps the skin and stays hosted', async () => {
    const root = mount();
    await enhance(root, { appearance: { mode: 'light', colour: { ...PHOSPHOR.colour, bg: 'red' }, skin: { radius: '3px' } } });
    expect(root.hasAttribute('data-docreader-hosted')).toBe(true);
    expect(root.hasAttribute('data-docreader-colours')).toBe(false);
    expect(set(root, COLOUR_PROPS)).toEqual([]);
    expect(prop(root, '--dr-radius')).toBe('3px');
    expect(root.getAttribute('data-theme')).toBe('light');
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
    for (const name of ['--evil', '--dr-evil', '--bg2', 'color', '--dr-tip-bg', '--syn-evil']) expect(() => setStyle(el, name as never, '#112233'), name).toThrow(/refuses the property/);
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
    constructor(family: string, source: unknown) {
      if (ctorThrows) throw new Error('ctor');
      this.family = family;
      this.source = source;
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

  it('registers the reader api with the two new members', async () => {
    const api = await register();
    expect(Object.keys(api).sort()).toEqual(['destroyEnhancement', 'enhance', 'goToHash', 'loadHostFonts', 'runEnhancementCommand', 'setEnhancementAppearance', 'setEnhancementPrefs']);
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
