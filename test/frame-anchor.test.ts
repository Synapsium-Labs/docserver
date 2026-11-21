// The anchor grammar the bridge carries (docserver parity T1; ruling R2): src/frame/anchor.ts is the wire's copy of nav's
// position token (`TOKEN`, `checkAnchor`, `parseToken` and `tokenOf` in src/enhance/nav.ts), which the pure `./frame` entry
// cannot import. This file owns the equality of the two: `isAnchorToken(s)` is true exactly when nav's `parseToken(s)` is
// not null, for every token nav's own `tokenOf` writes and for every rejected shape of nav's check, and the limits are
// nav's. A change to either side that the other does not follow reds a row here. nav's behaviour is not changed.
//
// It also pins `pngBytesOfBase64`: the size of a canonical base64 text from its length and its padding, null for anything
// else, held against Node's own decoder.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ANCHOR_LIMITS, isAnchorToken, pngBytesOfBase64 } from '../src/frame/anchor.js';
import { parseToken, TOKEN, tokenOf, type Anchor } from '../src/enhance/nav.js';

const ROOT = new URL('../', import.meta.url);
const readText = (rel: string): string => readFileSync(new URL(rel, ROOT), 'utf8');

/** A JSON text of an anchor with the given members, so a shape nav's own writer never makes can be spelled. */
const j = (o: unknown): string => JSON.stringify(o);

describe('ANCHOR_LIMITS: the limits of nav\'s TOKEN, word for word', () => {
  it('is line 1024, from 4096 and coord 10 000 000, equal to nav\'s TOKEN, and frozen', () => {
    expect({ ...ANCHOR_LIMITS }).toEqual({ line: 1024, from: 4096, coord: 10_000_000 });
    expect({ ...ANCHOR_LIMITS }).toEqual({ ...TOKEN });
    expect(Object.isFrozen(ANCHOR_LIMITS)).toBe(true);
  });
});

describe('isAnchorToken: every token nav writes is one', () => {
  const anchors: Anchor[] = [
    { line: null, offset: 0, y: 0 },
    { line: '12', offset: 4, y: 300 },
    { line: '12-14', offset: -37.5, y: 0.25 },
    { line: 'heading-two', offset: 0, y: 1200 },
    { line: 'D2_1-a', offset: 10_000_000, y: 10_000_000 },
    { line: 'café-中文-д', offset: -10_000_000, y: 0 },
    { line: 'x'.repeat(1024), offset: 1, y: 1 },
    { line: '7', offset: 123456.789, y: 98765.4321 },
  ];

  it('accepts tokenOf(anchor), and nav parses the same text', () => {
    for (const a of anchors) {
      const text = tokenOf(a);
      expect(text, JSON.stringify(a).slice(0, 60)).not.toBeNull();
      expect(isAnchorToken(text), String(text).slice(0, 60)).toBe(true);
      expect(parseToken(text)).not.toBeNull();
    }
  });

  it('accepts a token of exactly 4096 code units and refuses one of 4097, as nav does', () => {
    const base = j({ line: null, offset: 0, y: 0, pad: '' });
    const at = (n: number): string => j({ line: null, offset: 0, y: 0, pad: 'x'.repeat(n - base.length) });
    expect(at(4096)).toHaveLength(4096);
    expect(at(4097)).toHaveLength(4097);
    expect(isAnchorToken(at(4096))).toBe(true);
    expect(isAnchorToken(at(4097))).toBe(false);
    expect(parseToken(at(4096))).not.toBeNull();
    expect(parseToken(at(4097))).toBeNull();
  });
});

