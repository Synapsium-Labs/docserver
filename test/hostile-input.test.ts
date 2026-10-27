// Generated hostile inputs and the hostile.json index (docserver L1, Task 11; architecture sections D, E and F).
// buildInput builds a generated case's input from its spec, deterministically; inputSize measures a spec
// without building it, so a spec over 8 MiB is refused before anything is allocated, and loadCorpus caps the
// total of all generated inputs the same way. parseHostile reads hostile.json and crossCheck ties it to the
// manifest: one verdict per hostile and generated case, an input spec exactly for a generated one.
import { Buffer } from 'node:buffer';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { runCorpus } from '../src/conformance/index.js';
import {
  buildInput,
  crossCheck,
  inputSize,
  MAX_INPUT_BYTES,
  parseHostile,
  sumInputSizes,
  type HostileEntry,
  type InputSpec,
} from '../src/conformance/hostile.js';

import { render } from '../src/render/index.js';

const readJson = (rel: string): unknown => JSON.parse(readFileSync(new URL(rel, import.meta.url), 'utf8'));
const MiB = 1024 * 1024;
const RENDERED = { outcome: 'rendered' } as const;

describe('buildInput', () => {
  it('concatenates the parts in order, each repeated `times` times (default once)', () => {
    expect(buildInput({ parts: [{ text: 'ab', times: 3 }, { text: '\n' }, { text: '> ', times: 2 }] })).toBe(
      'ababab\n> > ',
    );
  });

  it('replaces every index marker by the repetition number, from 0', () => {
    expect(buildInput({ parts: [{ text: '![i](@.png)\n', times: 3, index: '@' }] })).toBe(
      '![i](0.png)\n![i](1.png)\n![i](2.png)\n',
    );
    expect(buildInput({ parts: [{ text: 'x#y#', times: 2, index: '#' }] })).toBe('x0y0x1y1');
    expect(buildInput({ parts: [{ text: '@', times: 12, index: '@' }] })).toBe('01234567891011');
  });

  it('is deterministic', () => {
    const spec: InputSpec = { parts: [{ text: '[^@] ', times: 500, index: '@' }, { text: '*', times: 99 }] };
    expect(buildInput(spec)).toBe(buildInput(spec));
  });
});

describe('inputSize: the UTF-8 size of a spec, without building it', () => {
  const specs: InputSpec[] = [
    { parts: [{ text: 'a', times: 7 }] },
    { parts: [{ text: '\u00e9\u4e2d', times: 3 }, { text: '\ud83d\ude00' }] },
    { parts: [{ text: '<@>', times: 1001, index: '@' }] },
    { parts: [{ text: '@\u00e9@', times: 10, index: '@' }, { text: 'x', times: 100000 }] },
    { parts: [{ text: '\u00e9 ', times: 120, index: '\u00e9' }] },
  ];
  for (const [i, spec] of specs.entries()) {
    it(`spec ${i}: equals the built input's byte length`, () => {
      expect(inputSize(spec)).toBe(Buffer.byteLength(buildInput(spec), 'utf8'));
    });
  }
});

describe('the 8 MiB cap', () => {
  it('a spec of exactly 8 MiB is built', () => {
    const s = buildInput({ parts: [{ text: 'a', times: MAX_INPUT_BYTES }] });
    expect(MAX_INPUT_BYTES).toBe(8 * MiB);
    expect(s.length).toBe(MAX_INPUT_BYTES);
  });

  it('a 9 MiB spec is refused', () => {
    expect(() => buildInput({ parts: [{ text: 'a', times: 9 * MiB }] })).toThrow(RangeError);
    expect(() => buildInput({ parts: [{ text: 'ab', times: 4 * MiB }, { text: 'c' }] })).toThrow(
      /input spec: 8388609 bytes, over the 8388608-byte cap/,
    );
  });

  it('a repetition count over the cap is refused before any arithmetic', () => {
    expect(() => inputSize({ parts: [{ text: 'a', times: Number.MAX_SAFE_INTEGER }] })).toThrow(
      /parts\[0\]\.times is 9007199254740991, over the 8388608-byte cap/,
    );
  });

  it('the total of several specs is capped too', () => {
    const five: InputSpec = { parts: [{ text: 'a', times: 5 * MiB }] };
    expect(sumInputSizes([five])).toBe(5 * MiB);
    expect(() => sumInputSizes([five, five])).toThrow(/generated inputs total 10485760 bytes, over the 8388608-byte cap/);
  });
});

