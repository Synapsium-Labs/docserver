// mountDocFrame: `./host`'s reference parent of the sealed reader frame (docserver L3, Task 10; plan Reference §11,
// FD10, FD15, FD22). It mounts one srcdoc frame for a rendered document, speaks the bridge with it, and hands every
// effect to the host's adapters. The first consumer re-implements this contract on its side and never imports it.
//
// One mount, in the order of Reference §11.1:
//   1. The adapters are checked: own data properties only (a getter is refused unread, an inherited property is
//      absent, an unknown key refused), `watchdogMs` an integer from 1 to 120000, `onFallback` a function, every other
//      callback a function when given, `mermaidDraw` absent or one of its values, each `mermaidGate` cap at most its
//      default. A failure throws TypeError or RangeError before any iframe exists.
//   2. The Mermaid gate (`mermaidGate`, in code units) on the document's scan; when it passes, Mermaid is inlined with
//      the per-fence cap as `maxTextSize`. A document with no scan carries no Mermaid.
//   3. A fresh nonce: 16 bytes of crypto.getRandomValues, lower-case hex.
//   4. The snapshot, from the host's store under its prefix (both prefs, and the current document's fields only).
//   5. frameDocument under frameCsp(). A FrameError calls onFallback once with its reason and no iframe is created:
//      not-rendered and invalid-input give invalid-input, too-large gives too-large, the asset codes give assets, and
//      nonce and csp (which ./host's own values never produce) give assets after an internal warning.
//   6. A new iframe: sandbox exactly allow-scripts, referrerpolicy no-referrer, the csp attribute (the meta's string),
//      the title, then srcdoc, all before insertion. Never src, name, allow, allowfullscreen or loading.
//   7. A MessageChannel; the load listener on the element; insertion; the watchdog. 8. Focus, when `focus` is on.
// The first load posts {t:'hello', v:1} with the channel's second port to the frame's window, target '*': the mount's
// only contentWindow.postMessage. Any later load closes the port and falls back ('navigated').
//
// On the port, every message goes through parseBridgeMessage with the mount's nonce. Before a valid ready, every op
// but ready is dropped and counted; a ready with a wrong nonce or protocol falls back ('nonce', 'protocol'). A valid
// ready stops the watchdog, calls onReady and posts any queued prefs. After it, the limiter (two token buckets, one
// `changes` in flight, navigate and version coalesced over 250 ms; createLimiter) and then one effect per op. An
// `error` is terminal by itself (FD10): the parent cannot see the port close, so it never waits for one. Sixteen
// refusals (the parser's, the limiter's, a messageerror) fall back ('refusals'). An adapter that throws is caught and
// logged and never counts against the frame.
//
// Teardown: a fallback clears the timers, closes the port, removes the iframe and calls onFallback once; it never
// remounts. update() is a full remount (new iframe, channel, nonce and watchdog), never a srcdoc reassignment.
// destroy() is idempotent and calls no adapter, also when host code that a mount step runs (a focusout at the focus)
// calls it, or update(), from inside update(). ./host never navigates, opens a window, touches the clipboard or adds
// a window `message` listener (test/host-walls.test.ts scans for each).
//
// Import-inert: no module-level state. Each mount keeps its state in its own closure; two mounts share no port, nonce
// or timer. The DOM is touched only inside mountDocFrame and the DocFrame it returns, through the element's own window.
import { frameCsp } from '../frame/csp.js';
import { FrameError, frameDocument, type FrameAssets, type FrameErrorCode, type FrameFeatures, type FrameOptions, type RenderInput } from '../frame/document.js';
import { mermaidGate, type MermaidGateCaps } from '../frame/gate.js';
import { BRIDGE_LIMITS, BRIDGE_PROTOCOL, FRAME_PREF_VALUES, isFullSha, type FrameToParent } from '../frame/protocol.js';
import type { FramePrefs } from '../frame/wire-types.js';
import { hiddenChars, type HiddenChar } from './copy.js';
import { createLimiter, type Limiter } from './limits.js';
import { classifyLink, type HostLink } from './links.js';
import { parseBridgeMessage } from './parse.js';
import { createHostStore, type HostStorage, type HostStore } from './store.js';

/** Why a mount fell back: the host shows its own view of the document instead (Reference §1). */
export type FallbackReason = 'timeout' | 'nonce' | 'error' | 'protocol' | 'refusals' | 'navigated' | 'assets' | 'too-large' | 'invalid-input';

