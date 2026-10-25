// Diagram tools (Task 23): source Copy, flowchart playback, definition cues and a root-local figure viewer.
import type { Cancel } from './env.js';
import { show as showCard } from './cards.js';
import { chrome, createJournal } from './journal.js';
import type { JournalControl } from './journal.js';
import type { FigureEntry } from './registry.js';
import type { FeatureContext } from './types.js';
import { QUAL_WINDOW } from './xrefs.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const PLAY_STEP_MS = 520;
const EDGE_RESET_MS = 600;
const COPY_RESET_MS = 1500;
const MIN_ZOOM = 0.08;
const MAX_ZOOM = 12;

type Edge = { readonly path: SVGPathElement; readonly from: string | null; readonly to: string | null; readonly label: SVGGElement | null };
type Graph = { readonly nodes: Map<string, SVGGElement>; readonly edges: readonly Edge[]; readonly clusters: readonly SVGGElement[] };
type Playback = {
  cancel: Cancel | null;
  readonly cancels: Set<Cancel>;
  readonly transient: Map<SVGPathElement, JournalControl>;
  clusters: JournalControl | null;
};

function graphOf(svg: SVGSVGElement): Graph {
  const nodes = new Map<string, SVGGElement>();
  for (const node of Array.from(svg.querySelectorAll<SVGGElement>('g.node'))) {
    const match = /(?:^|-)flowchart-(.+)-\d+$/.exec(node.id);
    if (match?.[1] !== undefined) nodes.set(match[1], node);
  }
  const edges: Edge[] = [];
  for (const path of Array.from(svg.querySelectorAll<SVGPathElement>('path.flowchart-link'))) {
    const raw = path.getAttribute('data-id') ?? path.id.replace(/^.*?-(L_)/, '$1');
    const match = /^L_(.+)_\d+$/.exec(raw);
    let from: string | null = null;
    let to: string | null = null;
    if (match?.[1] !== undefined) {
      const pair = match[1];
      for (let at = pair.indexOf('_'); at > 0; at = pair.indexOf('_', at + 1)) {
        const a = pair.slice(0, at);
        const b = pair.slice(at + 1);
        if (nodes.has(a) && nodes.has(b)) {
          from = a;
          to = b;
          break;
        }
      }
    }
    const label = raw === '' ? null : Array.from(svg.querySelectorAll<SVGGElement>('g.edgeLabel')).find((g) =>
      Array.from(g.querySelectorAll('[data-id]')).some((el) => el.getAttribute('data-id') === raw),
    ) ?? null;
    edges.push({ path, from, to, label });
  }
  return { nodes, edges, clusters: Array.from(svg.querySelectorAll<SVGGElement>('g.cluster')) };
}

function graphOrder(graph: Graph): readonly string[] {
  const incoming = new Map<string, number>();
  for (const id of graph.nodes.keys()) incoming.set(id, 0);
  for (const edge of graph.edges) if (edge.to !== null) incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1);
  const queue = [...graph.nodes.keys()].filter((id) => incoming.get(id) === 0);
  const seen = new Set<string>();
  const order: string[] = [];
  const visit = (): void => {
    while (queue.length > 0) {
      const id = queue.shift() as string;
      if (seen.has(id)) continue;
      seen.add(id);
      order.push(id);
      for (const edge of graph.edges) if (edge.from === id && edge.to !== null && !seen.has(edge.to)) queue.push(edge.to);
    }
  };
  visit();
  for (const id of graph.nodes.keys()) if (!seen.has(id)) {
    queue.push(id);
    visit();
  }
  return order;
}

const LABEL_BREAKS = new Set(['br', 'p', 'div', 'tspan', 'text']);

