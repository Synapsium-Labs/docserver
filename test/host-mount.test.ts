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
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildFrame } from '../scripts/build-frame.mjs';
import { frameCsp } from '../src/frame/csp.js';
import type { FrameAssets, RenderInput } from '../src/frame/document.js';
import { MERMAID_GATE_DEFAULTS } from '../src/frame/gate.js';
import { SEED_HTML_MAX_CHARS } from '../src/frame/seed.js';
import { CHANGES_MAX_DELETIONS, CHANGES_MAX_RANGES } from '../src/frame-runtime/inbound.js';
import { mountDocFrame, type DocFrame, type FallbackReason, type HostAdapters } from '../src/host/index.js';
import { HOST_CHANGES_MAX } from '../src/host/mount.js';
import { render, scanRefs } from '../src/render/index.js';

/** A frameDocument that throws the code a row names, else the real one (L3.H11's internal codes). */
const stub = vi.hoisted(() => ({ code: null as string | null, calls: 0 }));
vi.mock('../src/frame/document.js', async (importOriginal) => {
  const real = await importOriginal<typeof import('../src/frame/document.js')>();
  return {
    ...real,
    frameDocument: (...args: Parameters<typeof real.frameDocument>): string => {
      stub.calls += 1;
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
      expect(warn.mock.calls).toContainEqual(['docserver host: internal', code]);
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
    const all = mount(PLAIN, { changes: () => Promise.resolve(null) });
    expect(seedOf(all.iframe.getAttribute('srcdoc') ?? '')['bridge']).toEqual({ links: true, hash: true, copy: true, changes: true, versions: true });
    all.frame.destroy();
    const none = mount(PLAIN, { onLink: undefined, onHash: undefined, copy: undefined, openVersion: undefined });
    expect(seedOf(none.iframe.getAttribute('srcdoc') ?? '')['bridge']).toEqual({ links: false, hash: false, copy: false, changes: false, versions: false });
  });

  it('features and prefs pass through to the seed', () => {
    const m = mount(PLAIN, { features: { rules: false }, prefs: { theme: 'dark', width: 'wide' } });
    const seed = seedOf(m.iframe.getAttribute('srcdoc') ?? '');
    expect(seed['features']).toEqual({ rules: false });
    expect(seed['prefs']).toEqual({ theme: 'dark', width: 'wide' });
  });
});
