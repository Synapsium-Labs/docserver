// @vitest-environment jsdom
// Reader state of `./enhance` (L2 prototype): prefs precedence, stored values that are invalid, the snapshot read
// during startup only, setEnhancementPrefs, and the write-behind to the host's set(): per-key serialization,
// swallowed failures, and no new call once the instance is destroyed. The README states the keys.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { destroyEnhancement, enhance, EnhanceError, setEnhancementPrefs, type ReaderStorage } from '../src/enhance/index.js';
import { docKey, PREFS_KEY } from '../src/enhance/state.js';
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

/** The prefs as the root shows them. */
const shown = (root: Element): [string | null, string | null, string | null] => [
  root.getAttribute('data-theme'),
  root.getAttribute('data-width'),
  root.getAttribute('data-font'),
];

/** A host set() whose calls stay pending until the test settles them, one by one. */
function slowStorage(snapshot: Record<string, string> = {}): {
  storage: ReaderStorage;
  calls: [string, string | null][];
  landed: [string, string | null][];
  settle: (i: number, ok?: boolean) => Promise<void>;
} {
  const calls: [string, string | null][] = [];
  const landed: [string, string | null][] = [];
  const pending: { resolve: () => void; reject: (e: unknown) => void }[] = [];
  return {
    calls,
    landed,
    storage: {
      snapshot,
      set(key, value) {
        calls.push([key, value]);
        return new Promise<void>((resolve, reject) => {
          pending.push({
            resolve: () => {
              landed.push([key, value]);
              resolve();
            },
            reject,
          });
        });
      },
    },
    async settle(i, ok = true) {
      const p = pending[i];
      if (p === undefined) throw new Error(`no call ${String(i)}`);
      if (ok) p.resolve();
      else p.reject(new Error('host storage failed'));
      for (let k = 0; k < 5; k += 1) await Promise.resolve();
    },
  };
}

describe('prefs: defaults < valid stored values < explicit options.prefs', () => {
  it('defaults: theme auto (no data-theme), standard width, serif', async () => {
    const root = mount();
    await enhance(root);
    expect(shown(root)).toEqual([null, 'standard', 'serif']);
  });

  it('stored values apply', async () => {
    const root = mount();
    const snapshot = { [PREFS_KEY]: JSON.stringify({ theme: 'dark', width: 'wide', font: 'sans' }) };
    await enhance(root, { storage: { snapshot } });
    expect(shown(root)).toEqual(['dark', 'wide', 'sans']);
  });

  it('explicit options.prefs override stored ones, field by field', async () => {
    const root = mount();
    const snapshot = { [PREFS_KEY]: JSON.stringify({ theme: 'dark', width: 'wide', font: 'sans' }) };
    await enhance(root, { storage: { snapshot }, prefs: { font: 'serif', theme: 'light' } });
    expect(shown(root)).toEqual(['light', 'wide', 'serif']);
  });

  it('an invalid stored field is ignored, the valid ones kept', async () => {
    const root = mount();
    const snapshot = { [PREFS_KEY]: JSON.stringify({ theme: 'blue', width: 'wide', font: 3 }) };
    await enhance(root, { storage: { snapshot } });
    expect(shown(root)).toEqual([null, 'wide', 'serif']);
  });
});

describe('stored values that are invalid are ignored, never thrown', () => {
  const cases: [string, unknown][] = [
    ['prefs that are not JSON', { [PREFS_KEY]: '{not json' }],
    ['prefs that are an array', { [PREFS_KEY]: '["dark"]' }],
    ['prefs that are a number', { [PREFS_KEY]: '7' }],
    ['folds that are not JSON', { [docKey('k', 'folds')]: 'nope' }],
    ['folds that are an object', { [docKey('k', 'folds')]: '{"1-scope":1}' }],
    ['a value that is not a string', { [PREFS_KEY]: { theme: 'dark' } }],
    ['a snapshot that is not an object', 'docreader'],
  ];
  it.each(cases)('%s', async (_name, snapshot) => {
    const root = mount();
    await enhance(root, { storage: { snapshot: snapshot as Record<string, string> }, storageKey: 'k' });
    expect(shown(root)).toEqual([null, 'standard', 'serif']);
    expect(root.querySelectorAll('.folded').length).toBe(0);
  });

  it('a snapshot getter that throws reads as an empty snapshot', async () => {
    const root = mount();
    const storage = {
      get snapshot(): Record<string, string> {
        throw new Error('host store unavailable');
      },
    };
    await enhance(root, { storage, storageKey: 'k' });
    expect(shown(root)).toEqual([null, 'standard', 'serif']);
  });
});

