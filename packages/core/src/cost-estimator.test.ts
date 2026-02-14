import { describe, it, expect } from 'vitest';
import type { ComponentBundleInfo, CostModel } from './types.js';
import {
  COST_MODELS,
  DEFAULT_TRAFFIC,
  estimateCostImpact,
  estimateMonthlyCost,
} from './cost-estimator.js';
import type { TrafficProfile } from './cost-estimator.js';

// -----------------------------------------------------------
// Test helpers
// -----------------------------------------------------------

function makeBundleInfo(rawBytes: number, gzipBytes?: number): ComponentBundleInfo[] {
  return [
    {
      componentId: 'TestComponent',
      selfSize: { raw: rawBytes, gzip: gzipBytes ?? Math.round(rawBytes * 0.3) },
      exclusiveSize: { raw: rawBytes, gzip: gzipBytes ?? Math.round(rawBytes * 0.3) },
      totalSize: { raw: rawBytes, gzip: gzipBytes ?? Math.round(rawBytes * 0.3) },
      chunks: ['main.js'],
    },
  ];
}

// -----------------------------------------------------------
// COST_MODELS
// -----------------------------------------------------------

describe('COST_MODELS', () => {
  it('has entries for vercel, netlify, aws, cloudflare', () => {
    expect(Object.keys(COST_MODELS).sort()).toEqual(['aws', 'cloudflare', 'netlify', 'vercel']);
  });

  it.each(['vercel', 'netlify', 'aws', 'cloudflare'])(
    '%s has expected numeric fields',
    (provider) => {
      const model = COST_MODELS[provider]!;
      expect(model.provider).toBe(provider);
      expect(typeof model.invocationCostPer1M).toBe('number');
      expect(typeof model.bandwidthCostPerGB).toBe('number');
      expect(typeof model.storageCostPerGB).toBe('number');
      expect(typeof model.baseCost).toBe('number');
    },
  );

  it('cloudflare has zero bandwidth cost', () => {
    expect(COST_MODELS['cloudflare']!.bandwidthCostPerGB).toBe(0);
  });

  it('cloudflare has non-zero base cost', () => {
    expect(COST_MODELS['cloudflare']!.baseCost).toBeGreaterThan(0);
  });
});

// -----------------------------------------------------------
// DEFAULT_TRAFFIC
// -----------------------------------------------------------

describe('DEFAULT_TRAFFIC', () => {
  it('has reasonable default values', () => {
    expect(DEFAULT_TRAFFIC.monthlyPageViews).toBeGreaterThan(0);
    expect(DEFAULT_TRAFFIC.invocationsPerPageView).toBeGreaterThan(0);
    expect(DEFAULT_TRAFFIC.edgeRatio).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_TRAFFIC.edgeRatio).toBeLessThanOrEqual(1);
  });
});

// -----------------------------------------------------------
// estimateMonthlyCost
// -----------------------------------------------------------

