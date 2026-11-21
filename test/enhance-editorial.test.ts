// @vitest-environment jsdom
// The editorial core of `./enhance` (L2 prototype), ported from the reference reader's sections 0 to 6 and the
// status marks of section 8: the title block (eyebrow, byline, reading time), the facts panel, the "In short" and
// "Where things stand" boxes, the hanging section numbers and the status words in table cells. The fixtures are
// real render() output of neutral synthetic Markdown. Every feature is undone by destroyEnhancement: the round trip
// compares the subtree's serialization AND its nodes (the same node objects, with the same text, in the same
// order), because a text node split in two serializes exactly like the one it came from.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { destroyEnhancement, enhance, type EnhanceOptions } from '../src/enhance/index.js';
import { CHROME_ATTR, createJournal } from '../src/enhance/journal.js';
import { render } from '../src/render/index.js';
import { bylinesWith, RUN_SIZES } from './long-space.js';

const sepCalls = vi.hoisted(() => ({ n: 0 }));
vi.mock('../src/enhance/separator.js', async (original) => {
  const real = await original<typeof import('../src/enhance/separator.js')>();
  return { ...real, findSeparator: (text: string) => ((sepCalls.n += 1), real.findSeparator(text)) };
});

const LONG = Array.from({ length: 700 }, (_, i) => `word${String(i)}`).join(' ');
const NOTE = 'A note that runs on well past seventy characters, so that the byline sets it across the whole width.';

