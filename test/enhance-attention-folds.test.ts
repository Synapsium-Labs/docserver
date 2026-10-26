// @vitest-environment jsdom
// C65: Product controls created before folds must be completed at the settings boundary.
// Each case exercises the public lifecycle, real settings, real folds, and retained DOM identities.
import { afterEach, describe, expect, it } from 'vitest';
import * as attention from '../src/enhance/attention.js';
import { destroyEnhancement, enhance, setEnhancementPrefs } from '../src/enhance/index.js';
import { contextOf } from '../src/enhance/lifecycle.js';
import type { TableBlock } from '../src/enhance/registry.js';
import type { FeatureContext } from '../src/enhance/types.js';
import { docKey } from '../src/enhance/state.js';
import { render } from '../src/render/index.js';

const rows = Array.from({ length: 12 }, (_, index) => `| \`src/module-${String(index + 1)}.ts\` | \`Detail ${String(index + 1)}\` |`).join('\n');

const DOC = [
  '# Product fold joins',
  '',
  '## 1. Engineering detail',
  '',
  '```ts',
  'const one = 1;',
  'const two = 2;',
  'const three = 3;',
  'const four = 4;',
  'const five = 5;',
  '```',
  '',
  '| File | Detail |',
  '|---|---|',
  rows,
  '',
  '## 2. Survivor',
  '',
  'This prose keeps the document foldable.',
  '',
  '## 3. End',
  '',
  'Closing prose.',
].join('\n');

const EMPTY_FOLDS_DOC = [
  '# Empty folds',
  '',
  '## 1. Engineering detail',
  '',
  '```ts',
  'const one = 1;',
  'const two = 2;',
  'const three = 3;',
  'const four = 4;',
  'const five = 5;',
  '```',
  '',
  '## 2. End',
  '',
  'Only two sections leaves this outside the document fold contract.',
].join('\n');

const roots: HTMLElement[] = [];
const authorHeadings = new WeakMap<HTMLElement, { readonly engineering: HTMLElement }>();

function mount(markdown = DOC): HTMLElement {
  const parsed = new DOMParser().parseFromString(`<!doctype html><body>${render(markdown).html}`, 'text/html');
  const root = document.createElement('main');
  root.append(...Array.from(parsed.body.childNodes));
  const engineering = Array.from(root.children).find((child) => child.localName === 'h2' && child.textContent?.trim() === '1. Engineering detail');
  if (!(engineering instanceof HTMLElement)) throw new Error('missing author engineering heading');
  authorHeadings.set(root, { engineering });
  document.body.append(root);
  roots.push(root);
  return root;
}

function foldButton(heading: Element): HTMLButtonElement {
  const button = heading.querySelector<HTMLButtonElement>('.h-fold');
  if (button === null) throw new Error('missing fold button');
  return button;
}

function radio(root: Element, value: 'all' | 'product'): HTMLInputElement {
  const input = root.querySelector<HTMLInputElement>(`input[data-pref="lens"][value="${value}"]`);
  if (input === null) throw new Error(`missing ${value} lens radio`);
  return input;
}

