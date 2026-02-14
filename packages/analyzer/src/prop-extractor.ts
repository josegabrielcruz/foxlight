// ============================================================
// @foxlight/analyzer — Prop Extractor
//
// Uses the TypeScript type checker to extract detailed prop
// information from component parameters. Handles:
//
// - function Button(props: ButtonProps) { ... }
// - function Button({ label, variant = 'primary' }: ButtonProps) { ... }
// - const Button: React.FC<ButtonProps> = (props) => { ... }
//
// Resolves type aliases and interfaces to enumerate all props.
// ============================================================

import ts from 'typescript';
import type { PropInfo } from '@foxlight/core';

/**
 * Create a TypeScript program for type-checking source files.
 * Returns a checker that can resolve types across the project.
 */
export function createTypeChecker(
  filePaths: string[],
  compilerOptions?: ts.CompilerOptions,
): ts.TypeChecker | null {
  const options: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.Node16,
    moduleResolution: ts.ModuleResolutionKind.Node16,
    jsx: ts.JsxEmit.ReactJSX,
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    ...compilerOptions,
  };

  const program = ts.createProgram(filePaths, options);
  return program.getTypeChecker();
}

/**
 * Extract detailed prop information from a function's first parameter
 * using the TypeScript type checker.
 */
export function extractPropsFromType(
  checker: ts.TypeChecker,
  node: ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression,
): PropInfo[] {
  const firstParam = node.parameters[0];
  if (!firstParam) return [];

  const paramType = checker.getTypeAtLocation(firstParam);

  // If the parameter is destructured, get the type of the destructuring pattern
  // If it's a simple parameter like `props: ButtonProps`, get the type annotation
  return extractPropsFromTsType(checker, paramType);
}

/**
 * Extract prop information from a resolved TypeScript type.
 * Handles interfaces, type aliases, intersections, and mapped types.
 */
export function extractPropsFromTsType(checker: ts.TypeChecker, type: ts.Type): PropInfo[] {
  const props: PropInfo[] = [];

  // Get all properties of the type
  const properties = type.getProperties();

  for (const prop of properties) {
    // Skip internal/inherited properties (React internals, etc.)
    if (isInternalProp(prop.name)) continue;

    const propType = checker.getTypeOfSymbol(prop);
    const typeString = checker.typeToString(propType, undefined, ts.TypeFormatFlags.NoTruncation);

    // Determine if the prop is required
    const isOptional = (prop.flags & ts.SymbolFlags.Optional) !== 0;

    // Extract default value from declarations (if destructured)
    const defaultValue = getDefaultValue(prop);

    // Extract JSDoc description
    const description = getJSDocDescription(prop);

    props.push({
      name: prop.name,
      type: typeString,
      required: !isOptional && defaultValue === undefined,
      defaultValue,
      description,
    });
  }

  return props;
}

/**
 * Extract props from a source file by finding component functions
 * and resolving their parameter types.
 */
export function extractAllPropsFromFile(
  checker: ts.TypeChecker,
  sourceFile: ts.SourceFile,
): Map<string, PropInfo[]> {
  const result = new Map<string, PropInfo[]>();

  function visit(node: ts.Node): void {
    // Function declarations: function Button(props: ButtonProps) { ... }
    if (ts.isFunctionDeclaration(node) && node.name) {
      const name = node.name.text;
      if (/^[A-Z]/.test(name) && node.parameters.length > 0) {
        const props = extractPropsFromType(checker, node);
        if (props.length > 0) {
          result.set(name, props);
        }
      }
    }

    // Variable declarations with arrow functions: const Button = (props: ButtonProps) => { ... }
    if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (
          ts.isIdentifier(decl.name) &&
          /^[A-Z]/.test(decl.name.text) &&
          decl.initializer &&
          (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer))
        ) {
          const fn = decl.initializer;
          if (fn.parameters.length > 0) {
            const props = extractPropsFromType(checker, fn);
            if (props.length > 0) {
              result.set(decl.name.text, props);
            }
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return result;
}

// -----------------------------------------------------------
// Internal helpers
// -----------------------------------------------------------

/** Check if a prop name is an internal/React-specific prop to skip. */
function isInternalProp(name: string): boolean {
  const internals = new Set([
    'key',
    'ref',
    'children', // Often included but worth keeping — make configurable later
  ]);
  return internals.has(name);
}

/** Try to extract a default value from a destructured parameter. */
function getDefaultValue(symbol: ts.Symbol): string | undefined {
  const declarations = symbol.getDeclarations();
  if (!declarations || declarations.length === 0) return undefined;

  for (const decl of declarations) {
    // Check binding elements: { variant = 'primary' }
    if (ts.isBindingElement(decl) && decl.initializer) {
      return decl.initializer.getText();
    }
  }

  return undefined;
}

/** Extract JSDoc description from a symbol. */
function getJSDocDescription(symbol: ts.Symbol): string | undefined {
  const docs = symbol.getDocumentationComment(undefined);
  if (docs.length === 0) return undefined;
  return docs.map((d) => d.text).join('\n');
}
