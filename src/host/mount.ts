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
// The parity additions (docserver parity T2): `onPlace` asks the frame to report its full-screen figure (the seed's `bridge.places`,
// set by that adapter alone) and, with it, `onHash` is handed a second argument, `{ push, from }`; `onPrintFigure` asks
// for print figures (`bridge.printFigures`, by that adapter alone). A run of figures belongs to one `printFigures()` call
// (plan choice B5): the parser refuses a `print-figure` with no open run, and each figure is checked against the run's
// count, its indexes and its byte totals before the adapter sees it; the run ends at the next
// `printFigures()` call and with the mount (not at its last index: a stale figure of a cancelled run, whatever its index, lands in
// the new run and usually costs one refusal when the real copy of that index comes; a stale copy larger than the new one, near the 16 MiB total, can cost one more). `closeOverlay()`, `goto(id, from?)` and `printFigures()` post their command
// after ready and do nothing before it, after destroy() or after a fallback, as `command` does (they move no focus).
//
// Teardown: a fallback clears the timers, closes the port, removes the iframe and calls onFallback once; it never
// remounts. update() is a full remount (new iframe, channel, nonce and watchdog), never a srcdoc reassignment.
// destroy() is idempotent and calls no adapter, also when host code that a mount step runs (a focusout at the focus)
// calls it, or update(), from inside update(). ./host never navigates, opens a window, touches the clipboard or adds
// a window `message` listener (test/host-walls.test.ts scans for each).
//
// Import-inert: no module-level state. Each mount keeps its state in its own closure; two mounts share no port, nonce
// or timer. The DOM is touched only inside mountDocFrame and the DocFrame it returns, through the element's own window.
import { isAnchorToken } from '../frame/anchor.js';
import { frameCsp } from '../frame/csp.js';
import { parseAppearance, type Appearance } from '../enhance/appearance.js';
import { FrameError, fontsOf, frameDocument, type FrameAssets, type FrameErrorCode, type FrameFeatures, type FrameOptions, type RenderInput } from '../frame/document.js';
import { isFragmentId } from '../frame/fragment.js';
import { ITEM_LIMITS, itemsWhy, type ItemLink } from '../frame/items.js';
import { mermaidGate, type MermaidGateCaps } from '../frame/gate.js';
import { FRAME_MANIFEST } from '../frame/manifest.generated.js';
import { BRIDGE_LIMITS, BRIDGE_PROTOCOL, FRAME_PREF_VALUES, isFullSha, type FrameToParent, type PlaceKind } from '../frame/protocol.js';
import { hex, sha256Text } from '../frame/sha256.js';
import type { FramePrefs } from '../frame/wire-types.js';
import { hiddenChars, type HiddenChar } from './copy.js';
import { createLimiter, type Limiter } from './limits.js';
import { classifyLink, type HostLink } from './links.js';
import { parseBridgeMessage, type ParseContext } from './parse.js';
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
  /**
   * The host's appearance (the appearance contract), seeded into every mount: a plain object, taken through
   * parseAppearance, so a bad slot never throws. Any value that is not a plain object is a TypeError.
   */
  readonly appearance?: Appearance;
  /**
   * The comparison base (parity Task 5): the commit the host recorded when the frame asked `changes` for it (a full sha, 40 or 64
   * lower-case hex digits), handed back so the frame asks for it once at its start and shows the comparison as "Changes since"
   * shows one. Seeded into every mount, and used only when `changes` is given. A value that is not a string is a TypeError; a
   * string that is not a full sha is logged once and not seeded (the document still mounts). The host sets it, and nothing else does.
   */
  readonly changesBase?: string;
  /** ./host never navigates or opens a window: the host decides. */
  onLink?(link: HostLink): void;
  /**
   * The frame went to a place of the document. With `onPlace` given (the seed's `bridge.places`) a second argument says how:
   * `push` is true when the move is a new place in the host's history and `from` is the opaque position token the move
   * came from (hand it back to `goto`), or null. Without `onPlace` it is called with the id alone, as before.
   */
  onHash?(id: string, entry?: { readonly push: boolean; readonly from: string | null }): void;
  /** Giving it asks the frame to report its full-screen figure: `'overlay'` when it opened, `'overlay-closed'` when it closed. */
  onPlace?(kind: PlaceKind): void;
  /**
   * Giving it asks the frame for print figures after `DocFrame.printFigures()`: one call per figure, `i` of `n`, `png` the
   * canonical base64 text of the image, at most 1 MiB decoded, and at most 16 MiB together for the run. ./host checks the
   * text and the sizes and never decodes: the host decodes.
   */
  onPrintFigure?(f: { readonly i: number; readonly n: number; readonly png: string }): void;
  /**
   * Resolves the item values a document names into links (parity Task 4). `render()`'s `meta.items` lists them (give render the
   * `reader` option that names the item fields and headings); at each mount this is called, in the host's own code and
   * synchronously, with the document's item values (at most 50, each 1 to 100 code units; not called when there are none), and
   * answers the links: at most 50 `{ value, href }`, `href` an absolute `https:` URL. The frame draws a link for a value the
   * reader asks for that is listed, exactly, and leaves any other as text; a click comes to `onLink` as every link does. A
   * throw is logged and means no links, and so is an answer that is not a list of such links (logged once, naming the
   * entry and field and never the value): no `items` are seeded, the items stay text and the document still mounts.
   * `frameDocument` itself refuses such an `items` as `invalid-input`. The library carries no tracker: the host knows its own.
   */
  items?(values: readonly string[]): readonly ItemLink[] | undefined;
  /** ./host never touches the clipboard: the host writes the text, after showing what `hidden` lists. */
  copy?(text: string, check: { readonly hidden: readonly HiddenChar[] }): void;
  changes?(sha: string): Promise<{ ranges: readonly (readonly [number, number])[]; removedAfter?: readonly number[] } | null>;
  openVersion?(v: { sha?: string; only?: string }): void;
  /**
   * How far the document has been read, a number from 0 to 1 (the frame's thousandths over 1000). The frame sends at most
   * four reports a second, the first at once and the latest of each 250 ms window at its end, so the final value
   * arrives; ./host trusts the frame's pacer and does not throttle (only the bridge's general limits bind a frame that
   * does not keep it). Giving it is what asks the frame to send progress at all (batch 1.1, C108).
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
   * Posts the `appearance` op once ready, else queues it (the latest wins); seeds every later remount. An `a` that is not a
   * plain object throws a TypeError, whatever the state; any plain object is taken through parseAppearance (its verdict is
   * what is posted and seeded), so a bad slot never throws. After a fallback it posts nothing, and its verdict seeds a later
   * update(); after destroy() it does nothing.
   */
  setAppearance(a: Appearance): void;
  /**
   * Runs one of the reader's tools without the reader's own bar, as a toggle (batch 1.1, C108): focuses the iframe, then
   * posts the command. Before the frame is ready, after destroy() and after a fallback it does nothing (it is not
   * queued); a name outside the four throws a TypeError, whatever the state. The wire's other command words are sent only
   * by closeOverlay(), goto() and printFigures().
   */
  command(name: ToolCommand): void;
  /**
   * Closes the full-screen figure, if one is open (needs `onPlace`, else a TypeError, whatever the state). Posted once ready;
   * before it, after destroy() and after a fallback it does nothing.
   */
  closeOverlay(): void;
  /**
   * Takes the reader to the place `id` (a fragment id, by the same grammar the frame's `hash` op carries), optionally from
   * the position token an `onHash` entry gave as `from`. An `id` outside the grammar or a `from` that is not a token
   * throws a TypeError, whatever the state, and so does a host with no `onPlace`; once ready it posts, and before it, after
   * destroy() and after a fallback it does nothing.
   */
  goto(id: string, from?: string): void;
  /**
   * Opens one print run and asks the frame for its figures; they arrive through `onPrintFigure` (needs it, else a
   * TypeError, whatever the state). A second call replaces the run. Before ready, after destroy() and after a fallback it
   * does nothing.
   */
  printFigures(): void;
  /** Idempotent; calls no adapter. */
  destroy(): void;
}

