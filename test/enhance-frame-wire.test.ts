// @vitest-environment jsdom
// The frame's DOM-free copies of L2's plain-data shapes, held equal to L2's own (docserver L3, Task 1; review findings C1
// and C3). src/frame typechecks with no DOM lib (tsconfig.frame.json, Reference §12), and src/enhance/types.ts reaches DOM
// types through its imports, so the frame cannot import the shapes Reference §1 names from it. src/frame/wire-types.ts
// copies them (CommitEntry, ChromeOptions, VocabularyOptions), and src/frame/protocol.ts holds the values of the `prefs`
// op (theme, width, font; the lens stays frame-local, Q1). This file sits in the enhance typecheck project
// (tsconfig.enhance.json, with the DOM lib), the one place where both sides typecheck: a drift on either side is a red
// `npm run typecheck`. The prefs' values are compared at run time as well.
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { destroyEnhancement, enhance, goToHash, runEnhancementCommand } from '../src/enhance/index.js';
import { createOverlays, OVERLAY_ORDER } from '../src/enhance/overlays.js';
import { PREF_VALUES } from '../src/enhance/options.js';
import type { ChromeOptions, CommitEntry, PlaceKind as EnhancePlaceKind, Prefs, VocabularyOptions } from '../src/enhance/types.js';
import { isAnchorToken } from '../src/frame/anchor.js';
import { createAdapters } from '../src/frame-runtime/adapters.js';
import type { Outbox, QueuedOp } from '../src/frame-runtime/outbox.js';
import { BRIDGE_LIMITS, FRAME_PREF_VALUES, type FramePrefValues, type PlaceKind } from '../src/frame/protocol.js';
import type * as Wire from '../src/frame/wire-types.js';
import type { ReaderVocabulary } from '../src/render/types.js';

describe("src/frame/wire-types.ts: exactly L2's shapes, with no DOM (finding C1)", () => {
  it('CommitEntry, ChromeOptions and VocabularyOptions equal src/enhance/types.ts', () => {
    expectTypeOf<Wire.CommitEntry>().toEqualTypeOf<CommitEntry>();
    expectTypeOf<Wire.ChromeOptions>().toEqualTypeOf<ChromeOptions>();
    expectTypeOf<Wire.VocabularyOptions>().toEqualTypeOf<VocabularyOptions>();
  });

  it("render()'s ReaderVocabulary is the same vocabulary: one shape for the screen's reader and the render that lists its items (docserver parity T4, B7)", () => {
    // `rules` is print mode's own flag (docserver parity T7), not a vocabulary list of the reader.
    expectTypeOf<Omit<ReaderVocabulary, 'rules'>>().toEqualTypeOf<VocabularyOptions>();
    expectTypeOf<Omit<ReaderVocabulary, 'rules'>>().toEqualTypeOf<Wire.VocabularyOptions>();
  });

  it("the prefs the bridge carries are L2's theme, width and font", () => {
    // Reference §1's FramePrefs, `Pick<EnhancePrefs, 'theme' | 'width' | 'font'>`, taken from wire-types.ts.
    expectTypeOf<Wire.FramePrefs>().toEqualTypeOf<Pick<Prefs, 'theme' | 'width' | 'font'>>();
    expectTypeOf<Required<FramePrefValues>>().toEqualTypeOf<Pick<Prefs, 'theme' | 'width' | 'font'>>();
    expectTypeOf<keyof typeof FRAME_PREF_VALUES>().toEqualTypeOf<Exclude<keyof Prefs, 'lens' | 'size'>>();
  });
});

