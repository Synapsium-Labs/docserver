// The reader state's two per-document calls, as src/enhance/state.ts declares them (test/frame-doc-fields.test.ts).
export interface DocState {
  readDoc(name: string): unknown;
  writeDoc(name: string, value: unknown): void;
}
