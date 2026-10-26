// Fullscreen clone references in a real Chromium page. The strict policy permits CSSOM writes but rejects serialized
// style attributes, so this proves the clone operation preserves paint without opening a CSP or network escape.
import { inflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { closeBrowsers, describeBrowsers, openDoc } from './harness.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const DOC = ['# Diagram clone', '', '## 1. One', '', 'Text.', '', '## 2. Two', '', 'Text.', '', '## 3. Three', '', 'Text.', ''].join('\n');
const ENTRY = [
  "import { createJournal } from './src/enhance/journal.ts';",
  '(window as unknown as { __clone: unknown }).__clone = { createJournal };',
].join('\n');

let script = '';

type Png = { readonly width: number; readonly height: number; readonly channels: number; readonly raw: Buffer };

function translation(value: string): { readonly x: number; readonly y: number } {
  const match = /^translate\(([-\d.]+)px, ([-\d.]+)px\) scale\([\d.]+\)$/.exec(value);
  if (match === null) throw new Error(`unexpected fullscreen transform ${value}`);
  return { x: Number(match[1]), y: Number(match[2]) };
}

function decodePng(png: Buffer): Png {
  let at = 8;
  let width = 0;
  let height = 0;
  let channels = 0;
  const chunks: Buffer[] = [];
  while (at < png.length) {
    const size = png.readUInt32BE(at);
    const type = png.toString('ascii', at + 4, at + 8);
    const body = png.subarray(at + 8, at + 8 + size);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      channels = body[9] === 6 ? 4 : body[9] === 2 ? 3 : 0;
    }
    if (type === 'IDAT') chunks.push(body);
    at += 12 + size;
  }
  if (channels === 0) throw new Error('diagram pixel proof needs RGB or RGBA PNG');
  return { width, height, channels, raw: inflateSync(Buffer.concat(chunks)) };
}

function pixel(png: Png, x: number, y: number): readonly number[] {
  const stride = png.width * png.channels;
  let previous = Buffer.alloc(stride);
  for (let line = 0; line <= y; line += 1) {
    const start = line * (stride + 1);
    const filter = png.raw[start] ?? 0;
    const current = Buffer.from(png.raw.subarray(start + 1, start + 1 + stride));
    for (let i = 0; i < stride; i += 1) {
      const left = i < png.channels ? 0 : current[i - png.channels] ?? 0;
      const up = previous[i] ?? 0;
      const upLeft = i < png.channels ? 0 : previous[i - png.channels] ?? 0;
      if (filter === 1) current[i] = ((current[i] ?? 0) + left) & 255;
      else if (filter === 2) current[i] = ((current[i] ?? 0) + up) & 255;
      else if (filter === 3) current[i] = ((current[i] ?? 0) + Math.floor((left + up) / 2)) & 255;
      else if (filter === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        current[i] = ((current[i] ?? 0) + (pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft)) & 255;
      } else if (filter !== 0) throw new Error(`diagram pixel proof cannot decode PNG filter ${String(filter)}`);
    }
    previous = current;
  }
  const index = x * png.channels;
  return [previous[index] ?? 0, previous[index + 1] ?? 0, previous[index + 2] ?? 0, png.channels === 4 ? previous[index + 3] ?? 0 : 255];
}

