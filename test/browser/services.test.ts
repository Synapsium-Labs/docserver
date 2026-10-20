// The shared services in a real browser (docserver L2, Task 7b): relayout measures again once the reader's faces load
// (LD5; relayout.ts). The font files are held back by a route of the page's own until the case lets them go, so the
// startup's own relayout ('start') runs on the fallback faces, and a second one ('fonts') runs once both faces have
// loaded, and no more. What jsdom cannot show: the browser's own font loading and its frames.
//
// The public entry and the lifecycle's test hook (contextOf) are bundled here on their own and evaluated in the page
// after it loaded, as the seams' browser case does; the page's own script is not used to enhance.
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { closeBrowsers, describeBrowsers, openDoc } from './harness.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

const DOC = ['# Example', '', '## 1. One', '', 'Text of the first section.', '', '## 2. Two', '', 'More.', '', '## 3. Three', '', 'End.', ''].join('\n');

const ENTRY = [
  "import { enhance } from './src/enhance/index.ts';",
  "import { contextOf } from './src/enhance/lifecycle.ts';",
  '(window as unknown as { __services: unknown }).__services = { enhance, contextOf };',
].join('\n');

let script = '';

beforeAll(async () => {
  const r = await build({
    stdin: { contents: ENTRY, resolveDir: ROOT, sourcefile: 'services-entry.ts', loader: 'ts' },
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    target: 'es2022',
    logLevel: 'silent',
  });
  script = r.outputFiles[0]?.text ?? '';
});

afterAll(closeBrowsers);

interface Run {
  readonly reasons: string[];
  readonly loaded: boolean;
}

describeBrowsers((browser) => {
  it('relayout runs once the fonts load: the start on the fallback faces, then one for the fonts, and no more', async () => {
    const doc = await openDoc(DOC, {}, { browser, csp: 'strict', enhance: false });
    try {
      let release: () => void = () => undefined;
      const gate = new Promise<void>((r) => {
        release = r;
      });
      const held: string[] = [];
      // A route of the page's own runs before the context's, which serves the files once this one falls back to it.
      await doc.page.route('**/assets/fonts/*.woff2', async (route) => {
        held.push(new URL(route.request().url()).pathname);
        await gate;
        await route.fallback();
      });
      await doc.page.evaluate(script);
      await doc.page.evaluate(async () => {
        type Ctx = { onRelayout(fn: (reasons: ReadonlySet<string>) => void): unknown };
        const w = window as unknown as {
          __services: { enhance(root: HTMLElement): Promise<void>; contextOf(root: Element): Ctx | undefined };
          __runs: Run[];
        };
        const root = document.querySelector('main[data-harness-root]') as HTMLElement;
        w.__runs = [];
        await w.__services.enhance(root);
        const faces = (): boolean => document.fonts.check('1em "Docreader Serif"') && document.fonts.check('1em "Docreader Sans"');
        w.__services.contextOf(root)?.onRelayout((reasons) => {
          w.__runs.push({ reasons: [...reasons], loaded: faces() });
        });
      });
      const runs = (): Promise<Run[]> => doc.page.evaluate(() => (window as unknown as { __runs: Run[] }).__runs);
      await doc.page.waitForFunction(() => (window as unknown as { __runs: Run[] }).__runs.length >= 1);
      await doc.page.waitForTimeout(300);
      expect(await runs()).toEqual([{ reasons: ['start'], loaded: false }]);
      expect(held.length).toBeGreaterThan(0); // the faces were asked for, and are held
      release();
      await doc.page.waitForFunction(() => (window as unknown as { __runs: Run[] }).__runs.length >= 2, undefined, { timeout: 15_000 });
      await doc.page.waitForTimeout(300);
      expect(await runs()).toEqual([
        { reasons: ['start'], loaded: false },
        { reasons: ['fonts'], loaded: true },
      ]);
    } finally {
      await doc.close();
    }
  });
});
