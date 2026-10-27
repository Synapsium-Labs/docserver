// The frame's outbox (docserver L3, Task 5; plan Reference §8.1, §8.4 and §6.5, ruling R5, FD11): every op the frame
// sends after `ready` passes here, so the frame is never refused under either reading of the parent's limits, a token
// bucket (40 refilled at 20 a second; store.set 10 at 10) or a strict 1-second sliding window. Bundled into the
// bootstrap; DOM-free, and its time and timers come from the caller's clock, so a test runs it on a fake one.
//
// Before open() (the frame's `ready`): a bounded queue of 64 entries, in arrival order: store.set coalesced per key
// (the latest value wins and moves to the end), the latest navigate, version and hash, at most 4 copies (a fifth is
// refused), one changes (a newer request supersedes the queued one, which resolves null at once and is never sent).
// Past 64 entries the oldest entry that is not a store.set is dropped; with the coalescing above the queue holds at most
// 16, so the cap is a defensive bound. open() flushes it: the copies at once, every other entry through the pacer.
//
// After open(), the pacer: it records the send time of each message and holds the next op that is not a copy until the
// oldest of the last 12 such is more than 1000 ms plus TRANSIT_MARGIN_MS old, and the next store.set until the oldest
// of the last 8 store.set is (exact send times, not an estimate). The margin is for the parent's side: a port delivers
// in order but not at a fixed delay, so two pacer bursts sent just over 1000 ms apart can arrive closer together when
// the first is delayed more than the second. With the margin, any 1000 ms of arrivals holds what the frame sent within
// 1000 ms plus the margin, at most 12 such ops and 8 store.set, as long as transit varies by less than the margin; with
// copy's 4 on each side of a window that is at most 20, so even a strict sliding-window reading of the parent's limits
// over arrivals refuses nothing. Copy has its own 4 of the 16: a copy is posted at the instant it is asked for, or
// refused when 4 copies went in the last 1000 ms, so a burst of other ops never delays one. Ops that are not copies go in order;
// a store.set still waiting takes a newer value for its key in place. navigate and version are coalesced on the leading
// edge: the first goes at once and opens a 250 ms window, and the latest of those asked for within it goes when it ends
// (which opens the next). hash is coalesced over 100 ms: the latest id when the window that the first opened ends.
//
// The changes slot: one request in flight, one queued. A request is in flight from the instant it is posted; its
// answer (answer(), matched by sha) or 35 s without one (frameChangesTimeoutMs, longer than the parent's own 30 s)
// ends it and frees the slot for the queued one. A queued request superseded by a newer one is never sent and resolves
// null at once. Every request ends exactly once. dispose() ends every pending request with null, drops every queue and
// timer, and refuses everything after.
import type { BRIDGE_LIMITS, FrameToParent, ParentToFrame } from '../frame/protocol.js';

