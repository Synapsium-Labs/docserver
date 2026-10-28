// What the sealed frame's browser files share (docserver L3, Task 8): the frame assets built in memory, the inputs and
// srcdocs the rows mount, the corpus walks, the string surgery that breaks a valid srcdoc, the port-message readers, a
// wait that tolerates a loaded machine, and the measurement lines. Moved here from test/browser/frame-boot.test.ts
// (Task 5's file) so its rows and Task 8's (frame-csp, frame-mermaid, frame-measure and frame-pins) run the same code;
// a test file cannot be imported without registering its tests, so the helpers live in this module.
//
// Release bytes only (plan Global Constraints): nothing here reaches into the frame through the shipped scripts. The
// assets are the exact bytes `node scripts/build-frame.mjs` writes, built in memory; frameDocument verifies them
// against the committed manifest, so a row runs only on bytes the manifest names.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect } from 'vitest';
import { buildFrame } from '../../scripts/build-frame.mjs';
import { FRAME_MANIFEST, frameCsp, frameDocument, type FrameAssets, type FrameOptions, type RenderInput } from '../../src/frame/index.js';
import { render } from '../../src/render/index.js';
import type { FrameHost, HostRecord } from './frame-host-page.js';
import type { BrowserName } from './harness.js';

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const CORPUS = path.join(ROOT, 'conformance', 'corpus');
/** The opt-in measurement rows (the 2 MiB document): DOCREADER_MEASURE=1. */
export const MEASURE = process.env['DOCREADER_MEASURE'] === '1';

/** The frame's assets as the build writes them, and Mermaid's frame file. */
export interface BuiltFrame {
  readonly assets: FrameAssets;
  readonly mermaid: string;
  /** The free-global list the built bootstrap carries (DOCSERVER_FREE_GLOBALS). */
  readonly freeGlobals: readonly string[];
}

/** Build the frame in memory, exactly as `node scripts/build-frame.mjs` writes it. */
export async function loadFrame(): Promise<BuiltFrame> {
  const built = await buildFrame();
  return {
    assets: { guard: built.files.guard.text, bootstrap: built.files.bootstrap.text, enhance: built.files.enhance.text, css: built.files.css.text },
    mermaid: built.files.mermaid.text,
    freeGlobals: built.freeGlobals.names,
  };
}

export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** 128 bits fresh from crypto.getRandomValues, lower-case hex. */
export function freshNonce(): string {
  const b = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

/** render(markdown) as frameDocument takes it; a document that does not render is a test error. */
export function input(markdown: string): RenderInput {
  const r = render(markdown);
  if (r.outcome !== 'rendered') throw new Error(`did not render (${r.outcome})`);
  return { result: { outcome: r.outcome, html: r.html, meta: { title: r.meta.title, frontList: r.meta.frontList } } };
}

/** The plain corpus document most rows mount. */
export const PLAIN = (): string => readFileSync(path.join(CORPUS, 'headings.md'), 'utf8');

/** Every corpus document, by path. */
export function corpusFiles(dir = CORPUS): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? corpusFiles(path.join(dir, e.name)) : e.name.endsWith('.md') ? [path.join(dir, e.name)] : [],
  );
}

/** The corpus document whose rendered html is longest. */
export function largest(): { file: string; markdown: string; html: number } {
  let best = { file: '', markdown: '', html: -1 };
  for (const f of corpusFiles()) {
    const md = readFileSync(f, 'utf8');
    const r = render(md);
    if (r.outcome === 'rendered' && r.html.length > best.html) best = { file: path.relative(ROOT, f), markdown: md, html: r.html.length };
  }
  return best;
}

/** The golden and hostile corpus documents (the generated inputs are the unit half's, test/frame-runtime.test.ts). */
export function corpusDocuments(): { id: string; markdown: string }[] {
  const manifest = JSON.parse(readFileSync(path.join(ROOT, 'conformance', 'manifest.json'), 'utf8')) as { id: string; kind: string }[];
  return manifest.filter((e) => e.kind !== 'generated').map((e) => ({ id: e.id, markdown: readFileSync(path.join(CORPUS, `${e.id}.md`), 'utf8') }));
}

