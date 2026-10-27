// DOC_FIELDS: the per-document fields the bridge's `doc:<field>` store keys may name (docserver L3; plan Reference §8.3).
//
//   node scripts/gen-doc-fields.mjs              scan src/enhance and write src/frame/doc-fields.generated.ts
//   node scripts/gen-doc-fields.mjs --check      scan and compare; exit 1 when the committed file differs
//   ... [--src <dir>] [--out <file>]             scan <dir>, or write or check <file>, instead (paths from the package root)
//
// A TypeScript-checker walk of every writeDoc(...) and readDoc(...) call in the scanned directory. Each call's first
// argument, the field, is resolved by these rules only:
// - a string literal or a template with no substitution;
// - an identifier or a property access bound to a const whose initialiser resolves, followed across modules and
//   re-exports; a property resolves only as a member of an object that is the initialiser of a const and is `as const`;
// - a parameter of a named wrapper function (a function declaration, or an arrow function or function expression bound
//   to a const), followed to every call site of that wrapper in the scanned directory, transitively, at most 4 wrappers
//   deep;
// - a conditional of two resolvable arms yields both; parentheses, `as const` and `satisfies` are looked through.
// Anything else fails the generator with its file and line, and it never skips a call: a computed key, a template with a
// substitution, a let, a const with no initialiser, a name with no declaration, a destructured binding, a rest
// parameter, a member of an object that is not `as const` or not a const's initialiser, any other binding (a class
// member, a function), a chain of bindings longer than 64 steps (a cycle), a parameter of an anonymous callback, a method
// or a function bound to a let, a wrapper passed as a value, a wrapper with no call site in the scanned directory or
// called without its field argument or with a spread before it, a fifth wrapper level, a call with no field argument,
// and writeDoc or readDoc themselves taken as a value (by name, by property or by a string-literal element access such
// as `s['writeDoc']`). It reports each failure and never throws on one. A field must match FIELD (it becomes part of a
// store key) and must not be `pos`, which the generator adds itself: L2 keeps the reading position under
// `<ns>:pos:<posKey>`, and the bridge names it `doc:pos`.
//
// Exit codes: 0 written (or checked equal); 1 a call failed to resolve, or the file differs (the reasons on stderr);
// 2 a usage error. Dev tooling, never shipped; what the tests use is exported (types in gen-doc-fields.d.mts).
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

/** The package root this script belongs to. */
const ROOT = fileURLToPath(new URL('../', import.meta.url));

/** The scanned directory and the generated file, from the package root. */
export const ENHANCE_DIR = 'src/enhance';
export const DOC_FIELDS_TS = 'src/frame/doc-fields.generated.ts';

/** The calls that name a per-document field. */
const CALLS = new Set(['writeDoc', 'readDoc']);
/** The deepest wrapper level followed. */
export const MAX_WRAPPERS = 4;
/** A field's grammar: it becomes the `<field>` of a `doc:<field>` key. */
export const FIELD = /^[A-Za-z0-9_-]{1,64}$/;
/** The field the generator adds: the reading position. */
const POS = 'pos';

/** Every .ts file under `dir` (absolute), declarations left out, sorted. */
function tsFiles(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...tsFiles(p));
    else if (e.name.endsWith('.ts') && !e.name.endsWith('.d.ts')) out.push(p);
  }
  return out.sort();
}

class Unresolved extends Error {
  constructor(node, reason) {
    super(reason);
    this.node = node;
  }
}

/** Look through parentheses, `as` and `satisfies`; report whether an `as const` was crossed. */
function unwrap(e) {
  let asConst = false;
  for (;;) {
    if (ts.isParenthesizedExpression(e)) e = e.expression;
    else if (ts.isAsExpression(e)) {
      if (ts.isTypeReferenceNode(e.type) && ts.isIdentifier(e.type.typeName) && e.type.typeName.text === 'const') asConst = true;
      e = e.expression;
    } else if (ts.isSatisfiesExpression(e)) e = e.expression;
    else return { e, asConst };
  }
}

const isConstDeclaration = (d) => ts.isVariableDeclaration(d) && (ts.getCombinedNodeFlags(d) & ts.NodeFlags.Const) !== 0;

