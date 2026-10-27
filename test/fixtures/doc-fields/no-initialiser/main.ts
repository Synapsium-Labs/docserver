// An ambient const: declared, never initialised here, so its value is not in the source.
import type { DocState } from '../state.js';

declare const NAME: string;

export function use(s: DocState): void {
  s.readDoc(NAME);
}
