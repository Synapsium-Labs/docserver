// The seed, schema 1 (docserver L3, Task 3; plan Reference 3, FD7, FD17, ruling R3; rows L3.M3, L3.M4 and L3.M20).
// frameDocument writes it with serializeSeed, and the bootstrap, which bundles src/frame/seed.ts, reads it back with
// validateSeed. Schema 1 has closed keys, and its records are [key, value] pair arrays, so no `__proto__` key can exist.
//
// - L3.M3: the escaping. `<`, `>`, `&`, U+2028 and U+2029 become their ASCII six-character escapes; a hostile string in
//   html, the title, a commit subject or an image ref round-trips exactly.
// - L3.M4: the validator. Plain objects, no proto key at any depth, depth at most 32, exactly schema 1's keys, the nonce
//   kept on a failure only when it was readable, and every field's grammar and cap, each refused by its own name.
// - L3.M20: the caps. SEED_HTML_MAX_CHARS is ceil(2097152 x r), with r recomputed here over the golden corpus;
//   IMAGE_BUDGET_CHARS and SEED_FIELDS_MAX_CHARS recompute from their formulas (the latter also from a maximal seed
//   built here); escapedHtmlLength equals the html's body in serializeSeed's output.
// The copies of L2's and render()'s caps the seed holds (the frame source typechecks with no DOM library, so it cannot
// import them, C86) are held equal to their originals here. Every non-ASCII character in a string is written as an
// escape (ruling R6).
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DOC_BYTES, goldenDocuments, htmlCap, seedRatios } from '../scripts/measure-seed-ratio.mjs';
import { loadCorpus } from '../src/conformance/index.js';
import { LIMITS as ENHANCE_LIMITS, normalizeOptions } from '../src/enhance/options.js';
import { BRIDGE_LIMITS, DOC_FIELDS, FRAME_PREF_VALUES, PREF_KEYS } from '../src/frame/protocol.js';
import {
  escapedHtmlLength,
  FEATURE_KEYS,
  IMAGE_BUDGET_CHARS,
  IMAGE_TYPES,
  MERMAID_DRAW,
  SECURE_KEY_SOURCE,
  SEED_FIELDS_MAX_CHARS,
  SEED_HTML_MAX_CHARS,
  SEED_KEYS,
  SEED_LIMITS,
  serializeSeed,
  validateSeed,
  type Seed,
} from '../src/frame/seed.js';
import { FM_LIST_MAX_ITEM, FM_LIST_MAX_ITEMS, FM_MAX_KEYS, FM_MAX_VALUE } from '../src/render/frontMatter.js';
import { DEFAULT_MAX_IMAGES, render, scanRefs } from '../src/render/index.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const NONCE = 'b'.repeat(32);
const SHA40 = 'a'.repeat(40);
const SHA64 = 'c'.repeat(64);
const PNG = 'data:image/png;base64,iVBORw0KGgo=';

/** The smallest valid seed: every key at the default frameDocument writes. */
function base(): Seed {
  return {
    s: 1,
    nonce: NONCE,
    html: '<p>x</p>',
    title: null,
    frontList: null,
    version: { sha: null, draft: false, commits: null, only: null },
    images: [],
    initialHash: null,
    lang: 'en',
    prefs: {},
    snapshot: [],
    features: {},
    mermaid: null,
    bridge: { links: true, hash: true, copy: true, changes: true, versions: true },
  };
}

/** A valid seed with every field filled. */
function full(): Seed {
  return {
    ...base(),
    title: 'A title',
    frontList: [
      { key: 'status', list: false, vals: ['draft'] },
      { key: 'tags', list: true, vals: ['a', 'b'] },
    ],
    version: {
      sha: SHA40,
      draft: true,
      commits: [{ sha: SHA64, subject: 'A subject', date: '2026-10-27T00:00:00Z', parents: [SHA40] }],
      only: SHA40,
    },
    images: [['a.png', PNG]],
    initialHash: 'fnref1:1',
    lang: 'en-GB',
    prefs: { theme: 'dark', width: 'wide', font: 'sans' },
    snapshot: [
      ['pref:prefs', '{"theme":"dark"}'],
      ['doc:pos', 'null'],
    ],
    features: { rules: true, folds: false, keyboard: true, chrome: { bar: false }, vocabulary: { ids: false, qualifiers: ['annex'] } },
    mermaid: { maxTextSize: 16384, maxEdges: 500, secure: ['themeCSS'], draw: 'on-request' },
    bridge: { links: true, hash: false, copy: true, changes: false, versions: true },
  };
}

/** `v` through the seed's own text and back, as the bootstrap reads it. */
const throughText = (v: Seed): unknown => JSON.parse(serializeSeed(v)) as unknown;

/** A seed as a plain record, so a test can put any value in any key. */
const loose = (over: Record<string, unknown> = {}): Record<string, unknown> => ({ ...(base() as unknown as Record<string, unknown>), ...over });

const why = (v: unknown): string => {
  const c = validateSeed(v);
  return c.ok ? 'ok' : c.why;
};

