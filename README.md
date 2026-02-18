# 🦊 Foxlight

[![CI](https://github.com/josegabrielcruz/foxlight/actions/workflows/ci.yml/badge.svg)](https://github.com/josegabrielcruz/foxlight/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@foxlight/cli.svg)](https://www.npmjs.com/org/foxlight)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](https://nodejs.org)

**Open-source front-end intelligence platform.**

Foxlight gives front-end teams visibility into the things that are easy to lose track of as a codebase grows: which components are healthy, which dependencies are risky to upgrade, and how much your bundle actually costs to serve.

It plugs into your existing build tools and CI pipelines — no vendor lock-in, no dashboards to pay for.

## Status

🚧 **Early stage (v0.2.0).** Foxlight is under active development. The core features are working and tested, but the API and CLI may change before reaching 1.0. Feedback and contributions are welcome — [open an issue](https://github.com/josegabrielcruz/foxlight/issues) if you hit problems or have ideas.

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

### 📋 Test Coverage Tracking

Foxlight reads test coverage data from Jest, Vitest, or nyc and maps it to your components. See exactly which components have no test coverage and which ones fall below your coverage threshold. Coverage data feeds into health scoring so teams can track testing progress over time.

### 🗑️ Dead Code Detection

Identify unused components, orphaned code branches, and exports that are defined but never imported. Foxlight calculates potential bundle size savings for each unused component, making it easy to prioritize cleanup and safely remove dead weight from your codebase.

### ⚠️ Breaking Change Detection

Before merging, Foxlight detects when component APIs change in breaking ways — props are removed, exports disappear, or export kinds change. It maintains API baselines so you can catch these changes early and prevent shipping breaking changes to downstream consumers.

## Who It's For

- **Front-end teams** that want to keep their component library healthy as it grows
- **Tech leads and architects** who need visibility into dependency risk and bundle bloat
- **Platform/infra engineers** who want to connect front-end decisions to hosting costs
- **Open-source maintainers** who want to catch regressions before they ship

Foxlight is framework-agnostic (React, Vue, Svelte), works with popular bundlers (Vite, Webpack), and runs entirely in your own infrastructure — no data leaves your CI.

## Switching to Foxlight

If your team already uses tools like **Bundlemon**, **size-limit**, **bundlesize**, or manual spreadsheet tracking, switching to Foxlight is designed to be low-friction:

1. **No rip-and-replace required.** You can run Foxlight alongside your existing tools. Start with `foxlight analyze` to see what it finds — there's nothing to uninstall first.
2. **Works with your current setup.** Foxlight reads your existing source files and plugs into the bundlers you're already using (Vite, Webpack). There's no special file format or project restructuring needed.
3. **One config file.** Drop a `.foxlight.json` in your project root to tell it where your components live. Most teams need fewer than five lines of config.
4. **Gradual rollout.** Start with component discovery and health scores locally. When you're ready, add the build plugin for bundle tracking. CI integration can come last — each piece is independent.
5. **Nothing to host.** Foxlight runs in your terminal and your CI pipeline. There's no dashboard server to deploy, no accounts to create, and no data sent to third parties.

Teams that currently track bundle sizes manually or through fragmented tools typically get full visibility within a single sprint.

## Framework Support

Foxlight works out of the box with **React**, **Vue**, **Svelte**, **Angular**, and **Web Components** (Lit). The framework is auto-detected from your `package.json`.

### Next.js

Next.js projects are fully supported — Foxlight auto-detects React, scans `app/`, `pages/`, and `src/` directories, and excludes `.next/` build output by default. Standard React components are discovered automatically.

> **Planned enhancement:** Next.js App Router conventions use file-based routing with lowercase exports like `page.tsx`, `layout.tsx`, and `loading.tsx`. These files aren't always detected as components by the current PascalCase heuristic. A future release will add Next.js–aware detection to recognize route-level files as components regardless of naming convention.

### Nuxt

Nuxt projects work through Foxlight's Vue support. `.vue` single-file components are parsed and analyzed. The `.nuxt/` build directory is excluded by default.

---

## Installation

Install Foxlight in your project:

```bash
npm install @foxlight/cli
npx foxlight init
npx foxlight analyze
npx foxlight health
```

For a full walkthrough of available commands, see [CLI Commands](#cli-commands) below.

## Development

To work on Foxlight itself, clone the repository and set up the monorepo:

```bash
# Install dependencies and build all packages
npm install
npm run build

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
```

## CLI Commands

| Command                  | Description                               |
| ------------------------ | ----------------------------------------- |
| `foxlight init`          | Initialize Foxlight in your project       |
| `foxlight analyze`       | Scan and discover components              |
| `foxlight health`        | Component health dashboard                |
| `foxlight cost`          | Estimate hosting costs                    |
| `foxlight upgrade <pkg>` | Dependency upgrade impact analysis        |
| `foxlight coverage`      | Show test coverage by component           |
| `foxlight dead-code`     | Find unused components and exports        |
| `foxlight api-check`     | Detect breaking changes in component APIs |

All commands support `--json` for machine-readable output and `--root <dir>` to specify the project root.

### Test Coverage

```bash
# Generate coverage (works with Jest, Vitest, etc.)
npm test -- --coverage

# Show coverage by component
npx foxlight coverage

# Show only low-coverage components
npx foxlight coverage --threshold 50

# Get machine-readable output
npx foxlight coverage --json
```

By default, Foxlight expects coverage data in `coverage/coverage-final.json` (Istanbul format). You can specify a custom path with `--coverage <path>`.

### Dead Code Detection

```bash
# Find unused components and exports
npx foxlight dead-code

# Output as JSON
npx foxlight dead-code --json
```

This command identifies:

- **Unused components** — components that are never imported or used
- **Orphaned components** — components only used by other unused components
- **Unused exports** — exports that are defined but never imported

Output includes estimated bundle size savings if bundle tracking is enabled.

### API Breaking Changes

```bash
# Create an initial API baseline
npx foxlight api-check --save

# Check for breaking changes
npx foxlight api-check

# Update baseline after reviewing changes
npx foxlight api-check --save
```

The `api-check` command detects:

- **Prop removals** — required props that are removed
- **Export removals** — exports that are removed
- **Export kind changes** — changes from named to default exports or vice versa

It maintains a baseline snapshot in `.foxlight/api-baseline.json` to track changes across commits. Use `--save` to update the baseline.

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

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

## License

[MIT](LICENSE)
