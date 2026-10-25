// Every word list of the reading layout, in one place (docserver L2, Tasks 7a and 8): what a document's words must say
// for the layout to mark them, with each list's default. Two kinds:
//   - options, the host's `vocabulary` (Task 8; types.ts's VocabularyOptions, checked and bounded by options.ts): the
//     status words and the status column's header and ruling-header words, the ID and rule-ID grammars (by their
//     prefixes), the qualifiers, the addressees, the plan words, the attention words (a rule's open statuses
//     included), and the byline item fields and delta-section headings (both default none). Each list given replaces
//     its default whole (mergeVocabulary); a list left out keeps it.
//   - the format contract, the same for every host and documented as such: the technical, decision and title-column
//     header words, the decisions table's header word, the file-path extensions, the glossary's headers, section
//     names, alias stop words and name joins, the rule-ID list's joins, git's merge subjects and the commit-prefix
//     rule, the colour key's labels (the reference layout's, its ID examples neutral), the editorial boxes' headings
//     ("In short", "Where things stand"), the callout kinds' words, the front-matter keys that name the document's
//     kind, and the delta block's `item:` line.
// Of the three lists C48 left to rule, `rulingHeaders` and `attention.openStatus` are options (they belong to the
// status column's rule and to the status words, both options), and `decisionHeaders` is the format contract (the
// product lens's own rule that decisions stay, beside the technical header words).
// A feature never holds a word list of its own: it reads `ctx.vocab`, compiled here once per instance.
//
// Words, never patterns (LD9): a list is plain strings, and compiling escapes every character a pattern would read
// as syntax, so a host's word is matched literally and no pattern of a host's can backtrack without bound. An empty
// list matches no word (the ruling header's "?" rule is no word, and stands). Each list's match is fixed here: a
// status word opens the text, as a whole word, in any case; a header word is a whole word; and so on, as each field
// says. The grammars around the words (an ID's digits, a task number, a step's owner in brackets) are this module's,
// never a host's.
//
// A whole word (`whole()`), in any script: on a side where the word ends in a letter, a digit, a combining mark or
// `_` (Unicode's, not ASCII's alone), the text holds none of those right beyond it; on a side where it ends in
// anything else (punctuation, a symbol), that edge is its own boundary and nothing is asked of the text there. So
// "готово", "validé" and "完了" match as words, as "done" does, and "done!" or "✓" open a status too. The patterns
// that read a whole word of an option list (the status roles, the status header, the qualifier, the addressee, the
// attention's owner, open-answer and blocking words, and the ID scan) carry the `u` flag their lookarounds need: a
// copy of one must keep its flags (`new RegExp(re)`), never its source alone. The format contract's words are ASCII
// and keep ASCII's `\b`. options.ts refuses a word with white space at either end, which no rule could match.
//
// The defaults reproduce what the prototype marked (status.ts's words and header rule) and port the reference
// layout's own lists, sections 2, 3, 5, 7, 8, 12, 12b, 12c, 16 and 24b, except its private words: the qualifiers and
// the byline item fields and delta headings default to none, the ID and rule-ID grammars take no prefix, and the
// addressees are "you" alone.
//
// Import-inert: declarations only. defaultVocabulary() returns a fresh object, and compileVocab() a frozen one, so
// no instance can change another's words.
import type { FeatureOptions } from './options.js';
import type { VocabularyOptions } from './types.js';

/** The four colour roles a status word takes. */
export type StatusRole = 'ok' | 'wait' | 'no' | 'info';

/** The colour key's roles: the status roles, and the colours of links, terms, IDs, changes and code. */
export type ColourRole = 'nav' | 'term' | 'id' | 'wait' | 'chg' | 'no' | 'ok' | 'info' | 'code';

/** One line of the colour key: the role's swatch, and a neutral label for it. */
export interface ColourKeyEntry {
  role: ColourRole;
  label: string;
}

