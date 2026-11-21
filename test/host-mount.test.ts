// `./host`'s mountDocFrame in jsdom (docserver L3, Task 10; plan Reference §11, FD10, FD22; rows L3.H1, L3.H2, L3.H8,
// L3.H11 and L3.D5's host half; the first consumer's M8.1, M8.6, M8.11 and M8.B5). The file runs in Node and mounts into
// a jsdom document of its own (the frame build needs Node's globals, which jsdom's test environment replaces), and the
// mount takes its window from the element, as it does in a browser: so that window's channel is a fake, and its timers
// and clock are the test's (vitest's fake timers when a row uses them). jsdom loads no srcdoc and runs no
// frame script, so this file plays the frame's side itself: a fake MessageChannel hands the test both ends, the
// iframe's contentWindow is replaced by a recorder before its first load, and the test speaks the frame's ops on the
// port. What a real browser adds (the frame's own load, the policy, the battery) is test/browser/host-frame.test.ts's
// and test/browser/host-policy.test.ts's.
//
// Elements are compared as booleans (`a === b`), never handed to an assertion: a failing assertion formats its
// values, and formatting a jsdom element of an opaque-origin frame throws a SecurityError that would hide the failure.
//
// The srcdoc is the real frameDocument output over the real assets, built in memory as `node scripts/build-frame.mjs`
// writes them; the seed is read back from it to learn the nonce and what the mount seeded. One row (L3.H11's `nonce` and
// `csp` codes, which ./host's own values never produce) stubs frameDocument to throw them.
import { createRequire } from 'node:module';
import v8 from 'node:v8';
import vm from 'node:vm';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildFrame } from '../scripts/build-frame.mjs';
import { frameCsp } from '../src/frame/csp.js';
import { frameDocument, type FrameAssets, type RenderInput } from '../src/frame/document.js';
import { MERMAID_GATE_DEFAULTS } from '../src/frame/gate.js';
import { SEED_HTML_MAX_CHARS } from '../src/frame/seed.js';
import { CHANGES_MAX_DELETIONS, CHANGES_MAX_RANGES } from '../src/frame-runtime/inbound.js';
import { mountDocFrame, type DocFrame, type FallbackReason, type HostAdapters } from '../src/host/index.js';
import { HOST_CHANGES_MAX } from '../src/host/mount.js';
import { render, scanRefs } from '../src/render/index.js';

/** A frameDocument that throws the code a row names, else the real one (L3.H11's internal codes). */
const stub = vi.hoisted(() => ({ code: null as string | null, calls: 0, assets: [] as unknown[] }));
vi.mock('../src/frame/document.js', async (importOriginal) => {
  const real = await importOriginal<typeof import('../src/frame/document.js')>();
  return {
    ...real,
    frameDocument: (...args: Parameters<typeof real.frameDocument>): string => {
      stub.calls += 1;
      stub.assets.push((args[1] as { assets?: unknown } | undefined)?.assets);
      if (stub.code !== null) throw new real.FrameError(stub.code as never, 'stubbed');
      return real.frameDocument(...args);
    },
  };
});

let assets: FrameAssets;
let mermaidText: string;

/** jsdom ships no types; its one constructor this file uses, typed here. */
const { JSDOM } = createRequire(import.meta.url)('jsdom') as { JSDOM: new (html: string) => { readonly window: unknown } };
const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>');
const win = dom.window as Window & typeof globalThis;
const document = win.document;

beforeAll(async () => {
  const built = await buildFrame();
  assets = { guard: built.files.guard.text, bootstrap: built.files.bootstrap.text, enhance: built.files.enhance.text, css: built.files.css.text };
  mermaidText = built.files.mermaid.text;
}, 300_000);

// ───────── the frame's side: a fake channel, a recording contentWindow ─────────

interface FakePortEvent {
  readonly data: unknown;
  readonly ports: readonly unknown[];
}

class FakePort {
  onmessage: ((e: FakePortEvent) => void) | null = null;
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

interface Hello {
  readonly data: unknown;
  readonly target: unknown;
  readonly transfer: unknown;
}

/** What one test's adapters saw, in order. */
interface Seen {
  readonly events: [string, unknown][];
}

const NONCE_RE = /"nonce":"([0-9a-f]{32})"/;

/** The seed a srcdoc carries, parsed. */
function seedOf(srcdoc: string): Record<string, unknown> {
  const open = '<script type="application/json">';
  const at = srcdoc.indexOf(open);
  expect(at).toBeGreaterThan(0);
  const end = srcdoc.indexOf('</script>', at);
  return JSON.parse(srcdoc.slice(at + open.length, end)) as Record<string, unknown>;
}

function input(markdown: string): RenderInput {
  const r = render(markdown);
  if (r.outcome !== 'rendered') throw new Error(`did not render (${r.outcome})`);
  return { result: { outcome: r.outcome, html: r.html, meta: { title: r.meta.title, frontList: r.meta.frontList } }, scan: { mermaid: scanRefs(markdown).mermaid } };
}

const PLAIN = '# Title\n\nA paragraph with a [link](https://example.test/x) and a [section](#title).\n';
const MERMAID_DOC = '# Diagrams\n\n```mermaid\nflowchart LR\n  A --> B\n```\n';

/** A Web Storage stand-in over a Map. */
function memoryStore(): HostAdapters['store'] & { readonly map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
    key: (i) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
  };
}

let container: HTMLElement;
let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  channels.length = 0;
  stub.code = null;
  stub.calls = 0;
  stub.assets = [];
  Object.assign(win, {
    MessageChannel: FakeChannel,
    setTimeout: (fn: () => void, ms: number) => globalThis.setTimeout(fn, ms),
    clearTimeout: (h: ReturnType<typeof setTimeout>) => globalThis.clearTimeout(h),
  });
  Object.defineProperty(win, 'performance', { configurable: true, value: { now: () => globalThis.performance.now() } });
  container = document.createElement('div');
  document.body.append(container);
  warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  warn.mockRestore();
  container.remove();
  document.body.replaceChildren();
});

/** The adapters a row mounts with: every callback recorded, and `over` on top. */
function adaptersFor(seen: Seen, over: Partial<Record<keyof HostAdapters, unknown>> = {}): HostAdapters {
  const log =
    (name: string) =>
    (...args: unknown[]): void => {
      seen.events.push([name, args.length === 1 ? args[0] : args]);
    };
  return {
    assets,
    watchdogMs: 5000,
    onLink: log('link'),
    onHash: log('hash'),
    copy: log('copy'),
    openVersion: log('version'),
    onReady: log('ready'),
    onFallback: log('fallback'),
    ...over,
  } as HostAdapters;
}

interface Mounted {
  readonly frame: DocFrame;
  readonly seen: Seen;
  /** The mount's iframe (the one it just appended). */
  readonly iframe: HTMLIFrameElement;
  readonly channel: FakeChannel;
  readonly hellos: Hello[];
  /** The mount's nonce, read from its seed. */
  readonly nonce: string;
  /** Speak as the frame on the mount's port. */
  say(data: unknown, ports?: readonly unknown[]): void;
  /** Fire the iframe's load event (its first is jsdom's own, awaited by `loaded`). */
  load(): void;
  /** Wait for the iframe's first (jsdom's) load. */
  loaded(): Promise<void>;
  fallbacks(): unknown[];
}

/** A recording stand-in for the iframe's window, put on the iframe before its first load. */
function recordHellos(iframe: HTMLIFrameElement, hellos: Hello[]): void {
  Object.defineProperty(iframe, 'contentWindow', {
    configurable: true,
    value: {
      postMessage(data: unknown, target: unknown, transfer: unknown) {
        hellos.push({ data, target, transfer });
      },
    },
  });
}

function mount(markdown = PLAIN, over: Partial<Record<keyof HostAdapters, unknown>> = {}, document_?: RenderInput): Mounted {
  const seen: Seen = { events: [] };
  const hellos: Hello[] = [];
  const frame = mountDocFrame(container, { document: document_ ?? input(markdown), adapters: adaptersFor(seen, over) });
  const all = container.querySelectorAll('iframe');
  const found = all.length === 0 ? null : all[all.length - 1];
  expect(found, 'an iframe is mounted').not.toBeNull();
  const iframe = found as HTMLIFrameElement;
  recordHellos(iframe, hellos);
  const channel = channels[channels.length - 1] as FakeChannel;
  const nonce = NONCE_RE.exec(iframe.getAttribute('srcdoc') ?? '')?.[1] ?? '';
  return {
    frame,
    seen,
    iframe,
    channel,
    hellos,
    nonce,
    say: (data, ports = []) => channel.port1.onmessage?.({ data, ports }),
    load: () => iframe.dispatchEvent(new win.Event('load')),
    loaded: () => (hellos.length > 0 ? Promise.resolve() : new Promise((r) => iframe.addEventListener('load', () => r(), { once: true }))),
    fallbacks: () => seen.events.filter(([n]) => n === 'fallback').map(([, v]) => v),
  };
}

/** Mounted, loaded and ready. */
async function ready(markdown = PLAIN, over: Partial<Record<keyof HostAdapters, unknown>> = {}): Promise<Mounted> {
  const m = mount(markdown, over);
  await m.loaded();
  m.say({ t: 'ready', v: 1, nonce: m.nonce });
  return m;
}

/** The ops the parent posted to the frame on its end of the channel (this fake keeps them on port1). */
const frameBound = (m: Mounted): unknown[] => m.channel.port1.sent.slice();

const iframes = (): number => container.querySelectorAll('iframe').length;

// ───────── L3.H1: the iframe ─────────

describe('L3.H1 the iframe mountDocFrame makes (Reference §11.1 step 6; M8.1)', () => {
  it('sandbox is exactly allow-scripts; no src, name, allow, allowfullscreen or loading; referrerpolicy no-referrer; csp equals the meta; title', () => {
    const m = mount();
    const f = m.iframe;
    expect((f.getAttribute('sandbox') ?? '').split(/\s+/).filter((t) => t !== '')).toEqual(['allow-scripts']);
    for (const a of ['src', 'name', 'allow', 'allowfullscreen', 'loading']) expect(f.hasAttribute(a), a).toBe(false);
    expect(f.getAttribute('referrerpolicy')).toBe('no-referrer');
    const srcdoc = f.getAttribute('srcdoc') ?? '';
    const meta = /^<meta http-equiv="Content-Security-Policy" content="([^"]*)">/.exec(srcdoc);
    expect(meta).not.toBeNull();
    expect(f.getAttribute('csp')).toBe(meta?.[1]);
    expect(f.getAttribute('csp')).toBe(frameCsp());
    expect(f.getAttribute('title')).toBe('Document');
    expect(Array.from(f.attributes, (a) => a.name).sort()).toEqual(['csp', 'referrerpolicy', 'sandbox', 'srcdoc', 'title']);
    m.frame.destroy();
    expect(mount(PLAIN, { title: 'Release notes' }).iframe.getAttribute('title')).toBe('Release notes');
  });

  it('every attribute, srcdoc included, is set before the iframe is inserted; the load listener is on the element before insertion', () => {
    const set: [string, boolean][] = [];
    const listened: [string, boolean][] = [];
    const setAttribute = win.Element.prototype.setAttribute;
    const addEventListener = win.EventTarget.prototype.addEventListener;
    const s = vi.spyOn(win.Element.prototype, 'setAttribute').mockImplementation(function (this: Element, name: string, value: string) {
      if (this instanceof win.HTMLIFrameElement) set.push([name, this.isConnected]);
      setAttribute.call(this, name, value);
    });
    const l = vi.spyOn(win.EventTarget.prototype, 'addEventListener').mockImplementation(function (this: EventTarget, ...args: Parameters<EventTarget['addEventListener']>) {
      if (this instanceof win.HTMLIFrameElement) listened.push([args[0], this.isConnected]);
      addEventListener.apply(this, args);
    });
    try {
      mount();
    } finally {
      s.mockRestore();
      l.mockRestore();
    }
    expect(set.map(([n]) => n).sort()).toEqual(['csp', 'referrerpolicy', 'sandbox', 'srcdoc', 'title']);
    expect(set.filter(([, connected]) => connected)).toEqual([]);
    expect(listened).toEqual([['load', false]]);
  });

  it('with focus on (the default) the iframe is the active element right after mount; with focus off it is not', () => {
    const m = mount();
    expect(document.activeElement === m.iframe, 'the iframe is the active element').toBe(true);
    m.frame.destroy();
    (document.activeElement as HTMLElement | null)?.blur();
    const off = mount(PLAIN, { focus: false });
    expect(document.activeElement === off.iframe, 'the iframe is the active element').toBe(false);
  });

  it('nothing is focused again at ready', async () => {
    const m = mount();
    await m.loaded();
    m.iframe.blur();
    const other = document.createElement('button');
    document.body.append(other);
    other.focus();
    m.say({ t: 'ready', v: 1, nonce: m.nonce });
    expect(m.seen.events.map(([n]) => n)).toEqual(['ready']);
    expect(document.activeElement === other, 'the other button keeps the focus').toBe(true);
  });
});

// ───────── L3.H2: hello, loads and remounts ─────────

describe('L3.H2 one hello per mount, on the first load (Reference §11.1 step 7, §11.2, §11.4; M8.6, M8.B5)', () => {
  it("exactly one contentWindow.postMessage, on the first load: '*', one port (the channel's other end), payload exactly {t:'hello',v:1}", async () => {
    const m = mount();
    expect(m.hellos).toEqual([]);
    await m.loaded();
    expect(m.hellos).toHaveLength(1);
    const h = m.hellos[0] as Hello;
    expect(h.target).toBe('*');
    expect(h.transfer).toEqual([m.channel.port2]);
    expect((h.transfer as unknown[])[0]).toBe(m.channel.port2);
    expect(h.data).toStrictEqual({ t: 'hello', v: 1 });
    expect(Object.keys(h.data as object)).toEqual(['t', 'v']);
  });

  it('a second load closes the port and gives navigated, once, with no second hello and no remount', async () => {
    const m = mount();
    await m.loaded();
    m.load();
    expect(m.hellos).toHaveLength(1);
    expect(m.fallbacks()).toEqual(['navigated']);
    expect(m.channel.port1.closed).toBe(true);
    expect(iframes()).toBe(0);
    m.load();
    expect(m.fallbacks()).toEqual(['navigated']);
    expect(channels).toHaveLength(1);
  });

  it('a second load after ready gives navigated too', async () => {
    const m = await ready();
    m.load();
    expect(m.fallbacks()).toEqual(['navigated']);
    expect(iframes()).toBe(0);
  });

  it('update makes a new iframe, a new channel and a new nonce, and leaves the old iframe and port behind', async () => {
    const m = await ready();
    const before = m.iframe;
    const oldSrcdoc = before.getAttribute('srcdoc');
    m.frame.update(input('# Another\n\nText.\n'));
    const now = container.querySelector('iframe');
    expect(now === null, 'an iframe is mounted').toBe(false);
    expect(now === before, 'the iframe is a new element').toBe(false);
    expect(before.isConnected).toBe(false);
    expect(before.getAttribute('srcdoc')).toBe(oldSrcdoc);
    expect(iframes()).toBe(1);
    expect(channels).toHaveLength(2);
    expect(m.channel.port1.closed).toBe(true);
    const nonce = NONCE_RE.exec(now?.getAttribute('srcdoc') ?? '')?.[1];
    expect(nonce).toMatch(/^[0-9a-f]{32}$/);
    expect(nonce).not.toBe(m.nonce);
    expect(m.fallbacks()).toEqual([]);
  });

  it('two mounts get different 128-bit nonces', () => {
    const a = mount();
    const b = mount();
    expect(a.nonce).toMatch(/^[0-9a-f]{32}$/);
    expect(b.nonce).toMatch(/^[0-9a-f]{32}$/);
    expect(a.nonce).not.toBe(b.nonce);
    expect(a.channel).not.toBe(b.channel);
  });

  it("no 'message' listener is ever added to the window (mount, load, ready, every op, update, destroy)", async () => {
    const types: string[] = [];
    const add = win.EventTarget.prototype.addEventListener;
    const spy = vi.spyOn(win.EventTarget.prototype, 'addEventListener').mockImplementation(function (this: EventTarget, ...args: Parameters<EventTarget['addEventListener']>) {
      if (this === win) types.push(args[0]);
      add.apply(this, args);
    });
    const onWindow = vi.spyOn(win, 'addEventListener');
    /** The window's own message handlers stay unset after every step (a handler set by any spelling shows here). */
    const handlers: unknown[] = [];
    const look = (step: string): void => {
      handlers.push([step, win.onmessage === null, win.onmessageerror === null]);
    };
    try {
      const m = await ready();
      look('mount');
      m.say({ t: 'navigate', href: 'https://example.test/a' });
      m.say({ t: 'hash', id: 'title' });
      look('ops');
      m.frame.update(input(PLAIN));
      look('update');
      m.frame.destroy();
      look('destroy');
    } finally {
      spy.mockRestore();
    }
    expect(handlers).toEqual(['mount', 'ops', 'update', 'destroy'].map((step) => [step, true, true]));
    expect(types.filter((t) => t === 'message')).toEqual([]);
    expect(onWindow.mock.calls.filter(([t]) => t === 'message')).toEqual([]);
    onWindow.mockRestore();
  });
});

// ───────── L3.H8: the watchdog, the nonce, error ─────────

describe('L3.H8 no ready, a wrong ready, and error (Reference §11.3, §11.4, FD10; M8.11)', () => {
  it('no ready within watchdogMs: onFallback("timeout") exactly once, the iframe removed, no remount', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
    const m = mount(PLAIN, { watchdogMs: 3000 });
    vi.advanceTimersByTime(2999);
    expect(m.fallbacks()).toEqual([]);
    expect(iframes()).toBe(1);
    vi.advanceTimersByTime(1);
    expect(m.fallbacks()).toEqual(['timeout']);
    expect(iframes()).toBe(0);
    expect(m.channel.port1.closed).toBe(true);
    vi.advanceTimersByTime(60_000);
    expect(m.fallbacks()).toEqual(['timeout']);
    expect(channels).toHaveLength(1);
    expect(iframes()).toBe(0);
  });

  it('a valid ready clears the watchdog and calls onReady once', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
    const m = mount(PLAIN, { watchdogMs: 3000 });
    m.say({ t: 'ready', v: 1, nonce: m.nonce });
    vi.advanceTimersByTime(10_000);
    expect(m.seen.events.map(([n]) => n)).toEqual(['ready']);
    expect(iframes()).toBe(1);
  });

  it('a ready with a wrong nonce: onFallback("nonce") once, nothing more acted on', async () => {
    const m = mount();
    await m.loaded();
    m.say({ t: 'ready', v: 1, nonce: m.nonce.replace(/^./, (c) => (c === '0' ? '1' : '0')) });
    expect(m.fallbacks()).toEqual(['nonce']);
    expect(iframes()).toBe(0);
    m.say({ t: 'ready', v: 1, nonce: m.nonce });
    m.say({ t: 'navigate', href: 'https://example.test/a' });
    expect(m.seen.events.map(([n]) => n)).toEqual(['fallback']);
  });

  it('a ready with protocol 2: onFallback("protocol") once', async () => {
    const m = mount();
    await m.loaded();
    m.say({ t: 'ready', v: 2, nonce: m.nonce });
    expect(m.fallbacks()).toEqual(['protocol']);
    expect(iframes()).toBe(0);
  });

  it("an error after ready: onFallback('error') at once, without waiting for the port to close; why is logged, never in the DOM", async () => {
    const m = await ready();
    m.say({ t: 'error', why: 'mermaid' });
    expect(m.fallbacks()).toEqual(['error']);
    expect(iframes()).toBe(0);
    expect(m.channel.port1.closed).toBe(true);
    expect(warn.mock.calls).toContainEqual(['docserver frame:', 'mermaid']);
    expect(document.documentElement.outerHTML).not.toContain('mermaid');
    m.say({ t: 'error', why: 'boot' });
    expect(m.fallbacks()).toEqual(['error']);
  });

  it('before ready every op but ready is dropped and counted: no effect, and the sixteenth refusal closes', async () => {
    const m = mount();
    await m.loaded();
    m.say({ t: 'navigate', href: 'https://example.test/a' });
    m.say({ t: 'error', why: 'boot' });
    expect(m.seen.events).toEqual([]);
    for (let i = 0; i < 13; i += 1) m.say({ t: 'hash', id: 'title' });
    expect(m.fallbacks()).toEqual([]);
    m.say({ t: 'hash', id: 'title' });
    expect(m.fallbacks()).toEqual(['refusals']);
  });

  it('refusals before ready count toward the sixteen after it', async () => {
    const m = mount();
    await m.loaded();
    for (let i = 0; i < 10; i += 1) m.say({ t: 'bogus' });
    m.say({ t: 'ready', v: 1, nonce: m.nonce });
    for (let i = 0; i < 5; i += 1) m.say({ t: 'bogus' });
    expect(m.fallbacks()).toEqual([]);
    m.say({ t: 'bogus' });
    expect(m.fallbacks()).toEqual(['refusals']);
  });
});

