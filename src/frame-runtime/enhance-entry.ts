// The reader inside the sealed frame, built to assets/frame/enhance.js (docserver L3; design §5.2). It leaves nothing on
// the window: it hands the reader's API to the bootstrap through one `docserver:register` event, dispatched on its own
// script element, which the bootstrap accepts only from the element at the expected position.
//
// The appearance contract adds one member (Task 5): `loadHostFonts` loads the host's two faces (host-fonts.ts). The reader's
// own `enhance`, `setEnhancementAppearance` and `destroyEnhancement` are handed over as they are: this file touches no
// element and no style. What Mermaid's tooltip needs, which sits in `body` outside the reader's root and so is out of
// reach of every rule and custom property scoped to it (the design's section 10, "Mermaid's tooltip"), the reader writes
// itself, when it applies a verdict that has a colour group (src/enhance/state.ts applyAppearance, through the journal's
// counted document write): the frame's `html` element gets `data-docreader-hosted` and `--dr-tip-bg`, `--dr-tip-fg` and
// `--dr-tip-edge`, and the reader's teardown puts it back. So the mark is there only once the reader has applied the value (a root it does not hold
// leaves `html` untouched), and a style written here would be one the frame-runtime walls refuse.
import { destroyEnhancement, enhance, goToHash, runEnhancementCommand, setEnhancementAppearance, setEnhancementPrefs } from '../enhance/index.js';
import { loadHostFonts } from './host-fonts.js';

const me = document.currentScript;
if (me !== null) {
  const api = Object.freeze({
    enhance,
    setEnhancementAppearance,
    destroyEnhancement,
    loadHostFonts,
    setEnhancementPrefs,
    goToHash,
    runEnhancementCommand,
  });
  me.dispatchEvent(new CustomEvent('docserver:register', { bubbles: true, detail: Object.freeze({ name: 'enhance', api }) }));
}