describe('isAnchorToken: every rejected shape of nav\'s check is rejected, and the two agree on every row', () => {
  const ok = { line: '12', offset: 4, y: 300 };
  const rows: readonly (readonly [string, string])[] = [
    ['not JSON', 'not json'],
    ['empty text', ''],
    ['truncated JSON', '{"line":"12","offset":4'],
    ['JSON null', 'null'],
    ['a number', '5'],
    ['a string', '"12"'],
    ['true', 'true'],
    ['an array', '[null,0,0]'],
    ['an empty array', '[]'],
    ['an empty object', '{}'],
    ['no line', j({ offset: 4, y: 300 })],
    ['no offset', j({ line: '12', y: 300 })],
    ['no y', j({ line: '12', offset: 4 })],
    ['a line that is a number', j({ ...ok, line: 12 })],
    ['a line that is an array', j({ ...ok, line: ['12'] })],
    ['a line that is an object', j({ ...ok, line: {} })],
    ['a line that is empty', j({ ...ok, line: '' })],
    ['a line of 1025 code units', j({ ...ok, line: 'a'.repeat(1025) })],
    ['a line with a space', j({ ...ok, line: 'a b' })],
    ['a line with a selector character', j({ ...ok, line: 'a[b]' })],
    ['a line with a dot', j({ ...ok, line: 'a.b' })],
    ['a line with a colon', j({ ...ok, line: 'a:b' })],
    ['a line with a number sign', j({ ...ok, line: '#a' })],
    ['a line with a quote', j({ ...ok, line: 'a"b' })],
    ['a line with a line feed', j({ ...ok, line: 'a\nb' })],
    ['an offset that is a string', j({ ...ok, offset: '4' })],
    ['an offset that is null', j({ ...ok, offset: null })],
    ['an offset past the coordinate bound', j({ ...ok, offset: 10_000_001 })],
    ['an offset before the negative bound', j({ ...ok, offset: -10_000_001 })],
    ['an offset of infinity', '{"line":"12","offset":1e999,"y":300}'],
    ['a y that is a string', j({ ...ok, y: '300' })],
    ['a y that is null', j({ ...ok, y: null })],
    ['a y below zero', j({ ...ok, y: -1 })],
    ['a y just below zero', j({ ...ok, y: -0.000001 })],
    ['a y past the coordinate bound', j({ ...ok, y: 10_000_001 })],
    ['a y of infinity', '{"line":"12","offset":4,"y":1e999}'],
  ];

  for (const [label, text] of rows) {
    it(`${label}: refused, as nav refuses it`, () => {
      expect(parseToken(text), 'nav').toBeNull();
      expect(isAnchorToken(text)).toBe(false);
    });
  }

  it('the edges nav accepts are accepted: a null line, 10 000 000 on either bound, a y of zero and of minus zero, extra members', () => {
    const accepted = [
      j({ line: null, offset: 0, y: 0 }),
      j({ line: '12', offset: 10_000_000, y: 10_000_000 }),
      j({ line: '12', offset: -10_000_000, y: 0 }),
      '{"line":"12","offset":4,"y":-0}',
      '{"line":"12","offset":-0,"y":4}',
      j({ line: '12', offset: 4, y: 300, extra: 'x' }),
      j({ line: 'a'.repeat(1024), offset: 4, y: 300 }),
      j({ line: '12', offset: 1e-9, y: 1e-9 }),
    ];
    for (const text of accepted) {
      expect(parseToken(text), `nav ${text.slice(0, 50)}`).not.toBeNull();
      expect(isAnchorToken(text), text.slice(0, 50)).toBe(true);
    }
  });

  it('agrees with nav on a sweep of generated texts: every combination of line, offset and y, edges and breakers', () => {
    const lines: unknown[] = [null, '12', '12-14', 'a_b-c', '', 'a b', 'a'.repeat(1024), 'a'.repeat(1025), 7, [], {}, 'é', 'a.b', '\ud800'];
    const nums: unknown[] = [0, 1, -1, 0.5, 10_000_000, 10_000_001, -10_000_000, -10_000_001, '1', null, true];
    let compared = 0;
    for (const line of lines) {
      for (const offset of nums) {
        for (const y of nums) {
          const text = j({ line, offset, y });
          expect(isAnchorToken(text), text.slice(0, 80)).toBe(parseToken(text) !== null);
          compared += 1;
        }
      }
    }
    expect(compared).toBe(lines.length * nums.length * nums.length);
  });

  it('is false for a value that is not a string, never a throw', () => {
    for (const v of [null, undefined, 0, 1, true, {}, [], ['{}'], Symbol('s'), () => '{}', { toString: () => j(ok) }]) {
      expect(() => isAnchorToken(v)).not.toThrow();
      expect(isAnchorToken(v)).toBe(false);
    }
  });
});

