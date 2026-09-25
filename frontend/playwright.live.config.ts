import { defineConfig, devices } from '@playwright/test'

// Run explicitly against a seeded local Docker stack. No API mocking.
export default defineConfig({
  testDir: './tests/live',
  workers: 1,
  retries: 0,
  timeout: 60_000,
  use: {
    ...devices['Desktop Chrome'],
    baseURL: process.env.LIVE_APP_URL ?? 'http://localhost:5173',
    viewport: { width: 1440, height: 1000 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    },
  },
})