describe("FRAME_PREF_VALUES: L2's PREF_VALUES without the reader-local prefs, the lens (finding C3) and the text size (LX6.3)", () => {
  it('the same prefs, in the same order, each with the same values in the same order (the first the default)', () => {
    const l2 = Object.fromEntries(Object.entries(PREF_VALUES).filter(([k]) => k !== 'lens' && k !== 'size'));
    expect(Object.keys(FRAME_PREF_VALUES)).toEqual(Object.keys(l2));
    expect(FRAME_PREF_VALUES).toEqual(l2);
  });

  it("the lens is L2's and stays out (its control: PREF_VALUES does carry one)", () => {
    expect(Object.keys(PREF_VALUES)).toContain('lens');
    expect(Object.keys(FRAME_PREF_VALUES)).not.toContain('lens');
  });

  it("the text size is L2's too and stays out (LX6.3): PREF_VALUES carries one, the bridge's prefs op does not", () => {
    expect(Object.keys(PREF_VALUES)).toContain('size');
    expect(Object.keys(FRAME_PREF_VALUES)).not.toContain('size');
  });
});

describe("the frame's registered reader api (C-F4)", () => {
  it('the enhance entry registers exactly the eight members, runEnhancementCommand, the two appearance members and setEnhancementReading among them', async () => {
    const script = document.createElement('script');
    const seen: unknown[] = [];
    script.addEventListener('docserver:register', (e) => void seen.push((e as CustomEvent).detail));
    Object.defineProperty(document, 'currentScript', { configurable: true, get: () => script });
    try {
      vi.resetModules();
      await import('../src/frame-runtime/enhance-entry.js');
    } finally {
      Reflect.deleteProperty(document, 'currentScript');
    }
    expect(seen).toHaveLength(1);
    const detail = seen[0] as { name: string; api: Record<string, unknown> };
    expect(detail.name).toBe('enhance');
    expect(Object.keys(detail.api).sort()).toEqual(['destroyEnhancement', 'enhance', 'goToHash', 'loadHostFonts', 'runEnhancementCommand', 'setEnhancementAppearance', 'setEnhancementPrefs', 'setEnhancementReading']);
    expect(typeof detail.api['runEnhancementCommand']).toBe('function');
  });
});

