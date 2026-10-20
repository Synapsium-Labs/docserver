// @vitest-environment jsdom
// The lifecycle of `./enhance` (L2 prototype): ownership, the stored promise, startup and its rollback, destroy
// and its deferred teardown, conditional restore, and the journal it rests on. The fixtures are real render()
// output, parsed by the test and moved into a root; a subtree is compared before enhance and after destroy by its
// serialization (the tests read outerHTML; the library never touches it).
import { afterEach, describe, expect, it } from 'vitest';
import { destroyEnhancement, enhance, EnhanceError, setEnhancementPrefs, type EnhanceOptions } from '../src/enhance/index.js';
import { CHROME_ATTR, chrome, createJournal, siblingRun } from '../src/enhance/journal.js';
import { registrySize } from '../src/enhance/lifecycle.js';
import { render } from '../src/render/index.js';

const DOC = [
  '# Example spec',
  '',
  '## In short',
  '',
  '- One point.',
  '- Another point.',
  '',
  '## 1. Scope',
  '',
  'What this example covers, in a few words.',
  '',
  'A second paragraph.',
  '',
  '## 2. Design',
  '',
  'How it works.',
  '',
  '```js',
  'const a = 1;',
  '```',
  '',
  '## 3. Where things stand',
  '',
  '### Agreed',
  '',
  '- R1 is agreed.',
  '',
].join('\n');

const mounted: HTMLElement[] = [];

/** A host page: a wrapper div holding a root that holds the rendered document. */
function mount(md = DOC): HTMLElement {
  const r = render(md);
  const parsed = new DOMParser().parseFromString(`<!doctype html><body>${r.html}`, 'text/html');
  const host = document.createElement('div');
  host.className = 'host-page';
  const root = document.createElement('main');
  root.append(...Array.from(parsed.body.childNodes));
  host.append(root);
  document.body.append(host);
  mounted.push(root);
  return root;
}

afterEach(async () => {
  for (const root of mounted.splice(0)) await destroyEnhancement(root).catch(() => undefined);
  document.body.replaceChildren();
});

const chromeCount = (root: Element): number => root.querySelectorAll(`[${CHROME_ATTR}]`).length;

/** How a promise settled: 'resolved', an EnhanceError's code, or the other error's text. */
async function outcome(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return 'resolved';
  } catch (e) {
    return e instanceof EnhanceError ? e.code : `other: ${String(e)}`;
  }
}

describe('enhance: the layout exists when it resolves', () => {
  it('resolves after the root is marked, the prefs are on it and the fold controls exist', async () => {
    const root = mount();
    let seen: unknown[] = [];
    await enhance(root).then(() => {
      seen = [root.hasAttribute('data-docreader-root'), root.getAttribute('data-width'), root.getAttribute('data-font'), root.hasAttribute('data-theme'), root.querySelectorAll('button.h-fold').length];
    });
    expect(seen).toEqual([true, 'standard', 'serif', false, 3]); // "In short" sits in its box, with no fold
    expect(chromeCount(root)).toBeGreaterThan(0);
  });

  it('marks every element it creates with data-docreader-chrome', async () => {
    const root = mount();
    await enhance(root);
    const created = [...root.querySelectorAll('button, .h-ctl, .fold-note span')];
    expect(created.length).toBeGreaterThan(0);
    expect(created.filter((e) => !e.hasAttribute(CHROME_ATTR))).toEqual([]);
  });
});

