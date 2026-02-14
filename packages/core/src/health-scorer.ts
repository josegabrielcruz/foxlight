// ============================================================
// @foxlight/core — Health Scorer
//
// Computes component health scores based on the full
// HealthMetrics model: bundleSize, testCoverage, accessibility,
// freshness, performance, and reliability.
//
// Each metric produces a 0-100 score with a severity level.
// The overall score is a weighted average.
// ============================================================

import type {
  ComponentId,
  ComponentInfo,
  ComponentBundleInfo,
  ComponentHealth,
  HealthMetrics,
  MetricScore,
} from './types.js';

// -----------------------------------------------------------
// Thresholds & weights
// -----------------------------------------------------------

/** Default weights for each health metric (must sum to 1). */
export interface HealthWeights {
  bundleSize: number;
  testCoverage: number;
  accessibility: number;
  freshness: number;
  performance: number;
  reliability: number;
}

export const DEFAULT_WEIGHTS: HealthWeights = {
  bundleSize: 0.25,
  testCoverage: 0.2,
  accessibility: 0.15,
  freshness: 0.15,
  performance: 0.15,
  reliability: 0.1,
};

/** Thresholds for bundle size scoring (gzip bytes). */
const BUNDLE_THRESHOLDS = {
  good: 10_240, // ≤10 KB
  warning: 50_240, // ≤50 KB
};

/** Thresholds for test coverage scoring (percentage). */
const COVERAGE_THRESHOLDS = {
  good: 80,
  warning: 50,
};

/** Thresholds for freshness scoring (days since last modification). */
const FRESHNESS_THRESHOLDS = {
  good: 90, // Modified within 90 days
  warning: 365, // Modified within a year
};

// -----------------------------------------------------------
// Input data for health scoring
// -----------------------------------------------------------

/** All available data for computing a component's health. */
export interface HealthInput {
  component: ComponentInfo;
  bundleInfo?: ComponentBundleInfo;
  /** Test coverage percentage (0-100) */
  testCoverage?: number;
  /** Accessibility score (0-100, e.g., from axe-core) */
  accessibilityScore?: number;
  /** Days since the component was last modified */
  daysSinceModified?: number;
  /** Average render time in milliseconds */
  renderTimeMs?: number;
  /** Error rate (0-1, e.g., 0.02 = 2% error rate) */
  errorRate?: number;
}

// -----------------------------------------------------------
// Scoring functions
// -----------------------------------------------------------

/**
 * Compute the full health score for a component.
 */
export function computeComponentHealth(
  input: HealthInput,
  weights: HealthWeights = DEFAULT_WEIGHTS,
): ComponentHealth {
  const metrics = computeMetrics(input);
  const score = computeOverallScore(metrics, weights);

  return {
    componentId: input.component.id,
    score,
    metrics,
    computedAt: new Date().toISOString(),
  };
}

/**
 * Compute health scores for multiple components.
 */
export function computeAllHealth(
  inputs: HealthInput[],
  weights: HealthWeights = DEFAULT_WEIGHTS,
): ComponentHealth[] {
  return inputs.map((input) => computeComponentHealth(input, weights));
}

/**
 * Compute individual metric scores.
 */
function computeMetrics(input: HealthInput): HealthMetrics {
  return {
    bundleSize: scoreBundleSize(input.bundleInfo),
    testCoverage: scoreTestCoverage(input.testCoverage),
    accessibility: scoreAccessibility(input.accessibilityScore),
    freshness: scoreFreshness(input.daysSinceModified),
    performance: scorePerformance(input.renderTimeMs),
    reliability: scoreReliability(input.errorRate),
  };
}

/**
 * Compute the weighted overall score from individual metrics.
 */
function computeOverallScore(metrics: HealthMetrics, weights: HealthWeights): number {
  const weighted =
    metrics.bundleSize.score * weights.bundleSize +
    metrics.testCoverage.score * weights.testCoverage +
    metrics.accessibility.score * weights.accessibility +
    metrics.freshness.score * weights.freshness +
    metrics.performance.score * weights.performance +
    metrics.reliability.score * weights.reliability;

  return Math.round(weighted);
}

// -----------------------------------------------------------
// Individual metric scorers
// -----------------------------------------------------------

function scoreBundleSize(bundleInfo?: ComponentBundleInfo): MetricScore {
  if (!bundleInfo) {
    return {
      score: 50,
      value: 'unknown',
      label: 'Bundle size not measured',
      level: 'warning',
    };
  }

  const gzipBytes = bundleInfo.selfSize.gzip;
  const score =
    gzipBytes <= BUNDLE_THRESHOLDS.good
      ? 100
      : gzipBytes <= BUNDLE_THRESHOLDS.warning
        ? Math.round(
            100 -
              ((gzipBytes - BUNDLE_THRESHOLDS.good) /
                (BUNDLE_THRESHOLDS.warning - BUNDLE_THRESHOLDS.good)) *
                50,
          )
        : Math.max(
            0,
            Math.round(
              50 - ((gzipBytes - BUNDLE_THRESHOLDS.warning) / BUNDLE_THRESHOLDS.warning) * 50,
            ),
          );

  return {
    score,
    value: formatBytesCompact(gzipBytes),
    label: 'Gzip size',
    level: levelFromScore(score),
  };
}

