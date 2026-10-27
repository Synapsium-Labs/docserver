// The frame build (docserver L3, Task 6; plan Reference §3, §5.4, §5.5, §10 and §12): scripts/build-frame.mjs builds
// every frame asset in memory, scans the four bundled scripts for the names they read from the global and embeds that
// list in the bootstrap, checks every output against the byte rules, the HTML-like comment rule and the size budgets,
// and writes assets/assets.json (every file under assets/) and src/frame/manifest.generated.ts (the frame subset, with
// each asset's UTF-16 length as `chars`); scripts/verify-assets.mjs, npm's prepack, refuses bytes assets.json does not
// name. Rows L3.M13 to L3.M15, L3.M17 and L3.M18, the OFL notice and the package wiring. The CI steps are
// test/ci-workflow.test.ts's; the tarball's budget is test/pack.test.ts's.
//
// The build runs once, in memory, in beforeAll, and its outcome is kept whether it resolves or throws, so a build that
// breaks a rule fails the rows below as assertions rather than as a hook error. A row that plants a hazard plants it
// in a copy of the built texts and hands that to checkOutputs(), the function buildFrame() runs on every bundle; no row
// writes into the checkout.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, type DefaultTreeAdapterMap } from 'parse5';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  ASSET_BUDGETS,
  ASSETS_JSON,
  FRAME_FILES,
  FREE_DEFINES,
  FREE_GLOBALS_ALLOWLIST,
  HAZARDS,
  MANIFEST_TS,
  MERMAID_MODULE,
  OUTPUT_DIRS,
  assetKind,
  buildFrame,
  checkFrame,
  checkOutputs,
  fontNotice,
  staticAssets,
  writeFrame,
  type Bundle,
  type BuiltFrame,
  type FrameAssetName,
} from '../scripts/build-frame.mjs';
import { commentTokenHazards } from '../scripts/comment-tokens.mjs';
import { freeGlobalList, MAX_FREE_GLOBALS, scanFreeGlobals, scanScript } from '../scripts/free-globals.mjs';
import { frameCsp, frameDocument, FRAME_MANIFEST, type RenderInput } from '../src/frame/index.js';
import { pinFreeGlobals } from '../src/frame-runtime/pin.js';
import { render } from '../src/render/index.js';

type Element = DefaultTreeAdapterMap['element'];
type Node = DefaultTreeAdapterMap['node'];

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const VERIFY = path.join(ROOT, 'scripts', 'verify-assets.mjs');
const BUILD = path.join(ROOT, 'scripts', 'build-frame.mjs');
const NAMES = ['guard', 'bootstrap', 'enhance', 'css', 'mermaid'] as const;
const SCANNED = ['guard', 'bootstrap', 'enhance', 'mermaid'] as const;

const sha256 = (data: string | Buffer): Buffer => createHash('sha256').update(data).digest();

let outcome: { built: BuiltFrame; error: null } | { built: null; error: string } = { built: null, error: 'not built' };

beforeAll(async () => {
  outcome = await buildFrame().then(
    (built) => ({ built, error: null }),
    (e: unknown) => ({ built: null, error: e instanceof Error ? e.message : String(e) }),
  );
}, 300_000);

/** The build, asserted to have succeeded (its error is the assertion's message when it did not). */
function built(): BuiltFrame {
  expect(outcome.error).toBeNull();
  return outcome.built as BuiltFrame;
}

/** The bundle checkOutputs() reads, from the build, with `texts` replacing some of its texts. */
function bundleOf(b: BuiltFrame, texts: Partial<Record<FrameAssetName, string>> = {}): Bundle {
  const t = Object.fromEntries(NAMES.map((n) => [n, texts[n] ?? b.files[n].text])) as Record<FrameAssetName, string>;
  return {
    texts: t,
    mermaidModule: b.mermaidModule.text,
    inputs: { guard: b.files.guard.inputs ?? [], bootstrap: b.files.bootstrap.inputs ?? [], enhance: b.files.enhance.inputs ?? [] },
    freeGlobals: { names: b.freeGlobals.names, first: b.freeGlobals.first },
  };
}

/** What checkOutputs() says of `bundle`: its problems, or [] when it passes. */
function problems(bundle: Bundle): string[] {
  try {
    checkOutputs(bundle);
    return [];
  } catch (e) {
    const p = (e as { problems?: unknown }).problems;
    return Array.isArray(p) ? (p as string[]) : [`threw without problems: ${String(e)}`];
  }
}

