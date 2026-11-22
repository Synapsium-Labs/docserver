// Meaning without colour, and the hosted stylesheet's rules, in a real browser (docserver appearance plan, Task 6; the first
// consumer's design, section 10: test 10, and the rules of "Frame behaviour" that test 4 does not walk). The appearance is
// the collision one (conformance/appearance/collision.json): `chg`, `wait`, `violet`, `ok`, `info` and `no` are one
// colour, and `term`, `id`, `accent` and `text` another, so a cue that is only a colour tells nothing.
//
// Rows of test 10: the heading mark's words; the painted geometry, sampled from a screenshot's row of pixels through the
// middle of each mark (two 2px runs and a 2px gap for a changed mark, one 3px run for an attention mark, the changed
// block's outer run ending where 1.1.0's bar ends); the four status dots' computed shapes with every colour removed and
// the swatches' same shapes; `a.term` dotted, `a.xref` dashed and an ordinary link solid, kept on hover and while a card
// is open; the glossary term cell at 600; quick jump's selected row's inset bar; Aa's checked option; the summary box's
// pressed view button; the table filter's focus ring. Then the rules of the same design that nothing else walks: the
// derived colours each by its one rule, code on the well class by class, the chrome literals, the skin slots and the faces.
//
// The 1.1.0 comparison reads `git show v1.1.0:assets/reader.css` and serves it in place of the package's stylesheet over
// the same page; a checkout without the tag fails the rows, it never skips them.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
import type { Locator, Page } from 'playwright-core';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { closeBrowsers, describeBrowsers, openDoc, type BrowserName, type HarnessLayout, type OpenedDoc } from './harness.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const COLLISION = JSON.parse(readFileSync(path.join(ROOT, 'conformance', 'appearance', 'collision.json'), 'utf8')) as {
  mode: 'light' | 'dark';
  colour: Record<string, string>;
};
const FIXTURES = JSON.parse(readFileSync(path.join(ROOT, 'conformance', 'appearance', 'fixtures.json'), 'utf8')) as { name: string; mode: 'light' | 'dark'; colour: Record<string, string> }[];
const HUE = { mark: COLLISION.colour['chg'] as string, ref: COLLISION.colour['accent'] as string, focus: COLLISION.colour['focus'] as string };
/** An appearance with no colour group: hosted, in the library's own colours (every host colour removed). */
const NO_COLOUR = { mode: 'light' };

const TWELVE = Array.from({ length: 12 }, (_, i) => `| F${String(i + 1)} | Item ${String(i + 1)} | Note ${String(i + 1)} |`);
const DOC = [
  '# Cues',
  '',
  '**Spec** · 2026-11-20 · Status: Draft',
  '',
  '## In short',
  '',
  '- A summary of the document, in one line.',
  '',
  '## 1. Section',
  '',
  'A paragraph that carries the changed mark, long enough to be a block of its own and to wrap on a phone.',
  '',
  '- A list item that carries the changed mark',
  '- A second item with no mark at all',
  '',
  'A paragraph that stands for an attention rule, written long enough to wrap on a phone.',
  '',
  '| Item | Detail | Note |',
  '|---|---|---|',
  '| a | changed row | c |',
  '| d | attention row | f |',
  '| g | plain row | i |',
  '',
  '## 2. Words used here',
  '',
  '| Term | Meaning |',
  '|---|---|',
  '| Widget | A neutral thing |',
  '',
  'A [plain link](#1-section) and a Widget in a sentence.',
  '',
  '## 3. A long table',
  '',
  '| Row | Item | Note |',
  '|---|---|---|',
  ...TWELVE,
  '',
  'A highlighted block:',
  '',
  '```ts',
  'const x = 1;',
  '```',
  '',
  '## 4. Tasks',
  '',
  '### Task 1: Do it',
  '',
  '- [ ] **Step 1 (you): Pick a name** for it.',
  '- [ ] **Step 2: Go on** with it.',
  '',
  '## Where things stand',
  '',
  '### Agreed',
  '',
  '- D1: the first decision.',
  '',
  '### Waiting on you',
  '',
  '- D2: the second decision.',
  '',
  '### Later',
  '',
  '- D3: the third decision.',
  '',
].join('\n');

/** A mutant stylesheet (the mutation rows put a copy of the package's with one edit here, so the shared file is never touched). */
const MUTANT = process.env['DOCREADER_CUES_CSS'] === undefined ? undefined : readFileSync(process.env['DOCREADER_CUES_CSS'], 'utf8');
let v110 = '';
beforeAll(() => {
  try {
    v110 = execFileSync('git', ['show', 'v1.1.0:assets/reader.css'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  } catch (e) {
    throw new Error(`the v1.1.0 tag is not in this checkout (CI fetches full history with tags): ${String(e)}`);
  }
  expect(v110).toContain('[data-docreader-root]');
});
afterAll(closeBrowsers);

// ───────── screenshots, read as one row of pixels ─────────

type Png = { width: number; channels: number; raw: Buffer };

function decodePng(png: Buffer): Png {
  let at = 8;
  let width = 0;
  let channels = 0;
  const chunks: Buffer[] = [];
  while (at < png.length) {
    const size = png.readUInt32BE(at);
    const type = png.toString('ascii', at + 4, at + 8);
    const body = png.subarray(at + 8, at + 8 + size);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      channels = body[9] === 6 ? 4 : 3;
    }
    if (type === 'IDAT') chunks.push(body);
    at += 12 + size;
  }
  return { width, channels, raw: inflateSync(Buffer.concat(chunks)) };
}

/** The pixels of a one-row PNG: unfiltered (a filter on the first row can only name its left neighbour). */
function rowOf(png: Png): number[][] {
  const stride = png.width * png.channels;
  const filter = png.raw[0] ?? 0;
  const line = Buffer.from(png.raw.subarray(1, 1 + stride));
  if (filter === 1) for (let i = png.channels; i < stride; i += 1) line[i] = ((line[i] ?? 0) + (line[i - png.channels] ?? 0)) & 255;
  else if (filter === 3) for (let i = 0; i < stride; i += 1) line[i] = ((line[i] ?? 0) + Math.floor((i < png.channels ? 0 : (line[i - png.channels] ?? 0)) / 2)) & 255;
  else if (filter === 4) for (let i = 0; i < stride; i += 1) line[i] = ((line[i] ?? 0) + (i < png.channels ? 0 : (line[i - png.channels] ?? 0))) & 255;
  else if (filter !== 0 && filter !== 2) throw new Error(`unexpected PNG filter ${String(filter)}`);
  return Array.from({ length: png.width }, (_, x) => [line[x * png.channels] ?? 0, line[x * png.channels + 1] ?? 0, line[x * png.channels + 2] ?? 0]);
}

const rgb = (hex: string): number[] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/** A run of a mark's colour along the row: where its left edge is, relative to the element's, and how wide it is, in px. */
type Run = { edge: number; width: number };

/**
 * The runs of `colour` along one row of a screenshot. A pixel's coverage is how far it is from the row's first pixel (the
 * ground left of the mark) toward the mark's colour, so an edge that falls inside a pixel still counts by its part, and a
 * 4% tint (coverage 0.04) is no run. Runs are the stretches of pixels past 0.3; a width is the sum of their coverage.
 */
async function runsThrough(page: Page, target: Locator, colour: string, before = 40, after = 8): Promise<Run[]> {
  await target.evaluate((e) => e.scrollIntoView({ block: 'center', inline: 'nearest' }));
  await page.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))));
  const box = await target.boundingBox();
  if (box === null) throw new Error('the mark has no box');
  const left = Math.round(box.x);
  const y = Math.floor(box.y + box.height / 2);
  const shot = await page.screenshot({ clip: { x: left - before, y, width: before + after, height: 1 } });
  const px = rowOf(decodePng(shot));
  const ground = px[0] as number[];
  const want = rgb(colour).map((v, i) => v - (ground[i] as number));
  const norm = want.reduce((s, v) => s + v * v, 0);
  const cover = px.map((p) => Math.max(0, Math.min(1, p.reduce((s, v, i) => s + (v - (ground[i] as number)) * (want[i] as number), 0) / norm)));
  const runs: Run[] = [];
  let i = 0;
  while (i < cover.length) {
    if ((cover[i] as number) <= 0.3) {
      i += 1;
      continue;
    }
    let width = 0;
    let moment = 0;
    for (; i < cover.length && (cover[i] as number) > 0.3; i += 1) {
      width += cover[i] as number;
      moment += (cover[i] as number) * (i + 0.5);
    }
    runs.push({ edge: moment / width - width / 2 - before, width });
  }
  return runs;
}

