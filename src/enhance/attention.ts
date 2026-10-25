// Attention marks and the product lens's classes (the reference layout, section 12c; Task 19): what needs the reader, risks,
// file-path tone and technical detail. Peek controls are deferred until the reader first selects the product lens,
// then join their source blocks' folds.
import { CHROME_ATTR, chrome } from './journal.js';
import type { Block, TableBlock } from './registry.js';
import type { FeatureContext } from './types.js';

interface Peek {
  /** The root child whose Product-lens presentation and adjacent control belong together. */
  readonly target: HTMLElement;
  /** The registered block source: a filtered table's inner wrapper stays distinct from its presentation target. */
  readonly source: HTMLElement;
  readonly label: string;
}

interface PendingPeek {
  readonly bar: HTMLElement;
  readonly target: HTMLElement;
  readonly source: HTMLElement;
}

interface FoldJoinState {
  built: boolean;
  completed: boolean;
  pending: PendingPeek[];
}

/** Lazy and context-keyed: importing attention creates no reader state. */
let foldJoins: WeakMap<FeatureContext, FoldJoinState> | undefined;

const text = (node: Node): string => (node.textContent ?? '').replace(/\s+/g, ' ').trim();

function statusCell(row: HTMLTableRowElement, table: TableBlock, ctx: FeatureContext): Element | null {
  const at = table.heads.findIndex((head, index) => index > 0 && ctx.vocab.attention.status.test(head));
  return at > 0 ? row.cells[at] ?? null : null;
}

function ownerCell(row: HTMLTableRowElement, table: TableBlock, ctx: FeatureContext): Element | null {
  const at = table.heads.findIndex((head, index) => index > 0 && ctx.vocab.attention.who.test(head));
  return at > 0 ? row.cells[at] ?? null : null;
}

/** The filtered table wrapper is the root-child presentation block; registry identity stays on the inner wrapper. */
function presentationTarget(ctx: FeatureContext, block: Block): HTMLElement {
  if (block.kind !== 'table') return block.el;
  const wrapper = block.el.parentElement;
  return wrapper?.classList.contains('tbl-block') && wrapper.parentElement === ctx.root ? wrapper : block.el;
}

function markAttention(ctx: FeatureContext): void {
  for (const block of ctx.blocks) {
    if (block.kind !== 'table') continue;
    const question = block.heads.length === 2 && ctx.vocab.attention.question.test(block.heads[0] ?? '');
    for (const row of block.rows) {
      if (row.classList.contains('group')) continue;
      const status = statusCell(row, block, ctx);
      const owner = ownerCell(row, block, ctx);
      const pill = status?.querySelector('.pill') ?? null;
      const open = block.isIndex && pill !== null && pill.classList.contains('wait');
      const yours = owner !== null && ctx.vocab.addressee.test(text(owner));
      const answer = row.cells[1];
      const unanswered = question && answer !== undefined && (text(answer) === '' || ctx.vocab.attention.openAnswers.test(text(answer)));
      const blocking = Array.from(row.cells).some((cell, index) => index > 0 && ctx.vocab.attention.blocking.test(text(cell)));
      if (open || yours || unanswered || blocking) ctx.journal.toggleClass(row, 'attn', true);
      if (pill?.classList.contains('no') && ctx.vocab.attention.risk.test(text(pill))) ctx.journal.toggleClass(row, 'risk', true);
    }
  }

  for (const entry of ctx.index.all()) {
    if (entry.kind !== 'rule' || entry.status === null) continue;
    const pill = entry.target.querySelector('.rule-head .pill');
    if (pill === null) continue;
    if (entry.status === 'no' && ctx.vocab.attention.risk.test(text(pill))) ctx.journal.toggleClass(entry.target, 'risk', true);
    else if (ctx.vocab.attention.openStatus.test(text(pill))) ctx.journal.toggleClass(entry.target, 'attn', true);
  }

  for (const code of Array.from(ctx.root.querySelectorAll('p code, li code, td code, dd code'))) {
    if (code.closest('pre') === null && ctx.vocab.path.test(text(code))) ctx.journal.toggleClass(code, 'path', true);
  }
}

