// The pure SHA-256 (docserver L3, Task 2; plan Reference §10, FD16). frameDocument verifies every asset with it and
// frameCsp's hash sources come from the same digests, so it must agree with node:crypto byte for byte, in Node, in a
// browser and in a worker alike: it uses neither node:crypto (Node's) nor Web Crypto (asynchronous), and the last
// blocks run it in an empty realm and scan its source for either.
//
// Agreement is checked over the NIST vectors (their published digests and node:crypto's), every length around the
// padding boundaries, astral and lone-surrogate strings (UTF-8 of a lone surrogate is U+FFFD's, as TextEncoder and
// Buffer write it) and every built frame asset. The memo holds at most 8 strings, oldest evicted first: a memo hit
// answers the very array it stored, so the bound is observed through identity, with no hook in the source. Every
// non-ASCII character in a string here is written as an escape (ruling R6), and the last block scans Task 2's files,
// this one among them, for any that is not.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { buildSync } from 'esbuild';
import ts from 'typescript';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildFrame, type BuiltFrame } from '../scripts/build-frame.mjs';
import { checkFrameCsp, frameCsp } from '../src/frame/csp.js';
import { FRAME_MANIFEST } from '../src/frame/manifest.generated.js';
import { base64, cspHash, hex, hexToBase64, sha256Bytes, sha256Text, utf8 } from '../src/frame/sha256.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));

const nodeHex = (s: string | Uint8Array): string => createHash('sha256').update(s).digest('hex');

