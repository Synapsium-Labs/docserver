// A spread as the field argument of writeDoc itself.
import type { DocState } from '../state.js';

const ARGS = ['spread', 1] as const;

export function use(s: DocState): void {
  s.writeDoc(...ARGS);
}