function choose(input: HTMLInputElement): void {
  input.checked = true;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

interface ProductNodes {
  readonly heading: HTMLElement;
  readonly code: HTMLElement;
  readonly tableInner: HTMLElement;
  readonly tableOuter: HTMLElement;
  readonly codeBar: HTMLElement;
  readonly tableBar: HTMLElement;
  readonly filter: HTMLInputElement;
}

function productNodes(root: HTMLElement): ProductNodes {
  const heading = authorHeadings.get(root)?.engineering;
  if (heading === undefined) throw new Error('missing captured author engineering heading');
  const code = root.querySelector<HTMLElement>('.codehilite');
  const tableOuter = root.querySelector<HTMLElement>('.tbl-block');
  const tableInner = tableOuter?.querySelector<HTMLElement>('.table-wrapper') ?? null;
  const codeBar = code?.nextElementSibling;
  const tableBar = tableOuter?.nextElementSibling;
  const filter = tableOuter?.querySelector<HTMLInputElement>('.tbl-tools input') ?? null;
  if (!(code instanceof HTMLElement) || !(tableOuter instanceof HTMLElement) || !(tableInner instanceof HTMLElement) || !(codeBar instanceof HTMLElement) || !(tableBar instanceof HTMLElement) || !(filter instanceof HTMLInputElement)) {
    throw new Error('missing technical Product controls');
  }
  if (!codeBar.classList.contains('peek-bar') || !tableBar.classList.contains('peek-bar')) throw new Error('missing Product peek bars');
  return { heading, code, tableInner, tableOuter, codeBar, tableBar, filter };
}

function assertJoinedAndFoldable(root: HTMLElement): ProductNodes {
  const nodes = productNodes(root);
  const ctx = contextOf(root);
  if (ctx === undefined) throw new Error('missing enhancement context');
  const registered = ctx.blocks.find((block): block is TableBlock => block.kind === 'table');
  if (registered === undefined) throw new Error('missing registered technical table');

  // The expected source heading is selected from author DOM, not inferred from sectionOf(bar).
  expect([registered.el, nodes.tableInner, nodes.tableOuter.parentElement, nodes.code.parentElement]).toEqual([nodes.tableInner, nodes.tableInner, root, root]);
  expect([ctx.folds.sectionOf(nodes.code), ctx.folds.sectionOf(nodes.tableOuter), ctx.folds.sectionOf(nodes.codeBar), ctx.folds.sectionOf(nodes.tableBar)]).toEqual([nodes.heading, nodes.heading, nodes.heading, nodes.heading]);

  foldButton(nodes.heading).click();
  expect([nodes.code.getAttribute('hidden'), nodes.tableOuter.getAttribute('hidden'), nodes.codeBar.getAttribute('hidden'), nodes.tableBar.getAttribute('hidden')]).toEqual(['until-found', 'until-found', 'until-found', 'until-found']);
  foldButton(nodes.heading).click();
  expect([nodes.code.hasAttribute('hidden'), nodes.tableOuter.hasAttribute('hidden'), nodes.codeBar.hasAttribute('hidden'), nodes.tableBar.hasAttribute('hidden')]).toEqual([false, false, false, false]);
  return nodes;
}

function assertNoDuplicateBars(root: Element, wanted: number): void {
  expect(root.querySelectorAll('.peek-bar')).toHaveLength(wanted);
}

afterEach(async () => {
  for (const root of roots.splice(0)) await destroyEnhancement(root).catch(() => undefined);
  document.body.replaceChildren();
});

describe('Product controls completed after folds', () => {
  it('joins explicit Product controls to their original source section and retains them after Everything', async () => {
    const root = mount();
    await enhance(root, { prefs: { lens: 'product' } });

    const nodes = assertJoinedAndFoldable(root);
    choose(radio(root, 'all'));
    expect([root.classList.contains('lens-product'), nodes.codeBar.parentElement, nodes.tableBar.parentElement]).toEqual([false, root, root]);
    assertNoDuplicateBars(root, 2);
    const ctx = contextOf(root);
    if (ctx === undefined) throw new Error('missing Product context after Everything');
    expect([ctx.folds.sectionOf(nodes.codeBar), ctx.folds.sectionOf(nodes.tableBar)]).toEqual([nodes.heading, nodes.heading]);
    foldButton(nodes.heading).click();
    expect([nodes.codeBar.getAttribute('hidden'), nodes.tableBar.getAttribute('hidden')]).toEqual(['until-found', 'until-found']);
    foldButton(nodes.heading).click();
    expect([nodes.codeBar.hasAttribute('hidden'), nodes.tableBar.hasAttribute('hidden')]).toEqual([false, false]);
  });

  it('joins stored Product controls without changing an enhanced sibling root', async () => {
    const product = mount();
    const sibling = mount();
    await enhance(sibling);
    const siblingCode = sibling.querySelector<HTMLElement>('.codehilite');
    if (siblingCode === null) throw new Error('missing sibling code source');

    await enhance(product, { storage: { snapshot: { 'docreader:prefs': JSON.stringify({ lens: 'product' }) } } });
    const nodes = assertJoinedAndFoldable(product);

    expect([sibling.classList.contains('lens-product'), sibling.querySelectorAll('.peek-bar').length, siblingCode.hasAttribute('hidden')]).toEqual([false, 0, false]);
    expect([nodes.codeBar.parentElement, nodes.tableBar.parentElement]).toEqual([product, product]);
  });

  it('retains controls selected then unselected reentrantly by the real stored-fold getter', async () => {
    const root = mount();
    const foldsKey = docKey('c65', 'folds');
    let reads = 0;
    const snapshot: Record<string, string> = {};
    Object.defineProperty(snapshot, foldsKey, {
      enumerable: true,
      get: () => {
        reads += 1;
        setEnhancementPrefs(root, { lens: 'product' });
        setEnhancementPrefs(root, { lens: 'all' });
        return '[]';
      },
    });

    await enhance(root, { storage: { snapshot }, storageKey: 'c65' });

    expect([reads, root.classList.contains('lens-product')]).toEqual([1, false]);
    assertJoinedAndFoldable(root);
  });

  it('completes an empty Everything cohort when the real Aa menu first selects Product', async () => {
    const root = mount();
    await enhance(root);
    expect(root.querySelectorAll('.peek-bar')).toHaveLength(0);

    const menuButton = root.querySelector<HTMLButtonElement>('.aa-btn');
    if (menuButton === null) throw new Error('missing Aa menu button');
    menuButton.click();
    choose(radio(root, 'product'));

    assertJoinedAndFoldable(root);
    assertNoDuplicateBars(root, 2);
  });

  it.each([
    ['settings-disabled', { chrome: { settings: false } }],
    ['no-bar-slots', { chrome: { bar: false } }],
  ] as const)('completes initial Product joins before the %s settings guard', async (_name, options) => {
    const root = mount();
    await enhance(root, { ...options, prefs: { lens: 'product' } });

    assertJoinedAndFoldable(root);
    expect(root.querySelectorAll('.aa-wrap')).toHaveLength(0);
  });

  it.each([
    ['disabled folds', DOC, { folds: false }, 2],
    ['empty folds', EMPTY_FOLDS_DOC, {}, 1],
  ] as const)('does not duplicate Product bars when completion has %s', async (_name, markdown, options, bars) => {
    const root = mount(markdown);
    await enhance(root, { ...options, prefs: { lens: 'product' } });

    assertNoDuplicateBars(root, bars);
    const code = root.querySelector<HTMLElement>('.codehilite');
    const bar = code?.nextElementSibling;
    const ctx = contextOf(root);
    if (code === null || !(bar instanceof HTMLElement) || ctx === undefined) throw new Error('missing disabled-fold Product controls');
    expect(ctx.folds.sectionOf(bar)).toBeNull();
    setEnhancementPrefs(root, { lens: 'all' });
    assertNoDuplicateBars(root, bars);
    setEnhancementPrefs(root, { lens: 'product' });
    expect([root.classList.contains('lens-product'), root.querySelectorAll('.peek-bar').length, ctx.folds.sectionOf(bar)]).toEqual([true, bars, null]);
  });

  it.each([
    {
      name: 'removed original bar',
      discriminator: 'code',
      mutate: (root: HTMLElement) => {
        const code = root.querySelector<HTMLElement>('.codehilite');
        const original = code?.nextElementSibling;
        if (!(original instanceof HTMLElement)) throw new Error('missing original code bar');
        original.remove();
        return { original, observed: original };
      },
    },
    {
      name: 'replaced original bar',
      discriminator: 'code',
      mutate: (root: HTMLElement) => {
        const code = root.querySelector<HTMLElement>('.codehilite');
        const original = code?.nextElementSibling;
        if (!(original instanceof HTMLElement)) throw new Error('missing original code bar');
        const replacement = original.cloneNode(true) as HTMLElement;
        original.replaceWith(replacement);
        return { original, observed: replacement };
      },
    },
    {
      name: 'nested original bar',
      discriminator: 'code',
      mutate: (root: HTMLElement) => {
        const code = root.querySelector<HTMLElement>('.codehilite');
        const original = code?.nextElementSibling;
        if (!(code instanceof HTMLElement) || !(original instanceof HTMLElement)) throw new Error('missing original code bar');
        const wrapper = document.createElement('div');
        root.append(wrapper);
        wrapper.append(original);
        return { original, observed: original };
      },
    },
    {
      name: 'other-root original bar',
      discriminator: 'code',
      mutate: (root: HTMLElement) => {
        const code = root.querySelector<HTMLElement>('.codehilite');
        const original = code?.nextElementSibling;
        if (!(original instanceof HTMLElement)) throw new Error('missing original code bar');
        const other = document.createElement('aside');
        document.body.append(other);
        other.append(original);
        return { original, observed: original };
      },
    },
    {
      name: 'replaced original target',
      discriminator: 'code',
      mutate: (root: HTMLElement) => {
        const code = root.querySelector<HTMLElement>('.codehilite');
        const bar = code?.nextElementSibling;
        if (!(code instanceof HTMLElement) || !(bar instanceof HTMLElement)) throw new Error('missing original code target');
        code.replaceWith(code.cloneNode(true));
        return { original: bar, observed: bar };
      },
    },
    {
      name: 'replaced filtered-table inner source',
      discriminator: 'table',
      mutate: (root: HTMLElement) => {
        const outer = root.querySelector<HTMLElement>('.tbl-block');
        const inner = outer?.querySelector<HTMLElement>('.table-wrapper') ?? null;
        const bar = outer?.nextElementSibling;
        if (!(inner instanceof HTMLElement) || !(bar instanceof HTMLElement)) throw new Error('missing original filtered-table source');
        inner.replaceWith(inner.cloneNode(true));
        return { original: bar, observed: bar };
      },
    },
  ])('does not re-enrol a $name while its independent survivor still folds', async ({ discriminator, mutate }) => {
    const root = mount();
    const foldsKey = docKey('c65-stale', 'folds');
    const observation: { evidence: { readonly original: HTMLElement; readonly observed: HTMLElement } | null } = { evidence: null };
    const snapshot: Record<string, string> = {};
    Object.defineProperty(snapshot, foldsKey, {
      enumerable: true,
      get: () => {
        observation.evidence = mutate(root);
        return '[]';
      },
    });

    await enhance(root, { prefs: { lens: 'product' }, storage: { snapshot }, storageKey: 'c65-stale' });

    const evidence = observation.evidence;
    const heading = authorHeadings.get(root)?.engineering;
    const tableOuter = root.querySelector<HTMLElement>('.tbl-block');
    const code = root.querySelector<HTMLElement>('.codehilite');
    const tableBar = tableOuter?.nextElementSibling;
    const codeBar = code?.nextElementSibling;
    const ctx = contextOf(root);
    if (heading === undefined || ctx === undefined || evidence === null || !(tableBar instanceof HTMLElement) || !(codeBar instanceof HTMLElement)) {
      throw new Error('missing stale-pair evidence');
    }
    const survivor = discriminator === 'code' ? tableBar : codeBar;
    expect([ctx.folds.sectionOf(evidence.original), ctx.folds.sectionOf(evidence.observed), ctx.folds.sectionOf(survivor)]).toEqual([null, null, heading]);
    foldButton(heading).click();
    expect(survivor.getAttribute('hidden')).toBe('until-found');
    expect(evidence.observed.getAttribute('hidden')).toBeNull();
  });

  it('keeps a valid original bar fold-owned after moving it past an ordinary direct-root child', async () => {
    const root = mount();
    const foldsKey = docKey('c65-order', 'folds');
    const observation: { bar: HTMLElement | null } = { bar: null };
    const snapshot: Record<string, string> = {};
    Object.defineProperty(snapshot, foldsKey, {
      enumerable: true,
      get: () => {
        const code = root.querySelector<HTMLElement>('.codehilite');
        const bar = code?.nextElementSibling instanceof HTMLElement ? code.nextElementSibling : null;
        if (bar === null) throw new Error('missing original code bar');
        observation.bar = bar;
        const ordinary = document.createElement('p');
        ordinary.textContent = 'ordinary host node';
        root.insertBefore(ordinary, bar);
        root.append(bar);
        return '[]';
      },
    });

    await enhance(root, { prefs: { lens: 'product' }, storage: { snapshot }, storageKey: 'c65-order' });

    const originalBar = observation.bar;
    const heading = authorHeadings.get(root)?.engineering;
    const ctx = contextOf(root);
    if (heading === undefined || ctx === undefined || originalBar === null) throw new Error('missing moved-bar evidence');
    expect(ctx.folds.sectionOf(originalBar)).toBe(heading);
    foldButton(heading).click();
    expect(originalBar.getAttribute('hidden')).toBe('until-found');
  });

  it('keeps the filtered table source inside its original presentation target while its bar folds with that target', async () => {
    const root = mount();
    await enhance(root, { prefs: { lens: 'product' } });
    const nodes = assertJoinedAndFoldable(root);

    nodes.filter.value = 'module-1';
    nodes.filter.dispatchEvent(new Event('input', { bubbles: true }));
    expect(Array.from(nodes.tableOuter.querySelectorAll('tbody tr')).map((row) => row.hasAttribute('hidden'))).toEqual([false, true, true, true, true, true, true, true, true, false, false, false]);
    expect([nodes.tableInner.parentElement, nodes.tableOuter.nextElementSibling]).toEqual([nodes.tableOuter, nodes.tableBar]);
  });

  it('releases retained Product controls on destroy and builds one fresh joined cohort on re-enhancement', async () => {
    const root = mount();
    const source = root.innerHTML;
    await enhance(root, { prefs: { lens: 'product' } });
    assertJoinedAndFoldable(root);

    await destroyEnhancement(root);
    expect([root.innerHTML, contextOf(root)]).toEqual([source, undefined]);
    await enhance(root, { prefs: { lens: 'product' } });
    assertJoinedAndFoldable(root);
    assertNoDuplicateBars(root, 2);
  });
});


interface CompletionObserver {
  ctx: FeatureContext | null;
  realEnv: FeatureContext['env'] | null;
  realFolds: FeatureContext['folds'] | null;
  envDescriptor: PropertyDescriptor | undefined;
  foldsDescriptor: PropertyDescriptor | undefined;
  envInstalled: boolean;
  foldsInstalled: boolean;
  onPrintCalls: number;
  postInstallHeadingIds: readonly string[] | null;
  joinCalls: number;
  readonly joinResults: boolean[];
  failure: unknown;
}

type JoinCall = (ctx: FeatureContext, folds: FeatureContext['folds'], node: Element, member: Element) => boolean;

function completionHelper(): (ctx: FeatureContext) => void {
  const candidate = (attention as unknown as { completeFoldJoins?: unknown }).completeFoldJoins;
  expect(typeof candidate).toBe('function');
  if (typeof candidate !== 'function') throw new Error('C65 completion helper is absent after public red evidence');
  return candidate as (ctx: FeatureContext) => void;
}

function observer(): CompletionObserver {
  return {
    ctx: null,
    realEnv: null,
    realFolds: null,
    envDescriptor: undefined,
    foldsDescriptor: undefined,
    envInstalled: false,
    foldsInstalled: false,
    onPrintCalls: 0,
    postInstallHeadingIds: null,
    joinCalls: 0,
    joinResults: [],
    failure: null,
  };
}

function replaceContextSlot(ctx: FeatureContext, name: 'env' | 'folds', descriptor: PropertyDescriptor, value: unknown): void {
  if (!('value' in descriptor) || (!descriptor.configurable && descriptor.writable !== true)) {
    throw new Error(`C65 observer cannot replace ctx.${name}`);
  }
  Object.defineProperty(ctx, name, { ...descriptor, value });
}

/** Install a real-Folds observer only after folds has installed its implementation through the unmodified facade. */
function installPostInstallJoinObserver(root: HTMLElement, seen: CompletionObserver, onJoin: JoinCall): void {
  try {
    const ctx = contextOf(root);
    if (ctx === undefined) throw new Error('missing context in stored-fold getter');
    const envDescriptor = Object.getOwnPropertyDescriptor(ctx, 'env');
    const foldsDescriptor = Object.getOwnPropertyDescriptor(ctx, 'folds');
    if (envDescriptor === undefined || foldsDescriptor === undefined) throw new Error('missing context slot descriptor');
    const realEnv = ctx.env;
    const realFolds = ctx.folds;
    seen.ctx = ctx;
    seen.realEnv = realEnv;
    seen.realFolds = realFolds;
    seen.envDescriptor = envDescriptor;
    seen.foldsDescriptor = foldsDescriptor;

    const observingJoin = (node: Element, member: Element): boolean => {
      seen.joinCalls += 1;
      const result = onJoin(ctx, realFolds, node, member);
      seen.joinResults.push(result);
      return result;
    };
    const foldsProxy = new Proxy(Object.create(realFolds) as object, {
      get(_foldTarget, foldProperty) {
        if (foldProperty === 'join') return observingJoin;
        const actual = Reflect.get(realFolds as object, foldProperty, realFolds);
        return typeof actual === 'function' ? actual.bind(realFolds) : actual;
      },
    }) as FeatureContext['folds'];
    const observingOnPrint = (fn: (printing: boolean) => void) => {
      const cancel = realEnv.onPrint(fn);
      try {
        seen.onPrintCalls += 1;
        seen.postInstallHeadingIds = realFolds.headings().map((heading) => heading.id);
        replaceContextSlot(ctx, 'env', envDescriptor, realEnv);
        seen.envInstalled = false;
        replaceContextSlot(ctx, 'folds', foldsDescriptor, foldsProxy);
        seen.foldsInstalled = true;
      } catch (error) {
        seen.failure = error;
        throw error;
      }
      return cancel;
    };
    const envProxy = new Proxy(Object.create(realEnv) as object, {
      get(_target, property) {
        if (property === 'onPrint') return observingOnPrint;
        const actual = Reflect.get(realEnv as object, property, realEnv);
        return typeof actual === 'function' ? actual.bind(realEnv) : actual;
      },
    }) as FeatureContext['env'];
    replaceContextSlot(ctx, 'env', envDescriptor, envProxy);
    seen.envInstalled = true;
  } catch (error) {
    // Stored-state reads deliberately swallow host getter faults; record the setup failure for a real outside oracle.
    seen.failure = error;
  }
}

function restorePostInstallJoinObserver(seen: CompletionObserver): void {
  const { ctx, envDescriptor, foldsDescriptor, realEnv, realFolds } = seen;
  if (ctx === null) return;
  if (seen.foldsInstalled && foldsDescriptor !== undefined && realFolds !== null) {
    Object.defineProperty(ctx, 'folds', foldsDescriptor);
    seen.foldsInstalled = false;
  }
  if (seen.envInstalled && envDescriptor !== undefined && realEnv !== null) {
    Object.defineProperty(ctx, 'env', envDescriptor);
    seen.envInstalled = false;
  }
}

function assertPostInstallHandoff(seen: CompletionObserver): void {
  expect([seen.failure, seen.onPrintCalls, seen.postInstallHeadingIds]).toEqual([null, 1, ['1-engineering-detail', '2-survivor', '3-end']]);
  expect(seen.ctx).not.toBeNull();
  expect(seen.realEnv).not.toBeNull();
  expect(seen.realFolds).not.toBeNull();
}

describe('Product join completion lifecycle', () => {
  it('does not replay a nonempty initial Product cohort when an actual Folds join reenters completion', async () => {
    const complete = completionHelper();
    const root = mount();
    const seen = observer();
    const foldsKey = docKey('c65-stage-b-reentry', 'folds');
    const snapshot: Record<string, string> = {};
    let reentered = false;
    Object.defineProperty(snapshot, foldsKey, {
      enumerable: true,
      get: () => {
        installPostInstallJoinObserver(root, seen, (ctx, folds, node, member) => {
          if (!reentered) {
            reentered = true;
            complete(ctx);
          }
          return folds.join(node, member);
        });
        return '[]';
      },
    });

    try {
      await enhance(root, { prefs: { lens: 'product' }, storage: { snapshot }, storageKey: 'c65-stage-b-reentry' });
      assertPostInstallHandoff(seen);
      expect([reentered, seen.joinCalls, seen.joinResults]).toEqual([true, 2, [true, true]]);
    } finally {
      restorePostInstallJoinObserver(seen);
    }
    assertJoinedAndFoldable(root);
  });

  it('does nothing for an unknown context before reading any poisoned method', () => {
    const complete = completionHelper();
    const sentinel = new Error('C65 unknown context property access');
    const poison = new Proxy({}, { get: () => { throw sentinel; } });

    expect(() => complete(poison as FeatureContext)).not.toThrow();
  });

  it('is inert for an already completed real context after ordinary destroy', async () => {
    const complete = completionHelper();
    const root = mount();
    const source = root.innerHTML;
    await enhance(root, { prefs: { lens: 'product' } });
    const former = contextOf(root);
    if (former === undefined) throw new Error('missing completed context');

    await destroyEnhancement(root);
    expect([root.innerHTML, contextOf(root)]).toEqual([source, undefined]);
    expect(() => complete(former)).not.toThrow();
    expect([root.innerHTML, root.querySelectorAll('.peek-bar').length, contextOf(root)]).toEqual([source, 0, undefined]);
  });

  it('drops a pending cohort before consulting a poison live method after getter-time destroy', async () => {
    const complete = completionHelper();
    const root = mount();
    const source = root.innerHTML;
    const foldsKey = docKey('c65-stage-b-pending', 'folds');
    const seen: { ctx: FeatureContext | null; destroy: Promise<void> | null } = { ctx: null, destroy: null };
    const snapshot: Record<string, string> = {};
    Object.defineProperty(snapshot, foldsKey, {
      enumerable: true,
      get: () => {
        const ctx = contextOf(root);
        if (ctx === undefined) throw new Error('missing pending context');
        seen.ctx = ctx;
        seen.destroy = destroyEnhancement(root);
        return '[]';
      },
    });

    await expect(enhance(root, { prefs: { lens: 'product' }, storage: { snapshot }, storageKey: 'c65-stage-b-pending' })).rejects.toMatchObject({ code: 'aborted' });
    const destroyed = seen.destroy;
    const former = seen.ctx;
    if (destroyed === null || former === null) throw new Error('missing pending destroy evidence');
    await destroyed;
    expect([root.innerHTML, contextOf(root)]).toEqual([source, undefined]);

    const liveDescriptor = Object.getOwnPropertyDescriptor(former, 'live');
    if (liveDescriptor === undefined || !liveDescriptor.configurable) throw new Error('cannot poison former context live slot');
    const sentinel = new Error('C65 pending context live access');
    try {
      const poisonLive: PropertyDescriptor = { configurable: liveDescriptor.configurable, get: () => { throw sentinel; } };
      if (liveDescriptor.enumerable === true) poisonLive.enumerable = true;
      Object.defineProperty(former, 'live', poisonLive);
      expect(() => complete(former)).not.toThrow();
    } finally {
      Object.defineProperty(former, 'live', liveDescriptor);
    }
    expect([root.innerHTML, root.querySelectorAll('.peek-bar').length, contextOf(root)]).toEqual([source, 0, undefined]);
  });

  it('stops an actual nonempty join drain after its first call requests destroy', async () => {
    const complete = completionHelper();
    void complete;
    const root = mount();
    const source = root.innerHTML;
    const seen = observer();
    const foldsKey = docKey('c65-stage-b-interrupt', 'folds');
    const snapshot: Record<string, string> = {};
    const interruption: { destroy: Promise<void> | null } = { destroy: null };
    Object.defineProperty(snapshot, foldsKey, {
      enumerable: true,
      get: () => {
        installPostInstallJoinObserver(root, seen, (_ctx, folds, node, member) => {
          const result = folds.join(node, member);
          if (seen.joinCalls === 1) interruption.destroy = destroyEnhancement(root);
          return result;
        });
        return '[]';
      },
    });

    try {
      await expect(enhance(root, { prefs: { lens: 'product' }, storage: { snapshot }, storageKey: 'c65-stage-b-interrupt' })).rejects.toMatchObject({ code: 'aborted' });
      assertPostInstallHandoff(seen);
      expect([seen.joinCalls, seen.joinResults]).toEqual([1, [true]]);
      const destroy = interruption.destroy;
      if (destroy === null) throw new Error('first join did not request destroy');
      await destroy;
    } finally {
      restorePostInstallJoinObserver(seen);
    }
    expect([root.innerHTML, contextOf(root)]).toEqual([source, undefined]);
  });

  it('rolls startup back when the first joined Product bar receives its actual hidden write fault', async () => {
    const complete = completionHelper();
    void complete;
    const root = mount();
    const source = root.innerHTML;
    const foldsKey = docKey('c65-stage-b-startup-fault', 'folds');
    const sentinel = new Error('C65 startup Product bar hidden write');
    const seen: { journal: FeatureContext['journal'] | null; setAttribute: FeatureContext['journal']['setAttribute'] | null } = { journal: null, setAttribute: null };
    const snapshot: Record<string, string> = {};
    Object.defineProperty(snapshot, foldsKey, {
      enumerable: true,
      get: () => {
        const ctx = contextOf(root);
        if (ctx === undefined) throw new Error('missing startup-fault context');
        seen.journal = ctx.journal;
        seen.setAttribute = ctx.journal.setAttribute;
        ctx.journal.setAttribute = (element, name, value): void => {
          if (element.classList.contains('peek-bar') && name === 'hidden' && value === 'until-found') throw sentinel;
          seen.setAttribute?.(element, name, value);
        };
        return '["1-engineering-detail"]';
      },
    });

    let thrown: unknown = null;
    try {
      await enhance(root, { prefs: { lens: 'product' }, storage: { snapshot }, storageKey: 'c65-stage-b-startup-fault' });
    } catch (error) {
      thrown = error;
    } finally {
      if (seen.journal !== null && seen.setAttribute !== null) seen.journal.setAttribute = seen.setAttribute;
    }
    expect(thrown).toMatchObject({ code: 'initialization' });
    if (typeof thrown !== 'object' || thrown === null || !('cause' in thrown)) throw new Error('missing startup-fault cause');
    expect((thrown as { readonly cause: unknown }).cause).toBe(sentinel);
    expect([root.innerHTML, root.querySelectorAll('.peek-bar').length, contextOf(root)]).toEqual([source, 0, undefined]);
  });

  it('propagates a later immediate Product hidden-write fault without rolling back the live reader', async () => {
    const complete = completionHelper();
    void complete;
    const root = mount();
    const foldsKey = docKey('c65-stage-b-later-fault', 'folds');
    const sentinel = new Error('C65 later Product bar hidden write');
    const seen: { journal: FeatureContext['journal'] | null; setAttribute: FeatureContext['journal']['setAttribute'] | null } = { journal: null, setAttribute: null };
    const snapshot: Record<string, string> = {};
    Object.defineProperty(snapshot, foldsKey, {
      enumerable: true,
      get: () => {
        const ctx = contextOf(root);
        if (ctx === undefined) throw new Error('missing later-fault context');
        seen.journal = ctx.journal;
        seen.setAttribute = ctx.journal.setAttribute;
        ctx.journal.setAttribute = (element, name, value): void => {
          if (element.classList.contains('peek-bar') && name === 'hidden' && value === 'until-found') throw sentinel;
          seen.setAttribute?.(element, name, value);
        };
        return '["1-engineering-detail"]';
      },
    });

    let live: FeatureContext | undefined;
    let thrown: unknown = null;
    try {
      await enhance(root, { storage: { snapshot }, storageKey: 'c65-stage-b-later-fault' });
      live = contextOf(root);
      if (live === undefined) throw new Error('missing live later-fault context');
      try {
        setEnhancementPrefs(root, { lens: 'product' });
      } catch (error) {
        thrown = error;
      }
      const heading = authorHeadings.get(root)?.engineering;
      if (heading === undefined) throw new Error('missing author heading');
      expect(thrown).toBe(sentinel);
      expect([contextOf(root), heading.classList.contains('folded'), root.querySelectorAll('.h-fold').length, root.querySelectorAll('.peek-bar').length]).toEqual([live, true, 3, 1]);
    } finally {
      if (seen.journal !== null && seen.setAttribute !== null) seen.journal.setAttribute = seen.setAttribute;
      await destroyEnhancement(root).catch(() => undefined);
    }
  });
});
