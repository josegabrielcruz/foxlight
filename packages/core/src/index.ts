// @foxlight/core — Public API
export {
  // Types
  type ComponentId,
  type Framework,
  type ExportKind,
  type ComponentInfo,
  type PropInfo,
  type ImportEdge,
  type ImportSpecifier,
  type SizeInfo,
  type ComponentBundleInfo,
  type ComponentHealth,
  type HealthMetrics,
  type MetricScore,
  type CostModel,
  type CostImpact,
  type CostBreakdownItem,
  type UpgradePreview,
  type UpgradeCheck,
  type FoxlightConfig,
  type BaselineConfig,
  type PluginConfig,
  type ProjectSnapshot,
  type SnapshotDiff,
  type ComponentModification,
  type BundleDiffEntry,
  type HealthDiffEntry,
} from './types.js';

export { ComponentRegistry } from './registry.js';
export { DependencyGraph } from './dependency-graph.js';
export { loadConfig, createDefaultConfig, detectFramework } from './config.js';
export { computeComponentHealth, computeAllHealth, DEFAULT_WEIGHTS } from './health-scorer.js';
export type { HealthInput, HealthWeights } from './health-scorer.js';

export {
  estimateCostImpact,
  estimateMonthlyCost,
  COST_MODELS,
  DEFAULT_TRAFFIC,
} from './cost-estimator.js';
export type { TrafficProfile } from './cost-estimator.js';

export { analyzeUpgrade, analyzeUpgrades } from './upgrade-analyzer.js';
export type { UpgradeAnalysisOptions } from './upgrade-analyzer.js';

export { extractImportsFromScript } from './import-parser.js';
