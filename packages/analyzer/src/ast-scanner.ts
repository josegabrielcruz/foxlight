// ============================================================
// @foxlight/analyzer — AST Scanner
//
// Uses the TypeScript compiler API to parse source files and
// extract structural information: imports, exports, JSX usage,
// component definitions, and prop types.
//
// This is the lowest-level analysis layer. Framework-specific
// detectors in ./frameworks/ build on top of this.
// ============================================================

import ts from 'typescript';
import { readFile } from 'node:fs/promises';
import type { ImportEdge, ImportSpecifier } from '@foxlight/core';

/** Raw information extracted from a single source file. */
export interface FileAnalysis {
  filePath: string;
  imports: ImportEdge[];
  exports: ExportInfo[];
  jsxElements: JsxElementInfo[];
  functionDeclarations: FunctionInfo[];
  /** Whether this file contains JSX */
  hasJsx: boolean;
}

export interface ExportInfo {
  name: string;
  kind: 'function' | 'class' | 'variable' | 'type' | 'interface' | 're-export';
  isDefault: boolean;
  line: number;
}

export interface JsxElementInfo {
  /** Tag name (e.g. "Button", "div") */
  tagName: string;
  /** Whether this is a component (PascalCase) or native element */
  isComponent: boolean;
  line: number;
  /** Props passed to this element */
  props: string[];
}

export interface FunctionInfo {
  name: string;
  line: number;
  /** Whether this function returns JSX */
  returnsJsx: boolean;
  /** Parameter names and types */
  parameters: Array<{ name: string; type: string }>;
  isExported: boolean;
  isDefault: boolean;
  isArrowFunction: boolean;
}

/**
 * Parse a TypeScript/JavaScript file and extract structural information.
 */
export async function analyzeFile(filePath: string): Promise<FileAnalysis> {
  const source = await readFile(filePath, 'utf-8');
  return analyzeSource(source, filePath);
}

/**
 * Parse source code and extract structural information.
 * This is the testable core — accepts raw source text.
 */
export function analyzeSource(source: string, filePath: string): FileAnalysis {
  const isJsx = filePath.endsWith('.tsx') || filePath.endsWith('.jsx');
  const scriptKind = isJsx ? ts.ScriptKind.TSX : ts.ScriptKind.TS;

  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true, // setParentNodes
    scriptKind,
  );

  const imports: ImportEdge[] = [];
  const exports: ExportInfo[] = [];
  const jsxElements: JsxElementInfo[] = [];
  const functionDeclarations: FunctionInfo[] = [];
  let hasJsx = false;

  function visit(node: ts.Node): void {
    // Import declarations
    if (ts.isImportDeclaration(node)) {
      const edge = extractImport(node, filePath, sourceFile);
      if (edge) imports.push(edge);
    }

    // Export declarations
    if (ts.isExportDeclaration(node)) {
      const info = extractExportDeclaration(node, sourceFile);
      if (info) exports.push(...info);
    }

    // Function declarations (potential components)
    if (ts.isFunctionDeclaration(node) && node.name) {
      functionDeclarations.push(extractFunction(node, sourceFile));
    }

    // Variable statements with arrow functions (const Button = () => ...)
    if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (
          ts.isIdentifier(decl.name) &&
          decl.initializer &&
          (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer))
        ) {
          const isExported = hasExportModifier(node);
          functionDeclarations.push(
            extractArrowFunction(decl.name, decl.initializer, isExported, sourceFile),
          );
        }
      }

      // Also check for export info
      if (hasExportModifier(node)) {
        for (const decl of node.declarationList.declarations) {
          if (ts.isIdentifier(decl.name)) {
            exports.push({
              name: decl.name.text,
              kind: 'variable',
              isDefault: false,
              line: getLine(decl, sourceFile),
            });
          }
        }
      }
    }

    // Exported function declarations
    if (ts.isFunctionDeclaration(node) && node.name && hasExportModifier(node)) {
      const isDefault = hasDefaultModifier(node);
      exports.push({
        name: node.name.text,
        kind: 'function',
        isDefault,
        line: getLine(node, sourceFile),
      });
    }

    // JSX elements
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      hasJsx = true;
      jsxElements.push(extractJsxElement(node, sourceFile));
    }

    // Default export assignment: export default Component
    if (ts.isExportAssignment(node) && !node.isExportEquals && ts.isIdentifier(node.expression)) {
      exports.push({
        name: node.expression.text,
        kind: 'variable',
        isDefault: true,
        line: getLine(node, sourceFile),
      });
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return {
    filePath,
    imports,
    exports,
    jsxElements,
    functionDeclarations,
    hasJsx,
  };
}

