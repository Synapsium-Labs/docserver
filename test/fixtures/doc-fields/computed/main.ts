// A computed key: the field is chosen at run time, so no list can name it.
import type { DocState } from '../state.js';

const KEYS = { a: 'a', b: 'b' } as const;

export function use(s: DocState, k: keyof typeof KEYS): void {
  s.readDoc(KEYS[k]);
}
