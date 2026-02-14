import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ComponentInfo, UpgradePreview } from './types.js';

// -----------------------------------------------------------
// Mock child_process and fs BEFORE importing the module
// -----------------------------------------------------------

vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
}));

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
let analyzeUpgrade: typeof import('./upgrade-analyzer.js').analyzeUpgrade;
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
let analyzeUpgrades: typeof import('./upgrade-analyzer.js').analyzeUpgrades;
let execFileMock: ReturnType<typeof vi.fn>;
let readFileMock: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  vi.resetModules();
  vi.resetAllMocks();

  const cp = await import('node:child_process');
  const fs = await import('node:fs/promises');

  execFileMock = cp.execFile as unknown as ReturnType<typeof vi.fn>;
  readFileMock = fs.readFile as unknown as ReturnType<typeof vi.fn>;

  // Default: make execFile callback-based mock work with promisify
  execFileMock.mockImplementation(
    (
      _cmd: string,
      _args: string[],
      _opts: unknown,
      cb?: (err: Error | null, result: { stdout: string; stderr: string }) => void,
    ) => {
      if (cb) cb(null, { stdout: '', stderr: '' });
    },
  );

  // Default: readFile returns a basic package.json
  readFileMock.mockResolvedValue(
    JSON.stringify({
      dependencies: { react: '^18.2.0' },
      devDependencies: { vitest: '^2.0.0' },
    }),
  );

  const mod = await import('./upgrade-analyzer.js');
  analyzeUpgrade = mod.analyzeUpgrade;
  analyzeUpgrades = mod.analyzeUpgrades;
});

// -----------------------------------------------------------
// Helper to set up npm view responses
// -----------------------------------------------------------

function mockNpmView(responses: Record<string, string>) {
  execFileMock.mockImplementation(
    (
      _cmd: string,
      args: string[],
      _opts: unknown,
      cb?: (err: Error | null, result: { stdout: string; stderr: string }) => void,
    ) => {
      const argStr = args.join(' ');
      for (const [key, value] of Object.entries(responses)) {
        if (argStr.includes(key)) {
          if (cb) cb(null, { stdout: value, stderr: '' });
          return;
        }
      }
      // Fallback: empty stdout
      if (cb) cb(null, { stdout: '', stderr: '' });
    },
  );
}

function makeComponent(name: string, deps: string[] = []): ComponentInfo {
  return {
    id: `${name}.tsx#${name}`,
    name,
    filePath: `/src/${name}.tsx`,
    line: 1,
    framework: 'react',
    exportKind: 'named',
    props: [],
    children: [],
    usedBy: [],
    dependencies: deps,
    metadata: {},
  };
}

// -----------------------------------------------------------
// analyzeUpgrade
// -----------------------------------------------------------

