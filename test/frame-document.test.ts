// frameDocument, the frame policy and the frame build (docserver L3, Task 7; plan Reference §1 to §4,
// §9 and §10; rows L3.M1 to L3.M3, L3.M5 to L3.M9, L3.M13 to L3.M15; the prototype's rows U1 to U7 and P7, renamed).
// The Mermaid gate's rows and the purity walls, which need no build, are test/frame-pure.test.ts's.
// The assets are built in memory by scripts/build-frame.mjs, exactly as `npm run build:frame` writes them, and
// frameDocument verifies them against the committed src/frame/manifest.generated.ts; so a stale manifest is a red here
// before any browser runs.
//
// The scans of the srcdoc's prefix, its URLs and its seed are test/frame-scans.ts's, shared with
// test/frame-mutants.test.ts; here they run on real output, and the committed clean mutant template is checked against
// a fresh output (UPDATE_FRAME_MUTANTS=1, exactly, rewrites it).
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { build, buildSync, stop } from 'esbuild';
import ts from 'typescript';
import { beforeAll, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { buildFrame, byteRules, checkFrame, scriptOptions, writeFrame, type BuiltFrame, type ByteRules } from '../scripts/build-frame.mjs';
import { loadCorpus } from '../src/conformance/index.js';
import { APPEARANCE_SLOTS, parseAppearance } from '../src/enhance/appearance.js';
import { MAX_EDGES, MAX_TEXT_SIZE } from '../src/enhance/diagrams.js';
import {
  checkFrameCsp,
  frameCsp,
  FrameError,
  frameDocument,
  FRAME_MANIFEST,
  MAX_SRCDOC_CHARS_DEFAULT,
  MERMAID_LIMIT_CEILINGS,
  SEED_HTML_MAX_CHARS,
  type BridgeStoreKey,
  type CspRefusal,
  type ErrorWhy,
  type FrameAssets,
  type FrameErrorCode,
  type FrameFeatures,
  type FrameOptions,
  type FramePrefs,
  type FrameToParent,
  type ParentToFrame,
  type RenderInput,
} from '../src/frame/index.js';
import { CSP_MAX_CHARS } from '../src/frame/csp-rules.js';
import { HOST_VALUES_MAX } from '../src/frame/document.js';
import { escapedHtmlLength, FEATURE_KEYS, IMAGE_BUDGET_CHARS, OPTIONAL_SEED_KEYS, SEED_FIELDS_MAX_CHARS, SEED_KEYS, SEED_LIMITS, validateSeed } from '../src/frame/seed.js';
import { base64, cspHash, hex, hexToBase64, sha256Text } from '../src/frame/sha256.js';
import { render } from '../src/render/index.js';
import { ASSET_CHARS_1_1_0, ASSET_CHARS_NOW, oldCapDocument, oldDefaultCap } from './frame-old-cap.js';
import {
  attr,
  expand,
  FIXTURE_MARKDOWN,
  FIXTURE_NONCE,
  isElement,
  META_PREFIX,
  MUTANTS,
  scanPrefix,
  SCANS,
  scanSeed,
  scanUrls,
  templateOf,
  textOf,
  tree,
  updateRequested,
  type Element,
  type PlaceholderName,
} from './frame-scans.js';

// escapedHtmlLength, wrapped to record the length of each html it measures; it answers as the real one does.
const measured = vi.hoisted(() => ({ calls: [] as number[] }));
vi.mock('../src/frame/seed.js', async (importOriginal) => {
  const real = await importOriginal<typeof import('../src/frame/seed.js')>();
  return {
    ...real,
    escapedHtmlLength: (html: string): number => {
      measured.calls.push(html.length);
      return real.escapedHtmlLength(html);
    },
  };
});

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const corpus = (rel: string): string => readFileSync(path.join(ROOT, 'conformance', 'corpus', rel), 'utf8');

const NONCE = 'a'.repeat(32);
const SHA40 = '0123456789abcdef0123456789abcdef01234567';
const SHA64 = 'f'.repeat(64);
const PNG = 'data:image/png;base64,iVBORw0KGgo=';

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
const plain = (): RenderInput => DOCS['plain']?.() as RenderInput;
/** The 33 colour slot names, as a mutable list. */
const COLOUR_SLOTS: readonly string[] = APPEARANCE_SLOTS.colour;

/** The longest appearance parseAppearance accepts, as the seed writes it (`<` escaped): three maximal shadows, every slot, a 64-character label. */
const MAXIMAL_APPEARANCE_TEXT = (): string => {
  const shadow = '-64px -64px 64px -8px rgba(255, 255, 255, 0.999)';
  const colour = Object.fromEntries(COLOUR_SLOTS.map((k) => [k, '#ABCDEF']));
  const skin = { radius: '24px', radiusSmall: '24px', radiusLarge: '24px', controlRow: '56px', popShadow: [shadow, shadow, shadow].join(', '), sectionFamily: 'mono', sectionSize: '16px', sectionWeight: '900', sectionTracking: '-0.100em', sectionCase: 'uppercase' };
  return JSON.stringify({ mode: 'light', colour, skin, label: '<'.repeat(64) }).replace(/</g, '\\u003c');
};
/** The keys every seed carries: SEED_KEYS less the optional ones (a mount with no appearance and no faces writes none). */
const REQUIRED_SEED_KEYS = SEED_KEYS.filter((k) => !OPTIONAL_SEED_KEYS.includes(k));

let built: BuiltFrame;
let assets: FrameAssets;
let mermaidText: string;
let rules: ByteRules;

beforeAll(async () => {
  built = await buildFrame();
  rules = await byteRules();
  assets = { guard: built.files.guard.text, bootstrap: built.files.bootstrap.text, enhance: built.files.enhance.text, css: built.files.css.text };
  mermaidText = built.files.mermaid.text;
  // The build's esbuild service keeps the memory of the Mermaid bundle (about half a GiB) until it stops; a later call
  // starts it again.
  await stop();
}, 300_000);

const frame = (r: RenderInput, over: Partial<FrameOptions> = {}): string => frameDocument(r, { csp: frameCsp(), nonce: NONCE, assets, ...over });
const withMermaid = (): FrameAssets => ({ ...assets, mermaid: mermaidText });

/** The FrameError code `fn` throws, 'no refusal', or the name of any other error (so a crash is an assertion, not a throw). */
function refusal(fn: () => unknown): string {
  try {
    fn();
  } catch (e) {
    if (e instanceof FrameError) return e.code;
    return `not a FrameError: ${e instanceof Error ? e.name : String(e)}`;
  }
  return 'no refusal';
}

const seedOf = (out: string): Record<string, unknown> => {
  const kids = tree(out).head.childNodes.filter(isElement);
  return JSON.parse(textOf(kids[2] as Element)) as Record<string, unknown>;
};

/** The seed text of a srcdoc, read by its position, without a parse of the whole string. */
function seedText(out: string): string {
  const open = '<script type="application/json">';
  const at = out.indexOf(open);
  return out.slice(at + open.length, out.indexOf('</script>', at));
}

describe("./frame's entry: Reference §1's full export list", () => {
  it('exports exactly these values', async () => {
    const entry = (await import('../src/frame/index.js')) as Record<string, unknown>;
    expect(Object.keys(entry).sort()).toEqual(
      [
        'ANCHOR_LIMITS',
        'APPEARANCE_CONTRACT',
        'APPEARANCE_LABEL_DEFAULT',
        'APPEARANCE_PAIRS',
        'APPEARANCE_SLOTS',
        'BRIDGE_LIMITS',
        'BRIDGE_PROTOCOL',
        'CSP_REFUSALS',
        'DOC_FIELDS',
        'ERROR_WHY',
        'FRAGMENT_ID_GRAMMAR',
        'FRAME_ACCEPTS',
        'FRAME_MANIFEST',
        'FrameError',
        'MAX_SRCDOC_CHARS_DEFAULT',
        'MERMAID_GATE_DEFAULTS',
        'MERMAID_HOSTED_KINDS',
        'MERMAID_LIMIT_CEILINGS',
        'OP_KEYS',
        'PLACE_KINDS',
        'PREF_KEYS',
        'SEED_HTML_MAX_CHARS',
        'SEED_SCHEMA',
        'checkFrameCsp',
        'frameCsp',
        'frameDocument',
        'isAnchorToken',
        'isFragmentId',
        'mermaidGate',
        'mermaidThemeOf',
        'parseAppearance',
        'pngBytesOfBase64',
      ].sort(),
    );
  });

  it('exports the types a host names (checked by the typecheck)', () => {
    expectTypeOf<FrameErrorCode>().toEqualTypeOf<'not-rendered' | 'invalid-input' | 'nonce' | 'asset-mismatch' | 'unsafe-asset' | 'csp' | 'missing-asset' | 'too-large'>();
    expectTypeOf<FramePrefs>().toEqualTypeOf<{ theme: 'auto' | 'light' | 'dark'; width: 'standard' | 'wide'; font: 'serif' | 'sans' }>();
    expectTypeOf<NonNullable<FrameOptions['mermaid']>['draw']>().toEqualTypeOf<'auto' | 'on-request' | 'after-ready' | undefined>();
    expectTypeOf<FrameOptions['prefs']>().toEqualTypeOf<Partial<FramePrefs> | undefined>();
    expectTypeOf<FrameOptions['features']>().toEqualTypeOf<FrameFeatures | undefined>();
    expectTypeOf<keyof NonNullable<FrameOptions['snapshot']>>().toEqualTypeOf<BridgeStoreKey>();
    expectTypeOf<NonNullable<RenderInput['scan']>['mermaid']>().toEqualTypeOf<{
      readonly fences: number;
      readonly largestBytes: number;
      readonly totalBytes: number;
      readonly largestChars: number;
      readonly totalChars: number;
    }>();
    expectTypeOf<CspRefusal>().toEqualTypeOf<'type' | 'length' | 'character' | 'directive' | 'duplicate' | 'default-src' | 'script-src' | 'style-src' | 'font-src' | 'img-src' | 'base-uri' | 'form-action' | 'missing-hash' | 'unknown-hash'>();
    expectTypeOf<ErrorWhy>().toEqualTypeOf<'boot' | 'render' | 'mermaid' | 'assets' | 'protocol'>();
    expectTypeOf<Extract<FrameToParent, { t: 'ready' }>>().toEqualTypeOf<{ t: 'ready'; v: 1; nonce: string }>();
    expectTypeOf<Extract<ParentToFrame, { t: 'hello' }>>().toEqualTypeOf<{ t: 'hello'; v: number }>();
  });
});

describe('L3.M1 skeleton', () => {
  for (const [name, doc] of Object.entries(DOCS)) {
    it(`${name}: the CSP meta first, then guard, seed, bootstrap, style and enhance in the head; an empty body`, () => {
      const out = frame(doc());
      expect(out.startsWith(META_PREFIX)).toBe(true);
      expect(scanPrefix(out)).toEqual([]);
      const { head, body } = tree(out);
      expect(head.childNodes.every(isElement)).toBe(true); // no text or comment node between any two elements
      const shape = head.childNodes.filter(isElement).map((e) => (attr(e, 'type') === null ? e.tagName : `${e.tagName}[type=${String(attr(e, 'type'))}]`));
      expect(shape).toEqual(['meta', 'script', 'script[type=application/json]', 'script', 'style', 'script']);
      const kids = head.childNodes.filter(isElement);
      const seedAt = kids.findIndex((e) => attr(e, 'type') === 'application/json');
      expect(kids[seedAt + 1]?.tagName).toBe('script'); // the seed is the bootstrap's previous element sibling
      expect(textOf(kids[seedAt + 1] as Element)).toBe(assets.bootstrap);
      expect(textOf(kids[1] as Element)).toBe(assets.guard);
      expect(textOf(kids[4] as Element)).toBe(assets.css);
      expect(textOf(kids[5] as Element)).toBe(assets.enhance);
      expect(body.childNodes.filter(isElement)).toEqual([]);
    });
  }

  it('Mermaid on: the same prefix, then style, enhance and Mermaid, each once', () => {
    const out = frame(plain(), { assets: withMermaid(), mermaid: {} });
    expect(scanPrefix(out)).toEqual([]);
    const kids = tree(out).head.childNodes.filter(isElement);
    expect(kids.map((e) => e.tagName)).toEqual(['meta', 'script', 'script', 'script', 'style', 'script', 'script']);
    expect(textOf(kids[6] as Element)).toBe(mermaidText);
  });
});

describe('L3.M1 and L3.M7 over every corpus document: the prefix holds, and a hostile one is framed or refused too-large', () => {
  // Every case it frames, generated ones included: the full prefix scan. Hostile and generated cases: frameDocument returns a string when
  // the escaped html is within SEED_HTML_MAX_CHARS and throws too-large otherwise, never another code; a case that does
  // not render (its verdict's outcome) is refused not-rendered, the second lock behind a host's gate.
  const cases = loadCorpus();
  it('the corpus has golden, hostile and generated cases', () => {
    expect(new Set(cases.map((c) => c.kind))).toEqual(new Set(['golden', 'hostile', 'generated']));
  });
  for (const c of cases) {
    it(`${c.kind} ${c.id}`, () => {
      const r = render(c.input, c.options);
      const doc: RenderInput = { result: { outcome: r.outcome, html: r.html, meta: { title: r.meta.title, frontList: r.meta.frontList } } };
      if (r.outcome !== 'rendered') {
        expect(c.kind, 'only a hostile or generated case may fail to render').not.toBe('golden');
        expect(refusal(() => frame(doc))).toBe('not-rendered');
        return;
      }
      const fits = escapedHtmlLength(r.html) <= SEED_HTML_MAX_CHARS;
      let out: string | null = null;
      try {
        out = frame(doc);
      } catch (e) {
        expect(e).toBeInstanceOf(FrameError);
        expect((e as FrameError).code).toBe('too-large');
      }
      expect(out !== null, `framed exactly when the escaped html (${String(escapedHtmlLength(r.html))}) is within the cap`).toBe(fits);
      if (out === null) return;
      expect(out.startsWith(META_PREFIX)).toBe(true);
      expect(JSON.parse(seedText(out))).toMatchObject({ html: r.html, nonce: NONCE });
      expect(scanPrefix(out)).toEqual([]);
    }, 120_000);
  }
});

describe('L3.M2 no URL and no authored markup', () => {
  for (const [name, doc] of Object.entries(DOCS)) {
    it(`${name}: with script and style bodies removed, no src, href, srcset, link, base or @import`, () => {
      const out = frame(doc());
      const bare = out.replace(/<script\b([^>]*)>[\s\S]*?<\/script>/g, '<script$1></script>').replace(/<style>[\s\S]*?<\/style>/g, '<style></style>');
      for (const needle of ['src=', 'href=', 'srcset=', '<link', '<base', '@import']) expect(bare).not.toContain(needle);
      const style = /<style>([\s\S]*?)<\/style>/.exec(out)?.[1] ?? '';
      const urls = style.match(/url\(/g) ?? [];
      expect(urls.length).toBeGreaterThan(0);
      expect(style.match(/url\(data:font\/woff2;base64,/g)?.length).toBe(urls.length);
      expect(scanUrls(out)).toEqual([]);
    });
  }

  it('a document full of external links and images, with its images seeded: no URL outside the script bodies', () => {
    const lines: string[] = [];
    for (let i = 0; i < 40; i += 1) lines.push(`[link ${String(i)}](https://example.com/${String(i)}) ![image ${String(i)}](https://example.com/${String(i)}.png) <https://example.org/${String(i)}>`);
    const r = render(lines.join('\n\n'));
    expect(r.html).toContain('href="https://example.com/');
    expect(r.html).toContain('src="https://example.com/');
    const images = Object.fromEntries(Array.from({ length: 40 }, (_, i) => [`https://example.com/${String(i)}.png`, PNG]));
    const out = frame({ ...input(lines.join('\n\n')), images });
    expect(scanUrls(out)).toEqual([]);
    expect(scanPrefix(out)).toEqual([]);
    expect(tree(out).all.filter((e) => e.attrs.some((a) => ['src', 'href', 'srcset'].includes(a.name)))).toEqual([]);
  });
});

describe('L3.M3 seed escaping', () => {
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
    expect(scanSeed(out)).toEqual([]);
  });
});

describe('L3.M5 asset verification', () => {
  const flip = (s: string, at: number): string => s.slice(0, at) + (s[at] === 'a' ? 'b' : 'a') + s.slice(at + 1);
  const NAMES = ['guard', 'bootstrap', 'enhance', 'css', 'mermaid'] as const;

  for (const name of NAMES) {
    it(`one flipped byte in assets.${name}: asset-mismatch`, () => {
      const a = withMermaid();
      expect(refusal(() => frame(plain(), { assets: { ...a, [name]: flip(a[name] as string, 100) }, mermaid: {} }))).toBe('asset-mismatch');
    });
  }

  it('an asset that is not a string: asset-mismatch', () => {
    expect(refusal(() => frame(plain(), { assets: { ...assets, guard: 42 as unknown as string } }))).toBe('asset-mismatch');
  });

  it('with Mermaid off (absent or null), a supplied assets.mermaid is verified all the same: a flipped byte or a non-string is asset-mismatch', () => {
    const bad = [flip(mermaidText, 100), 42 as unknown as string, null as unknown as string];
    for (const mermaid of bad) {
      expect(refusal(() => frame(plain(), { assets: { ...assets, mermaid } })), String(typeof mermaid)).toBe('asset-mismatch');
      expect(refusal(() => frame(plain(), { mermaid: null, assets: { ...assets, mermaid } })), String(typeof mermaid)).toBe('asset-mismatch');
    }
    const out = frame(plain(), { mermaid: null, assets: withMermaid() });
    expect(out).not.toContain(mermaidText);
  });

  const HAZARDS: readonly (readonly [string, (s: string) => string])[] = [
    ['a CR', (s) => `${s}\r`],
    ['a NUL', (s) => `${s}\0`],
    ['a BOM', (s) => `\uFEFF${s}`],
    ['</script', (s) => `${s}/*</script*/`],
    ['<SCRIPT', (s) => `${s}/*<SCRIPT*/`],
  ];
  for (const [what, plant] of HAZARDS) {
    it(`${what} in a script: unsafe-asset, before the hash is read`, () => {
      expect(refusal(() => frame(plain(), { assets: { ...assets, enhance: plant(assets.enhance) } }))).toBe('unsafe-asset');
      expect(refusal(() => frame(plain(), { assets: { ...assets, guard: plant(assets.guard) } }))).toBe('unsafe-asset');
    });
  }
  it('a CR, @import or a remote url( in the stylesheet: unsafe-asset', () => {
    for (const css of [`${assets.css}\r`, `@import "x.css";${assets.css}`, `${assets.css}a{b:url(https://example.com/x)}`]) {
      expect(refusal(() => frame(plain(), { assets: { ...assets, css } }))).toBe('unsafe-asset');
    }
  });

  it('non-ASCII inside a literal passes: the real Mermaid file holds some and is accepted', () => {
    expect(/[^\x00-\x7f]/.test(mermaidText)).toBe(true);
    expect(refusal(() => frame(plain(), { assets: withMermaid(), mermaid: {} }))).toBe('no refusal');
    expect(rules.scriptHazards('var r = /[\u00ee\u00ef]/;')).toEqual([]);
  });
});

describe('L3.M6 policy cross-check', () => {
  it('the enhance hash removed from the policy: csp', () => {
    expect(refusal(() => frame(plain(), { csp: frameCsp().replace(` ${FRAME_MANIFEST.enhance.csp}`, '') }))).toBe('csp');
  });
  it('the Mermaid hash removed while Mermaid is inlined: csp; while it is not: no refusal', () => {
    const csp = frameCsp().replace(` ${FRAME_MANIFEST.mermaid.csp}`, '');
    expect(refusal(() => frame(plain(), { csp, assets: withMermaid(), mermaid: {} }))).toBe('csp');
    expect(refusal(() => frame(plain(), { csp }))).toBe('no refusal');
  });
  it('connect-src * added: csp', () => {
    expect(refusal(() => frame(plain(), { csp: `${frameCsp()}; connect-src *` }))).toBe('csp');
  });
  it("'unsafe-eval' added: csp", () => {
    expect(refusal(() => frame(plain(), { csp: frameCsp().replace('script-src ', "script-src 'unsafe-eval' ") }))).toBe('csp');
  });
  it('the policy is read once: a csp that answers otherwise on a second read is emitted exactly as it was checked', () => {
    let reads = 0;
    const csp = (): string => ((reads += 1), reads === 1 ? frameCsp() : '"><script>alert(1)</script><meta x="');
    const out = frameDocument(plain(), Object.defineProperty({ nonce: NONCE, assets }, 'csp', { get: csp, enumerable: true }) as unknown as FrameOptions);
    expect(reads).toBe(1);
    expect(out.startsWith(`<meta http-equiv="Content-Security-Policy" content="${frameCsp()}"><script>`)).toBe(true);
    expect(out).not.toContain('alert(1)');
    expect(scanPrefix(out)).toEqual([]);
  });
  it('the canonical policy passes checkFrameCsp with every script hash', () => {
    expect(checkFrameCsp(frameCsp(), [FRAME_MANIFEST.guard.csp, FRAME_MANIFEST.bootstrap.csp, FRAME_MANIFEST.enhance.csp])).toEqual({ ok: true });
  });
});

describe('L3.M6 policy refusals: each rule of checkFrameCsp refuses on its own', () => {
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
    ["default-src 'self'", () => swap("default-src 'none'", "default-src 'self'"), 'default-src'],
    ['base-uri missing', () => swap("; base-uri 'none'", ''), 'base-uri'],
    ['form-action missing', () => swap("; form-action 'none'", ''), 'form-action'],
    ['a duplicate script-src', () => `${good}; script-src ${FRAME_MANIFEST.guard.csp}`, 'duplicate'],
    ['an unknown hash of the right form', () => swap('script-src ', `script-src ${UNKNOWN} `), 'unknown-hash'],
    ['a double quote in a value', () => swap('img-src data:', 'img-src data:"'), 'character'],
    ['a character outside printable ASCII', () => swap('img-src data:', 'img-src data:\u00e9'), 'character'],
    ['over 4096 characters (trailing spaces only)', () => `${good}${' '.repeat(4097 - good.length)}`, 'length'],
  ];
  for (const [name, policy, why] of CASES) {
    it(`${name}: refused by its own rule, and frameDocument throws csp`, () => {
      expect(checkFrameCsp(policy(), REQUIRED)).toEqual({ ok: false, why });
      expect(refusal(() => frame(plain(), { csp: policy() }))).toBe('csp');
    });
  }
  it('the 4096-character bound is inclusive: the same padding to exactly 4096 passes', () => {
    expect(checkFrameCsp(`${good}${' '.repeat(4096 - good.length)}`, REQUIRED)).toEqual({ ok: true });
  });
});

