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
import { BRIDGE_LIMITS, COMMAND_OPS, DOC_FIELDS, type FrameToParent } from '../src/frame/protocol.js';
import { createAdapters, fromBridgeKey, toBridgeKey } from '../src/frame-runtime/adapters.js';
import { dispatchParentMessage, type DispatchTargets, type ReaderApi } from '../src/frame-runtime/dispatch.js';
import { checkVocabulary, contentIntrinsics, materialise, MISSING_CLASS } from '../src/frame-runtime/content.js';
import { FACES, FONT_WAIT_MS, probeFaces } from '../src/frame-runtime/fonts.js';
import { CHANGES_MAX_DELETIONS, CHANGES_MAX_RANGES, parseParentMessage } from '../src/frame-runtime/inbound.js';
import type { Outbox } from '../src/frame-runtime/outbox.js';
import { pinFreeGlobals, RESERVED_GLOBALS, reserveGlobals } from '../src/frame-runtime/pin.js';
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
      // The document's own listener (`add.call(doc, ...)`); the late insertion's, on the inserted element, is another site.
      if (ts.isCallExpression(n) && n.arguments[0]?.getText(sf) === 'doc' && n.arguments.some((a) => ts.isStringLiteral(a) && a.text === 'docserver:register') && /\badd\.call\b/.test(n.expression.getText(sf))) at['register']?.push(n.getStart(sf));
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

describe('BD5: reserveGlobals, the names Mermaid writes while it evaluates', () => {
  it('reserves the two names, in every mode (the build\'s allowlist is held equal to them in test/frame-build.test.ts)', () => {
    expect([...RESERVED_GLOBALS].sort()).toEqual(['fastdom', 'injected']);
  });

  it('defines an absent name as an own, writable, non-configurable property holding undefined; leaves an own one as it is', () => {
    const win = freshWindow();
    const w = win as unknown as Record<string, unknown>;
    w['ownThing'] = 7;
    const ownBefore = Object.getOwnPropertyDescriptor(win, 'ownThing');
    expect(Object.hasOwn(win, 'fastdom')).toBe(false);
    reserveGlobals(win, ['fastdom', 'injected', 'ownThing']);
    for (const name of ['fastdom', 'injected']) {
      expect(Object.getOwnPropertyDescriptor(win, name), name).toEqual({ value: undefined, writable: true, enumerable: false, configurable: false });
    }
    expect(Object.getOwnPropertyDescriptor(win, 'ownThing')).toEqual(ownBefore);
    expect(() => {
      Object.defineProperty(win, 'fastdom', { value: 1, configurable: true });
    }).toThrow(TypeError);
    expect(Reflect.deleteProperty(win, 'fastdom')).toBe(false);
  });

  it("an element with that id cannot stand in for it, and Mermaid's own writes still land (`??=` and `x = x || ...`)", () => {
    const win = freshWindow();
    const w = win as unknown as Record<string, unknown>;
    reserveGlobals(win, RESERVED_GLOBALS);
    for (const id of [...RESERVED_GLOBALS, 'docserverControl']) {
      const a = win.document.createElement('a');
      a.id = id;
      win.document.body.append(a);
    }
    // The control: an unreserved name is clobbered by its element; the reserved ones read undefined, not an element.
    expect(w['docserverControl']).toBe(win.document.getElementById('docserverControl'));
    expect(w['fastdom']).toBeUndefined();
    expect(w['injected']).toBeUndefined();
    expect(() => {
      'use strict';
      w['injected'] ??= { markdown: true };
    }).not.toThrow();
    expect(() => {
      'use strict';
      w['fastdom'] = w['fastdom'] ?? { read: 1 };
    }).not.toThrow();
    expect(w['injected']).toEqual({ markdown: true });
    expect(w['fastdom']).toEqual({ read: 1 });
  });

  it('without the reservation an element does stand in for the name (the control of the case above)', () => {
    const win = freshWindow();
    const w = win as unknown as Record<string, unknown>;
    const a = win.document.createElement('a');
    a.id = 'fastdom';
    win.document.body.append(a);
    expect(w['fastdom']).toBe(a);
  });

  it('the bootstrap reserves RESERVED_GLOBALS in Phase S: once, right after the pin, before the adapters, the listeners and any content', () => {
    const file = path.join(ROOT, 'src/frame-runtime/bootstrap.ts');
    const sf = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.ES2022, true);
    const at: Record<string, number[]> = { pin: [], reserve: [], adapters: [], register: [], start: [] };
    const visit = (n: ts.Node): void => {
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)) {
        if (n.expression.text === 'pinFreeGlobals') at['pin']?.push(n.getStart(sf));
        if (n.expression.text === 'reserveGlobals') {
          expect(n.arguments.map((a) => a.getText(sf))).toEqual(['win', 'RESERVED_GLOBALS']);
          at['reserve']?.push(n.getStart(sf));
        }
        if (n.expression.text === 'createAdapters') at['adapters']?.push(n.getStart(sf));
      }
      // The document's own listener (`add.call(doc, ...)`); the late insertion's, on the inserted element, is another site.
      if (ts.isCallExpression(n) && n.arguments[0]?.getText(sf) === 'doc' && n.arguments.some((a) => ts.isStringLiteral(a) && a.text === 'docserver:register') && /\badd\.call\b/.test(n.expression.getText(sf))) at['register']?.push(n.getStart(sf));
      if (ts.isCallExpression(n) && n.arguments.some((a) => ts.isStringLiteral(a) && a.text === 'DOMContentLoaded')) at['start']?.push(n.getStart(sf));
      ts.forEachChild(n, visit);
    };
    visit(sf);
    expect(at['pin']).toHaveLength(1);
    expect(at['reserve']).toHaveLength(1);
    expect(at['pin']?.[0]).toBeLessThan(at['reserve']?.[0] ?? -1);
    for (const k of ['adapters', 'register', 'start']) expect(at['reserve']?.[0], k).toBeLessThan(at[k]?.[0] ?? -1);
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

const ALL = { links: true, hash: true, copy: true, changes: true, versions: true, progress: true, places: false, printFigures: false, reader: false } as const;
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
    const a = createAdapters(box, { snapshot: [], bridge: { links: false, hash: false, copy: false, changes: false, versions: false, progress: false, places: false, printFigures: false, reader: false } });
    expect([a.onLink, a.onHash, a.copy, a.changes, a.openVersion, a.onProgress]).toEqual([undefined, undefined, undefined, undefined, undefined, undefined]);
    a.link('x.md');
    expect(sent).toEqual([]);
    expect(typeof a.storage.set).toBe('function');
  });
});

