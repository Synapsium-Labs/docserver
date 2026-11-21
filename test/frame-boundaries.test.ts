// The frame's boundaries, pinned at each landing that changes one (the appearance contract, spec section 10, test 9; plan
// Task 3). conformance/frame-boundaries.json is an append-only record: one entry per landing that changes the frame-to-parent
// op list (`frameOps`, FRAME_OPS), the parent-to-frame op list the port parser accepts (`frameAccepts`, FRAME_ACCEPTS) or
// the shape of the canonical policy (`csp`, frameCsp() with each script-src hash source masked as `'sha256-*'`, so a script
// change, which moves every hash, appends nothing). The newest entry equals the values computed at the judged commit, and
// every entry at the first parent is unchanged here, so no landing can rewrite what an earlier landing pinned.
//
// What a landing is judged against is its first parent: a pull request's merge ref (or a merge-queue entry, or the main
// line's landing commit) against `HEAD^1`. Neither this file nor the record builds the parent.
//
//   DOCSERVER_BOUNDARY_BASE=<ref> overrides the first parent (default `HEAD^1`). A branch that is not a merge commit has no
//   `HEAD^1` that means its base, so a local run on a working branch names it: `DOCSERVER_BOUNDARY_BASE=origin/main`, which
//   simulates the landing. A checkout that lacks the base fails the rows that read it, never skips them.
//
// Per layout (docserver parity Task 9): from the entry of the layouts on, `csp` is an object, the masked policy of each layout by its
// name (frameCsp(layout)); the entries before it keep their one string, which is the default layout's. Each layout's masked policy
// equals the previous entry's for the same layout, and a layout the previous entry does not name has no parent: its first value is
// the landing's own review check, as a new entry's first masked policy always was.
//
// The genesis landing, the one whose first parent has no record, has exactly two entries: the first is the first parent's,
// 1.1.0's, checked against what the parent commits (FRAME_OPS parsed from its src/frame/protocol.ts, and its port parser's
// hard-coded four ops parsed from its src/frame-runtime/inbound.ts), except for the masked policy, which is computed and so
// has no literal to parse: that entry's `csp` was copied from the published 1.1.0's frameCsp(), masked, and the copy is a
// review check of the library wave. The second entry is the genesis landing's own. A later landing appends one entry by hand
// and writes its row of DELTAS (what the entry adds to the previous entry's two lists, at their end) in the same landing.
//
// Rows: the newest entry equals the computed values; each entry's lists are the previous entry's plus its DELTAS row's additions
// at the end (entry 1, the appearance contract: `appearance` to the accepted list; entry 2, the parity wire: `place` and
// `print-figure` to the frame ops); the port parser, driven with one well-formed message per op name of OP_KEYS, PARENT_OPS and
// FRAME_OPS and a planted name, accepts exactly the names of FRAME_ACCEPTS and refuses `hello`; the masked policy equals the
// previous entry's and holds one hash source per script the frame inlines (the manifest's entries that carry one, KNOWN's
// length). The behaviour rows (the srcdoc's CSP meta, the iframe's `csp` attribute and a port spy's count of frame-to-parent
// messages are the same with an appearance as without) are test/frame-document.test.ts's (the meta), test/host-mount.test.ts's
// (the attribute) and test/browser/frame-appearance.test.ts's (the spy).
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { frameCsp } from '../src/frame/csp.js';
import { HASH_SOURCE } from '../src/frame/csp-rules.js';
import { FRAME_LAYOUTS, LAYOUT_ENTRIES, type FrameLayout } from '../src/frame/layouts.js';
import { FRAME_MANIFEST } from '../src/frame/manifest.generated.js';
import { FRAME_ACCEPTS, FRAME_OPS, OP_KEYS, PARENT_OPS } from '../src/frame/protocol.js';
import { parseParentMessage } from '../src/frame-runtime/inbound.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const RECORD = 'conformance/frame-boundaries.json';

/**
 * One record entry. `csp` is the one masked policy of the entries before layouts (a string: the default layout's, the only one
 * there was), and from the entry of parity Task 9 on an object, the masked policy of each layout by its name; earlier entries
 * keep their string, as the record is append-only.
 */
interface Entry {
  readonly frameOps: readonly string[];
  readonly frameAccepts: readonly string[];
  readonly csp: string | Readonly<Record<string, string>>;
}

/** The masked policy `entry` records for `layout`: a string entry is the default layout's alone; a layout it does not name is undefined. */
const cspOf = (entry: Entry | undefined, layout: FrameLayout): string | undefined => {
  if (entry === undefined) return undefined;
  if (typeof entry.csp === 'string') return layout === 'default' ? entry.csp : undefined;
  return Object.hasOwn(entry.csp, layout) ? entry.csp[layout] : undefined;
};

