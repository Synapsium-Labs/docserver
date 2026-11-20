// The Mermaid half of the appearance contract (docserver appearance plan, Task 2; the first consumer's design, section 10,
// "Mermaid while hosted"): the kinds drawn in a host's colours, the derivation of Mermaid `themeVariables` from the slots,
// the series, and the author-styled scan. Pure, and walled like the rest of src/enhance (no DOM, nothing run at import:
// the lists are literals, typed readonly here and frozen at the `./frame` boundary). Colours are `#rrggbb` in either case
// and come out lower case; a tint is resolved by an 8-bit sRGB mix so Mermaid's colour parser reads a plain hex.
import type { AppearanceColourSlot } from './appearance.js';

/** The kinds drawn in the host's colours while hosted, by the id the bundled Mermaid's `parse` answers. */
export const MERMAID_HOSTED_KINDS = ['flowchart-v2', 'sequence', 'classDiagram', 'stateDiagram', 'gantt', 'pie', 'er', 'gitGraph'] as const;

/** The derivation table of section 10: each colour key the `base` theme reads for a covered kind, under its one slot. */
const TABLE: readonly (readonly [AppearanceColourSlot, string])[] = [
  ['surface',
    'background tertiaryColor clusterBkg edgeLabelBackground labelBackgroundColor compositeBackground ' +
    'altBackground altSectionBkgColor doneTaskBkgColor rowEven attributeBackgroundColorEven pieStrokeColor'],
  ['surface2',
    'primaryColor secondaryColor mainBkg nodeBkg noteBkgColor actorBkg labelBoxBkgColor activationBkgColor ' +
    'stateBkg compositeTitleBackground sectionBkgColor sectionBkgColor2 excludeBkgColor taskBkgColor rowOdd ' +
    'attributeBackgroundColorOdd commitLabelBackground tagLabelBackground errorBkgColor'],
  ['text',
    'primaryTextColor secondaryTextColor tertiaryTextColor textColor nodeTextColor titleColor classText ' +
    'noteTextColor actorTextColor signalTextColor labelTextColor loopTextColor stateLabelColor ' +
    'transitionLabelColor taskTextColor taskTextLightColor taskTextDarkColor taskTextOutsideColor ' +
    'pieTitleTextColor pieLegendTextColor commitLabelColor tagLabelColor errorTextColor'],
  ['bg',
    'sequenceNumberColor pieSectionTextColor branchLabelColor gitBranchLabel0 gitBranchLabel1 gitBranchLabel2 ' +
    'gitBranchLabel3 gitBranchLabel4 gitBranchLabel5 gitBranchLabel6 gitBranchLabel7'],
  ['text-muted',
    'lineColor arrowheadColor defaultLinkColor signalColor actorLineColor transitionColor specialStateColor ' +
    'innerEndBackground labelBoxBorderColor activationBorderColor taskBorderColor doneTaskBorderColor ' +
    'vertLineColor'],
  ['accent',
    'activeTaskBorderColor todayLineColor taskTextClickableColor'],
  ['no',
    'critBorderColor'],
  ['border',
    'primaryBorderColor secondaryBorderColor tertiaryBorderColor border2 nodeBorder clusterBorder compositeBorder ' +
    'noteBorderColor actorBorder pieOuterStrokeColor tagLabelBorder'],
  ['rule',
    'gridColor'],
];

type Colours = Readonly<Record<AppearanceColourSlot, string>>;

/** `p` percent of `a` over `b`, each channel rounded to the nearest integer, as `#rrggbb`. */
const mix = (p: number, a: string, b: string): string => {
  const x = parseInt(a.slice(1), 16);
  const y = parseInt(b.slice(1), 16);
  let o = 0;
  for (const s of [16, 8, 0]) o = o * 256 + Math.round((p * ((x >> s) & 255) + (100 - p) * ((y >> s) & 255)) / 100);
  return '#' + (o + 0x1000000).toString(16).slice(1);
};

/** The twelve text colours in the design's order, each value once (compared without case). */
export function seriesOf(c: Colours): string[] {
  const out: string[] = [];
  for (const v of [c.accent, c.ok, c.wait, c.no, c.chg, c.term, c.id, c.violet, mix(80, c.accent, c.text), c['text-muted'], c['text-faint'], c.text]) {
    const l = v.toLowerCase();
    if (!out.includes(l)) out.push(l);
  }
  return out;
}

/** Mermaid `themeVariables` for the covered kinds (every key of the table, the series, 1.1.0's keys but the font family). */
export function mermaidThemeOf(c: Colours): Readonly<Record<string, string>> {
  const o: Record<string, string> = { fontSize: '14px', pieOpacity: '1', dropShadow: 'none' };
  const put = (k: string, v: string): void => {
    o[k] = v;
  };
  for (const [slot, keys] of TABLE) for (const k of keys.split(' ')) put(k, c[slot].toLowerCase());
  const surface = c.surface.toLowerCase();
  o.activeTaskBkgColor = mix(4, c.accent.toLowerCase(), surface);
  o.critBkgColor = mix(4, c.no.toLowerCase(), surface);
  const s = seriesOf(c);
  const nth = (i: number): string => s[i % s.length] as string;
  for (let i = 0; i < 12; i++) put('pie' + (i + 1), nth(i));
  // gitInv<n> paints a highlighted commit's outer square (the inner one reads primaryColor): the series, as git<n>.
  for (let i = 0; i < 8; i++) {
    put('git' + i, nth(i));
    put('gitInv' + i, nth(i));
  }
  return o;
}

/** Whether a figure's text styles itself, so it keeps 1.1.0's drawing (section 10, "Author-styled"). */
export function isAuthorStyled(text: string): boolean {
  const lines = text.split(/\r\n|[\r\n]/);
  let from = 0;
  if (/^[ \t]*---\s*$/.test(lines[0] ?? '')) {
    const end = lines.findIndex((l, i) => i > 0 && /^[ \t]*---\s*$/.test(l));
    if (end > 0) from = end + 1;
  }
  const body = lines.slice(from).join('\n');
  return (
    body.split(/[\n;]/).some((s) => /^(?:classDef|style|linkStyle|rect|box|todayMarker)(?:\s|$)/i.test(s.replace(/^\s+/, ''))) ||
    /(?:^|[^<])<\/?(?!br(?=[\s/>]|$))[a-z]/i.test(body)
  );
}
