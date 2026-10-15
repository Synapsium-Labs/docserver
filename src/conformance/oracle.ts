// The universal output-safety oracle (docserver L1; architecture section F, Task 3). It reads rendered HTML
// as a string and lists every way it leaves the shapes this library is allowed to emit. It runs on every
// corpus case, golden or hostile, so a rule change that lets markup through is red even where no golden
// pins that input. It may be tightened or extended; it must never be loosened to make a case pass.
//
// What it checks:
// 1. Every `<` begins a tag that parses: lower-case name, attributes as name="value" (double quotes; no
//    < > " inside the value) or bare, an optional ` /` on a void element, no attribute on a closing tag.
//    A comment `<!--` is reported as its own violation.
// 2. The tag is in TAGS.
// 3. Every attribute is allowed for its tag (GLOBAL_ATTRS everywhere, TAG_ATTRS per tag), appears once,
//    and has a value unless it is `open` on details.
// 4. Every class token is in CLASSES, or is a highlight.js token: `hljs-<scope>`, `language-<name>`, or a
//    highlight.js sub-scope (`function_`, `inherited__`) beside an `hljs-` token.
// 5. id values match ID_VALUE; data-line values match DATA_LINE; ol start is digits.
// 6. style is only `text-align:left|center|right`, only on td and th.
// 7. input is only the task-list checkbox: type="checkbox", disabled="disabled", checked="checked" if any.
// 8. href (on a) and src (on img), after decoding character references and removing every control and
//    whitespace character, have no javascript:, vbscript: or file: scheme, and a data: URL only as
//    `data:image/(gif|png|jpeg|webp);`. That is the one data: form markdown-it's validateLink lets
//    through, on a link as on an image: the reference renders `[g](data:image/gif;base64,AA)` as a link.

/** The elements the renderer may emit. */
export const TAGS: ReadonlySet<string> = new Set([
  'a', 'blockquote', 'br', 'code', 'dd', 'details', 'div', 'dl', 'dt', 'em', 'figcaption', 'figure',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'img', 'input', 'kbd', 'li', 'ol', 'p', 'pre', 's', 'section',
  'span', 'strong', 'sub', 'summary', 'sup', 'table', 'tbody', 'td', 'th', 'thead', 'tr', 'ul',
]);

/** Elements that may close themselves (`<br />`, `<hr />`, `<img … />`); no other tag may. */
const VOID_TAGS: ReadonlySet<string> = new Set(['br', 'hr', 'img', 'input']);

/** Attributes every element may carry. */
const GLOBAL_ATTRS: ReadonlySet<string> = new Set(['class', 'id', 'data-line']);

/** Attributes allowed on one element only. */
const TAG_ATTRS: Readonly<Record<string, ReadonlySet<string>>> = {
  a: new Set(['href', 'title']),
  img: new Set(['src', 'alt', 'title']),
  ol: new Set(['start']),
  td: new Set(['style']),
  th: new Set(['style']),
  input: new Set(['type', 'checked', 'disabled']),
  details: new Set(['open']),
};

/** The class vocabulary: the renderer's own wrappers, the footnote plugin's, task lists' and the fallback's. */
export const CLASSES: ReadonlySet<string> = new Set([
  'codehilite', 'hljs', 'mermaid-figure', 'mermaid',
  'gh-alert', 'gh-alert-title', 'gh-note', 'gh-tip', 'gh-important', 'gh-warning', 'gh-caution',
  'table-wrapper', 'task-list-item', 'contains-task-list', 'task-list-item-checkbox',
  'footnote-ref', 'footnotes-sep', 'footnotes', 'footnotes-list', 'footnote-item', 'footnote-backref',
  'doc-anchor', 'doc-meta', 'page-subtitle',
]);

