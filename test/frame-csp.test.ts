// The frame's policy: frameCsp() and checkFrameCsp() (docserver L3, Task 2; plan Reference §10, row L3.M6), and the
// floor they share with the bootstrap, cspFloor() in src/frame/csp-rules.ts.
//
// Each refusal is named by a reason from one closed list, CSP_REFUSALS, never by a message, and each policy below
// breaks exactly one rule, so a deleted rule cannot hide behind another one: without it, the policy either passes or is
// refused for a different reason, and the row goes red either way. The last block pins that cspFloor is the only
// tokeniser of a policy in the source tree: the bootstrap bundles it for its own self-check, so a second tokeniser
// would be a second, untested reading of the same policy. It holds every file that reads a policy to no `;` but the
// floor's split, whatever the form of a second tokeniser, and every read of a meta's content to cspFloor. Every
// non-ASCII character in a string here is written as an escape (ruling R6; test/frame-sha256.test.ts scans this file).
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { checkFrameCsp, frameCsp } from '../src/frame/csp.js';
import { CSP_REFUSALS, cspFloor, FRAME_DIRECTIVES, type CspRefusal } from '../src/frame/csp-rules.js';
import { FRAME_MANIFEST } from '../src/frame/manifest.generated.js';
import { cspHash } from '../src/frame/sha256.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));

const M = FRAME_MANIFEST;
/** The hashes of the three scripts every frame inlines, and of all four. */
const THREE: readonly string[] = [M.guard.csp, M.bootstrap.csp, M.enhance.csp];
const FOUR: readonly string[] = [...THREE, M.mermaid.csp];
const GOOD = frameCsp();
/** A hash source of the right form that no asset of this version has. */
const UNKNOWN = `'sha256-${'A'.repeat(43)}='`;

/** GOOD with `from` replaced by `to`; `from` must occur in it exactly once. */
function swap(from: string, to: string): string {
  const at = GOOD.indexOf(from);
  if (at < 0 || GOOD.indexOf(from, at + 1) >= 0) throw new Error(`the policy holds ${JSON.stringify(from)} other than once`);
  return GOOD.slice(0, at) + to + GOOD.slice(at + from.length);
}

/** checkFrameCsp's answer, failing the row (never throwing past it) when the check itself throws. */
function check(csp: unknown, required: readonly string[] = FOUR): ReturnType<typeof checkFrameCsp> {
  let out: ReturnType<typeof checkFrameCsp> | undefined;
  expect(() => {
    out = checkFrameCsp(csp as string, required);
  }).not.toThrow();
  return out as ReturnType<typeof checkFrameCsp>;
}

/** cspFloor's answer, under the same rule. */
function floor(csp: unknown): ReturnType<typeof cspFloor> {
  let out: ReturnType<typeof cspFloor> | undefined;
  expect(() => {
    out = cspFloor(csp as string);
  }).not.toThrow();
  return out as ReturnType<typeof cspFloor>;
}

type Row = readonly [name: string, policy: () => unknown, why: CspRefusal, required?: readonly string[]];

