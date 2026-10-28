// Mermaid on request in a real browser (docserver L3, Task 16; FD13): the layout's own page (not the frame; the frame's
// and the host's halves are L3.D5, Tasks 8 and 10), the package's Mermaid file served by the harness, under the
// `reader` policy. What jsdom cannot show: that nothing asks for the Mermaid file until a tap, that an untapped figure's
// source is readable text on its plate with a visible Render button, that a tap (or Enter on the focused button) draws
// that figure alone with the real Mermaid and no policy violation, and that the drawn figure then shows its drawing,
// not its source or its button. A figure longer than maxTextSize shows its note, never its raw source (the stylesheet's
// on-request rule for a failed figure, review E1). The Mermaid file's requests are counted at the harness's route
// (`served`), the same way on both engines (review S2).
//
// The second block is the frame (fix round, review S1; plan Reference §11.5, FD15, ruling R7): on request, Mermaid's
// inline style is first asked for on a tap, after ready, so the bootstrap asks for inline style itself before ready
// (src/frame-runtime/styles.ts). A host page whose own policy allows only the hash of the frame stylesheet then gives
// ready, then error boot, as 'auto' mode does once Mermaid draws, rather than a mounted frame whose drawings its
// policy would break. Controls: the same page policy admits a document without Mermaid (ready, no error), and with no
// page policy the on-request document readies with no error and no violation.
//
// The same page policy and an aligned table (L3 Task 12, review S3): a cell's alignment is a `style` attribute, which
// no stylesheet hash admits, so the README's Hosting section says the stylesheet hash serves documents with neither
// Mermaid nor an aligned table. The row holds the frame to its promise on both engines, never partly working: either
// ready then error boot, or ready with every cell aligned as written; on Chromium, measured 2026-10-28, it is the
// first. Its control, with no page policy, readies with every cell aligned.
//
// The jsdom rows are test/enhance-mermaid-on-request.test.ts.
import { createHash } from 'node:crypto';
import type { Page } from 'playwright-core';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { buildFrame } from '../../scripts/build-frame.mjs';
import { frameCsp, frameDocument, type FrameAssets, type RenderInput } from '../../src/frame/index.js';
import { render } from '../../src/render/index.js';
import { openFrameHost, type FrameHost, type HostRecord } from './frame-host-page.js';
import { browserFor, closeBrowsers, describeBrowsers, MERMAID_PATH, mermaidFile, openDoc, type OpenedDoc } from './harness.js';

let assets: FrameAssets;
let mermaidText = '';

beforeAll(async () => {
  await mermaidFile();
  const built = await buildFrame();
  assets = { guard: built.files.guard.text, bootstrap: built.files.bootstrap.text, enhance: built.files.enhance.text, css: built.files.css.text };
  mermaidText = built.files.mermaid.text;
}, 300_000);

afterAll(closeBrowsers);

const TWO = [
  '# Two figures',
  '',
  '```mermaid',
  'flowchart LR',
  '  A[Start] --> B[Stop]',
  '```',
  '',
  '*Figure 1. Start to stop.*',
  '',
  '```mermaid',
  'sequenceDiagram',
  '  Alice->>Bob: Hello',
  '```',
  '',
  '*Figure 2. One exchange.*',
  '',
].join('\n');

/** The layout row's maxTextSize: TWO's figures fit under it, LONG's does not. */
const MAX_TEXT = 300;

/** TWO and a third figure longer than MAX_TEXT, which fails at once with the long note and gets no Render button. */
const THREE = [
  TWO,
  '```mermaid',
  'flowchart TD',
  ...Array.from({ length: 24 }, (_, i) => `  Step${String(i)}[Step number ${String(i)}] --> Step${String(i + 1)}`),
  '```',
  '',
  '*Figure 3. Too long to draw.*',
  '',
].join('\n');

/** A computed transparent colour. */
const TRANSPARENT = 'rgba(0, 0, 0, 0)';

