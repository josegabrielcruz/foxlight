// ============================================================
// @foxlight/cli — Dead Code Command
//
// Identify unused components, exports, and dependencies.
// Helps reduce bundle size and maintenance burden.
// ============================================================

import { resolve } from 'node:path';
import { detectDeadCode, formatDeadCodeReport } from '@foxlight/core';
import { analyzeProject } from '@foxlight/analyzer';

export interface DeadCodeOptions {
  root: string;
  json?: boolean;
  threshold?: number;
}

/**
 * Analyze codebase for unused components and code.
 */
export async function runDeadCodeDetection(options: DeadCodeOptions): Promise<void> {
  const projectRoot = resolve(options.root || '.');

  console.log('🔍 Analyzing codebase for dead code...\n');

  // Analyze the project to get the component registry and dependency graph
  const analysis = await analyzeProject(projectRoot);

  // Detect dead code
  const report = detectDeadCode(analysis.registry);

  if (options.json) {
    // Output machine-readable format
    const output = {
      timestamp: new Date().toISOString(),
      summary: {
        unusedComponents: report.unusedComponents.length,
        orphanedComponents: report.orphanedComponents.length,
        unusedExports: report.unusedExports.length,
        potentialSavingsBytes: report.totalPotentialBytes,
      },
      unusedComponents: report.unusedComponents.map((c) => ({
        id: c.id,
        name: c.name,
        filePath: c.filePath,
        reason: c.reason,
        potentialSavings: c.potentialSavings,
      })),
      orphanedComponents: report.orphanedComponents.map((c) => ({
        id: c.id,
        name: c.name,
        filePath: c.filePath,
      })),
      unusedExports: report.unusedExports.map((e) => ({
        filePath: e.filePath,
        exportName: e.exportName,
        reason: e.reason,
      })),
    };
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  // Display formatted report
  console.log(formatDeadCodeReport(report));

  if (report.unusedComponents.length > 0) {
    console.log('\n💡 Tip: These components can likely be safely removed.');
    console.log('Run with --json for detailed analysis.');
  }

  const totalIssues =
    report.unusedComponents.length + report.orphanedComponents.length + report.unusedExports.length;

  if (totalIssues === 0) {
    console.log('\n✅ No dead code detected!');
  } else {
    console.log(`\n⚠️  Found ${totalIssues} potential issues to address.\n`);
  }
}
