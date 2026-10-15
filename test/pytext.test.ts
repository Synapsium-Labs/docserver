// Python text semantics and the two escapers (docserver L1, Task 3; architecture section C, global
// constraints 5 and 6). Every expected value below is what CPython 3.12 (the reference renderer's
// interpreter) returns for the same call, measured while planning.
import MarkdownIt from 'markdown-it';
import { describe, expect, it } from 'vitest';
import { escapeHtml, pyEscape } from '../src/render/escape.js';
import { PY_WS, cpLength, cpSlice, isPyWs, pyLower, pyStrip, utf8Length } from '../src/render/pyText.js';

/** The code points for which CPython 3.12's str.isspace() is true (the whole range; all are in the BMP). */
const PYTHON_WHITESPACE = [
  0x9, 0xa, 0xb, 0xc, 0xd, 0x1c, 0x1d, 0x1e, 0x1f, 0x20, 0x85, 0xa0, 0x1680, 0x2000, 0x2001, 0x2002, 0x2003,
  0x2004, 0x2005, 0x2006, 0x2007, 0x2008, 0x2009, 0x200a, 0x2028, 0x2029, 0x202f, 0x205f, 0x3000,
];

describe('PY_WS and isPyWs', () => {
  it("are exactly Python's whitespace over the Basic Multilingual Plane", () => {
    const found: number[] = [];
    for (let c = 0; c <= 0xffff; c += 1) if (isPyWs(String.fromCharCode(c))) found.push(c);
    expect(found).toEqual(PYTHON_WHITESPACE);
  });

  it('PY_WS is a character-class body that builds the same set', () => {
    const re = new RegExp(`^[${PY_WS}]+$`);
    expect(re.test(String.fromCodePoint(...PYTHON_WHITESPACE))).toBe(true);
    expect(re.test('\ufeff')).toBe(false);
    expect(re.test('\u200b')).toBe(false);
  });

  it('a string of more than one character is not whitespace', () => {
    expect(isPyWs('  ')).toBe(false);
    expect(isPyWs('')).toBe(false);
  });
});

describe('pyStrip', () => {
  it("strips \\x1c, \\x85 and \\u3000 as Python does, and keeps \\ufeff, which JS's trim() strips", () => {
    expect(pyStrip('\x1c\x85\u3000 x \t\x1f')).toBe('x');
    expect(pyStrip('\ufeffx\ufeff')).toBe('\ufeffx\ufeff');
    expect('\ufeffx\ufeff'.trim()).toBe('x');
    expect('\x1cx\x85'.trim()).toBe('\x1cx\x85');
  });

  it('keeps inner whitespace and returns an all-whitespace string as empty', () => {
    expect(pyStrip(' a \xa0 b ')).toBe('a \xa0 b');
    expect(pyStrip('\u2028\u2029 \n')).toBe('');
    expect(pyStrip('')).toBe('');
  });

  it('is linear: 200000 spaces around one letter', () => {
    const pad = ' '.repeat(200_000);
    expect(pyStrip(`${pad}x${pad}`)).toBe('x');
  });
});

describe('pyLower', () => {
  it('lowers the whole string, final sigma included, as Python does', () => {
    expect(pyLower('ΟΔΟΣ')).toBe('οδος');
    expect(pyLower('ΟΔΟΣ ΑΒ')).toBe('οδος αβ');
    expect(pyLower('AΣ.')).toBe('aς.');
    expect(pyLower('ΣΑ')).toBe('σα');
  });

  it('applies full case mappings', () => {
    expect(pyLower('İstanbul')).toBe('i\u0307stanbul');
    expect(pyLower('STRASSE ẞ')).toBe('strasse ß');
    expect(pyLower('𐐀𐐁')).toBe('𐐨𐐩');
  });
});

describe('cpLength and cpSlice', () => {
  it('count code points, a surrogate pair as one and a lone surrogate as one', () => {
    expect(cpLength('a😀b')).toBe(3);
    expect(cpLength('\ud800x\udc00')).toBe(3);
    expect(cpLength('')).toBe(0);
  });

  it('cpSlice never splits a surrogate pair', () => {
    expect(cpSlice('a😀b', 2)).toBe('a😀');
    expect(cpSlice('😀😀', 1)).toBe('😀');
    expect(cpSlice('😀😀', 0)).toBe('');
    expect(cpSlice('ab', 5)).toBe('ab');
  });

  it('cpSlice(s, n) has cpLength n when s is longer, at every n', () => {
    const s = 'a😀b𝐀c\u0301d';
    for (let n = 0; n <= cpLength(s); n += 1) {
      expect(cpLength(cpSlice(s, n))).toBe(n);
      expect(s.startsWith(cpSlice(s, n))).toBe(true);
    }
  });
});

describe('utf8Length', () => {
  const samples = ['', 'a', 'é', '€', '😀', 'aé€😀', '\ud800', 'x\udc00y', '\u0000\u007f\u0080\u07ff\u0800\uffff'];

  it("equals the UTF-8 encoder's byte count when under the cap", () => {
    for (const s of samples) expect(utf8Length(s, 1000)).toBe(new TextEncoder().encode(s).length);
  });

  it('returns exactly cap + 1 once the count passes the cap, whatever character crossed it', () => {
    expect(utf8Length('aaaa', 3)).toBe(4);
    expect(utf8Length('a😀', 4)).toBe(5);
    expect(utf8Length('a😀', 2)).toBe(3);
    expect(utf8Length('éé', 3)).toBe(4);
    expect(utf8Length('éé', 4)).toBe(4);
    expect(utf8Length('x', 0)).toBe(1);
  });
});

describe('escapeHtml and pyEscape', () => {
  const md = new MarkdownIt();
  const ascii = Array.from({ length: 128 }, (_, i) => String.fromCharCode(i)).join('');

  it("escapeHtml is markdown-it's escaper: & < > \" and never '", () => {
    expect(escapeHtml(ascii)).toBe(md.utils.escapeHtml(ascii));
    expect(escapeHtml(`<a href="x">'&amp;'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;\'&amp;amp;\'&lt;/a&gt;');
  });

  it("pyEscape is Python's html.escape(s, quote=True): also ' as &#x27;", () => {
    expect(pyEscape(`<a href="x">'&amp;'</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;&#x27;&amp;amp;&#x27;&lt;/a&gt;',
    );
    expect(pyEscape(ascii)).toBe(escapeHtml(ascii).replace("'", '&#x27;'));
  });
});
