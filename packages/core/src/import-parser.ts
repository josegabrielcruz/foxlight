// ============================================================
// @foxlight/core — Import Parser
//
// Shared regex-based import extraction used by the Vue SFC
// parser, Svelte parser, and as a lightweight fallback when
// the TypeScript compiler API isn't available.
// ============================================================

import type { ImportEdge, ImportSpecifier } from './types.js';

/**
 * Extract ES module import statements from a script string
 * using regex matching. Handles:
 * - Default imports: `import Foo from '...'`
 * - Named imports: `import { a, b } from '...'`
 * - Mixed imports: `import Foo, { a } from '...'`
 * - Namespace imports: `import * as Foo from '...'`
 * - Type imports: `import type { ... } from '...'`
 *
 * @param script — The JavaScript/TypeScript source text to scan.
 * @param filePath — The file this script belongs to (used as the `source` in ImportEdge).
 */
export function extractImportsFromScript(script: string, filePath: string): ImportEdge[] {
  const imports: ImportEdge[] = [];
  const importRegex =
    /import\s+(?:(?:type\s+)?(?:(\{[^}]+\})|(\w+)(?:\s*,\s*(\{[^}]+\}))?|(\*\s+as\s+\w+)))\s+from\s+['"]([^'"]+)['"]/g;

  let match;
  while ((match = importRegex.exec(script)) !== null) {
    const target = match[5]!;
    const specifiers: ImportSpecifier[] = [];

    // Default import
    if (match[2]) {
      specifiers.push({ imported: 'default', local: match[2] });
    }

    // Named imports { a, b }
    const namedBlock = match[1] ?? match[3];
    if (namedBlock) {
      const names = namedBlock
        .replace(/[{}]/g, '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      for (const name of names) {
        const parts = name.split(/\s+as\s+/);
        specifiers.push({
          imported: parts[0]!.replace(/^type\s+/, '').trim(),
          local: (parts[1] ?? parts[0]!).trim(),
        });
      }
    }

    // Namespace import
    if (match[4]) {
      const nsName = match[4].replace('* as ', '').trim();
      specifiers.push({ imported: '*', local: nsName });
    }

    imports.push({
      source: filePath,
      target,
      specifiers,
      typeOnly: /import\s+type\s/.test(match[0]!),
    });
  }

  return imports;
}
