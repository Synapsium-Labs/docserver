// A wrapper called without the argument that its writeDoc names.
import type { DocState } from '../state.js';

function save(s: DocState, n?: string): void {
  s.writeDoc(n as string, 1);
}

export function use(s: DocState): void {
  save(s);
}
