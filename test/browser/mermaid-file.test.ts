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
  readonly aborted: readonly string[];
  readonly missing: readonly string[];
}

/** Open the page under `policy` in a fresh context, wait for the drawing to end, and read what it left. */
async function draw(browser: BrowserName, policy: PolicyName, layout: 'dagre' | 'default' = 'dagre'): Promise<Drawn> {
  const files = new Map<string, { body: string | Uint8Array; type: string }>([
    ['/', { body: PAGE, type: 'text/html; charset=utf-8' }],
    ['/watch.js', { body: WATCH, type: 'text/javascript; charset=utf-8' }],
    ['/draw.mjs', { body: DRAW, type: 'text/javascript; charset=utf-8' }],
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
      return {
        drawn: document.documentElement.getAttribute('data-drawn'),
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
});
