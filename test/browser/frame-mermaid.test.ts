// Mermaid inside the sealed frame, on the bytes that ship (docserver L3, Task 8; plan Reference §2, §6.2, FD13, FD18,
// risk R10; rows L3.B14, L3.B15 and L3.D5's frame half). Every row mounts a frameDocument output with Mermaid on, under
// frameCsp(), in the parent page of frame-host-page.ts, with the assets built in memory exactly as
// `node scripts/build-frame.mjs` writes them (frame-shared.ts). v1 ships Mermaid 12.1.0 (ledger C93: Task 13's move to
// 12.2.0 is deferred past v1), so these rows baseline on 12.1.0.
//
//   L3.B14  (measurement row) Authored ids against the drawing's ids. For every diagram kind the corpus draws, and the
//           other kinds the frame's Mermaid draws (frame-shared.ts's KINDS), each figure is drawn alone and every id
//           inside its SVG collected (the SVG's own, its markers, gradients, clip paths and node ids), with the two
//           ids Mermaid gives its working elements while it draws (`d` and `i` before the SVG's id). The document is
//           then drawn again with an anchor for each of those ids ahead of the figure (render()'s `<!-- id:X -->`, whose
//           grammar covers every id a heading slug can produce too). Mermaid 12.1.0's run() names every drawing
//           `mermaid-<Date.now()>` (its InitIDGenerator) and every other id of the drawing begins with that name, so
//           on the page's own clock the anchored drawing would get new ids and the anchors could not meet them. The
//           row fixes the page's clock (Playwright's page clock, which reaches every frame of the page; its one
//           instrumentation) so both drawings get the same ids, and asserts that they do: the drawing is named
//           `mermaid-<NOW>` and its own names are among the anchors. Asserted per case, whatever the ids do: ready with
//           the right nonce and nothing else, no violation, no request, one load. The plan's criterion (the figure
//           draws with the same SVG text, every reference inside the SVG (a `url(#…)` in an attribute or its style
//           element, an `href="#…"`, an aria-labelledby or aria-describedby) resolves as it did in the clean drawing,
//           and every anchor stays) is its own row, KNOWN RED (`it.fails`) until the coordinator rules on the id
//           prefix: measured 2026-10-28 on Chromium, every case is damaged (docs/superpowers/plans/l3-mutations/
//           task-8.md).
//   L3.B15  The spec's hostile Mermaid cases (the Level 2 cases of conformance/layout/diagrams/): an init directive
//           whose themeCSS holds `position: fixed`, a click directive with a call and a script link, HTML labels, and
//           diagrams over maxTextSize and over maxEdges, both at the ceilings a host cannot raise (MERMAID_LIMIT_CEILINGS,
//           the frame's defaults) and at limits a host tightened. No injected style, no handler, zero violations, ready
//           with no error, and each over-limit diagram shown as its source.
//   L3.D5   (frame half) Mermaid on request: a document heavy with diagrams, `mermaid.draw: 'on-request'`, readies
//           before anything is drawn (every figure still shows its source and its Render button); a tap draws that
//           figure alone under frameCsp() with zero violations.
//
// Figures print as `frame-figure:` lines, one per figure, with the engine's name.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parse, type DefaultTreeAdapterMap } from 'parse5';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { frameCsp, MERMAID_LIMIT_CEILINGS, type FrameAssets, type FrameOptions } from '../../src/frame/index.js';
import { render } from '../../src/render/index.js';
import { openFrameHost, type FrameHost } from './frame-host-page.js';
import { corpusFiles, CORPUS, data, figure, freshNonce, KINDS, loadFrame, opsOf, readyOf, ROOT, sleep, srcdocFor, svgTexts, waitProgress } from './frame-shared.js';
import { browserFor, closeBrowsers, describeBrowsers } from './harness.js';

type Node5 = DefaultTreeAdapterMap['node'];
type Element5 = DefaultTreeAdapterMap['element'];

let assets: FrameAssets;
let mermaidText = '';

