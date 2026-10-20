// @vitest-environment jsdom
// The vocabulary and namespace options of `./enhance` (docserver L2, Task 8; LD9; C44 (d); C48), the scrub task of
// §3.7: every option list of vocab.ts becomes the `vocabulary` option, each list given replacing its neutral default;
// the storage keys take the `namespace` option as their prefix; the words editorial.ts held move into vocab.ts as the
// format contract; and the item link (the reference layout, section 2), by its two routes, only with `itemLink`.
// The fixtures are real render() output of neutral synthetic Markdown.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { destroyEnhancement, enhance, EnhanceError, setEnhancementPrefs, type EnhanceOptions, type ReaderStorage } from '../src/enhance/index.js';
import { ITEM_LINKS } from '../src/enhance/editorial.js';
import { contextOf } from '../src/enhance/lifecycle.js';
import { DEFAULT_NAMESPACE, LIMITS, normalizeOptions, OPTION_KEYS } from '../src/enhance/options.js';
import { createReaderState, docKey, posKeyOf, prefsKey, PREFS_KEY, uiKey, UI_KEY } from '../src/enhance/state.js';
import { statusOf } from '../src/enhance/status.js';
import type { FeatureContext, VocabularyOptions } from '../src/enhance/types.js';
import { compileVocab, createVocab, defaultVocabulary, type VocabularyWords } from '../src/enhance/vocab.js';
import { render } from '../src/render/index.js';

// createVocab passes through to the real one unless a test sets `hooks.words`: the format contract is no option, so a
// test that changes it (to show editorial.ts reads it from the vocabulary, not from a list of its own) compiles its own.
const hooks = vi.hoisted(() => ({ words: null as unknown }));

vi.mock('../src/enhance/vocab.js', async (importOriginal) => {
  const real = await importOriginal<typeof import('../src/enhance/vocab.js')>();
  return {
    ...real,
    createVocab: (options: Parameters<typeof real.createVocab>[0]) =>
      hooks.words === null ? real.createVocab(options) : real.compileVocab(hooks.words as VocabularyWords),
  };
});

const ROOT = path.join(import.meta.dirname, '..');
const ENHANCE_DIR = path.join(ROOT, 'src', 'enhance');

const mounted: HTMLElement[] = [];

function mount(md: string): HTMLElement {
  const parsed = new DOMParser().parseFromString(`<!doctype html><body>${render(md).html}`, 'text/html');
  const root = document.createElement('main');
  root.append(...Array.from(parsed.body.childNodes));
  document.body.append(root);
  mounted.push(root);
  return root;
}

afterEach(async () => {
  hooks.words = null;
  for (const root of mounted.splice(0)) await destroyEnhancement(root).catch(() => undefined);
  document.body.replaceChildren();
});

/** How normalizeOptions answered: 'accepted', or the refusal's code and message. */
function verdict(options: unknown): string {
  try {
    normalizeOptions(options);
    return 'accepted';
  } catch (e) {
    return e instanceof EnhanceError ? `${e.code}: ${e.message}` : `other: ${String(e)}`;
  }
}

/** How a promise settled: 'resolved', an EnhanceError's code, or the other error's text. */
async function outcome(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return 'resolved';
  } catch (e) {
    return e instanceof EnhanceError ? e.code : `other: ${String(e)}`;
  }
}

function ctxOf(root: HTMLElement): FeatureContext {
  const ctx = contextOf(root);
  if (ctx === undefined) throw new Error('no context: the root is not enhanced');
  return ctx;
}

const text = (n: Node | null | undefined): string => (n?.textContent ?? '').replace(/\s+/g, ' ').trim();

/** Every node under `root`, in document order, with its text when it is a text node. */
function nodes(root: Node): { node: Node; data: string | null }[] {
  const out: { node: Node; data: string | null }[] = [];
  const walk = (n: Node): void => {
    out.push({ node: n, data: n.nodeType === 3 ? (n as Text).data : null });
    for (const c of Array.from(n.childNodes)) walk(c);
  };
  walk(root);
  return out;
}

/** A storage whose snapshot records every key read, and whose set() records every call. */
function recordingStorage(values: Record<string, string> = {}): { storage: ReaderStorage; reads: string[]; calls: [string, string | null][] } {
  const reads: string[] = [];
  const calls: [string, string | null][] = [];
  const snapshot = new Proxy(values, {
    get(t, key) {
      reads.push(String(key));
      return t[String(key)];
    },
  });
  return { storage: { snapshot, set: (k, v) => void calls.push([k, v]) }, reads, calls };
}

// ── the vocabulary option ────────────────────────────────────────────────────────────────────────────────────────

/** Every option field, each with a value of its own. */
function everyField(): VocabularyOptions {
  return {
    status: { ok: ['settled'], wait: ['queued'], no: ['declined'], info: ['noted'] },
    statusHeaders: ['stage'],
    rulingHeaders: ['call'],
    attention: { status: ['phase'], who: ['lead'], question: ['ask'], openAnswers: ['unsure'], blocking: ['stopper'], risk: ['hazard'], openStatus: ['unsettled'] },
    ids: { prefixes: ['REQ'] },
    ruleIds: { prefixes: ['RL'] },
    qualifiers: ['annex'],
    plan: { task: ['Stage'], step: ['Move'], who: ['Owner'] },
    addressees: ['reader'],
    itemFields: ['Tracker'],
    itemHeadings: ['change delta'],
  };
}

