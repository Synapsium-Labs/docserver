// render() around the engine (docserver L1, Task 3; architecture section C, "Rules for render()"; rulings
// C2, C3 and C20): the byte gate, the html bound, the escaped fallback when the engine throws, the frozen
// empty meta of every result that is not 'rendered', the lineAttrs option, and determinism across calls.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createEngine } from '../src/render/engine.js';
import { DEFAULT_MAX_BYTES, render } from '../src/render/index.js';
import { EMPTY_META, FALLBACK_OPEN, fallbackHtml, renderWith } from '../src/render/render.js';

const EMPTY = {
  front: null,
  frontList: null,
  title: null,
  headings: [],
  figures: 0,
  tables: 0,
  mermaidKinds: [],
};

/** An engine whose core chain throws once it has parsed: the fault injection for the fallback. */
function faultyEngine(): ReturnType<typeof createEngine> {
  const md = createEngine();
  md.core.ruler.push('fault', () => {
    throw new Error('injected fault');
  });
  return md;
}

describe('render: the byte gate', () => {
  it('over-limit at maxBytes + 1, with a two-byte character at the boundary', () => {
    const text = 'é'.repeat(5); // 10 UTF-8 bytes
    expect(render(text, { maxBytes: 10 }).outcome).toBe('rendered');
    expect(render(text, { maxBytes: 9 })).toEqual({ html: '', outcome: 'over-limit', bytes: 10, meta: EMPTY });
  });

  it('a four-byte character that crosses the cap reports cap + 1, the point where counting stopped', () => {
    expect(render('a😀', { maxBytes: 5 }).outcome).toBe('rendered');
    expect(render('a😀', { maxBytes: 4 })).toMatchObject({ html: '', outcome: 'over-limit', bytes: 5 });
    expect(render('a😀😀😀', { maxBytes: 2 })).toMatchObject({ html: '', outcome: 'over-limit', bytes: 3 });
  });

  it('the meta of an over-limit result is the frozen EMPTY_META', () => {
    const r = render('xx', { maxBytes: 1 });
    expect(r.meta).toBe(EMPTY_META);
    expect(Object.isFrozen(r.meta)).toBe(true);
    expect(Object.isFrozen(r.meta.headings)).toBe(true);
    expect(Object.isFrozen(r.meta.mermaidKinds)).toBe(true);
  });

  it('a rendered result reports the exact UTF-8 length', () => {
    const text = 'a é € 😀\n';
    expect(render(text).bytes).toBe(new TextEncoder().encode(text).length);
  });

  it('the default cap is DEFAULT_MAX_BYTES', () => {
    // Field by field, outcome first: a whole-object diff of a 4 MiB html string would take minutes.
    const r = render('a'.repeat(DEFAULT_MAX_BYTES + 1));
    expect(r.outcome).toBe('over-limit');
    expect(r.bytes).toBe(DEFAULT_MAX_BYTES + 1);
    expect(r.html === '').toBe(true);
    expect(render('a'.repeat(DEFAULT_MAX_BYTES)).outcome).toBe('rendered');
  });

  it('maxBytes 0 admits only the empty document', () => {
    expect(render('', { maxBytes: 0 }).outcome).toBe('rendered');
    expect(render(' ', { maxBytes: 0 }).outcome).toBe('over-limit');
  });

  it('an invalid maxBytes is a RangeError, not a gate that lets everything through', () => {
    for (const maxBytes of [Number.NaN, -1, 1.5, Number.POSITIVE_INFINITY]) {
      expect(() => render('x', { maxBytes })).toThrow(RangeError);
    }
  });
});

/** UTF-8 bytes of a string. */
const utf8 = (s: string): number => new TextEncoder().encode(s).length;

/** Every corpus input with a file of its own (generated cases have none), read the way loadCorpus reads it. */
function corpusInputs(): { id: string; input: string }[] {
  const dir = new URL('../conformance/', import.meta.url);
  const manifest = JSON.parse(readFileSync(new URL('manifest.json', dir), 'utf8')) as { id: string; kind: string }[];
  return manifest
    .filter((c) => c.kind !== 'generated')
    .map((c) => ({ id: c.id, input: readFileSync(new URL(`corpus/${c.id}.md`, dir)).toString('utf8') }));
}

