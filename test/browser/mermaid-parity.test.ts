// L3.B12: the two Mermaid builds draw the same (docserver L3, Task 4; plan Reference §5.1, FD4, risk R10). Mermaid
// ships twice from one pinned input: assets/mermaid/mermaid.mjs, the import-inert ES module, and
// assets/mermaid/mermaid.frame.js, the classic IIFE the sealed frame runs. scripts/build-mermaid.mjs builds both in
// memory, exactly as `npm run build:mermaid` and `npm run build:frame` write them.
//
// Every diagram of the corpus (each `pre.mermaid` that render() emits for a conformance/corpus document) is drawn once
// with each build, in a page of its own, with the same configuration and the same render id, and the SVG text each
// gives (or the message each fails with) must be equal. The render id is the reader's form (src/enhance/diagrams.ts:
// DRAWING_ID_PREFIX, its U+00B7 included, then `mermaid-` and a number; ledger C95(1)), so both builds are held equal on
// the names the reader draws under. The configuration is the reader's, as src/enhance/diagrams.ts
// exports it (start-on-load off, the `strict` security level, error rendering suppressed, the dagre layout, the text
// and edge caps, the secure keys, the base theme, its font and theme variables); its dompurify lists are not exported
// and stay at Mermaid's defaults on both sides. The clock is fixed at one instant in both pages, so nothing
// time-dependent can tell them apart.
//
// The ES module is loaded as a host loads it (a module script's import); the classic file as the frame's bootstrap
// receives it: a classic script element whose `docserver:register` event this page's own listener (test code, never
// shipped) catches. Both pages are served from https://docreader.test/ under the harness's `reader` policy, and nothing
// else is fetched.
//
// The outcome counts are pinned (how many draw, which fail and why), so a Mermaid move re-baselines this row on
// purpose (Tasks 8 and 13). Task 8 re-ran it on the integrated build and holds that the two files drawn are the bytes
// that ship: the classic file's sha256 is FRAME_MANIFEST's, the one frameDocument verifies, and the module's is
// assets/assets.json's. v1 ships Mermaid 12.1.0 (ledger C93: Task 13's move to 12.2.0 is deferred past v1), so this
// is the 12.1.0 baseline.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, type DefaultTreeAdapterMap } from 'parse5';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { buildMermaid, bundleMermaidFrame, FRAME_OUT_FILE, OUT_FILE } from '../../scripts/build-mermaid.mjs';
import { DRAWING_ID_PREFIX, FONT_FALLBACK, MAX_EDGES, MAX_TEXT_SIZE, secureKeys, THEME_VARIABLES } from '../../src/enhance/diagrams.js';
import { FRAME_MANIFEST } from '../../src/frame/index.js';
import { render } from '../../src/render/index.js';
import { browserFor, closeBrowsers, describeBrowsers, ORIGIN, POLICIES, type BrowserName } from './harness.js';

type Node = DefaultTreeAdapterMap['node'];
type Element = DefaultTreeAdapterMap['element'];

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const CORPUS = path.join(ROOT, 'conformance', 'corpus');

/** The instant both pages' clocks are fixed at. */
const NOW = Date.UTC(2026, 0, 15, 12, 0, 0);

/** One corpus diagram: where it comes from and its source text. */
interface Diagram {
  readonly label: string;
  readonly source: string;
}

/** What one build gave for one diagram: its SVG text, or the message it failed with. */
type Drawn = { readonly svg: string } | { readonly error: string };

function corpusFiles(dir = CORPUS): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? corpusFiles(path.join(dir, e.name)) : e.name.endsWith('.md') ? [path.join(dir, e.name)] : []))
    .sort();
}

const isElement = (n: Node): n is Element => 'tagName' in n;
const textOf = (n: Node): string => ('value' in n && n.nodeName === '#text' ? n.value : 'childNodes' in n ? n.childNodes.map(textOf).join('') : '');

/** Each `pre.mermaid` render() emits for each corpus document, in document order. */
function corpusDiagrams(): Diagram[] {
  const out: Diagram[] = [];
  for (const file of corpusFiles()) {
    const r = render(readFileSync(file, 'utf8'));
    if (r.outcome !== 'rendered') continue;
    let n = 0;
    const visit = (node: Node): void => {
      if (isElement(node) && node.tagName === 'pre' && (node.attrs.find((a) => a.name === 'class')?.value ?? '').split(/\s+/).includes('mermaid')) {
        out.push({ label: `${path.relative(CORPUS, file)}#${String(++n)}`, source: textOf(node) });
      }
      if ('childNodes' in node) for (const c of node.childNodes) visit(c);
    };
    visit(parse(r.html));
  }
  return out;
}

