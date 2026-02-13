// ============================================================
// @foxlight/ci — Snapshot Comparator
//
// Compares two project snapshots (base vs head) and produces
// a structured diff used by CI reporters (GitHub, GitLab, etc).
// ============================================================

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  ComponentRegistry,
  type ProjectSnapshot,
  type SnapshotDiff,
} from '@foxlight/core';
import { analyzeProject } from '@foxlight/analyzer';

export interface CompareOptions {
  /** Path to the base snapshot JSON file */
  basePath?: string;
  /** Path to save the head snapshot */
  outputPath?: string;
  /** Project root directory */
  rootDir: string;
  /** Git commit SHA for the head snapshot */
  commitSha?: string;
  /** Git branch name */
  branch?: string;
}

export interface CompareResult {
  diff: SnapshotDiff;
  base: ProjectSnapshot;
  head: ProjectSnapshot;
}

/**
 * Analyze the current state, compare against a baseline, and produce a diff.
 */
export async function compareSnapshots(
  options: CompareOptions,
): Promise<CompareResult> {
  const { rootDir, commitSha = 'unknown', branch = 'unknown' } = options;

  // Analyze current project state
  const analysis = await analyzeProject(rootDir);
  const head = analysis.registry.createSnapshot(commitSha, branch);

  // Save head snapshot if output path specified
  if (options.outputPath) {
    const dir = dirname(options.outputPath);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
    await writeFile(options.outputPath, JSON.stringify(head, null, 2));
  }

  // Load base snapshot
  let base: ProjectSnapshot;
  if (options.basePath && existsSync(options.basePath)) {
    const raw = await readFile(options.basePath, 'utf-8');
    base = JSON.parse(raw) as ProjectSnapshot;
  } else {
    // No baseline — treat as empty (everything is "added")
    base = createEmptySnapshot();
  }

  // Compute diff
  const diff = ComponentRegistry.diff(base, head);

  return { diff, base, head };
}

/**
 * Create an empty snapshot (used when no baseline exists).
 */
function createEmptySnapshot(): ProjectSnapshot {
  return {
    id: 'empty',
    commitSha: '0000000',
    branch: 'none',
    createdAt: new Date().toISOString(),
    components: [],
    imports: [],
    bundleInfo: [],
    health: [],
  };
}

/**
 * Determine if a diff has significant changes that warrant reporting.
 */
export function hasSignificantChanges(diff: SnapshotDiff): boolean {
  const { added, removed, modified } = diff.components;

  if (added.length > 0 || removed.length > 0) return true;
  if (modified.length > 0) return true;

  // Check for significant bundle size changes (> 1KB gzip)
  const hasBundleChange = diff.bundleDiff.some(
    (b) => Math.abs(b.delta.gzip) > 1024,
  );
  if (hasBundleChange) return true;

  // Check for significant health score changes (> 10 points)
  const hasHealthChange = diff.healthDiff.some((h) => Math.abs(h.delta) > 10);
  if (hasHealthChange) return true;

  return false;
}
