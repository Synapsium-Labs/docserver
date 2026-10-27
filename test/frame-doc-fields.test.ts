// DOC_FIELDS, the per-document fields the bridge's `doc:<field>` keys may name (docserver L3, Task 1; plan Reference §8.3,
// FD8; row L3.M11). scripts/gen-doc-fields.mjs walks every writeDoc(...) and readDoc(...) call in src/enhance with the
// TypeScript checker and writes src/frame/doc-fields.generated.ts. It resolves a field only by the rules of Reference
// §8.3 (a literal or no-substitution template; a const, across modules and re-exports, `as const` objects included; a
// wrapper's parameter to every call site, at most 4 wrappers deep; both arms of a conditional) and fails, with the file
// and line, on anything else: it never skips a call.
//
// The fixtures under test/fixtures/doc-fields/ hold one case per directory. The superset row below reads src/enhance with
// a second, simpler scan written here (literals and same-file consts only), so it does not trust the generator it checks.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { afterAll, describe, expect, it } from 'vitest';
import { DOC_FIELDS_TS, docFieldsModule, scanDocFields, type DocFieldScan } from '../scripts/gen-doc-fields.mjs';
import { DOC_FIELDS } from '../src/frame/index.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const FIXTURES = 'test/fixtures/doc-fields';
const SCRIPT = path.join(ROOT, 'scripts', 'gen-doc-fields.mjs');

const scratch = mkdtempSync(path.join(tmpdir(), 'docserver-doc-fields-'));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