const HLJS_CLASS = /^hljs-[\w.-]+$/;
const LANGUAGE_CLASS = /^language-[a-z0-9+#-]+$/;
/** highlight.js writes a scope `title.function` as `hljs-title function_`: the later pieces end in `_`s. */
const HLJS_SUBSCOPE = /^[a-z][a-z0-9]*_+$/;

const ID_VALUE = /^[^\s"'<>&=]*$/;
const DATA_LINE = /^\d+-\d+$/;
const START = /^\d+$/;
const STYLE = /^text-align:(?:left|center|right)$/;
const SAFE_DATA_IMAGE = /^data:image\/(?:gif|png|jpeg|webp);/;
const FORBIDDEN_SCHEMES: ReadonlySet<string> = new Set(['javascript', 'vbscript', 'file']);

/** One tag at the cursor (sticky): `/`, name, the attribute run, the self-closing slash. */
const TAG = /<(\/?)([a-z][a-z0-9]*)((?:[ \t\n]+[^\s"'<>/=]+(?:="[^"<>]*")?)*)[ \t\n]*(\/?)>/y;
/** One attribute inside a matched attribute run. */
const ATTR = /[ \t\n]+([^\s"'<>/=]+)(?:="([^"<>]*)")?/g;

/** The character references a browser would decode in an attribute, as far as a scheme check needs. */
const CHAR_REF = /&#[xX]([0-9a-fA-F]+);?|&#(\d+);?|&(amp|lt|gt|quot|apos|colon|tab|Tab|newline|NewLine|nbsp);/g;
const NAMED: Readonly<Record<string, string>> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", colon: ':', tab: '\t', Tab: '\t', newline: '\n', NewLine: '\n', nbsp: '\u00a0',
};
/** C0 controls, space, DEL, C1 controls and the no-break space: removed anywhere before the scheme check. */
const IGNORABLE = /[\u0000- \u007f-\u00a0]/g;
const SCHEME = /^([a-z][a-z0-9+.-]*):/;

function codePointText(n: number): string {
  return n > 0x10ffff ? '�' : String.fromCodePoint(n);
}

/** Decode character references once, as an HTML parser does inside an attribute value. */
export function decodeCharRefs(value: string): string {
  return value.replace(CHAR_REF, (_m, hex: string | undefined, dec: string | undefined, name: string | undefined) => {
    if (hex !== undefined) return codePointText(Number.parseInt(hex, 16));
    if (dec !== undefined) return codePointText(Number.parseInt(dec, 10));
    return NAMED[name ?? ''] ?? '';
  });
}

/** Why a URL attribute value is unsafe, or null when it is safe. */
function urlProblem(value: string): string | null {
  const plain = decodeCharRefs(value).replace(IGNORABLE, '').toLowerCase();
  const scheme = SCHEME.exec(plain)?.[1];
  if (scheme === undefined) return null;
  if (FORBIDDEN_SCHEMES.has(scheme)) return `the ${scheme}: scheme`;
  if (scheme === 'data' && !SAFE_DATA_IMAGE.test(plain)) return 'a data: URL that is not a raster image';
  return null;
}

function snippet(html: string, at: number): string {
  return JSON.stringify(html.slice(at, at + 60));
}

/** Every attribute problem of one parsed tag. */
function attrProblems(tag: string, run: string, at: number): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const allowed = TAG_ATTRS[tag];
  const values = new Map<string, string | undefined>();
  for (const m of run.matchAll(ATTR)) {
    const name = m[1] ?? '';
    const value = m[2];
    if (seen.has(name)) out.push(`attribute at ${at}: ${name} twice on <${tag}>`);
    seen.add(name);
    values.set(name, value);
    if (!GLOBAL_ATTRS.has(name) && !(allowed?.has(name) ?? false)) {
      out.push(`attribute at ${at}: ${name} is not allowed on <${tag}>`);
      continue;
    }
    if (value === undefined) {
      if (!(tag === 'details' && name === 'open')) out.push(`attribute at ${at}: ${name} on <${tag}> has no value`);
      continue;
    }
    if (name === 'class') {
      const tokens = value.split(' ').filter((t) => t !== '');
      const hasHljs = tokens.some((t) => HLJS_CLASS.test(t));
      for (const t of tokens) {
        const ok = CLASSES.has(t) || HLJS_CLASS.test(t) || LANGUAGE_CLASS.test(t) || (hasHljs && HLJS_SUBSCOPE.test(t));
        if (!ok) out.push(`class at ${at}: ${JSON.stringify(t)} on <${tag}>`);
      }
    } else if (name === 'id' && !ID_VALUE.test(value)) out.push(`id at ${at}: ${JSON.stringify(value)}`);
    else if (name === 'data-line' && !DATA_LINE.test(value)) out.push(`attribute at ${at}: data-line=${JSON.stringify(value)}`);
    else if (name === 'start' && !START.test(value)) out.push(`attribute at ${at}: start=${JSON.stringify(value)}`);
    else if (name === 'style' && !STYLE.test(value)) out.push(`style at ${at}: ${JSON.stringify(value)}`);
    else if ((name === 'href' && tag === 'a') || (name === 'src' && tag === 'img')) {
      const problem = urlProblem(value);
      if (problem !== null) out.push(`scheme at ${at}: ${name} uses ${problem}: ${JSON.stringify(value)}`);
    }
  }
  if (tag === 'input') {
    const ok =
      values.get('type') === 'checkbox' &&
      values.get('disabled') === 'disabled' &&
      (!values.has('checked') || values.get('checked') === 'checked');
    if (!ok) out.push(`input at ${at}: only a disabled task-list checkbox is allowed`);
  }
  return out;
}

/**
 * Check rendered HTML against the output shapes this library may emit. Returns one message per violation,
 * each starting with its rule (`unparsable`, `comment`, `tag`, `closing`, `attribute`, `class`, `id`,
 * `style`, `input` or `scheme`) and its offset; an empty array means the HTML is safe by these rules.
 */
export function checkOutputSafety(html: string): string[] {
  const out: string[] = [];
  let at = html.indexOf('<');
  while (at !== -1) {
    if (html.startsWith('<!--', at)) {
      out.push(`comment at ${at}: ${snippet(html, at)}`);
      at = html.indexOf('<', at + 1);
      continue;
    }
    TAG.lastIndex = at;
    const m = TAG.exec(html);
    if (m === null) {
      out.push(`unparsable at ${at}: ${snippet(html, at)}`);
      at = html.indexOf('<', at + 1);
      continue;
    }
    const closing = m[1] === '/';
    const tag = m[2] ?? '';
    const run = m[3] ?? '';
    const selfClosing = m[4] === '/';
    if (!TAGS.has(tag)) out.push(`tag at ${at}: <${closing ? '/' : ''}${tag}> is not allowed`);
    else if (closing && (run !== '' || selfClosing)) out.push(`closing at ${at}: ${snippet(html, at)}`);
    else if (selfClosing && !VOID_TAGS.has(tag)) out.push(`closing at ${at}: <${tag} /> is not a void element`);
    else if (!closing) out.push(...attrProblems(tag, run, at));
    at = html.indexOf('<', TAG.lastIndex);
  }
  return out;
}
