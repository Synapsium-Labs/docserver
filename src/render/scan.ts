// scanRefs() (docserver L1; architecture section C, the "scanRefs" row; rulings C2 and C3). What a host
// needs to know about a document before it renders it: the images render() will show and the sizes of the
// Mermaid sources it will turn into figures. It parses with render()'s own engine and renders nothing;
// markdown-it's parse runs the whole core chain, so the token stream is the one render() renders.
// 1. The byte gate, render()'s: over `maxBytes` UTF-8 bytes nothing is parsed and the outcome is
//    'over-limit', with no images and no fences, so an over-limit scan is never read as an empty one.
// 2. One leading U+FEFF is removed (PD4), as render() removes it, so both parse the same text.
// 3. images: the `src` of every image token render() writes, in document order, each source once. The value
//    is the token's attribute, which markdown-it's normalizeLink has already encoded (`<a b>` is `a%20b`),
//    so it is exactly what render() writes before escaping it for HTML. Images are read where render()
//    writes them: in the children of each inline token (a footnote's too: footnote_tail has moved each
//    referenced note into the stream and dropped the others), and in the caption the figcaption rule took
//    out of the stream (FenceMeta.inline). An image's own children are its alt, which render() writes as
//    text, so an image inside an alt is never read. At most `maxImages` distinct sources are kept; when
//    another distinct source exists, `imagesTruncated` is true, so a cut list is never read as a whole one.
// 4. mermaid: the fences render() turns into figures, by renderFence's own test (fenceName(info) is exactly
//    MERMAID), counted with the UTF-8 sizes of their sources (the fence content the figure writes escaped).
import type { MarkdownIt, Token } from 'markdown-it';
import { createEnv } from './env.js';
import { fenceName, MERMAID, type FenceMeta } from './fence.js';
import { utf8Length } from './pyText.js';
import { checkLimit, ENGINE, stripBom } from './render.js';
import { DEFAULT_MAX_BYTES, DEFAULT_MAX_IMAGES, type ScanRefsOptions, type ScanRefsResult } from './types.js';

/** What one scan has found so far. */
interface Scan {
  readonly maxImages: number;
  /** The distinct sources kept, at most maxImages; a Set keeps them in the order they were first seen. */
  readonly images: Set<string>;
  imagesTruncated: boolean;
  fences: number;
  largestBytes: number;
  totalBytes: number;
}

/** A fence's size is counted to the end: the whole input is already under maxBytes. */
const UNCAPPED = Number.MAX_SAFE_INTEGER;

function addImage(s: Scan, src: string): void {
  if (s.images.has(src)) return;
  if (s.images.size < s.maxImages) s.images.add(src);
  else s.imagesTruncated = true;
}

/** The images among one inline token's children, in order. An image's own children (its alt) are not read. */
function scanInline(children: readonly Token[], s: Scan): void {
  for (const t of children) {
    if (t.type === 'image') addImage(s, t.attrGet('src') ?? '');
  }
}

/** A fence that renders a Mermaid figure: its size, then the images of its caption, which follow its source. */
function scanFence(t: Token, s: Scan): void {
  if (fenceName(t.info) !== MERMAID) return;
  const bytes = utf8Length(t.content, UNCAPPED);
  s.fences += 1;
  s.totalBytes += bytes;
  s.largestBytes = Math.max(s.largestBytes, bytes);
  const caption = (t.meta as FenceMeta | null)?.inline;
  if (caption !== undefined) scanInline(caption, s);
}

/**
 * scanRefs() with an explicit engine. Internal: tests inject an engine here to show the scan renders nothing.
 * Throws RangeError for an invalid `maxBytes` or `maxImages`.
 */
export function scanWith(markdown: string, o: ScanRefsOptions | undefined, engine: MarkdownIt): ScanRefsResult {
  const maxBytes = checkLimit('scanRefs', 'maxBytes', o?.maxBytes ?? DEFAULT_MAX_BYTES);
  const maxImages = checkLimit('scanRefs', 'maxImages', o?.maxImages ?? DEFAULT_MAX_IMAGES);
  if (utf8Length(markdown, maxBytes) > maxBytes) {
    return {
      outcome: 'over-limit',
      images: [],
      imagesTruncated: false,
      mermaid: { fences: 0, largestBytes: 0, totalBytes: 0 },
    };
  }
  const s: Scan = { maxImages, images: new Set(), imagesTruncated: false, fences: 0, largestBytes: 0, totalBytes: 0 };
  for (const t of engine.parse(stripBom(markdown), createEnv({ lineAttrs: true }))) {
    if (t.type === 'inline') scanInline(t.children ?? [], s);
    else if (t.type === 'fence') scanFence(t, s);
  }
  return {
    outcome: 'scanned',
    images: [...s.images],
    imagesTruncated: s.imagesTruncated,
    mermaid: { fences: s.fences, largestBytes: s.largestBytes, totalBytes: s.totalBytes },
  };
}

/** The images and Mermaid sizes render() would show for `markdown`, from a parse alone. Pure and deterministic. */
export function scanRefs(markdown: string, o?: ScanRefsOptions): ScanRefsResult {
  return scanWith(markdown, o, ENGINE);
}