/** The reader's configuration, as src/enhance/diagrams.ts exports it. */
const CONFIG = {
  startOnLoad: false,
  securityLevel: 'strict',
  suppressErrorRendering: true,
  layout: 'dagre',
  maxTextSize: MAX_TEXT_SIZE,
  maxEdges: MAX_EDGES,
  secure: [...secureKeys()],
  theme: 'base',
  fontFamily: FONT_FALLBACK,
  themeVariables: { ...THEME_VARIABLES, fontFamily: FONT_FALLBACK },
};

/** The page's own listener: it keeps the API the classic file registers, then marks the page ready. */
const LISTEN = [
  "document.addEventListener('docserver:register', (e) => {",
  "  if (e.detail && e.detail.name === 'mermaid') {",
  '    window.__mermaid = e.detail.api;',
  "    document.documentElement.setAttribute('data-ready', 'classic');",
  '  }',
  '}, true);',
  '',
].join('\n');

/** The module page's script: import the ES module's default export, keep it, mark the page ready. */
const IMPORT = [`import mermaid from '/${OUT_FILE}';`, 'window.__mermaid = mermaid;', "document.documentElement.setAttribute('data-ready', 'module');", ''].join('\n');

function pageHtml(kind: 'module' | 'classic'): string {
  const loader = kind === 'module' ? '<script type="module" src="/import.mjs"></script>' : `<script src="/${FRAME_OUT_FILE}"></script>`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Mermaid parity page</title>
<script src="/listen.js"></script>
${loader}
</head>
<body></body>
</html>
`;
}

let diagrams: Diagram[] = [];
let esmFile: Uint8Array = new Uint8Array();
let frameFile: Uint8Array = new Uint8Array();

beforeAll(async () => {
  diagrams = corpusDiagrams();
  esmFile = (await buildMermaid()).contents;
  frameFile = (await bundleMermaidFrame()).contents;
}, 300_000);

afterAll(closeBrowsers);

interface PageRun {
  readonly ready: string | null;
  readonly drawn: readonly Drawn[];
  readonly aborted: readonly string[];
  readonly missing: readonly string[];
}

/** Open the page of one build in a fresh context, its clock fixed at NOW, and draw every diagram with it in turn. */
async function drawAll(browser: BrowserName, kind: 'module' | 'classic'): Promise<PageRun> {
  const files = new Map<string, { body: string | Uint8Array; type: string }>([
    ['/', { body: pageHtml(kind), type: 'text/html; charset=utf-8' }],
    ['/listen.js', { body: LISTEN, type: 'text/javascript; charset=utf-8' }],
    ['/import.mjs', { body: IMPORT, type: 'text/javascript; charset=utf-8' }],
    [`/${OUT_FILE}`, { body: esmFile, type: 'text/javascript; charset=utf-8' }],
    [`/${FRAME_OUT_FILE}`, { body: frameFile, type: 'text/javascript; charset=utf-8' }],
  ]);
  const context = await (await browserFor(browser)).newContext({ viewport: { width: 1000, height: 800 }, serviceWorkers: 'block' });
  const aborted: string[] = [];
  const missing: string[] = [];
  try {
    await context.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      const f = url.origin === ORIGIN ? files.get(url.pathname) : undefined;
      if (url.origin !== ORIGIN) {
        aborted.push(url.href);
        await route.abort('blockedbyclient');
      } else if (f === undefined) {
        missing.push(url.pathname);
        await route.fulfill({ status: 404, body: '' });
      } else {
        const headers: Record<string, string> = { 'content-type': f.type };
        if (url.pathname === '/') headers['content-security-policy'] = POLICIES.reader;
        await route.fulfill({ status: 200, headers, body: Buffer.from(f.body) });
      }
    });
    const page = await context.newPage();
    await page.clock.setFixedTime(NOW);
    await page.goto(`${ORIGIN}/`);
    await page.waitForFunction(() => document.documentElement.hasAttribute('data-ready'), null, { timeout: 45_000 });
    const ready = await page.evaluate(() => document.documentElement.getAttribute('data-ready'));
    const drawn = await page.evaluate(
      async ({ sources, config, prefix }) => {
        const api = (window as unknown as { __mermaid: { initialize(c: unknown): void; render(id: string, text: string): Promise<{ svg: string }> } }).__mermaid;
        const out: ({ svg: string } | { error: string })[] = [];
        for (let i = 0; i < sources.length; i++) {
          api.initialize(structuredClone(config));
          try {
            out.push({ svg: (await api.render(`${prefix}mermaid-${String(i)}`, sources[i] ?? '')).svg });
          } catch (e) {
            out.push({ error: String((e as { message?: unknown } | null)?.message ?? e) });
          }
        }
        return out;
      },
      { sources: diagrams.map((d) => d.source), config: CONFIG, prefix: DRAWING_ID_PREFIX },
    );
    return { ready, drawn, aborted: [...aborted], missing: [...missing] };
  } finally {
    await context.close();
  }
}

/**
 * The pinned outcome (measured on Mermaid 12.1.0): every corpus diagram draws but these nine, which the corpus holds on
 * purpose (fences that are no diagram, a caption spoof, an injection attempt, front matter Mermaid refuses), each
 * failing with Mermaid's own message, the same on both builds.
 */
const NO_TYPE = /^No diagram type detected matching given configuration for text: /;
const FAILS: Readonly<Record<string, RegExp>> = {
  'figure-captions.md#4': NO_TYPE,
  'figure-captions.md#5': NO_TYPE,
  'figure-captions.md#6': NO_TYPE,
  'figure-captions.md#7': NO_TYPE,
  'h-fence-injection.md#1': /^Parse error on line 4:\n/,
  'mermaid-figures.md#5': NO_TYPE,
  'mermaid-figures.md#6': NO_TYPE,
  'mermaid-figures.md#7': NO_TYPE,
  'mermaid-figures.md#13': /^Parse error on line 1:\n---title: Kinds---\n/,
};

const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

it('L3.B12: the two files drawn are the bytes that ship: the classic file is the manifest\'s, the module assets.json\'s', () => {
  const listed = (JSON.parse(readFileSync(path.join(ROOT, 'assets', 'assets.json'), 'utf8')) as { files: { path: string; sha256: string }[] }).files;
  expect(sha256(frameFile)).toBe(FRAME_MANIFEST.mermaid.sha256);
  expect(listed.find((f) => f.path === FRAME_MANIFEST.mermaid.path)?.sha256).toBe(sha256(frameFile));
  expect(listed.find((f) => f.path === OUT_FILE.replace(/^assets\//, ''))?.sha256).toBe(sha256(esmFile));
});

describeBrowsers((browser) => {
  it('L3.B12: the ES module and the classic frame file give equal SVG text for every corpus diagram', async () => {
    expect(diagrams.length).toBe(29);
    expect(diagrams.length - Object.keys(FAILS).length).toBe(20);
    const esm = await drawAll(browser, 'module');
    const classic = await drawAll(browser, 'classic');
    expect([esm.ready, classic.ready]).toEqual(['module', 'classic']);
    for (const run of [esm, classic]) expect({ aborted: run.aborted, missing: run.missing }).toEqual({ aborted: [], missing: [] });
    expect(classic.drawn.length).toBe(diagrams.length);
    expect(esm.drawn.length).toBe(diagrams.length);
    // One labelled comparison per diagram, so a difference names the diagram it is in.
    const differ = diagrams.flatMap((d, i) => {
      const a = esm.drawn[i];
      const b = classic.drawn[i];
      return JSON.stringify(a) === JSON.stringify(b) ? [] : [{ diagram: d.label, module: a, classic: b }];
    });
    expect(differ).toEqual([]);
    const failed = Object.fromEntries(diagrams.flatMap((d, i) => {
      const r = esm.drawn[i];
      return r !== undefined && 'error' in r ? [[d.label, r.error]] : [];
    }));
    expect(Object.keys(failed).sort()).toEqual(Object.keys(FAILS).sort());
    for (const [label, re] of Object.entries(FAILS)) expect(failed[label], label).toMatch(re);
    // A drawing is a real SVG: each holds its render id, the reader's prefix and its dot included.
    diagrams.forEach((d, i) => {
      const r = esm.drawn[i];
      if (r !== undefined && 'svg' in r) expect(r.svg, d.label).toMatch(new RegExp(`^<svg [^>]*id="${DRAWING_ID_PREFIX}mermaid-${String(i)}"`));
    });
  }, 240_000);
});
