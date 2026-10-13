// Heading ids (docserver L1; architecture section C, the "Anchors" row; contract section 3). A port of the
// reference's anchors plugin with its default slug function, applied to headings of every level 1-6:
// - the title is the heading's `text` and `code_inline` children joined; nothing else contributes (no raw
//   HTML, image alt, footnote reference or soft break);
// - the slug is Python's `re.sub(r"[^\w\u4e00-\u9fff\- ]", "", title.strip().lower().replace(" ", "-"))`;
// - the id is made unique per document with `-1`, `-2`, ... exactly as the reference's restart-from-1 loop
//   does, but resuming from the last suffix handed out for that slug, so 20000 equal headings cost 20000
//   set lookups, not 200 million. The answer is the same because the set of taken ids only grows.
// The rule also records each heading's level, id and stripped title in the env for `meta.headings`.
import type { StateCore, Token } from 'markdown-it';
import type { RenderEnv } from './env.js';
import { pyLower, pyStrip } from './pyText.js';
import type { Heading } from './types.js';

/**
 * Everything Python's slug pattern removes. Python 3.12's `\w` is `str.isalnum()` or `_`; over every code
 * point Unicode 15.0 assigns that is exactly `\p{L}`, `\p{N}` and `_` (measured; the two differ only on
 * code points unassigned in 15.0). The `u` flag makes the class match whole code points, never halves.
 */
const SLUG_DROP = /[^\p{L}\p{N}_\u4e00-\u9fff\- ]/gu;

/** Python's slug of a heading title: strip, lower, spaces to `-`, then drop every non-word character. */
export function pySlug(title: string): string {
  return pyLower(pyStrip(title)).replaceAll(' ', '-').replace(SLUG_DROP, '');
}

/** A heading's title: the content of its `text` and `code_inline` children, joined, and nothing else. */
export function headingTitle(children: readonly Pick<Token, 'type' | 'content'>[]): string {
  let title = '';
  for (const c of children) {
    if (c.type === 'text' || c.type === 'code_inline') title += c.content;
  }
  return title;
}

/** The ids one document has handed out, and for each slug the last suffix handed out (0: the bare slug). */
export interface SlugState {
  readonly taken: Set<string>;
  readonly next: Map<string, number>;
}

export function createSlugState(): SlugState {
  return { taken: new Set(), next: new Map() };
}

/**
 * The reference's unique_slug: the slug itself if free, else the first free `slug-i` for i = 1, 2, ...
 * Once a slug has been handed out, every candidate up to its last suffix is taken, so the search resumes
 * after it. Map and Set, never a plain object, so `__proto__` and `constructor` are ordinary slugs.
 */
export function uniqueSlug(slug: string, state: SlugState): string {
  const last = state.next.get(slug);
  let i = last === undefined ? 0 : last + 1;
  let uniq = i === 0 ? slug : `${slug}-${i}`;
  while (state.taken.has(uniq)) {
    i += 1;
    uniq = `${slug}-${i}`;
  }
  state.taken.add(uniq);
  state.next.set(slug, i);
  return uniq;
}

/** A heading token's level, from its tag `h1`..`h6`. */
function headingLevel(tag: string): Heading['level'] {
  const n = Number(tag.charAt(1));
  if (n === 1 || n === 2 || n === 3 || n === 4 || n === 5 || n === 6) return n;
  throw new Error(`anchors: unexpected heading tag ${tag}`);
}

/** The anchors core rule: sets `id` on every heading_open, before line_attrs sets `data-line`. */
export function anchors(state: StateCore): void {
  const env = state.env as RenderEnv;
  const tokens = state.tokens;
  for (const [i, t] of tokens.entries()) {
    if (t.type !== 'heading_open') continue;
    const title = headingTitle(tokens[i + 1]?.children ?? []);
    const id = uniqueSlug(pySlug(title), env.slugs);
    t.attrSet('id', id);
    env.headings.push({ level: headingLevel(t.tag), id, text: pyStrip(title) });
  }
}
