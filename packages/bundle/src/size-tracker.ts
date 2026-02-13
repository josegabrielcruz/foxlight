// ============================================================
// @pulse/bundle — Size Tracker
//
// Computes per-module and per-component bundle size from
// build output. Works with raw file sizes and optionally
// computes gzip/brotli estimates.
// ============================================================

import { gzipSync } from "node:zlib";
import type { SizeInfo, ComponentBundleInfo, ComponentId } from "@pulse/core";

/** A module in the build output. */
export interface ModuleEntry {
  /** Unique module identifier (usually the file path) */
  id: string;
  /** Raw source code or bundled code for this module */
  code: string;
  /** Which chunk(s) this module ended up in */
  chunks: string[];
}

/**
 * Compute size info for a piece of code.
 */
export function computeSize(code: string): SizeInfo {
  const raw = Buffer.byteLength(code, "utf-8");
  const gzip = gzipSync(Buffer.from(code, "utf-8")).byteLength;
  return { raw, gzip };
}

/**
 * Compute per-component bundle info.
 *
 * Takes a mapping of componentId → moduleIds and the full list of
 * modules from the build output, then calculates self, exclusive,
 * and total sizes.
 *
 * @param componentModules - Map of componentId to its direct module IDs
 * @param allModules - All modules from the build output
 * @param dependencyResolver - Function that returns transitive dependencies for a module
 */
export function computeComponentBundleInfo(
  componentModules: Map<ComponentId, string[]>,
  allModules: Map<string, ModuleEntry>,
  dependencyResolver: (moduleId: string) => string[]
): ComponentBundleInfo[] {
  const results: ComponentBundleInfo[] = [];
  const allComponentIds = Array.from(componentModules.keys());

  for (const [componentId, moduleIds] of componentModules) {
    // Self size: just the component's own module(s)
    const selfSize = aggregateSize(moduleIds, allModules);

    // Total size: component + all transitive dependencies
    const allDeps = new Set<string>();
    for (const modId of moduleIds) {
      allDeps.add(modId);
      for (const dep of dependencyResolver(modId)) {
        allDeps.add(dep);
      }
    }
    const totalSize = aggregateSize(Array.from(allDeps), allModules);

    // Exclusive size: dependencies unique to this component
    const otherDeps = new Set<string>();
    for (const otherId of allComponentIds) {
      if (otherId === componentId) continue;
      const otherModules = componentModules.get(otherId) ?? [];
      for (const modId of otherModules) {
        otherDeps.add(modId);
        for (const dep of dependencyResolver(modId)) {
          otherDeps.add(dep);
        }
      }
    }
    const exclusiveModules = Array.from(allDeps).filter(
      (d) => !otherDeps.has(d)
    );
    const exclusiveSize = aggregateSize(exclusiveModules, allModules);

    // Determine chunks
    const chunks = new Set<string>();
    for (const modId of moduleIds) {
      const mod = allModules.get(modId);
      if (mod) {
        for (const chunk of mod.chunks) {
          chunks.add(chunk);
        }
      }
    }

    results.push({
      componentId,
      selfSize,
      exclusiveSize,
      totalSize,
      chunks: Array.from(chunks),
    });
  }

  return results;
}

/**
 * Aggregate sizes across multiple modules.
 */
function aggregateSize(
  moduleIds: string[],
  allModules: Map<string, ModuleEntry>
): SizeInfo {
  let totalRaw = 0;
  let totalGzip = 0;

  for (const id of moduleIds) {
    const mod = allModules.get(id);
    if (mod) {
      const size = computeSize(mod.code);
      totalRaw += size.raw;
      totalGzip += size.gzip;
    }
  }

  return { raw: totalRaw, gzip: totalGzip };
}

/**
 * Format bytes into a human-readable string.
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  const sign = bytes < 0 ? "-" : "";
  return `${sign}${Math.abs(value).toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2)} ${units[i]}`;
}

/**
 * Format a size delta with a +/- prefix and color indicator.
 */
export function formatDelta(before: SizeInfo, after: SizeInfo): string {
  const delta = after.gzip - before.gzip;
  const sign = delta > 0 ? "+" : "";
  const percent =
    before.gzip > 0
      ? ` (${sign}${((delta / before.gzip) * 100).toFixed(1)}%)`
      : "";
  return `${sign}${formatBytes(delta)}${percent}`;
}
