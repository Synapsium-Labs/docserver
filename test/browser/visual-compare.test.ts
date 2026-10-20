// The visual comparison script end to end (scripts/visual/compare.mjs; docserver L2, Task 6), in Chromium, on two
// local pages in a throwaway directory (file URLs only: the script opens no network here). Equal pages exit 0; a
// block 1 px wider exits 1 and names it; an --expected file that names it exits 0 and reports it by that name; the
// screenshots and the report land in visual-out/ under the current directory.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { SELECTION, excludedTitle } from './harness.js';

const SCRIPT = fileURLToPath(new URL('../../scripts/visual/compare.mjs', import.meta.url));
const dir = mkdtempSync(path.join(tmpdir(), 'docserver-visual-'));

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

function page(name: string, width: number): string {
  const file = path.join(dir, name);
  writeFileSync(
    file,
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>x</title></head><body>` +
      `<h1 data-line="1-1">Title</h1><p data-line="3-3" style="width: ${String(width)}px">Text</p></body></html>\n`,
  );
  return file;
}

function compare(...args: string[]): { status: number | null; out: string } {
  const r = spawnSync(process.execPath, [SCRIPT, '--states', 'light', ...args], { cwd: dir, encoding: 'utf8', timeout: 120_000 });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
}

(SELECTION.run.includes('chromium') ? describe : describe.skip)(
  SELECTION.run.includes('chromium') ? 'compare.mjs in chromium' : excludedTitle('chromium', SELECTION),
  () => {
    it('equal pages exit 0, with the screenshots and the report in visual-out/', () => {
      const a = page('a.html', 300);
      const r = compare('--ours', a, '--reference', page('b.html', 300));
      expect(r).toMatchObject({ status: 0 });
      expect(r.out).toContain('result: 0 unexpected differences');
      for (const f of ['desktop-light-ours.png', 'desktop-light-reference.png', 'phone-light-ours.png', 'phone-light-reference.png', 'report.txt', 'measure.json']) {
        expect(existsSync(path.join(dir, 'visual-out', f))).toBe(true);
      }
    });

    it('a block 1 px wider exits 1 and is named; an expected entry that names it exits 0 and reports it by name', () => {
      const a = page('a.html', 300);
      const b = page('c.html', 301);
      const r = compare('--ours', a, '--reference', b);
      expect(r.status).toBe(1);
      expect(r.out).toContain('UNEXPECTED p@3-3 box.width: ours=300 reference=301');
      expect(r.out).toContain('UNEXPECTED p@3-3 width: ours=300px reference=301px');
      writeFileSync(path.join(dir, 'expected.json'), JSON.stringify([{ name: 'a wider block', blocks: ['p@*'], props: ['width', 'box.width'] }]));
      const named = compare('--ours', a, '--reference', b, '--expected', path.join(dir, 'expected.json'));
      expect(named.status).toBe(0);
      expect(named.out).toContain('expected (a wider block): 2');
      expect(readFileSync(path.join(dir, 'visual-out', 'report.txt'), 'utf8')).toContain('result: 0 unexpected differences');
    });

    it('a usage error exits 2; a named state with no setup module is refused', () => {
      expect(compare('--ours', 'a.html').status).toBe(2);
      const r = spawnSync(process.execPath, [SCRIPT, '--ours', 'a.html', '--reference', 'b.html', '--states', 'folded'], { cwd: dir, encoding: 'utf8' });
      expect([r.status, r.stderr]).toEqual([2, 'compare: the states folded need a --setup module that exports act()\n']);
    });
  },
);
