// @vitest-environment jsdom
// Figures of `./enhance` (docserver L2, Task 15), ported from the reference layout's section 10: book captions, the
// figure entries (ctx.figures) and the index entries of kind 'figure' that a link `#figure-<n>` reaches (LD6). The
// fixtures are render() output of neutral Markdown; a few build a figure by hand for what render() never makes (white
// space before "Figure", a caption that opens with an element). Every caption is put back by destroyEnhancement: the
// round trip compares the nodes (the same node objects, with the same text, in the same order), because a text node
// split in two serializes exactly like the one it came from.
import { afterEach, describe, expect, it } from 'vitest';
import { destroyEnhancement, enhance } from '../src/enhance/index.js';
import { CHROME_ATTR } from '../src/enhance/journal.js';
import { contextOf } from '../src/enhance/lifecycle.js';
import type { FeatureContext } from '../src/enhance/types.js';
import { render } from '../src/render/index.js';

/** A Mermaid fence, then its caption line (none when empty). */
const fig = (caption: string, source = 'graph TD; A-->B'): string => ['```mermaid', source, '```', '', caption, ''].join('\n');

const DOC = [
  '# Figures',
  '',
  'Intro.',
  '',
  fig('*Figure 4. The flow of a request.*'),
  fig(''),
  fig('*Figure ٣. A number in another script.*'),
  fig('*Figure 6. A **bold** step and `code`.*'),
  '',
].join('\n');

const mounted: HTMLElement[] = [];

function mount(md: string): HTMLElement {
  const parsed = new DOMParser().parseFromString(`<!doctype html><body>${render(md).html}`, 'text/html');
  const root = document.createElement('main');
  root.append(...Array.from(parsed.body.childNodes));
  document.body.append(root);
  mounted.push(root);
  return root;
}

/** A root holding one hand-made figure whose caption has the given nodes. */
function mountFigure(caption: readonly Node[]): HTMLElement {
  const root = document.createElement('main');
  const figure = document.createElement('figure');
  figure.className = 'mermaid-figure';
  const pre = document.createElement('pre');
  pre.className = 'mermaid';
  pre.textContent = 'graph TD; A-->B';
  const cap = document.createElement('figcaption');
  cap.append(...caption);
  figure.append(pre, cap);
  root.append(figure);
  document.body.append(root);
  mounted.push(root);
  return root;
}

afterEach(async () => {
  for (const root of mounted.splice(0)) await destroyEnhancement(root).catch(() => undefined);
  document.body.replaceChildren();
});

function ctxOf(root: HTMLElement): FeatureContext {
  const ctx = contextOf(root);
  if (ctx === undefined) throw new Error('no context: the root is not enhanced');
  return ctx;
}

const figures = (root: Element): HTMLElement[] => Array.from(root.querySelectorAll('figure.mermaid-figure'));
const captionOf = (figure: Element): HTMLElement => {
  const cap = figure.querySelector('figcaption');
  if (cap === null) throw new Error('no caption');
  return cap;
};

/** A caption's children: a chrome span as `<class>[text]`, a text node as its text in quotes. */
function parts(cap: Element): string[] {
  return Array.from(cap.childNodes).map((n) => {
    if (n.nodeType === 3) return JSON.stringify((n as Text).data);
    const el = n as Element;
    return `${el.hasAttribute(CHROME_ATTR) ? 'chrome ' : ''}${el.localName}.${el.className}[${el.textContent ?? ''}]`;
  });
}

/** Every node under `root`, in document order, with its text when it is a text node. */
function nodes(root: Node): { node: Node; data: string | null }[] {
  const out: { node: Node; data: string | null }[] = [];
  const walk = (n: Node): void => {
    out.push({ node: n, data: n.nodeType === 3 ? (n as Text).data : null });
    for (const c of Array.from(n.childNodes)) walk(c);
  };
  walk(root);
  return out;
}

