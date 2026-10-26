// The Changes since menu in Chromium (docserver L2, Task 22): real menu placement, focus and version callbacks under
// strict CSP in desktop and phone viewports. The page runs only from the harness origin and the browser context pins
// Asia/Kolkata so the consecutive UTC dates cross a local civil midnight.
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { afterAll, expect, it } from 'vitest';
import { closeBrowsers, describeBrowsers, openDoc, ORIGIN, type BrowserName } from './harness.js';

const DOC = [
  '# Changes since sample',
  '',
  '**Spec** · 2026-10-24 · Status: Draft',
  '',
  '## 1. Scope',
  '',
  ...Array.from({ length: 18 }, (_, i) => `Scope line ${String(i + 1)}.`),
  '',
  '## 2. Design',
  '',
  ...Array.from({ length: 18 }, (_, i) => `Design line ${String(i + 1)}.`),
  '',
  '## 3. Plan',
  '',
  ...Array.from({ length: 18 }, (_, i) => `Plan line ${String(i + 1)}.`),
].join('\n');

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

const info = {
  sha: 'abcdef1',
  commits: [
    { sha: 'abcdef1', subject: 'feat: local tomorrow', date: '2026-01-01T18:45:00Z', parents: ['1234567'] },
    { sha: '1234567', subject: 'fix: local yesterday', date: '2026-01-01T18:15:00Z', parents: ['2345678'] },
  ],
};

const overflowInfo = {
  sha: 'abcdef1',
  commits: Array.from({ length: 24 }, (_, index) => ({
    sha: index === 0 ? 'abcdef1' : `a${String(index).padStart(6, '0')}`,
    subject: `feat: overflow ${String(index)}`,
    date: `2026-01-${String(24 - index).padStart(2, '0')}T18:45:00Z`,
    parents: [index === 23 ? '1234567' : `a${String(index + 1).padStart(6, '0')}`],
  })),
};

afterAll(closeBrowsers);

const entry = (docInfo: unknown, versionOnly = false): string => `
  import { enhance } from './src/enhance/index.ts';
  const root = document.querySelector('main[data-harness-root]');
  window.__sinceHost = {
    opened: [],
    async start() {
      await enhance(root, {
        info: ${JSON.stringify(docInfo)},
        ${versionOnly ? '' : 'changes: () => Promise.resolve({ changed: [[1, 1]] }),' }
        openVersion: (value) => window.__sinceHost.opened.push(value),
      });
      await document.fonts.ready;
    },
  };
`;

const scripts = new Map<string, Promise<string>>();

function hostScript(docInfo: unknown = info, versionOnly = false): Promise<string> {
  const key = `${JSON.stringify(docInfo)}:${String(versionOnly)}`;
  let script = scripts.get(key);
  if (script === undefined) {
    script = build({
      stdin: { contents: entry(docInfo, versionOnly), resolveDir: ROOT, sourcefile: 'since-host.ts', loader: 'ts' },
      bundle: true,
      write: false,
      format: 'iife',
      platform: 'browser',
      target: 'es2022',
      logLevel: 'silent',
    }).then((result) => result.outputFiles[0]?.text ?? '');
    scripts.set(key, script);
  }
  return script;
}

async function open(browser: BrowserName, width: number, height: number, docInfo: unknown = info, versionOnly = false) {
  const doc = await openDoc(DOC, {}, {
    browser,
    viewport: { width, height },
    timezoneId: 'Asia/Kolkata',
    csp: 'strict',
    enhance: false,
  });
  const body = await hostScript(docInfo, versionOnly);
  await doc.page.route(`${ORIGIN}/since-host.js`, (route) => route.fulfill({ status: 200, headers: { 'content-type': 'text/javascript' }, body }));
  await doc.page.addScriptTag({ url: '/since-host.js' });
  await doc.page.evaluate(() => (window as unknown as { __sinceHost: { start(): Promise<void> } }).__sinceHost.start());
  return doc;
}

