// ============================================================
// @foxlight/analyzer — Vue SFC Parser
//
// Extracts component information from Vue Single File Components
// (.vue files). Parses the <script>, <template>, and <style>
// blocks to identify component structure.
//
// Uses a lightweight regex-based parser to avoid requiring
// @vue/compiler-sfc as a hard dependency.
// ============================================================

import type { ComponentInfo, Framework, ImportEdge, PropInfo } from '@foxlight/core';
import { extractImportsFromScript } from '@foxlight/core';

/** Extracted information from a .vue file. */
export interface VueSFCAnalysis {
  /** Component name (from filename or defineComponent name) */
  name: string;
  /** Script content (if present) */
  scriptContent: string | null;
  /** Whether the script uses <script setup> */
  isScriptSetup: boolean;
  /** Template content (if present) */
  templateContent: string | null;
  /** Whether the file has scoped styles */
  hasScopedStyles: boolean;
  /** Imports extracted from script block */
  imports: ImportEdge[];
  /** Props extracted from defineProps / props option */
  props: PropInfo[];
  /** Child components referenced in the template */
  childComponents: string[];
}

/**
 * Parse a Vue SFC file and extract component information.
 */
export function parseVueSFC(source: string, filePath: string): VueSFCAnalysis {
  const name = extractComponentName(filePath);
  const scriptContent = extractBlock(source, 'script');
  const isScriptSetup = /<script[^>]*\bsetup\b/.test(source);
  const templateContent = extractBlock(source, 'template');
  const hasScopedStyles = /<style[^>]*\bscoped\b/.test(source);

  const imports = scriptContent ? extractImportsFromScript(scriptContent, filePath) : [];
  const props = scriptContent ? extractPropsFromScript(scriptContent, isScriptSetup) : [];
  const childComponents = templateContent
    ? extractChildComponentsFromTemplate(templateContent)
    : [];

  return {
    name,
    scriptContent,
    isScriptSetup,
    templateContent,
    hasScopedStyles,
    imports,
    props,
    childComponents,
  };
}

/**
 * Convert a Vue SFC analysis result to a ComponentInfo.
 */
export function vueSFCToComponentInfo(analysis: VueSFCAnalysis, filePath: string): ComponentInfo {
  return {
    id: `${filePath}#${analysis.name}`,
    name: analysis.name,
    filePath,
    line: 1,
    framework: 'vue' as Framework,
    exportKind: 'default',
    props: analysis.props,
    children: analysis.childComponents,
    usedBy: [],
    dependencies: analysis.imports
      .filter((imp) => !imp.target.startsWith('.') && !imp.target.startsWith('/'))
      .map((imp) => imp.target),
    metadata: {
      isScriptSetup: analysis.isScriptSetup,
      hasScopedStyles: analysis.hasScopedStyles,
    },
  };
}

// -----------------------------------------------------------
// Internal parsers
// -----------------------------------------------------------

function extractBlock(source: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
  const match = source.match(regex);
  return match?.[1]?.trim() ?? null;
}

function extractComponentName(filePath: string): string {
  const fileName = filePath.split('/').pop() ?? 'Unknown';
  const baseName = fileName.replace(/\.vue$/, '');
  // PascalCase the name
  return baseName
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

function extractPropsFromScript(script: string, isScriptSetup: boolean): PropInfo[] {
  if (isScriptSetup) {
    return extractDefineProps(script);
  }
  return extractOptionsAPIProps(script);
}

/**
 * Extract props from defineProps<T>() or defineProps({ ... }) in <script setup>.
 */
function extractDefineProps(script: string): PropInfo[] {
  // Match defineProps({ key: Type, ... })
  const objectMatch = script.match(/defineProps\(\s*\{([^}]+)\}\s*\)/);
  if (objectMatch?.[1]) {
    return parseObjectProps(objectMatch[1]);
  }

  // Match defineProps<{ key: type }>() — extract from generic type
  const genericMatch = script.match(/defineProps<\s*\{([^}]+)\}\s*>\(\)/);
  if (genericMatch?.[1]) {
    return parseTypeProps(genericMatch[1]);
  }

  return [];
}

/**
 * Extract props from Options API: props: { ... }
 */
function extractOptionsAPIProps(script: string): PropInfo[] {
  const propsMatch = script.match(/props\s*:\s*\{([^}]+)\}/);
  if (!propsMatch?.[1]) return [];
  return parseObjectProps(propsMatch[1]);
}

function parseObjectProps(content: string): PropInfo[] {
  const props: PropInfo[] = [];
  const entries = content
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  for (const entry of entries) {
    const colonIdx = entry.indexOf(':');
    if (colonIdx === -1) {
      props.push({
        name: entry.trim(),
        type: 'unknown',
        required: false,
      });
    } else {
      const name = entry.slice(0, colonIdx).trim();
      const typeStr = entry.slice(colonIdx + 1).trim();
      props.push({
        name,
        type: typeStr,
        required: typeStr.includes('required') || !typeStr.includes('?'),
      });
    }
  }

  return props;
}

function parseTypeProps(content: string): PropInfo[] {
  const props: PropInfo[] = [];
  // Split by ; or newline
  const entries = content
    .split(/[;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);

  for (const entry of entries) {
    const match = entry.match(/(\w+)(\?)?:\s*(.+)/);
    if (match) {
      props.push({
        name: match[1]!,
        type: match[3]!.trim().replace(/;$/, ''),
        required: !match[2],
      });
    }
  }

  return props;
}

function extractChildComponentsFromTemplate(template: string): string[] {
  const components = new Set<string>();

  // Match PascalCase tags: <MyComponent ... > or <MyComponent />
  const pascalRegex = /<([A-Z][a-zA-Z0-9]+)/g;
  let match;
  while ((match = pascalRegex.exec(template)) !== null) {
    components.add(match[1]!);
  }

  // Match kebab-case component tags: <my-component>
  // Convert to PascalCase
  const kebabRegex = /<([a-z]+-[a-z-]+)/g;
  while ((match = kebabRegex.exec(template)) !== null) {
    const pascal = match[1]!
      .split('-')
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join('');
    components.add(pascal);
  }

  return Array.from(components);
}
