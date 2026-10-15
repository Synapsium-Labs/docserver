// The public entry of `@synapsium-labs/docserver/conformance` (docserver L1; architecture sections A, D, F).
// Node-only by design: it reads the corpus that ships with the package. A consumer runs it in its own CI
// against any render function with the same contract as `render()` from `./render`:
//
//   import { render } from '@synapsium-labs/docserver/render';
//   import { runCorpus } from '@synapsium-labs/docserver/conformance';
//   const run = runCorpus(render);
//   if (!run.ok) throw new Error(run.results.filter((r) => !r.ok).map((r) => r.id).join(', '));
//
// For every golden and small hostile case, runCorpus checks that the render's outcome is 'rendered', that
// normaliseForCompare(html) equals conformance/expected/<id>.html, that its meta, written as
// JSON.stringify(meta, null, 2) + '\n', equals conformance/expected/<id>.meta.json, and that the output
// passes checkOutputSafety.
//
// Hostile and generated cases also carry a verdict (conformance/hostile.json, verdict.ts): what must hold of
// the render without pinning its exact output. A generated case has no file and no golden; its input is built
// from a spec (hostile.ts), and only its verdict and the oracle judge it. A verdict with a `scan` arm also
// judges scanRefs, so pass it: runCorpus(render, { scanRefs }). On a slower machine, `timeScale` multiplies
// every verdict's maxMs; it never changes a committed verdict.
import { readFileSync } from 'node:fs';
import type { RenderOptions, RenderResult, ScanRefsOptions, ScanRefsResult } from '../render/types.js';
import { buildInput, crossCheck, parseHostile, sumInputSizes, type InputSpec } from './hostile.js';
import { normaliseForCompare } from './normalise.js';
import { checkOutputSafety } from './oracle.js';
import { evaluateVerdict, type Verdict, type VerdictContext } from './verdict.js';

export { buildInput, inputSize, MAX_INPUT_BYTES } from './hostile.js';
export type { InputPart, InputSpec } from './hostile.js';
export { normaliseForCompare } from './normalise.js';
export { checkOutputSafety } from './oracle.js';
export { evaluateVerdict } from './verdict.js';
export type { Verdict, VerdictContext } from './verdict.js';

/** Any function with render()'s contract. */
export type RenderFn = (markdown: string, o?: RenderOptions) => RenderResult;

/** Any function with scanRefs()'s contract. */
export type ScanFn = (markdown: string, o?: ScanRefsOptions) => ScanRefsResult;

export type CaseKind = 'golden' | 'hostile' | 'generated';

export interface CorpusCase {
  id: string;
  kind: CaseKind;
  /** What the case pins, in words. */
  pins: string;
  /** The scout probes folded into this case. */
  probes: readonly string[];
  /** The options the case renders with ({} when the manifest names none). */
  options: RenderOptions;
  /**
   * The input: conformance/corpus/<id>.md decoded as UTF-8, invalid bytes replaced, a BOM kept; for a
   * generated case, buildInput() of its spec in hostile.json.
   */
  input: string;
  /** conformance/expected/<id>.html and <id>.meta.json, as text; null for a generated case. */
  expected: { html: string; meta: string } | null;
  /** The case's verdict from hostile.json; null for a golden case. */
  verdict: Verdict | null;
}

export interface RunCorpusOptions {
  /** Run only these case ids; an unknown id is an error. */
  only?: readonly string[];
  /** scanRefs with this library's contract; a case whose verdict has a `scan` arm fails without it. */
  scanRefs?: ScanFn;
  /** Multiplies every verdict's maxMs; a positive finite number, default 1. */
  timeScale?: number;
}

export interface CaseResult {
  id: string;
  ok: boolean;
  /** Empty when ok; otherwise one line per failed check. */
  failures: string[];
  /** Wall-clock milliseconds of the render call. */
  ms: number;
}

export interface CorpusRun {
  ok: boolean;
  total: number;
  passed: number;
  results: CaseResult[];
}

interface ManifestEntry {
  id: string;
  kind: CaseKind;
  pins: string;
  probes: string[];
  options?: Record<string, unknown>;
}

/** The shipped corpus, next to dist/ in the package and next to src/ in a checkout. */
const CORPUS_ROOT = new URL('../../conformance/', import.meta.url);
const OPTION_KEYS: ReadonlySet<string> = new Set(['maxBytes', 'lineAttrs']);
const MAX_LISTED_VIOLATIONS = 5;

function readText(rel: string): string {
  return readFileSync(new URL(rel, CORPUS_ROOT)).toString('utf8');
}

function caseOptions(entry: ManifestEntry): RenderOptions {
  const options = entry.options ?? {};
  const unknown = Object.keys(options).filter((k) => !OPTION_KEYS.has(k));
  if (unknown.length > 0) throw new Error(`loadCorpus: case "${entry.id}" has unknown options: ${unknown.join(', ')}`);
  return options as RenderOptions;
}

/**
 * Every case of the shipped corpus, in manifest order. Throws on a case this version cannot load, on a
 * hostile.json that disagrees with the manifest, and when the generated inputs total more than 8 MiB.
 */
