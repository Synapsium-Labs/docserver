// The Mermaid file in a real browser (docserver L2, Task 15; LD3, LD4; spec §3.4 and §4.2). scripts/build-mermaid.mjs
// builds it in memory, exactly as `npm run build:mermaid` writes it (the same bytes, test/mermaid-bundle.test.ts), and
// the page loads it from the test origin the way a host's module script would: `import mermaid from
// '/assets/mermaid/mermaid.mjs'`, its default export, with nothing else to fetch. Under the `reader` policy (harness.ts:
// default-src 'none', scripts from the origin only, no 'unsafe-eval', inline styles allowed for Mermaid's own) it
// draws one flowchart with the reader's security level, `strict`: the file needs no code from strings and no other
// file, and the page reports no violation but its own probe's. The probe is an inline script, which the policy must
// refuse, so a page served without the policy fails here. Under the `strict` policy the same drawing has its injected
// styles refused, which is why diagrams need `reader` (§4.2).
//
// The layout. Mermaid 12.1.0's default configuration sets `layout: 'elk'`, and this file leaves elkjs out (LD3), so the
// page asks for `layout: 'dagre'`; with the default, the drawing fails with the stand-in's message, which the third
// case pins (what the reader configures is Task 21's).
//
// Import-inert. Mermaid's own code listens for the window's load event and, with its `startOnLoad` default, draws every
// `.mermaid` element of the document then. The file switches that off on the object it exports, so a page that only
// imports it, before its load event and without calling initialize(), keeps its `pre.mermaid` exactly as written: no
// SVG, no data-processed, the source text whole (the fourth case). Drawing happens only when the reader asks.
//
// The page is this file's own, served through its own route: the harness's page carries the reader, which is not
// what is under test here.
import { afterAll, beforeAll, expect, it } from 'vitest';
import { buildMermaid, OUT_FILE } from '../../scripts/build-mermaid.mjs';
import { ELK_LEFT_OUT } from '../../scripts/mermaid-elk-stub.mjs';
import { browserFor, closeBrowsers, describeBrowsers, ORIGIN, POLICIES, type BrowserName, type PolicyName } from './harness.js';

/** The diagram drawn: two nodes and one edge. */
const SOURCE = 'flowchart LR\n  A[Start here] --> B[Done]';

/** Runs first, in the head: it records every policy violation the page reports. */
const WATCH = [
  'window.__violations = [];',
  "document.addEventListener('securitypolicyviolation', (e) => {",
  "  window.__violations.push(e.effectiveDirective + ' ' + (e.blockedURI === '' ? 'inline' : e.blockedURI));",
  '});',
  '',
].join('\n');

/**
 * The page's module script: import the file's default export, initialise it with the reader's security level (and
 * `layout: 'dagre'` when the page's query asks for it), draw the diagram, and say how that ended.
 */
const DRAW = [
  `import mermaid from '/${OUT_FILE}';`,
  'const html = document.documentElement;',
  "const layout = new URLSearchParams(location.search).get('layout');",
  'try {',
  "  mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', ...(layout === 'dagre' ? { layout: 'dagre' } : {}) });",
  "  await mermaid.run({ nodes: [document.querySelector('pre.mermaid')] });",
  "  html.setAttribute('data-drawn', 'ok');",
  '} catch (e) {',
  "  html.setAttribute('data-drawn', 'failed: ' + String(e?.message ?? e));",
  '}',
  '',
].join('\n');

/** How long the import-only page watches its `pre.mermaid` after the load event, in ms (a draw takes well under 1 s). */
const IMPORT_WATCH_MS = 4000;

/**
 * The import-only page's module script: import the file and call nothing. After the load event it watches the
 * `pre.mermaid` for IMPORT_WATCH_MS, and says whether Mermaid touched it (data-processed, an SVG, or other text).
 */
const IMPORT_ONLY = [
  `import mermaid from '/${OUT_FILE}';`,
  'const html = document.documentElement;',
  "html.setAttribute('data-start-on-load', String(mermaid.startOnLoad));",
  "const pre = document.querySelector('pre.mermaid');",
  'const source = pre.textContent;',
  "const touched = () => pre.hasAttribute('data-processed') || pre.querySelector('svg') !== null || pre.textContent !== source;",
  "window.addEventListener('load', () => {",
  '  const started = performance.now();',
  '  const tick = () => {',
  "    if (touched()) html.setAttribute('data-drawn', 'touched');",
  `    else if (performance.now() - started > ${String(IMPORT_WATCH_MS)}) html.setAttribute('data-drawn', 'untouched');`,
  '    else setTimeout(tick, 50);',
  '  };',
  '  setTimeout(tick, 0);',
  '});',
  '',
].join('\n');

