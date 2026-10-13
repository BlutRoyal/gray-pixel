import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// One self-contained HTML file in dist/, so the demo opens by double-click or from GitHub Pages.
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  define: { __BUILD__: JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC') },
  build: { target: 'es2020', chunkSizeWarningLimit: 4000 },
});
