// The code highlighter (docserver L1; architecture section C, the "Fence info" row; ruling C1's PD1).
// highlight.js's core with a fixed set of languages. A fence's name resolves through LANGUAGES only, without
// case (the reference's Pygments lookup lowers the name too), so the language class a page carries is always
// one of these canonical names and never the author's spelling. Highlighting ignores illegal lexemes (a
// block is highlighted as far as it can be rather than dropped to plain text) and never guesses a language.
// A long block is highlighted line by line (ruling C24; MAX_WHOLE_BLOCK_CHARS and highlightCode explain why).
//
// The languages are registered on a private highlight.js instance (newInstance), created once at load and
// never changed afterwards: the package's shared instance is a mutable singleton that any other code in the
// page may configure or extend, and that must not move this library's output. highlight.js escapes the text
// itself (& < > " and ' as &#x27;) and adds only <span class="..."> markup; the reference's Pygments markup
// differs, so the corpus compares the text inside the wrapper (normaliseForCompare).
//
// Since L3 (Task 11, the first consumer's requests (a) to (c)) this module is also `./highlight`'s code, re-exported
// unchanged by src/highlight/index.ts: createHighlighter() is the one implementation of the fence rule's decision
// (which language, whole or line by line, or plain escaped text within one document's budget), so a host that colours
// code itself colours it exactly as render() does. RenderOptions.highlight false gives render() a highlighter with no
// budget. xml is registered as a private copy whose script and style modes hand nothing to another grammar
// (xmlWithoutSubLanguages): through them the stock grammar ran every line of an xml fence through javascript or css
// as well, the cost request (c) measured. No export of this module may name a highlight.js type: its declarations
// are `./highlight`'s, and highlight.js's own begin `/// <reference lib="dom" />`, which would bring the DOM library
// into a worker that imports the entry (test/highlight-api.test.ts reads the emitted declarations to hold this).
import hljsCore from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import css from 'highlight.js/lib/languages/css';
import diff from 'highlight.js/lib/languages/diff';
import dockerfile from 'highlight.js/lib/languages/dockerfile';
import go from 'highlight.js/lib/languages/go';
import ini from 'highlight.js/lib/languages/ini';
import java from 'highlight.js/lib/languages/java';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import markdown from 'highlight.js/lib/languages/markdown';
import plaintext from 'highlight.js/lib/languages/plaintext';
import python from 'highlight.js/lib/languages/python';
import rust from 'highlight.js/lib/languages/rust';
import shell from 'highlight.js/lib/languages/shell';
import sql from 'highlight.js/lib/languages/sql';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import yaml from 'highlight.js/lib/languages/yaml';
import { escapeHtml } from './escape.js';
import { pyLower, pyStrip } from './pyText.js';

type LanguageDefinition = Parameters<typeof hljsCore.registerLanguage>[1];

/** Delete every own `subLanguage` in a language definition's tree of modes, in place. */
function dropSubLanguages(definition: object): void {
  const seen = new Set<object>();
  const stack: unknown[] = [definition];
  while (stack.length > 0) {
    const node = stack.pop();
    if (typeof node !== 'object' || node === null || seen.has(node)) continue;
    seen.add(node);
    if (Object.hasOwn(node, 'subLanguage')) Reflect.deleteProperty(node, 'subLanguage');
    for (const value of Object.values(node)) stack.push(value);
  }
}

/**
 * highlight.js's xml grammar with no sub-language (request (c)): its script and style modes still find their end
 * tags, and their text stays plain instead of being highlighted as javascript or css. Unconditional: the grammar is
 * built fresh for each instance it is registered on, so the package's own grammar is never touched.
 */
const xmlCopy: LanguageDefinition = (api) => {
  const definition = xml(api);
  dropSubLanguages(definition);
  return definition;
};

/**
 * The xml grammar render() registers (xmlCopy), for tests to read; the entries never export it. Typed without
 * highlight.js's declarations, which this module's declarations must not import: a function of a highlight.js
 * instance that returns a fresh grammar.
 */
export const xmlWithoutSubLanguages: (api: never) => object = xmlCopy;