describe('captions', () => {
  it('splits "Figure N." into a chrome span.fig-no and the rest into a chrome span.cap-text, the space left between', async () => {
    const root = mount(DOC);
    const cap = captionOf(figures(root)[0] as Element);
    const first = cap.firstChild;
    await enhance(root);
    expect(parts(cap)).toEqual(['chrome span.fig-no[Figure 4.]', '" "', 'chrome span.cap-text[The flow of a request.]']);
    // The number is the caption's own text node, moved, never re-typed.
    expect(cap.querySelector('.fig-no')?.firstChild).toBe(first);
  });

  it('keeps the markup of a caption inside its text', async () => {
    const root = mount(DOC);
    await enhance(root);
    const cap = captionOf(figures(root)[3] as Element);
    expect(parts(cap)).toEqual(['chrome span.fig-no[Figure 6.]', '" "', 'chrome span.cap-text[A bold step and code.]']);
    expect(Array.from(cap.querySelector('.cap-text')?.childNodes ?? []).map((n) => n.nodeName)).toEqual(['#text', 'STRONG', '#text', 'CODE', '#text']);
  });

  it('puts a space between the number and the text when the caption has none', async () => {
    const md = fig('*Figure 1.Caption*');
    const root = mount(md);
    await enhance(root);
    expect(parts(captionOf(figures(root)[0] as Element))).toEqual(['chrome span.fig-no[Figure 1.]', '" "', 'chrome span.cap-text[Caption]']);
  });

  it('gives a caption that is its number alone an empty text span', async () => {
    const root = mount(fig('*Figure 5.*'));
    await enhance(root);
    expect(parts(captionOf(figures(root)[0] as Element))).toEqual(['chrome span.fig-no[Figure 5.]', '" "', 'chrome span.cap-text[]']);
  });

  it('keeps white space before "Figure" where it was', async () => {
    const root = mountFigure([document.createTextNode('  Figure 7.\n Spaced out.')]);
    await enhance(root);
    expect(parts(captionOf(figures(root)[0] as Element))).toEqual(['"  "', 'chrome span.fig-no[Figure 7.]', '"\\n "', 'chrome span.cap-text[Spaced out.]']);
  });

  it('reads a lettered number, as the reference\'s pattern does', async () => {
    const root = mountFigure([document.createTextNode('Figure 3a. Lettered.')]);
    await enhance(root);
    expect(parts(captionOf(figures(root)[0] as Element))).toEqual(['chrome span.fig-no[Figure 3a.]', '" "', 'chrome span.cap-text[Lettered.]']);
    expect(ctxOf(root).figures.all()[0]?.no).toBe('3a');
  });

  it('wraps markup that follows the number\'s white space straight away', async () => {
    const root = mount(fig('*Figure 6. **Bold** first.*'));
    await enhance(root);
    expect(parts(captionOf(figures(root)[0] as Element))).toEqual(['chrome span.fig-no[Figure 6.]', '" "', 'chrome span.cap-text[Bold first.]']);
    expect(Array.from(captionOf(figures(root)[0] as Element).querySelector('.cap-text')?.childNodes ?? []).map((n) => n.nodeName)).toEqual(['STRONG', '#text']);
  });

  it('reads only a text node: a comment that reads like a caption is left alone', async () => {
    const root = mountFigure([document.createComment('Figure 9. In a comment.'), document.createTextNode('A caption.')]);
    const cap = captionOf(figures(root)[0] as Element);
    const before = nodes(cap);
    await enhance(root);
    expect(nodes(cap)).toEqual(before);
    expect(ctxOf(root).figures.all()[0]).toMatchObject({ no: '1', caption: 'A caption.' });
  });

  it('reads a line break inside the number\'s white space', async () => {
    const root = mount(fig('*Figure\n2. Broken line.*'));
    await enhance(root);
    expect(parts(captionOf(figures(root)[0] as Element))).toEqual(['chrome span.fig-no[Figure\n2.]', '" "', 'chrome span.cap-text[Broken line.]']);
  });

  it('leaves a caption alone when it does not open with "Figure", digits and a dot', async () => {
    const root = mount(DOC);
    const other = mountFigure([document.createElement('em'), document.createTextNode(' after')]);
    (other.querySelector('em') as HTMLElement).textContent = 'Figure 8.';
    const scriptCap = captionOf(figures(root)[2] as Element);
    const emCap = captionOf(figures(other)[0] as Element);
    const before = [nodes(scriptCap), nodes(emCap)];
    await enhance(root);
    await enhance(other);
    // A number in another script: render() makes it a caption (PD7), and the reference's pattern reads ASCII digits.
    expect(parts(scriptCap)).toEqual(['"Figure ٣. A number in another script."']);
    expect(parts(emCap)).toEqual(['em.[Figure 8.]', '" after"']);
    expect([nodes(scriptCap), nodes(emCap)]).toEqual(before);
  });

  it('leaves a caption alone when its number has no dot after it', async () => {
    const root = mountFigure([document.createTextNode('Figure 7 has no dot.')]);
    await enhance(root);
    expect(parts(captionOf(figures(root)[0] as Element))).toEqual(['"Figure 7 has no dot."']);
    expect(ctxOf(root).figures.all()[0]).toMatchObject({ no: '1', caption: 'Figure 7 has no dot.' });
  });

  it('leaves a caption alone when its number is longer than 32 characters', async () => {
    const long = '9'.repeat(33);
    const root = mount(fig(`*Figure ${long}. Too long a number.*`));
    await enhance(root);
    expect(parts(captionOf(figures(root)[0] as Element))).toEqual([`"Figure ${long}. Too long a number."`]);
    expect(ctxOf(root).figures.all()[0]?.no).toBe('1');
  });

  it('takes a number of 32 characters', async () => {
    const long = '9'.repeat(32);
    const root = mount(fig(`*Figure ${long}. A long number.*`));
    await enhance(root);
    expect(ctxOf(root).figures.all()[0]?.no).toBe(long);
    expect(ctxOf(root).nav.byId(`figure-${long}`)).toBe(figures(root)[0]);
  });

  it('destroy puts every caption back: the same nodes, with the same text, in the same order', async () => {
    const md = [DOC, fig('*Figure 1.Caption*'), fig('*Figure 5.*'), fig('*Figure\n2. Broken line.*')].join('\n');
    const root = mount(md);
    const html = root.innerHTML;
    const before = nodes(root);
    await enhance(root);
    expect(root.querySelectorAll('.fig-no')).toHaveLength(5);
    await destroyEnhancement(root);
    expect(nodes(root)).toEqual(before);
    expect(root.innerHTML).toBe(html);
  });

  it('destroy puts back a caption with white space before "Figure"', async () => {
    const root = mountFigure([document.createTextNode('  Figure 7.\n Spaced out.'), document.createElement('br')]);
    const before = nodes(root);
    await enhance(root);
    await destroyEnhancement(root);
    expect(nodes(root)).toEqual(before);
  });
});

