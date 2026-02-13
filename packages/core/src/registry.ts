// ============================================================
// @pulse/core — Component Registry
//
// In-memory store of all discovered components and their
// relationships. This is the central data structure that
// every Pulse tool reads from and writes to.
// ============================================================

import type {
  ComponentId,
  ComponentInfo,
  ComponentBundleInfo,
  ComponentHealth,
  ImportEdge,
  ProjectSnapshot,
  SnapshotDiff,
  ComponentModification,
  BundleDiffEntry,
  HealthDiffEntry,
} from "./types.js";

/**
 * The ComponentRegistry is the shared data layer for Pulse.
 * It holds all discovered components, their relationships,
 * bundle data, and health scores.
 */
export class ComponentRegistry {
  private components = new Map<ComponentId, ComponentInfo>();
  private imports: ImportEdge[] = [];
  private bundleInfo = new Map<ComponentId, ComponentBundleInfo>();
  private health = new Map<ComponentId, ComponentHealth>();

  // -----------------------------------------------------------
  // Component CRUD
  // -----------------------------------------------------------

  /** Register a discovered component. */
  addComponent(component: ComponentInfo): void {
    this.components.set(component.id, component);
  }

  /** Register multiple components at once. */
  addComponents(components: ComponentInfo[]): void {
    for (const c of components) {
      this.addComponent(c);
    }
  }

  /** Get a component by ID. */
  getComponent(id: ComponentId): ComponentInfo | undefined {
    return this.components.get(id);
  }

  /** Get all registered components. */
  getAllComponents(): ComponentInfo[] {
    return Array.from(this.components.values());
  }

  /** Check if a component exists in the registry. */
  hasComponent(id: ComponentId): boolean {
    return this.components.has(id);
  }

  /** Remove a component from the registry. */
  removeComponent(id: ComponentId): boolean {
    return this.components.delete(id);
  }

  /** Total number of registered components. */
  get size(): number {
    return this.components.size;
  }

  // -----------------------------------------------------------
  // Import graph
  // -----------------------------------------------------------

  /** Add an import edge to the graph. */
  addImport(edge: ImportEdge): void {
    this.imports.push(edge);
  }

  /** Add multiple import edges. */
  addImports(edges: ImportEdge[]): void {
    this.imports.push(...edges);
  }

  /** Get all imports originating from a file. */
  getImportsFrom(filePath: string): ImportEdge[] {
    return this.imports.filter((e) => e.source === filePath);
  }

  /** Get all imports targeting a file or package. */
  getImportsTo(target: string): ImportEdge[] {
    return this.imports.filter((e) => e.target === target);
  }

  /** Get the full import graph. */
  getAllImports(): ImportEdge[] {
    return [...this.imports];
  }

  // -----------------------------------------------------------
  // Bundle info
  // -----------------------------------------------------------

  /** Set bundle size info for a component. */
  setBundleInfo(info: ComponentBundleInfo): void {
    this.bundleInfo.set(info.componentId, info);
  }

  /** Get bundle info for a component. */
  getBundleInfo(id: ComponentId): ComponentBundleInfo | undefined {
    return this.bundleInfo.get(id);
  }

  /** Get all bundle info entries. */
  getAllBundleInfo(): ComponentBundleInfo[] {
    return Array.from(this.bundleInfo.values());
  }

  // -----------------------------------------------------------
  // Health scores
  // -----------------------------------------------------------

  /** Set health score for a component. */
  setHealth(h: ComponentHealth): void {
    this.health.set(h.componentId, h);
  }

  /** Get health score for a component. */
  getHealth(id: ComponentId): ComponentHealth | undefined {
    return this.health.get(id);
  }

  /** Get all health scores. */
  getAllHealth(): ComponentHealth[] {
    return Array.from(this.health.values());
  }

  // -----------------------------------------------------------
  // Relationship queries
  // -----------------------------------------------------------

  /** Find components that use the given component (parents). */
  getConsumers(id: ComponentId): ComponentInfo[] {
    const component = this.components.get(id);
    if (!component) return [];
    return component.usedBy
      .map((parentId) => this.components.get(parentId))
      .filter((c): c is ComponentInfo => c !== undefined);
  }

  /** Find components that the given component renders (children). */
  getDependents(id: ComponentId): ComponentInfo[] {
    const component = this.components.get(id);
    if (!component) return [];
    return component.children
      .map((childId) => this.components.get(childId))
      .filter((c): c is ComponentInfo => c !== undefined);
  }

  /** Get components that have no parents (top-level / page components). */
  getRootComponents(): ComponentInfo[] {
    return this.getAllComponents().filter((c) => c.usedBy.length === 0);
  }

  /** Get components that have no children (leaf / primitive components). */
  getLeafComponents(): ComponentInfo[] {
    return this.getAllComponents().filter((c) => c.children.length === 0);
  }

  /**
   * Find all components reachable from the given component (full subtree).
   * Uses BFS to avoid stack overflow on deep trees.
   */
  getSubtree(id: ComponentId): ComponentInfo[] {
    const visited = new Set<ComponentId>();
    const queue: ComponentId[] = [id];
    const result: ComponentInfo[] = [];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) continue;
      visited.add(currentId);