describe('enhance: one owner per root', () => {
  it('the same options object returns the same promise, while initializing and once active', async () => {
    const root = mount();
    const options = { folds: true };
    const p = enhance(root, options);
    expect(enhance(root, options)).toBe(p);
    await p;
    expect(enhance(root, options)).toBe(p);
  });

  it('omitted options twice (or undefined) share one identity: the same promise', async () => {
    const root = mount();
    const p = enhance(root);
    expect(enhance(root)).toBe(p);
    expect(enhance(root, undefined)).toBe(p);
    await p;
  });

  it('a different options object rejects ownership, and so does {} against omitted', async () => {
    const root = mount();
    const p = enhance(root, {});
    expect(await outcome(enhance(root, {}))).toBe('ownership');
    expect(await outcome(enhance(root))).toBe('ownership');
    expect(await outcome(p)).toBe('resolved');
  });

  it('an enhanced root that contains this one rejects ownership', async () => {
    const root = mount();
    await enhance(root);
    const inner = root.querySelector('p') as HTMLElement;
    expect(await outcome(enhance(inner))).toBe('ownership');
  });

  it('an enhanced root inside this one rejects ownership', async () => {
    const root = mount();
    await enhance(root);
    const outer = root.parentElement as HTMLElement;
    expect(await outcome(enhance(outer))).toBe('ownership');
  });

  it('two sibling roots are independent', async () => {
    const a = mount();
    const b = mount();
    await Promise.all([enhance(a), enhance(b)]);
    await destroyEnhancement(a);
    expect(b.hasAttribute('data-docreader-root')).toBe(true);
    expect(a.hasAttribute('data-docreader-root')).toBe(false);
  });

  it('bad options reject invalid-options and reserve nothing: the root is untouched, and enhance(root) then works', async () => {
    const root = mount();
    const before = root.outerHTML;
    const bad: unknown[] = [
      null,
      'options',
      [],
      { nope: 1 },
      { prefs: { theme: 'blue' } },
      { prefs: { size: 'big' } },
      { prefs: 'dark' },
      { storageKey: '' },
      { storageKey: 7 },
      { folds: 'yes' },
      { signal: {} },
      { storage: null },
      { storage: 'local' },
      { info: { title: 1 } },
      { info: { frontList: [{ key: 1 }] } },
      { info: { other: 1 } },
    ];
    const codes = await Promise.all(bad.map((o) => outcome(enhance(root, o as never))));
    expect(codes).toEqual(bad.map(() => 'invalid-options'));
    expect(root.outerHTML).toBe(before);
    expect(await outcome(enhance(root))).toBe('resolved');
  });

  it('host code run while the options are read cannot make a second owner: the outer call rejects ownership', async () => {
    const root = mount();
    const before = root.outerHTML;
    // A Proxy's ownKeys trap runs while the options are read; here it enhances the same root first.
    let inner: Promise<void> | null = null;
    const same = new Proxy({}, { ownKeys: (t) => ((inner ??= enhance(root)), Reflect.ownKeys(t)) }) as EnhanceOptions;
    expect(await outcome(enhance(root, same))).toBe('ownership');
    expect(await outcome(inner as unknown as Promise<void>)).toBe('resolved');
    expect(root.querySelectorAll('button.h-fold').length).toBe(3);
    await destroyEnhancement(root);
    expect(root.outerHTML).toBe(before);
    // ... and here a root inside it.
    const p = root.querySelector('p') as HTMLElement;
    let innerP: Promise<void> | null = null;
    const around = new Proxy({}, { ownKeys: (t) => ((innerP ??= enhance(p)), Reflect.ownKeys(t)) }) as EnhanceOptions;
    expect(await outcome(enhance(root, around))).toBe('ownership');
    expect(await outcome(innerP as unknown as Promise<void>)).toBe('resolved');
    expect(root.hasAttribute('data-docreader-root')).toBe(false);
    await destroyEnhancement(p);
    expect(root.outerHTML).toBe(before);
  });

  it('options are own data properties: an inherited key is not read, an unknown own key is refused, a getter is refused unread', async () => {
    const root = mount();
    await enhance(root, Object.create({ folds: false, bogus: 1 }) as EnhanceOptions);
    expect(root.querySelectorAll('button.h-fold').length).toBe(3); // the inherited folds: false is not an option
    await destroyEnhancement(root);
    expect(await outcome(enhance(root, Object.defineProperty({}, 'bogus', { value: 1 }) as EnhanceOptions))).toBe('invalid-options');
    await enhance(root, Object.defineProperty({}, 'folds', { value: false }) as EnhanceOptions);
    expect(root.querySelectorAll('button.h-fold').length).toBe(0); // an own key is read, enumerable or not
    await destroyEnhancement(root);
    let called = false;
    const getter = {
      get folds(): boolean {
        called = true;
        return true;
      },
    };
    expect(await outcome(enhance(root, getter))).toBe('invalid-options');
    expect(called).toBe(false);
    expect(await outcome(enhance(root, { info: Object.create({ title: 'Inherited' }) as never }))).toBe('resolved');
    setEnhancementPrefs(root, Object.create({ theme: 'dark' }) as never);
    expect(root.hasAttribute('data-theme')).toBe(false);
  });

  it('a root that is not an element rejects invalid-options', async () => {
    expect(await outcome(enhance(null as never))).toBe('invalid-options');
    expect(await outcome(enhance(document.createTextNode('x') as never))).toBe('invalid-options');
  });
});

