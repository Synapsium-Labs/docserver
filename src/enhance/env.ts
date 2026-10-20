// The root's window, behind one module (docserver L2, Task 7a): everything of the browser a feature uses that is not
// the root's own subtree. The reference layout reached for the page's globals (timers, frames, idle callbacks, media
// queries, the scroll position, observers, the fonts, a canvas); here each is a call on `ctx.env`, made for one
// instance, and this is the only module that reaches the root's window (`defaultView`) or the clock. The walls test
// holds every other module to it.
//
// For each instance:
//   - every callback (a timeout, a frame, an idle callback, a window event, an observer's report) runs inside an
//     operation of the instance (ctx.operate), so a destroy it requests waits for it to return, and it does nothing
//     once the instance is not live, so one the browser had already queued when the instance was destroyed is a no-op;
//   - every schedule and subscription returns its own cancel, and the instance's teardown cancels all that are left,
//     each with the window's own cancel (journal.defer, registered when the env is made);
//   - fonts(maxMs) waits for the reader's two faces, bounded; a wait that ends once the instance is not live never
//     settles, so nothing after it runs (a feature still checks live() after an await, as for any call-out). It
//     answers true only once each face's load answered a face with the status 'loaded'. A load answers no face for a
//     family no @font-face declares yet (a stylesheet still on its way): the wait then listens for the font set's next
//     'loadingdone' and asks again, within the same bound, so it never answers true on the fallback faces
//     (docserver L2, Task 7b: relayout's fonts trigger, LD5);
//   - a root in a document with no window (one a DOMParser made) gets an env all the same: nothing is scheduled or
//     heard, sizes read 0, media queries and lookups answer false or null, and nothing throws.
// Reads are live: each call asks the window then, so a host or a test that changes the window is seen at once.
//
// Import-inert: declarations only; createEnv runs when the lifecycle builds an instance.
import type { Journal } from './journal.js';

/** Stops one schedule or subscription; calling it again, or after it ran, does nothing. */
export type Cancel = () => void;

/** The window's size and scroll position, in CSS pixels. */
export interface Viewport {
  readonly w: number;
  readonly h: number;
  readonly scrollY: number;
}

/** An observer made through env: what it watches, and its cancel. */
export interface Observed {
  observe(el: Element): void;
  unobserve(el: Element): void;
  cancel(): void;
}

/** One element's new size, as ResizeObserver reports its content box. */
export interface ResizeChange {
  readonly target: Element;
  readonly width: number;
  readonly height: number;
}

/** One element's visibility, as IntersectionObserver reports it. */
export interface IntersectionChange {
  readonly target: Element;
  readonly isIntersecting: boolean;
  readonly ratio: number;
}

/** IntersectionObserver's options that a feature may set. */
export interface IntersectionInit {
  readonly rootMargin?: string;
  readonly threshold?: number;
}

export interface Env {
  /** Run `fn` at the next frame (a 16 ms timeout where the window has no frames). */
  frame(fn: () => void): Cancel;
  /** Run `fn` after `ms` (clamped to a finite delay from 0 to 2^31 - 1). */
  timeout(fn: () => void, ms: number): Cancel;
  /** Run `fn` when the browser is idle, within `maxMs` (default 2000); a timeout of at most 200 ms where it has no idle callbacks. */
  idle(fn: () => void, maxMs?: number): Cancel;
  /** Whether a media query matches now; false without media queries. */
  matches(query: string): boolean;
  /** Whether the reader asked for reduced motion. */
  reducedMotion(): boolean;
  /** The window's width and height and its scroll position, frozen; zeros without a window. */
  viewport(): Viewport;
  /** Scroll the window to `top`: smoothly only when asked and the reader allows motion. A top that is not finite is ignored. */
  scrollTo(top: number, smooth?: boolean): void;
  onScroll(fn: () => void): Cancel;
  onResize(fn: () => void): Cancel;
  /** `fn(true)` when printing starts, `fn(false)` when it ends. */
  onPrint(fn: (printing: boolean) => void): Cancel;
  /** When the page is hidden for good or for the back-forward cache (the last moment to save a position). */
  onPageHide(fn: () => void): Cancel;
  /**
   * Wait for the reader's faces (Docreader Serif and Docreader Sans) to load, at most `maxMs`: true once they have,
   * false when the wait ran out, a load failed or the document has no font set. Never settles once not live.
   */
  fonts(maxMs: number): Promise<boolean>;
  /** Watch elements' sizes; null where the window has no ResizeObserver. */
  observeResize(fn: (changes: readonly ResizeChange[]) => void): Observed | null;
  /** Watch elements' visibility; null where the window has no IntersectionObserver. */
  observeIntersection(fn: (changes: readonly IntersectionChange[]) => void, init?: IntersectionInit): Observed | null;
  /** The width of `text` in `font` (a CSS font shorthand), measured on a canvas; null where there is no canvas context. */
  textWidth(text: string, font: string): number | null;
  /** The time, in milliseconds since the epoch: the one clock features read. */
  now(): number;
  /** The element at a point of the viewport, when it is the root or inside it; otherwise null. */
  elementFromPoint(x: number, y: number): Element | null;
  /** A computed style value of an element inside the root (a custom property included); '' otherwise. */
  computed(el: Element, prop: string): string;
}

