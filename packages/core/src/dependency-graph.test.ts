import { describe, it, expect } from 'vitest';
import { DependencyGraph } from './dependency-graph.js';

describe('DependencyGraph', () => {
  it('should track direct dependencies', () => {
    const graph = new DependencyGraph();
    graph.addEdge('A', 'B');
    graph.addEdge('A', 'C');

    expect(graph.getDependencies('A')).toEqual(expect.arrayContaining(['B', 'C']));
    expect(graph.getDependents('B')).toEqual(['A']);
  });

  it('should find transitive dependencies', () => {
    const graph = new DependencyGraph();
    graph.addEdge('A', 'B');
    graph.addEdge('B', 'C');
    graph.addEdge('C', 'D');

    const deps = graph.getTransitiveDependencies('A');
    expect(deps).toEqual(expect.arrayContaining(['B', 'C', 'D']));
    expect(deps).toHaveLength(3);
  });

  it('should find impacted modules', () => {
    const graph = new DependencyGraph();
    graph.addEdge('Page', 'Layout');
    graph.addEdge('Layout', 'Button');
    graph.addEdge('OtherPage', 'Button');

    // If Button changes, both Layout, Page, and OtherPage are impacted
    const impacted = graph.getImpactedModules('Button');
    expect(impacted).toEqual(expect.arrayContaining(['Layout', 'Page', 'OtherPage']));
  });

  it('should detect cycles', () => {
    const graph = new DependencyGraph();
    graph.addEdge('A', 'B');
    graph.addEdge('B', 'C');
    graph.addEdge('C', 'A'); // cycle

    const cycles = graph.detectCycles();
    expect(cycles.length).toBeGreaterThan(0);
  });

  it('should topological sort acyclic graphs', () => {
    const graph = new DependencyGraph();
    graph.addEdge('A', 'B');
    graph.addEdge('A', 'C');
    graph.addEdge('B', 'D');
    graph.addEdge('C', 'D');

    const sorted = graph.topologicalSort();
    expect(sorted).not.toBeNull();
    // A should come before B and C, B and C should come before D
    const indexOf = (id: string) => sorted!.indexOf(id);
    expect(indexOf('A')).toBeLessThan(indexOf('B'));
    expect(indexOf('A')).toBeLessThan(indexOf('C'));
    expect(indexOf('B')).toBeLessThan(indexOf('D'));
  });

  it('should return null for topological sort with cycles', () => {
    const graph = new DependencyGraph();
    graph.addEdge('A', 'B');
    graph.addEdge('B', 'A');

    expect(graph.topologicalSort()).toBeNull();
  });

  it('should find shared dependencies', () => {
    const graph = new DependencyGraph();
    graph.addEdge('Page1', 'Layout');
    graph.addEdge('Page2', 'Layout');
    graph.addEdge('Page1', 'Sidebar');
    graph.addEdge('Layout', 'Button');

    const shared = graph.getSharedDependencies('Page1', 'Page2');
    expect(shared).toContain('Layout');
    expect(shared).toContain('Button');
    expect(shared).not.toContain('Sidebar');
  });

  it('should find exclusive dependencies', () => {
    const graph = new DependencyGraph();
    graph.addEdge('Page1', 'Layout');
    graph.addEdge('Page1', 'Sidebar');
    graph.addEdge('Page2', 'Layout');
    graph.addEdge('Layout', 'Button');

    const exclusive = graph.getExclusiveDependencies('Page1', ['Page1', 'Page2']);
    expect(exclusive).toContain('Sidebar');
    expect(exclusive).not.toContain('Layout');
    expect(exclusive).not.toContain('Button');
  });

  it('should build from import edges', () => {
    const graph = DependencyGraph.fromImports([
      {
        source: '/src/App.tsx',
        target: '/src/Button.tsx',
        specifiers: [{ imported: 'Button', local: 'Button' }],
        typeOnly: false,
      },
    ]);

    expect(graph.nodeCount).toBe(2);
    expect(graph.edgeCount).toBe(1);
    expect(graph.getDependencies('/src/App.tsx')).toContain('/src/Button.tsx');
  });
});
