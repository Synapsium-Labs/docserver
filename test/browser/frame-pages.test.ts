// Screen pages (LX6.2), in real browsers on the frame's release bytes, in the `default` layout: the host page of
// frame-host-page.ts mounts a document through `./host` with `onReader`, switches the mode with DocFrame.setReading, and the
// rows press real keys and click, press and drag the real mouse over the frame. A turn is judged on known line boxes: the
// fixture's paragraphs hold plain text only, so each paragraph's lines tile its content box at its computed line height.
//
//   T1   a forward and a back turn land on a whole line (no line cut at the top edge), at three widths and both faces
//   T1c  the same where only caretRangeFromPoint, or only caretPositionFromPoint, exists
//   T2   after a turn the line the bottom edge cuts is covered by the ground band, which a scroll removes; the line it
//        covers is the first one the next turn shows
//   T2c  the band is not printed (print media hides it)
//   T2d  a relayout of any reason removes the band, with no scroll (a lens change)
//   T3   a block taller than the screen (an image, a block of code) is stepped through with one line of overlap, and a turn
//        that steps through an image draws no band and shows the image to the bottom edge
//   T4   a table of 60 rows taller than the screen: each forward turn puts the next row's top at the pinned head's bottom
//        (within 1 px), never under it, and every row is wholly shown on some page forward and back, with the head pinned
//        (`.fits`) and without it (a wide table)
//   T5   a card's pinned head and a figure's pinned tools offset the target the same way
//   T6   every turn moves at least a third of a screen (a block cut near the top), and the end and the start do nothing
//   T7   a tap on a link, a button, a Render button, a summary and a card never turns; a plain tap turns, right or left third
//   T7e  a press that began on text and is released on a control within 10 px is not a tap
//   T8   a non-empty selection, a press that started a selection, a drag and a long press never turn
//   T9   the top band sends `menu` in both modes and never while off, its height is the larger of 48 px and 15% of the view,
//        and taps on it at ten a second never close the bridge
//   T9d  a press that began on the top band and ends after the mode turned off sends no menu
//   T10  a swipe turns on its thresholds only; a swipe that starts in a wide table never turns (and, with real touch on
//        Chromium, scrolls the table); T10d a box that does not scroll sideways (one px over, overflow hidden, a parent
//        outside the root) is not one that stops a swipe
//   T11  turns are instant with and without reduced motion, even under `scroll-behavior: smooth`
//   T12  a resize and a width change keep the place and land on a whole line
//   T12b a change of text size keeps the place in screens mode: the first line shown stays the first line shown, whole
//   T13  `scroll` and `off` turn nothing: no band, no prevented keys, taps and swipes do nothing
//   T14p the text size is a screen control: in print media every size keeps the 11pt baseline and the unscaled rem (LX6.3 fix round 1)
//   T14  the text sizes (LX6.3): s, m, l and xl are 16, 18, 20 and 22 px of body text, absent reads m, and rem parts follow
//
// Waits are polls on a condition; a row that must see something NOT happen waits a fixed beat after an ordered command.
import { afterAll, beforeAll, expect, it } from 'vitest';
import type { FrameAssets } from '../../src/frame/index.js';
import { scanRefs } from '../../src/render/index.js';
import { openLibHost, type LibHost, type LibMountSpec } from './frame-host-page.js';
import { input, loadFrame, sleep } from './frame-shared.js';
import { browserFor, closeBrowsers, describeBrowsers, type BrowserName } from './harness.js';

let assets: FrameAssets;
let mermaid = '';

beforeAll(async () => {
  const built = await loadFrame();
  assets = built.assets;
  mermaid = built.mermaid;
}, 300_000);

afterAll(closeBrowsers);

/** Plain paragraphs of varied length from a fixed word list (no inline markup, so the line boxes are known). */
function paragraphs(count: number, seed = 7): string[] {
  const words = 'reader page screen line turn edge band ground column margin quiet slow long short steady light plain careful whole partial'.split(' ');
  let s = seed;
  const next = (): number => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s;
  };
  return Array.from({ length: count }, (_, i) => {
    const n = 18 + (next() % 70);
    return `P${String(i)} ${Array.from({ length: n }, () => words[next() % words.length]).join(' ')}.`;
  });
}

const LINES = ['# Pages', '', ...paragraphs(90).flatMap((p) => [p, ''])].join('\n');

const rowText = (i: number): string => `Row ${String(i)} of the table with a label`;
/** 60 rows of three short cells: it fits the column, so its head pins under the viewport's top (`.fits`). */
const FITS = ['# Table', '', paragraphs(6, 3).join('\n\n'), '', '| ID | What | Status |', '|---|---|---|', ...Array.from({ length: 60 }, (_, i) => `| R${String(i)} | ${rowText(i)} | Agreed |`), '', paragraphs(8, 5).join('\n\n'), ''].join('\n');
/** 60 rows with unbreakable wide cells: it scrolls sideways, so its head does not pin. */
const WIDE = ['# Wide', '', paragraphs(6, 4).join('\n\n'), '', '| A | B | C | D |', '|---|---|---|---|', ...Array.from({ length: 60 }, (_, i) => `| ${'a'.repeat(60)}${String(i)} | ${'b'.repeat(60)} | ${'c'.repeat(60)} | ${'d'.repeat(60)} |`), '', paragraphs(8, 6).join('\n\n'), ''].join('\n');
const CODE = ['# Code', '', paragraphs(6, 8).join('\n\n'), '', '```text', ...Array.from({ length: 160 }, (_, i) => `line ${String(i)} of a long block of code`), '```', '', paragraphs(8, 9).join('\n\n'), ''].join('\n');
/** Paragraphs whose lines carry raised `sup` marks and `code` runs of another size, so line boxes are taller than the nominal line height and the lines no longer tile the paragraph. */
const MIXED = [
  '# Mixed',
  '',
  ...paragraphs(70, 21).map((p, i) => {
    const w = p.split(' ');
    return w.map((x, k) => (k % 9 === 4 ? `\`${x}()\`` : k % 11 === 7 ? `${x}<sup>${String(i % 7)}</sup>` : k % 17 === 3 ? `<kbd>${x}</kbd>` : x)).join(' ') + '\n';
  }),
].join('\n');

const MER = ['# Figure', '', paragraphs(30, 13).join('\n\n'), '', '```mermaid', 'flowchart LR', '  A[Start] --> B[Stop]', '```', '', '*Figure 1. Start to stop.*', '', paragraphs(30, 14).join('\n\n'), ''].join('\n');

async function until(fn: () => Promise<boolean>, label: string, capMs = 30_000): Promise<void> {
  const start = Date.now();
  for (;;) {
    if (await fn().catch(() => false)) return;
    if (Date.now() - start > capMs) expect.fail(`${label}: not within ${String(capMs)} ms`);
    await sleep(50);
  }
}

/** The measuring functions each row calls in the frame, installed once per mount (window.__p). */
function installProbe(): void {
  type Line = { t: number; b: number };
  const root = (): HTMLElement => document.querySelector('[data-docreader-root]') as HTMLElement;
  const lines = (scope: ParentNode = root()): Line[] => {
    const out: Line[] = [];
    for (const p of Array.from(scope.querySelectorAll('p'))) {
      if (p.children.length > 0 || p.getClientRects().length === 0 || p.closest('.short, .fig-render') !== null) continue;
      const cs = getComputedStyle(p);
      const lh = parseFloat(cs.lineHeight);
      if (!(lh > 0)) continue;
      const r = p.getBoundingClientRect();
      const top = r.top + parseFloat(cs.paddingTop) + parseFloat(cs.borderTopWidth);
      const n = Math.round((r.height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - parseFloat(cs.borderTopWidth) - parseFloat(cs.borderBottomWidth)) / lh);
      for (let k = 0; k < n; k += 1) out.push({ t: top + k * lh, b: top + (k + 1) * lh });
    }
    return out;
  };
  const stuck = (el: Element): boolean => {
    const cs = getComputedStyle(el);
    return cs.position === 'sticky' && Math.abs(el.getBoundingClientRect().top - parseFloat(cs.top)) < 1.5;
  };
  const p = {
    y: (): number => scrollY,
    h: (): number => innerHeight,
    max: (): number => (document.scrollingElement as Element).scrollHeight - innerHeight,
    lines,
    /** The lines the edge `y` cuts by more than `tol` px (the scroll position is whole pixels, a line's top is not). */
    cut: (y: number, tol = 1): Line[] => lines().filter((l) => l.t < y - tol && l.b > y + tol),
    /** The lines wholly in view, below `top`. */
    whole: (top: number, tol = 0.5): Line[] => lines().filter((l) => l.t >= top - tol && l.b <= innerHeight + 0.5),
    band: (): { shown: boolean; top: number; bottom: number; count: number } => {
      const els = Array.from(document.querySelectorAll('.page-band'));
      const el = els[0];
      if (el === undefined) return { shown: false, top: 0, bottom: 0, count: 0 };
      const r = el.getBoundingClientRect();
      return { shown: getComputedStyle(el).display !== 'none' && r.height > 0, top: r.top, bottom: r.bottom, count: els.length };
    },
    /** The lowest bottom among stuck table heads, or the given selector's boxes (and their children), 0 for none. */
    pinned: (sel: string): number => {
      let m = 0;
      for (const el of Array.from(document.querySelectorAll(sel))) {
        if (!stuck(el)) continue;
        m = Math.max(m, el.getBoundingClientRect().bottom, ...Array.from(el.children, (c) => c.getBoundingClientRect().bottom));
      }
      return m;
    },
    rows: (sel: string): { i: number; t: number; b: number }[] => Array.from(document.querySelectorAll(sel), (el, i) => ({ i, t: el.getBoundingClientRect().top, b: el.getBoundingClientRect().bottom })),
    rect: (sel: string): { t: number; b: number; l: number; r: number } | null => {
      const el = document.querySelector(sel);
      if (el === null) return null;
      const r = el.getBoundingClientRect();
      return { t: r.top, b: r.bottom, l: r.left, r: r.right };
    },
    /** The top block (a paragraph with a data-line, else the nearest one) at the reading line, by its text's first word. */
    /** The text fragments (a line's share of one text node) that the edge `y` cuts through their glyph boxes by more than half a pixel. */
    textCut: (y: number): { t: number; b: number; text: string }[] => {
      const out: { t: number; b: number; text: string }[] = [];
      const walk = document.createTreeWalker(root(), NodeFilter.SHOW_TEXT);
      for (let n = walk.nextNode(); n !== null; n = walk.nextNode()) {
        const p = (n as Text).parentElement;
        if (p === null || p.closest('p') === null || (n.textContent ?? '').trim() === '') continue;
        const range = document.createRange();
        range.selectNodeContents(n);
        for (const r of Array.from(range.getClientRects())) if (r.height > 0 && r.top < y - 0.5 && r.bottom > y + 0.5) out.push({ t: r.top, b: r.bottom, text: (n.textContent ?? '').slice(0, 12) });
      }
      return out;
    },
    topWord: (): string => {
      for (let y = 4; y < 200; y += 6) {
        const el = document.elementFromPoint(innerWidth / 2, y)?.closest('p');
        if (el !== null && el !== undefined) return (el.textContent ?? '').split(' ')[0] ?? '';
      }
      return '';
    },
    scrollTo: (y: number): void => {
      scrollTo({ top: y, behavior: 'instant' });
    },
  };
  (window as unknown as { __p: typeof p }).__p = p;
}

