# Foxlight

**Open-source front-end intelligence platform.**

Component health tracking, dependency upgrade previews, and infrastructure cost analysis — all free, self-hostable, and designed to work together.

## Packages

| Package           | Description                                                |
| ----------------- | ---------------------------------------------------------- |
| `@foxlight/core`     | Shared data types, component registry, dependency graph    |
| `@foxlight/analyzer` | Static analysis engine — AST scanning, component detection |
| `@foxlight/bundle`   | Bundle size analysis — Vite and Webpack plugins            |
| `@foxlight/cli`      | Command-line interface                                     |
| `@foxlight/ci`       | CI/CD integration — GitHub Actions, PR comments            |

## Quick Start

```bash
npm install
npm run build
npm test
```

## Development

```bash
# Run tests in watch mode
npm run test:watch

# Type-check all packages
npm run typecheck

# Build all packages
npm run build
```

## Architecture

```
packages/
├── core/       ← Shared data layer (types, registry, graph)
├── analyzer/   ← Static analysis (AST, imports, frameworks)
├── bundle/     ← Build plugin (size tracking per component)
├── cli/        ← Developer-facing CLI
└── ci/         ← CI integration (GitHub, GitLab)
```

All packages share the core data layer. The analyzer scans codebases to build a component registry, the bundle plugin tracks size at build time, and the CLI/CI packages provide the interface.

## License

MIT
