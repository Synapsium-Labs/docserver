// The test page's script, bundled by test/browser/harness.ts with `./enhance` and served from the page's own
// origin, so it runs under either policy. It loads in the page's head, before the body: it starts recording CSP
// violations at once, and once the document is parsed it finds the root, records the source texts (before anything
// enhances them), reads the options from the page's JSON data block, and offers the API of api.ts. It never
// enhances by itself: the harness calls `enhance()` when the test is ready.
import { destroyEnhancement, enhance } from '../../../src/enhance/index.js';
import type { EnhanceOutcome, HarnessApi } from './api.js';
import { snapshot } from './snapshot.js';
import { trackSource } from './source.js';

const violations: string[] = [];
document.addEventListener('securitypolicyviolation', (e) => {
  violations.push(`${e.effectiveDirective} ${e.blockedURI === '' ? 'inline' : e.blockedURI}`);
});

function start(): void {
  const root = document.querySelector('main[data-harness-root]');
  const data = document.querySelector('script[data-harness-options]');
  if (!(root instanceof HTMLElement) || data === null) throw new Error('harness: the page has no root or no options');
  const options = JSON.parse(data.textContent ?? 'null') as Parameters<typeof enhance>[1];
  const isSource = trackSource(root, Text);
  const api: HarnessApi = {
    root,
    async enhance(): Promise<EnhanceOutcome> {
      try {
        await enhance(root, options);
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
