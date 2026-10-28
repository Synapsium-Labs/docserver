// The README documents what ships (docserver L1, Task 12; architecture section F T12). Each runtime export of
// both entries, the three default limits, the allowlist, every departure category, the warning that ids may
// collide (ruling C22) and the consumer's corpus call is named there, so a new export or a new departure cannot
// ship undocumented. The words around them are not pinned; the names are.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import * as conformance from '../src/conformance/index.js';
import * as enhance from '../src/enhance/index.js';
import * as render from '../src/render/index.js';

const README = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
const departures = JSON.parse(readFileSync(new URL('../conformance/DEPARTURES.json', import.meta.url), 'utf8')) as {
  category: string;
}[];

/** The categories with no file to move (PD1 compares code as text; PD5, PD6, PD8 and PD9 move no golden), then those that do. */
const CATEGORIES = [...new Set(['PD1', 'PD5', 'PD6', 'PD8', 'PD9', ...departures.map((d) => d.category)])].sort();

describe('README', () => {
  it('names every runtime export of ./render and ./conformance', () => {
    const names = [...Object.keys(render), ...Object.keys(conformance)].sort();
    expect(names).toHaveLength(14);
    expect(names.filter((n) => !README.includes(`\`${n}\``) && !README.includes(`\`${n}(`))).toEqual([]);
  });

  it('states the default limits with their values, the html bound among them', () => {
    expect(README).toContain(`\`DEFAULT_MAX_BYTES\`, ${String(render.DEFAULT_MAX_BYTES)}`);
    expect(README).toContain(`\`DEFAULT_MAX_IMAGES\`, ${String(render.DEFAULT_MAX_IMAGES)}`);
    expect(README).toContain(`| \`maxHtmlBytes\` | ${String(4 * render.DEFAULT_MAX_BYTES)} `);
    expect(README).toContain("`'output-over-limit'`");
  });

  it('warns that ids may collide, so a host never looks an element up by a document id (ruling C22)', () => {
    expect(README).toContain('ids may collide');
    expect(README).toContain('must never look up an element of a rendered document by a document id');
  });

  it('lists every inline tag of the allowlist and the anchor id grammar', () => {
    const missing = render.ALLOWLIST.inlineTags.filter((t) => !README.includes(`\`<${t}>\``));
    expect(missing).toEqual([]);
    expect(README).toContain(`\`${render.ALLOWLIST.anchorId}\``);
  });

  it('states the highlighting bounds, the switch to one line at a time included (ruling C24)', () => {
    expect(README).toContain('a fence with a line over 256 characters');
    expect(README).toContain('256 KiB of highlighted code');
    expect(README).toContain('A fence over 256 characters is highlighted one line at a time');
  });

  it('tells hosts that memory is linear in the input, and that raising maxHtmlBytes lifts the output bound', () => {
    expect(README).toContain('Memory is linear in the size of the input');
    expect(README).toContain('so size `maxBytes` to your heap');
    expect(README).toContain('Raising `maxHtmlBytes` removes the output bound that protects you');
  });

  it('states the span depth bound of highlighted code, and that the 64-level cap is for the allowlisted tags only', () => {
    expect(README).toContain('nests `<span>` elements at most about 170 deep');
    expect(README).toContain('the 64-level cap below applies to the allowlisted tags only');
  });

  it('describes every departure category, one table row each', () => {
    expect(CATEGORIES).toEqual(['PD1', 'PD2', 'PD3', 'PD4', 'PD5', 'PD6', 'PD7', 'PD8', 'PD9']);
    expect(CATEGORIES.filter((c) => README.split(`\n| ${c} | `).length !== 2)).toEqual([]);
  });

  it('PD2 lists the whole of the departure: the scalars, the loader differences (a) to (e), tags, line breaks, null items', () => {
    const row = README.split('\n').find((l) => l.startsWith('| PD2 | ')) ?? '';
    for (const part of [
      '`null` renders empty',
      '(a) array-index keys are listed first',
      '(b) a last block scalar keeps its trailing line feed',
      '(c) a sequence key loads as its items joined by commas',
      '(d) nesting deeper than 100 levels fails the load',
      "(e) merged keys are ordered by JavaScript's object order: a late `<<` puts them last, and a multi-source `<<` list keeps its sources' order, where PyYAML reverses the sources and lists merged keys first",
      'A tag outside the schema (`!!int`, `!!float`, `!!binary`) fails the load',
      'U+0085, U+2028 and U+2029 are not line breaks',
      'A null list item renders empty',
    ]) {
      expect(row).toContain(part);
    }
  });

  it('PD8 distinguishes C31 key truncation from C46 simple-key reference refusal', () => {
    const row = README.split('\n').find((l) => l.startsWith('| PD8 | ')) ?? '';
    for (const text of [
      'a front-matter key is cut to 500 code points, as a value is',
      '1024 source characters',
      'reference refuses the front-matter block',
      'this renderer loads it and cuts the key to 500 code points',
    ]) expect(row).toContain(text);
  });

  it("PD6 covers markdown-it's own Unicode tables: the five Unicode 15.1 symbols, and that the runtime does not matter (ruling C36)", () => {
    const row = README.split('\n').find((l) => l.startsWith('| PD6 | ')) ?? '';
    for (const part of ['uc.micro', 'U+2FFC, U+2FFD, U+2FFE, U+2FFF and U+31EF', '`<p>a*㇯b*</p>`', '`<p>a<em>㇯b</em></p>`', 'does not depend on the runtime']) {
      expect(row).toContain(part);
    }
  });

  it("PD9 names the three surfaces that follow the runtime's Unicode tables (ruling C35)", () => {
    const row = README.split('\n').find((l) => l.startsWith('| PD9 | ')) ?? '';
    expect(row).toContain('Unicode tables follow the runtime, for three surfaces');
    for (const part of ['Heading ids', 'Caption digits', 'Reference labels', '`\\p{Nd}`', '`toLowerCase().toUpperCase()`', '(no file moves)']) {
      expect(row).toContain(part);
    }
  });

  it("shows a consumer's CI call with scanRefs, and the golden-move trailer", () => {
    expect(README).toContain('runCorpus(render, { scanRefs })');
    expect(README).toContain('Goldens-moved: <id>, <id>');
  });

  it('names every runtime export of ./enhance, including goToHash', () => {
    const names = Object.keys(enhance).sort();
    expect(names).toEqual(['EnhanceError', 'destroyEnhancement', 'enhance', 'goToHash', 'setEnhancementPrefs']);
    expect(names.filter((name) => !README.includes(`\`${name}\``) && !README.includes(`\`${name}(`))).toEqual([]);
  });

  it('documents the namespace-derived storage keys and root marker contract', () => {
    for (const text of ['`<namespace>:prefs`', '`<namespace>:ui`', '`<namespace>:pos:<posKey>`', '`<namespace>:doc:<storageKey>:<name>`']) {
      expect(README).toContain(text);
    }
    for (const text of ['`data-docreader-root`', '`data-docreader-chrome`', '`data-theme`', '`data-width`', '`data-font`', '`lens-product`']) {
      expect(README).toContain(text);
    }
  });

  it('documents the checked changes reply, including inclusive bounds, optional removals, caps, clamping and unavailable replies', () => {
    for (const text of [
      '`changes(sha)`', '`{ changed: [from, to][], removedAfter?: number[] }`', 'inclusive source-line bounds',
      '`removedAfter`', 'finite integer', 'no greater than its end', 'very start', '10000 ranges', '10000 deletions',
      'clamped to the line after the document ends', 'getter failure', 'host throw/rejection', 'unavailable reply', 'invalid reply',
    ]) expect(README.includes(text), text).toBe(true);
  });

  it('qualifies strict CSP and Mermaid styling by the reader policy rather than relaxed scripts', () => {
    for (const text of [
      'strict Content Security Policy', 'Mermaid', 'style-src', "'unsafe-inline'", 'scripts remain restricted to the page origin',
    ]) expect(README.includes(text), text).toBe(true);
  });

  it('states the fixed-preview host constraint for transformed, filtered, perspective and containing ancestors', () => {
    for (const text of [
      'fixed-position preview', 'transformed', 'filter', 'perspective', 'containing ancestor', 'host constraint',
    ]) expect(README.includes(text), text).toBe(true);
  });

  it('documents itemLink activation, limits and accepted link results', () => {
    for (const text of [
      '`vocabulary.itemFields`', '`vocabulary.itemHeadings`', 'both default to empty', 'at most 16 keys', 'at most 64 links',
      '1 to 2048 code units', 'white space', 'control character', 'http or https',
    ]) expect(README).toContain(text);
  });
});

