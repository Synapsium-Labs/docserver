// frameDocument, the frame policy and the frame build (docserver L3 prototype; design §4, §5.3, §9 and §11; prototype
// brief rows U1 to U7). The assets are built in memory by scripts/build-frame.mjs, exactly as `npm run build:frame`
// writes them, and frameDocument verifies them against the committed src/frame/manifest.generated.ts; so a stale
// manifest is a red here before any browser runs.
//
// The corpus documents: a plain one (headings), one with external links and images (links-images), and one with
// `<details open>` and footnotes (details/main followed by footnotes, joined, since no single corpus file holds both).
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, type DefaultTreeAdapterMap } from 'parse5';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildFrame, byteRules, checkFrame, writeFrame, type BuiltFrame, type ByteRules } from '../scripts/build-frame.mjs';
import { BRIDGE_LIMITS, checkFrameCsp, frameCsp, FrameError, frameDocument, FRAME_MANIFEST, type FrameAssets, type RenderInput } from '../src/frame/index.js';
import { validateSeed } from '../src/frame/seed.js';
import { base64, cspHash, hex, hexToBase64, sha256Text } from '../src/frame/sha256.js';
import { render } from '../src/render/index.js';

type Node = DefaultTreeAdapterMap['node'];
type Element = DefaultTreeAdapterMap['element'];

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const corpus = (rel: string): string => readFileSync(path.join(ROOT, 'conformance', 'corpus', rel), 'utf8');

const NONCE = 'a'.repeat(32);

function input(markdown: string): RenderInput {
  const r = render(markdown);
  if (r.outcome !== 'rendered') throw new Error(`the corpus document did not render (${r.outcome})`);
  return { result: { outcome: r.outcome, html: r.html, meta: { title: r.meta.title, frontList: r.meta.frontList } } };
}

const DOCS: Readonly<Record<string, () => RenderInput>> = {
  plain: () => input(corpus('headings.md')),
  'links and images': () => input(corpus('links-images.md')),
  'details and footnotes': () => input(`${corpus('details/main.md')}\n\n${corpus('footnotes.md')}`),
};

let built: BuiltFrame;
let assets: FrameAssets;
let rules: ByteRules;

beforeAll(async () => {
  built = await buildFrame();
  rules = await byteRules();
  assets = { guard: built.files.guard.text, bootstrap: built.files.bootstrap.text, enhance: built.files.enhance.text, css: built.files.css.text };
}, 120_000);

const isElement = (n: Node): n is Element => 'tagName' in n;
const attr = (e: Element, name: string): string | null => e.attrs.find((a) => a.name === name)?.value ?? null;
const textOf = (e: Element): string => e.childNodes.map((c) => ('value' in c && c.nodeName === '#text' ? c.value : '')).join('');

function tree(srcdoc: string): { head: Element; body: Element; all: Element[] } {
  const doc = parse(srcdoc);
  const html = doc.childNodes.find(isElement);
  if (html === undefined) throw new Error('no html element');
  const [head, body] = html.childNodes.filter(isElement);
  if (head === undefined || body === undefined) throw new Error('no head or body');
  const all: Element[] = [];
  const walk = (n: Node): void => {
    if (isElement(n)) all.push(n);
    if ('childNodes' in n) for (const c of n.childNodes) walk(c);
  };
  walk(doc);
  return { head, body, all };
}

const frame = (r: RenderInput, over: Partial<Parameters<typeof frameDocument>[1]> = {}): string =>
  frameDocument(r, { csp: frameCsp(), nonce: NONCE, assets, ...over });

function refusal(fn: () => unknown): string {
  try {
    fn();
  } catch (e) {
    if (e instanceof FrameError) return e.code;
    throw e;
  }
  return 'no refusal';
}

