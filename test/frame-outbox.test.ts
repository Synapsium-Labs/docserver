// The frame's outbox (docserver L3, Task 5; plan Reference §8.1, §8.4 and §6.5, ruling R5, FD11; row L3.M12). Every op
// the frame sends passes through it: before ready a bounded queue (store.set coalesced per key, the latest navigate,
// version and hash, at most 4 copies, one changes); after ready a sliding-window pacer (at most 16 messages and 8
// store.set in any 1000 ms, copy's own 4 of the 16 never delayed; the ops that are not copies paced over 1000 ms plus
// a transit margin, TRANSIT_MARGIN_MS), leading-edge coalescing for navigate and version,
// 100 ms coalescing for hash, and the changes slot with its terminal rule.
//
// L3.M12 drives 10,000 random adapter calls (the enhance callbacks of createAdapters, before and after ready) on a fake
// clock whose timers fire late by a random 0 to 20 ms (the delivery jitter of the frame's own timers), and feeds every
// message the frame posts, after a random transit delay of 0 to 99 ms that keeps the port's order, into both (a) `./host`'s
// shipped token-bucket limiter, Task 9's createLimiter, and (b) a strict sliding-window limiter of 20 messages and 10
// store.set per 1000 ms. The parent answers each `changes` it admits after a random delay, at most its own 30 s deadline,
// and some answers are lost on the way back.
import { describe, expect, it } from 'vitest';
import { BRIDGE_LIMITS, type FrameToParent, type ParentToFrame } from '../src/frame/protocol.js';
import { createAdapters } from '../src/frame-runtime/adapters.js';
import { createOutbox, TRANSIT_MARGIN_MS, type Outbox, type OutboxClock } from '../src/frame-runtime/outbox.js';
import { createLimiter } from '../src/host/limits.js';

/** A seeded generator (mulberry32), so a failure replays. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A clock the test moves by hand; a timer runs at its due time plus `late()` ms, in order of time. */
class FakeClock implements OutboxClock {
  t = 0;
  private seq = 0;
  private readonly timers = new Map<number, { at: number; fn: () => void }>();
  private readonly late: () => number;
  constructor(late: () => number = () => 0) {
    this.late = late;
  }
  now(): number {
    return this.t;
  }
  setTimeout(fn: () => void, ms: number): unknown {
    this.seq += 1;
    this.timers.set(this.seq, { at: this.t + Math.max(0, ms) + this.late(), fn });
    return this.seq;
  }
  clearTimeout(handle: unknown): void {
    this.timers.delete(handle as number);
  }
  get pending(): number {
    return this.timers.size;
  }
  /** Moves to `to`, running every timer due on the way at its own time. */
  advance(to: number): void {
    for (;;) {
      const due = [...this.timers.entries()].filter(([, v]) => v.at <= to).sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
      if (due === undefined) break;
      this.timers.delete(due[0]);
      this.t = Math.max(this.t, due[1].at);
      due[1].fn();
    }
    this.t = Math.max(this.t, to);
  }
}

const SHA = (n: number): string => n.toString(16).padStart(40, '0');

interface Posted {
  readonly at: number;
  readonly msg: FrameToParent;
}

function setup(late: () => number = () => 0): { clock: FakeClock; box: Outbox; posted: Posted[] } {
  const clock = new FakeClock(late);
  const posted: Posted[] = [];
  const box = createOutbox({ clock, post: (msg) => posted.push({ at: clock.t, msg }), limits: BRIDGE_LIMITS });
  return { clock, box, posted };
}

/** The most messages (of `pick`) any closed window of `ms` holds, over the given times. */
function maxInWindow(times: readonly number[], ms: number): number {
  const ts = [...times].sort((a, b) => a - b);
  let best = 0;
  let lo = 0;
  for (let hi = 0; hi < ts.length; hi++) {
    while ((ts[hi] as number) - (ts[lo] as number) > ms) lo++;
    best = Math.max(best, hi - lo + 1);
  }
  return best;
}

