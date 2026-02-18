import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { ProjectSnapshot } from '@foxlight/core';

export interface Snapshot {
  timestamp: string;
  data: ProjectSnapshot;
}

export interface SnapshotManifest {
  snapshots: Array<{
    timestamp: string;
    path: string;
    size: number;
  }>;
}

/**
 * Manages snapshots of analysis results stored in .foxlight/snapshots/
 * Keeps last N snapshots, auto-rotates old ones
 */
export class SnapshotStore {
  private snapshotsDir: string;
  private maxSnapshots: number = 30; // Keep last 30 snapshots

  constructor(projectRoot: string) {
    this.snapshotsDir = join(projectRoot, '.foxlight', 'snapshots');
  }

  async ensureDir(): Promise<void> {
    try {
      await mkdir(this.snapshotsDir, { recursive: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw error;
      }
    }
  }

  async saveSnapshot(data: ProjectSnapshot): Promise<string> {
    await this.ensureDir();

    const timestamp = new Date().toISOString();
    const filename = `${timestamp.replace(/[:.]/g, '-')}.json`;
    const filePath = join(this.snapshotsDir, filename);

    await writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
    await this.cleanupOldSnapshots();

    return timestamp;
  }

  async loadLatestSnapshot(): Promise<Snapshot | null> {
    const manifest = await this.loadManifest();
    if (!manifest.snapshots.length) return null;

    const latest = manifest.snapshots[manifest.snapshots.length - 1]!;
    const data = await readFile(latest.path, 'utf-8');

    return {
      timestamp: latest.timestamp,
      data: JSON.parse(data) as ProjectSnapshot,
    };
  }

  async loadSnapshots(limit?: number): Promise<Snapshot[]> {
    const manifest = await this.loadManifest();
    const snapshots = limit
      ? manifest.snapshots.slice(Math.max(0, manifest.snapshots.length - limit))
      : manifest.snapshots;

    return Promise.all(
      snapshots.map(async (entry) => {
        const data = await readFile(entry.path, 'utf-8');
        return {
          timestamp: entry.timestamp,
          data: JSON.parse(data) as ProjectSnapshot,
        };
      }),
    );
  }

  private async loadManifest(): Promise<SnapshotManifest> {
    try {
      const manifestPath = join(this.snapshotsDir, 'manifest.json');
      const data = await readFile(manifestPath, 'utf-8');
      return JSON.parse(data) as SnapshotManifest;
    } catch {
      return { snapshots: [] };
    }
  }

  private async cleanupOldSnapshots(): Promise<void> {
    const files = await readdir(this.snapshotsDir);
    const jsonFiles = files
      .filter((f) => f.endsWith('.json') && f !== 'manifest.json')
      .sort()
      .reverse();

    // Delete files beyond maxSnapshots limit
    for (const file of jsonFiles.slice(this.maxSnapshots)) {
      const filePath = join(this.snapshotsDir, file);
      try {
        await (await import('node:fs/promises')).unlink(filePath);
      } catch {
        // Ignore deletion errors
      }
    }

    // Update manifest
    const snapshotFiles = jsonFiles.slice(0, this.maxSnapshots);
    const manifest: SnapshotManifest = {
      snapshots: snapshotFiles.map((file) => ({
        timestamp: file.replace(/\.json$/, '').replace(/-/g, ':'),
        path: join(this.snapshotsDir, file),
        size: 0, // Could calculate actual size if needed
      })),
    };

    await writeFile(
      join(this.snapshotsDir, 'manifest.json'),
      JSON.stringify(manifest, null, 2),
      'utf-8',
    );
  }
}
