// The sealed reader frame in a real browser (docserver L3 prototype; design §4 to §7; prototype brief rows P1 to P6).
// The assets are built in memory by scripts/build-frame.mjs, frameDocument verifies them against the committed
// manifest, and the srcdoc mounts in a sandboxed iframe (`allow-scripts` only) of a parent page at
// https://docreader.test/ (frame-host-page.ts), under the hash-only policy frameCsp() builds. Every nonce is 128 bits
// fresh from crypto.getRandomValues.
//
// Release bytes only: no row reaches into the frame through anything the shipped scripts carry, and the headline rows
// run the frame's realm untouched (no init script). CSP violations are read from the parent's side, as the console
// messages of the page's frames (frame-host-page.ts); the frame's compatMode and its root are read through Playwright's
// frame handle. Every broken srcdoc (P2, P3, P8 to P10, the blocked Mermaid row) is a valid frameDocument output broken
// by string surgery here, never through a path in src/. P6's "before enhance" case is a guard-only srcdoc built here,
// with a guard-less twin as its control. Handlers that stop a link click are added from the parent through Playwright's
// frame access, never shipped.
//
// Measurements are printed as `frame-measure:` lines (time from insertion to ready, the materialisation of the largest
// corpus document, srcdoc lengths). The 2 MiB measurement row runs only with DOCREADER_MEASURE=1.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { buildFrame } from '../../scripts/build-frame.mjs';
import { frameCsp, frameDocument, FRAME_MANIFEST, type FrameAssets, type RenderInput } from '../../src/frame/index.js';
import { render } from '../../src/render/index.js';
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

  it('P1: the plain corpus document readies with the nonce, one load, no violation, no request, no quirks, enhance ran', async () => {
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

  it('P2 (control): a policy without the bootstrap hash gives no port message in 3 s', async () => {
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

  it('P3: an enhance byte flipped after verification gives ready, then error assets (and the close event, where the engine has one)', async () => {
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

  it('P3b (instrumented: a close counter wraps MessagePort.prototype.close before the bootstrap runs): the frame closes its port once', async () => {
    await open({ countCloses: true });
    try {
      const nonce = freshNonce();
      await expectReadyThenError(flippedEnhance(nonce), frameCsp(), nonce, 'assets');
      expect((await host.frameRecord()).closed).toBe(1);
    } finally {
      await done();
    }
  });

  it('P4: hellos with no port, an extra key or two ports get no answer; the first valid one binds; a second gets nothing', async () => {
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

  it('P4b: a hello with v:2 binds, and gets ready, then error protocol', async () => {
    await open();
    try {
      const nonce = freshNonce();
      await expectReadyThenError(srcdocOf(PLAIN(), nonce), frameCsp(), nonce, 'protocol', 'v2');
    } finally {
      await done();
    }
  });

  it('P5: headings and anchors named after the handoff still ready with the right nonce', async () => {
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

  const LINKS = ['https://example.com/x', 'other.md', '#missing'];

  it('P6 before enhance: the guard alone keeps every link shape from navigating, stopped clicks and submit included (its guard-less twin navigates on a plain click)', async () => {
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
            await f.locator(`a[href="${h}"]`).click();
            await f.locator(`a[href="${h}"]`).click({ modifiers: ['Control'] });
          }
          await f.locator('img[usemap]').click({ position: { x: 10, y: 10 } });
          await f.getByText('svg link').click();
          await f.getByText('svg xlink').click();
          await stopHandlers(host, 'body');
          for (const h of STOPS) await f.locator(`a[href="${h}"]`).click();
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

  it('P6 after enhance, with Ctrl held and with the middle button: no second load, every link reaches navigate; stopped clicks and an in-document fragment do not', async () => {
    await open();
    try {
      const md = `# Links\n\n${LINKS.map((h, i) => `[link ${String(i)}](${h})`).join(' ')} [existing](#existing)\n\n${STOPS.map((h) => `[${h}](${h})`).join(' ')}\n\n## Existing\n\nThe end.\n`;
      const nonce = freshNonce();
      await host.mount(srcdocOf(md, nonce), frameCsp());
      const rec = await host.waitMessages(1, 10_000);
      expect(data(rec)).toEqual([{ t: 'ready', v: 1, nonce }]);
      const f = host.frame();
      for (const h of LINKS) await f.locator(`article a[href="${h}"]`).click();
      for (const h of LINKS) await f.locator(`article a[href="${h}"]`).click({ modifiers: ['Control'] });
      // The reader takes only the main button (src/enhance/nav.ts), so a middle click reaches navigate through the
      // guard's auxclick net and the bootstrap's docserver:link listener alone. An engine with no auxclick event sends
      // the middle button nothing to act on, and then nothing crosses (and nothing loads).
      const aux = await f.evaluate(() => 'onauxclick' in HTMLElement.prototype);
      for (const h of LINKS) await f.locator(`article a[href="${h}"]`).click({ button: 'middle' });
      await f.locator('article a[href="#existing"]:not([data-docreader-chrome])').click();
      await sleep(300);
      // The reader handled the in-document link itself: it went there, and nothing crossed the bridge for it.
      expect(await f.evaluate(() => document.activeElement?.id ?? null)).toBe('existing');
      await stopHandlers(host, 'article');
      for (const h of STOPS) await f.locator(`article a[href="${h}"]`).click();
      await sleep(600);
      const after = await host.record();
      expect(after.loads).toHaveLength(1);
      expect(data(after).slice(1)).toEqual([...LINKS, ...LINKS, ...(aux ? LINKS : [])].map((href) => ({ t: 'navigate', href })));
      expect(host.requests.filter((r) => !r.main)).toEqual([]);
      expect(host.cspConsole).toEqual([]);
      measure('P6 middle button', browser, { auxclick: aux });
    } finally {
      await done();
    }
  });

  it('P6 other buttons: a right click and auxclicks of buttons 2, 3 and 4 on a link send nothing; button 1 on the same path sends navigate', async () => {
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
      expect(data(await host.record()).slice(1)).toEqual([]);
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

  it('P8: a policy that blocks the guard alone gives ready, then error boot (self-check (d): the guard ran)', async () => {
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

  it('P9: a policy that blocks the inline style gives ready, then error boot (the securitypolicyviolation listener)', async () => {
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
    it(`P10: a policy that blocks the data: fonts gives ready, then error boot, for ${name} (the face probe and the violation listener)`, async () => {
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
    it(`P11: mounted with ${sandbox === null ? 'no sandbox attribute' : `sandbox="${sandbox}"`}, the frame gives ready, then error boot (self-check (a): an opaque origin)`, async () => {
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

describeBrowsers((browser) => {
  it('P7 (stretch): Mermaid as a classic IIFE draws a flowchart, a sequence and a gantt under the hash-only policy; ready waits for it', async () => {
    const host = await openFrameHost(await browserFor(browser), { observeDiagrams: true });
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

  it('P7: a policy that blocks the Mermaid script gives ready, then error mermaid (default Q3)', async () => {
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
