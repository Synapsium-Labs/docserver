// The structural snapshot of an enhanced root, for Level 2 of the corpus (§3.5): page-side code, bundled into the
// test page by test/browser/harness.ts, and run under jsdom by test/browser/snapshot.test.ts. It reads the DOM only.
//
// Every source node (the rendered document's own) is listed by its tag, and every source text by its text. A node in
// the case's scope also shows what the layout put on it: its classes, the chrome mark, role, aria-*, hidden,
// data-docreader-* and data-label. Nothing else, and no sizes or style values: the snapshot is structural.
//
// The scope is a list of entries:
// - a class name (`byline`, `table-wrapper`): an element with that class is in scope with its whole subtree, chrome
//   and source alike, so a component's inside shows in full;
// - `[name]` (`[hidden]`, `[aria-label]`): a SOURCE element that carries that attribute is in scope by itself (its
//   children are judged on their own). Chrome is never in scope by an attribute: only its class brings it in.
//
// Chrome outside the scope is transparent: its children stand in its place, and the texts on either side of it join.
// Chrome's own text (a button's label, a reading time) is left out there; source text it holds (a word the layout
// moved into a mark) stays. So a feature built later, whose chrome no earlier case names in its scope, never moves an
// earlier case. A text is a source text when `isSource` says so (test/browser/page/source.ts tracks them).
//
// The format, one node per line, two spaces of indent per level:
//   h2 .folded aria-expanded="false" hidden="until-found"
//     "1. Context"
// Texts are joined, their white space runs collapsed to one space and trimmed, empty ones dropped, then cut to 40
// code points (a cut text ends in `…` after its closing quote). Classes are sorted; attribute values are JSON strings,
// cut the same way.

/** The attribute every element the layout creates carries (src/enhance/journal.ts). */
export const CHROME_ATTR = 'data-docreader-chrome';

/** How many code points of a text or attribute value the snapshot keeps. */
export const TEXT_CUT = 40;

/** A valid scope entry: a class name, or `[attribute]`. */
export const SCOPE_ENTRY = /^(?:-?[A-Za-z_][\w-]*|\[[a-z][a-z0-9-]*\])$/;

type Out = { kind: 'el'; head: string; children: Out[] } | { kind: 'text'; text: string };

interface Scope {
  readonly classes: readonly string[];
  readonly attrs: readonly string[];
}

function parseScope(scope: readonly string[]): Scope {
  const bad = scope.filter((s) => !SCOPE_ENTRY.test(s));
  if (bad.length > 0) throw new Error(`snapshot: invalid scope entries ${JSON.stringify(bad)}`);
  return {
    classes: scope.filter((s) => !s.startsWith('[')),
    attrs: scope.filter((s) => s.startsWith('[')).map((s) => s.slice(1, -1)),
  };
}

/** The first `TEXT_CUT` code points of `s` as a JSON string, then `…` when anything was cut. */
function cut(s: string): string {
  const points = Array.from(s);
  return points.length > TEXT_CUT ? `${JSON.stringify(points.slice(0, TEXT_CUT).join(''))}…` : JSON.stringify(s);
}

/** What the layout put on an element in scope: classes, the chrome mark, role, aria-*, hidden, data-docreader-*, data-label. */
function head(el: Element, inScope: boolean): string {
  const tag = el.localName;
  if (!inScope) return tag;
  const parts = [tag];
  const classes = Array.from(el.classList).sort();
  if (classes.length > 0) parts.push(`.${classes.join('.')}`);
  if (el.hasAttribute(CHROME_ATTR)) parts.push('chrome');
  const named = Array.from(el.attributes)
    .map((a) => a.name)
    .filter((n) => n === 'role' || n === 'hidden' || n === 'data-label' || n.startsWith('aria-') || (n.startsWith('data-docreader-') && n !== CHROME_ATTR));
  const rank = (n: string): number => (n === 'role' ? 0 : n.startsWith('aria-') ? 1 : n === 'hidden' ? 2 : n === 'data-label' ? 4 : 3);
  named.sort((a, b) => rank(a) - rank(b) || (a < b ? -1 : a > b ? 1 : 0));
  for (const n of named) parts.push(`${n}=${cut(el.getAttribute(n) ?? '')}`);
  return parts.join(' ');
}

/** The output nodes of `node`'s children, with transparent chrome flattened in place. */
function walkChildren(parent: Node, inScope: boolean, scope: Scope, isSource: (t: Text) => boolean, into: Out[]): void {
  for (let n = parent.firstChild; n !== null; n = n.nextSibling) {
    if (n.nodeType === 3) {
      if (inScope || isSource(n as Text)) into.push({ kind: 'text', text: (n as Text).data });
      continue;
    }
    if (n.nodeType !== 1) continue;
    const el = n as Element;
    const chrome = el.hasAttribute(CHROME_ATTR);
    const byClass = scope.classes.some((c) => el.classList.contains(c));
    const byAttr = !chrome && scope.attrs.some((a) => el.hasAttribute(a));
    if (chrome && !inScope && !byClass) {
      walkChildren(el, false, scope, isSource, into); // transparent
      continue;
    }
    const subtree = inScope || byClass;
    const children: Out[] = [];
    walkChildren(el, subtree, scope, isSource, children);
    into.push({ kind: 'el', head: head(el, subtree || byAttr), children });
  }
}

/** Join adjacent texts, collapse white space, drop empty texts. */
function joinTexts(list: readonly Out[]): Out[] {
  const out: Out[] = [];
  let pending: string | null = null;
  const flush = (): void => {
    if (pending === null) return;
    const t = pending.replace(/\s+/g, ' ').trim();
    if (t !== '') out.push({ kind: 'text', text: t });
    pending = null;
  };
  for (const o of list) {
    if (o.kind === 'text') {
      pending = (pending ?? '') + o.text;
      continue;
    }
    flush();
    out.push({ kind: 'el', head: o.head, children: joinTexts(o.children) });
  }
  flush();
  return out;
}

function serialize(list: readonly Out[], depth: number, lines: string[]): void {
  const pad = '  '.repeat(depth);
  for (const o of list) {
    if (o.kind === 'text') {
      lines.push(`${pad}${cut(o.text)}`);
      continue;
    }
    lines.push(`${pad}${o.head}`);
    serialize(o.children, depth + 1, lines);
  }
}

/** The snapshot of `root`'s contents (the root itself is not listed), one line per node, ending in a line feed. */
export function snapshot(root: Element, scope: readonly string[], isSource: (t: Text) => boolean): string {
  const parsed = parseScope(scope);
  const top: Out[] = [];
  walkChildren(root, false, parsed, isSource, top);
  const lines: string[] = [];
  serialize(joinTexts(top), 0, lines);
  return `${lines.join('\n')}\n`;
}
