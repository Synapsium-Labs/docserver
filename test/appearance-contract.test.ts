// Task 1 of the appearance contract (docserver appearance plan; the first consumer's design, section 2, section 5 and section 10 tests 1
// and 6): the pure contract module `src/enhance/appearance.ts`, re-exported by `./frame`. It reads no DOM; it is judged
// here on values only: the slot lists, `parseAppearance` (grammars, ranges, the size walk, the label), the pairs and
// `SLOT_PROPERTY`.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  APPEARANCE_CONTRACT,
  APPEARANCE_LABEL_DEFAULT,
  APPEARANCE_PAIRS,
  APPEARANCE_SLOTS,
  SLOT_PROPERTY,
  parseAppearance,
} from '../src/enhance/appearance.js';
import * as frame from '../src/frame/index.js';

const COLOUR_SLOTS = [
  'bg', 'surface', 'surface2', 'text', 'text-muted', 'text-faint', 'border', 'rule', 'accent', 'accent-ink', 'focus',
  'ok', 'wait', 'no', 'info', 'chg', 'term', 'id', 'violet', 'path',
  'code-block-bg', 'code-ink', 'syn-comment', 'syn-keyword', 'syn-string', 'syn-number', 'syn-function', 'syn-type', 'syn-tag', 'syn-attr', 'syn-punct', 'syn-deleted', 'syn-inserted',
];
const SKIN_SLOTS = ['radius', 'radiusSmall', 'radiusLarge', 'controlRow', 'popShadow', 'sectionFamily', 'sectionSize', 'sectionWeight', 'sectionTracking', 'sectionCase'];

/** A complete colour group, a distinct valid hex per slot. */
const colours = (): Record<string, string> =>
  Object.fromEntries(COLOUR_SLOTS.map((s, i) => [s, `#${(0x101010 + i * 0x050607).toString(16).padStart(6, '0')}`]));

type Verdict = ReturnType<typeof parseAppearance>;
const skin = (slot: string, value: unknown): Verdict => parseAppearance({ mode: 'dark', skin: { [slot]: value } });
const accepted = (slot: string, value: string): boolean => (skin(slot, value).appearance.skin as Record<string, string> | undefined)?.[slot] === value.replace(/^ +| +$/g, '');
const refusal = (slot: string, value: unknown): unknown => skin(slot, value).refused;

describe('the contract constants', () => {
  it('the version is 1', () => expect(APPEARANCE_CONTRACT).toBe(1));

  it("the slot lists equal section 2's names, in section 2's order: 33 colour slots and ten skin slots", () => {
    expect([...APPEARANCE_SLOTS.colour]).toEqual(COLOUR_SLOTS);
    expect([...APPEARANCE_SLOTS.skin]).toEqual(SKIN_SLOTS);
    expect(Object.keys(APPEARANCE_SLOTS)).toEqual(['colour', 'skin']);
    expect(COLOUR_SLOTS).toHaveLength(33);
  });

  it('the default label names no host', () => {
    expect(APPEARANCE_LABEL_DEFAULT).toBe("Appearance follows the app's settings");
  });

  it('./frame carries the same values (SLOT_PROPERTY stays internal)', () => {
    const f = frame as Record<string, unknown>;
    expect(f.APPEARANCE_CONTRACT).toBe(APPEARANCE_CONTRACT);
    expect(f.APPEARANCE_SLOTS).toBe(APPEARANCE_SLOTS);
    expect(f.APPEARANCE_PAIRS).toBe(APPEARANCE_PAIRS);
    expect(f.APPEARANCE_LABEL_DEFAULT).toBe(APPEARANCE_LABEL_DEFAULT);
    expect(f.parseAppearance).toBe(parseAppearance);
    expect('SLOT_PROPERTY' in f).toBe(false);
  });
});

describe('test 1: parseAppearance accepts the edges of every grammar', () => {
  it('a full appearance comes back whole, outer spaces dropped, a colour in lower case and a skin value as written (D-9019)', () => {
    const c = colours();
    c.bg = '#ABCDEF';
    const a = { mode: 'light', colour: c, skin: { radius: '8px', popShadow: '0 0 0 1px #5F697C' }, label: 'Phosphor & Ink' };
    expect(parseAppearance(a)).toEqual({ appearance: { ...a, colour: { ...c, bg: '#abcdef' } }, refused: [] });
  });

  it.each([
    ['radius', '0px'], ['radius', '24px'], ['radiusSmall', '0px'], ['radiusLarge', '24px'], ['radius', '9px'],
    ['controlRow', '28px'], ['controlRow', '56px'],
    ['sectionFamily', 'sans'], ['sectionFamily', 'mono'],
    ['sectionSize', '10px'], ['sectionSize', '16px'],
    ['sectionWeight', '100'], ['sectionWeight', '900'],
    ['sectionTracking', '-0.1em'], ['sectionTracking', '0.3em'], ['sectionTracking', '0em'], ['sectionTracking', '0.08em'], ['sectionTracking', '-0.011em'],
    ['sectionCase', 'none'], ['sectionCase', 'uppercase'],
    ['popShadow', '0 12px 40px rgba(0, 0, 0, 0.55)'],
    ['popShadow', '0 12px 40px rgba(26, 32, 27, 0.22)'],
    ['popShadow', '0 0 0 1px #5F697C'],
    ['popShadow', '0 0 0 1px #2E3440FF'],
    ['popShadow', '0px 0px #000000'],
    ['popShadow', '-64px 64px 64px 8px #000000'],
    ['popShadow', '64px -64px 0 -8px rgba(255, 255, 255, 1)'],
    ['popShadow', '1px 2px rgba(0, 0, 0, 0)'],
    ['popShadow', '1px 2px rgba(0, 0, 0, 1.000)'],
    ['popShadow', '1px 2px rgba(0, 0, 0, 0.555)'],
    ['popShadow', '0 0 #000000, 1px 1px 1px #111111, -2px -2px 2px 2px rgba(1, 2, 3, 0.5)'],
  ])('skin %s accepts %s', (slot, value) => {
    expect(skin(slot, value)).toEqual({ appearance: { mode: 'dark', skin: { [slot]: value } }, refused: [] });
  });

  it('a mode of light, dark or auto stands; every colour slot takes upper and lower case hex, and gives lower case (D-9019)', () => {
    for (const mode of ['light', 'dark', 'auto']) expect(parseAppearance({ mode }).appearance.mode).toBe(mode);
    const c = Object.fromEntries(COLOUR_SLOTS.map((s, i) => [s, i % 2 ? '#2E3440' : '#2e3440']));
    const lower = Object.fromEntries(COLOUR_SLOTS.map((s) => [s, '#2e3440']));
    expect(parseAppearance({ mode: 'dark', colour: c })).toEqual({ appearance: { mode: 'dark', colour: lower }, refused: [] });
  });
});