/** A srcdoc for `markdown` under frameCsp(), with the given assets and options (Mermaid off unless `options` says). */
export function srcdocFor(assets: FrameAssets, markdown: string, nonce: string, options: Partial<FrameOptions> = {}): string {
  return frameDocument(input(markdown), { csp: frameCsp(), nonce, assets, ...options });
}

/** The data of every port message on `port`, in order. */
export const data = (rec: HostRecord, port = 'main'): unknown[] => rec.messages.filter((m) => m.port === port).map((m) => m.data);

/** The ops of `rec` on `port` of the given kinds. */
export const opsOf = (rec: HostRecord, kinds: readonly string[], port = 'main'): unknown[] => data(rec, port).filter((m) => kinds.includes((m as { t: string }).t));

/** The console's Content Security Policy messages that match `directive`. */
export const refusals = (host: FrameHost, directive: RegExp): string[] => host.cspConsole.filter((m) => directive.test(m));

/** `srcdoc` with its policy `good` (written once, in the meta) replaced by `bad`. */
export function withPolicy(srcdoc: string, good: string, bad: string): string {
  expect(bad).not.toBe(good);
  expect(srcdoc.indexOf(good)).toBeGreaterThan(0);
  expect(srcdoc.indexOf(good, srcdoc.indexOf(good) + 1)).toBe(-1);
  return srcdoc.replace(good, bad);
}

/** The CSP hash source of a script's exact text. */
export const hashOf = (text: string): string => `'sha256-${createHash('sha256').update(text, 'utf8').digest('base64')}'`;

/**
 * `srcdoc` (a valid frameDocument output under `policy`) with the script `which` replaced by `text`, its hash re-pinned
 * in the meta: answers the new srcdoc and the policy that goes with it. Enhance is the script right after the style;
 * Mermaid the last one.
 */
export function replaceScript(srcdoc: string, policy: string, which: 'enhance' | 'mermaid', text: string): { srcdoc: string; policy: string } {
  const open = which === 'enhance' ? srcdoc.indexOf('</style><script>') + '</style><script>'.length : srcdoc.lastIndexOf('<script>') + '<script>'.length;
  const close = srcdoc.indexOf('</script>', open);
  expect(open).toBeGreaterThan('<script>'.length);
  expect(close).toBeGreaterThan(open);
  const old = srcdoc.slice(open, close);
  expect(hashOf(old)).toBe(FRAME_MANIFEST[which].csp);
  const next = policy.replace(FRAME_MANIFEST[which].csp, hashOf(text));
  return { srcdoc: withPolicy(srcdoc.slice(0, open) + text + srcdoc.slice(close), policy, next), policy: next };
}

/** A script that registers `api` under `name` on its own element, as the shipped scripts do. */
export const registering = (name: string, api: string): string =>
  `document.currentScript.dispatchEvent(new CustomEvent('docserver:register',{bubbles:true,detail:Object.freeze({name:'${name}',api:Object.freeze(${api})})}));\n`;

/** The text each drawn figure's SVG shows (its labels; not its style element, whose selectors name a fresh id), in order. */
export const svgTexts = (h: FrameHost): Promise<string[]> =>
  h.frame().evaluate(() =>
    Array.from(document.querySelectorAll('figure.mermaid-figure svg'), (svg) => {
      const out: string[] = [];
      const walk = document.createTreeWalker(svg, NodeFilter.SHOW_TEXT);
      for (let n = walk.nextNode(); n !== null; n = walk.nextNode()) if (n.parentElement?.closest('style') === null) out.push(n.nodeValue ?? '');
      return out.join('|');
    }),
  );

/** The ready the frame must send first: ready{v:1,nonce}. */
export const readyOf = (nonce: string): { t: 'ready'; v: 1; nonce: string } => ({ t: 'ready', v: 1, nonce });

