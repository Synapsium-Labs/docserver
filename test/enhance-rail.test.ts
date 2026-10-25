// @vitest-environment jsdom
// Read marks and the contents rail (docserver L2, Task 18).
import { afterEach, describe, expect, it } from 'vitest';
import { destroyEnhancement, enhance, type EnhanceOptions } from '../src/enhance/index.js';
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
  '## 2. Design',
  '',
  'The second section.',
  '',
  '## 3. Notes',
  '',
  'The third section.',
].join('\n');

const authorityRows = (count: number, prefix: string): string => [
  '| ID | State | Status | Decision |',
  '| --- | --- | --- | --- |',
  ...Array.from({ length: count }, (_, index) => `| ${prefix}${String(index)} | Blocked | Agreed | ${prefix} decision ${String(index)}. |`),
].join('\n');

const AUTHORITY_DOC = [
  '# Index authority',
  '',
  '## 1. Sparse',
  '',
  authorityRows(2, 'A'),
  '',
  '## 2. Three',
  '',
  authorityRows(3, 'B'),
  '',
  '## 3. Four',
  '',
  authorityRows(4, 'C'),
  '',
  '## 4. Tie',
  '',
  authorityRows(3, 'D'),
  '',
  '## 5. Rules',
  '',
  '`AB-ONE` - _Proposed_ (context): The rule title.',
].join('\n');

const mounted: HTMLElement[] = [];

function mount(md = DOC): HTMLElement {
  const parsed = new DOMParser().parseFromString(`<!doctype html><body>${render(md).html}`, 'text/html');
  const root = document.createElement('main');
  root.append(...Array.from(parsed.body.childNodes).map((node) => document.importNode(node, true)));
  document.body.append(root);
  mounted.push(root);
  return root;
}

function heading(root: Element, id: string): HTMLElement {
  const found = Array.from(root.children).find((node) => node.localName === 'h2' && node.id === id);
  if (found === undefined) throw new Error(`no heading ${id}`);
  return found as HTMLElement;
}

const mark = (root: Element, id: string): HTMLButtonElement => heading(root, id).querySelector('.h-mark') as HTMLButtonElement;

function storage(snapshot: Record<string, string> = {}): EnhanceOptions {
  return { storageKey: 'case', storage: { snapshot } };
}

afterEach(async () => {
  for (const root of mounted.splice(0)) await destroyEnhancement(root).catch(() => undefined);
  document.body.replaceChildren();
});

