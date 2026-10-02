import { defineConfig } from '@playwright/test';
import { detectBrowserConfig } from './scripts/browser_env.mjs';

const browserInfo = detectBrowserConfig();

/**
 * VetRx Playwright Configuration
 * Configured to use reliable system-installed browsers (Chrome / Edge)
 * to avoid remote CDN download failures.
 */
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  expect: {
    timeout: 5000,
  },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
    // Prefer installed system browser channel
    channel: browserInfo.channel || undefined,
    headless: true,
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  },
});
