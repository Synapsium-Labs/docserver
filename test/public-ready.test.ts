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
//
// The shapes themselves live in scripts/public-shapes.mjs (docserver L3, Task 14), so this tree test and the history
// scan (scripts/history-scan.mjs, which reads every object of the history and every GitHub text before the repository
// goes public) look for one list of shapes, never two that drift apart.
//
// L3 Task 14 adds the release files' pins: package.json's publishConfig and exact repository URL (npm provenance
// compares it), the MIT LICENSE, SECURITY.md, .github/CODEOWNERS, THIRD-PARTY-NOTICES covering both Mermaid files and
// the four runtime libraries, the font licence in the packed files, .github/release-signers (L3.W10: no key line while
// the package is private, at least one `release-signer` key line once it is not), and the one pin that the package is
// still private, which Task 15 flips in the v1 release PR.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEPENDENCY_NOTICES_BEGIN, NOTICES_BEGIN, dependencyNoticesSection, dependencyPackages, readDependencyNoticesSection, readNoticesSection } from '../scripts/build-mermaid.mjs';
import { findShapes } from '../scripts/public-shapes.mjs';

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
 * so a changed, replaced or extra font fails there; a woff2 anywhere else is scanned like any file. And everything
 * under assets/mermaid, the Mermaid file the build writes (L2 Task 15): third-party code, git-ignored like dist, and
 * measured by test/mermaid-bundle.test.ts instead.
 */
const SKIP_PATH = /^assets\/fonts\/[^/]+\.woff2$|^assets\/mermaid\//;

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

