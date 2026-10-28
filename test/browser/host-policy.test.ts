// The host page's own policy binds the frame (docserver L3, Task 10; plan Reference §11.5, FD15, FD19, ruling R7; rows
// L3.HB5, L3.HB6 and L3.HB7). A srcdoc frame inherits its embedder's policy container, so a page that uses
// mountDocFrame and blocks what the frame needs disables the frame; every such case must end in a fallback, never a
// partly working frame. Each row serves the library page of frame-host-page.ts (`openLibHost`) with its own
// Content-Security-Policy header; the page's own two scripts carry a nonce that header names, so the page itself runs
// under every policy here, and the frame's scripts can pass only by their hashes.
//
//   L3.HB5  a nonce-based script-src: every frame script is blocked, no ready comes, and the watchdog gives
//           onFallback('timeout') once, with no frame left mounted.
//   L3.HB6  the page's script-src lists the frame's hashes but one: without enhance's, ready, then error (why
//           'assets'); without the guard's, ready, then error (why 'boot', self-check (d)); and, on a document whose
//           gate lets Mermaid in, without Mermaid's, ready, then error (why 'mermaid', the host mirror of L3.B6b). Each
//           ends in onFallback('error') with no frame left. `why` never reaches the host page, so the row reads it in
//           the frame: the `posts` init script records each op the frame posts and writes it to the frame's console,
//           which outlives the frame ./host removes at the error (frame-host-page.ts).
//   L3.HB7  the page allows the four hashes but sets style-src 'self', then font-src 'self', then img-src 'self' on a
//           document with an image: each gives ready, then error (why 'boot': the violation listener, with the face
//           probe for the fonts, read in the frame as above), then onFallback('error').
//   Control: the page's script-src with all four hashes (and no other directive) admits the same Mermaid document:
//           ready, no error, the frame stays mounted. So the rows above fail for the hash or directive each one drops.
import { afterAll, beforeAll, expect, it } from 'vitest';
import { FRAME_MANIFEST, type FrameAssets, type RenderInput } from '../../src/frame/index.js';
import { scanRefs } from '../../src/render/index.js';
import { openLibHost, type LibHost, type LibMountSpec, type LibRecord } from './frame-host-page.js';
import { freshNonce, input as shared, loadFrame, PLAIN, waitProgress } from './frame-shared.js';
import { browserFor, closeBrowsers, describeBrowsers, type BrowserName } from './harness.js';

let assets: FrameAssets;
let mermaidText = '';

beforeAll(async () => {
  const built = await loadFrame();
  assets = built.assets;
  mermaidText = built.mermaid;
}, 300_000);

afterAll(closeBrowsers);

/** frame-shared's input(markdown) with its scan (so the Mermaid gate can let Mermaid in) and any images. */
function input(markdown: string, images?: Readonly<Record<string, string>>): RenderInput {
  return { ...shared(markdown), scan: { mermaid: scanRefs(markdown).mermaid }, ...(images === undefined ? {} : { images }) };
}

const MERMAID_DOC = '# Diagrams\n\n```mermaid\nflowchart LR\n  A[Start] --> B[Done]\n```\n*Figure 1. A flowchart.*\n';

/** A one-pixel PNG as a data URL. */
const PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
const IMAGE_DOC = '# Picture\n\n![A pixel](pixel.png)\n\nText after the picture.\n';

const hashes = {
  guard: FRAME_MANIFEST.guard.csp,
  bootstrap: FRAME_MANIFEST.bootstrap.csp,
  enhance: FRAME_MANIFEST.enhance.csp,
  mermaid: FRAME_MANIFEST.mermaid.csp,
};

/** A page policy: script-src with the page's nonce and the named hashes, then the other directives. */
const policy = (nonce: string, scripts: readonly (keyof typeof hashes)[], rest = ''): string =>
  `script-src 'nonce-${nonce}' ${scripts.map((k) => hashes[k] as string).join(' ')}${rest === '' ? '' : `; ${rest}`}`;

const kinds = (r: LibRecord): string[] => r.events.map((e) => e.kind);

/** Open the library page under `pagePolicy` (its scripts carry `nonce`), mount `spec`, and wait for `n` adapter events. */
async function mounted(browser: BrowserName, nonce: string, pagePolicy: string, spec: LibMountSpec, n: number, label: string): Promise<{ host: LibHost; rec: LibRecord }> {
  const host = await openLibHost(await browserFor(browser), { posts: true }, { policy: pagePolicy, scriptNonce: nonce });
  try {
    await host.mount(spec);
    const w = await waitProgress(host, n, label);
    expect(w.gaveUp, `${label}: the adapters saw ${String(w.rec.messages.length)} of ${String(n)} events`).toBe(false);
    return { host, rec: await host.lib() };
  } catch (e) {
    await host.close();
    throw e;
  }
}

/** Wait until the frame's posts (carried by its console, so they outlive the frame) number `n`; answers them. */
async function framePosts(host: LibHost, n: number, label: string): Promise<{ t: string; why?: string }[]> {
  const start = Date.now();
  while (host.framePosts.length < n && Date.now() - start < 60_000) await new Promise((r) => setTimeout(r, 50));
  expect(host.framePosts.length, `${label}: the frame's posts`).toBeGreaterThanOrEqual(n);
  return [...host.framePosts];
}

/** The page's text holds none of the frame's reasons: `why` never reaches the host page (Reference §11.3). */
async function noWhyInPage(host: LibHost): Promise<void> {
  const text = await host.page.evaluate(() => document.body.textContent ?? '');
  for (const why of ['boot', 'render', 'mermaid', 'assets', 'protocol']) expect(text).not.toContain(why);
}

