// The inline-style probe (docserver L3, Task 16, fix round, review S1; plan Reference §11.5, FD13, FD15, ruling R7).
// A Mermaid drawing asks the document's policy for inline style twice: a `<style>` element inside each SVG (the
// `style-src-elem` check) and `style` attributes on it (the `style-src-attr` check). In 'auto' mode the first drawing
// comes before ready, so a host page whose own policy blocks inline style (one that allows only the hash of the frame
// stylesheet, say) raises its violation while the bootstrap's listener still ends the boot. In 'on-request' mode the
// first drawing comes on a tap, after ready, when protocol 1 has no error left to send, so the frame would stay mounted
// with drawings its policy breaks. Before ready, in that mode, the bootstrap therefore asks for both itself: it connects
// one `<style>` element whose text is a comment and which carries a `style` attribute, and takes it out only once the
// state is decided, so a violation event still finds the document on its path. Under a policy that allows inline
// style nothing is raised, and the element styles nothing (a comment; a style element is not rendered).
//
// The probe is shipped behaviour, like the face probe (fonts.ts), not a test hook. The built-ins it uses are read in
// Phase S, before any authored node exists (styleIntrinsics). It never throws: a call that throws probes nothing more.

/** The probe element's text: a comment, so it styles nothing whatever the policy says. */
export const STYLE_PROBE_TEXT = '/* docserver: inline style probe */';

/** The probe element's `style` attribute: a style element is not rendered, so this changes nothing either. */
export const STYLE_PROBE_ATTR = 'display:none';

/** The built-ins the probe uses, read before any authored node exists. */
export interface StyleIntrinsics {
  readonly createElement: (this: Document, name: string) => Element;
  readonly setAttribute: (this: Element, name: string, value: string) => void;
  readonly setText: ((this: Node, text: string) => void) | undefined;
  readonly appendChild: (this: Node, child: Node) => Node;
  readonly removeChild: (this: Node, child: Node) => Node;
  readonly documentElement: (this: Document) => Element | null;
}

/** Read the built-ins probeInlineStyle() uses. Called by the bootstrap in Phase S. */
export function styleIntrinsics(): StyleIntrinsics {
  return {
    createElement: Document.prototype.createElement as (this: Document, name: string) => Element,
    setAttribute: Element.prototype.setAttribute,
    setText: Object.getOwnPropertyDescriptor(Node.prototype, 'textContent')?.set as ((this: Node, text: string) => void) | undefined,
    appendChild: Node.prototype.appendChild,
    removeChild: Node.prototype.removeChild,
    documentElement: Object.getOwnPropertyDescriptor(Document.prototype, 'documentElement')?.get as (this: Document) => Element | null,
  };
}

/**
 * Ask `doc`'s policy for inline style the way a Mermaid drawing does: connect a `<style>` element with STYLE_PROBE_TEXT
 * for text and STYLE_PROBE_ATTR as its `style` attribute, at the end of the document element. Answers the function that
 * takes it out again (a second call does nothing). Never throws.
 */
export function probeInlineStyle(doc: Document, i: StyleIntrinsics): () => void {
  let el: Element | null = null;
  let parent: Element | null = null;
  try {
    parent = i.documentElement.call(doc);
    if (parent !== null) {
      el = i.createElement.call(doc, 'style');
      i.setText?.call(el, STYLE_PROBE_TEXT);
      i.appendChild.call(parent, el);
      i.setAttribute.call(el, 'style', STYLE_PROBE_ATTR);
    }
  } catch {
    // a call that throws probes nothing more
  }
  return () => {
    const e = el;
    el = null;
    if (e === null || parent === null) return;
    try {
      i.removeChild.call(parent, e);
    } catch {
      // already gone
    }
  };
}
