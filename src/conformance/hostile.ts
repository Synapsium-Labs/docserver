// Generated hostile inputs and the hostile.json index (docserver L1; architecture sections D, E and F, Task 11).
// A generated case is too large to commit as a file, so conformance/hostile.json holds its input as a spec
// and buildInput() builds it, deterministically, on the consumer's machine. A spec is a list of parts; each
// part is a text repeated `times` times, and when it names an `index` marker, every marker in the text is
// replaced by the repetition's number (0, 1, 2, ...), so 10000 distinct image sources need no 10000-line file.
//
// The size of a spec is computed from the spec itself, before anything is allocated, and a spec over
// MAX_INPUT_BYTES (8 MiB of UTF-8) is refused: a hostile manifest must not be able to exhaust a consumer's
// memory. loadCorpus applies the same cap to the total of all generated inputs (sumInputSizes).
//
// hostile.json is an array of entries {id, input?, verdict}: one per hostile case (its input is
// conformance/corpus/<id>.md, so it has no `input`, and its verdict says `exact: true`, because the case also
// has a golden) and one per generated case (with `input`, never `exact`). crossCheck() ties it to the manifest.
import { Buffer } from 'node:buffer';
import { parseVerdict, type Verdict } from './verdict.js';

/** One repeated text of a generated input. */
export interface InputPart {
  /** The text; never empty. */
  readonly text: string;
  /** How many times it repeats: a safe integer of at least 1. Default 1. */
  readonly times?: number;
  /** A marker inside `text`, replaced in each repetition by its 0-based number in decimal. */
  readonly index?: string;
}

/** The input of a generated case: its parts, concatenated in order. */
export interface InputSpec {
  readonly parts: readonly InputPart[];
}

/** One entry of conformance/hostile.json. */
export interface HostileEntry {
  readonly id: string;
  /** Present exactly for a generated case. */
  readonly input?: InputSpec;
  readonly verdict: Verdict;
}

/** The cap on one generated input, and on all of them together: 8 MiB of UTF-8. */
export const MAX_INPUT_BYTES = 8_388_608;

const PART_KEYS: ReadonlySet<string> = new Set(['text', 'times', 'index']);
const ENTRY_KEYS: ReadonlySet<string> = new Set(['id', 'input', 'verdict']);

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** The number of decimal digits written for 0, 1, ..., n - 1. */
function digitTotal(n: number): number {
  let total = 0;
  for (let width = 1, lo = 0, hi = 10; lo < n; width += 1, lo = hi, hi *= 10) {
    total += (Math.min(n, hi) - lo) * width;
  }
  return total;
}

function partSize(p: unknown, at: string): number {
  if (!isRecord(p)) throw new TypeError(`input spec: ${at} is not an object`);
  const unknown = Object.keys(p).filter((k) => !PART_KEYS.has(k));
  if (unknown.length > 0) throw new TypeError(`input spec: ${at} has unknown keys: ${unknown.join(', ')}`);
  const { text, times = 1, index } = p;
  if (typeof text !== 'string' || text === '') throw new TypeError(`input spec: ${at}.text must be a non-empty string`);
  if (typeof times !== 'number' || !Number.isSafeInteger(times) || times < 1) {
    throw new TypeError(`input spec: ${at}.times must be a safe integer of at least 1, got ${String(times)}`);
  }
  // Every repetition writes at least one byte, so a count over the cap is over it before any arithmetic.
  if (times > MAX_INPUT_BYTES) {
    throw new RangeError(`input spec: ${at}.times is ${times}, over the ${MAX_INPUT_BYTES}-byte cap`);
  }
  const bytes = Buffer.byteLength(text, 'utf8');
  if (index === undefined) return bytes * times;
  if (typeof index !== 'string' || index === '') throw new TypeError(`input spec: ${at}.index must be a non-empty string`);
  const markers = text.split(index).length - 1;
  if (markers === 0) throw new TypeError(`input spec: ${at}.index ${JSON.stringify(index)} does not occur in its text`);
  return (bytes - markers * Buffer.byteLength(index, 'utf8')) * times + markers * digitTotal(times);
}

