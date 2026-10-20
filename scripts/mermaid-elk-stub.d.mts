// Types for scripts/mermaid-elk-stub.mjs, the stand-in for elkjs that scripts/build-mermaid.mjs bundles; imported by
// test/browser/mermaid-file.test.ts for its message.

/** Why a diagram that asks for the ELK layout is not drawn. */
export declare const ELK_LEFT_OUT: string;

export default class ELK {
  /** Refuses every layout. */
  layout(): Promise<never>;
}
