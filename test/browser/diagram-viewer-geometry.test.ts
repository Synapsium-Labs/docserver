// Numeric geometry and focus proofs for the root-local fullscreen diagram viewer.
import type { Page } from 'playwright-core';
import { afterAll, expect, it } from 'vitest';
import { closeBrowsers, describeBrowsers, openDoc } from './harness.js';

const MARKDOWN = [
  '# Viewer geometry',
  '',
  '## Decisions',
  '',
  '| ID | Decision | Status |',
  '|---|---|---|',
  '| D1 | Keep the diagram definition available | Agreed |',
].join('\n');

const clamp = (value: number): number => Math.max(0.08, Math.min(12, value));

function drawing(width: number, height: number): string {
  return `<figure class="mermaid-figure"><pre class="mermaid">flowchart LR\n  A --> B</pre><pre class="mermaid" data-docreader-chrome><svg id="geometry-source" viewBox="0 0 ${String(width)} ${String(height)}"><g class="node dnode" id="flowchart-A-0" data-ref="D1" tabindex="0" role="button"><rect width="80" height="30"/><text>D1</text></g><g class="node" id="flowchart-B-1"><rect x="${String(Math.max(100, width - 100))}" width="80" height="30"/></g><path class="flowchart-link" data-id="L_A_B_0" d="M80 15H140"/></svg></pre><figcaption>Figure 1. Geometry.</figcaption></figure>`;
}

interface Transform {
  readonly x: number;
  readonly y: number;
  readonly scale: number;
}

interface StageSize {
  readonly width: number;
  readonly height: number;
}

function transform(value: string): Transform {
  const match = /^translate\(([-\d.]+)px, ([-\d.]+)px\) scale\(([-\d.]+)\)$/.exec(value);
  if (match === null) throw new Error(`unexpected viewer transform ${value}`);
  return { x: Number(match[1]), y: Number(match[2]), scale: Number(match[3]) };
}

function wholeFit(stage: StageSize, width: number, height: number): Transform {
  const scale = clamp(Math.min(1.5, Math.min(stage.width / width, stage.height / height) * 0.95));
  return { scale, x: (stage.width - width * scale) / 2, y: (stage.height - height * scale) / 2 };
}

function readableFit(stage: StageSize, width: number, height: number): Transform {
  const whole = Math.min(stage.width / width, stage.height / height) * 0.95;
  const tall = height / width > stage.height / stage.width;
  const readable = Math.min(1.25, Math.max(whole, tall ? stage.width * 0.95 / width : stage.height * 0.95 / height));
  if (readable <= whole * 1.05) return wholeFit(stage, width, height);
  const scale = clamp(readable);
  return { scale, x: tall ? (stage.width - width * scale) / 2 : 16, y: tall ? 16 : (stage.height - height * scale) / 2 };
}

function expectTransform(actual: Transform, expected: Transform, precision = 6): void {
  expect(actual.scale).toBeCloseTo(expected.scale, precision);
  expect(actual.x).toBeCloseTo(expected.x, precision);
  expect(actual.y).toBeCloseTo(expected.y, precision);
}

async function stageSize(page: Page): Promise<StageSize> {
  return page.locator('.fo-stage').evaluate((node) => ({ width: (node as HTMLElement).clientWidth, height: (node as HTMLElement).clientHeight }));
}

async function viewer(browser: 'chromium' | 'webkit', width = 240, height = 100, options: { readonly keyboard?: boolean } = {}) {
  const doc = await openDoc(MARKDOWN, options, {
    browser,
    csp: 'strict',
    hasTouch: true,
    html: (html) => `${html}${drawing(width, height)}<button id="outside-control" type="button">Outside</button>`,
  });
  const full = doc.page.getByRole('button', { name: 'Full screen' });
  await full.click();
  const stage = doc.page.locator('.fo-stage');
  const svg = stage.locator('svg');
  return { doc, full, stage, svg, block: doc.page.locator('.fig-overlay .dnode') };
}

async function readTransform(page: Page): Promise<Transform> {
  return transform(await page.locator('.fo-stage svg').evaluate((node) => (node as SVGSVGElement).style.transform));
}

async function frames(page: Page): Promise<void> {
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}

type Point = { readonly x: number; readonly y: number; readonly id: number };
type TouchStep = { readonly type: 'touchStart' | 'touchMove' | 'touchEnd'; readonly points: readonly Point[] };

/** Native Chromium CDP touch input; callers fall back only where CDP is unavailable. */
async function nativeTouch(page: Page, steps: readonly TouchStep[]): Promise<boolean> {
  if (page.context().browser()?.browserType().name() !== 'chromium') return false;
  const session = await page.context().newCDPSession(page);
  try {
    await session.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
    for (const step of steps) await session.send('Input.dispatchTouchEvent', { type: step.type, touchPoints: step.points.map((point) => ({ ...point })) });
    return true;
  } finally {
    await session.detach();
  }
}