describe('L3.M7 every refusal code, each by its own input', () => {
  const CODES: readonly (readonly [FrameErrorCode, () => unknown])[] = [
    ['not-rendered', () => frame({ ...plain(), result: { ...plain().result, outcome: 'over-limit' } })],
    ['invalid-input', () => frame({ ...plain(), lang: 'x' })],
    ['nonce', () => frame(plain(), { nonce: 'A'.repeat(32) })],
    ['asset-mismatch', () => frame(plain(), { assets: { ...assets, enhance: `${assets.enhance} ` } })],
    ['unsafe-asset', () => frame(plain(), { assets: { ...assets, enhance: `${assets.enhance}\r` } })],
    ['csp', () => frame(plain(), { csp: frameCsp().replace(` ${FRAME_MANIFEST.enhance.csp}`, '') })],
    ['missing-asset', () => frame(plain(), { mermaid: {} })],
    ['too-large', () => frame(plain(), { maxSrcdocChars: 1 })],
  ];
  for (const [code, run] of CODES) {
    it(`${code}`, () => {
      expect(refusal(run)).toBe(code);
    });
  }
  it('lists each code of Reference §4 once', () => {
    expect(CODES.map(([c]) => c).sort()).toEqual(['asset-mismatch', 'csp', 'invalid-input', 'missing-asset', 'nonce', 'not-rendered', 'too-large', 'unsafe-asset']);
  });
});

