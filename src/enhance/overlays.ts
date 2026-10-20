// Overlays (docserver L2, Task 7b): the reader's popups and panels, one registry per instance, and the order Escape
// closes them in, the reference layout's section 25: the full-screen figure, the keys sheet, the quick jump, the
// reading settings, the "Changes since" menu, the contents drawer, then the preview card. One press closes one: the
// first open one in that order, whatever was opened last.
//
// A feature registers its overlay once, at build: `register(kind, { isOpen, close })`. The registry asks `isOpen()`
// when it needs to know (so a feature keeps its own state, and the registry never holds a stale one) and calls
// `close()` to close it; the feature's close does its own clean-up (focus back to its opener, its button's state).
// Features read the registry, never each other's elements:
//   top()      the kind Escape would close now, or null;
//   any()      whether a dialog is open: every kind but the card, which is a preview, not a dialog (the keyboard layer
//              and the phone bar wait for a dialog, never for the card, as the reference's did);
//   isOpen(k), close(k?) (that kind, or the top one; true when it was open).
// Escape reaches close() through the keyboard layer (keys.ts), which routes it to the instance whose root holds the
// key's target, so it never closes another root's overlay (RF2). Every call is the instance's own: nothing is closed
// once it is not live.
//
// (There is no `open` here: the walls refuse the member name `open`, a page method. A feature opens its overlay
// itself; the registry only knows what is open.)
//
// Import-inert: declarations only.
import type { Cancel } from './env.js';

/** The overlay kinds, in the order Escape closes them. */
export const OVERLAY_ORDER = ['figure', 'keys', 'jump', 'settings', 'changes', 'drawer', 'card'] as const;

export type OverlayKind = (typeof OVERLAY_ORDER)[number];

/** What a feature registers for its overlay. */
export interface OverlayHandle {
  /** Whether it is open now; called often, so cheap and without side effects. */
  isOpen(): boolean;
  /** Close it (only called while it is open). */
  close(): void;
}

export interface Overlays {
  /** Register the overlay of `kind`, once per instance; its cancel unregisters it. Throws for an unknown kind or a second one. */
  register(kind: OverlayKind, handle: OverlayHandle): Cancel;
  isOpen(kind: OverlayKind): boolean;
  /** The open overlay Escape closes first, or null. */
  top(): OverlayKind | null;
  /** Whether a dialog is open: every kind but the card. */
  any(): boolean;
  /** Close `kind` (or the top overlay): true when it was open, and so closed. */
  close(kind?: OverlayKind): boolean;
}

/** The overlays of one instance: `live` is its own. */
export function createOverlays(live: () => boolean): Overlays {
  const handles = new Map<OverlayKind, OverlayHandle>();
  const isOpen = (kind: OverlayKind): boolean => {
    const h = handles.get(kind);
    return h !== undefined && h.isOpen();
  };
  const top = (): OverlayKind | null => {
    for (const kind of OVERLAY_ORDER) if (isOpen(kind)) return kind;
    return null;
  };
  return Object.freeze({
    register(kind: OverlayKind, handle: OverlayHandle): Cancel {
      if (!(OVERLAY_ORDER as readonly string[]).includes(kind)) throw new Error(`docreader: an overlay is one of ${OVERLAY_ORDER.join(', ')}`);
      if (typeof handle !== 'object' || handle === null || typeof handle.isOpen !== 'function' || typeof handle.close !== 'function') {
        throw new Error('docreader: an overlay registers isOpen and close');
      }
      if (handles.has(kind)) throw new Error(`docreader: the ${kind} overlay registers once`);
      if (!live()) return () => undefined;
      handles.set(kind, handle);
      return () => {
        if (handles.get(kind) === handle) handles.delete(kind);
      };
    },
    isOpen,
    top,
    any: (): boolean => OVERLAY_ORDER.some((kind) => kind !== 'card' && isOpen(kind)),
    close(kind?: OverlayKind): boolean {
      if (!live()) return false;
      const k = kind ?? top();
      if (k === null || !isOpen(k)) return false;
      handles.get(k)?.close();
      return true;
    },
  });
}
