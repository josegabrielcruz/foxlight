import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  root: 'src/ui/public',
  plugins: [react()],
  build: {
    outDir: '../../../dist/ui',
    emptyOutDir: true,
  },
  server: {
    middlewareMode: false,
  },
});
