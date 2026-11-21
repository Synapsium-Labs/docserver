// @vitest-environment jsdom
// Item values from render() (docserver parity, Task 4): `meta.items`, the keys the reader would ask its host `itemLink` for,
// read from render()'s own html by the two routes the reader reads (src/render/items.ts). One fixture per source and every
// bound; the equality with the reader (the same documents enhanced in jsdom with a spy `itemLink`); the patterns held to
// the vocabulary's own; the option's checks. (The conformance comparator's rule for the new key is in test/corpus.test.ts:
// this file runs in jsdom, where the corpus loader's file URLs do not.)
// The equality with the reader compares sets (both sides sorted): the reader asks its host in its own order and for at most 16
// keys, so a document with more than 16 distinct keys is out of that comparison's scope.
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { destroyEnhancement, enhance } from '../src/enhance/index.js';
import type { VocabularyOptions } from '../src/enhance/types.js';
import { compileVocab, defaultVocabulary, mergeVocabulary } from '../src/enhance/vocab.js';
import type { VocabularyOptions as WireVocabularyOptions } from '../src/frame/wire-types.js';
import { collectItems, ITEM_KEY_SOURCE, ITEM_LINE, ITEM_VALUE_MAX_CODE_UNITS, MAX_ITEMS, itemKeyScan, itemPatterns } from '../src/render/items.js';
import { EMPTY_META } from '../src/render/render.js';
import { render } from '../src/render/index.js';
import type { ReaderVocabulary } from '../src/render/types.js';
import { boundMs, bylinesWith, LONG_CUT_FACTOR, manySeparators, RUN_SIZES, sliceWork, timed } from './long-space.js';

const sepCalls = vi.hoisted(() => ({ n: 0 }));
vi.mock('../src/render/separator.js', async (original) => {
  const real = await original<typeof import('../src/render/separator.js')>();
  return { ...real, findSeparator: (text: string, from?: number) => ((sepCalls.n += 1), real.findSeparator(text, from)) };
});

/** A vocabulary that names fields and headings, as a host's would. */
const READER: ReaderVocabulary = {
  itemFields: ['Tracker', 'Ticket'],
  itemHeadings: ['Promise delta', 'Delta'],
};

const items = (md: string, reader: ReaderVocabulary | undefined = READER): readonly string[] => render(md, reader === undefined ? {} : { reader }).meta.items;

const byline = (rest: string): string => `# Title\n\n**Spec** · 2026-10-12 · ${rest}\n\n## Body\n\nText.\n`;
const delta = (heading: string, fence: string): string => `\n## ${heading}\n\n\`\`\`${fence}\n`;

describe('meta.items: the byline route', () => {
  it('lists the keys of the text of the first fact labelled with an item field, in order, each once', () => {
    expect(items(byline('Tracker: AB-12 and CD-7, then AB-12 again'))).toEqual(['AB-12', 'CD-7']);
  });

  it('reads a code element whose whole text is a key, and leaves a link, other code and other facts alone', () => {
    expect(items(byline('Tracker: `AB-12`, `not a key`, [XY-9](https://x.example/a) and `CD-7 extra` · Owner: EF-3'))).toEqual(['AB-12']);
  });

  it('reads the labels in any case and the label as strong text, and only the first fact of an item field', () => {
    expect(items(byline('**ticket:** AB-1 · Tracker: CD-2'))).toEqual(['AB-1']);
    expect(items(byline('Status: Draft · Tracker: CD-2 · Ticket: EF-3'))).toEqual(['CD-2']);
  });

  it('reads a key only where the grammar says: no word character or dash beside it, a capital first', () => {
    expect(items(byline('Tracker: xAB-12 AB-12-3 ab-12 A-1 ABCDEFGHIJK-1 AB-1x x_AB-5 AB-7_y (CD-8), EF-9.'))).toEqual(['CD-8', 'EF-9']);
  });

  it('reads an entity as the character it stands for', () => {
    expect(items(byline('Tracker: AB-1&amp;CD-2 &lt;EF-3&gt;'))).toEqual(['AB-1', 'CD-2', 'EF-3']);
  });

  it('lists nothing for a byline with no item field, a meta line the reader does not take, or no title', () => {
    expect(items(byline('Owner: AB-12'))).toEqual([]);
    // The meta paragraph must open on bold text and hold a middle dot, and not end on a colon.
    // (a plain label at the start of a line is the header-line route's, which reads the whole line)
    expect(items('# T\n\nTracker: AB-12 · 2026-10-12\n')).toEqual(['AB-12']);
    expect(items('# T\n\n**Spec** · Tracker: AB-12:\n')).toEqual([]);
    expect(items('**Spec** · 2026-10-12 · Tracker: AB-12\n')).toEqual([]);
    // After the first level-2 heading it is no byline.
    expect(items('# T\n\n## S\n\n**Spec** · Tracker: AB-12\n')).toEqual([]);
  });

  it('does not scan the body, a heading or a table for a key (P4e)', () => {
    const md = `${byline('Tracker: AB-1')}\nThe body names ZZ-9 and \`ZZ-8\`.\n\n| A | B |\n|---|---|\n| ZZ-7 | Tracker: ZZ-6 |\n\n## ZZ-5 heading\n\n- Tracker: ZZ-4\n`;
    expect(items(md)).toEqual(['AB-1']);
  });
});