// ───────── The L3 sections (docserver L3, Task 12) ─────────
// The frame, the host helper, the highlighter, the bridge and the release are documented in their own sections, each
// found by its `## ` heading. As above, the names are pinned and the words around them are not, except where a row pins
// a host duty a ruling handed to the README (C92(4), C94(3), C96(1), C96(3)) or a value a host copies (L3.H9's hash list,
// the release commands).

/** The lines of the `## <title>` section, its heading excluded, up to the next `## ` heading; '' when there is none. */
function section(title: string): string {
  const lines = README.split('\n');
  const at = lines.findIndex((l) => l === `## ${title}` || l.startsWith(`## ${title}:`));
  if (at < 0) return '';
  const end = lines.findIndex((l, i) => i > at && l.startsWith('## '));
  return lines.slice(at + 1, end < 0 ? lines.length : end).join('\n');
}

/** The fenced blocks of `text` in this language, their bodies only. */
function blocks(text: string, lang: string): string[] {
  return [...text.matchAll(new RegExp('^```' + lang + '\\n([\\s\\S]*?)^```$', 'gm'))].map((m) => m[1] ?? '');
}

const SHA256_SOURCE = /'sha256-[A-Za-z0-9+/]{43}='/g;

/** `./host`'s entry, imported by a specifier this project's typecheck does not follow (src/host needs the DOM library). */
const HOST_ENTRY = '../src/host/index.js';