describe('vocabulary: every option list of vocab.ts is an option, each list given replacing its default (LD9)', () => {
  it('left out, or empty, the vocabulary is the defaults', async () => {
    for (const o of [undefined, {}, { vocabulary: {} }]) {
      const n = normalizeOptions(o);
      expect(n.vocabulary).toEqual({});
      expect(Object.isFrozen(n.vocabulary)).toBe(true);
    }
    const root = mount('# Example spec\n\nText.\n');
    await enhance(root, { vocabulary: {} });
    expect(ctxOf(root).vocab.words).toEqual(defaultVocabulary());
  });

  it('each field given replaces its default whole; every other list keeps its own', async () => {
    const root = mount('# Example spec\n\nText.\n');
    const vocabulary = everyField();
    await enhance(root, { vocabulary });
    const want: VocabularyWords = {
      ...defaultVocabulary(),
      status: { ok: ['settled'], wait: ['queued'], no: ['declined'], info: ['noted'] },
      statusHeaders: ['stage'],
      rulingHeaders: ['call'],
      attention: { status: ['phase'], who: ['lead'], question: ['ask'], openAnswers: ['unsure'], blocking: ['stopper'], risk: ['hazard'], openStatus: ['unsettled'] },
      ids: { prefixes: ['REQ'] },
      ruleIds: { prefixes: ['RL'] },
      qualifiers: ['annex'],
      plan: { task: ['Stage'], step: ['Move'], who: ['Owner'] },
      addressees: ['reader'],
      itemFields: ['Tracker'],
      itemHeadings: ['change delta'],
    };
    expect(ctxOf(root).vocab.words).toEqual(want);
  });

  it('a group given in part keeps the default of each list it leaves out', async () => {
    const root = mount('# Example spec\n\nText.\n');
    await enhance(root, { vocabulary: { status: { ok: ['settled'] }, attention: { risk: ['hazard'] }, plan: { who: ['Owner'] } } });
    const d = defaultVocabulary();
    const w = ctxOf(root).vocab.words;
    expect(w.status).toEqual({ ...d.status, ok: ['settled'] });
    expect(w.attention).toEqual({ ...d.attention, risk: ['hazard'] });
    expect(w.plan).toEqual({ ...d.plan, who: ['Owner'] });
  });

  it('ids: false is no IDs at all; an empty object is the default grammar; prefixes replace the capitals', async () => {
    const at = async (vocabulary: VocabularyOptions): Promise<(string | null)[]> => {
      const root = mount('# Example spec\n\nText.\n');
      await enhance(root, { vocabulary });
      const v = ctxOf(root).vocab;
      return ['R14', 'REQ-2 x', 'AB-1'].map((s) => v.id.exec(s)?.[1] ?? null);
    };
    expect(await at({ ids: false })).toEqual([null, null, null]);
    expect(await at({ ids: {} })).toEqual(['R14', 'REQ-2', 'AB-1']);
    expect(await at({ ids: { prefixes: ['REQ'] } })).toEqual([null, 'REQ-2', null]);
    expect(normalizeOptions({ vocabulary: { ids: false } }).vocabulary).toEqual({ ids: false });
    expect(normalizeOptions({ vocabulary: { ruleIds: {} } }).vocabulary).toEqual({ ruleIds: {} });
  });

  it('the rulings of C48: rulingHeaders and attention.openStatus are options; decisionHeaders is the format contract', () => {
    expect(verdict({ vocabulary: { rulingHeaders: ['call'] } })).toBe('accepted');
    expect(verdict({ vocabulary: { attention: { openStatus: ['unsettled'] } } })).toBe('accepted');
    expect(verdict({ vocabulary: { decisionHeaders: ['decision'] } })).toBe('invalid-options: docreader: vocabulary has unknown keys: decisionHeaders');
  });

  it('a list is copied, its duplicates dropped, and frozen with every group around it', () => {
    const given = ['a', 'b', 'a'];
    const n = normalizeOptions({ vocabulary: { qualifiers: given, status: { ok: ['x'] }, attention: { who: ['y'] }, plan: { task: ['T'] }, ids: { prefixes: ['P'] }, ruleIds: { prefixes: ['Q'] } } });
    const v = n.vocabulary;
    expect(v.qualifiers).toEqual(['a', 'b']);
    given.push('c');
    expect(v.qualifiers).toEqual(['a', 'b']);
    const ids = v.ids === false ? null : v.ids;
    const read = [v, v.qualifiers, v.status, v.status?.ok, v.attention, v.attention?.who, v.plan, v.plan?.task, ids, ids?.prefixes, v.ruleIds, v.ruleIds?.prefixes];
    expect(read.map((x) => [typeof x, Object.isFrozen(x)])).toEqual(read.map(() => ['object', true]));
  });

  it('every list is bounded: 200 words of 64 code units, the bounds inclusive', () => {
    expect([LIMITS.words, LIMITS.word]).toEqual([200, 64]);
    const full = Array.from({ length: LIMITS.words }, (_, i) => `${'w'.repeat(LIMITS.word - 4)}${String(i).padStart(4, '0')}`);
    expect(full.every((w) => w.length === LIMITS.word)).toBe(true);
    expect(normalizeOptions({ vocabulary: { qualifiers: full } }).vocabulary.qualifiers).toEqual(full);
    expect(verdict({ vocabulary: { qualifiers: [...full, 'one more'] } })).toBe('invalid-options: docreader: vocabulary.qualifiers holds at most 200 words');
    expect(verdict({ vocabulary: { status: { ok: ['w'.repeat(LIMITS.word + 1)] } } })).toBe(
      'invalid-options: docreader: vocabulary.status.ok[0] must be a word of 1 to 64 code units, with no white space at either end',
    );
  });

  it('a list over its bound is refused before any of its items is read', () => {
    const list: unknown[] = Array.from({ length: LIMITS.words + 1 }, () => 'w');
    const getter = vi.fn(() => 'w');
    Object.defineProperty(list, 0, { get: getter, enumerable: true });
    expect(verdict({ vocabulary: { addressees: list } })).toBe('invalid-options: docreader: vocabulary.addressees holds at most 200 words');
    expect(getter).not.toHaveBeenCalled();
  });

  const refused: [string, unknown, RegExp][] = [
    ['vocabulary an array', { vocabulary: [] }, /^invalid-options: docreader: vocabulary must be an object$/],
    ['vocabulary null', { vocabulary: null }, /^invalid-options: docreader: vocabulary must be an object$/],
    ['vocabulary a string', { vocabulary: 'words' }, /^invalid-options: docreader: vocabulary must be an object$/],
    ['an unknown key', { vocabulary: { statusWords: [] } }, /vocabulary has unknown keys: statusWords$/],
    ['a format-contract list', { vocabulary: { techHeaders: ['file'] } }, /vocabulary has unknown keys: techHeaders$/],
    ['a glossary list', { vocabulary: { glossary: {} } }, /vocabulary has unknown keys: glossary$/],
    ['status not an object', { vocabulary: { status: ['ok'] } }, /vocabulary\.status must be an object$/],
    ['status null', { vocabulary: { status: null } }, /vocabulary\.status must be an object$/],
    ['an unknown status role', { vocabulary: { status: { done: [] } } }, /vocabulary\.status has unknown keys: done$/],
    ['attention not an object', { vocabulary: { attention: 'who' } }, /vocabulary\.attention must be an object$/],
    ['attention.open (named openAnswers)', { vocabulary: { attention: { open: [] } } }, /vocabulary\.attention has unknown keys: open$/],
    ['plan not an object', { vocabulary: { plan: 7 } }, /vocabulary\.plan must be an object$/],
    ['an unknown plan word', { vocabulary: { plan: { owner: [] } } }, /vocabulary\.plan has unknown keys: owner$/],
    ['ids true', { vocabulary: { ids: true } }, /vocabulary\.ids must be false or an object$/],
    ['ids null', { vocabulary: { ids: null } }, /vocabulary\.ids must be false or an object$/],
    ['ids a list', { vocabulary: { ids: ['R'] } }, /vocabulary\.ids must be false or an object$/],
    ['an unknown ids key', { vocabulary: { ids: { prefix: ['R'] } } }, /vocabulary\.ids has unknown keys: prefix$/],
    ['ruleIds false', { vocabulary: { ruleIds: false } }, /vocabulary\.ruleIds must be an object$/],
    ['an unknown ruleIds key', { vocabulary: { ruleIds: { shape: 'x' } } }, /vocabulary\.ruleIds has unknown keys: shape$/],
    ['a list a string', { vocabulary: { qualifiers: 'annex' } }, /vocabulary\.qualifiers must be an array of words$/],
    ['a list an array-like object', { vocabulary: { addressees: { length: 1, 0: 'you' } } }, /vocabulary\.addressees must be an array of words$/],
    ['ids.prefixes a string', { vocabulary: { ids: { prefixes: 'R' } } }, /vocabulary\.ids\.prefixes must be an array of words$/],
    ['ruleIds.prefixes a number', { vocabulary: { ruleIds: { prefixes: 3 } } }, /vocabulary\.ruleIds\.prefixes must be an array of words$/],
    ['a word a number', { vocabulary: { itemFields: [3] } }, /vocabulary\.itemFields\[0\] must be a word of 1 to 64 code units, with no white space at either end$/],
    ['an empty word', { vocabulary: { statusHeaders: ['status', ''] } }, /vocabulary\.statusHeaders\[1\] must be a word/],
    ['a word of white space', { vocabulary: { status: { wait: [' \t '] } } }, /vocabulary\.status\.wait\[0\] must be a word/],
    ['a word opening on a space', { vocabulary: { status: { ok: [' done'] } } }, /vocabulary\.status\.ok\[0\] must be a word of 1 to 64 code units, with no white space at either end$/],
    ['a word ending on a tab', { vocabulary: { statusHeaders: ['status\t'] } }, /vocabulary\.statusHeaders\[0\] must be a word/],
    ['a word opening on a no-break space', { vocabulary: { addressees: ['\u00a0you'] } }, /vocabulary\.addressees\[0\] must be a word/],
    ['a heading ending on an ideographic space', { vocabulary: { itemHeadings: ['change delta\u3000'] } }, /vocabulary\.itemHeadings\[0\] must be a word/],
    ['a prefix ending on a line break', { vocabulary: { ids: { prefixes: ['REQ\n'] } } }, /vocabulary\.ids\.prefixes\[0\] must be a word/],
    ['a hole', { vocabulary: { itemHeadings: [, 'delta'] } }, /vocabulary\.itemHeadings\[0\] must be a word/],
    ['a word null', { vocabulary: { attention: { risk: [null] } } }, /vocabulary\.attention\.risk\[0\] must be a word/],
    ['a plan word over 64', { vocabulary: { plan: { task: ['T'.repeat(65)] } } }, /vocabulary\.plan\.task\[0\] must be a word/],
    ['a rule prefix over 64', { vocabulary: { ruleIds: { prefixes: ['R'.repeat(65)] } } }, /vocabulary\.ruleIds\.prefixes\[0\] must be a word/],
  ];
  for (const [name, options, message] of refused) {
    it(`refused: ${name}`, async () => {
      expect(verdict(options)).toMatch(message);
      const root = mount('# Example spec\n\nText.\n');
      const before = root.innerHTML;
      expect(await outcome(enhance(root, options as EnhanceOptions))).toBe('invalid-options');
      expect(root.innerHTML).toBe(before);
    });
  }

  it('a getter is refused unread, on the vocabulary, a group, a list and a word', () => {
    const getter = vi.fn(() => ['w']);
    const wordGetter = vi.fn(() => 'w');
    const onTop = Object.defineProperty({}, 'qualifiers', { get: getter, enumerable: true });
    const onGroup = { status: Object.defineProperty({}, 'ok', { get: getter, enumerable: true }) };
    const onIds = { ids: Object.defineProperty({}, 'prefixes', { get: getter, enumerable: true }) };
    const onWord = { addressees: Object.defineProperty(['a', 'b'], 1, { get: wordGetter, enumerable: true }) };
    const options = Object.defineProperty({}, 'vocabulary', { get: getter, enumerable: true });
    expect(verdict({ vocabulary: onTop })).toMatch(/vocabulary\.qualifiers must be a plain value, not a getter$/);
    expect(verdict({ vocabulary: onGroup })).toMatch(/vocabulary\.status\.ok must be a plain value, not a getter$/);
    expect(verdict({ vocabulary: onIds })).toMatch(/vocabulary\.ids\.prefixes must be a plain value, not a getter$/);
    expect(verdict({ vocabulary: onWord })).toMatch(/vocabulary\.addressees\[1\] must be a word/);
    expect(verdict(options)).toMatch(/options\.vocabulary must be a plain value, not a getter$/);
    expect(getter).not.toHaveBeenCalled();
    expect(wordGetter).not.toHaveBeenCalled();
  });

  it('inherited properties are not read: not the vocabulary\'s, a group\'s or a list\'s', () => {
    const vocabulary = Object.create({ qualifiers: ['annex'], status: { ok: ['x'] } }) as object;
    expect(normalizeOptions({ vocabulary }).vocabulary).toEqual({});
    const status = Object.create({ ok: ['x'] }) as object;
    expect(normalizeOptions({ vocabulary: { status } }).vocabulary).toEqual({ status: {} });
    const ids = Object.create({ prefixes: ['R'] }) as object;
    expect(normalizeOptions({ vocabulary: { ids } }).vocabulary).toEqual({ ids: {} });
  });

  it('a field whose value is undefined is left out, at each level', async () => {
    const n = normalizeOptions({ vocabulary: { qualifiers: undefined, status: { ok: undefined }, ids: { prefixes: undefined } } });
    expect(n.vocabulary).toEqual({ status: {}, ids: {} });
    const root = mount('# Example spec\n\nText.\n');
    await enhance(root, { vocabulary: { qualifiers: undefined, status: { ok: undefined }, ids: { prefixes: undefined } } as unknown as VocabularyOptions });
    expect(ctxOf(root).vocab.words).toEqual(defaultVocabulary());
  });
});

