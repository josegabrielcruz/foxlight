# 🦊 Foxlight

[![CI](https://github.com/josegabrielcruz/foxlight/actions/workflows/ci.yml/badge.svg)](https://github.com/josegabrielcruz/foxlight/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](https://nodejs.org)

**Open-source front-end intelligence platform.**

Component health tracking, dependency upgrade previews, and infrastructure cost analysis — all free, self-hostable, and designed to work together.

## Features

- 🔍 **Static Analysis** — AST-based component detection for React, Vue, Svelte, and more
- 📦 **Bundle Tracking** — per-component size analysis via Vite and Webpack plugins
- 🏥 **Health Scoring** — 6-metric weighted dashboard (bundle size, test coverage, accessibility, freshness, performance, reliability)
- 💰 **Cost Estimation** — hosting cost projections for Vercel, Netlify, AWS, and Cloudflare
- ⬆️ **Upgrade Previews** — impact analysis before upgrading dependencies
- 🤖 **CI Integration** — GitHub PR comments, Check Runs, and GitLab MR notes

## Quick Start

```bash
# Install and build
npm install
npm run build

# Initialize in your project
npx foxlight init

# Analyze your project
npx foxlight analyze

# View component health
npx foxlight health
```

## CLI Commands

| Command                  | Description                         |
| ------------------------ | ----------------------------------- |
| `foxlight init`          | Initialize Foxlight in your project |
| `foxlight analyze`       | Scan and discover components        |
| `foxlight health`        | Component health dashboard          |
| `foxlight cost`          | Estimate hosting costs              |
| `foxlight upgrade <pkg>` | Dependency upgrade impact analysis  |

All commands support `--json` for machine-readable output and `--root <dir>` to specify the project root.

## Build Plugins

### Vite

```typescript
// vite.config.ts
import { foxlightVitePlugin } from '@foxlight/bundle/vite';

export default defineConfig({
  plugins: [foxlightVitePlugin()],
});
```

### Webpack

```typescript
// webpack.config.js
import { FoxlightWebpackPlugin } from '@foxlight/bundle/webpack';

export default {
  plugins: [new FoxlightWebpackPlugin()],
};
```

## Configuration

Create `.foxlight.json` in your project root:

```json
{
  "include": ["src/**/*.{ts,tsx,js,jsx,vue,svelte}"],
  "exclude": ["**/*.test.*", "**/*.spec.*"],
  "framework": "react"
}
```

| Option      | Type       | Default                                | Description                                             |
| ----------- | ---------- | -------------------------------------- | ------------------------------------------------------- |
| `include`   | `string[]` | `["src/**/*.{ts,tsx,js,jsx}"]`         | Glob patterns for files to analyze                      |
| `exclude`   | `string[]` | `["**/node_modules/**", "**/dist/**"]` | Glob patterns to exclude                                |
| `framework` | `string`   | auto-detected                          | `react`, `vue`, `svelte`, `angular`, or `web-component` |

## CI Integration

### GitHub Actions

```yaml
- run: npx foxlight ci
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

Foxlight will automatically post PR comments with component diffs and create Check Runs with pass/fail results.

### GitLab CI

```yaml
foxlight:
  script: npx foxlight ci
  rules:
    - if: $CI_MERGE_REQUEST_IID
```

## Packages

| Package                                   | Description                                                                              |
| ----------------------------------------- | ---------------------------------------------------------------------------------------- |
| [`@foxlight/core`](packages/core)         | Shared data types, component registry, dependency graph, health scoring, cost estimation |
| [`@foxlight/analyzer`](packages/analyzer) | Static analysis engine — AST scanning, component detection, Vue/Svelte parsing           |
| [`@foxlight/bundle`](packages/bundle)     | Bundle size analysis — Vite and Webpack plugins                                          |
| [`@foxlight/cli`](packages/cli)           | Command-line interface                                                                   |
| [`@foxlight/ci`](packages/ci)             | CI/CD integration — GitHub Actions, GitLab CI                                            |

## Architecture

```
packages/
├── core/       ← Shared data layer (types, registry, graph, scoring, cost)
├── analyzer/   ← Static analysis (AST, imports, Vue/Svelte parsers)
├── bundle/     ← Build plugins (Vite + Webpack size tracking)
├── cli/        ← Developer-facing CLI
└── ci/         ← CI integration (GitHub, GitLab)
```

All packages share the core data layer. The analyzer scans codebases to build a component registry, the bundle plugin tracks size at build time, and the CLI/CI packages provide the interface.

## Development

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Type-check all packages
npm run typecheck

# Lint
npm run lint

# Format
npm run format

# Build all packages
npm run build
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

## License

[MIT](LICENSE)
