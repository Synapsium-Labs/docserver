// Public-readiness of the tree (docserver L1, Task 12; architecture section F T12, global constraint 1).
// The repository goes public at v1, so every file is written as if it were public already. This scanner looks
// for generic shapes of private detail, never for a list of private names (such a list would itself be the
// leak): absolute home and mount paths, private-network host suffixes, RFC 1918 and carrier-grade NAT
// (the 100.64/10 block) addresses, e-mail addresses outside the reserved example domains and noreply, and
// credential shapes. It scans the tree: every file of the checkout, minus the root .git (a directory, or in a
// linked worktree a file holding an absolute path), the build outputs that .gitignore keeps out (node_modules,
// dist, coverage, logs, packed tarballs, the demo page's demo-out/ and the visual comparison's visual-out/ at the
// root), docs/, which holds the programme's working papers and is scrubbed separately before the repository goes
// public, two named root-level scratch directories that tools create and git never tracks, and the woff2 fonts
// directly in assets/fonts, which
// are binary and pinned by hash instead. It walks the directory rather than asking git, so it works in a copy that has no .git;
// where a .git exists, a case checks that the scratch list hides no tracked path. The root-level skips apply at
// the root only: a nested directory of the same name is scanned. Its own synthetic positives are built at run
// time, so this file holds none of them literally and is scanned like any other.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('../', import.meta.url));

/** Directories never walked, at any depth: the ignored build and install output, and the programme's papers. */
const SKIP_DIRS: ReadonlySet<string> = new Set(['node_modules', 'dist', 'coverage', 'docs']);
/** Root-level entries never walked, each with its reason. A nested entry of the same name is scanned. */
const ROOT_SKIP: Readonly<Record<string, string>> = {
  '.git': 'git metadata: a directory, or in a linked worktree a file that holds an absolute path',
  '.superpowers': 'scratch that a planning workflow creates and git never tracks',
  'graphify-out': 'scratch that a code-graph tool creates and git never tracks',
  'demo-out': 'the demo page scripts/demo/build.mjs writes (copies of the assets among it); git-ignored',
  'visual-out': 'the screenshots and reports scripts/visual/compare.mjs writes (a measured page may name anything); git-ignored',
};
/** The ROOT_SKIP entries that a script of this repository writes, so .gitignore must keep them out of git. */
const WRITTEN = ['demo-out', 'visual-out'];
/** Files never read as text, by name: ignored logs, editor litter and packed tarballs. */
const SKIP_FILE = /(?:\.log|\.tgz|^\.DS_Store)$/;
/**
 * Files never read as text, by path from the scanned root: the shipped woff2 fonts in assets/fonts (that directory
 * only), whose bytes are Brotli-compressed binary, so a text check only finds noise there (byte runs such as a
 * tilde and a slash). test/enhance-styles.test.ts pins each one to the sha256 that assets/fonts/README.md records,
 * so a changed, replaced or extra font fails there; a woff2 anywhere else is scanned like any file.
 */
const SKIP_PATH = /^assets\/fonts\/[^/]+\.woff2$/;

/** Every regular file under `root` that the scan reads, relative to `root` with forward slashes, sorted. */
function scannedFiles(dir = ROOT, root = ROOT): string[] {
  const out: string[] = [];
  const atRoot = dir === root;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    const rel = path.relative(root, p).split(path.sep).join('/');
    if (atRoot && Object.hasOwn(ROOT_SKIP, e.name)) continue;
    if (e.isDirectory() && !SKIP_DIRS.has(e.name)) out.push(...scannedFiles(p, root));
    else if (e.isFile() && !SKIP_FILE.test(e.name) && !SKIP_PATH.test(rel)) out.push(rel);
  }
  return out.sort();
}

/** Mail domains reserved for examples and tests (RFC 2606, RFC 6761), and noreply addresses. */
function allowedMail(local: string, domain: string): boolean {
  const d = domain.toLowerCase();
  if (local.toLowerCase() === 'noreply' || d === 'users.noreply.github.com') return true;
  if (/(?:^|\.)example\.(?:com|net|org)$/.test(d)) return true;
  return /\.(?:example|invalid|test|localhost)$/.test(d);
}

/** True for a dotted quad in 10/8, 172.16/12, 192.168/16 or 100.64/10. */
function privateAddress(octets: readonly number[]): boolean {
  const [a = -1, b = -1] = octets;
  if (octets.some((n) => n > 255)) return false;
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}

