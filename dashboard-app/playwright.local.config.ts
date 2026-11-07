import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e-real',
  workers: 1,
  retries: 0,
  timeout: 60_000,
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'retain-on-failure',
  },
});
