import { defineConfig } from 'vite';

export default defineConfig({
  base: '/secret-life-of-blood-glucose/',
  publicDir: 'public',
  build: { outDir: 'dist', assetsInlineLimit: 0 },
  server: { open: true },
});
