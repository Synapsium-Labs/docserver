// Types for scripts/build-frame.mjs, which runs under plain Node and is imported by test/frame-document.test.ts and
// test/browser/frame-boot.test.ts.

export type FrameAssetName = 'guard' | 'bootstrap' | 'enhance' | 'css' | 'mermaid';

/** One built frame file. */
export interface BuiltFile {
  /** Its path under assets/. */
  readonly path: string;
  readonly text: string;
  readonly bytes: number;
  /** The sha256 of its text's UTF-8 bytes, as lower-case hex. */
  readonly sha256: string;
  /** Its CSP hash source, or null for the stylesheet. */
  readonly csp: string | null;
  readonly kind: 'script' | 'style';
}

export interface BuiltFrame {
  readonly files: Readonly<Record<FrameAssetName, BuiltFile>>;
  readonly assetsJson: string;
  readonly manifestTs: string;
}

export interface ByteRules {
  scriptHazards(text: string): string[];
  cssHazards(text: string): string[];
}

export declare const FRAME_FILES: Readonly<Record<FrameAssetName, string>>;
export declare const ASSETS_JSON: string;
export declare const MANIFEST_TS: string;
export declare const FREE_DEFINES: Readonly<Record<string, string>>;
export declare const MERMAID_FRAME_ENTRY: string;
export declare function byteRules(root?: string): Promise<ByteRules>;
export declare function buildFrame(options?: { root?: string }): Promise<BuiltFrame>;
export declare function writeFrame(built: BuiltFrame, out?: string): void;
export declare function checkFrame(built: BuiltFrame, out?: string): string[];