/** Every private-looking match in a text, as "line: kind: match" (the shapes are scripts/public-shapes.mjs's). */
function scanText(text: string): string[] {
  return findShapes(text).map((f) => `${String(f.line)}: ${f.shape}: ${f.match}`);
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

  it('the built Mermaid file in assets/mermaid is skipped; a mermaid directory anywhere else is scanned', () => {
    const files = { 'assets/mermaid/mermaid.mjs': hit, 'assets/mermaidx/y.mjs': hit, 'src/assets/mermaid/z.mjs': hit, 'src/mermaid/x.mjs': hit };
    const found = withTree(files, foundIn);
    expect(found.map((f) => f.split(':')[0])).toEqual(['assets/mermaidx/y.mjs', 'src/assets/mermaid/z.mjs', 'src/mermaid/x.mjs']);
  });

  it.skipIf(!existsSync(path.join(ROOT, '.git')))('assets/mermaid is git-ignored, and git tracks nothing under it', () => {
    const ignored = readFileSync(path.join(ROOT, '.gitignore'), 'utf8').split('\n').map((l) => l.trim());
    expect(ignored).toContain('assets/mermaid/');
    const tracked = execFileSync('git', ['ls-files', '-z', '--', 'assets/mermaid'], { cwd: ROOT, encoding: 'utf8' });
    expect(tracked).toBe('');
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

// ───────── the release files (L3 Task 14) ─────────

const readRoot = (rel: string): string => readFileSync(path.join(ROOT, rel), 'utf8');
/** Every TypeScript and JavaScript source under test/, at any depth, as a path from the root, sorted. */
function testSources(dir = 'test'): string[] {
  const out: string[] = [];
  for (const e of readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) out.push(...testSources(rel));
    else if (/\.(?:[cm]?ts|[cm]?js)$/.test(e.name)) out.push(rel);
  }
  return out.sort();
}
/**
 * True when a text asserts on a `private` field: a `.private` or `['private']` read handed to an assertion, a
 * `toHaveProperty('private', …)`, or a `toMatchObject` naming `private`. Read as text, a comment counts too.
 */
function pinsPrivate(text: string): boolean {
  const read = /(?:\?\.|\.)private\b|\[\s*['"]private['"]\s*\]/;
  return text.split('\n').some(
    (l) =>
      (read.test(l) && /\)\s*(?:\.not)?\s*\.to[A-Z]\w*\(/.test(l) && /\bexpect\s*\(/.test(l)) ||
      /toHaveProperty\(\s*['"]private['"]/.test(l) ||
      /toMatchObject\([^)]*\bprivate\s*:/.test(l),
  );
}
const manifest = JSON.parse(readRoot('package.json')) as {
  private?: unknown;
  license?: unknown;
  files?: unknown;
  publishConfig?: unknown;
  repository?: unknown;
  dependencies?: Record<string, string>;
};

/** A key line of .github/release-signers (ssh-keygen's allowed-signers format): the principal, optional options, a key type and a key. */
const KEY_LINE = /^release-signer\s+(?:\S+\s+)?\S+\s+[A-Za-z0-9+/]+={0,2}(?:\s.*)?$/;

/**
 * Why a signers file may not stand beside a package that is (or is not) private (L3.W10): the header names the
 * principal; while private, the file holds no key line (the key line is the operator's, Q9, and lands in the v1 release
 * PR with the flip of `private`); once not private, it holds at least one key line, and every line that is not a
 * comment is a `release-signer` key line. Empty when it may.
 */
function signersProblems(text: string, isPrivate: boolean): string[] {
  const lines = text.split('\n');
  const comments = lines.filter((l) => /^\s*#/.test(l));
  const keys = lines.filter((l) => !/^\s*(?:#|$)/.test(l));
  const out: string[] = [];
  if (!comments.some((l) => /\brelease-signer\b/.test(l))) out.push('the header does not name the principal release-signer');
  if (isPrivate && keys.length > 0) out.push('a key line while the package is private');
  if (!isPrivate && keys.length === 0) out.push('no key line once the package is public');
  for (const k of keys) if (!KEY_LINE.test(k)) out.push(`not a release-signer key line: line ${String(lines.indexOf(k) + 1)}`);
  return out;
}

describe('public-ready: the release files (L3 Task 14)', () => {
  it('package.json is still private: Task 15 flips this pin, and only this one, in the v1 release PR', () => {
    expect(manifest.private).toBe(true);
  });

  it('this file holds the only pin of package.json\'s private field among the tests, so Task 15 flips exactly one', () => {
    const files = testSources();
    expect(files).toContain('test/public-ready.test.ts');
    expect(files.filter((f) => f.startsWith('test/browser/')).length).toBeGreaterThan(0);
    expect(files.filter((f) => pinsPrivate(readRoot(f)))).toEqual(['test/public-ready.test.ts']);
  });

  it('control: the pin scan finds a private pin in every assertion form, and walks every directory under test/', () => {
    const subject = ['manifest', 'pkg', 'json'];
    const forms = [
      (o: string) => `expect(${o}.private).toBe(true)`,
      (o: string) => `expect(${o}.private).toEqual(true)`,
      (o: string) => `expect(${o}.private).toStrictEqual(true)`,
      (o: string) => `expect(${o}.private).not.toBe(false)`,
      (o: string) => `expect(${o}['private']).toBe(true)`,
      (o: string) => `expect(${o}["private"] ).toEqual(true)`,
      (o: string) => `expect(${o}).toHaveProperty('private', true)`,
      (o: string) => `expect(${o}).toMatchObject({ private: true })`,
      (o: string) => `expect(${o}?.private).toBeTruthy()`,
    ];
    for (const o of subject) for (const f of forms) expect([f(o), pinsPrivate(f(o))]).toEqual([f(o), true]);
    for (const clean of ['const pkg = { private: true };', "packageDir({ version: '1.0.0', private: value }, '1.0.0')", 'expect(manifest.version).toBe(1)']) {
      expect([clean, pinsPrivate(clean)]).toEqual([clean, false]);
    }
  });

  it('publishes for the public, with provenance, from exactly this repository (npm compares the provenance to repository.url)', () => {
    expect(manifest.publishConfig).toEqual({ access: 'public', provenance: true });
    expect(manifest.repository).toEqual({ type: 'git', url: 'git+https://github.com/Synapsium-Labs/docserver.git' });
  });

  it('is MIT: the package says so and LICENSE is the MIT licence', () => {
    expect(manifest.license).toBe('MIT');
    const licence = readRoot('LICENSE');
    expect(licence.split('\n')[0]).toBe('MIT License');
    expect(licence).toContain('Permission is hereby granted, free of charge, to any person obtaining a copy');
  });

  it('SECURITY.md sends a vulnerability to a private advisory, never a public issue', () => {
    const security = readRoot('SECURITY.md');
    expect(security).toContain('https://github.com/Synapsium-Labs/docserver/security/advisories/new');
    expect(security).toMatch(/do not open a public issue/i);
  });

  it('.github/CODEOWNERS asks a code owner to review the workflows and signers, the assets, the frame and the host', () => {
    const rules = readRoot('.github/CODEOWNERS')
      .split('\n')
      .filter((l) => !/^\s*(?:#|$)/.test(l))
      .map((l) => l.trim().split(/\s+/));
    expect(rules.map((r) => r[0])).toEqual(['/.github/', '/assets/', '/src/frame*', '/src/host/']);
    expect(rules.filter((r) => r.length < 2 || !r.slice(1).every((o) => /^@[A-Za-z0-9-]+\/[A-Za-z0-9_.-]+$/.test(o)))).toEqual([]);
  });

  it('ships the font licence: assets/ is in files, and assets.json lists fonts/OFL.txt', () => {
    expect(manifest.files).toContain('assets');
    expect((manifest.files as string[]).filter((f) => f.startsWith('!'))).toEqual([]);
    const assets = JSON.parse(readRoot('assets/assets.json')) as { files: { path: string }[] };
    expect(assets.files.map((f) => f.path)).toContain('fonts/OFL.txt');
    expect(readRoot('assets/fonts/OFL.txt')).toContain('SIL OPEN FONT LICENSE Version 1.1');
  });

  it('THIRD-PARTY-NOTICES covers both Mermaid files, under one heading and in the generated section', () => {
    const text = readRoot('THIRD-PARTY-NOTICES');
    expect(text).toContain('\nMermaid (assets/mermaid/mermaid.mjs and assets/mermaid/mermaid.frame.js)\n');
    const section = readNoticesSection(text) ?? '';
    expect(section.startsWith(NOTICES_BEGIN)).toBe(true);
    expect(section).toContain('assets/mermaid/mermaid.mjs and assets/mermaid/mermaid.frame.js are Mermaid 12.1.0');
  });

  it('THIRD-PARTY-NOTICES lists the four runtime libraries, highlight.js, markdown-it, markdown-it-footnote and js-yaml, each with its version, licence and licence text', () => {
    const packages = dependencyPackages(ROOT);
    expect(packages.map((p) => p.name)).toEqual(['highlight.js', 'js-yaml', 'markdown-it', 'markdown-it-footnote']);
    expect(packages.map((p) => p.name)).toEqual(Object.keys(manifest.dependencies ?? {}).filter((n) => !n.startsWith('@types/')).sort());
    const text = readRoot('THIRD-PARTY-NOTICES');
    expect(readDependencyNoticesSection(text)).toBe(dependencyNoticesSection(packages));
    expect(text.indexOf(DEPENDENCY_NOTICES_BEGIN)).toBeGreaterThan(text.indexOf(NOTICES_BEGIN));
    for (const p of packages) {
      expect(p.version).toBe(manifest.dependencies?.[p.name]);
      expect(text).toContain(`${p.name} ${p.version} (${p.licence})`);
    }
  });

  it('L3.W10: .github/release-signers names the principal and holds no key line while the package is private', () => {
    expect(signersProblems(readRoot('.github/release-signers'), manifest.private === true)).toEqual([]);
  });

  it('L3.W10: the rule refuses a key line while private, and once public refuses a file with no key line or a foreign principal', () => {
    const header = '# Principal: release-signer.\n';
    const key = 'release-signer ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIFixtureKeyMaterialOnlyForTests0000000000 fixture\n';
    expect(signersProblems(header, true)).toEqual([]);
    expect(signersProblems(`${header}${key}`, false)).toEqual([]);
    expect(signersProblems(`${header}${key}`, true)).toEqual(['a key line while the package is private']);
    expect(signersProblems(header, false)).toEqual(['no key line once the package is public']);
    expect(signersProblems(`${header}${key.replace('release-signer', 'someone-else')}`, false)).toEqual(['not a release-signer key line: line 2']);
    expect(signersProblems(`# no principal\n${key}`, false)).toEqual(['the header does not name the principal release-signer']);
  });
});
