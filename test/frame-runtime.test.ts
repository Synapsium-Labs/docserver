// @vitest-environment jsdom
// The frame runtime's parts, in jsdom and Node (docserver L3, Task 5; plan Reference §5.5, §6, §8): the closed content
// vocabulary and the materialisation (content.ts, vocabulary.ts and its generator; row L3.B10's unit half), the
// free-global pin (pin.ts, L3.M22), the face probe (fonts.ts, L3.M21), the enhance callbacks over the outbox
// (adapters.ts, the store key mapping of L3.B8) and the parent's messages on the port (inbound.ts). The browser rows
// are test/browser/frame-boot.test.ts; the outbox's pacing is test/frame-outbox.test.ts.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { MAX_DELETIONS, MAX_RANGES } from '../src/enhance/changes.js';
import { BRIDGE_LIMITS, DOC_FIELDS, type FrameToParent } from '../src/frame/protocol.js';
import { createAdapters, fromBridgeKey, toBridgeKey } from '../src/frame-runtime/adapters.js';
import { checkVocabulary, contentIntrinsics, materialise, MISSING_CLASS } from '../src/frame-runtime/content.js';
import { FACES, FONT_WAIT_MS, probeFaces } from '../src/frame-runtime/fonts.js';
import { CHANGES_MAX_DELETIONS, CHANGES_MAX_RANGES, parseParentMessage } from '../src/frame-runtime/inbound.js';
import type { Outbox } from '../src/frame-runtime/outbox.js';
import { pinFreeGlobals } from '../src/frame-runtime/pin.js';
import { INPUT_ATTRIBUTES, STYLE_VALUE_SOURCE, VOCABULARY_ATTRIBUTES, VOCABULARY_TAGS } from '../src/frame-runtime/vocabulary.js';
import { render } from '../src/render/index.js';

// A path, not a URL: in the jsdom environment the global URL is the DOM's, which fs and fileURLToPath refuse.
const ROOT = path.join(import.meta.dirname, '..');
const readText = (rel: string): string => readFileSync(path.join(ROOT, rel), 'utf8');

const parseHtml = (html: string): Document => new DOMParser().parseFromString(html, 'text/html');

