// The bootstrap of the sealed reader frame, built to assets/frame/bootstrap.js (docserver L3; plan Reference §5.2, §5.5,
// §6 and §8). The third script of the srcdoc, right after the guard and the seed.
//
// Phase S, synchronous, at parse time, while no authored node exists:
//   1. Capture every built-in it uses (content.ts's through contentIntrinsics()), then locate by position: its own
//      script element, the seed just before it, the guard just before that, and the policy meta first of all. Never by
//      id or selector, so no authored id can stand in for any of them.
//   2. Parse and validate the seed (src/frame/seed.ts). An unreadable nonce stops it silently (no nonce, no ready: the
//      parent's watchdog decides); any other fault is FAILED('boot'). Then the seed's text is dropped.
//   3. Self-checks, failing closed into FAILED('boot'): (a) an opaque origin, (b) the policy meta first in the document
//      with a policy that passes the floor (src/frame/csp-rules.ts), (c) a parent that is not itself, and (d) the guard
//      ran: Event.prototype.stopPropagation is no longer native, read through the captured Function.prototype.toString
//      (a host policy that blocks the guard's hash alone is caught here).
//   4. Pin the free globals (pin.ts): every name of the build's DOCSERVER_FREE_GLOBALS list becomes an own,
//      non-writable property of the global, so no element id can shadow what the frame's scripts read. A global that
//      refuses a pin is FAILED('boot').
//   5. Listeners: `docserver:register` in the capture phase on the document (accepted only from the script element at
//      the expected position), `docserver:link` on the guard's element, DOMContentLoaded once, one window `message`
//      listener for hello, and a capture-phase `securitypolicyviolation` listener on the document: any violation before
//      ready is FAILED('boot') (an inherited host policy that blocks the inline style, a data: font or a data: image
//      ends the frame rather than leaving it partly working; ruling R7). A blocked inline script is the one exception:
//      it is reported by the check that owns it, the registration check (enhance, Mermaid) or self-check (d) (the
//      guard), each with its own reason.
//
// At DOMContentLoaded: the register listener goes; with no enhance registered (the browser refused its script: hash
// drift) the frame is FAILED('assets'), and a seed that asks for Mermaid without a registered Mermaid API holding
// initialize and render (the functions the reader calls, ledger C95(1)) is FAILED('mermaid'). Otherwise the seed's
// html is materialised (content.ts: an inert parse, the closed vocabulary check, the image rewrite) into an `article`
// root appended to the body, and enhance() runs on it with the frame's adapters (adapters.ts: the enhance callbacks
// over the outbox, each only when the seed's bridge allows its op). A refusal of the content, enhance's rejection, or
// a throw, is FAILED('render'). Enhance's `mermaid` option carries the seed's caps, secure keys and `draw`
// (adapters.ts, enhanceMermaid). In 'auto' Mermaid mode, ready then waits until the root's `data-docreader-diagrams`
// leaves `drawing` (a failed or partial drawing is not an error);
// in 'on-request' mode nothing draws before ready, so it does not wait (waitsForDrawing; FD13); instead it asks for
// inline style itself (styles.ts, probesInlineStyle), as a drawing will on a tap, so an inherited policy that blocks it
// raises its violation before ready (fix round, review S1; Reference §11.5, ruling R7). Then the face probe (fonts.ts):
// each face of the frame's font set is loaded once, bounded by 1500 ms, so a data: font an inherited policy blocks
// raises its violation before ready. One more task, then the style probe's element comes out, and SETTLED.
//
// Hello: accepted only from the parent window, as a plain object with exactly {t, v}, t 'hello', v an integer of at
// least 1, carrying exactly one port. Anything else is ignored and the listener stays; on acceptance the listener goes,
// so the frame has no window listener after it. The port lives only in this closure.
//
// maybeReady, exactly once, when the port is held and the state is SETTLED or FAILED: ready{v:1,nonce} first, then
// either the outbox opens (every op queued before ready flushes through its pacer, outbox.ts), or error{why}, the
// enhancement's teardown and the port's close. Ready always comes first: the parent drops every op before a valid
// ready, so an error sent first would be lost.
//
// On the port (inbound.ts; anything malformed is ignored): `prefs` goes to setEnhancementPrefs, and `changes.result`
// to the outbox's changes slot, which hands it to L2's `changes` callback (L2's readChangeSet checks it again).
import { cspFloor } from '../frame/csp-rules.js';
import { BRIDGE_LIMITS, type ErrorWhy } from '../frame/protocol.js';
import { validateSeed, type Seed } from '../frame/seed.js';
import { createAdapters, enhanceMermaid, FRAME_DOC_KEY, FRAME_NAMESPACE, probesInlineStyle, waitsForDrawing } from './adapters.js';
import { contentIntrinsics, materialise } from './content.js';
import { FACES, FONT_WAIT_MS, probeFaces } from './fonts.js';
import { parseParentMessage } from './inbound.js';
import { createOutbox } from './outbox.js';
import { pinFreeGlobals } from './pin.js';
import { probeInlineStyle, styleIntrinsics } from './styles.js';