beforeAll(async () => {
  const built = await loadFrame();
  assets = built.assets;
  mermaidText = built.mermaid;
}, 300_000);

afterAll(closeBrowsers);

const withMermaid = (): FrameAssets => ({ ...assets, mermaid: mermaidText });

/** The instant the B14 row fixes the frame's clock at. */
const NOW = Date.UTC(2026, 0, 15, 12, 0, 0);

/** The anchor grammar render() admits (`<!-- id:X -->`, src/render/allowlist.ts). */
const ANCHOR = /^[A-Za-z0-9_-]{1,100}$/;

const isElement = (n: Node5): n is Element5 => 'tagName' in n;
const textOf = (n: Node5): string => ('value' in n && n.nodeName === '#text' ? n.value : 'childNodes' in n ? n.childNodes.map(textOf).join('') : '');

/** The first word of a diagram's source: its kind (`graph`, `flowchart`, `sequenceDiagram`, …), past any directive. */
const kindOf = (source: string): string => source.split('\n').map((l) => l.trim()).find((l) => l !== '' && !l.startsWith('%%'))?.split(/\s+/)[0] ?? '';

/** One diagram per kind the corpus holds (its first, in file order), as `[label, source]`. */
function corpusKinds(): [string, string][] {
  const seen = new Map<string, [string, string]>();
  for (const file of corpusFiles().sort()) {
    const r = render(readFileSync(file, 'utf8'));
    if (r.outcome !== 'rendered') continue;
    const visit = (node: Node5): void => {
      if (isElement(node) && node.tagName === 'pre' && (node.attrs.find((a) => a.name === 'class')?.value ?? '').split(/\s+/).includes('mermaid')) {
        const source = textOf(node);
        const kind = kindOf(source);
        // A kind word Mermaid knows: the corpus's fences that are no diagram (a bare `A`, front matter) are left out.
        if (/^(graph|flowchart|sequenceDiagram)$/.test(kind) && !seen.has(kind)) seen.set(kind, [`corpus ${path.relative(CORPUS, file)} ${kind}`, source.replace(/\n$/, '')]);
      }
      if ('childNodes' in node) for (const c of node.childNodes) visit(c);
    };
    visit(parse(r.html));
  }
  return [...seen.values()];
}

/** What one drawn figure holds, read in the frame. */
interface Drawing {
  readonly svgId: string;
  readonly ids: readonly string[];
  /** Each reference inside the SVG, and where it resolves: `inside` this SVG, `outside` it, or `none`. */
  readonly refs: Readonly<Record<string, 'inside' | 'outside' | 'none'>>;
  readonly text: string;
}

/** Each figure's drawing in the frame (null for a figure with no SVG). */
const drawings = (host: FrameHost): Promise<(Drawing | null)[]> =>
  host.frame().evaluate(() =>
    Array.from(document.querySelectorAll('figure.mermaid-figure'), (f) => {
      const svg = f.querySelector('svg');
      if (svg === null) return null;
      const ids = [svg.id, ...Array.from(svg.querySelectorAll('[id]'), (e) => e.id)].filter((x) => x !== '');
      const refs = new Set<string>();
      const url = /url\(\s*['"]?#([^'")\s]+)['"]?\s*\)/g;
      for (const el of [svg, ...Array.from(svg.querySelectorAll('*'))]) {
        for (const a of Array.from(el.attributes)) {
          if ((a.name === 'href' || a.name === 'xlink:href') && a.value.startsWith('#') && a.value.length > 1) refs.add(a.value.slice(1));
          if (a.name === 'aria-labelledby' || a.name === 'aria-describedby') for (const t of a.value.split(/\s+/)) if (t !== '') refs.add(t);
          for (const m of a.value.matchAll(url)) refs.add(m[1] ?? '');
        }
        if (el.localName === 'style') for (const m of (el.textContent ?? '').matchAll(url)) refs.add(m[1] ?? '');
      }
      const where = Object.fromEntries(
        [...refs].sort().map((r) => {
          const t = document.getElementById(r);
          const where: 'inside' | 'outside' | 'none' = t === null ? 'none' : svg.contains(t) ? 'inside' : 'outside';
          return [r, where] as const;
        }),
      );
      const out: string[] = [];
      const walk = document.createTreeWalker(svg, NodeFilter.SHOW_TEXT);
      for (let n = walk.nextNode(); n !== null; n = walk.nextNode()) if (n.parentElement?.closest('style') === null) out.push(n.nodeValue ?? '');
      return { svgId: svg.id, ids, refs: where, text: out.join('|') };
    }),
  );