/** One rule broken per row, by its reason, in Reference §10's order. */
const ROWS: readonly Row[] = [
  // type: host data is untrusted, so a policy that is not a string is refused, never thrown on
  ['a number', () => 42, 'type'],
  ['null', () => null, 'type'],
  ['undefined', () => undefined, 'type'],
  ['a String object', () => new String(GOOD), 'type'],
  ['an array holding the policy', () => [GOOD], 'type'],

  // length: at most 4096 characters (4096 passes, below)
  ['4097 characters (trailing spaces only)', () => GOOD + ' '.repeat(4097 - GOOD.length), 'length'],
  ['4097 characters (a long valid-looking script-src)', () => swap('script-src ', `script-src ${`${M.guard.csp} `.repeat(Math.ceil(4097 / 47))}`), 'length'],

  // character: printable ASCII only, and none of "<>&
  ['a tab between a directive and its value', () => swap("default-src 'none'", "default-src\t'none'"), 'character'],
  ['a line feed between directives', () => swap("; base-uri 'none'", ";\nbase-uri 'none'"), 'character'],
  ['a carriage return between directives', () => swap("; base-uri 'none'", ";\rbase-uri 'none'"), 'character'],
  ['a form feed between directives', () => swap("; base-uri 'none'", ";\fbase-uri 'none'"), 'character'],
  ['a NUL in a value', () => swap('img-src data:', 'img-src data:\u0000'), 'character'],
  ['DEL (U+007F) in a value', () => swap('img-src data:', 'img-src data:\u007f'), 'character'],
  ['U+00E9 in a value', () => swap('img-src data:', 'img-src data:\u00e9'), 'character'],
  ['U+2028 between directives', () => swap("; base-uri 'none'", ";\u2028base-uri 'none'"), 'character'],
  ['an astral character in a value', () => swap('img-src data:', 'img-src data:\u{1f600}'), 'character'],
  ['a double quote in a value', () => swap('img-src data:', 'img-src data:"'), 'character'],
  ['a less-than sign in a value', () => swap('img-src data:', 'img-src data:<'), 'character'],
  ['a greater-than sign in a value', () => swap('img-src data:', 'img-src data:>'), 'character'],
  ['an ampersand in a value', () => swap('img-src data:', 'img-src data:&'), 'character'],

  // directive: only the seven the frame needs; anything that can load, connect, report or relax is refused
  ...(
    [
      'connect-src *',
      "connect-src 'none'",
      "frame-src 'none'",
      "child-src 'none'",
      "worker-src 'none'",
      "object-src 'none'",
      "manifest-src 'none'",
      "media-src 'none'",
      "frame-ancestors 'none'",
      "script-src-elem 'none'",
      "script-src-attr 'none'",
      "style-src-elem 'none'",
      'report-uri /r',
      'report-to r',
      'sandbox allow-scripts',
      'upgrade-insecure-requests',
      "require-trusted-types-for 'script'",
      'trusted-types none',
      "webrtc 'block'",
    ] as const
  ).map((d): Row => [`an added ${d}`, () => `${GOOD}; ${d}`, 'directive']),
  ["DEFAULT-SRC in upper case (directive names are matched exactly)", () => swap("default-src 'none'", "DEFAULT-SRC 'none'"), 'directive'],

  // duplicate: browsers obey the first of two and ignore the second, so the second must never decide the verdict
  ['img-src twice, both valid', () => `${GOOD}; img-src data:`, 'duplicate'],
  ["a first script-src of 'unsafe-inline', then the valid one", () => swap('script-src ', "script-src 'unsafe-inline'; script-src "), 'duplicate'],
  ["a first default-src '*', then the valid one", () => swap("default-src 'none'", "default-src *; default-src 'none'"), 'duplicate'],

  // default-src: exactly 'none'
  ['default-src missing', () => swap("default-src 'none'; ", ''), 'default-src'],
  ["default-src 'self'", () => swap("default-src 'none'", "default-src 'self'"), 'default-src'],
  ['default-src *', () => swap("default-src 'none'", 'default-src *'), 'default-src'],
  ["default-src 'none' 'self'", () => swap("default-src 'none'", "default-src 'none' 'self'"), 'default-src'],
  ['default-src with no value', () => swap("default-src 'none'", 'default-src'), 'default-src'],
  ['the empty policy', () => '', 'default-src'],

  // script-src: SHA-256 hash sources only
  ['script-src missing', () => GOOD.replace(/script-src [^;]*; /, ''), 'script-src'],
  ['script-src with no source', () => GOOD.replace(/script-src [^;]*;/, 'script-src;'), 'script-src'],
  ...(
    [
      "'self'",
      "'none'",
      '*',
      'https:',
      'https://docreader.test',
      'docreader.test',
      "'unsafe-inline'",
      "'unsafe-eval'",
      "'unsafe-hashes'",
      "'wasm-unsafe-eval'",
      "'strict-dynamic'",
      "'report-sample'",
      "'nonce-abcdefghijklmnop'",
      'data:',
      'blob:',
      `'sha384-${'A'.repeat(64)}'`,
      `'sha512-${'A'.repeat(86)}=='`,
      `'sha256-${'A'.repeat(42)}='`,
      `'sha256-${'A'.repeat(44)}'`,
      `sha256-${'A'.repeat(43)}=`,
      `'SHA256-${'A'.repeat(43)}='`,
      `'sha256-${'A'.repeat(42)}-='`,
    ] as const
  ).map((s): Row => [`script-src with ${s} beside the hashes`, () => swap('script-src ', `script-src ${s} `), 'script-src']),
  // a real hash with something before or after it: the hash source is matched whole, anchored at both ends
  ...(
    [
      ['followed by a letter', `${M.guard.csp}x`],
      ['followed by a second quote', `${M.guard.csp}'`],
      ['after a letter', `x${M.guard.csp}`],
      ['after a second quote', `'${M.guard.csp}`],
    ] as const
  ).map(([how, s]): Row => [`script-src with the guard hash ${how} beside the hashes`, () => swap('script-src ', `script-src ${s} `), 'script-src']),

  // style-src: within {'unsafe-inline', data:}
  ...(["'self'", '*', 'https:', 'blob:', "'unsafe-eval'", "'nonce-abcdefghijklmnop'", M.guard.csp, "'none'"] as const).map(
    (s): Row => [`style-src with ${s}`, () => swap("style-src 'unsafe-inline' data:", `style-src 'unsafe-inline' data: ${s}`), 'style-src'],
  ),

  // font-src and img-src: within {data:}
  ...(["'self'", '*', 'https:', 'blob:', "'unsafe-inline'", "'none'"] as const).map(
    (s): Row => [`font-src with ${s}`, () => swap('font-src data:', `font-src data: ${s}`), 'font-src'],
  ),
  ...(["'self'", '*', 'https:', 'blob:', "'unsafe-inline'", "'none'"] as const).map(
    (s): Row => [`img-src with ${s}`, () => swap('img-src data:', `img-src data: ${s}`), 'img-src'],
  ),

  // base-uri and form-action: present and exactly 'none'
  ['base-uri missing', () => swap("; base-uri 'none'", ''), 'base-uri'],
  ["base-uri 'self'", () => swap("base-uri 'none'", "base-uri 'self'"), 'base-uri'],
  ["base-uri 'none' 'self'", () => swap("base-uri 'none'", "base-uri 'none' 'self'"), 'base-uri'],
  ['base-uri with no value', () => swap("base-uri 'none'", 'base-uri'), 'base-uri'],
  ['form-action missing', () => swap("; form-action 'none'", ''), 'form-action'],
  ["form-action 'self'", () => swap("form-action 'none'", "form-action 'self'"), 'form-action'],
  ['form-action *', () => swap("form-action 'none'", 'form-action *'), 'form-action'],
  ['form-action with no value', () => swap("form-action 'none'", 'form-action'), 'form-action'],

  // missing-hash: a script about to be inlined has its hash in the policy
  ...(['guard', 'bootstrap', 'enhance', 'mermaid'] as const).map(
    (k): Row => [`the ${k} hash removed while ${k} is inlined`, () => swap(` ${M[k].csp}`, ''), 'missing-hash', FOUR],
  ),
  ['a required hash this version does not know', () => GOOD, 'missing-hash', [...FOUR, UNKNOWN]],

  // unknown-hash: no hash this version does not ship
  ['an unknown hash of the right form', () => swap('script-src ', `script-src ${UNKNOWN} `), 'unknown-hash'],
  ['the hash of a script that is not an asset', () => swap('script-src ', `script-src ${cspHash('alert(1)')} `), 'unknown-hash'],
  ['an unknown hash in place of the Mermaid hash, Mermaid not inlined', () => swap(M.mermaid.csp, UNKNOWN), 'unknown-hash', THREE],
];

