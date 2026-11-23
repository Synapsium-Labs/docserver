// The golden meta (LX6.3 final review): `readingMinutes` is this library's own key and is never written into a golden, with or without
// item values (`items`, also its own, is kept when it holds any): src/conformance/index.ts goldenMeta, seen through runCorpus.
import { describe, expect, it } from 'vitest';
import { loadCorpus, runCorpus, type RenderFn } from '../src/conformance/index.js';
import { render } from '../src/render/index.js';

describe('the goldens leave readingMinutes out, whatever else the meta holds (render only: no layout is mounted)', () => {
  const golden = loadCorpus().find((c) => c.kind === 'golden' && c.expected !== null);
  /** A render that answers item values and a time, as a host's reader would, on top of the real result. */
  const withItems: RenderFn = (md, o) => {
    const r = render(md, o);
    return { ...r, meta: { ...r.meta, items: ['alpha'], readingMinutes: 3 } };
  };

  it('a document with item values has them in its golden meta, after the other keys, and no readingMinutes', () => {
    expect(golden, 'the corpus has a golden case').toBeDefined();
    const run = runCorpus(withItems, { only: [(golden as { id: string }).id] });
    const [result] = run.results;
    expect(run.ok, 'the items are a difference from the golden').toBe(false);
    const line = (result?.failures ?? []).find((f) => f.startsWith('meta differs at offset')) ?? '';
    expect(line, 'a meta failure is reported').not.toBe('');
    // the text after the first difference is the whole of what follows the other keys: the items, then the end of the object
    expect(line.endsWith(String.raw`\"items\": [\n    \"alpha\"\n  ]\n}\n"`), line).toBe(true);
    expect(line).not.toContain('readingMinutes');
  });
});