/** Read a rendered label without joining adjacent SVG/HTML label fragments into a different word. */
function labelOf(group: Element): string {
  let text = '';
  const walk = (node: Node): void => {
    if (node.nodeType === 3) {
      text += node.textContent ?? '';
      return;
    }
    if (node.nodeType !== 1) return;
    const el = node as Element;
    if (el.hasAttribute('data-docreader-chrome')) return;
    const breaks = LABEL_BREAKS.has(el.localName);
    if (breaks && text !== '' && !/\s$/.test(text)) text += ' ';
    for (const child of Array.from(el.childNodes)) walk(child);
    if (breaks && text !== '' && !/\s$/.test(text)) text += ' ';
  };
  walk(group);
  return text.replace(/\s+/g, ' ').trim();
}

function namedBlock(ctx: FeatureContext, text: string, whole: boolean): { readonly term?: string; readonly ref?: string } | null {
  if (text === '' || text.length > 200) return null;
  const terms = [...ctx.terms.all()].sort((a, b) => b.name.length - a.name.length);
  for (const term of terms) {
    const escaped = term.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    const re = new RegExp(whole ? `^${escaped}$` : `(?:^|[^\\p{L}\\p{N}_-])${escaped}(?:s|es)?(?=$|[^\\p{L}\\p{N}_-])`, term.exact ? 'u' : 'iu');
    if (re.test(text)) return { term: term.key };
  }
  if (ctx.vocab.words.ids === false) return null;
  if (whole) return ctx.index.get(text) === undefined ? null : { ref: text };
  const reach = QUAL_WINDOW + ctx.vocab.words.qualifiers.reduce((longest, word) => Math.max(longest, word.length), 0);
  const scan = ctx.vocab.idScan();
  for (let match = scan.exec(text); match !== null; match = scan.exec(text)) {
    const id = match[1] ?? '';
    if (ctx.index.get(id) === undefined) continue;
    if (ctx.vocab.qualifier.test(text.slice(Math.max(0, match.index - reach), match.index))) continue;
    return { ref: id };
  }
  return null;
}

function cloneSvg(ctx: FeatureContext, svg: SVGSVGElement): SVGSVGElement {
  const ids = [svg, ...Array.from(svg.querySelectorAll<Element>('[id]'))]
    .map((el) => el.id)
    .filter((id) => id !== '');
  const mapped = new Map(ids.map((id) => [id, ctx.chromeId('figure')]));
  const clone = ctx.journal.cloneSvg(svg, mapped);
  clone.classList.remove('flowing');
  for (const hidden of Array.from(clone.querySelectorAll('.rv-hide'))) hidden.classList.remove('rv-hide');
  return clone;
}

