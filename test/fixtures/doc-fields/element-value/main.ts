// writeDoc and readDoc taken as values through an element access: every later call through `f` or `g` would escape the scan.
import type { DocState } from '../state.js';

export function use(s: DocState): void {
  s.readDoc('seen-here');
  const f = s['writeDoc'];
  f.call(s, 'hidden', 1);
  const g = s['readDoc'].bind(s);
  g('hidden-too');
}