describe('L3.M7 each code at its boundary', () => {
  it('the nonce: 32 lower-case hex digits pass; 31, 33 and upper-case digits are refused nonce', () => {
    expect(refusal(() => frame(plain(), { nonce: '0123456789abcdef'.repeat(2) }))).toBe('no refusal');
    for (const nonce of ['a'.repeat(31), 'a'.repeat(33), 'A'.repeat(32), `${'a'.repeat(31)}g`]) expect(refusal(() => frame(plain(), { nonce })), nonce).toBe('nonce');
  });

  it("outcome 'over-limit', 'output-over-limit' and 'failed': not-rendered", () => {
    for (const outcome of ['over-limit', 'output-over-limit', 'failed'] as const) {
      expect(refusal(() => frame({ ...plain(), result: { ...plain().result, outcome } })), outcome).toBe('not-rendered');
    }
  });

  it('maxSrcdocChars: at the output length the string is returned; one under it, too-large', () => {
    const out = frame(plain());
    expect(frame(plain(), { maxSrcdocChars: out.length })).toBe(out);
    expect(refusal(() => frame(plain(), { maxSrcdocChars: out.length - 1 }))).toBe('too-large');
  });

  it('maxSrcdocChars: the default passes; above it, or not a positive integer, invalid-input', () => {
    expect(refusal(() => frame(plain(), { maxSrcdocChars: MAX_SRCDOC_CHARS_DEFAULT }))).toBe('no refusal');
    for (const v of [MAX_SRCDOC_CHARS_DEFAULT + 1, 0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, '100' as unknown as number, null as unknown as number]) {
      expect(refusal(() => frame(plain(), { maxSrcdocChars: v })), String(v)).toBe('invalid-input');
    }
  });

  it('MAX_SRCDOC_CHARS_DEFAULT is SEED_HTML_MAX_CHARS + the five assets\' chars + IMAGE_BUDGET_CHARS + SEED_FIELDS_MAX_CHARS + the skeleton at its longest (C92)', () => {
    const assetChars = Object.values(FRAME_MANIFEST).reduce((n, a) => n + a.chars, 0);
    expect(Object.keys(FRAME_MANIFEST).sort()).toEqual(['bootstrap', 'css', 'enhance', 'guard', 'mermaid']);
    for (const name of ['guard', 'bootstrap', 'enhance', 'css', 'mermaid'] as const) expect(FRAME_MANIFEST[name].chars, name).toBe(built.files[name].chars);
    // The skeleton at its longest, measured on a real srcdoc rather than read from document.ts: the empty document framed
    // with Mermaid on (every element written) under the longest policy the floor admits (CSP_MAX_CHARS characters; one
    // more is refused csp), less every element's text as the parser reads it. What is left is the fixed tags and
    // attributes around the parts, plus that policy.
    const longest = frameCsp() + ' '.repeat(CSP_MAX_CHARS - frameCsp().length);
    const empty: RenderInput = { result: { outcome: 'rendered', html: '', meta: { title: null, frontList: null } } };
    const on: Partial<FrameOptions> = { assets: withMermaid(), mermaid: {} };
    expect(refusal(() => frame(empty, { ...on, csp: `${longest} ` }))).toBe('csp');
    const out = frame(empty, { ...on, csp: longest });
    const kids = tree(out).head.childNodes.filter(isElement);
    expect(kids.map((k) => k.tagName)).toEqual(['meta', 'script', 'script', 'script', 'style', 'script', 'script']);
    expect(attr(kids[0] as Element, 'content') === longest).toBe(true);
    const texts = kids.slice(1).map(textOf);
    // Each asset text as given, compared by identity rather than diffed (each is up to megabytes); [1] is the seed.
    const want = [assets.guard, null, assets.bootstrap, assets.css, assets.enhance, mermaidText];
    expect(texts.map((t, i) => want[i] === null || t === want[i])).toEqual([true, true, true, true, true, true]);
    const skeleton = out.length - texts.reduce((n, t) => n + t.length, 0);
    expect(skeleton).toBeGreaterThan(CSP_MAX_CHARS);
    expect(MAX_SRCDOC_CHARS_DEFAULT).toBe(SEED_HTML_MAX_CHARS + assetChars + IMAGE_BUDGET_CHARS + SEED_FIELDS_MAX_CHARS + skeleton);
  });

  it('MAX_SRCDOC_CHARS_DEFAULT and its skeleton term are derived in src/frame/document.ts: neither initialiser holds a numeric literal', () => {
    const rel = 'src/frame/document.ts';
    const sf = ts.createSourceFile(rel, readFileSync(path.join(ROOT, rel), 'utf8'), ts.ScriptTarget.ES2022, true);
    /** The numeric literals and the identifiers of the one initialiser of the module-level const `name`. */
    const initialiser = (name: string): { literals: string[]; names: string[] } => {
      const decls: ts.VariableDeclaration[] = [];
      const visit = (n: ts.Node): void => {
        if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === name) decls.push(n);
        ts.forEachChild(n, visit);
      };
      visit(sf);
      expect(decls, name).toHaveLength(1);
      const init = decls[0]?.initializer;
      if (init === undefined) throw new Error(`${name}: no initialiser`);
      const literals: string[] = [];
      const names = new Set<string>();
      const walk = (n: ts.Node): void => {
        if (ts.isNumericLiteral(n) || ts.isBigIntLiteral(n)) literals.push(n.text);
        if (ts.isIdentifier(n)) names.add(n.text);
        ts.forEachChild(n, walk);
      };
      walk(init);
      return { literals, names: [...names] };
    };
    const total = initialiser('MAX_SRCDOC_CHARS_DEFAULT');
    expect(total.literals).toEqual([]);
    for (const n of ['SEED_HTML_MAX_CHARS', 'FRAME_MANIFEST', 'IMAGE_BUDGET_CHARS', 'SEED_FIELDS_MAX_CHARS', 'SKELETON_MAX_CHARS']) expect(total.names, n).toContain(n);
    // The skeleton term: measured from the skeleton frameDocument writes, plus the floor's own bound on the policy.
    const skeleton = initialiser('SKELETON_MAX_CHARS');
    expect(skeleton.literals).toEqual([]);
    expect(skeleton.names).toContain('CSP_MAX_CHARS');
  });

  it('SEED_HTML_MAX_CHARS: an html at the cap as the seed carries it is framed; one escaped character over it, too-large', () => {
    // `<` takes six seed characters, so the html is mostly `<`, with plain letters making up the remainder.
    const atCap = '<'.repeat(Math.floor(SEED_HTML_MAX_CHARS / 6)) + 'a'.repeat(SEED_HTML_MAX_CHARS % 6);
    expect(escapedHtmlLength(atCap)).toBe(SEED_HTML_MAX_CHARS);
    const doc = (html: string): RenderInput => ({ result: { outcome: 'rendered', html, meta: { title: null, frontList: null } } });
    const out = frame(doc(atCap));
    expect(out.length).toBeGreaterThan(SEED_HTML_MAX_CHARS);
    expect(out.length).toBeLessThanOrEqual(MAX_SRCDOC_CHARS_DEFAULT);
    expect(seedText(out).length).toBeGreaterThan(SEED_HTML_MAX_CHARS);
    expect(escapedHtmlLength(`${atCap}a`)).toBe(SEED_HTML_MAX_CHARS + 1);
    expect(refusal(() => frame(doc(`${atCap}a`)))).toBe('too-large');
    // Longer than the cap before escaping: refused without being measured.
    expect(refusal(() => frame(doc('a'.repeat(SEED_HTML_MAX_CHARS + 1))))).toBe('too-large');
  }, 300_000);

  it("test 7's old-cap row: a document at 1.1.0's default srcdoc cap, with both faces at 131 072 decoded bytes and the largest accepted appearance, is framed, within the derived cap, and grows by the two fields' seed text", () => {
    // ccrc D-8824: the document is at the old cap the way 1.1.0 counted it (test/frame-old-cap.ts): the html at
    // SEED_HTML_MAX_CHARS, 512 images at the 5 MiB budget, and every other seed field at its cap, with Mermaid's asset
    // inlined. Only lengths are kept (the srcdoc is about 115 million characters), so this row is run with -t.
    const { input: doc, options } = oldCapDocument();
    const on = { ...options, assets: withMermaid() };
    // Each srcdoc is about 115 million characters: only its length is kept, and the next is framed after it is released.
    const lengthOf = (o: Partial<FrameOptions>): number => frame(doc, { ...on, ...o }).length;
    const withoutLength = lengthOf({});
    // The document is at 1.1.0's cap: with the assets counted at 1.1.0's lengths it is within the old cap, and it leaves less
    // than a thousandth of it unused (the skeleton's slack, the base64 padding slack the seed fields' cap counts, and the
    // small fields a mount writes at their own values: lang, prefs, the initial hash, the bridge flags, Mermaid's limits).
    const oldCap = oldDefaultCap();
    const atOld = withoutLength - (ASSET_CHARS_NOW - ASSET_CHARS_1_1_0);
    // The figures the programme's results quote, printed so a run shows them (ASSET_CHARS_NOW is the assets' lengths in this checkout).
    console.log(`old-cap figures: at-cap srcdoc length ${String(withoutLength)}; at 1.1.0's asset lengths ${String(atOld)}; 1.1.0's old cap ${String(oldCap)}; derived MAX_SRCDOC_CHARS_DEFAULT ${String(MAX_SRCDOC_CHARS_DEFAULT)}; assets now ${String(ASSET_CHARS_NOW)}`);
    expect(atOld).toBeLessThanOrEqual(oldCap);
    expect(oldCap - atOld).toBeLessThan(oldCap / 1000);
    const faceAtCap = Buffer.concat([Buffer.from('wOF2'), Buffer.alloc(131072 - 4)]).toString('base64');
    expect(faceAtCap).toHaveLength(174764);
    const maximal = JSON.parse(MAXIMAL_APPEARANCE_TEXT().replace(/\\u003c/g, '<')) as unknown;
    const both: Partial<FrameOptions> = { appearance: maximal, assets: { ...withMermaid(), fonts: { sans: faceAtCap, mono: faceAtCap } } as FrameAssets };
    const bothLength = lengthOf(both);
    console.log(`old-cap figures: with both faces and the largest appearance ${String(bothLength)}`);
    expect(bothLength).toBeLessThanOrEqual(MAX_SRCDOC_CHARS_DEFAULT);
    // `,"appearance":V` and `,"fonts":{"sans":"F","mono":"F"}`: nothing else of the srcdoc moves.
    const fields = `,"appearance":`.length + MAXIMAL_APPEARANCE_TEXT().length + `,"fonts":{"sans":"","mono":""}`.length + 2 * faceAtCap.length;
    expect(bothLength - withoutLength).toBe(fields);
    // Its control: one character under that length the refusal is too-large, so the cap the row sits under is the one in force.
    expect(refusal(() => lengthOf({ ...both, maxSrcdocChars: bothLength - 1 }))).toBe('too-large');
  }, 600_000);

  it('SEED_HTML_MAX_CHARS: an html longer than the cap before escaping is refused too-large without being measured', () => {
    // Escaping only lengthens, so such a string is over the cap whatever it holds; measuring it would cost up to six
    // times its length (a string past the engine's longest one throws a RangeError instead).
    const doc = (html: string): RenderInput => ({ result: { outcome: 'rendered', html, meta: { title: null, frontList: null } } });
    const before = measured.calls.length;
    expect(refusal(() => frame(doc('a'.repeat(SEED_HTML_MAX_CHARS + 1))))).toBe('too-large');
    expect(measured.calls.slice(before)).toEqual([]);
    // Its control: an html within the cap is measured once.
    expect(refusal(() => frame(doc('<p>x</p>')))).toBe('no refusal');
    expect(measured.calls.slice(before)).toEqual([8]);
  }, 300_000);

  it("Mermaid's maxTextSize 50000 and maxEdges 500 pass; 50001 and 501 are invalid-input (a host may only lower them)", () => {
    const on = { assets: withMermaid() };
    expect(seedOf(frame(plain(), { ...on, mermaid: { maxTextSize: 50000, maxEdges: 500 } }))['mermaid']).toEqual({ maxTextSize: 50000, maxEdges: 500, secure: [], draw: 'auto' });
    expect(refusal(() => frame(plain(), { ...on, mermaid: { maxTextSize: 50001 } }))).toBe('invalid-input');
    expect(refusal(() => frame(plain(), { ...on, mermaid: { maxEdges: 501 } }))).toBe('invalid-input');
    for (const v of [0, 1.5, '10' as unknown as number]) expect(refusal(() => frame(plain(), { ...on, mermaid: { maxTextSize: v } })), String(v)).toBe('invalid-input');
  });

  it('the ceilings equal the layout\'s Mermaid defaults (MAX_TEXT_SIZE, MAX_EDGES)', () => {
    expect(MERMAID_LIMIT_CEILINGS).toEqual({ maxTextSize: MAX_TEXT_SIZE, maxEdges: MAX_EDGES });
    expect(MERMAID_LIMIT_CEILINGS).toEqual({ maxTextSize: 50000, maxEdges: 500 });
    expect(Object.isFrozen(MERMAID_LIMIT_CEILINGS)).toBe(true);
  });

  it("mermaid.draw: 'on-request' is seeded as given, absent is 'auto', and 'lazy' is invalid-input", () => {
    const on = { assets: withMermaid() };
    expect((seedOf(frame(plain(), { ...on, mermaid: { draw: 'on-request' } }))['mermaid'] as Record<string, unknown>)['draw']).toBe('on-request');
    expect((seedOf(frame(plain(), { ...on, mermaid: { draw: 'auto' } }))['mermaid'] as Record<string, unknown>)['draw']).toBe('auto');
    expect((seedOf(frame(plain(), { ...on, mermaid: {} }))['mermaid'] as Record<string, unknown>)['draw']).toBe('auto');
    for (const draw of ['lazy', '', null, 1]) expect(refusal(() => frame(plain(), { ...on, mermaid: { draw: draw as 'auto' } })), String(draw)).toBe('invalid-input');
  });

  it('mermaid.secure is seeded as given; a key outside its grammar or an unknown mermaid key is invalid-input', () => {
    const on = { assets: withMermaid() };
    expect((seedOf(frame(plain(), { ...on, mermaid: { secure: ['themeCSS', 'fontFamily'] } }))['mermaid'] as Record<string, unknown>)['secure']).toEqual(['themeCSS', 'fontFamily']);
    expect(refusal(() => frame(plain(), { ...on, mermaid: { secure: ['a b'] } }))).toBe('invalid-input');
    expect(refusal(() => frame(plain(), { ...on, mermaid: { secure: 'themeCSS' as unknown as string[] } }))).toBe('invalid-input');
    expect(refusal(() => frame(plain(), { ...on, mermaid: { layout: 'elk' } as unknown as NonNullable<FrameOptions['mermaid']> }))).toBe('invalid-input');
  });

  it("an initialHash of 'a b' is not refused and is seeded as null; 'D2.1a' and 'fnref1:1' are seeded as given", () => {
    const r = (h: unknown): RenderInput => ({ ...plain(), initialHash: h as string });
    expect(refusal(() => frame(r('a b')))).toBe('no refusal');
    expect(seedOf(frame(r('a b')))['initialHash']).toBeNull();
    for (const h of ['D2.1a', 'fnref1:1']) expect(seedOf(frame(r(h)))['initialHash']).toBe(h);
  });
});

