// ============================================================
// @foxlight/bundle — Webpack Plugin
//
// A Webpack plugin that hooks into the build process to extract
// per-module size information and map it to components.
// Outputs a foxlight-bundle-report.json after each build.
// ============================================================

import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { ComponentBundleInfo, SizeInfo } from '@foxlight/core';
import {
  computeSize,
  computeComponentBundleInfo,
  formatBytes,
  type ModuleEntry,
} from '../size-tracker.js';

export interface FoxlightWebpackPluginOptions {
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
 * Webpack-compatible compiler and compilation types.
 * Kept minimal to avoid requiring webpack as a dependency.
 */
interface WebpackCompiler {
  hooks: {
    emit: {
      tapAsync(
        name: string,
        callback: (compilation: WebpackCompilation, cb: () => void) => void,
      ): void;
    };
  };
  options: {
    context?: string;
  };
}

interface WebpackCompilation {
  assets: Record<string, WebpackAsset>;
  chunks: Iterable<WebpackChunk>;
  modules: Iterable<WebpackModule>;
}

interface WebpackAsset {
  source(): string | Buffer;
  size(): number;
}

interface WebpackChunk {
  name: string | null;
  files: Set<string>;
  id: string | number | null;
}

interface WebpackModule {
  identifier(): string;
  resource?: string;
  size(): number;
  _source?: { _value?: string };
  chunks: Iterable<WebpackChunk>;
}

/**
 * Webpack plugin for Foxlight bundle analysis.
 *
 * Usage in webpack.config.js:
 * ```js
 * const { FoxlightWebpackPlugin } = require("@foxlight/bundle/webpack");
 *
 * module.exports = {
 *   plugins: [new FoxlightWebpackPlugin()],
 * };
 * ```
 */
export class FoxlightWebpackPlugin {
  private options: FoxlightWebpackPluginOptions;

  constructor(options: FoxlightWebpackPluginOptions = {}) {
    this.options = options;
  }

  apply(compiler: WebpackCompiler): void {
    const pluginName = 'FoxlightWebpackPlugin';
    const { outputPath = '.foxlight/bundle-report.json', printSummary = true } = this.options;

    compiler.hooks.emit.tapAsync(pluginName, async (compilation, callback) => {
      try {
        const rootDir = compiler.options.context ?? process.cwd();
        const modules = new Map<string, ModuleEntry>();
        const chunkSizes: Array<{ name: string; size: SizeInfo }> = [];

        // Collect chunk sizes from assets
        for (const [fileName, asset] of Object.entries(compilation.assets)) {
          if (!fileName.endsWith('.js') && !fileName.endsWith('.mjs')) continue;
          const source = asset.source();
          const code = typeof source === 'string' ? source : source.toString('utf-8');
          const size = computeSize(code);
          chunkSizes.push({ name: fileName, size });
        }

        // Collect per-module information
        for (const mod of compilation.modules) {
          const id = mod.resource ?? mod.identifier();
          if (!id || id.includes('node_modules')) continue;

          // Get the module's source code
          const code = mod._source?._value ?? '';
          if (!code) continue;

          // Determine which chunks this module belongs to
          const chunks: string[] = [];
          for (const chunk of mod.chunks) {
            const chunkName = chunk.name ?? String(chunk.id);
            chunks.push(chunkName);
          }

          modules.set(id, { id, code, chunks });
        }

        // Build dependency map from compilation modules
        const moduleDeps = new Map<string, string[]>();
        for (const mod of compilation.modules) {
          const id = mod.resource ?? mod.identifier();
          if (!id) continue;
          // Webpack doesn't directly expose per-module deps in a simple way,
          // but we can use the module graph if available. For now, initialize empty.
          if (!moduleDeps.has(id)) {
            moduleDeps.set(id, []);
          }
        }

        // Compute per-component info if component mapping is provided
        let componentInfo: ComponentBundleInfo[] | undefined;
        if (this.options.componentModules) {
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
            this.options.componentModules,
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

        callback();
      } catch (error) {
        console.error('[foxlight] Error generating bundle report:', error);
        callback();
      }
    });
  }
}