describe('L3.M3 serializeSeed: the visible escapes', () => {
  const HOSTILE = ['</script><script>x()</script>', '<!--<script>', '\u2028', '\u2029', '\ud800', '&', '\r\n'];
  const H = HOSTILE.join(' ');
  const seed = (): Seed => ({
    ...base(),
    html: `<p>${H}</p>`,
    title: H,
    version: { sha: SHA40, draft: false, commits: [{ sha: SHA40, subject: H, date: '2026-10-27', parents: [] }], only: null },
    images: [[H, PNG]],
  });

  it('html, the title, a commit subject and an image ref holding each hostile string round-trip exactly', () => {
    const s = seed();
    const back = throughText(s) as Seed;
    expect(back).toEqual(s);
    expect(back.html).toBe(`<p>${H}</p>`);
    expect(back.title).toBe(H);
    expect(back.version.commits?.[0]?.subject).toBe(H);
    expect(back.images[0]?.[0]).toBe(H);
    expect(validateSeed(back)).toEqual({ ok: true, seed: s });
  });

  it('the text holds no <, > or &, and neither U+2028 nor U+2029 raw', () => {
    const text = serializeSeed(seed());
    expect(text).not.toMatch(/[<>&]/);
    expect(text).not.toMatch(/[\u2028\u2029]/);
  });

  it('each escape is the ASCII six-character form, so this seed is printable ASCII throughout', () => {
    const text = serializeSeed(seed());
    for (const e of ['\\u003c', '\\u003e', '\\u0026', '\\u2028', '\\u2029', '\\ud800', '\\r\\n']) expect(text).toContain(e);
    expect(text).toMatch(/^[\x20-\x7e]*$/);
    // The html's `<!--<script>` is never in the text as itself, in any case.
    expect(text.toLowerCase()).not.toContain('<!--');
    expect(text.toLowerCase()).not.toContain('<script');
  });

  it('a full seed, every field filled, round-trips and validates', () => {
    const s = full();
    expect(throughText(s)).toEqual(s);
    expect(validateSeed(throughText(s))).toEqual({ ok: true, seed: s });
  });
});

describe('L3.M4 records are pairs: no record key reaches an object', () => {
  it("an image ref '__proto__' round-trips as a pair and validates", () => {
    const s: Seed = { ...base(), images: [['__proto__', PNG]] };
    const text = serializeSeed(s);
    expect(text).toContain('"images":[["__proto__",');
    const back = JSON.parse(text) as Seed;
    expect(Array.isArray(back.images[0])).toBe(true);
    expect(back.images).toEqual([['__proto__', PNG]]);
    expect(validateSeed(back)).toEqual({ ok: true, seed: s });
  });

  it("a snapshot key 'constructor' round-trips as a pair, and is refused as a key off the allow-list, not as a proto key", () => {
    const s = loose({ snapshot: [['constructor', '1']] });
    const back = JSON.parse(serializeSeed(s as unknown as Seed)) as Record<string, unknown>;
    expect(back['snapshot']).toEqual([['constructor', '1']]);
    expect(validateSeed(back)).toEqual({ ok: false, nonce: NONCE, why: 'snapshot' });
  });

  it("the same keys as a record would be refused as proto keys (the reason records are pairs)", () => {
    const asRecord = JSON.parse(`{"__proto__":"${PNG}"}`) as unknown;
    expect(why(loose({ images: asRecord }))).toBe('proto');
    expect(why(loose({ snapshot: { constructor: '1' } }))).toBe('proto');
  });
});

describe('L3.M4 validateSeed: the shape', () => {
  it('base and full pass; the result is the seed', () => {
    for (const s of [base(), full()]) expect(validateSeed(s)).toEqual({ ok: true, seed: s });
  });

  it("SEED_KEYS is schema 1's fourteen keys", () => {
    expect([...SEED_KEYS]).toEqual(['bridge', 'features', 'frontList', 'html', 'images', 'initialHash', 'lang', 'mermaid', 'nonce', 'prefs', 's', 'snapshot', 'title', 'version']);
    expect(Object.keys(base()).sort()).toEqual([...SEED_KEYS]);
  });

  it('an extra key: refused, with the nonce kept so the frame can report', () => {
    expect(validateSeed(loose({ extra: 1 }))).toEqual({ ok: false, nonce: NONCE, why: 'keys' });
  });

  it('each key missing in turn: refused', () => {
    for (const k of SEED_KEYS) {
      if (k === 'nonce') continue;
      const v = loose();
      delete v[k];
      expect(validateSeed(v), k).toEqual({ ok: false, nonce: NONCE, why: 'keys' });
    }
  });

  it('a bad nonce: refused with nonce null (the frame stays silent)', () => {
    for (const n of ['B'.repeat(32), 'b'.repeat(31), 'b'.repeat(33), 7, undefined]) expect(validateSeed(loose({ nonce: n }))).toEqual({ ok: false, nonce: null, why: 'nonce' });
    const v = loose();
    delete v['nonce'];
    expect(validateSeed(v)).toEqual({ ok: false, nonce: null, why: 'nonce' });
  });

  it('not a plain object: refused with nonce null', () => {
    for (const v of [null, [], 'x', 1, Object.assign(Object.create({ inherited: 1 }) as object, base())]) {
      expect(validateSeed(v)).toMatchObject({ ok: false, nonce: null, why: 'not a plain object' });
    }
  });

  it('a proto key at any depth (as JSON.parse makes it, an own key): refused', () => {
    const at = (json: string): unknown => JSON.parse(serializeSeed(base()).replace('"features":{}', `"features":${json}`)) as unknown;
    expect(why(at('{"vocabulary":{"status":{"__proto__":["x"]}}}'))).toBe('proto');
    expect(why(at('{"chrome":{"constructor":true}}'))).toBe('proto');
    expect(why(at('{"vocabulary":{"ids":{"prototype":[]}}}'))).toBe('proto');
    expect(why(JSON.parse(serializeSeed(base()).replace('"prefs":{}', '"prefs":{"__proto__":{"x":1}}')) as unknown)).toBe('proto');
    expect(why(loose({ constructor: 1 }))).toBe('proto');
    expect(why(loose({ frontList: [{ key: 'a', list: false, vals: ['b'], prototype: 1 }] }))).toBe('proto');
  });

  it('a non-plain object at depth: refused', () => {
    expect(why(loose({ features: { chrome: new Map() } }))).toBe('proto');
  });

  it('depth 33 is refused as depth; depth 32 reaches the field check', () => {
    const nest = (n: number): unknown => {
      let v: unknown = true;
      for (let i = 0; i < n; i += 1) v = { a: v };
      return v;
    };
    // The seed is depth 0 and `features` depth 1, so features holding n levels puts its leaf at depth n + 1.
    expect(why(loose({ features: nest(32) }))).toBe('depth');
    expect(why(loose({ features: nest(31) }))).toBe('features');
    const arrays = (n: number): unknown => {
      let v: unknown = 'x';
      for (let k = 0; k < n; k += 1) v = [v];
      return v;
    };
    expect(why(loose({ images: arrays(32) }))).toBe('depth');
    expect(why(loose({ images: arrays(31) }))).toBe('images');
  });
});

