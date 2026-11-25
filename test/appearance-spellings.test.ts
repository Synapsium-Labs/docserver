// The appearance grammars accept the equivalent spellings a host's stylesheet build emits (ccrc D-9019; the library wave
// `lib-grammar-spellings`). A host's build minifies the custom properties it reads its palette from, and the host forwards that
// text verbatim, as the contract asks: Lightning CSS 1.32.0, measured in a custom property, shortens opaque and alpha hex
// (`#ffffff` to `#fff`, `#00000088` to `#0008`), writes a colour name where it is shorter than every hex spelling of the
// colour (`#ff0000` to `red`), turns `rgba()` into alpha hex (or, for a legacy target, into `rgba(0,0,0,.5)`), drops a
// leading and a trailing decimal zero (`-0.011em` to `-.011em`, `0.080em` to `.08em`) and lower-cases hex and units.
//
// What this file holds the validator to, row by row: every such spelling of an already-acceptable value is accepted, in every
// colour slot and in each skin slot it can reach; a colour comes out in one form, `#rrggbb` in lower case, which the reader, the
// seed and Mermaid's derivation read, so two equivalent spellings give the same verdict text (a skin value keeps its received spelling: only the stylesheet reads it, and the browser gate,
// test/browser/frame-appearance.test.ts, measures that the computed values are the same); and the near misses stay refused,
// with the same refusal words. The grammar stays closed: a closed table of colour names, no new function notation and no
// wider range.
import { describe, expect, it } from 'vitest';
import { APPEARANCE_SLOTS, parseAppearance, type AppearanceColourSlot, type AppearanceRefusal } from '../src/enhance/appearance.js';
import { mermaidThemeOf, seriesOf } from '../src/enhance/appearance-mermaid.js';

