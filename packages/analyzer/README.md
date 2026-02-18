# @foxlight/analyzer

Static analysis engine for [Foxlight](https://github.com/josegabrielcruz/foxlight) — the open-source front-end intelligence platform.

## What's Inside

- **AST Scanner** — TypeScript compiler API-based extraction of imports, exports, JSX usage, and function declarations
- **Component Detector** — heuristic detection of React/Vue/Svelte components with cross-referencing
- **Prop Extractor** — TypeScript type-checker based prop extraction with defaults and JSDoc descriptions
- **Vue SFC Parser** — parses `.vue` Single File Components (`<script setup>`, `defineProps`, template scanning)
- **Svelte Parser** — parses `.svelte` files (`export let` props, module scripts, template child detection)
- **Project Analyzer** — orchestrates full-project analysis with glob matching, multi-framework support, and dependency graph construction

## Installation

```bash
npm install @foxlight/analyzer
```

> **Note:** `typescript` is a peer dependency. Make sure it's installed in your project.

## Usage

```typescript
import { analyzeProject, analyzeFile, detectComponents } from '@foxlight/analyzer';

// Analyze an entire project
const result = await analyzeProject('/path/to/project');
console.log(result.stats.componentsFound);
console.log(result.registry.getAllComponents());

// Analyze a single file
const fileAnalysis = await analyzeFile('/path/to/Button.tsx');
const components = detectComponents(fileAnalysis, 'react');

// Parse Vue SFCs
import { parseVueSFC } from '@foxlight/analyzer';
const vue = parseVueSFC(sourceCode, 'MyComponent.vue');

// Parse Svelte files
import { parseSvelteFile } from '@foxlight/analyzer';
const svelte = parseSvelteFile(sourceCode, 'Counter.svelte');
```

## License

MIT