/** The word lists, as data. Every list is plain strings, matched literally. */
export interface VocabularyWords {
  /** Status words by colour role; a cell or rule status that opens with one, as a whole word, takes its role. */
  status: { ok: string[]; wait: string[]; no: string[]; info: string[] };
  /** Header words that name a status column, each a whole word ("Current status"). */
  statusHeaders: string[];
  /** Header words that name a ruling, anywhere in the header; a header that ends in "?" asks a question. */
  rulingHeaders: string[];
  /**
   * The ID grammar: 1 to 4 capitals (or one of `prefixes`), an optional dash, a number with dotted or dashed parts,
   * an optional lower-case letter. False: no IDs at all.
   */
  ids: false | { prefixes: string[] | null };
  /** The rule-ID grammar: two or more capitals (or one of `prefixes`), then dash-separated parts of capitals or digits. */
  ruleIds: { prefixes: string[] | null };
  /** Words that, right before a mention of an ID, make it another document's ("the annex R3"). Default none. */
  qualifiers: string[];
  /**
   * Words that name the reader: as a whole word in an owner line or an owner cell (`addressee`), and anywhere in a
   * step's bracketed owner, as the reference's section 7 reads it (`addresseeAnywhere`: "(yours)" too).
   */
  addressees: string[];
  /** A task heading's word ("Task 3:"), a step title's word ("Step 2 (you):") and an owner line's label ("Who:"). */
  plan: { task: string[]; step: string[]; who: string[] };
  /** What needs the reader: header and answer words of section 12c. */
  attention: {
    /** A status column's header holds one of these, anywhere. */
    status: string[];
    /** An owner column's header opens with one, as a whole word. */
    who: string[];
    /** A question table's first header opens with one. */
    question: string[];
    /**
     * An answer still open opens with one, as a whole word. (Not named `open`: the walls refuse that member name,
     * a document's own.)
     */
    openAnswers: string[];
    /** A cell that blocks opens with one, as a whole word. */
    blocking: string[];
    /** A status that is a risk holds one, anywhere. */
    risk: string[];
    /** A rule's status still open opens with one. */
    openStatus: string[];
  };
  /** Byline fact labels whose value names an item ("Tracker: AB-12"). Default none. */
  itemFields: string[];
  /** Section headings whose first code block names an item, as an `item:` line. Default none. */
  itemHeadings: string[];
  /** Format contract: header words of a technical table, each a whole word, plural or not. */
  techHeaders: string[];
  /** Format contract: header words that keep an index table out of the product lens, anywhere in the header. */
  decisionHeaders: string[];
  /** Format contract: a column whose header opens with one of these holds an ID row's title. */
  titleHeaders: string[];
  /** Format contract: the review strip's decisions table is an ID table with one of these anywhere in a header. */
  decisionTableHeaders: string[];
  /** Format contract: what joins two rule IDs in a list ("AB-1 and AB-2"), besides a comma. */
  ruleIdJoins: string[];
  /** Format contract: the file extensions that make inline code a file path. */
  pathExtensions: string[];
  /** Format contract: what makes a table a glossary. */
  glossary: {
    /** The first header, exactly. */
    termHeaders: string[];
    /** The second header, exactly. */
    meaningHeaders: string[];
    /** A section whose name opens with one holds a glossary. */
    sections: string[];
    /** A term cell that opens with one, as a whole word, defines no term. */
    notTerms: string[];
    /** A term's "(x)": an alias, unless x is exactly one of these, in any case. */
    aliasStops: string[];
    /** What joins a term cell's names, as a whole word, besides a comma and a slash ("A, B and C / D"). */
    nameJoins: string[];
  };
  /** Format contract: git's merge subjects, each after "Merge ". */
  mergeForms: string[];
  /** Format contract: abbreviated local civil-day labels, Sunday through Saturday and January through December. */
  dates: { weekdays: string[]; months: string[] };
  /** Format contract: the colour key, in its order. */
  colourKey: ColourKeyEntry[];
  /** Format contract: the level-2 headings of the editorial boxes, each the whole heading, in any case. */
  boxes: { short: string[]; stand: string[] };
  /** Format contract: a "Where things stand" level-3 heading that opens with one of a kind's words is that kind's callout. */
  callouts: { agreed: string[]; waiting: string[]; later: string[] };
  /** Format contract: the front matter's scalar keys whose value names the document's kind (the eyebrow), each whole, in any case. */
  kindKeys: string[];
}

