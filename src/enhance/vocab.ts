// Every word list of the reading layout, in one place (docserver L2, Task 7a): what a document's words must say for
// the layout to mark them, with each list's default. Two kinds:
//   - options (Task 8 makes each one a host option, a bounded list of strings): the status words and the status
//     column's header words, the ID and rule-ID grammars (by their prefixes), the qualifiers, the addressees, the plan
//     words, the attention words, and the byline item fields and delta-section headings (both default none);
//   - the format contract, the same for every host and documented as such: the technical, decision and title-column
//     header words, the file-path extensions, the glossary's headers and section names, git's merge subjects and the
//     commit-prefix rule, and the colour key's labels.
// A feature never holds a word list of its own: it reads `ctx.vocab`, compiled here once per instance.
//
// Words, never patterns (LD9): a list is plain strings, and compiling escapes every character a pattern would read
// as syntax, so a host's word is matched literally and no pattern of a host's can backtrack without bound. An empty
// list matches nothing. Each list's match is fixed here: a status word opens the text, as a whole word, in any case;
// a header word is a whole word; and so on, as each field says. The grammars around the words (an ID's digits, a
// task number, a step's owner in brackets) are this module's, never a host's.
//
// The defaults reproduce what the prototype marked (status.ts's words and header rule) and port the reference
// layout's own lists, sections 2, 3, 7, 8, 12, 12b, 12c and 24b, except its private words: the qualifiers and the
// byline item fields and delta headings default to none, and the addressees to "you" alone.
//
// Import-inert: declarations only. defaultVocabulary() returns a fresh object, and compileVocab() a frozen one, so
// no instance can change another's words.
import type { FeatureOptions } from './options.js';

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
  /** Words that name the reader, each a whole word, in an owner cell or a step's owner. */
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
  };
  /** Format contract: git's merge subjects, each after "Merge ". */
  mergeForms: string[];
  /** Format contract: the colour key, in its order. */
  colourKey: ColourKeyEntry[];
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
    pathExtensions: ['ts', 'tsx', 'js', 'mjs', 'cjs', 'py', 'md', 'json', 'yaml', 'yml', 'sh', 'tf', 'html', 'css', 'toml', 'go', 'rs', 'sql'],
    glossary: {
      termHeaders: ['term', 'terms', 'word', 'words', 'name', 'names', 'acronym', 'acronyms', 'glossary'],
      meaningHeaders: ['meaning', 'definition', 'means', 'what it means', 'description'],
      sections: ['words used here', 'glossary', 'terms used'],
      notTerms: ['code', 'codes', 'id', 'ids'],
    },
    mergeForms: ['pull request', 'branch', 'remote-tracking branch', 'tag', 'commit', 'remote branch'],
    colourKey: [
      { role: 'nav', label: 'Links, contents and section numbers' },
      { role: 'term', label: 'Terms this document defines' },
      { role: 'id', label: 'Defined IDs, such as R1 or F2' },
      { role: 'wait', label: 'Waiting on you, or still open' },
      { role: 'chg', label: 'Changed, when you compare versions' },
      { role: 'no', label: 'Rejected, or at risk' },
      { role: 'ok', label: 'Settled' },
      { role: 'info', label: 'Deferred, or for information' },
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
  /** A text names the reader, as a whole word, in any case. */
  readonly addressee: RegExp;
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
  readonly techHeader: RegExp;
  readonly decisionHeader: RegExp;
  readonly titleHeader: RegExp;
  /** Inline code that is a file path: a path with a slash, or a file name with a listed extension (and a fragment). */
  readonly path: RegExp;
  readonly glossary: { readonly term: RegExp; readonly meaning: RegExp; readonly section: RegExp; readonly notTerm: RegExp };
  /** A merge commit's subject, in git's own forms. */
  readonly merge: RegExp;
  /** The commit-prefix rule: a leading "type(scope)!: " to drop from a subject. */
  readonly commitPrefix: RegExp;
  readonly colourKey: readonly Readonly<ColourKeyEntry>[];
}

/** A word with every pattern metacharacter escaped, so it matches itself and nothing else. */
function literal(word: string): string {
  return word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** A pattern that never matches. */
const NEVER = '(?!)';

/** One alternation group of the words, each literal; NEVER when there are none. */
function anyOf(words: readonly string[]): string {
  return words.length === 0 ? NEVER : `(?:${words.map(literal).join('|')})`;
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
    pathExtensions: list(w.pathExtensions),
    glossary: Object.freeze({
      termHeaders: list(w.glossary.termHeaders),
      meaningHeaders: list(w.glossary.meaningHeaders),
      sections: list(w.glossary.sections),
      notTerms: list(w.glossary.notTerms),
    }),
    mergeForms: list(w.mergeForms),
    colourKey: Object.freeze(w.colourKey.map((e) => Object.freeze({ role: e.role, label: e.label }))) as ColourKeyEntry[],
  });
}

