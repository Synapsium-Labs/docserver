// Level 2 of the conformance corpus (§3.5; docserver L2, Task 6): each case under conformance/layout/ is rendered,
// enhanced in a real browser under the strict policy, and its structural snapshot compared with the case's
// expected file, in every selected browser against the one file. A case also loads nothing it is not served,
// reaches no other origin, and reports no policy violation. UPDATE_LAYOUT=1 writes the expected files.
//
// DOM clobbering: headings and `<!-- id:X -->` anchors whose ids are the layout's chrome classes (jump, keys,
// xcard, toc-contents), prototype keys (__proto__, constructor, toString) or the root's mark. The hostile case
// core/clobbering pins its snapshot, folds stored by those ids included; and the same document with every such id
// renamed must give the same snapshot, so no lookup of the layout depends on what an id is called.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { closeBrowsers, describeBrowsers, openDoc, type OpenHow } from './harness.js';
import { compareOrWrite, loadLayoutCases, parseCaseFile, type LayoutCase } from './layout-cases.js';

const UPDATE = process.env['UPDATE_LAYOUT'] === '1';
const CASES = loadLayoutCases();

/** The ids core/clobbering gives its headings and anchors. */
const CLOBBERING = ['jump', 'keys', 'xcard', 'toc-contents', '__proto__', 'constructor', 'toString', 'data-docreader-root'];

afterAll(closeBrowsers);

function how(c: LayoutCase): Omit<OpenHow, 'browser'> {
  return { ...(c.viewport === undefined ? {} : { viewport: c.viewport }), ...(c.csp === undefined ? {} : { csp: c.csp }) };
}

describe('the Level 2 cases', () => {
  it('the core cases are present, and core/clobbering is hostile', () => {
    expect(CASES.map((c) => c.id)).toEqual(expect.arrayContaining(['core/clobbering', 'core/editorial', 'core/folds', 'core/tables']));
    expect(CASES.find((c) => c.id === 'core/clobbering')?.hostile).toBe(true);
  });

  it('an options file is checked: unknown keys, an empty or bad scope, and wrong types are refused', () => {
    const ok = { options: {}, scope: ['byline', '[hidden]'] };
    expect(parseCaseFile('a/b', JSON.stringify(ok))).toEqual({ options: {}, scope: ['byline', '[hidden]'], hostile: false, viewport: undefined, csp: undefined });
    const refused: [unknown, string][] = [
      [{ ...ok, extra: 1 }, 'unknown keys ["extra"]'],
      [{ ...ok, options: [] }, '"options" must be an object'],
      [{ ...ok, scope: [] }, '"scope" must be a non-empty list'],
      [{ ...ok, scope: ['.byline'] }, '"scope" must be a non-empty list'],
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
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describeBrowsers((browser) => {
  for (const c of CASES) {
    it(c.id, async () => {
      const doc = await openDoc(c.markdown, c.options, { browser, ...how(c) });
      try {
        const snap = await doc.snapshot(c.scope);
        expect([await doc.violations(), doc.aborted, doc.missing]).toEqual([[], [], []]);
        const verdict = compareOrWrite(snap, c.expected, UPDATE);
        if (verdict === 'missing') expect.fail(`${c.id}: no expected file; write it with UPDATE_LAYOUT=1`);
        if (verdict === 'differs') expect(snap).toBe(readFileSync(c.expected, 'utf8'));
      } finally {
        await doc.close();
      }
    });
  }

  it('DOM clobbering: the same document with those ids renamed gives the same snapshot, and the page is clobbered', async () => {
    const c = CASES.find((x) => x.id === 'core/clobbering');
    if (c === undefined) throw new Error('core/clobbering is missing');
    const renamed = new Map(CLOBBERING.map((n, i) => [n, `n-${String(i)}`]));
    const swap = (text: string): string => text.replace(/ id="([^"]*)"/g, (all, id: string) => (renamed.has(id) ? ` id="${renamed.get(id) ?? ''}"` : all));
    const stored = JSON.stringify(
      (['__proto__', 'jump', 'toString'] as const).map((n) => renamed.get(n)),
    );
    const a = await openDoc(c.markdown, c.options, { browser, ...how(c) });
    const b = await openDoc(
      c.markdown,
      { ...c.options, storage: { snapshot: { 'docreader:doc:case:folds': stored } } },
      { browser, ...how(c), html: swap },
    );
    try {
      expect(await b.snapshot(c.scope)).toBe(await a.snapshot(c.scope));
      // The ids really do clobber the page: a named property of the window finds the elements by each plain name
      // (a heading and its anchor share each id, so the window answers with a collection of the two).
      const clobbered = await a.page.evaluate(
        (names) => names.filter((n) => (window as unknown as Record<string, unknown>)[n] instanceof HTMLCollection),
        CLOBBERING,
      );
      expect(clobbered).toEqual(['jump', 'keys', 'xcard', 'toc-contents', 'data-docreader-root']);
    } finally {
      await a.close();
      await b.close();
    }
  });
});
