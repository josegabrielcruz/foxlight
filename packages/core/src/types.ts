// ============================================================
// @foxlight/core — Type definitions
//
// These types form the shared data layer for the entire Foxlight
// platform. Every package depends on these types.
// ============================================================

// -----------------------------------------------------------
// Component identity & metadata
// -----------------------------------------------------------

/** Unique identifier for a component within a project. */
export type ComponentId = string;

/** The front-end framework a component belongs to. */
export type Framework =
  | 'react'
  | 'vue'
  | 'svelte'
  | 'angular'
  | 'web-component'
  | 'unknown';

/** How a component is exported from its module. */
export type ExportKind = 'named' | 'default' | 're-export';

/**
 * Core representation of a UI component discovered in the codebase.
 * This is the central entity that all Foxlight tools operate on.
 */
export interface ComponentInfo {
  /** Stable identifier (typically: filePath#componentName) */
  id: ComponentId;
  /** Human-readable component name (e.g. "DataTable") */
  name: string;
  /** Absolute file path where the component is defined */
  filePath: string;
  /** Line number where the component definition starts */
  line: number;
  /** Detected framework */
  framework: Framework;
  /** How the component is exported */
  exportKind: ExportKind;
  /** Props / inputs the component accepts */
  props: PropInfo[];
  /** Components this component renders (children in the tree) */
  children: ComponentId[];
  /** Components that render this component (parents in the tree) */
  usedBy: ComponentId[];
  /** npm packages this component directly imports */
  dependencies: string[];
  /** Custom metadata that plugins can attach */
  metadata: Record<string, unknown>;
}

/**
 * A single prop / input on a component.
 */
export interface PropInfo {
  /** Prop name */
  name: string;
  /** TypeScript type as a string (e.g. "string", "() => void") */
  type: string;
  /** Whether the prop is required */
  required: boolean;
  /** Default value expression, if any */
  defaultValue?: string;
  /** JSDoc / comment description */
  description?: string;
}

// -----------------------------------------------------------
// Dependency graph
// -----------------------------------------------------------

/** An edge in the import graph between two modules. */
export interface ImportEdge {
  /** Absolute path of the importing module */
  source: string;
  /** Absolute path or package name of the imported module */
  target: string;
  /** The specific symbols imported */
  specifiers: ImportSpecifier[];
  /** Whether this is a type-only import */
  typeOnly: boolean;
}

export interface ImportSpecifier {
  /** Imported name (or "default" / "*") */
  imported: string;
  /** Local alias, if renamed */
  local: string;
}

// -----------------------------------------------------------
// Bundle analysis
// -----------------------------------------------------------

/** Size information for a single module or component. */
export interface SizeInfo {
  /** Raw (uncompressed) size in bytes */
  raw: number;
  /** Gzipped size in bytes */
  gzip: number;
  /** Brotli-compressed size in bytes */
  brotli?: number;
}

/** Bundle contribution for a single component. */
export interface ComponentBundleInfo {
  componentId: ComponentId;
  /** Size of the component's own code */
  selfSize: SizeInfo;
  /** Size including all unique dependencies (not shared with other components) */
  exclusiveSize: SizeInfo;
  /** Total size including all dependencies (including shared) */
  totalSize: SizeInfo;
  /** The chunk(s) this component ends up in */
  chunks: string[];
}

// -----------------------------------------------------------
// Health metrics
// -----------------------------------------------------------

/** Aggregated health score for a component. */
export interface ComponentHealth {
  componentId: ComponentId;
  /** Overall health score 0-100 */
  score: number;
  /** Individual metric scores */
  metrics: HealthMetrics;
  /** When these metrics were last computed */
  computedAt: string;
}

export interface HealthMetrics {
  /** Bundle size score (smaller = better) */
  bundleSize: MetricScore;
  /** Test coverage score */
  testCoverage: MetricScore;
  /** Accessibility score (from axe-core scans) */
  accessibility: MetricScore;
  /** Code staleness (recently modified = better) */
  freshness: MetricScore;
  /** Runtime performance (render time) */
  performance: MetricScore;
  /** Error rate in production */
  reliability: MetricScore;
}

export interface MetricScore {
  /** Score 0-100 */
  score: number;
  /** Raw value (e.g. "45KB", "87%", "120ms") */
  value: string;
  /** Human-readable label */
  label: string;
  /** Severity level */
  level: 'good' | 'warning' | 'critical';
}