/** The four tools `DocFrame.command` runs: the toggles of the reader's own bar. The wire's other command words have their own methods. */
const TOOL_COMMANDS = Object.freeze(['jump', 'settings', 'contents', 'outline'] as const);
export type ToolCommand = (typeof TOOL_COMMANDS)[number];

/** Every key HostAdapters may hold. */
const ADAPTER_KEYS: readonly string[] = Object.freeze([
  'assets', 'watchdogMs', 'store', 'storePrefix', 'docKey', 'prefs', 'features', 'mermaidGate', 'mermaidDraw', 'title',
  'focus', 'onLink', 'onHash', 'copy', 'changes', 'openVersion', 'onProgress', 'onReady', 'onFallback', 'loadMermaid', 'appearance',
  'onPlace', 'onPrintFigure', 'items', 'changesBase',
]);

/** The callbacks, each a function when given. */
const CALLBACKS = Object.freeze(['onLink', 'onHash', 'copy', 'changes', 'openVersion', 'onProgress', 'onReady', 'onFallback', 'onPlace', 'onPrintFigure', 'items'] as const);
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
  try {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) return false;
    const p: unknown = Object.getPrototypeOf(v);
    return p === Object.prototype || p === null;
  } catch {
    // A Proxy whose trap throws is not a plain object; its own throw never escapes.
    return false;
  }
};