      const component = this.components.get(currentId);
      if (!component) continue;

      result.push(component);
      for (const childId of component.children) {
        if (!visited.has(childId)) {
          queue.push(childId);
        }
      }
    }

    return result;
  }

  // -----------------------------------------------------------
  // Snapshot & diff
  // -----------------------------------------------------------

  /** Create a point-in-time snapshot of the registry. */
  createSnapshot(commitSha: string, branch: string): ProjectSnapshot {
    return {
      id: `snap_${Date.now()}_${commitSha.slice(0, 8)}`,
      commitSha,
      branch,
      createdAt: new Date().toISOString(),
      components: this.getAllComponents(),
      imports: this.getAllImports(),
      bundleInfo: this.getAllBundleInfo(),
      health: this.getAllHealth(),
    };
  }

  /** Load a snapshot into the registry, replacing current state. */
  loadSnapshot(snapshot: ProjectSnapshot): void {
    this.clear();
    this.addComponents(snapshot.components);
    this.addImports(snapshot.imports);
    for (const bi of snapshot.bundleInfo) {
      this.setBundleInfo(bi);
    }
    for (const h of snapshot.health) {
      this.setHealth(h);
    }
  }

  /** Compute the diff between two snapshots. */
  static diff(base: ProjectSnapshot, head: ProjectSnapshot): SnapshotDiff {
    const baseIds = new Set(base.components.map((c) => c.id));
    const headIds = new Set(head.components.map((c) => c.id));

    const added = head.components.filter((c) => !baseIds.has(c.id));
    const removed = base.components.filter((c) => !headIds.has(c.id));

    const modified: ComponentModification[] = [];
    for (const headComp of head.components) {
      if (!baseIds.has(headComp.id)) continue;
      const baseComp = base.components.find((c) => c.id === headComp.id);
      if (!baseComp) continue;

      const mod = diffComponent(baseComp, headComp);
      if (mod) {
        modified.push(mod);
      }
    }

    const bundleDiff: BundleDiffEntry[] = [];
    const headBundleMap = new Map(head.bundleInfo.map((b) => [b.componentId, b]));
    for (const baseBi of base.bundleInfo) {
      const headBi = headBundleMap.get(baseBi.componentId);
      if (!headBi) continue;
      bundleDiff.push({
        componentId: baseBi.componentId,
        before: baseBi.selfSize,
        after: headBi.selfSize,
        delta: {
          raw: headBi.selfSize.raw - baseBi.selfSize.raw,
          gzip: headBi.selfSize.gzip - baseBi.selfSize.gzip,
        },
      });
    }

    const healthDiff: HealthDiffEntry[] = [];
    const headHealthMap = new Map(head.health.map((h) => [h.componentId, h]));
    for (const baseH of base.health) {
      const headH = headHealthMap.get(baseH.componentId);
      if (!headH) continue;
      healthDiff.push({
        componentId: baseH.componentId,
        beforeScore: baseH.score,
        afterScore: headH.score,
        delta: headH.score - baseH.score,
      });
    }

    return {
      base: { id: base.id, commitSha: base.commitSha },
      head: { id: head.id, commitSha: head.commitSha },
      components: { added, removed, modified },
      bundleDiff,
      healthDiff,
    };
  }

  // -----------------------------------------------------------
  // Utility
  // -----------------------------------------------------------

  /** Clear all data from the registry. */
  clear(): void {
    this.components.clear();
    this.imports = [];
    this.bundleInfo.clear();
    this.health.clear();
  }
}

// -----------------------------------------------------------
// Internal helpers
// -----------------------------------------------------------

function diffComponent(
  base: ComponentInfo,
  head: ComponentInfo
): ComponentModification | null {
  const changes: string[] = [];
  const baseProps = new Set(base.props.map((p) => p.name));
  const headProps = new Set(head.props.map((p) => p.name));

  const propsAdded = head.props
    .filter((p) => !baseProps.has(p.name))
    .map((p) => p.name);
  const propsRemoved = base.props
    .filter((p) => !headProps.has(p.name))
    .map((p) => p.name);
  const propsModified: string[] = [];

  for (const headProp of head.props) {
    if (!baseProps.has(headProp.name)) continue;
    const baseProp = base.props.find((p) => p.name === headProp.name);
    if (!baseProp) continue;
    if (
      baseProp.type !== headProp.type ||
      baseProp.required !== headProp.required
    ) {
      propsModified.push(headProp.name);
    }
  }

  if (base.children.length !== head.children.length) {
    changes.push("children changed");
  }
  if (base.dependencies.length !== head.dependencies.length) {
    changes.push("dependencies changed");
  }
  if (base.framework !== head.framework) {
    changes.push(`framework changed: ${base.framework} → ${head.framework}`);
  }

  const hasChanges =
    propsAdded.length > 0 ||
    propsRemoved.length > 0 ||
    propsModified.length > 0 ||
    changes.length > 0;

  if (!hasChanges) return null;

  return {
    componentId: head.id,
    changes,
    propsAdded,
    propsRemoved,
    propsModified,
  };
}
