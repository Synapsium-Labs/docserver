// A spread before the field argument of a wrapper: the field is `hidden`, at run time, not the literal that stands at
// the parameter's position in the source.
import type { DocState } from '../state.js';

function save(s: DocState, n: string, v?: unknown): void {
  s.writeDoc(n, v);
}

export function use(s: DocState): void {
  const head = [s, 'hidden'] as const;
  save(...head, 'shown');
}
