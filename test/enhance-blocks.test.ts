// @vitest-environment jsdom
// Tables and code blocks (docserver L2, Task 10; the reference layout, sections 8 and 9): bullet cells, the filter on a
// table of 12 rows or more, the measured table widths (`fits`, `--thead-h`, the region), the Copy buttons, and the code
// widths (`long`, the region). jsdom has no layout, so the measures read stubbed sizes here (the root's client width
// and padding, a table's widths, a canvas whose character is a set width); test/browser/blocks.test.ts measures them
// in real browsers. The numbers the code widths are reckoned with are the stylesheet's: this file reads them from
// assets/reader.css (the column's rem for each width and face, the rem, the wide width, the code's face and size, the
// phone's query) and holds the widths to them, so the code and the stylesheet cannot drift apart unseen.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { destroyEnhancement, enhance, type EnhanceOptions } from '../src/enhance/index.js';
import { CHROME_ATTR } from '../src/enhance/journal.js';
import { contextOf } from '../src/enhance/lifecycle.js';
import type { TableBlock } from '../src/enhance/registry.js';
import type { FeatureContext, Prefs } from '../src/enhance/types.js';
import { render } from '../src/render/index.js';

const CSS = readFileSync(path.join(process.cwd(), 'assets', 'reader.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** The declarations of the rules whose selector, with the root's scope taken off its front, is exactly `selector`. */
function declared(selector: string): string {
  const out: string[] = [];
  for (const m of CSS.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sel = (m[1] ?? '').split(',').map((s) => s.trim().replace(/^\[data-docreader-root\]/, '').trim());
    if (sel.includes(selector)) out.push(m[2] ?? '');
  }
  return out.join(';');
}

/** One number a declaration holds: `<name>: <pattern>` in the rules of `selector`, its first group. */
function number(selector: string, name: string, pattern: string): number {
  const m = new RegExp(`${name}:\\s*${pattern}`).exec(declared(selector));
  if (m === null) throw new Error(`reader.css: no ${name} in ${JSON.stringify(selector)}`);
  return Number(m[1]);
}

const CALC_REM = 'calc\\(([\\d.]+) \\* var\\(--rem\\)\\)';

/** What the stylesheet says, read once. */
const SHEET = {
  /** The layout's rem, in px. */
  rem: number('', '--rem', '(\\d+)px'),
  /** The reading column, in rem, by face and width. */
  measure: {
    serif: { standard: number('', '--measure', CALC_REM), wide: number('[data-width="wide"]', '--measure', CALC_REM) },
    sans: { standard: number('[data-font="sans"]', '--measure', CALC_REM), wide: number('[data-font="sans"][data-width="wide"]', '--measure', CALC_REM) },
  },
  /** The wide width, in px, by width. */
  wide: { standard: number('', '--wide', '(\\d+)px'), wide: number('[data-width="wide"]', '--wide', '(\\d+)px') },
  /** The code's faces. */
  mono: (/--mono:\s*([^;]+);/.exec(declared('')) ?? [])[1] ?? '',
  /** The code's size, in rem. */
  codeRem: number('.codehilite pre', 'font-size', CALC_REM),
  /** The phone: the query under which the gutter is 16px (and the tables stack). */
  phone: Number((/@media \(max-width: (\d+)px\) \{(?:[^{}]*\{[^{}]*\})*?[^{}]*\{[^{}]*--pad: 16px/.exec(CSS) ?? [])[1] ?? Number.NaN),
} as const;

const roots: HTMLElement[] = [];

function mount(md: string): HTMLElement {
  const root = document.createElement('div');
  root.innerHTML = render(md).html; // test fixture: render()'s own safe markup
  document.body.append(root);
  roots.push(root);
  return root;
}

const realInnerWidth = window.innerWidth;

// jsdom has no canvas: a context of none, quietly (a case that measures stubs its own, through room()).
beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() => null) as never);
});

afterEach(async () => {
  for (const r of roots.splice(0)) {
    await destroyEnhancement(r).catch(() => undefined);
    r.remove();
  }
  vi.restoreAllMocks();
  vi.useRealTimers();
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: realInnerWidth });
});

function ctxOf(root: HTMLElement): FeatureContext {
  const ctx = contextOf(root);
  if (ctx === undefined) throw new Error('no context: the root is not enhanced');
  return ctx;
}

/** Let queued promise reactions run. */
async function flush(): Promise<void> {
  for (let i = 0; i < 10; i += 1) await Promise.resolve();
}

const wait = (ms: number): Promise<void> =>
  new Promise((r) => {
    setTimeout(r, ms);
  });

/** Two frames and a little: what a relayout requested now has run by. */
const frames = (): Promise<void> => wait(60);

function all(root: Element, selector: string): HTMLElement[] {
  return Array.from(root.querySelectorAll(selector));
}

/** The body rows under `root`, in order. */
function rowsOf(root: Element): HTMLTableRowElement[] {
  return Array.from(root.querySelectorAll('tbody tr'));
}

function one(root: Element, selector: string): HTMLElement {
  const el = root.querySelector(selector);
  if (el === null) throw new Error(`nothing matches ${selector}`);
  return el as HTMLElement;
}

/** A shallow description of an element's children: each element as `tag.class…[hidden]` (`*` for chrome), each text as its JSON. */
function kids(el: Element): string[] {
  return Array.from(el.childNodes).map((n) => {
    if (n.nodeType === 3) return JSON.stringify((n as Text).data);
    const e = n as Element;
    const cls = Array.from(e.classList).map((c) => `.${c}`).join('');
    return `${e.localName}${cls}${e.hasAttribute('hidden') ? '[hidden]' : ''}${e.hasAttribute(CHROME_ATTR) ? '*' : ''}`;
  });
}

