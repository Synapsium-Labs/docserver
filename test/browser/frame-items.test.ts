// The item links in the sealed frame, in a real browser (docserver parity T4): the seed's `items` reach the reader through the
// bootstrap, a listed value is drawn as the reader's `item-link` and one that is not stays text, a click goes out as `navigate`,
// and an href the reader's own check refuses (the seed text edited after frameDocument, so only the bootstrap's outer check
// stands before it) is never drawn. Assets are the exact bytes the build writes (frame-host-page.ts).
import { afterAll, beforeAll, expect, it } from 'vitest';
import { frameCsp, frameDocument, type FrameAssets } from '../../src/frame/index.js';
import { render } from '../../src/render/index.js';
import { openFrameHost, type FrameHost } from './frame-host-page.js';
import { data, freshNonce, loadFrame, type BuiltFrame } from './frame-shared.js';
import { browserFor, closeBrowsers, describeBrowsers } from './harness.js';

const DOC = '# Title\n\n**Spec** · 2026-10-12 · Tracker: AB-12 and CD-7\n\n## Scope\n\nBody.\n';
const FEATURES = { vocabulary: { itemFields: ['Tracker'] } };
const HREF = 'https://tracker.example/AB-12';

let built: BuiltFrame;
let assets: FrameAssets;

beforeAll(async () => {
  built = await loadFrame();
  assets = built.assets;
}, 120_000);
afterAll(closeBrowsers);

describeBrowsers((browser) => {
  let host: FrameHost;

  /** Mount DOC with `items`, `edit` applied to the srcdoc text before it is mounted; answers the nonce. */
  async function mountReady(items: { value: string; href: string }[] | undefined, edit: (s: string) => string = (s) => s): Promise<string> {
    host = await openFrameHost(await browserFor(browser));
    const nonce = freshNonce();
    const csp = frameCsp();
    const r = render(DOC);
    const input = { result: { outcome: r.outcome, html: r.html, meta: { title: r.meta.title, frontList: r.meta.frontList } } };
    const doc = frameDocument(input, { csp, nonce, assets, features: FEATURES, ...(items === undefined ? {} : { items }) });
    await host.mount(edit(doc), csp);
    expect(data(await host.waitMessages(1, 90_000))[0]).toEqual({ t: 'ready', v: 1, nonce });
    return nonce;
  }

  const links = (): Promise<string[]> =>
    host.frame().evaluate(() => Array.from(document.querySelectorAll('a.item-link')).map((a) => `${a.textContent ?? ''}|${a.getAttribute('href') ?? ''}`));
  const byline = (): Promise<string> => host.frame().evaluate(() => document.querySelector('.byline')?.textContent ?? '');

  it('a seeded value is drawn as the reader\'s item link and an unseeded one stays text; the click goes out as navigate', async () => {
    await mountReady([{ value: 'AB-12', href: HREF }]);
    try {
      expect(await links()).toEqual([`AB-12 ↗|${HREF}`]);
      expect(await byline()).toContain('CD-7');
      await host.frame().evaluate(() => (document.querySelector('a.item-link') as HTMLElement).click());
      let sent = data(await host.record()).filter((m) => (m as { t: string }).t === 'navigate');
      for (let i = 0; i < 40 && sent.length === 0; i += 1) {
        await new Promise((r) => setTimeout(r, 50));
        sent = data(await host.record()).filter((m) => (m as { t: string }).t === 'navigate');
      }
      expect(sent).toEqual([{ t: 'navigate', href: HREF }]);
      expect(host.errors).toEqual([]);
      expect(host.cspConsole).toEqual([]);
    } finally {
      await host.close().catch(() => undefined);
    }
  });

  it('with no items the reader draws no item link, as before', async () => {
    await mountReady(undefined);
    try {
      expect(await links()).toEqual([]);
    } finally {
      await host.close().catch(() => undefined);
    }
  });

  it('an href that is not an absolute https: URL, put in the seed after frameDocument, is never drawn: the value stays text', async () => {
    await mountReady([{ value: 'AB-12', href: HREF }], (s) => s.replace(HREF, 'http://tracker.example/AB-12'));
    try {
      expect(await links()).toEqual([]);
      expect(await byline()).toContain('AB-12');
    } finally {
      await host.close().catch(() => undefined);
    }
  });
});