describe('L3.M13: the byte rules and the HTML-like comment rule fail the build', () => {
  it('the real bundle passes every check', () => {
    expect(problems(bundleOf(built()))).toEqual([]);
  });

  const SCRIPT_PLANTS: Readonly<Record<string, string>> = {
    'script tag': '</script>',
    NUL: '\0',
    CR: '\r',
    BOM: '﻿',
  };
  for (const [hazard, plant] of Object.entries(SCRIPT_PLANTS)) {
    it(`a ${hazard} planted in a runtime string of guard.js fails the build, named`, () => {
      const b = built();
      const p = problems(bundleOf(b, { guard: `${b.files.guard.text};var planted="${plant}";\n` }));
      expect(p.filter((m) => m.startsWith('frame/guard.js: ') && m.includes(hazard))).toHaveLength(1);
    });
  }

  const CSS_PLANTS: Readonly<Record<string, string>> = {
    'style end tag': '/* </style> */',
    '@import': '@import "x.css";',
    NUL: '/* \0 */',
    CR: '/* \r */',
    BOM: '/* ﻿ */',
    'url( other than an inlined woff2 font': 'a{background:url(https://example.invalid/x.png)}',
  };
  for (const [hazard, plant] of Object.entries(CSS_PLANTS)) {
    it(`a ${hazard} planted in frame/reader.css fails the build, named`, () => {
      const b = built();
      const p = problems(bundleOf(b, { css: `${b.files.css.text}\n${plant}\n` }));
      expect(p.filter((m) => m.startsWith('frame/reader.css: ') && m.includes(hazard))).toHaveLength(1);
    });
  }

  it('HAZARDS names exactly the checks planted above', () => {
    expect([...HAZARDS.script].sort()).toEqual([...Object.keys(SCRIPT_PLANTS), 'HTML comment token'].sort());
    expect([...HAZARDS.css].sort()).toEqual(Object.keys(CSS_PLANTS).sort());
  });

  it('a `<!--` or a `-->` outside a literal token in enhance.js fails the build; the same inside a string, a template or a regex passes', () => {
    const b = built();
    const outside = problems(bundleOf(b, { enhance: `${b.files.enhance.text}\n<!-- planted\n` }));
    expect(outside.filter((m) => m.startsWith('frame/enhance.js: HTML comment token'))).toHaveLength(1);
    const close = problems(bundleOf(b, { enhance: `${b.files.enhance.text}\n--> planted\n` }));
    expect(close.filter((m) => m.startsWith('frame/enhance.js: HTML comment token'))).toHaveLength(1);
    const inside = problems(bundleOf(b, { enhance: `${b.files.enhance.text};var p1="<!--",p2=\`-->\${p1}<!--\`,p3=/<!--|-->/;\n` }));
    expect(inside).toEqual([]);
  });

  it('the Mermaid frame file holds exactly 3 `<!--`, every one inside a literal, and passes the rule', () => {
    const m = built().files.mermaid.text;
    expect(m.split('<!--')).toHaveLength(4);
    expect(commentTokenHazards(m)).toEqual([]);
    expect(commentTokenHazards(`${m}\n<!--`)).toHaveLength(1);
  });
});

