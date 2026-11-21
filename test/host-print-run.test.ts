// @vitest-environment node
// A print run, the frame's side and the host's together (docserver parity T6): the frame's real outbox (its pacer and its `done`), its real
// adapter and the reader's real runner, posting into the real `./host` mount over a fake port, so the host's own parser and its run judge every
// figure. What this holds that no unit file does: a second `print-figures` command leaves at most one stale figure in the host's new run, so
// a reprint costs the host at most one refusal and never the sixteen that close the frame; and a frame whose seed did not ask for print figures
// sends none. The mount's harness is the small half of test/host-mount.test.ts's, with the frame's assets from an in-memory build of the
// frame's sources, so a mutation of the source still changes what the frame side does and nothing else.
import { createRequire } from 'node:module';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildFrame } from '../scripts/build-frame.mjs';
import { createPrintRunner } from '../src/enhance/print-figures.js';
import type { FrameAssets, RenderInput } from '../src/frame/document.js';
import { BRIDGE_LIMITS } from '../src/frame/protocol.js';
import { createAdapters } from '../src/frame-runtime/adapters.js';
import { createOutbox } from '../src/frame-runtime/outbox.js';
import { mountDocFrame, type FallbackReason } from '../src/host/index.js';
import { render } from '../src/render/index.js';

let assets: FrameAssets;
beforeAll(async () => {
  const built = await buildFrame();
  assets = { guard: built.files.guard.text, bootstrap: built.files.bootstrap.text, enhance: built.files.enhance.text, css: built.files.css.text };
}, 300_000);

const { JSDOM } = createRequire(import.meta.url)('jsdom') as { JSDOM: new (html: string) => { readonly window: unknown } };
const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>');
const win = dom.window as Window & typeof globalThis;
const document = win.document;

class FakePort {
  onmessage: ((e: { data: unknown; ports: readonly unknown[] }) => void) | null = null;
  onmessageerror: ((e: unknown) => void) | null = null;
  readonly sent: unknown[] = [];
  closed = false;
  postMessage(m: unknown): void {
    if (!this.closed) this.sent.push(m);
  }
  close(): void {
    this.closed = true;
  }
  start(): void {}
}
const channels: FakeChannel[] = [];
class FakeChannel {
  readonly port1 = new FakePort();
  readonly port2 = new FakePort();
  constructor() {
    channels.push(this);
  }
}

const NONCE_RE = /"nonce":"([0-9a-f]{32})"/;
/** Base64 text of a PNG-shaped figure of `bytes` (at least 9) decoded bytes: the signature, a zero, then zeros. */
const pngOf = (bytes: number): string => {
  const rest = bytes - 9;
  return 'iVBORw0KGgoA' + 'AAAA'.repeat(Math.floor(rest / 3)) + (rest % 3 === 0 ? '' : rest % 3 === 1 ? 'AA==' : 'AAA=');
};

let container: HTMLElement;

beforeEach(() => {
  channels.length = 0;
  Object.assign(win, { MessageChannel: FakeChannel, setTimeout: (fn: () => void, ms: number) => globalThis.setTimeout(fn, ms), clearTimeout: (h: ReturnType<typeof setTimeout>) => globalThis.clearTimeout(h) });
  Object.defineProperty(win, 'performance', { configurable: true, value: { now: () => globalThis.performance.now() } });
  container = document.createElement('div');
  document.body.append(container);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  container.remove();
  document.body.replaceChildren();
});

interface Mounted {
  say(data: unknown): void;
  figures: { i: number; n: number; png: string }[];
  fallbacks: FallbackReason[];
  frame: ReturnType<typeof mountDocFrame>;
}

/** A host that asked for print figures (or not), mounted and ready. */
function readyHost(asksForFigures = true): Mounted {
  const figures: { i: number; n: number; png: string }[] = [];
  const fallbacks: FallbackReason[] = [];
  const r = render('# Title\n\nText.\n');
  if (r.outcome !== 'rendered') throw new Error('did not render');
  const document_: RenderInput = { result: { outcome: r.outcome, html: r.html, meta: { title: r.meta.title, frontList: r.meta.frontList } } };
  const frame = mountDocFrame(container, {
    document: document_,
    adapters: {
      assets,
      watchdogMs: 5000,
      onFallback: (why: FallbackReason) => void fallbacks.push(why),
      ...(asksForFigures ? { onPrintFigure: (f: { i: number; n: number; png: string }) => void figures.push(f) } : {}),
    } as never,
  });
  const iframe = container.querySelector('iframe') as HTMLIFrameElement;
  const channel = channels[channels.length - 1] as FakeChannel;
  const nonce = NONCE_RE.exec(iframe.getAttribute('srcdoc') ?? '')?.[1] ?? '';
  const say = (data: unknown): void => channel.port1.onmessage?.({ data, ports: [] });
  say({ t: 'ready', v: 1, nonce });
  return { say, figures, fallbacks, frame };
}