// ── the vocabulary in the status marks ───────────────────────────────────────────────────────────────────────────

const STATUS_DOC = [
  '# Example spec',
  '',
  '## 1. Scope',
  '',
  '| ID | What | Status |',
  '|---|---|---|',
  '| R1 | thing | Agreed, with notes |',
  '| R2 | other | **Pending** |',
  '| R3 | more | Settled at last |',
  '| R4 | text | a.b now |',
  '| R5 | text | axb now |',
  '| R6 | text | Rejected outright |',
  '',
  '| ID | Stage |',
  '|---|---|',
  '| R1 | Pending until the review is done |',
  '| R2 | Settled before the first draft was read |',
  '',
  '| ID | Call |',
  '|---|---|',
  '| R1 | Agreed by everyone in the room |',
  '| R2 | Nothing has been said about it yet |',
  '',
  '| ID | Ruling |',
  '|---|---|',
  '| R1 | Rejected by everyone in the room |',
  '| R2 | Nothing has been said about it yet |',
  '',
].join('\n');

/** Each status mark, as its text and role, in document order. */
function pills(root: Element): string[] {
  return Array.from(root.querySelectorAll('span.pill')).map((p) => `${text(p)}:${Array.from(p.classList).filter((c) => c !== 'pill').join('.')}`);
}

describe('vocabulary: the status marks read it', () => {
  it('the defaults reproduce the prototype\'s marks, given or left out', async () => {
    // A mark takes the cell's opening phrase, up to three words ("Rejected outright"), as the prototype's did.
    const want = ['Agreed:ok', 'Pending:wait', 'Rejected outright:no', 'Rejected:no'];
    const a = mount(STATUS_DOC);
    await enhance(a);
    expect(pills(a)).toEqual(want);
    const d = defaultVocabulary();
    const b = mount(STATUS_DOC);
    await enhance(b, { vocabulary: { status: d.status, statusHeaders: d.statusHeaders, rulingHeaders: d.rulingHeaders } });
    expect(pills(b)).toEqual(want);
  });

  it('a custom status list changes the marks: it replaces its role\'s words, the other roles keep theirs', async () => {
    const root = mount(STATUS_DOC);
    await enhance(root, { vocabulary: { status: { ok: ['settled', 'a.b'] } } });
    expect(pills(root)).toEqual(['Pending:wait', 'Settled at last:ok', 'a.b now:ok', 'Rejected outright:no', 'Rejected:no']);
  });

  it('a word is matched literally: a pattern character in it is only itself', async () => {
    const root = mount(STATUS_DOC);
    await enhance(root, { vocabulary: { status: { ok: ['a.b', 'a+'], wait: ['.*'] } } });
    expect(pills(root).filter((p) => p.startsWith('a') || p.startsWith('Settled'))).toEqual(['a.b now:ok']);
    expect(statusOf(ctxOf(root).vocab, 'axb now')).toBeNull();
    expect(statusOf(ctxOf(root).vocab, 'aaa')).toBeNull();
  });

  it('custom status-column headers, and ruling headers', async () => {
    const root = mount(STATUS_DOC);
    await enhance(root, { vocabulary: { statusHeaders: ['stage'], rulingHeaders: ['call'] } });
    // Status no longer names a status column, and only half its short cells open on a status word (60% would do);
    // Stage now names one; Call names a ruling, with half its cells on a status word; Ruling no longer does.
    expect(pills(root)).toEqual(['Pending:wait', 'Agreed:ok']);
  });

  it('empty lists mark nothing', async () => {
    const root = mount(STATUS_DOC);
    await enhance(root, { vocabulary: { status: { ok: [], wait: [], no: [], info: [] } } });
    expect(pills(root)).toEqual([]);
  });

  it('an empty rulingHeaders names no ruling word, and a header that ends in "?" still asks a question', () => {
    const v = compileVocab({ ...defaultVocabulary(), rulingHeaders: [] });
    expect(['Ruling', 'Agreed?', 'Answer'].map((h) => v.rulingHeader.test(h))).toEqual([false, true, false]);
  });
});