describe('U1 skeleton', () => {
  for (const [name, doc] of Object.entries(DOCS)) {
    it(`${name}: the CSP meta first, then guard, seed, bootstrap, style and enhance in the head; an empty body`, () => {
      const out = frame(doc());
      expect(out.startsWith('<meta http-equiv="Content-Security-Policy" content="')).toBe(true);
      const { head, body } = tree(out);
      expect(head.childNodes.every(isElement)).toBe(true); // no text or comment node between any two elements
      const shape = head.childNodes.filter(isElement).map((e) => (attr(e, 'type') === null ? e.tagName : `${e.tagName}[type=${String(attr(e, 'type'))}]`));
      expect(shape).toEqual(['meta', 'script', 'script[type=application/json]', 'script', 'style', 'script']);
      const kids = head.childNodes.filter(isElement);
      const seedAt = kids.findIndex((e) => attr(e, 'type') === 'application/json');
      expect(kids[seedAt + 1]?.tagName).toBe('script'); // the seed is the bootstrap's previous element sibling
      expect(textOf(kids[seedAt + 1] as Element)).toBe(assets.bootstrap);
      expect(textOf(kids[1] as Element)).toBe(assets.guard);
      expect(body.childNodes.filter(isElement)).toEqual([]);
    });
  }
});