describe('the outbox before ready: a bounded, coalescing queue', () => {
  it('holds every op until open(); store.set coalesces per key (latest wins); the latest navigate, version and hash', () => {
    const { clock, box, posted } = setup();
    box.send({ t: 'store.set', key: 'pref:prefs', value: '{"a":1}' });
    box.send({ t: 'navigate', href: 'a.md' });
    box.send({ t: 'store.set', key: 'pref:prefs', value: '{"a":2}' });
    box.send({ t: 'navigate', href: 'b.md' });
    box.send({ t: 'hash', id: 'x' });
    box.send({ t: 'hash', id: 'y' });
    box.send({ t: 'version', sha: SHA(1) });
    box.send({ t: 'version' });
    clock.advance(5000);
    expect(posted).toEqual([]);
    box.open();
    clock.advance(5000);
    expect(posted.map((p) => p.msg)).toEqual([
      { t: 'store.set', key: 'pref:prefs', value: '{"a":2}' },
      { t: 'navigate', href: 'b.md' },
      { t: 'hash', id: 'y' },
      { t: 'version' },
    ]);
  });

  it('queues at most 4 copies: a fifth is refused; the four go at once on open, never behind the pacer', () => {
    const { clock, box, posted } = setup();
    for (let i = 0; i < 20; i++) box.send({ t: 'store.set', key: i % 2 === 0 ? 'pref:prefs' : 'pref:ui', value: String(i) });
    for (let i = 0; i < 4; i++) expect(box.copy(`c${String(i)}`)).toBe(true);
    expect(box.copy('c4')).toBe(false);
    clock.advance(100);
    box.open();
    expect(posted.filter((p) => p.msg.t === 'copy').map((p) => [p.at, p.msg])).toEqual(
      [0, 1, 2, 3].map((i) => [100, { t: 'copy', text: `c${String(i)}` }]),
    );
  });

  it('one changes: a newer request supersedes the queued one, which resolves null at once and is never sent', async () => {
    const { clock, box, posted } = setup();
    const first = box.changes(SHA(1));
    const second = box.changes(SHA(2));
    await expect(first).resolves.toBeNull();
    box.open();
    clock.advance(10);
    expect(posted.map((p) => p.msg)).toEqual([{ t: 'changes', sha: SHA(2) }]);
    box.answer({ t: 'changes.result', sha: SHA(2), ranges: [[1, 2]] });
    await expect(second).resolves.toEqual({ changed: [[1, 2]] });
  });

  it('open() flushes everything queued (the 64-entry cap is a defensive bound the coalescing never reaches: at most 16 entries)', () => {
    const { box, posted, clock } = setup();
    // The coalescing bounds the queue at 8 keys + navigate + version + hash + 4 copies + changes = 16 entries, so the
    // 64 cap (QUEUE_MAX, and its drop of the oldest entry that is not a store.set) is unreachable from any input: no
    // row can go red without it, and it is recorded as such (C86 (3)). This row pins only that open() flushes all 8.
    for (const k of ['pref:prefs', 'pref:ui', 'doc:folds', 'doc:ixfold', 'doc:marks', 'doc:outline', 'doc:pos', 'doc:seen'] as const) {
      box.send({ t: 'store.set', key: k, value: '1' });
    }
    box.open();
    clock.advance(3000);
    expect(posted).toHaveLength(8);
  });
});