describe('estimateMonthlyCost', () => {
  it('returns only invocation costs for zero-size bundles (no bandwidth/storage)', () => {
    const model: CostModel = { ...COST_MODELS['vercel']!, baseCost: 0 };
    const cost = estimateMonthlyCost(makeBundleInfo(0, 0), model);
    // With zero bytes, bandwidth and storage are 0, but invocations still cost money
    // since they're based on traffic, not bundle size
    expect(cost).toBeGreaterThanOrEqual(0);

    // Verify it's purely invocation + edge costs (no bandwidth / storage)
    const zeroBandwidthModel: CostModel = {
      provider: 'custom',
      invocationCostPer1M: 0,
      bandwidthCostPerGB: 0,
      storageCostPerGB: 0,
      edgeCostPer1M: 0,
      baseCost: 0,
    };
    const zeroCost = estimateMonthlyCost(makeBundleInfo(0, 0), zeroBandwidthModel);
    expect(zeroCost).toBe(0);
  });

  it('returns a positive number for non-zero bundle', () => {
    const cost = estimateMonthlyCost(makeBundleInfo(500_000), COST_MODELS['vercel']!);
    expect(cost).toBeGreaterThan(0);
  });

  it('includes base cost from the model', () => {
    const baseModel: CostModel = {
      provider: 'custom',
      invocationCostPer1M: 0,
      bandwidthCostPerGB: 0,
      storageCostPerGB: 0,
      baseCost: 42,
    };
    const cost = estimateMonthlyCost(makeBundleInfo(0, 0), baseModel);
    expect(cost).toBe(42);
  });

  it('uses custom traffic profile', () => {
    const lowTraffic: TrafficProfile = {
      monthlyPageViews: 100,
      invocationsPerPageView: 1,
      edgeRatio: 0,
    };
    const highTraffic: TrafficProfile = {
      monthlyPageViews: 10_000_000,
      invocationsPerPageView: 2,
      edgeRatio: 0.5,
    };
    const bundle = makeBundleInfo(1_000_000);
    const lowCost = estimateMonthlyCost(bundle, COST_MODELS['aws']!, lowTraffic);
    const highCost = estimateMonthlyCost(bundle, COST_MODELS['aws']!, highTraffic);
    expect(highCost).toBeGreaterThan(lowCost);
  });

  it('aggregates sizes across multiple components', () => {
    const single = estimateMonthlyCost(makeBundleInfo(100_000), COST_MODELS['vercel']!);
    const double = estimateMonthlyCost(
      [...makeBundleInfo(100_000), ...makeBundleInfo(100_000)],
      COST_MODELS['vercel']!,
    );
    // Double the bundle should cost more (or equal if base-cost dominated)
    expect(double).toBeGreaterThanOrEqual(single);
  });
});

// -----------------------------------------------------------
// estimateCostImpact
// -----------------------------------------------------------

describe('estimateCostImpact', () => {
  it('returns zero delta when bundles are identical', () => {
    const bundle = makeBundleInfo(50_000);
    const impact = estimateCostImpact(bundle, bundle, COST_MODELS['vercel']!);
    expect(impact.monthlyDelta).toBe(0);
    expect(impact.currentMonthlyCost).toBe(impact.projectedMonthlyCost);
    for (const item of impact.breakdown) {
      expect(item.delta).toBe(0);
    }
  });

  it('reports positive delta when bundle size increases', () => {
    const current = makeBundleInfo(50_000);
    const updated = makeBundleInfo(200_000);
    const impact = estimateCostImpact(current, updated, COST_MODELS['vercel']!);
    expect(impact.monthlyDelta).toBeGreaterThan(0);
    expect(impact.projectedMonthlyCost).toBeGreaterThan(impact.currentMonthlyCost);
  });

  it('reports negative delta when bundle size decreases', () => {
    const current = makeBundleInfo(200_000);
    const updated = makeBundleInfo(50_000);
    const impact = estimateCostImpact(current, updated, COST_MODELS['vercel']!);
    expect(impact.monthlyDelta).toBeLessThan(0);
    expect(impact.projectedMonthlyCost).toBeLessThan(impact.currentMonthlyCost);
  });

  it('includes all five breakdown categories', () => {
    const bundle = makeBundleInfo(100_000);
    const impact = estimateCostImpact(bundle, bundle, COST_MODELS['vercel']!);
    const categories = impact.breakdown.map((b) => b.category);
    expect(categories).toEqual(['bandwidth', 'invocations', 'storage', 'edge', 'base']);
  });

  it('base category always has zero delta', () => {
    const current = makeBundleInfo(50_000);
    const updated = makeBundleInfo(500_000);
    const impact = estimateCostImpact(current, updated, COST_MODELS['cloudflare']!);
    const baseItem = impact.breakdown.find((b) => b.category === 'base')!;
    expect(baseItem.delta).toBe(0);
  });

  it('each breakdown item has description', () => {
    const bundle = makeBundleInfo(100_000);
    const impact = estimateCostImpact(bundle, bundle, COST_MODELS['netlify']!);
    for (const item of impact.breakdown) {
      expect(item.description).toBeTruthy();
    }
  });

  it('accepts custom traffic profile', () => {
    const traffic: TrafficProfile = {
      monthlyPageViews: 1_000_000,
      invocationsPerPageView: 3,
      edgeRatio: 0.8,
    };
    const current = makeBundleInfo(100_000);
    const updated = makeBundleInfo(200_000);
    const impact = estimateCostImpact(current, updated, COST_MODELS['aws']!, traffic);
    expect(impact.monthlyDelta).toBeGreaterThan(0);
  });
});
