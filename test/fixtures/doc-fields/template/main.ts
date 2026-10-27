// A template with a substitution: the field is built at run time.
import type { DocState } from '../state.js';

export function use(s: DocState, n: number): void {
  s.writeDoc(`field-${n}`, 1);
}