describe('analyzeUpgrade', () => {
  it('returns an upgrade preview with checks', async () => {
    mockNpmView({
      version: '19.0.0',
      peerDependencies: '',
      deprecated: '',
    });

    const result = await analyzeUpgrade({
      rootDir: '/project',
      packageName: 'react',
      targetVersion: '19.0.0',
    });

    expect(result.packageName).toBe('react');
    expect(result.fromVersion).toBe('18.2.0');
    expect(result.toVersion).toBe('19.0.0');
    expect(result.checks.length).toBeGreaterThanOrEqual(1);
    expect(['low', 'medium', 'high']).toContain(result.risk);
  });

  it('detects major version bump as high risk', async () => {
    mockNpmView({
      version: '19.0.0',
      peerDependencies: '',
      deprecated: '',
    });

    const result = await analyzeUpgrade({
      rootDir: '/project',
      packageName: 'react',
      targetVersion: '19.0.0',
    });

    const semverCheck = result.checks.find((c) => c.name === 'Semver Analysis');
    expect(semverCheck).toBeDefined();
    expect(semverCheck!.status).toBe('fail');
    expect(semverCheck!.summary).toContain('Major');
  });

  it('detects minor version bump as warning', async () => {
    mockNpmView({
      version: '18.3.0',
      peerDependencies: '',
      deprecated: '',
    });

    const result = await analyzeUpgrade({
      rootDir: '/project',
      packageName: 'react',
      targetVersion: '18.3.0',
    });

    const semverCheck = result.checks.find((c) => c.name === 'Semver Analysis');
    expect(semverCheck!.status).toBe('warn');
  });

  it('detects patch version bump as pass', async () => {
    mockNpmView({
      version: '18.2.1',
      peerDependencies: '',
      deprecated: '',
    });

    const result = await analyzeUpgrade({
      rootDir: '/project',
      packageName: 'react',
      targetVersion: '18.2.1',
    });

    const semverCheck = result.checks.find((c) => c.name === 'Semver Analysis');
    expect(semverCheck!.status).toBe('pass');
  });

  it('reports affected components', async () => {
    mockNpmView({
      version: '19.0.0',
      peerDependencies: '',
      deprecated: '',
    });

    const components = [makeComponent('Button', ['react']), makeComponent('Card', ['react'])];

    const result = await analyzeUpgrade({
      rootDir: '/project',
      packageName: 'react',
      targetVersion: '19.0.0',
      affectedComponents: components,
    });

    const impactCheck = result.checks.find((c) => c.name === 'Component Impact');
    expect(impactCheck).toBeDefined();
    expect(impactCheck!.summary).toContain('2 component(s)');
  });

  it('passes component impact when no components are affected', async () => {
    mockNpmView({
      version: '19.0.0',
      peerDependencies: '',
      deprecated: '',
    });

    const result = await analyzeUpgrade({
      rootDir: '/project',
      packageName: 'react',
      targetVersion: '19.0.0',
      affectedComponents: [],
    });

    const impactCheck = result.checks.find((c) => c.name === 'Component Impact');
    expect(impactCheck!.status).toBe('pass');
  });

  it('uses latest version when targetVersion is omitted', async () => {
    mockNpmView({
      version: '19.1.0',
      peerDependencies: '',
      deprecated: '',
    });

    const result = await analyzeUpgrade({
      rootDir: '/project',
      packageName: 'react',
    });

    expect(result.toVersion).toBe('19.1.0');
  });

  it('returns 0.0.0 for unknown packages in package.json', async () => {
    mockNpmView({
      version: '1.0.0',
      peerDependencies: '',
      deprecated: '',
    });

    const result = await analyzeUpgrade({
      rootDir: '/project',
      packageName: 'unknown-package',
      targetVersion: '1.0.0',
    });

    expect(result.fromVersion).toBe('0.0.0');
  });
});

// -----------------------------------------------------------
// analyzeUpgrades
// -----------------------------------------------------------

describe('analyzeUpgrades', () => {
  it('returns results for each package', async () => {
    mockNpmView({
      version: '19.0.0',
      peerDependencies: '',
      deprecated: '',
    });

    const results = await analyzeUpgrades('/project', [
      { name: 'react', targetVersion: '19.0.0' },
      { name: 'vitest', targetVersion: '3.0.0' },
    ]);

    expect(results).toHaveLength(2);
    expect(results[0]!.packageName).toBe('react');
    expect(results[1]!.packageName).toBe('vitest');
  });

  it('filters affected components by package', async () => {
    mockNpmView({
      version: '19.0.0',
      peerDependencies: '',
      deprecated: '',
    });

    const components = [
      makeComponent('Button', ['react']),
      makeComponent('TestRunner', ['vitest']),
    ];

    const results = await analyzeUpgrades(
      '/project',
      [{ name: 'react', targetVersion: '19.0.0' }],
      components,
    );

    const impactCheck = results[0]!.checks.find((c) => c.name === 'Component Impact');
    expect(impactCheck!.summary).toContain('1 component(s)');
  });
});