/** [the field, a bad value, the reason]: each bad field refused by its own name. */
type Row = readonly [string, unknown, string];

const astral = (n: number): string => '\u{1D400}'.repeat(n);
const pairs = (n: number, at: (i: number) => readonly [string, string]): (readonly [string, string])[] => Array.from({ length: n }, (_, i) => at(i));
const commit = (over: Record<string, unknown> = {}): Record<string, unknown> => ({ sha: SHA40, subject: 's', date: 'd', parents: [], ...over });
const version = (over: Record<string, unknown>): Record<string, unknown> => ({ sha: null, draft: false, commits: null, only: null, ...over });
const words = (n: number, w = 'w'): string[] => Array.from({ length: n }, (_, i) => `${w}${String(i)}`);

const BAD: readonly Row[] = [
  ['s', 2, 'schema'],
  ['html', 1, 'html'],
  ['html', null, 'html'],
  ['title', 1, 'title'],
  ['frontList', {}, 'frontList'],
  ['frontList', [{ key: 'a', list: true, vals: [1] }], 'frontList'],
  ['frontList', [{ key: 'a', list: 'yes', vals: [] }], 'frontList'],
  ['frontList', [{ key: 'a', list: true }], 'frontList'],
  ['frontList', [{ key: 'a', list: false, vals: ['b', 'c'] }], 'frontList'],
  ['frontList', [{ key: 'a', list: false, vals: [] }], 'frontList'],
  ['frontList', Array.from({ length: 41 }, () => ({ key: 'a', list: false, vals: ['b'] })), 'frontList'],
  ['frontList', [{ key: 'k'.repeat(501), list: false, vals: ['b'] }], 'frontList'],
  ['frontList', [{ key: 'a', list: false, vals: ['v'.repeat(501)] }], 'frontList'],
  ['frontList', [{ key: 'a', list: true, vals: Array.from({ length: 301 }, () => 'v') }], 'frontList'],
  ['frontList', [{ key: 'a', list: true, vals: ['v'.repeat(301)] }], 'frontList'],
  ['version', { sha: null, draft: false, commits: null }, 'version'],
  ['version', version({ extra: 1 }), 'version'],
  ['version', [], 'version'],
  ['version', version({ sha: 'abc1234' }), 'version.sha'],
  ['version', version({ sha: 'A'.repeat(40) }), 'version.sha'],
  ['version', version({ sha: 'a'.repeat(41) }), 'version.sha'],
  ['version', version({ draft: 'no' }), 'version.draft'],
  ['version', version({ only: 'abc1234' }), 'version.only'],
  ['version', version({ commits: {} }), 'version.commits'],
  ['version', version({ commits: Array.from({ length: 101 }, () => commit()) }), 'version.commits'],
  ['version', version({ commits: [commit({ sha: 'abc1234' })] }), 'version.commits'],
  ['version', version({ commits: [commit({ subject: 's'.repeat(201) })] }), 'version.commits'],
  ['version', version({ commits: [commit({ subject: 1 })] }), 'version.commits'],
  ['version', version({ commits: [commit({ date: 'd'.repeat(65) })] }), 'version.commits'],
  ['version', version({ commits: [commit({ parents: Array.from({ length: 17 }, () => SHA40) })] }), 'version.commits'],
  ['version', version({ commits: [commit({ parents: ['abc1234'] })] }), 'version.commits'],
  ['version', version({ commits: [commit({ extra: 1 })] }), 'version.commits'],
  ['version', version({ commits: [{ sha: SHA40, subject: 's', date: 'd' }] }), 'version.commits'],
  ['images', {}, 'images'],
  ['images', [['a', PNG, 'x']], 'images'],
  ['images', [['a']], 'images'],
  ['images', [['r'.repeat(2049), PNG]], 'images'],
  ['images', [['a', 'data:image/bmp;base64,AAAA']], 'images'],
  ['images', [['a', 'data:image/png;base64,AA=A']], 'images'],
  ['images', [['a', 'data:image/png,AAAA']], 'images'],
  ['images', [['a', 'https://example.test/a.png']], 'images'],
  ['images', [['a', ` ${PNG}`]], 'images'],
  ['images', [['a', PNG], ['a', PNG]], 'images'],
  ['images', pairs(513, (i) => [`r${String(i)}`, PNG]), 'images'],
  ['initialHash', '', 'initialHash'],
  ['initialHash', 'a b', 'initialHash'],
  ['initialHash', '#x', 'initialHash'],
  ['initialHash', 'x'.repeat(257), 'initialHash'],
  ['initialHash', 7, 'initialHash'],
  ['lang', 'e', 'lang'],
  ['lang', 'en_GB', 'lang'],
  ['lang', `en${'-abcdefgh'.repeat(7)}`, 'lang'],
  ['lang', null, 'lang'],
  ['prefs', [], 'prefs'],
  ['prefs', { theme: 'neon' }, 'prefs.theme'],
  ['prefs', { width: 'narrow' }, 'prefs.width'],
  ['prefs', { font: 1 }, 'prefs.font'],
  ['prefs', { lens: 'product' }, 'prefs.lens'],
  ['snapshot', {}, 'snapshot'],
  ['snapshot', [['pref:prefs']], 'snapshot'],
  ['snapshot', [['pref:lens', '1']], 'snapshot'],
  ['snapshot', [['doc:nothing', '1']], 'snapshot'],
  ['snapshot', [['docreader:prefs', '1']], 'snapshot'],
  ['snapshot', [['pref:prefs', 1]], 'snapshot'],
  ['snapshot', [['pref:prefs', 'not json']], 'snapshot'],
  ['snapshot', [['pref:prefs', '{"a":']], 'snapshot'],
  ['snapshot', [['pref:prefs', '']], 'snapshot'],
  ['snapshot', [['pref:prefs', '1'], ['pref:prefs', '2']], 'snapshot'],
  ['snapshot', [['pref:prefs', `"${'\u00e9'.repeat(32768)}"`]], 'snapshot'],
  ['features', [], 'features'],
  ['features', { lens: true }, 'features'],
  ['features', { rules: 'yes' }, 'features.rules'],
  ['features', { folds: 1 }, 'features.folds'],
  ['features', { keyboard: null }, 'features.keyboard'],
  ['features', { chrome: { bar: 1 } }, 'features.chrome'],
  ['features', { chrome: { menu: true } }, 'features.chrome'],
  ['features', { chrome: [] }, 'features.chrome'],
  ['features', { vocabulary: { unknown: [] } }, 'features.vocabulary'],
  ['features', { vocabulary: { qualifiers: [''] } }, 'features.vocabulary'],
  ['features', { vocabulary: { qualifiers: [' a'] } }, 'features.vocabulary'],
  ['features', { vocabulary: { qualifiers: ['a\u00a0'] } }, 'features.vocabulary'],
  ['features', { vocabulary: { qualifiers: ['w'.repeat(65)] } }, 'features.vocabulary'],
  ['features', { vocabulary: { qualifiers: words(201) } }, 'features.vocabulary'],
  ['features', { vocabulary: { qualifiers: 'annex' } }, 'features.vocabulary'],
  ['features', { vocabulary: { ids: true } }, 'features.vocabulary'],
  ['features', { vocabulary: { ruleIds: false } }, 'features.vocabulary'],
  ['features', { vocabulary: { ids: { prefixes: ['R'], extra: [] } } }, 'features.vocabulary'],
  ['features', { vocabulary: { status: { ok: 'done' } } }, 'features.vocabulary'],
  ['features', { vocabulary: { status: { good: ['done'] } } }, 'features.vocabulary'],
  ['features', { vocabulary: { plan: { owner: ['x'] } } }, 'features.vocabulary'],
  ['features', { vocabulary: { attention: { status: [1] } } }, 'features.vocabulary'],
  ['mermaid', [], 'mermaid'],
  ['mermaid', {}, 'mermaid'],
  ['mermaid', { secure: [] }, 'mermaid'],
  ['mermaid', { draw: 'auto' }, 'mermaid'],
  ['mermaid', { secure: [], draw: 'auto', extra: 1 }, 'mermaid'],
  ['mermaid', { secure: [], draw: 'lazy' }, 'mermaid.draw'],
  ['mermaid', { secure: [], draw: true }, 'mermaid.draw'],
  ['mermaid', { secure: 'x', draw: 'auto' }, 'mermaid.secure'],
  ['mermaid', { secure: ['1a'], draw: 'auto' }, 'mermaid.secure'],
  ['mermaid', { secure: ['k'.repeat(65)], draw: 'auto' }, 'mermaid.secure'],
  ['mermaid', { secure: words(65, 'k'), draw: 'auto' }, 'mermaid.secure'],
  ['mermaid', { secure: [], draw: 'auto', maxEdges: 0 }, 'mermaid.maxEdges'],
  ['mermaid', { secure: [], draw: 'auto', maxEdges: 50001 }, 'mermaid.maxEdges'],
  ['mermaid', { secure: [], draw: 'auto', maxTextSize: 1.5 }, 'mermaid.maxTextSize'],
  ['mermaid', { secure: [], draw: 'auto', maxTextSize: 1048577 }, 'mermaid.maxTextSize'],
  ['mermaid', { secure: [], draw: 'auto', maxTextSize: '100' }, 'mermaid.maxTextSize'],
  ['bridge', {}, 'bridge'],
  ['bridge', { links: true, hash: true, copy: true, changes: true }, 'bridge'],
  ['bridge', { links: 1, hash: true, copy: true, changes: true, versions: true }, 'bridge'],
  ['bridge', { links: true, hash: true, copy: true, changes: true, versions: true, prefs: true }, 'bridge'],
  ['bridge', null, 'bridge'],
];

