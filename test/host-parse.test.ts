// `./host`'s parser of what the frame sends (docserver L3, Task 9; plan Reference §11.3, row L3.H3; the first consumer's
// M8.5). parseBridgeMessage judges one frame-to-parent message: every case of conformance/bridge-cases.json with that
// direction gives its verdict and reason, `hash` goes through the one fragment grammar (isFragmentId), and an accepted
// message comes back as a fresh object holding only its op's keys. The parser is pure: it never throws, never reads a
// getter, and keeps nothing between calls. Every non-ASCII character in a string is written as an escape (ruling R6).
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { pngBytesOfBase64 } from '../src/frame/anchor.js';
import { isFragmentId } from '../src/frame/fragment.js';
import { BRIDGE_LIMITS, PLACE_KINDS } from '../src/frame/protocol.js';
import { parseBridgeMessage, PRINT_RUN_HANDED_MAX_BYTES, type ParseContext } from '../src/host/parse.js';

const ROOT = new URL('../', import.meta.url);
const readText = (rel: string): string => readFileSync(new URL(rel, ROOT), 'utf8');

interface Fill {
  readonly prefix?: string;
  readonly unit: string;
  readonly times: number;
  readonly suffix?: string;
}
interface MessageCase {
  readonly label: string;
  readonly direction: 'frame-to-parent' | 'parent-to-frame';
  readonly ports?: number;
  readonly message: unknown;
  readonly fill?: Readonly<Record<string, Fill>>;
  readonly given?: { readonly places?: boolean; readonly run?: { readonly n: number | null; readonly seen: readonly number[]; readonly bytes: number } };
  readonly verdict: 'accept' | 'refuse';
  readonly reason?: string;
}
interface BridgeCases {
  readonly context: { readonly nonce: string; readonly inFlightSha: string };
  readonly messages: readonly MessageCase[];
  readonly sequences: readonly { readonly label: string; readonly steps: readonly { readonly message: Record<string, unknown> }[] }[];
}

const CASES = JSON.parse(readText('conformance/bridge-cases.json')) as BridgeCases;
const NONCE = CASES.context.nonce;

/** A case's message with its fills applied (bridge-cases.json's `about`). */
function messageOf(c: MessageCase): unknown {
  if (c.fill === undefined) return c.message;
  const m = { ...(c.message as Record<string, unknown>) };
  for (const [k, f] of Object.entries(c.fill)) m[k] = `${f.prefix ?? ''}${f.unit.repeat(f.times)}${f.suffix ?? ''}`;
  return m;
}

/** `ports` transferred objects, as an event's `ports` array carries them. */
const portsOf = (n: number): readonly unknown[] => Array.from({ length: n }, () => ({}));

const FRAME_TO_PARENT = CASES.messages.filter((c) => c.direction === 'frame-to-parent');

/** What a case says the parent holds (bridge-cases.json's `given`): places, and the open print run. */
function contextOf(c: MessageCase): ParseContext {
  const run = c.given?.run;
  return { places: c.given?.places === true, run: run === undefined ? null : { n: run.n, seen: new Set(run.seen), bytes: run.bytes } };
}

describe('tsconfig.host.json: ./host typechecks in its own DOM project (Reference §12)', () => {
  // Task 10 (ledger C88(6)) moved src/host and its tests out of the root project, which has no DOM library, into this
  // one; the tests need Node's types, so the project has them, and test/host-walls.test.ts compiles src/host alone with
  // the DOM library and no ambient types, so the library still uses no Node API.
  it('extends the base, includes src/host and its tests, has the DOM lib and Node types for the tests', () => {
    const cfg = JSON.parse(readText('tsconfig.host.json')) as { extends: string; compilerOptions: Record<string, unknown>; include: string[]; exclude?: string[] };
    expect(cfg.extends).toBe('./tsconfig.json');
    expect(cfg.include).toEqual(['src/host', 'src/types/markdown-it-footnote.d.ts', 'test/host-*.test.ts']);
    expect(cfg.exclude).toEqual([]);
    expect(cfg.compilerOptions['lib']).toEqual(['ES2022', 'DOM', 'DOM.Iterable']);
    expect(cfg.compilerOptions['types']).toEqual(['node']);
  });

  it('the root project leaves src/host and its tests out (its library has no DOM)', () => {
    const cfg = JSON.parse(readText('tsconfig.json')) as { compilerOptions: Record<string, unknown>; exclude: string[] };
    expect(cfg.compilerOptions['lib']).toEqual(['ES2022']);
    expect(cfg.exclude).toContain('src/host');
    expect(cfg.exclude).toContain('test/host-*.test.ts');
  });
});

