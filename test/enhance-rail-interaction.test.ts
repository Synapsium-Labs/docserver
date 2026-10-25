// @vitest-environment jsdom
// Bounded Task 18 rail interactions: spy, drawer keyboard behavior, and root isolation.
import { afterEach, describe, expect, it } from 'vitest';
import { contextOf } from '../src/enhance/lifecycle.js';
import { destroyEnhancement, enhance } from '../src/enhance/index.js';
import { render } from '../src/render/index.js';

const DOC = [
  '# Reader example',
  '',
  '## In short',
  '',
  'The first summary.',
  '',
  '## 1. Context',
  '',
  'The first section.',
  '',
  '### Detail',
  '',
  'A task-sized detail.',
  '',
  '## 2. Design',
  '',
  'The second section.',
  '',
  '## 3. Notes',
  '',
  'The third section.',
  '',
  '## 4. Decisions',
  '',
  '| ID | Status | Decision |',
  '| --- | --- | --- |',
  '| R1 | Agreed | Keep the reader local. |',
].join('\n');

const roots: HTMLElement[] = [];
const initialWidth = Object.getOwnPropertyDescriptor(window, 'innerWidth');

function mount(): HTMLElement {
  const root = document.createElement('main');
  root.innerHTML = render(DOC).html;
  document.body.append(root);
  roots.push(root);
  return root;
}

function setWidth(width: number): void {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
}

function heading(root: Element, id: string): HTMLElement {
  const found = Array.from(root.querySelectorAll('h2, h3')).find((element) => element.id === id);
  if (found === undefined) throw new Error(`missing heading ${id}`);
  return found as HTMLElement;
}

function key(target: EventTarget, name: string, shiftKey = false): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key: name, shiftKey, bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
}

function rect(top: number, bottom: number): DOMRect {
  return { top, bottom, left: 0, right: 100, width: 100, height: bottom - top, x: 0, y: top, toJSON: () => ({}) } as DOMRect;
}

function shown(element: Element, top = 0, bottom = 100): void {
  Object.defineProperty(element, 'getClientRects', { configurable: true, value: () => ({ length: 1 }) });
  Object.defineProperty(element, 'getBoundingClientRect', { configurable: true, value: () => rect(top, bottom) });
}

function focusables(rail: HTMLElement): HTMLElement[] {
  return Array.from(rail.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]'))
    .filter((element) => element.tabIndex >= 0 && !element.matches(':disabled') && element.closest('[hidden]') === null);
}

afterEach(async () => {
  for (const root of roots.splice(0)) await destroyEnhancement(root).catch(() => undefined);
  document.body.replaceChildren();
  if (initialWidth === undefined) delete (window as { innerWidth?: number }).innerWidth;
  else Object.defineProperty(window, 'innerWidth', initialWidth);
});

