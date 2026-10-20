// IDs in a real browser (docserver L2, Task 9): what jsdom cannot show. The rules index opens by the viewport's real
// width, through env.matches('(min-width: 700px)') where the reference read innerWidth: with 7 to 24 rules it is
// open from 700 px wide and closed below, and with 6 or fewer at any width. And a rule's head shows only its codes
// and pills: the joins and the dash it split off, and the em it emptied, sit in hidden chrome and take no box, so
// the head lays out as the reference's did once it removed them.
import { afterAll, expect, it } from 'vitest';
import { closeBrowsers, describeBrowsers, openDoc, type BrowserName } from './harness.js';

afterAll(closeBrowsers);

/** A document whose front matter lists `n` rule IDs, each with its paragraph. */
function rulesDoc(n: number): string {
  const ids = Array.from({ length: n }, (_, i) => `AB-${String(i + 1)}`);
  return [
    '---',
    `rules: [${ids.join(', ')}]`,
    '---',
    '',
    '# Example rules',
    '',
    '## 1. Rules',
    '',
    '`AB-1` and `AB-2` — _agreed_ (after review). The first two rules.',
    '',
    ...ids.slice(2).map((id) => `\`${id}\` — **Rule ${id}.** Its text.\n`),
  ].join('\n');
}

async function panelOpen(browser: BrowserName, n: number, width: number): Promise<boolean> {
  const doc = await openDoc(rulesDoc(n), { rules: true, folds: false }, { browser, viewport: { width, height: 900 } });
  try {
    return await doc.page.evaluate(() => (document.querySelector('details.doc-facts') as HTMLDetailsElement).open);
  } finally {
    await doc.close();
  }
}

describeBrowsers((browser) => {
  it('the rules index opens by the viewport: 10 rules closed at 699 px and open at 700; 6 rules open at 390', async () => {
    expect([await panelOpen(browser, 10, 699), await panelOpen(browser, 10, 700), await panelOpen(browser, 6, 390), await panelOpen(browser, 25, 1440)]).toEqual([
      false,
      true,
      true,
      false,
    ]);
  });

  it('a rule head shows its codes and pills only: what it split off takes no box', async () => {
    const doc = await openDoc(rulesDoc(3), { rules: true, folds: false }, { browser });
    try {
      const seen = await doc.page.evaluate(() => {
        const head = document.querySelector('p.rule > .rule-head') as HTMLElement;
        const shown = Array.from(head.children)
          .filter((c) => c.getClientRects().length > 0)
          .map((c) => `${c.localName}${c.classList.length > 0 ? `.${Array.from(c.classList).join('.')}` : ''}: ${c.textContent ?? ''}`);
        const hidden = Array.from(head.querySelectorAll('[hidden]')).map((c) => c.getClientRects().length);
        return { display: getComputedStyle(head).display, shown, hidden, text: head.innerText.replace(/\s+/g, ' ').trim() };
      });
      expect(seen).toEqual({
        display: 'flex',
        shown: ['code: AB-1', 'code: AB-2', 'span.pill.ok: agreed', 'span.pill.info: after review'],
        hidden: [0, 0],
        text: expect.stringMatching(/^AB-1 ?AB-2 ?AGREED ?AFTER REVIEW$/) as unknown as string,
      });
    } finally {
      await doc.close();
    }
  });
});