/**
 * What a mount hands frameDocument as `assets`, and whether `fonts` was read for good. Only `fonts` is read here (the review
 * 2906 F3 ruling); every other asset is read live by frameDocument by plain property access, as in 1.1.0 (inherited ones, a
 * later `assets.mermaid` and a throwing Proxy trap included). A host that gives no `fonts` is handed on as it is, so it
 * behaves exactly as in 1.1.0, a class whose getters read a #private field included. A host that gives `fonts` (an own data
 * property: a getter on it, or a malformed shape, is a TypeError, never a fallback) or has one only by inheritance (absent)
 * gets a Proxy over an empty target that answers `fonts` with the checked faces and forwards every other read to the host
 * with the host as the receiver, so its getters see it as `this`. The target is empty so that a frozen host's own `fonts`
 * can never break a Proxy invariant. A value that is not an object is passed through for frameDocument to refuse.
 *
 * `given` is true when the host gave an own `fonts` now (one that holds undefined is none): it was read and checked once, here, at mount, and a later change to
 * it reaches no update(). When it is false the host's object stays live, and update() calls this again on it before it
 * tears anything down, so a `fonts` the host adds later meets the same check, with the same TypeError, thrown by update()
 * with the old mount left as it was.
 */
function assetsOf(assets: unknown): { readonly value: unknown; readonly given: boolean } {
  if (typeof assets !== 'object' || assets === null) return { value: assets, given: false };
  let d: PropertyDescriptor | undefined;
  let inherited = false;
  try {
    d = Object.getOwnPropertyDescriptor(assets, 'fonts');
    inherited = d === undefined && 'fonts' in assets;
  } catch {
    // A Proxy whose trap throws: nothing is read here; frameDocument reads it and the throw becomes a fallback, as in 1.1.0.
    return { value: assets, given: false };
  }
  if (d === undefined && !inherited) return { value: assets, given: false };
  let faces: ReturnType<typeof fontsOf>;
  if (d !== undefined) {
    if (!('value' in d)) throw new TypeError('pinax-lib host: assets.fonts must be a plain value, not a getter');
    try {
      faces = fontsOf(d.value);
    } catch (e) {
      if (e instanceof TypeError) throw e;
      throw new TypeError('pinax-lib host: assets.fonts could not be read');
    }
  }
  const host = assets;
  return { value: new Proxy({}, { get: (_t, key) => (key === 'fonts' ? faces : Reflect.get(host, key, host)) }), given: d !== undefined && d.value !== undefined };
}

