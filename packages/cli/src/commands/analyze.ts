// ============================================================
// @foxlight/cli — Analyze command
//
// Scans the project, discovers components, and prints a
// summary of what was found. Results are automatically saved
// as snapshots in .foxlight/snapshots/ for dashboard viewing.
// ============================================================

import { analyzeProject } from '@foxlight/analyzer';
import { SnapshotStore } from '@foxlight/dashboard';
import { ui } from '../utils/output.js';

export interface AnalyzeOptions {
  rootDir: string;
  json?: boolean;
}

export async function runAnalyze(options: AnalyzeOptions): Promise<void> {
  const { rootDir, json } = options;

  ui.progress('Scanning project');
  const result = await analyzeProject(rootDir);
  ui.progressDone(
    `Scanned ${result.stats.filesScanned} files in ${result.stats.duration.toFixed(0)}ms`,
  );

  if (json) {
    const snapshot = result.registry.createSnapshot('local', 'local');
    console.log(JSON.stringify(snapshot, null, 2));
    return;
  }

  ui.heading('Analysis Results');
  ui.info('Files scanned:', String(result.stats.filesScanned));
  ui.info('Components found:', String(result.stats.componentsFound));
  ui.info('Imports tracked:', String(result.stats.importsTracked));
  ui.info('Framework:', result.config.framework ?? 'auto-detected');

  const components = result.registry.getAllComponents();
  if (components.length > 0) {
    ui.heading('Components');

    const widths = [30, 12, 10, 8];
    ui.tableHeader(['Name', 'Framework', 'Props', 'Children'], widths);

    for (const comp of components) {
      ui.row(
        [comp.name, comp.framework, String(comp.props.length), String(comp.children.length)],
        widths,
      );
    }
  }

  // Graph stats
  const cycles = result.graph.detectCycles();
  if (cycles.length > 0) {
    ui.heading('Circular Dependencies');
    ui.warn(`Found ${cycles.length} circular dependency chain(s)`);
    for (const cycle of cycles.slice(0, 5)) {
      ui.info('  Cycle:', cycle.join(' → '));
    }
  }

  const roots = result.registry.getRootComponents();
  if (roots.length > 0) {
    ui.heading('Top-Level Components (no parents)');
    for (const root of roots) {
      const subtree = result.registry.getSubtree(root.id);
      ui.info(`  ${root.name}`, `(${subtree.length} components in subtree)`);
    }
  }

  // Save snapshot for dashboard
  try {
    const snapshot = result.registry.createSnapshot('local', 'local');
    const snapshotStore = new SnapshotStore(rootDir);
    await snapshotStore.saveSnapshot(snapshot);
    ui.info('📊 Snapshot saved to:', '.foxlight/snapshots/');
    ui.info('Tip:', 'Run `foxlight dashboard` to visualize');
  } catch (error) {
    // Don't fail the command if snapshot saving fails; just warn
    ui.warn(`Could not save snapshot: ${error instanceof Error ? error.message : String(error)}`);
  }

  ui.gap();
}
