// Task 18's real-browser interaction regressions: drawer focus, scroll spy, and independent mark/change signals.
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import type { Page } from 'playwright-core';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { render } from '../../src/render/index.js';
import { closeBrowsers, describeBrowsers, openDoc, type BrowserName, type OpenedDoc } from './harness.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const ENTRY = [
  "import { destroyEnhancement, enhance } from './src/enhance/index.ts';",
  "import { contextOf } from './src/enhance/lifecycle.ts';",
  '(window as unknown as { __railInteraction: unknown }).__railInteraction = { destroyEnhancement, enhance, contextOf };',
].join('\n');

const PARAGRAPH = 'The long fixture keeps this heading physically far enough from its neighbours to exercise the reader viewport. '.repeat(5);
const DOC = [
  '# Rail interactions',
  '',
  '## In short',
  '',
  'A short introduction.',
  '',
  '## 1. Context',
  '',
  'Context paragraph before the read marker changes.',
  '',
  '### Task 1: Deep task',
  '',
  ...Array.from({ length: 20 }, (_, n) => `- [ ] **Step ${String(n + 1)}** keeps the plan outlineable.`),
  '',
  '## 2. Design',
  '',
  'Design paragraph.',
  '',
  '| ID | Status | Decision |',
  '| --- | --- | --- |',
  '| R1 | Agreed | Keep the rail root-local. |',
  '',
  ...Array.from({ length: 22 }, (_, n) => [
    `## ${String(n + 3)}. Section ${String(n + 3)}`,
    '',
    ...Array.from({ length: 4 }, () => [PARAGRAPH, '']).flat(),
  ]).flat(),
].join('\n');

interface RailContext {
  readonly events: {
    emit(name: 'changes', payload: { readonly sections: readonly HTMLElement[] }): void;
  };
}

interface RailWindow {
  readonly __railInteraction: {
    destroyEnhancement(root: HTMLElement): Promise<void>;
    enhance(root: HTMLElement, options: unknown): Promise<void>;
    contextOf(root: Element): RailContext | undefined;
  };
  __railWrites: [string, string | null][];
  __railContext: RailContext;
}

let script = '';

beforeAll(async () => {
  const result = await build({
    stdin: { contents: ENTRY, resolveDir: ROOT, sourcefile: 'rail-interaction-entry.ts', loader: 'ts' },
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    target: 'es2022',
    logLevel: 'silent',
  });
  script = result.outputFiles[0]?.text ?? '';
});

afterAll(closeBrowsers);

async function frames(page: Page): Promise<void> {
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}

async function openWithContext(
  markdown: string,
  browser: BrowserName,
  viewport: { readonly width: number; readonly height: number },
  snapshot: Readonly<Record<string, string>> = {},
  secondHtml: string | null = null,
): Promise<OpenedDoc> {
  const doc = await openDoc(markdown, {}, {
    browser,
    viewport,
    enhance: false,
    html: (html) => secondHtml === null ? html : `${html}</main><main data-second-root>${secondHtml}</main>`,
  });
  await doc.page.evaluate(script);
  await doc.page.evaluate(async (stored) => {
    const w = window as unknown as RailWindow;
    const root = document.querySelector('main[data-harness-root]') as HTMLElement;
    w.__railWrites = [];
    await w.__railInteraction.enhance(root, {
      storageKey: 'rail-interaction',
      storage: {
        snapshot: stored,
        set(key: string, value: string | null): void {
          w.__railWrites.push([key, value]);
        },
      },
    });
    const context = w.__railInteraction.contextOf(root);
    if (context === undefined) throw new Error('missing rail context');
    w.__railContext = context;
  }, snapshot);
  await frames(doc.page);
  return doc;
}

async function scrollToHeading(page: Page, id: string): Promise<void> {
  await page.evaluate((headingId) => {
    const heading = document.getElementById(headingId);
    if (heading === null) throw new Error(`missing heading ${headingId}`);
    const readingLine = Math.max(150, window.innerHeight * 0.3);
    window.scrollTo({ top: heading.getBoundingClientRect().top + window.scrollY - readingLine + 12, behavior: 'instant' });
  }, id);
  await frames(page);
}

