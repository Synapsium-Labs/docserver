// @vitest-environment jsdom
// The options of `./enhance` and the host adapters (docserver L2, Task 5): every option of §3.2 declared, read once
// as plain data and normalized; the host's callbacks reached only through one wrapper each (`ctx.host`), which is
// safe when the callback is absent, turns a throw or a rejection into null, calls nothing once the instance is not
// live, and calls only inside an operation; and the fourth pref, `lens` (LD12). The README lists every option.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { destroyEnhancement, enhance, EnhanceError, setEnhancementPrefs, type EnhanceOptions } from '../src/enhance/index.js';
import { createHost, HOST_CALLBACKS, type HostCallback, type HostCallbacks } from '../src/enhance/host.js';
import { contextOf } from '../src/enhance/lifecycle.js';
import { LIMITS, normalizeOptions, OPTION_KEYS, PREF_VALUES } from '../src/enhance/options.js';
import { defaultPrefs, PREFS_KEY } from '../src/enhance/state.js';
import type { FeatureContext } from '../src/enhance/types.js';
import { render } from '../src/render/index.js';

const DOC = ['# Example spec', '', '## 1. Scope', '', 'Scope text.', '', '## 2. Design', '', 'Design text.', '', '## 3. Plan', '', 'Plan text.', ''].join('\n');

const mounted: HTMLElement[] = [];

function mount(): HTMLElement {
  const parsed = new DOMParser().parseFromString(`<!doctype html><body>${render(DOC).html}`, 'text/html');
  const root = document.createElement('main');
  root.append(...Array.from(parsed.body.childNodes));
  document.body.append(root);
  mounted.push(root);
  return root;
}

