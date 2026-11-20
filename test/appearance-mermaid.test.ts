// Task 2 of the appearance contract (docserver appearance plan; the first consumer's design, section 10, "Mermaid while
// hosted" and its derivation table, and test 5's author-styled row): the pure Mermaid half, `src/enhance/appearance-mermaid.ts`.
// Judged on values only. The derivation table is typed here once from the design, independently of the module's own copy.
//
// Decisions recorded here:
// - `gitInv0` to `gitInv7` follow the series, as git<n> does (the table's last row). In Mermaid 12.1.0 `.commit-highlight<n>`
//   (a highlighted commit's OUTER square) reads `gitInv<n>`; the inner square reads `primaryColor`, already `surface2`.
// - The design's text says the table holds 110 keys; its rows list 124 (96 plus the 28 series keys), and this test
//   asserts the rows as written. Output = table keys, 1.1.0's `THEME_VARIABLES` keys but `fontFamily`, and the three
//   fixed keys (`fontSize` is both a fixed key and a 1.1.0 key, counted once).
// - The eight "covered fixtures" of test 5 do not exist yet; the false rows use one plain text per kind written here.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { APPEARANCE_SLOTS, parseAppearance, type AppearanceColourSlot } from '../src/enhance/appearance.js';
import { MERMAID_HOSTED_KINDS, isAuthorStyled, mermaidThemeOf, seriesOf } from '../src/enhance/appearance-mermaid.js';
import { THEME_VARIABLES } from '../src/enhance/diagrams.js';

type Colours = Record<AppearanceColourSlot, string>;
const FIXTURES = JSON.parse(readFileSync(new URL('../conformance/appearance/fixtures.json', import.meta.url), 'utf8')) as {
  name: string;
  mode: string;
  colour: Colours;
}[];
const palette = (name: string): Colours => FIXTURES.find((f) => f.name === name)!.colour;
const PHOSPHOR = palette('Phosphor & Ink');

const TABLE: { slot: string; keys: string[] }[] = [
  { slot: 'surface', keys: [
    'background tertiaryColor clusterBkg edgeLabelBackground labelBackgroundColor compositeBackground',
    'altBackground altSectionBkgColor doneTaskBkgColor rowEven attributeBackgroundColorEven',
    'pieStrokeColor',
  ].join(' ').split(' ') },
  { slot: 'surface2', keys: [
    'primaryColor secondaryColor mainBkg nodeBkg noteBkgColor actorBkg labelBoxBkgColor',
    'activationBkgColor stateBkg compositeTitleBackground sectionBkgColor sectionBkgColor2',
    'excludeBkgColor taskBkgColor rowOdd attributeBackgroundColorOdd commitLabelBackground',
    'tagLabelBackground errorBkgColor',
  ].join(' ').split(' ') },
  { slot: 'accent at 4% over surface', keys: [
    'activeTaskBkgColor',
  ].join(' ').split(' ') },
  { slot: 'no at 4% over surface', keys: [
    'critBkgColor',
  ].join(' ').split(' ') },
  { slot: 'text', keys: [
    'primaryTextColor secondaryTextColor tertiaryTextColor textColor nodeTextColor titleColor classText',
    'noteTextColor actorTextColor signalTextColor labelTextColor loopTextColor stateLabelColor',
    'transitionLabelColor taskTextColor taskTextLightColor taskTextDarkColor taskTextOutsideColor',
    'pieTitleTextColor pieLegendTextColor commitLabelColor tagLabelColor errorTextColor',
  ].join(' ').split(' ') },
  { slot: 'bg', keys: [
    'sequenceNumberColor pieSectionTextColor branchLabelColor gitBranchLabel0 gitBranchLabel1',
    'gitBranchLabel2 gitBranchLabel3 gitBranchLabel4 gitBranchLabel5 gitBranchLabel6 gitBranchLabel7',
  ].join(' ').split(' ') },
  { slot: 'text-muted', keys: [
    'lineColor arrowheadColor defaultLinkColor signalColor actorLineColor transitionColor',
    'specialStateColor innerEndBackground labelBoxBorderColor activationBorderColor taskBorderColor',
    'doneTaskBorderColor vertLineColor',
  ].join(' ').split(' ') },
  { slot: 'accent', keys: [
    'activeTaskBorderColor todayLineColor taskTextClickableColor',
  ].join(' ').split(' ') },
  { slot: 'no', keys: [
    'critBorderColor',
  ].join(' ').split(' ') },
  { slot: 'border', keys: [
    'primaryBorderColor secondaryBorderColor tertiaryBorderColor border2 nodeBorder clusterBorder',
    'compositeBorder noteBorderColor actorBorder pieOuterStrokeColor tagLabelBorder',
  ].join(' ').split(' ') },
  { slot: 'rule', keys: [
    'gridColor',
  ].join(' ').split(' ') },
  { slot: 'the series', keys: [
    'pie1 pie2 pie3 pie4 pie5 pie6 pie7 pie8 pie9 pie10 pie11 pie12 git0 git1 git2 git3 git4 git5 git6',
    'git7 gitInv0 gitInv1 gitInv2 gitInv3 gitInv4 gitInv5 gitInv6 gitInv7',
  ].join(' ').split(' ') },
];
const TABLE_KEYS = TABLE.flatMap((r) => r.keys);
const FIXED = ['fontSize', 'pieOpacity', 'dropShadow'];

