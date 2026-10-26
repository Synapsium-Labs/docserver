// Level 2 of the conformance corpus (§3.5; docserver L2, Task 6): each case under conformance/layout/ is rendered,
// enhanced in a real browser under the strict policy, and its structural snapshot compared with the case's
// expected file, in every selected browser against the one file. A case also loads nothing it is not served,
// reaches no other origin, and reports no policy violation. UPDATE_LAYOUT=1 (exactly) writes the expected files,
// each once per run: the first browser writes it and every later one is held to it.
//
// DOM clobbering: ids named like the reference layout's chrome classes, which later tasks build (jump, keys, xcard,
// toc-contents), prototype keys (__proto__, constructor, toString) or the root's mark. Two hostile cases pin their
// snapshots, folds stored by those ids included: core/clobbering gives each name to a heading and its anchor, and
// core/anchors to an anchor alone, under headings with other ids. The same document with every such id renamed
// must give the same snapshot, so no lookup of the layout depends on what an id is called; and enhance() leaves
// Object.prototype's own names as they were.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { closeBrowsers, describeBrowsers, openDoc, type BrowserName, type OpenHow } from './harness.js';
import {
  compareOrWrite,
  holdClean,
  holdSnapshot,
  loadLayoutCases,
  parseCaseFile,
  snapshotHold,
  updateRequested,
  type LayoutCase,
} from './layout-cases.js';

const UPDATE = updateRequested(process.env);
const CASES = loadLayoutCases();
const hold = snapshotHold(UPDATE);

/** The ids the two clobbering cases give their headings and anchors. */
const CLOBBERING = ['jump', 'keys', 'xcard', 'toc-contents', '__proto__', 'constructor', 'toString', 'data-docreader-root'];

/** The hostile cases that use those ids. */
const CLOBBERED = ['core/anchors', 'core/clobbering'];

const FOLDS_KEY = 'docreader:doc:case:folds';

const CUE_SCOPES: Readonly<Record<string, number>> = {
  'diagram-tools/cluster-internal-shapes': 2,
  'diagram-tools/edge-label': 1,
  'diagram-tools/flowchart-link-data-id': 1,
  'diagram-tools/node-id': 1,
};

interface CueState {
  readonly targets: number;
  readonly boxes: readonly { readonly width: number; readonly height: number }[];
  readonly rings: readonly number[];
  readonly dots: readonly number[];
}

function cueState(): CueState | null {
  return document.querySelector('main[data-harness-root]') === null ? null : (() => {
    const targets = Array.from(document.querySelectorAll<SVGGElement>('main[data-harness-root] figure svg g.dnode'));
    return {
      targets: targets.length,
      boxes: targets.map((target) => {
        const box = target.getBBox();
        return { width: box.width, height: box.height };
      }),
      rings: targets.map((target) => target.querySelectorAll(':scope > .dn-ring').length),
      dots: targets.map((target) => target.querySelectorAll(':scope > .dn-dot').length),
    };
  })();
}

async function waitForCues(c: LayoutCase, doc: Awaited<ReturnType<typeof openDoc>>): Promise<void> {
  const expected = CUE_SCOPES[c.id];
  if (expected === undefined) return;
  try {
    await doc.page.waitForFunction((count) => {
      const targets = Array.from(document.querySelectorAll<SVGGElement>('main[data-harness-root] figure svg g.dnode'));
      return targets.length === count
        && targets.every((target) => {
          const box = target.getBBox();
          return box.width > 0 && box.height > 0
            && target.querySelectorAll(':scope > .dn-ring').length === 1
            && target.querySelectorAll(':scope > .dn-dot').length === 1;
        });
    }, expected);
  } catch (error) {
    const state = await doc.page.evaluate(cueState);
    throw new Error(`${c.id}: definition cues not ready ${JSON.stringify(state)}`, { cause: error });
  }
}

afterAll(closeBrowsers);

function how(c: LayoutCase): Omit<OpenHow, 'browser'> {
  return { ...(c.viewport === undefined ? {} : { viewport: c.viewport }), ...(c.csp === undefined ? {} : { csp: c.csp }) };
}

