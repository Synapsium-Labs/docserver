// The sealed reader frame in a real browser (docserver L3, Task 5; plan Reference §5 to §8; rows L3.B3 to L3.B11, and
// the prototype's rows P1 to P11 under the L3 ids they map to). The assets are built in memory by
// scripts/build-frame.mjs, frameDocument verifies them against the committed manifest, and the srcdoc mounts in a
// sandboxed iframe (`allow-scripts` only) of a parent page at https://docreader.test/ (frame-host-page.ts), under the
// hash-only policy frameCsp() builds. Every nonce is 128 bits fresh from crypto.getRandomValues.
//
// Release bytes only: no row reaches into the frame through anything the shipped scripts carry, and the headline rows
// run the frame's realm untouched (no init script). CSP violations are read from the parent's side, as the console
// messages of the page's frames (frame-host-page.ts); the frame's state is read through Playwright's frame handle.
// Every broken srcdoc is a valid frameDocument output broken by string surgery here, never through a path in src/: a
// policy with a hash removed or a directive added, a byte flipped, or a script replaced with its hash re-pinned in the
// meta (an enhance that rejects, a Mermaid without run). A planted document is html handed to frameDocument as it is
// (it never sanitises; the frame's vocabulary refuses it). The "before enhance" rows are guard-only srcdocs built here,
// with a guard-less twin as their control. Handlers that stop a link click are added from the parent through
// Playwright's frame access, never shipped. Clicks that must each cross the bridge are spaced past navigate's 250 ms
// coalescing window (the outbox, src/frame-runtime/outbox.ts).
//
// Measurements are printed as `frame-measure:` lines (time from insertion to ready, the materialisation of the largest
// corpus document, srcdoc lengths). The 2 MiB measurement row runs only with DOCREADER_MEASURE=1.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { buildFrame } from '../../scripts/build-frame.mjs';
import { DOC_FIELDS, frameCsp, frameDocument, FRAME_MANIFEST, type FrameAssets, type RenderInput } from '../../src/frame/index.js';
import { render } from '../../src/render/index.js';
import type { Frame } from 'playwright-core';
import { openFrameHost, type FrameHost, type HostRecord, type InitHow } from './frame-host-page.js';
import { browserFor, closeBrowsers, describeBrowsers, openDoc, ORIGIN, type BrowserName } from './harness.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
/** The opt-in measurement rows (the 2 MiB document): DOCREADER_MEASURE=1. */
const MEASURE = process.env['DOCREADER_MEASURE'] === '1';
const CORPUS = path.join(ROOT, 'conformance', 'corpus');

let assets: FrameAssets;
let mermaidText = '';

beforeAll(async () => {
  const built = await buildFrame();
  assets = { guard: built.files.guard.text, bootstrap: built.files.bootstrap.text, enhance: built.files.enhance.text, css: built.files.css.text };
  mermaidText = built.files.mermaid.text;
}, 120_000);

afterAll(closeBrowsers);

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

const PLAIN = (): string => readFileSync(path.join(CORPUS, 'headings.md'), 'utf8');

/** Every corpus document, by path. */
function corpusFiles(dir = CORPUS): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? corpusFiles(path.join(dir, e.name)) : e.name.endsWith('.md') ? [path.join(dir, e.name)] : [],
  );
}

/** The corpus document whose rendered html is longest. */
function largest(): { file: string; markdown: string; html: number } {
  let best = { file: '', markdown: '', html: -1 };
  for (const f of corpusFiles()) {
    const md = readFileSync(f, 'utf8');
    const r = render(md);
    if (r.outcome === 'rendered' && r.html.length > best.html) best = { file: path.relative(ROOT, f), markdown: md, html: r.html.length };
  }
  return best;
}

const srcdocOf = (markdown: string, nonce: string): string => frameDocument(input(markdown), { csp: frameCsp(), nonce, assets });

const data = (rec: HostRecord, port = 'main'): unknown[] => rec.messages.filter((m) => m.port === port).map((m) => m.data);

/** The frame's state, read through Playwright's frame handle. */
const frameState = (host: FrameHost): Promise<{ compat: string; root: string | null; rooted: boolean; origin: string }> =>
  host.frame().evaluate(() => {
    const root = document.body.querySelector(':scope > article');
    return {
      compat: document.compatMode,
      root: root === null ? null : root.localName,
      rooted: root !== null && root.hasAttribute('data-docreader-root'),
      origin: self.origin,
    };
  });

/** The console's Content Security Policy messages that match `directive`. */
const refusals = (host: FrameHost, directive: RegExp): string[] => host.cspConsole.filter((m) => directive.test(m));

/** `srcdoc` with its policy `good` (written once, in the meta) replaced by `bad`. */
function withPolicy(srcdoc: string, good: string, bad: string): string {
  expect(bad).not.toBe(good);
  expect(srcdoc.indexOf(good)).toBeGreaterThan(0);
  expect(srcdoc.indexOf(good, srcdoc.indexOf(good) + 1)).toBe(-1);
  return srcdoc.replace(good, bad);
}

/** A 1 by 1 GIF, for the guard fixture's image map (img-src allows data:). */
const GIF = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

/**
 * Click with `act`, then hold that the frame is still on its one load: a navigation shows as an assertion here, at the
 * click that caused it, rather than as a later click timing out on a document that is gone.
 */
async function stays(host: FrameHost, what: string, act: () => Promise<void>): Promise<void> {
  await act();
  await sleep(200);
  expect((await host.record()).loads, `the frame navigated after ${what}`).toHaveLength(1);
}

/** The link shapes every click row walks: absolute, relative and a fragment no element has. */
const LINKS = ['https://example.com/x', 'other.md', '#missing'];

/** Links whose click a handler added from the parent stops, each a different way. */
const STOPS = ['stop.md', 'stop-immediate.md', 'cancel-bubble.md'] as const;

/** Add, from the parent, a click handler on each STOPS link that stops the click without preventing it. */
const stopHandlers = (host: FrameHost, scope: string): Promise<void> =>
  host.frame().evaluate(
    ([sc, hs]) => {
      const at = (h: string): Element => {
        const a = document.querySelector(`${sc} a[href="${h}"]`);
        if (a === null) throw new Error(`no link ${h}`);
        return a;
      };
      at(hs[0]).addEventListener('click', (e) => e.stopPropagation());
      at(hs[1]).addEventListener('click', (e) => e.stopImmediatePropagation());
      at(hs[2]).addEventListener('click', (e) => {
        e.cancelBubble = true;
      });
    },
    [scope, STOPS] as const,
  );

function measure(label: string, browser: BrowserName, values: Record<string, unknown>): void {
  console.warn(`frame-measure: ${JSON.stringify({ label, browser, ...values })}`);
}

