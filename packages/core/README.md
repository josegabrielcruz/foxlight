# @foxlight/core

Shared data layer for [Foxlight](https://github.com/josegabrielcruz/foxlight) — the open-source front-end intelligence platform.

## What's Inside

- **Component Registry** — stores and queries component metadata, props, relationships, bundle info, and health scores
- **Dependency Graph** — directed graph with cycle detection, topological sort, and impact analysis
- **Health Scorer** — 6-metric weighted scoring system (bundle size, test coverage, accessibility, freshness, performance, reliability)
- **Cost Estimator** — hosting cost estimation with pre-configured models for Vercel, Netlify, AWS, and Cloudflare
- **Upgrade Analyzer** — dependency upgrade impact analysis (semver risk, peer deps, deprecation)
- **Config Loader** — loads `.foxlight.json` config with framework auto-detection

## Installation

```bash
npm install @foxlight/core
```

## Usage

```typescript
import {
  ComponentRegistry,
  DependencyGraph,
  computeComponentHealth,
  estimateCostImpact,
  COST_MODELS,
  loadConfig,
} from '@foxlight/core';

// Create a registry and add components
const registry = new ComponentRegistry();
registry.addComponents([{ id: 'Button', name: 'Button', /* ... */ }]);

// Build a dependency graph from imports
const graph = DependencyGraph.fromImports(imports);
const cycles = graph.detectCycles();

// Score component health
const health = computeComponentHealth({
  component: myComponent,
  bundleInfo: myBundleInfo,
  testCoverage: 85,
});

// Estimate hosting costs
const cost = estimateCostImpact(
  currentBundles,
  updatedBundles,
  COST_MODELS.vercel,
);
```

## License

MIT