const DOC = [
  '---',
  'kind: Design',
  'area: Docs',
  'owner: project-a',
  'rules: [R1, R2]',
  'tags:',
  '  - alpha',
  '  - beta',
  '---',
  '',
  '# Example spec',
  '',
  `**Spec** · 2026-10-19 · Status: Draft · **Owner:** project-a · ${NOTE}`,
  '',
  '## In short',
  '',
  '- **One.** The first point.',
  '- The second point.',
  '',
  '## 1. Scope',
  '',
  LONG,
  '',
  '| ID | What | Status |',
  '|---|---|---|',
  '| R1 | thing | Agreed, with notes |',
  '| R2 | other | **Pending** |',
  '| R3 | more | see below |',
  '',
  '| ID | Notes |',
  '|---|---|',
  '| R1 | Done here, and more words after |',
  '| R2 | Open |',
  '',
  '## 2. Design',
  '',
  'How it works.',
  '',
  '## A3. Appendix',
  '',
  'More.',
  '',
  '## Where things stand',
  '',
  '### Agreed',
  '',
  '- R1 is agreed.',
  '',
  '### Waiting on you',
  '',
  '- R2 needs an answer.',
  '- R3 needs a review.',
  '',
  '### Later',
  '',
  '- R4.',
  '',
  '### Notes',
  '',
  'A closing paragraph.',
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

/** The options a host passes: render()'s meta as info. */
function infoOf(md: string): EnhanceOptions {
  const r = render(md);
  return { info: { title: r.meta.title, frontList: r.meta.frontList } };
}

afterEach(async () => {
  for (const root of mounted.splice(0)) await destroyEnhancement(root).catch(() => undefined);
  document.body.replaceChildren();
});

const child = (root: Element, name: string, cls?: string): Element => {
  const el = Array.from(root.children).find((c) => c.localName === name && (cls === undefined || c.classList.contains(cls)));
  if (el === undefined) throw new Error(`no ${name}${cls === undefined ? '' : `.${cls}`}`);
  return el;
};
const h2 = (root: Element, id: string): Element => {
  const el = Array.from(root.querySelectorAll('h2')).find((h) => h.id === id);
  if (el === undefined) throw new Error(`no h2 ${id}`);
  return el;
};
const text = (n: Node | null | undefined): string => (n?.textContent ?? '').replace(/\s+/g, ' ').trim();

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

describe('title block', () => {
  it('puts an eyebrow above the title: the meta line\'s kind, then the front matter\'s kind and area', async () => {
    const root = mount(DOC);
    await enhance(root, infoOf(DOC));
    const h1 = child(root, 'h1');
    const eyebrow = h1.previousElementSibling as Element;
    expect(eyebrow.className).toBe('eyebrow');
    expect(eyebrow.hasAttribute(CHROME_ATTR)).toBe(true);
    expect(Array.from(eyebrow.children).map((s) => s.textContent)).toEqual(['Spec', 'Design', 'Docs']);
  });

  it('turns the meta line into a byline of facts, moving its own nodes, and hides what is left of it', async () => {
    const root = mount(DOC);
    const h1 = child(root, 'h1');
    const metaP = h1.nextElementSibling as HTMLElement;
    const owner = Array.from(metaP.childNodes).find((n) => n.nodeType === 1 && n.textContent === 'Owner:');
    const ownerValue = owner?.nextSibling; // " project-a · A note …", split at the separator
    await enhance(root, infoOf(DOC));
    // right after the hidden meta line, so no hidden paragraph sits between the byline, the facts and the next block
    const byline = metaP.nextElementSibling as HTMLElement;
    expect([byline.localName, byline.className, byline.hasAttribute(CHROME_ATTR)]).toEqual(['dl', 'byline', true]);
    expect(h1.nextElementSibling).toBe(metaP);
    const facts = Array.from(byline.children).map((d) => [d.querySelector('dt')?.textContent ?? '', text(d.querySelector('dd')), d.className]);
    expect(facts).toEqual([
      ['Date', '2026-10-19', ''],
      ['Status', 'Draft', ''],
      ['Owner', 'project-a', ''],
      ['Reading time', '≈ 3 min', 'rt'],
      ['', NOTE, 'wide'],
    ]);
    expect(byline.getAttribute('data-line')).toBe(metaP.getAttribute('data-line'));
    expect(ownerValue?.parentNode?.parentNode?.querySelector('dt')?.textContent).toBe('Owner'); // the same node, moved
    expect(metaP.hidden).toBe(true);
    expect(metaP.parentNode).toBe(root); // hidden, not removed
  });

  it('a byline with only the reading time is solo; a short document without a meta line gets none', async () => {
    const md = `# Example spec\n\n## 1. Scope\n\n${LONG}\n\n## 2. Design\n\nText.\n\n## 3. Plan\n\nText.\n`;
    const root = mount(md);
    await enhance(root);
    const byline = child(root, 'h1').nextElementSibling as Element;
    expect([byline.className, byline.children.length, text(byline.querySelector('dd'))]).toEqual(['byline solo', 1, '≈ 3 min']);
    const shortMd = '# Example spec\n\n## 1. Scope\n\nText.\n';
    const shortRoot = mount(shortMd);
    await enhance(shortRoot);
    expect(shortRoot.querySelector('.byline')).toBeNull();
    expect(shortRoot.querySelector('.eyebrow')).toBeNull();
  });

  it('a paragraph that ends on a dangling label introduces a list, and is not a meta line', async () => {
    const md = '# Example spec\n\n**Spec** · the parts are:\n\n- one\n';
    const root = mount(md);
    await enhance(root);
    expect(root.querySelector('.byline')).toBeNull();
    expect((child(root, 'p') as HTMLElement).hidden).toBe(false);
  });

  it('a meta line that opens on a label has no kind: its first fact is that label', async () => {
    const md = '# Example spec\n\n**Status:** Draft · 2026-10-19\n';
    const root = mount(md);
    await enhance(root);
    expect(root.querySelector('.eyebrow')).toBeNull();
    const dts = Array.from(root.querySelectorAll('.byline dt')).map((d) => d.textContent);
    expect(dts).toEqual(['Status', 'Date']);
    // a bold label standing alone before the first separator is a fact with no value, not the kind
    const alone = '# Example spec\n\n**Note:** · 2026-10-19 · Status: Draft\n';
    const other = mount(alone);
    await enhance(other);
    expect(other.querySelector('.eyebrow')).toBeNull();
    expect(Array.from(other.querySelectorAll('.byline dt')).map((d) => d.textContent)).toEqual(['Note', 'Date', 'Status']);
  });
});

describe('facts panel', () => {
  it('lists the front matter\'s list keys in a closed details after the byline, and hides render()\'s strip', async () => {
    const root = mount(DOC);
    const strip = child(root, 'dl', 'doc-meta') as HTMLElement;
    await enhance(root, infoOf(DOC));
    // The review strip (Task 20) sits between the byline and the facts panel, as in the reference.
    let facts = child(root, 'dl', 'byline').nextElementSibling as HTMLDetailsElement;
    while (facts.classList.contains('review-strip')) facts = facts.nextElementSibling as HTMLDetailsElement;
    expect(facts.nextElementSibling?.className).toBe('short');
    expect([facts.localName, facts.className, facts.open, facts.hasAttribute(CHROME_ATTR)]).toEqual(['details', 'doc-facts', false, true]);
    expect(text(facts.querySelector('summary'))).toBe('2 rules · 2 tags');
    expect(Array.from(facts.querySelectorAll('.facts-body dt')).map((d) => d.textContent)).toEqual(['rules', 'tags']);
    expect(Array.from(facts.querySelectorAll('.facts-body dd')).map((d) => text(d))).toEqual(['R1, R2', 'alpha, beta']);
    expect(Array.from(facts.querySelectorAll('.facts-body code')).map((d) => d.textContent)).toEqual(['R1', 'R2', 'alpha', 'beta']);
    expect(strip.hidden).toBe(true);
  });

  it('without info, render()\'s strip stays as it is, and there is no facts panel or front-matter kind', async () => {
    const root = mount(DOC);
    await enhance(root);
    expect((child(root, 'dl', 'doc-meta') as HTMLElement).hidden).toBe(false);
    expect(root.querySelector('.doc-facts')).toBeNull();
    expect(Array.from(root.querySelectorAll('.eyebrow span')).map((s) => s.textContent)).toEqual(['Spec']);
  });
});

describe('boxes', () => {
  it('"In short" and its blocks move into a div.short, which gets no fold', async () => {
    const root = mount(DOC);
    const heading = h2(root, 'in-short');
    const list = heading.nextElementSibling;
    await enhance(root, infoOf(DOC));
    const box = heading.parentElement as Element;
    expect([box.localName, box.className, box.parentElement, box.hasAttribute(CHROME_ATTR)]).toEqual(['div', 'short', root, true]);
    expect(Array.from(box.children)).toEqual([heading, list]);
    expect(box.nextElementSibling).toBe(h2(root, '1-scope'));
    expect(heading.querySelector('.h-fold')).toBeNull();
  });

  it('"Where things stand": each h3 and its blocks in a callout, and an index of counts before the first', async () => {
    const root = mount(DOC);
    await enhance(root, infoOf(DOC));
    const callouts = Array.from(root.querySelectorAll('div.callout'));
    // the heading's own text, before the controls the layout puts after it (its section link, Task 14)
    expect(callouts.map((c) => [c.className, c.firstElementChild?.firstChild?.textContent])).toEqual([
      ['callout agreed', 'Agreed'],
      ['callout waiting', 'Waiting on you'],
      ['callout later', 'Later'],
      ['callout other', 'Notes'],
    ]);
    const nav = callouts[0]?.previousElementSibling as Element;
    expect([nav.localName, nav.className, nav.getAttribute('aria-label')]).toEqual(['nav', 'stand-index', 'Where things stand']);
    expect(Array.from(nav.children).map((a) => [a.getAttribute('href'), a.querySelector('.dot')?.className, a.querySelector('b')?.textContent, a.lastElementChild?.textContent])).toEqual([
      ['#agreed', 'dot agreed', '1', 'Agreed'],
      ['#waiting-on-you', 'dot waiting', '2', 'Waiting on you'],
      ['#later', 'dot later', '1', 'Later'],
    ]);
  });

  it('one callout with items gets no index', async () => {
    const md = '# Example spec\n\n## Where things stand\n\n### Agreed\n\n- one\n\n### Notes\n\nText.\n';
    const root = mount(md);
    await enhance(root);
    expect(root.querySelectorAll('div.callout').length).toBe(2);
    expect(root.querySelector('.stand-index')).toBeNull();
  });
});

describe('numbered sections', () => {
  it('the number moves into a span.sec-no and ". " into a hidden span; the heading\'s text and name stay whole', async () => {
    const root = mount(DOC);
    const scope = h2(root, '1-scope');
    const first = scope.firstChild as Text;
    await enhance(root, infoOf(DOC));
    const no = scope.firstElementChild as Element;
    expect([no.className, no.textContent, no.hasAttribute(CHROME_ATTR), no.firstChild]).toEqual(['sec-no', '1', true, first]);
    const sep = no.nextSibling as HTMLElement;
    expect([sep.localName, sep.hidden, sep.textContent, sep.hasAttribute(CHROME_ATTR)]).toEqual(['span', true, '. ', true]);
    expect(sep.nextSibling?.textContent).toBe('Scope');
    expect(scope.getAttribute('aria-label')).toBe('1. Scope');
    expect(h2(root, 'a3-appendix').querySelector('.sec-no')?.textContent).toBe('A3');
    expect(h2(root, 'in-short').querySelector('.sec-no')).toBeNull();
    expect(h2(root, 'where-things-stand').querySelector('.sec-no')).toBeNull();
  });
});

describe('status words in table cells', () => {
  it('a Status column\'s leading words become marks; the text is split and moved, never rewritten', async () => {
    const root = mount(DOC);
    const [r1, r2, r3] = Array.from(root.querySelectorAll('table')[0]?.querySelectorAll('tbody td:nth-child(3)') ?? []);
    const word = r1?.firstChild;
    await enhance(root, infoOf(DOC));
    const wrap = r1?.firstElementChild as Element;
    expect([wrap.className, wrap.hasAttribute(CHROME_ATTR), wrap.textContent]).toEqual(['pill-wrap', true, 'Agreed,']);
    const pill = wrap.firstElementChild as Element;
    expect([pill.className, pill.textContent, pill.firstChild]).toEqual(['pill ok', 'Agreed', word]);
    expect(wrap.nextSibling?.textContent).toBe(' with notes');
    expect(r1?.textContent).toBe('Agreed, with notes');
    const strong = r2?.firstElementChild as Element;
    expect([strong.localName, strong.firstElementChild?.className, strong.textContent]).toEqual(['strong', 'pill wait', 'Pending']);
    expect(r3?.querySelector('.pill')).toBeNull();
  });

  it('a column that does not read as a status column gets no marks', async () => {
    const root = mount(DOC);
    await enhance(root, infoOf(DOC));
    expect(root.querySelectorAll('table')[1]?.querySelector('.pill')).toBeNull();
  });

  it('a header names a status as a whole word: Statement and Restated do not, Current status and States do', async () => {
    const md = [
      '# T',
      '',
      '| ID | Statement | Restated | Current status | States |',
      '|---|---|---|---|---|',
      '| R1 | No user may log in twice | Open files are closed | Agreed | Done |',
      '| R2 | Open files are closed on exit | No change | Pending | Open |',
      '',
    ].join('\n');
    const root = mount(md);
    await enhance(root);
    const marked = (ci: number): number => Array.from(root.querySelectorAll('tbody tr')).filter((r) => (r.children[ci] as Element).querySelector('.pill') !== null).length;
    expect([1, 2, 3, 4].map(marked)).toEqual([0, 0, 2, 2]);
  });

  it('short cells mostly opening on a status word mark a column whatever its header; the first column never', async () => {
    const md = '# T\n\n| Status | Item | Answer? |\n|---|---|---|\n| Done | Open | Yes |\n| Open | Done | No |\n| Done | Agreed | maybe |\n';
    const root = mount(md);
    await enhance(root);
    const marks = (ci: number): (string | null)[] =>
      Array.from(root.querySelectorAll('tbody tr')).map((r) => (r.children[ci] as Element).querySelector('.pill')?.className ?? null);
    expect(marks(0)).toEqual([null, null, null]);
    expect(marks(1)).toEqual(['pill wait', 'pill ok', 'pill ok']);
    expect(marks(2)).toEqual(['pill ok', 'pill no', null]);
  });
});

describe('the round trip', () => {
  it('destroy restores the subtree exactly: the same nodes, with the same text, in the same order', async () => {
    const root = mount(DOC);
    const html = root.outerHTML;
    const before = nodes(root);
    await enhance(root, { ...infoOf(DOC), storageKey: 'project-a:specs:example.md' });
    expect(root.querySelectorAll(`[${CHROME_ATTR}]`).length).toBeGreaterThan(20);
    (h2(root, '2-design').querySelector('.h-fold') as HTMLButtonElement).click();
    expect(h2(root, '2-design').classList.contains('folded')).toBe(true);
    await destroyEnhancement(root);
    expect(root.outerHTML).toBe(html);
    const after = nodes(root);
    expect(after.length).toBe(before.length);
    expect(after.every((a, i) => a.node === before[i]?.node && a.data === before[i]?.data)).toBe(true);
  });

  it('nothing of the document leaves the root while enhanced: every node is moved, wrapped or hidden, never removed', async () => {
    const root = mount(DOC);
    const before = nodes(root);
    await enhance(root, infoOf(DOC));
    expect(before.filter((n) => !root.contains(n.node))).toEqual([]);
  });
});

describe('the journal\'s move and split', () => {
  const setup = (): { live: { on: boolean }; control: ReturnType<typeof createJournal>; p: HTMLElement } => {
    const live = { on: true };
    const control = createJournal(
      () => live.on,
      (fn) => {
        fn();
      },
    );
    const p = document.createElement('p');
    p.append('alpha beta', document.createElement('b'), 'gamma');
    document.body.append(p);
    return { live, control, p };
  };

  it('split partitions a text node and undo joins it; move undo puts a node back in its place', () => {
    const { control, p } = setup();
    const html = p.outerHTML;
    const t = p.firstChild as Text;
    const tail = control.journal.split(t, 6);
    expect([t.data, tail.data, t.nextSibling]).toEqual(['alpha ', 'beta', tail]);
    const box = document.createElement('div');
    control.journal.move(tail, box, null);
    control.journal.move(p.lastChild as Node, box, null);
    expect(p.childNodes.length).toBe(2);
    expect(control.undoAll()).toEqual([]);
    expect(p.outerHTML).toBe(html);
    expect([p.childNodes.length, p.firstChild]).toEqual([3, t]);
  });

  it('a moved node whose next sibling left goes back into its parent, after its old previous sibling, and says so', () => {
    const { control, p } = setup();
    const [a, b, g] = Array.from(p.childNodes) as unknown as [Node, Node, Node];
    control.journal.move(b, document.createElement('div'), null);
    p.removeChild(g); // the host removes the node that followed it
    const faults = control.undoAll();
    expect(faults.map(String)).toEqual([expect.stringMatching(/lost its place/)]);
    expect(Array.from(p.childNodes)).toEqual([a, b]);
  });

  it('a host that merges the meta line\'s text nodes while enhanced loses none of its text on destroy', async () => {
    const md = '# Example spec\n\n**Spec** · 2026-10-19 · Status: Draft\n\n## 1. Scope\n\nText.\n';
    const root = mount(md);
    await enhance(root);
    root.normalize(); // merges the separators left in the hidden meta line
    const err = await destroyEnhancement(root).then(
      () => null,
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(AggregateError);
    expect(root.querySelectorAll(`[${CHROME_ATTR}]`).length).toBe(0);
    const meta = text(child(root, 'p'));
    expect(['Spec', '2026-10-19', 'Status', 'Draft'].filter((w) => !meta.includes(w))).toEqual([]);
  });

  it('a split whose second half the host moved stays split: the host wins', () => {
    const { control, p } = setup();
    const t = p.firstChild as Text;
    const tail = control.journal.split(t, 6);
    p.append(tail); // the host moves it to the end
    expect(control.undoAll()).toEqual([]);
    expect([t.data, p.lastChild]).toEqual(['alpha ', tail]);
  });

  it('move does nothing and split throws once the instance is not live', () => {
    const { live, control, p } = setup();
    live.on = false;
    const t = p.firstChild as Text;
    control.journal.move(t, document.body, null);
    expect(t.parentNode).toBe(p);
    expect(() => control.journal.split(t, 3)).toThrow(/after a destroy/);
    expect(t.data).toBe('alpha beta');
  });
});

describe('a long run of white space in the byline (review 3081 F1)', () => {
  it('the screen finds the separator with the scan helper, called a bounded number of times, and a 1 MiB run costs about what the same run outside the byline costs', async () => {
    // The control holds the very same run in the body, where no separator is looked for, so what else enhance does with a
    // long text is in the baseline and only the byline's scan is measured.
    const control = (n: number): string => `# T\n\n**Spec** · a b\n\n## Body\n\nText a${' '.repeat(n)}b\n`;
    const run = async (md: string): Promise<number> => {
      const root = mount(md);
      const t = performance.now();
      await enhance(root, infoOf(md));
      return performance.now() - t;
    };
    for (const n of RUN_SIZES) {
      const base = await run(control(n));
      for (const md of bylinesWith(n)) {
        sepCalls.n = 0;
        const ms = await run(md);
        expect(sepCalls.n, `${String(n)} spaces: calls of the separator helper`).toBeGreaterThanOrEqual(1);
        expect(sepCalls.n, `${String(n)} spaces: calls of the separator helper`).toBeLessThanOrEqual(4);
        expect(ms, `${String(n)} spaces took ${ms.toFixed(0)} ms (the same run outside the byline ${base.toFixed(0)} ms)`).toBeLessThan(Math.max(600, 20 * base));
      }
    }
  }, 120000);
});

describe('many separators in the byline (review 3088 F3)', () => {
  // The screen cut each separator out of the live text with two `journal.split`s, each copying the text left, and undid each with
  // an `appendData`: quadratic in the separators (32 000 took seconds in a browser, 64 000 minutes). One `journal.splitAll` per
  // text child now cuts at every separator, and undoes with one write and one range deletion. The bound is a count of DOM
  // operations, never a clock: the calls of `splitText`, `appendData`, `removeChild` and `createRange` are the same for 4
  // separators as for 500 through the whole enhance, and the same again for 1 000 pieces of one text cut and joined by the
  // journal alone, below. jsdom itself is quadratic in a parent's children (one `move` per fact, a fragment insert, a range
  // deletion: 32 000 facts run out of memory, 8 000 pieces take ten seconds), so the unit cases stop at these sizes; the
  // browser layout test of a byline (test/browser/layout-corpus.test.ts) holds 32 000 in Chromium, where the DOM is linear.
  const byline = (k: number): string => `# T\n\n**Spec** · ${Array.from({ length: k }, (_, i) => `w${String(i)}`).join(' · ')}\n\n## Body\n\nText.\n`;
  const SPIED: readonly [string, object, string][] = [
    ['splitText', Text.prototype, 'splitText'],
    ['appendData', CharacterData.prototype, 'appendData'],
    ['removeChild', Node.prototype, 'removeChild'],
    ['createRange', Document.prototype, 'createRange'],
  ];

  async function run(k: number): Promise<{ enhanced: Record<string, number>; undone: Record<string, number>; facts: number; html: string; restored: boolean }> {
    const md = byline(k);
    const root = mount(md);
    const html = root.outerHTML;
    const before = nodes(root);
    const calls: Record<string, number> = {};
    const spies = SPIED.map(([name, proto, key]) => {
      calls[name] = 0;
      const original = (proto as Record<string, (...a: unknown[]) => unknown>)[key] as (...a: unknown[]) => unknown;
      return vi.spyOn(proto as Record<string, (...a: unknown[]) => unknown>, key).mockImplementation(function (this: unknown, ...a: unknown[]) {
        calls[name] = (calls[name] ?? 0) + 1;
        return original.apply(this, a);
      });
    });
    try {
      await enhance(root, infoOf(md));
      const enhanced = { ...calls };
      const facts = root.querySelectorAll('dl.byline > div').length;
      for (const name of Object.keys(calls)) calls[name] = 0;
      await destroyEnhancement(root);
      const after = nodes(root);
      const restored = root.outerHTML === html && after.length === before.length && after.every((a, i) => a.node === before[i]?.node && a.data === before[i]?.data);
      return { enhanced, undone: { ...calls }, facts, html, restored };
    } finally {
      for (const spy of spies) spy.mockRestore();
    }
  }

  it('500 separators cost the same count of splits, appends, removals and ranges as 4, and destroy restores every node', async () => {
    const small = await run(4);
    const big = await run(500);
    expect(big.facts, 'one fact per piece').toBeGreaterThanOrEqual(500);
    expect(small.restored && big.restored, 'destroy restores the same nodes with the same text').toBe(true);
    expect(big.enhanced['splitText']).toBe(small.enhanced['splitText']);
    expect(big.enhanced['splitText']).toBeLessThanOrEqual(4);
    expect(big.undone['appendData']).toBe(small.undone['appendData']);
    expect(big.undone['appendData']).toBeLessThanOrEqual(4);
    expect(big.undone['removeChild']).toBe(small.undone['removeChild']);
    expect(big.undone['createRange']).toBe(small.undone['createRange']);
    expect(big.undone['createRange']).toBeGreaterThanOrEqual(1);
    expect(big.undone['createRange']).toBeLessThanOrEqual(4);
  }, 120000);

  it('the byline of a text with separators is the one the per-separator splits made: a label, a date, adjacent and edge separators', async () => {
    const md = '# T\n\n**Spec** · 2026-10-19 · Status: Draft ·  · Owner: a · b · \n\n## Body\n\nText.\n';
    const root = mount(md);
    await enhance(root, infoOf(md));
    // Pinned from the per-separator splits this one-pass cut replaced (measured on the code before the change): the same byline,
    // and the same pieces left in the hidden meta line.
    const dt = (k: string, v: string): string => `<div data-docreader-chrome=""><dt data-docreader-chrome="" data-k="${k}">${k}</dt><dd data-docreader-chrome="">${v}</dd></div>`;
    expect(root.querySelector('dl.byline')?.outerHTML).toBe(
      `<dl data-docreader-chrome="" class="byline" data-line="3-3">${dt('Date', '2026-10-19')}${dt('Status', 'Draft')}<div data-docreader-chrome=""><dd data-docreader-chrome="">· Owner: a</dd></div><div data-docreader-chrome=""><dd data-docreader-chrome="">b ·</dd></div></dl>`,
    );
    expect(root.querySelector('p[hidden]')?.outerHTML).toBe('<p data-line="3-3" hidden=""><strong>Spec</strong> ·  · Status:  ·   · </p>');
  });
});

describe('the journal\'s splitAll', () => {
  const setup = (): { control: ReturnType<typeof createJournal>; p: HTMLElement; t: Text; live: { on: boolean } } => {
    const live = { on: true };
    const control = createJournal(
      () => live.on,
      (fn) => {
        fn();
      },
    );
    const p = document.createElement('p');
    p.append('ab · cd · ef', document.createElement('b'), 'gh');
    document.body.append(p);
    return { control, p, t: p.firstChild as Text, live };
  };

  it('cuts a text at every offset in one call, returns the pieces with the node first, and undo joins them exactly', () => {
    const { control, p, t } = setup();
    const html = p.outerHTML;
    const before = Array.from(p.childNodes);
    const pieces = control.journal.splitAll(t, [2, 5, 7, 10]);
    expect(pieces.map((n) => n.data)).toEqual(['ab', ' · ', 'cd', ' · ', 'ef']);
    expect(pieces[0]).toBe(t);
    expect(Array.from(p.childNodes).slice(0, 5)).toEqual(pieces);
    expect(p.childNodes.length).toBe(7);
    expect(control.undoAll()).toEqual([]);
    expect(p.outerHTML).toBe(html);
    expect(Array.from(p.childNodes)).toEqual(before);
    expect(t.data).toBe('ab · cd · ef');
  });

  it('1 000 separators in one text: no splitText, no appendData, no removeChild and one range, to cut and to join, and every node comes back', () => {
    const { control, p, t } = setup();
    const k = 1000;
    const data = Array.from({ length: k }, (_, i) => `w${String(i)}`).join(' · ');
    t.data = data;
    const html = p.outerHTML;
    const before = Array.from(p.childNodes);
    const offsets: number[] = [];
    for (let at = 0, i = 0; i < k; i += 1) {
      const word = `w${String(i)}`;
      if (i > 0) {
        offsets.push(at, at + 3);
        at += 3;
      }
      at += word.length;
    }
    const counts = { splitText: 0, appendData: 0, removeChild: 0, createRange: 0 };
    const spies = (
      [
        ['splitText', Text.prototype],
        ['appendData', CharacterData.prototype],
        ['removeChild', Node.prototype],
        ['createRange', Document.prototype],
      ] as const
    ).map(([name, proto]) => {
      const original = (proto as unknown as Record<string, (...a: unknown[]) => unknown>)[name] as (...a: unknown[]) => unknown;
      return vi.spyOn(proto as unknown as Record<string, (...a: unknown[]) => unknown>, name).mockImplementation(function (this: unknown, ...a: unknown[]) {
        counts[name] += 1;
        return original.apply(this, a);
      });
    });
    try {
      const pieces = control.journal.splitAll(t, offsets);
      expect(pieces.length).toBe(2 * k - 1);
      expect(pieces.map((n) => n.data).join('')).toBe(data);
      expect(counts).toEqual({ splitText: 0, appendData: 0, removeChild: 0, createRange: 0 });
      expect(control.undoAll()).toEqual([]);
      expect(counts).toEqual({ splitText: 0, appendData: 0, removeChild: 0, createRange: 1 });
    } finally {
      for (const spy of spies) spy.mockRestore();
    }
    expect(Array.from(p.childNodes)).toEqual(before);
    expect(t.data).toBe(data);
    expect(p.outerHTML).toBe(html);
  }, 120000);

  it('no offsets is no change; bad offsets, a detached text and a dead instance throw', () => {
    const { control, p, t, live } = setup();
    expect(control.journal.splitAll(t, [])).toEqual([t]);
    expect(p.childNodes.length).toBe(3);
    for (const bad of [[0], [12], [5, 5], [5, 3], [1.5], [-1], [Number.NaN]]) expect(() => control.journal.splitAll(t, bad), String(bad)).toThrow(/increasing offsets/);
    expect(() => control.journal.splitAll(document.createTextNode('abc'), [1])).toThrow(/attached text/);
    expect(t.data).toBe('ab · cd · ef');
    live.on = false;
    expect(() => control.journal.splitAll(t, [2])).toThrow(/after a destroy/);
  });

  it('a piece the host moved since: the pieces stay as they are, the host wins', () => {
    const { control, p, t } = setup();
    const pieces = control.journal.splitAll(t, [2, 5, 7, 10]);
    p.append(pieces[2] as Text);
    expect(control.undoAll()).toEqual([]);
    expect([t.data, p.lastChild]).toEqual(['ab', pieces[2]]);
  });
});