const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Mermaid file test page</title>
<script src="/watch.js"></script>
</head>
<body>
<pre class="mermaid">${SOURCE.replace('>', '&gt;')}</pre>
<script>document.documentElement.setAttribute('data-inline-ran', '');</script>
<script type="module" src="/draw.mjs"></script>
</body>
</html>
`;

let file: Uint8Array = new Uint8Array();

beforeAll(async () => {
  file = (await buildMermaid()).contents;
}, 300_000);

afterAll(closeBrowsers);

interface Drawn {
  readonly drawn: string | null;
  readonly inlineRan: boolean;
  readonly violations: readonly string[];
  readonly svg: { readonly role: string | null; readonly nodes: number; readonly edges: number; readonly styles: number; readonly text: string } | null;
  readonly startOnLoad: string | null;
  readonly pre: { readonly processed: string | null; readonly text: string };
  readonly aborted: readonly string[];
  readonly missing: readonly string[];
}

/**
 * Open the page under `policy` in a fresh context, its module script DRAW (or IMPORT_ONLY), wait for the drawing (or
 * the watch) to end, and read what it left.
 */
async function draw(browser: BrowserName, policy: PolicyName, layout: 'dagre' | 'default' = 'dagre', script = DRAW): Promise<Drawn> {
  const files = new Map<string, { body: string | Uint8Array; type: string }>([
    ['/', { body: PAGE, type: 'text/html; charset=utf-8' }],
    ['/watch.js', { body: WATCH, type: 'text/javascript; charset=utf-8' }],
    ['/draw.mjs', { body: script, type: 'text/javascript; charset=utf-8' }],
    [`/${OUT_FILE}`, { body: file, type: 'text/javascript; charset=utf-8' }],
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
        if (url.pathname === '/') headers['content-security-policy'] = POLICIES[policy];
        await route.fulfill({ status: 200, headers, body: Buffer.from(f.body) });
      }
    });
    const page = await context.newPage();
    await page.goto(`${ORIGIN}/?layout=${layout}`);
    await page.waitForFunction(() => document.documentElement.hasAttribute('data-drawn'), null, { timeout: 45_000 });
    const got = await page.evaluate(() => {
      const svg = document.querySelector('pre.mermaid svg');
      const pre = document.querySelector('pre.mermaid');
      return {
        drawn: document.documentElement.getAttribute('data-drawn'),
        startOnLoad: document.documentElement.getAttribute('data-start-on-load'),
        pre: { processed: pre?.getAttribute('data-processed') ?? null, text: pre?.textContent ?? '' },
        inlineRan: document.documentElement.hasAttribute('data-inline-ran'),
        violations: [...(window as unknown as { __violations: string[] }).__violations],
        svg:
          svg === null
            ? null
            : {
                role: svg.getAttribute('aria-roledescription'),
                nodes: svg.querySelectorAll('g.node').length,
                edges: svg.querySelectorAll('path.flowchart-link').length,
                styles: Array.from(svg.querySelectorAll('style')).filter((s) => s.sheet !== null && s.sheet.cssRules.length > 0).length,
                text: (svg.textContent ?? '').replace(/\s+/g, ' ').trim(),
              },
      };
    });
    return { ...got, aborted: [...aborted], missing: [...missing] };
  } finally {
    await context.close();
  }
}

/** A violation the page's own probe causes: its inline script, refused. */
const PROBE = /^script-src(?:-elem)? inline$/;

describeBrowsers((browser) => {
  it('loads under the reader policy and draws a flowchart: one file, nothing else fetched, no violation but the probe\'s', async () => {
    const got = await draw(browser, 'reader');
    expect(got.drawn).toBe('ok');
    expect(got.svg).toMatchObject({ role: 'flowchart-v2', nodes: 2, edges: 1 });
    expect(got.svg?.text).toContain('Start here');
    expect(got.svg?.text).toContain('Done');
    // Mermaid's injected styles apply: the reader policy allows them.
    expect(got.svg?.styles).toBeGreaterThan(0);
    // The policy is in force: the inline probe was refused, and nothing else was.
    expect(got.inlineRan).toBe(false);
    expect(got.violations.filter((v) => PROBE.test(v)).length).toBeGreaterThan(0);
    expect(got.violations.filter((v) => !PROBE.test(v))).toEqual([]);
    expect({ aborted: got.aborted, missing: got.missing }).toEqual({ aborted: [], missing: [] });
  });

  it('under the strict policy the drawing\'s injected styles are refused: diagrams need the reader policy', async () => {
    const got = await draw(browser, 'strict');
    expect(got.drawn).toBe('ok');
    expect(got.svg).toMatchObject({ role: 'flowchart-v2', nodes: 2, edges: 1 });
    expect(got.inlineRan).toBe(false);
    expect(got.violations.filter((v) => /^style-src(?:-elem)? inline$/.test(v)).length).toBeGreaterThan(0);
    expect(got.svg?.styles ?? 0).toBe(0);
  });

  it('with Mermaid\'s default layout, ELK, the drawing fails with the stand-in\'s message: elkjs is not in the file', async () => {
    const got = await draw(browser, 'reader', 'default');
    expect(got.drawn).toBe(`failed: ${ELK_LEFT_OUT}`);
    expect(got.violations.filter((v) => !PROBE.test(v))).toEqual([]);
    expect({ aborted: got.aborted, missing: got.missing }).toEqual({ aborted: [], missing: [] });
  });

  it('is import-inert: a page that only imports it keeps its pre.mermaid as written after the load event', async () => {
    const got = await draw(browser, 'reader', 'default', IMPORT_ONLY);
    expect(got.startOnLoad).toBe('false');
    expect(got.drawn).toBe('untouched');
    expect(got.pre).toEqual({ processed: null, text: SOURCE });
    expect(got.svg).toBe(null);
    expect(got.violations.filter((v) => !PROBE.test(v))).toEqual([]);
    expect({ aborted: got.aborted, missing: got.missing }).toEqual({ aborted: [], missing: [] });
  });
});
