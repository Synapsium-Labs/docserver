// The `reading` and `reader` ops, library half (reader mode LX6.1): the wire (protocol tables, both parsers), the frame's
// dispatcher and adapters, and the frame's pacing of `reader` over the outbox, on a fake clock. The reader's own half (the
// mode state, the in-place chrome, `r` and Esc) is test/enhance-reader.test.ts's, the host's mount rows are
// test/host-mount.test.ts's, and a hosted frame in a real engine is test/browser/frame-reader.test.ts's.
import { readFileSync } from 'node:fs';
import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  BRIDGE_LIMITS,
  FRAME_ACCEPTS,
  FRAME_OPS,
  OP_KEYS,
  READER_ACTS,
  READING_MODES,
  type FrameToParent,
  type ParentToFrame,
} from '../src/frame/protocol.js';
import { createAdapters } from '../src/frame-runtime/adapters.js';
import { dispatchParentMessage, type DispatchTargets, type ReaderApi } from '../src/frame-runtime/dispatch.js';
import { parseParentMessage } from '../src/frame-runtime/inbound.js';
import { createOutbox, type OutboxClock } from '../src/frame-runtime/outbox.js';
import { createLimiter } from '../src/host/limits.js';
import { parseBridgeMessage } from '../src/host/parse.js';

const NONCE = '0123456789abcdef0123456789abcdef';

describe('the wire: tables and constants', () => {
  it('readerWindowMs is 250 and readerActiveMs is 60000, beside the progress window', () => {
    expect(BRIDGE_LIMITS.readerWindowMs).toBe(250);
    expect(BRIDGE_LIMITS.readerActiveMs).toBe(60000);
    expect(Object.isFrozen(BRIDGE_LIMITS)).toBe(true);
  });

  it('the acts and the modes are closed, frozen sets', () => {
    expect([...READER_ACTS]).toEqual(['menu', 'exit', 'toggle', 'active']);
    expect([...READING_MODES]).toEqual(['screens', 'scroll', 'off']);
    expect(Object.isFrozen(READER_ACTS)).toBe(true);
    expect(Object.isFrozen(READING_MODES)).toBe(true);
    expectTypeOf<Extract<FrameToParent, { t: 'reader' }>>().toEqualTypeOf<{ t: 'reader'; act: 'menu' | 'exit' | 'toggle' | 'active' }>();
    expectTypeOf<Extract<ParentToFrame, { t: 'reading' }>>().toEqualTypeOf<{ t: 'reading'; mode: 'screens' | 'scroll' | 'off' }>();
  });

  it('OP_KEYS holds one row per direction, with two names that never share a key list', () => {
    expect([...OP_KEYS.reading]).toEqual(['t', 'mode']);
    expect([...OP_KEYS.reader]).toEqual(['t', 'act']);
    expect(Object.isFrozen(OP_KEYS.reading)).toBe(true);
    expect(Object.isFrozen(OP_KEYS.reader)).toBe(true);
  });

  it('`reading` is accepted by the frame, `reader` is sent by it, and the two lists stay disjoint', () => {
    expect(FRAME_ACCEPTS).toContain('reading');
    expect(FRAME_OPS).toContain('reader');
    expect(FRAME_OPS.filter((op) => (FRAME_ACCEPTS as readonly string[]).includes(op))).toEqual([]);
  });
});