/** Explicit synthetic fallback for WebKit, which has no CDP touch endpoint. */
async function syntheticPointers(page: Page, steps: readonly { readonly type: 'pointerdown' | 'pointermove' | 'pointerup'; readonly point: Point }[]): Promise<void> {
  await page.locator('.fo-stage').evaluate((node, input) => {
    for (const step of input) {
      node.dispatchEvent(new PointerEvent(step.type, {
        bubbles: true,
        cancelable: true,
        pointerId: step.point.id,
        pointerType: 'touch',
        clientX: step.point.x,
        clientY: step.point.y,
      }));
    }
  }, steps);
}

async function pinch(page: Page, first: Point, second: Point, movedSecond: Point): Promise<void> {
  const native = await nativeTouch(page, [
    { type: 'touchStart', points: [first, second] },
    { type: 'touchMove', points: [first, movedSecond] },
    { type: 'touchEnd', points: [] },
  ]);
  if (!native) await syntheticPointers(page, [
    { type: 'pointerdown', point: first },
    { type: 'pointerdown', point: second },
    { type: 'pointermove', point: movedSecond },
    { type: 'pointerup', point: movedSecond },
    { type: 'pointerup', point: first },
  ]);
}

async function doubleTap(page: Page, point: Point): Promise<void> {
  const native = await nativeTouch(page, [
    { type: 'touchStart', points: [point] },
    { type: 'touchEnd', points: [] },
    { type: 'touchStart', points: [point] },
    { type: 'touchEnd', points: [] },
  ]);
  if (native) return;
  // Synthetic fallback fixes its production clock inside the page so this is unambiguously a sub-300ms double tap.
  await page.locator('.fo-stage').evaluate((node, input) => {
    const originalNow = Date.now;
    let now = 10_000;
    const fire = (type: 'pointerdown' | 'pointerup'): void => {
      node.dispatchEvent(new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        pointerId: input.id,
        pointerType: 'touch',
        clientX: input.x,
        clientY: input.y,
      }));
    };
    try {
      Date.now = () => now;
      fire('pointerdown');
      fire('pointerup');
      now += 50;
      fire('pointerdown');
      fire('pointerup');
    } finally {
      Date.now = originalNow;
    }
  }, point);
}

async function syntheticCloseWithoutFocusShift(page: Page): Promise<void> {
  await page.locator('.fo-close').evaluate((node) => (node as HTMLButtonElement).click());
}

afterAll(closeBrowsers);

