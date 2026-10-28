// The public surface of `./render` (docserver L1, Tasks 1 and 5; architecture section C, rulings C2 and C3), and since
// L3 Task 12 the runtime exports of `./conformance` with its bridge fixtures, bridgeCases().
// The runtime names are pinned here, so a new public export is a deliberate edit of this list: Task 5 added
// 'ALLOWLIST'. The signatures are type-level assertions, checked by `npm run typecheck` (this file is in
// tsconfig.json's include); at run time `expectTypeOf` is a no-op.
import { readFileSync } from 'node:fs';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { bridgeCases, type BridgeCases, type BridgeMessageCase, type BridgeSequence, type BridgeStep } from '../src/conformance/index.js';
import { parseBridgeCases } from '../src/conformance/bridge.js';
import { BRIDGE_PROTOCOL } from '../src/frame/protocol.js';
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
    expectTypeOf<keyof RenderOptions>().toEqualTypeOf<'maxBytes' | 'maxHtmlBytes' | 'lineAttrs' | 'highlight'>();
    expectTypeOf<RenderOptions['highlight']>().toEqualTypeOf<boolean | undefined>();
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
      largestChars: number;
      totalChars: number;
    }>();
  });
});

// ───────── ./conformance: its runtime exports and bridgeCases (docserver L3, Task 12) ─────────
// bridgeCases() is the shipped conformance/bridge-cases.json, read as runCorpus reads the corpus: the bridge's wire
// as fixtures for a consumer's own parser of it (plan Reference §8; the first consumer's row M8.5).

describe('./conformance: runtime exports', () => {
  it('are exactly the corpus runner and loader, its judges and the bridge fixtures', async () => {
    const conformance = await import('../src/conformance/index.js');
    expect(Object.keys(conformance).sort()).toEqual([
      'MAX_INPUT_BYTES',
      'bridgeCases',
      'buildInput',
      'checkOutputSafety',
      'evaluateVerdict',
      'inputSize',
      'loadCorpus',
      'normaliseForCompare',
      'runCorpus',
    ]);
  });
});

describe('./conformance: bridgeCases()', () => {
  const RAW = readFileSync(new URL('../conformance/bridge-cases.json', import.meta.url), 'utf8');

  it('answers the shipped conformance/bridge-cases.json, parsed', () => {
    expect(bridgeCases()).toEqual(JSON.parse(RAW));
  });

  it("names protocol 1, BRIDGE_PROTOCOL, and carries the fixtures' parts", () => {
    const cases = bridgeCases();
    expect(cases.bridgeProtocol).toBe(BRIDGE_PROTOCOL);
    expect(cases.messages.length).toBeGreaterThan(0);
    expect(cases.sequences.length).toBeGreaterThan(0);
    expect(cases.reasons.length).toBeGreaterThan(0);
  });

  it('answers a fresh copy each call, so a consumer that edits one cannot move the next', () => {
    const first = bridgeCases() as unknown as { messages: unknown[] };
    first.messages.length = 0;
    expect(bridgeCases().messages.length).toBeGreaterThan(0);
  });

  it('refuses a fixtures file of another protocol, or one missing a part, as loadCorpus refuses a corpus it cannot load', () => {
    const good = JSON.parse(RAW) as Record<string, unknown>;
    expect(() => parseBridgeCases(JSON.stringify({ ...good, bridgeProtocol: 2 }))).toThrow(/bridgeCases: .*protocol 2/);
    for (const part of ['about', 'reasons', 'context', 'messages', 'sequenceRules', 'sequences']) {
      const { [part]: _dropped, ...rest } = good;
      expect(() => parseBridgeCases(JSON.stringify(rest)), part).toThrow(new RegExp(`bridgeCases: .*${part}`));
    }
    expect(() => parseBridgeCases('[]')).toThrow(/bridgeCases: /);
    expect(parseBridgeCases(RAW)).toEqual(good);
  });

  it('types its answer: protocol, prose, reasons, context, message cases and timed sequences', () => {
    expectTypeOf(bridgeCases).toEqualTypeOf<() => BridgeCases>();
    expectTypeOf<keyof BridgeCases>().toEqualTypeOf<'bridgeProtocol' | 'about' | 'reasons' | 'context' | 'messages' | 'sequenceRules' | 'sequences'>();
    expectTypeOf<BridgeCases['messages'][number]>().toEqualTypeOf<BridgeMessageCase>();
    expectTypeOf<BridgeCases['sequences'][number]>().toEqualTypeOf<BridgeSequence>();
    expectTypeOf<BridgeSequence['steps'][number]>().toEqualTypeOf<BridgeStep>();
    expectTypeOf<BridgeMessageCase['direction']>().toEqualTypeOf<'frame-to-parent' | 'parent-to-frame'>();
    expectTypeOf<BridgeMessageCase['verdict']>().toEqualTypeOf<'accept' | 'refuse'>();
    expectTypeOf<BridgeCases['context']>().toEqualTypeOf<{ readonly nonce: string; readonly inFlightSha: string }>();
  });
});