describe('render: the html bound (ruling C20)', () => {
  it('html of exactly maxHtmlBytes renders; one byte less is output-over-limit, with the fallback', () => {
    const src = `[r]: /${'u'.repeat(50)}\n\n[r] [r] [r] [r] \u00e9\n`;
    const html = render(src).html;
    const bytes = utf8(src);
    expect(render(src, { maxHtmlBytes: utf8(html) })).toEqual({ html, outcome: 'rendered', bytes, meta: EMPTY });
    const r = render(src, { maxHtmlBytes: utf8(html) - 1 });
    expect(r).toEqual({ html: `${FALLBACK_OPEN}${src}</pre>`, outcome: 'output-over-limit', bytes, meta: EMPTY });
    expect(r.meta).toBe(EMPTY_META);
  });

  it('every piece counts, inline ones too: each corpus case renders at its html size and stops a byte under', () => {
    for (const c of corpusInputs()) {
      const { html } = render(c.input);
      expect(render(c.input, { maxHtmlBytes: utf8(html) }).html, c.id).toBe(html);
      const under = render(c.input, { maxHtmlBytes: Math.max(0, utf8(html) - 1) });
      expect(under.outcome, c.id).toBe(html === '' ? 'rendered' : 'output-over-limit');
    }
  });

  it('rendering stops at the bound: the rest of the document is never rendered', () => {
    const md = createEngine();
    const text = md.renderer.rules.text;
    if (text === undefined) throw new Error('markdown-it has no text rule');
    let calls = 0;
    md.renderer.rules.text = (tokens, idx, options, env, self) => {
      calls += 1;
      return text(tokens, idx, options, env, self);
    };
    expect(renderWith('word\n\n'.repeat(1000), { maxHtmlBytes: 100 }, md).outcome).toBe('output-over-limit');
    expect(calls).toBeLessThan(5);
  });

  it('the default is 16 MiB, four times DEFAULT_MAX_BYTES', () => {
    // A long destination defined once and used many times: about 50 KB of input, 16 MiB of html.
    const doc = (uses: number, fill: number): string =>
      `[r]: /${'u'.repeat(1000)}\n\n${'[r],'.repeat(uses)}${'a'.repeat(fill)}\n`;
    const one = utf8(render(doc(1, 0)).html);
    const fill = 16_777_216 - one - 15_999 * (utf8(render(doc(2, 0)).html) - one);
    expect(fill).toBeGreaterThan(0);
    expect(render(doc(16_000, fill)).outcome).toBe('rendered');
    expect(render(doc(16_000, fill + 1)).outcome).toBe('output-over-limit');
    expect(4 * DEFAULT_MAX_BYTES).toBe(16_777_216);
  });

  it('an invalid maxHtmlBytes is a RangeError, not a bound that lets everything through', () => {
    for (const maxHtmlBytes of [Number.NaN, -1, 1.5, Number.POSITIVE_INFINITY]) {
      expect(() => render('x', { maxHtmlBytes })).toThrow(RangeError);
    }
  });

  it('the fallback is cut to the bound at a character, never inside an escape; below its own size it is empty', () => {
    const shell = utf8(`${FALLBACK_OPEN}</pre>`);
    expect(shell).toBe(96);
    expect(fallbackHtml('a&b', shell + 5)).toBe(`${FALLBACK_OPEN}a</pre>`);
    expect(fallbackHtml('a&b', shell + 6)).toBe(`${FALLBACK_OPEN}a&amp;</pre>`);
    expect(fallbackHtml("it's", shell + 7)).toBe(`${FALLBACK_OPEN}it</pre>`);
    expect(fallbackHtml("it's", shell + 8)).toBe(`${FALLBACK_OPEN}it&#x27;</pre>`);
    expect(fallbackHtml('\u00e9\ud83d\ude00x', shell + 5)).toBe(`${FALLBACK_OPEN}\u00e9</pre>`);
    expect(fallbackHtml('\u00e9\ud83d\ude00x', shell + 6)).toBe(`${FALLBACK_OPEN}\u00e9\ud83d\ude00</pre>`);
    expect(fallbackHtml('x', shell)).toBe(`${FALLBACK_OPEN}</pre>`);
    expect(fallbackHtml('x', shell - 1)).toBe('');
    expect(fallbackHtml('a<b', 1000)).toBe(`${FALLBACK_OPEN}a&lt;b</pre>`);
  });

  it("a failed render's fallback is cut to maxHtmlBytes too", () => {
    const src = `<a href="x">'&'</a>\n`.repeat(20);
    const r = renderWith(src, { maxHtmlBytes: 200 }, faultyEngine());
    expect(r.outcome).toBe('failed');
    expect(r.html.startsWith(FALLBACK_OPEN) && r.html.endsWith('</pre>')).toBe(true);
    const body = r.html.slice(FALLBACK_OPEN.length, -'</pre>'.length);
    expect('&lt;a href=&quot;x&quot;&gt;&#x27;&amp;&#x27;&lt;/a&gt;\n'.repeat(20).startsWith(body)).toBe(true);
    // cut before the entity that would not fit, so at most five bytes short (the longest entity is six)
    expect(utf8(r.html)).toBeLessThanOrEqual(200);
    expect(utf8(r.html)).toBeGreaterThanOrEqual(195);
  });
});

