import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FoxlightWebpackPlugin } from './plugins/webpack-plugin.js';
import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdirSync } from 'node:fs';

// -----------------------------------------------------------
// Helpers to build mock Webpack compiler / compilation objects
// -----------------------------------------------------------

interface MockAsset {
  source(): string;
  size(): number;
}

interface MockModule {
  identifier(): string;
  resource?: string;
  size(): number;
  _source?: { _value?: string };
  chunks: Iterable<{ name: string | null; id: string | number | null; files: Set<string> }>;
}

function createMockAsset(code: string): MockAsset {
  return {
    source: () => code,
    size: () => Buffer.byteLength(code, 'utf-8'),
  };
}

function createMockModule(id: string, code: string, chunkName = 'main'): MockModule {
  const chunk = { name: chunkName, id: chunkName, files: new Set([`${chunkName}.js`]) };
  return {
    identifier: () => id,
    resource: id,
    size: () => Buffer.byteLength(code, 'utf-8'),
    _source: { _value: code },
    chunks: [chunk],
  };
}

function createMockCompiler(
  compilation: {
    assets: Record<string, MockAsset>;
    modules: MockModule[];
    chunks: Array<{ name: string | null; files: Set<string>; id: string | number | null }>;
  },
  context?: string,
) {
  let tapCallback: ((comp: typeof compilation, cb: () => void) => void) | undefined;

  return {
    hooks: {
      emit: {
        tapAsync(_name: string, callback: (comp: typeof compilation, cb: () => void) => void) {
          tapCallback = callback;
        },
      },
    },
    options: { context },
    // Helper to trigger the emit hook in tests
    async triggerEmit() {
      if (!tapCallback) throw new Error('tapAsync was never called');
      await new Promise<void>((resolve) => {
        tapCallback!(compilation, resolve);
      });
    },
  };
}

// -----------------------------------------------------------
// Tests
// -----------------------------------------------------------

