// ============================================================
// @foxlight/cli — API Check Command
//
// Detect breaking changes in component APIs across commits.
// Prevents shipping API-breaking changes before review.
// ============================================================

import { resolve } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  createAPISnapshot,
  snapshotToJSON,
  snapshotFromJSON,
  compareSnapshots,
  formatAPIChangeSummary,
  type BreakingChange,
  type ComponentAPI,
} from '@foxlight/core';
import { analyzeProject } from '@foxlight/analyzer';
import { ui } from '../utils/output.js';

export interface APICheckOptions {
  root: string;
  json?: boolean;
  save?: boolean;
  baseline?: string;
}

const DEFAULT_SNAPSHOT_PATH = '.foxlight/api-baseline.json';

/**
 * Check for breaking changes in component APIs.
 */
export async function runAPICheck(options: APICheckOptions): Promise<void> {
  const projectRoot = resolve(options.root || '.');
  const snapshotPath = options.baseline || join(projectRoot, DEFAULT_SNAPSHOT_PATH);

  ui.progress('Checking for API breaking changes');

  // Analyze current components
  const analysis = await analyzeProject(projectRoot);
  const currentComponents = analysis.registry.getAllComponents();
  const currentSnapshot = createAPISnapshot(currentComponents);
  ui.progressDone('Analysis complete');

  // Load baseline snapshot if it exists
  let baselineSnapshot;
  if (existsSync(snapshotPath)) {
    try {
      const baselineJson = readFileSync(snapshotPath, 'utf-8');
      baselineSnapshot = snapshotFromJSON(baselineJson);
    } catch {
      ui.warn(`Could not load baseline snapshot from ${snapshotPath}`);
      baselineSnapshot = null;
    }
  }

  if (!baselineSnapshot) {
    if (options.save) {
      // Save current state as baseline
      ui.progress('Creating initial API baseline');
      await writeFile(snapshotPath, snapshotToJSON(currentSnapshot));
      ui.progressDone(`API baseline saved to ${snapshotPath}`);
      ui.gap();
      return;
    } else {
      ui.info('No baseline found.', 'Run with --save to create one.');
      ui.info('Expected baseline at:', snapshotPath);
      ui.gap();
      return;
    }
  }

  // Compare snapshots
  const summary = compareSnapshots(baselineSnapshot, currentSnapshot);

  if (options.json) {
    const output = {
      timestamp: new Date().toISOString(),
      breakingChanges: summary.breaking.map((c: BreakingChange) => ({
        component: c.componentName,
        type: c.changeType,
        severity: c.severity,
        description: c.description,
      })),
      addedComponents: summary.addedComponents.map((c: ComponentAPI) => c.name),
      removedComponents: summary.removedComponents.map((c: ComponentAPI) => c.name),
      totalBreakingChanges: summary.breaking.length,
    };
    console.log(JSON.stringify(output, null, 2));

    if (summary.breaking.length > 0) {
      process.exitCode = 1;
    }
    return;
  }

  // Display formatted report
  console.log(formatAPIChangeSummary(summary));

  // If --save is set, update the baseline
  if (options.save) {
    ui.progress('Updating API baseline');
    await writeFile(snapshotPath, snapshotToJSON(currentSnapshot));
    ui.progressDone('API baseline updated');
  }

  // Fail if there are breaking changes
  if (summary.breaking.length > 0) {
    ui.gap();
    ui.error(`Found ${summary.breaking.length} breaking change(s). Please review before merging.`);
    ui.gap();
    process.exitCode = 1;
  } else {
    ui.gap();
    ui.success('No breaking changes detected.');
    ui.gap();
  }
}
