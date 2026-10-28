// Reader chrome collisions in Chromium (L2, Task 24). The fixture gives each stable
// chrome class to both an authored heading and explicit authored anchor. A task-local AST
// extraction covers the frozen chrome factories; state-only and source-authored classes stay
// excluded. L3 bootstrap names have no frozen implementation yet, so are not invented here.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import ts from 'typescript';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { closeBrowsers, describeBrowsers, openDoc, type BrowserName, type OpenedDoc } from './harness.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

// These are L2's stable classes created by reader chrome. Keep this list next to its fixture:
// removing a name makes the source identity census fail before browser interaction can mask it.
const REQUIRED_CHROME_CLASSES = [
  'aa-btn', 'aa-btns', 'aa-key', 'aa-kh', 'aa-menu', 'aa-note', 'aa-wrap',
  'bar-tools', 'box', 'byline', 'c', 'cap-text', 'cd', 'cell-br', 'cell-bullet',
  'chg-menu', 'chg-nav', 'chg-pick', 'chg-trig', 'ckey', 'cm-d', 'cm-days',
  'cm-days-wrap', 'cm-group', 'cm-hint', 'cm-item', 'cm-lab', 'cm-main', 'cm-more',
  'cm-n', 'cm-only', 'cm-s', 'cm-st', 'cm-t', 'cn', 'cnt', 'count', 'ct-caret',
  'ct-label', 'dn-dot', 'dn-ring', 'doc-facts', 'doc-progress', 'doc-toc', 'dot',
  'eyebrow', 'fact', 'facts-body', 'fig-error', 'fig-no', 'fig-overlay', 'fig-render', 'fig-render-btn', 'fig-src',
  'fn-m', 'fn-s', 'fn-t', 'fo-bar', 'fo-btns', 'fo-cap', 'fo-stage', 'fold-note',
  'fs-k', 'gt', 'h-anchor', 'h-ctl', 'h-fold', 'hide', 'ic', 'item-arrow',
  'item-link', 'ix', 'ix-group', 'jk', 'jt', 'jump', 'jump-btn', 'jump-hint', 'kb',
  'keys', 'keys-btn', 'kh', 'kh2', 'lbl', 'linkish', 'mermaid', 'meta', 'mk', 'none',
  'opt', 'outline-btn', 'peek-bar', 'peek-btn', 'pill', 'pill-wrap', 'review-strip',
  'rid', 'rlink', 'rs-facts', 'rs-label', 'rs-notice', 'rs-wait', 'rtitle',
  'rule-head', 'running-head', 'sec-no', 'seg', 'sep', 'skip-link', 'stand-index',
  'step-no', 'step-rest', 't', 'task-id', 'task-open', 'tbl-tools', 'term', 'tmeta',
  'toc-btn', 'toc-contents', 'toc-foot', 'toc-index', 'toc-panel', 'toc-scrim',
  'toc-tabs', 'tools', 'topbar', 'topbar-inner', 'vb-long', 'vb-short', 'ver-back',
  'ver-banner', 'ver-show', 'what', 'who', 'wide', 'xcard', 'xc-body', 'xc-def',
  'xc-foot', 'xc-go', 'xc-head', 'xc-id', 'xc-k', 'xc-row', 'xc-src', 'xc-term',
  'xc-title', 'xc-v', 'xref',
  'sw', 'k-nav', 'k-term', 'k-id', 'k-wait', 'k-chg', 'k-no', 'k-ok', 'k-info', 'k-code',
  'b', 'cell-line', 'cols-2', 'lvl', 'cm-row', 'yours',
  'short', 'callout', 'agreed', 'waiting', 'later', 'other', 'fo-out', 'fo-in', 'fo-fit', 'fo-close',
  'id', 'tbl-block', 'tmeta', 'ix-id', 'h-mark', 'info', 'no', 'ok', 'wait', 'wide',
] as const;

const AUTHOR_IDS = [...new Set(REQUIRED_CHROME_CLASSES)].sort();

const CHROME_SOURCE_FILES = [
  'attention', 'bar', 'cards', 'changes', 'diagrams', 'diagram-tools', 'editorial', 'figures',
  'folds', 'glossary', 'headctl', 'jump', 'keysheet', 'marks', 'plans', 'position', 'rail',
  'rules', 'settings', 'since', 'status', 'strip', 'tables', 'text', 'xrefs',
] as const;
const ENHANCE_DIR = fileURLToPath(new URL('../../src/enhance/', import.meta.url));
const CHROME_ATTR = 'data-docreader-chrome';
const AUTHOR_SELECTOR = 'h2, span.doc-anchor';