/** FIPS 180-2's SHA-256 examples, with their published digests. */
const NIST: readonly (readonly [name: string, text: () => string, digest: string])[] = [
  ['the empty string', () => '', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
  ['"abc" (one block)', () => 'abc', 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
  [
    'the 448-bit message (56 bytes: the length moves to a second block)',
    () => 'abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq',
    '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
  ],
  [
    'the 896-bit message',
    () => 'abcdefghbcdefghicdefghijdefghijkefghijklfghijklmghijklmnhijklmnoijklmnopjklmnopqklmnopqrlmnopqrsmnopqrstnopqrstu',
    'cf5b16a778af8380036ce59e7b0492370b249b11e8f07a51afac45037afee9d1',
  ],
  ['one million "a"', () => 'a'.repeat(1_000_000), 'cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0'],
];

/** Strings whose UTF-8 differs from their code units: each width, astral pairs and lone surrogates. */
const UNICODE: readonly (readonly [name: string, text: string])[] = [
  ['U+007F and U+0080 (one byte, then two)', '\u007f\u0080'],
  ['U+07FF and U+0800 (two bytes, then three)', '\u07ff\u0800'],
  ['U+FFFF (three bytes)', '\uffff'],
  ['an astral letter (four bytes)', '\u{1d49c}'],
  ['an astral emoji between ASCII', 'a\u{1f600}b'],
  ['U+10FFFF', '\u{10ffff}'],
  ['a lone high surrogate', '\ud800'],
  ['a lone low surrogate', '\udc00'],
  ['a high surrogate at the end', 'x\ud83d'],
  ['a low surrogate first', '\ude00x'],
  ['a reversed pair', '\udc00\ud800'],
  ['a high surrogate, then a valid pair', '\ud800\u{1f600}'],
  ['two high surrogates', '\ud800\ud800'],
  ['NUL', '\u0000'],
  ['U+FFFD itself', '\ufffd'],
];

describe('SHA-256: the NIST vectors', () => {
  for (const [name, text, digest] of NIST) {
    it(`${name}: the published digest, and node:crypto's`, () => {
      const t = text();
      expect(hex(sha256Text(t))).toBe(digest);
      expect(nodeHex(t)).toBe(digest);
    });
  }
});

describe('SHA-256: agreement with node:crypto', () => {
  it('every length from 0 to 200 bytes (each padding boundary: 55, 56, 63, 64, 119, 120, 127, 128)', () => {
    let s = '';
    for (let n = 0; n <= 200; n++) {
      expect(sha256Text(s).length).toBe(32);
      expect(hex(sha256Text(s)), `length ${n}`).toBe(nodeHex(s));
      s += String.fromCharCode(0x21 + ((n * 7) % 94));
    }
  });

  it('every byte length from 50 to 70 reached by three-byte characters, and sha256Bytes over raw bytes 0 to 255', () => {
    for (let n = 50; n <= 70; n++) {
      const s = 'b'.repeat(n % 3) + '\u20ac'.repeat(Math.floor(n / 3));
      expect(utf8(s).length).toBe(n);
      expect(hex(sha256Text(s)), `bytes ${n}`).toBe(nodeHex(s));
    }
    const raw = Uint8Array.from({ length: 256 }, (_, i) => i);
    for (let n = 0; n <= 256; n += 1) expect(hex(sha256Bytes(raw.subarray(0, n))), `raw ${n}`).toBe(nodeHex(raw.subarray(0, n)));
  });

  for (const [name, text] of UNICODE) {
    it(`${name}: UTF-8 as TextEncoder and Buffer write it, and the digest node:crypto gives`, () => {
      const want = new TextEncoder().encode(text);
      expect([...utf8(text)]).toEqual([...want]);
      expect([...utf8(text)]).toEqual([...Buffer.from(text, 'utf8')]);
      expect(hex(sha256Text(text))).toBe(nodeHex(text));
      expect(hex(sha256Text(text))).toBe(nodeHex(want));
    });
  }

  it("a lone surrogate hashes as U+FFFD's three bytes", () => {
    expect([...utf8('\ud800')]).toEqual([0xef, 0xbf, 0xbd]);
    expect(hex(sha256Text('\ud800'))).toBe(hex(sha256Text('\ufffd')));
    expect(hex(sha256Text('\udc00\ud800'))).toBe(hex(sha256Text('\ufffd\ufffd')));
  });

  it('hex and base64 agree with Buffer for every length from 0 to 40, and hexToBase64 inverts hex', () => {
    const bytes = Uint8Array.from({ length: 40 }, (_, i) => (i * 97 + 13) & 255);
    for (let n = 0; n <= 40; n++) {
      const b = bytes.subarray(0, n);
      expect(hex(b)).toBe(Buffer.from(b).toString('hex'));
      expect(base64(b)).toBe(Buffer.from(b).toString('base64'));
      expect(hexToBase64(hex(b))).toBe(base64(b));
    }
  });

  it("cspHash is 'sha256-' and the digest in base64, quoted", () => {
    for (const t of ['', 'abc', '\u{1f600}', 'console.log(1)\n']) {
      expect(cspHash(t)).toBe(`'sha256-${createHash('sha256').update(t, 'utf8').digest('base64')}'`);
    }
  });
});

describe('SHA-256: every built frame asset', () => {
  let built: BuiltFrame;
  beforeAll(async () => {
    built = await buildFrame();
  }, 120_000);

  for (const name of ['guard', 'bootstrap', 'enhance', 'css', 'mermaid'] as const) {
    it(`${name}: the pure digest equals node:crypto's over the same text, and the build's`, () => {
      const f = built.files[name];
      expect(f.text.length).toBeGreaterThan(0);
      expect(hex(sha256Text(f.text))).toBe(nodeHex(f.text));
      expect(hex(sha256Text(f.text))).toBe(f.sha256);
      if (f.csp !== null) expect(cspHash(f.text)).toBe(f.csp);
    });
  }

  it('the fonts under assets/fonts: sha256Bytes over the file equals node:crypto', () => {
    const dir = path.join(ROOT, 'assets', 'fonts');
    const fonts = readdirSync(dir).filter((f) => f.endsWith('.woff2'));
    expect(fonts.length).toBeGreaterThan(0);
    for (const f of fonts) {
      const bytes = new Uint8Array(readFileSync(path.join(dir, f)));
      expect(hex(sha256Bytes(bytes)), f).toBe(nodeHex(bytes));
    }
  });
});

describe('SHA-256: the memo holds at most 8 strings, oldest evicted first', () => {
  const strings = (tag: string, n: number): string[] => Array.from({ length: n }, (_, i) => `memo row ${tag} string ${i}`);

  it('eight strings are all held: each second call answers the array of the first', () => {
    const s = strings('eight', 8);
    const first = s.map((t) => sha256Text(t));
    for (let i = 7; i >= 0; i--) expect(sha256Text(s[i] as string), `string ${i}`).toBe(first[i]);
  });

  it('a ninth string evicts the oldest: the other eight are still held, the oldest is hashed again to equal bytes', () => {
    const s = strings('nine', 9);
    const first = s.map((t) => sha256Text(t));
    for (let i = 8; i >= 1; i--) expect(sha256Text(s[i] as string), `string ${i}`).toBe(first[i]);
    const again = sha256Text(s[0] as string);
    expect(again).not.toBe(first[0]);
    expect(hex(again)).toBe(hex(first[0] as Uint8Array));
    expect(hex(again)).toBe(nodeHex(s[0] as string));
  });

  it('a memo hit does not refresh a string: the oldest is hit while seven newer are held, and a ninth still evicts it, not the second', () => {
    // The hit falls while the oldest is NOT the newest entry, so a memo that refreshed on a hit (least recently used)
    // would evict the second string here, and this one evicts the first. The second is read before the first: reading
    // an evicted string inserts it again, which would itself evict the second.
    const s = strings('fifo', 9);
    const first = s.slice(0, 8).map((t) => sha256Text(t));
    expect(sha256Text(s[0] as string)).toBe(first[0]);
    sha256Text(s[8] as string);
    expect(sha256Text(s[1] as string), 'the second string is still held').toBe(first[1]);
    expect(sha256Text(s[0] as string), 'the first string, hit before the ninth, is evicted').not.toBe(first[0]);
  });
});

describe('SHA-256 and the policy run identically without Node: an empty realm', () => {
  // One bundle of the three pure files, run in a context whose global object has no prototype and no host API at all.
  // A bundle that does not build (a host module imported, say) is an assertion failure of the first row, not a file
  // that fails to load.
  const bundle = (): { code: string | null; errors: string[] } => {
    try {
      const out = buildSync({
        stdin: {
          contents:
            "export { sha256Text, hex, base64, cspHash, utf8 } from './src/frame/sha256.ts';\n" +
            "export { frameCsp, checkFrameCsp } from './src/frame/csp.ts';\n",
          resolveDir: ROOT,
          loader: 'ts',
          sourcefile: 'frame-pure-entry.ts',
        },
        bundle: true,
        format: 'iife',
        globalName: 'P',
        platform: 'neutral',
        target: 'es2022',
        write: false,
        logLevel: 'silent',
      });
      return { code: out.outputFiles[0]?.text ?? null, errors: [] };
    } catch (e) {
      return { code: null, errors: ((e as { errors?: { text: string }[] }).errors ?? [{ text: String(e) }]).map((x) => x.text) };
    }
  };
  let realm: vm.Context | null = null;
  beforeAll(() => {
    const b = bundle();
    if (b.code === null) return;
    realm = vm.createContext(Object.create(null));
    vm.runInContext(b.code, realm, { filename: 'frame-pure.bundle.js' });
  });
  const run = <T>(expr: string): T => {
    expect(realm, 'the bundle built and ran').not.toBeNull();
    return JSON.parse(vm.runInContext(`JSON.stringify(${expr})`, realm as vm.Context) as string) as T;
  };

  it('the three files bundle for a platform with no host modules', () => {
    expect(bundle().errors).toEqual([]);
  });

  it('the realm has no host API: no crypto, TextEncoder, Buffer, process or require', () => {
    expect(run<string[]>("['crypto','TextEncoder','Buffer','process','require','window','self'].filter((n) => typeof globalThis[n] !== 'undefined')")).toEqual([]);
  });

  it('the NIST vectors and every Unicode case give node:crypto\'s digest there', () => {
    for (const [name, text, digest] of NIST) {
      if (text().length > 1000) continue;
      expect(run<string>(`P.hex(P.sha256Text(${JSON.stringify(text())}))`), name).toBe(digest);
    }
    for (const [name, text] of UNICODE) expect(run<string>(`P.hex(P.sha256Text(${JSON.stringify(text)}))`), name).toBe(nodeHex(text));
  });

  it('frameCsp() is the same string there, and checkFrameCsp gives the same verdicts', () => {
    expect(run<string>('P.frameCsp()')).toBe(frameCsp());
    const required = JSON.stringify([FRAME_MANIFEST.guard.csp, FRAME_MANIFEST.bootstrap.csp, FRAME_MANIFEST.enhance.csp]);
    for (const policy of [frameCsp(), `${frameCsp()}; connect-src *`, frameCsp().replace(FRAME_MANIFEST.enhance.csp, '')]) {
      expect(run(`P.checkFrameCsp(${JSON.stringify(policy)}, ${required})`)).toEqual(checkFrameCsp(policy, JSON.parse(required) as string[]));
    }
  });
});

describe('SHA-256 and the policy name no host crypto', () => {
  const FILES = ['src/frame/sha256.ts', 'src/frame/csp.ts', 'src/frame/csp-rules.ts'];
  const FORBIDDEN = ['crypto', 'subtle', 'webcrypto', 'createHash', 'require', 'Buffer', 'TextEncoder', 'process', 'globalThis', 'window', 'self'];

  for (const rel of FILES) {
    it(`${rel}: imports only frame files, and names none of ${FORBIDDEN.join(', ')}`, () => {
      const sf = ts.createSourceFile(rel, readFileSync(path.join(ROOT, rel), 'utf8'), ts.ScriptTarget.ES2022, true);
      const specifiers = sf.statements.filter(ts.isImportDeclaration).map((s) => (s.moduleSpecifier as ts.StringLiteral).text);
      for (const s of specifiers) expect(s, rel).toMatch(/^\.\/[a-z-]+(\.generated)?\.js$/);
      const named: string[] = [];
      const visit = (n: ts.Node): void => {
        if (ts.isIdentifier(n) && FORBIDDEN.includes(n.text)) named.push(n.text);
        ts.forEachChild(n, visit);
      };
      visit(sf);
      expect(named).toEqual([]);
    });
  }

  it('src/frame/sha256.ts imports nothing at all', () => {
    const rel = 'src/frame/sha256.ts';
    const sf = ts.createSourceFile(rel, readFileSync(path.join(ROOT, rel), 'utf8'), ts.ScriptTarget.ES2022, true);
    expect(sf.statements.filter(ts.isImportDeclaration)).toEqual([]);
  });
});

// Ruling R6 (ledger C81): escape sequences are written visibly in every committed text. The scan reads Task 2's files
// whole, as test/host-parse.test.ts reads the host's: no character outside printable ASCII and the line feed, but the
// section sign of a title or a comment. A raw letter, emoji or line separator in a string would pass every row above
// (each code point is still right), so only this scan holds the headers' claim.
/** Each character of `text` outside printable ASCII and the line feed, but the section sign, as `line: U+XXXX`. */
function rawCharacters(text: string): string[] {
  const out: string[] = [];
  let line = 1;
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp === 0x0a) line += 1;
    else if ((cp < 0x20 || cp > 0x7e) && cp !== 0xa7) out.push(`${line}: U+${cp.toString(16).toUpperCase().padStart(4, '0')}`);
  }
  return out;
}

describe("ruling R6: Task 2's files write every non-ASCII character as a visible escape", () => {
  const FILES = ['src/frame/sha256.ts', 'src/frame/csp.ts', 'src/frame/csp-rules.ts', 'test/frame-sha256.test.ts', 'test/frame-csp.test.ts'];

  for (const file of FILES) {
    it(file, () => {
      expect(rawCharacters(readFileSync(path.join(ROOT, file), 'utf8'))).toEqual([]);
    });
  }

  it('the scan sees a raw letter, an astral character, a line separator, a tab and a no-break space, and passes the section sign (its control)', () => {
    const raw = [0xe9, 0x1f600, 0x2028, 0x09, 0xa0].map((cp) => String.fromCodePoint(cp));
    const text = `const a = '${raw[0]}${raw[1]}';\n// ${String.fromCodePoint(0xa7)} 10\nconst b = "${raw[2]}";\n${raw[3]}x${raw[4]}\n`;
    expect(rawCharacters(text)).toEqual(['1: U+00E9', '1: U+1F600', '3: U+2028', '4: U+0009', '4: U+00A0']);
  });
});
