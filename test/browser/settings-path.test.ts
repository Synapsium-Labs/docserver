// Product-lens paths and table code are root-local: the selector must match the enhanced root, not a host-owned main.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { closeBrowsers, describeBrowsers, openDoc } from './harness.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const CSS = fileURLToPath(new URL('../../assets/reader.css', import.meta.url));
const ENTRY = [
  "import { enhance, setEnhancementPrefs } from './src/enhance/index.ts';",
  '(window as unknown as { __product: unknown }).__product = { enhance, setEnhancementPrefs };',
].join('\n');
const DOC = [
  '# Product lens styles',
  '',
  'A classified path `src/feature.ts` stays visible beside ordinary `inline-token` code.',
  '',
  '| Name | Detail |',
  '|---|---|',
  '| Row | `table-token` |',
  '',
].join('\n');

const PATH_FONT_SIZE = { 1440: 13.68, 390: 12.92 } as const;
const MUTED_COLOR = { light: 'rgb(94, 89, 81)', dark: 'rgb(176, 169, 158)' } as const;
const INLINE_BACKGROUND = { light: 'rgba(80, 110, 150, 0.1)', dark: 'rgba(150, 175, 210, 0.13)' } as const;

let script = '';

beforeAll(async () => {
  const bundle = await build({
    stdin: { contents: ENTRY, resolveDir: ROOT, sourcefile: 'settings-path-entry.ts', loader: 'ts' },
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    target: 'es2022',
    logLevel: 'silent',
  });
  script = bundle.outputFiles[0]?.text ?? '';
});

afterAll(closeBrowsers);

interface StyleState {
  readonly background: string;
  readonly paddingTop: string;
  readonly paddingRight: string;
  readonly color: string;
  readonly fontSize: string;
  readonly width: number;
  readonly height: number;
}

interface RootStyles {
  readonly path: StyleState;
  readonly table: StyleState;
  readonly inline: StyleState;
}

interface States {
  readonly productBefore: RootStyles;
  readonly product: RootStyles;
  readonly productAfter: RootStyles;
  readonly ordinaryBefore: RootStyles;
  readonly ordinary: RootStyles;
  readonly nestedMainContainer: boolean;
}

/** Enhance sibling roots through the public entry, settling Product-off baselines before toggling one root. */
async function states(browser: 'chromium' | 'webkit', width: number, theme: 'light' | 'dark'): Promise<{ readonly doc: Awaited<ReturnType<typeof openDoc>>; readonly states: States }> {
  const doc = await openDoc(DOC, {}, { browser, viewport: { width, height: 900 }, csp: 'strict', enhance: false });
  try {
    await doc.page.evaluate(script);
    const result = await doc.page.evaluate(async (chosenTheme) => {
      const w = window as unknown as {
        __product: {
          enhance(root: HTMLElement, options?: unknown): Promise<void>;
          setEnhancementPrefs(root: HTMLElement, prefs: { readonly theme?: 'light' | 'dark'; readonly lens?: 'all' | 'product' }): void;
        };
      };
      const product = document.querySelector('main[data-harness-root]') as HTMLElement;
      const ordinary = product.cloneNode(true) as HTMLElement;
      ordinary.removeAttribute('data-harness-root');
      product.after(ordinary);
      await w.__product.enhance(product);
      await w.__product.enhance(ordinary);
      w.__product.setEnhancementPrefs(product, { theme: chosenTheme, lens: 'all' });
      w.__product.setEnhancementPrefs(ordinary, { theme: chosenTheme, lens: 'all' });
      await document.fonts.ready;
      const style = (element: Element): StyleState => {
        const computed = getComputedStyle(element);
        const box = element.getBoundingClientRect();
        return {
          background: computed.backgroundColor,
          paddingTop: computed.paddingTop,
          paddingRight: computed.paddingRight,
          color: computed.color,
          fontSize: computed.fontSize,
          width: box.width,
          height: box.height,
        };
      };
      const read = (root: HTMLElement): RootStyles => ({
        path: style(root.querySelector('code.path') as Element),
        table: style(root.querySelector('td code') as Element),
        inline: style(root.querySelector('p code:not(.path)') as Element),
      });
      const productBefore = read(product);
      const ordinaryBefore = read(ordinary);
      w.__product.setEnhancementPrefs(product, { lens: 'product' });
      const productAfterToggle = read(product);
      const ordinaryAfterToggle = read(ordinary);
      w.__product.setEnhancementPrefs(product, { lens: 'all' });
      return {
        productBefore,
        product: productAfterToggle,
        productAfter: read(product),
        ordinaryBefore,
        ordinary: ordinaryAfterToggle,
        nestedMainContainer: product.querySelector('main.container') !== null,
      };
    }, theme);
    return { doc, states: result };
  } catch (error) {
    await doc.close();
    throw error;
  }
}

describeBrowsers((browser) => {
  it('keeps the C57 Product-lens selectors root-owned', () => {
    const css = readFileSync(CSS, 'utf8');
    expect(css).toContain('[data-docreader-root]:not(i).lens-product code.path,\n  [data-docreader-root]:not(i).lens-product td code');
    expect(css).not.toContain('.lens-product main.container');
  });

  for (const width of [1440, 390] as const) {
    for (const theme of ['light', 'dark'] as const) {
      it(`uses the root-owned Product lens for paths and ordinary table code without changing its sibling at ${width}px in ${theme}`, async () => {
        const { doc, states: got } = await states(browser, width, theme);
        try {
          expect(got.nestedMainContainer).toBe(false);
          for (const current of [got.product.path, got.product.table]) {
            expect(current.background).toBe('rgba(0, 0, 0, 0)');
            expect([current.paddingTop, current.paddingRight]).toEqual(['0px', '0px']);
            expect(current.color).toBe(MUTED_COLOR[theme]);
            expect(current.width).toBeGreaterThan(0);
            expect(current.height).toBeGreaterThan(0);
          }
          expect(Number.parseFloat(got.product.path.fontSize)).toBeCloseTo(PATH_FONT_SIZE[width], 2);
          for (const key of ['path', 'table', 'inline'] as const) {
            expect(got.ordinary[key]).toEqual(got.ordinaryBefore[key]);
            expect(got.productAfter[key]).toEqual(got.productBefore[key]);
          }
          expect(got.product.inline.background).toBe(INLINE_BACKGROUND[theme]);
          expect(got.ordinary.inline.background).toBe(INLINE_BACKGROUND[theme]);
          expect(got.productAfter.inline.background).toBe(INLINE_BACKGROUND[theme]);
          for (const [product, ordinary] of [[got.product.path, got.ordinary.path], [got.product.table, got.ordinary.table]] as const) {
            expect(ordinary.background).not.toBe(product.background);
            expect(ordinary.paddingTop).not.toBe(product.paddingTop);
            expect(ordinary.fontSize).not.toBe(product.fontSize);
          }
          expect(await doc.violations()).toEqual([]);
        } finally {
          await doc.close();
        }
      });
    }
  }
});
