// The appearance contract (docserver appearance plan, Task 1; the first consumer's appearance-continuity design,
// section 2). A host hands the frame one appearance: a `mode`, 33 base colours, ten skin values and a one-line `label`.
// This file is the contract's one home: the slot lists, the value grammars, `parseAppearance` (the validator the host
// and the frame both run), the contrast pairs of section 5 and the custom property each slot is written to.
//
// Pure, and walled like the rest of src/enhance: no DOM or host global, nothing run at import (so the exported lists
// are typed readonly here and frozen at the `./frame` boundary, src/frame/appearance.ts: a freeze is a call, which the
// walls refuse at the top level), only the language's own globals. It is bundled into the reader script, so it stays
// small and table-driven. `./frame` re-exports its public names; `SLOT_PROPERTY` is for the reader and the tests and is
// not re-exported.
//
// Names in `refused`, one scheme: `mode` and `label` for those two keys; `colour` and `skin` for a whole group;
// `colour.<slot>` and `skin.<slot>` for one value (an unknown key is named the same way, `colour.<key>`, and a key
// at the top level by itself); `*` for the whole value. A symbol key is never read and is named `(symbol)`.
// `why` is one of: unknown-key, type, grammar, range, incomplete, too-many-keys, too-large, unreadable, label. A
// pattern a value fails is `grammar`; one the pattern admits but the range refuses (a radius of 25px, a blur of 65px)
// is `range`. A group-level entry (`incomplete`) comes first among its group's entries, so the cap of 64 never cuts it.

/** The contract version: absent in 1.1.0, which is how a host detects support. */
export const APPEARANCE_CONTRACT = 1;

/** The closed slot names by group, in the design's order. */
export const APPEARANCE_SLOTS = {
  colour: [
    'bg', 'surface', 'surface2', 'text', 'text-muted', 'text-faint', 'border', 'rule', 'accent', 'accent-ink', 'focus',
    'ok', 'wait', 'no', 'info', 'chg', 'term', 'id', 'violet', 'path',
    'code-block-bg', 'code-ink', 'syn-comment', 'syn-keyword', 'syn-string', 'syn-number', 'syn-function', 'syn-type',
    'syn-tag', 'syn-attr', 'syn-punct', 'syn-deleted', 'syn-inserted',
  ],
  skin: ['radius', 'radiusSmall', 'radiusLarge', 'controlRow', 'popShadow', 'sectionFamily', 'sectionSize', 'sectionWeight', 'sectionTracking', 'sectionCase'],
} as const;

export type AppearanceColourSlot = (typeof APPEARANCE_SLOTS.colour)[number];
export type AppearanceSkinSlot = (typeof APPEARANCE_SLOTS.skin)[number];
export type Appearance = {
  mode: 'light' | 'dark' | 'auto';
  colour?: Record<AppearanceColourSlot, string>;
  skin?: Partial<Record<AppearanceSkinSlot, string>>;
  label?: string;
};

/** The line Aa shows with no (or a refused) host label: it names no host. */
export const APPEARANCE_LABEL_DEFAULT = "Appearance follows the app's settings";

/** The custom property the reader writes each slot to: 1.1.0's own token where one exists, a new name otherwise. */
export const SLOT_PROPERTY = {
  colour: {
    bg: '--bg', surface: '--surface', surface2: '--surface2', text: '--text', 'text-muted': '--text-muted', 'text-faint': '--text-faint',
    border: '--border', rule: '--rule', accent: '--accent', 'accent-ink': '--accent-ink', focus: '--focus', ok: '--ok', wait: '--wait',
    no: '--no', info: '--info', chg: '--chg', term: '--term', id: '--id', violet: '--violet', path: '--path',
    'code-block-bg': '--code-block-bg', 'code-ink': '--code-ink', 'syn-comment': '--syn-comment', 'syn-keyword': '--syn-keyword',
    'syn-string': '--syn-string', 'syn-number': '--syn-number', 'syn-function': '--syn-function', 'syn-type': '--syn-type',
    'syn-tag': '--syn-tag', 'syn-attr': '--syn-attr', 'syn-punct': '--syn-punct', 'syn-deleted': '--syn-deleted', 'syn-inserted': '--syn-inserted',
  },
  skin: {
    radius: '--dr-radius', radiusSmall: '--dr-radius-small', radiusLarge: '--dr-radius-large', controlRow: '--dr-control-row',
    popShadow: '--dr-pop-shadow', sectionFamily: '--dr-section-family', sectionSize: '--dr-section-size',
    sectionWeight: '--dr-section-weight', sectionTracking: '--dr-section-tracking', sectionCase: '--dr-section-case',
  },
} as const satisfies {
  readonly colour: Readonly<Record<AppearanceColourSlot, string>>;
  readonly skin: Readonly<Record<AppearanceSkinSlot, string>>;
};

