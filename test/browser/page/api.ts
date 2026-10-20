// What the test page's script (bootstrap.ts) offers the tests, on `window.__docreaderHarness`. Types only.

/** The outcome of enhance() on the page: resolved, or rejected with its EnhanceError code (empty for another error). */
export type EnhanceOutcome = { ok: true } | { ok: false; code: string; message: string };

export interface HarnessApi {
  /** The root element: the page's `main[data-harness-root]`, found once when the page loaded. */
  readonly root: HTMLElement;
  /** enhance(root, the page's options), then wait for the fonts. */
  enhance(): Promise<EnhanceOutcome>;
  /** The structural snapshot of the root (snapshot.ts). */
  snapshot(scope: readonly string[]): string;
  /** Every Content Security Policy violation the page reported so far: "<directive> <blocked URI or 'inline'>". */
  violations(): string[];
  /** destroyEnhancement(root). */
  destroy(): Promise<void>;
}

declare global {
  interface Window {
    __docreaderHarness?: HarnessApi;
  }
}
