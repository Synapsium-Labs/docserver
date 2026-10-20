// @vitest-environment jsdom
// IDs (docserver L2, Task 9): rule paragraphs and the rules index (rules.ts, the reference layout's sections 3 and 4,
// a plugin built only with `rules: true`), lettered sections and ID rows (ids.ts, sections 6 and 8, on by default).
// The fixtures are real render() output of neutral synthetic Markdown; a test that needs a shape render() never
// makes (a paragraph that opens on white space, a document element classed `pill`) edits the mounted DOM before
// enhance(). Every write is undone by destroyEnhancement: the round trip compares the serialization and the nodes
// (the same node objects, with the same text, in the same order).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { destroyEnhancement, enhance, type EnhanceOptions } from '../src/enhance/index.js';
import { CHROME_ATTR } from '../src/enhance/journal.js';
import { contextOf } from '../src/enhance/lifecycle.js';
import type { IndexEntry, TableBlock } from '../src/enhance/registry.js';
import type { FeatureContext } from '../src/enhance/types.js';
import { render } from '../src/render/index.js';
import { largePlan } from './fixtures/large-plan.js';

const mounted: HTMLElement[] = [];

function mount(md: string): HTMLElement {
  const parsed = new DOMParser().parseFromString(`<!doctype html><body>${render(md).html}`, 'text/html');
  const root = document.createElement('main');
  root.append(...Array.from(parsed.body.childNodes).map((n) => document.importNode(n, true)));
  document.body.append(root);
  mounted.push(root);
  return root;
}

/** render()'s meta as the host's info, and the given options. */
function optionsOf(md: string, extra: EnhanceOptions = {}): EnhanceOptions {
  const r = render(md);
  return { info: { title: r.meta.title, frontList: r.meta.frontList }, folds: false, ...extra };
}

/** Mount `md` and enhance it with its info and `extra`; `edit` changes the mounted DOM first. */
async function enhanced(md: string, extra: EnhanceOptions = {}, edit?: (root: HTMLElement) => void): Promise<HTMLElement> {
  const root = mount(md);
  edit?.(root);
  await enhance(root, optionsOf(md, extra));
  return root;
}

function ctxOf(root: HTMLElement): FeatureContext {
  const ctx = contextOf(root);
  if (ctx === undefined) throw new Error('no context: the root is not enhanced');
  return ctx;
}

afterEach(async () => {
  for (const root of mounted.splice(0)) await destroyEnhancement(root).catch(() => undefined);
  document.body.replaceChildren();
  delete (window as unknown as { matchMedia?: unknown }).matchMedia;
  vi.restoreAllMocks();
});

const squash = (s: string | null | undefined): string => (s ?? '').replace(/\s+/g, ' ').trim();

/** The paragraphs of `root`, by their first text (a walk, never an id lookup). */
function para(root: Element, startsWith: string): HTMLElement {
  const p = Array.from(root.querySelectorAll('p')).find((x) => squash(x.textContent).startsWith(startsWith));
  if (p === undefined) throw new Error(`no paragraph starting ${startsWith}`);
  return p;
}

