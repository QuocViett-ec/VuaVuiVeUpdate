import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: '../qa-portfolio/reports/artifacts/playwright', open: 'never' }],
    ['junit', { outputFile: '../qa-portfolio/reports/artifacts/browser.xml' }]],
  outputDir: '../qa-portfolio/reports/artifacts/playwright-results',
  use: { baseURL: 'http://127.0.0.1:4300', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'customer', testMatch: /checkout\.spec\.ts/ },
    { name: 'admin', testMatch: /admin\.spec\.ts/, use: { baseURL: 'http://127.0.0.1:4301' } },
  ],
  webServer: [{
    command: 'node scripts/serve-built.cjs',
    url: 'http://127.0.0.1:4300',
    reuseExistingServer: false,
  }, {
    command: 'node scripts/serve-built.cjs --admin',
    url: 'http://127.0.0.1:4301',
    reuseExistingServer: false,
  }],
});
