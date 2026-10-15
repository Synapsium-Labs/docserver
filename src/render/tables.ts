// Tables (docserver L1; architecture section C, the "Tables" row; contract section 2.9). Three parts:
// - pyTable, the GFM table block rule. It is markdown-it 14.3.2's own rule with each of its five `trim()`
//   calls made Python's `str.strip()` (pyStrip), because the reference's parser, a Python port of the same
//   rule, strips there: the header line and each body line, every cell's text, and the delimiter row's
//   columns (which can only hold `|`, `-`, `:`, spaces and tabs, so there the two agree). JavaScript's
//   trim() and Python's strip() differ on U+FEFF (JS strips it, Python keeps it) and on \x1c-\x1f and \x85
//   (the reverse). A stripped line edge decides whether an outer pipe makes an empty first or last column,
//   so whether the header matches the delimiter row and the table exists at all, and whether a line of such
//   whitespace ends the table; a stripped cell edge is the cell's text. Everything else is the rule as
//   markdown-it ships it, so it keeps the name `table` and its place in the block chain, with one addition:
//   the limit on the empty cells added to short rows holds for the whole document as well as for each
//   table. markdown-it counts them per table only, so many small tables could each add 65536 cells, about
//   1300 bytes of html per byte of input, and exhaust the heap (an out-of-memory error is fatal, so render()
//   could not even fall back). The document's count is env.emptyCells; past the limit a table ends exactly
//   as it ends at its own limit.
// - tableCode, a core rule: inside a table, a code span's `\|` becomes `|`. The reference does this on
//   its finished HTML, for every <code>…</code> between <table…> and </table>; the only <code> a table can
//   hold is a code span in a cell, so this rule changes those code spans and nothing else. The table rule
//   already turns `\|` into `|` when it splits a row, so this only shows on `\\|` (`a\\|b` renders a|b).
// - renderTableOpen and renderTableClose: every table is wrapped in <div class="table-wrapper">…</div>,
//   as the reference wraps every <table…> and </table> of its HTML, and counted for meta.tables.
import type { Options, Renderer, StateBlock, StateCore, Token } from 'markdown-it';
import type { RenderEnv } from './env.js';
import { pyStrip } from './pyText.js';

/**
 * Empty cells one table may add to short rows before it ends (markdown-it's MAX_AUTOCOMPLETED_CELLS), and
 * the empty cells all the tables of one document may add.
 */
const MAX_AUTOCOMPLETED_CELLS = 0x10000;

const PIPE = 0x7c;
const DASH = 0x2d;
const COLON = 0x3a;
const BACKSLASH = 0x5c;
const ALIGN = /^:?-+:?$/;

/** markdown-it's isSpace: a space or a tab, nothing else. */
function isSpace(code: number): boolean {
  return code === 0x09 || code === 0x20;
}

function getLine(state: StateBlock, line: number): string {
  const pos = (state.bMarks[line] ?? 0) + (state.tShift[line] ?? 0);
  return state.src.slice(pos, state.eMarks[line]);
}

/** A row split on unescaped pipes; an escaped pipe `\|` becomes `|` in its cell (markdown-it's escapedSplit). */
function escapedSplit(str: string): string[] {
  const result: string[] = [];
  const max = str.length;
  let pos = 0;
  let ch = str.charCodeAt(pos);
  let isEscaped = false;
  let lastPos = 0;
  let current = '';
  while (pos < max) {
    if (ch === PIPE) {
      if (!isEscaped) {
        result.push(current + str.substring(lastPos, pos));
        current = '';
        lastPos = pos + 1;
      } else {
        current += str.substring(lastPos, pos - 1);
        lastPos = pos;
      }
    }
    isEscaped = ch === BACKSLASH;
    pos += 1;
    ch = str.charCodeAt(pos);
  }
  result.push(current + str.substring(lastPos));
  return result;
}

/** A row's cells: the line split, then one empty cell dropped from each end (the outer pipes). */
function rowCells(line: string): string[] {
  const columns = escapedSplit(line);
  if (columns.length > 0 && columns[0] === '') columns.shift();
  if (columns.length > 0 && columns[columns.length - 1] === '') columns.pop();
  return columns;
}

/** The delimiter row's alignments, or null when the line is not a delimiter row. */
function alignments(state: StateBlock, line: number): string[] | null {
  let pos = (state.bMarks[line] ?? 0) + (state.tShift[line] ?? 0);
  const max = state.eMarks[line] ?? 0;
  if (pos >= max) return null;
  const firstCh = state.src.charCodeAt(pos);
  pos += 1;
  if (firstCh !== PIPE && firstCh !== DASH && firstCh !== COLON) return null;
  if (pos >= max) return null;
  const secondCh = state.src.charCodeAt(pos);
  pos += 1;
  if (secondCh !== PIPE && secondCh !== DASH && secondCh !== COLON && !isSpace(secondCh)) return null;
  // A first `-` followed by a space would be a list item.
  if (firstCh === DASH && isSpace(secondCh)) return null;
  while (pos < max) {
    const ch = state.src.charCodeAt(pos);
    if (ch !== PIPE && ch !== DASH && ch !== COLON && !isSpace(ch)) return null;
    pos += 1;
  }
  const columns = getLine(state, line).split('|');
  const aligns: string[] = [];
  for (const [i, column] of columns.entries()) {
    const t = pyStrip(column);
    if (t === '') {
      // An empty column is allowed before and after the table, never between two columns.
      if (i === 0 || i === columns.length - 1) continue;
      return null;
    }
    if (!ALIGN.test(t)) return null;
    if (t.charCodeAt(t.length - 1) === COLON) aligns.push(t.charCodeAt(0) === COLON ? 'center' : 'right');
    else if (t.charCodeAt(0) === COLON) aligns.push('left');
    else aligns.push('');
  }
  return aligns;
}