interface Seen {
  readonly state: string | null;
  readonly gate: boolean;
  /** How often the page asked for the Mermaid file, counted at the harness's route. */
  readonly loads: number;
  readonly figures: readonly {
    readonly cls: string;
    readonly drawState: string | null;
    readonly source: { readonly display: string; readonly color: string };
    readonly button: { readonly display: string; readonly width: number; readonly busy: string | null } | null;
    readonly svg: { readonly role: string | null; readonly width: number } | null;
    /** The figure's failure note (`.fig-error`), when it has one: its computed display and its first line. */
    readonly note: { readonly display: string; readonly text: string } | null;
  }[];
}

async function seen(doc: OpenedDoc): Promise<Seen> {
  const page: Page = doc.page;
  const inPage = await page.evaluate(() => {
    const root = document.querySelector('main[data-harness-root]') as HTMLElement;
    const cs = (e: Element): CSSStyleDeclaration => getComputedStyle(e);
    return {
      state: root.getAttribute('data-docreader-diagrams'),
      gate: root.hasAttribute('data-docreader-mermaid'),
      figures: Array.from(root.querySelectorAll('figure.mermaid-figure')).map((f) => {
        const source = Array.from(f.children).find((k) => k.localName === 'pre' && !k.hasAttribute('data-docreader-chrome')) as HTMLElement;
        const button = Array.from(f.querySelectorAll('button')).find((b) => b.textContent === 'Render') ?? null;
        const svg = f.querySelector('pre[data-docreader-chrome] > svg');
        const note = f.querySelector(':scope > .fig-error');
        return {
          cls: f.className,
          drawState: f.getAttribute('data-docreader-draw'),
          source: { display: cs(source).display, color: cs(source).color },
          button: button === null ? null : { display: cs(button.parentElement as Element).display, width: button.getBoundingClientRect().width, busy: button.getAttribute('aria-busy') },
          svg: svg === null ? null : { role: svg.getAttribute('role'), width: svg.getBoundingClientRect().width },
          note: note === null ? null : { display: cs(note).display, text: note.querySelector('p')?.textContent ?? '' },
        };
      }),
    };
  });
  return { ...inPage, loads: doc.served.filter((p) => p === MERMAID_PATH).length };
}

