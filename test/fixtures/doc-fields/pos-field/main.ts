// The field `pos`: the reading position's own key, which the generator adds itself; a writeDoc may not name it.
import type { DocState } from '../state.js';

export function use(s: DocState): void {
  s.writeDoc('pos', 1);
}