describe('vocabulary: a whole word, in any script (a letter, digit, mark or _ ends a word; any other edge is its own)', () => {
  const vocabOf = (v: VocabularyOptions): ReturnType<typeof createVocab> => createVocab(normalizeOptions({ vocabulary: v }));

  it('a status word opens a status in any script, or ending in punctuation or a symbol; a letter, digit or mark after a letter edge stops it', () => {
    const v = vocabOf({ status: { ok: ['готово', 'validé', '完了', '✓', 'c++', 'done!', 'erledigt'] } });
    const cases: [string, string | null][] = [
      ['готово сегодня', 'ok'],
      ['Готово', 'ok'],
      ['validé hier', 'ok'],
      ['VALIDÉ', 'ok'],
      ['完了 です', 'ok'],
      ['✓ shipped', 'ok'],
      ['✓shipped', 'ok'],
      ['c++ now', 'ok'],
      ['done! now', 'ok'],
      ['erledigt.', 'ok'],
      ['готовый', null],
      ['готово7', null],
      ['готово\u0301', null],
      ['validée', null],
      ['erledigte', null],
      ['done now', null],
    ];
    expect(cases.map(([s]) => [s, statusOf(v, s)?.role ?? null])).toEqual(cases);
  });

  it('the default words keep their whole-word rule, now by every script: a letter after an ASCII word stops it too', () => {
    const v = createVocab(normalizeOptions({}));
    const cases: [string, string | null][] = [
      ['Done.', 'ok'],
      ['Done (late)', 'ok'],
      ['Doneé', null],
      ['Done_', null],
      ['Donez', null],
      ['To do next', 'wait'],
    ];
    expect(cases.map(([s]) => [s, statusOf(v, s)?.role ?? null])).toEqual(cases);
  });

  it('status-column headers: whole, in any script and any case; one ending in "?" needs no boundary after', () => {
    const v = vocabOf({ statusHeaders: ['статус', 'status?'] });
    const cases: [string, boolean][] = [
      ['Статус', true],
      ['Текущий статус', true],
      ['статусы', false],
      ['подстатус', false],
      ['Status? (now)', true],
      ['Status?x', true],
      ['xstatus?', false],
      ['Status', false],
    ];
    expect(cases.map(([h]) => [h, v.statusHeader.test(h)])).toEqual(cases);
  });

  it('addressees, qualifiers and the attention words: whole, in any script', () => {
    const v = vocabOf({
      addressees: ['вы', '@me'],
      qualifiers: ['приложения'],
      attention: { who: ['кто'], openAnswers: ['открыто'], blocking: ['блок!', 'стоп'] },
    });
    const cases: [string, RegExp, string, boolean][] = [
      ['addressee', v.addressee, 'Кто: вы', true],
      ['addressee', v.addressee, 'вывод', false],
      ['addressee', v.addressee, 'Owner: @me', true],
      ['addressee', v.addressee, 'Owner: @mex', false],
      ['addressee', v.addressee, 'ask x@me', true],
      ['qualifier', v.qualifier, 'см. приложения ', true],
      ['qualifier', v.qualifier, 'см. xприложения ', false],
      ['who', v.attention.who, 'Кто делает', true],
      ['who', v.attention.who, 'Ктото', false],
      ['openAnswers', v.attention.openAnswers, 'Открыто пока', true],
      ['openAnswers', v.attention.openAnswers, 'открытость', false],
      ['blocking', v.attention.blocking, '  блок! да', true],
      ['blocking', v.attention.blocking, 'блок!и', true],
      ['blocking', v.attention.blocking, ' стоп.', true],
      ['blocking', v.attention.blocking, 'стопка', false],
    ];
    expect(cases.map(([name, re, s]) => [name, re, s, re.test(s)])).toEqual(cases);
  });

  it('an ID is whole in any script: a prefix of another script, and the default grammar with a letter on either side', () => {
    const scan = (v: ReturnType<typeof createVocab>, s: string): string[] => Array.from(s.matchAll(v.idScan()), (m) => m[1] ?? '');
    expect(scan(vocabOf({ ids: { prefixes: ['Р'] } }), 'see Р12, xР13, Р14б and Р15.')).toEqual(['Р12', 'Р15']);
    expect(scan(createVocab(normalizeOptions({})), 'R1, éR2, R3é and R4')).toEqual(['R1', 'R4']);
  });
});

// ── the namespace option ─────────────────────────────────────────────────────────────────────────────────────────

describe('namespace: every storage key carries it', () => {
  it('the default is docreader, and the four keys are its', () => {
    expect([DEFAULT_NAMESPACE, normalizeOptions({}).namespace, normalizeOptions({ namespace: 'notes' }).namespace]).toEqual(['docreader', 'docreader', 'notes']);
    expect([PREFS_KEY, UI_KEY, posKeyOf('p'), docKey('k', 'folds')]).toEqual(['docreader:prefs', 'docreader:ui', 'docreader:pos:p', 'docreader:doc:k:folds']);
    expect([prefsKey('notes'), uiKey('notes'), posKeyOf('p', 'notes'), docKey('k', 'folds', 'notes')]).toEqual(['notes:prefs', 'notes:ui', 'notes:pos:p', 'notes:doc:k:folds']);
  });

  it('the state reads and writes each key under the namespace, and none under another', () => {
    const { storage, reads, calls } = recordingStorage({
      'notes:prefs': '{"theme":"dark"}',
      'docreader:prefs': '{"width":"wide"}',
      'notes:doc:k:folds': '["2-design"]',
      'notes:pos:p': '{"y":5}',
      'notes:ui': '{"tab":"index"}',
    });
    const state = createReaderState({ options: { storage, storageKey: 'k', prefs: {}, namespace: 'notes' }, operate: (fn) => fn(), live: () => true });
    expect([state.prefs.theme, state.prefs.width]).toEqual(['dark', 'standard']);
    expect([state.readDoc('folds'), state.readPos('p'), state.readUi('tab')]).toEqual([['2-design'], { y: 5 }, 'index']);
    state.setPrefs({ font: 'sans' });
    state.writeDoc('folds', ['1-scope']);
    state.writePos('p', { y: 9 });
    state.writeUi('tab', 'contents');
    expect(reads).toEqual(['notes:prefs', 'notes:doc:k:folds', 'notes:pos:p', 'notes:ui']);
    expect(calls).toEqual([
      ['notes:prefs', '{"theme":"dark","font":"sans"}'],
      ['notes:doc:k:folds', '["1-scope"]'],
      ['notes:pos:p', '{"y":9}'],
      ['notes:ui', '{"tab":"contents"}'],
    ]);
  });

  it('through enhance(): the prefs and the folds come from the namespace\'s keys, and every key read or written carries it', async () => {
    const md = '# Example spec\n\n## 1. Scope\n\nScope.\n\n## 2. Design\n\nDesign.\n\n## 3. Plan\n\nPlan.\n';
    const { storage, reads, calls } = recordingStorage({
      'notes:prefs': '{"theme":"light"}',
      'docreader:prefs': '{"theme":"dark"}',
      'notes:doc:k:folds': '["2-design"]',
      'docreader:doc:k:folds': '["1-scope"]',
    });
    const root = mount(md);
    await enhance(root, { storage, storageKey: 'k', posKey: 'p', namespace: 'notes' });
    expect(root.getAttribute('data-theme')).toBe('light');
    const folded = Array.from(root.querySelectorAll('h2.folded')).map((h) => h.id);
    expect(folded).toEqual(['2-design']);
    setEnhancementPrefs(root, { width: 'wide' });
    const ctx = ctxOf(root);
    ctx.folds.setFold(ctx.folds.headings()[0] as HTMLElement, true);
    ctx.state.writePos('p', { y: 1 });
    expect(reads.length).toBeGreaterThan(0);
    expect(reads.filter((k) => !k.startsWith('notes:'))).toEqual([]);
    expect(calls.map(([k]) => k)).toEqual(['notes:prefs', 'notes:doc:k:folds', 'notes:pos:p']);
  });

  it('two roots on one storage object under two namespaces keep two queues and never merge their prefs', async () => {
    const calls: [string, string | null][] = [];
    const pending: (() => void)[] = [];
    const storage: ReaderStorage = {
      snapshot: {},
      set: (k, v) => {
        calls.push([k, v]);
        return new Promise<void>((resolve) => pending.push(resolve));
      },
    };
    const a = mount('# A\n\nText.\n');
    const b = mount('# B\n\nText.\n');
    await enhance(a, { storage, namespace: 'reader-a' });
    await enhance(b, { storage, namespace: 'reader-b' });
    setEnhancementPrefs(a, { theme: 'dark' });
    setEnhancementPrefs(b, { width: 'wide' });
    expect(calls).toEqual([
      ['reader-a:prefs', '{"theme":"dark"}'],
      ['reader-b:prefs', '{"width":"wide"}'],
    ]);
    for (const resolve of pending) resolve();
  });

  const bad: [string, unknown][] = [
    ['empty', ''],
    ['a capital', 'Notes'],
    ['a digit first', '1notes'],
    ['a dash first', '-notes'],
    ['an underscore', 'my_notes'],
    ['a colon', 'a:b'],
    ['a space', 'my notes'],
    ['a dot', 'a.b'],
    ['33 characters', `a${'b'.repeat(32)}`],
    ['a trailing new line', 'notes\n'],
    ['a number', 7],
    ['null', null],
    ['an object', { toString: () => 'notes' }],
  ];
  for (const [name, namespace] of bad) {
    it(`a namespace refused: ${name}`, () => {
      expect(verdict({ namespace })).toBe('invalid-options: docreader: namespace must be a lower-case letter, then up to 31 lower-case letters, digits or dashes');
    });
  }

  it('a namespace of 32 characters, with digits and dashes, is accepted (the bound inclusive)', () => {
    const at = `a${'-1b'.repeat(10)}c`;
    expect(at.length).toBe(32);
    for (const ns of [at, 'a', 'x-', 'reader-2']) expect(normalizeOptions({ namespace: ns }).namespace).toBe(ns);
  });
});

