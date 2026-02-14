import { describe, it, expect, vi } from 'vitest';
import {
  computeSize,
  computeComponentBundleInfo,
  formatBytes,
  formatDelta,
} from './size-tracker.js';
import type { ModuleEntry } from './size-tracker.js';

// Note: The Vite plugin itself requires a Vite build context to test fully.
// Here we test the underlying size-tracker logic that the plugin uses,
// along with formatBytes/formatDelta used in the plugin's console output.

describe('computeSize', () => {
  it('should compute raw and gzip sizes', () => {
    // Use a longer string so gzip overhead doesn't exceed raw size
    const code = 'const hello = "world";\n'.repeat(10);
    const size = computeSize(code);

    expect(size.raw).toBeGreaterThan(0);
    expect(size.gzip).toBeGreaterThan(0);
    expect(size.raw).toBeGreaterThanOrEqual(size.gzip);
  });

  it('should return 0 for empty string', () => {
    const size = computeSize('');
    expect(size.raw).toBe(0);
  });

  it('should show gzip benefit for repetitive content', () => {
    const repetitive = 'const x = "hello";\n'.repeat(1000);
    const size = computeSize(repetitive);
    // Gzip should compress repetitive content significantly
    expect(size.gzip).toBeLessThan(size.raw * 0.5);
  });
});

describe('computeComponentBundleInfo', () => {
  const createModules = (): Map<string, ModuleEntry> => {
    return new Map([
      ['mod-a', { id: 'mod-a', code: 'const a = 1;', chunks: ['main'] }],
      ['mod-b', { id: 'mod-b', code: 'const b = 2;', chunks: ['main'] }],
      ['mod-c', { id: 'mod-c', code: 'const c = 3;', chunks: ['vendor'] }],
      ['mod-shared', { id: 'mod-shared', code: 'export const shared = true;', chunks: ['main'] }],
    ]);
  };

  it('should compute self size for components', () => {
    const modules = createModules();
    const componentModules = new Map([
      ['CompA', ['mod-a']],
      ['CompB', ['mod-b']],
    ]);

    const result = computeComponentBundleInfo(componentModules, modules, () => []);

    expect(result).toHaveLength(2);
    const compA = result.find((r) => r.componentId === 'CompA');
    expect(compA).toBeDefined();
    expect(compA!.selfSize.raw).toBeGreaterThan(0);
  });

  it('should include transitive dependencies in total size', () => {
    const modules = createModules();
    const componentModules = new Map([['CompA', ['mod-a']]]);

    // mod-a depends on mod-shared
    const resolver = (id: string) => (id === 'mod-a' ? ['mod-shared'] : []);

    const result = computeComponentBundleInfo(componentModules, modules, resolver);
    const compA = result[0]!;

    // Total size should include mod-a + mod-shared
    expect(compA.totalSize.raw).toBeGreaterThan(compA.selfSize.raw);
  });

  it('should compute exclusive size correctly', () => {
    const modules = createModules();
    const componentModules = new Map([
      ['CompA', ['mod-a']],
      ['CompB', ['mod-b']],
    ]);

    // Both depend on mod-shared
    const resolver = (id: string) => (id === 'mod-a' || id === 'mod-b' ? ['mod-shared'] : []);

    const result = computeComponentBundleInfo(componentModules, modules, resolver);

    for (const comp of result) {
      // mod-shared is shared, so exclusive should NOT include it
      expect(comp.exclusiveSize.raw).toBeLessThanOrEqual(comp.totalSize.raw);
    }
  });

  it('should track chunks', () => {
    const modules = createModules();
    const componentModules = new Map([['CompC', ['mod-c']]]);

    const result = computeComponentBundleInfo(componentModules, modules, () => []);
    expect(result[0]!.chunks).toContain('vendor');
  });
});

describe('formatBytes', () => {
  it('should format 0 bytes', () => {
    expect(formatBytes(0)).toBe('0 B');
  });

  it('should format bytes', () => {
    expect(formatBytes(512)).toMatch(/512\s*B/);
  });

  it('should format kilobytes', () => {
    expect(formatBytes(1024)).toMatch(/1.*KB/);
  });

  it('should format megabytes', () => {
    expect(formatBytes(1024 * 1024)).toMatch(/1.*MB/);
  });

  it('should handle negative values', () => {
    const result = formatBytes(-1024);
    expect(result).toContain('-');
    expect(result).toContain('KB');
  });
});

describe('formatDelta', () => {
  it('should format positive delta', () => {
    const before = { raw: 1000, gzip: 500 };
    const after = { raw: 1500, gzip: 750 };
    const result = formatDelta(before, after);
    expect(result).toContain('+');
  });

  it('should format negative delta', () => {
    const before = { raw: 1500, gzip: 750 };
    const after = { raw: 1000, gzip: 500 };
    const result = formatDelta(before, after);
    expect(result).toContain('-');
  });

  it('should show percentage', () => {
    const before = { raw: 1000, gzip: 500 };
    const after = { raw: 1500, gzip: 750 };
    const result = formatDelta(before, after);
    expect(result).toContain('%');
  });
});
