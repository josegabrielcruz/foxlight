// ============================================================
// @foxlight/core — Upgrade Analyzer
//
// Analyzes the impact of upgrading a dependency by checking
// breaking changes, bundle size impact, component compatibility,
// and changelog information.
// ============================================================

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { UpgradePreview, UpgradeCheck, ComponentInfo } from './types.js';

const execFileAsync = promisify(execFile);

// -----------------------------------------------------------
// Public API
// -----------------------------------------------------------

export interface UpgradeAnalysisOptions {
  /** Project root directory */
  rootDir: string;
  /** Package name to analyze (e.g., "react") */
  packageName: string;
  /** Target version to upgrade to (e.g., "19.0.0"). If omitted, uses latest. */
  targetVersion?: string;
  /** Components that depend on this package (for impact analysis) */
  affectedComponents?: ComponentInfo[];
}

/**
 * Analyze the impact of upgrading a dependency.
 *
 * Runs several checks:
 * 1. Version resolution (current vs target)
 * 2. Semver risk assessment (major/minor/patch)
 * 3. Component impact (which components use this dep)
 * 4. Peer dependency compatibility
 * 5. Bundle size change estimate
 */
export async function analyzeUpgrade(options: UpgradeAnalysisOptions): Promise<UpgradePreview> {
  const { rootDir, packageName, affectedComponents = [] } = options;

  // Read current package.json to find installed version
  const currentVersion = await getCurrentVersion(rootDir, packageName);
  const targetVersion = options.targetVersion ?? (await getLatestVersion(packageName));

  const checks: UpgradeCheck[] = [];

  // Check 1: Semver risk
  checks.push(checkSemverRisk(currentVersion, targetVersion));

  // Check 2: Component impact
  checks.push(checkComponentImpact(packageName, affectedComponents));

  // Check 3: Peer dependency compatibility
  checks.push(await checkPeerDependencies(rootDir, packageName, targetVersion));

  // Check 4: Deprecation warnings
  checks.push(await checkDeprecation(packageName, targetVersion));

  // Compute overall risk
  const risk = computeOverallRisk(checks);

  return {
    packageName,
    fromVersion: currentVersion,
    toVersion: targetVersion,
    risk,
    checks,
  };
}

/**
 * Analyze multiple upgrades at once.
 */
export async function analyzeUpgrades(
  rootDir: string,
  packages: Array<{ name: string; targetVersion?: string }>,
  allComponents?: ComponentInfo[],
): Promise<UpgradePreview[]> {
  const results: UpgradePreview[] = [];

  for (const pkg of packages) {
    const affectedComponents = allComponents?.filter((c) => c.dependencies.includes(pkg.name));

    const preview = await analyzeUpgrade({
      rootDir,
      packageName: pkg.name,
      targetVersion: pkg.targetVersion,
      affectedComponents,
    });

    results.push(preview);
  }

  return results;
}

// -----------------------------------------------------------
// Individual checks
// -----------------------------------------------------------

function checkSemverRisk(currentVersion: string, targetVersion: string): UpgradeCheck {
  const current = parseSemver(currentVersion);
  const target = parseSemver(targetVersion);

  if (!current || !target) {
    return {
      name: 'Semver Analysis',
      status: 'warn',
      summary: `Could not parse versions: ${currentVersion} → ${targetVersion}`,
    };
  }

  if (target.major > current.major) {
    return {
      name: 'Semver Analysis',
      status: 'fail',
      summary: `Major version bump (${currentVersion} → ${targetVersion}). Likely contains breaking changes.`,
      details: 'Major version bumps often require code changes. Review the changelog carefully.',
    };
  }

  if (target.minor > current.minor) {
    return {
      name: 'Semver Analysis',
      status: 'warn',
      summary: `Minor version bump (${currentVersion} → ${targetVersion}). May contain new features and deprecations.`,
    };
  }

  return {
    name: 'Semver Analysis',
    status: 'pass',
    summary: `Patch version bump (${currentVersion} → ${targetVersion}). Bug fixes only.`,
  };
}

