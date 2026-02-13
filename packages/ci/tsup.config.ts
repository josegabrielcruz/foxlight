import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  tsconfig: 'tsconfig.build.json',
  clean: true,
});