describeBrowsers((browser) => {
  it("on request: no Mermaid request at enhance, readable sources with Render buttons, the over-long figure's note and not its source; a tap, then Enter, each draws its figure alone, with no violation", async () => {
    const doc = await openDoc(THREE, { mermaid: { draw: 'on-request', maxTextSize: MAX_TEXT } }, { browser, csp: 'reader' });
    try {
      await doc.page.waitForTimeout(300);
      const before = await seen(doc);
      expect([before.state, before.gate, before.loads]).toEqual(['on-request', false, 0]);
      // The page itself was served (the count's own control): the route sees every request.
      expect(doc.served).toContain('/harness.js');
      expect(before.figures).toHaveLength(3);
      // The over-long figure: failed at once, no button, its note shown and its raw source hidden (the source is in the
      // note's own disclosure).
      const long = before.figures[2];
      expect(long?.cls).toBe('mermaid-figure draw-failed');
      expect(long?.drawState).toBe('failed');
      expect(long?.button).toBe(null);
      expect(long?.svg).toBe(null);
      expect(long?.source.display).toBe('none');
      expect(long?.note?.display).toBe('block');
      expect(long?.note?.text).toMatch(/\S/);
      for (const f of before.figures.slice(0, 2)) {
        expect(f.cls).toBe('mermaid-figure');
        expect(f.drawState).toBe('on-request');
        expect(f.source.display).toBe('block');
        expect(f.source.color).not.toBe(TRANSPARENT);
        expect(f.button?.display).toBe('flex');
        expect(f.button?.width ?? 0).toBeGreaterThan(20);
        expect(f.svg).toBe(null);
        expect(f.note).toBe(null);
      }

      await doc.page.getByRole('button', { name: 'Render figure 2' }).click();
      await doc.page.waitForFunction(() => document.querySelectorAll('main[data-harness-root] figure.mermaid-figure')[1]?.getAttribute('data-docreader-draw') === 'drawn', undefined, { timeout: 45_000 });
      const one = await seen(doc);
      expect([one.state, one.gate, one.loads]).toEqual(['on-request', false, 1]);
      const [first, second] = one.figures;
      expect(second?.cls).toBe('mermaid-figure drawn');
      expect(second?.source.display).toBe('none');
      expect(second?.button?.display).toBe('none');
      expect(second?.svg?.role).toBe('img');
      expect(second?.svg?.width ?? 0).toBeGreaterThan(50);
      // The other figure is untouched: its source still text, its button still there.
      expect(first?.cls).toBe('mermaid-figure');
      expect(first?.source.display).toBe('block');
      expect(first?.button?.display).toBe('flex');
      expect(first?.svg).toBe(null);

      // Keyboard: the button is a native button, reached by focus and pressed with Enter.
      await doc.page.getByRole('button', { name: 'Render figure 1' }).focus();
      await doc.page.keyboard.press('Enter');
      await doc.page.waitForFunction(() => document.querySelector('main[data-harness-root] figure.mermaid-figure')?.getAttribute('data-docreader-draw') === 'drawn', undefined, { timeout: 45_000 });
      const two = await seen(doc);
      expect(two.loads).toBe(1);
      expect(two.figures.map((f) => [f.cls, f.source.display, f.button?.display, f.svg?.role])).toEqual([
        ['mermaid-figure drawn', 'none', 'none', 'img'],
        ['mermaid-figure drawn', 'none', 'none', 'img'],
        ['mermaid-figure draw-failed', 'none', undefined, undefined],
      ]);
      expect(await doc.violations()).toEqual([]);
      expect({ aborted: doc.aborted, missing: doc.missing }).toEqual({ aborted: [], missing: [] });
    } finally {
      await doc.close();
    }
  });
});

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