describe('L3.M7 initialHash: outside FRAGMENT_ID_GRAMMAR it is seeded as null, never refused (ruling R1)', () => {
  const r = (h: unknown): RenderInput => ({ ...plain(), initialHash: h as string });

  it('300 code units, the empty string and a non-string give a seed with initialHash null', () => {
    for (const h of ['x'.repeat(300), '', 42]) {
      expect(refusal(() => frame(r(h)))).toBe('no refusal');
      expect(seedOf(frame(r(h)))['initialHash']).toBeNull();
    }
  });
  it('an id of 1 and of 256 code units is seeded as given', () => {
    for (const h of ['a', 'x'.repeat(256), 'D2.1a']) expect(seedOf(frame(r(h)))['initialHash']).toBe(h);
  });
  it('an id outside FRAGMENT_ID_GRAMMAR (a space, a #, a slash, 129 astral letters) is seeded as null, and the seed validates', () => {
    for (const h of ['a b', '#x', 'a/b', '\u{1D400}'.repeat(129)]) {
      const seed = seedOf(frame(r(h)));
      expect(seed['initialHash'], h).toBeNull();
      expect(validateSeed(seed).ok, h).toBe(true);
    }
    expect(seedOf(frame(r('fnref1:1')))['initialHash']).toBe('fnref1:1');
  });
});