/** `p` percent of `a` over `b`, per channel, rounded half up, as lower-case hex: written apart from the module's. */
function tint(p: number, a: string, b: string): string {
  const ch = (h: string, i: number): number => parseInt(h.slice(1 + 2 * i, 3 + 2 * i), 16);
  return '#' + [0, 1, 2].map((i) => Math.floor((p * ch(a, i) + (100 - p) * ch(b, i) + 50) / 100).toString(16).padStart(2, '0')).join('');
}
/** The series as the design states it, written apart from the module's. */
function series(c: Colours): string[] {
  const out: string[] = [];
  for (const v of [c.accent, c.ok, c.wait, c.no, c.chg, c.term, c.id, c.violet, tint(80, c.accent, c.text), c['text-muted'], c['text-faint'], c.text]) {
    if (!out.some((o) => o.toLowerCase() === v.toLowerCase())) out.push(v.toLowerCase());
  }
  return out;
}

describe('the fixture appearances', () => {
  it('are twelve records of 33 slots, and each passes parseAppearance with no refusal', () => {
    expect(FIXTURES).toHaveLength(12);
    for (const f of FIXTURES) {
      expect(Object.keys(f.colour)).toEqual([...APPEARANCE_SLOTS.colour]);
      const v = parseAppearance({ mode: f.mode, colour: f.colour });
      expect(v.refused, f.name).toEqual([]);
    }
  });
});

describe('MERMAID_HOSTED_KINDS', () => {
  it('names the eight kinds by the id Mermaid answers', () => {
    expect([...MERMAID_HOSTED_KINDS]).toEqual(['flowchart-v2', 'sequence', 'classDiagram', 'stateDiagram', 'gantt', 'pie', 'er', 'gitGraph']);
  });
});

