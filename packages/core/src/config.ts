// ============================================================
// @pulse/core — Configuration loader
//
// Loads and validates pulse.config.ts / pulse.config.js
// from the user's project root.
// ============================================================

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import type { PulseConfig, Framework } from "./types.js";

const CONFIG_FILENAMES = [
  "pulse.config.ts",
  "pulse.config.js",
  "pulse.config.mjs",
  "pulse.config.json",
];

const DEFAULT_INCLUDE = [
  "src/**/*.{tsx,jsx,vue,svelte}",
  "components/**/*.{tsx,jsx,vue,svelte}",
  "app/**/*.{tsx,jsx,vue,svelte}",
  "pages/**/*.{tsx,jsx,vue,svelte}",
];

const DEFAULT_EXCLUDE = [
  "**/node_modules/**",
  "**/dist/**",
  "**/build/**",
  "**/.next/**",
  "**/.nuxt/**",
  "**/*.test.*",
  "**/*.spec.*",
  "**/*.stories.*",
];

/**
 * Resolve and load the Pulse configuration.
 * Searches for config files in the given directory, or returns defaults.
 */
export async function loadConfig(
  rootDir: string
): Promise<PulseConfig> {
  const resolvedRoot = resolve(rootDir);

  // Try to find a config file
  for (const filename of CONFIG_FILENAMES) {
    const configPath = join(resolvedRoot, filename);
    if (existsSync(configPath)) {
      const config = await loadConfigFile(configPath);
      return mergeWithDefaults(resolvedRoot, config);
    }
  }

  // No config file found — auto-detect and return defaults
  const framework = await detectFramework(resolvedRoot);
  return mergeWithDefaults(resolvedRoot, { framework });
}

/**
 * Create a default configuration for the given root directory.
 */
export function createDefaultConfig(rootDir: string): PulseConfig {
  return {
    rootDir: resolve(rootDir),
    include: DEFAULT_INCLUDE,
    exclude: DEFAULT_EXCLUDE,
  };
}

/**
 * Auto-detect the framework used in a project by examining package.json.
 */
export async function detectFramework(rootDir: string): Promise<Framework> {
  const pkgPath = join(rootDir, "package.json");

  if (!existsSync(pkgPath)) return "unknown";

  try {
    const raw = await readFile(pkgPath, "utf-8");
    const pkg = JSON.parse(raw) as Record<string, Record<string, string>>;
    const allDeps = {
      ...pkg["dependencies"],
      ...pkg["devDependencies"],
    };

    if ("react" in allDeps) return "react";
    if ("vue" in allDeps) return "vue";
    if ("svelte" in allDeps) return "svelte";
    if ("@angular/core" in allDeps) return "angular";
    if ("lit" in allDeps || "lit-element" in allDeps) return "web-component";
  } catch {
    // Failed to read/parse package.json — fall through
  }

  return "unknown";
}

// -----------------------------------------------------------
// Internal helpers
// -----------------------------------------------------------

async function loadConfigFile(
  configPath: string
): Promise<Partial<PulseConfig>> {
  if (configPath.endsWith(".json")) {
    const raw = await readFile(configPath, "utf-8");
    return JSON.parse(raw) as Partial<PulseConfig>;
  }

  // For .ts/.js/.mjs files, use dynamic import
  // Note: .ts files will need tsx or ts-node to be available
  try {
    const mod = (await import(configPath)) as {
      default?: Partial<PulseConfig>;
    };
    return mod.default ?? {};
  } catch {
    // If import fails, return empty config
    return {};
  }
}

function mergeWithDefaults(
  rootDir: string,
  partial: Partial<PulseConfig>
): PulseConfig {
  return {
    rootDir,
    include: partial.include ?? DEFAULT_INCLUDE,
    exclude: partial.exclude ?? DEFAULT_EXCLUDE,
    framework: partial.framework,
    storybook: partial.storybook,
    costModel: partial.costModel,
    baselines: partial.baselines,
    plugins: partial.plugins,
  };
}