/**
 * Scan `dir` (default src/enhance, from `root`, default the package root) for writeDoc/readDoc calls. Returns the
 * resolved fields (sorted, unique, `pos` not added) and every failure, each with its file (from `root`, forward
 * slashes), line and reason.
 */
export function scanDocFields({ dir = ENHANCE_DIR, root = ROOT } = {}) {
  const abs = path.resolve(root, dir);
  const files = tsFiles(abs);
  const program = ts.createProgram(files, {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    lib: ['lib.es2022.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'],
    types: [],
    strict: true,
    noEmit: true,
    skipLibCheck: true,
  });
  const checker = program.getTypeChecker();
  const sources = files.map((f) => program.getSourceFile(f)).filter((s) => s !== undefined);
  const rel = (sf) => path.relative(root, sf.fileName).split(path.sep).join('/');
  const where = (node) => {
    const sf = node.getSourceFile();
    return { file: rel(sf), line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1 };
  };

  const symbolOf = (node) => {
    let s = checker.getSymbolAtLocation(node);
    if (s !== undefined && (s.flags & ts.SymbolFlags.Alias) !== 0) s = checker.getAliasedSymbol(s);
    return s;
  };

  /** Every reference to a wrapper's symbol in the scanned files: its call sites, or a failure for any other use. */
  const callSitesCache = new Map();
  function callSites(wrapper, declName) {
    if (callSitesCache.has(wrapper)) return callSitesCache.get(wrapper);
    const calls = [];
    const visit = (n) => {
      if (ts.isIdentifier(n) && n !== declName && symbolOf(n) === wrapper) {
        const p = n.parent;
        const callee = ts.isPropertyAccessExpression(p) && p.name === n ? p : n;
        const c = callee.parent;
        if (ts.isCallExpression(c) && c.expression === callee) calls.push(c);
        else if (!(ts.isImportSpecifier(p) || ts.isExportSpecifier(p) || ts.isImportClause(p) || ts.isNamespaceImport(p))) {
          throw new Unresolved(n, `a wrapper passed as a value (${n.text}): its later callers cannot be followed`);
        }
      }
      ts.forEachChild(n, visit);
    };
    for (const sf of sources) visit(sf);
    callSitesCache.set(wrapper, calls);
    return calls;
  }

  /** The wrapper whose parameter `param` is: its symbol and name, or a failure. */
  function wrapperOf(param, at) {
    const fn = param.parent;
    if (ts.isFunctionDeclaration(fn) && fn.name !== undefined) return { fn, name: fn.name };
    if ((ts.isArrowFunction(fn) || ts.isFunctionExpression(fn)) && ts.isVariableDeclaration(fn.parent) && fn.parent.initializer === fn) {
      const d = fn.parent;
      if (isConstDeclaration(d) && ts.isIdentifier(d.name)) return { fn, name: d.name };
    }
    throw new Unresolved(at, 'a parameter of a function that is not a named function wrapper (a function declaration, or a function bound to a const)');
  }

  /** The fields an expression may evaluate to, or a failure. `level` is the number of wrappers already crossed. */
  function resolve(expr, level, steps = 0) {
    if (steps > 64) throw new Unresolved(expr, 'a chain of bindings too long to follow');
    const { e } = unwrap(expr);
    if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return [e.text];
    if (ts.isTemplateExpression(e)) throw new Unresolved(e, 'a template with a substitution');
    if (ts.isConditionalExpression(e)) return [...resolve(e.whenTrue, level, steps + 1), ...resolve(e.whenFalse, level, steps + 1)];
    if (ts.isElementAccessExpression(e)) throw new Unresolved(e, 'a computed key');
    if (ts.isIdentifier(e) || ts.isPropertyAccessExpression(e)) {
      const name = ts.isIdentifier(e) ? e : e.name;
      const sym = symbolOf(name);
      const decl = sym?.valueDeclaration ?? sym?.declarations?.[0];
      if (decl === undefined) throw new Unresolved(e, `${name.text} does not resolve to a declaration`);
      // A name bound by a destructuring pattern, in a parameter or a const: the checker resolves it to its binding
      // element, never to the parameter or the declaration, so this is where a destructured name is refused.
      if (ts.isBindingElement(decl)) throw new Unresolved(e, `${name.text} is a destructured binding`);
      if (ts.isVariableDeclaration(decl)) {
        if (!isConstDeclaration(decl)) throw new Unresolved(e, `${name.text} is not a const`);
        if (decl.initializer === undefined) throw new Unresolved(e, `${name.text} has no initialiser`);
        return resolve(decl.initializer, level, steps + 1);
      }
      if (ts.isPropertyAssignment(decl)) {
        let node = decl.parent;
        let sawConst = false;
        for (;;) {
          const p = node.parent;
          if (ts.isParenthesizedExpression(p) || ts.isSatisfiesExpression(p) || ts.isAsExpression(p)) {
            if (ts.isAsExpression(p) && unwrap(p).asConst) sawConst = true;
            node = p;
          } else if (ts.isPropertyAssignment(p) && p.initializer === node) node = p.parent;
          else if (isConstDeclaration(p) && p.initializer === node) break;
          else throw new Unresolved(e, `${name.text} is a member of an object that is not the initialiser of a const`);
        }
        if (!sawConst) throw new Unresolved(e, `${name.text} is a member of an object that is not as const`);
        return resolve(decl.initializer, level, steps + 1);
      }
      if (ts.isParameter(decl)) {
        if (decl.dotDotDotToken !== undefined) throw new Unresolved(e, 'a rest parameter');
        const { fn, name: wrapperName } = wrapperOf(decl, e);
        if (level + 1 > MAX_WRAPPERS) throw new Unresolved(e, `a fifth wrapper level (${wrapperName.text}): at most ${MAX_WRAPPERS} are followed`);
        const index = fn.parameters.indexOf(decl);
        const wrapper = symbolOf(wrapperName);
        if (wrapper === undefined) throw new Unresolved(e, `${wrapperName.text} does not resolve`);
        const sites = callSites(wrapper, wrapperName);
        if (sites.length === 0) throw new Unresolved(e, `${wrapperName.text} has no call site in the scanned directory`);
        const out = [];
        for (const call of sites) {
          const args = call.arguments;
          if (args.slice(0, index + 1).some((a) => ts.isSpreadElement(a))) throw new Unresolved(call, 'a spread argument to a wrapper');
          const arg = args[index];
          if (arg === undefined) throw new Unresolved(call, `a call of ${wrapperName.text} without its field argument`);
          out.push(...resolve(arg, level + 1, steps + 1));
        }
        return out;
      }
      throw new Unresolved(e, `${name.text} is not a const, a const object member or a wrapper parameter`);
    }
    throw new Unresolved(e, `an expression the generator does not follow (${ts.SyntaxKind[e.kind]})`);
  }

  const fields = new Set();
  const failures = [];
  const fail = (node, reason) => failures.push({ ...where(node), reason });

  /** The name a callee carries, when it is writeDoc or readDoc. */
  const calleeName = (callee) => {
    const { e } = unwrap(callee);
    if (ts.isIdentifier(e)) return e.text;
    if (ts.isPropertyAccessExpression(e)) return e.name.text;
    if (ts.isElementAccessExpression(e) && ts.isStringLiteralLike(e.argumentExpression)) return e.argumentExpression.text;
    return null;
  };

  const visit = (n) => {
    if (ts.isCallExpression(n) && CALLS.has(calleeName(n.expression) ?? '')) {
      const arg = n.arguments[0];
      if (arg === undefined || ts.isSpreadElement(arg)) fail(n, 'a call without its field argument');
      else {
        try {
          for (const f of resolve(arg, 0)) {
            if (f === POS) fail(arg, `the field ${POS} is the reading position's, which the generator adds itself`);
            else if (!FIELD.test(f)) fail(arg, `the field ${JSON.stringify(f)} is outside ${FIELD.source}`);
            else fields.add(f);
          }
        } catch (err) {
          if (!(err instanceof Unresolved)) throw err;
          fail(err.node, err.message);
        }
      }
    } else if (ts.isIdentifier(n) && CALLS.has(n.text)) {
      // writeDoc or readDoc used other than as a callee or a declaration name: a value that escapes the scan.
      const p = n.parent;
      const named = (ts.isMethodDeclaration(p) || ts.isMethodSignature(p) || ts.isPropertySignature(p) || ts.isPropertyDeclaration(p) ||
        ts.isFunctionDeclaration(p) || ts.isBindingElement(p) || ts.isPropertyAssignment(p)) && p.name === n;
      const accessed = ts.isPropertyAccessExpression(p) && p.name === n;
      const callee = (accessed ? p : n).parent;
      const called = ts.isCallExpression(callee) && unwrap(callee.expression).e === (accessed ? p : n);
      if (!named && !called) fail(n, `${n.text} taken as a value: its later calls cannot be followed`);
    } else if (ts.isElementAccessExpression(n) && ts.isStringLiteralLike(n.argumentExpression) && CALLS.has(n.argumentExpression.text)) {
      // s['writeDoc'] used other than as a callee: the same escape, spelt as an element access.
      const c = n.parent;
      const called = ts.isCallExpression(c) && unwrap(c.expression).e === n;
      if (!called) fail(n, `${n.argumentExpression.text} taken as a value: its later calls cannot be followed`);
    }
    ts.forEachChild(n, visit);
  };
  for (const sf of sources) visit(sf);
  failures.sort((a, b) => (a.file === b.file ? a.line - b.line : a.file < b.file ? -1 : 1));
  return { fields: [...fields].sort(), failures };
}

