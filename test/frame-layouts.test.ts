// Layout infrastructure (docserver parity Task 9; plan Design B11 and B12, Task 9): one frame, one layout, one policy.
// scripts/build-frame.mjs builds one enhance bundle per layout from the default's entry, with one plugin that substitutes only the
// lifecycle's feature list (scripts/layout-plugin.mjs), and each layout's own stylesheet as its own frame asset; frameCsp(layout),
// frameDocument's `layout` and `assets.layoutCss`, maxSrcdocChars(layout) and ./host's `layout` carry the choice.
//
// The assets are built in memory, as test/frame-document.test.ts builds them, and checked against the committed
// src/frame/manifest.generated.ts. What this file pins, in order:
//  1. The layout table: the build's names, the library's, the manifest's marks and the files they name, held equal.
//  2. The default frame, unmoved (the orchestrator's rulings R1 and the coordinator's srcdoc pin): the sha256 of the five entries
//     the default frame inlines, frameCsp() and the default srcdoc of two fixed documents, each against a literal that was measured
//     at Landing A's merge (1c2120d), before B1; `layout` absent and `layout: 'default'` give
//     that string, byte for byte.
//  3. The bundles: one per layout, distinct, marked in both manifests, built from the default's options and entry with one plugin.
//  4. Each layout's srcdoc inlines only its own bundle and stylesheet, in the default's element order.
//  5. `assets.layoutCss`: required where the layout has a stylesheet, refused where it has none, verified against the entry.
//  6. maxSrcdocChars(layout): derived per layout, bounding the option, and test 7's old-cap row run under every layout.
//  7. The build's checks hold every layout asset to the byte rules, the free-global list and the budgets.
// The policy's rows are test/frame-csp.test.ts's and test/frame-boundaries.test.ts's, the host's are test/host-mount.test.ts's, the
// feature lists' are test/enhance-layouts.test.ts's, and the size contract's layout row is test/size-rules.test.ts's.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, stop } from 'esbuild';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  buildFrame,
  byteRules,
  checkOutputs,
  FRAME_FILES,
  layoutOfAsset,
  layoutScriptOptions,
  LAYOUT_TABLE,
  scriptOptions,
  STYLE_JOIN,
  type Bundle,
  type BuiltFrame,
  type FrameAssetName,
} from '../scripts/build-frame.mjs';
import { layoutPlugin } from '../scripts/layout-plugin.mjs';
import { APPEARANCE_SLOTS } from '../src/enhance/appearance.js';
import { frameCsp } from '../src/frame/csp.js';
import { CSP_MAX_CHARS } from '../src/frame/csp-rules.js';
import {
  FrameError,
  frameDocument,
  FRAME_LAYOUTS,
  FRAME_MANIFEST,
  isFrameLayout,
  MAX_SRCDOC_CHARS_DEFAULT,
  maxSrcdocChars,
  type FrameAssets,
  type FrameLayout,
  type FrameOptions,
  type RenderInput,
} from '../src/frame/index.js';
import { LAYOUT_ENTRIES } from '../src/frame/layouts.js';
import { IMAGE_BUDGET_CHARS, SEED_FIELDS_MAX_CHARS, SEED_HTML_MAX_CHARS } from '../src/frame/seed.js';
import { render } from '../src/render/index.js';
import { oldCapDocument } from './frame-old-cap.js';
import { attr, isElement, SCANS, textOf, tree, type Element } from './frame-scans.js';
import { layoutSizes, parseManifest, sizesOf } from './size-rules.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const OWN = FRAME_LAYOUTS.filter((l): l is Exclude<FrameLayout, 'default'> => l !== 'default');
const NONCE = 'a'.repeat(32);

let built: BuiltFrame;
let mermaidText: string;

beforeAll(async () => {
  built = await buildFrame();
  await byteRules();
  mermaidText = built.files.mermaid.text;
  // The build's esbuild service keeps the memory of the Mermaid bundle until it stops; a later call starts it again.
  await stop();
}, 300_000);

/** The assets of `layout`'s frame: the shared three, the layout's bundle and, when it has one, its stylesheet. */
function assetsFor(layout: FrameLayout, mermaid = false): FrameAssets {
  const e = LAYOUT_ENTRIES[layout];
  return {
    guard: built.files.guard.text,
    bootstrap: built.files.bootstrap.text,
    enhance: built.files[e.enhance].text,
    css: built.files.css.text,
    ...(e.css === null ? {} : { layoutCss: built.files[e.css].text }),
    ...(mermaid ? { mermaid: mermaidText } : {}),
  };
}

function input(md: string): RenderInput {
  const r = render(md);
  if (r.outcome !== 'rendered') throw new Error(`did not render (${r.outcome})`);
  return { result: { outcome: r.outcome, html: r.html, meta: { title: r.meta.title, frontList: r.meta.frontList } } };
}

const FIXTURE = '# Title\n\nSome text with a [link](https://example.test/) and `code`.\n\n## Part\n\n| a | b |\n|---|---|\n| 1 | 2 |\n';
const plain = (): RenderInput => input(FIXTURE);

/** frameDocument for `layout` with its own assets and policy, `over` on top. */
const frameOf = (layout: FrameLayout | undefined, over: Partial<FrameOptions> = {}, doc: RenderInput = plain()): string =>
  frameDocument(doc, { csp: frameCsp(layout), nonce: NONCE, assets: assetsFor(layout ?? 'default'), ...(layout === undefined ? {} : { layout }), ...over });

/** The FrameError code `fn` throws, 'no refusal', or the name of any other error. */
function refusal(fn: () => unknown): string {
  try {
    fn();
  } catch (e) {
    if (e instanceof FrameError) return e.code;
    return `not a FrameError: ${e instanceof Error ? e.name : String(e)}`;
  }
  return 'no refusal';
}

const sha = (s: string): string => createHash('sha256').update(s).digest('hex');

// ───────── 1. the layout table ─────────