/** Compile word lists into a vocabulary: a frozen copy of the lists, and their patterns. */
export function compileVocab(given: VocabularyWords): Vocab {
  const w = frozenCopy(given);
  const role = (r: StatusRole): StatusPattern => Object.freeze({ role: r, re: new RegExp(`^(${anyOf(w.status[r])})\\b`, 'i') });
  const idHead = w.ids === false ? null : w.ids.prefixes === null ? '[A-Z]{1,4}' : anyOf(w.ids.prefixes);
  const idBody = idHead === null ? NEVER : `${idHead}-?\\d+(?:[.-]\\d+)*[a-z]?`;
  const ruleHead = w.ruleIds.prefixes === null ? '[A-Z]{2,}' : anyOf(w.ruleIds.prefixes);
  // A heading's words: each part literal, a space or a dash between parts.
  const heading = (words: readonly string[]): string =>
    words.length === 0 ? NEVER : `(?:${words.map((h) => h.split(/[- ]+/).map(literal).join('[- ]')).join('|')})`;
  return Object.freeze({
    words: w,
    status: Object.freeze([role('ok'), role('wait'), role('no'), role('info')]),
    statusHeader: new RegExp(`\\b${anyOf(w.statusHeaders)}\\b`, 'i'),
    rulingHeader: new RegExp(w.rulingHeaders.length === 0 ? '\\?$' : `${anyOf(w.rulingHeaders)}|\\?$`, 'i'),
    id: new RegExp(`^(${idBody})(?=$|[\\s,.:;)])`),
    idScan: () => new RegExp(`\\b(${idBody})\\b`, 'g'),
    ruleId: new RegExp(`^${ruleHead}(?:-[A-Z0-9]+)+$`),
    qualifier: new RegExp(`\\b${anyOf(w.qualifiers)}\\s+$`, 'i'),
    addressee: new RegExp(`\\b${anyOf(w.addressees)}\\b`, 'i'),
    plan: Object.freeze({
      task: new RegExp(`^(${anyOf(w.plan.task)})\\s+([\\w.-]*\\w)\\s*[:.—–]\\s*`),
      step: new RegExp(`^(${anyOf(w.plan.step)}\\s+[\\w.-]+)\\s*(?:\\(([^)]{1,24})\\))?\\s*:\\s*`),
      who: new RegExp(`^${anyOf(w.plan.who)}:\\s*([^.]+)\\.`),
    }),
    attention: Object.freeze({
      status: new RegExp(anyOf(w.attention.status), 'i'),
      who: new RegExp(`^${anyOf(w.attention.who)}\\b`, 'i'),
      question: new RegExp(`^${anyOf(w.attention.question)}`, 'i'),
      openAnswers: new RegExp(`^${anyOf(w.attention.openAnswers)}\\b`, 'i'),
      blocking: new RegExp(`^\\s*${anyOf(w.attention.blocking)}\\b`, 'i'),
      risk: new RegExp(anyOf(w.attention.risk), 'i'),
      openStatus: new RegExp(`^${anyOf(w.attention.openStatus)}`, 'i'),
    }),
    itemField: new RegExp(`^${anyOf(w.itemFields)}$`, 'i'),
    itemHeading: new RegExp(`^(?:\\d+\\.\\s*)?${heading(w.itemHeadings)}$`, 'i'),
    itemKey: /^[A-Z][A-Z0-9]{1,9}-\d+$/,
    techHeader: new RegExp(`\\b${anyOf(w.techHeaders)}s?\\b`, 'i'),
    decisionHeader: new RegExp(anyOf(w.decisionHeaders), 'i'),
    titleHeader: new RegExp(`^${anyOf(w.titleHeaders)}`, 'i'),
    path: new RegExp(`^[\\w@.~-]*\\/[\\w./@#:*{}-]+$|^[\\w-]+\\.${anyOf(w.pathExtensions)}(?:#[\\w-]+)?$`),
    glossary: Object.freeze({
      term: new RegExp(`^${anyOf(w.glossary.termHeaders)}$`, 'i'),
      meaning: new RegExp(`^${anyOf(w.glossary.meaningHeaders)}$`, 'i'),
      section: new RegExp(`^${anyOf(w.glossary.sections)}`, 'i'),
      notTerm: new RegExp(`^${anyOf(w.glossary.notTerms)}\\b`, 'i'),
    }),
    merge: new RegExp(`^Merge ${anyOf(w.mergeForms)}\\b`),
    commitPrefix: /^[a-z]+(?:\([^)]*\))?!?:\s*/i,
    colourKey: w.colourKey,
  });
}

/**
 * The vocabulary of one instance. Today the defaults; L2 Task 8 reads the host's `vocabulary` option here (each list
 * given replaces its default), so the lifecycle passes the options and needs no change for it.
 */
export function createVocab(options: FeatureOptions): Vocab {
  void options;
  return compileVocab(defaultVocabulary());
}
