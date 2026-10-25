// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { destroyEnhancement, enhance, setEnhancementPrefs } from '../src/enhance/index.js';
import { createFolds } from '../src/enhance/folds.js';
import { contextOf } from '../src/enhance/lifecycle.js';
import { docKey } from '../src/enhance/state.js';

const mounted: HTMLElement[] = [];

function sourceRoot(): HTMLElement {
  const root = document.createElement('main');
  const title = document.createElement('h1');
  title.textContent = 'Source document';
  root.append(title);
  for (const [id, text] of [
    ['one', 'One'],
    ['two', 'Two'],
    ['three', 'Three'],
  ] as const) {
    const heading = document.createElement('h2');
    heading.id = id;
    heading.textContent = text;
    const member = document.createElement('p');
    member.textContent = `${text} member`;
    root.append(heading, member);
  }
  document.body.append(root);
  mounted.push(root);
  return root;
}

function heading(root: Element, id: string): HTMLElement {
  const found = Array.from(root.children).find((child) => child.localName === 'h2' && child.id === id);
  if (!(found instanceof HTMLElement)) throw new Error(`missing heading ${id}`);
  return found;
}

function foldNote(heading: Element): HTMLElement {
  const note = heading.nextElementSibling;
  if (!(note instanceof HTMLElement) || !note.classList.contains('fold-note')) throw new Error('missing fold note');
  return note;
}

function storedGetter(storageKey: string, mutate: () => void, value: string): Record<string, string> {
  const snapshot: Record<string, string> = {};
  Object.defineProperty(snapshot, docKey(storageKey, 'folds'), { enumerable: true, get: () => {
    mutate();
    return value;
  } });
  return snapshot;
}

afterEach(async () => {
  for (const root of mounted.splice(0)) await destroyEnhancement(root).catch(() => undefined);
  document.body.replaceChildren();
});

