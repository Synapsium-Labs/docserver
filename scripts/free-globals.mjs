// The free-global scan of the frame's bundled scripts (docserver L3, Task 6; plan Reference §5.5, ruling R2, FD6).
//
// An element id becomes a named property of the window wherever the window has no own property of that name, so it can
// shadow what the global inherits (`addEventListener`, `toString`) or lacks (`requestIdleCallback` on an engine without
// it). The bootstrap therefore pins, before any content exists, every name the frame's scripts read from the global
// (src/frame-runtime/pin.ts). This module finds those names, in the built text of each bundled script, with the
// TypeScript binder: each text is its own program (a classic script, so no file's top-level names reach another), with
// no default library, so every name a script does not bind itself resolves to nothing.
//
// What a script reads from the global, and is listed:
// - an unbound identifier reference: an identifier in an expression position that resolves to no declaration of the
//   script (so a name `lib.dom` declares but an engine lacks is caught too, since no library is loaded), `arguments`
//   inside a function excepted;
// - a static member read on the global: `x.name`, `x?.name`, `x['literal']` or `` x[`literal`] ``, and a property of an
//   object binding pattern initialised from it (`const {name} = x`), where x is an unbound `globalThis`, `window` or
//   `self`, or a local alias the binder proves bound to one: a variable whose one declaration is initialised to one of
//   them (or to another such alias) and which is never written again. A member named by an array index (`window[0]`)
//   is a child browsing context, never a pin, and is left out.
//
// What a script writes on the global is reported apart, never listed: an unbound name assigned (`x = 1`, `x += 1`,
// `x++`, a destructuring or for-in/of target), and a static member of the global assigned the same ways. A pinned name
// is read-only, so a script's own later write to it would throw: scripts/build-frame.mjs fails the build on a written
// name unless it is on its short reviewed allowlist, and an allowlisted name is never pinned, even when it is also read.
//
// What the scan cannot see (risk R9): a computed member `globalThis[name]`, and a member read through a binding the
// binder cannot prove is the global, such as a function parameter bound at its call site (fastdom's IIFE writes
// `e.fastdom` through its parameter `e`). Those names are the anchor battery's (Task 8) and the allowlist's.
//
// Dev tooling, never shipped; types in free-globals.d.mts.
import ts from 'typescript';

/** The names of the global object a script can reach it by. */
export const GLOBAL_NAMES = Object.freeze(['globalThis', 'window', 'self']);

/** The largest list the bootstrap carries (Reference §5.5). */
export const MAX_FREE_GLOBALS = 512;

const OPTIONS = Object.freeze({
  noLib: true,
  allowJs: true,
  checkJs: false,
  noEmit: true,
  noResolve: true,
  types: [],
  target: ts.ScriptTarget.ES2022,
});

const ASSIGNMENT = new Set([
  ts.SyntaxKind.EqualsToken,
  ts.SyntaxKind.PlusEqualsToken,
  ts.SyntaxKind.MinusEqualsToken,
  ts.SyntaxKind.AsteriskEqualsToken,
  ts.SyntaxKind.AsteriskAsteriskEqualsToken,
  ts.SyntaxKind.SlashEqualsToken,
  ts.SyntaxKind.PercentEqualsToken,
  ts.SyntaxKind.LessThanLessThanEqualsToken,
  ts.SyntaxKind.GreaterThanGreaterThanEqualsToken,
  ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken,
  ts.SyntaxKind.AmpersandEqualsToken,
  ts.SyntaxKind.BarEqualsToken,
  ts.SyntaxKind.CaretEqualsToken,
  ts.SyntaxKind.AmpersandAmpersandEqualsToken,
  ts.SyntaxKind.BarBarEqualsToken,
  ts.SyntaxKind.QuestionQuestionEqualsToken,
]);

