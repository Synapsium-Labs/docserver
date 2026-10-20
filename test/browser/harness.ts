// The real-browser harness of the `layout` test project (docserver L2, Task 6; LD2): a pinned Chromium and WebKit
// through playwright-core, driven over a pipe, never a socket, so the test process opens none (the no-network setup
// stays in force). A page is built in memory from render() and served, with the bundled `./enhance`, the stylesheet
// and the fonts, from https://docreader.test/ by the context's route handler: every other routed request is aborted
// and counted. The browsers resolve no host on their own either: Chromium maps every name to "not found"
// (--host-resolver-rules), and WebKit sends everything through a proxy at a closed loopback port.
//
// Two Content Security Policies, both default-src 'none' with no 'unsafe-eval', scripts, styles and fonts from the
// page's origin only: `strict` refuses inline styles (what the reader itself runs under) and `reader` allows them
// (what Mermaid needs, §4.2).
//
// Which browsers run: DOCREADER_BROWSERS, a comma list of chromium and webkit; unset, both. With no selection a
// browser that cannot start is a red naming the install command, never a skip. With a selection, the browser left
// out is reported as excluded: its tests show as skipped under a title that names the setting, and a line on stderr
// says so. Each selected browser's block launches its browser in a beforeAll hook, so a slow start counts against
// the layout project's hook timeout, not against the block's first test.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium, webkit, type Browser, type LaunchOptions, type Page } from 'playwright-core';
import { beforeAll, describe } from 'vitest';
import { INSTALL } from '../../scripts/visual/compare.mjs';
import { render } from '../../src/render/index.js';
import type { EnhanceOutcome, HarnessApi } from './page/api.js';

export type BrowserName = 'chromium' | 'webkit';
export const BROWSERS: readonly BrowserName[] = ['chromium', 'webkit'];

/** The only origin a test page loads from. */
export const ORIGIN = 'https://docreader.test';

/** The one-time setup that installs the pinned browsers and their system libraries (one constant, the compare script's). */
export { INSTALL };

/** WebKit's proxy: a loopback port nothing listens on, so every request WebKit sends past the route fails there. */
export const CLOSED_PORT = 2;

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

export interface Selection {
  /** The browsers to run, in BROWSERS order. */
  readonly run: readonly BrowserName[];
  /** The browsers the setting leaves out. */
  readonly excluded: readonly BrowserName[];
  /** The setting as given, or null when unset. */
  readonly setting: string | null;
}

/** DOCREADER_BROWSERS, read: unset runs both; an empty list or an unknown name is an error, never a silent skip. */
export function parseSelection(value: string | undefined): Selection {
  if (value === undefined) return { run: BROWSERS, excluded: [], setting: null };
  const names = value.split(',').map((s) => s.trim());
  const unknown = names.filter((n) => !(BROWSERS as readonly string[]).includes(n));
  if (names.length === 0 || unknown.length > 0) {
    throw new Error(`DOCREADER_BROWSERS=${JSON.stringify(value)}: name one or more of ${BROWSERS.join(', ')}, separated by commas`);
  }
  return {
    run: BROWSERS.filter((b) => names.includes(b)),
    excluded: BROWSERS.filter((b) => !names.includes(b)),
    setting: value,
  };
}

export const SELECTION = parseSelection(process.env['DOCREADER_BROWSERS']);
if (SELECTION.excluded.length > 0) {
  console.warn(`docreader layout tests: ${SELECTION.excluded.join(', ')} excluded by DOCREADER_BROWSERS=${String(SELECTION.setting)}`);
}

/** The title of an excluded browser's block: it names the setting that left the browser out. */
export function excludedTitle(name: BrowserName, selection: Selection): string {
  return `${name}: excluded by DOCREADER_BROWSERS=${String(selection.setting)}`;
}

/**
 * One describe block per browser: a selected one launches its browser in a beforeAll hook and runs; an excluded one
 * is skipped under a title that says why.
 */
export function describeBrowsers(fn: (name: BrowserName) => void, selection: Selection = SELECTION): void {
  for (const name of BROWSERS) {
    if (selection.run.includes(name)) {
      describe(name, () => {
        beforeAll(async () => {
          await browserFor(name);
        });
        fn(name);
      });
    } else describe.skip(excludedTitle(name, selection), () => fn(name));
  }
}

