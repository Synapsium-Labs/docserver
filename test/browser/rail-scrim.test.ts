// C64: physical narrow-drawer scrim clicks grant exact-root focus permission only to that close.
import { afterAll, expect, it } from 'vitest';
import { closeBrowsers, describeBrowsers, openDoc } from './harness.js';

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
  '',
  ...Array.from({ length: 24 }, (_, index) => [
    `## ${String(index + 4)}. Long section`,
    '',
    'The long fixture keeps a real document scroll position while physical input closes the narrow drawer.',
    '',
  ]).flat(),
].join('\n');

interface ScrimPoint {
  readonly x: number;
  readonly y: number;
  readonly scrollY: number;
}

interface Quiet {
  readonly aborted: readonly string[];
  readonly missing: readonly string[];
  readonly csp: readonly string[];
  readonly errors: readonly string[];
}

async function quiet(doc: Awaited<ReturnType<typeof openDoc>>, errors: readonly string[]): Promise<Quiet> {
  return {
    aborted: doc.aborted,
    missing: doc.missing,
    csp: await doc.violations(),
    errors,
  };
}

async function openPhysical(
  browser: 'chromium' | 'webkit',
  tabindex: string | null,
  hostControl = false,
): Promise<{ readonly doc: Awaited<ReturnType<typeof openDoc>>; readonly errors: string[] }> {
  const doc = await openDoc(DOC, { chrome: { rail: true } }, {
    browser,
    csp: 'strict',
    viewport: { width: 390, height: 844 },
    enhance: false,
  });
  const errors: string[] = [];
  doc.page.on('pageerror', (error) => errors.push(error.message));
  doc.page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  await doc.page.evaluate(({ rootTabindex, addHostControl }) => {
    const root = document.querySelector('main[data-harness-root]') as HTMLElement;
    if (rootTabindex === null) root.removeAttribute('tabindex');
    else root.setAttribute('tabindex', rootTabindex);
    const opener = document.createElement('button');
    opener.id = 'connected-opener';
    opener.type = 'button';
    opener.textContent = 'Opener';
    document.body.append(opener);
    if (addHostControl) {
      const host = document.createElement('button');
      host.id = 'host-control';
      host.type = 'button';
      host.textContent = 'Host';
      document.body.append(host);
    }
  }, { rootTabindex: tabindex, addHostControl: hostControl });
  await doc.enhance();
  return { doc, errors };
}

async function preparePhysicalScrim(page: (Awaited<ReturnType<typeof openDoc>>)['page'], tabindex: string | null): Promise<ScrimPoint> {
  await page.evaluate(() => {
    window.scrollTo({ top: 260, behavior: 'instant' });
  });
  const premise = await page.evaluate((expectedTabindex) => {
    const root = document.querySelector('main[data-harness-root]') as HTMLElement;
    const opener = document.getElementById('connected-opener') as HTMLButtonElement;
    const button = root.querySelector('.toc-btn') as HTMLButtonElement;
    const rail = root.querySelector('.doc-toc') as HTMLElement;
    const scrim = root.querySelector('.toc-scrim') as HTMLElement;
    opener.focus({ preventScroll: true });
    const openerFocusedBeforeOpen = document.activeElement === opener;
    button.click();
    const drawer = rail.getBoundingClientRect();
    const scrimBox = scrim.getBoundingClientRect();
    const visible = {
      left: Math.max(0, scrimBox.left),
      top: Math.max(0, scrimBox.top),
      right: Math.min(window.innerWidth, scrimBox.right),
      bottom: Math.min(window.innerHeight, scrimBox.bottom),
    };
    const point = {
      x: (Math.max(drawer.right, visible.left) + visible.right) / 2,
      y: (visible.top + visible.bottom) / 2,
    };
    return {
      openerFocusedBeforeOpen,
      railFocused: document.activeElement === rail.querySelector('button[role="tab"][aria-selected="true"]'),
      rootTabindex: root.getAttribute('tabindex'),
      point,
      outsideDrawer: point.x < drawer.left || point.x > drawer.right || point.y < drawer.top || point.y > drawer.bottom,
      insideVisibleScrim: point.x >= visible.left && point.x <= visible.right && point.y >= visible.top && point.y <= visible.bottom,
      exactHit: document.elementFromPoint(point.x, point.y) === scrim,
      scrollY: window.scrollY,
      expectedTabindex,
    };
  }, tabindex);
  expect(premise.openerFocusedBeforeOpen).toBe(true);
  expect(premise.railFocused).toBe(true);
  expect(premise.rootTabindex).toBe(premise.expectedTabindex);
  expect([premise.outsideDrawer, premise.insideVisibleScrim, premise.exactHit]).toEqual([true, true, true]);
  return { ...premise.point, scrollY: premise.scrollY };
}