/** The own data properties of `v` as a record: an unknown key or a getter (unread) is a TypeError; undefined is absent. */
function ownData(v: unknown, where: string, allowed: readonly string[]): Record<string, unknown> {
  if (typeof v !== 'object' || v === null) throw new TypeError(`pinax-lib host: ${where} must be an object`);
  const out: Record<string, unknown> = {};
  for (const k of Reflect.ownKeys(v)) {
    if (typeof k !== 'string' || !allowed.includes(k)) throw new TypeError(`pinax-lib host: ${where} has an unknown key ${String(k)}`);
    const d = Object.getOwnPropertyDescriptor(v, k);
    if (d === undefined) continue;
    if (!('value' in d)) throw new TypeError(`pinax-lib host: ${where}.${k} must be a plain value, not a getter`);
    if (d.value !== undefined) out[k] = d.value as unknown;
  }
  return out;
}

/** Prefs: theme, width and font, each one of its values. */
function prefsOf(p: unknown, where: string): Partial<FramePrefs> {
  if (!isPlain(p)) throw new TypeError(`pinax-lib host: ${where} must be a plain object`);
  const f = ownData(p, where, Object.keys(FRAME_PREF_VALUES));
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(f)) {
    const values = (FRAME_PREF_VALUES as Readonly<Record<string, readonly string[]>>)[k] ?? [];
    if (typeof v !== 'string') throw new TypeError(`pinax-lib host: ${where}.${k} must be a string`);
    if (!values.includes(v)) throw new RangeError(`pinax-lib host: ${where}.${k} must be one of ${values.join(', ')}`);
    out[k] = v;
  }
  return out as Partial<FramePrefs>;
}

