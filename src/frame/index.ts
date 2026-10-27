// The entry of `./frame` (docserver L3; plan Reference §1): the pure srcdoc builder for the sealed reader frame, its
// policy, the bridge protocol's constants, the seed's html cap and the srcdoc default, the Mermaid gate and ceilings,
// the fragment grammar and the frame manifest. Pure: no DOM, no clock, no randomness, no I/O.
//
// Every export here is semver surface from v1 (FD20). The package's export map gains `./frame` in Task 12.
export { CSP_REFUSALS, checkFrameCsp, frameCsp } from './csp.js';
export type { CspRefusal } from './csp.js';
export { FrameError, frameDocument, MAX_SRCDOC_CHARS_DEFAULT } from './document.js';
export type { FrameAssets, FrameErrorCode, FrameFeatures, FrameOptions, RenderInput } from './document.js';
export { FRAGMENT_ID_GRAMMAR, isFragmentId } from './fragment.js';
export { MERMAID_GATE_DEFAULTS, MERMAID_LIMIT_CEILINGS, mermaidGate } from './gate.js';
export { FRAME_MANIFEST } from './manifest.generated.js';
export {
  BRIDGE_LIMITS,
  BRIDGE_PROTOCOL,
  DOC_FIELDS,
  ERROR_WHY,
  OP_KEYS,
  PREF_KEYS,
  SEED_SCHEMA,
} from './protocol.js';
export type { BridgeStoreKey, ErrorWhy, FrameToParent, ParentToFrame } from './protocol.js';
export { SEED_HTML_MAX_CHARS } from './seed.js';
export type { FramePrefs } from './wire-types.js';