describe('the frame parses `reading` from its parent, and no `reader`', () => {
  it('accepts each mode, exactly', () => {
    for (const mode of READING_MODES) expect(parseParentMessage({ t: 'reading', mode }), mode).toEqual({ t: 'reading', mode });
  });

  it('ignores an unknown mode, a non-string, a missing mode and an extra key (null: no state change, no error)', () => {
    for (const bad of [
      { t: 'reading', mode: 'pages' },
      { t: 'reading', mode: 'Screens' },
      { t: 'reading', mode: '' },
      { t: 'reading', mode: 'toString' },
      { t: 'reading', mode: 1 },
      { t: 'reading', mode: null },
      { t: 'reading', mode: ['off'] },
      { t: 'reading' },
      { t: 'reading', mode: 'off', extra: 'x' },
      { t: 'reading', mode: 'off', act: 'menu' },
      Object.defineProperty({ t: 'reading' }, 'mode', { get: () => 'off', enumerable: true }),
      JSON.parse('{"t":"reading","mode":"off","__proto__":{}}') as unknown,
    ]) {
      expect(parseParentMessage(bad), JSON.stringify(bad)).toBeNull();
    }
  });

  it('refuses `reader`: that key belongs to the other direction', () => {
    for (const act of READER_ACTS) expect(parseParentMessage({ t: 'reader', act }), act).toBeNull();
  });
});

describe("the host's parser reads `reader` from the frame, and no `reading`", () => {
  it('accepts each act, as a fresh object holding only its keys', () => {
    for (const act of READER_ACTS) expect(parseBridgeMessage({ t: 'reader', act }, [], NONCE), act).toEqual({ ok: true, msg: { t: 'reader', act } });
  });

  it("refuses an unknown act as 'type', a non-string as 'type', a missing act or an extra key as 'keys'", () => {
    for (const act of ['pages', 'Menu', '', 'toString', 'menu ']) expect(parseBridgeMessage({ t: 'reader', act }, [], NONCE), act).toEqual({ ok: false, reason: 'type' });
    for (const act of [1, null, ['menu'], true]) expect(parseBridgeMessage({ t: 'reader', act }, [], NONCE), String(act)).toEqual({ ok: false, reason: 'type' });
    expect(parseBridgeMessage({ t: 'reader' }, [], NONCE)).toEqual({ ok: false, reason: 'keys' });
    expect(parseBridgeMessage({ t: 'reader', act: 'menu', mode: 'off' }, [], NONCE)).toEqual({ ok: false, reason: 'keys' });
    expect(parseBridgeMessage({ t: 'reader', act: 'menu', extra: 'x' }, [], NONCE)).toEqual({ ok: false, reason: 'keys' });
  });

  it("refuses `reading` from the frame as an unknown op: the parent's op, never the frame's", () => {
    expect(parseBridgeMessage({ t: 'reading', mode: 'off' }, [], NONCE)).toEqual({ ok: false, reason: 'unknown-op' });
  });
});

describe('the dispatcher hands `reading` to the reader', () => {
  const ROOT_EL = { id: 'root' };
  function targets(api: ReaderApi<typeof ROOT_EL> | null, root: typeof ROOT_EL | null = ROOT_EL): DispatchTargets<typeof ROOT_EL> {
    return { root, api, answer: () => undefined, offerMermaid: () => undefined };
  }

  it("runs setEnhancementReading(root, mode) once, with that root and that mode", () => {
    const calls: unknown[][] = [];
    const api: ReaderApi<typeof ROOT_EL> = { setEnhancementPrefs: () => undefined, setEnhancementReading: (...a) => void calls.push(a) };
    dispatchParentMessage({ t: 'reading', mode: 'screens' }, targets(api));
    expect(calls).toEqual([[ROOT_EL, 'screens']]);
  });

  it('a throw is contained, and with no root, no reader or a reader that predates the op it reaches nothing', () => {
    const throwing: ReaderApi<typeof ROOT_EL> = {
      setEnhancementPrefs: () => undefined,
      setEnhancementReading: () => {
        throw new Error('boom');
      },
    };
    expect(() => dispatchParentMessage({ t: 'reading', mode: 'off' }, targets(throwing))).not.toThrow();
    const calls: unknown[] = [];
    const api: ReaderApi<typeof ROOT_EL> = { setEnhancementPrefs: (...a) => void calls.push(a), setEnhancementReading: (...a) => void calls.push(a) };
    expect(() => dispatchParentMessage({ t: 'reading', mode: 'off' }, targets(api, null))).not.toThrow();
    expect(() => dispatchParentMessage({ t: 'reading', mode: 'off' }, targets(null))).not.toThrow();
    expect(() => dispatchParentMessage({ t: 'reading', mode: 'off' }, targets({ setEnhancementPrefs: () => undefined }))).not.toThrow();
    expect(calls).toEqual([]);
  });
});

