// The decision log, docs/decisions/: one Markdown file per coordinator or operator ruling, and README.md, its index.
// The files are the record that GitHub, a host and the local build (scripts/decisions/build.mjs) all render, so this
// checks what all three rely on: each file's front matter (read by the repo's own render(), as a reader reads it),
// ids unique across files, the relations named both ways, every relative link resolving, and the index holding one
// row per file with the same title, date, author, wave, area and status. README.md's "Adding a decision" is the
// format; a change to the keys or the vocabulary below changes it too.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { render } from '../src/render/index.js';

const DIR = fileURLToPath(new URL('../docs/decisions/', import.meta.url));
const AREAS = ['render', 'corpus', 'layout', 'frame', 'build', 'release', 'process'];
const STATUSES = ['accepted', 'amended', 'open', 'deferred', 'withdrawn'];
const BY = ['operator', 'coordinator'];
const WAVES = ['L1', 'L2', 'L3', '1.1'];
const RELATIONS = { supersedes: 'superseded-by', 'superseded-by': 'supersedes', amends: 'amended-by', 'amended-by': 'amends' } as const;
const KEYS = ['type', 'id', 'ids', 'date', 'by', 'wave', 'area', 'status', ...Object.keys(RELATIONS)];

interface Decision {
  readonly file: string;
  readonly text: string;
  readonly front: Record<string, string | string[]>;
  readonly title: string | null;
}

function read(file: string): Decision {
  const text = readFileSync(path.join(DIR, file), 'utf8');
  const r = render(text);
  if (r.outcome !== 'rendered') throw new Error(`${file}: ${r.outcome}`);
  // The heading's source text, not meta.title's plain text, since the index row repeats it as written (code spans too).
  const title = /^# (.+)$/m.exec(text)?.[1] ?? null;
  return { file, text, front: Object.fromEntries(Object.entries(r.meta.front ?? {})) as Decision['front'], title };
}

