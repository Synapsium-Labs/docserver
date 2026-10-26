// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { destroyEnhancement, enhance } from '../src/enhance/index.js';

const mounted: HTMLElement[] = [];

function fixture(): HTMLElement {
  const root = document.createElement('main');
  root.innerHTML = [
    '<h1>Viewer gestures</h1>',
    '<h2>Decisions</h2>',
    '<table><thead><tr><th>ID</th><th>Decision</th><th>Status</th></tr></thead><tbody><tr><td>D1</td><td>Keep it visible</td><td>Agreed</td></tr></tbody></table>',
    '<figure class="mermaid-figure"><pre class="mermaid">flowchart LR\n  A --> B</pre><pre class="mermaid" data-docreader-chrome><svg id="viewer-source" viewBox="0 0 240 100"><g class="node dnode" id="flowchart-A-0" data-ref="D1"><rect width="80" height="30"/><text>D1</text></g><g class="node" id="flowchart-B-1"><rect x="140" width="80" height="30"/></g><path class="flowchart-link" data-id="L_A_B_0" d="M80 15H140"/></svg></pre><figcaption>Figure 1. A path.</figcaption></figure>',
  ].join('');
  document.body.append(root);
  mounted.push(root);
  return root;
}

function pointer(type: string, target: Element, init: PointerEventInit): void {
  target.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1, pointerType: 'touch', ...init }));
}

afterEach(async () => {
  for (const root of mounted.splice(0)) await destroyEnhancement(root).catch(() => undefined);
  document.body.replaceChildren();
});

describe('diagram viewer gestures', () => {
  it('does not let a click following a drag open the diagram block card', async () => {
    const root = fixture();
    await enhance(root, { copy: () => undefined });
    Array.from(root.querySelectorAll('button')).find((button) => button.textContent === 'Full screen')?.click();
    const block = root.querySelector('.fig-overlay .dnode') as SVGGElement;

    pointer('pointerdown', block, { clientX: 20, clientY: 20 });
    pointer('pointermove', block, { clientX: 29, clientY: 20 });
    pointer('pointerup', block, { clientX: 29, clientY: 20 });
    block.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));

    expect(root.querySelector('.xcard.open')).toBeNull();
  });

  it('closing one viewer preserves focus and live chrome in a sibling enhanced root', async () => {
    const first = fixture();
    const second = fixture();
    await enhance(first, { copy: () => undefined });
    await enhance(second, { copy: () => undefined });
    Array.from(first.querySelectorAll('button')).find((button) => button.textContent === 'Full screen')?.click();
    const siblingControl = Array.from(second.querySelectorAll('button')).find((button) => button.textContent === 'Full screen');
    if (siblingControl === undefined) throw new Error('second root has no fullscreen control');
    siblingControl.focus();
    const close = first.querySelector('.fo-close') as HTMLButtonElement;
    close.click();

    expect(document.activeElement).toBe(siblingControl);
    expect(second.querySelector('.tools button')?.isConnected).toBe(true);
  });

  it('leaves host focus after geometry reentry requests destruction', async () => {
    const root = fixture();
    const host = document.createElement('button');
    document.body.append(host);
    const original = SVGSVGElement.prototype.getBoundingClientRect;
    let reentered = false;
    SVGSVGElement.prototype.getBoundingClientRect = function (): DOMRect {
      if (!reentered && this.closest('.fig-overlay') !== null) {
        reentered = true;
        host.focus();
        void destroyEnhancement(root);
      }
      return new DOMRect(0, 0, 240, 100);
    };
    try {
      await enhance(root, { copy: () => undefined });
      Array.from(root.querySelectorAll('button')).find((button) => button.textContent === 'Full screen')?.click();
      await Promise.resolve();

      expect(reentered).toBe(true);
      expect(document.activeElement).toBe(host);
      expect(root.querySelector('.fig-overlay')).toBeNull();
    } finally {
      SVGSVGElement.prototype.getBoundingClientRect = original;
    }
  });
});
