// The bridge fixtures (docserver L3, Task 12; plan Reference §8 and §12): conformance/bridge-cases.json, the wire between
// the sealed reader frame and its parent written as cases, for a consumer's own parser of it. `./conformance` exports
// bridgeCases(), which reads the shipped file as loadCorpus() reads the corpus; this module holds its types and the one
// check of what was read, which refuses a file this version cannot load (another protocol, or a part missing) rather
// than hand a consumer half a battery. The cases themselves are judged by test/frame-protocol.test.ts and
// test/host-parse.test.ts against the library's own parsers; a consumer judges its parser by them.
import { BRIDGE_PROTOCOL } from '../frame/protocol.js';

/** How a fixture fills one key of its message before it is judged: prefix + unit repeated `times` + suffix. */
export interface BridgeFill {
  readonly prefix?: string;
  readonly unit: string;
  readonly times: number;
  readonly suffix?: string;
}

/** One message and the verdict of the reader on its receiving side. */
export interface BridgeMessageCase {
  readonly label: string;
  readonly direction: 'frame-to-parent' | 'parent-to-frame';
  /** For a parent-to-frame message: hello arrives on the window, every other op on the port. */
  readonly channel?: 'window' | 'port';
  /** The number of transferred ports; absent is 0. */
  readonly ports?: number;
  readonly message: unknown;
  /** Keys set before judging (each absent from `message`). */
  readonly fill?: Readonly<Record<string, BridgeFill>>;
  readonly verdict: 'accept' | 'refuse';
  /** A refusal's reason, one of BridgeCases.reasons. */
  readonly reason?: string;
  readonly note?: string;
}

/** One step of a timed sequence: frame-to-parent messages `at` ms after a valid ready, `count` times (absent: 1). */
export interface BridgeStep {
  readonly at: number;
  readonly count?: number;
  readonly message: Readonly<Record<string, unknown>>;
  readonly verdict: 'accept' | 'refuse';
  readonly reason?: string;
  /** Marks the refusal that closes the bridge (the sixteenth). */
  readonly closes?: boolean;
}

/** A timed sequence, judged by the parent's limits read as token buckets (BridgeCases.sequenceRules). */
export interface BridgeSequence {
  readonly label: string;
  readonly steps: readonly BridgeStep[];
}

/** conformance/bridge-cases.json. */
export interface BridgeCases {
  /** BRIDGE_PROTOCOL of `./frame`: 1. */
  readonly bridgeProtocol: number;
  /** How to read the fixtures, in prose. */
  readonly about: readonly string[];
  /** The closed list of refusal reasons. */
  readonly reasons: readonly string[];
  /** The mount's nonce a ready must echo, and the sha of the one `changes` request in flight. */
  readonly context: { readonly nonce: string; readonly inFlightSha: string };
  readonly messages: readonly BridgeMessageCase[];
  /** How a timed sequence is judged, in prose. */
  readonly sequenceRules: readonly string[];
  readonly sequences: readonly BridgeSequence[];
}

const PARTS = ['about', 'reasons', 'messages', 'sequenceRules', 'sequences'] as const;

/**
 * The fixtures in `text`, parsed. Throws when the text is not a fixtures object of this protocol: not a JSON object,
 * another `bridgeProtocol`, or a list or the context missing. The cases are not judged here: they are data.
 */
export function parseBridgeCases(text: string): BridgeCases {
  const v: unknown = JSON.parse(text);
  if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new Error('bridgeCases: the fixtures are not a JSON object');
  const o = v as Record<string, unknown>;
  if (o['bridgeProtocol'] !== BRIDGE_PROTOCOL) {
    throw new Error(`bridgeCases: the fixtures are of protocol ${String(o['bridgeProtocol'])}, this version reads protocol ${String(BRIDGE_PROTOCOL)}`);
  }
  for (const part of PARTS) if (!Array.isArray(o[part])) throw new Error(`bridgeCases: the fixtures hold no ${part} list`);
  const context = o['context'];
  const c = typeof context === 'object' && context !== null ? (context as Record<string, unknown>) : {};
  if (typeof c['nonce'] !== 'string' || typeof c['inFlightSha'] !== 'string') throw new Error('bridgeCases: the fixtures hold no context');
  return v as BridgeCases;
}