/** The defaults, as a fresh object each call. */
export function defaultVocabulary(): VocabularyWords {
  return {
    status: {
      ok: ['ruled', 'accepted', 'agreed', 'kept', 'confirmed', 'measured', 'done', 'verified', 'yes', 'implemented', 'approved'],
      wait: ['awaiting', 'proposed', 'pending', 'open', 'waiting', 'partly', 'partial', 'to do', 'in review', 'draft'],
      no: ['rejected', 'withdrawn', 'dropped', 'removed', 'refused', 'no', 'diverges', 'blocked'],
      info: ['changed', 'amended', 'deferred', 'later', 'pinned', 'judgement', 'sourced', 'reported', 'superseded'],
    },
    statusHeaders: ['status', 'statuses', 'state', 'states', 'result', 'results', 'verdict', 'verdicts', 'outcome', 'outcomes', 'stands', 'fate'],
    rulingHeaders: ['ruling', 'ruled', 'answer'],
    ids: { prefixes: null },
    ruleIds: { prefixes: null },
    qualifiers: [],
    addressees: ['you'],
    plan: { task: ['Task'], step: ['Step'], who: ['Who'] },
    attention: {
      status: ['status', 'state', 'stands', 'verdict'],
      who: ['who', 'owner', 'by whom', 'who acts'],
      question: ['question'],
      openAnswers: ['open', 'unanswered', 'tbd', 'to be decided', 'waiting'],
      blocking: ['blocking', 'blocker', 'blocks'],
      risk: ['diverge'],
      openStatus: ['open', 'proposed', 'awaiting'],
    },
    itemFields: [],
    itemHeadings: [],
    techHeaders: ['file', 'path', 'test', 'command', 'module', 'function', 'endpoint', 'field', 'grammar', 'regex', 'schema', 'key', 'route', 'symbol', 'code', 'type', 'constant', 'env'],
    decisionHeaders: ['status', 'ruling', 'decision'],
    titleHeaders: ['what', 'decision', 'title', 'name', 'summary', 'meaning', 'description', 'format', 'choice', 'effect', 'task', 'question', 'proposal', 'rule'],
    decisionTableHeaders: ['status'],
    ruleIdJoins: ['and'],
    pathExtensions: ['ts', 'tsx', 'js', 'mjs', 'cjs', 'py', 'md', 'json', 'yaml', 'yml', 'sh', 'tf', 'html', 'css', 'toml', 'go', 'rs', 'sql'],
    glossary: {
      termHeaders: ['term', 'terms', 'word', 'words', 'name', 'names', 'acronym', 'acronyms', 'glossary'],
      meaningHeaders: ['meaning', 'definition', 'means', 'what it means', 'description'],
      sections: ['words used here', 'glossary', 'terms used'],
      notTerms: ['code', 'codes', 'id', 'ids'],
      aliasStops: ['the', 'for', 'a', 'an'],
      nameJoins: ['and'],
    },
    mergeForms: ['pull request', 'branch', 'remote-tracking branch', 'tag', 'commit', 'remote branch'],
    dates: { weekdays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] },
    boxes: { short: ['in short'], stand: ['where things stand'] },
    callouts: { agreed: ['agreed'], waiting: ['waiting'], later: ['later'] },
    kindKeys: ['type', 'area', 'status', 'kind'],
    colourKey: [
      { role: 'nav', label: 'Links, contents, section numbers' },
      { role: 'term', label: 'Terms defined in this doc' },
      { role: 'id', label: 'IDs: R14, F3, …' },
      { role: 'wait', label: 'Waiting on you · open · partial' },
      { role: 'chg', label: 'Changed (when you compare)' },
      { role: 'no', label: 'Rejected · diverges · risk' },
      { role: 'ok', label: 'Settled: ruled, agreed, done' },
      { role: 'info', label: 'Deferred · later · pinned' },
      { role: 'code', label: 'Code and file paths' },
    ],
  };
}

/** One status role's pattern: the text opens with one of its words, as a whole word, in any case. */
export interface StatusPattern {
  readonly role: StatusRole;
  readonly re: RegExp;
}

/**
 * The vocabulary as features use it: the lists in force (`words`, a frozen copy) and their patterns, compiled once
 * per instance. No pattern carries the global flag except what `idScan()` returns, fresh on each call, so a pattern
 * keeps no state between two uses.
 */
