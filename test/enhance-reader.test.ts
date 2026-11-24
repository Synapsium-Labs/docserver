// @vitest-environment jsdom
// Reader mode, the reader's half (LX6.1; src/enhance/reader.ts): setEnhancementReading switches the root in place (data-reading, the
// rail's class off and back, the same elements), an unknown mode changes nothing, `reading` is an event; onReader gets the acts of
// `r`, Escape and a sideways scroll, and a figure's pan and zoom, and gates the keys and the keys sheet; the frame's own pacing is
// test/reader-ops.test.ts's. What the stylesheet does to the chrome is test/browser/frame-reader.test.ts's (a real engine).
import { afterEach, describe, expect, it } from 'vitest';
import { READER_ACTS as WIRE_ACTS, READING_MODES as WIRE_MODES } from '../src/frame/protocol.js';
import { destroyEnhancement, enhance, setEnhancementReading } from '../src/enhance/index.js';
import { contextOf } from '../src/enhance/lifecycle.js';
import { READER_ACTS, READING_MODES } from '../src/enhance/reader.js';
import { render } from '../src/render/index.js';

const DOC = ['# Reader mode', '', '## 1. One', '', 'Text.', '', '## 2. Two', '', 'Text.', '', '## 3. Three', '', 'Text.'].join('\n');
const TABLE = '| A | B |\n|---|---|\n| 1 | 2 |\n';
const FIGURE = [
  '<figure class="mermaid-figure"><pre class="mermaid">flowchart LR\n  A --> B</pre><pre class="mermaid" data-docreader-chrome>',
  '<svg id="reader-source" viewBox="0 0 240 100"><g class="node dnode" id="flowchart-A-0"><rect width="80" height="30"/></g></svg>',
  '</pre><figcaption>Figure 1. A path.</figcaption></figure>',
].join('');

const mounted: HTMLElement[] = [];

function mount(md = DOC, extra = ''): HTMLElement {
  const parsed = new DOMParser().parseFromString(`<!doctype html><body>${render(md).html}${extra}`, 'text/html');
  const root = document.createElement('main');
  root.append(...Array.from(parsed.body.childNodes).map((n) => document.importNode(n, true)));
  document.body.append(root);
  mounted.push(root);
  return root;
}

afterEach(async () => {
  for (const root of mounted.splice(0)) await destroyEnhancement(root).catch(() => undefined);
  document.body.replaceChildren();
});

/** Enhance with an `onReader` that records its acts. */
async function reading(over: Record<string, unknown> = {}, md = DOC, extra = ''): Promise<{ root: HTMLElement; acts: string[] }> {
  const root = mount(md, extra);
  const acts: string[] = [];
  await enhance(root, { onReader: (act: string) => void acts.push(act), copy: () => undefined, ...over } as never);
  return { root, acts };
}

const key = (target: EventTarget, k: string, init: KeyboardEventInit = {}): KeyboardEvent => {
  const e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(e);
  return e;
};

describe('the wire twins', () => {
  it('the reader keeps the modes and the acts of the frame wire, in the same order', () => {
    expect([...READING_MODES]).toEqual([...WIRE_MODES]);
    expect([...READER_ACTS]).toEqual([...WIRE_ACTS]);
  });
});