// -----------------------------------------------------------
// Cost estimation
// -----------------------------------------------------------

/** Cost model for a hosting provider. */
export interface CostModel {
  provider: 'vercel' | 'netlify' | 'aws' | 'cloudflare' | 'custom';
  /** Cost per 1M function invocations (USD) */
  invocationCostPer1M: number;
  /** Cost per GB bandwidth (USD) */
  bandwidthCostPerGB: number;
  /** Cost per GB storage (USD/month) */
  storageCostPerGB: number;
  /** Cost per 1M edge function invocations */
  edgeCostPer1M?: number;
  /** Base monthly cost (USD) */
  baseCost: number;
}

/** Cost impact estimate for a code change. */
export interface CostImpact {
  /** Estimated monthly cost delta (USD) */
  monthlyDelta: number;
  /** Breakdown by cost category */
  breakdown: CostBreakdownItem[];
  /** Current estimated monthly cost */
  currentMonthlyCost: number;
  /** Projected monthly cost after change */
  projectedMonthlyCost: number;
}

export interface CostBreakdownItem {
  category: 'invocations' | 'bandwidth' | 'storage' | 'edge' | 'base';
  description: string;
  currentCost: number;
  projectedCost: number;
  delta: number;
}

// -----------------------------------------------------------
// Upgrade analysis
// -----------------------------------------------------------

/** Result of analyzing a dependency upgrade. */
export interface UpgradePreview {
  /** Package being upgraded */
  packageName: string;
  /** Current version */
  fromVersion: string;
  /** Target version */
  toVersion: string;
  /** Risk assessment */
  risk: 'low' | 'medium' | 'high';
  /** Individual checks that were run */
  checks: UpgradeCheck[];
}

export interface UpgradeCheck {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  summary: string;
  details?: string;
}

// -----------------------------------------------------------
// Project configuration
// -----------------------------------------------------------

/** User-facing configuration (foxlight.config.ts). */
export interface FoxlightConfig {
  /** Root directory of the project */
  rootDir: string;
  /** Glob patterns for source files to analyze */
  include: string[];
  /** Glob patterns to exclude */
  exclude: string[];
  /** Framework hint (auto-detected if omitted) */
  framework?: Framework;
  /** Storybook config path, if applicable */
  storybook?: string;
  /** Cost model configuration */
  costModel?: CostModel;
  /** Baseline storage config for visual regression */
  baselines?: BaselineConfig;
  /** Plugin configurations */
  plugins?: PluginConfig[];
}

export interface BaselineConfig {
  /** Storage provider */
  provider: 's3' | 'gcs' | 'r2' | 'local' | 'git-lfs';
  /** Bucket or directory name */
  bucket: string;
  /** Optional prefix / path within the bucket */
  prefix?: string;
  /** Region (for cloud storage) */
  region?: string;
}

export interface PluginConfig {
  name: string;
  options?: Record<string, unknown>;
}

// -----------------------------------------------------------
// Snapshot & diff (for visual + data comparisons)
// -----------------------------------------------------------

/** A point-in-time snapshot of the entire project analysis. */
export interface ProjectSnapshot {
  /** Unique snapshot ID */
  id: string;
  /** Git commit SHA */
  commitSha: string;
  /** Git branch */
  branch: string;
  /** When the snapshot was created */
  createdAt: string;
  /** All discovered components */
  components: ComponentInfo[];
  /** Import graph edges */
  imports: ImportEdge[];
  /** Bundle info per component */
  bundleInfo: ComponentBundleInfo[];
  /** Health scores */
  health: ComponentHealth[];
}

/** Diff between two snapshots. */
export interface SnapshotDiff {
  base: { id: string; commitSha: string };
  head: { id: string; commitSha: string };
  components: {
    added: ComponentInfo[];
    removed: ComponentInfo[];
    modified: ComponentModification[];
  };
  bundleDiff: BundleDiffEntry[];
  healthDiff: HealthDiffEntry[];
}

export interface ComponentModification {
  componentId: ComponentId;
  changes: string[];
  propsAdded: string[];
  propsRemoved: string[];
  propsModified: string[];
}

export interface BundleDiffEntry {
  componentId: ComponentId;
  before: SizeInfo;
  after: SizeInfo;
  delta: SizeInfo;
}

export interface HealthDiffEntry {
  componentId: ComponentId;
  beforeScore: number;
  afterScore: number;
  delta: number;
}