/** The UTF-8 size of the input a spec builds, computed without building it. Throws on an invalid spec or one over MAX_INPUT_BYTES. */
export function inputSize(spec: InputSpec): number {
  const raw: unknown = spec;
  if (!isRecord(raw) || Object.keys(raw).length !== 1 || !Array.isArray(raw['parts']) || raw['parts'].length === 0) {
    throw new TypeError('input spec: must be {parts: [...]} with at least one part');
  }
  let size = 0;
  raw['parts'].forEach((p: unknown, i: number) => {
    size += partSize(p, `parts[${i}]`);
  });
  if (size > MAX_INPUT_BYTES) {
    throw new RangeError(`input spec: ${size} bytes, over the ${MAX_INPUT_BYTES}-byte cap`);
  }
  return size;
}

/** Build a generated input. Deterministic; refuses (before allocating) a spec over MAX_INPUT_BYTES. */
export function buildInput(spec: InputSpec): string {
  inputSize(spec);
  const chunks: string[] = [];
  for (const p of spec.parts) {
    const times = p.times ?? 1;
    if (p.index === undefined) {
      chunks.push(p.text.repeat(times));
      continue;
    }
    const pieces = p.text.split(p.index);
    for (let i = 0; i < times; i += 1) chunks.push(pieces.join(String(i)));
  }
  return chunks.join('');
}

/** The total size of several specs; throws when it is over MAX_INPUT_BYTES. */
export function sumInputSizes(specs: readonly InputSpec[]): number {
  const total = specs.reduce((sum, s) => sum + inputSize(s), 0);
  if (total > MAX_INPUT_BYTES) {
    throw new RangeError(`generated inputs total ${total} bytes, over the ${MAX_INPUT_BYTES}-byte cap`);
  }
  return total;
}

/** Parse conformance/hostile.json's content. Throws on any entry this version cannot read. */
export function parseHostile(raw: unknown): HostileEntry[] {
  if (!Array.isArray(raw)) throw new TypeError('hostile.json: must be an array');
  const seen = new Set<string>();
  return raw.map((e: unknown, i: number): HostileEntry => {
    if (!isRecord(e)) throw new TypeError(`hostile.json: entry ${i} is not an object`);
    const unknown = Object.keys(e).filter((k) => !ENTRY_KEYS.has(k));
    if (unknown.length > 0) throw new TypeError(`hostile.json: entry ${i} has unknown keys: ${unknown.join(', ')}`);
    const id = e['id'];
    if (typeof id !== 'string' || id === '') throw new TypeError(`hostile.json: entry ${i} has no id`);
    if (seen.has(id)) throw new TypeError(`hostile.json: ${id} appears twice`);
    seen.add(id);
    const verdict = parseVerdict(e['verdict'], `hostile.json: ${id}`);
    if (e['input'] === undefined) return { id, verdict };
    const input = e['input'] as InputSpec;
    inputSize(input);
    return { id, input, verdict };
  });
}

/**
 * How hostile.json disagrees with the manifest, one line per problem (empty when they agree): every hostile
 * and generated case has exactly one entry and a golden case has none; a hostile case has no input spec, says
 * `exact: true` and must render; a generated case has an input spec and never says `exact`.
 */
export function crossCheck(cases: readonly { id: string; kind: string }[], entries: readonly HostileEntry[]): string[] {
  const problems: string[] = [];
  const byId = new Map(entries.map((e) => [e.id, e]));
  const known = new Set(cases.map((c) => c.id));
  for (const c of cases) {
    const e = byId.get(c.id);
    if (c.kind === 'golden') {
      if (e !== undefined) problems.push(`${c.id}: a golden case has no verdict`);
      continue;
    }
    if (e === undefined) {
      problems.push(`${c.id}: a ${c.kind} case needs a verdict in hostile.json`);
      continue;
    }
    if (c.kind === 'hostile') {
      if (e.input !== undefined) problems.push(`${c.id}: a hostile case reads its input from corpus/, not from a spec`);
      if (e.verdict.exact !== true) problems.push(`${c.id}: a hostile case has a golden, so its verdict says exact: true`);
      if (e.verdict.outcome !== 'rendered') problems.push(`${c.id}: a hostile case with a golden must render`);
    } else {
      if (e.input === undefined) problems.push(`${c.id}: a generated case needs an input spec`);
      if (e.verdict.exact !== undefined) problems.push(`${c.id}: a generated case has no golden, so no exact`);
    }
  }
  for (const e of entries) if (!known.has(e.id)) problems.push(`${e.id}: in hostile.json but not in the manifest`);
  return problems;
}