function freshNonce(): string {
  const b = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

function input(markdown: string): RenderInput {
  const r = render(markdown);
  if (r.outcome !== 'rendered') throw new Error(`did not render (${r.outcome})`);
  return { result: { outcome: r.outcome, html: r.html, meta: { title: r.meta.title, frontList: r.meta.frontList } } };
}

const data = (rec: HostRecord): unknown[] => rec.messages.filter((m) => m.port === 'main').map((m) => m.data);

/** A host page policy that allows inline style only by the hash of the frame stylesheet's exact text (§11.5). */
const hashOnlyStyle = (): string => `style-src 'sha256-${createHash('sha256').update(assets.css, 'utf8').digest('base64')}'`;

/** The frame's diagrams state, its Render buttons and its drawings, read through Playwright's frame handle. */
const frameFigures = (host: FrameHost): Promise<{ state: string | null; buttons: number; svgs: number }> =>
  host.frame().evaluate(() => {
    const root = document.body.querySelector(':scope > article');
    return {
      state: root?.getAttribute('data-docreader-diagrams') ?? null,
      buttons: document.querySelectorAll('figure.mermaid-figure .fig-render button').length,
      svgs: document.querySelectorAll('figure.mermaid-figure svg').length,
    };
  });

describeBrowsers((browser) => {
  /** Mount `markdown` on request (or with Mermaid off) under frameCsp(), on a host page served with `policy`. */
  const mounted = async (markdown: string, mermaid: boolean, policy: string | undefined): Promise<{ host: FrameHost; nonce: string }> => {
    const host = await openFrameHost(await browserFor(browser), {}, policy === undefined ? {} : { policy });
    const nonce = freshNonce();
    const srcdoc = mermaid
      ? frameDocument(input(markdown), { csp: frameCsp(), nonce, assets: { ...assets, mermaid: mermaidText }, mermaid: { draw: 'on-request' } })
      : frameDocument(input(markdown), { csp: frameCsp(), nonce, assets });
    await host.mount(srcdoc, frameCsp());
    return { host, nonce };
  };

  it("frame, on request, under a host page policy that allows inline style only by the frame stylesheet's hash: ready, then error boot, nothing drawn", async () => {
    const { host, nonce } = await mounted(TWO, true, hashOnlyStyle());
    try {
      // Ready waits for Mermaid's script to evaluate; the error, when it comes, comes right after it.
      await host.waitMessages(1, 60_000);
      const rec = await host.waitMessages(2, 5_000);
      expect(data(rec)).toEqual([{ t: 'ready', v: 1, nonce }, { t: 'error', why: 'boot' }]);
      await sleep(400);
      const after = await host.record();
      expect(after.messages).toHaveLength(2);
      expect(after.loads).toHaveLength(1);
      if (after.closeSupported) expect(after.closes).toEqual(['main']);
      expect((await frameFigures(host)).svgs).toBe(0);
    } finally {
      await host.close();
    }
  }, 120_000);

  it('frame control: the same host page policy admits a document without Mermaid (ready, no error)', async () => {
    const { host, nonce } = await mounted(TWO.replace(/```mermaid/g, '```text'), false, hashOnlyStyle());
    try {
      expect(data(await host.waitMessages(1, 30_000))).toEqual([{ t: 'ready', v: 1, nonce }]);
      await sleep(400);
      expect(data(await host.record())).toEqual([{ t: 'ready', v: 1, nonce }]);
    } finally {
      await host.close();
    }
  }, 120_000);

  it('frame, an aligned table, under the same host page policy: never partly working (ready then error boot, or every cell aligned); on Chromium ready then error boot. Control: no page policy aligns every cell', async () => {
    const TABLE = ['# Aligned', '', '| Left | Right | Centre |', '|:--|--:|:-:|', '| a | b | c |', ''].join('\n');
    const WANT = ['left', 'right', 'center', 'left', 'right', 'center'];
    const cells = (host: FrameHost): Promise<string[]> =>
      host.frame().evaluate(() => Array.from(document.querySelectorAll('article th, article td'), (c) => getComputedStyle(c).textAlign));
    for (const policy of [hashOnlyStyle(), undefined]) {
      const { host, nonce } = await mounted(TABLE, false, policy);
      try {
        await host.waitMessages(1, 30_000);
        await sleep(400);
        const messages = data(await host.record());
        const aligned = await cells(host);
        if (policy === undefined) {
          expect(messages).toEqual([{ t: 'ready', v: 1, nonce }]);
          expect(aligned).toEqual(WANT);
          continue;
        }
        const failed = [{ t: 'ready', v: 1, nonce }, { t: 'error', why: 'boot' }];
        if (browser === 'chromium') expect(messages).toEqual(failed);
        else expect(JSON.stringify(messages) === JSON.stringify(failed) || JSON.stringify(aligned) === JSON.stringify(WANT), JSON.stringify({ messages, aligned })).toBe(true);
      } finally {
        await host.close();
      }
    }
  }, 120_000);

  it('frame control: on request with no host page policy, ready comes with no error and no violation, and every figure keeps its Render button', async () => {
    const { host, nonce } = await mounted(TWO, true, undefined);
    try {
      expect(data(await host.waitMessages(1, 60_000))).toEqual([{ t: 'ready', v: 1, nonce }]);
      await sleep(400);
      expect(data(await host.record())).toEqual([{ t: 'ready', v: 1, nonce }]);
      expect(host.cspConsole).toEqual([]);
      expect(host.errors).toEqual([]);
      expect(await frameFigures(host)).toEqual({ state: 'on-request', buttons: 2, svgs: 0 });
    } finally {
      await host.close();
    }
  }, 120_000);
});