describe('L3.M7 the real version, images, snapshot, features and bridge: seeded as given, refused invalid-input outside their caps', () => {
  const COMMIT = { sha: SHA40, subject: 'A subject', date: '2026-10-27T09:00:00Z', parents: [SHA64] };
  const full = (): { r: RenderInput; o: Partial<FrameOptions> } => ({
    r: {
      ...plain(),
      version: { sha: SHA40, draft: true, commits: [COMMIT], only: SHA64 },
      images: { 'pic.png': PNG, __proto__: PNG, '': 'data:image/svg+xml;base64,PHN2Zy8+' } as unknown as Record<string, string>,
      lang: 'de-CH',
    },
    o: {
      prefs: { theme: 'dark', width: 'wide', font: 'sans' },
      snapshot: { 'pref:prefs': '{"theme":"dark"}', 'doc:pos': '{"y":120}', 'pref:ui': 'null' },
      features: { rules: false, folds: true, chrome: { bar: false }, vocabulary: { status: { ok: ['fertig'] }, ids: false, qualifiers: ['the annex'] } },
      bridge: { links: false, changes: false },
      assets: withMermaid(),
      mermaid: { maxTextSize: 16384, maxEdges: 200, secure: ['themeCSS'], draw: 'on-request' },
    },
  });
  // `__proto__` written in an object literal sets the prototype; an image ref of that name is an own key only through
  // JSON.parse or defineProperty, which is how a record a host built from scanRefs() holds it.
  const withProtoRef = (): Record<string, string> => JSON.parse(`{"pic.png":"${PNG}","__proto__":"${PNG}"}`) as Record<string, string>;

  it('every field at a real value is seeded as given, and the seed passes the bootstrap\'s validator', () => {
    const { r, o } = full();
    const seed = seedOf(frame({ ...r, images: withProtoRef() }, o));
    expect(Object.keys(seed).sort()).toEqual(REQUIRED_SEED_KEYS);
    expect(seed['version']).toEqual({ sha: SHA40, draft: true, commits: [COMMIT], only: SHA64 });
    expect(seed['images']).toEqual([['pic.png', PNG], ['__proto__', PNG]]);
    expect(seed['lang']).toBe('de-CH');
    expect(seed['prefs']).toEqual({ theme: 'dark', width: 'wide', font: 'sans' });
    expect(seed['snapshot']).toEqual([['pref:prefs', '{"theme":"dark"}'], ['doc:pos', '{"y":120}'], ['pref:ui', 'null']]);
    expect(seed['features']).toEqual(o.features);
    expect(seed['bridge']).toEqual({ links: false, hash: true, copy: true, changes: false, versions: true, progress: false, places: false, printFigures: false });
    expect(seed['mermaid']).toEqual({ maxTextSize: 16384, maxEdges: 200, secure: ['themeCSS'], draw: 'on-request' });
    expect(validateSeed(seed)).toEqual({ ok: true, seed });
  });

  it('absent fields are seeded at their defaults', () => {
    const seed = seedOf(frame(plain()));
    expect(seed).toMatchObject({
      version: { sha: null, draft: false, commits: null, only: null },
      images: [],
      lang: 'en',
      prefs: {},
      snapshot: [],
      features: {},
      mermaid: null,
      bridge: { links: true, hash: true, copy: true, changes: true, versions: true, progress: false, places: false, printFigures: false },
    });
  });

  const REFUSED: readonly (readonly [string, (r: RenderInput) => RenderInput, Partial<FrameOptions>])[] = [
    ['a short version.sha (7 hex)', (r) => ({ ...r, version: { sha: 'abcdef0' } }), {}],
    ['an upper-case version.only', (r) => ({ ...r, version: { only: SHA40.toUpperCase() } }), {}],
    ['version.draft not a boolean', (r) => ({ ...r, version: { draft: null as unknown as boolean } }), {}],
    ['an unknown version key', (r) => ({ ...r, version: { commit: SHA40 } as unknown as NonNullable<RenderInput['version']> }), {}],
    ['101 commits', (r) => ({ ...r, version: { commits: Array.from({ length: 101 }, () => COMMIT) } }), {}],
    ['a commit with a short sha', (r) => ({ ...r, version: { commits: [{ ...COMMIT, sha: 'abcdef0' }] } }), {}],
    ['a commit with a short parent', (r) => ({ ...r, version: { commits: [{ ...COMMIT, parents: ['abcdef0'] }] } }), {}],
    ['an image that is not a data URL', (r) => ({ ...r, images: { 'a.png': 'https://example.com/a.png' } }), {}],
    ['an image of another type', (r) => ({ ...r, images: { 'a.png': 'data:text/html;base64,PGI+' } }), {}],
    ['an image ref of 2049 code units', (r) => ({ ...r, images: { ['r'.repeat(2049)]: PNG } }), {}],
    ['513 images', (r) => ({ ...r, images: Object.fromEntries(Array.from({ length: 513 }, (_, i) => [`${String(i)}.png`, PNG])) }), {}],
    ['an image value that is not a string', (r) => ({ ...r, images: { 'a.png': 1 as unknown as string } }), {}],
    ['a lang outside its grammar', (r) => ({ ...r, lang: 'e' }), {}],
    ['a pref outside its values', (r) => r, { prefs: { theme: 'sepia' as 'dark' } }],
    ['an unknown pref', (r) => r, { prefs: { lens: 'product' } as unknown as NonNullable<FrameOptions['prefs']> }],
    ['a snapshot key outside the allow-list', (r) => r, { snapshot: { 'doc:unknown': '1' } as unknown as NonNullable<FrameOptions['snapshot']> }],
    ['a snapshot value that is not JSON', (r) => r, { snapshot: { 'pref:prefs': '{theme}' } }],
    ['a snapshot value over 64 KiB', (r) => r, { snapshot: { 'pref:prefs': JSON.stringify('x'.repeat(65535)) } }],
    ['an unknown feature', (r) => r, { features: { search: true } as unknown as FrameFeatures }],
    ['a feature flag that is not a boolean', (r) => r, { features: { rules: 'yes' as unknown as boolean } }],
    ['an unknown chrome key', (r) => r, { features: { chrome: { footer: false } as unknown as NonNullable<FrameFeatures['chrome']> } }],
    ['a vocabulary word list of 201 words', (r) => r, { features: { vocabulary: { qualifiers: Array.from({ length: 201 }, (_, i) => `w${String(i)}`) } } }],
    ['a bridge switch that is not a boolean', (r) => r, { bridge: { links: 'no' as unknown as boolean } }],
    ['the progress switch that is not a boolean', (r) => r, { bridge: { progress: 'yes' as unknown as boolean } }],
    ['an unknown bridge key', (r) => r, { bridge: { open: true } as unknown as NonNullable<FrameOptions['bridge']> }],
    ['a title that is not a string', (r) => ({ ...r, result: { ...r.result, meta: { ...r.result.meta, title: 1 as unknown as string } } }), {}],
    ['a frontList entry of the wrong shape', (r) => ({ ...r, result: { ...r.result, meta: { ...r.result.meta, frontList: [{ key: 'a' }] as unknown as null } } }), {}],
  ];
  for (const [name, change, o] of REFUSED) {
    it(`${name}: invalid-input`, () => {
      expect(refusal(() => frame(change(plain()), { assets: withMermaid(), ...o }))).toBe('invalid-input');
    });
  }

  it('host data is read once, as plain data: a getter, a Map, a class instance, a hole and a function are invalid-input', () => {
    let reads = 0;
    const getter = Object.defineProperty({}, 'sha', { enumerable: true, get: () => ((reads += 1), SHA40) });
    expect(refusal(() => frame({ ...plain(), version: getter as NonNullable<RenderInput['version']> }))).toBe('invalid-input');
    expect(reads).toBe(0);
    class Features {
      readonly rules = true;
    }
    expect(refusal(() => frame(plain(), { features: new Features() }))).toBe('invalid-input');
    expect(refusal(() => frame(plain(), { features: new Map() as unknown as FrameFeatures }))).toBe('invalid-input');
    // eslint-disable-next-line no-sparse-arrays
    expect(refusal(() => frame({ ...plain(), version: { commits: [, COMMIT] as unknown as [] } }))).toBe('invalid-input');
    const item = Object.defineProperty([], '0', { enumerable: true, get: () => ((reads += 1), COMMIT) }) as unknown as [];
    expect(refusal(() => frame({ ...plain(), version: { commits: item } }))).toBe('invalid-input');
    expect(reads).toBe(0);
    expect(refusal(() => frame(plain(), { features: { rules: (() => true) as unknown as boolean } }))).toBe('invalid-input');
    expect(refusal(() => frame(plain(), { images: new Map([['a', PNG]]) } as unknown as FrameOptions))).toBe('no refusal'); // not a FrameOptions key: ignored
    expect(refusal(() => frame({ ...plain(), images: new Map([['a', PNG]]) as unknown as Record<string, string> }))).toBe('invalid-input');
  });

  it("a host value whose getter would answer differently on a second read cannot reach the seed: the copy is the seed's", () => {
    let n = 0;
    const lang = Object.defineProperty({}, 'theme', { enumerable: true, get: () => (n++ === 0 ? 'dark' : 'evil') });
    expect(refusal(() => frame(plain(), { prefs: lang as NonNullable<FrameOptions['prefs']> }))).toBe('invalid-input');
  });

  it('a list or record of more than 512 entries is refused before any entry is read', () => {
    let reads = 0;
    const counted = <T extends object>(target: T): T =>
      new Proxy(target, {
        getOwnPropertyDescriptor(t, k) {
          reads += 1;
          return Reflect.getOwnPropertyDescriptor(t, k);
        },
      });
    const commits = counted(Array.from({ length: 513 }, () => COMMIT));
    expect(refusal(() => frame({ ...plain(), version: { commits } }))).toBe('invalid-input');
    const images = counted(Object.fromEntries(Array.from({ length: 513 }, (_, i) => [`${String(i)}.png`, PNG])));
    expect(refusal(() => frame({ ...plain(), images }))).toBe('invalid-input');
    expect(reads).toBe(0);
    // Its control: 512 entries are read, each once.
    const fit = counted(Object.fromEntries(Array.from({ length: 512 }, (_, i) => [`${String(i)}.png`, PNG])));
    expect(refusal(() => frame({ ...plain(), images: fit }))).toBe('no refusal');
    expect(reads).toBe(512);
  });

  it('a proxy that lists a key it has no property for reads it as absent, and one whose length is not a number is refused', () => {
    const ghost = new Proxy({ rules: true }, { ownKeys: () => ['rules', 'ghost'], getOwnPropertyDescriptor: (t, k) => Reflect.getOwnPropertyDescriptor(t, k) });
    expect(refusal(() => frame(plain(), { features: ghost }))).toBe('no refusal');
    expect(seedOf(frame(plain(), { features: ghost }))['features']).toEqual({ rules: true });
    const many = new Proxy([COMMIT], { get: (t, k, r) => (k === 'length' ? 'many' : Reflect.get(t, k, r)) });
    expect(refusal(() => frame({ ...plain(), version: { commits: many } }))).toBe('invalid-input');
  });

  it('a value nested deeper than the seed allows is refused, however deep, without being walked to its end', () => {
    let deep: Record<string, unknown> = {};
    for (let i = 0; i < 100_000; i += 1) deep = { a: deep };
    expect(refusal(() => frame(plain(), { features: deep as FrameFeatures }))).toBe('invalid-input');
  });

  it('host data that reaches one value down many paths is refused within HOST_VALUES_MAX reads, never copied once per path', () => {
    // 19 arrays, each holding the one below it twice: 2^19 paths, and depth 19 is within the seed's depth cap. Every
    // read of the arrays is counted, by name or by descriptor, whoever makes it (the copy or the validator).
    let reads = 0;
    const counted = (a: unknown[]): unknown[] =>
      new Proxy(a, {
        get: (t, k, rec) => ((reads += 1), Reflect.get(t, k, rec)),
        getOwnPropertyDescriptor: (t, k) => ((reads += 1), Reflect.getOwnPropertyDescriptor(t, k)),
      });
    let shared: unknown = 'w';
    for (let i = 0; i < 19; i += 1) shared = counted([shared, shared]);
    const d = plain();
    const RUNS: readonly (readonly [string, () => unknown])[] = [
      ['prefs', () => frame(d, { prefs: { theme: shared } as unknown as FramePrefs })],
      ['features', () => frame(d, { features: { vocabulary: { qualifiers: shared } } as unknown as FrameFeatures })],
      ['meta.frontList', () => frame({ ...d, result: { ...d.result, meta: { ...d.result.meta, frontList: shared as RenderInput['result']['meta']['frontList'] } } })],
      ['meta.title', () => frame({ ...d, result: { ...d.result, meta: { ...d.result.meta, title: shared as string } } })],
      ['lang', () => frame({ ...d, lang: shared as string })],
      ['an image', () => frame({ ...d, images: { 'a.png': shared as string } })],
      ['a snapshot value', () => frame(d, { snapshot: { 'pref:ui': shared as string } })],
    ];
    for (const [name, run] of RUNS) {
      reads = 0;
      expect(refusal(run), name).toBe('invalid-input');
      expect(reads, name).toBeLessThanOrEqual(2 * HOST_VALUES_MAX);
    }
  });

  it('HOST_VALUES_MAX admits the largest host data a seed carries: every list at its cap, copied whole and seeded', () => {
    const L = SEED_LIMITS;
    const n = (k: number): number[] => Array.from({ length: k }, (_, i) => i);
    const words = n(L.words).map((i) => `w${String(i)}`);
    const vocabulary = Object.fromEntries([
      ...Object.entries(FEATURE_KEYS.groups).map(([g, keys]) => [g, Object.fromEntries(keys.map((k) => [k, words]))]),
      ...FEATURE_KEYS.grammars.map((k) => [k, { prefixes: words }]),
      ...FEATURE_KEYS.lists.map((k) => [k, words]),
    ]) as unknown as NonNullable<FrameFeatures['vocabulary']>;
    const features: FrameFeatures = { rules: false, folds: false, keyboard: false, chrome: { bar: false, rail: false, settings: false }, vocabulary };
    const frontList = n(L.frontEntries).map((i) => ({ key: `k${String(i)}`, list: true, vals: n(L.frontItems).map(() => 'v') }));
    const commits = n(L.commits).map(() => ({ sha: SHA40, subject: 's', date: 'd', parents: n(L.parents).map(() => SHA64) }));
    const images = Object.fromEntries(n(L.images).map((i) => [`i${String(i)}.png`, PNG]));
    const secure = n(L.secureKeys).map((i) => `k${String(i)}`);
    const d = plain();
    const r: RenderInput = { ...d, result: { ...d.result, meta: { title: 't', frontList } }, version: { sha: SHA40, draft: true, commits, only: SHA40 }, images, lang: 'en' };
    const run = (): string => frame(r, { features, assets: withMermaid(), mermaid: { maxTextSize: 1, maxEdges: 1, secure, draw: 'auto' }, prefs: { theme: 'dark', width: 'wide', font: 'sans' }, snapshot: { 'pref:ui': 'null' } });
    expect(refusal(run)).toBe('no refusal');
    const seed = seedOf(run());
    expect(seed['frontList']).toEqual(frontList);
    expect(seed['version']).toEqual({ sha: SHA40, draft: true, commits, only: SHA40 });
    expect(seed['features']).toEqual(features);
    expect((seed['images'] as unknown[]).length).toBe(L.images);
    expect((seed['mermaid'] as { secure: unknown }).secure).toEqual(secure);
  });

  it('a __proto__, constructor or prototype key in structured host data is invalid-input (an image ref of that name is data)', () => {
    for (const k of ['__proto__', 'constructor', 'prototype']) {
      expect(refusal(() => frame(plain(), { features: JSON.parse(`{"${k}": 1}`) as FrameFeatures })), k).toBe('invalid-input');
      expect(refusal(() => frame(plain(), { features: JSON.parse(`{"chrome": {"${k}": {}}}`) as FrameFeatures })), k).toBe('invalid-input');
    }
  });

  it('a malformed RenderInput or FrameOptions value is invalid-input, never a crash', () => {
    const d = plain();
    const CASES: readonly (readonly [string, () => unknown])[] = [
      ['no result', () => frame({} as RenderInput)],
      ['result null', () => frame({ result: null } as unknown as RenderInput)],
      ['meta null', () => frame({ ...d, result: { ...d.result, meta: null as unknown as RenderInput['result']['meta'] } })],
      ['html not a string', () => frame({ ...d, result: { ...d.result, html: 42 as unknown as string } })],
      ['lang null', () => frame({ ...d, lang: null as unknown as string })],
      ['version an array', () => frame({ ...d, version: [] as unknown as NonNullable<RenderInput['version']> })],
      ['bridge a string', () => frame(d, { bridge: 'none' as unknown as NonNullable<FrameOptions['bridge']> })],
      ['a bridge switch null', () => frame(d, { bridge: { links: null as unknown as boolean } })],
      ['the progress switch null', () => frame(d, { bridge: { progress: null as unknown as boolean } })],
      ['mermaid a string', () => frame(d, { assets: withMermaid(), mermaid: 'on' as unknown as NonNullable<FrameOptions['mermaid']> })],
      ['images an array', () => frame({ ...d, images: [['a.png', PNG]] as unknown as Record<string, string> })],
      ['options null', () => frameDocument(d, null as unknown as FrameOptions)],
      ['options a string', () => frameDocument(d, 'options' as unknown as FrameOptions)],
      ['assets absent', () => frameDocument(d, { csp: frameCsp(), nonce: NONCE } as unknown as FrameOptions)],
      ['assets null', () => frame(d, { assets: null as unknown as FrameAssets })],
      ['assets a string', () => frame(d, { assets: 'assets' as unknown as FrameAssets })],
    ];
    for (const [name, run] of CASES) expect(refusal(run), name).toBe('invalid-input');
  });

  it('a value whose key is undefined counts as absent, as JSON writes it', () => {
    const run = (): string => frame({ ...plain(), version: { sha: undefined, draft: true } as unknown as NonNullable<RenderInput['version']> }, { bridge: { links: undefined } as unknown as NonNullable<FrameOptions['bridge']>, features: { rules: undefined } as unknown as FrameFeatures });
    expect(refusal(run)).toBe('no refusal');
    const seed = seedOf(run());
    expect(seed['version']).toEqual({ sha: null, draft: true, commits: null, only: null });
    expect(seed['bridge']).toEqual({ links: true, hash: true, copy: true, changes: true, versions: true, progress: false, places: false, printFigures: false });
    expect(seed['features']).toEqual({});
  });
});