/** A program holding one script text, named `name.js`, and its checker. */
function programOf(name, text) {
  const file = `/free-globals/${name}.js`;
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.ES2022, true, ts.ScriptKind.JS);
  const host = {
    getSourceFile: (f) => (f === file ? source : undefined),
    getDefaultLibFileName: () => '/free-globals/lib.d.ts',
    writeFile: () => undefined,
    getCurrentDirectory: () => '/free-globals',
    getCanonicalFileName: (f) => f,
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => '\n',
    fileExists: (f) => f === file,
    readFile: (f) => (f === file ? text : undefined),
    directoryExists: () => true,
    getDirectories: () => [],
  };
  const program = ts.createProgram([file], OPTIONS, host);
  return { source, checker: program.getTypeChecker() };
}

const strip = (e) => {
  let n = e;
  while (ts.isParenthesizedExpression(n)) n = n.expression;
  return n;
};

/** True when the identifier `id` stands where an expression reads or writes a binding (not a key, label or name). */
function isReference(id) {
  const p = id.parent;
  if (p === undefined) return false;
  switch (p.kind) {
    case ts.SyntaxKind.PropertyAccessExpression:
      return p.expression === id;
    case ts.SyntaxKind.PropertyAssignment:
    case ts.SyntaxKind.PropertyDeclaration:
    case ts.SyntaxKind.VariableDeclaration:
    case ts.SyntaxKind.Parameter:
    case ts.SyntaxKind.BindingElement:
      return p.initializer === id;
    case ts.SyntaxKind.ShorthandPropertyAssignment:
      return p.name === id || p.objectAssignmentInitializer === id;
    case ts.SyntaxKind.FunctionDeclaration:
    case ts.SyntaxKind.FunctionExpression:
    case ts.SyntaxKind.ClassDeclaration:
    case ts.SyntaxKind.ClassExpression:
    case ts.SyntaxKind.MethodDeclaration:
    case ts.SyntaxKind.GetAccessor:
    case ts.SyntaxKind.SetAccessor:
      return p.name !== id;
    case ts.SyntaxKind.LabeledStatement:
    case ts.SyntaxKind.BreakStatement:
    case ts.SyntaxKind.ContinueStatement:
    case ts.SyntaxKind.MetaProperty:
    case ts.SyntaxKind.ImportSpecifier:
    case ts.SyntaxKind.ExportSpecifier:
    case ts.SyntaxKind.ImportClause:
    case ts.SyntaxKind.NamespaceImport:
    case ts.SyntaxKind.NamespaceExport:
    case ts.SyntaxKind.ImportEqualsDeclaration:
      return false;
    default:
      return true;
  }
}

/**
 * True when the expression `e` is written: the left of an assignment, the operand of `++` or `--`, the target of a
 * for-in or for-of, or an element of a destructuring assignment pattern that is one of those.
 */
function isWritten(e) {
  let n = e;
  for (;;) {
    const p = n.parent;
    if (p === undefined) return false;
    if (ts.isParenthesizedExpression(p)) {
      n = p;
      continue;
    }
    if (ts.isBinaryExpression(p)) return p.left === n && ASSIGNMENT.has(p.operatorToken.kind);
    if (ts.isPrefixUnaryExpression(p) || ts.isPostfixUnaryExpression(p)) {
      return p.operator === ts.SyntaxKind.PlusPlusToken || p.operator === ts.SyntaxKind.MinusMinusToken;
    }
    if (ts.isForInStatement(p) || ts.isForOfStatement(p)) return p.initializer === n;
    // Inside a pattern: an array element, a spread, a property's value, a shorthand name (with or without a default).
    if (ts.isArrayLiteralExpression(p) || ts.isSpreadElement(p) || ts.isSpreadAssignment(p)) {
      n = p;
      continue;
    }
    if (ts.isPropertyAssignment(p) && p.initializer === n) {
      n = p.parent;
      continue;
    }
    if (ts.isShorthandPropertyAssignment(p) && p.name === n) {
      n = p.parent;
      continue;
    }
    return false;
  }
}

