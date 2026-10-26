// @vitest-environment jsdom
// Import-inert keysheet registry: access stays root-local across teardown and rebuild.
import { afterEach, describe, expect, it } from 'vitest';
import { showKeys } from '../src/enhance/keysheet.js';
import { contextOf } from '../src/enhance/lifecycle.js';
import { destroyEnhancement, enhance } from '../src/enhance/index.js';
import type { FeatureContext } from '../src/enhance/types.js';
import { render } from '../src/render/index.js';

const DOC = [
  '# Reader example',
  '',
  '## In short',
  '',
  'Summary.',
  '',
  '## 1. Context',
  '',
  'A section.',
  '',
  '## 2. Design',
  '',
  'A design.',
].join('\n');

const roots: HTMLElement[] = [];

function mount(): HTMLElement {
  const root = document.createElement('main');
  root.innerHTML = render(DOC).html;
  document.body.append(root);
  roots.push(root);
  return root;
}

afterEach(async () => {
  for (const root of roots.splice(0)) await destroyEnhancement(root).catch(() => undefined);
  document.body.replaceChildren();
});

describe('keysheet lazy registry', () => {
  it('keeps showKeys inert without a live sheet and opens the keyboard-disabled sheet', async () => {
    showKeys({} as FeatureContext);
    const root = mount();
    await enhance(root, { keyboard: false, chrome: { rail: true } });
    const ctx = contextOf(root);
    if (ctx === undefined) throw new Error('missing context');
    const keys = root.querySelector('.keys') as HTMLElement;

    expect(keys.classList.contains('open')).toBe(false);
    root.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true }));
    expect(keys.classList.contains('open')).toBe(false);
    (root.querySelector('.keys-btn') as HTMLButtonElement).click();
    expect(keys.classList.contains('open')).toBe(true);
  });

  it('keeps retained destroyed and replacement sheets isolated across two roots', async () => {
    const firstRoot = mount();
    const secondRoot = mount();
    await enhance(firstRoot, { keyboard: false, chrome: { rail: true } });
    await enhance(secondRoot, { keyboard: false, chrome: { rail: true } });
    const first = contextOf(firstRoot);
    const second = contextOf(secondRoot);
    if (first === undefined || second === undefined) throw new Error('missing initial contexts');
    const retained = firstRoot.querySelector('.keys') as HTMLElement;
    const other = secondRoot.querySelector('.keys') as HTMLElement;

    showKeys(first);
    expect([retained.classList.contains('open'), other.classList.contains('open')]).toEqual([true, false]);
    await destroyEnhancement(firstRoot);
    expect(retained.classList.contains('open')).toBe(false);
    showKeys(first);
    showKeys(second);
    expect([retained.classList.contains('open'), other.classList.contains('open')]).toEqual([false, true]);

    await enhance(firstRoot, { keyboard: false, chrome: { rail: true } });
    const replacement = contextOf(firstRoot);
    if (replacement === undefined) throw new Error('missing replacement context');
    const replacementSheet = firstRoot.querySelector('.keys') as HTMLElement;
    showKeys(first);
    expect([retained.classList.contains('open'), replacementSheet.classList.contains('open'), other.classList.contains('open')]).toEqual([false, false, true]);
    showKeys(replacement);

    expect([firstRoot.querySelectorAll('.keys').length, replacementSheet.classList.contains('open'), other.classList.contains('open')]).toEqual([1, true, true]);
  });

  it('keeps a retained sheet inert and leaves focus alone once destruction begins', async () => {
    const root = mount();
    const focus = document.createElement('button');
    document.body.append(focus);
    const original = root.innerHTML;
    await enhance(root);
    const ctx = contextOf(root);
    if (ctx === undefined) throw new Error('missing context');
    const retained = root.querySelector('.keys') as HTMLElement;
    const rows = retained.querySelector('dl') as HTMLDListElement;
    focus.focus();
    let destruction: Promise<void> | undefined;

    ctx.operate(() => {
      destruction = destroyEnhancement(root);
      expect(ctx.live()).toBe(false);
      expect(root.contains(retained)).toBe(true);
      expect([retained.classList.contains('open'), rows.children.length, document.activeElement]).toEqual([false, 0, focus]);
      showKeys(ctx);
      root.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true }));
      expect([retained.classList.contains('open'), rows.children.length, document.activeElement]).toEqual([false, 0, focus]);
    });

    if (destruction === undefined) throw new Error('destroy was not requested');
    await destruction;
    expect([root.contains(retained), root.querySelector('.keys'), root.innerHTML, document.activeElement]).toEqual([false, null, original, focus]);
  });
});
