// Mermaid drawn after ready, in a real browser, on the release bytes (docserver batch, Task 5; rows B5.1 to B5.7 and the
// two controller rulings of the batch; ledger C107). The frame is mounted with a seed whose `mermaid.draw` is
// 'after-ready': its srcdoc carries no Mermaid script, its policy still lists the build's hash, and the parent sends the
// build once, after ready, as `{ t: 'mermaid', text }` on the port. The harness (frame-host-page.ts) posts the op from the
// parent with `send`, the page's end of the channel, exactly as `./host` does.
//
//   B5.1  The load-bearing proof, on every engine: the exact text posted after ready draws every figure under the
//         hash-only policy (the inline script matches its hash), with no policy violation recorded from the parent's
//         side, no error, and SVG text equal to the same document drawn in 'auto' mode.
//   B5.2  At the instant `ready` is posted the root reads `waiting` (the instrumentation of L3.B6a): ready does not wait.
//   B5.3  A host page policy that allows inline style only by the frame stylesheet's hash ends ready, then error boot
//         (C94(1)): the bootstrap asks for inline style itself before ready, as a drawing will. Its control, a document
//         with Mermaid off, readies under the same policy.
//   B5.4  A text with one character changed is blocked by the policy (a script-src refusal, for a script that WAS
//         inserted): every figure shows the load note, the frame stays mounted, sends no error, and a prefs op posted
//         after it still takes effect (the frame is alive inside).
//   B5.4b A violation of another kind after ready (an image from another origin) leaves the frame alive: a prefs op still
//         takes effect (the `done` guard of the bootstrap's onViolation, which B5.4 alone does not tell from the blocked-inline
//         exception: each holds the blocked script's violation after ready).
//   B5.5  A `docserver:register` dispatched by other code in the frame is ignored. From inside a capture listener on the
//         frame's document for the real event, within the synchronous appendChild window, a forged one is dispatched
//         (a) on another element, (b) on the inserted element itself, and (c) after stopping the real event there, on
//         the inserted script's Text child (bubbling), each carrying a fake API. (a) draws with the real API and never
//         the fake; (b) is two registrations and (c) one registration of another target, so for both every figure shows
//         the load note, never the fake. (The construction that stops the real event and forges on the element itself
//         needs code running in the frame before the handover; it is known and parked, ledger C107.)
//   B5.6  A second `mermaid` op inserts no second script.
//   B5.7  The op is ignored in 'auto' and 'on-request' seeds, in a seed with Mermaid off, and before `settled`.
//   B5.8  The handover keeps the reader's place (fix round FR1, finding F1): the reader is scrolled into a long document
//         whose short Mermaid fences are above the reading block; the block's offset from the frame's top is read
//         before the op is posted and after every figure has settled, and the two agree within TOLERANCE_PX (the
//         drawings' own heights differ from the sources', so only a place-keeping handover holds the block). Run twice:
//         once as the engine does it, and once with the engine's native scroll anchoring off (`overflow-anchor: none`
//         set through the frame's CSSOM from the harness, named in the title), which is what an engine without that
//         feature (WebKit) does for every reader. And a third time, with anchoring off and the frame's `scrollTo` wrapped
//         to drop a position's fraction of a pixel (named in the title): WebKit keeps a scroll position in whole pixels
//         and drops the fraction it is asked for, so each kept change of a fractional height left the block up to a pixel
//         lower, and the next keep anchored it there (on WebKit in CI the block moved 2.78 px over the seven kept changes:
//         the gate and six drawings). The row holds that the keeps do not add those fractions up.
//   B5.U  `{ t: 'mermaid', unavailable: true }` inserts no script element and every figure shows the load note.
// The no-script boot (an 'after-ready' seed with Mermaid on and no Mermaid script gives ready, no FAILED mermaid) is
// frame-boot.test.ts's row (batch B5.C), and the hostile Mermaid cases drawn after the handover are frame-mermaid.test.ts's
// (L3.B15 in both modes).
//
// Release bytes only; the one instrumentation of a row is named in its title.
import { createHash } from 'node:crypto';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { frameCsp, type FrameAssets, type FrameOptions } from '../../src/frame/index.js';
import { openFrameHost, type FrameHost, type InitHow } from './frame-host-page.js';
import { data, DIAGRAMS, freshNonce, loadFrame, opsOf, readyOf, refusals, sleep, srcdocFor, svgTexts } from './frame-shared.js';
import { browserFor, closeBrowsers, describeBrowsers } from './harness.js';

