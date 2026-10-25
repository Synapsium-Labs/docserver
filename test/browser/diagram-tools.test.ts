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
      const result = await doc.page.evaluate(() => {
        const svg = document.querySelector('main[data-harness-root] figure svg') as SVGSVGElement;
        const groups = Array.from(svg.querySelectorAll<SVGGElement>('g.node, g.edgeLabel, g.cluster-label'));
        return {
          internal: {
            nodeIds: Array.from(svg.querySelectorAll('g.node'), (node) => node.id),
            edgeDataIds: Array.from(svg.querySelectorAll('path.flowchart-link'), (edge) => edge.getAttribute('data-id')),
            edgeLabels: svg.querySelectorAll('g.edgeLabel').length,
            clusterLabels: svg.querySelectorAll('g.cluster-label').length,
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
      expect(result.internal.nodeIds.length).toBeGreaterThanOrEqual(2);
      expect(result.internal.nodeIds.every((id) => /flowchart-/.test(id))).toBe(true);
      expect(result.internal.edgeDataIds.some((id) => id?.startsWith('L_') === true)).toBe(true);
      expect(result.internal.edgeLabels).toBeGreaterThan(0);
      expect(result.internal.clusterLabels).toBeGreaterThan(0);
      expect(result.internal.shapes).toContain('polygon');
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
      await doc.page.keyboard.up('Control');
      const zoomed = await figure.evaluate((svg) => svg.style.transform);
      expect(zoomed).not.toBe(initial);

      await doc.page.mouse.wheel(25, 50);
      const wheeled = await figure.evaluate((svg) => svg.style.transform);
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