describe('destroyEnhancement', () => {
  it('restores the subtree exactly, after folds, a prefs change and a fold restored from storage', async () => {
    const root = mount();
    const before = root.outerHTML;
    const page = document.body.innerHTML;
    const snapshot = { 'docreader:doc:k:folds': '["2-design"]' };
    await enhance(root, { storage: { snapshot }, storageKey: 'k' });
    (root.querySelector('button.h-fold') as HTMLButtonElement).click();
    setEnhancementPrefs(root, { theme: 'dark', width: 'wide', font: 'sans' });
    expect(root.outerHTML).not.toBe(before);
    expect(root.querySelectorAll('[hidden="until-found"]').length).toBeGreaterThan(0);
    await destroyEnhancement(root);
    expect(root.outerHTML).toBe(before);
    expect(document.body.innerHTML).toBe(page);
  });

  it('repeated calls return the same promise, before and after the teardown', async () => {
    const root = mount();
    await enhance(root);
    const d = destroyEnhancement(root);
    expect(destroyEnhancement(root)).toBe(d);
    await d;
    expect(destroyEnhancement(root)).toBe(d);
  });

  it('a root never enhanced resolves', async () => {
    expect(await outcome(destroyEnhancement(document.createElement('div')))).toBe('resolved');
    expect(await outcome(destroyEnhancement(null as never))).toBe('resolved');
  });

  it('releases the root: it can be enhanced again, and a new destroy is a new promise', async () => {
    const root = mount();
    const before = root.outerHTML;
    await enhance(root);
    const d1 = destroyEnhancement(root);
    await d1;
    await enhance(root);
    expect(root.querySelectorAll('button.h-fold').length).toBe(3);
    const d2 = destroyEnhancement(root);
    expect(d2).not.toBe(d1);
    await d2;
    expect(root.outerHTML).toBe(before);
  });

  it('teardown releases the registry\'s hold on the instance', async () => {
    const root = mount();
    const held = registrySize(document);
    await enhance(root);
    expect(registrySize(document)).toBe(held + 1);
    await destroyEnhancement(root);
    expect(registrySize(document)).toBe(held);
  });

  it('a cleanup fault nobody awaits is no unhandled rejection', async () => {
    const root = mount();
    await enhance(root);
    Object.defineProperty(root, 'removeAttribute', {
      configurable: true,
      value: () => {
        throw new Error('host refuses');
      },
    });
    const seen: unknown[] = [];
    const onUnhandled = (reason: unknown): void => {
      seen.push(reason);
    };
    process.on('unhandledRejection', onUnhandled);
    try {
      void destroyEnhancement(root);
      await new Promise((r) => setTimeout(r, 30));
    } finally {
      process.off('unhandledRejection', onUnhandled);
      delete (root as unknown as Record<string, unknown>)['removeAttribute'];
    }
    expect(seen).toEqual([]);
  });

  it('a root moved to another document is still its instance\'s: enhance refuses a second owner, destroy tears it down', async () => {
    const root = mount();
    const before = root.outerHTML;
    await enhance(root);
    const other = document.implementation.createHTMLDocument('other');
    other.body.append(other.adoptNode(root));
    expect(await outcome(enhance(root, {}))).toBe('ownership');
    expect(await outcome(enhance(root.querySelector('p') as HTMLElement))).toBe('ownership');
    await destroyEnhancement(root);
    expect(chromeCount(root)).toBe(0);
    expect(root.outerHTML).toBe(before);
  });

  it('a cleanup fault rejects with an AggregateError after every other step ran, and the root is released', async () => {
    const root = mount();
    const before = root.outerHTML;
    await enhance(root);
    const fault = new Error('host refuses');
    Object.defineProperty(root, 'removeAttribute', {
      configurable: true,
      value: () => {
        throw fault;
      },
    });
    let err: unknown;
    await destroyEnhancement(root).catch((e: unknown) => {
      err = e;
    });
    delete (root as unknown as Record<string, unknown>)['removeAttribute'];
    expect(err).toBeInstanceOf(AggregateError);
    expect((err as AggregateError).errors.every((e) => e === fault)).toBe(true);
    expect(chromeCount(root)).toBe(0); // the other steps still ran
    expect(root.hasAttribute('data-docreader-root')).toBe(true); // the step that failed left its marker
    root.removeAttribute('data-docreader-root');
    root.removeAttribute('data-width');
    root.removeAttribute('data-font');
    expect(root.outerHTML).toBe(before);
    expect(await outcome(enhance(root))).toBe('resolved');
  });
});