/** The checked adapters (step 1). */
interface Checked {
  readonly raw: object;
  /** The adapters' own `assets`, as given: the live object a later update() reads again when no `fonts` was given at mount. */
  readonly rawAssets: unknown;
  /** What the first mount hands frameDocument (see assetsOf). */
  readonly assets: unknown;
  /** True when an own `fonts` was read at mount: it is then fixed for the DocFrame's life. */
  readonly fontsGiven: boolean;
  readonly watchdogMs: number;
  readonly store: HostStore | null;
  readonly prefs: Partial<FramePrefs>;
  /** The verdict of the adapters' `appearance`; undefined when none was given. */
  readonly appearance: Appearance | undefined;
  /** The seeded comparison base: a full sha; undefined when none was given or the one given is not a full sha. */
  readonly changesBase: string | undefined;
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
    if (typeof fn !== 'function') throw new TypeError(`pinax-lib host: adapters.${name} must be a function`);
    callbacks[name] = fn as (...args: never[]) => unknown;
  }
  if (callbacks.onFallback === undefined) throw new TypeError('pinax-lib host: adapters.onFallback is required');
  const w = a['watchdogMs'];
  if (typeof w !== 'number') throw new TypeError('pinax-lib host: adapters.watchdogMs must be a number');
  if (!Number.isInteger(w) || w < 1 || w > WATCHDOG_MAX_MS) throw new RangeError(`pinax-lib host: adapters.watchdogMs must be an integer from 1 to ${String(WATCHDOG_MAX_MS)}`);
  const draw = a['mermaidDraw'] ?? 'auto';
  if (typeof draw !== 'string') throw new TypeError('pinax-lib host: adapters.mermaidDraw must be a string');
  if (!MERMAID_DRAW.includes(draw)) throw new RangeError(`pinax-lib host: adapters.mermaidDraw must be one of ${MERMAID_DRAW.join(', ')}`);
  const loader = a['loadMermaid'];
  let mermaidSource: Checked['mermaidSource'] = null;
  if (draw === 'after-ready') {
    // A source is required: the loader, else the Mermaid text among the assets (read as an own data property); when both
    // are given the loader is used. In any other mode `loadMermaid` is ignored, whatever it holds, and never called.
    if (loader !== undefined && typeof loader !== 'function') throw new TypeError('pinax-lib host: adapters.loadMermaid must be a function');
    const given: unknown = isPlain(a['assets']) ? Object.getOwnPropertyDescriptor(a['assets'], 'mermaid')?.value : undefined;
    if (typeof loader === 'function') mermaidSource = loader as () => unknown;
    else if (typeof given === 'string') mermaidSource = given;
    else throw new TypeError("pinax-lib host: mermaidDraw 'after-ready' needs adapters.loadMermaid or adapters.assets.mermaid");
  }
  const gate = a['mermaidGate'] ?? {};
  if (!isPlain(gate)) throw new TypeError('pinax-lib host: adapters.mermaidGate must be a plain object');
  // The gate checks its caps itself (TypeError, RangeError: caps only tighten); a document with no fence asks it now.
  mermaidGate({ fences: 0, largestChars: 0, totalChars: 0 }, gate);
  const title = a['title'] ?? DEFAULT_TITLE;
  if (typeof title !== 'string') throw new TypeError('pinax-lib host: adapters.title must be a string');
  if (title.length < 1 || title.length > TITLE_MAX) throw new RangeError(`pinax-lib host: adapters.title must be 1 to ${String(TITLE_MAX)} code units`);
  const focus = a['focus'] ?? true;
  if (typeof focus !== 'boolean') throw new TypeError('pinax-lib host: adapters.focus must be a boolean');
  const prefs = a['prefs'] === undefined ? {} : prefsOf(a['prefs'], 'adapters.prefs');
  let appearance: Appearance | undefined;
  if (a['appearance'] !== undefined) {
    if (!isPlain(a['appearance'])) throw new TypeError('pinax-lib host: adapters.appearance must be a plain object');
    appearance = parseAppearance(a['appearance']).appearance;
  }
  const base = a['changesBase'];
  if (base !== undefined && typeof base !== 'string') throw new TypeError('pinax-lib host: adapters.changesBase must be a string');
  if (base !== undefined && !isFullSha(base)) console.warn('pinax-lib host: adapters.changesBase is not a full sha (40 or 64 lower-case hex digits), so no comparison is seeded');
  // A malformed `fonts` is a host's programming error: it throws here, at mount time, and never as a fallback.
  const checkedAssets = assetsOf(a['assets']);
  let store: HostStore | null = null;
  const s = a['store'];
  if (s !== undefined) {
    if (typeof s !== 'object' || s === null) throw new TypeError('pinax-lib host: adapters.store must be an object');
    for (const m of ['getItem', 'setItem', 'removeItem', 'key'] as const) {
      if (typeof (s as Record<string, unknown>)[m] !== 'function') throw new TypeError(`pinax-lib host: adapters.store.${m} must be a function`);
    }
    store = createHostStore(s as HostStorage, a['storePrefix'] as string | undefined, a['docKey'] as string | undefined);
  } else {
    if (a['storePrefix'] !== undefined && typeof a['storePrefix'] !== 'string') throw new TypeError('pinax-lib host: adapters.storePrefix must be a string');
    if (a['docKey'] !== undefined && typeof a['docKey'] !== 'string') throw new TypeError('pinax-lib host: adapters.docKey must be a string');
  }
  return { raw: adapters as object, rawAssets: a['assets'], assets: checkedAssets.value, fontsGiven: checkedAssets.given, watchdogMs: w, store, prefs, appearance, changesBase: base !== undefined && isFullSha(base) ? base : undefined, features: a['features'], gate: gate as MermaidGateCaps, draw: draw as Checked['draw'], mermaidSource, title, focus, callbacks };
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
    throw new TypeError('pinax-lib host: mountDocFrame needs an element of a document that has a window');
  }
  return win as HostWindow;
}

