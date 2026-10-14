// How much code is highlighted at once (docserver L1, ruling C24; src/render/highlight.ts). A block of at most
// MAX_WHOLE_BLOCK_CHARS code units is highlighted whole, so a block comment or a multi-line string is coloured
// across its lines; longer text is highlighted one line at a time. Whole-block highlighting costs more than
// linear for some grammars: a shell or dockerfile fence whose lines each open `${` reopens every open scope on
// every later line (output quadratic in the line count; 8 KiB gave 47 MB, and 128 KiB exhausted the heap), an
// ini fence of `\"` runs ran a quoted key across lines in quadratic time (256 KiB took about 187 s), and a
// javascript fence of `<script>` lines took seconds. These cases pin the switch, the size and time of the
// worst fences on each side of it, and that the hostile fences at the whole highlighting budget are linear.
import { describe, expect, it } from 'vitest';
import { MAX_HIGHLIGHT_CHARS, MAX_HIGHLIGHT_LINE } from '../src/render/fence.js';
import { highlightCode, MAX_WHOLE_BLOCK_CHARS } from '../src/render/highlight.js';
import { render } from '../src/render/index.js';

const perLine = (text: string, language: string): string =>
  text
    .split('\n')
    .map((line) => highlightCode(line, language))
    .join('\n');

/** `head`, then a last line of `a`, so that the text is exactly `length` code units long. */
function padTo(head: string, length: number): string {
  return head + 'a'.repeat(length - head.length);
}

/** Repeats of `unit`, one per line, to just under `chars` code units, ending in a line feed. */
function lines(unit: string, chars: number): string {
  return `${Array.from({ length: Math.floor(chars / (unit.length + 1)) }, () => unit).join('\n')}\n`;
}

function timed<T>(f: () => T): { value: T; ms: number } {
  const t = performance.now();
  const value = f();
  return { value, ms: performance.now() - t };
}

describe('highlightCode: a block is whole up to the threshold, and one line at a time above it', () => {
  const multi: readonly (readonly [language: string, head: string, whole: string])[] = [
    ['javascript', 'let a = 1; /* one\ntwo */ let b = 2;\n', '<span class="hljs-comment">/* one\ntwo */</span>'],
    ['python', 'x = """one\ntwo"""\n', '<span class="hljs-string">&quot;&quot;&quot;one\ntwo&quot;&quot;&quot;</span>'],
  ];
  for (const [language, head, whole] of multi) {
    it(`${language}: a multi-line construct under the threshold is one span, so it differs from line by line`, () => {
      const text = padTo(head, 200);
      expect(highlightCode(text, language)).toContain(whole);
      expect(highlightCode(text, language)).not.toBe(perLine(text, language));
    });

    it(`${language}: exactly at the threshold is whole, one code unit over is line by line`, () => {
      const at = padTo(head, MAX_WHOLE_BLOCK_CHARS);
      const over = padTo(head, MAX_WHOLE_BLOCK_CHARS + 1);
      expect(at.length).toBe(MAX_WHOLE_BLOCK_CHARS);
      expect(highlightCode(at, language)).toContain(whole);
      expect(highlightCode(at, language)).not.toBe(perLine(at, language));
      expect(highlightCode(over, language)).not.toContain(whole);
      expect(highlightCode(over, language)).toBe(perLine(over, language));
    });
  }

  it('over the threshold, a hostile shape is the lines highlighted separately, joined by line feeds', () => {
    for (const [language, unit] of [
      ['shell', '$ ${'],
      ['dockerfile', 'RUN ${'],
      ['ini', 'a = \\"x\\"'],
    ] as const) {
      const text = lines(unit, 4 * MAX_WHOLE_BLOCK_CHARS);
      expect(highlightCode(text, language)).toBe(perLine(text, language));
    }
  });

  it('keeps every line feed: a trailing one and empty lines', () => {
    const empties = `${'\n'.repeat(MAX_WHOLE_BLOCK_CHARS + 5)}`;
    expect(highlightCode('a\n\nb\n', 'plaintext')).toBe('a\n\nb\n');
    expect(highlightCode('', 'plaintext')).toBe('');
    expect(highlightCode(empties, 'plaintext')).toBe(empties);
    expect(highlightCode(`${empties}x`, 'plaintext')).toBe(`${empties}x`);
  });
});

