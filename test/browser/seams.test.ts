// The seams in a real browser (docserver L2, Task 7a). journal.setStyle writes through the CSSOM, so what it writes
// applies under the strict policy, which refuses every inline style: `important` included, and on SVG as on HTML;
// a style attribute set on the same page is refused, so the policy is in force. Undo leaves no style attribute,
// though the browser serializes the CSSOM into it lazily (a removal of an attribute not yet written would not stick).
// And what a jsdom page cannot show of env.ts: the reader's faces load, text has a width, and the viewport, the
// media queries and a frame are the browser's own.
//
// The journal and env modules are bundled here on their own and evaluated in the page after it loaded (the harness's
// page script exposes only the public entry); an evaluation from the test is not the page's own script, so the
// policy does not apply to running it, only to what it writes.
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { closeBrowsers, describeBrowsers, openDoc } from './harness.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

const DOC = ['# Example', '', '## 1. One', '', 'Text of the first section.', '', '## 2. Two', '', 'More.', '', '## 3. Three', '', 'End.', ''].join('\n');

const ENTRY = [
  "import { createJournal } from './src/enhance/journal.ts';",
  "import { createEnv } from './src/enhance/env.ts';",
  '(window as unknown as { __seams: unknown }).__seams = { createJournal, createEnv };',
].join('\n');

let script = '';

beforeAll(async () => {
  const r = await build({
    stdin: { contents: ENTRY, resolveDir: ROOT, sourcefile: 'seams-entry.ts', loader: 'ts' },
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    target: 'es2022',
    logLevel: 'silent',
  });
  script = r.outputFiles[0]?.text ?? '';
});

afterAll(closeBrowsers);

describeBrowsers((browser) => {
  it('setStyle applies under the strict policy, important included, where a style attribute is refused; undo leaves no attribute', async () => {
    const doc = await openDoc(DOC, {}, { browser, csp: 'strict' });
    try {
      await doc.page.evaluate(script);
      const got = await doc.page.evaluate(async () => {
        type J = {
          setStyle(el: Element, prop: string, value: string | null, important?: boolean): void;
        };
        const seams = (window as unknown as { __seams: { createJournal(live: () => boolean, operate: (fn: () => void) => void): { journal: J; undoAll(): unknown[] } } }).__seams;
        const { journal, undoAll } = seams.createJournal(
          () => true,
          (fn) => {
            fn();
          },
        );
        const root = document.querySelector('main[data-harness-root]') as HTMLElement;
        const box = document.createElement('div');
        root.append(box);
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        dot.setAttribute('r', '4');
        svg.append(dot);
        root.append(svg);
        const refused = document.createElement('div');
        root.append(refused);
        const widthBefore = getComputedStyle(refused).width;
        const barBefore = getComputedStyle(root).getPropertyValue('--bar-h').trim(); // the stylesheet's own
        journal.setStyle(box, 'width', '41px');
        journal.setStyle(box, 'opacity', '0.5');
        journal.setStyle(box, 'transform', 'translateX(3px)');
        journal.setStyle(root, '--bar-h', '61px');
        journal.setStyle(dot, 'fill', 'rgb(255, 0, 0)', true);
        journal.setStyle(dot, 'stroke-width', '3px', true);
        refused.setAttribute('style', 'width: 77px');
        await new Promise((r) => setTimeout(r, 50)); // the violation event is queued
        const cs = (e: Element): CSSStyleDeclaration => getComputedStyle(e);
        const applied = {
          width: cs(box).width,
          opacity: cs(box).opacity,
          transform: cs(box).transform,
          barH: cs(root).getPropertyValue('--bar-h').trim(),
          barBefore,
          fill: cs(dot).fill,
          fillPriority: dot.style.getPropertyPriority('fill'),
          strokeWidth: cs(dot).strokeWidth,
          refused: cs(refused).width === widthBefore,
        };
        const faults = undoAll();
        const after = {
          faults: faults.length,
          attrs: [box.hasAttribute('style'), root.hasAttribute('style'), dot.hasAttribute('style')],
          width: cs(box).width === cs(refused).width,
          barH: cs(root).getPropertyValue('--bar-h').trim() === barBefore,
        };
        return { applied, after };
      });
      expect(got.applied).toEqual({
        width: '41px',
        opacity: '0.5',
        transform: 'matrix(1, 0, 0, 1, 3, 0)',
        barH: '61px',
        barBefore: '48px',
        fill: 'rgb(255, 0, 0)',
        fillPriority: 'important',
        strokeWidth: '3px',
        refused: true,
      });
      expect(got.after).toEqual({ faults: 0, attrs: [false, false, false], width: true, barH: true });
      // The one refusal is the style attribute (a browser may name the directive's -attr form).
      const violations = await doc.violations();
      expect(violations.map((v) => (v.split(' ')[0] ?? '').replace(/-attr$/, ''))).toEqual(['style-src']);
    } finally {
      await doc.close();
    }
  });

  it('env: the reader\'s faces load, text has a width, and the viewport, media queries and frames are the browser\'s', async () => {
    const doc = await openDoc(DOC, {}, { browser, csp: 'strict', viewport: { width: 1000, height: 700 } });
    try {
      await doc.page.evaluate(script);
      const got = await doc.page.evaluate(async () => {
        type E = {
          fonts(maxMs: number): Promise<boolean>;
          textWidth(text: string, font: string): number | null;
          viewport(): { w: number; h: number; scrollY: number };
          matches(q: string): boolean;
          frame(fn: () => void): () => void;
          elementFromPoint(x: number, y: number): Element | null;
        };
        const seams = (
          window as unknown as {
            __seams: {
              createJournal(live: () => boolean, operate: (fn: () => void) => void): { journal: unknown };
              createEnv(root: HTMLElement, journal: unknown, live: () => boolean, operate: (fn: () => unknown) => unknown): E;
            };
          }
        ).__seams;
        const root = document.querySelector('main[data-harness-root]') as HTMLElement;
        const { journal } = seams.createJournal(
          () => true,
          (fn) => {
            fn();
          },
        );
        const env = seams.createEnv(root, journal, () => true, (fn) => fn());
        const fonts = await env.fonts(10_000);
        const width = env.textWidth('0123456789'.repeat(4), '12px monospace');
        const framed = await new Promise<boolean>((r) => {
          env.frame(() => {
            r(true);
          });
        });
        const r = root.getBoundingClientRect();
        const hit = env.elementFromPoint(r.left + 40, r.top + 40);
        return {
          fonts,
          width: typeof width === 'number' && width > 100,
          viewport: env.viewport(),
          wide: env.matches('(min-width: 700px)'),
          narrow: env.matches('(max-width: 699px)'),
          framed,
          hit: hit !== null && root.contains(hit),
        };
      });
      expect(got).toEqual({ fonts: true, width: true, viewport: { w: 1000, h: 700, scrollY: 0 }, wide: true, narrow: false, framed: true, hit: true });
    } finally {
      await doc.close();
    }
  });
});
