// Fullscreen viewer pointer qualification in offline Chromium. CDP touch drives the real stage;
// the compatibility click supplement models the browser click that follows a touch sequence.
import type { Page } from 'playwright-core';
import { afterAll, expect, it } from 'vitest';
import { closeBrowsers, describeBrowsers, openDoc } from './harness.js';

const MARKDOWN = [
  '# Viewer',
  '',
  '## Decisions',
  '',
  '| ID | Decision | Status |',
  '|---|---|---|',
  '| D1 | Keep the diagram definition available | Agreed |',
].join('\n');

const DRAWING = '<figure class="mermaid-figure"><pre class="mermaid">flowchart LR\n  A --> B</pre><pre class="mermaid" data-docreader-chrome><svg id="viewer-source" viewBox="0 0 240 100"><g class="node dnode" id="flowchart-A-0" data-ref="D1" tabindex="0" role="button"><rect width="80" height="30"/><text>D1</text></g><g class="node" id="flowchart-B-1"><rect x="140" width="80" height="30"/></g><path class="flowchart-link" data-id="L_A_B_0" d="M80 15H140"/></svg></pre><figcaption>Figure 1. Diagram.</figcaption></figure>';

afterAll(closeBrowsers);

async function viewer(browser: 'chromium' | 'webkit', drawing = DRAWING, options: { readonly keyboard?: boolean } = {}) {
  const doc = await openDoc(MARKDOWN, options, { browser, csp: 'strict', hasTouch: true, html: (html) => `${html}${drawing}<button id="outside-control" type="button">Outside</button>` });
  await doc.page.getByRole('button', { name: 'Full screen' }).click();
  const block = doc.page.locator('.fig-overlay .dnode');
  const box = await block.boundingBox();
  if (box === null) throw new Error('fullscreen definition block has no browser box');
  return { doc, block, x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

type TouchStep = { readonly type: 'touchStart' | 'touchMove' | 'touchEnd' | 'touchCancel'; readonly points: readonly { readonly x: number; readonly y: number; readonly id: number }[]; readonly delay?: number };

async function touchSequence(page: Page, steps: readonly TouchStep[]): Promise<void> {
  if (page.context().browser()?.browserType().name() !== 'chromium') return;
  const session = await page.context().newCDPSession(page);
  try {
    await session.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
    for (const step of steps) {
      if (step.delay !== undefined) await new Promise((resolve) => setTimeout(resolve, step.delay));
      await session.send('Input.dispatchTouchEvent', { type: step.type, touchPoints: step.points.map((point) => ({ ...point })) });
    }
  } finally {
    await session.detach();
  }
}

function tap(x: number, y: number, delay?: number): readonly TouchStep[] {
  return [{ type: 'touchStart', points: [{ x, y, id: 1 }] }, { type: 'touchEnd', points: [], ...(delay === undefined ? {} : { delay }) }];
}

async function compatibilityClick(block: Awaited<ReturnType<typeof viewer>>['block']): Promise<void> {
  await block.evaluate((node) => node.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 })));
}

function transform(value: string): { readonly x: number; readonly y: number; readonly scale: number } {
  const match = /^translate\(([-\d.]+)px, ([-\d.]+)px\) scale\(([-\d.]+)\)$/.exec(value);
  if (match === null) throw new Error(`unexpected transform ${value}`);
  return { x: Number(match[1]), y: Number(match[2]), scale: Number(match[3]) };
}

async function frames(page: Page): Promise<void> {
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}

async function syntheticTapAt(block: Awaited<ReturnType<typeof viewer>>['block'], x: number, y: number, elapsed: number, travel = 0): Promise<void> {
  await block.evaluate(
    (node, args) => {
      const originalNow = Date.now;
      let now = 1_000;
      Date.now = () => now;
      try {
        node.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 1, pointerType: 'touch', clientX: args.x, clientY: args.y }));
        now += args.elapsed;
        node.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerId: 1, pointerType: 'touch', clientX: args.x + args.travel, clientY: args.y }));
      } finally {
        Date.now = originalNow;
      }
    },
    { x, y, elapsed, travel },
  );
}

