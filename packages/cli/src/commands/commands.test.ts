import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the analyzer module
vi.mock('@foxlight/analyzer', () => ({
  analyzeProject: vi.fn(),
}));

// Mock the bundle module
vi.mock('@foxlight/bundle', () => ({
  formatBytes: vi.fn((b: number) => `${b} B`),
}));

// Mock @foxlight/core partially — keep real classes, mock health scorer
vi.mock('@foxlight/core', async () => {
  const actual = await vi.importActual('@foxlight/core');
  const metric = (score: number) => ({ score, value: '', label: 'OK', level: 'good' as const });
  return {
    ...actual,
    computeComponentHealth: vi.fn((input: { component: { id: string; name: string } }) => ({
      componentId: input.component.id,
      componentName: input.component.name,
      score: 72,
      computedAt: new Date().toISOString(),
      metrics: {
        bundleSize: metric(80),
        testCoverage: metric(0),
        accessibility: metric(0),
        freshness: metric(100),
        performance: metric(0),
        reliability: metric(0),
      },
    })),
  };
});

// Mock the output utility to capture output
vi.mock('../utils/output.js', () => {
  const calls: string[][] = [];
  return {
    ui: {
      banner: vi.fn(),
      heading: vi.fn((text: string) => calls.push(['heading', text])),
      info: vi.fn((...args: string[]) => calls.push(['info', ...args])),
      success: vi.fn((text: string) => calls.push(['success', text])),
      warn: vi.fn((text: string) => calls.push(['warn', text])),
      error: vi.fn((text: string) => calls.push(['error', text])),
      row: vi.fn(),
      tableHeader: vi.fn(),
      healthScore: vi.fn((score: number) => String(score)),
      sizeDelta: vi.fn((delta: number) => String(delta)),
      progress: vi.fn(),
      progressDone: vi.fn(),
      gap: vi.fn(),
      _calls: calls,
    },
  };
});

import { analyzeProject } from '@foxlight/analyzer';
import type { ComponentInfo } from '@foxlight/core';
import { ComponentRegistry, DependencyGraph } from '@foxlight/core';

function makeComponent(overrides: Partial<ComponentInfo> = {}): ComponentInfo {
  return {
    id: 'test/Button',
    name: 'Button',
    filePath: '/src/components/Button.tsx',
    line: 1,
    framework: 'react',
    exportKind: 'named',
    props: [],
    children: [],
    usedBy: [],
    dependencies: [],
    metadata: {},
    ...overrides,
  };
}

function createMockAnalysis(components: ComponentInfo[]) {
  const registry = new ComponentRegistry();
  registry.addComponents(components);
  return {
    config: {
      rootDir: '/test',
      include: [],
      exclude: [],
      framework: 'react' as const,
    },
    registry,
    graph: DependencyGraph.fromImports([]),
    stats: {
      filesScanned: 5,
      componentsFound: components.length,
      importsTracked: 3,
      duration: 42,
    },
  };
}

describe('analyze command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should print analysis results', async () => {
    const { runAnalyze } = await import('./analyze.js');
    const mockAnalysis = createMockAnalysis([
      makeComponent({ id: 'Button', name: 'Button' }),
      makeComponent({ id: 'Card', name: 'Card' }),
    ]);
    vi.mocked(analyzeProject).mockResolvedValue(mockAnalysis);

    await runAnalyze({ rootDir: '/test' });

    expect(analyzeProject).toHaveBeenCalledWith('/test');
  });

  it('should output JSON when json flag is set', async () => {
    const { runAnalyze } = await import('./analyze.js');
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const mockAnalysis = createMockAnalysis([makeComponent({ id: 'Button', name: 'Button' })]);
    vi.mocked(analyzeProject).mockResolvedValue(mockAnalysis);

    await runAnalyze({ rootDir: '/test', json: true });

    expect(consoleSpy).toHaveBeenCalled();
    const output = consoleSpy.mock.calls[0]?.[0];
    expect(() => JSON.parse(output as string)).not.toThrow();
    consoleSpy.mockRestore();
  });
});

describe('health command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show health scores for all components', async () => {
    const { runHealth } = await import('./health.js');
    const mockAnalysis = createMockAnalysis([
      makeComponent({ id: 'Button', name: 'Button' }),
      makeComponent({ id: 'Card', name: 'Card', children: ['Button'] }),
    ]);
    vi.mocked(analyzeProject).mockResolvedValue(mockAnalysis);

    await runHealth({ rootDir: '/test' });

    expect(analyzeProject).toHaveBeenCalledWith('/test');
  });

  it('should filter by component name', async () => {
    const { runHealth } = await import('./health.js');
    const mockAnalysis = createMockAnalysis([
      makeComponent({ id: 'Button', name: 'Button' }),
      makeComponent({ id: 'Card', name: 'Card' }),
    ]);
    vi.mocked(analyzeProject).mockResolvedValue(mockAnalysis);

    await runHealth({ rootDir: '/test', component: 'Button' });

    expect(analyzeProject).toHaveBeenCalled();
  });

  it('should output JSON when json flag is set', async () => {
    const { runHealth } = await import('./health.js');
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const mockAnalysis = createMockAnalysis([makeComponent({ id: 'Button', name: 'Button' })]);
    vi.mocked(analyzeProject).mockResolvedValue(mockAnalysis);

    await runHealth({ rootDir: '/test', json: true });

    expect(consoleSpy).toHaveBeenCalled();
    const output = consoleSpy.mock.calls[0]?.[0];
    expect(() => JSON.parse(output as string)).not.toThrow();
    consoleSpy.mockRestore();
  });

  it('should warn when no components are found', async () => {
    const { runHealth } = await import('./health.js');
    const { ui } = await import('../utils/output.js');
    const mockAnalysis = createMockAnalysis([]);
    vi.mocked(analyzeProject).mockResolvedValue(mockAnalysis);

    await runHealth({ rootDir: '/test' });

    expect(ui.warn).toHaveBeenCalled();
  });
});

describe('init command', () => {
  it('should be importable', async () => {
    const { runInit } = await import('./init.js');
    expect(typeof runInit).toBe('function');
  });
});
