// The words print mode reads (docserver parity, Task 7): the reader's own lists and grammars (src/enhance/vocab.ts), with the
// defaults and the same compiled patterns, for the part of the vocabulary the printed blocks use. render() imports nothing of
// the enhance step, so this is a copy; test/render-print.test.ts holds every pattern here equal (source and flags) to
// compileVocab(mergeVocabulary(defaultVocabulary(), options)) for the defaults and for a host's lists.
import type { CheckedReader } from '../reader.js';

export type StatusRole = 'ok' | 'wait' | 'no' | 'info';

interface Words {
  status: Record<StatusRole, string[]>;
  statusHeaders: string[];
  rulingHeaders: string[];
  ids: false | { prefixes: string[] | null };
  ruleIds: { prefixes: string[] | null };
  addressees: string[];
  plan: { task: string[]; step: string[]; who: string[] };
  decisionTableHeaders: string[];
  ruleIdJoins: string[];
  boxes: { short: string[]; stand: string[] };
  callouts: { agreed: string[]; waiting: string[]; later: string[] };
  kindKeys: string[];
}

function defaults(): Words {
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
    addressees: ['you'],
    plan: { task: ['Task'], step: ['Step'], who: ['Who'] },
    decisionTableHeaders: ['status'],
    ruleIdJoins: ['and'],
    boxes: { short: ['in short'], stand: ['where things stand'] },
    callouts: { agreed: ['agreed'], waiting: ['waiting'], later: ['later'] },
    kindKeys: ['type', 'area', 'status', 'kind'],
  };
}

function merged(o: CheckedReader): Words {
  const w = defaults();
  const list = (given: readonly string[] | undefined, fallback: string[]): string[] => (given === undefined ? fallback : [...given]);
  const grammar = (g: { readonly prefixes?: readonly string[] }): { prefixes: string[] | null } => ({ prefixes: g.prefixes === undefined ? null : [...g.prefixes] });
  return {
    ...w,
    status: { ok: list(o.status?.ok, w.status.ok), wait: list(o.status?.wait, w.status.wait), no: list(o.status?.no, w.status.no), info: list(o.status?.info, w.status.info) },
    statusHeaders: list(o.statusHeaders, w.statusHeaders),
    rulingHeaders: list(o.rulingHeaders, w.rulingHeaders),
    ids: o.ids === undefined ? w.ids : o.ids === false ? false : grammar(o.ids),
    ruleIds: o.ruleIds === undefined ? w.ruleIds : grammar(o.ruleIds),
    addressees: list(o.addressees, w.addressees),
    plan: { task: list(o.plan?.task, w.plan.task), step: list(o.plan?.step, w.plan.step), who: list(o.plan?.who, w.plan.who) },
  };
}

export interface PrintVocab {
  readonly status: readonly { readonly role: StatusRole; readonly re: RegExp }[];
  readonly statusHeader: RegExp;
  readonly rulingHeader: RegExp;
  readonly id: RegExp;
  readonly ruleId: RegExp;
  readonly ruleIdJoin: RegExp;
  readonly addressee: RegExp;
  readonly addresseeAnywhere: RegExp;
  readonly plan: { readonly task: RegExp; readonly step: RegExp; readonly who: RegExp };
  readonly decisionTable: RegExp;
  readonly box: { readonly short: RegExp; readonly stand: RegExp };
  readonly callout: { readonly agreed: RegExp; readonly waiting: RegExp; readonly later: RegExp };
  readonly kindKey: RegExp;
}

const literal = (word: string): string => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const NEVER = '(?!)';
const anyOf = (words: readonly string[]): string => (words.length === 0 ? NEVER : `(?:${words.map(literal).join('|')})`);
const WORD_CHAR = '[\\p{L}\\p{N}\\p{M}_]';
const isWordChar = (c: string | undefined): boolean => c !== undefined && /^[\p{L}\p{N}\p{M}_]$/u.test(c);
const NOT_AFTER_WORD = `(?<!${WORD_CHAR})`;
const NOT_BEFORE_WORD = `(?!${WORD_CHAR})`;

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

/** The patterns of the lists in force: the defaults, with the host's checked lists over them (each given list replaces its default). */
export function printVocab(o: CheckedReader): PrintVocab {
  const w = merged(o);
  const role = (r: StatusRole): { readonly role: StatusRole; readonly re: RegExp } => ({ role: r, re: new RegExp(`^(${whole(w.status[r], false, true)})`, 'iu') });
  const idHead = w.ids === false ? null : w.ids.prefixes === null ? '[A-Z]{1,4}' : anyOf(w.ids.prefixes);
  const idBody = idHead === null ? NEVER : `${idHead}-?\\d+(?:[.-]\\d+)*[a-z]?`;
  const ruleHead = w.ruleIds.prefixes === null ? '[A-Z]{2,}' : anyOf(w.ruleIds.prefixes);
  return {
    status: [role('ok'), role('wait'), role('no'), role('info')],
    statusHeader: new RegExp(whole(w.statusHeaders, true, true), 'iu'),
    rulingHeader: new RegExp(w.rulingHeaders.length === 0 ? '\\?$' : `${anyOf(w.rulingHeaders)}|\\?$`, 'i'),
    id: new RegExp(`^(${idBody})(?=$|[\\s,.:;)])`),
    ruleId: new RegExp(`^${ruleHead}(?:-[A-Z0-9]+)+$`),
    ruleIdJoin: new RegExp(`^\\s*(?:,|${anyOf(w.ruleIdJoins)}|,\\s*${anyOf(w.ruleIdJoins)})\\s*$`),
    addressee: new RegExp(whole(w.addressees, true, true), 'iu'),
    addresseeAnywhere: new RegExp(anyOf(w.addressees), 'i'),
    plan: {
      task: new RegExp(`^(${anyOf(w.plan.task)})\\s+([\\w.-]*\\w)\\s*[:.—–]\\s*`),
      step: new RegExp(`^(${anyOf(w.plan.step)}\\s+[\\w.-]+)\\s*(?:\\(([^)]{1,24})\\))?\\s*:\\s*`),
      who: new RegExp(`^${anyOf(w.plan.who)}:\\s*([^.]+)\\.`),
    },
    decisionTable: new RegExp(anyOf(w.decisionTableHeaders), 'i'),
    box: { short: new RegExp(`^${anyOf(w.boxes.short)}$`, 'i'), stand: new RegExp(`^${anyOf(w.boxes.stand)}$`, 'i') },
    callout: {
      agreed: new RegExp(`^${anyOf(w.callouts.agreed)}`, 'i'),
      waiting: new RegExp(`^${anyOf(w.callouts.waiting)}`, 'i'),
      later: new RegExp(`^${anyOf(w.callouts.later)}`, 'i'),
    },
    kindKey: new RegExp(`^${anyOf(w.kindKeys)}$`, 'i'),
  };
}
