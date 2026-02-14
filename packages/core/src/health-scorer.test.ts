import { describe, it, expect } from 'vitest';
import { computeComponentHealth, computeAllHealth, DEFAULT_WEIGHTS } from './health-scorer.js';
import type { HealthInput } from './health-scorer.js';
import type { ComponentInfo, ComponentBundleInfo } from './types.js';

function makeComponent(overrides: Partial<ComponentInfo> = {}): ComponentInfo {
  return {
    id: 'test/Button',
    name: 'Button',
    filePath: '/src/Button.tsx',
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

function makeBundleInfo(gzipBytes: number): ComponentBundleInfo {
  return {
    componentId: 'test/Button',
    selfSize: { raw: gzipBytes * 2, gzip: gzipBytes },
    exclusiveSize: { raw: gzipBytes * 2, gzip: gzipBytes },
    totalSize: { raw: gzipBytes * 3, gzip: Math.round(gzipBytes * 1.5) },
    chunks: ['main'],
  };
}

describe('computeComponentHealth', () => {
  it('should return a valid health score', () => {
    const input: HealthInput = {
      component: makeComponent(),
    };
    const health = computeComponentHealth(input);

    expect(health.componentId).toBe('test/Button');
    expect(health.score).toBeGreaterThanOrEqual(0);
    expect(health.score).toBeLessThanOrEqual(100);
    expect(health.computedAt).toBeTruthy();
    expect(health.metrics).toBeDefined();
  });

  it('should score small bundles highly', () => {
    const input: HealthInput = {
      component: makeComponent(),
      bundleInfo: makeBundleInfo(1024), // 1KB gzip
    };
    const health = computeComponentHealth(input);
    expect(health.metrics.bundleSize.score).toBe(100);
    expect(health.metrics.bundleSize.level).toBe('good');
  });

  it('should penalize large bundles', () => {
    const input: HealthInput = {
      component: makeComponent(),
      bundleInfo: makeBundleInfo(100_000), // 100KB gzip
    };
    const health = computeComponentHealth(input);
    expect(health.metrics.bundleSize.score).toBeLessThan(50);
    expect(health.metrics.bundleSize.level).toBe('critical');
  });

  it('should score test coverage correctly', () => {
    const input: HealthInput = {
      component: makeComponent(),
      testCoverage: 95,
    };
    const health = computeComponentHealth(input);
    expect(health.metrics.testCoverage.score).toBe(95);
    expect(health.metrics.testCoverage.level).toBe('good');
  });

  it('should mark missing test coverage as critical', () => {
    const input: HealthInput = {
      component: makeComponent(),
      // No testCoverage provided
    };
    const health = computeComponentHealth(input);
    expect(health.metrics.testCoverage.score).toBe(0);
    expect(health.metrics.testCoverage.level).toBe('critical');
  });

  it('should score freshness for recently modified components', () => {
    const input: HealthInput = {
      component: makeComponent(),
      daysSinceModified: 5,
    };
    const health = computeComponentHealth(input);
    expect(health.metrics.freshness.score).toBe(100);
    expect(health.metrics.freshness.level).toBe('good');
  });

  it('should penalize stale components', () => {
    const input: HealthInput = {
      component: makeComponent(),
      daysSinceModified: 500,
    };
    const health = computeComponentHealth(input);
    expect(health.metrics.freshness.score).toBeLessThan(50);
  });

  it('should score fast render times highly', () => {
    const input: HealthInput = {
      component: makeComponent(),
      renderTimeMs: 10,
    };
    const health = computeComponentHealth(input);
    expect(health.metrics.performance.score).toBe(100);
    expect(health.metrics.performance.level).toBe('good');
  });

  it('should score low error rates highly', () => {
    const input: HealthInput = {
      component: makeComponent(),
      errorRate: 0.001, // 0.1%
    };
    const health = computeComponentHealth(input);
    expect(health.metrics.reliability.score).toBeGreaterThan(90);
    expect(health.metrics.reliability.level).toBe('good');
  });

  it('should compute weighted overall score', () => {
    const input: HealthInput = {
      component: makeComponent(),
      bundleInfo: makeBundleInfo(1024),
      testCoverage: 90,
      accessibilityScore: 85,
      daysSinceModified: 10,
      renderTimeMs: 15,
      errorRate: 0.005,
    };
    const health = computeComponentHealth(input);

    // With all good metrics, overall should be high
    expect(health.score).toBeGreaterThan(80);
  });
});

describe('computeAllHealth', () => {
  it('should compute health for multiple components', () => {
    const inputs: HealthInput[] = [
      { component: makeComponent({ id: 'Button', name: 'Button' }) },
      { component: makeComponent({ id: 'Card', name: 'Card' }) },
    ];

    const results = computeAllHealth(inputs);
    expect(results).toHaveLength(2);
    expect(results[0]!.componentId).toBe('Button');
    expect(results[1]!.componentId).toBe('Card');
  });
});

describe('DEFAULT_WEIGHTS', () => {
  it('should sum to 1', () => {
    const sum = Object.values(DEFAULT_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 10);
  });
});
