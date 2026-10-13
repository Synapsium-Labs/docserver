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
// passes checkOutputSafety. Task 11 adds generated cases and verdicts (conformance/hostile.json).
import { readFileSync } from 'node:fs';
import type { RenderOptions, RenderResult } from '../render/types.js';
import { normaliseForCompare } from './normalise.js';
import { checkOutputSafety } from './oracle.js';

export { normaliseForCompare } from './normalise.js';
export { checkOutputSafety } from './oracle.js';
export type { Verdict } from './verdict.js';

/** Any function with render()'s contract. */
export type RenderFn = (markdown: string, o?: RenderOptions) => RenderResult;

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
  /** The input: conformance/corpus/<id>.md decoded as UTF-8, invalid bytes replaced, a BOM kept. */
  input: string;
  /** conformance/expected/<id>.html and <id>.meta.json, as text. */
  expected: { html: string; meta: string };
}

export interface RunCorpusOptions {
  /** Run only these case ids; an unknown id is an error. */
  only?: readonly string[];
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

/** Every case of the shipped corpus, in manifest order. Throws on a case this version cannot load. */
export function loadCorpus(): CorpusCase[] {
  const manifest = JSON.parse(readText('manifest.json')) as ManifestEntry[];
  return manifest.map((entry) => {
    if (entry.kind === 'generated') {
      throw new Error(`loadCorpus: case "${entry.id}" is generated, and this version cannot build its input`);
    }
    return {
      id: entry.id,
      kind: entry.kind,
      pins: entry.pins,
      probes: entry.probes,
      options: caseOptions(entry),
      input: readText(`corpus/${entry.id}.md`),
      expected: { html: readText(`expected/${entry.id}.html`), meta: readText(`expected/${entry.id}.meta.json`) },
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

function checkCase(c: CorpusCase, render: RenderFn): CaseResult {
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
  if (result.outcome !== 'rendered') failures.push(`outcome: expected "rendered", got ${JSON.stringify(result.outcome)}`);
  const html = normaliseForCompare(result.html);
  if (html !== c.expected.html) failures.push(firstDifference('html', c.expected.html, html));
  const meta = `${JSON.stringify(result.meta, null, 2)}\n`;
  if (meta !== c.expected.meta) failures.push(firstDifference('meta', c.expected.meta, meta));
  const violations = checkOutputSafety(result.html);
  for (const v of violations.slice(0, MAX_LISTED_VIOLATIONS)) failures.push(`oracle: ${v}`);
  if (violations.length > MAX_LISTED_VIOLATIONS) {
    failures.push(`oracle: ${violations.length - MAX_LISTED_VIOLATIONS} more violation(s)`);
  }
  return { id: c.id, ok: failures.length === 0, failures, ms };
}

/** Run the corpus (or the `only` cases) against `render`. */
export function runCorpus(render: RenderFn, o: RunCorpusOptions = {}): CorpusRun {
  let cases = loadCorpus();
  if (o.only !== undefined) {
    const known = new Set(cases.map((c) => c.id));
    const unknown = o.only.filter((id) => !known.has(id));
    if (unknown.length > 0) throw new Error(`runCorpus: unknown case id(s): ${unknown.join(', ')}`);
    const wanted = new Set(o.only);
    cases = cases.filter((c) => wanted.has(c.id));
  }
  const results = cases.map((c) => checkCase(c, render));
  const passed = results.filter((r) => r.ok).length;
  return { ok: results.length > 0 && passed === results.length, total: results.length, passed, results };
}