/**
 * A `changes` answer from the host: the changed line ranges, and the lines after which lines were removed. Internal:
 * Reference §1 names no such type, so HostAdapters.changes spells the shape out and the entry exports nothing for it.
 */
interface HostChanges {
  readonly ranges: readonly (readonly [number, number])[];
  readonly removedAfter?: readonly number[];
}

export interface HostAdapters {
  /** The exact texts of the shipped frame files; the host reads them, the library never fetches. */
  readonly assets: FrameAssets;
  /** Required: from insertion to a valid ready, in ms (1 to 120000). */
  readonly watchdogMs: number;
  /** The host's storage (Web Storage's interface); absent, nothing is stored or seeded. */
  readonly store?: HostStorage;
  /** Default 'docreader:'. */
  readonly storePrefix?: string;
  /** This document's identity; absent, no per-document state. */
  readonly docKey?: string;
  readonly prefs?: Partial<FramePrefs>;
  readonly features?: FrameFeatures;
  /** Only tighten. */
  readonly mermaidGate?: MermaidGateCaps;
  /** Default 'auto'; passed through as FrameOptions.mermaid.draw. */
  readonly mermaidDraw?: 'auto' | 'on-request';
  /** The iframe's accessible name; default 'Document'. */
  readonly title?: string;
  /** Default true: focus the iframe right after insertion (M8.1). */
  readonly focus?: boolean;
  /** ./host never navigates or opens a window: the host decides. */
  onLink?(link: HostLink): void;
  onHash?(id: string): void;
  /** ./host never touches the clipboard: the host writes the text, after showing what `hidden` lists. */
  copy?(text: string, check: { readonly hidden: readonly HiddenChar[] }): void;
  changes?(sha: string): Promise<{ ranges: readonly (readonly [number, number])[]; removedAfter?: readonly number[] } | null>;
  openVersion?(v: { sha?: string; only?: string }): void;
  onReady?(): void;
  /** Required. The frame's own error reason never reaches it. */
  onFallback(reason: FallbackReason): void;
}

export interface DocFrame {
  /** A full remount: a new iframe, channel, nonce and watchdog. */
  update(d: RenderInput): void;
  /** Posted once ready, else queued; seeds every later remount. */
  setPrefs(p: Partial<FramePrefs>): void;
  /** Idempotent; calls no adapter. */
  destroy(): void;
}

/** Every key HostAdapters may hold. */
const ADAPTER_KEYS: readonly string[] = Object.freeze([
  'assets', 'watchdogMs', 'store', 'storePrefix', 'docKey', 'prefs', 'features', 'mermaidGate', 'mermaidDraw', 'title',
  'focus', 'onLink', 'onHash', 'copy', 'changes', 'openVersion', 'onReady', 'onFallback',
]);

/** The callbacks, each a function when given. */
const CALLBACKS = Object.freeze(['onLink', 'onHash', 'copy', 'changes', 'openVersion', 'onReady', 'onFallback'] as const);
type CallbackName = (typeof CALLBACKS)[number];

const MERMAID_DRAW: readonly string[] = Object.freeze(['auto', 'on-request']);
const WATCHDOG_MAX_MS = 120_000;
const TITLE_MAX = 1024;
const DEFAULT_TITLE = 'Document';

/**
 * The most ranges, and the most removedAfter entries, a changes answer may carry: the layout's own caps (MAX_RANGES and
 * MAX_DELETIONS in src/enhance/changes.ts, which the frame checks too); test/host-mount.test.ts pins the equality.
 * Internal: the entry does not export it.
 */
export const HOST_CHANGES_MAX = 10_000;

/** Reference §11.1 step 5's table. */
const FALLBACK_OF: Readonly<Record<FrameErrorCode, FallbackReason>> = Object.freeze({
  'not-rendered': 'invalid-input',
  'invalid-input': 'invalid-input',
  'too-large': 'too-large',
  'asset-mismatch': 'assets',
  'unsafe-asset': 'assets',
  'missing-asset': 'assets',
  nonce: 'assets',
  csp: 'assets',
});

/** The codes ./host's own values never produce: the installed library disagrees with itself. */
const INTERNAL: readonly FrameErrorCode[] = Object.freeze(['nonce', 'csp'] as const);

const isPlain = (v: unknown): v is object => {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false;
  const p: unknown = Object.getPrototypeOf(v);
  return p === Object.prototype || p === null;
};

