// render() (docserver L1; architecture section C, "Rules for render()"; rulings C2, C3 and C20).
// 1. The byte gate: an input over `maxBytes` UTF-8 bytes is not parsed; the count stops at the cap.
// 2. Parse and render with a fresh RenderEnv; the engine holds no per-document state.
// 3. The html bound (ruling C20, departure PD8): the html is counted as it is rendered, and the first piece
//    that would take it past `maxHtmlBytes` UTF-8 bytes stops the render with outcome 'output-over-limit'
//    and the fallback block of rule 4. An input under `maxBytes` can still expand far past it (a long link
//    destination defined once and used many times), and the bound keeps that cost a host's to choose.
// 4. Any exception gives outcome 'failed' and the reference renderer's fallback block, its source escaped
//    the way the reference escaped it (Python's html.escape). It is never raw HTML, and it is cut to
//    `maxHtmlBytes` too, so no outcome returns more html than the bound.
// 5. `meta` is collected from what the rules recorded in the env (meta.ts).
// Task 9 adds the BOM strip between 1 and 2.
import type { MarkdownIt, Token } from 'markdown-it';
import { createEngine } from './engine.js';
import { createEnv, type RenderEnv } from './env.js';
import { pyEscape } from './escape.js';
import { collectMeta } from './meta.js';
import { utf8Length } from './pyText.js';
import { DEFAULT_MAX_BYTES, type RenderMeta, type RenderOptions, type RenderResult } from './types.js';

/** The meta of every result whose outcome is not 'rendered'. Frozen, so no caller can change it for another. */
export const EMPTY_META: RenderMeta = Object.freeze({
  front: null,
  frontList: null,
  title: null,
  headings: Object.freeze([]),
  figures: 0,
  tables: 0,
  mermaidKinds: Object.freeze([]),
});

/** The reference renderer's failure block, before the escaped source and its closing tag. */
export const FALLBACK_OPEN =
  '<p class="page-subtitle">This document could not be rendered; its source follows.</p><pre>';

/** The failure block's closing tag. */
const FALLBACK_CLOSE = '</pre>';

/** Default UTF-8 byte cap on the html: 16 MiB, four times the input's default cap (ruling C20). */
const DEFAULT_MAX_HTML_BYTES = 4 * DEFAULT_MAX_BYTES;

const ENGINE = createEngine();

/** A limit option, checked: a non-negative safe integer, or a RangeError naming the option. */
function checkLimit(name: string, value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`render: ${name} must be a non-negative safe integer, got ${String(value)}`);
  }
  return value;
}

/** The length, in code units, of the longest prefix of `s` that is at most `cap` UTF-8 bytes; never splits a pair. */
function utf8Prefix(s: string, cap: number): number {
  let bytes = 0;
  for (let i = 0; i < s.length; i += 1) {
    const c = s.charCodeAt(i);
    let size = c < 0x80 ? 1 : c < 0x800 ? 2 : 3;
    let units = 1;
    if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) {
      const d = s.charCodeAt(i + 1);
      if (d >= 0xdc00 && d <= 0xdfff) {
        size = 4;
        units = 2;
      }
    }
    if (bytes + size > cap) return i;
    bytes += size;
    i += units - 1;
  }
  return s.length;
}

/**
 * The failure block for `src`, at most `limit` UTF-8 bytes: the escaped source is cut at a character, never
 * inside a surrogate pair or an entity (every `&` of the escaped text starts one, up to its `;`). Below the
 * block's own 96 bytes it is ''. Internal: tests import it to check the cut.
 */
export function fallbackHtml(src: string, limit: number): string {
  const room = limit - FALLBACK_OPEN.length - FALLBACK_CLOSE.length;
  if (room < 0) return '';
  const escaped = pyEscape(src);
  let end = utf8Prefix(escaped, room);
  if (end < escaped.length) {
    const amp = escaped.lastIndexOf('&', end - 1);
    if (amp !== -1 && escaped.indexOf(';', amp) >= end) end = amp;
  }
  return `${FALLBACK_OPEN}${escaped.substring(0, end)}${FALLBACK_CLOSE}`;
}

/**
 * The engine's renderer.render with the html counted as it grows: each piece a render rule returns is
 * counted in UTF-8 bytes before it is appended, and the first piece that would take the html past `limit`
 * stops the render (undefined). An inline token's children are rendered here one at a time, exactly as
 * renderer.renderInline does, so a paragraph of many long links stops at the bound instead of being built
 * whole. The pieces are the ones renderer.render would join, so a finished html equals renderer.render's byte for byte.
 */
function renderBounded(engine: MarkdownIt, tokens: Token[], env: RenderEnv, limit: number): string | undefined {
  const renderer = engine.renderer;
  let html = '';
  let room = limit;
  const add = (list: Token[], i: number): boolean => {
    const rule = renderer.rules[list[i]?.type ?? ''];
    const piece =
      rule === undefined ? renderer.renderToken(list, i, engine.options) : rule(list, i, engine.options, env, renderer);
    const bytes = utf8Length(piece, room);
    if (bytes > room) return false;
    room -= bytes;
    html += piece;
    return true;
  };
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token?.type !== 'inline') {
      if (!add(tokens, i)) return undefined;
    } else {
      const children = token.children ?? [];
      for (let j = 0; j < children.length; j += 1) if (!add(children, j)) return undefined;
    }
  }
  return html;
}

/**
 * render() with an explicit engine. Internal: tests inject a faulty engine here to reach the fallback.
 * Throws RangeError for an invalid `maxBytes` or `maxHtmlBytes`; never throws for any input text.
 */
export function renderWith(markdown: string, o: RenderOptions | undefined, engine: MarkdownIt): RenderResult {
  const maxBytes = checkLimit('maxBytes', o?.maxBytes ?? DEFAULT_MAX_BYTES);
  const maxHtmlBytes = checkLimit('maxHtmlBytes', o?.maxHtmlBytes ?? DEFAULT_MAX_HTML_BYTES);
  const bytes = utf8Length(markdown, maxBytes);
  if (bytes > maxBytes) return { html: '', outcome: 'over-limit', bytes, meta: EMPTY_META };
  const src = markdown;
  try {
    const env = createEnv({ lineAttrs: o?.lineAttrs ?? true });
    const tokens = engine.parse(src, env);
    const html = renderBounded(engine, tokens, env, maxHtmlBytes);
    if (html === undefined) {
      return { html: fallbackHtml(src, maxHtmlBytes), outcome: 'output-over-limit', bytes, meta: EMPTY_META };
    }
    return { html, outcome: 'rendered', bytes, meta: collectMeta(env) };
  } catch {
    return { html: fallbackHtml(src, maxHtmlBytes), outcome: 'failed', bytes, meta: EMPTY_META };
  }
}

/** Render Markdown to HTML and meta. Pure and deterministic; see RenderOptions for the three options. */
export function render(markdown: string, o?: RenderOptions): RenderResult {
  return renderWith(markdown, o, ENGINE);
}
