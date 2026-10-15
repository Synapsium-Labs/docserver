// The part of highlight.js's core API that src/render/highlight.ts (Task 6) uses, declared for
// tsconfig.render.json only, from the first task on (ruling C18). highlight.js's own declarations start with
// `/// <reference lib="dom" />`, which would bring every DOM global into the purity typecheck of src/render.
// tsconfig.render.json's `paths` maps `highlight.js/lib/core` here and `highlight.js/lib/languages/*` to
// ./highlight-language.d.ts; tsconfig.json still checks src/render against highlight.js's real declarations,
// so a call that does not match them fails there.
export interface HighlightOptions {
  language: string;
  ignoreIllegals?: boolean;
}

export interface HighlightResult {
  value: string;
}

/** A language definition: a function of the instance it is registered on. */
export type LanguageFn = (hljs: HLJSApi) => object;

export interface HLJSApi {
  newInstance(): HLJSApi;
  registerLanguage(languageName: string, language: LanguageFn): void;
  highlight(code: string, options: HighlightOptions): HighlightResult;
}

declare const hljs: HLJSApi;
export default hljs;