/** Task-local AST extraction of chrome() class construction, including its finite role unions. */
function createdChromeClasses(): Set<string> {
  const names = new Set<string>();
  const vocab = readFileSync(`${ENHANCE_DIR}vocab.ts`, 'utf8');
  const union = (name: string): string[] => {
    const body = new RegExp(`export type ${name} = ([^;]+);`).exec(vocab)?.[1];
    if (body === undefined) throw new Error(`vocab: ${name} declaration missing`);
    return [...body.matchAll(/'([^']+)'/g)].map((match) => match[1] as string);
  };
  const roles = union('StatusRole');
  const addWords = (text: string): void => {
    for (const name of text.split(/\s+/)) if (name !== '' && !name.endsWith('-')) names.add(name);
  };
  const classWords = (file: string, expr: ts.Expression): void => {
    if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) addWords(expr.text);
    else if (ts.isTemplateExpression(expr)) {
      addWords(expr.head.text);
      for (const span of expr.templateSpans) {
        if (ts.isIdentifier(span.expression) && ['role', 'status', 'c'].includes(span.expression.text)) roles.forEach((name) => names.add(name));
        addWords(span.literal.text);
      }
    } else if (ts.isConditionalExpression(expr)) {
      classWords(file, expr.whenTrue);
      classWords(file, expr.whenFalse);
    } else if (ts.isIdentifier(expr) && expr.text === 'cls' && file === 'editorial') {
      addWords('short callout agreed waiting later other');
    } else if (ts.isIdentifier(expr) && expr.text === 'cls' && file === 'diagram-tools') {
      addWords('fo-out fo-in fo-fit fo-close');
    } else throw new Error(`${file}: unread chrome class expression ${expr.getText()}`);
  };
  for (const file of CHROME_SOURCE_FILES) {
    const source = ts.createSourceFile(`${file}.ts`, readFileSync(`${ENHANCE_DIR}${file}.ts`, 'utf8'), ts.ScriptTarget.ES2022, true);
    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'chrome') {
        const init = node.arguments[2];
        const readInit = (value: ts.Expression): void => {
          if (ts.isConditionalExpression(value)) {
            readInit(value.whenTrue);
            readInit(value.whenFalse);
          } else if (ts.isObjectLiteralExpression(value)) {
            for (const property of value.properties) {
              if (ts.isPropertyAssignment(property) && ts.isIdentifier(property.name) && property.name.text === 'className') classWords(file, property.initializer);
            }
          } else throw new Error(`${file}: unread chrome initializer ${value.getText()}`);
        };
        if (init !== undefined) readInit(init);
      }
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
        && node.expression.name.text === 'setAttribute' && node.arguments.length === 2) {
        const attribute = node.arguments[0];
        if (attribute !== undefined && ts.isStringLiteral(attribute) && attribute.text === 'class') {
          const value = node.arguments[1];
          if (value === undefined || !ts.isStringLiteral(value)) throw new Error(`${file}: unread SVG class setter`);
          addWords(value.text);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  for (const role of roles) names.add(role);
  for (const role of union('ColourRole')) names.add(`k-${role}`);
  names.add('sw');
  return names;
}

const CREATED_CHROME_CLASSES = createdChromeClasses();

function expectCensusAnchors(): void {
  expect(CREATED_CHROME_CLASSES).toEqual(new Set(REQUIRED_CHROME_CLASSES));
  expect(new Set(AUTHOR_IDS)).toEqual(CREATED_CHROME_CLASSES);
}

async function expectSourceIdentity(doc: OpenedDoc): Promise<void> {
  const state = await doc.page.evaluate(() => {
    const fixture = window as unknown as BrowserFixture;
    const allowed = new Set(['role', 'aria-label', 'aria-expanded', 'aria-describedby', 'aria-description', 'hidden', 'tabindex']);
    for (const { root, refs } of fixture.__chromeClobberingSources) for (const { node, id, attrs, texts } of refs) {
      if (!node.isConnected || !root.contains(node) || node.id !== id || node.hasAttribute('data-docreader-chrome')) return { ok: false, why: `node:${id}` };
      for (const [name, value] of attrs) if (!allowed.has(name) && node.getAttribute(name) !== value) return { ok: false, why: `attr:${id}:${name}` };
      for (const { node: text, data } of texts) if (!text.isConnected || !node.contains(text) || text.data !== data) return { ok: false, why: `text:${id}` };
    }
    return { ok: true, why: '' };
  });
  expect(state).toEqual({ ok: true, why: '' });
}
const ENTRY = [
  "import { destroyEnhancement, enhance } from './src/enhance/index.ts';",
  '(window as unknown as { __chromeClobbering: unknown }).__chromeClobbering = { destroyEnhancement, enhance };',
].join('\n');

let script = '';

beforeAll(async () => {
  const bundle = await build({
    stdin: { contents: ENTRY, resolveDir: ROOT, sourcefile: 'chrome-clobbering-entry.ts', loader: 'ts' },
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    target: 'es2022',
    logLevel: 'silent',
  });
  script = bundle.outputFiles[0]?.text ?? '';
});

afterAll(closeBrowsers);

/** A real document plus a paired explicit anchor for every collision name. */
const MARKDOWN = [
  '# Chrome collision fixture',
  '',
  '**Spec** · 2026-10-25 · Status: Draft',
  '',
  '## In short',
  '',
  '| ID | Status | Decision |',
  '| --- | --- | --- |',
  '| D1 | Agreed | A source row lets the reader make a real preview link. |',
  '',
  'The first source mention of D1 opens a preview card.',
  '',
  ...AUTHOR_IDS.flatMap((name) => [`## ${name}`, '', `<!-- id:${name} -->`, '', `Author identity ${name}.`, '']),
].join('\n');

interface ReaderShape {
  readonly author: readonly { readonly id: string; readonly heading: number; readonly anchor: number; readonly chrome: boolean }[];
  readonly chrome: readonly { readonly tag: string; readonly classes: string; readonly id: string | null; readonly idIssued: boolean }[];
  readonly rawChromeIds: readonly string[];
  readonly prototype: readonly string[];
}

interface BrowserReader {
  enhance(root: HTMLElement, options: unknown): Promise<void>;
  destroyEnhancement(root: HTMLElement): Promise<void>;
}

interface SourceRef {
  readonly node: HTMLElement;
  readonly id: string;
  readonly attrs: readonly [string, string][];
  readonly texts: readonly { readonly node: Text; readonly data: string }[];
}

interface BrowserFixture extends Window {
  __chromeClobbering: BrowserReader;
  __chromeClobberingSources: readonly { readonly root: HTMLElement; readonly refs: readonly SourceRef[] }[];
}

function renamedHtml(html: string): string {
  const renamed = new Map<string, string>(AUTHOR_IDS.map((name, index) => [name, `renamed-${String(index)}`]));
  return html.replace(/ id="([^"]*)"/g, (all, id: string) => renamed.has(id) ? ` id="${renamed.get(id) ?? ''}"` : all);
}