describe('L3.B10 (unit half): the closed vocabulary, generated from render() over the corpus', () => {
  it('the committed vocabulary.ts equals a fresh scan: `node scripts/gen-frame-vocabulary.mjs --check` exits 0', () => {
    // A child process: the generator bundles render() with esbuild, which refuses jsdom's TextEncoder.
    const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'gen-frame-vocabulary.mjs'), '--check'], { encoding: 'utf8', timeout: 120_000 });
    expect({ status: r.status, stderr: r.stderr }).toEqual({ status: 0, stderr: '' });
  }, 120_000);

  it('the lists hold no `name` attribute, no `on...` attribute, and none of embed, form, iframe or object', () => {
    expect(VOCABULARY_ATTRIBUTES).not.toContain('name');
    expect(VOCABULARY_ATTRIBUTES.filter((a) => /^on/i.test(a))).toEqual([]);
    for (const t of ['embed', 'form', 'iframe', 'object']) expect(VOCABULARY_TAGS).not.toContain(t);
    // The lists are render()'s own: a task list's checkbox, a table cell's alignment, a details' open.
    for (const t of ['details', 'summary', 'input', 'section', 'sup', 'a', 'h4', 'h6']) expect(VOCABULARY_TAGS).toContain(t);
    for (const a of ['open', 'style', 'checked', 'disabled', 'type', 'href', 'id']) expect(VOCABULARY_ATTRIBUTES).toContain(a);
    expect(STYLE_VALUE_SOURCE).toBe('^text-align:(?:left|right|center)$');
    expect([...INPUT_ATTRIBUTES].sort()).toEqual(['checked', 'class', 'disabled', 'type']);
  });

  it('every golden and hostile corpus output is accepted, `<details open>` and task lists included', () => {
    const manifest = JSON.parse(readText('conformance/manifest.json')) as { id: string; kind: string; options?: object }[];
    let opens = 0;
    let boxes = 0;
    let aligned = 0;
    const refused: string[] = [];
    for (const e of manifest.filter((x) => x.kind !== 'generated')) {
      const r = render(readText(`conformance/corpus/${e.id}.md`), e.options ?? {});
      if (r.outcome !== 'rendered') continue;
      const doc = parseHtml(r.html);
      const check = checkVocabulary(doc);
      if (!check.ok) refused.push(`${e.id}: ${check.why}`);
      opens += doc.querySelectorAll('details[open]').length;
      boxes += doc.querySelectorAll('input[type=checkbox][disabled]').length;
      aligned += doc.querySelectorAll('[style]').length;
    }
    expect(refused).toEqual([]);
    expect(opens).toBeGreaterThan(0);
    expect(boxes).toBeGreaterThan(0);
    expect(aligned).toBeGreaterThan(0);
  });

  it("h4 to h6, which the corpus lacks, are accepted (the oracle's TAGS joined in)", () => {
    const r = render('#### four\n\n##### five\n\n###### six\n');
    if (r.outcome !== 'rendered') throw new Error(r.outcome);
    expect(checkVocabulary(parseHtml(r.html))).toEqual({ ok: true });
  });

  const PLANTED: readonly (readonly [string, string])[] = [
    ['<script>', '<p>a</p><script>x()</script>'],
    ['<iframe>', '<p><iframe></iframe></p>'],
    ['<img onerror>', '<p><img src="a" alt="b" onerror="x()"></p>'],
    ['style="position:fixed"', '<p style="position:fixed">a</p>'],
    ['a table cell style other than its alignment', '<table><tbody><tr><td style="text-align:left;position:fixed">a</td></tr></tbody></table>'],
    ['<base>', '<base href="https://example.com/"><p>a</p>'],
    ['<form>', '<form><p>a</p></form>'],
    ['<meta>', '<meta http-equiv="refresh" content="0"><p>a</p>'],
    ['<object>', '<object></object>'],
    ['<embed>', '<embed>'],
    ['<img name=x>', '<p><img src="a" alt="b" name="x"></p>'],
    ['<a name=x>', '<p><a name="x" href="#y">a</a></p>'],
    ['<svg>', '<p><svg><a href="x"><text>a</text></a></svg></p>'],
    ['a comment', '<p>a<!-- x --></p>'],
    ['a comment before the html', '<!-- x --><p>a</p>'],
    ['an unknown tag', '<p><blink>a</blink></p>'],
    ['an unknown attribute', '<p data-docreader-chrome="">a</p>'],
    ['an input that is not a disabled checkbox', '<ul><li><input type="text" disabled></li></ul>'],
    ['an enabled checkbox', '<ul><li><input type="checkbox"></li></ul>'],
    ['a checkbox with a value', '<ul><li><input type="checkbox" disabled value="x"></li></ul>'],
    ['an attribute on the body', '<body onload="x()"><p>a</p></body>'],
    ['a doctype', '<!doctype html><p>a</p>'],
    ['<template>', '<template><p>a</p></template>'],
    ['<style>', '<style>p{}</style><p>a</p>'],
    ['<link>', '<link rel="stylesheet" href="x"><p>a</p>'],
  ];
  for (const [name, html] of PLANTED) {
    it(`refuses ${name}`, () => {
      const check = checkVocabulary(parseHtml(html));
      expect(check.ok).toBe(false);
    });
  }

  it('accepts the same documents without the planted part (the refusals above are the parts, not the shapes)', () => {
    for (const html of ['<p>a</p>', '<ul><li><input type="checkbox" disabled checked class="task-list-item-checkbox"></li></ul>', '<details open><summary>s</summary><p>a</p></details>', '<table><tbody><tr><td style="text-align:center">a</td></tr></tbody></table>', '<p><img src="a" alt="b"></p>']) {
      expect(checkVocabulary(parseHtml(html)), html).toEqual({ ok: true });
    }
  });
});