describe('L3.H3 every frame-to-parent case of conformance/bridge-cases.json', () => {
  it('there are cases of both verdicts to judge', () => {
    expect(FRAME_TO_PARENT.filter((c) => c.verdict === 'accept').length).toBeGreaterThanOrEqual(30);
    expect(FRAME_TO_PARENT.filter((c) => c.verdict === 'refuse').length).toBeGreaterThanOrEqual(40);
  });

  for (const c of FRAME_TO_PARENT) {
    it(c.label, () => {
      const got = parseBridgeMessage(messageOf(c), portsOf(c.ports ?? 0), NONCE, contextOf(c));
      if (c.verdict === 'accept') {
        // An accepted print-figure also reports what its text decodes to, read once by the parser.
        const m = messageOf(c) as { t: string; png?: string };
        expect(got).toEqual(m.t === 'print-figure' ? { ok: true, msg: m, bytes: pngBytesOfBase64(m.png as string) } : { ok: true, msg: m });
      }
      else expect(got).toEqual({ ok: false, reason: c.reason });
    });
  }

  it('every message of every timed sequence is accepted by the parser (only the limiter refuses them)', () => {
    for (const s of CASES.sequences) {
      for (const step of s.steps) expect(parseBridgeMessage(step.message, [], NONCE), s.label).toMatchObject({ ok: true });
    }
  });
});

describe('L3.H3 the nonce and the protocol of ready', () => {
  const ready = { t: 'ready', v: 1, nonce: NONCE };

  it("a ready is accepted only with this mount's nonce: another nonce, a shorter one or the same in upper case is refused", () => {
    expect(parseBridgeMessage(ready, [], NONCE)).toEqual({ ok: true, msg: ready });
    for (const nonce of ['f'.repeat(32), NONCE.slice(1), NONCE.toUpperCase(), '']) {
      expect(parseBridgeMessage({ ...ready, nonce }, [], NONCE), nonce).toEqual({ ok: false, reason: 'nonce' });
    }
  });

  it('the expected nonce is an argument: the same ready is refused against another mount\'s nonce', () => {
    expect(parseBridgeMessage(ready, [], 'a'.repeat(32))).toEqual({ ok: false, reason: 'nonce' });
  });

  it('a ready of any version but 1 is a protocol refusal, whatever its nonce', () => {
    for (const v of [0, 2, 1.5, -1, Number.NaN]) {
      expect(parseBridgeMessage({ ...ready, v }, [], NONCE), String(v)).toEqual({ ok: false, reason: 'protocol' });
    }
  });
});

describe('L3.H3 hash goes through isFragmentId, never the ID grammar alone', () => {
  const ID_GRAMMAR = /^[A-Z]{1,4}-?\d+(?:[.-]\d+)*[a-z]?$/;

  it('heading slugs, footnote ids and anchors that the ID grammar refuses are accepted', () => {
    for (const id of ['3-the-shared-library', 'heading-two', 'fn1', 'fnref1:1', 'anchor_1', '\u4e2d\u6587', 'cafe\u0301']) {
      expect(ID_GRAMMAR.test(id), id).toBe(false);
      expect(parseBridgeMessage({ t: 'hash', id }, [], NONCE), id).toEqual({ ok: true, msg: { t: 'hash', id } });
    }
  });

  it("agrees with isFragmentId on every id of a battery, the grammar's edges included", () => {
    const ids = [
      '', 'a', 'x'.repeat(256), 'x'.repeat(257), '\u{1D400}'.repeat(128), '\u{1D400}'.repeat(129), 'a b', 'a/b', '#x', 'a%20b',
      'a\u200bb', 'a\u00a0b', 'D2.1a', 'R14', 'OP-6', 'AB-12-C', 'a:b', 'a.b', 'a_b', 'a-b', 'a\\b', 'a?b', '\u0661\u0662',
      '\u0301', 'a\u0000', '\ud800', 'x\ufeff',
    ];
    for (const id of ids) {
      const got = parseBridgeMessage({ t: 'hash', id }, [], NONCE);
      expect(got, JSON.stringify(id.slice(0, 12))).toEqual(isFragmentId(id) ? { ok: true, msg: { t: 'hash', id } } : { ok: false, reason: 'hash' });
    }
  });
});