// ───────── after ready: one effect per op ─────────

describe('after ready: the limiter, then one effect per op (Reference §11.3)', () => {
  // The navigate rows send one href per coalescing window (250 ms on fake timers), so every href reaches classifyLink
  // before the row asserts: a burst would deliver only its first at once and hold the latest.
  it('navigate is classified and handed to onLink; a refused href is not', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
    const m = mount();
    m.say({ t: 'ready', v: 1, nonce: m.nonce });
    for (const href of ['https://example.test/a?q=1#x', '../other.md?q=1#part', 'javascript:alert(1)']) {
      m.say({ t: 'navigate', href });
      vi.advanceTimersByTime(250);
    }
    expect(m.seen.events.filter(([n]) => n === 'link').map(([, v]) => v)).toEqual([
      { kind: 'external', url: 'https://example.test/a?q=1#x', scheme: 'https', host: 'example.test' },
      { kind: 'relative', path: '../other.md', fragment: 'part' },
    ]);
    expect(m.fallbacks()).toEqual([]);
  });

  it('navigate is coalesced over 250 ms: the latest of a burst is delivered when the window ends', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
    const m = mount();
    m.say({ t: 'ready', v: 1, nonce: m.nonce });
    m.say({ t: 'navigate', href: 'https://example.test/1' });
    m.say({ t: 'navigate', href: 'https://example.test/2' });
    m.say({ t: 'navigate', href: 'https://example.test/3' });
    const links = (): unknown[] => m.seen.events.filter(([n]) => n === 'link').map(([, v]) => (v as { url: string }).url);
    expect(links()).toEqual(['https://example.test/1']);
    vi.advanceTimersByTime(250);
    expect(links()).toEqual(['https://example.test/1', 'https://example.test/3']);
  });

  it('a javascript:, data: or protocol-relative href never reaches onLink; a valid href sent after them does', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
    const m = mount();
    m.say({ t: 'ready', v: 1, nonce: m.nonce });
    for (const href of ['javascript:alert(1)', 'data:text/html,x', '//example.test/x', 'vbscript:x', 'https://example.test/ok']) {
      m.say({ t: 'navigate', href });
      vi.advanceTimersByTime(250);
    }
    expect(m.seen.events.filter(([n]) => n === 'link').map(([, v]) => (v as { url?: string }).url)).toEqual(['https://example.test/ok']);
  });

  it('hash goes to onHash; version to openVersion with only the keys sent', async () => {
    const m = await ready();
    m.say({ t: 'hash', id: 'D2.1a' });
    m.say({ t: 'version', sha: 'a'.repeat(40) });
    expect(m.seen.events.filter(([n]) => n === 'hash' || n === 'version')).toEqual([
      ['hash', 'D2.1a'],
      ['version', { sha: 'a'.repeat(40) }],
    ]);
  });

  it('copy hands the text and its hidden characters to the copy adapter, never the clipboard', async () => {
    const m = await ready();
    m.say({ t: 'copy', text: 'a‮b' });
    expect(m.seen.events.filter(([n]) => n === 'copy')).toEqual([['copy', ['a‮b', { hidden: [{ index: 1, codePoint: 0x202e, name: 'RIGHT-TO-LEFT OVERRIDE' }] }]]]);
  });

  it('store.set writes under the prefix and the docKey; the literal null deletes; the next mount seeds the snapshot', async () => {
    const store = memoryStore();
    const m = await ready(PLAIN, { store, docKey: 'docs/a.md' });
    m.say({ t: 'store.set', key: 'pref:prefs', value: '{"theme":"dark"}' });
    m.say({ t: 'store.set', key: 'doc:pos', value: '{"id":"title"}' });
    expect(store.map.get('docreader:pref:prefs')).toBe('{"theme":"dark"}');
    expect(store.map.get('docreader:doc:docs/a.md:pos')).toBe('{"id":"title"}');
    m.frame.update(input(PLAIN));
    const seed = seedOf(container.querySelector('iframe')?.getAttribute('srcdoc') ?? '');
    expect(seed['snapshot']).toEqual([
      ['pref:prefs', '{"theme":"dark"}'],
      ['doc:pos', '{"id":"title"}'],
    ]);
    const n = channels[channels.length - 1] as FakeChannel;
    const nonce = seed['nonce'] as string;
    n.port1.onmessage?.({ data: { t: 'ready', v: 1, nonce }, ports: [] });
    n.port1.onmessage?.({ data: { t: 'store.set', key: 'doc:pos', value: 'null' }, ports: [] });
    expect(store.map.has('docreader:doc:docs/a.md:pos')).toBe(false);
  });

  it('with no store adapter a store.set has no effect and the seed carries no snapshot', async () => {
    const m = await ready();
    m.say({ t: 'store.set', key: 'pref:prefs', value: '{}' });
    expect(seedOf(m.iframe.getAttribute('srcdoc') ?? '')['snapshot']).toEqual([]);
    expect(m.fallbacks()).toEqual([]);
  });

  it('changes: the adapter is asked, and its answer goes back as changes.result', async () => {
    const sha = 'b'.repeat(40);
    const m = await ready(PLAIN, { changes: (s: string) => Promise.resolve(s === sha ? { ranges: [[1, 2]], removedAfter: [3] } : null) });
    m.say({ t: 'changes', sha });
    await vi.waitFor(() => expect(frameBound(m)).toHaveLength(1));
    expect(frameBound(m)).toEqual([{ t: 'changes.result', sha, ranges: [[1, 2]], removedAfter: [3] }]);
  });

  it('changes: a throw, a rejection, null and a malformed answer each post unavailable, and free the slot', async () => {
    const sha = 'c'.repeat(64);
    const answers: (() => unknown)[] = [
      () => {
        throw new Error('down');
      },
      () => Promise.reject(new Error('down')),
      () => Promise.resolve(null),
      () => Promise.resolve({ ranges: [[2, 1]] }),
      () => Promise.resolve({ ranges: 'x' }),
    ];
    let i = 0;
    const m = await ready(PLAIN, { changes: () => (answers[i++] as () => unknown)() });
    for (let k = 0; k < answers.length; k += 1) {
      m.say({ t: 'changes', sha });
      await vi.waitFor(() => expect(frameBound(m)).toHaveLength(k + 1));
    }
    expect(frameBound(m)).toEqual(answers.map(() => ({ t: 'changes.result', sha, unavailable: true })));
    expect(m.fallbacks()).toEqual([]);
  });

  it("changes: an answer over the layout's caps (10,000 ranges or removedAfter entries) posts unavailable; at the caps it passes", async () => {
    expect(HOST_CHANGES_MAX).toBe(CHANGES_MAX_RANGES);
    expect(HOST_CHANGES_MAX).toBe(CHANGES_MAX_DELETIONS);
    const sha = 'e'.repeat(40);
    const pairs = (n: number): [number, number][] => Array.from({ length: n }, (_, i): [number, number] => [i, i]);
    const answers = [
      { ranges: pairs(HOST_CHANGES_MAX + 1) },
      { ranges: [], removedAfter: Array.from({ length: HOST_CHANGES_MAX + 1 }, (_, i) => i) },
      { ranges: pairs(HOST_CHANGES_MAX), removedAfter: Array.from({ length: HOST_CHANGES_MAX }, (_, i) => i) },
    ];
    let i = 0;
    const m = await ready(PLAIN, { changes: () => Promise.resolve(answers[i++]) });
    for (let k = 0; k < answers.length; k += 1) {
      m.say({ t: 'changes', sha });
      await vi.waitFor(() => expect(frameBound(m)).toHaveLength(k + 1));
    }
    const got = frameBound(m) as Record<string, unknown>[];
    expect(got.slice(0, 2)).toEqual([
      { t: 'changes.result', sha, unavailable: true },
      { t: 'changes.result', sha, unavailable: true },
    ]);
    expect((got[2]?.['ranges'] as unknown[]).length).toBe(HOST_CHANGES_MAX);
    expect((got[2]?.['removedAfter'] as unknown[]).length).toBe(HOST_CHANGES_MAX);
  });

  it('changes: no answer within 30 s posts unavailable and frees the slot', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
    const sha = 'd'.repeat(40);
    const m = mount(PLAIN, { changes: () => new Promise(() => undefined) });
    m.say({ t: 'ready', v: 1, nonce: m.nonce });
    m.say({ t: 'changes', sha });
    vi.advanceTimersByTime(29_999);
    expect(frameBound(m)).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(frameBound(m)).toEqual([{ t: 'changes.result', sha, unavailable: true }]);
    m.say({ t: 'changes', sha });
    vi.advanceTimersByTime(30_000);
    expect(frameBound(m)).toHaveLength(2);
  });

  it('an adapter that throws is caught and logged, and never counts against the frame', async () => {
    const m = await ready(PLAIN, {
      onHash: () => {
        throw new Error('host bug');
      },
    });
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
    for (let i = 0; i < 20; i += 1) {
      m.say({ t: 'hash', id: 'title' });
      vi.advanceTimersByTime(100);
    }
    expect(m.fallbacks()).toEqual([]);
    expect(iframes()).toBe(1);
    expect(warn).toHaveBeenCalled();
  });

  it('sixteen refusals after ready close the frame: onFallback("refusals") once', async () => {
    const m = await ready();
    for (let i = 0; i < 15; i += 1) m.say({ t: 'navigate', href: 'x', extra: 1 });
    expect(m.fallbacks()).toEqual([]);
    m.say({ t: 'store.set', key: 'pref:other', value: '1' });
    expect(m.fallbacks()).toEqual(['refusals']);
    expect(iframes()).toBe(0);
  });

  it('a messageerror counts as a refusal; a message carrying a port is refused', async () => {
    const m = await ready();
    for (let i = 0; i < 8; i += 1) m.channel.port1.onmessageerror?.({});
    for (let i = 0; i < 7; i += 1) m.say({ t: 'hash', id: 'title' }, [{}]);
    expect(m.seen.events.filter(([n]) => n === 'hash')).toEqual([]);
    expect(m.fallbacks()).toEqual([]);
    m.channel.port1.onmessageerror?.({});
    expect(m.fallbacks()).toEqual(['refusals']);
  });

  it('a rate refusal: 41 ops at one instant, the 41st refused and counted (it and 15 parser refusals close the frame)', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
    const m = mount();
    m.say({ t: 'ready', v: 1, nonce: m.nonce });
    for (let i = 0; i < 40; i += 1) m.say({ t: 'hash', id: 'title' });
    expect(m.seen.events.filter(([n]) => n === 'hash')).toHaveLength(40);
    m.say({ t: 'hash', id: 'title' });
    expect(m.seen.events.filter(([n]) => n === 'hash')).toHaveLength(40);
    for (let i = 0; i < 14; i += 1) m.say({ t: 'bogus' });
    expect(m.fallbacks()).toEqual([]);
    m.say({ t: 'bogus' });
    expect(m.fallbacks()).toEqual(['refusals']);
    expect(iframes()).toBe(0);
  });

  it('sixteen rate refusals close the frame through the limiter: onFallback("refusals") once, the iframe removed, the port closed', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
    const m = mount();
    m.say({ t: 'ready', v: 1, nonce: m.nonce });
    for (let i = 0; i < 40; i += 1) m.say({ t: 'hash', id: 'title' });
    for (let i = 0; i < 15; i += 1) m.say({ t: 'hash', id: 'title' });
    expect(m.fallbacks()).toEqual([]);
    expect(iframes()).toBe(1);
    // The sixteenth: an error, refused for rate like any op (C88(2)), closes as a refusal, not as the frame's error.
    m.say({ t: 'error', why: 'boot' });
    expect(m.fallbacks()).toEqual(['refusals']);
    expect(iframes()).toBe(0);
    expect(m.channel.port1.closed).toBe(true);
    m.say({ t: 'hash', id: 'title' });
    vi.advanceTimersByTime(10_000);
    expect(m.fallbacks()).toEqual(['refusals']);
    expect(m.seen.events.filter(([n]) => n === 'hash')).toHaveLength(40);
  });

  it('a second ready after ready is refused and changes nothing', async () => {
    const m = await ready();
    m.say({ t: 'ready', v: 1, nonce: m.nonce });
    expect(m.seen.events.map(([n]) => n)).toEqual(['ready']);
  });
});

// ───────── setPrefs, update, destroy ─────────

describe('B7.7 progress: the frame\'s share in thousandths reaches onProgress as p / 1000 (batch 1.1, C108)', () => {
  const withProgress = (): Partial<Record<keyof HostAdapters, unknown>> => ({
    onProgress: (share: unknown) => progressLog.push(share),
  });
  let progressLog: unknown[] = [];
  beforeEach(() => {
    progressLog = [];
  });

  it("'0', '1', '500' and '1000' arrive as 0, 0.001, 0.5 and 1, as numbers", async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
    const m = mount(PLAIN, withProgress());
    m.say({ t: 'ready', v: 1, nonce: m.nonce });
    for (const p of ['0', '1', '500', '1000']) {
      m.say({ t: 'progress', p });
      vi.advanceTimersByTime(250);
    }
    expect(progressLog).toEqual([0, 0.001, 0.5, 1]);
    expect(progressLog.every((v) => typeof v === 'number')).toBe(true);
    expect(m.fallbacks()).toEqual([]);
  });

  it('onProgress is called as a method of the adapters object, and a throw is caught and logged, never counted against the frame', async () => {
    const seen: Seen = { events: [] };
    const adapters = adaptersFor(seen, {
      onProgress(this: unknown) {
        seen.events.push(['this', this === adapters]);
        throw new Error('boom');
      },
    });
    const frame = mountDocFrame(container, { document: input(PLAIN), adapters });
    const ch = channels[channels.length - 1] as FakeChannel;
    const nonce = NONCE_RE.exec(container.querySelector('iframe')?.getAttribute('srcdoc') ?? '')?.[1] ?? '';
    ch.port1.onmessage?.({ data: { t: 'ready', v: 1, nonce }, ports: [] });
    ch.port1.onmessage?.({ data: { t: 'progress', p: '500' }, ports: [] });
    expect(seen.events.filter(([n]) => n === 'this')).toEqual([['this', true]]);
    expect(seen.events.filter(([n]) => n === 'fallback')).toEqual([]);
    expect(warn).toHaveBeenCalled();
    frame.destroy();
  });

  it("a value outside the grammar is refused and never reaches onProgress: '1001', '05', '-1', '5.5', a number", async () => {
    const m = await ready(PLAIN, withProgress());
    for (const p of ['1001', '05', '-1', '5.5', 500]) m.say({ t: 'progress', p });
    expect(progressLog).toEqual([]);
    expect(m.fallbacks()).toEqual([]);
  });

  it('a progress op before ready is dropped like every other op', () => {
    const m = mount(PLAIN, withProgress());
    m.say({ t: 'progress', p: '500' });
    expect(progressLog).toEqual([]);
  });

  it('a frame that sends progress to a host with no onProgress is harmless: no call, no fallback', async () => {
    const m = await ready();
    m.say({ t: 'progress', p: '500' });
    expect(m.seen.events.map(([n]) => n)).toEqual(['ready']);
    expect(m.fallbacks()).toEqual([]);
  });

  it('onProgress must be a function when given, and is a known adapter key', () => {
    expect(() => mount(PLAIN, { onProgress: 'x' })).toThrow(TypeError);
    expect(() => mount(PLAIN, { onProgress: {} })).toThrow(/adapters\.onProgress must be a function/);
    expect(iframes()).toBe(0);
    expect(() => mount(PLAIN, { onProgres: () => undefined } as never)).toThrow(/unknown key/);
  });
});

describe('B7.4 DocFrame.command(name): drops before ready and after destroy, throws on an unknown name, else focuses the iframe and posts (batch 1.1, C108)', () => {
  const NAMES = ['jump', 'settings', 'contents', 'outline'] as const;

  it('before ready it posts nothing and moves no focus (B7j)', async () => {
    const m = mount();
    await m.loaded();
    const other = document.createElement('button');
    document.body.append(other);
    other.focus();
    m.frame.command('jump');
    expect(frameBound(m)).toEqual([]);
    expect(document.activeElement === other, 'the focus stays where it was').toBe(true);
    // And the command is not queued: it does not arrive at ready.
    m.say({ t: 'ready', v: 1, nonce: m.nonce });
    expect(frameBound(m)).toEqual([]);
  });

  it('after ready it posts the exact op, once, after focusing the iframe (B7k)', async () => {
    const m = await ready();
    const other = document.createElement('button');
    document.body.append(other);
    other.focus();
    expect(document.activeElement === m.iframe, 'the iframe has lost the focus').toBe(false);
    const order: string[] = [];
    m.iframe.addEventListener('focus', () => order.push(`focus (posted ${String(frameBound(m).length)})`));
    m.frame.command('jump');
    expect(frameBound(m)).toEqual([{ t: 'command', name: 'jump' }]);
    expect(document.activeElement === m.iframe, 'the iframe is the active element').toBe(true);
    expect(order).toEqual(['focus (posted 0)']);
    for (const name of NAMES.slice(1)) m.frame.command(name);
    expect(frameBound(m)).toEqual(NAMES.map((name) => ({ t: 'command', name })));
  });

  it('it focuses the iframe even when the mount was made with focus: false (the host asked for the command)', async () => {
    const m = await ready(PLAIN, { focus: false });
    expect(document.activeElement === m.iframe, 'not focused at mount').toBe(false);
    m.frame.command('settings');
    expect(document.activeElement === m.iframe).toBe(true);
    expect(frameBound(m)).toEqual([{ t: 'command', name: 'settings' }]);
  });

  it('an unknown name throws a TypeError and posts and focuses nothing: another name, another case, an inherited name, a non-string', async () => {
    const m = await ready();
    const other = document.createElement('button');
    document.body.append(other);
    other.focus();
    for (const bad of ['print', 'Jump', ' jump', '', 'toString', 'constructor', '__proto__', 1, null, undefined, {}, ['jump']]) {
      expect(() => m.frame.command(bad as never), String(bad)).toThrow(TypeError);
    }
    expect(frameBound(m)).toEqual([]);
    expect(document.activeElement === other, 'the focus stays where it was').toBe(true);
  });

  it('the name is checked before the state: an unknown name throws before ready and after destroy too', async () => {
    const m = mount();
    expect(() => m.frame.command('print' as never)).toThrow(TypeError);
    m.frame.destroy();
    expect(() => m.frame.command('print' as never)).toThrow(TypeError);
  });

  it('after destroy() it posts and focuses nothing, and calls no adapter', async () => {
    const m = await ready();
    const focusSpy = vi.spyOn(m.iframe, 'focus');
    m.frame.destroy();
    const other = document.createElement('button');
    document.body.append(other);
    other.focus();
    const before = m.seen.events.length;
    m.frame.command('jump');
    expect(frameBound(m)).toEqual([]);
    expect(document.activeElement === other).toBe(true);
    // The iframe is gone: it is not focused either (the spy sees a call on a detached element, which moves nothing).
    expect(focusSpy).not.toHaveBeenCalled();
    expect(m.seen.events).toHaveLength(before);
  });

  it('after an update whose document is refused there is no mount: a command posts nothing on the old port and focuses no iframe', async () => {
    const m = await ready();
    const focusSpy = vi.spyOn(m.iframe, 'focus');
    const d = input(PLAIN);
    m.frame.update({ ...d, result: { ...d.result, outcome: 'failed' } });
    expect(m.fallbacks()).toEqual(['invalid-input']);
    m.frame.command('jump');
    expect(frameBound(m)).toEqual([]);
    expect(focusSpy).not.toHaveBeenCalled();
    expect(iframes()).toBe(0);
  });

  it('after update() the new mount is not ready: it posts nothing, on the old port or the new one, until its own ready', async () => {
    const m = await ready();
    m.frame.update(input(PLAIN));
    const fresh = channels[channels.length - 1] as FakeChannel;
    m.frame.command('jump');
    expect(m.channel.port1.sent).toEqual([]);
    expect(fresh.port1.sent).toEqual([]);
    const iframe = container.querySelector('iframe') as HTMLIFrameElement;
    const nonce = NONCE_RE.exec(iframe.getAttribute('srcdoc') ?? '')?.[1] ?? '';
    fresh.port1.onmessage?.({ data: { t: 'ready', v: 1, nonce }, ports: [] });
    m.frame.command('contents');
    expect(fresh.port1.sent).toEqual([{ t: 'command', name: 'contents' }]);
    expect(m.channel.port1.sent).toEqual([]);
  });

  it('after a fallback it posts nothing', async () => {
    const m = await ready();
    m.say({ t: 'error', why: 'render' });
    expect(m.fallbacks()).toEqual(['error']);
    const focusSpy = vi.spyOn(m.iframe, 'focus');
    m.frame.command('jump');
    expect(frameBound(m)).toEqual([]);
    expect(focusSpy).not.toHaveBeenCalled();
  });

  it("host code that runs at the focus (a focusout that destroys the frame) leaves the command unposted, and nothing throws", async () => {
    const m = await ready();
    const search = document.createElement('input');
    document.body.append(search);
    search.focus();
    search.addEventListener('focusout', () => m.frame.destroy());
    expect(() => m.frame.command('jump')).not.toThrow();
    expect(frameBound(m)).toEqual([]);
  });

  it('the op is the whole message: exactly {t, name}', async () => {
    const m = await ready();
    m.frame.command('outline');
    const [op] = frameBound(m);
    expect(Object.keys(op as object)).toEqual(['t', 'name']);
  });
});

