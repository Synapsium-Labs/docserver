// Relayout (docserver L2, Task 7b): one place where measured sizes are measured again, from the reference layout's
// relayout, its resize handler and its first-paint steps.
//
//   relayout(reason)   ask for a run. Requests coalesce: the first schedules a run at the next frame (env.frame) and
//                      later ones join it, so a run carries every reason asked for since the last one.
//   onRelayout(fn)     run `fn(reasons)` on every run; its cancel stops it. A feature measures here (Task 10's table
//                      heads and code widths), never on its own resize listener.
// A run calls the listeners in the order they began listening, all inside one position.keep (the reader stays on
// the same line while sizes change; nav.ts), then emits 'relayout' with its reasons. A listener that throws does not
// stop the next, nor the event; the first throw is thrown again after it. A listener that destroys the instance stops
// the run.
//
// The triggers: 'start', once, when startup has built every feature (the lifecycle asks for it: the first measure
// waits for the first frame, as the reference's did); 'resize', the window's resize events debounced by
// RESIZE_DEBOUNCE_MS (a burst is one run); 'prefs' and 'lens', when the prefs change (the lifecycle); 'folds' (folds.ts);
// 'outline' (plans.ts); 'content' (a feature whose own work moved sizes, a drawn diagram say); and 'fonts': the reader's
// two faces are waited for, at most FONTS_WAIT_MS (env.fonts), and a wait that ends with them loaded asks for one
// run, so what was measured on the fallback metrics is measured again (LD5). env.fonts counts a face as loaded only
// when the font set holds it loaded, so a stylesheet that arrives after enhance() delays the run until its faces
// load, rather than letting it run at once on the fallback faces. A wait that runs out, or a load that fails, asks for
// none: nothing changed. Nothing runs once the instance is not live: its frame and its timers are
// env's, which destroy cancels, and a fonts wait never settles after destroy (RF5).
//
// Import-inert: declarations only.
import type { Cancel, Env } from './env.js';
import type { Position } from './nav.js';
import type { Events, RelayoutReason } from './registry.js';

/** How long the window must stop resizing before a run, in milliseconds (the reference's). */
export const RESIZE_DEBOUNCE_MS = 150;

/** The longest wait for the reader's faces, in milliseconds. */
export const FONTS_WAIT_MS = 10_000;

export interface Relayout {
  relayout(reason: RelayoutReason): void;
  onRelayout(fn: (reasons: ReadonlySet<RelayoutReason>) => void): Cancel;
}

export interface RelayoutArgs {
  readonly env: Env;
  readonly events: Events;
  readonly position: Position;
  readonly live: () => boolean;
}

/** Relayout for one instance: listens for resizes and starts the fonts wait now. */
export function createRelayout(args: RelayoutArgs): Relayout {
  const { env, events, position, live } = args;
  const listeners: ((reasons: ReadonlySet<RelayoutReason>) => void)[] = [];
  const pending = new Set<RelayoutReason>();
  let scheduled: Cancel | null = null;

  const run = (): void => {
    scheduled = null;
    const reasons: ReadonlySet<RelayoutReason> = new Set(pending);
    pending.clear();
    const faults: unknown[] = [];
    position.keep(() => {
      for (const fn of [...listeners]) {
        try {
          fn(reasons);
        } catch (e) {
          faults.push(e);
        }
        if (!live()) return;
      }
    });
    // The event goes out whatever a listener did; then a listener's throw is thrown again (it wins over the event's).
    const thrown = faults.length > 0;
    try {
      events.emit('relayout', { reasons: Object.freeze([...reasons]) });
    } finally {
      if (thrown) throw faults[0];
    }
  };

  const relayout = (reason: RelayoutReason): void => {
    pending.add(reason);
    scheduled ??= env.frame(run);
  };

  let resizing: Cancel | null = null;
  env.onResize(() => {
    resizing?.();
    resizing = env.timeout(() => {
      resizing = null;
      relayout('resize');
    }, RESIZE_DEBOUNCE_MS);
  });

  // A wait that ends once the instance is not live never settles (env.ts), so this runs only for a live instance.
  void env.fonts(FONTS_WAIT_MS).then((loaded) => {
    if (loaded) relayout('fonts');
  });

  return Object.freeze({
    relayout,
    onRelayout(fn: (reasons: ReadonlySet<RelayoutReason>) => void): Cancel {
      if (typeof fn !== 'function') throw new Error('docreader: onRelayout takes a function');
      listeners.push(fn);
      return () => {
        const at = listeners.indexOf(fn);
        if (at >= 0) listeners.splice(at, 1);
      };
    },
  });
}
