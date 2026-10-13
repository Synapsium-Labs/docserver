// The public surface of `./render` (docserver L1, Tasks 1 and 5; architecture section C, rulings C2 and C3).
// The runtime names are pinned here, so a new public export is a deliberate edit of this list: Task 5 added
// 'ALLOWLIST'. The signatures are type-level assertions, checked by `npm run typecheck` (this file is in
// tsconfig.json's include); at run time `expectTypeOf` is a no-op.
import { describe, expect, expectTypeOf, it } from 'vitest';
import * as api from '../src/render/index.js';
import {
  ALLOWLIST,
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_IMAGES,
  render,
  scanRefs,
  type FrontEntry,
  type Heading,
  type RenderMeta,
  type RenderOptions,
  type RenderOutcome,
  type RenderResult,
  type ScanRefsOptions,
  type ScanRefsResult,
} from '../src/render/index.js';

describe('./render: default limits (ruling C3)', () => {
  it('DEFAULT_MAX_BYTES is 4 MiB', () => {
    expect(DEFAULT_MAX_BYTES).toBe(4_194_304);
  });

  it('DEFAULT_MAX_IMAGES is 512', () => {
    expect(DEFAULT_MAX_IMAGES).toBe(512);
  });
});

describe('./render: runtime exports', () => {
  it('are exactly ALLOWLIST, the two limits, render and scanRefs', () => {
    expect(Object.keys(api).sort()).toEqual([
      'ALLOWLIST',
      'DEFAULT_MAX_BYTES',
      'DEFAULT_MAX_IMAGES',
      'render',
      'scanRefs',
    ]);
  });
});

describe('./render: signatures (ruling C2)', () => {
  it('ALLOWLIST is the readonly allowlist of section C, literal types included', () => {
    expectTypeOf(ALLOWLIST).toEqualTypeOf<
      Readonly<{
        inlineTags: readonly ['br', 'sup', 'sub', 'kbd'];
        blockLines: readonly ['<details>', '<details open>', '</details>', '<summary>…</summary>'];
        anchorId: '[A-Za-z0-9_-]{1,100}';
      }>
    >();
  });

  it('render(markdown, options?) returns a RenderResult', () => {
    expectTypeOf(render).toEqualTypeOf<(markdown: string, o?: RenderOptions) => RenderResult>();
    expectTypeOf<keyof RenderOptions>().toEqualTypeOf<'maxBytes' | 'maxHtmlBytes' | 'lineAttrs'>();
  });

  it('RenderResult is html, outcome, bytes and meta', () => {
    expectTypeOf<keyof RenderResult>().toEqualTypeOf<'html' | 'outcome' | 'bytes' | 'meta'>();
    expectTypeOf<RenderOutcome>().toEqualTypeOf<'rendered' | 'over-limit' | 'output-over-limit' | 'failed'>();
    expectTypeOf<RenderResult['outcome']>().toEqualTypeOf<RenderOutcome>();
    expectTypeOf<RenderResult['meta']>().toEqualTypeOf<RenderMeta>();
  });

  it('RenderMeta holds front, frontList, title, headings, figures, tables and mermaidKinds', () => {
    expectTypeOf<keyof RenderMeta>().toEqualTypeOf<
      'front' | 'frontList' | 'title' | 'headings' | 'figures' | 'tables' | 'mermaidKinds'
    >();
    expectTypeOf<RenderMeta['front']>().toEqualTypeOf<Readonly<Record<string, string | readonly string[]>> | null>();
    expectTypeOf<RenderMeta['frontList']>().toEqualTypeOf<readonly FrontEntry[] | null>();
    expectTypeOf<RenderMeta['title']>().toEqualTypeOf<string | null>();
    expectTypeOf<RenderMeta['headings']>().toEqualTypeOf<readonly Heading[]>();
    expectTypeOf<RenderMeta['mermaidKinds']>().toEqualTypeOf<readonly string[]>();
    expectTypeOf<Heading>().toEqualTypeOf<{ level: 1 | 2 | 3 | 4 | 5 | 6; id: string; text: string }>();
    expectTypeOf<FrontEntry>().toEqualTypeOf<{ key: string; list: boolean; vals: string[] }>();
  });

  it('scanRefs(markdown, options?) returns an outcome, images, imagesTruncated and mermaid sizes', () => {
    expectTypeOf(scanRefs).toEqualTypeOf<(markdown: string, o?: ScanRefsOptions) => ScanRefsResult>();
    expectTypeOf<keyof ScanRefsOptions>().toEqualTypeOf<'maxBytes' | 'maxImages'>();
    expectTypeOf<keyof ScanRefsResult>().toEqualTypeOf<'outcome' | 'images' | 'imagesTruncated' | 'mermaid'>();
    expectTypeOf<ScanRefsResult['outcome']>().toEqualTypeOf<'scanned' | 'over-limit'>();
    expectTypeOf<ScanRefsResult['mermaid']>().toEqualTypeOf<{
      fences: number;
      largestBytes: number;
      totalBytes: number;
    }>();
  });
});
