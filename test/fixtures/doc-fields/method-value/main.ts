// writeDoc taken as a value: every later call through `w` would escape the scan.
import type { DocState } from '../state.js';

export function use(s: DocState): (name: string, value: unknown) => void {
  s.readDoc('seen-here');
  return s.writeDoc;
}
