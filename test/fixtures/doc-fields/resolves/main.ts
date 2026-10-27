// Every resolution rule of the generator in one place (test/frame-doc-fields.test.ts lists the fields it expects).
import type { DocState } from '../state.js';
import { IMPORTED, KEYS } from './consts.js';
import { REEXPORTED } from './reexport.js';
import { forget, remember } from './wrappers.js';

const LOCAL = 'local';
const ALIAS = LOCAL;

export function use(state: DocState, flag: boolean): void {
  state.readDoc('literal');
  state.writeDoc(`template`, 1);
  state.readDoc(IMPORTED);
  state.readDoc(KEYS.member);
  state.readDoc(KEYS.nested.deep);
  state.readDoc(REEXPORTED);
  state.readDoc(ALIAS);
  state.writeDoc(flag ? 'yes' : 'no', 1);
  state.readDoc('typed' as const);
  state['readDoc']('bracketed');
  remember(state, 'wrapped');
  forget(state, 'twice-wrapped');
}