/** One flowchart, one sequence diagram and one gantt (the prototype's P7 document). */
export const DIAGRAMS = `# Diagrams

\`\`\`mermaid
flowchart LR
  A[Start] --> B{Choice}
  B -->|yes| C[Done]
  B -->|no| A
\`\`\`
*Figure 1. A flowchart.*

\`\`\`mermaid
sequenceDiagram
  participant P as Parent
  participant F as Frame
  P->>F: hello
  F-->>P: ready
\`\`\`
*Figure 2. A sequence.*

\`\`\`mermaid
gantt
  title Plan
  dateFormat YYYY-MM-DD
  section Build
  First :a1, 2026-01-05, 3d
  Second :after a1, 2d
\`\`\`
*Figure 3. A gantt.*
`;

/**
 * One figure of each diagram kind the frame's Mermaid draws, each with its caption. The corpus draws flowcharts and
 * sequence diagrams only; these reach the rest of Mermaid's code (its layouts read several of the free globals).
 */
export const KINDS: readonly (readonly [string, string])[] = [
  ['flowchart', 'flowchart LR\n  A[Start] --> B{Choice}\n  B -->|yes| C[Done]\n  B -->|no| A'],
  ['sequence', 'sequenceDiagram\n  participant P as Parent\n  participant F as Frame\n  P->>F: hello\n  F-->>P: ready\n  Note over P,F: one port'],
  ['gantt', 'gantt\n  title Plan\n  dateFormat YYYY-MM-DD\n  section Build\n  First :a1, 2026-01-05, 3d\n  Second :after a1, 2d'],
  ['class', 'classDiagram\n  class Reader {\n    +theme\n    +open()\n  }\n  Reader <|-- Frame'],
  ['state', 'stateDiagram-v2\n  [*] --> Booting\n  Booting --> Settled\n  Booting --> Failed\n  Settled --> [*]'],
  ['er', 'erDiagram\n  DOCUMENT ||--o{ FIGURE : holds\n  FIGURE {\n    string caption\n  }'],
  ['pie', 'pie title Parts\n  "Guard" : 1\n  "Bootstrap" : 3\n  "Enhance" : 6'],
  ['mindmap', 'mindmap\n  root((Frame))\n    Guard\n    Bootstrap\n      Seed\n    Enhance'],
  ['journey', 'journey\n  title One load\n  section Boot\n    Seed: 5: Frame\n    Ready: 4: Parent'],
  ['timeline', 'timeline\n  title Waves\n  First : Protocol\n  Second : Frame'],
  // Each commit named: an unnamed commit's label is random.
  ['gitgraph', 'gitGraph\n  commit id: "one"\n  branch work\n  commit id: "two"\n  checkout main\n  merge work id: "three"'],
];

