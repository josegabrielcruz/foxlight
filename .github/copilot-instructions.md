# Pulse

## Project Overview
Pulse is an open-source front-end intelligence platform providing component health tracking, dependency upgrade previews, and cost analysis. Built as a TypeScript monorepo.

## Architecture
- `@pulse/core` — Shared data types, component registry, dependency graph
- `@pulse/analyzer` — Static analysis engine (AST scanning, component detection)
- `@pulse/bundle` — Bundle size analysis (Vite/Webpack plugins)
- `@pulse/cli` — Command-line interface
- `@pulse/ci` — CI/CD integration (GitHub Actions, PR comments)

## Development
- Runtime: Node.js 20+
- Language: TypeScript (strict mode)
- Test runner: Vitest
- Package manager: npm workspaces
- Build tool: tsup (per-package)

## Conventions
- All packages live in `packages/`
- Shared types go in `@pulse/core`
- Each package extends `tsconfig.base.json`
- Tests live alongside source as `*.test.ts`
- Use named exports, avoid default exports
- Use `node:` protocol for Node.js built-ins
- Use `.js` extensions in relative imports (for ESM)
