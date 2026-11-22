// @vitest-environment jsdom
// The layouts' feature lists (docserver parity Task 9; plan Design B11): each non-default layout is the reader with its own
// feature list (src/enhance/layouts/<name>/features.ts), which scripts/build-frame.mjs substitutes for the lifecycle's own at
// build time. Here the lifecycle runs in jsdom with each list in turn (the module the lifecycle imports is mocked to hand out the
// layout's `features()`), so the lists are proved without a build or a browser:
//   - each list is frozen, made fresh by a call, and distinct: no two layouts, and none of them and the default, hold the same
//     feature names in the same order. Shared features are the very same functions and keep their relative order;
//     a layout-specific feature names its layout instead of replacing a shared feature under the same name;
//   - the layout mark comes first in every non-default list and is in no other, and the default list holds none;
//   - a layout's root is marked `data-docreader-layout="<name>"` once it is enhanced, beside the shared `data-docreader-root`,
//     and teardown (the journal's undo) takes the mark off again, the document as it was; the default layout's root is never
//     marked;
//   - the layout's stylesheet scopes every rule under the root's two marks, holds no literal colour and no font of its own.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { findShapes } from '../scripts/public-shapes.mjs';
import { destroyEnhancement, enhance, runEnhancementCommand, setEnhancementPrefs } from '../src/enhance/index.js';
import type { Feature } from '../src/enhance/features.js';
import { features as defaultFeatures } from '../src/enhance/features.js';
import { FRAME_LAYOUTS } from '../src/frame/layouts.js';
import { render } from '../src/render/index.js';

const OWN = FRAME_LAYOUTS.filter((l) => l !== 'default');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const pick = vi.hoisted(() => ({ layout: 'default' }));

vi.mock('../src/enhance/features.js', async (importOriginal) => {
  const real = await importOriginal<typeof import('../src/enhance/features.js')>();
  const markBuild = (await import('../src/enhance/layouts/mark.js')).markFeature('review').build;
  const marksBuild = (await import('../src/enhance/marks.js')).build;
  const contextBuild = (await import('../src/enhance/layouts/review/context.js')).build;
  const lists = {
    classic: (await import('../src/enhance/layouts/classic/features.js')).features,
    editorial: (await import('../src/enhance/layouts/editorial/features.js')).features,
    review: (await import('../src/enhance/layouts/review/features.js')).features,
    guided: (await import('../src/enhance/layouts/guided/features.js')).features,
    // Not a layout: the review toggle alone, so the bar holds no other tool.
    'toggle-only': () => Object.freeze([
      { name: 'layout-mark', build: markBuild },
      { name: 'marks', build: marksBuild },
      { name: 'review-context', build: contextBuild },
    ]),
  } as Record<string, () => readonly Feature[]>;
  return { ...real, features: (): readonly Feature[] => (pick.layout === 'default' ? real.features() : (lists[pick.layout] as () => readonly Feature[])()) };
});

const mounted: HTMLElement[] = [];

function mount(md: string): HTMLElement {
  const parsed = new DOMParser().parseFromString(`<!doctype html><body>${render(md).html}`, 'text/html');
  const root = document.createElement('main');
  root.append(...Array.from(parsed.body.childNodes).map((n) => document.importNode(n, true)));
  document.body.append(root);
  mounted.push(root);
  return root;
}

afterEach(async () => {
  for (const root of mounted.splice(0)) await destroyEnhancement(root).catch(() => undefined);
  document.body.replaceChildren();
  pick.layout = 'default';
});

const DOC = '# A title\n\nSome words.\n\n## First\n\nText with `code`.\n\n## Second\n\n| a | b |\n|---|---|\n| 1 | 2 |\n';

/** The feature lists by layout, as the modules make them (never through the lifecycle's mock). */
async function lists(): Promise<Record<string, readonly Feature[]>> {
  return {
    default: defaultFeatures(),
    classic: (await import('../src/enhance/layouts/classic/features.js')).features(),
    editorial: (await import('../src/enhance/layouts/editorial/features.js')).features(),
    review: (await import('../src/enhance/layouts/review/features.js')).features(),
    guided: (await import('../src/enhance/layouts/guided/features.js')).features(),
  };
}

describe('the layouts\' feature lists', () => {
  it('each is frozen and made fresh by every call, as the default list is', async () => {
    const mods = {
      classic: await import('../src/enhance/layouts/classic/features.js'),
      editorial: await import('../src/enhance/layouts/editorial/features.js'),
      review: await import('../src/enhance/layouts/review/features.js'),
      guided: await import('../src/enhance/layouts/guided/features.js'),
    };
    for (const [name, m] of Object.entries(mods)) {
      const a = m.features();
      expect(Object.isFrozen(a), name).toBe(true);
      expect(m.features(), name).not.toBe(a);
      expect(Object.keys(m).sort(), name).toEqual(['features']);
    }
    expect(Object.isFrozen(defaultFeatures())).toBe(true);
  });

  it('are distinct from one another and from the default: no two hold the same names in the same order', async () => {
    const all = await lists();
    const keys = Object.entries(all).map(([name, l]) => [name, l.map((f) => f.name).join(',')] as const);
    expect(new Set(keys.map(([, k]) => k)).size).toBe(keys.length);
    expect(Object.keys(all).sort()).toEqual([...FRAME_LAYOUTS].sort());
  });

  it('reuse shared features by identity and give layout-specific features distinct names', async () => {
    const all = await lists();
    const shared = new Map(defaultFeatures().map((f) => [f.name, f]));
    for (const layout of OWN) {
      const features = all[layout] ?? [];
      expect(new Set(features.map((f) => f.name)).size, `${layout}: feature names`).toBe(features.length);
      for (const f of features) {
        if (f.name === 'layout-mark') continue;
        const s = shared.get(f.name);
        if (s === undefined) {
          expect(f.name.startsWith(`${layout}-`), `${layout}: ${f.name}`).toBe(true);
        } else {
          expect(f.build, `${layout}: ${f.name} builds with its own function`).toBe(s.build);
          expect(f.after, `${layout}: ${f.name}'s second phase`).toBe(s.after);
        }
      }
    }
  });

  it('keep the shared order: shared features of a layout are a subsequence of the default list', async () => {
    const all = await lists();
    const order = defaultFeatures().map((f) => f.name);
    for (const layout of OWN) {
      const at = (all[layout] ?? []).map((f) => order.indexOf(f.name)).filter((i) => i >= 0);
      expect(at.length, `${layout}: uses shared features`).toBeGreaterThan(0);
      expect([...at].sort((a, b) => a - b), layout).toEqual(at);
    }
  });

  it('put the layout mark first in every non-default list, once, and none in the default list', async () => {
    const all = await lists();
    for (const layout of OWN) {
      const names = (all[layout] ?? []).map((f) => f.name);
      expect(names[0], layout).toBe('layout-mark');
      expect(names.filter((n) => n === 'layout-mark'), layout).toHaveLength(1);
      expect(['editorial', `${layout}-editorial`], layout).toContain(names[1]);
    }
    expect((all['default'] ?? []).map((f) => f.name)).not.toContain('layout-mark');
  });
});

describe('the layout mark on the root', () => {
  for (const layout of ['default', ...OWN]) {
    it(`${layout}: ${layout === 'default' ? 'the root is never marked' : 'the root carries data-docreader-layout once enhanced, and teardown takes it off, the root as it was'}`, async () => {
      pick.layout = layout;
      const root = mount(DOC);
      const before = root.outerHTML;
      await enhance(root);
      expect(root.hasAttribute('data-docreader-root'), 'the shared root mark').toBe(true);
      if (layout === 'default') expect(root.hasAttribute('data-docreader-layout')).toBe(false);
      else expect(root.getAttribute('data-docreader-layout')).toBe(layout);
      await destroyEnhancement(root);
      expect(root.hasAttribute('data-docreader-layout')).toBe(false);
      expect(root.hasAttribute('data-docreader-root')).toBe(false);
      expect(root.outerHTML).toBe(before);
    });
  }

  it('a host attribute of the same name, changed since, wins at teardown (the journal restores only what it wrote)', async () => {
    pick.layout = 'classic';
    const root = mount(DOC);
    await enhance(root);
    root.setAttribute('data-docreader-layout', 'host');
    await destroyEnhancement(root);
    expect(root.getAttribute('data-docreader-layout')).toBe('host');
  });
});

it('classic: the host opens Contents without a reader bar and Escape restores the host button', async () => {
  pick.layout = 'classic';
  const root = mount(`${DOC}\n## Third\n\nMore words.\n`);
  const host = document.createElement('button');
  document.body.prepend(host);
  await enhance(root, { chrome: { bar: false } });
  expect(root.querySelector('.toc-btn, .topbar')).toBeNull();
  host.focus();
  expect(runEnhancementCommand(root, 'contents')).toBe(true);
  const dialogue = root.querySelector('[role="dialog"][aria-modal="true"]');
  expect(dialogue?.contains(document.activeElement)).toBe(true);
  document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  expect(root.querySelector('[role="dialog"]')).toBeNull();
  expect(document.activeElement).toBe(host);
});