describe('anchor.ts stays pure and free of nav: no import, no network, no DOM', () => {
  it('has no import at all (the frame\'s pure entry cannot reach src/enhance), and writes the limits as literals nav\'s are checked against', () => {
    const text = readText('src/frame/anchor.ts').replace(/^\s*\/\/.*$/gm, '');
    expect(text).not.toMatch(/\bimport\b/);
    expect(text).not.toMatch(/\b(?:fetch|document|window|localStorage)\b/);
  });
});

describe('pngBytesOfBase64: the decoded size of canonical base64, from its length and padding, else null', () => {
  const b64 = (n: number): string => Buffer.alloc(n, 0xa5).toString('base64');

  it('is the decoded size for every length from 0 to 40, and agrees with Node\'s decoder', () => {
    for (let n = 0; n <= 40; n += 1) {
      const text = b64(n);
      expect(pngBytesOfBase64(text), `${String(n)} bytes: ${text}`).toBe(n);
      expect(Buffer.from(text, 'base64').length).toBe(n);
    }
  });

  it('counts the padding: one and two bytes in the last group are two and three characters of data', () => {
    expect(pngBytesOfBase64('')).toBe(0);
    expect(pngBytesOfBase64('QQ==')).toBe(1);
    expect(pngBytesOfBase64('QUI=')).toBe(2);
    expect(pngBytesOfBase64('QUJD')).toBe(3);
    expect(pngBytesOfBase64('QUJDRA==')).toBe(4);
    expect(pngBytesOfBase64('QUJDREU=')).toBe(5);
  });

  it('measures the print-figure edges: 1 048 575, 1 048 576 and 1 048 577 bytes, and 16 MiB', () => {
    for (const n of [1_048_575, 1_048_576, 1_048_577, 16_777_216]) expect(pngBytesOfBase64(b64(n)), String(n)).toBe(n);
  });

  it('uses the standard alphabet only: the characters of the URL-safe alphabet, and every other, are null', () => {
    for (const bad of ['QU-D', 'QU_D', 'QU D', 'QUJ\n', 'QUJ.', 'QUéD', 'QUJ*', '    ', 'QUJD\n', ' QUJD', '\tQUJD']) expect(pngBytesOfBase64(bad), JSON.stringify(bad)).toBeNull();
  });

  it('wants a length that is a multiple of four, padding included', () => {
    for (const bad of ['Q', 'QU', 'QUJ', 'QUJDR', 'QUJDRU', 'QUJDREU', 'QQ=', 'QU=']) expect(pngBytesOfBase64(bad), bad).toBeNull();
  });

  it('allows padding only at the very end, at most two characters, after at least two of data', () => {
    for (const bad of ['QQ==QUJD', 'Q=QQ', '=QQQ', '====', 'QUJ=QUJD', 'Q===', 'QQ=A', '=', '==', 'AAAA====']) expect(pngBytesOfBase64(bad), bad).toBeNull();
  });

  it('wants the unused bits of the last character to be zero (canonical): QR== and QUK= are not the text that Node writes', () => {
    expect(pngBytesOfBase64('QQ==')).toBe(1);
    expect(pngBytesOfBase64('QR==')).toBeNull();
    expect(pngBytesOfBase64('QUI=')).toBe(2);
    expect(pngBytesOfBase64('QUJ=')).toBeNull();
    // Node decodes the non-canonical text to the same bytes: the refusal is this function's, not the decoder's.
    expect(Buffer.from('QR==', 'base64').length).toBe(1);
  });

  it('is null for a value that is not a string, never a throw', () => {
    for (const v of [null, undefined, 0, 12, {}, [], ['QQ=='], true, Symbol('s'), { length: 4 }]) {
      expect(() => pngBytesOfBase64(v as never)).not.toThrow();
      expect(pngBytesOfBase64(v as never), String(typeof v)).toBeNull();
    }
  });
});
