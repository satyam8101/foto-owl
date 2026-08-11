import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command }) => ({
  plugins: [react()],
  // Relative base for the production build so the app works at any GitHub
  // Pages subpath (https://<user>.github.io/<repo>/). Dev keeps "/" so the
  // dev server behaves normally.
  base: command === 'build' ? './' : '/',
  resolve: {
    alias: {
      '@fotoowl/media-core': fileURLToPath(
        new URL('../media-core/src/index.ts', import.meta.url),
      ),
      '@fotoowl/media-react': fileURLToPath(
        new URL('../media-react/src/index.ts', import.meta.url),
      ),
      '@fotoowl/media-ui-react': fileURLToPath(
        new URL('../media-ui-react/src/index.ts', import.meta.url),
      ),
    },
  },
  server: {
    port: 5173,
  },
}));
