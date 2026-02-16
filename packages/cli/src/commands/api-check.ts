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
} from '@foxlight/core';
import { analyzeProject } from '@foxlight/analyzer';

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

  console.log('🔍 Checking for API breaking changes...\n');

  // Analyze current components
  const analysis = await analyzeProject(projectRoot);
  const currentComponents = analysis.registry.getAllComponents();
  const currentSnapshot = createAPISnapshot(currentComponents);

  // Load baseline snapshot if it exists
  let baselineSnapshot;
  if (existsSync(snapshotPath)) {
    try {
      const baselineJson = readFileSync(snapshotPath, 'utf-8');
      baselineSnapshot = snapshotFromJSON(baselineJson);
    } catch {
      console.log(`⚠️  Could not load baseline snapshot from ${snapshotPath}`);
      baselineSnapshot = null;
    }
  }

  if (!baselineSnapshot) {
    if (options.save) {
      // Save current state as baseline
      console.log('📸 Creating initial API baseline...');
      await writeFile(snapshotPath, snapshotToJSON(currentSnapshot));
      console.log(`✅ API baseline saved to ${snapshotPath}\n`);
      return;
    } else {
      console.log('ℹ️  No baseline found. Run with --save to create one.');
      console.log(`Expected baseline at: ${snapshotPath}\n`);
      return;
    }
  }

  // Compare snapshots
  const summary = compareSnapshots(baselineSnapshot, currentSnapshot);

  if (options.json) {
    const output = {
      timestamp: new Date().toISOString(),
      breakingChanges: summary.breaking.map((c) => ({
        component: c.componentName,
        type: c.changeType,
        severity: c.severity,
        description: c.description,
      })),
      addedComponents: summary.addedComponents.map((c) => c.name),
      removedComponents: summary.removedComponents.map((c) => c.name),
      totalBreakingChanges: summary.breaking.length,
    };
    console.log(JSON.stringify(output, null, 2));

    if (summary.breaking.length > 0) {
      process.exit(1);
    }
    return;
  }

  // Display formatted report
  console.log(formatAPIChangeSummary(summary));

  // If --save is set, update the baseline
  if (options.save) {
    console.log('\n📸 Updating API baseline...');
    await writeFile(snapshotPath, snapshotToJSON(currentSnapshot));
    console.log(`✅ API baseline updated\n`);
  }

  // Fail if there are breaking changes
  if (summary.breaking.length > 0) {
    console.log(
      `\n❌ Found ${summary.breaking.length} breaking change(s). Please review before merging.\n`,
    );
    process.exit(1);
  } else {
    console.log('\n✅ No breaking changes detected.\n');
  }
}
