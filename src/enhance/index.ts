// The public entry of `@synapsium-labs/docserver/enhance`: the reading layout over a rendered document.
// Import-inert: importing it touches no DOM, window, document, storage, timers or network; nothing runs until
// enhance() is called. The lifecycle is lifecycle.ts; the stylesheet is assets/reader.css.
export { destroyEnhancement, enhance, goToHash, setEnhancementPrefs } from './lifecycle.js';
export { EnhanceError } from './types.js';
export type {
  ChromeOptions,
  CommitEntry,
  DocumentInfo,
  EnhanceErrorCode,
  EnhanceOptions,
  FrontListEntry,
  MermaidOptions,
  Prefs,
  ReaderStorage,
  VocabularyOptions,
} from './types.js';