describe('materialise: inert parse, vocabulary, images, the article root', () => {
  const fresh = (): Document => document.implementation.createHTMLDocument('');
  it('adopts the content into an article root with lang; an image in the map gets its data URL, srcset dropped; a miss becomes the chip', () => {
    const doc = fresh();
    const gif = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
    const root = materialise(doc, '<h1 id="t">T</h1><p><img src="a.png" alt="A"><img src="b.png" alt="B"></p>', 'de', new Map([['a.png', gif]]), contentIntrinsics());
    expect(root.localName).toBe('article');
    expect(root.getAttribute('lang')).toBe('de');
    expect(root.parentNode).toBe(doc.body);
    const imgs = Array.from(root.querySelectorAll('img'), (i) => i.getAttribute('src'));
    expect(imgs).toEqual([gif]);
    const chip = root.querySelector(`span.${MISSING_CLASS}`);
    expect(chip?.hasAttribute('data-docreader-chrome')).toBe(true);
    expect(chip?.textContent).toBe('B Image not loaded');
    expect(chip?.querySelector('a')?.getAttribute('href')).toBe('b.png');
  });

  it('a document outside the vocabulary throws and adopts nothing', () => {
    const doc = fresh();
    expect(() => materialise(doc, '<p>a</p><script>x()</script>', 'en', new Map(), contentIntrinsics())).toThrow();
    expect(doc.body.childNodes.length).toBe(0);
  });
});

/** A window of its own: an iframe's, in the jsdom environment's document. */
function freshWindow(): Window {
  const f = document.createElement('iframe');
  document.body.append(f);
  const w = f.contentWindow;
  if (w === null) throw new Error('no iframe window');
  return w;
}

describe('L3.M22: pinFreeGlobals', () => {
  it('pins an absent and an inherited name as own non-writable, non-configurable properties; leaves an own one; an id cannot change them', () => {
    const win = freshWindow();
    const w = win as unknown as Record<string, unknown>;
    w['ownThing'] = 7;
    const ownBefore = Object.getOwnPropertyDescriptor(win, 'ownThing');
    const inherited = w['addEventListener'];
    expect(Object.hasOwn(win, 'addEventListener')).toBe(false);
    expect(Object.hasOwn(win, 'docserverAbsent')).toBe(false);
    pinFreeGlobals(win, ['docserverAbsent', 'addEventListener', 'ownThing']);
    expect(Object.getOwnPropertyDescriptor(win, 'docserverAbsent')).toEqual({ value: undefined, writable: false, enumerable: false, configurable: false });
    expect(Object.getOwnPropertyDescriptor(win, 'addEventListener')).toEqual({ value: inherited, writable: false, enumerable: false, configurable: false });
    expect(Object.getOwnPropertyDescriptor(win, 'ownThing')).toEqual(ownBefore);
    // Elements named after them: the pinned names keep what they read; an unpinned name is clobbered (the control).
    for (const id of ['docserverAbsent', 'addEventListener', 'docserverControl']) {
      const a = win.document.createElement('a');
      a.id = id;
      win.document.body.append(a);
    }
    expect(w['docserverControl']).toBe(win.document.getElementById('docserverControl'));
    expect(w['docserverAbsent']).toBeUndefined();
    expect(w['addEventListener']).toBe(inherited);
    expect(() => {
      'use strict';
      w['docserverAbsent'] = 1;
    }).toThrow(TypeError);
  });

  it('the bootstrap pins the build\'s list in Phase S: once, before the adapters, the listeners and any content', () => {
    const file = path.join(ROOT, 'src/frame-runtime/bootstrap.ts');
    const sf = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.ES2022, true);
    const at: Record<string, number[]> = { pin: [], adapters: [], register: [], start: [] };
    const visit = (n: ts.Node): void => {
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)) {
        if (n.expression.text === 'pinFreeGlobals') {
          expect(n.arguments.map((a) => a.getText(sf))).toEqual(['win', 'DOCSERVER_FREE_GLOBALS']);
          at['pin']?.push(n.getStart(sf));
        }
        if (n.expression.text === 'createAdapters') at['adapters']?.push(n.getStart(sf));
      }
      if (ts.isCallExpression(n) && n.arguments.some((a) => ts.isStringLiteral(a) && a.text === 'docserver:register') && /\badd\.call\b/.test(n.expression.getText(sf))) at['register']?.push(n.getStart(sf));
      if (ts.isCallExpression(n) && n.arguments.some((a) => ts.isStringLiteral(a) && a.text === 'DOMContentLoaded')) at['start']?.push(n.getStart(sf));
      ts.forEachChild(n, visit);
    };
    visit(sf);
    expect(Object.fromEntries(Object.entries(at).map(([k, v]) => [k, v.length]))).toEqual({ pin: 1, adapters: 1, register: 1, start: 1 });
    const [pin] = at['pin'] ?? [];
    for (const k of ['adapters', 'register', 'start']) expect(pin, k).toBeLessThan(at[k]?.[0] ?? -1);
  });

  it('an empty list pins nothing', () => {
    const win = freshWindow();
    const before = Object.getOwnPropertyNames(win).length;
    pinFreeGlobals(win, []);
    expect(Object.getOwnPropertyNames(win).length).toBe(before);
  });
});

