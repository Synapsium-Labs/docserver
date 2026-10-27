// Five wrapper levels: one more than the generator follows, so it fails on the call that would need a fifth.
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
function w5(s: DocState, n: string): void {
  w4(s, n);
}

export function use(s: DocState): void {
  w5(s, 'five');
}
