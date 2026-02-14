// ============================================================
// @foxlight/core — Cost Estimator
//
// Estimates hosting costs based on bundle size, traffic patterns,
// and provider pricing models. Produces CostImpact reports
// showing the cost delta of code changes.
// ============================================================

import type {
  CostModel,
  CostImpact,
  CostBreakdownItem,
  ComponentBundleInfo,
  SizeInfo,
} from './types.js';

// -----------------------------------------------------------
// Pre-configured cost models for popular providers
// -----------------------------------------------------------

export const COST_MODELS: Record<string, CostModel> = {
  vercel: {
    provider: 'vercel',
    invocationCostPer1M: 0.6,
    bandwidthCostPerGB: 0.15,
    storageCostPerGB: 0.023,
    edgeCostPer1M: 2.0,
    baseCost: 0,
  },
  netlify: {
    provider: 'netlify',
    invocationCostPer1M: 2.0,
    bandwidthCostPerGB: 0.2,
    storageCostPerGB: 0.025,
    baseCost: 0,
  },
  aws: {
    provider: 'aws',
    invocationCostPer1M: 0.2,
    bandwidthCostPerGB: 0.09,
    storageCostPerGB: 0.023,
    edgeCostPer1M: 0.6,
    baseCost: 0,
  },
  cloudflare: {
    provider: 'cloudflare',
    invocationCostPer1M: 0.5,
    bandwidthCostPerGB: 0.0, // Free egress
    storageCostPerGB: 0.015,
    edgeCostPer1M: 0.5,
    baseCost: 5.0,
  },
};

// -----------------------------------------------------------
// Traffic assumptions
// -----------------------------------------------------------

/** Monthly traffic assumptions for cost estimation. */
export interface TrafficProfile {
  /** Monthly page views */
  monthlyPageViews: number;
  /** Average number of SSR/serverless function invocations per page view */
  invocationsPerPageView: number;
  /** Percentage of requests handled at the edge (0-1) */
  edgeRatio: number;
}

export const DEFAULT_TRAFFIC: TrafficProfile = {
  monthlyPageViews: 100_000,
  invocationsPerPageView: 1.5,
  edgeRatio: 0.3,
};

// -----------------------------------------------------------
// Cost estimation
// -----------------------------------------------------------

/**
 * Estimate the monthly cost impact of a change in bundle size.
 *
 * Computes costs based on:
 * - Bandwidth: more bytes served = higher bandwidth cost
 * - Invocations: unchanged (but included for completeness)
 * - Storage: cost of storing assets on CDN/hosting
 * - Edge: edge function invocation costs
 */
export function estimateCostImpact(
  currentBundleInfo: ComponentBundleInfo[],
  updatedBundleInfo: ComponentBundleInfo[],
  costModel: CostModel,
  traffic: TrafficProfile = DEFAULT_TRAFFIC,
): CostImpact {
  const currentTotalSize = aggregateTotalSize(currentBundleInfo);
  const updatedTotalSize = aggregateTotalSize(updatedBundleInfo);

  const currentCosts = computeMonthlyCosts(currentTotalSize, costModel, traffic);
  const updatedCosts = computeMonthlyCosts(updatedTotalSize, costModel, traffic);

  const breakdown: CostBreakdownItem[] = [
    {
      category: 'bandwidth',
      description: `Bandwidth cost for serving ${formatGB(updatedTotalSize.gzip * traffic.monthlyPageViews)} per month`,
      currentCost: currentCosts.bandwidth,
      projectedCost: updatedCosts.bandwidth,
      delta: updatedCosts.bandwidth - currentCosts.bandwidth,
    },
    {
      category: 'invocations',
      description: `${formatNumber(traffic.monthlyPageViews * traffic.invocationsPerPageView)} monthly function invocations`,
      currentCost: currentCosts.invocations,
      projectedCost: updatedCosts.invocations,
      delta: updatedCosts.invocations - currentCosts.invocations,
    },
    {
      category: 'storage',
      description: 'CDN/hosting asset storage',
      currentCost: currentCosts.storage,
      projectedCost: updatedCosts.storage,
      delta: updatedCosts.storage - currentCosts.storage,
    },
    {
      category: 'edge',
      description: `Edge function invocations (${(traffic.edgeRatio * 100).toFixed(0)}% of traffic)`,
      currentCost: currentCosts.edge,
      projectedCost: updatedCosts.edge,
      delta: updatedCosts.edge - currentCosts.edge,
    },
    {
      category: 'base',
      description: 'Base platform cost',
      currentCost: costModel.baseCost,
      projectedCost: costModel.baseCost,
      delta: 0,
    },
  ];

  const currentMonthlyCost =
    Object.values(currentCosts).reduce((a, b) => a + b, 0) + costModel.baseCost;
  const projectedMonthlyCost =
    Object.values(updatedCosts).reduce((a, b) => a + b, 0) + costModel.baseCost;

  return {
    monthlyDelta: projectedMonthlyCost - currentMonthlyCost,
    breakdown,
    currentMonthlyCost,
    projectedMonthlyCost,
  };
}

/**
 * Estimate cost for a single set of bundle info (not a delta).
 */
export function estimateMonthlyCost(
  bundleInfo: ComponentBundleInfo[],
  costModel: CostModel,
  traffic: TrafficProfile = DEFAULT_TRAFFIC,
): number {
  const totalSize = aggregateTotalSize(bundleInfo);
  const costs = computeMonthlyCosts(totalSize, costModel, traffic);
  return Object.values(costs).reduce((a, b) => a + b, 0) + costModel.baseCost;
}

// -----------------------------------------------------------
// Internal helpers
// -----------------------------------------------------------

interface MonthlyCosts {
  bandwidth: number;
  invocations: number;
  storage: number;
  edge: number;
}

function computeMonthlyCosts(
  totalSize: SizeInfo,
  model: CostModel,
  traffic: TrafficProfile,
): MonthlyCosts {
  // Bandwidth: total gzip bytes served per page view × monthly page views → GB → cost
  const monthlyBandwidthGB = (totalSize.gzip * traffic.monthlyPageViews) / (1024 * 1024 * 1024);
  const bandwidth = monthlyBandwidthGB * model.bandwidthCostPerGB;

  // Invocations: page views × invocations per view → millions → cost
  const totalInvocations = traffic.monthlyPageViews * traffic.invocationsPerPageView;
  const invocations = (totalInvocations / 1_000_000) * model.invocationCostPer1M;

  // Storage: total raw asset size in GB
  const storageGB = totalSize.raw / (1024 * 1024 * 1024);
  const storage = storageGB * model.storageCostPerGB;

  // Edge: subset of invocations at the edge
  const edgeInvocations = totalInvocations * traffic.edgeRatio;
  const edge = model.edgeCostPer1M ? (edgeInvocations / 1_000_000) * model.edgeCostPer1M : 0;

  return { bandwidth, invocations, storage, edge };
}

function aggregateTotalSize(bundleInfo: ComponentBundleInfo[]): SizeInfo {
  let raw = 0;
  let gzip = 0;
  for (const info of bundleInfo) {
    raw += info.selfSize.raw;
    gzip += info.selfSize.gzip;
  }
  return { raw, gzip };
}

function formatGB(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(2)} GB`;
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  const kb = bytes / 1024;
  return `${kb.toFixed(0)} KB`;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(Math.round(n));
}