describe('contents rail', () => {
  it('builds Contents and Index tabs, remembers the chosen tab, and registers the drawer', async () => {
    const writes: [string, string | null][] = [];
    const root = mount([
      DOC,
      '',
      '## 4. Decisions',
      '',
      '| ID | Status | Decision |',
      '| --- | --- | --- |',
      '| R1 | Agreed | Keep the reader local. |',
    ].join('\n'));
    await enhance(root, { ...storage(), storage: { snapshot: {}, set: (key, value) => { writes.push([key, value]); } } });

    const rail = root.querySelector('nav.doc-toc') as HTMLElement;
    const tabs = Array.from(rail.querySelectorAll('[role="tab"]')) as HTMLButtonElement[];
    expect(root.classList.contains('has-toc')).toBe(true);
    expect(tabs.map((tab) => [tab.textContent?.trim(), tab.getAttribute('aria-selected')])).toEqual([['Contents', 'true'], ['Index 1', 'false']]);
    tabs[1]?.click();
    expect(tabs.map((tab) => tab.getAttribute('aria-selected'))).toEqual(['false', 'true']);
    expect(writes.at(-1)).toEqual(['docreader:ui', JSON.stringify({ sidetab: 'index' })]);
    expect(root.querySelector('.toc-btn')).not.toBeNull();
  });

  it('structures and prioritizes index groups, including their status descriptions', async () => {
    const root = mount([
      '# Index structure',
      '',
      '## 1. Earlier',
      '',
      '| ID | Meaning |',
      '| --- | --- |',
      '| D1 | An earlier definition. |',
      '',
      '## 2. Decisions',
      '',
      '| ID | Status | Decision |',
      '| --- | --- | --- |',
      '| D2 | Agreed | First accepted decision. |',
      '| D3 | Agreed | Second accepted decision. |',
      '| LONG-123 | Agreed | A long identifier. |',
      '',
      '## 3. Later',
      '',
      '`AB-ONE` — _Proposed_ (context): The rule title.',
    ].join('\n'));
    await enhance(root, { ...storage(), rules: true });

    const rail = root.querySelector('nav.doc-toc') as HTMLElement;
    const tab = rail.querySelector('[role="tab"][aria-controls$="toc-index"]') as HTMLButtonElement;
    expect([tab.childNodes[0]?.textContent, tab.querySelector('.count')?.textContent, tab.textContent]).toEqual(['Index', ' 5', 'Index 5']);

    const groups = Array.from(rail.querySelectorAll('.toc-index > .ix-group')) as HTMLButtonElement[];
    expect(groups.map((group) => [group.querySelector('.gt')?.textContent, group.querySelector('.c')?.textContent])).toEqual([
      ['Decisions', '3'],
      ['Earlier', '1'],
      ['Rules', '1'],
    ]);

    const long = rail.querySelector('.ix-id.long') as HTMLElement;
    const longLink = long.closest('a') as HTMLAnchorElement;
    const rule = rail.querySelector('a.ix[href="#AB-ONE"]') as HTMLAnchorElement;
    const agreed = rail.querySelector('.ix-id.long + .t + .dot') as HTMLElement;
    const proposed = rule.querySelector('.dot') as HTMLElement;
    const unmarked = rail.querySelector('a.ix[href="#D1"] .dot') as HTMLElement;
    expect([long.textContent, longLink.querySelector('.t')?.textContent, longLink.getAttribute('title')]).toEqual([
      'LONG-123',
      'A long identifier.',
      'LONG-123 · A long identifier. (Agreed)',
    ]);
    expect([agreed.className, agreed.getAttribute('role'), agreed.getAttribute('aria-label')]).toEqual(['dot ok', 'img', 'Agreed']);
    expect([proposed.className, proposed.getAttribute('aria-label')]).toEqual(['dot wait', 'Proposed']);
    expect([unmarked.className, unmarked.getAttribute('aria-hidden')]).toEqual(['dot none', 'true']);
  });

  it('uses the last row status and dense-count order while preserving source-order ties', async () => {
    const root = mount(AUTHORITY_DOC);
    const original = root.innerHTML;
    await enhance(root, { ...storage(), rules: true });

    const rail = root.querySelector('nav.doc-toc');
    expect(rail).not.toBeNull();
    const groups = Array.from((rail as HTMLElement).querySelectorAll('.toc-index > .ix-group'));
    expect(groups.map((group) => [group.querySelector('.gt')?.textContent, group.querySelector('.c')?.textContent])).toEqual([
      ['Four', '4'],
      ['Three', '3'],
      ['Tie', '3'],
      ['Sparse', '2'],
      ['Rules', '1'],
    ]);
    expect(groups.map((group) => Array.from(document.getElementById(group.getAttribute('aria-controls') ?? '')?.querySelectorAll('a.ix') ?? []).map((link) => link.getAttribute('href')))).toEqual([
      ['#C0', '#C1', '#C2', '#C3'],
      ['#B0', '#B1', '#B2'],
      ['#D0', '#D1', '#D2'],
      ['#A0', '#A1'],
      ['#AB-ONE'],
    ]);

    const row = rail?.querySelector('a.ix[href="#A0"]');
    const rule = rail?.querySelector('a.ix[href="#AB-ONE"]');
    expect(row).not.toBeNull();
    expect(rule).not.toBeNull();
    expect([row?.querySelector('.dot')?.getAttribute('aria-label'), row?.getAttribute('title')]).toEqual([
      'Agreed',
      'A0 · A decision 0. (Agreed)',
    ]);
    expect([rule?.querySelector('.dot')?.getAttribute('aria-label'), rule?.getAttribute('title')]).toEqual([
      'Proposed',
      'AB-ONE · The rule title (Proposed)',
    ]);

    await destroyEnhancement(root);
    expect(root.innerHTML).toBe(original);
  });

  it('returns focus from the actual document body when the narrow drawer closes', async () => {
    const width = Object.getOwnPropertyDescriptor(window, 'innerWidth');
    const bodyTabindex = document.body.getAttribute('tabindex');
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    try {
      const root = mount(DOC);
      await enhance(root, storage());
      const opener = document.createElement('button');
      document.body.append(opener);
      opener.focus();
      const toggle = root.querySelector('.toc-btn');
      const rail = root.querySelector('nav.doc-toc');
      expect(toggle).not.toBeNull();
      expect(rail).not.toBeNull();
      (toggle as HTMLButtonElement).click();
      document.body.setAttribute('tabindex', '-1');
      document.body.focus();
      expect(document.activeElement).toBe(document.body);
      (rail as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      expect(document.activeElement).toBe(opener);
    } finally {
      if (bodyTabindex === null) document.body.removeAttribute('tabindex');
      else document.body.setAttribute('tabindex', bodyTabindex);
      if (width === undefined) Reflect.deleteProperty(window, 'innerWidth');
      else Object.defineProperty(window, 'innerWidth', width);
    }
  });

  it.each([
    ['ordinary', true],
    ['second XHTML body after the true body', true],
    ['XHTML frameset before the body', true],
    ['foreign XHTML-name body before the true body', true],
    ['foreign XHTML-name frameset before the true body', true],
    ['nested XHTML body', false],
    ['later XHTML body after an earlier frameset', false],
    ['direct HTML host button after an earlier frameset', false],
  ] as const)('returns focus only from the first direct XHTML body-or-frameset: %s', async (shape, restores) => {
    const width = Object.getOwnPropertyDescriptor(window, 'innerWidth');
    const body = document.body;
    const bodyTabindex = body.getAttribute('tabindex');
    const extras: Element[] = [];
    let root: HTMLElement | null = null;
    let opener: HTMLButtonElement | null = null;
    let focused: HTMLElement = body;
    let focusedTabindex: string | null = null;
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    try {
      root = mount(DOC);
      await enhance(root, storage());
      opener = document.createElement('button');
      body.append(opener);
      opener.focus();
      const toggle = root.querySelector('.toc-btn');
      const rail = root.querySelector('.doc-toc');
      expect(toggle).not.toBeNull();
      expect(rail).not.toBeNull();
      (toggle as HTMLButtonElement).click();
      if (shape === 'second XHTML body after the true body') {
        const second = document.createElement('body');
        document.documentElement.append(second);
        extras.push(second);
      } else if (shape === 'XHTML frameset before the body') {
        const frameset = document.createElement('frameset');
        document.documentElement.insertBefore(frameset, body);
        extras.push(frameset);
        focused = document.body;
      } else if (shape === 'foreign XHTML-name body before the true body') {
        const foreign = document.createElementNS('urn:host', 'body');
        document.documentElement.insertBefore(foreign, body);
        extras.push(foreign);
      } else if (shape === 'foreign XHTML-name frameset before the true body') {
        const foreign = document.createElementNS('urn:host', 'frameset');
        document.documentElement.insertBefore(foreign, body);
        extras.push(foreign);
      } else if (shape === 'nested XHTML body') {
        const nestedHtml = document.createElement('html');
        const nested = document.createElement('body');
        nestedHtml.append(nested);
        root.append(nestedHtml);
        extras.push(nestedHtml);
        focused = nested;
      } else if (shape === 'later XHTML body after an earlier frameset') {
        const frameset = document.createElement('frameset');
        document.documentElement.insertBefore(frameset, body);
        extras.push(frameset);
      } else if (shape === 'direct HTML host button after an earlier frameset') {
        const frameset = document.createElement('frameset');
        const host = document.createElement('button');
        document.documentElement.insertBefore(frameset, body);
        document.documentElement.append(host);
        extras.push(frameset, host);
        focused = host;
      }
      focusedTabindex = focused.getAttribute('tabindex');
      focused.setAttribute('tabindex', '-1');
      focused.focus();
      expect(document.activeElement).toBe(focused);
      expect(focused === document.body).toBe(restores);
      (rail as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      expect(document.activeElement).toBe(restores ? opener : focused);
      expect(root.classList.contains('toc-open')).toBe(false);
    } finally {
      if (focusedTabindex === null) focused.removeAttribute('tabindex');
      else focused.setAttribute('tabindex', focusedTabindex);
      if (root !== null) {
        await destroyEnhancement(root);
        const index = mounted.indexOf(root);
        if (index >= 0) mounted.splice(index, 1);
      }
      for (const extra of [...extras].reverse()) extra.remove();
      opener?.remove();
      if (bodyTabindex === null) body.removeAttribute('tabindex');
      else body.setAttribute('tabindex', bodyTabindex);
      if (width === undefined) Reflect.deleteProperty(window, 'innerWidth');
      else Object.defineProperty(window, 'innerWidth', width);
    }
  });

  it('leaves a direct HTML child focused when the narrow drawer closes', async () => {
    const width = Object.getOwnPropertyDescriptor(window, 'innerWidth');
    const host = document.createElement('button');
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    try {
      const root = mount(DOC);
      await enhance(root, storage());
      const opener = document.createElement('button');
      document.body.append(opener);
      opener.focus();
      const toggle = root.querySelector('.toc-btn');
      const rail = root.querySelector('nav.doc-toc');
      expect(toggle).not.toBeNull();
      expect(rail).not.toBeNull();
      (toggle as HTMLButtonElement).click();
      document.documentElement.append(host);
      host.focus();
      expect(document.activeElement).toBe(host);
      (rail as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      expect(document.activeElement).toBe(host);
    } finally {
      host.remove();
      if (width === undefined) Reflect.deleteProperty(window, 'innerWidth');
      else Object.defineProperty(window, 'innerWidth', width);
    }
  });
});

describe('read marks', () => {
  it('marks a section read and persists its source fingerprint', async () => {
    const root = mount();
    const writes: [string, string | null][] = [];
    await enhance(root, { ...storage(), storage: { snapshot: {}, set: (key, value) => { writes.push([key, value]); } } });

    const control = mark(root, '1-context');
    expect([control.textContent, control.getAttribute('aria-pressed')]).toEqual(['Mark read', 'false']);
    control.click();

    expect([control.textContent, control.getAttribute('aria-pressed')]).toEqual(['Read', 'true']);
    expect(writes).toHaveLength(1);
    expect(writes[0]?.[0]).toBe('docreader:doc:case:marks');
    expect(JSON.parse(writes[0]?.[1] ?? '{}')).toEqual({ '1-context': expect.any(String) });
  });

  it('shows a changed section when its persisted fingerprint differs', async () => {
    const writes: [string, string | null][] = [];
    const before = mount();
    await enhance(before, { ...storage(), storage: { snapshot: {}, set: (key, value) => { writes.push([key, value]); } } });
    mark(before, '1-context').click();
    const snapshot = { 'docreader:doc:case:marks': writes[0]?.[1] ?? '{}' };
    await destroyEnhancement(before);
    mounted.splice(mounted.indexOf(before), 1);
    before.remove();

    const after = mount(DOC.replace('The first section.', 'A changed first section.'));
    await enhance(after, storage(snapshot));

    expect([mark(after, '1-context').textContent, mark(after, '1-context').classList.contains('changed')]).toEqual(['Changed since you read it', true]);
  });

  it('uses the current spy unit for m and emits each mark state', async () => {
    const root = mount();
    await enhance(root, storage());
    const { contextOf } = await import('../src/enhance/lifecycle.js');
    const ctx = contextOf(root);
    if (ctx === undefined) throw new Error('no context');
    const seen: string[][] = [];
    ctx.events.on('marks', ({ units }) => seen.push(units.map(({ heading, state }) => `${heading.id}:${state}`)));
    ctx.events.emit('spy', Object.freeze({ section: heading(root, '1-context'), unit: heading(root, '1-context') }));
    root.dispatchEvent(new KeyboardEvent('keydown', { key: 'm', bubbles: true }));

    expect(mark(root, '1-context').getAttribute('aria-pressed')).toBe('true');
    expect(seen.at(-1)).toContain('1-context:read');
  });

  it('keeps only valid own mark records for clobbering ids', async () => {
    const root = mount();
    const first = heading(root, '1-context');
    const second = heading(root, '2-design');
    first.id = '__proto__';
    second.id = 'constructor';
    const writes: [string, string | null][] = [];
    await enhance(root, {
      ...storage({ 'docreader:doc:case:marks': JSON.stringify({ __proto__: 'x'.repeat(8), constructor: 'old', '[bad]': 'old', extra: 'old' }) }),
      storage: { snapshot: { 'docreader:doc:case:marks': JSON.stringify({ __proto__: 'x'.repeat(8), constructor: 'old', '[bad]': 'old', extra: 'old' }) }, set: (key, value) => { writes.push([key, value]); } },
    });

    mark(root, '__proto__').click();
    mark(root, 'constructor').click();
    expect(Object.keys(JSON.parse(writes.at(-1)?.[1] ?? '{}')).sort()).toEqual(['__proto__', 'constructor']);
  });
});