describe('L3.M4 validateSeed: each bad field refused by its own name, with the nonce kept', () => {
  for (const [field, value, reason] of BAD) {
    const label = JSON.stringify(value) ?? String(value);
    it(`${field} = ${label.length > 60 ? `${label.slice(0, 60)}...` : label}: ${reason}`, () => {
      expect(validateSeed(loose({ [field]: value }))).toEqual({ ok: false, nonce: NONCE, why: reason });
    });
  }

  it('the title: SEED_LIMITS.titleMaxCodeUnits passes, one more is refused', () => {
    const n = SEED_LIMITS.titleMaxCodeUnits;
    expect(why(loose({ title: 't'.repeat(n) }))).toBe('ok');
    expect(why(loose({ title: 't'.repeat(n + 1) }))).toBe('title');
  });

  it('the html: SEED_HTML_MAX_CHARS characters pass the validator, one more is refused', () => {
    const n = SEED_HTML_MAX_CHARS;
    expect(why(loose({ html: 'h'.repeat(n) }))).toBe('ok');
    expect(why(loose({ html: 'h'.repeat(n + 1) }))).toBe('html');
  });

  it('the html is capped as the seed carries it (escaped, FD17): at the cap passes, one escaped character over is refused', () => {
    // Every `<` takes six seed characters, so this html is about a sixth of the cap in parsed length.
    const n = SEED_HTML_MAX_CHARS;
    const at = '<'.repeat(Math.floor(n / 6)) + 'h'.repeat(n % 6);
    expect(escapedHtmlLength(at)).toBe(n);
    expect(at.length).toBeLessThan(n / 5);
    expect(why(loose({ html: at }))).toBe('ok');
    expect(escapedHtmlLength(`${at}h`)).toBe(n + 1);
    expect(why(loose({ html: `${at}h` }))).toBe('html');
    expect(why(loose({ html: `${at.slice(1)}hhhhhh<` }))).toBe('html');
  });

  it('the snapshot: a value of exactly 65536 UTF-8 bytes passes (two-byte letters), so bytes, not code units, are counted', () => {
    const v = `"${'\u00e9'.repeat(32767)}"`;
    expect(v.length).toBe(32769);
    expect(why(loose({ snapshot: [['pref:prefs', v]] }))).toBe('ok');
  });

  it('the snapshot: every allow-listed key may carry its cap at once, and a stored JSON null is a value', () => {
    const keys = [...PREF_KEYS.map((k) => `pref:${k}`), ...DOC_FIELDS.map((f) => `doc:${f}`)];
    const big = `"${'x'.repeat(BRIDGE_LIMITS.valueMaxBytes - 2)}"`;
    expect(why(loose({ snapshot: keys.map((k) => [k, big]) }))).toBe('ok');
    expect(why(loose({ snapshot: [['doc:pos', 'null']] }))).toBe('ok');
  });

  it('the snapshot total cannot bind today: the allow-list times valueMaxBytes is within storeBudgetBytes', () => {
    // Keys are unique and allow-listed, so a snapshot carries at most one value per key, each at most valueMaxBytes.
    // The total check in snapshotOk is therefore unreachable, an equivalent mutant (row L3.M4d in task-3.md); it stays
    // because Reference 3 states the 1 MiB total, and this row goes red the day the allow-list outgrows the budget.
    const keys = [...PREF_KEYS.map((k) => `pref:${k}`), ...DOC_FIELDS.map((f) => `doc:${f}`)];
    expect(keys).toHaveLength(8);
    expect(keys.length * BRIDGE_LIMITS.valueMaxBytes).toBeLessThanOrEqual(BRIDGE_LIMITS.storeBudgetBytes);
  });

  it('the front list counts code points: 300 astral letters (600 code units) in a list item pass', () => {
    expect(why(loose({ frontList: [{ key: astral(500), list: true, vals: [astral(300)] }] }))).toBe('ok');
    expect(why(loose({ frontList: [{ key: 'a', list: false, vals: [astral(500)] }] }))).toBe('ok');
  });

  it('initialHash: a footnote back-reference, D2.1a and 256 code units pass', () => {
    for (const h of ['fnref1:1', 'D2.1a', 'x'.repeat(256), 'heading-two']) expect(why(loose({ initialHash: h })), h).toBe('ok');
  });

  it('images: 512 pairs, a ref of 2048 code units and each image type pass', () => {
    expect(why(loose({ images: pairs(512, (i) => [`r${String(i)}`, PNG]) }))).toBe('ok');
    expect(why(loose({ images: [['r'.repeat(2048), PNG]] }))).toBe('ok');
    for (const t of IMAGE_TYPES) expect(why(loose({ images: [['a', `data:image/${t};base64,AAAA`]] })), t).toBe('ok');
    expect(why(loose({ images: [['a', 'data:image/svg+xml;base64,']] }))).toBe('ok');
  });

  it("images: an empty ref passes, as scanRefs lists one for `![a]()` (Reference 1 sets no lower bound)", () => {
    expect(scanRefs('![a]()').images).toEqual(['']);
    expect(why(loose({ images: [['', PNG]] }))).toBe('ok');
    expect(why(loose({ images: [['', PNG], ['', PNG]] }))).toBe('images');
  });

  it("images: their decoded bytes together are capped by the spec's image budget (5 MiB), not each image alone", () => {
    const B = SEED_LIMITS.imageBudgetBytes;
    // 5242880 bytes = 1747626 full groups of three, then two bytes: `AAA=`.
    const full = `data:image/png;base64,${'A'.repeat(4 * Math.floor(B / 3))}AAA=`;
    expect(Buffer.from(full.slice(full.indexOf(',') + 1), 'base64').length).toBe(B);
    expect(why(loose({ images: [['a', full]] }))).toBe('ok');
    expect(why(loose({ images: [['a', full], ['b', 'data:image/png;base64,AA==']] }))).toBe('images');
    expect(why(loose({ images: [['a', `${full.slice(0, -4)}AAAA`]] }))).toBe('images');
    // Split in two, the same bytes pass, and unpadded base64 counts its partial group.
    const half = `data:image/png;base64,${'A'.repeat((4 * Math.floor(B / 3)) / 2)}`;
    expect(why(loose({ images: [['a', half], ['b', `${half}AAA`]] }))).toBe('ok');
    expect(why(loose({ images: [['a', half], ['b', `${half}AAAA`]] }))).toBe('images');
  });

  it('features: every key the seed knows, filled, passes; ids may be false', () => {
    expect(why(loose({ features: maximalFeatures(1, () => 'w') }))).toBe('ok');
    expect(why(loose({ features: { vocabulary: { ids: false } } }))).toBe('ok');
  });

  it('mermaid: secure and draw alone pass; the caps at their maxima pass', () => {
    expect(why(loose({ mermaid: { secure: [], draw: 'auto' } }))).toBe('ok');
    expect(why(loose({ mermaid: { secure: ['securityLevel'], draw: 'on-request', maxTextSize: 1048576, maxEdges: 50000 } }))).toBe('ok');
  });

  it('lang: 64 code units pass', () => {
    const lang = `en${'-abcdefgh'.repeat(7)}`.slice(0, 64);
    expect(lang.length).toBe(64);
    expect(why(loose({ lang }))).toBe('ok');
  });
});

