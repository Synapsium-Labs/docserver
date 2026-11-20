// The appearance contract in the sealed frame, in a real browser (docserver appearance plan, Task 5; the first
// consumer's design, section 10: tests 3, 7 and 9's behaviour rows). The assets are the exact bytes the build writes,
// mounted as release bytes in a sandboxed iframe under the hash-only policy (frame-host-page.ts); the parent posts the
// `appearance` op on the frame's port as `./host` does, and the rows read computed values in the frame.
//
// Rows: the seed's values are the root's computed values at the first `ready`; an op applies in place (the same iframe,
// the same root node, one load); a host face that fails still reaches `ready` and is dropped, and a good one loads under
// its fixed family name; a document with both faces and the largest accepted appearance mounts; test 9's behaviour
// rows: the policy does not depend on an appearance, and the frame-to-parent traffic of a mount with a seed and 20 ops
// equals that of the same mount with none; and the string `ccrc` is in no built frame asset.
//
// The cap rows. The row in the ordinary run mounts a 1.5 MiB document with both faces near the cap (the library's own serif
// face, 122 360 decoded bytes of the 131 072 allowed, for both roles) and the largest appearance. A document at 1.1.0's
// default srcdoc cap (about 115 million characters: the html's 57 million, the five assets, the images' 7 million and every
// other seed field at its cap, test/frame-old-cap.ts) is mounted by the measured row alone, which runs only with
// DOCREADER_MEASURE=1 (ccrc D-8824): the srcdoc text is held several times over in the test process, the browser and the
// frame, which the 6 GB shared slice does not carry beside other runs, and the reader's startup over it is long. The Node
// row of the same document, test 7's old-cap row in test/frame-document.test.ts, runs in CI.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { frameCsp, frameDocument, type FrameAssets } from '../../src/frame/index.js';
import { APPEARANCE_SLOTS, parseAppearance, SLOT_PROPERTY, type Appearance, type AppearanceColourSlot } from '../../src/enhance/appearance.js';
import { openFrameHost, openLibHost, type FrameHost } from './frame-host-page.js';
import { data, figure, freshNonce, input, loadFrame, MEASURE, PLAIN, ROOT, sleep, waitProgress, type BuiltFrame } from './frame-shared.js';
import { oldCapDocument } from '../frame-old-cap.js';
import { browserFor, closeBrowsers, describeBrowsers } from './harness.js';

let built: BuiltFrame;
let assets: FrameAssets;

const FIXTURES = JSON.parse(readFileSync(path.join(ROOT, 'conformance', 'appearance', 'fixtures.json'), 'utf8')) as {
  name: string;
  mode: 'light' | 'dark';
  colour: Record<AppearanceColourSlot, string>;
}[];
const PHOSPHOR = FIXTURES.find((f) => f.name === 'Phosphor & Ink') as (typeof FIXTURES)[number];
const DAYLIGHT = FIXTURES.find((f) => f.name === 'Phosphor Daylight') as (typeof FIXTURES)[number];
const SKIN = { radius: '6px', radiusSmall: '3px', radiusLarge: '12px', controlRow: '40px', popShadow: '0 12px 40px rgba(0, 0, 0, 0.55)', sectionCase: 'uppercase' };
const DARK: Appearance = { mode: 'dark', colour: PHOSPHOR.colour, skin: SKIN, label: 'Follows the host' };
const LIGHT: Appearance = { mode: 'light', colour: DAYLIGHT.colour, skin: { radius: '9px' } };

/** The longest appearance the validator accepts (the Node row's own construction). */
const LARGEST: Appearance = (() => {
  const shadow = '-64px -64px 64px -8px rgba(255, 255, 255, 0.999)';
  const skin = { radius: '24px', radiusSmall: '24px', radiusLarge: '24px', controlRow: '56px', popShadow: [shadow, shadow, shadow].join(', '), sectionFamily: 'mono', sectionSize: '16px', sectionWeight: '900', sectionTracking: '-0.100em', sectionCase: 'uppercase' };
  const colour = Object.fromEntries(APPEARANCE_SLOTS.colour.map((k) => [k, '#ABCDEF']));
  const got = parseAppearance({ mode: 'light', colour, skin, label: '<'.repeat(64) }).appearance;
  return got;
})();

const fontBytes = (file: string): Buffer => readFileSync(path.join(ROOT, 'assets', 'fonts', file));
const GOOD_SANS = (): string => fontBytes('source-sans-3-latin-wght-normal.woff2').toString('base64');
const GOOD_MONO = (): string => fontBytes('source-serif-4-latin-opsz-normal.woff2').toString('base64');
/** Passes the seed's checks (alphabet, signature, cap) and fails to load: the signature, then bytes no font parser accepts. */
const BAD_FACE = (): string => Buffer.concat([Buffer.from('wOF2'), Buffer.alloc(200, 7)]).toString('base64');