/** The symbol an identifier reference resolves to, through a shorthand property's value. */
function symbolOf(id, checker) {
  const p = id.parent;
  if (p !== undefined && ts.isShorthandPropertyAssignment(p) && p.name === id) return checker.getShorthandAssignmentValueSymbol(p);
  return checker.getSymbolAtLocation(id);
}

/**
 * The declarations that bind a name. In a JavaScript file the binder also records an assignment such as `x.y = 1` at a
 * script's top level as a declaration of `x` (an "expando", its declaration the identifier itself); that binds
 * nothing at run time, so it does not count.
 */
const BINDINGS = new Set([
  ts.SyntaxKind.VariableDeclaration,
  ts.SyntaxKind.Parameter,
  ts.SyntaxKind.BindingElement,
  ts.SyntaxKind.FunctionDeclaration,
  ts.SyntaxKind.FunctionExpression,
  ts.SyntaxKind.ClassDeclaration,
  ts.SyntaxKind.ClassExpression,
  ts.SyntaxKind.ImportClause,
  ts.SyntaxKind.ImportSpecifier,
  ts.SyntaxKind.NamespaceImport,
  ts.SyntaxKind.ImportEqualsDeclaration,
]);

/** True when `id`, a reference, binds to nothing the script declares. */
function isUnbound(id, checker, source) {
  const sym = symbolOf(id, checker);
  if (sym === undefined) return true;
  const decls = sym.declarations ?? [];
  if (decls.some((d) => BINDINGS.has(d.kind) && d.getSourceFile() === source)) return false;
  // The checker's own symbols carry no declaration: `arguments` inside a function is bound by that function; anything
  // else (`undefined`, `globalThis`, the JavaScript `require` it treats specially) is the global's.
  return !(id.text === 'arguments' && sym.flags !== 0 && hasFunctionAbove(id));
}

function hasFunctionAbove(node) {
  for (let n = node.parent; n !== undefined; n = n.parent) {
    if (ts.isFunctionLike(n) && !ts.isArrowFunction(n)) return true;
  }
  return false;
}

/** The key of a static member access `e`, or null: a name, or a string or no-substitution template literal. */
function staticKey(e) {
  if (ts.isPropertyAccessExpression(e)) return ts.isIdentifier(e.name) ? e.name.text : null;
  if (ts.isElementAccessExpression(e)) {
    const a = strip(e.argumentExpression);
    if (ts.isStringLiteral(a) || ts.isNoSubstitutionTemplateLiteral(a)) return a.text;
  }
  return null;
}

const ARRAY_INDEX = /^(?:0|[1-9][0-9]*)$/;

/**
 * Scan one script: the names it reads from the global and the names it writes there, each sorted, and the aliases
 * of the global it proved (by name, for the report).
 */
