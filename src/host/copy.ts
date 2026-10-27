// `./host`'s hidden-character check for a copy (docserver L3, Task 9; plan Reference §11.3; the first consumer's spec
// §4.4, "Hidden characters in a copy", and M8.19). Before the host's own copy adapter writes text anywhere, hiddenChars
// lists every character in it that a reader cannot see: C0 controls other than tab and newline (ESC among them), DEL,
// the C1 controls U+0080 to U+009F (CSI, the one-code-point form of ESC [, among them; ledger C88), the bidi controls U+202A to U+202E and U+2066 to U+2069, and the zero-width characters U+200B to U+200D, U+2060 and
// U+FEFF. Each comes with its index in UTF-16 code units, its code point and its Unicode name, so the host can show a
// visible marker for each. `./host` never touches the clipboard. The link classifier refuses an href holding any of
// them (hasHiddenChar), so the one table serves both. Pure and import-inert: a frozen table and two functions.
//
// The C1 controls go beyond the list Reference §11.3 and the first consumer's M8.19 name (ledger C88): a terminal reads
// U+009B as the start of an escape sequence, so a copy holding one is shown, never written silently.

export interface HiddenChar {
  /** The character's index in the text, in UTF-16 code units. */
  readonly index: number;
  readonly codePoint: number;
  /** Its Unicode name (for a control, its name alias). */
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
  // zero-width characters
  0x200b: 'ZERO WIDTH SPACE',
  0x200c: 'ZERO WIDTH NON-JOINER',
  0x200d: 'ZERO WIDTH JOINER',
  0x2060: 'WORD JOINER',
  0xfeff: 'ZERO WIDTH NO-BREAK SPACE',
});

const TAB = 0x09;
const NEWLINE = 0x0a;

/** The name of a hidden character, or null for one a reader can see. */
function hiddenName(c: number): string | null {
  if (c < 0x20) return c === TAB || c === NEWLINE ? null : (C0_NAMES[c] ?? null);
  if (c >= 0x80 && c <= 0x9f) return C1_NAMES[c - 0x80] ?? null;
  return Object.hasOwn(OTHER_NAMES, c) ? (OTHER_NAMES[c] ?? null) : null;
}

/** True when `text` holds a hidden character (an href holding one is refused, links.ts). */
export function hasHiddenChar(text: string): boolean {
  for (let i = 0; i < text.length; i += 1) if (hiddenName(text.charCodeAt(i)) !== null) return true;
  return false;
}

/** Every hidden character of `text`, in order. Every listed character is in the BMP, so one code unit is one character. */
export function hiddenChars(text: string): HiddenChar[] {
  const out: HiddenChar[] = [];
  for (let i = 0; i < text.length; i += 1) {
    const c = text.charCodeAt(i);
    const name = hiddenName(c);
    if (name !== null) out.push({ index: i, codePoint: c, name });
  }
  return out;
}