describeBrowsers((browser) => {
  it('opens the real definition card from a qualified native touch pointer-up', async () => {
    const { doc, x, y } = await viewer(browser);
    try {
      await touchSequence(doc.page, tap(x, y));
      await doc.page.waitForFunction(() => document.querySelectorAll('.xcard.open').length === 1);
      expect(await doc.violations()).toEqual([]);
    } finally {
      await doc.close();
    }
  });

  it('captures bounded light and dark fullscreen evidence', async () => {
    const { doc } = await viewer(browser);
    try {
      await doc.page.setViewportSize({ width: 800, height: 600 });
      const light = await doc.page.screenshot({ clip: { x: 0, y: 0, width: 800, height: 600 } });
      expect(light.byteLength).toBeGreaterThan(0);
      await doc.page.emulateMedia({ colorScheme: 'dark' });
      await frames(doc.page);
      const dark = await doc.page.screenshot({ clip: { x: 0, y: 0, width: 800, height: 600 } });
      expect(dark.byteLength).toBeGreaterThan(0);
    } finally {
      await doc.close();
    }
  });

  it('captures labelled generated Mermaid fullscreen evidence', async () => {
    const markdown = ['# Generated viewer', '', '```mermaid', 'flowchart LR', '  A[Start node] --> B[Finish node]', '```', '', '*Figure 1. Generated.*'].join('\n');
    const doc = await openDoc(markdown, { mermaid: {} }, { browser, csp: 'reader' });
    try {
      await doc.page.getByRole('button', { name: 'Full screen' }).click();
      await doc.page.setViewportSize({ width: 800, height: 600 });
      await doc.page.getByRole('button', { name: 'Fit' }).click();
      await doc.page.getByRole('button', { name: '-' }).click();
      await doc.page.getByRole('button', { name: '-' }).click();
      await doc.page.getByRole('button', { name: '-' }).click();
      const labels = await doc.page.locator('.fig-overlay.open svg g.node').allTextContents();
      expect(labels.join(' ')).toContain('Start node');
      expect(labels.join(' ')).toContain('Finish node');
      const light = await doc.page.screenshot({ clip: { x: 0, y: 0, width: 800, height: 600 } });
      expect(light.byteLength).toBeGreaterThan(0);
      await doc.page.emulateMedia({ colorScheme: 'dark' });
      await frames(doc.page);
      const dark = await doc.page.screenshot({ clip: { x: 0, y: 0, width: 800, height: 600 } });
      expect(dark.byteLength).toBeGreaterThan(0);
    } finally {
      await doc.close();
    }
  });

  it('changes zoom through native two-touch pinch and double tap', async () => {
    const { doc } = await viewer(browser);
    try {
      const stage = doc.page.locator('.fo-stage');
      const svg = stage.locator('svg');
      const box = await stage.boundingBox();
      if (box === null) throw new Error('fullscreen stage has no browser box');
      const x = box.x + 24;
      const y = box.y + 24;
      await doc.page.keyboard.press('-');
      const beforePinch = transform(await svg.evaluate((node) => node.style.transform));
      await touchSequence(doc.page, [
        { type: 'touchStart', points: [{ x, y, id: 1 }, { x: x + 30, y, id: 2 }] },
        { type: 'touchMove', points: [{ x, y, id: 1 }, { x: x + 90, y, id: 2 }] },
        { type: 'touchEnd', points: [] },
      ]);
      const afterPinch = transform(await svg.evaluate((node) => node.style.transform));
      expect(afterPinch.scale).toBeGreaterThan(beforePinch.scale);
      await doc.page.getByRole('button', { name: '-' }).click();
      const beforeDoubleTap = transform(await svg.evaluate((node) => node.style.transform));
      await touchSequence(doc.page, [...tap(x, y), ...tap(x, y, 50)]);
      const afterDoubleTap = transform(await svg.evaluate((node) => node.style.transform));
      expect(afterDoubleTap.scale).toBeGreaterThan(beforeDoubleTap.scale);
    } finally {
      await doc.close();
    }
  });

  for (const [name, first] of [
    ['drag', (x: number, y: number) => [{ type: 'touchStart' as const, points: [{ x, y, id: 1 }] }, { type: 'touchMove' as const, points: [{ x: x + 9, y, id: 1 }] }, { type: 'touchEnd' as const, points: [] }]],
    ['multipointer gesture', (x: number, y: number) => [{ type: 'touchStart' as const, points: [{ x, y, id: 1 }, { x: x + 30, y, id: 2 }] }, { type: 'touchEnd' as const, points: [] }]],
  ] as const) {
    it(`opens a qualified tap after a completed ${name} in the same viewer`, async () => {
      const { doc, x, y } = await viewer(browser);
      try {
        await touchSequence(doc.page, first(x, y));
        await touchSequence(doc.page, tap(x, y));
        await doc.page.waitForFunction(() => document.querySelectorAll('.xcard.open').length === 1);
      } finally {
        await doc.close();
      }
    });
  }

  it('keeps scale and shifts the visual center by half the stage resize delta', async () => {
    const { doc } = await viewer(browser);
    try {
      const stage = doc.page.locator('.fo-stage');
      const svg = stage.locator('svg');
      const box = await stage.boundingBox();
      if (box === null) throw new Error('fullscreen stage has no browser box');
      await doc.page.keyboard.down('Control');
      await doc.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await doc.page.mouse.wheel(0, -120);
      await doc.page.keyboard.up('Control');
      const before = transform(await svg.evaluate((node) => node.style.transform));
      const stageBefore = await stage.boundingBox();
      await doc.page.setViewportSize({ width: 1200, height: 900 });
      await frames(doc.page);
      const after = transform(await svg.evaluate((node) => node.style.transform));
      const stageAfter = await stage.boundingBox();
      if (stageBefore === null || stageAfter === null) throw new Error('fullscreen stage lost its browser box');
      expect(after.scale).toBeCloseTo(before.scale, 8);
      expect(after.x - before.x).toBeCloseTo((stageAfter.width - stageBefore.width) / 2, 5);
      expect(after.y - before.y).toBeCloseTo((stageAfter.height - stageBefore.height) / 2, 5);
    } finally {
      await doc.close();
    }
  });

  it('hands Tab from an open block card into its link and closes card before viewer on Escape', async () => {
    const { doc, block, x, y } = await viewer(browser);
    try {
      await touchSequence(doc.page, tap(x, y));
      await doc.page.waitForFunction(() => document.querySelectorAll('.xcard.open').length === 1);
      await block.focus();
      await doc.page.keyboard.press('Tab');
      expect(await doc.page.evaluate(() => document.activeElement?.matches('.xcard .xc-go') === true)).toBe(true);
      await doc.page.keyboard.press('Escape');
      expect(await doc.page.locator('.xcard.open').count()).toBe(0);
      expect(await doc.page.locator('.fig-overlay.open').count()).toBe(1);
      await doc.page.keyboard.press('Escape');
      expect(await doc.page.locator('.fig-overlay.open').count()).toBe(0);
    } finally {
      await doc.close();
    }
  });

  it('keeps forward Tab from its owned card link inside the viewer cycle', async () => {
    const { doc, block } = await viewer(browser);
    try {
      await block.focus();
      await doc.page.keyboard.press('Enter');
      const go = doc.page.locator('.xcard .xc-go');
      expect(await go.evaluate((node) => document.activeElement === node)).toBe(true);
      await doc.page.keyboard.press('Shift+Tab');
      expect(await block.evaluate((node) => document.activeElement === node)).toBe(true);
      await doc.page.keyboard.press('Enter');
      expect(await go.evaluate((node) => document.activeElement === node)).toBe(true);
      await doc.page.keyboard.press('Tab');
      expect(await doc.page.getByRole('button', { name: '-' }).evaluate((node) => document.activeElement === node)).toBe(true);
      expect(await doc.page.locator('.xcard.open').count()).toBe(1);
      expect(await doc.page.evaluate(() => document.activeElement?.id === 'outside-control')).toBe(false);
    } finally {
      await doc.close();
    }
  });

  it('closes the viewer on card navigation reveal without restoring focus over navigation', async () => {
    const { doc, x, y } = await viewer(browser);
    try {
      await touchSequence(doc.page, tap(x, y));
      await doc.page.waitForFunction(() => document.querySelectorAll('.xcard.open').length === 1);
      await doc.page.locator('.xcard .xc-go').click();
      expect(await doc.page.locator('.fig-overlay.open').count()).toBe(0);
      expect(await doc.page.locator('.xcard.open').count()).toBe(0);
      expect(await doc.page.evaluate(() => document.activeElement?.closest('table') !== null)).toBe(true);
    } finally {
      await doc.close();
    }
  });

  it('releases capture, reopens, and accepts its first qualified tap', async () => {
    const { doc, x, y } = await viewer(browser);
    try {
      const stage = doc.page.locator('.fo-stage');
      const box = await stage.boundingBox();
      if (box === null) throw new Error('fullscreen stage has no browser box');
      await doc.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await doc.page.mouse.down();
      expect(await stage.evaluate((node) => node.hasPointerCapture(1))).toBe(true);
      await doc.page.getByRole('button', { name: 'Close' }).press('Escape');
      expect(await doc.page.locator('.fig-overlay.open').count()).toBe(0);
      expect(await stage.evaluate((node) => node.hasPointerCapture(1))).toBe(false);
      await doc.page.mouse.up();
      await doc.page.getByRole('button', { name: 'Full screen' }).click();
      await touchSequence(doc.page, tap(x, y));
      await doc.page.waitForFunction(() => document.querySelectorAll('.xcard.open').length === 1);
    } finally {
      await doc.page.mouse.up().catch(() => undefined);
      await doc.close();
    }
  });

  it('uses the production Date.now clock to reject 600ms and accept 599ms synthetic taps', async () => {
    for (const [elapsed, expected] of [[600, 0], [599, 1]] as const) {
      const { doc, block, x, y } = await viewer(browser);
      try {
        await syntheticTapAt(block, x, y, elapsed);
        expect(await doc.page.locator('.xcard.open').count(), `${String(elapsed)}ms`).toBe(expected);
      } finally {
        await doc.close();
      }
    }
  });

  it('accepts a 7.9px synthetic pointer-up endpoint and rejects 8px without a move', async () => {
    for (const [travel, expected] of [[7.9, 1], [8, 0]] as const) {
      const { doc, block, x, y } = await viewer(browser);
      try {
        await syntheticTapAt(block, x, y, 0, travel);
        expect(await doc.page.locator('.xcard.open').count(), `${String(travel)}px`).toBe(expected);
      } finally {
        await doc.close();
      }
    }
  });

  for (const [name, steps] of [
    ['exact 8px drag', (x: number, y: number) => [{ type: 'touchStart' as const, points: [{ x, y, id: 1 }] }, { type: 'touchMove' as const, points: [{ x: x + 8, y, id: 1 }] }, { type: 'touchEnd' as const, points: [] }]],
    ['drag', (x: number, y: number) => [{ type: 'touchStart' as const, points: [{ x, y, id: 1 }] }, { type: 'touchMove' as const, points: [{ x: x + 9, y, id: 1 }] }, { type: 'touchEnd' as const, points: [] }]],
    ['cancel', (x: number, y: number) => [{ type: 'touchStart' as const, points: [{ x, y, id: 1 }] }, { type: 'touchCancel' as const, points: [] }]],
    ['exact 600ms press', (x: number, y: number) => [{ type: 'touchStart' as const, points: [{ x, y, id: 1 }] }, { type: 'touchEnd' as const, points: [], delay: 600 }]],
    ['long press', (x: number, y: number) => [{ type: 'touchStart' as const, points: [{ x, y, id: 1 }] }, { type: 'touchEnd' as const, points: [], delay: 610 }]],
  ] as const) {
    it(`does not open the card from a ${name} followed by a compatibility click`, async () => {
      const { doc, block, x, y } = await viewer(browser);
      try {
        await touchSequence(doc.page, steps(x, y));
        const beforeClick = await doc.page.locator('.xcard.open').count();
        await compatibilityClick(block);
        expect({ beforeClick, afterClick: await doc.page.locator('.xcard.open').count() }).toEqual({ beforeClick: 0, afterClick: 0 });
        expect(await doc.violations()).toEqual([]);
      } finally {
        await doc.close();
      }
    });
  }

  it('opens a just-under-eight-pixel tap and rejects its multipointer predecessor', async () => {
    const { doc, x, y } = await viewer(browser);
    try {
      await touchSequence(doc.page, [{ type: 'touchStart', points: [{ x, y, id: 1 }, { x: x + 30, y, id: 2 }] }, { type: 'touchEnd', points: [] }]);
      expect(await doc.page.locator('.xcard.open').count()).toBe(0);
      await touchSequence(doc.page, [{ type: 'touchStart', points: [{ x, y, id: 1 }] }, { type: 'touchMove', points: [{ x: x + 7.9, y, id: 1 }] }, { type: 'touchEnd', points: [] }]);
      await doc.page.waitForFunction(() => document.querySelectorAll('.xcard.open').length === 1);
    } finally {
      await doc.close();
    }
  });
});