/** The own data properties of `v` as a record: an unknown key or a getter (unread) is a TypeError; undefined is absent. */
function ownData(v: unknown, where: string, allowed: readonly string[]): Record<string, unknown> {
  if (typeof v !== 'object' || v === null) throw new TypeError(`docserver host: ${where} must be an object`);
  const out: Record<string, unknown> = {};
  for (const k of Reflect.ownKeys(v)) {
    if (typeof k !== 'string' || !allowed.includes(k)) throw new TypeError(`docserver host: ${where} has an unknown key ${String(k)}`);
    const d = Object.getOwnPropertyDescriptor(v, k);
    if (d === undefined) continue;
    if (!('value' in d)) throw new TypeError(`docserver host: ${where}.${k} must be a plain value, not a getter`);
    if (d.value !== undefined) out[k] = d.value as unknown;
  }
  return out;
}

/** Prefs: theme, width and font, each one of its values. */
function prefsOf(p: unknown, where: string): Partial<FramePrefs> {
  if (!isPlain(p)) throw new TypeError(`docserver host: ${where} must be a plain object`);
  const f = ownData(p, where, Object.keys(FRAME_PREF_VALUES));
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(f)) {
    const values = (FRAME_PREF_VALUES as Readonly<Record<string, readonly string[]>>)[k] ?? [];
    if (typeof v !== 'string') throw new TypeError(`docserver host: ${where}.${k} must be a string`);
    if (!values.includes(v)) throw new RangeError(`docserver host: ${where}.${k} must be one of ${values.join(', ')}`);
    out[k] = v;
  }
  return out as Partial<FramePrefs>;
}

/** The checked adapters (step 1). */
interface Checked {
  readonly raw: object;
  readonly assets: unknown;
  readonly watchdogMs: number;
  readonly store: HostStore | null;
  readonly prefs: Partial<FramePrefs>;
  readonly features: unknown;
  readonly gate: MermaidGateCaps;
  readonly draw: 'auto' | 'on-request';
  readonly title: string;
  readonly focus: boolean;
  readonly callbacks: Partial<Record<CallbackName, (...args: never[]) => unknown>>;
}

function check(adapters: unknown): Checked {
  const a = ownData(adapters, 'adapters', ADAPTER_KEYS);
  const callbacks: Partial<Record<CallbackName, (...args: never[]) => unknown>> = {};
  for (const name of CALLBACKS) {
    const fn = a[name];
    if (fn === undefined) continue;
    if (typeof fn !== 'function') throw new TypeError(`docserver host: adapters.${name} must be a function`);
    callbacks[name] = fn as (...args: never[]) => unknown;
  }
  if (callbacks.onFallback === undefined) throw new TypeError('docserver host: adapters.onFallback is required');
  const w = a['watchdogMs'];
  if (typeof w !== 'number') throw new TypeError('docserver host: adapters.watchdogMs must be a number');
  if (!Number.isInteger(w) || w < 1 || w > WATCHDOG_MAX_MS) throw new RangeError(`docserver host: adapters.watchdogMs must be an integer from 1 to ${String(WATCHDOG_MAX_MS)}`);
  const draw = a['mermaidDraw'] ?? 'auto';
  if (typeof draw !== 'string') throw new TypeError('docserver host: adapters.mermaidDraw must be a string');
  if (!MERMAID_DRAW.includes(draw)) throw new RangeError(`docserver host: adapters.mermaidDraw must be one of ${MERMAID_DRAW.join(', ')}`);
  const gate = a['mermaidGate'] ?? {};
  if (!isPlain(gate)) throw new TypeError('docserver host: adapters.mermaidGate must be a plain object');
  // The gate checks its caps itself (TypeError, RangeError: caps only tighten); a document with no fence asks it now.
  mermaidGate({ fences: 0, largestChars: 0, totalChars: 0 }, gate);
  const title = a['title'] ?? DEFAULT_TITLE;
  if (typeof title !== 'string') throw new TypeError('docserver host: adapters.title must be a string');
  if (title.length < 1 || title.length > TITLE_MAX) throw new RangeError(`docserver host: adapters.title must be 1 to ${String(TITLE_MAX)} code units`);
  const focus = a['focus'] ?? true;
  if (typeof focus !== 'boolean') throw new TypeError('docserver host: adapters.focus must be a boolean');
  const prefs = a['prefs'] === undefined ? {} : prefsOf(a['prefs'], 'adapters.prefs');
  let store: HostStore | null = null;
  const s = a['store'];
  if (s !== undefined) {
    if (typeof s !== 'object' || s === null) throw new TypeError('docserver host: adapters.store must be an object');
    for (const m of ['getItem', 'setItem', 'removeItem', 'key'] as const) {
      if (typeof (s as Record<string, unknown>)[m] !== 'function') throw new TypeError(`docserver host: adapters.store.${m} must be a function`);
    }
    store = createHostStore(s as HostStorage, a['storePrefix'] as string | undefined, a['docKey'] as string | undefined);
  } else {
    if (a['storePrefix'] !== undefined && typeof a['storePrefix'] !== 'string') throw new TypeError('docserver host: adapters.storePrefix must be a string');
    if (a['docKey'] !== undefined && typeof a['docKey'] !== 'string') throw new TypeError('docserver host: adapters.docKey must be a string');
  }
  return { raw: adapters as object, assets: a['assets'], watchdogMs: w, store, prefs, features: a['features'], gate: gate as MermaidGateCaps, draw: draw as 'auto' | 'on-request', title, focus, callbacks };
}

