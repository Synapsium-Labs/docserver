// frameDocument: the srcdoc of the sealed reader frame (docserver L3; design §4). Validates its inputs, verifies every
// asset against the generated manifest, cross-checks the policy, and joins the fixed skeleton, on one line, with no
// whitespace or comment between elements:
//
//   <meta http-equiv="Content-Security-Policy" content="{csp}">
//   <script>{guard.js}</script>
//   <script type="application/json">{seed}</script>
//   <script>{bootstrap.js}</script>
//   <style>{frame/reader.css}</style>
//   <script>{enhance.js}</script>
//   <script>{mermaid.frame.js}</script>        only when FrameOptions.mermaid is non-null
//
// No doctype (a srcdoc document is never in quirks mode), no html, head or body tag: every element lands in the
// implied head, and the implied body stays empty until the bootstrap appends the content root at DOMContentLoaded. The
// rendered html travels only as text inside the seed. Pure: no DOM, no clock, no randomness, no I/O.
//
// The seed carries every schema 1 key (Task 3): the keys frameDocument takes no option for yet (frontList, version,
// images, snapshot, features, bridge, and mermaid's secure and draw) are written at their defaults. Task 7 validates and
// seeds their real values from RenderInput and FrameOptions.
import type { FrontEntry, RenderOutcome } from '../render/types.js';
import { cssHazards, scriptHazards } from './bytes.js';
import { checkFrameCsp } from './csp.js';
import { FRAME_MANIFEST } from './manifest.generated.js';
import { isFragmentId } from './fragment.js';
import { FRAME_PREF_VALUES } from './protocol.js';
import { isLang, isNonce, SEED_LIMITS, serializeSeed, type Seed, type SeedMermaid, type SeedPrefs } from './seed.js';
import { hex, sha256Text } from './sha256.js';

export type FrameErrorCode = 'not-rendered' | 'invalid-input' | 'nonce' | 'asset-mismatch' | 'unsafe-asset' | 'csp' | 'missing-asset';

export class FrameError extends Error {
  readonly code: FrameErrorCode;

  constructor(code: FrameErrorCode, message: string) {
    super(message);
    this.name = 'FrameError';
    this.code = code;
  }
}

export interface RenderInput {
  readonly result: {
    readonly outcome: RenderOutcome;
    readonly html: string;
    readonly meta: { readonly title: string | null; readonly frontList: readonly FrontEntry[] | null };
  };
  /** The id to open at, without '#'. Outside FRAGMENT_ID_GRAMMAR it is ignored (seeded as null), never refused. */
  readonly initialHash?: string | null;
  /** Default 'en'. */
  readonly lang?: string;
}

/** The exact texts of the shipped files; each is verified against FRAME_MANIFEST. */
export interface FrameAssets {
  readonly guard: string;
  readonly bootstrap: string;
  readonly enhance: string;
  readonly css: string;
  /** assets/mermaid/mermaid.frame.js; required when FrameOptions.mermaid is non-null. */
  readonly mermaid?: string;
}

export interface FrameOptions {
  /** Must pass checkFrameCsp with every inlined script's hash. */
  readonly csp: string;
  /** 32 lower-case hex digits, fresh per mount; it lives only in the seed. */
  readonly nonce: string;
  readonly assets: FrameAssets;
  readonly prefs?: SeedPrefs;
  /** null or absent: no Mermaid script; figures show their source. The seed completes it with `secure: []` and
   *  `draw: 'auto'` (Task 7 takes both from here). */
  readonly mermaid?: Pick<SeedMermaid, 'maxTextSize' | 'maxEdges'> | null;
}

const SCRIPTS = ['guard', 'bootstrap', 'enhance'] as const;
const PREF_VALUES: Readonly<Record<string, readonly string[]>> = FRAME_PREF_VALUES;

function verify(name: keyof typeof FRAME_MANIFEST, text: unknown): string {
  if (typeof text !== 'string') throw new FrameError('asset-mismatch', `frameDocument: assets.${name} is not a string`);
  const m = FRAME_MANIFEST[name];
  if (hex(sha256Text(text)) !== m.sha256) throw new FrameError('asset-mismatch', `frameDocument: assets.${name} differs from ${m.path}`);
  const hazards = name === 'css' ? cssHazards(text) : scriptHazards(text);
  if (hazards.length > 0) throw new FrameError('unsafe-asset', `frameDocument: assets.${name} holds ${hazards.join(', ')}`);
  return text;
}