describe('the layout table: the build\'s names, the library\'s and the manifest\'s are one set', () => {
  it('LAYOUT_TABLE names exactly FRAME_LAYOUTS, in order, and src/frame/layouts.ts names the same manifest entries', () => {
    expect(Object.keys(LAYOUT_TABLE)).toEqual([...FRAME_LAYOUTS]);
    for (const l of FRAME_LAYOUTS) {
      expect(LAYOUT_TABLE[l].enhance, `${l} bundle`).toBe(LAYOUT_ENTRIES[l].enhance);
      expect(LAYOUT_TABLE[l].css, `${l} stylesheet`).toBe(LAYOUT_ENTRIES[l].css);
    }
    expect(Object.keys(LAYOUT_ENTRIES)).toEqual([...FRAME_LAYOUTS]);
    // `default` is built with no substitution and has no stylesheet of its own; every other layout has both.
    expect(LAYOUT_TABLE.default).toMatchObject({ features: null, source: null, css: null, stylesheet: null, bundle: 'frame/enhance.js' });
    for (const l of OWN) {
      expect(LAYOUT_TABLE[l]).toEqual({
        enhance: `enhance${l.charAt(0).toUpperCase()}${l.slice(1)}`,
        css: `css${l.charAt(0).toUpperCase()}${l.slice(1)}`,
        features: `src/enhance/layouts/${l}/features.ts`,
        source: `assets/layouts/${l}.css`,
        bundle: `frame/enhance-${l}.js`,
        stylesheet: `frame/layout-${l}.css`,
      });
    }
  });

  it('isFrameLayout accepts exactly the names of FRAME_LAYOUTS', () => {
    for (const l of FRAME_LAYOUTS) expect(isFrameLayout(l), l).toBe(true);
    for (const bad of ['', 'Default', ' default', 'classic ', 'toString', '__proto__', 'constructor', 'plain', null, undefined, 0, {}, ['classic'], Symbol('default')]) {
      expect(isFrameLayout(bad), String(typeof bad)).toBe(false);
    }
  });

  it('every manifest entry is marked with the layout whose entries name it, and nothing else is marked', () => {
    const owner = new Map<string, FrameLayout>();
    for (const l of FRAME_LAYOUTS) {
      owner.set(LAYOUT_ENTRIES[l].enhance, l);
      const css = LAYOUT_ENTRIES[l].css;
      if (css !== null) owner.set(css, l);
    }
    for (const [name, entry] of Object.entries(FRAME_MANIFEST)) {
      expect(entry.layout, name).toBe(owner.get(name) ?? null);
      expect(layoutOfAsset(name), name).toBe(owner.get(name) ?? null);
    }
    // Its scripts, hashed: the guard, the bootstrap, Mermaid's and one bundle per layout; a stylesheet has no hash source.
    expect(Object.entries(FRAME_MANIFEST).filter(([, e]) => e.csp !== null).map(([n]) => n).sort()).toEqual(
      ['bootstrap', 'enhance', 'enhanceClassic', 'enhanceEditorial', 'enhanceGuided', 'enhanceReview', 'guard', 'mermaid'],
    );
    for (const l of OWN) expect(FRAME_MANIFEST[LAYOUT_ENTRIES[l].css as 'cssClassic'].csp).toBeNull();
  });

  it("the size rules (test 8, test/size-rules.ts) read each layout's assets by the mark: a layout is its bundle and its stylesheet, `frame` is the default frame's, and an unmarked layout asset is seen", () => {
    const text = readFileSync(path.join(ROOT, 'src', 'frame', 'manifest.generated.ts'), 'utf8');
    const manifest = parseManifest(text);
    const sizes = layoutSizes(manifest);
    expect(Object.keys(sizes).sort()).toEqual([...FRAME_LAYOUTS].sort());
    expect(sizes['default']).toBe(FRAME_MANIFEST.enhance.chars);
    for (const l of OWN) {
      const e = LAYOUT_ENTRIES[l];
      expect(sizes[l], l).toBe(FRAME_MANIFEST[e.enhance].chars + FRAME_MANIFEST[e.css as 'cssClassic'].chars);
    }
    // `frame` is the entries no layout owns plus the largest layout, the default's bundle: what landing A's frame was, so test 8's
    // `frame` does not move for the layouts, while `total` is every entry.
    const { total, frame } = sizesOf(manifest);
    expect(frame).toBe(FRAME_MANIFEST.guard.chars + FRAME_MANIFEST.bootstrap.chars + FRAME_MANIFEST.css.chars + FRAME_MANIFEST.mermaid.chars + FRAME_MANIFEST.enhance.chars);
    expect(total).toBe(Object.values(FRAME_MANIFEST).reduce((n, a) => n + a.chars, 0));
    // A layout asset left unmarked in the text is no layout's: its layout's size drops by its characters, and a layout row of the
    // contract that reads the sizes would see the miscount.
    const unmarked = text.replace(/(enhanceEditorial: \{[^\n]*layout: )"editorial"/, '$1null');
    expect(unmarked).not.toBe(text);
    expect(layoutSizes(parseManifest(unmarked))['editorial']).toBe(FRAME_MANIFEST.cssEditorial.chars);
  });

  it('assets.json marks every layout asset with its layout in the same way: the bundles, the stylesheets and the tracked sources', () => {
    const json = JSON.parse(built.assetsJson) as { files: { path: string; layout?: string; csp?: string; kind: string }[] };
    const byPath = new Map(json.files.map((f) => [f.path, f]));
    expect(byPath.get('frame/enhance.js')?.layout).toBe('default');
    for (const l of OWN) {
      for (const p of [LAYOUT_TABLE[l].bundle, LAYOUT_TABLE[l].stylesheet, `layouts/${l}.css`]) {
        expect(byPath.get(p as string)?.layout, p as string).toBe(l);
      }
      expect(byPath.get(LAYOUT_TABLE[l].bundle)?.csp, `${l} bundle`).toBe(FRAME_MANIFEST[LAYOUT_ENTRIES[l].enhance].csp);
      expect(byPath.get(LAYOUT_TABLE[l].stylesheet as string)?.csp, `${l} stylesheet`).toBeUndefined();
      expect(byPath.get(LAYOUT_TABLE[l].stylesheet as string)?.kind).toBe('style');
    }
    // No other file carries a layout.
    const marked = json.files.filter((f) => f.layout !== undefined).map((f) => f.path).sort();
    expect(marked).toEqual(
      ['frame/enhance.js', ...OWN.flatMap((l) => [LAYOUT_TABLE[l].bundle, LAYOUT_TABLE[l].stylesheet as string, `layouts/${l}.css`])].sort(),
    );
    // The committed copy is this build's (frame-build.test.ts holds the whole listing equal).
    expect(readFileSync(path.join(ROOT, 'assets', 'assets.json'), 'utf8')).toBe(built.assetsJson);
  });

  it('each layout\'s feature list and stylesheet source are files, and its built stylesheet is its source\'s text', () => {
    for (const l of OWN) {
      expect(existsSync(path.join(ROOT, LAYOUT_TABLE[l].features as string)), `${l} features`).toBe(true);
      const source = readFileSync(path.join(ROOT, LAYOUT_TABLE[l].source as string), 'utf8');
      expect(built.files[LAYOUT_ENTRIES[l].css as 'cssClassic'].text === source, `${l} stylesheet`).toBe(true);
      expect(FRAME_FILES[LAYOUT_ENTRIES[l].css as 'cssClassic']).toBe(LAYOUT_TABLE[l].stylesheet);
      expect(FRAME_FILES[LAYOUT_ENTRIES[l].enhance]).toBe(LAYOUT_TABLE[l].bundle);
    }
    expect(Object.keys(FRAME_FILES)).toEqual([
      'guard', 'bootstrap', 'enhance', 'css', 'mermaid',
      'enhanceClassic', 'cssClassic', 'enhanceEditorial', 'cssEditorial', 'enhanceReview', 'cssReview', 'enhanceGuided', 'cssGuided',
    ]);
  });
});

// ───────── 2. the default frame, unmoved ─────────

/**
 * The five entries the default frame inlines, as Landing A's merge (1c2120d) records them: the sha256 of
 * each asset's text. Literals on purpose: a layout, its plugin or any change of the build must leave every one in place (the
 * orchestrator's ruling R1), and a test that read them from the manifest it checks could not tell.
 */
const DEFAULT_SHA256: Readonly<Record<'guard' | 'bootstrap' | 'enhance' | 'css' | 'mermaid', string>> = {
  guard: 'ff3c25da5703bc06d40ca0412b2e760c619a73a4153306f4d0f3b662bda65c4d',
  bootstrap: '47d310d29e5eb9487b66a8250ebddacbb15392cc6380b9424dd03cb33cc76d3d',
  enhance: 'cc9613b7ed73b16789fee72a4b7263d9071bfbd143a16acaef1ea682b52670fe',
  css: '367c2b55a35c4907c9aa775ce8a3c389b0f8bd38c0f9e1ed51f634d225a881a2',
  mermaid: '7585b2055ba386b9acff71b9c8a0c40b36dec79c2106a4aa56048c8fe59832c3',
};

/** frameCsp() at landing A, whole. */
const DEFAULT_CSP =
  "default-src 'none'; script-src 'sha256-/zwl2lcDvAbUDKBBKy52DGGac6QVMwb00PO2Yr2mXE0=' 'sha256-R9MQ0p5euUh7ZqglDr3ay7FTksxjgLlCTdA8szzHbT0=' " +
  "'sha256-zJYTt+1zsWeJ/ucqS3Jj2Qcb+9FDoWrK7x6mgrUmcP4=' 'sha256-dYWyBVujhrms/3G5yKDECzbex5whBqSqVgSMj+WYMsM='; " +
  "style-src 'unsafe-inline' data:; font-src data:; img-src data:; base-uri 'none'; form-action 'none'";

/**
 * The default srcdoc of two fixed renders at landing A's code, measured before this task changed anything (the same render
 * results, nonces, options and assets): the sha256 of the string and its length. `plain` is FIXTURE with nonce `a`x32 and no option
 * but the policy and the assets; `rich` is the same document with Mermaid on, rules and no keyboard, a dark theme, and `progress`
 * and `places` on, nonce `b`x32.
 */
const DEFAULT_SRCDOC = {
  plain: { sha256: 'c7c1a4bac6ac17a4361705e6b75bef8b7a8cac37a47fd374c833d9e6da6e969a', length: 826006 },
  rich: { sha256: 'c4c5ecd6da199b3bba4e6c47209c3827fce37456b3f229c0a9f160d80da91fd9', length: 4573027 },
} as const;

/** The two default srcdocs, with `layout` as given (undefined: the option left out). */
function defaultSrcdocs(layout: FrameLayout | undefined): { plain: string; rich: string } {
  const named = layout === undefined ? {} : { layout };
  const plainDoc = frameDocument(plain(), { csp: frameCsp(), nonce: NONCE, assets: assetsFor('default'), ...named });
  const richDoc = frameDocument(plain(), {
    csp: frameCsp(),
    nonce: 'b'.repeat(32),
    assets: assetsFor('default', true),
    mermaid: {},
    features: { rules: true, keyboard: false },
    prefs: { theme: 'dark' },
    bridge: { progress: true, places: true },
    ...named,
  });
  return { plain: plainDoc, rich: richDoc };
}

describe('the default frame is unmoved by the layouts (R1)', () => {
  it('the five assets the default frame inlines have the sha256 landing A built, in the build and in the committed manifest', () => {
    for (const name of ['guard', 'bootstrap', 'enhance', 'css', 'mermaid'] as const) {
      expect(built.files[name].sha256, `${name} built`).toBe(DEFAULT_SHA256[name]);
      expect(FRAME_MANIFEST[name].sha256, `${name} manifest`).toBe(DEFAULT_SHA256[name]);
      expect(sha(built.files[name].text), `${name} text`).toBe(DEFAULT_SHA256[name]);
    }
    // The default enhance bundle's size, which the layouts are measured against (test 8's layout row).
    expect(FRAME_MANIFEST.enhance.chars).toBe(225709);
    expect(FRAME_MANIFEST.enhance.layout).toBe('default');
  });

  it('the default bundle is built with no plugin and the options it always had: a layout\'s options are those plus the one plugin', () => {
    expect(Object.hasOwn(scriptOptions('enhance'), 'plugins')).toBe(false);
    for (const l of OWN) {
      const { plugins, ...rest } = layoutScriptOptions(l);
      expect(plugins, l).toHaveLength(1);
      expect(rest, l).toEqual(scriptOptions('enhance'));
    }
  });

  it('frameCsp() is landing A\'s policy, byte for byte, and frameCsp(\'default\') is it', () => {
    expect(frameCsp()).toBe(DEFAULT_CSP);
    expect(frameCsp('default')).toBe(DEFAULT_CSP);
    expect(frameCsp()).toBe(frameCsp('default'));
  });

  it('MAX_SRCDOC_CHARS_DEFAULT is maxSrcdocChars(\'default\'), and keeps landing A\'s value', () => {
    expect(MAX_SRCDOC_CHARS_DEFAULT).toBe(maxSrcdocChars('default'));
    expect(maxSrcdocChars()).toBe(MAX_SRCDOC_CHARS_DEFAULT);
    // Its value at landing A: the html cap, the five assets, the images, the seed fields at their caps and the skeleton (measured with
    // the tree at 1c2120d's formula: test/frame-document.test.ts derives it from those sources and measures the skeleton on a srcdoc).
    expect(MAX_SRCDOC_CHARS_DEFAULT).toBe(116_224_259);
    const five = FRAME_MANIFEST.guard.chars + FRAME_MANIFEST.bootstrap.chars + FRAME_MANIFEST.enhance.chars + FRAME_MANIFEST.css.chars + FRAME_MANIFEST.mermaid.chars;
    expect(MAX_SRCDOC_CHARS_DEFAULT - SEED_HTML_MAX_CHARS - five - IMAGE_BUDGET_CHARS - SEED_FIELDS_MAX_CHARS).toBeGreaterThan(CSP_MAX_CHARS);
  });

  it('the default srcdoc of two fixed documents is the string landing A\'s code wrote, whether `layout` is left out or is \'default\'', () => {
    for (const layout of [undefined, 'default'] as const) {
      const d = defaultSrcdocs(layout);
      for (const k of ['plain', 'rich'] as const) {
        expect(d[k].length, `${k} length (layout ${String(layout)})`).toBe(DEFAULT_SRCDOC[k].length);
        expect(sha(d[k]), `${k} sha256 (layout ${String(layout)})`).toBe(DEFAULT_SRCDOC[k].sha256);
      }
    }
  });

  it('the default frame\'s style element is reader.css alone: no join, no empty layout stylesheet after it', () => {
    const out = frameOf(undefined);
    const style = tree(out).head.childNodes.filter(isElement).find((e) => e.tagName === 'style');
    expect(textOf(style as Element) === built.files.css.text).toBe(true);
    expect(out.includes(`${built.files.css.text}${STYLE_JOIN}`)).toBe(false);
    expect(out.includes(`${built.files.css.text}</style>`)).toBe(true);
  });
});

// ───────── 3. the bundles ─────────

describe('one enhance bundle per layout, from the default\'s entry, with the feature list substituted and nothing else', () => {
  it('every layout has its bundle and its stylesheet built, distinct from every other asset', () => {
    const names = ['enhance', ...OWN.flatMap((l) => [LAYOUT_ENTRIES[l].enhance, LAYOUT_ENTRIES[l].css as FrameAssetName])] as FrameAssetName[];
    const hashes = names.map((n) => built.files[n].sha256);
    expect(new Set(hashes).size).toBe(hashes.length);
    for (const l of OWN) {
      const b = built.files[LAYOUT_ENTRIES[l].enhance];
      expect(b.layout, l).toBe(l);
      expect(b.kind, l).toBe('script');
      expect(b.csp, l).toBe(`'sha256-${Buffer.from(b.sha256, 'hex').toString('base64')}'`);
      expect(b.text.startsWith('"use strict";'), l).toBe(true);
      const s = built.files[LAYOUT_ENTRIES[l].css as 'cssClassic'];
      expect([s.layout, s.kind, s.csp], l).toEqual([l, 'style', null]);
    }
  });

  it('a layout bundle holds its mark and the default bundle does not; each is built from its own list module and the shared ones', () => {
    expect(built.files.enhance.text.includes('data-docreader-layout')).toBe(false);
    for (const l of OWN) {
      const b = built.files[LAYOUT_ENTRIES[l].enhance];
      expect(b.text.includes('data-docreader-layout'), l).toBe(true);
      expect(b.text.includes(`"${l}"`), l).toBe(true);
      const inputs = b.inputs ?? [];
      expect(inputs, l).toContain(`src/enhance/layouts/${l}/features.ts`);
      expect(inputs, l).toContain('src/enhance/layouts/mark.ts');
      expect(inputs, l).toContain('src/enhance/lifecycle.ts');
      // The substitution replaces the shared list module; no other layout's list is in it.
      expect(inputs, l).not.toContain('src/enhance/features.ts');
      for (const other of OWN.filter((o) => o !== l)) expect(inputs, `${l} holds ${other}'s list`).not.toContain(`src/enhance/layouts/${other}/features.ts`);
    }
    const def = built.files.enhance.inputs ?? [];
    expect(def).toContain('src/enhance/features.ts');
    expect(def.filter((i) => i.includes('/layouts/'))).toEqual([]);
  });

  it('a layout bundle is smaller than the default bundle, by more than its stylesheet (test 8\'s layout row: a layout\'s assets are at most the default bundle)', () => {
    for (const l of OWN) {
      const b = FRAME_MANIFEST[LAYOUT_ENTRIES[l].enhance].chars;
      const s = FRAME_MANIFEST[LAYOUT_ENTRIES[l].css as 'cssClassic'].chars;
      expect(b + s, l).toBeLessThanOrEqual(FRAME_MANIFEST.enhance.chars);
    }
  });

  it('the plugin replaces the lifecycle\'s import of ./features.js, once, and fails the build when it replaced none (any other importer\'s is left alone)', async () => {
    const plugin = layoutPlugin(ROOT, 'src/enhance/layouts/classic/features.ts');
    const probe = (contents: string): Promise<unknown> =>
      build({ stdin: { contents, resolveDir: path.join(ROOT, 'src', 'enhance'), loader: 'ts', sourcefile: 'probe.ts' }, bundle: true, write: false, format: 'iife', platform: 'browser', logLevel: 'silent', plugins: [plugin] });
    // A module that is not the lifecycle imports the shared list: nothing is replaced, and the plugin refuses.
    await expect(probe("import { features } from './features.js'; void features;")).rejects.toThrow(/replaced 0 times, not once/);
    // The real lifecycle's import is replaced once: the build resolves.
    const ok = await build({ ...layoutScriptOptions('classic'), write: false });
    expect(ok.errors).toEqual([]);
    await stop();
  }, 120_000);

  it("the plugin fails the build when it replaced the lifecycle's import more than once (a lifecycle that imports ./features.js statically and again dynamically), and not when it replaced it once", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'pinax-layout-plugin-'));
    try {
      mkdirSync(path.join(dir, 'src', 'enhance'), { recursive: true });
      writeFileSync(path.join(dir, 'src', 'enhance', 'features.ts'), 'export const a = 1;\nexport const b = 2;\n');
      const lifecycle = path.join(dir, 'src', 'enhance', 'lifecycle.ts');
      const probe = (source: string): Promise<unknown> => {
        writeFileSync(lifecycle, source);
        return build({ entryPoints: [lifecycle], bundle: true, write: false, format: 'iife', platform: 'browser', logLevel: 'silent', plugins: [layoutPlugin(dir, 'src/enhance/features.ts')] });
      };
      await expect(probe("import { a } from './features.js';\nconsole.log(a);\n")).resolves.toBeDefined();
      // esbuild resolves one import record once per kind, so the second import is a dynamic one.
      await expect(probe("import { a } from './features.js';\nconsole.log(a, import('./features.js'));\n")).rejects.toThrow(/replaced 2 times, not once/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
      await stop();
    }
  }, 120_000);
});