describe('destroy or abort during startup', () => {
  it('an already aborted signal rejects aborted and reserves nothing', async () => {
    const root = mount();
    const before = root.outerHTML;
    const ctl = new AbortController();
    ctl.abort();
    expect(await outcome(enhance(root, { signal: ctl.signal }))).toBe('aborted');
    expect(root.outerHTML).toBe(before);
    expect(await outcome(enhance(root))).toBe('resolved');
  });

  it('an abort from a storage read mid-startup: enhance rejects aborted after the rollback, with the subtree restored', async () => {
    const root = mount();
    const before = root.outerHTML;
    const ctl = new AbortController();
    let chromeAtAbort = -1;
    const snapshot = {
      get 'docreader:doc:k:folds'(): string {
        chromeAtAbort = chromeCount(root);
        ctl.abort(new Error('host gave up'));
        return '[]';
      },
    };
    let restoredAtReject = false;
    let cause: unknown;
    const code = await enhance(root, { storage: { snapshot }, storageKey: 'k', signal: ctl.signal }).then(
      () => 'resolved',
      (e: unknown) => {
        restoredAtReject = root.outerHTML === before;
        cause = (e as Error).cause;
        return (e as EnhanceError).code;
      },
    );
    expect(chromeAtAbort).toBeGreaterThan(0); // there was something to roll back
    expect(code).toBe('aborted');
    expect(restoredAtReject).toBe(true);
    expect(String(cause)).toContain('host gave up');
    expect(await outcome(enhance(root))).toBe('resolved');
  });

  it('a storage hook that destroys mid-startup: teardown waits for the startup operation, then both promises settle after it', async () => {
    const root = mount();
    const before = root.outerHTML;
    let destroyed: Promise<void> | null = null;
    let chromeRightAfterDestroy = -1;
    const snapshot = {
      get 'docreader:doc:k:folds'(): string {
        destroyed = destroyEnhancement(root);
        chromeRightAfterDestroy = chromeCount(root);
        return '[]';
      },
    };
    const p = enhance(root, { storage: { snapshot }, storageKey: 'k' });
    // startup is synchronous: by now the hook ran, and the teardown ran when the startup operation unwound
    expect(chromeRightAfterDestroy).toBeGreaterThan(0);
    expect(chromeCount(root)).toBe(0);
    const order: string[] = [];
    const d = destroyed as unknown as Promise<void>;
    await Promise.all([
      d.then(() => order.push(`destroy resolved, restored=${String(root.outerHTML === before)}`)),
      p.catch((e: unknown) => order.push(`enhance ${(e as EnhanceError).code}, restored=${String(root.outerHTML === before)}`)),
    ]);
    expect(order.sort()).toEqual(['destroy resolved, restored=true', 'enhance aborted, restored=true']);
    expect(await outcome(enhance(root))).toBe('resolved');
  });

  it('enhance called back from a startup hook with the same options gets the original promise', async () => {
    const root = mount();
    let inner: Promise<void> | null = null;
    const options = {
      storage: {
        get snapshot(): Record<string, string> {
          inner = enhance(root, options);
          return {};
        },
      },
    };
    const p = enhance(root, options);
    expect(inner).toBe(p);
    await p;
  });

  it('a throw during startup rolls back, then rejects initialization with the cause', async () => {
    const root = mount();
    const before = root.outerHTML;
    const boom = new Error('host broke insertBefore');
    Object.defineProperty(root, 'insertBefore', {
      configurable: true,
      value: () => {
        throw boom;
      },
    });
    let restoredAtReject = false;
    let err: unknown;
    await enhance(root).catch((e: unknown) => {
      restoredAtReject = root.outerHTML === before;
      err = e;
    });
    delete (root as unknown as Record<string, unknown>)['insertBefore'];
    expect(err).toBeInstanceOf(EnhanceError);
    expect((err as EnhanceError).code).toBe('initialization');
    expect((err as Error).cause).toBe(boom);
    expect(restoredAtReject).toBe(true);
    expect(await outcome(enhance(root))).toBe('resolved');
  });

  it('a host signal that throws when listened to rejects initialization and releases the root', async () => {
    const root = mount();
    const before = root.outerHTML;
    const boom = new Error('host signal');
    const signal = {
      aborted: false,
      addEventListener: () => {
        throw boom;
      },
      removeEventListener: () => undefined,
    } as unknown as AbortSignal;
    let err: unknown;
    await enhance(root, { signal }).catch((e: unknown) => {
      err = e;
    });
    expect((err as EnhanceError).code).toBe('initialization');
    expect((err as Error).cause).toBe(boom);
    expect(root.outerHTML).toBe(before);
    expect(await outcome(enhance(root))).toBe('resolved');
  });

  it('enhance right after destroy, inside the old instance\'s operation, waits for its teardown, then builds', async () => {
    const root = mount();
    const before = root.outerHTML;
    let again: Promise<void> | null = null;
    let chromeWhenCalled = -1;
    const storage = {
      set(key: string, value: string | null): void {
        if (!key.endsWith(':folds') || value === null || again !== null) return;
        void destroyEnhancement(root);
        again = enhance(root);
        chromeWhenCalled = chromeCount(root);
      },
    };
    await enhance(root, { storage, storageKey: 'k' });
    (root.querySelector('button.h-fold') as HTMLButtonElement).click();
    expect(chromeWhenCalled).toBeGreaterThan(0); // the old chrome was still there: the new one could not have built
    expect(await outcome(again as unknown as Promise<void>)).toBe('resolved');
    expect(root.querySelectorAll('button.h-fold').length).toBe(3);
    expect(root.querySelectorAll('.folded').length).toBe(0);
    await destroyEnhancement(root);
    expect(root.outerHTML).toBe(before);
  });

  it('an abort while waiting for that teardown rejects aborted and writes nothing', async () => {
    const root = mount();
    const before = root.outerHTML;
    const ctl = new AbortController();
    let again: Promise<void> | null = null;
    const storage = {
      set(key: string, value: string | null): void {
        if (!key.endsWith(':folds') || value === null || again !== null) return;
        void destroyEnhancement(root);
        again = enhance(root, { signal: ctl.signal });
        ctl.abort();
      },
    };
    await enhance(root, { storage, storageKey: 'k' });
    (root.querySelector('button.h-fold') as HTMLButtonElement).click();
    expect(await outcome(again as unknown as Promise<void>)).toBe('aborted');
    expect(root.outerHTML).toBe(before);
  });
});