const CHECKS: readonly { name: string; re: RegExp; keep?: (m: RegExpExecArray) => boolean }[] = [
  { name: 'home or mount path', re: /(?<![\w.~-])(?:\/home\/|\/Users\/|\/root\/|\/mnt\/|\/data\/|~\/|[A-Za-z]:\\Users\\)/g },
  { name: 'private host suffix', re: /\b[A-Za-z0-9-]+\.(?:ts\.net|local|internal|lan)\b/g },
  {
    name: 'private address',
    re: /(?<![\d.])(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(?!\.?\d)/g,
    keep: (m) => privateAddress(m.slice(1, 5).map(Number)),
  },
  {
    name: 'e-mail address',
    re: /([A-Za-z0-9._%+-]+)@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,})\b/g,
    keep: (m) => !allowedMail(m[1] ?? '', m[2] ?? ''),
  },
  {
    name: 'credential',
    re: /\b(?:gh[oprsu]_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{40,}|npm_[A-Za-z0-9]{36}|AKIA[0-9A-Z]{16})\b|-----BEGIN [A-Z ]*PRIVATE KEY-----/g,
  },
];

/** Every private-looking match in a text, as "line: kind: match". */
function scanText(text: string): string[] {
  const out: string[] = [];
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    for (const c of CHECKS) {
      for (const m of line.matchAll(c.re)) {
        if (c.keep === undefined || c.keep(m as RegExpExecArray)) out.push(`${i + 1}: ${c.name}: ${m[0]}`);
      }
    }
  });
  return out;
}

/** Join pieces at run time, so this file never holds a positive literally. */
const j = (...parts: string[]): string => parts.join('');

describe('public-ready: the scanner', () => {
  it('finds each kind of private detail', () => {
    const positives = [
      j('/ho', 'me/someone/x'),
      j('/Us', 'ers/someone'),
      j('see ~', '/.config/app'),
      j('/ro', 'ot/.ssh'),
      j('/m', 'nt/volume_1'),
      j('/da', 'ta/projects'),
      j('C:', '\\', 'Users', '\\', 'someone'),
      j('box.tail1234.', 'ts.net'),
      j('printer.', 'local'),
      j('db.corp.', 'internal'),
      [10, 1, 2, 3].join('.'),
      [172, 16, 0, 1].join('.'),
      [172, 31, 255, 255].join('.'),
      [192, 168, 1, 1].join('.'),
      [100, 64, 0, 1].join('.'),
      [100, 127, 255, 255].join('.'),
      j('someone', '@', 'company.com'),
      j('gh', 'o_', 'a'.repeat(36)),
      j('npm', '_', 'B'.repeat(36)),
      j('-----BEGIN ', 'RSA PRIVATE KEY-----'),
    ];
    expect(positives.filter((p) => scanText(p).length !== 1)).toEqual([]);
  });

  it('passes what is public: reserved domains, noreply, public addresses, versions and package names', () => {
    const negatives = [
      [100, 63, 0, 1].join('.'),
      [100, 128, 0, 1].join('.'),
      [172, 15, 0, 1].join('.'),
      [172, 32, 0, 1].join('.'),
      [127, 0, 0, 1].join('.'),
      [8, 8, 8, 8].join('.'),
      [110, 1, 2, 3].join('.'),
      [10, 1, 2, 3, 4].join('.'),
      j('noreply', '@', 'example.invalid'),
      j('me', '@', 'example.invalid'),
      j('someone', '@', 'example.com'),
      j('x', '@', 'y.test'),
      j('12345+someone', '@', 'users.noreply.github.com'),
      'markdown-it@14.3.2 and @synapsium-labs/docserver and actions/checkout@v4',
      'https://github.com/Synapsium-Labs/docserver and ./node_modules/.bin/vitest',
      j('a/ho', 'me/b is not a home path, nor is docs/da', 'ta/x'),
    ];
    expect(negatives.filter((n) => scanText(n).length !== 0)).toEqual([]);
  });

  it('walks the tree, minus the root .git, the ignored build output, docs/ and the named scratch directories', () => {
    const files = scannedFiles();
    for (const must of ['package.json', 'README.md', '.github/workflows/ci.yml', 'src/render/index.ts', 'conformance/reference/PROVENANCE.json', 'test/public-ready.test.ts']) {
      expect(files).toContain(must);
    }
    expect(
      files.filter(
        (f) => /^(?:node_modules|dist|docs|\.git|\.superpowers|graphify-out|demo-out|visual-out)\//.test(f) || f === '.git' || f.endsWith('.tgz') || SKIP_PATH.test(f),
      ),
    ).toEqual([]);
  });
});