describe('test 1: parseAppearance leaves out what the grammar refuses, naming each', () => {
  it.each([
    ['inset', 'inset 0 0 0 1px #000000'],
    ['four shadows', '0 0 #000000, 0 0 #000000, 0 0 #000000, 0 0 #000000'],
    ['a blur of 65', '0 0 65px #000000'],
    ['a negative blur', '0 0 -1px #000000'],
    ['a spread of 9', '0 0 0 9px #000000'],
    ['a spread of -9', '0 0 0 -9px #000000'],
    ['an x offset of 65', '65px 0 #000000'],
    ['a y offset of -65', '0 -65px #000000'],
    ['an INT of 256', '0 0 rgba(256, 0, 0, 1)'],
    ['an alpha of 1.5', '0 0 rgba(0, 0, 0, 1.5)'],
    ['an alpha of 0.5555', '0 0 rgba(0, 0, 0, 0.5555)'],
    ['rgb()', '0 0 rgb(0, 0, 0)'],
    ['RGBA in upper case', '0 0 RGBA(0, 0, 0, 1)'],
    ['a named colour outside the name table (D-9019)', '0 0 blue'],
    ['a 5-digit hex (a 3-digit one is accepted since D-9019)', '0 0 #00000'],
    ['a length with a unit other than px', '0 0em #000000'],
    ['five lengths', '0 0 0 0 0 #000000'],
    ['one length', '0 #000000'],
    ['a leading zero', '01px 0 #000000'],
    ['a plus sign', '+1px 0 #000000'],
    ['var(', '0 0 var(--x)'],
    ['url(', '0 0 url(x)'],
    ['a semicolon', '0 0 #000000;'],
    ['a brace', '0 0 #000000}'],
    ['a comment', '0 0 #000000/**/'],
    ['a backslash', '0 0 \\#000000'],
    ['a quote', '0 0 "#000000"'],
  ])('popShadow with %s is left out and named', (_name, value) => {
    const v = skin('popShadow', value);
    expect(v.appearance).toEqual({ mode: 'dark' });
    expect(v.refused).toHaveLength(1);
    expect(v.refused[0]?.key).toBe('skin.popShadow');
    expect(['grammar', 'range']).toContain(v.refused[0]?.why);
  });

  it('names the why: an out-of-range length is range, a shape the grammar does not have is grammar', () => {
    expect(refusal('popShadow', '0 0 65px #000000')).toEqual([{ key: 'skin.popShadow', why: 'range' }]);
    expect(refusal('popShadow', '0 0 0 9px #000000')).toEqual([{ key: 'skin.popShadow', why: 'range' }]);
    expect(refusal('popShadow', '0 0 rgba(256, 0, 0, 1)')).toEqual([{ key: 'skin.popShadow', why: 'range' }]);
    expect(refusal('popShadow', 'inset 0 0 #000000')).toEqual([{ key: 'skin.popShadow', why: 'grammar' }]);
    expect(refusal('radius', '25px')).toEqual([{ key: 'skin.radius', why: 'range' }]);
    expect(refusal('radius', '1em')).toEqual([{ key: 'skin.radius', why: 'grammar' }]);
    expect(refusal('controlRow', '27px')).toEqual([{ key: 'skin.controlRow', why: 'range' }]);
    expect(refusal('controlRow', '57px')).toEqual([{ key: 'skin.controlRow', why: 'range' }]);
    expect(refusal('sectionTracking', '0.4em')).toEqual([{ key: 'skin.sectionTracking', why: 'range' }]);
    expect(refusal('sectionTracking', '-0.2em')).toEqual([{ key: 'skin.sectionTracking', why: 'range' }]);
  });

  it('every other skin slot refuses a value outside its pattern', () => {
    for (const [slot, value] of [
      ['radius', '-1px'], ['radius', '08px'], ['radius', '8'], ['radius', '8.5px'], ['radiusSmall', '8pt'], ['radiusLarge', ''],
      ['controlRow', '9px'], ['controlRow', '100px'], ['controlRow', '28'],
      ['sectionFamily', 'serif'], ['sectionFamily', 'Sans'],
      ['sectionSize', '9px'], ['sectionSize', '17px'], ['sectionSize', '1px'], ['sectionSize', '12'],
      ['sectionWeight', '50'], ['sectionWeight', '950'], ['sectionWeight', '1000'], ['sectionWeight', '650'], ['sectionWeight', 'bold'],
      ['sectionTracking', '0.08'], ['sectionTracking', '.0800em'], ['sectionTracking', '+0.08em'], ['sectionTracking', '1em'],
      ['sectionCase', 'capitalize'], ['sectionCase', 'UPPERCASE'],
    ] as const) {
      expect(accepted(slot, value), `${slot} ${value}`).toBe(false);
      expect(skin(slot, value).appearance, `${slot} ${value}`).toEqual({ mode: 'dark' });
      expect(skin(slot, value).refused, `${slot} ${value}`).toHaveLength(1);
    }
  });

  it('colour slots refuse a 4-digit hex, rgb(), var(, url(, a semicolon and an out-of-range length, each named, without throwing', () => {
    for (const bad of ['#ffff', 'rgb(0, 0, 0)', 'var(--x)', 'url(x)', '#000000;', '10px', '#00000', '#0000000', '#000000ff', '#gggggg', 'blue', '']) {
      const c = { ...colours(), text: bad };
      expect(parseAppearance({ mode: 'dark', colour: c }), bad).toEqual({
        appearance: { mode: 'dark' },
        refused: [{ key: 'colour.text', why: 'grammar' }],
      });
    }
  });

  it('an unknown key is refused and named, at the top level and in each group', () => {
    expect(parseAppearance({ mode: 'dark', extra: 'x' })).toEqual({ appearance: { mode: 'dark' }, refused: [{ key: 'extra', why: 'unknown-key' }] });
    expect(parseAppearance({ mode: 'dark', extra: { deep: 1 } }).refused).toEqual([{ key: 'extra', why: 'unknown-key' }]);
    expect(parseAppearance({ mode: 'dark', skin: { radius: '8px', glow: '1px' } })).toEqual({
      appearance: { mode: 'dark', skin: { radius: '8px' } },
      refused: [{ key: 'skin.glow', why: 'unknown-key' }],
    });
    const c = { ...colours(), glow: '#000000' };
    expect(parseAppearance({ mode: 'dark', colour: c })).toEqual({
      appearance: { mode: 'dark', colour: colours() },
      refused: [{ key: 'colour.glow', why: 'unknown-key' }],
    });
  });

  it('names inherited-looking keys as unknown, never as slots', () => {
    const o = JSON.parse('{"mode":"dark","skin":{"constructor":"1px","__proto__":"1px","toString":"1px"}}') as unknown;
    const v = parseAppearance(o);
    expect(v.appearance).toEqual({ mode: 'dark' });
    expect(v.refused.map((r) => r.why)).toEqual(['unknown-key', 'unknown-key', 'unknown-key']);
  });

  it('an oversize payload is refused whole', () => {
    expect(parseAppearance({ mode: 'light', label: 'a'.repeat(9000) })).toEqual({ appearance: { mode: 'light' }, refused: [{ key: '*', why: 'too-large' }] });
    expect(parseAppearance({ mode: 'bogus', label: 'a'.repeat(9000) })).toEqual({ appearance: { mode: 'auto' }, refused: [{ key: '*', why: 'too-large' }] });
  });
});

