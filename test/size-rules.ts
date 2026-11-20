// Size by contract (the appearance contract, spec section 10, test 8): the pure rules. Nothing here reads git, a file or the
// environment; test/size-contract.test.ts reads the first parent and the judged commit and hands this module two parsed states
// and the landing's text, and test/size-rules.test.ts drives every branch with synthetic states.
//
// The two tables (conformance/size/shares.json and growth.json) are committed source, append-only. Each is a JSON array with
// one row per line and the separating comma at the START of every row but the first, so a landing that appends a row adds
// lines and never touches an earlier one: `git log -L <line>,<line>:<table>` then names the landing that appended the row.
// The exact bytes are `[`, then `  {row}` for the first row and `, {row}` for each later one, then `]`, newline-terminated; a
// row is `{"design":..,"total":..,"frame":..}` written by JSON.stringify, so a row's line is its canonical text.
//
// Sizes are in characters (`chars`): `total` is the sum over every manifest entry, a layout's assets included; `frame` is every
// entry that is not a layout's asset plus the largest single layout's assets (a frame inlines exactly one layout).

export const RESERVED_WORDS: readonly string[] = ['baseline', 'none', 'rebaseline', 'correction', 'shares'];
export const SIZE_DESIGN_PREFIX = 'Size-Design: ';
/** This landing's own fixture: the shares the coordinator set for this contract (x1) and for the second design (x2). */
export const GENESIS_SHARES: readonly Row[] = [
  { design: 'x1', total: 32768, frame: 32768 },
  { design: 'x2', total: 1166336, frame: 72704 },
];

export interface Row {
  readonly design: string;
  readonly total: number;
  readonly frame: number;
}
export interface Table {
  readonly rows: readonly Row[];
  /** Each row's line as committed, in order: the byte-equality unit. */
  readonly lines: readonly string[];
}
export interface Asset {
  readonly sha256: string;
  readonly chars: number;
  /** null: not a layout's asset; otherwise the layout's name. */
  readonly layout: string | null;
}
export type Manifest = Readonly<Record<string, Asset>>;
export interface State {
  /** null: the file does not exist at this commit. */
  readonly shares: Table | null;
  readonly growth: Table | null;
  readonly manifest: Manifest;
}

const isCount = (n: unknown): n is number => typeof n === 'number' && Number.isSafeInteger(n);

/** One row's canonical line text, without its leading separator. */
export const rowText = (r: Row): string => JSON.stringify({ design: r.design, total: r.total, frame: r.frame });

/** The file text of a table of `rows`, in the one canonical shape. */
export function serialiseTable(rows: readonly Row[]): string {
  return `[\n${rows.map((r, i) => `${i === 0 ? '  ' : ', '}${rowText(r)}`).join('\n')}\n]\n`;
}

/** Parse a table's text; throws an Error naming the first thing wrong. Row lines are returned without their separator. */
export function parseTable(text: string): Table {
  if (!text.endsWith('\n')) throw new Error('the table is not newline-terminated');
  const all = text.slice(0, -1).split('\n');
  if (all[0] !== '[' || all.at(-1) !== ']' || all.length < 3) throw new Error('the table is not `[`, one row per line, `]`');
  const rows: Row[] = [];
  const lines: string[] = [];
  for (const [i, line] of all.slice(1, -1).entries()) {
    const lead = i === 0 ? '  ' : ', ';
    if (!line.startsWith(lead)) throw new Error(`row ${String(i + 1)} does not start with ${JSON.stringify(lead)}`);
    const body = line.slice(lead.length);
    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      throw new Error(`row ${String(i + 1)} is not JSON`);
    }
    const r = parsed as Partial<Row> | null;
    if (r === null || typeof r !== 'object' || typeof r.design !== 'string' || r.design === '' || !isCount(r.total) || !isCount(r.frame) || Object.keys(r).length !== 3) {
      throw new Error(`row ${String(i + 1)} is not {design, total, frame}`);
    }
    const row: Row = { design: r.design, total: r.total, frame: r.frame };
    if (rowText(row) !== body) throw new Error(`row ${String(i + 1)} is not in canonical form`);
    rows.push(row);
    lines.push(body);
  }
  return { rows, lines };
}