describe('the frame adapters: onReader exists only when the seed asks for it', () => {
  const BRIDGE = { links: true, hash: true, copy: true, changes: true, versions: true, progress: true, places: false, printFigures: false } as const;
  const recording = (): { sent: unknown[]; box: Parameters<typeof createAdapters>[0] } => {
    const sent: unknown[] = [];
    return {
      sent,
      box: { send: (op) => sent.push(op), copy: () => true, changes: () => Promise.resolve(null), answer: () => undefined, open: () => undefined, dispose: () => undefined },
    };
  };

  it('reader false, or a seed with no such key: no onReader and nothing sent', () => {
    const { box, sent } = recording();
    expect(createAdapters(box, { snapshot: [], bridge: { ...BRIDGE, reader: false } }).onReader).toBeUndefined();
    expect(createAdapters(box, { snapshot: [], bridge: BRIDGE as never }).onReader).toBeUndefined();
    expect(sent).toEqual([]);
  });

  it('reader true: onReader(act) sends the act, and only the four acts', () => {
    const { box, sent } = recording();
    const a = createAdapters(box, { snapshot: [], bridge: { ...BRIDGE, reader: true } });
    for (const act of [...READER_ACTS, 'pages', '', 1, null] as unknown[]) a.onReader?.(act as never);
    expect(sent).toEqual(READER_ACTS.map((act) => ({ t: 'reader', act })));
  });
});

describe("the bootstrap hands the reader its onReader only when the adapters made one", () => {
  it('the option is spread from the adapters, as onProgress and onPlace are', () => {
    const source = readFileSync(new URL('../src/frame-runtime/bootstrap.ts', import.meta.url), 'utf8');
    expect(source).toMatch(/\.\.\.\(adapters\.onReader === undefined \? \{\} : \{ onReader: adapters\.onReader \}\)/);
  });
});

// ───────── the frame's pacing of `reader` ─────────