/** The frame's side over a mount: the runner of `count` figures of `bytes` each, handing to the adapter, which posts through the outbox (the pacer) into the mount. */
function frameOver(m: Mounted, printFigures = true, count = 30, bytes = 100): { posted: unknown[]; start: () => void; adapters: ReturnType<typeof createAdapters> } {
  const posted: unknown[] = [];
  const outbox = createOutbox({
    clock: { now: () => performance.now(), setTimeout: (fn, ms) => setTimeout(fn, ms), clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>) },
    post: (msg) => {
      posted.push(msg);
      m.say(msg);
    },
    limits: BRIDGE_LIMITS,
  });
  outbox.open();
  const adapters = createAdapters(outbox, { snapshot: [], bridge: { links: true, hash: true, copy: true, changes: true, versions: true, progress: false, places: false, printFigures } });
  const draw = (): Promise<string | null> => Promise.resolve('<svg viewBox="0 0 10 10"></svg>');
  const runner = createPrintRunner({
    live: () => true,
    figures: () => Array.from({ length: count }, () => draw),
    rasterize: () => Promise.resolve(pngOf(bytes)),
    hand: (f) => adapters.printOption.onPrintFigure?.(f) ?? Promise.resolve(),
  });
  return { posted, start: () => runner.start(), adapters };
}

describe('a second print-figures command, with the frame\'s real outbox, adapter and runner in front of the host\'s real parser', () => {
  it('leaves at most one stale figure in the host\'s second run: one refusal, never the sixteen that close the frame', async () => {
    const m = readyHost();
    const frame = frameOver(m);
    m.frame.printFigures();
    frame.start();
    await vi.advanceTimersByTimeAsync(300);
    // twelve went out at once (the pacer's share of a second) and the thirteenth waits in its line: the stale one
    expect(frame.posted).toHaveLength(12);
    // the host calls again: its run 2 opens now, and the frame sees the command next
    m.frame.printFigures();
    frame.start();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(m.fallbacks).toEqual([]);
    const refused = frame.posted.length - m.figures.length;
    expect(refused).toBeLessThanOrEqual(1);
    expect(frame.posted).toHaveLength(12 + 30 + 1);
    // run 2 got every index once, in the end
    const lastRun = m.figures.slice(12);
    expect([...new Set(lastRun.map((f) => f.i))].sort((a, b) => a - b)).toEqual(Array.from({ length: 30 }, (_, i) => i));
    expect(lastRun.every((f) => f.n === 30)).toBe(true);
  });

  it('a reprint while the last index waits in the pacer (n = 25, i = 24 in the line): the new run is not closed by it, and every one of its figures is handed to the host (review I1)', async () => {
    const m = readyHost();
    const frame = frameOver(m, true, 25);
    m.frame.printFigures();
    frame.start();
    await vi.advanceTimersByTimeAsync(1500);
    // 24 figures are out (two pacer windows) and the last, i = 24, waits in the pacer's line
    expect(frame.posted).toHaveLength(24);
    m.frame.printFigures();
    frame.start();
    await vi.advanceTimersByTimeAsync(20_000);
    expect(m.fallbacks).toEqual([]);
    // the new run: the stale 24 first, then every index 0 to 23 once; its own 24 is the one refusal
    const second = m.figures.slice(24);
    expect(second.map((f) => f.i)).toEqual([24, ...Array.from({ length: 24 }, (_, i) => i)]);
    expect(second.every((f) => f.n === 25)).toBe(true);
    expect(new Set(second.map((f) => f.i)).size).toBe(25);
  });

  it('an interrupted reprint costs exactly one refusal: the copy of the stale index that the new run sends (review I1)', async () => {
    const m = readyHost();
    const frame = frameOver(m, true, 25);
    m.frame.printFigures();
    frame.start();
    await vi.advanceTimersByTimeAsync(1500);
    m.frame.printFigures();
    frame.start();
    await vi.advanceTimersByTimeAsync(20_000);
    expect(frame.posted).toHaveLength(24 + 1 + 25);
    expect(frame.posted.length - m.figures.length).toBe(1);
    // the refused one is the new run's own i = 24, sent after the stale one was accepted
    expect(frame.posted.filter((f) => (f as { i: string }).i === '24')).toHaveLength(2);
    expect(m.figures.filter((f) => f.i === 24)).toHaveLength(1);
  });

  it('a figure the runner skips for the 16 MiB total is never sent, so the host refuses nothing for it (review I2)', async () => {
    const m = readyHost();
    const frame = frameOver(m, true, 17, 1_048_576);
    m.frame.printFigures();
    frame.start();
    await vi.advanceTimersByTimeAsync(30_000);
    // sixteen figures of 1 MiB make 16 MiB; the seventeenth is skipped in the frame: no i = 16 on the wire, no refusal, no fallback
    expect(frame.posted).toHaveLength(16);
    expect(m.figures.map((f) => f.i)).toEqual(Array.from({ length: 16 }, (_, i) => i));
    expect(frame.posted.length - m.figures.length).toBe(0);
    expect(m.fallbacks).toEqual([]);
  });

  it('a single run is accepted whole, at the pacer\'s rate: 30 figures, no refusal, every index once', async () => {
    const m = readyHost();
    const frame = frameOver(m);
    m.frame.printFigures();
    frame.start();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(m.fallbacks).toEqual([]);
    expect(frame.posted).toHaveLength(30);
    expect(m.figures.map((f) => f.i)).toEqual(Array.from({ length: 30 }, (_, i) => i));
  });

  it('the frame sends nothing when the seed did not set bridge.printFigures: no option, so no figure ever reaches the host', async () => {
    const m = readyHost(false);
    const frame = frameOver(m, false);
    expect(frame.adapters.printOption).toEqual({});
    await vi.advanceTimersByTimeAsync(2000);
    expect(frame.posted).toEqual([]);
    expect(m.figures).toEqual([]);
  });
});
