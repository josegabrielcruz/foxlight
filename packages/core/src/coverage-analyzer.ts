// ============================================================
// @foxlight/core — Coverage Analyzer
//
// Reads test coverage data from Istanbul/nyc format and
// maps it to components. Calculates per-component coverage
// percentages to feed into health scoring.
// ============================================================

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

// -----------------------------------------------------------
// Types
// -----------------------------------------------------------

/** Istanbul coverage data for a single file. */
interface IstanbulCoverageFile {
  path: string;
  statementMap: Record<string, { start: { line: number }; end: { line: number } }>;
  fnMap: Record<string, { name: string; decl: { start: { line: number } } }>;
  branchMap: Record<string, { loc: { start: { line: number } } }>;
  s: Record<string, number>; // statement coverage count
  f: Record<string, number>; // function coverage count
  b: Record<string, number[]>; // branch coverage
}

export interface ComponentCoverage {
  componentId: string;
  filePath: string;
  statementsCovered: number;
  statementsTotal: number;
  functionsCovered: number;
  functionsTotal: number;
  percentage: number;
  isCovered: boolean;
}

export interface CoverageReport {
  components: Map<string, ComponentCoverage>;
  totalStatementsCovered: number;
  totalStatementsTotal: number;
  overallPercentage: number;
}

// -----------------------------------------------------------
// Coverage loading & parsing
// -----------------------------------------------------------

/**
 * Load coverage data from Istanbul JSON format.
 * Looks for coverage/coverage-final.json by default.
 */
export async function loadCoverageData(
  projectRoot: string,
  customCoveragePath?: string,
): Promise<Record<string, IstanbulCoverageFile>> {
  const coveragePath = customCoveragePath || join(projectRoot, 'coverage', 'coverage-final.json');

  if (!existsSync(coveragePath)) {
    return {};
  }

  try {
    const raw = await readFile(coveragePath, 'utf-8');
    return JSON.parse(raw) as Record<string, IstanbulCoverageFile>;
  } catch {
    return {};
  }
}

/**
 * Calculate coverage percentage for a file.
 */
function calculateFileCoverage(coverage: IstanbulCoverageFile): {
  statements: { covered: number; total: number };
  functions: { covered: number; total: number };
  percentage: number;
} {
  const statementsCovered = Object.values(coverage.s).filter((count) => count > 0).length;
  const statementsTotal = Object.keys(coverage.s).length;

  const functionsCovered = Object.values(coverage.f).filter((count) => count > 0).length;
  const functionsTotal = Object.keys(coverage.f).length;

  const totalCoveration = statementsTotal + functionsTotal;
  const coveredCount = statementsCovered + functionsCovered;

  const percentage = totalCoveration > 0 ? Math.round((coveredCount / totalCoveration) * 100) : 0;

  return {
    statements: { covered: statementsCovered, total: statementsTotal },
    functions: { covered: functionsCovered, total: functionsTotal },
    percentage,
  };
}

/**
 * Map coverage data to components.
 * Matches files in coverage data to component file paths.
 */
export function mapCoverageToComponents(
  coverageData: Record<string, IstanbulCoverageFile>,
  componentFilePaths: Set<string>,
): CoverageReport {
  const components = new Map<string, ComponentCoverage>();
  let totalStatementsCovered = 0;
  let totalStatementsTotal = 0;

  for (const [filePath, coverage] of Object.entries(coverageData)) {
    // Check if this file is a component
    if (!componentFilePaths.has(filePath) && !componentFilePaths.has(`./${filePath}`)) {
      continue;
    }

    const { statements, functions, percentage } = calculateFileCoverage(coverage);
    const componentId = filePath; // Typically filePath is used as component ID in Foxlight

    const componentCoverage: ComponentCoverage = {
      componentId,
      filePath,
      statementsCovered: statements.covered,
      statementsTotal: statements.total,
      functionsCovered: functions.covered,
      functionsTotal: functions.total,
      percentage,
      isCovered: percentage > 0,
    };

    components.set(filePath, componentCoverage);
    totalStatementsCovered += statements.covered;
    totalStatementsTotal += statements.total;
  }

  const overallPercentage =
    totalStatementsTotal > 0
      ? Math.round((totalStatementsCovered / totalStatementsTotal) * 100)
      : 0;

  return {
    components,
    totalStatementsCovered,
    totalStatementsTotal,
    overallPercentage,
  };
}

/**
 * Get coverage percentage for a component by file path or ID.
 * Returns 0 if no coverage data found (uncovered component).
 */
export function getComponentCoverage(componentFilePath: string, coverage: CoverageReport): number {
  const componentCoverage = coverage.components.get(componentFilePath);
  return componentCoverage?.percentage ?? 0;
}

/**
 * Find components with no test coverage (0% coverage).
 */
export function findUncoveredComponents(coverage: CoverageReport): ComponentCoverage[] {
  return Array.from(coverage.components.values()).filter((c) => c.percentage === 0);
}

/**
 * Find components with low test coverage (below threshold).
 */
export function findLowCoverageComponents(
  coverage: CoverageReport,
  threshold: number = 50,
): ComponentCoverage[] {
  return Array.from(coverage.components.values()).filter(
    (c) => c.percentage > 0 && c.percentage < threshold,
  );
}

/**
 * Generate a coverage report summary.
 */
export function summarizeCoverage(coverage: CoverageReport): string {
  const uncovered = findUncoveredComponents(coverage);
  const lowCoverage = findLowCoverageComponents(coverage, 50);

  return [
    `Overall Coverage: ${coverage.overallPercentage}%`,
    `Statements: ${coverage.totalStatementsCovered}/${coverage.totalStatementsTotal}`,
    `Components with 0% coverage: ${uncovered.length}`,
    `Components with <50% coverage: ${lowCoverage.length}`,
  ].join('\n');
}
