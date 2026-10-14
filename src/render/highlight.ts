// The code highlighter (docserver L1; architecture section C, the "Fence info" row; ruling C1's PD1).
// highlight.js's core with a fixed set of languages. A fence's name resolves through LANGUAGES only, without
// case (the reference's Pygments lookup lowers the name too), so the language class a page carries is always
// one of these canonical names and never the author's spelling. Highlighting ignores illegal lexemes (a
// block is highlighted as far as it can be rather than dropped to plain text) and never guesses a language.
//
// The languages are registered on a private highlight.js instance (newInstance), created once at load and
// never changed afterwards: the package's shared instance is a mutable singleton that any other code in the
// page may configure or extend, and that must not move this library's output. highlight.js escapes the text
// itself (& < > " and ' as &#x27;) and adds only <span class="..."> markup; the reference's Pygments markup
// differs, so the corpus compares the text inside the wrapper (normaliseForCompare).
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
import { pyLower } from './pyText.js';

type LanguageDefinition = Parameters<typeof hljsCore.registerLanguage>[1];

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
  ['xml', xml, ['html', 'svg']],
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
 * `text` highlighted as `language`, a canonical name resolveLanguage returned: escaped text and
 * highlight.js spans. Throws RangeError for any other name.
 */
export function highlightCode(text: string, language: string): string {
  if (!Object.hasOwn(LANGUAGES, language)) throw new RangeError(`highlightCode: unregistered language ${language}`);
  return hljs.highlight(text, { language, ignoreIllegals: true }).value;
}