describe('the outbox after ready: the pacer', () => {
  it('sends at most 12 ops that are not copies in any 1000 ms plus the transit margin, holding the next until the oldest is older than that', () => {
    const { clock, box, posted } = setup();
    box.open();
    const keys = ['pref:prefs', 'pref:ui', 'doc:folds', 'doc:ixfold', 'doc:marks', 'doc:outline', 'doc:pos', 'doc:seen'] as const;
    for (let t = 0; t < 3000; t += 10) {
      clock.advance(t);
      box.send({ t: 'hash', id: `h${String(t)}` });
      box.send({ t: 'navigate', href: `n${String(t)}.md` });
      box.send({ t: 'version', only: SHA(t + 1) });
      box.send({ t: 'store.set', key: keys[(t / 10) % keys.length] ?? 'pref:ui', value: String(t) });
    }
    clock.advance(20_000);
    const times = posted.map((p) => p.at);
    const paced = BRIDGE_LIMITS.frameWindowMs + TRANSIT_MARGIN_MS;
    expect(TRANSIT_MARGIN_MS).toBe(100);
    expect(maxInWindow(times, paced)).toBe(12);
    expect(maxInWindow(posted.filter((p) => p.msg.t === 'store.set').map((p) => p.at), paced)).toBeLessThanOrEqual(8);
    // Exact: each message waits until the oldest of the 12 before it is more than 1000 ms plus the margin old.
    const sorted = [...times].sort((a, b) => a - b);
    for (let i = 12; i < sorted.length; i++) expect((sorted[i] as number) - (sorted[i - 12] as number)).toBeGreaterThan(paced);
    expect(sorted.slice(12).some((t, i) => t - (sorted[i] as number) === paced + 1)).toBe(true);
  });

  it('a store.set burst never delays a copy: the copy is posted at the instant it is asked for', () => {
    const { clock, box, posted } = setup();
    box.open();
    for (let i = 0; i < 8; i++) box.send({ t: 'store.set', key: i % 2 === 0 ? 'pref:prefs' : 'pref:ui', value: String(i) });
    box.send({ t: 'navigate', href: 'x.md' });
    for (let i = 0; i < 6; i++) box.send({ t: 'store.set', key: (['doc:folds', 'doc:marks', 'doc:seen'] as const)[i % 3] ?? 'doc:seen', value: String(i) });
    clock.advance(37);
    expect(box.copy('now')).toBe(true);
    expect(posted.at(-1)).toEqual({ at: 37, msg: { t: 'copy', text: 'now' } });
  });

  it("copy has its own 4 in any sliding 1000 ms: a fifth is refused, and one more is accepted once the oldest is over 1000 ms old", () => {
    const { clock, box } = setup();
    box.open();
    for (let i = 0; i < 4; i++) expect(box.copy('x')).toBe(true);
    expect(box.copy('x')).toBe(false);
    clock.advance(1000);
    expect(box.copy('x')).toBe(false);
    clock.advance(1001);
    expect(box.copy('x')).toBe(true);
  });

  it('navigate and version are leading-edge: the first at once, the latest of those within 250 ms once the window ends', () => {
    const { clock, box, posted } = setup();
    box.open();
    box.send({ t: 'navigate', href: 'a.md' });
    clock.advance(10);
    box.send({ t: 'navigate', href: 'b.md' });
    box.send({ t: 'navigate', href: 'c.md' });
    clock.advance(249);
    expect(posted.map((p) => p.msg)).toEqual([{ t: 'navigate', href: 'a.md' }]);
    clock.advance(251);
    expect(posted.map((p) => [p.at, p.msg])).toEqual([
      [0, { t: 'navigate', href: 'a.md' }],
      [250, { t: 'navigate', href: 'c.md' }],
    ]);
    box.send({ t: 'version', only: SHA(3) });
    box.send({ t: 'version' });
    clock.advance(1000);
    expect(posted.slice(2).map((p) => [p.at, p.msg])).toEqual([
      [251, { t: 'version', only: SHA(3) }],
      [501, { t: 'version' }],
    ]);
  });

  it('hash coalesces over 100 ms: the latest id once the window ends', () => {
    const { clock, box, posted } = setup();
    box.open();
    box.send({ t: 'hash', id: 'a' });
    clock.advance(40);
    box.send({ t: 'hash', id: 'b' });
    clock.advance(99);
    expect(posted).toEqual([]);
    clock.advance(100);
    expect(posted).toEqual([{ at: 100, msg: { t: 'hash', id: 'b' } }]);
  });
});

describe('the changes slot and its terminal rule (Reference §6.5)', () => {
  it('one in flight, one queued: a third supersedes the queued one (null at once); answers end each exactly once', async () => {
    const { clock, box, posted } = setup();
    box.open();
    const a = box.changes(SHA(1));
    const b = box.changes(SHA(2));
    const c = box.changes(SHA(3));
    await expect(b).resolves.toBeNull();
    clock.advance(1);
    expect(posted.map((p) => p.msg)).toEqual([{ t: 'changes', sha: SHA(1) }]);
    box.answer({ t: 'changes.result', sha: SHA(9), ranges: [] });
    box.answer({ t: 'changes.result', sha: SHA(1), unavailable: true });
    await expect(a).resolves.toBeNull();
    clock.advance(2);
    expect(posted.map((p) => p.msg).slice(1)).toEqual([{ t: 'changes', sha: SHA(3) }]);
    box.answer({ t: 'changes.result', sha: SHA(3), ranges: [[1, 4]], removedAfter: [7] });
    await expect(c).resolves.toEqual({ changed: [[1, 4]], removedAfter: [7] });
    // A late duplicate answer changes nothing.
    box.answer({ t: 'changes.result', sha: SHA(3), ranges: [[9, 9]] });
  });

  it('a sent request unanswered after 35 s resolves null and frees the slot for the queued one', async () => {
    const { clock, box, posted } = setup();
    box.open();
    const a = box.changes(SHA(1));
    const b = box.changes(SHA(2));
    // Read without awaiting a promise that might never settle: a missing timeout is an assertion, not a hang.
    const ended: unknown[] = [];
    void a.then((v) => {
      ended.push(v);
    });
    clock.advance(BRIDGE_LIMITS.frameChangesTimeoutMs - 1);
    await Promise.resolve();
    expect(ended).toEqual([]);
    clock.advance(BRIDGE_LIMITS.frameChangesTimeoutMs);
    await Promise.resolve();
    expect(ended).toEqual([null]);
    expect(posted.map((p) => p.msg)).toEqual([{ t: 'changes', sha: SHA(1) }, { t: 'changes', sha: SHA(2) }]);
    expect(posted[1]?.at).toBe(BRIDGE_LIMITS.frameChangesTimeoutMs);
    box.answer({ t: 'changes.result', sha: SHA(2), ranges: [] });
    await expect(b).resolves.toEqual({ changed: [] });
  });

  it('dispose ends every pending request with null and sends nothing more', async () => {
    const { clock, box, posted } = setup();
    const a = box.changes(SHA(1));
    box.send({ t: 'navigate', href: 'x.md' });
    box.dispose();
    await expect(a).resolves.toBeNull();
    box.open();
    expect(box.copy('x')).toBe(false);
    await expect(box.changes(SHA(2))).resolves.toBeNull();
    clock.advance(60_000);
    expect(posted).toEqual([]);
    expect(clock.pending).toBe(0);
  });
});

