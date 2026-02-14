import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Prefer named exports (project convention)
      'no-restricted-exports': ['error', { restrictDefaultExports: { direct: true } }],
      // Require node: protocol for Node.js built-ins
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'assert',
                'buffer',
                'child_process',
                'crypto',
                'events',
                'fs',
                'fs/promises',
                'http',
                'https',
                'net',
                'os',
                'path',
                'querystring',
                'stream',
                'url',
                'util',
                'zlib',
              ],
              message: 'Use node: protocol for Node.js built-ins (e.g. "node:fs").',
            },
          ],
        },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-empty-object-type': 'off',
    },
  },
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/*.config.*'],
  },
);