let assets: FrameAssets;
let mermaidText = '';

beforeAll(async () => {
  const built = await loadFrame();
  assets = built.assets;
  mermaidText = built.mermaid;
}, 300_000);

afterAll(closeBrowsers);

const LATE: Partial<FrameOptions> = { mermaid: { draw: 'after-ready' } };

/** What the frame shows: the diagrams state, the gate, each figure's class, whether it holds an SVG and a failure note, and the script count. */
interface Shown {
  readonly state: string | null;
  readonly gate: boolean;
  readonly scripts: number;
  readonly figures: readonly { readonly cls: string; readonly svg: boolean; readonly note: boolean; readonly button: boolean }[];
}

const shown = (host: FrameHost): Promise<Shown> =>
  host.frame().evaluate(() => {
    const root = document.body.querySelector(':scope > article');
    return {
      state: root?.getAttribute('data-docreader-diagrams') ?? null,
      gate: root?.hasAttribute('data-docreader-mermaid') ?? false,
      scripts: document.querySelectorAll('script').length,
      figures: Array.from(document.querySelectorAll('figure.mermaid-figure'), (f) => ({
        cls: f.className,
        svg: f.querySelector('svg') !== null,
        note: f.querySelector(':scope > .fig-error') !== null,
        button: f.querySelector('.fig-render button') !== null,
      })),
    };
  });

/**
 * Wait (in the frame) until the diagrams state is final, whatever it is. A state that never gets there is not an error
 * of the wait: the row's own assertions then read the state it is stuck in (an assertion, not a timeout).
 */
const waitFinal = (host: FrameHost, ms = 60_000): Promise<unknown> =>
  host.frame().waitForFunction(() => ['drawn', 'failed', 'partial'].includes(document.body.querySelector(':scope > article')?.getAttribute('data-docreader-diagrams') ?? ''), undefined, { timeout: ms }).catch(() => undefined);

/** A host page policy that allows inline style only by the hash of the frame stylesheet's exact text. */
const hashOnlyStyle = (): string => `style-src 'sha256-${createHash('sha256').update(assets.css, 'utf8').digest('base64')}'`;

/** The most the reading block may move across the handover, in px: sub-pixel rounding of the drawings' heights. */
const TOLERANCE_PX = 2;

/** Six short fences, then a heading to read at, then a long tail. */
const LONG = [
  '# Place',
  '',
  ...[1, 2, 3, 4, 5, 6].flatMap((n) => ['```mermaid', `flowchart LR\n  N${String(n)} --> X`, '```', '', `*Figure ${String(n)}. The ${String(n)}th.*`, '']),
  '## Reading block',
  '',
  ...Array.from({ length: 30 }, (_, i) => `Paragraph ${String(i + 1)} of the tail, long enough to give the page a long scroll below the heading. `.repeat(4) + '\n'),
].join('\n');

const mermaidOp = (text: string): { t: 'mermaid'; text: string } => ({ t: 'mermaid', text });

