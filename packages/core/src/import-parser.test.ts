import { describe, it, expect } from 'vitest';
import { extractImportsFromScript } from './import-parser.js';

describe('extractImportsFromScript', () => {
  const FILE = '/src/App.tsx';

  it('extracts a default import', () => {
    const result = extractImportsFromScript(`import React from 'react';`, FILE);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      source: FILE,
      target: 'react',
      specifiers: [{ imported: 'default', local: 'React' }],
      typeOnly: false,
    });
  });

  it('extracts named imports', () => {
    const result = extractImportsFromScript(`import { useState, useEffect } from 'react';`, FILE);
    expect(result).toHaveLength(1);
    expect(result[0]!.target).toBe('react');
    expect(result[0]!.specifiers).toEqual([
      { imported: 'useState', local: 'useState' },
      { imported: 'useEffect', local: 'useEffect' },
    ]);
  });

  it('extracts mixed default + named imports', () => {
    const result = extractImportsFromScript(
      `import React, { useState } from 'react';`,
      FILE,
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.specifiers).toEqual([
      { imported: 'default', local: 'React' },
      { imported: 'useState', local: 'useState' },
    ]);
  });

  it('extracts namespace imports', () => {
    const result = extractImportsFromScript(`import * as path from 'node:path';`, FILE);
    expect(result).toHaveLength(1);
    expect(result[0]!.specifiers).toEqual([{ imported: '*', local: 'path' }]);
    expect(result[0]!.target).toBe('node:path');
  });

  it('extracts type-only imports', () => {
    const result = extractImportsFromScript(
      `import type { ComponentInfo } from '@foxlight/core';`,
      FILE,
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.typeOnly).toBe(true);
    expect(result[0]!.specifiers).toEqual([
      { imported: 'ComponentInfo', local: 'ComponentInfo' },
    ]);
  });

  it('handles aliased named imports', () => {
    const result = extractImportsFromScript(
      `import { default as MyLib, helper as h } from 'lib';`,
      FILE,
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.specifiers).toEqual([
      { imported: 'default', local: 'MyLib' },
      { imported: 'helper', local: 'h' },
    ]);
  });

  it('extracts multiple import statements', () => {
    const script = `
import React from 'react';
import { render } from 'react-dom';
import type { Props } from './types';
    `.trim();
    const result = extractImportsFromScript(script, FILE);
    expect(result).toHaveLength(3);
    expect(result.map((r) => r.target)).toEqual(['react', 'react-dom', './types']);
  });

  it('returns empty array when no imports are present', () => {
    const result = extractImportsFromScript('const x = 1;\nconsole.log(x);', FILE);
    expect(result).toEqual([]);
  });

  it('returns empty array for empty input', () => {
    const result = extractImportsFromScript('', FILE);
    expect(result).toEqual([]);
  });

  it('uses the provided filePath as the source', () => {
    const customPath = '/components/Button.vue';
    const result = extractImportsFromScript(`import Foo from 'foo';`, customPath);
    expect(result[0]!.source).toBe(customPath);
  });
});