function options(): Record<string, unknown> {
  return { rules: true };
}

async function openPair(browser: BrowserName, renamed: boolean): Promise<{ readonly doc: OpenedDoc; readonly prototypeBefore: readonly string[] }> {
  const doc = await openDoc(MARKDOWN, options(), {
    browser,
    viewport: { width: 390, height: 844 },
    enhance: false,
    html: (html) => {
      const page = renamed ? renamedHtml(html) : html;
      return `${page}</main><main data-second-root>${page}</main>`;
    },
  });
  try {
    await doc.page.evaluate(script);
    const prototypeBefore = await doc.page.evaluate(() => Object.getOwnPropertyNames(Object.prototype).sort());
    await doc.page.evaluate(({ names, authorSelector }) => {
      const win = window as unknown as BrowserFixture;
      const roots = Array.from(document.querySelectorAll<HTMLElement>('main[data-harness-root], main[data-second-root]'));
      if (roots.length !== 2) throw new Error('fixture did not create two reader roots');
      win.__chromeClobberingSources = roots.map((root) => ({
        root,
        refs: names.flatMap((id) => Array.from(root.querySelectorAll<HTMLElement>(authorSelector)).filter((node) => node.id === id).map((node) => ({
          node,
          id: node.id,
          attrs: Array.from(node.attributes, (attribute) => [attribute.name, attribute.value] as [string, string]),
          texts: Array.from(node.childNodes).filter((child): child is Text => child.nodeType === Node.TEXT_NODE).map((text) => ({ node: text, data: text.data })),
        }))),
      }));
    }, { names: renamed ? AUTHOR_IDS.map((_, index) => `renamed-${String(index)}`) : AUTHOR_IDS, authorSelector: AUTHOR_SELECTOR });
    await doc.page.evaluate(async () => {
      const reader = (window as unknown as BrowserFixture).__chromeClobbering;
      await Promise.all((window as unknown as BrowserFixture).__chromeClobberingSources.map(({ root }) => reader.enhance(root, { rules: true })));
    });
    return { doc, prototypeBefore };
  } catch (error) {
    await doc.close();
    throw error;
  }
}