/** Every CSS named colour with its sRGB value (CSS Color 4, section 6.1), `transparent` and the system colours aside. */
const CSS_NAMED: Readonly<Record<string, string>> = Object.fromEntries(
  (
    'aliceblue:f0f8ff antiquewhite:faebd7 aqua:00ffff aquamarine:7fffd4 azure:f0ffff beige:f5f5dc bisque:ffe4c4 ' +
    'black:000000 blanchedalmond:ffebcd blue:0000ff blueviolet:8a2be2 brown:a52a2a burlywood:deb887 ' +
    'cadetblue:5f9ea0 chartreuse:7fff00 chocolate:d2691e coral:ff7f50 cornflowerblue:6495ed cornsilk:fff8dc ' +
    'crimson:dc143c cyan:00ffff darkblue:00008b darkcyan:008b8b darkgoldenrod:b8860b darkgray:a9a9a9 ' +
    'darkgreen:006400 darkgrey:a9a9a9 darkkhaki:bdb76b darkmagenta:8b008b darkolivegreen:556b2f darkorange:ff8c00 ' +
    'darkorchid:9932cc darkred:8b0000 darksalmon:e9967a darkseagreen:8fbc8f darkslateblue:483d8b ' +
    'darkslategray:2f4f4f darkslategrey:2f4f4f darkturquoise:00ced1 darkviolet:9400d3 deeppink:ff1493 ' +
    'deepskyblue:00bfff dimgray:696969 dimgrey:696969 dodgerblue:1e90ff firebrick:b22222 floralwhite:fffaf0 ' +
    'forestgreen:228b22 fuchsia:ff00ff gainsboro:dcdcdc ghostwhite:f8f8ff gold:ffd700 goldenrod:daa520 gray:808080 ' +
    'green:008000 greenyellow:adff2f grey:808080 honeydew:f0fff0 hotpink:ff69b4 indianred:cd5c5c indigo:4b0082 ' +
    'ivory:fffff0 khaki:f0e68c lavender:e6e6fa lavenderblush:fff0f5 lawngreen:7cfc00 lemonchiffon:fffacd ' +
    'lightblue:add8e6 lightcoral:f08080 lightcyan:e0ffff lightgoldenrodyellow:fafad2 lightgray:d3d3d3 ' +
    'lightgreen:90ee90 lightgrey:d3d3d3 lightpink:ffb6c1 lightsalmon:ffa07a lightseagreen:20b2aa ' +
    'lightskyblue:87cefa lightslategray:778899 lightslategrey:778899 lightsteelblue:b0c4de lightyellow:ffffe0 ' +
    'lime:00ff00 limegreen:32cd32 linen:faf0e6 magenta:ff00ff maroon:800000 mediumaquamarine:66cdaa ' +
    'mediumblue:0000cd mediumorchid:ba55d3 mediumpurple:9370db mediumseagreen:3cb371 mediumslateblue:7b68ee ' +
    'mediumspringgreen:00fa9a mediumturquoise:48d1cc mediumvioletred:c71585 midnightblue:191970 mintcream:f5fffa ' +
    'mistyrose:ffe4e1 moccasin:ffe4b5 navajowhite:ffdead navy:000080 oldlace:fdf5e6 olive:808000 olivedrab:6b8e23 ' +
    'orange:ffa500 orangered:ff4500 orchid:da70d6 palegoldenrod:eee8aa palegreen:98fb98 paleturquoise:afeeee ' +
    'palevioletred:db7093 papayawhip:ffefd5 peachpuff:ffdab9 peru:cd853f pink:ffc0cb plum:dda0dd powderblue:b0e0e6 ' +
    'purple:800080 rebeccapurple:663399 red:ff0000 rosybrown:bc8f8f royalblue:4169e1 saddlebrown:8b4513 ' +
    'salmon:fa8072 sandybrown:f4a460 seagreen:2e8b57 seashell:fff5ee sienna:a0522d silver:c0c0c0 skyblue:87ceeb ' +
    'slateblue:6a5acd slategray:708090 slategrey:708090 snow:fffafa springgreen:00ff7f steelblue:4682b4 tan:d2b48c ' +
    'teal:008080 thistle:d8bfd8 tomato:ff6347 turquoise:40e0d0 violet:ee82ee wheat:f5deb3 white:ffffff ' +
    'whitesmoke:f5f5f5 yellow:ffff00 yellowgreen:9acd32'
  )
    .split(' ')
    .map((e) => e.split(':') as [string, string]),
);

/** The closed table: the names shorter than every hex spelling of their colour, the only names a minifier writes for one, less `grey`. */
const SHORT_NAMES: Readonly<Record<string, string>> = {
  azure: 'f0ffff', beige: 'f5f5dc', bisque: 'ffe4c4', brown: 'a52a2a', coral: 'ff7f50', gold: 'ffd700', gray: '808080',
  green: '008000', indigo: '4b0082', ivory: 'fffff0', khaki: 'f0e68c', linen: 'faf0e6', maroon: '800000',
  navy: '000080', olive: '808000', orange: 'ffa500', orchid: 'da70d6', peru: 'cd853f', pink: 'ffc0cb', plum: 'dda0dd',
  purple: '800080', red: 'ff0000', salmon: 'fa8072', sienna: 'a0522d', silver: 'c0c0c0', snow: 'fffafa', tan: 'd2b48c',
  teal: '008080', tomato: 'ff6347', violet: 'ee82ee', wheat: 'f5deb3',
};

const COLOUR_SLOTS: readonly string[] = APPEARANCE_SLOTS.colour;

/** A complete colour group, a distinct valid hex per slot. */
const colours = (): Record<string, string> =>
  Object.fromEntries(COLOUR_SLOTS.map((s, i) => [s, `#${(0x101010 + i * 0x050607).toString(16).padStart(6, '0')}`]));

