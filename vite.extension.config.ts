import { resolve, dirname } from 'path';
import { defineConfig } from 'vite';
import { copyFileSync, mkdirSync, existsSync } from 'fs';

const outDir = 'dist-extension';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir,
    emptyOutDir: true,
    lib: {
      entry: resolve(__dirname, 'src/extension-content.ts'),
      formats: ['iife'],
      name: 'AnnotatorContent',
    },
    rollupOptions: {
      output: {
        entryFileNames: 'content.js',
      },
    },
    minify: true,
    sourcemap: false,
    target: 'esnext',
  },
  plugins: [
    {
      name: 'copy-manifest',
      closeBundle() {
        const dest = resolve(__dirname, outDir, 'manifest.json');
        if (!existsSync(dirname(dest))) mkdirSync(dirname(dest), { recursive: true });
        copyFileSync(resolve(__dirname, 'extension', 'manifest.json'), dest);
      },
    },
  ],
});
