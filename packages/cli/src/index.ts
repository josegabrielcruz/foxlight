#!/usr/bin/env node
// ============================================================
// @foxlight/cli — Entry point
//
// Routes commands to their handlers.
// Usage:
//   foxlight init          — Initialize Foxlight in a project
//   foxlight analyze       — Scan project and discover components
//   foxlight health        — Show component health dashboard
//   foxlight analyze --json — Output analysis as JSON
// ============================================================

import { resolve } from 'node:path';
import { runAnalyze } from './commands/analyze.js';
import { runHealth } from './commands/health.js';
import { runInit } from './commands/init.js';
import { runCost } from './commands/cost.js';
import { runUpgrade } from './commands/upgrade.js';
import { runCI } from './commands/ci.js';
import { runCoverage } from './commands/coverage.js';
import { runDeadCodeDetection } from './commands/dead-code.js';
import { runAPICheck } from './commands/api-check.js';
import { ui } from './utils/output.js';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  // Parse flags
  const flags = new Map<string, string>();
  for (let i = 1; i < args.length; i++) {
    const arg = args[i]!;
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const nextArg = args[i + 1];
      const value = nextArg && !nextArg.startsWith('--') ? nextArg : 'true';
      flags.set(key, value);
      if (value !== 'true') i++;
    }
  }

  const rootDir = resolve(flags.get('root') ?? flags.get('dir') ?? '.');
  const json = flags.has('json');

  ui.banner();

  switch (command) {
    case 'init':
      await runInit({ rootDir });
      break;

    case 'analyze':
    case 'scan':
      await runAnalyze({ rootDir, json });
      break;

    case 'health':
    case 'dashboard':
      await runHealth({
        rootDir,
        json,
        component: flags.get('component') ?? flags.get('c'),
      });
      break;

    case 'cost':
      await runCost({
        rootDir,
        json,
        provider: flags.get('provider') ?? flags.get('p'),
        pageViews: flags.has('page-views') ? parseInt(flags.get('page-views')!, 10) : undefined,
      });
      break;

    case 'upgrade': {
      const packageName = args[1];
      if (!packageName || packageName.startsWith('--')) {
        ui.error('Please specify a package name: foxlight upgrade <package>');
        process.exitCode = 1;
        break;
      }
      await runUpgrade({
        rootDir,
        json,
        packageName,
        targetVersion: flags.get('to') ?? flags.get('target'),
      });
      break;
    }

    case 'ci':
      await runCI({
        rootDir,
        json,
        basePath: flags.get('base'),
        outputPath: flags.get('output'),
      });
      break;

    case 'coverage':
      await runCoverage({
        root: rootDir,
        json,
        threshold: flags.has('threshold') ? parseInt(flags.get('threshold')!, 10) : undefined,
        coveragePath: flags.get('coverage'),
      });
      break;

    case 'dead-code':
      await runDeadCodeDetection({
        root: rootDir,
        json,
        threshold: flags.has('threshold') ? parseInt(flags.get('threshold')!, 10) : undefined,
      });
      break;

    case 'api-check':
      await runAPICheck({
        root: rootDir,
        json,
        save: flags.has('save'),
        baseline: flags.get('baseline'),
      });
      break;

    case 'help':
    case '--help':
    case '-h':
    case undefined:
      printHelp();
      break;

    case 'version':
    case '--version':
    case '-v':
      console.log('  foxlight v0.1.0');
      break;

    default:
      ui.error(`Unknown command: ${command}`);
      ui.gap();
      printHelp();
      process.exitCode = 1;
  }
}

function printHelp(): void {
  console.log('  Usage: foxlight <command> [options]');
  console.log('');
  console.log('  Commands:');
  console.log('    init              Initialize Foxlight in your project');
  console.log('    analyze           Scan project and discover components');
  console.log('    health            Show component health dashboard');
  console.log('    cost              Estimate hosting costs by provider');
  console.log('    upgrade <pkg>     Analyze dependency upgrade impact');
  console.log('    coverage          Show test coverage by component');
  console.log('    dead-code         Find unused components and exports');
  console.log('    api-check         Detect breaking changes in component APIs');
  console.log('    ci                Run CI analysis and post results');
  console.log('');
  console.log('  Options:');
  console.log('    --root <dir>      Project root directory (default: .)');
  console.log('    --json            Output results as JSON');
  console.log('    --component <name> Filter health to a specific component');
  console.log('    --provider <name> Cost provider (vercel, netlify, aws, cloudflare)');
  console.log('    --to <version>    Target version for upgrade command');
  console.log('    --threshold <num> Coverage/dead-code threshold');
  console.log('    --coverage <path> Path to coverage JSON file');
  console.log('    --save            Save current state as baseline (api-check)');
  console.log('    --help            Show this help message');
  console.log('    --version         Show version number');
  console.log('');
}

main().catch((error: unknown) => {
  ui.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
