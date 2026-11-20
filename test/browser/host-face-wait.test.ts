// The reader waits for a host's faces before it measures (docserver appearance review 2906 F8), in a real browser: a face
// named like the host's (`Docreader Host Sans`) is added to the document's font set before the reader starts, and its font
// file is held at the network route. The library's own faces load at once, so a reader that waited for them alone would
// run its 'fonts' relayout while the host face is still loading; the reader holds that run until the host face has loaded.
// The unit rows with a stand-in font set are test/enhance-host-faces.test.ts.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { closeBrowsers, describeBrowsers, openDoc } from './harness.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const ENTRY = [
  "import { enhance } from './src/enhance/index.ts';",
  "import { contextOf } from './src/enhance/lifecycle.ts';",
  '(window as unknown as { __hostFaceWait: unknown }).__hostFaceWait = { enhance, contextOf };',
].join('\n');
const FACE_FILE = readFileSync(path.join(ROOT, 'assets', 'fonts', 'source-sans-3-latin-wght-normal.woff2'));
const DOC = ['# Host face', '', '## In short', '', 'A line of text.', '', '## Later', '', 'More text.', ''].join('\n');

interface Run {
  readonly reasons: string[];
  readonly hostLoaded: boolean;
}
interface HostWindow {
  __hostFaceWait: { enhance(root: HTMLElement): Promise<void>; contextOf(root: HTMLElement): { onRelayout(fn: (reasons: ReadonlySet<string>) => void): void } | undefined };
  __hostRuns: Run[];
}

let script = '';

beforeAll(async () => {
  const result = await build({
    stdin: { contents: ENTRY, resolveDir: ROOT, sourcefile: 'host-face-wait-entry.ts', loader: 'ts' },
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    target: 'es2022',
    logLevel: 'silent',
  });
  script = result.outputFiles[0]?.text ?? '';
});

afterAll(closeBrowsers);

describeBrowsers((browser) => {
  it("the 'fonts' relayout waits for a host face still loading, and a measurement then is made with the host face loaded", async () => {
    const doc = await openDoc(DOC, {}, { browser, viewport: { width: 1440, height: 900 }, csp: 'strict', enhance: false });
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    try {
      await doc.page.route('**/assets/fonts/host-sans-slow.woff2', async (route) => {
        await gate;
        await route.fulfill({ status: 200, contentType: 'font/woff2', body: FACE_FILE });
      });
      await doc.page.evaluate(script);
      await doc.page.evaluate(async () => {
        const w = window as unknown as HostWindow;
        const face = new FontFace('Docreader Host Sans', 'url(/assets/fonts/host-sans-slow.woff2)', { display: 'swap' });
        document.fonts.add(face);
        void face.load().catch(() => undefined);
        const root = document.querySelector('main[data-harness-root]') as HTMLElement;
        w.__hostRuns = [];
        await w.__hostFaceWait.enhance(root);
        w.__hostFaceWait.contextOf(root)?.onRelayout((reasons) => {
          const f = Array.from(document.fonts as unknown as Iterable<FontFace>).find((x) => x.family.replace(/["']/g, '') === 'Docreader Host Sans');
          w.__hostRuns.push({ reasons: [...reasons], hostLoaded: f?.status === 'loaded' });
        });
      });
      // The library's faces load at once; give the 'fonts' run every chance to come early.
      await doc.page.waitForFunction(() => ['Docreader Serif', 'Docreader Sans'].every((family) => Array.from(document.fonts as unknown as Iterable<FontFace>).some((f) => f.family.replace(/["']/g, '') === family && f.status === 'loaded')), undefined, { timeout: 15_000 });
      await doc.page.waitForTimeout(400);
      const early = await doc.page.evaluate(() => (window as unknown as HostWindow).__hostRuns);
      expect(
        early.filter((r) => r.reasons.includes('fonts')),
        'no run for the faces while the host face is held',
      ).toEqual([]);

      release();
      await doc.page.waitForFunction(() => (window as unknown as HostWindow).__hostRuns.some((r) => r.reasons.includes('fonts')), undefined, { timeout: 15_000 });
      const runs = await doc.page.evaluate(() => (window as unknown as HostWindow).__hostRuns);
      expect(runs.filter((r) => r.reasons.includes('fonts'))).toEqual([{ reasons: ['fonts'], hostLoaded: true }]);
      expect(await doc.violations()).toEqual([]);
    } finally {
      release();
      await doc.close();
    }
  });
});
