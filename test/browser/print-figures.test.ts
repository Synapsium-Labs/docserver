// Print figures in a real browser (docserver parity T6; the first consumer's parity design, section 4.6 stage 2 and section 6's caps):
// the real frame (its shipped bytes, the bundled Mermaid, a real canvas) under the real `./host`. After `printFigures()`, the frame draws each
// figure again for print, offscreen and with HTML labels off, rasterises it and sends `print-figure`; the host's parser judges each and
// hands it to `onPrintFigure`. The unit half, with a fake Mermaid and canvas, is test/enhance-print-figures.test.ts.
//
//   - a document of three covered figures (a flowchart, a sequence and a class diagram) and one that fails to draw answers three figures,
//     `i` 0, 1 and 3 of `n` 4, each a PNG whose IHDR is at most 2048 px a side and whose bytes are at most 1 MiB;
//   - a figure drawn hosted prints in the host's colours (a pixel of the node fill the colours give), and the same figure without
//     colours prints in 1.1's;
//   - the figures on screen are byte-equal before and after, and the offscreen stage is gone;
//   - a second run after the first is accepted in full: no refusal, no fallback.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, expect, it } from 'vitest';
import type { FrameAssets } from '../../src/frame/index.js';
import { openLibHost, type LibHost } from './frame-host-page.js';
import { input, loadFrame, ROOT, sleep, waitProgress, type BuiltFrame } from './frame-shared.js';
import { browserFor, closeBrowsers, describeBrowsers } from './harness.js';

let built: BuiltFrame;
let assets: FrameAssets;

beforeAll(async () => {
  built = await loadFrame();
  assets = built.assets;
}, 300_000);

afterAll(closeBrowsers);

const DOC = [
  '# Print',
  '',
  '```mermaid',
  'flowchart LR',
  '  A[Start] --> B{Choice}',
  '  B -->|yes| C[Done]',
  '  B -->|no| A',
  '```',
  '*Figure 1. A flowchart.*',
  '',
  '```mermaid',
  'sequenceDiagram',
  '  participant P as Parent',
  '  participant F as Frame',
  '  P->>F: hello',
  '  F-->>P: ready',
  '```',
  '*Figure 2. A sequence.*',
  '',
  '```mermaid',
  'this is not a diagram at all',
  '```',
  '*Figure 3. One that fails.*',
  '',
  '```mermaid',
  'classDiagram',
  '  class Reader {',
  '    +theme',
  '    +open()',
  '  }',
  '  Reader <|-- Frame',
  '```',
  '*Figure 4. A class diagram.*',
  '',
].join('\n');

/** What the mount's document says of its Mermaid fences, which is what turns the frame's Mermaid on. */
const scanOf = (fences: number): { mermaid: { fences: number; largestBytes: number; totalBytes: number; largestChars: number; totalChars: number } } => ({
  mermaid: { fences, largestBytes: 200, totalBytes: 200 * fences, largestChars: 200, totalChars: 200 * fences },
});

const FIXTURES = JSON.parse(readFileSync(path.join(ROOT, 'conformance', 'appearance', 'fixtures.json'), 'utf8')) as {
  name: string;
  mode: 'light' | 'dark';
  colour: Record<string, string>;
}[];
const PHOSPHOR = FIXTURES.find((f) => f.name === 'Phosphor & Ink') as (typeof FIXTURES)[number];
const SKIN = { radius: '6px', radiusSmall: '3px', radiusLarge: '12px', controlRow: '40px', popShadow: '0 12px 40px rgba(0, 0, 0, 0.55)', sectionCase: 'uppercase' };

interface Figure {
  readonly i: number;
  readonly n: number;
  readonly png: string;
}

/** The figures `onPrintFigure` has been given so far. */
async function figuresOf(host: LibHost): Promise<Figure[]> {
  const rec = await host.lib();
  return rec.events.filter((e) => e.kind === 'onPrintFigure').map((e) => e.value as Figure);
}

/** Wait until `count` figures have arrived (or the run has had its time), then a moment more for any that should not come. */
async function until(host: LibHost, count: number, label: string): Promise<Figure[]> {
  const t0 = Date.now();
  for (;;) {
    const got = await figuresOf(host);
    if (got.length >= count) {
      await sleep(400);
      return figuresOf(host);
    }
    if (Date.now() - t0 > 90_000) throw new Error(`${label}: ${String(got.length)} of ${String(count)} figures after 90 s`);
    await sleep(250);
  }
}

/** A PNG's signature and IHDR, read from its base64 text. */
function ihdr(png: string): { signature: boolean; width: number; height: number; bytes: number } {
  const b = Buffer.from(png, 'base64');
  return { signature: b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), width: b.readUInt32BE(16), height: b.readUInt32BE(20), bytes: b.length };
}

