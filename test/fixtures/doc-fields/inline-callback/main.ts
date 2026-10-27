// A field that is the parameter of an anonymous callback, not of a named wrapper.
import type { DocState } from '../state.js';

export function use(s: DocState): void {
  ['a', 'b'].forEach((n) => s.writeDoc(n, 1));
}