beforeAll(async () => {
  built = await loadFrame();
  assets = built.assets;
}, 120_000);
afterAll(closeBrowsers);

const READY_MS = 90_000;

describeBrowsers((browser) => {
  let host: FrameHost;
  const open = async (): Promise<FrameHost> => (host = await openFrameHost(await browserFor(browser)));
  const done = async (): Promise<void> => {
    await host.close().catch(() => undefined);
  };

  /** Mount `markdown` with the given appearance and faces and wait for `ready`; answers the nonce. */
  async function mountReady(h: FrameHost, opts: { appearance?: unknown; fonts?: { sans?: string; mono?: string }; markdown?: string } = {}): Promise<string> {
    const nonce = freshNonce();
    const csp = frameCsp();
    const doc = frameDocument(input(opts.markdown ?? PLAIN()), {
      csp,
      nonce,
      assets: opts.fonts === undefined ? assets : ({ ...assets, fonts: opts.fonts } as FrameAssets),
      ...(opts.appearance === undefined ? {} : { appearance: opts.appearance as Appearance }),
    });
    await h.mount(doc, csp);
    expect(data(await h.waitMessages(1, READY_MS))[0]).toEqual({ t: 'ready', v: 1, nonce });
    return nonce;
  }

  /** The root's computed values of the given custom properties, its attributes, and the html element's mark and properties. */
  const read = (h: Pick<FrameHost, 'frame'>, props: readonly string[]) =>
    h.frame().evaluate((names) => {
      const root = document.body.querySelector(':scope > article') as HTMLElement;
      const cs = getComputedStyle(root);
      const html = document.documentElement;
      const hs = getComputedStyle(html);
      return {
        props: names.map((n) => cs.getPropertyValue(n).trim()),
        // What the reader itself wrote on the root (the stylesheet declares 1.1.0's tokens, so a computed value is never empty).
        inline: names.map((n) => root.style.getPropertyValue(n)),
        hosted: root.hasAttribute('data-docreader-hosted'),
        colours: root.hasAttribute('data-docreader-colours'),
        skin: root.getAttribute('data-docreader-skin'),
        theme: root.getAttribute('data-theme'),
        htmlMark: html.hasAttribute('data-docreader-hosted'),
        tip: ['--dr-tip-bg', '--dr-tip-fg', '--dr-tip-edge'].map((p) => hs.getPropertyValue(p).trim()),
        aa: root.querySelector('.aa-hosted')?.textContent ?? null,
        themeRadios: root.querySelectorAll('input[data-pref="theme"]').length,
      };
    }, props);

  const ALL = [...APPEARANCE_SLOTS.colour.map((s) => SLOT_PROPERTY.colour[s]), ...APPEARANCE_SLOTS.skin.map((s) => SLOT_PROPERTY.skin[s])];
  const expectedOf = (a: Appearance): string[] => [
    ...APPEARANCE_SLOTS.colour.map((s) => a.colour?.[s] ?? ''),
    ...APPEARANCE_SLOTS.skin.map((s) => a.skin?.[s] ?? ''),
  ];

  it('the seed: the root has the verdict\'s values as computed values at the first ready, the html element is marked, and Aa is hosted', async () => {
    await open();
    try {
      await mountReady(host, { appearance: DARK });
      const got = await read(host, ALL);
      expect(got.props).toEqual(expectedOf(DARK));
      expect(got).toMatchObject({ hosted: true, colours: true, theme: 'dark', htmlMark: true, aa: 'Follows the host', themeRadios: 0 });
      expect(got.skin).toBe('radius radiusSmall radiusLarge controlRow popShadow sectionCase');
      expect(got.tip).toEqual([PHOSPHOR.colour.surface, PHOSPHOR.colour.text, PHOSPHOR.colour.border]);
      expect(host.errors).toEqual([]);
      expect(host.cspConsole).toEqual([]);
    } finally {
      await done();
    }
  });

  it('with no appearance nothing of it is on the root or the html element, and Aa keeps its theme row', async () => {
    await open();
    try {
      await mountReady(host);
      const got = await read(host, ALL);
      expect(got.inline).toEqual(ALL.map(() => '')); // the reader wrote no slot property
      expect(got).toMatchObject({ hosted: false, colours: false, skin: null, htmlMark: false, tip: ['', '', ''], aa: null, themeRadios: 3 });
    } finally {
      await done();
    }
  });

  it('an op applies in place: the same iframe, the same root node, one load, new computed values', async () => {
    await open();
    try {
      await mountReady(host, { appearance: DARK });
      await host.frame().evaluate(() => {
        const root = document.body.querySelector(':scope > article') as HTMLElement & { __same?: number };
        root.__same = 1;
        (root.querySelector('.aa-btn') as HTMLElement & { __same?: number }).__same = 2;
      });
      await host.send('main', { t: 'appearance', v: 1, appearance: LIGHT });
      // Within one task after the message: poll briefly, never a fixed long sleep.
      let got = await read(host, ALL);
      for (let i = 0; i < 40 && got.props[0] !== LIGHT.colour?.bg; i += 1) {
        await sleep(25);
        got = await read(host, ALL);
      }
      expect(got.props).toEqual(expectedOf(LIGHT));
      expect(got).toMatchObject({ hosted: true, colours: true, theme: 'light', skin: 'radius', htmlMark: true });
      expect(got.tip[0]).toBe(DAYLIGHT.colour.surface);
      const same = await host.frame().evaluate(() => {
        const root = document.body.querySelector(':scope > article') as HTMLElement & { __same?: number };
        return [root.__same, (root.querySelector('.aa-btn') as (HTMLElement & { __same?: number }) | null)?.__same];
      });
      expect(same).toEqual([1, 2]);
      expect((await host.record()).loads).toHaveLength(1);
      // An op with no colour group clears the colours and the html mark; the root stays hosted.
      await host.send('main', { t: 'appearance', v: 1, appearance: { mode: 'dark' } });
      for (let i = 0; i < 40 && got.colours; i += 1) {
        await sleep(25);
        got = await read(host, ALL);
      }
      expect(got).toMatchObject({ hosted: true, colours: false, skin: null, htmlMark: false, tip: ['', '', ''], theme: 'dark' });
      expect(got.inline).toEqual(ALL.map(() => '')); // every host colour and skin value is gone from the root
      expect(host.errors).toEqual([]);
    } finally {
      await done();
    }
  });

  it('a malformed op changes nothing, and the frame keeps working', async () => {
    await open();
    try {
      await mountReady(host, { appearance: DARK });
      // Not a plain object: refused whole (a plain object with bad slots is judged slot by slot, and may clear the colours).
      for (const bad of [null, 5, 'x', []]) await host.send('main', { t: 'appearance', v: 1, appearance: bad });
      await host.send('main', { t: 'appearance', v: 2, appearance: LIGHT }); // another protocol version: refused by the port parser
      await sleep(300);
      const got = await read(host, ALL);
      expect(got.props).toEqual(expectedOf(DARK));
    } finally {
      await done();
    }
  });

  it('a good host face loads under its fixed family name; a face that fails to load is dropped, and the frame still reaches ready', async () => {
    await open();
    try {
      await mountReady(host, { appearance: DARK, fonts: { sans: GOOD_SANS(), mono: BAD_FACE() } });
      const faces = async (): Promise<{ family: string; status: string }[]> =>
        host.frame().evaluate(() => Array.from(document.fonts, (f) => ({ family: f.family.replace(/"/g, ''), status: f.status })).filter((f) => f.family.startsWith('Docreader Host')));
      let got = await faces();
      for (let i = 0; i < 80 && !(got.length === 1 && got[0]?.status === 'loaded'); i += 1) {
        await sleep(50);
        got = await faces();
      }
      expect(got).toEqual([{ family: 'Docreader Host Sans', status: 'loaded' }]); // the bad mono face is gone from the set
      expect(host.errors).toEqual([]);
      expect(host.cspConsole).toEqual([]);
    } finally {
      await done();
    }
  });

  it('a face that is no font at all (signature only) is dropped the same way', async () => {
    await open();
    try {
      await mountReady(host, { appearance: DARK, fonts: { sans: Buffer.from('wOF2').toString('base64'), mono: BAD_FACE() } });
      await sleep(500);
      const left = await host.frame().evaluate(() => Array.from(document.fonts).filter((f) => f.family.includes('Docreader Host')).length);
      expect(left).toBe(0);
    } finally {
      await done();
    }
  });

  it('a larger document with both faces and the largest accepted appearance mounts and applies it (see the header for the cap row)', async () => {
    await open();
    try {
      const para = 'The reader keeps its place while the host changes colour, and nothing here moves. '.repeat(30);
      const markdown = `# Large\n\n${Array.from({ length: 600 }, (_, i) => `## Part ${String(i + 1)}\n\n${para}\n`).join('\n')}`;
      expect(markdown.length).toBeGreaterThan(1_400_000);
      await mountReady(host, { appearance: LARGEST, fonts: { sans: GOOD_MONO(), mono: GOOD_MONO() }, markdown });
      const got = await read(host, ALL);
      expect(got.props).toEqual(expectedOf(LARGEST));
      expect(got.aa).toBe('<'.repeat(64));
      expect(host.errors).toEqual([]);
    } finally {
      await done();
    }
  }, 240_000);

  it.skipIf(!MEASURE)(
    "measures (DOCREADER_MEASURE=1): a document at 1.1.0's default srcdoc cap, with both faces and the largest accepted appearance, mounts through ./host to ready with no fallback",
    async () => {
      // ccrc D-8824. The document is test/frame-old-cap.ts's (html at SEED_HTML_MAX_CHARS, 512 images at the 5 MiB budget, the
      // title, front list, commits and the features' word lists at their caps); what the library page's mount cannot carry is the
      // snapshot (a store of 8 values of 64 KiB, about 3 million characters) and the 64 Mermaid secure keys, which this row leaves out.
      // Mermaid's asset is inlined (the scan admits it), as the old cap counts it.
      const { input: doc, options } = oldCapDocument();
      const face = Buffer.concat([Buffer.from('wOF2'), Buffer.alloc(131072 - 4)]).toString('base64');
      const host = await openLibHost(await browserFor(browser));
      try {
        const scan = { mermaid: { fences: 1, largestBytes: 1, totalBytes: 1, largestChars: 1, totalChars: 1 } };
        const t0 = performance.now();
        await host.mount({
          document: { ...doc, scan },
          assets: { ...assets, mermaid: built.mermaid, fonts: { sans: face, mono: face } } as FrameAssets,
          watchdogMs: 120_000,
          features: options.features,
          appearance: LARGEST,
        });
        const sent = performance.now() - t0;
        const srcdocChars = await host.page.evaluate(() => document.querySelector('iframe')?.srcdoc.length ?? -1);
        const w = await waitProgress(host, 1, `old cap ${browser}`, 240_000, 900_000);
        const rec = await host.lib();
        figure('oldCap', browser, 'srcdocChars', srcdocChars);
        figure('oldCap', browser, 'mountCallMs', sent);
        figure('oldCap', browser, 'waitedMs', w.ms);
        figure('oldCap', browser, 'readyAtMs', rec.events.find((e) => e.kind === 'ready')?.at ?? -1);
        expect(w.gaveUp).toBe(false);
        expect(rec.events.map((e) => e.kind)).toEqual(['ready']); // no fallback
        expect(host.errors).toEqual([]);
        expect(host.cspConsole).toEqual([]);
        const got = await read(host, ALL);
        expect(got.props).toEqual(expectedOf(LARGEST));
        expect(got.aa).toBe('<'.repeat(64));
      } finally {
        await host.close().catch(() => undefined);
      }
    },
    1_200_000,
  );

  it('test 9 (behaviour): the policy does not depend on an appearance, and 20 ops add no frame-to-parent message', async () => {
    const run = async (appearance: Appearance | undefined, ops: number): Promise<{ csp: string | null; kinds: string[]; attr: string }> => {
      const h = await open();
      try {
        const csp = frameCsp();
        const nonce = freshNonce();
        const doc = frameDocument(input(PLAIN()), { csp, nonce, assets: appearance === undefined ? assets : ({ ...assets, fonts: { sans: GOOD_SANS(), mono: GOOD_MONO() } } as FrameAssets), ...(appearance === undefined ? {} : { appearance }) });
        await h.mount(doc, csp);
        expect(data(await h.waitMessages(1, READY_MS))[0]).toEqual({ t: 'ready', v: 1, nonce });
        for (let i = 0; i < ops; i += 1) await h.send('main', { t: 'appearance', v: 1, appearance: i % 2 === 0 ? LIGHT : DARK });
        await sleep(800);
        const rec = await h.record();
        const meta = await h.frame().evaluate(() => document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.getAttribute('content') ?? null);
        const attr = await h.page.evaluate(() => document.querySelector('iframe')?.getAttribute('csp') ?? '');
        expect(h.errors).toEqual([]);
        expect(h.cspConsole).toEqual([]);
        return { csp: meta, kinds: data(rec).map((m) => (m as { t: string }).t), attr };
      } finally {
        await h.close().catch(() => undefined);
      }
    };
    const without = await run(undefined, 0);
    const withIt = await run(DARK, 20);
    expect(withIt.csp).toBe(without.csp);
    expect(withIt.attr).toBe(without.attr);
    expect(withIt.csp).toContain("default-src 'none'");
    expect(withIt.kinds).toEqual(without.kinds);
    expect(withIt.kinds).toEqual(['ready']);
  }, 240_000);

  it('no built frame asset contains the string ccrc', () => {
    for (const [name, text] of Object.entries({ ...built.assets, mermaid: built.mermaid })) {
      expect(typeof text === 'string' && text.includes('ccrc'), name).toBe(false);
    }
  });
});