describe('meta.items: the delta route', () => {
  it('reads `item:` on the first non-blank line of the first code block of an item heading, with or without a number', () => {
    expect(items(`# T\n${delta('Promise delta', 'promise-delta')}\nitem: AB-12\nother: x\n\`\`\`\n`)).toEqual(['AB-12']);
    expect(items(`# T\n${delta('2. Delta', '')}\n\n  item:CD-3\n\`\`\`\n`)).toEqual(['CD-3']);
    expect(items(`# T\n${delta('Promise-delta', '')}item: EF-4\n\`\`\`\n`)).toEqual(['EF-4']);
  });

  it('passes a section whose first code block names no key to the next item heading', () => {
    const md = `# T\n${delta('Delta', '')}no item here\n\`\`\`\n\n\`\`\`\nitem: AB-1\n\`\`\`\n${delta('Promise delta', '')}item: CD-2\n\`\`\`\n`;
    expect(items(md)).toEqual(['CD-2']);
    // A section's later code block is never its delta, and a line that is not exactly `item: <key>` names none.
    expect(items(`# T\n${delta('Delta', '')}item: AB-1 extra\n\`\`\`\n`)).toEqual([]);
    expect(items(`# T\n${delta('Delta', '')}item: ab-1\n\`\`\`\n`)).toEqual([]);
    expect(items(`# T\n${delta('Delta', '')}Item: AB-1\n\`\`\`\n`)).toEqual([]);
  });

  it('takes only a level-2 heading at the top of the document, and only a heading the vocabulary names', () => {
    expect(items(`# T\n\n### Delta\n\n\`\`\`\nitem: AB-1\n\`\`\`\n`)).toEqual([]);
    expect(items(`# T\n${delta('Other', '')}item: AB-1\n\`\`\`\n`)).toEqual([]);
    expect(items(`# T\n\n> ## Delta\n>\n> \`\`\`\n> item: AB-1\n> \`\`\`\n`)).toEqual([]);
    expect(items(`# T\n${delta('Delta and more', '')}item: AB-1\n\`\`\`\n`)).toEqual([]);
  });

  it('needs the document to have a level-1 heading, as the reader builds its title block there', () => {
    expect(items(`## Delta\n\n\`\`\`\nitem: AB-1\n\`\`\`\n`)).toEqual([]);
  });

  it('reads an indented code block no more than a fence, and a mermaid figure not at all', () => {
    expect(items('# T\n\n## Delta\n\n    item: AB-1\n')).toEqual(['AB-1']);
    expect(items('# T\n\n## Delta\n\n```mermaid\nitem: AB-1\n```\n')).toEqual([]);
  });

  it('reads a heading with an entity or code in it as its text', () => {
    expect(items('# T\n\n## R&D delta\n\n```\nitem: AB-1\n```\n', { itemHeadings: ['R&D delta'] })).toEqual(['AB-1']);
    // The heading's text is its text content, code included.
    expect(items('# T\n\n## The `delta`\n\n```\nitem: AB-1\n```\n', { itemHeadings: ['the delta'] })).toEqual(['AB-1']);
    expect(items('# T\n\n## The `delta`\n\n```\nitem: AB-1\n```\n', { itemHeadings: ['the `delta`'] })).toEqual([]);
    expect(items('# T\n\n## The delta\n\n```\nitem: AB-1\n```\n', { itemHeadings: ['the delta'] })).toEqual(['AB-1']);
  });
});

