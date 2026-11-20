// A document at the 1.1.0 default srcdoc cap, built the way 1.1.0 counted that cap (docserver appearance plan, Task 5,
// review fix F1; the first consumer's design, section 10, test 7: "a document at the old srcdoc cap still mounts with
// both faces and the largest appearance the validator accepts"). Shared by test/frame-document.test.ts (the Node row)
// and test/browser/frame-appearance.test.ts (the measured browser row); not a test file itself.
//
// 1.1.0's MAX_SRCDOC_CHARS_DEFAULT is the html cap, the five assets' lengths, the image URLs' share, every other seed
// field at its cap and the skeleton at its longest. This builds the input that fills each of those to its cap but the
// assets and the skeleton (which a mount writes by itself): the html at SEED_HTML_MAX_CHARS as the seed carries it, 512
// images whose decoded bytes are the 5 MiB budget (each ref of 2048 code units), and every other field at its cap with
// the character that escapes longest (`<`, six characters): the title, the front list, the 100 commits, the snapshot,
// the features' word lists and the 64 Mermaid secure keys. Only the fields too small to matter (lang, the prefs, the
// initial hash, the bridge flags, the Mermaid limits) are left as a mount writes them.
import { FEATURE_KEYS, IMAGE_BUDGET_CHARS, SEED_FIELDS_MAX_CHARS, SEED_HTML_MAX_CHARS, SEED_LIMITS } from '../src/frame/seed.js';
import { BRIDGE_LIMITS, PREF_KEYS } from '../src/frame/protocol.js';
import { DOC_FIELDS } from '../src/frame/doc-fields.generated.js';
import { FRAME_MANIFEST, MAX_SRCDOC_CHARS_DEFAULT, type FrameFeatures, type FrameOptions, type RenderInput } from '../src/frame/index.js';

/** The five frame assets' lengths at 1.1.0 (guard 3 643, bootstrap 30 153, enhance 198 215, stylesheet 549 069, Mermaid 3 746 940). */
export const ASSET_CHARS_1_1_0 = 4528020;
/** SEED_FIELDS_MAX_CHARS at 1.1.0 (the commit aceb346's src/frame/seed.ts, evaluated): neither the appearance nor the faces were counted. */
export const SEED_FIELDS_MAX_CHARS_1_1_0 = 45768624;

/** The five assets' lengths now, as the derived cap counts them. */
export const ASSET_CHARS_NOW = FRAME_MANIFEST.guard.chars + FRAME_MANIFEST.bootstrap.chars + FRAME_MANIFEST.enhance.chars + FRAME_MANIFEST.css.chars + FRAME_MANIFEST.mermaid.chars;

/**
 * 1.1.0's default srcdoc cap: the current derivation with the assets' and the seed fields' terms put back at 1.1.0's.
 * The skeleton term (srcdoc's fixed tags and the longest policy) did not move between 1.1.0 and now: src/frame/document.ts's
 * srcdoc() and the CSP bound are unchanged, so it is read from the current cap by subtraction.
 */
export function oldDefaultCap(): number {
  const skeleton = MAX_SRCDOC_CHARS_DEFAULT - (SEED_HTML_MAX_CHARS + ASSET_CHARS_NOW + IMAGE_BUDGET_CHARS + SEED_FIELDS_MAX_CHARS);
  return SEED_HTML_MAX_CHARS + ASSET_CHARS_1_1_0 + IMAGE_BUDGET_CHARS + SEED_FIELDS_MAX_CHARS_1_1_0 + skeleton;
}

const lt = (n: number): string => '<'.repeat(n);

/**
 * An html whose escaped length as the seed carries it is exactly SEED_HTML_MAX_CHARS: `paragraphs` paragraphs of `<`
 * (`<` takes six seed characters, `<p>` thirteen and `</p>` fourteen) with plain letters making up the remainder.
 */
