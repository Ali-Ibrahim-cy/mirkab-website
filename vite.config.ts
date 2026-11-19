import fs from 'fs';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    base: './',
    plugins: [
      {
        name: 'copy-static-mirkab-assets',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const distDir = path.resolve(import.meta.dirname, 'dist');
          if (!fs.existsSync(distDir)) {
            return;
          }
          const assetsSrc = path.resolve(import.meta.dirname, 'assets');
          const assetsDist = path.resolve(distDir, 'assets');
          if (fs.existsSync(assetsSrc)) {
            fs.cpSync(assetsSrc, assetsDist, {recursive: true, force: true});
          }
          for (const staticFile of ['favicon.svg', 'robots.txt', 'sitemap.xml']) {
            const srcFile = path.resolve(import.meta.dirname, staticFile);
            const destFile = path.resolve(distDir, staticFile);
            if (fs.existsSync(srcFile)) {
              fs.copyFileSync(srcFile, destFile);
            }
          }
        },
      },
    ],
    build: {
      rollupOptions: {
        input: {
          main: path.resolve(import.meta.dirname, 'index.html'),
          admin: path.resolve(import.meta.dirname, 'admin/index.html'),
        },
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