describeBrowsers((browser) => {
  it('at 390 the drawer cycles only visible enabled controls, restores a connected opener, and safely falls back when it disconnects', async () => {
    const doc = await openDoc(DOC, { chrome: { rail: true } }, {
      browser,
      viewport: { width: 390, height: 844 },
      html: (html) => `${html}<button id="connected-opener" type="button">Outside opener</button>`,
    });
    try {
      await doc.page.evaluate(() => {
        const opener = document.getElementById('connected-opener') as HTMLButtonElement;
        const button = document.querySelector('main[data-harness-root] .toc-btn') as HTMLButtonElement;
        opener.focus();
        button.click();
        const rail = document.querySelector('main[data-harness-root] .doc-toc') as HTMLElement;
        const disabled = document.createElement('button');
        disabled.type = 'button';
        disabled.tabIndex = 0;
        disabled.disabled = true;
        disabled.textContent = 'Disabled boundary';
        const hidden = document.createElement('button');
        hidden.type = 'button';
        hidden.hidden = true;
        hidden.textContent = 'Hidden boundary';
        rail.prepend(disabled);
        rail.append(hidden);
      });
      expect(await doc.page.evaluate(() => {
        const rail = document.querySelector('main[data-harness-root] .doc-toc') as HTMLElement;
        return { role: rail.getAttribute('role'), modal: rail.getAttribute('aria-modal') };
      })).toEqual({ role: 'dialog', modal: 'true' });
      const controls = await doc.page.evaluate(() => {
        const rail = document.querySelector('main[data-harness-root] .doc-toc') as HTMLElement;
        return Array.from(rail.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea, [tabindex]'))
          .filter((element) => element.tabIndex >= 0 && !element.matches(':disabled') && element.closest('[hidden]') === null)
          .filter((element) => {
            const style = getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
          })
          .map((element) => ({ text: element.textContent?.trim() ?? '', disabled: element.matches(':disabled') }));
      });
      expect(controls.length).toBeGreaterThan(2);
      expect(controls.every((control) => !control.disabled)).toBe(true);
      expect(controls.map((control) => control.text)).not.toContain('Disabled boundary');
      expect(controls.map((control) => control.text)).not.toContain('Hidden boundary');

      await doc.page.evaluate(() => {
        const rail = document.querySelector('main[data-harness-root] .doc-toc') as HTMLElement;
        const controls = Array.from(rail.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea, [tabindex]'))
          .filter((element) => element.tabIndex >= 0 && !element.matches(':disabled') && element.closest('[hidden]') === null)
          .filter((element) => {
            const style = getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
          });
        controls.at(-1)?.focus();
      });
      await doc.page.keyboard.press('Tab');
      expect(await doc.page.evaluate(() => {
        const rail = document.querySelector('main[data-harness-root] .doc-toc') as HTMLElement;
        const first = Array.from(rail.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea, [tabindex]'))
          .find((element) => element.tabIndex >= 0 && !element.matches(':disabled') && element.closest('[hidden]') === null && element.getBoundingClientRect().width > 0);
        return { active: document.activeElement === first, text: first?.textContent?.trim() };
      })).toEqual({ active: true, text: 'Contents' });
      await doc.page.keyboard.press('Shift+Tab');
      expect(await doc.page.evaluate(() => {
        const rail = document.querySelector('main[data-harness-root] .doc-toc') as HTMLElement;
        const visible = Array.from(rail.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea, [tabindex]'))
          .filter((element) => element.tabIndex >= 0 && !element.matches(':disabled') && element.closest('[hidden]') === null && element.getBoundingClientRect().width > 0);
        return document.activeElement === visible.at(-1);
      })).toBe(true);

      await doc.page.keyboard.press('Escape');
      expect(await doc.page.evaluate(() => {
        const rail = document.querySelector('main[data-harness-root] .doc-toc') as HTMLElement;
        return {
          open: document.querySelector('main[data-harness-root]')?.classList.contains('toc-open'),
          focus: document.activeElement?.id,
          role: rail.getAttribute('role'),
          modal: rail.getAttribute('aria-modal'),
        };
      })).toEqual({ open: false, focus: 'connected-opener', role: null, modal: null });

      const scrimHit = await doc.page.evaluate(() => {
        const opener = document.getElementById('connected-opener') as HTMLButtonElement;
        const root = document.querySelector('main[data-harness-root]') as HTMLElement;
        const rail = root.querySelector('.doc-toc') as HTMLElement;
        const scrim = root.querySelector('.toc-scrim') as HTMLElement;
        opener.focus();
        (root.querySelector('.toc-btn') as HTMLButtonElement).click();
        const drawer = rail.getBoundingClientRect();
        const scrimBox = scrim.getBoundingClientRect();
        const viewport = { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight };
        const point = {
          x: (Math.max(drawer.right, scrimBox.left, viewport.left) + Math.min(scrimBox.right, viewport.right)) / 2,
          y: (Math.max(scrimBox.top, viewport.top) + Math.min(scrimBox.bottom, viewport.bottom)) / 2,
        };
        return {
          point,
          outsideDrawer: point.x < drawer.left || point.x > drawer.right || point.y < drawer.top || point.y > drawer.bottom,
          insideVisibleScrim: point.x >= scrimBox.left && point.x <= scrimBox.right && point.y >= scrimBox.top && point.y <= scrimBox.bottom
            && point.x >= viewport.left && point.x <= viewport.right && point.y >= viewport.top && point.y <= viewport.bottom,
          hitScrim: document.elementFromPoint(point.x, point.y) === scrim,
        };
      });
      expect(scrimHit.outsideDrawer).toBe(true);
      expect(scrimHit.insideVisibleScrim).toBe(true);
      expect(scrimHit.hitScrim).toBe(true);
      await doc.page.mouse.click(scrimHit.point.x, scrimHit.point.y);
      expect(await doc.page.evaluate(() => ({
        open: document.querySelector('main[data-harness-root]')?.classList.contains('toc-open'),
        focus: document.activeElement?.id,
      }))).toEqual({ open: false, focus: 'connected-opener' });

      await doc.page.evaluate(() => {
        const opener = document.getElementById('connected-opener') as HTMLButtonElement;
        opener.focus();
        (document.querySelector('main[data-harness-root] .toc-btn') as HTMLButtonElement).click();
        opener.remove();
      });
      await doc.page.keyboard.press('Escape');
      expect(await doc.page.evaluate(() => {
        const root = document.querySelector('main[data-harness-root]') as HTMLElement;
        const contents = root.querySelector('.toc-btn') as HTMLElement;
        return {
          open: root.classList.contains('toc-open'),
          focus: document.activeElement === contents,
          visible: contents.getClientRects().length > 0,
        };
      })).toEqual({ open: false, focus: true, visible: true });
    } finally {
      await doc.close();
    }
  });

  it('focuses its root without scrolling when both drawer return targets disconnect', async () => {
    const doc = await openDoc(DOC, { chrome: { rail: true } }, {
      browser,
      viewport: { width: 390, height: 844 },
      html: (html) => `${html}<button id="root-fallback-opener" type="button">Outside opener</button>`,
    });
    try {
      const result = await doc.page.evaluate(() => {
        const root = document.querySelector('main[data-harness-root]') as HTMLElement;
        const rail = root.querySelector('.doc-toc') as HTMLElement;
        const opener = document.getElementById('root-fallback-opener') as HTMLButtonElement;
        const contents = root.querySelector('.toc-btn') as HTMLButtonElement;
        opener.focus();
        contents.click();
        window.scrollTo({ top: 240, behavior: 'instant' });
        const before = window.scrollY;
        opener.remove();
        contents.remove();
        rail.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
        return {
          closed: !root.classList.contains('toc-open'),
          focusedRoot: document.activeElement === root,
          rootTabindex: root.getAttribute('tabindex'),
          scrollY: window.scrollY,
          before,
        };
      });
      expect(result).toEqual({ closed: true, focusedRoot: true, rootTabindex: '-1', scrollY: result.before, before: result.before });
    } finally {
      await doc.close();
    }
  });

  it('returns fallback focus during public destroy before restoring an ordinary root tabindex', async () => {
    const doc = await openWithContext(DOC, browser, { width: 390, height: 844 }, {}, '<h2 id="second">Second root</h2>');
    try {
      const result = await doc.page.evaluate(async () => {
        const w = window as unknown as RailWindow;
        const root = document.querySelector('main[data-harness-root]') as HTMLElement;
        const opener = document.createElement('button');
        opener.type = 'button';
        document.body.append(opener);
        const contents = root.querySelector('.toc-btn') as HTMLButtonElement;
        opener.focus();
        contents.click();
        opener.remove();
        contents.remove();
        const focusStages: Array<string | null> = [];
        root.addEventListener('focus', () => focusStages.push(root.getAttribute('tabindex')));
        await w.__railInteraction.destroyEnhancement(root);
        return {
          focusStages,
          tabindex: root.getAttribute('tabindex'),
          chrome: root.querySelector('[data-docreader-chrome]') !== null,
        };
      });
      expect(result).toEqual({ focusStages: ['-1'], tabindex: null, chrome: false });
    } finally {
      await doc.close();
    }
  });

  it('i selects Index at desktop width without opening a modal drawer', async () => {
    const doc = await openDoc(DOC, { chrome: { rail: true } }, { browser, viewport: { width: 1440, height: 900 } });
    try {
      await doc.page.keyboard.press('i');
      expect(await doc.page.evaluate(() => {
        const root = document.querySelector('main[data-harness-root]') as HTMLElement;
        const rail = root.querySelector('.doc-toc') as HTMLElement;
        const index = rail.querySelector('[role="tab"][aria-selected="true"]') as HTMLElement;
        return {
          selected: index.textContent?.trim(),
          focused: document.activeElement === index,
          visible: index.getClientRects().length > 0,
          open: root.classList.contains('toc-open'),
          role: rail.getAttribute('role'),
          modal: rail.getAttribute('aria-modal'),
        };
      })).toEqual({ selected: 'Index 1', focused: true, visible: true, open: false, role: null, modal: null });
    } finally {
      await doc.close();
    }
  });

  it('real viewport scrolling drives h2 and h3 contents state and only scrolls the contents panel for an outside link', async () => {
    const overflowingDoc = DOC.replace('## 24. Section 24', [
      ...Array.from({ length: 40 }, (_, n) => [
        `## Fixture section ${String(n + 1)}`,
        '',
        'Neutral rendered content for the independent physical panel-overflow premise.',
      ].join('\n')),
      '## 24. Section 24',
    ].join('\n\n'));
    const doc = await openDoc(overflowingDoc, { chrome: { rail: true } }, { browser, viewport: { width: 1440, height: 900 } });
    try {
      await scrollToHeading(doc.page, '1-context');
      expect(await doc.page.locator('.toc-contents a[href="#1-context"]').getAttribute('aria-current')).toBe('location');
      await scrollToHeading(doc.page, 'task-1-deep-task');
      expect(await doc.page.locator('.toc-contents a[href="#task-1-deep-task"]').getAttribute('aria-current')).toBe('location');
      expect(await doc.page.evaluate(() => (document.querySelector('main[data-harness-root] .toc-contents') as HTMLElement).scrollTop)).toBe(0);

      const pending = await doc.page.evaluate(() => {
        const panel = document.querySelector('main[data-harness-root] .toc-contents') as HTMLElement;
        panel.scrollTop = 0;
        const beforePanel = panel.getBoundingClientRect();
        const link = Array.from(panel.querySelectorAll<HTMLAnchorElement>('a[href]')).at(-1) as HTMLAnchorElement;
        const targetId = decodeURIComponent((link.getAttribute('href') ?? '').slice(1));
        const heading = document.getElementById(targetId) as HTMLElement;
        const beforeLink = link.getBoundingClientRect();
        const outsideBefore = beforeLink.top < beforePanel.top || beforeLink.bottom > beforePanel.bottom;
        const readingLine = Math.max(150, window.innerHeight * 0.3);
        window.scrollTo({ top: heading.getBoundingClientRect().top + window.scrollY - readingLine + 12, behavior: 'instant' });
        return { targetId, intendedWindowTop: window.scrollY, outsideBefore };
      });
      await doc.page.waitForFunction((id) => {
        const panel = document.querySelector('main[data-harness-root] .toc-contents');
        return Array.from(panel?.querySelectorAll('a[href]') ?? []).some((link) => link.getAttribute('href') === `#${id}` && link.getAttribute('aria-current') === 'location');
      }, pending.targetId);
      await doc.page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
      const scroll = await doc.page.evaluate((expected) => {
        const panel = document.querySelector('main[data-harness-root] .toc-contents') as HTMLElement;
        const link = Array.from(panel.querySelectorAll<HTMLAnchorElement>('a[href]')).find((anchor) => anchor.getAttribute('href') === `#${expected.targetId}`) as HTMLAnchorElement;
        const panelBox = panel.getBoundingClientRect();
        const linkBox = link.getBoundingClientRect();
        return {
          active: link.getAttribute('aria-current'),
          panelTop: panel.scrollTop,
          panelOverflows: panel.scrollHeight > panel.clientHeight,
          intendedWindowTop: expected.intendedWindowTop,
          settledWindowTop: window.scrollY,
          outsideBefore: expected.outsideBefore,
          contained: linkBox.top >= panelBox.top - 1 && linkBox.bottom <= panelBox.bottom + 1,
        };
      }, pending);
      expect(scroll.active).toBe('location');
      expect(scroll.panelOverflows).toBe(true);
      expect(scroll.outsideBefore).toBe(true);
      expect(scroll.panelTop).toBeGreaterThan(0);
      expect(scroll.contained).toBe(true);
      expect(Math.abs(scroll.settledWindowTop - scroll.intendedWindowTop)).toBeLessThanOrEqual(1);
    } finally {
      await doc.close();
    }
  });

  it('real mark actions and fixture change events remain distinct, including across two roots', async () => {
    const before = await openWithContext(DOC, browser, { width: 1440, height: 900 });
    let snapshot: Record<string, string>;
    try {
      const marks = await before.page.evaluate(() => Array.from(document.querySelectorAll('h2')).map((heading) => ({ id: heading.id, mark: heading.querySelector('.h-mark') !== null })));
      expect(marks).toContainEqual({ id: '2-design', mark: true });
      await before.page.locator('h2[id="2-design"] .h-mark').click({ force: true });
      snapshot = await before.page.evaluate(() => Object.fromEntries((window as unknown as RailWindow).__railWrites.filter(([, value]) => value !== null) as [string, string][]));
      expect(snapshot['docreader:doc:rail-interaction:marks']).toBeTypeOf('string');
    } finally {
      await before.close();
    }

    const changedDoc = DOC.replace('Design paragraph.', 'Design paragraph changed after the reader marked it read.');
    const renderedSecond = render(changedDoc);
    if (renderedSecond.outcome !== 'rendered') throw new Error(`second render failed: ${renderedSecond.outcome}`);
    const doc = await openWithContext(changedDoc, browser, { width: 1440, height: 900 }, snapshot!, renderedSecond.html);
    try {
      await doc.page.evaluate(() => {
        const w = window as unknown as RailWindow;
        const fixture = document.getElementById('3-section-3') as HTMLElement;
        w.__railContext.events.emit('changes', Object.freeze({ sections: Object.freeze([fixture]) }));
      });
      expect(await doc.page.evaluate(() => {
        const root = document.querySelector('main[data-harness-root]') as HTMLElement;
        const context = root.querySelector('.toc-contents a[href="#2-design"]') as HTMLElement;
        const fixture = root.querySelector('.toc-contents a[href="#3-section-3"]') as HTMLElement;
        return {
          changedSinceRead: context.querySelector('.mk')?.classList.contains('changed'),
          changedDescription: context.getAttribute('aria-description'),
          fixtureChange: fixture.closest('li')?.classList.contains('has-chg'),
          fixtureDot: fixture.querySelector('.cd')?.classList.contains('on'),
          fixtureDescription: fixture.getAttribute('aria-description'),
        };
      })).toEqual({
        changedSinceRead: true,
        changedDescription: 'changed since you read it',
        fixtureChange: true,
        fixtureDot: true,
        fixtureDescription: null,
      });

      await doc.page.evaluate(async () => {
        const w = window as unknown as RailWindow;
        const first = document.querySelector('main[data-harness-root]') as HTMLElement;
        const second = document.querySelector('main[data-second-root]') as HTMLElement;
        if (second === null) throw new Error('missing second root');
        await w.__railInteraction.enhance(second, { storageKey: 'rail-interaction-second' });
        const firstContext = w.__railInteraction.contextOf(first);
        if (firstContext === undefined) throw new Error('missing first context');
        firstContext.events.emit('changes', Object.freeze({ sections: Object.freeze([first.querySelector('h2[id="3-section-3"]') as HTMLElement]) }));
      });
      await doc.page.locator('main[data-harness-root] h2[id="3-section-3"] .h-mark').click({ force: true });
      expect(await doc.page.evaluate(() => {
        const roots = [
          document.querySelector('main[data-harness-root]') as HTMLElement,
          document.querySelector('main[data-second-root]') as HTMLElement,
        ];
        return roots.map((root) => {
          const fixture = root.querySelector('.toc-contents a[href="#3-section-3"]') as HTMLElement;
          return {
            read: fixture.querySelector('.mk')?.classList.contains('read'),
            changed: fixture.closest('li')?.classList.contains('has-chg'),
          };
        });
      })).toEqual([{ read: true, changed: true }, { read: false, changed: false }]);
    } finally {
      await doc.close();
    }
  });
});