describeBrowsers((browser) => {
  it('opens a clamped desktop menu with local-day rows, roving focus and no CSP violation', async () => {
    const doc = await open(browser, 1440, 700);
    try {
      const trigger = doc.page.locator('.chg-trig');
      await trigger.click();
      expect(await doc.page.locator('.cm-days .cm-t').allTextContents()).toEqual(['Since Fri 2 Jan', 'Since Thu 1 Jan']);
      const geometry = await doc.page.locator('.chg-menu').evaluate((menu) => {
        const r = menu.getBoundingClientRect();
        const popupTop = r.top;
        return {
          left: r.left,
          right: r.right,
          top: r.top,
          bottom: r.bottom,
          width: innerWidth,
          height: innerHeight,
          max: getComputedStyle(menu).maxHeight,
          expectedMax: Math.max(0, Math.floor(innerHeight - popupTop - 16)),
        };
      });
      expect(geometry.left).toBeGreaterThanOrEqual(15);
      expect(geometry.right).toBeLessThanOrEqual(geometry.width - 15);
      expect(geometry.bottom).toBeLessThanOrEqual(geometry.height + 1);
      expect(geometry.max).toBe(`${String(geometry.expectedMax)}px`);
      await doc.page.keyboard.press('End');
      await doc.page.keyboard.press('ArrowLeft');
      const focused = await doc.page.evaluate(() => ({ active: document.activeElement?.className }));
      expect(focused.active).toBe('cm-item');
      await doc.page.keyboard.press('Escape');
      expect(await trigger.evaluate((el) => el === document.activeElement)).toBe(true);
      expect(await doc.violations()).toEqual([]);
    } finally {
      await doc.close();
    }
  });

  it('keeps the phone menu inside the viewport with the strict policy in dark mode', async () => {
    const doc = await open(browser, 390, 700);
    try {
      await doc.page.emulateMedia({ colorScheme: 'dark' });
      await doc.page.locator('.chg-trig').click();
      const geometry = await doc.page.locator('.chg-menu').evaluate((menu) => {
        const r = menu.getBoundingClientRect();
        return { left: r.left, right: r.right, width: innerWidth, overflow: getComputedStyle(menu).overflowY };
      });
      expect(geometry.left).toBeGreaterThanOrEqual(15);
      expect(geometry.right).toBeLessThanOrEqual(geometry.width - 15);
      expect(geometry.overflow).toBe('auto');
      expect(await doc.violations()).toEqual([]);
    } finally {
      await doc.close();
    }
  });

  it('lays out distinct version-only days without comparison controls and sends its exact version action', async () => {
    const doc = await open(browser, 390, 700, overflowInfo, true);
    try {
      await doc.page.locator('.chg-trig').click();
      const rows = await doc.page.locator('.cm-row').evaluateAll((nodes) => nodes.map((row) => {
        const label = row.querySelector('.cm-item') as HTMLElement | null;
        const only = row.querySelector('.cm-only') as HTMLElement | null;
        const box = only?.getBoundingClientRect();
        return {
          label: label?.textContent ?? '',
          tag: label?.localName ?? '',
          role: label?.getAttribute('role') ?? null,
          height: row.getBoundingClientRect().height,
          top: box?.top ?? -1,
          bottom: box?.bottom ?? -1,
        };
      }));
      expect(await doc.page.locator('[role="menuitemradio"]').count()).toBe(0);
      expect(rows.slice(0, 3).map((row) => [row.label, row.tag, row.role])).toEqual([
        ['Version of Sun 25 Jan', 'span', null],
        ['Version of Sat 24 Jan', 'span', null],
        ['Version of Fri 23 Jan', 'span', null],
      ]);
      const firstRows = rows.slice(0, 3);
      expect(firstRows.every((row) => row.height > 0)).toBe(true);
      expect(firstRows.every((row, index) => index === 0 || (firstRows[index - 1] as (typeof firstRows)[number]).bottom < row.top)).toBe(true);
      await doc.page.locator('.cm-row .cm-only').first().click();
      expect(await doc.page.evaluate(() => (window as unknown as { __sinceHost: { opened: unknown[] } }).__sinceHost.opened)).toEqual([
        { sha: 'abcdef1', only: 'a000001' },
      ]);
      expect(await doc.violations()).toEqual([]);
    } finally {
      await doc.close();
    }
  });

  it('keeps an overflowing bottom menu reachable below the visible bar after a nonzero scroll', async () => {
    const doc = await open(browser, 390, 320, overflowInfo);
    try {
      await doc.page.evaluate(() => window.scrollTo(0, 800));
      await doc.page.locator('.chg-trig').scrollIntoViewIfNeeded();
      const before = await doc.page.evaluate(() => {
        const trigger = document.querySelector('.chg-trig') as HTMLElement;
        const bar = document.querySelector('.topbar') as HTMLElement;
        const rect = trigger.getBoundingClientRect();
        return { scrollY: window.scrollY, room: innerHeight - rect.bottom, bar: bar.getBoundingClientRect().bottom };
      });
      await doc.page.locator('.chg-trig').click();
      await doc.page.keyboard.press('End');
      const state = await doc.page.locator('.chg-menu').evaluate((menu) => {
        const r = menu.getBoundingClientRect();
        const active = document.activeElement as HTMLElement | null;
        const a = active?.getBoundingClientRect();
        const bar = document.querySelector('.topbar')?.getBoundingClientRect().bottom ?? 0;
        return {
          bottom: r.bottom,
          height: innerHeight,
          scrollTop: menu.scrollTop,
          scrollHeight: menu.scrollHeight,
          clientHeight: menu.clientHeight,
          activeTop: a?.top ?? -1,
          activeBottom: a?.bottom ?? -1,
          menuTop: r.top,
          menuBottom: r.bottom,
          bar,
        };
      });
      expect(before.scrollY).toBeGreaterThan(0);
      expect(before.room).toBeLessThan(280);
      expect(state.scrollHeight).toBeGreaterThan(state.clientHeight);
      expect(state.scrollTop).toBeGreaterThan(0);
      expect(state.activeTop).toBeGreaterThanOrEqual(state.menuTop);
      expect(state.activeBottom).toBeLessThanOrEqual(state.menuBottom);
      expect(state.menuTop).toBeGreaterThanOrEqual(state.bar + 12);
      expect(state.bottom).toBeLessThanOrEqual(state.height + 1);
      expect(await doc.violations()).toEqual([]);
    } finally {
      await doc.close();
    }
  });

  it('keeps the popup below the viewport edge in a phone viewport that has room for it', async () => {
    const doc = await open(browser, 390, 700, overflowInfo);
    try {
      await doc.page.locator('.chg-trig').click();
      await doc.page.keyboard.press('End');
      const state = await doc.page.locator('.chg-menu').evaluate((menu) => {
        const r = menu.getBoundingClientRect();
        const active = document.activeElement as HTMLElement | null;
        const a = active?.getBoundingClientRect();
        return { bottom: r.bottom, height: innerHeight, scrollTop: menu.scrollTop, activeBottom: a?.bottom ?? -1, menuBottom: r.bottom };
      });
      expect(state.bottom).toBeLessThanOrEqual(state.height - 16);
      expect(state.scrollTop).toBeGreaterThan(0);
      expect(state.activeBottom).toBeLessThanOrEqual(state.menuBottom);
      expect(await doc.violations()).toEqual([]);
    } finally {
      await doc.close();
    }
  });
});