beforeAll(async () => {
  const result = await build({
    stdin: { contents: ENTRY, resolveDir: ROOT, sourcefile: 'diagram-tools-entry.ts', loader: 'ts' },
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
  it('discovers Mermaid internal node, edge-label, and cluster-label structures for definition cues', async () => {
    const markdown = [
      '# Definitions',
      '',
      '## 1. Decisions',
      '',
      '| ID | Meaning |',
      '|---|---|',
      '| R1 | A neutral reference |',
      '',
      '## 2. Words used here',
      '',
      '| Term | Meaning |',
      '|---|---|',
      '| Long form | A neutral glossary term |',
      '',
      '```mermaid',
      'flowchart LR',
      '  subgraph R1',
      '    A[Long form] -->|Long form| B{R1}',
      '  end',
      '```',
      '',
      '*Figure 1. Internal structures.*',
      '',
    ].join('\n');
    const doc = await openDoc(markdown, { mermaid: {} }, { browser, csp: 'reader' });
    try {
      await doc.page.waitForFunction(() => {
        const svg = document.querySelector('main[data-harness-root] figure svg');
        if (!(svg instanceof SVGSVGElement)) return false;
        const groups = Array.from(svg.querySelectorAll<SVGGElement>('.dnode'));
        return groups.length > 0 && groups.every((group) => {
            const box = group.getBBox();
            return group.classList.contains('dnode') && box.width > 0 && box.height > 0
              && group.querySelectorAll(':scope > .dn-ring').length === 1
              && group.querySelectorAll(':scope > .dn-dot').length === 1;
          });
      });
      const result = await doc.page.evaluate(() => {
        const svg = document.querySelector('main[data-harness-root] figure svg') as SVGSVGElement;
        const groups = Array.from(svg.querySelectorAll<SVGGElement>('g.node, g.edgeLabel, g.cluster-label'));
        return {
          structures: {
            nodes: Array.from(svg.querySelectorAll<SVGGElement>('g.node'), (node) => ({ id: node.id, token: /(?:^|-)flowchart-(.+)-\d+$/.exec(node.id)?.[1] ?? null, text: node.textContent?.replace(/\s+/g, ' ').trim(), term: node.dataset.term, ref: node.dataset.ref })),
            edges: Array.from(svg.querySelectorAll<SVGPathElement>('path.flowchart-link'), (edge) => {
              const data = edge.getAttribute('data-id');
              const nodes = Array.from(svg.querySelectorAll<SVGGElement>('g.node'), (node) => ({ token: /(?:^|-)flowchart-(.+)-\d+$/.exec(node.id)?.[1] ?? null, text: node.textContent?.replace(/\s+/g, ' ').trim() }));
              const endpoints = data === null ? null : nodes.flatMap((from) => nodes.filter((to) => from.token !== null && to.token !== null && data.startsWith(`L_${from.token}_${to.token}_`)).map((to) => ({ from: from.text, to: to.text })))[0] ?? null;
              return { data, endpoints, label: Array.from(svg.querySelectorAll<SVGGElement>('g.edgeLabel')).find((label) => label.querySelector(`[data-id="${data}"]`))?.dataset.term };
            }),
            edgeLabels: Array.from(svg.querySelectorAll<SVGGElement>('g.edgeLabel'), (label) => ({ text: label.textContent?.replace(/\s+/g, ' ').trim(), term: label.dataset.term })),
            clusterLabels: Array.from(svg.querySelectorAll<SVGGElement>('g.cluster-label'), (label) => ({ text: label.textContent?.replace(/\s+/g, ' ').trim(), ref: label.dataset.ref })),
            shapes: Array.from(svg.querySelectorAll('g.node'), (node) => node.querySelector('rect, polygon, circle, path')?.localName),
          },
          cues: groups.map((group) => ({
            text: group.textContent?.replace(/\s+/g, ' ').trim(),
            dnode: group.classList.contains('dnode'),
            term: group.getAttribute('data-term'),
            ref: group.getAttribute('data-ref'),
            ring: group.querySelector('.dn-ring') !== null,
            dot: group.querySelector('.dn-dot') !== null,
          })),
          role: svg.getAttribute('role'),
        };
      });
      expect(result.structures.nodes).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: expect.stringMatching(/flowchart-/), text: 'Long form', term: 'long form' }),
        expect.objectContaining({ id: expect.stringMatching(/flowchart-/), text: 'R1', ref: 'R1' }),
      ]));
      expect(result.structures.edges).toEqual([expect.objectContaining({ data: expect.stringMatching(/^L_/), endpoints: { from: 'Long form', to: 'R1' }, label: 'long form' })]);
      expect(result.structures.edgeLabels).toEqual([expect.objectContaining({ text: 'Long form', term: 'long form' })]);
      expect(result.structures.clusterLabels).toEqual([expect.objectContaining({ text: 'R1', ref: 'R1' })]);
      expect(result.structures.shapes).toContain('polygon');
      expect(result.cues.filter((cue) => cue.dnode).map((cue) => [cue.term, cue.ref])).toEqual(expect.arrayContaining([
        ['long form', null], [null, 'R1'],
      ]));
      expect(result.cues.filter((cue) => cue.dnode).every((cue) => cue.ring && cue.dot)).toBe(true);
      expect(result.role).toBe('group');
      expect(await doc.violations()).toEqual([]);
      expect({ aborted: doc.aborted, missing: doc.missing }).toEqual({ aborted: [], missing: [] });
    } finally {
      await doc.close();
    }
  });

  it('centers a painted definition cue inside a transformed Mermaid diamond', async () => {
    const markdown = [
      '# Definitions', '', '## 1. Decisions', '', '| ID | Meaning |', '|---|---|', '| R1 | A neutral reference |', '',
      '```mermaid', 'flowchart LR', '  A[Start] --> B{R1}', '```', '', '*Figure 1. Shape.*', '',
    ].join('\n');
    const doc = await openDoc(markdown, { mermaid: {} }, { browser, csp: 'reader' });
    try {
      await doc.page.waitForFunction(() => document.querySelector('main[data-harness-root] g.node:has(polygon) .dn-dot') !== null);
      const cue = await doc.page.evaluate(() => {
        const node = document.querySelector('main[data-harness-root] g.node:has(polygon)') as SVGGElement;
        const dot = node.querySelector('.dn-dot') as SVGCircleElement;
        const ring = node.querySelector('.dn-ring') as SVGRectElement;
        const pad = 4;
        return {
          cx: Number(dot.getAttribute('cx')), cy: Number(dot.getAttribute('cy')),
          x: Number(ring.getAttribute('x')) + pad, y: Number(ring.getAttribute('y')) + pad,
          width: Number(ring.getAttribute('width')) - pad * 2, height: Number(ring.getAttribute('height')) - pad * 2,
          fill: dot.style.getPropertyValue('fill'), priority: dot.style.getPropertyPriority('fill'),
        };
      });
      expect(cue.cx).toBeCloseTo(cue.x + cue.width / 2, 3);
      expect(cue.cy).toBeCloseTo(cue.y + Math.min(14, cue.height / 4), 3);
      expect(cue).toMatchObject({ fill: 'rgb(11, 107, 102)', priority: 'important' });
      expect(await doc.violations()).toEqual([]);
    } finally {
      await doc.close();
    }
  });

  it('gives a generated single-node diagram definition cues without Play', async () => {
    const markdown = ['# Definitions', '', '## 1. Decisions', '', '| ID | Meaning |', '|---|---|', '| R1 | A neutral reference |', '', '```mermaid', 'flowchart LR', '  A[R1]', '```', '', '*Figure 1. One node.*', ''].join('\n');
    const doc = await openDoc(markdown, { mermaid: {} }, { browser, csp: 'reader' });
    try {
      await doc.page.waitForFunction(() => document.querySelectorAll('main[data-harness-root] g.node .dn-ring, main[data-harness-root] g.node .dn-dot').length === 2);
      const result = await doc.page.evaluate(() => {
        const svg = document.querySelector('main[data-harness-root] figure svg') as SVGSVGElement;
        const node = svg.querySelector('g.node') as SVGGElement;
        return { role: svg.getAttribute('role'), ref: node.dataset.ref, cue: node.querySelectorAll('.dn-ring, .dn-dot').length, play: Array.from(svg.closest('figure')?.querySelectorAll('button') ?? []).some((button) => button.textContent === 'Play') };
      });
      expect(result).toEqual({ role: 'group', ref: 'R1', cue: 2, play: false });
      expect(await doc.violations()).toEqual([]);
    } finally {
      await doc.close();
    }
  });

  it('places important definition cues on generated diamond, circle, and cylinder shapes', async () => {
    const markdown = [
      '# Definitions', '', '## 1. Decisions', '', '| ID | Meaning |', '|---|---|', '| R1 | A neutral reference |', '',
      '```mermaid', 'flowchart LR', '  A{R1}:::paint --> B((R1)):::paint --> C[(R1)]:::paint', '  classDef paint fill:#d11,stroke:#d11', '```', '', '*Figure 1. Shapes.*', '',
    ].join('\n');
    const doc = await openDoc(markdown, { mermaid: {} }, { browser, csp: 'reader', enhance: false });
    try {
      await doc.page.evaluate(() => {
        const native = SVGGraphicsElement.prototype.getBBox;
        const boxes = new Map<string, { x: number; y: number; width: number; height: number }>();
        Object.defineProperty(SVGGraphicsElement.prototype, 'getBBox', { configurable: true, value: function () {
          if ((this as Element).matches('g.node.dnode')) {
            const node = this as SVGGElement;
            for (const shape of Array.from(node.querySelectorAll<SVGGraphicsElement>(':scope > polygon, :scope > circle, :scope > path'))) shape.setAttribute('transform', 'matrix(1 0.2 0.3 1 4 2)');
            const box = native.call(this);
            boxes.set(node.id, { x: box.x, y: box.y, width: box.width, height: box.height });
            return box;
          }
          return native.call(this);
        } });
        (window as unknown as { __definitionBoxes: typeof boxes; __definitionNativeBBox: typeof native }).__definitionBoxes = boxes;
        (window as unknown as { __definitionNativeBBox: typeof native }).__definitionNativeBBox = native;
      });
      await doc.enhance();
      await doc.page.waitForFunction(() => document.querySelectorAll('main[data-harness-root] g.node.dnode .dn-dot').length === 3);
      const shapes = await doc.page.evaluate(() => Array.from(document.querySelectorAll<SVGGElement>('main[data-harness-root] g.node.dnode')).map((node) => {
        const dot = node.querySelector('.dn-dot') as SVGCircleElement;
        const shape = node.querySelector('polygon, circle, path') as SVGGraphicsElement;
        const box = (window as unknown as { __definitionBoxes: Map<string, { x: number; y: number; width: number; height: number }> }).__definitionBoxes.get(node.id);
        if (box === undefined) throw new Error(`missing native cue box for ${node.id}`);
        const matrix = shape.transform.baseVal.consolidate()?.matrix;
        return { shape: shape.localName, cx: Number(dot.getAttribute('cx')), cy: Number(dot.getAttribute('cy')), x: box.x, y: box.y, width: box.width, height: box.height, paint: getComputedStyle(dot).fill, transform: node.getAttribute('transform'), matrix: matrix === undefined ? null : { a: matrix.a, b: matrix.b, c: matrix.c, d: matrix.d, e: matrix.e, f: matrix.f } };
      }));
      expect(shapes.map((shape) => shape.shape)).toEqual(expect.arrayContaining(['polygon', 'circle', 'path']));
      for (const shape of shapes) {
        expect(shape.transform).not.toBeNull();
        expect(shape.matrix).not.toBeNull();
        expect([shape.matrix?.a, shape.matrix?.b, shape.matrix?.c, shape.matrix?.d]).not.toEqual([1, 0, 0, 1]);
        expect(shape.cx).toBeCloseTo(shape.x + shape.width / 2, 3);
        expect(shape.cy).toBeCloseTo(shape.y + Math.min(14, shape.height / 4), 3);
        expect(shape.paint).toBe('rgb(11, 107, 102)');
      }
      expect(await doc.violations()).toEqual([]);
    } finally {
      await doc.page.evaluate(() => {
        const native = (window as unknown as { __definitionNativeBBox: typeof SVGGraphicsElement.prototype.getBBox }).__definitionNativeBBox;
        Object.defineProperty(SVGGraphicsElement.prototype, 'getBBox', { configurable: true, value: native });
      });
      await doc.close();
    }
  });

  it('lets the desktop fullscreen overlay and stage occupy the root viewport while source prose keeps its measure', async () => {
    const markdown = ['# Viewport viewer', '', 'A source paragraph remains in the reading measure.', '', '```mermaid', 'flowchart LR', '  A[Start] --> B[Stop]', '```', '', '*Figure 1. Viewport.*'].join('\n');
    const doc = await openDoc(markdown, { mermaid: {} }, { browser, viewport: { width: 1440, height: 900 }, csp: 'reader' });
    try {
      const before = await doc.page.evaluate(() => {
        const root = document.querySelector('main[data-harness-root]') as HTMLElement;
        const prose = Array.from(root.querySelectorAll('p')).find((element) => element.textContent === 'A source paragraph remains in the reading measure.') as HTMLElement;
        const rect = (element: HTMLElement) => {
          const { x, y, width, height } = element.getBoundingClientRect();
          return { x, y, width, height };
        };
        return { root: rect(root), prose: rect(prose) };
      });
      await doc.page.getByRole('button', { name: 'Full screen' }).click();
      const fullscreen = await doc.page.evaluate(() => {
        const root = document.querySelector('main[data-harness-root]') as HTMLElement;
        const overlay = root.querySelector('.fig-overlay.open') as HTMLElement;
        const stage = overlay.querySelector('.fo-stage') as HTMLElement;
        const style = getComputedStyle(overlay);
        const rect = (element: HTMLElement) => {
          const { x, y, width, height } = element.getBoundingClientRect();
          return { x, y, width, height };
        };
        return { overlay: rect(overlay), stage: rect(stage), margin: [style.marginLeft, style.marginRight], maxWidth: style.maxWidth };
      });
      expect(Math.abs(before.root.width - 1440)).toBeLessThanOrEqual(0.1);
      expect(before.prose.width).toBeGreaterThan(100);
      expect(before.prose.width).toBeLessThan(before.root.width);
      expect(fullscreen.overlay).toEqual({ x: 0, y: 0, width: 1440, height: 900 });
      expect(fullscreen.stage).toMatchObject({ x: 16, y: 64, width: 1408 });
      expect(fullscreen.margin).toEqual(['0px', '0px']);
      expect(fullscreen.maxWidth).toBe('none');
      expect(await doc.violations()).toEqual([]);
    } finally {
      await doc.close();
    }
  });

  it('keeps a generated Mermaid fullscreen clone at its natural viewBox size across desktop and phone viewports', async () => {
    const markdown = ['# Natural viewer', '', '```mermaid', 'flowchart LR', '  A[Start] --> B[Stop]', '```', '', '*Figure 1. Natural size.*'].join('\n');
    for (const width of [1440, 390]) {
      const doc = await openDoc(markdown, { mermaid: {} }, { browser, viewport: { width, height: 900 }, csp: 'reader' });
      try {
        const source = await doc.page.locator('main[data-harness-root] figure svg').evaluate((svg) => svg.outerHTML);
        await doc.page.getByRole('button', { name: 'Full screen' }).click();
        const sizes = await doc.page.evaluate(() => {
          const root = document.querySelector('main[data-harness-root]') as HTMLElement;
          const source = root.querySelector('figure > pre[data-docreader-chrome] > svg') as SVGSVGElement;
          const clone = root.querySelector('.fig-overlay.open svg') as SVGSVGElement;
          const number = (value: string): number => Number.parseFloat(value);
          return {
            source: source.outerHTML,
            sourceViewBox: { width: source.viewBox.baseVal.width, height: source.viewBox.baseVal.height },
            sourceWidthAttribute: source.getAttribute('width'),
            cloneViewBox: { width: clone.viewBox.baseVal.width, height: clone.viewBox.baseVal.height },
            clone: { width: number(getComputedStyle(clone).width), height: number(getComputedStyle(clone).height) },
          };
        });
        expect(sizes.source).toBe(source);
        expect(sizes.sourceViewBox.width).toBeGreaterThan(0);
        expect(sizes.sourceViewBox.height).toBeGreaterThan(0);
        expect(Number.isFinite(sizes.sourceViewBox.width)).toBe(true);
        expect(Number.isFinite(sizes.sourceViewBox.height)).toBe(true);
        expect(sizes.cloneViewBox).toEqual(sizes.sourceViewBox);
        expect(sizes.clone).toEqual(sizes.sourceViewBox);
        expect(await doc.violations()).toEqual([]);
      } finally {
        await doc.close();
      }
    }
  });

  it('opens the production fullscreen overlay with a strict-CSP clone-local gradient and clip', async () => {
    const fixture = '<figure class="mermaid-figure"><pre class="mermaid">flowchart LR\n  A --> B</pre><pre class="mermaid" data-docreader-chrome><svg id="root" viewBox="0 0 80 40" aria-labelledby="title desc"><title id="title">Paint</title><desc id="desc">Gradient clipped</desc><defs><linearGradient id="paint"><stop offset="0" stop-color="rgb(0, 128, 0)"/><stop offset="1" stop-color="rgb(0, 128, 0)"/></linearGradient><clipPath id="clip"><rect width="60" height="30"/></clipPath><marker id="arrow" markerWidth="16" markerHeight="16" refX="14" refY="8" orient="auto"><path d="M0,0 L16,8 L0,16z" fill="black"/></marker></defs><g class="node" id="flowchart-A-0"><rect id="shape" width="80" height="40" fill="url(#paint)" clip-path="url(#clip)"/><line x1="1" y1="32" x2="50" y2="32" stroke="black" stroke-width="4" marker-end="url(#arrow)"/></g><g class="node" id="flowchart-B-1"><rect/></g><path class="flowchart-link" data-id="L_A_B_0" d="M0 0H80"/></svg></pre><figcaption>Figure 1. Paint.</figcaption></figure>';
    const doc = await openDoc(DOC, { chrome: { bar: false } }, { browser, csp: 'strict', html: (html) => `${html}${fixture}` });
    try {
      const source = await doc.page.locator('main[data-harness-root] figure svg').evaluate((svg) => svg.outerHTML);
      await doc.page.getByRole('button', { name: 'Full screen' }).click();
      const got = await doc.page.evaluate(() => {
        const root = document.querySelector('main[data-harness-root]') as HTMLElement;
        const source = root.querySelector('figure > pre[data-docreader-chrome] > svg') as SVGSVGElement;
        const clone = root.querySelector('.fig-overlay.open svg') as SVGSVGElement;
        const rect = clone.querySelector('g.node rect') as SVGRectElement;
        return {
          open: root.querySelector('.fig-overlay')?.classList.contains('open'),
          ids: [clone.id, ...Array.from(clone.querySelectorAll('[id]'), (el) => el.id)],
          source: source.outerHTML,
          aria: clone.getAttribute('aria-labelledby'),
          fill: rect.getAttribute('fill'),
          clip: rect.getAttribute('clip-path'),
          marker: clone.querySelector('line')?.getAttribute('marker-end'),
          paint: getComputedStyle(rect).fill,
          geometry: rect.getBoundingClientRect().width,
          box: (() => {
            const box = rect.getBoundingClientRect();
            const svg = clone.getBoundingClientRect();
            return { x: box.x - svg.x, y: box.y - svg.y, width: box.width, height: box.height, svgWidth: svg.width, svgHeight: svg.height };
          })(),
          line: (() => {
            const box = clone.querySelector('line')?.getBoundingClientRect();
            const svg = clone.getBoundingClientRect();
            return box === undefined ? null : { x: box.x - svg.x, y: box.y - svg.y, width: box.width, height: box.height };
          })(),
          chrome: Array.from(clone.querySelectorAll('*')).every((el) => el.hasAttribute('data-docreader-chrome')),
        };
      });
      await doc.page.evaluate(() => {
        const root = document.querySelector('main[data-harness-root]') as HTMLElement;
        const source = root.querySelector('figure > pre[data-docreader-chrome] svg') as SVGSVGElement;
        (source.querySelector('linearGradient stop') as SVGStopElement).setAttribute('stop-color', 'rgb(255, 0, 0)');
        (source.querySelector('clipPath rect') as SVGRectElement).setAttribute('width', '0');
        (source.querySelector('marker path') as SVGPathElement).setAttribute('fill', 'rgb(255, 0, 0)');
      });
      expect(got.open).toBe(true);
      expect(got.ids.every((id) => /^docreader\.\d+\.figure(?:\.\d+)?$/.test(id))).toBe(true);
      expect(got.aria).toMatch(/^docreader\.\d+\.figure\.\d+ docreader\.\d+\.figure\.\d+$/);
      expect(got).toMatchObject({ fill: expect.stringMatching(/^url\(#docreader\./), clip: expect.stringMatching(/^url\(#docreader\./), marker: expect.stringMatching(/^url\(#docreader\./), chrome: true, source });
      expect(got.paint).toMatch(/url\(["']?#docreader\./);
      expect(got.geometry).toBeGreaterThan(0);
      const image = decodePng(await doc.page.locator('main[data-harness-root] .fig-overlay.open svg').screenshot());
      const sample = (x: number, y: number): readonly number[] => pixel(image, Math.floor(image.width * x / (got.box.svgWidth || 1)), Math.floor(image.height * y / (got.box.svgHeight || 1)));
      const painted = sample(got.box.x + got.box.width / 4, got.box.y + got.box.height / 4);
      const clipped = sample(got.box.x + got.box.width * 0.9, got.box.y + got.box.height / 4);
      const marked = got.line === null ? [255, 255, 255, 255] : sample(got.line.x + got.line.width + 4, got.line.y + got.line.height / 2);
      expect(painted[1]).toBeGreaterThan(100);
      expect(painted[0]).toBeLessThan(40);
      expect(clipped[0]).toBeGreaterThan(200);
      expect(clipped[1]).toBeGreaterThan(200);
      expect(clipped[2]).toBeGreaterThan(200);
      expect(marked[0]).toBeLessThan(80);
      expect(marked[1]).toBeLessThan(80);
      expect(marked[2]).toBeLessThan(80);
      expect(await doc.violations()).toEqual([]);
      expect({ aborted: doc.aborted, missing: doc.missing }).toEqual({ aborted: [], missing: [] });
    } finally {
      await doc.close();
    }
  });

  it('rebinds an escaped numeric root-issued selector that determines clone paint under reader policy', async () => {
    const fixture = '<figure class="mermaid-figure"><pre class="mermaid">flowchart LR\n  A --> B</pre><pre class="mermaid" data-docreader-chrome><svg id="root" viewBox="0 0 80 40"><style>#docreader\\.1\\.figure.hot{fill:rgb(0,128,0)}</style><g class="node" id="flowchart-A-0"><rect id="docreader.1.figure" class="hot" width="60" height="30"/></g><g class="node" id="flowchart-B-1"><rect/></g><path class="flowchart-link" data-id="L_A_B_0" d="M0 0H80"/></svg></pre><figcaption>Figure 1. Selector.</figcaption></figure>';
    const doc = await openDoc(DOC, { chrome: { bar: false } }, { browser, csp: 'reader', html: (html) => `${html}${fixture}` });
    try {
      await doc.page.getByRole('button', { name: 'Full screen' }).click();
      const paint = await doc.page.evaluate(() => {
        const rect = document.querySelector('main[data-harness-root] .fig-overlay.open svg g.node rect');
        return rect === null ? '' : getComputedStyle(rect).fill;
      });
      expect(paint).toBe('rgb(0, 128, 0)');
      expect(await doc.violations()).toEqual([]);
      expect({ aborted: doc.aborted, missing: doc.missing }).toEqual({ aborted: [], missing: [] });
    } finally {
      await doc.close();
    }
  });

  it('fits, zooms, wheels, and drags the fullscreen figure through browser input', async () => {
    const markdown = ['# Flow', '', '```mermaid', 'flowchart TB', ' A[Start] --> B[Stop]', '```', '', '*Figure 1. Tall.*', ''].join('\n');
    const doc = await openDoc(markdown, { mermaid: {} }, { browser, csp: 'reader' });
    try {
      await doc.page.getByRole('button', { name: 'Full screen' }).click();
      const stage = doc.page.locator('main[data-harness-root] .fo-stage');
      const figure = stage.locator('svg');
      const initial = await figure.evaluate((svg) => svg.style.transform);
      expect(initial).toMatch(/^translate\(.+\) scale\((?:0\.|1\.)/);

      const box = await stage.boundingBox();
      if (box === null) throw new Error('fullscreen stage has no browser box');
      await doc.page.keyboard.down('Control');
      await doc.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await doc.page.mouse.wheel(0, -120);
      await doc.page.waitForFunction((prior) => {
        const svg = document.querySelector('main[data-harness-root] .fo-stage svg') as SVGSVGElement;
        return svg.style.transform !== prior;
      }, initial);
      await doc.page.keyboard.up('Control');
      const zoomed = await figure.evaluate((svg) => svg.style.transform);
      expect(zoomed).not.toBe(initial);

      const beforeWheel = translation(zoomed);
      await doc.page.mouse.wheel(25, 50);
      await doc.page.waitForFunction((before) => {
        const svg = document.querySelector('main[data-harness-root] .fo-stage svg') as SVGSVGElement;
        return svg.style.transform !== before;
      }, zoomed);
      const wheeled = await figure.evaluate((svg) => svg.style.transform);
      expect(translation(wheeled)).toEqual({ x: beforeWheel.x - 25, y: beforeWheel.y - 50 });
      expect(wheeled).not.toBe(zoomed);
      await doc.page.mouse.move(box.x + 80, box.y + 80);
      await doc.page.mouse.down();
      await doc.page.mouse.move(box.x + 130, box.y + 120);
      await doc.page.mouse.up();
      expect(await figure.evaluate((svg) => svg.style.transform)).not.toBe(wheeled);
      expect(await doc.violations()).toEqual([]);
    } finally {
      await doc.close();
    }
  });

  it('suppresses rv-draw transitions under reduced motion', async () => {
    const markdown = ['# Flow', '', '```mermaid', 'flowchart LR', '  A[Start] --> B[Stop]', '```', '', '*Figure 1. Playback.*', ''].join('\n');
    const doc = await openDoc(markdown, { mermaid: {} }, { browser, csp: 'reader' });
    try {
      await doc.page.emulateMedia({ reducedMotion: 'reduce' });
      await doc.page.getByRole('button', { name: 'Play this diagram step by step' }).click();
      await doc.page.waitForFunction(() => document.querySelector('main[data-harness-root] figure svg path.flowchart-link.rv-draw') !== null);
      const transition = await doc.page.evaluate(() => {
        const edge = document.querySelector('main[data-harness-root] figure svg path.flowchart-link.rv-draw');
        const style = edge === null ? null : getComputedStyle(edge);
        return { property: style?.transitionProperty ?? '', duration: style?.transitionDuration ?? '' };
      });
      expect(transition).toEqual({ property: 'none', duration: '0s' });
      expect(await doc.violations()).toEqual([]);
    } finally {
      await doc.close();
    }
  });

  it('drives generated Mermaid controls through the production Play, Animate and fullscreen paths', async () => {
    const markdown = ['# Flow', '', '```mermaid', 'flowchart LR', '  subgraph Group', '    A[Start] --> B[Stop]', '  end', '```', '', '*Figure 1. Playback.*', ''].join('\n');
    const doc = await openDoc(markdown, { mermaid: {} }, { browser, csp: 'reader' });
    try {
      const tools = doc.page.locator('main[data-harness-root] figure .tools');
      const play = tools.getByRole('button', { name: 'Play this diagram step by step' });
      const animate = tools.getByRole('button', { name: 'Animate edges' });
      const structure = await doc.page.evaluate(() => Array.from(document.querySelectorAll('main[data-harness-root] figure svg')).map((svg) => ({ nodes: Array.from(svg.querySelectorAll('g.node'), (node) => node.id), edges: Array.from(svg.querySelectorAll('path.flowchart-link'), (edge) => ({ id: edge.id, data: edge.getAttribute('data-id') })), tools: Array.from(svg.closest('figure')?.querySelectorAll('.tools button') ?? [], (button) => button.textContent) })));
      expect(await play.isVisible(), JSON.stringify(structure)).toBe(true);
      await play.click();
      await doc.page.waitForFunction(() => document.querySelectorAll('main[data-harness-root] figure svg g.node.rv-hide').length === 1);
      await doc.page.waitForFunction(() => document.querySelector('main[data-harness-root] figure svg path.flowchart-link.rv-draw') !== null);
      const transition = await doc.page.evaluate(() => {
        const edge = document.querySelector('main[data-harness-root] figure svg path.flowchart-link.rv-draw');
        const style = edge === null ? null : getComputedStyle(edge);
        return { property: style?.transitionProperty ?? '', duration: style?.transitionDuration ?? '' };
      });
      expect(transition).toEqual({ property: 'stroke-dashoffset', duration: '0.55s' });
      await doc.page.waitForFunction(() => document.querySelector('main[data-harness-root] figure svg path.flowchart-link.rv-draw') === null);
      const resting = await doc.page.evaluate(() => {
        const edge = document.querySelector('main[data-harness-root] figure svg path.flowchart-link');
        const style = edge === null ? null : getComputedStyle(edge);
        return { property: style?.transitionProperty ?? '', duration: style?.transitionDuration ?? '' };
      });
      expect(resting).toEqual({ property: 'opacity', duration: '0.38s' });
      await animate.click();
      expect(await animate.getAttribute('aria-pressed')).toBe('true');
      await tools.getByRole('button', { name: 'Full screen' }).click();
      expect(await doc.page.locator('main[data-harness-root] .fig-overlay.open svg').isVisible()).toBe(true);
      expect(await doc.violations()).toEqual([]);
      expect({ aborted: doc.aborted, missing: doc.missing }).toEqual({ aborted: [], missing: [] });
    } finally {
      await doc.close();
    }
  });

  it('keeps strict-CSP clone-local gradient and clip paint while preserving the source and making no request', async () => {
    const doc = await openDoc(DOC, { chrome: { bar: false } }, { browser, csp: 'strict' });
    try {
      await doc.page.evaluate(script);
      const got = await doc.page.evaluate(() => {
        type J = { cloneSvg(source: SVGSVGElement, ids: ReadonlyMap<string, string>): SVGSVGElement };
        const journal = (window as unknown as { __clone: { createJournal(live: () => boolean, operate: (fn: () => void) => void): { journal: J } } }).__clone
          .createJournal(() => true, (fn) => fn()).journal;
        const ns = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(ns, 'svg');
        svg.id = 'root';
        svg.setAttribute('viewBox', '0 0 80 40');
        svg.setAttribute('aria-labelledby', 'title desc');
        const title = document.createElementNS(ns, 'title');
        title.id = 'title';
        title.textContent = 'Paint';
        const desc = document.createElementNS(ns, 'desc');
        desc.id = 'desc';
        desc.textContent = 'Gradient clipped';
        const defs = document.createElementNS(ns, 'defs');
        const gradient = document.createElementNS(ns, 'linearGradient');
        gradient.id = 'paint';
        const stop = document.createElementNS(ns, 'stop');
        stop.setAttribute('offset', '1');
        stop.setAttribute('stop-color', 'rgb(0, 128, 0)');
        gradient.append(stop);
        const clip = document.createElementNS(ns, 'clipPath');
        clip.id = 'clip';
        const clipRect = document.createElementNS(ns, 'rect');
        clipRect.setAttribute('width', '70');
        clipRect.setAttribute('height', '30');
        clip.append(clipRect);
        defs.append(gradient, clip);
        const rect = document.createElementNS(ns, 'rect');
        rect.id = 'shape';
        rect.setAttribute('width', '80');
        rect.setAttribute('height', '40');
        rect.setAttribute('fill', 'url(#paint)');
        rect.setAttribute('clip-path', 'url(#clip)');
        rect.style.setProperty('stroke', 'url(#paint)', 'important');
        svg.append(title, desc, defs, rect);
        const root = document.querySelector('main[data-harness-root]') as HTMLElement;
        root.append(svg);
        const before = svg.outerHTML;
        const clone = journal.cloneSvg(svg, new Map([
          ['root', 'docreader.1.figure'], ['title', 'docreader.1.figure.1'], ['desc', 'docreader.1.figure.2'],
          ['paint', 'docreader.1.figure.3'], ['clip', 'docreader.1.figure.4'], ['shape', 'docreader.1.figure.5'],
        ]));
        root.append(clone);
        const clonedRect = clone.querySelector('rect[id]') as SVGRectElement;
        return {
          source: svg.outerHTML === before,
          root: clone.id,
          aria: clone.getAttribute('aria-labelledby'),
          fill: clonedRect.getAttribute('fill'),
          clip: clonedRect.getAttribute('clip-path'),
          stroke: clonedRect.style.getPropertyValue('stroke'),
          priority: clonedRect.style.getPropertyPriority('stroke'),
          paint: getComputedStyle(clonedRect).fill,
          chrome: Array.from(clone.querySelectorAll('*')).every((el) => el.hasAttribute('data-docreader-chrome')),
        };
      });
      expect(got).toMatchObject({
        source: true,
        root: 'docreader.1.figure',
        aria: 'docreader.1.figure.1 docreader.1.figure.2',
        fill: 'url(#docreader.1.figure.3)',
        clip: 'url(#docreader.1.figure.4)',
        priority: 'important',
        chrome: true,
      });
      expect(got.stroke).toMatch(/^url\(["']?#docreader\.1\.figure\.3["']?\)$/);
      expect(got.paint).toMatch(/url\(["']?#docreader\.1\.figure\.3["']?\)/);
      expect(await doc.violations()).toEqual([]);
      expect({ aborted: doc.aborted, missing: doc.missing }).toEqual({ aborted: [], missing: [] });
    } finally {
      await doc.close();
    }
  });
});
