import { defineConfig } from 'vite';

export default defineConfig({
  base: '/blood_glucose/',
  publicDir: 'public',
  build: { outDir: 'dist', assetsInlineLimit: 0 },
  server: { open: true },
});
