// The public types of `./render` and its two default limits (docserver L1; architecture section C as amended
// by rulings C2, C3 and C20). Imports nothing, so every module of src/render can import it without a cycle.

/**
 * What `render()` did: parsed and rendered; refused by the byte gate (`over-limit`); stopped because its html
 * would pass `maxHtmlBytes` (`output-over-limit`); or fell back after an internal error.
 */
export type RenderOutcome = 'rendered' | 'over-limit' | 'output-over-limit' | 'failed';

/**
 * The words and grammars the reader reads from `features.vocabulary` (the first consumer's frame option), as `render()`
 * takes them: the shape is the frame's own, so one vocabulary serves the screen's enhance step and the render that tells
 * the host which item values a document names (`meta.items`, which reads `itemFields` and `itemHeadings`; print mode reads
 * the rest). Each list is plain words, never a pattern; a list left out is the frame's default, and the item lists default
 * to none, so a render with no `reader`, or one that names neither, answers no items. A list holds at most 200 words, each
 * 1 to 64 code units with no white space at either end. `test/render-items.test.ts` holds this shape equal to the frame's
 * `VocabularyOptions` and to the reader's own.
 */
export interface ReaderVocabulary {
  /**
   * Status words by colour role: a status cell or a rule's status that opens with one, as a whole word and in any
   * case, takes its role. Default: the general words of each role (agreed, done, pending, open, rejected, deferred, …).
   */
  readonly status?: {
    readonly ok?: readonly string[];
    readonly wait?: readonly string[];
    readonly no?: readonly string[];
    readonly info?: readonly string[];
  };
  /** Header words that name a status column, each as a whole word. Default: status, state, result, verdict, outcome (each also plural), stands, fate. */
  readonly statusHeaders?: readonly string[];
  /**
   * Header words that name a ruling, anywhere in the header: such a column, or one whose header ends in "?", is a
   * status column when half its filled cells open on a status word. Default: ruling, ruled, answer. The "?" rule is
   * no word: it stands with an empty list.
   */
  readonly rulingHeaders?: readonly string[];
  /** What needs the reader. */
  readonly attention?: {
    /** A status column's header holds one, anywhere. Default: status, state, stands, verdict. */
    readonly status?: readonly string[];
    /** An owner column's header opens with one, as a whole word. Default: who, owner, by whom, who acts. */
    readonly who?: readonly string[];
    /** A question table's first header opens with one. Default: question. */
    readonly question?: readonly string[];
    /** An answer still open opens with one, as a whole word. Default: open, unanswered, tbd, to be decided, waiting. */
    readonly openAnswers?: readonly string[];
    /** A cell that blocks opens with one, as a whole word. Default: blocking, blocker, blocks. */
    readonly blocking?: readonly string[];
    /** A status that is a risk holds one, anywhere. Default: diverge. */
    readonly risk?: readonly string[];
    /** A rule's status still open opens with one. Default: open, proposed, awaiting. */
    readonly openStatus?: readonly string[];
  };
  /**
   * The ID grammar: 1 to 4 capitals, an optional dash, a number with dotted or dashed parts and an optional lower-case
   * letter (R14, F3, OP-6, D2.1a). `prefixes` replaces the capitals with these words; false: no IDs at all.
   */
  readonly ids?: false | { readonly prefixes?: readonly string[] };
  /** The rule-ID grammar: two or more capitals, then dash-separated parts of capitals or digits; `prefixes` replaces the capitals. */
  readonly ruleIds?: { readonly prefixes?: readonly string[] };
  /** Words that, right before a mention of an ID, make it another document's ("the annex R3"). Default: none. */
  readonly qualifiers?: readonly string[];
  /** A task heading's word, a step title's word and an owner line's label. Default: Task, Step, Who. */
  readonly plan?: { readonly task?: readonly string[]; readonly step?: readonly string[]; readonly who?: readonly string[] };
  /** Words that name the reader, in an owner line, an owner cell or a step's owner. Default: you. */
  readonly addressees?: readonly string[];
  /**
   * Labels whose text names an item key, for `itemLink`. The byline's: the label of a fact, exactly and in any case ("Tracker:
   * AB-12"). The header line's, when the byline has no such fact and no delta link: in the first paragraph after the title (or from
   * the start with none) and before the first level-2 heading (a blockquote's first paragraph too, never the meta line) that has
   * one, a bold label ("**Tracker:** AB-90", the colon inside the bold text or right after it) or a plain label at the start of a
   * line ("Tracker: AB-90") anywhere in it; the keys read are those of the text from the label to the end of that line, which a
   * newline, a `<br>` or the next bold label ends. A bold label may be any text; a plain label is a letter, then up to 31 letters,
   * digits, spaces, `_`, `/` or `-` (the byline's, a capital then up to 18 letters or spaces), so a field outside those is matched
   * as a bold label only, not refused. Default: none.
   */
  readonly itemFields?: readonly string[];
  /**
   * Level-2 headings, after an optional section number, whose section's first code block names an item key on an
   * `item:` line, for `itemLink`. Default: none.
   */
  readonly itemHeadings?: readonly string[];
  /**
   * Print mode (RenderOptions.print) prints rule paragraphs, with their heads and status pills, and the rules index in the
   * facts panel only when this is true, as the reader builds them only with its `rules` option. Default false.
   */
  readonly rules?: boolean;
}