describe('L3.M21: the face probe', () => {
  it('loads each of the four faces the frame CSS declares once: serif and sans, normal and italic', async () => {
    const css = readText('assets/reader.css');
    const declared = [...css.matchAll(/@font-face \{ font-family: "(Docreader (?:Serif|Sans))"; font-style: (normal|italic);/g)].map((m) => `${m[2] ?? ''} ${m[1] ?? ''}`);
    expect(declared.sort()).toEqual(['italic Docreader Sans', 'italic Docreader Serif', 'normal Docreader Sans', 'normal Docreader Serif']);
    expect(FACES.map((f) => f.replace(/ 400 1em "([^"]+)"$/, ' $1')).sort()).toEqual(declared);
    const asked: string[] = [];
    await probeFaces({ load: (f: string) => (asked.push(f), Promise.resolve([])) }, FACES, FONT_WAIT_MS);
    expect(asked).toEqual([...FACES]);
    expect(FONT_WAIT_MS).toBe(1500);
  });

  it('is bounded by its wait: loads that never settle end it at the bound; a rejecting load is not an error', async () => {
    // Read through a flag, never awaited: a probe with no bound, or one that ignores `ms`, is an assertion here, not a
    // test that hangs until its timeout.
    const t0 = performance.now();
    let settledAt: number | null = null;
    void probeFaces({ load: () => new Promise<never>(() => undefined) }, FACES, 80).then(() => {
      settledAt = performance.now() - t0;
    });
    await new Promise((r) => setTimeout(r, 600));
    expect(settledAt).not.toBeNull();
    expect(settledAt ?? -1).toBeGreaterThanOrEqual(70);
    expect(settledAt ?? Infinity).toBeLessThan(600);
    await expect(probeFaces({ load: () => Promise.reject(new Error('blocked')) }, FACES, 80)).resolves.toBeUndefined();
    await expect(probeFaces(null, FACES, 80)).resolves.toBeUndefined();
  });

  it('the bootstrap runs the probe with FACES and FONT_WAIT_MS after enhance and before the state becomes SETTLED', () => {
    const file = path.join(ROOT, 'src/frame-runtime/bootstrap.ts');
    const sf = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.ES2022, true);
    const probes: number[] = [];
    const settles: number[] = [];
    const enhances: number[] = [];
    const visit = (n: ts.Node): void => {
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'probeFaces') {
        expect(n.arguments.map((a) => a.getText(sf)).slice(1)).toEqual(['FACES', 'FONT_WAIT_MS']);
        probes.push(n.getStart(sf));
      }
      if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === 'enhance') enhances.push(n.getStart(sf));
      if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken && n.left.getText(sf) === 'state' && n.right.getText(sf) === "'settled'") settles.push(n.getStart(sf));
      ts.forEachChild(n, visit);
    };
    visit(sf);
    expect(probes).toHaveLength(1);
    expect(settles).toHaveLength(1);
    expect(enhances).toHaveLength(1);
    expect(enhances[0]).toBeLessThan(probes[0] as number);
    expect(probes[0]).toBeLessThan(settles[0] as number);
  });
});

