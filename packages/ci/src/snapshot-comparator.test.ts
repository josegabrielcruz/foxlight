import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { hasSignificantChanges } from './snapshot-comparator.js';
import type { SnapshotDiff, ComponentInfo } from '@foxlight/core';

function makeEmptyDiff(): SnapshotDiff {
  return {
    base: { id: 'base', commitSha: 'aaa' },
    head: { id: 'head', commitSha: 'bbb' },
    components: { added: [], removed: [], modified: [] },
    bundleDiff: [],
    healthDiff: [],
  };
}

function makeComponent(name: string): ComponentInfo {
  return {
    id: `test/${name}`,
    name,
    filePath: `/src/${name}.tsx`,
    line: 1,
    framework: 'react',
    exportKind: 'named',
    props: [],
    children: [],
    usedBy: [],
    dependencies: [],
    metadata: {},
  };
}

describe('hasSignificantChanges', () => {
  it('should return false for an empty diff', () => {
    const diff = makeEmptyDiff();
    expect(hasSignificantChanges(diff)).toBe(false);
  });

  it('should return true when components are added', () => {
    const diff = makeEmptyDiff();
    diff.components.added = [makeComponent('NewButton')];
    expect(hasSignificantChanges(diff)).toBe(true);
  });

  it('should return true when components are removed', () => {
    const diff = makeEmptyDiff();
    diff.components.removed = [makeComponent('OldButton')];
    expect(hasSignificantChanges(diff)).toBe(true);
  });

  it('should return true when components are modified', () => {
    const diff = makeEmptyDiff();
    diff.components.modified = [
      {
        componentId: 'test/Button',
        changes: ['children changed'],
        propsAdded: [],
        propsRemoved: [],
        propsModified: [],
      },
    ];
    expect(hasSignificantChanges(diff)).toBe(true);
  });

  it('should return true for significant bundle size changes (>1KB gzip)', () => {
    const diff = makeEmptyDiff();
    diff.bundleDiff = [
      {
        componentId: 'test/Button',
        before: { raw: 5000, gzip: 2000 },
        after: { raw: 8000, gzip: 4000 },
        delta: { raw: 3000, gzip: 2000 },
      },
    ];
    expect(hasSignificantChanges(diff)).toBe(true);
  });

  it('should return false for small bundle size changes (<1KB gzip)', () => {
    const diff = makeEmptyDiff();
    diff.bundleDiff = [
      {
        componentId: 'test/Button',
        before: { raw: 5000, gzip: 2000 },
        after: { raw: 5500, gzip: 2500 },
        delta: { raw: 500, gzip: 500 },
      },
    ];
    expect(hasSignificantChanges(diff)).toBe(false);
  });

  it('should return true for significant health score drops (>10 points)', () => {
    const diff = makeEmptyDiff();
    diff.healthDiff = [
      {
        componentId: 'test/Button',
        beforeScore: 85,
        afterScore: 70,
        delta: -15,
      },
    ];
    expect(hasSignificantChanges(diff)).toBe(true);
  });

  it('should return false for small health score changes', () => {
    const diff = makeEmptyDiff();
    diff.healthDiff = [
      {
        componentId: 'test/Button',
        beforeScore: 85,
        afterScore: 80,
        delta: -5,
      },
    ];
    expect(hasSignificantChanges(diff)).toBe(false);
  });
});