export function htmlAtCap(paragraphs: number): string {
  const frame = 13 + 14; // `<p>` and `</p>`, escaped
  const per = Math.floor((SEED_HTML_MAX_CHARS - paragraphs * frame) / (6 * paragraphs));
  const remainder = SEED_HTML_MAX_CHARS - paragraphs * (frame + 6 * per);
  const para = `<p>${lt(per)}</p>`;
  return para.repeat(paragraphs - 1) + `<p>${lt(per)}${'a'.repeat(remainder)}</p>`;
}

/** The images: 512 refs of 2048 code units, each of 10 240 decoded bytes (512 x 10 240 is the 5 242 880 budget), as svg+xml, the longest prefix. */
function images(): Record<string, string> {
  const L = SEED_LIMITS;
  const bytes = L.imageBudgetBytes / L.images;
  const body = 'A'.repeat(4 * Math.ceil(bytes / 3) - 2) + '==';
  const out: Record<string, string> = {};
  for (let i = 0; i < L.images; i += 1) out[`${lt(L.imageRefMaxCodeUnits - 4)}${String(i).padStart(4, 'x')}`] = `data:image/svg+xml;base64,${body}`;
  return out;
}

/** Every vocabulary list full (200 words) of the longest word, in the layout's three groups, two grammars and six lists. */
function features(): FrameFeatures {
  const L = SEED_LIMITS;
  const list = (): string[] => Array.from({ length: L.words }, () => lt(L.wordMaxCodeUnits));
  const vocabulary: Record<string, unknown> = {};
  for (const [k, sub] of Object.entries(FEATURE_KEYS.groups)) vocabulary[k] = Object.fromEntries(sub.map((s) => [s, list()]));
  for (const k of FEATURE_KEYS.grammars) vocabulary[k] = { prefixes: list() };
  for (const k of FEATURE_KEYS.lists) vocabulary[k] = list();
  return { rules: false, folds: false, keyboard: false, chrome: { bar: false, rail: false, settings: false, topSpace: false }, vocabulary } as unknown as FrameFeatures;
}

export interface OldCapDocument {
  readonly input: RenderInput;
  /** The options that carry the fields the input cannot: Mermaid's secure keys, the snapshot, the features. A mount adds csp, nonce and assets (with Mermaid's). */
  readonly options: { readonly snapshot: NonNullable<FrameOptions['snapshot']>; readonly features: FrameFeatures; readonly mermaid: NonNullable<FrameOptions['mermaid']> };
}

/** The document: `paragraphs` paragraphs in the html (1 for a text node a browser parses at once, 2000 for a reader that walks them). */
export function oldCapDocument(paragraphs = 2000): OldCapDocument {
  const L = SEED_LIMITS;
  const sha = 'f'.repeat(64);
  const frontList = Array.from({ length: L.frontEntries }, () => ({ key: lt(L.frontKeyMaxCodePoints), list: true as const, vals: Array.from({ length: L.frontItems }, () => lt(L.frontItemMaxCodePoints)) }));
  const commits = Array.from({ length: L.commits }, () => ({ sha, subject: lt(L.subjectMaxCodeUnits), date: lt(L.dateMaxCodeUnits), parents: Array.from({ length: L.parents }, () => sha) }));
  const storeKeys = [...PREF_KEYS.map((k) => `pref:${k}`), ...DOC_FIELDS.map((f) => `doc:${f}`)];
  const snapshot = Object.fromEntries(storeKeys.map((k) => [k, `"${lt(BRIDGE_LIMITS.valueMaxBytes - 2)}"`]));
  const secure = Array.from({ length: L.secureKeys }, (_, i) => `k${'0'.repeat(L.secureKeyMaxCodeUnits - 4)}${String(i).padStart(3, '0')}`);
  return {
    input: {
      result: { outcome: 'rendered', html: htmlAtCap(paragraphs), meta: { title: lt(L.titleMaxCodeUnits), frontList } },
      version: { sha, draft: false, commits, only: sha },
      images: images(),
    },
    options: { snapshot: snapshot as NonNullable<FrameOptions['snapshot']>, features: features(), mermaid: { secure } },
  };
}