describe('meta.items: the header-line route (an item field\'s label anywhere in a header paragraph, its line\'s keys)', () => {
  const header = (para: string, rest = ''): string => `# T\n\n${para}\n\n## S\n\nBody.\n${rest}`;

  it('reads a one-line header: the colon inside the bold text or right after it, and a plain label at the start of a line', () => {
    expect(items(header('**Tracker:** AB-90'))).toEqual(['AB-90']);
    expect(items(header('**Tracker**: AB-90'))).toEqual(['AB-90']);
    expect(items(header('Tracker: AB-90'))).toEqual(['AB-90']);
    expect(items(header('**ticket:** AB-90, CD-7; `EF-3`  AB-90'))).toEqual(['AB-90', 'CD-7', 'EF-3']);
  });

  it('reads the item line of a multi-line header paragraph, wherever it stands in it: first, in the middle, last', () => {
    expect(items(header('**Tracker:** AB-90\n**Status:** Draft\n**Author:** someone'))).toEqual(['AB-90']);
    expect(items(header('**Status:** Draft\n**Tracker:** AB-90\n**Author:** someone'))).toEqual(['AB-90']);
    expect(items(header('**Status:** Draft\n**Author:** someone\n**Tracker:** AB-90'))).toEqual(['AB-90']);
    expect(items(header('**Status:** Draft\nTracker: AB-90\nAuthor: someone'))).toEqual(['AB-90']);
  });

  it('takes the text from the label to the end of THAT line: a newline, a `<br>` or the next bold label ends it', () => {
    // The newline.
    expect(items(header('**Status:** CD-1\n**Tracker:** AB-90\n**Author:** EF-2'))).toEqual(['AB-90']);
    expect(items(header('**Tracker:** none\nAB-90 is on the next line'))).toEqual([]);
    // The `<br>` (a hard break, and the raw tag).
    expect(items(header('**Tracker:** AB-90  \nCD-7 after a hard break'))).toEqual(['AB-90']);
    expect(items(header('**Tracker:** AB-90<br>CD-7 after a tag'))).toEqual(['AB-90']);
    // The next bold label, on the same line.
    expect(items(header('**Tracker:** AB-90 **Owner:** CD-7'))).toEqual(['AB-90']);
    expect(items(header('**Owner:** CD-7 **Tracker:** AB-90 **Author:** EF-2'))).toEqual(['AB-90']);
    expect(items(header('**Owner**: CD-7 **Tracker**: AB-90 **Author**: EF-2'))).toEqual(['AB-90']);
    // A plain label mid-line is no label, and does not end the line.
    expect(items(header('Draft Tracker: AB-90'))).toEqual([]);
    expect(items(header('Draft `x` Tracker: AB-90'))).toEqual([]);
    expect(items(header('**Status:** Draft Tracker: AB-90'))).toEqual([]);
    expect(items(header('**Tracker:** AB-90 and Owner: CD-7'))).toEqual(['AB-90', 'CD-7']);
  });

  it('ends the line at a `<br>` with no newline after it, as html that render() did not write may (collectItems on its own)', () => {
    const at = (html: string): readonly string[] => collectItems(html, ['Tracker'], []);
    expect(at('<h1>T</h1><p><strong>Tracker:</strong> AB-1<br>CD-2</p><h2>S</h2>')).toEqual(['AB-1']);
    expect(at('<h1>T</h1><p><strong>Status:</strong> x<br><strong>Tracker:</strong> AB-1<br>CD-2<br>EF-3</p>')).toEqual(['AB-1']);
    expect(at('<h1>T</h1><p><strong>Tracker:</strong> AB-1<br />CD-2</p>')).toEqual(['AB-1']);
  });

  it('lists every key of the line, with sentences, code and an author\'s link around them', () => {
    expect(items(header('**Tracker:** see AB-90 and [CD-7](https://x.example/a) and `EF-3`'))).toEqual(['AB-90', 'EF-3']);
    expect(items(header('**Tracker:** `AB-90` **Owner:** `CD-7`'))).toEqual(['AB-90']);
  });

  it('is read from a blockquote\'s first paragraph, and from nothing else a list or a table holds', () => {
    expect(items(header('> **Status:** Draft\n> **Tracker:** AB-90'))).toEqual(['AB-90']);
    expect(items(header('> A note.\n>\n> **Tracker:** AB-90'))).toEqual([]);
    expect(items(header('- **Tracker:** AB-90'))).toEqual([]);
    expect(items(header('| a |\n|---|\n| **Tracker:** AB-90 |'))).toEqual([]);
    expect(items(header('A first paragraph.\n\n> **Tracker:** AB-90'))).toEqual(['AB-90']);
  });

  it('reads the zone after the title up to the first level-2 heading, and the first paragraph that has the label', () => {
    expect(items('# T\n\nAn intro.\n\n**Owner:** CD-7\n\n**Tracker:** AB-90\n\n**Tracker:** EF-3\n\n## S\n')).toEqual(['AB-90']);
    expect(items('# T\n\n## S\n\n**Tracker:** AB-90\n')).toEqual([]);
    expect(items('# T\n\n### Sub\n\n**Tracker:** AB-90\n\n## S\n')).toEqual(['AB-90']);
  });

  it('does not read before the title; with no title it reads from the start of the document', () => {
    expect(items('**Tracker:** AB-90\n\n# T\n\n## S\n')).toEqual([]);
    expect(items('Intro\n\n**Tracker:** AB-90\n\n# T\n\n## S\n')).toEqual([]);
    expect(items('**Tracker:** AB-90\n\n## S\n')).toEqual(['AB-90']);
    expect(items('> **Tracker:** AB-90\n\n## S\n')).toEqual(['AB-90']);
    expect(items('**Tracker:** AB-90\n')).toEqual(['AB-90']);
  });

  it('is read before or after the meta line, but never from the meta line itself', () => {
    expect(items('# T\n\n**Spec** \u00b7 2026-10-12 \u00b7 Status: Draft\n\n**Tracker:** AB-90\n\n## S\n')).toEqual(['AB-90']);
    expect(items('# T\n\n**Tracker:** AB-90\n\n**Spec** \u00b7 2026-10-12 \u00b7 Status: Draft\n\n## S\n')).toEqual(['AB-90']);
    expect(items('# T\n\n**Spec** \u00b7 a note **Tracker:** AB-90\n\n## S\n')).toEqual([]);
  });

  it('is used only when the byline has no item fact: the byline keeps its precedence, and a delta key still lists', () => {
    expect(items('# T\n\n**Spec** \u00b7 2026-10-12 \u00b7 Tracker: AB-1\n\n**Tracker:** AB-90\n\n## S\n')).toEqual(['AB-1']);
    // An item fact with no key still is the item fact.
    expect(items('# T\n\n**Spec** \u00b7 2026-10-12 \u00b7 Tracker: none yet\n\n**Tracker:** AB-90\n\n## S\n')).toEqual([]);
    expect(items(`# T\n\n**Tracker:** AB-90\n${delta('Delta', '')}item: CD-2\n\`\`\`\n`)).toEqual(['AB-90', 'CD-2']);
  });

  it('is no header line without an item field\'s label: another label, a label with no colon, a label of a past-the-zone paragraph', () => {
    expect(items(header('**Owner:** AB-90'))).toEqual([]);
    expect(items(header('**Tracker** AB-90'))).toEqual([]);
    expect(items(header('**Tracker:**'))).toEqual([]);
    expect(items(header('Text **Tracker:** AB-90'))).toEqual(['AB-90']); // a bold label anywhere in the line
    expect(items(header('Tracker is AB-90'))).toEqual([]);
    expect(items(header('The tracker: AB-90'))).toEqual([]);
  });

  it('is off without the item fields (the vocabulary gates it), and never scans the body', () => {
    expect(items(header('**Tracker:** AB-90'), {})).toEqual([]);
    expect(items(header('**Tracker:** AB-90'), { itemHeadings: ['Delta'] })).toEqual([]);
    expect(items(header('**Tracker:** AB-90', '\n**Tracker:** CD-7\n'))).toEqual(['AB-90']);
  });
});