describeBrowsers((browser) => {
  let host: FrameHost;

  const open = async (how: InitHow = {}): Promise<FrameHost> => {
    host = await openFrameHost(await browserFor(browser), how);
    return host;
  };
  const done = async (): Promise<void> => {
    await host.close().catch(() => undefined);
  };

  /** Mount `srcdoc` under `policy` and expect exactly ready{v:1,nonce}, then error{why}. */
  const expectReadyThenError = async (srcdoc: string, policy: string, nonce: string, why: string, how: Parameters<FrameHost['mount']>[2] = 'auto'): Promise<HostRecord> => {
    await host.mount(srcdoc, policy, how);
    const rec = await host.waitMessages(2, 10_000);
    expect(data(rec)).toEqual([{ t: 'ready', v: 1, nonce }, { t: 'error', why }]);
    await sleep(300);
    const after = await host.record();
    expect(after.messages).toHaveLength(2);
    expect(after.loads).toHaveLength(1);
    if (after.closeSupported) expect(after.closes).toEqual(['main']);
    return after;
  };

  it('L3.B1 (P1): the plain corpus document readies with the nonce, one load, no violation, no request, no quirks, enhance ran', async () => {
    await open();
    try {
      const nonce = freshNonce();
      const srcdoc = srcdocOf(PLAIN(), nonce);
      await host.mount(srcdoc, frameCsp());
      const rec = await host.waitMessages(1, 10_000);
      const first = rec.messages[0];
      expect(first?.port).toBe('main');
      expect(first?.data).toEqual({ t: 'ready', v: 1, nonce });
      expect(Object.keys(first?.data as object)).toEqual(['t', 'v', 'nonce']);
      await sleep(400);
      const after = await host.record();
      expect(after.loads).toHaveLength(1);
      expect(after.messages).toHaveLength(1);
      expect(after.windowMessages).toEqual([]);
      expect(host.cspConsole).toEqual([]);
      expect(host.errors).toEqual([]);
      const state = await frameState(host);
      expect(state).toEqual({ compat: 'CSS1Compat', root: 'article', rooted: true, origin: 'null' });
      expect(host.requests.filter((r) => !r.main)).toEqual([]);
      expect(host.requests.map((r) => r.url)).toEqual([`${ORIGIN}/`]);
      measure('P1 plain', browser, { srcdocChars: srcdoc.length, readyMs: Math.round(first?.at ?? -1), loadMs: Math.round(after.loads[0] ?? -1) });
    } finally {
      await done();
    }
  });

  it('L3.B1 control (P2): a policy without the bootstrap hash gives no port message in 3 s', async () => {
    await open();
    try {
      const nonce = freshNonce();
      const good = frameCsp();
      const bad = good.replace(` ${FRAME_MANIFEST.bootstrap.csp}`, '');
      await host.mount(withPolicy(srcdocOf(PLAIN(), nonce), good, bad), bad);
      const rec = await host.waitMessages(1, 3000);
      expect(rec.messages).toEqual([]);
      expect(rec.loads).toHaveLength(1);
      // The parent's violation channel hears the refusal, so P1's zero is a measurement and not a deaf collector.
      expect(refusals(host, /script-src/)).not.toEqual([]);
      measure('P2', browser, { cspConsole: host.cspConsole.length });
    } finally {
      await done();
    }
  });

  /** The plain srcdoc with one byte of the enhance script flipped after verification. */
  const flippedEnhance = (nonce: string): string => {
    const srcdoc = srcdocOf(PLAIN(), nonce);
    const start = srcdoc.lastIndexOf('<script>') + '<script>'.length + 1000;
    const at = srcdoc.slice(start).search(/[a-y]/) + start;
    const flipped = srcdoc.slice(0, at) + String.fromCharCode(srcdoc.charCodeAt(at) + 1) + srcdoc.slice(at + 1);
    expect(flipped.length).toBe(srcdoc.length);
    return flipped;
  };

  it('L3.B5 (P3): an enhance byte flipped after verification gives ready, then error assets (and the close event, where the engine has one)', async () => {
    await open();
    try {
      const nonce = freshNonce();
      const after = await expectReadyThenError(flippedEnhance(nonce), frameCsp(), nonce, 'assets');
      expect(refusals(host, /script-src/)).not.toEqual([]);
      measure('P3', browser, { closeEventSupported: after.closeSupported, closes: after.closes, cspConsole: host.cspConsole.length });
    } finally {
      await done();
    }
  });

  it('L3.B5 (P3b, instrumented: a close counter wraps MessagePort.prototype.close before the bootstrap runs): the frame closes its port once', async () => {
    await open({ countCloses: true });
    try {
      const nonce = freshNonce();
      await expectReadyThenError(flippedEnhance(nonce), frameCsp(), nonce, 'assets');
      expect((await host.frameRecord()).closed).toBe(1);
    } finally {
      await done();
    }
  });

  it('L3.B4 (P4): hellos with no port, an extra key or two ports get no answer; the first valid one binds; a second gets nothing', async () => {
    await open();
    try {
      const nonce = freshNonce();
      await host.mount(srcdocOf(PLAIN(), nonce), frameCsp(), 'battery');
      const rec = await host.waitMessages(1, 10_000);
      expect(rec.messages[0]).toMatchObject({ port: 'main', data: { t: 'ready', v: 1, nonce } });
      await host.secondHello();
      await sleep(800);
      const after = await host.record();
      expect(after.messages.map((m) => m.port)).toEqual(['main']);
      expect(after.windowMessages).toEqual([]);
      expect(after.loads).toHaveLength(1);
    } finally {
      await done();
    }
  });

  it('L3.B5 (P4b): a hello with v:2 binds, and gets ready, then error protocol', async () => {
    await open();
    try {
      const nonce = freshNonce();
      await expectReadyThenError(srcdocOf(PLAIN(), nonce), frameCsp(), nonce, 'protocol', 'v2');
    } finally {
      await done();
    }
  });

  it('L3.B3 (P5): headings and anchors named after the handoff still ready with the right nonce', async () => {
    await open();
    try {
      const names = ['seed', 'bootstrap', 'currentScript', 'enhance', 'docserver', 'parent', 'body'];
      const md = names.map((n) => `# ${n}\n\n<!-- id:${n} -->\n\nText about ${n}.\n`).join('\n');
      const nonce = freshNonce();
      await host.mount(srcdocOf(md, nonce), frameCsp());
      const rec = await host.waitMessages(1, 10_000);
      expect(data(rec)).toEqual([{ t: 'ready', v: 1, nonce }]);
      // The clobbering is real: every name is an element id in the frame.
      const present = await host.frame().evaluate((ns) => ns.filter((n) => document.getElementById(n) !== null), names);
      expect(present).toEqual(names);
      expect(host.cspConsole).toEqual([]);
    } finally {
      await done();
    }
  });

  it('L3.B7 (P6) before enhance: the guard alone keeps every link shape from navigating, stopped clicks and submit included (its guard-less twin navigates on a plain click)', async () => {
    const fixture = [
      ...LINKS.map((h, i) => `<p><a href="${h}">link ${String(i)}</a></p>`),
      `<p><img src="${GIF}" width="40" height="40" usemap="#m" alt="map"><map name="m"><area shape="rect" coords="0,0,40,40" href="area.md" alt="area"></map></p>`,
      '<svg width="200" height="24"><a href="svg.md"><text x="0" y="16">svg link</text></a></svg>',
      '<svg width="200" height="24"><a xlink:href="svg-xlink.md"><text x="0" y="16">svg xlink</text></a></svg>',
      ...STOPS.map((h) => `<p><a href="${h}">${h}</a></p>`),
      '<form action="form.md"><button type="submit">send</button></form>',
    ].join('');
    const meta = `<meta http-equiv="Content-Security-Policy" content="${frameCsp()}">`;
    for (const guarded of [true, false]) {
      await open();
      try {
        await host.mount(`${meta}${guarded ? `<script>${assets.guard}</script>` : ''}${fixture}`, frameCsp(), 'none');
        await sleep(300);
        expect((await host.record()).loads).toHaveLength(1);
        const f = host.frame();
        if (guarded) {
          for (const h of LINKS) {
            await stays(host, h, () => f.locator(`a[href="${h}"]`).click());
            await stays(host, `${h} with Ctrl`, () => f.locator(`a[href="${h}"]`).click({ modifiers: ['Control'] }));
          }
          await stays(host, 'the area', () => f.locator('img[usemap]').click({ position: { x: 10, y: 10 } }));
          await stays(host, 'the SVG link', () => f.getByText('svg link').click());
          await stays(host, 'the SVG xlink', () => f.getByText('svg xlink').click());
          await stopHandlers(host, 'body');
          for (const h of STOPS) await stays(host, h, () => f.locator(`a[href="${h}"]`).click());
          // A sandbox without allow-forms never fires a real submit (the browser stops the submission first), so the
          // refuser is reached with a dispatched one: the guard's window capture listener prevents it before the form's
          // own listener sees it.
          const submit = await f.evaluate(() => {
            const form = document.querySelector('form');
            if (form === null) throw new Error('no form');
            let seen: boolean | null = null;
            form.addEventListener('submit', (e) => {
              seen = e.defaultPrevented;
            });
            const e = new Event('submit', { bubbles: true, cancelable: true });
            form.dispatchEvent(e);
            return { seen, prevented: e.defaultPrevented };
          });
          expect(submit).toEqual({ seen: true, prevented: true });
          await f.locator('form button').click();
          await sleep(500);
          expect((await host.record()).loads).toHaveLength(1);
          expect(host.requests.filter((r) => !r.main)).toEqual([]);
        } else {
          await f.locator('a[href="other.md"]').click({ noWaitAfter: true });
          const until = Date.now() + 5000;
          while ((await host.record()).loads.length < 2 && Date.now() < until) await sleep(50);
          expect((await host.record()).loads).toHaveLength(2);
        }
      } finally {
        await done();
      }
    }
  });

  it('L3.B7 (P6) after enhance, with Ctrl held and with the middle button: no second load, every link reaches navigate; stopped clicks and an in-document fragment do not', async () => {
    await open();
    try {
      const md = `# Links\n\n${LINKS.map((h, i) => `[link ${String(i)}](${h})`).join(' ')} [existing](#existing)\n\n${STOPS.map((h) => `[${h}](${h})`).join(' ')}\n\n## Existing\n\nThe end.\n`;
      const nonce = freshNonce();
      await host.mount(srcdocOf(md, nonce), frameCsp());
      const rec = await host.waitMessages(1, 10_000);
      expect(data(rec)).toEqual([{ t: 'ready', v: 1, nonce }]);
      const f = host.frame();
      // Each click waits out navigate's 250 ms coalescing window (the outbox, Reference §8.1), so each one crosses.
      const click = async (h: string, o: Parameters<ReturnType<Frame['locator']>['click']>[0] = {}): Promise<void> => {
        await stays(host, `${h} ${JSON.stringify(o)}`, () => f.locator(`article a[href="${h}"]`).click(o));
        await sleep(100);
      };
      for (const h of LINKS) await click(h);
      for (const h of LINKS) await click(h, { modifiers: ['Control'] });
      // The reader takes only the main button (src/enhance/nav.ts), so a middle click reaches navigate through the
      // guard's auxclick net and the bootstrap's docserver:link listener alone. An engine with no auxclick event sends
      // the middle button nothing to act on, and then nothing crosses (and nothing loads).
      const aux = await f.evaluate(() => 'onauxclick' in HTMLElement.prototype);
      for (const h of LINKS) await click(h, { button: 'middle' });
      await f.locator('article a[href="#existing"]:not([data-docreader-chrome])').click();
      await sleep(300);
      // The reader handled the in-document link itself: it went there, and only its hash crossed the bridge.
      expect(await f.evaluate(() => document.activeElement?.id ?? null)).toBe('existing');
      await stopHandlers(host, 'article');
      for (const h of STOPS) await click(h);
      await sleep(600);
      const after = await host.record();
      expect(after.loads).toHaveLength(1);
      expect(data(after).slice(1).filter((m) => (m as { t: string }).t !== 'hash')).toEqual(
        [...LINKS, ...LINKS, ...(aux ? LINKS : [])].map((href) => ({ t: 'navigate', href })),
      );
      expect(opsOf(after, ['hash'])).toEqual([{ t: 'hash', id: 'existing' }]);
      expect(host.requests.filter((r) => !r.main)).toEqual([]);
      expect(host.cspConsole).toEqual([]);
      measure('P6 middle button', browser, { auxclick: aux });
    } finally {
      await done();
    }
  });

  it('L3.B7 (P6) other buttons: a right click and auxclicks of buttons 2, 3 and 4 on a link send nothing; button 1 on the same path sends navigate', async () => {
    await open();
    try {
      const md = `# Links\n\n${LINKS.map((h, i) => `[link ${String(i)}](${h})`).join(' ')}\n`;
      const nonce = freshNonce();
      await host.mount(srcdocOf(md, nonce), frameCsp());
      expect(data(await host.waitMessages(1, 10_000))).toEqual([{ t: 'ready', v: 1, nonce }]);
      const f = host.frame();
      // The frame's document as the test sees it: a right click must leave it in place, one load, links intact.
      const state = (): Promise<Record<string, unknown>> =>
        host.frame().evaluate(() => ({
          url: document.URL,
          ready: document.readyState,
          article: document.querySelector('article') !== null,
          links: document.querySelectorAll('a[href]').length,
          other: document.querySelector('article a[href="other.md"]') !== null,
        }));
      const before = await state();
      // Each dispatch must find its link, so the "send nothing" half cannot pass by finding nothing.
      const auxclick = (buttons: readonly number[]): Promise<boolean> =>
        f.evaluate((bs) => {
          const a = document.querySelector('article a[href="other.md"]');
          for (const button of bs) a?.dispatchEvent(new MouseEvent('auxclick', { bubbles: true, cancelable: true, composed: true, button }));
          return a !== null;
        }, buttons);
      await f.locator('article a[href="https://example.com/x"]').click({ button: 'right' });
      await sleep(400);
      const afterRight = await state();
      const right = await host.record();
      expect(
        { loads: right.loads.length, sameFrame: host.frame() === f, ...afterRight },
        JSON.stringify({ before, afterRight, messages: data(right) }),
      ).toMatchObject({ loads: 1, sameFrame: true, article: true, other: true });
      expect(await auxclick([2, 3, 4])).toBe(true);
      await sleep(400);
      // Nothing crosses, and the frame stays where it is: WebKit follows a link in place on an auxclick of any button
      // but the right one, so a guard that left those alone would lose the frame here (measured on CI, run
      // 40364156288: the link was gone after these three).
      const aux = await host.record();
      expect(data(aux).slice(1)).toEqual([]);
      expect({ loads: aux.loads.length, ...(await state()) }, JSON.stringify(await state())).toMatchObject({ loads: 1, article: true, other: true });
      // What the engine did with the middle button's auxclick, observed from the test side only (the shipped scripts
      // are untouched): whether the link was found, the dispatch's return value, and what a window bubble listener
      // added after the guard's net and a listener on the guard's element saw.
      const seen = await f.evaluate(() => {
        const a = document.querySelector('article a[href="other.md"]');
        const out: Record<string, unknown> = { found: a !== null, inChrome: a?.closest('[data-docreader-chrome]') != null };
        const guardEl = document.head.querySelector('script');
        const onWin = (e: Event): void => { out['atWindow'] = true; out['preventedAtWindow'] = e.defaultPrevented; };
        const onLink = (e: Event): void => { out['link'] = (e as CustomEvent).detail; };
        window.addEventListener('auxclick', onWin, false);
        guardEl?.addEventListener('docserver:link', onLink);
        out['notCanceled'] = a?.dispatchEvent(new MouseEvent('auxclick', { bubbles: true, cancelable: true, composed: true, button: 1 }));
        window.removeEventListener('auxclick', onWin, false);
        guardEl?.removeEventListener('docserver:link', onLink);
        return out;
      });
      await sleep(400);
      const after = await host.record();
      expect(data(after).slice(1), JSON.stringify(seen)).toEqual([{ t: 'navigate', href: 'other.md' }]);
      expect(after.loads).toHaveLength(1);
    } finally {
      await done();
    }
  });

  it('L3.HB6 guard half (P8): a policy that blocks the guard alone gives ready, then error boot (self-check (d): the guard ran)', async () => {
    await open();
    try {
      const nonce = freshNonce();
      const good = frameCsp();
      const bad = good.replace(` ${FRAME_MANIFEST.guard.csp}`, '');
      await expectReadyThenError(withPolicy(srcdocOf(PLAIN(), nonce), good, bad), bad, nonce, 'boot');
      expect(refusals(host, /script-src/)).not.toEqual([]);
    } finally {
      await done();
    }
  });

  it('L3.HB7 (P9): a policy that blocks the inline style gives ready, then error boot (the securitypolicyviolation listener)', async () => {
    await open();
    try {
      const nonce = freshNonce();
      const good = frameCsp();
      const bad = good.replace("style-src 'unsafe-inline' data:", 'style-src data:');
      await expectReadyThenError(withPolicy(srcdocOf(PLAIN(), nonce), good, bad), bad, nonce, 'boot');
      expect(refusals(host, /style-src/)).not.toEqual([]);
    } finally {
      await done();
    }
  });

  // Measured: dropping the face probe leaves both rows green, because the reader's own font wait
  // (src/enhance/relayout.ts, through env.fonts) already asks for the regular faces before ready, even for an empty
  // document. The probe is the frame's guarantee that does not depend on that (it also loads the italic faces); no
  // row here can tell it apart today.
  for (const [name, md] of [['the plain document', PLAIN], ['an empty document', (): string => '']] as const) {
    it(`L3.HB7 (P10): a policy that blocks the data: fonts gives ready, then error boot, for ${name} (the face probe and the violation listener)`, async () => {
      await open();
      try {
        const nonce = freshNonce();
        const good = frameCsp();
        const bad = good.replace('font-src data:; ', '');
        await expectReadyThenError(withPolicy(srcdocOf(md(), nonce), good, bad), bad, nonce, 'boot');
        expect(refusals(host, /font/)).not.toEqual([]);
      } finally {
        await done();
      }
    });
  }

  for (const sandbox of [null, 'allow-scripts allow-same-origin'] as const) {
    it(`L3.B9 (P11): mounted with ${sandbox === null ? 'no sandbox attribute' : `sandbox="${sandbox}"`}, the frame gives ready, then error boot (self-check (a): an opaque origin)`, async () => {
      await open();
      try {
        const nonce = freshNonce();
        await expectReadyThenError(srcdocOf(PLAIN(), nonce), frameCsp(), nonce, 'boot', { sandbox });
      } finally {
        await done();
      }
    });
  }

  it('measures: the largest corpus document, from insertion to ready and from DOMContentLoaded to the root', async () => {
    await open({ measure: true });
    try {
      const big = largest();
      const nonce = freshNonce();
      const srcdoc = srcdocOf(big.markdown, nonce);
      await host.mount(srcdoc, frameCsp());
      const rec = await host.waitMessages(1, 20_000);
      expect(data(rec)).toEqual([{ t: 'ready', v: 1, nonce }]);
      const fr = await host.frameRecord();
      expect(fr.dcl).not.toBeNull();
      expect(fr.root).not.toBeNull();
      measure('largest corpus document', browser, {
        file: big.file,
        htmlChars: big.html,
        srcdocChars: srcdoc.length,
        readyMs: Math.round(rec.messages[0]?.at ?? -1),
        materialiseMs: Number(((fr.root ?? 0) - (fr.dcl ?? 0)).toFixed(2)),
        insertionToDclMs: Math.round(fr.origin + (fr.dcl ?? 0) - rec.insertedAt),
        rootToReadyMs: Math.round(rec.insertedAt + (rec.messages[0]?.at ?? 0) - (fr.origin + (fr.root ?? 0))),
      });
    } finally {
      await done();
    }
  });

  it.skipIf(!MEASURE)('measures (DOCREADER_MEASURE=1): a 2 MiB document built from the non-hostile corpus, from insertion to ready and DOMContentLoaded to the root', async () => {
    await open({ measure: true });
    try {
      const parts = corpusFiles()
        .filter((f) => !path.relative(CORPUS, f).split(path.sep).some((s) => s.startsWith('h-')))
        // lists-tasks.md ends inside a list nested past the limit, which takes in everything after it.
        .filter((f) => path.basename(f) !== 'lists-tasks.md')
        .map((f) => readFileSync(f, 'utf8').replace(/^---[\s\S]*?\n---\n/, ''));
      let md = '';
      for (let i = 0; md.length < 2 * 1024 * 1024; i++) md += `\n\n${parts[i % parts.length] ?? ''}`;
      const nonce = freshNonce();
      const t0 = performance.now();
      const srcdoc = srcdocOf(md, nonce);
      const buildMs = performance.now() - t0;
      await host.mount(srcdoc, frameCsp());
      const rec = await host.waitMessages(1, 120_000);
      expect(data(rec)).toEqual([{ t: 'ready', v: 1, nonce }]);
      const fr = await host.frameRecord();
      measure('2 MiB synthetic document', browser, {
        markdownChars: md.length,
        srcdocChars: srcdoc.length,
        renderAndFrameDocumentMs: Math.round(buildMs),
        readyMs: Math.round(rec.messages[0]?.at ?? -1),
        materialiseMs: Number(((fr.root ?? 0) - (fr.dcl ?? 0)).toFixed(2)),
        insertionToDclMs: Math.round(fr.origin + (fr.dcl ?? 0) - rec.insertedAt),
        rootToReadyMs: Math.round(rec.insertedAt + (rec.messages[0]?.at ?? 0) - (fr.origin + (fr.root ?? 0))),
        cspConsole: host.cspConsole.length,
      });
      // The same document enhanced in an ordinary page (the layout harness), for comparison: the frame's share of the
      // time is what the two differ by.
      const page = await openDoc(md, {}, { browser, enhance: false, csp: 'reader' });
      try {
        const t1 = performance.now();
        await page.enhance();
        measure('2 MiB synthetic document, ordinary page', browser, { enhanceMs: Math.round(performance.now() - t1) });
      } finally {
        await page.close();
      }
    } finally {
      await done();
    }
  }, 240_000);
});

