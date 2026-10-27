// A destructured parameter: the field is a property of an argument, not the argument itself.
import type { DocState } from '../state.js';

function save(s: DocState, { name }: { name: string }): void {
  s.writeDoc(name, 1);
}

export function use(s: DocState): void {
  save(s, { name: 'inside' });
}