const viewport = (w: number): void => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: w });
};

describe('the stylesheet, as this file reads it', () => {
  it('has every number the code widths are held to', () => {
    expect(SHEET).toEqual({
      rem: 16,
      measure: { serif: { standard: 44, wide: 52 }, sans: { standard: 42, wide: 50 } },
      wide: { standard: 1120, wide: 1200 },
      mono: 'ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Consolas, "DejaVu Sans Mono", monospace',
      codeRem: 0.78,
      phone: 700,
    });
  });
});

// ── Bullet cells ────────────────────────────────────────────────────────────────────────────────────────────────

const BULLETS = [
  '# Example',
  '',
  '| Item | Notes |',
  '|---|---|',
  '| One | • first<br>• second |',
  '| Two | plain<br>lines |',
  '| Three | <br>after a break<br><br>and two<br> |',
  '| Four | - dash<br>-5 degrees<br>•tight |',
  '| Five | no break here |',
  '| Six | first<br>![](dot.png) |',
  '| Seven | · middle dot<br>▪ square<br>•\ttab |',
  '',
].join('\n');

describe('bullet cells', () => {
  it('a cell with breaks becomes its lines; a bullet line takes .b, its bullet hidden chrome; each <br> stays, hidden', async () => {
    const root = mount(BULLETS);
    await enhance(root);
    const cells = rowsOf(root).map((r) => r.cells[1] as HTMLTableCellElement);
    expect(kids(cells[0] as Element)).toEqual(['span.cell-line.b*', 'span.cell-line.b*']);
    const [a, b] = all(cells[0] as Element, '.cell-line');
    expect(kids(a as Element)).toEqual(['span.cell-bullet[hidden]*', '"first"', 'span.cell-br[hidden]*']);
    expect(one(a as Element, '.cell-bullet').textContent).toBe('• ');
    expect(kids(one(a as Element, '.cell-br'))).toEqual(['br']);
    expect(kids(b as Element)).toEqual(['span.cell-bullet[hidden]*', '"second"']);
    expect(one(b as Element, '.cell-bullet').textContent).toBe('\n• ');
    expect(cells[0]?.textContent).toBe('• first\n• second');
  });

  it('lines with no bullet take no .b; a <br> with nothing after it, or before, joins a line; only lines are children', async () => {
    const root = mount(BULLETS);
    await enhance(root);
    const cells = rowsOf(root).map((r) => r.cells[1] as HTMLTableCellElement);
    expect(kids(cells[1] as Element)).toEqual(['span.cell-line*', 'span.cell-line*']);
    expect(all(cells[1] as Element, '.cell-line').map((l) => l.textContent)).toEqual(['plain', '\nlines']);
    // "<br>after a break<br><br>and two<br>": the leading break joins the first line, the empty run and the last
    // breaks join the line before them.
    expect(kids(cells[2] as Element)).toEqual(['span.cell-line*', 'span.cell-line*']);
    const [first, second] = all(cells[2] as Element, '.cell-line');
    expect(kids(first as Element)).toEqual(['span.cell-br[hidden]*', '"\\nafter a break"', 'span.cell-br[hidden]*', '"\\n"', 'span.cell-br[hidden]*']);
    expect(kids(second as Element)).toEqual(['"\\nand two"', 'span.cell-br[hidden]*', '"\\n"']);
    // A run that holds an element with no text, and only white space besides, is a line.
    expect(all(cells[5] as Element, '.cell-line').map((l) => kids(l))).toEqual([['"first"', 'span.cell-br[hidden]*'], ['"\\n"', 'img']]);
  });

  it('a bullet is one of • · ▪ - with white space after it: "-5" and "•tight" keep their text', async () => {
    const root = mount(BULLETS);
    await enhance(root);
    const linesOf = (n: number): HTMLElement[] => all(rowsOf(root)[n]?.cells[1] as HTMLElement, '.cell-line');
    const bullets = (n: number): (string | null)[] => linesOf(n).map((l) => l.querySelector('.cell-bullet')?.textContent ?? null);
    expect(linesOf(3).map((l) => l.classList.contains('b'))).toEqual([true, false, false]);
    expect(bullets(3)).toEqual(['- ', null, null]);
    expect(linesOf(6).map((l) => l.classList.contains('b'))).toEqual([true, true, true]);
    expect(bullets(6)).toEqual(['· ', '\n▪ ', '\n•\t']);
  });

  it('a cell with no <br>, and a header cell with one, are left alone', async () => {
    const root = mount(`${BULLETS}\n| A<br>B | C |\n|---|---|\n| d | e |\n`);
    await enhance(root);
    const five = rowsOf(root)[4]?.cells[1] as HTMLTableCellElement;
    expect(kids(five)).toEqual(['"no break here"']);
    const th = all(root, 'thead th').find((c) => c.textContent?.startsWith('A')) as HTMLElement;
    expect(th.querySelector('.cell-line, .cell-br')).toBeNull();
  });

  it('a bullet that is its whole text node is hidden whole, with nothing split off', async () => {
    const root = mount('| Item | Notes |\n|---|---|\n| One | • `code` here<br>• `more` |\n');
    await enhance(root);
    const lines = all(root, '.cell-line');
    expect(lines.map((l) => kids(l)[0])).toEqual(['span.cell-bullet[hidden]*', 'span.cell-bullet[hidden]*']);
    expect(lines.map((l) => l.querySelector('.cell-bullet')?.textContent)).toEqual(['• ', '\n• ']);
    expect(lines.map((l) => l.classList.contains('b'))).toEqual([true, true]);
  });

  it('a cell of breaks and white space only gets no line, and its breaks are hidden', async () => {
    const root = mount('| Item | Notes |\n|---|---|\n| One | <br> <br> |\n');
    await enhance(root);
    const cell = one(root, 'tbody td:nth-child(2)');
    expect(cell.querySelector('.cell-line')).toBeNull();
    expect(kids(cell).filter((k) => k.startsWith('span'))).toEqual(['span.cell-br[hidden]*', 'span.cell-br[hidden]*']);
  });

  it('the status marks read the first line past its hidden bullet and breaks, as the reference read the stripped line', async () => {
    const root = mount('| Item | Status |\n|---|---|\n| A | • Agreed<br>• later |\n| B | Pending |\n| C | <br>Done |\n');
    await enhance(root);
    const pills = all(root, '.pill').map((p) => `${p.className}:${p.textContent ?? ''}`);
    expect(pills).toEqual(['pill ok:Agreed', 'pill wait:Pending', 'pill ok:Done']);
  });

  it('destroy puts every cell back byte for byte: the lines unwrapped, the bullets joined, the breaks unhidden', async () => {
    const root = mount(BULLETS);
    const before = root.innerHTML;
    await enhance(root);
    expect(root.querySelector('.cell-line')).not.toBeNull();
    await destroyEnhancement(root);
    expect(root.innerHTML).toBe(before);
  });
});

