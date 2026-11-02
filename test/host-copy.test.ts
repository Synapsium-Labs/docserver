// `./host`'s hidden-character check for a copy (docserver L3, Task 9; plan Reference §11.3, row L3.H7; mirrors the first
// consumer's M8.19, widened by ledger C88 and by the operator's ruling of 2026-11-02, ledger C103). hiddenChars lists every
// character a reader cannot see in copied text: C0 controls but tab and newline (ESC among them), DEL, the C1 controls
// U+0080 to U+009F, the bidi controls U+202A to U+202E and U+2066 to U+2069, the directional marks U+200E, U+200F and
// U+061C, the zero-width characters U+200B to U+200D, U+2060 and U+FEFF, and the tag characters U+E0000 to U+E007F; each
// with its UTF-16 index, its code point and its Unicode name. `./host` never touches the clipboard: it passes the text
// and this list to the host's own copy adapter.
import { describe, expect, it } from 'vitest';
import { hasHiddenChar, hiddenChars } from '../src/host/copy.js';

const BIDI: readonly [number, string][] = [
  [0x202a, 'LEFT-TO-RIGHT EMBEDDING'],
  [0x202b, 'RIGHT-TO-LEFT EMBEDDING'],
  [0x202c, 'POP DIRECTIONAL FORMATTING'],
  [0x202d, 'LEFT-TO-RIGHT OVERRIDE'],
  [0x202e, 'RIGHT-TO-LEFT OVERRIDE'],
  [0x2066, 'LEFT-TO-RIGHT ISOLATE'],
  [0x2067, 'RIGHT-TO-LEFT ISOLATE'],
  [0x2068, 'FIRST STRONG ISOLATE'],
  [0x2069, 'POP DIRECTIONAL ISOLATE'],
];
const MARKS: readonly [number, string][] = [
  [0x061c, 'ARABIC LETTER MARK'],
  [0x200e, 'LEFT-TO-RIGHT MARK'],
  [0x200f, 'RIGHT-TO-LEFT MARK'],
];
const ZERO_WIDTH: readonly [number, string][] = [
  [0x200b, 'ZERO WIDTH SPACE'],
  [0x200c, 'ZERO WIDTH NON-JOINER'],
  [0x200d, 'ZERO WIDTH JOINER'],
  [0x2060, 'WORD JOINER'],
  [0xfeff, 'ZERO WIDTH NO-BREAK SPACE'],
];

describe('L3.H7 each hidden character is reported with its index and name', () => {
  it('ESC', () => {
    expect(hiddenChars('a\u001b[31mred')).toEqual([{ index: 1, codePoint: 0x1b, name: 'ESCAPE' }]);
  });

  for (const [cp, name] of BIDI) {
    it(`the bidi control U+${cp.toString(16).toUpperCase()} ${name}`, () => {
      expect(hiddenChars(`ab${String.fromCharCode(cp)}c`)).toEqual([{ index: 2, codePoint: cp, name }]);
    });
  }

  for (const [cp, name] of MARKS) {
    it(`the directional mark U+${cp.toString(16).toUpperCase().padStart(4, '0')} ${name}`, () => {
      expect(hiddenChars(`ab${String.fromCharCode(cp)}c`)).toEqual([{ index: 2, codePoint: cp, name }]);
    });
  }

  for (const [cp, name] of ZERO_WIDTH) {
    it(`the zero-width character U+${cp.toString(16).toUpperCase()} ${name}`, () => {
      expect(hiddenChars(`${String.fromCharCode(cp)}x`)).toEqual([{ index: 0, codePoint: cp, name }]);
    });
  }

  it('DEL, NUL, BEL, BACKSPACE, VT, FF and CR', () => {
    expect(hiddenChars('\u007f\u0000\u0007\u0008\u000b\u000c\u000d')).toEqual([
      { index: 0, codePoint: 0x7f, name: 'DELETE' },
      { index: 1, codePoint: 0x00, name: 'NULL' },
      { index: 2, codePoint: 0x07, name: 'BELL' },
      { index: 3, codePoint: 0x08, name: 'BACKSPACE' },
      { index: 4, codePoint: 0x0b, name: 'LINE TABULATION' },
      { index: 5, codePoint: 0x0c, name: 'FORM FEED' },
      { index: 6, codePoint: 0x0d, name: 'CARRIAGE RETURN' },
    ]);
  });

  it('every C0 control but tab and newline, each with a name of its own', () => {
    const found = hiddenChars(Array.from({ length: 32 }, (_, i) => String.fromCharCode(i)).join(''));
    expect(found.map((h) => h.codePoint)).toEqual(Array.from({ length: 32 }, (_, i) => i).filter((i) => i !== 0x09 && i !== 0x0a));
    expect(found.map((h) => h.index)).toEqual(found.map((h) => h.codePoint));
    expect(new Set(found.map((h) => h.name)).size).toBe(30);
    for (const h of found) expect(h.name, h.codePoint.toString(16)).toMatch(/^[A-Z][A-Z -]+[A-Z]$/);
  });
});

