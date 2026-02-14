// ============================================================
// @foxlight/analyzer — Project Analyzer
//
// High-level orchestrator that scans a project directory,
// analyzes all source files, detects components, and builds
// the component registry and dependency graph.
// ============================================================

import { readdir } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import ts from 'typescript';
import {
  ComponentRegistry,
  DependencyGraph,
  loadConfig,
  type FoxlightConfig,
  type Framework,
} from '@foxlight/core';
import { analyzeFile, analyzeSource } from './ast-scanner.js';
import { detectComponents, crossReferenceComponents } from './component-detector.js';
import { extractAllPropsFromFile } from './prop-extractor.js';
import { parseVueSFC, vueSFCToComponentInfo } from './frameworks/vue-parser.js';
import { parseSvelteFile, svelteFileToComponentInfo } from './frameworks/svelte-parser.js';

/** Result of a full project analysis. */
export interface ProjectAnalysis {
  config: FoxlightConfig;
  registry: ComponentRegistry;
  graph: DependencyGraph;
  stats: AnalysisStats;
}

export interface AnalysisStats {
  filesScanned: number;
  componentsFound: number;
  importsTracked: number;
  duration: number;
}

/**
 * Analyze an entire project directory.
 * This is the main entry point for the analyzer.
 */
export async function analyzeProject(
  rootDir: string,
  configOverrides?: Partial<FoxlightConfig>,
): Promise<ProjectAnalysis> {
  const startTime = performance.now();

  // Load configuration
  const config = {
    ...(await loadConfig(rootDir)),
    ...configOverrides,
  };

  const framework: Framework = config.framework ?? 'unknown';

  // Find all matching source files
  const files = await findSourceFiles(config);

  // Analyze each file
  const registry = new ComponentRegistry();
  const allImports = [];
  let totalComponents = 0;

  for (const filePath of files) {
    try {
      // Vue SFC files — use dedicated parser
      if (filePath.endsWith('.vue')) {
        const source = await import('node:fs/promises').then((fs) =>
          fs.readFile(filePath, 'utf-8'),
        );
        const vueAnalysis = parseVueSFC(source, filePath);
        const component = vueSFCToComponentInfo(vueAnalysis, filePath);

        registry.addComponents([component]);
        totalComponents += 1;

        // Also analyze the script block through the standard AST scanner
        // so we capture imports and nested component usage
        if (vueAnalysis.scriptContent) {
          const scriptAnalysis = analyzeSource(vueAnalysis.scriptContent, filePath);
          registry.addImports(scriptAnalysis.imports);
          allImports.push(...scriptAnalysis.imports);
        }
        if (vueAnalysis.imports.length > 0) {
          registry.addImports(vueAnalysis.imports);
          allImports.push(...vueAnalysis.imports);
        }
        continue;
      }

      // Svelte files — use dedicated parser
      if (filePath.endsWith('.svelte')) {
        const source = await import('node:fs/promises').then((fs) =>
          fs.readFile(filePath, 'utf-8'),
        );
        const svelteAnalysis = parseSvelteFile(source, filePath);
        const component = svelteFileToComponentInfo(svelteAnalysis, filePath);

        registry.addComponents([component]);
        totalComponents += 1;

        // Also analyze script blocks through the standard AST scanner
        const scriptContent = [svelteAnalysis.moduleScriptContent, svelteAnalysis.scriptContent]
          .filter(Boolean)
          .join('\n');

        if (scriptContent) {
          const scriptAnalysis = analyzeSource(scriptContent, filePath);
          registry.addImports(scriptAnalysis.imports);
          allImports.push(...scriptAnalysis.imports);
        }
        if (svelteAnalysis.imports.length > 0) {
          registry.addImports(svelteAnalysis.imports);
          allImports.push(...svelteAnalysis.imports);
        }
        continue;
      }

      // Standard TS/JS/JSX/TSX files
      const analysis = await analyzeFile(filePath);

      // Track imports
      registry.addImports(analysis.imports);
      allImports.push(...analysis.imports);

      // Detect and register components
      const components = detectComponents(analysis, framework);
      if (components.length > 0) {
        registry.addComponents(components);
        totalComponents += components.length;
      }
    } catch (error) {
      // Log but don't fail — some files may have parse errors
      console.warn(`[foxlight] Warning: Failed to analyze ${filePath}:`, error);
    }
  }

  // Cross-reference components (populate usedBy)
  const allComponents = registry.getAllComponents();
  const crossReferenced = crossReferenceComponents(allComponents);

  // Rebuild registry with cross-referenced data
  registry.clear();
  registry.addComponents(crossReferenced);
  registry.addImports(allImports);

  // Phase 2: Enhanced prop extraction via TypeScript type checker
  try {
    const program = ts.createProgram(files, {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.Node16,
      moduleResolution: ts.ModuleResolutionKind.Node16,
      jsx: ts.JsxEmit.ReactJSX,
      strict: true,
      noEmit: true,
      skipLibCheck: true,
    });
    const checker = program.getTypeChecker();

    for (const filePath of files) {
      const sourceFile = program.getSourceFile(filePath);
      if (!sourceFile) continue;

      const fileProps = extractAllPropsFromFile(checker, sourceFile);
      for (const [componentName, props] of fileProps) {
        // Find the component in the registry and update its props
        const comp = registry
          .getAllComponents()
          .find((c) => c.name === componentName && c.filePath === filePath);
        if (comp && props.length > 0) {
          comp.props = props;
        }
      }
    }
  } catch {
    // Type-checker prop extraction is best-effort.
    // Falls back to the basic extraction from component-detector.
  }

  // Build dependency graph
  const graph = DependencyGraph.fromImports(allImports);

  const duration = performance.now() - startTime;

  return {
    config,
    registry,
    graph,
    stats: {
      filesScanned: files.length,
      componentsFound: totalComponents,
      importsTracked: allImports.length,
      duration,
    },
  };
}

