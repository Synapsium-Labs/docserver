// The test page's script, bundled by test/browser/harness.ts with `./enhance` and served from the page's own
// origin, so it runs under either policy. It loads in the page's head, before the body: it starts recording CSP
// violations at once, and once the document is parsed it finds the root, records the source texts (before anything
// enhances them), reads the options from the page's JSON data block, and offers the API of api.ts. It never
// enhances by itself: the harness calls `enhance()` when the test is ready.
//
// Diagrams (L2 Task 21): options are data, so a case's `mermaid` options get their load here: it imports the
// package's Mermaid file, which the harness serves at MERMAID_PATH (LD4: the host passes the module). With them,
// `enhance()` also waits, at most DIAGRAMS_WAIT_MS, for the root's `data-docreader-diagrams` to leave `drawing` (LD5:
// a host waiting for diagrams reads that attribute), and answers an error when it never does.
import { destroyEnhancement, enhance } from '../../../src/enhance/index.js';
import type { EnhanceOutcome, HarnessApi } from './api.js';
import { snapshot } from './snapshot.js';
import { trackSource } from './source.js';

const violations: string[] = [];
document.addEventListener('securitypolicyviolation', (e) => {
  violations.push(`${e.effectiveDirective} ${e.blockedURI === '' ? 'inline' : e.blockedURI}`);
});

/** Where the harness serves the Mermaid file (harness.ts, MERMAID_PATH). */
const MERMAID_PATH = '/assets/mermaid/mermaid.mjs';

/** How long enhance() waits for the diagrams to be drawn, in ms. */
const DIAGRAMS_WAIT_MS = 45_000;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Options read from the page: a `mermaid` given as data gets the load that imports the package's file. */
function withLoad(options: unknown): unknown {
  if (!isRecord(options) || !isRecord(options['mermaid']) || Object.hasOwn(options['mermaid'], 'load')) return options;
  // The specifier is built at run time, so the bundler leaves the import to the browser.
  const file = new URL(MERMAID_PATH, document.baseURI).href;
  return { ...options, mermaid: { ...options['mermaid'], load: () => import(file) } };
}

/** Resolve once the root's diagrams are no longer being drawn; false when that takes longer than DIAGRAMS_WAIT_MS. */
function diagramsSettled(root: HTMLElement): Promise<boolean> {
  const started = performance.now();
  return new Promise((resolve) => {
    const tick = (): void => {
      if (root.getAttribute('data-docreader-diagrams') !== 'drawing') resolve(true);
      else if (performance.now() - started > DIAGRAMS_WAIT_MS) resolve(false);
      else setTimeout(tick, 20);
    };
    tick();
  });
}

function start(): void {
  const root = document.querySelector('main[data-harness-root]');
  const data = document.querySelector('script[data-harness-options]');
  if (!(root instanceof HTMLElement) || data === null) throw new Error('harness: the page has no root or no options');
  const options = withLoad(JSON.parse(data.textContent ?? 'null')) as Parameters<typeof enhance>[1];
  const isSource = trackSource(root, Text);
  const api: HarnessApi = {
    root,
    async enhance(): Promise<EnhanceOutcome> {
      try {
        await enhance(root, options);
        if (isRecord(options) && isRecord(options['mermaid']) && !(await diagramsSettled(root))) {
          return { ok: false, code: 'diagrams', message: `still drawing after ${String(DIAGRAMS_WAIT_MS)} ms` };
        }
        await document.fonts.ready;
        return { ok: true };
      } catch (e) {
        const code = typeof e === 'object' && e !== null && 'code' in e ? String(e.code) : '';
        return { ok: false, code, message: e instanceof Error ? e.message : String(e) };
      }
    },
    snapshot: (scope) => snapshot(root, scope, isSource),
    violations: () => [...violations],
    destroy: () => destroyEnhancement(root),
  };
  window.__docreaderHarness = api;
  document.documentElement.setAttribute('data-harness', 'loaded');
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
else start();
