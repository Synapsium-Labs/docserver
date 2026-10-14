// The README documents what ships (docserver L1, Task 12; architecture section F T12). Each runtime export of
// both entries, the three default limits, the allowlist, every departure category, the warning that ids may
// collide (ruling C22) and the consumer's corpus call is named there, so a new export or a new departure cannot
// ship undocumented. The words around them are not pinned; the names are.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as conformance from '../src/conformance/index.js';
import * as render from '../src/render/index.js';

const README = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
const departures = JSON.parse(readFileSync(new URL('../conformance/DEPARTURES.json', import.meta.url), 'utf8')) as {
  category: string;
}[];

/** The categories with no file to move (PD1 compares code as text; PD5, PD6, PD8 and PD9 move no golden), then those that do. */
const CATEGORIES = [...new Set(['PD1', 'PD5', 'PD6', 'PD8', 'PD9', ...departures.map((d) => d.category)])].sort();

describe('README', () => {
  it('names every runtime export of ./render and ./conformance', () => {
    const names = [...Object.keys(render), ...Object.keys(conformance)].sort();
    expect(names).toHaveLength(13);
    expect(names.filter((n) => !README.includes(`\`${n}\``) && !README.includes(`\`${n}(`))).toEqual([]);
  });

  it('states the default limits with their values, the html bound among them', () => {
    expect(README).toContain(`\`DEFAULT_MAX_BYTES\`, ${String(render.DEFAULT_MAX_BYTES)}`);
    expect(README).toContain(`\`DEFAULT_MAX_IMAGES\`, ${String(render.DEFAULT_MAX_IMAGES)}`);
    expect(README).toContain(`| \`maxHtmlBytes\` | ${String(4 * render.DEFAULT_MAX_BYTES)} `);
    expect(README).toContain("`'output-over-limit'`");
  });

  it('warns that ids may collide, so a host never looks an element up by a document id (ruling C22)', () => {
    expect(README).toContain('ids may collide');
    expect(README).toContain('must never look up an element of a rendered document by a document id');
  });

  it('lists every inline tag of the allowlist and the anchor id grammar', () => {
    const missing = render.ALLOWLIST.inlineTags.filter((t) => !README.includes(`\`<${t}>\``));
    expect(missing).toEqual([]);
    expect(README).toContain(`\`${render.ALLOWLIST.anchorId}\``);
  });

  it('states the highlighting bounds, the switch to one line at a time included (ruling C24)', () => {
    expect(README).toContain('a fence with a line over 256 characters');
    expect(README).toContain('256 KiB of highlighted code');
    expect(README).toContain('A fence over 256 characters is highlighted one line at a time');
  });

  it('tells hosts that memory is linear in the input, and that raising maxHtmlBytes lifts the output bound', () => {
    expect(README).toContain('Memory is linear in the size of the input');
    expect(README).toContain('so size `maxBytes` to your heap');
    expect(README).toContain('Raising `maxHtmlBytes` removes the output bound that protects you');
  });

  it('states the span depth bound of highlighted code, and that the 64-level cap is for the allowlisted tags only', () => {
    expect(README).toContain('nests `<span>` elements at most about 170 deep');
    expect(README).toContain('the 64-level cap below applies to the allowlisted tags only');
  });

  it('describes every departure category, one table row each', () => {
    expect(CATEGORIES).toEqual(['PD1', 'PD2', 'PD3', 'PD4', 'PD5', 'PD6', 'PD7', 'PD8', 'PD9']);
    expect(CATEGORIES.filter((c) => README.split(`\n| ${c} | `).length !== 2)).toEqual([]);
  });

  it('PD2 lists the whole of the departure: the scalars, the loader differences (a) to (e), tags, line breaks, null items', () => {
    const row = README.split('\n').find((l) => l.startsWith('| PD2 | ')) ?? '';
    for (const part of [
      '`null` renders empty',
      '(a) array-index keys are listed first',
      '(b) a last block scalar keeps its trailing line feed',
      '(c) a sequence key loads as its items joined by commas',
      '(d) nesting deeper than 100 levels fails the load',
      "(e) merged keys follow js-yaml's order: they sit where the `<<` is, and a merge list's sources come in list order",
      'A tag outside the schema (`!!int`, `!!float`, `!!binary`) fails the load',
      'U+0085, U+2028 and U+2029 are not line breaks',
      'A null list item renders empty',
    ]) {
      expect(row).toContain(part);
    }
  });

  it('PD8 says a front-matter key is cut to 500 code points, as a value is (ruling C31)', () => {
    const row = README.split('\n').find((l) => l.startsWith('| PD8 | ')) ?? '';
    expect(row).toContain('a front-matter key is cut to 500 code points, as a value is');
  });

  it("shows a consumer's CI call with scanRefs, and the golden-move trailer", () => {
    expect(README).toContain('runCorpus(render, { scanRefs })');
    expect(README).toContain('Goldens-moved: <id>, <id>');
  });
});
