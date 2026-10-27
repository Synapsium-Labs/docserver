// `./host`'s limiter (docserver L3, Task 9; plan Reference §8.4 and §11.3, ruling R5, row L3.H4; the first consumer's
// M8.5). createLimiter reads the parent's limits as two token buckets (40 refilled at 20 a second; store.set 10 refilled
// at 10 a second), holds one `changes` in flight, coalesces `navigate` and `version` over 250 ms (the first at once, the
// latest of the rest at the window's end), and counts refusals: the 16th closes. Every timed sequence of
// conformance/bridge-cases.json replays through it on a fake clock.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BRIDGE_LIMITS, type FrameToParent } from '../src/frame/protocol.js';
import { createLimiter, type Limiter, type LimiterClock } from '../src/host/limits.js';

interface Step {
  readonly at: number;
  readonly count?: number;
  readonly message: FrameToParent;
  readonly verdict: 'accept' | 'refuse';
  readonly reason?: string;
  readonly closes?: boolean;
}
interface BridgeCases {
  readonly sequences: readonly { readonly label: string; readonly steps: readonly Step[] }[];
}
const CASES = JSON.parse(readFileSync(new URL('../conformance/bridge-cases.json', import.meta.url), 'utf8')) as BridgeCases;

/** A clock the test moves by hand; its timers run, in order of time, as it passes them. */
class FakeClock implements LimiterClock {
  t = 0;
  private seq = 0;
  private timers = new Map<number, { at: number; fn: () => void }>();
  now(): number {
    return this.t;
  }
  setTimeout(fn: () => void, ms: number): unknown {
    this.seq += 1;
    this.timers.set(this.seq, { at: this.t + ms, fn });
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
      this.t = due[1].at;
      due[1].fn();
    }
    this.t = to;
  }
}

function setup(): { clock: FakeClock; limiter: Limiter; delivered: { at: number; msg: FrameToParent }[] } {
  const clock = new FakeClock();
  const delivered: { at: number; msg: FrameToParent }[] = [];
  const limiter = createLimiter({ clock, deliver: (msg) => delivered.push({ at: clock.t, msg }) });
  return { clock, limiter, delivered };
}

const HASH: FrameToParent = { t: 'hash', id: 'fn1' };
const STORE: FrameToParent = { t: 'store.set', key: 'pref:ui', value: '{}' };
const SHA_A = '0123456789abcdef0123456789abcdef01234567';
const SHA_B = 'fedcba9876543210fedcba9876543210fedcba98';
const nav = (href: string): FrameToParent => ({ t: 'navigate', href });
const RATE = { ok: false, reason: 'rate', closes: false };

describe('L3.H4 every timed sequence of conformance/bridge-cases.json', () => {
  it('there are sequences to replay', () => {
    expect(CASES.sequences.length).toBeGreaterThanOrEqual(7);
  });

  for (const s of CASES.sequences) {
    it(s.label, () => {
      const { clock, limiter, delivered } = setup();
      let accepted = 0;
      for (const step of s.steps) {
        clock.advance(step.at);
        for (let i = 0; i < (step.count ?? 1); i += 1) {
          const where = `${s.label}: ${step.message.t} at ${step.at} (#${i + 1})`;
          const closes = step.closes === true && i === (step.count ?? 1) - 1;
          const got = limiter.admit(step.message);
          if (step.verdict === 'accept') {
            accepted += 1;
            expect(got, where).toEqual({ ok: true });
          } else expect(got, where).toEqual({ ok: false, reason: step.reason, closes });
        }
      }
      expect(delivered.length).toBe(accepted);
    });
  }
});