export function build(ctx: FeatureContext): void {
  const held = new Map<HTMLElement, { readonly entry: FigureEntry; readonly source: HTMLPreElement; readonly text: string }>();
  for (const entry of ctx.figures.all()) {
    const source = Array.from(entry.figure.children).find((el) => el.localName === 'pre' && el.classList.contains('mermaid') && !el.hasAttribute('data-docreader-chrome')) as HTMLPreElement | undefined;
    if (source !== undefined) held.set(entry.figure, { entry, source, text: source.textContent ?? '' });
  }
  const playbacks = new Map<SVGSVGElement, Playback>();
  const cancelPlayback = (playback: Playback): void => {
    playback.cancel?.();
    for (const cancel of playback.cancels) cancel();
    playback.cancels.clear();
    for (const scope of playback.transient.values()) scope.undoAll();
    playback.transient.clear();
    playback.clusters?.undoAll();
    playback.clusters = null;
  };
  // One teardown hook owns all short-lived replay scopes without retaining retired playback closures.
  ctx.journal.defer(() => {
    for (const playback of playbacks.values()) cancelPlayback(playback);
    playbacks.clear();
  });
  let overlay: HTMLElement | null = null;
  let stage: HTMLElement | null = null;
  let openSvg: SVGSVGElement | null = null;
  let opener: HTMLElement | null = null;
  let scale = 1;
  let x = 0;
  let y = 0;
  let resize: ReturnType<typeof ctx.env.observeResize> | null = null;
  let lastWidth = 0;
  let lastHeight = 0;
  let resetPointers: () => void = () => undefined;

  const clamp = (zoom: number): number => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
  const dimensions = (): { readonly width: number; readonly height: number; readonly stageWidth: number; readonly stageHeight: number } | null => {
    if (openSvg === null || stage === null) return null;
    const box = openSvg.viewBox.baseVal;
    const rect = openSvg.getBoundingClientRect();
    if (!ctx.live() || openSvg === null || stage === null) return null;
    return { width: box.width || rect.width || 1, height: box.height || rect.height || 1, stageWidth: stage.clientWidth, stageHeight: stage.clientHeight };
  };
  const apply = (): void => {
    if (openSvg !== null) ctx.journal.setStyle(openSvg, 'transform', `translate(${String(x)}px, ${String(y)}px) scale(${String(scale)})`);
  };
  const fitWhole = (): void => {
    const size = dimensions();
    if (size === null) return;
    scale = clamp(Math.min(1.5, Math.min(size.stageWidth / size.width, size.stageHeight / size.height) * 0.95));
    x = (size.stageWidth - size.width * scale) / 2;
    y = (size.stageHeight - size.height * scale) / 2;
    apply();
  };
  const fitReadable = (): void => {
    const size = dimensions();
    if (size === null) return;
    const whole = Math.min(size.stageWidth / size.width, size.stageHeight / size.height) * 0.95;
    const tall = size.height / size.width > size.stageHeight / size.stageWidth;
    const readable = Math.min(1.25, Math.max(whole, tall ? size.stageWidth * 0.95 / size.width : size.stageHeight * 0.95 / size.height));
    if (readable <= whole * 1.05) {
      fitWhole();
      return;
    }
    scale = clamp(readable);
    x = tall ? (size.stageWidth - size.width * scale) / 2 : 16;
    y = tall ? 16 : (size.stageHeight - size.height * scale) / 2;
    apply();
  };
  const zoom = (factor: number, centerX?: number, centerY?: number): void => {
    if (stage === null) return;
    const cx = centerX ?? stage.clientWidth / 2;
    const cy = centerY ?? stage.clientHeight / 2;
    const next = clamp(scale * factor);
    x = cx - (cx - x) * next / scale;
    y = cy - (cy - y) * next / scale;
    scale = next;
    apply();
  };
  const close = (): void => {
    if (overlay === null || !overlay.classList.contains('open')) return;
    const active = ctx.root.ownerDocument.activeElement;
    const card = ctx.root.querySelector('.xcard.open');
    const ownedFocus = active !== null && (overlay.contains(active) || card?.contains(active) === true);
    ctx.overlays.close('card');
    resetPointers();
    ctx.journal.toggleClass(overlay, 'open', false);
    ctx.journal.toggleClass(ctx.root, 'fig-open', false);
    stage?.replaceChildren();
    openSvg = null;
    resize?.cancel();
    resize = null;
    lastWidth = 0;
    lastHeight = 0;
    const back = opener;
    opener = null;
    if (ownedFocus && back !== null && ctx.root.contains(back)) back.focus({ preventScroll: true });
  };
  const open = (source: SVGSVGElement, caption: string, trigger: HTMLElement): void => {
    if (overlay === null || stage === null) return;
    ctx.overlays.close('card');
    opener = trigger;
    const playback = playbacks.get(source);
    if (playback !== undefined) cancelPlayback(playback);
    const copy = cloneSvg(ctx, source);
    stage.replaceChildren(copy);
    openSvg = copy;
    const cap = overlay.querySelector('.fo-cap');
    if (cap !== null) cap.textContent = caption;
    ctx.journal.toggleClass(overlay, 'open', true);
    ctx.journal.toggleClass(ctx.root, 'fig-open', true);
    fitReadable();
    if (!ctx.live() || overlay === null || stage === null || openSvg === null) return;
    lastWidth = stage.clientWidth;
    lastHeight = stage.clientHeight;
    (overlay.querySelector('.fo-close') as HTMLElement | null)?.focus({ preventScroll: true });
    resize = ctx.env.observeResize(() => {
      if (stage === null || openSvg === null) return;
      const width = stage.clientWidth;
      const height = stage.clientHeight;
      if (lastWidth === 0 || lastHeight === 0) { lastWidth = width; lastHeight = height; return; }
      x += (width - lastWidth) / 2;
      y += (height - lastHeight) / 2;
      lastWidth = width;
      lastHeight = height;
      const size = dimensions();
      if (size === null) return;
      if (x + size.width * scale < 40 || x > size.stageWidth - 40 || y + size.height * scale < 40 || y > size.stageHeight - 40) fitReadable();
      else apply();
    });
    resize?.observe(stage);
  };

  const makeOverlay = (): void => {
    if (overlay !== null) return;
    const doc = ctx.root.ownerDocument;
    overlay = chrome(doc, 'div', { className: 'fig-overlay', attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Figure, full screen', tabindex: '-1' } });
    const cap = chrome(doc, 'span', { className: 'fo-cap' });
    const controls = chrome(doc, 'span', { className: 'fo-btns' });
    const control = (text: string, cls: string, action: () => void): HTMLButtonElement => {
      const button = chrome(doc, 'button', { className: cls, text, attrs: { type: 'button' } });
      ctx.journal.listen(button, 'click', action);
      return button;
    };
    controls.append(control('-', 'fo-out', () => zoom(1 / 1.25)), control('+', 'fo-in', () => zoom(1.25)), control('Fit', 'fo-fit', fitWhole), control('Close', 'fo-close', close));
    const bar = chrome(doc, 'div', { className: 'fo-bar' }, [cap, controls]);
    stage = chrome(doc, 'div', { className: 'fo-stage' });
    overlay.append(bar, stage);
    ctx.journal.insert(overlay, ctx.root, null);
    ctx.overlays.register('figure', { isOpen: () => overlay?.classList.contains('open') === true, close });
    const pointers = new Map<number, { x: number; y: number }>();
    let pinch: { distance: number; x: number; y: number } | null = null;
    let down: { readonly node: Element | null; readonly x: number; readonly y: number; readonly at: number; readonly count: number; moved: boolean } | null = null;
    let lastTap = 0;
    let moved = false;
    resetPointers = (): void => {
      const currentStage = stage;
      if (currentStage !== null && currentStage.isConnected) {
        for (const pointerId of pointers.keys()) {
          if (currentStage.hasPointerCapture?.(pointerId)) currentStage.releasePointerCapture?.(pointerId);
        }
      }
      pointers.clear();
      pinch = null;
      down = null;
      moved = false;
      ctx.journal.toggleClass(stage as HTMLElement, 'drag', false);
    };
    ctx.journal.listen(stage, 'wheel', (event) => {
      const e = event as WheelEvent;
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const r = stage?.getBoundingClientRect();
        if (r === undefined) return;
        zoom(Math.exp(-e.deltaY * (e.deltaMode === 0 ? 0.002 : 0.05)), e.clientX - r.left, e.clientY - r.top);
      } else {
        const unit = e.deltaMode === 0 ? 1 : 16;
        x -= e.deltaX * unit;
        y -= e.deltaY * unit;
        apply();
      }
    }, { passive: false });
    ctx.journal.listen(stage, 'pointerdown', (event) => {
      const e = event as PointerEvent;
      const target = (e.target as { closest?: (selector: string) => unknown } | null)?.closest?.('.dnode') ?? null;
      if (e.pointerType !== 'mouse') e.preventDefault(); // Definition cards open only from qualified pointer-up, not touch focus.
      (event.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      const freshSequence = pointers.size === 0;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      ctx.journal.toggleClass(stage as HTMLElement, 'drag', true);
      if (freshSequence) moved = false;
      if (pointers.size === 1) down = { node: target as Element | null, x: e.clientX, y: e.clientY, at: ctx.env.now(), count: 1, moved: false };
      else {
        moved = true;
        down = null;
      }
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        if (a !== undefined && b !== undefined) pinch = { distance: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      }
      if (e.pointerType !== 'mouse' && pointers.size === 1) {
        const now = ctx.env.now();
        if (now - lastTap < 300) {
          const r = (stage as HTMLElement).getBoundingClientRect();
          zoom(2, e.clientX - r.left, e.clientY - r.top);
        }
        lastTap = now;
      }
    }, { capture: true });
    ctx.journal.listen(stage, 'pointermove', (event) => {
      const e = event as PointerEvent;
      const point = pointers.get(e.pointerId);
      if (point === undefined) return;
      if (pointers.size === 1) {
        if (down !== null && Math.hypot(e.clientX - down.x, e.clientY - down.y) >= 8) moved = true;
        x += e.clientX - point.x;
        y += e.clientY - point.y;
        point.x = e.clientX;
        point.y = e.clientY;
        apply();
        return;
      }
      point.x = e.clientX;
      point.y = e.clientY;
      const [a, b] = [...pointers.values()];
      if (a === undefined || b === undefined) return;
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      const centerX = (a.x + b.x) / 2;
      const centerY = (a.y + b.y) / 2;
      if (pinch !== null && pinch.distance > 0) {
        const r = (stage as HTMLElement).getBoundingClientRect();
        x += centerX - pinch.x;
        y += centerY - pinch.y;
        zoom(distance / pinch.distance, centerX - r.left, centerY - r.top);
      }
      pinch = { distance, x: centerX, y: centerY };
    });
    const endPointer = (event: Event): void => {
      const e = event as PointerEvent;
      const tap = down;
      const pointCount = pointers.size;
      const eligible = e.type === 'pointerup' && tap !== null && pointCount === 1 && tap.count === 1 && !moved && tap.node !== null && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) < 8 && ctx.env.now() - tap.at < 600;
      if (eligible) showCard(ctx, tap.node as Element);
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = null;
      if (pointers.size === 0) {
        down = null;
        ctx.journal.toggleClass(stage as HTMLElement, 'drag', false);
      }
    };
    ctx.journal.listen(stage, 'pointerup', endPointer);
    ctx.journal.listen(stage, 'pointercancel', endPointer);
    ctx.journal.defer(resetPointers);
    const viewerStops = (): HTMLElement[] => {
      const stops = Array.from((overlay as HTMLElement).querySelectorAll<HTMLElement>('button:not([disabled]), [tabindex]:not([tabindex="-1"])'));
      const card = ctx.root.querySelector('.xcard.open');
      if (card !== null) stops.push(...Array.from(card.querySelectorAll<HTMLElement>('a[href]')));
      return stops;
    };
    const cycleViewerTab = (e: KeyboardEvent): boolean => {
      const stops = viewerStops();
      const at = stops.indexOf(ctx.root.ownerDocument.activeElement as HTMLElement);
      if (at === -1) return false;
      const next = (at + (e.shiftKey ? -1 : 1) + stops.length) % stops.length;
      stops[next]?.focus();
      e.preventDefault();
      return true;
    };
    ctx.journal.listen(ctx.root, 'keydown', (event) => {
      const e = event as KeyboardEvent;
      if (e.key !== 'Tab' || e.shiftKey || overlay?.classList.contains('open') !== true) return;
      const card = ctx.root.querySelector('.xcard.open');
      if (card === null || !card.contains(e.target as Node)) return;
      if (cycleViewerTab(e)) e.stopPropagation();
    }, true);
    ctx.journal.listen(overlay, 'keydown', (event) => {
      const e = event as KeyboardEvent;
      if (e.key === 'Tab') {
        cycleViewerTab(e);
        return;
      }
      if (e.key === 'Escape') {
        const target = e.target as { closest?: (selector: string) => unknown } | null;
        if (ctx.overlays.isOpen('card') && target?.closest?.('.dnode, .xcard') !== null) { ctx.overlays.close('card'); e.preventDefault(); e.stopPropagation(); return; }
        e.preventDefault();
        e.stopPropagation();
        close();
      } else if (e.key === '+' || e.key === '=') zoom(1.25);
      else if (e.key === '-') zoom(1 / 1.25);
      else if (e.key === '0') fitWhole();
      else if (/^Arrow/.test(e.key)) {
        if (e.key === 'ArrowLeft') x += 60;
        if (e.key === 'ArrowRight') x -= 60;
        if (e.key === 'ArrowUp') y += 60;
        if (e.key === 'ArrowDown') y -= 60;
        apply();
        e.preventDefault();
      }
    });
  };

  const define = (svg: SVGSVGElement): void => {
    type Candidate = { readonly group: SVGGElement; readonly named: { readonly term?: string; readonly ref?: string }; readonly whole: boolean };
    const candidates: Candidate[] = [];
    const candidateOf = (group: SVGGElement, whole: boolean): Candidate | null => {
      if (group.querySelector('.dn-ring') !== null) return null;
      const prior = group.dataset.term === undefined ? group.dataset.ref === undefined ? null : { ref: group.dataset.ref } : { term: group.dataset.term };
      const named = prior ?? namedBlock(ctx, labelOf(group), whole);
      return named === null ? null : { group, named, whole };
    };
    for (const node of Array.from(svg.querySelectorAll<SVGGElement>('g.node'))) {
      const candidate = candidateOf(node, false);
      if (candidate !== null) candidates.push(candidate);
    }
    for (const label of Array.from(svg.querySelectorAll<SVGGElement>('g.edgeLabel, g.cluster-label'))) {
      const candidate = candidateOf(label, true);
      if (candidate !== null) candidates.push(candidate);
    }
    if (candidates.length === 0) return;

    // Semantic controls do not depend on a visible SVG box; only cue paint waits for geometry.
    for (const { group, named } of candidates) {
      if (!group.classList.contains('dnode')) {
        ctx.journal.toggleClass(group, 'dnode', true);
        ctx.journal.setAttribute(group, 'tabindex', '0');
        ctx.journal.setAttribute(group, 'role', 'button');
        ctx.journal.setAttribute(group, 'aria-haspopup', 'dialog');
        ctx.journal.setAttribute(group, 'aria-expanded', 'false');
        if (named.term === undefined) ctx.journal.setAttribute(group, 'data-ref', named.ref ?? '');
        else ctx.journal.setAttribute(group, 'data-term', named.term);
      }
    }
    // Geometry is read for every candidate before chrome or style writes can invalidate layout.
    const measured = candidates.flatMap((candidate) => {
      try {
        const box = candidate.group.getBBox();
        return box.width > 0 && box.height > 0 ? [{ ...candidate, box }] : [];
      } catch {
        return [];
      }
    });
    for (const { group, box, whole } of measured) {
      const ring = ctx.root.ownerDocument.createElementNS(SVG_NS, 'rect');
      ring.setAttribute('class', 'dn-ring');
      ring.setAttribute('x', String(box.x - (whole ? 2 : 4)));
      ring.setAttribute('y', String(box.y - (whole ? 2 : 4)));
      ring.setAttribute('width', String(box.width + (whole ? 4 : 8)));
      ring.setAttribute('height', String(box.height + (whole ? 4 : 8)));
      ring.setAttribute('rx', '6');
      const dot = ctx.root.ownerDocument.createElementNS(SVG_NS, 'circle');
      dot.setAttribute('class', 'dn-dot');
      dot.setAttribute('cx', String(whole ? box.x + box.width / 2 : box.x + box.width - 1));
      dot.setAttribute('cy', String(whole ? box.y + Math.min(14, box.height / 4) : box.y + 1));
      dot.setAttribute('r', '3.5');
      ctx.journal.insert(ring, group, null);
      ctx.journal.insert(dot, group, null);
      ctx.journal.setStyle(ring, 'fill', 'none', true);
      ctx.journal.setStyle(ring, 'stroke', '#0b6b66', true);
      ctx.journal.setStyle(ring, 'stroke-width', '1.5px', true);
      ctx.journal.setStyle(dot, 'fill', '#0b6b66', true);
      ctx.journal.setStyle(dot, 'stroke', '#ffffff', true);
      ctx.journal.setStyle(dot, 'stroke-width', '1.5px', true);
    }
    ctx.journal.setAttribute(svg, 'role', 'group');
  };

  const attach = (): void => {
    for (const { entry, source, text } of held.values()) {
      if (!ctx.root.contains(source)) continue;
      let tools = Array.from(entry.figure.children).find((el) => el.classList.contains('tools')) as HTMLElement | undefined;
      const drawing = Array.from(entry.figure.querySelectorAll<SVGSVGElement>('pre[data-docreader-chrome] > svg'))[0];
      if (tools === undefined && (ctx.host.present.has('copy') || drawing !== undefined)) {
        tools = chrome(ctx.root.ownerDocument, 'div', { className: 'tools', attrs: { role: 'toolbar', 'aria-label': `Figure ${entry.no} tools` } });
        ctx.journal.insert(tools, entry.figure, drawing === undefined ? entry.figure.firstChild : drawing.nextSibling);
      }
      if (tools === undefined) continue;
      if (ctx.host.present.has('copy') && Array.from(tools.children).every((child) => child.textContent !== 'Copy Mermaid')) {
        const copy = chrome(ctx.root.ownerDocument, 'button', { text: 'Copy Mermaid', attrs: { type: 'button' } });
        ctx.journal.listen(copy, 'click', () => {
          void ctx.host.copy(text).then((result) => {
            if (!ctx.live() || !ctx.root.contains(copy)) return;
            copy.textContent = result === null ? 'Copy failed' : 'Copied';
            ctx.env.timeout(() => { if (ctx.live()) copy.textContent = 'Copy Mermaid'; }, COPY_RESET_MS);
          });
        });
        tools.append(copy);
      }
      if (drawing === undefined || tools.getAttribute('data-diagram-tools') === 'true') continue;
      ctx.journal.setAttribute(tools, 'data-diagram-tools', 'true');
      const graph = graphOf(drawing);
      if (graph.nodes.size > 0 && graph.edges.length > 0) {
        const play = chrome(ctx.root.ownerDocument, 'button', { text: 'Play', attrs: { type: 'button', 'aria-label': 'Play this diagram step by step' } });
        ctx.journal.listen(play, 'click', () => {
          const prior = playbacks.get(drawing);
          if (prior !== undefined) cancelPlayback(prior);
          const playback: Playback = { cancel: null, cancels: new Set(), transient: new Map(), clusters: null };
          playbacks.set(drawing, playback);
          const scoped = (): JournalControl => createJournal(ctx.live, (fn) => { ctx.operate(fn); });
          const schedule = (fn: () => void, ms: number): Cancel => {
            let cancel: Cancel;
            cancel = ctx.env.timeout(() => { playback.cancels.delete(cancel); fn(); }, ms);
            playback.cancels.add(cancel);
            return cancel;
          };
          const frame = (fn: () => void): Cancel => {
            let cancel: Cancel;
            cancel = ctx.env.frame(() => { playback.cancels.delete(cancel); fn(); });
            playback.cancels.add(cancel);
            return cancel;
          };
          const cleanupEdge = (edge: Edge, scope: JournalControl): void => {
            if (!ctx.live() || playbacks.get(drawing) !== playback) return;
            scope.undoAll();
            playback.transient.delete(edge.path);
            if (edge.label !== null) ctx.journal.toggleClass(edge.label, 'rv-hide', false);
          };
          const clusterScope = scoped();
          playback.clusters = clusterScope;
          for (const cluster of graph.clusters) clusterScope.journal.setStyle(cluster, 'opacity', '0.35');
          const order = graphOrder(graph);
          const shown = new Set<string>();
          for (const node of graph.nodes.values()) ctx.journal.toggleClass(node, 'rv-hide', true);
          for (const edge of graph.edges) { ctx.journal.toggleClass(edge.path, 'rv-hide', true); if (edge.label !== null) ctx.journal.toggleClass(edge.label, 'rv-hide', true); }
          let at = 0;
          const step = (): void => {
            if (!ctx.live() || playbacks.get(drawing) !== playback) return;
            const id = order[at++];
            if (id === undefined) {
              for (const edge of graph.edges) {
                ctx.journal.toggleClass(edge.path, 'rv-hide', false);
                if (!playback.transient.has(edge.path) && edge.label !== null) ctx.journal.toggleClass(edge.label, 'rv-hide', false);
              }
              playback.clusters?.undoAll();
              playback.clusters = null;
              play.textContent = 'Replay';
              return;
            }
            shown.add(id);
            const node = graph.nodes.get(id);
            if (node !== undefined) ctx.journal.toggleClass(node, 'rv-hide', false);
            for (const edge of graph.edges) if (edge.path.classList.contains('rv-hide') && edge.from !== null && edge.to !== null && shown.has(edge.from) && shown.has(edge.to)) {
              ctx.journal.toggleClass(edge.path, 'rv-hide', false);
              if (typeof edge.path.getTotalLength !== 'function') {
                if (edge.label !== null) ctx.journal.toggleClass(edge.label, 'rv-hide', false);
                continue;
              }
              const scope = scoped();
              playback.transient.set(edge.path, scope);
              const length = edge.path.getTotalLength();
              scope.journal.setStyle(edge.path, 'stroke-dasharray', `${String(length)} ${String(length)}`);
              scope.journal.setStyle(edge.path, 'stroke-dashoffset', String(length));
              scope.journal.toggleClass(edge.path, 'rv-draw', true);
              frame(() => frame(() => {
                if (ctx.live() && playbacks.get(drawing) === playback && playback.transient.get(edge.path) === scope) {
                  scope.journal.setStyle(edge.path, 'stroke-dashoffset', '0');
                }
              }));
              schedule(() => cleanupEdge(edge, scope), EDGE_RESET_MS);
            }
            playback.cancel = schedule(step, ctx.env.reducedMotion() ? 60 : PLAY_STEP_MS);
          };
          play.textContent = 'Playing...';
          step();
        });
        const animate = chrome(ctx.root.ownerDocument, 'button', { text: 'Animate edges', attrs: { type: 'button', 'aria-pressed': 'false' } });
        ctx.journal.listen(animate, 'click', () => {
          const on = !drawing.classList.contains('flowing');
          ctx.journal.toggleClass(drawing, 'flowing', on);
          ctx.journal.toggleClass(animate, 'on', on);
          ctx.journal.setAttribute(animate, 'aria-pressed', String(on));
        });
        tools.append(play, animate);
        define(drawing);
      }
      const full = chrome(ctx.root.ownerDocument, 'button', { text: 'Full screen', attrs: { type: 'button' } });
      ctx.journal.listen(full, 'click', () => { makeOverlay(); open(drawing, `Figure ${entry.no}. ${entry.caption}`, full); });
      tools.append(full);
      ctx.journal.listen(drawing, 'dblclick', () => { makeOverlay(); open(drawing, `Figure ${entry.no}. ${entry.caption}`, full); });
    }
  };

  ctx.journal.defer(() => { for (const playback of playbacks.values()) playback.cancel?.(); resize?.cancel(); });
  ctx.journal.defer(ctx.events.on('reveal', () => { close(); }));
  ctx.onRelayout(attach);
  attach();
}
