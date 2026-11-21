// The frame's `enhance`: the reader's own, wrapped for one thing (docserver parity, Task 4). The bootstrap's `itemLink` answers
// the seed's href and the bootstrap checks only the shape of the seed (its 32 KiB), so the reader judges the href before it
// draws a link: only an absolute `https:` URL (src/frame/items.ts) is passed on, anything else is no link and the value
// stays text.
//
// The wrapper touches no element, no global and no storage: it forwards the same root and, without an `itemLink` function,
// the very same options object; with one it forwards a copy that differs in `itemLink` alone. test/enhance-appearance.test.ts
// holds both with a fake `enhance`, and a source scan holds this file free of DOM names.
import { isItemHref } from '../frame/items.js';

/** The part of enhance's options the wrapper reads. */
interface WithItemLink {
  readonly itemLink?: unknown;
}

/** `enhance` for the frame: `inner` is the reader's own function; the result has its signature. */
export function wrapEnhance<R, O extends WithItemLink | undefined, T>(inner: (root: R, options?: O) => T): (root: R, options?: O) => T {
  return (root, options) => {
    const given = options?.itemLink;
    if (options === undefined || typeof given !== 'function') return inner(root, options);
    const ask = given as (key: string) => unknown;
    return inner(root, {
      ...options,
      itemLink: (key: string): string | null => {
        const href = ask(key);
        return isItemHref(href) ? href : null;
      },
    } as O);
  };
}
