// A rest parameter used as the field: each call site passes several names, and only the first stands at its position.
import type { DocState } from '../state.js';

function save(s: DocState, ...names: string[]): void {
  s.writeDoc(names as unknown as string, 1);
}

export function use(s: DocState): void {
  save(s, 'first', 'second');
}