describe('B7.2 adapters: onProgress exists only when the seed\'s bridge asks for progress (batch 1.1, C108)', () => {
  it('progress false: no onProgress, whatever else the bridge allows (B7h)', () => {
    const { box, sent } = recordingOutbox();
    const a = createAdapters(box, { snapshot: [], bridge: { ...ALL, progress: false } });
    expect(a.onProgress).toBeUndefined();
    expect(a.onLink).toBeDefined();
    expect(sent).toEqual([]);
  });

  it("progress true: onProgress(share) sends the share in thousandths as a string, rounded and clamped to 0..1000", () => {
    const { box, sent } = recordingOutbox();
    const a = createAdapters(box, { snapshot: [], bridge: { ...ALL, progress: true } });
    for (const share of [0, 0.5, 1, 0.1234, 0.0004, 0.0005, 0.99949, 0.9996, -0.2, 3, 0.37]) a.onProgress?.(share);
    expect(sent).toEqual(['0', '500', '1000', '123', '0', '1', '999', '1000', '0', '1000', '370'].map((p) => ({ t: 'progress', p })));
  });

  it('a share that is not a finite number sends nothing', () => {
    const { box, sent } = recordingOutbox();
    const a = createAdapters(box, { snapshot: [], bridge: ALL });
    for (const bad of [NaN, Infinity, -Infinity, '0.5' as unknown as number, null as unknown as number, undefined as unknown as number]) a.onProgress?.(bad);
    expect(sent).toEqual([]);
  });

  it('a seed that predates the switch (no progress key) builds no onProgress', () => {
    const { box } = recordingOutbox();
    const a = createAdapters(box, { snapshot: [], bridge: { links: true, hash: true, copy: true, changes: true, versions: true } as never });
    expect(a.onProgress).toBeUndefined();
  });
});