/** Every property name the reader writes for a slot: the closed list journal.setStyle accepts (its type). */
export type SlotProperty = (typeof SLOT_PROPERTY.colour)[AppearanceColourSlot] | (typeof SLOT_PROPERTY.skin)[AppearanceSkinSlot];

// ───────── the value grammars (§2, "The value grammars, exact") ─────────

// A host's stylesheet build may rewrite a value to an equivalent spelling before the host reads and forwards it (ccrc D-9019):
// a short hex, a colour name, a compact `rgba()`, a number without its leading or trailing zeros. Each grammar takes those
// spellings of a value it accepts, and only those: a closed name table, no new notation, no wider range.

/**
 * The colour names a minifier writes: the CSS names shorter than every hex spelling of their colour, `gray` alone for
 * #808080 (a minifier never writes `grey`), each followed by that colour's hex in upper case (a name is lower case, so the
 * two never run together), after a leading `0` (so every name follows a hex digit). 31 of CSS's 148.
 */
const NAMES =
  '0azureF0FFFFbeigeF5F5DCbisqueFFE4C4brownA52A2AcoralFF7F50goldFFD700gray808080green008000indigo4B0082' +
  'ivoryFFFFF0khakiF0E68ClinenFAF0E6maroon800000navy000080olive808000orangeFFA500orchidDA70D6peruCD853FpinkFFC0CB' +
  'plumDDA0DDpurple800080redFF0000salmonFA8072siennaA0522DsilverC0C0C0snowFFFAFAtanD2B48Cteal008080tomatoFF6347' +
  'violetEE82EEwheatF5DEB3';

/**
 * An opaque colour's six-digit form, or '' for none: a six-digit hex as written, `#rgb` with each digit doubled, a table name
 * as its colour's hex (in the table's upper case). parseAppearance lower-cases it: the one form the reader, the seed and
 * Mermaid's derivation read.
 */
const hexOf = (t: string): string => {
  if (/^#(?:[\dA-Fa-f]{3}){1,2}$/.test(t)) return t[4] ? t : t.replace(/\w/g, '$&$&');
  // A name is letters only before it is put in a pattern; it must sit between two hex runs of the table.
  const m = /^[a-z]+$/.test(t) ? new RegExp(`[\\dA-F]${t}([\\dA-F]{6})`).exec(NAMES) : null;
  return m === null ? '' : `#${m[1] as string}`;
};
const MODES = ['light', 'dark', 'auto'];
/** The label's refused categories: controls, format characters, line and paragraph separators, lone surrogates. */
const LABEL_REFUSED = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}\p{Cs}]/u;

/**
 * `SHADOW(,[ ]SHADOW){0,2}`; `SHADOW` is `LEN LEN( LEN( LEN)?)? COLOUR`, and `COLOUR` a hex of 3, 4, 6 or 8 digits, an
 * `rgba(` whose commas take one space or none and whose alpha may drop its leading zero, or a table name. Built per call (a
 * call at the top level would run at import). Groups: four lengths, the three integers of an `rgba(`, then a name; the
 * ranges are x and y ±64, blur 0 to 64, spread ±8, integers 0 to 255, and a name must be in the table (else `grammar`).
 */