describe('test 1: the forms the first consumer sends', () => {
  it('#2E3440 and #2e3440 pass in a colour slot, #2E3440FF does not, while popShadow takes the eight-digit form', () => {
    for (const hex of ['#2E3440', '#2e3440']) expect(parseAppearance({ mode: 'dark', colour: { ...colours(), bg: hex } }).appearance.colour?.bg).toBe('#2e3440'); // one form (D-9019)
    expect(parseAppearance({ mode: 'dark', colour: { ...colours(), bg: '#2E3440FF' } }).refused).toEqual([{ key: 'colour.bg', why: 'grammar' }]);
    expect(accepted('popShadow', '0 0 0 1px #2E3440FF')).toBe(true);
  });

  it('the strings "10px", "600" and "-0.011em" pass; the numbers 10 and 600 do not', () => {
    expect(accepted('radius', '10px')).toBe(true);
    expect(accepted('sectionWeight', '600')).toBe(true);
    expect(accepted('sectionTracking', '-0.011em')).toBe(true);
    expect(refusal('radius', 10)).toEqual([{ key: 'skin.radius', why: 'type' }]);
    expect(refusal('sectionWeight', 600)).toEqual([{ key: 'skin.sectionWeight', why: 'type' }]);
  });

  it('leading and trailing U+0020 are ignored and dropped from the verdict; a colour comes out in lower case (D-9019)', () => {
    expect(skin('radius', '   10px  ').appearance.skin).toEqual({ radius: '10px' });
    expect(skin('popShadow', ' 0 0 0 1px #5F697C ').appearance.skin).toEqual({ popShadow: '0 0 0 1px #5F697C' });
    expect(parseAppearance({ mode: 'dark', colour: { ...colours(), bg: '  #ABCDEF ' } }).appearance.colour?.bg).toBe('#abcdef');
    expect(parseAppearance({ mode: ' dark ' }).appearance.mode).toBe('dark');
  });

  it('a value of spaces only, or with other outer white space, is refused', () => {
    expect(refusal('radius', '    ')).toEqual([{ key: 'skin.radius', why: 'grammar' }]);
    for (const w of ['\t', '\n', '\r', '\u00a0', '\u2028', '\u2029', '\ufeff']) {
      expect(accepted('radius', `${w}10px`), JSON.stringify(w)).toBe(false);
      expect(accepted('radius', `10px${w}`), JSON.stringify(w)).toBe(false);
    }
  });
});

describe('test 1: whitespace and digits', () => {
  it('refuses a popShadow with a tab, a line feed, U+00A0, U+2028 or U+FEFF between tokens, or two spaces in a row', () => {
    for (const w of ['\t', '\n', '\r', '\u00a0', '\u2028', '\u2029', '\ufeff', '  ']) {
      expect(accepted('popShadow', `0${w}0 0 1px #5F697C`), JSON.stringify(w)).toBe(false);
      expect(accepted('popShadow', `0 0 0 1px${w}#5F697C`), JSON.stringify(w)).toBe(false);
    }
    expect(accepted('popShadow', '0 0 #000000,  0 0 #111111')).toBe(false);
    expect(accepted('popShadow', '0 0 #000000 , 0 0 #111111')).toBe(false);
    // D-9019: a comma with no space after it, in the list and in an rgba(), is a minifier's spelling and is accepted.
    expect(accepted('popShadow', '0 0 #000000,0 0 #111111')).toBe(true);
    expect(accepted('popShadow', '0 0 rgba(0,0,0,1)')).toBe(true);
    expect(accepted('popShadow', '0 0 rgba(0, 0,  0, 1)')).toBe(false);
    expect(accepted('popShadow', '0 0 rgba(0, 0, 0, 1)')).toBe(true);
  });

  it('refuses an alpha of 0.5555, and a sectionTracking of 0.0800em', () => {
    expect(accepted('popShadow', '0 0 rgba(0, 0, 0, 0.5555)')).toBe(false);
    expect(accepted('sectionTracking', '0.0800em')).toBe(false);
    expect(accepted('sectionTracking', '0.080em')).toBe(true);
    expect(accepted('popShadow', '0 0 rgba(0, 0, 0, 1.0000)')).toBe(false);
    expect(accepted('popShadow', '0 0 rgba(0, 0, 0, 1.0)')).toBe(true);
    expect(accepted('popShadow', '0 0 rgba(0, 0, 0, 0.)')).toBe(false);
    expect(accepted('popShadow', '0 0 rgba(0, 0, 0, 2)')).toBe(false);
    expect(accepted('popShadow', '0 0 rgba(00, 0, 0, 1)')).toBe(false);
  });

  it('a tab is not an outer space (a tab around a value refuses it)', () => {
    expect(refusal('radius', '\t10px')).toEqual([{ key: 'skin.radius', why: 'grammar' }]);
    expect(refusal('radius', '10px\t')).toEqual([{ key: 'skin.radius', why: 'grammar' }]);
    expect(parseAppearance({ mode: 'dark', colour: { ...colours(), bg: '\t#ABCDEF' } }).refused).toEqual([{ key: 'colour.bg', why: 'grammar' }]);
  });
});

