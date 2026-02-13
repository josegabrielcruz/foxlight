// ============================================================
// @foxlight/core — Dependency Graph
//
// Builds and queries a directed graph from import edges.
// Used for tree-shaking analysis, impact analysis, and
// understanding which components share dependencies.
// ============================================================

import type { ImportEdge } from './types.js';

interface GraphNode {
  /** Absolute file path or package name */
  id: string;
  /** Outgoing edges (this module imports these) */
  outgoing: Set<string>;
  /** Incoming edges (these modules import this) */
  incoming: Set<string>;
}

/**
 * A directed graph built from import relationships.
 * Supports cycle detection, topological sorting, and
 * impact analysis (what's affected if a module changes).
 */
export class DependencyGraph {
  private nodes = new Map<string, GraphNode>();

  /** Build the graph from a list of import edges. */
  static fromImports(edges: ImportEdge[]): DependencyGraph {
    const graph = new DependencyGraph();
    for (const edge of edges) {
      graph.addEdge(edge.source, edge.target);
    }
    return graph;
  }

  /** Add a directed edge from source to target. */
  addEdge(source: string, target: string): void {
    this.ensureNode(source);
    this.ensureNode(target);
    this.nodes.get(source)!.outgoing.add(target);
    this.nodes.get(target)!.incoming.add(source);
  }

  /** Get all direct dependencies of a module. */
  getDependencies(id: string): string[] {
    const node = this.nodes.get(id);
    return node ? Array.from(node.outgoing) : [];
  }

  /** Get all modules that directly depend on a module. */
  getDependents(id: string): string[] {
    const node = this.nodes.get(id);
    return node ? Array.from(node.incoming) : [];
  }

  /**
   * Get all modules transitively affected if the given module changes.
   * Walks the "incoming" edges (dependents) recursively.
   */
  getImpactedModules(id: string): string[] {
    const visited = new Set<string>();
    const queue = [id];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);

      const node = this.nodes.get(current);
      if (!node) continue;
      for (const dep of node.incoming) {
        if (!visited.has(dep)) {
          queue.push(dep);
        }
      }
    }

    visited.delete(id); // Don't include the module itself
    return Array.from(visited);
  }

  /**
   * Get all transitive dependencies of a module.
   * Walks "outgoing" edges recursively.
   */
  getTransitiveDependencies(id: string): string[] {
    const visited = new Set<string>();
    const queue = [id];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);

      const node = this.nodes.get(current);
      if (!node) continue;
      for (const dep of node.outgoing) {
        if (!visited.has(dep)) {
          queue.push(dep);
        }
      }
    }

    visited.delete(id);
    return Array.from(visited);
  }

  /**
   * Detect cycles in the graph.
   * Returns an array of cycles, where each cycle is an array of module IDs.
   */
  detectCycles(): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const inStack = new Set<string>();
    const stack: string[] = [];

    const dfs = (nodeId: string): void => {
      if (inStack.has(nodeId)) {
        // Found a cycle — extract it from the stack
        const cycleStart = stack.indexOf(nodeId);
        if (cycleStart !== -1) {
          cycles.push([...stack.slice(cycleStart), nodeId]);
        }
        return;
      }
      if (visited.has(nodeId)) return;

      visited.add(nodeId);
      inStack.add(nodeId);
      stack.push(nodeId);

      const node = this.nodes.get(nodeId);
      if (node) {
        for (const dep of node.outgoing) {
          dfs(dep);
        }
      }

      stack.pop();
      inStack.delete(nodeId);
    };

    for (const nodeId of this.nodes.keys()) {
      if (!visited.has(nodeId)) {
        dfs(nodeId);
      }
    }

    return cycles;
  }

  /**
   * Topological sort of the graph.
   * Returns null if the graph has cycles.
   */
  topologicalSort(): string[] | null {
    const inDegree = new Map<string, number>();
    for (const [id, node] of this.nodes) {
      inDegree.set(id, node.incoming.size);
    }

    const queue: string[] = [];
    for (const [id, degree] of inDegree) {
      if (degree === 0) queue.push(id);
    }

    const result: string[] = [];
    while (queue.length > 0) {
      const current = queue.shift()!;
      result.push(current);

      const node = this.nodes.get(current);
      if (!node) continue;

      for (const dep of node.outgoing) {
        const newDegree = (inDegree.get(dep) ?? 1) - 1;
        inDegree.set(dep, newDegree);
        if (newDegree === 0) {
          queue.push(dep);
        }
      }
    }

    // If we didn't visit all nodes, there's a cycle
    return result.length === this.nodes.size ? result : null;
  }

  /**
   * Find shared dependencies between two modules.
   * Useful for understanding which code is shared vs. unique.
   */
  getSharedDependencies(idA: string, idB: string): string[] {
    const depsA = new Set(this.getTransitiveDependencies(idA));
    const depsB = new Set(this.getTransitiveDependencies(idB));
    return Array.from(depsA).filter((d) => depsB.has(d));
  }

  /**
   * Find dependencies unique to a module (not shared with any other top-level module).
   * Used for calculating "exclusive" bundle size.
   */
  getExclusiveDependencies(id: string, allTopLevel: string[]): string[] {
    const myDeps = new Set(this.getTransitiveDependencies(id));
    const otherDeps = new Set<string>();

    for (const otherId of allTopLevel) {
      if (otherId === id) continue;
      for (const dep of this.getTransitiveDependencies(otherId)) {
        otherDeps.add(dep);
      }
    }

    return Array.from(myDeps).filter((d) => !otherDeps.has(d));
  }

  /** Get all node IDs in the graph. */
  getAllNodes(): string[] {
    return Array.from(this.nodes.keys());
  }

  /** Get the total number of nodes. */
  get nodeCount(): number {
    return this.nodes.size;
  }

  /** Get the total number of edges. */
  get edgeCount(): number {
    let count = 0;
    for (const node of this.nodes.values()) {
      count += node.outgoing.size;
    }
    return count;
  }

  private ensureNode(id: string): void {
    if (!this.nodes.has(id)) {
      this.nodes.set(id, { id, outgoing: new Set(), incoming: new Set() });
    }
  }
}