// ── The filter ─────────────────────────────────────────────────────────────────────────────────────────────────

/** A table of `n` body rows: "Row k" and "Item k" (k from 1), and a third column when `three`. */
function rowsTable(n: number, three = true): string {
  const head = three ? '| Row | Item | Note |\n|---|---|---|' : '| Row | Item |\n|---|---|';
  const body = Array.from({ length: n }, (_, i) => (three ? `| Row ${String(i + 1)} | Item ${String(i + 1)} | note |` : `| Row ${String(i + 1)} | Item ${String(i + 1)} |`));
  return [head, ...body, ''].join('\n');
}

function type(input: HTMLInputElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

describe('the filter', () => {
  it('a table of 12 rows or more gets one; one of 11 does not', async () => {
    const root = mount(`# Example\n\n${rowsTable(12)}\n${rowsTable(11)}`);
    await enhance(root);
    const wrappers = all(root, '.table-wrapper');
    expect(wrappers.map((w) => w.parentElement?.classList.contains('tbl-block'))).toEqual([true, false]);
    const tables = ctxOf(root).blocks.filter((b): b is TableBlock => b.kind === 'table');
    expect(tables.map((t) => t.filter !== null)).toEqual([true, false]);
    expect(tables[0]?.filter).toBe(one(root, '.tbl-tools input'));
  });

  it('the block holds the tools, then the table; the tools hold a live count, then a search field labelled with the count of rows', async () => {
    const root = mount(`# Example\n\n${rowsTable(13)}`);
    await enhance(root);
    const block = one(root, '.tbl-block');
    expect(kids(block)).toEqual(['div.tbl-tools*', 'div.table-wrapper.stack']);
    expect(block.classList.contains('cols-2')).toBe(false);
    const [count, input] = Array.from(one(block, '.tbl-tools').children) as HTMLElement[];
    expect([count?.localName, count?.getAttribute('aria-live'), count?.textContent]).toEqual(['span', 'polite', '']);
    expect(['type', 'placeholder', 'aria-label'].map((a) => input?.getAttribute(a))).toEqual(['search', 'Filter 13 rows', "Filter this table's 13 rows"]);
    expect([block, count, input].every((e) => e?.hasAttribute(CHROME_ATTR))).toBe(true);
  });

  it('a table of two columns gives its block cols-2', async () => {
    const root = mount(`# Example\n\n${rowsTable(12, false)}`);
    await enhance(root);
    expect(one(root, '.tbl-block').classList.contains('cols-2')).toBe(true);
  });

  it('what is typed, trimmed and in any case, hides the rows without it, and the count says how many show', async () => {
    const root = mount(`# Example\n\n${rowsTable(12)}`);
    await enhance(root);
    const input = one(root, '.tbl-tools input') as HTMLInputElement;
    const count = one(root, '.tbl-tools span');
    const rows = rowsOf(root);
    type(input, '  ITEM 1');
    expect(rows.map((r) => r.hasAttribute('hidden'))).toEqual([false, true, true, true, true, true, true, true, true, false, false, false]);
    expect(rows.filter((r) => r.hasAttribute('hidden')).every((r) => r.getAttribute('hidden') === '')).toBe(true);
    expect(count.textContent).toBe('4 of 12');
    type(input, 'nothing like it');
    expect(rows.every((r) => r.hasAttribute('hidden'))).toBe(true);
    expect(count.textContent).toBe('0 of 12');
    type(input, '   ');
    expect(rows.some((r) => r.hasAttribute('hidden'))).toBe(false);
    expect(count.textContent).toBe('');
  });

  it('it shows again only the rows it hid: a row hidden by someone else stays hidden', async () => {
    const root = mount(`# Example\n\n${rowsTable(12)}`);
    await enhance(root);
    const input = one(root, '.tbl-tools input') as HTMLInputElement;
    const rows = rowsOf(root);
    rows[2]?.setAttribute('hidden', '');
    type(input, 'Item 2');
    rows[5]?.setAttribute('hidden', 'until-found'); // a row it hid, which the host hides its own way since
    type(input, '');
    expect(rows.map((r) => r.getAttribute('hidden'))).toEqual([null, null, '', null, null, 'until-found', null, null, null, null, null, null]);
  });

  it('revealing an element of a row it hides clears it; one of a row it shows (or showed again) changes nothing', async () => {
    const root = mount(`# Example\n\n${rowsTable(12)}`);
    await enhance(root);
    const ctx = ctxOf(root);
    const input = one(root, '.tbl-tools input') as HTMLInputElement;
    const rows = rowsOf(root);
    type(input, 'Item 5');
    type(input, 'Item 3'); // the fifth row shows no more
    ctx.reveal(rows[2]?.cells[0] as Element);
    expect(input.value).toBe('Item 3');
    type(input, 'Item 5'); // and again, while the third, hidden a moment, shows again
    ctx.reveal(rows[4]?.cells[0] as Element);
    expect(input.value).toBe('Item 5');
    type(input, 'Item 3');
    type(input, 'Item 5');
    ctx.reveal(rows[2]?.cells[0] as Element);
    expect(input.value).toBe('');
    expect(rows.some((r) => r.hasAttribute('hidden'))).toBe(false);
    expect(one(root, '.tbl-tools span').textContent).toBe('');
  });

  it('destroy restores the table byte for byte, with rows hidden by the filter, and the field does nothing after', async () => {
    const root = mount(`# Example\n\n${rowsTable(14)}`);
    const before = root.innerHTML;
    await enhance(root);
    const input = one(root, '.tbl-tools input') as HTMLInputElement;
    type(input, 'Item 1');
    expect(all(root, 'tr[hidden]')).toHaveLength(8);
    await destroyEnhancement(root);
    expect(root.innerHTML).toBe(before);
    type(input, 'Item 2');
    expect(root.innerHTML).toBe(before);
  });
});

// ── Table measures ─────────────────────────────────────────────────────────────────────────────────────────────

/** Stub one table's sizes: the table's scroll width, its wrapper's client width and its head's height. */
function sizes(w: HTMLElement, s: { scroll: number; client: number; head: number }): void {
  const table = w.querySelector('table') as HTMLTableElement;
  Object.defineProperty(table, 'scrollWidth', { configurable: true, get: () => s.scroll });
  Object.defineProperty(w, 'clientWidth', { configurable: true, get: () => s.client });
  const head = table.tHead as HTMLElement;
  Object.defineProperty(head, 'offsetHeight', { configurable: true, get: () => s.head });
}

const TWO_TABLES = ['# Example', '', '| A | B | C |', '|---|---|---|', '| 1 | 2 | 3 |', '', '| D | E |', '|---|---|', '| 4 | 5 |', ''].join('\n');

describe('table measures', () => {
  it('fits, --thead-h and the region come from the sizes read; a table that fits again loses the region', async () => {
    viewport(1440);
    const root = mount(TWO_TABLES);
    const [three, two] = all(root, '.table-wrapper') as [HTMLElement, HTMLElement];
    sizes(three, { scroll: 900, client: 700, head: 41 });
    sizes(two, { scroll: 701, client: 700, head: 37.5 });
    await enhance(root);
    await frames();
    expect([three.classList.contains('fits'), two.classList.contains('fits')]).toEqual([false, true]);
    expect([three.style.getPropertyValue('--thead-h'), two.style.getPropertyValue('--thead-h')]).toEqual(['41px', '37.5px']);
    expect(['tabindex', 'role', 'aria-label'].map((a) => three.getAttribute(a))).toEqual(['0', 'region', 'Table 1, scrolls sideways: A, B, C']);
    expect(two.hasAttribute('role')).toBe(false);
    sizes(three, { scroll: 700, client: 700, head: 41 });
    ctxOf(root).relayout('content');
    await frames();
    expect(three.classList.contains('fits')).toBe(true);
    expect(['tabindex', 'role', 'aria-label'].map((a) => three.getAttribute(a))).toEqual([null, null, null]);
  });

  it('fits is dropped before the sizes are read, so the read sees the table without it', async () => {
    viewport(1440);
    const root = mount(TWO_TABLES);
    const three = one(root, '.table-wrapper');
    const table = one(three, 'table');
    const seen: boolean[] = [];
    Object.defineProperty(table, 'scrollWidth', {
      configurable: true,
      get: () => {
        seen.push(three.classList.contains('fits'));
        return 100;
      },
    });
    Object.defineProperty(three, 'clientWidth', { configurable: true, get: () => 700 });
    await enhance(root);
    await frames();
    ctxOf(root).relayout('content');
    await frames();
    expect(seen).toEqual([false, false]);
    expect(three.classList.contains('fits')).toBe(true);
  });

  it(`on a phone (${String(SHEET.phone)} px or less) a table that stacks into cards is no region, and one of two columns is`, async () => {
    const root = mount(TWO_TABLES);
    const [three, two] = all(root, '.table-wrapper') as [HTMLElement, HTMLElement];
    sizes(three, { scroll: 900, client: 700, head: 41 });
    sizes(two, { scroll: 900, client: 700, head: 41 });
    viewport(SHEET.phone);
    await enhance(root);
    await frames();
    expect([three.classList.contains('stack'), two.classList.contains('stack')]).toEqual([true, false]);
    expect([three.getAttribute('role'), two.getAttribute('role')]).toEqual([null, 'region']);
    viewport(SHEET.phone + 1);
    ctxOf(root).relayout('content');
    await frames();
    expect([three.getAttribute('role'), two.getAttribute('role')]).toEqual(['region', 'region']);
  });

  it('the label counts every table of the document and names the first three headers', async () => {
    viewport(1440);
    const root = mount(`# Example\n\n${TWO_TABLES}\n| P | Q | R | S |\n|---|---|---|---|\n| 1 | 2 | 3 | 4 |\n`);
    const wrappers = all(root, '.table-wrapper');
    for (const w of wrappers) sizes(w, { scroll: 900, client: 700, head: 40 });
    await enhance(root);
    await frames();
    expect(wrappers.map((w) => w.getAttribute('aria-label'))).toEqual([
      'Table 1, scrolls sideways: A, B, C',
      'Table 2, scrolls sideways: D, E',
      'Table 3, scrolls sideways: P, Q, R',
    ]);
  });

  it('a table with no head is labelled by its number alone, and its --thead-h is 0px', async () => {
    viewport(1440);
    const root = mount('# Example\n');
    const w = document.createElement('div');
    w.className = 'table-wrapper';
    const table = document.createElement('table');
    table.createTBody().insertRow().insertCell().append('cell');
    w.append(table);
    root.append(w);
    Object.defineProperty(table, 'scrollWidth', { configurable: true, get: () => 900 });
    Object.defineProperty(w, 'clientWidth', { configurable: true, get: () => 700 });
    await enhance(root);
    await frames();
    expect([w.getAttribute('aria-label'), w.style.getPropertyValue('--thead-h')]).toEqual(['Table 1, scrolls sideways', '0px']);
  });

  it("a role the host gave a wrapper that fits is the host's: it stays", async () => {
    viewport(1440);
    const root = mount(TWO_TABLES);
    const [three] = all(root, '.table-wrapper') as [HTMLElement];
    three.setAttribute('role', 'group');
    sizes(three, { scroll: 100, client: 700, head: 41 });
    await enhance(root);
    await frames();
    expect(three.getAttribute('role')).toBe('group');
  });

  it('destroy takes fits, --thead-h and the region away again', async () => {
    viewport(1440);
    const root = mount(TWO_TABLES);
    const before = root.innerHTML;
    const [three, two] = all(root, '.table-wrapper') as [HTMLElement, HTMLElement];
    sizes(three, { scroll: 900, client: 700, head: 41 });
    sizes(two, { scroll: 100, client: 700, head: 41 });
    await enhance(root);
    await frames();
    expect(three.getAttribute('role')).toBe('region');
    await destroyEnhancement(root);
    expect(root.innerHTML).toBe(before);
  });
});

// ── Copy ───────────────────────────────────────────────────────────────────────────────────────────────────────

const CODE_DOC = ['# Example', '', 'Text.', '', '```js', 'const a = 1;', 'const b = 2;', '```', ''].join('\n');

/** A code block of `n` lines. */
function lines(n: number): string {
  return ['```', ...Array.from({ length: n }, (_, i) => `line ${String(i + 1)}`), '```', ''].join('\n');
}

function copyOptions(copy: (text: string) => void | Promise<void>): EnhanceOptions {
  return { copy };
}

describe('Copy', () => {
  it('no copy given, no buttons, and no tall block', async () => {
    const root = mount(`${CODE_DOC}\n${lines(40)}`);
    await enhance(root);
    expect(root.querySelector('.code-copy')).toBeNull();
    expect(root.querySelector('.tall')).toBeNull();
  });

  it('with copy, one button first in each block, outside the code', async () => {
    const root = mount(`${CODE_DOC}\n${lines(3)}`);
    await enhance(root, copyOptions(() => undefined));
    expect(all(root, '.codehilite').map((b) => kids(b))).toEqual([
      ['button.code-copy*', 'pre'],
      ['button.code-copy*', 'pre'],
    ]);
    const b = one(root, '.code-copy');
    expect([b.getAttribute('type'), b.getAttribute('aria-label'), b.textContent]).toEqual(['button', 'Copy this code', 'Copy']);
  });

  it('a block of more than 36 line breaks has a second Copy at its foot and is tall; one of 36 is not', async () => {
    const root = mount(`${CODE_DOC}\n${lines(37)}\n${lines(36)}`);
    await enhance(root, copyOptions(() => undefined));
    const [, tall, short] = all(root, '.codehilite');
    expect(kids(tall as Element)).toEqual(['button.code-copy*', 'pre', 'button.code-copy.end*']);
    expect(tall?.classList.contains('tall')).toBe(true);
    const end = one(tall as Element, '.code-copy.end');
    expect([end.getAttribute('type'), end.getAttribute('aria-label'), end.textContent]).toEqual(['button', 'Copy this code (from its foot)', 'Copy']);
    expect(kids(short as Element)).toEqual(['button.code-copy*', 'pre']);
    expect(short?.classList.contains('tall')).toBe(false);
  });

  it("a click hands the code's text (the pre's textContent, read then) to copy; once it returns, Copied", async () => {
    const seen: string[] = [];
    const root = mount(CODE_DOC);
    await enhance(root, copyOptions((t) => void seen.push(t)));
    one(root, 'pre').append(document.createTextNode('// added'));
    const b = one(root, '.code-copy');
    b.click();
    await flush();
    expect(seen).toEqual(['const a = 1;\nconst b = 2;\n// added']);
    expect(b.textContent).toBe('Copied');
  });

  it('a copy that rejects, or throws, shows Failed; a fulfilled one Copied', async () => {
    const root = mount(`${CODE_DOC}\n${lines(2)}\n${lines(2)}`);
    let n = 0;
    await enhance(
      root,
      copyOptions(() => {
        n += 1;
        if (n === 1) return Promise.reject(new Error('refused'));
        if (n === 2) throw new Error('no clipboard');
        return Promise.resolve();
      }),
    );
    const [a, b, c] = all(root, '.code-copy');
    a?.click();
    b?.click();
    c?.click();
    await flush();
    expect([a, b, c].map((x) => x?.textContent)).toEqual(['Failed', 'Failed', 'Copied']);
  });

  it('the label reads Copy again 1400 ms later; a second click starts its time again', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const root = mount(CODE_DOC);
    await enhance(root, copyOptions(() => undefined));
    const b = one(root, '.code-copy');
    b.click();
    await flush();
    expect(b.textContent).toBe('Copied');
    await vi.advanceTimersByTimeAsync(1000);
    b.click();
    await flush();
    await vi.advanceTimersByTimeAsync(600);
    expect(b.textContent).toBe('Copied');
    await vi.advanceTimersByTimeAsync(799);
    expect(b.textContent).toBe('Copied');
    await vi.advanceTimersByTimeAsync(1);
    expect(b.textContent).toBe('Copy');
  });

  it('destroy clears the label timer', async () => {
    const root = mount(CODE_DOC);
    const set = vi.spyOn(window, 'setTimeout');
    const clear = vi.spyOn(window, 'clearTimeout');
    await enhance(root, copyOptions(() => undefined));
    one(root, '.code-copy').click();
    await flush();
    const at = set.mock.calls.findIndex(([, ms]) => ms === 1400);
    expect(at).toBeGreaterThanOrEqual(0);
    const id = set.mock.results[at]?.value as number;
    expect(clear.mock.calls.some(([x]) => x === id)).toBe(false);
    await destroyEnhancement(root);
    expect(clear.mock.calls.some(([x]) => x === id)).toBe(true);
  });

  it('a copy that settles after destroy writes nothing and starts no timer (RF5)', async () => {
    let settle: () => void = () => undefined;
    const root = mount(CODE_DOC);
    const set = vi.spyOn(window, 'setTimeout');
    await enhance(
      root,
      copyOptions(
        () =>
          new Promise<void>((r) => {
            settle = r;
          }),
      ),
    );
    const b = one(root, '.code-copy');
    b.click();
    await destroyEnhancement(root);
    settle();
    await flush();
    expect(b.textContent).toBe('Copy');
    expect(set.mock.calls.some(([, ms]) => ms === 1400)).toBe(false);
  });

  it('a click after destroy calls no copy', async () => {
    const copy = vi.fn();
    const root = mount(CODE_DOC);
    await enhance(root, copyOptions(copy));
    const b = one(root, '.code-copy');
    await destroyEnhancement(root);
    b.click();
    await flush();
    expect(copy).not.toHaveBeenCalled();
  });

  it('a code block in a figure gets no Copy, and destroy removes the buttons and the tall class', async () => {
    const root = mount(`${CODE_DOC}\n${lines(38)}\n\`\`\`mermaid\ngraph TD; A-->B\n\`\`\`\n\n*Figure 1. A diagram.*\n`);
    const before = root.innerHTML;
    await enhance(root, copyOptions(() => undefined));
    expect(all(root, '.code-copy')).toHaveLength(3);
    expect(root.querySelector('figure .code-copy')).toBeNull();
    await destroyEnhancement(root);
    expect(root.innerHTML).toBe(before);
  });
});

