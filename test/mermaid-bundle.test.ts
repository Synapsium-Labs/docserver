// The self-hosted Mermaid file (docserver L2, Task 15; LD3; spec §3.4, §3.6), as scripts/build-mermaid.mjs builds
// it: in memory, never into the checkout, so the test needs no `npm run build` first (CI runs the tests before the
// build). It checks what the file is: one ESM file whose only export is the default (Mermaid's API), with no
// `import()` and no import left, so nothing loads after it; no elkjs among its inputs (elkjs is EPL-2.0, which §3.6
// keeps out) and no trace of elkjs's code in it; every input inside the package root, so a build in a checkout whose
// node_modules is a link names no path outside it; the same bytes from two builds; and its size within MAX_BYTES.
// Then THIRD-PARTY-NOTICES: its generated section is exactly what the build's metafile gives, so every package the
// metafile names is there with its licence and its LICENSE text, and nothing else is; and the packages whose code ships
// inside a pre-built file of one of those, which the metafile cannot see, are named as such (EMBEDDED), measured from
// the module keys the bundled files carry. Last, the script's command line: the usage refusal, a failing build, and the
// `--notices` write, each in a throwaway copy of the scripts.
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  ELK_SIGNATURE,
  EMBEDDED,
  MAX_BYTES,
  NOTICES_BEGIN,
  NOTICES_END,
  NO_LICENCE_FIELD,
  buildMermaid,
  embeddedMarkers,
  licenceFiles,
  noticesSection,
  packagesOf,
  readNoticesSection,
  withNoticesSection,
  type Built,
} from '../scripts/build-mermaid.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const NOTICES = path.join(ROOT, 'THIRD-PARTY-NOTICES');

let first: Built;
let second: Built;

beforeAll(async () => {
  first = await buildMermaid({ root: ROOT });
  second = await buildMermaid({ root: ROOT });
}, 300_000);