describe('L3.H7 the C1 controls are hidden too (ledger C88)', () => {
  it('CSI, the one-code-point form of ESC [, is reported by name', () => {
    expect(hiddenChars('a\u009b31mred')).toEqual([{ index: 1, codePoint: 0x9b, name: 'CONTROL SEQUENCE INTRODUCER' }]);
  });

  it('every C1 control, U+0080 to U+009F, each with a name of its own', () => {
    const found = hiddenChars(Array.from({ length: 32 }, (_, i) => String.fromCharCode(0x80 + i)).join(''));
    expect(found.map((h) => h.codePoint)).toEqual(Array.from({ length: 32 }, (_, i) => 0x80 + i));
    expect(found.map((h) => h.index)).toEqual(Array.from({ length: 32 }, (_, i) => i));
    expect(new Set(found.map((h) => h.name)).size).toBe(32);
    for (const h of found) expect(h.name, h.codePoint.toString(16)).toMatch(/^[A-Z][A-Z -]+[A-Z]$/);
    expect(found.find((h) => h.codePoint === 0x85)?.name).toBe('NEXT LINE');
  });
});

describe('L3.H7 what is not hidden', () => {
  it('clean text, tab, newline, ordinary non-ASCII and the marks beside the listed ranges give nothing', () => {
    expect(hiddenChars('')).toEqual([]);
    expect(hiddenChars('const a = 1;\n\tb();\n')).toEqual([]);
    expect(hiddenChars('caf\u00e9 \u4e2d\u6587 \u{1F600} \u00a0')).toEqual([]);
    for (const cp of [0x2029, 0x2030, 0x2065, 0x206a, 0x200a, 0x205f, 0x061b, 0x061d, 0x2010, 0x2061, 0xfefe, 0xff00, 0x7e, 0xa0, 0xa1]) {
      expect(hiddenChars(String.fromCharCode(cp)), cp.toString(16)).toEqual([]);
    }
  });
});

describe('L3.H7 indices are UTF-16 code units, in order', () => {
  it('an astral character before a hidden one counts two', () => {
    expect(hiddenChars('\u{1F600}\u200b')).toEqual([{ index: 2, codePoint: 0x200b, name: 'ZERO WIDTH SPACE' }]);
  });

  it('every hidden character of a mixed text, in order', () => {
    const text = `x\u202ey\u2066z\u001b\ufeff\u0000`;
    expect(hiddenChars(text).map((h) => [h.index, h.codePoint])).toEqual([
      [1, 0x202e],
      [3, 0x2066],
      [5, 0x1b],
      [6, 0xfeff],
      [7, 0x00],
    ]);
  });

  it('a lone surrogate is not reported (it is no listed character)', () => {
    expect(hiddenChars('a\ud800b')).toEqual([]);
  });
});

