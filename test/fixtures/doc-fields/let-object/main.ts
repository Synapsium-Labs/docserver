// A member of an `as const` object bound to a let: the binding can be replaced, so the member is not a fixed field.
import type { DocState } from '../state.js';

let KEYS = { a: 'held' } as const;

export function use(s: DocState): void {
  s.readDoc(KEYS.a);
}

export function swap(): void {
  KEYS = { a: 'held' } as const;
}