interface Probe {
  y(): number;
  h(): number;
  max(): number;
  lines(): { t: number; b: number }[];
  cut(y: number, tol?: number): { t: number; b: number }[];
  whole(top: number, tol?: number): { t: number; b: number }[];
  band(): { shown: boolean; top: number; bottom: number; count: number };
  pinned(sel: string): number;
  rows(sel: string): { i: number; t: number; b: number }[];
  rect(sel: string): { t: number; b: number; l: number; r: number } | null;
  textCut(y: number): { t: number; b: number; text: string }[];
  topWord(): string;
  scrollTo(y: number): void;
}

async function open(browser: BrowserName, md: string, over: Partial<LibMountSpec> = {}, size = { width: 1000, height: 844 }): Promise<LibHost> {
  const host = await openLibHost(await browserFor(browser), {}, { hostBar: true });
  await host.page.setViewportSize(size);
  await host.mount({ document: input(md), assets, watchdogMs: 60_000, callbacks: ['onReader'], ...over });
  await until(async () => (await host.lib()).events.some((e) => e.kind === 'ready'), 'the frame is ready');
  await host.frame().evaluate(installProbe);
  return host;
}

const P = { y: (h: LibHost): Promise<number> => probe<number>(h, 'y') };
/** Call one probe function in the frame. */
function probe<T>(host: LibHost, name: keyof Probe, ...args: unknown[]): Promise<T> {
  return host.frame().evaluate(([n, a]) => ((window as unknown as { __p: Record<string, (...x: unknown[]) => unknown> }).__p[n as string] as (...x: unknown[]) => unknown)(...(a as unknown[])), [name, args] as const) as Promise<T>;
}

async function screens(host: LibHost, mode = 'screens'): Promise<void> {
  await host.setReading(mode);
  await until(() => host.frame().evaluate((m) => document.querySelector('[data-docreader-root]')?.getAttribute('data-reading') === m, mode), `reader mode ${mode} is on`);
  await sleep(350); // the relayout of the mode change runs at the next frame; the turn engine's first snap too
}

const acts = async (host: LibHost): Promise<string[]> => (await host.lib()).events.filter((e) => e.kind === 'onReader').map((e) => e.value as string);

const press = async (host: LibHost, k: string): Promise<void> => {
  await until(() => host.frame().evaluate(() => document.hasFocus()), 'the frame has the focus');
  await host.page.keyboard.press(k);
};

/** The scroll position once it has stopped moving. */
async function settle(host: LibHost): Promise<number> {
  await sleep(120);
  let a = await P.y(host);
  for (;;) {
    await sleep(90);
    const b = await P.y(host);
    if (b === a) return b;
    a = b;
  }
}

/** Press a key and answer the scroll position before and after, once it has settled. */
async function turn(host: LibHost, key: string): Promise<{ before: number; after: number }> {
  const before = await P.y(host);
  await press(host, key);
  return { before, after: await settle(host) };
}

