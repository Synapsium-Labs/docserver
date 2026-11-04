// `./host`'s hidden-character check for a copy (docserver L3, Task 9; plan Reference §11.3; the first consumer's spec
// §4.4, "Hidden characters in a copy", and M8.19). Before the host's own copy adapter writes text anywhere, hiddenChars
// lists every character in it that a reader cannot see: C0 controls other than tab and newline (ESC among them), DEL,
// the C1 controls U+0080 to U+009F (CSI, the one-code-point form of ESC [, among them; ledger C88), the bidi controls
// U+202A to U+202E and U+2066 to U+2069, the zero-width characters U+200B to U+200D, U+2060 and U+FEFF, and, by the
// operator's ruling of 2026-11-02 (ledger C103), the directional marks U+200E, U+200F and U+061C and the tag characters
// U+E0000 to U+E007F (invisible text that rides a copy, "ASCII smuggling"), and, by ledger C106, which supersedes
// point (4) of C103, the line separator U+2028 and the paragraph separator U+2029 (named by their character names: Zl
// and Zp are not controls, so they have no name alias). Each comes with its index in UTF-16 code
// units, its code point and its Unicode name, so the host can show a visible marker for each. `./host` never touches
// the clipboard. The link classifier refuses an href holding any of them (hasHiddenChar), so the one table serves both.
// Pure and import-inert: frozen tables and two functions.
//
// The C1 controls go beyond the list Reference §11.3 and the first consumer's M8.19 name (ledger C88): a terminal reads
// U+009B as the start of an escape sequence, so a copy holding one is shown, never written silently.
//
// The tag characters are outside the BMP, so both functions walk the text by code point; `index` is still the index of
// the character's first UTF-16 code unit. A lone surrogate is no listed character and is passed over.

export interface HiddenChar {
  /** The character's index in the text, in UTF-16 code units. */
  readonly index: number;
  readonly codePoint: number;
  /** Its Unicode name (for a control, its name alias; for U+2028 and U+2029, their character names; for an unassigned tag code point, its `<reserved-XXXXX>` code point label). */
  readonly name: string;
}

/** The C0 controls, U+0000 to U+001F, by their Unicode name aliases (tab and newline are never reported). */
const C0_NAMES: readonly string[] = Object.freeze([
  'NULL', 'START OF HEADING', 'START OF TEXT', 'END OF TEXT', 'END OF TRANSMISSION', 'ENQUIRY', 'ACKNOWLEDGE', 'BELL',
  'BACKSPACE', 'CHARACTER TABULATION', 'LINE FEED', 'LINE TABULATION', 'FORM FEED', 'CARRIAGE RETURN', 'SHIFT OUT',
  'SHIFT IN', 'DATA LINK ESCAPE', 'DEVICE CONTROL ONE', 'DEVICE CONTROL TWO', 'DEVICE CONTROL THREE',
  'DEVICE CONTROL FOUR', 'NEGATIVE ACKNOWLEDGE', 'SYNCHRONOUS IDLE', 'END OF TRANSMISSION BLOCK', 'CANCEL',
  'END OF MEDIUM', 'SUBSTITUTE', 'ESCAPE', 'INFORMATION SEPARATOR FOUR', 'INFORMATION SEPARATOR THREE',
  'INFORMATION SEPARATOR TWO', 'INFORMATION SEPARATOR ONE',
]);

/** The C1 controls, U+0080 to U+009F, by their Unicode name aliases (ledger C88). */
const C1_NAMES: readonly string[] = Object.freeze([
  'PADDING CHARACTER', 'HIGH OCTET PRESET', 'BREAK PERMITTED HERE', 'NO BREAK HERE', 'INDEX', 'NEXT LINE',
  'START OF SELECTED AREA', 'END OF SELECTED AREA', 'CHARACTER TABULATION SET', 'CHARACTER TABULATION WITH JUSTIFICATION',
  'LINE TABULATION SET', 'PARTIAL LINE FORWARD', 'PARTIAL LINE BACKWARD', 'REVERSE LINE FEED', 'SINGLE SHIFT TWO',
  'SINGLE SHIFT THREE', 'DEVICE CONTROL STRING', 'PRIVATE USE ONE', 'PRIVATE USE TWO', 'SET TRANSMIT STATE',
  'CANCEL CHARACTER', 'MESSAGE WAITING', 'START OF GUARDED AREA', 'END OF GUARDED AREA', 'START OF STRING',
  'SINGLE GRAPHIC CHARACTER INTRODUCER', 'SINGLE CHARACTER INTRODUCER', 'CONTROL SEQUENCE INTRODUCER',
  'STRING TERMINATOR', 'OPERATING SYSTEM COMMAND', 'PRIVACY MESSAGE', 'APPLICATION PROGRAM COMMAND',
]);