// ── the item link (the reference layout, section 2) ──────────────────────────────────────────────────────────────

const ITEM_DOC = [
  '# Example spec',
  '',
  '**Spec** · 2026-10-19 · **Tracker:** AB-12 · Status: Draft',
  '',
  '## 1. Scope',
  '',
  'Scope text.',
  '',
  '## 2. Design',
  '',
  'Design text.',
  '',
  '## 3. Change delta',
  '',
  '```text',
  '   ',
  'item: CD-7',
  'more lines',
  '```',
  '',
  '```text',
  'item: EF-9',
  '```',
  '',
].join('\n');

const LINK = (k: string): string => `https://items.example/${k}`;

/** The byline's facts, as [label, text, link hrefs]. */
function facts(root: Element): [string, string, string[]][] {
  const byline = root.querySelector('dl.byline');
  return Array.from(byline?.children ?? []).map((d) => [
    d.querySelector('dt')?.textContent ?? '',
    text(d.querySelector('dd')),
    Array.from(d.querySelectorAll('a.item-link')).map((a) => a.getAttribute('href') ?? ''),
  ]);
}

describe('the item link: off unless itemLink is given and a route is', () => {
  it('without itemLink nothing is linked, whatever the vocabulary names', async () => {
    const root = mount(ITEM_DOC);
    await enhance(root, { vocabulary: { itemFields: ['Tracker'], itemHeadings: ['change delta'] } });
    expect(root.querySelector('a.item-link')).toBeNull();
    expect(facts(root)).toEqual([
      ['Date', '2026-10-19', []],
      ['Tracker', 'AB-12', []],
      ['Status', 'Draft', []],
    ]);
  });

  it('without itemLink the byline carries no click listener of the item link', async () => {
    const spy = vi.spyOn(EventTarget.prototype, 'addEventListener');
    try {
      const root = mount(ITEM_DOC);
      await enhance(root, { onLink: () => undefined, vocabulary: { itemFields: ['Tracker'], itemHeadings: ['change delta'] } });
      const byline = root.querySelector('dl.byline');
      expect(byline).not.toBeNull();
      expect(spy.mock.contexts.filter((t) => t === byline).length).toBe(0);
    } finally {
      spy.mockRestore();
    }
  });

  it('with itemLink but no route (the defaults name none), itemLink is never called', async () => {
    const itemLink = vi.fn(LINK);
    const root = mount(ITEM_DOC);
    await enhance(root, { itemLink });
    expect(itemLink).not.toHaveBeenCalled();
    expect(root.querySelector('a.item-link')).toBeNull();
  });
});

describe('the item link, by the byline route: a fact whose label is in itemFields', () => {
  it('the key\'s own text moves into a link: href from itemLink, opened in a new tab, an arrow after it', async () => {
    const root = mount(ITEM_DOC);
    const metaP = root.querySelector('h1')?.nextElementSibling as HTMLElement;
    const keyText = Array.from(metaP.childNodes).find((n) => n.nodeType === 3 && (n as Text).data.includes('AB-12')) as Text;
    const itemLink = vi.fn(LINK);
    await enhance(root, { itemLink, vocabulary: { itemFields: ['tracker'] } });
    expect(itemLink.mock.calls).toEqual([['AB-12']]);
    expect(facts(root)).toEqual([
      ['Date', '2026-10-19', []],
      ['Tracker', 'AB-12 ↗', [LINK('AB-12')]],
      ['Status', 'Draft', []],
    ]);
    const a = root.querySelector('a.item-link') as HTMLAnchorElement;
    expect([a.getAttribute('target'), a.getAttribute('rel'), a.getAttribute('aria-label'), a.hasAttribute('data-docreader-chrome')]).toEqual([
      '_blank',
      'noopener noreferrer',
      'AB-12 (opens in a new tab)',
      true,
    ]);
    // The key is the document's own text, split off its text node (never re-typed): the node left behind keeps the
    // space before it. The arrow is chrome, hidden from speech.
    expect([a.firstChild?.nodeType, (a.firstChild as Text).data, keyText.data, keyText.nextSibling]).toEqual([3, 'AB-12', ' ', a]);
    const arrow = a.lastElementChild as HTMLElement;
    expect([arrow.textContent, arrow.getAttribute('aria-hidden'), arrow.hasAttribute('data-docreader-chrome')]).toEqual([' ↗', 'true', true]);
  });

  it('every key in the fact: in its text, in its own code; never an author\'s link, a lower-case or a run-on key', async () => {
    const md = '# Example spec\n\n**Spec** · **Tracker:** AB-1, AB-2 and `AB-3`; [AB-4](https://example.org/a), ab-5, xAB-6, AB-7x, `AB-x`, *AB-8* · Status: Draft\n';
    const root = mount(md);
    const itemLink = vi.fn(LINK);
    await enhance(root, { itemLink, vocabulary: { itemFields: ['Tracker'] } });
    expect(itemLink.mock.calls).toEqual([['AB-1'], ['AB-2'], ['AB-3'], ['AB-8']]);
    const links = Array.from(root.querySelectorAll('a.item-link'));
    expect(links.map((a) => [text(a), a.getAttribute('href')])).toEqual([
      ['AB-1 ↗', LINK('AB-1')],
      ['AB-2 ↗', LINK('AB-2')],
      ['AB-3 ↗', LINK('AB-3')],
      ['AB-8 ↗', LINK('AB-8')],
    ]);
    expect(links[2]?.firstElementChild?.localName).toBe('code'); // the author's code, wrapped
    const author = Array.from(root.querySelectorAll('a')).find((a) => a.textContent === 'AB-4');
    expect([author?.getAttribute('href'), author?.classList.contains('item-link'), author?.hasAttribute('target')]).toEqual(['https://example.org/a', false, false]);
  });

  it('a key named twice is asked for once and linked twice', async () => {
    const root = mount('# Example spec\n\n**Spec** · **Tracker:** AB-1 then AB-1 · Status: Draft\n');
    const itemLink = vi.fn(LINK);
    await enhance(root, { itemLink, vocabulary: { itemFields: ['Tracker'] } });
    expect(itemLink.mock.calls).toEqual([['AB-1']]);
    expect(root.querySelectorAll('a.item-link').length).toBe(2);
  });

  it('at most 16 keys are asked for and linked; the rest stay text', async () => {
    const keys = Array.from({ length: ITEM_LINKS.keys + 4 }, (_, i) => `AB-${String(i + 1)}`);
    const root = mount(`# Example spec\n\n**Spec** · **Tracker:** ${keys.join(' ')} · Status: Draft\n`);
    const itemLink = vi.fn(LINK);
    await enhance(root, { itemLink, vocabulary: { itemFields: ['Tracker'] } });
    expect(ITEM_LINKS.keys).toBe(16);
    expect(itemLink.mock.calls).toEqual(keys.slice(0, ITEM_LINKS.keys).map((k) => [k]));
    expect(Array.from(root.querySelectorAll('a.item-link')).map((a) => a.firstChild?.textContent)).toEqual(keys.slice(0, ITEM_LINKS.keys));
  });

  it('at most 64 links are written: one key repeated past them stays text, and the host is asked once', async () => {
    const root = mount(`# Example spec\n\n**Spec** · **Tracker:** ${'AB-1 '.repeat(ITEM_LINKS.links + 6)}· Status: Draft\n`);
    const itemLink = vi.fn(LINK);
    await enhance(root, { itemLink, vocabulary: { itemFields: ['Tracker'] } });
    expect(ITEM_LINKS.links).toBe(64);
    expect(itemLink.mock.calls).toEqual([['AB-1']]);
    expect(root.querySelectorAll('a.item-link').length).toBe(ITEM_LINKS.links);
    expect(facts(root)[0]?.[1].split('AB-1').length).toBe(ITEM_LINKS.links + 7);
  });

  it('one click listener for every item link of the byline, never one per link', async () => {
    const spy = vi.spyOn(EventTarget.prototype, 'addEventListener');
    try {
      const root = mount(`# Example spec\n\n**Spec** · **Tracker:** AB-1 AB-2 AB-1 \`AB-3\` · Status: Draft\n`);
      await enhance(root, { itemLink: LINK, onLink: () => undefined, vocabulary: { itemFields: ['Tracker'] } });
      const byline = root.querySelector('dl.byline');
      const on = (pick: (t: unknown) => boolean): number => spy.mock.calls.filter((c, i) => c[0] === 'click' && pick(spy.mock.contexts[i])).length;
      expect(root.querySelectorAll('a.item-link').length).toBe(4);
      expect([on((t) => t instanceof Element && t.matches('a.item-link, a.item-link *')), on((t) => t === byline)]).toEqual([0, 1]);
    } finally {
      spy.mockRestore();
    }
  });

  it('only the first fact with an item label is read, and a label is matched whole and literally', async () => {
    const md = '# Example spec\n\n**Spec** · **Trackers:** AB-1 · **Tracker:** AB-2 · **Tracker:** AB-3 · **Tr.cker:** AB-4\n';
    const itemLink = vi.fn(LINK);
    await enhance(mount(md), { itemLink, vocabulary: { itemFields: ['Tracker'] } });
    expect(itemLink.mock.calls).toEqual([['AB-2']]);
    const literal = vi.fn(LINK);
    await enhance(mount(md), { itemLink: literal, vocabulary: { itemFields: ['Tr.cker'] } });
    expect(literal.mock.calls).toEqual([['AB-4']]);
  });

  it('destroy restores the subtree exactly: the same nodes, with the same text, in the same order', async () => {
    const md = '# Example spec\n\n**Spec** · **Tracker:** AB-1, `AB-2` and AB-3 · Status: Draft\n\n## 1. Scope\n\nText.\n';
    const root = mount(md);
    const html = root.innerHTML;
    const before = nodes(root);
    await enhance(root, { itemLink: LINK, vocabulary: { itemFields: ['Tracker'] } });
    expect(root.querySelectorAll('a.item-link').length).toBe(3);
    await destroyEnhancement(root);
    expect(root.innerHTML).toBe(html);
    const after = nodes(root);
    expect(after.length).toBe(before.length);
    after.forEach((n, i) => {
      expect(n.node).toBe(before[i]?.node);
      expect(n.data).toBe(before[i]?.data);
    });
  });
});