/** A changes answer, copied as plain data; null when it is malformed (unavailable). */
function changesOf(reply: unknown): HostChanges | null {
  if (!isPlain(reply)) return null;
  const ranges: unknown = Object.getOwnPropertyDescriptor(reply, 'ranges')?.value;
  const removedDesc = Object.getOwnPropertyDescriptor(reply, 'removedAfter');
  const removed: unknown = removedDesc === undefined ? undefined : removedDesc.value;
  const isIndex = (n: unknown): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0;
  if (!Array.isArray(ranges) || ranges.length > HOST_CHANGES_MAX) return null;
  const outRanges: [number, number][] = [];
  for (let i = 0; i < ranges.length; i += 1) {
    const p: unknown = Object.getOwnPropertyDescriptor(ranges, String(i))?.value;
    if (!Array.isArray(p) || p.length !== 2) return null;
    const from: unknown = Object.getOwnPropertyDescriptor(p, '0')?.value;
    const to: unknown = Object.getOwnPropertyDescriptor(p, '1')?.value;
    if (!isIndex(from) || !isIndex(to) || from > to) return null;
    outRanges.push([from, to]);
  }
  if (removed === undefined) return { ranges: outRanges };
  if (!Array.isArray(removed) || removed.length > HOST_CHANGES_MAX) return null;
  const outRemoved: number[] = [];
  for (let i = 0; i < removed.length; i += 1) {
    const k: unknown = Object.getOwnPropertyDescriptor(removed, String(i))?.value;
    if (!isIndex(k)) return null;
    outRemoved.push(k);
  }
  return { ranges: outRanges, removedAfter: outRemoved };
}

/** What a mount uses of the element's window. */
interface HostWindow {
  readonly document: Document;
  readonly crypto: Crypto;
  readonly performance: Performance;
  readonly MessageChannel: new () => MessageChannel;
  setTimeout(fn: () => void, ms: number): number;
  clearTimeout(handle: number): void;
}

/** The window an element lives in, or a TypeError. */
function windowOf(el: unknown): HostWindow {
  const doc: unknown = typeof el === 'object' && el !== null ? (el as { ownerDocument?: unknown }).ownerDocument : undefined;
  const win: unknown = typeof doc === 'object' && doc !== null ? (doc as { defaultView?: unknown }).defaultView : undefined;
  if (typeof win !== 'object' || win === null || typeof (el as { append?: unknown }).append !== 'function') {
    throw new TypeError('docserver host: mountDocFrame needs an element of a document that has a window');
  }
  return win as HostWindow;
}

