// A wrapper passed as a value: whoever calls it later is out of the generator's sight.
import type { DocState } from '../state.js';

function save(s: DocState, n: string): void {
  s.writeDoc(n, 1);
}

export const HANDLERS = [save];

export function use(s: DocState): void {
  save(s, 'direct');
}