/** P7's document: one flowchart, one sequence diagram and one gantt. */
const DIAGRAMS = `# Diagrams

\`\`\`mermaid
flowchart LR
  A[Start] --> B{Choice}
  B -->|yes| C[Done]
  B -->|no| A
\`\`\`
*Figure 1. A flowchart.*

\`\`\`mermaid
sequenceDiagram
  participant P as Parent
  participant F as Frame
  P->>F: hello
  F-->>P: ready
\`\`\`
*Figure 2. A sequence.*

\`\`\`mermaid
gantt
  title Plan
  dateFormat YYYY-MM-DD
  section Build
  First :a1, 2026-01-05, 3d
  Second :after a1, 2d
\`\`\`
*Figure 3. A gantt.*
`;

/** The reader's final drawing states (L2's `data-docreader-diagrams` once it leaves `drawing`). */
const SETTLED_DIAGRAMS: readonly (string | null)[] = ['drawn', 'partial', 'failed'];

/**
 * The reader's drawing state at the instant the frame posted ready, from the `diagramsAtReady` record (frame-host-page.ts):
 * read in the frame's realm at the post, so it does not depend on when the parent's port or an observer runs. Exactly one
 * ready was posted, and the state then was already final.
 */
function expectSettledAtReady(ready: readonly { readonly state: string | null }[]): string | null {
  expect(ready).toHaveLength(1);
  const state = ready[0]?.state ?? null;
  expect(SETTLED_DIAGRAMS, `the diagrams state when the frame posted ready was ${String(state)}`).toContain(state);
  return state;
}