function run(args: string[]): { status: number | null; stdout: string; stderr: string } {
  const r = spawnSync(process.execPath, [SCRIPT, ...args], { cwd: ROOT, encoding: 'utf8', timeout: 120_000 });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

/**
 * The scan of one fixture directory. The generator reports every failure with its file and line; it never throws
 * (a throw would be a crash, not a report), so a throw is an assertion failure here.
 */
function scanOf(dir: string): DocFieldScan {
  let r: DocFieldScan = { fields: [], failures: [] };
  expect(() => {
    r = scanDocFields({ dir });
  }, `${dir}: the generator throws instead of reporting`).not.toThrow();
  return r;
}

/** The line (1-based) of the first line of `file` that contains `needle`. */
function lineOf(file: string, needle: string): number {
  const lines = readFileSync(path.join(ROOT, file), 'utf8').split('\n');
  const i = lines.findIndex((l) => l.includes(needle));
  if (i < 0) throw new Error(`${needle} is not in ${file}`);
  return i + 1;
}

describe('L3.M11 the generator resolves each rule of Reference §8.3', () => {
  it('a literal, a template, an imported const, as-const members, a re-export, a const alias, a conditional, two wrappers, an element-access callee', () => {
    const r = scanDocFields({ dir: `${FIXTURES}/resolves` });
    expect(r.failures).toEqual([]);
    expect(r.fields).toEqual(['bracketed', 'deep', 'imported', 'literal', 'local', 'member', 'no', 'reexported', 'template', 'twice-wrapped', 'typed', 'wrapped', 'yes']);
  });

  it('four wrapper levels resolve (the boundary)', () => {
    expect(scanDocFields({ dir: `${FIXTURES}/depth-four` })).toEqual({ fields: ['four'], failures: [] });
  });
});

describe('L3.M11 the generator fails, with file and line, on anything else', () => {
  const CASES: readonly (readonly [string, string, RegExp])[] = [
    ['computed', 's.readDoc(KEYS[k]);', /computed/],
    ['template', 's.writeDoc(`field-${n}`, 1);', /template with a substitution/],
    ['fifth-wrapper', 'w4(s, n);', /fifth wrapper level/],
    ['value-wrapper', 'export const HANDLERS = [save];', /wrapper passed as a value/],
    ['inline-callback', "['a', 'b'].forEach", /not a named function/],
    ['mutable-object', 's.readDoc(KEYS.a);', /as const/],
    ['let-binding', 's.readDoc(n);', /not a const/],
    ['method-value', 'return s.writeDoc;', /as a value/],
    // One row per remaining failure rule (review findings S1 and E1): each goes red when its guard is removed.
    ['element-value', "const f = s['writeDoc'];", /writeDoc taken as a value/],
    ['element-callee', "s['writeDoc'](parts.join('-'), 1);", /does not follow \(CallExpression\)/],
    ['no-call-site', 's.writeDoc(n, 1);', /no call site in the scanned directory/],
    ['pos-field', "s.writeDoc('pos', 1);", /the field pos is the reading position's/],
    ['field-grammar', "s.readDoc('a:b');", /outside/],
    ['spread-call', 's.writeDoc(...ARGS);', /a call without its field argument/],
    ['spread-wrapper', "save(...head, 'shown');", /a spread argument to a wrapper/],
    ['rest-param', 's.writeDoc(names as unknown as string, 1);', /a rest parameter/],
    ['destructured-param', 's.writeDoc(name, 1);', /a destructured binding/],
    // The fix round's second pass: every other failure rule of the generator, one row each.
    ['static-member', 's.readDoc(Fields.seen);', /not a const, a const object member or a wrapper parameter/],
    ['binding-cycle', 'export const A: string = B;', /a chain of bindings too long to follow/],
    ['undeclared', 's.readDoc(undefined as unknown as string);', /does not resolve to a declaration/],
    ['no-initialiser', 's.readDoc(NAME);', /has no initialiser/],
    ['let-object', 's.readDoc(KEYS.a);', /not the initialiser of a const/],
    ['let-wrapper', 's.writeDoc(n, 1);', /not a named function wrapper/],
    ['missing-argument', 'save(s);', /a call of save without its field argument/],
    ['no-argument', 's.readDoc();', /a call without its field argument/],
  ];

  for (const [dir, needle, reason] of CASES) {
    it(`${dir}: fails at ${needle}`, () => {
      const file = `${FIXTURES}/${dir}/main.ts`;
      const r = scanOf(`${FIXTURES}/${dir}`);
      expect(r.failures.length, JSON.stringify(r.failures)).toBeGreaterThanOrEqual(1);
      const f = r.failures[0];
      expect({ file: f?.file, line: f?.line }).toEqual({ file, line: lineOf(file, needle) });
      expect(f?.reason).toMatch(reason);
    });
  }

  it('element-value: both element-access values fail, and no field is credited past them', () => {
    const r = scanDocFields({ dir: `${FIXTURES}/element-value` });
    const file = `${FIXTURES}/element-value/main.ts`;
    expect(r.failures.map((f) => [f.file, f.line])).toEqual([
      [file, lineOf(file, "s['writeDoc'];")],
      [file, lineOf(file, "s['readDoc'].bind")],
    ]);
    expect(r.fields).toEqual(['seen-here']);
  });

  it('the CLI reports a failure with its file and line, writes nothing and exits 1', () => {
    const out = path.join(scratch, 'never-written.ts');
    const r = run(['--src', `${FIXTURES}/template`, '--out', out]);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain(`${FIXTURES}/template/main.ts:${lineOf(`${FIXTURES}/template/main.ts`, 'field-')}:`);
    expect(() => readFileSync(out)).toThrow();
  });
});

describe('L3.M11 the committed file', () => {
  it('--check exits 0: src/frame/doc-fields.generated.ts is what the generator writes', () => {
    const r = run(['--check']);
    expect(r.stderr).toBe('');
    expect(r.status).toBe(0);
  });

  it('the module text is the generated text for the scan of src/enhance, with pos', () => {
    const r = scanDocFields({});
    expect(r.failures).toEqual([]);
    expect(readFileSync(path.join(ROOT, DOC_FIELDS_TS), 'utf8')).toBe(docFieldsModule(r.fields));
    expect(DOC_FIELDS).toEqual([...new Set([...r.fields, 'pos'])].sort());
  });

  it('--check exits 1 on a file that differs, and the CLI writes the file when not checking', () => {
    const out = path.join(scratch, 'doc-fields.generated.ts');
    writeFileSync(out, "export const DOC_FIELDS: readonly string[] = Object.freeze(['pos']);\n");
    const differs = run(['--check', '--out', out]);
    expect(differs.status).toBe(1);
    expect(differs.stderr).toMatch(/differs/);
    expect(run(['--out', out]).status).toBe(0);
    expect(readFileSync(out, 'utf8')).toBe(readFileSync(path.join(ROOT, DOC_FIELDS_TS), 'utf8'));
    expect(run(['--check', '--out', out]).status).toBe(0);
  });

  it('a usage error exits 2, a directory that does not exist included', () => {
    expect(run(['--nope']).status).toBe(2);
    expect(run(['--src']).status).toBe(2);
    const missing = run(['--src', `${FIXTURES}/no-such-directory`]);
    expect(missing.status).toBe(2);
    expect(missing.stderr).toMatch(/no directory/);
  });
});

/** Every .ts file under `dir`, from the package root, sorted. */
function tsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) out.push(...tsFiles(rel));
    else if (e.name.endsWith('.ts') && !e.name.endsWith('.d.ts')) out.push(rel);
  }
  return out.sort();
}