export const KINDS_DOC = `# Kinds\n\n${KINDS.map(([name, src], i) => `\`\`\`mermaid\n${src}\n\`\`\`\n*Figure ${String(i + 1)}. A ${name} diagram.*\n`).join('\n')}`;

/**
 * How long waitProgress waits with no progress before it gives up, how much longer polls that wait on a busy frame may
 * stretch that (in all, since the last progress), how long one poll may wait, and its hard cap.
 */
export const STALL_MS = 20_000;
export const BUSY_MS = 60_000;
export const POLL_MS = 5000;
export const WAIT_CAP_MS = 180_000;

/** What waitProgress saw: the record, how long it took, whether it waited past its stall, and whether it gave up. */
export interface Waited {
  readonly rec: HostRecord;
  readonly ms: number;
  readonly extended: boolean;
  /** True when the wait ended without `n` messages: the frame stopped moving, or the cap passed. */
  readonly gaveUp: boolean;
}

const BUSY = Symbol('busy');

/** `p`, or BUSY when it has not settled within `ms`. */
const within = <T>(p: Promise<T>, ms: number): Promise<T | typeof BUSY> => Promise.race([p, sleep(ms).then((): typeof BUSY => BUSY)]);

/** A record with nothing in it: what the wait answers when it gives up and the page cannot be read. */
const EMPTY: HostRecord = { messages: [], loads: [], closes: [], windowMessages: [], closeSupported: false, insertedAt: 0 };

/**
 * Wait until the page's ports hold `n` messages, failing only when the frame makes no progress for `stallMs` (or the
 * hard cap passes). Measured 2026-10-27 under a load average of 56 to 64: L3.B10's flat 20 s per document failed once
 * on one document that passed alone in 48 s. A flat deadline reads a starved machine as a broken frame; this wait reads
 * a frame that stops moving as one, which is what the rows mean to catch. Progress is any change of what the parent can
 * see from outside: the port messages, the loads (the page's record), and the frame's ready state, its element count
 * and its content root's attributes (the reader writes them as it enhances). A poll that waits on a busy frame (the
 * record or the frame unanswered within POLL_MS, or a poll over a second) is not progress: it can only stretch the
 * stall, by the time it waited, up to `busyMs` in all since the last progress. So a frame whose thread never yields is
 * given up on after `stallMs + busyMs` (or the cap), and a loaded machine still gets that much grace (review finding S3;
 * the wait's control row in frame-csp.test.ts pins it). Nothing is retried: a document gets one mount. A wait that ran
 * past `stallMs`, or gave up, is printed as a `frame-wait:` line, so a slow document stays visible in the log.
 */
export async function waitProgress(host: Pick<FrameHost, 'record' | 'frame'>, n: number, label: string, stallMs = STALL_MS, capMs = WAIT_CAP_MS, busyMs = BUSY_MS): Promise<Waited> {
  const start = Date.now();
  let rec: HostRecord | null = null;
  let lastRec = '';
  let lastFrame = '';
  let moved = start;
  let busy = 0;
  for (;;) {
    const polled = Date.now();
    const got = await within(host.record(), POLL_MS);
    if (got !== BUSY) {
      rec = got;
      if (got.messages.length >= n) {
        const ms = Date.now() - start;
        if (ms > stallMs) console.warn(`frame-wait: ${JSON.stringify({ label, ms, messages: got.messages.length })}`);
        return { rec: got, ms, extended: ms > stallMs, gaveUp: false };
      }
    }
    const seen =
      got === BUSY
        ? BUSY
        : await within(
            host
              .frame()
              .evaluate(() => {
                const root = document.body.querySelector(':scope > article');
                return [document.readyState, document.getElementsByTagName('*').length, root === null ? '' : Array.from(root.attributes, (a) => `${a.name}=${a.value}`).join(' ')].join('|');
              })
              .catch(() => 'no frame'),
            POLL_MS,
          );
    const after = Date.now();
    const recPart = got === BUSY ? null : `${String(got.messages.length)}|${String(got.loads.length)}`;
    const framePart = seen === BUSY ? null : seen;
    const progressed = (recPart !== null && recPart !== lastRec) || (framePart !== null && framePart !== lastFrame);
    if (recPart !== null) lastRec = recPart;
    if (framePart !== null) lastFrame = framePart;
    if (progressed) {
      moved = after;
      busy = 0;
    } else if (got === BUSY || seen === BUSY || after - polled > 1000) {
      busy += after - polled;
    }
    if (after - moved > stallMs + Math.min(busy, busyMs) || after - start > capMs) {
      console.warn(`frame-wait: ${JSON.stringify({ label, gaveUp: true, ms: after - start, stalledMs: after - moved, busyMs: busy, signature: `${lastRec}|${lastFrame}` })}`);
      const final = await within(host.record(), POLL_MS);
      return { rec: final !== BUSY ? final : (rec ?? EMPTY), ms: after - start, extended: true, gaveUp: true };
    }
    await sleep(100);
  }
}

/**
 * One measured figure as a greppable line: `frame-figure: <row> <engine> <name>=<value>`, one line per figure, so CI's
 * log gives each engine's figures by `grep frame-figure:`.
 */
export function figure(row: string, browser: BrowserName, name: string, value: number | string): void {
  console.warn(`frame-figure: ${row} ${browser} ${name}=${typeof value === 'number' ? String(Number(value.toFixed(2))) : value}`);
}

/** A context line for a measurement (which document, how long its srcdoc is), as JSON. */
export function measure(label: string, browser: BrowserName, values: Record<string, unknown>): void {
  console.warn(`frame-measure: ${JSON.stringify({ label, browser, ...values })}`);
}

/** The median of `xs` (the mean of the middle two for an even count). */
export function median(xs: readonly number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? (s[m] ?? NaN) : ((s[m - 1] ?? NaN) + (s[m] ?? NaN)) / 2;
}
