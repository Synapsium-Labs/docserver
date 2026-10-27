// `./host`'s hidden-character check for a copy (docserver L3, Task 9; plan Reference §11.3, row L3.H7; mirrors the first
// consumer's M8.19, widened by ledger C88). hiddenChars lists every character a reader cannot see in copied text: C0
// controls but tab and newline (ESC among them), DEL, the C1 controls U+0080 to U+009F, the bidi controls U+202A to U+202E and U+2066 to U+2069, and the zero-width characters
// U+200B to U+200D, U+2060 and U+FEFF; each with its UTF-16 index, its code point and its Unicode name. `./host` never
// touches the clipboard: it passes the text and this list to the host's own copy adapter.
import { describe, expect, it } from 'vitest';
import { hiddenChars } from '../src/host/copy.js';

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
    for (const cp of [0x2029, 0x2030, 0x2065, 0x206a, 0x200a, 0x200e, 0x200f, 0x205f, 0x2061, 0xfefe, 0xff00, 0x7e, 0xa0, 0xa1]) {
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
