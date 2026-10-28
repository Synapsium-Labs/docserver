// What the sealed frame costs, measured on the bytes that ship (docserver L3, Task 8; plan Reference §3, §4, ruling R3,
// prototype finding P-5; row L3.B16 and the figures the PR body records). Measurement rows: each prints its figures as
// `frame-figure:` lines, one per figure, with the engine's name, so CI's log gives WebKit's figures beside Chromium's
// (`grep frame-figure:`), and holds only what makes a figure a measurement (the frame readied, the instrument saw both
// instants). Nothing here is a budget.
//
//   L3.B16  For the corpus document with the largest rendered html, five mounts per engine: DOMContentLoaded to the
//           content root's append (the materialisation, FD3: the inert parse, the vocabulary walk, the image rewrite
//           and the adoption), and insertion to ready; the median and the maximum of each, as an input to the first
//           consumer's E17. Instrumented: the `measure` init script (frame-host-page.ts) times DOMContentLoaded and
//           wraps Node.prototype.appendChild before the bootstrap captures it, to time the root's append.
//   The pure SHA-256 (src/frame/sha256.ts, the one frameDocument runs) in each engine: the first hash of each frame
//           asset, Mermaid's first (cold), then Mermaid again (a memo hit) and a text one character longer (a full hash, warm), as a host that runs frameDocument in a
//           browser pays them.
//   The 2 MiB document (DOCREADER_MEASURE=1 only, P-5: about 35 s per engine): a document of the spec's 2 MiB cap built
//           from the non-hostile corpus, from insertion to ready and from DOMContentLoaded to the root, and the same
//           document enhanced in an ordinary page for comparison.
import path from 'node:path';
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { frameCsp, FRAME_MANIFEST, type FrameAssets } from '../../src/frame/index.js';
import { openFrameHost } from './frame-host-page.js';
import { CORPUS, corpusFiles, data, figure, freshNonce, largest, loadFrame, measure, MEASURE, median, readyOf, ROOT, srcdocFor, waitProgress } from './frame-shared.js';
import { browserFor, closeBrowsers, describeBrowsers, openDoc } from './harness.js';

let assets: FrameAssets;
let mermaidText = '';
/** src/frame/sha256.ts bundled as a classic script that sets `__docreaderSha` (test-side only, never shipped). */
let shaScript = '';

beforeAll(async () => {
  const built = await loadFrame();
  assets = built.assets;
  mermaidText = built.mermaid;
  const r = await build({
    entryPoints: [path.join(ROOT, 'src/frame/sha256.ts')],
    absWorkingDir: ROOT,
    bundle: true,
    format: 'iife',
    globalName: '__docreaderSha',
    platform: 'browser',
    target: 'es2022',
    write: false,
    logLevel: 'silent',
  });
  shaScript = r.outputFiles[0]?.text ?? '';
}, 300_000);

afterAll(closeBrowsers);

/** How many mounts L3.B16 measures per engine. */
const RUNS = 5;

