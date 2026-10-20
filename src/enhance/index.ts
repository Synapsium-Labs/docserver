// The public entry of `@synapsium-labs/docserver/enhance`: the reading layout over a rendered document.
// Import-inert: importing it touches no DOM, window, document, storage, timers or network; nothing runs until
// enhance() is called. The lifecycle is lifecycle.ts; the stylesheet is assets/reader.css.
export { destroyEnhancement, enhance, setEnhancementPrefs } from './lifecycle.js';
export { EnhanceError } from './types.js';
export type {
  DocumentInfo,
  EnhanceErrorCode,
  EnhanceOptions,
  FrontListEntry,
  Prefs,
  ReaderStorage,
} from './types.js';