it('editorial: standing links count only top-level list items in each populated callout', async () => {
  pick.layout = 'editorial';
  const root = mount(`${DOC}\n## Where things stand\n\n### Agreed\n\n- First decision\n  - Child detail\n- Second decision\n\n### Waiting on you\n\n1. Confirm the date\n\n### Later\n\nNo list yet.\n`);
  await enhance(root);
  const counts = root.querySelector('nav[aria-label="Where things stand"]');
  expect(counts?.nextElementSibling?.classList.contains('callout')).toBe(true);
  expect(Array.from(counts?.querySelectorAll('a') ?? []).map((a) => [
    a.querySelector('b')?.textContent, a.querySelector('span:not(.dot)')?.textContent, a.getAttribute('href'),
  ])).toEqual([
    ['2', 'Agreed', '#agreed'], ['1', 'Waiting on you', '#waiting-on-you'],
  ]);
});

// Use the parsed rule tree so the same scope check applies inside responsive and motion queries.
function checkScope(text: string, layout: string): void {
  const style = document.createElement('style');
  style.textContent = text;
  document.head.append(style);
  const scope = `[data-docreader-root][data-docreader-layout="${layout}"]`;
  const check = (rules: CSSRuleList): void => {
    expect(rules.length).toBeGreaterThan(0);
    for (const rule of Array.from(rules)) {
      if (rule.type === CSSRule.MEDIA_RULE) {
        check((rule as CSSMediaRule).cssRules);
      } else {
        expect(rule.type, rule.cssText).toBe(CSSRule.STYLE_RULE);
        // Keep layout selectors in flat lists: repeat the scope on each selector, including responsive rules.
        for (const selector of (rule as CSSStyleRule).selectorText.split(',')) {
          expect(selector.trim().startsWith(scope), selector.trim()).toBe(true);
        }
      }
    }
  };
  try {
    if (style.sheet === null) throw new Error(`${layout}: the stylesheet did not parse`);
    check(style.sheet.cssRules);
  } finally {
    style.remove();
  }
}