/** One case in one browser: the page is clean (holdClean), then its snapshot is held to the expected file. */
async function runCase(c: LayoutCase, browser: BrowserName, holdIt: (id: string, actual: string, expected: string) => void): Promise<void> {
  const doc = await openDoc(c.markdown, c.options, { browser, ...how(c) });
  try {
    await waitForCues(c, doc);
    const snap = await doc.snapshot(c.scope);
    holdClean(c.id, { violations: await doc.violations(), aborted: doc.aborted, missing: doc.missing });
    holdIt(c.id, snap, c.expected);
  } finally {
    await doc.close();
  }
}

describe('the Level 2 cases', () => {
  it('the core cases are present, and the two clobbering cases are hostile', () => {
    expect(CASES.map((c) => c.id)).toEqual(expect.arrayContaining(['core/anchors', 'core/clobbering', 'core/editorial', 'core/folds', 'core/tables']));
    for (const id of CLOBBERED) expect(CASES.find((c) => c.id === id)?.hostile).toBe(true);
  });

  it('the expected files are written only when UPDATE_LAYOUT is exactly "1", and this run reads it so', () => {
    for (const v of [undefined, '', '0', 'true', 'yes', ' 1', '1 ']) expect(updateRequested({ UPDATE_LAYOUT: v })).toBe(false);
    expect(updateRequested({})).toBe(false);
    expect(updateRequested({ UPDATE_LAYOUT: '1' })).toBe(true);
    expect(UPDATE).toBe(process.env['UPDATE_LAYOUT'] === '1');
  });

  it('an options file is checked: unknown keys, an empty or bad scope, and wrong types are refused', () => {
    const ok = { options: {}, scope: ['byline', '[hidden]'] };
    expect(parseCaseFile('a/b', JSON.stringify(ok))).toEqual({ options: {}, scope: ['byline', '[hidden]'], hostile: false, viewport: undefined, csp: undefined });
    const refused: [unknown, string][] = [
      [{ ...ok, extra: 1 }, 'unknown keys ["extra"]'],
      [{ ...ok, options: [] }, '"options" must be an object'],
      [{ ...ok, scope: [] }, '"scope" must be a non-empty list'],
      [{ ...ok, scope: ['.byline'] }, '"scope" must be a non-empty list'],
      [{ ...ok, scope: ['byline', 'H2[x]'] }, '"scope" must be a non-empty list'],
      [{ ...ok, scope: 'byline' }, '"scope" must be a non-empty list'],
      [{ ...ok, viewport: { width: 390, height: 844, depth: 1 } }, '"viewport" must be { width, height }'],
      [{ ...ok, viewport: { width: 0, height: 844 } }, '"viewport" must be { width, height }'],
      [{ ...ok, viewport: { width: 390, height: 4001 } }, '"viewport" must be { width, height }'],
      [{ ...ok, hostile: false }, '"hostile" is true or absent'],
      [{ ...ok, viewport: { width: 390 } }, '"viewport" must be { width, height }'],
      [{ ...ok, viewport: { width: 390, height: 1.5 } }, '"viewport" must be { width, height }'],
      [{ ...ok, csp: 'none' }, '"csp" is "strict" or "reader"'],
      ['[]', 'options file is not an object'],
    ];
    for (const [raw, message] of refused) {
      expect(() => parseCaseFile('a/b', typeof raw === 'string' ? raw : JSON.stringify(raw))).toThrow(`layout case a/b: ${message}`);
    }
    expect(() => parseCaseFile('a/b', '{')).toThrow('layout case a/b: options file is not JSON');
  });

  it('a case directory holds whole cases only, and the expected file is written only on request', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'docserver-layout-'));
    try {
      mkdirSync(path.join(dir, 'x'));
      writeFileSync(path.join(dir, 'x', 'a.md'), '# A\n');
      expect(() => loadLayoutCases(dir)).toThrow('layout case x/a: no a.options.json');
      writeFileSync(path.join(dir, 'x', 'a.options.json'), '{"options":{},"scope":["byline"]}');
      writeFileSync(path.join(dir, 'x', 'stray.dom.txt'), '');
      expect(() => loadLayoutCases(dir)).toThrow('layout case file x/stray.dom.txt belongs to no case');
      rmSync(path.join(dir, 'x', 'stray.dom.txt'));
      const [c] = loadLayoutCases(dir);
      expect(c?.id).toBe('x/a');
      const file = c?.expected ?? '';
      expect(compareOrWrite('one\n', file, false)).toBe('missing');
      expect(compareOrWrite('one\n', file, true)).toBe('written');
      expect(compareOrWrite('one\n', file, false)).toBe('same');
      expect(compareOrWrite('two\n', file, false)).toBe('differs');
      expect(readFileSync(file, 'utf8')).toBe('one\n');
      // The runner's hold: equal passes, a moved snapshot fails, a missing file fails, and nothing is written.
      expect(() => holdSnapshot('x/a', 'one\n', file, false)).not.toThrow();
      expect(() => holdSnapshot('x/a', 'two\n', file, false)).toThrow('x/a: the snapshot moved');
      rmSync(file);
      expect(() => holdSnapshot('x/a', 'one\n', file, false)).toThrow('x/a: no expected file; write it with UPDATE_LAYOUT=1');
      expect(existsSync(file)).toBe(false);
      // One update run, two browsers: the first writes the file, the second is held to it, never writes over it.
      const run = snapshotHold(true);
      run('x/a', 'one\n', file);
      expect(readFileSync(file, 'utf8')).toBe('one\n');
      expect(() => run('x/a', 'two\n', file)).toThrow('x/a: the snapshot moved');
      expect(readFileSync(file, 'utf8')).toBe('one\n');
      expect(() => snapshotHold(false)('x/a', 'two\n', file)).toThrow('x/a: the snapshot moved');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('a case page that was refused something, reached another origin or asked for an unserved file fails', () => {
    const clean = { violations: [], aborted: [], missing: [] };
    expect(() => holdClean('x/a', clean)).not.toThrow();
    for (const got of [{ ...clean, violations: ['style-src'] }, { ...clean, aborted: ['https://elsewhere.example/'] }, { ...clean, missing: ['/nope.css'] }]) {
      expect(() => holdClean('x/a', got)).toThrow('x/a: the page was refused something');
    }
  });
});

