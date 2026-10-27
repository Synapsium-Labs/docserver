// Four wrapper levels: the deepest the generator follows (the control for fifth-wrapper/).
import type { DocState } from '../state.js';

function w1(s: DocState, n: string): void {
  s.writeDoc(n, 1);
}
function w2(s: DocState, n: string): void {
  w1(s, n);
}
function w3(s: DocState, n: string): void {
  w2(s, n);
}
function w4(s: DocState, n: string): void {
  w3(s, n);
}

export function use(s: DocState): void {
  w4(s, 'four');
}