// ── Code widths ────────────────────────────────────────────────────────────────────────────────────────────────

/** What a line needs beyond its characters, in px (the reference's reckoning). */
const PAD = 42;

/** A line that needs `px` at 1 px a character. */
const need = (px: number): string => 'x'.repeat(px - PAD);

/** A document of one code block per text given (a text may hold several lines); `listed` ones in a list item. */
function codeDoc(blocks: readonly string[], listed: readonly boolean[] = []): string {
  const out = ['# Example', ''];
  blocks.forEach((b, i) => {
    if (listed[i] === true) out.push('- item', '', '  ```', ...b.split('\n').map((l) => `  ${l}`), '  ```', '');
    else out.push('```', b, '```', '');
  });
  return out.join('\n');
}

/** The width of one character on the stubbed canvas, read at each measure (a case changes it between relayouts). */
let charNow = 1;

/**
 * Stub the room: the viewport's width, the root's client width and padding, and a canvas whose character is `charW`
 * px (default 1; null: no canvas at all; NaN or 0: a canvas that measures nothing). Answers the fonts the canvas was
 * asked to measure in. The env keeps the context it got first, so a later call changes the width, not the canvas.
 */
function room(root: HTMLElement, s: { w: number; client: number; pad: number; charW?: number | null }): string[] {
  viewport(s.w);
  Object.defineProperty(root, 'clientWidth', { configurable: true, get: () => s.client });
  root.style.setProperty('padding', `0 ${String(s.pad)}px`);
  const fonts: string[] = [];
  const charW = s.charW === undefined ? 1 : s.charW;
  if (charW !== null) charNow = charW;
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() =>
    charW === null
      ? null
      : {
          font: '',
          measureText(this: { font: string }, t: string) {
            fonts.push(this.font);
            return { width: t.length * charNow };
          },
        }) as never);
  return fonts;
}

