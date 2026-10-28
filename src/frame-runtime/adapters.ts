// The reader's host callbacks inside the sealed frame, mapped onto bridge ops (docserver L3, Task 5; plan Reference §6.2
// step 3, §8.1 and §8.3). Bundled into the bootstrap; DOM-free. Every op goes through the outbox (outbox.ts), which
// queues it before ready and paces it after; this file checks each value against the bound the frame keeps before it
// sends anything, so a value the parent would refuse is never sent:
//
//   storage   the seed's snapshot under L2's keys, and set(): the key mapped (below; any other key dropped), the value L2's
//             JSON text (valid JSON, at most 65,536 UTF-8 bytes, else dropped), a delete as the JSON literal 'null'
//   onLink    navigate: 1 to 4096 code units, no C0, DEL or C1 control; newTab dropped. The guard's links (link()) go to the
//             same sink
//   onHash    hash: only an id inside FRAGMENT_ID_GRAMMAR; onHash(null), push and from are not sent in protocol 1
//   copy      at most 65,536 UTF-8 bytes, and only while copy's share of the window lasts; otherwise it rejects, and L2
//             shows a failed copy
//   changes   only a full sha (40 or 64 lower-case hex): anything shorter resolves null locally; else the outbox's slot
//   openVersion  version: null keys omitted, full shas only (a short one sends nothing); {} back to the latest
//
// Each callback but storage exists only when the seed's `bridge` allows its op (links, hash, copy, changes, versions),
// so L2 builds no control whose op the parent does not answer.
//
// The storage key mapping (L2's scheme, src/enhance/state.ts; namespace `docreader`, storageKey and posKey `doc`):
//   docreader:prefs             pref:prefs
//   docreader:ui                pref:ui
//   docreader:pos:doc           doc:pos
//   docreader:doc:doc:<name>    doc:<name>, <name> a DOC_FIELDS member other than pos
//   anything else               dropped, never sent
//
// Mermaid (docserver L3, Task 16): enhanceMermaid() is enhance's `mermaid` option from the seed's (its caps when given,
// its secure keys and its `draw`, passed through unchanged) with a load() that answers the registered API; and
// waitsForDrawing() is the ready rule: ready waits for the first full pass only in 'auto' mode (FD13, FD18); and
// probesInlineStyle() says when the bootstrap asks for inline style before ready instead: in 'on-request' mode, whose
// first drawing comes after ready (styles.ts; fix round, review S1; Reference §11.5, ruling R7).
import { isFragmentId } from '../frame/fragment.js';
import { BRIDGE_LIMITS, DOC_FIELDS, isBridgeStoreKey, isFullSha, PREF_KEYS, type BridgeStoreKey } from '../frame/protocol.js';
import type { Seed, SeedMermaid } from '../frame/seed.js';
import type { ChangesAnswer, Outbox } from './outbox.js';

/** L2's namespace, storage key and position key inside the frame (FD7: no document identity in the frame). */
export const FRAME_NAMESPACE = 'docreader';
export const FRAME_DOC_KEY = 'doc';

const PREFIX = `${FRAME_NAMESPACE}:`;
const POS = `${FRAME_NAMESPACE}:pos:${FRAME_DOC_KEY}`;
const DOC = `${FRAME_NAMESPACE}:doc:${FRAME_DOC_KEY}:`;

/** The bridge key of an L2 storage key, or null when the key is not on the allow-list. */
export function toBridgeKey(l2: string): BridgeStoreKey | null {
  if (l2 === POS) return 'doc:pos';
  if (l2.startsWith(DOC)) {
    const name = l2.slice(DOC.length);
    return name !== 'pos' && (DOC_FIELDS as readonly string[]).includes(name) ? (`doc:${name}` as BridgeStoreKey) : null;
  }
  if (l2.startsWith(PREFIX)) {
    const name = l2.slice(PREFIX.length);
    return (PREF_KEYS as readonly string[]).includes(name) ? (`pref:${name}` as BridgeStoreKey) : null;
  }
  return null;
}

/** The L2 storage key of a bridge key. */
export function fromBridgeKey(k: BridgeStoreKey): string {
  if (k === 'doc:pos') return POS;
  return k.startsWith('doc:') ? DOC + k.slice(4) : PREFIX + k.slice(5);
}

/** UTF-8 bytes of a string, lone surrogates as three (as TextEncoder writes them). */
function utf8Bytes(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x80) n += 1;
    else if (c < 0x800) n += 2;
    else if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length && (s.charCodeAt(i + 1) & 0xfc00) === 0xdc00) {
      n += 4;
      i++;
    } else n += 3;
  }
  return n;
}

