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
      name: 'copy-extension-assets',
      closeBundle() {
        const extDir = resolve(__dirname, 'extension');
        const destDir = resolve(__dirname, outDir);
        if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true });
        copyFileSync(resolve(extDir, 'manifest.json'), resolve(destDir, 'manifest.json'));
        const sidepanel = resolve(extDir, 'sidepanel.html');
        if (existsSync(sidepanel)) {
          copyFileSync(sidepanel, resolve(destDir, 'sidepanel.html'));
        }
      },
    },
  ],
});
