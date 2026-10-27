// A field named by an identifier with no declaration of its own (the global `undefined`).
import type { DocState } from '../state.js';

export function use(s: DocState): void {
  s.readDoc(undefined as unknown as string);
}