describe('the item link, by the delta route: the first code block of a section headed by an itemHeadings word', () => {
  it('the delta\'s key replaces the item fact\'s value; the fact\'s own nodes stay in the hidden meta line', async () => {
    const itemLink = vi.fn(LINK);
    const root = mount(ITEM_DOC);
    const metaP = root.querySelector('h1')?.nextElementSibling as HTMLElement;
    await enhance(root, { itemLink, vocabulary: { itemFields: ['Tracker'], itemHeadings: ['change delta'] } });
    expect(itemLink.mock.calls).toEqual([['CD-7']]);
    expect(facts(root)).toEqual([
      ['Date', '2026-10-19', []],
      ['Tracker', 'CD-7 ↗', [LINK('CD-7')]],
      ['Status', 'Draft', []],
    ]);
    expect(text(metaP)).toContain('AB-12');
    expect(metaP.hidden).toBe(true);
  });

  it('without an item fact the delta\'s key is a fact of its own, labelled by the first item field, before the wide ones', async () => {
    const long = 'A note that runs on well past seventy characters, so that the byline sets it across the whole width.';
    const md = ITEM_DOC.replace('**Tracker:** AB-12 · Status: Draft', `Status: Draft · ${long}`);
    const root = mount(md);
    await enhance(root, { itemLink: LINK, vocabulary: { itemFields: ['Item'], itemHeadings: ['change delta'] } });
    expect(facts(root)).toEqual([
      ['Date', '2026-10-19', []],
      ['Status', 'Draft', []],
      ['Item', 'CD-7 ↗', [LINK('CD-7')]],
      ['', long, []],
    ]);
    const unlabelled = mount(md);
    await enhance(unlabelled, { itemLink: LINK, vocabulary: { itemHeadings: ['change delta'] } });
    expect(facts(unlabelled)[2]).toEqual(['', 'CD-7 ↗', [LINK('CD-7')]]);
  });

  it('only the section\'s first code block counts, its first line that is not blank, as `item: <key>`', async () => {
    expect(ITEM_DOC).toContain('```text\n   \nitem: CD-7'); // a line of spaces first: render() keeps it (an empty one it drops)
    const first = ITEM_DOC.replace('```text\n   \nitem: CD-7\nmore lines\n```', '```text\nnotes first\nitem: CD-7\n```');
    const itemLink = vi.fn(LINK);
    const root = mount(first);
    await enhance(root, { itemLink, vocabulary: { itemFields: ['Tracker'], itemHeadings: ['change delta'] } });
    // no delta key (the first block's first line is not an item line): the byline route links the fact instead
    expect(itemLink.mock.calls).toEqual([['AB-12']]);
  });

  it('a section whose first code block names no key passes to the next section with an item heading', async () => {
    const md = ITEM_DOC.replace('## 3. Change delta\n', '## 3. Change delta\n\n```text\nnotes\n```\n\n## 4. Change delta\n');
    const itemLink = vi.fn(LINK);
    const root = mount(md);
    await enhance(root, { itemLink, vocabulary: { itemFields: ['Tracker'], itemHeadings: ['change delta'] } });
    expect(itemLink.mock.calls).toEqual([['CD-7']]);
    expect(facts(root)[1]).toEqual(['Tracker', 'CD-7 ↗', [LINK('CD-7')]]);
  });

  it('an item line whose value is no key is no delta, and the byline route applies', async () => {
    for (const line of ['item: none', 'item: ab-1', 'item: AB-1 AB-2', 'Item: CD-7', 'items: CD-7', 'see item: CD-7']) {
      const itemLink = vi.fn(LINK);
      const root = mount(ITEM_DOC.replace('item: CD-7', line));
      await enhance(root, { itemLink, vocabulary: { itemFields: ['Tracker'], itemHeadings: ['change delta'] } });
      expect([line, itemLink.mock.calls]).toEqual([line, [['AB-12']]]);
    }
  });

  it('the heading: an optional section number, then the words whole, a space or a dash between them; literal', async () => {
    const cases: [string, string[], boolean][] = [
      ['3. Change delta', ['change delta'], true],
      ['Change-delta', ['change delta'], true],
      ['CHANGE DELTA', ['change delta'], true],
      ['3. Change delta notes', ['change delta'], false],
      ['Changes delta', ['change delta'], false],
      ['Change delta', ['change.delta'], false],
    ];
    for (const [heading, words, linked] of cases) {
      const itemLink = vi.fn(LINK);
      const root = mount(ITEM_DOC.replace('## 3. Change delta', `## ${heading}`));
      await enhance(root, { itemLink, vocabulary: { itemHeadings: words } });
      expect([heading, itemLink.mock.calls.length]).toEqual([heading, linked ? 1 : 0]);
    }
  });

  it('a level-3 heading of those words is not read', async () => {
    const itemLink = vi.fn(LINK);
    const root = mount(ITEM_DOC.replace('## 3. Change delta', '### 3. Change delta'));
    await enhance(root, { itemLink, vocabulary: { itemHeadings: ['change delta'] } });
    expect(itemLink).not.toHaveBeenCalled();
  });

  it('a heading that is not a child of the root, or a section past its next h2, is not read', async () => {
    const nested = mount(ITEM_DOC);
    const h = Array.from(nested.querySelectorAll('h2')).find((e) => e.id === '3-change-delta') as HTMLElement;
    const box = document.createElement('section');
    h.before(box);
    while (box.nextSibling !== null) box.append(box.nextSibling); // the heading and its code blocks, nested together
    const itemLink = vi.fn(LINK);
    await enhance(nested, { itemLink, vocabulary: { itemHeadings: ['change delta'] } });
    expect(itemLink).not.toHaveBeenCalled();
    const md = ITEM_DOC.replace('## 3. Change delta\n', '## 3. Change delta\n\nNo code here.\n\n## 4. After\n');
    const late = mount(md);
    await enhance(late, { itemLink, vocabulary: { itemHeadings: ['change delta'] } });
    expect(itemLink).not.toHaveBeenCalled();
  });
});

