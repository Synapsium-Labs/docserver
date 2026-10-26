// @vitest-environment jsdom
// C64: exact-root permission applies only to the scrim close path.
import { afterEach, describe, expect, it } from 'vitest';
import { contextOf } from '../src/enhance/lifecycle.js';
import { destroyEnhancement, enhance } from '../src/enhance/index.js';
import { render } from '../src/render/index.js';

const DOC = [
  '# Scrim fixture',
  '',
  '## One',
  '',
  'First section.',
  '',
  '## Two',
  '',
  'Second section.',
  '',
  '## Three',
  '',
  'Third section.',
].join('\n');

const roots: HTMLElement[] = [];
const initialWidth = Object.getOwnPropertyDescriptor(window, 'innerWidth');

function mount(tabindex: string | null = null): HTMLElement {
  const parsed = new DOMParser().parseFromString(`<!doctype html><body>${render(DOC).html}`, 'text/html');
  const root = document.createElement('main');
  if (tabindex !== null) root.setAttribute('tabindex', tabindex);
  root.append(...Array.from(parsed.body.childNodes).map((node) => document.importNode(node, true)));
  document.body.append(root);
  roots.push(root);
  return root;
}

function narrow(): void {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
}

function drawer(root: HTMLElement): {
  readonly button: HTMLButtonElement;
  readonly rail: HTMLElement;
  readonly scrim: HTMLElement;
} {
  const button = root.querySelector('.toc-btn');
  const rail = root.querySelector('.doc-toc');
  const scrim = root.querySelector('.toc-scrim');
  if (!(button instanceof HTMLButtonElement) || !(rail instanceof HTMLElement) || !(scrim instanceof HTMLElement)) {
    throw new Error('missing drawer chrome');
  }
  return { button, rail, scrim };
}

function state(root: HTMLElement): {
  readonly open: boolean;
  readonly expanded: string | null;
  readonly hidden: boolean;
  readonly role: string | null;
  readonly modal: string | null;
} {
  const { button, rail, scrim } = drawer(root);
  return {
    open: root.classList.contains('toc-open'),
    expanded: button.getAttribute('aria-expanded'),
    hidden: scrim.hasAttribute('hidden'),
    role: rail.getAttribute('role'),
    modal: rail.getAttribute('aria-modal'),
  };
}

function key(target: EventTarget, name: string): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
}

async function opened(root: HTMLElement, opener: HTMLButtonElement): Promise<ReturnType<typeof drawer>> {
  opener.focus();
  expect(document.activeElement).toBe(opener);
  const controls = drawer(root);
  controls.button.click();
  const selected = controls.rail.querySelector('button[role="tab"][aria-selected="true"]');
  if (!(selected instanceof HTMLButtonElement)) throw new Error('missing selected rail tab');
  expect(document.activeElement).toBe(selected);
  return controls;
}

afterEach(async () => {
  for (const root of roots.splice(0)) await destroyEnhancement(root).catch(() => undefined);
  document.body.replaceChildren();
  if (initialWidth === undefined) Reflect.deleteProperty(window, 'innerWidth');
  else Object.defineProperty(window, 'innerWidth', initialWidth);
});