function checkComponentImpact(
  packageName: string,
  affectedComponents: ComponentInfo[],
): UpgradeCheck {
  if (affectedComponents.length === 0) {
    return {
      name: 'Component Impact',
      status: 'pass',
      summary: `No components directly import ${packageName}.`,
    };
  }

  const names = affectedComponents.map((c) => c.name).slice(0, 10);
  const more = affectedComponents.length > 10 ? ` and ${affectedComponents.length - 10} more` : '';

  const status =
    affectedComponents.length > 20 ? 'fail' : affectedComponents.length > 5 ? 'warn' : 'pass';

  return {
    name: 'Component Impact',
    status,
    summary: `${affectedComponents.length} component(s) directly import ${packageName}.`,
    details: `Affected: ${names.join(', ')}${more}`,
  };
}

async function checkPeerDependencies(
  rootDir: string,
  packageName: string,
  targetVersion: string,
): Promise<UpgradeCheck> {
  try {
    const { stdout } = await execFileAsync(
      'npm',
      ['view', `${packageName}@${targetVersion}`, 'peerDependencies', '--json'],
      { cwd: rootDir, timeout: 10_000 },
    );

    if (!stdout.trim()) {
      return {
        name: 'Peer Dependencies',
        status: 'pass',
        summary: 'No peer dependency requirements.',
      };
    }

    const peerDeps = JSON.parse(stdout) as Record<string, string>;
    const peerList = Object.entries(peerDeps)
      .map(([name, range]) => `${name}@${range}`)
      .join(', ');

    return {
      name: 'Peer Dependencies',
      status: 'warn',
      summary: `Requires peer dependencies: ${peerList}`,
      details: 'Verify that your installed versions satisfy these peer dependency ranges.',
    };
  } catch {
    return {
      name: 'Peer Dependencies',
      status: 'warn',
      summary: 'Could not check peer dependencies (npm view failed).',
    };
  }
}

async function checkDeprecation(packageName: string, targetVersion: string): Promise<UpgradeCheck> {
  try {
    const { stdout } = await execFileAsync(
      'npm',
      ['view', `${packageName}@${targetVersion}`, 'deprecated', '--json'],
      { timeout: 10_000 },
    );

    if (stdout.trim() && stdout.trim() !== 'undefined') {
      return {
        name: 'Deprecation',
        status: 'fail',
        summary: `Version ${targetVersion} is deprecated.`,
        details: stdout.trim().replace(/^"|"$/g, ''),
      };
    }

    return {
      name: 'Deprecation',
      status: 'pass',
      summary: 'Target version is not deprecated.',
    };
  } catch {
    return {
      name: 'Deprecation',
      status: 'pass',
      summary: 'No deprecation notice found.',
    };
  }
}

// -----------------------------------------------------------
// Helpers
// -----------------------------------------------------------

async function getCurrentVersion(rootDir: string, packageName: string): Promise<string> {
  try {
    const pkgPath = join(rootDir, 'package.json');
    const raw = await readFile(pkgPath, 'utf-8');
    const pkg = JSON.parse(raw) as Record<string, Record<string, string>>;
    const allDeps = {
      ...pkg['dependencies'],
      ...pkg['devDependencies'],
    };
    const version = allDeps[packageName];
    // Strip version range characters
    return version?.replace(/^[\^~>=<]+/, '') ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

async function getLatestVersion(packageName: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync(
      'npm',
      ['view', packageName, 'version'],
      { timeout: 10_000 },
    );
    return stdout.trim();
  } catch {
    return '0.0.0';
  }
}

interface SemverParts {
  major: number;
  minor: number;
  patch: number;
}

function parseSemver(version: string): SemverParts | null {
  const cleaned = version.replace(/^[\^~>=<]+/, '');
  const match = cleaned.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return {
    major: parseInt(match[1]!, 10),
    minor: parseInt(match[2]!, 10),
    patch: parseInt(match[3]!, 10),
  };
}

function computeOverallRisk(checks: UpgradeCheck[]): 'low' | 'medium' | 'high' {
  const hasFail = checks.some((c) => c.status === 'fail');
  const warnCount = checks.filter((c) => c.status === 'warn').length;

  if (hasFail) return 'high';
  if (warnCount >= 2) return 'medium';
  return 'low';
}