/** Each block: whether it is long, and whether its pre is a region. */
function widths(root: HTMLElement): [boolean, boolean][] {
  return all(root, '.codehilite').map((b) => [b.classList.contains('long'), one(b, 'pre').getAttribute('role') === 'region']);
}

async function relayout(root: HTMLElement): Promise<void> {
  ctxOf(root).relayout('content');
  await frames();
}

const DESKTOP = { w: 1440, client: 1440, pad: 40 } as const;

describe('code widths', () => {
  it("a block is long when it needs more than the stylesheet's column for the prefs: its rem times --rem", async () => {
    const faces: [Prefs['width'], Prefs['font']][] = [
      ['standard', 'serif'],
      ['wide', 'serif'],
      ['standard', 'sans'],
      ['wide', 'sans'],
    ];
    for (const [width, font] of faces) {
      const col = SHEET.measure[font][width] * SHEET.rem;
      const root = mount(codeDoc([need(col), need(col + 1)]));
      room(root, DESKTOP);
      await enhance(root, { prefs: { width, font } });
      await frames();
      expect({ width, font, long: widths(root).map(([l]) => l) }).toEqual({ width, font, long: [false, true] });
    }
  });

  it('the prefs move the column at once: wide makes a block of the standard column plus 1 fit', async () => {
    const col = SHEET.measure.serif.standard * SHEET.rem;
    const root = mount(codeDoc([need(col + 1)]));
    room(root, DESKTOP);
    await enhance(root);
    await frames();
    expect(widths(root)).toEqual([[true, false]]);
    ctxOf(root).setPrefs({ width: 'wide' });
    await frames();
    expect(widths(root)).toEqual([[false, false]]);
  });

  it("the column follows the root's --rem; one that is not a length in px above 0 is the stylesheet's", async () => {
    const root = mount(codeDoc([need(44 * 20), need(44 * 20 + 1)]));
    const fonts = room(root, DESKTOP);
    root.style.setProperty('--rem', '20px');
    await enhance(root);
    await frames();
    expect(widths(root).map(([l]) => l)).toEqual([false, true]);
    expect(fonts.at(-1)).toBe(`15.6px ${SHEET.mono}`);
    for (const rem of ['1.25rem', '0px', '-20px', 'large']) {
      root.style.setProperty('--rem', rem);
      await relayout(root);
      expect({ rem, long: widths(root).map(([l]) => l) }).toEqual({ rem, long: [true, true] });
      expect(fonts.at(-1)).toBe(`${String(SHEET.codeRem * SHEET.rem)}px ${SHEET.mono}`);
    }
  });

  it("the room is the root's content box: its client width less its padding, on either side", async () => {
    const root = mount(codeDoc([need(600), need(601), need(921)]));
    room(root, { w: 1440, client: 680, pad: 40 });
    await enhance(root);
    await frames();
    expect(widths(root)).toEqual([
      [false, false],
      [true, true],
      [true, true],
    ]);
    root.style.setProperty('padding', '0 40px 0 0');
    await relayout(root);
    expect(widths(root)[1]).toEqual([false, false]);
    root.style.setProperty('padding', '0 0 0 40px');
    await relayout(root);
    expect(widths(root)[1]).toEqual([false, false]);
  });

  it('a block in a list item has 48 px less room; a list item around the root is not one', async () => {
    const col = SHEET.measure.serif.standard * SHEET.rem;
    const root = mount(codeDoc([need(col - 48), need(col - 47), need(col - 47)], [true, true, false]));
    room(root, DESKTOP);
    await enhance(root);
    await frames();
    expect(widths(root).map(([l]) => l)).toEqual([false, true, false]);
    const li = document.createElement('li');
    document.body.append(li);
    const held = mount(codeDoc([need(col - 47)]));
    li.append(held);
    room(held, DESKTOP);
    await enhance(held);
    await frames();
    expect(widths(held).map(([l]) => l)).toEqual([false]);
    li.remove();
  });

  it("a long block scrolls when it needs more than the stylesheet's wide width, at most the room", async () => {
    const root = mount(codeDoc([need(SHEET.wide.standard), need(SHEET.wide.standard + 1), need(SHEET.wide.wide), need(SHEET.wide.wide + 1)]));
    room(root, DESKTOP);
    await enhance(root);
    await frames();
    expect(widths(root)).toEqual([
      [true, false],
      [true, true],
      [true, true],
      [true, true],
    ]);
    ctxOf(root).setPrefs({ width: 'wide' });
    await frames();
    expect(widths(root).map(([, r]) => r)).toEqual([false, false, false, true]);
    ctxOf(root).setPrefs({ width: 'standard' });
    Object.defineProperty(root, 'clientWidth', { configurable: true, get: () => 1080 });
    await frames();
    await relayout(root);
    expect(widths(root).map(([, r]) => r)).toEqual([true, true, true, true]); // 1000 px of room
  });

  it(`on a phone (${String(SHEET.phone)} px or less) a block scrolls when it needs more than the column, long or not`, async () => {
    const root = mount(codeDoc([need(SHEET.phone - 32), need(SHEET.phone - 31), need(800)]));
    room(root, { w: SHEET.phone, client: SHEET.phone, pad: 16 });
    await enhance(root);
    await frames();
    expect(widths(root)).toEqual([
      [false, false],
      [true, true],
      [true, true],
    ]);
    room(root, { ...DESKTOP, w: SHEET.phone });
    await relayout(root);
    expect(widths(root)[2]).toEqual([true, true]);
    room(root, { ...DESKTOP, w: SHEET.phone + 1 });
    await relayout(root);
    expect(widths(root)[2]).toEqual([true, false]);
  });

  it('the rail: has-toc with a --rail-w takes its width off the room from 1240 px of viewport, and not below', async () => {
    const root = mount(codeDoc([need(760), need(761), need(1121)]));
    room(root, { w: 1240, client: 1240, pad: 40 });
    root.classList.add('has-toc');
    root.style.setProperty('--rail-w', '400px');
    await enhance(root);
    await frames();
    expect(widths(root).map(([, r]) => r)).toEqual([false, true, true]);
    viewport(1239);
    await relayout(root);
    expect(widths(root).map(([, r]) => r)).toEqual([false, false, true]);
    viewport(1240);
    root.classList.remove('has-toc');
    await relayout(root);
    expect(widths(root).map(([, r]) => r)).toEqual([false, false, true]); // no has-toc: no rail
    root.classList.add('has-toc');
    root.style.removeProperty('--rail-w');
    await relayout(root);
    expect(widths(root).map(([, r]) => r)).toEqual([false, false, true]); // no --rail-w: no rail
    root.style.setProperty('--rail-w', '-1000px');
    Object.defineProperty(root, 'clientWidth', { configurable: true, get: () => 680 });
    await relayout(root);
    expect(widths(root).map(([, r]) => r)).toEqual([true, true, true]); // a negative rail gives no room: 600 px
  });

  it("a line is measured on the canvas in the stylesheet's code face and size, a tab counting 8 characters, its longest line counting", async () => {
    const col = SHEET.measure.serif.standard * SHEET.rem;
    const tabs82 = '\t'.repeat((col - PAD - 6) / 8); // 656 characters: 698 px at 1 px a character
    const root = mount(codeDoc([tabs82, `${tabs82}\t`, `short\n${need(col + 1)}\nshort`]));
    const fonts = room(root, DESKTOP);
    await enhance(root);
    await frames();
    expect(widths(root).map(([l]) => l)).toEqual([false, true, true]);
    expect(new Set(fonts)).toEqual(new Set([`${String(SHEET.codeRem * SHEET.rem)}px ${SHEET.mono}`]));
    charNow = 0.5; // the canvas now measures half as wide: nothing is long
    await relayout(root);
    expect(widths(root).map(([l]) => l)).toEqual([false, false, false]);
  });

  it('without a canvas, or with one that measures nothing, a character is 7.5 px', async () => {
    for (const charW of [null, Number.NaN, 0]) {
      const root = mount(codeDoc(['x'.repeat(88), 'x'.repeat(89)])); // 702 px and 709.5 px at 7.5
      room(root, { ...DESKTOP, charW });
      await enhance(root);
      await frames();
      expect({ charW, long: widths(root).map(([l]) => l) }).toEqual({ charW, long: [false, true] });
    }
  });

  it('the region is labelled with the number of the block among the code blocks, and the keyboard reaches it', async () => {
    const root = mount(codeDoc([need(100), need(1500), need(100), need(1500)]));
    room(root, DESKTOP);
    await enhance(root);
    await frames();
    expect(all(root, 'pre').map((p) => [p.getAttribute('tabindex'), p.getAttribute('role'), p.getAttribute('aria-label')])).toEqual([
      [null, null, null],
      ['0', 'region', 'Code block 2, scrolls sideways'],
      [null, null, null],
      ['0', 'region', 'Code block 4, scrolls sideways'],
    ]);
  });

  it('a resize measures again: the region comes and goes, and long with it', async () => {
    const root = mount(codeDoc([need(642), need(946)]));
    room(root, DESKTOP);
    await enhance(root);
    await frames();
    expect(widths(root)).toEqual([
      [false, false],
      [true, false],
    ]);
    room(root, { w: 390, client: 390, pad: 16 });
    window.dispatchEvent(new Event('resize'));
    await wait(250);
    expect(widths(root)).toEqual([
      [true, true],
      [true, true],
    ]);
    room(root, DESKTOP);
    window.dispatchEvent(new Event('resize'));
    await wait(250);
    expect(widths(root)).toEqual([
      [false, false],
      [true, false],
    ]);
    expect(all(root, 'pre').some((p) => p.hasAttribute('tabindex') || p.hasAttribute('aria-label'))).toBe(false);
  });

  it("a role the host gave a pre that fits is the host's: it stays", async () => {
    const root = mount(codeDoc([need(300)]));
    room(root, DESKTOP);
    one(root, 'pre').setAttribute('role', 'figure');
    await enhance(root);
    await frames();
    expect(one(root, 'pre').getAttribute('role')).toBe('figure');
  });

  it('a code block with no pre gets no Copy and no measure, and counts in the numbers of the others', async () => {
    const root = mount(codeDoc([need(1500)]));
    const bare = document.createElement('div');
    bare.className = 'codehilite';
    bare.append('no pre here');
    root.insertBefore(bare, one(root, '.codehilite'));
    room(root, DESKTOP);
    await enhance(root, copyOptions(() => undefined));
    await frames();
    expect(kids(bare)).toEqual(['"no pre here"']);
    expect(bare.classList.contains('long')).toBe(false);
    expect(all(root, '.code-copy')).toHaveLength(1);
    expect(one(root, 'pre').getAttribute('aria-label')).toBe('Code block 2, scrolls sideways');
  });

  it('destroy takes long and the region away again', async () => {
    const root = mount(codeDoc([need(946), need(1500)]));
    room(root, DESKTOP);
    const before = root.innerHTML;
    await enhance(root);
    await frames();
    expect(root.querySelector('.long')).not.toBeNull();
    expect(root.querySelector('pre[role]')).not.toBeNull();
    await destroyEnhancement(root);
    expect(root.innerHTML).toBe(before);
  });
});