describeBrowsers((browser) => {
  it('L3.B6 (P7): Mermaid as a classic IIFE draws a flowchart, a sequence and a gantt under the hash-only policy; ready waits for it', async () => {
    const host = await openFrameHost(await browserFor(browser), { observeDiagrams: true, diagramsAtReady: true });
    try {
      const policy = frameCsp();
      expect(policy).not.toContain('unsafe-eval');
      expect(policy).toContain(FRAME_MANIFEST.mermaid.csp);
      const nonce = freshNonce();
      const srcdoc = frameDocument(input(DIAGRAMS), { csp: policy, nonce, assets: { ...assets, mermaid: mermaidText }, mermaid: {} });
      await host.mount(srcdoc, policy);
      const rec = await host.waitMessages(1, 60_000);
      await sleep(200);
      const fr = await host.frameRecord();
      expect({ messages: data(await host.record()), violations: host.cspConsole, errors: host.errors }).toEqual({
        messages: [{ t: 'ready', v: 1, nonce }],
        violations: [],
        errors: [],
      });
      const drawn = await host.frame().evaluate(() => {
        const root = document.body.querySelector(':scope > article');
        return {
          state: root?.getAttribute('data-docreader-diagrams') ?? null,
          figures: Array.from(document.querySelectorAll('figure.mermaid-figure'), (f) => f.querySelector('svg') !== null),
          kinds: Array.from(document.querySelectorAll('figure.mermaid-figure svg'), (s) => s.getAttribute('aria-roledescription')),
        };
      });
      expect(drawn.state).toBe('drawn');
      expect(drawn.figures).toEqual([true, true, true]);
      // When the frame posted ready, the reader's state was already final: the one it still holds.
      expect(expectSettledAtReady(fr.ready)).toBe(drawn.state);
      // Ready came after the diagrams left `drawing`.
      const left = fr.diagrams.find((d) => d.state !== 'drawing');
      expect(fr.diagrams[0]?.state).toBe('drawing');
      expect(left).toBeDefined();
      const readyAt = rec.insertedAt + (rec.messages[0]?.at ?? 0);
      expect(readyAt).toBeGreaterThanOrEqual(fr.origin + (left?.at ?? Infinity));
      expect((await host.record()).loads).toHaveLength(1);
      expect(host.requests.filter((r) => !r.main)).toEqual([]);
      measure('P7 Mermaid', browser, { mermaidBytes: Buffer.byteLength(mermaidText), srcdocChars: srcdoc.length, readyMs: Math.round(rec.messages[0]?.at ?? -1), kinds: drawn.kinds });
    } finally {
      await host.close();
    }
  }, 120_000);

  it('L3.B6b (P7): a policy that blocks the Mermaid script gives ready, then error mermaid (default Q3)', async () => {
    const host = await openFrameHost(await browserFor(browser));
    try {
      const good = frameCsp();
      const bad = good.replace(` ${FRAME_MANIFEST.mermaid.csp}`, '');
      const nonce = freshNonce();
      const srcdoc = frameDocument(input(DIAGRAMS), { csp: good, nonce, assets: { ...assets, mermaid: mermaidText }, mermaid: {} });
      await host.mount(withPolicy(srcdoc, good, bad), bad);
      const rec = await host.waitMessages(2, 30_000);
      expect(data(rec)).toEqual([{ t: 'ready', v: 1, nonce }, { t: 'error', why: 'mermaid' }]);
      expect(refusals(host, /script-src/)).not.toEqual([]);
      expect((await host.record()).loads).toHaveLength(1);
    } finally {
      await host.close();
    }
  }, 120_000);
});