// ───────── 4. each layout's srcdoc ─────────

describe('each layout\'s srcdoc inlines only its own bundle and stylesheet', () => {
  for (const layout of FRAME_LAYOUTS) {
    it(`${layout}: its own bundle once, its own stylesheet after reader.css in the one style element, the default's element order, and nothing of any other layout`, () => {
      const out = frameOf(layout, { assets: assetsFor(layout, true), mermaid: {} });
      const own = LAYOUT_ENTRIES[layout];
      const kids = tree(out).head.childNodes.filter(isElement);
      expect(kids.map((e) => (attr(e, 'type') === null ? e.tagName : `${e.tagName}[type=${String(attr(e, 'type'))}]`))).toEqual(['meta', 'script', 'script[type=application/json]', 'script', 'style', 'script', 'script']);
      expect(attr(kids[0] as Element, 'content')).toBe(frameCsp(layout));
      expect(textOf(kids[1] as Element) === built.files.guard.text).toBe(true);
      expect(textOf(kids[3] as Element) === built.files.bootstrap.text).toBe(true);
      expect(textOf(kids[4] as Element) === (own.css === null ? built.files.css.text : `${built.files.css.text}${STYLE_JOIN}${built.files[own.css].text}`)).toBe(true);
      expect(textOf(kids[5] as Element) === built.files[own.enhance].text).toBe(true);
      expect(textOf(kids[6] as Element) === mermaidText).toBe(true);
      // Nothing of another layout: neither its hash source, nor its bundle's text, nor its stylesheet's.
      for (const other of FRAME_LAYOUTS.filter((o) => o !== layout)) {
        const e = LAYOUT_ENTRIES[other];
        expect(out.includes(FRAME_MANIFEST[e.enhance].csp as string), `${other}'s hash`).toBe(false);
        expect(out.includes(built.files[e.enhance].text), `${other}'s bundle`).toBe(false);
        if (e.css !== null) expect(out.includes(built.files[e.css].text), `${other}'s stylesheet`).toBe(false);
      }
      // The bundle and the stylesheet of this layout are in it exactly once.
      const count = (needle: string): number => out.split(needle).length - 1;
      expect(count(built.files[own.enhance].text)).toBe(1);
      if (own.css !== null) expect(count(built.files[own.css].text)).toBe(1);
      // Every srcdoc scan the frame is held to passes under every layout.
      for (const [row, scan] of Object.entries(SCANS)) expect(scan(out), `${layout}: ${row}`).toEqual([]);
    });
  }

  it('a layout\'s srcdoc differs from the default\'s by its bundle, its stylesheet and the policy meta, and by nothing else', () => {
    const base = frameOf('default');
    for (const layout of OWN) {
      const out = frameOf(layout);
      const e = LAYOUT_ENTRIES[layout];
      const sheet = built.files[e.css as 'cssClassic'].text;
      // Replacement functions, not strings: a bundle holds `$` sequences that a replacement string would read as patterns.
      const back = out
        .replace(`<script>${built.files[e.enhance].text}</script>`, () => `<script>${built.files.enhance.text}</script>`)
        .replace(`${STYLE_JOIN}${sheet}</style>`, () => '</style>')
        .replace(frameCsp(layout), () => frameCsp());
      expect(back === base, layout).toBe(true);
    }
  });

  it('the policy meta of a srcdoc is the layout\'s own, with an appearance and both faces as without', () => {
    // A face the seed accepts (the woff2 signature, then bytes), for both roles.
    const face = Buffer.concat([Buffer.from('wOF2'), Buffer.alloc(200)]).toString('base64');
    for (const layout of FRAME_LAYOUTS) {
      const without = tree(frameOf(layout)).head.childNodes.filter(isElement);
      const withBoth = tree(frameOf(layout, { appearance: { mode: 'dark' }, assets: { ...assetsFor(layout), fonts: { sans: face, mono: face } } as FrameAssets })).head.childNodes.filter(isElement);      expect(attr(withBoth[0] as Element, 'content'), layout).toBe(attr(without[0] as Element, 'content'));
      expect(attr(without[0] as Element, 'content'), layout).toBe(frameCsp(layout));
    }
  });

  it('a layout is refused when its policy is another layout\'s: the bundle\'s hash must be in it (csp)', () => {
    for (const layout of OWN) expect(refusal(() => frameOf(layout, { csp: frameCsp('default') })), layout).toBe('csp');
    expect(refusal(() => frameOf('default', { csp: frameCsp('editorial') }))).toBe('csp');
    // Another layout's policy, with that layout's own hash added to the right one, is still a policy of this version's: accepted.
    const both = frameCsp('classic').replace('script-src ', `script-src ${FRAME_MANIFEST.enhanceEditorial.csp} `);
    expect(refusal(() => frameOf('classic', { csp: both }))).toBe('no refusal');
  });

  it('a name that is not a layout is invalid-input, however it is written; the option left out is the default', () => {
    for (const bad of ['', 'Default', 'classic ', 'plain', '__proto__', 'constructor', 'toString', null, 0, true, {}, ['classic']]) {
      expect(refusal(() => frameDocument(plain(), { csp: frameCsp(), nonce: NONCE, assets: assetsFor('default'), layout: bad as never })), String(bad)).toBe('invalid-input');
    }
    expect(refusal(() => frameDocument(plain(), { csp: frameCsp(), nonce: NONCE, assets: assetsFor('default'), layout: undefined as never }))).toBe('no refusal');
  });
});