describeBrowsers((browser) => {
  it('clamps repeated viewer control zoom at 0.08 and 12', async () => {
    const { doc } = await viewer(browser);
    try {
      const out = doc.page.getByRole('button', { name: '-' });
      const inButton = doc.page.getByRole('button', { name: '+' });
      for (let at = 0; at < 24; at += 1) await out.click();
      expect((await readTransform(doc.page)).scale).toBeCloseTo(0.08, 10);
      await out.click();
      expect((await readTransform(doc.page)).scale).toBeCloseTo(0.08, 10);
      for (let at = 0; at < 32; at += 1) await inButton.click();
      expect((await readTransform(doc.page)).scale).toBeCloseTo(12, 10);
      await inButton.click();
      expect((await readTransform(doc.page)).scale).toBeCloseTo(12, 10);
    } finally {
      await doc.close();
    }
  });

  for (const [name, width, height] of [['tall', 100, 1000], ['wide', 1000, 100]] as const) {
    it(`uses numeric readable and whole fits for a ${name} diagram`, async () => {
      const { doc } = await viewer(browser, width, height);
      try {
        const size = await stageSize(doc.page);
        expectTransform(await readTransform(doc.page), readableFit(size, width, height));
        await doc.page.getByRole('button', { name: 'Fit' }).click();
        expectTransform(await readTransform(doc.page), wholeFit(await stageSize(doc.page), width, height));
      } finally {
        await doc.close();
      }
    });
  }

  it('refits a fully offscreen drawing after resize while preserving a visible centre in a separate resize', async () => {
    const offscreen = await viewer(browser, 240, 100);
    try {
      const before = await readTransform(offscreen.doc.page);
      const steps = Math.ceil((before.x + 240 * before.scale + 1) / 60);
      for (let at = 0; at < steps; at += 1) await offscreen.doc.page.keyboard.press('ArrowRight');
      const moved = await readTransform(offscreen.doc.page);
      expect(moved.x + 240 * moved.scale).toBeLessThan(0);
      await offscreen.doc.page.setViewportSize({ width: 1000, height: 760 });
      await frames(offscreen.doc.page);
      expectTransform(await readTransform(offscreen.doc.page), readableFit(await stageSize(offscreen.doc.page), 240, 100), 5);
    } finally {
      await offscreen.doc.close();
    }

    const visible = await viewer(browser, 240, 100);
    try {
      const stageBefore = await stageSize(visible.doc.page);
      const before = await readTransform(visible.doc.page);
      expect(before.x + 240 * before.scale).toBeGreaterThan(40);
      await visible.doc.page.setViewportSize({ width: 1100, height: 820 });
      await frames(visible.doc.page);
      const stageAfter = await stageSize(visible.doc.page);
      const after = await readTransform(visible.doc.page);
      expect(after.scale).toBeCloseTo(before.scale, 8);
      expect(after.x - before.x).toBeCloseTo((stageAfter.width - stageBefore.width) / 2, 5);
      expect(after.y - before.y).toBeCloseTo((stageAfter.height - stageBefore.height) / 2, 5);
    } finally {
      await visible.doc.close();
    }
  });

  it('preserves host and sibling focus on close, but restores its opener from its own card', async () => {
    const { doc, full, block } = await viewer(browser);
    try {
      await doc.page.evaluate(() => {
        const host = document.createElement('button');
        host.id = 'host-control';
        host.textContent = 'Host';
        document.body.append(host);
        host.focus();
      });
      await syntheticCloseWithoutFocusShift(doc.page);
      expect(await doc.page.evaluate(() => document.activeElement?.id)).toBe('host-control');

      await full.click();
      await doc.page.locator('#outside-control').focus();
      await syntheticCloseWithoutFocusShift(doc.page);
      expect(await doc.page.evaluate(() => document.activeElement?.id)).toBe('outside-control');

      await full.click();
      await block.focus();
      await doc.page.keyboard.press('Enter');
      expect(await doc.page.locator('.xcard .xc-go').evaluate((node) => document.activeElement === node)).toBe(true);
      await syntheticCloseWithoutFocusShift(doc.page);
      expect(await full.evaluate((node) => document.activeElement === node)).toBe(true);
    } finally {
      await doc.close();
    }
  });

  it('keeps viewer and card Escape paths when keyboard is explicitly false', async () => {
    const { doc, block } = await viewer(browser, 240, 100, { keyboard: false });
    try {
      await block.focus();
      await doc.page.keyboard.press('Enter');
      expect(await doc.page.locator('.xcard.open').count()).toBe(1);
      await doc.page.keyboard.press('Escape');
      expect(await doc.page.locator('.xcard.open').count()).toBe(0);
      expect(await doc.page.locator('.fig-overlay.open').count()).toBe(1);
      await doc.page.keyboard.press('Escape');
      expect(await doc.page.locator('.fig-overlay.open').count()).toBe(0);
    } finally {
      await doc.close();
    }
  });

  it('keeps numeric pinch midpoint and double-tap anchors invariant', async () => {
    const { doc, stage } = await viewer(browser, 240, 100);
    try {
      const box = await stage.boundingBox();
      if (box === null) throw new Error('fullscreen stage has no browser box');
      const first = { x: box.x + 100, y: box.y + 120, id: 1 };
      const second = { x: box.x + 180, y: box.y + 120, id: 2 };
      const movedSecond = { x: box.x + 260, y: box.y + 160, id: 2 };
      const beforePinch = await readTransform(doc.page);
      const oldCenter = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
      const newCenter = { x: (first.x + movedSecond.x) / 2, y: (first.y + movedSecond.y) / 2 };
      const factor = Math.hypot(first.x - movedSecond.x, first.y - movedSecond.y) / Math.hypot(first.x - second.x, first.y - second.y);
      await pinch(doc.page, first, second, movedSecond);
      const afterPinch = await readTransform(doc.page);
      const center = { x: newCenter.x - box.x, y: newCenter.y - box.y };
      const translated = { x: beforePinch.x + newCenter.x - oldCenter.x, y: beforePinch.y + newCenter.y - oldCenter.y };
      expectTransform(afterPinch, {
        scale: beforePinch.scale * factor,
        x: center.x - (center.x - translated.x) * factor,
        y: center.y - (center.y - translated.y) * factor,
      }, 4);

      const anchor = { x: box.x + 70, y: box.y + 70, id: 3 };
      const beforeTap = await readTransform(doc.page);
      await doubleTap(doc.page, anchor);
      const afterTap = await readTransform(doc.page);
      const local = { x: anchor.x - box.x, y: anchor.y - box.y };
      expect(afterTap.scale).toBeCloseTo(beforeTap.scale * 2, 5);
      expect((local.x - afterTap.x) / afterTap.scale).toBeCloseTo((local.x - beforeTap.x) / beforeTap.scale, 5);
      expect((local.y - afterTap.y) / afterTap.scale).toBeCloseTo((local.y - beforeTap.y) / beforeTap.scale, 5);
    } finally {
      await doc.close();
    }
  });
});