describe('the worst whole blocks, at the threshold, stay small and fast', () => {
  const shapes: readonly (readonly [language: string, unit: string])[] = [
    ['shell', '$ ${'],
    ['shell', '${${${'],
    ['dockerfile', 'RUN ${'],
    ['ini', '\\"'.repeat(127) + '\\'],
    ['ini', '\\"\\"'],
    ['javascript', '<script>'],
    ['typescript', '<script>'],
    ['xml', '<script>'],
  ];
  for (const [language, unit] of shapes) {
    it(`${language}: lines of ${JSON.stringify(unit.slice(0, 12))} at ${MAX_WHOLE_BLOCK_CHARS} code units`, () => {
      const text = padTo(lines(unit, MAX_WHOLE_BLOCK_CHARS - 1), MAX_WHOLE_BLOCK_CHARS);
      expect(text.length).toBe(MAX_WHOLE_BLOCK_CHARS);
      const { value, ms } = timed(() => highlightCode(text, language));
      expect(value.length).toBeLessThan(1_500_000);
      expect(ms).toBeLessThan(1000);
    });
  }
});

describe('the hostile fences at the whole highlighting budget are linear', () => {
  /** A fence of one line that gets a span, then `unit` lines, each MAX_HIGHLIGHT_LINE - 1 code units long. */
  function fence(language: string, first: string, unit: string): string {
    const line = (unit + 'x'.repeat(MAX_HIGHLIGHT_LINE)).slice(0, MAX_HIGHLIGHT_LINE - 1);
    const body = Array.from({ length: 1000 }, () => line);
    return `\`\`\`${language}\n${[first, ...body].join('\n')}\n\`\`\`\n`;
  }

  const growth: readonly (readonly [language: string, first: string, unit: string])[] = [
    ['shell', '$ echo hi', '$ ${'],
    ['dockerfile', 'FROM scratch', 'RUN ${'],
  ];
  for (const [language, first, unit] of growth) {
    it(`${language}: lines that each open \${ give html under 3 times the input`, () => {
      const src = fence(language, first, unit);
      expect(src.length).toBeLessThan(MAX_HIGHLIGHT_CHARS);
      const { value: r, ms } = timed(() => render(src));
      expect(r.outcome).toBe('rendered');
      expect(r.html).toContain('<span class="hljs-');
      expect(r.html.length).toBeLessThanOrEqual(3 * src.length);
      expect(ms).toBeLessThan(1000);
    }, 20_000);
  }

  it('shell: short lines of ${${${ give html under 40 times the input, as a block of this size would not', () => {
    const src = `\`\`\`shell\n$ echo hi\n${lines('${${${', 8192)}\`\`\`\n`;
    const { value: r, ms } = timed(() => render(src));
    expect(r.outcome).toBe('rendered');
    expect(r.html).toContain('<span class="hljs-');
    expect(r.html.length).toBeLessThanOrEqual(40 * src.length);
    expect(ms).toBeLessThan(1000);
  }, 20_000);

  const slow: readonly (readonly [language: string, first: string, unit: string, backstop: number])[] = [
    ['ini', 'a = 1', '\\"'.repeat(127) + '\\', 3600],
    ['javascript', 'let a = 1;', '<script>'.repeat(31), 2900],
  ];
  for (const [language, first, unit, backstop] of slow) {
    it(`${language}: a fence at the whole budget renders within ${backstop} ms`, () => {
      const src = fence(language, first, unit);
      expect(src.length).toBeLessThan(MAX_HIGHLIGHT_CHARS);
      const { value: r, ms } = timed(() => render(src));
      expect(r.outcome).toBe('rendered');
      expect(r.html).toContain('<span class="hljs-');
      expect(ms).toBeLessThan(backstop);
    }, 60_000);
  }
});