/** An outbox that records what the adapters hand it. */
function recordingOutbox(): { box: Outbox; sent: FrameToParent[]; copies: string[]; asked: string[] } {
  const sent: FrameToParent[] = [];
  const copies: string[] = [];
  const asked: string[] = [];
  const box: Outbox = {
    send: (op) => sent.push(op),
    copy: (text) => (copies.push(text), true),
    changes: (sha) => (asked.push(sha), Promise.resolve({ changed: [[1, 1]] as const })),
    answer: () => undefined,
    open: () => undefined,
    dispose: () => undefined,
  };
  return { box, sent, copies, asked };
}

const ALL = { links: true, hash: true, copy: true, changes: true, versions: true } as const;
const SHA40 = 'a'.repeat(40);

describe('adapters: the enhance callbacks over the outbox (Reference §8.1, §8.3; row L3.B8 unit half)', () => {
  it('maps L2 keys to bridge keys and back: pref:prefs, pref:ui, doc:pos and doc:<DOC_FIELDS>; anything else is dropped', () => {
    expect(toBridgeKey('docreader:prefs')).toBe('pref:prefs');
    expect(toBridgeKey('docreader:ui')).toBe('pref:ui');
    expect(toBridgeKey('docreader:pos:doc')).toBe('doc:pos');
    for (const f of DOC_FIELDS.filter((x) => x !== 'pos')) expect(toBridgeKey(`docreader:doc:doc:${f}`)).toBe(`doc:${f}`);
    for (const k of ['docreader:doc:doc:pos', 'docreader:doc:doc:nope', 'docreader:pos:other', 'docreader:doc:other:folds', 'other:prefs', 'docreader:prefs:x', 'docreader:doc:doc:', '']) {
      expect(toBridgeKey(k), k).toBeNull();
    }
    expect(fromBridgeKey('pref:prefs')).toBe('docreader:prefs');
    expect(fromBridgeKey('doc:pos')).toBe('docreader:pos:doc');
    expect(fromBridgeKey('doc:folds')).toBe('docreader:doc:doc:folds');
  });

  it('storage: the snapshot in L2 keys; set sends store.set with the bridge key, the literal null for a delete, and drops other keys and oversize values', () => {
    const { box, sent } = recordingOutbox();
    const a = createAdapters(box, { snapshot: [['pref:prefs', '{"theme":"dark"}'], ['doc:pos', '{"y":1}'], ['doc:folds', '[]']], bridge: ALL });
    expect(a.storage.snapshot).toEqual({ 'docreader:prefs': '{"theme":"dark"}', 'docreader:pos:doc': '{"y":1}', 'docreader:doc:doc:folds': '[]' });
    expect(Object.getPrototypeOf(a.storage.snapshot)).toBeNull();
    a.storage.set('docreader:prefs', '{"theme":"light"}');
    a.storage.set('docreader:doc:doc:marks', null);
    a.storage.set('docreader:other', '1');
    a.storage.set('docreader:ui', `"${'x'.repeat(BRIDGE_LIMITS.valueMaxBytes)}"`);
    a.storage.set('docreader:ui', 'not json');
    expect(sent).toEqual([
      { t: 'store.set', key: 'pref:prefs', value: '{"theme":"light"}' },
      { t: 'store.set', key: 'doc:marks', value: 'null' },
    ]);
  });

  it('links: only a sendable href, newTab dropped; the guard link goes to the same sink', () => {
    const { box, sent } = recordingOutbox();
    const a = createAdapters(box, { snapshot: [], bridge: ALL });
    a.onLink?.('a.md', { newTab: true });
    a.link('b.md');
    a.onLink?.('', { newTab: false });
    a.onLink?.('x'.repeat(BRIDGE_LIMITS.hrefMaxChars + 1), { newTab: false });
    a.onLink?.('a\u0085b', { newTab: false });
    a.onLink?.('x'.repeat(BRIDGE_LIMITS.hrefMaxChars), { newTab: false });
    expect(sent).toEqual([{ t: 'navigate', href: 'a.md' }, { t: 'navigate', href: 'b.md' }, { t: 'navigate', href: 'x'.repeat(BRIDGE_LIMITS.hrefMaxChars) }]);
  });

  it('hash: only an id inside the grammar; null, push and from are not sent', () => {
    const { box, sent } = recordingOutbox();
    const a = createAdapters(box, { snapshot: [], bridge: ALL });
    a.onHash?.('fnref1:1', { push: true, from: 'tok' });
    a.onHash?.(null, { push: false, from: null });
    a.onHash?.('a b', { push: false, from: null });
    a.onHash?.('', { push: false, from: null });
    expect(sent).toEqual([{ t: 'hash', id: 'fnref1:1' }]);
  });

  it('version: null keys omitted, full shas only; {} back to the latest', () => {
    const { box, sent } = recordingOutbox();
    const a = createAdapters(box, { snapshot: [], bridge: ALL });
    a.openVersion?.({ sha: SHA40, only: null });
    a.openVersion?.({ sha: null, only: SHA40 });
    a.openVersion?.({ sha: null, only: null });
    a.openVersion?.({ sha: 'abc1234', only: null });
    expect(sent).toEqual([{ t: 'version', sha: SHA40 }, { t: 'version', only: SHA40 }, { t: 'version' }]);
  });

  it('copy: at most 65,536 UTF-8 bytes, else it rejects; a copy the outbox refuses rejects', async () => {
    const { box, copies } = recordingOutbox();
    const a = createAdapters(box, { snapshot: [], bridge: ALL });
    await expect(a.copy?.('é'.repeat(BRIDGE_LIMITS.copyMaxBytes / 2))).resolves.toBeUndefined();
    await expect(a.copy?.('é'.repeat(BRIDGE_LIMITS.copyMaxBytes / 2) + 'x')).rejects.toThrow();
    expect(copies).toHaveLength(1);
    const refusing = createAdapters({ ...box, copy: () => false }, { snapshot: [], bridge: ALL });
    await expect(refusing.copy?.('x')).rejects.toThrow();
  });

  it('changes: a short or upper-case sha resolves null locally; a full one goes to the outbox', async () => {
    const { box, asked } = recordingOutbox();
    const a = createAdapters(box, { snapshot: [], bridge: ALL });
    await expect(a.changes?.('abc1234')).resolves.toBeNull();
    await expect(a.changes?.('A'.repeat(40))).resolves.toBeNull();
    await expect(a.changes?.(SHA40)).resolves.toEqual({ changed: [[1, 1]] });
    expect(asked).toEqual([SHA40]);
  });

  it('each callback exists only when the seed\'s bridge allows it; storage always does', () => {
    const { box, sent } = recordingOutbox();
    const a = createAdapters(box, { snapshot: [], bridge: { links: false, hash: false, copy: false, changes: false, versions: false } });
    expect([a.onLink, a.onHash, a.copy, a.changes, a.openVersion]).toEqual([undefined, undefined, undefined, undefined, undefined]);
    a.link('x.md');
    expect(sent).toEqual([]);
    expect(typeof a.storage.set).toBe('function');
  });
});