const frameBox = async (host: LibHost): Promise<{ x: number; y: number }> => {
  const b = await host.page.locator('iframe').boundingBox();
  if (b === null) throw new Error('no iframe');
  return { x: b.x, y: b.y };
};
/** Click at a point of the frame's viewport with the real mouse. */
async function tap(host: LibHost, x: number, y: number): Promise<void> {
  const o = await frameBox(host);
  await host.page.mouse.click(o.x + x, o.y + y);
}
/** The centre of the first element matching `sel`, in the frame's viewport. */
const centre = (host: LibHost, sel: string): Promise<{ x: number; y: number } | null> =>
  host.frame().evaluate((s) => {
    const el = document.querySelector(s);
    if (el === null) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, sel);

/** Dispatch a touch swipe on the element at (x, y), as events the page can see (the same on both engines). */
const swipe = (host: LibHost, from: { x: number; y: number }, dx: number, dy: number, ms: number, fingers = 1): Promise<void> =>
  host.frame().evaluate(
    async ([f, mx, my, wait, fingers]) => {
      const target = document.elementFromPoint(f.x, f.y) ?? document.body;
      const fire = (type: string, x: number, y: number): void => {
        const e = new Event(type, { bubbles: true, cancelable: true }) as Event & { touches: unknown; changedTouches: unknown; targetTouches: unknown };
        const t = Array.from({ length: fingers }, (_, i) => ({ clientX: x + i * 30, clientY: y, identifier: i + 1, target }));
        Object.defineProperty(e, 'touches', { value: type === 'touchend' ? [] : t });
        Object.defineProperty(e, 'targetTouches', { value: type === 'touchend' ? [] : t });
        Object.defineProperty(e, 'changedTouches', { value: t });
        target.dispatchEvent(e);
      };
      fire('touchstart', f.x, f.y);
      await new Promise((r) => setTimeout(r, wait));
      fire('touchend', f.x + mx, f.y + my);
    },
    [from, dx, dy, ms, fingers] as const,
  );

/** The frame's viewport size. */
const viewport = (host: LibHost): Promise<{ w: number; h: number }> => host.frame().evaluate(() => ({ w: innerWidth, h: innerHeight }));

/** Turn forward until the ground band is on screen (at most six turns), and say so. */
async function drawBand(host: LibHost): Promise<void> {
  for (let k = 0; k < 6 && !(await probe<{ shown: boolean }>(host, 'band')).shown; k += 1) await turn(host, 'ArrowRight');
  expect((await probe<{ shown: boolean }>(host, 'band')).shown, 'a band is on screen').toBe(true);
}

/** Add a block to the root, before the first element matching `before`. */
const inject = (host: LibHost, kind: string, before: string): Promise<void> =>
  host.frame().evaluate(
    ([k, sel]) => {
      const root = document.querySelector('[data-docreader-root]') as HTMLElement;
      const at = root.querySelector(sel as string);
      const make = (tag: string, text: string): HTMLElement => {
        const el = document.createElement(tag);
        el.textContent = text;
        return el;
      };
      const body = (n: number): HTMLElement[] => Array.from({ length: n }, (_, i) => make('p', `Injected line block ${String(i)} ${'filler words that make the paragraph wrap onto a few lines '.repeat(3 + (i % 4))}`));
      let el: HTMLElement;
      if (k === 'card') {
        el = document.createElement('div');
        el.className = 'test-card';
        const head = make('div', 'Card head');
        head.className = 'test-card-head';
        head.style.position = 'sticky';
        head.style.top = '0';
        head.style.height = '36px';
        head.style.background = 'rgb(240, 240, 240)';
        head.style.zIndex = '5';
        el.append(head, ...body(26));
      } else if (k === 'figure') {
        el = document.createElement('figure');
        el.className = 'mermaid-figure';
        const tools = document.createElement('div');
        tools.className = 'tools';
        tools.append(make('button', 'Full screen'), make('button', 'Copy'));
        const drawing = document.createElement('div');
        drawing.className = 'test-drawing';
        drawing.style.height = `${String(Math.round(innerHeight * 2.4))}px`;
        drawing.style.background = 'rgb(154, 170, 187)';
        el.append(tools, drawing);
      } else if (k === 'bigcard') {
        el = document.createElement('div');
        el.className = 'test-card';
        const head = make('div', 'Tall head');
        head.className = 'test-card-head';
        head.style.position = 'sticky';
        head.style.top = '0';
        head.style.height = `${String(innerHeight - 3)}px`;
        head.style.background = 'rgb(240, 240, 240)';
        head.style.zIndex = '5';
        el.append(head, ...body(40));
      } else if (k === 'big') {
        el = document.createElement('div');
        el.className = 'test-big';
        for (let i = 0; i < 6; i += 1) {
          const big = make('p', 'Big');
          big.style.fontSize = '260px';
          big.style.lineHeight = '300px';
          el.append(big);
        }
      } else if (k === 'floating') {
        el = document.createElement('div');
        el.className = 'test-floating';
        const card = make('div', 'A card that is shown');
        card.className = 'xcard';
        card.style.display = 'block';
        card.style.top = '100px';
        card.style.left = '60px';
        card.style.height = '60px';
        const side = make('div', 'Side');
        side.className = 'test-side';
        side.style.position = 'fixed';
        side.style.left = '0px';
        side.style.top = '0px';
        side.style.width = '50px';
        side.style.height = '90px';
        side.style.zIndex = '5';
        el.append(card, side);
      } else if (k === 'image' || k === 'near') {
        el = document.createElement('div');
        el.className = 'test-image-box';
        const img = document.createElement('img');
        img.src = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect width="300" height="300" fill="#9ab"/></svg>')}`;
        img.alt = 'tall';
        img.style.display = 'block';
        img.style.width = '300px';
        img.style.height = k === 'image' ? `${String(Math.round(innerHeight * 2.4))}px` : `${String(Math.round(innerHeight * 0.9))}px`;
        el.append(img);
      } else {
        el = document.createElement('div');
        el.className = 'test-controls';
        const extra = k === 'controls-more';
        const a = make('a', 'A link');
        a.setAttribute('href', '#nowhere');
        const b = make('button', 'A button');
        const d = document.createElement('details');
        const s = make('summary', 'A summary');
        d.append(s, make('p', 'Opened'));
        const c = make('div', 'A card');
        c.className = 'xcard';
        c.style.position = 'static';
        c.style.display = 'block';
        c.style.height = '40px';
        for (const x of [a, b, s, c]) x.addEventListener('click', (e) => e.preventDefault());
        el.append(a, make('p', ' '), b, make('p', ' '), d, make('p', ' '), c);
        // the rest of the selector list: a control of each kind, each a box of its own (tapped with synthetic pointer events)
        const more = (cls: string, node: HTMLElement): void => {
          if (!extra) return;
          node.classList.add('m', cls);
          node.style.display = 'block';
          node.style.height = '34px';
          node.style.width = '220px';
          el.append(node);
        };
        const input = document.createElement('input');
        more('m-input', input);
        more('m-select', document.createElement('select'));
        more('m-textarea', document.createElement('textarea'));
        more('m-label', make('label', 'A label'));
        const roleButton = make('div', 'role button');
        roleButton.setAttribute('role', 'button');
        more('m-role-button', roleButton);
        const roleMenu = make('div', 'role menu');
        roleMenu.setAttribute('role', 'menu');
        more('m-role-menu', roleMenu);
        const roleDialog = make('div', 'role dialog');
        roleDialog.setAttribute('role', 'dialog');
        more('m-role-dialog', roleDialog);
        const tabbable = make('div', 'tabindex 0');
        tabbable.setAttribute('tabindex', '0');
        more('m-tabindex', tabbable);
        const jumped = make('div', 'tabindex -1');
        jumped.setAttribute('tabindex', '-1');
        more('m-tabindex-off', jumped);
        more('m-tools', make('div', 'tools'));
        if (extra) el.lastElementChild?.classList.add('tools');
        more('m-tbl-tools', make('div', 'table tools'));
        if (extra) el.lastElementChild?.classList.add('tbl-tools');
      }
      root.insertBefore(el, at);
    },
    [kind, before] as const,
  );

/** Scroll the page (instantly) so that the first element matching `sel` has its top at `top` in the viewport. */
const scrollToEl = (host: LibHost, sel: string, top: number): Promise<void> =>
  host.frame().evaluate(
    ([s, t]) => {
      const el = document.querySelector(s as string) as HTMLElement;
      scrollTo({ top: el.getBoundingClientRect().top + scrollY - (t as number), behavior: 'instant' });
    },
    [sel, top] as const,
  );

/** Choose a text size in the frame's Aa row, as a reader's click does (the size is the reader's own pref, not on the bridge). */
const chooseSize = (host: LibHost, size: string): Promise<void> =>
  host.frame().evaluate((v) => {
    (document.querySelector(`input[data-pref="size"][value="${v}"]`) as HTMLInputElement).click();
  }, size);

const WIDTHS = [390, 720, 1200] as const;
const FONTS = ['serif', 'sans'] as const;

describeBrowsers((browser: BrowserName) => {
  for (const width of WIDTHS) {
    for (const font of FONTS) {
      it(`T1 (default layout, ${String(width)} px, ${font}): forward and back turns land on a whole line, and each moves at least a third of a screen`, async () => {
        const host = await open(browser, LINES, {}, { width, height: 844 });
        try {
          await host.setPrefs({ font });
          await screens(host);
          const h = await probe<number>(host, 'h');
          const seen: number[] = [];
          for (let k = 0; k < 6; k += 1) {
            const { before, after } = await turn(host, 'ArrowRight');
            expect(after - before, `forward turn ${String(k)} moves at least a third of a screen`).toBeGreaterThanOrEqual(h / 3);
            expect(await probe<unknown[]>(host, 'cut', 0), `forward turn ${String(k)}: no line is cut at the top`).toEqual([]);
            // the target line is whole, and within a pixel of the top (a scroll position is whole pixels: rounded down, it never cuts the line)
            const top = ((await probe<{ t: number }[]>(host, 'whole', 0, 0.01))[0] as { t: number }).t;
            expect(top, `forward turn ${String(k)}: the first whole line starts at the top`).toBeLessThanOrEqual(1.2);
            seen.push(after);
          }
          for (let k = 0; k < 4; k += 1) {
            // the first line wholly shown becomes the first line below the bottom edge (or the one just under it, once the top line is made whole)
            const first = ((await probe<{ t: number }[]>(host, 'whole', 0))[0] as { t: number }).t + (await P.y(host));
            const { before, after } = await turn(host, 'ArrowLeft');
            expect(first - after, `back turn ${String(k)}: the first line shown is now just below the bottom edge`).toBeGreaterThanOrEqual(h - 1.5);
            expect(first - after).toBeLessThanOrEqual(h + 40);
            expect(before - after, `back turn ${String(k)} moves at least a third of a screen`).toBeGreaterThanOrEqual(h / 3);
            expect(await probe<unknown[]>(host, 'cut', 0), `back turn ${String(k)}: no line is cut at the top`).toEqual([]);
          }
          // PageDown and Space go forward, PageUp and Shift+Space back, the same way
          const a = await turn(host, 'PageDown');
          expect(a.after).toBeGreaterThan(a.before);
          expect(await probe<unknown[]>(host, 'cut', 0)).toEqual([]);
          const b = await turn(host, 'Space');
          expect(b.after).toBeGreaterThan(b.before);
          const c = await turn(host, 'Shift+Space');
          expect(c.after).toBeLessThan(c.before);
          const d = await turn(host, 'PageUp');
          expect(d.after).toBeLessThan(d.before);
          expect(await probe<unknown[]>(host, 'cut', 0)).toEqual([]);
        } finally {
          await host.close();
        }
      }, 240_000);
    }
  }

  for (const only of ['caretRangeFromPoint', 'caretPositionFromPoint'] as const) {
    it(`T1c (default layout): where only ${only} exists, a turn still lands on a whole line`, async () => {
      const host = await open(browser, LINES);
      try {
        const gone = only === 'caretRangeFromPoint' ? 'caretPositionFromPoint' : 'caretRangeFromPoint';
        await host.frame().evaluate((name) => {
          Object.defineProperty(document, name, { value: undefined, configurable: true });
        }, gone);
        expect(await host.frame().evaluate((name) => typeof (document as unknown as Record<string, unknown>)[name], only)).toBe('function');
        await screens(host);
        for (let k = 0; k < 3; k += 1) {
          const t = await turn(host, 'ArrowRight');
          expect(t.after).toBeGreaterThan(t.before);
          expect(await probe<unknown[]>(host, 'cut', 0)).toEqual([]);
        }
        for (let k = 0; k < 2; k += 1) {
          const t = await turn(host, 'ArrowLeft');
          expect(t.after).toBeLessThan(t.before);
          expect(await probe<unknown[]>(host, 'cut', 0)).toEqual([]);
        }
      } finally {
        await host.close();
      }
    }, 240_000);
  }

  it('T1d (default layout): in paragraphs with raised sup marks, code and kbd runs, turns still land on whole lines (no sliver above, no clipped target)', async () => {
    const host = await open(browser, MIXED, {}, { width: 720, height: 844 });
    try {
      await screens(host);
      for (let k = 0; k < 8; k += 1) {
        const t = await turn(host, 'ArrowRight');
        expect(t.after).toBeGreaterThan(t.before);
        expect(await probe<unknown[]>(host, 'textCut', 0), `forward turn ${String(k)}: no text is cut at the top`).toEqual([]);
      }
      for (let k = 0; k < 6; k += 1) {
        const t = await turn(host, 'ArrowLeft');
        expect(t.after).toBeLessThan(t.before);
        expect(await probe<unknown[]>(host, 'textCut', 0), `back turn ${String(k)}: no text is cut at the top`).toEqual([]);
      }
    } finally {
      await host.close();
    }
  }, 240_000);

  it('T2 (default layout): the line the bottom edge cuts is covered by the ground band until a scroll, and it is the first line the next turn shows', async () => {
    const host = await open(browser, LINES);
    try {
      await screens(host);
      const h = await probe<number>(host, 'h');
      let covered = 0;
      for (let k = 0; k < 5; k += 1) {
        await turn(host, 'ArrowRight');
        const cut = await probe<{ t: number; b: number }[]>(host, 'cut', h);
        const band = await probe<{ shown: boolean; top: number; bottom: number; count: number }>(host, 'band');
        if (cut.length === 0) {
          expect(band.shown, 'no cut line, no band').toBe(false);
          continue;
        }
        covered += 1;
        const line = cut[0] as { t: number; b: number };
        expect(band.shown).toBe(true);
        expect(band.count).toBe(1);
        expect(Math.abs(band.top - line.t)).toBeLessThanOrEqual(1);
        expect(band.bottom).toBeGreaterThanOrEqual(h - 1);
        // the band is the reader's ground, not transparent, and lets taps through
        const look = await host.frame().evaluate(() => {
          const cs = getComputedStyle(document.querySelector('.page-band') as Element);
          return { bg: cs.backgroundColor, events: cs.pointerEvents, position: cs.position };
        });
        expect(look.bg).not.toBe('rgba(0, 0, 0, 0)');
        expect(look.events).toBe('none');
        expect(look.position).toBe('fixed');
        // the next turn shows that line first
        const y0 = await P.y(host);
        await turn(host, 'ArrowRight');
        const y1 = await P.y(host);
        const top = await probe<{ t: number; b: number }[]>(host, 'whole', 0);
        expect(Math.abs((top[0] as { t: number }).t - 0), `turn ${String(k)}: the covered line (document y ${String(y0 + line.t)}) leads the next page (scroll ${String(y1)})`).toBeLessThanOrEqual(1);
        expect(Math.abs(y1 + 0 - (y0 + line.t))).toBeLessThanOrEqual(1);
        break;
      }
      expect(covered).toBeGreaterThan(0);
      // a scroll removes the band: turn until one is drawn, then scroll a little
      for (let k = 0; k < 6 && !(await probe<{ shown: boolean }>(host, 'band')).shown; k += 1) await turn(host, 'ArrowRight');
      expect((await probe<{ shown: boolean }>(host, 'band')).shown, 'a band is on screen').toBe(true);
      await host.frame().evaluate(() => {
        scrollBy(0, 7);
      });
      await until(async () => !(await probe<{ shown: boolean }>(host, 'band')).shown, 'a scroll removes the band');
    } finally {
      await host.close();
    }
  }, 240_000);

  it('T2c (default layout): the band is not printed: in print media it is hidden', async () => {
    const host = await open(browser, LINES);
    try {
      await screens(host);
      await drawBand(host);
      // read at once: the print resize would take the band away by a relayout a moment later (the debounce), and it is the stylesheet's rule that is judged
      await host.page.emulateMedia({ media: 'print' });
      const look = await host.frame().evaluate(() => {
        const el = document.querySelector('.page-band') as HTMLElement;
        return { print: matchMedia('print').matches, hidden: el.hasAttribute('hidden'), display: getComputedStyle(el).display };
      });
      expect(look, 'a drawn band (not hidden by the reader) does not print').toEqual({ print: true, hidden: false, display: 'none' });
    } finally {
      await host.page.emulateMedia({ media: null }).catch(() => undefined);
      await host.close();
    }
  }, 240_000);

  it('T2d (default layout): a relayout of any reason removes the band, with no scroll: a figure drawn below the screen leaves the text where it is', async () => {
    const host = await open(browser, MER, { document: { ...input(MER), scan: { mermaid: scanRefs(MER).mermaid } }, assets: { ...assets, mermaid }, mermaidDraw: 'on-request' });
    try {
      await until(() => host.frame().evaluate(() => document.querySelector('.fig-render-btn') !== null), 'the Render button is there');
      await screens(host);
      await drawBand(host);
      const y = await P.y(host);
      await host.frame().evaluate(() => {
        (document.querySelector('.fig-render-btn') as HTMLElement).click();
      });
      await until(() => host.frame().evaluate(() => document.querySelector('.mermaid-figure svg') !== null), 'the figure is drawn');
      await until(async () => !(await probe<{ shown: boolean }>(host, 'band')).shown, 'the relayout removes the band');
      expect(await P.y(host), 'nothing scrolled: the relayout alone removed the band').toBe(y);
    } finally {
      await host.close();
    }
  }, 240_000);

  it('T3 (default layout): an image taller than the screen is stepped through with one line of overlap, no band is drawn, and it shows to the bottom edge', async () => {
    const host = await open(browser, LINES);
    try {
      await inject(host, 'image', 'p:nth-of-type(6)');
      await screens(host);
      const h = await probe<number>(host, 'h');
      const lh = await host.frame().evaluate(() => parseFloat(getComputedStyle(document.querySelector('.test-image-box img') as Element).lineHeight));
      expect(lh).toBeGreaterThan(0);
      await scrollToEl(host, '.test-image-box img', h * 0.5);
      await sleep(200);
      const steps: number[] = [];
      let through = 0;
      for (let k = 0; k < 6; k += 1) {
        const { before, after } = await turn(host, 'ArrowRight');
        const r = await probe<{ t: number; b: number } | null>(host, 'rect', '.test-image-box img');
        // the image starts in the lower two thirds: the first turn aligns its top
        if (k === 0) expect(Math.abs((r as { t: number }).t), 'the first turn aligns the top of an image that starts in the lower two thirds').toBeLessThanOrEqual(1.5);
        if (r === null) break;
        const inside = r.t < 0 && r.b > h;
        if (inside) {
          through += 1;
          const band = await probe<{ shown: boolean }>(host, 'band');
          expect(band.shown, 'no band over a block stepped through').toBe(false);
          expect(r.b, 'the image shows to the bottom edge').toBeGreaterThan(h - 0.5);
          steps.push(after - before);
        }
      }
      expect(through).toBeGreaterThan(0);
      for (const s of steps) expect(Math.abs(s - (h - lh)), `steps ${JSON.stringify(steps)} h ${String(h)} lh ${String(lh)}`).toBeLessThanOrEqual(1.5);
    } finally {
      await host.close();
    }
  }, 240_000);

  it('T3d (default layout): a back turn through an image taller than the screen also keeps one line of overlap', async () => {
    const host = await open(browser, LINES);
    try {
      await inject(host, 'image', 'p:nth-of-type(6)');
      await screens(host);
      const h = await probe<number>(host, 'h');
      const lh = await host.frame().evaluate(() => parseFloat(getComputedStyle(document.querySelector('.test-image-box img') as Element).lineHeight));
      // the image spans the screen with room to spare: its top is a screen and a tenth above, so one back step still leaves it spanning
      await scrollToEl(host, '.test-image-box img', -h * 1.1);
      await sleep(200);
      const { before, after } = await turn(host, 'ArrowLeft');
      const r = await probe<{ t: number; b: number }>(host, 'rect', '.test-image-box img');
      expect(Math.abs(before - after - (h - lh)), `back step ${String(before - after)}`).toBeLessThanOrEqual(1.5);
      expect(r.t).toBeLessThan(0);
      expect(r.b).toBeGreaterThan(h);
    } finally {
      await host.close();
    }
  }, 240_000);

  it('T3b (default layout): a block of code taller than the screen is stepped through one screen less one line at a time', async () => {
    const host = await open(browser, CODE);
    try {
      await screens(host);
      const h = await probe<number>(host, 'h');
      const lh = await host.frame().evaluate(() => parseFloat(getComputedStyle(document.querySelector('pre') as Element).lineHeight));
      const steps: number[] = [];
      for (let k = 0; k < 10; k += 1) {
        const { before, after } = await turn(host, 'ArrowRight');
        const r = await probe<{ t: number; b: number } | null>(host, 'rect', 'pre');
        if (r !== null && r.t < -0.5 && r.b > h + 0.5 && before > 0) steps.push(after - before);
        if (r !== null && r.b < 0) break;
      }
      expect(steps.length).toBeGreaterThanOrEqual(2);
      for (const s of steps) expect(Math.abs(s - (h - lh)), `steps ${JSON.stringify(steps)} h ${String(h)} lh ${String(lh)}`).toBeLessThanOrEqual(1.5);
    } finally {
      await host.close();
    }
  }, 240_000);

  for (const [name, md, pinnedHead] of [
    ['a table whose head pins (.fits)', FITS, true],
    ['a wide table whose head does not pin', WIDE, false],
  ] as const) {
    it(`T4 (default layout): in ${name}, each forward turn puts the next row at the head's bottom, and every row is wholly shown on some page, forward and back`, async () => {
      const host = await open(browser, md, {}, { width: 1000, height: 844 });
      try {
        await screens(host);
        const h = await probe<number>(host, 'h');
        const fits = await host.frame().evaluate(() => document.querySelector('.table-wrapper')?.classList.contains('fits') === true);
        expect(fits).toBe(pinnedHead);
        const shown = new Set<number>();
        const collect = async (): Promise<void> => {
          const head = await probe<number>(host, 'pinned', 'th');
          for (const r of await probe<{ i: number; t: number; b: number }[]>(host, 'rows', 'tbody tr')) if (r.t >= head - 0.5 && r.b <= h + 0.5) shown.add(r.i);
        };
        let pinnedSeen = 0;
        for (let k = 0; k < 40; k += 1) {
          const { before, after } = await turn(host, 'ArrowRight');
          if (after === before) break;
          const head = await probe<number>(host, 'pinned', 'th');
          const tbl = await probe<{ t: number; b: number } | null>(host, 'rect', 'table');
          const rows = await probe<{ i: number; t: number; b: number }[]>(host, 'rows', 'tbody tr');
          if (tbl !== null && tbl.t < head && tbl.b > h && head > 0) {
            pinnedSeen += 1;
            for (const r of rows) expect(r.t < head - 1 && r.b > head + 1, `row ${String(r.i)} is not under the head`).toBe(false);
            const first = rows.find((r) => r.t >= head - 1);
            expect(first, 'a row starts at the head').toBeDefined();
            expect(Math.abs((first as { t: number }).t - head), `turn ${String(k)}: the next row is at the head's bottom`).toBeLessThanOrEqual(1);
          }
          // a row cut by the bottom edge is a block stepped through: the band never covers it
          if (rows.some((r) => r.t < h - 1 && r.b > h + 1)) expect((await probe<{ shown: boolean }>(host, 'band')).shown, `turn ${String(k)}: no band over a cut row`).toBe(false);
          await collect();
        }
        if (pinnedHead) expect(pinnedSeen).toBeGreaterThan(2);
        else expect(await probe<number>(host, 'pinned', 'th')).toBe(0);
        // back, from the end
        let stepped = 0;
        for (let k = 0; k < 60; k += 1) {
          // inside the table, the first row wholly shown below the head becomes the first row below the bottom edge
          const head = await probe<number>(host, 'pinned', 'th');
          const tbl = await probe<{ t: number; b: number } | null>(host, 'rect', 'table');
          const first = (await probe<{ i: number; t: number; b: number }[]>(host, 'rows', 'tbody tr')).find((r) => r.t >= head - 0.5 && r.b <= h + 0.5);
          const { before, after } = await turn(host, 'ArrowLeft');
          await collect();
          if (after === before) break;
          if (tbl !== null && tbl.t < 0 && tbl.b > h && first !== undefined && after > 20) {
            const now = (await probe<{ i: number; t: number; b: number }[]>(host, 'rows', 'tbody tr'))[first.i] as { t: number };
            expect(Math.abs(now.t - h), `back turn ${String(k)}: row ${String(first.i)} is the first below the bottom edge`).toBeLessThanOrEqual(1.5);
            stepped += 1;
          }
        }
        expect(stepped, 'back turns were checked inside the table').toBeGreaterThan(2);
        expect([...shown].sort((a, b) => a - b)).toEqual(Array.from({ length: 60 }, (_, i) => i));
      } finally {
        await host.close();
      }
    }, 300_000);
  }

  it("T5 (default layout): a card's pinned head offsets the target of each turn", async () => {
    const host = await open(browser, LINES);
    try {
      await screens(host);
      await turn(host, 'ArrowRight'); // the first turn finds what is pinned, so the card below is added to a document already measured
      await inject(host, 'card', 'p:nth-of-type(16)');
      let inside = 0;
      for (let k = 0; k < 14; k += 1) {
        const { before, after } = await turn(host, 'ArrowRight');
        if (after === before) break;
        const pin = await probe<number>(host, 'pinned', '.test-card-head');
        const h = await probe<number>(host, 'h');
        const r = await probe<{ t: number; b: number } | null>(host, 'rect', '.test-card');
        if (r === null || !(r.t < 0 && r.b > h) || pin === 0) continue;
        inside += 1;
        const lines = await probe<{ t: number; b: number }[]>(host, 'lines');
        for (const l of lines) expect(l.t < pin - 1 && l.b > pin + 1, `no line is under the pinned head (pin ${String(pin)}, line ${JSON.stringify(l)}, turn ${String(k)})`).toBe(false);
        const first = lines.find((l) => l.t >= pin - 1);
        expect(Math.abs((first as { t: number }).t - pin), `turn ${String(k)}: the target line meets the pinned bottom`).toBeLessThanOrEqual(1);
      }
      expect(inside).toBeGreaterThanOrEqual(2);
    } finally {
      await host.close();
    }
  }, 240_000);

  it("T5b (default layout): a figure's pinned tools offset a step through the drawing: one screen below the tools, less one line", async () => {
    const host = await open(browser, LINES);
    try {
      await inject(host, 'figure', 'p:nth-of-type(6)');
      await screens(host);
      const h = await probe<number>(host, 'h');
      const lh = await host.frame().evaluate(() => parseFloat(getComputedStyle(document.querySelector('figure.mermaid-figure') as Element).lineHeight));
      const steps: number[] = [];
      let pin = 0;
      for (let k = 0; k < 6; k += 1) {
        const { before, after } = await turn(host, 'ArrowRight');
        const now = await probe<number>(host, 'pinned', '.tools');
        pin = Math.max(pin, now);
        const r = await probe<{ t: number; b: number } | null>(host, 'rect', '.test-drawing');
        if (r !== null && r.t < 0 && r.b > h && before > 0 && now > 0) steps.push(after - before);
      }
      expect(pin, 'the tools are pinned, with their buttons').toBeGreaterThan(30);
      expect(steps.length).toBeGreaterThanOrEqual(1);
      for (const s of steps) expect(Math.abs(s - (h - pin - lh)), `pin ${String(pin)} steps ${JSON.stringify(steps)}`).toBeLessThanOrEqual(1.5);
      // the line of overlap shows just below the tools: the image's top edge is above the screen by the steps taken
      const r = await probe<{ t: number }>(host, 'rect', '.test-drawing');
      expect(r.t).toBeLessThan(0);
    } finally {
      await host.close();
    }
  }, 240_000);

  it('T2b (default layout): a band never starts above the reading area, even under a pinned head nearly as tall as the screen', async () => {
    const host = await open(browser, LINES);
    try {
      await inject(host, 'bigcard', 'p:nth-of-type(6)');
      await screens(host);
      const h = await probe<number>(host, 'h');
      await scrollToEl(host, '.test-card', 0);
      await sleep(200);
      let above = 0;
      for (let k = 0; k < 4; k += 1) {
        const t = await turn(host, 'ArrowRight');
        expect(t.after - t.before, `turn ${String(k)} goes forward by a third of a screen at least`).toBeGreaterThanOrEqual(h / 3 - 1);
        const pin = await probe<number>(host, 'pinned', '.test-card-head');
        expect(pin).toBeGreaterThan(h - 40);
        const cut = await probe<{ t: number; b: number }[]>(host, 'cut', h);
        const band = await probe<{ shown: boolean; top: number }>(host, 'band');
        if (cut.length > 0 && (cut[0] as { t: number }).t < pin - 1) {
          above += 1;
          expect(band.shown, `turn ${String(k)}: the cut line starts above the reading area`).toBe(false);
        }
        if (band.shown) expect(band.top).toBeGreaterThanOrEqual(pin - 1);
      }
      expect(above).toBeGreaterThan(0);
    } finally {
      await host.close();
    }
  }, 240_000);

  it('T3c (default layout): a line taller than a third of a screen is never covered by the band', async () => {
    const host = await open(browser, LINES);
    try {
      await inject(host, 'big', 'p:nth-of-type(6)');
      await screens(host);
      const h = await probe<number>(host, 'h');
      await scrollToEl(host, '.test-big p', h * 0.9);
      await sleep(200);
      await turn(host, 'ArrowRight');
      const lines = await host.frame().evaluate(() => Array.from(document.querySelectorAll('.test-big p'), (p) => [p.getBoundingClientRect().top, p.getBoundingClientRect().bottom]));
      expect(lines.some(([t, b]) => (t as number) < h - 1 && (b as number) > h + 1), 'a tall line is cut by the bottom edge').toBe(true);
      expect((await probe<{ shown: boolean }>(host, 'band')).shown).toBe(false);
    } finally {
      await host.close();
    }
  }, 240_000);

  it('T6b (default layout): an open card, and a fixed box beside the column, are not pinned text: the turn still lands at the top', async () => {
    const host = await open(browser, LINES);
    try {
      await inject(host, 'floating', 'p:nth-of-type(2)');
      await screens(host);
      for (let k = 0; k < 3; k += 1) {
        await turn(host, 'ArrowRight');
        expect(await probe<unknown[]>(host, 'cut', 0), `turn ${String(k)}`).toEqual([]);
        const first = (await probe<{ t: number }[]>(host, 'whole', 0))[0] as { t: number };
        expect(first.t).toBeLessThanOrEqual(1.5);
      }
    } finally {
      await host.close();
    }
  }, 240_000);

  it('T8b (default layout): a swipe does not turn while an overlay is open, and turns once it is closed', async () => {
    const host = await open(browser, LINES);
    try {
      await screens(host);
      const { w, h } = await viewport(host);
      const at = { x: w * 0.5, y: h * 0.5 };
      await host.command('settings');
      await until(() => host.frame().evaluate(() => document.querySelector('.aa-menu')?.hasAttribute('hidden') === false), 'the settings menu is open');
      const y0 = await P.y(host);
      await swipe(host, at, -140, 4, 150);
      await sleep(400);
      expect(await P.y(host)).toBe(y0);
      // a tap on the text while it is open does not turn either (whatever it does to the menu)
      await tap(host, w * 0.7, h * 0.7);
      await sleep(400);
      expect(await P.y(host)).toBe(y0);
      if (await host.frame().evaluate(() => document.querySelector('.aa-menu')?.hasAttribute('hidden') === true)) await host.command('settings');
      await host.command('settings');
      await until(() => host.frame().evaluate(() => document.querySelector('.aa-menu')?.hasAttribute('hidden') === true), 'the settings menu is closed');
      await swipe(host, at, -140, 4, 150);
      expect(await settle(host)).toBeGreaterThan(y0);
    } finally {
      await host.close();
    }
  }, 240_000);

  it('T7c (default layout): only a primary pointer with the main button taps', async () => {
    const host = await open(browser, LINES);
    try {
      await screens(host);
      const { w, h } = await viewport(host);
      const y0 = await P.y(host);
      await tap(host, w * 0.9, h * 0.5);
      expect(await settle(host)).toBeGreaterThan(y0);
      await probe(host, 'scrollTo', 0);
      await sleep(200);
      // a right click
      const o = await frameBox(host);
      await host.page.mouse.click(o.x + w * 0.9, o.y + h * 0.5, { button: 'right' });
      await sleep(400);
      expect(await P.y(host)).toBe(0);
      // a pointer that is not the primary one (a second finger)
      const fire = (primary: boolean): Promise<void> =>
        host.frame().evaluate(
          ([x, y, p]) => {
            const target = document.elementFromPoint(x as number, y as number) ?? document.body;
            for (const type of ['pointerdown', 'pointerup']) target.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, isPrimary: p as boolean, button: 0, clientX: x as number, clientY: y as number, pointerId: 7 }));
          },
          [w * 0.9, h * 0.5, primary] as const,
        );
      await fire(false);
      await sleep(400);
      expect(await P.y(host)).toBe(0);
      await fire(true);
      expect(await settle(host)).toBeGreaterThan(0);
    } finally {
      await host.close();
    }
  }, 240_000);

  it('T13b (default layout): Shift with an arrow, and a key on a focused control, are the browser\'s, not a turn', async () => {
    const host = await open(browser, LINES);
    try {
      await inject(host, 'controls', 'p:nth-of-type(2)');
      await screens(host);
      await probe(host, 'scrollTo', 300);
      await sleep(200);
      await press(host, 'Shift+ArrowRight');
      await sleep(300);
      expect(await P.y(host), 'Shift+ArrowRight is not a turn').toBe(300);
      await host.frame().evaluate(() => (document.querySelector('.test-controls button') as HTMLElement).focus({ preventScroll: true }));
      for (const key of ['Space', 'ArrowRight']) {
        await press(host, key);
        await sleep(300);
        expect(await P.y(host), `${key} on a focused button is not a turn`).toBe(300);
      }
    } finally {
      await host.close();
    }
  }, 240_000);

  it('T6 (default layout): a turn moves at least a third of a screen even when a block cut by the bottom edge starts near the top; the end and the start do nothing', async () => {
    const host = await open(browser, LINES);
    try {
      await inject(host, 'near', 'p:nth-of-type(6)');
      await screens(host);
      const h = await probe<number>(host, 'h');
      const lh = await host.frame().evaluate(() => parseFloat(getComputedStyle(document.querySelector('.test-image-box img') as Element).lineHeight));
      await scrollToEl(host, '.test-image-box img', h * 0.2);
      await sleep(200);
      const { before, after } = await turn(host, 'ArrowRight');
      expect(after - before).toBeGreaterThanOrEqual(h / 3);
      expect(Math.abs(after - before - (h - 2 * lh))).toBeLessThanOrEqual(1.5);
      // the start: a back turn at the top does nothing
      await probe(host, 'scrollTo', 0);
      await sleep(150);
      const back = await turn(host, 'ArrowLeft');
      expect(back.after).toBe(0);
      expect((await probe<{ shown: boolean }>(host, 'band')).shown).toBe(false);
      // the end: a forward turn at the bottom does nothing
      const max = await probe<number>(host, 'max');
      await probe(host, 'scrollTo', max);
      await sleep(150);
      const end = await turn(host, 'ArrowRight');
      expect(end.after).toBe(end.before);
      const pg = await turn(host, 'PageDown');
      expect(pg.after).toBe(pg.before);
      expect((await probe<{ shown: boolean }>(host, 'band')).shown).toBe(false);
    } finally {
      await host.close();
    }
  }, 240_000);

  it('T7 (default layout): a plain tap turns (right two thirds forward, left third back); a tap on a link, a button, a Render button, a summary or a card never does', async () => {
    const host = await open(browser, MER, { document: { ...input(MER), scan: { mermaid: scanRefs(MER).mermaid } }, assets: { ...assets, mermaid }, mermaidDraw: 'on-request' });
    try {
      await inject(host, 'controls', 'p:nth-of-type(8)');
      await screens(host);
      const { w, h } = await viewport(host);
      // plain tap: forward
      const f = await P.y(host);
      await tap(host, w * 0.6, h * 0.5);
      expect(await settle(host)).toBeGreaterThan(f);
      const g = await P.y(host);
      await tap(host, w * 0.15, h * 0.5);
      expect(await settle(host), 'a tap in the left third goes back').toBeLessThan(g);
      // controls: place each one in view, tap its centre, and the page stays
      await until(() => host.frame().evaluate(() => document.querySelector('.fig-render-btn') !== null), 'the Render button is there');
      for (const sel of ['.test-controls a', '.test-controls button', '.test-controls summary', '.test-controls .xcard', '.fig-render-btn']) {
        await scrollToEl(host, sel, h * 0.4);
        await sleep(150);
        const at = await centre(host, sel);
        expect(at, sel).not.toBeNull();
        const y = await P.y(host);
        await tap(host, (at as { x: number }).x, (at as { y: number }).y);
        await sleep(350);
        expect(await P.y(host), `a tap on ${sel} does not turn`).toBe(y);
      }
      expect((await host.lib()).events.some((e) => e.kind === 'fallback')).toBe(false);
    } finally {
      await host.close();
    }
  }, 240_000);

  it('T7d (default layout): a tap on any control of the selector list never turns; a tap on a box with tabindex -1 (a jump target) does', async () => {
    const host = await open(browser, LINES);
    try {
      await inject(host, 'controls-more', 'p:nth-of-type(8)');
      await screens(host);
      const { h } = await viewport(host);
      const synthetic = (sel: string): Promise<void> =>
        host.frame().evaluate((s) => {
          const r = (document.querySelector(s) as HTMLElement).getBoundingClientRect();
          const x = r.left + r.width / 2;
          const y = r.top + r.height / 2;
          const target = document.elementFromPoint(x, y) as Element;
          for (const type of ['pointerdown', 'pointerup']) target.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, isPrimary: true, button: 0, clientX: x, clientY: y, pointerId: 3 }));
        }, sel);
      for (const cls of ['m-input', 'm-select', 'm-textarea', 'm-label', 'm-role-button', 'm-role-menu', 'm-role-dialog', 'm-tabindex', 'm-tools', 'm-tbl-tools']) {
        await scrollToEl(host, `.${cls}`, h * 0.4);
        await sleep(120);
        const y = await P.y(host);
        await synthetic(`.${cls}`);
        await sleep(300);
        expect(await P.y(host), `a tap on .${cls} does not turn`).toBe(y);
      }
      await scrollToEl(host, '.m-tabindex-off', h * 0.4);
      await sleep(120);
      const y = await P.y(host);
      await synthetic('.m-tabindex-off');
      expect(await settle(host), 'a tap on a box with tabindex -1 turns (back, in the left third)').not.toBe(y);
    } finally {
      await host.close();
    }
  }, 240_000);

  it('T7e (default layout): a press that began on text and is released on a control, within 10 px, is not a tap', async () => {
    const host = await open(browser, LINES);
    try {
      await inject(host, 'controls', 'p:nth-of-type(8)');
      await screens(host);
      const { h } = await viewport(host);
      await scrollToEl(host, '.test-controls button', h * 0.5);
      await sleep(200);
      const b = (await host.frame().evaluate(() => {
        const r = (document.querySelector('.test-controls button') as HTMLElement).getBoundingClientRect();
        const control = (y: number): boolean => document.elementFromPoint(r.left + r.width / 2, y)?.closest('a[href],button') != null;
        return { x: r.left + r.width / 2, top: r.top, above: control(r.top - 3), below: control(r.top + 3) };
      })) as { x: number; top: number; above: boolean; below: boolean };
      expect([b.above, b.below], 'the press is on text just above the button and the release on the button').toEqual([false, true]);
      const o = await frameBox(host);
      const y0 = await P.y(host);
      await host.page.mouse.move(o.x + b.x, o.y + b.top - 3);
      await host.page.mouse.down();
      await host.page.mouse.move(o.x + b.x, o.y + b.top + 3, { steps: 2 });
      await host.page.mouse.up();
      await sleep(500);
      expect(await P.y(host), 'a press released on a button does not turn').toBe(y0);
    } finally {
      await host.close();
    }
  }, 240_000);

  it('T7b (default layout): a tap that moves more than 10 px, or lasts longer than 500 ms, is not a tap', async () => {
    const host = await open(browser, LINES);
    try {
      await screens(host);
      const { w, h } = await viewport(host);
      const o = await frameBox(host);
      const y0 = await P.y(host);
      // all in the empty right margin, where a press selects nothing: a drag of 14 px is not a tap
      const x = o.x + w - 40;
      const y = o.y + h * 0.5;
      await host.page.mouse.move(x, y);
      await host.page.mouse.down();
      await host.page.mouse.move(x + 14, y, { steps: 3 });
      await host.page.mouse.up();
      await sleep(400);
      expect(await P.y(host), 'a drag of 14 px does not turn').toBe(y0);
      // a long press is not a tap
      await host.page.mouse.move(x, y);
      await host.page.mouse.down();
      await sleep(650);
      await host.page.mouse.up();
      await sleep(400);
      expect(await P.y(host), 'a long press does not turn').toBe(y0);
      // a press that wanders 6 px and ends within 500 ms is a tap
      await host.page.mouse.move(x, y);
      await host.page.mouse.down();
      await host.page.mouse.move(x + 6, y);
      await host.page.mouse.up();
      expect(await settle(host)).toBeGreaterThan(y0);
    } finally {
      await host.close();
    }
  }, 240_000);

  it('T8 (default layout): a non-empty selection, or a press that began with one, never turns', async () => {
    const host = await open(browser, LINES);
    try {
      await screens(host);
      const { w, h } = await viewport(host);
      const y0 = await P.y(host);
      // a selection exists when the tap ends
      await host.frame().evaluate(() => {
        const p = document.querySelector('[data-docreader-root] p') as Element;
        const sel = getSelection() as Selection;
        sel.removeAllRanges();
        const r = document.createRange();
        r.selectNodeContents(p);
        sel.addRange(r);
      });
      await tap(host, w * 0.6, h * 0.5);
      await sleep(400);
      expect(await P.y(host), 'the tap that clears a selection does not turn').toBe(y0);
      // a drag that selects text is not a tap
      const o = await frameBox(host);
      await host.page.mouse.move(o.x + w * 0.3, o.y + h * 0.4);
      await host.page.mouse.down();
      await host.page.mouse.move(o.x + w * 0.6, o.y + h * 0.4 + 30, { steps: 5 });
      await host.page.mouse.up();
      await sleep(400);
      expect(await P.y(host)).toBe(y0);
      expect(await host.frame().evaluate(() => (getSelection() as Selection).isCollapsed)).toBe(false);
      // a selection made without a pointer, still there at a tap's end (the press began after it): no turn
      await tap(host, w * 0.6, h * 0.5);
      await sleep(400);
      expect(await P.y(host)).toBe(y0);
      // with the selection gone, the same tap turns
      await host.frame().evaluate(() => {
        (getSelection() as Selection).removeAllRanges();
      });
      await tap(host, w * 0.6, h * 0.5);
      const once = await settle(host);
      expect(once).toBeGreaterThan(y0);
      // a double click: its first click turns, its second selects a word (a press that ends with a selection) and does not turn again
      await probe(host, 'scrollTo', 0);
      await host.frame().evaluate(() => {
        (getSelection() as Selection).removeAllRanges();
      });
      await sleep(200);
      const o2 = await frameBox(host);
      await host.page.mouse.dblclick(o2.x + w * 0.6, o2.y + h * 0.5);
      expect(await settle(host), 'a double click is one turn').toBe(once);
    } finally {
      await host.close();
    }
  }, 240_000);

  it('T9 (default layout): the top band sends menu in screens and scroll mode and never while off; its height is the larger of 48 px and 15% of the view', async () => {
    const host = await open(browser, LINES);
    try {
      const { w, h } = await viewport(host);
      // off: nothing
      await tap(host, w * 0.5, 20);
      await sleep(400);
      expect(await acts(host)).toEqual([]);
      await screens(host);
      const y0 = await P.y(host);
      await tap(host, w * 0.5, 20);
      await until(async () => (await acts(host)).includes('menu'), 'menu arrives in screens mode');
      expect(await P.y(host), 'a tap on the top band does not turn').toBe(y0);
      // the band's lower edge: 15% of 804 is 120.6 px
      await sleep(350);
      const before = (await acts(host)).length;
      await tap(host, w * 0.5, h * 0.15 - 6);
      await until(async () => (await acts(host)).length === before + 1, 'a tap just inside the band sends menu');
      await sleep(350);
      await tap(host, w * 0.6, h * 0.15 + 8);
      await sleep(400);
      expect((await acts(host)).length).toBe(before + 1);
      expect(await settle(host)).toBeGreaterThan(y0);
      // scroll mode
      await host.setReading('scroll');
      await sleep(350);
      const n = (await acts(host)).length;
      await tap(host, w * 0.5, 20);
      await until(async () => (await acts(host)).length === n + 1, 'menu arrives in scroll mode');
      expect((await acts(host)).at(-1)).toBe('menu');
      // off again
      await host.setReading('off');
      await sleep(350);
      const m = (await acts(host)).length;
      await tap(host, w * 0.5, 20);
      await sleep(500);
      expect((await acts(host)).length).toBe(m);
    } finally {
      await host.close();
    }
  }, 240_000);

  it('T9b (default layout): on a short view the top band is 48 px, not 15% of the view', async () => {
    const host = await open(browser, LINES, {}, { width: 900, height: 300 });
    try {
      await screens(host);
      const { w } = await viewport(host);
      const y0 = await P.y(host);
      await tap(host, w * 0.5, 47);
      await until(async () => (await acts(host)).includes('menu'), 'a tap at 47 px sends menu (15% of 260 px is 39, so the band is 48)');
      await sleep(350);
      const n = (await acts(host)).length;
      await tap(host, w * 0.6, 60);
      await sleep(400);
      expect((await acts(host)).length).toBe(n);
      expect(await settle(host)).toBeGreaterThan(y0);
    } finally {
      await host.close();
    }
  }, 240_000);

  it('T9d (default layout): a press that began on the top band in screens mode, and ends after the mode turned off, sends no menu', async () => {
    const host = await open(browser, LINES);
    try {
      await screens(host);
      const { w } = await viewport(host);
      const o = await frameBox(host);
      const n = (await acts(host)).length;
      await host.page.mouse.move(o.x + w * 0.5, o.y + 20);
      await host.page.mouse.down();
      await host.setReading('off');
      await until(() => host.frame().evaluate(() => document.querySelector('[data-docreader-root]')?.hasAttribute('data-reading') === false), 'reader mode is off');
      await sleep(200);
      await host.page.mouse.up();
      await sleep(600);
      expect((await acts(host)).length, 'the press ended while off: no menu').toBe(n);
      // the same press with the mode on sends it
      await screens(host);
      await tap(host, w * 0.5, 20);
      await until(async () => (await acts(host)).length === n + 1, 'a tap on the top band sends menu while on');
    } finally {
      await host.close();
    }
  }, 240_000);

  it('T9c (default layout): taps on the top band at ten a second for five seconds never close the bridge', async () => {
    const host = await open(browser, LINES);
    try {
      await screens(host);
      const { w } = await viewport(host);
      const o = await frameBox(host);
      const started = Date.now();
      let taps = 0;
      while (Date.now() - started < 5000) {
        await host.page.mouse.click(o.x + w * 0.5, o.y + 20);
        taps += 1;
        await sleep(100);
      }
      const seconds = (Date.now() - started) / 1000;
      await until(async () => !(await host.lib()).events.some((e) => e.kind === 'fallback') && (await acts(host)).length >= 8, 'acts arrive');
      await sleep(600);
      const record = await host.lib();
      const got = record.events.filter((e) => e.kind === 'onReader');
      expect(taps).toBeGreaterThan(25);
      expect(record.events.some((e) => e.kind === 'fallback')).toBe(false);
      expect(got.length).toBeLessThanOrEqual(Math.ceil(seconds * 4) + 2);
      expect(got.every((e) => e.value === 'menu')).toBe(true);
      await host.setReading('scroll');
      await until(() => host.frame().evaluate(() => document.querySelector('[data-docreader-root]')?.getAttribute('data-reading') === 'scroll'), 'the frame still answers');
    } finally {
      await host.close();
    }
  }, 240_000);

  it('T10 (default layout): a swipe turns on its thresholds only: right to left forward, left to right back', async () => {
    const host = await open(browser, LINES);
    try {
      await screens(host);
      const { w, h } = await viewport(host);
      const at = { x: w * 0.5, y: h * 0.5 };
      const y0 = await P.y(host);
      for (const [name, dx, dy, ms] of [
        ['too short (40 px)', -40, 0, 100],
        ['not twice as wide as tall', -80, 50, 100],
        ['too slow (700 ms)', -120, 0, 700],
        ['vertical', 5, -150, 100],
      ] as const) {
        await swipe(host, at, dx, dy, ms);
        await sleep(350);
        expect(await P.y(host), `a swipe ${name} does not turn`).toBe(y0);
      }
      // a touch that is cancelled (the browser took it for a scroll) is not a swipe
      await host.frame().evaluate(
        async ([x, y]) => {
          const target = document.elementFromPoint(x as number, y as number) ?? document.body;
          const fire = (type: string, cx: number): void => {
            const e = new Event(type, { bubbles: true, cancelable: true });
            const t = [{ clientX: cx, clientY: y as number, identifier: 1, target }];
            Object.defineProperty(e, 'touches', { value: type === 'touchstart' ? t : [] });
            Object.defineProperty(e, 'changedTouches', { value: t });
            target.dispatchEvent(e);
          };
          fire('touchstart', x as number);
          fire('touchcancel', (x as number) - 120);
          fire('touchend', (x as number) - 120);
        },
        [at.x, at.y] as const,
      );
      await sleep(350);
      expect(await P.y(host), 'a cancelled touch does not turn').toBe(y0);
      await swipe(host, at, -120, 6, 150, 2);
      await sleep(350);
      expect(await P.y(host), 'a swipe with two fingers does not turn').toBe(y0);
      await swipe(host, at, -120, 6, 150);
      const fwd = await settle(host);
      expect(fwd).toBeGreaterThan(0);
      await swipe(host, at, 120, -6, 150);
      expect(await settle(host)).toBeLessThan(fwd);
    } finally {
      await host.close();
    }
  }, 240_000);

  it('T10c (default layout): a swipe that starts in a wide table never turns', async () => {
    const host = await open(browser, WIDE);
    try {
      await screens(host);
      const { w, h } = await viewport(host);
      await scrollToEl(host, 'tbody tr:nth-child(3)', h * 0.5);
      await sleep(200);
      const inTable = { x: w * 0.5, y: ((await centre(host, 'tbody tr:nth-child(3)')) as { y: number }).y };
      const y1 = await P.y(host);
      await swipe(host, inTable, -140, 4, 150);
      await sleep(400);
      expect(await P.y(host), 'a swipe from inside a wide table does not turn').toBe(y1);
      // the same swipe from the paragraphs above the table turns
      await probe(host, 'scrollTo', 0);
      await sleep(150);
      await swipe(host, { x: w * 0.5, y: h * 0.2 }, -140, 4, 150);
      expect(await settle(host)).toBeGreaterThan(0);
    } finally {
      await host.close();
    }
  }, 240_000);

  it('T10d (default layout): a swipe from inside a box that does not scroll sideways turns: one px over, overflow hidden, and a scrolling parent outside the root', async () => {
    const host = await open(browser, LINES);
    try {
      await host.frame().evaluate(() => {
        const root = document.querySelector('[data-docreader-root]') as HTMLElement;
        const at = root.querySelector('p:nth-of-type(8)');
        const box = (cls: string, overflow: string, inner: number): void => {
          const el = document.createElement('div');
          el.className = cls;
          el.style.cssText = `width: 300px; overflow-x: ${overflow};`;
          const x = document.createElement('div');
          x.className = 'in';
          x.style.cssText = `width: ${String(inner)}px; height: 24px;`;
          x.textContent = 'inside';
          el.append(x);
          root.insertBefore(el, at);
        };
        box('test-edge', 'auto', 301); // scrollWidth is one px over clientWidth: rounding, not a box to scroll
        box('test-clip', 'hidden', 900); // wider inside, but nothing to scroll
        box('test-plain', 'auto', 200); // control: fits
        const outside = root.parentElement as HTMLElement;
        outside.style.overflowX = 'auto'; // a parent of the root that scrolls sideways is not a box of the text
        const wide = document.createElement('div');
        wide.style.cssText = 'width: 3000px; height: 1px;';
        outside.append(wide);
      });
      await screens(host);
      const { h } = await viewport(host);
      for (const name of ['test-edge', 'test-clip', 'test-plain']) {
        await scrollToEl(host, `.${name}`, h * 0.4);
        await sleep(200);
        const at = (await centre(host, `.${name}`)) as { x: number; y: number }; // inside the 300 px box, where `.in` may be wider
        const y1 = await P.y(host);
        await swipe(host, at, -140, 4, 150);
        expect(await settle(host), `a swipe from inside .${name} turns`).toBeGreaterThan(y1);
      }
    } finally {
      await host.close();
    }
  }, 240_000);

  if (browser === 'chromium') {
    it('T10b (default layout, real touch on Chromium): a touch swipe on text turns, and one on a wide table scrolls the table and does not turn', async () => {
      const host = await open(browser, WIDE);
      try {
        await screens(host);
        const { w, h } = await viewport(host);
        const o = await frameBox(host);
        const cdp = await host.page.context().newCDPSession(host.page);
        await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
        const drag = async (x: number, y: number, dx: number, steps = 8): Promise<void> => {
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: o.x + x, y: o.y + y }] });
          for (let i = 1; i <= steps; i += 1) {
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: o.x + x + (dx * i) / steps, y: o.y + y }] });
            await sleep(12);
          }
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        };
        await drag(w * 0.7, h * 0.5, -160);
        expect(await settle(host)).toBeGreaterThan(0);
        // the wide table
        await scrollToEl(host, 'tbody tr:nth-child(3)', h * 0.5);
        await sleep(200);
        const y1 = await P.y(host);
        const at = (await centre(host, 'tbody tr:nth-child(3)')) as { x: number; y: number };
        const left0 = await host.frame().evaluate(() => (document.querySelector('.table-wrapper') as HTMLElement).scrollLeft);
        await drag(w * 0.7, at.y, -200);
        await sleep(500);
        const left1 = await host.frame().evaluate(() => (document.querySelector('.table-wrapper') as HTMLElement).scrollLeft);
        expect(left1, 'the table scrolled sideways').toBeGreaterThan(left0);
        expect(await P.y(host), 'the swipe did not turn').toBe(y1);
      } finally {
        await host.close();
      }
    }, 240_000);
  }

  for (const reduce of ['no-preference', 'reduce'] as const) {
    it(`T11 (default layout, motion ${reduce}): a turn is one instant jump, even where the page asks for smooth scrolling`, async () => {
      const host = await open(browser, LINES);
      try {
        await host.page.emulateMedia({ reducedMotion: reduce });
        await screens(host);
        await host.frame().evaluate(() => {
          document.documentElement.style.scrollBehavior = 'smooth';
          const seen: number[] = [];
          (window as unknown as { __seen: number[] }).__seen = seen;
          addEventListener('scroll', () => seen.push(scrollY));
        });
        await press(host, 'ArrowRight');
        await sleep(900);
        const seen = await host.frame().evaluate(() => (window as unknown as { __seen: number[] }).__seen);
        expect(seen.length).toBeGreaterThan(0);
        expect(new Set(seen).size, `one position: ${JSON.stringify(seen)}`).toBe(1);
        expect(seen[0]).toBeGreaterThan(300);
        // and a back turn
        await press(host, 'ArrowLeft');
        await sleep(900);
        const all = await host.frame().evaluate(() => (window as unknown as { __seen: number[] }).__seen);
        expect(new Set(all).size).toBeLessThanOrEqual(2);
      } finally {
        await host.close();
      }
    }, 240_000);
  }

  it('T12 (default layout): a resize and a width change keep the place and land on a whole line, even where the page does not anchor its scroll itself', async () => {
    const host = await open(browser, LINES);
    try {
      await host.frame().evaluate(() => {
        document.documentElement.style.overflowAnchor = 'none'; // so that only the library keeps the place (WebKit has no scroll anchoring)
        document.body.style.overflowAnchor = 'none';
      });
      await screens(host);
      for (let k = 0; k < 3; k += 1) await turn(host, 'ArrowRight');
      // the reader scrolls on by hand (a wheel, a drag): the place to keep is where the scroll stopped, not where the last turn ended
      await host.frame().evaluate(() => {
        scrollBy(0, 1337);
      });
      await sleep(500);
      const word = await probe<string>(host, 'topWord');
      expect(word).toMatch(/^P\d+$/);
      await host.setPrefs({ width: 'wide' });
      await sleep(900);
      expect(await probe<string>(host, 'topWord'), 'after a width change').toBe(word);
      expect(await probe<unknown[]>(host, 'cut', 0)).toEqual([]);
      await host.setPrefs({ font: 'sans' });
      await sleep(900);
      expect(await probe<string>(host, 'topWord'), 'after a face change').toBe(word);
      expect(await probe<unknown[]>(host, 'cut', 0)).toEqual([]);
      await host.page.setViewportSize({ width: 420, height: 844 });
      await sleep(900);
      expect(await probe<string>(host, 'topWord'), 'after a resize').toBe(word);
      expect(await probe<unknown[]>(host, 'cut', 0)).toEqual([]);
      // the next turn still goes forward from there
      const t = await turn(host, 'ArrowRight');
      expect(t.after).toBeGreaterThan(t.before);
    } finally {
      await host.close();
    }
  }, 240_000);

  it('T12b (default layout): a change of text size keeps the place in screens mode: the first line shown stays the first line shown, whole', async () => {
    const host = await open(browser, LINES);
    try {
      await host.frame().evaluate(() => {
        document.documentElement.style.overflowAnchor = 'none'; // so that only the library keeps the place
        document.body.style.overflowAnchor = 'none';
      });
      await screens(host);
      for (let k = 0; k < 2; k += 1) await turn(host, 'ArrowRight');
      // a paragraph's first line at the top: the first line shown starts with its marker, whatever the size wraps it to
      await host.frame().evaluate(() => {
        const ps = Array.from(document.querySelectorAll('[data-docreader-root] p')).filter((p) => /^P\d+ /.test(p.textContent ?? ''));
        const next = ps.find((p) => p.getBoundingClientRect().top > 300) as HTMLElement;
        scrollTo({ top: next.getBoundingClientRect().top + scrollY, behavior: 'instant' });
      });
      await sleep(500);
      const word = await probe<string>(host, 'topWord');
      expect(word).toMatch(/^P\d+$/);
      const firstLine = (): Promise<{ top: number; lh: number } | null> =>
        host.frame().evaluate((w) => {
          const p = Array.from(document.querySelectorAll('[data-docreader-root] p')).find((e) => (e.textContent ?? '').startsWith(`${w} `));
          if (p === undefined || p.firstChild === null) return null;
          const range = document.createRange();
          range.setStart(p.firstChild, 0);
          range.setEnd(p.firstChild, w.length);
          return { top: range.getBoundingClientRect().top, lh: parseFloat(getComputedStyle(p).lineHeight) };
        }, word);
      const before = await firstLine();
      expect(before?.top, 'the marker starts the first line shown').toBeGreaterThanOrEqual(-1);
      expect(before?.top).toBeLessThan((before?.lh ?? 0) * 0.9);
      const heights: number[] = [];
      for (const size of ['xl', 's', 'l', 'm'] as const) {
        await chooseSize(host, size);
        await sleep(900);
        heights.push(await host.frame().evaluate(() => parseFloat(getComputedStyle(document.querySelector('[data-docreader-root]') as Element).fontSize)));
        expect(await probe<string>(host, 'topWord'), `after size ${size}`).toBe(word);
        const now = await firstLine();
        expect(now?.top, `after size ${size}: the marker still starts the first line shown`).toBeGreaterThanOrEqual(-1);
        expect(now?.top, `after size ${size}: and that line is the first one`).toBeLessThan((now?.lh ?? 0) * 0.9);
        expect(await probe<unknown[]>(host, 'cut', 0), `after size ${size}: no line is cut at the top`).toEqual([]);
      }
      expect(heights, 'the sizes did take effect').toEqual([22, 16, 20, 18]);
      // the next turn still goes forward from there
      const t = await turn(host, 'ArrowRight');
      expect(t.after).toBeGreaterThan(t.before);
    } finally {
      await host.close();
    }
  }, 240_000);

  it('T14p (default layout): the text size is a screen control: in print media every size prints at the 11 pt baseline with the rem parts unscaled', async () => {
    const host = await open(browser, LINES);
    try {
      const read = (): Promise<{ print: boolean; body: number; h2: number; measure: number }> =>
        host.frame().evaluate(() => {
          const root = document.querySelector('[data-docreader-root]') as HTMLElement;
          return {
            print: matchMedia('print').matches,
            body: parseFloat(getComputedStyle(root).fontSize),
            h2: parseFloat(getComputedStyle(root.querySelector('h2, h1') as Element).fontSize),
            measure: (root.querySelector(':scope > p') as HTMLElement).getBoundingClientRect().width,
          };
        });
      await host.page.setViewportSize({ width: 1400, height: 900 });
      const screenXl = await (async () => {
        await chooseSize(host, 'xl');
        await sleep(400);
        return read();
      })();
      expect([screenXl.print, screenXl.body], 'on screen xl is 22 px').toEqual([false, 22]);
      await host.page.emulateMedia({ media: 'print' });
      await sleep(400);
      let base: { body: number; h2: number; measure: number } | null = null;
      for (const size of ['m', 's', 'l', 'xl'] as const) {
        await chooseSize(host, size);
        await sleep(400);
        const r = await read();
        expect(r.print, 'the frame is in print media').toBe(true);
        expect(r.body, `print, size ${size}: 11 pt`).toBeCloseTo(11 * (96 / 72), 3);
        base ??= r;
        expect(r.h2, `print, size ${size}: the rem parts are not scaled`).toBeCloseTo(base.h2, 3);
        expect(r.measure, `print, size ${size}: the column is not scaled`).toBeCloseTo(base.measure, 1);
      }
    } finally {
      await host.page.emulateMedia({ media: null }).catch(() => undefined);
      await host.close();
    }
  }, 240_000);

  it('T14 (default layout): the sizes s, m, l and xl are 16, 18, 20 and 22 px of body text; absent reads m; the rem parts and the column follow', async () => {
    const host = await open(browser, LINES);
    try {
      const read = (): Promise<{ body: number; h2: number; measure: number; size: string | null; checked: string[] }> =>
        host.frame().evaluate(() => {
          const root = document.querySelector('[data-docreader-root]') as HTMLElement;
          const col = root.querySelector(':scope > p') as HTMLElement;
          return {
            body: parseFloat(getComputedStyle(root).fontSize),
            h2: parseFloat(getComputedStyle(root.querySelector('h2, h1') as Element).fontSize),
            measure: col.getBoundingClientRect().width,
            size: root.getAttribute('data-size'),
            checked: Array.from(root.querySelectorAll<HTMLInputElement>('input[data-pref="size"]')).filter((i) => i.checked).map((i) => i.value),
          };
        });
      await host.page.setViewportSize({ width: 1400, height: 900 });
      await sleep(400);
      const m = await read();
      expect(m.body, 'absent reads m: 18 px').toBe(18);
      expect([m.size, m.checked], 'absent reads m').toEqual([null, ['m']]);
      for (const [size, px] of [['s', 16], ['l', 20], ['xl', 22], ['m', 18]] as const) {
        await chooseSize(host, size);
        await sleep(500);
        const r = await read();
        expect(r.body, `size ${size}`).toBe(px);
        expect(r.checked).toEqual([size]);
        expect(r.size).toBe(size === 'm' ? null : size);
        expect(r.h2 / m.h2, `size ${size}: the headings (rem parts) follow`).toBeCloseTo(px / 18, 2);
        expect(r.measure / m.measure, `size ${size}: the column follows`).toBeCloseTo(px / 18, 2);
      }
      // the sans face (its own 17.5 px at m) and a phone view (its own 17 px at m) take the same four sizes
      await host.setPrefs({ font: 'sans' });
      await sleep(500);
      expect((await read()).body, 'sans at m keeps its own size').toBe(17.5);
      for (const [size, px] of [['s', 16], ['l', 20], ['xl', 22]] as const) {
        await chooseSize(host, size);
        await sleep(400);
        expect((await read()).body, `sans, size ${size}`).toBe(px);
      }
      await host.setPrefs({ font: 'serif' });
      await host.page.setViewportSize({ width: 390, height: 844 });
      await sleep(600);
      for (const [size, px] of [['xl', 22], ['s', 16], ['m', 17]] as const) {
        await chooseSize(host, size);
        await sleep(400);
        expect((await read()).body, `phone, size ${size}`).toBe(px);
      }
    } finally {
      await host.close();
    }
  }, 240_000);

  it('T13 (default layout): scroll mode and off turn nothing: no band, no key taken, taps and swipes do nothing', async () => {
    const host = await open(browser, LINES);
    try {
      await host.frame().evaluate(() => {
        const log: Record<string, boolean> = {};
        (window as unknown as { __prevented: Record<string, boolean> }).__prevented = log;
        addEventListener('keydown', (e) => {
          log[e.key === ' ' ? 'Space' : e.key] = e.defaultPrevented;
        });
      });
      const { w, h } = await viewport(host);
      for (const mode of ['off', 'scroll'] as const) {
        if (mode === 'scroll') await screens(host, 'scroll');
        await probe(host, 'scrollTo', 400);
        await sleep(150);
        for (const key of ['ArrowRight', 'PageDown', 'Space', 'ArrowLeft']) {
          await press(host, key);
          await sleep(250);
          await probe(host, 'scrollTo', 400);
        }
        const log = await host.frame().evaluate(() => (window as unknown as { __prevented: Record<string, boolean> }).__prevented);
        expect(log, `${mode}: no key was taken`).toEqual({ ArrowRight: false, PageDown: false, Space: false, ArrowLeft: false });
        await probe(host, 'scrollTo', 400);
        await sleep(150);
        await tap(host, w * 0.6, h * 0.5);
        await tap(host, w * 0.15, h * 0.5);
        await swipe(host, { x: w * 0.5, y: h * 0.5 }, -150, 0, 120);
        await sleep(400);
        expect(await P.y(host), `${mode}: taps and swipes do nothing`).toBe(400);
        expect((await probe<{ shown: boolean }>(host, 'band')).shown).toBe(false);
      }
      // and in screens mode the same key is taken
      await screens(host);
      await probe(host, 'scrollTo', 400);
      await sleep(150);
      await press(host, 'ArrowRight');
      await sleep(250);
      expect((await host.frame().evaluate(() => (window as unknown as { __prevented: Record<string, boolean> }).__prevented))['ArrowRight']).toBe(true);
    } finally {
      await host.close();
    }
  }, 240_000);
});
