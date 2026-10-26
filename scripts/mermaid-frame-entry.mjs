// The entry of assets/mermaid/mermaid.frame.js (docserver L3; design §5.1 and §5.2): Mermaid's API as a classic strict
// IIFE for the sealed reader frame, start-on-load off (as assets/mermaid/mermaid.mjs), handed to the bootstrap through
// one `docserver:register` event dispatched on its own script element. It leaves nothing on the window.
import mermaid from 'mermaid';

mermaid.startOnLoad = false;
const me = document.currentScript;
if (me !== null) {
  me.dispatchEvent(new CustomEvent('docserver:register', { bubbles: true, detail: Object.freeze({ name: 'mermaid', api: mermaid }) }));
}
