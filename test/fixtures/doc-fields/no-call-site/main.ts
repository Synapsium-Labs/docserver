// A wrapper that nothing in the scanned directory calls: whatever calls it is out of the generator's sight.
import type { DocState } from '../state.js';

export function save(s: DocState, n: string): void {
  s.writeDoc(n, 1);
}