describe("B7.2 the progress switch: absent is false while the five answered bridge switches default to true (batch 1.1, C108)", () => {
  const d = (): RenderInput => plain();
  // The two switches of the parity wire (places, printFigures) are off by default too, as `progress` is; the five answered ops default to true.
  const OTHERS = { links: true, hash: true, copy: true, changes: true, versions: true, places: false, printFigures: false };

  it('no bridge at all seeds progress false and the other switches true', () => {
    expect(seedOf(frame(d()))['bridge']).toEqual({ ...OTHERS, progress: false });
  });

  it('a bridge that leaves progress out seeds it false, whatever it sets of the others', () => {
    expect(seedOf(frame(d(), { bridge: {} }))['bridge']).toEqual({ ...OTHERS, progress: false });
    expect(seedOf(frame(d(), { bridge: { links: false } }))['bridge']).toEqual({ ...OTHERS, links: false, progress: false });
    expect(seedOf(frame(d(), { bridge: { copy: true, hash: true } }))['bridge']).toEqual({ ...OTHERS, progress: false });
  });

  it('progress: true and progress: false are seeded as given; the others keep their defaults', () => {
    expect(seedOf(frame(d(), { bridge: { progress: true } }))['bridge']).toEqual({ ...OTHERS, progress: true });
    expect(seedOf(frame(d(), { bridge: { progress: false } }))['bridge']).toEqual({ ...OTHERS, progress: false });
    expect(seedOf(frame(d(), { bridge: { progress: true, links: false, versions: false } }))['bridge']).toEqual({ ...OTHERS, links: false, versions: false, progress: true, places: false, printFigures: false });
  });

  it('places and printFigures are off unless asked for, in any bridge that leaves them out (P1e)', () => {
    for (const bridge of [undefined, {}, { links: false }, { progress: true }, { places: undefined, printFigures: undefined }] as const) {
      const got = seedOf(frame(d(), bridge === undefined ? {} : { bridge: bridge as NonNullable<FrameOptions['bridge']> }))['bridge'] as Record<string, unknown>;
      expect(got['places'], JSON.stringify(bridge)).toBe(false);
      expect(got['printFigures'], JSON.stringify(bridge)).toBe(false);
    }
  });

  it('places: true and printFigures: true are seeded as given, each alone, and the seed passes the validator', () => {
    expect(seedOf(frame(d(), { bridge: { places: true } }))['bridge']).toEqual({ ...OTHERS, progress: false, places: true });
    expect(seedOf(frame(d(), { bridge: { printFigures: true } }))['bridge']).toEqual({ ...OTHERS, progress: false, printFigures: true });
    expect(seedOf(frame(d(), { bridge: { places: true, printFigures: true, progress: true } }))['bridge']).toEqual({ ...OTHERS, places: true, printFigures: true, progress: true });
    expect(seedOf(frame(d(), { bridge: { places: false, printFigures: false } }))['bridge']).toEqual({ ...OTHERS, progress: false });
    const seed = seedOf(frame(d(), { bridge: { places: true, printFigures: true } }));
    expect(validateSeed(seed)).toEqual({ ok: true, seed });
  });

  it('a places or printFigures switch that is not a boolean is invalid-input', () => {
    for (const k of ['places', 'printFigures']) {
      for (const v of ['yes', 1, null, {}]) {
        expect(refusal(() => frame(d(), { bridge: { [k]: v } as unknown as NonNullable<FrameOptions['bridge']> })), `${k} ${JSON.stringify(v)}`).toBe('invalid-input');
      }
    }
  });

  it('a seed with progress true passes the validator', () => {
    const seed = seedOf(frame(d(), { bridge: { progress: true } }));
    expect(validateSeed(seed)).toEqual({ ok: true, seed });
  });

  it("the bridge's own keys stay closed: an unknown one is still invalid-input (B7.6)", () => {
    expect(refusal(() => frame(d(), { bridge: { command: true } as unknown as NonNullable<FrameOptions['bridge']> }))).toBe('invalid-input');
  });
});

describe('L3.M7 Task 3 the default keys: frameDocument\'s seed holds every schema 1 key at its default', () => {
  const r = (): RenderInput => DOCS['details and footnotes']?.() as RenderInput;
  const DEFAULTS = {
    frontList: null,
    version: { sha: null, draft: false, commits: null, only: null },
    images: [],
    snapshot: [],
    features: {},
    bridge: { links: true, hash: true, copy: true, changes: true, versions: true, progress: false, places: false, printFigures: false },
  };

  it('mermaid off: exactly SEED_KEYS, each new key at its default, and the seed passes validateSeed', () => {
    const d = r();
    const seed = seedOf(frame(d, { prefs: { theme: 'dark' } }));
    expect(Object.keys(seed).sort()).toEqual(REQUIRED_SEED_KEYS);
    expect(seed).toEqual({ s: 1, nonce: NONCE, html: d.result.html, title: d.result.meta.title, initialHash: null, lang: 'en', prefs: { theme: 'dark' }, mermaid: null, ...DEFAULTS });
    expect(validateSeed(seed)).toEqual({ ok: true, seed });
  });

  it("mermaid on: the mermaid object is completed with secure [] and draw 'auto', and the seed passes validateSeed", () => {
    for (const [m, want] of [
      [{}, { secure: [], draw: 'auto' }],
      [{ maxTextSize: 16384, maxEdges: 500 }, { maxTextSize: 16384, maxEdges: 500, secure: [], draw: 'auto' }],
    ] as const) {
      const seed = seedOf(frame(r(), { assets: withMermaid(), mermaid: m }));
      expect(Object.keys(seed).sort()).toEqual(REQUIRED_SEED_KEYS);
      expect(seed['mermaid']).toEqual(want);
      expect(validateSeed(seed)).toEqual({ ok: true, seed });
    }
  });

  it('a lang over 64 code units (grammar-valid) is refused invalid-input, never seeded for the validator to refuse', () => {
    const lang = `en${'-abcdefgh'.repeat(7)}`;
    expect(lang.length).toBe(65);
    expect(refusal(() => frame({ ...r(), lang }))).toBe('invalid-input');
    expect(refusal(() => frame({ ...r(), lang: lang.slice(0, 64) }))).toBe('no refusal');
  });

  it('meta.title: SEED_LIMITS.titleMaxCodeUnits passes and validates, one more is refused', () => {
    const d = plain();
    const titled = (n: number): RenderInput => ({ ...d, result: { ...d.result, meta: { ...d.result.meta, title: 't'.repeat(n) } } });
    const seed = seedOf(frame(titled(SEED_LIMITS.titleMaxCodeUnits)));
    expect(validateSeed(seed).ok).toBe(true);
    expect(refusal(() => frame(titled(SEED_LIMITS.titleMaxCodeUnits + 1)))).toBe('invalid-input');
  });
});

describe("L3.M7 Task 3 the bootstrap bundles seed.ts's validator, not its srcdoc-size formulas (Reference §12 budget)", () => {
  it('none of the size formulas reaches bootstrap.js, and it is within its 32 KiB budget', async () => {
    // bootstrap.js is minified, names included (Task 5), so what it bundles is read from its metafile and from the
    // same build with its names kept (tree shaking is the same either way).
    expect(built.files.bootstrap.inputs).toContain('src/frame/seed.ts');
    const named = await build({ ...scriptOptions('bootstrap'), minifyIdentifiers: false });
    const text = named.outputFiles[0]?.text ?? '';
    expect(text).toContain('function validateSeed(');
    for (const name of ['IMAGE_BUDGET_CHARS', 'SEED_FIELDS_MAX_CHARS', 'seedFieldsMaxChars', 'snapshotMaxChars', 'featuresMaxChars', 'imageBudgetChars', 'appearanceMaxChars', 'fontsMaxChars', 'popShadowLongest', 'SKIN_LONGEST', 'APPEARANCE_SLOTS', 'parseAppearance']) {
      expect(text, name).not.toContain(name);
    }
    expect(built.files.bootstrap.bytes).toBeLessThanOrEqual(32768);
  });
});