describe('setPrefs, update and destroy (Reference §11.4)', () => {
  it('setPrefs before ready queues the latest and posts it once at ready; after ready it posts at once', async () => {
    const m = mount();
    await m.loaded();
    m.frame.setPrefs({ theme: 'dark' });
    m.frame.setPrefs({ width: 'wide' });
    expect(frameBound(m)).toEqual([]);
    m.say({ t: 'ready', v: 1, nonce: m.nonce });
    expect(frameBound(m)).toEqual([{ t: 'prefs', theme: 'dark', width: 'wide' }]);
    m.frame.setPrefs({ font: 'sans' });
    expect(frameBound(m)).toEqual([
      { t: 'prefs', theme: 'dark', width: 'wide' },
      { t: 'prefs', font: 'sans' },
    ]);
  });

  it('setPrefs seeds the next remount', () => {
    const m = mount(PLAIN, { prefs: { theme: 'light' } });
    expect(seedOf(m.iframe.getAttribute('srcdoc') ?? '')['prefs']).toEqual({ theme: 'light' });
    m.frame.setPrefs({ font: 'sans' });
    m.frame.update(input(PLAIN));
    expect(seedOf(container.querySelector('iframe')?.getAttribute('srcdoc') ?? '')['prefs']).toEqual({ theme: 'light', font: 'sans' });
  });

  it('setPrefs refuses a value outside its enum, an unknown key and a getter', () => {
    const m = mount();
    expect(() => m.frame.setPrefs({ theme: 'neon' } as never)).toThrow(RangeError);
    expect(() => m.frame.setPrefs({ lens: 'product' } as never)).toThrow(TypeError);
    const getter = Object.defineProperty({}, 'theme', { get: () => 'dark', enumerable: true });
    expect(() => m.frame.setPrefs(getter)).toThrow(TypeError);
    expect(() => m.frame.setPrefs(null as never)).toThrow(TypeError);
  });

  it('destroy is idempotent, calls no adapter, removes the iframe, closes the port, and later messages do nothing', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
    const m = mount(PLAIN, { watchdogMs: 1000 });
    m.frame.destroy();
    m.frame.destroy();
    expect(iframes()).toBe(0);
    expect(m.channel.port1.closed).toBe(true);
    m.say({ t: 'ready', v: 1, nonce: m.nonce });
    vi.advanceTimersByTime(10_000);
    m.frame.update(input(PLAIN));
    m.frame.setPrefs({ theme: 'dark' });
    expect(m.seen.events).toEqual([]);
    expect(iframes()).toBe(0);
  });

  it('destroy called by host code that runs inside update (a focusout at the new iframe\'s focus) tears the new mount down: no iframe, a closed port, no adapter call after', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
    const m = mount(PLAIN, { watchdogMs: 1000 });
    const search = document.createElement('input');
    document.body.append(search);
    search.focus();
    let calls = 0;
    let srcdoc = '';
    search.addEventListener('focusout', () => {
      calls += 1;
      srcdoc = container.querySelector('iframe')?.getAttribute('srcdoc') ?? '';
      m.frame.destroy();
    });
    m.frame.update(input(PLAIN));
    expect(calls).toBe(1);
    expect(channels).toHaveLength(2);
    const fresh = channels[1] as FakeChannel;
    expect(iframes()).toBe(0);
    expect(fresh.port1.closed).toBe(true);
    const nonce = seedOf(srcdoc)['nonce'];
    expect(nonce).not.toBe(m.nonce);
    fresh.port1.onmessage?.({ data: { t: 'ready', v: 1, nonce }, ports: [] });
    vi.advanceTimersByTime(10_000);
    m.frame.setPrefs({ theme: 'dark' });
    expect(fresh.port1.sent).toEqual([]);
    expect(m.seen.events).toEqual([]);
    m.frame.destroy();
    expect(iframes()).toBe(0);
  });

  it('update called by host code that runs inside update leaves exactly one live mount, the innermost', async () => {
    const m = mount(PLAIN, { watchdogMs: 1000 });
    const search = document.createElement('input');
    document.body.append(search);
    search.focus();
    let calls = 0;
    search.addEventListener('focusout', () => {
      calls += 1;
      if (calls === 1) m.frame.update(input('# Inner\n\nText.\n'));
    });
    m.frame.update(input(PLAIN));
    expect(channels).toHaveLength(3);
    expect(iframes()).toBe(1);
    expect((channels[1] as FakeChannel).port1.closed).toBe(true);
    expect((channels[2] as FakeChannel).port1.closed).toBe(false);
    expect(container.querySelector('iframe')?.getAttribute('srcdoc')).toContain('Inner');
    m.frame.destroy();
    expect(iframes()).toBe(0);
    expect((channels[2] as FakeChannel).port1.closed).toBe(true);
  });

  it('a mount that fell back is not remounted by itself; update mounts again', async () => {
    const m = mount();
    await m.loaded();
    m.say({ t: 'ready', v: 1, nonce: 'f'.repeat(32) });
    expect(iframes()).toBe(0);
    m.frame.update(input(PLAIN));
    expect(iframes()).toBe(1);
  });
});

// ───────── the adapters are checked before any iframe exists ─────────

describe('Reference §11.1 step 1: the adapters, checked before any iframe exists', () => {
  const refused = (over: Record<string, unknown>, kind: typeof TypeError | typeof RangeError): void => {
    const create = vi.spyOn(document, 'createElement');
    try {
      expect(() => mountDocFrame(container, { document: input(PLAIN), adapters: adaptersFor({ events: [] }, over) })).toThrow(kind);
      expect(create.mock.calls.filter(([t]) => t === 'iframe')).toEqual([]);
    } finally {
      create.mockRestore();
    }
    expect(iframes()).toBe(0);
  };

  it('watchdogMs: an integer from 1 to 120000', () => {
    refused({ watchdogMs: 0 }, RangeError);
    refused({ watchdogMs: 120_001 }, RangeError);
    refused({ watchdogMs: 1.5 }, RangeError);
    refused({ watchdogMs: '5000' }, TypeError);
    refused({ watchdogMs: undefined }, TypeError);
  });

  it('onFallback a function; every other callback a function when given', () => {
    refused({ onFallback: undefined }, TypeError);
    refused({ onFallback: 'x' }, TypeError);
    refused({ onLink: 1 }, TypeError);
    refused({ changes: {} }, TypeError);
  });

  it('mermaidDraw one of its values; each mermaidGate cap at most its default', () => {
    refused({ mermaidDraw: 'eager' }, RangeError);
    refused({ mermaidGate: { maxFences: MERMAID_GATE_DEFAULTS.maxFences + 1 } }, RangeError);
    refused({ mermaidGate: { maxFenceChars: 0 } }, RangeError);
    refused({ mermaidGate: { other: 1 } }, TypeError);
  });

  it('own data properties only: a getter is refused unread, an unknown key refused, an inherited adapter is absent', () => {
    let read = false;
    const adapters = adaptersFor({ events: [] });
    const withGetter = Object.defineProperty({ ...adapters }, 'onLink', {
      enumerable: true,
      get: () => {
        read = true;
        return () => undefined;
      },
    });
    expect(() => mountDocFrame(container, { document: input(PLAIN), adapters: withGetter })).toThrow(TypeError);
    expect(read).toBe(false);
    refused({ extra: 1 }, TypeError);
    const { onFallback: _f, ...rest } = adapters;
    const inherited = Object.assign(Object.create({ onFallback: () => undefined }) as object, rest) as HostAdapters;
    expect(() => mountDocFrame(container, { document: input(PLAIN), adapters: inherited })).toThrow(TypeError);
    expect(iframes()).toBe(0);
  });

  it('the element must be an element of a document with a window', () => {
    expect(() => mountDocFrame(null as never, { document: input(PLAIN), adapters: adaptersFor({ events: [] }) })).toThrow(TypeError);
  });
});

// ───────── L3.H11: FrameError codes to fallback reasons ─────────

describe('L3.H11 each FrameErrorCode maps to its FallbackReason; no iframe is created (Reference §11.1 step 5)', () => {
  const fellBack = (doc: RenderInput, over: Record<string, unknown> = {}): FallbackReason[] => {
    const seen: Seen = { events: [] };
    const create = vi.spyOn(document, 'createElement');
    try {
      mountDocFrame(container, { document: doc, adapters: adaptersFor(seen, over) });
      expect(create.mock.calls.filter(([t]) => t === 'iframe')).toEqual([]);
    } finally {
      create.mockRestore();
    }
    expect(iframes()).toBe(0);
    expect(channels).toEqual([]);
    return seen.events.map(([n, v]) => {
      expect(n).toBe('fallback');
      return v as FallbackReason;
    });
  };
  const flip = (s: string, at: number): string => s.slice(0, at) + (s[at] === 'a' ? 'b' : 'a') + s.slice(at + 1);

  it('not-rendered (an over-limit document): invalid-input', () => {
    const d = input(PLAIN);
    expect(fellBack({ ...d, result: { ...d.result, outcome: 'over-limit' } })).toEqual(['invalid-input']);
  });

  it('invalid-input (a bad lang): invalid-input', () => {
    expect(fellBack({ ...input(PLAIN), lang: 'not a tag' })).toEqual(['invalid-input']);
  });

  it('too-large (an html over the seed cap): too-large', () => {
    const d = input(PLAIN);
    expect(fellBack({ ...d, result: { ...d.result, html: 'a'.repeat(SEED_HTML_MAX_CHARS + 1) } })).toEqual(['too-large']);
  });

  it('asset-mismatch (a flipped asset byte): assets', () => {
    expect(fellBack(input(PLAIN), { assets: { ...assets, enhance: flip(assets.enhance, 1000) } })).toEqual(['assets']);
  });

  it('missing-asset (a document whose gate lets Mermaid in, with no Mermaid asset): assets', () => {
    expect(fellBack(input(MERMAID_DOC))).toEqual(['assets']);
  });

  it('unsafe-asset (a planted CR in an asset): assets', () => {
    expect(fellBack(input(PLAIN), { assets: { ...assets, guard: `${assets.guard}\r` } })).toEqual(['assets']);
  });

  for (const code of ['nonce', 'csp'] as const) {
    it(`${code} (reached through a stubbed frameDocument): assets, after the internal warning`, () => {
      stub.code = code;
      expect(fellBack(input(PLAIN))).toEqual(['assets']);
      expect(warn.mock.calls).toContainEqual(['pinax-lib host: internal', code]);
    });
  }

  it('an update whose document is refused falls back once and leaves no iframe', async () => {
    const m = await ready();
    const d = input(PLAIN);
    m.frame.update({ ...d, result: { ...d.result, outcome: 'failed' } });
    expect(m.fallbacks()).toEqual(['invalid-input']);
    expect(iframes()).toBe(0);
  });
});

// ───────── L3.D5, host half; the gate; the bridge switches ─────────

describe("L3.D5 host half, the Mermaid gate and the bridge switches (Reference §11.1 steps 2 and 5)", () => {
  it("mermaidDraw 'on-request' seeds draw 'on-request'; absent seeds 'auto'; maxTextSize is the per-fence cap", () => {
    const a = mount(MERMAID_DOC, { assets: { ...assets, mermaid: mermaidText }, mermaidDraw: 'on-request' });
    expect(seedOf(a.iframe.getAttribute('srcdoc') ?? '')['mermaid']).toEqual({ maxTextSize: MERMAID_GATE_DEFAULTS.maxFenceChars, secure: [], draw: 'on-request' });
    a.frame.destroy();
    const b = mount(MERMAID_DOC, { assets: { ...assets, mermaid: mermaidText } });
    expect(seedOf(b.iframe.getAttribute('srcdoc') ?? '')['mermaid']).toEqual({ maxTextSize: MERMAID_GATE_DEFAULTS.maxFenceChars, secure: [], draw: 'auto' });
    b.frame.destroy();
    const c = mount(MERMAID_DOC, { assets: { ...assets, mermaid: mermaidText }, mermaidGate: { maxFenceChars: 100 } });
    expect(seedOf(c.iframe.getAttribute('srcdoc') ?? '')['mermaid']).toEqual({ maxTextSize: 100, secure: [], draw: 'auto' });
  });

  it('a document the gate keeps out (no fences, or more fences than the cap) carries no Mermaid script', () => {
    const plain = mount(PLAIN, { assets: { ...assets, mermaid: mermaidText } });
    expect(seedOf(plain.iframe.getAttribute('srcdoc') ?? '')['mermaid']).toBeNull();
    expect((plain.iframe.getAttribute('srcdoc') ?? '').includes(mermaidText)).toBe(false);
    plain.frame.destroy();
    const over = mount(MERMAID_DOC, { assets: { ...assets, mermaid: mermaidText }, mermaidGate: { maxTotalChars: 5 } });
    expect(seedOf(over.iframe.getAttribute('srcdoc') ?? '')['mermaid']).toBeNull();
  });

  it('a document with no scan carries no Mermaid script', () => {
    const d = input(MERMAID_DOC);
    const { scan: _s, ...noScan } = d;
    const m = mount(MERMAID_DOC, {}, noScan);
    expect(seedOf(m.iframe.getAttribute('srcdoc') ?? '')['mermaid']).toBeNull();
  });

  it('the bridge switches follow which adapters exist', () => {
    const all = mount(PLAIN, { changes: () => Promise.resolve(null), onProgress: () => undefined });
    expect(seedOf(all.iframe.getAttribute('srcdoc') ?? '')['bridge']).toEqual({ links: true, hash: true, copy: true, changes: true, versions: true, progress: true, places: false, printFigures: false });
    all.frame.destroy();
    const none = mount(PLAIN, { onLink: undefined, onHash: undefined, copy: undefined, openVersion: undefined });
    expect(seedOf(none.iframe.getAttribute('srcdoc') ?? '')['bridge']).toEqual({ links: false, hash: false, copy: false, changes: false, versions: false, progress: false, places: false, printFigures: false });
  });

  it('B7.2: progress is switched on by onProgress alone, and by nothing else (B7i)', () => {
    const without = mount(PLAIN, { changes: () => Promise.resolve(null) });
    expect(seedOf(without.iframe.getAttribute('srcdoc') ?? '')['bridge']).toMatchObject({ links: true, hash: true, copy: true, changes: true, versions: true, progress: false, places: false, printFigures: false });
    without.frame.destroy();
    const only = mount(PLAIN, { onLink: undefined, onHash: undefined, copy: undefined, openVersion: undefined, onProgress: () => undefined });
    expect(seedOf(only.iframe.getAttribute('srcdoc') ?? '')['bridge']).toEqual({ links: false, hash: false, copy: false, changes: false, versions: false, progress: true, places: false, printFigures: false });
  });

  it('features and prefs pass through to the seed', () => {
    const m = mount(PLAIN, { features: { rules: false }, prefs: { theme: 'dark', width: 'wide' } });
    const seed = seedOf(m.iframe.getAttribute('srcdoc') ?? '');
    expect(seed['features']).toEqual({ rules: false });
    expect(seed['prefs']).toEqual({ theme: 'dark', width: 'wide' });
  });
});

// ───────── B4: mermaidDraw 'after-ready' and loadMermaid (docserver batch T4; ledger C107) ─────────