export interface Vocab {
  readonly words: Readonly<VocabularyWords>;
  /** By role, in the order ok, wait, no, info: the first that matches decides (status.ts's statusOf). */
  readonly status: readonly StatusPattern[];
  /** A header that names a status column, as a whole word. */
  readonly statusHeader: RegExp;
  /** A header that names a ruling (a word anywhere), or asks a question (ends in "?"). */
  readonly rulingHeader: RegExp;
  /** An ID at the start of a text, followed by its end, white space or , . : ; ). Group 1 is the ID. */
  readonly id: RegExp;
  /** A fresh global pattern for every ID in a text, each a whole word. Group 1 is the ID. */
  idScan(): RegExp;
  /** A whole text that is a rule ID. */
  readonly ruleId: RegExp;
  /** The text right before a mention ends on a qualifier word and white space. */
  readonly qualifier: RegExp;
  /** A text names the reader, as a whole word, in any case (an owner line, an owner cell). */
  readonly addressee: RegExp;
  /** A step's bracketed owner names the reader: one of the words anywhere, in any case ("yours"). */
  readonly addresseeAnywhere: RegExp;
  readonly plan: {
    /** A task heading's start: group 1 the word, group 2 its number; group 0 is the whole prefix to split off. */
    readonly task: RegExp;
    /** A step title's start: group 1 the word and its number, group 2 the owner in brackets (if any). */
    readonly step: RegExp;
    /** An owner line: group 1 the owner, up to the first full stop. */
    readonly who: RegExp;
  };
  readonly attention: {
    readonly status: RegExp;
    readonly who: RegExp;
    readonly question: RegExp;
    readonly openAnswers: RegExp;
    readonly blocking: RegExp;
    readonly risk: RegExp;
    readonly openStatus: RegExp;
  };
  /** A byline fact label that names an item, exactly, in any case. */
  readonly itemField: RegExp;
  /** A section heading whose first code block names an item: an optional section number, then the words (a space or a dash between them). */
  readonly itemHeading: RegExp;
  /** An item key: a capital, 1 to 9 capitals or digits, a dash, a number ("AB-12"). */
  readonly itemKey: RegExp;
  /** A fresh global pattern for every item key in a text, with no word character or dash on either side. Group 1 is the key. */
  itemKeyScan(): RegExp;
  /** A delta block's item line, the whole line: "item:", then the value (group 1), with no white space in it. */
  readonly itemLine: RegExp;
  readonly techHeader: RegExp;
  readonly decisionHeader: RegExp;
  readonly titleHeader: RegExp;
  /** A header of the review strip's decisions table: one of the words anywhere, in any case ("Current status"). */
  readonly decisionTable: RegExp;
  /** The whole text between two rule IDs of a list: a comma, a join word, or a comma and a join word. */
  readonly ruleIdJoin: RegExp;
  /** Inline code that is a file path: a path with a slash, or a file name with a listed extension (and a fragment). */
  readonly path: RegExp;
  readonly glossary: {
    readonly term: RegExp;
    readonly meaning: RegExp;
    readonly section: RegExp;
    readonly notTerm: RegExp;
    /** A whole text that is an alias stop word: "(the)" qualifies a term, it names no alias. */
    readonly aliasStop: RegExp;
    /** For split(): the joins between a term cell's names, a comma, a join word or a slash, with their spaces. */
    readonly nameSplit: RegExp;
  };
  /** A merge commit's subject, in git's own forms. */
  readonly merge: RegExp;
  /** The commit-prefix rule: a leading "type(scope)!: " to drop from a subject. */
  readonly commitPrefix: RegExp;
  readonly colourKey: readonly Readonly<ColourKeyEntry>[];
  /** The editorial boxes' headings: the whole heading text, in any case. */
  readonly box: { readonly short: RegExp; readonly stand: RegExp };
  /** A callout's kind: its heading opens with one of the kind's words, in any case. */
  readonly callout: { readonly agreed: RegExp; readonly waiting: RegExp; readonly later: RegExp };
  /** A front-matter key that names the document's kind, whole, in any case. */
  readonly kindKey: RegExp;
}