describe('U2 no URL and no authored markup', () => {
  for (const [name, doc] of Object.entries(DOCS)) {
    it(`${name}: with script and style bodies removed, no src, href, srcset, link, base or @import`, () => {
      const out = frame(doc());
      const bare = out.replace(/<script\b([^>]*)>[\s\S]*?<\/script>/g, '<script$1></script>').replace(/<style>[\s\S]*?<\/style>/g, '<style></style>');
      for (const needle of ['src=', 'href=', 'srcset=', '<link', '<base', '@import']) expect(bare).not.toContain(needle);
      const style = /<style>([\s\S]*?)<\/style>/.exec(out)?.[1] ?? '';
      const urls = style.match(/url\(/g) ?? [];
      expect(urls.length).toBeGreaterThan(0);
      expect(style.match(/url\(data:font\/woff2;base64,/g)?.length).toBe(urls.length);
    });
  }
});

describe('U3 seed escaping', () => {
  const hostile = '</script><script>x()</script> <!--<script> --> a && b \u2028 \u2029 \r\n';
  const r: RenderInput = { result: { outcome: 'rendered', html: `<p>${hostile}</p>`, meta: { title: hostile, frontList: null } } };

  it('the seed text holds no "<", parses back to the input, and the tree has exactly 4 scripts', () => {
    const out = frame(r);
    const { all } = tree(out);
    const scripts = all.filter((e) => e.tagName === 'script');
    expect(scripts).toHaveLength(4);
    const seed = scripts.find((e) => attr(e, 'type') === 'application/json');
    if (seed === undefined) throw new Error('no seed');
    const text = textOf(seed);
    expect(text).not.toContain('<');
    expect(text).not.toMatch(/[>&]/); // '>' and '&' are written as backslash-u escapes too
    const parsed = JSON.parse(text) as Record<string, unknown>;
    expect(parsed['html']).toBe(r.result.html);
    expect(parsed['title']).toBe(hostile);
    expect(parsed['nonce']).toBe(NONCE);
    expect(text).not.toMatch(/[\u2028\u2029]/);
  });
});

describe('U4 verification', () => {
  const r = (): RenderInput => DOCS['plain']?.() as RenderInput;
  const flip = (s: string, at: number): string => s.slice(0, at) + (s[at] === 'a' ? 'b' : 'a') + s.slice(at + 1);

  it('a flipped byte in assets.enhance: asset-mismatch', () => {
    expect(refusal(() => frame(r(), { assets: { ...assets, enhance: flip(assets.enhance, 100) } }))).toBe('asset-mismatch');
  });
  it('the enhance hash removed from the policy: csp', () => {
    expect(refusal(() => frame(r(), { csp: frameCsp().replace(` ${FRAME_MANIFEST.enhance.csp}`, '') }))).toBe('csp');
  });
  it('connect-src * added: csp', () => {
    expect(refusal(() => frame(r(), { csp: `${frameCsp()}; connect-src *` }))).toBe('csp');
  });
  it("'unsafe-eval' added: csp", () => {
    expect(refusal(() => frame(r(), { csp: frameCsp().replace('script-src ', "script-src 'unsafe-eval' ") }))).toBe('csp');
  });
  it('a nonce of 32 upper-case characters: nonce', () => {
    expect(refusal(() => frame(r(), { nonce: 'A'.repeat(32) }))).toBe('nonce');
  });
  it('a nonce of 31 characters: nonce', () => {
    expect(refusal(() => frame(r(), { nonce: 'a'.repeat(31) }))).toBe('nonce');
  });
  it("outcome 'over-limit': not-rendered", () => {
    const d = r();
    expect(refusal(() => frame({ ...d, result: { ...d.result, outcome: 'over-limit' } }))).toBe('not-rendered');
  });
  it('the canonical policy passes checkFrameCsp with every script hash', () => {
    expect(checkFrameCsp(frameCsp(), [FRAME_MANIFEST.guard.csp, FRAME_MANIFEST.bootstrap.csp, FRAME_MANIFEST.enhance.csp])).toEqual({ ok: true });
  });
});

describe('U4 policy refusals: each rule of checkFrameCsp refuses on its own', () => {
  const r = (): RenderInput => DOCS['plain']?.() as RenderInput;
  const REQUIRED = [FRAME_MANIFEST.guard.csp, FRAME_MANIFEST.bootstrap.csp, FRAME_MANIFEST.enhance.csp];
  const good = frameCsp();
  const swap = (from: string, to: string): string => {
    expect(good).toContain(from);
    return good.replace(from, to);
  };
  const UNKNOWN = `'sha256-${'A'.repeat(43)}='`;
  // Each policy breaks exactly one rule; `why` names the rule that refused it, so a deleted rule cannot hide behind
  // another one.
  const CASES: readonly (readonly [string, () => string, string])[] = [
    ['img-src https:', () => swap('img-src data:', 'img-src https:'), 'img-src'],
    ['font-src *', () => swap('font-src data:', 'font-src *'), 'font-src'],
    ['style-src https:', () => swap("style-src 'unsafe-inline' data:", 'style-src https:'), 'style-src'],
    ["default-src 'self'", () => swap("default-src 'none'", "default-src 'self'"), "default-src must be 'none'"],
    ['base-uri missing', () => swap("; base-uri 'none'", ''), "base-uri must be 'none'"],
    ['form-action missing', () => swap("; form-action 'none'", ''), "form-action must be 'none'"],
    ['a duplicate script-src', () => `${good}; script-src ${FRAME_MANIFEST.guard.csp}`, 'duplicate script-src'],
    ['an unknown hash of the right form', () => swap('script-src ', `script-src ${UNKNOWN} `), `unknown hash ${UNKNOWN}`],
    ['a double quote in a value', () => swap('img-src data:', 'img-src data:"'), 'a character outside printable ASCII, or one of "<>&'],
    ['a character outside printable ASCII', () => swap('img-src data:', 'img-src data:\u00e9'), 'a character outside printable ASCII, or one of "<>&'],
    ['over 4096 characters (trailing spaces only)', () => `${good}${' '.repeat(4097 - good.length)}`, 'not a policy'],
  ];
  for (const [name, policy, why] of CASES) {
    it(`${name}: refused by its own rule, and frameDocument throws csp`, () => {
      expect(checkFrameCsp(policy(), REQUIRED)).toEqual({ ok: false, why });
      expect(refusal(() => frame(r(), { csp: policy() }))).toBe('csp');
    });
  }
  it('the 4096-character bound is inclusive: the same padding to exactly 4096 passes', () => {
    expect(checkFrameCsp(`${good}${' '.repeat(4096 - good.length)}`, REQUIRED)).toEqual({ ok: true });
  });
});

describe('U4 initialHash: outside its bounds it is seeded as null, never refused (ruling R1)', () => {
  const seedOf = (out: string): Record<string, unknown> => {
    const kids = tree(out).head.childNodes.filter(isElement);
    return JSON.parse(textOf(kids[2] as Element)) as Record<string, unknown>;
  };
  const r = (h: unknown): RenderInput => ({ ...(DOCS['plain']?.() as RenderInput), initialHash: h as string });

  it('300 code units, the empty string and a non-string give a seed with initialHash null', () => {
    for (const h of ['x'.repeat(300), '', 42]) {
      expect(refusal(() => frame(r(h)))).toBe('no refusal');
      expect(seedOf(frame(r(h)))['initialHash']).toBeNull();
    }
  });
  it('an id of 1 and of 256 code units is seeded as given', () => {
    for (const h of ['a', 'x'.repeat(256), 'D2.1a']) expect(seedOf(frame(r(h)))['initialHash']).toBe(h);
  });
});

describe('U8 the seed validator (the bootstrap fails closed on each)', () => {
  const NONCE_OK = 'b'.repeat(32);
  const valid = (): Record<string, unknown> => ({ s: 1, nonce: NONCE_OK, html: '<p>x</p>', title: null, lang: 'en', initialHash: null, prefs: {}, mermaid: null });
  const parsed = (over: string): unknown => JSON.parse(JSON.stringify(valid()).replace(/}$/, `,${over}}`).replace('{,', '{'));

  it('a valid seed passes', () => {
    expect(validateSeed(valid())).toMatchObject({ ok: true, seed: valid() });
  });
  it('an extra key: refused, with the nonce kept so the frame can report', () => {
    expect(validateSeed({ ...valid(), extra: 1 })).toEqual({ ok: false, nonce: NONCE_OK, why: 'keys' });
  });
  it('a missing key: refused', () => {
    const v = valid();
    delete v['title'];
    expect(validateSeed(v)).toEqual({ ok: false, nonce: NONCE_OK, why: 'keys' });
  });
  it('__proto__ nested in prefs (as JSON.parse makes it, an own key): refused', () => {
    const v = JSON.parse(`{"s":1,"nonce":"${NONCE_OK}","html":"","title":null,"lang":"en","initialHash":null,"prefs":{"__proto__":{"x":1}},"mermaid":null}`) as unknown;
    expect(validateSeed(v)).toEqual({ ok: false, nonce: NONCE_OK, why: 'a proto key or a non-plain object' });
  });
  it('constructor as a top-level key: refused', () => {
    expect(validateSeed(parsed('"constructor":1'))).toMatchObject({ ok: false, nonce: NONCE_OK });
  });
  it('a bad nonce: refused with nonce null (the frame stays silent)', () => {
    for (const n of ['B'.repeat(32), 'b'.repeat(31), 7, undefined]) expect(validateSeed({ ...valid(), nonce: n })).toEqual({ ok: false, nonce: null, why: 'nonce' });
  });
  it('not a plain object: refused with nonce null', () => {
    for (const v of [null, [], 'x', Object.assign(Object.create({ inherited: 1 }) as object, valid())]) expect(validateSeed(v)).toMatchObject({ ok: false, nonce: null });
  });
  it('a bad schema, html, title, lang or initialHash: refused by name', () => {
    expect(validateSeed({ ...valid(), s: 2 })).toMatchObject({ ok: false, why: 'schema' });
    expect(validateSeed({ ...valid(), html: 1 })).toMatchObject({ ok: false, why: 'html' });
    expect(validateSeed({ ...valid(), title: 1 })).toMatchObject({ ok: false, why: 'title' });
    expect(validateSeed({ ...valid(), lang: 'e' })).toMatchObject({ ok: false, why: 'lang' });
    expect(validateSeed({ ...valid(), lang: 'en_GB' })).toMatchObject({ ok: false, why: 'lang' });
    expect(validateSeed({ ...valid(), initialHash: '' })).toMatchObject({ ok: false, why: 'initialHash' });
    expect(validateSeed({ ...valid(), initialHash: 'x'.repeat(257) })).toMatchObject({ ok: false, why: 'initialHash' });
  });
  it('bad prefs: refused by key', () => {
    expect(validateSeed({ ...valid(), prefs: { theme: 'neon' } })).toMatchObject({ ok: false, why: 'prefs.theme' });
    expect(validateSeed({ ...valid(), prefs: { lens: 'product' } })).toMatchObject({ ok: false, why: 'prefs.lens' });
    expect(validateSeed({ ...valid(), prefs: [] })).toMatchObject({ ok: false, why: 'prefs' });
  });
  it('a bad mermaid cap: refused by key', () => {
    expect(validateSeed({ ...valid(), mermaid: { maxEdges: 0 } })).toMatchObject({ ok: false, why: 'mermaid.maxEdges' });
    expect(validateSeed({ ...valid(), mermaid: { maxTextSize: 1.5 } })).toMatchObject({ ok: false, why: 'mermaid.maxTextSize' });
    expect(validateSeed({ ...valid(), mermaid: { secure: 1 } })).toMatchObject({ ok: false, why: 'mermaid.secure' });
    expect(validateSeed({ ...valid(), mermaid: { maxEdges: 10 } })).toMatchObject({ ok: true });
  });
});

describe('U9 BRIDGE_LIMITS: exactly design §3 (ruling R5)', () => {
  it('the parent reads its limits as token buckets, and the frame paces by a sliding window that neither reading refuses', () => {
    expect(BRIDGE_LIMITS).toEqual({
      bucketCapacity: 40,
      bucketRefillPerSecond: 20,
      storeSetBucketCapacity: 10,
      storeSetRefillPerSecond: 10,
      changesInFlight: 1,
      coalesceMs: 250,
      refusalsToClose: 16,
      valueMaxBytes: 65536,
      copyMaxBytes: 65536,
      hashMaxCodeUnits: 256,
      hrefMaxChars: 4096,
      storeBudgetBytes: 1048576,
      changesTimeoutMs: 30000,
      frameWindowMs: 1000,
      frameMaxPerWindow: 16,
      frameStoreSetMaxPerWindow: 8,
      frameCopyMaxPerWindow: 4,
      frameChangesTimeoutMs: 35000,
    });
    expect(Object.isFrozen(BRIDGE_LIMITS)).toBe(true);
  });
  it('the frame window fits under the strict reading of both parent limits, and the frame outlasts the parent on changes', () => {
    const L = BRIDGE_LIMITS;
    expect(L.frameWindowMs).toBe(1000);
    expect(L.frameMaxPerWindow).toBeLessThanOrEqual(Math.min(L.bucketCapacity, L.bucketRefillPerSecond));
    expect(L.frameStoreSetMaxPerWindow).toBeLessThanOrEqual(Math.min(L.storeSetBucketCapacity, L.storeSetRefillPerSecond));
    expect(L.frameCopyMaxPerWindow).toBeLessThanOrEqual(L.frameMaxPerWindow);
    expect(L.frameChangesTimeoutMs).toBeGreaterThan(L.changesTimeoutMs);
  });
});

describe('U5 byte rules', () => {
  it('refuses </SCRIPT, a CR, a NUL and a BOM in a script', () => {
    expect(rules.scriptHazards('var a = "</SCRIPT>";')).not.toEqual([]);
    expect(rules.scriptHazards('var a = 1;\r\nvar b = 2;')).not.toEqual([]);
    expect(rules.scriptHazards('var a = "\0";')).not.toEqual([]);
    expect(rules.scriptHazards('\uFEFFvar a = 1;')).not.toEqual([]);
  });
  it('accepts non-ASCII inside a regex literal', () => {
    expect(rules.scriptHazards('var r = /[\u00ee\u00ef]/;')).toEqual([]);
  });
});

describe('U6 hash agreement', () => {
  const json = (): { files: { path: string; sha256: string; csp?: string }[] } =>
    JSON.parse(readFileSync(path.join(ROOT, 'assets', 'assets.json'), 'utf8')) as { files: { path: string; sha256: string; csp?: string }[] };

  for (const name of ['guard', 'bootstrap', 'enhance'] as const) {
    it(`${name}: frameCsp's hash, assets.json's sha256 and the hash of the element text in the srcdoc agree`, () => {
      const policy = frameCsp();
      const entry = json().files.find((f) => f.path === FRAME_MANIFEST[name].path);
      if (entry === undefined) throw new Error(`assets.json does not list ${name}`);
      const fromJson = `'sha256-${hexToBase64(entry.sha256)}'`;
      const out = frame(DOCS['plain']?.() as RenderInput);
      const kids = tree(out).head.childNodes.filter(isElement);
      const at = { guard: 1, bootstrap: 3, enhance: 5 }[name];
      const fromText = `'sha256-${base64(sha256Text(textOf(kids[at] as Element)))}'`;
      expect(policy).toContain(fromJson);
      expect(fromText).toBe(fromJson);
      expect(entry.csp).toBe(fromJson);
      expect(cspHash(assets[name])).toBe(fromJson);
    });
  }

  it('the pure SHA-256 agrees with the build (node:crypto) on every asset', () => {
    for (const name of ['guard', 'bootstrap', 'enhance', 'css'] as const) expect(hex(sha256Text(assets[name]))).toBe(built.files[name].sha256);
  });
});

describe('U7 reproducibility', () => {
  it('two in-memory builds give byte-identical outputs', async () => {
    const again = await buildFrame();
    for (const name of ['guard', 'bootstrap', 'enhance', 'css'] as const) expect(again.files[name].text).toBe(built.files[name].text);
    expect(again.assetsJson).toBe(built.assetsJson);
    expect(again.manifestTs).toBe(built.manifestTs);
  }, 120_000);

  it('the committed manifests equal a fresh build (read from a directory holding only the two committed files)', () => {
    // Only the committed files: the git-ignored local build outputs (assets/frame/*, the Mermaid frame file) may be stale
    // after a branch switch, and CI has none of them, so they must not decide this row.
    const dir = mkdtempSync(path.join(tmpdir(), 'build-frame-committed-'));
    try {
      for (const rel of ['assets/assets.json', 'src/frame/manifest.generated.ts']) {
        mkdirSync(path.join(dir, path.dirname(rel)), { recursive: true });
        copyFileSync(path.join(ROOT, rel), path.join(dir, rel));
      }
      expect(checkFrame(built, dir)).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('--check exits 0 on a tree the build just wrote, and 1 once a byte of it changes', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'build-frame-'));
    try {
      writeFrame(built, dir);
      const run = (): number => spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'build-frame.mjs'), '--check', '--out', dir], { encoding: 'utf8' }).status ?? -1;
      expect(run()).toBe(0);
      const at = path.join(dir, 'assets', 'assets.json');
      writeFrame({ ...built, assetsJson: built.assetsJson.replace('"manifest": 1', '"manifest": 2') }, dir);
      expect(readFileSync(at, 'utf8')).toContain('"manifest": 2');
      expect(run()).toBe(1);
      // A frame file that is present and differs is a difference too, with the committed files back in place.
      writeFrame(built, dir);
      expect(run()).toBe(0);
      const guard = path.join(dir, 'assets', 'frame', 'guard.js');
      const g = readFileSync(guard, 'utf8');
      writeFileSync(guard, `${g.slice(0, 40)}${g[40] === 'a' ? 'b' : 'a'}${g.slice(41)}`);
      expect(run()).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 120_000);
});