describe('figure entries', () => {
  it('one per figure, in document order: the caption\'s number, else the figure\'s position; the caption\'s text after the number', async () => {
    const root = mount(DOC);
    await enhance(root);
    const all = ctxOf(root).figures.all();
    expect(all.map((f) => [f.no, f.caption])).toEqual([
      ['4', 'The flow of a request.'],
      ['2', ''],
      ['3', 'Figure ٣. A number in another script.'],
      ['6', 'A bold step and code.'],
    ]);
    expect(all.map((f) => f.figure)).toEqual(figures(root));
  });

  it('an index entry of kind figure, `figure-<no>`, titled by its caption, so byId reaches the figure', async () => {
    const root = mount(DOC);
    await enhance(root);
    const ctx = ctxOf(root);
    const [first, second] = figures(root);
    expect(ctx.index.get('figure-4')).toEqual({
      id: 'figure-4',
      kind: 'figure',
      title: 'The flow of a request.',
      status: null,
      group: '',
      target: first,
      row: null,
      heads: [],
    });
    expect(ctx.index.get('figure-2')?.target).toBe(second);
    expect(ctx.index.all().filter((e) => e.kind === 'figure').map((e) => e.id)).toEqual(['figure-4', 'figure-2', 'figure-3', 'figure-6']);
    expect(ctx.nav.byId('figure-4')).toBe(first);
    expect(ctx.nav.idOf(first as Element)).toBe('figure-4');
  });

  it('clips a long caption for the index title, and keeps it whole in the figure entry', async () => {
    const words = Array.from({ length: 40 }, (_, i) => `word${String(i)}`).join(' ');
    const root = mount(fig(`*Figure 1. ${words}.*`));
    await enhance(root);
    const ctx = ctxOf(root);
    expect(ctx.figures.all()[0]?.caption).toBe(`${words}.`);
    const title = ctx.index.get('figure-1')?.title ?? '';
    expect(title.length).toBeLessThanOrEqual(90);
    expect(title).toBe(ctx.text.clip(`${words}.`, 90));
  });

  it('the first figure of a number keeps its id; a later one of the same number still has its figure entry', async () => {
    const root = mount([fig('*Figure 1. First.*'), fig('*Figure 1. Again.*')].join('\n'));
    await enhance(root);
    const ctx = ctxOf(root);
    const [a, b] = figures(root);
    expect(ctx.figures.all().map((f) => [f.no, f.caption])).toEqual([['1', 'First.'], ['1', 'Again.']]);
    expect(ctx.index.get('figure-1')?.target).toBe(a);
    expect(ctx.nav.byId('figure-1')).toBe(a);
    expect(ctx.nav.idOf(b as Element)).toBe(null);
  });

  it('a document id wins: a heading "Figure 2" keeps `#figure-2`, and the figure gets no index entry', async () => {
    const root = mount(['# Doc', '', '## Figure 2', '', fig('*Figure 2. A diagram.*')].join('\n'));
    await enhance(root);
    const ctx = ctxOf(root);
    const heading = Array.from(root.querySelectorAll('h2')).find((h) => h.id === 'figure-2');
    expect(heading).toBeDefined();
    expect(ctx.nav.byId('figure-2')).toBe(heading);
    expect(ctx.index.get('figure-2')).toBeUndefined();
    expect(ctx.figures.all()[0]?.no).toBe('2');
  });

  it('an index entry for a figure with no caption, and none of its own for a figure outside the root', async () => {
    const root = mount(fig(''));
    const outside = document.createElement('figure');
    outside.className = 'mermaid-figure';
    document.body.append(outside);
    await enhance(root);
    const ctx = ctxOf(root);
    expect(ctx.figures.all().map((f) => f.no)).toEqual(['1']);
    expect(ctx.index.get('figure-1')).toMatchObject({ kind: 'figure', title: '', target: figures(root)[0] });
  });

  it('a long caption builds in bounded time', async () => {
    const long = `${'Figure 1. '}${'x '.repeat(100_000)}`;
    const root = mountFigure([document.createTextNode(long)]);
    const t0 = performance.now();
    await enhance(root);
    expect(performance.now() - t0).toBeLessThan(5_000);
    expect(ctxOf(root).figures.all()[0]?.caption.length).toBe(199_999);
  });
});