describe('meta.items: both routes, order and bounds', () => {
  it('lists the byline keys and the delta key in document order, each once', () => {
    const md = `${byline('Tracker: AB-1 and CD-2')}${delta('Delta', '')}item: CD-2\n\`\`\`\n\n## More\n\n\`\`\`\nitem: EF-3\n\`\`\`\n`;
    expect(items(md)).toEqual(['AB-1', 'CD-2']);
    expect(items(`${byline('Tracker: AB-1')}${delta('Delta', '')}item: EF-3\n\`\`\`\n`)).toEqual(['AB-1', 'EF-3']);
  });

  const keys = (n: number, from = 1): string => Array.from({ length: n }, (_, i) => `AB-${String(from + i)}`).join(' ');

  it('lists at most 50 values: the 50th is kept and the 51st is not (P4b)', () => {
    expect(MAX_ITEMS).toBe(50);
    expect(items(byline(`Tracker: ${keys(49)}`))).toHaveLength(49);
    expect(items(byline(`Tracker: ${keys(50)}`))).toEqual(Array.from({ length: 50 }, (_, i) => `AB-${String(i + 1)}`));
    expect(items(byline(`Tracker: ${keys(51)}`))).toEqual(Array.from({ length: 50 }, (_, i) => `AB-${String(i + 1)}`));
  });

  it('counts a value once however often it is named, so repeats do not use the 50', () => {
    expect(items(byline(`Tracker: ${keys(50)} ${keys(50)} AB-51`))).toHaveLength(50);
    expect(items(byline(`Tracker: ${keys(30)} ${keys(20)} AB-31 AB-32`))).toHaveLength(32);
  });

  it('leaves out a value of 101 code units, never cuts it, and does not count it (P4a)', () => {
    const at = `AB-${'1'.repeat(ITEM_VALUE_MAX_CODE_UNITS - 3)}`;
    const over = `AB-${'1'.repeat(ITEM_VALUE_MAX_CODE_UNITS - 2)}`;
    expect(at).toHaveLength(100);
    expect(over).toHaveLength(101);
    expect(items(byline(`Tracker: ${at}`))).toEqual([at]);
    expect(items(byline(`Tracker: ${over}`))).toEqual([]);
    expect(items(byline(`Tracker: AB-1 ${over} CD-2`))).toEqual(['AB-1', 'CD-2']);
    // Left out before the cap counts: 50 others still fit beside it.
    expect(items(byline(`Tracker: ${over} ${keys(50)}`))).toHaveLength(50);
    expect(items(`# T\n${delta('Delta', '')}item: ${over}\n\`\`\`\n`)).toEqual([]);
  });

  it('answers [] with no reader, with a reader that names no item field or heading, and for a result that is not rendered', () => {
    const md = `${byline('Tracker: AB-1')}${delta('Delta', '')}item: CD-2\n\`\`\`\n`;
    expect(render(md).meta.items).toEqual([]);
    expect(items(md, {})).toEqual([]);
    expect(items(md, { itemFields: [], itemHeadings: [] })).toEqual([]);
    expect(items(md, { itemFields: ['Tracker'] })).toEqual(['AB-1']);
    expect(items(md, { itemHeadings: ['Delta'] })).toEqual(['CD-2']);
    expect(render(md, { maxBytes: 3, reader: READER }).meta).toBe(EMPTY_META);
    expect(EMPTY_META.items).toEqual([]);
    expect(Object.isFrozen(EMPTY_META.items)).toBe(true);
  });

  it('is the same for the same input, and does not move the html', () => {
    const md = `${byline('Tracker: AB-1')}${delta('Delta', '')}item: CD-2\n\`\`\`\n`;
    const a = render(md, { reader: READER });
    const b = render(md);
    expect(a.html).toBe(b.html);
    expect(render(md, { reader: READER }).meta).toEqual(a.meta);
    expect({ ...a.meta, items: [] }).toEqual(b.meta);
  });
});

