// ============================================================
// @foxlight/core — API Snapshot & Breaking Change Detector
//
// Tracks component APIs (props, exports) and detects breaking
// changes across commits. Prevents shipping API-breaking changes
// that would affect downstream consumers.
// ============================================================

import type { ComponentInfo, PropInfo } from './types.js';

// -----------------------------------------------------------
// Types
// -----------------------------------------------------------

export interface ComponentAPI {
  componentId: string;
  name: string;
  filePath: string;
  exportKind: 'named' | 'default' | 're-export';
  props: PropInfo[];
  timestamp: string;
  version?: string;
}

export interface APISnapshot {
  components: Map<string, ComponentAPI>;
  timestamp: string;
  hash?: string; // Git commit SHA or similar
}

export type BreakingChangeType =
  | 'prop_removed'
  | 'prop_required_changed'
  | 'export_removed'
  | 'export_kind_changed';

export interface BreakingChange {
  componentId: string;
  componentName: string;
  changeType: BreakingChangeType;
  description: string;
  affectedItems: string[];
  severity: 'critical' | 'high' | 'medium';
}

export interface APIChangeSummary {
  addedComponents: ComponentAPI[];
  removedComponents: ComponentAPI[];
  modifiedComponents: {
    component: ComponentAPI;
    changes: APIChange[];
  }[];
  breaking: BreakingChange[];
  nonBreaking: APIChange[];
}

interface APIChange {
  type: 'added' | 'removed' | 'modified';
  field: 'prop' | 'export_kind';
  oldValue?: unknown;
  newValue?: unknown;
}

// -----------------------------------------------------------
// Snapshot management
// -----------------------------------------------------------

/**
 * Create a snapshot of component APIs.
 */
export function createAPISnapshot(components: ComponentInfo[], hash?: string): APISnapshot {
  const components_map = new Map<string, ComponentAPI>();

  for (const comp of components) {
    components_map.set(comp.id, {
      componentId: comp.id,
      name: comp.name,
      filePath: comp.filePath,
      exportKind: comp.exportKind,
      props: comp.props,
      timestamp: new Date().toISOString(),
    });
  }

  return {
    components: components_map,
    timestamp: new Date().toISOString(),
    hash,
  };
}

/**
 * Serialize snapshot to JSON for storage.
 */
export function snapshotToJSON(snapshot: APISnapshot): string {
  const data = {
    timestamp: snapshot.timestamp,
    hash: snapshot.hash,
    components: Array.from(snapshot.components.values()),
  };
  return JSON.stringify(data, null, 2);
}

/**
 * Deserialize snapshot from JSON.
 */
export function snapshotFromJSON(json: string): APISnapshot {
  const data = JSON.parse(json) as {
    timestamp: string;
    hash?: string;
    components: ComponentAPI[];
  };

  const components = new Map<string, ComponentAPI>(data.components.map((c) => [c.componentId, c]));

  return {
    components,
    timestamp: data.timestamp,
    hash: data.hash,
  };
}

// -----------------------------------------------------------
// Comparison & detection
// -----------------------------------------------------------

/**
 * Compare two API snapshots and detect breaking changes.
 */