// ───────── 5. assets.layoutCss ─────────

describe('assets.layoutCss: required where the layout has a stylesheet, refused where it has none, verified against its entry', () => {
  for (const layout of OWN) {
    it(`${layout}: missing without it (missing-asset); another layout's, the default's, an edited or a non-string text is refused`, () => {
      const good = assetsFor(layout);
      const { layoutCss: _drop, ...without } = good;
      void _drop;
      expect(refusal(() => frameOf(layout, { assets: without as FrameAssets })), 'absent').toBe('missing-asset');
      expect(refusal(() => frameOf(layout, { assets: { ...good, layoutCss: undefined } as unknown as FrameAssets })), 'undefined').toBe('missing-asset');
      for (const other of OWN.filter((o) => o !== layout)) {
        expect(refusal(() => frameOf(layout, { assets: { ...good, layoutCss: built.files[LAYOUT_ENTRIES[other].css as 'cssClassic'].text } })), `${other}'s stylesheet`).toBe('asset-mismatch');
      }
      expect(refusal(() => frameOf(layout, { assets: { ...good, layoutCss: built.files.css.text } })), "reader.css's text").toBe('asset-mismatch');
      expect(refusal(() => frameOf(layout, { assets: { ...good, layoutCss: `${good.layoutCss as string} ` } })), 'one byte more').toBe('asset-mismatch');
      expect(refusal(() => frameOf(layout, { assets: { ...good, layoutCss: '' } })), 'empty').toBe('asset-mismatch');
      for (const bad of [null, 0, {}, ['x']]) expect(refusal(() => frameOf(layout, { assets: { ...good, layoutCss: bad as never } })), String(bad)).toBe('asset-mismatch');
      expect(refusal(() => frameOf(layout, { assets: good })), 'the right one').toBe('no refusal');
    });

    it(`${layout}: its bundle is verified against its own entry: the default's or another layout's is refused (asset-mismatch)`, () => {
      const good = assetsFor(layout);
      expect(refusal(() => frameOf(layout, { assets: { ...good, enhance: built.files.enhance.text } })), "the default's bundle").toBe('asset-mismatch');
      for (const other of OWN.filter((o) => o !== layout)) {
        expect(refusal(() => frameOf(layout, { assets: { ...good, enhance: built.files[LAYOUT_ENTRIES[other].enhance].text } })), `${other}'s bundle`).toBe('asset-mismatch');
      }
    });
  }

  it('the default has no stylesheet of its own: any layoutCss, whatever its text, is refused (asset-mismatch), and a layout\'s bundle under it is refused too', () => {
    const base = assetsFor('default');
    for (const text of [built.files.cssEditorial.text, built.files.css.text, '', 'x']) {
      expect(refusal(() => frameOf('default', { assets: { ...base, layoutCss: text } })), JSON.stringify(text.slice(0, 12))).toBe('asset-mismatch');
      expect(refusal(() => frameOf(undefined, { assets: { ...base, layoutCss: text } })), `no layout, ${JSON.stringify(text.slice(0, 12))}`).toBe('asset-mismatch');
    }
    expect(refusal(() => frameOf('default', { assets: { ...base, enhance: built.files.enhanceEditorial.text } }))).toBe('asset-mismatch');
  });

  it('a stylesheet text that holds a style end tag, an @import or a url( is refused as unsafe-asset before its hash is compared', () => {
    const good = assetsFor('classic');
    for (const plant of ['</style>', '@import "x.css";', 'a{background:url(https://example.invalid/x.png)}', '\0', '\r']) {
      expect(refusal(() => frameOf('classic', { assets: { ...good, layoutCss: `${good.layoutCss as string}${plant}` } })), JSON.stringify(plant)).toBe('unsafe-asset');
    }
  });
});