describe('the appearance contract: FrameOptions.appearance and FrameAssets.fonts, two optional seed fields', () => {
  /** A woff2 face of `n` decoded bytes: the signature `wOF2` and zeros, as base64. */
  const face = (n: number, signature = 'wOF2'): string => Buffer.concat([Buffer.from(signature, 'latin1'), Buffer.alloc(n - 4)]).toString('base64');
  const withFonts = (fonts: unknown): FrameAssets => ({ ...assets, fonts } as FrameAssets);
  const GOOD = face(2048);
  const FULL = {
    mode: 'dark',
    colour: Object.fromEntries(COLOUR_SLOTS.map((k) => [k, '#0a0b0c'])),
    skin: { radius: ' 6px ', popShadow: '0 12px 40px rgba(0, 0, 0, 0.55)', bogus: 'x' },
    label: 'Appearance follows the app\'s settings',
  };

  it('with neither, the seed has neither key and the srcdoc is the same string as ever (an undefined of each counts as none)', () => {
    const out = frame(plain());
    expect(Object.hasOwn(seedOf(out), 'appearance')).toBe(false);
    expect(Object.hasOwn(seedOf(out), 'fonts')).toBe(false);
    expect(frame(plain(), { appearance: undefined, assets: withFonts(undefined) })).toBe(out);
  });

  it('an appearance is seeded as parseAppearance\'s verdict: its spaces dropped, a refused slot left out, the seed passing the bootstrap\'s validator', () => {
    const seed = seedOf(frame(plain(), { appearance: FULL }));
    const verdict = parseAppearance(FULL).appearance;
    expect(verdict.colour).toBeDefined();
    expect(verdict.skin).toEqual({ radius: '6px', popShadow: '0 12px 40px rgba(0, 0, 0, 0.55)' });
    expect(seed['appearance']).toEqual(verdict);
    expect(validateSeed(seed)).toEqual({ ok: true, seed });
    // A partial colour group is refused whole; the rest of the value stands.
    const partial = seedOf(frame(plain(), { appearance: { mode: 'light', colour: { bg: '#ffffff' }, label: 'x' } }))['appearance'];
    expect(partial).toEqual({ mode: 'light', label: 'x' });
  });

  it('any value given is taken through parseAppearance and never throws: null, a string, an array, a getter, a cycle, a revoked proxy', () => {
    const revoked = Proxy.revocable({}, {});
    revoked.revoke();
    const cyclic: Record<string, unknown> = { mode: 'dark' };
    cyclic['self'] = cyclic;
    const values: [string, unknown][] = [
      ['null', null],
      ['a string', 'dark'],
      ['a number', 7],
      ['an empty array', []],
      ['an array', ['dark']],
      ['a getter', Object.defineProperty({}, 'mode', { get: () => 'dark', enumerable: true })],
      ['a cycle', cyclic],
      ['a revoked proxy', revoked.proxy],
      ['a bigint', { mode: 1n }],
    ];
    for (const [what, value] of values) {
      const out = frame(plain(), { appearance: value });
      const seed = seedOf(out);
      expect(seed['appearance'], what).toEqual(parseAppearance(value).appearance);
      expect(validateSeed(seed).ok).toBe(true);
    }
    expect(seedOf(frame(plain(), { appearance: null }))['appearance']).toEqual({ mode: 'auto' });
  });

  it('two good faces are seeded in role order, whatever order the host wrote them; one face alone is seeded alone', () => {
    const both = seedOf(frame(plain(), { assets: withFonts({ mono: face(4096), sans: GOOD }) }));
    expect(Object.keys(both['fonts'] as object)).toEqual(['sans', 'mono']);
    expect(both['fonts']).toEqual({ sans: GOOD, mono: face(4096) });
    expect(validateSeed(both).ok).toBe(true);
    expect(seedOf(frame(plain(), { assets: withFonts({ mono: GOOD }) }))['fonts']).toEqual({ mono: GOOD });
    expect(seedOf(frame(plain(), { assets: withFonts({ sans: GOOD, mono: undefined }) }))['fonts']).toEqual({ sans: GOOD });
  });

  it('a face outside the base64 alphabet, without the wOF2 signature, or over 131 072 decoded bytes is dropped silently; the other role stays', () => {
    const bad: Record<string, string> = {
      'a character outside the alphabet': `${GOOD.slice(0, 20)}!${GOOD.slice(21)}`,
      'a hyphen (url-safe base64)': `${GOOD.slice(0, 20)}-${GOOD.slice(21)}`,
      'an underscore (url-safe base64)': `${GOOD.slice(0, 20)}_${GOOD.slice(21)}`,
      'a line feed': `${GOOD.slice(0, 20)}\n${GOOD.slice(21)}`,
      'a space': `${GOOD} `,
      'padding in the middle': `${GOOD.slice(0, 8)}==${GOOD.slice(8)}`,
      'three paddings': `${GOOD}===`,
      'wOF1': face(2048, 'wOF1'),
      'a TrueType signature': face(2048, '\u0000\u0001\u0000\u0000'),
      'WOFF': face(2048, 'wOFF'),
      'empty': '',
      'fewer than four bytes': Buffer.from('wOF').toString('base64'),
      'one byte over the cap': face(131073),
      'far over the cap': face(262144),
      // atob refuses each of these, so the frame could not decode them (review of Task 3, finding 2).
      'a length of one more than whole quanta': 'd09GMgAAA',
      'one padding after two characters': 'd09GMg=',
      'two paddings after three characters': 'd09GMgAAA==',
      'the signature cut short': 'd09GM',
    };
    for (const [why, b64] of Object.entries(bad)) {
      for (const role of ['sans', 'mono'] as const) {
        const other = role === 'sans' ? 'mono' : 'sans';
        const seed = seedOf(frame(plain(), { assets: withFonts({ [role]: b64, [other]: GOOD }) }));
        expect(seed['fonts'], `${why} as ${role}`).toEqual({ [other]: GOOD });
      }
      expect(Object.hasOwn(seedOf(frame(plain(), { assets: withFonts({ sans: b64 }) })), 'fonts'), why).toBe(false);
    }
  });

  it('the cap is exact: 131 072 decoded bytes (174 764 characters) is seeded, 131 073 is dropped; the signature may be all a face holds', () => {
    const atCap = face(131072);
    expect(atCap).toHaveLength(SEED_LIMITS.fontFaceMaxChars);
    expect(atCap.endsWith('=')).toBe(true);
    const seed = seedOf(frame(plain(), { assets: withFonts({ sans: atCap, mono: atCap }) }));
    expect(seed['fonts']).toEqual({ sans: atCap, mono: atCap });
    expect(validateSeed(seed).ok).toBe(true);
    expect(Object.hasOwn(seedOf(frame(plain(), { assets: withFonts({ sans: face(131073) }) })), 'fonts')).toBe(false);
    expect(seedOf(frame(plain(), { assets: withFonts({ sans: face(4) }) }))['fonts']).toEqual({ sans: face(4) });
  });

  it('a `fonts` that is not a plain object, has another key, holds a getter or a face that is not a string throws TypeError (never a FrameError)', () => {
    class Faces {
      sans = GOOD;
    }
    for (const fonts of [
      null,
      'wOF2',
      7,
      true,
      [],
      [GOOD],
      new Map(),
      new Faces(),
      Object.create({ sans: GOOD }) as object,
      { serif: GOOD },
      { sans: GOOD, serif: GOOD },
      { sans: GOOD, mono: GOOD, extra: GOOD },
      { [Symbol('s')]: GOOD },
      { sans: 1 },
      { sans: null },
      { sans: ['wOF2'] },
      { sans: Buffer.from(GOOD, 'base64') },
      { mono: { length: 4 } },
      Object.defineProperty({}, 'sans', { get: () => GOOD, enumerable: true }),
      Object.defineProperty({}, 'sans', { get: () => GOOD, enumerable: false }),
    ]) {
      expect(() => frame(plain(), { assets: withFonts(fonts) }), String(Object.prototype.toString.call(fonts))).toThrow(TypeError);
      expect(refusal(() => frame(plain(), { assets: withFonts(fonts) })), String(Object.prototype.toString.call(fonts))).toBe('not a FrameError: TypeError');
    }
    expect(() => frame(plain(), { assets: withFonts({}) })).not.toThrow();
  });

  it('the CSP meta, the policy checks and every other element are the same with an appearance and both faces as without', () => {
    const without = tree(frame(plain())).head.childNodes.filter(isElement);
    const withBoth = tree(frame(plain(), { appearance: FULL, assets: withFonts({ sans: GOOD, mono: GOOD }) })).head.childNodes.filter(isElement);
    expect(withBoth.map((e) => e.tagName)).toEqual(without.map((e) => e.tagName));
    expect(attr(withBoth[0] as Element, 'content')).toBe(attr(without[0] as Element, 'content'));
    for (const i of [1, 3, 4, 5]) expect(textOf(withBoth[i] as Element) === textOf(without[i] as Element), String(i)).toBe(true);
    expect(textOf(withBoth[2] as Element)).not.toBe(textOf(without[2] as Element));
  });

  it("a face and an appearance take exactly their seed text: the srcdoc grows by `,\"appearance\":V` and `,\"fonts\":{...}` and by nothing else", () => {
    const base = frame(plain());
    const verdict = parseAppearance(FULL).appearance;
    const out = frame(plain(), { appearance: FULL, assets: withFonts({ sans: GOOD, mono: face(4096) }) });
    const fonts = { sans: GOOD, mono: face(4096) };
    expect(out.length - base.length).toBe(`,"appearance":${JSON.stringify(verdict)}`.length + `,"fonts":${JSON.stringify(fonts)}`.length);
  });

  it("a hostile appearance or face holds no markup: the seed's text has no `<` and the CSP and element count are unchanged", () => {
    const out = frame(plain(), { appearance: { mode: 'dark', label: '</script><script>x()</script>' }, assets: withFonts({ sans: GOOD }) });
    const kids = tree(out).head.childNodes.filter(isElement);
    expect(kids.map((e) => e.tagName)).toEqual(['meta', 'script', 'script', 'script', 'style', 'script']);
    expect(seedText(out)).not.toMatch(/[<>&]/);
    expect(seedOf(out)['appearance']).toEqual({ mode: 'dark', label: '</script><script>x()</script>' });
  });
});

describe('the appearance contract: the derived srcdoc cap rises by both fields at their caps (section 2.2)', () => {
  /** SEED_FIELDS_MAX_CHARS at 1.1.0 (the commit aceb346's src/frame/seed.ts, evaluated): neither field was counted. */
  const SEED_FIELDS_MAX_CHARS_1_1_0 = 45768624;

  it('SEED_FIELDS_MAX_CHARS, and so MAX_SRCDOC_CHARS_DEFAULT, is 1.1.0\'s plus 2 x 174764 + the largest appearance text + the keys\' own characters (the two bridge members of the parity wire among them)', () => {
    const faces = 2 * 174764;
    expect(faces).toBe(349528);
    // `,"appearance":V` and `,"fonts":{"sans":"F","mono":"F"}`, the parity wire's two bridge members (the cap counts a switch as `false`),
    // and the items (Task 4): `,"items":` and 50 links of a 100-unit value and a 4096-unit href, each character of the six `\u003c` writes.
    const items = JSON.stringify(Array.from({ length: 50 }, () => ({ value: '<'.repeat(100), href: '<'.repeat(4096) }))).replace(/</g, '\\u003c');
    const keys = `,"appearance":`.length + `,"fonts":{"sans":"","mono":""}`.length + `,"places":false`.length + `,"printFigures":false`.length + `,"items":`.length + items.length;
    const rise = faces + MAXIMAL_APPEARANCE_TEXT().length + keys;
    expect(SEED_FIELDS_MAX_CHARS - SEED_FIELDS_MAX_CHARS_1_1_0).toBe(rise);
    const assetChars = Object.values(FRAME_MANIFEST).reduce((n, a) => n + a.chars, 0);
    const skeletonAndRest = MAX_SRCDOC_CHARS_DEFAULT - (SEED_HTML_MAX_CHARS + assetChars + IMAGE_BUDGET_CHARS + SEED_FIELDS_MAX_CHARS);
    expect(skeletonAndRest).toBeGreaterThan(CSP_MAX_CHARS);
    expect(MAX_SRCDOC_CHARS_DEFAULT - (SEED_HTML_MAX_CHARS + assetChars + IMAGE_BUDGET_CHARS + SEED_FIELDS_MAX_CHARS_1_1_0 + skeletonAndRest)).toBe(rise);
  });

  it("a srcdoc with both faces at the cap and the largest appearance, and the rest of the seed at its smallest, is within the cap with the html's whole share to spare", () => {
    const atCap = Buffer.concat([Buffer.from('wOF2'), Buffer.alloc(131072 - 4)]).toString('base64');
    const appearance = JSON.parse(MAXIMAL_APPEARANCE_TEXT().replace(/\\u003c/g, '<')) as unknown;
    const out = frame(plain(), { appearance, assets: { ...assets, fonts: { sans: atCap, mono: atCap } } as FrameAssets });
    expect(out.length).toBeLessThanOrEqual(MAX_SRCDOC_CHARS_DEFAULT - SEED_HTML_MAX_CHARS - IMAGE_BUDGET_CHARS);
    const seed = seedOf(out);
    expect(seed['appearance']).toEqual(parseAppearance(appearance).appearance);
    expect(Object.keys(seed['fonts'] as object)).toEqual(['sans', 'mono']);
  });
});

describe('L3.M8 Mermaid off', () => {
  it('mermaid null or absent: no Mermaid script (no empty one either), and the seed says null', () => {
    for (const out of [frame(plain()), frame(plain(), { mermaid: null, assets: withMermaid() })]) {
      const kids = tree(out).head.childNodes.filter(isElement);
      expect(kids).toHaveLength(6);
      expect(kids.filter((e) => e.tagName === 'script')).toHaveLength(4);
      expect(out).not.toContain('<script></script>');
      expect(out.endsWith(`<script>${assets.enhance}</script>`)).toBe(true);
      expect(seedOf(out)['mermaid']).toBeNull();
    }
  });
});

describe('L3.M9 pure: the same string for the same inputs, in an empty VM context too', () => {
  it('two calls with equal inputs give the same string', () => {
    expect(frame(DOCS['details and footnotes']?.() as RenderInput, { assets: withMermaid(), mermaid: {} })).toBe(
      frame(DOCS['details and footnotes']?.() as RenderInput, { assets: withMermaid(), mermaid: {} }),
    );
  });

  it('bundled for a platform with no host, it runs in an empty VM context and gives the same string and the same refusals', () => {
    const out = buildSync({
      stdin: { contents: "export * from './src/frame/index.ts';\n", resolveDir: ROOT, loader: 'ts', sourcefile: 'frame-entry.ts' },
      bundle: true,
      format: 'iife',
      globalName: 'F',
      platform: 'neutral',
      target: 'es2022',
      write: false,
      logLevel: 'silent',
    });
    const realm = vm.createContext(Object.create(null));
    vm.runInContext(out.outputFiles[0]?.text ?? '', realm, { filename: 'frame.bundle.js' });
    expect(vm.runInContext("['process','require','Buffer','crypto','window','self','document','setTimeout','TextEncoder'].filter((n) => typeof globalThis[n] !== 'undefined')", realm)).toEqual([]);
    const r = plain();
    const o = { csp: frameCsp(), nonce: NONCE, assets };
    const there = (opts: object): unknown =>
      vm.runInContext(
        `(() => { try { return F.frameDocument(${JSON.stringify(r)}, ${JSON.stringify(opts)}); } catch (e) { return 'refused ' + e.code; } })()`,
        realm,
      );
    expect(there(o)).toBe(frameDocument(r, o));
    expect(there({ ...o, nonce: 'A'.repeat(32) })).toBe('refused nonce');
    expect(there({ ...o, prefs: { theme: 'sepia' } })).toBe('refused invalid-input');
  });
});

