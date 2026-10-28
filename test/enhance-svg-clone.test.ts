// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { DRAWING_ID_PREFIX } from '../src/enhance/diagrams.js';
import { createJournal } from '../src/enhance/journal.js';

const ids = new Map([
  ['root', 'docreader.1.figure'],
  ['title', 'docreader.1.figure.1'],
  ['desc', 'docreader.1.figure.2'],
  ['paint', 'docreader.1.figure.3'],
  ['clip', 'docreader.1.figure.4'],
  ['shape', 'docreader.1.figure.5'],
]);

describe('journal SVG clone', () => {
  it('rebinds clone-local SVG reference grammars and leaves the source byte-for-byte intact', () => {
    const source = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    source.setAttribute('id', 'root');
    source.setAttribute('aria-labelledby', 'title desc other');
    source.innerHTML = '<title id="title">Title</title><desc id="desc">Description</desc><defs><linearGradient id="paint"/><clipPath id="clip"/><style>#shape { fill: url(#paint); } .external { fill: url(https://example.test/x); content: "#shape"; } /* #shape */</style></defs><rect id="shape" fill="url(#paint)" clip-path="url(#clip)" style="fill: url(#paint) !important; color: red"/><use href="#shape" xlink:href="#shape"/><text aria-describedby="desc title other"/>';
    const before = source.outerHTML;
    const { journal } = createJournal(() => true, (fn) => fn());

    const clone = journal.cloneSvg(source, ids);
    const shape = clone.querySelector('rect') as SVGRectElement;

    expect(clone.id).toBe('docreader.1.figure');
    expect(clone.getAttribute('aria-labelledby')).toBe('docreader.1.figure.1 docreader.1.figure.2 other');
    expect(clone.querySelector('use')?.getAttribute('href')).toBe('#docreader.1.figure.5');
    expect(clone.querySelector('use')?.getAttribute('xlink:href')).toBe('#docreader.1.figure.5');
    expect(clone.querySelector('text')?.getAttribute('aria-describedby')).toBe('docreader.1.figure.2 docreader.1.figure.1 other');
    expect(shape.getAttribute('fill')).toBe('url(#docreader.1.figure.3)');
    expect(shape.getAttribute('clip-path')).toBe('url(#docreader.1.figure.4)');
    expect(shape.style.getPropertyValue('fill')).toMatch(/^url\(["']?#docreader\.1\.figure\.3["']?\)$/);
    expect(shape.style.getPropertyPriority('fill')).toBe('important');
    expect(shape.style.getPropertyValue('color')).toBe('red');
    expect(clone.querySelector('style')?.textContent).toContain('#docreader\\.1\\.figure\\.5 { fill: url(#docreader.1.figure.3); }');
    expect(clone.querySelector('style')?.textContent).toContain('url(https://example.test/x)');
    expect(clone.querySelector('style')?.textContent).toContain('"#shape"');
    expect(clone.querySelector('style')?.textContent).toContain('/* #shape */');
    expect(Array.from(clone.querySelectorAll('*')).every((el) => el.hasAttribute('data-docreader-chrome'))).toBe(true);
    expect(source.outerHTML).toBe(before);
  });

  it('uses an ID-map snapshot despite a clone-time caller mutation', () => {
    const source = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    source.setAttribute('id', 'root');
    source.innerHTML = '<rect id="shape" fill="url(#shape)"/>';
    const map = new Map([['root', 'docreader.1.figure'], ['shape', 'docreader.1.figure.1']]);
    const cloneNode = source.cloneNode.bind(source);
    source.cloneNode = ((deep?: boolean): Node => {
      map.set('shape', 'docreader.1.figure.9');
      return cloneNode(deep);
    }) as typeof source.cloneNode;
    const { journal } = createJournal(() => true, (fn) => fn());

    const clone = journal.cloneSvg(source, map);

    expect(clone.querySelector('rect')?.id).toBe('docreader.1.figure.1');
    expect(clone.querySelector('rect')?.getAttribute('fill')).toBe('url(#docreader.1.figure.1)');
  });

  it('rewrites clone-local compound, pseudo, escaped ID selectors and uppercase local URLs only', () => {
    const source = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    source.setAttribute('id', 'root');
    source.innerHTML = '<defs><linearGradient id="paint"/><style>#shape.hot,#shape:hover,#shape\\.part{fill:URL(#paint)}/* URL(#paint) */.outside{content:"URL(#paint)"}</style></defs><rect id="shape" class="hot" fill="URL(#paint)" style="stroke: URL(#paint)"/><rect id="shape.part"/>';
    const map = new Map([['root', 'docreader.1.figure'], ['paint', 'docreader.1.figure.1'], ['shape', 'docreader.1.figure.2'], ['shape.part', 'docreader.1.figure.3']]);
    const { journal } = createJournal(() => true, (fn) => fn());

    const clone = journal.cloneSvg(source, map);
    const style = clone.querySelector('style')?.textContent ?? '';
    const rect = clone.querySelector('rect') as SVGRectElement;

    expect(style).toContain('#docreader\\.1\\.figure\\.2.hot');
    expect(style).toContain('#docreader\\.1\\.figure\\.2:hover');
    expect(style).toContain('#docreader\\.1\\.figure\\.3');
    expect(style).toContain('fill:url(#docreader.1.figure.1)');
    expect(style).toContain('/* URL(#paint) */');
    expect(style).toContain('"URL(#paint)"');
    expect(rect.getAttribute('fill')).toBe('url(#docreader.1.figure.1)');
    expect(rect.style.getPropertyValue('stroke')).toMatch(/^url\(["']?#docreader\.1\.figure\.1["']?\)$/);
  });

  it('rewrites complete escaped root-issued selector IDs through numeric segments', () => {
    const source = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    source.setAttribute('id', 'root');
    source.innerHTML = '<style>#docreader\\.1\\.figure.hot,#docreader\\.1\\.figure:hover{fill:URL(#paint)}</style><linearGradient id="paint"/><rect id="docreader.1.figure" class="hot" fill="URL(#paint)"/>';
    const map = new Map([['root', 'docreader.2.figure'], ['paint', 'docreader.2.figure.1'], ['docreader.1.figure', 'docreader.2.figure.2']]);
    const { journal } = createJournal(() => true, (fn) => fn());

    const clone = journal.cloneSvg(source, map);
    const style = clone.querySelector('style')?.textContent ?? '';

    expect(style).toContain('#docreader\\.2\\.figure\\.2.hot');
    expect(style).toContain('#docreader\\.2\\.figure\\.2:hover');
    expect(style).toContain('url(#docreader.2.figure.1)');
  });

  it("rebinds a drawing named with the reader's prefix: its own stylesheet, url(#…) and href references move to the copy", () => {
    // Since ledger C95(1) every drawing is named DRAWING_ID_PREFIX, then `mermaid-<n>`: the name, and every id
    // Mermaid derives from it, holds U+00B7, a non-ASCII CSS ident code point (task-8.md, review T8b-C1).
    const name = `${DRAWING_ID_PREFIX}mermaid-0`;
    const source = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    source.setAttribute('id', name);
    source.innerHTML = `<style>#${name}{font-family:serif;}#${name} .node rect{fill:#f3f0e9;}#${name} .marker{fill:url(#${name}_grad);}</style><defs><marker id="${name}_flowchart-v2-pointEnd"><path/></marker><linearGradient id="${name}_grad"/></defs><g class="node" id="${name}-flowchart-A-0"><rect/></g><path class="marker" marker-end="url(#${name}_flowchart-v2-pointEnd)" style="stroke: url(#${name}_grad)"/><use href="#${name}-flowchart-A-0"/>`;
    const map = new Map([
      [name, 'docreader.1.figure'],
      [`${name}_flowchart-v2-pointEnd`, 'docreader.1.figure.1'],
      [`${name}_grad`, 'docreader.1.figure.2'],
      [`${name}-flowchart-A-0`, 'docreader.1.figure.3'],
    ]);
    const before = source.outerHTML;
    const { journal } = createJournal(() => true, (fn) => fn());

    const clone = journal.cloneSvg(source, map);
    const style = clone.querySelector('style')?.textContent ?? '';
    const path = clone.querySelector('path.marker') as SVGPathElement;

    expect(clone.id).toBe('docreader.1.figure');
    expect(style).toBe('#docreader\\.1\\.figure{font-family:serif;}#docreader\\.1\\.figure .node rect{fill:#f3f0e9;}#docreader\\.1\\.figure .marker{fill:url(#docreader.1.figure.2);}');
    expect(path.getAttribute('marker-end')).toBe('url(#docreader.1.figure.1)');
    expect(path.style.getPropertyValue('stroke')).toMatch(/^url\(["']?#docreader\.1\.figure\.2["']?\)$/);
    expect(clone.querySelector('use')?.getAttribute('href')).toBe('#docreader.1.figure.3');
    // Nothing in the copy still names the drawing: every reference resolves inside the copy.
    expect(clone.outerHTML).not.toContain('·');
    const inside = new Set([clone.id, ...Array.from(clone.querySelectorAll('[id]'), (el) => el.id)]);
    const refs = [...clone.outerHTML.matchAll(/url\(\s*(?:["']|&quot;)?#([^"')\s&]+)|href="#([^"]+)"/g)].map((m) => m[1] ?? m[2] ?? '');
    expect(refs.length).toBeGreaterThanOrEqual(4);
    expect(refs.filter((ref) => !inside.has(ref))).toEqual([]);
    expect(source.outerHTML).toBe(before);
  });

  it('refuses an initially nonlive clone without calling cloneNode', () => {
    const source = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    source.setAttribute('id', 'root');
    source.innerHTML = '<rect id="shape"/>';
    const cloneNode = vi.fn(source.cloneNode.bind(source));
    source.cloneNode = cloneNode as typeof source.cloneNode;
    const { journal } = createJournal(() => false, (fn) => fn());

    expect(() => journal.cloneSvg(source, new Map([['root', 'docreader.1.figure'], ['shape', 'docreader.1.figure.1']]))).toThrow(/after a destroy/);
    expect(cloneNode).not.toHaveBeenCalled();
  });

  it('refuses a liveness loss during source ID enumeration before cloning', () => {
    const source = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    source.setAttribute('id', 'root');
    source.innerHTML = '<rect id="shape"/>';
    let live = true;
    const query = source.querySelectorAll.bind(source);
    const clone = source.cloneNode.bind(source);
    const cloneNode = vi.fn(clone);
    source.querySelectorAll = ((selector: string): NodeListOf<Element> => { live = false; return query(selector); }) as typeof source.querySelectorAll;
    source.cloneNode = cloneNode as typeof source.cloneNode;
    const { journal } = createJournal(() => live, (fn) => fn());

    expect(() => journal.cloneSvg(source, new Map([['root', 'docreader.1.figure'], ['shape', 'docreader.1.figure.1']]))).toThrow(/after source IDs/);
    expect(cloneNode).not.toHaveBeenCalled();
  });

  it('refuses duplicate valid clone destinations', () => {
    const source = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    source.setAttribute('id', 'root');
    source.innerHTML = '<rect id="shape"/>';
    const { journal } = createJournal(() => true, (fn) => fn());

    expect(() => journal.cloneSvg(source, new Map([['root', 'docreader.1.figure'], ['shape', 'docreader.1.figure']]))).toThrow(/unique root-issued/);
  });

  it('refuses incomplete or non-root-issued ID snapshots', () => {
    const source = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    source.setAttribute('id', 'root');
    source.innerHTML = '<rect id="shape"/>';
    const { journal } = createJournal(() => true, (fn) => fn());

    expect(() => journal.cloneSvg(source, new Map([['root', 'docreader.1.figure']]))).toThrow(/every unique source ID/);
    expect(() => journal.cloneSvg(source, new Map([['root', 'docreader.1.figure'], ['shape', 'untrusted']]))).toThrow(/root-issued/);
    source.removeAttribute('id');
    expect(() => journal.cloneSvg(source, new Map([['shape', 'docreader.1.figure.1']]))).toThrow(/root ID/);
  });
});