/** The instance's operation: runs `fn`, or does nothing and answers undefined once not live. */
type Operate = <T>(fn: () => T) => T | undefined;

/** The longest delay a timer takes. */
const MAX_DELAY = 2 ** 31 - 1;

/** The faces fonts() waits for: the stylesheet's own (C43). */
const FACES = ['1em "Docreader Serif"', '1em "Docreader Sans"'] as const;

/** The font set's events after which fonts() asks again. */
const HEARD = ['loading', 'loadingdone'] as const;

/** Whether one face's load answered a loaded face: a list with at least one face whose status is 'loaded'. */
function loadedFace(found: unknown): boolean {
  return Array.isArray(found) && found.some((f: unknown) => (f as { status?: unknown } | null | undefined)?.status === 'loaded');
}

/** A finite delay from 0 to MAX_DELAY. */
function delay(ms: number): number {
  if (Number.isNaN(ms) || ms <= 0) return 0;
  return Math.min(ms, MAX_DELAY);
}

/** The env of one instance: `live` and `operate` are its own. */
export function createEnv(root: HTMLElement, journal: Journal, live: () => boolean, operate: Operate): Env {
  const doc = root.ownerDocument;
  const view = doc.defaultView;
  /** What is still scheduled or subscribed: each entry cancels itself. */
  const pending = new Set<Cancel>();
  journal.defer(() => {
    for (const cancel of [...pending]) cancel();
    pending.clear();
  });

  /** Run a callback of the instance: inside an operation, and only while live. */
  const run = (fn: () => void): void => {
    if (live()) operate(fn);
  };

  /** Track one schedule: its cancel runs `stop` once and forgets it. */
  const track = (stop: () => void): Cancel => {
    let done = false;
    const cancel: Cancel = () => {
      if (done) return;
      done = true;
      pending.delete(cancel);
      stop();
    };
    pending.add(cancel);
    return cancel;
  };

  /**
   * Schedule `fn` once: `start` asks the window and answers its stop. The entry is forgotten when `fn` runs, and a
   * cancelled one never runs, even if the window calls it all the same.
   */
  const once = (fn: () => void, start: (call: () => void) => (() => void) | null): Cancel => {
    if (!live()) return () => undefined;
    let cancelled = false;
    let tracked: Cancel | null = null;
    const stop = start(() => {
      if (cancelled) return;
      cancelled = true;
      if (tracked !== null) pending.delete(tracked);
      run(fn);
    });
    if (stop === null) return () => undefined;
    const cancel = track(stop);
    tracked = cancel;
    return () => {
      cancelled = true;
      cancel();
    };
  };

  const timeout = (fn: () => void, ms: number): Cancel =>
    once(fn, (call) => {
      if (view === null) return null;
      const id = view.setTimeout(call, delay(ms));
      return () => {
        view.clearTimeout(id);
      };
    });

  /** Listen for one window event, inside operations. */
  const listen = (type: string, fn: () => void): Cancel => {
    if (view === null || !live()) return () => undefined;
    const handler = (): void => {
      run(fn);
    };
    view.addEventListener(type, handler, { passive: true });
    return track(() => {
      view.removeEventListener(type, handler);
    });
  };

  /** A window without media queries (no matchMedia), or a query it refuses, answers false. */
  const matches = (query: string): boolean => {
    if (view === null) return false;
    try {
      return view.matchMedia(query).matches === true;
    } catch {
      return false;
    }
  };

  /** An observer made by `make` from the window's constructor, or null without it. */
  const observer = (make: () => { observe(el: Element): void; unobserve(el: Element): void; disconnect(): void } | null): Observed | null => {
    if (!live()) return null;
    const o = make();
    if (o === null) return null;
    /** Cancelled by its own handle: a disconnected observer is never started again (teardown no longer tracks it). */
    let cancelled = false;
    const stop = track(() => {
      o.disconnect();
    });
    const cancel = (): void => {
      cancelled = true;
      stop();
    };
    return Object.freeze({
      observe: (el: Element) => {
        if (live() && !cancelled) o.observe(el);
      },
      unobserve: (el: Element) => {
        o.unobserve(el);
      },
      cancel,
    });
  };

  /** The canvas context for textWidth: undefined until first asked, null when there is none. */
  let canvas: { font: string; measureText(t: string): { width: number } } | null | undefined;

  const env: Env = {
    frame: (fn) =>
      once(fn, (call) => {
        if (view === null) return null;
        if (typeof view.requestAnimationFrame !== 'function') {
          const id = view.setTimeout(call, 16);
          return () => {
            view.clearTimeout(id);
          };
        }
        const id = view.requestAnimationFrame(call);
        return () => {
          view.cancelAnimationFrame(id);
        };
      }),

    timeout,

    idle: (fn, maxMs = 2000) =>
      once(fn, (call) => {
        if (view === null) return null;
        if (typeof view.requestIdleCallback !== 'function') {
          const id = view.setTimeout(call, Math.min(200, delay(maxMs)));
          return () => {
            view.clearTimeout(id);
          };
        }
        const id = view.requestIdleCallback(call, { timeout: delay(maxMs) });
        return () => {
          view.cancelIdleCallback(id);
        };
      }),

    matches,

    reducedMotion: () => matches('(prefers-reduced-motion: reduce)'),

    viewport: () => Object.freeze(view === null ? { w: 0, h: 0, scrollY: 0 } : { w: view.innerWidth, h: view.innerHeight, scrollY: view.scrollY }),

    scrollTo: (top, smooth = false) => {
      if (view === null || !Number.isFinite(top) || !live()) return;
      view.scrollTo({ top, behavior: smooth && !matches('(prefers-reduced-motion: reduce)') ? 'smooth' : 'auto' });
    },

    onScroll: (fn) => listen('scroll', fn),
    onResize: (fn) => listen('resize', fn),
    onPrint: (fn) => {
      const start = listen('beforeprint', () => {
        fn(true);
      });
      const end = listen('afterprint', () => {
        fn(false);
      });
      return () => {
        start();
        end();
      };
    },
    onPageHide: (fn) => listen('pagehide', fn),

    fonts: (maxMs) =>
      new Promise<boolean>((resolve) => {
        if (!live()) return; // never settles: nothing after the wait runs
        let settled = false;
        /** Stops listening for the font set's next load: nothing until the wait listens. */
        let unhear: Cancel = () => undefined;
        const finish = (loaded: boolean): void => {
          if (settled) return;
          settled = true;
          stop();
          unhear();
          if (live()) resolve(loaded);
        };
        const stop = timeout(() => {
          finish(false);
        }, maxMs);
        /**
         * Listen once for the set's next 'loading' or 'loadingdone', then ask again; a set that cannot be listened to waits
         * out the bound. 'loading' is heard because WebKit fires no 'loadingdone' for the faces a stylesheet added after
         * the wait began; a load asked for while a face loads answers once it has loaded.
         */
        const hear = (set: FontFaceSet): void => {
          if (settled || !live()) return;
          // Teardown removes it (track), so it never runs once the instance is gone; ask() writes nothing.
          const handler = (): void => {
            unhear();
            ask();
          };
          const heard: string[] = [];
          try {
            for (const type of HEARD) {
              set.addEventListener(type, handler);
              heard.push(type);
            }
          } catch {
            // What was added before the refusal is removed with the rest.
          }
          unhear = track(() => {
            for (const type of heard) set.removeEventListener(type, handler);
          });
        };
        const ask = (): void => {
          // One guard for every way the font set can fail: a getter that throws, no font set, no load, a load that
          // throws at once. Each answers false, as a load that rejects does.
          let set: FontFaceSet;
          let loads: Promise<unknown[]>;
          try {
            set = doc.fonts;
            loads = Promise.all(FACES.map((face) => set.load(face)));
          } catch {
            finish(false);
            return;
          }
          loads.then(
            (found) => {
              if (found.every(loadedFace)) finish(true);
              else hear(set);
            },
            () => {
              finish(false);
            },
          );
        };
        ask();
      }),

    observeResize: (fn) =>
      observer(() => {
        if (view === null || typeof view.ResizeObserver !== 'function') return null;
        return new view.ResizeObserver((entries) => {
          run(() => {
            fn(Object.freeze(entries.map((e) => Object.freeze({ target: e.target, width: e.contentRect.width, height: e.contentRect.height }))));
          });
        });
      }),

    observeIntersection: (fn, init) =>
      observer(() => {
        if (view === null || typeof view.IntersectionObserver !== 'function') return null;
        const options: IntersectionObserverInit = {};
        if (init?.rootMargin !== undefined) options.rootMargin = init.rootMargin;
        if (init?.threshold !== undefined) options.threshold = init.threshold;
        return new view.IntersectionObserver((entries) => {
          run(() => {
            fn(Object.freeze(entries.map((e) => Object.freeze({ target: e.target, isIntersecting: e.isIntersecting, ratio: e.intersectionRatio }))));
          });
        }, options);
      }),

    textWidth: (text, font) => {
      if (canvas === undefined) {
        try {
          canvas = doc.createElement('canvas').getContext('2d');
        } catch {
          canvas = null;
        }
      }
      if (canvas === null) return null;
      canvas.font = font;
      return canvas.measureText(text).width;
    },

    now: () => Date.now(),

    elementFromPoint: (x, y) => {
      const at = (doc as Document & { elementFromPoint?: unknown }).elementFromPoint;
      if (typeof at !== 'function') return null;
      const hit = doc.elementFromPoint(x, y);
      return hit !== null && root.contains(hit) ? hit : null;
    },

    computed: (el, prop) => {
      if (view === null || typeof view.getComputedStyle !== 'function' || !root.contains(el)) return '';
      return view.getComputedStyle(el).getPropertyValue(prop).trim();
    },
  };
  return Object.freeze(env);
}