describe('the place wire: the reader reports its figure overlay (docserver parity T3)', () => {
  const TOKEN = JSON.stringify({ line: '12-14', offset: 40, y: 560 });
  const BRIDGE = { links: true, hash: true, copy: true, changes: true, versions: true, progress: false, places: false, printFigures: false, reader: false } as const;

  function sentBy(bridge: typeof BRIDGE | (Omit<typeof BRIDGE, 'places'> & { places: boolean })): { sent: QueuedOp[]; a: ReturnType<typeof createAdapters> } {
    const sent: QueuedOp[] = [];
    const box = { send: (op: QueuedOp) => void sent.push(op) } as unknown as Outbox;
    return { sent, a: createAdapters(box, { snapshot: [], bridge }) };
  }

  it("the reader's place kinds are the wire's, held equal", () => {
    expectTypeOf<EnhancePlaceKind>().toEqualTypeOf<PlaceKind>();
  });

  it('with bridge.places: a jump sends push and a from the reader accepts; a move that is not a push sends neither', () => {
    const { sent, a } = sentBy({ ...BRIDGE, places: true });
    expect(isAnchorToken(TOKEN)).toBe(true);
    a.onHash?.('one', { push: true, from: TOKEN });
    a.onHash?.('two', { push: false, from: TOKEN }); // scroll-spy and the section keys: no push, so no from either
    a.onHash?.('three', { push: true, from: 'not a token' });
    a.onHash?.('four', { push: true, from: null });
    a.onHash?.(null, { push: true, from: TOKEN });
    expect(sent).toEqual([
      { t: 'hash', id: 'one', push: 'true', from: TOKEN },
      { t: 'hash', id: 'two' },
      { t: 'hash', id: 'three', push: 'true' },
      { t: 'hash', id: 'four', push: 'true' },
    ]);
  });

  it("with bridge.places false: hash is exactly batch 1.1's, and there is no place adapter", () => {
    const { sent, a } = sentBy(BRIDGE);
    a.onHash?.('one', { push: true, from: TOKEN });
    a.onHash?.('two', { push: false, from: null });
    expect(sent).toEqual([{ t: 'hash', id: 'one' }, { t: 'hash', id: 'two' }]);
    expect(a.onPlace).toBeUndefined();
  });

  it('with bridge.places: onPlace sends the two kinds and nothing else', () => {
    const { sent, a } = sentBy({ ...BRIDGE, places: true });
    a.onPlace?.('overlay');
    a.onPlace?.('overlay-closed');
    a.onPlace?.('keys' as PlaceKind);
    a.onPlace?.(undefined as unknown as PlaceKind);
    expect(sent).toEqual([{ t: 'place', kind: 'overlay' }, { t: 'place', kind: 'overlay-closed' }]);
  });

  describe('the overlay registry reports a place for the figure only', () => {
    it('report() tells the host for the figure, once per change, and for no other kind', () => {
      const seen: string[] = [];
      const overlays = createOverlays(() => true, { onPlace: (k) => void seen.push(k) });
      for (const kind of OVERLAY_ORDER.filter((k) => k !== 'figure')) {
        overlays.report(kind, true);
        overlays.report(kind, false);
      }
      expect(seen).toEqual([]);
      overlays.report('figure', false); // not reported open: nothing to close
      overlays.report('figure', true);
      overlays.report('figure', true);
      overlays.report('figure', false);
      overlays.report('figure', false);
      expect(seen).toEqual(['overlay', 'overlay-closed']);
    });

    it('closeQuiet() closes the figure without a report of its own; not live, it reports nothing', () => {
      const seen: string[] = [];
      let live = true;
      let open = false;
      const overlays = createOverlays(() => live, { onPlace: (k) => void seen.push(k) });
      overlays.register('figure', {
        isOpen: () => open,
        close: () => {
          open = false;
          overlays.report('figure', false);
        },
      });
      open = true;
      overlays.report('figure', true);
      expect(overlays.closeQuiet('figure')).toBe(true);
      expect(overlays.closeQuiet('figure')).toBe(false);
      expect(seen).toEqual(['overlay']);
      open = true;
      overlays.report('figure', true);
      overlays.close('figure'); // Esc's path: one report
      expect(seen).toEqual(['overlay', 'overlay', 'overlay-closed']);
      live = false;
      overlays.report('figure', true);
      expect(seen).toHaveLength(3);
    });
  });

  describe('through the reader (jsdom)', () => {
    const mounted: HTMLElement[] = [];
    function fixture(): HTMLElement {
      const root = document.createElement('main');
      root.innerHTML = [
        '<h1>Places</h1><h2>Decisions</h2>',
        '<figure class="mermaid-figure"><pre class="mermaid">flowchart LR\n  A --> B</pre><pre class="mermaid" data-docreader-chrome><svg id="place-source" viewBox="0 0 240 100"><g class="node" id="flowchart-A-0"><rect width="80" height="30"/></g></svg></pre><figcaption>Figure 1. A path.</figcaption></figure>',
      ].join('');
      document.body.append(root);
      mounted.push(root);
      return root;
    }
    const fullScreen = (root: HTMLElement): void => {
      Array.from(root.querySelectorAll('button')).find((b) => b.textContent === 'Full screen')?.click();
    };
    const esc = (root: HTMLElement): void => {
      root.querySelector('.fo-close')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    };
    afterEach(async () => {
      for (const root of mounted.splice(0)) await destroyEnhancement(root).catch(() => undefined);
      document.body.replaceChildren();
    });

    it('open, Esc: overlay, then one overlay-closed', async () => {
      const root = fixture();
      const onPlace = vi.fn();
      await enhance(root, { copy: () => undefined, onPlace });
      fullScreen(root);
      expect(root.querySelector('.fig-overlay.open')).not.toBeNull();
      expect(onPlace.mock.calls).toEqual([['overlay']]);
      esc(root);
      expect(root.querySelector('.fig-overlay.open')).toBeNull();
      expect(onPlace.mock.calls).toEqual([['overlay'], ['overlay-closed']]);
    });

    it('open, the Close button: one overlay-closed; opened again, reported again', async () => {
      const root = fixture();
      const onPlace = vi.fn();
      await enhance(root, { copy: () => undefined, onPlace });
      fullScreen(root);
      (root.querySelector('.fo-close') as HTMLButtonElement).click();
      fullScreen(root);
      expect(onPlace.mock.calls).toEqual([['overlay'], ['overlay-closed'], ['overlay']]);
    });

    it('open, close-overlay: overlay and nothing more; the overlay is closed; a second close-overlay is false', async () => {
      const root = fixture();
      const onPlace = vi.fn();
      await enhance(root, { copy: () => undefined, onPlace });
      expect(runEnhancementCommand(root, 'close-overlay')).toBe(false); // nothing built yet
      fullScreen(root);
      expect(runEnhancementCommand(root, 'close-overlay')).toBe(true);
      expect(root.querySelector('.fig-overlay.open')).toBeNull();
      expect(runEnhancementCommand(root, 'close-overlay')).toBe(false);
      expect(onPlace.mock.calls).toEqual([['overlay']]);
      // and the next Esc has nothing to close, so reports nothing either
      esc(root);
      expect(onPlace).toHaveBeenCalledTimes(1);
    });

    it('open, a reveal (goTo a target): exactly one overlay-closed', async () => {
      const root = fixture();
      (root.querySelector('h2') as HTMLElement).id = 'decisions';
      const onPlace = vi.fn();
      await enhance(root, { copy: () => undefined, onPlace });
      fullScreen(root);
      expect(onPlace.mock.calls).toEqual([['overlay']]);
      goToHash(root, 'decisions');
      expect(root.querySelector('.fig-overlay.open')).toBeNull();
      expect(onPlace.mock.calls).toEqual([['overlay'], ['overlay-closed']]);
      // closed already: a second go reports nothing more
      goToHash(root, 'decisions');
      expect(onPlace).toHaveBeenCalledTimes(2);
    });

    it('close-overlay works for a host that gave no onPlace', async () => {
      const root = fixture();
      await enhance(root, { copy: () => undefined });
      fullScreen(root);
      expect(runEnhancementCommand(root, 'close-overlay')).toBe(true);
      expect(root.querySelector('.fig-overlay.open')).toBeNull();
    });

    it('the keys sheet is not a place: opened and closed, nothing is reported', async () => {
      const root = fixture();
      const onPlace = vi.fn();
      await enhance(root, { copy: () => undefined, onPlace });
      root.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true, cancelable: true }));
      expect(root.querySelector('.keys.open')).not.toBeNull();
      root.querySelector('.keys.open')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      expect(onPlace).not.toHaveBeenCalled();
    });
  });
});