describe('L3.M14: one reproducible build, and --check', () => {
  it('two in-memory builds are byte-identical', async () => {
    const a = built();
    const again = await buildFrame();
    for (const n of NAMES) expect(again.files[n].text === a.files[n].text, n).toBe(true);
    expect(again.mermaidModule.text === a.mermaidModule.text).toBe(true);
    expect(again.assetsJson).toBe(a.assetsJson);
    expect(again.manifestTs).toBe(a.manifestTs);
    expect(again.freeGlobals.names).toEqual(a.freeGlobals.names);
  }, 300_000);

  it('no output names the checkout or the home directory, and every input is named from the package root', () => {
    const b = built();
    // With and without the leading slash: esbuild names a path from its working directory, so a build run from the
    // filesystem root would write `home/...`.
    const roots = [ROOT.replace(/\/$/, ''), homedir()].flatMap((r) => [r, r.replace(/^\//, '')]);
    for (const n of NAMES) for (const r of roots) expect(b.files[n].text.includes(r), `${n} names ${r}`).toBe(false);
    for (const r of roots) expect(b.mermaidModule.text.includes(r)).toBe(false);
    for (const n of ['guard', 'bootstrap', 'enhance'] as const) {
      const inputs = b.files[n].inputs ?? [];
      expect(inputs.length).toBeGreaterThan(0);
      // esbuild names a define's value as a virtual input, `<define:NAME>`.
      expect(inputs.filter((i) => !/^(?:src|node_modules)\/|^<define:[A-Z_]+>$/.test(i))).toEqual([]);
    }
  });

  it('checkFrame finds nothing on a tree the build just wrote, and names each output a changed byte reaches', () => {
    const b = built();
    const dir = mkdtempSync(path.join(tmpdir(), 'frame-build-check-'));
    try {
      writeFrame(b, dir);
      expect(checkFrame(b, dir)).toEqual([]);
      for (const rel of ['assets/frame/enhance.js', `assets/${MERMAID_MODULE}`, ASSETS_JSON, MANIFEST_TS]) {
        const at = path.join(dir, rel);
        const text = readFileSync(at, 'utf8');
        writeFileSync(at, `${text.slice(0, 20)}${text[20] === 'a' ? 'b' : 'a'}${text.slice(21)}`);
        expect(checkFrame(b, dir)).toEqual([rel]);
        writeFileSync(at, text);
      }
      // A committed file that is missing differs; a git-ignored output that is missing does not.
      rmSync(path.join(dir, 'assets', 'frame', 'guard.js'));
      expect(checkFrame(b, dir)).toEqual([]);
      rmSync(path.join(dir, MANIFEST_TS));
      expect(checkFrame(b, dir)).toEqual([MANIFEST_TS]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('`node scripts/build-frame.mjs --check --out <dir>` exits 0 on a written tree and 1 once a byte of an output changes', () => {
    const b = built();
    const dir = mkdtempSync(path.join(tmpdir(), 'frame-build-cli-'));
    try {
      writeFrame(b, dir);
      const run = (): ReturnType<typeof spawnSync> => spawnSync(process.execPath, [BUILD, '--check', '--out', dir], { encoding: 'utf8' });
      expect(run().status).toBe(0);
      const at = path.join(dir, 'assets', 'frame', 'bootstrap.js');
      const text = readFileSync(at, 'utf8');
      writeFileSync(at, `${text} `);
      const r = run();
      expect(r.status).toBe(1);
      expect(String(r.stderr)).toContain('assets/frame/bootstrap.js');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 300_000);

  it('buildFrame({ check: true }) without `out` checks the package root, as the CLI does: `differ` is always set (review T6-C1)', async () => {
    const b = built();
    const checked = await buildFrame({ check: true });
    expect(Array.isArray(checked.differ)).toBe(true);
    expect(checked.differ).toEqual(checkFrame(b, ROOT));
    // The committed files equal a fresh build (L3.M15's row), so neither can be among them.
    expect(checked.differ).not.toContain(ASSETS_JSON);
    expect(checked.differ).not.toContain(MANIFEST_TS);
  }, 300_000);
});

describe('L3.M15: assets.json, FRAME_MANIFEST and prepack', () => {
  it('the committed assets.json and manifest.generated.ts equal a fresh build', () => {
    const b = built();
    expect(readFileSync(path.join(ROOT, ASSETS_JSON), 'utf8')).toBe(b.assetsJson);
    expect(readFileSync(path.join(ROOT, MANIFEST_TS), 'utf8')).toBe(b.manifestTs);
  });

  it('assets.json lists every file under assets/ but itself, sorted by path in code-unit order, in the wrapper of Reference 10', () => {
    const b = built();
    const json = JSON.parse(b.assetsJson) as Record<string, unknown> & { files: { path: string }[] };
    const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8')) as { name: string; version: string };
    expect(Object.keys(json)).toEqual(['manifest', 'package', 'version', 'bridgeProtocol', 'files']);
    expect([json['manifest'], json['package'], json['version'], json['bridgeProtocol']]).toEqual([1, pkg.name, pkg.version, 1]);
    expect(b.assetsJson.endsWith('}\n')).toBe(true);
    expect(b.assetsJson).toBe(`${JSON.stringify(json, null, 2)}\n`);
    const paths = json.files.map((f) => f.path);
    const sorted = [...paths].sort((x, y) => (x < y ? -1 : x > y ? 1 : 0));
    expect(paths).toEqual(sorted);
    expect(new Set(paths).size).toBe(paths.length);
    // Every tracked file under assets/ (walked from disk, the git-ignored output directories left out) and every output.
    const walked: string[] = [];
    const walk = (rel: string): void => {
      for (const e of readdirSync(path.join(ROOT, 'assets', rel), { withFileTypes: true })) {
        const r = rel === '' ? e.name : `${rel}/${e.name}`;
        if (e.isDirectory()) {
          if (rel === '' && OUTPUT_DIRS.includes(e.name)) continue;
          walk(r);
        } else if (r !== 'assets.json') walked.push(r);
      }
    };
    walk('');
    expect(staticAssets().sort()).toEqual(walked.sort());
    expect(OUTPUT_DIRS).toEqual(['frame', 'mermaid']);
    const outputs = [...Object.values(FRAME_FILES), MERMAID_MODULE];
    expect(sorted).toEqual([...walked, ...outputs].sort((x, y) => (x < y ? -1 : x > y ? 1 : 0)));
    for (const must of ['reader.css', 'fonts/OFL.txt', 'fonts/README.md', 'mermaid/mermaid.mjs', 'mermaid/mermaid.frame.js', 'frame/guard.js', 'frame/bootstrap.js', 'frame/enhance.js', 'frame/reader.css']) {
      expect(paths).toContain(must);
    }
    expect(paths.filter((p) => p.endsWith('.woff2'))).toHaveLength(4);
  });

  it("each entry's sha256, bytes, kind and csp recompute from the file's bytes", () => {
    const b = built();
    const texts = new Map<string, Buffer>([
      ...NAMES.map((n) => [b.files[n].path, Buffer.from(b.files[n].text, 'utf8')] as [string, Buffer]),
      [MERMAID_MODULE, Buffer.from(b.mermaidModule.text, 'utf8')],
    ]);
    const frameScripts = new Set([FRAME_FILES.guard, FRAME_FILES.bootstrap, FRAME_FILES.enhance, FRAME_FILES.mermaid]);
    for (const f of b.listed) {
      const data = texts.get(f.path) ?? readFileSync(path.join(ROOT, 'assets', f.path));
      const digest = sha256(data);
      const kind = f.path.endsWith('.mjs') ? 'module' : f.path.endsWith('.js') ? 'script' : f.path.endsWith('.css') ? 'style' : f.path.endsWith('.woff2') ? 'font' : 'text';
      const want = { path: f.path, sha256: digest.toString('hex'), bytes: data.length, kind, ...(frameScripts.has(f.path) ? { csp: `'sha256-${digest.toString('base64')}'` } : {}) };
      expect(f).toEqual(want);
      expect(assetKind(f.path)).toBe(kind);
    }
    expect((JSON.parse(b.assetsJson) as { files: unknown[] }).files).toEqual(b.listed);
    expect(() => assetKind('fonts/new.ttf')).toThrow(/new\.ttf/);
  });

  it("FRAME_MANIFEST is the frame subset, and each entry's chars is its text's UTF-16 length, Mermaid's non-ASCII included", () => {
    const b = built();
    for (const n of NAMES) {
      const f = b.files[n];
      expect(FRAME_MANIFEST[n]).toEqual({ path: f.path, sha256: f.sha256, bytes: f.bytes, chars: f.text.length, csp: f.csp });
      expect(f.chars).toBe(f.text.length);
      expect(f.bytes).toBe(Buffer.byteLength(f.text, 'utf8'));
    }
    // The bytes differ from the chars where a file holds non-ASCII: Mermaid's literals and the stylesheet's notice.
    expect(FRAME_MANIFEST.mermaid.chars).toBeLessThan(FRAME_MANIFEST.mermaid.bytes);
    expect(FRAME_MANIFEST.css.chars).toBeLessThan(FRAME_MANIFEST.css.bytes);
    expect(Object.keys(FRAME_MANIFEST)).toEqual([...NAMES]);
  });

  it("the bootstrap's esbuild inputs hold neither manifest.generated.ts nor document.ts (its length would depend on itself)", () => {
    const inputs = built().files.bootstrap.inputs ?? [];
    expect(inputs).toContain('src/frame/seed.ts');
    expect(inputs).not.toContain('src/frame/manifest.generated.ts');
    expect(inputs).not.toContain('src/frame/document.ts');
  });

  it("frameCsp()'s four hashes equal the hashes of the script elements of a real frameDocument output", () => {
    const b = built();
    const r = render('# Title\n\nText.\n');
    if (r.outcome !== 'rendered') throw new Error('did not render');
    const input: RenderInput = { result: { outcome: r.outcome, html: r.html, meta: { title: r.meta.title, frontList: r.meta.frontList } } };
    const assets = { guard: b.files.guard.text, bootstrap: b.files.bootstrap.text, enhance: b.files.enhance.text, css: b.files.css.text, mermaid: b.files.mermaid.text };
    const srcdoc = frameDocument(input, { csp: frameCsp(), nonce: 'b'.repeat(32), assets, mermaid: {} });
    const doc = parse(srcdoc);
    const html = doc.childNodes.find((n): n is Element => 'tagName' in n);
    const head = html?.childNodes.find((n): n is Element => 'tagName' in n && n.tagName === 'head');
    const scripts = (head?.childNodes ?? []).filter((n: Node): n is Element => 'tagName' in n && n.tagName === 'script' && !n.attrs.some((a) => a.name === 'type'));
    const text = (e: Element): string => e.childNodes.map((c) => ('value' in c ? String(c.value) : '')).join('');
    const hashes = scripts.map((e) => `'sha256-${sha256(text(e)).toString('base64')}'`);
    expect(hashes).toHaveLength(4);
    const policy = frameCsp();
    const scriptSrc = /script-src ([^;]+);/.exec(policy)?.[1]?.split(' ') ?? [];
    expect(hashes).toEqual(scriptSrc);
    expect(hashes).toEqual([FRAME_MANIFEST.guard.csp, FRAME_MANIFEST.bootstrap.csp, FRAME_MANIFEST.enhance.csp, FRAME_MANIFEST.mermaid.csp]);
  });

  describe('prepack: scripts/verify-assets.mjs', () => {
    it('is the package prepack', () => {
      const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8')) as { scripts: Record<string, string> };
      expect(pkg.scripts['prepack']).toBe('node scripts/verify-assets.mjs');
    });

    /** A small package: package.json, three assets and an assets.json that names them exactly. */
    function fixture(): string {
      const dir = mkdtempSync(path.join(tmpdir(), 'verify-assets-'));
      writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: '@scope/fixture', version: '1.2.3' }));
      const files: Record<string, Buffer> = {
        'reader.css': Buffer.from('a{color:red}\n'),
        'fonts/x.woff2': Buffer.from([0, 1, 2, 3, 255]),
        'frame/guard.js': Buffer.from('"use strict";\n'),
      };
      for (const [rel, data] of Object.entries(files)) {
        mkdirSync(path.dirname(path.join(dir, 'assets', rel)), { recursive: true });
        writeFileSync(path.join(dir, 'assets', rel), data);
      }
      const listed = Object.entries(files)
        .map(([p, data]) => ({ path: p, sha256: sha256(data).toString('hex'), bytes: data.length, kind: assetKind(p), ...(p.endsWith('.js') ? { csp: `'sha256-${sha256(data).toString('base64')}'` } : {}) }))
        .sort((x, y) => (x.path < y.path ? -1 : 1));
      writeFileSync(path.join(dir, 'assets', 'assets.json'), `${JSON.stringify({ manifest: 1, package: '@scope/fixture', version: '1.2.3', bridgeProtocol: 1, files: listed }, null, 2)}\n`);
      return dir;
    }
    const verify = (dir: string, extra: readonly string[] = []): ReturnType<typeof spawnSync> =>
      spawnSync(process.execPath, [VERIFY, '--root', dir, ...extra], { encoding: 'utf8' });

    it('exits 0 when assets.json names every byte, and prints to stderr only (npm pack --json keeps a clean stdout)', () => {
      const dir = fixture();
      try {
        const r = verify(dir);
        expect([r.status, r.stdout]).toEqual([0, '']);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it('refuses a one-byte edit, an unlisted file, a missing listed file, and a version that is not the package version', () => {
      const cases: [string, (dir: string) => void, RegExp][] = [
        ['a one-byte edit of a script', (d) => writeFileSync(path.join(d, 'assets', 'frame', 'guard.js'), '"use strict";\r'), /frame\/guard\.js/],
        // Same length and no CSP hash source: only the sha256 can tell.
        ['a one-byte edit of a stylesheet', (d) => writeFileSync(path.join(d, 'assets', 'reader.css'), 'a{color:rad}\n'), /reader\.css: its sha256 is not the listed one/],
        ['an unlisted file', (d) => writeFileSync(path.join(d, 'assets', 'frame', 'extra.js'), ''), /frame\/extra\.js.*not listed/],
        ['a missing listed file', (d) => rmSync(path.join(d, 'assets', 'fonts', 'x.woff2')), /fonts\/x\.woff2.*missing/],
        ['another version', (d) => writeFileSync(path.join(d, 'package.json'), JSON.stringify({ name: '@scope/fixture', version: '1.2.4' })), /version/],
      ];
      for (const [what, change, says] of cases) {
        const dir = fixture();
        try {
          change(dir);
          const r = verify(dir);
          expect(r.status, what).toBe(1);
          expect(String(r.stderr), what).toMatch(says);
          expect(r.stdout, what).toBe('');
        } finally {
          rmSync(dir, { recursive: true, force: true });
        }
      }
    });

    it('refuses, each through its own check and nothing else: another package name, a path outside assets/, an unsorted listing, a path listed twice, a wrong byte count, a wrong CSP hash source (review E2)', () => {
      type Listing = { package: string; files: Record<string, unknown>[] };
      const relist = (d: string, edit: (m: Listing) => void): void => {
        const at = path.join(d, 'assets', 'assets.json');
        const m = JSON.parse(readFileSync(at, 'utf8')) as Listing;
        edit(m);
        writeFileSync(at, `${JSON.stringify(m, null, 2)}\n`);
      };
      const entry = (m: Listing, p: string): Record<string, unknown> => {
        const e = m.files.find((f) => f['path'] === p);
        if (e === undefined) throw new Error(`no entry ${p}`);
        return e;
      };
      const cases: [string, (dir: string) => void, RegExp][] = [
        ['another package name', (d) => writeFileSync(path.join(d, 'package.json'), JSON.stringify({ name: '@scope/other', version: '1.2.3' })), /^verify-assets: assets\/assets\.json: package @scope\/fixture, not @scope\/other$/],
        [
          // A real file with its true sha256 and bytes: without the path check, nothing else would refuse it.
          'a listed path outside assets/',
          (d) =>
            relist(d, (m) => {
              const data = readFileSync(path.join(d, 'package.json'));
              m.files.unshift({ path: '../package.json', sha256: sha256(data).toString('hex'), bytes: data.length, kind: 'text' });
            }),
          /^verify-assets: assets\/assets\.json: a listed path is not a relative path under assets\/$/,
        ],
        ['an unsorted listing', (d) => relist(d, (m) => m.files.reverse()), /^verify-assets: assets\/assets\.json: the files are not sorted by path$/],
        ['a path listed twice', (d) => relist(d, (m) => m.files.splice(1, 0, { ...m.files[1] })), /^verify-assets: assets\/assets\.json: a path is listed twice$/],
        ['a wrong byte count', (d) => relist(d, (m) => (entry(m, 'reader.css')['bytes'] = 14)), /^verify-assets: assets\/reader\.css: 13 bytes, listed as 14$/],
        ['a wrong CSP hash source', (d) => relist(d, (m) => (entry(m, 'frame/guard.js')['csp'] = `'sha256-${'A'.repeat(43)}='`)), /^verify-assets: assets\/frame\/guard\.js: its CSP hash source is not the listed one$/],
      ];
      for (const [what, change, says] of cases) {
        const dir = fixture();
        try {
          change(dir);
          const r = verify(dir);
          expect(r.status, what).toBe(1);
          expect(String(r.stderr).split('\n').filter((l) => l !== ''), what).toEqual([expect.stringMatching(says)]);
          expect(r.stdout, what).toBe('');
        } finally {
          rmSync(dir, { recursive: true, force: true });
        }
      }
    });

    it('a bad command line exits 2', () => {
      expect(spawnSync(process.execPath, [VERIFY, '--other'], { encoding: 'utf8' }).status).toBe(2);
      expect(spawnSync(process.execPath, [VERIFY, '--root'], { encoding: 'utf8' }).status).toBe(2);
    });
  });
});

describe('L3.M17: the free-global list', () => {
  it('scans all four bundled scripts, holds at most 512 names, and is what the bootstrap pins', () => {
    const b = built();
    expect(Object.keys(b.freeGlobals.first).sort()).toEqual([...SCANNED].sort());
    expect(Object.keys(b.freeGlobals.second).sort()).toEqual([...SCANNED].sort());
    for (const n of SCANNED) expect(b.freeGlobals.first[n]?.reads.length ?? 0, n).toBeGreaterThan(0);
    const names = b.freeGlobals.names;
    expect(names.length).toBeLessThanOrEqual(MAX_FREE_GLOBALS);
    expect(MAX_FREE_GLOBALS).toBe(512);
    const union = new Set(SCANNED.flatMap((n) => b.freeGlobals.first[n].reads));
    expect(names).toEqual([...union].filter((r) => !(r in FREE_GLOBALS_ALLOWLIST)).sort());
    // One name read by each script alone shows each was scanned.
    const only = (n: (typeof SCANNED)[number]): string[] =>
      b.freeGlobals.first[n].reads.filter((r) => SCANNED.every((m) => m === n || !b.freeGlobals.first[m].reads.includes(r)));
    expect(only('mermaid')).toContain('__mermaidProfiler');
    expect(only('bootstrap').length + only('enhance').length).toBeGreaterThan(0);
  });

  it("C90 (5): Mermaid's two lazily read globals are pinned; the two names it writes are left unpinned, through the reviewed allowlist", () => {
    const b = built();
    expect(b.freeGlobals.names).toContain('__mermaidProfiler');
    expect(b.freeGlobals.names).toContain('mermaidCaptureSizes');
    expect(b.freeGlobals.names).not.toContain('injected');
    expect(b.freeGlobals.names).not.toContain('fastdom');
    expect(Object.keys(FREE_GLOBALS_ALLOWLIST).sort()).toEqual(['fastdom', 'injected']);
    for (const why of Object.values(FREE_GLOBALS_ALLOWLIST)) expect(why).toMatch(/\S{8}/);
    // The scan sees Mermaid's static write of `injected`; fastdom's write through its IIFE parameter it cannot see, so
    // the allowlist holds `fastdom` too, and any read the scan does see of it is never pinned.
    expect(b.freeGlobals.first.mermaid.writes).toEqual(['injected']);
    for (const n of ['guard', 'bootstrap', 'enhance'] as const) expect(b.freeGlobals.first[n].writes, n).toEqual([]);
  });

  it('process, module, exports, global and define are on the list or defined away; require is never defined away', () => {
    const b = built();
    for (const name of ['process', 'module', 'exports', 'global', 'define']) {
      const read = SCANNED.some((n) => (b.freeGlobals.first[n]?.reads ?? []).includes(name));
      expect(b.freeGlobals.names.includes(name) || (FREE_DEFINES[name] === 'undefined' && !read), name).toBe(true);
    }
    expect(Object.keys(FREE_DEFINES)).not.toContain('require');
  });

  it('a planted bare read, globalThis.__probeName, window["showProbe"] and a read through `const g = globalThis` each appear; locals, parameters, computed keys, indices and a rewritten alias do not', () => {
    const fixture = [
      '"use strict";',
      '(() => {',
      '  const g = globalThis;',
      '  const h = g;',
      '  const a = probeBare();',
      '  const b = globalThis.__probeName, c = window["showProbe"], d = self?.selfProbe, e = window[`tickProbe`];',
      '  const f = g.aliasProbe + h.chainProbe;',
      '  const { destructProbe, renamed: x } = window;',
      '  if (typeof probeTypeof === "undefined") return;',
      '  function inner(self) { return self.paramProbe + arguments.length; }',
      '  { const window = { localProbe: 1 }; window.localProbe; }',
      '  let w = globalThis; w = {}; w.rewrittenProbe;',
      '  const k = "computedProbe"; globalThis[k]; window[0];',
      '  const o = { keyProbe: 1 }; o.keyProbe; label: for (;;) break label;',
      '  return [a, b, c, d, e, f, destructProbe, x, inner];',
      '})();',
    ].join('\n');
    const s = scanScript('fixture', fixture);
    for (const name of ['probeBare', '__probeName', 'showProbe', 'selfProbe', 'tickProbe', 'aliasProbe', 'chainProbe', 'destructProbe', 'renamed', 'probeTypeof']) {
      expect(s.reads, name).toContain(name);
    }
    for (const name of ['paramProbe', 'localProbe', 'rewrittenProbe', 'computedProbe', 'keyProbe', '0', 'arguments', 'g', 'h', 'k', 'label', 'inner', 'x']) {
      expect(s.reads, name).not.toContain(name);
    }
    expect(s.writes).toEqual([]);
    expect(s.aliases).toEqual(['g', 'h']);
  });

  it('a planted assignment of a free name or of a member of the global is reported, and fails the build unless allowlisted', () => {
    const writes = scanScript('w', '"use strict";(() => { probeWrite = 1; globalThis.memberWrite = 2; window["keyWrite"] ??= 3; self.countWrite++; [arrWrite] = [1]; ({ objWrite } = {}); for (forWrite of []) ; })();').writes;
    expect(writes).toEqual(['arrWrite', 'countWrite', 'forWrite', 'keyWrite', 'memberWrite', 'objWrite', 'probeWrite']);
    expect(() => freeGlobalList(scanFreeGlobals({ w: 'globalThis.memberWrite = 1;' }), [])).toThrow(/w writes the global name memberWrite/);
    expect(freeGlobalList(scanFreeGlobals({ w: 'globalThis.injected ??= {}; x;' }), ['injected'])).toEqual(['globalThis', 'x']);
    const b = built();
    for (const plant of ['probeAssigned = 1;', 'globalThis.memberAssigned = 1;']) {
      const p = problems(bundleOf(b, { enhance: `${b.files.enhance.text};${plant}\n` }));
      expect(p.some((m) => m.includes('enhance writes the global name')), plant).toBe(true);
    }
  });

  it('more than 512 names fail the build', () => {
    const many = Array.from({ length: 513 }, (_, i) => `p${String(i)};`).join('');
    expect(() => freeGlobalList(scanFreeGlobals({ many }), [])).toThrow(/513 free globals, over 512/);
  });

  it("the final bootstrap embeds the list once, its second scan equals the first, and a bootstrap the list does not match fails the build", () => {
    const b = built();
    const text = b.files.bootstrap.text;
    expect(text.split(JSON.stringify(b.freeGlobals.names))).toHaveLength(2);
    expect(scanScript('bootstrap', text)).toEqual(b.freeGlobals.first.bootstrap);
    expect(b.freeGlobals.second).toEqual(b.freeGlobals.first);
    // A read added after the list was made: the second scan differs, and the list no longer covers it.
    const p = problems(bundleOf(b, { bootstrap: `${text};lateProbe;\n` }));
    expect(p.some((m) => m.includes('second scan'))).toBe(true);
    const q = problems(bundleOf(b, { enhance: `${b.files.enhance.text};lateEnhanceProbe;\n` }));
    expect(q.some((m) => m.includes('lateEnhanceProbe'))).toBe(true);
  });

  it('a bootstrap that carries the list no times, or twice, fails the build through the embedding check alone (review E3)', () => {
    const b = built();
    const text = b.files.bootstrap.text;
    const list = JSON.stringify(b.freeGlobals.names);
    expect(text.split(list)).toHaveLength(2);
    const once = 'free-globals: the bootstrap does not carry the list exactly once';
    expect(problems(bundleOf(b, { bootstrap: text.replace(list, '[]') }))).toEqual([once]);
    expect(problems(bundleOf(b, { bootstrap: `${text};${list};\n` }))).toEqual([once]);
  });

  it('in a document, with the list pinned first, the Mermaid frame file evaluates and registers (no pinned name is one it writes)', () => {
    const b = built();
    interface Win {
      readonly document: { readonly head: { appendChild(e: unknown): unknown }; createElement(n: string): { textContent: string }; addEventListener(t: string, f: (e: { detail: unknown }) => void, c: boolean): void };
      addEventListener(t: string, f: (e: { error: unknown }) => void): void;
      close(): void;
    }
    const { JSDOM } = createRequire(import.meta.url)('jsdom') as { JSDOM: new (html: string, o: Record<string, unknown>) => { window: Win } };
    const win = new JSDOM('<!doctype html><html><head></head><body></body></html>', { runScripts: 'dangerously', pretendToBeVisual: true }).window;
    try {
      pinFreeGlobals(win, b.freeGlobals.names);
      const errors: unknown[] = [];
      win.addEventListener('error', (e) => errors.push(e.error));
      const names: unknown[] = [];
      win.document.addEventListener('docserver:register', (e) => names.push((e.detail as { name: unknown }).name), true);
      const script = win.document.createElement('script');
      script.textContent = b.files.mermaid.text;
      win.document.head.appendChild(script);
      expect(errors.map(String)).toEqual([]);
      expect(names).toEqual(['mermaid']);
      expect(Object.getOwnPropertyDescriptor(win, '__mermaidProfiler')).toEqual({ value: undefined, writable: false, enumerable: false, configurable: false });
    } finally {
      win.close();
    }
  }, 120_000);
});

describe('L3.M18: the size budgets', () => {
  it('the budgets are the plan\'s: guard 4 KiB, bootstrap 32 KiB, enhance 512 KiB, frame CSS 1 MiB, Mermaid 4 MiB, tarball 8 MiB', () => {
    expect(ASSET_BUDGETS).toEqual({ guard: 4096, bootstrap: 32768, enhance: 524288, css: 1048576, mermaid: 4194304, tarball: 8388608 });
  });

  it('each asset is within its budget', () => {
    const b = built();
    for (const n of NAMES) expect(b.files[n].bytes, n).toBeLessThanOrEqual(ASSET_BUDGETS[n]);
  });

  it('an asset one byte over its budget fails the build, named', () => {
    const b = built();
    const pad = ASSET_BUDGETS.guard - b.files.guard.bytes + 1;
    const p = problems(bundleOf(b, { guard: `${b.files.guard.text}${' '.repeat(pad)}` }));
    expect(p.filter((m) => m.startsWith('frame/guard.js: ') && m.includes('over its budget'))).toHaveLength(1);
    const at = problems(bundleOf(b, { guard: `${b.files.guard.text}${' '.repeat(pad - 1)}` }));
    expect(at).toEqual([]);
  });
});

describe('the OFL notice in frame/reader.css', () => {
  it("opens the stylesheet as a `/*!` comment holding both fonts' copyright lines from THIRD-PARTY-NOTICES, their reserved font name and the licence sentence", () => {
    const css = built().files.css.text;
    expect(css.startsWith('/*!')).toBe(true);
    const notice = css.slice(0, css.indexOf('*/') + 2);
    const notices = readFileSync(path.join(ROOT, 'THIRD-PARTY-NOTICES'), 'utf8');
    const lines = notices.split('\n').filter((l) => /^ {2}Source (?:Serif 4|Sans 3):/.test(l)).map((l) => l.trim().replace(/\s+/g, ' '));
    expect(lines).toHaveLength(2);
    for (const l of lines) expect(notice).toContain(l);
    expect(notice.split('Reserved Font Name ‘Source’')).toHaveLength(3);
    expect(notice).toContain('Licensed under the SIL Open Font License 1.1, see fonts/OFL.txt');
  });

  it('fontNotice refuses a notices file without exactly two font lines, a font line naming no reserved font name, and one that would end the comment (review E3)', () => {
    const notices = readFileSync(path.join(ROOT, 'THIRD-PARTY-NOTICES'), 'utf8');
    const lines = notices.split('\n');
    const sans = lines.findIndex((l) => /^ {2}Source Sans 3:/.test(l));
    expect(sans).toBeGreaterThan(-1);
    const dir = mkdtempSync(path.join(tmpdir(), 'font-notice-'));
    const noticeOf = (text: string): (() => string) => {
      writeFileSync(path.join(dir, 'THIRD-PARTY-NOTICES'), text);
      return () => fontNotice(dir);
    };
    const withSans = (line: string | null): string => lines.flatMap((l, i) => (i !== sans ? [l] : line === null ? [] : [line])).join('\n');
    try {
      expect(noticeOf(notices)()).toBe(fontNotice());
      expect(noticeOf(withSans(null))).toThrow(/THIRD-PARTY-NOTICES gives 1 font copyright lines, not 2/);
      expect(noticeOf(withSans(`${lines[sans] ?? ''}\n${lines[sans] ?? ''}`))).toThrow(/gives 3 font copyright lines, not 2/);
      expect(noticeOf(withSans((lines[sans] ?? '').replace('Reserved Font Name', 'Font Name')))).toThrow(/a font copyright line names no reserved font name/);
      expect(noticeOf(withSans(`${lines[sans] ?? ''} */`))).toThrow(/a font copyright line would end the notice comment/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('package.json: the build wiring', () => {
  it('build runs the Mermaid build, the frame build, then tsc; build:frame and prepack name their scripts', () => {
    const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8')) as { scripts: Record<string, string> };
    expect(pkg.scripts['build']).toBe('npm run build:mermaid && npm run build:frame && tsc -p tsconfig.build.json');
    expect(pkg.scripts['build:frame']).toBe('node scripts/build-frame.mjs');
    expect(pkg.scripts['prepack']).toBe('node scripts/verify-assets.mjs');
  });
});
