// ============================================================
// @foxlight/analyzer — Component Detector
//
// Takes raw AST analysis (from ast-scanner) and determines
// which functions/exports are actually UI components vs.
// plain utility functions. Framework-aware.
// ============================================================

import type { ComponentInfo, Framework, ExportKind, PropInfo } from '@foxlight/core';
import type { FileAnalysis, FunctionInfo } from './ast-scanner.js';

/**
 * Detect components from a file analysis result.
 * Uses heuristics appropriate for the given framework.
 */
export function detectComponents(analysis: FileAnalysis, framework: Framework): ComponentInfo[] {
  const components: ComponentInfo[] = [];

  for (const fn of analysis.functionDeclarations) {
    if (isLikelyComponent(fn, analysis, framework)) {
      components.push(toComponentInfo(fn, analysis, framework));
    }
  }

  return components;
}

/**
 * Heuristic: is this function likely a UI component?
 */
function isLikelyComponent(
  fn: FunctionInfo,
  _analysis: FileAnalysis,
  framework: Framework,
): boolean {
  // Must be PascalCase (convention for React/Vue/Svelte components)
  if (!/^[A-Z]/.test(fn.name)) return false;

  // Framework-specific checks
  switch (framework) {
    case 'react':
      // React components return JSX
      return fn.returnsJsx;

    case 'vue':
      // Vue SFCs are handled separately; in .ts files, look for defineComponent
      return fn.returnsJsx;

    case 'svelte':
      // Svelte components are .svelte files; .ts helpers aren't components
      return fn.returnsJsx;

    default:
      // For unknown frameworks, check if it returns JSX and is exported
      return fn.returnsJsx && fn.isExported;
  }
}

/**
 * Convert a detected function into a ComponentInfo.
 */
function toComponentInfo(
  fn: FunctionInfo,
  analysis: FileAnalysis,
  framework: Framework,
): ComponentInfo {
  const id = `${analysis.filePath}#${fn.name}`;

  // Determine export kind
  let exportKind: ExportKind = 'named';
  const exp = analysis.exports.find((e) => e.name === fn.name);
  if (exp?.isDefault) {
    exportKind = 'default';
  } else if (exp?.kind === 're-export') {
    exportKind = 're-export';
  }

  // Extract props from first parameter
  const props = extractProps(fn);

  // Find child components (JSX elements that are PascalCase)
  const children = analysis.jsxElements.filter((el) => el.isComponent).map((el) => el.tagName);

  // Find npm package dependencies
  const dependencies = analysis.imports
    .filter((imp) => !imp.target.startsWith('.') && !imp.target.startsWith('/'))
    .map((imp) => imp.target);

  return {
    id,
    name: fn.name,
    filePath: analysis.filePath,
    line: fn.line,
    framework,
    exportKind,
    props,
    children: [...new Set(children)],
    usedBy: [], // Populated later by cross-file analysis
    dependencies: [...new Set(dependencies)],
    metadata: {},
  };
}

/**
 * Extract prop information from a function's parameters.
 * Handles common patterns like `function Button(props: ButtonProps)` and
 * `function Button({ label, variant = 'primary' }: ButtonProps)`.
 */
function extractProps(fn: FunctionInfo): PropInfo[] {
  // For now, extract parameter names and types.
  // Full prop extraction requires type-checking (Phase 2).
  if (fn.parameters.length === 0) return [];

  const firstParam = fn.parameters[0];
  if (!firstParam) return [];

  // If the parameter is named "props" or has a type ending in "Props",
  // we know this is a component with props but can't extract details
  // without the type checker. Return a placeholder.
  return [
    {
      name: firstParam.name,
      type: firstParam.type,
      required: true,
      description: 'Auto-detected parameter — full prop extraction requires type analysis',
    },
  ];
}

/**
 * After all files are analyzed, cross-reference to populate `usedBy` fields.
 * This connects the "children" references (forward) to "usedBy" references (backward).
 */
export function crossReferenceComponents(components: ComponentInfo[]): ComponentInfo[] {
  const byName = new Map<string, ComponentInfo>();
  for (const comp of components) {
    byName.set(comp.name, comp);
  }

  // For each component, find who references it
  for (const comp of components) {
    for (const childName of comp.children) {
      const child = byName.get(childName);
      if (child && !child.usedBy.includes(comp.id)) {
        child.usedBy.push(comp.id);
      }
    }
  }

  // Resolve children from names to IDs
  for (const comp of components) {
    comp.children = comp.children.map((name) => byName.get(name)?.id ?? name).filter(Boolean);
  }

  return components;
}
