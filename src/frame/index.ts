// The entry of `./frame` (docserver L3; design §2): the pure srcdoc builder for the sealed reader frame, its policy,
// the bridge protocol's constants and the frame manifest. Pure: no DOM, no clock, no randomness, no I/O.
//
// Prototype scope: tested from source only; the package's export map gains `./frame` with the plan.
export { checkFrameCsp, frameCsp } from './csp.js';
export { FrameError, frameDocument } from './document.js';
export type { FrameAssets, FrameErrorCode, FrameOptions, RenderInput } from './document.js';
export { FRAME_MANIFEST } from './manifest.generated.js';
export { BRIDGE_LIMITS, BRIDGE_PROTOCOL, ERROR_WHY, SEED_SCHEMA } from './protocol.js';
export type { ErrorWhy, FrameToParent, ParentToFrame } from './protocol.js';