describe("B4 mermaidDraw 'after-ready': the build is fetched in parallel with the boot and posted after ready (ledger C107)", () => {
  const AFTER = { mermaidDraw: 'after-ready' } as const;
  const OP_CAP = 8_388_608;
  /** The one warning's first argument; its second is a fixed reason, never a value the loader supplied. */
  const UNAVAILABLE = 'pinax-lib host: the Mermaid build is unavailable';

  /** A loader the test settles by hand, and the number of times it was called. */
  function deferred(): { readonly load: () => Promise<string>; readonly calls: () => number; resolve(v: unknown): void; reject(e: unknown): void } {
    let n = 0;
    let res: (v: string) => void = () => undefined;
    let rej: (e: unknown) => void = () => undefined;
    return {
      load: () => {
        n += 1;
        return new Promise<string>((a, b) => {
          res = a;
          rej = b;
        });
      },
      calls: () => n,
      resolve: (v) => res(v as string),
      reject: (e) => rej(e),
    };
  }

  /** Records every postMessage on a channel's parent end, also after the port closed (the fake port drops those). */
  function watch(channel: FakeChannel): unknown[] {
    const posts: unknown[] = [];
    const original = channel.port1.postMessage.bind(channel.port1);
    channel.port1.postMessage = (m: unknown): void => {
      posts.push(m);
      original(m);
    };
    return posts;
  }

  /**
   * The mermaid ops among the posts, the text summarised: a failing assertion formats its values, and a diff of a
   * 3.7 MB build (or a Mermaid-sized string) would exhaust the worker.
   */
  const mermaidOps = (posts: readonly unknown[]): unknown[] =>
    posts
      .filter((p) => (p as { t?: unknown }).t === 'mermaid')
      .map((p) => {
        const op = p as { t: string; text?: unknown; unavailable?: unknown };
        if (!('text' in op)) return op;
        const { text } = op;
        return { t: op.t, text: typeof text !== 'string' ? `a ${typeof text}` : text === mermaidText ? 'the build' : `another text of ${String(text.length)} code units` };
      });
  const settle = (): Promise<void> => new Promise((r) => globalThis.setTimeout(r, 0));

  /** The newest mount: its channel, its posts and a way to speak as its frame. */
  function newest(): { readonly channel: FakeChannel; readonly posts: unknown[]; ready(): void } {
    const all = container.querySelectorAll('iframe');
    const iframe = all[all.length - 1] as HTMLIFrameElement;
    const channel = channels[channels.length - 1] as FakeChannel;
    const nonce = NONCE_RE.exec(iframe.getAttribute('srcdoc') ?? '')?.[1] ?? '';
    const posts = watch(channel);
    return { channel, posts, ready: () => channel.port1.onmessage?.({ data: { t: 'ready', v: 1, nonce }, ports: [] }) };
  }

  it("B4.0: 'after-ready' is an accepted mode: a mount with a loader does not throw, and the srcdoc seeds it", () => {
    let m: Mounted | undefined;
    expect(() => {
      m = mount(MERMAID_DOC, { ...AFTER, loadMermaid: () => new Promise<string>(() => undefined) });
    }).not.toThrow();
    expect(iframes()).toBe(1);
    expect((seedOf((m as Mounted).iframe.getAttribute('srcdoc') ?? '')['mermaid'] as { draw: string }).draw).toBe('after-ready');
  });

  it('B4.1: for a document the gate admits, the loader is called at mount, before ready; nothing is posted before ready; the op follows a valid ready', async () => {
    const d = deferred();
    const m = mount(MERMAID_DOC, { ...AFTER, loadMermaid: d.load });
    const posts = watch(m.channel);
    expect(d.calls()).toBe(1);
    const srcdoc = m.iframe.getAttribute('srcdoc') ?? '';
    expect(seedOf(srcdoc)['mermaid']).toEqual({ maxTextSize: MERMAID_GATE_DEFAULTS.maxFenceChars, secure: [], draw: 'after-ready' });
    expect(srcdoc.includes(mermaidText), 'no inline Mermaid script').toBe(false);
    await m.loaded();
    d.resolve(mermaidText);
    await settle();
    expect(mermaidOps(posts), 'nothing before ready').toEqual([]);
    m.say({ t: 'ready', v: 1, nonce: m.nonce });
    expect(mermaidOps(posts), 'the build, byte for byte').toEqual([{ t: 'mermaid', text: 'the build' }]);
    expect(Object.keys(posts.find((p) => (p as { t?: unknown }).t === 'mermaid') as object)).toEqual(['t', 'text']);
    await settle();
    expect(mermaidOps(posts), 'exactly once').toHaveLength(1);
    expect(d.calls()).toBe(1);
  });

  it('B4.2: an answer that arrives after ready is posted at once', async () => {
    const d = deferred();
    const m = mount(MERMAID_DOC, { ...AFTER, loadMermaid: d.load });
    const posts = watch(m.channel);
    await m.loaded();
    m.say({ t: 'ready', v: 1, nonce: m.nonce });
    expect(mermaidOps(posts)).toEqual([]);
    d.resolve(mermaidText);
    await settle();
    expect(mermaidOps(posts)).toEqual([{ t: 'mermaid', text: 'the build' }]);
  });

  it('B4.3: a wrong text posts unavailable and warns; so does a rejection', async () => {
    const wrong = deferred();
    const a = mount(MERMAID_DOC, { ...AFTER, loadMermaid: wrong.load });
    const aPosts = watch(a.channel);
    await a.loaded();
    a.say({ t: 'ready', v: 1, nonce: a.nonce });
    wrong.resolve(`${mermaidText} `);
    await settle();
    expect(mermaidOps(aPosts)).toEqual([{ t: 'mermaid', unavailable: true }]);
    expect(warn.mock.calls).toEqual([[UNAVAILABLE, 'the build is not the shipped one']]);
    a.frame.destroy();
    warn.mockClear();
    const rejected = deferred();
    const b = mount(MERMAID_DOC, { ...AFTER, loadMermaid: rejected.load });
    const bPosts = watch(b.channel);
    await b.loaded();
    b.say({ t: 'ready', v: 1, nonce: b.nonce });
    rejected.reject(new Error('offline'));
    await settle();
    expect(mermaidOps(bPosts)).toEqual([{ t: 'mermaid', unavailable: true }]);
    expect(warn.mock.calls, 'a fixed reason, never the rejection').toEqual([[UNAVAILABLE, 'the loader rejected']]);
  });

  it('B4.4: an answer that arrives after destroy() posts nothing', async () => {
    const d = deferred();
    const m = mount(MERMAID_DOC, { ...AFTER, loadMermaid: d.load });
    const posts = watch(m.channel);
    await m.loaded();
    m.say({ t: 'ready', v: 1, nonce: m.nonce });
    m.frame.destroy();
    d.resolve(mermaidText);
    await settle();
    expect(mermaidOps(posts)).toEqual([]);
  });

  it('B4.4b: an onReady adapter that destroys or updates, with the answer already known, leaves the replaced mount silent', async () => {
    for (const how of ['destroy', 'update'] as const) {
      const d = deferred();
      let frame: DocFrame | undefined;
      const m = mount(MERMAID_DOC, { ...AFTER, loadMermaid: d.load, onReady: () => (how === 'destroy' ? frame?.destroy() : frame?.update(input(PLAIN))) });
      frame = m.frame;
      const posts = watch(m.channel);
      await m.loaded();
      d.resolve(mermaidText);
      await settle();
      m.say({ t: 'ready', v: 1, nonce: m.nonce });
      expect(mermaidOps(posts), how).toEqual([]);
    }
  });

  it("B4.5: 'after-ready' with neither source is a TypeError; with assets.mermaid only, that text is posted after ready", async () => {
    expect(() => mountDocFrame(container, { document: input(MERMAID_DOC), adapters: adaptersFor({ events: [] }, AFTER) })).toThrow(TypeError);
    expect(iframes()).toBe(0);
    // A non-function loader is refused on its own, even when assets.mermaid could serve (B4l).
    expect(() => mountDocFrame(container, { document: input(MERMAID_DOC), adapters: adaptersFor({ events: [] }, { ...AFTER, loadMermaid: 'x', assets: { ...assets, mermaid: mermaidText } }) })).toThrow(TypeError);
    expect(iframes()).toBe(0);
    expect(() => mountDocFrame(container, { document: input(MERMAID_DOC), adapters: adaptersFor({ events: [] }, { ...AFTER, assets: { ...assets, mermaid: 5 } }) })).toThrow(TypeError);
    const m = mount(MERMAID_DOC, { ...AFTER, assets: { ...assets, mermaid: mermaidText } });
    const posts = watch(m.channel);
    expect((m.iframe.getAttribute('srcdoc') ?? '').includes(mermaidText), 'not inlined').toBe(false);
    await m.loaded();
    await settle();
    expect(mermaidOps(posts)).toEqual([]);
    m.say({ t: 'ready', v: 1, nonce: m.nonce });
    expect(mermaidOps(posts)).toEqual([{ t: 'mermaid', text: 'the build' }]);
  });

  it('B4.5b: with both sources, the loader is used: it is called once and its wrong answer gives unavailable, though assets.mermaid holds the true build', async () => {
    const d = deferred();
    const m = mount(MERMAID_DOC, { ...AFTER, loadMermaid: d.load, assets: { ...assets, mermaid: mermaidText } });
    const posts = watch(m.channel);
    await m.loaded();
    m.say({ t: 'ready', v: 1, nonce: m.nonce });
    d.resolve(`${mermaidText} `);
    await settle();
    expect(d.calls()).toBe(1);
    expect(mermaidOps(posts)).toEqual([{ t: 'mermaid', unavailable: true }]);
  });

  it("B4.6: 'auto' and 'on-request' never call loadMermaid and post no mermaid op", async () => {
    for (const mode of ['auto', 'on-request'] as const) {
      const d = deferred();
      const m = mount(MERMAID_DOC, { mermaidDraw: mode, assets: { ...assets, mermaid: mermaidText }, loadMermaid: d.load });
      const posts = watch(m.channel);
      await m.loaded();
      m.say({ t: 'ready', v: 1, nonce: m.nonce });
      d.resolve(mermaidText);
      await settle();
      expect(d.calls(), mode).toBe(0);
      expect(mermaidOps(posts), mode).toEqual([]);
      m.frame.destroy();
    }
    const d = deferred();
    const dflt = mount(MERMAID_DOC, { assets: { ...assets, mermaid: mermaidText }, loadMermaid: d.load });
    await settle();
    expect(d.calls(), 'default mode').toBe(0);
    dflt.frame.destroy();
  });

  it("B4.6b: in any other mode a loadMermaid that is not a function is ignored: the mount succeeds and nothing is called", async () => {
    for (const mode of ['auto', 'on-request'] as const) {
      let m: Mounted | undefined;
      expect(() => {
        m = mount(MERMAID_DOC, { mermaidDraw: mode, assets: { ...assets, mermaid: mermaidText }, loadMermaid: 'x' });
      }, mode).not.toThrow();
      expect(iframes(), mode).toBe(1);
      (m as Mounted).frame.destroy();
    }
    let n: Mounted | undefined;
    expect(() => {
      n = mount(PLAIN, { loadMermaid: 42 });
    }, 'the default mode').not.toThrow();
    (n as Mounted).frame.destroy();
  });

  it('B4.7: an update before the loader resolves: the new mount gets exactly one op, the replaced mount none, the loader one call; a later update re-posts without a call', async () => {
    const d = deferred();
    const first = mount(MERMAID_DOC, { ...AFTER, loadMermaid: d.load });
    const firstPosts = watch(first.channel);
    await first.loaded();
    first.say({ t: 'ready', v: 1, nonce: first.nonce });
    first.frame.update(input(MERMAID_DOC));
    const second = newest();
    expect(d.calls(), 'the remount reuses the held verdict').toBe(1);
    second.ready();
    d.resolve(mermaidText);
    await settle();
    expect(mermaidOps(firstPosts), 'the replaced mount posts nothing').toEqual([]);
    expect(mermaidOps(second.posts)).toEqual([{ t: 'mermaid', text: 'the build' }]);
    first.frame.update(input(MERMAID_DOC));
    const third = newest();
    third.ready();
    await settle();
    expect(mermaidOps(third.posts)).toEqual([{ t: 'mermaid', text: 'the build' }]);
    expect(mermaidOps(second.posts), 'still one for the second').toHaveLength(1);
    expect(d.calls(), 'one call for the whole DocFrame').toBe(1);
  });

  it('B4.7a: a failed answer warns once per DocFrame: a remount after it is told unavailable, with no second warning', async () => {
    const d = deferred();
    const first = mount(MERMAID_DOC, { ...AFTER, loadMermaid: d.load });
    await first.loaded();
    first.say({ t: 'ready', v: 1, nonce: first.nonce });
    d.reject(new Error('offline'));
    await settle();
    expect(warn.mock.calls).toEqual([[UNAVAILABLE, 'the loader rejected']]);
    first.frame.update(input(MERMAID_DOC));
    const second = newest();
    second.ready();
    await settle();
    expect(mermaidOps(second.posts)).toEqual([{ t: 'mermaid', unavailable: true }]);
    first.frame.update(input(MERMAID_DOC));
    const third = newest();
    third.ready();
    await settle();
    expect(mermaidOps(third.posts)).toEqual([{ t: 'mermaid', unavailable: true }]);
    expect(warn.mock.calls, 'one warning for the DocFrame').toHaveLength(1);
    expect(d.calls()).toBe(1);
  });

  it('B4.7b: a replaced mount that is not replaced by a Mermaid mount still posts nothing when the answer arrives', async () => {
    const d = deferred();
    const first = mount(MERMAID_DOC, { ...AFTER, loadMermaid: d.load });
    const firstPosts = watch(first.channel);
    await first.loaded();
    first.say({ t: 'ready', v: 1, nonce: first.nonce });
    first.frame.update(input(PLAIN));
    d.resolve(mermaidText);
    await settle();
    expect(mermaidOps(firstPosts)).toEqual([]);
    expect(mermaidOps(newest().posts)).toEqual([]);
  });

  it('B4.8: a document with no fences never calls loadMermaid and posts no op; an update that brings figures calls it once', async () => {
    const d = deferred();
    const m = mount(PLAIN, { ...AFTER, loadMermaid: d.load });
    const posts = watch(m.channel);
    await m.loaded();
    m.say({ t: 'ready', v: 1, nonce: m.nonce });
    await settle();
    expect(d.calls()).toBe(0);
    expect(mermaidOps(posts)).toEqual([]);
    m.frame.update(input(MERMAID_DOC));
    expect(d.calls()).toBe(1);
    const next = newest();
    next.ready();
    d.resolve(mermaidText);
    await settle();
    expect(mermaidOps(next.posts)).toEqual([{ t: 'mermaid', text: 'the build' }]);
  });

  it('B4.8b: a destroy at the step-8 focus (a focusout handler) means the loader is never called', () => {
    const d = deferred();
    const m = mount(PLAIN, { ...AFTER, loadMermaid: d.load });
    const search = document.createElement('input');
    document.body.append(search);
    search.focus();
    search.addEventListener('focusout', () => m.frame.destroy());
    m.frame.update(input(MERMAID_DOC));
    expect(iframes()).toBe(0);
    expect(d.calls(), 'no adapter call after destroy').toBe(0);
  });

  it('B4.9: a loader that throws, resolves to a non-string, or resolves over the cap posts unavailable and warns once with its reason; nothing throws out of mountDocFrame', async () => {
    const loaders: [string, string, () => Promise<string>][] = [
      ['a synchronous throw', 'the loader threw', () => { throw new Error('sync'); }],
      ['a non-string', 'the loader did not answer a string', () => Promise.resolve(42 as unknown as string)],
      // A String object has the right length and characters, so only the typeof check (not the hash) refuses it.
      ['a String object', 'the loader did not answer a string', () => Promise.resolve(new String(mermaidText) as unknown as string)],
      // Over the cap the hash would refuse it too, so only the reason tells the cap check from the hash check.
      ['over the cap', 'the build is over the bridge cap', () => Promise.resolve('a'.repeat(OP_CAP + 1))],
      ['a thenable whose then throws', 'the loader rejected', () => ({ then: () => { throw new Error('then'); } }) as unknown as Promise<string>],
      ['a throwing then getter', 'the loader rejected', () => Object.defineProperty({}, 'then', { get: () => { throw new Error('getter'); } }) as unknown as Promise<string>],
      ['a rejection', 'the loader rejected', () => Promise.reject(new Error('offline'))],
    ];
    for (const [name, reason, loadMermaid] of loaders) {
      warn.mockClear();
      let m: Mounted | undefined;
      expect(() => { m = mount(MERMAID_DOC, { ...AFTER, loadMermaid }); }, name).not.toThrow();
      const mounted = m as Mounted;
      const posts = watch(mounted.channel);
      await mounted.loaded();
      mounted.say({ t: 'ready', v: 1, nonce: mounted.nonce });
      await settle();
      expect(mermaidOps(posts), name).toEqual([{ t: 'mermaid', unavailable: true }]);
      expect(warn.mock.calls, name).toEqual([[UNAVAILABLE, reason]]);
      mounted.frame.destroy();
    }
  });

  it('B4.9c: a console that throws, and a value whose formatting throws, change nothing: the verdict still arrives and nothing throws out of mountDocFrame, update() or the port', async () => {
    const hostile = { [Symbol.for('nodejs.util.inspect.custom')]: () => { throw new Error('inspect'); } };
    warn.mockImplementation(() => { throw new Error('console down'); });
    const loaders: [string, () => Promise<string>][] = [
      ['a synchronous throw', () => { throw hostile; }],
      ['a rejection', () => Promise.reject(hostile)],
      ['a wrong text', () => Promise.resolve(`${mermaidText} `)],
    ];
    for (const [name, loadMermaid] of loaders) {
      let m: Mounted | undefined;
      expect(() => { m = mount(MERMAID_DOC, { ...AFTER, loadMermaid }); }, name).not.toThrow();
      const mounted = m as Mounted;
      const posts = watch(mounted.channel);
      await mounted.loaded();
      expect(() => mounted.say({ t: 'ready', v: 1, nonce: mounted.nonce }), name).not.toThrow();
      await settle();
      expect(mermaidOps(posts), name).toEqual([{ t: 'mermaid', unavailable: true }]);
      expect(() => mounted.frame.update(input(MERMAID_DOC)), name).not.toThrow();
      mounted.frame.destroy();
    }
    warn.mockClear();
    // The reason is a fixed string: no argument of the one warning is a value the loader supplied.
    warn.mockImplementation(() => undefined);
    const bad = mount(MERMAID_DOC, { ...AFTER, loadMermaid: () => Promise.reject(hostile) });
    await bad.loaded();
    await settle();
    expect(warn.mock.calls).toEqual([[UNAVAILABLE, 'the loader rejected']]);
  });

  it('B4.9d: a port that throws on the mermaid post, with a console that throws too, never throws out of the port', async () => {
    const m = mount(MERMAID_DOC, { ...AFTER, assets: { ...assets, mermaid: mermaidText } });
    await m.loaded();
    await settle();
    m.channel.port1.postMessage = (): void => {
      throw new Error('port gone');
    };
    warn.mockImplementation(() => { throw new Error('console down'); });
    expect(() => m.say({ t: 'ready', v: 1, nonce: m.nonce })).not.toThrow();
    expect(m.seen.events.map(([n]) => n)).toEqual(['ready']);
  });

  it('B4.9b: a loader that calls update() or destroy() from inside itself never loops, never throws and is called once; the current mount, not the outer one, receives the verdict', async () => {
    for (const how of ['update', 'destroy'] as const) {
      const d = deferred();
      let calls = 0;
      let frame: DocFrame | undefined;
      const load = (): Promise<string> => {
        calls += 1;
        if (how === 'update') frame?.update(input(MERMAID_DOC));
        else frame?.destroy();
        return d.load();
      };
      const m = mount(PLAIN, { ...AFTER, loadMermaid: load });
      frame = m.frame;
      expect(() => m.frame.update(input(MERMAID_DOC)), how).not.toThrow();
      expect(calls, how).toBe(1);
      const all = channels.slice();
      const outer = all[all.length - 2] as FakeChannel;
      const outerPosts = watch(outer);
      if (how === 'update') {
        const inner = newest();
        inner.ready();
        d.resolve(mermaidText);
        await settle();
        expect(mermaidOps(inner.posts), how).toEqual([{ t: 'mermaid', text: 'the build' }]);
        expect(mermaidOps(outerPosts), how).toEqual([]);
        expect(calls, how).toBe(1);
      } else {
        const last = channels[channels.length - 1] as FakeChannel;
        const lastPosts = watch(last);
        d.resolve(mermaidText);
        await settle();
        expect(mermaidOps(lastPosts), how).toEqual([]);
        expect(iframes(), how).toBe(0);
      }
      m.frame.destroy();
      container.replaceChildren();
    }
  });

  it('B4.9e: a ready with a wrong nonce is not a ready: the frame falls back, and an answer that arrives after it posts nothing', async () => {
    const d = deferred();
    const m = mount(MERMAID_DOC, { ...AFTER, loadMermaid: d.load });
    const posts = watch(m.channel);
    await m.loaded();
    m.say({ t: 'ready', v: 1, nonce: 'f'.repeat(32) });
    d.resolve(mermaidText);
    await settle();
    expect(m.fallbacks()).toEqual(['nonce']);
    expect(mermaidOps(posts)).toEqual([]);
  });

  /**
   * Collects garbage now: the flag is set at run time, so the suite needs no launch option. A value an assertion holds is
   * a WeakRef's target only, never a strong reference.
   */
  const collect = async (): Promise<void> => {
    v8.setFlagsFromString('--expose-gc');
    const gc = vm.runInNewContext('gc') as () => void;
    for (let i = 0; i < 6; i += 1) {
      await new Promise((r) => globalThis.setTimeout(r, 25));
      gc();
    }
  };

  /**
   * A mount into a stand-in element whose document makes a div where the mount asks for an iframe. jsdom keeps every
   * iframe it ever made reachable, so only a div can be collected; what a mount holds on to is the same either way.
   * `made` holds a weak handle on each element the mount created, oldest first.
   */
  function weakMount(doc: RenderInput, over: Partial<Record<keyof HostAdapters, unknown>>): { readonly frame: DocFrame; readonly made: WeakRef<object>[] } {
    const made: WeakRef<object>[] = [];
    const stubWin = {
      document: {
        createElement: (): HTMLElement => {
          const el = document.createElement('div');
          made.push(new WeakRef(el));
          return el;
        },
      },
      crypto: win.crypto,
      performance: win.performance,
      MessageChannel: FakeChannel,
      setTimeout: (fn: () => void, ms: number) => globalThis.setTimeout(fn, ms),
      clearTimeout: (h: ReturnType<typeof setTimeout>) => globalThis.clearTimeout(h),
    };
    const el = { ownerDocument: { defaultView: stubWin }, append: (node: Node): void => void container.append(node) } as unknown as HTMLElement;
    const frame = mountDocFrame(el, { document: doc, adapters: adaptersFor({ events: [] }, { focus: false, watchdogMs: 120_000, ...over }) });
    return { frame, made };
  }

  it("B7.4: DocFrame.command's handle does not retain a mount: after a destroy, or an update whose document is refused, the old iframe is collectable", async () => {
    const collected = async (r: WeakRef<object> | undefined): Promise<boolean> => {
      await collect();
      return r?.deref() === undefined;
    };
    const destroyed = weakMount(input(PLAIN), {});
    destroyed.frame.destroy();
    expect(await collected(destroyed.made[0]), 'destroyed').toBe(true);

    const refused = weakMount(input(PLAIN), {});
    const d = input(PLAIN);
    refused.frame.update({ ...d, result: { ...d.result, outcome: 'failed' } });
    expect(await collected(refused.made[0]), 'replaced by a refused document (no new mount takes the handle over)').toBe(true);
    refused.frame.destroy();
  });

  it('B4.10: while the loader stays pending, a replaced or destroyed mount is not retained: only the current mount can be reached from the verdict hook', async () => {
    const collected = async (r: WeakRef<object> | undefined): Promise<boolean> => {
      await collect();
      return r?.deref() === undefined;
    };
    // A control: with no loader pending, a destroyed mount is collectable at all in this environment.
    const control = weakMount(input(MERMAID_DOC), { mermaidDraw: 'after-ready', assets: { ...assets, mermaid: mermaidText } });
    control.frame.destroy();
    expect(await collected(control.made[0]), 'the control').toBe(true);

    const never = (): Promise<string> => new Promise<string>(() => undefined);
    const destroyed = weakMount(input(MERMAID_DOC), { ...AFTER, loadMermaid: never });
    destroyed.frame.destroy();
    expect(await collected(destroyed.made[0]), 'destroyed while the loader is pending').toBe(true);

    const bare = weakMount(input(MERMAID_DOC), { ...AFTER, loadMermaid: never });
    bare.frame.update(input(PLAIN));
    expect(await collected(bare.made[0]), 'replaced by a document without figures while the loader is pending').toBe(true);
    bare.frame.destroy();

    const many = weakMount(input(MERMAID_DOC), { ...AFTER, loadMermaid: never });
    for (let i = 0; i < 3; i += 1) many.frame.update(input(MERMAID_DOC));
    await collect();
    expect(many.made.map((r) => r.deref() === undefined), 'the replaced mounts go, the current one stays').toEqual([true, true, true, false]);
    many.frame.destroy();
    expect(await collected(many.made[3]), 'the current mount goes at destroy').toBe(true);
  });
});

