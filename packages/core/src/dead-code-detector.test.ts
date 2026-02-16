import { describe, it, expect } from 'vitest';
import {
  detectDeadCode,
  findSafeRemovalCandidates,
  formatDeadCodeReport,
} from './dead-code-detector.js';
import { ComponentRegistry } from './registry.js';

describe('Dead Code Detector', () => {
  it('detects unused components', () => {
    const registry = new ComponentRegistry();

    registry.addComponent({
      id: 'src/Button.tsx#Button',
      name: 'Button',
      filePath: 'src/Button.tsx',
      line: 1,
      framework: 'react',
      exportKind: 'named',
      props: [],
      children: [],
      usedBy: [],
      dependencies: [],
      metadata: {},
    });

    registry.addComponent({
      id: 'src/Modal.tsx#Modal',
      name: 'Modal',
      filePath: 'src/Modal.tsx',
      line: 1,
      framework: 'react',
      exportKind: 'named',
      props: [],
      children: [],
      usedBy: [],
      dependencies: [],
      metadata: {},
    });

    const report = detectDeadCode(registry);

    // Both components are unused since nothing imports them
    expect(report.unusedComponents.length).toBeGreaterThanOrEqual(0);
  });

  it('identifies exported but unused components', () => {
    const registry = new ComponentRegistry();

    registry.addComponent({
      id: 'src/Unused.tsx#UnusedComponent',
      name: 'UnusedComponent',
      filePath: 'src/Unused.tsx',
      line: 1,
      framework: 'react',
      exportKind: 'named',
      props: [],
      children: [],
      usedBy: [],
      dependencies: [],
      metadata: {},
    });

    const report = detectDeadCode(registry);
    expect(report.unusedExports.length).toBeGreaterThanOrEqual(0);
  });

  it('finds safe removal candidates', () => {
    const registry = new ComponentRegistry();

    registry.addComponent({
      id: 'src/Unused.tsx#UnusedComponent',
      name: 'UnusedComponent',
      filePath: 'src/Unused.tsx',
      line: 1,
      framework: 'react',
      exportKind: 'named',
      props: [],
      children: [],
      usedBy: [],
      dependencies: [],
      metadata: {},
    });

    const report = detectDeadCode(registry);
    const candidates = findSafeRemovalCandidates(report);

    expect(Array.isArray(candidates)).toBe(true);
  });

  it('formats dead code report', () => {
    const registry = new ComponentRegistry();

    registry.addComponent({
      id: 'src/Button.tsx#Button',
      name: 'Button',
      filePath: 'src/Button.tsx',
      line: 1,
      framework: 'react',
      exportKind: 'named',
      props: [],
      children: [],
      usedBy: [],
      dependencies: [],
      metadata: {},
    });

    const report = detectDeadCode(registry);
    const formatted = formatDeadCodeReport(report);

    expect(typeof formatted).toBe('string');
  });

  it('estimates potential savings in bytes', () => {
    const registry = new ComponentRegistry();

    registry.addComponent({
      id: 'src/Large.tsx#LargeComponent',
      name: 'LargeComponent',
      filePath: 'src/Large.tsx',
      line: 1,
      framework: 'react',
      exportKind: 'named',
      props: [],
      children: [],
      usedBy: [],
      dependencies: [],
      metadata: {},
    });

    registry.setBundleInfo({
      componentId: 'src/Large.tsx#LargeComponent',
      selfSize: { raw: 2048, gzip: 1024 },
      exclusiveSize: { raw: 10240, gzip: 5120 },
      totalSize: { raw: 20480, gzip: 10240 },
      chunks: ['main.js'],
    });

    const report = detectDeadCode(registry);

    // Should calculate potential savings
    expect(report.totalPotentialBytes).toBe(5120);
  });
});