async function shape(doc: OpenedDoc, rootSelector: string, reverse: ReadonlyMap<string, string>): Promise<ReaderShape> {
  return doc.page.evaluate(({ rootSelector: selector, names, reverseIds, chromeAttr, authorSelector }) => {
    const root = document.querySelector(selector) as HTMLElement | null;
    if (root === null) throw new Error(`missing root ${selector}`);
    const reverse = new Map(reverseIds);
    const idOf = (id: string): string => reverse.get(id) ?? id;
    const author = names.map((name) => {
      const nodes = Array.from(root.querySelectorAll<HTMLElement>(authorSelector)).filter((node) => idOf(node.id) === name && !node.hasAttribute(chromeAttr));
      return { id: name, heading: nodes.filter((node) => node.localName === 'h2').length, anchor: nodes.filter((node) => node.matches('span.doc-anchor')).length, chrome: false };
    });
    const chrome = Array.from(root.querySelectorAll<HTMLElement>(`[${chromeAttr}]`)).map((node) => ({
      tag: node.localName,
      classes: Array.from(node.classList).sort().join(' '),
      id: node.id === '' ? null : node.id.replace(/^docreader\.\d+\./, 'docreader.#.'),
      idIssued: node.id === '' || /^docreader\.\d+\./.test(node.id),
    }));
    const rawChromeIds = Array.from(root.querySelectorAll<HTMLElement>(`[${chromeAttr}][id]`)).map((node) => node.id);
    return { author, chrome, rawChromeIds, prototype: Object.getOwnPropertyNames(Object.prototype).sort() };
  }, { rootSelector, names: AUTHOR_IDS, reverseIds: [...reverse], chromeAttr: CHROME_ATTR, authorSelector: AUTHOR_SELECTOR });
}

async function exerciseOwnership(doc: OpenedDoc): Promise<void> {
  const result = await doc.page.evaluate(() => {
    const roots = Array.from(document.querySelectorAll<HTMLElement>('main[data-harness-root], main[data-second-root]'));
    for (const root of roots) {
      const button = root.querySelector<HTMLButtonElement>('.toc-btn');
      const scrim = root.querySelector<HTMLElement>('.toc-scrim');
      const keys = root.querySelector<HTMLButtonElement>('.keys-btn');
      if (button === null || scrim === null || keys === null) throw new Error('missing reader interaction control');
      button.click();
      if (!root.classList.contains('toc-open') || roots.some((other) => other !== root && other.classList.contains('toc-open'))) throw new Error('drawer did not stay root-local');
      scrim.click();
      keys.click();
      if (root.querySelector('.keys')?.classList.contains('open') !== true || roots.some((other) => other !== root && other.querySelector('.keys')?.classList.contains('open') === true)) throw new Error('keys did not stay root-local');
      (root.querySelector<HTMLButtonElement>('.keys button') as HTMLButtonElement).click();
    }
    return roots.map((root) => ({ drawer: root.classList.contains('toc-open'), keys: root.querySelector('.keys')?.classList.contains('open') === true }));
  });
  const roots = ['main[data-harness-root]', 'main[data-second-root]'];
  for (const selector of roots) {
    await doc.page.locator(`${selector} a.xref`).first().hover();
    await doc.page.waitForTimeout(600);
    expect(await doc.page.evaluate((selected) => {
      const roots = Array.from(document.querySelectorAll<HTMLElement>('main[data-harness-root], main[data-second-root]'));
      return roots.every((root) => root.matches(selected) ? root.querySelector('.xcard')?.classList.contains('open') === true : root.querySelector('.xcard')?.classList.contains('open') !== true);
    }, selector)).toBe(true);
    await doc.page.mouse.move(5, 5);
    await doc.page.waitForTimeout(600);
  }
  expect(result).toEqual([{ drawer: false, keys: false }, { drawer: false, keys: false }]);
}