function scoreTestCoverage(coverage?: number): MetricScore {
  if (coverage === undefined) {
    return {
      score: 0,
      value: 'no data',
      label: 'Test coverage not available',
      level: 'critical',
    };
  }

  const clamped = Math.max(0, Math.min(100, coverage));
  return {
    score: Math.round(clamped),
    value: `${clamped.toFixed(0)}%`,
    label: 'Test coverage',
    level:
      clamped >= COVERAGE_THRESHOLDS.good
        ? 'good'
        : clamped >= COVERAGE_THRESHOLDS.warning
          ? 'warning'
          : 'critical',
  };
}

function scoreAccessibility(a11yScore?: number): MetricScore {
  if (a11yScore === undefined) {
    return {
      score: 50,
      value: 'not scanned',
      label: 'Accessibility not measured',
      level: 'warning',
    };
  }

  const clamped = Math.max(0, Math.min(100, a11yScore));
  return {
    score: Math.round(clamped),
    value: `${clamped.toFixed(0)}/100`,
    label: 'Accessibility score',
    level: levelFromScore(Math.round(clamped)),
  };
}

function scoreFreshness(daysSinceModified?: number): MetricScore {
  if (daysSinceModified === undefined) {
    return {
      score: 50,
      value: 'unknown',
      label: 'Last modification date unknown',
      level: 'warning',
    };
  }

  const score =
    daysSinceModified <= FRESHNESS_THRESHOLDS.good
      ? 100
      : daysSinceModified <= FRESHNESS_THRESHOLDS.warning
        ? Math.round(
            100 -
              ((daysSinceModified - FRESHNESS_THRESHOLDS.good) /
                (FRESHNESS_THRESHOLDS.warning - FRESHNESS_THRESHOLDS.good)) *
                50,
          )
        : Math.max(
            0,
            Math.round(
              50 -
                ((daysSinceModified - FRESHNESS_THRESHOLDS.warning) /
                  FRESHNESS_THRESHOLDS.warning) *
                  50,
            ),
          );

  return {
    score,
    value: daysSinceModified <= 1 ? 'today' : `${daysSinceModified}d ago`,
    label: 'Last modified',
    level: levelFromScore(score),
  };
}

function scorePerformance(renderTimeMs?: number): MetricScore {
  if (renderTimeMs === undefined) {
    return {
      score: 50,
      value: 'not profiled',
      label: 'Render performance not measured',
      level: 'warning',
    };
  }

  // Scoring: ≤16ms = perfect (one frame), ≤50ms = good, ≤200ms = warning, >200ms = critical
  const score =
    renderTimeMs <= 16
      ? 100
      : renderTimeMs <= 50
        ? Math.round(100 - ((renderTimeMs - 16) / 34) * 20)
        : renderTimeMs <= 200
          ? Math.round(80 - ((renderTimeMs - 50) / 150) * 50)
          : Math.max(0, Math.round(30 - ((renderTimeMs - 200) / 500) * 30));

  return {
    score,
    value: `${renderTimeMs.toFixed(0)}ms`,
    label: 'Render time',
    level: levelFromScore(score),
  };
}

function scoreReliability(errorRate?: number): MetricScore {
  if (errorRate === undefined) {
    return {
      score: 50,
      value: 'no data',
      label: 'Error rate not tracked',
      level: 'warning',
    };
  }

  // Scoring: 0% = 100, ≤1% = good, ≤5% = warning, >5% = critical
  const pct = errorRate * 100;
  const score =
    pct <= 0
      ? 100
      : pct <= 1
        ? Math.round(100 - pct * 20)
        : pct <= 5
          ? Math.round(80 - ((pct - 1) / 4) * 50)
          : Math.max(0, Math.round(30 - ((pct - 5) / 10) * 30));

  return {
    score,
    value: `${pct.toFixed(2)}%`,
    label: 'Error rate',
    level: levelFromScore(score),
  };
}

// -----------------------------------------------------------
// Helpers
// -----------------------------------------------------------

function levelFromScore(score: number): 'good' | 'warning' | 'critical' {
  if (score >= 80) return 'good';
  if (score >= 50) return 'warning';
  return 'critical';
}

function formatBytesCompact(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2)} ${units[i]}`;
}