describe('the item link: the host\'s answer is checked', () => {
  const answers: [string, unknown, boolean][] = [
    ['an https link', 'https://items.example/AB-12', true],
    ['an http link, any case', 'HTTP://items.example/AB-12', true],
    ['a relative link', '/items/AB-12', true],
    ['a link of 2048 code units', `https://e.example/${'x'.repeat(2048 - 18)}`, true],
    ['null', null, false],
    ['undefined', undefined, false],
    ['a number', 12, false],
    ['an object', { href: 'https://items.example' }, false],
    ['empty', '', false],
    ['a link over 2048 code units', `https://e.example/${'x'.repeat(2049 - 18)}`, false],
    ['a script link', 'javascript:alert(1)', false],
    ['a script link in capitals', 'JavaScript:alert(1)', false],
    ['a data link', 'data:text/html,x', false],
    ['a mail link', 'mailto:someone@example.org', false],
    ['a tab inside the scheme', 'java\tscript:alert(1)', false],
    ['a leading space', ' https://items.example/AB-12', false],
    ['a new line', 'https://items.example/\nAB-12', false],
    ['a control character', 'https://items.example/\u0000', false],
    ['a delete character', 'https://items.example/\u007f', false],
    ['a next-line control (C1)', 'https://items.example/\u0085', false],
    ['a C1 control', 'https://items.example/\u009b', false],
    ['a no-break space', 'https://items.example/a\u00a0b', false],
    ['a line separator', 'https://items.example/a\u2028b', false],
    ['an ideographic space', 'https://items.example/a\u3000b', false],
    ['an ogham space mark', 'https://items.example/a\u1680b', false],
    ['a leading byte-order mark', '\ufeffjavascript:alert(1)', false],
    ['a leading no-break space', '\u00a0javascript:alert(1)', false],
    ['a letter past the C1 block', 'https://items.example/\u00e9', true],
  ];
  for (const [name, answer, linked] of answers) {
    it(`${linked ? 'linked' : 'no link'}: ${name}`, async () => {
      const root = mount(ITEM_DOC);
      await enhance(root, { itemLink: () => answer as string, vocabulary: { itemFields: ['Tracker'] } });
      const a = root.querySelector('a.item-link');
      expect(a === null ? null : a.getAttribute('href')).toBe(linked ? answer : null);
      if (!linked) expect(facts(root)[1]).toEqual(['Tracker', 'AB-12', []]);
    });
  }

  it('a throwing itemLink leaves that key as text and the others linked', async () => {
    const root = mount('# Example spec\n\n**Spec** · **Tracker:** AB-1 and AB-2 · Status: Draft\n');
    const itemLink = vi.fn((k: string) => {
      if (k === 'AB-1') throw new Error('no');
      return LINK(k);
    });
    expect(await outcome(enhance(root, { itemLink, vocabulary: { itemFields: ['Tracker'] } }))).toBe('resolved');
    expect(Array.from(root.querySelectorAll('a.item-link')).map((a) => a.firstChild?.textContent)).toEqual(['AB-2']);
  });

  it('an itemLink that destroys the reader stops the build: no more calls, and the root comes back whole', async () => {
    const root = mount('# Example spec\n\n**Spec** · **Tracker:** AB-1 and AB-2 · Status: Draft\n');
    const html = root.innerHTML;
    const itemLink = vi.fn((k: string) => {
      void destroyEnhancement(root);
      return LINK(k);
    });
    expect(await outcome(enhance(root, { itemLink, vocabulary: { itemFields: ['Tracker'] } }))).toBe('aborted');
    expect(itemLink).toHaveBeenCalledTimes(1);
    expect(root.innerHTML).toBe(html);
  });

  it('an itemLink that destroys the reader on the delta\'s key stops the build before the byline', async () => {
    const root = mount(ITEM_DOC);
    const html = root.innerHTML;
    const itemLink = vi.fn((k: string) => {
      void destroyEnhancement(root);
      return LINK(k);
    });
    expect(await outcome(enhance(root, { itemLink, vocabulary: { itemFields: ['Tracker'], itemHeadings: ['change delta'] } }))).toBe('aborted');
    expect(itemLink.mock.calls).toEqual([['CD-7']]);
    expect(root.innerHTML).toBe(html);
  });

  it('a delta key the host gives no link for is no delta: the byline route applies', async () => {
    const itemLink = vi.fn((k: string) => (k === 'CD-7' ? null : LINK(k)));
    const root = mount(ITEM_DOC);
    await enhance(root, { itemLink, vocabulary: { itemFields: ['Tracker'], itemHeadings: ['change delta'] } });
    expect(itemLink.mock.calls).toEqual([['CD-7'], ['AB-12']]);
    expect(facts(root)[1]).toEqual(['Tracker', 'AB-12 ↗', [LINK('AB-12')]]);
  });
});

describe('the item link goes through onLink, in a new tab', () => {
  const click = (a: EventTarget, init: MouseEventInit = {}): MouseEvent => {
    const e = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init });
    a.dispatchEvent(e);
    return e;
  };

  it('with onLink: the host gets the link and newTab true, and the default is prevented', async () => {
    const onLink = vi.fn();
    const root = mount(ITEM_DOC);
    await enhance(root, { itemLink: LINK, onLink, vocabulary: { itemFields: ['Tracker'] } });
    const a = root.querySelector('a.item-link') as HTMLElement;
    const e = click(a.firstChild?.parentElement ?? a);
    expect(e.defaultPrevented).toBe(true);
    expect(onLink.mock.calls).toEqual([[LINK('AB-12'), { newTab: true }]]);
    const arrow = click(a.lastElementChild as Element, { ctrlKey: true });
    expect(arrow.defaultPrevented).toBe(true);
    expect(onLink.mock.calls[1]).toEqual([LINK('AB-12'), { newTab: true }]);
  });

  it('a click whose default something inside the link already prevented is left alone', async () => {
    const onLink = vi.fn();
    const root = mount(ITEM_DOC);
    await enhance(root, { itemLink: LINK, onLink, vocabulary: { itemFields: ['Tracker'] } });
    const arrow = (root.querySelector('a.item-link') as Element).lastElementChild as Element;
    arrow.addEventListener('click', (e) => {
      e.preventDefault();
    });
    click(arrow);
    expect(onLink).not.toHaveBeenCalled();
  });

  it('a click on an author\'s link in the byline is not the item link\'s: it reaches onLink as written, without newTab', async () => {
    const onLink = vi.fn();
    const root = mount('# Example spec\n\n**Spec** · **Tracker:** AB-1 and [the notes](https://example.org/n) · Status: Draft\n');
    await enhance(root, { itemLink: LINK, onLink, vocabulary: { itemFields: ['Tracker'] } });
    const author = Array.from(root.querySelectorAll('dl.byline a')).find((a) => !a.classList.contains('item-link')) as Element;
    click(author);
    expect(onLink.mock.calls).toEqual([['https://example.org/n', { newTab: false }]]);
    click(root.querySelector('a.item-link') as Element);
    expect(onLink.mock.calls[1]).toEqual([LINK('AB-1'), { newTab: true }]);
  });

  it('a plain click on the arrow inside the link is the link\'s: newTab true', async () => {
    const onLink = vi.fn();
    const root = mount(ITEM_DOC);
    await enhance(root, { itemLink: LINK, onLink, vocabulary: { itemFields: ['Tracker'] } });
    const e = click((root.querySelector('a.item-link') as Element).lastElementChild as Element);
    expect([e.defaultPrevented, onLink.mock.calls]).toEqual([true, [[LINK('AB-12'), { newTab: true }]]]);
  });

  it('a click whose target is the link\'s own text node goes to onLink too', async () => {
    const onLink = vi.fn();
    const root = mount(ITEM_DOC);
    await enhance(root, { itemLink: LINK, onLink, vocabulary: { itemFields: ['Tracker'] } });
    const key = (root.querySelector('a.item-link') as Element).firstChild as Text;
    expect(key.nodeType).toBe(3);
    const e = click(key);
    expect([e.defaultPrevented, onLink.mock.calls]).toEqual([true, [[LINK('AB-12'), { newTab: true }]]]);
  });

  it('a click with another button is left to the browser', async () => {
    const onLink = vi.fn();
    const root = mount(ITEM_DOC);
    await enhance(root, { itemLink: LINK, onLink, vocabulary: { itemFields: ['Tracker'] } });
    const e = click(root.querySelector('a.item-link') as Element, { button: 1 });
    expect([e.defaultPrevented, onLink.mock.calls.length]).toEqual([false, 0]);
  });

  it('without onLink the browser follows it (into a new tab, by its target)', async () => {
    const root = mount(ITEM_DOC);
    await enhance(root, { itemLink: LINK, vocabulary: { itemFields: ['Tracker'] } });
    const e = click(root.querySelector('a.item-link') as Element);
    expect(e.defaultPrevented).toBe(false);
  });
});

