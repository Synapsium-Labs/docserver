// Visual comparison of two pages that show the same rendered document (docserver L2, Task 6).
//
//   node scripts/visual/compare.mjs --ours <page> --reference <page> [--states <list>] [--expected <file>] [--setup <module>]
//
// A page is a URL (http, https or file) or a path to an HTML file. The reference page is given by argument only:
// no tracked file names it. In Chromium (the pinned playwright-core build), at 1440×1000 ("desktop") and 390×844
// ("phone"), in each state (default light, dark and sans-wide), it opens both pages, screenshots each, and measures
// every element that carries render()'s `data-line` attribute: its box (x from the column's origin, width, height)
// and its computed values for PROPS. Blocks are matched by tag and source lines (`p@12-14`, then `#1`, `#2` for
// repeats). The column's origin is the x of the first block both pages hold, so a page that shifts its column
// beside its own chrome is measured from the same place. A box differs by more than TOLERANCE px; a computed value
// in px likewise; any other value differs when its text does, except font-family, which is compared by its generic
// family (the last in the list), since the library names its own faces.
//
// --expected <file> names the differences a task expects: a JSON list of { "name", "blocks"?, "props"?, "combos"? },
// each list a set of patterns where `*` matches any run of characters (absent: every one). A difference that an
// entry matches is reported under that entry's name; any other is unexpected. A prop pattern sees the computed
// property names, `box.x`, `box.width`, `box.height`, and `present` (a block that only one page holds).
//
// --setup <module> adapts a page: it may export init({ side, state, prefs, context }) (before the page loads),
// url({ side, state, prefs, url }) (the address to open; default: the page with theme, width and font in its
// query), act({ side, state, page }) (after it is ready: a named state is made here), and ready({ side, state,
// page }) (replaces the default wait: load, `data-ready` on <html> not "false", the fonts, then a short settle).
// A state other than the three built in needs a setup module with act().
//
// Output, in visual-out/ under the current directory (git-ignored): <combo>-ours.png, <combo>-reference.png,
// measure.json and report.txt, where a combo is <viewport>-<state>. Exit 0 when every difference is expected,
// 1 when one is not, 2 on a usage error. Dev tooling, never shipped; the pure parts are exported for
// test/visual-compare.test.ts.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const VIEWPORTS = Object.freeze({ desktop: { width: 1440, height: 1000 }, phone: { width: 390, height: 844 } });

/** The built-in states, as the prefs each sets. */
export const STATES = Object.freeze({
  light: { theme: 'light', width: 'standard', font: 'serif' },
  dark: { theme: 'dark', width: 'standard', font: 'serif' },
  'sans-wide': { theme: 'light', width: 'wide', font: 'sans' },
});

/** The computed values compared per block. */
export const PROPS = Object.freeze([
  'display', 'position', 'boxSizing', 'width', 'maxWidth', 'minWidth', 'height', 'marginTop', 'marginRight', 'marginBottom',
  'marginLeft', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'fontFamily', 'fontSize', 'fontWeight',
  'fontStyle', 'lineHeight', 'letterSpacing', 'textTransform', 'textAlign', 'color', 'backgroundColor', 'borderTopWidth',
  'borderTopStyle', 'borderTopColor', 'borderRightWidth', 'borderRightColor', 'borderBottomWidth', 'borderBottomStyle',
  'borderBottomColor', 'borderLeftWidth', 'borderLeftStyle', 'borderLeftColor', 'borderRadius', 'opacity',
  'textDecorationLine', 'listStyleType', 'fontVariantNumeric', 'verticalAlign', 'overflowX',
]);

/** How far apart two lengths may be, in px, and still count as equal. */
export const TOLERANCE = 0.1;

export const USAGE =
  'usage: node scripts/visual/compare.mjs --ours <page> --reference <page> [--states <list>] [--expected <file>] [--setup <module>]';

/** The command line, read; throws USAGE (or a reason) on anything else. */
export function parseArgs(argv) {
  const out = { ours: undefined, reference: undefined, states: Object.keys(STATES), expected: undefined, setup: undefined };
  const flags = { '--ours': 'ours', '--reference': 'reference', '--states': 'states', '--expected': 'expected', '--setup': 'setup' };
  const seen = new Set();
  for (let i = 0; i < argv.length; i += 2) {
    const key = flags[argv[i]];
    const value = argv[i + 1];
    if (key === undefined || value === undefined || value === '' || seen.has(key)) throw new Error(USAGE);
    seen.add(key);
    out[key] = key === 'states' ? value.split(',').map((s) => s.trim()) : value;
  }
  if (out.ours === undefined || out.reference === undefined) throw new Error(USAGE);
  const badState = out.states.filter((s) => !/^[a-z0-9][a-z0-9-]*$/.test(s));
  if (out.states.length === 0 || badState.length > 0) throw new Error(`compare: bad state names ${JSON.stringify(badState)}`);
  return out;
}

