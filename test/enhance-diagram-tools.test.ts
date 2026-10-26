// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { destroyEnhancement, enhance } from '../src/enhance/index.js';
import { contextOf } from '../src/enhance/lifecycle.js';
import { show as showCard } from '../src/enhance/cards.js';
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
    '| Form | The shorter neutral term |',
    '| Long form | The longer neutral term |',
  ].join('\n')).html}<figure class="mermaid-figure"><pre class="mermaid">flowchart LR\n  A --> B</pre><pre class="mermaid" data-docreader-chrome><svg id="definition-root" viewBox="0 0 240 100"><g class="node" id="flowchart-A-0"><rect width="80" height="30"/><text><tspan>Long</tspan><tspan>form</tspan></text></g><g class="node" id="flowchart-B-1"><polygon points="140,0 220,15 140,30 60,15"/><text>R1</text></g><g class="edgeLabel"><g data-id="L_A_B_0"><text>Long form</text></g></g><g class="cluster-label"><text>R1</text></g><path class="flowchart-link" data-id="L_A_B_0" d="M80 15H140"/></svg></pre><figcaption>Figure 1. Definitions.</figcaption></figure>`;
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
      { text: 'Longform', term: 'long form', ref: undefined },
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

  it('derives definition identity and labels from the rendered source, not stale host data', async () => {
    const root = definitionFigure();
    const node = root.querySelector('#flowchart-A-0') as SVGGElement;
    node.setAttribute('data-ref', 'foreign');
    await enhance(root, { copy: () => undefined });

    expect(node.dataset.term).toBe('long form');
    expect(node.dataset.ref).toBeUndefined();
    expect(node.getAttribute('aria-label')).toBe('Long form: definition');
  });

  it('waits for usable geometry before painting definition cues', async () => {
    const root = definitionFigure();
    const svg = root.querySelector('#definition-root') as SVGSVGElement;
    const original = SVGGElement.prototype.getBBox;
    let reads = 0;
    Object.defineProperty(SVGGElement.prototype, 'getBBox', { configurable: true, value: () => {
      reads += 1;
      return { x: 0, y: 0, width: reads <= 4 ? 0 : 80, height: 30 };
    } });
    try {
      await enhance(root, { copy: () => undefined });
      await new Promise((resolve) => setTimeout(resolve, 250));
      expect(svg.querySelector('.dnode')).not.toBeNull();
      expect(svg.querySelector('.dn-ring, .dn-dot')).toBeNull();
    } finally {
      Object.defineProperty(SVGGElement.prototype, 'getBBox', { configurable: true, value: original });
    }
  });

  it('initializes semantics despite an authored dnode class and matches whole-label plurals', async () => {
    const root = definitionFigure();
    const node = root.querySelector('#flowchart-A-0') as SVGGElement;
    const edge = root.querySelector('.edgeLabel') as SVGGElement;
    node.classList.add('dnode');
    node.setAttribute('data-ref', 'foreign');
    edge.querySelector('text')?.replaceChildren('Long forms');
    await enhance(root, { copy: () => undefined });

    expect(node.dataset.term).toBe('long form');
    expect(node.dataset.ref).toBeUndefined();
    expect(node).toMatchObject({ tabIndex: 0, role: 'button' });
    expect(node.getAttribute('aria-label')).toBe('Long form: definition');
    expect(edge.dataset.term).toBe('long form');
  });

  it('requires a configured prefix longer than the default ID grammar', async () => {
    const root = document.createElement('main');
    root.innerHTML = `${render(['# Custom IDs', '', '## 1. Decisions', '', '| ID | Meaning |', '|---|---|', '| REQUIREMENT-77 | A custom ID |', '| REQUIREMENT-78 | A second valid ID |'].join('\n')).html}<figure class="mermaid-figure"><pre class="mermaid">flowchart LR\n A</pre><pre class="mermaid" data-docreader-chrome><svg viewBox="0 0 100 30"><g class="node" id="flowchart-A-0"><rect width="80" height="30"/><text>REQUIREMENT-77</text></g></svg></pre><figcaption>Figure 1. Custom.</figcaption></figure>`;
    document.body.append(root);
    mounted.push(root);
    const node = root.querySelector('g.node') as SVGGElement;
    await enhance(root, { copy: () => undefined });
    expect(node.dataset.ref).toBeUndefined();

    await destroyEnhancement(root);
    await enhance(root, { copy: () => undefined, vocabulary: { ids: { prefixes: ['REQUIREMENT'] } } });
    expect(node.dataset.ref).toBe('REQUIREMENT-77');
  });

  it('uses configured nondefault IDs, rejects qualifiers, and leaves IDs disabled', async () => {
    const root = document.createElement('main');
    root.innerHTML = `${render(['# Custom IDs', '', '## 1. Decisions', '', '| ID | Meaning |', '|---|---|', '| REQ-777 | A custom ID |'].join('\n')).html}<figure class="mermaid-figure"><pre class="mermaid">flowchart LR\n A</pre><pre class="mermaid" data-docreader-chrome><svg viewBox="0 0 100 30"><g class="node" id="flowchart-A-0"><rect width="80" height="30"/><text>external REQ-777</text></g></svg></pre><figcaption>Figure 1. Custom.</figcaption></figure>`;
    document.body.append(root);
    mounted.push(root);
    const node = root.querySelector('g.node') as SVGGElement;
    await enhance(root, { copy: () => undefined, vocabulary: { ids: { prefixes: ['REQ'] }, qualifiers: ['external'] } });
    expect(node.dataset.ref).toBeUndefined();

    await destroyEnhancement(root);
    node.querySelector('text')?.replaceChildren('REQ-777');
    await enhance(root, { copy: () => undefined, vocabulary: { ids: { prefixes: ['REQ'] } } });
    expect(node.dataset.ref).toBe('REQ-777');

    await destroyEnhancement(root);
    await enhance(root, { copy: () => undefined, vocabulary: { ids: false } });
    expect(node.classList.contains('dnode')).toBe(false);
  });

  it('defines a single-node drawing that cannot play', async () => {
    const root = definitionFigure();
    const svg = root.querySelector('#definition-root') as SVGSVGElement;
    const node = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    node.id = 'flowchart-R1-0';
    node.setAttribute('class', 'node');
    node.innerHTML = '<rect width="80" height="30"/><text>R1</text>';
    svg.replaceChildren(node);
    await enhance(root, { copy: () => undefined });

    expect(node.dataset.ref).toBe('R1');
    expect(node.getAttribute('role')).toBe('button');
    expect(svg.getAttribute('role')).toBe('group');
    expect(Array.from(root.querySelectorAll('button')).map((button) => button.textContent)).not.toContain('Play');
  });

  it('retries zero cue geometry after a no-IO resize without accumulating cues', async () => {
    const root = definitionFigure();
    const node = root.querySelector('#flowchart-A-0') as SVGGElement;
    const original = SVGGElement.prototype.getBBox;
    let usable = false;
    Object.defineProperty(SVGGElement.prototype, 'getBBox', { configurable: true, value: () => ({ x: 0, y: 0, width: usable ? 80 : 0, height: usable ? 30 : 0 }) });
    try {
      await enhance(root, { copy: () => undefined });
      await new Promise((resolve) => setTimeout(resolve, 250));
      expect(node.querySelector('.dn-ring, .dn-dot')).toBeNull();
      usable = true;
      root.ownerDocument.defaultView?.dispatchEvent(new Event('resize'));
      await vi.waitFor(() => expect(node.querySelectorAll('.dn-ring, .dn-dot')).toHaveLength(2));
      root.ownerDocument.defaultView?.dispatchEvent(new Event('resize'));
      await new Promise((resolve) => setTimeout(resolve, 250));
      expect(node.querySelectorAll('.dn-ring, .dn-dot')).toHaveLength(2);
    } finally {
      Object.defineProperty(SVGGElement.prototype, 'getBBox', { configurable: true, value: original });
    }
  });

  it('retries zero cue geometry after the reader reveal seam', async () => {
    const root = definitionFigure();
    const node = root.querySelector('#flowchart-A-0') as SVGGElement;
    const original = Object.getOwnPropertyDescriptor(SVGGElement.prototype, 'getBBox');
    let usable = false;
    let reads = 0;
    Object.defineProperty(SVGGElement.prototype, 'getBBox', { configurable: true, value: () => {
      reads += 1;
      return { x: 0, y: 0, width: usable ? 80 : 0, height: usable ? 30 : 0 };
    } });
    try {
      await enhance(root, { copy: () => undefined });
      await vi.waitFor(() => expect(reads).toBeGreaterThan(0));
      expect(node.querySelector('.dn-ring, .dn-dot')).toBeNull();
      usable = true;
      const ctx = contextOf(root);
      if (ctx === undefined) throw new Error('enhancement context missing');
      ctx.events.emit('reveal', { target: root.querySelector('h1') as Element });
      await vi.waitFor(() => expect(node.querySelectorAll('.dn-ring, .dn-dot')).toHaveLength(2));
    } finally {
      if (original === undefined) delete (SVGGElement.prototype as unknown as Record<string, unknown>).getBBox;
      else Object.defineProperty(SVGGElement.prototype, 'getBBox', original);
    }
  });

  it('reads the exact definition candidate set before the first cue insertion', async () => {
    const root = definitionFigure();
    const originalBox = Object.getOwnPropertyDescriptor(SVGGElement.prototype, 'getBBox');
    const originalInsert = Object.getOwnPropertyDescriptor(Node.prototype, 'insertBefore');
    const candidates = new Set(Array.from(root.querySelectorAll<SVGGElement>('g.node, g.edgeLabel, g.cluster-label')));
    const read = new Set<SVGGElement>();
    let firstCueIntercepted = false;
    let firstCueReads: Set<SVGGElement> | null = null;
    expect(candidates).toHaveLength(4);
    Object.defineProperty(SVGGElement.prototype, 'getBBox', { configurable: true, value: function () {
      if (candidates.has(this as SVGGElement)) read.add(this as SVGGElement);
      return { x: 0, y: 0, width: 80, height: 30 };
    } });
    Object.defineProperty(Node.prototype, 'insertBefore', { configurable: true, value: function (node: Node, child: Node | null) {
      if (!firstCueIntercepted && node.nodeType === 1 && (node as Element).classList.contains('dn-ring')) {
        firstCueIntercepted = true;
        firstCueReads = new Set(read);
      }
      return (originalInsert?.value as typeof Node.prototype.insertBefore).call(this, node, child);
    } });
    try {
      await enhance(root, { copy: () => undefined });
      await vi.waitFor(() => expect(firstCueIntercepted).toBe(true));
      expect(firstCueReads).toEqual(candidates);
    } finally {
      if (originalBox === undefined) delete (SVGGElement.prototype as unknown as Record<string, unknown>).getBBox;
      else Object.defineProperty(SVGGElement.prototype, 'getBBox', originalBox);
      if (originalInsert === undefined) delete (Node.prototype as unknown as Record<string, unknown>).insertBefore;
      else Object.defineProperty(Node.prototype, 'insertBefore', originalInsert);
    }
  });

  it('does not reobserve-loop when every observer registration emits an initial zero-geometry record', async () => {
    const root = definitionFigure();
    const view = root.ownerDocument.defaultView as Window & typeof globalThis;
    const originalObserver = Object.getOwnPropertyDescriptor(view, 'IntersectionObserver');
    const originalIdle = Object.getOwnPropertyDescriptor(view, 'requestIdleCallback');
    const originalCancelIdle = Object.getOwnPropertyDescriptor(view, 'cancelIdleCallback');
    const originalBox = Object.getOwnPropertyDescriptor(SVGGElement.prototype, 'getBBox');
    const idle: Array<() => void> = [];
    let reads = 0;
    let observes = 0;
    class Observer {
      constructor(privateCallback: IntersectionObserverCallback) { this.callback = privateCallback; }
      private readonly callback: IntersectionObserverCallback;
      observe(target: Element): void {
        observes += 1;
        queueMicrotask(() => this.callback([{ target, isIntersecting: true } as unknown as IntersectionObserverEntry], this as unknown as IntersectionObserver));
      }
      unobserve(): void {}
      disconnect(): void {}
      takeRecords(): IntersectionObserverEntry[] { return []; }
    }
    Object.defineProperty(view, 'IntersectionObserver', { configurable: true, value: Observer });
    Object.defineProperty(view, 'requestIdleCallback', { configurable: true, value: (fn: () => void): number => {
      idle.push(fn);
      return idle.length;
    } });
    Object.defineProperty(view, 'cancelIdleCallback', { configurable: true, value: (): void => undefined });
    Object.defineProperty(SVGGElement.prototype, 'getBBox', { configurable: true, value: () => {
      reads += 1;
      return { x: 0, y: 0, width: 0, height: 0 };
    } });
    try {
      await enhance(root, { copy: () => undefined });
      const first = idle.shift();
      if (first === undefined) throw new Error('initial cue idle job missing');
      first();
      await Promise.resolve();
      const retry = idle.shift();
      if (retry === undefined) throw new Error('observer retry idle job missing');
      retry();
      await Promise.resolve();
      expect([reads > 0, observes, idle.length]).toEqual([true, 1, 0]);
      expect(root.querySelector('.dn-ring, .dn-dot')).toBeNull();
    } finally {
      if (originalObserver === undefined) delete (view as unknown as Record<string, unknown>).IntersectionObserver;
      else Object.defineProperty(view, 'IntersectionObserver', originalObserver);
      if (originalIdle === undefined) delete (view as unknown as Record<string, unknown>).requestIdleCallback;
      else Object.defineProperty(view, 'requestIdleCallback', originalIdle);
      if (originalCancelIdle === undefined) delete (view as unknown as Record<string, unknown>).cancelIdleCallback;
      else Object.defineProperty(view, 'cancelIdleCallback', originalCancelIdle);
      if (originalBox === undefined) delete (SVGGElement.prototype as unknown as Record<string, unknown>).getBBox;
      else Object.defineProperty(SVGGElement.prototype, 'getBBox', originalBox);
    }
  });

  it('uses the observer watching a drawing, retries it once, and unobserves on success', async () => {
    const root = definitionFigure();
    const view = root.ownerDocument.defaultView as Window & typeof globalThis;
    const originalObserver = Object.getOwnPropertyDescriptor(view, 'IntersectionObserver');
    const originalBox = Object.getOwnPropertyDescriptor(SVGGElement.prototype, 'getBBox');
    const observers: Array<{ callback: IntersectionObserverCallback; observed: Set<Element>; unobserved: Set<Element> }> = [];
    let usable = false;
    class Observer {
      private readonly record;
      constructor(callback: IntersectionObserverCallback) {
        this.record = { callback, observed: new Set<Element>(), unobserved: new Set<Element>() };
        observers.push(this.record);
      }
      observe(target: Element): void { this.record.observed.add(target); }
      unobserve(target: Element): void { this.record.unobserved.add(target); this.record.observed.delete(target); }
      disconnect(): void { this.record.observed.clear(); }
      takeRecords(): IntersectionObserverEntry[] { return []; }
    }
    Object.defineProperty(view, 'IntersectionObserver', { configurable: true, value: Observer });
    Object.defineProperty(SVGGElement.prototype, 'getBBox', { configurable: true, value: () => ({ x: 0, y: 0, width: usable ? 80 : 0, height: usable ? 30 : 0 }) });
    try {
      await enhance(root, { copy: () => undefined });
      const svg = root.querySelector('svg') as SVGSVGElement;
      await vi.waitFor(() => expect(observers.find((observer) => observer.observed.has(svg))).toBeDefined());
      const observer = observers.find((entry) => entry.observed.has(svg));
      if (observer === undefined) throw new Error('cue observer did not observe drawing');
      usable = true;
      observer.callback([{ target: svg, isIntersecting: true } as unknown as IntersectionObserverEntry], {} as IntersectionObserver);
      await vi.waitFor(() => expect(svg.querySelectorAll('.dn-ring, .dn-dot')).toHaveLength(8));
      expect(observer.unobserved.has(svg)).toBe(true);
    } finally {
      if (originalObserver === undefined) delete (view as unknown as Record<string, unknown>).IntersectionObserver;
      else Object.defineProperty(view, 'IntersectionObserver', originalObserver);
      if (originalBox === undefined) delete (SVGGElement.prototype as unknown as Record<string, unknown>).getBBox;
      else Object.defineProperty(SVGGElement.prototype, 'getBBox', originalBox);
    }
  });

  it('disconnects a pending cue observer at destroy and stale callbacks read or paint nothing', async () => {
    const root = definitionFigure();
    const view = root.ownerDocument.defaultView as Window & typeof globalThis;
    const originalObserver = Object.getOwnPropertyDescriptor(view, 'IntersectionObserver');
    const originalBox = Object.getOwnPropertyDescriptor(SVGGElement.prototype, 'getBBox');
    const callback: { notify: IntersectionObserverCallback | null } = { notify: null };
    const targets = new Set<Element>();
    let disconnected = 0;
    let reads = 0;
    class Observer {
      constructor(fn: IntersectionObserverCallback) { callback.notify = fn; }
      observe(target: Element): void { targets.add(target); }
      unobserve(target: Element): void { targets.delete(target); }
      disconnect(): void { disconnected += 1; targets.clear(); }
      takeRecords(): IntersectionObserverEntry[] { return []; }
    }
    Object.defineProperty(view, 'IntersectionObserver', { configurable: true, value: Observer });
    Object.defineProperty(SVGGElement.prototype, 'getBBox', { configurable: true, value: () => {
      reads += 1;
      return { x: 0, y: 0, width: 0, height: 0 };
    } });
    try {
      await enhance(root, { copy: () => undefined });
      const svg = root.querySelector('svg') as SVGSVGElement;
      await vi.waitFor(() => expect(targets.has(svg)).toBe(true));
      await destroyEnhancement(root);
      const readsAtDestroy = reads;
      if (callback.notify === null) throw new Error('cue observer callback missing');
      callback.notify([{ target: svg, isIntersecting: true } as unknown as IntersectionObserverEntry], {} as IntersectionObserver);
      await Promise.resolve();
      expect(disconnected).toBe(1);
      expect(reads).toBe(readsAtDestroy);
      expect(root.querySelector('.dn-ring, .dn-dot')).toBeNull();
    } finally {
      if (originalObserver === undefined) delete (view as unknown as Record<string, unknown>).IntersectionObserver;
      else Object.defineProperty(view, 'IntersectionObserver', originalObserver);
      if (originalBox === undefined) delete (SVGGElement.prototype as unknown as Record<string, unknown>).getBBox;
      else Object.defineProperty(SVGGElement.prototype, 'getBBox', originalBox);
    }
  });

  it('unobserves the sole unresolved drawing once removal is seen on resize', async () => {
    const root = definitionFigure();
    const view = root.ownerDocument.defaultView as Window & typeof globalThis;
    const observer = Object.getOwnPropertyDescriptor(view, 'IntersectionObserver');
    const box = Object.getOwnPropertyDescriptor(SVGGElement.prototype, 'getBBox');
    const observed = new Set<Element>();
    const unobserved = new Set<Element>();
    class Observer {
      constructor(_: IntersectionObserverCallback) { /* record targets */ }
      observe(target: Element): void { observed.add(target); }
      unobserve(target: Element): void { unobserved.add(target); observed.delete(target); }
      disconnect(): void { observed.clear(); }
      takeRecords(): IntersectionObserverEntry[] { return []; }
    }
    Object.defineProperty(view, 'IntersectionObserver', { configurable: true, value: Observer });
    Object.defineProperty(SVGGElement.prototype, 'getBBox', { configurable: true, value: () => ({ x: 0, y: 0, width: 0, height: 0 }) });
    try {
      await enhance(root, { copy: () => undefined });
      const svg = root.querySelector('svg') as SVGSVGElement;
      await vi.waitFor(() => expect(observed.has(svg)).toBe(true));
      svg.remove();
      view.dispatchEvent(new Event('resize'));
      await vi.waitFor(() => expect(unobserved.has(svg)).toBe(true));
    } finally {
      if (observer === undefined) delete (view as unknown as Record<string, unknown>).IntersectionObserver;
      else Object.defineProperty(view, 'IntersectionObserver', observer);
      if (box === undefined) delete (SVGGElement.prototype as unknown as Record<string, unknown>).getBBox;
      else Object.defineProperty(SVGGElement.prototype, 'getBBox', box);
    }
  });

  it('stops native shape geometry and cue paint when an actual fill check destroys the reader', async () => {
    const root = definitionFigure();
    const svg = root.querySelector('#definition-root') as SVGSVGElement;
    const node = root.querySelector('#flowchart-B-1') as SVGGElement;
    const shape = node.querySelector('polygon') as SVGGeometryElement;
    const box = Object.getOwnPropertyDescriptor(SVGGElement.prototype, 'getBBox');
    const fill = Object.getOwnPropertyDescriptor(shape, 'isPointInFill');
    const point = Object.getOwnPropertyDescriptor(svg, 'createSVGPoint');
    const stroke = Object.getOwnPropertyDescriptor(shape, 'isPointInStroke');
    let bboxReads = 0;
    let strokeReads = 0;
    let fillReached = false;
    const invalidation: { reads: { bboxReads: number; strokeReads: number } | null; destroyed: Promise<void> | null } = { reads: null, destroyed: null };
    Object.defineProperty(SVGGElement.prototype, 'getBBox', { configurable: true, value: () => {
      bboxReads += 1;
      return { x: 0, y: 0, width: 80, height: 30 };
    } });
    Object.defineProperty(svg, 'createSVGPoint', { configurable: true, value: () => ({ x: 0, y: 0 }) });
    Object.defineProperty(shape, 'isPointInFill', { configurable: true, value: () => {
      fillReached = true;
      invalidation.reads = { bboxReads, strokeReads };
      invalidation.destroyed = destroyEnhancement(root);
      return false;
    } });
    Object.defineProperty(shape, 'isPointInStroke', { configurable: true, value: () => { strokeReads += 1; return false; } });
    try {
      await enhance(root, { copy: () => undefined });
      await vi.waitFor(() => expect(fillReached).toBe(true));
      if (invalidation.destroyed === null || invalidation.reads === null) throw new Error('fill did not request destroy');
      const destroy = invalidation.destroyed;
      const readsAtInvalidation = invalidation.reads;
      await destroy;
      await Promise.resolve();
      expect([bboxReads, strokeReads]).toEqual([readsAtInvalidation.bboxReads, readsAtInvalidation.strokeReads]);
      expect(root.querySelector('.dn-ring, .dn-dot')).toBeNull();
    } finally {
      if (box === undefined) delete (SVGGElement.prototype as unknown as Record<string, unknown>).getBBox;
      else Object.defineProperty(SVGGElement.prototype, 'getBBox', box);
      if (fill === undefined) delete (shape as unknown as Record<string, unknown>).isPointInFill;
      else Object.defineProperty(shape, 'isPointInFill', fill);
      if (point === undefined) delete (svg as unknown as Record<string, unknown>).createSVGPoint;
      else Object.defineProperty(svg, 'createSVGPoint', point);
      if (stroke === undefined) delete (shape as unknown as Record<string, unknown>).isPointInStroke;
      else Object.defineProperty(shape, 'isPointInStroke', stroke);
    }
  });

  it('skips a moved measured candidate while painting a later valid candidate', async () => {
    const root = definitionFigure();
    const first = root.querySelector('#flowchart-A-0') as SVGGElement;
    const second = root.querySelector('#flowchart-B-1') as SVGGElement;
    const original = Object.getOwnPropertyDescriptor(SVGGElement.prototype, 'getBBox');
    let secondMeasured = false;
    Object.defineProperty(SVGGElement.prototype, 'getBBox', { configurable: true, value: function () {
      if (this === second) {
        secondMeasured = true;
        root.append(first);
      }
      return { x: 0, y: 0, width: 80, height: 30 };
    } });
    try {
      await enhance(root, { copy: () => undefined });
      await vi.waitFor(() => expect(secondMeasured).toBe(true));
      expect(first.querySelector('.dn-ring, .dn-dot')).toBeNull();
      expect(second.querySelectorAll('.dn-ring, .dn-dot')).toHaveLength(2);
    } finally {
      if (original === undefined) delete (SVGGElement.prototype as unknown as Record<string, unknown>).getBBox;
      else Object.defineProperty(SVGGElement.prototype, 'getBBox', original);
    }
  });

  it('does not paint when an original drawing moves into a new wrapper inside its captured chrome parent', async () => {
    const root = definitionFigure();
    const drawing = root.querySelector('pre[data-docreader-chrome] > svg') as SVGSVGElement;
    const parent = drawing.parentElement as HTMLElement;
    const node = root.querySelector('#flowchart-A-0') as SVGGElement;
    const original = Object.getOwnPropertyDescriptor(SVGGElement.prototype, 'getBBox');
    let reads = 0;
    let moved = false;
    let readsAtMove: number | null = null;
    Object.defineProperty(SVGGElement.prototype, 'getBBox', { configurable: true, value: function () {
      reads += 1;
      if (this === node) {
        const wrapper = document.createElement('span');
        parent.append(wrapper);
        wrapper.append(drawing);
        moved = true;
        readsAtMove = reads;
      }
      return { x: 0, y: 0, width: 80, height: 30 };
    } });
    try {
      await enhance(root, { copy: () => undefined });
      await vi.waitFor(() => expect(moved).toBe(true));
      if (readsAtMove === null) throw new Error('wrapper move did not capture read count');
      const capturedReads = readsAtMove;
      await Promise.resolve();
      expect(reads).toBe(capturedReads);
      expect(node.querySelector('.dn-ring, .dn-dot')).toBeNull();
    } finally {
      if (original === undefined) delete (SVGGElement.prototype as unknown as Record<string, unknown>).getBBox;
      else Object.defineProperty(SVGGElement.prototype, 'getBBox', original);
    }
  });

  it('does not paint when the original source changes parent within its figure', async () => {
    const root = definitionFigure();
    const drawing = root.querySelector('pre[data-docreader-chrome] > svg') as SVGSVGElement;
    const figure = root.querySelector('figure') as HTMLElement;
    const source = root.querySelector('pre.mermaid:not([data-docreader-chrome])') as HTMLPreElement;
    const node = root.querySelector('#flowchart-A-0') as SVGGElement;
    const original = Object.getOwnPropertyDescriptor(SVGGElement.prototype, 'getBBox');
    let reads = 0;
    let moved = false;
    let readsAtMove: number | null = null;
    Object.defineProperty(SVGGElement.prototype, 'getBBox', { configurable: true, value: function () {
      reads += 1;
      if (this === node) {
        const wrapper = document.createElement('div');
        figure.insertBefore(wrapper, drawing.parentElement);
        wrapper.append(source);
        moved = true;
        readsAtMove = reads;
      }
      return { x: 0, y: 0, width: 80, height: 30 };
    } });
    try {
      await enhance(root, { copy: () => undefined });
      await vi.waitFor(() => expect(moved).toBe(true));
      if (readsAtMove === null) throw new Error('source move did not capture read count');
      const capturedReads = readsAtMove;
      await Promise.resolve();
      expect(reads).toBe(capturedReads);
      expect(node.querySelector('.dn-ring, .dn-dot')).toBeNull();
    } finally {
      if (original === undefined) delete (SVGGElement.prototype as unknown as Record<string, unknown>).getBBox;
      else Object.defineProperty(SVGGElement.prototype, 'getBBox', original);
    }
  });

  it('stops geometry and cue paint when an old drawing moves within the same reader', async () => {
    const root = definitionFigure();
    const drawing = root.querySelector('pre[data-docreader-chrome] > svg') as SVGSVGElement;
    const node = root.querySelector('#flowchart-A-0') as SVGGElement;
    const original = Object.getOwnPropertyDescriptor(SVGGElement.prototype, 'getBBox');
    let reads = 0;
    let moved = false;
    let readsAtMove: number | null = null;
    Object.defineProperty(SVGGElement.prototype, 'getBBox', { configurable: true, value: function () {
      reads += 1;
      if (this === node) { moved = true; root.append(drawing); readsAtMove = reads; }
      return { x: 0, y: 0, width: 80, height: 30 };
    } });
    try {
      await enhance(root, { copy: () => undefined });
      await vi.waitFor(() => expect(moved).toBe(true));
      if (readsAtMove === null) throw new Error('move did not capture read count');
      const capturedReads = readsAtMove;
      await Promise.resolve();
      expect(reads).toBe(capturedReads);
      expect(node.querySelector('.dn-ring, .dn-dot')).toBeNull();
    } finally {
      if (original === undefined) delete (SVGGElement.prototype as unknown as Record<string, unknown>).getBBox;
      else Object.defineProperty(SVGGElement.prototype, 'getBBox', original);
    }
  });

  it('stops geometry and cue paint when a drawing is replaced during measurement', async () => {
    const root = definitionFigure();
    const drawing = root.querySelector('pre[data-docreader-chrome] > svg') as SVGSVGElement;
    const node = root.querySelector('#flowchart-A-0') as SVGGElement;
    const original = Object.getOwnPropertyDescriptor(SVGGElement.prototype, 'getBBox');
    let reads = 0;
    let replaced = false;
    let readsAtReplacement: number | null = null;
    Object.defineProperty(SVGGElement.prototype, 'getBBox', { configurable: true, value: function () {
      reads += 1;
      if (this === node) { replaced = true; drawing.replaceWith(drawing.cloneNode(true)); readsAtReplacement = reads; }
      return { x: 0, y: 0, width: 80, height: 30 };
    } });
    try {
      await enhance(root, { copy: () => undefined });
      await vi.waitFor(() => expect(replaced).toBe(true));
      if (readsAtReplacement === null) throw new Error('replacement did not capture read count');
      const capturedReads = readsAtReplacement;
      await Promise.resolve();
      expect(reads).toBe(capturedReads);
      expect(node.querySelector('.dn-ring, .dn-dot')).toBeNull();
    } finally {
      if (original === undefined) delete (SVGGElement.prototype as unknown as Record<string, unknown>).getBBox;
      else Object.defineProperty(SVGGElement.prototype, 'getBBox', original);
    }
  });

  it('does not paint a drawing whose original Mermaid source is removed during geometry measurement', async () => {
    const root = definitionFigure();
    const source = root.querySelector('pre.mermaid:not([data-docreader-chrome])') as HTMLPreElement;
    const node = root.querySelector('#flowchart-A-0') as SVGGElement;
    const original = SVGGElement.prototype.getBBox;
    Object.defineProperty(SVGGElement.prototype, 'getBBox', { configurable: true, value: function () {
      if (this === node) source.remove();
      return { x: 0, y: 0, width: 80, height: 30 };
    } });
    try {
      await enhance(root, { copy: () => undefined });
      await new Promise((resolve) => setTimeout(resolve, 250));
      expect(node.querySelector('.dn-ring, .dn-dot')).toBeNull();
    } finally {
      Object.defineProperty(SVGGElement.prototype, 'getBBox', { configurable: true, value: original });
    }
  });

  it('does not paint a group moved out of its drawing during geometry measurement', async () => {
    const root = definitionFigure();
    const other = definitionFigure();
    const node = root.querySelector('#flowchart-A-0') as SVGGElement;
    const destination = other.querySelector('svg') as SVGSVGElement;
    const original = SVGGElement.prototype.getBBox;
    Object.defineProperty(SVGGElement.prototype, 'getBBox', { configurable: true, value: function () {
      if (this === node) destination.append(this);
      return { x: 0, y: 0, width: 80, height: 30 };
    } });
    try {
      await enhance(root, { copy: () => undefined });
      await new Promise((resolve) => setTimeout(resolve, 250));
      expect(destination.querySelector('.dn-ring, .dn-dot')).toBeNull();
    } finally {
      Object.defineProperty(SVGGElement.prototype, 'getBBox', { configurable: true, value: original });
    }
  });

  it('removes definition chrome from a moved node during teardown', async () => {
    const root = definitionFigure();
    const original = SVGGElement.prototype.getBBox;
    Object.defineProperty(SVGGElement.prototype, 'getBBox', { configurable: true, value: () => ({ x: 0, y: 0, width: 80, height: 30 }) });
    try {
      await enhance(root, { copy: () => undefined });
      const node = root.querySelector('#flowchart-A-0') as SVGGElement;
      await vi.waitFor(() => expect(node.querySelector('.dn-ring')).not.toBeNull());
      const ring = node.querySelector('.dn-ring') as SVGRectElement;
      const dot = node.querySelector('.dn-dot') as SVGCircleElement;
      const ringDestination = root.querySelector('#flowchart-B-1') as SVGGElement;
      const dotDestination = root.querySelector('.edgeLabel') as SVGGElement;
      ringDestination.append(ring);
      dotDestination.append(dot);

      await destroyEnhancement(root);
      expect(ringDestination.querySelector('.dn-ring')).toBeNull();
      expect(dotDestination.querySelector('.dn-dot')).toBeNull();
      expect(node.classList.contains('dnode')).toBe(false);
    } finally {
      Object.defineProperty(SVGGElement.prototype, 'getBBox', { configurable: true, value: original });
    }
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
    await new Promise<void>((done) => setTimeout(done, 0));
    expect(button.textContent).toBe('Copy Mermaid');
  });

  it('does not update a detached Copy Mermaid button after its host promise settles', async () => {
    const root = figure();
    let resolve: () => void = () => undefined;
    await enhance(root, { copy: () => new Promise<void>((done) => { resolve = done; }) });
    const button = Array.from(root.querySelectorAll('button')).find((b) => b.textContent === 'Copy Mermaid') as HTMLButtonElement;
    button.click();
    button.remove();
    resolve();
    await new Promise<void>((done) => setTimeout(done, 0));
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

  it('cancels allocated edge reset and frame handles on replay and fullscreen', async () => {
    vi.useFakeTimers();
    const root = figure();
    const view = root.ownerDocument.defaultView as Window;
    const request = Object.getOwnPropertyDescriptor(view, 'requestAnimationFrame');
    const cancelFrame = Object.getOwnPropertyDescriptor(view, 'cancelAnimationFrame');
    const timeout = Object.getOwnPropertyDescriptor(view, 'setTimeout');
    const clearTimeout = Object.getOwnPropertyDescriptor(view, 'clearTimeout');
    const frames = new Map<number, FrameRequestCallback>();
    const timers = new Set<number>();
    const cancelledFrames = new Set<number>();
    const cancelledTimers = new Set<number>();
    let nextFrame = 0;
    Object.defineProperty(view, 'requestAnimationFrame', { configurable: true, value: (callback: FrameRequestCallback): number => {
      nextFrame += 1;
      frames.set(nextFrame, callback);
      return nextFrame;
    } });
    Object.defineProperty(view, 'cancelAnimationFrame', { configurable: true, value: (id: number): void => {
      cancelledFrames.add(id);
      frames.delete(id);
    } });
    Object.defineProperty(view, 'setTimeout', { configurable: true, value: (fn: TimerHandler, ms?: number, ...args: unknown[]): number => {
      const id = (timeout?.value as typeof view.setTimeout).call(view, fn, ms, ...args) as unknown as number;
      if (ms === 600) timers.add(id);
      return id;
    } });
    Object.defineProperty(view, 'clearTimeout', { configurable: true, value: (id?: number): void => {
      if (id !== undefined && timers.has(id)) cancelledTimers.add(id);
      return (clearTimeout?.value as typeof view.clearTimeout).call(view, id);
    } });
    try {
      const edge = root.querySelector('path') as SVGPathElement;
      Object.defineProperty(edge, 'getTotalLength', { configurable: true, value: () => 42 });
      await enhance(root, { copy: () => undefined });
      const play = Array.from(root.querySelectorAll('button')).find((b) => b.textContent === 'Play') as HTMLButtonElement;
      const full = Array.from(root.querySelectorAll('button')).find((b) => b.textContent === 'Full screen') as HTMLButtonElement;
      const startupFrames = new Set(frames.keys());
      play.click();
      await vi.advanceTimersByTimeAsync(520);
      const playbackFrames = [...frames.keys()].filter((id) => !startupFrames.has(id));
      expect([timers.size > 0, playbackFrames.length > 0]).toEqual([true, true]);
      const firstTimer = [...timers][0];
      const firstFrame = playbackFrames[0];
      if (firstTimer === undefined || firstFrame === undefined) throw new Error('playback did not allocate reset and frame handles');
      play.click();
      expect([cancelledTimers.has(firstTimer), cancelledFrames.has(firstFrame)]).toEqual([true, true]);

      await vi.advanceTimersByTimeAsync(520);
      const secondTimer = [...timers].find((id) => !cancelledTimers.has(id));
      const secondFrame = [...frames.keys()].find((id) => !startupFrames.has(id) && !cancelledFrames.has(id));
      if (secondTimer === undefined || secondFrame === undefined) throw new Error('replay did not allocate replacement handles');
      full.click();
      expect([cancelledTimers.has(secondTimer), cancelledFrames.has(secondFrame)]).toEqual([true, true]);
    } finally {
      if (request === undefined) delete (view as unknown as Record<string, unknown>).requestAnimationFrame;
      else Object.defineProperty(view, 'requestAnimationFrame', request);
      if (cancelFrame === undefined) delete (view as unknown as Record<string, unknown>).cancelAnimationFrame;
      else Object.defineProperty(view, 'cancelAnimationFrame', cancelFrame);
      if (timeout === undefined) delete (view as unknown as Record<string, unknown>).setTimeout;
      else Object.defineProperty(view, 'setTimeout', timeout);
      if (clearTimeout === undefined) delete (view as unknown as Record<string, unknown>).clearTimeout;
      else Object.defineProperty(view, 'clearTimeout', clearTimeout);
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

  it('restores authored source visibility and preserves a later host visibility edit when fullscreen cancels playback', async () => {
    vi.useFakeTimers();
    try {
      for (const hostEdit of [false, true]) {
        const root = figure();
        const source = root.querySelector('svg') as SVGSVGElement;
        const node = source.querySelectorAll<SVGGElement>('g.node')[1];
        if (node === undefined) throw new Error('missing second playback node');
        if (!hostEdit) node.classList.add('rv-hide');
        await enhance(root, { copy: () => undefined });
        const play = Array.from(root.querySelectorAll('button')).find((button) => button.textContent === 'Play') as HTMLButtonElement;
        const full = Array.from(root.querySelectorAll('button')).find((button) => button.textContent === 'Full screen') as HTMLButtonElement;

        play.click();
        await vi.advanceTimersByTimeAsync(520);
        if (hostEdit) node.classList.add('rv-hide');
        full.click();

        expect(node.classList.contains('rv-hide')).toBe(true);
      }
    } finally {
      vi.useRealTimers();
    }
  });

  it('settles source playback when fullscreen opens and closes, despite late scheduled work', async () => {
    vi.useFakeTimers();
    try {
      const root = figure();
      const source = root.querySelector('svg') as SVGSVGElement;
      const edge = source.querySelector('path') as SVGPathElement;
      Object.defineProperty(edge, 'getTotalLength', { configurable: true, value: () => 42 });
      await enhance(root, { copy: () => undefined });
      const play = Array.from(root.querySelectorAll('button')).find((button) => button.textContent === 'Play') as HTMLButtonElement;
      const full = Array.from(root.querySelectorAll('button')).find((button) => button.textContent === 'Full screen') as HTMLButtonElement;

      play.click();
      expect(source.querySelectorAll('.rv-hide').length).toBeGreaterThan(0);
      full.click();
      const overlay = root.querySelector('.fig-overlay') as HTMLElement;
      overlay.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      await vi.runAllTimersAsync();

      expect([source.querySelectorAll('.rv-hide').length, play.textContent, overlay.classList.contains('open')]).toEqual([0, 'Play', false]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not insert a clone after destroy reenters from its journalled width write', async () => {
    const root = figure();
    const source = root.querySelector('svg') as SVGSVGElement;
    let sourceBefore = '';
    const originalSetAttribute = SVGElement.prototype.setAttribute;
    const originalReplaceChildren = HTMLElement.prototype.replaceChildren;
    let destroyed: Promise<void> | null = null;
    let clone: SVGSVGElement | null = null;
    let insertsAfterDestroy = 0;
    let replaceCallsAfterDestroy = 0;
    Object.defineProperty(SVGElement.prototype, 'setAttribute', { configurable: true, value: function (name: string, value: string): void {
      originalSetAttribute.call(this, name, value);
      const svg = this as SVGSVGElement;
      if (name === 'width' && svg !== source && svg.hasAttribute('data-docreader-chrome') && destroyed === null) {
        clone = svg;
        destroyed = destroyEnhancement(root);
      }
    } });
    Object.defineProperty(HTMLElement.prototype, 'replaceChildren', { configurable: true, value: function (...nodes: Node[]): void {
      if (destroyed !== null && this.classList.contains('fo-stage')) {
        replaceCallsAfterDestroy += 1;
        if (nodes.includes(clone as Node)) insertsAfterDestroy += 1;
      }
      return originalReplaceChildren.apply(this, nodes);
    } });
    try {
      await enhance(root, { copy: () => undefined });
      sourceBefore = source.outerHTML;
      const full = Array.from(root.querySelectorAll('button')).find((button) => button.textContent === 'Full screen') as HTMLButtonElement;
      full.click();
      if (destroyed === null) throw new Error('journalled clone width did not reenter destroy');
      await destroyed;
      expect({ insertsAfterDestroy, replaceCallsAfterDestroy, source: source.outerHTML }).toEqual({ insertsAfterDestroy: 0, replaceCallsAfterDestroy: 0, source: sourceBefore });
    } finally {
      Object.defineProperty(SVGElement.prototype, 'setAttribute', { configurable: true, value: originalSetAttribute });
      Object.defineProperty(HTMLElement.prototype, 'replaceChildren', { configurable: true, value: originalReplaceChildren });
    }
  });

  it('routes Escape from a fullscreen definition node to its card before the viewer', async () => {
    const root = definitionFigure();
    await enhance(root, { copy: () => undefined });
    const full = Array.from(root.querySelectorAll('button')).find((b) => b.textContent === 'Full screen') as HTMLButtonElement;
    full.click();
    const block = root.querySelector('.fig-overlay .dnode') as SVGGElement;
    const context = contextOf(root);
    if (context === undefined) throw new Error('enhancement context missing');
    expect(showCard(context, block)).toBe(true);
    const card = root.querySelector('.xcard') as HTMLElement;
    const overlay = root.querySelector('.fig-overlay') as HTMLElement;
    const first = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    block.dispatchEvent(first);
    expect([first.defaultPrevented, card.classList.contains('open'), overlay.classList.contains('open')]).toEqual([true, false, true]);
    const second = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    block.dispatchEvent(second);
    expect([second.defaultPrevented, overlay.classList.contains('open')]).toEqual([true, false]);
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