describe('the snapshot is read during startup only, each key once, only this reader\'s keys', () => {
  it('reads the prefs key and this document\'s folds key once each, and nothing after startup', async () => {
    const root = mount();
    const reads: string[] = [];
    const snapshot = new Proxy({} as Record<string, string>, {
      get(_t, key) {
        reads.push(String(key));
        return undefined;
      },
      ownKeys() {
        reads.push('ownKeys');
        return [];
      },
    });
    await enhance(root, { storage: { snapshot }, storageKey: 'k' });
    expect(reads).toEqual([PREFS_KEY, docKey('k', 'folds')]);
    (root.querySelector('button.h-fold') as HTMLButtonElement).click();
    setEnhancementPrefs(root, { width: 'wide' });
    expect(reads).toEqual([PREFS_KEY, docKey('k', 'folds')]);
  });
});

describe('setEnhancementPrefs', () => {
  it('applies at once and writes the stored prefs behind, keeping unknown stored fields', async () => {
    const root = mount();
    const calls: [string, string | null][] = [];
    const snapshot = { [PREFS_KEY]: JSON.stringify({ font: 'sans', later: 'kept' }) };
    await enhance(root, { storage: { snapshot, set: (k, v) => void calls.push([k, v]) } });
    setEnhancementPrefs(root, { theme: 'dark' });
    expect(shown(root)).toEqual(['dark', 'standard', 'sans']);
    expect(calls).toEqual([[PREFS_KEY, JSON.stringify({ font: 'sans', later: 'kept', theme: 'dark' })]]);
    setEnhancementPrefs(root, { theme: 'auto' });
    expect(root.hasAttribute('data-theme')).toBe(false);
  });

  it('explicit options.prefs are not written back; only what changes later is', async () => {
    const root = mount();
    const calls: [string, string | null][] = [];
    await enhance(root, { prefs: { theme: 'dark' }, storage: { set: (k, v) => void calls.push([k, v]) } });
    expect(calls).toEqual([]);
    setEnhancementPrefs(root, { width: 'wide' });
    expect(calls).toEqual([[PREFS_KEY, '{"width":"wide"}']]);
    expect(shown(root)).toEqual(['dark', 'wide', 'serif']);
  });

  it('a bad value throws invalid-options; an unknown root is a no-op', async () => {
    const root = mount();
    await enhance(root);
    let code = '';
    try {
      setEnhancementPrefs(root, { theme: 'blue' } as never);
    } catch (e) {
      code = (e as EnhanceError).code;
    }
    expect(code).toBe('invalid-options');
    expect(() => setEnhancementPrefs(document.createElement('div'), { theme: 'dark' })).not.toThrow();
    await destroyEnhancement(root);
    setEnhancementPrefs(root, { theme: 'dark' });
    expect(root.hasAttribute('data-theme')).toBe(false);
  });

  it('a set() hook that destroys stops the change before it reaches the DOM', async () => {
    const root = mount();
    const before = root.outerHTML;
    await enhance(root, {
      storage: {
        set: () => {
          void destroyEnhancement(root);
        },
      },
    });
    setEnhancementPrefs(root, { theme: 'dark' });
    expect(root.outerHTML).toBe(before);
  });
});

