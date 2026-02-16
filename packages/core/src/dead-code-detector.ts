// ============================================================
// @foxlight/core — Dead Code Detector
//
// Identifies unused components, exports, and dependencies.
// Helps teams reduce bundle size and maintenance burden.
// ============================================================

import type { ComponentInfo, ComponentRegistry } from './index.js';

// -----------------------------------------------------------
// Types
// -----------------------------------------------------------

export interface UnusedComponent {
  id: string;
  name: string;
  filePath: string;
  potentialSavings?: string; // e.g., "5.2 KB gzip"
  reason: 'never_imported' | 'unused_export' | 'orphaned';
}

export interface UnusedExport {
  filePath: string;
  exportName: string;
  reason: 'exported_but_unused' | 're_exported_unused';
}

export interface DeadCodeReport {
  unusedComponents: UnusedComponent[];
  orphanedComponents: UnusedComponent[];
  unusedExports: UnusedExport[];
  totalPotentialBytes: number;
}

// -----------------------------------------------------------
// Detection logic
// -----------------------------------------------------------

/**
 * Analyze the component registry to find dead code.
 */
export function detectDeadCode(registry: ComponentRegistry): DeadCodeReport {
  const allComponents = registry.getAllComponents();
  const allImports = registry.getAllImports();

  const unusedComponents: UnusedComponent[] = [];
  const orphanedComponents: UnusedComponent[] = [];
  const unusedExports: UnusedExport[] = [];

  // Build a set of all imported component IDs
  const importedIds = new Set<string>();
  for (const imp of allImports) {
    // Try to resolve import to a component ID
    // Heuristic: component IDs often contain the file path
    importedIds.add(imp.target);
  }

  // Check each component for usage
  for (const component of allComponents) {
    const isImported = importedIds.has(component.filePath) || importedIds.has(component.id);

    // Check if this is a re-export (should flag if the original is unused)
    if (component.exportKind === 're-export' && !isImported) {
      unusedExports.push({
        filePath: component.filePath,
        exportName: component.name,
        reason: 're_exported_unused',
      });
    }

    // Check if component has consumers (is used)
    const hasConsumers = component.usedBy && component.usedBy.length > 0;

    if (!isImported && !hasConsumers) {
      if (component.exportKind === 'default') {
        // Default exports that aren't imported are likely unused pages/entries
        unusedComponents.push({
          id: component.id,
          name: component.name,
          filePath: component.filePath,
          reason: 'never_imported',
        });
      } else if (component.exportKind === 'named') {
        // Named exports that aren't imported are definitely unused
        unusedComponents.push({
          id: component.id,
          name: component.name,
          filePath: component.filePath,
          reason: 'unused_export',
        });
        unusedExports.push({
          filePath: component.filePath,
          exportName: component.name,
          reason: 'exported_but_unused',
        });
      }
    }

    // Check for orphaned branches (components only used by other unused components)
    if (!isImported && hasConsumers) {
      const allConsumersAreUnused = component.usedBy.every((consumerId) => {
        const consumer = registry.getComponent(consumerId);
        return consumer && !isComponentUsed(consumer, registry);
      });

      if (allConsumersAreUnused) {
        orphanedComponents.push({
          id: component.id,
          name: component.name,
          filePath: component.filePath,
          reason: 'orphaned',
        });
      }
    }
  }

  // Estimate potential savings (if bundle info is available)
  let totalPotentialBytes = 0;
  for (const unused of unusedComponents) {
    const bundleInfo = registry.getBundleInfo(unused.id);
    if (bundleInfo) {
      totalPotentialBytes += bundleInfo.exclusiveSize.gzip;
    }
  }

  return {
    unusedComponents,
    orphanedComponents,
    unusedExports,
    totalPotentialBytes,
  };
}

/**
 * Check if a component is actually used somewhere.
 */
function isComponentUsed(component: ComponentInfo, registry: ComponentRegistry): boolean {
  if (!component.usedBy || component.usedBy.length === 0) {
    return false;
  }

  // Check if any consumer is used
  for (const consumerId of component.usedBy) {
    const consumer = registry.getComponent(consumerId);
    if (consumer && isComponentUsed(consumer, registry)) {
      return true;
    }
  }

  return false;
}

/**
 * Get components that should definitely be safe to remove.
 * These are unused components with no dependencies.
 */
export function findSafeRemovalCandidates(report: DeadCodeReport): UnusedComponent[] {
  return report.unusedComponents.filter((c) => c.reason !== 'orphaned');
}

/**
 * Format dead code report for display.
 */
export function formatDeadCodeReport(report: DeadCodeReport): string {
  const lines: string[] = [];

  if (report.unusedComponents.length > 0) {
    lines.push(`\n❌ Unused Components (${report.unusedComponents.length}):`);
    for (const comp of report.unusedComponents.slice(0, 10)) {
      lines.push(`  - ${comp.name} (${comp.filePath})`);
    }
    if (report.unusedComponents.length > 10) {
      lines.push(`  ... and ${report.unusedComponents.length - 10} more`);
    }
  }

  if (report.orphanedComponents.length > 0) {
    lines.push(`\n🔗 Orphaned Components (${report.orphanedComponents.length}):`);
    for (const comp of report.orphanedComponents.slice(0, 5)) {
      lines.push(`  - ${comp.name} (${comp.filePath})`);
    }
    if (report.orphanedComponents.length > 5) {
      lines.push(`  ... and ${report.orphanedComponents.length - 5} more`);
    }
  }

  if (report.unusedExports.length > 0) {
    lines.push(`\n⚠️  Unused Exports (${report.unusedExports.length}):`);
    for (const exp of report.unusedExports.slice(0, 10)) {
      lines.push(`  - ${exp.exportName} from ${exp.filePath}`);
    }
  }

  if (report.totalPotentialBytes > 0) {
    const kb = (report.totalPotentialBytes / 1024).toFixed(1);
    lines.push(`\n💾 Potential Savings: ~${kb} KB`);
  }

  return lines.join('\n');
}