/** `features` with every key the seed knows, every flag false and every list `n` words, the i-th word `word(i)`. */
function maximalFeatures(n: number, word: (i: number) => string): Record<string, unknown> {
  const list = (): string[] => Array.from({ length: n }, (_, i) => word(i));
  const group = (keys: readonly string[]): Record<string, string[]> => Object.fromEntries(keys.map((k) => [k, list()]));
  const vocabulary: Record<string, unknown> = {};
  for (const [k, sub] of Object.entries(FEATURE_KEYS.groups)) vocabulary[k] = group(sub);
  for (const k of FEATURE_KEYS.grammars) vocabulary[k] = { prefixes: list() };
  for (const k of FEATURE_KEYS.lists) vocabulary[k] = list();
  const chrome = Object.fromEntries(FEATURE_KEYS.chrome.map((k) => [k, false]));
  return { ...Object.fromEntries(FEATURE_KEYS.flags.map((k) => [k, false])), chrome, vocabulary };
}

describe("the seed's copies of L2's and render()'s caps equal their originals", () => {
  it("SEED_LIMITS against L2's LIMITS and render()'s front-matter and image caps", () => {
    expect(SEED_LIMITS.commits).toBe(ENHANCE_LIMITS.commits);
    expect(SEED_LIMITS.subjectMaxCodeUnits).toBe(ENHANCE_LIMITS.subject);
    expect(SEED_LIMITS.dateMaxCodeUnits).toBe(ENHANCE_LIMITS.date);
    expect(SEED_LIMITS.parents).toBe(ENHANCE_LIMITS.parents);
    expect(SEED_LIMITS.maxTextSize).toBe(ENHANCE_LIMITS.maxTextSize);
    expect(SEED_LIMITS.maxEdges).toBe(ENHANCE_LIMITS.maxEdges);
    expect(SEED_LIMITS.secureKeys).toBe(ENHANCE_LIMITS.secure);
    expect(SEED_LIMITS.words).toBe(ENHANCE_LIMITS.words);
    expect(SEED_LIMITS.wordMaxCodeUnits).toBe(ENHANCE_LIMITS.word);
    expect(SEED_LIMITS.frontEntries).toBe(ENHANCE_LIMITS.frontList);
    expect(SEED_LIMITS.frontEntries).toBe(FM_MAX_KEYS);
    expect(SEED_LIMITS.frontItems).toBe(ENHANCE_LIMITS.frontVals);
    expect(SEED_LIMITS.frontItems).toBe(FM_LIST_MAX_ITEMS);
    expect(SEED_LIMITS.frontKeyMaxCodePoints).toBe(FM_MAX_VALUE);
    expect(SEED_LIMITS.frontValueMaxCodePoints).toBe(FM_MAX_VALUE);
    expect(SEED_LIMITS.frontItemMaxCodePoints).toBe(FM_LIST_MAX_ITEM);
    expect(SEED_LIMITS.images).toBe(DEFAULT_MAX_IMAGES);
    expect(SEED_LIMITS.docMaxBytes).toBe(2097152);
    expect(SEED_LIMITS.docMaxBytes).toBe(DOC_BYTES);
    expect(SEED_LIMITS.titleMaxCodeUnits).toBe(SEED_LIMITS.docMaxBytes);
    expect(SEED_LIMITS.imageBudgetBytes).toBe(5242880);
    expect(SEED_LIMITS.imageRefMaxCodeUnits).toBe(2048);
    expect(SEED_LIMITS.depth).toBe(32);
    expect(Object.isFrozen(SEED_LIMITS)).toBe(true);
  });

  /** An array literal's string members, from a `const NAME ... = [...]` declaration of options.ts. */
  const OPTIONS = readFileSync(path.join(ROOT, 'src', 'enhance', 'options.ts'), 'utf8');
  const listOf = (name: string): string[] => {
    const m = new RegExp(`const ${name}\\b[^=]*=\\s*\\[([^\\]]*)\\]`).exec(OPTIONS);
    if (m === null) throw new Error(`options.ts: no ${name}`);
    return [...(m[1] ?? '').matchAll(/'([^']*)'/g)].map((x) => x[1] ?? '');
  };

  it("FEATURE_KEYS equals the key lists L2's normalizeOptions reads (options.ts)", () => {
    expect([...FEATURE_KEYS.chrome]).toEqual(listOf('CHROME_KEYS'));
    expect([...FEATURE_KEYS.groups.status]).toEqual(listOf('STATUS_KEYS'));
    expect([...FEATURE_KEYS.groups.attention]).toEqual(listOf('ATTENTION_KEYS'));
    expect([...FEATURE_KEYS.groups.plan]).toEqual(listOf('PLAN_KEYS'));
    expect([...FEATURE_KEYS.lists]).toEqual(listOf('LIST_KEYS'));
    const vocabulary = [...Object.keys(FEATURE_KEYS.groups), ...FEATURE_KEYS.grammars, ...FEATURE_KEYS.lists].sort();
    expect(vocabulary).toEqual(listOf('VOCABULARY_KEYS').sort());
    const options = listOf('OPTION_KEYS');
    for (const k of [...FEATURE_KEYS.flags, 'chrome', 'vocabulary']) expect(options, k).toContain(k);
  });

  it("a maximal features value the seed accepts is accepted by L2's normalizeOptions too", () => {
    const f = maximalFeatures(SEED_LIMITS.words, (i) => `${'w'.repeat(SEED_LIMITS.wordMaxCodeUnits - 3)}${String(i).padStart(3, '0')}`);
    expect(why(loose({ features: f }))).toBe('ok');
    expect(() => normalizeOptions(f)).not.toThrow();
  });

  it("the secure key grammar equals L2's CONFIG_KEY", () => {
    const m = /const CONFIG_KEY = \/(.*)\/;/.exec(OPTIONS);
    expect(m?.[1]).toBe(SECURE_KEY_SOURCE);
  });

  it('the prefs are FRAME_PREF_VALUES, and the draw values are auto and on-request', () => {
    for (const [k, vals] of Object.entries(FRAME_PREF_VALUES)) {
      for (const v of vals) expect(why(loose({ prefs: { [k]: v } })), `${k}=${v}`).toBe('ok');
    }
    expect([...MERMAID_DRAW]).toEqual(['auto', 'on-request']);
  });
});

