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

/**
 * Mermaid 12.1.0's own directive grammar (its `directiveRegex`, copied exactly): `%%{`, white space, then a word (with or
 * without a `:`), then a value up to `}%%`. A `%%{` that is not followed by white space and a word (a quoted label's
 * `"%%{"`) starts nothing, and what follows it stays in the scan.
 */
const DIRECTIVE = /%{2}{\s*(?:(\w+)\s*:|(\w+))\s*(?:(\w+)|((?:(?!}%{2}).|\r?\n)*))?\s*(?:}%{2})?/gi;

/**
 * The text without the init directives Mermaid itself removes before it reads a figure (a document's directive cannot
 * colour a hosted figure, so what it holds is no style). Only a match that Mermaid closes with `}%%` is removed, and
 * removed as Mermaid removes it (to the empty string); a directive never closed keeps what follows in the scan, which
 * errs toward author-styled.
 */
function withoutDirectives(body: string): string {
  return body.replace(DIRECTIVE, (m) => (m.endsWith('}%%') ? '' : m));
}

/** Whether the figure is a class or a state diagram, the kinds whose `<<name>>` is an annotation (Mermaid's detectors: `^\s*classDiagram` and `^\s*stateDiagram`, after front matter, directives and `%%` comment lines; a directive Mermaid does not remove is no comment). */
function annotatesWithAngles(body: string): boolean {
  for (const line of body.split(/\r\n|[\r\n]/)) {
    const t = line.trimStart();
    if (t === '' || (t.startsWith('%%') && !t.startsWith('%%{'))) continue;
    return t.startsWith('classDiagram') || t.startsWith('stateDiagram');
  }
  return false;
}

/** Whether a figure's text styles itself, so it keeps 1.1.0's drawing (section 10, "Author-styled"). */
export function isAuthorStyled(text: string): boolean {
  const lines = text.split(/\r\n|[\r\n]/);
  let from = 0;
  if (/^[ \t]*---\s*$/.test(lines[0] ?? '')) {
    const end = lines.findIndex((l, i) => i > 0 && /^[ \t]*---\s*$/.test(l));
    if (end > 0) from = end + 1;
  }
  const body = withoutDirectives(lines.slice(from).join('\n'));
  return (
    // A head wherever a statement can start, erring toward author-styled: the text's start, white space (a line break, an
    // indent, or the gap after a closing `end`, an ER relation or an entity block), a `;` or a closing `}`, then the head,
    // then white space, a `;`, a `:` (`rect:wrap:red`) or the text's end. Neither a longer word (`styleX`, `restyle`, `boxes`)
    // nor a quoted word matches. A test, not a split (only csp-rules.ts splits on a semicolon, test/frame-csp.test.ts), and
    // linear: no group repeats.
    /(?:^|[\s;}])(?:classDef|style|linkStyle|rect|box|todayMarker)(?:[\s;:]|$)/i.test(body) ||
    // An element: `<` or `</` and a letter other than a `<br>`. The `<<name>>` annotation is spared only in the kinds whose
    // annotation it is (a class or a state diagram); anywhere else a second `<` before a letter starts a tag in the HTML
    // tokenizer, so `A["<<mark>>x"]`, `<<font color=red>` and `<<mark>` are styled.
    /<\/?(?!br(?=[\s/>]|$))[a-z]/i.test(annotatesWithAngles(body) ? body.replace(/^([ \t]*(?:(?:state|class)[ \t]+[^\s<]+[ \t]+)?)<<[a-z][\w-]*>>/gim, '$1') : body)
  );
}
