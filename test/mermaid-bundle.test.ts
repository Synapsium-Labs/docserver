// The self-hosted Mermaid file (docserver L2, Task 15; LD3; spec §3.4, §3.6), as scripts/build-mermaid.mjs builds
// it: in memory, never into the checkout, so the test needs no `npm run build` first (CI runs the tests before the
// build). It checks what the file is: one ESM file whose only export is the default (Mermaid's API), with no
// `import()` and no import left, so nothing loads after it; no elkjs among its inputs (elkjs is EPL-2.0, which §3.6
// keeps out) and no trace of elkjs's code in it; every input inside the package root, so a build in a checkout whose
// node_modules is a link names no path outside it; the same bytes from two builds; and its size within MAX_BYTES.
// Then THIRD-PARTY-NOTICES: its generated section is exactly what the build's metafile gives, so every package the
// file bundles is there with its licence and its LICENSE text, and nothing else is.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  ELK_SIGNATURE,
  MAX_BYTES,
  NOTICES_BEGIN,
  NOTICES_END,
  NO_LICENCE_FIELD,
  buildMermaid,
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

  it('builds the Mermaid file as part of the build', () => {
    expect(pkg.scripts['build:mermaid']).toBe('node scripts/build-mermaid.mjs');
    expect(pkg.scripts['build']).toBe('tsc -p tsconfig.build.json && npm run build:mermaid');
  });
});

describe('THIRD-PARTY-NOTICES', () => {
  it('names every package the file bundles, and only those, exactly as the metafile gives them', () => {
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