export function loadCorpus(): CorpusCase[] {
  const manifest = JSON.parse(readText('manifest.json')) as ManifestEntry[];
  const hostile = parseHostile(JSON.parse(readText('hostile.json')));
  const problems = crossCheck(manifest, hostile);
  if (problems.length > 0) throw new Error(`loadCorpus: ${problems.join('; ')}`);
  const specs = new Map<string, InputSpec>();
  for (const e of hostile) if (e.input !== undefined) specs.set(e.id, e.input);
  sumInputSizes([...specs.values()]);
  const verdicts = new Map(hostile.map((e) => [e.id, e.verdict]));
  return manifest.map((entry) => {
    const spec = specs.get(entry.id);
    return {
      id: entry.id,
      kind: entry.kind,
      pins: entry.pins,
      probes: entry.probes,
      options: caseOptions(entry),
      input: spec === undefined ? readText(`corpus/${entry.id}.md`) : buildInput(spec),
      expected:
        entry.kind === 'generated'
          ? null
          : { html: readText(`expected/${entry.id}.html`), meta: readText(`expected/${entry.id}.meta.json`) },
      verdict: verdicts.get(entry.id) ?? null,
    };
  });
}

/** Where two strings first differ, with a short window of each. */
function firstDifference(label: string, expected: string, actual: string): string {
  let i = 0;
  while (i < expected.length && i < actual.length && expected.charCodeAt(i) === actual.charCodeAt(i)) i += 1;
  const from = Math.max(0, i - 20);
  const window = (s: string): string => JSON.stringify(s.slice(from, i + 40));
  return `${label} differs at offset ${i}: expected ${window(expected)}, got ${window(actual)}`;
}

/** The verdict's failures. A scan arm reads scanRefs (null without one); if scanRefs throws, that is its line. */
function verdictFailures(c: CorpusCase, verdict: Verdict, result: RenderResult, ms: number, o: RunCorpusOptions): string[] {
  let scan: ScanRefsResult | null = null;
  let scanThrew: string | null = null;
  if (verdict.scan !== undefined && o.scanRefs !== undefined) {
    try {
      const maxBytes = c.options.maxBytes;
      scan = maxBytes === undefined ? o.scanRefs(c.input) : o.scanRefs(c.input, { maxBytes });
    } catch (e) {
      scanThrew = `scan: scanRefs threw: ${String(e)}`;
    }
  }
  const ctx: VerdictContext = { ms, scan, ...(o.timeScale === undefined ? {} : { timeScale: o.timeScale }) };
  const lines = evaluateVerdict(result, c.input, verdict, ctx);
  return scanThrew === null ? lines : [...lines.filter((l) => !l.startsWith('scan:')), scanThrew];
}

function checkCase(c: CorpusCase, render: RenderFn, o: RunCorpusOptions): CaseResult {
  const failures: string[] = [];
  const started = performance.now();
  let result: RenderResult;
  try {
    result = render(c.input, c.options);
  } catch (e) {
    return { id: c.id, ok: false, failures: [`render threw: ${String(e)}`], ms: performance.now() - started };
  }
  const ms = performance.now() - started;
  if (typeof result?.html !== 'string') {
    return { id: c.id, ok: false, failures: ['render returned no html string'], ms };
  }
  // A verdict states the outcome itself (a hostile case's says rendered); a golden case must render.
  if (c.verdict === null && result.outcome !== 'rendered') {
    failures.push(`outcome: expected "rendered", got ${JSON.stringify(result.outcome)}`);
  }
  if (c.expected !== null) {
    const html = normaliseForCompare(result.html);
    if (html !== c.expected.html) failures.push(firstDifference('html', c.expected.html, html));
    const meta = `${JSON.stringify(result.meta, null, 2)}\n`;
    if (meta !== c.expected.meta) failures.push(firstDifference('meta', c.expected.meta, meta));
  }
  if (c.verdict !== null) failures.push(...verdictFailures(c, c.verdict, result, ms, o));
  const violations = checkOutputSafety(result.html);
  for (const v of violations.slice(0, MAX_LISTED_VIOLATIONS)) failures.push(`oracle: ${v}`);
  if (violations.length > MAX_LISTED_VIOLATIONS) {
    failures.push(`oracle: ${violations.length - MAX_LISTED_VIOLATIONS} more violation(s)`);
  }
  return { id: c.id, ok: failures.length === 0, failures, ms };
}

/** Run the corpus (or the `only` cases) against `render`. */
export function runCorpus(render: RenderFn, o: RunCorpusOptions = {}): CorpusRun {
  if (o.timeScale !== undefined && !(Number.isFinite(o.timeScale) && o.timeScale > 0)) {
    throw new RangeError(`runCorpus: timeScale must be a positive finite number, got ${String(o.timeScale)}`);
  }
  let cases = loadCorpus();
  if (o.only !== undefined) {
    const known = new Set(cases.map((c) => c.id));
    const unknown = o.only.filter((id) => !known.has(id));
    if (unknown.length > 0) throw new Error(`runCorpus: unknown case id(s): ${unknown.join(', ')}`);
    const wanted = new Set(o.only);
    cases = cases.filter((c) => wanted.has(c.id));
  }
  const results = cases.map((c) => checkCase(c, render, o));
  const passed = results.filter((r) => r.ok).length;
  return { ok: results.length > 0 && passed === results.length, total: results.length, passed, results };
}
