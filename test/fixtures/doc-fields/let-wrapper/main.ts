// A wrapper bound to a let: the binding can be replaced at run time, so its call sites are not known to reach this
// function, and its parameter is not followed.
import type { DocState } from '../state.js';

let save = (s: DocState, n: string): void => {
  s.writeDoc(n, 1);
};

export function use(s: DocState): void {
  save(s, 'held');
}