const popShadow = (v: string): '' | 'grammar' | 'range' => {
  const len = '(0|0px|-?[1-9]\\d?px)';
  const int = '(0|[1-9]\\d{0,2})';
  const h = '[\\dA-Fa-f]';
  const one = `${len} ${len}(?: ${len}(?: ${len})?)? (?:#(?:${h}{8}|${h}{6}|${h}{3,4})|rgba\\(${int}, ?${int}, ?${int}, ?(?:0|1|0?\\.\\d{1,3}|1\\.0{1,3})\\)|([a-z]+))`;
  if (!new RegExp(`^${one}(?:, ?${one}){0,2}$`).test(v)) return 'grammar';
  const each = new RegExp(`${one},? ?`, 'y');
  let why: '' | 'grammar' | 'range' = '';
  while (each.lastIndex < v.length) {
    const m = each.exec(v) as RegExpExecArray;
    const [x, y, blur, spread, r, g, b] = [1, 2, 3, 4, 5, 6, 7].map((i) => parseInt(m[i] ?? '0', 10));
    if (m[8] !== undefined && hexOf(m[8]) === '') return 'grammar';
    if (Math.abs(x as number) > 64 || Math.abs(y as number) > 64 || (blur as number) < 0 || (blur as number) > 64 || Math.abs(spread as number) > 8 || Math.max(r as number, g as number, b as number) > 255) why = 'range';
  }
  return why;
};

/** A whole pixel length of at most two digits, three skin slots' pattern. */
const PX = /^(?:0|[1-9]\d?)px$/;

/** The skin slots' patterns with their range where the pattern is looser than it: [pattern, lowest, highest]. */
const SKIN_RULES: Readonly<Record<Exclude<AppearanceSkinSlot, 'popShadow'>, readonly [RegExp, number?, number?]>> = {
  radius: [PX, 0, 24],
  radiusSmall: [PX, 0, 24],
  radiusLarge: [PX, 0, 24],
  controlRow: [/^[1-9]\dpx$/, 28, 56],
  sectionFamily: [/^(?:sans|mono)$/],
  sectionSize: [/^1[0-6]px$/],
  sectionWeight: [/^[1-9]00$/],
  sectionTracking: [/^-?(?:0|0?\.\d{1,3})em$/, -0.1, 0.3],
  sectionCase: [/^(?:none|uppercase)$/],
};

/** '' when a skin value (outer spaces gone) is good, else 'grammar' (the pattern) or 'range'. */
const skinWhy = (slot: AppearanceSkinSlot, v: string): '' | 'grammar' | 'range' => {
  if (slot === 'popShadow') return popShadow(v);
  const [re, lo, hi] = SKIN_RULES[slot];
  if (!re.test(v)) return 'grammar';
  return lo !== undefined && hi !== undefined && (parseFloat(v) < lo || parseFloat(v) > hi) ? 'range' : '';
};

// ───────── parseAppearance ─────────

/** Why a value was left out; the closed list of the contract. */
export type AppearanceRefusalWhy =
  | 'unknown-key' | 'type' | 'grammar' | 'range' | 'incomplete' | 'too-many-keys' | 'too-large' | 'unreadable' | 'label';
/** One entry of a verdict's `refused`: the key (see the header for the scheme) and why it was left out. */
export type AppearanceRefusal = { key: string; why: AppearanceRefusalWhy };

/** The size stop: private, so no value a host passes can raise it. */
const STOP = {};

/** The value minus its outer U+0020 spaces (a loop, not a pattern: no backtracking on a long run of spaces). */
const trim = (s: string): string => {
  let a = 0;
  let b = s.length;
  while (a < b && s[a] === ' ') a += 1;
  while (b > a && s[b - 1] === ' ') b -= 1;
  return s.slice(a, b);
};

/** A plain object: a null prototype, or one whose own prototype is null (so another realm's `Object.prototype` passes). */
const plain = (g: unknown): g is object => {
  if (typeof g !== 'object' || g === null) return false;
  const p = Object.getPrototypeOf(g) as object | null;
  return p === null || Object.getPrototypeOf(p) === null;
};

/** The own data value of `g[k]`, or undefined for an accessor or a missing key: an accessor is never called. */
const own = (g: object, k: string): unknown => {
  const d = Object.getOwnPropertyDescriptor(g, k);
  return d !== undefined && 'value' in d ? (d.value as unknown) : undefined;
};

/** The mode a value names: `light`, `dark` or `auto` after its outer spaces; anything else reads as `auto`. */
const modeOf = (v: unknown): Appearance['mode'] => {
  const m = typeof v === 'string' ? trim(v) : '';
  return m === 'light' || m === 'dark' ? m : 'auto';
};

