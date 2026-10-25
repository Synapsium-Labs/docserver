// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { destroyEnhancement, enhance } from '../src/enhance/index.js';
import { render } from '../src/render/index.js';

const mounted: HTMLElement[] = [];

function figure(): HTMLElement {
  const root = document.createElement('main');
  root.innerHTML = '<h1>Diagram tools</h1><figure class="mermaid-figure"><pre class="mermaid">flowchart LR\n  A --> B</pre><pre class="mermaid" data-docreader-chrome><svg id="diagram-root" viewBox="0 0 240 100"><g class="node" id="flowchart-A-0"><rect width="80" height="30"/></g><g class="node" id="flowchart-B-1"><rect x="140" width="80" height="30"/></g><path class="flowchart-link" data-id="L_A_B_0" d="M80 15H140"/></svg></pre><figcaption>Figure 1. A path.</figcaption></figure>';
  document.body.append(root);
  mounted.push(root);
  return root;
}

function definitionFigure(): HTMLElement {
  const root = document.createElement('main');
  root.innerHTML = `${render([
    '# Diagram definitions',
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
    '| Long form | The longer neutral term |',
    '| Form | The shorter neutral term |',
  ].join('\n')).html}<figure class="mermaid-figure"><pre class="mermaid">flowchart LR\n  A --> B</pre><pre class="mermaid" data-docreader-chrome><svg id="definition-root" viewBox="0 0 240 100"><g class="node" id="flowchart-A-0"><rect width="80" height="30"/><text><tspan>Long</tspan><tspan> form</tspan></text></g><g class="node" id="flowchart-B-1"><polygon points="140,0 220,15 140,30 60,15"/><text>R1</text></g><g class="edgeLabel"><g data-id="L_A_B_0"><text>Long form</text></g></g><g class="cluster-label"><text>R1</text></g><path class="flowchart-link" data-id="L_A_B_0" d="M80 15H140"/></svg></pre><figcaption>Figure 1. Definitions.</figcaption></figure>`;
  document.body.append(root);
  mounted.push(root);
  return root;
}

afterEach(async () => {
  for (const root of mounted.splice(0)) await destroyEnhancement(root).catch(() => undefined);
  document.body.replaceChildren();
});