describe('the print wire: the adapter forwards a figure only under bridge.printFigures (docserver parity T6)', () => {
  const BRIDGE = { links: true, hash: true, copy: true, changes: true, versions: true, progress: false, places: false, printFigures: true, reader: false } as const;
  const PNG = 'iVBORw0KGgo=';

  function printBy(bridge: typeof BRIDGE | (Omit<typeof BRIDGE, 'printFigures'> & { printFigures: boolean })): { sent: QueuedOp[]; dones: number; a: ReturnType<typeof createAdapters> } {
    const sent: QueuedOp[] = [];
    const out = { sent, dones: 0 };
    const box = {
      send: (op: QueuedOp, done?: () => void) => {
        sent.push(op);
        if (done !== undefined) {
          out.dones += 1;
          done();
        }
      },
    } as unknown as Outbox;
    const a = createAdapters(box, { snapshot: [], bridge });
    return Object.assign(out, { a }) as { sent: QueuedOp[]; dones: number; a: ReturnType<typeof createAdapters> };
  }

  it('without bridge.printFigures there is no print option: the reader builds no print-figures command, and nothing is sent', () => {
    const { sent, a } = printBy({ ...BRIDGE, printFigures: false });
    expect(a.printOption).toEqual({});
    expect(Object.keys(a.printOption)).toEqual([]);
    expect(sent).toEqual([]);
  });

  it('with it the option sends {t, i, n, png} with i and n as canonical decimals, and answers a promise that settles once the op is posted', async () => {
    const sent: QueuedOp[] = [];
    let post: (() => void) | undefined;
    const box = { send: (op: QueuedOp, done?: () => void) => { sent.push(op); post = done; } } as unknown as Outbox;
    const a = createAdapters(box, { snapshot: [], bridge: BRIDGE });
    const settled = vi.fn();
    const asked = a.printOption.onPrintFigure?.({ i: 0, n: 3, png: PNG }) as Promise<void>;
    void asked.then(settled);
    await Promise.resolve();
    expect(sent).toEqual([{ t: 'print-figure', i: '0', n: '3', png: PNG }]);
    expect(Object.keys(sent[0] as object)).toEqual(['t', 'i', 'n', 'png']);
    expect(settled).not.toHaveBeenCalled();
    post?.();
    await asked;
    expect(settled).toHaveBeenCalledTimes(1);
  });

  it('a figure the wire has no place for is not sent, and its promise settles at once: i at or above n, a negative i, n above 64, a PNG text longer than 1 MiB can be, a text that is no string', async () => {
    const { sent, a } = printBy(BRIDGE);
    const longest = 4 * Math.ceil(BRIDGE_LIMITS.printFigurePngMaxBytes / 3);
    const forged: [number, number, unknown][] = [[3, 3, PNG], [4, 3, PNG], [-1, 3, PNG], [0, 65, PNG], [64, 64, PNG], [0, 1, 'A'.repeat(longest + 4)], [0, 1, 7], [0, 1, undefined], [0, 1, null]];
    for (const [i, n, png] of forged) await a.printOption.onPrintFigure?.({ i, n, png: png as string });
    expect(sent).toEqual([]);
    // the edges pass
    await a.printOption.onPrintFigure?.({ i: 63, n: 64, png: PNG });
    await a.printOption.onPrintFigure?.({ i: 0, n: 1, png: 'A'.repeat(longest) });
    expect(sent.map((o) => (o as { i: string }).i)).toEqual(['63', '0']);
  });

  it('an i or n that is not an integer is sent as its decimal text, which the host parser refuses: the frame does not judge it (the reader does, before it asks)', () => {
    const { sent, a } = printBy(BRIDGE);
    void a.printOption.onPrintFigure?.({ i: 1.5, n: 3, png: PNG });
    expect(sent).toEqual([{ t: 'print-figure', i: '1.5', n: '3', png: PNG }]);
  });
});