/** The verdict of a full colour group with `slot` set to `value`. */
const colourVerdict = (slot: string, value: unknown) => parseAppearance({ mode: 'dark', colour: { ...colours(), [slot]: value } });
/** The colour a verdict gives `slot`, or undefined when the group was refused. */
const colourOf = (slot: string, value: string): string | undefined => (colourVerdict(slot, value).appearance.colour as Record<string, string> | undefined)?.[slot];
/** The verdict of a skin holding only `slot`. */
const skinVerdict = (slot: string, value: unknown) => parseAppearance({ mode: 'dark', skin: { [slot]: value } });
const skinOf = (slot: string, value: string): string | undefined => (skinVerdict(slot, value).appearance.skin as Record<string, string> | undefined)?.[slot];
const refusedSkin = (slot: string, value: string): AppearanceRefusal[] => skinVerdict(slot, value).refused;

/** The colour rewrites, each with a spelling a minifier writes and the long spelling it stands for. */
const COLOUR_CLASSES: readonly (readonly [string, string, string])[] = [
  ['an opaque short hex, lower case', '#fff', '#ffffff'],
  ['an opaque short hex, upper case', '#FFF', '#FFFFFF'],
  ['an opaque short hex of three distinct digits', '#1a2', '#11aa22'],
  ['a name for an opaque colour', 'red', '#ff0000'],
  ['a name whose colour has no short hex', 'tan', '#d2b48c'],
];

describe('D-9019: every colour slot takes the short spellings of an opaque colour, in their one form', () => {
  for (const slot of COLOUR_SLOTS) {
    it.each(COLOUR_CLASSES)(`${slot}: %s (%s) is accepted and gives the verdict of %s`, (_name, short, long) => {
      const v = colourVerdict(slot, short);
      expect(v.refused).toEqual([]);
      expect(colourOf(slot, short)).toBe(colourOf(slot, long));
      expect(colourOf(slot, long)).toBe(long.toLowerCase());
    });
  }

  it('outer spaces are dropped from a short spelling as from a long one', () => {
    expect(colourOf('bg', '  #fff ')).toBe('#ffffff');
    expect(colourOf('bg', ' navy  ')).toBe('#000080');
  });

  it("the one form is lower case whatever case arrived: a short hex doubles each digit, a name gives its colour's hex", () => {
    expect(colourOf('accent', '#AbC')).toBe('#aabbcc');
    expect(colourOf('accent', '#ABCDEF')).toBe('#abcdef');
    expect(colourOf('accent', '#AbCdEf')).toBe('#abcdef');
    expect(colourOf('accent', 'olive')).toBe('#808000');
    expect(colourOf('accent', 'khaki')).toBe('#f0e68c');
  });

  it.each(Object.entries(SHORT_NAMES))('the name %s is accepted as #%s, its CSS colour', (name, hex) => {
    expect(colourOf('text', name)).toBe(`#${hex}`);
    expect(CSS_NAMED[name]).toBe(hex);
  });

  it('the table is exactly the CSS names shorter than every hex spelling of their colour (the minifier rule) but grey, 31 of 148', () => {
    expect(Object.keys(CSS_NAMED)).toHaveLength(148);
    const shortest = (hex: string): number => (/^(.)\1(.)\2(.)\3$/.test(hex) ? 4 : 7);
    const rule = Object.entries(CSS_NAMED).filter(([n, hex]) => n.length < shortest(hex) && n !== 'grey').map(([n]) => n).sort();
    expect(Object.keys(SHORT_NAMES).sort()).toEqual(rule);
  });

  it('every other CSS name is refused in a colour slot, by grammar, and drops the group', () => {
    const others = Object.keys(CSS_NAMED).filter((n) => !(n in SHORT_NAMES));
    expect(others).toHaveLength(117);
    expect(others).toContain('grey');
    for (const n of others) expect(colourVerdict('text', n), n).toEqual({ appearance: { mode: 'dark' }, refused: [{ key: 'colour.text', why: 'grammar' }] });
  });
});