// ───────── 6. maxSrcdocChars(layout) ─────────

/** The skeleton frameDocument writes around a layout's parts, measured on a real srcdoc, as test/frame-document.test.ts measures the default's. */
function skeletonOf(layout: FrameLayout): number {
  const longest = frameCsp(layout) + ' '.repeat(CSP_MAX_CHARS - frameCsp(layout).length);
  const empty: RenderInput = { result: { outcome: 'rendered', html: '', meta: { title: null, frontList: null } } };
  expect(refusal(() => frameOf(layout, { csp: `${longest} `, assets: assetsFor(layout, true), mermaid: {} }, empty))).toBe('csp');
  const out = frameOf(layout, { csp: longest, assets: assetsFor(layout, true), mermaid: {} }, empty);
  const kids = tree(out).head.childNodes.filter(isElement);
  expect(kids.map((k) => k.tagName)).toEqual(['meta', 'script', 'script', 'script', 'style', 'script', 'script']);
  return out.length - kids.slice(1).map(textOf).reduce((n, t) => n + t.length, 0);
}

describe('maxSrcdocChars(layout): derived from the entries that layout\'s frame inlines', () => {
  for (const layout of FRAME_LAYOUTS) {
    it(`${layout}: the html cap, that layout's bundle, reader.css and its stylesheet (with the join), the guard, the bootstrap, Mermaid's, the images, the seed fields at their caps and the skeleton at its longest`, () => {
      const e = LAYOUT_ENTRIES[layout];
      const assetChars =
        FRAME_MANIFEST.guard.chars + FRAME_MANIFEST.bootstrap.chars + FRAME_MANIFEST[e.enhance].chars + FRAME_MANIFEST.css.chars + FRAME_MANIFEST.mermaid.chars +
        (e.css === null ? 0 : STYLE_JOIN.length + FRAME_MANIFEST[e.css].chars);
      const skeleton = skeletonOf(layout);
      expect(skeleton).toBeGreaterThan(CSP_MAX_CHARS);
      // The skeleton is the same for every layout: the join is counted with the assets, as the cap counts it.
      expect(skeleton).toBe(skeletonOf('default'));
      expect(maxSrcdocChars(layout)).toBe(SEED_HTML_MAX_CHARS + assetChars + IMAGE_BUDGET_CHARS + SEED_FIELDS_MAX_CHARS + skeleton);
    });
  }

  it('is not the default\'s for another layout: each layout\'s own assets move it, so a cap derived from `default` for every layout is wrong', () => {
    const caps = FRAME_LAYOUTS.map((l) => maxSrcdocChars(l));
    expect(new Set(caps).size).toBe(caps.length);
    for (const l of OWN) {
      const e = LAYOUT_ENTRIES[l];
      expect(maxSrcdocChars(l) - MAX_SRCDOC_CHARS_DEFAULT, l).toBe(
        FRAME_MANIFEST[e.enhance].chars - FRAME_MANIFEST.enhance.chars + STYLE_JOIN.length + FRAME_MANIFEST[e.css as 'cssClassic'].chars,
      );
    }
  });

  it('a name that is not a layout is a TypeError; the option left out is the default', () => {
    for (const bad of ['', 'Default', 'plain', '__proto__', null, 0, {}]) expect(() => maxSrcdocChars(bad as never), String(bad)).toThrow(TypeError);
    expect(maxSrcdocChars(undefined)).toBe(MAX_SRCDOC_CHARS_DEFAULT);
  });

  for (const layout of FRAME_LAYOUTS) {
    it(`${layout}: FrameOptions.maxSrcdocChars is bounded by this layout's cap: its cap passes, one over it is invalid-input, and at the output length the string is returned`, () => {
      const cap = maxSrcdocChars(layout);
      expect(refusal(() => frameOf(layout, { maxSrcdocChars: cap }))).toBe('no refusal');
      expect(refusal(() => frameOf(layout, { maxSrcdocChars: cap + 1 }))).toBe('invalid-input');
      for (const v of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, '100' as unknown as number, null as unknown as number]) {
        expect(refusal(() => frameOf(layout, { maxSrcdocChars: v })), String(v)).toBe('invalid-input');
      }
      const out = frameOf(layout);
      expect(frameOf(layout, { maxSrcdocChars: out.length })).toBe(out);
      expect(refusal(() => frameOf(layout, { maxSrcdocChars: out.length - 1 }))).toBe('too-large');
    });
  }

  it('the default\'s cap is not a bound for a layout whose own cap is lower: the option is held to the layout\'s', () => {
    for (const l of OWN) {
      if (maxSrcdocChars(l) < MAX_SRCDOC_CHARS_DEFAULT) expect(refusal(() => frameOf(l, { maxSrcdocChars: MAX_SRCDOC_CHARS_DEFAULT })), l).toBe('invalid-input');
    }
    expect(OWN.some((l) => maxSrcdocChars(l) < MAX_SRCDOC_CHARS_DEFAULT)).toBe(true);
  });
});

