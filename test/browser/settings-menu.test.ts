// The Aa menu's colour-key heading is chrome, not source prose: its list begins 6px below the heading.
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { closeBrowsers, describeBrowsers, openDoc, type BrowserName } from './harness.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const PROSE = 'The menu offers a theme, typeface, text width and reading lens. Its controls are local to this reader.';
const DOC = [
  '# Settings geometry',
  '',
  '**Spec** · 2026-10-21 · Status: Draft',
  '',
  PROSE,
  '',
  'This ordinary author paragraph must keep its own source typography while the Aa menu opens and closes.',
].join('\n');
const ENTRY = [
  "import { enhance, destroyEnhancement } from './src/enhance/index.ts';",
  '(window as unknown as { __settingsMenu: unknown }).__settingsMenu = { enhance, destroyEnhancement };',
].join('\n');

let script = '';

beforeAll(async () => {
  const bundle = await build({
    stdin: { contents: ENTRY, resolveDir: ROOT, sourcefile: 'settings-menu-entry.ts', loader: 'ts' },
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

type Theme = 'light' | 'dark';

interface Rect {
  readonly x: number;
  readonly y: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly right: number;
  readonly bottom: number;
}

interface ProseState {
  readonly text: string;
  readonly rect: Rect;
  readonly fontSize: number;
  readonly marginBottom: number;
}

interface MenuState {
  readonly hidden: boolean;
  readonly rootTheme: string | null;
  readonly selectedTheme: string;
  readonly menu: Rect;
  readonly button: Rect;
  readonly heading: Rect;
  readonly list: Rect;
  readonly gap: number;
}

interface States {
  readonly aBefore: ProseState;
  readonly aOpen: ProseState;
  readonly aClosed: ProseState;
  readonly bInitial: ProseState;
  readonly bAfterTheme: ProseState;
  readonly bAfterAOpen: ProseState;
  readonly bAfterAClose: ProseState;
  readonly bOpen: ProseState;
  readonly aMenu: MenuState;
  readonly bInitialMenu: MenuState;
  readonly bAfterThemeMenu: MenuState;
  readonly bAfterAOpenMenu: MenuState;
  readonly bAfterACloseMenu: MenuState;
  readonly bMenu: MenuState;
}

function expectedMargin(width: number): number {
  return width === 1440 ? 18.9 : 17.85;
}

function expectedFont(width: number): number {
  return width === 1440 ? 18 : 17;
}

async function states(browser: BrowserName, width: number, theme: Theme): Promise<{ readonly doc: Awaited<ReturnType<typeof openDoc>>; readonly states: States }> {
  const doc = await openDoc(DOC, {}, { browser, viewport: { width, height: width === 1440 ? 1000 : 844 }, csp: 'strict', enhance: false });
  try {
    await doc.page.emulateMedia({ colorScheme: theme });
    await doc.page.evaluate(script);
    return {
      doc,
      states: await doc.page.evaluate(async ({ chosenTheme, proseText }) => {
        const waitForFrames = async (): Promise<void> => {
          await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        };
        const product = window as unknown as {
          __settingsMenu: {
            enhance(root: HTMLElement): Promise<void>;
            destroyEnhancement(root: HTMLElement): Promise<void>;
          };
        };
        const a = document.querySelector('main[data-harness-root]') as HTMLElement;
        const b = document.createElement('main');
        b.append(...Array.from(a.childNodes).map((node) => node.cloneNode(true)));
        a.after(b);
        await product.__settingsMenu.enhance(a);
        await product.__settingsMenu.enhance(b);
        await document.fonts.ready;

        const rect = (element: Element): Rect => {
          const box = element.getBoundingClientRect();
          return { x: box.x, y: box.y, top: box.top, width: box.width, height: box.height, right: box.right, bottom: box.bottom };
        };
        const rootState = (root: HTMLElement): { readonly prose: ProseState; readonly menu: MenuState; readonly button: HTMLButtonElement; readonly theme: HTMLInputElement } => {
          const prose = Array.from(root.querySelectorAll('p')).find((element) => element.textContent?.trim() === proseText);
          const menu = root.querySelector('.aa-menu');
          const button = root.querySelector<HTMLButtonElement>('.aa-btn');
          const heading = menu?.querySelector('.aa-kh');
          const list = menu?.querySelector('.ckey');
          const selectedTheme = root.querySelector<HTMLInputElement>('input[data-pref="theme"]:checked');
          if (!(prose instanceof HTMLElement) || !(menu instanceof HTMLElement) || !(button instanceof HTMLButtonElement) || !(heading instanceof HTMLElement) || !(list instanceof HTMLElement) || !(selectedTheme instanceof HTMLInputElement)) throw new Error('missing real settings menu geometry');
          const style = getComputedStyle(prose);
          return {
            prose: {
              text: prose.textContent?.trim() ?? '',
              rect: rect(prose),
              fontSize: Number.parseFloat(style.fontSize),
              marginBottom: Number.parseFloat(style.marginBottom),
            },
            menu: {
              hidden: Boolean(menu.hidden),
              rootTheme: root.getAttribute('data-theme'),
              selectedTheme: selectedTheme.value,
              menu: rect(menu),
              button: rect(button),
              heading: rect(heading),
              list: rect(list),
              gap: rect(list).top - rect(heading).bottom,
            },
            button,
            theme: root.querySelector<HTMLInputElement>(`input[data-pref="theme"][value="${chosenTheme}"]`) as HTMLInputElement,
          };
        };
        const choose = async (input: HTMLInputElement): Promise<void> => {
          input.labels?.[0]?.click();
          await waitForFrames();
        };

        const initialA = rootState(a);
        const initialB = rootState(b);
        if (initialA.theme === null) throw new Error('missing selected theme control');
        window.scrollTo({ top: 0, behavior: 'instant' });
        const bInitial = initialB.prose;
        const bInitialMenu = initialB.menu;

        await choose(initialA.theme);
        window.scrollTo({ top: 0, behavior: 'instant' });
        const aBefore = rootState(a).prose;
        const bAfterTheme = rootState(b).prose;
        const bAfterThemeMenu = rootState(b).menu;

        rootState(a).button.click();
        await waitForFrames();
        window.scrollTo({ top: 0, behavior: 'instant' });
        const aOpen = rootState(a).prose;
        const aMenu = rootState(a).menu;
        const bAfterAOpen = rootState(b).prose;
        const bAfterAOpenMenu = rootState(b).menu;

        rootState(a).button.click();
        await waitForFrames();
        window.scrollTo({ top: 0, behavior: 'instant' });
        const aClosed = rootState(a).prose;
        const bAfterAClose = rootState(b).prose;
        const bAfterACloseMenu = rootState(b).menu;

        rootState(b).button.click();
        await waitForFrames();
        window.scrollTo({ top: 0, behavior: 'instant' });
        const bOpen = rootState(b).prose;
        const bMenu = rootState(b).menu;
        await product.__settingsMenu.destroyEnhancement(a);
        await product.__settingsMenu.destroyEnhancement(b);
        return { aBefore, aOpen, aClosed, bInitial, bAfterTheme, bAfterAOpen, bAfterAClose, bOpen, aMenu, bInitialMenu, bAfterThemeMenu, bAfterAOpenMenu, bAfterACloseMenu, bMenu };
      }, { chosenTheme: theme, proseText: PROSE }),
    };
  } catch (error) {
    await doc.close();
    throw error;
  }
}

function expectProse(state: ProseState, width: number): void {
  expect(state.text).toBe(PROSE);
  expect(state.rect.width).toBeGreaterThan(100);
  expect(state.rect.height).toBeGreaterThan(10);
  expect(state.fontSize).toBeCloseTo(expectedFont(width), 1);
  // WebKit serializes the 1.05em source margin to a subpixel value (18.890625/17.84375).
  expect(Math.abs(state.marginBottom - expectedMargin(width))).toBeLessThanOrEqual(0.01);
}

function expectMenu(state: MenuState): void {
  expect(state.hidden).toBe(false);
  expect(state.heading.width).toBeGreaterThan(0);
  expect(state.heading.height).toBeGreaterThan(0);
  expect(state.list.width).toBeGreaterThan(0);
  expect(state.list.height).toBeGreaterThan(0);
  expect(state.menu.width).toBeGreaterThan(0);
  expect(state.menu.height).toBeGreaterThan(0);
  expect(state.gap).toBeCloseTo(6, 1);
  expect(Math.abs(state.menu.right - state.button.right)).toBeLessThanOrEqual(0.1);
}

describeBrowsers((browser) => {
  for (const width of [1440, 390] as const) {
    for (const theme of ['light', 'dark'] as const) {
      it(`keeps the real Aa colour key at a 6px gap without moving visible prose at ${String(width)}px in ${theme}`, async () => {
        const { doc, states: got } = await states(browser, width, theme);
        try {
          for (const prose of [got.aBefore, got.aOpen, got.aClosed, got.bInitial, got.bAfterTheme, got.bAfterAOpen, got.bAfterAClose, got.bOpen]) expectProse(prose, width);
          expect(got.aOpen).toEqual(got.aBefore);
          expect(got.aClosed).toEqual(got.aBefore);
          for (const prose of [got.bAfterTheme, got.bAfterAOpen, got.bAfterAClose, got.bOpen]) expect(prose).toEqual(got.bInitial);
          expect(got.aMenu.selectedTheme).toBe(theme);
          for (const menu of [got.bInitialMenu, got.bAfterThemeMenu, got.bAfterAOpenMenu, got.bAfterACloseMenu]) {
            expect(menu.hidden).toBe(true);
            expect(menu.selectedTheme).toBe('auto');
            expect(menu.rootTheme).toBeNull();
          }
          expect(got.bMenu.hidden).toBe(false);
          expect(got.bMenu.selectedTheme).toBe('auto');
          expect(got.bMenu.rootTheme).toBeNull();
          expectMenu(got.aMenu);
          expectMenu(got.bMenu);
          expect(await doc.violations()).toEqual([]);
          expect(doc.aborted).toEqual([]);
          expect(doc.missing).toEqual([]);
        } finally {
          await doc.close();
        }
      });
    }
  }
});
