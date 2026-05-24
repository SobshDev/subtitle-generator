import { resolve } from 'node:path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';

const sharedAlias = {
  '@shared': resolve(__dirname, 'shared'),
};

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: sharedAlias },
    build: {
      outDir: 'out/main',
      rollupOptions: {
        input: resolve(__dirname, 'main/index.ts'),
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: sharedAlias },
    build: {
      outDir: 'out/preload',
      rollupOptions: {
        input: resolve(__dirname, 'main/preload.ts'),
      },
    },
  },
  renderer: {
    root: resolve(__dirname, 'renderer'),
    plugins: [react()],
    resolve: { alias: sharedAlias },
    build: {
      outDir: resolve(__dirname, 'out/renderer'),
      rollupOptions: {
        input: resolve(__dirname, 'renderer/index.html'),
      },
    },
    server: {
      port: 5173,
    },
  },
});
