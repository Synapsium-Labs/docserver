// The public entry of `@synapsium-labs/docserver/render`: pure, deterministic, for Node, browsers and workers.
// `render` is the engine of render.ts; `scanRefs` (scan.ts) parses with the same engine and builds no html.
// `ALLOWLIST` is the raw HTML render() recognises (allowlist.ts); everything else is text.
export { ALLOWLIST } from './allowlist.js';
export { render } from './render.js';
export { scanRefs } from './scan.js';
export { DEFAULT_MAX_BYTES, DEFAULT_MAX_IMAGES } from './types.js';
export type {
  FrontEntry,
  Heading,
  RenderMeta,
  RenderOptions,
  RenderOutcome,
  RenderResult,
  ScanRefsOptions,
  ScanRefsResult,
} from './types.js';
