// @vitest-environment jsdom
// Tables of three or more columns stack into cards on a phone (L2 prototype, visual pass): the wrapper takes the class
// `stack` and each body cell carries its column's name in `data-label`, which assets/reader.css shows above the cell.
// Two columns stay a table. Destroy removes every one of those writes.
import { afterEach, describe, expect, it } from 'vitest';
import { destroyEnhancement, enhance } from '../src/enhance/index.js';
import { render } from '../src/render/index.js';

const MD = [
  '# Example spec',
  '',
  '| # | Decision | Status |',
  '|---|---|---|',
  '| D1 | Keep it | Agreed |',
  '| D2 | Fold it | Proposed |',
  '',
  '| Name | Value |',
  '|---|---|',
  '| a | 1 |',
  '',
].join('\n');

const roots: HTMLElement[] = [];
function mount(md: string): HTMLElement {
  const root = document.createElement('div');
  root.innerHTML = render(md).html; // test fixture: render()'s own safe markup
  document.body.append(root);
  roots.push(root);
  return root;
}
afterEach(() => {
  for (const r of roots.splice(0)) r.remove();
});

describe('tables that stack on a phone', () => {
  it('a table of three columns takes the stack class and labels each cell; two columns stay a table', async () => {
    const root = mount(MD);
    await enhance(root);
    const [three, two] = Array.from(root.querySelectorAll('.table-wrapper'));
    expect(three?.classList.contains('stack')).toBe(true);
    const labels = Array.from(three?.querySelectorAll('tbody td') ?? []).map((c) => c.getAttribute('data-label'));
    expect(labels).toEqual(['#', 'Decision', 'Status', '#', 'Decision', 'Status']);
    expect(two?.classList.contains('stack')).toBe(false);
    expect(two?.querySelector('td')?.hasAttribute('data-label')).toBe(false);
  });

  it('destroy takes the class and the labels away again', async () => {
    const root = mount(MD);
    const before = root.innerHTML;
    await enhance(root);
    expect(root.querySelector('.stack')).not.toBeNull();
    await destroyEnhancement(root);
    expect(root.innerHTML).toBe(before);
  });
});
