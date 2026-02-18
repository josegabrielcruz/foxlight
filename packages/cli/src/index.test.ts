import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock all command handlers before importing main
vi.mock('./commands/init.js', () => ({ runInit: vi.fn() }));
vi.mock('./commands/analyze.js', () => ({ runAnalyze: vi.fn() }));
vi.mock('./commands/health.js', () => ({ runHealth: vi.fn() }));
vi.mock('./commands/dashboard.js', () => ({ runDashboard: vi.fn() }));
vi.mock('./commands/cost.js', () => ({ runCost: vi.fn() }));
vi.mock('./commands/upgrade.js', () => ({ runUpgrade: vi.fn() }));
vi.mock('./commands/ci.js', () => ({ runCI: vi.fn() }));
vi.mock('./commands/coverage.js', () => ({ runCoverage: vi.fn() }));
vi.mock('./commands/dead-code.js', () => ({ runDeadCodeDetection: vi.fn() }));
vi.mock('./commands/api-check.js', () => ({ runAPICheck: vi.fn() }));
vi.mock('./utils/output.js', () => ({
  ui: {
    banner: vi.fn(),
    error: vi.fn(),
    gap: vi.fn(),
  },
}));

import { main, parseFlags } from './index.js';
import { runInit } from './commands/init.js';
import { runAnalyze } from './commands/analyze.js';
import { runHealth } from './commands/health.js';
import { runDashboard } from './commands/dashboard.js';
import { runCost } from './commands/cost.js';
import { runUpgrade } from './commands/upgrade.js';
import { runCI } from './commands/ci.js';
import { runCoverage } from './commands/coverage.js';
import { runDeadCodeDetection } from './commands/dead-code.js';
import { runAPICheck } from './commands/api-check.js';
import { ui } from './utils/output.js';

beforeEach(() => {
  vi.clearAllMocks();
  process.exitCode = undefined;
});

// -----------------------------------------------------------
// parseFlags
// -----------------------------------------------------------

describe('parseFlags', () => {
  it('should parse flags with values', () => {
    const flags = parseFlags(['--root', '/app', '--component', 'Button']);
    expect(flags.get('root')).toBe('/app');
    expect(flags.get('component')).toBe('Button');
  });

  it('should parse boolean flags', () => {
    const flags = parseFlags(['--json', '--save']);
    expect(flags.get('json')).toBe('true');
    expect(flags.get('save')).toBe('true');
  });

  it('should treat a flag followed by another flag as boolean', () => {
    const flags = parseFlags(['--json', '--root', '/app']);
    expect(flags.get('json')).toBe('true');
    expect(flags.get('root')).toBe('/app');
  });

  it('should return empty map for no flags', () => {
    const flags = parseFlags([]);
    expect(flags.size).toBe(0);
  });

  it('should ignore non-flag arguments', () => {
    const flags = parseFlags(['react', '--to', '19.0.0']);
    expect(flags.get('to')).toBe('19.0.0');
    expect(flags.size).toBe(1);
  });
});

// -----------------------------------------------------------
// Command routing
// -----------------------------------------------------------

describe('main — command routing', () => {
  it('should route "init" to runInit', async () => {
    await main(['init']);
    expect(runInit).toHaveBeenCalledWith(expect.objectContaining({ rootDir: expect.any(String) }));
  });

  it('should route "analyze" to runAnalyze', async () => {
    await main(['analyze', '--json']);
    expect(runAnalyze).toHaveBeenCalledWith(expect.objectContaining({ json: true }));
  });

  it('should route "scan" as alias for analyze', async () => {
    await main(['scan']);
    expect(runAnalyze).toHaveBeenCalled();
  });

  it('should route "health" with --component flag', async () => {
    await main(['health', '--component', 'Button']);
    expect(runHealth).toHaveBeenCalledWith(expect.objectContaining({ component: 'Button' }));
  });

  it('should route "dashboard" with --port and --host flags', async () => {
    await main(['dashboard', '--port', '4000', '--host', '0.0.0.0']);
    expect(runDashboard).toHaveBeenCalledWith(
      expect.objectContaining({ port: 4000, host: '0.0.0.0' }),
    );
  });

  it('should route "cost" with --provider flag', async () => {
    await main(['cost', '--provider', 'vercel']);
    expect(runCost).toHaveBeenCalledWith(expect.objectContaining({ provider: 'vercel' }));
  });

  it('should route "upgrade" with package name and --to flag', async () => {
    await main(['upgrade', 'react', '--to', '19.0.0']);
    expect(runUpgrade).toHaveBeenCalledWith(
      expect.objectContaining({ packageName: 'react', targetVersion: '19.0.0' }),
    );
  });

  it('should error when "upgrade" is missing package name', async () => {
    await main(['upgrade']);
    expect(ui.error).toHaveBeenCalledWith(expect.stringContaining('specify a package name'));
    expect(process.exitCode).toBe(1);
  });

  it('should error when "upgrade" package name starts with --', async () => {
    await main(['upgrade', '--json']);
    expect(ui.error).toHaveBeenCalledWith(expect.stringContaining('specify a package name'));
    expect(process.exitCode).toBe(1);
  });

  it('should route "ci" with --base and --output flags', async () => {
    await main(['ci', '--base', './baseline', '--output', './report']);
    expect(runCI).toHaveBeenCalledWith(
      expect.objectContaining({ basePath: './baseline', outputPath: './report' }),
    );
  });

  it('should route "coverage" with --threshold flag', async () => {
    await main(['coverage', '--threshold', '80']);
    expect(runCoverage).toHaveBeenCalledWith(expect.objectContaining({ threshold: 80 }));
  });

  it('should route "dead-code" command', async () => {
    await main(['dead-code', '--json']);
    expect(runDeadCodeDetection).toHaveBeenCalledWith(expect.objectContaining({ json: true }));
  });

  it('should route "api-check" with --save flag', async () => {
    await main(['api-check', '--save']);
    expect(runAPICheck).toHaveBeenCalledWith(expect.objectContaining({ save: true }));
  });

  it('should pass --root flag to commands', async () => {
    await main(['analyze', '--root', '/my/project']);
    expect(runAnalyze).toHaveBeenCalledWith(
      expect.objectContaining({ rootDir: expect.stringContaining('my/project') }),
    );
  });

  it('should accept --dir as alias for --root', async () => {
    await main(['analyze', '--dir', '/my/project']);
    expect(runAnalyze).toHaveBeenCalledWith(
      expect.objectContaining({ rootDir: expect.stringContaining('my/project') }),
    );
  });
});

// -----------------------------------------------------------
// Help / version / unknown
// -----------------------------------------------------------

describe('main — help, version, unknown', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('should print help for "help" command', async () => {
    await main(['help']);
    const output = consoleSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('Usage:');
    expect(output).toContain('Commands:');
  });

  it('should print help for --help flag', async () => {
    await main(['--help']);
    const output = consoleSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('Usage:');
  });

  it('should print help when no command is given', async () => {
    await main([]);
    const output = consoleSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('Usage:');
  });

  it('should print version for --version flag', async () => {
    await main(['--version']);
    const output = consoleSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toMatch(/foxlight v\d+\.\d+\.\d+/);
  });

  it('should print version for -v flag', async () => {
    await main(['-v']);
    const output = consoleSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toMatch(/foxlight v\d+\.\d+\.\d+/);
  });

  it('should error on unknown command', async () => {
    await main(['foobar']);
    expect(ui.error).toHaveBeenCalledWith('Unknown command: foobar');
    expect(process.exitCode).toBe(1);
  });
});