describe('the reader option', () => {
  it('is checked: a plain object, only the vocabulary keys, item lists of at most 200 words of 1 to 64 code units', () => {
    const bad = (reader: unknown): void => {
      expect(() => render('# T\n', { reader: reader as ReaderVocabulary })).toThrow(TypeError);
    };
    bad(null);
    bad('Tracker');
    bad([]);
    bad(new Map());
    bad({ itemFieldz: ['Tracker'] });
    bad({ itemFields: 'Tracker' });
    bad({ itemFields: [1] });
    bad({ itemFields: [''] });
    bad({ itemFields: [' x'] });
    bad({ itemHeadings: ['x '] });
    bad({ itemFields: ['x'.repeat(65)] });
    bad({ itemHeadings: Array.from({ length: 201 }, () => 'x') });
    bad(Object.defineProperty({}, 'itemFields', { get: () => ['x'], enumerable: true }));
    expect(() => render('# T\n', { reader: { itemFields: ['x'.repeat(64)], itemHeadings: Array.from({ length: 200 }, () => 'x') } })).not.toThrow();
    expect(() => render('# T\n', { reader: Object.assign(Object.create(null) as object, { itemFields: ['x'] }) as ReaderVocabulary })).not.toThrow();
    expect(() => render('# T\n', { reader: undefined as unknown as ReaderVocabulary })).not.toThrow();
  });

  it('accepts the whole vocabulary shape, whose other lists print mode reads', () => {
    expect(() => render('# T\n', { reader: { status: { ok: ['done'] }, ids: false, ruleIds: { prefixes: ['R'] }, qualifiers: ['annex'], addressees: ['you'], plan: { task: ['Task'] }, attention: { risk: ['diverge'] }, statusHeaders: ['status'], rulingHeaders: ['ruling'] } })).not.toThrow();
  });

  it('is checked before the byte gate, as highlight is', () => {
    expect(() => render('# T\n', { maxBytes: 0, reader: 5 as unknown as ReaderVocabulary })).toThrow(TypeError);
  });

  it('matches a word as itself, not as a pattern', () => {
    expect(items(byline('Tracker: AB-1 · **T.cker:** CD-2'), { itemFields: ['T.cker'] })).toEqual(['CD-2']);
    expect(items(byline('Tracker: AB-1'), { itemFields: ['T.*'] })).toEqual([]);
    expect(items('# T\n\n## Dxlta\n\n```\nitem: AB-1\n```\n', { itemHeadings: ['D.lta'] })).toEqual([]);
    expect(items(byline('Tracker: AB-1'), { itemFields: ['tracker'] })).toEqual(['AB-1']);
  });
});