/** Build a throwaway tree of files under the system temp directory, run `use` on it, and remove it. */
function withTree<T>(files: Readonly<Record<string, string>>, use: (root: string) => T): T {
  const root = mkdtempSync(path.join(tmpdir(), 'docserver-walk-'));
  try {
    for (const [rel, text] of Object.entries(files)) {
      mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
      writeFileSync(path.join(root, rel), text);
    }
    return use(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

/** What the tree test would report for a throwaway tree: every private-looking match, with its file. */
function foundIn(root: string): string[] {
  return scannedFiles(root, root).flatMap((f) => scanText(readFileSync(path.join(root, f), 'utf8')).map((s) => `${f}:${s}`));
}

describe('public-ready: the walk skips the root entries only', () => {
  const hit = `${j('/ho', 'me/someone/x')}\n`;

  it('skips a root .git file, a root .git directory and each named root scratch directory', () => {
    const files = {
      '.superpowers/sdd/x.md': hit,
      'graphify-out/graph.json': hit,
      'demo-out/index.html': hit,
      'visual-out/report.txt': hit,
      'src/a.ts': 'export {};\n',
    };
    expect(withTree({ ...files, '.git': hit }, (root) => [scannedFiles(root, root), foundIn(root)])).toEqual([['src/a.ts'], []]);
    expect(withTree({ ...files, '.git/config': hit }, (root) => [scannedFiles(root, root), foundIn(root)])).toEqual([['src/a.ts'], []]);
  });

  it('control: a planted hit in an ordinary directory is found', () => {
    expect(withTree({ 'src/a.ts': hit }, foundIn)).toEqual([`src/a.ts:1: home or mount path: ${j('/ho', 'me/')}`]);
  });

  it('a woff2 is skipped only directly in assets/fonts: one anywhere else, or deeper, is scanned', () => {
    const files = { 'assets/fonts/a.woff2': hit, 'assets/fonts/sub/b.woff2': hit, 'src/c.woff2': hit, 'd.woff2': hit };
    const found = withTree(files, foundIn);
    expect(found.map((f) => f.split(':')[0])).toEqual(['assets/fonts/sub/b.woff2', 'd.woff2', 'src/c.woff2']);
  });

  it('a nested directory that shares a skipped name, and a nested .git file or directory, are scanned', () => {
    const nested = ['src/.superpowers/x', 'src/graphify-out/x', 'src/.git', 'sub/.git/config', 'scripts/visual/visual-out/x', 'test/demo-out/x'];
    const found = withTree(Object.fromEntries(nested.map((f) => [f, hit])), foundIn);
    expect(found.map((f) => f.split(':')[0])).toEqual([...nested].sort());
  });

  it('each root directory a script of this repository writes is git-ignored, so it never reaches a commit', () => {
    const ignored = readFileSync(path.join(ROOT, '.gitignore'), 'utf8').split('\n').map((l) => l.trim());
    expect(WRITTEN.filter((d) => !ignored.includes(`${d}/`))).toEqual([]);
    expect(WRITTEN.filter((d) => !Object.hasOwn(ROOT_SKIP, d))).toEqual([]);
  });

  // Where a .git exists (CI's checkout, a worktree), the list must not hide anything git tracks. A copy made without
  // .git (the mutation procedure's) has nothing to ask.
  it.skipIf(!existsSync(path.join(ROOT, '.git')))('no tracked path lies under a root entry the walk skips', () => {
    const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8' }).split('\0').filter((f) => f !== '');
    expect(tracked.length).toBeGreaterThan(0);
    expect(tracked.filter((f) => Object.keys(ROOT_SKIP).some((n) => f === n || f.startsWith(`${n}/`)))).toEqual([]);
  });
});

describe('public-ready: the tree', () => {
  it('no file holds a home path, a private host or address, a personal e-mail address or a credential', () => {
    const found = scannedFiles().flatMap((f) => scanText(readFileSync(path.join(ROOT, f), 'utf8')).map((s) => `${f}:${s}`));
    expect(found).toEqual([]);
  });
});