describe('parseParentMessage: what the frame accepts on the port (Reference §6.5, §8.2)', () => {
  it('prefs: each value from its enum, each optional', () => {
    expect(parseParentMessage({ t: 'prefs', theme: 'dark', width: 'wide', font: 'sans' })).toEqual({ t: 'prefs', theme: 'dark', width: 'wide', font: 'sans' });
    expect(parseParentMessage({ t: 'prefs' })).toEqual({ t: 'prefs' });
    expect(parseParentMessage({ t: 'prefs', theme: 'blue' })).toBeNull();
    expect(parseParentMessage({ t: 'prefs', lens: 'product' })).toBeNull();
  });

  it('changes.result: ranges with an optional removedAfter, or unavailable; a full sha', () => {
    expect(parseParentMessage({ t: 'changes.result', sha: SHA40, ranges: [[1, 2]] })).toEqual({ t: 'changes.result', sha: SHA40, ranges: [[1, 2]] });
    expect(parseParentMessage({ t: 'changes.result', sha: SHA40, ranges: [], removedAfter: [3] })).toEqual({ t: 'changes.result', sha: SHA40, ranges: [], removedAfter: [3] });
    expect(parseParentMessage({ t: 'changes.result', sha: SHA40, unavailable: true })).toEqual({ t: 'changes.result', sha: SHA40, unavailable: true });
    for (const bad of [
      { t: 'changes.result', sha: 'abc', ranges: [] },
      { t: 'changes.result', sha: SHA40 },
      { t: 'changes.result', sha: SHA40, unavailable: false },
      { t: 'changes.result', sha: SHA40, unavailable: true, ranges: [] },
      { t: 'changes.result', sha: SHA40, ranges: 'x' },
      { t: 'changes.result', sha: SHA40, ranges: [[1]] },
      { t: 'changes.result', sha: SHA40, ranges: [[1, 'x']] },
      { t: 'changes.result', sha: SHA40, ranges: [], removedAfter: ['x'] },
      { t: 'changes.result', sha: SHA40, ranges: [], extra: 1 },
    ]) {
      expect(parseParentMessage(bad), JSON.stringify(bad)).toBeNull();
    }
  });

  it('changes.result: a pair or a removedAfter with a hole is malformed, as it arrives on a port (structured clone keeps holes)', () => {
    const holey = new Array<number>(2);
    const partial = [1, 2];
    delete partial[0];
    const gap = new Array<number>(1);
    for (const bad of [
      { t: 'changes.result', sha: SHA40, ranges: [holey] },
      { t: 'changes.result', sha: SHA40, ranges: [partial] },
      { t: 'changes.result', sha: SHA40, ranges: [[1, 2]], removedAfter: gap },
    ]) {
      const cloned: unknown = structuredClone(bad);
      expect(parseParentMessage(cloned), JSON.stringify(bad)).toBeNull();
    }
  });

  it("changes.result: counts are capped at L2's own caps before any element is read; a huge sparse array is refused at once", () => {
    expect([CHANGES_MAX_RANGES, CHANGES_MAX_DELETIONS]).toEqual([MAX_RANGES, MAX_DELETIONS]);
    const pairs = (n: number): [number, number][] => Array.from({ length: n }, () => [1, 1] as [number, number]);
    expect(parseParentMessage({ t: 'changes.result', sha: SHA40, ranges: pairs(MAX_RANGES) })).not.toBeNull();
    expect(parseParentMessage({ t: 'changes.result', sha: SHA40, ranges: pairs(MAX_RANGES + 1) })).toBeNull();
    const after = (n: number): number[] => Array.from({ length: n }, () => 1);
    expect(parseParentMessage({ t: 'changes.result', sha: SHA40, ranges: [], removedAfter: after(MAX_DELETIONS) })).not.toBeNull();
    expect(parseParentMessage({ t: 'changes.result', sha: SHA40, ranges: [], removedAfter: after(MAX_DELETIONS + 1) })).toBeNull();
    const t0 = performance.now();
    expect(parseParentMessage({ t: 'changes.result', sha: SHA40, ranges: new Array(2 ** 32 - 1) })).toBeNull();
    expect(parseParentMessage({ t: 'changes.result', sha: SHA40, ranges: [], removedAfter: new Array(2 ** 32 - 1) })).toBeNull();
    expect(performance.now() - t0).toBeLessThan(1000);
  });

  it('ignores hello, a frame op, an unknown op, a non-plain object, a prototype key and a getter', () => {
    for (const bad of [
      { t: 'hello', v: 1 },
      { t: 'ready', v: 1, nonce: 'x' },
      { t: 'nope' },
      null,
      'prefs',
      [],
      Object.assign(Object.create({ t: 'prefs' }) as object),
      JSON.parse('{"t":"prefs","__proto__":{}}') as unknown,
      Object.defineProperty({ t: 'prefs' }, 'theme', { get: () => 'dark', enumerable: true }),
    ]) {
      expect(parseParentMessage(bad)).toBeNull();
    }
  });
});
