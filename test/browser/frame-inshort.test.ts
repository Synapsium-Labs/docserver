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
const SEEN = 'c'.repeat(40);
const OLDER = 'b'.repeat(40);
const ONLY = 'd'.repeat(40);
// A long document, so that a scroll would show: its changed places and its hash target are far down.
const LONG = `${DOC}\n${Array.from({ length: 120 }, (_, i) => `Filler paragraph ${String(i + 1)}, with enough words to take a line or two of the page.\n`).join('\n')}\n## Late section\n\nThe end.\n`;
const LONG_LINE = LONG.split('\n').length - 4;
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

  async function mountReady(over: Partial<FrameOptions>, how: { readonly markdown?: string; readonly only?: string; readonly hash?: string } = {}): Promise<void> {
    host = await openFrameHost(await browserFor(browser));
    const nonce = freshNonce();
    const csp = frameCsp();
    const r = render(how.markdown ?? DOC);
    const version = how.only === undefined ? VERSION : { ...VERSION, only: how.only };
    const input = { result: { outcome: r.outcome, html: r.html, meta: { title: r.meta.title, frontList: r.meta.frontList } }, version, ...(how.hash === undefined ? {} : { initialHash: how.hash }) };
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

  // The last visit and the comparison base together (docserver readiness T5). Both are asked at the reader's start, before
  // `ready`, and the frame's outbox holds one `changes` request there, so the reader asks for the base only once the last-visit
  // measure has settled; the host then sees both, the measure's first. The rows answer each request by hand, so every wait is
  // on a condition of the page, and none is a time.
  const SEEN_AT_ANOTHER_SHA = { 'doc:seen': JSON.stringify({ sha: SEEN, at: 0 }) } as const;
  const until = async (what: string, ready: () => Promise<boolean>): Promise<void> => {
    for (let i = 0; i < 1200; i += 1) {
      if (await ready()) return;
      await settle(25);
    }
    throw new Error(`never reached: ${what}`);
  };
  const askedShas = async (): Promise<string[]> => ((await sent('changes')) as { sha: string }[]).map((m) => m.sha);
  const answerSet = (sha: string): Promise<void> => host.send('main', { t: 'changes.result', sha, ranges: [[3, 12]] });
  /** The notice, the trigger's label and the menu's rows; with `open` false the menu is left shut (opening it scrolls its first row into view). */
  const readerState = (open = true): Promise<{ notice: string | null; label: string | null; rows: string[] }> =>
    host.frame().evaluate((opening) => {
      if (opening) (document.querySelector('.chg-trig') as HTMLElement | null)?.click();
      return {
        notice: document.querySelector('.rs-notice')?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
        label: document.querySelector('.chg-trig .ct-label')?.textContent ?? null,
        rows: Array.from(document.querySelectorAll('[role="menuitemradio"]')).map((el) => el.getAttribute('data-key') ?? ''),
      };
    }, open);

  it('a prior visit and a seeded base: the host gets both shas, the last visit\'s first, and the notice and the menu\'s visit row appear', async () => {
    await mountReady({ changesBase: BASE, snapshot: SEEN_AT_ANOTHER_SHA, bridge: { changes: true } });
    try {
      await until('the first changes request', async () => (await askedShas()).length >= 1);
      expect(await askedShas()).toEqual([SEEN]);
      await answerSet(SEEN);
      await until('the second changes request', async () => (await askedShas()).length >= 2);
      expect(await askedShas()).toEqual([SEEN, BASE]);
      await answerSet(BASE);
      await until('the base shown', async () => (await readerState()).label === 'Since the base commit');
      const state = await readerState();
      expect(state.notice).toMatch(/^Changed since your last visit .* 1 place Show$|^Changed since your last visit .*·.*Show$/);
      expect(state.rows).toContain('visit');
      expect(await askedShas()).toEqual([SEEN, BASE]);
      expect(host.errors).toEqual([]);
      expect(host.cspConsole).toEqual([]);
    } finally {
      await host.close().catch(() => undefined);
    }
  });

  it('a prior visit alone: the host gets the last visit\'s sha only, and the notice and the visit row appear', async () => {
    await mountReady({ snapshot: SEEN_AT_ANOTHER_SHA, bridge: { changes: true } });
    try {
      await until('the first changes request', async () => (await askedShas()).length >= 1);
      await answerSet(SEEN);
      await until('the notice', async () => (await readerState()).notice !== null);
      const state = await readerState();
      expect(state.notice).toContain('Changed since your last visit');
      expect(state.rows).toContain('visit');
      expect(state.label).toBe('Changes since…');
      expect(await askedShas()).toEqual([SEEN]);
      expect(host.errors).toEqual([]);
    } finally {
      await host.close().catch(() => undefined);
    }
  });

  it('a seeded base alone: the host gets the base only, and there is no notice and no visit row', async () => {
    await mountReady({ changesBase: BASE, bridge: { changes: true } });
    try {
      await until('the base request', async () => (await askedShas()).length >= 1);
      expect(await askedShas()).toEqual([BASE]);
      await answerSet(BASE);
      await until('the base shown', async () => (await readerState()).label === 'Since the base commit');
      const state = await readerState();
      expect(state.notice).toBeNull();
      expect(state.rows).not.toContain('visit');
      expect(await askedShas()).toEqual([BASE]);
      expect(host.errors).toEqual([]);
    } finally {
      await host.close().catch(() => undefined);
    }
  });

  const answerNone = (sha: string): Promise<void> => host.send('main', { t: 'changes.result', sha, unavailable: true });
  const answerDeep = (sha: string): Promise<void> => host.send('main', { t: 'changes.result', sha, ranges: [[LONG_LINE, LONG_LINE + 2]] });
  const scrollNow = (): Promise<number> => host.frame().evaluate(() => Math.max(window.scrollY, document.scrollingElement?.scrollTop ?? 0, document.body.scrollTop));
  /** Round trip into the frame: when it answers, the frame has run every task queued before it. */
  const idle = (): Promise<void> => host.frame().evaluate(() => new Promise<void>((resolve) => { setTimeout(resolve, 0); })).then(() => undefined);

  it('a measure that got no answer still lets the seeded base be asked and shown, without a notice', async () => {
    await mountReady({ changesBase: BASE, snapshot: SEEN_AT_ANOTHER_SHA, bridge: { changes: true } });
    try {
      await until('the first changes request', async () => (await askedShas()).length >= 1);
      await answerNone(SEEN);
      await until('the second changes request', async () => (await askedShas()).length >= 2);
      expect(await askedShas()).toEqual([SEEN, BASE]);
      await answerSet(BASE);
      await until('the base shown', async () => (await readerState()).label === 'Since the base commit');
      const state = await readerState();
      expect(state.notice).toBeNull();
      expect(state.rows).not.toContain('visit');
      expect(host.errors).toEqual([]);
    } finally {
      await host.close().catch(() => undefined);
    }
  });

  it('a measure that is slow to answer holds the base back and loses nothing: the frame is idle and unmarked until it answers', async () => {
    await mountReady({ changesBase: BASE, snapshot: SEEN_AT_ANOTHER_SHA, bridge: { changes: true } });
    try {
      await until('the first changes request', async () => (await askedShas()).length >= 1);
      await idle();
      await idle();
      expect(await askedShas()).toEqual([SEEN]);
      expect((await readerState()).label).toBe('Changes since…');
      await answerSet(SEEN);
      await until('the second changes request', async () => (await askedShas()).length >= 2);
      await answerSet(BASE);
      await until('the base shown', async () => (await readerState()).label === 'Since the base commit');
      expect((await readerState()).notice).toContain('Changed since your last visit');
      expect(await askedShas()).toEqual([SEEN, BASE]);
    } finally {
      await host.close().catch(() => undefined);
    }
  });

  it('a comparison the reader picks while the measure is in flight is not overwritten by the late base', async () => {
    await mountReady({ changesBase: BASE, snapshot: SEEN_AT_ANOTHER_SHA, bridge: { changes: true } });
    try {
      await until('the first changes request', async () => (await askedShas()).length >= 1);
      const picked = await host.frame().evaluate(() => {
        (document.querySelector('.chg-trig') as HTMLElement).click();
        const rows = Array.from(document.querySelectorAll('[role="menuitemradio"][data-key^="day:"]')) as HTMLElement[];
        rows[rows.length - 1]?.click();
        return document.querySelector('.chg-trig .ct-label')?.textContent ?? null;
      });
      expect(picked).not.toBeNull();
      expect(picked).not.toBe('Changes since…');
      expect(picked).not.toBe('Since the base commit');
      await answerSet(SEEN);
      await until('the measure settled', async () => (await readerState()).notice !== null);
      await idle();
      expect(await askedShas()).toEqual([SEEN, OLDER]);
      await answerSet(OLDER);
      await until('the pick shown', async () => (await host.frame().evaluate(() => document.querySelectorAll('.chg, .chg-del').length)) > 0);
      const state = await readerState();
      expect(state.label).toBe(picked);
      expect(state.rows).toContain('visit');
      expect(await askedShas()).toEqual([SEEN, OLDER]);
      expect(host.errors).toEqual([]);
    } finally {
      await host.close().catch(() => undefined);
    }
  });

  it('a one-day version asks for its own day only, whatever it is seeded with: no measure, no base, no menu', async () => {
    await mountReady({ changesBase: BASE, snapshot: SEEN_AT_ANOTHER_SHA, bridge: { changes: true, versions: true } }, { only: ONLY });
    try {
      await until('the day request', async () => (await askedShas()).length >= 1);
      expect(await askedShas()).toEqual([ONLY]);
      await answerSet(ONLY);
      await until('the banner\'s Show', async () => host.frame().evaluate(() => document.querySelector('.ver-show')?.hasAttribute('hidden') === false));
      await idle();
      expect(await askedShas()).toEqual([ONLY]);
      expect(await host.frame().evaluate(() => [document.querySelector('.chg-trig') === null, document.querySelector('.rs-notice') === null])).toEqual([true, true]);
      expect(host.errors).toEqual([]);
    } finally {
      await host.close().catch(() => undefined);
    }
  });

  it('applying the late base does not move the reader: the scroll position is the same at the top and at an initial hash', async () => {
    for (const hash of [null, 'late-section']) {
      await mountReady({ changesBase: BASE, snapshot: SEEN_AT_ANOTHER_SHA, bridge: { changes: true } }, { markdown: LONG, ...(hash === null ? {} : { hash }) });
      try {
        await until('the first changes request', async () => (await askedShas()).length >= 1);
        expect(await host.frame().evaluate(() => document.documentElement.scrollHeight > window.innerHeight * 2), 'the page scrolls').toBe(true);
        if (hash !== null) {
          let last = -1;
          await until('the hash landed and held', async () => { const now = await scrollNow(); const held = now > 0 && now === last; last = now; return held; });
        }
        // The notice, once drawn, holds the reader's place by itself (it adds a line above the hash target); the late base follows it.
        await answerDeep(SEEN);
        await until('the notice drawn', async () => (await readerState(false)).notice !== null);
        await until('the second changes request', async () => (await askedShas()).length >= 2);
        let last = -1;
        await until('the position held', async () => { const now = await scrollNow(); const held = now === last; last = now; return held; });
        const before = await scrollNow();
        expect(before > 0, String(hash)).toBe(hash !== null);
        await answerDeep(BASE);
        await until('the base shown', async () => (await readerState(false)).label === 'Since the base commit');
        await idle();
        expect(await host.frame().evaluate(() => document.querySelectorAll('.chg, .chg-del').length), 'the base is marked').toBeGreaterThan(0);
        expect(await scrollNow(), String(hash)).toBe(before);
      } finally {
        await host.close().catch(() => undefined);
      }
    }
  });
});
