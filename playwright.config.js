import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';
export default defineConfig({
  testDir: './tests', testMatch: '*.spec.js', workers: 1, timeout: 60000,
  use: { baseURL: 'http://127.0.0.1:4173', headless: true, launchOptions: { ...(existsSync(process.env.CHROMIUM_PATH || '/usr/bin/chromium') ? { executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium' } : {}), args: ['--no-sandbox', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] }, trace: 'retain-on-failure' },
  webServer: { command: 'PORT=4173 DATA_DIR=/tmp/rumbo-e2e NODE_ENV=test node --use-env-proxy server/index.js', url: 'http://127.0.0.1:4173/api/health', reuseExistingServer: false },
});