describe('appearance contract, host half (spec §10 test 2): adapters.appearance, assets.fonts, DocFrame.setAppearance', () => {
  const DARK = { mode: 'dark' } as const;
  const COLOUR = { mode: 'dark', skin: { radius: '6px' }, label: 'Follows the app' };
  /** A face that passes the checks: the base64 of 'wOF2' and four zero bytes. */
  const GOOD = 'd09GMgAAAAA=';
  const OTHER = 'd09GMgAAAAAAAAAA';
  const appearanceOps = (m: Mounted): Record<string, unknown>[] => frameBound(m).filter((x): x is Record<string, unknown> => (x as { t?: unknown }).t === 'appearance');
  const seedAppearance = (srcdoc: string): unknown => seedOf(srcdoc)['appearance'];
  const lastSrcdoc = (): string => {
    const all = container.querySelectorAll('iframe');
    return (all[all.length - 1] as HTMLIFrameElement).getAttribute('srcdoc') ?? '';
  };

  it('an unknown adapter key still throws, and appearance is accepted and seeded as its verdict', () => {
    expect(() => mountDocFrame(container, { document: input(PLAIN), adapters: adaptersFor({ events: [] }, ({ skin: {} } as never)) })).toThrow(TypeError);
    const m = mount(PLAIN, { appearance: DARK });
    expect(m.fallbacks()).toEqual([]);
    expect(seedAppearance(m.iframe.getAttribute('srcdoc') ?? '')).toEqual({ mode: 'dark' });
  });

  it('adapters.appearance that is not a plain object throws TypeError at step 1, before any iframe; a plain object with bad slots never throws', () => {
    const create = vi.spyOn(document, 'createElement');
    try {
      for (const bad of [null, 'dark', 7, [], new Map(), Object.create({ mode: 'dark' }) as object, () => 1]) {
        expect(() => mountDocFrame(container, { document: input(PLAIN), adapters: adaptersFor({ events: [] }, { appearance: bad }) }), String(bad)).toThrow(TypeError);
      }
      expect(create.mock.calls.filter(([t]) => t === 'iframe')).toEqual([]);
    } finally {
      create.mockRestore();
    }
    expect(iframes()).toBe(0);
    const m = mount(PLAIN, { appearance: { mode: 'neon', colour: { bg: 'red' }, skin: { nope: '1px' }, extra: 1 } });
    expect(m.fallbacks()).toEqual([]);
    expect(seedAppearance(m.iframe.getAttribute('srcdoc') ?? '')).toEqual({ mode: 'auto' });
  });

  it('setAppearance before ready queues and posts nothing; after ready it posts exactly one op, with the keys t, v, appearance', async () => {
    const m = mount();
    await m.loaded();
    m.frame.setAppearance(COLOUR as never);
    expect(frameBound(m)).toEqual([]);
    m.say({ t: 'ready', v: 1, nonce: m.nonce });
    expect(frameBound(m)).toEqual([{ t: 'appearance', v: 1, appearance: COLOUR }]);
    m.frame.setAppearance({ mode: 'light' });
    const ops = appearanceOps(m);
    expect(ops).toHaveLength(2);
    expect(ops[1]).toEqual({ t: 'appearance', v: 1, appearance: { mode: 'light' } });
    for (const op of ops) {
      expect(Object.keys(op).sort()).toEqual(['appearance', 't', 'v']);
      expect(Object.keys(op['appearance'] as object).every((k) => ['mode', 'colour', 'skin', 'label'].includes(k))).toBe(true);
    }
  });


  it('latest wins before ready (valid ready): one op, the later value, after the queued prefs', async () => {
    const m = mount();
    await m.loaded();
    m.frame.setAppearance({ mode: 'dark' });
    m.frame.setPrefs({ width: 'wide' });
    m.frame.setAppearance({ mode: 'light', label: 'x' });
    expect(frameBound(m)).toEqual([]);
    m.say({ t: 'ready', v: 1, nonce: m.nonce });
    expect(frameBound(m)).toEqual([
      { t: 'prefs', width: 'wide' },
      { t: 'appearance', v: 1, appearance: { mode: 'light', label: 'x' } },
    ]);
  });

  it('the verdict, not the raw value, is posted and seeded: an unknown key and a bad colour are gone', async () => {
    const raw = { mode: 'dark', colour: { bg: 'red' }, skin: { radius: '6px', nope: '1px' }, label: 'L', extra: 1 };
    const m = mount();
    await m.loaded();
    m.say({ t: 'ready', v: 1, nonce: m.nonce });
    m.frame.setAppearance(raw as never);
    const [op] = appearanceOps(m);
    const value = (op as { appearance: Record<string, unknown> }).appearance;
    expect(value).toEqual({ mode: 'dark', skin: { radius: '6px' }, label: 'L' });
    expect(Object.keys(value)).not.toContain('extra');
    expect(Object.keys(value)).not.toContain('colour');
    m.frame.update(input(PLAIN));
    expect(seedAppearance(lastSrcdoc())).toEqual(value);
  });

  it('setAppearance with a value that is not a plain object throws TypeError whatever the state', async () => {
    const m = mount();
    for (const bad of [null, 'dark', 1, [], Object.create({}) as object, new Map()]) expect(() => m.frame.setAppearance(bad as never)).toThrow(TypeError);
    await m.loaded();
    m.say({ t: 'ready', v: 1, nonce: m.nonce });
    expect(() => m.frame.setAppearance(null as never)).toThrow(TypeError);
    expect(appearanceOps(m)).toEqual([]);
    m.frame.destroy();
    expect(() => m.frame.setAppearance(null as never)).toThrow(TypeError);
    expect(() => m.frame.setAppearance(5 as never)).toThrow(TypeError);
  });

  it('update() seeds the latest appearance, from the adapters or from setAppearance, and a remount is its own mount', async () => {
    const m = mount(PLAIN, { appearance: { mode: 'dark' } });
    m.frame.update(input(PLAIN));
    expect(seedAppearance(lastSrcdoc())).toEqual({ mode: 'dark' });
    m.frame.setAppearance({ mode: 'light' });
    m.frame.setAppearance({ mode: 'dark', label: 'second' });
    m.frame.update(input(PLAIN));
    expect(seedAppearance(lastSrcdoc())).toEqual({ mode: 'dark', label: 'second' });
    const fresh = channels[channels.length - 1] as FakeChannel;
    expect(fresh.port1.sent).toEqual([]);
  });

  it('a mount without any appearance seeds none and sets no key', () => {
    const m = mount();
    expect(Object.keys(seedOf(m.iframe.getAttribute('srcdoc') ?? ''))).not.toContain('appearance');
    m.frame.setAppearance({ mode: 'dark' });
    m.frame.update(input(PLAIN));
    expect(seedAppearance(lastSrcdoc())).toEqual({ mode: 'dark' });
  });

  it('after destroy() and after a fallback setAppearance does nothing and never throws for a plain object', async () => {
    const m = await ready();
    m.frame.destroy();
    expect(() => m.frame.setAppearance({ mode: 'dark' })).not.toThrow();
    expect(appearanceOps(m)).toEqual([]);
    const f = mount();
    await f.loaded();
    f.say({ t: 'ready', v: 1, nonce: 'wrong' });
    expect(f.fallbacks()).toEqual(['nonce']);
    expect(() => f.frame.setAppearance({ mode: 'dark' })).not.toThrow();
    expect(frameBound(f)).toEqual([]);
  });

  it('a bad face is dropped and the srcdoc carries only the good one; the mount continues', () => {
    const m = mount(PLAIN, { assets: { ...assets, fonts: { sans: 'not base64!', mono: GOOD } } });
    expect(m.fallbacks()).toEqual([]);
    expect(seedOf(m.iframe.getAttribute('srcdoc') ?? '')['fonts']).toEqual({ mono: GOOD });
    const n = mount(PLAIN, { assets: { ...assets, fonts: { sans: 'AAAA' } } });
    expect(n.fallbacks()).toEqual([]);
    expect(Object.keys(seedOf(n.iframe.getAttribute('srcdoc') ?? ''))).not.toContain('fonts');
  });

  it('a malformed fonts throws TypeError at mount time, before any iframe, and is no fallback', () => {
    const create = vi.spyOn(document, 'createElement');
    const seen: Seen = { events: [] };
    try {
      const getter = Object.defineProperty({}, 'sans', { get: () => GOOD, enumerable: true });
      for (const fonts of [null, 'x', [], { serif: GOOD }, { sans: 5 }, { mono: {} }, getter]) {
        expect(() => mountDocFrame(container, { document: input(PLAIN), adapters: adaptersFor(seen, { assets: { ...assets, fonts } }) }), JSON.stringify(fonts)).toThrow(TypeError);
      }
      expect(create.mock.calls.filter(([t]) => t === 'iframe')).toEqual([]);
    } finally {
      create.mockRestore();
    }
    expect(seen.events).toEqual([]);
    expect(iframes()).toBe(0);
  });

  it('a getter on assets.fonts throws TypeError and is never called', () => {
    const get = vi.fn(() => ({ sans: GOOD }));
    const assetsWith = Object.defineProperty({ ...assets }, 'fonts', { get, enumerable: true });
    expect(() => mountDocFrame(container, { document: input(PLAIN), adapters: adaptersFor({ events: [] }, { assets: assetsWith }) })).toThrow(TypeError);
    expect(get).not.toHaveBeenCalled();
    expect(iframes()).toBe(0);
  });

  it('a non-plain assets: an own malformed fonts throws, an inherited one is absent and does not fall back', () => {
    class Holder {}
    const bad = Object.assign(new Holder(), assets, { fonts: 'x' });
    expect(() => mountDocFrame(container, { document: input(PLAIN), adapters: adaptersFor({ events: [] }, { assets: bad }) })).toThrow(TypeError);
    const inherited = Object.assign(Object.create({ fonts: 'x' }) as object, assets);
    const m = mount(PLAIN, { assets: inherited });
    expect(m.fallbacks()).toEqual([]);
    expect(Object.keys(seedOf(m.iframe.getAttribute('srcdoc') ?? ''))).not.toContain('fonts');
  });

  it('mutating assets.fonts after mount does not change a later update(): no fallback, the checked faces are seeded', () => {
    const live = { ...assets, fonts: { sans: GOOD } } as Record<string, unknown>;
    const m = mount(PLAIN, { assets: live });
    live['fonts'] = 'x';
    // The shared `assets` carries no `fonts` of its own for the rows that spread it after this one.
    delete (assets as unknown as Record<string, unknown>)['fonts'];
    m.frame.update(input(PLAIN));
    expect(m.fallbacks()).toEqual([]);
    expect(seedOf(lastSrcdoc())['fonts']).toEqual({ sans: GOOD });
  });

  // Second review F7: the pass-through guard of assetsOf. A host that gives no `fonts` reaches frameDocument as itself, so
  // its identity, `this`, `has` and `ownKeys` are 1.1.0's. frameDocument only reads by plain `get`, so what tells the guard
  // from the wrapper Proxy is the identity of the object it is given, and the host's own `get` trap seeing the `fonts` read.
  it('F7: a host that gives no fonts is handed to frameDocument as itself, at mount and at every update(); one that gives fonts is not', () => {
    const live = { ...assets } as Record<string, unknown>;
    const m = mount(PLAIN, { assets: live });
    expect(stub.assets.length).toBe(1);
    expect(stub.assets[0] === live).toBe(true);
    m.frame.update(input(PLAIN));
    expect(stub.assets.length).toBe(2);
    expect(stub.assets[1] === live).toBe(true);
    // An inherited `fonts` is hidden from frameDocument, so the host is wrapped then, as it is for an own one.
    const inherited = Object.assign(Object.create({ fonts: { sans: GOOD } }) as object, assets);
    mount(PLAIN, { assets: inherited });
    expect(stub.assets[2] === inherited).toBe(false);
    const given = { ...assets, fonts: { sans: GOOD } };
    mount(PLAIN, { assets: given });
    expect(stub.assets[3] === given).toBe(false);
  });

  it('F7: frameDocument reads `fonts` from the host itself when it gives none (a get trap on the host sees it)', () => {
    // A wrapper answers `fonts` by itself and never forwards it, so the host's own get trap sees that read only when the
    // host is handed on as it is.
    const hits: string[] = [];
    const spy = new Proxy({ ...assets }, { get: (t, k, r) => { hits.push(String(k)); return Reflect.get(t, k, r); } });
    const m = mount(PLAIN, { assets: spy });
    expect(m.fallbacks()).toEqual([]);
    expect(hits).toContain('fonts');
    expect(hits).toContain('guard');
  });

  // Second review F6: `fonts` is read and checked at mount when the host gives it then; a host that gave none keeps a live
  // object, and each later mount reads it again, so a `fonts` it adds meets the same check, with the same TypeError,
  // thrown by update() before anything is torn down.
  it('F6: a malformed fonts added after a mount without one is a TypeError at update(), before teardown, never a fallback', () => {
    for (const fonts of [null, 'x', [], { serif: GOOD }, { sans: 5 }, { mono: {} }, Object.defineProperty({}, 'sans', { get: () => GOOD, enumerable: true })]) {
      const live = { ...assets } as Record<string, unknown>;
      const m = mount(PLAIN, { assets: live });
      const before = iframes();
      live['fonts'] = fonts;
      expect(() => m.frame.update(input(PLAIN)), JSON.stringify(fonts)).toThrow(TypeError);
      // Nothing was torn down and nothing fell back: the old mount stays, and a later good update() works.
      expect(iframes()).toBe(before);
      expect(m.fallbacks()).toEqual([]);
      delete live['fonts'];
      m.frame.update(input(PLAIN));
      expect(m.fallbacks()).toEqual([]);
      expect(iframes()).toBe(before);
      m.frame.destroy();
    }
  });

  it('F6: a getter added on assets.fonts after mount is a TypeError at update() and is never called', () => {
    const live = { ...assets } as Record<string, unknown>;
    const m = mount(PLAIN, { assets: live });
    const get = vi.fn(() => ({ sans: GOOD }));
    Object.defineProperty(live, 'fonts', { get, enumerable: true, configurable: true });
    expect(() => m.frame.update(input(PLAIN))).toThrow(TypeError);
    expect(get).not.toHaveBeenCalled();
    expect(m.fallbacks()).toEqual([]);
  });

  it('F6: good fonts added after a mount without any are seeded by update()', () => {
    const live = { ...assets } as Record<string, unknown>;
    const m = mount(PLAIN, { assets: live });
    expect(Object.keys(seedOf(m.iframe.getAttribute('srcdoc') ?? ''))).not.toContain('fonts');
    live['fonts'] = { sans: GOOD };
    m.frame.update(input(PLAIN));
    expect(m.fallbacks()).toEqual([]);
    expect(seedOf(lastSrcdoc())['fonts']).toEqual({ sans: GOOD });
  });

  it('F6: an own fonts holding undefined at mount is none: a later bad one is a TypeError at update(), a later good one is seeded', () => {
    const live = { ...assets, fonts: undefined } as Record<string, unknown>;
    const m = mount(PLAIN, { assets: live });
    live['fonts'] = 'x';
    expect(() => m.frame.update(input(PLAIN))).toThrow(TypeError);
    live['fonts'] = { mono: GOOD };
    m.frame.update(input(PLAIN));
    expect(m.fallbacks()).toEqual([]);
    expect(seedOf(lastSrcdoc())['fonts']).toEqual({ mono: GOOD });
  });

  // Review 2906 F3: only `fonts` is read at mount; every other asset stays live, as in 1.1.0 (a host that passes no new key
  // gets today's behaviour).
  it('F3: an assets object whose guard, bootstrap, enhance and css are inherited (a class instance, Object.create) mounts', () => {
    class Bundle {}
    Object.assign(Bundle.prototype, { guard: assets.guard, bootstrap: assets.bootstrap, enhance: assets.enhance, css: assets.css });
    const m = mount(PLAIN, { assets: new Bundle() });
    expect(m.fallbacks()).toEqual([]);
    expect(iframes()).toBe(1);
    const based = mount(PLAIN, { assets: Object.create({ ...assets }) as object });
    expect(based.fallbacks()).toEqual([]);
    expect(iframes()).toBe(2);
  });

  it('F3: a class whose getters read #private fields mounts, with no fonts and with fonts (the getters see the host as this)', () => {
    class Private {
      readonly #g = assets.guard;
      readonly #b = assets.bootstrap;
      readonly #e = assets.enhance;
      readonly #c = assets.css;
      get guard(): string {
        return this.#g;
      }
      get bootstrap(): string {
        return this.#b;
      }
      get enhance(): string {
        return this.#e;
      }
      get css(): string {
        return this.#c;
      }
    }
    const plain = mount(PLAIN, { assets: new Private() });
    expect(plain.fallbacks()).toEqual([]);
    expect(iframes()).toBe(1);
    // The host's own object is handed on itself when it gives no `fonts`; with `fonts` a Proxy answers only that key.
    const hosted = Object.defineProperty(new Private(), 'fonts', { value: { sans: GOOD }, enumerable: true });
    const m = mount(PLAIN, { assets: hosted });
    expect(m.fallbacks()).toEqual([]);
    expect(seedOf(m.iframe.getAttribute('srcdoc') ?? '')['fonts']).toEqual({ sans: GOOD });
    // A frozen host with an own non-configurable `fonts` still mounts (a Proxy over the host itself would break its invariant).
    const frozen = mount(PLAIN, { assets: Object.freeze({ ...assets, fonts: { mono: GOOD } }) });
    expect(frozen.fallbacks()).toEqual([]);
    expect(seedOf(frozen.iframe.getAttribute('srcdoc') ?? '')['fonts']).toEqual({ mono: GOOD });
  });

  it('F3: assets.mermaid filled after mount is seen by the next update()', () => {
    const live: Record<string, unknown> = { ...assets };
    const m = mount(PLAIN, { assets: live });
    live['mermaid'] = mermaidText;
    m.frame.update(input(MERMAID_DOC));
    expect(m.fallbacks()).toEqual([]);
    expect(lastSrcdoc()).toContain(mermaidText);
  });

  it("F3: a Proxy assets whose get trap throws reaches onFallback, as in 1.1.0, and mountDocFrame does not throw", () => {
    // Every trap throws: 1.1.0 never touched the object before frameDocument's own reads, whose throw is a fallback
    // ('invalid-input': not a FrameError); a snapshot at mount would throw out of mountDocFrame instead.
    const trap = (): never => {
      throw new Error('boom');
    };
    const boom = new Proxy({ ...assets }, { get: trap, ownKeys: trap, getOwnPropertyDescriptor: trap, has: trap });
    const seen: Seen = { events: [] };
    expect(() => mountDocFrame(container, { document: input(PLAIN), adapters: adaptersFor(seen, { assets: boom }) })).not.toThrow();
    expect(seen.events).toEqual([['fallback', 'invalid-input']]);
    expect(iframes()).toBe(0);
  });

  it('setAppearance and setPrefs made inside onReady are posted after the values queued before ready, and win; the next update() seeds the new one', async () => {
    let frame: DocFrame | undefined;
    const m = mount(PLAIN, { onReady: () => {
      frame?.setAppearance({ mode: 'light', label: 'NEW' });
      frame?.setPrefs({ width: 'wide' });
    } });
    frame = m.frame;
    await m.loaded();
    m.frame.setAppearance({ mode: 'dark', label: 'OLD' });
    m.frame.setPrefs({ width: 'standard' });
    m.say({ t: 'ready', v: 1, nonce: m.nonce });
    expect(frameBound(m)).toEqual([
      { t: 'prefs', width: 'standard' },
      { t: 'appearance', v: 1, appearance: { mode: 'dark', label: 'OLD' } },
      { t: 'appearance', v: 1, appearance: { mode: 'light', label: 'NEW' } },
      { t: 'prefs', width: 'wide' },
    ]);
    m.frame.update(input(PLAIN));
    expect(seedAppearance(lastSrcdoc())).toEqual({ mode: 'light', label: 'NEW' });
  });

  it('a Proxy whose own trap throws gives a TypeError, never its own throw (adapters.appearance and setAppearance)', () => {
    const boom = (): never => {
      throw new Error('trap');
    };
    const trapped = new Proxy({}, { getPrototypeOf: boom });
    expect(() => mountDocFrame(container, { document: input(PLAIN), adapters: adaptersFor({ events: [] }, { appearance: trapped }) })).toThrow(TypeError);
    const m = mount();
    expect(() => m.frame.setAppearance(trapped as never)).toThrow(TypeError);
  });

  it('a getter on adapters.appearance throws TypeError unread; a null-prototype appearance is accepted; a Proxy whose ownKeys throws seeds {mode:auto}', () => {
    const get = vi.fn(() => ({ mode: 'dark' }));
    const adapters = Object.defineProperty({ ...adaptersFor({ events: [] }) } as Record<string, unknown>, 'appearance', { get, enumerable: true });
    expect(() => mountDocFrame(container, { document: input(PLAIN), adapters: adapters as never })).toThrow(TypeError);
    expect(get).not.toHaveBeenCalled();
    const bare = Object.assign(Object.create(null) as object, { mode: 'dark' });
    expect(seedAppearance(mount(PLAIN, { appearance: bare }).iframe.getAttribute('srcdoc') ?? '')).toEqual({ mode: 'dark' });
    const boom = new Proxy({}, { ownKeys: () => { throw new Error('trap'); } });
    const m = mount(PLAIN, { appearance: boom });
    expect(m.fallbacks()).toEqual([]);
    expect(seedAppearance(m.iframe.getAttribute('srcdoc') ?? '')).toEqual({ mode: 'auto' });
  });

  it('after a fallback setAppearance posts nothing but seeds a later update()', async () => {
    const m = mount();
    await m.loaded();
    m.say({ t: 'ready', v: 1, nonce: 'wrong' });
    m.frame.setAppearance({ mode: 'dark' });
    expect(frameBound(m)).toEqual([]);
    m.frame.update(input(PLAIN));
    expect(seedAppearance(lastSrcdoc())).toEqual({ mode: 'dark' });
  });

  it("test 9: the srcdoc's CSP meta and the iframe's csp attribute of a mount with an appearance and both faces equal those of the same mount without them", () => {
    const plain = mount();
    const hosted = mount(PLAIN, { appearance: COLOUR, assets: { ...assets, fonts: { sans: GOOD, mono: OTHER } } });
    const meta = (srcdoc: string): string => /^<meta http-equiv="Content-Security-Policy" content="([^"]*)">/.exec(srcdoc)?.[1] ?? '';
    const plainDoc = plain.iframe.getAttribute('srcdoc') ?? '';
    const hostedDoc = hosted.iframe.getAttribute('srcdoc') ?? '';
    expect(seedOf(hostedDoc)['fonts']).toEqual({ sans: GOOD, mono: OTHER });
    expect(meta(hostedDoc)).not.toBe('');
    expect(meta(hostedDoc)).toBe(meta(plainDoc));
    expect(hosted.iframe.getAttribute('csp')).toBe(plain.iframe.getAttribute('csp'));
    expect(hosted.iframe.getAttribute('csp')).toBe(frameCsp());
  });
});