/** The transit delay L3.M12 draws for each message, 0 to this less 1 ms, order kept. */
const TRANSIT_JITTER_MS = 100;

/** A strict sliding-window limiter: a message is refused when the closed 1000 ms window ending at it would hold more. */
function strictWindow(maxAll: number, maxStore: number): (at: number, msg: FrameToParent) => boolean {
  const all: number[] = [];
  const store: number[] = [];
  return (at, msg) => {
    const recent = (xs: number[]): number => xs.filter((t) => at - t < BRIDGE_LIMITS.frameWindowMs).length;
    if (recent(all) + 1 > maxAll) return false;
    if (msg.t === 'store.set' && recent(store) + 1 > maxStore) return false;
    all.push(at);
    if (msg.t === 'store.set') store.push(at);
    return true;
  };
}

interface Run {
  readonly refusedA: number;
  readonly refusedB: number;
  readonly sent: Posted[];
  readonly copyDelays: number[];
  readonly changesCalls: number;
  readonly changesEnded: number[];
  readonly endedTwice: number;
  readonly timedOut: number;
  readonly superseded: number;
}

/** L3.M12's run: `calls` random adapter calls, ready at a random point, everything fed to both readings. */
async function randomRun(seed: number, calls: number): Promise<Run> {
  const r = rng(seed);
  const clock = new FakeClock(() => Math.floor(r() * 21));
  const sent: Posted[] = [];
  let refusedA = 0;
  let refusedB = 0;
  // The return path: the parent's answers, each delivered to the frame after its own delay (or lost).
  let box: Outbox | undefined;
  const limiter = createLimiter({
    clock,
    deliver: (msg) => {
      if (msg.t !== 'changes') return;
      const lost = r() < 0.15;
      const after = Math.floor(r() * 40_000);
      const answerAt = Math.min(after, BRIDGE_LIMITS.changesTimeoutMs);
      clock.setTimeout(() => {
        limiter.changesDone();
        if (lost) return;
        const reply: ParentToFrame =
          after > BRIDGE_LIMITS.changesTimeoutMs || r() < 0.2
            ? { t: 'changes.result', sha: msg.sha, unavailable: true }
            : { t: 'changes.result', sha: msg.sha, ranges: [[1, 2]] };
        clock.setTimeout(() => box?.answer(reply as Extract<ParentToFrame, { t: 'changes.result' }>), Math.floor(r() * 30));
      }, answerAt);
    },
  });
  const strict = strictWindow(20, 10);
  let lastArrival = 0;
  const post = (msg: FrameToParent): void => {
    sent.push({ at: clock.t, msg });
    // Transit keeps the port's order: a message never arrives before the one posted ahead of it. Both readings see
    // the jittered arrival: two pacer bursts the frame sends just over 1000 ms apart can arrive closer together when
    // the first is delayed more than the second, and the pacer's transit margin is what keeps a strict window of
    // arrivals from holding both.
    const arrival = Math.max(lastArrival, clock.t + Math.floor(r() * TRANSIT_JITTER_MS));
    lastArrival = arrival;
    clock.setTimeout(() => {
      if (!limiter.admit(msg).ok) refusedA += 1;
      if (!strict(clock.t, msg)) refusedB += 1;
    }, arrival - clock.t);
  };
  box = createOutbox({ clock, post, limits: BRIDGE_LIMITS });
  const outbox = box;
  const a = createAdapters(outbox, {
    snapshot: [],
    bridge: { links: true, hash: true, copy: true, changes: true, versions: true },
  });
  const l2Keys = ['docreader:prefs', 'docreader:ui', 'docreader:pos:doc', 'docreader:doc:doc:folds', 'docreader:doc:doc:marks', 'docreader:doc:doc:seen', 'docreader:doc:doc:outline', 'docreader:doc:doc:ixfold', 'docreader:other'];
  const copyDelays: number[] = [];
  let changesCalls = 0;
  const changesEnded: number[] = [];
  let endedTwice = 0;
  let timedOut = 0;
  let superseded = 0;
  const readyAt = Math.floor(r() * calls * 0.2);
  for (let i = 0; i < calls; i++) {
    if (i === readyAt) outbox.open();
    // Bursts and gaps: most calls come in quick runs, some after a pause.
    const gap = r() < 0.9 ? Math.floor(r() * 8) : Math.floor(r() * 3000);
    clock.advance(clock.t + gap);
    const pick = r();
    if (pick < 0.45) a.storage.set(l2Keys[Math.floor(r() * l2Keys.length)] ?? 'docreader:ui', r() < 0.1 ? null : JSON.stringify({ i }));
    else if (pick < 0.6) a.onLink?.(`doc-${String(i)}.md`, { newTab: r() < 0.5 });
    else if (pick < 0.72) a.onHash?.(`h${String(i)}`, { push: r() < 0.5, from: null });
    else if (pick < 0.8) a.openVersion?.({ sha: r() < 0.5 ? SHA(i) : null, only: null });
    else if (pick < 0.9) {
      const askedAt = clock.t;
      const before = sent.length;
      const p = a.copy?.(`copy ${String(i)}`);
      if (p !== undefined) {
        const accepted = await p.then(
          () => true,
          () => false,
        );
        const mine = sent.slice(before).find((s) => s.msg.t === 'copy' && s.msg.text === `copy ${String(i)}`);
        if (accepted && mine !== undefined) copyDelays.push(mine.at - askedAt);
        else if (accepted && i >= readyAt) copyDelays.push(Infinity);
      }
    } else {
      changesCalls += 1;
      const idx = changesCalls;
      let ended = 0;
      const askedAt = clock.t;
      const pr = a.changes?.(SHA(i));
      void pr?.then((v) => {
        ended += 1;
        if (ended > 1) endedTwice += 1;
        else changesEnded.push(idx);
        if (v === null && clock.t - askedAt >= BRIDGE_LIMITS.frameChangesTimeoutMs) timedOut += 1;
        if (v === null && clock.t === askedAt) superseded += 1;
      });
    }
    await Promise.resolve();
  }
  if (readyAt >= calls) outbox.open();
  // Let every timer run out: 35 s deadlines, coalescing windows, transit.
  for (let k = 0; k < 40; k++) {
    clock.advance(clock.t + 5000);
    await Promise.resolve();
    await Promise.resolve();
  }
  return { refusedA, refusedB, sent, copyDelays, changesCalls, changesEnded, endedTwice, timedOut, superseded };
}