/**
 * The verdict for any value; it never throws. `appearance` is always usable; `refused` lists what was left out.
 * One walk (§2, "Size"): own data descriptors only, key count first (a group over 64 keys is refused whole), then types,
 * a running count of the UTF-16 code units of every key and string visited that stops at 8 193, and any throw (a Proxy
 * trap, a revoked Proxy) ends it as `unreadable`.
 */
export function parseAppearance(x: unknown): { appearance: Appearance; refused: AppearanceRefusal[] } {
  const refused: AppearanceRefusal[] = [];
  let n = 0;
  const count = (s: string): void => {
    n += s.length;
    if (n > 8192) throw STOP;
  };
  /** The own keys of a plain group with their values, or undefined (refused) when it has over 64. */
  const read = (g: object, name: string): [string, unknown][] | undefined => {
    // Own string and symbol keys (Reflect is walled off, so the two lists are joined by hand).
    const keys = [...Object.getOwnPropertyNames(g), ...Object.getOwnPropertySymbols(g)];
    if (keys.length > 64) {
      refused.push({ key: name, why: 'too-many-keys' });
      return undefined;
    }
    return keys.map((k) => {
      if (typeof k === 'symbol') return ['(symbol)', undefined]; // counted, named, never read
      count(k);
      const v = own(g, k);
      if (typeof v === 'string') count(v);
      return [k, v];
    });
  };
  const out: Appearance = { mode: 'auto' };
  try {
    if (!plain(x)) return { appearance: out, refused: [{ key: '*', why: 'type' }] };
    const root = read(x, '*');
    if (root === undefined) return { appearance: out, refused };
    let colour: Record<string, string> | undefined;
    let skin: Record<string, string> | undefined;
    let label: string | undefined;
    for (const [k, v] of root) {
      if (k === 'mode') {
        if (typeof v !== 'string') refused.push({ key: k, why: 'type' });
        else if (!MODES.includes(trim(v))) refused.push({ key: k, why: 'grammar' });
        else out.mode = modeOf(v);
      } else if (k === 'label') {
        if (typeof v !== 'string') refused.push({ key: k, why: 'type' });
        else if (v.length < 1 || v.length > 64 || LABEL_REFUSED.test(v)) refused.push({ key: k, why: 'label' });
        else label = v;
      } else if (k !== 'colour' && k !== 'skin') {
        refused.push({ key: k, why: 'unknown-key' });
      } else if (!plain(v)) {
        refused.push({ key: k, why: 'type' });
      } else {
        const slots: readonly string[] = APPEARANCE_SLOTS[k];
        const entries = read(v, k);
        if (entries === undefined) continue;
        const g: Record<string, string> = {};
        const mine: AppearanceRefusal[] = [];
        let bad = false;
        for (const [s, raw] of entries) {
          const key = `${k}.${s}`;
          const t = typeof raw === 'string' ? trim(raw) : '';
          // A colour is kept in its one form, lower-case six-digit hex, which the reader computes with; a skin value as received.
          const c = k === 'colour' ? hexOf(t).toLowerCase() : t;
          const why = !slots.includes(s) ? 'unknown-key' : typeof raw !== 'string' ? 'type'
            : k === 'colour' ? (c === '' ? 'grammar' : '') : skinWhy(s as AppearanceSkinSlot, t);
          if (why === '') g[s] = c;
          else mine.push({ key, why });
          if (why !== '' && why !== 'unknown-key') bad = true;
        }
        // The colour group is all or nothing: one refused value, or a missing slot, leaves out the whole group.
        const complete = slots.every((s) => Object.hasOwn(g, s));
        if (k === 'skin') skin = g;
        else if (!bad && complete) colour = g;
        else if (!bad) mine.unshift({ key: k, why: 'incomplete' });
        refused.push(...mine.slice(0, 64));
      }
    }
    if (colour !== undefined) out.colour = colour as Record<AppearanceColourSlot, string>;
    if (skin !== undefined && Object.keys(skin).length > 0) out.skin = skin;
    if (label !== undefined) out.label = label;
    return { appearance: out, refused };
  } catch (e) {
    if (e !== STOP) return { appearance: { mode: 'auto' }, refused: [{ key: '*', why: 'unreadable' }] };
    try {
      out.mode = modeOf(own(x as object, 'mode'));
    } catch {
      // a trap that throws here too: the mode stays auto
    }
    return { appearance: { mode: out.mode }, refused: [{ key: '*', why: 'too-large' }] };
  }
}

