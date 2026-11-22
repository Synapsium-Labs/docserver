// The release gate's checker (docserver readiness, Task 1; scripts/old-cap-gate.mjs, ccrc D-8824). The reports here
// have the shape vitest 4's JSON reporter writes, read from a real run of a browser test file with the measured row
// skipped: `testResults[]` per file, each with `assertionResults[]` of `{ ancestorTitles, fullName, status, title }`,
// where a `describeBrowsers` block's rows carry the browser's name as their one ancestor title and an excluded
// browser's rows carry "<name>: excluded by DOCREADER_BROWSERS=<setting>". One case per refusal and the one pass;
// each goes red when its branch of the checker is removed (docs/superpowers/plans/readiness-mutations/task-1.md).
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { BROWSERS, judgeFile, judgeReport, main, ROW_TITLE } from '../scripts/old-cap-gate.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const GATE = path.join(ROOT, 'scripts', 'old-cap-gate.mjs');

interface Row {
  ancestorTitles: string[];
  fullName: string;
  status: string;
  title: string;
}
const row = (browser: string, status: string, title = ROW_TITLE): Row => ({ ancestorTitles: [browser], fullName: `${browser} ${title}`, status, title });
const report = (...rows: Row[]) => ({ numTotalTests: rows.length, testResults: [{ name: '/x/test/browser/frame-appearance.test.ts', status: 'passed', assertionResults: rows }] });
/** A run for `browser` with the other browser excluded, as describeBrowsers writes it. */
const run = (browser: string, status: string) => {
  const other = browser === 'chromium' ? 'webkit' : 'chromium';
  return report(row(browser, status), { ...row(other, 'skipped'), ancestorTitles: [`${other}: excluded by DOCREADER_BROWSERS=${browser}`] });
};