describe('test 1: size', () => {
  // The walk counts the UTF-16 code units of every key and string it visits: 'mode' and 'dark', then 'label'.
  const base = 'mode'.length + 'dark'.length + 'label'.length;

  it('a value whose walk counts 8 192 code units is judged slot by slot; one counting 8 193 is refused whole', () => {
    const at = parseAppearance({ mode: 'dark', label: 'a'.repeat(8192 - base) });
    expect(at).toEqual({ appearance: { mode: 'dark' }, refused: [{ key: 'label', why: 'label' }] });
    const over = parseAppearance({ mode: 'dark', label: 'a'.repeat(8193 - base) });
    expect(over).toEqual({ appearance: { mode: 'dark' }, refused: [{ key: '*', why: 'too-large' }] });
  });

  it('keys count, in groups too, and a refused unknown key still counts', () => {
    const k = 'k'.repeat(8192 - 'mode'.length - 'dark'.length);
    expect(parseAppearance({ mode: 'dark', [k]: 1 }).refused).toEqual([{ key: k, why: 'unknown-key' }]);
    expect(parseAppearance({ mode: 'dark', [`${k}k`]: 1 }).refused).toEqual([{ key: '*', why: 'too-large' }]);
    const g = 'mode'.length + 'dark'.length + 'skin'.length;
    expect(parseAppearance({ mode: 'dark', skin: { x: 'y'.repeat(8192 - g - 1) } }).refused).toEqual([{ key: 'skin.x', why: 'unknown-key' }]);
    expect(parseAppearance({ mode: 'dark', skin: { x: 'y'.repeat(8192 - g) } }).refused).toEqual([{ key: '*', why: 'too-large' }]);
  });

  it('the sum runs across the groups, so many small values refuse whole', () => {
    const c = colours();
    const total = Object.entries(c).reduce((n, [k, v]) => n + k.length + v.length, 'mode'.length + 'dark'.length + 'colour'.length);
    const room = 8192 - total;
    expect(parseAppearance({ mode: 'dark', colour: c, label: 'a'.repeat(room - 'label'.length) }).refused).toEqual([{ key: 'label', why: 'label' }]);
    expect(parseAppearance({ mode: 'dark', colour: c, label: 'a'.repeat(room - 'label'.length + 1) }).refused).toEqual([{ key: '*', why: 'too-large' }]);
  });
});

describe('test 1: parseAppearance never throws', () => {
  it('a skin holding a cycle returns a verdict naming the offending key', () => {
    const s: Record<string, unknown> = { radius: '8px' };
    s.self = s;
    expect(parseAppearance({ mode: 'dark', skin: s })).toEqual({
      appearance: { mode: 'dark', skin: { radius: '8px' } },
      refused: [{ key: 'skin.self', why: 'unknown-key' }],
    });
    s.radiusSmall = s;
    expect(parseAppearance({ mode: 'dark', skin: s }).refused).toEqual([{ key: 'skin.self', why: 'unknown-key' }, { key: 'skin.radiusSmall', why: 'type' }]);
  });

  it('a BigInt in a colour slot drops the colour group, naming the slot', () => {
    expect(parseAppearance({ mode: 'dark', colour: { ...colours(), bg: 10n } })).toEqual({
      appearance: { mode: 'dark' },
      refused: [{ key: 'colour.bg', why: 'type' }],
    });
  });

  it('a colour that is an array, a skin that is a string, and a top level that is no object', () => {
    expect(parseAppearance({ mode: 'dark', colour: [] })).toEqual({ appearance: { mode: 'dark' }, refused: [{ key: 'colour', why: 'type' }] });
    expect(parseAppearance({ mode: 'dark', skin: 'x' })).toEqual({ appearance: { mode: 'dark' }, refused: [{ key: 'skin', why: 'type' }] });
    expect(parseAppearance({ mode: 'dark', colour: null }).refused).toEqual([{ key: 'colour', why: 'type' }]);
    for (const x of [null, undefined, 5, 'dark', true, [], [{ mode: 'dark' }], () => 1, Symbol('x'), 10n, new Date(0), new Map(), new (class A { mode = 'dark'; })()]) {
      expect(parseAppearance(x), String(typeof x)).toEqual({ appearance: { mode: 'auto' }, refused: [{ key: '*', why: 'type' }] });
    }
  });

  it('a null-prototype object is a plain object', () => {
    const o = Object.assign(Object.create(null) as object, { mode: 'light' });
    expect(parseAppearance(o)).toEqual({ appearance: { mode: 'light' }, refused: [] });
  });

  it('a non-string mode and a non-string label are refused by type', () => {
    expect(parseAppearance({ mode: 1, label: 2 })).toEqual({
      appearance: { mode: 'auto' },
      refused: [{ key: 'mode', why: 'type' }, { key: 'label', why: 'type' }],
    });
  });
});

