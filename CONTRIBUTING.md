# Contributing to Foxlight

Thanks for your interest in contributing! This guide will help you get set up.

## Prerequisites

- **Node.js 20+** (see `.nvmrc`)
- **npm** (comes with Node.js)

## Getting Started

```bash
# Clone the repo
git clone https://github.com/josegabrielcruz/foxlight.git
cd foxlight

# Install dependencies
npm install

# Build all packages
npm run build

# Run tests
npm test
```

## Project Structure

```
packages/
├── core/       ← Shared types, registry, graph, scoring, cost estimation
├── analyzer/   ← AST scanning, component detection, Vue/Svelte parsers
├── bundle/     ← Vite and Webpack plugins for size tracking
├── cli/        ← Command-line interface
└── ci/         ← GitHub/GitLab CI integration
```

All packages live in `packages/` and are managed as npm workspaces. Shared types go in `@foxlight/core`. Each package extends `tsconfig.base.json` and builds with `tsup`.

## Development Workflow

```bash
# Watch mode for tests
npm run test:watch

# Type-check everything
npm run typecheck

# Lint
npm run lint
npm run lint:fix

# Format
npm run format
npm run format:check
```

## Conventions

- **Named exports only** — avoid default exports
- **`node:` protocol** for Node.js built-ins (`import { readFile } from 'node:fs/promises'`)
- **`.js` extensions** in relative imports (required for ESM)
- **Tests alongside source** — `foo.ts` → `foo.test.ts` in the same directory
- **TypeScript strict mode** everywhere
- **Consistent type imports** — use `import type { ... }` for type-only imports

## Adding a New Package

1. Create `packages/<name>/` with:
   - `package.json` (use an existing package as template)
   - `tsconfig.json` extending `../../tsconfig.base.json`
   - `tsconfig.build.json` for build config
   - `tsup.config.ts` for bundling
   - `src/index.ts` barrel export
2. Add the package to the root `tsconfig.json` references array
3. If it depends on other `@foxlight/*` packages, use `"workspace:*"` version ranges

## Making Changes

1. Create a feature branch from `master`
2. Make your changes
3. Add/update tests — aim for meaningful coverage
4. Run `npm test` and `npm run typecheck` to verify
5. Create a changeset: `npm run changeset`
6. Open a pull request

## Changesets

We use [Changesets](https://github.com/changesets/changesets) for version management. When your PR includes user-facing changes:

```bash
npm run changeset
```

Select the affected packages and describe the change. The changeset file will be committed with your PR.

## Code Review

- Keep PRs focused — one feature or fix per PR
- Include tests for new functionality
- Update documentation if adding new public APIs

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