const parse = JSON.parse;

/** True for an href the frame may send: 1 to hrefMaxChars code units, with no C0, DEL or C1 control. */
export function sendableHref(href: unknown): href is string {
  return typeof href === 'string' && href.length > 0 && href.length <= BRIDGE_LIMITS.hrefMaxChars && !/[\u0000-\u001f\u007f-\u009f]/.test(href);
}

/** The enhance callbacks of one frame, and the guard's link sink. */
export interface FrameAdapters {
  readonly storage: { readonly snapshot: Readonly<Record<string, string>>; set(key: string, value: string | null): void };
  readonly onLink?: (href: string, how: { readonly newTab: boolean }) => void;
  readonly onHash?: (id: string | null, entry: { readonly push: boolean; readonly from: string | null }) => void;
  readonly copy?: (text: string) => Promise<void>;
  readonly changes?: (sha: string) => Promise<ChangesAnswer | null>;
  readonly openVersion?: (v: { readonly sha: string | null; readonly only: string | null }) => void;
  /** The guard's `docserver:link`: the same sink as onLink, dropped when links are off. */
  link(href: string): void;
}

/** The adapters for one frame over its outbox and seed (see the header). */
export function createAdapters(outbox: Outbox, seed: Pick<Seed, 'snapshot' | 'bridge'>): FrameAdapters {
  const snapshot: Record<string, string> = Object.create(null) as Record<string, string>;
  for (const [k, v] of seed.snapshot) snapshot[fromBridgeKey(k)] = v;
  const b = seed.bridge;
  const navigate = (href: string): void => {
    if (b.links && sendableHref(href)) outbox.send({ t: 'navigate', href });
  };
  return {
    storage: {
      snapshot,
      set(key: string, value: string | null): void {
        const k = toBridgeKey(key);
        if (k === null || !isBridgeStoreKey(k)) return;
        const text = value === null ? 'null' : value;
        if (typeof text !== 'string' || utf8Bytes(text) > BRIDGE_LIMITS.valueMaxBytes) return;
        try {
          parse(text);
        } catch {
          return;
        }
        outbox.send({ t: 'store.set', key: k, value: text });
      },
    },
    ...(b.links ? { onLink: (href: string): void => navigate(href) } : {}),
    ...(b.hash
      ? {
          onHash: (id: string | null): void => {
            if (isFragmentId(id)) outbox.send({ t: 'hash', id });
          },
        }
      : {}),
    ...(b.copy
      ? {
          copy: (text: string): Promise<void> =>
            typeof text === 'string' && utf8Bytes(text) <= BRIDGE_LIMITS.copyMaxBytes && outbox.copy(text)
              ? Promise.resolve()
              : Promise.reject(new Error('docserver frame: copy refused')),
        }
      : {}),
    ...(b.changes ? { changes: (sha: string): Promise<ChangesAnswer | null> => (isFullSha(sha) ? outbox.changes(sha) : Promise.resolve(null)) } : {}),
    ...(b.versions
      ? {
          openVersion: (v: { readonly sha: string | null; readonly only: string | null }): void => {
            const { sha, only } = v;
            if ((sha !== null && !isFullSha(sha)) || (only !== null && !isFullSha(only))) return;
            outbox.send({ t: 'version', ...(sha === null ? {} : { sha }), ...(only === null ? {} : { only }) });
          },
        }
      : {}),
    link: navigate,
  };
}

/** enhance's `mermaid` option for a frame whose seed asks for Mermaid: the seed's settings, `draw` included, and the API. */
export function enhanceMermaid(
  m: SeedMermaid,
  api: object,
): { maxTextSize?: number; maxEdges?: number; secure: readonly string[]; draw: SeedMermaid['draw']; load: () => Promise<unknown> } {
  return {
    ...(m.maxTextSize === undefined ? {} : { maxTextSize: m.maxTextSize }),
    ...(m.maxEdges === undefined ? {} : { maxEdges: m.maxEdges }),
    secure: m.secure,
    draw: m.draw,
    load: () => Promise.resolve(api),
  };
}

/** Whether ready waits for Mermaid's first full pass: only with Mermaid on in 'auto' mode; never on request (FD13). */
export function waitsForDrawing(m: SeedMermaid | null): boolean {
  return m !== null && m.draw === 'auto';
}

/**
 * Whether the bootstrap asks for inline style before ready (styles.ts): only with Mermaid on and drawn on request, where
 * Mermaid's own first request for it comes on a tap, after ready (fix round, review S1; ruling R7).
 */
export function probesInlineStyle(m: SeedMermaid | null): boolean {
  return m !== null && m.draw === 'on-request';
}