describe('L3.M1/M2 the frame mutants: the clean template is this version\'s frameDocument output, and every mutant fails its row with the real texts', () => {
  const DIR = path.join(ROOT, 'conformance', 'frame-mutants');
  const values = (): Record<PlaceholderName, string> => ({ csp: frameCsp(), ...assets, mermaid: mermaidText });
  const fixture = (): string => {
    const r = render(FIXTURE_MARKDOWN);
    expect(r.outcome).toBe('rendered');
    return frameDocument(
      { result: { outcome: 'rendered', html: r.html, meta: { title: r.meta.title, frontList: r.meta.frontList } } },
      { csp: frameCsp(), nonce: FIXTURE_NONCE, assets: withMermaid(), mermaid: {} },
    );
  };

  it('clean.html is the fixture\'s srcdoc with the policy and each asset as its placeholder (UPDATE_FRAME_MUTANTS=1 rewrites it)', () => {
    const template = templateOf(fixture(), values());
    if (updateRequested(process.env)) writeFileSync(path.join(DIR, 'clean.html'), template);
    expect(readFileSync(path.join(DIR, 'clean.html'), 'utf8')).toBe(template);
    expect(expand(template, values())).toBe(fixture());
  });

  it('the fixture\'s srcdoc, the real clean output, passes every scan', () => {
    for (const [row, scan] of Object.entries(SCANS)) expect(scan(fixture()), row).toEqual([]);
  });

  it('every mutant, expanded with the real texts, fails the scan of its row', () => {
    const clean = readFileSync(path.join(DIR, 'clean.html'), 'utf8');
    for (const m of MUTANTS) expect(SCANS[m.row](expand(m.make(clean), values())), m.file).not.toEqual([]);
  });
});

describe('L3.M13 and L3.M5 byte rules', () => {
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

describe('L3.M14 hash agreement', () => {
  const json = (): { files: { path: string; sha256: string; csp?: string }[] } =>
    JSON.parse(readFileSync(path.join(ROOT, 'assets', 'assets.json'), 'utf8')) as { files: { path: string; sha256: string; csp?: string }[] };

  for (const name of ['guard', 'bootstrap', 'enhance'] as const) {
    it(`${name}: frameCsp's hash, assets.json's sha256 and the hash of the element text in the srcdoc agree`, () => {
      const policy = frameCsp();
      const entry = json().files.find((f) => f.path === FRAME_MANIFEST[name].path);
      if (entry === undefined) throw new Error(`assets.json does not list ${name}`);
      const fromJson = `'sha256-${hexToBase64(entry.sha256)}'`;
      const out = frame(plain());
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

describe('L3.M15 reproducibility', () => {
  it('two in-memory builds give byte-identical outputs', async () => {
    const again = await buildFrame();
    await stop();
    for (const name of ['guard', 'bootstrap', 'enhance', 'css'] as const) expect(again.files[name].text).toBe(built.files[name].text);
    expect(again.assetsJson).toBe(built.assetsJson);
    expect(again.manifestTs).toBe(built.manifestTs);
  }, 300_000);

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
  }, 300_000);
});

describe('L3.M8 Mermaid in the skeleton (the prototype\'s P7)', () => {
  it('mermaid on: the Mermaid script follows enhance, and the seed carries the caps', () => {
    const out = frame(plain(), { assets: withMermaid(), mermaid: { maxEdges: 500 } });
    const kids = tree(out).head.childNodes.filter(isElement);
    expect(kids.map((e) => e.tagName)).toEqual(['meta', 'script', 'script', 'script', 'style', 'script', 'script']);
    expect(textOf(kids[6] as Element)).toBe(mermaidText);
    expect((JSON.parse(textOf(kids[2] as Element)) as { mermaid: unknown }).mermaid).toEqual({ maxEdges: 500, secure: [], draw: 'auto' });
  });
  it('mermaid on without assets.mermaid: missing-asset; with a flipped byte: asset-mismatch', () => {
    expect(refusal(() => frame(plain(), { mermaid: {} }))).toBe('missing-asset');
    expect(refusal(() => frame(plain(), { mermaid: {}, assets: { ...assets, mermaid: `${mermaidText.slice(0, 10)}~${mermaidText.slice(11)}` } }))).toBe('asset-mismatch');
  });
  it("'after-ready' (B3.1): no Mermaid script, no assets.mermaid needed, the seed says so", () => {
    const out = frame(plain(), { mermaid: { draw: 'after-ready' } });
    const kids = tree(out).head.childNodes.filter(isElement);
    expect(kids.map((e) => e.tagName)).toEqual(['meta', 'script', 'script', 'script', 'style', 'script']);
    expect(out.endsWith(`<script>${assets.enhance}</script>`)).toBe(true);
    expect(seedOf(out)['mermaid']).toEqual({ secure: [], draw: 'after-ready' });
    // The policy still lists Mermaid's hash: the late script is allowed by it, and by nothing wider.
    expect(frameCsp()).toContain(FRAME_MANIFEST.mermaid.csp);
    // A supplied build is verified all the same, and never inlined: the srcdoc is the one without it.
    const supplied = frame(plain(), { assets: withMermaid(), mermaid: { draw: 'after-ready' } });
    expect(supplied).toBe(out);
    expect(supplied).not.toContain(mermaidText);
    expect(refusal(() => frame(plain(), { assets: { ...assets, mermaid: `${mermaidText.slice(0, 10)}~${mermaidText.slice(11)}` }, mermaid: { draw: 'after-ready' } }))).toBe('asset-mismatch');
  });
  it("'after-ready' (B3.1): the inline modes still inline the build and still need it", () => {
    for (const draw of ['auto', 'on-request'] as const) {
      const out = frame(plain(), { assets: withMermaid(), mermaid: { draw } });
      expect(out, draw).toContain(mermaidText);
      expect(refusal(() => frame(plain(), { mermaid: { draw } })), draw).toBe('missing-asset');
    }
  });
  it("'after-ready' (B3.2): a policy lacking Mermaid's hash is refused with missing-hash, as in the inline modes", () => {
    const csp = frameCsp().replace(` ${FRAME_MANIFEST.mermaid.csp}`, '');
    expect(csp).not.toContain(FRAME_MANIFEST.mermaid.csp);
    const why = (draw: 'auto' | 'on-request' | 'after-ready'): string => {
      try {
        frameDocument(plain(), { csp, nonce: NONCE, assets: withMermaid(), mermaid: { draw } });
      } catch (e) {
        return e instanceof FrameError ? `${e.code}: ${e.message}` : 'not a FrameError';
      }
      return 'no refusal';
    };
    for (const draw of ['auto', 'on-request', 'after-ready'] as const) expect(why(draw), draw).toMatch(/^csp: .*missing-hash/);
    // The hash is required with no build supplied at all, too: 'after-ready' needs no text, never a weaker policy.
    expect(refusal(() => frame(plain(), { csp, mermaid: { draw: 'after-ready' } }))).toBe('csp');
    // Mermaid off: the hash is not required (the existing M6 case).
    expect(refusal(() => frame(plain(), { csp }))).toBe('no refusal');
  });
  it('the Mermaid frame file passes the byte rules and carries no ELK and no free require', () => {
    expect(rules.scriptHazards(mermaidText)).toEqual([]);
    expect(mermaidText).not.toContain('org.eclipse.elk');
    expect(mermaidText).not.toMatch(/\(void 0\)\(/);
    expect(frameCsp()).toContain(FRAME_MANIFEST.mermaid.csp);
  });
});

describe('the resolved item links (docserver parity, Task 4): FrameOptions.items, an optional seed field judged in full here', () => {
  const link = (i = 1): { value: string; href: string } => ({ value: `AB-${String(i)}`, href: `https://tracker.example/AB-${String(i)}` });
  const links = (n: number): { value: string; href: string }[] => Array.from({ length: n }, (_, i) => link(i + 1));
  const bad = (items: unknown): string => refusal(() => frame(plain(), { items: items as NonNullable<FrameOptions['items']> }));

  it('seeds the links as given, in order, and with none the srcdoc is the one without the option, byte for byte', () => {
    const out = frame(plain(), { items: [link(2), link(1)] });
    expect(seedOf(out)['items']).toEqual([link(2), link(1)]);
    const without = frame(plain());
    expect(Object.hasOwn(seedOf(without), 'items')).toBe(false);
    for (const none of [undefined, []]) expect(frame(plain(), { items: none as NonNullable<FrameOptions['items']> }), String(none)).toBe(without);
  });

  it('takes at most 50 links: 50 are seeded, 51 are refused invalid-input (P4b at the seed)', () => {
    expect(seedOf(frame(plain(), { items: links(50) }))['items']).toHaveLength(50);
    expect(bad(links(51))).toBe('invalid-input');
    expect(bad(links(600))).toBe('invalid-input');
  });

  it('takes a value of 1 to 100 code units: 1 and 100 are seeded, 0 and 101 are refused', () => {
    for (const n of [1, 100]) expect(refusal(() => frame(plain(), { items: [{ value: 'V'.repeat(n), href: 'https://x.example/' }] })), String(n)).toBe('no refusal');
    for (const n of [0, 101]) expect(bad([{ value: 'V'.repeat(n), href: 'https://x.example/' }]), String(n)).toBe('invalid-input');
  });

  it('takes an absolute https: URL of at most 4096 code units: `https:` passes; `http:`, other schemes, relative and malformed hrefs are refused (P4c at the seed)', () => {
    const host = 'https://tracker.example/';
    for (const href of [host, 'https://tracker.example', `${host}a?b=c#d`, 'HTTPS://tracker.example/x', `${host}${'p'.repeat(4096 - host.length)}`]) {
      expect(refusal(() => frame(plain(), { items: [{ value: 'AB-1', href }] })), href.slice(0, 40)).toBe('no refusal');
    }
    const refused = [
      'http://tracker.example/AB-1',
      'javascript:alert(1)',
      'data:text/html,x',
      'ftp://tracker.example/',
      '//tracker.example/AB-1',
      '/AB-1',
      'AB-1',
      '',
      'https:',
      'https://',
      'https:///path',
      'https://user@tracker.example/',
      'https://user:pw@tracker.example/',
      'https://tracker.example/ x',
      'https://tracker.example/ x',
      'https://tracker.example/﻿x',
      'https://tracker.example/\u0000',
      'https://tracker.example/\u007f',
      'https://tracker.example/\u0085',
      'https://tracker.example/\\x',
      'https://tracker.example\\x',
      ' https://tracker.example/',
      'https://tracker.example/\n',
      `${host}${'p'.repeat(4097 - host.length)}`,
    ];
    for (const href of refused) expect(bad([{ value: 'AB-1', href }]), JSON.stringify(href).slice(0, 50)).toBe('invalid-input');
  });

  it('takes plain data only: a list of plain { value, href } objects; a getter, a class, extra or missing keys, a non-string are refused', () => {
    expect(bad('AB-1')).toBe('invalid-input');
    expect(bad({ 0: link() })).toBe('invalid-input');
    expect(bad(null)).toBe('invalid-input');
    expect(bad([null])).toBe('invalid-input');
    expect(bad([['AB-1', 'https://x.example/']])).toBe('invalid-input');
    expect(bad([{ value: 'AB-1' }])).toBe('invalid-input');
    expect(bad([{ ...link(), extra: 'x' }])).toBe('invalid-input');
    expect(bad([{ value: 1, href: 'https://x.example/' }])).toBe('invalid-input');
    expect(bad([{ value: 'AB-1', href: undefined }])).toBe('invalid-input');
    expect(bad([{ value: 'AB-1', get href() { return 'https://x.example/'; } }])).toBe('invalid-input');
    class Link { value = 'AB-1'; href = 'https://x.example/'; }
    expect(bad([new Link()])).toBe('invalid-input');
    expect(bad([{ value: 'AB-1', href: 'https://x.example/', ['__proto__']: 1 }])).toBe('invalid-input');
    // A value is data the seed carries, never markup: it is escaped like every field.
    const hostile = frame(plain(), { items: [{ value: '</script><script>x()</script>', href: 'https://x.example/?a=<b>&c' }] });
    expect(hostile).not.toContain('</script><script>x()');
    expect(seedOf(hostile)['items']).toEqual([{ value: '</script><script>x()</script>', href: 'https://x.example/?a=<b>&c' }]);
  });

  it('copies the list once: a later change by the host reaches no seed, and the host\'s own list is not changed', () => {
    const own = [link()];
    const out = frame(plain(), { items: own });
    own[0] = { value: 'ZZ-9', href: 'https://elsewhere.example/' };
    expect(seedOf(out)['items']).toEqual([link()]);
  });

  it('the seed with items is judged by the bootstrap\'s own validator, whose outer check it passes', () => {
    const check = validateSeed({ ...seedOf(frame(plain(), { items: links(50) })) });
    expect(check.ok).toBe(true);
  });
});
