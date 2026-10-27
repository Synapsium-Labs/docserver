// writeDoc called through an element access, with a field built at run time: the call is read, and fails.
import type { DocState } from '../state.js';

export function use(s: DocState, parts: readonly string[]): void {
  s['writeDoc'](parts.join('-'), 1);
}