describe('render: the failure fallback', () => {
  it('fault-injected: a throwing engine gives outcome failed and the exact fallback HTML', () => {
    const r = renderWith('# T\n\nbody\n', undefined, faultyEngine());
    expect(r).toEqual({
      html: '<p class="page-subtitle">This document could not be rendered; its source follows.</p><pre># T\n\nbody\n</pre>',
      outcome: 'failed',
      bytes: 10,
      meta: EMPTY,
    });
    expect(r.meta).toBe(EMPTY_META);
    expect(FALLBACK_OPEN).toBe('<p class="page-subtitle">This document could not be rendered; its source follows.</p><pre>');
  });

  it('the fallback escapes <script> and every other special character as Python html.escape does', () => {
    const r = renderWith(`<script>alert('x' & "y")</script>`, undefined, faultyEngine());
    expect(r.html).toBe(
      `${FALLBACK_OPEN}&lt;script&gt;alert(&#x27;x&#x27; &amp; &quot;y&quot;)&lt;/script&gt;</pre>`,
    );
  });

  it('the byte gate comes before the engine', () => {
    expect(renderWith('xx', { maxBytes: 1 }, faultyEngine()).outcome).toBe('over-limit');
  });
});

describe('render: options and state', () => {
  it('a rendered result has outcome rendered and a fresh meta', () => {
    const r = render('a\n');
    expect(r).toEqual({ html: '<p data-line="1-1">a</p>\n', outcome: 'rendered', bytes: 2, meta: EMPTY });
    expect(r.meta).not.toBe(EMPTY_META);
  });

  it('lineAttrs: false leaves no data-line; the default is true', () => {
    const text = '> q\n\n- a\n\n---\n';
    expect(render(text, { lineAttrs: false }).html).not.toContain('data-line');
    expect(render(text).html).toBe(render(text, { lineAttrs: true }).html);
    expect(render(text).html).toContain('data-line="1-1"');
  });

  it('determinism: render(A), render(B), render(A) gives identical results', () => {
    const a = '# Same\n\n# Same\n\n> q\n\n| x |\n|---|\n| y |\n';
    const b = '# Same\n\n# Other\n\n[l](javascript:x)\n';
    const first = render(a);
    render(b);
    expect(render(a)).toEqual(first);
    expect(render(a, { lineAttrs: false })).toEqual(render(a, { lineAttrs: false }));
  });
});