describe('setEnhancementReading: in place, with no remount (default layout)', () => {
  it('data-reading follows the mode, and off takes it away', async () => {
    const { root } = await reading();
    expect(root.hasAttribute('data-reading')).toBe(false);
    setEnhancementReading(root, 'screens');
    expect(root.getAttribute('data-reading')).toBe('screens');
    setEnhancementReading(root, 'scroll');
    expect(root.getAttribute('data-reading')).toBe('scroll');
    setEnhancementReading(root, 'off');
    expect(root.hasAttribute('data-reading')).toBe(false);
  });

  it('an unknown mode changes nothing, and neither throws nor emits', async () => {
    const { root } = await reading();
    const ctx = contextOf(root);
    const heard: string[] = [];
    ctx?.events.on('reading', (m) => heard.push(m));
    setEnhancementReading(root, 'screens');
    for (const bad of ['pages', 'Screens', '', 'toString', 1, null, undefined, {}, ['off']]) expect(() => setEnhancementReading(root, bad), String(bad)).not.toThrow();
    expect(root.getAttribute('data-reading')).toBe('screens');
    expect(ctx?.reader.mode()).toBe('screens');
    expect(heard).toEqual(['screens']);
  });

  it("the 'reading' event carries each change once, never the same mode twice running", async () => {
    const { root } = await reading();
    const heard: string[] = [];
    contextOf(root)?.events.on('reading', (m) => heard.push(m));
    for (const m of ['screens', 'screens', 'scroll', 'scroll', 'off', 'off']) setEnhancementReading(root, m);
    expect(heard).toEqual(['screens', 'scroll', 'off']);
  });

  it('the same elements stay: the bar, the progress line, the rail and the settings button are not replaced (no remount)', async () => {
    const { root } = await reading({}, `${DOC}\n\n## 4. Four\n\nText.\n\n## 5. Five\n\nText.\n`);
    const names = ['.topbar', '.doc-progress', '.doc-toc', '.aa-btn', '.running-head'];
    const before = names.map((n) => root.querySelector(n));
    expect(before.every((el) => el !== null)).toBe(true);
    setEnhancementReading(root, 'screens');
    setEnhancementReading(root, 'off');
    expect(names.map((n) => root.querySelector(n)).every((el, i) => el === before[i])).toBe(true);
    expect(before.every((el) => el?.isConnected === true)).toBe(true);
  });

  it("the rail's has-toc class is taken off while reader mode is on, and put back by off; a root that never had it is left alone", async () => {
    const { root } = await reading({}, `${DOC}\n\n## 4. Four\n\nText.\n\n## 5. Five\n\nText.\n`);
    expect(root.classList.contains('has-toc')).toBe(true);
    setEnhancementReading(root, 'screens');
    expect(root.classList.contains('has-toc')).toBe(false);
    setEnhancementReading(root, 'scroll');
    expect(root.classList.contains('has-toc')).toBe(false);
    setEnhancementReading(root, 'off');
    expect(root.classList.contains('has-toc')).toBe(true);
    const bare = await reading({ chrome: { rail: false } });
    expect(bare.root.classList.contains('has-toc')).toBe(false);
    setEnhancementReading(bare.root, 'screens');
    setEnhancementReading(bare.root, 'off');
    expect(bare.root.classList.contains('has-toc')).toBe(false);
  });

  it('the rail class is read again at each entry from off: a root that lost it between two sessions does not get it back', async () => {
    const { root } = await reading({}, `${DOC}\n\n## 4. Four\n\nText.\n\n## 5. Five\n\nText.\n`);
    setEnhancementReading(root, 'screens');
    setEnhancementReading(root, 'off');
    expect(root.classList.contains('has-toc')).toBe(true);
    root.classList.remove('has-toc'); // a layout took the rail away while reader mode was off
    setEnhancementReading(root, 'screens');
    setEnhancementReading(root, 'off');
    expect(root.classList.contains('has-toc')).toBe(false);
  });

  it('after a destroy the service is dead: set keeps the mode it had, and act says no and tells the host nothing', async () => {
    const { root, acts } = await reading();
    const r = contextOf(root)?.reader;
    setEnhancementReading(root, 'screens');
    await destroyEnhancement(root);
    acts.length = 0;
    r?.set('scroll');
    expect(r?.mode()).toBe('screens');
    expect(r?.act('menu')).toBe(false);
    expect(r?.act('active')).toBe(false);
    expect(acts).toEqual([]);
  });

  it('destroy puts everything back: no data-reading and the rail class as the first build left it', async () => {
    const { root } = await reading({}, `${DOC}\n\n## 4. Four\n\nText.\n\n## 5. Five\n\nText.\n`);
    setEnhancementReading(root, 'screens');
    await destroyEnhancement(root);
    expect(root.hasAttribute('data-reading')).toBe(false);
    expect(root.classList.contains('has-toc')).toBe(false);
    expect(() => setEnhancementReading(root, 'screens')).not.toThrow();
    expect(root.hasAttribute('data-reading')).toBe(false);
  });

  it('a call made before the root is enhanced does nothing; one made while it starts is applied once it has started', async () => {
    const early = mount();
    expect(() => setEnhancementReading(early, 'screens')).not.toThrow();
    expect(early.hasAttribute('data-reading')).toBe(false);
    const root = mount();
    const started = enhance(root, { onReader: () => undefined });
    setEnhancementReading(root, 'scroll');
    await started;
    expect(root.getAttribute('data-reading')).toBe('scroll');
    expect(contextOf(root)?.reader.mode()).toBe('scroll');
  });

  it("a mode asked for while a rail-building document starts leaves the rail class off (the latest call wins), and off gives it back without a remount", async () => {
    const root = mount(`${DOC}\n\n## 4. Four\n\nText.\n\n## 5. Five\n\nText.\n`);
    // A remount made from the host's own callback: the destroy waits for the callback to unwind, so the new enhance() starts
    // behind it, with no context yet, and the host's calls in between are kept (the newest wins).
    let started: Promise<void> | null = null;
    await enhance(root, {
      onReader: () => {
        void destroyEnhancement(root);
        started = enhance(root, { onReader: () => undefined });
        expect(contextOf(root)?.reader, 'the new enhance() has built nothing yet').toBeUndefined();
        setEnhancementReading(root, 'screens');
        setEnhancementReading(root, 'scroll');
      },
    });
    key(root, 'r');
    await started;
    expect(contextOf(root)?.reader.mode()).toBe('scroll');
    expect(root.getAttribute('data-reading')).toBe('scroll');
    expect(root.querySelector('.doc-toc'), 'the rail was built').not.toBeNull();
    expect(root.classList.contains('has-toc'), 'reader mode started: no rail padding').toBe(false);
    const rail = root.querySelector('.doc-toc');
    setEnhancementReading(root, 'off');
    expect(root.classList.contains('has-toc')).toBe(true);
    expect(root.querySelector('.doc-toc')).toBe(rail);
    setEnhancementReading(root, 'screens');
    expect(root.classList.contains('has-toc')).toBe(false);
  });

  it('every layout shares it: the reader service is part of every instance (ctx.reader)', async () => {
    const { root } = await reading();
    const r = contextOf(root)?.reader;
    expect(typeof r?.mode).toBe('function');
    expect(r?.mode()).toBe('off');
  });
});

