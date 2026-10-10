import { defineConfig, devices } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const e2eDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reloop-e2e-'));
const e2eApiPort = '34291';
const e2eWebPort = '5174';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${e2eWebPort}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...devices['Desktop Chrome'],
  },
  webServer: {
    command: 'npm run dev',
    url: `http://127.0.0.1:${e2eWebPort}`,
    reuseExistingServer: false,
    timeout: 45_000,
    env: { ...process.env, VITE_PORT: e2eWebPort, API_PORT: e2eApiPort, API_PROXY_TARGET: `http://127.0.0.1:${e2eApiPort}`, RELOOP_DATA_DIR: e2eDataDir, RELOOP_SESSION_SECRET: 'playwright-only-test-secret-32-bytes-minimum', NODE_ENV: 'test' },
  },
});