/** The newest entry's own sha256-free form: every script-src hash source `'sha256-*'`, the other directives untouched. */
function maskedCsp(policy: string): string {
  return policy
    .split('; ')
    .map((directive) => {
      const [name, ...tokens] = directive.split(' ');
      return name === 'script-src' ? [name, ...tokens.map((t) => (HASH_SOURCE.test(t) ? "'sha256-*'" : t))].join(' ') : directive;
    })
    .join('; ');
}

/**
 * The deltas of the record, keyed by entry index (0 is 1.1.0's, which has none) and append-only like the record: what each
 * entry adds to the previous entry's two lists, at their end. A landing that appends an entry writes its row here; an entry
 * with no row, and a row with no entry, red. Entry 1 is the appearance contract's, entry 2 the parity wire's.
 */
const DELTAS: readonly { readonly entry: number; readonly addsFrameOps: readonly string[]; readonly addsFrameAccepts: readonly string[] }[] = [
  { entry: 1, addsFrameOps: [], addsFrameAccepts: ['appearance'] },
  { entry: 2, addsFrameOps: ['place', 'print-figure'], addsFrameAccepts: [] },
  // Entry 3, the layouts (parity Task 9): no new op and nothing new accepted; what the entry adds is the policy of each layout.
  { entry: 3, addsFrameOps: [], addsFrameAccepts: [] },
];

const recordText = readFileSync(`${ROOT}${RECORD}`, 'utf8');
const record = JSON.parse(recordText) as Entry[];
/** The first entry whose `csp` is per layout (an object): entries before it hold the default layout's policy as one string. */
const FIRST_PER_LAYOUT = 3;
const now = (): Entry => ({
  frameOps: [...FRAME_OPS],
  frameAccepts: [...FRAME_ACCEPTS],
  csp: Object.fromEntries(FRAME_LAYOUTS.map((l) => [l, maskedCsp(frameCsp(l))])),
});