describe('README: the corpus and the render options after L3 (ledger C92(4))', () => {
  it("the corpus table's counts are the manifest's: 37 golden, 17 hostile, 30 generated", () => {
    const manifest = JSON.parse(readFileSync(new URL('../conformance/manifest.json', import.meta.url), 'utf8')) as { kind: string }[];
    const count = (kind: string): number => manifest.filter((m) => m.kind === kind).length;
    expect([count('golden'), count('hostile'), count('generated')]).toEqual([37, 17, 30]);
    for (const kind of ['golden', 'hostile', 'generated']) expect(README, kind).toContain(`\n| ${kind} | ${String(count(kind))} | `);
  });

  it("render()'s options table has the highlight row: default true, false keeps the wrapper and escapes the code (request (b))", () => {
    const row = README.split('\n').find((l) => l.startsWith('| `highlight` | ')) ?? '';
    expect(row).toContain('`true`');
    expect(row).toContain('`false`');
    expect(row).toContain('escaped text');
  });
});

describe('README: the L3 sections exist and name their entries', () => {
  it('has the Hosting on your own origin, Framing, Hosting, Highlighting, bridge and Release verification sections', () => {
    for (const title of ['Hosting on your own origin', 'Framing', 'Hosting', 'Highlighting', 'The bridge', 'Release verification']) {
      expect(section(title), title).not.toBe('');
    }
  });

  it('names every runtime export of ./frame, ./host and ./highlight', async () => {
    const names = [
      ...Object.keys(await import('../src/frame/index.js')),
      // A specifier held in a variable, so this project (no DOM library) does not typecheck src/host (tsconfig.host.json does).
      ...Object.keys((await import(HOST_ENTRY)) as object),
      ...Object.keys(await import('../src/highlight/index.js')),
    ].sort();
    expect(names).toHaveLength(28);
    expect(names.filter((n) => !README.includes(`\`${n}\``) && !README.includes(`\`${n}(`))).toEqual([]);
  });
});

describe('README: Framing (./frame)', () => {
  it('states the srcdoc order, the refusals by code, the html cap with its value and the srcdoc default', async () => {
    const s = section('Framing');
    const { SEED_HTML_MAX_CHARS } = await import('../src/frame/index.js');
    for (const code of ['not-rendered', 'invalid-input', 'nonce', 'asset-mismatch', 'unsafe-asset', 'csp', 'missing-asset', 'too-large']) {
      expect(s, code).toContain(`| \`${code}\` |`);
    }
    expect(s).toContain(`\`SEED_HTML_MAX_CHARS\`, ${String(SEED_HTML_MAX_CHARS)}`);
    expect(s).toContain('`MAX_SRCDOC_CHARS_DEFAULT`');
    expect(s).toContain('`maxSrcdocChars`');
    for (const part of ['CSP meta', 'click guard', 'seed', 'bootstrap', 'style', '`enhance.js`', '`mermaid.frame.js`']) expect(s, part).toContain(part);
  });
});