describe('L3.H7 the tag characters, U+E0000 to U+E007F (ledger C103)', () => {
  const tag = (cp: number): string => String.fromCodePoint(cp);
  const block = Array.from({ length: 128 }, (_, i) => tag(0xe0000 + i)).join('');

  it('LANGUAGE TAG and CANCEL TAG, each with its name', () => {
    expect(hiddenChars(`a${tag(0xe0001)}b`)).toEqual([{ index: 1, codePoint: 0xe0001, name: 'LANGUAGE TAG' }]);
    expect(hiddenChars(`a${tag(0xe007f)}b`)).toEqual([{ index: 1, codePoint: 0xe007f, name: 'CANCEL TAG' }]);
  });

  it('the whole block: 128 entries in order, two code units apart, each with a name of its own', () => {
    const found = hiddenChars(block);
    expect(found).toHaveLength(128);
    expect(found.map((h) => h.codePoint)).toEqual(Array.from({ length: 128 }, (_, i) => 0xe0000 + i));
    expect(found.map((h) => h.index)).toEqual(Array.from({ length: 128 }, (_, i) => 2 * i));
    for (const h of found) expect(h.name.length, h.codePoint.toString(16)).toBeGreaterThan(0);
    expect(new Set(found.map((h) => h.name)).size).toBe(128);
    const name = (cp: number): string | undefined => found.find((h) => h.codePoint === cp)?.name;
    expect(name(0xe0020)).toBe('TAG SPACE');
    expect(name(0xe0030)).toBe('TAG DIGIT ZERO');
    expect(name(0xe0041)).toBe('TAG LATIN CAPITAL LETTER A');
    expect(name(0xe0067)).toBe('TAG LATIN SMALL LETTER G');
    expect(name(0xe007e)).toBe('TAG TILDE');
    expect(name(0xe0000)).toBe('<reserved-E0000>');
    expect(name(0xe0002)).toBe('<reserved-E0002>');
    expect(name(0xe001f)).toBe('<reserved-E001F>');
  });

  it('the boundaries: U+E0080 and the waving black flag alone are not hidden', () => {
    expect(hiddenChars(tag(0xe0080))).toEqual([]);
    expect(hiddenChars(tag(0xdffff))).toEqual([]);
    expect(hiddenChars('\u{1F3F4}')).toEqual([]);
  });

  it('the England flag: the flag is visible, its six tag characters are not', () => {
    const found = hiddenChars('\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}');
    expect(found.map((h) => h.index)).toEqual([2, 4, 6, 8, 10, 12]);
    expect(found.map((h) => h.name)).toEqual([
      'TAG LATIN SMALL LETTER G',
      'TAG LATIN SMALL LETTER B',
      'TAG LATIN SMALL LETTER E',
      'TAG LATIN SMALL LETTER N',
      'TAG LATIN SMALL LETTER G',
      'CANCEL TAG',
    ]);
  });
});