describe('B7.1 progress: thousands of the share as a string, judged by its grammar, with the existing reasons only', () => {
  it("every '0' to '1000' is accepted, and each string outside the grammar is a 'type' refusal", () => {
    for (let n = 0; n <= 1000; n++) expect(parseBridgeMessage({ t: 'progress', p: String(n) }, [], NONCE), String(n)).toEqual({ ok: true, msg: { t: 'progress', p: String(n) } });
    for (const p of ['1001', '2000', '-1', '-0', '5.5', '05', '00', '+5', '1e2', ' 5', '5 ', '0x1', '', '10000', '\u0665']) {
      expect(parseBridgeMessage({ t: 'progress', p }, [], NONCE), JSON.stringify(p)).toEqual({ ok: false, reason: 'type' });
    }
  });

  it("a missing p and an extra key are 'keys'; a number, null and an array are 'type'", () => {
    expect(parseBridgeMessage({ t: 'progress' }, [], NONCE)).toEqual({ ok: false, reason: 'keys' });
    expect(parseBridgeMessage({ t: 'progress', p: '5', q: '6' }, [], NONCE)).toEqual({ ok: false, reason: 'keys' });
    for (const p of [5, null, ['5'], true]) expect(parseBridgeMessage({ t: 'progress', p }, [], NONCE), String(p)).toEqual({ ok: false, reason: 'type' });
  });
});

describe('docserver parity T2: place, and a hash\'s push and from, are the mount\'s request (bridge.places)', () => {
  const PLACES: ParseContext = { places: true, run: null };
  const TOKEN = '{"line":null,"offset":0,"y":0}';

  it('every place kind is accepted under bridge.places, with the key it was sent and nothing else', () => {
    for (const kind of PLACE_KINDS) expect(parseBridgeMessage({ t: 'place', kind }, [], NONCE, PLACES), kind).toEqual({ ok: true, msg: { t: 'place', kind } });
  });

  it("without bridge.places a place is 'unknown-op', whatever the context's run, and with no context at all", () => {
    expect(parseBridgeMessage({ t: 'place', kind: 'overlay' }, [], NONCE)).toEqual({ ok: false, reason: 'unknown-op' });
    expect(parseBridgeMessage({ t: 'place', kind: 'overlay' }, [], NONCE, { places: false, run: { n: null, seen: new Set(), bytes: 0 } })).toEqual({ ok: false, reason: 'unknown-op' });
  });

  it('a place with a bad key set is a keys refusal before the gate, and a kind outside the list is a type refusal', () => {
    expect(parseBridgeMessage({ t: 'place' }, [], NONCE)).toEqual({ ok: false, reason: 'keys' });
    expect(parseBridgeMessage({ t: 'place', kind: 'overlay', x: '1' }, [], NONCE, PLACES)).toEqual({ ok: false, reason: 'keys' });
    for (const kind of ['Overlay', 'overlay ', '', 'toString']) expect(parseBridgeMessage({ t: 'place', kind }, [], NONCE, PLACES), kind).toEqual({ ok: false, reason: 'type' });
  });

  it('a hash keeps the push and the from it was sent: both, one, neither', () => {
    expect(parseBridgeMessage({ t: 'hash', id: 'a', push: 'true', from: TOKEN }, [], NONCE, PLACES)).toEqual({ ok: true, msg: { t: 'hash', id: 'a', push: 'true', from: TOKEN } });
    expect(parseBridgeMessage({ t: 'hash', id: 'a', push: 'true' }, [], NONCE, PLACES)).toEqual({ ok: true, msg: { t: 'hash', id: 'a', push: 'true' } });
    const only = parseBridgeMessage({ t: 'hash', id: 'a', from: TOKEN }, [], NONCE, PLACES);
    expect(only.ok && Object.keys(only.msg)).toEqual(['t', 'id', 'from']);
    const none = parseBridgeMessage({ t: 'hash', id: 'a' }, [], NONCE, PLACES);
    expect(none.ok && Object.keys(none.msg)).toEqual(['t', 'id']);
  });

  it("without bridge.places either key is a 'keys' refusal, a valid value included (and with no context at all)", () => {
    for (const extra of [{ push: 'true' }, { from: TOKEN }, { push: 'true', from: TOKEN }, { push: 'false' }]) {
      expect(parseBridgeMessage({ t: 'hash', id: 'a', ...extra }, [], NONCE), JSON.stringify(extra)).toEqual({ ok: false, reason: 'keys' });
      expect(parseBridgeMessage({ t: 'hash', id: 'a', ...extra }, [], NONCE, { places: false, run: null }), JSON.stringify(extra)).toEqual({ ok: false, reason: 'keys' });
    }
  });

  it("push is the literal 'true' (a type refusal otherwise) and from is a position token (type), at most 4096 code units (oversize)", () => {
    for (const push of ['false', 'True', 'TRUE', '1', '', ' true', 'true ']) {
      expect(parseBridgeMessage({ t: 'hash', id: 'a', push }, [], NONCE, PLACES), JSON.stringify(push)).toEqual({ ok: false, reason: 'type' });
    }
    for (const from of ['', 'x', '[]', 'null', '{"line":null,"offset":0}', '{"line":null,"offset":0,"y":-1}', '{"line":"a b","offset":0,"y":0}']) {
      expect(parseBridgeMessage({ t: 'hash', id: 'a', from }, [], NONCE, PLACES), JSON.stringify(from)).toEqual({ ok: false, reason: 'type' });
    }
    const pad = (n: number): string => `{"line":null,"offset":0,"y":0,"p":"${'x'.repeat(n - 37)}"}`;
    expect(pad(4096)).toHaveLength(4096);
    expect(parseBridgeMessage({ t: 'hash', id: 'a', from: pad(4096) }, [], NONCE, PLACES)).toMatchObject({ ok: true });
    expect(parseBridgeMessage({ t: 'hash', id: 'a', from: pad(4097) }, [], NONCE, PLACES)).toEqual({ ok: false, reason: 'oversize' });
  });

  it('the id is judged first: a bad id with a good push is a hash refusal', () => {
    expect(parseBridgeMessage({ t: 'hash', id: 'a b', push: 'true' }, [], NONCE, PLACES)).toEqual({ ok: false, reason: 'hash' });
  });
});