describe('test 1: same-realm values', () => {
  it('a getter in a colour slot is refused without being called', () => {
    const spy = vi.fn(() => '#000000');
    const c = colours();
    Object.defineProperty(c, 'bg', { get: spy, enumerable: true });
    expect(parseAppearance({ mode: 'dark', colour: c })).toEqual({ appearance: { mode: 'dark' }, refused: [{ key: 'colour.bg', why: 'type' }] });
    expect(spy).not.toHaveBeenCalled();
  });

  it('a getter in the skin, in mode and in label is refused without being called', () => {
    const spy = vi.fn(() => '8px');
    const s = {};
    Object.defineProperty(s, 'radius', { get: spy, enumerable: true });
    const top = { skin: s };
    Object.defineProperty(top, 'mode', { get: spy, enumerable: true });
    Object.defineProperty(top, 'label', { get: spy, enumerable: true });
    expect(parseAppearance(top)).toEqual({
      appearance: { mode: 'auto' },
      refused: [{ key: 'skin.radius', why: 'type' }, { key: 'mode', why: 'type' }, { key: 'label', why: 'type' }],
    });
    expect(spy).not.toHaveBeenCalled();
  });

  it('a getter in a group slot is not called either when it is the group itself', () => {
    const spy = vi.fn(() => ({}));
    const top = {};
    Object.defineProperty(top, 'colour', { get: spy, enumerable: true });
    expect(parseAppearance(top).refused).toEqual([{ key: 'colour', why: 'type' }]);
    expect(spy).not.toHaveBeenCalled();
  });

  it('a Proxy whose ownKeys trap throws, and a revoked Proxy, each give auto and unreadable', () => {
    const unreadable = { appearance: { mode: 'auto' }, refused: [{ key: '*', why: 'unreadable' }] };
    const trap = new Proxy({}, { ownKeys: () => { throw new Error('boom'); } });
    expect(parseAppearance(trap)).toEqual(unreadable);
    const r = Proxy.revocable({}, {});
    r.revoke();
    expect(parseAppearance(r.proxy)).toEqual(unreadable);
    const inGroup = new Proxy({}, { ownKeys: () => { throw new Error('boom'); } });
    expect(parseAppearance({ mode: 'dark', skin: inGroup })).toEqual(unreadable);
    const gopd = new Proxy({ bg: '#000000' }, { getOwnPropertyDescriptor: () => { throw new Error('boom'); } });
    expect(parseAppearance({ mode: 'dark', colour: gopd })).toEqual(unreadable);
    const proto = new Proxy({}, { getPrototypeOf: () => { throw new Error('boom'); } });
    expect(parseAppearance(proto)).toEqual(unreadable);
    expect(parseAppearance({ mode: 'dark', colour: r.proxy })).toEqual(unreadable);
  });

  it('a throw of the string a size stop would use is still unreadable (the stop is a private object)', () => {
    const forged = new Proxy({}, { ownKeys: () => { throw 'too-large'; } });
    expect(parseAppearance(forged).refused).toEqual([{ key: '*', why: 'unreadable' }]);
  });

  it('a colour of 65 keys, none of them strings, is refused whole as too-many-keys, with at most 64 entries', () => {
    const c = Object.fromEntries(Array.from({ length: 65 }, (_, i) => [`k${i}`, i]));
    const v = parseAppearance({ mode: 'dark', colour: c });
    expect(v).toEqual({ appearance: { mode: 'dark' }, refused: [{ key: 'colour', why: 'too-many-keys' }] });
    const s = Object.fromEntries(Array.from({ length: 65 }, (_, i) => [`k${i}`, i]));
    expect(parseAppearance({ mode: 'dark', skin: s }).refused).toEqual([{ key: 'skin', why: 'too-many-keys' }]);
  });

  it('a group of exactly 64 keys is read, with at most 64 entries', () => {
    const c = Object.fromEntries(Array.from({ length: 64 }, (_, i) => [`k${i}`, 'x']));
    const v = parseAppearance({ mode: 'dark', colour: c });
    expect(v.appearance).toEqual({ mode: 'dark' });
    expect(v.refused).toHaveLength(64);
    // the group-level entry comes first, so the cap of 64 cuts an unknown key and never the `incomplete`
    expect(v.refused[0]).toEqual({ key: 'colour', why: 'incomplete' });
    expect(v.refused.slice(1).every((r) => r.why === 'unknown-key')).toBe(true);
  });

  it('a top level of 65 keys gives auto and one too-many-keys', () => {
    const t = Object.fromEntries(Array.from({ length: 65 }, (_, i) => [`k${i}`, 1]));
    expect(parseAppearance({ ...t, mode: 'dark' })).toEqual({ appearance: { mode: 'auto' }, refused: [{ key: '*', why: 'too-many-keys' }] });
    const sixtyFour = Object.fromEntries(Array.from({ length: 63 }, (_, i) => [`k${i}`, 1]));
    expect(parseAppearance({ ...sixtyFour, mode: 'dark' }).appearance).toEqual({ mode: 'dark' });
  });

  it('own non-enumerable keys count toward the 64, and an object with an inherited prototype is not plain', () => {
    const c: Record<string, unknown> = {};
    for (let i = 0; i < 65; i += 1) Object.defineProperty(c, `h${i}`, { value: 'x', enumerable: false });
    expect(parseAppearance({ mode: 'dark', colour: c }).refused).toEqual([{ key: 'colour', why: 'too-many-keys' }]);
    const inherited = Object.create({ bg: '#000000', surface: '#000000' }) as object;
    expect(parseAppearance({ mode: 'dark', skin: inherited })).toEqual({ appearance: { mode: 'dark' }, refused: [{ key: 'skin', why: 'type' }] });
  });
});