describe('D-9019 (addendum): the colour downstream readers get is one form', () => {
  /** The verdict's colour group for a full group with the given slots replaced. */
  const group = (over: Record<string, string>): Record<AppearanceColourSlot, string> => {
    const v = parseAppearance({ mode: 'dark', colour: { ...colours(), ...over } });
    expect(v.refused).toEqual([]);
    return v.appearance.colour as Record<AppearanceColourSlot, string>;
  };

  it.each([
    ['a short hex', '#f0a', '#ff00aa'],
    ['a short hex in upper case', '#F0A', '#FF00AA'],
    ['a six-digit hex in upper case', '#FF00AA', '#ff00aa'],
    ['a name', 'tomato', '#ff6347'],
  ])("Mermaid's derivation of %s (%s) in every colour slot is the derivation of its six-digit spelling %s", (_name, short, long) => {
    for (const slot of COLOUR_SLOTS) expect(mermaidThemeOf(group({ [slot]: short })), slot).toEqual(mermaidThemeOf(group({ [slot]: long })));
  });

  it("the derived tints mix the colour, not its text: a short accent and a named no give the six-digit spellings' tints", () => {
    const short = mermaidThemeOf(group({ accent: '#f0a', no: 'red', surface: '#fff', text: 'navy' }));
    const long = mermaidThemeOf(group({ accent: '#ff00aa', no: '#ff0000', surface: '#ffffff', text: '#000080' }));
    expect(short['activeTaskBkgColor']).toBe(long['activeTaskBkgColor']);
    expect(short['critBkgColor']).toBe(long['critBkgColor']);
    expect(short['activeTaskBkgColor']).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("the seed's text of the longest names is the six-digit form's: no name reaches the seed, and the bound holds", () => {
    // The seed writes the verdict (frameDocument; test/frame-document.test.ts mounts it). A six-letter name is seeded as seven
    // characters, so the longest-seed figure, which counts seven a colour, still bounds it.
    const names = ['maroon', 'orange', 'orchid', 'salmon', 'sienna', 'silver', 'tomato', 'violet', 'bisque', 'indigo', 'purple'];
    const short = group(Object.fromEntries(COLOUR_SLOTS.map((k, i) => [k, names[i % names.length] as string])));
    const text = JSON.stringify(short);
    for (const n of names) expect(Object.values(short), n).not.toContain(n); // `violet` is also a slot name, so the keys are not searched
    expect(Object.values(short).every((v) => /^#[0-9a-f]{6}$/.test(v))).toBe(true);
    expect(text.length).toBe(JSON.stringify(colours()).length);
  });

  it('four spellings of one colour are one series colour', () => {
    const c = group({ accent: 'red', ok: '#f00', wait: '#ff0000', no: '#FF0000' });
    const s = seriesOf(c);
    expect(s.filter((x) => x === '#ff0000')).toHaveLength(1);
    expect(s).toEqual(seriesOf(group({ accent: '#ff0000', ok: '#ff0000', wait: '#ff0000', no: '#ff0000' })));
  });

  it('every accepted spelling of a colour gives one form: #, then six lower-case hex digits', () => {
    for (const v of ['#fff', '#FFF', '#aBc', '#ffffff', '#ABCDEF', ...Object.keys(SHORT_NAMES)]) {
      const out = colourOf('bg', v) ?? '';
      expect(out, v).toMatch(/^#[0-9a-f]{6}$/);
      if (v.startsWith('#')) expect(out, v).toBe((v.length === 7 ? v : v.replace(/\w/g, '$&$&')).toLowerCase()); // a hex: its own digits
    }
  });
});

describe('D-9019 (addendum): skin values, one spelling where the reader reads one again', () => {
  // After the verdict the reader reads two skin values again as text: controlRow (compared to the last one, to relayout) and
  // sectionFamily (written as an attribute). Neither gains a spelling: each value has exactly one accepted spelling. The
  // other slots are read by the stylesheet only; popShadow and sectionTracking keep the spelling received, which the browser
  // gate measures to compute as the long spelling does.
  const ONE_SPELLING: readonly (readonly [string, string, readonly string[]])[] = [
    ['radius', '8px', ['08px', '8.0px', '8PX', '8.px', '.8e1px', '+8px']],
    ['radiusSmall', '0px', ['0', '00px', '0.0px', '-0px', '.0px']],
    ['radiusLarge', '24px', ['024px', '24.0px', '24PX']],
    ['controlRow', '40px', ['040px', '40.0px', '4e1px', '40PX', '40.px']],
    ['sectionFamily', 'mono', ['MONO', 'Mono', 'monospace']],
    ['sectionSize', '12px', ['012px', '12.0px', '12PX', '.12e2px']],
    ['sectionWeight', '400', ['0400', '400.0', '4e2', '400.']],
    ['sectionCase', 'uppercase', ['UPPERCASE', 'Uppercase']],
  ];

  it.each(ONE_SPELLING)('%s: %s is its one spelling; the equivalent spellings stay refused', (slot, one, others) => {
    expect(skinOf(slot, one)).toBe(one);
    for (const o of others) expect(refusedSkin(slot, o), `${slot} ${o}`).toEqual([{ key: `skin.${slot}`, why: 'grammar' }]);
  });

  it.each([
    ['popShadow', '0 0 rgba(0,0,0,.5)'],
    ['popShadow', '0 0 #0008,0 1px red'],
    ['sectionTracking', '-.011em'],
  ])('%s: %s is kept as received (the stylesheet reads it, no script does)', (slot, v) => {
    expect(skinOf(slot, v)).toBe(v);
  });
});

describe('D-9019: popShadow takes the spellings a minifier writes for its colours and its lists', () => {
  /** [rewrite class, the minified spelling, the long spelling it stands for]. */
  const SHADOW_CLASSES: readonly (readonly [string, string, string])[] = [
    ['an opaque short hex', '0 0 #000', '0 0 #000000'],
    ['an opaque short hex, upper case', '0 1px 2px #ABC', '0 1px 2px #AABBCC'],
    ['an alpha short hex', '0 0 #0008', '0 0 #00000088'],
    ['an alpha short hex of zero alpha', '0 0 #0000', '0 0 #00000000'],
    ['a name', '0 1px 2px red', '0 1px 2px #ff0000'],
    ['a name in a later shadow', '0 0 #0000001a, 0 2px 4px navy', '0 0 #0000001a, 0 2px 4px #000080'],
    ['an rgba with no space after its commas', '0 0 rgba(0,0,0,1)', '0 0 rgba(0, 0, 0, 1)'],
    ['an rgba alpha without its leading zero', '0 0 rgba(0,0,0,.5)', '0 0 rgba(0, 0, 0, 0.5)'],
    ['an rgba alpha without its trailing zeros', '0 0 rgba(0, 0, 0, .25)', '0 0 rgba(0, 0, 0, 0.250)'],
    ['an rgba with one comma spaced', '0 0 rgba(255, 0,0, .1)', '0 0 rgba(255, 0, 0, 0.1)'],
    ['a list with no space after its comma', '0 0 #000,0 1px #111', '0 0 #000000, 0 1px #111111'],
    ['three shadows, each rewritten', '0 0 #000,1px 1px red,0 0 0 1px rgba(0,0,0,.08)', '0 0 #000000, 1px 1px #ff0000, 0 0 0 1px rgba(0, 0, 0, 0.080)'],
    ['the legacy minified form of the console shadow', '0 12px 40px rgba(0,0,0,.55)', '0 12px 40px rgba(0, 0, 0, 0.55)'],
  ];

  it.each(SHADOW_CLASSES)('%s: %s is accepted as received, as its long spelling %s is', (_name, short, long) => {
    expect(refusedSkin('popShadow', short)).toEqual([]);
    expect(skinOf('popShadow', short)).toBe(short);
    expect(skinOf('popShadow', long)).toBe(long);
  });

  it.each(Object.keys(SHORT_NAMES))('the name %s is accepted in a shadow', (name) => {
    expect(skinOf('popShadow', `0 0 ${name}`)).toBe(`0 0 ${name}`);
  });

  it('every range applies to the parsed value of the short spellings too', () => {
    expect(refusedSkin('popShadow', '0 0 65px red')).toEqual([{ key: 'skin.popShadow', why: 'range' }]);
    expect(refusedSkin('popShadow', '0 0 #000,0 0 0 9px #000')).toEqual([{ key: 'skin.popShadow', why: 'range' }]);
    expect(refusedSkin('popShadow', '0 0 rgba(256,0,0,.5)')).toEqual([{ key: 'skin.popShadow', why: 'range' }]);
    expect(refusedSkin('popShadow', '0 0 #000, 0 0 rgba(0,0,300,.5)')).toEqual([{ key: 'skin.popShadow', why: 'range' }]);
    expect(skinOf('popShadow', '-64px 64px 64px -8px rgba(255,255,255,.999)')).toBe('-64px 64px 64px -8px rgba(255,255,255,.999)');
    // A name outside the table is grammar wherever it stands, even after a shadow out of range.
    expect(refusedSkin('popShadow', '0 0 65px red, 0 0 foo')).toEqual([{ key: 'skin.popShadow', why: 'grammar' }]);
  });
});

describe('D-9019: sectionTracking takes a length without its leading or trailing zeros', () => {
  const TRACKING: readonly (readonly [string, string])[] = [
    ['-.011em', '-0.011em'],
    ['.08em', '0.08em'],
    ['.08em', '0.080em'],
    ['-.1em', '-0.100em'],
    ['.3em', '0.3em'],
    ['.001em', '0.001em'],
    ['-0em', '-0.0em'],
    ['0em', '0.000em'],
  ];

  it.each(TRACKING)('%s is accepted as received, and stands for the value of %s', (short, long) => {
    expect(refusedSkin('sectionTracking', short)).toEqual([]);
    expect(skinOf('sectionTracking', short)).toBe(short);
    expect(skinOf('sectionTracking', long)).toBe(long);
    expect(parseFloat(short)).toBe(parseFloat(long));
  });
});

describe('D-9019: the near misses stay refused, with the same refusal words', () => {
  const COLOUR_REFUSED: readonly (readonly [string, string])[] = [
    ['a four-digit hex (an alpha form) in an opaque slot', '#ffff'],
    ['a four-digit hex of full alpha', '#000f'],
    ['an eight-digit hex in an opaque slot', '#ffffffff'],
    ['an eight-digit hex of full alpha', '#000000ff'],
    ['a five-digit hex', '#fffff'],
    ['a two-digit hex', '#ff'],
    ['a short hex with a non-hex digit', '#ffg'],
    ['a long hex with a non-hex digit', '#fffffg'],
    ['a short hex without its #', 'fff'],
    ['a name that is not a colour', 'redd'],
    ['a prefix of a name', 're'],
    ['a suffix of a name', 'ed'],
    ['a name of another colour that is not in the table', 'blue'],
    ['a name in another case', 'Red'],
    ['a name in upper case', 'RED'],
    ['transparent', 'transparent'],
    ['currentcolor', 'currentcolor'],
    ['inherit', 'inherit'],
    ['initial', 'initial'],
    ['unset', 'unset'],
    ['a name with a trailing semicolon', 'red;'],
    ['a short hex with a trailing semicolon', '#fff;'],
    ['a short hex with an embedded comment', '#f/**/ff'],
    ['a name with an embedded comment', 're/**/d'],
    ['a short hex with inner whitespace', '# fff'],
    ['a name with inner whitespace', 'r ed'],
    ['two names', 'red red'],
    ['a name with a digit', 'red0'],
    ['a name that is a pattern', 're.'],
    ['a name that is a wider pattern', '[a-z]+'],
    ['a name with an alternation', 'red|blue'],
    ['a name with a group', '(red)'],
    ['an object key', 'constructor'],
    ['another object key', '__proto__'],
    ['a name with a non-ASCII letter that upper-cases to ASCII', 'ſnow'],
    ['a name with the Kelvin sign (U+212A), which case-folds to k', '\u212Ahaki'],
    ['a short hex with a trailing line feed', '#fff\n'],
    ['a short hex after a leading line feed', '\n#fff'],
    ['a name after a tab', '\tred'],
    ['a name before a no-break space', 'red\u00a0'],
    ['a short hex before U+2028', '#fff\u2028'],
    ['rgb()', 'rgb(255,0,0)'],
    ['rgba() in an opaque slot', 'rgba(0,0,0,1)'],
    ['hsl()', 'hsl(0,0%,100%)'],
  ];

  it.each(COLOUR_REFUSED)('colour slot: %s (%s) is refused by grammar and drops the group', (_name, bad) => {
    for (const slot of ['bg', 'accent-ink', 'syn-inserted']) {
      expect(colourVerdict(slot, bad), `${slot} ${bad}`).toEqual({ appearance: { mode: 'dark' }, refused: [{ key: `colour.${slot}`, why: 'grammar' }] });
    }
  });

  const TRACKING_REFUSED: readonly (readonly [string, string, 'grammar' | 'range'])[] = [
    ['a unitless short number', '.5', 'grammar'],
    ['a unitless short tracking', '.08', 'grammar'],
    ['a trailing decimal point', '1.em', 'grammar'],
    ['a sign and a point with no digit', '-.em', 'grammar'],
    ['a point with no digit', '.em', 'grammar'],
    ['a bare unit', 'em', 'grammar'],
    ['a sign and a bare unit', '-em', 'grammar'],
    ['four decimals in the short spelling', '.0800em', 'grammar'],
    ['a plus sign', '+.08em', 'grammar'],
    ['a short spelling with a trailing semicolon', '.08em;', 'grammar'],
    ['a short spelling with an embedded comment', '.0/**/8em', 'grammar'],
    ['inner whitespace after the sign', '- .011em', 'grammar'],
    ['inner whitespace after the point', '. 08em', 'grammar'],
    ['inner whitespace before the unit', '.08 em', 'grammar'],
    ['an upper-case unit', '.08EM', 'grammar'],
    ['two points', '..08em', 'grammar'],
    ['just over the top, short', '.301em', 'range'],
    ['just under the bottom, short', '-.101em', 'range'],
    ['far over the top, short', '.9em', 'range'],
  ];

  it.each(TRACKING_REFUSED)('sectionTracking: %s (%s) is refused, as %s', (_name, bad, why) => {
    expect(refusedSkin('sectionTracking', bad)).toEqual([{ key: 'skin.sectionTracking', why }]);
    expect(skinVerdict('sectionTracking', bad).appearance).toEqual({ mode: 'dark' });
  });

  const SHADOW_REFUSED: readonly (readonly [string, string])[] = [
    ['a two-digit hex', '0 0 #00'],
    ['a five-digit hex', '0 0 #00000'],
    ['a seven-digit hex', '0 0 #0000000'],
    ['a nine-digit hex', '0 0 #000000000'],
    ['a short hex with a non-hex digit', '0 0 #00g'],
    ['an alpha short hex with a non-hex digit', '0 0 #000g'],
    ['a name that is not a colour', '0 0 foo'],
    ['a name of another colour that is not in the table', '0 0 blue'],
    ['grey, the spelling a minifier never writes', '0 0 grey'],
    ['a name in upper case', '0 0 RED'],
    ['transparent', '0 0 transparent'],
    ['currentcolor', '0 0 currentcolor'],
    ['inherit', '0 0 inherit'],
    ['initial', '0 0 initial'],
    ['a name that is an object key', '0 0 constructor'],
    ['a name in a later shadow that is not a colour', '0 0 red, 0 0 foo'],
    ['a trailing semicolon after a name', '0 0 red;'],
    ['a trailing semicolon after a short hex', '0 0 #000;'],
    ['an embedded comment in a short list', '0 0 #000,/**/0 0 #111'],
    ['an embedded comment in an rgba', '0 0 rgba(0,0,0,/**/.5)'],
    ['two spaces after a list comma', '0 0 #000,  0 0 #111'],
    ['a space before a list comma', '0 0 #000 ,0 0 #111'],
    ['a space before an rgba comma', '0 0 rgba(0 ,0,0,.5)'],
    ['two spaces after an rgba comma', '0 0 rgba(0,  0,0,.5)'],
    ['a space inside the rgba parenthesis', '0 0 rgba( 0,0,0,.5)'],
    ['a space before the rgba parenthesis', '0 0 rgba (0,0,0,.5)'],
    ['a tab after a list comma', '0 0 #000,\t0 0 #111'],
    ['an rgba alpha of a bare point', '0 0 rgba(0,0,0,.)'],
    ['an rgba alpha with a trailing point', '0 0 rgba(0,0,0,1.)'],
    ['an rgba alpha of four short decimals', '0 0 rgba(0,0,0,.5555)'],
    ['an rgba alpha over one, short', '0 0 rgba(0,0,0,1.5)'],
    ['an rgba alpha with a sign', '0 0 rgba(0,0,0,-.5)'],
    ['an rgba channel with a short decimal', '0 0 rgba(.5,0,0,1)'],
    ['an rgba of three values', '0 0 rgba(0,0,0)'],
    ['rgb() in short spacing', '0 0 rgb(0,0,0)'],
    ['hsl() in short spacing', '0 0 hsl(0,0%,0%)'],
    ['four short shadows', '0 0 #000,0 0 #000,0 0 #000,0 0 #000'],
    ['a trailing list comma', '0 0 #000,'],
  ];

  it.each(SHADOW_REFUSED)('popShadow: %s (%s) is refused by grammar', (_name, bad) => {
    expect(refusedSkin('popShadow', bad)).toEqual([{ key: 'skin.popShadow', why: 'grammar' }]);
    expect(skinVerdict('popShadow', bad).appearance).toEqual({ mode: 'dark' });
  });

  it('the slots that take pixel lengths do not take a short decimal or a dropped unit', () => {
    for (const [slot, bad] of [['radius', '.5px'], ['radius', '0.'], ['controlRow', '40.px'], ['sectionSize', '.12px'], ['sectionWeight', '4e2']] as const) {
      expect(refusedSkin(slot, bad), `${slot} ${bad}`).toEqual([{ key: `skin.${slot}`, why: 'grammar' }]);
    }
  });
});

describe('D-9019: the group rule, the vocabulary and the size stop do not move', () => {
  it('a colour group of short spellings in every slot is accepted whole, in six-digit form', () => {
    const short = Object.fromEntries(COLOUR_SLOTS.map((s, i) => [s, i % 2 === 0 ? '#fff' : 'navy']));
    const v = parseAppearance({ mode: 'light', colour: short });
    expect(v.refused).toEqual([]);
    expect(v.appearance.colour).toEqual(Object.fromEntries(COLOUR_SLOTS.map((s, i) => [s, i % 2 === 0 ? '#ffffff' : '#000080'])));
  });

  it('one refused short spelling still drops the whole colour group, naming only itself', () => {
    const c = { ...colours(), bg: '#fff', surface: 'tan', accent: '#ffff' };
    expect(parseAppearance({ mode: 'light', colour: c })).toEqual({ appearance: { mode: 'light' }, refused: [{ key: 'colour.accent', why: 'grammar' }] });
  });

  it('the verdict holds what the size walk counted: a short spelling is counted as received', () => {
    // 8 192 code units at the cap: the six-digit form the verdict writes is not counted against it.
    const label = 'a'.repeat(64);
    const fill = 'x'.repeat(8192 - 'mode'.length - 'dark'.length - 'label'.length - label.length - 'skin'.length - 'sectionTracking'.length - '.08em'.length - 'zz'.length);
    const v = parseAppearance({ mode: 'dark', label, skin: { sectionTracking: '.08em', zz: fill } });
    expect(v.refused).toEqual([{ key: 'skin.zz', why: 'unknown-key' }]);
    expect(v.appearance.skin).toEqual({ sectionTracking: '.08em' });
  });
});
