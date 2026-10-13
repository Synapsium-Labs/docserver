// The public entry of `@synapsium-labs/docserver/render`: pure, deterministic, for Node, browsers and workers.
// `render` is the engine of render.ts; `scanRefs` is a stub that throws until Task 10 replaces it.
// `ALLOWLIST` is the raw HTML render() recognises (allowlist.ts); everything else is text.
import type { ScanRefsOptions, ScanRefsResult } from './types.js';

export { ALLOWLIST } from './allowlist.js';
export { render } from './render.js';
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

export function scanRefs(_markdown: string, _o?: ScanRefsOptions): ScanRefsResult {
  throw new Error('not implemented');
}
