// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
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
