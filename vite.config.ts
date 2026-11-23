/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { serviceWorkerPlugin } from './build/swPlugin.ts';

export default defineConfig({
  base: '/workout-log/',
  plugins: [serviceWorkerPlugin()],
  test: {
    environment: 'node',
  },
});