/** How many pixels of `png` are exactly `rgb` (a `#rrggbb`), decoded by the page's own image decoder. */
function pixelsOf(host: LibHost, png: string, rgb: string): Promise<number> {
  return host.page.evaluate(
    async ({ b64, hex }) => {
      const blob = await (await fetch(`data:image/png;base64,${b64}`)).blob();
      const bitmap = await createImageBitmap(blob);
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D;
      ctx.drawImage(bitmap, 0, 0);
      const data = ctx.getImageData(0, 0, bitmap.width, bitmap.height).data;
      const want = [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
      let n = 0;
      for (let k = 0; k < data.length; k += 4) if (data[k] === want[0] && data[k + 1] === want[1] && data[k + 2] === want[2] && data[k + 3] === 255) n += 1;
      return n;
    },
    { b64: png, hex: rgb },
  );
}

const screen = (host: LibHost): Promise<string[]> =>
  host.frame().evaluate(() => Array.from(document.querySelectorAll('main figure.mermaid-figure, [data-docreader-root] figure.mermaid-figure')).map((f) => f.outerHTML));

describeBrowsers((browser) => {
  it('three covered figures and one that fails answer three print-figures: i 0, 1 and 3 of n 4, each a PNG within 2048 px and 1 MiB; the screen is byte-equal before and after; a second run is accepted whole', async () => {
    const host = await openLibHost(await browserFor(browser));
    try {
      await host.mount({ document: { ...input(DOC), scan: scanOf(4) }, assets: { ...assets, mermaid: built.mermaid } as FrameAssets, watchdogMs: 120_000, callbacks: ['onPrintFigure'] });
      await waitProgress(host, 1, `ready ${browser}`, 240_000, 600_000);
      let rec = await host.lib();
      expect(rec.events.map((e) => e.kind)).toEqual(['ready']);
      // the screen's four figures are drawn (three) or noted (one) before the run
      await host.frame().waitForFunction(() => document.querySelectorAll('figure.mermaid-figure.drawn').length === 3 && document.querySelectorAll('figure.mermaid-figure.draw-failed').length === 1);
      const before = await screen(host);
      expect(before).toHaveLength(4);

      await host.printFigures();
      const got = await until(host, 3, `first run ${browser}`);
      expect(got.map((f) => [f.i, f.n])).toEqual([[0, 4], [1, 4], [3, 4]]);
      for (const f of got) {
        const h = ihdr(f.png);
        expect(h.signature, `figure ${String(f.i)} is a PNG`).toBe(true);
        expect(h.width).toBeGreaterThan(0);
        expect(h.width).toBeLessThanOrEqual(2048);
        expect(h.height).toBeGreaterThan(0);
        expect(h.height).toBeLessThanOrEqual(2048);
        expect(h.bytes).toBeLessThanOrEqual(1_048_576);
      }
      // the screen's figures did not change, and the offscreen stage is gone
      expect(await screen(host)).toEqual(before);
      expect(await host.frame().evaluate(() => document.querySelectorAll('.print-stage').length)).toBe(0);
      rec = await host.lib();
      expect(rec.events.map((e) => e.kind).filter((k) => k !== 'onPrintFigure')).toEqual(['ready']);

      // a second run: every figure again, accepted whole (a refusal would show as a fallback after sixteen, and as a missing figure)
      await host.printFigures();
      const again = await until(host, 6, `second run ${browser}`);
      expect(again.slice(3).map((f) => [f.i, f.n])).toEqual([[0, 4], [1, 4], [3, 4]]);
      rec = await host.lib();
      expect(rec.events.filter((e) => e.kind === 'fallback')).toEqual([]);
      expect(host.errors).toEqual([]);
      expect(host.cspConsole).toEqual([]);
    } finally {
      await host.close();
    }
  }, 300_000);

  it('a figure drawn hosted prints in the host\'s colours; the same document without colours prints in 1.1\'s', async () => {
    const SINGLE = ['# One', '', '```mermaid', 'flowchart LR', '  A[Start] --> B{Choice}', '  B -->|yes| C[Done]', '```', '*Figure 1. A flowchart.*', ''].join('\n');
    const printed = async (appearance: unknown): Promise<{ png: string; host: LibHost }> => {
      const host = await openLibHost(await browserFor(browser));
      await host.mount({
        document: { ...input(SINGLE), scan: scanOf(1) },
        assets: { ...assets, mermaid: built.mermaid } as FrameAssets,
        watchdogMs: 120_000,
        callbacks: ['onPrintFigure'],
        ...(appearance === undefined ? {} : { appearance }),
      });
      await waitProgress(host, 1, `ready ${browser}`, 240_000, 600_000);
      await host.frame().waitForFunction(() => document.querySelectorAll('figure.mermaid-figure.drawn').length === 1);
      await host.printFigures();
      const [fig] = await until(host, 1, `hosted ${browser}`);
      return { png: (fig as Figure).png, host };
    };
    const hosted = await printed({ mode: 'dark', colour: PHOSPHOR.colour, skin: SKIN, label: 'Follows the host' });
    const plain = await printed(undefined);
    try {
      const nodeFill = (PHOSPHOR.colour['surface2'] as string).toLowerCase();
      const warm = '#f3f0e9'; // 1.1's primaryColor, the node fill of the warm theme
      expect(await pixelsOf(hosted.host, hosted.png, nodeFill)).toBeGreaterThan(100);
      expect(await pixelsOf(hosted.host, hosted.png, warm)).toBe(0);
      expect(await pixelsOf(plain.host, plain.png, warm)).toBeGreaterThan(100);
      expect(await pixelsOf(plain.host, plain.png, nodeFill)).toBe(0);
      expect(hosted.host.errors).toEqual([]);
      expect(plain.host.errors).toEqual([]);
    } finally {
      await hosted.host.close();
      await plain.host.close();
    }
  }, 300_000);
});