describe('README: Hosting (./host)', () => {
  // L3.H9: a page that uses mountDocFrame binds the frame with its own policy (Reference §11.5, FD15, ruling R7).
  it('L3.H9: states the host-page requirement for scripts, style, fonts and images, and the three fallback outcomes', () => {
    const s = section('Hosting');
    for (const part of [
      '`script-src`', '`default-src`', "`'unsafe-inline'`", '`frame/reader.css`', '`font-src`', '`img-src`', '`data:`',
      "`onFallback('timeout')`", "`onFallback('error')`", 'never left partly working',
      'no ready', 'ready, then the frame\'s error',
    ]) {
      expect(s, part).toContain(part);
    }
  });

  it("L3.H9: its hash list is frameCsp()'s four script hashes of this version, in order, and the policy is quoted whole", async () => {
    const { frameCsp } = await import('../src/frame/index.js');
    const s = section('Hosting');
    const policy = frameCsp();
    expect([...s.matchAll(SHA256_SOURCE)].map((m) => m[0])).toEqual(policy.match(SHA256_SOURCE));
    expect(blocks(s, 'text')).toContain(`${policy}\n`);
  });

  it('carries the OFL note: a host that bundles frame/reader.css, or ships a srcdoc built from it, ships fonts/OFL.txt with its notices', () => {
    const s = section('Hosting');
    expect(s).toContain('SIL Open Font License 1.1');
    expect(s).toContain('`fonts/OFL.txt`');
    expect(s).toContain('`THIRD-PARTY-NOTICES`');
  });

  it("names each HostAdapters member and the fallback reasons", () => {
    const s = section('Hosting');
    for (const name of [
      'assets', 'watchdogMs', 'store', 'storePrefix', 'docKey', 'prefs', 'features', 'mermaidGate', 'mermaidDraw', 'title', 'focus',
      'onLink', 'onHash', 'copy', 'changes', 'openVersion', 'onReady', 'onFallback',
    ]) expect(s, name).toContain(`\`${name}\``);
    for (const reason of ['timeout', 'nonce', 'error', 'protocol', 'refusals', 'navigated', 'assets', 'too-large', 'invalid-input']) {
      expect(s, reason).toContain(`\`'${reason}'\``);
    }
  });

  it('states the Mermaid duties handed to the README: no stock Mermaid with start-on-load on, and a stylesheet-hash policy only without Mermaid (ledger C94(3))', () => {
    const all = `${section('Hosting')}\n${section('Hosting on your own origin')}`;
    expect(all).toContain('never load a stock Mermaid with its start-on-load on');
    expect(all).toContain("the package's own Mermaid files have it off");
    // Review S3: an aligned table cell carries a style attribute, which no stylesheet hash admits (measured by
    // test/browser/mermaid-on-request.test.ts), so the stylesheet hash serves neither kind of document.
    expect(section('Hosting')).toContain('serves only documents with neither Mermaid nor an aligned table');
    expect(section('Hosting')).toContain('a `style` attribute, which no stylesheet hash admits');
  });
});

