// @vitest-environment jsdom
// The frame's DOM-free copies of L2's plain-data shapes, held equal to L2's own (docserver L3, Task 1; review findings C1
// and C3). src/frame typechecks with no DOM lib (tsconfig.frame.json, Reference §12), and src/enhance/types.ts reaches DOM
// types through its imports, so the frame cannot import the shapes Reference §1 names from it. src/frame/wire-types.ts
// copies them (CommitEntry, ChromeOptions, VocabularyOptions), and src/frame/protocol.ts holds the values of the `prefs`
// op (theme, width, font; the lens stays frame-local, Q1). This file sits in the enhance typecheck project
// (tsconfig.enhance.json, with the DOM lib), the one place where both sides typecheck: a drift on either side is a red
// `npm run typecheck`. The prefs' values are compared at run time as well.
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { destroyEnhancement, enhance, runEnhancementCommand } from '../src/enhance/index.js';
import { createOverlays, OVERLAY_ORDER } from '../src/enhance/overlays.js';
import { PREF_VALUES } from '../src/enhance/options.js';
import type { ChromeOptions, CommitEntry, PlaceKind as EnhancePlaceKind, Prefs, VocabularyOptions } from '../src/enhance/types.js';
import { isAnchorToken } from '../src/frame/anchor.js';
import { createAdapters } from '../src/frame-runtime/adapters.js';
import type { Outbox, QueuedOp } from '../src/frame-runtime/outbox.js';
import { FRAME_PREF_VALUES, type FramePrefValues, type PlaceKind } from '../src/frame/protocol.js';
import type * as Wire from '../src/frame/wire-types.js';

describe("src/frame/wire-types.ts: exactly L2's shapes, with no DOM (finding C1)", () => {
  it('CommitEntry, ChromeOptions and VocabularyOptions equal src/enhance/types.ts', () => {
    expectTypeOf<Wire.CommitEntry>().toEqualTypeOf<CommitEntry>();
    expectTypeOf<Wire.ChromeOptions>().toEqualTypeOf<ChromeOptions>();
    expectTypeOf<Wire.VocabularyOptions>().toEqualTypeOf<VocabularyOptions>();
  });

  it("the prefs the bridge carries are L2's theme, width and font", () => {
    // Reference §1's FramePrefs, `Pick<EnhancePrefs, 'theme' | 'width' | 'font'>`, taken from wire-types.ts.
    expectTypeOf<Wire.FramePrefs>().toEqualTypeOf<Pick<Prefs, 'theme' | 'width' | 'font'>>();
    expectTypeOf<Required<FramePrefValues>>().toEqualTypeOf<Pick<Prefs, 'theme' | 'width' | 'font'>>();
    expectTypeOf<keyof typeof FRAME_PREF_VALUES>().toEqualTypeOf<Exclude<keyof Prefs, 'lens'>>();
  });
});

describe("FRAME_PREF_VALUES: L2's PREF_VALUES without the lens (finding C3)", () => {
  it('the same prefs, in the same order, each with the same values in the same order (the first the default)', () => {
    const l2 = Object.fromEntries(Object.entries(PREF_VALUES).filter(([k]) => k !== 'lens'));
    expect(Object.keys(FRAME_PREF_VALUES)).toEqual(Object.keys(l2));
    expect(FRAME_PREF_VALUES).toEqual(l2);
  });

  it("the lens is L2's and stays out (its control: PREF_VALUES does carry one)", () => {
    expect(Object.keys(PREF_VALUES)).toContain('lens');
    expect(Object.keys(FRAME_PREF_VALUES)).not.toContain('lens');
  });
});

describe("the frame's registered reader api (C-F4)", () => {
  it('the enhance entry registers exactly the seven members, runEnhancementCommand and the two appearance members among them', async () => {
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
    expect(Object.keys(detail.api).sort()).toEqual(['destroyEnhancement', 'enhance', 'goToHash', 'loadHostFonts', 'runEnhancementCommand', 'setEnhancementAppearance', 'setEnhancementPrefs']);
    expect(typeof detail.api['runEnhancementCommand']).toBe('function');
  });
});

describe('the place wire: the reader reports its figure overlay (docserver parity T3)', () => {
  const TOKEN = JSON.stringify({ line: '12-14', offset: 40, y: 560 });
  const BRIDGE = { links: true, hash: true, copy: true, changes: true, versions: true, progress: false, places: false, printFigures: false } as const;

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