/** The generated module's text for the scanned fields: `pos` added, sorted, unique. */
export function docFieldsModule(fields) {
  const all = [...new Set([...fields, POS])].sort();
  return [
    '// Generated by scripts/gen-doc-fields.mjs: do not edit. Regenerate with `node scripts/gen-doc-fields.mjs`; the',
    '// tests run it with `--check`.',
    '//',
    '// The per-document fields L2 keeps: every field its writeDoc(...) and readDoc(...) calls in src/enhance can name, read',
    '// by a TypeScript-checker walk, plus `pos`, the reading position (`<ns>:pos:<posKey>`). The bridge names each one',
    '// `doc:<field>`; any other per-document key is dropped by the frame and refused by the parent. The list is `as const`,',
    '// so `doc:<field>` is a closed union at compile time too (BridgeStoreKey, src/frame/protocol.ts).',
    `export const DOC_FIELDS = Object.freeze([${all.map((f) => `'${f}'`).join(', ')}] as const);`,
    '',
  ].join('\n');
}

function main(argv) {
  let check = false;
  let src = ENHANCE_DIR;
  let out = DOC_FIELDS_TS;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--check') check = true;
    else if (argv[i] === '--src' && argv[i + 1] !== undefined) src = argv[++i];
    else if (argv[i] === '--out' && argv[i + 1] !== undefined) out = argv[++i];
    else {
      process.stderr.write(`gen-doc-fields: unknown or incomplete argument ${JSON.stringify(argv[i])}\n`);
      process.stderr.write('usage: node scripts/gen-doc-fields.mjs [--check] [--src <dir>] [--out <file>]\n');
      return 2;
    }
  }
  if (!existsSync(path.resolve(ROOT, src))) {
    process.stderr.write(`gen-doc-fields: no directory ${src}\n`);
    return 2;
  }
  const { fields, failures } = scanDocFields({ dir: src });
  if (failures.length > 0) {
    for (const f of failures) process.stderr.write(`gen-doc-fields: ${f.file}:${f.line}: ${f.reason}\n`);
    return 1;
  }
  const text = docFieldsModule(fields);
  const target = path.resolve(ROOT, out);
  if (check) {
    const now = existsSync(target) ? readFileSync(target, 'utf8') : null;
    if (now !== text) {
      process.stderr.write(`gen-doc-fields: ${out} differs from the scan of ${src}; run node scripts/gen-doc-fields.mjs\n`);
      return 1;
    }
    return 0;
  }
  writeFileSync(target, text);
  return 0;
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
