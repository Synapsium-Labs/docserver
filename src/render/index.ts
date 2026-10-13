// The public entry of `@synapsium-labs/docserver/render`: pure, deterministic, for Node, browsers and workers.
// Task 1 ships the types and the two default limits; `render` and `scanRefs` are stubs that throw until
// Task 3 (render) and Task 10 (scanRefs) replace them. Task 5 adds ALLOWLIST.
import type { RenderOptions, RenderResult, ScanRefsOptions, ScanRefsResult } from './types.js';

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

export function render(_markdown: string, _o?: RenderOptions): RenderResult {
  throw new Error('not implemented');
}

export function scanRefs(_markdown: string, _o?: ScanRefsOptions): ScanRefsResult {
  throw new Error('not implemented');
}
