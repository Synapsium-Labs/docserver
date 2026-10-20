// The Level 2 cases of the corpus (§3.5): `enhance()` to a structural DOM in a real browser. Read by
// test/browser/layout-corpus.test.ts; pure Node, no browser.
//
// A case is three files under conformance/layout/<slug>/:
//   <id>.md            the input
//   <id>.options.json  { "options": {...}, "scope": [...], "hostile"?: true, "viewport"?: { width, height }, "csp"?: "strict" | "reader" }
//   <id>.dom.txt       the expected snapshot (test/browser/page/snapshot.ts)
// `options` are enhance()'s, as plain data (the harness adds `info` from render() unless they give their own);
// `scope` is the snapshot's (a non-empty list of class names and `[attribute]` entries). The ratchet
// (scripts/ratchet.mjs) holds every case: a changed .dom.txt is named in a `Layout-moved:` trailer, and a hostile
// case is never removed and its .md and options never change. `UPDATE_LAYOUT=1` writes the expected files; CI
// never sets it.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCOPE_ENTRY } from './page/snapshot.js';

export const LAYOUT_DIR = fileURLToPath(new URL('../../conformance/layout/', import.meta.url));

export interface LayoutCase {
  /** `<slug>/<id>`, as the ratchet and a `Layout-moved:` trailer name it. */
  readonly id: string;
  readonly markdown: string;
  readonly options: Readonly<Record<string, unknown>>;
  readonly scope: readonly string[];
  readonly hostile: boolean;
  readonly viewport: { readonly width: number; readonly height: number } | undefined;
  readonly csp: 'strict' | 'reader' | undefined;
  /** The expected snapshot's path. */
  readonly expected: string;
}

const KEYS: readonly string[] = ['options', 'scope', 'hostile', 'viewport', 'csp'];
const NAME = /^[a-z0-9][a-z0-9-]*$/;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** A case's options file, checked: every key known and of its type. Throws, naming the case, on anything else. */
export function parseCaseFile(id: string, text: string): Omit<LayoutCase, 'id' | 'markdown' | 'expected'> {
  const bad = (what: string): Error => new Error(`layout case ${id}: ${what}`);
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    throw bad(`options file is not JSON (${String(e)})`);
  }
  if (!isRecord(raw)) throw bad('options file is not an object');
  const unknown = Object.keys(raw).filter((k) => !KEYS.includes(k));
  if (unknown.length > 0) throw bad(`unknown keys ${JSON.stringify(unknown)}`);
  const { options, scope, hostile, viewport, csp } = raw;
  if (!isRecord(options)) throw bad('"options" must be an object');
  if (!Array.isArray(scope) || scope.length === 0 || !scope.every((s) => typeof s === 'string' && SCOPE_ENTRY.test(s))) {
    throw bad('"scope" must be a non-empty list of class names and [attribute] entries');
  }
  if (hostile !== undefined && hostile !== true) throw bad('"hostile" is true or absent');
  if (
    viewport !== undefined &&
    !(isRecord(viewport) && Object.keys(viewport).sort().join() === 'height,width' &&
      [viewport['width'], viewport['height']].every((n) => Number.isInteger(n) && (n as number) > 0 && (n as number) <= 4000))
  ) {
    throw bad('"viewport" must be { width, height } in whole pixels');
  }
  if (csp !== undefined && csp !== 'strict' && csp !== 'reader') throw bad('"csp" is "strict" or "reader"');
  return {
    options,
    scope: scope as string[],
    hostile: hostile === true,
    viewport: viewport as LayoutCase['viewport'],
    csp: csp as LayoutCase['csp'],
  };
}

/** Every case under `dir`, sorted by id. A file that belongs to no complete case is an error. */
export function loadLayoutCases(dir: string = LAYOUT_DIR): LayoutCase[] {
  if (!existsSync(dir)) return [];
  const out: LayoutCase[] = [];
  for (const slug of readdirSync(dir).sort()) {
    const at = path.join(dir, slug);
    if (!NAME.test(slug)) throw new Error(`layout case directory ${JSON.stringify(slug)}: a slug is lower-case letters, digits and -`);
    const files = readdirSync(at).sort();
    const ids = files.filter((f) => f.endsWith('.md')).map((f) => f.slice(0, -3));
    for (const f of files) {
      const m = /^(.*?)(\.md|\.options\.json|\.dom\.txt)$/.exec(f);
      if (m === null || !ids.includes(m[1] ?? '')) throw new Error(`layout case file ${slug}/${f} belongs to no case (each case has <id>.md)`);
    }
    for (const name of ids) {
      const id = `${slug}/${name}`;
      if (!NAME.test(name)) throw new Error(`layout case ${id}: an id is lower-case letters, digits and -`);
      const optionsFile = path.join(at, `${name}.options.json`);
      if (!existsSync(optionsFile)) throw new Error(`layout case ${id}: no ${name}.options.json`);
      out.push({
        id,
        markdown: readFileSync(path.join(at, `${name}.md`), 'utf8'),
        ...parseCaseFile(id, readFileSync(optionsFile, 'utf8')),
        expected: path.join(at, `${name}.dom.txt`),
      });
    }
  }
  return out;
}

/**
 * Compare a snapshot with the case's expected file. With `update` (UPDATE_LAYOUT=1) a missing or different file is
 * written; without it, it is reported, never written.
 */
export function compareOrWrite(actual: string, expected: string, update: boolean): 'same' | 'differs' | 'missing' | 'written' {
  const have = existsSync(expected) ? readFileSync(expected, 'utf8') : null;
  if (have === actual) return 'same';
  if (update) {
    writeFileSync(expected, actual);
    return 'written';
  }
  return have === null ? 'missing' : 'differs';
}
