import { describe, it, expect } from 'vitest';
import {
  mapCoverageToComponents,
  getComponentCoverage,
  findUncoveredComponents,
  findLowCoverageComponents,
  summarizeCoverage,
} from './coverage-analyzer.js';

describe('Coverage Analyzer', () => {
  const mockCoverageData = {
    'src/Button.tsx': {
      path: 'src/Button.tsx',
      statementMap: {
        '1': { start: { line: 1 }, end: { line: 5 } },
        '2': { start: { line: 6 }, end: { line: 10 } },
      },
      fnMap: {
        '1': { name: 'Button', decl: { start: { line: 1 } } },
      },
      branchMap: {},
      s: { '1': 2, '2': 0 },
      f: { '1': 1 },
      b: {},
    },
    'src/Modal.tsx': {
      path: 'src/Modal.tsx',
      statementMap: {
        '1': { start: { line: 1 }, end: { line: 5 } },
        '2': { start: { line: 6 }, end: { line: 10 } },
      },
      fnMap: {
        '1': { name: 'Modal', decl: { start: { line: 1 } } },
      },
      branchMap: {},
      s: { '1': 0, '2': 0 },
      f: { '1': 0 },
      b: {},
    },
  };

  it('maps coverage data to components correctly', () => {
    const componentPaths = new Set(['src/Button.tsx', 'src/Modal.tsx']);
    const report = mapCoverageToComponents(mockCoverageData, componentPaths);

    expect(report.components.size).toBe(2);
    expect(report.totalStatementsTotal).toBe(4);
    expect(report.totalStatementsCovered).toBe(1);
  });

  it('calculates component coverage percentage', () => {
    const componentPaths = new Set(['src/Button.tsx']);
    const report = mapCoverageToComponents(mockCoverageData, componentPaths);

    const coverage = getComponentCoverage('src/Button.tsx', report);
    expect(coverage).toBeGreaterThan(0);
  });

  it('identifies uncovered components', () => {
    const componentPaths = new Set(['src/Button.tsx', 'src/Modal.tsx']);
    const report = mapCoverageToComponents(mockCoverageData, componentPaths);

    const uncovered = findUncoveredComponents(report);
    expect(uncovered.length).toBe(1);
    expect(uncovered[0]?.filePath).toBe('src/Modal.tsx');
  });

  it('finds low coverage components', () => {
    const componentPaths = new Set(['src/Button.tsx', 'src/Modal.tsx']);
    const report = mapCoverageToComponents(mockCoverageData, componentPaths);

    const lowCoverage = findLowCoverageComponents(report, 75);
    expect(lowCoverage.length).toBeGreaterThan(0);
  });

  it('generates coverage summary', () => {
    const componentPaths = new Set(['src/Button.tsx', 'src/Modal.tsx']);
    const report = mapCoverageToComponents(mockCoverageData, componentPaths);

    const summary = summarizeCoverage(report);
    expect(summary).toContain('Overall Coverage');
    expect(summary).toContain('0% coverage: 1');
  });
});
