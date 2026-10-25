// C67: the Contents rail follows live panel geometry on its own physical frame.
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { closeBrowsers, describeBrowsers, openDoc, type BrowserName } from './harness.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const ENTRY = [
  "import { enhance } from './src/enhance/index.ts';",
  "import { contextOf } from './src/enhance/lifecycle.ts';",
  '(window as unknown as { __frameQueue: unknown }).__frameQueue = { enhance, contextOf };',
].join('\n');

const MARKDOWN = [
  '# Frame queue',
  '',
  '## In short',
  '',
  'Summary.',
  '',
  ...Array.from({ length: 80 }, (_, index) => [
    `## Section ${String(index + 1)}`,
    '',
    `Section ${String(index + 1)} keeps the Contents panel independently scrollable.`,
    '',
  ]).flat(),
].join('\n');

type Context = {
  readonly events: {
    emit(name: 'spy', payload: { readonly section: HTMLElement | null; readonly unit: HTMLElement | null }): void;
  };
};

type FrameQueueWindow = {
  readonly __frameQueue: {
    enhance(root: HTMLElement): Promise<void>;
    contextOf(root: Element): Context | undefined;
  };
};

let script = '';

beforeAll(async () => {
  const result = await build({
    stdin: { contents: ENTRY, resolveDir: ROOT, sourcefile: 'frame-queue-entry.ts', loader: 'ts' },
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    target: 'es2022',
    logLevel: 'silent',
  });
  script = result.outputFiles[0]?.text ?? '';
});

afterAll(closeBrowsers);

async function nextFrames(page: import('playwright-core').Page): Promise<void> {
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}

async function open(browser: BrowserName) {
  const doc = await openDoc(MARKDOWN, { chrome: { rail: true } }, { browser, viewport: { width: 1440, height: 900 }, enhance: false });
  await doc.page.evaluate(script);
  await doc.page.evaluate(async () => {
    const w = window as unknown as FrameQueueWindow;
    const root = document.querySelector('main[data-harness-root]') as HTMLElement;
    await w.__frameQueue.enhance(root);
  });
  await nextFrames(doc.page);
  return doc;
}

describeBrowsers((browser) => {
  it('uses delivery-time strict 60px edges and panel bounding height for a live outside follow', async () => {
    const doc = await open(browser);
    try {
      const result = await doc.page.evaluate(async () => {
        const w = window as unknown as FrameQueueWindow;
        const root = document.querySelector('main[data-harness-root]') as HTMLElement;
        const panel = root.querySelector('.toc-contents') as HTMLElement;
        const target = panel.querySelector('a[href="#section-40"]') as HTMLAnchorElement;
        const other = panel.querySelector('a[href="#section-39"]') as HTMLAnchorElement;
        const heading = Array.from(root.querySelectorAll('h2')).find((element) => element.id === 'section-40') as HTMLElement;
        const context = w.__frameQueue.contextOf(root);
        if (context === undefined) throw new Error('missing context');
        const settle = (): Promise<void> => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        const putAt = (edge: 'top' | 'bottom', distance: number): number => {
          target.style.setProperty('transform', 'none');
          const panelBox = panel.getBoundingClientRect();
          const linkBox = target.getBoundingClientRect();
          const desired = edge === 'top' ? panelBox.top + distance : panelBox.bottom - distance;
          const actual = edge === 'top' ? linkBox.top : linkBox.bottom;
          target.style.setProperty('transform', `translateY(${String(desired - actual)}px)`);
          const next = target.getBoundingClientRect();
          return edge === 'top' ? next.top - panelBox.top : panelBox.bottom - next.bottom;
        };
        panel.style.setProperty('height', '240px');
        panel.style.setProperty('transform', 'none');
        panel.style.setProperty('transform-origin', 'top left');
        panel.scrollTop = 700;
        const pageBefore = window.scrollY;

        const topGap = putAt('top', 60);
        const topBefore = panel.scrollTop;
        context.events.emit('spy', Object.freeze({ section: heading, unit: null }));
        await settle();
        const topAfter = panel.scrollTop;

        context.events.emit('spy', Object.freeze({ section: null, unit: null }));
        const bottomGap = putAt('bottom', 60);
        const bottomBefore = panel.scrollTop;
        context.events.emit('spy', Object.freeze({ section: heading, unit: null }));
        await settle();
        const bottomAfter = panel.scrollTop;

        context.events.emit('spy', Object.freeze({ section: null, unit: null }));
        putAt('bottom', 40);
        context.events.emit('spy', Object.freeze({ section: heading, unit: null }));
        // The pending follow must use this later manual scroll and transform, not cached enqueue geometry.
        panel.scrollTop += 19;
        panel.style.setProperty('transform', 'scaleY(1.25)');
        target.style.setProperty('transform', 'none');
        const before = panel.scrollTop;
        const livePanel = panel.getBoundingClientRect();
        const liveLink = target.getBoundingClientRect();
        target.style.setProperty('transform', `translateY(${String(livePanel.bottom + 80 - liveLink.bottom)}px)`);
        const finalPanel = panel.getBoundingClientRect();
        const finalLink = target.getBoundingClientRect();
        const expected = before + finalLink.top - finalPanel.top - finalPanel.height / 2;
        const clientExpected = before + finalLink.top - finalPanel.top - panel.clientHeight / 2;
        const original = (() => {
          for (let proto: object | null = panel; proto !== null; proto = Object.getPrototypeOf(proto)) {
            const descriptor = Object.getOwnPropertyDescriptor(proto, 'scrollTop');
            if (descriptor?.get !== undefined && descriptor.set !== undefined) return descriptor;
          }
          throw new Error('missing native scrollTop descriptor');
        })();
        const assigned: number[] = [];
        Object.defineProperty(panel, 'scrollTop', {
          configurable: true,
          get: () => original.get?.call(panel) as number,
          set: (value: number) => {
            assigned.push(value);
            original.set?.call(panel, value);
          },
        });
        await settle();
        const actual = panel.scrollTop;
        original.set?.call(panel, expected);
        const nativeReference = original.get?.call(panel) as number;
        delete (panel as { scrollTop?: unknown }).scrollTop;
        return {
          topGap,
          topBefore,
          topAfter,
          bottomGap,
          bottomBefore,
          bottomAfter,
          expected,
          clientExpected,
          assigned,
          actual,
          nativeReference,
          topInside: finalLink.top >= finalPanel.top + 60,
          bottomOutside: finalLink.bottom > finalPanel.bottom - 60,
          pageBefore,
          pageAfter: window.scrollY,
          panelHeight: finalPanel.height,
          clientHeight: panel.clientHeight,
          active: target.getAttribute('aria-current'),
          otherActive: other.getAttribute('aria-current'),
        };
      });
      expect(result.topGap).toBe(60);
      expect(result.topAfter).toBe(result.topBefore);
      expect(result.bottomGap).toBe(60);
      expect(result.bottomAfter).toBe(result.bottomBefore);
      expect(Math.abs(result.panelHeight - result.clientHeight)).toBeGreaterThan(20);
      expect(Math.abs(result.expected - result.clientExpected)).toBeGreaterThan(20);
      expect(result.assigned).toEqual([result.expected]);
      expect(Math.abs(result.actual - result.nativeReference)).toBeLessThanOrEqual(0.1);
      expect([result.topInside, result.bottomOutside]).toEqual([true, true]);
      expect(result.pageAfter).toBe(result.pageBefore);
      expect(result.active).toBe('location');
      expect(result.otherActive).toBeNull();
    } finally {
      await doc.close();
    }
  });
});