describe('contents rail interactions', () => {
  it('follows the root-local spy unit, exposes h3 subitems, and panel-centers only an outside active link', async () => {
    setWidth(1440);
    const queued = new Map<number, FrameRequestCallback>();
    const request = Object.getOwnPropertyDescriptor(window, 'requestAnimationFrame');
    const cancel = Object.getOwnPropertyDescriptor(window, 'cancelAnimationFrame');
    let next = 1;
    Object.defineProperty(window, 'requestAnimationFrame', { configurable: true, value: (fn: FrameRequestCallback): number => { const id = next; next += 1; queued.set(id, fn); return id; } });
    Object.defineProperty(window, 'cancelAnimationFrame', { configurable: true, value: (id: number): void => { queued.delete(id); } });
    const deliver = (): void => {
      while (queued.size > 0) {
        const cohort = [...queued.values()];
        queued.clear();
        for (const frame of cohort) frame(0);
      }
    };
    try {
      const root = mount();
      await enhance(root);
      deliver();
      const ctx = contextOf(root);
      if (ctx === undefined) throw new Error('missing context');
      const contents = root.querySelector('.toc-contents') as HTMLElement;
      const detail = root.querySelector('a[href="#detail"]') as HTMLElement;
      const design = root.querySelector('a[href="#2-design"]') as HTMLElement;
      const subitems = detail.closest('ul');
      shown(contents, 0, 300);
      shown(detail, 100, 120);
      shown(design, 400, 420);
      let panelTop = 5;
      const writes: number[] = [];
      Object.defineProperty(contents, 'scrollTop', { configurable: true, get: () => panelTop, set: (value: number) => { writes.push(value); panelTop = value; } });

      ctx.events.emit('spy', Object.freeze({ section: heading(root, '1-context'), unit: heading(root, 'detail') }));
      expect([detail.classList.contains('active'), detail.getAttribute('aria-current'), subitems?.parentElement?.localName]).toEqual([true, 'location', 'li']);
      deliver();
      expect(writes).toEqual([]);

      ctx.events.emit('spy', Object.freeze({ section: heading(root, '2-design'), unit: null }));
      expect([detail.classList.contains('active'), design.getAttribute('aria-current'), writes]).toEqual([false, 'location', []]);
      deliver();
      expect([writes, panelTop]).toEqual([[255], 255]);
    } finally {
      if (request === undefined) delete (window as { requestAnimationFrame?: unknown }).requestAnimationFrame;
      else Object.defineProperty(window, 'requestAnimationFrame', request);
      if (cancel === undefined) delete (window as { cancelAnimationFrame?: unknown }).cancelAnimationFrame;
      else Object.defineProperty(window, 'cancelAnimationFrame', cancel);
    }
  });

  it('reflects mark and change events in the matching contents rows', async () => {
    const root = mount();
    await enhance(root);
    const ctx = contextOf(root);
    if (ctx === undefined) throw new Error('missing context');
    const detail = root.querySelector('a[href="#detail"]') as HTMLElement;
    const design = root.querySelector('a[href="#2-design"]') as HTMLElement;

    ctx.events.emit('marks', Object.freeze({ units: Object.freeze([{ heading: heading(root, 'detail'), state: 'read' as const }]) }));
    ctx.events.emit('changes', Object.freeze({ sections: Object.freeze([heading(root, '2-design')]) }));

    expect([detail.querySelector('.mk')?.classList.contains('read'), detail.getAttribute('aria-description')]).toEqual([true, 'read']);
    expect(design.closest('li')?.classList.contains('has-chg')).toBe(true);
  });

  it('wraps visible drawer controls, closes once on Escape, restores its opener, and lets the scrim close it', async () => {
    setWidth(390);
    const root = mount();
    const opener = document.createElement('button');
    document.body.append(opener);
    await enhance(root);
    const rail = root.querySelector('nav.doc-toc') as HTMLElement;
    const button = root.querySelector('.toc-btn') as HTMLButtonElement;
    const scrim = root.querySelector('.toc-scrim') as HTMLElement;
    for (const control of rail.querySelectorAll('*')) shown(control);
    const disabled = document.createElement('button');
    disabled.tabIndex = 0;
    disabled.disabled = true;
    const hidden = document.createElement('button');
    hidden.hidden = true;
    rail.prepend(disabled);
    rail.append(hidden);

    opener.focus();
    button.click();
    const controls = focusables(rail);
    expect(root.classList.contains('toc-open')).toBe(true);
    expect(controls.length).toBeGreaterThan(1);
    expect(controls).not.toContain(disabled);
    expect(controls).not.toContain(hidden);
    controls.at(-1)?.focus();
    const forward = key(rail, 'Tab');
    expect([forward.defaultPrevented, document.activeElement]).toEqual([true, controls[0]]);
    controls[0]?.focus();
    const backward = key(rail, 'Tab', true);
    expect([backward.defaultPrevented, document.activeElement]).toEqual([true, controls.at(-1)]);

    const escape = key(rail, 'Escape');
    expect([escape.defaultPrevented, root.classList.contains('toc-open'), document.activeElement]).toEqual([true, false, opener]);
    button.click();
    scrim.click();
    expect(root.classList.contains('toc-open')).toBe(false);
  });

  it('uses a journaled root fallback only after its return targets disconnect, preserving host tabindex edits on destroy', async () => {
    setWidth(390);
    const root = mount();
    const other = mount();
    const opener = document.createElement('button');
    document.body.append(opener);
    await enhance(root);
    await enhance(other);
    const button = root.querySelector('.toc-btn') as HTMLButtonElement;
    const rail = root.querySelector('nav.doc-toc') as HTMLElement;

    opener.focus();
    button.click();
    opener.remove();
    button.remove();
    key(rail, 'Escape');

    expect([document.activeElement, root.getAttribute('tabindex'), other.hasAttribute('tabindex')]).toEqual([root, '-1', false]);
    root.setAttribute('tabindex', '0');
    await destroyEnhancement(root);
    roots.splice(roots.indexOf(root), 1);
    expect(root.getAttribute('tabindex')).toBe('0');
  });

  it('keeps an existing root tabindex when both drawer return targets disconnect', async () => {
    setWidth(390);
    const root = mount();
    const opener = document.createElement('button');
    document.body.append(opener);
    root.setAttribute('tabindex', '0');
    await enhance(root);
    const button = root.querySelector('.toc-btn') as HTMLButtonElement;
    const rail = root.querySelector('nav.doc-toc') as HTMLElement;

    opener.focus();
    button.click();
    opener.remove();
    button.remove();
    key(rail, 'Escape');

    expect([document.activeElement, root.getAttribute('tabindex')]).toEqual([root, '0']);
    await destroyEnhancement(root);
    roots.splice(roots.indexOf(root), 1);
    expect(root.getAttribute('tabindex')).toBe('0');
  });

  it('focuses an ordinary root during direct teardown before restoring its absent tabindex', async () => {
    setWidth(390);
    const root = mount();
    const opener = document.createElement('button');
    document.body.append(opener);
    await enhance(root);
    const button = root.querySelector('.toc-btn') as HTMLButtonElement;

    opener.focus();
    button.click();
    opener.remove();
    button.remove();
    let rootFocuses = 0;
    let focusOptions: FocusOptions | undefined;
    const originalFocus = root.focus.bind(root);
    Object.defineProperty(root, 'focus', {
      configurable: true,
      value: (options?: FocusOptions): void => {
        rootFocuses += 1;
        focusOptions = options;
        originalFocus(options);
      },
    });

    await destroyEnhancement(root);
    roots.splice(roots.indexOf(root), 1);

    expect([rootFocuses, focusOptions?.preventScroll, root.hasAttribute('tabindex')]).toEqual([1, true, false]);
  });

  it('leaves later root tabindex removal untouched after repeated drawer opens', async () => {
    setWidth(390);
    const root = mount();
    const opener = document.createElement('button');
    document.body.append(opener);
    await enhance(root);
    const button = root.querySelector('.toc-btn') as HTMLButtonElement;

    opener.focus();
    button.click();
    key(root.querySelector('nav.doc-toc') as HTMLElement, 'Escape');
    root.removeAttribute('tabindex');
    opener.focus();
    button.click();
    opener.remove();
    button.remove();

    await destroyEnhancement(root);
    roots.splice(roots.indexOf(root), 1);

    expect(root.hasAttribute('tabindex')).toBe(false);
  });

  it('uses Index without opening a desktop drawer, keeps roots isolated, and restores an open drawer before destroy', async () => {
    setWidth(1440);
    const wide = mount();
    await enhance(wide);
    key(wide, 'i');
    const wideRail = wide.querySelector('nav.doc-toc') as HTMLElement;
    expect([wideRail.querySelector('[role="tab"][aria-selected="true"]')?.textContent?.trim(), wide.classList.contains('toc-open'), wideRail.getAttribute('role')]).toEqual(['Index 1', false, null]);

    setWidth(390);
    const first = mount();
    const second = mount();
    const firstOpener = document.createElement('button');
    document.body.append(firstOpener);
    await enhance(first);
    await enhance(second);
    const firstButton = first.querySelector('.toc-btn') as HTMLButtonElement;
    firstOpener.focus();
    firstButton.click();
    key(second, 'i');
    expect([
      second.querySelector('[role="tab"][aria-selected="true"]')?.textContent?.trim(),
      second.classList.contains('toc-open'),
    ]).toEqual(['Index 1', true]);
    key(first.querySelector('nav.doc-toc') as HTMLElement, 'Escape');
    expect([first.classList.contains('toc-open'), second.classList.contains('toc-open')]).toEqual([false, true]);

    firstOpener.focus();
    firstButton.click();
    const teardown = destroyEnhancement(first);
    expect(document.activeElement).toBe(firstOpener);
    await teardown;
    roots.splice(roots.indexOf(first), 1);
    expect(document.activeElement).toBe(firstOpener);
  });

  it('does not focus the Index after its remembered tab write makes the context non-live', async () => {
    setWidth(390);
    const root = mount();
    let ctx: ReturnType<typeof contextOf>;
    await enhance(root, {
      storageKey: 'case',
      storage: {
        snapshot: {},
        set: () => { Object.defineProperty(ctx, 'live', { configurable: true, value: () => false }); },
      },
    });
    ctx = contextOf(root);
    if (ctx === undefined) throw new Error('missing context');
    const indexTab = root.querySelector('[role="tab"][aria-controls$="toc-index"]') as HTMLButtonElement;
    let focuses = 0;
    Object.defineProperty(indexTab, 'focus', { configurable: true, value: () => { focuses += 1; } });

    key(root, 'i');

    expect(focuses).toBe(0);
  });

  it('does not focus a tab after its roving write makes the context non-live', async () => {
    setWidth(390);
    const root = mount();
    let ctx: ReturnType<typeof contextOf>;
    await enhance(root, {
      storageKey: 'case',
      storage: {
        snapshot: {},
        set: () => { Object.defineProperty(ctx, 'live', { configurable: true, value: () => false }); },
      },
    });
    ctx = contextOf(root);
    if (ctx === undefined) throw new Error('missing context');
    const tabs = root.querySelector('.toc-tabs') as HTMLElement;
    const indexTab = root.querySelector('[role="tab"][aria-controls$="toc-index"]') as HTMLButtonElement;
    let focuses = 0;
    Object.defineProperty(indexTab, 'focus', { configurable: true, value: () => { focuses += 1; } });

    key(tabs, 'ArrowRight');

    expect(focuses).toBe(0);
  });

  it('uses the visible Index tab instead of a folded index link for the i shortcut', async () => {
    setWidth(390);
    const root = mount();
    await enhance(root, {
      storageKey: 'case',
      storage: { snapshot: { 'docreader:doc:case:ixfold': JSON.stringify({ '4. Decisions': true, Decisions: true, Index: true }) } },
    });
    const indexLink = root.querySelector('.toc-index a') as HTMLElement;
    const indexTab = root.querySelector('[role="tab"][aria-controls$="toc-index"]') as HTMLButtonElement;

    expect(indexLink.closest('[hidden]')).not.toBeNull();
    key(root, 'i');

    expect(document.activeElement).toBe(indexTab);
  });

  it('closes the drawer after contents and index navigation without restoring its opener', async () => {
    setWidth(390);
    const root = mount();
    const opener = document.createElement('button');
    document.body.append(opener);
    await enhance(root);
    const button = root.querySelector('.toc-btn') as HTMLButtonElement;
    const contentsLink = root.querySelector('a[href="#1-context"]') as HTMLAnchorElement;
    const indexLink = root.querySelector('.toc-index a') as HTMLAnchorElement;

    opener.focus();
    button.click();
    const contentsClick = new MouseEvent('click', { bubbles: true, cancelable: true });
    contentsLink.dispatchEvent(contentsClick);
    expect([contentsClick.defaultPrevented, root.classList.contains('toc-open'), document.activeElement]).toEqual([true, false, heading(root, '1-context')]);

    button.click();
    const indexClick = new MouseEvent('click', { bubbles: true, cancelable: true });
    indexLink.dispatchEvent(indexClick);
    expect([indexClick.defaultPrevented, root.classList.contains('toc-open')]).toEqual([true, false]);
  });

  it('keeps the drawer open for modified or unresolved panel links delegated to the host', async () => {
    setWidth(390);
    const seen: string[] = [];
    const root = mount();
    await enhance(root, { onLink: (href) => { seen.push(href); } });
    const button = root.querySelector('.toc-btn') as HTMLButtonElement;
    const contentsLink = root.querySelector('a[href="#1-context"]') as HTMLAnchorElement;

    button.click();
    contentsLink.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true }));
    expect([root.classList.contains('toc-open'), seen]).toEqual([true, ['#1-context']]);

    contentsLink.setAttribute('href', '#missing');
    contentsLink.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect([root.classList.contains('toc-open'), seen]).toEqual([true, ['#1-context', '#missing']]);
  });
});