/** How each browser is kept off the network: Chromium resolves no name, WebKit proxies to a closed port. */
export function launchOptions(name: BrowserName): LaunchOptions {
  return name === 'chromium'
    ? { args: ['--host-resolver-rules=MAP * ~NOTFOUND'] }
    : { proxy: { server: `http://127.0.0.1:${String(CLOSED_PORT)}` } };
}

/** Launch one browser over a pipe. A browser that cannot start is an error that names the install command. */
export async function launch(name: BrowserName, extra: LaunchOptions = {}): Promise<Browser> {
  const type = name === 'chromium' ? chromium : webkit;
  try {
    return await type.launch({ ...launchOptions(name), ...extra });
  } catch (e) {
    const lines = (e instanceof Error ? e.message : String(e)).split('\n').map((l) => l.replace(/[║╔╗╚╝═]/g, '').trim());
    const first = lines.find((l) => l !== '' && !/^browserType\.launch:?$/.test(l)) ?? 'no message';
    throw new Error(
      `${name} could not start (${first}). Install the pinned browsers with: ${INSTALL} ` +
        `(or choose the browsers to run with DOCREADER_BROWSERS, a comma list of ${BROWSERS.join(' and ')})`,
    );
  }
}

const launched = new Map<BrowserName, Promise<Browser>>();

/** The browser of this name, launched once per test file's process. */
export function browserFor(name: BrowserName): Promise<Browser> {
  let b = launched.get(name);
  if (b === undefined) {
    b = launch(name);
    launched.set(name, b);
  }
  return b;
}

/** True once browserFor has launched (or begun to launch) the browser of this name. */
export function isLaunched(name: BrowserName): boolean {
  return launched.has(name);
}

/** Close every browser browserFor launched; call it from afterAll. */
export async function closeBrowsers(): Promise<void> {
  const all = [...launched.values()];
  launched.clear();
  await Promise.all(all.map(async (b) => (await b.catch(() => null))?.close()));
}

export const POLICIES = {
  strict: `default-src 'none'; script-src ${ORIGIN}; style-src ${ORIGIN}; font-src ${ORIGIN}; base-uri 'none'; form-action 'none'`,
  reader: `default-src 'none'; script-src ${ORIGIN}; style-src ${ORIGIN} 'unsafe-inline'; font-src ${ORIGIN}; base-uri 'none'; form-action 'none'`,
} as const;

export type PolicyName = keyof typeof POLICIES;

interface Served {
  readonly body: Buffer | string;
  readonly type: string;
}

let script: Promise<string> | undefined;

/** The page script: test/browser/page/bootstrap.ts with ./enhance, bundled once per process. */
function pageScript(): Promise<string> {
  script ??= build({
    entryPoints: [path.join(ROOT, 'test', 'browser', 'page', 'bootstrap.ts')],
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    target: 'es2022',
    logLevel: 'silent',
  }).then((r) => r.outputFiles[0]?.text ?? '');
  return script;
}

/** The package's stylesheet and fonts, read from disk, at the paths the stylesheet names them by. */
function assetFiles(): Map<string, Served> {
  const out = new Map<string, Served>();
  out.set('/assets/reader.css', { body: readFileSync(path.join(ROOT, 'assets', 'reader.css')), type: 'text/css' });
  for (const f of readdirSync(path.join(ROOT, 'assets', 'fonts')).filter((n) => n.endsWith('.woff2'))) {
    out.set(`/assets/fonts/${f}`, { body: readFileSync(path.join(ROOT, 'assets', 'fonts', f)), type: 'font/woff2' });
  }
  return out;
}

/** JSON for a data block, with the characters that could end or open a tag written as escapes. */
function dataJson(value: unknown): string {
  return JSON.stringify(value).replaceAll('<', '\\u003c').replaceAll('>', '\\u003e').replaceAll('&', '\\u0026');
}