/** The html's escaped length as the seed text carries it, measured from serializeSeed alone (not escapedHtmlLength). */
function bodyLength(html: string): number {
  return serializeSeed({ ...base(), html }).length - serializeSeed({ ...base(), html: '' }).length;
}

/** r over a set of documents, measured here: the largest escaped-html length over markdown UTF-8 bytes. */
function measuredRatio(docs: readonly { id: string; markdown: string }[]): { r: number; id: string } {
  let best = { r: -1, id: '' };
  for (const d of docs) {
    const bytes = Buffer.byteLength(d.markdown, 'utf8');
    if (bytes === 0) continue;
    const out = render(d.markdown);
    expect(out.outcome, d.id).toBe('rendered');
    const r = bodyLength(out.html) / bytes;
    if (r > best.r) best = { r, id: d.id };
  }
  return best;
}

/** The golden corpus documents, read by loadCorpus(); FIXTURE_EXTRA is empty (a mutation row plants one). */
const FIXTURE_EXTRA: readonly { id: string; markdown: string }[] = [];
const goldens = (): { id: string; markdown: string }[] => [
  ...loadCorpus()
    .filter((c) => c.kind === 'golden')
    .map((c) => {
      expect(c.options, c.id).toEqual({});
      return { id: c.id, markdown: c.input };
    }),
  ...FIXTURE_EXTRA,
];

