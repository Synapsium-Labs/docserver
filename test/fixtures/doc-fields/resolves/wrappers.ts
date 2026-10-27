// A field through two wrappers: `save` calls writeDoc with its parameter, `remember` calls `save` with its own, and
// `forget` is an arrow function bound to a const. The generator follows each parameter to every call site.
import type { DocState } from '../state.js';

function save(state: DocState, field: string, value: unknown): void {
  state.writeDoc(field, value);
}

export function remember(state: DocState, name: string): void {
  save(state, name, true);
}

export const forget = (state: DocState, name: string): void => {
  save(state, name, null);
};
