// Structural scrub checks for the public enhance entry. They deliberately inspect shapes, not project-specific names.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const ENHANCE = path.join(ROOT, 'src', 'enhance');
const README = readFileSync(path.join(ROOT, 'README.md'), 'utf8');

function sources(): readonly [string, ts.SourceFile][] {
  return readdirSync(ENHANCE)
    .filter((name) => name.endsWith('.ts'))
    .sort()
    .map((name) => {
      const file = path.join(ENHANCE, name);
      return [name, ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS)] as const;
    });
}

const URL_LITERAL = /^[a-z][a-z0-9+.-]*:\/\//i;
const URL_TEMPLATE_PART = /[a-z][a-z0-9+.-]*:\/\//i;
const NAMESPACES = new Set(['http://www.w3.org/1999/xhtml', 'http://www.w3.org/2000/svg']);
const VOCABULARY_ARRAY_FIELDS = new Set([
  'ok', 'wait', 'no', 'info', 'statusHeaders', 'rulingHeaders', 'qualifiers', 'addressees', 'itemFields', 'itemHeadings',
  'task', 'step', 'who', 'question', 'openAnswers', 'blocking', 'risk', 'openStatus', 'prefixes', 'techHeaders',
  'decisionHeaders', 'titleHeaders', 'decisionTableHeaders', 'ruleIdJoins', 'pathExtensions', 'termHeaders',
  'meaningHeaders', 'sections', 'notTerms', 'aliasStops', 'nameJoins', 'mergeForms', 'weekdays', 'months',
  'short', 'stand', 'agreed', 'waiting', 'later', 'kindKeys',
]);

type Binding = { readonly uses: readonly ts.Identifier[] };

function parsedProgram(name: string, text: string): { readonly source: ts.SourceFile; readonly checker: ts.TypeChecker } {
  const file = path.isAbsolute(name) ? name : path.resolve(ENHANCE, name);
  const options: ts.CompilerOptions = { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, lib: ['lib.es2022.d.ts', 'lib.dom.d.ts'], types: [] };
  const host = ts.createCompilerHost(options, true);
  const getSourceFile = host.getSourceFile.bind(host);
  const fileExists = host.fileExists.bind(host);
  const readFile = host.readFile.bind(host);
  host.fileExists = (candidate) => candidate === file || fileExists(candidate);
  host.readFile = (candidate) => candidate === file ? text : readFile(candidate);
  host.getSourceFile = (candidate, language, ...rest) => candidate === file ? ts.createSourceFile(file, text, language, true, ts.ScriptKind.TS) : getSourceFile(candidate, language, ...rest);
  const program = ts.createProgram([file], options, host);
  const source = program.getSourceFile(file);
  if (source === undefined) throw new Error(`scrub: source ${name} is absent`);
  return { source, checker: program.getTypeChecker() };
}

/** True when node is either side of `element.namespaceURI === namespace`. */
function namespaceComparison(node: ts.StringLiteral | ts.NoSubstitutionTemplateLiteral): boolean {
  const parent = node.parent;
  if (!ts.isBinaryExpression(parent) || ![ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken].includes(parent.operatorToken.kind)) return false;
  const other = parent.left === node ? parent.right : parent.left;
  return ts.isPropertyAccessExpression(other) && other.name.text === 'namespaceURI';
}

/** A const namespace literal whose lexical binding is used only as createElementNS's first argument. */
function namespaceBinding(source: ts.SourceFile, checker: ts.TypeChecker, literal: ts.StringLiteral | ts.NoSubstitutionTemplateLiteral): Binding | null {
  const declaration = literal.parent;
  if (!ts.isVariableDeclaration(declaration) || declaration.initializer !== literal || !ts.isIdentifier(declaration.name)) return null;
  const declarations = declaration.parent;
  if (!ts.isVariableDeclarationList(declarations) || (declarations.flags & ts.NodeFlags.Const) === 0) return null;
  const symbol = checker.getSymbolAtLocation(declaration.name);
  if (symbol === undefined) return null;
  const uses: ts.Identifier[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isIdentifier(node) && node !== declaration.name && checker.getSymbolAtLocation(node) === symbol) uses.push(node);
    ts.forEachChild(node, visit);
  };
  visit(source);
  return { uses };
}

function namespaceCreation(checker: ts.TypeChecker, binding: Binding): boolean {
  return binding.uses.length > 0 && binding.uses.every((use) => {
    const call = use.parent;
    if (!ts.isCallExpression(call) || call.arguments[0] !== use || !ts.isPropertyAccessExpression(call.expression) || call.expression.name.text !== 'createElementNS') return false;
    const signature = checker.getResolvedSignature(call);
    const declaration = signature?.declaration;
    return declaration !== undefined && /(?:^|\/)lib\.dom\.d\.ts$/.test(declaration.getSourceFile().fileName);
  });
}