describe('FoxlightWebpackPlugin', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `foxlight-wp-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
  });

  it('should register a tapAsync hook on emit', () => {
    const plugin = new FoxlightWebpackPlugin({ printSummary: false });
    const compiler = createMockCompiler({ assets: {}, modules: [], chunks: [] }, testDir);

    plugin.apply(compiler as never);

    // If tapAsync was called, triggerEmit won't throw
    expect(() => compiler.triggerEmit()).not.toThrow();
  });

  it('should generate a bundle report file', async () => {
    const outputPath = '.foxlight/bundle-report.json';
    const plugin = new FoxlightWebpackPlugin({
      outputPath,
      printSummary: false,
    });

    const mainChunk = { name: 'main', id: 'main', files: new Set(['main.js']) };
    const code = 'const greeting = "hello world";\n'.repeat(5);

    const compiler = createMockCompiler(
      {
        assets: { 'main.js': createMockAsset(code) },
        modules: [
          {
            identifier: () => '/src/app.ts',
            resource: '/src/app.ts',
            size: () => Buffer.byteLength(code, 'utf-8'),
            _source: { _value: code },
            chunks: [mainChunk],
          },
        ],
        chunks: [mainChunk],
      },
      testDir,
    );

    plugin.apply(compiler as never);
    await compiler.triggerEmit();

    const reportPath = join(testDir, outputPath);
    const reportContent = await readFile(reportPath, 'utf-8');
    const report = JSON.parse(reportContent);

    expect(report.timestamp).toBeTruthy();
    expect(report.rootDir).toBe(testDir);
    expect(report.chunks).toHaveLength(1);
    expect(report.chunks[0].name).toBe('main.js');
    expect(report.chunks[0].rawSize).toBeGreaterThan(0);
    expect(report.chunks[0].gzipSize).toBeGreaterThan(0);
    expect(report.totalModules).toBe(1);
    expect(report.totalChunks).toBe(1);

    // cleanup
    await rm(testDir, { recursive: true, force: true });
  });

  it('should skip node_modules and modules without source', async () => {
    const plugin = new FoxlightWebpackPlugin({
      printSummary: false,
    });

    const mainChunk = { name: 'main', id: 'main', files: new Set(['main.js']) };

    const compiler = createMockCompiler(
      {
        assets: { 'main.js': createMockAsset('var x = 1;') },
        modules: [
          createMockModule('/src/app.ts', 'const app = true;', 'main'),
          {
            // node_modules module — should be skipped
            identifier: () => '/project/node_modules/lodash/index.js',
            resource: '/project/node_modules/lodash/index.js',
            size: () => 500,
            _source: { _value: 'module.exports = {}' },
            chunks: [mainChunk],
          },
          {
            // Module without source — should be skipped
            identifier: () => '/src/empty.ts',
            resource: '/src/empty.ts',
            size: () => 0,
            _source: { _value: '' },
            chunks: [mainChunk],
          },
        ],
        chunks: [mainChunk],
      },
      testDir,
    );

    plugin.apply(compiler as never);
    await compiler.triggerEmit();

    const reportContent = await readFile(join(testDir, '.foxlight/bundle-report.json'), 'utf-8');
    const report = JSON.parse(reportContent);

    // Only the /src/app.ts module should be included
    expect(report.totalModules).toBe(1);
    expect(report.modules[0].id).toBe('/src/app.ts');

    await rm(testDir, { recursive: true, force: true });
  });

  it('should only process .js and .mjs assets', async () => {
    const plugin = new FoxlightWebpackPlugin({ printSummary: false });

    const compiler = createMockCompiler(
      {
        assets: {
          'main.js': createMockAsset('var a = 1;'),
          'worker.mjs': createMockAsset('var b = 2;'),
          'styles.css': createMockAsset('.a { color: red; }'),
          'logo.png': createMockAsset('PNG_DATA'),
        },
        modules: [],
        chunks: [],
      },
      testDir,
    );

    plugin.apply(compiler as never);
    await compiler.triggerEmit();

    const report = JSON.parse(
      await readFile(join(testDir, '.foxlight/bundle-report.json'), 'utf-8'),
    );

    // Only .js and .mjs assets counted as chunks
    expect(report.totalChunks).toBe(2);
    const chunkNames = report.chunks.map((c: { name: string }) => c.name);
    expect(chunkNames).toContain('main.js');
    expect(chunkNames).toContain('worker.mjs');
    expect(chunkNames).not.toContain('styles.css');

    await rm(testDir, { recursive: true, force: true });
  });

  it('should compute component bundle info when componentModules is provided', async () => {
    const plugin = new FoxlightWebpackPlugin({
      printSummary: false,
      componentModules: new Map([['Button', ['/src/button.ts']]]),
    });

    const mainChunk = { name: 'main', id: 'main', files: new Set(['main.js']) };
    const buttonCode = 'export function Button() { return "click me"; }\n'.repeat(3);

    const compiler = createMockCompiler(
      {
        assets: { 'main.js': createMockAsset(buttonCode) },
        modules: [createMockModule('/src/button.ts', buttonCode, 'main')],
        chunks: [mainChunk],
      },
      testDir,
    );

    plugin.apply(compiler as never);
    await compiler.triggerEmit();

    const report = JSON.parse(
      await readFile(join(testDir, '.foxlight/bundle-report.json'), 'utf-8'),
    );

    expect(report.components).toBeDefined();
    expect(report.components).toHaveLength(1);
    expect(report.components[0].componentId).toBe('Button');
    expect(report.components[0].selfSize.raw).toBeGreaterThan(0);

    await rm(testDir, { recursive: true, force: true });
  });

  it('should print summary to console when printSummary is true', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const plugin = new FoxlightWebpackPlugin({ printSummary: true });
    const code = 'const x = 1;\n'.repeat(10);

    const compiler = createMockCompiler(
      {
        assets: { 'main.js': createMockAsset(code) },
        modules: [createMockModule('/src/index.ts', code)],
        chunks: [{ name: 'main', id: 'main', files: new Set(['main.js']) }],
      },
      testDir,
    );

    plugin.apply(compiler as never);
    await compiler.triggerEmit();

    const output = consoleSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('Foxlight Bundle Report');
    expect(output).toContain('Chunks:');
    expect(output).toContain('Modules:');

    consoleSpy.mockRestore();
    await rm(testDir, { recursive: true, force: true });
  });

  it('should use default outputPath when not specified', async () => {
    const plugin = new FoxlightWebpackPlugin({ printSummary: false });

    const compiler = createMockCompiler({ assets: {}, modules: [], chunks: [] }, testDir);

    plugin.apply(compiler as never);
    await compiler.triggerEmit();

    // Default path is .foxlight/bundle-report.json
    const report = await readFile(join(testDir, '.foxlight/bundle-report.json'), 'utf-8');
    expect(JSON.parse(report).timestamp).toBeTruthy();

    await rm(testDir, { recursive: true, force: true });
  });
});