describe('one vocabulary for the screen and for render()', () => {
  it('ReaderVocabulary is the frame\'s VocabularyOptions and the reader\'s own', () => {
    // `rules` is print mode's own (the reader's `rules` is a feature option, not a vocabulary list).
    expectTypeOf<Omit<ReaderVocabulary, 'rules'>>().toEqualTypeOf<WireVocabularyOptions>();
    expectTypeOf<Omit<ReaderVocabulary, 'rules'>>().toEqualTypeOf<VocabularyOptions>();
  });

  it("each pattern here is the vocabulary's own: the field, the heading, the key, its scan and the item line", () => {
    const words = { itemFields: ['Tracker', 'a.b', 'Ticket (x)'], itemHeadings: ['Promise delta', 'R&D delta', 'a-b c'] };
    const vocab = compileVocab(mergeVocabulary(defaultVocabulary(), words));
    const mine = itemPatterns(words.itemFields, words.itemHeadings);
    expect([mine.field.source, mine.field.flags]).toEqual([vocab.itemField.source, vocab.itemField.flags]);
    expect([mine.heading.source, mine.heading.flags]).toEqual([vocab.itemHeading.source, vocab.itemHeading.flags]);
    expect([itemKeyScan().source, itemKeyScan().flags]).toEqual([vocab.itemKeyScan().source, vocab.itemKeyScan().flags]);
    expect(`^${ITEM_KEY_SOURCE}$`).toBe(vocab.itemKey.source);
    expect(ITEM_LINE.source).toBe(vocab.itemLine.source);
    const none = compileVocab(defaultVocabulary());
    const nothing = itemPatterns([], []);
    expect([nothing.field.source, nothing.heading.source]).toEqual([none.itemField.source, none.itemHeading.source]);
  });
});

// ── the equality with the reader

const mounted: HTMLElement[] = [];

afterEach(async () => {
  for (const root of mounted.splice(0)) await destroyEnhancement(root).catch(() => undefined);
  document.body.replaceChildren();
});

/** The keys the enhance step asks `itemLink` for in `md`, in the order it asks, the host answering none. */
async function asked(md: string, reader: ReaderVocabulary, options: { maxBytes?: number; lineAttrs?: boolean } = {}): Promise<string[]> {
  const r = render(md, { ...options, reader });
  const parsed = new DOMParser().parseFromString(`<!doctype html><body>${r.html}`, 'text/html');
  const root = document.createElement('main');
  root.append(...Array.from(parsed.body.childNodes));
  document.body.append(root);
  mounted.push(root);
  const keys: string[] = [];
  await enhance(root, {
    info: { title: r.meta.title, frontList: r.meta.frontList },
    vocabulary: reader,
    itemLink: (key: string) => {
      keys.push(key);
      return null;
    },
  });
  // The reader asks for a key of any length; the list leaves out one over 100 code units, which no seed carries.
  return [...new Set(keys)].filter((k) => k.length <= ITEM_VALUE_MAX_CODE_UNITS);
}