describe("B7.4 the frame's port: a command reaches the reader, and a command that fails never stops the port (batch 1.1, C108)", () => {
  const file = path.join(ROOT, 'src/frame-runtime/bootstrap.ts');
  const source = readFileSync(file, 'utf8');
  const ROOT_EL = { id: 'root' };

  /** The reader's API as the dispatcher sees it, recording every call; `over` replaces members. */
  function reader(over: Partial<ReaderApi<typeof ROOT_EL>> = {}): { api: ReaderApi<typeof ROOT_EL>; calls: [string, unknown[]][] } {
    const calls: [string, unknown[]][] = [];
    const api: ReaderApi<typeof ROOT_EL> = {
      setEnhancementPrefs: (...a) => void calls.push(['prefs', a]),
      runEnhancementCommand: (...a) => (calls.push(['command', a]), true),
      ...over,
    };
    return { api, calls };
  }
  function targets(r: ReturnType<typeof reader> | null, root: typeof ROOT_EL | null = ROOT_EL) {
    const seen: string[] = [];
    return {
      seen,
      to: {
        root,
        api: r === null ? null : r.api,
        answer: (m: { sha: string }) => void seen.push(`answer ${m.sha.slice(0, 4)}`),
        offerMermaid: (m: { t: 'mermaid' }) => void seen.push(`mermaid ${m.t}`),
      } as DispatchTargets<typeof ROOT_EL>,
    };
  }
  const ANSWER = { t: 'changes.result', sha: SHA40, unavailable: true } as const;

  it("onPortMessage keeps the state check first, then the parser, then the dispatcher (structure)", () => {
    const sf = ts.createSourceFile(file, source, ts.ScriptTarget.ES2022, true);
    let found = 0;
    const visit = (n: ts.Node): void => {
      if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === 'onPortMessage' && n.initializer !== undefined) {
        const text = n.initializer.getText(sf);
        const at = (needle: string): number => text.indexOf(needle);
        expect(at("if (state !== 'settled' || mismatch) return;")).toBeGreaterThan(0);
        expect(at('parseParentMessage(')).toBeGreaterThan(at("if (state !== 'settled' || mismatch) return;"));
        expect(at('dispatchParentMessage(m,')).toBeGreaterThan(at('if (m === null) return;'));
        found += 1;
      }
      ts.forEachChild(n, visit);
    };
    visit(sf);
    expect(found).toBe(1);
  });

  it('a command runs the reader\'s runEnhancementCommand(root, name), once, with that root and name', () => {
    const r = reader();
    const t = targets(r);
    for (const name of ['jump', 'settings', 'contents', 'outline'] as const) dispatchParentMessage({ t: 'command', name }, t.to);
    expect(r.calls.map(([k]) => k)).toEqual(['command', 'command', 'command', 'command']);
    expect(r.calls.map(([, a]) => a)).toEqual(['jump', 'settings', 'contents', 'outline'].map((n) => [ROOT_EL, n]));
    expect((r.calls[0]?.[1] as unknown[])[0] === ROOT_EL).toBe(true);
  });

  it('goto hands the reader its id and from as a third argument; close-overlay and print-figures hand nothing more (ruling R1, P1h)', () => {
    const r = reader();
    const t = targets(r);
    dispatchParentMessage({ t: 'command', name: 'goto', id: 'heading-two' }, t.to);
    dispatchParentMessage({ t: 'command', name: 'goto', id: 'heading-two', from: '{"line":null,"offset":0,"y":0}' }, t.to);
    dispatchParentMessage({ t: 'command', name: 'close-overlay' }, t.to);
    dispatchParentMessage({ t: 'command', name: 'print-figures' }, t.to);
    expect(r.calls).toEqual([
      ['command', [ROOT_EL, 'goto', { id: 'heading-two' }]],
      ['command', [ROOT_EL, 'goto', { id: 'heading-two', from: '{"line":null,"offset":0,"y":0}' }]],
      ['command', [ROOT_EL, 'close-overlay']],
      ['command', [ROOT_EL, 'print-figures']],
    ]);
    // `from` is absent, not undefined, when the message had none; the two older arities are two arguments.
    expect(Object.hasOwn(r.calls[0]?.[1][2] as object, 'from')).toBe(false);
    expect(r.calls[2]?.[1]).toHaveLength(2);
    expect(r.calls[3]?.[1]).toHaveLength(2);
  });

  it('the older four commands still hand the reader two arguments: the root and the name', () => {
    const r = reader();
    const t = targets(r);
    for (const name of ['jump', 'settings', 'contents', 'outline'] as const) dispatchParentMessage({ t: 'command', name }, t.to);
    expect(r.calls.map(([, a]) => a.length)).toEqual([2, 2, 2, 2]);
  });

  it('the new commands are contained like the old: a throw changes nothing, and with no root, no API or no runEnhancementCommand they reach nothing', () => {
    const throwing = reader({ runEnhancementCommand: () => { throw new Error('boom'); } });
    for (const m of [{ t: 'command', name: 'goto', id: 'x' }, { t: 'command', name: 'close-overlay' }, { t: 'command', name: 'print-figures' }] as const) {
      expect(() => dispatchParentMessage(m, targets(throwing).to), m.name).not.toThrow();
      const r = reader();
      dispatchParentMessage(m, targets(r, null).to);
      expect(r.calls, `${m.name} without a root`).toEqual([]);
      expect(() => dispatchParentMessage(m, targets(null).to), `${m.name} without an API`).not.toThrow();
      const bare = reader({ runEnhancementCommand: undefined as never });
      expect(() => dispatchParentMessage(m, targets(bare).to), `${m.name} without the runner`).not.toThrow();
    }
  });

  it('a command that throws is contained, and the port keeps working: a later prefs, answer and mermaid still apply, and nothing is sent', () => {
    const r = reader({
      runEnhancementCommand: () => {
        throw new Error('boom');
      },
    });
    const t = targets(r);
    expect(() => dispatchParentMessage({ t: 'command', name: 'jump' }, t.to)).not.toThrow();
    dispatchParentMessage({ t: 'prefs', theme: 'dark' }, t.to);
    dispatchParentMessage(ANSWER, t.to);
    dispatchParentMessage({ t: 'mermaid', unavailable: true }, t.to);
    expect(r.calls).toEqual([['prefs', [ROOT_EL, { theme: 'dark' }]]]);
    expect(t.seen).toEqual(['answer aaaa', 'mermaid mermaid']);
  });

  it('a reader that never registered, or has no runEnhancementCommand, makes a command nothing: no throw, and later ops still apply', () => {
    const noApi = targets(null);
    expect(() => dispatchParentMessage({ t: 'command', name: 'jump' }, noApi.to)).not.toThrow();
    dispatchParentMessage(ANSWER, noApi.to);
    expect(noApi.seen).toEqual(['answer aaaa']);
    const oldCalls: [string, unknown[]][] = [];
    // A reader script that predates the commands: the API has no runEnhancementCommand at all.
    const old = { calls: oldCalls, api: { setEnhancementPrefs: (...a: unknown[]) => void oldCalls.push(['prefs', a]) } as ReaderApi<typeof ROOT_EL> };
    const t = targets(old);
    expect(() => dispatchParentMessage({ t: 'command', name: 'jump' }, t.to)).not.toThrow();
    dispatchParentMessage({ t: 'prefs', font: 'sans' }, t.to);
    expect(old.calls).toEqual([['prefs', [ROOT_EL, { font: 'sans' }]]]);
  });

  it('before the reader enhanced (no root) a command and a prefs reach nothing, and the reader is not called with a null root', () => {
    const r = reader();
    const t = targets(r, null);
    dispatchParentMessage({ t: 'command', name: 'jump' }, t.to);
    dispatchParentMessage({ t: 'prefs', theme: 'light' }, t.to);
    expect(r.calls).toEqual([]);
  });

  it("a prefs the reader refuses (a throw) leaves the port working too", () => {
    const r = reader({
      setEnhancementPrefs: () => {
        throw new Error('refused');
      },
    });
    const t = targets(r);
    expect(() => dispatchParentMessage({ t: 'prefs', theme: 'dark' }, t.to)).not.toThrow();
    dispatchParentMessage({ t: 'command', name: 'settings' }, t.to);
    expect(r.calls).toEqual([['command', [ROOT_EL, 'settings']]]);
  });

  it("adapters' onProgress goes to enhance's options only when it exists", () => {
    expect(source).toMatch(/\.\.\.\(adapters\.onProgress === undefined \? \{\} : \{ onProgress: adapters\.onProgress \}\)/);
  });

  describe('the appearance op reaches the reader (the appearance contract, Task 3)', () => {
    const APP = { mode: 'dark', colour: { bg: '#101010' }, label: 'x' } as const;

    it("appearance runs the reader's setEnhancementAppearance(root, value) once, with that root and that very value, and nothing else is called", () => {
      const calls: [string, unknown[]][] = [];
      const r = reader({ setEnhancementAppearance: (...a: unknown[]) => void calls.push(['appearance', a]) } as Partial<ReaderApi<typeof ROOT_EL>>);
      const t = targets(r);
      dispatchParentMessage({ t: 'appearance', v: 1, appearance: APP }, t.to);
      expect(calls).toHaveLength(1);
      expect(calls[0]?.[0]).toBe('appearance');
      expect((calls[0]?.[1] as unknown[])[0] === ROOT_EL).toBe(true);
      expect((calls[0]?.[1] as unknown[])[1] === APP).toBe(true);
      expect(r.calls).toEqual([]);
      expect(t.seen).toEqual([]);
    });

    it('a throw is contained and the port keeps working: a later prefs, command, answer and mermaid still apply, and nothing is sent', () => {
      const r = reader({
        setEnhancementAppearance: () => {
          throw new Error('boom');
        },
      } as Partial<ReaderApi<typeof ROOT_EL>>);
      const t = targets(r);
      expect(() => dispatchParentMessage({ t: 'appearance', v: 1, appearance: APP }, t.to)).not.toThrow();
      dispatchParentMessage({ t: 'prefs', theme: 'dark' }, t.to);
      dispatchParentMessage({ t: 'command', name: 'jump' }, t.to);
      dispatchParentMessage(ANSWER, t.to);
      dispatchParentMessage({ t: 'mermaid', unavailable: true }, t.to);
      expect(r.calls).toEqual([['prefs', [ROOT_EL, { theme: 'dark' }]], ['command', [ROOT_EL, 'jump']]]);
      expect(t.seen).toEqual(['answer aaaa', 'mermaid mermaid']);
    });

    it('before the reader enhanced (no root), with no reader API, or with a reader that predates the op, it reaches nothing and throws nothing', () => {
      const calls: unknown[] = [];
      const withOp = reader({ setEnhancementAppearance: (...a: unknown[]) => void calls.push(a) } as Partial<ReaderApi<typeof ROOT_EL>>);
      expect(() => dispatchParentMessage({ t: 'appearance', v: 1, appearance: APP }, targets(withOp, null).to)).not.toThrow();
      expect(() => dispatchParentMessage({ t: 'appearance', v: 1, appearance: APP }, targets(null).to)).not.toThrow();
      const old = reader();
      expect(() => dispatchParentMessage({ t: 'appearance', v: 1, appearance: APP }, targets(old).to)).not.toThrow();
      expect(calls).toEqual([]);
      expect(old.calls).toEqual([]);
    });

    it('the bootstrap hands the seed\'s fonts to loadHostFonts before enhance, contained, and passes the seed\'s appearance only when it has one', () => {
      expect(source).toMatch(/seed\.fonts !== undefined/);
      expect(source).toMatch(/loadHostFonts\?\.\(seed\.fonts\)/);
      expect(source.indexOf('loadHostFonts?.(seed.fonts)')).toBeLessThan(source.indexOf('await enhanceApi.enhance(root'));
      expect(source).toMatch(/\.\.\.\(seed\.appearance === undefined \? \{\} : \{ appearance: seed\.appearance \}\)/);
    });
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

  it("mermaid: exactly one of text (a string within the cap) or unavailable: true (B3.4)", () => {
    expect(parseParentMessage({ t: 'mermaid', text: '(function(){})();' })).toEqual({ t: 'mermaid', text: '(function(){})();' });
    expect(parseParentMessage({ t: 'mermaid', unavailable: true })).toEqual({ t: 'mermaid', unavailable: true });
    expect(parseParentMessage({ t: 'mermaid', text: '' })).toEqual({ t: 'mermaid', text: '' });
    for (const bad of [
      { t: 'mermaid' },
      { t: 'mermaid', text: 1 },
      { t: 'mermaid', text: null },
      { t: 'mermaid', text: ['x'] },
      { t: 'mermaid', unavailable: false },
      { t: 'mermaid', unavailable: 'true' },
      { t: 'mermaid', unavailable: 1 },
      { t: 'mermaid', text: 'x', unavailable: true },
      { t: 'mermaid', text: 'x', src: 'y' },
      { t: 'mermaid', unavailable: true, src: 'y' },
    ]) {
      expect(parseParentMessage(bad), JSON.stringify(bad)).toBeNull();
    }
  });

  it('mermaid: the text is capped at mermaidMaxChars UTF-16 code units, counted by length', () => {
    expect(BRIDGE_LIMITS.mermaidMaxChars).toBe(8_388_608);
    expect(parseParentMessage({ t: 'mermaid', text: 'a'.repeat(BRIDGE_LIMITS.mermaidMaxChars) })).not.toBeNull();
    expect(parseParentMessage({ t: 'mermaid', text: 'a'.repeat(BRIDGE_LIMITS.mermaidMaxChars + 1) })).toBeNull();
    // Code units, not code points or bytes: 4,194,305 astral characters are 8,388,610 code units.
    expect(parseParentMessage({ t: 'mermaid', text: '\u{1F600}'.repeat(BRIDGE_LIMITS.mermaidMaxChars / 2 + 1) })).toBeNull();
    expect(parseParentMessage({ t: 'mermaid', text: '\u{1F600}'.repeat(BRIDGE_LIMITS.mermaidMaxChars / 2) })).not.toBeNull();
  });

  it("mermaid: every parent-to-frame fixture of the op is judged as its verdict says, by the frame's own parser", () => {
    interface Case {
      label: string;
      direction: string;
      channel?: string;
      ports?: number;
      message: Record<string, unknown> | null;
      fill?: Record<string, { prefix?: string; unit: string; times: number; suffix?: string }>;
      verdict: 'accept' | 'refuse';
    }
    const cases = (JSON.parse(readText('conformance/bridge-cases.json')) as { messages: Case[] }).messages.filter(
      (c) => c.direction === 'parent-to-frame' && c.message?.['t'] === 'mermaid' && c.channel === 'port' && (c.ports ?? 0) === 0,
    );
    expect(cases.filter((c) => c.verdict === 'accept').length).toBeGreaterThanOrEqual(3);
    expect(cases.filter((c) => c.verdict === 'refuse').length).toBeGreaterThanOrEqual(8);
    for (const c of cases) {
      const m: Record<string, unknown> = { ...(c.message ?? {}) };
      for (const [k, f] of Object.entries(c.fill ?? {})) m[k] = `${f.prefix ?? ''}${f.unit.repeat(f.times)}${f.suffix ?? ''}`;
      const got = parseParentMessage(m);
      if (c.verdict === 'accept') expect(got, c.label).toEqual(m);
      else expect(got, c.label).toBeNull();
    }
  });

  it('command: exactly {name}, one of the four command names (B7a, B7b)', () => {
    for (const name of ['jump', 'settings', 'contents', 'outline']) expect(parseParentMessage({ t: 'command', name }), name).toEqual({ t: 'command', name });
    for (const bad of [
      { t: 'command' },
      { t: 'command', name: 'print' },
      { t: 'command', name: 'Jump' },
      { t: 'command', name: '' },
      { t: 'command', name: 'toString' },
      { t: 'command', name: 'constructor' },
      { t: 'command', name: 1 },
      { t: 'command', name: null },
      { t: 'command', name: ['jump'] },
      { t: 'command', name: 'jump', extra: 'x' },
      { t: 'command', name: 'jump', arg: 1 },
      Object.defineProperty({ t: 'command' }, 'name', { get: () => 'jump', enumerable: true }),
      JSON.parse('{"t":"command","name":"jump","__proto__":{}}') as unknown,
    ]) {
      expect(parseParentMessage(bad), JSON.stringify(bad)).toBeNull();
    }
  });

  it("command: every parent-to-frame fixture of the op is judged as its verdict says, by the frame's own parser (B7.1)", () => {
    interface Case {
      label: string;
      direction: string;
      channel?: string;
      ports?: number;
      message: Record<string, unknown> | null;
      fill?: Record<string, { prefix?: string; unit: string; times: number; suffix?: string }>;
      verdict: 'accept' | 'refuse';
    }
    const cases = (JSON.parse(readText('conformance/bridge-cases.json')) as { messages: Case[] }).messages.filter(
      (c) => c.direction === 'parent-to-frame' && c.message?.['t'] === 'command' && c.channel === 'port' && (c.ports ?? 0) === 0,
    );
    // One accepted case per name at least, goto's several: the names accepted are exactly COMMAND_OPS.
    const accepted = cases.filter((c) => c.verdict === 'accept');
    expect([...new Set(accepted.map((c) => c.message?.['name']))].sort()).toEqual([...COMMAND_OPS].sort());
    expect(accepted.length).toBeGreaterThanOrEqual(COMMAND_OPS.length);
    expect(cases.filter((c) => c.verdict === 'refuse').length).toBeGreaterThanOrEqual(3);
    // The case's message with its fills applied (bridge-cases.json's `about`).
    const filled = (c: Case): Record<string, unknown> | null => {
      if (c.message === null || c.fill === undefined) return c.message;
      const m = { ...c.message };
      for (const [k, f] of Object.entries(c.fill)) m[k] = `${f.prefix ?? ''}${f.unit.repeat(f.times)}${f.suffix ?? ''}`;
      return m;
    };
    for (const c of cases) {
      const got = parseParentMessage(filled(c));
      if (c.verdict === 'accept') expect(got, c.label).toEqual(filled(c));
      else expect(got, c.label).toBeNull();
    }
  });

  describe('command: close-overlay, goto and print-figures (docserver parity T1, ruling R1)', () => {
    const TOKEN_TEXT = '{"line":"12","offset":4,"y":300}';

    it('close-overlay and print-figures: exactly {name}; an id or a from on either is ignored (P1b)', () => {
      for (const name of ['close-overlay', 'print-figures'] as const) {
        expect(parseParentMessage({ t: 'command', name }), name).toEqual({ t: 'command', name });
        expect(parseParentMessage({ t: 'command', name, id: 'x' }), `${name} id`).toBeNull();
        expect(parseParentMessage({ t: 'command', name, from: TOKEN_TEXT }), `${name} from`).toBeNull();
        expect(parseParentMessage({ t: 'command', name, id: 'x', from: TOKEN_TEXT }), `${name} both`).toBeNull();
      }
    });

    it('the four older names take no id or from either', () => {
      for (const name of ['jump', 'settings', 'contents', 'outline']) {
        expect(parseParentMessage({ t: 'command', name, id: 'x' }), name).toBeNull();
        expect(parseParentMessage({ t: 'command', name, from: 'x' }), name).toBeNull();
      }
    });

    it('goto: an id by the fragment grammar, a from optional; the id is required (P1a)', () => {
      expect(parseParentMessage({ t: 'command', name: 'goto', id: 'heading-two' })).toEqual({ t: 'command', name: 'goto', id: 'heading-two' });
      expect(parseParentMessage({ t: 'command', name: 'goto', id: 'fnref1:1', from: TOKEN_TEXT })).toEqual({ t: 'command', name: 'goto', id: 'fnref1:1', from: TOKEN_TEXT });
      for (const bad of [
        { t: 'command', name: 'goto' },
        { t: 'command', name: 'goto', from: TOKEN_TEXT },
        { t: 'command', name: 'goto', id: undefined },
        { t: 'command', name: 'goto', id: '' },
        { t: 'command', name: 'goto', id: 'a b' },
        { t: 'command', name: 'goto', id: '#x' },
        { t: 'command', name: 'goto', id: 'a[b]' },
        { t: 'command', name: 'goto', id: 'x'.repeat(257) },
        { t: 'command', name: 'goto', id: 7 },
        { t: 'command', name: 'goto', id: null },
        { t: 'command', name: 'goto', id: ['x'] },
        { t: 'command', name: 'goto', id: 'x', push: 'true' },
        { t: 'command', name: 'goto', id: 'x', extra: 1 },
        Object.defineProperty({ t: 'command', name: 'goto' }, 'id', { get: () => 'x', enumerable: true }),
        Object.defineProperty({ t: 'command', name: 'goto', id: 'x' }, 'from', { get: () => TOKEN_TEXT, enumerable: true }),
      ]) {
        expect(parseParentMessage(bad), JSON.stringify(bad)).toBeNull();
      }
      expect(parseParentMessage({ t: 'command', name: 'goto', id: 'x'.repeat(256) })).toEqual({ t: 'command', name: 'goto', id: 'x'.repeat(256) });
    });

    it('goto: from is a string of at most 4096 code units, and nothing deeper (P1c, B4)', () => {
      const at = (n: number): unknown => ({ t: 'command', name: 'goto', id: 'x', from: 'z'.repeat(n) });
      expect(parseParentMessage(at(4096))).toEqual(at(4096));
      expect(parseParentMessage(at(4097))).toBeNull();
      expect(parseParentMessage(at(0))).toEqual(at(0));
      // Astral characters count twice, as code units: 2048 of them are 4096 units, 2049 are 4098.
      expect(parseParentMessage({ t: 'command', name: 'goto', id: 'x', from: '\u{1f600}'.repeat(2048) })).not.toBeNull();
      expect(parseParentMessage({ t: 'command', name: 'goto', id: 'x', from: '\u{1f600}'.repeat(2049) })).toBeNull();
      // The port parser does not read inside: a string that is no token passes, and the reader ignores it.
      expect(parseParentMessage({ t: 'command', name: 'goto', id: 'x', from: 'not a token' })).not.toBeNull();
      for (const from of [7, null, undefined, {}, ['x'], true]) {
        expect(parseParentMessage({ t: 'command', name: 'goto', id: 'x', from }), String(typeof from)).toBeNull();
      }
    });

    it('the bootstrap carries no copy of the anchor grammar: the parser reads the length of `from` and nothing else of it', () => {
      const text = readText('src/frame-runtime/inbound.ts').replace(/^\s*\/\/.*$/gm, '');
      expect(text).not.toMatch(/isAnchorToken|JSON\.parse|pngBytesOfBase64/);
    });
  });

  describe('appearance: exactly {t, v: 1, appearance}, appearance a plain object of own data properties (the outer shape only)', () => {
    const app = { mode: 'dark', colour: { bg: '#101010' }, label: 'x' };

    it('accepts a plain object, an empty one, a null-prototype one and a nested value of any shape (the reader judges the values)', () => {
      expect(parseParentMessage({ t: 'appearance', v: 1, appearance: app })).toEqual({ t: 'appearance', v: 1, appearance: app });
      expect(parseParentMessage({ t: 'appearance', v: 1, appearance: {} })).toEqual({ t: 'appearance', v: 1, appearance: {} });
      const bare = Object.assign(Object.create(null) as object, { mode: 'dark' });
      expect(parseParentMessage({ t: 'appearance', v: 1, appearance: bare })).not.toBeNull();
      expect(parseParentMessage({ t: 'appearance', v: 1, appearance: { mode: 7, colour: [1, 2], skin: null, what: { deep: { deeper: 1 } } } })).not.toBeNull();
      expect(parseParentMessage(structuredClone({ t: 'appearance', v: 1, appearance: app }))).toEqual({ t: 'appearance', v: 1, appearance: app });
    });

    it('the accepted value is the one the port carried, never a copy of a different shape', () => {
      const got = parseParentMessage({ t: 'appearance', v: 1, appearance: app });
      expect(got !== null && got.t === 'appearance' && got.appearance === app).toBe(true);
    });

    it('refuses a missing v, a v other than the number 1, a missing value, another key, and a value that is not a plain object', () => {
      for (const bad of [
        { t: 'appearance', appearance: app },
        { t: 'appearance', v: 2, appearance: app },
        { t: 'appearance', v: 0, appearance: app },
        { t: 'appearance', v: '1', appearance: app },
        { t: 'appearance', v: true, appearance: app },
        { t: 'appearance', v: 1 },
        { t: 'appearance', v: 1, appearance: app, extra: 1 },
        { t: 'appearance', v: 1, appearance: undefined },
        { t: 'appearance', v: 1, appearance: null },
        { t: 'appearance', v: 1, appearance: 'dark' },
        { t: 'appearance', v: 1, appearance: 1 },
        { t: 'appearance', v: 1, appearance: [] },
        { t: 'appearance', v: 1, appearance: [app] },
        { t: 'appearance', v: 1, appearance: new Map() },
        { t: 'appearance', v: 1, appearance: new Date(0) },
        { t: 'appearance', v: 1, appearance: Object.create({ mode: 'dark' }) as object },
        { t: 'appearance', v: 1, appearance: () => app },
      ]) {
        expect(parseParentMessage(bad), String(JSON.stringify(bad))).toBeNull();
      }
    });

    it('refuses a value holding a getter, a symbol key or a proto key, at its top level (a nested one is the reader\'s to judge)', () => {
      expect(parseParentMessage({ t: 'appearance', v: 1, appearance: Object.defineProperty({}, 'mode', { get: () => 'dark', enumerable: true }) })).toBeNull();
      expect(parseParentMessage({ t: 'appearance', v: 1, appearance: Object.defineProperty({}, 'mode', { get: () => 'dark', enumerable: false }) })).toBeNull();
      expect(parseParentMessage({ t: 'appearance', v: 1, appearance: { [Symbol('s')]: 1 } })).toBeNull();
      for (const key of ['__proto__', 'constructor', 'prototype']) {
        expect(parseParentMessage({ t: 'appearance', v: 1, appearance: JSON.parse(`{"${key}":{"x":1}}`) as unknown }), key).toBeNull();
      }
      expect(parseParentMessage({ t: 'appearance', v: 1, appearance: { colour: JSON.parse('{"__proto__":1}') as unknown } })).not.toBeNull();
    });

    it('refuses the op itself when it holds a getter, a proto key or is not plain', () => {
      expect(parseParentMessage(Object.defineProperty({ t: 'appearance', v: 1 }, 'appearance', { get: () => app, enumerable: true }))).toBeNull();
      expect(parseParentMessage(Object.defineProperty({ t: 'appearance', appearance: app }, 'v', { get: () => 1, enumerable: true }))).toBeNull();
      expect(parseParentMessage(JSON.parse('{"t":"appearance","v":1,"appearance":{},"__proto__":{}}') as unknown)).toBeNull();
    });

    it("every parent-to-frame fixture of the op is judged as its verdict says, by the frame's own parser", () => {
      interface Case {
        label: string;
        direction: string;
        channel?: string;
        ports?: number;
        message: Record<string, unknown> | null;
        verdict: 'accept' | 'refuse';
      }
      const cases = (JSON.parse(readText('conformance/bridge-cases.json')) as { messages: Case[] }).messages.filter(
        (c) => c.direction === 'parent-to-frame' && c.message?.['t'] === 'appearance' && c.channel === 'port' && (c.ports ?? 0) === 0,
      );
      expect(cases.filter((c) => c.verdict === 'accept').length).toBeGreaterThanOrEqual(3);
      expect(cases.filter((c) => c.verdict === 'refuse').length).toBeGreaterThanOrEqual(8);
      for (const c of cases) {
        const got = parseParentMessage(c.message);
        if (c.verdict === 'accept') expect(got, c.label).toEqual(c.message);
        else expect(got, c.label).toBeNull();
      }
    });
  });

  it('the accepted-t check reads FRAME_ACCEPTS, the parser\'s one list (no op name is written in the parser\'s own check)', () => {
    const text = readText('src/frame-runtime/inbound.ts').replace(/^\s*\/\/.*$/gm, '');
    expect(text).toContain('FRAME_ACCEPTS');
    expect(text).not.toMatch(/t !== 'prefs'/);
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