describeBrowsers((browser) => {
  let host: FrameHost;
  const open = async (how: InitHow = {}, page: { policy?: string } = {}): Promise<FrameHost> => {
    host = await openFrameHost(await browserFor(browser), how, page);
    return host;
  };
  const done = async (): Promise<void> => {
    await host.close().catch(() => undefined);
  };
  /** Mount `md` 'after-ready' and wait for its ready; answers the nonce. */
  const mountLate = async (md: string, options: Partial<FrameOptions> = LATE, how: Parameters<FrameHost['mount']>[2] = 'auto'): Promise<string> => {
    const nonce = freshNonce();
    await host.mount(srcdocFor(assets, md, nonce, options), frameCsp(), how);
    expect(data(await host.waitMessages(1, 60_000))).toEqual([readyOf(nonce)]);
    return nonce;
  };

  it('B5.1: the exact text posted after ready draws every figure under the hash-only policy, with no violation, no error, SVG text equal to the auto-mode drawing', async () => {
    await open();
    let clean: string[];
    try {
      await mountLate(DIAGRAMS, { mermaid: { draw: 'auto' }, assets: { ...assets, mermaid: mermaidText } });
      await waitFinal(host);
      clean = await svgTexts(host);
      expect(clean).toHaveLength(3);
    } finally {
      await done();
    }
    await open();
    try {
      const nonce = await mountLate(DIAGRAMS);
      // Before the op: the sources are readable, nothing is drawn, no gate, and no Mermaid script of any kind.
      const before = await shown(host);
      expect({ state: before.state, gate: before.gate, drawn: before.figures.filter((f) => f.svg).length, count: before.figures.length }).toEqual({ state: 'waiting', gate: false, drawn: 0, count: 3 });
      await host.send('main', mermaidOp(mermaidText));
      await waitFinal(host);
      const after = await shown(host);
      expect(after.state).toBe('drawn');
      expect(after.figures.map((f) => [f.cls, f.svg, f.note])).toEqual([
        ['mermaid-figure drawn', true, false],
        ['mermaid-figure drawn', true, false],
        ['mermaid-figure drawn', true, false],
      ]);
      expect(after.scripts).toBe(before.scripts + 1);
      expect(await svgTexts(host)).toEqual(clean);
      await sleep(300);
      expect({ messages: data(await host.record()), violations: host.cspConsole, errors: host.errors }).toEqual({ messages: [readyOf(nonce)], violations: [], errors: [] });
    } finally {
      await done();
    }
  }, 240_000);

  it("B5.2 (instrumented: `diagramsAtReady` reads the root's state at the ready post): at the instant ready is posted the root reads waiting", async () => {
    await open({ diagramsAtReady: true });
    try {
      await mountLate(DIAGRAMS);
      const fr = await host.frameRecord();
      expect(fr.ready.map((r) => r.state)).toEqual(['waiting']);
      await host.send('main', mermaidOp(mermaidText));
      await waitFinal(host);
      expect((await shown(host)).state).toBe('drawn');
    } finally {
      await done();
    }
  }, 120_000);

  it("B5.3: a host page policy that allows inline style only by the stylesheet's hash ends ready, then error boot, with nothing drawn; control: the same policy admits a document with Mermaid off", async () => {
    await open({}, { policy: hashOnlyStyle() });
    try {
      const nonce = freshNonce();
      await host.mount(srcdocFor(assets, DIAGRAMS, nonce, LATE), frameCsp());
      const rec = await host.waitMessages(2, 60_000);
      expect(data(rec)).toEqual([readyOf(nonce), { t: 'error', why: 'boot' }]);
      await sleep(400);
      const after = await host.record();
      expect(data(after)).toHaveLength(2);
      expect(after.loads).toHaveLength(1);
      if (after.closeSupported) expect(after.closes).toEqual(['main']);
      expect(host.cspConsole.filter((m) => /style-src/.test(m))).not.toEqual([]);
    } finally {
      await done();
    }
    await open({}, { policy: hashOnlyStyle() });
    try {
      const nonce = freshNonce();
      await host.mount(srcdocFor(assets, DIAGRAMS.replace(/```mermaid/g, '```text'), nonce), frameCsp());
      expect(data(await host.waitMessages(1, 30_000))).toEqual([readyOf(nonce)]);
      await sleep(400);
      expect(data(await host.record())).toEqual([readyOf(nonce)]);
    } finally {
      await done();
    }
  }, 180_000);

  it('B5.4: a text with one character changed is blocked: every figure shows the load note, the frame stays mounted and sends no error', async () => {
    await open();
    try {
      const nonce = await mountLate(DIAGRAMS);
      const before = await shown(host);
      const at = mermaidText.slice(2000).search(/[a-y]/) + 2000;
      const changed = mermaidText.slice(0, at) + String.fromCharCode(mermaidText.charCodeAt(at) + 1) + mermaidText.slice(at + 1);
      expect(changed.length).toBe(mermaidText.length);
      expect(changed).not.toBe(mermaidText);
      await host.send('main', mermaidOp(changed));
      await waitFinal(host);
      const after = await shown(host);
      expect(after.state).toBe('failed');
      expect(after.figures.map((f) => [f.cls, f.svg, f.note])).toEqual([
        ['mermaid-figure draw-failed', false, true],
        ['mermaid-figure draw-failed', false, true],
        ['mermaid-figure draw-failed', false, true],
      ]);
      // The script WAS inserted, and the policy blocked it: a script-src refusal reached the parent's console channel.
      expect(after.scripts).toBe(before.scripts + 1);
      expect(refusals(host, /script-src/)).not.toEqual([]);
      // The frame is alive inside: a prefs op posted after the blocked text still takes effect.
      const font = (): Promise<string | null> => host.frame().evaluate(() => document.body.querySelector(':scope > article')?.getAttribute('data-font') ?? null);
      expect(await font()).toBe('serif');
      await host.send('main', { t: 'prefs', font: 'sans' });
      await host.frame().waitForFunction(() => document.body.querySelector(':scope > article')?.getAttribute('data-font') === 'sans', undefined, { timeout: 10_000 }).catch(() => undefined);
      expect(await font()).toBe('sans');
      await sleep(400);
      const rec = await host.record();
      // Ready first, and no error: the prefs change the frame took may have crossed as a store write.
      expect(data(rec)[0]).toEqual(readyOf(nonce));
      expect(opsOf(rec, ['error'])).toEqual([]);
      expect(rec.loads).toHaveLength(1);
      expect(rec.closes).toEqual([]);
      expect(host.errors).toEqual([]);
    } finally {
      await done();
    }
  }, 120_000);

  it("B5.4b: a policy violation of another kind after ready (an image from another origin) leaves the frame alive: the bootstrap's `done` guard of onViolation, alone", async () => {
    await open();
    try {
      const nonce = await mountLate(DIAGRAMS);
      // The violation is of img-src, not a blocked inline script, so the exception for inline scripts does not cover it: only
      // the `done` guard keeps a violation after ready from ending the boot (state failed) and with it the port's handling.
      await host.frame().evaluate(() => {
        const image = new Image();
        image.src = 'https://example.invalid/blocked.png';
      });
      for (let i = 0; i < 50 && refusals(host, /img-src/).length === 0; i += 1) await sleep(100);
      expect(refusals(host, /img-src/)).not.toEqual([]);
      const font = (): Promise<string | null> => host.frame().evaluate(() => document.body.querySelector(':scope > article')?.getAttribute('data-font') ?? null);
      expect(await font()).toBe('serif');
      await host.send('main', { t: 'prefs', font: 'sans' });
      await host.frame().waitForFunction(() => document.body.querySelector(':scope > article')?.getAttribute('data-font') === 'sans', undefined, { timeout: 10_000 }).catch(() => undefined);
      expect(await font()).toBe('sans');
      const rec = await host.record();
      expect(data(rec)[0]).toEqual(readyOf(nonce));
      expect(opsOf(rec, ['error'])).toEqual([]);
      expect(host.errors).toEqual([]);
    } finally {
      await done();
    }
  }, 120_000);

  it('B5.5 (instrumented: `forgeRegister` dispatches a forged register on another element from inside the real one): the API L2 draws with is the real one, never the fake', async () => {
    await open({ forgeRegister: 'other' });
    try {
      const nonce = await mountLate(DIAGRAMS);
      await host.send('main', mermaidOp(mermaidText));
      await waitFinal(host);
      const fr = await host.frameRecord();
      // The forgery happened (so the row cannot pass by missing), and the fake was never used.
      expect(fr.forged).toEqual({ dispatched: 1, fakeCalls: 0 });
      const after = await shown(host);
      expect({ state: after.state, drawn: after.figures.map((f) => f.svg), notes: after.figures.map((f) => f.note) }).toEqual({ state: 'drawn', drawn: [true, true, true], notes: [false, false, false] });
      expect((await svgTexts(host)).every((t) => t.length > 0)).toBe(true);
      expect(data(await host.record())).toEqual([readyOf(nonce)]);
    } finally {
      await done();
    }
  }, 120_000);

  it('B5.5 (instrumented: `forgeRegister` dispatches the forged register on the inserted element itself): two registrations, so every figure shows the load note and the fake is never used', async () => {
    await open({ forgeRegister: 'inserted' });
    try {
      const nonce = await mountLate(DIAGRAMS);
      await host.send('main', mermaidOp(mermaidText));
      await waitFinal(host);
      const fr = await host.frameRecord();
      expect(fr.forged).toEqual({ dispatched: 1, fakeCalls: 0 });
      const after = await shown(host);
      expect(after.state).toBe('failed');
      expect(after.figures.map((f) => [f.cls, f.svg, f.note])).toEqual([
        ['mermaid-figure draw-failed', false, true],
        ['mermaid-figure draw-failed', false, true],
        ['mermaid-figure draw-failed', false, true],
      ]);
      await sleep(300);
      expect({ messages: data(await host.record()), errors: host.errors }).toEqual({ messages: [readyOf(nonce)], errors: [] });
    } finally {
      await done();
    }
  }, 120_000);

  it('B5.5 (instrumented: `forgeRegister` stops the real register and forges on the inserted script\'s Text child, bubbling): one registration of another target, so every figure shows the load note and the fake is never used', async () => {
    await open({ forgeRegister: 'text' });
    try {
      const nonce = await mountLate(DIAGRAMS);
      await host.send('main', mermaidOp(mermaidText));
      await waitFinal(host);
      const fr = await host.frameRecord();
      expect(fr.forged).toEqual({ dispatched: 1, fakeCalls: 0 });
      const after = await shown(host);
      expect(after.state).toBe('failed');
      expect(after.figures.map((f) => [f.cls, f.svg, f.note])).toEqual([
        ['mermaid-figure draw-failed', false, true],
        ['mermaid-figure draw-failed', false, true],
        ['mermaid-figure draw-failed', false, true],
      ]);
      await sleep(300);
      expect({ messages: data(await host.record()), errors: host.errors }).toEqual({ messages: [readyOf(nonce)], errors: [] });
    } finally {
      await done();
    }
  }, 120_000);

  const B58 = [
    { anchoring: true, whole: false, named: '' },
    { anchoring: false, whole: false, named: ' (instrumented: `overflow-anchor: none` on the frame\'s root, the engine without scroll anchoring)' },
    {
      anchoring: false,
      whole: true,
      named: " (instrumented: `overflow-anchor: none` on the frame's root and the frame's `scrollTo` dropping a position's fraction of a pixel, the engine that keeps whole pixels)",
    },
  ] as const;
  for (const { anchoring, whole, named } of B58) {
    it(`B5.8${named}: the reading block stays where it was across the handover, within ${String(TOLERANCE_PX)} px`, async () => {
      await open();
      try {
        await mountLate(LONG);
        const frame = host.frame();
        if (!anchoring) await frame.evaluate(() => document.documentElement.style.setProperty('overflow-anchor', 'none'));
        if (whole) {
          await frame.evaluate(() => {
            const scroll = window.scrollTo.bind(window);
            window.scrollTo = ((o: ScrollToOptions) => {
              scroll({ ...o, top: Math.trunc(o.top ?? 0) });
            }) as typeof window.scrollTo;
          });
        }
        const offset = (): Promise<number> => frame.evaluate(() => (document.getElementById('reading-block') as HTMLElement).getBoundingClientRect().top);
        // Scroll the heading to 150 px under the frame's top, with every fence above the reading line, and wait for it to hold.
        await frame.evaluate(() => {
          const top = (document.getElementById('reading-block') as HTMLElement).getBoundingClientRect().top;
          window.scrollTo({ top: window.scrollY + top - 150, behavior: 'instant' });
        });
        await frame.waitForFunction(() => Math.abs((document.getElementById('reading-block') as HTMLElement).getBoundingClientRect().top - 150) < 1, undefined, { timeout: 10_000 });
        await sleep(300);
        const before = await offset();
        expect(Math.abs(before - 150)).toBeLessThan(1);
        expect((await shown(host)).state).toBe('waiting');
        await host.send('main', mermaidOp(mermaidText));
        await waitFinal(host);
        expect((await shown(host)).state).toBe('drawn');
        await sleep(300);
        const after = await offset();
        expect(Math.abs(after - before), `the block moved from ${String(before)} to ${String(after)}`).toBeLessThanOrEqual(TOLERANCE_PX);
      } finally {
        await done();
      }
    }, 120_000);
  }

  it('B5.U: {t:"mermaid", unavailable:true} inserts no script element and every figure shows the load note', async () => {
    await open();
    try {
      const nonce = await mountLate(DIAGRAMS);
      const before = await shown(host);
      await host.send('main', { t: 'mermaid', unavailable: true });
      await waitFinal(host);
      const after = await shown(host);
      expect(after.scripts).toBe(before.scripts);
      expect(after.state).toBe('failed');
      expect(after.figures.map((f) => [f.cls, f.svg, f.note])).toEqual([
        ['mermaid-figure draw-failed', false, true],
        ['mermaid-figure draw-failed', false, true],
        ['mermaid-figure draw-failed', false, true],
      ]);
      await sleep(300);
      expect({ messages: data(await host.record()), violations: host.cspConsole, errors: host.errors }).toEqual({ messages: [readyOf(nonce)], violations: [], errors: [] });
    } finally {
      await done();
    }
  }, 120_000);

  it('B5.6: a second mermaid op inserts no second script (the build is accepted once)', async () => {
    await open();
    try {
      await mountLate(DIAGRAMS);
      const before = await shown(host);
      await host.send('main', mermaidOp(mermaidText));
      await waitFinal(host);
      const once = await shown(host);
      expect(once.scripts).toBe(before.scripts + 1);
      await host.send('main', mermaidOp(mermaidText));
      await host.send('main', { t: 'mermaid', unavailable: true });
      await sleep(600);
      const twice = await shown(host);
      expect(twice.scripts).toBe(once.scripts);
      expect(twice.state).toBe('drawn');
      expect(twice.figures.every((f) => f.svg && !f.note)).toBe(true);
    } finally {
      await done();
    }
  }, 120_000);

  it("B5.7: the op is ignored in 'auto' and 'on-request' seeds and in a seed with Mermaid off: no script is inserted", async () => {
    const withMermaid = { ...assets, mermaid: mermaidText };
    const cases: [string, Partial<FrameOptions>][] = [
      ['auto', { mermaid: { draw: 'auto' }, assets: withMermaid }],
      ['on-request', { mermaid: { draw: 'on-request' }, assets: withMermaid }],
      ['off', {}],
    ];
    for (const [label, options] of cases) {
      await open();
      try {
        await mountLate(DIAGRAMS, options);
        if (label === 'auto') await waitFinal(host);
        const before = await shown(host);
        await host.send('main', mermaidOp(mermaidText));
        await sleep(800);
        const after = await shown(host);
        expect(after.scripts, label).toBe(before.scripts);
        expect(after.figures, label).toEqual(before.figures);
        expect(after.state, label).toBe(before.state);
        if (label === 'on-request') expect(after.figures.map((f) => [f.svg, f.button]), label).toEqual([[false, true], [false, true], [false, true]]);
        expect(host.errors, label).toEqual([]);
      } finally {
        await done();
      }
    }
  }, 240_000);

  it("B5.7 (instrumented: `holdSettled` keeps the frame unsettled; the op is posted in the same task as the hello): an op before settled is ignored; the one after ready still draws", async () => {
    await open({ holdSettled: true });
    try {
      const nonce = freshNonce();
      await host.mount(srcdocFor(assets, DIAGRAMS, nonce, LATE), frameCsp(), { early: [mermaidOp(mermaidText)] });
      // The frame is still booting: the early op reached its port (it is queued ahead of anything) and nothing was inserted.
      await sleep(300);
      expect(data(await host.record())).toEqual([]);
      const booting = await shown(host);
      expect(booting.scripts).toBe(4);
      expect(booting.figures.some((f) => f.svg)).toBe(false);
      expect(data(await host.waitMessages(1, 60_000))).toEqual([readyOf(nonce)]);
      const ready = await shown(host);
      expect(ready.scripts).toBe(4);
      expect({ state: ready.state, drawn: ready.figures.some((f) => f.svg) }).toEqual({ state: 'waiting', drawn: false });
      // The early op consumed nothing: the one after ready is accepted and draws.
      await host.send('main', mermaidOp(mermaidText));
      await waitFinal(host);
      const after = await shown(host);
      expect(after.state).toBe('drawn');
      expect(after.scripts).toBe(5);
    } finally {
      await done();
    }
  }, 120_000);
});