describe('the keys: r and Escape, only with onReader (default layout)', () => {
  it('r sends toggle while the mode is off and exit while it is on', async () => {
    const { root, acts } = await reading();
    const e = key(root, 'r');
    expect(acts).toEqual(['toggle']);
    expect(e.defaultPrevented).toBe(true);
    setEnhancementReading(root, 'screens');
    key(root, 'r');
    setEnhancementReading(root, 'scroll');
    key(root, 'r');
    expect(acts).toEqual(['toggle', 'exit', 'exit']);
  });

  it('Escape with no overlay open sends exit while the mode is on, and nothing while it is off', async () => {
    const { root, acts } = await reading();
    key(root, 'Escape');
    expect(acts).toEqual([]);
    setEnhancementReading(root, 'screens');
    key(root, 'Escape');
    expect(acts).toEqual(['exit']);
  });

  it('Escape with the quick jump open closes the jump and sends nothing; the next Escape sends exit', async () => {
    const many = ['# Reader mode', ...Array.from({ length: 12 }, (_, i) => `\n## ${String(i + 1)}. Section ${String(i + 1)}\n\nText.\n`)].join('\n');
    const { root, acts } = await reading({}, many);
    setEnhancementReading(root, 'screens');
    const ctx = contextOf(root);
    expect(ctx?.commands.run('jump')).toBe(true);
    expect(ctx?.overlays.isOpen('jump')).toBe(true);
    key(root, 'Escape');
    expect(ctx?.overlays.isOpen('jump')).toBe(false);
    expect(acts).toEqual([]);
    key(root, 'Escape');
    expect(acts).toEqual(['exit']);
  });

  it('Escape with the keys sheet or the settings menu open closes it and sends nothing (any overlay of the frame)', async () => {
    const { root, acts } = await reading();
    setEnhancementReading(root, 'screens');
    const ctx = contextOf(root);
    key(root, '?');
    expect(ctx?.overlays.isOpen('keys')).toBe(true);
    key(root, 'Escape');
    expect(ctx?.overlays.any()).toBe(false);
    ctx?.commands.run('settings');
    expect(ctx?.overlays.isOpen('settings')).toBe(true);
    key(root, 'Escape');
    expect(ctx?.overlays.any()).toBe(false);
    expect(acts).toEqual([]);
  });

  it('r and Escape are left alone in a field, with Ctrl, Cmd or Alt, with Shift (R), and with keyboard: false', async () => {
    const { root, acts } = await reading();
    setEnhancementReading(root, 'screens');
    const field = document.createElement('input');
    root.append(field);
    key(field, 'r');
    key(field, 'Escape');
    for (const mod of [{ ctrlKey: true }, { metaKey: true }, { altKey: true }]) {
      key(root, 'r', mod);
      key(root, 'Escape', mod);
    }
    key(root, 'R', { shiftKey: true });
    expect(acts).toEqual([]);
    const off = await reading({ keyboard: false });
    setEnhancementReading(off.root, 'screens');
    key(off.root, 'r');
    key(off.root, 'Escape');
    expect(off.acts).toEqual([]);
  });

  it('with no onReader r stays unbound and is not on the keys sheet; Escape sends nothing', async () => {
    const root = mount();
    await enhance(root, { copy: () => undefined });
    setEnhancementReading(root, 'screens');
    const e = key(root, 'r');
    expect(e.defaultPrevented).toBe(false);
    expect(contextOf(root)?.keys.bindings().some((b) => b.key === 'r')).toBe(false);
    key(root, '?');
    expect([...root.querySelectorAll('.keys dt kbd')].map((k) => k.textContent)).not.toContain('r');
    expect(contextOf(root)?.reader.act('exit')).toBe(false);
  });

  it('the keys sheet lists r, with Reader mode as its label, once onReader is given; Escape is listed once, as Close', async () => {
    const { root } = await reading();
    key(root, '?');
    const rows = [...root.querySelectorAll('.keys dl dt')].map((dt) => [dt.textContent, dt.nextElementSibling?.textContent]);
    expect(rows).toContainEqual(['r', 'Reader mode']);
    expect(rows.filter(([k]) => k === 'Esc')).toEqual([['Esc', 'Close']]);
  });
});