/** The writeDoc/readDoc name an expression carries: an identifier, a property name or a string-literal element access. */
function docCallName(e: ts.Expression): string | null {
  const name = ts.isPropertyAccessExpression(e)
    ? e.name.text
    : ts.isIdentifier(e)
      ? e.text
      : ts.isElementAccessExpression(e) && ts.isStringLiteralLike(e.argumentExpression)
        ? e.argumentExpression.text
        : null;
  return name === 'writeDoc' || name === 'readDoc' ? name : null;
}

/**
 * The simple scan: every call whose callee is named writeDoc or readDoc (by a name, a property or a string-literal
 * element access), with its first argument read as a string literal, or as an identifier bound by a `const NAME = '…'`
 * in the same file. Anything else is listed as unread, and so is every use of writeDoc or readDoc as a value (a
 * reference that is neither a callee nor a declaration's name).
 */
function simpleScan(dir: string): { names: string[]; unread: string[]; calls: number } {
  const names = new Set<string>();
  const unread: string[] = [];
  let calls = 0;
  for (const file of tsFiles(dir)) {
    const text = readFileSync(path.join(ROOT, file), 'utf8');
    const sf = ts.createSourceFile(file, text, ts.ScriptTarget.ES2022, true);
    const at = (n: ts.Node): string => `${file}:${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1}`;
    const consts = new Map<string, string>();
    const collect = (n: ts.Node): void => {
      if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer !== undefined && ts.isStringLiteral(n.initializer)) {
        if ((ts.getCombinedNodeFlags(n) & ts.NodeFlags.Const) !== 0) consts.set(n.name.text, n.initializer.text);
      }
      ts.forEachChild(n, collect);
    };
    collect(sf);
    const visit = (n: ts.Node): void => {
      if (ts.isCallExpression(n) && docCallName(n.expression) !== null) {
        calls += 1;
        const a = n.arguments[0];
        if (a !== undefined && ts.isStringLiteral(a)) names.add(a.text);
        else if (a !== undefined && ts.isIdentifier(a) && consts.has(a.text)) names.add(consts.get(a.text) ?? '');
        else unread.push(at(n));
      } else if ((ts.isPropertyAccessExpression(n) || ts.isElementAccessExpression(n) || ts.isIdentifier(n)) && docCallName(n) !== null) {
        const p = n.parent;
        const isPropertyName = ts.isPropertyAccessExpression(p) && p.name === n;
        // A declaration's own name; a shorthand property (`{ writeDoc }`) is a value use, not a declaration.
        const declared = 'name' in p && (p as { name?: ts.Node }).name === n && !ts.isPropertyAccessExpression(p) && !ts.isShorthandPropertyAssignment(p);
        const called = ts.isCallExpression(p) && p.expression === n;
        if (!isPropertyName && !declared && !called) unread.push(at(n));
      }
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }
  return { names: [...names].sort(), unread, calls };
}

describe('L3.M11 DOC_FIELDS is a superset of every writeDoc/readDoc name in src/enhance', () => {
  it('by an independent AST scan, which reads every call there', () => {
    const s = simpleScan('src/enhance');
    expect(s.calls).toBeGreaterThanOrEqual(10);
    expect(s.unread).toEqual([]);
    expect(s.names.length).toBeGreaterThanOrEqual(5);
    expect(s.names.filter((n) => !(DOC_FIELDS as readonly string[]).includes(n))).toEqual([]);
  });

  it("includes 'pos', the reading position, which no writeDoc names", () => {
    expect(DOC_FIELDS).toContain('pos');
    expect(simpleScan('src/enhance').names).not.toContain('pos');
  });

  it('the simple scan sees a call the committed list lacks (its control)', () => {
    const s = simpleScan(`${FIXTURES}/method-value`);
    expect(s.names).toEqual(['seen-here']);
    expect(s.names.filter((n) => !(DOC_FIELDS as readonly string[]).includes(n))).toEqual(['seen-here']);
  });

  it('the simple scan reads an element-access call, and lists every value use of writeDoc or readDoc as unread', () => {
    expect(simpleScan(`${FIXTURES}/resolves`).names).toContain('bracketed');
    const value = `${FIXTURES}/element-value/main.ts`;
    expect(simpleScan(`${FIXTURES}/element-value`).unread).toEqual([
      `${value}:${lineOf(value, "s['writeDoc'];")}`,
      `${value}:${lineOf(value, "s['readDoc'].bind")}`,
    ]);
    const method = `${FIXTURES}/method-value/main.ts`;
    expect(simpleScan(`${FIXTURES}/method-value`).unread).toEqual([`${method}:${lineOf(method, 'return s.writeDoc;')}`]);
  });
});