const fence = (source: string, caption: string): string => `\`\`\`mermaid\n${source}\n\`\`\`\n*${caption}*\n`;

const layoutCase = (id: string): string => readFileSync(path.join(ROOT, 'conformance', 'layout', 'diagrams', `${id}.md`), 'utf8');

/** The source of the only Mermaid fence of a Level 2 case. */
const sourceOf = (md: string): string => (md.split('```mermaid\n')[1] ?? '').split('```')[0] ?? '';

describeBrowsers((browser) => {
  /** A drawing's references, each name with the drawing's own name written as `<svg>`. */
  const named = (d: Drawing): Record<string, string> => Object.fromEntries(Object.entries(d.refs).map(([r, w]) => [r.split(d.svgId).join('<svg>'), w]));

  /** The references of `drawn` that resolve otherwise than in `clean`, as `name: before -> after`. */
  const movedRefs = (clean: Drawing, drawn: Drawing): string[] => {
    const a = named(clean);
    const b = named(drawn);
    return Object.keys({ ...a, ...b }).filter((r) => a[r] !== b[r]).map((r) => `${r}: ${String(a[r])} -> ${String(b[r])}`);
  };

  /** What one B14 case gave on its anchored drawing, when anything differed from the clean one. */
  interface Damage {
    readonly drawn: boolean;
    readonly sameText: boolean;
    readonly moved: readonly string[] | null;
    readonly lostAnchors: readonly string[];
  }

  /** What the B14 cases measured: the damaged cases and the counts. */
  interface B14 {
    readonly damaged: Record<string, Damage>;
    readonly cases: number;
    readonly collected: number;
    readonly anchored: number;
    readonly unproducible: number;
    readonly timed: number;
    readonly untimed: readonly string[];
  }

  /**
   * Run every B14 case with the frame's clock fixed at NOW, so the anchored drawing gets the clean drawing's ids and
   * every anchor meets the id it names. The parts that hold whatever the ids do are asserted here, per case: the frame's
   * clock reads NOW in both mounts, the drawing is named `mermaid-<NOW>`, its own three names are among the anchors (so
   * the collision is certain, never left to the clock), and the anchored mount readies with its nonce and nothing else,
   * with no violation, no request and one load. The drawing's text, its references and the anchors are measured and
   * answered, for the plan's criterion (the next row).
   */
  const runB14 = async (): Promise<B14> => {
    const handle = await browserFor(browser);
    const cases: [string, string][] = [...corpusKinds(), ...KINDS.map(([name, src]): [string, string] => [`kind ${name}`, src])];
    expect(cases.length).toBeGreaterThanOrEqual(KINDS.length + 2);
    const damaged: Record<string, Damage> = {};
    let collected = 0;
    let anchored = 0;
    let unproducible = 0;
    let timed = 0;
    const untimed: string[] = [];
    for (const [label, source] of cases) {
      const md = fence(source, 'Figure 1. One diagram.');
      const mount = async (doc: string): Promise<{ host: FrameHost; nonce: string }> => {
        const host = await openFrameHost(handle);
        await host.page.clock.setFixedTime(NOW);
        const nonce = freshNonce();
        await host.mount(srcdocFor(withMermaid(), doc, nonce, { mermaid: {} }), frameCsp());
        await waitProgress(host, 1, `L3.B14 ${browser} ${label}`);
        await sleep(200);
        // The instrument reaches the frame: its clock is the fixed one.
        expect(await host.frame().evaluate(() => Date.now()), `${label}: the frame's clock`).toBe(NOW);
        return { host, nonce };
      };
      const first = await mount(`# Clean\n\n${md}`);
      let clean: Drawing | null | undefined;
      try {
        expect({ messages: data(await first.host.record()), violations: first.host.cspConsole }).toEqual({ messages: [readyOf(first.nonce)], violations: [] });
        [clean] = await drawings(first.host);
      } finally {
        await first.host.close();
      }
      expect(clean, `${label}: the clean drawing`).not.toBeNull();
      if (clean === null || clean === undefined) continue;
      expect(clean.svgId, `${label}: the drawing's name`).toBe(`mermaid-${String(NOW)}`);
      // Mermaid's own drawing may name a reference it never defines (the sequence diagram's style names a gradient);
      // none of its references may leave the SVG.
      expect(Object.entries(clean.refs).filter(([, w]) => w === 'outside'), `${label}: the clean drawing's own references`).toEqual([]);
      const ids = [...new Set([...clean.ids, `d${clean.svgId}`, `i${clean.svgId}`])];
      const producible = ids.filter((id) => ANCHOR.test(id));
      // The row cannot pass by missing: the anchors name the drawing itself and its two working elements, which the
      // anchored mount, on the same fixed clock, gives the same names.
      expect([clean.svgId, `d${clean.svgId}`, `i${clean.svgId}`].filter((id) => !producible.includes(id)), `${label}: the drawing's own names anchored`).toEqual([]);
      collected += ids.length;
      anchored += producible.length;
      unproducible += ids.length - producible.length;
      timed += ids.filter((id) => id.includes(clean.svgId)).length;
      untimed.push(...ids.filter((id) => !id.includes(clean.svgId)).map((id) => `${label}: ${id}`));
      const anchors = producible.map((id) => `<!-- id:${id} -->\n\nAn anchor named ${id}.\n`).join('\n');
      const second = await mount(`# Collide\n\n${anchors}\n${md}`);
      try {
        const rec = await second.host.record();
        const [drawn] = await drawings(second.host);
        const kept = await second.host.frame().evaluate((xs) => xs.filter((id) => {
          const el = document.getElementById(id);
          return el !== null && el.closest('figure') === null;
        }), producible);
        // Whatever the ids do: one ready with this mount's nonce and nothing else, no violation, no request, one load.
        expect({ label, messages: data(rec), violations: second.host.cspConsole.length, leaks: second.host.requests.filter((r) => !r.main).length, loads: rec.loads.length }).toEqual({
          label,
          messages: [readyOf(second.nonce)],
          violations: 0,
          leaks: 0,
          loads: 1,
        });
        const damage: Damage = {
          drawn: drawn !== null && drawn !== undefined,
          sameText: drawn?.text === clean.text,
          // Every reference resolves as it did in the clean drawing: inside the SVG, or (Mermaid's own dangling one) to
          // nothing; never to an authored element.
          moved: drawn === null || drawn === undefined ? null : movedRefs(clean, drawn),
          lostAnchors: producible.filter((id) => !kept.includes(id)),
        };
        if (!(damage.drawn && damage.sameText && damage.moved?.length === 0 && damage.lostAnchors.length === 0)) damaged[label] = damage;
      } finally {
        await second.host.close();
      }
    }
    return { damaged, cases: cases.length, collected, anchored, unproducible, timed, untimed };
  };

  let b14: B14 | undefined;

  it("L3.B14 (measurement row): an anchor for every id of each diagram kind's drawing, the frame's clock fixed so the anchored drawing gets the same ids: every anchor meets its id, and the frame still readies with no violation, no request and one load", async () => {
    const got = await runB14();
    b14 = got;
    const damage = Object.values(got.damaged);
    figure('L3.B14', browser, 'cases', got.cases);
    figure('L3.B14', browser, 'idsCollected', got.collected);
    figure('L3.B14', browser, 'idsAnchored', got.anchored);
    figure('L3.B14', browser, 'idsOutsideAnchorGrammar', got.unproducible);
    figure('L3.B14', browser, 'idsNamingTheDrawingsTime', got.timed);
    figure('L3.B14', browser, 'casesDamaged', damage.length);
    figure('L3.B14', browser, 'casesDrawingTaken', damage.filter((d) => !d.sameText).length);
    figure('L3.B14', browser, 'anchorsRemoved', damage.reduce((n, d) => n + d.lostAnchors.length, 0));
    figure('L3.B14', browser, 'referencesTaken', damage.reduce((n, d) => n + (d.moved?.filter((m) => m.endsWith('-> outside')).length ?? 0), 0));
    console.warn(`frame-measure: ${JSON.stringify({ label: 'L3.B14 ids not naming the drawing', browser, ids: got.untimed })}`);
    console.warn(`frame-measure: ${JSON.stringify({ label: 'L3.B14 damage', browser, damaged: got.damaged })}`);
    expect(got.unproducible).toBe(0);
    expect(got.anchored).toBe(got.collected);
  }, 900_000);

  // The plan's criterion for L3.B14, on what the row above measured. KNOWN RED, AWAITING THE COORDINATOR'S RULING
  // (Task 8 review finding T8-C1): Mermaid 12.1.0 names each drawing `mermaid-<Date.now()>` and looks that name up in
  // the whole document while it draws, so an authored anchor that names the drawing's millisecond takes the drawing,
  // loses its own `d…` twin, and takes marker and gradient references (measured 2026-10-28 on Chromium: 14 of 14 cases;
  // docs/superpowers/plans/l3-mutations/task-8.md). The plan's answer is an id prefix render() cannot emit, and the
  // ruling picks how. `it.fails` keeps the red visible without failing CI: when the fix lands this row passes, which
  // vitest reports as a failure, and the row becomes a plain `it` with the fix's own mutation row.
  it.fails('L3.B14 (KNOWN RED, awaiting the ruling on the id prefix): every diagram draws with SVG text equal to the clean one, every reference resolves as in the clean drawing, and every anchor stays', () => {
    // With nothing measured (the row above red, or this row run alone) this body passes, which `it.fails` reports as
    // red: the row is never green without a measurement behind it.
    if (b14 === undefined) return;
    expect(b14.damaged).toEqual({});
  });

  it('L3.B15: the hostile Mermaid cases under frameCsp(): no injected style, no handler, zero violations, ready with no error, each over-limit diagram shown as its source', async () => {
    const handle = await browserFor(browser);
    // Over the ceilings a host cannot raise (the frame's defaults): one character over maxTextSize (a comment pads it,
    // so a reader that let it through would draw it at once), and one edge over maxEdges.
    const longText = `flowchart LR\n  %% ${'x'.repeat(MERMAID_LIMIT_CEILINGS.maxTextSize)}\n  A --> B`;
    const manyEdges = `flowchart LR\n${Array.from({ length: MERMAID_LIMIT_CEILINGS.maxEdges + 1 }, (_, i) => `  n${String(i)} --> n${String(i + 1)}`).join('\n')}`;
    expect(longText.length).toBeGreaterThan(MERMAID_LIMIT_CEILINGS.maxTextSize);
    const hostile = ['theme-css', 'click', 'html-label'].map((id) => sourceOf(layoutCase(id)));
    const md = [
      '# Hostile figures',
      '',
      fence(hostile[0] ?? '', 'Figure 1. Restyled by its directive.'),
      fence(hostile[1] ?? '', 'Figure 2. Clicks that do nothing.'),
      fence(hostile[2] ?? '', 'Figure 3. Labels with markup.'),
      fence(longText, 'Figure 4. Over the size ceiling.'),
      fence(manyEdges, 'Figure 5. Over the edge ceiling.'),
      '',
      'A paragraph after the figures.',
      '',
    ].join('\n');
    const mounts: { name: string; md: string; mermaid: NonNullable<FrameOptions['mermaid']>; over: readonly number[] }[] = [
      { name: 'at the ceilings', md, mermaid: {}, over: [3, 4] },
      { name: 'too-long, maxTextSize 120', md: layoutCase('too-long'), mermaid: { maxTextSize: 120 }, over: [0] },
      { name: 'edges, maxEdges 3', md: layoutCase('edges'), mermaid: { maxEdges: 3 }, over: [0] },
    ];
    for (const m of mounts) {
      const host = await openFrameHost(handle);
      try {
        const nonce = freshNonce();
        await host.mount(srcdocFor(withMermaid(), m.md, nonce, { mermaid: m.mermaid }), frameCsp());
        await waitProgress(host, 1, `L3.B15 ${browser} ${m.name}`, 30_000);
        await sleep(300);
        expect({ mount: m.name, messages: data(await host.record()), violations: host.cspConsole, errors: host.errors }).toEqual({ mount: m.name, messages: [readyOf(nonce)], violations: [], errors: [] });
        const got = await host.frame().evaluate(() => {
          const root = document.body.querySelector(':scope > article');
          const figs = Array.from(document.querySelectorAll('figure.mermaid-figure'));
          const inFigures = figs.flatMap((f) => [f, ...Array.from(f.querySelectorAll('*'))]);
          return {
            state: root?.getAttribute('data-docreader-diagrams') ?? null,
            fixed: inFigures.filter((e) => getComputedStyle(e).position === 'fixed').map((e) => e.localName),
            styles: figs.flatMap((f) => Array.from(f.querySelectorAll('svg style'), (s) => s.textContent ?? '')),
            handlers: Array.from(document.querySelectorAll('article *')).flatMap((e) => Array.from(e.attributes).filter((a) => /^on/i.test(a.name)).map((a) => `${e.localName} ${a.name}`)),
            scriptLinks: Array.from(document.querySelectorAll('article a')).map((a) => a.getAttribute('href') ?? a.getAttributeNS('http://www.w3.org/1999/xlink', 'href') ?? '').filter((h) => /^\s*javascript:/i.test(h)),
            scripts: document.querySelectorAll('article script').length,
            figures: figs.map((f) => ({ svg: f.querySelector('svg') !== null, failed: f.classList.contains('draw-failed'), source: f.querySelector('.fig-error .fig-src code')?.textContent ?? null })),
          };
        });
        expect(got.fixed, m.name).toEqual([]);
        for (const text of got.styles) expect(text, m.name).not.toMatch(/position:\s*fixed|monospace|#ff0000/i);
        expect(got.handlers, m.name).toEqual([]);
        expect(got.scriptLinks, m.name).toEqual([]);
        expect(got.scripts, m.name).toBe(0);
        const sources = [hostile[0], hostile[1], hostile[2], longText, manyEdges];
        got.figures.forEach((f, i) => {
          if (m.over.includes(i)) {
            const src = m.mermaid.maxTextSize !== undefined || m.mermaid.maxEdges !== undefined ? sourceOf(m.md) : sources[i];
            // The note shows the source as render() wrote its pre: the fence's text, its last line break included.
            expect({ figure: i, ...f }, m.name).toEqual({ figure: i, svg: false, failed: true, source: src?.endsWith('\n') === true ? src : `${src ?? ''}\n` });
          } else {
            expect({ figure: i, svg: f.svg, failed: f.failed }, m.name).toEqual({ figure: i, svg: true, failed: false });
          }
        });
        if (m.name === 'at the ceilings') {
          expect(got.state).toBe('partial');
          expect(got.styles.length).toBeGreaterThan(0);
          // The click directive bound nothing: a call it named, defined here from the parent's side, never runs, and no
          // click on a node sends a script link.
          await host.frame().evaluate(() => {
            (window as unknown as { hit: () => void }).hit = () => {
              (window as unknown as { __hit: number }).__hit = 1;
            };
          });
          for (const n of await host.frame().locator('figure.mermaid-figure').nth(1).locator('g.node').all()) await n.click();
          await host.frame().locator('figure.mermaid-figure').nth(2).locator('.nodeLabel b').first().hover();
          await sleep(400);
          expect(await host.frame().evaluate(() => (window as unknown as { __hit?: number }).__hit ?? null)).toBe(null);
          const sent = opsOf(await host.record(), ['navigate', 'error']) as { t: string; href?: string }[];
          expect(sent.filter((o) => o.t === 'error' || /^\s*javascript:/i.test(o.href ?? ''))).toEqual([]);
          expect(host.cspConsole).toEqual([]);
          expect((await host.record()).loads).toHaveLength(1);
        } else {
          expect(got.state).toBe('failed');
        }
      } finally {
        await host.close();
      }
    }
  }, 300_000);

  it("L3.D5 (frame half): with mermaid.draw 'on-request', a document heavy with diagrams readies before anything is drawn; a tap draws that figure alone under frameCsp() with zero violations", async () => {
    const host = await openFrameHost(await browserFor(browser));
    try {
      const chart = (k: number): string =>
        fence(
          `flowchart TD\n${Array.from({ length: 40 }, (_, i) => `  n${String(k)}x${String(i)}[Step ${String(i)} of chart ${String(k)}] --> n${String(k)}x${String(i + 1)}`).join('\n')}`,
          `Figure ${String(k + 1)}. Chart ${String(k + 1)}.`,
        );
      const count = 16;
      const md = `# Heavy\n\n${Array.from({ length: count }, (_, k) => chart(k)).join('\n')}`;
      const nonce = freshNonce();
      await host.mount(srcdocFor(withMermaid(), md, nonce, { mermaid: { draw: 'on-request' } }), frameCsp());
      const { rec } = await waitProgress(host, 1, `L3.D5 ${browser}`);
      expect(data(rec)).toEqual([readyOf(nonce)]);
      // Nothing drawn when ready came, nor since: the reader draws only on a tap.
      const before = await host.frame().evaluate(() => {
        const root = document.body.querySelector(':scope > article');
        return {
          state: root?.getAttribute('data-docreader-diagrams') ?? null,
          svgs: document.querySelectorAll('figure.mermaid-figure svg').length,
          figures: document.querySelectorAll('figure.mermaid-figure').length,
          buttons: Array.from(document.querySelectorAll('figure.mermaid-figure'), (f) => f.querySelectorAll('button.fig-render-btn').length),
        };
      });
      expect(before).toEqual({ state: 'on-request', svgs: 0, figures: count, buttons: Array.from({ length: count }, () => 1) });
      const tapped = 2;
      const t0 = Date.now();
      await host.frame().locator('figure.mermaid-figure').nth(tapped).locator('button.fig-render-btn').click();
      const until = Date.now() + 60_000;
      let drawn: boolean[] = [];
      for (;;) {
        drawn = await host.frame().evaluate(() => Array.from(document.querySelectorAll('figure.mermaid-figure'), (f) => f.querySelector('svg') !== null));
        if (drawn[tapped] === true || Date.now() > until) break;
        await sleep(50);
      }
      const tapMs = Date.now() - t0;
      await sleep(300);
      expect(drawn).toEqual(Array.from({ length: count }, (_, i) => i === tapped));
      expect(await svgTexts(host)).toHaveLength(1);
      expect({ violations: host.cspConsole, errors: host.errors, sent: opsOf(await host.record(), ['error']) }).toEqual({ violations: [], errors: [], sent: [] });
      expect((await host.record()).loads).toHaveLength(1);
      figure('L3.D5', browser, 'insertionToReadyMs', rec.messages[0]?.at ?? -1);
      figure('L3.D5', browser, 'tapToDrawnMs', tapMs);
    } finally {
      await host.close();
    }
  }, 180_000);
});