function prefsOf(p: unknown): SeedPrefs {
  if (p === undefined) return {};
  if (typeof p !== 'object' || p === null || Array.isArray(p)) throw new FrameError('invalid-input', 'frameDocument: prefs');
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(p)) {
    const allowed = Object.hasOwn(PREF_VALUES, k) ? PREF_VALUES[k] : undefined;
    if (allowed === undefined || typeof v !== 'string' || !allowed.includes(v)) throw new FrameError('invalid-input', `frameDocument: prefs.${k}`);
    out[k] = v;
  }
  return out as SeedPrefs;
}

/** The most each Mermaid cap may be: the seed's own (SEED_LIMITS), so the bootstrap never refuses what this writes. Task 7
 *  lowers both to the frame's ceilings (50000 and 500). */
const MERMAID_CAPS: Readonly<Record<string, number>> = { maxTextSize: SEED_LIMITS.maxTextSize, maxEdges: SEED_LIMITS.maxEdges };

function mermaidOf(m: unknown): SeedMermaid | null {
  if (m === undefined || m === null) return null;
  if (typeof m !== 'object' || Array.isArray(m)) throw new FrameError('invalid-input', 'frameDocument: mermaid');
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(m)) {
    const max = Object.hasOwn(MERMAID_CAPS, k) ? MERMAID_CAPS[k] : undefined;
    if (max === undefined || typeof v !== 'number' || !Number.isInteger(v) || v < 1 || v > max) {
      throw new FrameError('invalid-input', `frameDocument: mermaid.${k}`);
    }
    out[k] = v;
  }
  return { ...out, secure: [], draw: 'auto' };
}

/** The srcdoc for one mount of the sealed reader frame. Throws FrameError on any refusal (design §4.3). */
export function frameDocument(r: RenderInput, o: FrameOptions): string {
  if (r.result.outcome !== 'rendered') throw new FrameError('not-rendered', `frameDocument: the document did not render (${String(r.result.outcome)})`);
  if (!isNonce(o.nonce)) throw new FrameError('nonce', 'frameDocument: the nonce must be 32 lower-case hex digits');
  const html = r.result.html;
  const title = r.result.meta.title;
  if (typeof html !== 'string') throw new FrameError('invalid-input', 'frameDocument: result.html');
  if (title !== null && (typeof title !== 'string' || title.length > SEED_LIMITS.titleMaxCodeUnits)) throw new FrameError('invalid-input', 'frameDocument: meta.title');
  const lang = r.lang ?? 'en';
  if (!isLang(lang)) throw new FrameError('invalid-input', 'frameDocument: lang');
  // An initialHash outside FRAGMENT_ID_GRAMMAR is ignored (seeded as null), never refused (ruling R1): a host may
  // forward a user's URL fragment as it found it.
  const hash: unknown = r.initialHash ?? null;
  const initialHash = isFragmentId(hash) ? hash : null;
  const prefs = prefsOf(o.prefs);
  const guard = verify('guard', o.assets.guard);
  const bootstrap = verify('bootstrap', o.assets.bootstrap);
  const enhance = verify('enhance', o.assets.enhance);
  const css = verify('css', o.assets.css);
  const mermaidOptions = mermaidOf(o.mermaid);
  let mermaid: string | null = null;
  if (mermaidOptions !== null) {
    if (o.assets.mermaid === undefined) throw new FrameError('missing-asset', 'frameDocument: mermaid is on but assets.mermaid is absent');
    mermaid = verify('mermaid', o.assets.mermaid);
  }
  const required: string[] = SCRIPTS.map((k) => FRAME_MANIFEST[k].csp);
  if (mermaid !== null) required.push(FRAME_MANIFEST.mermaid.csp);
  const csp = checkFrameCsp(o.csp, required);
  if (!csp.ok) throw new FrameError('csp', `frameDocument: the policy is refused (${csp.why})`);
  const fields: Seed = {
    s: 1,
    nonce: o.nonce,
    html,
    title,
    frontList: null,
    version: { sha: null, draft: false, commits: null, only: null },
    images: [],
    initialHash,
    lang,
    prefs,
    snapshot: [],
    features: {},
    mermaid: mermaidOptions,
    bridge: { links: true, hash: true, copy: true, changes: true, versions: true },
  };
  const seed = serializeSeed(fields);
  return (
    `<meta http-equiv="Content-Security-Policy" content="${o.csp}">` +
    `<script>${guard}</script>` +
    `<script type="application/json">${seed}</script>` +
    `<script>${bootstrap}</script>` +
    `<style>${css}</style>` +
    `<script>${enhance}</script>` +
    (mermaid === null ? '' : `<script>${mermaid}</script>`)
  );
}