/** The problems in a set of decisions and an index, one line each; empty when the log is consistent. */
function problems(decisions: readonly Decision[], index: string, exists: (name: string) => boolean): string[] {
  const out: string[] = [];
  const byId = new Map<string, Decision>();
  const owner = new Map<string, string>();
  for (const d of decisions) {
    const f = d.front;
    const id = f.id;
    if (typeof id !== 'string' || !/^C\d+$/.test(id)) { out.push(`${d.file}: id ${String(id)}`); continue; }
    if (d.file !== `${id}.md`) out.push(`${d.file}: the file is not named by its id ${id}`);
    for (const k of Object.keys(f)) if (!KEYS.includes(k)) out.push(`${d.file}: unknown key ${k}`);
    if (f.type !== 'Decision') out.push(`${d.file}: type ${String(f.type)}`);
    if (typeof f.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(f.date)) out.push(`${d.file}: date ${String(f.date)}`);
    if (!BY.includes(f.by as string)) out.push(`${d.file}: by ${String(f.by)}`);
    if (!WAVES.includes(f.wave as string)) out.push(`${d.file}: wave ${String(f.wave)}`);
    if (!AREAS.includes(f.area as string)) out.push(`${d.file}: area ${String(f.area)}`);
    if (!STATUSES.includes(f.status as string)) out.push(`${d.file}: status ${String(f.status)}`);
    const ids = f.ids === undefined ? [id] : f.ids;
    if (!Array.isArray(ids) || ids[0] !== id) out.push(`${d.file}: ids must be a list that starts with ${id}`);
    for (const x of Array.isArray(ids) ? ids : []) {
      if (owner.has(x)) out.push(`${d.file}: ${x} is also defined by ${owner.get(x)}`);
      owner.set(x, d.file);
    }
    if (!(d.title ?? '').startsWith(`${id}`)) out.push(`${d.file}: the heading does not open with ${id}`);
    byId.set(id, d);
  }
  for (const d of byId.values()) {
    for (const [key, back] of Object.entries(RELATIONS)) {
      const targets = d.front[key];
      if (targets === undefined) continue;
      if (!Array.isArray(targets)) { out.push(`${d.file}: ${key} is not a list`); continue; }
      for (const t of targets) {
        const other = byId.get(t);
        if (other === undefined) out.push(`${d.file}: ${key} names ${t}, which has no file`);
        else if (!(Array.isArray(other.front[back]) && other.front[back].includes(d.front.id as string))) out.push(`${d.file}: ${key} ${t}, but ${t} has no ${back} ${String(d.front.id)}`);
      }
    }
    if (d.front.status === 'withdrawn' && d.front['superseded-by'] === undefined) out.push(`${d.file}: withdrawn with no superseded-by`);
    if (d.front.status === 'amended' && d.front['amended-by'] === undefined) out.push(`${d.file}: amended with no amended-by`);
    for (const m of d.text.matchAll(/\]\(([^)\s#]+)(?:#[^)]*)?\)/g)) {
      const href = m[1]!;
      if (!/^[a-z][a-z0-9+.-]*:/i.test(href) && !exists(href)) out.push(`${d.file}: the link ${href} resolves to nothing`);
    }
  }
  // The index: one row per file, in the "Decisions" table.
  const rows = new Map<string, string[]>();
  for (const line of index.split('\n')) {
    const cells = line.split(/(?<!\\)\|/).slice(1, -1).map((c) => c.trim());
    if (cells.length !== 7 || !/^C\d+$/.test(cells[0]!)) continue;
    if (rows.has(cells[0]!)) out.push(`README.md: two rows for ${cells[0]}`);
    rows.set(cells[0]!, cells);
  }
  for (const [id, d] of byId) {
    const row = rows.get(id);
    if (row === undefined) { out.push(`README.md: no row for ${id}`); continue; }
    const [, decision, date, by, wave, area, status] = row as [string, string, string, string, string, string, string];
    const link = /^\[(.*)\]\(([^)]+)\)$/.exec(decision);
    if (link === null || link[2] !== d.file) out.push(`README.md: ${id}'s row does not link ${d.file}`);
    else if (link[1]!.replaceAll('\\|', '|') !== (d.title ?? '').slice((d.title ?? '').indexOf(': ') + 2)) out.push(`README.md: ${id}'s title differs from its heading`);
    const want = [d.front.date, d.front.by, d.front.wave, d.front.area, String(d.front.status)];
    const got = [date, by, wave, area, status.toLowerCase()];
    if (want.join('|') !== got.join('|')) out.push(`README.md: ${id}'s row says ${got.join(', ')}; the file says ${want.join(', ')}`);
  }
  for (const id of rows.keys()) if (!byId.has(id)) out.push(`README.md: a row for ${id}, which has no file`);
  return out;
}

const files = readdirSync(DIR).filter((f) => /^C\d+\.md$/.test(f));
const decisions = files.map(read);
const index = readFileSync(path.join(DIR, 'README.md'), 'utf8');
const exists = (href: string) => existsSync(path.join(DIR, href));

describe('the decision log (docs/decisions)', () => {
  it('holds only decision files and its index', () => {
    expect(readdirSync(DIR).filter((f) => f !== 'README.md' && !files.includes(f))).toEqual([]);
    expect(files.length).toBeGreaterThan(0);
  });

  it('is consistent: front matter, ids, relations both ways, links, and one index row per file', () => {
    expect(problems(decisions, index, exists)).toEqual([]);
  });

  it('defines every ruling number once, from C1 to the highest', () => {
    const ids = decisions.flatMap((d) => (Array.isArray(d.front.ids) ? d.front.ids : [d.front.id as string]));
    const top = Math.max(...ids.map((x) => Number(x.slice(1))));
    expect(ids.map((x) => Number(x.slice(1))).sort((a, b) => a - b)).toEqual(Array.from({ length: top }, (_, i) => i + 1));
  });

  // Each check above, made to fail once on a copy of the real log: the guard goes red without the fix it asks for.
  describe('each check fails on a log that breaks it', () => {
    const base = () => decisions.map((d) => ({ ...d, front: { ...d.front } }));
    const one = (mutate: (ds: Decision[]) => string | void, idx = index) => {
      const ds = base();
      const changed = mutate(ds);
      return problems(ds, changed ?? idx, exists);
    };
    const at = (ds: Decision[], id: string) => ds.find((d) => d.front.id === id)!;
    const cases: [string, () => string[], RegExp][] = [
      ['a file not named by its id', () => one((ds) => { at(ds, 'C84').front.id = 'C840'; }), /not named by its id/],
      ['an unknown key', () => one((ds) => { at(ds, 'C84').front.owner = 'x'; }), /unknown key owner/],
      ['a wrong type', () => one((ds) => { at(ds, 'C84').front.type = 'Spec'; }), /type Spec/],
      ['a bad date', () => one((ds) => { at(ds, 'C84').front.date = '26-10-2026'; }), /date 26-10-2026/],
      ['an unknown author', () => one((ds) => { at(ds, 'C84').front.by = 'someone'; }), /by someone/],
      ['an unknown wave', () => one((ds) => { at(ds, 'C84').front.wave = 'L9'; }), /wave L9/],
      ['an unknown area', () => one((ds) => { at(ds, 'C84').front.area = 'misc'; }), /area misc/],
      ['an unknown status', () => one((ds) => { at(ds, 'C84').front.status = 'maybe'; }), /status maybe/],
      ['an id defined twice', () => one((ds) => { at(ds, 'C85').front.ids = ['C85', 'C84']; }), /C84 is also defined/],
      ['a heading without its id', () => one((ds) => { Object.assign(at(ds, 'C84'), { title: 'The repository' }); }), /heading does not open/],
      ['a one-way relation', () => one((ds) => { delete at(ds, 'C83').front['superseded-by']; }), /has no superseded-by C84/],
      ['a relation to no file', () => one((ds) => { at(ds, 'C84').front.supersedes = ['C999']; }), /C999, which has no file/],
      ['a withdrawn decision with no successor', () => one((ds) => { const d = at(ds, 'C83'); delete d.front['superseded-by']; delete at(ds, 'C84').front.supersedes; }), /withdrawn with no superseded-by/],
      ['an amended decision with no amender', () => one((ds) => { delete at(ds, 'C45').front['amended-by']; delete at(ds, 'C51').front.amends; }), /amended with no amended-by/],
      ['ids that do not open with the id', () => one((ds) => { at(ds, 'C6').front.ids = ['C7', 'C6']; }), /ids must be a list that starts with C6/],
      ['a relation that is not a list', () => one((ds) => { at(ds, 'C84').front.supersedes = 'C83'; }), /supersedes is not a list/],
      ['a broken link', () => one((ds) => { Object.assign(at(ds, 'C84'), { text: at(ds, 'C84').text + '\n[x](C999.md)\n' }); }), /C999\.md resolves to nothing/],
      ['a file with no row', () => one(() => index.replace(/^\| C84 \|.*\n/m, '')), /no row for C84/],
      ['a row with no file', () => one(() => index.replace(/^(\| C84 \|.*\n)/m, '$1| C999 | [x](C999.md) | 2026-11-06 | coordinator | 1.1 | process | Accepted |\n')), /row for C999, which has no file/],
      ['a row whose status differs', () => one(() => index.replace(/^(\| C84 \|.*\| )Accepted \|$/m, '$1Withdrawn |')), /C84's row says/],
      ['a row whose title differs', () => one(() => index.replace('[The repository becomes public after all', '[The repository goes public')), /C84's title differs/],
    ];
    for (const [name, run, expected] of cases) it(name, () => expect(run().join('\n')).toMatch(expected));
  });
});
