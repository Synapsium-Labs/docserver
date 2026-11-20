// @vitest-environment jsdom
// The reader waits for a host's faces before it measures (docserver appearance review 2906 F8). Hosted `--sans` and `--mono`
// put `Docreader Host Sans` and `Docreader Host Mono` first, and the frame runtime adds those faces to the font set before
// the reader starts, so a width measured while one still loads is measured on the fallback's metrics. env.fonts, the reader's
// one font wait (relayout's 'fonts' trigger and the Mermaid drawing's pre-draw wait both go through it), therefore also waits,
// within its own bound, for any host face the set holds that is still loading; a face that fails ends the wait too.
// Judged in jsdom with a stand-in font set whose faces settle when the test says; the Chromium row is
// test/browser/host-face-wait.test.ts.
import { afterEach, describe, expect, it } from 'vitest';
import { createEnv } from '../src/enhance/env.js';
import { destroyEnhancement, enhance } from '../src/enhance/index.js';
import { createJournal } from '../src/enhance/journal.js';
import { contextOf } from '../src/enhance/lifecycle.js';
import { render } from '../src/render/index.js';

interface FakeFace {
  family: string;
  status: 'unloaded' | 'loading' | 'loaded' | 'error';
  loaded: Promise<unknown>;
}

/** A face that settles when the test calls `load()` or `fail()`. */
function face(family: string): FakeFace & { load(): void; fail(): void } {
  let ok: (v: unknown) => void = () => undefined;
  let no: (e: unknown) => void = () => undefined;
  const loaded = new Promise<unknown>((resolve, reject) => {
    ok = resolve;
    no = reject;
  });
  loaded.catch(() => undefined);
  const f = {
    family,
    status: 'loading' as FakeFace['status'],
    loaded,
    load: () => {
      f.status = 'loaded';
      ok(f);
    },
    fail: () => {
      f.status = 'error';
      no(new Error('no face'));
    },
  };
  return f;
}

/** A font set whose two library faces are loaded and which holds `faces` besides. */
function setOf(faces: readonly FakeFace[]): unknown {
  return {
    load: () => Promise.resolve([{ status: 'loaded' }]),
    forEach: (fn: (f: FakeFace) => void) => faces.forEach(fn),
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  };
}

const install = (value: unknown): void => void Object.defineProperty(document, 'fonts', { configurable: true, value });

const DOC = ['# Hosted', '', '**Spec** · 2026-11-20 · Status: Draft', '', '## 1. One', '', 'Text.', '', '## 2. Two', '', 'More.'].join('\n');
const mounted: HTMLElement[] = [];

function mount(): HTMLElement {
  const parsed = new DOMParser().parseFromString(`<!doctype html><body>${render(DOC).html}`, 'text/html');
  const root = document.createElement('main');
  root.append(...Array.from(parsed.body.childNodes).map((n) => document.importNode(n, true)));
  document.body.append(root);
  mounted.push(root);
  return root;
}

const tick = (ms = 0): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** env.fonts on a root with no reader: the wait alone. */
function fontsOf(): (ms: number) => Promise<boolean> {
  const root = mount();
  const control = createJournal(() => true, (fn) => fn());
  return createEnv(root, control.journal, () => true, (fn) => fn()).fonts;
}

/** The wait's answer once it settled, or 'pending' while it has not. */
const state = async (p: Promise<boolean>): Promise<boolean | 'pending'> => {
  let out: boolean | 'pending' = 'pending';
  void p.then((v) => (out = v));
  await tick(20);
  return out;
};

afterEach(async () => {
  for (const root of mounted.splice(0)) await destroyEnhancement(root).catch(() => undefined);
  document.body.replaceChildren();
  Reflect.deleteProperty(document, 'fonts');
});

describe('env.fonts and the host faces', () => {
  it('waits for a host face that is still loading, after the library faces are in, and answers true once it has loaded', async () => {
    const sans = face('Docreader Host Sans');
    install(setOf([sans]));
    const wait = fontsOf()(5000);
    expect(await state(wait), 'the library faces are in, the host face is not').toBe('pending');
    sans.load();
    expect(await wait).toBe(true);
  });

  it('waits for each of the two host faces, and reads a family the way a browser may report it, quoted', async () => {
    const sans = face('"Docreader Host Sans"');
    const mono = face("'Docreader Host Mono'");
    install(setOf([sans, mono]));
    const wait = fontsOf()(5000);
    sans.load();
    expect(await state(wait), 'one face is still loading').toBe('pending');
    mono.load();
    expect(await wait).toBe(true);
  });

  it('a host face that fails ends the wait as well: the library faces stay in use and the answer is true', async () => {
    const mono = face('Docreader Host Mono');
    install(setOf([mono]));
    const wait = fontsOf()(5000);
    expect(await state(wait)).toBe('pending');
    mono.fail();
    expect(await wait).toBe(true);
  });

  it('is bounded: a host face that never settles ends the wait at its bound, false', async () => {
    install(setOf([face('Docreader Host Sans')]));
    expect(await fontsOf()(40)).toBe(false);
  });

  it('is not held by a face of another family, by a face already settled, or by a font set that cannot be walked', async () => {
    const other = face('Some Other Family');
    const done = face('Docreader Host Sans');
    done.load();
    const failed = face('Docreader Host Mono');
    failed.fail();
    install(setOf([other, done, failed]));
    expect(await fontsOf()(5000)).toBe(true);
    install({ load: () => Promise.resolve([{ status: 'loaded' }]), addEventListener: () => undefined, removeEventListener: () => undefined });
    expect(await fontsOf()(5000)).toBe(true);
    install({ load: () => Promise.resolve([{ status: 'loaded' }]), forEach: () => { throw new Error('refused'); }, addEventListener: () => undefined, removeEventListener: () => undefined });
    expect(await fontsOf()(5000)).toBe(true);
  });
});

describe("relayout's 'fonts' run (the reader's first re-measure) and the host faces", () => {
  it('a measurement after a host face loads uses its metrics: the run for the faces waits for the host face, and the first one measures on the fallback', async () => {
    const sans = face('Docreader Host Sans');
    install(setOf([sans]));
    const root = mount();
    await enhance(root);
    const ctx = contextOf(root);
    if (ctx === undefined) throw new Error('no context');
    // What a listener measures: the host face's metrics once it has loaded, the fallback's before.
    const seen: { reasons: string[]; metrics: string }[] = [];
    ctx.onRelayout((reasons) => seen.push({ reasons: [...reasons], metrics: sans.status === 'loaded' ? 'host' : 'fallback' }));
    await tick(300);
    expect(
      seen.filter((s) => s.reasons.includes('fonts')),
      'no run for the faces while the host face is still loading',
    ).toEqual([]);
    sans.load();
    await tick(300);
    expect(seen.filter((s) => s.reasons.includes('fonts'))).toEqual([{ reasons: ['fonts'], metrics: 'host' }]);
  });

  it('with no host face the run for the faces comes as before', async () => {
    install(setOf([]));
    const root = mount();
    await enhance(root);
    const ctx = contextOf(root);
    if (ctx === undefined) throw new Error('no context');
    const seen: string[][] = [];
    ctx.onRelayout((reasons) => seen.push([...reasons]));
    await tick(300);
    expect(seen.some((r) => r.includes('fonts'))).toBe(true);
  });
});
