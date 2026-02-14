# @foxlight/bundle

Bundle size analysis for [Foxlight](https://github.com/josegabrielcruz/foxlight) — the open-source front-end intelligence platform.

## What's Inside

- **Size Tracker** — computes raw and gzip sizes, per-component bundle breakdown (self, exclusive, total), chunk tracking
- **Vite Plugin** — Rollup-based dependency resolution with BFS traversal, JSON report output, console summary
- **Webpack Plugin** — hooks into Webpack's emit phase for per-module size extraction and reporting

## Installation

```bash
npm install @foxlight/bundle
```

## Vite Plugin

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import { foxlightVitePlugin } from '@foxlight/bundle/vite';

export default defineConfig({
  plugins: [
    foxlightVitePlugin({
      outputPath: '.foxlight/bundle-report.json',
    }),
  ],
});
```

## Webpack Plugin

```typescript
// webpack.config.js
import { FoxlightWebpackPlugin } from '@foxlight/bundle/webpack';

export default {
  plugins: [
    new FoxlightWebpackPlugin({
      outputPath: '.foxlight/bundle-report.json',
    }),
  ],
};
```

## Programmatic API

```typescript
import { computeSize, computeComponentBundleInfo, formatBytes } from '@foxlight/bundle';

const size = computeSize(sourceCode);
console.log(formatBytes(size.gzip)); // "12.4 KB"
```

## License

MIT
