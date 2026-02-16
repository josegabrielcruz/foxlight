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
} from '@foxlight/core';

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
    console.log('❌ No coverage data found.');
    console.log('Make sure you have generated coverage with a tool like:');
    console.log('  npm test -- --coverage (Jest/Vitest)');
    console.log('  npx nyc npm test');
    process.exit(1);
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
      components: Array.from(coverage.components.values()).map((c) => ({
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
  console.log('\n📊 Test Coverage Report\n');
  console.log(summarizeCoverage(coverage));

  // Show uncovered components
  const uncovered = findUncoveredComponents(coverage);
  if (uncovered.length > 0) {
    console.log(`\n❌ Uncovered Components (${uncovered.length}):`);
    for (const comp of uncovered.slice(0, 10)) {
      console.log(`  - ${comp.filePath}`);
    }
    if (uncovered.length > 10) {
      console.log(`  ... and ${uncovered.length - 10} more`);
    }
  }

  // Show low coverage components
  const threshold = options.threshold || 50;
  const lowCoverage = findLowCoverageComponents(coverage, threshold);
  if (lowCoverage.length > 0) {
    console.log(`\n⚠️  Low Coverage (<${threshold}%) (${lowCoverage.length}):`);
    for (const comp of lowCoverage.slice(0, 15)) {
      console.log(`  ${comp.filePath}: ${comp.percentage}%`);
    }
    if (lowCoverage.length > 15) {
      console.log(`  ... and ${lowCoverage.length - 15} more\n`);
    }
  }

  // Exit with error if coverage falls below threshold
  if (coverage.overallPercentage < threshold) {
    console.log(`\n❌ Coverage ${coverage.overallPercentage}% is below threshold ${threshold}%`);
    process.exit(1);
  }

  console.log('');
}