describe('the item link of the frame: seeded hrefs, drawn by the reader (docserver parity T4)', () => {
  type Api = { enhance: (root: HTMLElement, options?: object) => Promise<void> };
  const mounted: HTMLElement[] = [];

  async function frameApi(): Promise<Api> {
    const script = document.createElement('script');
    const seen: unknown[] = [];
    script.addEventListener('docserver:register', (e) => void seen.push((e as CustomEvent).detail));
    Object.defineProperty(document, 'currentScript', { configurable: true, get: () => script });
    try {
      vi.resetModules();
      await import('../src/frame-runtime/enhance-entry.js');
    } finally {
      Reflect.deleteProperty(document, 'currentScript');
    }
    return (seen[0] as { api: Api }).api;
  }

  const SEED_BRIDGE = { links: true, hash: true, copy: true, changes: true, versions: true, progress: false, places: false, printFigures: false, reader: false } as const;
  const adaptersOf = (items?: readonly { value: string; href: string }[]): ReturnType<typeof createAdapters> =>
    createAdapters({ send: () => undefined } as unknown as Outbox, { snapshot: [], bridge: SEED_BRIDGE, ...(items === undefined ? {} : { items }) });

  const DOC = '<h1 id="t">Title</h1><p><strong>Spec</strong> \u00b7 2026-10-12 \u00b7 Tracker: AB-12 and CD-7 and AB-123</p><h2 id="s">Scope</h2><p>Body.</p>';
  function mount(): HTMLElement {
    const root = document.createElement('main');
    root.innerHTML = DOC;
    document.body.append(root);
    mounted.push(root);
    return root;
  }
  afterEach(async () => {
    for (const root of mounted.splice(0)) await destroyEnhancement(root).catch(() => undefined);
    document.body.replaceChildren();
  });
  const linksOf = (root: Element): string[] => Array.from(root.querySelectorAll('a.item-link')).map((a) => `${a.textContent ?? ''}|${a.getAttribute('href') ?? ''}`);

  it('the adapter answers the seeded href of the value asked for, exactly, else null (P4d: never a prefix, a case or a trim)', () => {
    const a = adaptersOf([{ value: 'AB-12', href: 'https://t.example/AB-12' }, { value: 'CD-7', href: 'https://t.example/CD-7' }]);
    const ask = a.itemOption.itemLink;
    expect(ask).toBeTypeOf('function');
    expect(ask?.('AB-12')).toBe('https://t.example/AB-12');
    expect(ask?.('CD-7')).toBe('https://t.example/CD-7');
    for (const k of ['AB-1', 'AB-123', 'AB-12 ', ' AB-12', 'ab-12', 'AB', '', 'EF-1', 'CD-7x']) expect(ask?.(k), JSON.stringify(k)).toBeNull();
  });

  it('with no items the adapter has no itemLink: the option is an empty object, spread to nothing', () => {
    expect(adaptersOf().itemOption).toEqual({});
    expect(Object.keys(adaptersOf().itemOption)).toEqual([]);
    expect(Object.keys(adaptersOf([]).itemOption)).toEqual(['itemLink']);
  });

  it('draws a seeded item as the reader\'s item-link and leaves an unseeded one as text; the click goes to onLink as a new tab', async () => {
    const api = await frameApi();
    const root = mount();
    const onLink = vi.fn();
    await api.enhance(root, {
      vocabulary: { itemFields: ['Tracker'] },
      onLink,
      ...adaptersOf([{ value: 'AB-12', href: 'https://t.example/AB-12' }]).itemOption,
    });
    expect(linksOf(root)).toEqual(['AB-12 \u2197|https://t.example/AB-12']);
    const a = root.querySelector('a.item-link') as HTMLAnchorElement;
    expect(a.target).toBe('_blank');
    // CD-7 and AB-123 are in the same fact and stay text.
    expect(root.querySelector('.byline')?.textContent).toContain('CD-7');
    expect(root.querySelector('.byline')?.textContent).toContain('AB-123');
    a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
    expect(onLink.mock.calls).toEqual([['https://t.example/AB-12', { newTab: true }]]);
  });

  it('draws only an absolute https: href: http:, javascript:, data:, relative and spaced hrefs are no link, and the value stays text (the reader\'s own check, P4c)', async () => {
    const api = await frameApi();
    for (const href of ['http://t.example/AB-12', 'javascript:alert(1)', 'data:text/html,x', '/AB-12', 'AB-12', '//t.example/AB-12', 'https://t.example/a b', 'https://u@t.example/', 'https:', '']) {
      const root = mount();
      await api.enhance(root, { vocabulary: { itemFields: ['Tracker'] }, ...adaptersOf([{ value: 'AB-12', href }]).itemOption });
      expect(linksOf(root), JSON.stringify(href)).toEqual([]);
      expect(root.querySelector('.byline')?.textContent).toContain('AB-12');
    }
    const root = mount();
    await api.enhance(root, { vocabulary: { itemFields: ['Tracker'] }, ...adaptersOf([{ value: 'AB-12', href: 'https://t.example/AB-12' }]).itemOption });
    expect(linksOf(root)).toEqual(['AB-12 \u2197|https://t.example/AB-12']);
  });

  it('with no itemLink the reader draws no item link, and the frame\'s enhance passes every other option as it is', async () => {
    const api = await frameApi();
    const root = mount();
    await api.enhance(root, { vocabulary: { itemFields: ['Tracker'] } });
    expect(linksOf(root)).toEqual([]);
    expect(root.querySelector('.item-link')).toBeNull();
    const other = mount();
    await api.enhance(other, undefined);
    expect(other.hasAttribute('data-docreader-root')).toBe(true);
  });
});