/** The longest appearance parseAppearance accepts, as test/frame-document.test.ts builds it. */
const MAXIMAL_APPEARANCE = (): unknown => {
  const shadow = '-64px -64px 64px -8px rgba(255, 255, 255, 0.999)';
  const colour = Object.fromEntries((APPEARANCE_SLOTS.colour as readonly string[]).map((k) => [k, '#ABCDEF']));
  const skin = { radius: '24px', radiusSmall: '24px', radiusLarge: '24px', controlRow: '56px', popShadow: [shadow, shadow, shadow].join(', '), sectionFamily: 'mono', sectionSize: '16px', sectionWeight: '900', sectionTracking: '-0.100em', sectionCase: 'uppercase' };
  return { mode: 'light', colour, skin, label: '<'.repeat(64) };
};

describe("test 7's old-cap row, under every layout besides the default (the default's is test/frame-document.test.ts's)", () => {
  // 1.1.0's seed fields (the cap before the appearance and the faces were counted): the cap of a layout less the rise of the seed fields.
  const SEED_FIELDS_MAX_CHARS_1_1_0 = 45768624;
  let oldCap: ReturnType<typeof oldCapDocument> | undefined;
  for (const layout of OWN) {
    it(`${layout}: a document at the old srcdoc cap, with both faces at 131 072 decoded bytes and the largest appearance, is framed within this layout's cap, and the cap in force is the layout's`, () => {
      // Each srcdoc is about 115 million characters: only its length is kept, and the next is framed after it is released. The
      // document is built once for the layouts.
      const { input: doc, options } = (oldCap ??= oldCapDocument());
      const on = { ...options, assets: assetsFor(layout, true) };
      const lengthOf = (o: Partial<FrameOptions>): number => frameOf(layout, { ...on, ...o }, doc).length;
      const withoutLength = lengthOf({});
      const cap = maxSrcdocChars(layout);
      // The document is at the old cap the way 1.1.0 counted it: within this layout's cap counted with 1.1.0's seed fields, and it
      // leaves less than a thousandth of it unused (the skeleton's slack, the base64 padding slack the seed fields' cap counts, and
      // the small fields a mount writes at their own values).
      const oldFieldsCap = cap - (SEED_FIELDS_MAX_CHARS - SEED_FIELDS_MAX_CHARS_1_1_0);
      expect(withoutLength).toBeLessThanOrEqual(oldFieldsCap);
      expect(oldFieldsCap - withoutLength).toBeLessThan(oldFieldsCap / 1000);
      const faceAtCap = Buffer.concat([Buffer.from('wOF2'), Buffer.alloc(131072 - 4)]).toString('base64');
      expect(faceAtCap).toHaveLength(174764);
      const both: Partial<FrameOptions> = { appearance: MAXIMAL_APPEARANCE(), assets: { ...assetsFor(layout, true), fonts: { sans: faceAtCap, mono: faceAtCap } } as FrameAssets };
      const bothLength = lengthOf(both);
      expect(bothLength).toBeLessThanOrEqual(cap);
      // Its control: one character under that length the refusal is too-large, so the cap the row sits under is the one in force.
      expect(refusal(() => lengthOf({ ...both, maxSrcdocChars: bothLength - 1 }))).toBe('too-large');
    }, 600_000);
  }
});