/** Mounts the sealed reader frame for `o.document` into `el` (Reference §11). */
export function mountDocFrame(el: HTMLElement, o: { readonly document: RenderInput; readonly adapters: HostAdapters }): DocFrame {
  const win = windowOf(el);
  const opts = ownData(o, 'options', ['document', 'adapters']);
  const c = check(opts['adapters']);
  const doc = win.document;

  /** Calls one adapter with its receiver, catching (and logging) what it throws. */
  const call = (name: CallbackName, ...args: unknown[]): unknown => {
    const fn = c.callbacks[name];
    if (fn === undefined) return undefined;
    try {
      return Reflect.apply(fn, c.raw, args);
    } catch (e) {
      console.warn('docserver host: an adapter threw', name, e);
      return undefined;
    }
  };

  /** The prefs every mount seeds: the adapters' own, then each setPrefs on top. */
  let seedPrefs: Partial<FramePrefs> = { ...c.prefs };
  let destroyed = false;
  /** Tears the current mount down without a fallback (update, destroy); null when nothing is mounted. */
  let teardown: (() => void) | null = null;
  /** Posts prefs on the current mount's port (now or at its ready). */
  let sendPrefs: (p: Partial<FramePrefs>) => void = () => undefined;

  const mount = (d: RenderInput): void => {
    let live = true;
    let fellBack = false;
    // Steps 2 to 5: the gate, the nonce, the snapshot, the srcdoc. Any refusal: one fallback, no iframe.
    const nonceBytes = new Uint8Array(16);
    win.crypto.getRandomValues(nonceBytes);
    const nonce = Array.from(nonceBytes, (b) => b.toString(16).padStart(2, '0')).join('');
    const policy = frameCsp();
    let page: string;
    try {
      const scanned: unknown = isPlain(d) ? (d as { scan?: { mermaid?: unknown } }).scan?.mermaid : undefined;
      const gated = scanned === undefined ? null : mermaidGate(scanned as Parameters<typeof mermaidGate>[0], c.gate);
      const frameOptions: FrameOptions = {
        csp: policy,
        nonce,
        assets: c.assets as FrameAssets,
        prefs: seedPrefs,
        ...(c.store === null ? {} : { snapshot: c.store.snapshot() }),
        mermaid: gated !== null && gated.inline ? { maxTextSize: gated.maxTextSize, draw: c.draw } : null,
        ...(c.features === undefined ? {} : { features: c.features as FrameFeatures }),
        bridge: {
          links: c.callbacks.onLink !== undefined,
          hash: c.callbacks.onHash !== undefined,
          copy: c.callbacks.copy !== undefined,
          changes: c.callbacks.changes !== undefined,
          versions: c.callbacks.openVersion !== undefined,
        },
      };
      page = frameDocument(d, frameOptions);
    } catch (e) {
      const code: FrameErrorCode = e instanceof FrameError ? e.code : 'invalid-input';
      if (INTERNAL.includes(code)) console.warn('docserver host: internal', code);
      teardown = null;
      call('onFallback', FALLBACK_OF[code]);
      return;
    }

    // Step 6: the iframe, every attribute before insertion.
    const iframe = doc.createElement('iframe');
    iframe.setAttribute('sandbox', 'allow-scripts');
    iframe.setAttribute('referrerpolicy', 'no-referrer');
    iframe.setAttribute('csp', policy);
    iframe.setAttribute('title', c.title);
    iframe.setAttribute('srcdoc', page);

    // Step 7: the channel, the load listener, insertion, the watchdog.
    const channel = new win.MessageChannel();
    const port = channel.port1;
    let loads = 0;
    let ready = false;
    let early = 0;
    let limiter: Limiter | null = null;
    let pending: Partial<FramePrefs> | null = null;
    const changeTimers = new Set<number>();
    let watchdog: number | null = null;

    const stop = (): void => {
      live = false;
      if (watchdog !== null) win.clearTimeout(watchdog);
      watchdog = null;
      for (const t of changeTimers) win.clearTimeout(t);
      changeTimers.clear();
      limiter?.dispose();
      port.onmessage = null;
      port.onmessageerror = null;
      port.close();
      iframe.remove();
    };
    const fail = (reason: FallbackReason): void => {
      if (!live || fellBack) return;
      fellBack = true;
      stop();
      teardown = null;
      call('onFallback', reason);
    };
    const post = (m: unknown): void => {
      if (live) port.postMessage(m);
    };

    /** One refusal, counted toward the sixteen. */
    const refused = (): void => {
      if (limiter === null) {
        early += 1;
        if (early >= BRIDGE_LIMITS.refusalsToClose) fail('refusals');
      } else if (limiter.refuse()) fail('refusals');
    };

    /** A changes request: ask the host, answer the frame once, free the slot. */
    const answerChanges = (sha: string): void => {
      let settled = false;
      const settle = (reply: HostChanges | null): void => {
        if (settled) return;
        settled = true;
        win.clearTimeout(timer);
        changeTimers.delete(timer);
        if (!live) return;
        post(reply === null ? { t: 'changes.result', sha, unavailable: true } : { t: 'changes.result', sha, ...reply });
        limiter?.changesDone();
      };
      const timer = win.setTimeout(() => settle(null), BRIDGE_LIMITS.changesTimeoutMs);
      changeTimers.add(timer);
      let asked: unknown;
      try {
        const fn = c.callbacks.changes;
        asked = fn === undefined ? null : Reflect.apply(fn, c.raw, [sha]);
      } catch (e) {
        console.warn('docserver host: an adapter threw', 'changes', e);
        settle(null);
        return;
      }
      Promise.resolve(asked).then(
        (reply) => settle(reply === null || reply === undefined ? null : changesOf(reply)),
        () => settle(null),
      );
    };

    /** One op that passed the limiter: its one effect. */
    const effect = (msg: FrameToParent): void => {
      if (!live) return;
      switch (msg.t) {
        case 'store.set':
          if (c.store !== null) c.store.set(msg.key, msg.value);
          return;
        case 'navigate': {
          const link = classifyLink(msg.href);
          if (link !== null) call('onLink', link);
          return;
        }
        case 'copy':
          call('copy', msg.text, { hidden: hiddenChars(msg.text) });
          return;
        case 'changes':
          if (isFullSha(msg.sha)) answerChanges(msg.sha);
          return;
        case 'hash':
          call('onHash', msg.id);
          return;
        case 'version': {
          const v: { sha?: string; only?: string } = {};
          if (msg.sha !== undefined) v.sha = msg.sha;
          if (msg.only !== undefined) v.only = msg.only;
          call('openVersion', v);
          return;
        }
        case 'error':
          console.warn('docserver frame:', msg.why);
          fail('error');
          return;
        case 'ready':
          return;
      }
    };

    const onReady = (): void => {
      ready = true;
      if (watchdog !== null) win.clearTimeout(watchdog);
      watchdog = null;
      limiter = createLimiter({
        clock: { now: () => win.performance.now(), setTimeout: (fn, ms) => win.setTimeout(fn, ms), clearTimeout: (h) => win.clearTimeout(h as number) },
        deliver: effect,
      });
      for (let i = 0; i < early; i += 1) limiter.refuse();
      call('onReady');
      if (live && pending !== null) {
        post({ t: 'prefs', ...pending });
        pending = null;
      }
    };

    port.onmessage = (e: MessageEvent): void => {
      if (!live) return;
      const parsed = parseBridgeMessage(e.data, e.ports, nonce);
      if (!ready) {
        if (parsed.ok && parsed.msg.t === 'ready') onReady();
        else if (!parsed.ok && (parsed.reason === 'nonce' || parsed.reason === 'protocol')) fail(parsed.reason);
        else refused();
        return;
      }
      if (!parsed.ok || parsed.msg.t === 'ready') {
        refused();
        return;
      }
      const admitted = (limiter as Limiter).admit(parsed.msg);
      if (!admitted.ok && admitted.closes) fail('refusals');
    };
    port.onmessageerror = (): void => {
      if (live) refused();
    };

    iframe.addEventListener('load', () => {
      if (!live) return;
      loads += 1;
      if (loads === 1) {
        const target = iframe.contentWindow;
        if (target === null) {
          fail('navigated');
          return;
        }
        target.postMessage({ t: 'hello', v: BRIDGE_PROTOCOL }, '*', [channel.port2]);
        return;
      }
      fail('navigated');
    });
    // The handles are published before the first step that can run host code: insertion (a mutation event) and focus
    // (blur and focusout on the element that had it) run the host's listeners synchronously, and one of them may call
    // destroy() or update(). Each finds this mount's teardown and stops it; this mount then sets nothing more.
    sendPrefs = (p) => {
      if (!live) return;
      if (ready) post({ t: 'prefs', ...p });
      else pending = { ...(pending ?? {}), ...p };
    };
    teardown = () => {
      if (live) stop();
    };
    el.append(iframe);
    if (!live) return;
    watchdog = win.setTimeout(() => fail('timeout'), c.watchdogMs);
    // Step 8: focus right after insertion; nothing is focused again at ready.
    if (c.focus) iframe.focus();
  };

  mount(opts['document'] as RenderInput);

  return {
    update(d) {
      if (destroyed) return;
      teardown?.();
      teardown = null;
      sendPrefs = () => undefined;
      mount(d);
    },
    setPrefs(p) {
      const checked = prefsOf(p, 'prefs');
      if (destroyed) return;
      seedPrefs = { ...seedPrefs, ...checked };
      sendPrefs(checked);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      teardown?.();
      teardown = null;
      sendPrefs = () => undefined;
    },
  };
}