describe('act: the host hears onReader, never while it is not given (default layout)', () => {
  it('menu, exit and toggle go through in any mode; active only while the mode is not off', async () => {
    const { root, acts } = await reading();
    const r = contextOf(root)?.reader;
    for (const a of ['menu', 'exit', 'toggle', 'active'] as const) r?.act(a);
    expect(acts).toEqual(['menu', 'exit', 'toggle']);
    setEnhancementReading(root, 'scroll');
    expect(r?.act('active')).toBe(true);
    expect(acts.at(-1)).toBe('active');
  });

  it('a throw of the host is contained', async () => {
    const root = mount();
    await enhance(root, {
      onReader: () => {
        throw new Error('boom');
      },
    });
    expect(() => contextOf(root)?.reader.act('menu')).not.toThrow();
  });
});

describe('active: a box scrolled sideways while reader mode is on, and a figure panned or zoomed in full screen (default layout)', () => {
  /** A table block whose box scrolls sideways (jsdom lays nothing out: the widths are the test's). */
  function sideways(root: HTMLElement): HTMLElement {
    const box = root.querySelector('.table-wrapper') ?? root.querySelector('table')?.parentElement;
    if (box === null || box === undefined) throw new Error('no table box');
    Object.defineProperty(box, 'scrollWidth', { configurable: true, value: 900 });
    Object.defineProperty(box, 'clientWidth', { configurable: true, value: 300 });
    return box as HTMLElement;
  }
  const scroll = (el: EventTarget): void => void el.dispatchEvent(new Event('scroll'));

  it('a table scrolled sideways sends active while reader mode is on, and nothing while it is off', async () => {
    const { root, acts } = await reading({}, `${DOC}\n\n${TABLE}`);
    const box = sideways(root);
    scroll(box);
    expect(acts).toEqual([]);
    setEnhancementReading(root, 'screens');
    scroll(box);
    expect(acts).toEqual(['active']);
    setEnhancementReading(root, 'off');
    scroll(box);
    expect(acts).toEqual(['active']);
  });

  it('a code block too, and a scroll of a box that does not overflow sideways (or of the root itself) is not sideways reading', async () => {
    const { root, acts } = await reading({}, `${DOC}\n\n\`\`\`ts\nconst a = 1;\n\`\`\`\n\n${TABLE}`);
    setEnhancementReading(root, 'screens');
    const code = root.querySelector('pre') as HTMLElement;
    Object.defineProperty(code, 'scrollWidth', { configurable: true, value: 900 });
    Object.defineProperty(code, 'clientWidth', { configurable: true, value: 300 });
    scroll(code);
    expect(acts).toEqual(['active']);
    const flat = root.querySelector('table') as HTMLElement;
    scroll(flat);
    // The root itself, even when it overflows sideways, is the page's scroll and not a block's.
    Object.defineProperty(root, 'scrollWidth', { configurable: true, value: 900 });
    Object.defineProperty(root, 'clientWidth', { configurable: true, value: 300 });
    scroll(root);
    expect(acts).toEqual(['active']);
  });

  it('a host with no onReader hears nothing and the scroll costs nothing', async () => {
    const root = mount(`${DOC}\n\n${TABLE}`);
    await enhance(root, { copy: () => undefined });
    setEnhancementReading(root, 'screens');
    expect(() => scroll(sideways(root))).not.toThrow();
  });

  it("a figure's full screen: a wheel pan, a zoom button and a drag each send active while reader mode is on, and none while it is off", async () => {
    const { root, acts } = await reading({}, DOC, FIGURE);
    const open = (): void => void Array.from(root.querySelectorAll('button')).find((b) => b.textContent === 'Full screen')?.click();
    open();
    const stage = root.querySelector('.fig-overlay .fo-stage, .fig-overlay [class*="stage"]') as HTMLElement | null;
    const target = stage ?? (root.querySelector('.fig-overlay') as HTMLElement);
    const wheel = (): void => void target.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaX: 12, deltaY: 8 }));
    acts.length = 0;
    wheel();
    (root.querySelector('.fo-in') as HTMLButtonElement).click();
    expect(acts).toEqual([]); // off: the figure's tools say nothing
    setEnhancementReading(root, 'screens');
    wheel();
    expect(acts).toEqual(['active']);
    (root.querySelector('.fo-in') as HTMLButtonElement).click();
    expect(acts).toEqual(['active', 'active']);
    target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 1, pointerType: 'touch', clientX: 10, clientY: 10 }));
    target.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, cancelable: true, pointerId: 1, pointerType: 'touch', clientX: 40, clientY: 25 }));
    expect(acts).toEqual(['active', 'active', 'active']);
  });
});