/** Every other hidden character, by code point (a frozen table: `./host` keeps no mutable module state). */
const OTHER_NAMES: Readonly<Record<number, string>> = Object.freeze({
  0x7f: 'DELETE',
  // directional marks (ledger C103)
  0x061c: 'ARABIC LETTER MARK',
  0x200e: 'LEFT-TO-RIGHT MARK',
  0x200f: 'RIGHT-TO-LEFT MARK',
  // bidi controls
  0x202a: 'LEFT-TO-RIGHT EMBEDDING',
  0x202b: 'RIGHT-TO-LEFT EMBEDDING',
  0x202c: 'POP DIRECTIONAL FORMATTING',
  0x202d: 'LEFT-TO-RIGHT OVERRIDE',
  0x202e: 'RIGHT-TO-LEFT OVERRIDE',
  0x2066: 'LEFT-TO-RIGHT ISOLATE',
  0x2067: 'RIGHT-TO-LEFT ISOLATE',
  0x2068: 'FIRST STRONG ISOLATE',
  0x2069: 'POP DIRECTIONAL ISOLATE',
  // line and paragraph separators (ledger C106; Zl and Zp, not controls, so they carry their character names)
  0x2028: 'LINE SEPARATOR',
  0x2029: 'PARAGRAPH SEPARATOR',
  // zero-width characters
  0x200b: 'ZERO WIDTH SPACE',
  0x200c: 'ZERO WIDTH NON-JOINER',
  0x200d: 'ZERO WIDTH JOINER',
  0x2060: 'WORD JOINER',
  0xfeff: 'ZERO WIDTH NO-BREAK SPACE',
});

