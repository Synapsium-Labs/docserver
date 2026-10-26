// The visual comparison script end to end (scripts/visual/compare.mjs; docserver L2, Task 6), in Chromium, on local
// pages in a throwaway directory, always with --offline: the browser resolves no host and every request that is not
// for a file is refused and reported. Equal pages exit 0; a block 1 px wider exits 1 and names it; an --expected
// file that names it exits 0 and reports it by that name; extra space between two blocks is a gap difference;
// pages that share no block, a page that does not open and a browser that cannot start exit 3, the last naming the
// install command; the screenshots and the report land in visual-out/ under the current directory. And the demo
// page (scripts/demo/build.mjs): --sample and --out are read, --reuse-assets is explicit, anything else is refused,
// and the page marks itself ready, which the script waits for.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { INSTALL } from '../../scripts/visual/compare.mjs';
import { SELECTION, excludedTitle } from './harness.js';

const SCRIPT = fileURLToPath(new URL('../../scripts/visual/compare.mjs', import.meta.url));
const DEMO = fileURLToPath(new URL('../../scripts/demo/build.mjs', import.meta.url));
const TABLES = fileURLToPath(new URL('../../conformance/layout/core/tables.md', import.meta.url));
const dir = mkdtempSync(path.join(tmpdir(), 'docserver-visual-'));

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

