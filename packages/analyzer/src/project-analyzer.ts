// ============================================================
// @pulse/analyzer — Project Analyzer
//
// High-level orchestrator that scans a project directory,
// analyzes all source files, detects components, and builds
// the component registry and dependency graph.
// ============================================================

import { readdir } from "node:fs/promises";
import { resolve, relative } from "node:path";
import {
  ComponentRegistry,
  DependencyGraph,
  loadConfig,
  type PulseConfig,
  type Framework,
} from "@pulse/core";
import { analyzeFile } from "./ast-scanner.js";
import { detectComponents, crossReferenceComponents } from "./component-detector.js";

/** Result of a full project analysis. */
export interface ProjectAnalysis {
  config: PulseConfig;
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
  configOverrides?: Partial<PulseConfig>
): Promise<ProjectAnalysis> {
  const startTime = performance.now();

  // Load configuration
  const config = {
    ...(await loadConfig(rootDir)),
    ...configOverrides,
  };

  const framework: Framework = config.framework ?? "unknown";

  // Find all matching source files
  const files = await findSourceFiles(config);

  // Analyze each file
  const registry = new ComponentRegistry();
  const allImports = [];
  let totalComponents = 0;

  for (const filePath of files) {
    try {
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
      console.warn(`[pulse] Warning: Failed to analyze ${filePath}:`, error);
    }
  }

  // Cross-reference components (populate usedBy)
  const allComponents = registry.getAllComponents();
  const crossReferenced = crossReferenceComponents(allComponents);

  // Rebuild registry with cross-referenced data
  registry.clear();
  registry.addComponents(crossReferenced);
  registry.addImports(allImports);

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
 */
async function findSourceFiles(config: PulseConfig): Promise<string[]> {
  const rootDir = resolve(config.rootDir);

  // Collect all files recursively
  const allFiles = await walkDir(rootDir);

  // Filter by include/exclude patterns using simple glob matching
  const includeExts = extractExtensions(config.include);
  const excludeDirs = config.exclude
    .filter((p) => p.includes("**"))
    .map((p) => p.replace(/\/\*\*.*/, "").replace(/\*\*\//, ""));

  return allFiles.filter((filePath) => {
    const rel = relative(rootDir, filePath);

    // Check excluded directories
    for (const dir of excludeDirs) {
      if (rel.includes(dir)) return false;
    }

    // Check file extension
    const ext = filePath.slice(filePath.lastIndexOf("."));
    return includeExts.has(ext);
  });
}

async function walkDir(dir: string): Promise<string[]> {
  const results: string[] = [];
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = resolve(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === ".git") continue;
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

function extractExtensions(patterns: string[]): Set<string> {
  const exts = new Set<string>();
  for (const pattern of patterns) {
    const match = pattern.match(/\.\{([^}]+)\}/);
    if (match?.[1]) {
      for (const ext of match[1].split(",")) {
        exts.add(`.${ext.trim()}`);
      }
    }
  }
  if (exts.size === 0) {
    // Default extensions
    exts.add(".tsx").add(".jsx").add(".vue").add(".svelte");
  }
  return exts;
}