describe('write-behind', () => {
  it('per key: a newer value waits for the pending call, and only the newest waiting value is sent', async () => {
    const root = mount();
    const s = slowStorage();
    await enhance(root, { storage: s.storage });
    setEnhancementPrefs(root, { width: 'wide' });
    setEnhancementPrefs(root, { theme: 'dark' });
    setEnhancementPrefs(root, { font: 'sans' });
    expect(shown(root)).toEqual(['dark', 'wide', 'sans']); // local state changes at once
    expect(s.calls).toEqual([[PREFS_KEY, '{"width":"wide"}']]); // one call in flight
    await s.settle(0);
    expect(s.calls).toEqual([
      [PREFS_KEY, '{"width":"wide"}'],
      [PREFS_KEY, '{"width":"wide","theme":"dark","font":"sans"}'],
    ]);
    await s.settle(1);
    expect(s.landed.map(([, v]) => v)).toEqual(['{"width":"wide"}', '{"width":"wide","theme":"dark","font":"sans"}']);
  });

  it('an older slow value never lands after a newer one, though the newer is quicker', async () => {
    const root = mount();
    // A host whose second call would land at once, the first only when released.
    const landed: string[] = [];
    let releaseFirst: () => void = () => undefined;
    let n = 0;
    const storage = {
      set(_key: string, value: string | null): Promise<void> {
        n += 1;
        if (n === 1) {
          return new Promise<void>((resolve) => {
            releaseFirst = () => {
              landed.push(String(value));
              resolve();
            };
          });
        }
        landed.push(String(value));
        return Promise.resolve();
      },
    };
    await enhance(root, { storage });
    setEnhancementPrefs(root, { width: 'wide' });
    setEnhancementPrefs(root, { width: 'standard' });
    for (let k = 0; k < 5; k += 1) await Promise.resolve();
    releaseFirst();
    for (let k = 0; k < 5; k += 1) await Promise.resolve();
    expect(landed).toEqual(['{"width":"wide"}', '{"width":"standard"}']);
  });

  it('keys are independent: a pending prefs write does not hold a folds write back', async () => {
    const root = mount();
    const s = slowStorage();
    await enhance(root, { storage: s.storage, storageKey: 'k' });
    setEnhancementPrefs(root, { width: 'wide' });
    (root.querySelector('button.h-fold') as HTMLButtonElement).click();
    expect(s.calls.map(([k]) => k)).toEqual([PREFS_KEY, docKey('k', 'folds')]);
  });

  it('a throwing set() changes nothing: the local change stands, and the next change is still written', async () => {
    const root = mount();
    const calls: (string | null)[] = [];
    const storage = {
      set(_key: string, value: string | null): void {
        calls.push(value);
        if (calls.length === 1) throw new Error('quota');
      },
    };
    await enhance(root, { storage });
    setEnhancementPrefs(root, { theme: 'dark' });
    expect(shown(root)).toEqual(['dark', 'standard', 'serif']);
    setEnhancementPrefs(root, { width: 'wide' });
    expect(calls).toEqual(['{"theme":"dark"}', '{"theme":"dark","width":"wide"}']);
  });

  it('a rejected set() is swallowed, and the waiting value is still sent', async () => {
    const root = mount();
    const s = slowStorage();
    await enhance(root, { storage: s.storage });
    setEnhancementPrefs(root, { theme: 'dark' });
    setEnhancementPrefs(root, { theme: 'light' });
    await s.settle(0, false);
    expect(shown(root)).toEqual(['light', 'standard', 'serif']);
    expect(s.calls.map(([, v]) => v)).toEqual(['{"theme":"dark"}', '{"theme":"light"}']);
  });

  it('once destroyed, no new call is issued: a waiting value is dropped when the pending one completes', async () => {
    const root = mount();
    const s = slowStorage();
    await enhance(root, { storage: s.storage });
    setEnhancementPrefs(root, { theme: 'dark' });
    setEnhancementPrefs(root, { theme: 'light' });
    await destroyEnhancement(root); // does not wait for the pending call
    await s.settle(0);
    expect(s.calls.map(([, v]) => v)).toEqual(['{"theme":"dark"}']);
  });

  it('a set() that calls back into the reader queues the nested write: the older value lands first', async () => {
    const root = mount();
    const log: string[] = [];
    let stored: string | null = null;
    let first = true;
    const storage = {
      async set(_key: string, value: string | null): Promise<void> {
        const theme = (JSON.parse(String(value)) as { theme: string }).theme;
        log.push(`start ${theme}`);
        if (first) {
          first = false;
          setEnhancementPrefs(root, { theme: 'light' }); // a host that re-applies its own settings on a change
        }
        await Promise.resolve();
        log.push(`land ${theme}`);
        stored = value;
      },
    };
    await enhance(root, { storage });
    setEnhancementPrefs(root, { theme: 'dark' });
    for (let k = 0; k < 10; k += 1) await Promise.resolve();
    expect(log).toEqual(['start dark', 'land dark', 'start light', 'land light']);
    expect(root.getAttribute('data-theme')).toBe('light');
    expect(stored).toBe('{"theme":"light"}');
  });

  it('two roots on one storage object: each write keeps the fields the other wrote', async () => {
    const a = mount();
    const b = mount();
    const calls: (string | null)[] = [];
    const storage = { snapshot: {}, set: (_k: string, v: string | null) => void calls.push(v) };
    await enhance(a, { storage });
    await enhance(b, { storage });
    setEnhancementPrefs(a, { theme: 'dark' });
    setEnhancementPrefs(b, { width: 'wide' });
    expect(calls).toEqual(['{"theme":"dark"}', '{"theme":"dark","width":"wide"}']);
  });

  it('a successor on the same storage object waits for its predecessor\'s pending call', async () => {
    const root = mount();
    const s = slowStorage();
    await enhance(root, { storage: s.storage });
    setEnhancementPrefs(root, { theme: 'dark' });
    await destroyEnhancement(root); // does not wait for the pending call
    await enhance(root, { storage: s.storage });
    setEnhancementPrefs(root, { theme: 'light' });
    expect(s.calls.map(([, v]) => v)).toEqual(['{"theme":"dark"}']); // the newer value waits
    await s.settle(0);
    expect(s.calls.map(([, v]) => v)).toEqual(['{"theme":"dark"}', '{"theme":"light"}']);
    await s.settle(1);
    expect(s.landed.map(([, v]) => v)).toEqual(['{"theme":"dark"}', '{"theme":"light"}']);
  });

  it('a later instance merges with a write still in flight when it started, but not with one its snapshot holds', async () => {
    // In flight: the predecessor's call has not landed, so the successor's snapshot cannot hold it.
    const root = mount();
    const s = slowStorage();
    await enhance(root, { storage: s.storage });
    setEnhancementPrefs(root, { theme: 'dark' });
    await destroyEnhancement(root);
    await enhance(root, { storage: s.storage });
    setEnhancementPrefs(root, { width: 'wide' });
    await s.settle(0);
    expect(s.calls.map(([, v]) => v)).toEqual(['{"theme":"dark"}', '{"theme":"dark","width":"wide"}']);
    await destroyEnhancement(root);
    // Landed: the host's store moved on since (another window chose light and sans), and the snapshot says so.
    const calls: (string | null)[] = [];
    const snapshot: Record<string, string> = {};
    const storage = { snapshot, set: (_k: string, v: string | null) => void calls.push(v) };
    await enhance(root, { storage });
    setEnhancementPrefs(root, { theme: 'dark' });
    await destroyEnhancement(root);
    snapshot[PREFS_KEY] = '{"theme":"light","font":"sans"}';
    await enhance(root, { storage });
    setEnhancementPrefs(root, { width: 'wide' });
    expect(calls).toEqual(['{"theme":"dark"}', '{"theme":"light","font":"sans","width":"wide"}']);
  });

  it('without storage nothing persists and the reader still works', async () => {
    const root = mount();
    await enhance(root, { storageKey: 'k' });
    setEnhancementPrefs(root, { theme: 'dark' });
    (root.querySelector('button.h-fold') as HTMLButtonElement).click();
    expect(root.getAttribute('data-theme')).toBe('dark');
    expect(root.querySelectorAll('.folded').length).toBe(1);
  });
});

describe('README: the storage keys', () => {
  // A path, not a URL: in the jsdom environment the global URL is the DOM's, which fs refuses.
  const README = readFileSync(path.join(import.meta.dirname, '..', 'README.md'), 'utf8');

  it('names the prefs key and the per-document key, folds among them', () => {
    expect(README).toContain(`\`${PREFS_KEY}\``);
    expect(README).toContain(`\`${docKey('<storageKey>', 'folds')}\``);
  });
});
