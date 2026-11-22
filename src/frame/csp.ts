// The frame's Content Security Policy (docserver L3; plan Reference §10): the canonical policy built from the generated
// manifest, and the check every policy passes before frameDocument inlines anything under it. Pure.
import { cspFloor, type CspRefusal } from './csp-rules.js';
import { isFrameLayout, LAYOUT_ENTRIES, type FrameLayout } from './layouts.js';
import { FRAME_MANIFEST } from './manifest.generated.js';

export { CSP_REFUSALS } from './csp-rules.js';
export type { CspRefusal } from './csp-rules.js';

/**
 * The hash sources this version knows: one per script any frame can inline, every layout's enhance bundle included
 * (checkFrameCsp accepts any of them, so a host's stored policy for one layout stays valid; plan Design B12).
 */
const KNOWN: readonly string[] = [
  FRAME_MANIFEST.guard.csp,
  FRAME_MANIFEST.bootstrap.csp,
  FRAME_MANIFEST.enhance.csp,
  FRAME_MANIFEST.mermaid.csp,
  FRAME_MANIFEST.enhanceClassic.csp,
  FRAME_MANIFEST.enhanceEditorial.csp,
  FRAME_MANIFEST.enhanceReview.csp,
  FRAME_MANIFEST.enhanceGuided.csp,
];

/** checkFrameCsp's answer: a refusal names its reason from CSP_REFUSALS. */
export type FrameCspCheck = { readonly ok: true } | { readonly ok: false; readonly why: CspRefusal };

/**
 * The canonical frame policy of `layout` (default `'default'`): the script hashes that layout's frame inlines, in this order
 * (the guard, the bootstrap, the layout's enhance bundle, Mermaid's, which is listed whether or not a document inlines it, so
 * a host's policy is one constant per version and layout), and nothing else that can load or connect. No other layout's hash
 * is in it. `frameCsp()` is `frameCsp('default')`, byte for byte what it was before layouts. A name that is not a layout is a
 * TypeError.
 */
export function frameCsp(layout: FrameLayout = 'default'): string {
  if (!isFrameLayout(layout)) throw new TypeError('frameCsp: the layout is not one of FRAME_LAYOUTS');
  const hashes = [FRAME_MANIFEST.guard.csp, FRAME_MANIFEST.bootstrap.csp, FRAME_MANIFEST[LAYOUT_ENTRIES[layout].enhance].csp, FRAME_MANIFEST.mermaid.csp];
  return (
    `default-src 'none'; script-src ${hashes.join(' ')}; style-src 'unsafe-inline' data:; font-src data:; ` +
    "img-src data:; base-uri 'none'; form-action 'none'"
  );
}

/**
 * Check `csp`: the floor (csp-rules.ts, the one tokeniser), then every hash in `requiredHashes` present in script-src
 * (`missing-hash`), then no script-src hash unknown to this version (`unknown-hash`).
 */
export function checkFrameCsp(csp: string, requiredHashes: readonly string[]): FrameCspCheck {
  const floor = cspFloor(csp);
  if (!floor.ok) return { ok: false, why: floor.why };
  for (const h of requiredHashes) if (!floor.scriptHashes.includes(h)) return { ok: false, why: 'missing-hash' };
  for (const h of floor.scriptHashes) if (!KNOWN.includes(h)) return { ok: false, why: 'unknown-hash' };
  return { ok: true };
}
