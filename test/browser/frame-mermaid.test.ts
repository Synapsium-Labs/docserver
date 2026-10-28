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
//           then drawn again with an anchor ahead of the figure (render()'s `<!-- id:X -->`, whose grammar covers every
//           id a heading slug can produce too) for each collected id the grammar admits, and for each collected id's
//           twins: the id with the drawing's name replaced by the name Mermaid 12.1.0's run() gives a drawing on this
//           clock (`mermaid-<Date.now()>`), and by the drawing's name without the reader's prefix (the name a drawing
//           would carry without it, which is also what Mermaid's deterministicIds gives: `mermaid-<n>`). The reader
//           names each drawing itself, `docreader·mermaid-<n>` (src/enhance/diagrams.ts, DRAWING_ID_PREFIX; ledger
//           C95(1)), so no anchor can hold a drawing's id and the anchors that come closest are those twins. The row
//           fixes the page's clock (Playwright's page clock, which reaches every frame of the page; its one
//           instrumentation), asserts that the frame reads it, and that every twin of the drawing's own three names is
//           in the anchor grammar, so the row cannot pass by missing: drop the prefix and an anchor holds the drawing's
//           name (the mutation row). Asserted per case, whatever the ids do: ready with the right nonce and nothing
//           else, no violation, no request, one load. The plan's criterion is the next row: the figure draws with the
//           same SVG text, every reference inside the SVG (a `url(#…)` in an attribute or its style element, an
//           `href="#…"`, an aria-labelledby or aria-describedby) resolves as it did in the clean drawing, and every
//           anchor stays. Before the prefix it was red in every case (measured 2026-10-28 on Chromium, task-8.md).
//   L3.B14p The prefix's code point in each engine: in the frame, under frameCsp(), a drawing's id (U+00B7 in it) finds
//           the drawing as an unescaped CSS id selector, the drawing's own stylesheet (`#<id> …` rules) styles it, and
//           a `url(#…)` naming an element whose id holds the dot resolves (a clip path that clips a hit test).
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
import { DRAWING_ID_PREFIX, THEME_VARIABLES } from '../../src/enhance/diagrams.js';
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
    /** Collected ids the anchor grammar admits (anchored as they are). */
    readonly anchored: number;
    /** Collected ids the anchor grammar refuses: every id holding the drawing's name, the prefix's dot in it. */
    readonly unproducible: number;
    /** Twins anchored: run()'s name and the prefix-less name in place of the drawing's. */
    readonly twins: number;
    readonly timed: number;
    readonly untimed: readonly string[];
    readonly names: readonly string[];
  }

  /**
   * Run every B14 case with the frame's clock fixed at NOW. The parts that hold whatever the ids do are asserted here,
   * per case: the frame's clock reads NOW in both mounts; the twins of the drawing's own three names (its name, `d` and
   * `i` before it) are in the anchor grammar and among the anchors, so the row cannot pass by missing; and the anchored
   * mount readies with its nonce and nothing else, with no violation, no request and one load. The drawing's text, its
   * references and the anchors are measured and answered, for the plan's criterion (the next row).
   */
  const runB14 = async (): Promise<B14> => {
    const handle = await browserFor(browser);
    const cases: [string, string][] = [...corpusKinds(), ...KINDS.map(([name, src]): [string, string] => [`kind ${name}`, src])];
    expect(cases.length).toBeGreaterThanOrEqual(KINDS.length + 2);
    const damaged: Record<string, Damage> = {};
    let collected = 0;
    let anchored = 0;
    let unproducible = 0;
    let twinCount = 0;
    let timed = 0;
    const untimed: string[] = [];
    const names: string[] = [];
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
      names.push(clean.svgId);
      // Mermaid's own drawing may name a reference it never defines (the sequence diagram's style names a gradient);
      // none of its references may leave the SVG.
      expect(Object.entries(clean.refs).filter(([, w]) => w === 'outside'), `${label}: the clean drawing's own references`).toEqual([]);
      const ids = [...new Set([...clean.ids, `d${clean.svgId}`, `i${clean.svgId}`])];
      const producible = ids.filter((id) => ANCHOR.test(id));
      // Each id's twins: the drawing's name in it replaced by run()'s name on this clock, and by itself without the
      // reader's prefix.
      const bare = clean.svgId.split(DRAWING_ID_PREFIX).join('');
      const twinsOf = (id: string): string[] => (id.includes(clean.svgId) ? [id.split(clean.svgId).join(`mermaid-${String(NOW)}`), id.split(clean.svgId).join(bare)] : []);
      const twins = [...new Set(ids.flatMap(twinsOf))].filter((id) => !producible.includes(id));
      // The row cannot pass by missing: the twins of the drawing's own three names are anchors.
      const own = [clean.svgId, `d${clean.svgId}`, `i${clean.svgId}`].flatMap(twinsOf);
      expect(own.length, `${label}: the drawing's own names' twins`).toBe(6);
      expect(own.filter((id) => !ANCHOR.test(id)), `${label}: the drawing's own names' twins in the anchor grammar`).toEqual([]);
      // No id slips through: every id the anchor grammar refuses names the drawing, so it is anchored as its twins
      // (review E2: an id outside the grammar that did not name the drawing would be neither anchored nor twinned).
      expect(ids.filter((id) => !ANCHOR.test(id) && !id.includes(clean.svgId)), `${label}: ids outside the anchor grammar that do not name the drawing`).toEqual([]);
      const anchorIds = [...producible, ...twins.filter((id) => ANCHOR.test(id))];
      collected += ids.length;
      anchored += producible.length;
      unproducible += ids.length - producible.length;
      twinCount += anchorIds.length - producible.length;
      timed += ids.filter((id) => id.includes(clean.svgId)).length;
      untimed.push(...ids.filter((id) => !id.includes(clean.svgId)).map((id) => `${label}: ${id}`));
      const anchors = anchorIds.map((id) => `<!-- id:${id} -->\n\nAn anchor named ${id}.\n`).join('\n');
      const second = await mount(`# Collide\n\n${anchors}\n${md}`);
      try {
        const rec = await second.host.record();
        const [drawn] = await drawings(second.host);
        const kept = await second.host.frame().evaluate((xs) => xs.filter((id) => {
          const el = document.getElementById(id);
          return el !== null && el.closest('figure') === null;
        }), anchorIds);
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
          lostAnchors: anchorIds.filter((id) => !kept.includes(id)),
        };
        if (!(damage.drawn && damage.sameText && damage.moved?.length === 0 && damage.lostAnchors.length === 0)) damaged[label] = damage;
      } finally {
        await second.host.close();
      }
    }
    return { damaged, cases: cases.length, collected, anchored, unproducible, twins: twinCount, timed, untimed, names };
  };

  let b14: B14 | undefined;

  it("L3.B14 (measurement row): an anchor for every id of each diagram kind's drawing the grammar admits and for each id's twins (run()'s name, the prefix-less name), the frame's clock fixed: the frame still readies with no violation, no request and one load", async () => {
    const got = await runB14();
    b14 = got;
    const damage = Object.values(got.damaged);
    figure('L3.B14', browser, 'cases', got.cases);
    figure('L3.B14', browser, 'idsCollected', got.collected);
    figure('L3.B14', browser, 'idsAnchored', got.anchored);
    figure('L3.B14', browser, 'idsOutsideAnchorGrammar', got.unproducible);
    figure('L3.B14', browser, 'twinsAnchored', got.twins);
    figure('L3.B14', browser, 'idsNamingTheDrawing', got.timed);
    figure('L3.B14', browser, 'casesDamaged', damage.length);
    figure('L3.B14', browser, 'casesDrawingTaken', damage.filter((d) => !d.sameText).length);
    figure('L3.B14', browser, 'anchorsRemoved', damage.reduce((n, d) => n + d.lostAnchors.length, 0));
    figure('L3.B14', browser, 'referencesTaken', damage.reduce((n, d) => n + (d.moved?.filter((m) => m.endsWith('-> outside')).length ?? 0), 0));
    console.warn(`frame-measure: ${JSON.stringify({ label: 'L3.B14 ids not naming the drawing', browser, ids: got.untimed })}`);
    console.warn(`frame-measure: ${JSON.stringify({ label: 'L3.B14 drawing names', browser, names: got.names })}`);
    console.warn(`frame-measure: ${JSON.stringify({ label: 'L3.B14 damage', browser, damaged: got.damaged })}`);
    expect(got.names).toHaveLength(got.cases);
    // Every id that is not the drawing's own is anchored as it is; each holding the drawing's name is anchored as twins:
    // the ids outside the anchor grammar are exactly those naming the drawing (asserted per case in runB14).
    expect(got.unproducible).toBe(got.timed);
    expect(got.twins).toBeGreaterThanOrEqual(2 * got.timed);
  }, 900_000);

  // The plan's criterion for L3.B14, on what the row above measured. Mermaid 12.1.0's run() names each drawing
  // `mermaid-<Date.now()>` and looks that name up in the whole document while it draws, so an authored anchor naming
  // the drawing's millisecond took the drawing, lost its own `d…` twin, and took marker and gradient references
  // (measured 2026-10-28 on Chromium: 14 of 14 cases, then KNOWN RED). Ledger C95(1): the reader draws through
  // render() under a name with a prefix render() cannot emit, so this row is plain; its mutation row drops the prefix.
  it('L3.B14: every diagram draws with SVG text equal to the clean one, every reference resolves as in the clean drawing, and every anchor stays', () => {
    // Never green without a measurement behind it: the row above must have run.
    expect(b14, 'the measurement row ran').toBeDefined();
    expect(b14?.damaged).toEqual({});
  });

  it("L3.B14p: the prefix's code point in the frame: a drawing's id finds it as an unescaped id selector, its own stylesheet styles it, and a url(#…) naming an id with the dot resolves", async () => {
    const host = await openFrameHost(await browserFor(browser));
    try {
      const nonce = freshNonce();
      await host.mount(srcdocFor(withMermaid(), `# One\n\n${fence('flowchart LR\n  A[Start] --> B[Stop]', 'Figure 1. One.')}`, nonce, { mermaid: {} }), frameCsp());
      await waitProgress(host, 1, `L3.B14p ${browser}`);
      await sleep(200);
      expect({ messages: data(await host.record()), violations: host.cspConsole }).toEqual({ messages: [readyOf(nonce)], violations: [] });
      const got = await host.frame().evaluate((prefix) => {
        const svg = document.querySelector('figure.mermaid-figure svg');
        if (svg === null) return null;
        const id = svg.id;
        const rect = svg.querySelector('g.node rect');
        // From the parent's side: a square clipped to its top-left 10 px by url(#…) naming a clip path whose id holds
        // the dot, and beside it the control, the same square unclipped (so a miss is the clip's, not the hit test's).
        const ns = 'http://www.w3.org/2000/svg';
        const probe = document.createElementNS(ns, 'svg');
        probe.setAttribute('width', '300');
        probe.setAttribute('height', '100');
        const clip = document.createElementNS(ns, 'clipPath');
        clip.id = `${prefix}probe-clip`;
        const small = document.createElementNS(ns, 'rect');
        small.setAttribute('width', '10');
        small.setAttribute('height', '10');
        clip.append(small);
        probe.append(clip);
        const square = (x: number, ref: string | null): SVGRectElement => {
          const r = document.createElementNS(ns, 'rect');
          r.setAttribute('x', String(x));
          r.setAttribute('width', '100');
          r.setAttribute('height', '100');
          if (ref !== null) r.setAttribute('clip-path', `url(#${ref})`);
          probe.append(r);
          return r;
        };
        const clipped = square(0, `${prefix}probe-clip`);
        const control = square(150, null);
        clip.setAttribute('clipPathUnits', 'userSpaceOnUse');
        document.body.prepend(probe);
        probe.scrollIntoView();
        const at = (el: Element, dx: number, dy: number): boolean => {
          const b = probe.getBoundingClientRect();
          return document.elementFromPoint(b.left + dx, b.top + dy) === el;
        };
        const out = {
          id,
          dot: id.includes('\u00b7'),
          selector: document.querySelector(`#${id}`) === svg,
          working: document.querySelectorAll(`#d${id}, #i${id}`).length,
          ownRule: Array.from(svg.querySelectorAll('style'), (st) => st.textContent ?? '').some((t) => t.includes(`#${id} `)),
          fill: rect === null ? null : getComputedStyle(rect).fill,
          clippedInside: at(clipped, 5, 5),
          clippedOutside: at(clipped, 50, 50),
          controlOutside: at(control, 200, 50),
        };
        probe.remove();
        return out;
      }, DRAWING_ID_PREFIX);
      const rgb = (hex: string): string => `rgb(${[1, 3, 5].map((i) => String(Number.parseInt(hex.slice(i, i + 2), 16))).join(', ')})`;
      expect(got).toEqual({
        id: `${DRAWING_ID_PREFIX}mermaid-0`,
        dot: true,
        selector: true,
        working: 0,
        ownRule: true,
        // The drawing's own `#<id> .node rect` rule gives the warm theme's node fill; without it, the fill is black.
        fill: rgb(THEME_VARIABLES.primaryColor),
        clippedInside: true,
        clippedOutside: false,
        controlOutside: true,
      });
      figure('L3.B14p', browser, 'drawingId', JSON.stringify(got?.id ?? null));
    } finally {
      await host.close();
    }
  }, 180_000);

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