describe('L3.M20 SEED_HTML_MAX_CHARS: ceil(2097152 x r), r recomputed over the golden corpus', () => {
  it('equals Math.ceil(2097152 * r), and its comment names r to 4 decimals and the document', () => {
    const { r, id } = measuredRatio(goldens());
    expect(r).toBeGreaterThan(1);
    expect(SEED_HTML_MAX_CHARS).toBe(Math.ceil(2097152 * r));
    const src = readFileSync(path.join(ROOT, 'src', 'frame', 'seed.ts'), 'utf8');
    const at = src.indexOf('export const SEED_HTML_MAX_CHARS');
    const comment = src.slice(src.lastIndexOf('/**', at), at);
    expect(comment).toContain(`r = ${r.toFixed(4)}`);
    expect(comment).toContain(`${id}.md`);
    expect(comment).toContain(String(SEED_HTML_MAX_CHARS));
  });

  it("the script's measurement agrees: the same r, document and cap", () => {
    const ours = measuredRatio(goldens());
    const theirs = seedRatios(goldenDocuments(), render, escapedHtmlLength);
    expect(theirs[0]?.id).toBe(ours.id);
    expect(theirs[0]?.ratio).toBe(ours.r);
    expect(htmlCap(ours.r)).toBe(SEED_HTML_MAX_CHARS);
    for (let i = 1; i < theirs.length; i += 1) expect(theirs[i - 1]?.ratio ?? 0).toBeGreaterThanOrEqual(theirs[i]?.ratio ?? 0);
  });

  it('control: a fixture corpus holding a document of a higher ratio gives a larger cap', () => {
    const higher = { id: 'fixture-higher', markdown: '>'.repeat(30) + ' x' };
    const docs = [...goldens(), higher];
    const { r, id } = measuredRatio(docs);
    expect(id).toBe('fixture-higher');
    expect(Math.ceil(2097152 * r)).toBeGreaterThan(SEED_HTML_MAX_CHARS);
  });

  it('`node scripts/measure-seed-ratio.mjs --check` prints r, the document and the top three, and exits 0', () => {
    const { r, id } = measuredRatio(goldens());
    const run = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'measure-seed-ratio.mjs'), '--check'], { cwd: ROOT, encoding: 'utf8', timeout: 120_000 });
    expect(run.stderr).toBe('');
    expect(run.status).toBe(0);
    expect(run.stdout).toContain(`(${r.toFixed(4)}), measured on ${id}.md`);
    expect(run.stdout).toContain('top three:');
    expect(run.stdout.match(/^ {2}\d\. /gm)).toHaveLength(3);
    expect(run.stdout).toContain(`SEED_HTML_MAX_CHARS = ${String(SEED_HTML_MAX_CHARS)} (equal)`);
  }, 120_000);
});

