// Fold source reading in a real browser: the shipped stylesheet and strict CSP stay in force for the exact integer
// boundary used by source-fold notes.
import { afterAll, expect, it } from 'vitest';
import { closeBrowsers, describeBrowsers, openDoc } from './harness.js';

const DOC = [
  '# Fold source',
  '',
  '## One',
  '',
  'member '.repeat(344),
  '',
  '## Two',
  '',
  'second member',
  '',
  '## Three',
  '',
  'third member',
  '',
].join('\n');

afterAll(closeBrowsers);

describeBrowsers((browser) => {
  it('formats the 345-word source boundary as two minutes under strict CSP', async () => {
    const doc = await openDoc(DOC, {}, { browser, csp: 'strict' });
    try {
      const state = await doc.page.evaluate(() => {
        const root = document.querySelector('main[data-harness-root]') as HTMLElement;
        const heading = root.querySelector('h2') as HTMLElement;
        const note = heading.nextElementSibling as HTMLElement;
        return {
          minute: note.querySelector('.fn-m')?.textContent ?? null,
          controls: root.querySelectorAll('.h-fold, .fold-note').length,
        };
      });
      expect(state).toEqual({ minute: '2 min', controls: 6 });
      expect(await doc.violations()).toEqual([]);
    } finally {
      await doc.close();
    }
  });

  it('keeps a stale source from reopening a live folded section', async () => {
    const doc = await openDoc(DOC, {}, {
      browser,
      csp: 'strict',
      html: (html) => html.replace(/<h2 id="two"[^>]*>Two<\/h2>/, '<p id="second-source">second original</p><h2 id="two">Two</h2>'),
    });
    try {
      const state = await doc.page.evaluate(() => {
        const root = document.querySelector('main[data-harness-root]') as HTMLElement;
        const heading = root.querySelector('h2') as HTMLElement;
        const note = heading.nextElementSibling as HTMLElement;
        const source = note.nextElementSibling as HTMLElement;
        (heading.querySelector('.h-fold') as HTMLButtonElement).click();
        source.remove();
        source.dispatchEvent(new Event('beforematch'));
        const staleLeavesFolded = heading.classList.contains('folded') && source.getAttribute('hidden') === 'until-found';
        const reveal = document.createElement('a');
        reveal.href = '#second-source';
        root.append(reveal);
        reveal.click();
        return { staleLeavesFolded, liveOpens: !heading.classList.contains('folded') };
      });
      expect(state).toEqual({ staleLeavesFolded: true, liveOpens: true });
      expect(await doc.violations()).toEqual([]);
      expect(doc.aborted).toEqual([]);
      expect(doc.missing).toEqual([]);
    } finally {
      await doc.close();
    }
  });
});