/** The item values a document names, as `render()` listed them: the strings of `meta.items` of 1 to 100 code units, at most 50; read through own data only, never throwing. */
function itemValues(d: unknown): readonly string[] {
  try {
    const meta: unknown = isPlain(d) ? Object.getOwnPropertyDescriptor(Object.getOwnPropertyDescriptor(d, 'result')?.value as object, 'meta')?.value : undefined;
    const list: unknown = isPlain(meta) ? Object.getOwnPropertyDescriptor(meta, 'items')?.value : undefined;
    if (!Array.isArray(list)) return [];
    const out: string[] = [];
    for (let i = 0; i < list.length && out.length < ITEM_LIMITS.max; i += 1) {
      const v: unknown = Object.getOwnPropertyDescriptor(list, String(i))?.value;
      if (typeof v === 'string' && v.length >= 1 && v.length <= ITEM_LIMITS.valueMax) out.push(v);
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * The links the `items` adapter answered, copied as plain data and judged in full (src/frame/items.ts), or why not. The answer is
 * untrusted: a getter is never called, and a value is never repeated in the reason. `undefined` and an empty list are no links.
 */
function itemLinksOf(answer: unknown): { readonly links: readonly ItemLink[] | undefined } | { readonly why: string } {
  if (answer === undefined) return { links: undefined };
  const data = (o: object, k: string): unknown => {
    const d = Object.getOwnPropertyDescriptor(o, k);
    return d !== undefined && 'value' in d ? (d.value as unknown) : undefined;
  };
  try {
    if (!Array.isArray(answer)) return { why: 'items must be a list' };
    if (answer.length > ITEM_LIMITS.max) return { why: `items has more than ${String(ITEM_LIMITS.max)} entries` };
    const copy: unknown[] = [];
    for (let i = 0; i < answer.length; i += 1) {
      const e = data(answer, String(i));
      const names = isPlain(e) ? Object.getOwnPropertyNames(e) : [];
      copy.push(isPlain(e) && names.length === 2 && names.includes('value') && names.includes('href') ? { value: data(e, 'value'), href: data(e, 'href') } : null);
    }
    const why = itemsWhy(copy);
    if (why !== null) return { why };
    return { links: copy.length === 0 ? undefined : (copy as ItemLink[]) };
  } catch {
    return { why: 'items could not be read' };
  }
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
      console.warn('pinax-lib host: an adapter threw', name, e);
      return undefined;
    }
  };

  /** The prefs every mount seeds: the adapters' own, then each setPrefs on top. */
  let seedPrefs: Partial<FramePrefs> = { ...c.prefs };
  /** The verdict every mount seeds: the adapters', then each setAppearance on top (the latest). */
  let seedAppearance: Appearance | undefined = c.appearance;
  /** What every mount hands frameDocument as `assets`: the first mount's, and an update()'s when it read the live object again. */
  let assets: unknown = c.assets;
  let destroyed = false;
  /** Tears the current mount down without a fallback (update, destroy); null when nothing is mounted. */
  let teardown: (() => void) | null = null;
  /** Posts prefs on the current mount's port (now or at its ready). */
  let sendPrefs: (p: Partial<FramePrefs>) => void = () => undefined;
  /** Posts an appearance verdict on the current mount's port (now or at its ready). */
  let sendAppearance: (a: Appearance) => void = () => undefined;
  /** Focuses the current mount's iframe and posts a command on its port; nothing before its ready or once it is gone. */
  let sendCommand: (name: ToolCommand) => void = () => undefined;
  /** Posts a command that moves no focus (close-overlay, goto) on the current mount's port, once it is ready. */
  let sendWire: (m: Record<string, string>) => void = () => undefined;
  /** Opens a print run on the current mount and posts print-figures, once it is ready. */
  let sendPrintFigures: () => void = () => undefined;

  /** What every 'after-ready' mount of this DocFrame posts: the build, or that there is none. */
  type Build = { readonly text: string } | { readonly unavailable: true };
  const noop = (): void => undefined;

  /** The one answer, never a rejection: the source is untrusted host code, and nothing it does may escape. */
  const ask = (source: NonNullable<Checked['mermaidSource']>): Promise<Build> => {
    // One warning, a fixed reason and never the loader's own value: formatting a hostile value could throw, and so
    // could a console, so the call is contained too.
    const none = (reason: string): Build => {
      try {
        console.warn('pinax-lib host: the Mermaid build is unavailable', reason);
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

  /** Asked for by giving onPlace, and by nothing else: it also gates a hash's `push` and `from`, and onHash's second argument. */
  const places = c.callbacks.onPlace !== undefined;

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
      const values = c.callbacks.items === undefined ? [] : itemValues(d);
      // The resolver's answer is judged here: one it cannot use is no links (one warning), as a throwing resolver is, and the
      // document still mounts (frameDocument itself refuses a bad `items`, a direct caller's programming error).
      const answered = itemLinksOf(values.length === 0 ? undefined : call('items', Object.freeze([...values])));
      if ('why' in answered) console.warn('pinax-lib host: the items adapter answered links the frame refuses, so none are seeded:', answered.why);
      const links = 'links' in answered ? answered.links : undefined;
      const frameOptions: FrameOptions = {
        csp: policy,
        nonce,
        assets: assets as FrameAssets,
        prefs: seedPrefs,
        ...(seedAppearance === undefined ? {} : { appearance: seedAppearance }),
        ...(c.store === null ? {} : { snapshot: c.store.snapshot() }),
        mermaid: gated !== null && gated.inline ? { maxTextSize: gated.maxTextSize, draw: c.draw } : null,
        ...(c.features === undefined ? {} : { features: c.features as FrameFeatures }),
        ...(links === undefined ? {} : { items: links as NonNullable<FrameOptions['items']> }),
        ...(c.changesBase === undefined ? {} : { changesBase: c.changesBase }),
        bridge: {
          links: c.callbacks.onLink !== undefined,
          hash: c.callbacks.onHash !== undefined,
          copy: c.callbacks.copy !== undefined,
          changes: c.callbacks.changes !== undefined,
          versions: c.callbacks.openVersion !== undefined,
          // Asked for by giving onProgress, and by nothing else: a frame is never sent a progress nobody listens to.
          progress: c.callbacks.onProgress !== undefined,
          // Likewise: places by onPlace alone, print figures by onPrintFigure alone.
          places,
          printFigures: c.callbacks.onPrintFigure !== undefined,
        },
      };
      page = frameDocument(d, frameOptions);
    } catch (e) {
      const code: FrameErrorCode = e instanceof FrameError ? e.code : 'invalid-input';
      if (INTERNAL.includes(code)) console.warn('pinax-lib host: internal', code);
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
    /** The open print run of this mount (B5); null when none is open. */
    let run: { n: number | null; readonly seen: Set<number>; bytes: number } | null = null;
    /** What the figure in hand decodes to, as the parser read it: set before the limiter, read by its one effect. */
    let figureBytes = 0;
    let pending: Partial<FramePrefs> | null = null;
    let pendingAppearance: Appearance | null = null;
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
          console.warn('pinax-lib host: the Mermaid build could not be posted');
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
        console.warn('pinax-lib host: an adapter threw', 'changes', e);
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
          // The entry only under bridge.places: a 1.1-shaped host's onHash is called with the id alone.
          if (places) call('onHash', msg.id, Object.freeze({ push: msg.push === 'true', from: msg.from ?? null }));
          else call('onHash', msg.id);
          return;
        case 'place':
          call('onPlace', msg.kind);
          return;
        case 'print-figure': {
          // The run is updated before the adapter is called, so a host that calls printFigures() from it opens a fresh run.
          const i = Number(msg.i);
          const n = Number(msg.n);
          if (run !== null) {
            run.n = n;
            run.seen.add(i);
            run.bytes += figureBytes;
          }
          call('onPrintFigure', Object.freeze({ i, n, png: msg.png }));
          return;
        }
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
      // The queued values go first, so a setPrefs or setAppearance made inside the host's onReady is posted after them and wins.
      if (pending !== null) {
        post({ t: 'prefs', ...pending });
        pending = null;
      }
      if (pendingAppearance !== null) {
        post({ t: 'appearance', v: 1, appearance: pendingAppearance });
        pendingAppearance = null;
      }
      call('onReady');
      deliver();
    };

    port.onmessage = (e: MessageEvent): void => {
      if (!live) return;
      const context: ParseContext = { places, run };
      const parsed = parseBridgeMessage(e.data, e.ports, nonce, context);
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
      figureBytes = parsed.bytes ?? 0;
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
    sendAppearance = (a) => {
      if (!live) return;
      if (ready) post({ t: 'appearance', v: 1, appearance: a });
      else pendingAppearance = a;
    };
    sendCommand = (name) => {
      if (!live || !ready) return;
      // The focus first, so the keys the tool uses reach the frame; it runs host code (a blur or focusout handler),
      // which may destroy or update this mount, and `post` then drops the command.
      iframe.focus();
      post({ t: 'command', name });
    };
    sendWire = (m) => {
      if (!live || !ready) return;
      post({ t: 'command', ...m });
    };
    sendPrintFigures = () => {
      if (!live || !ready) return;
      run = { n: null, seen: new Set<number>(), bytes: 0 };
      post({ t: 'command', name: 'print-figures' });
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
      // A host that gave no `fonts` at mount keeps a live `assets`: read it again first, so that a malformed `fonts` it has
      // added since is a TypeError from here, the same kind as at mount, with the current mount left as it is.
      if (!c.fontsGiven) assets = assetsOf(c.rawAssets).value;
      teardown?.();
      teardown = null;
      sendPrefs = () => undefined;
      sendAppearance = () => undefined;
      sendCommand = () => undefined;
      sendWire = () => undefined;
      sendPrintFigures = () => undefined;
      mount(d);
    },
    setPrefs(p) {
      const checked = prefsOf(p, 'prefs');
      if (destroyed) return;
      seedPrefs = { ...seedPrefs, ...checked };
      sendPrefs(checked);
    },
    setAppearance(a) {
      if (!isPlain(a)) throw new TypeError('pinax-lib host: appearance must be a plain object');
      if (destroyed) return;
      const verdict = parseAppearance(a).appearance;
      seedAppearance = verdict;
      sendAppearance(verdict);
    },
    command(name) {
      if (typeof name !== 'string' || !(TOOL_COMMANDS as readonly string[]).includes(name)) {
        throw new TypeError(`pinax-lib host: command name must be one of ${TOOL_COMMANDS.join(', ')}`);
      }
      if (destroyed) return;
      sendCommand(name);
    },
    closeOverlay() {
      if (!places) throw new TypeError('pinax-lib host: closeOverlay needs adapters.onPlace');
      if (destroyed) return;
      sendWire({ name: 'close-overlay' });
    },
    goto(id, from) {
      if (typeof id !== 'string' || !isFragmentId(id)) throw new TypeError('pinax-lib host: goto needs an id inside the fragment grammar');
      if (from !== undefined && !isAnchorToken(from)) throw new TypeError('pinax-lib host: goto\'s from must be a position token');
      if (!places) throw new TypeError('pinax-lib host: goto needs adapters.onPlace');
      if (destroyed) return;
      sendWire(from === undefined ? { name: 'goto', id } : { name: 'goto', id, from });
    },
    printFigures() {
      if (c.callbacks.onPrintFigure === undefined) throw new TypeError('pinax-lib host: printFigures needs adapters.onPrintFigure');
      if (destroyed) return;
      sendPrintFigures();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      teardown?.();
      teardown = null;
      sendPrefs = () => undefined;
      sendAppearance = () => undefined;
      sendCommand = () => undefined;
      sendWire = () => undefined;
      sendPrintFigures = () => undefined;
    },
  };
}