/** One node, described: an element as `tag.class[hidden]{chrome}` with its children, a text as its JSON string. */
function shape(n: Node): unknown {
  if (n.nodeType === 3) return JSON.stringify((n as Text).data);
  const el = n as Element;
  let head = el.localName;
  if (el.getAttribute('class') !== null && el.classList.length > 0) head += `.${Array.from(el.classList).join('.')}`;
  if (el.hasAttribute('hidden')) head += '[hidden]';
  if (el.hasAttribute(CHROME_ATTR)) head += '{chrome}';
  return el.childNodes.length === 0 ? head : { [head]: Array.from(el.childNodes).map(shape) };
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

/** An index entry, as plain data: its element named by its tag and text. */
function plain(e: IndexEntry | undefined): unknown {
  if (e === undefined) return undefined;
  return { ...e, target: `${e.target.localName}: ${squash(e.target.textContent).slice(0, 24)}`, row: e.row === null ? null : e.row.localName, heads: [...e.heads] };
}

/** Make the root's media queries answer `wide` for (min-width: 700px), and false for every other query. */
function viewportWide(wide: boolean): void {
  (window as unknown as { matchMedia: unknown }).matchMedia = (q: string) => ({ matches: wide && q === '(min-width: 700px)' });
}

/** Click `el`; whether the root's handler prevented the default (the browser's own default is then stopped). */
function click(el: Element): boolean {
  let prevented = false;
  const after = (e: Event): void => {
    prevented = e.defaultPrevented;
    e.preventDefault(); // jsdom would try to navigate
  };
  document.addEventListener('click', after);
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
  document.removeEventListener('click', after);
  return prevented;
}

const RULES = [
  '---',
  'rules: [AB-ONE, AB-TWO, AB-THREE, CD-4, EF-5]',
  'tags: [alpha, beta]',
  '---',
  '',
  '# Example rules',
  '',
  '## 1. Rules',
  '',
  '`AB-ONE` — **The first rule.** It says what it says.',
  '',
  '`AB-TWO` and `AB-THREE` — _agreed_ (after review). The second and third rules share a paragraph. They go on.',
  '',
  '`CD-4` — _deferred_: the fourth rule has no bold title. It goes on.',
  '',
  '`AB-ONE`, `GH-6` — A later paragraph repeats an ID.',
  '',
].join('\n');

describe('rule paragraphs (rules.ts; the reference layout, section 3)', () => {
  it('off by default: without rules: true no paragraph is a rule, the panel keeps its keys and no rule is defined', async () => {
    const root = await enhanced(RULES);
    expect(root.querySelector('p.rule, .rule-head')).toBeNull();
    expect(ctxOf(root).index.all().filter((e) => e.kind === 'rule')).toEqual([]);
    const facts = root.querySelector('details.doc-facts') as HTMLDetailsElement;
    expect(squash(facts.querySelector('summary')?.textContent)).toBe('5 rules · 2 tags');
    expect(Array.from(facts.querySelectorAll('.facts-body > *')).map((e) => e.localName)).toEqual(['dl']);
    expect(facts.hasAttribute('open')).toBe(false);
  });

  it('one ID: the code moves into the head, the dash is split off into hidden chrome, and the rule is defined', async () => {
    const root = await enhanced(RULES, { rules: true });
    const p = para(root, 'AB-ONE');
    expect(p.className).toBe('rule');
    expect(p.hasAttribute(CHROME_ATTR)).toBe(false);
    expect(Array.from(p.childNodes).map(shape)).toEqual([
      { 'span.rule-head{chrome}': [{ code: ['"AB-ONE"'] }, { 'span[hidden]{chrome}': ['" — "'] }] },
      { strong: ['"The first rule."'] },
      '" It says what it says."',
    ]);
    expect(plain(ctxOf(root).index.get('AB-ONE'))).toEqual({
      id: 'AB-ONE',
      kind: 'rule',
      title: 'The first rule',
      status: null,
      group: 'Rules',
      target: 'p: AB-ONE — The first rule.',
      row: null,
      heads: [],
    });
  });

  it('two IDs joined by "and", or by a comma: each is defined on the paragraph, the joins hidden; a status moves its words into the pill', async () => {
    const root = await enhanced(RULES, { rules: true });
    const p = para(root, 'AB-TWO');
    expect(Array.from(p.childNodes).map(shape)).toEqual([
      {
        'span.rule-head{chrome}': [
          { code: ['"AB-TWO"'] },
          { 'span[hidden]{chrome}': ['" and "'] },
          { code: ['"AB-THREE"'] },
          { 'span.pill.ok{chrome}': ['"agreed"'] },
          { 'span.pill.info{chrome}': ['"after review"'] },
          { 'span[hidden]{chrome}': ['" — "', 'em', '" ("'] },
          { 'span[hidden]{chrome}': ['"). "'] }, // apart from its opening bracket, so a host's normalize() cannot join them
        ],
      },
      '"The second and third rules share a paragraph. They go on."',
    ]);
    // The pill carries the status words; the entry carries the role.
    const pill = p.querySelector('.rule-head > .pill') as Element;
    expect(pill.textContent).toBe('agreed');
    const { index } = ctxOf(root);
    for (const id of ['AB-TWO', 'AB-THREE']) {
      expect(plain(index.get(id))).toMatchObject({ id, kind: 'rule', status: 'ok', group: 'Rules', title: 'The second and third rules share a paragraph' });
      expect(index.get(id)?.target).toBe(p);
    }
    const later = para(root, 'AB-ONE, GH-6');
    expect(Array.from(later.childNodes).map(shape)[0]).toEqual({
      'span.rule-head{chrome}': [{ code: ['"AB-ONE"'] }, { 'span[hidden]{chrome}': ['", "'] }, { code: ['"GH-6"'] }, { 'span[hidden]{chrome}': ['" — "'] }],
    });
    expect(index.get('AB-ONE')?.target).toBe(para(root, 'AB-ONE —')); // the first definition wins
    expect(index.get('GH-6')?.target).toBe(later);
    expect(index.get('GH-6')?.title).toBe('A later paragraph repeats an ID');
    expect(Array.from(root.querySelectorAll('[id]')).map((e) => e.id)).toEqual(['example-rules', '1-rules']); // no ids written
  });

  it('a join of ", and" also joins IDs; a word that is no join ends the list, and then the paragraph is no rule', async () => {
    const md = ['# T', '', '`AB-1`, and `AB-2` — Joined.', '', '`AB-3` or `AB-4` — Not joined.', ''].join('\n');
    const root = await enhanced(md, { rules: true });
    expect(para(root, 'AB-1').className).toBe('rule');
    expect(ctxOf(root).index.get('AB-2')?.kind).toBe('rule');
    expect(para(root, 'AB-3').className).toBe('');
    expect(ctxOf(root).index.get('AB-3')).toBeUndefined();
  });

  it('a status note of 40 characters or fewer becomes an info pill; one of 41 stays in the text', async () => {
    const forty = 'n'.repeat(40);
    const fortyOne = 'n'.repeat(41);
    const md = ['# T', '', `\`AB-1\` — _proposed_ (${forty}): Body one.`, '', `\`AB-2\` — _proposed_ (${fortyOne}). Body two.`, ''].join('\n');
    const root = await enhanced(md, { rules: true });
    const one = para(root, 'AB-1');
    expect(Array.from(one.querySelectorAll('.pill')).map((x) => [x.className, x.textContent])).toEqual([['pill wait', 'proposed'], ['pill info', forty]]);
    expect(squash(Array.from(one.childNodes).slice(1).map((n) => n.textContent).join(''))).toBe('Body one.');
    const two = para(root, 'AB-2');
    expect(Array.from(two.querySelectorAll('.pill')).map((x) => x.textContent)).toEqual(['proposed']);
    expect(squash(Array.from(two.childNodes).slice(1).map((n) => n.textContent).join(''))).toBe(`(${fortyOne}). Body two.`);
    expect(ctxOf(root).index.get('AB-2')?.title).toBe(`(${fortyOne})`);
  });

  it('a rule with no bold title takes its first sentence, without its full stop, clipped to 120', async () => {
    const long = Array.from({ length: 40 }, (_, i) => `word${String(i)}`).join(' ');
    const md = ['---', 'rules: [AB-2]', '---', '', '# T', '', '`AB-1` — _deferred_: the title is this. Then more!', '', `\`AB-2\` — ${long}. Then more.`, '', '`AB-3` — Ends here? Yes.', ''].join('\n');
    const root = await enhanced(md, { rules: true });
    const { index, text } = ctxOf(root);
    expect(index.get('AB-1')?.title).toBe('the title is this');
    const clipped120 = text.clip(long, 120);
    expect(clipped120.length).toBeLessThanOrEqual(120);
    expect(root.querySelector('.doc-facts .rtitle')?.textContent).toBe(clipped120); // the rules index shows the title
    expect(text.clip(clipped120, 110)).not.toBe(clipped120);
    expect(index.get('AB-2')?.title).toBe(text.clip(clipped120, 110)); // the entry clips it to 110
    expect(index.get('AB-3')?.title).toBe('Ends here?');
  });

  it('the bold title is the first bold child, without a trailing colon or full stop', async () => {
    const md = ['# T', '', '`AB-1` — _agreed_. **Title:** body **more.**', ''].join('\n');
    const root = await enhanced(md, { rules: true });
    expect(ctxOf(root).index.get('AB-1')?.title).toBe('Title');
  });

  it('the bold title is a child of the paragraph: a bold inside the status em, or inside a link, is not the title', async () => {
    const md = ['# T', '', '`AB-1` — _agreed **now**_. Body text. More.', '', '`AB-2` — See [**the link**](#x). More.', ''].join('\n');
    const root = await enhanced(md, { rules: true });
    const { index } = ctxOf(root);
    expect(squash(para(root, 'AB-1').querySelector('.pill')?.textContent)).toBe('agreed now');
    expect(index.get('AB-1')?.title).toBe('Body text');
    expect(index.get('AB-2')?.title).toBe('See the link');
  });

  it('rules: true alone recognises the default shape: two or more capitals, then dashed parts of capitals or digits', async () => {
    const cases = ['AB-1', 'ABC-DEF-9', 'A-1', 'ab-1', 'AB1', 'AB-', 'AB-x'];
    const md = ['# T', '', ...cases.map((id) => `\`${id}\` — Text of ${id.toLowerCase()}.\n`)].join('\n');
    const on = await enhanced(md, { rules: true });
    expect(cases.map((id) => ctxOf(on).index.get(id)?.kind ?? null)).toEqual(['rule', 'rule', null, null, null, null, null]);
    expect(on.querySelectorAll('p.rule')).toHaveLength(2);
    const off = await enhanced(md, { rules: false });
    expect(off.querySelectorAll('p.rule, .rule-head')).toHaveLength(0);
  });

  it('not a rule: a paragraph whose first node is white space (pinned), or a join, or text; no dash; a dash with no space after it', async () => {
    const md = [
      '# T',
      '',
      '`AB-1` — Leading space.',
      '',
      '`AB-2` — Leading join.',
      '',
      'Text `AB-3` — first.',
      '',
      '`AB-4` no dash.',
      '',
      '`AB-5` —**Bold** with no space.',
      '',
      '`AB-6` – En dash.',
      '',
      '`AB-7` - Hyphen.',
      '',
      '`AB-8` and `AB-9`',
      '',
      '`AB-10`*— in an em*',
      '',
      '`AB-11` and *AB-12* — an em is no code.',
      '',
      '`AB-13`*and*`AB-14` — an em is no join.',
      '',
    ].join('\n');
    const root = await enhanced(md, { rules: true }, (r) => {
      const one = para(r, 'AB-1');
      one.insertBefore(document.createTextNode(' '), one.firstChild);
      const two = para(r, 'AB-2');
      two.insertBefore(document.createTextNode(', '), two.firstChild);
    });
    const { index } = ctxOf(root);
    const ids = ['AB-1', 'AB-2', 'AB-3', 'AB-4', 'AB-5', 'AB-6', 'AB-7', 'AB-8', 'AB-9', 'AB-10', 'AB-11', 'AB-12', 'AB-13', 'AB-14'];
    expect(ids.map((id) => index.get(id)?.kind ?? null)).toEqual([null, null, null, null, null, 'rule', 'rule', null, null, null, null, null, null, null]);
    expect(Array.from(root.querySelectorAll('p.rule')).map((p) => p.querySelector('code')?.textContent)).toEqual(['AB-6', 'AB-7']);
  });

  it('a status only from an em right after the dash, opening on a status word: text between, a strong or another word leaves no pill', async () => {
    const md = ['# T', '', '`AB-1` — then _agreed_ text.', '', '`AB-2` — **agreed** text.', '', '`AB-3` — _maybe_ text.', ''].join('\n');
    const root = await enhanced(md, { rules: true });
    expect(root.querySelectorAll('.rule-head .pill')).toHaveLength(0);
    expect(['AB-1', 'AB-2', 'AB-3'].map((id) => ctxOf(root).index.get(id)?.status)).toEqual([null, null, null]);
    const three = para(root, 'AB-3');
    expect(Array.from(three.childNodes).map(shape)).toEqual([
      { 'span.rule-head{chrome}': [{ code: ['"AB-3"'] }, { 'span[hidden]{chrome}': ['" — "'] }] },
      { em: ['"maybe"'] },
      '" text."',
    ]);
  });

  it('a status em of several nodes moves each into the pill, in order; the em left behind is hidden', async () => {
    const md = ['# T', '', '`AB-1` — _done in `v2` now_. Body.', ''].join('\n');
    const root = await enhanced(md, { rules: true });
    const head = para(root, 'AB-1').querySelector('.rule-head') as Element;
    expect(Array.from(head.childNodes).map(shape)).toEqual([
      { code: ['"AB-1"'] },
      { 'span.pill.ok{chrome}': ['"done in "', { code: ['"v2"'] }, '" now"'] },
      { 'span[hidden]{chrome}': ['" — "', 'em', '". "'] },
    ]);
  });

  it('a status em with nothing after it, or followed by an element or a word, takes no text after it', async () => {
    const md = ['---', 'rules: [AB-1, AB-4]', '---', '', '# T', '', '`AB-1` — _agreed_', '', '`AB-2` — _agreed_**. Bold**', '', '`AB-3` — *agreed*text.', '', '`AB-4` — _agreed_.', ''].join('\n');
    const root = await enhanced(md, { rules: true });
    expect(Array.from(para(root, 'AB-1').childNodes).map(shape)).toEqual([
      { 'span.rule-head{chrome}': [{ code: ['"AB-1"'] }, { 'span.pill.ok{chrome}': ['"agreed"'] }, { 'span[hidden]{chrome}': ['" — "', 'em'] }] },
    ]);
    expect(Array.from(para(root, 'AB-2').childNodes).map(shape)).toEqual([
      { 'span.rule-head{chrome}': [{ code: ['"AB-2"'] }, { 'span.pill.ok{chrome}': ['"agreed"'] }, { 'span[hidden]{chrome}': ['" — "', 'em'] }] },
      { strong: ['". Bold"'] },
    ]);
    expect(Array.from(para(root, 'AB-3').childNodes).map(shape)).toEqual([
      { 'span.rule-head{chrome}': [{ code: ['"AB-3"'] }, { 'span.pill.ok{chrome}': ['"agreed"'] }, { 'span[hidden]{chrome}': ['" — "', 'em'] }] },
      '"text."',
    ]);
    expect(Array.from(para(root, 'AB-4').childNodes).map(shape)).toEqual([
      { 'span.rule-head{chrome}': [{ code: ['"AB-4"'] }, { 'span.pill.ok{chrome}': ['"agreed"'] }, { 'span[hidden]{chrome}': ['" — "', 'em', '"."'] }] },
    ]);
    expect(ctxOf(root).index.get('AB-4')?.title).toBe('');
    // A rule with no title shows its ID alone in the rules index.
    const items = Array.from(root.querySelectorAll('.doc-facts ol > li')).map(shape);
    expect(items).toEqual([
      { 'li{chrome}': [{ 'a.rlink{chrome}': [{ 'span.rid{chrome}': ['"AB-1"'] }] }, { 'span.pill.ok{chrome}': ['"agreed"'] }] },
      { 'li{chrome}': [{ 'a.rlink{chrome}': [{ 'span.rid{chrome}': ['"AB-4"'] }] }, { 'span.pill.ok{chrome}': ['"agreed"'] }] },
    ]);
  });

  it('an ID over 200 code units is part of the head but not defined, and startup does not fail', async () => {
    const long = `AB-${'C'.repeat(198)}`;
    const md = ['# T', '', `\`${long}\` and \`AB-2\` — Text.`, ''].join('\n');
    const root = await enhanced(md, { rules: true });
    expect(para(root, long).className).toBe('rule');
    expect(ctxOf(root).index.get(long)).toBeUndefined();
    expect(ctxOf(root).index.get('AB-2')?.kind).toBe('rule');
    const ok = `AB-${'C'.repeat(197)}`;
    const root2 = await enhanced(['# T', '', `\`${ok}\` — Text.`, ''].join('\n'), { rules: true });
    expect(ctxOf(root2).index.get(ok)?.kind).toBe('rule');
  });

  it('destroy restores the text byte for byte: the same nodes, the same text, in the same order', async () => {
    const md = [RULES, '`AB-9` — _proposed_ (a note): Body.', '', '| ID | What | Status |', '|---|---|---|', '| R1 | One | Agreed |', '| R2 | Two | Open |', ''].join('\n');
    const root = mount(md);
    const html = root.innerHTML;
    const before = nodes(root);
    await enhance(root, optionsOf(md, { rules: true }));
    expect(root.querySelectorAll('p.rule')).toHaveLength(5);
    expect(root.querySelectorAll('td.idcell')).toHaveLength(2);
    await destroyEnhancement(root);
    expect(root.innerHTML).toBe(html);
    const after = nodes(root);
    expect(after.length).toBe(before.length);
    after.forEach((a, i) => {
      expect(a.node).toBe(before[i]?.node);
      expect(a.data).toBe(before[i]?.data);
    });
  });

  it('a host that normalizes the root while enhanced gets the text back in order: no two parts of one text sit side by side', async () => {
    const md = ['# T', '', '`AB-1` — _agreed_ (pending). Body text.', '', '`AB-2` and `AB-3` — _done_: Two.', '', '`AB-4` — _done_ (a note) Three.', ''].join('\n');
    const root = mount(md);
    const text = root.textContent;
    await enhance(root, optionsOf(md, { rules: true }));
    expect(root.querySelectorAll('.pill.info')).toHaveLength(2);
    root.normalize(); // as a find-in-page highlighter does after it unmarks
    await destroyEnhancement(root);
    expect(root.textContent).toBe(text);
    expect(para(root, 'AB-1').textContent).toBe('AB-1 — agreed (pending). Body text.');
  });
});

describe('the rules index (rules.ts; the reference layout, section 4)', () => {
  const summary = (root: Element): string => squash(root.querySelector('details.doc-facts > summary')?.textContent);
  const facts = (root: Element): HTMLDetailsElement => root.querySelector('details.doc-facts') as HTMLDetailsElement;

  it('takes the rule-ID list keys out of the panel: its part comes first in the summary, its list before the panel\'s own', async () => {
    const root = await enhanced(RULES, { rules: true });
    expect(summary(root)).toBe('Rules index · 5 rules · 2 agreed · 1 deferred · 2 tags');
    const parts = Array.from(facts(root).querySelector('summary')?.childNodes ?? []).map(shape);
    expect(parts).toEqual([
      { 'span.fs-k{chrome}': ['"Rules index · 5 rules"'] },
      { 'span.sep{chrome}': ['" · "'] },
      { 'span.cnt.ok{chrome}': ['"2 agreed"'] },
      { 'span.sep{chrome}': ['" · "'] },
      { 'span.cnt.info{chrome}': ['"1 deferred"'] },
      { 'span.sep{chrome}': ['" · "'] },
      '"2 tags"',
    ]);
    const body = facts(root).querySelector('.facts-body') as Element;
    expect(Array.from(body.children).map((c) => c.localName)).toEqual(['ol', 'dl']);
    expect(Array.from(body.querySelectorAll('dt')).map((d) => d.textContent)).toEqual(['tags']);
    const ol = body.querySelector('ol') as Element;
    expect(ol.hasAttribute(CHROME_ATTR)).toBe(true);
    expect(Array.from(ol.children).map(shape)).toEqual([
      { 'li{chrome}': [{ 'a.rlink{chrome}': [{ 'span.rid{chrome}': ['"AB-ONE"'] }, { 'span.rtitle{chrome}': ['"The first rule"'] }] }, 'span{chrome}'] },
      {
        'li{chrome}': [
          { 'a.rlink{chrome}': [{ 'span.rid{chrome}': ['"AB-TWO"'] }, { 'span.rtitle{chrome}': ['"The second and third rules share a paragraph"'] }] },
          { 'span.pill.ok{chrome}': ['"agreed"'] },
        ],
      },
      {
        'li{chrome}': [
          { 'a.rlink{chrome}': [{ 'span.rid{chrome}': ['"AB-THREE"'] }, { 'span.rtitle{chrome}': ['"The second and third rules share a paragraph"'] }] },
          { 'span.pill.ok{chrome}': ['"agreed"'] },
        ],
      },
      {
        'li{chrome}': [
          { 'a.rlink{chrome}': [{ 'span.rid{chrome}': ['"CD-4"'] }, { 'span.rtitle{chrome}': ['"the fourth rule has no bold title"'] }] },
          { 'span.pill.info{chrome}': ['"deferred"'] },
        ],
      },
      { 'li{chrome}': [{ 'div{chrome}': [{ 'span.rid{chrome}': ['"EF-5"'] }] }, 'span{chrome}'] },
    ]);
    expect(Array.from(ol.querySelectorAll('a.rlink')).map((a) => a.getAttribute('href'))).toEqual(['#AB-ONE', '#AB-TWO', '#AB-THREE', '#CD-4']);
  });

  it('a link in the index goes to its rule through the index (no id written): reveal, focus, onHash', async () => {
    const onHash = vi.fn();
    const root = await enhanced(RULES, { rules: true, onHash });
    const link = facts(root).querySelector('a.rlink') as Element;
    expect(click(link)).toBe(true);
    const p = para(root, 'AB-ONE —');
    expect(document.activeElement).toBe(p);
    expect(p.id).toBe('');
    expect(onHash.mock.calls).toEqual([['AB-ONE', { push: true, from: null }]]);
  });

  it('a key other than rules is named by itself; a list key with a value that is not a rule ID stays the panel\'s own', async () => {
    const md = ['---', 'refines: [AB-1]', 'covers: [AB-2, AB-3, other]', '---', '', '# T', '', '`AB-1` — _done_. Text.', ''].join('\n');
    const root = await enhanced(md, { rules: true });
    expect(summary(root)).toBe('Refines 1 rule · 1 done · 3 covers');
    expect(Array.from(facts(root).querySelectorAll('dt')).map((d) => d.textContent)).toEqual(['covers']);
  });

  it('counts the statuses by their first word, in lower case, most first, a tie in the order first seen', async () => {
    const md = [
      '---',
      'rules: [AB-1, AB-2, AB-3, AB-4, AB-5, AB-6, AB-7]',
      '---',
      '',
      '# T',
      '',
      '`AB-1` — _Deferred_ (later). One.',
      '',
      '`AB-2` — _done_. Two.',
      '',
      '`AB-3` — _Done twice_. Three.',
      '',
      '`AB-4` — _deferred_. Four.',
      '',
      '`AB-5` — _rejected_. Five.',
      '',
      '`AB-6` — _done_. Six.',
      '',
      '`AB-7` — _done(again)_. Seven.',
      '',
    ].join('\n');
    const root = await enhanced(md, { rules: true });
    expect(summary(root)).toBe('Rules index · 7 rules · 4 done · 2 deferred · 1 rejected');
  });

  it('a rule key shadowed by an earlier key of the same name that is no rule list is left in the panel', async () => {
    const md = ['# T', '', '`AB-1` — Text.', ''].join('\n');
    const root = mount(md);
    await enhance(root, {
      folds: false,
      rules: true,
      info: { title: 'T', frontList: [{ key: 'rules', list: true, vals: ['plain'] }, { key: 'rules', list: true, vals: ['AB-1'] }] },
    });
    expect(summary(root)).toBe('1 rules · 1 rules');
    expect(Array.from(facts(root).querySelectorAll('dd')).map((d) => d.textContent)).toEqual(['plain', 'AB-1']);
    const twice = mount(md);
    await enhance(twice, {
      folds: false,
      rules: true,
      info: { title: 'T', frontList: [{ key: 'rules', list: true, vals: ['AB-1'] }, { key: 'rules', list: true, vals: ['AB-2', 'AB-3'] }] },
    });
    expect(summary(twice)).toBe('Rules index · 1 rule · Rules index · 2 rules');
  });

  it('a scalar key, or an empty list, of the same name hides no rule key: the panel shows neither', async () => {
    const md = ['# T', '', '`AB-1` — Text.', ''].join('\n');
    const root = mount(md);
    await enhance(root, {
      folds: false,
      rules: true,
      info: {
        title: 'T',
        frontList: [
          { key: 'rules', list: false, vals: ['draft'] },
          { key: 'rules', list: true, vals: [] },
          { key: 'rules', list: true, vals: ['AB-1'] },
          { key: 'tags', list: true, vals: ['alpha'] },
        ],
      },
    });
    expect(summary(root)).toBe('Rules index · 1 rule · 1 tags');
    const empty = mount(md);
    await enhance(empty, { folds: false, rules: true, info: { title: 'T', frontList: [{ key: 'rules', list: true, vals: [] }, { key: 'tags', list: true, vals: ['alpha'] }] } });
    expect(summary(empty)).toBe('1 tags');
    expect(facts(empty).hasAttribute('open')).toBe(false);
  });

  it('opens at 6 rules or fewer; from 7 to 24 only at 700 px wide or more (env.matches); never at 25', async () => {
    const ids = (n: number): string => Array.from({ length: n }, (_, i) => `AB-${String(i + 1)}`).join(', ');
    const doc = (n: number): string => ['---', `rules: [${ids(n)}]`, '---', '', '# T', '', 'Text.', ''].join('\n');
    const open = async (n: number, wide: boolean): Promise<boolean> => {
      viewportWide(wide);
      const root = await enhanced(doc(n), { rules: true });
      const isOpen = facts(root).hasAttribute('open');
      await destroyEnhancement(root);
      expect(root.querySelector('.doc-facts')).toBeNull();
      return isOpen;
    };
    const seen: string[] = [];
    for (const [n, wide] of [[1, false], [6, false], [7, false], [7, true], [24, true], [25, true], [24, false]] as const) {
      seen.push(`${String(n)} ${wide ? 'wide' : 'narrow'}: ${String(await open(n, wide))}`);
    }
    expect(seen).toEqual(['1 narrow: true', '6 narrow: true', '7 narrow: false', '7 wide: true', '24 wide: true', '25 wide: false', '24 narrow: false']);
  });

  it('a rule ID over 200 code units is listed by its ID alone: no link, no pill, and its status is not counted', async () => {
    const long = `AB-${'C'.repeat(210)}`;
    const md = ['---', `rules: [AB-1, ${long}]`, '---', '', '# T', '', '`AB-1` — _done_. One.', '', `\`${long}\` — _done_. Long.`, ''].join('\n');
    const root = await enhanced(md, { rules: true });
    expect(summary(root)).toBe('Rules index · 2 rules · 1 done');
    expect(Array.from(root.querySelectorAll('.doc-facts ol > li')).map(shape)).toEqual([
      { 'li{chrome}': [{ 'a.rlink{chrome}': [{ 'span.rid{chrome}': ['"AB-1"'] }, { 'span.rtitle{chrome}': ['"One"'] }] }, { 'span.pill.ok{chrome}': ['"done"'] }] },
      { 'li{chrome}': [{ 'div{chrome}': [{ 'span.rid{chrome}': [JSON.stringify(long)] }] }, 'span{chrome}'] },
    ]);
    expect(ctxOf(root).index.get(long)).toBeUndefined(); // nothing could link to it: no entry, and no id written
  });

  it('a document with no rule keys keeps the panel closed and as it was', async () => {
    viewportWide(true);
    const md = ['---', 'tags: [alpha]', '---', '', '# T', '', '`AB-1` — Text.', ''].join('\n');
    const root = await enhanced(md, { rules: true });
    expect(summary(root)).toBe('1 tags');
    expect(facts(root).hasAttribute('open')).toBe(false);
    expect(para(root, 'AB-1').className).toBe('rule');
  });

  it('without a facts panel (no title, or no front matter) rule paragraphs still build', async () => {
    const md = ['---', 'rules: [AB-1]', '---', '', '`AB-1` — _agreed_. Text.', ''].join('\n');
    const root = await enhanced(md, { rules: true });
    expect(root.querySelector('.doc-facts')).toBeNull();
    expect(para(root, 'AB-1').className).toBe('rule');
    const bare = mount(['# T', '', '`AB-1` — Text.', ''].join('\n'));
    await enhance(bare, { folds: false, rules: true });
    expect(bare.querySelector('.doc-facts')).toBeNull();
    expect(ctxOf(bare).index.get('AB-1')?.kind).toBe('rule');
  });
});

const TABLES = [
  '# Example decisions',
  '',
  '```',
  'A code block is a block, not a table.',
  '```',
  '',
  '| ID | Before |',
  '|---|---|',
  '| B1 | No heading before it |',
  '| B2 | Still none |',
  '',
  '## 1. Decisions',
  '',
  'Intro.',
  '',
  '### Accepted ones',
  '',
  '| ID | Decision | Why | Status |',
  '|---|---|---|---|',
  '| D1 | Keep the palette | Readers know it | Agreed |',
  '| D2: Fold by default | Short pages | Shorter | Rejected, too costly |',
  '| D3 | A third | Later on | Deferred |',
  '',
  '## 2. Mixed',
  '',
  '| Item | Note |',
  '|---|---|',
  '| X1 | First |',
  '| something else | Second |',
  '| X2 with words | Third |',
  '| more | Fourth |',
  '| last | Fifth |',
  '',
].join('\n');

describe('ID rows (ids.ts; the reference layout, section 8)', () => {
  it('an ID table: idcell on each first cell; a row entry per ID with its title, the role of its last pill, its group and heads', async () => {
    const root = await enhanced(TABLES, {}, (r) => {
      const outside = document.createElement('h2');
      outside.id = 'outside';
      outside.textContent = 'A heading outside the root';
      r.before(outside); // the group is looked for inside the root only
    });
    const { index } = ctxOf(root);
    const rows = Array.from(root.querySelectorAll('tbody tr'));
    expect(rows.map((r) => (r.firstElementChild as Element).className)).toEqual(['idcell', 'idcell', 'idcell', 'idcell', 'idcell', 'idcell', '', '', '', '']);
    expect(['D1', 'D2', 'D3'].map((id) => plain(index.get(id)))).toEqual([
      { id: 'D1', kind: 'row', title: 'Keep the palette', status: 'ok', group: 'Accepted ones', target: 'tr: D1 Keep the palette Read', row: 'tr', heads: ['ID', 'Decision', 'Why', 'Status'] },
      { id: 'D2', kind: 'row', title: 'Fold by default', status: 'no', group: 'Accepted ones', target: 'tr: D2: Fold by default Shor', row: 'tr', heads: ['ID', 'Decision', 'Why', 'Status'] },
      { id: 'D3', kind: 'row', title: 'A third', status: 'info', group: 'Accepted ones', target: 'tr: D3 A third Later on Defe', row: 'tr', heads: ['ID', 'Decision', 'Why', 'Status'] },
    ]);
    expect(index.get('D1')?.target).toBe(rows[2]);
    expect(index.get('D1')?.row).toBe(rows[2]);
    expect(plain(index.get('B1'))).toMatchObject({ id: 'B1', title: 'No heading before it', status: null, group: 'Index' });
    expect(Array.from(root.querySelectorAll('[id]')).map((e) => e.id)).toEqual(['example-decisions', '1-decisions', 'accepted-ones', '2-mixed']); // no ids written
  });

  it('outside an index, only a first cell that is exactly an ID of 10 characters or fewer defines its row', async () => {
    const root = await enhanced(TABLES);
    const { index } = ctxOf(root);
    expect(plain(index.get('X1'))).toMatchObject({ id: 'X1', kind: 'row', title: 'First', group: 'Mixed', heads: ['Item', 'Note'] });
    expect(index.get('X2')).toBeUndefined();
    const md = ['# T', '', '| Item | Note |', '|---|---|', '| ABCD-12345 | Ten |', '| ABCD-123456 | Eleven |', '| one | x |', '| two | x |', '| three | x |', ''].join('\n');
    const short = await enhanced(md);
    expect(ctxOf(short).index.get('ABCD-12345')?.title).toBe('Ten');
    expect(ctxOf(short).index.get('ABCD-123456')).toBeUndefined();
  });

  it('the threshold: two rows or more, with at least 60% of the first cells opening on an ID', async () => {
    const table = (cells: readonly string[]): string => ['| Key | Note |', '|---|---|', ...cells.map((c, i) => `| ${c} | Note ${String(i)} |`), ''].join('\n');
    const md = [
      '# T',
      '',
      table(['Q1 first', 'Q2 second', 'plain']), // 2 of 3: an index
      table(['P1 first', 'P2 second', 'plain', 'plain', 'plain']), // 2 of 5: not one
      table(['S1 only']), // one row: never an index
      table(['T1 a', 'T2 b', 'T3 c', 'plain', 'plain']), // 3 of 5: an index
    ].join('\n');
    const root = await enhanced(md);
    const { index, blocks } = ctxOf(root);
    expect(blocks.map((b) => (b as TableBlock).isIndex)).toEqual([true, false, false, true]);
    expect(['Q1', 'Q2', 'P1', 'P2', 'S1', 'T1', 'T3'].map((id) => index.get(id)?.title ?? null)).toEqual(['first', 'second', null, null, null, 'Note 0', 'Note 2']);
  });

  it('the title: the first cell after its ID when longer than two characters and no ID, else the title column, else the second cell', async () => {
    const md = [
      '# T',
      '',
      '| ID | Why | Name |',
      '|---|---|---|',
      '| A1 - the own title | why | name one |',
      '| A2 ab | why | name two |',
      '| A3 R14 and more | why | name three |',
      '',
      '| ID | Why | Other |',
      '|---|---|---|',
      '| C1 | the second cell | other |',
      '| C2 | why two | other |',
      '',
      '| Task | Why | Name |',
      '|---|---|---|',
      '| T1 | why | the name column, not the first |',
      '| T2 | why | name |',
      '',
      '| ID |',
      '|---|',
      '| O1 |',
      '| O2 ok |',
      '',
    ].join('\n');
    const root = await enhanced(md);
    const { index } = ctxOf(root);
    expect(['A1', 'A2', 'A3', 'C1', 'T1', 'O1', 'O2'].map((id) => index.get(id)?.title)).toEqual([
      'the own title',
      'name two',
      'name three',
      'the second cell',
      'the name column, not the first',
      '',
      '',
    ]);
  });

  it('a title is clipped to 90', async () => {
    const long = Array.from({ length: 40 }, (_, i) => `word${String(i)}`).join(' ');
    const md = ['# T', '', '| ID | What |', '|---|---|', `| R1 | ${long} |`, '| R2 | short |', ''].join('\n');
    const root = await enhanced(md);
    const ctx = ctxOf(root);
    expect(ctx.index.get('R1')?.title).toBe(ctx.text.clip(long, 90));
    expect(ctx.index.get('R1')?.title.length).toBeLessThanOrEqual(90);
  });

  it('the group: the nearest h2 or h3 with an id before it, its number dropped; through a box; else Index', async () => {
    const md = [
      '# T',
      '',
      '## In short',
      '',
      '- A point.',
      '',
      '---',
      '',
      '| ID | What |',
      '|---|---|',
      '| S1 | after the box |',
      '| S2 | after the box |',
      '',
      '## 3. Numbered things',
      '',
      '> | ID | What |',
      '> |---|---|',
      '> | N1 | in a quote |',
      '> | N2 | in a quote |',
      '',
      '#### A deeper heading',
      '',
      '| ID | What |',
      '|---|---|',
      '| H1 | under h4 |',
      '| H2 | under h4 |',
      '',
      '### No id here',
      '',
      '| ID | What |',
      '|---|---|',
      '| K1 | under an h3 with no id |',
      '| K2 | under an h3 with no id |',
      '',
    ].join('\n');
    const root = await enhanced(md, {}, (r) => {
      const h3 = Array.from(r.querySelectorAll('h3')).find((h) => h.textContent === 'No id here') as Element;
      h3.removeAttribute('id');
    });
    const { index } = ctxOf(root);
    expect(['S1', 'N1', 'H1', 'K1'].map((id) => index.get(id)?.group)).toEqual(['In short', 'Numbered things', 'Numbered things', 'Numbered things']);
  });

  it('the group: a Where things stand box before the table counts by its heading', async () => {
    const md = ['# T', '', '## Where things stand', '', '### Agreed', '', '- One.', '', '---', '', '| ID | What |', '|---|---|', '| W1 | after the box |', '| W2 | after the box |', ''].join('\n');
    const root = await enhanced(md);
    const table = root.querySelector('table') as Element;
    expect(root.querySelector('.callout')?.compareDocumentPosition(table)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(ctxOf(root).index.get('W1')?.group).toBe('Agreed');
  });

  it('the group is found in linear time: four times the tables under one heading reads at most six times the siblings', async () => {
    const doc = (n: number): string =>
      ['# T', '', '## Under one heading', '', ...Array.from({ length: n }, (_, i) => `Paragraph ${String(i)}.\n\n| ID | What |\n|---|---|\n| X${String(i)} | one |\n`)].join('\n');
    const reads = async (n: number): Promise<number> => {
      const md = doc(n);
      const root = mount(md);
      const spy = vi.spyOn(Element.prototype, 'previousElementSibling', 'get');
      await enhance(root, optionsOf(md));
      const count = spy.mock.calls.length;
      spy.mockRestore();
      expect(ctxOf(root).index.get(`X${String(n - 1)}`)?.group).toBe('Under one heading');
      return count;
    };
    const one = await reads(200);
    const four = await reads(800);
    // Walking back from each table to the heading, as before, reads about sixteen times as many (quadratic).
    expect(four / one).toBeLessThanOrEqual(6);
  }, 120_000);

  it('the status is the role of the row\'s last chrome pill; an element of the document classed pill is not one', async () => {
    const md = ['# T', '', '| ID | Status | Verdict |', '|---|---|---|', '| R1 | Agreed | Rejected |', '| R2 | Agreed | x |', '| R3 | x | y |', ''].join('\n');
    const root = await enhanced(md, {}, (r) => {
      const cell = r.querySelectorAll('tbody tr')[2]?.children[2] as Element;
      const fake = document.createElement('span');
      fake.className = 'pill ok';
      fake.textContent = 'done';
      cell.append(fake);
    });
    const { index } = ctxOf(root);
    expect(['R1', 'R2', 'R3'].map((id) => index.get(id)?.status)).toEqual(['no', 'ok', null]);
  });

  it('first-wins: a rule over a row, a lettered section over a row, an earlier row over a later one; each first cell still marked', async () => {
    const md = [
      '# T',
      '',
      '`AB-1` — The rule.',
      '',
      '## F1. Feature one',
      '',
      '| ID | What |',
      '|---|---|',
      '| AB-1 | a row |',
      '| F1 | a row |',
      '| R7 | first row |',
      '| R7 | second row |',
      '',
    ].join('\n');
    const root = await enhanced(md, { rules: true });
    const { index } = ctxOf(root);
    expect(['AB-1', 'F1', 'R7'].map((id) => [index.get(id)?.kind, index.get(id)?.title])).toEqual([
      ['rule', 'The rule'],
      ['section', 'Feature one'],
      ['row', 'first row'],
    ]);
    expect(Array.from(root.querySelectorAll('tbody td.idcell'))).toHaveLength(4);
  });

  it('an ID over 200 code units marks its cell but is not defined, and startup does not fail', async () => {
    const long = `R${'1'.repeat(200)}`;
    const md = ['# T', '', '| ID | What |', '|---|---|', `| ${long} | long |`, '| R2 | short |', ''].join('\n');
    const root = await enhanced(md);
    expect(ctxOf(root).index.get(long)).toBeUndefined();
    expect(ctxOf(root).index.get('R2')?.title).toBe('short');
    expect(root.querySelectorAll('td.idcell')).toHaveLength(2);
  });

  it('a first cell is read without hidden chrome, as the reference read it once a bullet was gone; the document\'s own hidden text counts', async () => {
    const md = ['# T', '', '| ID | What |', '|---|---|', '| R1 | x |', '| R2 | y |', ''].join('\n');
    const root = await enhanced(md, {}, (r) => {
      // A probe of what the tables step leaves: a hidden chrome bullet ahead of the cell's text.
      const [one, two] = Array.from(r.querySelectorAll('tbody tr')).map((tr) => tr.firstElementChild as Element);
      const bullet = document.createElement('span');
      bullet.setAttribute(CHROME_ATTR, '');
      bullet.setAttribute('hidden', '');
      bullet.textContent = '• ';
      one?.prepend(bullet);
      const own = document.createElement('span');
      own.setAttribute('hidden', '');
      own.textContent = ': its own title';
      two?.append(own);
    });
    expect(ctxOf(root).index.get('R1')?.title).toBe('x');
    expect(ctxOf(root).index.get('R2')?.title).toBe('its own title');
  });

  it('destroy removes idcell', async () => {
    const root = mount(TABLES);
    const html = root.innerHTML;
    await enhance(root, optionsOf(TABLES));
    expect(root.querySelectorAll('.idcell').length).toBeGreaterThan(0);
    await destroyEnhancement(root);
    expect(root.innerHTML).toBe(html);
  });

  it('RF3: on the large plan every one of its 2,000 rows is defined', async () => {
    const plan = largePlan();
    const root = await enhanced(plan.markdown);
    const rows = ctxOf(root).index.all().filter((e) => e.kind === 'row');
    expect(rows).toHaveLength(2000);
    expect(rows[0]?.id).toBe('R1');
  }, 120_000);
});

describe('lettered sections (ids.ts; the reference layout, section 6)', () => {
  const md = [
    '# Example sections',
    '',
    '## F1. First feature',
    '',
    'One.',
    '',
    '## F2. Second feature',
    '',
    '## 3. Plain number',
    '',
    '## G1. After a number',
    '',
    '## Unnumbered',
    '',
    '## 4a. Not lettered',
    '',
    '## `H1`. In code',
    '',
    '## AB12. Two capitals',
    '',
    '### K1. A level-3 heading',
    '',
  ].join('\n');

  it('a lettered number defines a section, grouped under the last other level-2 heading, or Sections before any', async () => {
    const root = await enhanced(md);
    const sections = ctxOf(root).index.all().filter((e) => e.kind === 'section');
    expect(sections.map((e) => [e.id, e.title, e.group, e.target.localName, e.status, e.row, e.heads])).toEqual([
      ['F1', 'First feature', 'Sections', 'h2', null, null, []],
      ['F2', 'Second feature', 'Sections', 'h2', null, null, []],
      ['G1', 'After a number', 'Plain number', 'h2', null, null, []],
    ]);
  });

  it('the number is the one editorial hung (chrome): a document\'s own element classed sec-no is none', async () => {
    const root = await enhanced(['# T', '', '## Plain heading', '', '## F1. Real', ''].join('\n'), {}, (r) => {
      const h = Array.from(r.querySelectorAll('h2')).find((x) => x.textContent === 'Plain heading') as Element;
      const fake = document.createElement('span');
      fake.className = 'sec-no';
      fake.textContent = 'Z9';
      h.prepend(fake);
      const empty = document.createElement('h2');
      empty.id = 'empty';
      h.before(empty);
    });
    const { index } = ctxOf(root);
    expect(index.get('Z9')).toBeUndefined();
    expect(index.get('F1')?.group).toBe('Z9Plain heading');
  });

  it('a section title is clipped to 90, and a number over 200 code units is not defined', async () => {
    const long = Array.from({ length: 40 }, (_, i) => `word${String(i)}`).join(' ');
    const big = `A${'1'.repeat(200)}`;
    const root = await enhanced(['# T', '', `## F1. ${long}`, '', `## ${big}. Big`, '', '## F2. Small', ''].join('\n'));
    const ctx = ctxOf(root);
    expect(ctx.index.get('F1')?.title).toBe(ctx.text.clip(long, 90));
    expect(ctx.index.get(big)).toBeUndefined();
    expect(ctx.index.get('F2')?.title).toBe('Small');
  });
});