/** A local page: a heading and a paragraph of `width` px, `between` put between them, `body` after. */
function page(name: string, width: number, between = '', body = ''): string {
  const file = path.join(dir, name);
  writeFileSync(
    file,
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>x</title></head><body>` +
      `<h1 data-line="1-1">Title</h1>${between}<p data-line="3-3" style="width: ${String(width)}px">Text</p>${body}</body></html>\n`,
  );
  return file;
}

function run(args: readonly string[], env: NodeJS.ProcessEnv = process.env, cwd = dir): { status: number | null; out: string } {
  const states = args.includes('--states') ? [] : ['--states', 'light'];
  const r = spawnSync(process.execPath, [SCRIPT, ...states, '--offline', ...args], { cwd, env, encoding: 'utf8', timeout: 120_000 });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
}

function freshOut(name: string): string {
  return mkdtempSync(path.join(dir, `${name}-`));
}

function expectCompactOutput(out: string): void {
  expect(readdirSync(path.join(out, 'visual-out'))).toEqual(['report.txt']);
}

describe('compare.mjs and the demo, without a browser', () => {
  it('a browser that cannot start exits 3 and names the install command', () => {
    const empty = mkdtempSync(path.join(tmpdir(), 'docserver-no-browsers-'));
    try {
      const r = run(['--ours', page('a.html', 300), '--reference', page('b.html', 300)], { ...process.env, PLAYWRIGHT_BROWSERS_PATH: empty });
      expect(r.status, r.out).toBe(3);
      expect(r.out).toContain(`Install the pinned browsers with: ${INSTALL}`);
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });

  it('a usage error exits 2; a named state with no setup module, and an unreadable expected file, are refused', () => {
    expect(run(['--ours', 'a.html']).status).toBe(2);
    const r = spawnSync(process.execPath, [SCRIPT, '--ours', 'a.html', '--reference', 'b.html', '--states', 'folded'], { cwd: dir, encoding: 'utf8' });
    expect([r.status, r.stderr]).toEqual([2, 'compare: the states folded need a --setup module that exports act()\n']);
    writeFileSync(path.join(dir, 'bad.json'), '{}');
    const bad = run(['--ours', 'a.html', '--reference', 'b.html', '--expected', path.join(dir, 'bad.json')]);
    expect([bad.status, bad.out]).toEqual([2, 'compare: the expected file is a JSON list\n']);
  });

  it('the demo build reads --sample and --out, accepts --reuse-assets once, and refuses anything else', () => {
    for (const bad of [['--bogus'], ['--sample'], ['--sample', TABLES, '--sample', TABLES], ['--reuse-assets', '--reuse-assets'], ['--out', dir]]) {
      const r = spawnSync(process.execPath, [DEMO, ...bad], { encoding: 'utf8' });
      expect(r.status, r.stderr).toBe(2);
      expect(r.stderr).toMatch(/^(usage: node scripts\/demo\/build\.mjs \[--sample <file>\] \[--out <dir>\] \[--reuse-assets\]|demo: .* exists; --out names a directory that does not exist yet)\n$/);
    }
  });
});

(SELECTION.run.includes('chromium') ? describe : describe.skip)(
  SELECTION.run.includes('chromium') ? 'compare.mjs in chromium' : excludedTitle('chromium', SELECTION),
  () => {
    it('equal pages exit 0, with the screenshots and the report in visual-out/', () => {
      const a = page('a.html', 300);
      const r = run(['--ours', a, '--reference', page('b.html', 300)]);
      expect(r.status, r.out).toBe(0);
      expect(r.out).toContain('desktop-light: 2 blocks in both pages, 0 differences, 0 unexpected');
      expect(r.out).toContain('result: 0 unexpected differences');
      for (const f of ['desktop-light-ours.png', 'desktop-light-reference.png', 'phone-light-ours.png', 'phone-light-reference.png', 'report.txt', 'measure.json']) {
        expect(existsSync(path.join(dir, 'visual-out', f))).toBe(true);
      }
    });

    it('a block 1 px wider exits 1 and is named; an expected entry that names it exits 0 and reports it by name', () => {
      const a = page('a.html', 300);
      const b = page('c.html', 301);
      const r = run(['--ours', a, '--reference', b]);
      expect(r.status, r.out).toBe(1);
      expect(r.out).toContain('UNEXPECTED p@3-3 box.width: ours=300 reference=301');
      expect(r.out).toContain('UNEXPECTED p@3-3 width: ours=300px reference=301px');
      writeFileSync(path.join(dir, 'expected.json'), JSON.stringify([{ name: 'a wider block', blocks: ['p@*'], props: ['width', 'box.width'] }]));
      const named = run(['--ours', a, '--reference', b, '--expected', path.join(dir, 'expected.json')]);
      expect(named.status, named.out).toBe(0);
      expect(named.out).toContain('expected (a wider block): 2');
      expect(readFileSync(path.join(dir, 'visual-out', 'report.txt'), 'utf8')).toContain('result: 0 unexpected differences');
    });

    it('extra space between two blocks exits 1 as a gap difference', () => {
      const r = run(['--ours', page('spaced.html', 300, '<div style="height: 50px"></div>'), '--reference', page('b.html', 300)]);
      expect(r.status, r.out).toBe(1);
      expect(r.out).toMatch(/UNEXPECTED p@3-3 box\.gap: ours=\d+(\.\d+)? reference=\d+(\.\d+)?/);
    });

    it('compact mode compares a named action for both pages without PNGs or measure.json', () => {
      const setup = path.join(dir, 'compact-setup.mjs');
      const out = freshOut('compact-out');
      writeFileSync(setup, `export async function act({ page, side, state }) {\n  if (state === 'folded') await page.evaluate((width) => { document.querySelector('p').style.width = width; }, side === 'ours' ? '301px' : '302px');\n}\n`);
      const r = run(['--compact', '--ours', page('compact-a.html', 300), '--reference', page('compact-b.html', 300), '--states', 'folded', '--setup', setup], process.env, out);
      expect(r.status, r.out).toBe(1);
      for (const combo of ['desktop-folded', 'phone-folded']) {
        const section = r.out.match(new RegExp(`${combo}:.*?(?=\\n(?:desktop|phone)-|\\nresult:)`, 's'))?.[0] ?? '';
        expect(section).toContain(`${combo}: 2 blocks in both pages, 2 differences, 2 unexpected`);
        expect(section).toContain('UNEXPECTED p@3-3 box.width: ours=301 reference=302');
        expect(section).toContain('UNEXPECTED p@3-3 width: ours=301px reference=302px');
      }
      expectCompactOutput(out);
    });

    it('compact mode preserves the equal-page result without full artifacts', () => {
      const out = freshOut('compact-equal-out');
      const r = run(['--compact', '--ours', page('compact-equal-a.html', 300), '--reference', page('compact-equal-b.html', 300)], process.env, out);
      expect(r.status, r.out).toBe(0);
      expect(r.out).toContain('desktop-light: 2 blocks in both pages, 0 differences, 0 unexpected');
      expect(r.out).toContain('result: 0 unexpected differences');
      expectCompactOutput(out);
    });

    it('compact mode retains expected difference reporting and its exit status', () => {
      const out = freshOut('compact-expected-out');
      const expected = path.join(dir, 'compact-expected.json');
      writeFileSync(expected, JSON.stringify([{ name: 'compact width', blocks: ['p@*'], props: ['width', 'box.width'] }]));
      const r = run(['--compact', '--ours', page('compact-expected-a.html', 300), '--reference', page('compact-expected-b.html', 301), '--expected', expected], process.env, out);
      expect(r.status, r.out).toBe(0);
      expect(r.out).toContain('expected (compact width): 2');
      expect(readFileSync(path.join(out, 'visual-out', 'report.txt'), 'utf8')).toContain('result: 0 unexpected differences');
      expectCompactOutput(out);
    });

    it('--offline refuses and reports every request that is not for a file', () => {
      const img = '<img alt="" src="http://unrouted.localhost:2/x.png">';
      const r = run(['--ours', page('img.html', 300, '', img), '--reference', page('b.html', 300)]);
      expect(r.status, r.out).toBe(0);
      expect(r.out).toContain('offline: refused http://unrouted.localhost:2/x.png');
    });

    it('pages that share no measured block exit 3: nothing was compared', () => {
      const none = path.join(dir, 'none.html');
      writeFileSync(none, '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>x</title></head><body><p>No blocks.</p></body></html>\n');
      const r = run(['--ours', none, '--reference', none]);
      expect(r.status, r.out).toBe(3);
      expect(r.out).toContain('desktop-light: no block is in both pages (ours 0, reference 0); nothing was compared');
    });

    it('a page that does not open exits 3, never the exit status of a difference', () => {
      const r = run(['--ours', page('a.html', 300), '--reference', path.join(dir, 'no-such-page.html')]);
      expect(r.status, r.out).toBe(3);
      expect(r.out).toContain('compare: nothing was compared: page.goto: net::ERR_FILE_NOT_FOUND');
    });

    it('the demo page of a sample marks itself ready, and the script compares it', { timeout: 120_000 }, () => {
      const out = path.join(dir, 'demo');
      const built = spawnSync(process.execPath, [DEMO, '--sample', TABLES, '--out', out, '--reuse-assets'], { encoding: 'utf8', timeout: 120_000 });
      expect(built.status).toBe(0);
      const html = readFileSync(path.join(out, 'index.html'), 'utf8');
      expect(html).toContain('<html lang="en" data-ready="false">');
      expect(html).toContain('<title>Tables</title>');
      expect(html).toContain('file:///');
      expect(existsSync(path.join(out, 'assets'))).toBe(false);
      const index = path.join(out, 'index.html');
      const r = run(['--ours', index, '--reference', index]);
      expect(r.status, r.out).toBe(0);
      expect(r.out).toMatch(/desktop-light: [1-9]\d* blocks in both pages, 0 differences, 0 unexpected/);
    });
  },
);