// -----------------------------------------------------------
// Extraction helpers
// -----------------------------------------------------------

function extractImport(
  node: ts.ImportDeclaration,
  filePath: string,
  _sourceFile: ts.SourceFile,
): ImportEdge | null {
  if (!ts.isStringLiteral(node.moduleSpecifier)) return null;

  const target = node.moduleSpecifier.text;
  const specifiers: ImportSpecifier[] = [];
  const typeOnly = node.importClause?.isTypeOnly ?? false;

  const clause = node.importClause;
  if (clause) {
    // Default import
    if (clause.name) {
      specifiers.push({
        imported: 'default',
        local: clause.name.text,
      });
    }

    // Named imports: { Button, Card as MyCard }
    if (clause.namedBindings) {
      if (ts.isNamedImports(clause.namedBindings)) {
        for (const el of clause.namedBindings.elements) {
          specifiers.push({
            imported: el.propertyName?.text ?? el.name.text,
            local: el.name.text,
          });
        }
      }
      // Namespace import: * as Lib
      if (ts.isNamespaceImport(clause.namedBindings)) {
        specifiers.push({
          imported: '*',
          local: clause.namedBindings.name.text,
        });
      }
    }
  }

  return { source: filePath, target, specifiers, typeOnly };
}

function extractExportDeclaration(
  node: ts.ExportDeclaration,
  sourceFile: ts.SourceFile,
): ExportInfo[] | null {
  const results: ExportInfo[] = [];

  if (node.exportClause && ts.isNamedExports(node.exportClause)) {
    for (const el of node.exportClause.elements) {
      results.push({
        name: el.name.text,
        kind: 're-export',
        isDefault: false,
        line: getLine(el, sourceFile),
      });
    }
  }

  return results.length > 0 ? results : null;
}

function extractFunction(node: ts.FunctionDeclaration, sourceFile: ts.SourceFile): FunctionInfo {
  return {
    name: node.name?.text ?? '<anonymous>',
    line: getLine(node, sourceFile),
    returnsJsx: containsJsx(node),
    parameters: extractParameters(node),
    isExported: hasExportModifier(node),
    isDefault: hasDefaultModifier(node),
    isArrowFunction: false,
  };
}

function extractArrowFunction(
  name: ts.Identifier,
  initializer: ts.ArrowFunction | ts.FunctionExpression,
  isExported: boolean,
  sourceFile: ts.SourceFile,
): FunctionInfo {
  return {
    name: name.text,
    line: getLine(name, sourceFile),
    returnsJsx: containsJsx(initializer),
    parameters: extractParameters(initializer),
    isExported,
    isDefault: false,
    isArrowFunction: ts.isArrowFunction(initializer),
  };
}

function extractJsxElement(
  node: ts.JsxOpeningElement | ts.JsxSelfClosingElement,
  sourceFile: ts.SourceFile,
): JsxElementInfo {
  const tagName = node.tagName.getText(sourceFile);
  const isComponent = /^[A-Z]/.test(tagName);

  const props: string[] = [];
  for (const attr of node.attributes.properties) {
    if (ts.isJsxAttribute(attr) && attr.name) {
      props.push(attr.name.getText(sourceFile));
    }
  }

  return {
    tagName,
    isComponent,
    line: getLine(node, sourceFile),
    props,
  };
}

function extractParameters(
  node: ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression,
): Array<{ name: string; type: string }> {
  return node.parameters.map((param) => ({
    name: param.name.getText(),
    type: param.type?.getText() ?? 'unknown',
  }));
}

// -----------------------------------------------------------
// AST utilities
// -----------------------------------------------------------

function containsJsx(node: ts.Node): boolean {
  let found = false;
  function walk(n: ts.Node): void {
    if (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n) || ts.isJsxFragment(n)) {
      found = true;
      return;
    }
    ts.forEachChild(n, walk);
  }
  walk(node);
  return found;
}

function hasExportModifier(node: ts.Node): boolean {
  if (!ts.canHaveModifiers(node)) return false;
  const modifiers = ts.getModifiers(node);
  return modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;
}

function hasDefaultModifier(node: ts.Node): boolean {
  if (!ts.canHaveModifiers(node)) return false;
  const modifiers = ts.getModifiers(node);
  return modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword) ?? false;
}

function getLine(node: ts.Node, sourceFile: ts.SourceFile): number {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}
