// The entry of assets/mermaid/mermaid.frame.js (docserver L3, Task 4; plan Reference §5.1 and §5.2): Mermaid's API as
// a classic strict IIFE for the sealed reader frame, built by scripts/build-mermaid.mjs's buildMermaidFrame() from the
// same option object as assets/mermaid/mermaid.mjs. Start-on-load is off, as in that file: Mermaid's own load-event
// listener reads this property first, so the frame file draws nothing by itself, whatever a later initialize() says.
// The API reaches the frame's bootstrap through one `docserver:register` event, bubbling, dispatched on this file's own
// script element, its detail frozen; the bootstrap accepts it only from the element at the expected position.
//
// This entry puts nothing on the window. Mermaid's own code does write two names there when it evaluates, measured on
// 12.1.0, and test/mermaid-frame.test.ts pins the pair:
// - `injected`: a static `globalThis.injected ??= {…}` in its markdown helpers. The free-global scan (Reference §5.5)
//   reports it as an assigned member of the global, so it needs that scan's reviewed allowlist.
// - `fastdom`: written as `e.fastdom = e.fastdom || …` inside fastdom's own IIFE, whose parameter `e` is bound to
//   `typeof window < "u" ? window : globalThis`. That is not an alias the scan's binder can prove, so the scan does
//   not report this write. It is safe because it lands while the file evaluates, before the bootstrap adds any
//   content, so no element id can clobber the name first.
// Mermaid also reads two globals lazily, while a diagram is drawn, which an element id could clobber:
// `globalThis.mermaidCaptureSizes` and `globalThis.__mermaidProfiler` (read as `n?.begin("layoutCore")`). The
// free-global scan (Task 6) and the anchor battery (Task 8, B3p) must list both; this note does not stand in for them.
import mermaid from 'mermaid';

mermaid.startOnLoad = false;
const me = document.currentScript;
if (me !== null) {
  me.dispatchEvent(new CustomEvent('docserver:register', { bubbles: true, detail: Object.freeze({ name: 'mermaid', api: mermaid }) }));
}
