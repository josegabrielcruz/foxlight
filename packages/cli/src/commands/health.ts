// ============================================================
// @pulse/cli — Health command
//
// Displays the component health dashboard in the terminal.
// Shows scores for bundle size, test coverage, accessibility,
// freshness, performance, and reliability.
// ============================================================

import { analyzeProject } from "@pulse/analyzer";
import { ui } from "../utils/output.js";

export interface HealthOptions {
  rootDir: string;
  json?: boolean;
  component?: string;
}

export async function runHealth(options: HealthOptions): Promise<void> {
  const { rootDir, json, component } = options;

  ui.progress("Analyzing project health");
  const result = await analyzeProject(rootDir);
  ui.progressDone("Analysis complete");

  const components = result.registry.getAllComponents();

  if (components.length === 0) {
    ui.warn("No components found. Run `pulse analyze` to check your config.");
    return;
  }

  // Compute basic health scores from available data
  // (Full health scoring will integrate with bundle, test coverage, etc.)
  const healthData = components.map((comp) => {
    const childCount = comp.children.length;
    const propCount = comp.props.length;
    const depCount = comp.dependencies.length;

    // Simplified scoring (real implementation will use actual metrics)
    const complexityScore = Math.max(0, 100 - childCount * 5 - depCount * 10);
    const apiScore = Math.min(100, propCount > 0 ? 80 : 50);

    const overall = Math.round((complexityScore + apiScore) / 2);

    return {
      name: comp.name,
      id: comp.id,
      overall,
      complexity: complexityScore,
      api: apiScore,
      children: childCount,
      deps: depCount,
      props: propCount,
    };
  });

  if (json) {
    console.log(JSON.stringify(healthData, null, 2));
    return;
  }

  // Filter to single component if specified
  const display = component
    ? healthData.filter(
        (h) =>
          h.name.toLowerCase() === component.toLowerCase() ||
          h.id.toLowerCase().includes(component.toLowerCase())
      )
    : healthData;

  if (display.length === 0) {
    ui.error(`Component "${component}" not found.`);
    return;
  }

  ui.heading("Component Health Dashboard");

  const widths = [25, 10, 12, 10, 8, 8];
  ui.tableHeader(
    ["Component", "Score", "Complexity", "API", "Deps", "Children"],
    widths
  );

  // Sort by score (worst first)
  const sorted = [...display].sort((a, b) => a.overall - b.overall);

  for (const h of sorted) {
    ui.row(
      [
        h.name,
        ui.healthScore(h.overall),
        String(h.complexity),
        String(h.api),
        String(h.deps),
        String(h.children),
      ],
      widths
    );
  }

  // Summary
  const avgScore =
    display.reduce((sum, h) => sum + h.overall, 0) / display.length;
  const critical = display.filter((h) => h.overall < 50).length;
  const warning = display.filter(
    (h) => h.overall >= 50 && h.overall < 80
  ).length;
  const healthy = display.filter((h) => h.overall >= 80).length;

  ui.heading("Summary");
  ui.info("Average health score:", ui.healthScore(Math.round(avgScore)));
  ui.success(`${healthy} healthy`);
  if (warning > 0) ui.warn(`${warning} need attention`);
  if (critical > 0) ui.error(`${critical} critical`);

  ui.gap();
}