describe('L3.H4 the general bucket: 40 at once, then 20 a second', () => {
  it('from a full bucket 40 messages at one instant pass and the 41st is refused', () => {
    const { limiter } = setup();
    for (let i = 0; i < 40; i += 1) expect(limiter.admit(HASH), `#${i + 1}`).toEqual({ ok: true });
    expect(limiter.admit(HASH)).toEqual(RATE);
  });

  it('after 500 ms, 10 more pass and the 11th is refused', () => {
    const { clock, limiter } = setup();
    for (let i = 0; i < 40; i += 1) limiter.admit(HASH);
    clock.advance(500);
    for (let i = 0; i < 10; i += 1) expect(limiter.admit(HASH), `#${i + 1}`).toEqual({ ok: true });
    expect(limiter.admit(HASH)).toEqual(RATE);
  });

  it('a refill never goes past the capacity: after a long quiet spell, 40 pass and the 41st is refused', () => {
    const { clock, limiter } = setup();
    for (let i = 0; i < 40; i += 1) limiter.admit(HASH);
    clock.advance(3_600_000);
    for (let i = 0; i < 40; i += 1) expect(limiter.admit(HASH), `#${i + 1}`).toEqual({ ok: true });
    expect(limiter.admit(HASH)).toEqual(RATE);
  });

  it('counts whole milliseconds: 49.9 ms after an empty bucket is still empty, 50 ms is one token', () => {
    const { clock, limiter } = setup();
    for (let i = 0; i < 40; i += 1) limiter.admit(HASH);
    clock.advance(49.9);
    expect(limiter.admit(HASH)).toEqual(RATE);
    clock.advance(50);
    expect(limiter.admit(HASH)).toEqual({ ok: true });
  });

  it('counts the whole milliseconds the clock has passed: from 0.6 ms to 50.4 ms is 50, one token', () => {
    const { clock, limiter } = setup();
    clock.advance(0.6);
    for (let i = 0; i < 40; i += 1) limiter.admit(HASH);
    clock.advance(50.4);
    expect(limiter.admit(HASH)).toEqual({ ok: true });
    expect(limiter.admit(HASH)).toEqual(RATE);
  });

  it('a clock that runs backwards adds no token', () => {
    const { clock, limiter } = setup();
    clock.advance(1000);
    for (let i = 0; i < 40; i += 1) limiter.admit(HASH);
    clock.t = 0;
    expect(limiter.admit(HASH)).toEqual(RATE);
    clock.t = 1000;
    expect(limiter.admit(HASH)).toEqual(RATE);
    clock.t = 1050;
    expect(limiter.admit(HASH)).toEqual({ ok: true });
  });
});

describe('L3.H4 the store.set bucket: 10 at once, then one every 100 ms', () => {
  it('10 store.set at one instant pass and the 11th is refused, then one more passes every 100 ms', () => {
    const { clock, limiter } = setup();
    for (let i = 0; i < 10; i += 1) expect(limiter.admit(STORE), `#${i + 1}`).toEqual({ ok: true });
    expect(limiter.admit(STORE)).toEqual(RATE);
    for (let k = 1; k <= 5; k += 1) {
      clock.advance(k * 100 - 1);
      expect(limiter.admit(STORE), `at ${clock.t}`).toEqual(RATE);
      clock.advance(k * 100);
      expect(limiter.admit(STORE), `at ${clock.t}`).toEqual({ ok: true });
      expect(limiter.admit(STORE), `at ${clock.t}, a second`).toEqual(RATE);
    }
  });

  it('other ops still pass while the store.set bucket is empty', () => {
    const { limiter } = setup();
    for (let i = 0; i < 10; i += 1) limiter.admit(STORE);
    expect(limiter.admit(STORE)).toEqual(RATE);
    expect(limiter.admit(HASH)).toEqual({ ok: true });
    expect(limiter.admit({ t: 'copy', text: 'x' })).toEqual({ ok: true });
  });

  it('a store.set takes a general token too', () => {
    const { limiter } = setup();
    for (let i = 0; i < 40; i += 1) limiter.admit(HASH);
    expect(limiter.admit(STORE)).toEqual(RATE);
  });

  it('a refused message takes no token', () => {
    const { clock, limiter } = setup();
    for (let i = 0; i < 10; i += 1) limiter.admit(STORE);
    for (let i = 0; i < 5; i += 1) expect(limiter.admit(STORE)).toEqual(RATE);
    for (let i = 0; i < 30; i += 1) expect(limiter.admit(HASH), `#${i + 1}`).toEqual({ ok: true });
    expect(limiter.admit(HASH)).toMatchObject({ ok: false, reason: 'rate' });
    clock.advance(100);
    expect(limiter.admit(STORE)).toMatchObject({ ok: true });
  });
});