/**
 * What the reader makes of a host's value: its verdict, or null for a value that is not a plain object (the one case
 * the contract ignores whole, section 7). Never throws.
 */
export function hostedVerdict(x: unknown): Appearance | null {
  const r = parseAppearance(x);
  return r.refused[0]?.key === '*' && r.refused[0].why === 'type' ? null : r.appearance;
}

// ───────── APPEARANCE_PAIRS (§5, "The contrast gate") ─────────

/**
 * Every pair of colours the stylesheet puts in front of one another, with its floor in contrast ratio. A product, written
 * out (a loop would be a call at the top level, and the reader, which never reads it, drops it from its bundle): the 14 text
 * colours (`text`, `text-muted`, `text-faint`, `accent`, the derived `accent-hover`, and `ok`, `wait`, `no`, `info`, `chg`,
 * `term`, `id`, `violet`, `path`) on `bg`, `surface`, `surface2` and the five tints (`tint:<slot>@<ground>`: the slot at 4%
 * over its ground, a name for the stylesheet's `color-mix`), `code-ink` and the eleven `syn-*` on the well, `accent-ink` on
 * `accent`, all at 4.5; and the focus ring on the eight grounds at 3. `border` and `rule` are decorative and have no pair.
 */
export const APPEARANCE_PAIRS: readonly { readonly fg: string; readonly bg: string; readonly floor: 3 | 4.5 }[] = [
  // text on bg
  { fg: 'text', bg: 'bg', floor: 4.5 }, { fg: 'text-muted', bg: 'bg', floor: 4.5 },
  { fg: 'text-faint', bg: 'bg', floor: 4.5 }, { fg: 'accent', bg: 'bg', floor: 4.5 },
  { fg: 'derived:accent-hover', bg: 'bg', floor: 4.5 }, { fg: 'ok', bg: 'bg', floor: 4.5 },
  { fg: 'wait', bg: 'bg', floor: 4.5 }, { fg: 'no', bg: 'bg', floor: 4.5 },
  { fg: 'info', bg: 'bg', floor: 4.5 }, { fg: 'chg', bg: 'bg', floor: 4.5 },
  { fg: 'term', bg: 'bg', floor: 4.5 }, { fg: 'id', bg: 'bg', floor: 4.5 },
  { fg: 'violet', bg: 'bg', floor: 4.5 }, { fg: 'path', bg: 'bg', floor: 4.5 },
  // text on surface
  { fg: 'text', bg: 'surface', floor: 4.5 }, { fg: 'text-muted', bg: 'surface', floor: 4.5 },
  { fg: 'text-faint', bg: 'surface', floor: 4.5 }, { fg: 'accent', bg: 'surface', floor: 4.5 },
  { fg: 'derived:accent-hover', bg: 'surface', floor: 4.5 }, { fg: 'ok', bg: 'surface', floor: 4.5 },
  { fg: 'wait', bg: 'surface', floor: 4.5 }, { fg: 'no', bg: 'surface', floor: 4.5 },
  { fg: 'info', bg: 'surface', floor: 4.5 }, { fg: 'chg', bg: 'surface', floor: 4.5 },
  { fg: 'term', bg: 'surface', floor: 4.5 }, { fg: 'id', bg: 'surface', floor: 4.5 },
  { fg: 'violet', bg: 'surface', floor: 4.5 }, { fg: 'path', bg: 'surface', floor: 4.5 },
  // text on surface2
  { fg: 'text', bg: 'surface2', floor: 4.5 }, { fg: 'text-muted', bg: 'surface2', floor: 4.5 },
  { fg: 'text-faint', bg: 'surface2', floor: 4.5 }, { fg: 'accent', bg: 'surface2', floor: 4.5 },
  { fg: 'derived:accent-hover', bg: 'surface2', floor: 4.5 }, { fg: 'ok', bg: 'surface2', floor: 4.5 },
  { fg: 'wait', bg: 'surface2', floor: 4.5 }, { fg: 'no', bg: 'surface2', floor: 4.5 },
  { fg: 'info', bg: 'surface2', floor: 4.5 }, { fg: 'chg', bg: 'surface2', floor: 4.5 },
  { fg: 'term', bg: 'surface2', floor: 4.5 }, { fg: 'id', bg: 'surface2', floor: 4.5 },
  { fg: 'violet', bg: 'surface2', floor: 4.5 }, { fg: 'path', bg: 'surface2', floor: 4.5 },
  // text on tint:chg@bg
  { fg: 'text', bg: 'tint:chg@bg', floor: 4.5 }, { fg: 'text-muted', bg: 'tint:chg@bg', floor: 4.5 },
  { fg: 'text-faint', bg: 'tint:chg@bg', floor: 4.5 }, { fg: 'accent', bg: 'tint:chg@bg', floor: 4.5 },
  { fg: 'derived:accent-hover', bg: 'tint:chg@bg', floor: 4.5 }, { fg: 'ok', bg: 'tint:chg@bg', floor: 4.5 },
  { fg: 'wait', bg: 'tint:chg@bg', floor: 4.5 }, { fg: 'no', bg: 'tint:chg@bg', floor: 4.5 },
  { fg: 'info', bg: 'tint:chg@bg', floor: 4.5 }, { fg: 'chg', bg: 'tint:chg@bg', floor: 4.5 },
  { fg: 'term', bg: 'tint:chg@bg', floor: 4.5 }, { fg: 'id', bg: 'tint:chg@bg', floor: 4.5 },
  { fg: 'violet', bg: 'tint:chg@bg', floor: 4.5 }, { fg: 'path', bg: 'tint:chg@bg', floor: 4.5 },
  // text on tint:wait@bg
  { fg: 'text', bg: 'tint:wait@bg', floor: 4.5 }, { fg: 'text-muted', bg: 'tint:wait@bg', floor: 4.5 },
  { fg: 'text-faint', bg: 'tint:wait@bg', floor: 4.5 }, { fg: 'accent', bg: 'tint:wait@bg', floor: 4.5 },
  { fg: 'derived:accent-hover', bg: 'tint:wait@bg', floor: 4.5 }, { fg: 'ok', bg: 'tint:wait@bg', floor: 4.5 },
  { fg: 'wait', bg: 'tint:wait@bg', floor: 4.5 }, { fg: 'no', bg: 'tint:wait@bg', floor: 4.5 },
  { fg: 'info', bg: 'tint:wait@bg', floor: 4.5 }, { fg: 'chg', bg: 'tint:wait@bg', floor: 4.5 },
  { fg: 'term', bg: 'tint:wait@bg', floor: 4.5 }, { fg: 'id', bg: 'tint:wait@bg', floor: 4.5 },
  { fg: 'violet', bg: 'tint:wait@bg', floor: 4.5 }, { fg: 'path', bg: 'tint:wait@bg', floor: 4.5 },
  // text on tint:no@bg
  { fg: 'text', bg: 'tint:no@bg', floor: 4.5 }, { fg: 'text-muted', bg: 'tint:no@bg', floor: 4.5 },
  { fg: 'text-faint', bg: 'tint:no@bg', floor: 4.5 }, { fg: 'accent', bg: 'tint:no@bg', floor: 4.5 },
  { fg: 'derived:accent-hover', bg: 'tint:no@bg', floor: 4.5 }, { fg: 'ok', bg: 'tint:no@bg', floor: 4.5 },
  { fg: 'wait', bg: 'tint:no@bg', floor: 4.5 }, { fg: 'no', bg: 'tint:no@bg', floor: 4.5 },
  { fg: 'info', bg: 'tint:no@bg', floor: 4.5 }, { fg: 'chg', bg: 'tint:no@bg', floor: 4.5 },
  { fg: 'term', bg: 'tint:no@bg', floor: 4.5 }, { fg: 'id', bg: 'tint:no@bg', floor: 4.5 },
  { fg: 'violet', bg: 'tint:no@bg', floor: 4.5 }, { fg: 'path', bg: 'tint:no@bg', floor: 4.5 },
  // text on tint:accent@bg
  { fg: 'text', bg: 'tint:accent@bg', floor: 4.5 }, { fg: 'text-muted', bg: 'tint:accent@bg', floor: 4.5 },
  { fg: 'text-faint', bg: 'tint:accent@bg', floor: 4.5 }, { fg: 'accent', bg: 'tint:accent@bg', floor: 4.5 },
  { fg: 'derived:accent-hover', bg: 'tint:accent@bg', floor: 4.5 }, { fg: 'ok', bg: 'tint:accent@bg', floor: 4.5 },
  { fg: 'wait', bg: 'tint:accent@bg', floor: 4.5 }, { fg: 'no', bg: 'tint:accent@bg', floor: 4.5 },
  { fg: 'info', bg: 'tint:accent@bg', floor: 4.5 }, { fg: 'chg', bg: 'tint:accent@bg', floor: 4.5 },
  { fg: 'term', bg: 'tint:accent@bg', floor: 4.5 }, { fg: 'id', bg: 'tint:accent@bg', floor: 4.5 },
  { fg: 'violet', bg: 'tint:accent@bg', floor: 4.5 }, { fg: 'path', bg: 'tint:accent@bg', floor: 4.5 },
  // text on tint:chg@surface
  { fg: 'text', bg: 'tint:chg@surface', floor: 4.5 }, { fg: 'text-muted', bg: 'tint:chg@surface', floor: 4.5 },
  { fg: 'text-faint', bg: 'tint:chg@surface', floor: 4.5 }, { fg: 'accent', bg: 'tint:chg@surface', floor: 4.5 },
  { fg: 'derived:accent-hover', bg: 'tint:chg@surface', floor: 4.5 }, { fg: 'ok', bg: 'tint:chg@surface', floor: 4.5 },
  { fg: 'wait', bg: 'tint:chg@surface', floor: 4.5 }, { fg: 'no', bg: 'tint:chg@surface', floor: 4.5 },
  { fg: 'info', bg: 'tint:chg@surface', floor: 4.5 }, { fg: 'chg', bg: 'tint:chg@surface', floor: 4.5 },
  { fg: 'term', bg: 'tint:chg@surface', floor: 4.5 }, { fg: 'id', bg: 'tint:chg@surface', floor: 4.5 },
  { fg: 'violet', bg: 'tint:chg@surface', floor: 4.5 }, { fg: 'path', bg: 'tint:chg@surface', floor: 4.5 },
  // the well
  { fg: 'code-ink', bg: 'code-block-bg', floor: 4.5 }, { fg: 'syn-comment', bg: 'code-block-bg', floor: 4.5 },
  { fg: 'syn-keyword', bg: 'code-block-bg', floor: 4.5 }, { fg: 'syn-string', bg: 'code-block-bg', floor: 4.5 },
  { fg: 'syn-number', bg: 'code-block-bg', floor: 4.5 }, { fg: 'syn-function', bg: 'code-block-bg', floor: 4.5 },
  { fg: 'syn-type', bg: 'code-block-bg', floor: 4.5 }, { fg: 'syn-tag', bg: 'code-block-bg', floor: 4.5 },
  { fg: 'syn-attr', bg: 'code-block-bg', floor: 4.5 }, { fg: 'syn-punct', bg: 'code-block-bg', floor: 4.5 },
  { fg: 'syn-deleted', bg: 'code-block-bg', floor: 4.5 }, { fg: 'syn-inserted', bg: 'code-block-bg', floor: 4.5 },
  // selected text and a pressed tool button
  { fg: 'accent-ink', bg: 'accent', floor: 4.5 },
  // the focus ring
  { fg: 'focus', bg: 'bg', floor: 3 }, { fg: 'focus', bg: 'surface', floor: 3 },
  { fg: 'focus', bg: 'surface2', floor: 3 }, { fg: 'focus', bg: 'tint:chg@bg', floor: 3 },
  { fg: 'focus', bg: 'tint:wait@bg', floor: 3 }, { fg: 'focus', bg: 'tint:no@bg', floor: 3 },
  { fg: 'focus', bg: 'tint:accent@bg', floor: 3 }, { fg: 'focus', bg: 'tint:chg@surface', floor: 3 },
];