export interface RenderOptions {
  /**
   * UTF-8 byte cap on the input; above it nothing is parsed. Default DEFAULT_MAX_BYTES. It bounds the input
   * only; `maxHtmlBytes` bounds the html.
   */
  maxBytes?: number;
  /**
   * UTF-8 byte cap on the html; a render whose html would pass it stops with outcome 'output-over-limit'.
   * Default 16777216 (16 MiB, four times DEFAULT_MAX_BYTES).
   */
  maxHtmlBytes?: number;
  /** Emit data-line="a-b" on block elements. Default true. */
  lineAttrs?: boolean;
  /**
   * Colour code fences with highlight.js. Default true. With false every fence keeps its wrapper, its data-line and
   * its `language-<name>` class and holds the code as escaped text, with no span; nothing else changes (request (b)).
   * Any other value than a boolean is a TypeError.
   */
  highlight?: boolean;
  /**
   * The reader's vocabulary (ReaderVocabulary), for `meta.items`: with `itemFields` or `itemHeadings` named, the item values
   * the document names are listed there. Default none: `meta.items` is empty and nothing else changes. A value that is not a
   * plain object, a key the vocabulary does not have, or an item list that is not up to 200 words of 1 to 64 code units with
   * no white space at either end is a TypeError, and so is any other list, group or grammar of the vocabulary that the reader's own
   * `features.vocabulary` would refuse (print mode reads them), or a `rules` that is not a boolean.
   */
  reader?: ReaderVocabulary;
  /**
   * Print mode: the same blocks the reader builds on the page's DOM, written statically, for a host that prints a document
   * without the browser reader. The html is one `div.docreader-print` holding the document with its eyebrow, byline, facts
   * panel, review strip, section numbers, boxes, status labels, plan marks and (with `reader.rules`) rule paragraphs; every
   * `details` is open, nothing is hidden, a figure stays its source, and no attribute but class, id, data-line, open,
   * colspan, rowspan, align, alt, title and href is written (an `img` also keeps its `src`, the image reference as render wrote it).
   * The two fallback blocks, for an outcome of 'failed' or 'output-over-limit', are what they are without `print`: they are not inside
   * `div.docreader-print`. Default false: the html is what it was. Not a boolean: a TypeError.
   */
  print?: boolean;
}

export interface Heading {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  /** the heading's id in the html; authors control it and it may equal another element's id: never look up by it */
  id: string;
  /** plain text as the author wrote it, not escaped HTML: insert it with textContent, or escape it */
  text: string;
}

/**
 * One front-matter key, in source order. The same shape as the reference renderer's front matter entries. `key` and `vals`
 * are plain text as the author wrote them, not escaped HTML: insert them with textContent, or escape them.
 */
export interface FrontEntry {
  key: string;
  list: boolean;
  vals: string[];
}

export interface RenderMeta {
  /**
   * null-prototype record derived from frontList: list ? vals : vals[0]. null when there is no front-matter
   * mapping. Its keys and values are plain text, not escaped HTML.
   */
  front: Readonly<Record<string, string | readonly string[]>> | null;
  frontList: readonly FrontEntry[] | null;
  /** text of the first level-1 heading in document order, else null; plain text, not escaped HTML */
  title: string | null;
  headings: readonly Heading[];
  /** count of figure.mermaid-figure emitted */
  figures: number;
  /** count of tables emitted */
  tables: number;
  /** distinct diagram keywords of rendered mermaid fences, document order, max 32 */
  mermaidKinds: readonly string[];
  /**
   * The distinct item values the reader would ask its host `itemLink` for, in document order, at most 50, each at most 100
   * code units (a longer one is left out, not cut). Read only where the reader reads them (RenderOptions.reader): the byline
   * fact labelled with an item field, the first section headed with an item heading whose first code block opens on an
   * `item:` line, and, when the byline has no item fact, the keys of a header line: the line, in a paragraph after the title and
   * before the first level-2 heading, that an item field's label opens (`**Tracker:** AB-90`), to its end. Empty without `reader`.
   * Plain text, not escaped HTML.
   */
  items: readonly string[];
}

export interface RenderResult {
  /** '' when over-limit; the escaped fallback block, cut to maxHtmlBytes, when output-over-limit or failed */
  html: string;
  outcome: RenderOutcome;
  /** measured UTF-8 length (when over-limit: the cap + 1 at which counting stopped) */
  bytes: number;
  /** the frozen empty meta unless outcome === 'rendered' */
  meta: RenderMeta;
}

export interface ScanRefsOptions {
  /** UTF-8 byte cap on the input, as for render(). Default DEFAULT_MAX_BYTES. */
  maxBytes?: number;
  /** most distinct image sources returned. Default DEFAULT_MAX_IMAGES. */
  maxImages?: number;
}

export interface ScanRefsResult {
  outcome: 'scanned' | 'over-limit';
  /** distinct img src values exactly as render() emits them (post normalizeLink), document order */
  images: string[];
  /** true when more than maxImages distinct images exist */
  imagesTruncated: boolean;
  /**
   * only fences render() turns into figures: their content's size in UTF-8 bytes, and in UTF-16 code units (`Chars`,
   * the unit of the layout's Mermaid `maxTextSize` check, `text.length`)
   */
  mermaid: { fences: number; largestBytes: number; totalBytes: number; largestChars: number; totalChars: number };
}

/** Default UTF-8 byte cap for render() and scanRefs(): 4 MiB (ruling C3). Hosts pass their own. */
export const DEFAULT_MAX_BYTES = 4_194_304;

/** Default cap on distinct images returned by scanRefs() (ruling C3). Hosts pass their own. */
export const DEFAULT_MAX_IMAGES = 512;