function git(args: readonly string[]): { status: number | null; stdout: string; stderr: string } {
  const r = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

const BASE = process.env['DOCSERVER_BOUNDARY_BASE'] ?? 'HEAD^1';

/** The strings in single quotes in `text`, in order. */
const quoted = (text: string): string[] => [...text.matchAll(/'([^']+)'/g)].map((m) => m[1] as string);

describe('the record: its shape and its newest entries', () => {
  it('is a JSON array of entries with exactly frameOps, frameAccepts and csp, newline-terminated, at least two', () => {
    expect(Array.isArray(record)).toBe(true);
    expect(record.length).toBeGreaterThanOrEqual(2);
    for (const e of record) {
      expect(Object.keys(e).sort()).toEqual(['csp', 'frameAccepts', 'frameOps']);
      expect(e.frameOps.every((x) => typeof x === 'string')).toBe(true);
      expect(e.frameAccepts.every((x) => typeof x === 'string')).toBe(true);
    }
    record.forEach((e, i) => {
      // Before the layouts one masked policy as a string; from the layouts on, one per layout, in FRAME_LAYOUTS' order.
      if (i < FIRST_PER_LAYOUT) expect(typeof e.csp, `entry ${String(i)}`).toBe('string');
      else {
        expect(typeof e.csp, `entry ${String(i)}`).toBe('object');
        expect(Object.keys(e.csp), `entry ${String(i)}`).toEqual([...FRAME_LAYOUTS]);
        for (const v of Object.values(e.csp)) expect(typeof v).toBe('string');
      }
    });
    expect(recordText.endsWith('\n')).toBe(true);
  });

  it('the newest entry equals the values computed now: FRAME_OPS, FRAME_ACCEPTS and the masked frameCsp(layout) of every layout', () => {
    expect(record.at(-1)).toEqual(now());
  });

  it('every entry after the first has exactly one delta row, and every delta row has its entry (an entry with no row reds)', () => {
    expect(DELTAS.map((d) => d.entry)).toEqual(record.slice(1).map((_, i) => i + 1));
    expect(record).toHaveLength(DELTAS.length + 1);
  });

  it('each entry\'s two lists are the previous entry\'s in the same order with only the delta row\'s additions at the end', () => {
    for (const d of DELTAS) {
      const before = record[d.entry - 1];
      const entry = record[d.entry];
      expect(entry?.frameOps, `entry ${String(d.entry)} frameOps`).toEqual([...(before?.frameOps ?? []), ...d.addsFrameOps]);
      expect(entry?.frameAccepts, `entry ${String(d.entry)} frameAccepts`).toEqual([...(before?.frameAccepts ?? []), ...d.addsFrameAccepts]);
    }
  });

  it('a delta row adds no name the previous entry already holds, and no list repeats a name', () => {
    for (const d of DELTAS) {
      const before = record[d.entry - 1];
      for (const name of d.addsFrameOps) expect(before?.frameOps, `entry ${String(d.entry)} ${name}`).not.toContain(name);
      for (const name of d.addsFrameAccepts) expect(before?.frameAccepts, `entry ${String(d.entry)} ${name}`).not.toContain(name);
    }
    for (const e of record) {
      expect(new Set(e.frameOps).size).toBe(e.frameOps.length);
      expect(new Set(e.frameAccepts).size).toBe(e.frameAccepts.length);
    }
  });

  it('the computed lists are the newest entry\'s, and each ends with the newest delta row\'s additions', () => {
    const newest = record.at(-1);
    const delta = DELTAS.at(-1);
    expect([...FRAME_OPS]).toEqual(newest?.frameOps);
    expect([...FRAME_ACCEPTS]).toEqual(newest?.frameAccepts);
    expect([...FRAME_OPS].slice(FRAME_OPS.length - (delta?.addsFrameOps.length ?? 0))).toEqual(delta?.addsFrameOps);
    expect([...FRAME_ACCEPTS].slice(FRAME_ACCEPTS.length - (delta?.addsFrameAccepts.length ?? 0))).toEqual(delta?.addsFrameAccepts);
  });

  it("each layout's masked frameCsp(layout) equals the previous entry's for the same layout: the same directives in the same order, the same sources but the hashes; a layout the previous entry does not name has no parent, and its first value is the landing's review check", () => {
    const previous = record.at(-2);
    for (const l of FRAME_LAYOUTS) {
      const parent = cspOf(previous, l);
      // The default layout is the only one the entries before this had (as one string), so it always has a parent.
      if (l === 'default') expect(parent, 'the default layout has a parent').toBeDefined();
      else expect(parent, `${l} is new in the newest entry`).toBeUndefined();
      if (parent !== undefined) expect(maskedCsp(frameCsp(l)), l).toBe(parent);
    }
    // Every consecutive pair of entries, whatever their shape: a layout both name has the same masked policy in both.
    for (let i = 1; i < record.length; i += 1) {
      for (const l of FRAME_LAYOUTS) {
        const a = cspOf(record[i - 1], l);
        const b = cspOf(record[i], l);
        if (a !== undefined && b !== undefined) expect(b, `entry ${String(i)} ${l}`).toBe(a);
      }
    }
  });

  it("frameCsp() is the default layout's policy: byte for byte frameCsp('default'), and its masked form is the newest entry's `default`", () => {
    expect(frameCsp()).toBe(frameCsp('default'));
    expect(maskedCsp(frameCsp())).toBe(cspOf(record.at(-1), 'default'));
    expect(maskedCsp(frameCsp())).toBe(record.at(-2)?.csp);
  });

  it("each layout's policy has one hash source per script that layout's frame inlines (four), and each is a hash this version ships; the manifest holds one per script of every layout", () => {
    const sources = (policy: string): string[] => policy.split('; ').find((d) => d.startsWith('script-src '))?.split(' ').slice(1) ?? [];
    // Every script the manifest names: the guard, the bootstrap, Mermaid's, and one enhance bundle for each layout.
    const scripts = Object.values(FRAME_MANIFEST).filter((a) => a.csp !== null).length;
    expect(scripts).toBe(3 + FRAME_LAYOUTS.length);
    const INLINED = 4;
    for (const l of FRAME_LAYOUTS) {
      const policy = frameCsp(l);
      expect(sources(policy), l).toHaveLength(INLINED);
      expect(sources(policy).every((t) => HASH_SOURCE.test(t)), l).toBe(true);
      expect(sources(maskedCsp(policy)), l).toEqual(Array.from({ length: INLINED }, () => "'sha256-*'"));
      // The four are the guard, the bootstrap, that layout's enhance bundle and Mermaid's, in that order, and no other layout's.
      expect(sources(policy), l).toEqual([FRAME_MANIFEST.guard.csp, FRAME_MANIFEST.bootstrap.csp, FRAME_MANIFEST[LAYOUT_ENTRIES[l].enhance].csp, FRAME_MANIFEST.mermaid.csp]);
      expect(sources(cspOf(record.at(-1), l) ?? ''), l).toHaveLength(INLINED);
    }
    // The enhance hashes differ from one another, so a policy of one layout cannot stand for another's.
    expect(new Set(FRAME_LAYOUTS.map((l) => FRAME_MANIFEST[LAYOUT_ENTRIES[l].enhance].csp)).size).toBe(FRAME_LAYOUTS.length);
  });
});

describe('the mask: HASH_SOURCE on the script-src directive\'s tokens only, so it can never hide another source', () => {
  const H = (c: string): string => `'sha256-${c.repeat(43)}='`;

  it("masks each hash source of script-src and leaves 'none', 'unsafe-inline', other directives and a hash in another directive as they are", () => {
    const planted = `default-src 'none'; script-src 'unsafe-inline' 'none' ${H('a')} ${H('b')} data:; style-src ${H('c')} 'unsafe-inline'; img-src ${H('d')}`;
    expect(maskedCsp(planted)).toBe(`default-src 'none'; script-src 'unsafe-inline' 'none' 'sha256-*' 'sha256-*' data:; style-src ${H('c')} 'unsafe-inline'; img-src ${H('d')}`);
  });

  it("does not mask a source that is not a hash: a sha512 source, a hash of the wrong length, a bare 'self'", () => {
    const planted = `script-src 'sha512-${'a'.repeat(86)}==' 'sha256-${'a'.repeat(42)}=' 'self' ${H('e')}`;
    expect(maskedCsp(planted)).toBe(`script-src 'sha512-${'a'.repeat(86)}==' 'sha256-${'a'.repeat(42)}=' 'self' 'sha256-*'`);
  });

  it('the real policy masks to the same text whatever the hashes are (a script change appends nothing)', () => {
    const other = frameCsp().replace(/'sha256-[A-Za-z0-9+/]{43}='/g, `'sha256-${'Z'.repeat(43)}='`);
    expect(other.length).toBe(frameCsp().length);
    expect(maskedCsp(other)).toBe(maskedCsp(frameCsp()));
  });
});

describe('the port parser accepts exactly FRAME_ACCEPTS: one well-formed message per op name, and a planted name', () => {
  const NONCE = 'a'.repeat(32);
  const SHA = 'a'.repeat(40);
  /** One well-formed message per op name of either direction: a name added to OP_KEYS needs a line here. */
  const WELL_FORMED: Readonly<Record<string, unknown>> = {
    hello: { t: 'hello', v: 1 },
    prefs: { t: 'prefs', theme: 'dark' },
    'changes.result': { t: 'changes.result', sha: SHA, unavailable: true },
    mermaid: { t: 'mermaid', unavailable: true },
    command: { t: 'command', name: 'jump' },
    appearance: { t: 'appearance', v: 1, appearance: { mode: 'dark' } },
    ready: { t: 'ready', v: 1, nonce: NONCE },
    error: { t: 'error', why: 'boot' },
    'store.set': { t: 'store.set', key: 'pref:prefs', value: 'null' },
    navigate: { t: 'navigate', href: 'https://example.test/' },
    copy: { t: 'copy', text: 'x' },
    changes: { t: 'changes', sha: SHA },
    hash: { t: 'hash', id: 'x' },
    version: { t: 'version' },
    progress: { t: 'progress', p: '500' },
    place: { t: 'place', kind: 'overlay' },
    'print-figure': { t: 'print-figure', i: '0', n: '1', png: 'iVBORw0KGgo=' },
  };
  const PLANTED = 'planted-op';

  it('a message is written for every name of OP_KEYS, PARENT_OPS and FRAME_OPS (a new op needs its own line)', () => {
    const names = [...new Set([...Object.keys(OP_KEYS), ...PARENT_OPS, ...FRAME_OPS])];
    expect(names.filter((n) => !Object.hasOwn(WELL_FORMED, n))).toEqual([]);
    for (const n of names) expect((WELL_FORMED[n] as { t: string }).t, n).toBe(n);
  });

  it('the names it accepts, as the same op back, are exactly FRAME_ACCEPTS', () => {
    const names = [...new Set([...Object.keys(OP_KEYS), ...PARENT_OPS, ...FRAME_OPS, PLANTED])];
    const accepted = names.filter((n) => {
      const msg = n === PLANTED ? { t: PLANTED } : WELL_FORMED[n];
      const got = parseParentMessage(msg);
      return got !== null && got.t === n;
    });
    expect(accepted.sort()).toEqual([...FRAME_ACCEPTS].sort());
  });

  it('accepts no message of a name outside FRAME_ACCEPTS in any shape: the planted name with every key of every op, and each frame op', () => {
    const everyKey = Object.fromEntries([...new Set(Object.values(OP_KEYS).flat())].map((k) => [k, k === 't' ? PLANTED : 'x']));
    expect(parseParentMessage(everyKey)).toBeNull();
    expect(parseParentMessage({ t: PLANTED })).toBeNull();
    for (const op of FRAME_OPS) expect(parseParentMessage(WELL_FORMED[op]), op).toBeNull();
  });

  it('refuses hello, which only the bootstrap\'s window listener takes, before the port exists', () => {
    expect(PARENT_OPS).toContain('hello');
    expect(FRAME_ACCEPTS).not.toContain('hello');
    expect(parseParentMessage({ t: 'hello', v: 1 })).toBeNull();
  });

  it('each op of FRAME_ACCEPTS has its key set in OP_KEYS, which the parser reads', () => {
    for (const op of FRAME_ACCEPTS) expect(Object.hasOwn(OP_KEYS, op), op).toBe(true);
  });
});

describe('the first parent: the record is judged against it, never guessed', () => {
  it(`the base \`${BASE}\` is in the checkout (a missing base fails; it is never skipped)`, () => {
    const r = git(['rev-parse', '--verify', '--quiet', `${BASE}^{commit}`]);
    expect(r.status, `git cannot resolve ${BASE}: fetch the base (CI fetches full history), or set DOCSERVER_BOUNDARY_BASE`).toBe(0);
  });

  it(`the base \`${BASE}\` is a proper ancestor of HEAD (a base equal to HEAD, or off its history, would judge the record against itself or a stranger)`, () => {
    const base = git(['rev-parse', '--verify', '--quiet', `${BASE}^{commit}`]).stdout.trim();
    const head = git(['rev-parse', '--verify', '--quiet', 'HEAD^{commit}']).stdout.trim();
    expect(base).not.toBe('');
    expect(base, 'the base is HEAD itself').not.toBe(head);
    expect(git(['merge-base', '--is-ancestor', base, head]).status, `${BASE} is not an ancestor of HEAD`).toBe(0);
  });

  const parentHas = (): boolean => git(['cat-file', '-e', `${BASE}:${RECORD}`]).status === 0;
  const show = (file: string): string => {
    const r = git(['show', `${BASE}:${file}`]);
    expect(r.status, `git show ${BASE}:${file}: ${r.stderr}`).toBe(0);
    return r.stdout;
  };

  it('with no record at the first parent (the genesis landing): exactly two entries, the first the parent\'s own FRAME_OPS and four-op port list, parsed from its sources', () => {
    if (parentHas()) return;
    expect(record).toHaveLength(2);
    // FRAME_OPS as the parent's committed src/frame/protocol.ts writes it.
    const protocol = show('src/frame/protocol.ts');
    const line = protocol.split('\n').find((l) => l.startsWith('export const FRAME_OPS = '));
    expect(line, 'FRAME_OPS in the parent\'s protocol.ts').toBeDefined();
    const parentOps = quoted((line ?? '').slice(0, (line ?? '').indexOf(' as const')));
    expect(parentOps.length).toBeGreaterThan(0);
    expect(record[0]?.frameOps).toEqual(parentOps);
    // The port parser's four hard-coded ops, as the parent's committed src/frame-runtime/inbound.ts writes them.
    const inbound = show('src/frame-runtime/inbound.ts');
    const check = inbound.split('\n').find((l) => /^\s*if \(t !== '/.test(l));
    expect(check, 'the parent\'s hard-coded op check').toBeDefined();
    expect(quoted(check ?? '')).toEqual(['prefs', 'changes.result', 'mermaid', 'command']);
    expect(record[0]?.frameAccepts).toEqual(['prefs', 'changes.result', 'mermaid', 'command']);
  });

  it('with a record at the first parent: its bytes are unchanged here, in place, and nothing is dropped (an append only adds after them)', () => {
    if (!parentHas()) return;
    const parentText = show(RECORD);
    const parent = JSON.parse(parentText) as Entry[];
    expect(record.length).toBeGreaterThanOrEqual(parent.length);
    // Byte-equal: the parent's file less its closing bracket (and the line break before it) is a prefix of this one.
    const head = parentText.replace(/\s*\]\s*$/, '');
    expect(readFileSync(new URL(`../${RECORD}`, import.meta.url), 'utf8').startsWith(head), 'the parent\'s entries, byte for byte').toBe(true);
    parent.forEach((e, i) => expect(JSON.stringify(record[i]), `entry ${String(i + 1)}`).toBe(JSON.stringify(e)));
  });
});
