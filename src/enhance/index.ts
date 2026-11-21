// The public entry of `@synapsium-labs/pinax-lib/enhance`: the reading layout over a rendered document.
// Import-inert: importing it touches no DOM, window, document, storage, timers or network; nothing runs until
// enhance() is called. The lifecycle is lifecycle.ts; the stylesheet is assets/reader.css.
export { destroyEnhancement, enhance, goToHash, runEnhancementCommand, setEnhancementAppearance, setEnhancementPrefs } from './lifecycle.js';
export { EnhanceError } from './types.js';
export type {
  ChromeOptions,
  CommitEntry,
  DocumentInfo,
  EnhanceErrorCode,
  EnhanceOptions,
  FrontListEntry,
  MermaidOptions,
  PlaceKind,
  Prefs,
  PrintFigure,
  ReaderStorage,
  VocabularyOptions,
} from './types.js';