describe('entering reader mode closes what it hides, and only that (default layout)', () => {
  const MANY = `${DOC}\n\n## 4. Four\n\nText.\n\n## 5. Five\n\nText.\n`;
  const COMMITS = {
    sha: 'abcdef1',
    commits: [
      { sha: 'abcdef1', subject: 'feat: newer change', date: '2026-01-01T18:45:00Z', parents: ['1234567'] },
      { sha: '1234567', subject: 'fix: older change', date: '2026-01-01T18:15:00Z', parents: ['2345678'] },
    ],
  };
  const withChanges = { info: COMMITS, changes: () => Promise.resolve({ changed: [] }) };

  it('the contents drawer open on a phone is closed by every mode that leaves off: nothing stays open to swallow input, and Escape sends exit', async () => {
    for (const mode of ['screens', 'scroll'] as const) {
      const { root, acts } = await reading({}, MANY);
      const ctx = contextOf(root);
      expect(ctx?.commands.run('contents'), 'the drawer opens below 1240 px').toBe(true);
      expect(ctx?.overlays.isOpen('drawer')).toBe(true);
      expect(root.classList.contains('toc-open')).toBe(true);
      setEnhancementReading(root, mode);
      expect(ctx?.overlays.isOpen('drawer'), `${mode}: the drawer is closed`).toBe(false);
      expect(root.classList.contains('toc-open')).toBe(false);
      expect(root.querySelector('.toc-scrim')?.hasAttribute('hidden')).toBe(true);
      expect(ctx?.overlays.any(), `${mode}: no dialog is left open`).toBe(false);
      key(root, 'Escape');
      expect(acts, `${mode}: Escape is the reader's again`).toEqual(['exit']);
    }
  });

  it('while a reader mode is on nothing opens the hidden drawer: the contents command and the i key do nothing, and with the mode off they open it as before', async () => {
    const rows = (n: number, p: string): string => ['| ID | State | Status | Decision |', '| --- | --- | --- | --- |', ...Array.from({ length: n }, (_, i) => `| ${p}${String(i)} | Blocked | Agreed | ${p} decision ${String(i)}. |`)].join('\n');
    const indexed = ['# Index doc', '', '## 1. A', '', rows(2, 'A'), '', '## 2. B', '', rows(3, 'B'), '', '## 3. C', '', rows(4, 'C'), '', '## 4. D', '', 'Text.', ''].join('\n');
    const { root, acts } = await reading({}, indexed);
    const ctx = contextOf(root);
    expect(ctx?.keys.bindings().some((b) => b.key === 'i'), 'the document has an index, so the i key is bound').toBe(true);
    key(root, 'i');
    expect(ctx?.overlays.isOpen('drawer'), 'mode off: the i key opens the drawer').toBe(true);
    ctx?.overlays.close('drawer');
    for (const mode of ['screens', 'scroll'] as const) {
      setEnhancementReading(root, mode);
      expect(ctx?.commands.run('contents'), `${mode}: the contents command refuses`).toBe(false);
      key(root, 'i');
      expect(ctx?.overlays.isOpen('drawer'), `${mode}: nothing is open`).toBe(false);
      expect(root.classList.contains('toc-open')).toBe(false);
      expect(ctx?.overlays.any()).toBe(false);
    }
    key(root, 'Escape');
    expect(acts, 'Escape is the reader\'s').toEqual(['exit']);
    setEnhancementReading(root, 'off');
    expect(ctx?.commands.run('contents'), 'mode off: the command opens it again').toBe(true);
    expect(ctx?.overlays.isOpen('drawer')).toBe(true);
    expect(ctx?.commands.run('contents'), 'and an open drawer is closed by it, as before').toBe(true);
    expect(ctx?.overlays.isOpen('drawer')).toBe(false);
  });

  it('the changes menu open in the bar tools is closed too, and the menu button reads closed', async () => {
    const { root, acts } = await reading(withChanges, MANY);
    const ctx = contextOf(root);
    const trigger = root.querySelector('.chg-trig') as HTMLButtonElement;
    trigger.click();
    expect(ctx?.overlays.isOpen('changes')).toBe(true);
    setEnhancementReading(root, 'screens');
    expect(ctx?.overlays.isOpen('changes')).toBe(false);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(ctx?.overlays.any()).toBe(false);
    key(root, 'Escape');
    expect(acts).toEqual(['exit']);
  });

  it('what the mode leaves visible stays open, each on its own: the full-screen figure, the quick jump, the keys sheet and the settings menu', async () => {
    const openers: Record<string, (root: HTMLElement) => void> = {
      figure: (root) => (Array.from(root.querySelectorAll('button')).find((b) => b.textContent === 'Full screen') as HTMLButtonElement).click(),
      jump: (root) => void contextOf(root)?.commands.run('jump'),
      keys: (root) => void key(root, '?'),
      settings: (root) => void contextOf(root)?.commands.run('settings'),
    };
    for (const [kind, openIt] of Object.entries(openers)) {
      const { root } = await reading({}, MANY, FIGURE);
      const ctx = contextOf(root);
      openIt(root);
      expect(ctx?.overlays.isOpen(kind as never), `${kind} is open`).toBe(true);
      for (const mode of ['screens', 'scroll', 'off'] as const) {
        setEnhancementReading(root, mode);
        expect(ctx?.overlays.isOpen(kind as never), `${kind} stays open in ${mode}`).toBe(true);
      }
    }
  });

  it('Escape keeps its order in reader mode: a settings menu opened there is closed first, and only then does Escape send exit', async () => {
    const { root, acts } = await reading({}, MANY);
    const ctx = contextOf(root);
    setEnhancementReading(root, 'screens');
    expect(ctx?.commands.run('settings')).toBe(true);
    key(root, 'Escape');
    expect(ctx?.overlays.isOpen('settings')).toBe(false);
    expect(acts).toEqual([]);
    key(root, 'Escape');
    expect(acts).toEqual(['exit']);
    // a change from one reading mode to the other closes nothing the reader opened
    ctx?.commands.run('settings');
    setEnhancementReading(root, 'scroll');
    expect(ctx?.overlays.isOpen('settings')).toBe(true);
  });
});