const FIXTURES: Record<string, string> = {
  byline: byline('Tracker: AB-12 and CD-7, then AB-12 again'),
  'byline code': byline('Tracker: `AB-12`, `x`, [XY-9](https://x.example/a) and `CD-7 extra`'),
  'byline kind and date': '# T\n\n**Spec** · Ticket: AB-1 · 2026-10-12 · Status: Draft\n\n## S\n\nbody ZZ-1\n',
  'byline strong label': byline('**Tracker:** AB-1, CD-2 · Owner: EF-3'),
  'byline entities': byline('Tracker: AB-1&amp;CD-2 &lt;EF-3&gt;'),
  'byline no key': byline('Tracker: none yet'),
  delta: `# T\n${delta('Promise delta', 'promise-delta')}item: AB-12\n\`\`\`\n`,
  'delta second section': `# T\n${delta('Delta', '')}no key\n\`\`\`\n${delta('Promise delta', '')}item: CD-2\n\`\`\`\n`,
  'delta numbered': `# T\n${delta('2. Delta', '')}\n  item:CD-3\n\`\`\`\n`,
  'delta indented block': '# T\n\n## Delta\n\n    item: AB-1\n',
  'delta in a quote': '# T\n\n> ## Delta\n>\n> ```\n> item: AB-1\n> ```\n',
  'delta without a title': '## Delta\n\n```\nitem: AB-1\n```\n',
  'both routes': `${byline('Tracker: AB-1 and CD-2')}${delta('Delta', '')}item: EF-3\n\`\`\`\n`,
  'both routes, the same key': `${byline('Tracker: AB-1')}${delta('Delta', '')}item: AB-1\n\`\`\`\n`,
  'the body names keys': `${byline('Tracker: AB-1')}\nThe body names ZZ-9 and \`ZZ-8\`.\n\n## ZZ-5 heading\n\n- Tracker: ZZ-4\n`,
  'sixteen keys': byline(`Tracker: ${Array.from({ length: 16 }, (_, i) => `AB-${String(i + 1)}`).join(' ')}`),
  'header line': '# T\n\n**Tracker:** AB-90\n\n## S\n\nBody.\n',
  'header line, colon outside': '# T\n\n**Tracker**: AB-90\n\n## S\n',
  'header line, plain label': '# T\n\nTracker: AB-90\n\n## S\n',
  'header line with several keys and code': '# T\n\n**Ticket:** AB-90, `CD-7`; EF-3\n\n## S\n',
  'header paragraph, the item line first': '# T\n\n**Tracker:** AB-90\n**Status:** Draft\n**Author:** someone\n\n## S\n',
  'header paragraph, the item line in the middle': '# T\n\n**Status:** Draft\n**Tracker:** AB-90\n**Author:** CD-7\n\n## S\n',
  'header paragraph, the item line last': '# T\n\n**Status:** Draft\n**Author:** CD-7\n**Tracker:** AB-90\n\n## S\n',
  'header paragraph, plain labels': '# T\n\nStatus: Draft\nTracker: AB-90\nAuthor: CD-7\n\n## S\n',
  'header line bounded by a hard break': '# T\n\n**Tracker:** AB-90  \nCD-7 after the break\n\n## S\n',
  'header line, a plain label after an inline element': '# T\n\nDraft `x` Tracker: AB-90\n\n## S\n',
  'header line bounded by a br tag': '# T\n\n**Tracker:** AB-90<br>CD-7 after the tag\n\n## S\n',
  'header line bounded by the next bold label': '# T\n\n**Owner:** CD-7 **Tracker:** AB-90 **Author:** EF-2\n\n## S\n',
  'header line, colon outside, next bold label': '# T\n\n**Owner**: CD-7 **Tracker**: AB-90 **Author**: EF-2\n\n## S\n',
  'header line, a plain label mid-line': '# T\n\nDraft Tracker: AB-90\n\n## S\n',
  'header line, the keys on the next line': '# T\n\n**Tracker:** none\nAB-90 is on the next line\n\n## S\n',
  'header blockquote': '# T\n\n> **Status:** Draft\n> **Tracker:** AB-90\n\n## S\n',
  'header blockquote, second paragraph': '# T\n\n> A note.\n>\n> **Tracker:** AB-90\n\n## S\n',
  'header line before the title': '**Tracker:** AB-90\n\n# T\n\n## S\n',
  'header line before the title, a note first': 'Intro\n\n**Tracker:** AB-90\n\n# T\n\n## S\n',
  'header line, no title': '**Tracker:** AB-90\n\n## S\n',
  'header blockquote, no title': '> **Tracker:** AB-90\n\n## S\n',
  'header line after the meta line': '# T\n\n**Spec** \u00b7 2026-10-12 \u00b7 Status: Draft\n\n**Tracker:** AB-90\n\n## S\n',
  'header line before the meta line': '# T\n\n**Tracker:** AB-90\n\n**Spec** \u00b7 2026-10-12 \u00b7 Status: Draft\n\n## S\n',
  'the meta line names a bold label': '# T\n\n**Spec** \u00b7 a note **Tracker:** AB-90\n\n## S\n',
  'header line with a byline fact': '# T\n\n**Spec** \u00b7 2026-10-12 \u00b7 Tracker: AB-1\n\n**Tracker:** AB-90\n\n## S\n',
  'header line with an empty byline fact': '# T\n\n**Spec** \u00b7 2026-10-12 \u00b7 Tracker: none yet\n\n**Tracker:** AB-90\n\n## S\n',
  'header line with a delta': `# T\n\n**Tracker:** AB-90\n${delta('Delta', '')}item: CD-2\n\`\`\`\n`,
  'header line with a sentence': '# T\n\n**Tracker:** see AB-90 and [CD-7](https://x.example/a) and `EF-3`\n\n## S\n',
  'header line, not an item field': '# T\n\n**Owner:** AB-90\n\n## S\n',
  'header line, a first paragraph with the label wins': '# T\n\n**Tracker:** AB-90\n\n**Tracker:** CD-7\n\n## S\n',
  'header line in a list and a table': '# T\n\n- **Tracker:** AB-90\n\n| a |\n|---|\n| **Tracker:** CD-7 |\n\n## S\n',
  'header line past the first section': '# T\n\n## S\n\n**Tracker:** AB-90\n',
  'a long key': byline(`Tracker: AB-${'1'.repeat(150)} CD-2`),
};

