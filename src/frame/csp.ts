// The frame's Content Security Policy (docserver L3; design §9): the canonical policy built from the generated
// manifest, and the check every policy passes before frameDocument inlines anything under it. Pure.
import { cspFloor } from './csp-rules.js';
import { FRAME_MANIFEST } from './manifest.generated.js';

/** The hash sources this version knows: one per inlined script. */
const KNOWN: readonly string[] = [FRAME_MANIFEST.guard.csp, FRAME_MANIFEST.bootstrap.csp, FRAME_MANIFEST.enhance.csp, FRAME_MANIFEST.mermaid.csp];

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

/** Check `csp`: the floor (csp-rules.ts), every hash in `requiredHashes` present, and no hash unknown to this version. */
export function checkFrameCsp(csp: string, requiredHashes: readonly string[]): { ok: true } | { ok: false; why: string } {
  const floor = cspFloor(csp);
  if (!floor.ok) return floor;
  for (const h of requiredHashes) if (!floor.scriptHashes.includes(h)) return { ok: false, why: `missing hash ${h}` };
  for (const h of floor.scriptHashes) if (!KNOWN.includes(h)) return { ok: false, why: `unknown hash ${h}` };
  return { ok: true };
}