function technicalBlocks(ctx: FeatureContext): Peek[] {
  const peeks: Peek[] = [];
  for (const block of ctx.blocks) {
    if (block.kind === 'code') {
      const lines = (block.pre?.textContent ?? '').replace(/\n$/, '').split('\n').length;
      if (lines > 4 && block.el.closest('.callout, .short') === null) {
        block.tech = true;
        const target = presentationTarget(ctx, block);
        ctx.journal.toggleClass(target, 'tech', true);
        peeks.push({ target, source: block.el, label: `${String(lines)} lines` });
      }
      continue;
    }
    const excluded = block.glossary || block.rows.length < 3 || block.el.closest('.callout, .short') !== null;
    const decision = block.isIndex && block.heads.some((head) => ctx.vocab.decisionHeader.test(head));
    if (excluded || decision) continue;
    const cells = block.rows.flatMap((row) => Array.from(row.cells));
    const codey = cells.filter((cell) => {
      const all = text(cell).length;
      const coded = Array.from(cell.querySelectorAll('code')).reduce((total, node) => total + text(node).length, 0);
      return all > 0 && coded / all > 0.45;
    }).length;
    const technical = cells.length > 0 && codey / cells.length > 0.3 || block.heads.filter((head) => ctx.vocab.techHeader.test(head)).length >= Math.max(1, Math.ceil(block.heads.length / 2));
    if (!technical) continue;
    block.tech = true;
    const target = presentationTarget(ctx, block);
    ctx.journal.toggleClass(target, 'tech', true);
    peeks.push({ target, source: block.el, label: `${String(block.rows.length)} rows` });
  }
  return peeks;
}

function joinsLive(ctx: FeatureContext, pair: PendingPeek): boolean {
  return ctx.live() && pair.bar.parentElement === ctx.root && pair.bar.hasAttribute(CHROME_ATTR) && pair.target.parentElement === ctx.root && (pair.source === pair.target || pair.target.contains(pair.source));
}

function join(ctx: FeatureContext, pair: PendingPeek): void {
  if (!joinsLive(ctx, pair)) return;
  ctx.folds.join(pair.bar, pair.target);
}

/** Complete retained pre-fold Product controls. Settings owns the one synchronous completion boundary. */
export function completeFoldJoins(ctx: FeatureContext): void {
  const state = foldJoins?.get(ctx);
  if (state === undefined || !ctx.live() || state.completed) return;
  state.completed = true;
  const pending = state.pending;
  state.pending = [];
  for (const pair of pending) {
    join(ctx, pair);
    if (!ctx.live()) return;
  }
}

function buildPeeks(ctx: FeatureContext, state: FoldJoinState, peeks: readonly Peek[]): void {
  for (const { target, source, label } of peeks) {
    const bar = chrome(ctx.root.ownerDocument, 'div', { className: 'peek-bar' });
    const button = chrome(ctx.root.ownerDocument, 'button', { className: 'peek-btn', attrs: { type: 'button', 'aria-expanded': 'false' } });
    const set = (shown: boolean): void => {
      button.textContent = shown ? 'Fold engineering detail' : `Show engineering detail - ${label}`;
      button.setAttribute('aria-expanded', String(shown));
    };
    set(false);
    ctx.journal.listen(button, 'click', () => {
      const shown = !target.classList.contains('peek-open');
      ctx.journal.toggleClass(target, 'peek-open', shown);
      set(shown);
    });
    bar.append(button);
    ctx.journal.insert(bar, ctx.root, target.nextSibling);
    const pair: PendingPeek = { bar, target, source };
    if (state.completed) join(ctx, pair);
    else state.pending.push(pair);
    if (!ctx.live()) return;
  }
}

/** Build attention marks synchronously and defer product-lens controls until first use. */
export function build(ctx: FeatureContext): void {
  const state: FoldJoinState = { built: false, completed: false, pending: [] };
  (foldJoins ??= new WeakMap()).set(ctx, state);
  ctx.journal.defer(() => {
    foldJoins?.delete(ctx);
    state.pending = [];
  });
  markAttention(ctx);
  const peeks = technicalBlocks(ctx);
  const addPeeks = (): void => {
    if (state.built || !ctx.live()) return;
    state.built = true;
    buildPeeks(ctx, state, peeks);
  };
  if (ctx.state.prefs.lens === 'product') addPeeks();
  ctx.events.on('prefs', (prefs) => {
    if (prefs.lens === 'product') addPeeks();
  });
}
