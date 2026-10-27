// A field outside the field grammar: it would become part of a `doc:<field>` store key.
import type { DocState } from '../state.js';

export function use(s: DocState): void {
  s.readDoc('a:b');
}