/** The time source and timers the outbox uses: `now()` in milliseconds, and a timer pair like the window's. */
export interface OutboxClock {
  now(): number;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

/** The limits the outbox paces by (BRIDGE_LIMITS). */
export type OutboxLimits = Pick<
  typeof BRIDGE_LIMITS,
  'frameWindowMs' | 'frameMaxPerWindow' | 'frameStoreSetMaxPerWindow' | 'frameCopyMaxPerWindow' | 'frameChangesTimeoutMs' | 'coalesceMs'
>;

export interface OutboxOptions {
  readonly clock: OutboxClock;
  /** Posts one message on the port. */
  readonly post: (msg: FrameToParent) => void;
  readonly limits: OutboxLimits;
}

/** The ops send() takes; copy and changes have their own calls. */
export type QueuedOp = Extract<FrameToParent, { t: 'store.set' | 'navigate' | 'version' | 'hash' }>;

/** A changes answer as L2's `changes` callback resolves it (L2's readChangeSet reads it), or null. */
export interface ChangesAnswer {
  readonly changed: readonly (readonly [number, number])[];
  readonly removedAfter?: readonly number[];
}

export type ChangesResult = Extract<ParentToFrame, { t: 'changes.result' }>;

export interface Outbox {
  /** store.set, navigate, version or hash: queued before open(), paced and coalesced after. */
  send(op: QueuedOp): void;
  /** A copy: true when it was posted (or queued before open()), false when it is refused (its share is spent). */
  copy(text: string): boolean;
  /** A changes request for a full sha (the caller checks the grammar); resolves once, with the answer or null. */
  changes(sha: string): Promise<ChangesAnswer | null>;
  /** The parent's changes.result: ends the request in flight when the sha matches; anything else is ignored. */
  answer(m: ChangesResult): void;
  /** The frame is ready: flush the queue through the pacer. Once only. */
  open(): void;
  /** Ends every pending request with null, drops every queue and timer, and refuses everything after. */
  dispose(): void;
}

/** The pre-ready queue's bound. */
const QUEUE_MAX = 64;
/** hash's coalescing window. */
const HASH_MS = 100;
/** How much transit delay may vary while the pacer still keeps every 1000 ms of arrivals within the parent's limits. */
export const TRANSIT_MARGIN_MS = 100;

interface Request {
  readonly sha: string;
  readonly resolve: (v: ChangesAnswer | null) => void;
  timer: unknown;
  posted: boolean;
}

/** One entry of the pre-ready queue or of the pacer's line. */
type Entry = { readonly kind: 'op'; op: QueuedOp } | { readonly kind: 'copy'; readonly text: string } | { readonly kind: 'changes'; readonly req: Request };

/** A coalescing window: whether one is running, the latest op it holds, and its timer. */
interface Lane {
  active: boolean;
  held: QueuedOp | null;
  timer: unknown;
}

/** An outbox for one frame (see the header). */
export function createOutbox(o: OutboxOptions): Outbox {
  const { clock, post, limits: L } = o;
  const otherMax = L.frameMaxPerWindow - L.frameCopyMaxPerWindow;
  /** The pacer's window: the parent's, widened by the transit margin (see the header). */
  const paceMs = L.frameWindowMs + TRANSIT_MARGIN_MS;
  let opened = false;
  let disposed = false;
  /** Before open(): the bounded queue. After: unused. */
  let early: Entry[] = [];
  /** After open(): the ops that are not copies, waiting for the pacer, in order. */
  let line: Entry[] = [];
  const sentOther: number[] = [];
  const sentStore: number[] = [];
  const sentCopy: number[] = [];
  let pacerTimer: unknown;
  let current: Request | null = null;
  let next: Request | null = null;
  const lanes: Record<'navigate' | 'version', Lane> = {
    navigate: { active: false, held: null, timer: undefined },
    version: { active: false, held: null, timer: undefined },
  };
  const hashLane: Lane = { active: false, held: null, timer: undefined };

  /** The send times in `xs` no more than `ms` old at `now` (older ones are dropped for good). */
  const recent = (xs: number[], now: number, ms: number): number => {
    while (xs.length > 0 && now - (xs[0] as number) > ms) xs.shift();
    return xs.length;
  };

  const end = (req: Request, v: ChangesAnswer | null): void => {
    if (req.timer !== undefined) clock.clearTimeout(req.timer);
    req.timer = undefined;
    req.resolve(v);
  };

  /** The request in flight ended: the queued one, if any, takes the slot. */
  const advance = (): void => {
    current = next;
    next = null;
    if (current !== null) enqueue({ kind: 'changes', req: current });
  };

  const postEntry = (e: Entry, now: number): void => {
    if (e.kind === 'copy') {
      sentCopy.push(now);
      post({ t: 'copy', text: e.text });
      return;
    }
    sentOther.push(now);
    if (e.kind === 'changes') {
      const req = e.req;
      req.posted = true;
      req.timer = clock.setTimeout(() => {
        req.timer = undefined;
        if (current !== req) return;
        end(req, null);
        advance();
      }, L.frameChangesTimeoutMs);
      post({ t: 'changes', sha: req.sha });
      return;
    }
    if (e.op.t === 'store.set') sentStore.push(now);
    post(e.op);
  };

  /** Post every op of the line the windows allow now; set one timer for when the head may go. */
  const pump = (): void => {
    if (disposed) return;
    if (pacerTimer !== undefined) clock.clearTimeout(pacerTimer);
    pacerTimer = undefined;
    for (;;) {
      const head = line[0];
      if (head === undefined) return;
      const now = clock.now();
      const isStore = head.kind === 'op' && head.op.t === 'store.set';
      let wait = 0;
      if (recent(sentOther, now, paceMs) >= otherMax) wait = Math.max(wait, (sentOther[sentOther.length - otherMax] as number) + paceMs + 1 - now);
      if (isStore && recent(sentStore, now, paceMs) >= L.frameStoreSetMaxPerWindow) {
        wait = Math.max(wait, (sentStore[sentStore.length - L.frameStoreSetMaxPerWindow] as number) + paceMs + 1 - now);
      }
      if (wait > 0) {
        pacerTimer = clock.setTimeout(() => {
          pacerTimer = undefined;
          pump();
        }, wait);
        return;
      }
      line.shift();
      postEntry(head, now);
    }
  };

  /** Into the pacer's line; a store.set still waiting for its key takes the newer value in place. */
  function enqueue(e: Entry): void {
    if (e.kind === 'op' && e.op.t === 'store.set') {
      const key = e.op.key;
      const waiting = line.find((x) => x.kind === 'op' && x.op.t === 'store.set' && x.op.key === key);
      if (waiting !== undefined && waiting.kind === 'op') {
        waiting.op = e.op;
        return;
      }
    }
    line.push(e);
    pump();
  }

  /** A leading-edge lane: the first at once, the latest of the window's when it ends. */
  const lead = (lane: Lane, op: QueuedOp): void => {
    if (lane.active) {
      lane.held = op;
      return;
    }
    const openWindow = (): void => {
      lane.active = true;
      lane.timer = clock.setTimeout(() => {
        lane.timer = undefined;
        const held = lane.held;
        lane.held = null;
        if (held === null || disposed) {
          lane.active = false;
          return;
        }
        openWindow();
        enqueue({ kind: 'op', op: held });
      }, L.coalesceMs);
    };
    openWindow();
    enqueue({ kind: 'op', op });
  };

  /** hash: the latest of the 100 ms the first opened. */
  const trail = (op: QueuedOp): void => {
    hashLane.held = op;
    if (hashLane.active) return;
    hashLane.active = true;
    hashLane.timer = clock.setTimeout(() => {
      hashLane.timer = undefined;
      hashLane.active = false;
      const held = hashLane.held;
      hashLane.held = null;
      if (held !== null && !disposed) enqueue({ kind: 'op', op: held });
    }, HASH_MS);
  };

  /** Into the pre-ready queue, with its coalescing and its bound. */
  const queueEarly = (e: Entry): void => {
    if (e.kind === 'op') {
      const op = e.op;
      early = early.filter((x) => !(x.kind === 'op' && x.op.t === op.t && (op.t !== 'store.set' || (x.op.t === 'store.set' && x.op.key === op.key))));
    }
    early.push(e);
    if (early.length > QUEUE_MAX) {
      const drop = early.findIndex((x) => !(x.kind === 'op' && x.op.t === 'store.set'));
      if (drop >= 0) {
        const [gone] = early.splice(drop, 1);
        if (gone?.kind === 'changes') {
          if (current === gone.req) current = null;
          end(gone.req, null);
        }
      }
    }
  };

  const route = (op: QueuedOp): void => {
    if (op.t === 'navigate' || op.t === 'version') lead(lanes[op.t], op);
    else if (op.t === 'hash') trail(op);
    else enqueue({ kind: 'op', op });
  };

  return {
    send(op) {
      if (disposed) return;
      if (!opened) queueEarly({ kind: 'op', op });
      else route(op);
    },
    copy(text) {
      if (disposed) return false;
      if (!opened) {
        if (early.filter((x) => x.kind === 'copy').length >= L.frameCopyMaxPerWindow) return false;
        queueEarly({ kind: 'copy', text });
        return true;
      }
      const now = clock.now();
      if (recent(sentCopy, now, L.frameWindowMs) >= L.frameCopyMaxPerWindow) return false;
      postEntry({ kind: 'copy', text }, now);
      return true;
    },
    changes(sha) {
      return new Promise<ChangesAnswer | null>((resolve) => {
        if (disposed) {
          resolve(null);
          return;
        }
        const req: Request = { sha, resolve, timer: undefined, posted: false };
        if (!opened) {
          // Before ready nothing is in flight: the newer request supersedes the queued one.
          if (current !== null) {
            const old = current;
            early = early.filter((x) => !(x.kind === 'changes' && x.req === old));
            end(old, null);
          }
          current = req;
          queueEarly({ kind: 'changes', req });
          return;
        }
        if (current === null) {
          current = req;
          enqueue({ kind: 'changes', req });
          return;
        }
        if (next !== null) end(next, null);
        next = req;
      });
    },
    answer(m) {
      const req = current;
      if (disposed || req === null || !req.posted || m.sha !== req.sha) return;
      const reply: ChangesAnswer | null =
        'unavailable' in m ? null : m.removedAfter === undefined ? { changed: m.ranges } : { changed: m.ranges, removedAfter: m.removedAfter };
      end(req, reply);
      advance();
    },
    open() {
      if (opened || disposed) return;
      opened = true;
      const queued = early;
      early = [];
      const now = clock.now();
      for (const e of queued) {
        if (e.kind === 'copy') postEntry(e, now);
        else if (e.kind === 'changes' || e.op.t === 'hash' || e.op.t === 'store.set') enqueue(e);
        else lead(lanes[e.op.t], e.op);
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const t of [pacerTimer, lanes.navigate.timer, lanes.version.timer, hashLane.timer]) if (t !== undefined) clock.clearTimeout(t);
      for (const req of [current, next]) if (req !== null) end(req, null);
      for (const e of early) if (e.kind === 'changes' && e.req !== current) end(e.req, null);
      current = null;
      next = null;
      early = [];
      line = [];
    },
  };
}