/** A page argument as a URL: http, https and file URLs as given, anything else a path to a file. */
export function pageUrl(arg) {
  return /^(?:https?|file):/.test(arg) ? arg : pathToFileURL(path.resolve(arg)).href;
}

/** True when two lengths are within TOLERANCE (and a rounding error of the subtraction). */
const near = (a, b) => Math.abs(a - b) <= TOLERANCE + 1e-9;

const PX_LIST = /^-?\d+(?:\.\d+)?(?:e-?\d+)?px(?: -?\d+(?:\.\d+)?(?:e-?\d+)?px)*$/;

/** The generic family of a computed font-family: its last entry, unquoted, lower-cased. */
function generic(family) {
  const last = String(family).split(',').pop() ?? '';
  return last.trim().replace(/^["']|["']$/g, '').toLowerCase();
}

/** True when two computed values of `prop` count as equal. */
export function sameValue(prop, a, b) {
  if (a === b) return true;
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (prop === 'fontFamily') return generic(a) === generic(b);
  if (PX_LIST.test(a) && PX_LIST.test(b)) {
    const xs = a.split(' ').map(parseFloat);
    const ys = b.split(' ').map(parseFloat);
    return xs.length === ys.length && xs.every((x, i) => near(x, ys[i] ?? NaN));
  }
  return false;
}

/**
 * Every difference between two measurements of one combo (each a list of { key, box: { x, width, height }, style }),
 * as { block, prop, ours, reference }, in the order of `ours` (blocks only the reference holds last).
 */
export function diffBlocks(ours, reference) {
  const refs = new Map(reference.map((b) => [b.key, b]));
  const mine = new Set(ours.map((b) => b.key));
  const origin = ours.find((b) => refs.has(b.key));
  const ox = origin?.box.x ?? 0;
  const rx = origin === undefined ? 0 : (refs.get(origin.key)?.box.x ?? 0);
  const out = [];
  for (const o of ours) {
    const r = refs.get(o.key);
    if (r === undefined) {
      out.push({ block: o.key, prop: 'present', ours: 'yes', reference: 'no' });
      continue;
    }
    const boxes = [['box.x', o.box.x - ox, r.box.x - rx], ['box.width', o.box.width, r.box.width], ['box.height', o.box.height, r.box.height]];
    for (const [prop, a, b] of boxes) {
      if (!near(a, b)) out.push({ block: o.key, prop, ours: round(a), reference: round(b) });
    }
    for (const prop of PROPS) {
      if (!sameValue(prop, o.style[prop], r.style[prop])) out.push({ block: o.key, prop, ours: o.style[prop], reference: r.style[prop] });
    }
  }
  for (const r of reference) if (!mine.has(r.key)) out.push({ block: r.key, prop: 'present', ours: 'no', reference: 'yes' });
  return out;
}

const round = (n) => Math.round(n * 100) / 100;

/** A pattern where `*` matches any run of characters, as a test. */
function glob(pattern) {
  const re = new RegExp(`^${pattern.split('*').map((p) => p.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`);
  return (s) => re.test(s);
}

/** The --expected file, checked: a list of { name, blocks?, props?, combos? }, each list of non-empty strings. */
export function parseExpected(text) {
  const list = JSON.parse(text);
  if (!Array.isArray(list)) throw new Error('compare: the expected file is a JSON list');
  return list.map((e, i) => {
    const where = `compare: expected entry ${String(i)}`;
    if (typeof e !== 'object' || e === null || Array.isArray(e)) throw new Error(`${where} is not an object`);
    const unknown = Object.keys(e).filter((k) => !['name', 'blocks', 'props', 'combos'].includes(k));
    if (unknown.length > 0) throw new Error(`${where} has unknown keys ${JSON.stringify(unknown)}`);
    if (typeof e.name !== 'string' || e.name === '') throw new Error(`${where} needs a name`);
    for (const k of ['blocks', 'props', 'combos']) {
      if (e[k] !== undefined && !(Array.isArray(e[k]) && e[k].length > 0 && e[k].every((s) => typeof s === 'string' && s !== ''))) {
        throw new Error(`${where}: ${k} is a non-empty list of patterns`);
      }
    }
    return { name: e.name, blocks: e.blocks ?? ['*'], props: e.props ?? ['*'], combos: e.combos ?? ['*'] };
  });
}

/**
 * Sort one combo's differences: each is expected (the first entry that matches it, by name) or unexpected.
 * Returns { unexpected, expected: [[name, differences]], used: Set of names }.
 */
export function classify(combo, differences, entries) {
  const tests = entries.map((e) => ({ name: e.name, blocks: e.blocks.map(glob), props: e.props.map(glob), combos: e.combos.map(glob) }));
  const unexpected = [];
  const expected = new Map();
  for (const d of differences) {
    const hit = tests.find((t) => t.combos.some((m) => m(combo)) && t.blocks.some((m) => m(d.block)) && t.props.some((m) => m(d.prop)));
    if (hit === undefined) unexpected.push(d);
    else expected.set(hit.name, [...(expected.get(hit.name) ?? []), d]);
  }
  return { unexpected, expected: [...expected], used: new Set(expected.keys()) };
}

/** One difference as a report line. */
export function describeDifference(d) {
  return `${d.block} ${d.prop}: ours=${String(d.ours)} reference=${String(d.reference)}`;
}

/** Runs in the page: every [data-line] element's key, box and computed values. */
function measure(props) {
  const seen = new Map();
  const out = [];
  for (const el of Array.from(document.querySelectorAll('[data-line]'))) {
    const base = `${el.localName}@${el.getAttribute('data-line') ?? ''}`;
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const style = {};
    for (const p of props) style[p] = cs[p];
    out.push({ key: n === 0 ? base : `${base}#${String(n)}`, box: { x: r.x + window.scrollX, width: r.width, height: r.height }, style });
  }
  return out;
}

async function defaultReady(page) {
  await page.waitForLoadState('load');
  await page.waitForFunction(() => document.documentElement.getAttribute('data-ready') !== 'false');
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await page.waitForTimeout(800);
}

async function main(argv) {
  let args;
  try {
    args = parseArgs(argv);
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    return 2;
  }
  const setup = args.setup === undefined ? {} : await import(pathToFileURL(path.resolve(args.setup)).href);
  const named = args.states.filter((s) => !Object.hasOwn(STATES, s));
  if (named.length > 0 && typeof setup.act !== 'function') {
    console.error(`compare: the states ${named.join(', ')} need a --setup module that exports act()`);
    return 2;
  }
  const entries = args.expected === undefined ? [] : parseExpected(readFileSync(args.expected, 'utf8'));
  const pages = { ours: pageUrl(args.ours), reference: pageUrl(args.reference) };
  const out = path.resolve('visual-out');
  mkdirSync(out, { recursive: true });

  const { chromium } = await import('playwright-core');
  const browser = await chromium.launch();
  const report = [];
  const measured = {};
  let unexpectedCount = 0;
  const used = new Set();
  try {
    for (const [vName, viewport] of Object.entries(VIEWPORTS)) {
      for (const state of args.states) {
        const combo = `${vName}-${state}`;
        const prefs = STATES[state] ?? STATES.light;
        const got = {};
        for (const side of ['ours', 'reference']) {
          const context = await browser.newContext({ viewport, deviceScaleFactor: 1, colorScheme: 'light' });
          try {
            await setup.init?.({ side, state, prefs, context });
            const base = new URL(pages[side]);
            for (const [k, v] of Object.entries(prefs)) base.searchParams.set(k, v);
            const url = (await setup.url?.({ side, state, prefs, url: pages[side] })) ?? base.href;
            const page = await context.newPage();
            await page.goto(url);
            if (typeof setup.ready === 'function') await setup.ready({ side, state, page });
            else await defaultReady(page);
            await setup.act?.({ side, state, page });
            await page.screenshot({ path: path.join(out, `${combo}-${side}.png`), fullPage: true });
            got[side] = await page.evaluate(measure, [...PROPS]);
          } finally {
            await context.close();
          }
        }
        measured[combo] = got;
        const diffs = diffBlocks(got.ours, got.reference);
        const sorted = classify(combo, diffs, entries);
        for (const n of sorted.used) used.add(n);
        unexpectedCount += sorted.unexpected.length;
        const both = got.ours.filter((b) => got.reference.some((r) => r.key === b.key)).length;
        report.push(`${combo}: ${String(both)} blocks in both pages, ${String(diffs.length)} differences, ${String(sorted.unexpected.length)} unexpected`);
        for (const d of sorted.unexpected) report.push(`  UNEXPECTED ${describeDifference(d)}`);
        for (const [name, list] of sorted.expected) {
          report.push(`  expected (${name}): ${String(list.length)}`);
          for (const d of list) report.push(`    ${describeDifference(d)}`);
        }
      }
    }
  } finally {
    await browser.close();
  }
  const unused = entries.map((e) => e.name).filter((n) => !used.has(n));
  if (unused.length > 0) report.push(`expected entries that matched nothing: ${unused.join('; ')}`);
  report.push(`result: ${String(unexpectedCount)} unexpected differences`);
  writeFileSync(path.join(out, 'measure.json'), `${JSON.stringify(measured, null, 2)}\n`);
  writeFileSync(path.join(out, 'report.txt'), `${report.join('\n')}\n`);
  console.log(report.join('\n'));
  return unexpectedCount === 0 ? 0 : 1;
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}