const widths = (runs: Run[]): number[] => runs.map((r) => Math.round(r.width * 2) / 2);

/** The colour of the pixel `dx` px right of the element's (rounded) left edge, on the row through its middle. */
async function colourAt(page: Page, target: Locator, dx: number): Promise<number[]> {
  await target.evaluate((e) => e.scrollIntoView({ block: 'center', inline: 'nearest' }));
  await page.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))));
  const box = await target.boundingBox();
  if (box === null) throw new Error('the mark has no box');
  const shot = await page.screenshot({ clip: { x: Math.round(box.x) + dx, y: Math.floor(box.y + box.height / 2), width: 1, height: 1 } });
  return rowOf(decodePng(shot))[0] as number[];
}

// ───────── a page ─────────

type How = { appearance?: unknown; width?: number; stylesheet?: string; marks?: boolean; inShort?: boolean; layout?: HarnessLayout };

async function open(browser: BrowserName, how: How = {}): Promise<OpenedDoc> {
  const options: Record<string, unknown> = { folds: false, storageKey: 'cues' };
  if (how.appearance !== undefined) options['appearance'] = how.appearance;
  if (how.inShort === true) options['inShort'] = true;
  if (how.marks === true) options['storage'] = { snapshot: { 'docreader:doc:cues:marks': JSON.stringify({ '1-section': 'zz' }) } };
  return openDoc(DOC, options, {
    browser,
    csp: 'reader',
    viewport: { width: how.width ?? 1440, height: 900 },
    ...(how.layout === undefined ? {} : { layout: how.layout }),
    ...(how.stylesheet !== undefined ? { stylesheet: how.stylesheet } : MUTANT === undefined ? {} : { stylesheet: MUTANT }),
  });
}

const rootSel = 'main[data-harness-root]';

/** Put the marks the reader's own features put (by class, so a row measures the stylesheet): the document's blocks. */
async function mark(page: Page): Promise<void> {
  await page.evaluate((sel) => {
    const root = document.querySelector(sel) as HTMLElement;
    const paras = Array.from(root.querySelectorAll(':scope > p')).filter((p) => p.textContent?.startsWith('A paragraph'));
    paras[0]?.classList.add('chg');
    paras[1]?.classList.add('rule', 'attn');
    Array.from(root.querySelectorAll(':scope > ul > li')).find((li) => li.textContent?.startsWith('A list item'))?.classList.add('chg');
    const rows = root.querySelectorAll('.table-wrapper tbody tr');
    rows[0]?.classList.add('chg');
    rows[1]?.classList.add('attn');
    root.querySelector('li.task-list-item')?.classList.add('attn');
  }, rootSel);
}

async function controlRowRules(page: Page): Promise<{ sheet: string; selector: string; media: string }[]> {
  return page.evaluate(() => {
    const out: { sheet: string; selector: string; media: string }[] = [];
    const walk = (rules: CSSRuleList, media: string, sheet: string): void => {
      for (const rule of Array.from(rules)) {
        if (rule instanceof CSSMediaRule) walk(rule.cssRules, rule.conditionText, sheet);
        else if (rule instanceof CSSStyleRule && rule.style.getPropertyValue('min-height').includes('--dr-control-row')) {
          out.push({ sheet, selector: rule.selectorText, media });
        }
      }
    };
    for (const sheet of Array.from(document.styleSheets)) walk(sheet.cssRules, '', new URL(sheet.href ?? '', document.baseURI).pathname);
    return out;
  });
}

