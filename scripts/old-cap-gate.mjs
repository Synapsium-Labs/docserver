// The release gate's checker (docserver readiness, Task 1; ccrc D-8824).
//
//   node scripts/old-cap-gate.mjs <vitest-json-report> <chromium|webkit>
//
// ci.yml's opt-in old-cap job runs the one measured row of test/browser/frame-appearance.test.ts under one browser
// and writes vitest's JSON report; this reads that report and exits 0 only when exactly one test titled as that row,
// under a describe named for that browser, has status `passed`. Everything else is refused with one line on stderr:
//   - a report that is missing, unreadable, not JSON or not a vitest report: "unmeasured";
//   - no such row (a filter that matched nothing, or a row moved or renamed), or more than one: "unmeasured";
//   - a row whose status is skipped, pending, todo or anything but passed or failed (the measure switch off, the
//     browser not selected, the row filtered out): "unmeasured";
//   - a row that ran and failed: "failed" (the one completed failure).
// So a run that measured nothing can never read as a pass. The row's title is copied here, and test/old-cap-gate.test.ts
// holds it equal to the title in the test file. Dev tooling, never shipped; no dependency; types in old-cap-gate.d.mts.
//
// Exit codes: 0 the row passed; 1 a refusal; 2 a usage error.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The measured row's title, as test/browser/frame-appearance.test.ts spells it. */
export const ROW_TITLE =
  "measures (DOCREADER_MEASURE=1): a document at 1.1.0's default srcdoc cap, with both faces and the largest accepted appearance, mounts through ./host to ready with no fallback";

/** The browsers the gate runs (test/browser/harness.ts BROWSERS). */
export const BROWSERS = Object.freeze(['chromium', 'webkit']);

/**
 * The reason a parsed vitest JSON report does not show the row passing under `browser`, or null when it does.
 * @param {unknown} report
 * @param {string} browser
 * @returns {string | null}
 */
export function judgeReport(report, browser) {
  const files = typeof report === 'object' && report !== null ? report.testResults : undefined;
  if (!Array.isArray(files)) return 'unmeasured: the report is not a vitest JSON report (no testResults list)';
  const rows = [];
  for (const file of files) {
    const results = typeof file === 'object' && file !== null ? file.assertionResults : undefined;
    if (!Array.isArray(results)) return 'unmeasured: the report is not a vitest JSON report (a test file has no assertionResults list)';
    for (const r of results) {
      if (typeof r !== 'object' || r === null) continue;
      if (r.title === ROW_TITLE && Array.isArray(r.ancestorTitles) && r.ancestorTitles.includes(browser)) rows.push(r);
    }
  }
  if (rows.length === 0) return `unmeasured: the report has no row of the old-cap mount under ${browser}`;
  if (rows.length > 1) return `unmeasured: the report has ${String(rows.length)} rows of the old-cap mount under ${browser}, not exactly one`;
  const status = rows[0].status;
  if (status === 'passed') return null;
  if (status === 'failed') return `failed: the old-cap mount failed under ${browser}`;
  return `unmeasured: the old-cap mount's status under ${browser} is ${JSON.stringify(status)}, not passed`;
}

/**
 * The reason the report file at `file` does not show the row passing under `browser`, or null when it does.
 * @param {string} file
 * @param {string} browser
 * @returns {string | null}
 */
export function judgeFile(file, browser) {
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch (e) {
    return `unmeasured: the report cannot be read (${e instanceof Error ? e.message.split('\n')[0] : String(e)})`;
  }
  let report;
  try {
    report = JSON.parse(text);
  } catch {
    return 'unmeasured: the report is not JSON';
  }
  return judgeReport(report, browser);
}

/**
 * @param {readonly string[]} args the command line after the script: the report path, then the browser
 * @returns {number} the exit code
 */
export function main(args) {
  const [file, browser, ...rest] = args;
  if (file === undefined || browser === undefined || rest.length > 0 || !BROWSERS.includes(browser)) {
    console.error(`usage: node scripts/old-cap-gate.mjs <vitest-json-report> <${BROWSERS.join('|')}>`);
    return 2;
  }
  const reason = judgeFile(file, browser);
  if (reason !== null) {
    console.error(`old-cap gate: ${reason}`);
    return 1;
  }
  console.log(`old-cap gate: the old-cap mount passed under ${browser}`);
  return 0;
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
