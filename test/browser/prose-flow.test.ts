// Desktop rail placement must not change the source document's normal-flow rhythm.
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { render } from '../../src/render/index.js';
import { closeBrowsers, describeBrowsers, openDoc, type BrowserName } from './harness.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const ENTRY = [
  "import { enhance } from './src/enhance/index.ts';",
  '(window as unknown as { __proseFlow: unknown }).__proseFlow = { enhance };',
].join('\n');
let script = '';

const FLOW_MARKDOWN = [
  '---',
  'Status: Draft',
  '---',
  '',
  '# Flow parity',
  '',
  '**Design** · **Status:** Draft',
  '',
  'The opening prose establishes the same fixed reading measure in both documents.',
  '',
  '## Adjacent heading',
  '',
  'The heading and this paragraph must retain their collapsed boundary.',
  '',
  'A paragraph immediately before the nested list makes its outer bounds observable.',
  '',
  '- First outer item',
  '  - Nested first item',
  '  - Nested terminal item',
  '- Outer terminal item',
  '',
  'A final paragraph follows the terminal list.',
  '',
  '## Rail heading one',
  '',
  'This additional heading gives the real contents rail a second target.',
  '',
  '## Rail heading two',
  '',
  'This additional heading gives the real contents rail a third target.',
  '',
  '## Rail heading three',
  '',
  'This additional heading keeps the contents rail active.',
].join('\n');

const COLOR_MARKDOWN = [
  '# Code palette',
  '',
  'The sibling prose carries the resolved reader text colour.',
  '',
  '```text',
  'neutral source sample',
  '```',
].join('\n');

interface FlowMetrics {
  readonly gaps: readonly number[];
  readonly outerListHeight: number;
  readonly nestedListHeight: number;
  readonly outerTerminalToListBottom: number;
  readonly nestedTerminalToListBottom: number;
  readonly factsToOpeningGap: number;
}

function difference(a: number, b: number): number {
  return Math.abs(a - b);
}

async function flowMetrics(browser: BrowserName, rail: boolean): Promise<FlowMetrics> {
  const doc = await openDoc(FLOW_MARKDOWN, {
    chrome: { rail },
    info: { frontList: [{ key: 'Status', list: true, vals: ['Draft'] }] },
  }, { browser, viewport: { width: 1440, height: 900 } });
  try {
    return await doc.page.evaluate(() => {
      const root = document.querySelector('main[data-harness-root]') as HTMLElement;
      const facts = root.querySelector('.doc-facts') as HTMLElement;
      const opening = Array.from(root.querySelectorAll('p')).find((element) => element.textContent === 'The opening prose establishes the same fixed reading measure in both documents.') as HTMLElement;
      const paragraph = Array.from(root.querySelectorAll('p')).find((element) => element.textContent === 'The heading and this paragraph must retain their collapsed boundary.') as HTMLElement;
      const preceding = Array.from(root.querySelectorAll('p')).find((element) => element.textContent === 'A paragraph immediately before the nested list makes its outer bounds observable.') as HTMLElement;
      const following = Array.from(root.querySelectorAll('p')).find((element) => element.textContent === 'A final paragraph follows the terminal list.') as HTMLElement;
      const heading = Array.from(root.querySelectorAll('h2')).find((element) => element.textContent?.startsWith('Adjacent heading')) as HTMLElement;
      const outer = preceding.nextElementSibling as HTMLUListElement;
      const nested = outer.querySelector('ul') as HTMLUListElement;
      const outerTerminal = outer.lastElementChild as HTMLLIElement;
      const nestedTerminal = nested.lastElementChild as HTMLLIElement;
      const box = (element: Element): DOMRect => element.getBoundingClientRect();
      const gap = (before: Element, after: Element): number => box(after).top - box(before).bottom;
      const outerBox = box(outer);
      const nestedBox = box(nested);
      return {
        gaps: [
          gap(heading, paragraph),
          gap(paragraph, preceding),
          gap(preceding, outer),
          gap(outer, following),
        ],
        outerListHeight: outerBox.height,
        nestedListHeight: nestedBox.height,
        outerTerminalToListBottom: outerBox.bottom - box(outerTerminal).bottom,
        nestedTerminalToListBottom: nestedBox.bottom - box(nestedTerminal).bottom,
        factsToOpeningGap: gap(facts, opening),
      };
    });
  } finally {
    await doc.close();
  }
}

beforeAll(async () => {
  const result = await build({
    stdin: { contents: ENTRY, resolveDir: ROOT, sourcefile: 'prose-flow-entry.ts', loader: 'ts' },
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    target: 'es2022',
    logLevel: 'silent',
  });
  script = result.outputFiles[0]?.text ?? '';
});