function pageHtml(html: string, options: unknown): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>docreader test page</title>
<link rel="stylesheet" href="/assets/reader.css">
<link rel="stylesheet" href="/page.css">
<script src="/harness.js"></script>
</head>
<body>
<main data-harness-root>
${html}
</main>
<script type="application/json" data-harness-options>${dataJson(options)}</script>
</body>
</html>
`;
}

export interface OpenHow {
  readonly browser: BrowserName;
  /** Default 1440×1000. */
  readonly viewport?: { readonly width: number; readonly height: number };
  /** Default 'strict'. */
  readonly csp?: PolicyName;
  /** Call enhance() before returning; default true. */
  readonly enhance?: boolean;
  /** Host names whose requests go past the route to the browser's own network stack (a test of that stack). */
  readonly unrouted?: readonly string[];
  /** Change the rendered html before it is served (a test's control page). */
  readonly html?: (html: string) => string;
}

export interface OpenedDoc {
  readonly page: Page;
  /** Every routed request to another origin, in order; each was aborted. */
  readonly aborted: readonly string[];
  /** Every path on the page's origin that was asked for and is not served, in order (each answered 404). */
  readonly missing: readonly string[];
  /** enhance(root, options) on the page; rejects with the page's EnhanceError code and message. */
  enhance(): Promise<void>;
  /** The structural snapshot of the root (page/snapshot.ts). */
  snapshot(scope: readonly string[]): Promise<string>;
  /** The page's CSP violations so far. */
  violations(): Promise<string[]>;
  close(): Promise<void>;
}

/**
 * Open `markdown` in a fresh context of a real browser: render() it, put the html in the page's root, and enhance it
 * with `options` (plain data; `info` is the render's title and front matter unless the options give their own).
 */
export async function openDoc(markdown: string, options: Readonly<Record<string, unknown>> = {}, how: OpenHow): Promise<OpenedDoc> {
  const r = render(markdown);
  if (r.outcome !== 'rendered') throw new Error(`openDoc: the markdown did not render (${r.outcome})`);
  const opts = Object.hasOwn(options, 'info') ? options : { ...options, info: { title: r.meta.title, frontList: r.meta.frontList } };
  const html = how.html === undefined ? r.html : how.html(r.html);
  const policy = POLICIES[how.csp ?? 'strict'];
  const files = assetFiles();
  files.set('/', { body: pageHtml(html, opts), type: 'text/html; charset=utf-8' });
  files.set('/harness.js', { body: await pageScript(), type: 'text/javascript; charset=utf-8' });
  files.set('/page.css', { body: 'html, body { margin: 0; }\n', type: 'text/css' });

  const browser = await browserFor(how.browser);
  const context = await browser.newContext({
    viewport: how.viewport ?? { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
    colorScheme: 'light',
    serviceWorkers: 'block',
  });
  const aborted: string[] = [];
  const missing: string[] = [];
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === ORIGIN) {
      const f = files.get(url.pathname);
      if (f === undefined) {
        // (A request for /favicon.ico never comes here: playwright-core aborts it before any route sees it.)
        missing.push(url.pathname);
        await route.fulfill({ status: 404, body: '' });
        return;
      }
      const headers: Record<string, string> = { 'content-type': f.type };
      if (url.pathname === '/') headers['content-security-policy'] = policy;
      await route.fulfill({ status: 200, headers, body: f.body });
      return;
    }
    if (how.unrouted?.includes(url.hostname) === true) {
      await route.fallback();
      return;
    }
    aborted.push(url.href);
    await route.abort('blockedbyclient');
  });
  const page = await context.newPage();
  const doc: OpenedDoc = {
    page,
    aborted,
    missing,
    async enhance() {
      const out: EnhanceOutcome = await page.evaluate(() => (window.__docreaderHarness as HarnessApi).enhance());
      if (!out.ok) throw new Error(`enhance rejected: ${out.code}: ${out.message}`);
    },
    snapshot: (scope) => page.evaluate((s) => (window.__docreaderHarness as HarnessApi).snapshot(s), [...scope]),
    violations: () => page.evaluate(() => (window.__docreaderHarness as HarnessApi).violations()),
    close: () => context.close(),
  };
  try {
    await page.goto(`${ORIGIN}/`);
    await page.waitForFunction(() => document.documentElement.getAttribute('data-harness') === 'loaded');
    if (how.enhance !== false) await doc.enhance();
  } catch (e) {
    await context.close().catch(() => undefined); // a page that failed to open leaves no context behind
    throw e;
  }
  return doc;
}