describe('L3.M20 escapedHtmlLength: the html as the seed carries it', () => {
  it('equals the body of the html inside serializeSeed, for every corpus and hostile document', () => {
    let n = 0;
    for (const c of loadCorpus()) {
      const out = render(c.input, c.options);
      expect(escapedHtmlLength(out.html), c.id).toBe(bodyLength(out.html));
      n += 1;
    }
    expect(n).toBeGreaterThan(60);
  });

  it('counts each escape: `<`, `>`, `&`, U+2028, U+2029 and a lone surrogate six, a quote and a CR two', () => {
    for (const [s, n] of [['<', 6], ['>', 6], ['&', 6], ['\u2028', 6], ['\u2029', 6], ['\udc00', 6], ['"', 2], ['\r', 2], ['a', 1], ['\u{1D400}', 2], ['', 0]] as const) {
      expect(escapedHtmlLength(s), JSON.stringify(s)).toBe(n);
      expect(bodyLength(s), JSON.stringify(s)).toBe(n);
    }
  });
});

describe('L3.M20 IMAGE_BUDGET_CHARS and SEED_FIELDS_MAX_CHARS recompute from their formulas', () => {
  it('IMAGE_BUDGET_CHARS = 4 x ceil(5242880 / 3) + 512 x the longest data-URL prefix', () => {
    const prefix = Math.max(...['png', 'jpeg', 'gif', 'webp', 'avif', 'svg+xml'].map((t) => `data:image/${t};base64,`.length));
    expect(prefix).toBe('data:image/svg+xml;base64,'.length);
    expect(IMAGE_BUDGET_CHARS).toBe(4 * Math.ceil(5242880 / 3) + 512 * prefix);
    expect(IMAGE_BUDGET_CHARS).toBe(7003820);
  });

  /**
   * The largest seed the validator admits, html and image URLs aside: every field at its cap, every string of the
   * character JSON and the seed's escapes write longest (`<`, six characters), every boolean `false`, every choice its
   * longest value. The image URLs are empty bodies, so they hold only their prefixes, which IMAGE_BUDGET_CHARS counts.
   */
  function maximalSeed(): Seed {
    const L = SEED_LIMITS;
    const lt = (n: number): string => '<'.repeat(n);
    // 512 distinct refs of 2048 code units, each character one that escapes to six.
    const SIX = ['<', '>', '&', '\u2028', '\u2029', ...Array.from({ length: 32 }, (_, i) => String.fromCharCode(i)).filter((c) => !'\b\t\n\f\r'.includes(c))];
    expect(SIX.length * SIX.length).toBeGreaterThanOrEqual(L.images);
    const ref = (i: number): string => lt(L.imageRefMaxCodeUnits - 2) + (SIX[Math.floor(i / SIX.length)] ?? '') + (SIX[i % SIX.length] ?? '');
    const sha = 'f'.repeat(64);
    const longest = (vals: readonly string[]): string => vals.reduce((a, b) => (b.length > a.length ? b : a));
    const storeKeys = [...PREF_KEYS.map((k) => `pref:${k}`), ...DOC_FIELDS.map((f) => `doc:${f}`)];
    return {
      s: 1,
      nonce: NONCE,
      html: '',
      title: lt(L.titleMaxCodeUnits),
      frontList: Array.from({ length: L.frontEntries }, () => ({
        key: lt(L.frontKeyMaxCodePoints),
        list: true,
        vals: Array.from({ length: L.frontItems }, () => lt(L.frontItemMaxCodePoints)),
      })),
      version: {
        sha,
        draft: false,
        commits: Array.from({ length: L.commits }, () => ({
          sha,
          subject: lt(L.subjectMaxCodeUnits),
          date: lt(L.dateMaxCodeUnits),
          parents: Array.from({ length: L.parents }, () => sha),
        })),
        only: sha,
      },
      images: Array.from({ length: L.images }, (_, i) => [ref(i), 'data:image/svg+xml;base64,'] as const),
      initialHash: 'x'.repeat(256),
      lang: `ab${'-abcdefgh'.repeat(7)}`.slice(0, L.langMaxCodeUnits),
      prefs: Object.fromEntries(Object.entries(FRAME_PREF_VALUES).map(([k, v]) => [k, longest(v)])),
      snapshot: storeKeys.map((k) => [k, `"${lt(BRIDGE_LIMITS.valueMaxBytes - 2)}"`] as const) as Seed['snapshot'],
      // The validator keeps a repeated word (L2 drops it), so the longest list repeats the longest word.
      features: maximalFeatures(L.words, () => lt(L.wordMaxCodeUnits)) as Seed['features'],
      mermaid: { maxTextSize: L.maxTextSize, maxEdges: L.maxEdges, secure: Array.from({ length: L.secureKeys }, (_, i) => `k${'0'.repeat(L.secureKeyMaxCodeUnits - 4)}${String(i).padStart(3, '0')}`), draw: longest(MERMAID_DRAW) as 'auto' | 'on-request' },
      bridge: { links: false, hash: false, copy: false, changes: false, versions: false },
    };
  }

  it('a maximal seed passes the validator, and its length outside the html and the image URLs is SEED_FIELDS_MAX_CHARS less the padding slack', () => {
    const s = maximalSeed();
    expect(s.lang.length).toBe(SEED_LIMITS.langMaxCodeUnits);
    expect(why(s)).toBe('ok');
    const text = serializeSeed(s);
    const urls = s.images.reduce((n, [, u]) => n + u.length, 0);
    expect(s.features.vocabulary?.qualifiers).toHaveLength(SEED_LIMITS.words);
    // Base64 bodies padded one image at a time take at most 4 characters each beyond 4 x ceil(total / 3).
    const padding = 4 * (SEED_LIMITS.images - 1);
    expect(text.length - urls + padding).toBe(SEED_FIELDS_MAX_CHARS);
  });

  it("each string field's worst case is six characters per code point: no character escapes longer", () => {
    let worst = 0;
    for (let c = 0; c <= 0xffff; c += 1) worst = Math.max(worst, escapedHtmlLength(String.fromCharCode(c)));
    expect(worst).toBe(6);
    expect(escapedHtmlLength('\u{1F600}')).toBe(2);
  });
});