/** Policies every rule accepts. */
const ACCEPTED: readonly (readonly [name: string, policy: () => string, required: readonly string[]])[] = [
  ['frameCsp(), every hash required', () => GOOD, FOUR],
  ['frameCsp(), Mermaid not inlined', () => GOOD, THREE],
  ['frameCsp(), nothing required', () => GOOD, []],
  ['frameCsp() without the Mermaid hash, Mermaid not inlined', () => swap(` ${M.mermaid.csp}`, ''), THREE],
  ['exactly 4096 characters (the bound is inclusive)', () => GOOD + ' '.repeat(4096 - GOOD.length), FOUR],
  ['the directives in reverse order', () => GOOD.split('; ').reverse().join('; '), FOUR],
  ['runs of spaces, a trailing semicolon and empty directives', () => `;; ${GOOD.replaceAll(' ', '   ').replaceAll(';', ' ; ; ')} ;`, FOUR],
  ['style-src, font-src and img-src omitted (default-src applies, which only tightens)', () => GOOD.replace(/ style-src [^;]*;/, '').replace(/ font-src [^;]*;/, '').replace(/ img-src [^;]*;/, ''), FOUR],
  ['style-src, font-src and img-src narrowed', () => swap("style-src 'unsafe-inline' data:; font-src data:; img-src data:", "style-src data:; font-src; img-src"), FOUR],
  ['a hash repeated in script-src', () => swap('script-src ', `script-src ${M.guard.csp} `), FOUR],
];

