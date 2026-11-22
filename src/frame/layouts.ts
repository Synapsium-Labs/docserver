// The layouts a frame can carry (docserver parity Task 9; plan Design B11 and B12). A frame inlines exactly one layout's
// enhance bundle, and the stylesheet of that layout when it has one; `default` is the reader as it has always been. The
// names are mirrored in scripts/build-frame.mjs's LAYOUT_TABLE, and test/frame-layouts.test.ts holds the two equal, with
// the manifest entries named below (and that each entry's `layout` mark is the layout that names it). Pure: declarations only.
/** Every layout, `default` first. */
export const FRAME_LAYOUTS = ['default', 'classic', 'editorial'] as const;

export type FrameLayout = (typeof FRAME_LAYOUTS)[number];

/** True for a name of FRAME_LAYOUTS (a string only; anything else is not a layout). */
export function isFrameLayout(v: unknown): v is FrameLayout {
  return typeof v === 'string' && (FRAME_LAYOUTS as readonly string[]).includes(v);
}

/** The manifest names of the enhance bundles. */
export type LayoutBundleEntry = 'enhance' | 'enhanceClassic' | 'enhanceEditorial';
/** The manifest names of the layouts' own stylesheets. */
export type LayoutStyleEntry = 'cssClassic' | 'cssEditorial';

/**
 * The manifest entries of each layout: its enhance bundle, and its own stylesheet (null when it has none: `default`'s
 * rules are `frame/reader.css`, which every layout inlines). Held equal to the manifest's `layout` marks by a test.
 */
export const LAYOUT_ENTRIES: Readonly<Record<FrameLayout, { readonly enhance: LayoutBundleEntry; readonly css: LayoutStyleEntry | null }>> = {
  default: { enhance: 'enhance', css: null },
  classic: { enhance: 'enhanceClassic', css: 'cssClassic' },
  editorial: { enhance: 'enhanceEditorial', css: 'cssEditorial' },
};