/** The golden documents of the corpus and their options, read from the files (the loader of ./conformance needs Node's URL, which jsdom replaces). */
function goldenDocuments(): { id: string; input: string; options: { maxBytes?: number; lineAttrs?: boolean } }[] {
  const root = path.join(import.meta.dirname, '..', 'conformance');
  const manifest = JSON.parse(readFileSync(path.join(root, 'manifest.json'), 'utf8')) as { id: string; kind: string; options?: { maxBytes?: number; lineAttrs?: boolean } }[];
  return manifest
    .filter((e) => e.kind === 'golden')
    .map((e) => ({ id: e.id, input: readFileSync(path.join(root, 'corpus', `${e.id}.md`), 'utf8'), options: e.options ?? {} }));
}

describe('meta.items equals the keys the enhance step asks itemLink for', () => {
  it.each(Object.entries(FIXTURES))('fixture: %s', async (_name, md) => {
    const keys = await asked(md, READER);
    expect([...render(md, { reader: READER }).meta.items].sort()).toEqual([...keys].sort());
  });

  it('holds for every golden document of the corpus under a vocabulary that names item fields and headings', async () => {
    const readers: ReaderVocabulary[] = [
      { itemFields: ['Tracker', 'Ticket', 'Item'], itemHeadings: ['Delta', 'Promise delta', 'Item', 'Scope', 'Body', 'In short', 'Details'] },
      { itemFields: ['Status', 'Owner', 'Date', 'Spec'] },
    ];
    let withItems = 0;
    let count = 0;
    for (const reader of readers) {
      for (const c of goldenDocuments()) {
        if (c.input.length > 60_000) continue;
        const keys = await asked(c.input, reader, c.options);
        const meta = render(c.input, { ...c.options, reader }).meta.items;
        expect([c.id, [...meta].sort()]).toEqual([c.id, [...keys].sort()]);
        count += 1;
        if (meta.length > 0) withItems += 1;
      }
    }
    expect(count).toBeGreaterThanOrEqual(60);
    // Not a vacuous run: the corpus has a document with an item fact.
    expect(withItems).toBeGreaterThanOrEqual(1);
  }, 120_000);

  it('holds for every fixture under each part of the vocabulary alone', async () => {
    for (const reader of [{ itemFields: ['Tracker', 'Ticket'] }, { itemHeadings: ['Delta', 'Promise delta'] }] as ReaderVocabulary[]) {
      for (const [name, md] of Object.entries(FIXTURES)) {
        const keys = await asked(md, reader);
        expect([name, [...render(md, { reader }).meta.items].sort()]).toEqual([name, [...keys].sort()]);
      }
    }
  });
});

describe('a byline of very many separators (review 3088 F3, WebKit cycle 1)', () => {
  it('the item route cuts no text left once per separator: the long cuts of a collect return about the document, for 2 000 separators and for 16 000', () => {
    // As in test/render-print.test.ts: the code units returned by slice/substring/substr on a receiver of 4096 or more are
    // counted (the same on every engine, where JavaScriptCore may copy a cut that V8 shares). The html is rendered first, outside
    // the count, so only collectItems is measured: each piece is cut once and the pieces make the text, so the total is about
    // the byline's length (measured 1.24 times the page's, for 2 000 separators), bounded at 8 times (LONG_CUT_FACTOR); the text
    // left cut at every separator returns k times half of it (measured 8 024 148 code units for 2 000, 123 times the bound).
    for (const k of [2000, 16000]) {
      const md = manySeparators(k);
      const html = render(md).html;
      let got: readonly string[] = [];
      const work = sliceWork(() => {
        got = collectItems(html, ['Tracker'], []);
      });
      expect(got, `${String(k)} separators: nothing to list, but every fact built`).toEqual([]);
      expect(work.returned, `${String(k)} separators: ${String(work.calls)} long cuts returned ${String(work.returned)} code units of a ${String(html.length)}-unit page`).toBeLessThanOrEqual(LONG_CUT_FACTOR * html.length);
    }
  });
});

describe('a long run of white space in the byline (review 3081 F1)', () => {
  it('the item route finds the separator with the scan helper, called a bounded number of times, and a 1 MiB run costs about what plain render costs', () => {
    const opts = { reader: { itemFields: ['Tracker'] } };
    for (const n of RUN_SIZES) {
      for (const md of bylinesWith(n)) {
        const base = timed(() => render(md));
        sepCalls.n = 0;
        const ms = timed(() => render(md, opts));
        // Zero calls means a pattern was used instead of the helper; a handful is the scan of the meta line's pieces.
        expect(sepCalls.n, `${String(n)} spaces: calls of the separator helper`).toBeGreaterThanOrEqual(1);
        expect(sepCalls.n, `${String(n)} spaces: calls of the separator helper`).toBeLessThanOrEqual(4);
        expect(ms, `${String(n)} spaces took ${ms.toFixed(0)} ms (plain render of the same input ${base.toFixed(1)} ms)`).toBeLessThan(boundMs(base));
      }
    }
  });
});