describeBrowsers((browser) => {
  // Only register alternate layouts for cues their own features draw.
  function sharedCue(name: string, check: (layout: HarnessLayout) => Promise<void>, layouts: readonly HarnessLayout[] = ['default', 'classic', 'editorial', 'review']): void {
    for (const layout of layouts) {
      it(layout === 'default' ? name : `${layout}: ${name}`, () => check(layout));
    }
  }

  it('a heading mark in the changed state reads "Changed since you read it"', async () => {
    const doc = await open(browser, { appearance: COLLISION, marks: true });
    try {
      const mk = doc.page.locator(`${rootSel} h2[id="1-section"] .h-mark`);
      expect(await mk.textContent()).toBe('Changed since you read it');
      expect(await mk.evaluate((e) => e.classList.contains('changed'))).toBe(true);
    } finally {
      await doc.close();
    }
  });

  it('painted geometry: a changed block, item and row (wide) paint two 2px runs and a 2px gap; an attention mark paints one 3px run', async () => {
    const doc = await open(browser, { appearance: COLLISION });
    try {
      await mark(doc.page);
      const at = (s: string): Locator => doc.page.locator(`${rootSel} ${s}`).first();
      const targets = {
        block: doc.page.locator(`${rootSel} > p.chg`).first(),
        item: at('li.chg'),
        row: at('tr.chg > td:first-child'),
      };
      for (const [name, el] of Object.entries(targets)) {
        const runs = await runsThrough(doc.page, el, HUE.mark, 40, name === 'item' ? 2 : 8);
        expect(widths(runs), `${name}: ${JSON.stringify(runs)}`).toEqual([2, 2]);
        expect(Math.abs((runs[1] as Run).edge - (runs[0] as Run).edge - 4), `${name}: the gap`).toBeLessThan(0.5);
      }
      const attention = {
        rule: at('p.rule.attn'),
        item: at('li.task-list-item.attn'),
        row: at('tr.attn > td:first-child'),
        waiting: at('.callout.waiting'),
      };
      for (const [name, el] of Object.entries(attention)) {
        const runs = await runsThrough(doc.page, el, HUE.mark);
        expect(widths(runs), `attention ${name}: ${JSON.stringify(runs)}`).toEqual([3]);
      }
    } finally {
      await doc.close();
    }
  });

  for (const layout of ['classic', 'editorial', 'review'] as const) {
    it(`${layout}: a real waiting callout has a painted 3px cue even when the status colours collide`, async () => {
      const doc = await open(browser, { appearance: COLLISION, layout });
      try {
        const waiting = doc.page.locator(`${rootSel}[data-docreader-layout="${layout}"] .callout.waiting`);
        expect(await waiting.count()).toBe(1);
        expect(await waiting.textContent()).toContain('Waiting on you');
        // A pending reveal must enter and finish before its painted cue is measured.
        await waiting.evaluate((e) => e.scrollIntoView({ block: 'center', inline: 'nearest' }));
        await expect.poll(() => waiting.evaluate((e) => {
          const style = getComputedStyle(e);
          const opacity = style.opacity;
          const transform = style.transform;
          return (!e.classList.contains('reveal') || e.classList.contains('in'))
            && opacity === '1' && transform === 'none'
            && e.getAnimations().every((animation) => animation.playState === 'finished' || animation.playState === 'idle');
        }), { timeout: 15_000 }).toBe(true);
        const runs = await runsThrough(doc.page, waiting, HUE.mark);
        expect(widths(runs), JSON.stringify(runs)).toEqual([3]);
      } finally {
        await doc.close();
      }
    });
  }

  it('painted geometry on a phone: a changed card paints two 2px runs, an attention card one 3px run', async () => {
    const doc = await open(browser, { appearance: COLLISION, width: 390 });
    try {
      await mark(doc.page);
      expect(await doc.page.locator(`${rootSel} .table-wrapper.stack`).count()).toBeGreaterThan(0);
      const changed = await runsThrough(doc.page, doc.page.locator(`${rootSel} .stack tr.chg`).first(), HUE.mark, 12, 8);
      expect(widths(changed), JSON.stringify(changed)).toEqual([2, 2]);
      expect(Math.abs((changed[1] as Run).edge - (changed[0] as Run).edge - 4)).toBeLessThan(0.5);
      const attn = await runsThrough(doc.page, doc.page.locator(`${rootSel} .stack tr.attn`).first(), HUE.mark, 12, 8);
      expect(widths(attn), JSON.stringify(attn)).toEqual([3]);
    } finally {
      await doc.close();
    }
  });

  it('the 2px gap of a changed block shows the ground it sits on: bg in the page, surface in the summary box, wait-soft in a waiting callout', async () => {
    const doc = await open(browser, { appearance: PHOSPHOR_COLOURS() });
    try {
      await doc.page.evaluate((sel) => {
        const root = document.querySelector(sel) as HTMLElement;
        for (const host of ['.short', '.callout.waiting']) {
          const p = document.createElement('p');
          p.className = 'chg';
          p.id = `gap-${host.replace(/\W/g, '')}`;
          p.textContent = 'A changed paragraph inside a box.';
          (root.querySelector(host) as HTMLElement).append(p);
        }
        for (const [cls, id] of [['gh-warning', 'gap-warning'], ['gh-caution', 'gap-caution']] as const) {
          const box = document.createElement('div');
          box.className = `gh-alert ${cls}`;
          const p = document.createElement('p');
          p.id = id;
          p.className = 'chg';
          p.textContent = 'A changed paragraph inside an alert.';
          box.append(p);
          root.append(box);
        }
        const page = document.createElement('p');
        page.id = 'gap-page';
        page.className = 'chg';
        page.textContent = 'A changed paragraph in the page.';
        root.append(page);
      }, rootSel);
      const c = PHOSPHOR_COLOURS().colour;
      const wantGap: Record<string, string> = {
        'gap-page': css(c['bg'] as string),
        'gap-short': css(c['surface'] as string),
        'gap-callout': mixed(c['wait'] as string, 4, c['bg'] as string),
        'gap-warning': mixed(c['wait'] as string, 4, c['bg'] as string),
        'gap-caution': mixed(c['no'] as string, 4, c['bg'] as string),
      };
      for (const [id, want] of Object.entries(wantGap)) {
        const el = doc.page.locator(`#${id === 'gap-callout' ? 'gap-calloutwaiting' : id}`);
        const runs = await runsThrough(doc.page, el, c['chg'] as string, 16, 2);
        expect(widths(runs), id).toEqual([2, 2]);
        const gapX = Math.round(((runs[0] as Run).edge + (runs[1] as Run).edge) / 2 + 1);
        const px = await colourAt(doc.page, el, gapX);
        const have = `rgb(${px.join(', ')})`;
        if (want.startsWith('color-mix')) {
          const probe = await doc.page.evaluate((v) => {
            const i = document.createElement('i');
            document.body.append(i);
            i.style.color = v;
            const o = getComputedStyle(i).color;
            i.remove();
            return o;
          }, want);
          const [r, g, b] = (/^color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)\)$/.exec(probe) ?? []).slice(1).map((v) => Math.round(Number(v) * 255));
          expect(have, id).toBe(`rgb(${String(r)}, ${String(g)}, ${String(b)})`);
        } else expect(have, id).toBe(want);
      }
    } finally {
      await doc.close();
    }
  });

  it('the changed block\'s outer run ends at the same x as 1.1.0\'s bar for the same block, and 1.1.0 paints one 3px run', async () => {
    const mine = await open(browser, { appearance: COLLISION });
    const old = await open(browser, { appearance: COLLISION, stylesheet: v110 });
    try {
      for (const d of [mine, old]) await mark(d.page);
      const sel = `${rootSel} > p.chg`;
      const a = await runsThrough(mine.page, mine.page.locator(sel).first(), HUE.mark);
      const b = await runsThrough(old.page, old.page.locator(sel).first(), HUE.mark);
      expect(widths(b), '1.1.0: one 3px bar').toEqual([3]);
      expect(Math.abs((a[0] as Run).edge - (b[0] as Run).edge), `the outer edge: ${JSON.stringify([a, b])}`).toBeLessThan(0.5);
    } finally {
      await mine.close();
      await old.close();
    }
  });

  it('the four status dots have pairwise different shapes with every colour removed, and each swatch has its role\'s dot\'s shape', async () => {
    const doc = await open(browser, { appearance: NO_COLOUR });
    try {
      await doc.page.evaluate((sel) => {
        const root = document.querySelector(sel) as HTMLElement;
        const index = document.createElement('div');
        index.className = 'toc-index';
        for (const s of ['ok', 'wait', 'no', 'info']) {
          const a = document.createElement('a');
          a.className = 'ix';
          const dot = document.createElement('span');
          dot.className = `dot ${s}`;
          a.append(dot);
          index.append(a);
        }
        root.append(index);
      }, rootSel);
      await doc.page.locator(`${rootSel} .aa-btn`).click();
      const shapes = await doc.page.evaluate((sel) => {
        const shape = (e: Element): string => {
          const c = getComputedStyle(e);
          return [c.borderTopLeftRadius, c.borderTopWidth, c.width, c.height].join(' ');
        };
        const root = document.querySelector(sel) as HTMLElement;
        const out: Record<string, { dot: string; swatch: string }> = {};
        for (const s of ['ok', 'wait', 'no', 'info']) {
          out[s] = { dot: shape(root.querySelector(`.toc-index .dot.${s}`) as Element), swatch: shape(root.querySelector(`.ckey .sw.k-${s}`) as Element) };
        }
        return out;
      }, rootSel);
      const hollow = await doc.page.evaluate((sel) => [`${sel} .toc-index .dot.wait`, `${sel} .ckey .sw.k-wait`].map((s) => getComputedStyle(document.querySelector(s) as Element).backgroundColor), rootSel);
      expect(hollow, 'the wait ring is hollow').toEqual(['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0)']);
      expect(new Set(Object.values(shapes).map((s) => s.dot)).size, JSON.stringify(shapes)).toBe(4);
      for (const [role, s] of Object.entries(shapes)) expect(s.swatch, role).toBe(s.dot);
    } finally {
      await doc.close();
    }
  });

  it('a term is dotted, an id link dashed and an ordinary link solid, each underlined, on hover and while a card is open too', async () => {
    const doc = await open(browser, { appearance: COLLISION });
    try {
      await doc.page.evaluate((sel) => {
        const p = document.createElement('p');
        p.id = 'cue-links';
        for (const [cls, text] of [['term', 'Widget'], ['xref', 'R1'], ['', 'plain']] as const) {
          const a = document.createElement('a');
          a.href = '#cue';
          if (cls !== '') a.className = cls;
          a.id = `cue-${cls === '' ? 'plain' : cls}`;
          a.textContent = text;
          p.append(a, ' ');
        }
        (document.querySelector(sel) as HTMLElement).append(p);
      }, rootSel);
      const deco = (id: string): Promise<string> =>
        doc.page.locator(`#${id}`).evaluate((e) => {
          const c = getComputedStyle(e);
          return `${c.textDecorationLine} ${c.textDecorationStyle}`;
        });
      expect(await deco('cue-term')).toBe('underline dotted');
      expect(await deco('cue-xref')).toBe('underline dashed');
      expect(await deco('cue-plain')).toBe('underline solid');
      await doc.page.locator('#cue-term').hover();
      expect(await deco('cue-term'), 'term hovered').toBe('underline dotted');
      await doc.page.locator('#cue-xref').hover();
      expect(await deco('cue-xref'), 'xref hovered').toBe('underline dashed');
      await doc.page.mouse.move(0, 0);
      await doc.page.evaluate(() => {
        document.querySelector('#cue-term')?.setAttribute('aria-expanded', 'true');
        document.querySelector('#cue-xref')?.setAttribute('aria-expanded', 'true');
      });
      expect(await deco('cue-term'), 'term open').toBe('underline dotted');
      expect(await deco('cue-xref'), 'xref open').toBe('underline dashed');
    } finally {
      await doc.close();
    }
  });

  it('a glossary table\'s term cell is its row\'s first cell, at a computed weight of 600', async () => {
    const doc = await open(browser, { appearance: COLLISION });
    try {
      const got = await doc.page.evaluate((sel) => {
        const cell = document.querySelector(`${sel} td.termcell`) as HTMLTableCellElement;
        return { first: cell === (cell.parentElement as HTMLTableRowElement).cells[0], weight: getComputedStyle(cell).fontWeight, text: cell.textContent };
      }, rootSel);
      expect(got).toEqual({ first: true, weight: '600', text: 'Widget' });
    } finally {
      await doc.close();
    }
  });

  sharedCue('quick jump\'s selected row has an inset 2px accent bar, and an unselected row has none', async (layout) => {
    const doc = await open(browser, { appearance: COLLISION, layout });
    try {
      await doc.page.keyboard.press('/');
      await doc.page.locator(`${rootSel} .jump.open li`).first().waitFor();
      const got = await doc.page.evaluate((sel) => {
        const rows = Array.from(document.querySelectorAll(`${sel} .jump li`));
        const sel1 = rows.find((r) => r.classList.contains('sel')) as Element;
        const other = rows.find((r) => !r.classList.contains('sel')) as Element;
        return { sel: getComputedStyle(sel1).boxShadow, other: getComputedStyle(other).boxShadow };
      }, rootSel);
      expect(got.sel).toBe(`${css(HUE.ref)} 2px 0px 0px 0px inset`);
      expect(got.other).toBe('none');
    } finally {
      await doc.close();
    }
  });

  it('the Aa menu\'s checked option is at 600 with an inset 2px accent bar, and an unchecked one at 400 with none', async () => {
    const doc = await open(browser, { appearance: COLLISION });
    try {
      await doc.page.locator(`${rootSel} .aa-btn`).click();
      const got = await doc.page.evaluate((sel) => {
        const read = (e: Element): { weight: string; shadow: string } => ({ weight: getComputedStyle(e).fontWeight, shadow: getComputedStyle(e).boxShadow });
        const root = document.querySelector(sel) as HTMLElement;
        const checked = root.querySelector('.aa-menu input:checked + label') as Element;
        const unchecked = root.querySelector('.aa-menu input:not(:checked) + label') as Element;
        return { checked: read(checked), unchecked: read(unchecked), theme: root.querySelectorAll('input[data-pref="theme"]').length };
      }, rootSel);
      expect(got.theme, 'no theme row while hosted').toBe(0);
      expect(got.checked).toEqual({ weight: '600', shadow: `${css(HUE.ref)} 2px 0px 0px 0px inset` });
      expect(got.unchecked).toEqual({ weight: '400', shadow: 'none' });
    } finally {
      await doc.close();
    }
  });

  it('the summary box\'s pressed view button is at 600 with an inset bottom bar of 2px in accent, and the unpressed one neither', async () => {
    const doc = await open(browser, { appearance: COLLISION });
    try {
      const got = await doc.page.evaluate((sel) => {
        const short = document.querySelector(`${sel} .short`) as HTMLElement;
        const view = document.createElement('div');
        view.className = 'short-view';
        for (const [text, on] of [['Headlines', 'true'], ['Full', 'false']] as const) {
          const b = document.createElement('button');
          b.type = 'button';
          b.setAttribute('aria-pressed', on);
          b.textContent = text;
          view.append(b);
        }
        short.append(view);
        const read = (e: Element): { weight: string; shadow: string } => ({ weight: getComputedStyle(e).fontWeight, shadow: getComputedStyle(e).boxShadow });
        return { on: read(view.children[0] as Element), off: read(view.children[1] as Element) };
      }, rootSel);
      expect(got.on).toEqual({ weight: '600', shadow: `${css(HUE.ref)} 0px -2px 0px 0px inset` });
      expect(got.off).toEqual({ weight: '400', shadow: 'none' });
    } finally {
      await doc.close();
    }
  });

  sharedCue('the switch the reader draws has the same pressed button: at 600 with an inset bottom bar of 2px in accent, in Full and in Headlines, and the unpressed one neither', async (layout) => {
    const doc = await open(browser, { appearance: COLLISION, inShort: true, layout });
    try {
      const read = (): Promise<{ pressed: string; on: { weight: string; shadow: string }; off: { weight: string; shadow: string } }> =>
        doc.page.evaluate((sel) => {
          const style = (e: Element): { weight: string; shadow: string } => ({ weight: getComputedStyle(e).fontWeight, shadow: getComputedStyle(e).boxShadow });
          const buttons = Array.from(document.querySelectorAll(`${sel} .short-view button`));
          const on = buttons.find((b) => b.getAttribute('aria-pressed') === 'true') as Element;
          const off = buttons.find((b) => b.getAttribute('aria-pressed') === 'false') as Element;
          return { pressed: on.textContent ?? '', on: style(on), off: style(off) };
        }, rootSel);
      const bar = { weight: '600', shadow: `${css(HUE.ref)} 0px -2px 0px 0px inset` };
      const none = { weight: '400', shadow: 'none' };
      expect(await read()).toEqual({ pressed: 'Full', on: bar, off: none });
      await doc.page.evaluate((sel) => (document.querySelector(`${sel} .short-view button`) as HTMLElement).click(), rootSel);
      expect(await read()).toEqual({ pressed: 'Headlines', on: bar, off: none });
    } finally {
      await doc.close();
    }
  }, ['default', 'editorial', 'review']);

  sharedCue('the table filter, focused from the keyboard, has a 2px solid outline in focus, and none when blurred', async (layout) => {
    const doc = await open(browser, { appearance: COLLISION, layout });
    try {
      const input = doc.page.locator(`${rootSel} .tbl-tools input`).first();
      await input.focus();
      const on = await input.evaluate((e) => ({ vis: e.matches(':focus-visible'), w: getComputedStyle(e).outlineWidth, s: getComputedStyle(e).outlineStyle, c: getComputedStyle(e).outlineColor }));
      expect(on).toEqual({ vis: true, w: '2px', s: 'solid', c: css(HUE.focus) });
      await input.blur();
      expect(await input.evaluate((e) => getComputedStyle(e).outlineStyle)).toBe('none');
    } finally {
      await doc.close();
    }
  });

  // ───────── the rules of the same design that test 10 does not walk ─────────

  const PHOSPHOR = FIXTURES[0] as (typeof FIXTURES)[number];
  const DAYLIGHT = FIXTURES.find((f) => f.name === 'Phosphor Daylight') as (typeof FIXTURES)[number];
  const mix = (a: string, pct: number, b: string): string => `color-mix(in srgb, ${a} ${String(pct)}%, ${b})`;

  it('every derived colour is its one rule over the slots: a tint is 4% of its colour over its ground, never 6%, and inline code is opaque surface2', async () => {
    for (const fx of [PHOSPHOR, DAYLIGHT]) {
      const c = fx.colour;
      const expected: Record<string, string> = {
        '--accent-hover': mix(c['accent'] as string, 80, c['text'] as string),
        '--accent-soft': mix(c['accent'] as string, 4, c['bg'] as string),
        '--th-bg': mix(c['accent'] as string, 4, c['bg'] as string),
        '--wait-soft': mix(c['wait'] as string, 4, c['bg'] as string),
        '--wait-tint': mix(c['wait'] as string, 4, c['bg'] as string),
        '--no-tint': mix(c['no'] as string, 4, c['bg'] as string),
        '--chg-tint': mix(c['chg'] as string, 4, c['bg'] as string),
        '--chg-soft': mix(c['chg'] as string, 4, c['surface'] as string),
        '--short-bg': c['surface'] as string,
        '--paper': c['bg'] as string,
        '--topbar-bg': c['bg'] as string,
        '--code-inline-bg': c['surface2'] as string,
        '--code-comment': c['syn-comment'] as string,
      };
      const doc = await open(browser, { appearance: fx });
      try {
        const got = await doc.page.evaluate(
          ({ sel, want }) => {
            const root = document.querySelector(sel) as HTMLElement;
            const probe = document.createElement('i');
            root.append(probe);
            const colour = (v: string): string => {
              probe.style.color = '';
              probe.style.color = v;
              return getComputedStyle(probe).color;
            };
            const rows = Object.entries(want).map(([name, rule]) => [name, colour(`var(${name})`), colour(rule)] as const);
            probe.remove();
            return rows;
          },
          { sel: rootSel, want: expected },
        );
        for (const [name, have, want] of got) expect(have, `${fx.name} ${name}`).toBe(want);
      } finally {
        await doc.close();
      }
    }
  });

  it('chg-bg is 4% of chg over short-bg inside the summary box and a waiting callout, and chg-tint elsewhere; the plate is surface only under a marked figure', async () => {
    const c = PHOSPHOR.colour;
    const doc = await open(browser, { appearance: PHOSPHOR });
    try {
      const got = await doc.page.evaluate(({ sel, c }) => {
        const root = document.querySelector(sel) as HTMLElement;
        const make = (parent: Element, tag: string, cls: string): HTMLElement => {
          const e = document.createElement(tag);
          e.className = cls;
          parent.append(e);
          return e;
        };
        const colourOf = (e: Element, v: string): string => {
          const probe = document.createElement('i');
          e.append(probe);
          probe.style.color = v;
          const out = getComputedStyle(probe).color;
          probe.remove();
          return out;
        };
        const short = root.querySelector('.short') as HTMLElement;
        const inShort = make(short, 'p', 'chg');
        const waiting = root.querySelector('.callout.waiting') as HTMLElement;
        const inWaiting = make(waiting, 'p', 'chg');
        const plain = make(root, 'p', 'chg');
        const figure = (marked: boolean): string => {
          const f = make(root, 'figure', 'mermaid-figure');
          const pre = make(f, 'pre', 'mermaid');
          const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          if (marked) svg.setAttribute('data-docreader-hosted-figure', '');
          pre.append(svg);
          return getComputedStyle(pre).backgroundColor;
        };
        const undrawn = (): string => {
          const f = make(root, 'figure', 'mermaid-figure');
          const pre = make(f, 'pre', 'mermaid');
          pre.textContent = 'flowchart LR';
          return getComputedStyle(pre).backgroundColor;
        };
        const block = make(root, 'pre', '');
        const blockCode = make(block, 'code', '');
        blockCode.textContent = 'x = 1';
        return {
          blockCode: getComputedStyle(blockCode).color,
          undrawn: undrawn(),
          inShort: colourOf(inShort, 'var(--chg-bg)'),
          inWaiting: colourOf(inWaiting, 'var(--chg-bg)'),
          plain: colourOf(plain, 'var(--chg-bg)'),
          wanted: [colourOf(root, `color-mix(in srgb, ${c['chg'] as string} 4%, ${c['surface'] as string})`), colourOf(root, `color-mix(in srgb, ${c['chg'] as string} 4%, ${c['bg'] as string})`), colourOf(root, c['surface'] as string)],
          marked: figure(true),
          unmarked: figure(false),
        };
      }, { sel: rootSel, c });
      expect([got.inShort, got.inWaiting, got.plain]).toEqual([got.wanted[0], got.wanted[0], got.wanted[1]]);
      expect(got.undrawn, 'an undrawn figure\'s source takes the hosted plate').toBe(got.wanted[2]);
      expect(got.blockCode, 'a plain code block\'s text on the well').toBe(css(c['code-ink'] as string));
      expect(got.marked, 'a marked figure\'s plate').toBe(got.wanted[2]);
      expect(got.unmarked, '1.1.0\'s plate for an unmarked figure').not.toBe(got.wanted[2]);
    } finally {
      await doc.close();
    }
  });

  /** Every class 1.1.0's stylesheet colours, in exactly one row of the design's table. */
  const HLJS: Record<string, string[]> = {
    'syn-comment': ['hljs-comment', 'hljs-quote', 'hljs-doctag', 'hljs-meta', 'hljs-meta prompt_'],
    'syn-keyword': ['hljs-keyword', 'hljs-selector-tag', 'hljs-section', 'hljs-literal', 'hljs-template-tag', 'hljs-variable language_'],
    'syn-string': ['hljs-string', 'hljs-regexp', 'hljs-char', 'hljs-char escape_'],
    'syn-number': ['hljs-number', 'hljs-symbol', 'hljs-bullet'],
    'syn-function': ['hljs-title', 'hljs-title function_', 'hljs-title function_ invoke__', 'hljs-link'],
    'syn-type': ['hljs-type', 'hljs-built_in', 'hljs-title class_', 'hljs-title class_ inherited__'],
    'syn-attr': ['hljs-attr', 'hljs-attribute', 'hljs-property', 'hljs-variable', 'hljs-template-variable', 'hljs-variable constant_', 'hljs-selector-class', 'hljs-selector-id'],
    'syn-punct': ['hljs-tag', 'hljs-operator', 'hljs-subst', 'hljs-selector-attr', 'hljs-selector-pseudo'],
    'syn-tag': ['hljs-name'],
    'syn-deleted': ['hljs-deletion'],
    'syn-inserted': ['hljs-addition'],
    'code-ink': ['hljs-code', 'hljs-formula', 'hljs-emphasis', 'hljs-strong', 'hljs-nothing-names-this'],
  };
  /** The contexts 1.1.0 colours at a higher specificity, each with the slot of its class's row. */
  const HLJS_CONTEXT: [string, string, string][] = [
    ['language-json', 'hljs-attr', 'syn-attr'],
    ['language-yaml', 'hljs-attr', 'syn-attr'],
    ['language-python', 'hljs-meta', 'syn-comment'],
    ['language-diff', 'hljs-meta', 'syn-comment'],
    ['language-bash', 'hljs-meta', 'syn-comment'],
    ['language-shell', 'hljs-meta', 'syn-comment'],
  ];

  for (const fx of [PHOSPHOR, DAYLIGHT]) {
    it(`code on the well, ${fx.name}: every class by its row, the contexts, a block's own text and a failed figure's source in code-ink, no addition or deletion background`, async () => {
      const doc = await open(browser, { appearance: fx });
      try {
        const got = await doc.page.evaluate(
          ({ sel, rows, contexts }) => {
            const root = document.querySelector(sel) as HTMLElement;
            const block = document.createElement('div');
            block.className = 'codehilite';
            const pre = document.createElement('pre');
            const code = document.createElement('code');
            pre.append(code);
            block.append(pre);
            root.append(block);
            const out: Record<string, string> = {};
            const span = (parent: Element, cls: string): HTMLElement => {
              const s = document.createElement('span');
              s.className = cls;
              s.textContent = 'x';
              parent.append(s);
              return s;
            };
            const colour = (e: Element): string => getComputedStyle(e).color;
            out['block'] = colour(block);
            for (const [slot, classes] of Object.entries(rows)) {
              for (const c of classes) {
                const s = span(code, c);
                out[`${slot}|${c}`] = colour(s);
                if (slot === 'syn-deleted' || slot === 'syn-inserted') out[`${slot}|${c}|bg`] = getComputedStyle(s).backgroundColor;
              }
            }
            for (const [ctx = '', cls = ''] of contexts) {
              const holder = document.createElement('code');
              holder.className = ctx;
              pre.append(holder);
              out[`ctx|${ctx}|${cls}`] = colour(span(holder, cls));
            }
            const meta = span(code, 'hljs-meta');
            out['meta keyword'] = colour(span(meta, 'hljs-keyword'));
            out['meta string'] = colour(span(meta, 'hljs-string'));
            const tag = span(code, 'hljs-tag');
            out['tag name'] = colour(span(tag, 'hljs-name'));
            const err = document.createElement('div');
            err.className = 'fig-error';
            const fig = document.createElement('pre');
            fig.className = 'fig-src';
            err.append(fig);
            root.append(err);
            out['fig-src'] = colour(fig);
            const sep = document.createElement('div');
            sep.className = 'rs-facts';
            const sp = span(sep, 'sep');
            root.append(sep);
            out['sep'] = colour(sp);
            return out;
          },
          { sel: rootSel, rows: HLJS, contexts: HLJS_CONTEXT.map(([a, b]) => [a, b]) },
        );
        const c = fx.colour;
        expect(got['block'], 'the block\'s own text').toBe(css(c['code-ink'] as string));
        expect(got['fig-src'], 'a failed figure\'s source').toBe(css(c['code-ink'] as string));
        expect(got['sep'], 'the review strip\'s separator').toBe(css(c['text-muted'] as string));
        for (const [slot, classes] of Object.entries(HLJS)) {
          for (const cls of classes) expect(got[`${slot}|${cls}`], `${cls} -> ${slot}`).toBe(css(c[slot] as string));
        }
        for (const [ctx, cls, slot] of HLJS_CONTEXT) expect(got[`ctx|${ctx}|${cls}`], `${ctx} ${cls} -> ${slot}`).toBe(css(c[slot] as string));
        expect(got['meta keyword'], '.hljs-meta .hljs-keyword').toBe(css(c['syn-keyword'] as string));
        expect(got['meta string'], '.hljs-meta .hljs-string').toBe(css(c['syn-string'] as string));
        expect(got['tag name'], '.hljs-tag .hljs-name').toBe(css(c['syn-tag'] as string));
        expect(got['syn-deleted|hljs-deletion|bg']).toBe('rgba(0, 0, 0, 0)');
        expect(got['syn-inserted|hljs-addition|bg']).toBe('rgba(0, 0, 0, 0)');
      } finally {
        await doc.close();
      }
    });
  }

  sharedCue('the chrome literals are slots: tool buttons surface and text, the pressed one accent and accent-ink, the full-screen overlay, and selected text', async (layout) => {
    const c = PHOSPHOR.colour;
    const doc = await open(browser, { appearance: PHOSPHOR, layout });
    try {
      const got = await doc.page.evaluate((sel) => {
        const root = document.querySelector(sel) as HTMLElement;
        const make = (parent: Element, tag: string, cls: string): HTMLElement => {
          const e = document.createElement(tag);
          e.className = cls;
          parent.append(e);
          return e;
        };
        const fig = make(root, 'figure', 'mermaid-figure');
        const tools = make(fig, 'div', 'tools');
        const idle = make(tools, 'button', '');
        const pressed = make(tools, 'button', 'on');
        const overlay = make(root, 'div', 'fig-overlay open');
        const bar = make(overlay, 'div', 'fo-bar');
        const button = make(bar, 'button', '');
        const cs = (e: Element) => getComputedStyle(e);
        const para = make(root, 'p', '');
        para.textContent = 'selected';
        return {
          idle: [cs(idle).backgroundColor, cs(idle).color],
          pressed: [cs(pressed).backgroundColor, cs(pressed).color],
          overlay: cs(overlay).backgroundColor,
          bar: cs(bar).color,
          button: [cs(button).backgroundColor, cs(button).color, cs(button).borderTopColor],
          selection: [getComputedStyle(para, '::selection').backgroundColor, getComputedStyle(para, '::selection').color],
        };
      }, rootSel);
      expect(got.idle).toEqual([css(c['surface'] as string), css(c['text'] as string)]);
      expect(got.pressed).toEqual([css(c['accent'] as string), css(c['accent-ink'] as string)]);
      expect(got.overlay).toBe(css(c['bg'] as string));
      expect(got.bar).toBe(css(c['text'] as string));
      expect(got.button).toEqual([css(c['surface'] as string), css(c['text'] as string), css(c['border'] as string)]);
      expect(got.selection).toEqual([css(c['accent'] as string), css(c['accent-ink'] as string)]);
    } finally {
      await doc.close();
    }
  });

  it('the hosted Aa line is drawn in text-muted, not the menu\'s text colour (the design, section 6: text-muted on bg)', async () => {
    const c = PHOSPHOR.colour;
    const doc = await open(browser, { appearance: PHOSPHOR });
    try {
      await doc.page.locator(`${rootSel} .aa-btn`).click();
      const got = await doc.page.evaluate((sel) => {
        const root = document.querySelector(sel) as HTMLElement;
        const line = root.querySelector('.aa-menu .aa-hosted') as HTMLElement;
        return { line: getComputedStyle(line).color, menu: getComputedStyle(root.querySelector('.aa-menu') as Element).color, ground: getComputedStyle(root.querySelector('.aa-menu') as Element).backgroundColor };
      }, rootSel);
      expect(c['text-muted'], 'the fixture tells the muted colour from the text').not.toBe(c['text']);
      expect(got.menu, 'the menu itself stays in text').toBe(css(c['text'] as string));
      expect(got.line, 'the hosted line').toBe(css(c['text-muted'] as string));
      expect(got.ground, 'on bg').toBe(css(c['bg'] as string));
    } finally {
      await doc.close();
    }
  });

  it('the faces: sans and mono take the host face first, the library\'s stack after it, and the serif reading face is untouched', async () => {
    const mine = await open(browser, { appearance: PHOSPHOR });
    const old = await open(browser, { appearance: PHOSPHOR, stylesheet: v110 });
    try {
      const read = (d: OpenedDoc): Promise<Record<string, string>> =>
        d.page.evaluate((sel) => {
          const root = document.querySelector(sel) as HTMLElement;
          const cs = getComputedStyle(root);
          const p = root.querySelector('p') as HTMLElement;
          const code = document.createElement('code');
          p.append(code);
          return { sans: cs.getPropertyValue('--sans').trim(), mono: cs.getPropertyValue('--mono').trim(), serif: cs.getPropertyValue('--serif').trim(), body: cs.fontFamily, code: getComputedStyle(code).fontFamily, bar: getComputedStyle(root.querySelector('.bar-tools button') as Element).fontFamily };
        }, rootSel);
      const a = await read(mine);
      const b = await read(old);
      expect(a['sans']).toBe(`"Docreader Host Sans", ${b['sans'] as string}`);
      expect(a['mono']).toBe(`"Docreader Host Mono", ${b['mono'] as string}`);
      expect(a['serif']).toBe(b['serif']);
      expect(a['body'], 'the reading face').toBe(b['body']);
      // A computed font-family keeps the quotes in Chromium and drops them in WebKit: read the first family either way.
      expect(/^"?Docreader Host Mono"?,/.test(a['code'] as string), a['code']).toBe(true);
      expect(/^"?Docreader Host Sans"?,/.test(a['bar'] as string), a['bar']).toBe(true);
    } finally {
      await mine.close();
      await old.close();
    }
  });

  const SKIN = { radius: '7px', radiusSmall: '2px', radiusLarge: '13px', controlRow: '44px', popShadow: '0 0 0 3px #5F697C', sectionFamily: 'mono', sectionSize: '12px', sectionWeight: '500', sectionTracking: '0.08em', sectionCase: 'uppercase' };

  it('the skin slots style the radii, the popovers\' rows, shadow and headings, and only the slots a verdict holds', async () => {
    const doc = await open(browser, { appearance: { mode: 'dark', skin: SKIN } });
    const bare = await open(browser, { appearance: { mode: 'dark', skin: { radiusSmall: '2px' } } });
    try {
      const probe = (d: OpenedDoc): Promise<Record<string, string>> =>
        d.page.evaluate((sel) => {
          const root = document.querySelector(sel) as HTMLElement;
          const make = (parent: Element, tag: string, cls: string): HTMLElement => {
            const e = document.createElement(tag);
            e.className = cls;
            parent.append(e);
            return e;
          };
          const code = make(root.querySelector('p') as Element, 'code', '');
          const plainPre = make(root, 'pre', '');
          make(plainPre, 'code', '').textContent = 'x';
          const fig = make(root, 'figure', 'mermaid-figure');
          const plate = make(fig, 'pre', 'mermaid');
          (root.querySelector('.aa-btn') as HTMLElement).click();
          const menu = root.querySelector('.aa-menu') as HTMLElement;
          const radius = (e: Element): string => getComputedStyle(e).borderTopLeftRadius;
          const legend = root.querySelector('.aa-menu legend') as HTMLElement;
          const ls = getComputedStyle(legend);
          return {
            control: radius(root.querySelector('.aa-menu .aa-btns button') as Element),
            code: radius(root.querySelector('.codehilite > pre') as Element),
            codeWrapper: radius(root.querySelector('.codehilite') as Element),
            plainCode: radius(plainPre),
            inline: radius(code),
            popover: radius(menu),
            callout: radius(root.querySelector('.short') as Element),
            plate: radius(plate),
            shadow: getComputedStyle(menu).boxShadow,
            row: getComputedStyle(root.querySelector('.aa-menu .opt') as Element).minHeight,
            legend: [ls.fontSize, ls.fontWeight, ls.letterSpacing, ls.textTransform, /^"?Docreader Host Mono"?,/.test(ls.fontFamily) ? 'mono' : ls.fontFamily].join(' | '),
          };
        }, rootSel);
      const got = await probe(doc);
      const none = await probe(bare);
      expect(got).toEqual({
        control: '7px',
        code: '7px',
        codeWrapper: '7px',
        plainCode: '7px',
        inline: '2px',
        popover: '13px',
        callout: '13px',
        plate: '13px',
        shadow: 'rgb(95, 105, 124) 0px 0px 0px 3px',
        row: '44px',
        legend: '12px | 500 | 0.96px | uppercase | mono',
      });
      expect(none['inline'], 'a slot the verdict holds').toBe('2px');
      for (const k of ['control', 'code', 'codeWrapper', 'plainCode', 'popover', 'callout', 'plate', 'shadow', 'row', 'legend']) expect(none[k], `${k}: a slot it leaves out keeps 1.1.0's`).not.toBe(got[k]);
      expect(none['control']).toBe('5px');
      expect([none['code'], none['plainCode']]).toEqual(['3px', '3px']);
      expect(none['popover']).toBe('6px');
      expect(none['row']).toBe('auto');
      expect(none['legend']).toMatch(/^10\.5px \| 650 \| 1\.05px \| uppercase \| /);
    } finally {
      await doc.close();
      await bare.close();
    }
  });

  it('the frame\'s own bar and the reading layout never take a skin value: with every slot set, they compute what 1.1.0 computes', async () => {
    const mine = await open(browser, { appearance: { mode: 'dark', skin: SKIN } });
    const old = await open(browser, { appearance: { mode: 'dark', skin: SKIN }, stylesheet: v110 });
    try {
      const read = (d: OpenedDoc): Promise<Record<string, string>> =>
        d.page.evaluate((sel) => {
          const root = document.querySelector(sel) as HTMLElement;
          const out: Record<string, string> = {};
          for (const s of ['.bar-tools button', '.bar-tools kbd', '.topbar-inner', '.running-head', '.aa-btn', 'h1', 'h2', 'p', '.byline', 'table', 'li']) {
            const e = root.querySelector(s);
            if (e === null) {
              out[s] = 'missing';
              continue;
            }
            const c = getComputedStyle(e);
            out[s] = [c.borderTopLeftRadius, c.minHeight, c.fontSize, c.fontWeight, c.letterSpacing, c.textTransform, c.boxShadow, c.lineHeight].join(' | ');
          }
          return out;
        }, rootSel);
      const a = await read(mine);
      const b = await read(old);
      expect(b['.bar-tools kbd'], 'the bar has a keycap').not.toBe('missing');
      expect(a).toEqual(b);
      expect((a['.bar-tools button'] as string).startsWith('4px |'), a['.bar-tools button']).toBe(true);
      expect((a['.bar-tools kbd'] as string).startsWith('3px |'), a['.bar-tools kbd']).toBe(true);
    } finally {
      await mine.close();
      await old.close();
    }
  });

  it('radiusLarge keeps the square ends of an attention bar (a waiting callout, what waits on you) and rounds a summary box all round', async () => {
    const doc = await open(browser, { appearance: { mode: 'dark', skin: SKIN } });
    try {
      const got = await doc.page.evaluate((sel) => {
        const root = document.querySelector(sel) as HTMLElement;
        const wait = document.createElement('div');
        wait.className = 'rs-wait';
        root.append(wait);
        const corners = (e: Element): string => {
          const c = getComputedStyle(e);
          return [c.borderTopLeftRadius, c.borderTopRightRadius, c.borderBottomRightRadius, c.borderBottomLeftRadius].join(' ');
        };
        return { callout: corners(root.querySelector('.callout.waiting') as Element), strip: corners(wait), short: corners(root.querySelector('.short') as Element) };
      }, rootSel);
      expect(got).toEqual({ callout: '0px 13px 13px 0px', strip: '0px 13px 13px 0px', short: '13px 13px 13px 13px' });
    } finally {
      await doc.close();
    }
  });

  it('the contents panel takes controlRow and the section type only as a drawer, never as the wide column', async () => {
    const skin = { controlRow: '44px', sectionSize: '12px' };
    const probe = (d: OpenedDoc): Promise<{ row: string; tab: string }> =>
      d.page.evaluate((sel) => {
        const root = document.querySelector(sel) as HTMLElement;
        const panel = root.querySelector('.doc-toc') as HTMLElement;
        const tab = document.createElement('div');
        tab.className = 'toc-tabs';
        const b = document.createElement('button');
        tab.append(b);
        panel.append(tab);
        return { row: getComputedStyle(root.querySelector('.toc-contents a') as Element).minHeight, tab: getComputedStyle(b).fontSize };
      }, rootSel);
    const column = await open(browser, { appearance: { mode: 'dark', skin }, width: 1440 });
    const drawer = await open(browser, { appearance: { mode: 'dark', skin }, width: 1000 });
    try {
      expect(await probe(column), 'the wide column').toEqual({ row: '0px', tab: '11px' });
      await drawer.page.locator(`${rootSel} .toc-btn`).click();
      expect(await probe(drawer), 'the open drawer').toEqual({ row: '44px', tab: '12px' });
    } finally {
      await column.close();
      await drawer.close();
    }
  });

  it('a drawer left open and then widened does not style the docked rail: a stale toc-open keeps 1.1.0\'s values', async () => {
    const skin = { controlRow: '44px', sectionSize: '12px', sectionWeight: '500', sectionTracking: '0.08em', sectionCase: 'uppercase', sectionFamily: 'mono' };
    const probe = (d: OpenedDoc): Promise<Record<string, string>> =>
      d.page.evaluate((sel) => {
        const root = document.querySelector(sel) as HTMLElement;
        root.classList.add('toc-open'); // whatever the reader did on resize, the class stands here
        const panel = root.querySelector('.doc-toc') as HTMLElement;
        const tab = document.createElement('div');
        tab.className = 'toc-tabs';
        const b = document.createElement('button');
        tab.append(b);
        panel.append(tab);
        const c = getComputedStyle(b);
        return { row: getComputedStyle(root.querySelector('.toc-contents a') as Element).minHeight, size: c.fontSize, weight: c.fontWeight, tracking: c.letterSpacing, transform: c.textTransform, family: c.fontFamily };
      }, rootSel);
    const hosted = await open(browser, { appearance: { mode: 'dark', skin }, width: 1000 });
    const plain = await open(browser, { appearance: { mode: 'dark' }, width: 1440 });
    try {
      await hosted.page.locator(`${rootSel} .toc-btn`).click();
      await hosted.page.setViewportSize({ width: 1440, height: 1000 });
      const baseline = await probe(plain);
      expect(await probe(hosted)).toEqual(baseline);
      expect(baseline.row).toBe('0px');
    } finally {
      await hosted.close();
      await plain.close();
    }
  });

  it('popShadow replaces the shadow of quick jump, the keys sheet and the contents drawer, and the verdict\'s radii reach their boxes', async () => {
    const shadow = 'rgb(95, 105, 124) 0px 0px 0px 3px';
    const doc = await open(browser, { appearance: { mode: 'dark', skin: SKIN }, width: 1000 });
    try {
      await doc.page.locator(`${rootSel} .toc-btn`).click();
      const drawer = await doc.page.locator(`${rootSel}.has-toc.toc-open > .doc-toc`).evaluate((e) => getComputedStyle(e).boxShadow);
      expect(drawer, 'the contents drawer').toBe(shadow);
      await doc.page.keyboard.press('Escape');
      await doc.page.keyboard.press('/');
      const jump = await doc.page.locator(`${rootSel} .jump.open .box`).evaluate((e) => ({ s: getComputedStyle(e).boxShadow, r: getComputedStyle(e).borderTopLeftRadius }));
      expect(jump).toEqual({ s: shadow, r: '13px' });
      await doc.page.keyboard.press('Escape');
      await doc.page.keyboard.press('?');
      const keys = await doc.page.locator(`${rootSel} .keys.open .box`).evaluate((e) => ({ s: getComputedStyle(e).boxShadow, r: getComputedStyle(e).borderTopLeftRadius }));
      expect(keys).toEqual({ s: shadow, r: '13px' });
    } finally {
      await doc.close();
    }
  });

  it('sectionCase none turns the popovers\' uppercase headings off, and the library\'s own stay uppercase without it', async () => {
    const off = await open(browser, { appearance: { mode: 'dark', skin: { sectionCase: 'none' } } });
    const on = await open(browser, { appearance: { mode: 'dark', skin: { radius: '5px' } } });
    try {
      const read = async (d: OpenedDoc): Promise<string> => {
        await d.page.locator(`${rootSel} .aa-btn`).click();
        return d.page.locator(`${rootSel} .aa-menu legend`).first().evaluate((e) => getComputedStyle(e).textTransform);
      };
      expect(await read(off)).toBe('none');
      expect(await read(on)).toBe('uppercase');
    } finally {
      await off.close();
      await on.close();
    }
  });

  it('the family is sans or mono by the verdict, and controlRow is applied under a fine pointer only', async () => {
    const sans = await open(browser, { appearance: { mode: 'dark', skin: { sectionFamily: 'sans' } } });
    try {
      const family = await sans.page.evaluate((sel) => {
        (document.querySelector(`${sel} .aa-btn`) as HTMLElement).click();
        return getComputedStyle(document.querySelector(`${sel} .aa-menu legend`) as Element).fontFamily;
      }, rootSel);
      const where = (await controlRowRules(sans.page)).map((row) => row.media);
      expect(/^"?Docreader Host Sans"?,/.test(family), family).toBe(true);
      expect(where.length).toBeGreaterThan(0);
      // the plain rule, and the drawer's own (a drawer is a narrow viewport's): both only under a fine pointer
      expect(new Set(where)).toEqual(new Set(['(pointer: fine)', 'screen and (max-width: 1239px) and (pointer: fine)']));
    } finally {
      await sans.close();
    }
  });


  for (const layout of ['classic', 'editorial'] as const) {
    it(`${layout}: every controlRow rule including its Close rule is under a fine pointer only`, async () => {
      const doc = await open(browser, { layout });
      try {
        const rows = await controlRowRules(doc.page);
        const own = rows.filter((row) => row.sheet === '/assets/layout.css');
        const close = own.filter((row) => row.selector.includes('.toc-close'));
        expect(close.length, JSON.stringify(own)).toBe(1);
        expect(close[0]?.selector).toContain(`data-docreader-layout="${layout}"`);
        expect(own.length).toBeGreaterThan(0);
        expect(new Set(rows.map((row) => row.media)), JSON.stringify(rows)).toEqual(new Set(['(pointer: fine)', 'screen and (max-width: 1239px) and (pointer: fine)']));
      } finally { await doc.close(); }
    });
  }

  it('review: its own controlRow rule, the card\'s Next button, is under a fine pointer only, and every controlRow rule of the page is', async () => {
    const doc = await open(browser, { layout: 'review' });
    try {
      const rows = await controlRowRules(doc.page);
      const own = rows.filter((row) => row.sheet === '/assets/layout.css');
      expect(own.map((row) => row.selector), JSON.stringify(own)).toEqual(['[data-docreader-root][data-docreader-layout="review"][data-docreader-skin~="controlRow"] .rv-next']);
      expect(own.map((row) => row.media)).toEqual(['(pointer: fine)']);
      expect(new Set(rows.map((row) => row.media)), JSON.stringify(rows)).toEqual(new Set(['(pointer: fine)', 'screen and (max-width: 1239px) and (pointer: fine)']));
    } finally { await doc.close(); }
  });

  it("Mermaid's tooltip, which sits in body outside the root, computes the verdict's surface, text and border (second review F8)", async () => {
    // The tooltip is one element per document, and its three colours are the document element's properties; the jsdom rows of
    // test/enhance-appearance.test.ts count the roots that hold them, and this row reads what a tooltip then looks like. (The
    // harness mounts one `main` root: a root that is the document element, which carries the properties on itself, is a jsdom row.)
    const c = PHOSPHOR_COLOURS().colour;
    const doc = await open(browser, { appearance: PHOSPHOR_COLOURS() });
    try {
      const got = await doc.page.evaluate(() => {
        const tip = document.createElement('div');
        tip.className = 'mermaidTooltip';
        document.body.append(tip);
        const s = getComputedStyle(tip);
        const out = { bg: s.backgroundColor, fg: s.color, edge: s.borderTopColor, parent: tip.parentElement === document.body };
        tip.remove();
        return out;
      });
      expect(got.parent).toBe(true);
      expect(got.bg).toBe(css(c['surface'] as string));
      expect(got.fg).toBe(css(c['text'] as string));
      expect(got.edge).toBe(css(c['border'] as string));
    } finally {
      await doc.close();
    }
  });

});

/** The first fixture appearance (Phosphor & Ink): all 33 colours distinct enough to tell a ground from a mark. */
function PHOSPHOR_COLOURS(): { mode: 'light' | 'dark'; colour: Record<string, string> } {
  return FIXTURES[0] as { mode: 'light' | 'dark'; colour: Record<string, string> };
}

/** A tint as the stylesheet writes it, for a probe to resolve. */
function mixed(a: string, pct: number, b: string): string {
  return `color-mix(in srgb, ${a} ${String(pct)}%, ${b})`;
}

/** `#rrggbb` as a browser prints a computed colour. */
function css(hex: string): string {
  const [r, g, b] = rgb(hex);
  return `rgb(${String(r)}, ${String(g)}, ${String(b)})`;
}