/** Each registered language: its canonical name, its highlight.js definition, its other names. */
const DEFINITIONS: readonly (readonly [name: string, definition: LanguageDefinition, aliases: readonly string[]])[] = [
  ['bash', bash, ['sh', 'zsh']],
  ['shell', shell, ['console']],
  ['css', css, []],
  ['diff', diff, []],
  ['dockerfile', dockerfile, []],
  ['go', go, []],
  ['ini', ini, ['toml']],
  ['java', java, []],
  ['javascript', javascript, ['js', 'jsx']],
  ['json', json, []],
  ['markdown', markdown, ['md']],
  ['python', python, ['py']],
  ['rust', rust, []],
  ['sql', sql, []],
  ['typescript', typescript, ['ts', 'tsx']],
  ['xml', xmlCopy, ['html', 'svg']],
  ['yaml', yaml, ['yml']],
  ['plaintext', plaintext, ['text']],
];

/** The registry: each canonical language name and the other names that resolve to it. Frozen. */
export const LANGUAGES: Readonly<Record<string, readonly string[]>> = Object.freeze(
  Object.fromEntries(DEFINITIONS.map(([name, , aliases]) => [name, Object.freeze([...aliases])])),
);

/** Every name and other name, lower-case, to its canonical name. A Map, so no object key ever resolves. */
const BY_NAME: ReadonlyMap<string, string> = new Map(
  DEFINITIONS.flatMap(([name, , aliases]) => [name, ...aliases].map((n) => [n, name] as const)),
);

const hljs = hljsCore.newInstance();
for (const [name, definition] of DEFINITIONS) hljs.registerLanguage(name, definition);

/**
 * The canonical name of a registered language, or null. `info` is the first word of a fence's info string
 * (fence.ts); it is lowered the Python way and must otherwise match a name exactly: no trimming here.
 */
export function resolveLanguage(info: string): string | null {
  return BY_NAME.get(pyLower(info)) ?? null;
}

/**
 * The longest text, in code units, that is highlighted as one block (ruling C24). Longer text is highlighted
 * one line at a time. Measured with the registered grammars:
 * - Output is quadratic in the line count of a block. A shell or dockerfile fence whose lines each open `${`
 *   gave 0.76 MB of html from 1 KiB, 3 MB from 2 KiB, 12 MB from 4 KiB and 47 MB from 8 KiB, because a scope
 *   that is still open is reopened on every later line; at 256 code units the worst block gives 52 KB.
 * - Span depth is about two thirds of the block's length in the worst shapes (python `f"{`, javascript and
 *   typescript `` `${ ``, bash `"$(`): 679 nested spans from 1 KiB, past the 512 levels a browser's HTML
 *   parser keeps, so a browser would build a different tree from the html. At 256 code units the worst
 *   block nests 170 spans, the depth one 256-unit line reaches on the line-by-line path (171), the floor.
 * - Time is quadratic in a block's length for an ini fence of `\"` runs (2.7 s at 32 KiB); at 256 code units
 *   any block takes under 10 ms, and the line-by-line path takes 0.03 to 0.4 s for 256 KiB.
 * Up to this length an ordinary snippet keeps its block comments, JSDoc and multi-line strings coloured
 * across lines.
 */
export const MAX_WHOLE_BLOCK_CHARS = 256;

/**
 * A block is highlighted only when none of its lines is longer than this, in code units. Several registered grammars
 * (ini, java, javascript and typescript among them) take time quadratic in a line's length: a 30000-character line
 * took 5-10 s.
 */
export const MAX_LINE_CHARS = 256;

/** The default number of code units one highlighter highlights; a block that would pass it is plain escaped text. */
export const MAX_DOCUMENT_CHARS = 262_144;

/** The highlighting engine and its exact version, the package's pin. */
export const HIGHLIGHT_ENGINE: Readonly<{ name: 'highlight.js'; version: string }> = Object.freeze({
  name: 'highlight.js',
  version: '11.12.0',
});

/** How a block was coloured: highlighted whole, highlighted one line at a time (ruling C24), or not at all. */
export type HighlightMode = 'whole' | 'lines' | 'plain';