describe('test 1: a missing slot, and all or nothing', () => {
  it('a colour group holding every slot but rule is refused whole, as incomplete', () => {
    const c = colours();
    delete c.rule;
    expect(parseAppearance({ mode: 'dark', colour: c })).toEqual({ appearance: { mode: 'dark' }, refused: [{ key: 'colour', why: 'incomplete' }] });
  });

  it('an empty colour group is incomplete; no colour group at all is valid', () => {
    expect(parseAppearance({ mode: 'dark', colour: {} }).refused).toEqual([{ key: 'colour', why: 'incomplete' }]);
    expect(parseAppearance({ mode: 'dark' })).toEqual({ appearance: { mode: 'dark' }, refused: [] });
  });

  it('one refused colour leaves out the whole colour group, and every other colour with it', () => {
    const v = parseAppearance({ mode: 'light', colour: { ...colours(), accent: 'blue' }, skin: { radius: '8px' }, label: 'x' });
    expect(v).toEqual({
      appearance: { mode: 'light', skin: { radius: '8px' }, label: 'x' },
      refused: [{ key: 'colour.accent', why: 'grammar' }],
    });
    expect(v.appearance.colour).toBeUndefined();
  });

  it('two refused colours name both', () => {
    const v = parseAppearance({ mode: 'dark', colour: { ...colours(), accent: 'blue', text: 4 } });
    expect(v.refused).toEqual([{ key: 'colour.text', why: 'type' }, { key: 'colour.accent', why: 'grammar' }].sort((a, b) => COLOUR_SLOTS.indexOf(a.key.slice(7)) - COLOUR_SLOTS.indexOf(b.key.slice(7))));
    expect(v.appearance.colour).toBeUndefined();
  });

  it('one refused skin slot leaves out only itself', () => {
    expect(parseAppearance({ mode: 'dark', skin: { radius: '8px', radiusSmall: '99px', sectionCase: 'none' }, label: 'x' })).toEqual({
      appearance: { mode: 'dark', skin: { radius: '8px', sectionCase: 'none' }, label: 'x' },
      refused: [{ key: 'skin.radiusSmall', why: 'range' }],
    });
  });

  it('a skin whose every slot is refused leaves no skin; an empty skin and an empty colour-free value are valid', () => {
    expect(parseAppearance({ mode: 'dark', skin: { radius: 'x' } }).appearance).toEqual({ mode: 'dark' });
    expect(parseAppearance({ mode: 'dark', skin: {} })).toEqual({ appearance: { mode: 'dark' }, refused: [] });
  });

  it('a bad mode reads as auto, and is named', () => {
    expect(parseAppearance({ mode: 'sepia' })).toEqual({ appearance: { mode: 'auto' }, refused: [{ key: 'mode', why: 'grammar' }] });
    expect(parseAppearance({ mode: 'Dark' }).appearance.mode).toBe('auto');
    expect(parseAppearance({})).toEqual({ appearance: { mode: 'auto' }, refused: [] });
  });

  it('the verdict is a fresh object: the input is never returned or mutated', () => {
    const input = { mode: 'dark', colour: colours(), skin: { radius: ' 8px ' }, label: 'x' };
    const before = JSON.stringify(input);
    const v = parseAppearance(input);
    expect(JSON.stringify(input)).toBe(before);
    expect(v.appearance).not.toBe(input);
    expect(v.appearance.colour).not.toBe(input.colour);
    expect(v.appearance.skin).not.toBe(input.skin);
    expect(Object.keys(v.appearance)).toEqual(['mode', 'colour', 'skin', 'label']);
  });
});

describe('test 6 (validator half): the label', () => {
  const label = (l: unknown): Verdict => parseAppearance({ mode: 'dark', label: l });
  const shows = (l: unknown): boolean => label(l).appearance.label === l;
  const refused = (l: unknown): boolean => label(l).appearance.label === undefined && label(l).refused.length === 1 && label(l).refused[0]?.key === 'label';

  it('64 UTF-16 code units show whole; 65, and the empty label, are refused', () => {
    expect(shows('a'.repeat(64))).toBe(true);
    expect(shows('a')).toBe(true);
    expect(refused('a'.repeat(65))).toBe(true);
    expect(label('').refused).toEqual([{ key: 'label', why: 'label' }]);
    expect(refused('')).toBe(true);
  });

  it('astral characters count twice: 32 of them (64 units) show, 33 (66 units) are refused', () => {
    expect(shows('\u{1F600}'.repeat(32))).toBe(true);
    expect(refused('\u{1F600}'.repeat(33))).toBe(true);
    expect(shows(`${'a'.repeat(62)}\u{1F600}`)).toBe(true);
    expect(refused(`${'a'.repeat(63)}\u{1F600}`)).toBe(true);
  });

  it('U+0000, U+001B, U+007F, U+0085, U+202E and U+2066 are refused', () => {
    for (const c of ['\u0000', '\u001b', '\u007f', '\u0085', '\u202e', '\u2066']) {
      expect(refused(`a${c}b`), c.codePointAt(0)?.toString(16)).toBe(true);
    }
  });

  it('by category, not by list: U+061C, U+206A, U+00AD, U+E0041, U+2028, U+2029 and a lone U+D800 are refused', () => {
    for (const c of ['\u061c', '\u206a', '\u00ad', '\u{E0041}', '\u2028', '\u2029', '\ud800', '\udfff', '\ufeff', '\u200b', '\t', '\n']) {
      expect(refused(`a${c}b`), c.codePointAt(0)?.toString(16)).toBe(true);
    }
    expect(refused('\ud800')).toBe(true);
    expect(refused('a\ud800\ud800b')).toBe(true);
  });

  it('a well-formed surrogate pair is not a lone surrogate', () => {
    expect(shows('\u{1F600}')).toBe(true);
  });

  it('<b>x</b> is accepted as text, eight characters', () => {
    expect(label('<b>x</b>')).toEqual({ appearance: { mode: 'dark', label: '<b>x</b>' }, refused: [] });
    expect('<b>x</b>'.length).toBe(8);
  });

  it('the label is never trimmed, and inner white space that is not a control stays', () => {
    expect(label('  x  ').appearance.label).toBe('  x  ');
    expect(label('   ').appearance.label).toBe('   ');
    expect(label('a  b\u00a0c').appearance.label).toBe('a  b\u00a0c');
  });

  it('a label does not make the colour group or the skin refuse, and the reverse', () => {
    const v = parseAppearance({ mode: 'dark', colour: colours(), skin: { radius: '8px' }, label: '\u202e' });
    expect(v.appearance.colour).toBeDefined();
    expect(v.appearance.skin).toEqual({ radius: '8px' });
    expect(v.refused).toEqual([{ key: 'label', why: 'label' }]);
  });
});

