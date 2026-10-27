// A member of an object that is not `as const`: its value can change, so it does not resolve.
import type { DocState } from '../state.js';

const KEYS = { a: 'a' };

export function use(s: DocState): void {
  s.readDoc(KEYS.a);
}