describe('after startup', () => {
  it('an abort after enhance has resolved does nothing: the layout stays and prefs still apply', async () => {
    const root = mount();
    const ctl = new AbortController();
    await enhance(root, { signal: ctl.signal });
    ctl.abort();
    expect(root.querySelectorAll('button.h-fold').length).toBe(3);
    setEnhancementPrefs(root, { theme: 'dark' });
    expect(root.getAttribute('data-theme')).toBe('dark');
  });

  it('prefs set while startup waits for an earlier teardown apply once it builds', async () => {
    const root = mount();
    let again: Promise<void> | null = null;
    const storage = {
      set(key: string, value: string | null): void {
        if (!key.endsWith(':folds') || value === null || again !== null) return;
        void destroyEnhancement(root);
        again = enhance(root);
        setEnhancementPrefs(root, { theme: 'dark', font: 'sans' });
      },
    };
    await enhance(root, { storage, storageKey: 'k' });
    (root.querySelector('button.h-fold') as HTMLButtonElement).click();
    expect(await outcome(again as unknown as Promise<void>)).toBe('resolved');
    expect([root.getAttribute('data-theme'), root.getAttribute('data-font')]).toEqual(['dark', 'sans']);
  });
});

describe('the knot: destroy in the middle of a fold action', () => {
  it('no write follows the destroy call, the teardown runs as the action unwinds, and destroy resolves after it with the subtree restored', async () => {
    const root = mount();
    const before = root.outerHTML;
    const obs = new MutationObserver(() => undefined);
    let destroyed: Promise<void> | null = null;
    let again: Promise<void> | null = null;
    let chromeAtDestroy = -1;
    const storage = {
      set(key: string, value: string | null): void {
        if (!key.endsWith(':folds') || value === null) return;
        obs.takeRecords(); // everything before the destroy call is allowed
        destroyed = destroyEnhancement(root);
        again = destroyEnhancement(root); // while the teardown waits: the same promise
        chromeAtDestroy = chromeCount(root);
      },
    };
    await enhance(root, { storage, storageKey: 'k' });
    obs.observe(root, { subtree: true, childList: true, attributes: true, characterData: true });
    const btn = root.querySelector('button.h-fold') as HTMLButtonElement;
    const heading = btn.closest('h2') as HTMLElement;
    btn.click();
    const afterDestroy = obs.takeRecords();
    obs.disconnect();

    expect(again).toBe(destroyed);
    expect(chromeAtDestroy).toBeGreaterThan(0); // deferred: still in place right after the call
    expect(chromeCount(root)).toBe(0); // torn down when the click handler unwound
    // The fold never reached the DOM: no hidden or class write, and nothing on the button.
    const illegal = afterDestroy.filter(
      (r) => (r.type === 'attributes' && (r.attributeName === 'hidden' || r.attributeName === 'class' || r.attributeName === 'aria-expanded')) || r.target === btn,
    );
    expect(illegal).toEqual([]);
    expect(heading.classList.contains('folded')).toBe(false);
    let restoredAtResolve = false;
    await (destroyed as unknown as Promise<void>).then(() => {
      restoredAtResolve = root.outerHTML === before;
    });
    expect(restoredAtResolve).toBe(true);
  });

  it('a host capture listener that destroys before the fold handler: the handler does nothing', async () => {
    const root = mount();
    const before = root.outerHTML;
    await enhance(root);
    const btn = root.querySelector('button.h-fold') as HTMLButtonElement;
    root.addEventListener('click', () => void destroyEnhancement(root), { capture: true, once: true });
    btn.click();
    expect(root.outerHTML).toBe(before);
  });
});