// ── the format contract: the words editorial.ts held (C48) ──────────────────────────────────────────────────────

describe('the format contract: the box headings, the callout kinds and the front-matter kind keys live in vocab.ts', () => {
  it('their defaults, compiled', () => {
    const w = defaultVocabulary();
    expect([w.boxes, w.callouts, w.kindKeys]).toEqual([
      { short: ['in short'], stand: ['where things stand'] },
      { agreed: ['agreed'], waiting: ['waiting'], later: ['later'] },
      ['type', 'area', 'status', 'kind'],
    ]);
    const v = compileVocab(w);
    expect([v.box.short.test('In short'), v.box.short.test('In short, then'), v.box.stand.test('WHERE THINGS STAND'), v.box.stand.test('Where things stand now')]).toEqual([true, false, true, false]);
    expect([v.callout.agreed.test('Agreed so far'), v.callout.waiting.test('Waiting on you'), v.callout.later.test('Later'), v.callout.later.test('Collateral')]).toEqual([true, true, true, false]);
    expect([v.callout.agreed.test('Not agreed'), v.callout.waiting.test('Not waiting'), v.callout.agreed.test('AGREED')]).toEqual([false, false, true]);
    expect([v.kindKey.test('Type'), v.kindKey.test('kind'), v.kindKey.test('kinds'), v.kindKey.test('owner'), v.kindKey.test('subtype')]).toEqual([true, true, false, false, false]);
    expect([v.words.boxes, v.words.boxes.short, v.words.callouts, v.words.callouts.later, v.words.kindKeys].map((x) => Object.isFrozen(x))).toEqual([true, true, true, true, true]);
  });

  it('they are no options', () => {
    for (const key of ['boxes', 'callouts', 'kindKeys']) expect(verdict({ vocabulary: { [key]: [] } })).toBe(`invalid-options: docreader: vocabulary has unknown keys: ${key}`);
  });

  it('editorial.ts reads them from the vocabulary, never from words of its own', async () => {
    const w = defaultVocabulary();
    w.boxes = { short: ['summary'], stand: ['status today'] };
    w.callouts = { agreed: ['settled'], waiting: ['pending'], later: ['someday'] };
    w.kindKeys = ['category'];
    hooks.words = w;
    const md = [
      '---',
      'category: Guide',
      'kind: Design',
      '---',
      '',
      '# Example spec',
      '',
      '## Summary',
      '',
      'Short text.',
      '',
      '## In short',
      '',
      'Not a box now.',
      '',
      '## Status today',
      '',
      '### Settled',
      '',
      '- One.',
      '',
      '### Pending answers',
      '',
      '- Two.',
      '',
      '### Someday',
      '',
      '- Three.',
      '',
      '### Agreed',
      '',
      '- Four.',
      '',
    ].join('\n');
    const r = render(md);
    const root = mount(md);
    await enhance(root, { info: { title: r.meta.title, frontList: r.meta.frontList } });
    expect(Array.from(root.querySelectorAll('div.short > h2')).map((h) => text(h))).toEqual(['Summary']);
    expect(Array.from(root.querySelectorAll('div.callout')).map((b) => `${b.className}:${text(b.querySelector('h3'))}`)).toEqual([
      'callout agreed:Settled',
      'callout waiting:Pending answers',
      'callout later:Someday',
      'callout other:Agreed',
    ]);
    expect(Array.from(root.querySelectorAll('.eyebrow span')).map((s) => s.textContent)).toEqual(['Guide']);
    expect(ctxOf(root).page.waiting.map((li) => text(li))).toEqual(['Two.']);
  });
});

// ── the scrub (§3.7) ─────────────────────────────────────────────────────────────────────────────────────────────

/** The text of every string, template and regular-expression literal in a source file (or only its patterns), comments left out. */
function literals(file: string, patterns = false): string[] {
  const src = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  const out: string[] = [];
  const walk = (n: ts.Node): void => {
    const string = ts.isStringLiteralLike(n) || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n);
    if (ts.isRegularExpressionLiteral(n) || (string && !patterns)) out.push(n.text);
    ts.forEachChild(n, walk);
  };
  walk(src);
  return out;
}

const SOURCES = readdirSync(ENHANCE_DIR)
  .filter((f) => f.endsWith('.ts'))
  .sort()
  .map((f) => path.join(ENHANCE_DIR, f));

describe('the scrub: no private word, no fixed prefix', () => {
  it('the defaults name no qualifier, no rule-ID or ID prefix, no item field and no item heading', () => {
    const w = defaultVocabulary();
    expect([w.qualifiers, w.ruleIds.prefixes, w.ids === false ? 'off' : w.ids.prefixes, w.itemFields, w.itemHeadings]).toEqual([[], null, null, [], []]);
  });

  it('no source in src/enhance holds a storage key with a fixed prefix: every key is built from the namespace', () => {
    const fixed = SOURCES.flatMap((f) => literals(f).filter((t) => /^docreader:\S/.test(t)).map((t) => `${path.basename(f)}: ${t}`));
    expect(fixed).toEqual([]);
  });

  it('no "Open before v1" note is left in src/enhance', () => {
    const notes = SOURCES.filter((f) => /open before v1/i.test(readFileSync(f, 'utf8'))).map((f) => path.basename(f));
    expect(notes).toEqual([]);
  });

  it('editorial.ts matches no word of its own: no pattern in it names a box heading or a front-matter kind key', () => {
    const words = /\b(?:in short|where things stand|agreed|waiting|later|type\|area)\b/i;
    expect(literals(path.join(ENHANCE_DIR, 'editorial.ts'), true).filter((t) => words.test(t))).toEqual([]);
  });
});

describe('README: the two options of Task 8', () => {
  const README = readFileSync(path.join(ROOT, 'README.md'), 'utf8');
  const row = (key: string): string => README.split('\n').find((l) => l.startsWith(`| \`${key}\` | `)) ?? '';

  it('both are options, and each has its row', () => {
    expect(OPTION_KEYS).toContain('vocabulary');
    expect(OPTION_KEYS).toContain('namespace');
    expect([row('vocabulary') !== '', row('namespace') !== '']).toEqual([true, true]);
  });

  it('each row states the default and the bounds the code holds', () => {
    expect(row('namespace')).toContain(`| \`${DEFAULT_NAMESPACE}\` |`);
    expect(row('namespace')).toContain('a lower-case letter, then up to 31 lower-case letters, digits or dashes');
    expect(row('vocabulary')).toContain(`at most ${String(LIMITS.words)} words, each 1 to ${String(LIMITS.word)} code units with no white space at either end`);
  });
});