afterEach(async () => {
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

/** The context of an enhanced root, which a test reaches through the lifecycle's test hook. */
function ctxOf(root: HTMLElement): FeatureContext {
  const ctx = contextOf(root);
  if (ctx === undefined) throw new Error('no context: the root is not enhanced');
  return ctx;
}

const hex = (n: number): string => 'abcdef0123456789'.repeat(5).slice(0, n);
const SHA40 = hex(40);
const SHA64 = '0123456789abcdef'.repeat(4);
const noop = (): void => undefined;
const load = (): Promise<unknown> => Promise.resolve({ default: {} });
const entry = (over: Record<string, unknown> = {}): Record<string, unknown> => ({ sha: SHA40, subject: 'docs: a change', date: '2026-10-19T10:00:00Z', parents: [hex(40)], ...over });

describe('options: every option of §3.2 is accepted, normalized, with its default', () => {
  it('the defaults, with no options at all and with an empty object', () => {
    for (const o of [undefined, {}]) {
      const n = normalizeOptions(o);
      expect([n.posKey, n.keyboard, n.chrome, n.rules, n.initialHash, n.mermaid]).toEqual([null, true, { bar: true, rail: true, settings: true }, false, null, null]);
      expect(Object.values(n.callbacks)).toEqual(HOST_CALLBACKS.map(() => null));
    }
  });

  it('each option given, each normalized', () => {
    const fns = { onLink: noop, onHash: noop, copy: noop, changes: () => Promise.resolve(null), openVersion: noop, itemLink: () => null };
    const options = {
      ...fns,
      storageKey: 'project-a:specs:x.md',
      posKey: 'project-a:specs:x.md#pos',
      keyboard: false,
      chrome: { bar: false, rail: true },
      rules: true,
      initialHash: '2-design',
      mermaid: { load, maxTextSize: 20_000, maxEdges: 300, secure: ['look', 'look', 'handDrawnSeed'] },
      info: { sha: SHA40, draft: true, commits: [entry()], only: SHA64 },
    };
    const n = normalizeOptions(options);
    expect([n.posKey, n.keyboard, n.chrome, n.rules, n.initialHash]).toEqual(['project-a:specs:x.md#pos', false, { bar: false, rail: true, settings: true }, true, '2-design']);
    expect(n.mermaid).toEqual({ maxTextSize: 20_000, maxEdges: 300, secure: ['look', 'handDrawnSeed'] });
    for (const [name, fn] of Object.entries(fns)) expect(n.callbacks[name as HostCallback]).toEqual({ fn, self: options });
    expect(n.callbacks.mermaid).toEqual({ fn: load, self: options.mermaid });
    expect(n.info).toEqual({ title: undefined, frontList: undefined, sha: SHA40, draft: true, commits: [entry()], only: SHA64 });
  });

  it('posKey defaults to storageKey; without either it is null', () => {
    expect(normalizeOptions({ storageKey: 'k' }).posKey).toBe('k');
    expect(normalizeOptions({ storageKey: 'k', posKey: 'p' }).posKey).toBe('p');
    expect(normalizeOptions({ posKey: 'p' }).posKey).toBe('p');
  });

  it('posKey and storageKey: at most 1024 code units, the bound inclusive; a longer key is refused', () => {
    const at = 'k'.repeat(LIMITS.key);
    expect([normalizeOptions({ posKey: at }).posKey, normalizeOptions({ storageKey: at }).storageKey]).toEqual([at, at]);
    const over = 'k'.repeat(LIMITS.key + 1);
    expect(verdict({ posKey: over })).toMatch(/^invalid-options: docreader: posKey must be a non-empty string of at most 1024/);
    expect(verdict({ storageKey: over })).toMatch(/^invalid-options: docreader: storageKey must be a non-empty string of at most 1024/);
    expect(verdict({ posKey: 'k'.repeat(8_000_000) })).toMatch(/^invalid-options: /);
  });

  it('chrome fields default to true one by one; a mermaid object without limits leaves them to the library', () => {
    expect(normalizeOptions({ chrome: {} }).chrome).toEqual({ bar: true, rail: true, settings: true });
    expect(normalizeOptions({ chrome: { settings: false } }).chrome).toEqual({ bar: true, rail: true, settings: false });
    expect(normalizeOptions({ mermaid: { load } }).mermaid).toEqual({ maxTextSize: null, maxEdges: null, secure: [] });
  });

  it('what features read is frozen: chrome, the mermaid limits and keys, commits and their entries', () => {
    const n = normalizeOptions({ chrome: {}, mermaid: { load, secure: ['look'] }, info: { commits: [entry()] } });
    const commits = n.info?.commits ?? [];
    const read = [n.chrome, n.mermaid, n.mermaid?.secure, commits, commits[0], commits[0]?.parents];
    expect(read.map((v) => [typeof v, Object.isFrozen(v)])).toEqual(read.map(() => ['object', true]));
  });

  it('defence in depth, not seen by a feature: the callbacks record handed to the host wrappers is frozen', () => {
    // The lifecycle keeps `callbacks` off ctx.options and gives it to createHost alone, so no feature or host can
    // observe this freeze; it only keeps a later change from mutating the record a live instance's wrappers read.
    const n = normalizeOptions({ copy: noop, mermaid: { load } });
    const internal = [n.callbacks, n.callbacks.copy, n.callbacks.mermaid];
    expect(internal.map((v) => [typeof v, Object.isFrozen(v)])).toEqual(internal.map(() => ['object', true]));
  });

  it('enhance() takes every option at once and resolves', async () => {
    const root = mount();
    const options: EnhanceOptions = {
      storageKey: 'k',
      posKey: 'p',
      keyboard: false,
      chrome: { bar: false, rail: false, settings: false },
      rules: true,
      initialHash: null,
      onLink: noop,
      onHash: noop,
      copy: noop,
      changes: () => Promise.resolve(null),
      openVersion: noop,
      itemLink: () => null,
      mermaid: { load, maxTextSize: 50_000, maxEdges: 500, secure: ['look'] },
      info: { title: 'Example spec', sha: SHA64, draft: false, commits: null, only: null },
    };
    expect(await outcome(enhance(root, options))).toBe('resolved');
  });
});

describe('options: a wrong type is refused, and nothing is reserved', () => {
  const bad: [string, unknown][] = [
    ['posKey empty', { posKey: '' }],
    ['posKey a number', { posKey: 7 }],
    ['posKey null', { posKey: null }],
    ['keyboard a string', { keyboard: 'yes' }],
    ['keyboard null', { keyboard: null }],
    ['rules a string', { rules: 'true' }],
    ['chrome a boolean', { chrome: false }],
    ['chrome null', { chrome: null }],
    ['chrome an array', { chrome: [] }],
    ['chrome.bar a string', { chrome: { bar: 'no' } }],
    ['chrome.rail a number', { chrome: { rail: 0 } }],
    ['chrome.settings null', { chrome: { settings: null } }],
    ['initialHash a number', { initialHash: 7 }],
    ['initialHash an object', { initialHash: {} }],
    ...(['onLink', 'onHash', 'copy', 'changes', 'openVersion', 'itemLink'] as const).flatMap((k): [string, unknown][] => [
      [`${k} a string`, { [k]: 'x' }],
      [`${k} null`, { [k]: null }],
      [`${k} an object`, { [k]: { call: noop } }],
    ]),
    ['mermaid null', { mermaid: null }],
    ['mermaid a function', { mermaid: load }],
    ['mermaid without load', { mermaid: {} }],
    ['mermaid.load a string', { mermaid: { load: 'mermaid.mjs' } }],
    ['mermaid.maxTextSize zero', { mermaid: { load, maxTextSize: 0 } }],
    ['mermaid.maxTextSize negative', { mermaid: { load, maxTextSize: -1 } }],
    ['mermaid.maxTextSize a fraction', { mermaid: { load, maxTextSize: 1.5 } }],
    ['mermaid.maxTextSize NaN', { mermaid: { load, maxTextSize: Number.NaN } }],
    ['mermaid.maxTextSize Infinity', { mermaid: { load, maxTextSize: Number.POSITIVE_INFINITY } }],
    ['mermaid.maxTextSize a string', { mermaid: { load, maxTextSize: '50000' } }],
    ['mermaid.maxTextSize over its bound', { mermaid: { load, maxTextSize: LIMITS.maxTextSize + 1 } }],
    ['mermaid.maxEdges zero', { mermaid: { load, maxEdges: 0 } }],
    ['mermaid.maxEdges NaN', { mermaid: { load, maxEdges: Number.NaN } }],
    ['mermaid.maxEdges over its bound', { mermaid: { load, maxEdges: LIMITS.maxEdges + 1 } }],
    ['mermaid.secure a string', { mermaid: { load, secure: 'themeCSS' } }],
    ['mermaid.secure holding a number', { mermaid: { load, secure: [1] } }],
    ['mermaid.secure holding a dotted key', { mermaid: { load, secure: ['flowchart.htmlLabels'] } }],
    ['mermaid.secure holding an empty key', { mermaid: { load, secure: [''] } }],
    ['mermaid.secure holding a key over 64 characters', { mermaid: { load, secure: ['k'.repeat(65)] } }],
    ['mermaid.secure over its count', { mermaid: { load, secure: Array.from({ length: LIMITS.secure + 1 }, (_, i) => `key${String(i)}`) } }],
    ['info.sha a number', { info: { sha: 1234567 } }],
    ['info.sha of 6 hex', { info: { sha: hex(6) } }],
    ['info.sha of 41 hex', { info: { sha: hex(41) } }],
    ['info.sha of 63 hex', { info: { sha: hex(63) } }],
    ['info.sha of 65 hex', { info: { sha: '0'.repeat(65) } }],
    ['info.sha not hex', { info: { sha: 'g'.repeat(40) } }],
    ['info.draft a string', { info: { draft: 'yes' } }],
    ['info.only of 41 hex', { info: { only: hex(41) } }],
    ['info.commits an object', { info: { commits: {} } }],
    ['info.commits a string', { info: { commits: 'log' } }],
    ['info.commits holding null', { info: { commits: [null] } }],
    ['info.commits holding a hole', { info: { commits: [, entry()] } }],
    ['a commit sha of 63 hex', { info: { commits: [entry({ sha: hex(63) })] } }],
    ['a commit subject that is a number', { info: { commits: [entry({ subject: 1 })] } }],
    ['a commit date that is a number', { info: { commits: [entry({ date: Date.UTC(2026, 9, 19) })] } }],
    ['a commit date over its bound', { info: { commits: [entry({ date: '2'.repeat(LIMITS.date + 1) })] } }],
    ['commit parents a string', { info: { commits: [entry({ parents: hex(40) })] } }],
    ['commit parents an array-like object', { info: { commits: [entry({ parents: { length: 1, 0: hex(40) } })] } }],
    ['info.commits an array-like object', { info: { commits: { length: 1, 0: entry() } } }],
    ['commit parents holding a short sha', { info: { commits: [entry({ parents: [hex(6)] })] } }],
  ];

  it.each(bad)('%s', (_name, options) => {
    expect(verdict(options)).toMatch(/^invalid-options: docreader: /);
  });

  it('through enhance(), every one rejects invalid-options and the root is untouched', async () => {
    const root = mount();
    const before = root.outerHTML;
    const codes = await Promise.all(bad.map(([, o]) => outcome(enhance(root, o as never))));
    expect(codes).toEqual(bad.map(() => 'invalid-options'));
    expect(root.outerHTML).toBe(before);
    expect(await outcome(enhance(root))).toBe('resolved');
  });
});

describe('options: getters are refused unread, unknown keys refused, inherited properties ignored', () => {
  const withGetter = (target: object, key: string, spy: () => unknown): object => Object.defineProperty(target, key, { get: spy, enumerable: true });

  it.each(['posKey', 'keyboard', 'chrome', 'rules', 'initialHash', 'onLink', 'onHash', 'copy', 'changes', 'openVersion', 'itemLink', 'mermaid'])('a getter for %s', (key) => {
    const spy = vi.fn(() => undefined);
    expect(verdict(withGetter({}, key, spy))).toMatch(/^invalid-options: .*not a getter/);
    expect(spy).not.toHaveBeenCalled();
  });

  const nested: [string, (spy: () => unknown) => object][] = [
    ['chrome.bar', (spy) => ({ chrome: withGetter({}, 'bar', spy) })],
    ['mermaid.load', (spy) => ({ mermaid: withGetter({}, 'load', spy) })],
    ['mermaid.maxEdges', (spy) => ({ mermaid: withGetter({ load }, 'maxEdges', spy) })],
    ['mermaid.secure', (spy) => ({ mermaid: withGetter({ load }, 'secure', spy) })],
    ['info.sha', (spy) => ({ info: withGetter({}, 'sha', spy) })],
    ['info.draft', (spy) => ({ info: withGetter({}, 'draft', spy) })],
    ['info.commits', (spy) => ({ info: withGetter({}, 'commits', spy) })],
    ['info.only', (spy) => ({ info: withGetter({}, 'only', spy) })],
  ];

  it.each(nested)('a getter on %s', (_where, make) => {
    const spy = vi.fn(() => undefined);
    expect(verdict(make(spy))).toMatch(/^invalid-options: .*not a getter/);
    expect(spy).not.toHaveBeenCalled();
  });

  it('a getter on a commit entry, its parents or a secure key is never called: the entry is refused', () => {
    const spy = vi.fn(() => SHA40);
    const e = withGetter({ subject: 's', date: 'd', parents: [] }, 'sha', spy);
    expect(verdict({ info: { commits: [e] } })).toMatch(/^invalid-options: docreader: info\.commits\[0\]\.sha/);
    const parents = withGetter([], '0', spy);
    expect(verdict({ info: { commits: [entry({ parents })] } })).toMatch(/^invalid-options: docreader: info\.commits\[0\]\.parents\[0\]/);
    const commits = withGetter([], '0', spy);
    expect(verdict({ info: { commits } })).toMatch(/^invalid-options: docreader: info\.commits\[0\] /);
    const secure = withGetter([], '0', spy);
    expect(verdict({ mermaid: { load, secure } })).toMatch(/^invalid-options: docreader: mermaid\.secure\[0\]/);
    expect(spy).not.toHaveBeenCalled();
  });

  it.each(['subject', 'date', 'parents'])('a getter on a commit entry\'s %s is never called: the entry is refused', (field) => {
    const spy = vi.fn(() => (field === 'parents' ? [] : 'text'));
    const fields = entry();
    delete fields[field];
    const e = withGetter(fields, field, spy);
    expect(verdict({ info: { commits: [e] } })).toMatch(new RegExp(`^invalid-options: docreader: info\\.commits\\[0\\]\\.${field} `));
    expect(spy).not.toHaveBeenCalled();
  });

  it('unknown keys are refused, at the top, in chrome, in mermaid and in info; a commit entry may carry more', () => {
    expect(verdict({ onClick: noop })).toMatch(/options has unknown keys: onClick/);
    expect(verdict({ chrome: { toc: true } })).toMatch(/chrome has unknown keys: toc/);
    expect(verdict({ mermaid: { load, theme: 'dark' } })).toMatch(/mermaid has unknown keys: theme/);
    expect(verdict({ info: { label: 'x' } })).toMatch(/info has unknown keys: label/);
    expect(verdict({ info: { commits: [entry({ author: 'someone' })] } })).toBe('accepted');
  });

  it('inherited properties are not options: not read, not refused', () => {
    const inherited = Object.create({ copy: noop, keyboard: 'bad', chrome: 'bad', mermaid: { load } }) as object;
    const n = normalizeOptions(inherited);
    expect([n.callbacks.copy, n.callbacks.mermaid, n.keyboard, n.chrome.bar, n.mermaid]).toEqual([null, null, true, true, null]);
    const chrome = Object.create({ bar: 'bad' }) as object;
    expect(normalizeOptions({ chrome }).chrome.bar).toBe(true);
  });

  it('a non-enumerable own option is still read', () => {
    const o = Object.defineProperty({}, 'copy', { value: noop, enumerable: false });
    expect(normalizeOptions(o).callbacks.copy?.fn).toBe(noop);
  });
});

describe('options: no host function runs while the options are read', () => {
  /** A function behind a Proxy that records every trap: a call, or any property read or check on it. */
  function watched(log: string[], name: string): () => unknown {
    const target = function hostFn(): unknown {
      return undefined;
    };
    const record =
      (trap: string) =>
      (...args: unknown[]): never => {
        log.push(`${name}:${trap}`);
        return (Reflect as unknown as Record<string, (...a: unknown[]) => never>)[trap]?.(...args) as never;
      };
    const traps = ['apply', 'construct', 'get', 'has', 'getOwnPropertyDescriptor', 'ownKeys', 'getPrototypeOf', 'defineProperty', 'set', 'deleteProperty', 'isExtensible', 'preventExtensions', 'setPrototypeOf'];
    return new Proxy(target, Object.fromEntries(traps.map((t) => [t, record(t)]))) as () => unknown;
  }

  it('neither normalizeOptions nor the whole startup touches a function option, mermaid.load included', async () => {
    const log: string[] = [];
    const names = ['onLink', 'onHash', 'copy', 'changes', 'openVersion', 'itemLink'];
    const options = { ...Object.fromEntries(names.map((n) => [n, watched(log, n)])), mermaid: { load: watched(log, 'load') } };
    normalizeOptions(options);
    expect(log).toEqual([]);
    const root = mount();
    await enhance(root, options as EnhanceOptions);
    expect(log).toEqual([]);
    expect(ctxOf(root).host.present.names).toEqual([...HOST_CALLBACKS]);
  });
});

describe('options: info.frontList is read as own data, bounded, through no method of the host\'s arrays', () => {
  const fl = (key: string, vals: unknown): Record<string, unknown> => ({ key, list: true, vals });

  it('an own map on the list is never called: its entries are read by index', () => {
    const map = vi.fn(() => [fl('smuggled', ['x'])]);
    const good = Object.defineProperty([fl('tags', ['a'])], 'map', { value: map });
    expect(normalizeOptions({ info: { frontList: good } }).info?.frontList).toEqual([{ key: 'tags', list: true, vals: ['a'] }]);
    const bad = Object.defineProperty([{ key: 42, list: 'yes', vals: 'not-an-array' }], 'map', { value: map });
    expect(verdict({ info: { frontList: bad } })).toMatch(/^invalid-options: docreader: info\.frontList\[0\]/);
    expect(map).not.toHaveBeenCalled();
  });

  it('an own iterator or every on vals is never called: its items are read by index', () => {
    const iterate = vi.fn(function* (): Generator<unknown> {
      yield { toString: () => 'SMUGGLED' };
    });
    const vals = Object.defineProperty(['a'], Symbol.iterator, { value: iterate });
    expect(normalizeOptions({ info: { frontList: [fl('tags', vals)] } }).info?.frontList?.[0]?.vals).toEqual(['a']);
    const every = vi.fn(() => true);
    const mixed = Object.defineProperty([{}, 7], 'every', { value: every });
    expect(verdict({ info: { frontList: [fl('tags', mixed)] } })).toMatch(/^invalid-options: docreader: info\.frontList\[0\]/);
    expect([iterate.mock.calls.length, every.mock.calls.length]).toEqual([0, 0]);
  });

  it('a getter at an index of the list or of vals is never called: the entry is refused', () => {
    const spy = vi.fn(() => fl('tags', ['a']));
    expect(verdict({ info: { frontList: Object.defineProperty([], '0', { get: spy, enumerable: true }) } })).toMatch(/^invalid-options: docreader: info\.frontList\[0\]/);
    const vals = Object.defineProperty([], '0', { get: spy, enumerable: true });
    expect(verdict({ info: { frontList: [fl('tags', vals)] } })).toMatch(/^invalid-options: docreader: info\.frontList\[0\]/);
    expect(spy).not.toHaveBeenCalled();
  });

  it('a hole is refused, not filled from Array.prototype', () => {
    const proto = Array.prototype as unknown as Record<string, unknown>;
    try {
      proto['0'] = fl('polluted', ['p']);
      expect(verdict({ info: { frontList: [, fl('tags', ['a'])] } })).toMatch(/^invalid-options: docreader: info\.frontList\[0\]/);
      proto['0'] = 'polluted';
      expect(verdict({ info: { frontList: [fl('tags', [, 'a'])] } })).toMatch(/^invalid-options: docreader: info\.frontList\[0\]/);
    } finally {
      delete proto['0'];
    }
  });

  it('the list keeps its first 40 entries and each vals its first 300 items, as render() bounds them; none past is read', () => {
    const reads = new Set<number>();
    const watch = <T extends object>(t: T): T =>
      new Proxy(t, {
        getOwnPropertyDescriptor(o, k) {
          if (typeof k === 'string' && /^\d+$/.test(k)) reads.add(Number(k));
          return Reflect.getOwnPropertyDescriptor(o, k);
        },
        get(o, k, r) {
          if (typeof k === 'string' && /^\d+$/.test(k)) reads.add(Number(k));
          return Reflect.get(o, k, r) as unknown;
        },
      });
    const many = Array.from({ length: 200_000 }, (_, i) => fl(`k${String(i)}`, ['v']));
    many[LIMITS.frontList] = { broken: true };
    const kept = normalizeOptions({ info: { frontList: watch(many) } }).info?.frontList ?? [];
    expect(kept).toHaveLength(LIMITS.frontList);
    expect(Math.max(...reads)).toBe(LIMITS.frontList - 1);
    reads.clear();
    const vals = Array.from({ length: 100_000 }, (_, i) => `v${String(i)}`);
    (vals as unknown[])[LIMITS.frontVals] = 7;
    const one = normalizeOptions({ info: { frontList: [fl('tags', watch(vals))] } }).info?.frontList?.[0]?.vals ?? [];
    expect(one).toHaveLength(LIMITS.frontVals);
    expect(Math.max(...reads)).toBe(LIMITS.frontVals - 1);
    expect([LIMITS.frontList, LIMITS.frontVals]).toEqual([40, 300]);
  });
});

describe('options: shas, commits and the hash', () => {
  it('a sha given in upper case is kept in lower case, wherever it is read', () => {
    const upper = SHA40.toUpperCase();
    const info = normalizeOptions({ info: { sha: upper, only: 'ABCDEF1', commits: [entry({ sha: upper, parents: [SHA64.toUpperCase()] })] } }).info;
    expect([info?.sha, info?.only, info?.commits?.[0]?.sha, info?.commits?.[0]?.parents]).toEqual([SHA40, 'abcdef1', SHA40, [SHA64]]);
  });

  it('a sha is 7 to 40 hex characters, or exactly 64, in either case', () => {
    for (const sha of [hex(7), hex(40), SHA64, SHA40.toUpperCase()]) {
      expect(verdict({ info: { sha, only: sha, commits: [entry({ sha, parents: [sha] })] } })).toBe('accepted');
    }
    for (const sha of [hex(6), hex(41), hex(63), '0'.repeat(65), `${hex(39)}g`, ` ${hex(40)}`]) {
      expect(verdict({ info: { sha } })).toMatch(/^invalid-options: docreader: info\.sha must be/);
      expect(verdict({ info: { only: sha } })).toMatch(/^invalid-options: docreader: info\.only must be/);
      expect(verdict({ info: { commits: [entry({ sha })] } })).toMatch(/^invalid-options: docreader: info\.commits\[0\]\.sha/);
    }
    expect(normalizeOptions({ info: { sha: null, only: null, commits: null } }).info).toMatchObject({ sha: null, only: null, commits: null });
  });

  it('info.commits keeps its first 100 entries, and no entry past them is read', () => {
    const reads = new Set<string>();
    const many = Array.from({ length: 100_000 }, (_, i) => entry({ sha: (i % 2 === 0 ? hex(40) : SHA64), subject: `change ${String(i)}` }));
    many[100] = { broken: true };
    const commits = new Proxy(many, {
      get(t, k, r) {
        if (typeof k === 'string' && /^\d+$/.test(k)) reads.add(k);
        return Reflect.get(t, k, r) as unknown;
      },
      getOwnPropertyDescriptor(t, k) {
        if (typeof k === 'string' && /^\d+$/.test(k)) reads.add(k);
        return Reflect.getOwnPropertyDescriptor(t, k);
      },
    });
    const kept = normalizeOptions({ info: { commits } }).info?.commits ?? [];
    expect(kept).toHaveLength(LIMITS.commits);
    expect(kept[99]?.subject).toBe('change 99');
    expect([...reads].map(Number).sort((a, b) => b - a)[0]).toBe(99);
  });

  it('a subject is cut to 200 code units, never inside a surrogate pair; a 1 MB subject stays bounded', () => {
    const long = normalizeOptions({ info: { commits: [entry({ subject: 'x'.repeat(1_048_576) })] } }).info?.commits?.[0]?.subject;
    expect(long?.length).toBe(LIMITS.subject); // the length first: a failing 1 MB string comparison is slow to print
    expect(long).toBe('x'.repeat(LIMITS.subject));
    const pair = '\u{1F600}';
    const atEdge = `${'x'.repeat(LIMITS.subject - 1)}${pair}tail`;
    expect(normalizeOptions({ info: { commits: [entry({ subject: atEdge })] } }).info?.commits?.[0]?.subject).toBe('x'.repeat(LIMITS.subject - 1));
    const fits = `${'x'.repeat(LIMITS.subject - 2)}${pair}tail`;
    expect(normalizeOptions({ info: { commits: [entry({ subject: fits })] } }).info?.commits?.[0]?.subject).toBe(`${'x'.repeat(LIMITS.subject - 2)}${pair}`);
    const short = 'docs: short';
    expect(normalizeOptions({ info: { commits: [entry({ subject: short })] } }).info?.commits?.[0]?.subject).toBe(short);
  });

  it('a date of 64 characters is kept; parents keep their first 16, and read none past them', () => {
    const date = '2'.repeat(LIMITS.date);
    const parents = Array.from({ length: 40 }, () => hex(40));
    parents[LIMITS.parents] = 'not a sha';
    const kept = normalizeOptions({ info: { commits: [entry({ date, parents })] } }).info?.commits?.[0];
    expect(kept?.date).toBe(date);
    expect(kept?.parents).toHaveLength(LIMITS.parents);
    expect(normalizeOptions({ info: { commits: [entry({ parents: [] })] } }).info?.commits?.[0]?.parents).toEqual([]);
  });

  it('initialHash: an id; empty is no hash, and one over 1024 code units is ignored, not cut', () => {
    expect(normalizeOptions({ initialHash: '3-plan' }).initialHash).toBe('3-plan');
    expect(normalizeOptions({ initialHash: '' }).initialHash).toBeNull();
    expect(normalizeOptions({ initialHash: null }).initialHash).toBeNull();
    expect(normalizeOptions({ initialHash: 'h'.repeat(LIMITS.hash) }).initialHash).toBe('h'.repeat(LIMITS.hash));
    expect(normalizeOptions({ initialHash: 'h'.repeat(LIMITS.hash + 1) }).initialHash).toBeNull();
  });

  it('the bounds of the mermaid limits are inclusive', () => {
    const n = normalizeOptions({ mermaid: { load, maxTextSize: LIMITS.maxTextSize, maxEdges: LIMITS.maxEdges } });
    expect(n.mermaid).toMatchObject({ maxTextSize: LIMITS.maxTextSize, maxEdges: LIMITS.maxEdges });
    expect(normalizeOptions({ mermaid: { load, maxTextSize: 1, maxEdges: 1 } }).mermaid).toMatchObject({ maxTextSize: 1, maxEdges: 1 });
    const keys = Array.from({ length: LIMITS.secure }, (_, i) => `key${String(i)}`);
    expect(normalizeOptions({ mermaid: { load, secure: keys } }).mermaid?.secure).toEqual(keys);
  });
});

/**
 * A host built over given callbacks, with a test's own live flag and operation depth. Its operate only counts the
 * depth and never refuses, so what a test sees of the live flag is the wrapper's own check (the lifecycle's operate
 * refuses as well; the lifecycle tests below cover the two together).
 */
function harness(given: Partial<Record<HostCallback, (...args: never[]) => unknown>>) {
  const self = { holder: true };
  let alive = true;
  let depth = 0;
  let ops = 0;
  const callbacks = Object.fromEntries(HOST_CALLBACKS.map((n) => [n, given[n] === undefined ? null : { fn: given[n], self }])) as unknown as HostCallbacks;
  const host = createHost(
    callbacks,
    () => alive,
    <T>(fn: () => T): T | undefined => {
      depth += 1;
      ops += 1;
      try {
        return fn();
      } finally {
        depth -= 1;
      }
    },
  );
  return {
    host,
    self,
    depth: () => depth,
    ops: () => ops,
    kill: () => {
      alive = false;
    },
  };
}

/** Every wrapper called once with fixed arguments, in HOST_CALLBACKS order: what each returned. */
function callAll(h: ReturnType<typeof harness>['host']): unknown[] {
  return [
    h.copy('text'),
    h.changes(SHA40),
    h.openVersion({ sha: SHA40, only: null }),
    h.onLink('other.md', { newTab: false }),
    h.onHash('2-design', { push: true, from: null }),
    h.itemLink('KEY-1'),
    h.loadMermaid(),
  ];
}

const SYNC: readonly HostCallback[] = ['openVersion', 'onLink', 'onHash', 'itemLink'];

describe('host: one wrapper per host callback', () => {
  it('absent: present is empty, each wrapper calls nothing, enters no operation and answers null', async () => {
    const { host, ops } = harness({});
    expect(host.present.names).toEqual([]);
    expect(HOST_CALLBACKS.map((n) => host.present.has(n))).toEqual(HOST_CALLBACKS.map(() => false));
    expect(await Promise.all(callAll(host))).toEqual(HOST_CALLBACKS.map(() => null));
    expect(ops()).toBe(0);
  });

  it('present is a frozen set of the callbacks given, in a fixed order; one that returns null is still present', () => {
    const { host } = harness({ itemLink: () => null, copy: noop });
    expect(host.present.names).toEqual(['copy', 'itemLink']);
    expect([host.present.has('itemLink'), host.present.has('copy'), host.present.has('changes')]).toEqual([true, true, false]);
    expect(host.itemLink('KEY-1')).toBeNull();
    expect(host.present.has('itemLink')).toBe(true);
    expect([Object.isFrozen(host.present), Object.isFrozen(host.present.names), Object.isFrozen(host)]).toEqual([true, true, true]);
  });

  it('each callback gets its arguments, as fresh frozen objects, and the object it was read from as its receiver', async () => {
    const seen: unknown[][] = [];
    const receivers: unknown[] = [];
    const spy = function (this: unknown, ...args: unknown[]): unknown {
      receivers.push(this);
      seen.push(args);
      return undefined;
    };
    const { host, self } = harness(Object.fromEntries(HOST_CALLBACKS.map((n) => [n, spy])));
    const how = { newTab: true };
    const where = { push: false, from: 'token' };
    const version = { sha: SHA40, only: SHA64 };
    await host.copy('text');
    await host.changes(SHA40);
    host.openVersion(version);
    host.onLink('other.md', how);
    host.onHash(null, where);
    host.itemLink('KEY-1');
    await host.loadMermaid();
    expect(seen).toEqual([['text'], [SHA40], [{ sha: SHA40, only: SHA64 }], ['other.md', { newTab: true }], [null, { push: false, from: 'token' }], ['KEY-1'], []]);
    expect(receivers.every((r) => r === self)).toBe(true);
    const objects = [seen[2]?.[0], seen[3]?.[1], seen[4]?.[1]];
    expect(objects.map((o) => Object.isFrozen(o))).toEqual([true, true, true]);
    expect([objects[0] === version, objects[1] === how, objects[2] === where]).toEqual([false, false, false]);
  });

  it('a host function is called itself: its own call property is never read or run', async () => {
    const ran: string[] = [];
    const own = vi.fn(() => 'own call ran instead');
    const withCall = (name: string, value: unknown) => Object.defineProperty(() => (ran.push(name), value), 'call', { value: own });
    const { host } = harness({ itemLink: withCall('itemLink', 'link'), onLink: withCall('onLink', undefined), changes: withCall('changes', 'reply') });
    expect([host.itemLink('K-1'), host.onLink('a.md', { newTab: false }), await host.changes(SHA40)]).toEqual(['link', undefined, 'reply']);
    expect(ran).toEqual(['itemLink', 'onLink', 'changes']);
    expect(own).not.toHaveBeenCalled();
  });

  it('a Function.prototype.call patched once the host is built sees none of its calls', async () => {
    const { host } = harness({ itemLink: () => 'link', copy: noop });
    const proto = Object.getPrototypeOf(noop) as { call: unknown };
    const original = proto.call;
    const patched = vi.fn(function (this: unknown, ...args: unknown[]): unknown {
      return (original as (this: unknown, ...a: unknown[]) => unknown).apply(this, args);
    });
    proto.call = patched;
    let answers: unknown[];
    try {
      answers = [host.itemLink('K-1'), await host.copy('t')];
    } finally {
      proto.call = original;
    }
    expect(answers).toEqual(['link', undefined]);
    expect(patched).not.toHaveBeenCalled();
  });

  it('results are unknown: a value callback answers what the host returned, a void one undefined', async () => {
    const { host } = harness({
      copy: () => Promise.resolve('ignored'),
      changes: () => Promise.resolve({ changed: [[1, 2]] }),
      openVersion: () => 'ignored',
      onLink: () => 'ignored',
      onHash: () => 'ignored',
      itemLink: () => 'https://tracker.example/KEY-1',
      mermaid: () => Promise.resolve({ default: 'module' }),
    });
    expect(await Promise.all(callAll(host))).toEqual([undefined, { changed: [[1, 2]] }, undefined, undefined, undefined, 'https://tracker.example/KEY-1', { default: 'module' }]);
    const plain = harness({ copy: noop, changes: () => 7, mermaid: () => 'sync' });
    expect(await Promise.all([plain.host.copy('t'), plain.host.changes(SHA40), plain.host.loadMermaid()])).toEqual([undefined, 7, 'sync']);
  });

  it('a throw becomes null, for every callback', async () => {
    const thrower = (): never => {
      throw new Error('host failed');
    };
    const { host } = harness(Object.fromEntries(HOST_CALLBACKS.map((n) => [n, thrower])));
    expect(await Promise.all(callAll(host))).toEqual(HOST_CALLBACKS.map(() => null));
  });

  it('a rejection becomes null; so does a thenable whose then throws, or whose then getter throws; nothing rejects', async () => {
    const rejecting = (): Promise<never> => Promise.reject(new Error('host failed'));
    const { host } = harness({ copy: rejecting, changes: rejecting, mermaid: rejecting });
    expect(await Promise.all([host.copy('t'), host.changes(SHA40), host.loadMermaid()])).toEqual([null, null, null]);
    const badThen = {
      then() {
        throw new Error('then failed');
      },
    };
    const badGetter = Object.defineProperty({}, 'then', {
      get() {
        throw new Error('getter failed');
      },
    });
    const odd = harness({ copy: () => badThen, changes: () => badGetter, mermaid: () => badThen });
    expect(await Promise.all([odd.host.copy('t'), odd.host.changes(SHA40), odd.host.loadMermaid()])).toEqual([null, null, null]);
  });

  it('each callback runs inside an operation', async () => {
    const depths: Record<string, number> = {};
    let h: ReturnType<typeof harness> | null = null;
    const at = (name: string) => (): undefined => {
      depths[name] = h?.depth() ?? -1;
      return undefined;
    };
    h = harness(Object.fromEntries(HOST_CALLBACKS.map((n) => [n, at(n)])));
    await Promise.all(callAll(h.host));
    expect(depths).toEqual(Object.fromEntries(HOST_CALLBACKS.map((n) => [n, 1])));
  });

  it('the then of a thenable the host returned is read inside the operation', async () => {
    const depths: number[] = [];
    let h: ReturnType<typeof harness> | null = null;
    const thenable = (): object =>
      Object.defineProperty({}, 'then', {
        get() {
          depths.push(h?.depth() ?? -1);
          return undefined; // not a function: the object itself is the value
        },
      });
    h = harness({ changes: thenable, copy: thenable, mermaid: thenable });
    await Promise.all([h.host.changes(SHA40), h.host.copy('t'), h.host.loadMermaid()]);
    // The first read of each is the wrapper's. A reply that settles with that object is a promise settling with an
    // object, so the promise machinery reads its then once more, later, as it does for any value (not pinned here).
    expect(depths.slice(0, 3)).toEqual([1, 1, 1]);
  });

  it('once not live, nothing is called and every wrapper answers null', async () => {
    const calls: string[] = [];
    const { host, kill } = harness(Object.fromEntries(HOST_CALLBACKS.map((n) => [n, () => void calls.push(n)])));
    kill();
    expect(await Promise.all(callAll(host))).toEqual(HOST_CALLBACKS.map(() => null));
    expect(calls).toEqual([]);
  });

  it('a reply that settles after the instance stopped being live is silenced: null', async () => {
    const pending: ((v: unknown) => void)[] = [];
    const later = (): Promise<unknown> => new Promise((resolve) => void pending.push(resolve));
    const { host, kill } = harness({ copy: later, changes: later, mermaid: later });
    const replies = [host.copy('t'), host.changes(SHA40), host.loadMermaid()];
    kill();
    for (const resolve of pending) resolve({ changed: [] });
    expect(await Promise.all(replies)).toEqual([null, null, null]);
  });

  it('the synchronous wrappers are the four that return at once', () => {
    const { host } = harness(Object.fromEntries(SYNC.map((n) => [n, noop])));
    const results = [host.openVersion({ sha: null, only: null }), host.onLink('a.md', { newTab: true }), host.onHash('x', { push: true, from: null }), host.itemLink('K-1')];
    expect(results.some((r) => r instanceof Promise)).toBe(false);
  });
});

describe('host: the lifecycle wires it to the instance', () => {
  it('ctx.host.present names the callbacks given; ctx.options holds no host function', async () => {
    const root = mount();
    await enhance(root, { copy: noop, onLink: noop, mermaid: { load } });
    const ctx = ctxOf(root);
    expect(ctx.host.present.names).toEqual(['copy', 'onLink', 'mermaid']);
    expect(Object.keys(ctx.options).sort()).toEqual(['chrome', 'folds', 'info', 'initialHash', 'keyboard', 'mermaid', 'namespace', 'posKey', 'prefs', 'rules', 'signal', 'storage', 'storageKey', 'vocabulary']);
    expect(Object.values(ctx.options).some((v) => typeof v === 'function')).toBe(false);
    expect(ctx.options.mermaid).toEqual({ maxTextSize: null, maxEdges: null, secure: [] });
  });

  it('a callback is called as a method of the options object', async () => {
    const root = mount();
    const receivers: unknown[] = [];
    const options: EnhanceOptions = {
      copy() {
        receivers.push(this);
      },
    };
    await enhance(root, options);
    await ctxOf(root).host.copy('text');
    expect(receivers).toEqual([options]);
  });

  it('after destroy, a wrapper captured before it calls nothing and answers null', async () => {
    const root = mount();
    const copy = vi.fn(noop);
    const onLink = vi.fn(noop);
    await enhance(root, { copy, onLink });
    const { host } = ctxOf(root);
    await destroyEnhancement(root);
    expect(await host.copy('text')).toBeNull();
    expect(host.onLink('a.md', { newTab: false })).toBeNull();
    expect([copy.mock.calls.length, onLink.mock.calls.length]).toEqual([0, 0]);
  });

  it('a destroy from inside a callback waits for the call to return, then tears down; its reply is silenced', async () => {
    const root = mount();
    const seen: boolean[] = [];
    await enhance(root, {
      copy() {
        void destroyEnhancement(root);
        seen.push(root.hasAttribute('data-docreader-root'));
        return Promise.resolve();
      },
    });
    const reply = ctxOf(root).host.copy('text');
    seen.push(root.hasAttribute('data-docreader-root'));
    expect(seen).toEqual([true, false]);
    expect(await reply).toBeNull();
  });

  it('a synchronous callback that destroys the instance itself answers null, as an asynchronous one does', async () => {
    const root = mount();
    const seen: boolean[] = [];
    const destroyThen = <T>(value: T) =>
      function (): T {
        void destroyEnhancement(root);
        return value;
      };
    await enhance(root, { itemLink: destroyThen('https://x.example/after'), onLink: destroyThen(undefined) });
    const ctx = ctxOf(root);
    expect(ctx.host.itemLink('K-1')).toBeNull();
    seen.push(ctx.live());
    const again = mount();
    await enhance(again, { onLink: function () { void destroyEnhancement(again); } });
    const other = ctxOf(again);
    expect(other.host.onLink('a.md', { newTab: false })).toBeNull();
    seen.push(other.live());
    expect(seen).toEqual([false, false]);
  });

  it('a reply after destroy is silenced on the real instance too', async () => {
    const root = mount();
    let resolve: (v: unknown) => void = noop;
    await enhance(root, { changes: () => new Promise((r) => void (resolve = r)) });
    const reply = ctxOf(root).host.changes(SHA40);
    await destroyEnhancement(root);
    resolve({ changed: [[1, 2]] });
    expect(await reply).toBeNull();
  });

  it('ctx.info carries sha, draft, commits and only, with their defaults', async () => {
    const a = mount();
    await enhance(a, { info: { sha: SHA40, draft: true, commits: [entry()] as never, only: SHA64 } });
    const ia = ctxOf(a).info;
    expect([ia.sha, ia.draft, ia.commits, ia.only]).toEqual([SHA40, true, [entry()], SHA64]);
    const b = mount();
    await enhance(b);
    const ib = ctxOf(b).info;
    expect([ib.sha, ib.draft, ib.commits, ib.only]).toEqual([null, false, null, null]);
  });
});

describe('prefs: lens, the fourth pref (LD12)', () => {
  it('defaults to all, the first of its values', () => {
    expect(PREF_VALUES.lens).toEqual(['all', 'product']);
    expect(defaultPrefs()).toEqual({ theme: 'auto', width: 'standard', font: 'serif', lens: 'all' });
  });

  it('a stored lens is restored; an invalid one is ignored; an explicit one wins', async () => {
    const product = { [PREFS_KEY]: JSON.stringify({ lens: 'product' }) };
    const a = mount();
    await enhance(a, { storage: { snapshot: product } });
    expect(ctxOf(a).state.prefs.lens).toBe('product');
    const b = mount();
    await enhance(b, { storage: { snapshot: { [PREFS_KEY]: JSON.stringify({ lens: 'loud' }) } } });
    expect(ctxOf(b).state.prefs.lens).toBe('all');
    const c = mount();
    await enhance(c, { storage: { snapshot: product }, prefs: { lens: 'all' } });
    expect(ctxOf(c).state.prefs.lens).toBe('all');
  });

  it('setEnhancementPrefs stores it with the prefs, and refuses a bad value', async () => {
    const root = mount();
    const calls: [string, string | null][] = [];
    await enhance(root, { storage: { set: (k, v) => void calls.push([k, v]) } });
    setEnhancementPrefs(root, { lens: 'product' });
    expect(ctxOf(root).state.prefs.lens).toBe('product');
    expect(calls).toEqual([[PREFS_KEY, '{"lens":"product"}']]);
    expect(() => setEnhancementPrefs(root, { lens: 'loud' } as never)).toThrow(/prefs\.lens must be one of all, product/);
    expect(verdict({ prefs: { lens: 'loud' } })).toMatch(/^invalid-options: docreader: prefs\.lens/);
  });

  it('a lens change is a change of the prefs in force', async () => {
    const root = mount();
    await enhance(root);
    const { state } = ctxOf(root);
    expect(state.setPrefs({ lens: 'product' })).toBe(true);
    expect(state.setPrefs({ lens: 'product' })).toBe(false);
  });
});

describe('README: the options of ./enhance', () => {
  // A path, not a URL: in the jsdom environment the global URL is the DOM's, which fs refuses.
  const README = readFileSync(path.join(import.meta.dirname, '..', 'README.md'), 'utf8');
  const section = README.slice(README.indexOf('## Embedding: `./enhance`'), README.indexOf('## The conformance corpus'));
  const table = section.slice(section.indexOf('| Option | Default | Meaning |')).split('\n\n')[0] ?? '';

  it('lists every option once, each with a default', () => {
    const rows = table
      .split('\n')
      .slice(2)
      .map((l) => /^\| `(\w+)` \| ([^|]*) \|/.exec(l));
    expect(rows.map((m) => m?.[1]).sort()).toEqual([...OPTION_KEYS].sort());
    expect(rows.filter((m) => (m?.[2] ?? '').trim() === '')).toEqual([]);
  });

  /** The Default and Meaning cells of one option's row. */
  const row = (key: string): [string, string] => {
    const m = new RegExp(`^\\| \`${key}\` \\| ([^|]*) \\| (.*) \\|$`, 'm').exec(table);
    return [m?.[1]?.trim() ?? '', m?.[2] ?? ''];
  };

  it('each stated default is the one normalizeOptions applies', () => {
    const n = normalizeOptions({});
    for (const k of ['keyboard', 'rules', 'folds'] as const) expect([k, row(k)[0]]).toEqual([k, `\`${String(n[k])}\``]);
    expect(Object.values(n.chrome)).toEqual([true, true, true]);
    expect(row('chrome')[0]).toBe('each `true`');
    expect(normalizeOptions({ storageKey: 'k' }).posKey).toBe('k');
    expect(row('posKey')[0]).toBe('`storageKey`');
  });

  it('each stated bound is the one LIMITS holds', () => {
    // By phrase: a number such as 40 or 64 appears more than once in a row (the sha's bounds), so a bare number
    // would still be found after the bound it names had drifted.
    const bounds: [string, string][] = [
      ['info', `first ${String(LIMITS.commits)} commits`],
      ['info', `cut to ${String(LIMITS.subject)} code units`],
      ['info', `first ${String(LIMITS.parents)} parents`],
      ['info', `date over ${String(LIMITS.date)} code units`],
      ['info', `\`frontList\` keeps its first ${String(LIMITS.frontList)} entries`],
      ['info', `each \`vals\` its first ${String(LIMITS.frontVals)} items`],
      ['mermaid', `from 1 to ${String(LIMITS.maxTextSize)})`],
      ['mermaid', `from 1 to ${String(LIMITS.maxEdges)})`],
      ['mermaid', `up to ${String(LIMITS.secure)} configuration keys`],
      ['initialHash', `over ${String(LIMITS.hash)} code units`],
      ['posKey', `at most ${String(LIMITS.key)} code units`],
      ['storageKey', `at most ${String(LIMITS.key)} code units`],
    ];
    expect(bounds.filter(([k, phrase]) => !row(k)[1].includes(phrase))).toEqual([]);
  });

  it('says which options this version reads and checks but does not act on yet', () => {
    const note = section.split('\n\n').find((p) => p.includes('take effect as the parts of the layout that use them land')) ?? '';
    const named = ['posKey', 'keyboard', 'chrome', 'rules', 'initialHash', 'onLink', 'onHash', 'copy', 'changes', 'openVersion', 'itemLink', 'mermaid', 'lens', 'sha', 'draft', 'commits', 'only'];
    expect(named.filter((k) => !note.includes(`\`${k}\``))).toEqual([]);
  });

  it('keeps the ownership rules out of the host callbacks paragraph', () => {
    const callbacks = section.split('\n\n').find((p) => p.startsWith('**Host callbacks.**')) ?? '';
    expect(callbacks).not.toBe('');
    expect(callbacks).not.toContain('One root has one owner');
    expect(section).toContain('One root has one owner');
  });

  it('names the lens pref and its values, and the reserved position and UI keys', () => {
    expect(section).toContain('`lens`: `all` or `product`');
    expect(section).toContain('`docreader:pos:<posKey>`');
    expect(section).toContain('`docreader:ui`');
  });
});