describeBrowsers((browser) => {
  it('keeps fixed-measure prose gaps and terminal list bounds when the desktop rail is enabled', async () => {
    const withoutRail = await flowMetrics(browser, false);
    const withRail = await flowMetrics(browser, true);

    expect(withRail.gaps).toHaveLength(withoutRail.gaps.length);
    for (const [index, gap] of withRail.gaps.entries()) {
      expect(difference(gap, withoutRail.gaps[index] ?? Number.NaN)).toBeLessThanOrEqual(0.1);
    }
    expect(difference(withRail.outerListHeight, withoutRail.outerListHeight)).toBeLessThanOrEqual(0.1);
    expect(difference(withRail.nestedListHeight, withoutRail.nestedListHeight)).toBeLessThanOrEqual(0.1);
    expect(difference(withRail.outerTerminalToListBottom, withoutRail.outerTerminalToListBottom)).toBeLessThanOrEqual(0.1);
    expect(difference(withRail.nestedTerminalToListBottom, withoutRail.nestedTerminalToListBottom)).toBeLessThanOrEqual(0.1);
    expect(difference(withRail.factsToOpeningGap, withoutRail.factsToOpeningGap)).toBeLessThanOrEqual(0.1);
  });

  it('confines each sticky rail and full-width bar to its own offset root', async () => {
    const html = render(FLOW_MARKDOWN).html;
    const doc = await openDoc(FLOW_MARKDOWN, {}, {
      browser,
      viewport: { width: 1440, height: 900 },
      enhance: false,
      html: (first) => `${first}</main><main data-second-root>${html}</main>`,
    });
    try {
      await doc.page.evaluate(script);
      const before = await doc.page.evaluate(async () => {
        const reader = window as unknown as { __proseFlow: { enhance(root: HTMLElement, options: unknown): Promise<void> } };
        const first = document.querySelector('main[data-harness-root]') as HTMLElement;
        const second = document.querySelector('main[data-second-root]') as HTMLElement;
        second.style.marginTop = '900px';
        await reader.__proseFlow.enhance(first, { chrome: { rail: true } });
        await reader.__proseFlow.enhance(second, { chrome: { rail: true } });
        await document.fonts.ready;
        window.scrollTo({ top: 0, behavior: 'instant' });
        return {
          firstRail: (first.querySelector('.doc-toc') as HTMLElement).getBoundingClientRect(),
          firstBar: (first.querySelector('.topbar') as HTMLElement).getBoundingClientRect(),
          secondRail: (second.querySelector('.doc-toc') as HTMLElement).getBoundingClientRect(),
          secondBar: (second.querySelector('.topbar') as HTMLElement).getBoundingClientRect(),
        };
      });
      expect(Math.abs(before.firstRail.x - 40)).toBeLessThanOrEqual(0.1);
      expect(Math.abs(before.firstBar.x)).toBeLessThanOrEqual(0.1);
      expect(Math.abs(before.firstBar.width - 1440)).toBeLessThanOrEqual(0.1);
      expect(before.secondRail.y).toBeGreaterThan(900);
      expect(before.secondBar.y).toBeGreaterThan(900);

      const after = await doc.page.evaluate(() => {
        const first = document.querySelector('main[data-harness-root]') as HTMLElement;
        const second = document.querySelector('main[data-second-root]') as HTMLElement;
        const secondTop = second.getBoundingClientRect().top + window.scrollY;
        window.scrollTo({ top: secondTop + 120, behavior: 'instant' });
        const rect = (element: Element): DOMRect => (element as HTMLElement).getBoundingClientRect();
        return {
          firstRail: rect(first.querySelector('.doc-toc') as HTMLElement),
          firstBar: rect(first.querySelector('.topbar') as HTMLElement),
          secondRail: rect(second.querySelector('.doc-toc') as HTMLElement),
          secondBar: rect(second.querySelector('.topbar') as HTMLElement),
        };
      });
      expect(after.firstRail.bottom).toBeLessThanOrEqual(0.1);
      expect(after.firstBar.bottom).toBeLessThanOrEqual(0.1);
      expect(Math.abs(after.secondRail.x - 40)).toBeLessThanOrEqual(0.1);
      expect(Math.abs(after.secondBar.x)).toBeLessThanOrEqual(0.1);
      expect(Math.abs(after.secondBar.y)).toBeLessThanOrEqual(0.1);
      expect(Math.abs(after.secondBar.width - 1440)).toBeLessThanOrEqual(0.1);
    } finally {
      await doc.close();
    }
  });

  it('lets a dark code wrapper inherit the resolved sibling prose colour', async () => {
    const doc = await openDoc(COLOR_MARKDOWN, {}, { browser, viewport: { width: 1440, height: 900 }, enhance: false });
    try {
      await doc.page.emulateMedia({ colorScheme: 'dark' });
      await doc.enhance();
      const colors = await doc.page.evaluate(() => {
        const root = document.querySelector('main[data-harness-root]') as HTMLElement;
        const prose = Array.from(root.querySelectorAll('p')).find((element) => element.textContent === 'The sibling prose carries the resolved reader text colour.') as HTMLElement;
        const code = root.querySelector('.codehilite') as HTMLElement;
        return {
          root: getComputedStyle(root).color,
          prose: getComputedStyle(prose).color,
          code: getComputedStyle(code).color,
        };
      });
      expect(colors.code).toBe(colors.prose);
      expect(colors.code).toBe(colors.root);
    } finally {
      await doc.close();
    }
  });
});

afterAll(closeBrowsers);