/** The CSP hash source of a script's exact text. */
const hashOf = (text: string): string => `'sha256-${createHash('sha256').update(text, 'utf8').digest('base64')}'`;

/**
 * `srcdoc` (a valid frameDocument output under `policy`) with the script `which` replaced by `text`, its hash re-pinned
 * in the meta: answers the new srcdoc and the policy that goes with it. Enhance is the script right after the style;
 * Mermaid the last one.
 */
function replaceScript(srcdoc: string, policy: string, which: 'enhance' | 'mermaid', text: string): { srcdoc: string; policy: string } {
  const open = which === 'enhance' ? srcdoc.indexOf('</style><script>') + '</style><script>'.length : srcdoc.lastIndexOf('<script>') + '<script>'.length;
  const close = srcdoc.indexOf('</script>', open);
  expect(open).toBeGreaterThan('<script>'.length);
  expect(close).toBeGreaterThan(open);
  const old = srcdoc.slice(open, close);
  expect(hashOf(old)).toBe(FRAME_MANIFEST[which].csp);
  const next = policy.replace(FRAME_MANIFEST[which].csp, hashOf(text));
  return { srcdoc: withPolicy(srcdoc.slice(0, open) + text + srcdoc.slice(close), policy, next), policy: next };
}

/** A script that registers `api` under `name` on its own element, as the shipped scripts do. */
const registering = (name: string, api: string): string =>
  `document.currentScript.dispatchEvent(new CustomEvent('docserver:register',{bubbles:true,detail:Object.freeze({name:'${name}',api:Object.freeze(${api})})}));\n`;

/** Wait until the frame's content root is enhanced (or `ms` pass). */
const rooted = async (host: FrameHost, ms = 10_000): Promise<boolean> => {
  const until = Date.now() + ms;
  for (;;) {
    const ok = await host.frame().evaluate(() => document.body.querySelector(':scope > article[data-docreader-root]') !== null).catch(() => false);
    if (ok || Date.now() >= until) return ok;
    await sleep(50);
  }
};

/** The ops of `rec` on `port` after its ready, of the given kinds. */
const opsOf = (rec: HostRecord, kinds: readonly string[], port = 'main'): unknown[] => data(rec, port).filter((m) => kinds.includes((m as { t: string }).t));

/** The golden and hostile corpus documents (the generated inputs are the unit half's, test/frame-runtime.test.ts). */
function corpusDocuments(): { id: string; markdown: string }[] {
  const manifest = JSON.parse(readFileSync(path.join(ROOT, 'conformance', 'manifest.json'), 'utf8')) as { id: string; kind: string }[];
  return manifest.filter((e) => e.kind !== 'generated').map((e) => ({ id: e.id, markdown: readFileSync(path.join(CORPUS, `${e.id}.md`), 'utf8') }));
}

