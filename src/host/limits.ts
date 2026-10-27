// `./host`'s limiter (docserver L3, Task 9; plan Reference §8.4 and §11.3, ruling R5, FD11). After a valid ready, every
// message the parser accepts passes here before it has any effect. The parent's limits read as two token buckets, both
// full at ready: a general bucket of BRIDGE_LIMITS.bucketCapacity (40) refilled at bucketRefillPerSecond (20) a second,
// and a store.set bucket of storeSetBucketCapacity (10) refilled at storeSetRefillPerSecond (10) a second. conformance/
// bridge-cases.json's `sequenceRules` fix the reading exactly: refill is continuous, counted in whole milliseconds and
// kept in integer milli-tokens; every message takes one general token and a store.set one store token too; a message
// passes only when each bucket it draws on holds a whole token, and a refused message takes none.
//
// Beside the buckets: one `changes` in flight (a second is refused until changesDone()); `navigate` and `version`
// coalesced over coalesceMs (250 ms), each in its own lane (the first is delivered at once, the latest of those that
// follow within the window is delivered at its end, which opens the next window); and the refusal count, the parser's
// refusals (refuse()) and the rate refusals together, of which the refusalsToClose-th (16th) closes the bridge.
// Every op draws on the buckets, `error` included, exactly as the sequenceRules say ("every message takes one general
// token"): the frame paces itself under both readings (FD11), so an `error` meets an empty bucket only after a flood.
// The limiter owns no deadline: the caller answers a `changes` (or gives up at changesTimeoutMs, 30 s) and then calls
// changesDone() to free the slot.
//
// Import-inert: a factory only. Each limiter keeps its own state in its closure; two mounts share nothing. Time comes
// from the caller's clock, so a test runs it on a fake one.
import { BRIDGE_LIMITS, type FrameToParent } from '../frame/protocol.js';

/** The time source and timers a limiter uses: `now()` in milliseconds, and a timer pair like the window's. */
export interface LimiterClock {
  now(): number;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export interface LimiterOptions {
  readonly clock: LimiterClock;
  /** Called once for every message that passes, at once or, for a coalesced one, at its window's end. */
  readonly deliver: (msg: FrameToParent) => void;
}

/**
 * The verdict on one message: passed (delivered now, or held for its coalescing window), or refused. `closes` is true on
 * the refusal that reaches the close count; a limiter that is closed or disposed refuses everything with 'closed'.
 */
export type Admission = { readonly ok: true } | { readonly ok: false; readonly reason: 'rate' | 'closed'; readonly closes: boolean };

export interface Limiter {
  /** Judges one message the parser accepted. */
  admit(msg: FrameToParent): Admission;
  /** Counts one refusal made elsewhere (the parser's, a messageerror); true when it closes the bridge. */
  refuse(): boolean;
  /** The `changes` in flight has its answer (or its deadline passed): the slot is free again. */
  changesDone(): void;
  readonly refusals: number;
  readonly closed: boolean;
  /** Drops any held message and its timer; afterwards nothing is delivered and every message is refused. */
  dispose(): void;
}

const MILLI = 1000;

interface Lane {
  open: boolean;
  held: FrameToParent | undefined;
  timer: unknown;
}

/** A limiter for one mount, from a valid ready on (both buckets full at creation). */
export function createLimiter(o: LimiterOptions): Limiter {
  const L = BRIDGE_LIMITS;
  const { clock, deliver } = o;
  const generalMax = L.bucketCapacity * MILLI;
  const storeMax = L.storeSetBucketCapacity * MILLI;
  let general = generalMax;
  let store = storeMax;
  let last = Math.floor(clock.now());
  let refusals = 0;
  let closed = false;
  let disposed = false;
  let changesInFlight = 0;
  const lanes: Record<'navigate' | 'version', Lane> = {
    navigate: { open: false, held: undefined, timer: undefined },
    version: { open: false, held: undefined, timer: undefined },
  };

  /** Adds the whole milliseconds since the last look; a clock that runs backwards adds nothing. */
  const refill = (): void => {
    const now = Math.floor(clock.now());
    if (!(now > last)) return;
    const dt = now - last;
    last = now;
    general = Math.min(generalMax, general + dt * L.bucketRefillPerSecond);
    store = Math.min(storeMax, store + dt * L.storeSetRefillPerSecond);
  };

  const countRefusal = (): boolean => {
    refusals += 1;
    if (refusals >= L.refusalsToClose && !closed) {
      closed = true;
      return true;
    }
    return false;
  };

  const rate = (): Admission => ({ ok: false, reason: 'rate', closes: countRefusal() });

  const openWindow = (lane: Lane): void => {
    lane.open = true;
    lane.timer = clock.setTimeout(() => {
      lane.timer = undefined;
      const held = lane.held;
      lane.held = undefined;
      if (held === undefined || disposed || closed) {
        lane.open = false;
        return;
      }
      openWindow(lane);
      deliver(held);
    }, L.coalesceMs);
  };

  return {
    admit(msg) {
      if (closed || disposed) return { ok: false, reason: 'closed', closes: false };
      refill();
      const isStore = msg.t === 'store.set';
      const hasTokens = general >= MILLI && (!isStore || store >= MILLI);
      if (!hasTokens) return rate();
      if (msg.t === 'changes' && changesInFlight >= L.changesInFlight) return rate();
      general -= MILLI;
      if (isStore) store -= MILLI;
      if (msg.t === 'changes') changesInFlight += 1;
      if (msg.t === 'navigate' || msg.t === 'version') {
        const lane = lanes[msg.t];
        if (lane.open) {
          lane.held = msg;
          return { ok: true };
        }
        openWindow(lane);
      }
      deliver(msg);
      return { ok: true };
    },
    refuse() {
      if (closed || disposed) return false;
      return countRefusal();
    },
    changesDone() {
      if (changesInFlight > 0) changesInFlight -= 1;
    },
    get refusals() {
      return refusals;
    },
    get closed() {
      return closed;
    },
    dispose() {
      disposed = true;
      for (const lane of Object.values(lanes)) {
        if (lane.timer !== undefined) clock.clearTimeout(lane.timer);
        lane.timer = undefined;
        lane.held = undefined;
        lane.open = false;
      }
    },
  };
}