function pushCell(state: StateBlock, tag: 'th' | 'td', align: string | undefined, content: string): void {
  const open = state.push(`${tag}_open`, tag, 1);
  if (align !== undefined && align !== '') open.attrs = [['style', `text-align:${align}`]];
  const inline = state.push('inline', '', 0);
  inline.content = content;
  inline.children = [];
  state.push(`${tag}_close`, tag, -1);
}

/** The table block rule: markdown-it's, with Python's strip wherever markdown-it trims. */
export function pyTable(state: StateBlock, startLine: number, endLine: number, silent: boolean): boolean {
  if (startLine + 2 > endLine) return false;
  let nextLine = startLine + 1;
  if ((state.sCount[nextLine] ?? 0) < state.blkIndent) return false;
  // Indented four or more: a code block.
  if ((state.sCount[nextLine] ?? 0) - state.blkIndent >= 4) return false;
  const aligns = alignments(state, nextLine);
  if (aligns === null) return false;

  const headerLine = pyStrip(getLine(state, startLine));
  if (!headerLine.includes('|')) return false;
  if ((state.sCount[startLine] ?? 0) - state.blkIndent >= 4) return false;
  const header = rowCells(headerLine);
  const columnCount = header.length;
  if (columnCount === 0 || columnCount !== aligns.length) return false;
  if (silent) return true;

  const oldParentType = state.parentType;
  state.parentType = 'table' as StateBlock['parentType'];
  // A table ends where a blockquote would be ended.
  const terminatorRules = state.md.block.ruler.getRules('blockquote');

  const tableOpen = state.push('table_open', 'table', 1);
  const tableLines: [number, number] = [startLine, 0];
  tableOpen.map = tableLines;
  state.push('thead_open', 'thead', 1).map = [startLine, startLine + 1];
  state.push('tr_open', 'tr', 1).map = [startLine, startLine + 1];
  for (const [i, cell] of header.entries()) pushCell(state, 'th', aligns[i], pyStrip(cell));
  state.push('tr_close', 'tr', -1);
  state.push('thead_close', 'thead', -1);

  let tbodyLines: [number, number] | undefined;
  let autocompletedCells = 0;
  const env = state.env as RenderEnv;
  for (nextLine = startLine + 2; nextLine < endLine; nextLine += 1) {
    if ((state.sCount[nextLine] ?? 0) < state.blkIndent) break;
    if (terminatorRules.some((rule) => rule(state, nextLine, endLine, true))) break;
    const lineText = pyStrip(getLine(state, nextLine));
    if (lineText === '') break;
    if ((state.sCount[nextLine] ?? 0) - state.blkIndent >= 4) break;
    const columns = rowCells(lineText);
    // Can go negative when a row is longer than the header; that does not matter for the limit.
    autocompletedCells += columnCount - columns.length;
    if (autocompletedCells > MAX_AUTOCOMPLETED_CELLS) break;
    // The document's empty cells, counted only where a row is short.
    const added = Math.max(0, columnCount - columns.length);
    if (env.emptyCells + added > MAX_AUTOCOMPLETED_CELLS) break;
    env.emptyCells += added;
    if (nextLine === startLine + 2) {
      tbodyLines = [startLine + 2, 0];
      state.push('tbody_open', 'tbody', 1).map = tbodyLines;
    }
    state.push('tr_open', 'tr', 1).map = [nextLine, nextLine + 1];
    for (let i = 0; i < columnCount; i += 1) {
      const cell = columns[i];
      pushCell(state, 'td', aligns[i], cell === undefined || cell === '' ? '' : pyStrip(cell));
    }
    state.push('tr_close', 'tr', -1);
  }
  if (tbodyLines !== undefined) {
    state.push('tbody_close', 'tbody', -1);
    tbodyLines[1] = nextLine;
  }
  state.push('table_close', 'table', -1);
  tableLines[1] = nextLine;
  state.parentType = oldParentType;
  state.line = nextLine;
  return true;
}

/** The table_code core rule: inside a table, `\|` in a code span's text becomes `|`. */
export function tableCode(state: StateCore): void {
  let depth = 0;
  for (const t of state.tokens) {
    if (t.type === 'table_open') depth += 1;
    else if (t.type === 'table_close') depth -= 1;
    else if (depth > 0 && t.type === 'inline') {
      for (const c of t.children ?? []) {
        if (c.type === 'code_inline') c.content = c.content.replaceAll('\\|', '|');
      }
    }
  }
}

const WRAPPER_OPEN = '<div class="table-wrapper">';

/** The table_open render rule: markdown-it's own <table…> with the wrapper's <div> right before it. */
export function renderTableOpen(
  tokens: Token[],
  idx: number,
  options: Options,
  env: RenderEnv,
  self: Renderer,
): string {
  env.tables += 1;
  return self.renderToken(tokens, idx, options).replace('<table', `${WRAPPER_OPEN}<table`);
}

/** The table_close render rule: markdown-it's own </table> and the wrapper's </div>. */
export function renderTableClose(
  tokens: Token[],
  idx: number,
  options: Options,
  _env: RenderEnv,
  self: Renderer,
): string {
  return self.renderToken(tokens, idx, options).replace('</table>', '</table></div>');
}
