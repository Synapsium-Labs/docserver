// The frame's Content Security Policy (docserver L3; plan Reference §10): the canonical policy built from the generated
// manifest, and the check every policy passes before frameDocument inlines anything under it. Pure.
import { cspFloor, type CspRefusal } from './csp-rules.js';
import { FRAME_MANIFEST } from './manifest.generated.js';

export { CSP_REFUSALS } from './csp-rules.js';
export type { CspRefusal } from './csp-rules.js';

/** The hash sources this version knows: one per inlined script. */
const KNOWN: readonly string[] = [FRAME_MANIFEST.guard.csp, FRAME_MANIFEST.bootstrap.csp, FRAME_MANIFEST.enhance.csp, FRAME_MANIFEST.mermaid.csp];

/** checkFrameCsp's answer: a refusal names its reason from CSP_REFUSALS. */
export type FrameCspCheck = { readonly ok: true } | { readonly ok: false; readonly why: CspRefusal };

/**
 * The canonical frame policy: every script hash of this version, Mermaid's included whether or not a document inlines
 * it (so a host's policy is one constant per version), and nothing else that can load or connect.
 */
export function frameCsp(): string {
  return (
    `default-src 'none'; script-src ${KNOWN.join(' ')}; style-src 'unsafe-inline' data:; font-src data:; ` +
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
