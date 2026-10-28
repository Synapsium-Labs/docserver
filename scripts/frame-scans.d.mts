// Types for scripts/frame-scans.mjs, which runs under plain Node and is imported by test/frame-scans.ts and by the
// consumer smoke's check (scripts/consumer-smoke.mjs).
import type { DefaultTreeAdapterMap } from 'parse5';

export type Node = DefaultTreeAdapterMap['node'];
export type Element = DefaultTreeAdapterMap['element'];
export type Row = 'M8.3' | 'M8.4' | 'M8.8';

export declare const isElement: (n: Node) => n is Element;
export declare const attr: (e: Element, name: string) => string | null;
export declare const textOf: (e: Element) => string;
export declare function tree(srcdoc: string): { head: Element; body: Element; all: Element[] };
export declare const META_PREFIX: '<meta http-equiv="Content-Security-Policy" content="';
export declare function scanPrefix(srcdoc: string): string[];
export declare function scanUrls(srcdoc: string): string[];
export declare function scanSeed(srcdoc: string): string[];
export declare const SCANS: Readonly<Record<Row, (srcdoc: string) => string[]>>;
