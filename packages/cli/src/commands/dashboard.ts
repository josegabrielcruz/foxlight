// ============================================================
// @foxlight/cli — Dashboard command
//
// Starts a local browser-based dashboard for exploring
// component health, bundle sizes, and historical trends.
// All data is stored locally in .foxlight/snapshots/
// ============================================================

import { DashboardServer } from '@foxlight/dashboard';
import { ui } from '../utils/output.js';

export interface DashboardOptions {
  rootDir: string;
  port?: number;
  host?: string;
}

export async function runDashboard(options: DashboardOptions): Promise<void> {
  const { rootDir, port = 3000, host = 'localhost' } = options;

  try {
    const server = new DashboardServer({
      projectRoot: rootDir,
      port,
      host,
    });

    const url = await server.start();

    ui.heading('Dashboard Started');
    ui.success(`Open your browser to: ${url}`);
    ui.gap();
    ui.info('Tip:', 'Run `foxlight analyze` to capture new snapshots');
    ui.info('Data stored in:', '.foxlight/snapshots/');
    ui.info('Command:', 'Press Ctrl+C to stop');
    ui.gap();

    // Keep the server running until interrupted
    await new Promise<void>((resolve) => {
      const handler = () => {
        process.off('SIGINT', handler);
        ui.gap();
        ui.info('Status:', 'Dashboard stopped');
        resolve();
      };
      process.on('SIGINT', handler);
    });
  } catch (error) {
    ui.error('Failed to start dashboard:');
    ui.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