describe('rail scrim exact-root permission', () => {
  it('restores a connected opener when a synthetic scrim click follows exact root focus with library tabindex', async () => {
    narrow();
    const root = mount();
    const opener = document.createElement('button');
    document.body.append(opener);
    await enhance(root);

    const { scrim } = await opened(root, opener);
    expect(root.getAttribute('tabindex')).toBe('-1');
    root.focus({ preventScroll: true });
    expect(document.activeElement).toBe(root);
    scrim.click();

    expect(state(root)).toEqual({ open: false, expanded: 'false', hidden: true, role: null, modal: null });
    expect(document.activeElement).toBe(opener);
    await destroyEnhancement(root);
    roots.splice(roots.indexOf(root), 1);
    expect(root.getAttribute('tabindex')).toBeNull();
  });

  it('restores a connected opener when the host supplied root tabindex zero', async () => {
    narrow();
    const root = mount('0');
    const opener = document.createElement('button');
    document.body.append(opener);
    await enhance(root);

    const { scrim } = await opened(root, opener);
    expect(root.getAttribute('tabindex')).toBe('0');
    root.focus({ preventScroll: true });
    expect(document.activeElement).toBe(root);
    scrim.click();

    expect(state(root)).toEqual({ open: false, expanded: 'false', hidden: true, role: null, modal: null });
    expect(document.activeElement).toBe(opener);
    await destroyEnhancement(root);
    roots.splice(roots.indexOf(root), 1);
    expect(root.getAttribute('tabindex')).toBe('0');
  });

  it('leaves connected host controls outside the root, inside it, and in a sibling reader focused on scrim close', async () => {
    narrow();
    const root = mount();
    const sibling = mount('0');
    const opener = document.createElement('button');
    const outside = document.createElement('button');
    const inside = document.createElement('button');
    document.body.append(opener, outside);
    root.append(inside);
    await enhance(root);
    await enhance(sibling);

    for (const target of [outside, inside, sibling]) {
      const { scrim } = await opened(root, opener);
      target.focus({ preventScroll: true });
      expect(document.activeElement).toBe(target);
      scrim.click();
      expect(document.activeElement).toBe(target);
      expect(state(root).open).toBe(false);
    }
  });

  it('does not grant exact-root focus permission to ordinary rail, keyboard, overlay, Contents, or destroy closes', async () => {
    narrow();
    const root = mount();
    const opener = document.createElement('button');
    document.body.append(opener);
    await enhance(root);
    const controls = drawer(root);
    const ctx = contextOf(root);
    if (ctx === undefined) throw new Error('missing enhancement context');

    const ordinary = [
      () => key(controls.rail, 'Escape'),
      () => key(root, 'Escape'),
      () => ctx.overlays.close('drawer'),
      () => controls.button.click(),
    ];
    for (const close of ordinary) {
      await opened(root, opener);
      root.focus({ preventScroll: true });
      expect(document.activeElement).toBe(root);
      close();
      expect(document.activeElement).toBe(root);
      expect(state(root).open).toBe(false);
    }

    const libraryRoot = mount();
    const libraryOpener = document.createElement('button');
    document.body.append(libraryOpener);
    await enhance(libraryRoot);
    await opened(libraryRoot, libraryOpener);
    libraryRoot.focus({ preventScroll: true });
    let openerFocuses = 0;
    let contentsFocuses = 0;
    libraryOpener.addEventListener('focus', () => { openerFocuses += 1; });
    drawer(libraryRoot).button.addEventListener('focus', () => { contentsFocuses += 1; });
    await destroyEnhancement(libraryRoot);
    roots.splice(roots.indexOf(libraryRoot), 1);
    expect([openerFocuses, contentsFocuses, libraryRoot.hasAttribute('tabindex')]).toEqual([0, 0, false]);

    const hostRoot = mount('0');
    const hostOpener = document.createElement('button');
    document.body.append(hostOpener);
    await enhance(hostRoot);
    await opened(hostRoot, hostOpener);
    hostRoot.focus({ preventScroll: true });
    await destroyEnhancement(hostRoot);
    roots.splice(roots.indexOf(hostRoot), 1);
    expect([document.activeElement, hostRoot.getAttribute('tabindex')]).toEqual([hostRoot, '0']);
  });

  it('does not retain scrim permission after reopen and does not refocus from a repeated closed scrim click', async () => {
    narrow();
    const root = mount();
    const opener = document.createElement('button');
    document.body.append(opener);
    await enhance(root);

    let controls = await opened(root, opener);
    root.focus({ preventScroll: true });
    controls.scrim.click();
    expect(document.activeElement).toBe(opener);

    controls = await opened(root, opener);
    root.focus({ preventScroll: true });
    key(controls.rail, 'Escape');
    expect([state(root).open, document.activeElement]).toEqual([false, root]);
    controls.scrim.click();
    expect(document.activeElement).toBe(root);
  });

  it('uses connected Contents and exact-root fallbacks after return targets disconnect without scrolling', async () => {
    narrow();
    const root = mount();
    const opener = document.createElement('button');
    document.body.append(opener);
    await enhance(root);

    let controls = await opened(root, opener);
    opener.remove();
    const firstTab = controls.rail.querySelector('button[role="tab"][aria-selected="true"]');
    if (!(firstTab instanceof HTMLButtonElement)) throw new Error('missing selected rail tab');
    firstTab.focus();
    expect(document.activeElement).not.toBe(root);
    controls.scrim.click();
    expect(document.activeElement).toBe(controls.button);

    const second = mount();
    const secondOpener = document.createElement('button');
    document.body.append(secondOpener);
    await enhance(second);
    controls = await opened(second, secondOpener);
    const before = window.scrollY;
    secondOpener.remove();
    controls.button.remove();
    const secondTab = controls.rail.querySelector('button[role="tab"][aria-selected="true"]');
    if (!(secondTab instanceof HTMLButtonElement)) throw new Error('missing selected rail tab');
    secondTab.focus();
    expect(document.activeElement).not.toBe(second);
    controls.scrim.click();
    expect([document.activeElement, second.getAttribute('tabindex'), window.scrollY]).toEqual([second, '-1', before]);
  });

  it('stops forward drawer work after call-through opener restoration requests destroy', async () => {
    narrow();
    const root = mount();
    const opener = document.createElement('button');
    document.body.append(opener);
    await enhance(root);
    const { button, scrim } = await opened(root, opener);
    const ctx = contextOf(root);
    if (ctx === undefined) throw new Error('missing enhancement context');
    root.focus({ preventScroll: true });
    expect(document.activeElement).toBe(root);

    const observation: {
      terminal: boolean;
      undoStarted: boolean;
      destroy: Promise<void> | null;
      closedAtRestoration: ReturnType<typeof state> | null;
      overlayOpenAtRestoration: boolean | null;
      openerFocused: boolean;
      readonly calls: string[];
      readonly forwardJournalAttempts: string[];
    } = {
      terminal: false,
      undoStarted: false,
      destroy: null,
      closedAtRestoration: null,
      overlayOpenAtRestoration: null,
      openerFocused: false,
      calls: [],
      forwardJournalAttempts: [],
    };
    const nativeOpenerFocus = opener.focus.bind(opener);
    const nativeContentsFocus = button.focus.bind(button);
    const nativeRootFocus = root.focus.bind(root);
    const originalSetAttribute = ctx.journal.setAttribute;
    const originalToggleClass = ctx.journal.toggleClass;
    Object.defineProperty(opener, 'focus', {
      configurable: true,
      value: (options?: FocusOptions): void => {
        observation.calls.push('opener');
        nativeOpenerFocus(options);
        observation.openerFocused = document.activeElement === opener;
        observation.closedAtRestoration = state(root);
        observation.overlayOpenAtRestoration = ctx.overlays.isOpen('drawer');
        observation.calls.push('destroy');
        observation.terminal = true;
        observation.destroy ??= destroyEnhancement(root);
      },
    });
    Object.defineProperty(button, 'focus', {
      configurable: true,
      value: (options?: FocusOptions): void => {
        observation.calls.push('contents');
        nativeContentsFocus(options);
      },
    });
    Object.defineProperty(root, 'focus', {
      configurable: true,
      value: (options?: FocusOptions): void => {
        observation.calls.push('root');
        nativeRootFocus(options);
      },
    });
    ctx.journal.setAttribute = (element, name, value): void => {
      if (observation.terminal && !observation.undoStarted) observation.forwardJournalAttempts.push(`attribute:${name}`);
      originalSetAttribute(element, name, value);
    };
    ctx.journal.toggleClass = (element, name, on): void => {
      if (observation.terminal && !observation.undoStarted) observation.forwardJournalAttempts.push(`class:${name}`);
      originalToggleClass(element, name, on);
    };

    try {
      // This is the newest undo boundary, so subsequent journal undo is not forward drawer work.
      ctx.journal.defer(() => { observation.undoStarted = true; });
      scrim.click();
      expect(observation.destroy).not.toBeNull();
      const destroy = observation.destroy;
      if (destroy === null) throw new Error('opener restoration did not request destroy');
      await destroy;
      roots.splice(roots.indexOf(root), 1);

      expect(observation.closedAtRestoration).toEqual({ open: false, expanded: 'false', hidden: true, role: null, modal: null });
      expect(observation.overlayOpenAtRestoration).toBe(false);
      expect(observation.openerFocused).toBe(true);
      expect(observation.undoStarted).toBe(true);
      expect([observation.calls, observation.forwardJournalAttempts]).toEqual([['opener', 'destroy'], []]);
      expect(root.querySelector('[data-docreader-chrome]')).toBeNull();
    } finally {
      ctx.journal.setAttribute = originalSetAttribute;
      ctx.journal.toggleClass = originalToggleClass;
    }
  });

  it('does no stale scrim work when a capture listener destroys the enhancement before its journal listener', async () => {
    narrow();
    const root = mount();
    const opener = document.createElement('button');
    document.body.append(opener);
    await enhance(root);
    const { scrim } = await opened(root, opener);
    let openerFocuses = 0;
    let destroyed: Promise<void> | null = null;
    opener.addEventListener('focus', () => { openerFocuses += 1; });
    scrim.addEventListener('click', () => {
      destroyed ??= destroyEnhancement(root);
    }, { capture: true, once: true });

    root.focus({ preventScroll: true });
    scrim.click();

    expect(destroyed).not.toBeNull();
    if (destroyed === null) throw new Error('capture did not destroy');
    await destroyed;
    roots.splice(roots.indexOf(root), 1);
    expect([openerFocuses, root.querySelector('[data-docreader-chrome]')]).toEqual([0, null]);
  });
});