describe('the Mermaid file', () => {
  it('is one ESM file, its only export the default, with no import() and no import left', () => {
    expect(first.outputs).toEqual(['assets/mermaid/mermaid.mjs']);
    expect(first.exports).toEqual(['default']);
    expect(first.imports).toEqual([]);
    expect(first.text).not.toMatch(/\bimport\s*\(/);
  });

  it('bundles no elkjs: no input from it, the stub in its place, and no ELK code in the file', () => {
    expect(first.inputs.filter((i) => /(?:^|\/)node_modules\/elkjs\//.test(i))).toEqual([]);
    expect(first.inputs).toContain('scripts/mermaid-elk-stub.mjs');
    expect(first.text.split(ELK_SIGNATURE).length - 1).toBe(0);
  });

  it('the ELK signature is elkjs\'s own: the package\'s bundled file holds it', () => {
    const elk = readFileSync(path.join(ROOT, 'node_modules', 'elkjs', 'lib', 'elk.bundled.js'), 'utf8');
    expect(elk.split(ELK_SIGNATURE).length - 1).toBeGreaterThan(100);
  });

  it('reads every input from inside the package: node_modules, the stub, or the entry', () => {
    // (The file still holds `../../node_modules/.pnpm/…` module keys: a pre-built dependency's own, made when that
    // package was built, and the same in every build of this one.)
    expect(first.inputs.length).toBeGreaterThan(100);
    expect(first.inputs.filter((i) => !/^(?:node_modules\/|scripts\/mermaid-elk-stub\.mjs$|mermaid-entry\.mjs$)/.test(i))).toEqual([]);
  });

  it('is the same bytes from two builds', () => {
    expect(second.sha256).toBe(first.sha256);
    expect(second.bytes).toBe(first.bytes);
  });

  it('stays within 4 MiB (about 3.75 MB measured for Mermaid 12.1.0 without elkjs)', () => {
    expect(MAX_BYTES).toBe(4 * 1024 * 1024);
    expect(first.bytes).toBeGreaterThan(1_000_000);
    expect(first.bytes).toBeLessThanOrEqual(MAX_BYTES);
  });

  it('keeps the upstream legal comments, gathered at its end', () => {
    const tail = first.text.slice(first.text.lastIndexOf('/*!'));
    expect(tail).toMatch(/^\/\*! Bundled license information:\n/);
    expect(tail).toContain('@license');
    expect(tail).toContain('lodash-es/lodash.js:');
  });

  it('is kept out of git: .gitignore names its directory', () => {
    expect(readFileSync(path.join(ROOT, '.gitignore'), 'utf8').split('\n')).toContain('assets/mermaid/');
  });
});

describe('package.json', () => {
  const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8')) as {
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
    scripts: Record<string, string>;
  };

  it('pins mermaid exactly at 12.1.0 as a dev dependency: the package ships the file built from it, and no runtime dependency', () => {
    expect(pkg.devDependencies['mermaid']).toBe('12.1.0');
    expect(Object.keys(pkg.dependencies).filter((d) => d === 'mermaid' || d === 'elkjs')).toEqual([]);
  });

  it('builds the Mermaid file as part of the build, before the frame build that lists it in assets/assets.json (L3 Task 6)', () => {
    expect(pkg.scripts['build:mermaid']).toBe('node scripts/build-mermaid.mjs');
    expect(pkg.scripts['build']).toBe('npm run build:mermaid && npm run build:frame && tsc -p tsconfig.build.json');
  });
});

describe('THIRD-PARTY-NOTICES', () => {
  it('names every package the metafile names, and only those, exactly as it gives them', () => {
    const packages = packagesOf(first.metafile, ROOT);
    expect(packages.length).toBeGreaterThan(50);
    expect(packages.map((p) => p.name)).toContain('mermaid');
    expect(packages.map((p) => p.name)).not.toContain('elkjs');
    expect(readNoticesSection(readFileSync(NOTICES, 'utf8'))).toBe(noticesSection(packages));
  });

  it('gives each package its licence and the text of each of its LICENSE files', () => {
    const section = readNoticesSection(readFileSync(NOTICES, 'utf8'));
    for (const p of packagesOf(first.metafile, ROOT)) {
      expect(p.licence, p.dir).toMatch(/\S/);
      expect(p.files.length, p.dir).toBeGreaterThan(0);
      expect(section).toContain(`${p.name} ${p.version} (${p.licence})`);
      for (const f of p.files) expect(section).toContain(f.text.trim());
    }
  });

  it('keeps its other sections: the generated one sits between its two markers, after the fonts', () => {
    const text = readFileSync(NOTICES, 'utf8');
    expect(text.indexOf('Fonts (assets/fonts/)')).toBeGreaterThan(-1);
    expect(text.indexOf(NOTICES_BEGIN)).toBeGreaterThan(text.indexOf('Fonts (assets/fonts/)'));
    expect(text.indexOf(NOTICES_END)).toBeGreaterThan(text.indexOf(NOTICES_BEGIN));
    expect(text.split(NOTICES_BEGIN).length).toBe(2);
    expect(text.split(NOTICES_END).length).toBe(2);
  });

  it('a package.json with no licence string is listed as such, its licence file following', () => {
    const khroma = packagesOf(first.metafile, ROOT).find((p) => p.name === 'khroma');
    expect(khroma?.licence).toBe(NO_LICENCE_FIELD);
    expect(khroma?.files.map((f) => f.name)).toEqual(['license']);
  });

  it('the section is replaced in place, or appended after a heading when the file has none', () => {
    const section = `${NOTICES_BEGIN}\nnew, with $& and $1 kept as written\n${NOTICES_END}`;
    expect(withNoticesSection(`head\n\n${NOTICES_BEGIN}\nold $& text\n${NOTICES_END}\ntail\n`, section)).toBe(`head\n\n${section}\ntail\n`);
    expect(withNoticesSection('head\n\n', section)).toBe(`head\n\nMermaid (assets/mermaid/mermaid.mjs)\n------------------------------------\n${section}\n`);
    expect(readNoticesSection('no markers')).toBe(null);
    expect(readNoticesSection(`${NOTICES_BEGIN}\nno end marker\n`)).toBe(null);
  });

  it('a package with no LICENSE file stops the build, naming it', () => {
    expect(() => licenceFiles(path.join(ROOT, 'src'), 'src')).toThrow(/src: no LICENSE file/);
  });

  it('reads a package\'s licence files only: LICENSE, LICENSE.md, license.txt, LICENSE-MPL, COPYING; never a script', () => {
    const files = licenceFiles(path.join(ROOT, 'node_modules', 'cytoscape'), 'node_modules/cytoscape').map((f) => f.name);
    expect(files).toEqual(['LICENSE']);
    const dompurify = licenceFiles(path.join(ROOT, 'node_modules', 'dompurify'), 'node_modules/dompurify').map((f) => f.name);
    expect(dompurify).toEqual(['LICENSE', 'LICENSE-MPL']);
  });
});

describe('THIRD-PARTY-NOTICES: code the metafile cannot see', () => {
  it('names every package whose module keys a bundled file carries and that is not listed itself, with the carrier', () => {
    const listed = packagesOf(first.metafile, ROOT).map((p) => `${p.name}@${p.version}`);
    const found = embeddedMarkers(first.metafile, ROOT).filter((e) => !listed.includes(`${e.name}@${e.version}`));
    expect(found.length).toBeGreaterThan(5);
    expect(found).toEqual(EMBEDDED.filter((e) => /^\d/.test(e.version)));
  });

  it('names what roughjs\'s pre-built file carries: the dependencies it declares, since that file imports nothing', () => {
    const input = first.inputs.filter((i) => i.startsWith('node_modules/roughjs/'));
    expect(input).toEqual(['node_modules/roughjs/bundled/rough.esm.js']);
    expect(readFileSync(path.join(ROOT, input[0] ?? ''), 'utf8')).not.toMatch(/\bimport\b|\brequire\(/);
    const pkg = JSON.parse(readFileSync(path.join(ROOT, 'node_modules', 'roughjs', 'package.json'), 'utf8')) as { dependencies: Record<string, string> };
    const declared = Object.entries(pkg.dependencies).map(([name, version]) => ({ name, version, carrier: 'roughjs' }));
    expect(EMBEDDED.filter((e) => e.carrier === 'roughjs')).toEqual(declared);
  });

  it('the section says the list is what the build resolved, names each embedded package, and says ELK is the default', () => {
    const section = readNoticesSection(readFileSync(NOTICES, 'utf8')) ?? '';
    expect(section).not.toContain('with the code it uses');
    expect(section).toContain('packages the build resolved');
    for (const e of EMBEDDED) expect(section).toContain(`  ${e.name} ${e.version}, inside ${e.carrier}\n`);
    expect(section).toContain("Mermaid 12.1.0's default configuration asks for ELK");
  });
});

describe('scripts/build-mermaid.mjs: the command line', () => {
  /** A throwaway package holding the two scripts, a notices file, and the given node_modules entries, linked. */
  function stage(modules: readonly string[], notices: string | null): string {
    const dir = mkdtempSync(path.join(tmpdir(), 'build-mermaid-'));
    mkdirSync(path.join(dir, 'scripts'));
    for (const f of ['build-mermaid.mjs', 'mermaid-elk-stub.mjs']) copyFileSync(path.join(ROOT, 'scripts', f), path.join(dir, 'scripts', f));
    if (modules.includes('*')) symlinkSync(path.join(ROOT, 'node_modules'), path.join(dir, 'node_modules'));
    else {
      mkdirSync(path.join(dir, 'node_modules'));
      for (const m of modules) symlinkSync(path.join(ROOT, 'node_modules', m), path.join(dir, 'node_modules', m));
    }
    if (notices !== null) writeFileSync(path.join(dir, 'THIRD-PARTY-NOTICES'), notices);
    return dir;
  }

  it('a bad command line exits 2 with the usage line, and builds nothing', () => {
    // In a copy without Mermaid, so a refusal that let the build run would exit 1, not write into this checkout.
    const dir = stage(['esbuild', '@esbuild'], null);
    try {
      for (const args of [['--other'], ['--notices', 'x'], ['x']]) {
        const r = spawnSync(process.execPath, [path.join(dir, 'scripts', 'build-mermaid.mjs'), ...args], { encoding: 'utf8' });
        expect({ args, status: r.status, stdout: r.stdout, stderr: r.stderr }).toEqual({
          args,
          status: 2,
          stdout: '',
          stderr: 'usage: node scripts/build-mermaid.mjs [--notices]\n',
        });
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('a build that fails exits 1 and says why: here Mermaid is not installed', () => {
    const dir = stage(['esbuild', '@esbuild'], null);
    try {
      const r = spawnSync(process.execPath, [path.join(dir, 'scripts', 'build-mermaid.mjs')], { encoding: 'utf8' });
      expect(r.status).toBe(1);
      expect(r.stdout).toBe('');
      expect(r.stderr).toMatch(/mermaid/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('--notices builds the file and writes the generated section after the hand-written text', () => {
    const dir = stage(['*'], 'Hand-written notices.\n');
    try {
      const r = spawnSync(process.execPath, [path.join(dir, 'scripts', 'build-mermaid.mjs'), '--notices'], { encoding: 'utf8' });
      expect(r.stderr).toBe('');
      expect(r.status).toBe(0);
      const built = readFileSync(path.join(dir, 'assets', 'mermaid', 'mermaid.mjs'));
      expect(built.length).toBe(first.bytes);
      const packages = packagesOf(first.metafile, ROOT);
      expect(r.stdout).toBe(
        `build-mermaid: assets/mermaid/mermaid.mjs, ${String(first.bytes)} bytes, sha256 ${first.sha256}\n` +
          `build-mermaid: THIRD-PARTY-NOTICES lists the ${String(packages.length)} bundled packages\n`,
      );
      expect(readFileSync(path.join(dir, 'THIRD-PARTY-NOTICES'), 'utf8')).toBe(withNoticesSection('Hand-written notices.\n', noticesSection(packages)));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 300_000);
});