describe('L3.H4 one changes in flight', () => {
  it('a second changes while one is in flight is refused, and passes once the first is done', () => {
    const { limiter, delivered } = setup();
    expect(limiter.admit({ t: 'changes', sha: SHA_A })).toEqual({ ok: true });
    expect(limiter.admit({ t: 'changes', sha: SHA_B })).toEqual(RATE);
    expect(limiter.refusals).toBe(1);
    limiter.changesDone();
    expect(limiter.admit({ t: 'changes', sha: SHA_B })).toEqual({ ok: true });
    expect(delivered.map((d) => d.msg)).toEqual([
      { t: 'changes', sha: SHA_A },
      { t: 'changes', sha: SHA_B },
    ]);
  });

  it('changesDone with nothing in flight lends no second slot', () => {
    const { limiter } = setup();
    limiter.changesDone();
    expect(limiter.admit({ t: 'changes', sha: SHA_A })).toEqual({ ok: true });
    expect(limiter.admit({ t: 'changes', sha: SHA_A })).toEqual(RATE);
  });
});

describe('L3.H4 navigate and version: coalesced over 250 ms', () => {
  it('the first is delivered at once, later ones within 250 ms coalesce into one trailing delivery of the latest', () => {
    const { clock, limiter, delivered } = setup();
    expect(limiter.admit(nav('a'))).toEqual({ ok: true });
    expect(delivered).toEqual([{ at: 0, msg: nav('a') }]);
    clock.advance(100);
    expect(limiter.admit(nav('b'))).toEqual({ ok: true });
    clock.advance(200);
    expect(limiter.admit(nav('c'))).toEqual({ ok: true });
    expect(delivered.length).toBe(1);
    clock.advance(249);
    expect(delivered.length).toBe(1);
    clock.advance(250);
    expect(delivered).toEqual([
      { at: 0, msg: nav('a') },
      { at: 250, msg: nav('c') },
    ]);
  });

  it('a stream is delivered at most once per 250 ms, the latest each time; after a quiet window the next goes at once', () => {
    const { clock, limiter, delivered } = setup();
    for (let at = 0; at <= 600; at += 50) {
      clock.advance(at);
      limiter.admit(nav(`n${at}`));
    }
    clock.advance(2000);
    expect(delivered).toEqual([
      { at: 0, msg: nav('n0') },
      { at: 250, msg: nav('n200') },
      { at: 500, msg: nav('n450') },
      { at: 750, msg: nav('n600') },
    ]);
    clock.advance(3000);
    limiter.admit(nav('later'));
    expect(delivered.at(-1)).toEqual({ at: 3000, msg: nav('later') });
    expect(clock.pending).toBe(1);
    clock.advance(3250);
    expect(clock.pending).toBe(0);
  });

  it('version coalesces in its own lane: a navigate does not hold a version back', () => {
    const { clock, limiter, delivered } = setup();
    limiter.admit(nav('a'));
    limiter.admit({ t: 'version' });
    limiter.admit({ t: 'version', sha: SHA_A });
    limiter.admit(nav('b'));
    expect(delivered.map((d) => d.msg)).toEqual([nav('a'), { t: 'version' }]);
    clock.advance(250);
    expect(delivered.map((d) => d.msg)).toEqual([nav('a'), { t: 'version' }, nav('b'), { t: 'version', sha: SHA_A }]);
  });

  it('other ops are never coalesced: two hashes at one instant are two deliveries', () => {
    const { limiter, delivered } = setup();
    limiter.admit({ t: 'hash', id: 'a' });
    limiter.admit({ t: 'hash', id: 'b' });
    limiter.admit({ t: 'copy', text: 'x' });
    limiter.admit({ t: 'copy', text: 'x' });
    expect(delivered.length).toBe(4);
  });

  it('a coalesced message still takes a token', () => {
    const { limiter } = setup();
    for (let i = 0; i < 40; i += 1) expect(limiter.admit(nav(`n${i}`))).toEqual({ ok: true });
    expect(limiter.admit(nav('x'))).toEqual(RATE);
  });

  it('dispose drops a held message and its timer: nothing is delivered after it', () => {
    const { clock, limiter, delivered } = setup();
    limiter.admit(nav('a'));
    limiter.admit(nav('b'));
    limiter.dispose();
    expect(clock.pending).toBe(0);
    clock.advance(1000);
    expect(delivered.map((d) => d.msg)).toEqual([nav('a')]);
    expect(limiter.admit(HASH)).toEqual({ ok: false, reason: 'closed', closes: false });
  });
});