describeBrowsers((browser) => {
  it(`L3.B16 (measurement row; instrumented: \`measure\` times DOMContentLoaded and the root's append): the largest corpus document, ${String(RUNS)} mounts, DOMContentLoaded to the root and insertion to ready, median and maximum`, async () => {
    const handle = await browserFor(browser);
    const big = largest();
    const materialise: number[] = [];
    const ready: number[] = [];
    let srcdocChars = 0;
    for (let i = 0; i < RUNS; i++) {
      const host = await openFrameHost(handle, { measure: true });
      try {
        const nonce = freshNonce();
        const srcdoc = srcdocFor(assets, big.markdown, nonce);
        srcdocChars = srcdoc.length;
        await host.mount(srcdoc, frameCsp());
        const { rec } = await waitProgress(host, 1, `L3.B16 ${browser} run ${String(i + 1)}`);
        expect(data(rec)).toEqual([readyOf(nonce)]);
        const fr = await host.frameRecord();
        expect(fr.dcl).not.toBeNull();
        expect(fr.root).not.toBeNull();
        materialise.push((fr.root ?? 0) - (fr.dcl ?? 0));
        ready.push(rec.messages[0]?.at ?? -1);
      } finally {
        await host.close();
      }
    }
    measure('L3.B16 largest corpus document', browser, { file: big.file, htmlChars: big.html, srcdocChars, materialiseMs: materialise.map((x) => Number(x.toFixed(2))), readyMs: ready.map((x) => Math.round(x)) });
    figure('L3.B16', browser, 'runs', RUNS);
    figure('L3.B16', browser, 'htmlChars', big.html);
    figure('L3.B16', browser, 'srcdocChars', srcdocChars);
    figure('L3.B16', browser, 'dclToRootMedianMs', median(materialise));
    figure('L3.B16', browser, 'dclToRootMaxMs', Math.max(...materialise));
    figure('L3.B16', browser, 'insertionToReadyMedianMs', median(ready));
    figure('L3.B16', browser, 'insertionToReadyMaxMs', Math.max(...ready));
  }, 300_000);

  it('measures the pure SHA-256 in the engine: the first hash of each frame asset (Mermaid first, cold), then Mermaid again (a memo hit) and one character longer (warm)', async () => {
    const host = await openFrameHost(await browserFor(browser));
    try {
      await host.page.addScriptTag({ content: shaScript });
      const texts = { mermaid: mermaidText, enhance: assets.enhance, css: assets.css, bootstrap: assets.bootstrap, guard: assets.guard };
      const got = await host.page.evaluate((t) => {
        const sha = (window as unknown as { __docreaderSha: { cspHash(text: string): string } }).__docreaderSha;
        const out: Record<string, { ms: number; hash: string }> = {};
        for (const [name, text] of Object.entries(t)) {
          const t0 = performance.now();
          const hash = sha.cspHash(text);
          out[name] = { ms: performance.now() - t0, hash };
        }
        // The same text again is a memo hit (sha256.ts keeps the last 8 strings); a text one character longer is a
        // second full hash, with the code warm.
        const t1 = performance.now();
        const again = sha.cspHash(t.mermaid);
        out['mermaidAgain'] = { ms: performance.now() - t1, hash: again };
        const t3 = performance.now();
        const longer = sha.cspHash(`${t.mermaid}\n`);
        out['mermaidLonger'] = { ms: performance.now() - t3, hash: longer };
        return out;
      }, texts);
      // The figures are the right hashes: each equals the manifest's, as frameDocument checks it.
      expect(got['mermaid']?.hash).toBe(FRAME_MANIFEST.mermaid.csp);
      expect(got['mermaidAgain']?.hash).toBe(FRAME_MANIFEST.mermaid.csp);
      expect(got['enhance']?.hash).toBe(FRAME_MANIFEST.enhance.csp);
      const names: Record<string, string> = { mermaidAgain: 'mermaidMemoHitMs', mermaidLonger: 'mermaidWarmHashMs' };
      for (const [name, v] of Object.entries(got)) figure('sha256', browser, names[name] ?? `${name}FirstHashMs`, v.ms);
      figure('sha256', browser, 'mermaidChars', mermaidText.length);
    } finally {
      await host.close();
    }
  }, 120_000);

  it.skipIf(!MEASURE)('measures (DOCREADER_MEASURE=1): a 2 MiB document built from the non-hostile corpus, from insertion to ready and DOMContentLoaded to the root', async () => {
    const host = await openFrameHost(await browserFor(browser), { measure: true });
    try {
      const parts = corpusFiles()
        .filter((f) => !path.relative(CORPUS, f).split(path.sep).some((s) => s.startsWith('h-')))
        // lists-tasks.md ends inside a list nested past the limit, which takes in everything after it.
        .filter((f) => path.basename(f) !== 'lists-tasks.md')
        .map((f) => readFileSync(f, 'utf8').replace(/^---[\s\S]*?\n---\n/, ''));
      let md = '';
      for (let i = 0; md.length < 2 * 1024 * 1024; i++) md += `\n\n${parts[i % parts.length] ?? ''}`;
      const nonce = freshNonce();
      const t0 = performance.now();
      const srcdoc = srcdocFor(assets, md, nonce);
      const buildMs = performance.now() - t0;
      await host.mount(srcdoc, frameCsp());
      const { rec } = await waitProgress(host, 1, `2 MiB ${browser}`, 60_000, 180_000);
      expect(data(rec)).toEqual([readyOf(nonce)]);
      const fr = await host.frameRecord();
      figure('2MiB', browser, 'markdownChars', md.length);
      figure('2MiB', browser, 'srcdocChars', srcdoc.length);
      figure('2MiB', browser, 'renderAndFrameDocumentMs', buildMs);
      figure('2MiB', browser, 'insertionToReadyMs', rec.messages[0]?.at ?? -1);
      figure('2MiB', browser, 'dclToRootMs', (fr.root ?? 0) - (fr.dcl ?? 0));
      figure('2MiB', browser, 'insertionToDclMs', fr.origin + (fr.dcl ?? 0) - rec.insertedAt);
      figure('2MiB', browser, 'rootToReadyMs', rec.insertedAt + (rec.messages[0]?.at ?? 0) - (fr.origin + (fr.root ?? 0)));
      figure('2MiB', browser, 'violations', host.cspConsole.length);
      // The same document enhanced in an ordinary page (the layout harness), for comparison: the frame's share of the
      // time is what the two differ by.
      const page = await openDoc(md, {}, { browser, enhance: false, csp: 'reader' });
      try {
        const t1 = performance.now();
        await page.enhance();
        figure('2MiB', browser, 'ordinaryPageEnhanceMs', performance.now() - t1);
      } finally {
        await page.close();
      }
    } finally {
      await host.close();
    }
  }, 300_000);
});