/** A literal URL scheme, including the head or span of an interpolated template. */
function urlText(node: ts.Node): string | null {
  if (ts.isStringLiteralLike(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) return node.text;
  return null;
}

function ordinaryLiteral(node: ts.Node): ts.StringLiteralLike | null {
  return ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) ? node : null;
}

/** Scheme-like strings are forbidden except standard DOM namespaces in a proved DOM namespace use. */
function urlLiteralViolations(name: string, text: string): string[] {
  const { source, checker } = parsedProgram(name, text);
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    const value = urlText(node);
    const literal = ordinaryLiteral(node);
    if (value !== null && (literal === null ? URL_TEMPLATE_PART : URL_LITERAL).test(value)) {
      const namespace = literal !== null && NAMESPACES.has(value);
      const binding = namespace ? namespaceBinding(source, checker, literal) : null;
      if (!(namespace && (namespaceComparison(literal as ts.StringLiteral | ts.NoSubstitutionTemplateLiteral) || (binding !== null && namespaceCreation(checker, binding))))) found.push(`${name}: ${value}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

/** Calls to the ambient performance API, directly or through the root window chain. */
function performanceCall(source: ts.SourceFile, node: ts.CallExpression): string | null {
  if (!ts.isPropertyAccessExpression(node.expression)) return null;
  const receiver = node.expression.expression;
  if (ts.isIdentifier(receiver) && receiver.text === 'performance') return node.expression.getText(source);
  if (!ts.isPropertyAccessExpression(receiver) || receiver.name.text !== 'performance') return null;
  const rootWindow = receiver.expression.getText(source).replace(/!/g, '');
  return rootWindow === 'root.ownerDocument.defaultView' ? node.expression.getText(source) : null;
}

function propertyName(node: ts.ObjectLiteralElementLike): string | null {
  return (ts.isPropertyAssignment(node) || ts.isShorthandPropertyAssignment(node)) && (ts.isIdentifier(node.name) || ts.isStringLiteralLike(node.name)) ? node.name.text : null;
}

/** Vocabulary groups are recognized by their public fields, without inspecting their words. */
function literalWordList(node: ts.Expression): boolean {
  return ts.isArrayLiteralExpression(node) && node.elements.length > 0 && node.elements.every(ts.isStringLiteralLike);
}

function vocabularyObject(node: ts.ObjectLiteralExpression): boolean {
  for (const property of node.properties) {
    const name = propertyName(property);
    if (name === null) continue;
    if (ts.isPropertyAssignment(property) && VOCABULARY_ARRAY_FIELDS.has(name) && literalWordList(property.initializer)) return true;
    if (ts.isPropertyAssignment(property) && ['status', 'attention', 'plan', 'glossary', 'dates', 'boxes', 'callouts'].includes(name) && ts.isObjectLiteralExpression(property.initializer) && vocabularyObject(property.initializer)) return true;
  }
  return false;
}

function vocabularyHolders(name: string, source: ts.SourceFile): string[] {
  const found: string[] = [];
  const visit = (node: ts.Node, parentVocabulary = false): void => {
    const vocabulary = ts.isObjectLiteralExpression(node) && vocabularyObject(node);
    if (vocabulary && !parentVocabulary) found.push(name);
    ts.forEachChild(node, (child) => visit(child, vocabulary || parentVocabulary));
  };
  visit(source);
  return found;
}

describe('enhance scrub', () => {
  it('permits standard namespaces only through DOM construction or strict namespaceURI comparison', () => {
    const svg = 'http://www.w3.org/2000/svg';
    const xhtml = 'http://www.w3.org/1999/xhtml';
    expect(urlLiteralViolations('ok.ts', [
      `const svg = '${svg}'; document.createElementNS(svg, 'rect');`,
      `el.namespaceURI === '${xhtml}';`,
      `'${svg}' !== el.namespaceURI;`,
    ].join('\n'))).toEqual([]);
    expect(urlLiteralViolations('lookalike.ts', [
      'declare const callback: unknown;',
      'const sink = { createElementNS: callback };',
      `const svg = '${svg}'; sink.createElementNS(svg, 'rect');`,
    ].join('\n'))).toEqual([`lookalike.ts: ${svg}`]);
    expect(urlLiteralViolations('alert.ts', `const svg = '${svg}'; window.alert(svg);`)).toEqual([`alert.ts: ${svg}`]);
  });

  it('uses lexical bindings for the namespace creation exception', () => {
    const svg = 'http://www.w3.org/2000/svg';
    expect(urlLiteralViolations('lexical.ts', `const svg = '${svg}'; document.createElementNS(svg, 'rect');`)).toEqual([]);
    expect(urlLiteralViolations('shadowed.ts', [
      `const svg = '${svg}';`,
      'function draw(svg: string): void { document.createElementNS(svg, "rect"); }',
    ].join('\n'))).toEqual([`shadowed.ts: ${svg}`]);
  });

  it('rejects literal schemes in interpolated templates and ordinary URL sinks', () => {
    expect(urlLiteralViolations('template.ts', 'const asset = `https://example.test/${name}`;')).toEqual(['template.ts: https://example.test/']);
    expect(urlLiteralViolations('attr.ts', "root.setAttribute('href', 'https://example.test/asset');")).toEqual(['attr.ts: https://example.test/asset']);
  });

  it('recognizes direct and root-window performance marks', () => {
    const direct = ts.createSourceFile('direct.ts', "performance.mark('reader');", ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
    const rootWindow = ts.createSourceFile('root.ts', "root.ownerDocument.defaultView!.performance.mark('reader');", ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
    const calls = (source: ts.SourceFile): string[] => {
      const found: string[] = [];
      const visit = (node: ts.Node): void => {
        if (ts.isCallExpression(node)) {
          const call = performanceCall(source, node);
          if (call !== null) found.push(call);
        }
        ts.forEachChild(node, visit);
      };
      visit(source);
      return found;
    };
    expect(calls(direct)).toEqual(['performance.mark']);
    expect(calls(rootWindow)).toEqual(['root.ownerDocument.defaultView!.performance.mark']);
  });

  it('finds each nonempty contract-shaped word-list family outside vocab.ts', () => {
    for (const [name, text] of [
      ['header.ts', "const headers = { statusHeaders: ['status'] };"],
      ['status.ts', "const roles = { status: { ok: ['done'] } };"],
      ['callout.ts', "const boxes = { callouts: { agreed: ['agreed'] } };"],
    ] as const) {
      const source = ts.createSourceFile(name, text, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
      expect(vocabularyHolders(name, source)).toEqual([name]);
    }
  });

  it('does not treat an empty event payload as a vocabulary word list', () => {
    const source = ts.createSourceFile('event.ts', 'events.emit(\'changes\', { sections: [] });', ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
    expect(vocabularyHolders('event.ts', source)).toEqual([]);
  });

  it('recognizes the shipped nonempty vocabulary object', () => {
    const source = sources().find(([name]) => name === 'vocab.ts')?.[1];
    expect(source === undefined ? [] : vocabularyHolders('vocab.ts', source)).toEqual(['vocab.ts']);
  });

  it('keeps the library source free of URL literals and performance calls', () => {
    const urlLiterals: string[] = [];
    const performanceCalls: string[] = [];
    for (const [name, source] of sources()) {
      urlLiterals.push(...urlLiteralViolations(name, source.getFullText()));
      const visit = (node: ts.Node): void => {
        if (ts.isCallExpression(node)) {
          const call = performanceCall(source, node);
          if (call !== null) performanceCalls.push(`${name}: ${call}`);
        }
        ts.forEachChild(node, visit);
      };
      visit(source);
    }
    expect(urlLiterals).toEqual([]);
    expect(performanceCalls).toEqual([]);
  });

  it('derives every storage shape from the normalized namespace', () => {
    const state = readFileSync(path.join(ENHANCE, 'state.ts'), 'utf8');
    expect(state).toContain('`${ns}:prefs`');
    expect(state).toContain('`${ns}:ui`');
    expect(state).toContain('`${ns}:doc:${storageKey}:${name}`');
    expect(state).toContain('`${ns}:pos:${posKey}`');
    expect(state).not.toMatch(/(?:localStorage|sessionStorage|indexedDB)\s*[.[]/);
  });

  it('keeps all contract-shaped reader word lists in vocab.ts', () => {
    const holders = sources().flatMap(([name, source]) => vocabularyHolders(name, source));
    expect(holders).toEqual(['vocab.ts']);
  });

  it('does not present an obsolete pre-v1 release note as current status', () => {
    expect(README).not.toContain('pre-release and private until v1');
    expect(README).not.toContain('nothing to act on yet');
    expect(README).not.toContain('Reserved for the reader\'s interface memory');
    expect(README).not.toContain('drawing it is a later version\'s feature');
  });
});