describeBrowsers((browser: BrowserName) => {
  const plainSpec = (over: Partial<LibMountSpec> = {}): LibMountSpec => ({ document: input(PLAIN()), assets, watchdogMs: 5000, ...over });
  const mermaidSpec = (over: Partial<LibMountSpec> = {}): LibMountSpec => ({ document: input(MERMAID_DOC), assets: { ...assets, mermaid: mermaidText }, watchdogMs: 60_000, ...over });

  it("L3.HB5: a page whose script-src is nonce-based blocks every frame script: no ready, onFallback('timeout') once, no frame left", async () => {
    const nonce = freshNonce();
    const { host, rec } = await mounted(browser, nonce, `script-src 'nonce-${nonce}'`, plainSpec(), 1, 'HB5');
    try {
      expect(rec.events.map((e) => [e.kind, e.value])).toEqual([['fallback', 'timeout']]);
      expect(rec.iframes).toBe(0);
      expect(rec.loads).toHaveLength(1);
      expect(host.cspConsole.length).toBeGreaterThan(0);
      expect(host.framePosts).toEqual([]);
    } finally {
      await host.close();
    }
  }, 180_000);

  const HB6: readonly (readonly [string, (keyof typeof hashes)[], 'plain' | 'mermaid', string])[] = [
    ["without enhance's hash", ['guard', 'bootstrap', 'mermaid'], 'plain', 'assets'],
    ["without the guard's hash", ['bootstrap', 'enhance', 'mermaid'], 'plain', 'boot'],
    ["without Mermaid's hash, on a document whose gate lets Mermaid in", ['guard', 'bootstrap', 'enhance'], 'mermaid', 'mermaid'],
  ];
  for (const [label, scripts, doc, why] of HB6) {
    it(`L3.HB6: a page whose script-src lists the frame's hashes ${label}: ready, then error (why '${why}' in the frame), then onFallback('error'), no frame left`, async () => {
      const nonce = freshNonce();
      const spec = doc === 'mermaid' ? mermaidSpec() : plainSpec({ watchdogMs: 60_000 });
      const { host, rec } = await mounted(browser, nonce, policy(nonce, scripts), spec, 2, `HB6 ${why}`);
      try {
        expect(rec.events.map((e) => [e.kind, e.value])).toEqual([
          ['ready', null],
          ['fallback', 'error'],
        ]);
        expect(rec.iframes).toBe(0);
        expect(await framePosts(host, 2, `HB6 ${why}`)).toEqual([{ t: 'ready' }, { t: 'error', why }]);
        await noWhyInPage(host);
      } finally {
        await host.close();
      }
    }, 180_000);
  }

  const HB7: readonly (readonly [string, string, 'plain' | 'image'])[] = [
    ["style-src 'self'", "style-src 'self'", 'plain'],
    ["font-src 'self'", "font-src 'self'", 'plain'],
    ["img-src 'self', on a document with an image", "img-src 'self'", 'image'],
  ];
  for (const [label, directive, doc] of HB7) {
    it(`L3.HB7: a page that allows the four hashes but sets ${label}: ready, then error, then onFallback('error'), no frame left`, async () => {
      const nonce = freshNonce();
      const spec: LibMountSpec =
        doc === 'image' ? { document: input(IMAGE_DOC, { 'pixel.png': PIXEL }), assets, watchdogMs: 60_000 } : plainSpec({ watchdogMs: 60_000 });
      const { host, rec } = await mounted(browser, nonce, policy(nonce, ['guard', 'bootstrap', 'enhance', 'mermaid'], directive), spec, 2, `HB7 ${directive}`);
      try {
        expect(rec.events.map((e) => [e.kind, e.value])).toEqual([
          ['ready', null],
          ['fallback', 'error'],
        ]);
        expect(rec.iframes).toBe(0);
        expect(await framePosts(host, 2, `HB7 ${directive}`)).toEqual([{ t: 'ready' }, { t: 'error', why: 'boot' }]);
        await noWhyInPage(host);
      } finally {
        await host.close();
      }
    }, 180_000);
  }

  it('control: a page whose script-src lists all four hashes admits the Mermaid document: ready, no error, the frame stays mounted', async () => {
    const nonce = freshNonce();
    const { host, rec } = await mounted(browser, nonce, policy(nonce, ['guard', 'bootstrap', 'enhance', 'mermaid']), mermaidSpec(), 1, 'HB control');
    try {
      expect(kinds(rec)).toEqual(['ready']);
      // The frame posts error, when it does, right after ready in the same task: its own record, read now, is final.
      expect((await host.frameRecord()).posts).toEqual([{ t: 'ready' }]);
      expect((await host.lib()).iframes).toBe(1);
      expect(kinds(await host.lib())).toEqual(['ready']);
    } finally {
      await host.close();
    }
  }, 180_000);

  it('control: the image document under a page policy with the four hashes and no img-src: ready, no error', async () => {
    const nonce = freshNonce();
    const spec: LibMountSpec = { document: input(IMAGE_DOC, { 'pixel.png': PIXEL }), assets, watchdogMs: 60_000 };
    const { host, rec } = await mounted(browser, nonce, policy(nonce, ['guard', 'bootstrap', 'enhance', 'mermaid']), spec, 1, 'HB7 control');
    try {
      expect(kinds(rec)).toEqual(['ready']);
      expect((await host.frameRecord()).posts).toEqual([{ t: 'ready' }]);
      const drawn = await host.frame().evaluate(() => Array.from(document.querySelectorAll('article img'), (i) => (i as HTMLImageElement).src.slice(0, 22)));
      expect(drawn).toEqual(['data:image/png;base64,']);
    } finally {
      await host.close();
    }
  }, 180_000);
});