const work = mkdtempSync(path.join(tmpdir(), 'docserver-old-cap-gate-'));
afterAll(() => {
  rmSync(work, { recursive: true, force: true });
});
let n = 0;
function file(text: string): string {
  n += 1;
  const f = path.join(work, `report-${String(n)}.json`);
  writeFileSync(f, text);
  return f;
}
function cli(...args: string[]): { status: number | null; stdout: string; stderr: string } {
  const r = spawnSync(process.execPath, [GATE, ...args], { encoding: 'utf8' });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

describe('old-cap gate: the one pass', () => {
  it('G1: exactly one row of the old-cap mount under the browser, status passed, is accepted (each browser)', () => {
    for (const b of BROWSERS) expect(judgeReport(run(b, 'passed'), b)).toBeNull();
  });

  it('G1: other rows, other titles and the other browser (failed or skipped) do not disturb the pass', () => {
    const r = report(row('chromium', 'passed', 'a larger document'), row('chromium', 'passed'), row('webkit', 'failed'), row('webkit', 'skipped', 'a larger document'));
    expect(judgeReport(r, 'chromium')).toBeNull();
  });
});

describe('old-cap gate: a report that is not a report is unmeasured', () => {
  it('G2: a report that is not an object, or has no testResults list, is refused', () => {
    for (const bad of [null, 'text', 3, [], {}, { testResults: 'x' }, { testResults: {} }]) expect(judgeReport(bad, 'chromium'), JSON.stringify(bad)).toMatch(/^unmeasured: .*no testResults list/);
  });

  it('G3: a test file without an assertionResults list is refused, even when another file holds the passing row', () => {
    const good = report(row('chromium', 'passed')).testResults[0];
    expect(judgeReport({ testResults: [good, { name: 'x' }] }, 'chromium')).toMatch(/^unmeasured: .*no assertionResults list/);
    expect(judgeReport({ testResults: [null] }, 'chromium')).toMatch(/^unmeasured: .*no assertionResults list/);
  });

  it('G4: a missing report file is unmeasured, and names it unreadable', () => {
    expect(judgeFile(path.join(work, 'absent.json'), 'chromium')).toMatch(/^unmeasured: the report cannot be read/);
  });

  it('G4: an unreadable report (a directory) is unmeasured', () => {
    mkdirSync(path.join(work, 'dir.json'));
    expect(judgeFile(path.join(work, 'dir.json'), 'chromium')).toMatch(/^unmeasured: the report cannot be read/);
  });

  it('G5: a report that is not JSON is unmeasured', () => {
    expect(judgeFile(file('{"testResults": ['), 'chromium')).toBe('unmeasured: the report is not JSON');
    expect(judgeFile(file(''), 'chromium')).toBe('unmeasured: the report is not JSON');
  });

  it('G1: a report file with the passing row is accepted', () => {
    expect(judgeFile(file(JSON.stringify(run('webkit', 'passed'))), 'webkit')).toBeNull();
  });
});

describe('old-cap gate: no row, or the wrong one, is unmeasured', () => {
  it('G6: no test at all, or none with the row’s title, is refused', () => {
    expect(judgeReport(report(), 'chromium')).toMatch(/^unmeasured: .*no row of the old-cap mount under chromium/);
    expect(judgeReport({ testResults: [] }, 'chromium')).toMatch(/^unmeasured: .*no row/);
    expect(judgeReport(report(row('chromium', 'passed', 'a larger document')), 'chromium')).toMatch(/^unmeasured: .*no row/);
    expect(judgeReport(report(row('chromium', 'passed', `${ROW_TITLE} (edited)`)), 'chromium')).toMatch(/^unmeasured: .*no row/);
  });

  it('G7: a row that passed under the other browser is not this browser’s', () => {
    expect(judgeReport(report(row('webkit', 'passed')), 'chromium')).toMatch(/^unmeasured: .*no row of the old-cap mount under chromium/);
    expect(judgeReport(report(row('chromium', 'passed')), 'webkit')).toMatch(/^unmeasured: .*under webkit/);
  });

  it('G7: a row in the block of an excluded browser is not that browser’s, whatever its status', () => {
    const excluded: Row = { ...row('webkit', 'passed'), ancestorTitles: ['webkit: excluded by DOCREADER_BROWSERS=chromium'] };
    expect(judgeReport(report(excluded), 'webkit')).toMatch(/^unmeasured: .*no row/);
  });

  it('G8: a row with no ancestor titles, or ancestor titles that are not a list, is not under any browser', () => {
    const bare = { ...row('chromium', 'passed'), ancestorTitles: [] as string[] };
    const odd = { ...row('chromium', 'passed'), ancestorTitles: 'chromium' as unknown as string[] };
    expect(judgeReport(report(bare, odd), 'chromium')).toMatch(/^unmeasured: .*no row/);
  });

  it('G9: two rows of the old-cap mount under the browser are refused, passed or not', () => {
    expect(judgeReport(report(row('chromium', 'passed'), row('chromium', 'passed')), 'chromium')).toMatch(/^unmeasured: .*2 rows of the old-cap mount under chromium, not exactly one/);
    expect(judgeReport(report(row('chromium', 'passed'), row('chromium', 'failed')), 'chromium')).toMatch(/^unmeasured: .*2 rows/);
  });

  it('G9: the count spans test files', () => {
    const one = report(row('chromium', 'passed')).testResults[0];
    expect(judgeReport({ testResults: [one, one] }, 'chromium')).toMatch(/^unmeasured: .*2 rows/);
  });
});

describe('old-cap gate: a row that did not pass', () => {
  it('G10: skipped, pending and todo rows are unmeasured, each', () => {
    for (const status of ['skipped', 'pending', 'todo']) expect(judgeReport(run('chromium', status), 'chromium'), status).toBe(`unmeasured: the old-cap mount's status under chromium is "${status}", not passed`);
  });

  it('G10: a status the checker does not know, or none, is unmeasured, never a pass', () => {
    for (const status of ['running', 'queued', '']) expect(judgeReport(run('webkit', status), 'webkit'), status).toMatch(/^unmeasured: .*is "[a-z]*", not passed$/);
    const bare = report(row('webkit', 'passed'));
    delete (bare.testResults[0]?.assertionResults[0] as Partial<Row>).status;
    expect(judgeReport(bare, 'webkit')).toMatch(/^unmeasured: .*is undefined, not passed$/);
  });

  it('G11: a row that ran and failed is a failure, not "unmeasured"', () => {
    const reason = judgeReport(run('chromium', 'failed'), 'chromium');
    expect(reason).toBe('failed: the old-cap mount failed under chromium');
    expect(reason).not.toMatch(/unmeasured/);
  });
});

describe('old-cap gate: the command', () => {
  it('G12: a passing report exits 0 with one line on stdout', () => {
    const r = cli(file(JSON.stringify(run('webkit', 'passed'))), 'webkit');
    expect([r.status, r.stderr]).toEqual([0, '']);
    expect(r.stdout).toBe('old-cap gate: the old-cap mount passed under webkit\n');
  });

  it('G13: a refusal exits 1 with one line on stderr naming the reason, and nothing on stdout', () => {
    const skipped = cli(file(JSON.stringify(run('chromium', 'skipped'))), 'chromium');
    expect([skipped.status, skipped.stdout]).toEqual([1, '']);
    expect(skipped.stderr).toBe(`old-cap gate: unmeasured: the old-cap mount's status under chromium is "skipped", not passed\n`);
    const failed = cli(file(JSON.stringify(run('chromium', 'failed'))), 'chromium');
    expect([failed.status, failed.stderr]).toEqual([1, 'old-cap gate: failed: the old-cap mount failed under chromium\n']);
    const missing = cli(path.join(work, 'nowhere.json'), 'chromium');
    expect([missing.status, missing.stderr]).toEqual([1, expect.stringMatching(/^old-cap gate: unmeasured: the report cannot be read .*\n$/)]);
  });

  it('G14: a usage error (no arguments, one, an unknown browser, a third argument) exits 2 and reads no report', () => {
    const f = file(JSON.stringify(run('chromium', 'passed')));
    for (const args of [[], [f], [f, 'firefox'], [f, 'chromium', 'extra']]) {
      const r = cli(...args);
      expect([args, r.status, r.stdout]).toEqual([args, 2, '']);
      expect(r.stderr).toMatch(/^usage: node scripts\/old-cap-gate\.mjs <vitest-json-report> <chromium\|webkit>\n$/);
    }
  });

  it('G14: main answers the exit code and does not throw on a usage error', () => {
    expect(main([])).toBe(2);
  });
});

describe('old-cap gate: the row it looks for is the one in the test file', () => {
  const SOURCE = readFileSync(path.join(ROOT, 'test', 'browser', 'frame-appearance.test.ts'), 'utf8');

  it('G15: the title is spelled once in the test file, as the measured row’s (it.skipIf the measure switch is off)', () => {
    expect(SOURCE.split(JSON.stringify(ROW_TITLE))).toHaveLength(2);
    expect(SOURCE).toMatch(new RegExp(`it\\.skipIf\\(!MEASURE\\)\\(\\s*${JSON.stringify(ROW_TITLE).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  });

  it('G15: the checker accepts only the browsers the harness runs', () => {
    const harness = readFileSync(path.join(ROOT, 'test', 'browser', 'harness.ts'), 'utf8');
    expect(harness).toContain("BROWSERS: readonly BrowserName[] = ['chromium', 'webkit']");
    expect([...BROWSERS]).toEqual(['chromium', 'webkit']);
  });
});
