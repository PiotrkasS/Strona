import { defineConfig, devices } from '@playwright/test';

const slowMo = parseInt(process.env.PW_SLOW_MO || '0', 10);

export default defineConfig({
  testDir: './tests',
  timeout: 120000,
  retries: 0,
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost',
    screenshot: 'only-on-failure',
    video: 'off',
    trace: 'off',
    launchOptions: slowMo > 0 ? { slowMo } : {},
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
