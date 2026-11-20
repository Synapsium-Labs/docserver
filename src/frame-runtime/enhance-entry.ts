// The reader inside the sealed frame, built to assets/frame/enhance.js (docserver L3; design §5.2). It leaves nothing on
// the window: it hands the reader's API to the bootstrap through one `docserver:register` event, dispatched on its own
// script element, which the bootstrap accepts only from the element at the expected position.
//
// The appearance contract adds two members (Task 5). `loadHostFonts` loads the host's two faces (host-fonts.ts).
// `setEnhancementAppearance`, and the initial `enhance` option, are wrapped: before the value goes on to the reader this
// file marks the frame's `html` element for Mermaid's tooltip, which sits in `body` outside the reader's root and so is
// out of reach of every rule and custom property scoped to it (the design's section 10, "Mermaid's tooltip"). The mark,
// `data-docreader-hosted`, and the three properties `--dr-tip-bg`, `--dr-tip-fg` and `--dr-tip-edge` (the verdict's
// `surface`, `text` and `border`) are set while the verdict has a colour group, and removed when it has none; a value
// that is not a plain object leaves them as they were.
import { hostedVerdict } from '../enhance/appearance.js';
import { destroyEnhancement, enhance, goToHash, runEnhancementCommand, setEnhancementAppearance, setEnhancementPrefs } from '../enhance/index.js';
import { loadHostFonts } from './host-fonts.js';

const me = document.currentScript;
if (me !== null) {
  const mark = (value: unknown): void => {
    const verdict = hostedVerdict(value);
    if (verdict === null) return;
    const html = document.documentElement;
    const { colour } = verdict;
    if (colour === undefined) html.removeAttribute('data-docreader-hosted');
    else html.setAttribute('data-docreader-hosted', '');
    for (const [name, slot] of [['--dr-tip-bg', 'surface'], ['--dr-tip-fg', 'text'], ['--dr-tip-edge', 'border']] as const) {
      if (colour === undefined) html.style.removeProperty(name);
      else html.style.setProperty(name, colour[slot]);
    }
  };
  const api = Object.freeze({
    enhance: (root: HTMLElement, options?: Parameters<typeof enhance>[1]) => {
      mark(options?.appearance);
      return enhance(root, options);
    },
    setEnhancementAppearance: (root: HTMLElement, value: unknown) => {
      mark(value);
      setEnhancementAppearance(root, value);
    },
    loadHostFonts,
    setEnhancementPrefs,
    destroyEnhancement,
    goToHash,
    runEnhancementCommand,
  });
  me.dispatchEvent(new CustomEvent('docserver:register', { bubbles: true, detail: Object.freeze({ name: 'enhance', api }) }));
}
