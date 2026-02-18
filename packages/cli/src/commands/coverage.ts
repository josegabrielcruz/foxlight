// ============================================================
// @foxlight/cli — Coverage Command
//
// Display per-component test coverage and identify gaps.
// Integrates with tools like Jest, Vitest, and nyc.
// ============================================================

import { resolve } from 'node:path';
import {
  loadCoverageData,
  mapCoverageToComponents,
  findUncoveredComponents,
  findLowCoverageComponents,
  summarizeCoverage,
  type ComponentCoverage,
} from '@foxlight/core';
import { ui } from '../utils/output.js';

export interface CoverageOptions {
  root: string;
  json?: boolean;
  threshold?: number;
  coveragePath?: string;
}

/**
 * Display component test coverage report.
 */
export async function runCoverage(options: CoverageOptions): Promise<void> {
  const projectRoot = resolve(options.root || '.');

  // Load coverage data from Istanbul format
  const coverageData = await loadCoverageData(projectRoot, options.coveragePath);

  if (Object.keys(coverageData).length === 0) {
    ui.error('No coverage data found.');
    ui.info('Make sure you have generated coverage with a tool like:', '');
    ui.info('  npm test -- --coverage', '(Jest/Vitest)');
    ui.info('  npx nyc npm test', '');
    process.exitCode = 1;
    return;
  }

  // For now, we'll use filePaths from coverage data since we'd need the full registry
  // to properly map them to components. This is a simplified version.
  const componentFilePaths = new Set(Object.keys(coverageData));
  const coverage = mapCoverageToComponents(coverageData, componentFilePaths);

  if (options.json) {
    // Output machine-readable format
    const output = {
      timestamp: new Date().toISOString(),
      overall: coverage.overallPercentage,
      components: Array.from(coverage.components.values()).map((c: ComponentCoverage) => ({
        filePath: c.filePath,
        coverage: c.percentage,
        statements: {
          covered: c.statementsCovered,
          total: c.statementsTotal,
        },
        functions: {
          covered: c.functionsCovered,
          total: c.functionsTotal,
        },
      })),
    };
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  // Display summary
  ui.heading('Test Coverage Report');
  console.log(summarizeCoverage(coverage));

  // Show uncovered components
  const uncovered = findUncoveredComponents(coverage);
  if (uncovered.length > 0) {
    ui.heading(`Uncovered Components (${uncovered.length})`);
    for (const comp of uncovered.slice(0, 10)) {
      ui.error(comp.filePath);
    }
    if (uncovered.length > 10) {
      ui.info('', `...and ${uncovered.length - 10} more`);
    }
  }

  // Show low coverage components
  const threshold = options.threshold || 50;
  const lowCoverage = findLowCoverageComponents(coverage, threshold);
  if (lowCoverage.length > 0) {
    ui.heading(`Low Coverage (<${threshold}%) (${lowCoverage.length})`);
    for (const comp of lowCoverage.slice(0, 15)) {
      ui.warn(`${comp.filePath}: ${comp.percentage}%`);
    }
    if (lowCoverage.length > 15) {
      ui.info('', `...and ${lowCoverage.length - 15} more`);
    }
  }

  // Exit with error if coverage falls below threshold
  if (coverage.overallPercentage < threshold) {
    ui.gap();
    ui.error(`Coverage ${coverage.overallPercentage}% is below threshold ${threshold}%`);
    process.exitCode = 1;
    return;
  }

  ui.gap();
}
