// The stand-in for elkjs in the bundled Mermaid file (docserver L2, Task 15; LD3). elkjs is EPL-2.0, which the
// package's licence plan keeps out (spec §3.6), so scripts/build-mermaid.mjs resolves every import of `elkjs` here.
// Mermaid uses elkjs only through `new ELK()` and `layout(graph)`, and only when a diagram asks for an ELK layout
// (`layout: elk` and its variants): that call rejects, the diagram fails to draw, and the reader shows its failure
// note with the diagram's source. Every other layout is unaffected. Dev tooling: bundled into the built file, never
// shipped as a module of its own.

/** Why a diagram that asks for the ELK layout is not drawn. */
export const ELK_LEFT_OUT = 'The ELK layout is not part of this Mermaid build (elkjs is left out), so this diagram cannot be drawn.';

export default class ELK {
  /** Refuse every layout: the diagram's drawing fails, and its failure note shows. */
  layout() {
    return Promise.reject(new Error(ELK_LEFT_OUT));
  }
}