// ───────── 7. the build's checks ─────────

/** The bundle checkOutputs() reads, from the build, with `texts` replacing some of its texts. */
function bundleOf(texts: Partial<Record<FrameAssetName, string>> = {}): Bundle {
  const all = Object.fromEntries(Object.keys(FRAME_FILES).map((n) => [n, texts[n as FrameAssetName] ?? built.files[n as FrameAssetName].text])) as Record<FrameAssetName, string>;
  return {
    texts: all,
    mermaidModule: built.mermaidModule.text,
    inputs: Object.fromEntries(['guard', 'bootstrap', 'enhance', ...OWN.map((l) => LAYOUT_ENTRIES[l].enhance)].map((n) => [n, built.files[n as 'guard'].inputs ?? []])) as Bundle['inputs'],
    freeGlobals: { names: built.freeGlobals.names, first: built.freeGlobals.first },
  };
}

function problems(bundle: Bundle): string[] {
  try {
    checkOutputs(bundle);
    return [];
  } catch (e) {
    const p = (e as { problems?: unknown }).problems;
    return Array.isArray(p) ? (p as string[]) : [`threw without problems: ${String(e)}`];
  }
}

describe('the build holds every layout asset to the byte rules, the free-global list and the budgets', () => {
  it('the real bundle, layouts included, passes every check', () => {
    expect(problems(bundleOf())).toEqual([]);
  });

  it('a layout\'s stylesheet that holds a font of its own, a url( or an @import is refused, named; a style end tag too, alone and joined to reader.css', () => {
    const css = built.files.cssEditorial.text;
    const at = (plant: string): string[] => problems(bundleOf({ cssEditorial: `${css}\n${plant}\n` })).filter((m) => m.startsWith('frame/layout-editorial.css: '));
    expect(at('@font-face{font-family:x;src:url(data:font/woff2;base64,AAAA)}').some((m) => m.includes('a font or url( of its own'))).toBe(true);
    expect(at('a{background:url(https://example.invalid/x.png)}').some((m) => m.includes('a font or url( of its own'))).toBe(true);
    expect(at('@import "x.css";').some((m) => m.includes('@import'))).toBe(true);
    const end = at('/* </style> */');
    expect(end.some((m) => m.includes('style end tag') && !m.includes('joined'))).toBe(true);
    expect(end.some((m) => m.includes('joined to frame/reader.css, style end tag'))).toBe(true);
    for (const plant of ['\0', '\r', '﻿']) expect(at(plant).length, JSON.stringify(plant)).toBeGreaterThan(0);
  });

  it('a layout bundle is a frame script: a script tag, a NUL and an HTML comment token planted in one fail the build, named', () => {
    const text = built.files.enhanceClassic.text;
    const p = (plant: string): string[] => problems(bundleOf({ enhanceClassic: `${text};var planted="${plant}";\n` })).filter((m) => m.startsWith('frame/enhance-classic.js: '));
    expect(p('</script>').some((m) => m.includes('script tag'))).toBe(true);
    expect(p('\0').some((m) => m.includes('NUL'))).toBe(true);
    expect(problems(bundleOf({ enhanceClassic: `${text};var a = 1 <!-- 2;\n` })).some((m) => m.startsWith('frame/enhance-classic.js: ') && m.includes('HTML comment token'))).toBe(true);
  });

  it('a layout bundle that reads a global name outside the bootstrap\'s list fails the build, naming the name: the list is made from the four base scripts and never moves for a layout', () => {
    const text = built.files.enhanceEditorial.text;
    const p = problems(bundleOf({ enhanceEditorial: `${text};globalThis.__plantedLayoutName;\n` }));
    expect(p.some((m) => m.startsWith('free-globals: ') && m.includes('__plantedLayoutName'))).toBe(true);
    // The same read in the default bundle is a name the list would have to carry: the bootstrap's list is not the outputs' scan either.
    expect(problems(bundleOf({ enhance: `${built.files.enhance.text};globalThis.__plantedLayoutName;\n` })).some((m) => m.includes('__plantedLayoutName'))).toBe(true);
    // A name the bootstrap already pins is no problem in a layout.
    const pinned = built.freeGlobals.names[0] as string;
    expect(problems(bundleOf({ enhanceEditorial: `${text};globalThis.${pinned};\n` }))).toEqual([]);
  });

  it('a layout bundle that writes a global name fails the build unless the name is allowlisted', () => {
    const text = built.files.enhanceClassic.text;
    const p = problems(bundleOf({ enhanceClassic: `${text};globalThis.__writtenByLayout = 1;\n` }));
    expect(p.length).toBeGreaterThan(0);
    expect(p.join('\n')).toContain('__writtenByLayout');
  });

  it('a bundle that lacks a layout\'s text is a problem named by the file, never a crash', () => {
    const b = bundleOf();
    const { enhanceEditorial: _drop, ...rest } = b.texts as Record<string, string>;
    void _drop;
    expect(problems({ ...b, texts: rest as Bundle['texts'] }).some((m) => m.startsWith('frame/enhance-editorial.js: no text was built'))).toBe(true);
  });
});
