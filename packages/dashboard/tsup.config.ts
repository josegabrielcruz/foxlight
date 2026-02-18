import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/server/index.ts'],
  format: ['esm'],
  tsconfig: 'tsconfig.build.json',
  dts: true,
  sourcemap: true,
  clean: true,
  external: ['@foxlight/core', 'express', 'react', 'react-dom'],
});
