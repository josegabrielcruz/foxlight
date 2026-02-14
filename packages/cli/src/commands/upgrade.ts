// ============================================================
// @foxlight/cli — Upgrade command
//
// Analyzes the impact of upgrading a dependency before you
// actually upgrade it. Shows semver risk, affected components,
// peer dependency requirements, and deprecation status.
// ============================================================

import { analyzeProject } from '@foxlight/analyzer';
import { analyzeUpgrade } from '@foxlight/core';
import { ui } from '../utils/output.js';

export interface UpgradeOptions {
  rootDir: string;
  packageName: string;
  targetVersion?: string;
  json?: boolean;
}

export async function runUpgrade(options: UpgradeOptions): Promise<void> {
  const { rootDir, packageName, targetVersion, json } = options;

  ui.progress(`Analyzing upgrade impact for ${packageName}`);
  const result = await analyzeProject(rootDir);
  ui.progressDone('Analysis complete');

  const components = result.registry.getAllComponents();
  const affectedComponents = components.filter((c) => c.dependencies.includes(packageName));

  ui.progress(`Checking ${packageName} upgrade`);
  const preview = await analyzeUpgrade({
    rootDir,
    packageName,
    targetVersion,
    affectedComponents,
  });
  ui.progressDone('Upgrade analysis complete');

  if (json) {
    console.log(JSON.stringify(preview, null, 2));
    return;
  }

  ui.heading(`Upgrade Preview: ${packageName}`);
  ui.info('Current version:', preview.fromVersion);
  ui.info('Target version:', preview.toVersion);
  ui.info('Risk level:', formatRisk(preview.risk));

  ui.heading('Checks');

  for (const check of preview.checks) {
    const icon = check.status === 'pass' ? '✓' : check.status === 'warn' ? '⚠' : '✗';
    const colorFn =
      check.status === 'pass'
        ? ui.success
        : check.status === 'warn'
          ? ui.warn
          : ui.error;

    colorFn(`${icon} ${check.name}: ${check.summary}`);
    if (check.details) {
      ui.info('  ', check.details);
    }
  }

  if (affectedComponents.length > 0) {
    ui.heading('Affected Components');
    for (const comp of affectedComponents.slice(0, 20)) {
      ui.info('  •', comp.name);
    }
    if (affectedComponents.length > 20) {
      ui.info('  ', `...and ${affectedComponents.length - 20} more`);
    }
  }

  ui.gap();
}

function formatRisk(risk: 'low' | 'medium' | 'high'): string {
  switch (risk) {
    case 'low':
      return '🟢 Low';
    case 'medium':
      return '🟡 Medium';
    case 'high':
      return '🔴 High';
  }
}