describe('test 1: every shadow is range-checked, and the edges of every range', () => {
  const edge3 = '-64px 64px 64px -8px #000000, 64px -64px 0 8px #000000, 0 0 0 0 rgba(255, 255, 255, 1.000)';

  it('refuses a range error in the 2nd or 3rd shadow, and in an rgba of a later shadow', () => {
    for (const v of [
      '0 0 #000000, 0 0 65px #000000',
      '0 0 #000000, 0 0 0 9px #000000',
      '0 0 #000000, 0 0 #000000, 0 0 0 9px #000000',
      '0 0 #000000, 0 0 #000000, 0 0 65px #000000',
      '0 0 #000000, 65px 0 #000000',
      '0 0 #000000, 0 0 #000000, 0 -65px #000000',
      '0 0 #000000, 0 0 rgba(256, 0, 0, 1)',
      '0 0 #000000, 0 0 #000000, 0 0 rgba(0, 0, 256, 1)',
      '0 0 #000000, 0 0 -1px #000000',
    ]) {
      expect(refusal('popShadow', v), v).toEqual([{ key: 'skin.popShadow', why: 'range' }]);
      expect(accepted('popShadow', v), v).toBe(false);
    }
  });

  it('accepts one three-shadow value at every edge: offsets of +-64, blur 0 and 64, spread +-8, integers 255, alpha 1.000', () => {
    expect(skin('popShadow', edge3)).toEqual({ appearance: { mode: 'dark', skin: { popShadow: edge3 } }, refused: [] });
  });

  it('sectionTracking: 0.3em and -0.1em pass, 0.301em and -0.101em are refused as range', () => {
    for (const v of ['0.3em', '-0.1em', '0.300em', '-0.100em']) expect(accepted('sectionTracking', v), v).toBe(true);
    for (const v of ['0.301em', '-0.101em', '0.31em', '-0.11em']) expect(refusal('sectionTracking', v), v).toEqual([{ key: 'skin.sectionTracking', why: 'range' }]);
  });

  it.each(['radius', 'radiusSmall', 'radiusLarge'])('%s: 0px and 24px pass, 25px is refused as range', (slot) => {
    for (const v of ['0px', '24px']) expect(accepted(slot, v), v).toBe(true);
    expect(refusal(slot, '25px')).toEqual([{ key: `skin.${slot}`, why: 'range' }]);
    expect(refusal(slot, '99px')).toEqual([{ key: `skin.${slot}`, why: 'range' }]);
  });

  it('controlRow: 28px and 56px pass, 27px and 57px are refused as range', () => {
    for (const v of ['28px', '56px']) expect(accepted('controlRow', v), v).toBe(true);
    for (const v of ['27px', '57px']) expect(refusal('controlRow', v), v).toEqual([{ key: 'skin.controlRow', why: 'range' }]);
  });

  it('sectionSize: 10px and 16px pass, 9px and 17px are refused; sectionWeight: 100 and 900 pass, 0, 1000 and 50 are refused', () => {
    for (const v of ['10px', '16px']) expect(accepted('sectionSize', v), v).toBe(true);
    for (const v of ['9px', '17px']) expect(skin('sectionSize', v).refused, v).toHaveLength(1);
    for (const v of ['100', '900']) expect(accepted('sectionWeight', v), v).toBe(true);
    for (const v of ['000', '1000', '50']) expect(skin('sectionWeight', v).refused, v).toHaveLength(1);
  });
});

describe('test 1: symbol keys', () => {
  it('a symbol key is refused as unknown-key, named (symbol), and never read', () => {
    const spy = vi.fn(() => 'x');
    const sym = Symbol('s');
    const top = { mode: 'dark' };
    Object.defineProperty(top, sym, { get: spy, enumerable: true });
    expect(parseAppearance(top)).toEqual({ appearance: { mode: 'dark' }, refused: [{ key: '(symbol)', why: 'unknown-key' }] });
    const g = { radius: '8px' };
    Object.defineProperty(g, sym, { get: spy, enumerable: true });
    expect(parseAppearance({ mode: 'dark', skin: g })).toEqual({
      appearance: { mode: 'dark', skin: { radius: '8px' } },
      refused: [{ key: 'skin.(symbol)', why: 'unknown-key' }],
    });
    const c = colours();
    Object.defineProperty(c, sym, { get: spy, enumerable: true });
    expect(parseAppearance({ mode: 'dark', colour: c }).refused).toEqual([{ key: 'colour.(symbol)', why: 'unknown-key' }]);
    expect(spy).not.toHaveBeenCalled();
  });

  it('symbol keys count toward the 64-key cap, with the string keys', () => {
    const g: Record<string | symbol, unknown> = {};
    for (let i = 0; i < 32; i += 1) g[`k${i}`] = 'x';
    for (let i = 0; i < 32; i += 1) g[Symbol(`s${i}`)] = 'x';
    expect(parseAppearance({ mode: 'dark', skin: g }).refused).toHaveLength(64);
    g[Symbol('one more')] = 'x';
    expect(parseAppearance({ mode: 'dark', skin: g })).toEqual({ appearance: { mode: 'dark' }, refused: [{ key: 'skin', why: 'too-many-keys' }] });
    const top: Record<string | symbol, unknown> = { mode: 'dark' };
    for (let i = 0; i < 64; i += 1) top[Symbol(`t${i}`)] = 1;
    expect(parseAppearance(top)).toEqual({ appearance: { mode: 'auto' }, refused: [{ key: '*', why: 'too-many-keys' }] });
  });
});

describe('the contract at the ./frame boundary is frozen', () => {
  const f = frame as unknown as { APPEARANCE_SLOTS: { colour: string[]; skin: string[] }; APPEARANCE_PAIRS: { fg: string; bg: string; floor: number }[] };

  it('APPEARANCE_SLOTS, its two arrays, APPEARANCE_PAIRS and every pair are frozen', () => {
    expect(Object.isFrozen(f.APPEARANCE_SLOTS)).toBe(true);
    expect(Object.isFrozen(f.APPEARANCE_SLOTS.colour)).toBe(true);
    expect(Object.isFrozen(f.APPEARANCE_SLOTS.skin)).toBe(true);
    expect(Object.isFrozen(f.APPEARANCE_PAIRS)).toBe(true);
    expect(f.APPEARANCE_PAIRS.filter((p) => !Object.isFrozen(p))).toEqual([]);
  });

  it('MERMAID_HOSTED_KINDS is frozen, and a write through it throws', () => {
    const k = frame.MERMAID_HOSTED_KINDS as unknown as string[];
    expect(Object.isFrozen(k)).toBe(true);
    expect(() => { k[0] = 'x'; }).toThrow(TypeError);
    expect(() => k.push('x')).toThrow(TypeError);
    expect(k[0]).toBe('flowchart-v2');
  });

  it('writing through the ./frame import throws in strict mode, and changes nothing', () => {
    const slots = f.APPEARANCE_SLOTS;
    expect(() => { slots.colour[0] = 'x'; }).toThrow(TypeError);
    expect(() => slots.colour.push('x')).toThrow(TypeError);
    expect(() => { slots.skin.length = 0; }).toThrow(TypeError);
    expect(() => { (slots as unknown as Record<string, unknown>).other = []; }).toThrow(TypeError);
    expect(() => { f.APPEARANCE_PAIRS[0] = { fg: 'a', bg: 'b', floor: 1 }; }).toThrow(TypeError);
    expect(() => f.APPEARANCE_PAIRS.pop()).toThrow(TypeError);
    expect(() => { (f.APPEARANCE_PAIRS[0] as { floor: number }).floor = 1; }).toThrow(TypeError);
    expect(slots.colour[0]).toBe('bg');
    expect(f.APPEARANCE_PAIRS).toHaveLength(133);
  });
});