describeBrowsers((browser) => {
  it('census guards every L2 chrome class with a heading and explicit anchor, before its collision controls run', () => {
    expectCensusAnchors();
    for (const name of AUTHOR_IDS) {
      expect(MARKDOWN).toContain(`## ${name}\n\n<!-- id:${name} -->`);
    }
  });

  it('keeps authored collisions source-owned, uses issued chrome ids, and is equivalent after every collision id is renamed', async () => {
    const rename = new Map(AUTHOR_IDS.map((name, index) => [`renamed-${String(index)}`, name]));
    const original = await openPair(browser, false);
    try {
      const originalBefore = await shape(original.doc, 'main[data-harness-root]', new Map());
      const originalSecond = await shape(original.doc, 'main[data-second-root]', new Map());
      expect(originalBefore.author).toEqual(AUTHOR_IDS.map((id) => ({ id, heading: 1, anchor: 1, chrome: false })));
      expect(originalSecond.author).toEqual(originalBefore.author);
      expect(originalBefore.chrome.every((node) => node.idIssued)).toBe(true);
      expect(originalSecond.chrome.every((node) => node.idIssued)).toBe(true);
      expect(new Set([...originalBefore.rawChromeIds, ...originalSecond.rawChromeIds])).toHaveLength(originalBefore.rawChromeIds.length + originalSecond.rawChromeIds.length);
      expect(originalBefore.chrome.some((node) => node.id !== null && AUTHOR_IDS.includes(node.id as (typeof AUTHOR_IDS)[number]))).toBe(false);
      expect(originalBefore.prototype).toEqual(original.prototypeBefore);
      expect(originalSecond.prototype).toEqual(original.prototypeBefore);
      await expectSourceIdentity(original.doc);
      await exerciseOwnership(original.doc);
      const originalAfterFirst = await shape(original.doc, 'main[data-harness-root]', new Map());
      const originalAfterSecond = await shape(original.doc, 'main[data-second-root]', new Map());
      expect(new Set([...originalAfterFirst.rawChromeIds, ...originalAfterSecond.rawChromeIds])).toHaveLength(originalAfterFirst.rawChromeIds.length + originalAfterSecond.rawChromeIds.length);
      await expectSourceIdentity(original.doc);
      expect(await original.doc.page.evaluate(() => Object.getOwnPropertyNames(Object.prototype).sort())).toEqual(original.prototypeBefore);
      expect(await original.doc.violations()).toEqual([]);
      expect(original.doc.aborted).toEqual([]);
      expect(original.doc.missing).toEqual([]);

      const renamed = await openPair(browser, true);
      try {
        const renamedFirst = await shape(renamed.doc, 'main[data-harness-root]', rename);
        const renamedSecond = await shape(renamed.doc, 'main[data-second-root]', rename);
        expect({ ...renamedFirst, rawChromeIds: [] }).toEqual({ ...originalBefore, rawChromeIds: [] });
        expect({ ...renamedSecond, rawChromeIds: [] }).toEqual({ ...originalSecond, rawChromeIds: [] });
        expect(renamedFirst.prototype).toEqual(renamed.prototypeBefore);
        expect(renamedSecond.prototype).toEqual(renamed.prototypeBefore);
        await expectSourceIdentity(renamed.doc);
        await exerciseOwnership(renamed.doc);
        const renamedAfterFirst = await shape(renamed.doc, 'main[data-harness-root]', rename);
        const renamedAfterSecond = await shape(renamed.doc, 'main[data-second-root]', rename);
        expect(new Set([...renamedAfterFirst.rawChromeIds, ...renamedAfterSecond.rawChromeIds])).toHaveLength(renamedAfterFirst.rawChromeIds.length + renamedAfterSecond.rawChromeIds.length);
        await expectSourceIdentity(renamed.doc);
        expect(await renamed.doc.page.evaluate(() => Object.getOwnPropertyNames(Object.prototype).sort())).toEqual(renamed.prototypeBefore);
        expect(await renamed.doc.snapshot(['byline', 'doc-toc', 'jump', 'keys'])).toBe(await original.doc.snapshot(['byline', 'doc-toc', 'jump', 'keys']));
        expect(await renamed.doc.violations()).toEqual([]);
        expect(renamed.doc.aborted).toEqual([]);
        expect(renamed.doc.missing).toEqual([]);
      } finally {
        await renamed.doc.close();
      }
    } finally {
      await original.doc.close();
    }
  });
});
