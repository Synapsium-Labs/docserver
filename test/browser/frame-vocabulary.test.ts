// The vocabulary in the sealed frame, in a real browser (docserver parity T5, the bootstrap split): the bootstrap's own seed check holds
// `features.vocabulary` to a plain object, so a vocabulary the host side would have refused, put in the seed after frameDocument,
// reaches the reader, whose own check (normalizeOptions) refuses it: the frame says ready, then error `render`, and the host falls
// back as it does for any failed render. Assets are the exact bytes the build writes (frame-host-page.ts).
import { afterAll, beforeAll, expect, it } from 'vitest';
import { frameCsp, frameDocument, type FrameAssets } from '../../src/frame/index.js';
import { render } from '../../src/render/index.js';
import { openFrameHost, type FrameHost } from './frame-host-page.js';
import { data, freshNonce, loadFrame, type BuiltFrame } from './frame-shared.js';
import { browserFor, closeBrowsers, describeBrowsers } from './harness.js';

const DOC = '# Title\n\n**Spec** · 2026-10-12 · Tracker: AB-12\n\n## Scope\n\nBody.\n';
const FEATURES = { vocabulary: { itemFields: ['Tracker'] } };
const WORDS = '"itemFields":["Tracker"]';

let built: BuiltFrame;
let assets: FrameAssets;

beforeAll(async () => {
  built = await loadFrame();
  assets = built.assets;
}, 120_000);
afterAll(closeBrowsers);

describeBrowsers((browser) => {
  let host: FrameHost;

  /** Mount DOC with `edit` applied to the srcdoc text; answers the nonce and the messages after ready (one more for a failure). */
  async function mount(edit: (s: string) => string, count: number): Promise<{ nonce: string; messages: unknown[] }> {
    host = await openFrameHost(await browserFor(browser));
    const nonce = freshNonce();
    const csp = frameCsp();
    const r = render(DOC);
    const input = { result: { outcome: r.outcome, html: r.html, meta: { title: r.meta.title, frontList: r.meta.frontList } } };
    const doc = frameDocument(input, { csp, nonce, assets, features: FEATURES });
    await host.mount(edit(doc), csp);
    return { nonce, messages: data(await host.waitMessages(count, 90_000)) };
  }

  it('a vocabulary the host side would refuse, put in the seed after frameDocument, fails the render: ready, then error render', async () => {
    const { nonce, messages } = await mount((s) => {
      expect(s).toContain(WORDS);
      return s.replace(WORDS, '"itemFields":[" Tracker"]');
    }, 2);
    try {
      expect(messages).toEqual([{ t: 'ready', v: 1, nonce }, { t: 'error', why: 'render' }]);
    } finally {
      await host.close().catch(() => undefined);
    }
  });

  it('the same seed with its vocabulary untouched is ready and fails nothing', async () => {
    const { nonce, messages } = await mount((s) => s, 1);
    try {
      expect(messages).toEqual([{ t: 'ready', v: 1, nonce }]);
      // no late `error` after ready: wait, then exactly the one message is all the frame sent
      await new Promise((resolve) => setTimeout(resolve, 400));
      expect(data(await host.record())).toEqual([{ t: 'ready', v: 1, nonce }]);
      expect(host.errors).toEqual([]);
    } finally {
      await host.close().catch(() => undefined);
    }
  });
});
