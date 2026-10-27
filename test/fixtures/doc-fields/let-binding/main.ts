// A field bound with let: not a const, so it does not resolve.
import type { DocState } from '../state.js';

export function use(s: DocState, flag: boolean): void {
  let n = 'first';
  if (flag) n = 'second';
  s.readDoc(n);
}
