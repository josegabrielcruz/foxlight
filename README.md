# 🦊 Foxlight

[![CI](https://github.com/josegabrielcruz/foxlight/actions/workflows/ci.yml/badge.svg)](https://github.com/josegabrielcruz/foxlight/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](https://nodejs.org)

**Open-source front-end intelligence platform.**

Foxlight gives front-end teams visibility into the things that are easy to lose track of as a codebase grows: which components are healthy, which dependencies are risky to upgrade, and how much your bundle actually costs to serve.

It plugs into your existing build tools and CI pipelines — no vendor lock-in, no dashboards to pay for.

## The Problem

As front-end projects scale, a few questions get harder to answer:

- **"Is this component still healthy?"** — It might have ballooned in size, lost test coverage, or fallen behind on accessibility. Without a single place to check, these things slip through the cracks.
- **"Is it safe to upgrade this dependency?"** — A major version bump could affect dozens of components. Most teams find out the hard way.
- **"How much is our bundle actually costing us?"** — Larger bundles mean more bandwidth, more CDN spend, and slower pages. But connecting bundle size to real dollar amounts usually takes guesswork.
- **"What changed in this PR?"** — Code review catches logic bugs, but not the ripple effects on bundle size, component health, or dependency risk.

Foxlight answers all of these automatically.

## What It Does

### 🔍 Component Discovery
Foxlight scans your codebase and builds a registry of every component — React, Vue, or Svelte. It maps out how components relate to each other: what imports what, which components are reused, and where your dependency tree gets deep.

### 🏥 Health Scoring
Each component gets a health score from 0–100, based on six weighted metrics: **bundle size**, **test coverage**, **accessibility**, **freshness** (how recently it was updated), **performance**, and **reliability**. This gives your team a single number to track over time and a quick way to spot components that need attention.

### 💰 Cost Estimation
Foxlight takes your bundle size data and estimates what it costs to serve — per month, per hosting provider. It supports Vercel, Netlify, AWS, and Cloudflare pricing models out of the box. When a PR increases your bundle, you'll see the projected cost impact before it ships.

### ⬆️ Upgrade Previews
Before upgrading a dependency, Foxlight tells you what's at stake: which components depend on it, whether the version jump includes breaking changes, and how many files would be affected. Think of it as a pre-flight check for `npm update`.

### 📦 Bundle Tracking
Vite and Webpack plugins track per-component bundle sizes at build time. Instead of just knowing your total bundle got bigger, you can see exactly which component caused it.

### 🤖 CI Integration
Drop Foxlight into your GitHub Actions or GitLab CI pipeline and it will automatically comment on PRs with a summary of what changed — new components, removed components, bundle size diffs, and health score changes. It also creates GitHub Check Runs with pass/fail results.

## Who It's For

- **Front-end teams** that want to keep their component library healthy as it grows
- **Tech leads and architects** who need visibility into dependency risk and bundle bloat
- **Platform/infra engineers** who want to connect front-end decisions to hosting costs
- **Open-source maintainers** who want to catch regressions before they ship

Foxlight is framework-agnostic (React, Vue, Svelte), works with popular bundlers (Vite, Webpack), and runs entirely in your own infrastructure — no data leaves your CI.

---

## Getting Started

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
