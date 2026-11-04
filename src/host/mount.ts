// mountDocFrame: `./host`'s reference parent of the sealed reader frame (docserver L3, Task 10; plan Reference §11,
// FD10, FD15, FD22). It mounts one srcdoc frame for a rendered document, speaks the bridge with it, and hands every
// effect to the host's adapters. The first consumer re-implements this contract on its side and never imports it.
//
// One mount, in the order of Reference §11.1:
//   1. The adapters are checked: own data properties only (a getter is refused unread, an inherited property is
//      absent, an unknown key refused), `watchdogMs` an integer from 1 to 120000, `onFallback` a function, every other
//      callback a function when given, `mermaidDraw` absent or one of its values ('after-ready' needs `loadMermaid` or
//      `assets.mermaid`), each `mermaidGate` cap at most its default. A failure throws TypeError or RangeError before any iframe exists.
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
// 'after-ready' (ledger C107): a mount whose gate admits Mermaid asks for the build at once, in parallel with the frame's
// boot, and the DocFrame holds the one verdict (the loader is called at most once per DocFrame, however many remounts;
// one reaction is attached to its answer, and it reaches only the current mount, so no replaced mount is retained).
// The answer is checked (a string, within the bridge's cap, the shipped build's sha256) and is `unavailable` after one
// console warning otherwise; the loader is untrusted, so nothing it does escapes. Each such mount posts one `mermaid` op
// after its own valid ready, at once if the answer came first, and a replaced or destroyed mount posts nothing.
//
// One header bar (batch 1.1, ledger C108): `onProgress` asks the frame for `progress` ops (the seed's `bridge.progress`,
// set by that adapter alone) and is handed each as `Number(p) / 1000`; `DocFrame.command(name)` posts a `command` op after
// focusing the iframe, once this mount is ready, and does nothing before it, after a fallback or after destroy().
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
import { FRAME_MANIFEST } from '../frame/manifest.generated.js';
import { BRIDGE_LIMITS, BRIDGE_PROTOCOL, COMMAND_OPS, FRAME_PREF_VALUES, isFullSha, type FrameToParent } from '../frame/protocol.js';
import { hex, sha256Text } from '../frame/sha256.js';
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
  /**
   * Default 'auto'; passed through as FrameOptions.mermaid.draw. 'after-ready' mounts at once, fetches the build in
   * parallel with the frame's boot and posts it after ready (ledger C107): it needs `loadMermaid`, or `assets.mermaid`.
   */
  readonly mermaidDraw?: 'auto' | 'on-request' | 'after-ready';
  /**
   * Only for 'after-ready' (in any other mode it is ignored, whatever it holds, and never called; when `assets.mermaid` is
   * given too, this wins): the exact text of
   * `mermaid/mermaid.frame.js`. Called at most once per DocFrame, at the first mount whose document the gate lets
   * Mermaid into; untrusted host code, so a throw, a rejection, a value that is not a string, a string over the bridge's
   * cap or a text whose sha256 is not the shipped build's all leave the figures as source (one console warning).
   */
  readonly loadMermaid?: () => Promise<string>;
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
  /**
   * How far the document has been read, a number from 0 to 1 (the frame's thousandths over 1000): at most four calls a
   * second, the first at once and the latest of each 250 ms window at its end, so the final value arrives. Giving it
   * is what asks the frame to send progress at all (batch 1.1, C108).
   */
  onProgress?(share: number): void;
  onReady?(): void;
  /** Required. The frame's own error reason never reaches it. */
  onFallback(reason: FallbackReason): void;
}

export interface DocFrame {
  /** A full remount: a new iframe, channel, nonce and watchdog. */
  update(d: RenderInput): void;
  /** Posted once ready, else queued; seeds every later remount. */
  setPrefs(p: Partial<FramePrefs>): void;
  /**
   * Runs one of the reader's tools without the reader's own bar, as a toggle (batch 1.1, C108): focuses the iframe, then
   * posts the command. Before the frame is ready, after destroy() and after a fallback it does nothing (it is not
   * queued); a name outside the four throws a TypeError, whatever the state.
   */
  command(name: (typeof COMMAND_OPS)[number]): void;
  /** Idempotent; calls no adapter. */
  destroy(): void;
}