describe('conditional restore: the host wins', () => {
  it('an attribute the host changed after the library wrote it keeps the host value', async () => {
    const root = mount();
    await enhance(root);
    root.setAttribute('data-width', 'host-choice');
    await destroyEnhancement(root);
    expect(root.getAttribute('data-width')).toBe('host-choice');
    expect(root.hasAttribute('data-font')).toBe(false);
    expect(root.hasAttribute('data-docreader-root')).toBe(false);
  });

  it('a class the host added beside the library\'s is kept; the library\'s is removed', async () => {
    const root = mount();
    await enhance(root);
    const btn = root.querySelector('button.h-fold') as HTMLButtonElement;
    const heading = btn.closest('h2') as HTMLElement;
    btn.click();
    heading.classList.add('host-mark');
    await destroyEnhancement(root);
    expect(heading.getAttribute('class')).toBe('host-mark');
  });

  it('a class the host removed after the library added it stays removed', async () => {
    const root = mount();
    await enhance(root);
    const btn = root.querySelector('button.h-fold') as HTMLButtonElement;
    const heading = btn.closest('h2') as HTMLElement;
    btn.click();
    heading.classList.remove('folded');
    heading.classList.add('folded-by-host');
    await destroyEnhancement(root);
    expect(heading.getAttribute('class')).toBe('folded-by-host');
  });

  it('a class the library put back as it was, then the host changed, keeps the host value', async () => {
    const root = mount();
    await enhance(root);
    const btn = root.querySelector('button.h-fold') as HTMLButtonElement;
    const heading = btn.closest('h2') as HTMLElement;
    btn.click();
    btn.click(); // unfolded again: the library's last write equals the original (no 'folded')
    heading.classList.add('folded'); // the host uses the same class name for its own reason
    await destroyEnhancement(root);
    expect(heading.getAttribute('class')).toBe('folded');
  });

  it('a class attribute is restored byte for byte when nothing else changed', async () => {
    const root = mount();
    const heading = root.querySelector('h2:nth-of-type(2)') as HTMLElement;
    heading.setAttribute('class', '  a\tb  ');
    const before = root.outerHTML;
    await enhance(root);
    (heading.querySelector('button.h-fold') as HTMLButtonElement).click();
    expect(heading.classList.contains('folded')).toBe(true);
    await destroyEnhancement(root);
    expect(root.outerHTML).toBe(before);
  });
});