describe('L3.M6 the closed list of refusal reasons', () => {
  it('is exactly the rules of Reference §10, once each, in the order they are checked, and frozen', () => {
    expect(CSP_REFUSALS).toEqual([
      'type',
      'length',
      'character',
      'directive',
      'duplicate',
      'default-src',
      'script-src',
      'style-src',
      'font-src',
      'img-src',
      'base-uri',
      'form-action',
      'missing-hash',
      'unknown-hash',
    ]);
    expect(Object.isFrozen(CSP_REFUSALS)).toBe(true);
  });

  it('every reason is the answer of at least one row below, and every row answers a reason on the list', () => {
    const answered = new Set<string>();
    for (const [name, policy, , required] of ROWS) {
      const r = check(policy(), required ?? FOUR);
      expect(r.ok, name).toBe(false);
      if (!r.ok) answered.add(r.why);
    }
    expect([...answered].sort()).toEqual([...CSP_REFUSALS].sort());
  });

  it('the directive list is the seven of Reference §10', () => {
    expect(FRAME_DIRECTIVES).toEqual(['default-src', 'script-src', 'style-src', 'font-src', 'img-src', 'base-uri', 'form-action']);
  });
});

describe('L3.M6 frameCsp()', () => {
  it("is Reference §10's policy over this version's four script hashes, guard, bootstrap, enhance and Mermaid", () => {
    expect(GOOD).toBe(
      `default-src 'none'; script-src ${M.guard.csp} ${M.bootstrap.csp} ${M.enhance.csp} ${M.mermaid.csp}; ` +
        "style-src 'unsafe-inline' data:; font-src data:; img-src data:; base-uri 'none'; form-action 'none'",
    );
  });

  it('is one constant: two calls give the same string', () => {
    expect(frameCsp()).toBe(frameCsp());
  });

  it('every hash in it is a SHA-256 hash source', () => {
    for (const h of FOUR) expect(h).toMatch(/^'sha256-[A-Za-z0-9+/]{43}='$/);
  });
});

describe('L3.M6 each rule of checkFrameCsp refuses on its own', () => {
  for (const [name, policy, why, required] of ROWS) {
    it(`${name}: refused as ${why}`, () => {
      expect(check(policy(), required ?? FOUR)).toEqual({ ok: false, why });
    });
  }
});

describe('L3.M6 policies every rule accepts', () => {
  for (const [name, policy, required] of ACCEPTED) {
    it(`${name}: accepted`, () => {
      expect(check(policy(), required)).toEqual({ ok: true });
    });
  }
});

describe('L3.M6 cspFloor, the bootstrap\'s half of the check', () => {
  it('answers the script-src hashes of frameCsp() in order', () => {
    expect(floor(GOOD)).toEqual({ ok: true, scriptHashes: FOUR });
  });

  it('agrees with checkFrameCsp on every floor row, and never answers a hash reason', () => {
    for (const [name, policy, why] of ROWS) {
      const f = floor(policy());
      if (why === 'missing-hash' || why === 'unknown-hash') expect(f.ok, name).toBe(true);
      else expect(f, name).toEqual({ ok: false, why });
    }
  });

  it('accepts an unknown hash of the right form: the hash set is not the floor\'s (the bootstrap bundles no manifest)', () => {
    expect(floor(swap(M.bootstrap.csp, UNKNOWN))).toEqual({ ok: true, scriptHashes: [M.guard.csp, UNKNOWN, M.enhance.csp, M.mermaid.csp] });
  });
});

/** Every .ts file under src/, as paths relative to ROOT with forward slashes. */
function srcFiles(dir = path.join(ROOT, 'src')): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...srcFiles(p));
    else if (e.name.endsWith('.ts')) out.push(path.relative(ROOT, p).split(path.sep).join('/'));
  }
  return out.sort();
}

const sourceOf = (rel: string): string => readFileSync(path.join(ROOT, rel), 'utf8');
const lineOf = (sf: ts.SourceFile, n: ts.Node): number => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;