/** A clock the test moves by hand; a timer runs at its due time, in order. */
class FakeClock implements OutboxClock {
  t = 0;
  private seq = 0;
  private readonly timers = new Map<number, { at: number; fn: () => void }>();
  now(): number {
    return this.t;
  }
  setTimeout(fn: () => void, ms: number): unknown {
    this.seq += 1;
    this.timers.set(this.seq, { at: this.t + Math.max(0, ms), fn });
    return this.seq;
  }
  clearTimeout(handle: unknown): void {
    this.timers.delete(handle as number);
  }
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

function setup(): { clock: FakeClock; send: (act: (typeof READER_ACTS)[number]) => void; posted: { at: number; act: string }[]; open: () => void } {
  const clock = new FakeClock();
  const posted: { at: number; act: string }[] = [];
  const box = createOutbox({ clock, post: (m) => m.t === 'reader' && posted.push({ at: clock.t, act: m.act }), limits: BRIDGE_LIMITS });
  return { clock, send: (act) => box.send({ t: 'reader', act }), posted, open: () => box.open() };
}

describe('the outbox paces `menu`, `exit` and `toggle` on the readerWindowMs window: leading edge, the latest act at its end', () => {
  it('the first act goes at once and opens a window; the latest act of the window goes when it ends', () => {
    const { clock, send, posted, open } = setup();
    open();
    send('menu');
    expect(posted).toEqual([{ at: 0, act: 'menu' }]);
    send('exit');
    send('toggle');
    clock.advance(249);
    expect(posted).toHaveLength(1);
    clock.advance(250);
    expect(posted).toEqual([
      { at: 0, act: 'menu' },
      { at: 250, act: 'toggle' },
    ]);
    // The held act opened the next window: a later act waits for its end as well.
    send('menu');
    clock.advance(499);
    expect(posted).toHaveLength(2);
    clock.advance(500);
    expect(posted.map((p) => p.act)).toEqual(['menu', 'toggle', 'menu']);
    // A quiet window closes: the next act goes at once again.
    clock.advance(1000);
    send('exit');
    expect(posted.at(-1)).toEqual({ at: 1000, act: 'exit' });
  });

  it('ten acts a second for ten seconds: at most four a second, the last act always arrives', () => {
    const { clock, send, posted, open } = setup();
    open();
    const acts = ['menu', 'exit', 'toggle'] as const;
    for (let i = 0; i < 100; i += 1) {
      clock.advance(i * 100);
      send(acts[i % 3] as (typeof acts)[number]);
    }
    clock.advance(11_000);
    for (let s = 0; s < 11; s += 1) expect(posted.filter((p) => p.at >= s * 1000 && p.at < (s + 1) * 1000).length, `second ${String(s)}`).toBeLessThanOrEqual(4);
    expect(posted.at(-1)?.act).toBe(acts[99 % 3]);
  });

  it('before ready the latest act is kept, and open() sends it at once', () => {
    const { send, posted, open } = setup();
    send('toggle');
    send('exit');
    expect(posted).toEqual([]);
    open();
    expect(posted).toEqual([{ at: 0, act: 'exit' }]);
  });
});

describe('the outbox paces `active` on its own readerActiveMs window, never in place of another act', () => {
  it('one `active` a window: the first at once, none within the next 60 s, and no trailing copy at the window end', () => {
    const { clock, send, posted, open } = setup();
    open();
    send('active');
    for (let t = 1000; t < 60_000; t += 1000) {
      clock.advance(t);
      send('active');
    }
    clock.advance(70_000);
    expect(posted).toEqual([{ at: 0, act: 'active' }]);
    send('active');
    expect(posted.map((p) => p.act)).toEqual(['active', 'active']);
    expect(posted.at(-1)?.at).toBe(70_000);
  });

  it('an `active` is neither held in the act window nor does it replace a pending `menu`', () => {
    const { clock, send, posted, open } = setup();
    open();
    send('exit');
    send('menu'); // pending in the window the exit opened
    send('active');
    clock.advance(250);
    expect(posted.map((p) => p.act)).toEqual(['exit', 'active', 'menu']);
    // Whatever order they arrive in, `menu` is delivered.
    const b = setup();
    b.open();
    b.send('active');
    b.send('menu');
    b.send('toggle');
    b.clock.advance(250);
    expect(b.posted.map((p) => p.act)).toEqual(['active', 'menu', 'toggle']);
  });

  it('an `active` before ready is dropped, not queued', () => {
    const { send, posted, open } = setup();
    send('active');
    open();
    expect(posted).toEqual([]);
  });
});

describe('the host never refuses a well-paced frame', () => {
  it('acts at ten a second for ten seconds, with `active` on top, through the host limiter: no refusal, never closed', () => {
    const clock = new FakeClock();
    const delivered: string[] = [];
    let refused = 0;
    const limiter = createLimiter({
      clock: { now: () => clock.t, setTimeout: (fn, ms) => clock.setTimeout(fn, ms), clearTimeout: (h) => clock.clearTimeout(h) },
      deliver: (m) => {
        if (m.t === 'reader') delivered.push(m.act);
      },
    });
    const box = createOutbox({
      clock,
      post: (m) => {
        const verdict = limiter.admit(m);
        if (!verdict.ok) refused += 1;
      },
      limits: BRIDGE_LIMITS,
    });
    box.open();
    for (let i = 0; i < 100; i += 1) {
      clock.advance(i * 100);
      box.send({ t: 'reader', act: i % 4 === 3 ? 'active' : 'menu' });
      box.send({ t: 'reader', act: 'active' });
    }
    clock.advance(12_000);
    expect(refused).toBe(0);
    expect(limiter.refusals).toBe(0);
    expect(limiter.closed).toBe(false);
    expect(delivered.length).toBeGreaterThan(20);
  });
});
