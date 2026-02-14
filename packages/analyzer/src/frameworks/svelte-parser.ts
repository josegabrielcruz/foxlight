// ============================================================
// @foxlight/analyzer — Svelte File Parser
//
// Extracts component information from Svelte component files
// (.svelte). Parses <script>, template markup, and <style>
// blocks to identify component structure.
//
// Uses lightweight regex-based parsing to avoid requiring the
// full Svelte compiler as a hard dependency.
// ============================================================

import type {
  ComponentInfo,
  Framework,
  PropInfo,
  ImportEdge,
  ImportSpecifier,
} from '@foxlight/core';

/** Extracted information from a .svelte file. */
export interface SvelteFileAnalysis {
  /** Component name (from filename) */
  name: string;
  /** Script content (instance script, if present) */
  scriptContent: string | null;
  /** Module-level script content (context="module", if present) */
  moduleScriptContent: string | null;
  /** Template markup (everything outside script/style blocks) */
  templateContent: string;
  /** Whether the file has scoped styles */
  hasStyles: boolean;
  /** Imports extracted from script blocks */
  imports: ImportEdge[];
  /** Props extracted from `export let` declarations */
  props: PropInfo[];
  /** Child components referenced in the template */
  childComponents: string[];
}

/**
 * Parse a Svelte file and extract component information.
 */
export function parseSvelteFile(source: string, filePath: string): SvelteFileAnalysis {
  const name = extractComponentName(filePath);
  const scriptContent = extractInstanceScript(source);
  const moduleScriptContent = extractModuleScript(source);
  const templateContent = extractTemplateContent(source);
  const hasStyles = /<style[\s>]/.test(source);

  const allScriptContent = [moduleScriptContent, scriptContent].filter(Boolean).join('\n');

  const imports = allScriptContent ? extractImportsFromScript(allScriptContent, filePath) : [];
  const props = scriptContent ? extractExportLetProps(scriptContent) : [];
  const childComponents = extractChildComponentsFromTemplate(templateContent);

  return {
    name,
    scriptContent,
    moduleScriptContent,
    templateContent,
    hasStyles,
    imports,
    props,
    childComponents,
  };
}

/**
 * Convert a Svelte file analysis result to a ComponentInfo.
 */
export function svelteFileToComponentInfo(
  analysis: SvelteFileAnalysis,
  filePath: string,
): ComponentInfo {
  return {
    id: `${filePath}#${analysis.name}`,
    name: analysis.name,
    filePath,
    line: 1,
    framework: 'svelte' as Framework,
    exportKind: 'default',
    props: analysis.props,
    children: analysis.childComponents,
    usedBy: [],
    dependencies: analysis.imports
      .filter((imp) => !imp.target.startsWith('.') && !imp.target.startsWith('/'))
      .map((imp) => imp.target),
    metadata: {
      hasModuleScript: analysis.moduleScriptContent !== null,
      hasStyles: analysis.hasStyles,
    },
  };
}

// -----------------------------------------------------------
// Internal parsers
// -----------------------------------------------------------

function extractComponentName(filePath: string): string {
  const fileName = filePath.split('/').pop() ?? 'Unknown';
  const baseName = fileName.replace(/\.svelte$/, '');
  // PascalCase the name
  return baseName
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

/**
 * Extract the instance script block (no context="module").
 */
function extractInstanceScript(source: string): string | null {
  // Match <script> that does NOT have context="module"
  const regex = /<script(?![^>]*context\s*=\s*["']module["'])[^>]*>([\s\S]*?)<\/script>/i;
  const match = source.match(regex);
  return match?.[1]?.trim() ?? null;
}

/**
 * Extract the module-level script block.
 */
function extractModuleScript(source: string): string | null {
  const regex = /<script[^>]*context\s*=\s*["']module["'][^>]*>([\s\S]*?)<\/script>/i;
  const match = source.match(regex);
  return match?.[1]?.trim() ?? null;
}

/**
 * Extract template content by removing script and style blocks.
 */
function extractTemplateContent(source: string): string {
  return source
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .trim();
}

function extractImportsFromScript(script: string, filePath: string): ImportEdge[] {
  const imports: ImportEdge[] = [];
  const importRegex =
    /import\s+(?:(?:type\s+)?(?:(\{[^}]+\})|(\w+)(?:\s*,\s*(\{[^}]+\}))?|(\*\s+as\s+\w+)))\s+from\s+['"]([^'"]+)['"]/g;

  let match;
  while ((match = importRegex.exec(script)) !== null) {
    const target = match[5]!;
    const specifiers: ImportSpecifier[] = [];

    // Default import
    if (match[2]) {
      specifiers.push({ imported: 'default', local: match[2] });
    }

    // Named imports { a, b }
    const namedBlock = match[1] ?? match[3];
    if (namedBlock) {
      const names = namedBlock
        .replace(/[{}]/g, '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      for (const name of names) {
        const parts = name.split(/\s+as\s+/);
        specifiers.push({
          imported: parts[0]!.replace(/^type\s+/, '').trim(),
          local: (parts[1] ?? parts[0]!).trim(),
        });
      }
    }

    // Namespace import
    if (match[4]) {
      const nsName = match[4].replace('* as ', '').trim();
      specifiers.push({ imported: '*', local: nsName });
    }

    imports.push({
      source: filePath,
      target,
      specifiers,
      typeOnly: /import\s+type\s/.test(match[0]!),
    });
  }

  return imports;
}

/**
 * Extract props from `export let propName` syntax (Svelte 4 style).
 * Also handles `export let propName: type = default`.
 */
function extractExportLetProps(script: string): PropInfo[] {
  const props: PropInfo[] = [];
  // Match: export let name, export let name: Type, export let name: Type = value, export let name = value
  const exportLetRegex =
    /export\s+let\s+(\w+)\s*(?::\s*([^=;\n]+?))?\s*(?:=\s*([^;\n]+?))?\s*[;\n]/g;

  let match;
  while ((match = exportLetRegex.exec(script)) !== null) {
    const name = match[1]!;
    const typeAnnotation = match[2]?.trim();
    const defaultValue = match[3]?.trim();

    // If there's a default value, the prop is not required
    const required = defaultValue === undefined;

    let type = typeAnnotation ?? 'unknown';
    if (type === 'unknown' && defaultValue !== undefined) {
      type = inferTypeFromDefault(defaultValue);
    }

    props.push({
      name,
      type,
      required,
      defaultValue,
    });
  }

  return props;
}

function inferTypeFromDefault(value: string): string {
  if (value === 'true' || value === 'false') return 'boolean';
  if (/^['"]/.test(value)) return 'string';
  if (/^-?\d+(\.\d+)?$/.test(value)) return 'number';
  if (value.startsWith('[')) return 'array';
  if (value.startsWith('{')) return 'object';
  if (value === 'null') return 'null';
  if (value === 'undefined') return 'undefined';
  return 'unknown';
}

function extractChildComponentsFromTemplate(template: string): string[] {
  const components = new Set<string>();

  // Match PascalCase tags: <MyComponent ... > or <MyComponent />
  const pascalRegex = /<([A-Z][a-zA-Z0-9]+)/g;
  let match;
  while ((match = pascalRegex.exec(template)) !== null) {
    components.add(match[1]!);
  }

  return Array.from(components);
}