describe('L3.M12: 10,000 random adapter calls with timer jitter, their jittered arrivals fed into both readings of the parent limits', () => {
  for (const seed of [1, 2, 3]) {
    it(`seed ${String(seed)}: 0 refusals from the token buckets and from a strict 20/10 sliding window, both reading the jittered arrivals; no 1000 ms holds more than 16 messages or 8 store.set; a copy is never delayed; every changes ends exactly once`, async () => {
      const run = await randomRun(seed, 10_000);
      expect(run.sent.length).toBeGreaterThan(1000);
      expect({ refusedA: run.refusedA, refusedB: run.refusedB }).toEqual({ refusedA: 0, refusedB: 0 });
      expect(maxInWindow(run.sent.map((s) => s.at), 1000)).toBeLessThanOrEqual(16);
      expect(maxInWindow(run.sent.filter((s) => s.msg.t === 'store.set').map((s) => s.at), 1000)).toBeLessThanOrEqual(8);
      // The pacer did hold traffic back, so the windows above are a measurement of it.
      expect(maxInWindow(run.sent.filter((s) => s.msg.t !== 'copy').map((s) => s.at), 1000)).toBe(12);
      expect(run.copyDelays.length).toBeGreaterThan(100);
      expect(run.copyDelays.filter((d) => d !== 0)).toEqual([]);
      expect(run.endedTwice).toBe(0);
      expect(run.changesEnded).toHaveLength(run.changesCalls);
      expect(run.timedOut).toBeGreaterThan(0);
      expect(run.superseded).toBeGreaterThan(0);
    }, 120_000);
  }
});
