// markdown-it-footnote 4.0.0 ships no type declarations. This is the one shape this library uses: the
// default export is a markdown-it plugin taking no options. A local declaration, not @types/markdown-it-
// footnote, so the footnote plugin's types never pull in a second copy of markdown-it's.
declare module 'markdown-it-footnote' {
  import type { PluginSimple } from 'markdown-it';

  const footnote: PluginSimple;
  export default footnote;
}
