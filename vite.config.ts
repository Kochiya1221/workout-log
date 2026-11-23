/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/workout-log/',
  test: {
    environment: 'node',
  },
});