describe('L3.H7 the tag names, all 95 of them, against a list derived apart from the source table (ledger C103)', () => {
  const PUNCTUATION: Record<string, string> = {
    ' ': 'SPACE', '!': 'EXCLAMATION MARK', '"': 'QUOTATION MARK', '#': 'NUMBER SIGN', $: 'DOLLAR SIGN', '%': 'PERCENT SIGN',
    '&': 'AMPERSAND', "'": 'APOSTROPHE', '(': 'LEFT PARENTHESIS', ')': 'RIGHT PARENTHESIS', '*': 'ASTERISK', '+': 'PLUS SIGN',
    ',': 'COMMA', '-': 'HYPHEN-MINUS', '.': 'FULL STOP', '/': 'SOLIDUS', ':': 'COLON', ';': 'SEMICOLON',
    '<': 'LESS-THAN SIGN', '=': 'EQUALS SIGN', '>': 'GREATER-THAN SIGN', '?': 'QUESTION MARK', '@': 'COMMERCIAL AT',
    '[': 'LEFT SQUARE BRACKET', '\\': 'REVERSE SOLIDUS', ']': 'RIGHT SQUARE BRACKET', '^': 'CIRCUMFLEX ACCENT', _: 'LOW LINE',
    '`': 'GRAVE ACCENT', '{': 'LEFT CURLY BRACKET', '|': 'VERTICAL LINE', '}': 'RIGHT CURLY BRACKET', '~': 'TILDE',
  };
  const DIGITS = ['ZERO', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE'];

  function asciiName(ch: string): string {
    const cp = ch.charCodeAt(0);
    if (cp >= 0x30 && cp <= 0x39) return `DIGIT ${DIGITS[cp - 0x30]}`;
    if (cp >= 0x41 && cp <= 0x5a) return `LATIN CAPITAL LETTER ${ch}`;
    if (cp >= 0x61 && cp <= 0x7a) return `LATIN SMALL LETTER ${ch.toUpperCase()}`;
    const name = PUNCTUATION[ch];
    if (name === undefined) throw new Error(`no name for ${cp.toString(16)}`);
    return name;
  }

  it('every U+E0020 to U+E007E is TAG plus the name of its ASCII twin', () => {
    expect(Object.keys(PUNCTUATION)).toHaveLength(33);
    for (let cp = 0x20; cp <= 0x7e; cp += 1) {
      const ch = String.fromCharCode(cp);
      expect(hiddenChars(String.fromCodePoint(0xe0000 + cp)), `U+${(0xe0000 + cp).toString(16).toUpperCase()}`).toEqual([
        { index: 0, codePoint: 0xe0000 + cp, name: `TAG ${asciiName(ch)}` },
      ]);
    }
  });
});

describe('L3.H7 the walk is by code point (ledger C103)', () => {
  it('an index stays right after an astral visible character', () => {
    expect(hiddenChars('\u{1F600}\u200ex')).toEqual([{ index: 2, codePoint: 0x200e, name: 'LEFT-TO-RIGHT MARK' }]);
  });

  it('a lone high surrogate before a mark does not break the walk; alone it is not hidden', () => {
    expect(hiddenChars('\ud800\u200e')).toEqual([{ index: 1, codePoint: 0x200e, name: 'LEFT-TO-RIGHT MARK' }]);
    expect(hiddenChars('\ud800')).toEqual([]);
    expect(hiddenChars('\udc00')).toEqual([]);
  });

  it('the step threshold: the mark after U+FFFF (one code unit) is not skipped', () => {
    expect(hiddenChars('\uffff\u200e')).toEqual([{ index: 1, codePoint: 0x200e, name: 'LEFT-TO-RIGHT MARK' }]);
    expect(hiddenChars('\uffff\u{E0041}')).toEqual([{ index: 1, codePoint: 0xe0041, name: 'TAG LATIN CAPITAL LETTER A' }]);
  });

  it('a lone high surrogate before a tag character reads as that tag character after the surrogate', () => {
    expect(hiddenChars('\ud800\u{E0041}')).toEqual([{ index: 1, codePoint: 0xe0041, name: 'TAG LATIN CAPITAL LETTER A' }]);
  });
});

describe('L3.H7 hasHiddenChar', () => {
  it('is true for a directional mark and for a tag character, false for clean text', () => {
    expect(hasHiddenChar('a\u200eb')).toBe(true);
    expect(hasHiddenChar('a\u061cb')).toBe(true);
    expect(hasHiddenChar('a\u{E0041}b')).toBe(true);
    expect(hasHiddenChar('a\u{E007F}')).toBe(true);
    expect(hasHiddenChar('\u{1F3F4} ab \ud800')).toBe(false);
    expect(hasHiddenChar('')).toBe(false);
  });

  it('the step threshold: the mark after U+FFFF (one code unit) is seen', () => {
    expect(hasHiddenChar('\uffff\u200e')).toBe(true);
    expect(hasHiddenChar('\uffff')).toBe(false);
  });
});