describe('APPEARANCE_PAIRS (section 5, the contrast gate)', () => {
  const TEXT = ['text', 'text-muted', 'text-faint', 'accent', 'derived:accent-hover', 'ok', 'wait', 'no', 'info', 'chg', 'term', 'id', 'violet', 'path'];
  const TINTS = ['tint:chg@bg', 'tint:wait@bg', 'tint:no@bg', 'tint:accent@bg', 'tint:chg@surface'];
  const GROUNDS = ['bg', 'surface', 'surface2', ...TINTS];
  const SYN = COLOUR_SLOTS.filter((s) => s.startsWith('syn-'));
  type Pair = { fg: string; bg: string; floor: number };
  const pairs = APPEARANCE_PAIRS as readonly Pair[];
  const at = (floor: number): Pair[] => pairs.filter((p) => p.floor === floor);

  it('is the product: 14 text colours on 8 grounds, the well, accent-ink on accent at 4.5, and the focus ring on the 8 grounds at 3', () => {
    expect(at(4.5)).toHaveLength(14 * 8 + 12 + 1);
    expect(at(3)).toHaveLength(8);
    expect(pairs).toHaveLength(14 * 8 + 12 + 1 + 8);
    const want = new Set<string>();
    for (const g of GROUNDS) for (const t of TEXT) want.add(`${t}|${g}|4.5`);
    for (const t of ['code-ink', ...SYN]) want.add(`${t}|code-block-bg|4.5`);
    want.add('accent-ink|accent|4.5');
    for (const g of GROUNDS) want.add(`focus|${g}|3`);
    expect(new Set(pairs.map((p) => `${p.fg}|${p.bg}|${String(p.floor)}`))).toEqual(want);
    expect(want.size).toBe(pairs.length);
  });

  it('draws no pair on border or rule, no text on a ground that does not admit it, and no focus ring on the well or accent', () => {
    expect(pairs.filter((p) => ['border', 'rule'].includes(p.fg) || ['border', 'rule'].includes(p.bg))).toEqual([]);
    expect(pairs.filter((p) => p.bg === 'code-block-bg').every((p) => p.fg === 'code-ink' || p.fg.startsWith('syn-'))).toBe(true);
    expect(pairs.filter((p) => p.bg === 'accent').map((p) => p.fg)).toEqual(['accent-ink']);
    expect(pairs.filter((p) => p.fg === 'focus').map((p) => p.bg)).toEqual(GROUNDS);
    expect(pairs.filter((p) => p.fg === 'accent-hover' || p.fg === 'derived:accent-hover').every((p) => p.floor === 4.5)).toBe(true);
  });

  it('every fg and bg is a slot, a derived colour or a named tint over a slot ground', () => {
    const slots = new Set(COLOUR_SLOTS);
    const named = (s: string): boolean => {
      if (slots.has(s)) return true;
      if (s === 'derived:accent-hover') return true;
      const m = /^tint:([a-z-]+)@([a-z0-9-]+)$/.exec(s);
      return m !== null && slots.has(m[1] as string) && slots.has(m[2] as string);
    };
    expect(pairs.filter((p) => !named(p.fg) || !named(p.bg))).toEqual([]);
    expect(pairs.every((p) => Object.keys(p).sort().join() === 'bg,fg,floor')).toBe(true);
  });
});

describe('SLOT_PROPERTY', () => {
  const css = readFileSync(new URL('../assets/reader.css', import.meta.url), 'utf8');
  // The root's own declarations, as 1.1.0 ships them: the first `[data-docreader-root] { ... }` block.
  const rootBlock = ((): string => {
    const at = css.indexOf('[data-docreader-root] {');
    return css.slice(at, css.indexOf('\n}', at));
  })();
  const NEW_NAMES = new Set(['accent-ink', 'focus', 'code-ink', ...COLOUR_SLOTS.filter((s) => s.startsWith('syn-'))]);

  it('has an entry for every slot and no other', () => {
    expect(Object.keys(SLOT_PROPERTY.colour)).toEqual(COLOUR_SLOTS);
    expect(Object.keys(SLOT_PROPERTY.skin)).toEqual(SKIN_SLOTS);
  });

  it("each colour slot's property is 1.1.0's token where one exists, declared on the root in the stylesheet, and a new --name otherwise", () => {
    for (const slot of COLOUR_SLOTS) {
      const prop = (SLOT_PROPERTY.colour as Record<string, string>)[slot] as string;
      expect(prop, slot).toBe(`--${slot}`);
      const declared = new RegExp(`(?:^|[\\s;{])${prop}\\s*:`).test(rootBlock);
      expect(declared, `${prop} declared in 1.1.0's root block`).toBe(!NEW_NAMES.has(slot));
    }
  });

  it('the skin slots map to --dr-<kebab-case>', () => {
    expect(SLOT_PROPERTY.skin).toEqual({
      radius: '--dr-radius', radiusSmall: '--dr-radius-small', radiusLarge: '--dr-radius-large', controlRow: '--dr-control-row',
      popShadow: '--dr-pop-shadow', sectionFamily: '--dr-section-family', sectionSize: '--dr-section-size',
      sectionWeight: '--dr-section-weight', sectionTracking: '--dr-section-tracking', sectionCase: '--dr-section-case',
    });
    // New names: 1.1.0's stylesheet declares none of them (the current one declares each, empty, for its hosted rules).
    const v110 = execFileSync('git', ['show', 'v1.1.0:assets/reader.css'], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
    for (const v of Object.values(SLOT_PROPERTY.skin)) expect(v110).not.toMatch(new RegExp(`(?:^|[\\s;{])${v}\\s*:`));
  });

  it('every property name is distinct', () => {
    const all = [...Object.values(SLOT_PROPERTY.colour), ...Object.values(SLOT_PROPERTY.skin)];
    expect(new Set(all).size).toBe(43);
  });
});