describe('L3.H4 refusals: the 16th closes', () => {
  it('a navigate held for its window is dropped when the bridge closes before the window ends', () => {
    const { clock, limiter, delivered } = setup();
    expect(limiter.admit(nav('a'))).toEqual({ ok: true });
    expect(limiter.admit(nav('b'))).toEqual({ ok: true });
    for (let i = 1; i < BRIDGE_LIMITS.refusalsToClose; i += 1) expect(limiter.refuse(), `#${i}`).toBe(false);
    expect(limiter.refuse()).toBe(true);
    clock.advance(1000);
    expect(delivered.map((d) => d.msg)).toEqual([nav('a')]);
    expect(clock.pending).toBe(0);
  });

  it('16 refusals from the parser (refuse()) close; 15 do not', () => {
    const { limiter } = setup();
    for (let i = 1; i < BRIDGE_LIMITS.refusalsToClose; i += 1) expect(limiter.refuse(), `#${i}`).toBe(false);
    expect(limiter.closed).toBe(false);
    expect(limiter.refuse()).toBe(true);
    expect(limiter.closed).toBe(true);
    expect(limiter.refusals).toBe(16);
  });

  it('rate refusals and parser refusals count together', () => {
    const { limiter } = setup();
    for (let i = 0; i < 10; i += 1) limiter.refuse();
    for (let i = 0; i < 40; i += 1) limiter.admit(HASH);
    for (let i = 0; i < 5; i += 1) expect(limiter.admit(HASH)).toEqual(RATE);
    expect(limiter.admit(HASH)).toEqual({ ok: false, reason: 'rate', closes: true });
  });

  it('once closed, nothing passes and nothing is delivered', () => {
    const { clock, limiter, delivered } = setup();
    for (let i = 0; i < 16; i += 1) limiter.refuse();
    clock.advance(10_000);
    expect(limiter.admit(HASH)).toEqual({ ok: false, reason: 'closed', closes: false });
    expect(delivered).toEqual([]);
  });

  it('an accepted message never resets the count', () => {
    const { clock, limiter } = setup();
    for (let i = 0; i < 15; i += 1) {
      limiter.refuse();
      clock.advance((i + 1) * 1000);
      expect(limiter.admit(HASH)).toEqual({ ok: true });
    }
    expect(limiter.refuse()).toBe(true);
  });
});

describe('L3.H4 every op draws on the buckets, error included (sequenceRules: "every message takes one general token")', () => {
  const OPS: readonly FrameToParent[] = [
    { t: 'error', why: 'render' },
    STORE,
    nav('a'),
    { t: 'copy', text: 'x' },
    { t: 'changes', sha: SHA_A },
    HASH,
    { t: 'version' },
  ];

  for (const op of OPS) {
    it(`${op.t} at an empty general bucket is refused for rate, counts one refusal and is not delivered`, () => {
      const { limiter, delivered } = setup();
      for (let i = 0; i < 40; i += 1) limiter.admit(HASH);
      expect(limiter.admit(op)).toEqual(RATE);
      expect(limiter.refusals).toBe(1);
      expect(delivered.length).toBe(40);
    });
  }

  it('an error with a token left is delivered at once and takes that token', () => {
    const { limiter, delivered } = setup();
    for (let i = 0; i < 39; i += 1) limiter.admit(HASH);
    expect(limiter.admit({ t: 'error', why: 'render' })).toEqual({ ok: true });
    expect(delivered.at(-1)?.msg).toEqual({ t: 'error', why: 'render' });
    expect(limiter.admit(HASH)).toEqual(RATE);
  });
});
