// Two consts, each initialised by the other across a module cycle: the chain never reaches a literal, and the generator
// stops at its bound rather than following it forever.
import type { DocState } from '../state.js';
import { B } from './other.js';

export const A: string = B;

export function use(s: DocState): void {
  s.readDoc(A);
}