export function compareSnapshots(
  oldSnapshot: APISnapshot,
  newSnapshot: APISnapshot,
): APIChangeSummary {
  const addedComponents: ComponentAPI[] = [];
  const removedComponents: ComponentAPI[] = [];
  const modifiedComponents: { component: ComponentAPI; changes: APIChange[] }[] = [];
  const breakingChanges: BreakingChange[] = [];
  const nonBreakingChanges: APIChange[] = [];

  // Find removed components
  for (const [id, oldComponent] of oldSnapshot.components) {
    if (!newSnapshot.components.has(id)) {
      removedComponents.push(oldComponent);
      breakingChanges.push({
        componentId: id,
        componentName: oldComponent.name,
        changeType: 'export_removed',
        description: `${oldComponent.name} export was removed`,
        affectedItems: [oldComponent.filePath],
        severity: 'critical',
      });
    }
  }

  // Find added and modified components
  for (const [id, newComponent] of newSnapshot.components) {
    const oldComponent = oldSnapshot.components.get(id);

    if (!oldComponent) {
      addedComponents.push(newComponent);
    } else {
      // Check for changes
      const changes = detectComponentChanges(oldComponent, newComponent);

      if (changes.length > 0) {
        modifiedComponents.push({
          component: newComponent,
          changes,
        });

        // Extract breaking changes
        for (const change of changes) {
          if (
            change.type === 'removed' ||
            (change.type === 'modified' && change.field === 'export_kind')
          ) {
            breakingChanges.push({
              componentId: id,
              componentName: newComponent.name,
              changeType: change.field === 'export_kind' ? 'export_kind_changed' : 'prop_removed',
              description: `${newComponent.name}: ${change.field} changed`,
              affectedItems: [newComponent.filePath],
              severity: change.field === 'export_kind' ? 'high' : 'medium',
            });
          } else {
            nonBreakingChanges.push(change);
          }
        }
      }
    }
  }

  return {
    addedComponents,
    removedComponents,
    modifiedComponents,
    breaking: breakingChanges,
    nonBreaking: nonBreakingChanges,
  };
}

/**
 * Detect changes to a component between two snapshots.
 */
function detectComponentChanges(
  oldComponent: ComponentAPI,
  newComponent: ComponentAPI,
): APIChange[] {
  const changes: APIChange[] = [];

  // Check export kind
  if (oldComponent.exportKind !== newComponent.exportKind) {
    changes.push({
      type: 'modified',
      field: 'export_kind',
      oldValue: oldComponent.exportKind,
      newValue: newComponent.exportKind,
    });
  }

  // Check props (simplified: just check count for now)
  const oldPropNames = new Set(oldComponent.props.map((p) => p.name));
  const newPropNames = new Set(newComponent.props.map((p) => p.name));

  // Removed props
  for (const propName of oldPropNames) {
    if (!newPropNames.has(propName)) {
      changes.push({
        type: 'removed',
        field: 'prop',
        oldValue: propName,
      });
    }
  }

  // Added props
  for (const propName of newPropNames) {
    if (!oldPropNames.has(propName)) {
      // Check if required
      const newProp = newComponent.props.find((p) => p.name === propName);
      if (newProp?.required) {
        changes.push({
          type: 'added',
          field: 'prop',
          newValue: `${propName} (required)`,
        });
      } else {
        changes.push({
          type: 'added',
          field: 'prop',
          newValue: propName,
        });
      }
    }
  }

  return changes;
}

/**
 * Format API changes for display.
 */
export function formatAPIChangeSummary(summary: APIChangeSummary): string {
  const lines: string[] = [];

  if (summary.addedComponents.length > 0) {
    lines.push(`\n✨ Added Components (${summary.addedComponents.length}):`);
    for (const comp of summary.addedComponents.slice(0, 5)) {
      lines.push(`  + ${comp.name}`);
    }
  }

  if (summary.removedComponents.length > 0) {
    lines.push(`\n🗑️  Removed Components (${summary.removedComponents.length}):`);
    for (const comp of summary.removedComponents.slice(0, 5)) {
      lines.push(`  - ${comp.name}`);
    }
  }

  if (summary.breaking.length > 0) {
    lines.push(`\n⚠️  BREAKING CHANGES (${summary.breaking.length}):`);
    for (const change of summary.breaking.slice(0, 10)) {
      const icon = change.severity === 'critical' ? '🚨' : '⚠️ ';
      lines.push(
        `  ${icon} [${change.severity.toUpperCase()}] ${change.componentName}: ${change.description}`,
      );
    }
    if (summary.breaking.length > 10) {
      lines.push(`  ... and ${summary.breaking.length - 10} more`);
    }
  }

  if (summary.modifiedComponents.length > 0 && summary.breaking.length === 0) {
    lines.push(`\n🔄 Modified Components (${summary.modifiedComponents.length}):`);
    for (const mod of summary.modifiedComponents.slice(0, 5)) {
      lines.push(`  ~ ${mod.component.name}`);
    }
  }

  return lines.length > 0 ? lines.join('\n') : 'No API changes detected.';
}
