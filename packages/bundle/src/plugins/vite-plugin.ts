// ============================================================
// @pulse/bundle — Vite Plugin
//
// A Vite plugin that hooks into the build process to extract
// per-module size information and map it to components.
// Outputs a pulse-bundle-report.json after each build.
// ============================================================

import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { Plugin, Rollup } from "vite";
import type { ComponentBundleInfo, SizeInfo } from "@pulse/core";
import {
  computeSize,
  computeComponentBundleInfo,
  formatBytes,
  type ModuleEntry,
} from "../size-tracker.js";

export interface PulseVitePluginOptions {
  /**
   * Path to the output report file.
   * @default ".pulse/bundle-report.json"
   */
  outputPath?: string;

  /**
   * Map of componentId → module file paths.
   * If not provided, the plugin will report per-module sizes
   * without component mapping.
   */
  componentModules?: Map<string, string[]>;

  /**
   * Whether to print a summary to the console.
   * @default true
   */
  printSummary?: boolean;
}

/**
 * Vite plugin for Pulse bundle analysis.
 *
 * Usage in vite.config.ts:
 * ```ts
 * import { pulseBundle } from "@pulse/bundle/vite";
 *
 * export default defineConfig({
 *   plugins: [pulseBundle()],
 * });
 * ```
 */
export function pulseBundle(options: PulseVitePluginOptions = {}): Plugin {
  const {
    outputPath = ".pulse/bundle-report.json",
    printSummary = true,
  } = options;

  let rootDir: string;

  return {
    name: "pulse-bundle",
    enforce: "post",

    configResolved(config) {
      rootDir = config.root;
    },

    async generateBundle(_outputOptions, bundle) {
      const modules = new Map<string, ModuleEntry>();
      const chunkSizes: Array<{ name: string; size: SizeInfo }> = [];

      // Extract module information from each chunk
      for (const [fileName, chunk] of Object.entries(bundle)) {
        if (chunk.type !== "chunk") continue;

        const chunkSize = computeSize(chunk.code);
        chunkSizes.push({ name: fileName, size: chunkSize });

        // Map each module in this chunk
        if (chunk.modules) {
          for (const [moduleId, moduleInfo] of Object.entries(
            chunk.modules as Record<string, Rollup.RenderedModule>
          )) {
            const existing = modules.get(moduleId);
            if (existing) {
              existing.chunks.push(fileName);
            } else {
              modules.set(moduleId, {
                id: moduleId,
                code: moduleInfo.code ?? "",
                chunks: [fileName],
              });
            }
          }
        }
      }

      // Compute per-component info if component mapping is provided
      let componentInfo: ComponentBundleInfo[] | undefined;
      if (options.componentModules) {
        componentInfo = computeComponentBundleInfo(
          options.componentModules,
          modules,
          () => [] // TODO: integrate with DependencyGraph
        );
      }

      // Build report
      const report = {
        timestamp: new Date().toISOString(),
        rootDir,
        chunks: chunkSizes.map((c) => ({
          name: c.name,
          rawSize: c.size.raw,
          gzipSize: c.size.gzip,
        })),
        modules: Array.from(modules.values()).map((m) => ({
          id: m.id,
          rawSize: Buffer.byteLength(m.code, "utf-8"),
          chunks: m.chunks,
        })),
        components: componentInfo,
        totalModules: modules.size,
        totalChunks: chunkSizes.length,
      };

      // Write report
      const reportPath = join(rootDir, outputPath);
      const reportDir = reportPath.substring(
        0,
        reportPath.lastIndexOf("/")
      );
      await mkdir(reportDir, { recursive: true });
      await writeFile(reportPath, JSON.stringify(report, null, 2));

      // Print summary
      if (printSummary) {
        const totalRaw = chunkSizes.reduce((sum, c) => sum + c.size.raw, 0);
        const totalGzip = chunkSizes.reduce(
          (sum, c) => sum + c.size.gzip,
          0
        );

        console.log("\n📦 Pulse Bundle Report");
        console.log("─".repeat(50));
        console.log(`   Chunks: ${chunkSizes.length}`);
        console.log(`   Modules: ${modules.size}`);
        console.log(`   Total (raw): ${formatBytes(totalRaw)}`);
        console.log(`   Total (gzip): ${formatBytes(totalGzip)}`);
        console.log(`   Report: ${outputPath}`);
        console.log("─".repeat(50));

        if (componentInfo && componentInfo.length > 0) {
          console.log("\n   Components by size (gzip):");
          const sorted = [...componentInfo].sort(
            (a, b) => b.selfSize.gzip - a.selfSize.gzip
          );
          for (const comp of sorted.slice(0, 10)) {
            console.log(
              `     ${formatBytes(comp.selfSize.gzip).padStart(10)}  ${comp.componentId}`
            );
          }
        }
        console.log("");
      }
    },
  };
}
