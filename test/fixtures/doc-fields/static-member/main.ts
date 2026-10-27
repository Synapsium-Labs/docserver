// A field named by a static member of a class: a binding the generator does not follow, so the call fails.
import type { DocState } from '../state.js';

class Fields {
  static readonly seen = 'static-seen';
}

export function use(s: DocState): void {
  s.readDoc(Fields.seen);
}