export function scanScript(name, text) {
  const { source, checker } = programOf(name, text);
  const ids = [];
  const visit = (n) => {
    if (ts.isIdentifier(n) && isReference(n)) ids.push(n);
    ts.forEachChild(n, visit);
  };
  visit(source);

  // Every reference's symbol, and the writes to each symbol the script declares.
  const unbound = new Set();
  const writes = new Map();
  for (const id of ids) {
    if (isUnbound(id, checker, source)) {
      unbound.add(id);
      continue;
    }
    if (isWritten(id)) {
      const sym = symbolOf(id, checker);
      writes.set(sym, (writes.get(sym) ?? 0) + 1);
    }
  }

  // The aliases: a variable whose one declaration initialises it to the global (or to another alias), never written.
  const aliases = new Set();
  const isGlobalRef = (e) => {
    const n = strip(e);
    if (!ts.isIdentifier(n)) return false;
    if (unbound.has(n)) return GLOBAL_NAMES.includes(n.text);
    const sym = symbolOf(n, checker);
    return sym !== undefined && aliases.has(sym);
  };
  const candidates = [];
  const collect = (n) => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer !== undefined) candidates.push(n);
    ts.forEachChild(n, collect);
  };
  collect(source);
  for (let grew = true; grew; ) {
    grew = false;
    for (const d of candidates) {
      const sym = checker.getSymbolAtLocation(d.name);
      if (sym === undefined || aliases.has(sym)) continue;
      if ((sym.declarations ?? []).length !== 1 || (writes.get(sym) ?? 0) !== 0) continue;
      if (!isGlobalRef(d.initializer)) continue;
      aliases.add(sym);
      grew = true;
    }
  }

  const reads = new Set();
  const written = new Set();
  for (const id of unbound) {
    if (id.text === 'arguments' && hasFunctionAbove(id)) continue;
    reads.add(id.text);
    if (isWritten(id)) written.add(id.text);
  }
  const member = (n) => {
    if ((ts.isPropertyAccessExpression(n) || ts.isElementAccessExpression(n)) && isGlobalRef(n.expression)) {
      const key = staticKey(n);
      if (key !== null && !ARRAY_INDEX.test(key)) {
        reads.add(key);
        if (isWritten(n)) written.add(key);
      }
    }
    // `const {name} = x` and `const {name: local} = x`, x the global: a static read of each named property.
    if (ts.isVariableDeclaration(n) && ts.isObjectBindingPattern(n.name) && n.initializer !== undefined && isGlobalRef(n.initializer)) {
      for (const el of n.name.elements) {
        if (el.dotDotDotToken !== undefined) continue;
        const key = el.propertyName === undefined ? (ts.isIdentifier(el.name) ? el.name.text : null) : ts.isIdentifier(el.propertyName) || ts.isStringLiteral(el.propertyName) ? el.propertyName.text : null;
        if (key !== null && !ARRAY_INDEX.test(key)) reads.add(key);
      }
    }
    ts.forEachChild(n, member);
  };
  member(source);

  const order = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  return {
    reads: [...reads].sort(order),
    writes: [...written].sort(order),
    aliases: [...aliases].map((s) => s.name).sort(order),
  };
}

const memo = new Map();

/**
 * Scan every script of `texts` ({name: text}), each on its own. Resolves the per-script scans and the union of the
 * names read, sorted. A text scanned before in this process is not scanned again (the scan is a function of the text;
 * the last 8 texts are kept, the least recently used dropped first).
 */
export function scanFreeGlobals(texts) {
  const scripts = {};
  const reads = new Set();
  const writes = new Set();
  for (const [name, text] of Object.entries(texts)) {
    let s = memo.get(text);
    if (s === undefined) {
      s = scanScript(name, text);
      if (memo.size >= 8) memo.delete(memo.keys().next().value);
    } else memo.delete(text);
    memo.set(text, s);
    scripts[name] = s;
    for (const r of s.reads) reads.add(r);
    for (const w of s.writes) writes.add(w);
  }
  const order = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  return { scripts, reads: [...reads].sort(order), writes: [...writes].sort(order) };
}

/**
 * The list the bootstrap pins, from a scan: every name read, less the allowlisted written names. Throws naming each
 * written name that is not on `allowlist`, and when the list is longer than MAX_FREE_GLOBALS.
 */
export function freeGlobalList(scan, allowlist) {
  const allowed = new Set(allowlist);
  const problems = [];
  for (const [name, s] of Object.entries(scan.scripts)) {
    for (const w of s.writes) if (!allowed.has(w)) problems.push(`${name} writes the global name ${w}`);
  }
  const names = scan.reads.filter((r) => !allowed.has(r));
  if (names.length > MAX_FREE_GLOBALS) problems.push(`${String(names.length)} free globals, over ${String(MAX_FREE_GLOBALS)}`);
  if (problems.length > 0) throw new Error(`free-globals: ${problems.join('; ')}`);
  return names;
}