describe('docserver parity T2: a print-figure is judged against the open run, in the brief\'s order, and its text is never decoded', () => {
  const PNG = 'iVBORw0KGgo=';
  const open = (n: number | null, seen: readonly number[] = [], bytes = 0): ParseContext => ({ places: false, run: { n, seen: new Set(seen), bytes } });
  const fig = (i: string, n: string, png: string = PNG): unknown => ({ t: 'print-figure', i, n, png });
  const verdict = (m: unknown, ctx: ParseContext): unknown => parseBridgeMessage(m, [], NONCE, ctx);
  const max = (reason: string): { ok: false; reason: string } => ({ ok: false, reason });
  /** Base64 text of `bytes` zero bytes. */
  const zeros = (bytes: number): string => {
    const full = Math.floor(bytes / 3);
    const rest = bytes % 3;
    return 'AAAA'.repeat(full) + (rest === 0 ? '' : rest === 1 ? 'AA==' : 'AAA=');
  };

  /** Base64 text of a PNG-shaped figure of `bytes` (at least 9) decoded bytes: the signature, a zero, then zeros. */
  const pngOf = (bytes: number): string => {
    const rest = bytes - 9;
    return 'iVBORw0KGgoA' + 'AAAA'.repeat(Math.floor(rest / 3)) + (rest % 3 === 0 ? '' : rest % 3 === 1 ? 'AA==' : 'AAA=');
  };

  it('no open run is the first refusal, before the index, the size or the total are looked at', () => {
    expect(verdict(fig('0', '1'), { places: true, run: null })).toEqual(max('unknown-op'));
    expect(verdict(fig('x', 'y', '!'), { places: true, run: null })).toEqual(max('unknown-op'));
    expect(parseBridgeMessage(fig('0', '1'), [], NONCE)).toEqual(max('unknown-op'));
  });

  it("i and n are canonical decimals: a leading zero, a sign, a point, an exponent, a space, a fourth digit and the empty text are 'type'", () => {
    for (const bad of ['01', '00', '+1', '-0', '-1', '1.0', '1e1', ' 1', '1 ', '', '0x1', '\u0661', '1000']) {
      expect(verdict(fig(bad, '64'), open(null)), `i ${JSON.stringify(bad)}`).toEqual(max('type'));
      expect(verdict(fig('0', bad), open(null)), `n ${JSON.stringify(bad)}`).toEqual(max('type'));
    }
  });

  it('0 <= i < n <= 64: n of 64 and i of 63 pass; n of 65, n of 0, i equal to n and i above n are refused', () => {
    expect(verdict(fig('63', '64'), open(null))).toMatchObject({ ok: true });
    expect(verdict(fig('0', '64'), open(null))).toMatchObject({ ok: true });
    for (const [i, n] of [['0', '65'], ['0', '0'], ['64', '64'], ['3', '3'], ['4', '3'], ['99', '98']]) {
      expect(verdict(fig(i as string, n as string), open(null)), `${String(i)} of ${String(n)}`).toEqual(max('type'));
    }
    expect(BRIDGE_LIMITS.printFiguresMax).toBe(64);
  });

  it("n must equal the run's once the run has one, and a run with no figure yet takes any n", () => {
    expect(verdict(fig('1', '3'), open(3, [0]))).toMatchObject({ ok: true });
    expect(verdict(fig('1', '4'), open(3, [0]))).toEqual(max('type'));
    expect(verdict(fig('1', '2'), open(3, [0]))).toEqual(max('type'));
    expect(verdict(fig('1', '2'), open(null))).toMatchObject({ ok: true });
  });

  it('an index seen in the run is refused, however many figures follow', () => {
    for (const seen of [[0], [0, 1], [1, 2]]) expect(verdict(fig('1', '3'), open(3, seen)), seen.join()).toEqual(seen.includes(1) ? max('type') : { ok: true, msg: { t: 'print-figure', i: '1', n: '3', png: PNG }, bytes: 8 });
  });

  it('the order of the checks: the index before the text, the text before its size, the size before the total', () => {
    const big = pngOf(BRIDGE_LIMITS.printFigurePngMaxBytes + 1);
    expect(verdict(fig('0', '3', '!!!!'), open(3, [0]))).toEqual(max('type'));
    expect(verdict(fig('0', '3', big), open(3, [0]))).toEqual(max('type'));
    expect(verdict(fig('1', '3', '!!!!'), open(3, [0]))).toEqual(max('type'));
    expect(verdict(fig('1', '3', big), open(3, [0]))).toEqual(max('oversize'));
    expect(verdict(fig('1', '3', pngOf(1048576)), open(3, [0], BRIDGE_LIMITS.printFiguresTotalMaxBytes))).toEqual(max('oversize'));
    // the signature is judged before the size: a text that is no PNG is a type refusal at any size
    expect(verdict(fig('1', '3', zeros(BRIDGE_LIMITS.printFigurePngMaxBytes + 1)), open(3, [0]))).toEqual(max('type'));
  });

  it('1048575 and 1048576 decoded bytes pass, 1048577 is oversize: the size is read from the length and the padding', () => {
    for (const [bytes, ok] of [[1048575, true], [1048576, true], [1048577, false]] as const) {
      const got = verdict(fig('0', '1', pngOf(bytes)), open(null));
      expect(got, String(bytes)).toEqual(ok ? { ok: true, msg: { t: 'print-figure', i: '0', n: '1', png: pngOf(bytes) }, bytes } : max('oversize'));
    }
  });

  it('the run total: the run plus the figure may reach 16777216 and not one byte more', () => {
    const cap = BRIDGE_LIMITS.printFiguresTotalMaxBytes;
    expect(verdict(fig('1', '2', pngOf(1048576)), open(2, [0], cap - 1048576))).toMatchObject({ ok: true });
    expect(verdict(fig('1', '2', pngOf(1048576)), open(2, [0], cap - 1048575))).toEqual(max('oversize'));
    expect(verdict(fig('1', '2', PNG), open(2, [0], cap - 8))).toMatchObject({ ok: true });
    expect(verdict(fig('1', '2', PNG), open(2, [0], cap - 7))).toEqual(max('oversize'));
  });

  it('what a run has handed on in all, replaced copies included, may reach twice the run total and not one byte more; it is judged before the live total could, from the text (review 3088 F1)', () => {
    const cap = BRIDGE_LIMITS.printFiguresTotalMaxBytes;
    const ctx = (bytes: number, handed: number): ParseContext => ({ places: false, run: { n: 3, seen: new Set([0]), bytes, handed, replaceable: new Map([[0, 1048576]]) } });
    // the live total is far from its cap, so only the cumulative one can refuse
    expect(verdict(fig('1', '3', pngOf(1048576)), ctx(0, 2 * cap - 1048576))).toMatchObject({ ok: true });
    expect(verdict(fig('1', '3', pngOf(1048576)), ctx(0, 2 * cap - 1048575))).toEqual(max('oversize'));
    expect(verdict(fig('1', '3', PNG), ctx(0, 2 * cap - 8))).toMatchObject({ ok: true });
    expect(verdict(fig('1', '3', PNG), ctx(0, 2 * cap - 7))).toEqual(max('oversize'));
    // a replacement counts too: the replaced copy's bytes leave the live total and stay in what was handed
    expect(verdict(fig('0', '3', pngOf(1048576)), ctx(1048576, 2 * cap - 1048575))).toEqual(max('oversize'));
    expect(verdict(fig('0', '3', pngOf(1048576)), ctx(1048576, 2 * cap - 1048576))).toMatchObject({ ok: true });
    // a run that says nothing of it (an ordinary run's view of the old shape) has handed nothing
    expect(verdict(fig('1', '3', pngOf(1048576)), { places: false, run: { n: 3, seen: new Set([0]), bytes: 0 } })).toMatchObject({ ok: true });
    expect(PRINT_RUN_HANDED_MAX_BYTES).toBe(2 * cap);
  });

  it("the text must be canonical base64: another alphabet, a bad length, padding inside, a wrong last character and a non-string are 'type'", () => {
    for (const png of ['-_-_', 'AAA', 'A', 'AA==AAAA', 'AA=A', 'A===', '====', 'QR==', 'QUJ=', 'AA= =', 'AAAA\n', 'AAA*']) {
      expect(verdict(fig('0', '1', png), open(null)), JSON.stringify(png)).toEqual(max('type'));
    }
    expect(verdict({ t: 'print-figure', i: '0', n: '1', png: 1 }, open(null))).toEqual(max('type'));
    expect(verdict(fig('0', '1', PNG), open(null))).toMatchObject({ ok: true });
  });

  it("the text must start as a PNG's does (the base64 of its eight signature bytes), judged from the text and never decoded: any other start is 'type'", () => {
    expect(verdict(fig('0', '1', 'iVBORw0KGgo='), open(null))).toMatchObject({ ok: true });
    expect(verdict(fig('0', '1', pngOf(9)), open(null))).toMatchObject({ ok: true });
    for (const png of ['QQ==', 'AAAAAAAA', 'iVBORw0KGg==', 'iVBORw0KGgI=', 'IVBORw0KGgo=', '/9j/4AAQSkZJRg==', 'R0lGODlhAQABAAAAACw=', zeros(2048)]) {
      expect(verdict(fig('0', '1', png), open(null)), png.slice(0, 20)).toEqual(max('type'));
    }
    // after the run and the index (a refusal there comes first), before the size
    expect(verdict(fig('0', '1', 'QQ=='), { places: false, run: null })).toEqual(max('unknown-op'));
    expect(verdict(fig('1', '3', 'QQ=='), open(3, [1]))).toEqual(max('type'));
  });

  it("an i or n that is not an integer, or not a canonical decimal, is 'type': a point, a fraction, a sign, an exponent, a number", () => {
    for (const bad of ['1.5', '0.5', '2.', '.5', '1e0', '-1', '+1', '01', 'NaN', 'Infinity']) {
      expect(verdict(fig(bad, '3'), open(null)), `i ${bad}`).toEqual(max('type'));
      expect(verdict(fig('0', bad), open(null)), `n ${bad}`).toEqual(max('type'));
    }
    expect(verdict({ t: 'print-figure', i: 1.5, n: '3', png: PNG }, open(null))).toEqual(max('type'));
    expect(verdict({ t: 'print-figure', i: '0', n: 3, png: PNG }, open(null))).toEqual(max('type'));
  });

  it('the text is handed on as it came: no atob, no Buffer, no decode, and the message is a fresh object', () => {
    const atob = vi.spyOn(globalThis, 'atob');
    const from = vi.spyOn(Buffer, 'from');
    try {
      const m = fig('0', '1', pngOf(300_000));
      const got = verdict(m, open(null)) as { ok: true; msg: { png: string } };
      expect(got.ok).toBe(true);
      expect(got.msg.png).toBe((m as { png: string }).png);
      expect(got.msg).not.toBe(m);
      expect(atob).not.toHaveBeenCalled();
      expect(from).not.toHaveBeenCalled();
    } finally {
      atob.mockRestore();
      from.mockRestore();
    }
  });

  it('an accepted figure reports its decoded size, read once from its text; no other op carries a size', () => {
    for (const bytes of [9, 10, 11, 12, 300_000, 1048576]) expect(verdict(fig('0', '1', pngOf(bytes)), open(null)), String(bytes)).toMatchObject({ ok: true, bytes });
    expect(verdict(fig('0', '1', PNG), open(null))).toMatchObject({ ok: true, bytes: 8 });
    expect(parseBridgeMessage({ t: 'hash', id: 'a' }, [], NONCE)).not.toHaveProperty('bytes');
  });

  it("an empty text is no PNG: a 'type' refusal, after the run and the index and before any size", () => {
    expect(verdict(fig('0', '1', ''), open(null))).toEqual(max('type'));
    expect(verdict(fig('0', '1', ''), { places: false, run: null })).toEqual(max('unknown-op'));
    expect(verdict(fig('1', '1', ''), open(null))).toEqual(max('type'));
  });

  it('a text longer than the longest a 1 MiB figure can have is oversize before its alphabet is read; up to that length it is read', () => {
    const longest = 4 * Math.ceil(BRIDGE_LIMITS.printFigurePngMaxBytes / 3);
    expect(longest).toBe(1398104);
    expect(pngOf(BRIDGE_LIMITS.printFigurePngMaxBytes)).toHaveLength(longest);
    expect(verdict(fig('0', '1', '!'.repeat(longest)), open(null))).toEqual(max('type'));
    expect(verdict(fig('0', '1', 'iVBORw0KGgo' + '!'.repeat(longest - 11)), open(null))).toEqual(max('type'));
    expect(verdict(fig('0', '1', '!'.repeat(longest + 1)), open(null))).toEqual(max('oversize'));
    expect(verdict(fig('0', '1', 'A'.repeat(longest + 4)), open(null))).toEqual(max('oversize'));
    // the index is judged first: a text this long with a bad index is a type refusal
    expect(verdict(fig('1', '1', '!'.repeat(longest + 1)), open(null))).toEqual(max('type'));
  });

  it('a print-figure is judged by its run alone: bridge.places is no part of it', () => {
    expect(parseBridgeMessage(fig('0', '1'), [], NONCE, { places: true, run: { n: null, seen: new Set(), bytes: 0 } })).toMatchObject({ ok: true });
    expect(parseBridgeMessage(fig('0', '1'), [], NONCE, { places: false, run: { n: null, seen: new Set(), bytes: 0 } })).toMatchObject({ ok: true });
  });

  it('a key missing, an extra key and a value that is not a string are refused before the run is read', () => {
    expect(verdict({ t: 'print-figure', i: '0', n: '1' }, open(null))).toEqual(max('keys'));
    expect(verdict({ t: 'print-figure', i: '0', n: '1', png: PNG, x: '1' }, open(null))).toEqual(max('keys'));
    expect(verdict({ t: 'print-figure', i: 0, n: '1', png: PNG }, open(null))).toEqual(max('type'));
    expect(verdict({ t: 'print-figure', i: '0', n: '1' }, { places: false, run: null })).toEqual(max('keys'));
  });
});