describe('P7 (stretch) Mermaid in the skeleton', () => {
  const r = (): RenderInput => DOCS['plain']?.() as RenderInput;

  it('mermaid on: the Mermaid script follows enhance, and the seed carries the caps', () => {
    const out = frame(r(), { assets: { ...assets, mermaid: built.files.mermaid.text }, mermaid: { maxEdges: 500 } });
    const kids = tree(out).head.childNodes.filter(isElement);
    expect(kids.map((e) => e.tagName)).toEqual(['meta', 'script', 'script', 'script', 'style', 'script', 'script']);
    expect(textOf(kids[6] as Element)).toBe(built.files.mermaid.text);
    expect((JSON.parse(textOf(kids[2] as Element)) as { mermaid: unknown }).mermaid).toEqual({ maxEdges: 500 });
  });
  it('mermaid off (null or absent): no Mermaid script, and the seed says null', () => {
    for (const out of [frame(r()), frame(r(), { mermaid: null, assets: { ...assets, mermaid: built.files.mermaid.text } })]) {
      const kids = tree(out).head.childNodes.filter(isElement);
      expect(kids).toHaveLength(6);
      expect((JSON.parse(textOf(kids[2] as Element)) as { mermaid: unknown }).mermaid).toBeNull();
    }
  });
  it('mermaid on without assets.mermaid: missing-asset; with a flipped byte: asset-mismatch', () => {
    expect(refusal(() => frame(r(), { mermaid: {} }))).toBe('missing-asset');
    const m = built.files.mermaid.text;
    expect(refusal(() => frame(r(), { mermaid: {}, assets: { ...assets, mermaid: `${m.slice(0, 10)}~${m.slice(11)}` } }))).toBe('asset-mismatch');
  });
  it('the Mermaid frame file passes the byte rules and carries no ELK and no free require', () => {
    const m = built.files.mermaid.text;
    expect(rules.scriptHazards(m)).toEqual([]);
    expect(m).not.toContain('org.eclipse.elk');
    expect(m).not.toMatch(/\(void 0\)\(/);
    expect(frameCsp()).toContain(FRAME_MANIFEST.mermaid.csp);
  });
});
