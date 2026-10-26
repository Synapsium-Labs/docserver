// Reading settings in a real browser (docserver L2, Task 19): the reader keeps its place when type or width changes.
import { afterAll, expect, it } from 'vitest';
import { ORIGIN, closeBrowsers, describeBrowsers, openDoc, type OpenedDoc } from './harness.js';

const DOC = [
  '# Settings browser check',
  '',
  '**Spec** · 2026-10-21 · Status: Draft',
  '',
  ...Array.from({ length: 28 }, (_, index) => [
    `## ${String(index + 1)}. Section`,
    '',
    'Text that fills the reader column and lets the viewport keep a stable document position while preferences change. '.repeat(7),
    ...(index === 7 ? ['```ts', ...Array.from({ length: 20 }, (_, line) => `const detail${String(line)} = ${String(line)};`), '```'] : []),
    '',
  ]).flat(),
].join('\n');

afterAll(closeBrowsers);

async function openPositionDoc(browser: Parameters<typeof openDoc>[2]['browser']): Promise<OpenedDoc> {
  const doc = await openDoc(DOC, {}, { browser, csp: 'strict' });
  await doc.page.route(`${ORIGIN}/position-test.css`, async (route) => {
    await route.fulfill({ contentType: 'text/css', body: 'html, body { overflow-anchor: none; }\n' });
  });
  await doc.page.addStyleTag({ url: `${ORIGIN}/position-test.css` });
  expect(await doc.page.evaluate(() => getComputedStyle(document.body).overflowAnchor)).toBe('none');
  expect(await doc.violations()).toEqual([]);
  return doc;
}

describeBrowsers((browser) => {
  it('keeps the reader place within 2 px after type, width, and lens choices', async () => {
    const doc = await openPositionDoc(browser);
    try {
      await doc.page.evaluate(async () => {
        const root = document.querySelector('main[data-harness-root]') as HTMLElement;
        const detail = root.querySelector('.codehilite') as HTMLElement;
        const bar = root.querySelector('.topbar') as HTMLElement;
        window.scrollTo({ top: detail.getBoundingClientRect().top + window.scrollY - bar.getBoundingClientRect().bottom - 12, behavior: 'instant' });
        await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      });
      const before = await doc.page.evaluate(() => (document.querySelector('main[data-harness-root] .codehilite') as HTMLElement).getBoundingClientRect().top);
      await doc.page.evaluate(async () => {
        const root = document.querySelector('main[data-harness-root]') as HTMLElement;
        const wide = root.querySelector('input[data-pref="width"][value="wide"]') as HTMLInputElement;
        wide.checked = true;
        wide.dispatchEvent(new Event('change', { bubbles: true }));
        await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      });
      expect(Math.abs((await doc.page.evaluate(() => (document.querySelector('main[data-harness-root] .codehilite') as HTMLElement).getBoundingClientRect().top)) - before)).toBeLessThanOrEqual(2);
      const wide = await doc.page.evaluate(async () => {
        const root = document.querySelector('main[data-harness-root]') as HTMLElement;
        const sans = root.querySelector('input[data-pref="font"][value="sans"]') as HTMLInputElement;
        sans.checked = true;
        sans.dispatchEvent(new Event('change', { bubbles: true }));
        await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        return (document.querySelector('main[data-harness-root] .codehilite') as HTMLElement).getBoundingClientRect().top;
      });
      expect(Math.abs(wide - before)).toBeLessThanOrEqual(2);
      const lensBefore = await doc.page.evaluate(async () => {
        const root = document.querySelector('main[data-harness-root]') as HTMLElement;
        const anchor = root.querySelectorAll('h2')[16] as HTMLElement;
        const bar = root.querySelector('.topbar') as HTMLElement;
        window.scrollTo({ top: anchor.getBoundingClientRect().top + window.scrollY - bar.getBoundingClientRect().bottom - 12, behavior: 'instant' });
        await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        return {
          anchor: anchor.getBoundingClientRect().top,
          detail: (root.querySelector('.codehilite') as HTMLElement).getBoundingClientRect().height,
        };
      });
      const lensAfter = await doc.page.evaluate(async () => {
        const root = document.querySelector('main[data-harness-root]') as HTMLElement;
        const product = root.querySelector('input[data-pref="lens"][value="product"]') as HTMLInputElement;
        product.checked = true;
        product.dispatchEvent(new Event('change', { bubbles: true }));
        await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        return {
          anchor: (root.querySelectorAll('h2')[16] as HTMLElement).getBoundingClientRect().top,
          detail: (root.querySelector('.codehilite') as HTMLElement).getBoundingClientRect().height,
        };
      });
      expect(Math.abs(lensAfter.detail - lensBefore.detail)).toBeGreaterThan(2);
      expect(Math.abs(lensAfter.anchor - lensBefore.anchor)).toBeLessThanOrEqual(2);
      expect(await doc.violations()).toEqual([]);
    } finally {
      await doc.close();
    }
  });

  it('keeps the reader place within 2 px while collapsing and expanding sections', async () => {
    const doc = await openPositionDoc(browser);
    try {
      await doc.page.evaluate(async () => {
        const root = document.querySelector('main[data-harness-root]') as HTMLElement;
        const heading = root.querySelectorAll('h2')[16] as HTMLElement;
        const bar = root.querySelector('.topbar') as HTMLElement;
        window.scrollTo({ top: heading.getBoundingClientRect().top + window.scrollY - bar.getBoundingClientRect().bottom - 12, behavior: 'instant' });
        await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      });
      const before = await doc.page.evaluate(() => ({
        anchor: (document.querySelectorAll('main[data-harness-root] h2')[16] as HTMLElement).getBoundingClientRect().top,
        height: document.documentElement.scrollHeight,
      }));
      const collapsed = await doc.page.evaluate(async () => {
        const root = document.querySelector('main[data-harness-root]') as HTMLElement;
        Array.from(root.querySelectorAll<HTMLButtonElement>('.aa-btns button')).find((button) => button.textContent === 'Collapse all')?.click();
        await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        return {
          anchor: (root.querySelectorAll('h2')[16] as HTMLElement).getBoundingClientRect().top,
          height: document.documentElement.scrollHeight,
        };
      });
      expect(before.height - collapsed.height).toBeGreaterThan(2);
      expect(Math.abs(collapsed.anchor - before.anchor)).toBeLessThanOrEqual(2);
      const expanded = await doc.page.evaluate(async () => {
        const root = document.querySelector('main[data-harness-root]') as HTMLElement;
        Array.from(root.querySelectorAll<HTMLButtonElement>('.aa-btns button')).find((button) => button.textContent === 'Expand all')?.click();
        await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        return {
          anchor: (root.querySelectorAll('h2')[16] as HTMLElement).getBoundingClientRect().top,
          height: document.documentElement.scrollHeight,
        };
      });
      expect(expanded.height - collapsed.height).toBeGreaterThan(2);
      expect(Math.abs(expanded.anchor - before.anchor)).toBeLessThanOrEqual(2);
      expect(await doc.violations()).toEqual([]);
    } finally {
      await doc.close();
    }
  });
});