// ───────── docserver parity T2: places, goto, close-overlay and print figures ─────────

describe('docserver parity T2: the adapters, the seed and the three commands', () => {
  const TOKEN = '{"line":null,"offset":0,"y":0}';
  /** `n` zero bytes as canonical base64 text. */
  const zeros = (bytes: number): string => 'AAAA'.repeat(Math.floor(bytes / 3)) + (bytes % 3 === 0 ? '' : bytes % 3 === 1 ? 'AA==' : 'AAA=');
  /** A PNG-shaped text of `bytes` (at least 9) decoded bytes: the signature, a zero, then zeros. */
  const pngOf = (bytes: number): string => zeros(bytes - 9).replace(/^/, 'iVBORw0KGgoA');
  const PNG = 'iVBORw0KGgo=';
  const fig = (i: number, n: number, png: string = PNG): unknown => ({ t: 'print-figure', i: String(i), n: String(n), png });

  /** What the adapters of one row saw, with the arguments kept as given. */
  interface Calls {
    readonly hash: unknown[][];
    readonly place: unknown[];
    readonly figures: unknown[];
  }
  function calls(): { readonly c: Calls; readonly over: Partial<Record<keyof HostAdapters, unknown>> } {
    const c: Calls = { hash: [], place: [], figures: [] };
    return {
      c,
      over: {
        onHash: (...args: unknown[]) => c.hash.push(args),
        onPlace: (k: unknown) => c.place.push(k),
        onPrintFigure: (f: unknown) => c.figures.push(f),
      },
    };
  }
  const bridgeOf = (m: Mounted): Record<string, unknown> => seedOf(m.iframe.getAttribute('srcdoc') ?? '')['bridge'] as Record<string, unknown>;
  const readyFake = (over: Partial<Record<keyof HostAdapters, unknown>>): Mounted => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
    const m = mount(PLAIN, over);
    m.say({ t: 'ready', v: 1, nonce: m.nonce });
    return m;
  };

  describe('the seed', () => {
    it('a 1.1-shaped host (neither new adapter) seeds both switches false, and its onHash is called with one argument', async () => {
      const { c } = calls();
      const m = await ready(PLAIN, { onHash: (...a: unknown[]) => c.hash.push(a) });
      expect(bridgeOf(m)).toMatchObject({ hash: true, places: false, printFigures: false });
      m.say({ t: 'hash', id: 'title' });
      expect(c.hash).toEqual([['title']]);
      expect(c.hash[0]).toHaveLength(1);
    });

    it('onPlace switches places on and by itself; onPrintFigure switches printFigures on and by itself; both together', () => {
      const place = mount(PLAIN, { onPlace: () => undefined });
      expect(bridgeOf(place)).toMatchObject({ places: true, printFigures: false });
      const fig_ = mount(PLAIN, { onPrintFigure: () => undefined });
      expect(bridgeOf(fig_)).toMatchObject({ places: false, printFigures: true });
      const both = mount(PLAIN, { onPlace: () => undefined, onPrintFigure: () => undefined });
      expect(bridgeOf(both)).toMatchObject({ places: true, printFigures: true });
    });

    it('both are known adapter keys and must be functions when given', () => {
      for (const k of ['onPlace', 'onPrintFigure']) {
        expect(() => mount(PLAIN, { [k]: 'x' }), k).toThrow(new RegExp(`adapters\\.${k} must be a function`));
        expect(() => mount(PLAIN, { [k]: undefined }), k).not.toThrow();
      }
    });

    it('an update() keeps the switches', () => {
      const m = mount(PLAIN, { onPlace: () => undefined, onPrintFigure: () => undefined });
      m.frame.update(input(PLAIN));
      const fresh = container.querySelector('iframe') as HTMLIFrameElement;
      expect(seedOf(fresh.getAttribute('srcdoc') ?? '')['bridge']).toMatchObject({ places: true, printFigures: true });
    });
  });

  describe('place and the hash entry', () => {
    it('each place kind reaches onPlace, as the one argument, as a method of the adapters', async () => {
      const seenKinds: [unknown, boolean][] = [];
      const m = await ready(PLAIN, { onPlace(this: unknown, k: unknown) { seenKinds.push([k, this !== undefined]); } });
      m.say({ t: 'place', kind: 'overlay' });
      m.say({ t: 'place', kind: 'overlay-closed' });
      expect(seenKinds).toEqual([['overlay', true], ['overlay-closed', true]]);
      expect(m.fallbacks()).toEqual([]);
    });

    it('a kind outside the list is refused and never handed on; sixteen refusals close the frame', async () => {
      const { c, over } = calls();
      const m = await ready(PLAIN, over);
      for (const kind of ['tab', 'Overlay', '', 1]) m.say({ t: 'place', kind });
      expect(c.place).toEqual([]);
      for (let i = 0; i < 11; i += 1) m.say({ t: 'place', kind: 'x' });
      expect(m.fallbacks()).toEqual([]);
      m.say({ t: 'place', kind: 'x' });
      expect(m.fallbacks()).toEqual(['refusals']);
    });

    it('a place sent to a host with no onPlace is refused and counted, never handed on (a frame that was not asked)', async () => {
      const { c } = calls();
      const m = await ready(PLAIN, { onPrintFigure: (f: unknown) => c.figures.push(f) });
      for (let i = 0; i < 15; i += 1) m.say({ t: 'place', kind: 'overlay' });
      expect(m.fallbacks()).toEqual([]);
      m.say({ t: 'place', kind: 'overlay' });
      expect(m.fallbacks()).toEqual(['refusals']);
      expect(c.place).toEqual([]);
    });

    it('under onPlace, onHash gets a second argument: push is true only for the literal, from is the token or null', async () => {
      const { c, over } = calls();
      const m = await ready(PLAIN, over);
      m.say({ t: 'hash', id: 'title' });
      m.say({ t: 'hash', id: 'title', push: 'true' });
      m.say({ t: 'hash', id: 'title', from: TOKEN });
      m.say({ t: 'hash', id: 'title', push: 'true', from: TOKEN });
      expect(c.hash).toEqual([
        ['title', { push: false, from: null }],
        ['title', { push: true, from: null }],
        ['title', { push: false, from: TOKEN }],
        ['title', { push: true, from: TOKEN }],
      ]);
    });

    it('the { push, from } entry and the { i, n, png } figure handed to a host adapter are frozen, as ./enhance\'s are (final review M7)', async () => {
      const { c, over } = calls();
      const m = await ready(PLAIN, over);
      m.say({ t: 'hash', id: 'title', push: 'true', from: TOKEN });
      m.frame.printFigures();
      m.say(fig(0, 1));
      expect(Object.isFrozen(c.hash[0]?.[1])).toBe(true);
      expect(Object.isFrozen(c.figures[0])).toBe(true);
    });

    it('a push or a from that is not valid is refused, never handed on', async () => {
      const { c, over } = calls();
      const m = await ready(PLAIN, over);
      for (const extra of [{ push: 'false' }, { push: true }, { from: 'x' }, { from: 'x'.repeat(4097) }]) m.say({ t: 'hash', id: 'title', ...extra });
      expect(c.hash).toEqual([]);
    });

    it('without onPlace a hash with push or from is refused and counted, and a plain hash still reaches onHash with the id alone', async () => {
      const { c } = calls();
      const m = await ready(PLAIN, { onHash: (...a: unknown[]) => c.hash.push(a) });
      m.say({ t: 'hash', id: 'title', push: 'true' });
      m.say({ t: 'hash', id: 'title', from: TOKEN });
      expect(c.hash).toEqual([]);
      m.say({ t: 'hash', id: 'title' });
      expect(c.hash).toEqual([['title']]);
      for (let i = 0; i < 13; i += 1) m.say({ t: 'hash', id: 'title', push: 'true' });
      expect(m.fallbacks()).toEqual([]);
      m.say({ t: 'hash', id: 'title', push: 'true' });
      expect(m.fallbacks()).toEqual(['refusals']);
    });
  });

  describe('DocFrame.command is the four tools only', () => {
    it('goto, close-overlay and print-figures throw a TypeError whose message lists the four, whatever the state, and post nothing', async () => {
      const m = await ready(PLAIN, calls().over);
      for (const name of ['goto', 'close-overlay', 'print-figures']) {
        expect(() => m.frame.command(name as never), name).toThrow(TypeError);
        expect(() => m.frame.command(name as never), name).toThrow(/jump, settings, contents, outline$/);
      }
      expect(frameBound(m)).toEqual([]);
      m.frame.destroy();
      expect(() => m.frame.command('goto' as never)).toThrow(TypeError);
    });
  });

  describe('closeOverlay()', () => {
    it('posts exactly {t:"command", name:"close-overlay"} once ready, and moves no focus', async () => {
      const m = await ready(PLAIN, calls().over);
      const other = document.createElement('button');
      document.body.append(other);
      other.focus();
      m.frame.closeOverlay();
      expect(frameBound(m)).toEqual([{ t: 'command', name: 'close-overlay' }]);
      expect(Object.keys(frameBound(m)[0] as object)).toEqual(['t', 'name']);
      expect(document.activeElement === other, 'the focus stays where it was').toBe(true);
    });

    it('does nothing before ready (and is not queued), after destroy() and after a fallback', async () => {
      const m = mount(PLAIN, calls().over);
      await m.loaded();
      m.frame.closeOverlay();
      m.say({ t: 'ready', v: 1, nonce: m.nonce });
      expect(frameBound(m)).toEqual([]);
      m.say({ t: 'error', why: 'render' });
      m.frame.closeOverlay();
      expect(frameBound(m)).toEqual([]);
      const d = await ready(PLAIN, calls().over);
      d.frame.destroy();
      d.frame.closeOverlay();
      expect(frameBound(d)).toEqual([]);
    });

    it('after update() the new mount is not ready: nothing is posted to either port until its own ready', async () => {
      const m = await ready(PLAIN, calls().over);
      m.frame.update(input(PLAIN));
      const fresh = channels[channels.length - 1] as FakeChannel;
      m.frame.closeOverlay();
      expect(m.channel.port1.sent).toEqual([]);
      expect(fresh.port1.sent).toEqual([]);
      const nonce = NONCE_RE.exec((container.querySelector('iframe') as HTMLIFrameElement).getAttribute('srcdoc') ?? '')?.[1] ?? '';
      fresh.port1.onmessage?.({ data: { t: 'ready', v: 1, nonce }, ports: [] });
      m.frame.closeOverlay();
      expect(fresh.port1.sent).toEqual([{ t: 'command', name: 'close-overlay' }]);
    });

    it('a host with no onPlace gets a TypeError, before ready, after ready and after destroy()', async () => {
      const m = mount(PLAIN);
      expect(() => m.frame.closeOverlay()).toThrow(TypeError);
      m.say({ t: 'ready', v: 1, nonce: m.nonce });
      expect(() => m.frame.closeOverlay()).toThrow(/onPlace/);
      m.frame.destroy();
      expect(() => m.frame.closeOverlay()).toThrow(TypeError);
      expect(frameBound(m)).toEqual([]);
    });
  });

  describe('goto(id, from?)', () => {
    it('posts {t, name, id} or {t, name, id, from} once ready, with exactly those keys and no focus moved', async () => {
      const m = await ready(PLAIN, calls().over);
      const other = document.createElement('button');
      document.body.append(other);
      other.focus();
      m.frame.goto('heading-two');
      m.frame.goto('fnref1:1', TOKEN);
      expect(frameBound(m)).toEqual([
        { t: 'command', name: 'goto', id: 'heading-two' },
        { t: 'command', name: 'goto', id: 'fnref1:1', from: TOKEN },
      ]);
      expect(Object.keys(frameBound(m)[0] as object)).toEqual(['t', 'name', 'id']);
      expect(document.activeElement === other).toBe(true);
    });

    it('an id outside the fragment grammar, or a from that is no token, throws a TypeError in every state and posts nothing', async () => {
      const live = await ready(PLAIN, calls().over);
      const early = mount(PLAIN, calls().over);
      const gone = await ready(PLAIN, calls().over);
      gone.frame.destroy();
      for (const m of [live, early, gone]) {
        for (const id of ['', 'a b', '#a', 'a[b]', 'x'.repeat(257), 1, null, undefined, {}]) expect(() => m.frame.goto(id as never), String(id)).toThrow(TypeError);
        for (const from of ['x', '', '{}', '{"line":null,"offset":0,"y":-1}', 'x'.repeat(4097), 1, null, {}]) {
          expect(() => m.frame.goto('title', from as never), String(from)).toThrow(TypeError);
        }
        expect(frameBound(m)).toEqual([]);
      }
      expect(() => live.frame.goto('x'.repeat(256))).not.toThrow();
    });

    it('does nothing before ready (not queued), after destroy() and after a fallback; a host with no onPlace gets a TypeError', async () => {
      const m = mount(PLAIN, calls().over);
      await m.loaded();
      m.frame.goto('title');
      m.say({ t: 'ready', v: 1, nonce: m.nonce });
      expect(frameBound(m)).toEqual([]);
      m.say({ t: 'error', why: 'render' });
      m.frame.goto('title');
      expect(frameBound(m)).toEqual([]);
      const d = await ready(PLAIN, calls().over);
      d.frame.destroy();
      d.frame.goto('title');
      expect(frameBound(d)).toEqual([]);
      const none = await ready();
      expect(() => none.frame.goto('title')).toThrow(/onPlace/);
      expect(frameBound(none)).toEqual([]);
    });
  });

  describe('printFigures() and the run', () => {
    it('needs onPrintFigure: a TypeError in every state, and nothing posted', async () => {
      const m = mount(PLAIN, { onPlace: () => undefined });
      expect(() => m.frame.printFigures()).toThrow(/onPrintFigure/);
      m.say({ t: 'ready', v: 1, nonce: m.nonce });
      expect(() => m.frame.printFigures()).toThrow(TypeError);
      m.frame.destroy();
      expect(() => m.frame.printFigures()).toThrow(TypeError);
      expect(frameBound(m)).toEqual([]);
    });

    it('posts exactly {t:"command", name:"print-figures"} once ready, and moves no focus', async () => {
      const m = await ready(PLAIN, calls().over);
      const other = document.createElement('button');
      document.body.append(other);
      other.focus();
      m.frame.printFigures();
      expect(frameBound(m)).toEqual([{ t: 'command', name: 'print-figures' }]);
      expect(Object.keys(frameBound(m)[0] as object)).toEqual(['t', 'name']);
      expect(document.activeElement === other).toBe(true);
    });

    it('before ready it posts nothing, queues nothing and opens no run: a figure after ready is refused', async () => {
      const { c, over } = calls();
      const m = mount(PLAIN, over);
      await m.loaded();
      m.frame.printFigures();
      m.say({ t: 'ready', v: 1, nonce: m.nonce });
      expect(frameBound(m)).toEqual([]);
      m.say(fig(0, 1));
      expect(c.figures).toEqual([]);
    });

    it('after destroy() and after a fallback it posts nothing', async () => {
      const a = await ready(PLAIN, calls().over);
      a.frame.destroy();
      a.frame.printFigures();
      expect(frameBound(a)).toEqual([]);
      const b = await ready(PLAIN, calls().over);
      b.say({ t: 'error', why: 'render' });
      b.frame.printFigures();
      expect(frameBound(b)).toEqual([]);
    });

    it('a figure with no run is refused, never handed on, and counted (the sixteenth closes the frame)', async () => {
      const { c, over } = calls();
      const m = await ready(PLAIN, over);
      for (let i = 0; i < 15; i += 1) m.say(fig(0, 1));
      expect(m.fallbacks()).toEqual([]);
      m.say(fig(0, 1));
      expect(m.fallbacks()).toEqual(['refusals']);
      expect(c.figures).toEqual([]);
    });

    it('a figure reaches onPrintFigure as {i, n, png}: i and n numbers, the text unchanged; the run stays open after its last index', async () => {
      const { c, over } = calls();
      const m = await ready(PLAIN, over);
      m.frame.printFigures();
      m.say(fig(0, 2));
      m.say(fig(1, 2, 'iVBORw0KGgoA'));
      expect(c.figures).toEqual([{ i: 0, n: 2, png: PNG }, { i: 1, n: 2, png: 'iVBORw0KGgoA' }]);
      expect(typeof (c.figures[0] as { i: unknown }).i).toBe('number');
      // the run does not end at i = n - 1 (review I1): a figure of it is judged against the run, and a repeated index is refused
      m.say(fig(0, 2));
      expect(c.figures).toHaveLength(2);
    });

    it('the last index may come first, and the run goes on: a stale figure with i = n - 1 closes nothing (review I1)', async () => {
      const { c, over } = calls();
      const m = await ready(PLAIN, over);
      m.frame.printFigures();
      m.say(fig(24, 25));
      m.say(fig(0, 25));
      m.say(fig(1, 25));
      m.say(fig(24, 25));
      m.say(fig(2, 25));
      expect(c.figures.map((f) => (f as { i: number }).i)).toEqual([24, 0, 1, 2]);
      // a new call is what ends it: its indexes are free again
      m.frame.printFigures();
      m.say(fig(24, 25));
      expect(c.figures.map((f) => (f as { i: number }).i)).toEqual([24, 0, 1, 2, 24]);
      expect(m.fallbacks()).toEqual([]);
    });

    it('an index seen in the run, an n that changes and an index at or above n are refused and never handed on', async () => {
      const { c, over } = calls();
      const m = await ready(PLAIN, over);
      m.frame.printFigures();
      m.say(fig(0, 3));
      m.say(fig(0, 3));
      m.say(fig(1, 4));
      m.say(fig(3, 3));
      m.say(fig(1, 3));
      expect(c.figures).toEqual([{ i: 0, n: 3, png: PNG }, { i: 1, n: 3, png: PNG }]);
    });

    it('a second printFigures() call replaces the run: its indexes are free again and its n may differ', async () => {
      const { c, over } = calls();
      const m = await ready(PLAIN, over);
      m.frame.printFigures();
      m.say(fig(0, 3));
      m.frame.printFigures();
      m.say(fig(0, 5));
      expect(c.figures).toEqual([{ i: 0, n: 3, png: PNG }, { i: 0, n: 5, png: PNG }]);
      expect(frameBound(m)).toEqual([{ t: 'command', name: 'print-figures' }, { t: 'command', name: 'print-figures' }]);
    });

    describe('a reopened run: printFigures() while the previous run is unfinished (review 3081 F2)', () => {
      const sizeOf = (f: unknown): number => (f as { png: string }).png.length;

      it('the first repeat of an index replaces the earlier copy: handed on again, no refusal counted; a second repeat is refused and counted', async () => {
        const { c, over } = calls();
        const m = await ready(PLAIN, over);
        m.frame.printFigures();
        m.say(fig(0, 3));
        // the previous run is unfinished (one of three): the next run is reopened
        m.frame.printFigures();
        m.say(fig(0, 3));
        m.say(fig(0, 3, pngOf(100)));
        expect(c.figures).toHaveLength(3);
        expect(sizeOf(c.figures[2])).toBe(pngOf(100).length);
        // the second repeat of 0 is refused and never handed on; with it, fifteen refusals leave the frame open and the sixteenth closes it,
        // so the replacement above counted none
        for (let k = 0; k < 15; k += 1) m.say(fig(0, 3));
        expect(c.figures).toHaveLength(3);
        expect(m.fallbacks()).toEqual([]);
        m.say(fig(0, 3));
        expect(m.fallbacks()).toEqual(['refusals']);
      });

      it('each index has its own one replacement: 1 replaced, 2 still replaceable', async () => {
        const { c, over } = calls();
        const m = await ready(PLAIN, over);
        m.frame.printFigures();
        m.frame.printFigures();
        m.say(fig(0, 3));
        m.say(fig(1, 3));
        m.say(fig(0, 3, pngOf(100)));
        m.say(fig(1, 3, pngOf(100)));
        m.say(fig(0, 3, pngOf(200)));
        m.say(fig(2, 3));
        m.say(fig(2, 3, pngOf(100)));
        expect(c.figures.map((f) => (f as { i: number }).i)).toEqual([0, 1, 0, 1, 2, 2]);
      });

      it('a previous run that received no figure at all leaves the next one reopened', async () => {
        const { c, over } = calls();
        const m = await ready(PLAIN, over);
        m.frame.printFigures();
        m.frame.printFigures();
        m.say(fig(0, 2));
        m.say(fig(0, 2, pngOf(100)));
        expect(c.figures).toHaveLength(2);
      });

      it('a previous run that was complete leaves the next one ordinary: a repeat is refused and counted', async () => {
        const { c, over } = calls();
        const m = await ready(PLAIN, over);
        m.frame.printFigures();
        m.say(fig(0, 2));
        m.say(fig(1, 2));
        m.frame.printFigures();
        m.say(fig(0, 2));
        m.say(fig(0, 2, pngOf(100)));
        expect(c.figures).toHaveLength(3);
        for (let k = 0; k < 14; k += 1) m.say(fig(0, 2));
        expect(m.fallbacks()).toEqual([]);
        m.say(fig(0, 2));
        expect(m.fallbacks()).toEqual(['refusals']);
      });

      it('a third call while the second run\'s own figures are still in the port: its run is reopened too, so nothing of it is refused (review 3081 F2, round 2)', async () => {
        const { c, over } = calls();
        const m = await ready(PLAIN, over);
        // call 1: the frame posted 0, 1, 2 and the host has handled only 0
        m.frame.printFigures();
        m.say(fig(0, 3));
        // call 2 reopens: the stale 1 and 2 are accepted, then run 2's own 0 (three distinct indexes, so run 2 looks complete)
        m.frame.printFigures();
        m.say(fig(1, 3));
        m.say(fig(2, 3));
        m.say(fig(0, 3));
        // call 3 arrives while run 2's own 1 and 2 are still in the port: they are accepted as first copies of run 3, and run 3's own copies replace them
        m.frame.printFigures();
        for (const i of [1, 2, 0, 1, 2]) m.say(fig(i, 3));
        expect(c.figures.map((f) => (f as { i: number }).i)).toEqual([0, 1, 2, 0, 1, 2, 0, 1, 2]);
        // nothing was refused: the sixteen third copies of index 1 (its one replacement is spent) are the whole count that closes the frame
        for (let k = 0; k < 15; k += 1) m.say(fig(1, 3));
        expect(m.fallbacks()).toEqual([]);
        m.say(fig(1, 3));
        expect(m.fallbacks()).toEqual(['refusals']);
      });

      it('the first run of a mount is ordinary: a repeat is refused and counted (unchanged)', async () => {
        const { c, over } = calls();
        const m = await ready(PLAIN, over);
        m.frame.printFigures();
        m.say(fig(0, 2));
        for (let k = 0; k < 15; k += 1) m.say(fig(0, 2, pngOf(100)));
        expect(c.figures).toHaveLength(1);
        expect(m.fallbacks()).toEqual([]);
        m.say(fig(0, 2));
        expect(m.fallbacks()).toEqual(['refusals']);
      });

      it('an n that differs from the run\'s is still refused, and a repeat of an index at or above n too', async () => {
        const { c, over } = calls();
        const m = await ready(PLAIN, over);
        m.frame.printFigures();
        m.frame.printFigures();
        m.say(fig(0, 3));
        m.say(fig(0, 4, pngOf(100)));
        m.say(fig(3, 3));
        expect(c.figures).toHaveLength(1);
      });

      it('the run total is adjusted by the replacement before the cap: a replacement is refused or passes by exactly the adjusted total', async () => {
        const { c, over } = calls();
        const m = readyFake(over);
        const say = m.say;
        m.say = (data: unknown): void => {
          say(data);
          vi.advanceTimersByTime(63);
        };
        m.frame.printFigures();
        m.frame.printFigures();
        // 15 figures of 1 MiB and two of half a MiB make exactly 16 MiB
        for (let i = 0; i < 15; i += 1) m.say(fig(i, 17, pngOf(1048576)));
        m.say(fig(15, 17, pngOf(524288)));
        m.say(fig(16, 17, pngOf(524288)));
        expect(c.figures).toHaveLength(17);
        // one byte more than the copy it replaces: 16 MiB + 1, refused, handed on to nothing, and it leaves the earlier copy replaceable
        m.say(fig(15, 17, pngOf(524289)));
        expect(c.figures).toHaveLength(17);
        // as large as the copy it replaces: the adjusted total is 16 MiB, and it passes (an unadjusted total would refuse it)
        m.say(fig(15, 17, pngOf(524288)));
        expect(c.figures).toHaveLength(18);
        // a second repeat of index 15 is refused, whatever its size
        m.say(fig(15, 17, pngOf(100)));
        expect(c.figures).toHaveLength(18);
      });

      describe('what a reopened run hands on in all is capped at twice the run total (review 3088 F1)', () => {
        const MiB = 1048576;
        /** The same size as pngOf(bytes), a different text: a byte of its zeros set. */
        const variant = (bytes: number): string => pngOf(bytes).replace(/^(.{100})A/, '$1B');
        const paced = (over: Partial<Record<keyof HostAdapters, unknown>>): Mounted => {
          const m = readyFake(over);
          const say = m.say;
          m.say = (data: unknown): void => {
            say(data);
            vi.advanceTimersByTime(63);
          };
          return m;
        };
        const handedBytes = (figures: readonly unknown[]): number => figures.reduce<number>((t, f) => t + ((f as { png: string }).png.length * 3) / 4 - ((f as { png: string }).png.match(/=*$/)?.[0].length ?? 0), 0);

        it('the honest worst case: a full earlier run of 16 MiB queued at the host, then a full new run of 16 MiB, each index replaced once, passes whole with no refusal', async () => {
          const { c, over } = calls();
          const m = paced(over);
          m.frame.printFigures();
          m.frame.printFigures();
          for (let i = 0; i < 16; i += 1) m.say(fig(i, 16, pngOf(MiB)));
          for (let i = 0; i < 16; i += 1) m.say(fig(i, 16, variant(MiB)));
          expect(c.figures).toHaveLength(32);
          expect(handedBytes(c.figures)).toBe(32 * MiB);
          // the latest copy of every index is the new run's
          const latest = new Map<number, string>();
          for (const f of c.figures as { i: number; png: string }[]) latest.set(f.i, f.png);
          expect([...latest.values()].every((png) => png === variant(MiB))).toBe(true);
          expect(latest.size).toBe(16);
          // no refusal was counted: sixteen more refusals are needed to close the frame, and fifteen leave it open
          for (let k = 0; k < 15; k += 1) m.say(fig(0, 16));
          expect(m.fallbacks()).toEqual([]);
          m.say(fig(0, 16));
          expect(m.fallbacks()).toEqual(['refusals']);
          expect(c.figures).toHaveLength(32);
        });

        it('a hostile frame stops at the cap: 1 MiB figures each replaced at once, the figure that would pass twice the run total is refused and counted, never handed on', async () => {
          const { c, over } = calls();
          const m = paced(over);
          m.frame.printFigures();
          m.frame.printFigures();
          let refusedAt = -1;
          for (let i = 0; i < 48 && refusedAt < 0; i += 1) {
            const before = c.figures.length;
            m.say(fig(i, 64, pngOf(MiB)));
            if (c.figures.length === before) refusedAt = i;
            else m.say(fig(i, 64, PNG));
          }
          // 31 pairs hand on 31 MiB and 31 small copies; the next 1 MiB would make 32 MiB and 248 bytes
          expect(refusedAt).toBe(31);
          expect(handedBytes(c.figures)).toBe(31 * MiB + 31 * 8);
          expect(handedBytes(c.figures)).toBeLessThanOrEqual(2 * 16 * MiB);
          expect(m.fallbacks()).toEqual([]);
          // it was counted: fourteen more refusals leave the frame open, the sixteenth in all closes it
          for (let k = 0; k < 14; k += 1) m.say(fig(refusedAt, 64, pngOf(MiB)));
          expect(m.fallbacks()).toEqual([]);
          m.say(fig(refusedAt, 64, pngOf(MiB)));
          expect(m.fallbacks()).toEqual(['refusals']);
          expect(handedBytes(c.figures)).toBe(31 * MiB + 31 * 8);
        });

        it('exactly twice the run total passes, and one byte more is refused', async () => {
          for (const extra of [0, 1]) {
            const { c, over } = calls();
            const m = paced(over);
            m.frame.printFigures();
            m.frame.printFigures();
            // 31 pairs (1 MiB, then 8 bytes in its place) hand on 31 MiB and 248 bytes; the live total stays small, so only the cap on what was handed decides
            for (let i = 0; i < 31; i += 1) {
              m.say(fig(i, 64, pngOf(MiB)));
              m.say(fig(i, 64, PNG));
            }
            expect(handedBytes(c.figures)).toBe(31 * MiB + 248);
            const room = 2 * 16 * MiB - handedBytes(c.figures);
            m.say(fig(31, 64, pngOf(room + extra)));
            expect(c.figures, `room + ${extra}`).toHaveLength(extra === 0 ? 63 : 62);
            expect(handedBytes(c.figures)).toBe(extra === 0 ? 2 * 16 * MiB : 31 * MiB + 248);
          }
        });

        it('each printFigures() call starts its own count: a second full reopened run hands on its 2 x 16 MiB too, with no refusal', async () => {
          const { c, over } = calls();
          const m = paced(over);
          m.frame.printFigures();
          m.frame.printFigures();
          for (let i = 0; i < 16; i += 1) m.say(fig(i, 16, pngOf(MiB)));
          for (let i = 0; i < 16; i += 1) m.say(fig(i, 16, variant(MiB)));
          m.frame.printFigures();
          for (let i = 0; i < 16; i += 1) m.say(fig(i, 16, pngOf(MiB)));
          for (let i = 0; i < 16; i += 1) m.say(fig(i, 16, variant(MiB)));
          expect(c.figures).toHaveLength(64);
          expect(handedBytes(c.figures)).toBe(64 * MiB);
          expect(m.fallbacks()).toEqual([]);
        });

        it('the run is charged before onPrintFigure is called: a press from inside that call starts a fresh count, which the figure being handed over is not charged to', async () => {
          const { c, over } = calls();
          let mounted: Mounted | null = null;
          let pressed = false;
          const record = over['onPrintFigure'] as (figure: unknown) => unknown;
          const m = paced({
            ...over,
            onPrintFigure: (figure: unknown): void => {
              record(figure);
              if (!pressed) {
                pressed = true;
                mounted?.frame.printFigures();
              }
            },
          });
          mounted = m;
          m.frame.printFigures();
          m.frame.printFigures();
          // the first figure is the old run's; the press from inside its call opens the run that follows
          m.say(fig(0, 16, pngOf(MiB)));
          // the fresh run hands on exactly its own 2 x 16 MiB: 16 figures, then a replacement of each
          for (let i = 0; i < 16; i += 1) m.say(fig(i, 16, pngOf(MiB)));
          for (let i = 0; i < 16; i += 1) m.say(fig(i, 16, variant(MiB)));
          expect(c.figures).toHaveLength(33);
          expect(handedBytes(c.figures)).toBe(33 * MiB);
          expect(m.fallbacks()).toEqual([]);
        });

        it('an ordinary run is unchanged: its live total of 16 MiB is the cap, and a repeat is refused', async () => {
          const { c, over } = calls();
          const m = paced(over);
          m.frame.printFigures();
          for (let i = 0; i < 16; i += 1) m.say(fig(i, 17, pngOf(MiB)));
          expect(handedBytes(c.figures)).toBe(16 * MiB);
          m.say(fig(16, 17, PNG));
          m.say(fig(0, 17, PNG));
          expect(c.figures).toHaveLength(16);
        });
      });

      it('a smaller replacement frees its bytes for the next figure', async () => {
        const { c, over } = calls();
        const m = readyFake(over);
        const say = m.say;
        m.say = (data: unknown): void => {
          say(data);
          vi.advanceTimersByTime(63);
        };
        m.frame.printFigures();
        m.frame.printFigures();
        for (let i = 0; i < 15; i += 1) m.say(fig(i, 17, pngOf(1048576)));
        m.say(fig(15, 17, pngOf(1048576)));
        expect(c.figures).toHaveLength(16);
        // the run is full: fig 16 does not fit; replacing index 15 by a figure of 8 bytes frees 1 MiB - 8 for it
        m.say(fig(16, 17, pngOf(524288)));
        expect(c.figures).toHaveLength(16);
        m.say(fig(15, 17, PNG));
        expect(c.figures).toHaveLength(17);
        m.say(fig(16, 17, pngOf(524288)));
        expect(c.figures).toHaveLength(18);
      });
    });

    it('the run belongs to its mount: after update() a figure with no new call is refused', async () => {
      const { c, over } = calls();
      const m = await ready(PLAIN, over);
      m.frame.printFigures();
      m.frame.update(input(PLAIN));
      const fresh = channels[channels.length - 1] as FakeChannel;
      const nonce = NONCE_RE.exec((container.querySelector('iframe') as HTMLIFrameElement).getAttribute('srcdoc') ?? '')?.[1] ?? '';
      fresh.port1.onmessage?.({ data: { t: 'ready', v: 1, nonce }, ports: [] });
      fresh.port1.onmessage?.({ data: fig(0, 2), ports: [] });
      expect(c.figures).toEqual([]);
      m.frame.printFigures();
      fresh.port1.onmessage?.({ data: fig(0, 2), ports: [] });
      expect(c.figures).toEqual([{ i: 0, n: 2, png: PNG }]);
    });

    it('a host that calls printFigures() from onPrintFigure opens a fresh run, even from its last figure', async () => {
      const seenFigures: unknown[] = [];
      let m!: Mounted;
      m = await ready(PLAIN, { onPrintFigure: (f: unknown) => { seenFigures.push(f); if (seenFigures.length === 1) m.frame.printFigures(); } });
      m.frame.printFigures();
      m.say(fig(0, 1));
      m.say(fig(0, 1));
      expect(seenFigures).toHaveLength(2);
    });

    it('1048575 and 1048576 decoded bytes are handed on, 1048577 is refused and never handed on', async () => {
      const { c, over } = calls();
      const m = await ready(PLAIN, over);
      for (const bytes of [1048575, 1048576, 1048577]) {
        m.frame.printFigures();
        m.say(fig(0, 1, pngOf(bytes)));
      }
      expect(c.figures.map((f) => (f as { png: string }).png.length)).toEqual([pngOf(1048575).length, pngOf(1048576).length]);
    });

    it('sixteen figures of 1048576 bytes pass; one more byte is refused by the total while within its own cap, and is not handed on', async () => {
      const { c, over } = calls();
      const m = await ready(PLAIN, over);
      m.frame.printFigures();
      const big = pngOf(1048576);
      for (let i = 0; i < 16; i += 1) m.say(fig(i, 17, big));
      expect(c.figures).toHaveLength(16);
      m.say(fig(16, 17, PNG));
      expect(c.figures).toHaveLength(16);
      // the same figure fits a run that has room
      m.frame.printFigures();
      m.say(fig(0, 17, PNG));
      expect(c.figures).toHaveLength(17);
    });

    it('a refused figure takes none of the total: a refused big figure leaves room for the next', async () => {
      const { c, over } = calls();
      const m = await ready(PLAIN, over);
      m.frame.printFigures();
      for (let i = 0; i < 15; i += 1) m.say(fig(i, 17, pngOf(1048576)));
      m.say(fig(15, 17, pngOf(1048577)));
      m.say(fig(15, 17, pngOf(1048576)));
      expect(c.figures).toHaveLength(16);
      m.say(fig(16, 17, PNG));
      expect(c.figures).toHaveLength(16);
    });

    it('64 figures are handed on and a 65th is refused (n of 65, and a figure past the end of a run of 64), under the buckets: 16 a second, none refused by the rate', () => {
      const { c, over } = calls();
      const m = readyFake(over);
      m.frame.printFigures();
      for (let i = 0; i < 64; i += 1) {
        m.say(fig(i, 64));
        vi.advanceTimersByTime(63);
      }
      expect(c.figures).toHaveLength(64);
      expect(c.figures.map((f) => (f as { i: number }).i)).toEqual(Array.from({ length: 64 }, (_, i) => i));
      expect(m.fallbacks()).toEqual([]);
      // the run is over: a 65th has none to join; nor does an n of 65 open one that large
      m.say(fig(64, 64));
      m.frame.printFigures();
      m.say(fig(0, 65));
      m.say(fig(64, 64));
      expect(c.figures).toHaveLength(64);
      // none of the 64 was refused, so only these three refusals count
      for (let i = 0; i < 12; i += 1) m.say(fig(64, 64));
      expect(m.fallbacks()).toEqual([]);
      m.say(fig(64, 64));
      expect(m.fallbacks()).toEqual(['refusals']);
    });

    describe('a forged figure, posted straight down the port with no reader in front of it, is refused by the host alone (docserver parity T6)', () => {
      /** A run opened, one good figure (i 0 of 4) handed on; `forge` is then posted; the answer is what reached the host's callback. */
      async function forged(forge: unknown[], opts: { before?: unknown[] } = {}): Promise<{ handed: unknown[]; m: Mounted }> {
        const { c, over } = calls();
        const m = await ready(PLAIN, over);
        m.frame.printFigures();
        for (const f of opts.before ?? []) m.say(f);
        m.say(fig(0, 4));
        const keep = c.figures.length;
        for (const f of forge) m.say(f);
        const handed = c.figures.slice(keep);
        // refused figures take nothing from the run: a good one still goes on
        m.say(fig(1, 4));
        expect(c.figures).toHaveLength(keep + handed.length + 1);
        expect(m.fallbacks()).toEqual([]);
        return { handed, m };
      }

      it('an i equal to or above n', async () => {
        expect((await forged([fig(4, 4), fig(5, 4), fig(99, 4), fig(64, 64)])).handed).toEqual([]);
      });

      it('an n above 64, whatever the run holds', async () => {
        expect((await forged([fig(0, 65), fig(1, 65), fig(0, 100), fig(0, 999)])).handed).toEqual([]);
        const { c, over } = calls();
        const m = await ready(PLAIN, over);
        m.frame.printFigures();
        for (const n of [65, 100, 999]) m.say(fig(0, n));
        expect(c.figures).toEqual([]);
      });

      it('a PNG over 1 MiB, however its text is long', async () => {
        const huge = 'iVBORw0KGgo' + 'A'.repeat(1398104 + 4);
        expect((await forged([fig(2, 4, pngOf(1048577)), fig(2, 4, huge), fig(2, 4, pngOf(2_000_000))])).handed).toEqual([]);
      });

      it('a text that is not a PNG: base64 of anything else, a cut signature, an empty text, a number', async () => {
        const jpeg = '/9j/4AAQSkZJRg==';
        const bad = ['QQ==', 'AAAAAAAA', 'iVBORw0KGg==', jpeg, zeros(100), zeros(1048576), zeros(1048577), '', 7, null];
        expect((await forged(bad.map((png) => ({ t: 'print-figure', i: '2', n: '4', png })))).handed).toEqual([]);
      });

      it('an i already seen in the run', async () => {
        expect((await forged([fig(0, 4), fig(0, 4, 'iVBORw0KGgoA')])).handed).toEqual([]);
        expect((await forged([fig(2, 4), fig(2, 4)], { before: [] })).handed).toEqual([{ i: 2, n: 4, png: PNG }]);
      });

      it('a n that is not the run\'s', async () => {
        expect((await forged([fig(2, 3), fig(2, 5), fig(2, 64)])).handed).toEqual([]);
      });

      it('a figure that takes the run over its total, while within its own cap', async () => {
        const { c, over } = calls();
        const m = await ready(PLAIN, over);
        m.frame.printFigures();
        for (let i = 0; i < 16; i += 1) m.say(fig(i, 20, pngOf(1048576)));
        expect(c.figures).toHaveLength(16);
        m.say(fig(16, 20));
        m.say(fig(17, 20, pngOf(9)));
        expect(c.figures).toHaveLength(16);
        expect(m.fallbacks()).toEqual([]);
      });

      it('an i or an n that is not an integer, or no canonical decimal: a point, a fraction, an exponent, a sign, a number', async () => {
        const bad = [
          { t: 'print-figure', i: '1.5', n: '4', png: PNG },
          { t: 'print-figure', i: '2', n: '4.5', png: PNG },
          { t: 'print-figure', i: '2.0', n: '4', png: PNG },
          { t: 'print-figure', i: '1e0', n: '4', png: PNG },
          { t: 'print-figure', i: '-1', n: '4', png: PNG },
          { t: 'print-figure', i: '02', n: '4', png: PNG },
          { t: 'print-figure', i: 2, n: '4', png: PNG },
          { t: 'print-figure', i: '2', n: 4, png: PNG },
        ];
        expect((await forged(bad)).handed).toEqual([]);
      });

      it('sixteen forged figures in a row close the frame, and none of them reached the host', async () => {
        const { c, over } = calls();
        const m = await ready(PLAIN, over);
        m.frame.printFigures();
        for (let i = 0; i < 15; i += 1) m.say(fig(0, 65));
        expect(m.fallbacks()).toEqual([]);
        m.say(fig(0, 65));
        expect(m.fallbacks()).toEqual(['refusals']);
        expect(c.figures).toEqual([]);
      });
    });

    it('a throwing onPrintFigure is caught and logged, and the run goes on', async () => {
      const seenFigures: unknown[] = [];
      const m = await ready(PLAIN, { onPrintFigure: (f: unknown) => { seenFigures.push(f); throw new Error('host'); } });
      m.frame.printFigures();
      m.say(fig(0, 2));
      m.say(fig(1, 2));
      expect(seenFigures).toHaveLength(2);
      expect(m.fallbacks()).toEqual([]);
    });
  });
});

