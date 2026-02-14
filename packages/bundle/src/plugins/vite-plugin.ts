// ============================================================
// @foxlight/bundle — Vite Plugin
//
// A Vite plugin that hooks into the build process to extract
// per-module size information and map it to components.
// Outputs a foxlight-bundle-report.json after each build.
// ============================================================

import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { Plugin, Rollup } from 'vite';
import type { ComponentBundleInfo, SizeInfo } from '@foxlight/core';
import {
  computeSize,
  computeComponentBundleInfo,
  formatBytes,
  type ModuleEntry,
} from '../size-tracker.js';

export interface FoxlightVitePluginOptions {
  /**
   * Path to the output report file.
   * @default ".foxlight/bundle-report.json"
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
 * Vite plugin for Foxlight bundle analysis.
 *
 * Usage in vite.config.ts:
 * ```ts
 * import { foxlightBundle } from "@foxlight/bundle/vite";
 *
 * export default defineConfig({
 *   plugins: [foxlightBundle()],
 * });
 * ```
 */
export function foxlightBundle(options: FoxlightVitePluginOptions = {}): Plugin {
  const { outputPath = '.foxlight/bundle-report.json', printSummary = true } = options;

  let rootDir: string;

  return {
    name: 'foxlight-bundle',
    enforce: 'post',

    configResolved(config) {
      rootDir = config.root;
    },

    async generateBundle(_outputOptions, bundle) {
      const modules = new Map<string, ModuleEntry>();
      const chunkSizes: Array<{ name: string; size: SizeInfo }> = [];

      // Extract module information from each chunk
      for (const [fileName, chunk] of Object.entries(bundle)) {
        if (chunk.type !== 'chunk') continue;

        const chunkSize = computeSize(chunk.code);
        chunkSizes.push({ name: fileName, size: chunkSize });

        // Map each module in this chunk
        if (chunk.modules) {
          for (const [moduleId, moduleInfo] of Object.entries(
            chunk.modules as Record<string, Rollup.RenderedModule>,
          )) {
            const existing = modules.get(moduleId);
            if (existing) {
              existing.chunks.push(fileName);
            } else {
              modules.set(moduleId, {
                id: moduleId,
                code: moduleInfo.code ?? '',
                chunks: [fileName],
              });
            }
          }
        }
      }

      // Compute per-component info if component mapping is provided
      let componentInfo: ComponentBundleInfo[] | undefined;
      if (options.componentModules) {
        // Build a dependency map from Rollup's module graph
        const moduleDeps = new Map<string, string[]>();
        for (const [_fileName, chunk] of Object.entries(bundle)) {
          if (chunk.type !== 'chunk') continue;
          if (chunk.modules) {
            for (const moduleId of Object.keys(
              chunk.modules as Record<string, Rollup.RenderedModule>,
            )) {
              if (!moduleDeps.has(moduleId)) {
                moduleDeps.set(moduleId, []);
              }
            }
          }
          // Use Rollup's importedBindings / imports for dependency info
          if (chunk.imports) {
            for (const imp of chunk.imports) {
              // Find modules that belong to each imported chunk
              const importedChunk = bundle[imp];
              if (importedChunk && importedChunk.type === 'chunk' && importedChunk.modules) {
                for (const moduleId of Object.keys(
                  chunk.modules as Record<string, Rollup.RenderedModule>,
                )) {
                  const deps = moduleDeps.get(moduleId) ?? [];
                  for (const depId of Object.keys(
                    importedChunk.modules as Record<string, Rollup.RenderedModule>,
                  )) {
                    if (!deps.includes(depId)) {
                      deps.push(depId);
                    }
                  }
                  moduleDeps.set(moduleId, deps);
                }
              }
            }
          }
        }

        const dependencyResolver = (moduleId: string): string[] => {
          const visited = new Set<string>();
          const queue = [moduleId];
          const result: string[] = [];

          while (queue.length > 0) {
            const current = queue.shift()!;
            if (visited.has(current)) continue;
            visited.add(current);

            const deps = moduleDeps.get(current) ?? [];
            for (const dep of deps) {
              if (!visited.has(dep)) {
                result.push(dep);
                queue.push(dep);
              }
            }
          }

          return result;
        };

        componentInfo = computeComponentBundleInfo(
          options.componentModules,
          modules,
          dependencyResolver,
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
          rawSize: Buffer.byteLength(m.code, 'utf-8'),
          chunks: m.chunks,
        })),
        components: componentInfo,
        totalModules: modules.size,
        totalChunks: chunkSizes.length,
      };

      // Write report
      const reportPath = join(rootDir, outputPath);
      const reportDir = reportPath.substring(0, reportPath.lastIndexOf('/'));
      await mkdir(reportDir, { recursive: true });
      await writeFile(reportPath, JSON.stringify(report, null, 2));

      // Print summary
      if (printSummary) {
        const totalRaw = chunkSizes.reduce((sum, c) => sum + c.size.raw, 0);
        const totalGzip = chunkSizes.reduce((sum, c) => sum + c.size.gzip, 0);

        console.log('\n📦 Foxlight Bundle Report');
        console.log('─'.repeat(50));
        console.log(`   Chunks: ${chunkSizes.length}`);
        console.log(`   Modules: ${modules.size}`);
        console.log(`   Total (raw): ${formatBytes(totalRaw)}`);
        console.log(`   Total (gzip): ${formatBytes(totalGzip)}`);
        console.log(`   Report: ${outputPath}`);
        console.log('─'.repeat(50));

        if (componentInfo && componentInfo.length > 0) {
          console.log('\n   Components by size (gzip):');
          const sorted = [...componentInfo].sort((a, b) => b.selfSize.gzip - a.selfSize.gzip);
          for (const comp of sorted.slice(0, 10)) {
            console.log(
              `     ${formatBytes(comp.selfSize.gzip).padStart(10)}  ${comp.componentId}`,
            );
          }
        }
        console.log('');
      }
    },
  };
}