describeBrowsers((browser) => {
  for (const c of CASES) {
    it(c.id, async () => {
      await runCase(c, browser, hold);
    });
  }

  it('a case whose page is refused something fails, whatever its snapshot', async () => {
    const refused: LayoutCase = {
      id: 'x/refused',
      markdown: '# A\n\n![an image](/nope.png)\n',
      options: {},
      scope: ['x'],
      hostile: false,
      viewport: undefined,
      csp: undefined,
      expected: path.join(tmpdir(), 'docserver-layout-never-written.dom.txt'),
    };
    await expect(runCase(refused, browser, () => undefined)).rejects.toThrow('x/refused: the page was refused something');
  });

  for (const id of CLOBBERED) {
    it(`DOM clobbering, ${id}: the ids renamed give the same snapshot, the page is clobbered, and no prototype gains a name`, async () => {
      const c = CASES.find((x) => x.id === id);
      if (c === undefined) throw new Error(`${id} is missing`);
      const renamed = new Map(CLOBBERING.map((n, i) => [n, `n-${String(i)}`]));
      const swap = (text: string): string => text.replace(/ id="([^"]*)"/g, (all, name: string) => (renamed.has(name) ? ` id="${renamed.get(name) ?? ''}"` : all));
      const storage = (c.options['storage'] ?? {}) as { snapshot?: Record<string, string> };
      const stored = JSON.parse(storage.snapshot?.[FOLDS_KEY] ?? '[]') as string[];
      const options = { ...c.options, storage: { snapshot: { [FOLDS_KEY]: JSON.stringify(stored.map((n) => renamed.get(n) ?? n)) } } };
      const a = await openDoc(c.markdown, c.options, { browser, ...how(c), enhance: false });
      try {
        const names = (): Promise<string[]> => a.page.evaluate(() => Object.getOwnPropertyNames(Object.prototype).sort());
        const before = await names();
        await a.enhance();
        expect(await names()).toEqual(before);
        const b = await openDoc(c.markdown, options, { browser, ...how(c), html: swap });
        try {
          expect(await b.snapshot(c.scope)).toBe(await a.snapshot(c.scope));
        } finally {
          await b.close();
        }
        // The ids really do clobber the page: a named property of the window finds the element (or, where a heading
        // and its anchor share the id, the collection of the two) by each name that is not already the window's own.
        const clobbered = await a.page.evaluate(
          (list) => list.filter((n) => {
            const v = (window as unknown as Record<string, unknown>)[n];
            return v instanceof Element || v instanceof HTMLCollection;
          }),
          CLOBBERING,
        );
        expect(clobbered).toEqual(['jump', 'keys', 'xcard', 'toc-contents', 'data-docreader-root']);
      } finally {
        await a.close();
      }
    });
  }
});