describe('docserver parity T4: the items adapter resolves the document\'s item values into seeded links', () => {
  const READER = { itemFields: ['Tracker'], itemHeadings: ['Delta'] };
  const DOC = '# Title\n\n**Spec** · 2026-10-12 · Tracker: AB-12 and CD-7\n\n## Delta\n\n```\nitem: EF-3\n```\n';
  /** A document rendered with a reader vocabulary, so its meta lists the items. */
  const withItems = (md = DOC, reader: object = READER): RenderInput => {
    const r = render(md, { reader });
    if (r.outcome !== 'rendered') throw new Error('did not render');
    return { result: { outcome: r.outcome, html: r.html, meta: { title: r.meta.title, frontList: r.meta.frontList, items: r.meta.items } } };
  };
  const link = (k: string): { value: string; href: string } => ({ value: k, href: `https://tracker.example/${k}` });
  const seedItems = (m: Mounted): unknown => seedOf(m.iframe.getAttribute('srcdoc') ?? '')['items'];
  const mountItems = (items: unknown, doc: RenderInput = withItems()): Mounted => mount(PLAIN, { items }, doc);

  it('is called with the item values the document\'s meta lists, and what it answers is seeded', () => {
    const asked: unknown[] = [];
    const m = mountItems((values: readonly string[]) => {
      asked.push(values);
      return values.map(link);
    });
    expect(asked).toEqual([['AB-12', 'CD-7', 'EF-3']]);
    expect(Object.isFrozen(asked[0])).toBe(true);
    expect(seedItems(m)).toEqual([link('AB-12'), link('CD-7'), link('EF-3')]);
    expect(m.fallbacks()).toEqual([]);
  });

  it('is called with this adapters object as its receiver', () => {
    let self: unknown;
    const adapters = {
      assets,
      watchdogMs: 5000,
      onFallback: () => undefined,
      items(this: unknown) {
        self = this;
        return [];
      },
    };
    mountDocFrame(container, { document: withItems(), adapters: adapters as unknown as HostAdapters });
    expect(self === adapters).toBe(true);
  });

  it('is not called, and seeds nothing, for a document whose meta lists no item (or has no `items` at all)', () => {
    const items = vi.fn(() => [link('AB-12')]);
    for (const doc of [withItems(DOC, {}), input(PLAIN), withItems('# T\n\nNo items.\n')]) {
      const m = mountItems(items, doc);
      expect(Object.hasOwn(seedOf(m.iframe.getAttribute('srcdoc') ?? ''), 'items')).toBe(false);
    }
    expect(items).not.toHaveBeenCalled();
  });

  it('reads the meta\'s items as data: only strings of 1 to 100 code units, at most 50, never a getter', () => {
    const asked: unknown[] = [];
    const doc = withItems();
    const meta = { title: 'T', frontList: null, items: ['AB-1', 7, '', 'x'.repeat(101), 'x'.repeat(100), ...Array.from({ length: 60 }, (_, i) => `K-${String(i)}`)] };
    mountItems((v: readonly string[]) => (asked.push(v), []), { result: { ...doc.result, meta } } as unknown as RenderInput);
    const got = asked[0] as string[];
    expect(got.slice(0, 3)).toEqual(['AB-1', 'x'.repeat(100), 'K-0']);
    expect(got).toHaveLength(50);
    const trap = { result: { ...doc.result, meta: { title: 'T', frontList: null, get items() { throw new Error('no'); } } } };
    const items = vi.fn(() => []);
    expect(() => mountItems(items, trap as unknown as RenderInput)).not.toThrow();
    expect(items).not.toHaveBeenCalled();
  });

  it('a throw is logged and means no links: the frame mounts, with no items key', () => {
    const m = mountItems(() => {
      throw new Error('tracker down');
    });
    expect(m.fallbacks()).toEqual([]);
    expect(Object.hasOwn(seedOf(m.iframe.getAttribute('srcdoc') ?? ''), 'items')).toBe(false);
    expect(warn).toHaveBeenCalled();
    // An answer of undefined, or of an empty list, is no links either.
    for (const none of [undefined, []]) {
      const n = mountItems(() => none);
      expect(Object.hasOwn(seedOf(n.iframe.getAttribute('srcdoc') ?? ''), 'items')).toBe(false);
    }
  });

  it('an answer the frame would refuse is no links: one warning, no items seeded, and the document still mounts (S2)', () => {
    const getter = { value: 'AB-12' };
    let called = false;
    Object.defineProperty(getter, 'href', { enumerable: true, get: () => ((called = true), 'https://tracker.example/AB-12') });
    const refusedAnswers: [string, unknown][] = [
      ['http:', [{ value: 'AB-12', href: 'http://tracker.example/AB-12' }]],
      ['javascript:', [{ value: 'AB-12', href: 'javascript:alert(1)' }]],
      ['not a list', 'AB-12'],
      ['a missing href', [{ value: 'AB-12' }]],
      ['an extra key', [{ ...link('AB-12'), extra: 1 }]],
      ['a long value', [{ value: 'V'.repeat(101), href: 'https://tracker.example/x' }]],
      ['51 links', Array.from({ length: 51 }, (_, i) => link(`K-${String(i)}`))],
      ['a getter', [getter]],
      ['a class', [new (class { value = 'AB-12'; href = 'https://tracker.example/AB-12'; })()]],
      ['a hole', [, link('AB-12')]],
    ];
    for (const [name, bad] of refusedAnswers) {
      warn.mockClear();
      const seen: Seen = { events: [] };
      const before = iframes();
      mountDocFrame(container, { document: withItems(), adapters: adaptersFor(seen, { items: () => bad }) });
      expect(seen.events.filter(([n]) => n === 'fallback'), name).toEqual([]);
      expect(iframes(), name).toBe(before + 1);
      const frames = container.querySelectorAll('iframe');
      expect(Object.hasOwn(seedOf((frames[frames.length - 1] as HTMLIFrameElement).getAttribute('srcdoc') ?? ''), 'items'), name).toBe(false);
      const ours = warn.mock.calls.filter((c: unknown[]) => String(c[0]).includes('the items adapter answered links the frame refuses'));
      expect(ours, name).toHaveLength(1);
      expect(String(ours[0]?.[1]), name).toMatch(/^items/);
      expect(JSON.stringify(ours[0]), name).not.toContain('tracker.example');
    }
    expect(called).toBe(false); // a getter of the answer is never called
  });

  it('frameDocument itself still refuses the same items as invalid-input (a direct caller\'s programming error)', () => {
    const doc = withItems();
    const options = { csp: frameCsp(), nonce: 'a'.repeat(32), assets };
    for (const bad of [[{ value: 'AB-12', href: 'http://tracker.example/AB-12' }], 'AB-12', Array.from({ length: 51 }, (_, i) => link(`K-${String(i)}`))]) {
      expect(() => frameDocument(doc, { ...options, items: bad as never })).toThrow(expect.objectContaining({ code: 'invalid-input' }));
    }
  });

  it('a good answer is warned about nowhere, and an empty one is none', () => {
    const m = mountItems((v: readonly string[]) => v.map(link));
    expect(warn.mock.calls.filter((c: unknown[]) => String(c[0]).includes('items adapter'))).toEqual([]);
    expect(m.fallbacks()).toEqual([]);
  });

  it('is asked again at each update, with the new document\'s items, and seeds that mount', () => {
    const asked: unknown[] = [];
    const items = (v: readonly string[]): unknown => (asked.push(v), v.map(link));
    const m = mountItems(items);
    m.frame.update(withItems('# Two\n\n**Spec** · 2026-10-12 · Tracker: ZZ-9\n'));
    expect(asked).toEqual([['AB-12', 'CD-7', 'EF-3'], ['ZZ-9']]);
    const last = container.querySelectorAll('iframe');
    expect(seedOf((last[last.length - 1] as HTMLIFrameElement).getAttribute('srcdoc') ?? '')['items']).toEqual([link('ZZ-9')]);
  });

  it('must be a function when given (a TypeError before any iframe exists), and is an adapter key', () => {
    const create = vi.spyOn(document, 'createElement');
    try {
      expect(() => mountDocFrame(container, { document: withItems(), adapters: adaptersFor({ events: [] }, { items: [link('AB-12')] }) })).toThrow(TypeError);
      expect(create.mock.calls.filter(([t]) => t === 'iframe')).toEqual([]);
    } finally {
      create.mockRestore();
    }
  });

  it('a host with no items adapter seeds no items, and the seed is the one 1.1 wrote', () => {
    const m = mount(PLAIN, {}, withItems());
    expect(Object.hasOwn(seedOf(m.iframe.getAttribute('srcdoc') ?? ''), 'items')).toBe(false);
  });
});