/** The ASCII characters U+0020 to U+007E by their Unicode names; a tag character U+E0020 to U+E007E is `TAG ` plus its ASCII twin's (ledger C103). */
const ASCII_NAMES: readonly string[] = Object.freeze([
  'SPACE', 'EXCLAMATION MARK', 'QUOTATION MARK', 'NUMBER SIGN', 'DOLLAR SIGN', 'PERCENT SIGN', 'AMPERSAND',
  'APOSTROPHE', 'LEFT PARENTHESIS', 'RIGHT PARENTHESIS', 'ASTERISK', 'PLUS SIGN', 'COMMA', 'HYPHEN-MINUS',
  'FULL STOP', 'SOLIDUS', 'DIGIT ZERO', 'DIGIT ONE', 'DIGIT TWO', 'DIGIT THREE', 'DIGIT FOUR', 'DIGIT FIVE',
  'DIGIT SIX', 'DIGIT SEVEN', 'DIGIT EIGHT', 'DIGIT NINE', 'COLON', 'SEMICOLON', 'LESS-THAN SIGN', 'EQUALS SIGN',
  'GREATER-THAN SIGN', 'QUESTION MARK', 'COMMERCIAL AT', 'LATIN CAPITAL LETTER A', 'LATIN CAPITAL LETTER B',
  'LATIN CAPITAL LETTER C', 'LATIN CAPITAL LETTER D', 'LATIN CAPITAL LETTER E', 'LATIN CAPITAL LETTER F',
  'LATIN CAPITAL LETTER G', 'LATIN CAPITAL LETTER H', 'LATIN CAPITAL LETTER I', 'LATIN CAPITAL LETTER J',
  'LATIN CAPITAL LETTER K', 'LATIN CAPITAL LETTER L', 'LATIN CAPITAL LETTER M', 'LATIN CAPITAL LETTER N',
  'LATIN CAPITAL LETTER O', 'LATIN CAPITAL LETTER P', 'LATIN CAPITAL LETTER Q', 'LATIN CAPITAL LETTER R',
  'LATIN CAPITAL LETTER S', 'LATIN CAPITAL LETTER T', 'LATIN CAPITAL LETTER U', 'LATIN CAPITAL LETTER V',
  'LATIN CAPITAL LETTER W', 'LATIN CAPITAL LETTER X', 'LATIN CAPITAL LETTER Y', 'LATIN CAPITAL LETTER Z',
  'LEFT SQUARE BRACKET', 'REVERSE SOLIDUS', 'RIGHT SQUARE BRACKET', 'CIRCUMFLEX ACCENT', 'LOW LINE', 'GRAVE ACCENT',
  'LATIN SMALL LETTER A', 'LATIN SMALL LETTER B', 'LATIN SMALL LETTER C', 'LATIN SMALL LETTER D',
  'LATIN SMALL LETTER E', 'LATIN SMALL LETTER F', 'LATIN SMALL LETTER G', 'LATIN SMALL LETTER H',
  'LATIN SMALL LETTER I', 'LATIN SMALL LETTER J', 'LATIN SMALL LETTER K', 'LATIN SMALL LETTER L',
  'LATIN SMALL LETTER M', 'LATIN SMALL LETTER N', 'LATIN SMALL LETTER O', 'LATIN SMALL LETTER P',
  'LATIN SMALL LETTER Q', 'LATIN SMALL LETTER R', 'LATIN SMALL LETTER S', 'LATIN SMALL LETTER T',
  'LATIN SMALL LETTER U', 'LATIN SMALL LETTER V', 'LATIN SMALL LETTER W', 'LATIN SMALL LETTER X',
  'LATIN SMALL LETTER Y', 'LATIN SMALL LETTER Z', 'LEFT CURLY BRACKET', 'VERTICAL LINE', 'RIGHT CURLY BRACKET',
  'TILDE',
]);

const TAG_FIRST = 0xe0000;
const TAG_LAST = 0xe007f;
const TAG_LANGUAGE = 0xe0001;
const TAG_CANCEL = 0xe007f;
const ASCII_FIRST = 0x20;

const TAB = 0x09;
const NEWLINE = 0x0a;

/** The name of a tag character: the Unicode name where it has one, else the code point label (U+E0000, U+E0002 to U+E001F are unassigned). */
function tagName(c: number): string {
  if (c === TAG_LANGUAGE) return 'LANGUAGE TAG';
  if (c === TAG_CANCEL) return 'CANCEL TAG';
  const ascii = ASCII_NAMES[c - TAG_FIRST - ASCII_FIRST];
  return ascii === undefined ? `<reserved-${c.toString(16).toUpperCase().padStart(5, '0')}>` : `TAG ${ascii}`;
}

/** The name of a hidden character, or null for one a reader can see. */
function hiddenName(c: number): string | null {
  if (c < 0x20) return c === TAB || c === NEWLINE ? null : (C0_NAMES[c] ?? null);
  if (c >= 0x80 && c <= 0x9f) return C1_NAMES[c - 0x80] ?? null;
  if (c >= TAG_FIRST && c <= TAG_LAST) return tagName(c);
  return Object.hasOwn(OTHER_NAMES, c) ? (OTHER_NAMES[c] ?? null) : null;
}

/** True when `text` holds a hidden character (an href holding one is refused, links.ts). */
export function hasHiddenChar(text: string): boolean {
  for (let i = 0; i < text.length; ) {
    const c = text.codePointAt(i) ?? 0;
    if (hiddenName(c) !== null) return true;
    i += c > 0xffff ? 2 : 1;
  }
  return false;
}

/** Every hidden character of `text`, in order; `index` counts UTF-16 code units, and a code point above U+FFFF takes two. */
export function hiddenChars(text: string): HiddenChar[] {
  const out: HiddenChar[] = [];
  for (let i = 0; i < text.length; ) {
    const c = text.codePointAt(i) ?? 0;
    const name = hiddenName(c);
    if (name !== null) out.push({ index: i, codePoint: c, name });
    i += c > 0xffff ? 2 : 1;
  }
  return out;
}