describe('L3.H3 the parser reads a message once, as plain data', () => {
  it('returns a fresh object, never the one it was given', () => {
    const m = { t: 'navigate', href: 'https://example.com/' };
    const got = parseBridgeMessage(m, [], NONCE);
    expect(got).toEqual({ ok: true, msg: m });
    expect(got.ok && got.msg).not.toBe(m);
  });

  it('a version keeps only the keys it was sent', () => {
    const sha = '0'.repeat(40);
    const got = parseBridgeMessage({ t: 'version', only: sha }, [], NONCE);
    expect(got.ok && Object.keys(got.msg)).toEqual(['t', 'only']);
  });

  it('a null-prototype object is plain; an instance of a class, a Date and a Map are not', () => {
    const bare = Object.assign(Object.create(null) as Record<string, unknown>, { t: 'hash', id: 'a' });
    expect(parseBridgeMessage(bare, [], NONCE)).toEqual({ ok: true, msg: { t: 'hash', id: 'a' } });
    class Op {
      t = 'hash';
      id = 'a';
    }
    for (const v of [new Op(), new Date(0), new Map([['t', 'hash']]), undefined, true]) {
      expect(parseBridgeMessage(v, [], NONCE)).toEqual({ ok: false, reason: 'not-plain' });
    }
  });

  it('a getter is refused unread, a symbol key and a hidden key are outside the key set', () => {
    let read = 0;
    const getter = { t: 'hash' } as Record<string, unknown>;
    Object.defineProperty(getter, 'id', { enumerable: true, get: () => ((read += 1), 'a') });
    expect(parseBridgeMessage(getter, [], NONCE)).toEqual({ ok: false, reason: 'type' });
    const opGetter = {} as Record<string, unknown>;
    Object.defineProperty(opGetter, 't', { enumerable: true, get: () => ((read += 1), 'hash') });
    expect(parseBridgeMessage(opGetter, [], NONCE)).toEqual({ ok: false, reason: 'unknown-op' });
    expect(read).toBe(0);
    expect(parseBridgeMessage({ t: 'hash', id: 'a', [Symbol('x')]: 1 }, [], NONCE)).toEqual({ ok: false, reason: 'keys' });
    const hidden = { t: 'hash', id: 'a' };
    Object.defineProperty(hidden, 'extra', { enumerable: false, value: 'x' });
    expect(parseBridgeMessage(hidden, [], NONCE)).toEqual({ ok: false, reason: 'keys' });
  });

  it('a message with ports is refused before it is read, and ports that are not an array refuse too', () => {
    expect(parseBridgeMessage({ t: 'hash', id: 'a' }, portsOf(1), NONCE)).toEqual({ ok: false, reason: 'port' });
    expect(parseBridgeMessage(null, portsOf(2), NONCE)).toEqual({ ok: false, reason: 'port' });
    for (const ports of [undefined, null, 'x', { length: 0 }]) {
      expect(parseBridgeMessage({ t: 'hash', id: 'a' }, ports, NONCE), String(ports)).toEqual({ ok: false, reason: 'port' });
    }
  });

  it('a parent op, a frame op of another case and an inherited t are unknown ops', () => {
    for (const t of ['hello', 'prefs', 'changes.result', 'mermaid', 'command', 'Hash', 'toString', '__proto__']) {
      expect(parseBridgeMessage({ t }, [], NONCE), t).toEqual({ ok: false, reason: 'unknown-op' });
    }
    expect(parseBridgeMessage(Object.create({ t: 'hash', id: 'a' }) as unknown, [], NONCE)).toEqual({ ok: false, reason: 'not-plain' });
  });

  it('a store.set value of exactly 65536 UTF-8 bytes in two-byte characters passes, one more byte is oversize', () => {
    const at = `"${'\u00e9'.repeat(32767)}"`;
    expect(Buffer.byteLength(at, 'utf8')).toBe(65536);
    expect(parseBridgeMessage({ t: 'store.set', key: 'pref:ui', value: at }, [], NONCE)).toMatchObject({ ok: true });
    expect(Buffer.byteLength(`${at} `, 'utf8')).toBe(65537);
    expect(parseBridgeMessage({ t: 'store.set', key: 'pref:ui', value: `${at} ` }, [], NONCE)).toEqual({ ok: false, reason: 'oversize' });
  });

  it('a lone surrogate counts as three UTF-8 bytes, as a TextEncoder writes it', () => {
    const text = `${'a'.repeat(65533)}\ud800`;
    expect(new TextEncoder().encode(text).length).toBe(65536);
    expect(parseBridgeMessage({ t: 'copy', text }, [], NONCE)).toMatchObject({ ok: true });
    expect(parseBridgeMessage({ t: 'copy', text: `a${text}` }, [], NONCE)).toEqual({ ok: false, reason: 'oversize' });
  });

  it('JSON text with surrounding white space is JSON; a bare word, a trailing comma and NaN are not', () => {
    for (const value of [' {"a":1} ', 'null', '"x"', '1', 'true', '[]']) {
      expect(parseBridgeMessage({ t: 'store.set', key: 'pref:ui', value }, [], NONCE), value).toMatchObject({ ok: true });
    }
    for (const value of ['undefined', '{"a":1,}', 'NaN', "'x'", '{', ' ']) {
      expect(parseBridgeMessage({ t: 'store.set', key: 'pref:ui', value }, [], NONCE), value).toEqual({ ok: false, reason: 'json' });
    }
  });

  it('navigate refuses every C0, DEL and C1 code unit and accepts the characters beside them', () => {
    for (let cp = 0; cp <= 0x9f; cp += 1) {
      const control = cp < 0x20 || (cp >= 0x7f && cp <= 0x9f);
      const href = `https://example.com/${String.fromCharCode(cp)}`;
      expect(parseBridgeMessage({ t: 'navigate', href }, [], NONCE), cp.toString(16)).toEqual(control ? { ok: false, reason: 'href' } : { ok: true, msg: { t: 'navigate', href } });
    }
  });

  it('never throws, whatever it is given', () => {
    const revoked = Proxy.revocable({}, {});
    revoked.revoke();
    for (const v of [revoked.proxy, new Proxy({ t: 'hash', id: 'a' }, { ownKeys: () => { throw new Error('x'); } }), Symbol('x'), () => 1, 10n]) {
      expect(() => parseBridgeMessage(v, [], NONCE)).not.toThrow();
      expect(parseBridgeMessage(v, [], NONCE).ok).toBe(false);
    }
  });
});

describe("ruling R6: the host's files write every non-ASCII character as a visible escape", () => {
  const FILES = ['parse', 'limits', 'store', 'links', 'copy'].flatMap((n) => [`src/host/${n}.ts`, `test/host-${n}.test.ts`]);

  for (const file of FILES) {
    it(file, () => {
      const text = readFileSync(path.join(new URL(ROOT).pathname, file), 'utf8');
      const bad = [...text].map((ch, i) => [ch.codePointAt(0) ?? 0, i] as const).filter(([cp]) => (cp > 0x7e && cp !== 0xa7) || (cp < 0x20 && cp !== 0x0a));
      expect(bad).toEqual([]);
    });
  }
});