describe('an invalid spec is refused', () => {
  const bad: [string, unknown, RegExp][] = [
    ['no parts', {}, /must be \{parts/],
    ['empty parts', { parts: [] }, /must be \{parts/],
    ['an extra key', { parts: [{ text: 'a' }], seed: 1 }, /must be \{parts/],
    ['a part that is not an object', { parts: ['a'] }, /parts\[0\] is not an object/],
    ['an unknown part key', { parts: [{ text: 'a', repeat: 2 }] }, /unknown keys: repeat/],
    ['empty text', { parts: [{ text: '' }] }, /text must be a non-empty string/],
    ['zero times', { parts: [{ text: 'a', times: 0 }] }, /times must be a safe integer of at least 1/],
    ['fractional times', { parts: [{ text: 'a', times: 1.5 }] }, /times must be/],
    ['an empty index', { parts: [{ text: 'a', index: '' }] }, /index must be a non-empty string/],
    ['an index not in its text', { parts: [{ text: 'a', times: 2, index: '@' }] }, /does not occur in its text/],
  ];
  for (const [name, spec, message] of bad) {
    it(name, () => {
      expect(() => buildInput(spec as InputSpec)).toThrow(message);
    });
  }
});

describe('parseHostile', () => {
  it('reads entries, with or without an input spec', () => {
    const raw = [
      { id: 'h', verdict: { ...RENDERED, exact: true } },
      { id: 'g', input: { parts: [{ text: 'a' }] }, verdict: RENDERED },
    ];
    expect(parseHostile(raw)).toEqual(raw);
  });

  const bad: [string, unknown, RegExp][] = [
    ['not an array', {}, /must be an array/],
    ['an entry that is not an object', [1], /entry 0 is not an object/],
    ['an unknown key', [{ id: 'a', verdict: RENDERED, golden: true }], /unknown keys: golden/],
    ['no id', [{ verdict: RENDERED }], /entry 0 has no id/],
    ['an id twice', [{ id: 'a', verdict: RENDERED }, { id: 'a', verdict: RENDERED }], /a appears twice/],
    ['a bad verdict', [{ id: 'a', verdict: { outcome: 'fine' } }], /hostile\.json: a: outcome must be/],
    ['a bad input', [{ id: 'a', input: { parts: [] }, verdict: RENDERED }], /input spec/],
    ['an input over the cap', [{ id: 'a', input: { parts: [{ text: 'a', times: 9 * MiB }] }, verdict: RENDERED }], /cap/],
  ];
  for (const [name, raw, message] of bad) {
    it(`refuses ${name}`, () => {
      expect(() => parseHostile(raw)).toThrow(message);
    });
  }
});

describe('crossCheck: hostile.json against the manifest', () => {
  const spec: InputSpec = { parts: [{ text: 'a' }] };
  const cases = [
    { id: 'g0', kind: 'golden' },
    { id: 'h1', kind: 'hostile' },
    { id: 'x1', kind: 'generated' },
  ];
  const good: HostileEntry[] = [
    { id: 'h1', verdict: { ...RENDERED, exact: true } },
    { id: 'x1', input: spec, verdict: RENDERED },
  ];

  it('agrees when every hostile and generated case has its entry', () => {
    expect(crossCheck(cases, good)).toEqual([]);
  });

  it('names every disagreement', () => {
    expect(
      crossCheck(cases, [
        { id: 'g0', verdict: RENDERED },
        { id: 'h1', input: spec, verdict: { outcome: 'failed' } },
        { id: 'x1', verdict: { ...RENDERED, exact: true } },
        { id: 'zz', verdict: RENDERED },
      ]),
    ).toEqual([
      'g0: a golden case has no verdict',
      'h1: a hostile case reads its input from corpus/, not from a spec',
      'h1: a hostile case has a golden, so its verdict says exact: true',
      'h1: a hostile case with a golden must render',
      'x1: a generated case needs an input spec',
      'x1: a generated case has no golden, so no exact',
      'zz: in hostile.json but not in the manifest',
    ]);
    expect(crossCheck(cases, [])).toEqual([
      'h1: a hostile case needs a verdict in hostile.json',
      'x1: a generated case needs a verdict in hostile.json',
    ]);
  });
});

describe('the shipped hostile.json', () => {
  const manifest = readJson('../conformance/manifest.json') as { id: string; kind: string }[];
  const entries = parseHostile(readJson('../conformance/hostile.json'));

  it('agrees with the manifest: 17 hostile and 30 generated cases', () => {
    expect(crossCheck(manifest, entries)).toEqual([]);
    expect(entries.filter((e) => e.input === undefined)).toHaveLength(17);
    expect(entries.filter((e) => e.input !== undefined)).toHaveLength(30);
  });

  it('lists its entries in manifest order', () => {
    const order = manifest.filter((c) => c.kind !== 'golden').map((c) => c.id);
    expect(entries.map((e) => e.id)).toEqual(order);
  });

  it('the generated inputs total under the cap', () => {
    const specs = entries.flatMap((e) => (e.input === undefined ? [] : [e.input]));
    const total = sumInputSizes(specs);
    expect(total).toBe(specs.reduce((sum, s) => sum + Buffer.byteLength(buildInput(s), 'utf8'), 0));
    expect(total).toBeLessThanOrEqual(MAX_INPUT_BYTES);
  });

  it('is ASCII only: every other character is written as a \\u escape', () => {
    const text = readFileSync(new URL('../conformance/hostile.json', import.meta.url), 'utf8');
    expect([...text].filter((ch) => ch > '~' || (ch < ' ' && ch !== '\n'))).toEqual([]);
  });
});

describe('L3.R5: h-dom-clobber-frame-names (the spec\'s DOM clobbering case, for the reader frame)', () => {
  const ID = 'h-dom-clobber-frame-names';
  /** The names the frame, its seed and its bootstrap rely on (plan Task 11). */
  const FRAME_NAMES = ['seed', 'bootstrap', 'guard', 'docserver', 'docreader', 'currentScript', 'enhance', 'mermaid'];
  const manifest = readJson('../conformance/manifest.json') as { id: string; kind: string }[];
  const entries = parseHostile(readJson('../conformance/hostile.json'));
  const input = readFileSync(new URL(`../conformance/corpus/${ID}.md`, import.meta.url), 'utf8');

  it('is a hostile case of the manifest, listed in hostile.json with an exact golden', () => {
    expect(manifest.find((c) => c.id === ID)?.kind).toBe('hostile');
    expect(entries.find((e) => e.id === ID)?.verdict).toMatchObject({ outcome: 'rendered', exact: true });
  });

  it('its input names each one as a heading and as a comment anchor', () => {
    for (const name of FRAME_NAMES) {
      expect(input.split('\n')).toContain(`# ${name}`);
      expect(input.split('\n')).toContain(`<!-- id:${name} -->`);
    }
  });

  it('its verdict requires each id as render() emits it: the heading slug, and the anchor exactly', () => {
    const require = entries.find((e) => e.id === ID)?.verdict.require ?? [];
    expect(require).toEqual([
      ...FRAME_NAMES.map((n) => `<h1 id="${n.toLowerCase()}"`),
      ...FRAME_NAMES.map((n) => `<span class="doc-anchor" id="${n}"></span>`),
    ]);
  });

  it('renders to its expected output under its verdict: runCorpus carries it', () => {
    const run = runCorpus(render, { only: [ID] });
    expect(run).toMatchObject({ ok: true, total: 1, passed: 1 });
    expect(render(input).html).toBe(readFileSync(new URL(`../conformance/expected/${ID}.html`, import.meta.url), 'utf8'));
  });

  it('the earlier clobbering case keeps its own seven names, none of the frame\'s', () => {
    const old = entries.find((e) => e.id === 'h-dom-clobber-names')?.verdict.require ?? [];
    expect(old).toHaveLength(7);
    expect(FRAME_NAMES.filter((n) => old.some((r) => r.includes(`id="${n}"`) || r.includes(`id="${n.toLowerCase()}"`)))).toEqual([]);
  });
});

describe('L3.R3: h-xml-script-style-256k (request (c))', () => {
  const ID = 'h-xml-script-style-256k';
  const entries = parseHostile(readJson('../conformance/hostile.json'));
  const input = readFileSync(new URL(`../conformance/corpus/${ID}.md`, import.meta.url), 'utf8');

  it('is one 256 KiB xml fence of 255-unit lines alternating an open script and an open style', () => {
    expect(input.startsWith('```xml\n')).toBe(true);
    expect(input.endsWith('\n```\n')).toBe(true);
    const body = input.slice('```xml\n'.length, -'```\n'.length);
    expect(body.length).toBe(256 * 1024);
    const lines = body.split('\n').slice(0, -1);
    expect(lines).toHaveLength(1024);
    expect(lines.filter((l) => l.length !== 255)).toEqual([]);
    expect(lines.filter((l, i) => !l.startsWith(i % 2 === 0 ? '<script>' : '<style>'))).toEqual([]);
  });

  it('is committed as a hostile case: the generated inputs already fill their 8 MiB total but for a few KiB', () => {
    const specs = entries.flatMap((e) => (e.input === undefined ? [] : [e.input]));
    expect(MAX_INPUT_BYTES - sumInputSizes(specs)).toBeLessThan(Buffer.byteLength(input, 'utf8'));
  });

  it('its verdict forbids the javascript and css classes, bounds the time and requires the xml tags', () => {
    const v = entries.find((x) => x.id === ID)?.verdict;
    expect(v?.maxMs).toBeLessThanOrEqual(1000);
    expect(v?.forbid).toEqual(expect.arrayContaining(['class="language-javascript"', 'class="language-css"']));
    expect(v?.require).toEqual(['<code class="hljs language-xml">', '<span class="hljs-tag">']);
    expect(v?.exact).toBe(true);
  });
});