describe('fold source capture', () => {
  it('reads stored folds before it creates controls and discards a heading the getter removes', async () => {
    const root = sourceRoot();
    const first = heading(root, 'one');
    let controlsAtFoldRead = -1;
    const snapshot = storedGetter('source', () => {
      controlsAtFoldRead = root.querySelectorAll('.h-fold, .fold-note').length;
      first.remove();
    }, '["one"]');

    await enhance(root, { storage: { snapshot }, storageKey: 'source' });

    expect(controlsAtFoldRead).toBe(0);
    expect(root.querySelectorAll('.h-fold, .fold-note').length).toBe(4);
  });

  it('captures source after a pending preference write but excludes later getter text and a lookalike block', async () => {
    const root = sourceRoot();
    const first = heading(root, 'one');
    const original = first.nextElementSibling as HTMLElement;
    const lookalike = document.createElement('p');
    const snapshot: Record<string, string> = {};
    Object.defineProperty(snapshot, 'docreader:prefs', {
      enumerable: true,
      get: () => {
        setEnhancementPrefs(root, { width: 'wide' });
        original.textContent = 'early '.repeat(344);
        return '{}';
      },
    });
    Object.defineProperty(snapshot, docKey('source', 'folds'), {
      enumerable: true,
      get: () => {
        original.textContent = 'late '.repeat(1000);
        lookalike.textContent = 'early '.repeat(344);
        original.after(lookalike);
        return '["one"]';
      },
    });

    await enhance(root, { storage: { snapshot }, storageKey: 'source' });

    expect(foldNote(first).querySelector('.fn-m')?.textContent).toBe('2 min');
    expect(root.getAttribute('data-width')).toBe('wide');
    expect(original.getAttribute('hidden')).toBe('until-found');
    expect(lookalike.getAttribute('hidden')).toBeNull();
  });

  it('never enrolls an author-looking block a pre-fold state getter adds', async () => {
    const root = sourceRoot();
    const one = heading(root, 'one');
    const original = one.nextElementSibling as HTMLElement;
    const added = document.createElement('p');
    added.textContent = 'later author-looking member';
    let marksRead = false;
    const snapshot: Record<string, string> = {};
    Object.defineProperty(snapshot, docKey('source', 'marks'), {
      enumerable: true,
      get: () => {
        marksRead = true;
        original.after(added);
        return '{}';
      },
    });
    snapshot[docKey('source', 'folds')] = '["one"]';

    await enhance(root, { storage: { snapshot }, storageKey: 'source' });

    expect([marksRead, original.getAttribute('hidden'), added.getAttribute('hidden')]).toEqual([true, 'until-found', null]);
  });

  it('keeps a held member after its old trailing boundary is removed, but never absorbs a later member', async () => {
    const root = sourceRoot();
    const one = heading(root, 'one');
    const two = heading(root, 'two');
    const oneMember = one.nextElementSibling as HTMLElement;
    const twoMember = two.nextElementSibling as HTMLElement;
    const snapshot = storedGetter('source', () => two.remove(), '["one"]');

    await enhance(root, { storage: { snapshot }, storageKey: 'source' });

    expect(one.classList.contains('folded')).toBe(true);
    expect(oneMember.getAttribute('hidden')).toBe('until-found');
    expect(twoMember.getAttribute('hidden')).toBeNull();
  });

  it('uses the pre-getter heading id for stored selection while requiring a current eligible heading', async () => {
    const root = sourceRoot();
    const one = heading(root, 'one');
    const snapshot = storedGetter('source', () => {
      one.id = 'renamed';
    }, '["one"]');

    await enhance(root, { storage: { snapshot }, storageKey: 'source' });

    expect(one.classList.contains('folded')).toBe(true);
    expect((one.nextElementSibling?.nextElementSibling as HTMLElement).getAttribute('hidden')).toBe('until-found');
  });

  it('drops an association when a getter inserts a direct or nested h2 barrier before its member', async () => {
    for (const nested of [false, true]) {
      const root = sourceRoot();
      const one = heading(root, 'one');
      const member = one.nextElementSibling as HTMLElement;
      const snapshot = storedGetter('source', () => {
        const barrier = document.createElement(nested ? 'div' : 'h2');
        if (nested) barrier.append(document.createElement('h2'));
        one.after(barrier);
      }, '["one"]');

      await enhance(root, { storage: { snapshot }, storageKey: 'source' });

      expect(one.querySelector('.h-fold')).toBeNull();
      expect(member.getAttribute('hidden')).toBeNull();
    }
  });

  it('keeps h1 as an ordinary member and respects idless and nested-h2 boundaries', async () => {
    const root = sourceRoot();
    const one = heading(root, 'one');
    const oneMember = one.nextElementSibling as HTMLElement;
    const h1 = document.createElement('h1');
    h1.textContent = 'ordinary h1 member';
    const idless = document.createElement('h2');
    idless.textContent = 'idless boundary';
    const pastIdless = document.createElement('p');
    pastIdless.textContent = 'past idless';
    const nested = document.createElement('div');
    nested.append(document.createElement('h2'));
    oneMember.after(h1, idless, pastIdless, nested);

    await enhance(root, { storageKey: 'source', storage: { snapshot: { [docKey('source', 'folds')]: '["one"]' } } });

    expect(one.classList.contains('folded')).toBe(true);
    expect(h1.getAttribute('hidden')).toBe('until-found');
    expect(oneMember.getAttribute('hidden')).toBe('until-found');
    expect(pastIdless.getAttribute('hidden')).toBeNull();
    expect(nested.getAttribute('hidden')).toBeNull();
  });

  it('adds integer source contributions once per original before a single minute conversion', async () => {
    const root = sourceRoot();
    const one = heading(root, 'one');
    const first = one.nextElementSibling as HTMLElement;
    first.textContent = 'prose '.repeat(229);
    const code = document.createElement('div');
    code.className = 'codehilite';
    code.textContent = 'code '.repeat(520);
    const nested = document.createElement('div');
    const nestedCode = document.createElement('div');
    nestedCode.className = 'codehilite';
    nestedCode.textContent = 'nested '.repeat(520);
    nested.append(nestedCode, document.createElement('figure'));
    const figure = document.createElement('figure');
    const script = document.createElement('script');
    script.textContent = 'void 0';
    const dl = document.createElement('dl');
    dl.textContent = 'ignored '.repeat(1000);
    first.after(code, nested, figure, script, dl);

    await enhance(root);

    expect(foldNote(one).querySelector('.fn-m')?.textContent).toBe('4 min');
  });

  it('keeps the prebuild facade empty and false without throwing for an invalid join', () => {
    const root = sourceRoot();
    const folds = createFolds(root);
    const source = root.outerHTML;

    expect(() => folds.join(document.createElement('div'), document.createElement('p'))).not.toThrow();
    expect([folds.headings(), folds.isFolded(root), folds.sectionOf(root), folds.join(document.createElement('div'), root)]).toEqual([[], false, null, false]);
    expect(root.outerHTML).toBe(source);
  });

  it('revalidates held source after save before hidden writes and rejects a stale exact-member join', async () => {
    const root = sourceRoot();
    const one = heading(root, 'one');
    const member = one.nextElementSibling as HTMLElement;
    const writes: [string, string | null][] = [];
    await enhance(root, {
      storageKey: 'source',
      storage: {
        snapshot: {},
        set: (key, value) => {
          writes.push([key, value]);
          member.remove();
        },
      },
    });
    const folds = contextOf(root)?.folds;
    if (folds === undefined) throw new Error('missing folds');
    const joined = document.createElement('aside');
    joined.setAttribute('data-docreader-chrome', '');
    root.append(joined);

    expect(folds.join(joined, member)).toBe(true);
    folds.setFold(one, true);

    const late = document.createElement('aside');
    late.setAttribute('data-docreader-chrome', '');
    root.append(late);
    expect(writes.length).toBe(1);
    expect([joined.getAttribute('hidden'), folds.sectionOf(joined), folds.join(late, member)]).toEqual([null, null, false]);
  });

  it('keeps a zero-contribution original as a fold member', async () => {
    const root = sourceRoot();
    const one = heading(root, 'one');
    const member = one.nextElementSibling as HTMLElement;
    member.replaceChildren();

    await enhance(root, { storageKey: 'source', storage: { snapshot: { [docKey('source', 'folds')]: '["one"]' } } });

    expect([member.getAttribute('hidden'), foldNote(one).querySelector('.fn-m')]).toEqual(['until-found', null]);
  });

  it('never reads FOLDS when the held scan is empty', async () => {
    const root = sourceRoot();
    let foldsReads = 0;
    const snapshot: Record<string, string> = {};
    Object.defineProperty(snapshot, docKey('source', 'marks'), {
      enumerable: true,
      get: () => {
        for (const member of Array.from(root.querySelectorAll('p'))) member.remove();
        return '{}';
      },
    });
    Object.defineProperty(snapshot, docKey('source', 'folds'), {
      enumerable: true,
      get: () => {
        foldsReads += 1;
        throw new Error('FOLDS getter must not run');
      },
    });

    await enhance(root, { storage: { snapshot }, storageKey: 'source' });

    expect([foldsReads, root.querySelectorAll('.h-fold, .fold-note').length]).toEqual([0, 0]);
  });

  it('never re-enrolls an original invalidated by the stored-fold getter', async () => {
    const root = sourceRoot();
    const one = heading(root, 'one');
    const a = one.nextElementSibling as HTMLElement;
    const b = document.createElement('p');
    a.textContent = 'alpha '.repeat(230);
    b.textContent = 'beta '.repeat(344);
    a.after(b);
    const wrapper = document.createElement('div');
    const snapshot: Record<string, string> = {};
    Object.defineProperty(snapshot, docKey('source', 'marks'), {
      enumerable: true,
      get: () => {
        b.after(wrapper);
        wrapper.append(a, b);
        return '{}';
      },
    });
    Object.defineProperty(snapshot, docKey('source', 'folds'), {
      enumerable: true,
      get: () => {
        a.remove();
        return '["one"]';
      },
    });

    await enhance(root, { storageKey: 'source', storage: { snapshot } });
    const folds = contextOf(root)?.folds;
    if (folds === undefined) throw new Error('missing folds');
    wrapper.append(a);

    expect([foldNote(one).querySelector('.fn-m')?.textContent, folds.sectionOf(a), folds.sectionOf(b)]).toEqual(['2 min', null, one]);
  });

  it('permanently drops one original after post-save wrapper loss', async () => {
    const root = sourceRoot();
    const one = heading(root, 'one');
    const a = one.nextElementSibling as HTMLElement;
    const b = document.createElement('p');
    a.textContent = 'alpha '.repeat(230);
    b.textContent = 'beta '.repeat(344);
    a.after(b);
    const wrapper = document.createElement('div');
    let removeA = false;
    const writes: [string, string | null][] = [];
    const snapshot: Record<string, string> = {};
    Object.defineProperty(snapshot, docKey('source', 'marks'), {
      enumerable: true,
      get: () => {
        b.after(wrapper);
        wrapper.append(a, b);
        return '{}';
      },
    });
    snapshot[docKey('source', 'folds')] = '["one"]';

    await enhance(root, {
      storageKey: 'source',
      storage: {
        snapshot,
        set: (key, value) => {
          writes.push([key, value]);
          if (removeA) a.remove();
        },
      },
    });
    const folds = contextOf(root)?.folds;
    if (folds === undefined) throw new Error('missing folds');
    expect(foldNote(one).querySelector('.fn-m')?.textContent).toBe('3 min');

    removeA = true;
    folds.setFold(one, false);
    wrapper.append(a);

    expect([foldNote(one).querySelector('.fn-m')?.textContent, folds.sectionOf(a), folds.sectionOf(b), writes.length]).toEqual(['2 min', null, one, 1]);
  });

  it('ignores beforematch on a stale direct source but unfolds a live source', async () => {
    const root = sourceRoot();
    const one = heading(root, 'one');
    const a = one.nextElementSibling as HTMLElement;
    const b = document.createElement('p');
    b.textContent = 'second source';
    a.after(b);
    const writes: [string, string | null][] = [];
    await enhance(root, { storageKey: 'source', storage: { snapshot: {}, set: (key, value) => { writes.push([key, value]); } } });
    const folds = contextOf(root)?.folds;
    if (folds === undefined) throw new Error('missing folds');

    folds.setFold(one, true);
    const writesBeforeStale = writes.length;
    a.remove();
    a.dispatchEvent(new Event('beforematch'));

    expect([folds.isFolded(one), writes.length, b.getAttribute('hidden')]).toEqual([true, writesBeforeStale, 'until-found']);
    b.dispatchEvent(new Event('beforematch'));
    expect([folds.isFolded(one), writes.length]).toEqual([false, writesBeforeStale + 1]);
  });

  it('ignores beforematch on a stale joined node but unfolds a live joined node', async () => {
    const root = sourceRoot();
    const one = heading(root, 'one');
    const a = one.nextElementSibling as HTMLElement;
    const b = document.createElement('p');
    b.textContent = 'second source';
    a.after(b);
    const writes: [string, string | null][] = [];
    await enhance(root, { storageKey: 'source', storage: { snapshot: {}, set: (key, value) => { writes.push([key, value]); } } });
    const folds = contextOf(root)?.folds;
    if (folds === undefined) throw new Error('missing folds');
    const joined = document.createElement('aside');
    joined.setAttribute('data-docreader-chrome', '');
    root.append(joined);
    expect(folds.join(joined, b)).toBe(true);

    folds.setFold(one, true);
    const writesBeforeStale = writes.length;
    b.remove();
    joined.dispatchEvent(new Event('beforematch'));

    expect([folds.isFolded(one), writes.length, a.getAttribute('hidden')]).toEqual([true, writesBeforeStale, 'until-found']);
    const live = document.createElement('aside');
    live.setAttribute('data-docreader-chrome', '');
    root.append(live);
    expect(folds.join(live, a)).toBe(true);
    live.dispatchEvent(new Event('beforematch'));
    expect([folds.isFolded(one), writes.length]).toEqual([false, writesBeforeStale + 1]);
  });

  it('keeps exact joined chains only while their source anchor is live', async () => {
    const root = sourceRoot();
    const one = heading(root, 'one');
    const source = one.nextElementSibling as HTMLElement;
    await enhance(root, { storageKey: 'source', storage: { snapshot: {} } });
    const folds = contextOf(root)?.folds;
    if (folds === undefined) throw new Error('missing folds');
    const first = document.createElement('aside');
    const second = document.createElement('aside');
    const third = document.createElement('aside');
    const nested = document.createElement('span');
    for (const node of [first, second, third]) node.setAttribute('data-docreader-chrome', '');
    first.append(nested);
    root.append(first, second, third);

    expect(folds.join(first, source)).toBe(true);
    expect(folds.join(second, first)).toBe(true);
    expect([folds.sectionOf(first), folds.sectionOf(second), folds.join(third, nested), folds.join(first, source)]).toEqual([one, one, false, false]);
    folds.setFold(one, true);
    expect([first.getAttribute('hidden'), second.getAttribute('hidden')]).toEqual(['until-found', 'until-found']);

    source.remove();
    const fourth = document.createElement('aside');
    fourth.setAttribute('data-docreader-chrome', '');
    root.append(fourth);
    expect([folds.join(fourth, second), folds.sectionOf(first), folds.sectionOf(second)]).toEqual([false, null, null]);
  });

  it('does not fold a member after its heading becomes ineligible during save', async () => {
    const root = sourceRoot();
    const one = heading(root, 'one');
    const member = one.nextElementSibling as HTMLElement;
    await enhance(root, {
      storageKey: 'source',
      storage: { snapshot: {}, set: () => { one.id = ''; } },
    });
    const folds = contextOf(root)?.folds;
    if (folds === undefined) throw new Error('missing folds');

    folds.setFold(one, true);

    expect([member.getAttribute('hidden'), folds.sectionOf(member), folds.isFolded(one)]).toEqual([null, null, false]);
  });

  it('keeps host changes made after a fold through teardown', async () => {
    const root = sourceRoot();
    const one = heading(root, 'one');
    const member = one.nextElementSibling as HTMLElement;
    await enhance(root);
    const folds = contextOf(root)?.folds;
    if (folds === undefined) throw new Error('missing folds');
    folds.setFold(one, true);
    member.setAttribute('hidden', '');

    await destroyEnhancement(root);

    expect(member.getAttribute('hidden')).toBe('');
  });

  it('does not create fold controls when the stored-fold getter destroys startup', async () => {
    const root = sourceRoot();
    const snapshot = storedGetter('source', () => {
      void destroyEnhancement(root);
    }, '["one"]');

    const result = await enhance(root, { storage: { snapshot }, storageKey: 'source' }).then(
      () => 'resolved',
      (error: unknown) => (typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : 'other'),
    );

    expect([result, root.querySelectorAll('.h-fold, .fold-note').length]).toEqual(['aborted', 0]);
  });

  for (const staleUse of ['section lookup', 'joining from chrome', 'beforematch'] as const) {
    it(`permanently retires a detached original observed through ${staleUse}`, async () => {
      const root = sourceRoot();
      const one = heading(root, 'one');
      const a = one.nextElementSibling as HTMLElement;
      const b = document.createElement('p');
      a.textContent = 'alpha '.repeat(230);
      b.textContent = 'beta '.repeat(344);
      a.after(b);
      const writes: [string, string | null][] = [];
      await enhance(root, { storageKey: 'source', storage: { snapshot: {}, set: (key, value) => { writes.push([key, value]); } } });
      const folds = contextOf(root)?.folds;
      if (folds === undefined) throw new Error('missing folds');
      folds.setFold(one, true);
      const writesBeforeStaleUse = writes.length;
      a.remove();

      if (staleUse === 'section lookup') {
        expect(folds.sectionOf(a)).toBeNull();
      } else if (staleUse === 'joining from chrome') {
        const chrome = document.createElement('aside');
        chrome.setAttribute('data-docreader-chrome', '');
        root.append(chrome);
        expect(folds.join(chrome, a)).toBe(false);
      } else {
        a.dispatchEvent(new Event('beforematch'));
        expect([one.classList.contains('folded'), writes.length, b.getAttribute('hidden')]).toEqual([true, writesBeforeStaleUse, 'until-found']);
      }

      a.removeAttribute('hidden');
      b.before(a);
      folds.setFold(one, false);
      folds.setFold(one, true);

      expect([
        folds.sectionOf(a),
        folds.sectionOf(b),
        a.getAttribute('hidden'),
        b.getAttribute('hidden'),
        foldNote(one).querySelector('.fn-m')?.textContent,
      ]).toEqual([null, one, null, 'until-found', '2 min']);
    });
  }

  it('refreshes frozen minutes when lookup retires a missing original', async () => {
    const root = sourceRoot();
    const one = heading(root, 'one');
    const a = one.nextElementSibling as HTMLElement;
    const b = document.createElement('p');
    a.textContent = 'alpha '.repeat(230);
    b.textContent = 'beta '.repeat(344);
    a.after(b);

    await enhance(root, { storageKey: 'source', storage: { snapshot: {} } });
    const folds = contextOf(root)?.folds;
    if (folds === undefined) throw new Error('missing folds');
    expect(foldNote(one).querySelector('.fn-m')?.textContent).toBe('3 min');
    a.remove();
    b.textContent = 'later '.repeat(1000);

    expect([folds.sectionOf(b), foldNote(one).querySelector('.fn-m')?.textContent]).toEqual([one, '2 min']);
  });

  it('captures after a pending preference write but before later feature getters', async () => {
    const root = sourceRoot();
    const one = heading(root, 'one');
    const original = one.nextElementSibling as HTMLElement;
    const lookalike = document.createElement('p');
    const snapshot: Record<string, string> = {};
    let preferenceWrites = 0;
    original.textContent = 'earlier '.repeat(230);
    Object.defineProperty(snapshot, 'docreader:prefs', {
      enumerable: true,
      get: () => {
        setEnhancementPrefs(root, { width: 'wide' });
        return '{}';
      },
    });
    Object.defineProperty(snapshot, docKey('source', 'marks'), {
      enumerable: true,
      get: () => {
        original.textContent = 'marks-later '.repeat(1000);
        lookalike.textContent = 'lookalike '.repeat(344);
        original.after(lookalike);
        return '{}';
      },
    });
    Object.defineProperty(snapshot, docKey('source', 'folds'), {
      enumerable: true,
      get: () => {
        original.textContent = 'folds-later '.repeat(1000);
        return '["one"]';
      },
    });

    await enhance(root, {
      storageKey: 'source',
      storage: {
        snapshot,
        set: (key) => {
          if (key !== 'docreader:prefs') return;
          preferenceWrites += 1;
          original.textContent = 'write-time '.repeat(344);
        },
      },
    });
    const folds = contextOf(root)?.folds;
    if (folds === undefined) throw new Error('missing folds');

    expect([
      preferenceWrites,
      root.getAttribute('data-width'),
      foldNote(one).querySelector('.fn-m')?.textContent,
      folds.sectionOf(original),
      original.getAttribute('hidden'),
      folds.sectionOf(lookalike),
      lookalike.getAttribute('hidden'),
    ]).toEqual([1, 'wide', '2 min', one, 'until-found', null, null]);
  });

  it('does not inherit a source association through a replacement wrapper', async () => {
    const root = sourceRoot();
    const one = heading(root, 'one');
    const a = one.nextElementSibling as HTMLElement;
    const b = document.createElement('p');
    const wrapper = document.createElement('div');
    const replacement = document.createElement('div');
    a.textContent = 'alpha '.repeat(230);
    b.textContent = 'beta '.repeat(344);
    a.after(b);
    const snapshot: Record<string, string> = {};
    Object.defineProperty(snapshot, docKey('source', 'marks'), {
      enumerable: true,
      get: () => {
        a.before(wrapper);
        wrapper.append(a);
        return '{}';
      },
    });
    Object.defineProperty(snapshot, docKey('source', 'folds'), {
      enumerable: true,
      get: () => {
        wrapper.before(replacement);
        replacement.append(a);
        wrapper.remove();
        return '["one"]';
      },
    });

    await enhance(root, { storageKey: 'source', storage: { snapshot } });
    const folds = contextOf(root)?.folds;
    if (folds === undefined) throw new Error('missing folds');
    const chrome = document.createElement('aside');
    chrome.setAttribute('data-docreader-chrome', '');
    root.append(chrome);

    expect([
      folds.sectionOf(a),
      folds.sectionOf(replacement),
      folds.join(chrome, a),
      a.getAttribute('hidden'),
      replacement.getAttribute('hidden'),
      folds.sectionOf(b),
      b.getAttribute('hidden'),
      foldNote(one).querySelector('.fn-m')?.textContent,
    ]).toEqual([null, null, false, null, null, one, 'until-found', '2 min']);
  });

  it('rejects a stale first joined anchor while its source stays live', async () => {
    const root = sourceRoot();
    const one = heading(root, 'one');
    const source = one.nextElementSibling as HTMLElement;
    const writes: [string, string | null][] = [];
    await enhance(root, { storageKey: 'source', storage: { snapshot: {}, set: (key, value) => { writes.push([key, value]); } } });
    const folds = contextOf(root)?.folds;
    if (folds === undefined) throw new Error('missing folds');
    const first = document.createElement('aside');
    const second = document.createElement('aside');
    const third = document.createElement('aside');
    for (const chrome of [first, second, third]) chrome.setAttribute('data-docreader-chrome', '');
    root.append(first, second, third);
    expect(folds.join(first, source)).toBe(true);
    expect(folds.join(second, first)).toBe(true);
    folds.setFold(one, true);
    const writesBeforeStaleUse = writes.length;
    first.remove();

    second.dispatchEvent(new Event('beforematch'));

    expect([
      one.classList.contains('folded'),
      writes.length,
      folds.sectionOf(second),
      folds.join(third, second),
    ]).toEqual([true, writesBeforeStaleUse, null, false]);
    source.dispatchEvent(new Event('beforematch'));
    expect([one.classList.contains('folded'), writes.length]).toEqual([false, writesBeforeStaleUse + 1]);
  });

  it('does not refresh a retained fold note after destruction begins', async () => {
    const root = sourceRoot();
    const one = heading(root, 'one');
    const a = one.nextElementSibling as HTMLElement;
    const b = document.createElement('p');
    a.textContent = 'alpha '.repeat(230);
    b.textContent = 'beta '.repeat(344);
    a.after(b);
    await enhance(root, { storageKey: 'source', storage: { snapshot: {} } });
    const ctx = contextOf(root);
    if (ctx === undefined) throw new Error('missing context');
    const folds = ctx.folds;
    const note = foldNote(one);
    const minutesBeforeDestroy = note.querySelector('.fn-m')?.textContent;
    let destroyed: Promise<void> | undefined;

    ctx.operate(() => {
      destroyed = destroyEnhancement(root);
      expect([ctx.live(), root.contains(note)]).toEqual([false, true]);
      a.remove();
      folds.sectionOf(b);
      expect(note.querySelector('.fn-m')?.textContent).toBe(minutesBeforeDestroy);
    });

    if (destroyed === undefined) throw new Error('missing destruction promise');
    await destroyed;
  });

  it('retires both sources when their detached exact presentation member is observed', async () => {
    const root = sourceRoot();
    const one = heading(root, 'one');
    const a = one.nextElementSibling as HTMLElement;
    const b = document.createElement('p');
    const wrapper = document.createElement('div');
    a.textContent = 'alpha '.repeat(230);
    b.textContent = 'beta '.repeat(344);
    a.after(b);
    const snapshot: Record<string, string> = {};
    Object.defineProperty(snapshot, docKey('source', 'marks'), {
      enumerable: true,
      get: () => {
        a.before(wrapper);
        wrapper.append(a, b);
        return '{}';
      },
    });
    snapshot[docKey('source', 'folds')] = '["one"]';

    await enhance(root, { storageKey: 'source', storage: { snapshot } });
    const folds = contextOf(root)?.folds;
    if (folds === undefined) throw new Error('missing folds');
    const note = foldNote(one);
    wrapper.remove();

    expect(folds.sectionOf(wrapper)).toBeNull();
    wrapper.removeAttribute('hidden');
    note.after(wrapper);
    folds.setFold(one, false);
    folds.setFold(one, true);

    expect([
      folds.sectionOf(a),
      folds.sectionOf(b),
      wrapper.getAttribute('hidden'),
      note.querySelector('.fn-m')?.textContent,
    ]).toEqual([null, null, null, undefined]);
  });

  for (const kind of ['deep element', 'deep text'] as const) {
    it(`retires a detached original observed through a ${kind}`, async () => {
      const root = sourceRoot();
      const one = heading(root, 'one');
      const a = one.nextElementSibling as HTMLElement;
      const b = document.createElement('p');
      const outer = document.createElement('span');
      const inner = document.createElement('em');
      const text = document.createTextNode('deep source');
      a.textContent = 'alpha '.repeat(230);
      inner.append(text);
      outer.append(inner);
      a.append(outer);
      b.textContent = 'beta '.repeat(344);
      a.after(b);
      await enhance(root, { storageKey: 'source', storage: { snapshot: {} } });
      const folds = contextOf(root)?.folds;
      if (folds === undefined) throw new Error('missing folds');
      folds.setFold(one, true);
      a.remove();

      expect(folds.sectionOf(kind === 'deep element' ? inner : text)).toBeNull();
      a.removeAttribute('hidden');
      b.before(a);
      folds.setFold(one, false);
      folds.setFold(one, true);

      expect([
        folds.sectionOf(a),
        folds.sectionOf(b),
        a.getAttribute('hidden'),
        b.getAttribute('hidden'),
        foldNote(one).querySelector('.fn-m')?.textContent,
      ]).toEqual([null, one, null, 'until-found', '2 min']);
    });
  }

  for (const observation of ['first invalid transfer', 'already retired transfer'] as const) {
    for (const firstQuery of ['source', 'descendant'] as const) {
      it(`does not transfer an original into another section after ${observation} through ${firstQuery}`, async () => {
        const root = sourceRoot();
        const one = heading(root, 'one');
        const two = heading(root, 'two');
        const a = one.nextElementSibling as HTMLElement;
        const b = document.createElement('p');
        const c = two.nextElementSibling as HTMLElement;
        const wrapper = document.createElement('div');
        const nested = document.createElement('span');
        a.textContent = 'alpha '.repeat(230);
        b.textContent = 'beta '.repeat(344);
        a.append(nested);
        a.after(b);
        const snapshot: Record<string, string> = {};
        Object.defineProperty(snapshot, docKey('source', 'marks'), {
          enumerable: true,
          get: () => {
            c.before(wrapper);
            wrapper.append(c);
            return '{}';
          },
        });
        snapshot[docKey('source', 'folds')] = '["one"]';

        await enhance(root, { storageKey: 'source', storage: { snapshot } });
        const folds = contextOf(root)?.folds;
        if (folds === undefined) throw new Error('missing folds');
        const observed = firstQuery === 'source' ? a : nested;
        if (observation === 'already retired transfer') {
          a.remove();
          expect(folds.sectionOf(observed)).toBeNull();
        }
        wrapper.append(a);

        expect(folds.sectionOf(observed)).toBeNull();
        expect([folds.sectionOf(a), folds.sectionOf(nested), folds.sectionOf(c)]).toEqual([null, null, two]);
        a.removeAttribute('hidden');
        b.before(a);
        folds.setFold(one, false);
        folds.setFold(one, true);

        expect([
          folds.sectionOf(a),
          folds.sectionOf(b),
          a.getAttribute('hidden'),
          b.getAttribute('hidden'),
          foldNote(one).querySelector('.fn-m')?.textContent,
        ]).toEqual([null, one, null, 'until-found', '2 min']);
      });
    }
  }

  it('retires a detached source before rejecting a duplicate joined target', async () => {
    const root = sourceRoot();
    const one = heading(root, 'one');
    const a = one.nextElementSibling as HTMLElement;
    const b = document.createElement('p');
    const joined = document.createElement('aside');
    a.textContent = 'alpha '.repeat(230);
    b.textContent = 'beta '.repeat(344);
    a.after(b);
    joined.setAttribute('data-docreader-chrome', '');
    await enhance(root, { storageKey: 'source', storage: { snapshot: {} } });
    const folds = contextOf(root)?.folds;
    if (folds === undefined) throw new Error('missing folds');
    root.append(joined);
    expect(folds.join(joined, b)).toBe(true);
    folds.setFold(one, true);
    a.remove();

    expect(folds.join(joined, a)).toBe(false);
    a.removeAttribute('hidden');
    b.before(a);
    folds.setFold(one, false);
    folds.setFold(one, true);

    expect([
      folds.sectionOf(a),
      folds.sectionOf(b),
      folds.sectionOf(joined),
      a.getAttribute('hidden'),
      b.getAttribute('hidden'),
      joined.getAttribute('hidden'),
      foldNote(one).querySelector('.fn-m')?.textContent,
    ]).toEqual([null, one, one, null, 'until-found', 'until-found', '2 min']);
  });

  for (const firstQuery of ['source', 'descendant'] as const) {
    it(`does not transfer a source discarded with its empty section through ${firstQuery}`, async () => {
      const root = sourceRoot();
      const one = heading(root, 'one');
      const two = heading(root, 'two');
      const a = one.nextElementSibling as HTMLElement;
      const c = two.nextElementSibling as HTMLElement;
      const nested = document.createElement('span');
      const wrapper = document.createElement('div');
      a.append(nested);
      const snapshot: Record<string, string> = {};
      Object.defineProperty(snapshot, docKey('source', 'marks'), {
        enumerable: true,
        get: () => {
          c.before(wrapper);
          wrapper.append(c);
          return '{}';
        },
      });
      Object.defineProperty(snapshot, docKey('source', 'folds'), {
        enumerable: true,
        get: () => {
          a.remove();
          return '[]';
        },
      });

      await enhance(root, { storageKey: 'source', storage: { snapshot } });
      const folds = contextOf(root)?.folds;
      if (folds === undefined) throw new Error('missing folds');
      wrapper.append(a);
      const observed = firstQuery === 'source' ? a : nested;

      expect(folds.sectionOf(observed)).toBeNull();
      expect([folds.sectionOf(a), folds.sectionOf(nested), folds.sectionOf(c)]).toEqual([null, null, two]);
    });
  }

  it('ignores a bubbling beforematch from a retired original in a live wrapper', async () => {
    const root = sourceRoot();
    const one = heading(root, 'one');
    const a = one.nextElementSibling as HTMLElement;
    const b = document.createElement('p');
    const wrapper = document.createElement('div');
    const nested = document.createElement('span');
    a.textContent = 'alpha '.repeat(230);
    a.append(nested);
    b.textContent = 'beta '.repeat(344);
    a.after(b);
    const writes: [string, string | null][] = [];
    const snapshot: Record<string, string> = {};
    Object.defineProperty(snapshot, docKey('source', 'marks'), {
      enumerable: true,
      get: () => {
        a.before(wrapper);
        wrapper.append(a, b);
        return '{}';
      },
    });
    Object.defineProperty(snapshot, docKey('source', 'folds'), {
      enumerable: true,
      get: () => {
        a.remove();
        return '["one"]';
      },
    });

    await enhance(root, { storageKey: 'source', storage: { snapshot, set: (key, value) => { writes.push([key, value]); } } });
    const folds = contextOf(root)?.folds;
    if (folds === undefined) throw new Error('missing folds');
    wrapper.append(a);
    const writesBeforeStaleEvent = writes.length;

    nested.dispatchEvent(new Event('beforematch', { bubbles: true }));

    expect([one.classList.contains('folded'), writes.length, foldNote(one).querySelector('.fn-m')?.textContent]).toEqual([true, writesBeforeStaleEvent, '2 min']);
    b.dispatchEvent(new Event('beforematch', { bubbles: true }));
    expect([one.classList.contains('folded'), writes.length]).toEqual([false, writesBeforeStaleEvent + 1]);
  });

  it('does not allow a retired original to become a newly inserted chrome node', async () => {
    const root = sourceRoot();
    const one = heading(root, 'one');
    const a = one.nextElementSibling as HTMLElement;
    const b = document.createElement('p');
    const wrapper = document.createElement('div');
    a.textContent = 'alpha '.repeat(230);
    b.textContent = 'beta '.repeat(344);
    a.after(b);
    const snapshot: Record<string, string> = {};
    Object.defineProperty(snapshot, docKey('source', 'marks'), {
      enumerable: true,
      get: () => {
        a.before(wrapper);
        wrapper.append(a, b);
        return '{}';
      },
    });
    await enhance(root, { storageKey: 'source', storage: { snapshot } });
    const folds = contextOf(root)?.folds;
    if (folds === undefined) throw new Error('missing folds');
    folds.setFold(one, true);
    a.remove();
    expect(folds.sectionOf(a)).toBeNull();
    a.setAttribute('data-docreader-chrome', '');
    a.removeAttribute('hidden');
    root.append(a);

    expect(folds.join(a, wrapper)).toBe(false);
    folds.setFold(one, false);
    folds.setFold(one, true);

    expect([
      folds.sectionOf(a),
      folds.sectionOf(b),
      a.getAttribute('hidden'),
      wrapper.getAttribute('hidden'),
      foldNote(one).querySelector('.fn-m')?.textContent,
    ]).toEqual([null, one, null, 'until-found', '2 min']);
  });

  it('retires a detached original observed through a detached joined descendant', async () => {
    const root = sourceRoot();
    const one = heading(root, 'one');
    const a = one.nextElementSibling as HTMLElement;
    const b = document.createElement('p');
    const first = document.createElement('aside');
    const second = document.createElement('aside');
    const nested = document.createElement('span');
    a.textContent = 'alpha '.repeat(230);
    b.textContent = 'beta '.repeat(344);
    a.after(b);
    first.append(nested);
    for (const chrome of [first, second]) chrome.setAttribute('data-docreader-chrome', '');
    await enhance(root, { storageKey: 'source', storage: { snapshot: {} } });
    const folds = contextOf(root)?.folds;
    if (folds === undefined) throw new Error('missing folds');
    root.append(first, second);
    expect(folds.join(first, a)).toBe(true);
    expect(folds.join(second, first)).toBe(true);
    folds.setFold(one, true);
    a.remove();
    first.remove();

    expect(folds.sectionOf(nested)).toBeNull();
    a.removeAttribute('hidden');
    first.removeAttribute('hidden');
    second.removeAttribute('hidden');
    b.before(a);
    root.append(first, second);
    folds.setFold(one, false);
    folds.setFold(one, true);

    expect([
      folds.sectionOf(a),
      folds.sectionOf(first),
      folds.sectionOf(second),
      folds.sectionOf(b),
      a.getAttribute('hidden'),
      first.getAttribute('hidden'),
      second.getAttribute('hidden'),
      b.getAttribute('hidden'),
      foldNote(one).querySelector('.fn-m')?.textContent,
    ]).toEqual([null, null, null, one, null, null, null, 'until-found', '2 min']);
  });

  it('keeps joined chrome detached from a live source out of lookup until restored', async () => {
    const root = sourceRoot();
    const one = heading(root, 'one');
    const a = one.nextElementSibling as HTMLElement;
    const b = document.createElement('p');
    const first = document.createElement('aside');
    const second = document.createElement('aside');
    const nested = document.createElement('span');
    a.textContent = 'alpha '.repeat(230);
    b.textContent = 'beta '.repeat(344);
    a.after(b);
    first.append(nested);
    for (const chrome of [first, second]) chrome.setAttribute('data-docreader-chrome', '');
    await enhance(root, { storageKey: 'source', storage: { snapshot: {} } });
    const folds = contextOf(root)?.folds;
    if (folds === undefined) throw new Error('missing folds');
    root.append(first, second);
    expect(folds.join(first, a)).toBe(true);
    expect(folds.join(second, first)).toBe(true);
    folds.setFold(one, true);
    first.remove();

    expect(folds.sectionOf(nested)).toBeNull();
    root.append(first);

    expect([
      folds.sectionOf(a),
      folds.sectionOf(first),
      folds.sectionOf(second),
      a.getAttribute('hidden'),
      first.getAttribute('hidden'),
      second.getAttribute('hidden'),
      b.getAttribute('hidden'),
      foldNote(one).querySelector('.fn-m')?.textContent,
    ]).toEqual([one, one, one, 'until-found', 'until-found', 'until-found', 'until-found', '3 min']);
  });

  for (const firstQuery of ['source', 'element descendant', 'text descendant'] as const) {
    it(`keeps an independently valid nested source through ${firstQuery}`, async () => {
      const root = sourceRoot();
      const one = heading(root, 'one');
      const two = heading(root, 'two');
      const a = one.nextElementSibling as HTMLElement;
      const b = two.nextElementSibling as HTMLElement;
      const wrapper = document.createElement('div');
      const staleNested = document.createElement('span');
      const validNested = document.createElement('span');
      const validText = document.createTextNode('valid deep source');
      a.textContent = 'alpha '.repeat(230);
      a.append(staleNested);
      b.textContent = 'beta '.repeat(344);
      validNested.append(validText);
      b.append(validNested);
      const writes: [string, string | null][] = [];
      const snapshot: Record<string, string> = {};
      Object.defineProperty(snapshot, docKey('source', 'marks'), {
        enumerable: true,
        get: () => {
          b.before(wrapper);
          wrapper.append(b);
          return '{}';
        },
      });
      Object.defineProperty(snapshot, docKey('source', 'folds'), {
        enumerable: true,
        get: () => {
          a.remove();
          return '["two"]';
        },
      });

      await enhance(root, { storageKey: 'source', storage: { snapshot, set: (key, value) => { writes.push([key, value]); } } });
      const folds = contextOf(root)?.folds;
      if (folds === undefined) throw new Error('missing folds');
      wrapper.append(a);
      a.append(b);
      const query = firstQuery === 'source' ? b : firstQuery === 'element descendant' ? validNested : validText;
      const writesBeforeLookup = writes.length;

      expect([folds.sectionOf(query), writes.length]).toEqual([two, writesBeforeLookup]);
      expect([folds.sectionOf(a), folds.sectionOf(staleNested), foldNote(two).querySelector('.fn-m')?.textContent]).toEqual([null, null, '2 min']);
    });
  }

  it('unfolds an independently valid nested source but ignores its retired outer source', async () => {
    const root = sourceRoot();
    const one = heading(root, 'one');
    const two = heading(root, 'two');
    const a = one.nextElementSibling as HTMLElement;
    const b = two.nextElementSibling as HTMLElement;
    const wrapper = document.createElement('div');
    const staleNested = document.createElement('span');
    const validNested = document.createElement('span');
    a.append(staleNested);
    b.textContent = 'beta '.repeat(344);
    b.append(validNested);
    const writes: [string, string | null][] = [];
    const snapshot: Record<string, string> = {};
    Object.defineProperty(snapshot, docKey('source', 'marks'), {
      enumerable: true,
      get: () => {
        b.before(wrapper);
        wrapper.append(b);
        return '{}';
      },
    });
    Object.defineProperty(snapshot, docKey('source', 'folds'), {
      enumerable: true,
      get: () => {
        a.remove();
        return '["two"]';
      },
    });

    await enhance(root, { storageKey: 'source', storage: { snapshot, set: (key, value) => { writes.push([key, value]); } } });
    const folds = contextOf(root)?.folds;
    if (folds === undefined) throw new Error('missing folds');
    wrapper.append(a);
    a.append(b);
    const writesBeforeStaleEvent = writes.length;

    staleNested.dispatchEvent(new Event('beforematch', { bubbles: true }));
    expect([two.classList.contains('folded'), writes.length]).toEqual([true, writesBeforeStaleEvent]);
    validNested.dispatchEvent(new Event('beforematch', { bubbles: true }));
    expect([two.classList.contains('folded'), writes.length, foldNote(two).querySelector('.fn-m')?.textContent]).toEqual([false, writesBeforeStaleEvent + 1, '2 min']);
  });

  it('handles a foreign-realm beforematch target inside a live source', async () => {
    const root = sourceRoot();
    const one = heading(root, 'one');
    const source = one.nextElementSibling as HTMLElement;
    const writes: [string, string | null][] = [];
    await enhance(root, { storageKey: 'source', storage: { snapshot: {}, set: (key, value) => { writes.push([key, value]); } } });
    const folds = contextOf(root)?.folds;
    if (folds === undefined) throw new Error('missing folds');
    const frame = document.createElement('iframe');
    document.body.append(frame);
    const foreign = frame.contentDocument?.createElement('span');
    const ForeignEvent = (frame.contentWindow as (Window & typeof globalThis) | null)?.Event;
    if (foreign === undefined || ForeignEvent === undefined) throw new Error('missing foreign realm');
    source.append(foreign);
    expect(foreign instanceof Node).toBe(false);
    folds.setFold(one, true);
    const writesBeforeEvent = writes.length;

    foreign.dispatchEvent(new ForeignEvent('beforematch', { bubbles: true }));

    expect([one.classList.contains('folded'), writes.length]).toEqual([false, writesBeforeEvent + 1]);
  });
});