export interface HighlighterOptions {
  /** Code units this highlighter highlights in all, a non-negative safe integer. Default MAX_DOCUMENT_CHARS. */
  maxDocumentChars?: number;
}

export interface HighlightResult {
  /** The code as html: escaped text, and highlight.js spans unless the mode is 'plain'. */
  html: string;
  /** The canonical name the info string resolved to, or null; given whatever the mode. */
  language: string | null;
  mode: HighlightMode;
  /** Code units this highlighter has highlighted so far, this block included; at most its maxDocumentChars. */
  charsUsed: number;
}

export interface Highlighter {
  /**
   * `code` as html. `info` is a fence's info string, read as render() reads it: its first word after a Python-style
   * strip, resolved without case through LANGUAGES. The code is used as given; render() passes the fence's text with
   * its leading and trailing line feeds removed and one added.
   */
  highlight(code: string, info: string): HighlightResult;
}

/** The first word of a fence's info string: Python's `info.strip().split(" ")[0]`. */
export function fenceName(info: string): string {
  return pyStrip(info).split(' ')[0] ?? '';
}

/** Whether no line of `text` is longer than MAX_LINE_CHARS code units. */
function shortLines(text: string): boolean {
  for (let from = 0; from < text.length; ) {
    const end = text.indexOf('\n', from);
    const stop = end === -1 ? text.length : end;
    if (stop - from > MAX_LINE_CHARS) return false;
    from = stop + 1;
  }
  return true;
}

/**
 * `text` highlighted as `language`, a canonical name resolveLanguage returned: escaped text and
 * highlight.js spans. Throws RangeError for any other name.
 *
 * Text of at most MAX_WHOLE_BLOCK_CHARS code units is highlighted as one block. Longer text is highlighted
 * one line at a time and the results are joined with a line feed (ruling C24), so the work and the output
 * are linear in the text for every grammar; a construct that spans lines, such as a block comment, is then
 * coloured on its first line only. The text itself is the same either way, which is all the corpus compares
 * (PD1).
 */
export function highlightCode(text: string, language: string): string {
  if (!Object.hasOwn(LANGUAGES, language)) throw new RangeError(`highlightCode: unregistered language ${language}`);
  const options = { language, ignoreIllegals: true };
  if (text.length <= MAX_WHOLE_BLOCK_CHARS) return hljs.highlight(text, options).value;
  return text
    .split('\n')
    .map((line) => hljs.highlight(line, options).value)
    .join('\n');
}

/**
 * A highlighter for one document (request (a)): each block is highlighted as its language when it has one, none of
 * its lines is longer than MAX_LINE_CHARS, and it fits in what is left of `maxDocumentChars`; otherwise it is plain
 * text, escaped as markdown-it escapes text. render() makes one for each document, so a host that makes one per
 * document and passes each fence in order gets render()'s code html, block for block. Pure: no clock, no I/O, no
 * global state; the only state is this highlighter's count. Throws RangeError for an invalid maxDocumentChars.
 */
export function createHighlighter(o?: HighlighterOptions): Highlighter {
  const max: unknown = o?.maxDocumentChars === undefined ? MAX_DOCUMENT_CHARS : o.maxDocumentChars;
  if (typeof max !== 'number' || !Number.isSafeInteger(max) || max < 0) {
    throw new RangeError(`createHighlighter: maxDocumentChars must be a non-negative safe integer, got ${String(max)}`);
  }
  let used = 0;
  return Object.freeze({
    highlight(code: string, info: string): HighlightResult {
      if (typeof code !== 'string' || typeof info !== 'string') {
        throw new TypeError('highlight: code and info must be strings');
      }
      const language = resolveLanguage(fenceName(info));
      if (language === null || used + code.length > max || !shortLines(code)) {
        return { html: escapeHtml(code), language, mode: 'plain', charsUsed: used };
      }
      used += code.length;
      const mode: HighlightMode = code.length <= MAX_WHOLE_BLOCK_CHARS ? 'whole' : 'lines';
      return { html: highlightCode(code, language), language, mode, charsUsed: used };
    },
  });
}