describeBrowsers((browser) => {
  let host: FrameHost;
  const open = async (how: InitHow = {}): Promise<FrameHost> => {
    host = await openFrameHost(await browserFor(browser), how);
    return host;
  };
  const done = async (): Promise<void> => {
    await host.close().catch(() => undefined);
  };
  const mermaidOn = (md: string, nonce: string): string => frameDocument(input(md), { csp: frameCsp(), nonce, assets: { ...assets, mermaid: mermaidText }, mermaid: {} });

  /** The text each drawn figure's SVG shows (its labels; not its style element, whose selectors name a fresh id), in order. */
  const svgTexts = (h: FrameHost): Promise<string[]> =>
    h.frame().evaluate(() =>
      Array.from(document.querySelectorAll('figure.mermaid-figure svg'), (svg) => {
        const out: string[] = [];
        const walk = document.createTreeWalker(svg, NodeFilter.SHOW_TEXT);
        for (let n = walk.nextNode(); n !== null; n = walk.nextNode()) if (n.parentElement?.closest('style') === null) out.push(n.nodeValue ?? '');
        return out.join('|');
      }),
    );

  const CLOBBER = ['currentScript', 'body', 'parent', 'seed', 'bootstrap', 'docserver', 'docreader', 'enhance', 'mermaid', 'addEventListener', 'dispatchEvent', 'toString', 'JSON', 'DOMParser', 'CustomEvent', 'Symbol', '__proto__'];

  it('L3.B3: headings and anchors named after the handoff, the globals and the scripts: ready with the right nonce, every diagram kind draws as in the clean document, links route', async () => {
    await open();
    let clean: string[];
    try {
      const nonce = freshNonce();
      await host.mount(mermaidOn(DIAGRAMS, nonce), frameCsp());
      expect(data(await host.waitMessages(1, 60_000))).toEqual([{ t: 'ready', v: 1, nonce }]);
      clean = await svgTexts(host);
      expect(clean).toHaveLength(3);
    } finally {
      await done();
    }
    await open();
    try {
      const nonce = freshNonce();
      const md = `${CLOBBER.map((n) => `## ${n}\n\n<!-- id:${n} -->\n\nText about ${n}, [a link](other-${n.replace(/_/g, 'u')}.md).\n`).join('\n')}\n${DIAGRAMS}`;
      await host.mount(mermaidOn(md, nonce), frameCsp());
      const rec = await host.waitMessages(1, 60_000);
      await sleep(300);
      expect({ messages: data(await host.record()), violations: host.cspConsole, errors: host.errors }).toEqual({ messages: [{ t: 'ready', v: 1, nonce }], violations: [], errors: [] });
      expect(rec.messages[0]?.data).toEqual({ t: 'ready', v: 1, nonce });
      // The clobbering is real: every name is an element id in the frame.
      const present = await host.frame().evaluate((ns) => ns.filter((n) => document.getElementById(n) !== null), CLOBBER);
      expect(present).toEqual(CLOBBER);
      expect(await svgTexts(host)).toEqual(clean);
      await host.frame().locator('article a[href="other-seed.md"]').click();
      await sleep(400);
      expect(opsOf(await host.record(), ['navigate'])).toEqual([{ t: 'navigate', href: 'other-seed.md' }]);
      expect((await host.record()).loads).toHaveLength(1);
    } finally {
      await done();
    }
  }, 180_000);

  it('L3.B3 (instrumented: `measure` wraps appendChild before the bootstrap captures it, to time the root): no authored node exists while a script evaluates, the root is appended at DOMContentLoaded', async () => {
    await open({ measure: true });
    try {
      const nonce = freshNonce();
      await host.mount(mermaidOn(DIAGRAMS, nonce), frameCsp());
      expect(data(await host.waitMessages(1, 60_000))).toEqual([{ t: 'ready', v: 1, nonce }]);
      const fr = await host.frameRecord();
      expect(fr.dcl).not.toBeNull();
      expect(fr.root).not.toBeNull();
      expect(fr.root as number).toBeGreaterThanOrEqual(fr.dcl as number);
    } finally {
      await done();
    }
  }, 120_000);

  it('L3.B3: registration is by position: with enhance blocked, an impostor at the Mermaid position that registers as enhance is refused (ready, then error assets)', async () => {
    await open();
    try {
      const nonce = freshNonce();
      const good = frameCsp();
      const impostor = replaceScript(mermaidOn(PLAIN(), nonce), good, 'mermaid', registering('enhance', '{enhance:()=>Promise.resolve(),destroyEnhancement(){},setEnhancementPrefs(){}}'));
      const blocked = impostor.policy.replace(` ${FRAME_MANIFEST.enhance.csp}`, '');
      await host.mount(withPolicy(impostor.srcdoc, impostor.policy, blocked), blocked);
      const rec = await host.waitMessages(2, 10_000);
      expect(data(rec)).toEqual([{ t: 'ready', v: 1, nonce }, { t: 'error', why: 'assets' }]);
    } finally {
      await done();
    }
  });

  it('L3.B4: a hello the frame posts to itself, with a port, binds nothing: the parent\'s first valid hello binds afterwards', async () => {
    await open();
    try {
      const nonce = freshNonce();
      await host.mount(srcdocOf(PLAIN(), nonce), frameCsp(), 'none');
      expect(await rooted(host)).toBe(true);
      const self = await host.frame().evaluate(async () => {
        const ch = new MessageChannel();
        const got: unknown[] = [];
        ch.port1.onmessage = (e): void => {
          got.push(e.data);
        };
        window.postMessage({ t: 'hello', v: 1 }, '*', [ch.port2]);
        await new Promise((r) => setTimeout(r, 400));
        return got;
      });
      expect(self).toEqual([]);
      await host.secondHello();
      const rec = await host.waitMessages(1, 5000);
      expect(rec.messages.map((m) => [m.port, m.data])).toEqual([['second', { t: 'ready', v: 1, nonce }]]);
    } finally {
      await done();
    }
  });

  it('L3.B5: ops the reader made before hello cross after ready, in order: ready first, then the navigate, then the hash', async () => {
    await open();
    try {
      const nonce = freshNonce();
      const md = '# Ops\n\n[away](away.md) [existing](#existing)\n\n## Existing\n\nThe end.\n';
      await host.mount(srcdocOf(md, nonce), frameCsp(), 'none');
      expect(await rooted(host)).toBe(true);
      const f = host.frame();
      await f.locator('article a[href="away.md"]').click();
      await f.locator('article a[href="#existing"]:not([data-docreader-chrome])').click();
      await sleep(300);
      expect((await host.record()).messages).toEqual([]);
      await host.secondHello();
      await host.waitMessages(3, 5000);
      await sleep(300);
      const got = data(await host.record(), 'second');
      expect(got[0]).toEqual({ t: 'ready', v: 1, nonce });
      expect(got.slice(1).filter((m) => ['navigate', 'hash'].includes((m as { t: string }).t))).toEqual([
        { t: 'navigate', href: 'away.md' },
        { t: 'hash', id: 'existing' },
      ]);
    } finally {
      await done();
    }
  });

  it('L3.M12 (instrumented: `stepWallClock` wraps Date.now before the bootstrap runs, to step the wall clock): the pacer reads a monotonic clock, so a wall clock stepped back an hour after a send stalls nothing', async () => {
    await open({ stepWallClock: true });
    try {
      const nonce = freshNonce();
      // More links than the pacer's 12 ops that are not copies: on a clock that ran backwards, a pacer that kept the
      // send time from before the step would hold the 12th for the hour.
      const hrefs = Array.from({ length: 15 }, (_, i) => `n${String(i)}.md`);
      await host.mount(srcdocOf(`# Clock\n\n${hrefs.map((h) => `[${h}](${h})`).join(' ')}\n`, nonce), frameCsp());
      expect(data(await host.waitMessages(1, 10_000))).toEqual([{ t: 'ready', v: 1, nonce }]);
      const f = host.frame();
      // Each click waits out navigate's 250 ms coalescing window, so each one crosses on its own.
      const click = async (h: string): Promise<void> => {
        await stays(host, h, () => f.locator(`article a[href="${h}"]`).click());
        await sleep(100);
      };
      await click(hrefs[0] ?? '');
      await f.evaluate(() => {
        const r = (window as unknown as Record<symbol, { wallOffset: number } | undefined>)[Symbol.for('frame-test.record')];
        if (r === undefined) throw new Error('no frame record');
        r.wallOffset = -3_600_000;
      });
      for (const h of hrefs.slice(1)) await click(h);
      await sleep(400);
      expect(opsOf(await host.record(), ['navigate'])).toEqual(hrefs.map((href) => ({ t: 'navigate', href })));
      expect(host.errors).toEqual([]);
    } finally {
      await done();
    }
  });

  it('L3.B6 (instrumented: `observeDiagrams` times the attribute, `diagramsAtReady` reads it at the ready post): with a set that takes longer to draw than the face probe, ready still comes only once the attribute is final', async () => {
    await open({ observeDiagrams: true, diagramsAtReady: true });
    try {
      const nonce = freshNonce();
      const chart = (k: number): string =>
        `\`\`\`mermaid\nflowchart TD\n${Array.from({ length: 40 }, (_, i) => `  n${String(k)}x${String(i)}[Step ${String(i)} of chart ${String(k)}] --> n${String(k)}x${String(i + 1)}`).join('\n')}\n\`\`\`\n*Figure ${String(k + 1)}. Chart ${String(k + 1)}.*\n`;
      const md = `# Slow\n\n${Array.from({ length: 16 }, (_, k) => chart(k)).join('\n')}`;
      await host.mount(mermaidOn(md, nonce), frameCsp());
      const rec = await host.waitMessages(1, 90_000);
      expect(data(rec)).toEqual([{ t: 'ready', v: 1, nonce }]);
      const fr = await host.frameRecord();
      const left = fr.diagrams.find((d) => d.state !== 'drawing');
      expect(fr.diagrams[0]?.state).toBe('drawing');
      expect(left?.state).toBe('drawn');
      expect(expectSettledAtReady(fr.ready)).toBe('drawn');
      const readyAt = rec.insertedAt + (rec.messages[0]?.at ?? 0);
      expect(readyAt).toBeGreaterThanOrEqual(fr.origin + (left?.at ?? Infinity));
      measure('L3.B6 slow set', browser, { drawMs: Math.round((left?.at ?? 0) - (fr.diagrams[0]?.at ?? 0)), readyMs: Math.round(rec.messages[0]?.at ?? -1) });
    } finally {
      await done();
    }
  }, 180_000);

  it('L3.B6: a Mermaid set that fails to draw still gives ready and no error, the attribute final', async () => {
    await open();
    try {
      const nonce = freshNonce();
      const md = '# Broken\n\n```mermaid\nflowchart LR\n  A --> ((( \n```\n*Figure 1. Broken.*\n';
      await host.mount(mermaidOn(md, nonce), frameCsp());
      expect(data(await host.waitMessages(1, 60_000))).toEqual([{ t: 'ready', v: 1, nonce }]);
      await sleep(300);
      expect(data(await host.record())).toEqual([{ t: 'ready', v: 1, nonce }]);
      expect(await host.frame().evaluate(() => document.body.querySelector(':scope > article')?.getAttribute('data-docreader-diagrams') ?? null)).toBe('failed');
    } finally {
      await done();
    }
  }, 120_000);

  for (const [name, withMermaid] of [['Mermaid on and no figure to draw', true], ['Mermaid off (mermaid: null) with figures', false]] as const) {
    it(`L3.B6: ${name} gives ready with no diagrams attribute and no wait`, async () => {
      await open();
      try {
        const nonce = freshNonce();
        const srcdoc = withMermaid ? mermaidOn(PLAIN(), nonce) : srcdocOf(DIAGRAMS, nonce);
        await host.mount(srcdoc, frameCsp());
        const rec = await host.waitMessages(1, 30_000);
        expect(data(rec)).toEqual([{ t: 'ready', v: 1, nonce }]);
        expect(await host.frame().evaluate(() => document.body.querySelector(':scope > article')?.hasAttribute('data-docreader-diagrams') ?? null)).toBe(false);
      } finally {
        await done();
      }
    }, 120_000);
  }

  it('L3.B6b: a Mermaid script replaced by one that registers an API without run (its hash re-pinned) gives ready, then error mermaid', async () => {
    await open();
    try {
      const nonce = freshNonce();
      const fake = replaceScript(mermaidOn(DIAGRAMS, nonce), frameCsp(), 'mermaid', registering('mermaid', '{initialize(){}}'));
      await host.mount(fake.srcdoc, fake.policy);
      const rec = await host.waitMessages(2, 30_000);
      expect(data(rec)).toEqual([{ t: 'ready', v: 1, nonce }, { t: 'error', why: 'mermaid' }]);
      expect(host.cspConsole).toEqual([]);
      expect((await host.record()).loads).toHaveLength(1);
    } finally {
      await done();
    }
  }, 120_000);

  it('L3.B7: protocol-relative, target=_blank, area and SVG links, before enhance, keep the frame on its one load', async () => {
    const fixture = [
      '<p><a href="//example.com/p">protocol-relative</a></p>',
      '<p><a href="blank.md" target="_blank">blank</a></p>',
      `<p><img src="${GIF}" width="40" height="40" usemap="#m" alt="map"><map name="m"><area shape="rect" coords="0,0,40,40" href="area.md" target="_blank" alt="area"></map></p>`,
    ].join('');
    const meta = `<meta http-equiv="Content-Security-Policy" content="${frameCsp()}">`;
    await open();
    try {
      await host.mount(`${meta}<script>${assets.guard}</script>${fixture}`, frameCsp(), 'none');
      await sleep(300);
      const f = host.frame();
      await stays(host, 'the protocol-relative link', () => f.locator('a[href="//example.com/p"]').click());
      await stays(host, 'the target=_blank link', () => f.locator('a[href="blank.md"]').click());
      await stays(host, 'the target=_blank link, middle button', () => f.locator('a[href="blank.md"]').click({ button: 'middle' }));
      await stays(host, 'the target=_blank area', () => f.locator('img[usemap]').click({ position: { x: 10, y: 10 } }));
      await sleep(500);
      expect((await host.record()).loads).toHaveLength(1);
      expect(host.requests.filter((r) => !r.main)).toEqual([]);
      expect(host.page.context().pages()).toHaveLength(1);
    } finally {
      await done();
    }
  });

  it('L3.B7: after enhance, a protocol-relative link and the missing-image chip reach navigate; no second load', async () => {
    await open();
    try {
      const nonce = freshNonce();
      await host.mount(srcdocOf('# Links\n\n[pr](//example.com/p)\n\n![a picture](missing.png)\n', nonce), frameCsp());
      expect(data(await host.waitMessages(1, 10_000))).toEqual([{ t: 'ready', v: 1, nonce }]);
      const f = host.frame();
      await stays(host, 'the protocol-relative link', () => f.locator('article a[href="//example.com/p"]').click());
      await sleep(300);
      await stays(host, "the chip's link", () => f.locator('article .ds-img-missing a').click());
      await sleep(200);
      expect(opsOf(await host.record(), ['navigate'])).toEqual(['//example.com/p', 'missing.png'].map((href) => ({ t: 'navigate', href })));
    } finally {
      await done();
    }
  });

  it('L3.B7: after a failed enhance (an enhance that rejects, its hash re-pinned) the content keeps its links from navigating, and nothing crosses after the error', async () => {
    await open();
    try {
      const nonce = freshNonce();
      const bad = replaceScript(
        srcdocOf(`# Links\n\n${LINKS.map((h, i) => `[link ${String(i)}](${h})`).join(' ')}\n`, nonce),
        frameCsp(),
        'enhance',
        registering('enhance', "{enhance:()=>Promise.reject(new Error('refused')),destroyEnhancement(){},setEnhancementPrefs(){}}"),
      );
      await host.mount(bad.srcdoc, bad.policy);
      expect(data(await host.waitMessages(2, 10_000))).toEqual([{ t: 'ready', v: 1, nonce }, { t: 'error', why: 'render' }]);
      const f = host.frame();
      for (const h of LINKS) {
        await stays(host, h, () => f.locator(`article a[href="${h}"]`).click());
        await stays(host, `${h}, middle button`, () => f.locator(`article a[href="${h}"]`).click({ button: 'middle' }));
      }
      await sleep(500);
      const after = await host.record();
      expect(after.loads).toHaveLength(1);
      expect(after.messages).toHaveLength(2);
    } finally {
      await done();
    }
  });

  it('L3.B7: a link inside a drawn Mermaid figure (an SVG a) reaches navigate; no second load', async () => {
    await open();
    try {
      const nonce = freshNonce();
      const md = '# Linked\n\n```mermaid\nflowchart LR\n  A[Start] --> B[End]\n  click A href "https://example.com/m"\n```\n*Figure 1. Linked.*\n';
      await host.mount(mermaidOn(md, nonce), frameCsp());
      expect(data(await host.waitMessages(1, 60_000))).toEqual([{ t: 'ready', v: 1, nonce }]);
      const f = host.frame();
      const links = await f.evaluate(() => Array.from(document.querySelectorAll('figure.mermaid-figure svg a'), (a) => [a.getAttribute('href'), a.getAttributeNS('http://www.w3.org/1999/xlink', 'href')]));
      expect(links, JSON.stringify(links)).not.toEqual([]);
      await f.locator('figure.mermaid-figure svg a').first().click();
      await sleep(400);
      const after = await host.record();
      expect(after.loads).toHaveLength(1);
      expect(opsOf(after, ['navigate'])).toEqual([{ t: 'navigate', href: 'https://example.com/m' }]);
    } finally {
      await done();
    }
  }, 120_000);

  it('L3.B8: the store crosses only under pref:prefs, pref:ui and doc:<DOC_FIELDS>; a delete is the JSON literal null', async () => {
    await open();
    try {
      const nonce = freshNonce();
      // A document by L2's measure (an h1 and more than two h2s), so its sections fold.
      const md = '# Store\n\nIntro.\n\n## First\n\nOne.\n\n## Second\n\nTwo.\n\n## Third\n\nThree.\n';
      await host.mount(srcdocOf(md, nonce), frameCsp());
      expect(data(await host.waitMessages(1, 10_000))).toEqual([{ t: 'ready', v: 1, nonce }]);
      await host.send('main', { t: 'prefs', theme: 'dark' });
      await sleep(300);
      expect(await host.frame().evaluate(() => document.body.querySelector(':scope > article')?.getAttribute('data-theme') ?? null)).toBe('dark');
      const fold = host.frame().locator('article h2').first().locator('.h-fold');
      await fold.click();
      await sleep(400);
      await fold.click();
      await sleep(800);
      const sets = data(await host.record()).filter((m) => (m as { t: string }).t === 'store.set') as { t: string; key: string; value: string }[];
      const allowed = ['pref:prefs', 'pref:ui', ...DOC_FIELDS.map((f) => `doc:${f}`)];
      expect(sets.length).toBeGreaterThan(0);
      for (const m of sets) {
        expect(Object.keys(m)).toEqual(['t', 'key', 'value']);
        expect(allowed).toContain(m.key);
        expect(() => JSON.parse(m.value) as unknown).not.toThrow();
      }
      expect(sets.map((m) => m.key)).toContain('pref:prefs');
      expect(JSON.parse(sets.find((m) => m.key === 'pref:prefs')?.value ?? '{}')).toMatchObject({ theme: 'dark' });
      const folds = sets.filter((m) => m.key === 'doc:folds').map((m) => m.value);
      expect(folds.at(-1)).toBe('null');
      expect(folds.length).toBeGreaterThanOrEqual(2);
    } finally {
      await done();
    }
  });

  it('L3.B9: a meta that adds connect-src * gives ready, then error boot (self-check (b): the policy floor)', async () => {
    await open();
    try {
      const nonce = freshNonce();
      const good = frameCsp();
      const bad = `${good}; connect-src *`;
      await host.mount(withPolicy(srcdocOf(PLAIN(), nonce), good, bad), bad);
      const rec = await host.waitMessages(2, 10_000);
      expect(data(rec)).toEqual([{ t: 'ready', v: 1, nonce }, { t: 'error', why: 'boot' }]);
    } finally {
      await done();
    }
  });

  it('L3.B10: every golden and hostile corpus output readies with no error, `<details open>` among them', async () => {
    const browserHandle = await browserFor(browser);
    const failed: string[] = [];
    let opens = 0;
    for (const d of corpusDocuments()) {
      const r = render(d.markdown);
      if (r.outcome !== 'rendered') continue;
      const h = await openFrameHost(browserHandle);
      try {
        const nonce = freshNonce();
        await h.mount(frameDocument(input(d.markdown), { csp: frameCsp(), nonce, assets }), frameCsp());
        const rec = await h.waitMessages(1, 20_000);
        await sleep(100);
        const got = data(await h.record());
        // Ready first, and no error: a document the reader reports a hash or a store write for is still accepted.
        const readyFirst = JSON.stringify(got[0]) === JSON.stringify({ t: 'ready', v: 1, nonce });
        if (!readyFirst || got.some((m) => (m as { t: string }).t === 'error')) failed.push(`${d.id}: ${JSON.stringify(got)} after ${String(rec.messages.length)}`);
        opens += await h.frame().evaluate(() => document.querySelectorAll('article details[open]').length);
      } finally {
        await h.close().catch(() => undefined);
      }
    }
    expect(failed).toEqual([]);
    expect(opens).toBeGreaterThan(0);
  }, 300_000);

  const PLANTED: readonly (readonly [string, string])[] = [
    ['<script>', '<p>a</p><script>parent.postMessage(1, "*")</script>'],
    ['<iframe>', '<p><iframe></iframe></p>'],
    ['<img onerror>', '<p><img src="x" alt="a" onerror="parent.postMessage(1, \'*\')"></p>'],
    ['style="position:fixed"', '<p style="position:fixed">a</p>'],
    ['<base>', '<base href="https://example.com/"><p>a</p>'],
    ['<form>', '<form><p>a</p></form>'],
    ['<meta>', '<meta http-equiv="refresh" content="0"><p>a</p>'],
    ['<object>', '<p><object></object></p>'],
    ['<embed>', '<p><embed></p>'],
    ['<img name=x>', '<p><img src="x" alt="a" name="x"></p>'],
  ];
  it('L3.B10: a planted script, iframe, img onerror, fixed style, base, form, meta, object, embed or img name each give ready, then error render', async () => {
    const browserHandle = await browserFor(browser);
    const got: Record<string, unknown> = {};
    for (const [name, html] of PLANTED) {
      const h = await openFrameHost(browserHandle);
      try {
        const nonce = freshNonce();
        const r: RenderInput = { result: { outcome: 'rendered', html: `<h1>Planted</h1>${html}`, meta: { title: 'Planted', frontList: null } } };
        await h.mount(frameDocument(r, { csp: frameCsp(), nonce, assets }), frameCsp());
        await h.waitMessages(2, 10_000);
        await sleep(200);
        const rec = await h.record();
        got[name] = { messages: data(rec).map((m) => JSON.stringify(m) === JSON.stringify({ t: 'ready', v: 1, nonce }) ? 'ready' : m), loads: rec.loads.length, windowMessages: rec.windowMessages };
      } finally {
        await h.close().catch(() => undefined);
      }
    }
    expect(got).toEqual(Object.fromEntries(PLANTED.map(([name]) => [name, { messages: ['ready', { t: 'error', why: 'render' }], loads: 1, windowMessages: [] }])));
  }, 180_000);

  it('L3.B11: no MessagePort is reachable from the window\'s own properties, and after hello no window listener takes a second hello', async () => {
    await open();
    try {
      const nonce = freshNonce();
      await host.mount(srcdocOf('# Port\n\n[away](away.md)\n', nonce), frameCsp());
      expect(data(await host.waitMessages(1, 10_000))).toEqual([{ t: 'ready', v: 1, nonce }]);
      const found = await host.frame().evaluate(() => {
        const out: string[] = [];
        const seen = new Set<unknown>();
        const look = (v: unknown, at: string, depth: number): void => {
          if (v instanceof MessagePort) out.push(at);
          if (depth === 0 || typeof v !== 'object' || v === null || seen.has(v) || v instanceof Node || v === window) return;
          seen.add(v);
          for (const k of Reflect.ownKeys(v)) {
            let x: unknown;
            try {
              x = (v as Record<PropertyKey, unknown>)[k];
            } catch {
              continue;
            }
            look(x, `${at}.${String(k)}`, depth - 1);
          }
        };
        for (const k of Reflect.ownKeys(window)) {
          let x: unknown;
          try {
            x = (window as unknown as Record<PropertyKey, unknown>)[k];
          } catch {
            continue;
          }
          look(x, String(k), 2);
        }
        return out;
      });
      expect(found).toEqual([]);
      // A second hello with a port: no listener takes it, so what the reader sends next still crosses the first port.
      await host.secondHello();
      await sleep(300);
      await host.frame().locator('article a[href="away.md"]').click();
      await sleep(400);
      const rec = await host.record();
      expect(rec.messages.map((m) => [m.port, (m.data as { t: string }).t])).toEqual([
        ['main', 'ready'],
        ['main', 'navigate'],
      ]);
    } finally {
      await done();
    }
  });
});