describe('diagram tools', () => {
  it('marks terms, IDs, edge labels, and cluster labels with accessible definition controls', async () => {
    const root = definitionFigure();
    await enhance(root, { copy: () => undefined });

    const svg = root.querySelector('#definition-root') as SVGSVGElement;
    const blocks = Array.from(svg.querySelectorAll<SVGGElement>('.dnode'));
    expect(blocks.map((block) => ({ text: block.textContent?.replace(/\s+/g, ' ').trim(), term: block.dataset.term, ref: block.dataset.ref }))).toEqual([
      { text: 'Long form', term: 'long form', ref: undefined },
      { text: 'R1', term: undefined, ref: 'R1' },
      { text: 'Long form', term: 'long form', ref: undefined },
      { text: 'R1', term: undefined, ref: 'R1' },
    ]);
    for (const block of blocks) {
      expect(block).toMatchObject({ tabIndex: 0, role: 'button' });
      expect(block.getAttribute('aria-haspopup')).toBe('dialog');
      expect(block.getAttribute('aria-expanded')).toBe('false');
      // jsdom has no SVG layout box; Chromium verifies the independently inserted cue paint.
      expect(block.querySelectorAll('.dn-ring, .dn-dot')).toHaveLength(0);
    }
    expect(svg.getAttribute('role')).toBe('group');
  });

  it('uses configured ID vocabularies, rejects qualifiers, and leaves IDs disabled', async () => {
    const root = definitionFigure();
    const node = root.querySelector('#flowchart-B-1') as SVGGElement;
    node.querySelector('text')?.replaceChildren('external R1');
    await enhance(root, { copy: () => undefined, vocabulary: { ids: { prefixes: ['R'] }, qualifiers: ['external'] } });
    expect(node.dataset.ref).toBeUndefined();

    await destroyEnhancement(root);
    node.querySelector('text')?.replaceChildren('R1');
    await enhance(root, { copy: () => undefined, vocabulary: { ids: { prefixes: ['R'] } } });
    expect(node.dataset.ref).toBe('R1');

    await destroyEnhancement(root);
    await enhance(root, { copy: () => undefined, vocabulary: { ids: false } });
    expect(node.classList.contains('dnode')).toBe(false);
  });

  it('removes definition chrome from a moved node during teardown', async () => {
    const root = definitionFigure();
    await enhance(root, { copy: () => undefined });
    const node = root.querySelector('#flowchart-A-0') as SVGGElement;
    const ring = node.querySelector('.dn-ring') as SVGRectElement;
    const destination = root.querySelector('#flowchart-B-1') as SVGGElement;
    destination.append(ring);

    await destroyEnhancement(root);
    expect(destination.querySelector('.dn-ring')).toBeNull();
    expect(root.querySelector('.dn-dot')).toBeNull();
    expect(node.classList.contains('dnode')).toBe(false);
  });

  it('copies the captured Mermaid source through the host adapter', async () => {
    const root = figure();
    const copy = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);

    await enhance(root, { copy });
    const button = Array.from(root.querySelectorAll('button')).find((b) => b.textContent === 'Copy Mermaid');
    expect(button).toBeDefined();
    button?.click();

    await vi.waitFor(() => expect(copy).toHaveBeenCalledWith('flowchart LR\n  A --> B'));
  });

  it('settles a pending copy after destroy without mutating detached chrome', async () => {
    const root = figure();
    let resolve: () => void = () => undefined;
    const copy = () => new Promise<void>((done) => { resolve = done; });
    await enhance(root, { copy });
    const button = Array.from(root.querySelectorAll('button')).find((b) => b.textContent === 'Copy Mermaid') as HTMLButtonElement;

    button.click();
    await destroyEnhancement(root);
    resolve();
    await Promise.resolve();
    expect(button.textContent).toBe('Copy Mermaid');
  });

  it('reveals a flowchart in graph order and toggles edge animation independently', async () => {
    const root = figure();
    await enhance(root, { copy: () => undefined });
    const play = Array.from(root.querySelectorAll('button')).find((b) => b.textContent === 'Play');
    const animate = Array.from(root.querySelectorAll('button')).find((b) => b.textContent === 'Animate edges');
    const svg = root.querySelector('svg') as SVGSVGElement;

    expect(play).toBeDefined();
    play?.click();
    expect(svg.querySelector('#flowchart-A-0')?.classList.contains('rv-hide')).toBe(false);
    expect(svg.querySelector('#flowchart-B-1')?.classList.contains('rv-hide')).toBe(true);

    animate?.click();
    expect(svg.classList.contains('flowing')).toBe(true);
    expect(animate?.getAttribute('aria-pressed')).toBe('true');
  });

  it('draws an edge through two frames and cleans it 600ms after its reveal', async () => {
    vi.useFakeTimers();
    const root = figure();
    const svg = root.querySelector('svg') as SVGSVGElement;
    const edge = svg.querySelector('path') as SVGPathElement;
    const cluster = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    cluster.setAttribute('class', 'cluster');
    svg.append(cluster);
    edge.style.setProperty('stroke-dasharray', '2 1');
    Object.defineProperty(edge, 'getTotalLength', { configurable: true, value: () => 42 });
    await enhance(root, { copy: () => undefined });
    const play = Array.from(root.querySelectorAll('button')).find((b) => b.textContent === 'Play');

    play?.click();
    expect(cluster.style.getPropertyValue('opacity')).toBe('0.35');
    await vi.advanceTimersByTimeAsync(520);
    expect(edge.classList.contains('rv-draw')).toBe(true);
    expect(edge.style.getPropertyValue('stroke-dasharray')).toBe('42 42');
    expect(edge.style.getPropertyValue('stroke-dashoffset')).toBe('42');
    await vi.advanceTimersByTimeAsync(31);
    expect(edge.style.getPropertyValue('stroke-dashoffset')).toBe('0');
    await vi.advanceTimersByTimeAsync(568);
    expect(edge.classList.contains('rv-draw')).toBe(true);
    await vi.advanceTimersByTimeAsync(1);
    expect(edge.style.getPropertyValue('stroke-dasharray')).toBe('2 1');
    expect(edge.style.getPropertyValue('stroke-dashoffset')).toBe('');
    expect(edge.classList.contains('rv-draw')).toBe(false);
    vi.useRealTimers();
  });

  it('restores authored important edge and cluster styles before replay takes its snapshot', async () => {
    vi.useFakeTimers();
    const root = figure();
    const svg = root.querySelector('svg') as SVGSVGElement;
    const edge = svg.querySelector('path') as SVGPathElement;
    const cluster = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    cluster.setAttribute('class', 'cluster');
    svg.append(cluster);
    edge.style.setProperty('stroke-dasharray', '2 1', 'important');
    edge.style.setProperty('stroke-dashoffset', '7', 'important');
    cluster.style.setProperty('opacity', '0.6', 'important');
    Object.defineProperty(edge, 'getTotalLength', { configurable: true, value: () => 42 });
    await enhance(root, { copy: () => undefined });
    const play = Array.from(root.querySelectorAll('button')).find((b) => b.textContent === 'Play') as HTMLButtonElement;

    play.click();
    await vi.advanceTimersByTimeAsync(520);
    play.click();

    await vi.runAllTimersAsync();

    expect(edge.style.getPropertyValue('stroke-dasharray')).toBe('2 1');
    expect(edge.style.getPropertyPriority('stroke-dasharray')).toBe('important');
    expect(edge.style.getPropertyValue('stroke-dashoffset')).toBe('7');
    expect(edge.style.getPropertyPriority('stroke-dashoffset')).toBe('important');
    expect(cluster.style.getPropertyValue('opacity')).toBe('0.6');
    expect(cluster.style.getPropertyPriority('opacity')).toBe('important');
    vi.useRealTimers();
  });

  it('cancels queued drawable-edge frames on destroy without changing authored priority', async () => {
    vi.useFakeTimers();
    const root = figure();
    const view = root.ownerDocument.defaultView as Window;
    const request = Object.getOwnPropertyDescriptor(view, 'requestAnimationFrame');
    const cancel = Object.getOwnPropertyDescriptor(view, 'cancelAnimationFrame');
    const held = new Map<number, FrameRequestCallback>();
    let next = 0;
    Object.defineProperty(view, 'requestAnimationFrame', { configurable: true, value: (callback: FrameRequestCallback): number => {
      next += 1;
      held.set(next, callback);
      return next;
    } });
    Object.defineProperty(view, 'cancelAnimationFrame', { configurable: true, value: (): void => undefined });
    try {
      const edge = root.querySelector('path') as SVGPathElement;
      edge.style.setProperty('stroke-dasharray', '2 1', 'important');
      edge.style.setProperty('stroke-dashoffset', '7', 'important');
      Object.defineProperty(edge, 'getTotalLength', { configurable: true, value: () => 42 });
      await enhance(root, { copy: () => undefined });
      const play = Array.from(root.querySelectorAll('button')).find((b) => b.textContent === 'Play') as HTMLButtonElement;

      held.clear();
      play.click();
      await vi.advanceTimersByTimeAsync(520);
      expect(edge.classList.contains('rv-draw')).toBe(true);
      expect(edge.style.getPropertyValue('stroke-dashoffset')).toBe('42');
      const outer = held.values().next().value as FrameRequestCallback;
      expect(outer).toBeTypeOf('function');
      held.clear();
      outer(0);
      const inner = held.values().next().value as FrameRequestCallback;
      expect(inner).toBeTypeOf('function');
      held.clear();
      const requestsAtDestroy = next;
      await destroyEnhancement(root);
      inner(0);
      expect(edge.style.getPropertyValue('stroke-dasharray')).toBe('2 1');
      expect(edge.style.getPropertyPriority('stroke-dasharray')).toBe('important');
      expect(edge.style.getPropertyValue('stroke-dashoffset')).toBe('7');
      expect(edge.style.getPropertyPriority('stroke-dashoffset')).toBe('important');
      expect(next).toBe(requestsAtDestroy);
      expect(held.size).toBe(0);
    } finally {
      if (request === undefined) delete (view as unknown as Record<string, unknown>).requestAnimationFrame;
      else Object.defineProperty(view, 'requestAnimationFrame', request);
      if (cancel === undefined) delete (view as unknown as Record<string, unknown>).cancelAnimationFrame;
      else Object.defineProperty(view, 'cancelAnimationFrame', cancel);
      vi.useRealTimers();
    }
  });

  it('cancels a pending playback when its reader is destroyed', async () => {
    vi.useFakeTimers();
    const root = figure();
    const before = root.outerHTML;
    await enhance(root, { copy: () => undefined });
    const play = Array.from(root.querySelectorAll('button')).find((b) => b.textContent === 'Play') as HTMLButtonElement;

    play.click();
    await destroyEnhancement(root);
    await vi.runAllTimersAsync();
    expect(root.outerHTML).toBe(before);
    vi.useRealTimers();
  });

  it('writes the offset only after the second owned frame', async () => {
    vi.useFakeTimers();
    const root = figure();
    const view = root.ownerDocument.defaultView as Window;
    const request = Object.getOwnPropertyDescriptor(view, 'requestAnimationFrame');
    const cancel = Object.getOwnPropertyDescriptor(view, 'cancelAnimationFrame');
    const held = new Map<number, FrameRequestCallback>();
    let next = 0;
    Object.defineProperty(view, 'requestAnimationFrame', { configurable: true, value: (callback: FrameRequestCallback): number => {
      next += 1;
      held.set(next, callback);
      return next;
    } });
    Object.defineProperty(view, 'cancelAnimationFrame', { configurable: true, value: (): void => undefined });
    try {
      const edge = root.querySelector('path') as SVGPathElement;
      Object.defineProperty(edge, 'getTotalLength', { configurable: true, value: () => 42 });
      await enhance(root, { copy: () => undefined });
      const play = Array.from(root.querySelectorAll('button')).find((b) => b.textContent === 'Play') as HTMLButtonElement;

      held.clear();
      play.click();
      await vi.advanceTimersByTimeAsync(520);
      expect(edge.style.getPropertyValue('stroke-dashoffset')).toBe('42');
      const outer = held.values().next().value as FrameRequestCallback;
      held.clear();
      outer(0);
      expect(edge.style.getPropertyValue('stroke-dashoffset')).toBe('42');
      const inner = held.values().next().value as FrameRequestCallback;
      inner(0);
      expect(edge.style.getPropertyValue('stroke-dashoffset')).toBe('0');
    } finally {
      if (request === undefined) delete (view as unknown as Record<string, unknown>).requestAnimationFrame;
      else Object.defineProperty(view, 'requestAnimationFrame', request);
      if (cancel === undefined) delete (view as unknown as Record<string, unknown>).cancelAnimationFrame;
      else Object.defineProperty(view, 'cancelAnimationFrame', cancel);
      vi.useRealTimers();
    }
  });

  it('does not let held frames rewrite an edge after its cleanup retires the scope', async () => {
    vi.useFakeTimers();
    const root = figure();
    const view = root.ownerDocument.defaultView as Window;
    const request = Object.getOwnPropertyDescriptor(view, 'requestAnimationFrame');
    const cancel = Object.getOwnPropertyDescriptor(view, 'cancelAnimationFrame');
    const held = new Map<number, FrameRequestCallback>();
    let next = 0;
    Object.defineProperty(view, 'requestAnimationFrame', { configurable: true, value: (callback: FrameRequestCallback): number => {
      next += 1;
      held.set(next, callback);
      return next;
    } });
    Object.defineProperty(view, 'cancelAnimationFrame', { configurable: true, value: (): void => undefined });
    try {
      const edge = root.querySelector('path') as SVGPathElement;
      edge.style.setProperty('stroke-dasharray', '2 1', 'important');
      edge.style.setProperty('stroke-dashoffset', '7', 'important');
      Object.defineProperty(edge, 'getTotalLength', { configurable: true, value: () => 42 });
      await enhance(root, { copy: () => undefined });
      const play = Array.from(root.querySelectorAll('button')).find((b) => b.textContent === 'Play') as HTMLButtonElement;

      held.clear();
      play.click();
      await vi.advanceTimersByTimeAsync(520);
      expect(held.size).toBe(1);
      const outer = held.values().next().value as FrameRequestCallback;
      held.clear();
      outer(0);
      const inner = held.values().next().value as FrameRequestCallback;
      await vi.advanceTimersByTimeAsync(600);
      expect(edge.style.getPropertyValue('stroke-dashoffset')).toBe('7');
      expect(edge.style.getPropertyPriority('stroke-dashoffset')).toBe('important');
      inner(0);
      expect(edge.style.getPropertyValue('stroke-dashoffset')).toBe('7');
      expect(edge.style.getPropertyPriority('stroke-dashoffset')).toBe('important');
      await destroyEnhancement(root);
      expect(edge.style.getPropertyValue('stroke-dashoffset')).toBe('7');
      expect(edge.style.getPropertyPriority('stroke-dashoffset')).toBe('important');
    } finally {
      if (request === undefined) delete (view as unknown as Record<string, unknown>).requestAnimationFrame;
      else Object.defineProperty(view, 'requestAnimationFrame', request);
      if (cancel === undefined) delete (view as unknown as Record<string, unknown>).cancelAnimationFrame;
      else Object.defineProperty(view, 'cancelAnimationFrame', cancel);
      vi.useRealTimers();
    }
  });

  it('keeps active transient work in the second figure when the first replays', async () => {
    vi.useFakeTimers();
    const root = figure();
    const extra = figure().querySelector('figure') as HTMLElement;
    root.append(extra);
    const edges = Array.from(root.querySelectorAll('path')) as SVGPathElement[];
    for (const edge of edges) Object.defineProperty(edge, 'getTotalLength', { configurable: true, value: () => 42 });
    await enhance(root, { copy: () => undefined });
    const plays = Array.from(root.querySelectorAll('button')).filter((b) => b.textContent === 'Play') as HTMLButtonElement[];

    plays[0]?.click();
    plays[1]?.click();
    await vi.advanceTimersByTimeAsync(520);
    const secondBefore = { dasharray: edges[1]?.style.getPropertyValue('stroke-dasharray'), dashoffset: edges[1]?.style.getPropertyValue('stroke-dashoffset') };
    plays[0]?.click();
    expect(edges[1]?.style.getPropertyValue('stroke-dasharray')).toBe(secondBefore.dasharray);
    expect(edges[1]?.style.getPropertyValue('stroke-dashoffset')).toBe(secondBefore.dashoffset);
    expect(edges[1]?.classList.contains('rv-draw')).toBe(true);
    vi.useRealTimers();
  });

  it('keeps the normal 520ms cadence and uses the reduced 60ms cadence', async () => {
    vi.useFakeTimers();
    const normal = figure();
    await enhance(normal, { copy: () => undefined });
    const normalSvg = normal.querySelector('svg') as SVGSVGElement;
    const normalPlay = Array.from(normal.querySelectorAll('button')).find((b) => b.textContent === 'Play') as HTMLButtonElement;
    normalPlay.click();
    await vi.advanceTimersByTimeAsync(519);
    expect(normalSvg.querySelector('#flowchart-B-1')?.classList.contains('rv-hide')).toBe(true);
    await vi.advanceTimersByTimeAsync(1);
    expect(normalSvg.querySelector('#flowchart-B-1')?.classList.contains('rv-hide')).toBe(false);

    await destroyEnhancement(normal);
    normal.remove();
    const reduced = figure();
    const view = reduced.ownerDocument.defaultView as Window;
    const match = view.matchMedia;
    view.matchMedia = (() => ({ matches: true, media: '', onchange: null, addListener: () => undefined, removeListener: () => undefined, addEventListener: () => undefined, removeEventListener: () => undefined, dispatchEvent: () => false })) as unknown as typeof view.matchMedia;
    try {
      await enhance(reduced, { copy: () => undefined });
      const reducedSvg = reduced.querySelector('svg') as SVGSVGElement;
      const reducedPlay = Array.from(reduced.querySelectorAll('button')).find((b) => b.textContent === 'Play') as HTMLButtonElement;
      reducedPlay.click();
      await vi.advanceTimersByTimeAsync(59);
      expect(reducedSvg.querySelector('#flowchart-B-1')?.classList.contains('rv-hide')).toBe(true);
      await vi.advanceTimersByTimeAsync(1);
      expect(reducedSvg.querySelector('#flowchart-B-1')?.classList.contains('rv-hide')).toBe(false);
    } finally {
      view.matchMedia = match;
      vi.useRealTimers();
    }
  });

  it('cleans each edge locally without resetting later five-node playback state', async () => {
    vi.useFakeTimers();
    const root = figure();
    const svg = root.querySelector('svg') as SVGSVGElement;
    svg.innerHTML = [
      '<g class="node" id="flowchart-A-0"/><g class="node" id="flowchart-B-1"/><g class="node" id="flowchart-C-2"/><g class="node" id="flowchart-D-3"/><g class="node" id="flowchart-E-4"/>',
      '<path class="flowchart-link" data-id="L_A_B_0"/><path class="flowchart-link" data-id="L_B_C_1"/><path class="flowchart-link" data-id="L_C_D_2"/><path class="flowchart-link" data-id="L_D_E_3"/>',
    ].join('');
    const edges = Array.from(svg.querySelectorAll('path')) as SVGPathElement[];
    for (const edge of edges) Object.defineProperty(edge, 'getTotalLength', { configurable: true, value: () => 42 });
    await enhance(root, { copy: () => undefined });
    const play = Array.from(root.querySelectorAll('button')).find((b) => b.textContent === 'Play') as HTMLButtonElement;

    play.click();
    await vi.advanceTimersByTimeAsync(1040);
    expect(edges[0]?.classList.contains('rv-draw')).toBe(true);
    expect(edges[1]?.classList.contains('rv-draw')).toBe(true);
    await vi.advanceTimersByTimeAsync(80);
    expect(edges[0]?.classList.contains('rv-draw')).toBe(false);
    expect(edges[1]?.classList.contains('rv-draw')).toBe(true);
    expect(edges[1]?.style.getPropertyValue('stroke-dasharray')).toBe('42 42');
    await vi.advanceTimersByTimeAsync(1200);
    expect(edges[0]?.classList.contains('rv-draw')).toBe(false);
    expect(edges[0]?.style.getPropertyValue('stroke-dasharray')).toBe('');
    expect(edges[3]?.classList.contains('rv-hide')).toBe(false);
    vi.useRealTimers();
  });

  it('restores authored cluster opacity on normal no-length completion', async () => {
    vi.useFakeTimers();
    const root = figure();
    const svg = root.querySelector('svg') as SVGSVGElement;
    const cluster = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    cluster.setAttribute('class', 'cluster');
    cluster.style.setProperty('opacity', '0.6', 'important');
    svg.append(cluster);
    await enhance(root, { copy: () => undefined });
    const play = Array.from(root.querySelectorAll('button')).find((b) => b.textContent === 'Play') as HTMLButtonElement;

    play.click();
    await vi.advanceTimersByTimeAsync(1039);
    expect(cluster.style.getPropertyValue('opacity')).toBe('0.35');
    await vi.advanceTimersByTimeAsync(1);
    expect(cluster.style.getPropertyValue('opacity')).toBe('0.6');
    expect(cluster.style.getPropertyPriority('opacity')).toBe('important');
    vi.useRealTimers();
  });

  it('keeps a later host style edit when replay cleanup runs', async () => {
    vi.useFakeTimers();
    const root = figure();
    const edge = root.querySelector('path') as SVGPathElement;
    Object.defineProperty(edge, 'getTotalLength', { configurable: true, value: () => 42 });
    await enhance(root, { copy: () => undefined });
    const play = Array.from(root.querySelectorAll('button')).find((b) => b.textContent === 'Play') as HTMLButtonElement;

    play.click();
    await vi.advanceTimersByTimeAsync(520);
    edge.style.setProperty('stroke-dasharray', '9 3', 'important');
    await vi.advanceTimersByTimeAsync(600);
    expect(edge.style.getPropertyValue('stroke-dasharray')).toBe('9 3');
    expect(edge.style.getPropertyPriority('stroke-dasharray')).toBe('important');
    vi.useRealTimers();
  });

  it('orders underscore IDs and cycles without DOM-order edge loss, then reveals the label locally', async () => {
    vi.useFakeTimers();
    const root = figure();
    const svg = root.querySelector('svg') as SVGSVGElement;
    svg.innerHTML = [
      '<g class="node" id="flowchart-C_D-1"/><g class="node" id="flowchart-A_B-0"/>',
      '<path class="flowchart-link" data-id="L_A_B_C_D_0"/><path class="flowchart-link" data-id="L_C_D_A_B_1"/>',
      '<g class="edgeLabel"><g data-id="L_A_B_C_D_0"/></g>',
    ].join('');
    const [first] = Array.from(svg.querySelectorAll('path')) as SVGPathElement[];
    if (first === undefined) throw new Error('missing first graph edge');
    Object.defineProperty(first, 'getTotalLength', { configurable: true, value: () => 42 });
    await enhance(root, { copy: () => undefined });
    const play = Array.from(root.querySelectorAll('button')).find((b) => b.textContent === 'Play') as HTMLButtonElement;

    play.click();
    expect(svg.querySelector('#flowchart-C_D-1')?.classList.contains('rv-hide')).toBe(false);
    expect(svg.querySelector('#flowchart-A_B-0')?.classList.contains('rv-hide')).toBe(true);
    await vi.advanceTimersByTimeAsync(520);
    expect(first.classList.contains('rv-hide')).toBe(false);
    expect(svg.querySelector('.edgeLabel')?.classList.contains('rv-hide')).toBe(true);
    await vi.advanceTimersByTimeAsync(600);
    expect(svg.querySelector('.edgeLabel')?.classList.contains('rv-hide')).toBe(false);
    vi.useRealTimers();
  });

  it('normalizes prefixed fallback edge IDs before graph ordering', async () => {
    const root = figure();
    const svg = root.querySelector('svg') as SVGSVGElement;
    const a = svg.querySelector('#flowchart-A-0') as SVGGElement;
    const b = svg.querySelector('#flowchart-B-1') as SVGGElement;
    const edge = svg.querySelector('path') as SVGPathElement;
    svg.insertBefore(b, a);
    edge.removeAttribute('data-id');
    edge.id = 'diagram-L_A_B_0';
    await enhance(root, { copy: () => undefined });
    const play = Array.from(root.querySelectorAll('button')).find((b) => b.textContent === 'Play');

    play?.click();
    expect(a.classList.contains('rv-hide')).toBe(false);
    expect(b.classList.contains('rv-hide')).toBe(true);
    await vi.waitFor(() => expect(edge.classList.contains('rv-hide')).toBe(false));
  });

  it('opens a clean fullscreen clone while source playback owns transient edge paint', async () => {
    vi.useFakeTimers();
    const root = figure();
    const source = root.querySelector('svg') as SVGSVGElement;
    const edge = source.querySelector('path') as SVGPathElement;
    edge.style.setProperty('stroke-dasharray', '2 1');
    Object.defineProperty(edge, 'getTotalLength', { configurable: true, value: () => 42 });
    await enhance(root, { copy: () => undefined });
    const play = Array.from(root.querySelectorAll('button')).find((b) => b.textContent === 'Play') as HTMLButtonElement;
    const full = Array.from(root.querySelectorAll('button')).find((b) => b.textContent === 'Full screen') as HTMLButtonElement;

    play.click();
    await vi.advanceTimersByTimeAsync(520);
    full.click();
    const clone = root.querySelector('.fig-overlay svg path') as SVGPathElement;
    expect(clone.classList.contains('rv-draw')).toBe(false);
    expect(clone.style.getPropertyValue('stroke-dasharray')).toBe('2 1');
    expect(clone.style.getPropertyValue('stroke-dashoffset')).toBe('');
    vi.useRealTimers();
  });

  it('creates a root-local fullscreen clone and removes its scroll lock on Escape', async () => {
    const root = figure();
    await enhance(root, { copy: () => undefined });
    const full = Array.from(root.querySelectorAll('button')).find((b) => b.textContent === 'Full screen');

    full?.click();
    const overlay = root.querySelector('.fig-overlay') as HTMLElement;
    expect(overlay.classList.contains('open')).toBe(true);
    expect(root.classList.contains('fig-open')).toBe(true);
    expect(overlay.querySelector('svg')?.id).not.toBe('');

    overlay.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(overlay.classList.contains('open')).toBe(false);
    expect(root.classList.contains('fig-open')).toBe(false);
  });

  it('initially prefers a readable tall-diagram fit with a 16px top edge', async () => {
    const root = figure();
    const source = root.querySelector('svg') as SVGSVGElement;
    source.setAttribute('viewBox', '0 0 100 1000');
    await enhance(root, { copy: () => undefined });

    const width = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
    const height = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight');
    Object.defineProperties(HTMLElement.prototype, {
      clientWidth: { configurable: true, get: function () { return this.classList.contains('fo-stage') ? 500 : width?.get?.call(this) ?? 0; } },
      clientHeight: { configurable: true, get: function () { return this.classList.contains('fo-stage') ? 500 : height?.get?.call(this) ?? 0; } },
    });
    try {
      Array.from(root.querySelectorAll('button')).find((b) => b.textContent === 'Full screen')?.click();
      const stage = root.querySelector('.fo-stage') as HTMLElement;
      expect((stage.querySelector('svg') as SVGSVGElement).style.transform).toBe('translate(187.5px, 16px) scale(1.25)');
    } finally {
      if (width === undefined) delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientWidth;
      else Object.defineProperty(HTMLElement.prototype, 'clientWidth', width);
      if (height === undefined) delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientHeight;
      else Object.defineProperty(HTMLElement.prototype, 'clientHeight', height);
    }
  });

  it('gives an overlay clone root-issued IDs without changing its drawing source', async () => {
    const root = figure();
    const source = root.querySelector('svg') as SVGSVGElement;
    source.setAttribute('aria-labelledby', 'diagram-root title desc');
    source.innerHTML = '<title id="title">Diagram</title><desc id="desc">Description</desc><defs><linearGradient id="paint"><stop offset="0"/></linearGradient><clipPath id="clip"><rect width="10" height="10"/></clipPath></defs><g class="node" id="flowchart-A-0"><rect id="shape" fill="url(#paint)" clip-path="url(#clip)"/></g><g class="node" id="flowchart-B-1"><rect/></g><path class="flowchart-link" data-id="L_A_B_0" d="M0 0"/><use href="#shape" xlink:href="#shape"/><text aria-describedby="desc title"/>';
    const before = source.outerHTML;
    await enhance(root, { copy: () => undefined });

    Array.from(root.querySelectorAll('button')).find((b) => b.textContent === 'Full screen')?.click();
    const clone = root.querySelector('.fig-overlay svg') as SVGSVGElement;
    const ids = Array.from(clone.querySelectorAll('[id]'), (el) => el.id);

    expect(clone.id).not.toBe(source.id);
    expect(ids.every((id) => /^docreader\.\d+\.figure(?:\.\d+)?$/.test(id))).toBe(true);
    expect(clone.getAttribute('aria-labelledby')).toBe(`${clone.id} ${ids[0]} ${ids[1]}`);
    expect(clone.querySelector('use')?.getAttribute('href')).toBe(`#${clone.querySelector('g.node rect')?.id}`);
    expect(source.outerHTML).toBe(before);
    expect(Array.from(clone.querySelectorAll('*')).every((el) => el.hasAttribute('data-docreader-chrome'))).toBe(true);
  });
});