/** A word with every pattern metacharacter escaped, so it matches itself and nothing else. */
function literal(word: string): string {
  return word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** A pattern that never matches. */
const NEVER = '(?!)';

/** An item key's grammar (format contract): a capital, 1 to 9 capitals or digits, a dash, a number. */
const ITEM_KEY = '[A-Z][A-Z0-9]{1,9}-\\d+';

/** One alternation group of the words, each literal; NEVER when there are none. */
function anyOf(words: readonly string[]): string {
  return words.length === 0 ? NEVER : `(?:${words.map(literal).join('|')})`;
}

/** A word character of any script: a letter, a digit, a combining mark or `_`. Needs the `u` flag. */
const WORD_CHAR = '[\\p{L}\\p{N}\\p{M}_]';

/** Whether one code point is a WORD_CHAR. */
const isWordChar = (c: string | undefined): boolean => c !== undefined && /^[\p{L}\p{N}\p{M}_]$/u.test(c);

/** No word character right before this point. Needs the `u` flag. */
const NOT_AFTER_WORD = `(?<!${WORD_CHAR})`;

/** No word character right after this point. Needs the `u` flag. */
const NOT_BEFORE_WORD = `(?!${WORD_CHAR})`;

/**
 * One alternation group of the words, each literal and whole (see the header): on the sides asked for, a word that
 * ends there in a word character is bounded by no word character in the text; NEVER when there are none. A pattern
 * built with it takes the `u` flag.
 */
function whole(words: readonly string[], before: boolean, after: boolean): string {
  if (words.length === 0) return NEVER;
  const one = (w: string): string => {
    const cps = [...w];
    const lead = before && isWordChar(cps[0]) ? NOT_AFTER_WORD : '';
    const tail = after && isWordChar(cps[cps.length - 1]) ? NOT_BEFORE_WORD : '';
    return `${lead}${literal(w)}${tail}`;
  };
  return `(?:${words.map(one).join('|')})`;
}

/** A copy of the lists, every array and object in it frozen. */
function frozenCopy(w: VocabularyWords): Readonly<VocabularyWords> {
  const list = (a: readonly string[]): string[] => Object.freeze([...a]) as string[];
  return Object.freeze({
    status: Object.freeze({ ok: list(w.status.ok), wait: list(w.status.wait), no: list(w.status.no), info: list(w.status.info) }),
    statusHeaders: list(w.statusHeaders),
    rulingHeaders: list(w.rulingHeaders),
    ids: w.ids === false ? false : Object.freeze({ prefixes: w.ids.prefixes === null ? null : list(w.ids.prefixes) }),
    ruleIds: Object.freeze({ prefixes: w.ruleIds.prefixes === null ? null : list(w.ruleIds.prefixes) }),
    qualifiers: list(w.qualifiers),
    addressees: list(w.addressees),
    plan: Object.freeze({ task: list(w.plan.task), step: list(w.plan.step), who: list(w.plan.who) }),
    attention: Object.freeze({
      status: list(w.attention.status),
      who: list(w.attention.who),
      question: list(w.attention.question),
      openAnswers: list(w.attention.openAnswers),
      blocking: list(w.attention.blocking),
      risk: list(w.attention.risk),
      openStatus: list(w.attention.openStatus),
    }),
    itemFields: list(w.itemFields),
    itemHeadings: list(w.itemHeadings),
    techHeaders: list(w.techHeaders),
    decisionHeaders: list(w.decisionHeaders),
    titleHeaders: list(w.titleHeaders),
    decisionTableHeaders: list(w.decisionTableHeaders),
    ruleIdJoins: list(w.ruleIdJoins),
    pathExtensions: list(w.pathExtensions),
    glossary: Object.freeze({
      termHeaders: list(w.glossary.termHeaders),
      meaningHeaders: list(w.glossary.meaningHeaders),
      sections: list(w.glossary.sections),
      notTerms: list(w.glossary.notTerms),
      aliasStops: list(w.glossary.aliasStops),
      nameJoins: list(w.glossary.nameJoins),
    }),
    mergeForms: list(w.mergeForms),
    dates: Object.freeze({ weekdays: list(w.dates.weekdays), months: list(w.dates.months) }),
    colourKey: Object.freeze(w.colourKey.map((e) => Object.freeze({ role: e.role, label: e.label }))) as ColourKeyEntry[],
    boxes: Object.freeze({ short: list(w.boxes.short), stand: list(w.boxes.stand) }),
    callouts: Object.freeze({ agreed: list(w.callouts.agreed), waiting: list(w.callouts.waiting), later: list(w.callouts.later) }),
    kindKeys: list(w.kindKeys),
  });
}

/** Compile word lists into a vocabulary: a frozen copy of the lists, and their patterns. */
export function compileVocab(given: VocabularyWords): Vocab {
  const w = frozenCopy(given);
  const role = (r: StatusRole): StatusPattern => Object.freeze({ role: r, re: new RegExp(`^(${whole(w.status[r], false, true)})`, 'iu') });
  const idHead = w.ids === false ? null : w.ids.prefixes === null ? '[A-Z]{1,4}' : anyOf(w.ids.prefixes);
  const idTail = '-?\\d+(?:[.-]\\d+)*[a-z]?';
  const idBody = idHead === null ? NEVER : `${idHead}${idTail}`;
  // The scan's ID is whole: no word character before its prefix (when that ends in one) or after its last character.
  const idScanHead = w.ids === false ? null : w.ids.prefixes === null ? `${NOT_AFTER_WORD}[A-Z]{1,4}` : whole(w.ids.prefixes, true, false);
  const idScanBody = idScanHead === null ? NEVER : `${idScanHead}${idTail}`;
  const ruleHead = w.ruleIds.prefixes === null ? '[A-Z]{2,}' : anyOf(w.ruleIds.prefixes);
  // A heading's words: each part literal, a space or a dash between parts.
  const heading = (words: readonly string[]): string =>
    words.length === 0 ? NEVER : `(?:${words.map((h) => h.split(/[- ]+/).map(literal).join('[- ]')).join('|')})`;
  return Object.freeze({
    words: w,
    status: Object.freeze([role('ok'), role('wait'), role('no'), role('info')]),
    statusHeader: new RegExp(whole(w.statusHeaders, true, true), 'iu'),
    rulingHeader: new RegExp(w.rulingHeaders.length === 0 ? '\\?$' : `${anyOf(w.rulingHeaders)}|\\?$`, 'i'),
    id: new RegExp(`^(${idBody})(?=$|[\\s,.:;)])`),
    idScan: () => new RegExp(`(${idScanBody})${NOT_BEFORE_WORD}`, 'gu'),
    ruleId: new RegExp(`^${ruleHead}(?:-[A-Z0-9]+)+$`),
    qualifier: new RegExp(`${whole(w.qualifiers, true, false)}\\s+$`, 'iu'),
    addressee: new RegExp(whole(w.addressees, true, true), 'iu'),
    addresseeAnywhere: new RegExp(anyOf(w.addressees), 'i'),
    plan: Object.freeze({
      task: new RegExp(`^(${anyOf(w.plan.task)})\\s+([\\w.-]*\\w)\\s*[:.—–]\\s*`),
      step: new RegExp(`^(${anyOf(w.plan.step)}\\s+[\\w.-]+)\\s*(?:\\(([^)]{1,24})\\))?\\s*:\\s*`),
      who: new RegExp(`^${anyOf(w.plan.who)}:\\s*([^.]+)\\.`),
    }),
    attention: Object.freeze({
      status: new RegExp(anyOf(w.attention.status), 'i'),
      who: new RegExp(`^${whole(w.attention.who, false, true)}`, 'iu'),
      question: new RegExp(`^${anyOf(w.attention.question)}`, 'i'),
      openAnswers: new RegExp(`^${whole(w.attention.openAnswers, false, true)}`, 'iu'),
      blocking: new RegExp(`^\\s*${whole(w.attention.blocking, false, true)}`, 'iu'),
      risk: new RegExp(anyOf(w.attention.risk), 'i'),
      openStatus: new RegExp(`^${anyOf(w.attention.openStatus)}`, 'i'),
    }),
    itemField: new RegExp(`^${anyOf(w.itemFields)}$`, 'i'),
    itemHeading: new RegExp(`^(?:\\d+\\.\\s*)?${heading(w.itemHeadings)}$`, 'i'),
    itemKey: new RegExp(`^${ITEM_KEY}$`),
    itemKeyScan: () => new RegExp(`(?<![\\w-])(${ITEM_KEY})(?![\\w-])`, 'g'),
    itemLine: /^item:\s*(\S+)$/,
    techHeader: new RegExp(`\\b${anyOf(w.techHeaders)}s?\\b`, 'i'),
    decisionHeader: new RegExp(anyOf(w.decisionHeaders), 'i'),
    titleHeader: new RegExp(`^${anyOf(w.titleHeaders)}`, 'i'),
    decisionTable: new RegExp(anyOf(w.decisionTableHeaders), 'i'),
    ruleIdJoin: new RegExp(`^\\s*(?:,|${anyOf(w.ruleIdJoins)}|,\\s*${anyOf(w.ruleIdJoins)})\\s*$`),
    path: new RegExp(`^[\\w@.~-]*\\/[\\w./@#:*{}-]+$|^[\\w-]+\\.${anyOf(w.pathExtensions)}(?:#[\\w-]+)?$`),
    glossary: Object.freeze({
      term: new RegExp(`^${anyOf(w.glossary.termHeaders)}$`, 'i'),
      meaning: new RegExp(`^${anyOf(w.glossary.meaningHeaders)}$`, 'i'),
      section: new RegExp(`^${anyOf(w.glossary.sections)}`, 'i'),
      notTerm: new RegExp(`^${anyOf(w.glossary.notTerms)}\\b`, 'i'),
      aliasStop: new RegExp(`^${anyOf(w.glossary.aliasStops)}$`, 'i'),
      nameSplit: new RegExp(`\\s*,\\s*|\\s+${anyOf(w.glossary.nameJoins)}\\s+|\\s*\\/\\s*`),
    }),
    merge: new RegExp(`^Merge ${anyOf(w.mergeForms)}\\b`),
    commitPrefix: /^[a-z]+(?:\([^)]*\))?!?:\s*/i,
    colourKey: w.colourKey,
    box: Object.freeze({ short: new RegExp(`^${anyOf(w.boxes.short)}$`, 'i'), stand: new RegExp(`^${anyOf(w.boxes.stand)}$`, 'i') }),
    callout: Object.freeze({
      agreed: new RegExp(`^${anyOf(w.callouts.agreed)}`, 'i'),
      waiting: new RegExp(`^${anyOf(w.callouts.waiting)}`, 'i'),
      later: new RegExp(`^${anyOf(w.callouts.later)}`, 'i'),
    }),
    kindKey: new RegExp(`^${anyOf(w.kindKeys)}$`, 'i'),
  });
}