describe('README: Hosting on your own origin (ledger C50, plan Q13)', () => {
  const s = section('Hosting on your own origin');
  const recipes = blocks(s, 'ts');
  /** Each old option, the adapter that replaces it as the recipe's first line names it, and the key the recipe sets. */
  const PAIRS: readonly (readonly [option: string, adapter: string, key: string])[] = [
    ['mermaidUrl', 'mermaid.load', 'load'],
    ['resolveLink', 'onLink', 'onLink'],
    ['changesUrl', 'changes', 'changes'],
    ['bar', 'chrome.bar', 'chrome'],
    ['issue-tracker base', 'itemLink', 'itemLink'],
  ];

  it('L3.H10: names each of the five URL options beside the adapter that replaces it, one recipe each', () => {
    expect(recipes).toHaveLength(5);
    // The option is pinned by the recipe's first line alone, never by a substring the recipe's code happens to hold
    // (`chrome: { bar: false }` holds 'bar'; review EV4); the key it sets is pinned beside it.
    expect(recipes.map((r) => r.split('\n', 1)[0])).toEqual(PAIRS.map(([option, adapter]) => `// ${option} → ${adapter}`));
    for (const [option, adapter, key] of PAIRS) {
      const holding = recipes.filter((r) => r.startsWith(`// ${option} → ${adapter}\n`) && r.includes(`${key}:`));
      expect(holding, `${option} beside ${adapter}`).toHaveLength(1);
    }
  });

  it('L3.H10: every recipe typechecks against EnhanceOptions under the strict settings', () => {
    expect(recipes).toHaveLength(5);
    const dir = fileURLToPath(new URL('./', import.meta.url));
    const files = new Map(recipes.map((r, i) => [path.join(dir, `readme-recipe-${String(i)}.ts`), r.replaceAll("'@synapsium-labs/docserver/enhance'", "'../src/enhance/index.js'")]));
    const options: ts.CompilerOptions = {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      lib: ['lib.es2022.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'],
      types: [],
      strict: true,
      exactOptionalPropertyTypes: true,
      noUncheckedIndexedAccess: true,
      noEmit: true,
      skipLibCheck: true,
    };
    const host = ts.createCompilerHost(options, true);
    const getSourceFile = host.getSourceFile.bind(host);
    const fileExists = host.fileExists.bind(host);
    const readFile = host.readFile.bind(host);
    host.fileExists = (f) => files.has(path.resolve(f)) || fileExists(f);
    host.readFile = (f) => files.get(path.resolve(f)) ?? readFile(f);
    host.getSourceFile = (f, lang, ...rest) => {
      const text = files.get(path.resolve(f));
      return text === undefined ? getSourceFile(f, lang, ...rest) : ts.createSourceFile(f, text, lang, true);
    };
    const program = ts.createProgram([...files.keys()], options, host);
    const diags = ts.getPreEmitDiagnostics(program).map((d) => `${path.basename(d.file?.fileName ?? '')}: ${ts.flattenDiagnosticMessageText(d.messageText, '\n')}`);
    expect(diags).toEqual([]);
    // Each recipe is typed by EnhanceOptions, so a renamed adapter is an excess property, not a silent extra.
    for (const r of recipes) expect(r).toMatch(/: EnhanceOptions = \{/);
  });

  it('L3.H10: the same mapping is named for ./host, whose HostAdapters take onLink, changes, openVersion and mermaidDraw', () => {
    for (const name of ['`HostAdapters`', '`onLink`', '`changes`', '`openVersion`', '`mermaidDraw`']) expect(s, name).toContain(name);
  });

  it('a Mermaid a host supplies offers initialize and render, the two calls the reader makes (ledger C96(1))', () => {
    expect(s).toContain('must offer `initialize` and `render`');
  });

  it('the drawing counter is per copy of the library: a page that bundles ./enhance twice could issue one drawing name twice (ledger C96(3))', () => {
    expect(s).toContain('per copy of the library');
    expect(s).toContain('bundles `./enhance` twice');
  });

  it('uses neutral example.test URLs only', () => {
    const urls = [...s.matchAll(/https?:\/\/[^\s'"`)]+/g)].map((m) => m[0]);
    expect(urls.length).toBeGreaterThan(0);
    expect(urls.filter((u) => !u.startsWith('https://example.test/'))).toEqual([]);
  });
});

describe('README: Highlighting (./highlight)', () => {
  it('names the highlighter, its bounds and the engine, and the render option it pairs with', () => {
    const s = section('Highlighting');
    for (const name of ['`createHighlighter(', '`LANGUAGES`', '`MAX_WHOLE_BLOCK_CHARS`', '`MAX_LINE_CHARS`', '`MAX_DOCUMENT_CHARS`', '`HIGHLIGHT_ENGINE`', '`resolveLanguage(', '`highlight: false`']) {
      expect(s, name).toContain(name);
    }
  });
});

describe('README: the bridge', () => {
  it('lists every op of protocol 1 in its table, with its direction', async () => {
    const { OP_KEYS } = await import('../src/frame/index.js');
    const s = section('The bridge');
    for (const op of Object.keys(OP_KEYS)) expect(s, op).toMatch(new RegExp(`\\n\\| \`${op.replace('.', '\\.')}\` \\| (?:frame to parent|parent to frame) \\|`));
  });

  it("states the fragment grammar and its never-sent rule, the storage keys, both readings of the limits, removedAfter and versioning", async () => {
    const { BRIDGE_LIMITS, DOC_FIELDS, FRAGMENT_ID_GRAMMAR, PREF_KEYS } = await import('../src/frame/index.js');
    const s = section('The bridge');
    expect(s).toContain(`\`${FRAGMENT_ID_GRAMMAR.source}\``);
    expect(s).toContain(`${String(FRAGMENT_ID_GRAMMAR.maxCodeUnits)} UTF-16 code units`);
    expect(s).toContain('never sent and never thrown on');
    for (const k of PREF_KEYS) expect(s).toContain(`\`pref:${k}\``);
    for (const f of DOC_FIELDS) expect(s).toContain(`\`doc:${f}\``);
    expect(s).toContain(`${String(BRIDGE_LIMITS.bucketCapacity)} messages refilled at ${String(BRIDGE_LIMITS.bucketRefillPerSecond)} a second`);
    expect(s).toContain(`${String(BRIDGE_LIMITS.storeSetBucketCapacity)} refilled at ${String(BRIDGE_LIMITS.storeSetRefillPerSecond)} a second`);
    expect(s).toContain(`at most ${String(BRIDGE_LIMITS.frameMaxPerWindow)} messages and ${String(BRIDGE_LIMITS.frameStoreSetMaxPerWindow)} \`store.set\``);
    expect(s).toContain('`removedAfter`');
    expect(s).toContain('`BRIDGE_PROTOCOL`');
    expect(s).toContain('`bridgeCases()`');
  });

  it("scopes the flat rule to what the frame sends, and states the shapes changes.result carries, which the accepted fixtures hold (review T12-C1)", async () => {
    const { bridgeCases } = await import('../src/conformance/index.js');
    const s = section('The bridge');
    // Every key that is neither `v` nor a string, in a message the fixtures accept: changes.result's three alone.
    const shaped = new Set<string>();
    for (const c of bridgeCases().messages) {
      if (c.verdict !== 'accept') continue;
      const m = c.message as Readonly<Record<string, unknown>>;
      for (const [k, v] of Object.entries(m)) if (k !== 'v' && typeof v !== 'string') shaped.add(`${c.direction} ${String(m['t'])} ${k}`);
    }
    expect([...shaped].sort()).toEqual([
      'parent-to-frame changes.result ranges',
      'parent-to-frame changes.result removedAfter',
      'parent-to-frame changes.result unavailable',
    ]);
    expect(s).not.toContain('Every message is a flat object');
    expect(s).toContain('Every message the frame sends is a flat object whose values are strings, except `v`');
    expect(s).toContain('`ranges`, a list of `[from, to]` pairs of integers');
    expect(s).toContain('`removedAfter`, a list of integers');
    expect(s).toContain('`unavailable: true`');
  });
});

describe('README: Release verification', () => {
  it("states the release lane's post-verify commands, verbatim, one per line (plan Reference §13 step 7)", () => {
    const [commands] = blocks(section('Release verification'), 'sh');
    expect(commands?.split('\n').filter((l) => l !== '')).toEqual([
      'npm install @synapsium-labs/docserver@$VERSION --ignore-scripts',
      'npm audit signatures',
      'npm pack @synapsium-labs/docserver@$VERSION',
      'test "$(npm view @synapsium-labs/docserver@$VERSION dist.integrity)" = "sha512-$(openssl dgst -sha512 -binary synapsium-labs-docserver-$VERSION.tgz | openssl base64 -A)"',
      'gh attestation verify synapsium-labs-docserver-$VERSION.tgz --repo Synapsium-Labs/docserver --signer-workflow Synapsium-Labs/docserver/.github/workflows/release.yml',
    ]);
  });

  it('every file a command reads is made by an earlier command: npm pack names the tarball the later two read (reviews T12-C2, S1)', () => {
    const [commands] = blocks(section('Release verification'), 'sh');
    const lines = commands?.split('\n').filter((l) => l !== '') ?? [];
    // npm names a scoped package's tarball as test/pack.test.ts's TARBALL does: the @ dropped, the slash a dash.
    const tarball = `${'@synapsium-labs/docserver'.replace(/^@/, '').replace('/', '-')}-$VERSION.tgz`;
    const made = lines.findIndex((l) => l.startsWith('npm pack @synapsium-labs/docserver@$VERSION'));
    const read = lines.map((l, i) => [l, i] as const).filter(([l]) => l.includes(tarball)).map(([, i]) => i);
    expect(made).toBeGreaterThanOrEqual(0);
    expect(read).toHaveLength(2);
    expect(read.every((i) => i > made)).toBe(true);
  });
});