/** Each `.split(x)` call in `rel` whose argument is a string or regular expression literal that can match `;`. */
function semicolonSplits(rel: string, text = sourceOf(rel)): string[] {
  const sf = ts.createSourceFile(rel, text, ts.ScriptTarget.ES2022, true);
  const out: string[] = [];
  const visit = (n: ts.Node): void => {
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === 'split') {
      const arg = n.arguments[0];
      if (arg !== undefined && (ts.isStringLiteralLike(arg) || ts.isRegularExpressionLiteral(arg)) && arg.text.includes(';')) {
        out.push(`${rel}:${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1}`);
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out;
}

/**
 * Each string, template or regular expression literal in `rel` that holds a `;`, outside the body of `frameCsp` (the
 * policy's one writer), as `rel:line`. Run over the files that read a policy, it sees a second tokeniser whatever its
 * form: a split, a match or a search over a literal, a regular expression, a `;` kept in a named constant, an indexOf
 * loop. What it cannot see is a `;` that is never written as one (a character code, say); the data-flow rows below hold
 * the two places a policy enters instead.
 */
function semicolonLiterals(rel: string, text = sourceOf(rel)): string[] {
  const sf = ts.createSourceFile(rel, text, ts.ScriptTarget.ES2022, true);
  const out: string[] = [];
  const visit = (n: ts.Node): void => {
    if (ts.isFunctionDeclaration(n) && n.name?.text === 'frameCsp') return;
    const literal =
      ts.isStringLiteralLike(n) || ts.isRegularExpressionLiteral(n) || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n);
    if (literal && n.text.includes(';')) out.push(`${rel}:${lineOf(sf, n)}`);
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out;
}

/** The names `rel` imports from each module specifier. */
function importsOf(rel: string, text = sourceOf(rel)): Map<string, string[]> {
  const sf = ts.createSourceFile(rel, text, ts.ScriptTarget.ES2022, true);
  const out = new Map<string, string[]>();
  for (const s of sf.statements) {
    if (!ts.isImportDeclaration(s) || !ts.isStringLiteral(s.moduleSpecifier)) continue;
    const names: string[] = [];
    const b = s.importClause?.namedBindings;
    if (b !== undefined && ts.isNamedImports(b)) for (const e of b.elements) names.push(e.name.text);
    out.set(s.moduleSpecifier.text, [...(out.get(s.moduleSpecifier.text) ?? []), ...names]);
  }
  return out;
}

/** The names a policy is read through. */
const POLICY_API: readonly string[] = ['cspFloor', 'checkFrameCsp', 'frameCsp'];

/** Every file of `files` that reads a policy: it imports a name of POLICY_API from csp.ts or csp-rules.ts. */
function policyReaders(files: readonly string[]): string[] {
  return files.filter((rel) =>
    [...importsOf(rel)].some(([spec, names]) => /(^|\/)csp(-rules)?\.js$/.test(spec) && names.some((n) => POLICY_API.includes(n))),
  );
}

/**
 * Each call in `rel` that reads an element's `content` attribute (`getAttribute(..., 'content')` or
 * `getAttribute.call(el, 'content')`), as `rel:line`, and whether it goes straight to cspFloor: the call, or the call
 * `?? x`, in parentheses or not, is cspFloor's first argument. A meta's content is where the bootstrap reads its policy.
 */
function contentReads(rel: string, text = sourceOf(rel)): { at: string; viaFloor: boolean }[] {
  const sf = ts.createSourceFile(rel, text, ts.ScriptTarget.ES2022, true);
  const out: { at: string; viaFloor: boolean }[] = [];
  const visit = (n: ts.Node): void => {
    if (
      ts.isCallExpression(n) &&
      /(^|\.)getAttribute(\.call)?$/.test(n.expression.getText(sf)) &&
      n.arguments.some((a) => ts.isStringLiteralLike(a) && a.text.toLowerCase() === 'content')
    ) {
      let v: ts.Node = n;
      for (;;) {
        const p = v.parent;
        const nullish = ts.isBinaryExpression(p) && p.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken && p.left === v;
        if (ts.isParenthesizedExpression(p) || nullish) v = p;
        else break;
      }
      const call = v.parent;
      const viaFloor = ts.isCallExpression(call) && ts.isIdentifier(call.expression) && call.expression.text === 'cspFloor' && call.arguments[0] === v;
      out.push({ at: `${rel}:${lineOf(sf, n)}`, viaFloor });
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out;
}

describe('L3.M6 cspFloor is the only tokeniser of a policy', () => {
  const files = srcFiles();
  const readers = policyReaders(files);
  const fileOf = (at: string): string => at.replace(/:\d+$/, '');

  it('the files that read a policy include csp.ts, the bootstrap and frameDocument', () => {
    expect(files).toContain('src/frame/csp-rules.ts');
    expect(files.length).toBeGreaterThan(50);
    expect(readers).toEqual(expect.arrayContaining(['src/frame/csp.ts', 'src/frame-runtime/bootstrap.ts', 'src/frame/document.ts']));
    expect(importsOf('src/frame/csp.ts').get('./csp-rules.js')).toContain('cspFloor');
    expect(importsOf('src/frame-runtime/bootstrap.ts').get('../frame/csp-rules.js')).toContain('cspFloor');
  });

  it("no file that reads a policy writes a semicolon but csp-rules.ts, once (the floor's split; frameCsp, the writer, aside)", () => {
    expect([...readers, 'src/frame/csp-rules.ts'].flatMap((rel) => semicolonLiterals(rel)).map(fileOf)).toEqual(['src/frame/csp-rules.ts']);
  });

  it('the source tree splits on a semicolon in src/frame/csp-rules.ts alone, once', () => {
    expect(files.flatMap((rel) => semicolonSplits(rel)).map(fileOf)).toEqual(['src/frame/csp-rules.ts']);
  });

  it("every read of an element's content attribute under src/ goes straight to cspFloor, the bootstrap's among them", () => {
    const reads = files.flatMap((rel) => contentReads(rel));
    expect(reads.map((r) => fileOf(r.at))).toContain('src/frame-runtime/bootstrap.ts');
    expect(reads.filter((r) => !r.viaFloor).map((r) => r.at)).toEqual([]);
  });

  it("src/frame/csp.ts reads checkFrameCsp's policy only through cspFloor", () => {
    // Every use of checkFrameCsp's policy parameter is the argument of a cspFloor call.
    const rel = 'src/frame/csp.ts';
    const sf = ts.createSourceFile(rel, sourceOf(rel), ts.ScriptTarget.ES2022, true);
    const fn = sf.statements.find((s): s is ts.FunctionDeclaration => ts.isFunctionDeclaration(s) && s.name?.text === 'checkFrameCsp');
    const param = fn?.parameters[0]?.name;
    if (fn?.body === undefined || param === undefined || !ts.isIdentifier(param)) throw new Error('checkFrameCsp(csp, ...) not found');
    const uses: string[] = [];
    const visit = (n: ts.Node): void => {
      if (ts.isIdentifier(n) && n.text === param.text) {
        const call = n.parent;
        const viaFloor = ts.isCallExpression(call) && ts.isIdentifier(call.expression) && call.expression.text === 'cspFloor' && call.arguments[0] === n;
        uses.push(viaFloor ? 'cspFloor' : `line ${lineOf(sf, n)}`);
      }
      ts.forEachChild(n, visit);
    };
    visit(fn.body);
    expect(uses).toEqual(['cspFloor']);
  });

  it('the scans see a second tokeniser in every written form, and a content read that bypasses cspFloor (their control)', () => {
    const text =
      "import { cspFloor } from '../frame/csp-rules.js';\n" +
      "const SEMI = ';';\n" +
      'export const a = (p: string) => p.match(/[^;]+/g);\n' +
      'export const b = (p: string) => p.split(SEMI);\n' +
      "export const c = (p: string) => p.indexOf(';');\n" +
      "export const d = (el: Element) => el.getAttribute('content');\n" +
      "export const e = (el: Element) => cspFloor(el.getAttribute('content') ?? '');\n" +
      "export function frameCsp(): string { return 'a; b'; }\n" +
      "export const f = (p: string) => p.split(';');\n";
    expect(semicolonLiterals('x.ts', text)).toEqual(['x.ts:2', 'x.ts:3', 'x.ts:5', 'x.ts:9']);
    expect(semicolonSplits('x.ts', text)).toEqual(['x.ts:9']);
    expect(contentReads('x.ts', text)).toEqual([
      { at: 'x.ts:6', viaFloor: false },
      { at: 'x.ts:7', viaFloor: true },
    ]);
  });

  it('src/frame/csp-rules.ts imports nothing, so the bootstrap bundles no manifest through it', () => {
    expect([...importsOf('src/frame/csp-rules.ts').keys()]).toEqual([]);
  });
});