describe('the layouts\' stylesheets (assets/layouts/<name>.css)', () => {
  const css = (l: string): string => readFileSync(path.join(ROOT, 'assets', 'layouts', `${l}.css`), 'utf8');

  it('refuses a later unscoped selector in a comma-separated rule inside a media query', () => {
    const scope = '[data-docreader-root][data-docreader-layout="classic"]';
    expect(() => checkScope(`@media screen { ${scope} .doc-toc a:hover, ${scope} .doc-toc a.active { color: var(--text); } }`, 'classic')).not.toThrow();
    expect(() => checkScope(`@media screen { ${scope} .doc-toc a:hover, .doc-toc a.active { color: var(--text); } }`, 'classic')).toThrow('.doc-toc a.active');
  });

  /** The named colours a declaration's value uses (a list of the usual names; `transparent`, `currentColor` and `inherit` are none). */
  const NAMED = 'black|white|red|green|blue|yellow|orange|purple|pink|gray|grey|silver|gold|brown|cyan|magenta|teal|navy|maroon|olive|lime|aqua|fuchsia|indigo|violet|crimson|coral|salmon|tomato|khaki|beige|ivory|lavender|orchid|plum|tan|turquoise|azure|chocolate|firebrick|goldenrod|hotpink|lightblue|lightgray|lightgrey|darkgray|darkgrey|darkblue|darkred|darkgreen|slategray|slategrey|skyblue|steelblue|wheat|snow|linen';
  const namedColours = (text: string): string[] => Array.from(text.matchAll(new RegExp(`:\\s*[^;{}]*?\\b(${NAMED})\\b`, 'gi')), (m) => (m[1] as string).toLowerCase());

  it('refuses a CSS named colour in a declaration, and allows transparent, currentColor, inherit and the names inside other words', () => {
    expect(namedColours('a { border-color: red; }')).toEqual(['red']);
    expect(namedColours('a { color: var(--text); background: linear-gradient(white, var(--bg)); }')).toEqual(['white']);
    expect(namedColours('a { color: transparent; background: currentColor; border-color: inherit; white-space: nowrap; font-variant-numeric: tabular-nums; }')).toEqual([]);
  });

  for (const layout of OWN) {
    it(`${layout}: every rule is scoped under the root's two marks, with no literal colour, no font and no url`, () => {
      const text = css(layout);
      checkScope(text, layout);
      expect(text).not.toMatch(/#[0-9a-fA-F]{3,8}\b|\b(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color|color-mix)\s*\(/i);
      expect(namedColours(text), `${layout}: a named colour`).toEqual([]);
      expect(text).not.toMatch(/url\(|@font-face|@import|<\/style/i);
      expect(text.includes('\r')).toBe(false);
    });
  }
});

describe('review: the header card and the context tool', () => {
  const SPEC = '# A title\n\nSome words.\n\n## In short\n\nSummary.\n\n## 1. First\n\nText.\n\n## 2. Second\n\nText.\n\n## Where things stand\n\n### Waiting on you\n\n- A question.\n';

  it('moves the title block into one card, with the progress after it, and puts the card first', async () => {
    pick.layout = 'review';
    const root = mount(SPEC);
    await enhance(root);
    const card = root.querySelector('header.rv-card');
    expect(card).not.toBeNull();
    expect(root.querySelector(':scope > h1')).toBeNull();
    expect(card?.querySelector(':scope > h1')?.textContent).toBe('A title');
    expect(card?.querySelector(':scope > .review-strip')).not.toBeNull();
    expect(card?.lastElementChild?.classList.contains('rv-read')).toBe(true);
    expect(Array.from(root.children).find((c) => !c.hasAttribute('data-docreader-chrome') || c.matches('header'))).toBe(card);
  });

  it('counts the read marks from the marks feature\'s controls and follows them', async () => {
    pick.layout = 'review';
    const root = mount(SPEC);
    await enhance(root);
    const read = root.querySelector('.rv-read') as HTMLElement;
    const text = (): string => `${read.querySelector('.rv-n')?.textContent}${read.querySelector('.rv-of')?.textContent}`;
    expect(text()).toBe('0 of 3 read');
    const next = read.querySelector('button.rv-next') as HTMLButtonElement;
    expect(next.textContent).toBe('Start reading');
    (root.querySelector('h2[id="1-first"] button.h-mark') as HTMLElement).click();
    expect(text()).toBe('1 of 3 read');
    expect(next.textContent).toBe('Next unread: 2. Second');
    expect((read.querySelector('.rv-bar > i') as HTMLElement).style.width).toBe('33%');
    (root.querySelector('h2[id="2-second"] button.h-mark') as HTMLElement).click();
    expect(text()).toBe('2 of 3 read');
    expect(next.textContent).toBe('Next unread: Where things stand');
    (root.querySelector('h2[id="where-things-stand"] button.h-mark') as HTMLElement).click();
    expect(text()).toBe('3 of 3 read');
    expect(next.textContent).toBe('All read');
    expect(next.disabled).toBe(true);
  });

  it('adds a mark toggle to the bar\'s tray, disabled until a section is being read, and nothing without the bar', async () => {
    pick.layout = 'review';
    const root = mount(SPEC);
    await enhance(root);
    const tray = root.querySelector('.bar-tools') as HTMLElement;
    const toggle = tray.querySelector('button.rv-mark') as HTMLButtonElement;
    expect(tray.firstElementChild).toBe(toggle);
    expect(toggle.disabled).toBe(true);
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    const bare = mount(SPEC);
    await enhance(bare, { chrome: { bar: false } });
    expect(bare.querySelector('.rv-mark')).toBeNull();
    expect(bare.querySelector('header.rv-card')).not.toBeNull();
  });

  it('puts the toggle in the bar through the tray\'s slot, so a bar holding only the toggle is a labelled landmark', async () => {
    pick.layout = 'toggle-only';
    const root = mount(SPEC);
    await enhance(root);
    const bar = root.querySelector('nav.topbar') as HTMLElement;
    expect(bar.querySelectorAll('.bar-tools > *').length).toBe(1);
    expect(bar.querySelector('.bar-tools > button.rv-mark')).not.toBeNull();
    expect(bar.hasAttribute('role')).toBe(false);
    expect(bar.getAttribute('aria-label')).toBe('Document tools');
  });

  it('a document whose marks mark nothing gets the card without progress, and no toggle, rail addition or n key', async () => {
    pick.layout = 'review';
    const root = mount('# T\n\n## In short\n\n### a\n\nx\n\n### b\n\nx\n\n### c\n\nx\n\n### d\n\nx\n');
    await enhance(root);
    expect(root.querySelector('button.h-mark')).toBeNull();
    expect(root.querySelector('header.rv-card > h1')).not.toBeNull();
    expect(root.querySelector('.rv-read, .rv-mark, .rv-foot-read')).toBeNull();
    root.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', bubbles: true, cancelable: true }));
    expect(root.querySelector('.flash')).toBeNull();
  });

  it('binds n to the next unread section, listed on the keys sheet, and it follows the marks', async () => {
    pick.layout = 'review';
    const root = mount(SPEC);
    await enhance(root);
    const press = (key: string): void => void root.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    press('n');
    expect(root.querySelector('h2[id="1-first"]')?.classList.contains('flash')).toBe(true);
    (root.querySelector('h2[id="1-first"] button.h-mark') as HTMLElement).click();
    (root.querySelector('h2[id="1-first"]') as HTMLElement).classList.remove('flash');
    press('n');
    expect(root.querySelector('h2[id="2-second"]')?.classList.contains('flash')).toBe(true);
    for (const id of ['2-second', 'where-things-stand']) (root.querySelector(`h2[id="${id}"] button.h-mark`) as HTMLElement).click();
    root.querySelectorAll('.flash').forEach((e) => e.classList.remove('flash'));
    press('n');
    expect(root.querySelector('.flash')).toBeNull();
    press('?');
    expect(root.querySelector('.keys')?.textContent).not.toContain('Next unread section');
    (root.querySelector('h2[id="1-first"] button.h-mark') as HTMLElement).click();
    press('Escape');
    press('?');
    expect(root.querySelector('.keys')?.textContent).toContain('Next unread section');
  });

  it('adds a waiting link and a read count to the shared rail, and only what the page has', async () => {
    pick.layout = 'review';
    const root = mount(SPEC);
    await enhance(root);
    const link = root.querySelector('.toc-contents > a.rv-wait') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('#waiting-on-you');
    expect(link.textContent).toBe('Waiting on you1');
    expect(root.querySelector('.toc-contents')?.firstElementChild).toBe(link);
    const foot = root.querySelector('.toc-foot > .rv-foot-read') as HTMLElement;
    expect(foot.textContent).toBe('0 of 3 read');
    (root.querySelector('h2[id="1-first"] button.h-mark') as HTMLElement).click();
    expect(foot.textContent).toBe('1 of 3 read');
    const empty = mount(SPEC.replace('- A question.', 'Nothing yet.'));
    await enhance(empty);
    expect(empty.querySelector('.rv-wait')).toBeNull();
    const bare = mount('# A title\n\n## First\n\nText.\n\n## Second\n\nText.\n\n## Third\n\nText.\n');
    await enhance(bare);
    expect(bare.querySelector('.rv-wait')).toBeNull();
    expect(bare.querySelector('.rv-foot-read')?.textContent).toBe('0 of 3 read');
  });

  it('a source node classed eyebrow that is not the reader\'s chrome stays outside the card', async () => {
    pick.layout = 'review';
    const root = mount(SPEC);
    const own = document.createElement('div');
    own.className = 'eyebrow';
    root.prepend(own);
    await enhance(root);
    expect(own.parentElement).toBe(root);
    expect(root.querySelector('header.rv-card > .eyebrow')).toBeNull();
  });

  it('has direction B\'s features and none of the default\'s that direction B lacks (folds, the changes menu and stepper, the glossary, the attention lens, the settings menu)', async () => {
    const names = (await lists())['review']?.map((f) => f.name) ?? [];
    for (const lacked of ['folds', 'since', 'changes', 'glossary', 'attention', 'settings']) expect(names, lacked).not.toContain(lacked);
    for (const kept of ['rail', 'marks', 'ids', 'xrefs', 'cards', 'strip', 'jump', 'keysheet', 'review-header', 'review-rail', 'review-compact', 'review-context']) expect(names, kept).toContain(kept);
  });

  /** A document with one table of `rows` rows whose body rows are about `chars` characters each (three cells). */
  const TABLE = (rows: number, chars: number, extra = ''): string => {
    const cell = 'w'.repeat(Math.max(1, Math.floor((chars - 8) / 2)));
    const body = Array.from({ length: rows }, (_, i) => `| D${String(i + 1)} | ${cell} ${extra} | ${cell} |`).join('\n');
    return `${SPEC}\n## Table\n\n| ID | A | B |\n|---|---|---|\n${body}\n`;
  };

  it('clips the rows of a table of six or more rows averaging over 240 characters, and no other table', async () => {
    pick.layout = 'review';
    const root = mount(TABLE(6, 260));
    await enhance(root);
    const table = root.querySelector('.table-wrapper') as HTMLElement;
    expect(table.classList.contains('rv-compact')).toBe(true);
    expect(table.querySelectorAll('tbody td > .cc').length).toBe(18);
    expect(table.querySelectorAll('tbody td:first-child > button.rx[aria-expanded="false"]').length).toBe(6);
    expect(table.parentElement?.querySelector('.tbl-tools > button.rv-all')?.textContent).toBe('Open all rows');
    for (const [rows, chars] of [[5, 300], [6, 100], [6, 230]] as const) {
      const other = mount(TABLE(rows, chars));
      await enhance(other);
      expect(other.querySelector('.rv-compact, .cc, .rx, .rv-all'), `${String(rows)} rows of ${String(chars)}`).toBeNull();
    }
  });

  it('opens and closes a row with its button, and every row with Open all rows', async () => {
    pick.layout = 'review';
    const root = mount(TABLE(7, 260));
    await enhance(root);
    const rows = Array.from(root.querySelectorAll('tbody tr'));
    const button = rows[2]?.querySelector('button.rx') as HTMLButtonElement;
    button.click();
    expect(rows[2]?.classList.contains('rv-open')).toBe(true);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    button.click();
    expect(rows[2]?.classList.contains('rv-open')).toBe(false);
    const all = root.querySelector('button.rv-all') as HTMLButtonElement;
    all.click();
    expect(all.getAttribute('aria-pressed')).toBe('true');
    expect(rows.every((r) => r.classList.contains('rv-open') && r.querySelector('button.rx')?.getAttribute('aria-expanded') === 'true')).toBe(true);
    all.click();
    expect(all.getAttribute('aria-pressed')).toBe('false');
    expect(rows.some((r) => r.classList.contains('rv-open'))).toBe(false);
  });

  it('puts the buttons in the filter\'s tools on a table of twelve rows, and the filter still matches clipped text', async () => {
    pick.layout = 'review';
    const root = mount(TABLE(12, 260).replace(/\| D12 \| w+/, '$& zebra'));
    await enhance(root);
    const tools = root.querySelector('.tbl-tools') as HTMLElement;
    expect(tools.querySelector('input')).not.toBeNull();
    expect(tools.querySelector('button.rv-all')).not.toBeNull();
    expect(root.querySelectorAll('.tbl-tools').length).toBe(1);
    const input = tools.querySelector('input') as HTMLInputElement;
    input.value = 'zebra';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(root.querySelectorAll('tbody tr:not([hidden])').length).toBe(1);
  });

  it('wraps no empty cell, and gives every other cell its wrapper', async () => {
    pick.layout = 'review';
    const root = mount(TABLE(6, 320).replace(/\| D2 \| w+ +\| w+ \|/, '| D2 |  | www |'));
    await enhance(root);
    const row = root.querySelectorAll('tbody tr')[1] as HTMLElement;
    expect(row.querySelectorAll('td > .cc').length).toBe(2);
  });

  it('names the row button "row" when the first cell is empty', async () => {
    pick.layout = 'review';
    const root = mount(TABLE(6, 320).replace('| D1 |', '|  |'));
    await enhance(root);
    expect(root.querySelector('tbody tr button.rx')?.getAttribute('aria-label')).toBe('Open row row');
    expect(root.querySelectorAll('tbody tr')[1]?.querySelector('button.rx')?.getAttribute('aria-label')).toBe('Open row D2');
  });

  it('takes the compact rows off again at teardown, the document as it was', async () => {
    pick.layout = 'review';
    const root = mount(TABLE(7, 260));
    const before = root.outerHTML;
    await enhance(root);
    (root.querySelector('button.rx') as HTMLButtonElement).click();
    await destroyEnhancement(root);
    expect(root.outerHTML).toBe(before);
  });

  it('builds neither card nor tool for a page that is not a document', async () => {
    pick.layout = 'review';
    for (const markdown of ['Just a paragraph.\n', '# A title\n\nOne paragraph and no sections.\n']) {
      const root = mount(markdown);
      await enhance(root);
      expect(root.querySelector('.rv-card, .rv-read, .rv-mark, .rv-wait, .rv-foot-read'), markdown).toBeNull();
    }
  });
});

describe('review: the scrub scan', () => {
  const dir = path.join(ROOT, 'src', 'enhance', 'layouts', 'review');
  const files = [...readdirSync(dir).sort().map((n) => path.join(dir, n)), path.join(ROOT, 'assets', 'layouts', 'review.css')];

  it('its sources and its stylesheet hold none of the shapes of a private detail (an absolute home or mount path, a private host or address, an e-mail, a credential) and no URL', () => {
    expect(files.map((f) => path.relative(ROOT, f))).toEqual([
      'src/enhance/layouts/review/compact.ts', 'src/enhance/layouts/review/context.ts', 'src/enhance/layouts/review/features.ts', 'src/enhance/layouts/review/header.ts', 'src/enhance/layouts/review/rail.ts', 'assets/layouts/review.css',
    ]);
    for (const f of files) {
      const text = readFileSync(f, 'utf8');
      expect(findShapes(text), f).toEqual([]);
      expect(/[a-z][a-z0-9+.-]*:\/\//i.test(text), `${f} names a URL`).toBe(false);
    }
  });
});

// ───────── guided (docserver parity Task 13) ─────────

describe('guided: the hero, the layers, the reading tools and the times in Contents', () => {
  const WORDS = (n: number): string => Array.from({ length: n }, (_, i) => `word${String(i)}`).join(' ');
  const SPEC = [
    '# A title', '', 'Some words.', '',
    '## In short', '', 'Summary.', '',
    `## 1. First`, '', 'The opening paragraph says what this is.', '', 'The second paragraph says why.', '',
    'A third paragraph is already the rest.', '', '| a | b |', '|---|---|', '| 1 | 2 |', '',
    `## 2. Second`, '', 'Only a short paragraph.', '',
    `## 3. Third`, '', 'Opening words.', '', 'More opening words.', '', WORDS(340), '', '### Sub one', '', 'Text.', '', '### Sub two', '', 'Text.', '',
    '## Where things stand', '', '### Waiting on you', '', '- A question.', '- Another.', '',
  ].join('\n');
  const stored = (extra: Record<string, string> = {}): { storage: { snapshot: Record<string, string>; set: (k: string, v: string | null) => void }; storageKey: string; writes: Map<string, string | null> } => {
    const writes = new Map<string, string | null>();
    return { storage: { snapshot: extra, set: (k, v) => void writes.set(k, v) }, storageKey: 'doc', writes };
  };
  const FOLDS_KEY = 'docreader:doc:doc:folds';
  const hiddenOf = (root: HTMLElement): string[] => Array.from(root.querySelectorAll(':scope > [hidden="until-found"]')).map((e) => e.localName);

  it('moves the title block and the In short box into one header, with the glance after them', async () => {
    pick.layout = 'guided';
    const root = mount(SPEC);
    await enhance(root);
    const hero = root.querySelector('header.gd-hero') as HTMLElement;
    expect(root.querySelector(':scope > h1')).toBeNull();
    expect(hero.querySelector(':scope > h1')?.textContent).toBe('A title');
    expect(hero.querySelector(':scope > div.short h2')?.textContent).toBe('In short');
    const glance = hero.querySelector(':scope > .gd-glance') as HTMLElement;
    expect(hero.lastElementChild).toBe(glance);
    expect(Array.from(glance.children).map((c) => c.textContent)).toEqual(['In short1 min', 'Whole document2 min', 'Contains3 sections · 1 table', 'Waiting on you2 items →']);
    expect(glance.querySelector('a.gd-wait')?.getAttribute('href')).toBe('#waiting-on-you');
    expect(Array.from(root.children).find((c) => !c.hasAttribute('data-docreader-chrome') || c.matches('header'))).toBe(hero);
  });

  it('builds neither hero, layers nor tools for a page that is not a document, and no layers without folds', async () => {
    pick.layout = 'guided';
    for (const markdown of ['Just a paragraph.\n', '# A title\n\nOne paragraph and no sections.\n']) {
      const root = mount(markdown);
      await enhance(root);
      expect(root.querySelector('.gd-hero, .gd-bar, .gd-tools, .gd-glance'), markdown).toBeNull();
    }
    const root = mount(SPEC);
    await enhance(root, { folds: false });
    // No layers and no layer buttons, but the lens: it is the reader's, and needs no fold.
    expect(root.querySelector('.gd-bar, .gd-end-row, .gd-all')).toBeNull();
    expect(root.querySelector('.bar-tools .gd-tools .gd-seg')).not.toBeNull();
    expect(root.querySelector('header.gd-hero')).not.toBeNull();
  });

  it('keeps each section\'s heading, time and intro, folds the rest behind one button, and folds nothing it should not', async () => {
    pick.layout = 'guided';
    const s = stored({ 'docreader:ui': '{"layers":"guided"}' });
    const root = mount(SPEC);
    await enhance(root, { storage: s.storage, storageKey: s.storageKey });
    // First: two paragraphs are the intro; the third paragraph and the table fold. A time under a minute says nothing of it.
    const first = root.querySelector('h2[id="1-first"]') as HTMLElement;
    expect(first.nextElementSibling?.matches('.gd-meta')).toBe(true);
    expect(first.nextElementSibling?.textContent).toBe('1 table');
    const kids = Array.from(root.children);
    const at = kids.indexOf(first);
    const shape = (c: Element): string => `${c.localName}${c.matches('.gd-bar') ? '.bar' : ''}${c.hasAttribute('hidden') ? '!' : ''}`;
    expect(kids.slice(at + 1, at + 7).map(shape)).toEqual(['p', 'p', 'p', 'div.bar', 'p!', 'div!']);
    const btn = root.querySelector('h2[id="1-first"] ~ .gd-bar .gd-btn') as HTMLButtonElement;
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    expect(btn.querySelector('.gd-label')?.textContent).toBe('Read the whole section');
    expect(btn.querySelector('.gd-sum')?.textContent).toBe('1 table');
    // Second has nothing worth folding, and Where things stand is never folded.
    expect(root.querySelectorAll('.gd-bar').length).toBe(2);
    expect(root.querySelector('h2[id="where-things-stand"]')?.hasAttribute('hidden')).toBe(false);
    expect(root.querySelector('.callout')?.hasAttribute('hidden')).toBe(false);
    // Third: the intro is its one short paragraph and the long one; the subsections come as links.
    const third = root.querySelector('h2[id="3-third"] ~ .gd-bar') as HTMLElement;
    expect(third.querySelector('.gd-sum')?.textContent).toMatch(/^\d+ min more · 2 subsections$/);
    expect(Array.from(third.querySelectorAll('.gd-inside a')).map((a) => [a.textContent, a.getAttribute('href')])).toEqual([['Sub one', '#sub-one'], ['Sub two', '#sub-two']]);
    expect(hiddenOf(root).length).toBeGreaterThan(0);
  });

  it('opens and folds a section with its button, writes the folded sections behind, and the end button folds it and goes to the heading', async () => {
    pick.layout = 'guided';
    const s = stored({ 'docreader:ui': '{"layers":"full"}' });
    const root = mount(SPEC);
    await enhance(root, { storage: s.storage, storageKey: s.storageKey });
    expect(hiddenOf(root)).toEqual([]);
    const btn = root.querySelector('h2[id="1-first"] ~ .gd-bar .gd-btn') as HTMLButtonElement;
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    expect(btn.querySelector('.gd-label')?.textContent).toBe('Show less');
    expect(btn.getAttribute('aria-label')).toBe('Show less: First');
    btn.click();
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    expect(btn.getAttribute('aria-label')).toBe('Read the whole section: First');
    expect(s.writes.get(FOLDS_KEY)).toBe('["1-first"]');
    expect(hiddenOf(root)).toEqual(['p', 'div', 'div']);
    expect(root.querySelector('h2[id="1-first"] ~ .gd-bar')?.classList.contains('open')).toBe(false);
    btn.click();
    expect(s.writes.get(FOLDS_KEY)).toBe('[]');
    expect(hiddenOf(root)).toEqual([]);
    // The end button folds the section again and puts the heading back at the top.
    (root.querySelector('h2[id="1-first"] ~ .gd-end-row .gd-end') as HTMLButtonElement).click();
    expect(s.writes.get(FOLDS_KEY)).toBe('["1-first"]');
    expect(hiddenOf(root)).toEqual(['p', 'div', 'div']);
    expect(document.activeElement).toBe(btn);
  });

  it('expands and collapses every section from the bar, remembers the choice for a document with nothing remembered, and disables the button that would do nothing', async () => {
    pick.layout = 'guided';
    const s = stored({ 'docreader:ui': '{"layers":"full"}' });
    const root = mount(SPEC);
    await enhance(root, { storage: s.storage, storageKey: s.storageKey });
    const [expand, collapse] = Array.from(root.querySelectorAll('.bar-tools .gd-tools button.gd-all')) as HTMLButtonElement[];
    expect([expand?.textContent, expand?.disabled, collapse?.textContent, collapse?.disabled]).toEqual(['Expand all', true, 'Collapse all', false]);
    collapse?.click();
    expect(s.writes.get(FOLDS_KEY)).toBe('["1-first","3-third"]');
    expect(s.writes.get('docreader:ui')).toBe('{"layers":"guided"}');
    expect([expand?.disabled, collapse?.disabled]).toEqual([false, true]);
    expect(hiddenOf(root).length).toBeGreaterThan(2);
    expand?.click();
    expect(s.writes.get(FOLDS_KEY)).toBe('[]');
    expect(s.writes.get('docreader:ui')).toBe('{"layers":"full"}');
    expect(hiddenOf(root)).toEqual([]);
    expect([expand?.disabled, collapse?.disabled]).toEqual([true, false]);
  });

  it('decides a document with nothing remembered by its length: a short one opens in full, a long one guided, the reader\'s choice first, a stored list before both', async () => {
    pick.layout = 'guided';
    const long = SPEC.replace(WORDS(340), WORDS(3600));
    const state = async (md: string, extra: Record<string, string>): Promise<string[]> => {
      const root = mount(md);
      const s = stored(extra);
      await enhance(root, { storage: s.storage, storageKey: s.storageKey });
      return Array.from(root.querySelectorAll('.gd-btn')).map((b) => b.getAttribute('aria-expanded') as string);
    };
    expect(await state(SPEC, {})).toEqual(['true', 'true']);
    expect(await state(long, {})).toEqual(['false', 'false']);
    expect(await state(long, { 'docreader:ui': '{"layers":"full"}' })).toEqual(['true', 'true']);
    expect(await state(SPEC, { 'docreader:ui': '{"layers":"guided"}' })).toEqual(['false', 'false']);
    expect(await state(SPEC, { 'docreader:ui': '{"layers":"guided"}', 'docreader:doc:doc:folds': '["3-third"]' })).toEqual(['true', 'false']);
    expect(await state(long, { 'docreader:doc:doc:folds': '[]' })).toEqual(['true', 'true']);
  });

  it('opens the section a jump, a link inside the document or a find-in-page lands in', async () => {
    pick.layout = 'guided';
    const s = stored({ 'docreader:ui': '{"layers":"guided"}' });
    const root = mount(SPEC);
    await enhance(root, { storage: s.storage, storageKey: s.storageKey });
    const third = root.querySelector('h2[id="3-third"] ~ .gd-bar .gd-btn') as HTMLElement;
    expect(third.getAttribute('aria-expanded')).toBe('false');
    // A link: the Inside list's link goes to the subsection, which opens its section; the other stays folded.
    (root.querySelector('h2[id="3-third"] ~ .gd-bar .gd-inside a') as HTMLElement).click();
    expect(third.getAttribute('aria-expanded')).toBe('true');
    expect(root.querySelector('h2[id="1-first"] ~ .gd-bar .gd-btn')?.getAttribute('aria-expanded')).toBe('false');
    // A jump leaves the stored answer alone: the reader folded nothing.
    expect(s.writes.has(FOLDS_KEY)).toBe(false);
    // Find-in-page: the browser fires beforematch on the folded block it found a match in.
    const found = root.querySelector('h2[id="1-first"] ~ [hidden="until-found"]') as HTMLElement;
    found.dispatchEvent(new Event('beforematch', { bubbles: true }));
    expect(root.querySelector('h2[id="1-first"] ~ .gd-bar .gd-btn')?.getAttribute('aria-expanded')).toBe('true');
    expect(hiddenOf(root)).toEqual([]);
  });

  it('shows what the author hid as the author left it, and only unhides what the layout hid', async () => {
    pick.layout = 'guided';
    const s = stored({ 'docreader:ui': '{"layers":"guided"}' });
    const root = mount(SPEC);
    const table = root.querySelector('.table-wrapper') as HTMLElement;
    table.setAttribute('hidden', 'until-found');
    await enhance(root, { storage: s.storage, storageKey: s.storageKey });
    (root.querySelector('h2[id="1-first"] ~ .gd-bar .gd-btn') as HTMLElement).click();
    expect(table.getAttribute('hidden')).toBe('until-found');
    table.setAttribute('hidden', '');
    (root.querySelector('h2[id="1-first"] ~ .gd-bar .gd-btn') as HTMLElement).click();
    (root.querySelector('h2[id="1-first"] ~ .gd-bar .gd-btn') as HTMLElement).click();
    expect(table.getAttribute('hidden')).toBe('');
  });

  it('puts the lens in the bar, as the reader\'s own pref: Product quiets, Engineering is everything, and a peek bar made after joins a folded section', async () => {
    pick.layout = 'guided';
    const code = '```ts\nconst a = 1;\nconst b = 2;\nconst c = 3;\nconst d = 4;\nconst e = 5;\n```\n';
    const s = stored({ 'docreader:doc:doc:folds': '["1-first"]' });
    const root = mount(SPEC.replace('| a | b |', `${code}\n| a | b |`));
    await enhance(root, { storage: s.storage, storageKey: s.storageKey });
    const [product, engineering] = Array.from(root.querySelectorAll('.bar-tools .gd-seg button')) as HTMLButtonElement[];
    expect([product?.getAttribute('aria-pressed'), engineering?.getAttribute('aria-pressed')]).toEqual(['false', 'true']);
    expect(product?.title).toContain('quiets');
    expect(root.querySelector('.peek-bar')).toBeNull();
    product?.click();
    expect(root.classList.contains('lens-product')).toBe(true);
    expect([product?.getAttribute('aria-pressed'), engineering?.getAttribute('aria-pressed')]).toEqual(['true', 'false']);
    expect(root.querySelector('.peek-bar')?.getAttribute('hidden')).toBe('until-found');
    expect(s.writes.get('docreader:prefs')).toContain('"lens":"product"');
    engineering?.click();
    expect(root.classList.contains('lens-product')).toBe(false);
    expect([product?.getAttribute('aria-pressed'), engineering?.getAttribute('aria-pressed')]).toEqual(['false', 'true']);
  });

  it('adds a reading time to each Contents link of a section that takes a minute, and nothing to the others', async () => {
    pick.layout = 'guided';
    const root = mount(SPEC.replace(WORDS(340), WORDS(600)));
    await enhance(root);
    const times = Array.from(root.querySelectorAll('.doc-toc > ul > li > a')).map((a) => [a.getAttribute('href'), a.querySelector('.gd-rt')?.textContent ?? null]);
    expect(times).toEqual([['#in-short', null], ['#1-first', null], ['#2-second', null], ['#3-third', '3 min'], ['#where-things-stand', null]]);
    const bare = mount(SPEC);
    await enhance(bare, { chrome: { rail: false } });
    expect(bare.querySelector('.doc-toc, .gd-rt')).toBeNull();
  });

  it('puts the time and what a section holds under its heading, and leaves "Where things stand" and a plain short section as they are', async () => {
    pick.layout = 'guided';
    const root = mount(SPEC.replace(WORDS(340), WORDS(600)));
    await enhance(root);
    expect(root.querySelector('h2[id="3-third"] + .gd-meta')?.textContent).toBe('3 min read · 2 subsections');
    expect(root.querySelector('h2[id="2-second"] + .gd-meta')).toBeNull();
    expect(root.querySelector('h2[id="where-things-stand"] + .gd-meta')).toBeNull();
  });

  it('cuts an intro as the reference does: two paragraphs or about fifty words, an alert that opens the section, a colon line with its short list', async () => {
    const { introCount } = await import('../src/enhance/layouts/guided/layers.js');
    const el = (html: string): Element[] => Array.from(new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html').body.children);
    const p = (n: number): string => `<p>${WORDS(n)}</p>`;
    expect(introCount(el(`${p(5)}${p(5)}${p(5)}`))).toBe(2);
    expect(introCount(el(`${p(60)}${p(5)}`))).toBe(1);
    expect(introCount(el(`${p(5)}<pre>x</pre>${p(5)}`))).toBe(1);
    expect(introCount(el(`<pre>x</pre>${p(5)}`))).toBe(0);
    expect(introCount(el(`<div class="gh-alert"><p>x</p></div>${p(5)}${p(5)}${p(5)}`))).toBe(3);
    expect(introCount(el(`${p(5)}<div class="gh-alert"><p>x</p></div>`))).toBe(1);
    expect(introCount(el(`<p>These are:</p><ul><li>${WORDS(5)}</li></ul>${p(5)}`))).toBe(2);
    expect(introCount(el(`<p>These are:</p><ol><li>${WORDS(5)}</li></ol>${p(5)}`))).toBe(2);
    expect(introCount(el(`<p>These are:</p><ul><li>${WORDS(130)}</li></ul>${p(5)}`))).toBe(1);
    expect(introCount(el(`${p(5)}<p>These are:</p><ul><li>${WORDS(130)}</li></ul>`))).toBe(1);
    expect(introCount(el(`<p>These are:</p>${p(5)}`))).toBe(1);
    expect(introCount(el(`<p>These are:</p>`))).toBe(1);
    expect(introCount(el(`<p><img src="x"></p>${p(5)}`))).toBe(0);
    expect(introCount([])).toBe(0);
  });

  it('teardown puts everything back: the moved title block, the hidden blocks, the bars and the tools, the root as it was', async () => {
    pick.layout = 'guided';
    const s = stored({ 'docreader:ui': '{"layers":"guided"}' });
    const root = mount(SPEC);
    const before = root.outerHTML;
    await enhance(root, { storage: s.storage, storageKey: s.storageKey });
    (root.querySelector('.bar-tools .gd-seg button') as HTMLElement).click();
    expect(hiddenOf(root).length).toBeGreaterThan(0);
    await destroyEnhancement(root);
    expect(root.outerHTML).toBe(before);
  });

  it('a host that destroys the reader while the fold is written leaves the page as it was and throws nothing', async () => {
    pick.layout = 'guided';
    const root = mount(SPEC);
    await enhance(root, { storage: { snapshot: { 'docreader:ui': '{"layers":"full"}' }, set: (key) => { if (key === FOLDS_KEY) void destroyEnhancement(root); } }, storageKey: 'doc' });
    (root.querySelector('h2[id="1-first"] ~ .gd-bar .gd-btn') as HTMLElement).click();
    await Promise.resolve();
    expect(root.hasAttribute('data-docreader-root')).toBe(false);
    expect(root.querySelector('[hidden="until-found"]')).toBeNull();
  });

  /** A document whose section A has two short intro paragraphs and `detail` after them, then three plain sections. */
  const mini = (detail: string): string => `# T\n\n## A\n\nOne.\n\nTwo.\n\n${detail}\n\n## B\n\nx\n\n## C\n\nx\n\n## D\n\nx\n`;
  const barsOf = async (md: string, options: Parameters<typeof enhance>[1] = {}): Promise<{ root: HTMLElement; bars: number }> => {
    pick.layout = 'guided';
    const root = mount(md);
    await enhance(root, options);
    return { root, bars: root.querySelectorAll('.gd-bar').length };
  };

  it('folds what follows the intro only when it is worth a click: 300 words of prose, a figure, a table or code', async () => {
    expect((await barsOf(mini(WORDS(299)))).bars, '299 words').toBe(0);
    expect((await barsOf(mini(WORDS(300)))).bars, '300 words').toBe(1);
    expect((await barsOf(mini('```mermaid\ngraph TD; A-->B\n```'))).bars, 'a figure').toBe(1);
    expect((await barsOf(mini('| a | b |\n|---|---|\n| 1 | 2 |'))).bars, 'a table').toBe(1);
    expect((await barsOf(mini('```ts\nconst a = 1;\n```'))).bars, 'code').toBe(1);
    expect((await barsOf(mini('A short paragraph.'))).bars, 'a short paragraph').toBe(0);
  });

  it('puts a time and what a section holds under its heading only when it takes a minute or holds a figure or a table', async () => {
    const meta = async (md: string): Promise<string | null> => (await barsOf(md)).root.querySelector('h2[id="a"] + .gd-meta')?.textContent ?? null;
    expect(await meta(mini(WORDS(100)))).toBeNull();
    expect(await meta(mini(WORDS(230)))).toBe('1 min read');
    expect(await meta(mini('```mermaid\ngraph TD; A-->B\n```'))).toBe('1 figure');
    expect(await meta(mini('| a | b |\n|---|---|\n| 1 | 2 |'))).toBe('1 table');
    expect(await meta(mini(`${WORDS(230)}\n\n### H\n\nx`))).toBe('1 min read · 1 subsection');
  });

  it('lists the subsections of a folded section as links, six at most, and none for one', async () => {
    const subs = (n: number): string => Array.from({ length: n }, (_, i) => `### H${String(i)}\n\nx`).join('\n\n');
    const seven = (await barsOf(mini(`${WORDS(300)}\n\n${subs(7)}`))).root.querySelector('.gd-inside') as HTMLElement;
    expect(Array.from(seven.querySelectorAll('a')).map((a) => a.textContent)).toEqual(['H0', 'H1', 'H2', 'H3', 'H4', 'H5']);
    expect(seven.querySelector('.gd-inside-more')?.textContent).toBe('+1 more');
    expect(seven.getAttribute('aria-label')).toBe('In A');
    const six = (await barsOf(mini(`${WORDS(300)}\n\n${subs(6)}`))).root.querySelector('.gd-inside') as HTMLElement;
    expect(six.querySelectorAll('a').length).toBe(6);
    expect(six.querySelector('.gd-inside-more')).toBeNull();
    expect((await barsOf(mini(`${WORDS(300)}\n\n${subs(1)}`))).root.querySelector('.gd-inside')).toBeNull();
  });

  it('never folds "Where things stand", whatever it holds, and tolerates a heading with no id', async () => {
    const stand = `# T\n\n## A\n\nx\n\n## B\n\nx\n\n## Where things stand\n\nOne.\n\nTwo.\n\n${WORDS(400)}\n`;
    expect((await barsOf(stand)).bars).toBe(0);
    pick.layout = 'guided';
    const root = mount(mini(WORDS(300)));
    const bare = document.createElement('h2');
    bare.textContent = 'No id';
    const long = document.createElement('p');
    long.textContent = WORDS(400);
    root.append(bare, long);
    await enhance(root);
    expect(root.querySelectorAll('.gd-bar').length).toBe(1);
  });

  it('decides a document of a few minutes by its length: open in full, as the reference does under fifteen', async () => {
    const mid = mini(Array.from({ length: 8 }, () => WORDS(230)).join('\n\n'));
    const { root } = await barsOf(mid);
    expect(root.querySelector('.gd-btn')?.getAttribute('aria-expanded')).toBe('true');
  });

  it('shows what a host or the author set on a block the layout hid as it was set, when the section opens', async () => {
    pick.layout = 'guided';
    const s = stored({ 'docreader:ui': '{"layers":"guided"}' });
    const root = mount(SPEC);
    await enhance(root, { storage: s.storage, storageKey: s.storageKey });
    const block = root.querySelector('h2[id="1-first"] ~ [hidden="until-found"]') as HTMLElement;
    block.setAttribute('hidden', '');
    (root.querySelector('h2[id="1-first"] ~ .gd-bar .gd-btn') as HTMLElement).click();
    expect(block.getAttribute('hidden')).toBe('');
  });

  it('shows what is folded while the page prints, and folds it again after, leaving what a host set on a block as it was set', async () => {
    pick.layout = 'guided';
    const s = stored({ 'docreader:ui': '{"layers":"guided"}' });
    const root = mount(SPEC);
    await enhance(root, { storage: s.storage, storageKey: s.storageKey });
    const view = root.ownerDocument.defaultView as Window;
    const folded = hiddenOf(root).length;
    expect(folded).toBeGreaterThan(0);
    view.dispatchEvent(new Event('beforeprint'));
    expect(hiddenOf(root)).toEqual([]);
    view.dispatchEvent(new Event('afterprint'));
    expect(hiddenOf(root).length).toBe(folded);
    const block = root.querySelector('h2[id="1-first"] ~ [hidden="until-found"]') as HTMLElement;
    block.setAttribute('hidden', '');
    view.dispatchEvent(new Event('beforeprint'));
    expect(block.getAttribute('hidden')).toBe('');
  });

  it('does nothing for a find or a jump that lands on a block it did not hide', async () => {
    pick.layout = 'guided';
    const s = stored({ 'docreader:ui': '{"layers":"guided"}' });
    const root = mount(SPEC);
    await enhance(root, { storage: s.storage, storageKey: s.storageKey });
    const before = hiddenOf(root).length;
    expect(before).toBeGreaterThan(0);
    // A handler that throws is reported as an error event of the window: none comes.
    const errors: unknown[] = [];
    const onError = (e: ErrorEvent): void => {
      errors.push(e.error);
      e.preventDefault();
    };
    window.addEventListener('error', onError);
    root.querySelector('h2[id="1-first"] + .gd-meta + p')?.dispatchEvent(new Event('beforematch', { bubbles: true }));
    (root.querySelector('.doc-toc a[href="#where-things-stand"]') as HTMLElement).click();
    window.removeEventListener('error', onError);
    expect(errors).toEqual([]);
    expect(hiddenOf(root).length).toBe(before);
    expect(root.querySelector('h2[id="1-first"] ~ .gd-bar .gd-btn')?.getAttribute('aria-expanded')).toBe('false');
  });

  it('puts the hero\'s parts together: the eyebrow and the facts panel move in, a source node classed eyebrow stays out', async () => {
    pick.layout = 'guided';
    const root = mount(SPEC);
    const own = document.createElement('div');
    own.className = 'eyebrow';
    root.prepend(own);
    await enhance(root, { info: { frontList: [{ key: 'type', list: false, vals: ['Spec'] }, { key: 'tags', list: true, vals: ['a', 'b'] }] } });
    const hero = root.querySelector('header.gd-hero') as HTMLElement;
    expect(hero.querySelector(':scope > .eyebrow + h1')).not.toBeNull();
    expect(hero.querySelector(':scope > details.doc-facts')).not.toBeNull();
    expect(own.parentElement).toBe(root);
    expect(hero.querySelector(':scope > .eyebrow:not([data-docreader-chrome])')).toBeNull();
  });

  it('leaves outside the hero a node of the document right before the title that is only half the eyebrow: classed eyebrow, or claiming to be chrome', async () => {
    pick.layout = 'guided';
    for (const make of [
      (n: HTMLElement): void => void (n.className = 'eyebrow'),
      (n: HTMLElement): void => n.setAttribute('data-docreader-chrome', ''),
    ]) {
      const root = mount(SPEC);
      const node = document.createElement('div');
      make(node);
      (root.querySelector('h1') as HTMLElement).before(node);
      await enhance(root);
      expect(node.parentElement, node.outerHTML).toBe(root);
      expect(root.querySelector('header.gd-hero')?.contains(node)).toBe(false);
      expect(root.querySelector('header.gd-hero > h1')).not.toBeNull();
    }
  });

  it('takes In short into the hero when it is within three blocks of the title block, and leaves it where it is when it is later', async () => {
    pick.layout = 'guided';
    const near = mount(`# T\n\nOne.\n\nTwo.\n\n${SPEC.slice(SPEC.indexOf('## In short'))}`);
    await enhance(near);
    expect(near.querySelector('header.gd-hero > .short')).not.toBeNull();
    const far = mount(`# T\n\nOne.\n\nTwo.\n\nThree.\n\n${SPEC.slice(SPEC.indexOf('## In short'))}`);
    await enhance(far);
    expect(far.querySelector('header.gd-hero > .short')).toBeNull();
    expect(far.querySelector(':scope > .short')).not.toBeNull();
    expect(Array.from(far.querySelectorAll('.gd-glance .gd-gk'), (k) => k.textContent)).toEqual(['Whole document', 'Contains', 'Waiting on you']);
  });

  it('ends a section at the next section and at a box that holds one: folding the section before In short leaves In short and the next section shown', async () => {
    pick.layout = 'guided';
    const s = stored({ 'docreader:ui': '{"layers":"guided"}' });
    const root = mount(`# T\n\n## A\n\nOne.\n\nTwo.\n\n${WORDS(300)}\n\n## In short\n\nSum.\n\n## B\n\nx\n\n## C\n\nx\n`);
    await enhance(root, { storage: s.storage, storageKey: s.storageKey });
    expect(root.querySelectorAll('.gd-bar').length).toBe(1);
    expect(hiddenOf(root)).toEqual(['p', 'div']);
    expect(root.querySelector(':scope > .short')?.hasAttribute('hidden')).toBe(false);
    expect(root.querySelector('h2[id="b"]')?.hasAttribute('hidden')).toBe(false);
  });

  it('builds the hero for a document whose title comes after its sections, with nothing after it to take in', async () => {
    pick.layout = 'guided';
    const root = mount('## A\n\nx\n\n## B\n\nx\n\n## C\n\nx\n\n# T\n');
    await enhance(root);
    expect(root.querySelector('header.gd-hero > h1')?.textContent).toBe('T');
    expect(root.querySelector('header.gd-hero > .short')).toBeNull();
  });

  it('builds the hero with no bar, and the layers with no bar: no skip link, no tools, the folds still work', async () => {
    pick.layout = 'guided';
    const root = mount(SPEC);
    await enhance(root, { chrome: { bar: false }, storage: stored({ 'docreader:ui': '{"layers":"guided"}' }).storage, storageKey: 'doc' });
    expect(root.querySelector('header.gd-hero')).not.toBeNull();
    expect(root.querySelector('.gd-tools, .skip-link')).toBeNull();
    expect(root.querySelectorAll('.gd-bar').length).toBe(2);
    (root.querySelector('h2[id="1-first"] ~ .gd-bar .gd-btn') as HTMLElement).click();
    expect(root.querySelector('h2[id="1-first"] ~ .gd-bar .gd-btn')?.getAttribute('aria-expanded')).toBe('true');
  });

  it('gives a document with nothing to count or wait for a glance of its time alone, and a document with nothing to fold the lens alone', async () => {
    pick.layout = 'guided';
    const bare = mount('# T\n\n## Where things stand\n\n### a\n\nx\n\n### b\n\nx\n\n### c\n\nx\n\n### d\n\nx\n');
    await enhance(bare);
    expect(bare.querySelector('header.gd-hero')).not.toBeNull();
    // Nothing to count and no waiting box: the glance holds the document's time and nothing else.
    expect(Array.from(bare.querySelectorAll('.gd-glance .gd-gk'), (k) => k.textContent)).toEqual(['Whole document']);
    const plain = mount(mini('A short paragraph.'));
    await enhance(plain);
    expect(plain.querySelector('.bar-tools .gd-tools .gd-seg')).not.toBeNull();
    expect(plain.querySelector('.gd-tools .gd-all')).toBeNull();
  });

  it('shows no waiting link in the glance when the waiting box holds no list: there is nothing to count', async () => {
    pick.layout = 'guided';
    const root = mount('# T\n\n## A\n\nx\n\n## B\n\nx\n\n## Where things stand\n\n### Waiting on you\n\nNothing yet.\n');
    await enhance(root);
    expect(root.querySelector('.callout.waiting')).not.toBeNull();
    expect(root.querySelector('.gd-wait')).toBeNull();
  });

  it('keeps the lens buttons in step with a lens a host sets', async () => {
    pick.layout = 'guided';
    const root = mount(SPEC);
    await enhance(root);
    const [product, engineering] = Array.from(root.querySelectorAll('.gd-seg button')) as HTMLButtonElement[];
    setEnhancementPrefs(root, { lens: 'product' });
    expect([product?.getAttribute('aria-pressed'), engineering?.getAttribute('aria-pressed')]).toEqual(['true', 'false']);
  });

  it('adds no time to a Contents link whose heading is not a section of the document', async () => {
    pick.layout = 'guided';
    const root = mount(SPEC.replace(WORDS(340), WORDS(600)));
    const nested = document.createElement('h2');
    nested.id = 'nested';
    nested.textContent = 'Nested';
    const quote = document.createElement('blockquote');
    quote.append(nested);
    root.insertBefore(quote, root.querySelector('h2[id="3-third"]'));
    await enhance(root);
    const link = root.querySelector('.doc-toc a[href="#nested"]') as HTMLElement;
    expect(link).not.toBeNull();
    expect(link.querySelector('.gd-rt')).toBeNull();
    expect(root.querySelector('.doc-toc a[href="#3-third"] .gd-rt')?.textContent).toBe('3 min');
  });

  it('folds the last section without touching what other steps put at the root\'s end: the quick jump, the Contents\' scrim, a card, an overlay', async () => {
    pick.layout = 'guided';
    const s = stored({ 'docreader:ui': '{"layers":"guided"}' });
    const tail = `# T\n\n## A\n\nx\n\n## B\n\nx\n\n## B2\n\nx\n\n## B3\n\nx\n\n## B4\n\nx\n\n## C\n\nOne.\n\nTwo.\n\n${WORDS(400)}\n`;
    const root = mount(tail);
    await enhance(root, { storage: s.storage, storageKey: s.storageKey });
    const claimed = (): string[] => Array.from(root.querySelectorAll(':scope > [hidden="until-found"]')).filter((e) => e.hasAttribute('data-docreader-chrome') && !e.classList.contains('gd-end-row')).map((e) => e.className);
    expect(root.querySelector(':scope > div > .jump')).not.toBeNull();
    expect(hiddenOf(root).length).toBeGreaterThan(0);
    // The lens repaints every layer, a fold repaints every layer: neither reaches what is after the last section.
    (root.querySelector('.bar-tools .gd-seg button') as HTMLElement).click();
    expect(claimed()).toEqual([]);
    (root.querySelector('h2[id="c"] ~ .gd-bar .gd-btn') as HTMLElement).click();
    (root.querySelector('h2[id="c"] ~ .gd-bar .gd-btn') as HTMLElement).click();
    expect(claimed()).toEqual([]);
    const kids = Array.from(root.children);
    const scrim = root.querySelector(':scope > .toc-scrim') as HTMLElement;
    expect(scrim.getAttribute('hidden')).not.toBe('until-found');
    expect(kids.indexOf(root.querySelector('.gd-end-row') as Element)).toBeLessThan(kids.indexOf(scrim));
  });

  it('writes the folds behind only for the reader\'s own act, and keeps what it does not own: the default layout\'s ids stay in every write', async () => {
    pick.layout = 'guided';
    const long = SPEC.replace(WORDS(340), WORDS(3600));
    // Nothing remembered: a jump into a folded section opens it and writes nothing, and a find does the same.
    const a = stored();
    const rootA = mount(long);
    await enhance(rootA, { storage: a.storage, storageKey: a.storageKey });
    expect(rootA.querySelector('h2[id="3-third"] ~ .gd-bar .gd-btn')?.getAttribute('aria-expanded')).toBe('false');
    (rootA.querySelector('h2[id="3-third"] ~ .gd-bar .gd-inside a') as HTMLElement).click();
    expect(rootA.querySelector('h2[id="3-third"] ~ .gd-bar .gd-btn')?.getAttribute('aria-expanded')).toBe('true');
    expect(a.writes.has(FOLDS_KEY)).toBe(false);
    (rootA.querySelector('h2[id="1-first"] ~ [hidden="until-found"]') as HTMLElement).dispatchEvent(new Event('beforematch', { bubbles: true }));
    expect(a.writes.has(FOLDS_KEY)).toBe(false);
    // The reader's own fold writes, with the id the default layout folded and guided has no layer for.
    await destroyEnhancement(rootA);
    rootA.remove();
    const b = stored({ 'docreader:doc:doc:folds': '["where-things-stand","3-third"]' });
    const rootB = mount(SPEC);
    await enhance(rootB, { storage: b.storage, storageKey: b.storageKey });
    (rootB.querySelector('h2[id="1-first"] ~ .gd-bar .gd-btn') as HTMLElement).click();
    expect(b.writes.get(FOLDS_KEY)).toBe('["where-things-stand","1-first","3-third"]');
    (rootB.querySelector('h2[id="3-third"] ~ .gd-bar .gd-btn') as HTMLElement).click();
    expect(b.writes.get(FOLDS_KEY)).toBe('["where-things-stand","1-first"]');
  });

  it('times a section under the lens: code at 520 words a minute under Engineering and 2000 under Product, in the Contents, the time line, the fold and the glance', async () => {
    pick.layout = 'guided';
    const root = mount(mini(`\`\`\`ts\n${WORDS(2000)}\n\`\`\``));
    await enhance(root);
    const times = (): string[] => [
      root.querySelector('.doc-toc a[href="#a"] .gd-rt')?.textContent ?? '',
      root.querySelector('h2[id="a"] + .gd-meta')?.textContent ?? '',
      root.querySelector('.gd-sum')?.textContent ?? '',
      root.querySelector('.gd-glance .gd-gl:last-child, .gd-glance .gd-gl')?.textContent ?? '',
    ];
    expect(times()).toEqual(['4 min', '4 min read · code', '4 min more · code', 'Whole document4 min']);
    setEnhancementPrefs(root, { lens: 'product' });
    expect(times()).toEqual(['1 min', '1 min read · code', '1 min more · code', 'Whole document1 min']);
    setEnhancementPrefs(root, { lens: 'all' });
    expect(times()[0]).toBe('4 min');
  });

  it('quietens technical prose: a paragraph or item of more than sixty characters that is over a third code, outside tables, In short and figures', async () => {
    pick.layout = 'guided';
    const tech = 'Run `aaa bbb ccc ddd` and `eee fff ggg` then `hhh iii` today ok, thanks.';
    const root = mount(`# T\n\n## In short\n\n${tech}\n\n## A\n\n${tech}\n\nA plain paragraph of prose with a few words of code, \`x\`, and nothing else to say here.\n\nUse \`a b c\` and \`d e f\`.\n\n- ${tech}\n- Outer item\n  - ${tech}\n\n| a |\n|---|\n| ${tech} |\n\n## B\n\nx\n\n## C\n\nx\n`);
    await enhance(root);
    const marked = Array.from(root.querySelectorAll('.tech-text'), (e) => `${e.localName}${e.closest('.short') !== null ? ' short' : ''}`);
    expect(marked).toEqual(['p', 'li', 'li']);
  });

  it('keeps the peek bars the lens made before the layers: a section ending in a long code block, Product stored at load, folds with its bar and its end row after it', async () => {
    pick.layout = 'guided';
    const s = stored({ 'docreader:ui': '{"layers":"guided"}', 'docreader:prefs': '{"lens":"product"}' });
    const code = '```ts\nconst a = 1;\nconst b = 2;\nconst c = 3;\nconst d = 4;\nconst e = 5;\n```';
    const root = mount(mini(`${WORDS(300)}\n\n${code}`));
    await enhance(root, { storage: s.storage, storageKey: s.storageKey });
    const bars = Array.from(root.querySelectorAll('.peek-bar'));
    expect(bars.length).toBe(1);
    expect(bars[0]?.getAttribute('hidden')).toBe('until-found');
    expect(bars[0]?.nextElementSibling?.classList.contains('gd-end-row')).toBe(true);
    // The same at the end of the document.
    const last = mount(`# T\n\n## A\n\nx\n\n## B\n\nx\n\n## C\n\nx\n\n## D\n\nOne.\n\nTwo.\n\n${WORDS(300)}\n\n${code}\n`);
    await enhance(last, { storage: s.storage, storageKey: s.storageKey });
    const tail = last.querySelector('.peek-bar') as HTMLElement;
    expect(tail.getAttribute('hidden')).toBe('until-found');
    expect(tail.nextElementSibling?.classList.contains('gd-end-row')).toBe(true);
  });

  it('keeps a rule that ends a section as a member: a section ending in a thematic break folds it too', async () => {
    pick.layout = 'guided';
    const s = stored({ 'docreader:ui': '{"layers":"guided"}' });
    const root = mount(`# T\n\n## A\n\nx\n\n## B\n\nx\n\n## C\n\nx\n\n## D\n\nOne.\n\nTwo.\n\n${WORDS(300)}\n\n---\n`);
    await enhance(root, { storage: s.storage, storageKey: s.storageKey });
    expect(root.querySelector('hr')?.getAttribute('hidden')).toBe('until-found');
  });

  it('counts the title and what comes before the first section in the whole document\'s time, as the byline does', async () => {
    pick.layout = 'guided';
    const root = mount(`# T\n\n${WORDS(460)}\n\n## A\n\nx\n\n## B\n\nx\n\n## C\n\nx\n`);
    await enhance(root);
    expect(root.querySelector('.gd-glance .gd-gl')?.textContent).toBe('Whole document2 min');
  });

  it('leaves the reader\'s own chrome out of the whole document\'s time: a long eyebrow is not reading', async () => {
    pick.layout = 'guided';
    const root = mount('# T\n\n## A\n\nx\n\n## B\n\nx\n\n## C\n\nx\n');
    await enhance(root, { info: { frontList: [{ key: 'type', list: false, vals: [WORDS(460)] }] } });
    expect(root.querySelector('.eyebrow')).not.toBeNull();
    expect(root.querySelector('.gd-glance .gd-gl')?.textContent).toBe('Whole document1 min');
  });

  it('skips a code block in a list item\'s own text', async () => {
    pick.layout = 'guided';
    const root = mount(`# T\n\n## A\n\n- An item with some words of its own\n\n  \`\`\`ts\n  ${WORDS(80)}\n  \`\`\`\n\n## B\n\nx\n\n## C\n\nx\n`);
    await enhance(root);
    expect(root.querySelector('.tech-text')).toBeNull();
  });

  describe('the shared folds field, read in each direction (ccrc D-8881)', () => {
    const HOSTILE = ['null', '7', '"text"', '{"a":1}', '[5,null,{"x":1},["n"],"1-first","no-such-section"]', '[]', '[["1-first"]]'];
    const read = async (layout: string, value: string): Promise<{ folded: string[]; writes: Map<string, string | null> }> => {
      pick.layout = layout;
      const s = stored({ 'docreader:doc:doc:folds': value, 'docreader:ui': '{"layers":"full"}' });
      const root = mount(SPEC);
      await enhance(root, { storage: s.storage, storageKey: s.storageKey });
      const folded = layout === 'guided'
        ? Array.from(root.querySelectorAll('.gd-btn[aria-expanded="false"]'), (b) => (b.getAttribute('aria-label') ?? '').replace(/^.*: /, ''))
        : Array.from(root.querySelectorAll('h2.folded'), (h) => h.getAttribute('aria-label') ?? '');
      return { folded, writes: s.writes };
    };
    it('guided reads whatever the default layout (or anything) wrote: no throw, unknown entries ignored, nothing written by the read', async () => {
      for (const value of HOSTILE) {
        const got = await read('guided', value);
        expect(got.writes.size, value).toBe(0);
        const known = value.includes('"1-first"') && value.startsWith('[5');
        expect(got.folded, value).toEqual(known ? ['First'] : []);
      }
    });
    it('the default layout reads whatever guided wrote (its own ids, foreign ids, non-strings): no throw, unknown entries ignored, nothing written by the read', async () => {
      for (const value of [...HOSTILE, '["1-first","guided-only-id"]']) {
        const got = await read('default', value);
        expect(got.writes.size, value).toBe(0);
        expect(got.folded, value).toEqual(value.includes('"1-first"') && !value.startsWith('[[') ? ['1. First'] : []);
      }
    });
    it('a null value reads as unvisited, which is what the default layout leaves when nothing is folded: a long document gets guided\'s first-visit layers, a short one opens in full', async () => {
      pick.layout = 'guided';
      const state = async (md: string, extra: Record<string, string>): Promise<string[]> => {
        const s = stored({ 'docreader:doc:doc:folds': 'null', ...extra });
        const root = mount(md);
        await enhance(root, { storage: s.storage, storageKey: s.storageKey });
        expect(s.writes.size).toBe(0);
        return Array.from(root.querySelectorAll('.gd-btn'), (b) => b.getAttribute('aria-expanded') as string);
      };
      expect(await state(SPEC.replace(WORDS(340), WORDS(3600)), {})).toEqual(['false', 'false']);
      expect(await state(SPEC, {})).toEqual(['true', 'true']);
      expect(await state(SPEC, { 'docreader:ui': '{"layers":"guided"}' })).toEqual(['false', 'false']);
    });
    it('the default layout\'s own fold writes only the ids it owns: an id only guided has a layer for is dropped (a known effect of the shared field)', async () => {
      pick.layout = 'default';
      const s = stored({ 'docreader:doc:doc:folds': '["3-third","gone"]' });
      const root = mount(SPEC);
      await enhance(root, { storage: s.storage, storageKey: s.storageKey });
      (root.querySelector('h2[id="1-first"] .h-fold') as HTMLElement).click();
      expect(JSON.parse(s.writes.get(FOLDS_KEY) as string)).toEqual(['1-first', '3-third']);
    });
  });

  it('has direction C\'s features and none of the default\'s that direction C lacks (the Index tab, IDs and their previews, the strip, marks, changes, the keys sheet, the settings menu)', async () => {
    const names = (await lists())['guided']?.map((f) => f.name) ?? [];
    for (const lacked of ['rail', 'ids', 'xrefs', 'rules', 'plans', 'strip', 'marks', 'changes', 'since', 'keysheet', 'settings', 'folds']) expect(names, lacked).not.toContain(lacked);
    for (const kept of ['editorial', 'tables', 'status', 'code', 'figures', 'glossary', 'attention', 'cards', 'jump', 'diagrams', 'guided-contents', 'guided-hero', 'guided-layers', 'guided-reveal']) expect(names, kept).toContain(kept);
  });
});

describe('guided: the scrub scan', () => {
  const dir = path.join(ROOT, 'src', 'enhance', 'layouts', 'guided');
  const files = [...readdirSync(dir).sort().map((n) => path.join(dir, n)), path.join(ROOT, 'assets', 'layouts', 'guided.css')];

  it('its sources and its stylesheet hold none of the shapes of a private detail (an absolute home or mount path, a private host or address, an e-mail, a credential) and no URL', () => {
    expect(files.map((f) => path.relative(ROOT, f))).toEqual([
      'src/enhance/layouts/guided/contents.ts', 'src/enhance/layouts/guided/features.ts', 'src/enhance/layouts/guided/hero.ts', 'src/enhance/layouts/guided/layers.ts', 'src/enhance/layouts/guided/sections.ts', 'src/enhance/layouts/guided/tech.ts', 'src/enhance/layouts/guided/times.ts', 'assets/layouts/guided.css',
    ]);
    for (const f of files) {
      const text = readFileSync(f, 'utf8');
      expect(findShapes(text), f).toEqual([]);
      expect(/[a-z][a-z0-9+.-]*:\/\//i.test(text), `${f} names a URL`).toBe(false);
    }
  });
});
