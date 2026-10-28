// Types for scripts/build-mermaid.mjs, which runs under plain Node and is imported by test/mermaid-bundle.test.ts,
// test/mermaid-frame.test.ts, test/browser/mermaid-file.test.ts, test/browser/mermaid-parity.test.ts,
// test/public-ready.test.ts and scripts/build-frame.mjs.
import type { Metafile } from 'esbuild';

/** What one build gives. */
export interface Built {
  /** The metafile's outputs, from the package root: one file. */
  readonly outputs: readonly string[];
  /** The output's exports, sorted. */
  readonly exports: readonly string[];
  /** The imports left in the output (static or dynamic), by path. */
  readonly imports: readonly string[];
  /** The metafile's inputs, from the package root, sorted. */
  readonly inputs: readonly string[];
  readonly text: string;
  readonly contents: Uint8Array;
  readonly bytes: number;
  readonly sha256: string;
  readonly metafile: Metafile;
  /** The esbuild options the build passed: SHARED_OPTIONS, the root, the elk stand-in, then the build's own keys. */
  readonly options: Readonly<Record<string, unknown>>;
}

/** One licence file of a package, its text tidied (LF line ends, no trailing white space). */
export interface LicenceFile {
  readonly name: string;
  readonly text: string;
}

/** One bundled package, as the notices list it. */
export interface BundledPackage {
  readonly name: string;
  readonly version: string;
  readonly licence: string;
  /** Its directory, from the package root. */
  readonly dir: string;
  readonly files: readonly LicenceFile[];
}

/** A package whose code ships inside a pre-built file of a bundled package, which the metafile does not name. */
export interface EmbeddedPackage {
  readonly name: string;
  /** The version its module keys name, or the range its carrier declares when they name none. */
  readonly version: string;
  /** The bundled package whose file carries it. */
  readonly carrier: string;
}

export declare const OUT_FILE: string;
export declare const STUB: string;
export declare const ENTRY_NAME: string;
export declare const MAX_BYTES: number;
export declare const ELK_SIGNATURE: string;
export declare const FRAME_OUT_FILE: string;
export declare const FRAME_ENTRY: string;
export declare const STRICT_BANNER: string;
export declare const FREE_DEFINES: Readonly<Record<string, string>>;
export declare const SHARED_OPTIONS: Readonly<Record<string, unknown>>;
export declare const NOTICES_BEGIN: string;
export declare const NOTICES_END: string;
export declare const NOTICES_HEADING: string;
export declare const DEPENDENCY_NOTICES_BEGIN: string;
export declare const DEPENDENCY_NOTICES_END: string;
export declare const DEPENDENCY_NOTICES_HEADING: string;
export declare const NO_LICENCE_FIELD: string;
export declare const EMBEDDED: readonly EmbeddedPackage[];
export declare function buildMermaid(options?: { root?: string }): Promise<Built>;
export declare function bundleMermaidFrame(options?: { root?: string }): Promise<Built>;
export declare function mermaidFrameHazards(text: string): string[];
export declare function buildMermaidFrame(root?: string): Promise<string>;
export declare function licenceFiles(dir: string, label: string): LicenceFile[];
export declare function packagesOf(metafile: Metafile, root?: string): BundledPackage[];
export declare function embeddedMarkers(metafile: Metafile, root?: string): EmbeddedPackage[];
export declare function noticesSection(packages: readonly BundledPackage[]): string;
export declare function readNoticesSection(text: string): string | null;
export declare function withNoticesSection(text: string, section: string): string;
export declare function mergeMetafiles(...metafiles: readonly Metafile[]): Metafile;
/** The runtime libraries (L3 Task 14), as the second generated section lists them; `dir` is node_modules/<name>. */
export declare function dependencyPackages(root?: string): BundledPackage[];
export declare function dependencyNoticesSection(packages: readonly BundledPackage[]): string;
export declare function readDependencyNoticesSection(text: string): string | null;
export declare function withDependencyNoticesSection(text: string, section: string): string;
