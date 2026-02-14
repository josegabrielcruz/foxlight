// ============================================================
// @foxlight/cli — Health command
//
// Displays the component health dashboard in the terminal.
// Shows scores for bundle size, test coverage, accessibility,
// freshness, performance, and reliability.
// ============================================================

import { analyzeProject } from '@foxlight/analyzer';
import { computeComponentHealth, type HealthInput, type ComponentHealth } from '@foxlight/core';
import { ui } from '../utils/output.js';

export interface HealthOptions {
  rootDir: string;
  json?: boolean;
  component?: string;
}

export async function runHealth(options: HealthOptions): Promise<void> {
  const { rootDir, json, component } = options;

  ui.progress('Analyzing project health');
  const result = await analyzeProject(rootDir);
  ui.progressDone('Analysis complete');

  const components = result.registry.getAllComponents();

  if (components.length === 0) {
    ui.warn('No components found. Run `foxlight analyze` to check your config.');
    return;
  }

  // Compute health scores using the full health scorer
  const healthResults: ComponentHealth[] = components.map((comp) => {
    const bundleInfo = result.registry.getBundleInfo(comp.id);

    const input: HealthInput = {
      component: comp,
      bundleInfo: bundleInfo ?? undefined,
      // Test coverage, accessibility, freshness, performance, and reliability
      // require external data sources. They will show as "not available"
      // until integrations are configured.
    };

    return computeComponentHealth(input);
  });

  if (json) {
    console.log(JSON.stringify(healthResults, null, 2));
    return;
  }

  // Filter to single component if specified
  const display = component
    ? healthResults.filter((h) => {
        const comp = result.registry.getComponent(h.componentId);
        return (
          comp?.name.toLowerCase() === component.toLowerCase() ||
          h.componentId.toLowerCase().includes(component.toLowerCase())
        );
      })
    : healthResults;

  if (display.length === 0) {
    ui.error(`Component "${component}" not found.`);
    return;
  }

  ui.heading('Component Health Dashboard');

  const widths = [22, 8, 10, 10, 10, 10, 10];
  ui.tableHeader(['Component', 'Score', 'Bundle', 'Tests', 'A11y', 'Fresh', 'Perf'], widths);

  // Sort by score (worst first)
  const sorted = [...display].sort((a, b) => a.score - b.score);

  for (const h of sorted) {
    const comp = result.registry.getComponent(h.componentId);
    const name = comp?.name ?? h.componentId;
    ui.row(
      [
        name,
        ui.healthScore(h.score),
        ui.healthScore(h.metrics.bundleSize.score),
        ui.healthScore(h.metrics.testCoverage.score),
        ui.healthScore(h.metrics.accessibility.score),
        ui.healthScore(h.metrics.freshness.score),
        ui.healthScore(h.metrics.performance.score),
      ],
      widths,
    );
  }

  // Summary
  const avgScore = display.reduce((sum, h) => sum + h.score, 0) / display.length;
  const critical = display.filter((h) => h.score < 50).length;
  const warning = display.filter((h) => h.score >= 50 && h.score < 80).length;
  const healthy = display.filter((h) => h.score >= 80).length;

  ui.heading('Summary');
  ui.info('Average health score:', ui.healthScore(Math.round(avgScore)));
  ui.success(`${healthy} healthy`);
  if (warning > 0) ui.warn(`${warning} need attention`);
  if (critical > 0) ui.error(`${critical} critical`);

  ui.gap();
  ui.info('Tip:', 'Integrate test coverage, accessibility, and performance data for full scoring.');
  ui.gap();
}
