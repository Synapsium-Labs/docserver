// Types for scripts/build-frame.mjs, which runs under plain Node and is imported by test/frame-build.test.ts,
// test/frame-document.test.ts, test/frame-runtime-walls.test.ts, test/mermaid-frame.test.ts and
// test/browser/frame-boot.test.ts.
import type { ScriptScan } from './free-globals.mjs';

export type FrameAssetName = 'guard' | 'bootstrap' | 'enhance' | 'css' | 'mermaid';
export type FrameScriptName = 'guard' | 'bootstrap' | 'enhance';
export type ScannedName = 'guard' | 'bootstrap' | 'enhance' | 'mermaid';

/** One built frame file. */
export interface BuiltFile {
  /** Its path under assets/. */
  readonly path: string;
  readonly text: string;
  /** Its length in UTF-8 bytes. */
  readonly bytes: number;
  /** Its text's length in UTF-16 code units (`text.length`). */
  readonly chars: number;
  /** The sha256 of its text's UTF-8 bytes, as lower-case hex. */
  readonly sha256: string;
  /** Its CSP hash source, or null for the stylesheet. */
  readonly csp: string | null;
  readonly kind: 'script' | 'style';
  /** For guard, bootstrap and enhance: the esbuild metafile's inputs, from the package root, sorted. */
  readonly inputs?: readonly string[];
}

/** One entry of assets.json's `files`. */
export interface ListedAsset {
  readonly path: string;
  readonly sha256: string;
  readonly bytes: number;
  readonly kind: 'script' | 'module' | 'style' | 'font' | 'text';
  readonly csp?: string;
}

/** The free-global list and the two scans it is checked by (Reference §5.5). */
export interface FreeGlobals {
  /** The list the bootstrap pins: every name read, less FREE_GLOBALS_ALLOWLIST, sorted. */
  readonly names: readonly string[];
  /** The scan the list was made from, the bootstrap built with an empty list. */
  readonly first: Readonly<Record<ScannedName, ScriptScan>>;
  /** The scan of the final outputs, the bootstrap carrying the list. */
  readonly second: Readonly<Record<ScannedName, ScriptScan>>;
}

/** What bundleFrame() makes, unchecked. */
export interface Bundle {
  readonly texts: Readonly<Record<FrameAssetName, string>>;
  /** assets/mermaid/mermaid.mjs, built in memory exactly as scripts/build-mermaid.mjs writes it. */
  readonly mermaidModule: string;
  readonly inputs: Readonly<Record<FrameScriptName, readonly string[]>>;
  readonly freeGlobals: { readonly names: readonly string[]; readonly first: Readonly<Record<ScannedName, ScriptScan>> };
}

export interface BuiltFrame {
  readonly files: Readonly<Record<FrameAssetName, BuiltFile>>;
  /** assets/mermaid/mermaid.mjs: path, text, bytes, chars, sha256. */
  readonly mermaidModule: { readonly path: string; readonly text: string; readonly bytes: number; readonly chars: number; readonly sha256: string };
  /** assets.json's `files`, sorted by path. */
  readonly listed: readonly ListedAsset[];
  readonly assetsJson: string;
  readonly manifestTs: string;
  readonly freeGlobals: FreeGlobals;
  /** With `check`: the outputs under `out` (by default `root`) that differ from this build. */
  readonly differ?: readonly string[];
}

export interface ByteRules {
  scriptHazards(text: string): string[];
  cssHazards(text: string): string[];
}

/** A build that broke a rule: every reason, one per entry. */
export interface BuildProblems extends Error {
  readonly problems: readonly string[];
}

export declare const FRAME_FILES: Readonly<Record<FrameAssetName, string>>;
export declare const MERMAID_MODULE: string;
export declare const OUTPUT_DIRS: readonly string[];
export declare const ASSETS_JSON: string;
export declare const MANIFEST_TS: string;
export declare const FREE_DEFINES: Readonly<Record<string, string>>;
export declare const MERMAID_FRAME_ENTRY: string;
export declare const HAZARDS: Readonly<{ script: readonly string[]; css: readonly string[] }>;
export declare const ASSET_BUDGETS: Readonly<Record<FrameAssetName | 'tarball', number>>;
export declare const FREE_GLOBALS_ALLOWLIST: Readonly<Record<string, string>>;
export declare const OFL_NOTICE: string;
export { scanFreeGlobals } from './free-globals.mjs';
export declare function byteRules(root?: string): Promise<ByteRules>;
/** The esbuild options the build uses for one frame script; the bootstrap's carries `freeGlobals` (default none). */
export declare function scriptOptions(
  name: FrameScriptName,
  root?: string,
  freeGlobals?: readonly string[],
): import('esbuild').BuildOptions & { write: false; metafile: true };
export declare function fontNotice(root?: string): string;
export declare function assetKind(path: string): ListedAsset['kind'];
export declare function staticAssets(root?: string): string[];
export declare function bundleFrame(options?: { root?: string }): Promise<Bundle>;
export declare function checkOutputs(bundle: Bundle): { second: Readonly<Record<ScannedName, ScriptScan>> };
export declare function buildFrame(options?: { root?: string; check?: boolean; out?: string }): Promise<BuiltFrame>;
export declare function writeFrame(built: BuiltFrame, out?: string): void;
export declare function checkFrame(built: BuiltFrame, out?: string): string[];