describe('the journal', () => {
  /** A parent holding a, text, b, text, c. */
  function siblings(): { parent: HTMLElement; a: Element; b: Element; c: Element; t1: Text; t2: Text } {
    const parent = document.createElement('div');
    const [a, b, c] = ['a', 'b', 'c'].map((id) => {
      const p = document.createElement('p');
      p.textContent = id;
      return p;
    }) as unknown as [Element, Element, Element];
    const t1 = document.createTextNode('\n');
    const t2 = document.createTextNode('\n');
    parent.append(a, t1, b, t2, c);
    return { parent, a, b, c, t1, t2 };
  }

  it('wrap moves a run into the wrapper; undo puts it back, with a node the host inserted inside kept in place', () => {
    const { parent, a, b, c, t1, t2 } = siblings();
    const before = parent.outerHTML;
    const { journal, undoAll } = createJournal(() => true, (fn) => fn());
    const box = chrome(document, 'div', { className: 'box' });
    journal.wrap(siblingRun(a, c), box);
    expect([...parent.childNodes]).toEqual([box, c]);
    expect([...box.childNodes]).toEqual([a, t1, b, t2]);
    const hostNode = document.createElement('aside');
    box.insertBefore(hostNode, t2);
    expect(undoAll()).toEqual([]);
    expect([...parent.childNodes]).toEqual([a, t1, b, hostNode, t2, c]);
    hostNode.remove();
    expect(parent.outerHTML).toBe(before);
  });

  it('wrap refuses a run that is not adjacent siblings in order, or a wrapper already placed', () => {
    const { a, b, c } = siblings();
    const { journal } = createJournal(() => true, (fn) => fn());
    expect(() => journal.wrap([a, b], chrome(document, 'div'))).toThrow(/adjacent/);
    expect(() => journal.wrap([c, a], chrome(document, 'div'))).toThrow(/adjacent/);
    const placed = chrome(document, 'div');
    document.body.append(placed);
    expect(() => journal.wrap([a], placed)).toThrow(/new chrome wrapper/);
  });

  it('insert takes only a new node, and undo removes it wherever it went', () => {
    const { parent, a, c } = siblings();
    const { journal, undoAll } = createJournal(() => true, (fn) => fn());
    expect(() => journal.insert(a, parent, null)).toThrow(/new chrome node/);
    const note = chrome(document, 'span', { text: 'note' });
    journal.insert(note, parent, a);
    c.append(note); // the host moved it
    undoAll();
    expect(note.parentNode).toBeNull();
  });

  it('every write refuses once the instance is not live', () => {
    const { parent, a } = siblings();
    let live = true;
    const { journal, undoAll } = createJournal(() => live, (fn) => fn());
    live = false;
    const before = parent.outerHTML;
    journal.setAttribute(a, 'data-x', '1');
    journal.toggleClass(a, 'k', true);
    journal.insert(chrome(document, 'span'), parent, null);
    journal.wrap([a], chrome(document, 'div'));
    let ran = false;
    journal.defer(() => {
      ran = true;
    });
    expect(parent.outerHTML).toBe(before);
    expect(undoAll()).toEqual([]);
    expect(ran).toBe(false);
  });

  it('undo attempts every entry in reverse even when one throws, and returns the faults', () => {
    const { a } = siblings();
    const { journal, undoAll } = createJournal(() => true, (fn) => fn());
    const order: string[] = [];
    journal.setAttribute(a, 'data-x', '1');
    journal.defer(() => order.push('first'));
    journal.defer(() => {
      throw new Error('second fails');
    });
    journal.defer(() => order.push('third'));
    const faults = undoAll();
    expect(order).toEqual(['third', 'first']);
    expect(faults.map(String)).toEqual(['Error: second fails']);
    expect(a.hasAttribute('data-x')).toBe(false);
  });

  it('listen runs the handler through operate, and undo removes the listener', () => {
    const { a } = siblings();
    const ops: string[] = [];
    const { journal, undoAll } = createJournal(
      () => true,
      (fn) => {
        ops.push('operate');
        fn();
      },
    );
    journal.listen(a, 'ping', () => ops.push('handler'));
    a.dispatchEvent(new Event('ping'));
    undoAll();
    a.dispatchEvent(new Event('ping'));
    expect(ops).toEqual(['operate', 'handler']);
  });
});
