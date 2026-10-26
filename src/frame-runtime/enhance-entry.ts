// The reader inside the sealed frame, built to assets/frame/enhance.js (docserver L3; design §5.2). It leaves nothing on
// the window: it hands the reader's API to the bootstrap through one `docserver:register` event, dispatched on its own
// script element, which the bootstrap accepts only from the element at the expected position.
import { destroyEnhancement, enhance, goToHash, setEnhancementPrefs } from '../enhance/index.js';

const me = document.currentScript;
if (me !== null) {
  const api = Object.freeze({ enhance, setEnhancementPrefs, destroyEnhancement, goToHash });
  me.dispatchEvent(new CustomEvent('docserver:register', { bubbles: true, detail: Object.freeze({ name: 'enhance', api }) }));
}