/** Every key HostAdapters may hold. */
const ADAPTER_KEYS: readonly string[] = Object.freeze([
  'assets', 'watchdogMs', 'store', 'storePrefix', 'docKey', 'prefs', 'features', 'mermaidGate', 'mermaidDraw', 'title',
  'focus', 'onLink', 'onHash', 'copy', 'changes', 'openVersion', 'onProgress', 'onReady', 'onFallback', 'loadMermaid',
]);

/** The callbacks, each a function when given. */
const CALLBACKS = Object.freeze(['onLink', 'onHash', 'copy', 'changes', 'openVersion', 'onProgress', 'onReady', 'onFallback'] as const);
type CallbackName = (typeof CALLBACKS)[number];

const MERMAID_DRAW: readonly string[] = Object.freeze(['auto', 'on-request', 'after-ready']);
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
  readonly draw: 'auto' | 'on-request' | 'after-ready';
  /** The 'after-ready' build's one source: the loader, else assets.mermaid's text; null in any other mode. */
  readonly mermaidSource: (() => unknown) | string | null;
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
  const loader = a['loadMermaid'];
  let mermaidSource: Checked['mermaidSource'] = null;
  if (draw === 'after-ready') {
    // A source is required: the loader, else the Mermaid text among the assets (read as an own data property); when both
    // are given the loader is used. In any other mode `loadMermaid` is ignored, whatever it holds, and never called.
    if (loader !== undefined && typeof loader !== 'function') throw new TypeError('docserver host: adapters.loadMermaid must be a function');
    const given: unknown = isPlain(a['assets']) ? Object.getOwnPropertyDescriptor(a['assets'], 'mermaid')?.value : undefined;
    if (typeof loader === 'function') mermaidSource = loader as () => unknown;
    else if (typeof given === 'string') mermaidSource = given;
    else throw new TypeError("docserver host: mermaidDraw 'after-ready' needs adapters.loadMermaid or adapters.assets.mermaid");
  }
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
  return { raw: adapters as object, assets: a['assets'], watchdogMs: w, store, prefs, features: a['features'], gate: gate as MermaidGateCaps, draw: draw as Checked['draw'], mermaidSource, title, focus, callbacks };
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
  /** Focuses the current mount's iframe and posts a command on its port; nothing before its ready or once it is gone. */
  let sendCommand: (name: (typeof COMMAND_OPS)[number]) => void = () => undefined;

  /** What every 'after-ready' mount of this DocFrame posts: the build, or that there is none. */
  type Build = { readonly text: string } | { readonly unavailable: true };
  const noop = (): void => undefined;

  /** The one answer, never a rejection: the source is untrusted host code, and nothing it does may escape. */
  const ask = (source: NonNullable<Checked['mermaidSource']>): Promise<Build> => {
    // One warning, a fixed reason and never the loader's own value: formatting a hostile value could throw, and so
    // could a console, so the call is contained too.
    const none = (reason: string): Build => {
      try {
        console.warn('docserver host: the Mermaid build is unavailable', reason);
      } catch {
        // a console that throws is no reason to lose the answer
      }
      return { unavailable: true };
    };
    let answer: Promise<unknown>;
    try {
      const asked: unknown = typeof source === 'string' ? source : Reflect.apply(source, c.raw, []);
      // A fresh native promise: a thenable, or a promise with a hostile constructor or then, is adopted by it safely.
      answer = new Promise<unknown>((resolve) => resolve(asked));
    } catch {
      return Promise.resolve(none('the loader threw'));
    }
    return answer.then(
      (text): Build => {
        try {
          if (typeof text !== 'string') return none('the loader did not answer a string');
          if (text.length > BRIDGE_LIMITS.mermaidMaxChars) return none('the build is over the bridge cap');
          if (hex(sha256Text(text)) !== FRAME_MANIFEST.mermaid.sha256) return none('the build is not the shipped one');
          return { text };
        } catch {
          return none('the build could not be checked');
        }
      },
      (): Build => none('the loader rejected'),
    );
  };

  // The verdict lives here, at DocFrame level (ledger C107): the loader is asked at most once, one reaction is attached
  // to its answer, and that reaction reaches only the current mount, through `onVerdict`. A mount that is replaced,
  // destroyed or fallen back clears the hook, so at most the current mount is retained while a loader stays pending,
  // and none after destroy().
  let asked = false;
  let verdict: Build | null = null;
  let onVerdict: () => void = noop;
  /** Asks on the first call. `asked` is set before the source runs, so a source that re-enters cannot ask twice. */
  const askOnce = (source: NonNullable<Checked['mermaidSource']>): void => {
    if (asked) return;
    asked = true;
    void ask(source).then((b) => {
      verdict = b;
      const hook = onVerdict;
      onVerdict = noop;
      hook();
    });
  };

  const mount = (d: RenderInput): void => {
    let live = true;
    let fellBack = false;
    /** This mount seeds 'after-ready' with Mermaid on: it is owed one mermaid op after its own ready. */
    let late = false;
    // Steps 2 to 5: the gate, the nonce, the snapshot, the srcdoc. Any refusal: one fallback, no iframe.
    const nonceBytes = new Uint8Array(16);
    win.crypto.getRandomValues(nonceBytes);
    const nonce = Array.from(nonceBytes, (b) => b.toString(16).padStart(2, '0')).join('');
    const policy = frameCsp();
    let page: string;
    try {
      const scanned: unknown = isPlain(d) ? (d as { scan?: { mermaid?: unknown } }).scan?.mermaid : undefined;
      const gated = scanned === undefined ? null : mermaidGate(scanned as Parameters<typeof mermaidGate>[0], c.gate);
      late = c.draw === 'after-ready' && gated !== null && gated.inline;
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
          // Asked for by giving onProgress, and by nothing else: a frame is never sent a progress nobody listens to.
          progress: c.callbacks.onProgress !== undefined,
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
    let answer: Build | null = null;
    let sent = false;
    const changeTimers = new Set<number>();
    let watchdog: number | null = null;

    const stop = (): void => {
      live = false;
      if (watchdog !== null) win.clearTimeout(watchdog);
      watchdog = null;
      for (const t of changeTimers) win.clearTimeout(t);
      changeTimers.clear();
      limiter?.dispose();
      onVerdict = noop; // only the current mount is ever stopped, and it is the one that holds the hook
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

    /**
     * The mermaid op, once, after this mount's own valid ready and once the answer is known (ledger C107). It goes
     * through `post`, whose `live` flag is what keeps a replaced or destroyed mount silent.
     */
    const deliver = (): void => {
      if (!ready || sent || answer === null) return;
      sent = true;
      try {
        post('text' in answer ? { t: 'mermaid', text: answer.text } : { t: 'mermaid', unavailable: true });
      } catch {
        try {
          console.warn('docserver host: the Mermaid build could not be posted');
        } catch {
          // a console that throws is no reason to fail the port
        }
      }
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
        case 'progress':
          call('onProgress', Number(msg.p) / 1000);
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
      deliver();
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
    sendCommand = (name) => {
      if (!live || !ready) return;
      // The focus first, so the keys the tool uses reach the frame; it runs host code (a blur or focusout handler),
      // which may destroy or update this mount, and `post` then drops the command.
      iframe.focus();
      post({ t: 'command', name });
    };
    teardown = () => {
      if (live) stop();
    };
    el.append(iframe);
    if (!live) return;
    watchdog = win.setTimeout(() => fail('timeout'), c.watchdogMs);
    // Step 8: focus right after insertion; nothing is focused again at ready.
    if (c.focus) iframe.focus();
    // The build is asked for in parallel with the frame's boot, only for a document the gate let Mermaid into.
    if (live && late && c.mermaidSource !== null) {
      if (verdict !== null) answer = verdict;
      else {
        // The hook first, then the ask: a loader that re-enters update() or destroy() stops this mount, which clears it.
        onVerdict = () => {
          answer = verdict;
          deliver();
        };
        askOnce(c.mermaidSource);
      }
    }
  };

  mount(opts['document'] as RenderInput);

  return {
    update(d) {
      if (destroyed) return;
      teardown?.();
      teardown = null;
      sendPrefs = () => undefined;
      sendCommand = () => undefined;
      mount(d);
    },
    setPrefs(p) {
      const checked = prefsOf(p, 'prefs');
      if (destroyed) return;
      seedPrefs = { ...seedPrefs, ...checked };
      sendPrefs(checked);
    },
    command(name) {
      if (typeof name !== 'string' || !(COMMAND_OPS as readonly string[]).includes(name)) {
        throw new TypeError(`docserver host: command name must be one of ${COMMAND_OPS.join(', ')}`);
      }
      if (destroyed) return;
      sendCommand(name);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      teardown?.();
      teardown = null;
      sendPrefs = () => undefined;
      sendCommand = () => undefined;
    },
  };
}
