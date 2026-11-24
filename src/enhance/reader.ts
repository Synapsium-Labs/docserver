// Reader mode, the reader's half (reader mode LX6.1): one service per instance, made before the first feature builds. The host
// switches it with `setEnhancementReading(root, mode)` (the frame's `reading` op): `screens`, `scroll` or `off`. While it is not
// `off` the root carries `data-reading` (the stylesheet hides the bar, running head, progress line, rail, settings button and top
// space in place, with no remount, and the settings menu still opens from its command); the contents rail's `has-toc` class is
// taken off and put back, so the text column is the one a rail-less root has; an open contents drawer or "Changes since" menu, which
// the hidden chrome would leave open and unseen, is closed at a mode change (the figure, jump, keys sheet and settings stay). A mode that
// is not one of the three changes nothing.
//
//   mode()        the mode now ('off' until the host sends one);
//   set(mode)     switch, keeping the reader's place across the layout change; emits the 'reading' event (events.on('reading', fn):
//                 fn(mode)) for a change, never for the same mode again;
//   act(act)      tell the host something through its `onReader` callback: `menu`, `exit`, `toggle`, `active`. Nothing without the
//                 callback; `active` only while the mode is not `off`. It never paces: the frame's outbox does (BRIDGE_LIMITS.
//                 readerWindowMs for the first three, readerActiveMs for `active`), so a host that gave onReader straight to
//                 enhance() gets every call.
//
// Keys, only with the host's onReader and `keyboard`: `r` sends `exit` while the mode is not `off` and `toggle` while it is (listed
// on the keys sheet); Escape, with no overlay of the instance open (keys.ts closes one first and sends nothing), sends `exit` while the
// mode is not `off`. `active` also comes from here: a box that scrolls sideways in the root (a table, a block of code, a figure) while the
// mode is not `off`; the full-screen figure's pan and zoom call act('active') themselves (diagram-tools.ts).
//
// Import-inert: declarations only.
import type { Host } from './host.js';
import type { Journal } from './journal.js';
import type { Keys } from './keys.js';
import type { Position } from './nav.js';
import type { Overlays } from './overlays.js';
import type { Events, RelayoutReason } from './registry.js';

/** The modes the host sets; the frame wire keeps a twin (src/frame/protocol.ts READING_MODES), held equal by test. */
export const READING_MODES = ['screens', 'scroll', 'off'] as const;
export type ReadingMode = (typeof READING_MODES)[number];

/** The acts reader mode sends the host; the frame wire keeps a twin (READER_ACTS), held equal by test. */
export const READER_ACTS = ['menu', 'exit', 'toggle', 'active'] as const;
export type ReaderAct = (typeof READER_ACTS)[number];

export interface Reader {
  /** The mode now. */
  mode(): ReadingMode;
  /** Switch to `mode`; anything that is not one of READING_MODES changes nothing. */
  set(mode: unknown): void;
  /** Send `act` to the host's onReader; true when it was called (it needs the callback, and for `active` a mode that is not `off`). */
  act(act: ReaderAct): boolean;
}

export interface ReaderArgs {
  readonly root: HTMLElement;
  readonly journal: Journal;
  readonly host: Host;
  readonly keys: Keys;
  readonly overlays: Overlays;
  readonly events: Events;
  readonly position: Position;
  readonly relayout: (reason: RelayoutReason) => void;
  /** options.keyboard. */
  readonly keyboard: boolean;
  readonly live: () => boolean;
}

/** The reader mode of one instance (see the header). */
export function createReader(args: ReaderArgs): Reader {
  const { root, journal, host, keys, overlays, events, position, relayout, keyboard, live } = args;
  let mode: ReadingMode = 'off';
  /** Whether the root held the rail's `has-toc` class when reader mode took it off. */
  let hadToc = false;
  const heard = host.present.has('onReader');
  const act = (a: ReaderAct): boolean => {
    if (!live() || !heard || (a === 'active' && mode === 'off')) return false;
    host.onReader(a);
    return true;
  };
  if (keyboard && heard) {
    keys.bind({ key: 'r', label: 'Reader mode', run: () => void act(mode === 'off' ? 'toggle' : 'exit') });
    // Escape comes here only when no overlay of the instance was open (keys.ts); outside reader mode it is not ours.
    keys.bind({ key: 'Escape', label: 'Leave reader mode', listed: false, when: () => mode !== 'off', run: () => void act('exit') });
  }
  // A box that scrolls sideways (a table, a block of code, a figure) is reading that moves no vertical share: `active`.
  if (heard) {
    journal.listen(
      root,
      'scroll',
      (e) => {
        const t = e.target as Element | null;
        if (mode !== 'off' && t !== root && t !== null && t.scrollWidth > t.clientWidth) act('active');
      },
      { capture: true, passive: true },
    );
  }
  return Object.freeze({
    mode: () => mode,
    set(next: unknown): void {
      if (!live() || !(READING_MODES as readonly unknown[]).includes(next) || next === mode) return;
      const on = next !== 'off';
      const was = mode;
      position.keep(() => {
        // The contents drawer and the changes menu are chrome the stylesheet hides in a reader mode: one left open would swallow input unseen, so each
        // closes by its own owner at every mode change (the figure, jump, keys sheet and settings menu stay visible, and stay).
        for (const kind of ['changes', 'drawer'] as const) overlays.close(kind);
        mode = next as ReadingMode;
        journal.setAttribute(root, 'data-reading', on ? mode : null);
        if (was === 'off') hadToc = root.classList.contains('has-toc');
        if (hadToc && (was === 'off' || !on)) journal.toggleClass(root, 'has-toc', !on);
        relayout('prefs');
      });
      events.emit('reading', mode);
    },
    act,
  });
}