const ENTRY =
  /^ {2}(\w+): \{ path: "[^"]+", sha256: "([0-9a-f]{64})", bytes: \d+, chars: (\d+), csp: (?:null|"[^"]*")(?:, layout: (null|"[^"]*"))? \},$/;

/**
 * The FRAME_MANIFEST literal of a manifest.generated.ts text, as entries. A text from before the manifest marked layouts (1.1.0's)
 * has no `layout` field, which reads as null: none of its entries is a layout's asset. Throws when the literal is not the shape the build writes.
 */
export function parseManifest(text: string): Manifest {
  const lines = text.split('\n');
  const from = lines.indexOf('export const FRAME_MANIFEST = {');
  const to = lines.indexOf('} as const;');
  if (from < 0 || to < from) throw new Error('no FRAME_MANIFEST literal');
  const out: Record<string, Asset> = {};
  for (const line of lines.slice(from + 1, to)) {
    const m = ENTRY.exec(line);
    if (m === null) throw new Error(`a FRAME_MANIFEST line the build does not write: ${line}`);
    const layout = m[4] === undefined || m[4] === 'null' ? null : (JSON.parse(m[4]) as string);
    out[m[1] as string] = { sha256: m[2] as string, chars: Number(m[3]), layout };
  }
  if (Object.keys(out).length === 0) throw new Error('an empty FRAME_MANIFEST');
  return out;
}

/** Each layout's assets' characters, by layout name. */
export function layoutSizes(m: Manifest): Record<string, number> {
  const out: Record<string, number> = {};
  for (const a of Object.values(m)) if (a.layout !== null) out[a.layout] = (out[a.layout] ?? 0) + a.chars;
  return out;
}

/** The two totals of a manifest: `total` over every entry, `frame` the non-layout entries plus the largest layout. */
export function sizesOf(m: Manifest): { total: number; frame: number } {
  const entries = Object.values(m);
  const total = entries.reduce((s, a) => s + a.chars, 0);
  const rest = entries.filter((a) => a.layout === null).reduce((s, a) => s + a.chars, 0);
  return { total, frame: rest + Math.max(0, ...Object.values(layoutSizes(m))) };
}

/** True when any entry's sha256 differs from the base's, or an entry was added or removed. */
export function frameAssetsChanged(base: Manifest, head: Manifest): boolean {
  const names = new Set([...Object.keys(base), ...Object.keys(head)]);
  for (const n of names) if (base[n]?.sha256 !== head[n]?.sha256) return true;
  return false;
}

/** The text's `Size-Design:` lines. The word is the rest of the line trimmed of white space and a carriage return. */
export function sizeDesignWords(text: string): string[] {
  return text
    .split('\n')
    .filter((l) => l.startsWith(SIZE_DESIGN_PREFIX))
    .map((l) => l.slice(SIZE_DESIGN_PREFIX.length).trim());
}

/** A design's growth: over its rows after the first, each row's totals less the row before it. */
export function growthOf(rows: readonly Row[], design: string): { total: number; frame: number } {
  let total = 0;
  let frame = 0;
  rows.forEach((r, i) => {
    const before = rows[i - 1];
    if (i > 0 && r.design === design && before !== undefined) {
      total += r.total - before.total;
      frame += r.frame - before.frame;
    }
  });
  return { total, frame };
}

/** A design's share: its newest row of the shares table. */
export const shareOf = (shares: Table, design: string): Row | undefined => [...shares.rows].reverse().find((r) => r.design === design);

const sameRow = (a: Row, b: Row): boolean => a.design === b.design && a.total === b.total && a.frame === b.frame;

/** What a table appended at the head: the head's rows past the base's. */
const appended = (base: Table, head: Table): Row[] => head.rows.slice(base.rows.length);

/**
 * Judge the head against the base (the first parent) with the landing's text; the list of violations, empty when the landing
 * is in order. `base` and `head` are the two parsed states; the rules read the shares from the BASE only.
 */
export function judge(base: State, head: State, text: string): string[] {
  const v: string[] = [];

  // One landing, one line.
  const words = sizeDesignWords(text);
  if (words.length !== 1) v.push(`the text holds ${String(words.length)} "Size-Design: " lines, not exactly one`);
  const word = words.length === 1 ? (words[0] as string) : null;
  if (word === '') v.push('the Size-Design word is empty');

  // The layouts: each at most the default enhance bundle's characters, at the head.
  const layouts = layoutSizes(head.manifest);
  const defaults = layouts['default'];
  if (defaults === undefined) v.push('layouts: the manifest marks no default layout');
  else for (const [name, size] of Object.entries(layouts)) if (size > defaults) v.push(`layouts: ${name} is ${String(size)} characters, over the default's ${String(defaults)}`);

  if (head.shares === null || head.growth === null) {
    v.push('the judged commit lacks the shares table or the growth table');
    return v;
  }
  const now = sizesOf(head.manifest);
  const newest = head.growth.rows.at(-1);

  // The genesis landing: the first parent has neither table.
  if (base.shares === null && base.growth === null) {
    if (word !== null && word !== 'x1') v.push(`genesis: the word is "x1", this contract's name, not "${word}"`);
    const before = sizesOf(base.manifest);
    const g = head.growth.rows;
    if (g.length !== 2) v.push(`genesis: the growth table holds ${String(g.length)} rows, exactly two`);
    else {
      if (!sameRow(g[0] as Row, { design: 'baseline', ...before })) v.push("genesis: the baseline row is not the first parent's manifest total");
      if (!sameRow(g[1] as Row, { design: 'x1', ...now })) v.push('genesis: its own row is not the recomputation at the judged commit');
    }
    const s = head.shares.rows;
    if (s.length !== 2) v.push(`genesis: the shares table holds ${String(s.length)} rows, exactly two`);
    else if (!s.every((r, i) => sameRow(r, GENESIS_SHARES[i] as Row))) v.push("genesis: the shares are not x1's and x2's figures");
    return v;
  }
  if (base.shares === null || base.growth === null) {
    v.push('the first parent holds one of the two tables and not the other');
    return v;
  }

  // The rule: every base row of both tables is byte-equal in place; the newest growth row is the recomputation.
  for (const [name, b, h] of [
    ['shares', base.shares, head.shares],
    ['growth', base.growth, head.growth],
  ] as const) {
    if (h.lines.length < b.lines.length) v.push(`the rule: the ${name} table dropped rows`);
    b.lines.forEach((line, i) => {
      if (h.lines[i] !== line) v.push(`the rule: ${name} row ${String(i + 1)} is not byte-equal to the first parent's`);
    });
  }
  if (newest === undefined || newest.total !== now.total || newest.frame !== now.frame) v.push('the rule: the newest growth row is not the recomputation from the judged commit');

  const changed = frameAssetsChanged(base.manifest, head.manifest);
  const g = appended(base.growth, head.growth);
  const s = appended(base.shares, head.shares);
  const baseNewest = base.growth.rows.at(-1);
  if (g.some((r) => r.design === 'baseline')) v.push('baseline names only the genesis landing');
  const need = (design: string): boolean => {
    if (RESERVED_WORDS.includes(design)) return true;
    if (shareOf(base.shares as Table, design) !== undefined) return true;
    v.push(`a growth row names "${design}", which has no share row at the first parent`);
    return false;
  };
  /** The design's growth, read from the head's rows, within its share read from the BASE's table. */
  const within = (design: string): void => {
    if (RESERVED_WORDS.includes(design)) return;
    const share = shareOf(base.shares as Table, design);
    if (share === undefined) return;
    const grown = growthOf(head.growth?.rows ?? [], design);
    if (grown.total > share.total || grown.frame > share.frame) v.push(`within the share: ${design} grew ${String(grown.total)} total and ${String(grown.frame)} frame, over its ${String(share.total)} and ${String(share.frame)}`);
  };

  if (word === null || word === '') return v;
  if (word === 'baseline') v.push('baseline is reserved and names only the genesis landing');
  else if (word === 'none') {
    if (changed) v.push('none: the landing changes a frame asset');
    if (g.length > 0) v.push('none: the landing appends a growth row');
    if (s.length > 0) v.push('none: the landing appends a share row');
  } else if (word === 'rebaseline') {
    if (g.length !== 1) v.push(`rebaseline: ${String(g.length)} growth rows appended, exactly one`);
    else if ((g[0] as Row).design !== 'rebaseline') v.push('rebaseline: the appended row is not named rebaseline');
    if (s.length > 0) v.push('rebaseline: the landing appends a share row');
  } else if (word === 'correction') {
    if (changed) v.push('correction: the landing changes a frame asset');
    if (s.length > 0) v.push('correction: the landing appends a share row');
    if (g.length !== 2) v.push(`correction: ${String(g.length)} growth rows appended, exactly two`);
    else {
      const [wrong, right] = g as [Row, Row];
      if (baseNewest === undefined) v.push('correction: the first parent has no growth row');
      else {
        if (wrong.total > baseNewest.total || wrong.frame > baseNewest.frame) v.push('correction: the first row is not lowered from the first parent\'s newest');
        if (right.total !== baseNewest.total || right.frame !== baseNewest.frame) v.push("correction: the second row's totals are not the first parent's newest row's");
      }
      if (right.total !== now.total || right.frame !== now.frame) v.push('correction: the second row is not the recomputation at the judged commit');
      if (wrong.design === right.design) v.push('correction: both rows name the same design');
      need(wrong.design);
      if (need(right.design)) within(right.design);
    }
  } else if (word === 'shares') {
    if (changed) v.push('shares: the landing changes a frame asset');
    if (g.length > 0) v.push('shares: the landing appends a growth row');
    if (s.length === 0) v.push('shares: the landing appends no share row');
    for (const r of s) {
      if (RESERVED_WORDS.includes(r.design)) v.push(`shares: ${r.design} is a reserved word, never a design`);
      const grown = growthOf(base.growth.rows, r.design);
      if (r.total < grown.total || r.frame < grown.frame) v.push(`shares: a row for ${r.design} is below its growth (${String(grown.total)} total, ${String(grown.frame)} frame)`);
    }
  } else {
    // A design's name.
    if (s.length > 0) v.push('a share row lands only under Size-Design: shares');
    if (changed) {
      if (g.length !== 1) v.push(`${word}: ${String(g.length)} growth rows appended, exactly one`);
      else if ((g[0] as Row).design !== word) v.push(`${word}: the appended row names "${(g[0] as Row).design}"`);
      if (need(word)) within(word);
    } else if (g.length > 0) v.push(`${word}: the landing changes no frame asset and appends a growth row`);
  }
  return v;
}
