// The shapes of private detail (docserver L3, Task 14), shared by the tree test (test/public-ready.test.ts) and the
// history scan (scripts/history-scan.mjs), so both look for one list. Generic shapes only, never a list of private
// names (such a list would itself be the leak): absolute home and mount paths, private-network host suffixes, RFC 1918
// and carrier-grade NAT (the 100.64/10 block) addresses, e-mail addresses outside the reserved example domains and
// noreply, and credential shapes. A list of names, when a scan needs one, comes from a file outside the repository
// (namesShape, readNamesFile) and is matched as one more shape, `listed name`.
//
// findShapes() returns each match with its line, its shape and the matched text: the tree test prints the text, so a
// developer sees what to fix in their own checkout; the history scan prints only the line and the shape. The regex
// literals below hold no positive themselves (a slash or a dot is escaped inside each), so the tree test scans this
// file like any other. Dev tooling, never shipped; types in public-shapes.d.mts.

/** Mail domains reserved for examples and tests (RFC 2606, RFC 6761), and noreply addresses. */
function allowedMail(local, domain) {
  const d = domain.toLowerCase();
  if (local.toLowerCase() === 'noreply' || d === 'users.noreply.github.com') return true;
  if (/(?:^|\.)example\.(?:com|net|org)$/.test(d)) return true;
  return /\.(?:example|invalid|test|localhost)$/.test(d);
}

/** True for a dotted quad in 10/8, 172.16/12, 192.168/16 or 100.64/10. */
function privateAddress(octets) {
  const [a = -1, b = -1] = octets;
  if (octets.some((n) => n > 255)) return false;
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}

/** The shapes, each a global regex and, where a match needs a second look, a `keep` predicate. */
export const SHAPES = Object.freeze([
  { name: 'home or mount path', re: /(?<![\w.~-])(?:\/home\/|\/Users\/|\/root\/|\/mnt\/|\/data\/|~\/|[A-Za-z]:\\Users\\)/g },
  { name: 'private host suffix', re: /\b[A-Za-z0-9-]+\.(?:ts\.net|local|internal|lan)\b/g },
  {
    name: 'private address',
    re: /(?<![\d.])(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(?!\.?\d)/g,
    keep: (m) => privateAddress(m.slice(1, 5).map(Number)),
  },
  {
    name: 'e-mail address',
    re: /([A-Za-z0-9._%+-]+)@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,})\b/g,
    keep: (m) => !allowedMail(m[1] ?? '', m[2] ?? ''),
  },
  {
    name: 'credential',
    re: /\b(?:gh[oprsu]_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{40,}|npm_[A-Za-z0-9]{36}|AKIA[0-9A-Z]{16})\b|-----BEGIN [A-Z ]*PRIVATE KEY-----/g,
  },
]);

/** The shape a names list is matched as. */
export const LISTED_NAME = 'listed name';

/**
 * A shape for a list of names: any of them, in any case, standing alone (no letter, digit or `_` right before or
 * after it). Throws on an empty list, which would match nothing and so prove nothing.
 */
export function namesShape(names) {
  if (!Array.isArray(names) || names.length === 0) throw new Error('public-shapes: the names list is empty');
  // Only the characters a pattern gives a meaning to are escaped: under the `u` flag an escape of any other character
  // (`\-` outside a class, say) is a syntax error, and a hyphen stands for itself outside a class.
  const escaped = [...names].sort((a, b) => b.length - a.length).map((n) => n.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&'));
  return { name: LISTED_NAME, re: new RegExp(`(?<![\\p{L}\\p{N}_])(?:${escaped.join('|')})(?![\\p{L}\\p{N}_])`, 'giu') };
}

/**
 * The names of a names file: one per line, white space trimmed, blank lines and lines starting with `#` skipped.
 * Throws when the file names none.
 */
export function parseNames(text) {
  const names = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l !== '' && !l.startsWith('#'));
  if (names.length === 0) throw new Error('public-shapes: the names file lists no name');
  return names;
}

/**
 * Every match of `shapes` (SHAPES unless given) in `text`, line by line: `{line, shape, match}`, line counted from 1,
 * in the order the lines and then the shapes come.
 */
export function findShapes(text, shapes = SHAPES) {
  const out = [];
  text.split('\n').forEach((line, i) => {
    for (const s of shapes) {
      for (const m of line.matchAll(s.re)) {
        if (s.keep === undefined || s.keep(m)) out.push({ line: i + 1, shape: s.name, match: m[0] });
      }
    }
  });
  return out;
}