describe('mermaidThemeOf', () => {
  it("the table has each key in exactly one row, and the output's keys are exactly table + 1.1.0's + the fixed keys", () => {
    expect(new Set(TABLE_KEYS).size).toBe(TABLE_KEYS.length);
    const want = new Set([...TABLE_KEYS, ...Object.keys(THEME_VARIABLES).filter((k) => k !== 'fontFamily'), ...FIXED]);
    expect(Object.keys(mermaidThemeOf(PHOSPHOR)).sort()).toEqual([...want].sort());
    expect(Object.keys(mermaidThemeOf(PHOSPHOR))).not.toContain('fontFamily');
  });

  it('every key of 1.1.0 THEME_VARIABLES but fontFamily and fontSize is a table key', () => {
    for (const k of Object.keys(THEME_VARIABLES).filter((k) => k !== 'fontFamily' && k !== 'fontSize')) expect(TABLE_KEYS, k).toContain(k);
  });

  it('the fixed keys are fontSize 14px, pieOpacity 1 and dropShadow none', () => {
    const o = mermaidThemeOf(PHOSPHOR);
    expect([o.fontSize, o.pieOpacity, o.dropShadow]).toEqual(['14px', '1', 'none']);
  });

  it.each(FIXTURES.map((f) => [f.name, f.colour] as const))('each key takes its row slot value in %s', (_n, c) => {
    const o = mermaidThemeOf(c);
    const s = series(c);
    for (const { slot, keys } of TABLE) {
      for (const k of keys) {
        let want: string;
        if (slot === 'the series') {
          const n = Number(/\d+$/.exec(k)![0]);
          want = k.startsWith('pie') ? s[(n - 1) % s.length]! : s[n % s.length]!;
        } else if (slot.includes(' at 4% over ')) {
          const [fg, , , , bg] = slot.split(' ');
          want = tint(4, c[fg as AppearanceColourSlot].toLowerCase(), c[bg as AppearanceColourSlot].toLowerCase());
        } else want = c[slot as AppearanceColourSlot].toLowerCase();
        expect(o[k], `${k} (${slot})`).toBe(want);
      }
    }
  });

  it('lineColor is text-muted and not border; tints and values are lower-case #rrggbb', () => {
    const o = mermaidThemeOf(PHOSPHOR);
    expect(o.lineColor).toBe('#adb6ae');
    expect(o.lineColor).not.toBe(PHOSPHOR.border.toLowerCase());
    for (const v of Object.values(o).filter((v) => v.startsWith('#'))) expect(v).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('tints are an 8-bit mix: Phosphor accent 4% over surface', () => {
    expect(mermaidThemeOf(PHOSPHOR).activeTaskBkgColor).toBe('#161f19');
    expect(mermaidThemeOf(PHOSPHOR).critBkgColor).toBe('#1c1b19');
  });

  it('upper-case and lower-case inputs give one output', () => {
    const lower = Object.fromEntries(Object.entries(PHOSPHOR).map(([k, v]) => [k, v.toLowerCase()])) as Colours;
    expect(mermaidThemeOf(lower)).toEqual(mermaidThemeOf(PHOSPHOR));
  });

  it('is pure: a second call gives an equal result and the input is untouched', () => {
    const before = JSON.stringify(PHOSPHOR);
    expect(mermaidThemeOf(PHOSPHOR)).toEqual(mermaidThemeOf(PHOSPHOR));
    expect(JSON.stringify(PHOSPHOR)).toBe(before);
  });
});

describe('seriesOf', () => {
  it('Phosphor: ok equals text-muted, so the series has eleven values, in order', () => {
    expect(seriesOf(PHOSPHOR)).toEqual(series(PHOSPHOR));
    expect(seriesOf(PHOSPHOR)).toHaveLength(11);
    expect(seriesOf(PHOSPHOR).slice(0, 3)).toEqual(['#45d67e', '#adb6ae', '#f2b84b']);
  });

  it('accent-hover is accent 80% over text, mixed in 8 bits', () => {
    expect(seriesOf(PHOSPHOR)).toContain(tint(80, PHOSPHOR.accent, PHOSPHOR.text));
  });

  const pairs: [string, AppearanceColourSlot, AppearanceColourSlot][] = [
    ['Phosphor & Ink', 'ok', 'text-muted'],
    ['Nord', 'chg', 'violet'],
    ['Dracula', 'ok', 'term'],
    ['Solarized Dark', 'accent', 'id'],
    ['Solarized Light', 'accent', 'id'],
  ];
  it.each(pairs)('%s: %s equal to %s is skipped once', (name, a, b) => {
    const c = palette(name);
    expect(c[a].toLowerCase()).toBe(c[b].toLowerCase());
    const s = seriesOf(c);
    expect(new Set(s).size).toBe(s.length);
    expect(s).toEqual(series(c));
    expect(s.length).toBeLessThan(12);
  });

  it('equal values are skipped without regard to case', () => {
    const c = { ...PHOSPHOR, ok: '#adb6ae', 'text-muted': '#ADB6AE' };
    expect(seriesOf(c)).toHaveLength(11);
  });

  it('every fixture has 10 to 12 series values; the cycle fills pie1 to pie12 and git0 to git7', () => {
    for (const f of FIXTURES) {
      const s = seriesOf(f.colour);
      expect(s.length, f.name).toBeGreaterThanOrEqual(10);
      expect(s.length).toBeLessThanOrEqual(12);
      const o = mermaidThemeOf(f.colour);
      for (let i = 0; i < 12; i++) expect(o['pie' + (i + 1)]).toBe(s[i % s.length]);
      for (let i = 0; i < 8; i++) expect(o['git' + i]).toBe(s[i % s.length]);
    }
  });

  it('gitInv<n> equals git<n> for n in 0 to 7', () => {
    for (const f of FIXTURES) {
      const o = mermaidThemeOf(f.colour);
      for (let n = 0; n < 8; n++) expect(o['gitInv' + n], f.name).toBe(o['git' + n]);
    }
  });

  it('with no equal pair the series has twelve values and pie12 is text', () => {
    const c = { ...PHOSPHOR, ok: '#123456' };
    expect(seriesOf(c)).toHaveLength(12);
    expect(mermaidThemeOf(c).pie12).toBe(PHOSPHOR.text.toLowerCase());
  });
});

describe('isAuthorStyled', () => {
  const styled: [string, string][] = [
    ['classDef', 'flowchart LR\n  A-->B\n  classDef hot fill:#D4EDDA\n'],
    ['style', 'flowchart LR\nA-->B\nstyle A fill:#D4EDDA'],
    ['linkStyle', 'flowchart LR\nA-->B\nlinkStyle 0 stroke:#ff0000'],
    ['rect', 'sequenceDiagram\nrect rgb(212, 237, 218)\nA->>B: hi\nend'],
    ['box', 'sequenceDiagram\nbox Team\nparticipant A\nend'],
    ['box with a colour', 'sequenceDiagram\nbox rgb(1,2,3) Team\nparticipant A\nend'],
    ['todayMarker', 'gantt\ntodayMarker stroke:#000000'],
    ['upper-case STYLE', 'flowchart LR\nSTYLE A fill:#D4EDDA'],
    ['mixed-case RECT', 'sequenceDiagram\nRECT rgb(212, 237, 218)'],
    ['mixed-case TodayMarker', 'gantt\nTodayMarker off'],
    ['after a semicolon', 'flowchart LR\nA-->B; style A fill:#D4EDDA'],
    ['tab-indented', 'flowchart LR\nA-->B\n\t\tclassDef hot fill:#D4EDDA'],
    ['indented with spaces', 'flowchart LR\n    style A fill:red'],
    ['head at the statement end', 'sequenceDiagram\nbox'],
    ['carriage returns', 'flowchart LR\r\nA-->B\r\nstyle A fill:red\r\n'],
    ['head on the first line', 'style A fill:red'],
    ['state diagram style', 'stateDiagram-v2\n  [*] --> A\n  style A fill:#D4EDDA'],
    ['class diagram classDef', 'classDiagram\nclass A\nclassDef hot fill:#D4EDDA'],
    ['font element', 'flowchart LR\nA["<font color=\'#ff0000\'>x</font>"]-->B'],
    ['mark element', 'flowchart LR\nA["<mark>x</mark>"]-->B'],
    ['table bgcolor', "flowchart LR\nA[\"<table bgcolor='#0000ff'><tr><td>x</td></tr></table>\"]-->B"],
    ['bold in a sequence message', 'sequenceDiagram\nA->>B: <b>hi</b>'],
    ['mark in a class', 'classDiagram\nclass A {\n  +<mark>x</mark>\n}'],
    ['mark in a state', 'stateDiagram-v2\nA: <mark>x</mark>'],
    ['closing tag', 'flowchart LR\nA["x</i>"]-->B'],
    ['element after an annotation', 'classDiagram\n<<interface>> A\nA : <b>x</b>'],
    ['element after one angle', 'flowchart LR\nA["x <b>y"]-->B'],
    ['element after a space-less arrow', 'sequenceDiagram\nA->>B:<i>x'],
    ['br1 is an element', 'flowchart LR\nA["x<br1>"]-->B'],
    ['br-x is an element', 'flowchart LR\nA["x<br-x>"]-->B'],
    ['closing br1 is an element', 'flowchart LR\nA["x</br1>"]-->B'],
    ['lone carriage return', 'flowchart LR\rstyle A fill:red'],
    ['br-like element brx', 'flowchart LR\nA["x<brx>"]-->B'],
    ['unterminated front matter does not hide it', '---\ntitle: x\nflowchart LR\nstyle A fill:red'],
    ['element in the body after front matter', '---\ntitle: x\n---\nflowchart LR\nA["<b>x</b>"]-->B'],
    // Review 2906 F5, ruled by ccrc D-8826: the scan errs toward author-styled. A head starts a statement wherever the
    // bundled Mermaid's lexer can start one, including after a closing token on the same line (a subgraph's `end`, a
    // state's `}`) and in ER, where statements need no separator; `rect` takes a `:` as its end; and only a `<<name>>`
    // annotation is spared by the `<` rule (a second `<` followed by a letter starts a tag in the HTML tokenizer).
    ['flowchart: end then style', 'flowchart LR\nsubgraph S\nA\nend style A fill:#f00'],
    ['flowchart: end then classDef', 'flowchart LR\nsubgraph S\nA\nend classDef hot fill:#f00'],
    ['flowchart: end then linkStyle', 'flowchart LR\nA-->B\nsubgraph S\nA\nend linkStyle 0 stroke:#f00'],
    ['state: closing brace then style', 'stateDiagram-v2\nstate X {\n[*] --> Y\n} style X fill:#f00'],
    ['state: closing brace, no space, then style', 'stateDiagram-v2\nstate X {\n[*] --> Y\n}style X fill:#f00'],
    ['er: separator-less style after a relation', 'erDiagram\nA ||--o{ B : has style A fill:#f00'],
    ['er: style after an entity block', 'erDiagram\nA {\nstring x\n} style A fill:#f00'],
    ['er: classDef after a relation', 'erDiagram\nA ||--o{ B : has classDef hot fill:#f00'],
    ['sequence: rect with a colon, wrap', 'sequenceDiagram\nrect:wrap:rgb(255,0,0)\nA->>B: hi\nend'],
    ['sequence: rect with a colon, nowrap', 'sequenceDiagram\nrect:nowrap:red\nA->>B: hi\nend'],
    ['head ended by a colon', 'flowchart LR\nstyle:A fill:#f00'],
    ['two angles then an element', 'flowchart LR\nA["<<font color=red>x<</font>"]-->B'],
    ['two angles then a mark', 'flowchart LR\nA["<<mark>y"]-->B'],
    ['an annotation does not hide the element after it', 'classDiagram\n<<interface>><b>A</b>'],
    ['three angles then an element', 'flowchart LR\nA["<<<b>x"]-->B'],
    ['semicolon then a head with no space', 'flowchart LR\nA-->B;style A fill:red'],
    ['style after a closed directive', '%%{init: {"theme": "dark"}}%%\nflowchart LR\nstyle A fill:red'],
    ['a directive never closed keeps what follows in the scan', '%%{init: {"theme": "dark"}\nflowchart LR\nstyle A fill:red'],
  ];
  it.each(styled)('is true: %s', (_n, text) => expect(isAuthorStyled(text)).toBe(true));

  const plain: [string, string][] = [
    ['interface annotation', 'classDiagram\nclass A\n<<interface>> A\n'],
    ['fork annotation', 'stateDiagram-v2\nstate fork <<fork>>\n[*] --> fork'],
    ['x < y', 'flowchart LR\nA["x < y"]-->B'],
    ['x < y at the line start', 'flowchart LR\nA["\n< y"]-->B'],
    ['inheritance arrow', 'classDiagram\nA <|-- B'],
    ['two-way arrow', 'flowchart LR\nA <--> B'],
    ['async arrow', 'sequenceDiagram\nA <<->> B: x'],
    ['click line', 'flowchart LR\nA-->B\nclick A "https://example.org" "tip"'],
    ['br', 'flowchart LR\nA["x<br>y"]-->B'],
    ['br self-closed', 'flowchart LR\nA["x<br/>y<br />z"]-->B'],
    ['br at the end of the text', 'flowchart LR\nA-->B["x<br'],
    ['BR upper-case and a closing tag', 'flowchart LR\nA["x<BR>y</br>z"]-->B'],
    ['heads as a prefix of a longer word', 'flowchart LR\nstyles A\nboxed B\nrectangle C\nclassDefs D'],
    ['head inside a statement', 'flowchart LR\nA["style x"]-->B'],
    ['front matter hides its own heads', '---\ntitle: <b>x</b>\nconfig:\n  theme: base\nstyle: x\n---\nflowchart LR\nA-->B'],
    ['empty text', ''],
    ['front matter closed by lone carriage returns hides its heads', '---\rtitle: x\rstyle: y\r---\rflowchart LR\rA-->B'],
    ['a directive naming rect in its themeCSS', '%%{init: {"themeCSS": ".node rect { fill: red; }"}}%%\nflowchart LR\nA-->B'],
    ['choice annotation', 'stateDiagram-v2\nstate c <<choice>>\n[*] --> c'],
    ['join annotation', 'stateDiagram-v2\nstate j <<join>>\n[*] --> j'],
    ['abstract annotation with a hyphen', 'classDiagram\nclass A\n<<some-kind>> A'],
    ['async arrow with a hyphen', 'sequenceDiagram\nA <<-->> B: x'],
    ['heads fused to a word before', 'flowchart LR\nrestyle A\nprefix B\nunbox C'],
    ['heads with a word after', 'flowchart LR\nstyleX A\nboxes B\nclassDefs C\nrects D\nlinkStyles E\ntodayMarkers F'],
    ['a head word quoted in a label', 'flowchart LR\nA["classDef"]-->B'],
    ['flowchart', 'flowchart TD\n  A[Start] --> B{Ok?}\n  B -->|yes| C[Done]\n  B -->|no| A'],
    ['sequence', 'sequenceDiagram\n  participant A\n  A->>B: ping\n  loop Every minute\n    B-->>A: pong\n  end'],
    ['class', 'classDiagram\n  class Animal {\n    +String name\n  }\n  Animal <|-- Dog'],
    ['state', 'stateDiagram-v2\n  [*] --> Idle\n  Idle --> Busy: go\n  Busy --> [*]'],
    ['gantt', 'gantt\n  title Plan\n  dateFormat YYYY-MM-DD\n  section A\n  Task :a1, 2026-01-01, 3d'],
    ['pie', 'pie title Pets\n  "Dogs" : 386\n  "Cats" : 85'],
    ['er', 'erDiagram\n  CUSTOMER ||--o{ ORDER : places'],
    ['gitGraph', 'gitGraph\n  commit\n  branch dev\n  commit\n  checkout main\n  merge dev'],
  ];
  it.each(plain)('is false: %s', (_n, text) => expect(isAuthorStyled(text)).toBe(false));

  // Review 2906 F5: the widened scan keeps test 5's covered fixtures (the eight kinds, the flowchart twice) not author-styled.
  it.each(['flowchart', 'flowchart-svg-labels', 'sequence', 'class', 'state', 'gantt', 'pie', 'er', 'gitgraph', 'directives', 'directives-front-matter'])(
    'is false for the covered fixture %s',
    (name) => {
      const text = readFileSync(new URL(`../conformance/appearance/mermaid/${name}.mmd`, import.meta.url), 'utf8');
      expect(isAuthorStyled(text)).toBe(false);
    },
  );

  // Linear on a run of blank lines (review of Task 3, finding 1): a body of Mermaid's 50 000-character cap of line breaks,
  // and twice that, each judged well inside the time a quadratic scan took (1.3 s and 4.9 s, measured).
  it('stays linear on a run of line breaks', () => {
    for (const n of [50_000, 100_000]) {
      const t0 = performance.now();
      expect(isAuthorStyled(`flowchart LR${'\n'.repeat(n)}A`)).toBe(false);
      expect(performance.now() - t0, String(n)).toBeLessThan(200);
    }
  });

  // Review 2906 F5: the widened heads, the annotation strip and the directive strip stay linear too.
  it.each([
    ['unclosed directives', (n: number) => '%%{'.repeat(n)],
    ['closed directives', (n: number) => '%%{}%%'.repeat(n / 6)],
    ['unclosed annotations', (n: number) => '<<a'.repeat(n / 3)],
    ['spaces', (n: number) => `${' '.repeat(n)}x`],
    ['closing braces', (n: number) => '}'.repeat(n)],
    ['head-like words', (n: number) => 'styl '.repeat(n / 5)],
  ])('stays linear on %s', (_name, make) => {
    for (const n of [50_000, 100_000]) {
      const text = make(n);
      const t0 = performance.now();
      isAuthorStyled(text);
      expect(performance.now() - t0, String(n)).toBeLessThan(200);
    }
  });
});
