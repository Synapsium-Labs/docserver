// Task 18's browser-source parity: Index structure and source-owned accessibility.
import { afterAll, expect, it } from 'vitest';
import { closeBrowsers, describeBrowsers, openDoc } from './harness.js';

const MARKDOWN = [
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
  '`AB-ONE` - _Proposed_ (context): The rule title.',
].join('\n');

const authorityRows = (count: number, prefix: string): string => [
  '| ID | State | Status | Decision |',
  '| --- | --- | --- | --- |',
  ...Array.from({ length: count }, (_, index) => `| ${prefix}${String(index)} | Blocked | Agreed | ${prefix} decision ${String(index)}. |`),
].join('\n');

const AUTHORITY_MARKDOWN = [
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

afterAll(closeBrowsers);

describeBrowsers((browser) => {
  it('renders the Index tab, dense groups, rows, and status labels from their sources', async () => {
    const doc = await openDoc(MARKDOWN, { chrome: { rail: true }, rules: true }, { browser, viewport: { width: 1440, height: 900 } });
    try {
      const result = await doc.page.evaluate(() => {
        const root = document.querySelector('main[data-harness-root]') as HTMLElement;
        const rail = root.querySelector('.doc-toc') as HTMLElement;
        const indexTab = rail.querySelector('[role="tab"][aria-controls$="toc-index"]') as HTMLElement;
        const groups = Array.from(rail.querySelectorAll('.toc-index > .ix-group')).map((group) => ({
          title: group.querySelector('.gt')?.textContent,
          count: group.querySelector('.c')?.textContent,
        }));
        const long = rail.querySelector('a.ix[href="#LONG-123"]') as HTMLAnchorElement;
        const agreed = long.querySelector('.dot') as HTMLElement;
        const proposed = rail.querySelector('a.ix[href="#AB-ONE"] .dot') as HTMLElement;
        const plain = rail.querySelector('a.ix[href="#D1"] .dot') as HTMLElement;
        return {
          tab: [indexTab.childNodes[0]?.textContent, indexTab.querySelector('.count')?.textContent, indexTab.textContent],
          groups,
          long: [long.querySelector('.ix-id')?.className, long.querySelector('.t')?.textContent, long.getAttribute('title')],
          agreed: [agreed.className, agreed.getAttribute('role'), agreed.getAttribute('aria-label')],
          proposed: [proposed.className, proposed.getAttribute('aria-label')],
          plain: [plain.className, plain.getAttribute('aria-hidden')],
        };
      });
      expect(result).toEqual({
        tab: ['Index', ' 5', 'Index 5'],
        groups: [
          { title: 'Decisions', count: '3' },
          { title: 'Earlier', count: '1' },
          { title: 'Rules', count: '1' },
        ],
        long: ['ix-id long', 'A long identifier.', 'LONG-123 · A long identifier. (Agreed)'],
        agreed: ['dot ok', 'img', 'Agreed'],
        proposed: ['dot wait', 'Proposed'],
        plain: ['dot none', 'true'],
      });
    } finally {
      await doc.close();
    }
  });

  it('uses row and rule status authorities and stable dense-count ordering', async () => {
    const doc = await openDoc(AUTHORITY_MARKDOWN, { chrome: { rail: true }, rules: true }, { browser, viewport: { width: 1440, height: 900 } });
    try {
      const present = await doc.page.evaluate(() => {
        const root = document.querySelector('main[data-harness-root]');
        const rail = root?.querySelector('.doc-toc');
        return {
          root: root !== null,
          rail: rail !== null,
          row: rail?.querySelector('a.ix[href="#A0"]') !== null,
          rule: rail?.querySelector('a.ix[href="#AB-ONE"]') !== null,
        };
      });
      expect(present).toEqual({ root: true, rail: true, row: true, rule: true });
      const result = await doc.page.evaluate(() => {
        const rail = (document.querySelector('main[data-harness-root]') as HTMLElement).querySelector('.doc-toc') as HTMLElement;
        const groups = Array.from(rail.querySelectorAll('.toc-index > .ix-group')).map((group) => ({
          title: group.querySelector('.gt')?.textContent,
          count: group.querySelector('.c')?.textContent,
          rows: Array.from(document.getElementById(group.getAttribute('aria-controls') ?? '')?.querySelectorAll('a.ix') ?? []).map((link) => link.getAttribute('href')),
        }));
        const row = rail.querySelector('a.ix[href="#A0"]') as HTMLAnchorElement;
        const rule = rail.querySelector('a.ix[href="#AB-ONE"]') as HTMLAnchorElement;
        return {
          groups,
          row: [row.querySelector('.dot')?.getAttribute('aria-label'), row.getAttribute('title')],
          rule: [rule.querySelector('.dot')?.getAttribute('aria-label'), rule.getAttribute('title')],
        };
      });
      expect(result).toEqual({
        groups: [
          { title: 'Four', count: '4', rows: ['#C0', '#C1', '#C2', '#C3'] },
          { title: 'Three', count: '3', rows: ['#B0', '#B1', '#B2'] },
          { title: 'Tie', count: '3', rows: ['#D0', '#D1', '#D2'] },
          { title: 'Sparse', count: '2', rows: ['#A0', '#A1'] },
          { title: 'Rules', count: '1', rows: ['#AB-ONE'] },
        ],
        row: ['Agreed', 'A0 · A decision 0. (Agreed)'],
        rule: ['Proposed', 'AB-ONE · The rule title (Proposed)'],
      });
    } finally {
      await doc.close();
    }
  });

  it('leaves a focused direct HTML child untouched when the narrow drawer closes', async () => {
    const doc = await openDoc(MARKDOWN, { chrome: { rail: true } }, { browser, viewport: { width: 390, height: 844 } });
    try {
      const present = await doc.page.evaluate(() => {
        const root = document.querySelector('main[data-harness-root]');
        return { root: root !== null, toggle: root?.querySelector('.toc-btn') !== null, rail: root?.querySelector('.doc-toc') !== null };
      });
      expect(present).toEqual({ root: true, toggle: true, rail: true });
      const result = await doc.page.evaluate(() => {
        const root = document.querySelector('main[data-harness-root]') as HTMLElement;
        const opener = document.createElement('button');
        const host = document.createElement('button');
        document.body.append(opener);
        opener.focus();
        (root.querySelector('.toc-btn') as HTMLButtonElement).click();
        document.documentElement.append(host);
        host.focus();
        const before = document.activeElement === host;
        (root.querySelector('.doc-toc') as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
        const after = document.activeElement === host;
        host.remove();
        opener.remove();
        return { before, after };
      });
      expect(result).toEqual({ before: true, after: true });
    } finally {
      await doc.close();
    }
  });
});
describeBrowsers((browser) => {
  for (const [shape, restores] of [
    ['ordinary', true],
    ['second XHTML body after the true body', true],
    ['XHTML frameset before the body', true],
    ['foreign XHTML-name body before the true body', true],
    ['foreign XHTML-name frameset before the true body', true],
    ['nested XHTML body', false],
    ['later XHTML body after an earlier frameset', false],
    ['direct HTML host button after an earlier frameset', false],
  ] as const) {
    it(`returns focus only from the first direct XHTML body-or-frameset: ${shape}`, async () => {
      const doc = await openDoc(MARKDOWN, { chrome: { rail: true } }, { browser, viewport: { width: 390, height: 844 } });
      try {
        const result = await doc.page.evaluate(async ({ kind, shouldRestore }) => {
          const body = document.body;
          const bodyTabindex = body.getAttribute('tabindex');
          const root = document.querySelector('main[data-harness-root]') as HTMLElement;
          const opener = document.createElement('button');
          const extras: Element[] = [];
          let focused: HTMLElement = body;
          let focusedTabindex: string | null = null;
          try {
            body.append(opener);
            opener.focus();
            (root.querySelector('.toc-btn') as HTMLButtonElement).click();
            if (kind === 'second XHTML body after the true body') {
              const second = document.createElement('body');
              document.documentElement.append(second);
              extras.push(second);
            } else if (kind === 'XHTML frameset before the body') {
              const frameset = document.createElement('frameset');
              document.documentElement.insertBefore(frameset, body);
              extras.push(frameset);
              focused = document.body;
            } else if (kind === 'foreign XHTML-name body before the true body') {
              const foreign = document.createElementNS('urn:host', 'body');
              document.documentElement.insertBefore(foreign, body);
              extras.push(foreign);
            } else if (kind === 'foreign XHTML-name frameset before the true body') {
              const foreign = document.createElementNS('urn:host', 'frameset');
              document.documentElement.insertBefore(foreign, body);
              extras.push(foreign);
            } else if (kind === 'nested XHTML body') {
              const nestedHtml = document.createElement('html');
              const nested = document.createElement('body');
              nestedHtml.append(nested);
              root.append(nestedHtml);
              extras.push(nestedHtml);
              focused = nested;
            } else if (kind === 'later XHTML body after an earlier frameset') {
              const frameset = document.createElement('frameset');
              document.documentElement.insertBefore(frameset, body);
              extras.push(frameset);
            } else if (kind === 'direct HTML host button after an earlier frameset') {
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
            const focusedBeforeEscape = document.activeElement === focused;
            const focusedIsActualBody = focused === document.body;
            (root.querySelector('.doc-toc') as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
            return {
              focusedBeforeEscape,
              focusedIsActualBody,
              focusAfterEscape: document.activeElement === (shouldRestore ? opener : focused),
              closed: !root.classList.contains('toc-open'),
            };
          } finally {
            if (focusedTabindex === null) focused.removeAttribute('tabindex');
            else focused.setAttribute('tabindex', focusedTabindex);
            await (window.__docreaderHarness as { destroy(): Promise<void> }).destroy();
            for (const extra of [...extras].reverse()) extra.remove();
            if (bodyTabindex === null) body.removeAttribute('tabindex');
            else body.setAttribute('tabindex', bodyTabindex);
            opener.remove();
          }
        }, { kind: shape, shouldRestore: restores });
        expect(result.focusedBeforeEscape).toBe(true);
        expect(result.focusedIsActualBody).toBe(restores);
        expect(result.focusAfterEscape).toBe(true);
        expect(result.closed).toBe(true);
      } finally {
        await doc.close();
      }
    });
  }
});