describe('docserver parity T5: adapters.changesBase seeds the comparison base', () => {
  const SHA = 'c'.repeat(40);
  const seedBase = (m: Mounted): unknown => seedOf(m.iframe.getAttribute('srcdoc') ?? '')['changesBase'];

  it('seeds a full sha, in every mount, and a host with none seeds no key (the seed 1.1 wrote)', () => {
    const m = mount(PLAIN, { changesBase: SHA });
    expect(m.fallbacks()).toEqual([]);
    expect(seedBase(m)).toBe(SHA);
    const none = mount(PLAIN, {});
    expect(Object.hasOwn(seedOf(none.iframe.getAttribute('srcdoc') ?? ''), 'changesBase')).toBe(false);
    const sha64 = mount(PLAIN, { changesBase: 'd'.repeat(64) });
    expect(seedBase(sha64)).toBe('d'.repeat(64));
  });

  it('a value that is not a string is a TypeError at step 1, before any iframe', () => {
    for (const bad of [7, null, true, {}, [SHA]]) {
      const before = container.querySelectorAll('iframe').length;
      expect(() => mountDocFrame(container, { document: input(PLAIN), adapters: adaptersFor({ events: [] }, { changesBase: bad } as never) }), String(bad)).toThrow(TypeError);
      expect(container.querySelectorAll('iframe').length, String(bad)).toBe(before);
    }
  });

  it('a string that is not a full sha is logged once and not seeded: the document still mounts', () => {
    for (const bad of ['abc1234', SHA.toUpperCase(), `${SHA}0`, '']) {
      warn.mockClear();
      const seen: Seen = { events: [] };
      mountDocFrame(container, { document: input(PLAIN), adapters: adaptersFor(seen, { changesBase: bad } as never) });
      expect(seen.events.filter(([n]) => n === 'fallback'), bad).toEqual([]);
      const frames = container.querySelectorAll('iframe');
      expect(Object.hasOwn(seedOf((frames[frames.length - 1] as HTMLIFrameElement).getAttribute('srcdoc') ?? ''), 'changesBase'), bad).toBe(false);
      const ours = warn.mock.calls.filter((c: unknown[]) => String(c[0]).includes('adapters.changesBase is not a full sha'));
      expect(ours, bad).toHaveLength(1);
      expect(JSON.stringify(ours[0]), bad).not.toContain(bad === '' ? '\u0000' : bad);
    }
  });
});
