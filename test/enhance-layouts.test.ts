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
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { destroyEnhancement, enhance, runEnhancementCommand } from '../src/enhance/index.js';
import type { Feature } from '../src/enhance/features.js';
import { features as defaultFeatures } from '../src/enhance/features.js';
import { FRAME_LAYOUTS } from '../src/frame/layouts.js';
import { render } from '../src/render/index.js';

const OWN = FRAME_LAYOUTS.filter((l) => l !== 'default');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const pick = vi.hoisted(() => ({ layout: 'default' }));

vi.mock('../src/enhance/features.js', async (importOriginal) => {
  const real = await importOriginal<typeof import('../src/enhance/features.js')>();
  const lists = {
    classic: (await import('../src/enhance/layouts/classic/features.js')).features,
    editorial: (await import('../src/enhance/layouts/editorial/features.js')).features,
    review: (await import('../src/enhance/layouts/review/features.js')).features,
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
  };
}

describe('the layouts\' feature lists', () => {
  it('each is frozen and made fresh by every call, as the default list is', async () => {
    const mods = {
      classic: await import('../src/enhance/layouts/classic/features.js'),
      editorial: await import('../src/enhance/layouts/editorial/features.js'),
      review: await import('../src/enhance/layouts/review/features.js'),
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

  for (const layout of OWN) {
    it(`${layout}: every rule is scoped under the root's two marks, with no literal colour, no font and no url`, () => {
      const text = css(layout);
      checkScope(text, layout);
      expect(text).not.toMatch(/#[0-9a-fA-F]{3,8}\b|\b(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color|color-mix)\s*\(/i);
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

  it('builds neither card nor tool for a page that is not a document', async () => {
    pick.layout = 'review';
    const root = mount('Just a paragraph.\n');
    await enhance(root);
    expect(root.querySelector('.rv-card, .rv-read, .rv-mark')).toBeNull();
  });
});