/** The names the frame's bundled scripts read freely from the global: the build's scan (Task 6), a JSON array literal. */
declare const DOCSERVER_FREE_GLOBALS: readonly string[];

/** What enhance-entry.ts registers. */
interface EnhanceApi {
  enhance(root: HTMLElement, options: unknown): Promise<void>;
  destroyEnhancement(root: HTMLElement): unknown;
  setEnhancementPrefs(root: HTMLElement, prefs: unknown): void;
}

(() => {
  // 1. Capture.
  const bs = document.currentScript;
  const doc = document;
  const win = window;
  const parentWin = win.parent;
  const origin = win.origin;
  const parse = JSON.parse;
  const getProto = Object.getPrototypeOf;
  const keys = Object.keys;
  const isInteger = Number.isInteger;
  const ObjectProto = Object.prototype;
  const add = EventTarget.prototype.addEventListener;
  const remove = EventTarget.prototype.removeEventListener;
  const get = <T>(proto: object, name: string): ((this: unknown) => T) => {
    const g = Object.getOwnPropertyDescriptor(proto, name)?.get;
    if (g === undefined) throw new Error(`docserver frame: no ${name}`);
    return g as (this: unknown) => T;
  };
  const prevSibling = get<Element | null>(Element.prototype, 'previousElementSibling');
  const nextSibling = get<Element | null>(Element.prototype, 'nextElementSibling');
  const localName = get<string>(Element.prototype, 'localName');
  const parentElement = get<Element | null>(Node.prototype, 'parentElement');
  const firstElement = get<Element | null>(Element.prototype, 'firstElementChild');
  const getAttribute = Element.prototype.getAttribute;
  const hasAttribute = Element.prototype.hasAttribute;
  const textOf = get<string | null>(Node.prototype, 'textContent');
  const setText = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent')?.set;
  const target = get<EventTarget | null>(Event.prototype, 'target');
  const detailOf = get<unknown>(CustomEvent.prototype, 'detail');
  const dataOf = get<unknown>(MessageEvent.prototype, 'data');
  const sourceOf = get<unknown>(MessageEvent.prototype, 'source');
  const portsOf = get<readonly MessagePort[]>(MessageEvent.prototype, 'ports');
  const postMessage = MessagePort.prototype.postMessage;
  const closePort = MessagePort.prototype.close;
  const startPort = MessagePort.prototype.start;
  const content = contentIntrinsics();
  const styles = styleIntrinsics();
  const Observer = MutationObserver;
  const documentElement = get<Element | null>(Document.prototype, 'documentElement');
  const fnToString = Function.prototype.toString;
  const stopPropagation = Event.prototype.stopPropagation;
  const violationProto = typeof SecurityPolicyViolationEvent === 'undefined' ? undefined : SecurityPolicyViolationEvent.prototype;
  const directiveOf = violationProto === undefined ? undefined : Object.getOwnPropertyDescriptor(violationProto, 'effectiveDirective')?.get;
  const blockedOf = violationProto === undefined ? undefined : Object.getOwnPropertyDescriptor(violationProto, 'blockedURI')?.get;
  const fontsOf = Object.getOwnPropertyDescriptor(Document.prototype, 'fonts')?.get;
  const loadFaces = typeof FontFaceSet === 'undefined' ? undefined : FontFaceSet.prototype.load;
  const later = setTimeout;
  const cancel = clearTimeout;
  // The outbox paces by a monotonic clock: a wall clock stepped back would hold the pacer for the size of the step,
  // and one stepped forward would forget the sends it must still count.
  const perf = performance;
  const perfNow = Performance.prototype.now;

  if (bs === null) return;
  const seedEl = prevSibling.call(bs);
  if (seedEl === null || localName.call(seedEl) !== 'script' || getAttribute.call(seedEl, 'type') !== 'application/json') return;
  const guardEl = prevSibling.call(seedEl);
  if (guardEl === null || localName.call(guardEl) !== 'script' || hasAttribute.call(guardEl, 'type')) return;

  // 2. Parse and validate.
  let raw: unknown;
  try {
    raw = parse(textOf.call(seedEl) ?? '');
  } catch {
    return;
  }
  const check = validateSeed(raw);
  if (!check.ok && check.nonce === null) return;
  const nonce: string = check.ok ? check.seed.nonce : (check.nonce as string);
  setText?.call(seedEl, '');

  type State = 'boot' | 'settled' | 'failed';
  let state: State = 'boot';
  let why: ErrorWhy = 'boot';
  let port: MessagePort | null = null;
  let mismatch = false;
  let done = false;
  let root: HTMLElement | null = null;
  let api: EnhanceApi | null = null;
  let mermaidApi: Record<string, unknown> | null = null;
  let link: (href: string) => void = () => undefined;

  const post = (m: unknown): void => {
    if (port !== null) postMessage.call(port, m);
  };
  const outbox = createOutbox({
    clock: { now: () => perfNow.call(perf), setTimeout: (fn, ms) => later(fn, ms), clearTimeout: (h) => cancel(h as number) },
    post,
    limits: BRIDGE_LIMITS,
  });

  const maybeReady = (): void => {
    if (done || port === null || state === 'boot') return;
    done = true;
    post({ t: 'ready', v: 1, nonce });
    if (state === 'failed' || mismatch) {
      post({ t: 'error', why: mismatch ? 'protocol' : why });
      outbox.dispose();
      if (root !== null && api !== null) {
        try {
          void Promise.resolve(api.destroyEnhancement(root)).then(undefined, () => undefined);
        } catch {
          // nothing more to undo
        }
      }
      closePort.call(port);
      return;
    }
    outbox.open();
  };

  const fail = (w: ErrorWhy): void => {
    if (state === 'failed') return;
    state = 'failed';
    why = w;
    maybeReady();
  };

  /** One message on the port, once ready: prefs to the reader, a changes answer to the outbox. */
  const onPortMessage = (e: Event): void => {
    if (state !== 'settled' || mismatch) return;
    const m = parseParentMessage(dataOf.call(e));
    if (m === null) return;
    if (m.t === 'changes.result') {
      outbox.answer(m);
    } else if (m.t === 'prefs' && root !== null && api !== null) {
      const { t: _t, ...prefs } = m;
      try {
        api.setEnhancementPrefs(root, prefs);
      } catch {
        // a refused change leaves the prefs as they were
      }
    }
  };

  // 5 (first). The hello listener and the guard's link listener, installed even on a failed boot, so the failure can
  // be reported.
  const isPlain = (v: unknown): v is Record<string, unknown> => {
    if (typeof v !== 'object' || v === null) return false;
    const p: unknown = getProto(v);
    return p === ObjectProto || p === null;
  };
  const onMessage = (e: Event): void => {
    if (sourceOf.call(e) !== parentWin) return;
    const d = dataOf.call(e);
    if (!isPlain(d)) return;
    const k = keys(d);
    if (k.length !== 2 || !k.includes('t') || !k.includes('v')) return;
    if (d['t'] !== 'hello' || typeof d['v'] !== 'number' || !isInteger(d['v']) || d['v'] < 1) return;
    const ports = portsOf.call(e);
    if (ports.length !== 1) return;
    const p = ports[0];
    if (p === undefined) return;
    remove.call(win, 'message', onMessage, false);
    port = p;
    p.onmessage = onPortMessage;
    p.onmessageerror = (): void => {};
    startPort.call(p);
    if (d['v'] !== 1) mismatch = true;
    maybeReady();
  };
  add.call(win, 'message', onMessage, false);
  add.call(guardEl, 'docserver:link', (e: Event) => {
    const d = detailOf.call(e);
    if (isPlain(d) && typeof d['href'] === 'string') link(d['href']);
  });

  if (!check.ok) {
    fail('boot');
    return;
  }
  const seed: Seed = check.seed;

  // 3. Self-checks. 4. The pin.
  try {
    const meta = prevSibling.call(guardEl);
    const head = parentElement.call(guardEl);
    const html = documentElement.call(doc);
    const ok =
      origin === 'null' &&
      parentWin !== win &&
      meta !== null &&
      localName.call(meta) === 'meta' &&
      prevSibling.call(meta) === null &&
      (getAttribute.call(meta, 'http-equiv') ?? '').toLowerCase() === 'content-security-policy' &&
      cspFloor(getAttribute.call(meta, 'content') ?? '').ok &&
      head !== null &&
      html !== null &&
      firstElement.call(html) === head &&
      fnToString.call(stopPropagation).indexOf('[native code]') === -1;
    if (!ok) {
      fail('boot');
      return;
    }
    pinFreeGlobals(win, DOCSERVER_FREE_GLOBALS);
  } catch {
    fail('boot');
    return;
  }

  const adapters = createAdapters(outbox, seed);
  link = adapters.link;

  // 5. Registration, by position: enhance is the script right after the style that follows this script, and Mermaid
  // (only when the seed asks for it) the script right after enhance's.
  const onRegister = (e: Event): void => {
    const style = nextSibling.call(bs);
    if (style === null || localName.call(style) !== 'style') return;
    const enhanceEl = nextSibling.call(style);
    const from = target.call(e);
    const d = detailOf.call(e);
    if (!isPlain(d)) return;
    if (d['name'] === 'enhance' && from === enhanceEl && api === null) {
      const a = d['api'];
      if (!isPlain(a) || typeof a['enhance'] !== 'function' || typeof a['destroyEnhancement'] !== 'function' || typeof a['setEnhancementPrefs'] !== 'function') return;
      api = a as unknown as EnhanceApi;
    } else if (d['name'] === 'mermaid' && seed.mermaid !== null && enhanceEl !== null && from === nextSibling.call(enhanceEl) && mermaidApi === null) {
      const m = d['api'];
      if (typeof m === 'object' && m !== null) mermaidApi = m as Record<string, unknown>;
    }
  };

  /** Resolve once the root's diagrams are no longer being drawn (L2 sets the state before enhance() resolves). */
  const diagramsSettled = (r: HTMLElement): Promise<void> =>
    new Promise((resolve) => {
      const drawing = (): boolean => getAttribute.call(r, 'data-docreader-diagrams') === 'drawing';
      if (!drawing()) {
        resolve();
        return;
      }
      const mo = new Observer(() => {
        if (drawing()) return;
        mo.disconnect();
        resolve();
      });
      mo.observe(r, { attributes: true, attributeFilter: ['data-docreader-diagrams'] });
    });
  add.call(doc, 'docserver:register', onRegister, true);

  // 5 (last). Any violation before ready ends the boot, except a blocked inline script (see the header).
  const onViolation = (e: Event): void => {
    if (done) return;
    const directive: unknown = directiveOf?.call(e);
    const blocked: unknown = blockedOf?.call(e);
    if ((directive === 'script-src-elem' || directive === 'script-src') && (blocked === 'inline' || blocked === '')) return;
    fail('boot');
  };
  add.call(doc, 'securitypolicyviolation', onViolation, true);

  const start = async (): Promise<void> => {
    remove.call(doc, 'docserver:register', onRegister, true);
    if (state !== 'boot') return;
    const enhanceApi = api;
    if (enhanceApi === null) {
      fail('assets');
      return;
    }
    const mermaidModule = mermaidApi;
    if (seed.mermaid !== null) {
      if (mermaidModule === null) {
        fail('mermaid');
        return;
      }
      if (typeof mermaidModule['initialize'] !== 'function' || typeof mermaidModule['render'] !== 'function') {
        fail('mermaid');
        return;
      }
    }
    try {
      root = materialise(doc, seed.html, seed.lang, new Map(seed.images), content);
      const v = seed.version;
      await enhanceApi.enhance(root, {
        prefs: seed.prefs,
        storage: adapters.storage,
        namespace: FRAME_NAMESPACE,
        storageKey: FRAME_DOC_KEY,
        posKey: FRAME_DOC_KEY,
        info: { title: seed.title, frontList: seed.frontList, sha: v.sha, draft: v.draft, commits: v.commits, only: v.only },
        initialHash: seed.initialHash,
        ...seed.features,
        ...(adapters.onLink === undefined ? {} : { onLink: adapters.onLink }),
        ...(adapters.onHash === undefined ? {} : { onHash: adapters.onHash }),
        ...(adapters.copy === undefined ? {} : { copy: adapters.copy }),
        ...(adapters.changes === undefined ? {} : { changes: adapters.changes }),
        ...(adapters.openVersion === undefined ? {} : { openVersion: adapters.openVersion }),
        // The seed's caps, secure keys and `draw`, passed through (Task 16).
        ...(seed.mermaid === null || mermaidModule === null ? {} : { mermaid: enhanceMermaid(seed.mermaid, mermaidModule) }),
      });
      // 'auto': ready waits for the first full pass. 'on-request': nothing draws before ready, so nothing to wait for.
      if (waitsForDrawing(seed.mermaid)) await diagramsSettled(root);
    } catch {
      fail('render');
      return;
    }
    if (state !== 'boot') return;
    // On request, a drawing first asks for inline style on a tap, after ready: ask for it now (styles.ts).
    const unprobe = probesInlineStyle(seed.mermaid) ? probeInlineStyle(doc, styles) : null;
    const set = fontsOf?.call(doc) as FontFaceSet | null | undefined;
    await probeFaces(set === null || set === undefined || loadFaces === undefined ? null : { load: (f: string) => loadFaces.call(set, f) }, FACES, FONT_WAIT_MS);
    // One more task, so a violation the probe raised is dispatched before the state settles.
    await new Promise<void>((resolve) => {
      later(resolve, 0);
    });
    // Only now, so a violation the style probe raised still had the document on its path when it was dispatched.
    if (unprobe !== null) unprobe();
    if (state !== 'boot') return;
    state = 'settled';
    maybeReady();
  };
  add.call(doc, 'DOMContentLoaded', () => void start(), { once: true });
})();
