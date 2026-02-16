import { describe, it, expect } from 'vitest';
import {
  createAPISnapshot,
  snapshotToJSON,
  snapshotFromJSON,
  compareSnapshots,
  formatAPIChangeSummary,
} from './api-snapshot.js';

describe('API Snapshot & Breaking Change Detector', () => {
  const mockComponents = [
    {
      id: 'src/Button.tsx#Button',
      name: 'Button',
      filePath: 'src/Button.tsx',
      line: 1,
      framework: 'react' as const,
      exportKind: 'named' as const,
      props: [{ name: 'label', type: 'string', required: true }],
      children: [],
      usedBy: [],
      dependencies: [],
      metadata: {},
    },
    {
      id: 'src/Modal.tsx#Modal',
      name: 'Modal',
      filePath: 'src/Modal.tsx',
      line: 1,
      framework: 'react' as const,
      exportKind: 'named' as const,
      props: [{ name: 'isOpen', type: 'boolean', required: true }],
      children: [],
      usedBy: [],
      dependencies: [],
      metadata: {},
    },
  ];

  it('creates API snapshot from components', () => {
    const snapshot = createAPISnapshot(mockComponents);

    expect(snapshot.components.size).toBe(2);
    expect(snapshot.timestamp).toBeDefined();
  });

  it('serializes snapshot to JSON', () => {
    const snapshot = createAPISnapshot(mockComponents);
    const json = snapshotToJSON(snapshot);

    expect(typeof json).toBe('string');
    const parsed = JSON.parse(json);
    expect(parsed.components.length).toBe(2);
  });

  it('deserializes snapshot from JSON', () => {
    const snapshot = createAPISnapshot(mockComponents);
    const json = snapshotToJSON(snapshot);
    const restored = snapshotFromJSON(json);

    expect(restored.components.size).toBe(2);
  });

  it('detects added components', () => {
    const oldSnapshot = createAPISnapshot([mockComponents[0]!]);
    const newSnapshot = createAPISnapshot(mockComponents);

    const summary = compareSnapshots(oldSnapshot, newSnapshot);

    expect(summary.addedComponents.length).toBe(1);
    expect(summary.addedComponents[0]?.name).toBe('Modal');
  });

  it('detects removed components', () => {
    const oldSnapshot = createAPISnapshot(mockComponents);
    const newSnapshot = createAPISnapshot([mockComponents[0]!]);

    const summary = compareSnapshots(oldSnapshot, newSnapshot);

    expect(summary.removedComponents.length).toBe(1);
    expect(summary.removedComponents[0]?.name).toBe('Modal');
  });

  it('detects breaking changes in props', () => {
    const oldSnapshot = createAPISnapshot(mockComponents);

    // Modify: remove a prop
    const modifiedComponent = mockComponents[0]!;
    const modifiedComponents = [
      {
        ...modifiedComponent,
        props: [], // Removed required 'label' prop
      },
    ];

    const newSnapshot = createAPISnapshot(modifiedComponents);
    const summary = compareSnapshots(oldSnapshot, newSnapshot);

    expect(summary.breaking.length).toBeGreaterThan(0);
  });

  it('detects export kind changes', () => {
    const modifiedComponent = mockComponents[0]!;
    const oldSnapshot = createAPISnapshot([modifiedComponent]);

    const modifiedComponents = [
      {
        ...modifiedComponent,
        exportKind: 'default' as const,
      },
    ];

    const newSnapshot = createAPISnapshot(modifiedComponents);
    const summary = compareSnapshots(oldSnapshot, newSnapshot);

    expect(summary.breaking.length).toBeGreaterThan(0);
  });

  it('formats API change summary', () => {
    const oldSnapshot = createAPISnapshot([mockComponents[0]!]);
    const newSnapshot = createAPISnapshot(mockComponents);

    const summary = compareSnapshots(oldSnapshot, newSnapshot);
    const formatted = formatAPIChangeSummary(summary);

    expect(typeof formatted).toBe('string');
    expect(formatted.length).toBeGreaterThan(0);
  });

  it('distinguishes breaking from non-breaking changes', () => {
    const baseComponent = mockComponents[0]!;
    const oldSnapshot = createAPISnapshot([
      {
        ...baseComponent,
        props: [{ name: 'label', type: 'string', required: true }],
      },
    ]);

    // Add optional prop (non-breaking)
    const newSnapshot = createAPISnapshot([
      {
        ...baseComponent,
        props: [
          { name: 'label', type: 'string', required: true },
          { name: 'variant', type: 'string', required: false },
        ],
      },
    ]);

    const summary = compareSnapshots(oldSnapshot, newSnapshot);

    // Adding optional prop should not be breaking
    expect(summary.breaking.length).toBe(0);
  });
});
