// The In short switch and the comparison base in the sealed frame, in a real browser (docserver parity T5): the seed's
// `features.inShort` reaches the reader, whose switch hides the rest of each item (the stylesheet's `display: none`) and keeps the
// choice through the bridge's `pref:ui`; the seed's `changesBase` makes the reader ask the parent for that commit's changes once, after
// ready, and only when the bridge's `changes` is on. Assets are the exact bytes the build writes (frame-host-page.ts).
import { afterAll, beforeAll, expect, it } from 'vitest';
import { frameCsp, frameDocument, type FrameAssets, type FrameOptions } from '../../src/frame/index.js';
import { render } from '../../src/render/index.js';
import { openFrameHost, type FrameHost } from './frame-host-page.js';
import { data, freshNonce, loadFrame, type BuiltFrame } from './frame-shared.js';
import { browserFor, closeBrowsers, describeBrowsers } from './harness.js';

const DOC = '# Title\n\n**Spec** · 2026-10-12 · Status: Draft\n\n## In short\n\n- **One.** The first point, with more words.\n- The second point. And a tail after it.\n\n## Scope\n\nBody.\n\n## Design\n\nMore.\n';
const HEAD = 'a'.repeat(40);
const BASE = '1234567890abcdef1234567890abcdef12345678';
const VERSION = {
  sha: HEAD,
  draft: false,
  commits: [
    { sha: HEAD, subject: 'feat: newer change', date: '2026-01-02T10:00:00Z', parents: [BASE] },
    { sha: BASE, subject: 'fix: the base commit', date: '2026-01-01T10:00:00Z', parents: ['b'.repeat(40)] },
  ],
  only: null,
};

let built: BuiltFrame;
let assets: FrameAssets;

beforeAll(async () => {
  built = await loadFrame();
  assets = built.assets;
}, 120_000);
afterAll(closeBrowsers);

describeBrowsers((browser) => {
  let host: FrameHost;

  async function mountReady(over: Partial<FrameOptions>): Promise<void> {
    host = await openFrameHost(await browserFor(browser));
    const nonce = freshNonce();
    const csp = frameCsp();
    const r = render(DOC);
    const input = { result: { outcome: r.outcome, html: r.html, meta: { title: r.meta.title, frontList: r.meta.frontList } }, version: VERSION };
    await host.mount(frameDocument(input, { csp, nonce, assets, ...over }), csp);
    expect(data(await host.waitMessages(1, 90_000))[0]).toEqual({ t: 'ready', v: 1, nonce });
  }

  const sent = async (t: string): Promise<unknown[]> => data(await host.record()).filter((m) => (m as { t: string }).t === t);
  const settle = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

  it('features.inShort draws the switch; Headlines hides the rest of each item and the choice goes out as pref:ui', async () => {
    await mountReady({ features: { inShort: true } });
    try {
      const state = (): Promise<{ pressed: string[]; displays: string[]; lead: string[] }> =>
        host.frame().evaluate(() => ({
          pressed: Array.from(document.querySelectorAll('.short-view button[aria-pressed="true"]')).map((b) => b.textContent ?? ''),
          displays: Array.from(document.querySelectorAll('.short .rest')).map((r) => getComputedStyle(r).display),
          lead: Array.from(document.querySelectorAll('.short > ul > li')).map((li) => (li as HTMLElement).innerText.replace(/\s+/g, ' ').trim()),
        }));
      expect(await state()).toEqual({ pressed: ['Full'], displays: ['inline', 'inline'], lead: ['One. The first point, with more words.', 'The second point. And a tail after it.'] });
      await host.frame().evaluate(() => (document.querySelector('.short-view button') as HTMLElement).click());
      expect(await state()).toEqual({ pressed: ['Headlines'], displays: ['none', 'none'], lead: ['One.', 'The second point.'] });
      let stored = (await sent('store.set')).filter((m) => (m as { key: string }).key === 'pref:ui');
      for (let i = 0; i < 40 && stored.length === 0; i += 1) {
        await settle(50);
        stored = (await sent('store.set')).filter((m) => (m as { key: string }).key === 'pref:ui');
      }
      expect(stored.map((m) => JSON.parse((m as { value: string }).value))).toEqual([{ inshort: 'headlines' }]);
      expect(host.errors).toEqual([]);
      expect(host.cspConsole).toEqual([]);
    } finally {
      await host.close().catch(() => undefined);
    }
  });

  it('without the flag the frame draws no switch', async () => {
    await mountReady({});
    try {
      expect(await host.frame().evaluate(() => document.querySelectorAll('.short-view, .short .rest').length)).toBe(0);
    } finally {
      await host.close().catch(() => undefined);
    }
  });

  it('changesBase makes the reader ask the parent for that commit once, after ready', async () => {
    await mountReady({ changesBase: BASE, bridge: { changes: true } });
    try {
      let asked = await sent('changes');
      for (let i = 0; i < 60 && asked.length === 0; i += 1) {
        await settle(50);
        asked = await sent('changes');
      }
      await settle(400);
      expect(await sent('changes')).toEqual([{ t: 'changes', sha: BASE }]);
      expect(host.errors).toEqual([]);
    } finally {
      await host.close().catch(() => undefined);
    }
  });

  it('asks nothing with the bridge\'s changes off, or with no base', async () => {
    await mountReady({ changesBase: BASE, bridge: { changes: false } });
    try {
      await settle(600);
      expect(await sent('changes')).toEqual([]);
    } finally {
      await host.close().catch(() => undefined);
    }
    await mountReady({ bridge: { changes: true } });
    try {
      await settle(600);
      const asks = (await sent('changes')) as { sha: string }[];
      expect(asks.filter((m) => m.sha === BASE)).toEqual([]);
    } finally {
      await host.close().catch(() => undefined);
    }
  });
});