/**
 * Find all source files matching the config's include/exclude patterns.
 * Uses glob-style matching with support for *, **, and {ext1,ext2} patterns.
 */
async function findSourceFiles(config: FoxlightConfig): Promise<string[]> {
  const rootDir = resolve(config.rootDir);

  // Collect all files recursively
  const allFiles = await walkDir(rootDir);

  // Build matchers from include/exclude patterns
  const includeMatchers = config.include.map((p) => createGlobMatcher(p));
  const excludeMatchers = config.exclude.map((p) => createGlobMatcher(p));

  return allFiles.filter((filePath) => {
    const rel = relative(rootDir, filePath);

    // Must match at least one include pattern
    const included = includeMatchers.some((matcher) => matcher(rel));
    if (!included) return false;

    // Must not match any exclude pattern
    const excluded = excludeMatchers.some((matcher) => matcher(rel));
    return !excluded;
  });
}

/**
 * Convert a glob pattern to a matcher function.
 * Supports: *, **, ?, {a,b,c}, and character classes.
 */
function createGlobMatcher(pattern: string): (path: string) => boolean {
  const regexStr = globToRegex(pattern);
  const regex = new RegExp(`^${regexStr}$`, 'i');
  return (path: string) => regex.test(path);
}

/**
 * Convert a glob pattern string to a regex string.
 */
function globToRegex(pattern: string): string {
  let result = '';
  let i = 0;

  while (i < pattern.length) {
    const char = pattern[i]!;

    if (char === '*') {
      if (pattern[i + 1] === '*') {
        // ** matches any number of directories
        if (pattern[i + 2] === '/') {
          result += '(?:.+/)?';
          i += 3;
        } else {
          result += '.*';
          i += 2;
        }
      } else {
        // * matches anything except /
        result += '[^/]*';
        i++;
      }
    } else if (char === '?') {
      result += '[^/]';
      i++;
    } else if (char === '{') {
      // {a,b,c} — brace expansion
      const closeIdx = pattern.indexOf('}', i);
      if (closeIdx === -1) {
        result += '\\{';
        i++;
      } else {
        const alternatives = pattern.slice(i + 1, closeIdx).split(',');
        result += `(?:${alternatives.map(escapeRegex).join('|')})`;
        i = closeIdx + 1;
      }
    } else if (char === '.') {
      result += '\\.';
      i++;
    } else {
      result += escapeRegexChar(char);
      i++;
    }
  }

  return result;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeRegexChar(char: string): string {
  return /[.*+?^${}()|[\]\\]/.test(char) ? `\\${char}` : char;
}

async function walkDir(dir: string): Promise<string[]> {
  const results: string[] = [];
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = resolve(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.git') continue;
        results.push(...(await walkDir(fullPath)));
      } else {
        results.push(fullPath);
      }
    }
  } catch {
    // Directory not readable — skip
  }
  return results;
}