/**
 * The word lists with the host's over them: each list the host gave (options.ts checked and bounded it) replaces its
 * default whole, a list left out keeps it, and a group given in part keeps the default of each list it leaves out.
 * `ids: false` is no IDs; an ID grammar given without prefixes is the default grammar. A fresh object; `w` is unchanged.
 */
export function mergeVocabulary(w: VocabularyWords, o: VocabularyOptions): VocabularyWords {
  const list = (given: readonly string[] | undefined, fallback: readonly string[]): string[] => [...(given ?? fallback)];
  const grammar = (g: { readonly prefixes?: readonly string[] }): { prefixes: string[] | null } => ({ prefixes: g.prefixes === undefined ? null : [...g.prefixes] });
  return {
    ...w,
    status: { ok: list(o.status?.ok, w.status.ok), wait: list(o.status?.wait, w.status.wait), no: list(o.status?.no, w.status.no), info: list(o.status?.info, w.status.info) },
    statusHeaders: list(o.statusHeaders, w.statusHeaders),
    rulingHeaders: list(o.rulingHeaders, w.rulingHeaders),
    ids: o.ids === undefined ? w.ids : o.ids === false ? false : grammar(o.ids),
    ruleIds: o.ruleIds === undefined ? w.ruleIds : grammar(o.ruleIds),
    qualifiers: list(o.qualifiers, w.qualifiers),
    addressees: list(o.addressees, w.addressees),
    plan: { task: list(o.plan?.task, w.plan.task), step: list(o.plan?.step, w.plan.step), who: list(o.plan?.who, w.plan.who) },
    attention: {
      status: list(o.attention?.status, w.attention.status),
      who: list(o.attention?.who, w.attention.who),
      question: list(o.attention?.question, w.attention.question),
      openAnswers: list(o.attention?.openAnswers, w.attention.openAnswers),
      blocking: list(o.attention?.blocking, w.attention.blocking),
      risk: list(o.attention?.risk, w.attention.risk),
      openStatus: list(o.attention?.openStatus, w.attention.openStatus),
    },
    itemFields: list(o.itemFields, w.itemFields),
    itemHeadings: list(o.itemHeadings, w.itemHeadings),
  };
}

/** The vocabulary of one instance: the defaults, with the host's `vocabulary` option over them. */
export function createVocab(options: FeatureOptions): Vocab {
  return compileVocab(mergeVocabulary(defaultVocabulary(), options.vocabulary));
}
