// @vitest-environment jsdom
// The layouts' feature lists (docserver parity Task 9; plan Design B11): each non-default layout is the reader with its own
// feature list (src/enhance/layouts/<name>/features.ts), which scripts/build-frame.mjs substitutes for the lifecycle's own at
// build time. Here the lifecycle runs in jsdom with each list in turn (the module the lifecycle imports is mocked to hand out the
// layout's `features()`), so the lists are proved without a build or a browser:
//   - each list is frozen, made fresh by a call, and distinct: no two layouts, and none of them and the default, hold the same
//     feature names in the same order, and every feature name of a layout is a name of the default list (shared modules only);
//   - the layout mark comes first in every non-default list and is in no other, and the default list holds none;
//   - a layout's root is marked `data-docreader-layout="<name>"` once it is enhanced, beside the shared `data-docreader-root`,
//     and teardown (the journal's undo) takes the mark off again, the document as it was; the default layout's root is never
//     marked;
//   - the layout's stylesheet scopes every rule under the root's two marks, holds no literal colour and no font of its own.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { destroyEnhancement, enhance } from '../src/enhance/index.js';
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
    guided: (await import('../src/enhance/layouts/guided/features.js')).features,
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

  it('hold only features of the shared list (imported, never copied): every name is a name of the default list, or the layout mark, and builds with the very function the default list builds with', async () => {
    const all = await lists();
    const shared = new Map(defaultFeatures().map((f) => [f.name, f]));
    for (const layout of OWN) {
      for (const f of all[layout] ?? []) {
        if (f.name === 'layout-mark') continue;
        const s = shared.get(f.name);
        expect(s, `${layout}: ${f.name} is not a shared feature`).toBeDefined();
        expect(f.build, `${layout}: ${f.name} builds with its own function`).toBe(s?.build);
        expect(f.after, `${layout}: ${f.name}'s second phase`).toBe(s?.after);
      }
    }
  });

  it('keep the shared order: the features of a layout, less the mark, are a subsequence of the default list', async () => {
    const all = await lists();
    const order = defaultFeatures().map((f) => f.name);
    for (const layout of OWN) {
      const names = (all[layout] ?? []).filter((f) => f.name !== 'layout-mark').map((f) => f.name);
      const at = names.map((n) => order.indexOf(n));
      expect(at.every((i) => i >= 0), layout).toBe(true);
      expect([...at].sort((a, b) => a - b), layout).toEqual(at);
    }
  });

  it('put the layout mark first in every non-default list, once, and none in the default list', async () => {
    const all = await lists();
    for (const layout of OWN) {
      const names = (all[layout] ?? []).map((f) => f.name);
      expect(names[0], layout).toBe('layout-mark');
      expect(names.filter((n) => n === 'layout-mark'), layout).toHaveLength(1);
      expect(names[1], layout).toBe('editorial');
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
    pick.layout = 'review';
    const root = mount(DOC);
    await enhance(root);
    root.setAttribute('data-docreader-layout', 'host');
    await destroyEnhancement(root);
    expect(root.getAttribute('data-docreader-layout')).toBe('host');
  });
});

describe('the layouts\' stylesheets (assets/layouts/<name>.css)', () => {
  const css = (l: string): string => readFileSync(path.join(ROOT, 'assets', 'layouts', `${l}.css`), 'utf8');

  for (const layout of OWN) {
    it(`${layout}: every rule is scoped under the root's two marks, with no literal colour, no font and no url`, () => {
      const text = css(layout);
      // Strip the comments, then every rule's selector (what precedes a `{`) must start with the scope.
      const rules = text.replace(/\/\*[\s\S]*?\*\//g, '').split('}').map((r) => r.trim()).filter((r) => r !== '');
      expect(rules.length).toBeGreaterThan(0);
      for (const r of rules) expect(r.startsWith(`[data-docreader-root][data-docreader-layout="${layout}"]`), r).toBe(true);
      expect(text).not.toMatch(/#[0-9a-fA-F]{3,8}\b|\b(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color|color-mix)\s*\(/i);
      expect(text).not.toMatch(/url\(|@font-face|@import|<\/style/i);
      expect(text.includes('\r')).toBe(false);
    });
  }
});
