import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e-real',
  workers: 1,
  retries: 0,
  timeout: 120_000,
  use: { baseURL: 'http://127.0.0.1:3080', trace: 'retain-on-failure' },
  webServer: [
    { command: 'python ../scripts/browser_flow_server.py', url: 'http://127.0.0.1:8080/ready', reuseExistingServer: false, timeout: 120_000 },
    { command: 'npm run dev -- --hostname 127.0.0.1 --port 3080', url: 'http://127.0.0.1:3080', reuseExistingServer: false, timeout: 120_000, env: { NEXT_PUBLIC_API_URL: 'http://127.0.0.1:8080/api/v1' } },
  ],
});