function closeState(): {
  readonly open: boolean;
  readonly expanded: string | null;
  readonly hidden: boolean;
  readonly role: string | null;
  readonly modal: string | null;
  readonly focus: string | null;
  readonly scrollY: number;
} {
  const root = document.querySelector('main[data-harness-root]') as HTMLElement;
  const button = root.querySelector('.toc-btn') as HTMLButtonElement;
  const rail = root.querySelector('.doc-toc') as HTMLElement;
  const scrim = root.querySelector('.toc-scrim') as HTMLElement;
  return {
    open: root.classList.contains('toc-open'),
    expanded: button.getAttribute('aria-expanded'),
    hidden: scrim.hasAttribute('hidden'),
    role: rail.getAttribute('role'),
    modal: rail.getAttribute('aria-modal'),
    focus: (document.activeElement as HTMLElement | null)?.id ?? null,
    scrollY: window.scrollY,
  };
}

afterAll(closeBrowsers);

describeBrowsers((browser) => {
  for (const [label, tabindex] of [
    ['library-owned tabindex -1', null],
    ['host-owned tabindex 0', '0'],
  ] as const) {
    it(`at 390 physically closes through the exact scrim and restores its connected opener with ${label}`, async () => {
      const { doc, errors } = await openPhysical(browser, tabindex);
      try {
        const point = await preparePhysicalScrim(doc.page, tabindex === null ? '-1' : tabindex);
        await doc.page.mouse.click(point.x, point.y);
        const result = await doc.page.evaluate(closeState);

        expect(result).toEqual({
          open: false,
          expanded: 'false',
          hidden: true,
          role: null,
          modal: null,
          focus: 'connected-opener',
          scrollY: point.scrollY,
        });
        await doc.page.evaluate(async () => {
          await (window.__docreaderHarness as { destroy(): Promise<void> }).destroy();
        });
        expect(await doc.page.evaluate(() => (document.querySelector('main[data-harness-root]') as HTMLElement).getAttribute('tabindex')))
          .toBe(tabindex);
        expect(await quiet(doc, errors)).toEqual({ aborted: [], missing: [], csp: [], errors: [] });
      } finally {
        await doc.close();
      }
    });
  }

  it('keeps a host control focused when click capture moves focus before the scrim bubble listener', async () => {
    const { doc, errors } = await openPhysical(browser, null, true);
    try {
      const point = await preparePhysicalScrim(doc.page, '-1');
      await doc.page.evaluate(() => {
        const host = document.getElementById('host-control') as HTMLButtonElement;
        document.addEventListener('click', () => host.focus({ preventScroll: true }), { capture: true, once: true });
      });
      await doc.page.mouse.click(point.x, point.y);
      const result = await doc.page.evaluate(closeState);

      expect(result).toEqual({
        open: false,
        expanded: 'false',
        hidden: true,
        role: null,
        modal: null,
        focus: 'host-control',
        scrollY: point.scrollY,
      });
      expect(await quiet(doc, errors)).toEqual({ aborted: [], missing: [], csp: [], errors: [] });
    } finally {
      await doc.close();
    }
  });

  it('does not grant host root tabindex zero to an ordinary Escape close or lifecycle cleanup', async () => {
    const { doc, errors } = await openPhysical(browser, '0');
    try {
      await doc.page.evaluate(() => {
        const root = document.querySelector('main[data-harness-root]') as HTMLElement;
        const opener = document.getElementById('connected-opener') as HTMLButtonElement;
        opener.focus({ preventScroll: true });
        (root.querySelector('.toc-btn') as HTMLButtonElement).click();
        root.focus({ preventScroll: true });
      });
      await doc.page.keyboard.press('Escape');
      expect(await doc.page.evaluate(() => {
        const root = document.querySelector('main[data-harness-root]') as HTMLElement;
        return {
          closed: !root.classList.contains('toc-open'),
          focusedRoot: document.activeElement === root,
          tabindex: root.getAttribute('tabindex'),
        };
      })).toEqual({ closed: true, focusedRoot: true, tabindex: '0' });

      await doc.page.evaluate(async () => {
        const root = document.querySelector('main[data-harness-root]') as HTMLElement;
        (root.querySelector('.toc-btn') as HTMLButtonElement).click();
        root.focus({ preventScroll: true });
        await (window.__docreaderHarness as { destroy(): Promise<void> }).destroy();
      });
      expect(await doc.page.evaluate(() => {
        const root = document.querySelector('main[data-harness-root]') as HTMLElement;
        return {
          focusedRoot: document.activeElement === root,
          tabindex: root.getAttribute('tabindex'),
          chrome: root.querySelector('[data-docreader-chrome]') !== null,
        };
      })).toEqual({ focusedRoot: true, tabindex: '0', chrome: false });
      expect(await quiet(doc, errors)).toEqual({ aborted: [], missing: [], csp: [], errors: [] });
    } finally {
      await doc.close();
    }
  });
});
