// 週次レポートの CLI を Node 用にビルドする設定（アプリのビルドとは別。Service Worker などは作らない）
import { defineConfig } from 'vite';

export default defineConfig({
  publicDir: false,
  build: {
    ssr: 'tools/weekly-report/cli.ts',
    outDir: 'tools/weekly-report/dist',
    emptyOutDir: true,
    target: 'node24',
    rollupOptions: {
      output: { entryFileNames: 'cli.js' },
    },
  },
});
