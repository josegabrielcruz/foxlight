import { createServer } from 'node:http';
import express, { type Express, type Response } from 'express';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ProjectSnapshot } from '@foxlight/core';
import { SnapshotStore } from './snapshot-store.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface DashboardServerOptions {
  projectRoot: string;
  port?: number;
  host?: string;
}

export class DashboardServer {
  private app: Express;
  private snapshotStore: SnapshotStore;
  private port: number;
  private host: string;

  constructor(options: DashboardServerOptions) {
    this.app = express();
    this.snapshotStore = new SnapshotStore(options.projectRoot);
    this.port = options.port ?? 3000;
    this.host = options.host ?? 'localhost';

    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(express.json());
    // Serve compiled UI from dist/ui directory (relative to dist root)
    const uiDir = join(__dirname, 'ui');
    this.app.use(express.static(uiDir));
  }

  private setupRoutes(): void {
    // API: Get latest analysis
    this.app.get('/api/analysis/latest', async (_req, res) => {
      try {
        const snapshot = await this.snapshotStore.loadLatestSnapshot();
        if (!snapshot) {
          res.status(404).json({ error: 'No analysis snapshots found' });
          return;
        }
        res.json(snapshot);
      } catch (error) {
        this.handleError(res, error);
      }
    });

    // API: Get analysis history (last N snapshots)
    this.app.get('/api/analysis/history', async (req, res) => {
      try {
        const limit = req.query.limit ? parseInt(req.query.limit as string) : 30;
        const snapshots = await this.snapshotStore.loadSnapshots(limit);
        res.json(snapshots);
      } catch (error) {
        this.handleError(res, error);
      }
    });

    // API: Save current analysis
    this.app.post('/api/analysis/save', async (req, res) => {
      try {
        const data = req.body as ProjectSnapshot;
        const timestamp = await this.snapshotStore.saveSnapshot(data);
        res.json({ timestamp, message: 'Analysis snapshot saved' });
      } catch (error) {
        this.handleError(res, error);
      }
    });

    // Fallback to index.html for SPA routing
    this.app.get('*', (_req, res) => {
      const indexPath = join(__dirname, 'ui/index.html');
      res.sendFile(indexPath);
    });
  }

  private handleError(res: Response, error: unknown): void {
    console.error('Dashboard error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }

  /**
   * Start the dashboard server
   */
  async start(): Promise<string> {
    return new Promise((resolve, reject) => {
      const server = createServer(this.app);

      server.listen(this.port, this.host, () => {
        const url = `http://${this.host}:${this.port}`;
        console.log(`\n🦊 Foxlight Dashboard running at ${url}\n`);
        resolve(url);
      });

      server.on('error', reject);
    });
  }
}
