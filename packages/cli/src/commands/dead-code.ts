// ============================================================
// @foxlight/cli — Dead Code Command
//
// Identify unused components, exports, and dependencies.
// Helps reduce bundle size and maintenance burden.
// ============================================================

import { resolve } from 'node:path';
import {
  detectDeadCode,
  formatDeadCodeReport,
  type UnusedComponent,
  type UnusedExport,
} from '@foxlight/core';
import { analyzeProject } from '@foxlight/analyzer';
import { ui } from '../utils/output.js';

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

  ui.progress('Analyzing codebase for dead code');

  // Analyze the project to get the component registry and dependency graph
  const analysis = await analyzeProject(projectRoot);
  ui.progressDone('Analysis complete');

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
      unusedComponents: report.unusedComponents.map((c: UnusedComponent) => ({
        id: c.id,
        name: c.name,
        filePath: c.filePath,
        reason: c.reason,
        potentialSavings: c.potentialSavings,
      })),
      orphanedComponents: report.orphanedComponents.map((c: UnusedComponent) => ({
        id: c.id,
        name: c.name,
        filePath: c.filePath,
      })),
      unusedExports: report.unusedExports.map((e: UnusedExport) => ({
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
    ui.gap();
    ui.info('Tip:', 'These components can likely be safely removed.');
    ui.info('', 'Run with --json for detailed analysis.');
  }

  const totalIssues =
    report.unusedComponents.length + report.orphanedComponents.length + report.unusedExports.length;

  if (totalIssues === 0) {
    ui.gap();
    ui.success('No dead code detected!');
  } else {
    ui.gap();
    ui.warn(`Found ${totalIssues} potential issues to address.`);
  }
  ui.gap();
}
