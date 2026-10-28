// `./host`'s parser of what the frame sends (docserver L3, Task 9; plan Reference §11.3, row L3.H3; the first consumer's
// M8.5). parseBridgeMessage judges one frame-to-parent message: every case of conformance/bridge-cases.json with that
// direction gives its verdict and reason, `hash` goes through the one fragment grammar (isFragmentId), and an accepted
// message comes back as a fresh object holding only its op's keys. The parser is pure: it never throws, never reads a
// getter, and keeps nothing between calls. Every non-ASCII character in a string is written as an escape (ruling R6).
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { isFragmentId } from '../src/frame/fragment.js';
import { parseBridgeMessage } from '../src/host/parse.js';

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
      const got = parseBridgeMessage(messageOf(c), portsOf(c.ports ?? 0), NONCE);
      if (c.verdict === 'accept') expect(got).toEqual({ ok: true, msg: messageOf(c) });
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
    for (const t of ['hello', 'prefs', 'changes.result', 'Hash', 'toString', '__proto__']) {
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
