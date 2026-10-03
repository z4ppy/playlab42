import { defineConfig } from '@playwright/test';

const externalURL = process.env.PLAYWRIGHT_BASE_URL;
const port = Number(process.env.PLAYWRIGHT_PORT || 4173);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PLAYWRIGHT_PORT doit etre un port TCP valide.');
}
const baseURL = externalURL || `http://127.0.0.1:${port}`;
const prebuilt = process.env.PLAYWRIGHT_PREBUILT === '1';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: process.env.PLAYLAB_CDP_ENDPOINT ? 1 : (process.env.CI ? 2 : undefined),
  timeout: 30_000,
  expect: { timeout: 10_000 },
  outputDir: 'test-results',
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    browserName: 'chromium',
    viewport: { width: 1280, height: 900 },
    locale: 'fr-FR',
    colorScheme: 'dark',
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: externalURL ? undefined : {
    command: `${prebuilt ? '' : 'npm run build:local && '}node_modules/.bin/serve ${prebuilt ? 'site' : '.'}${prebuilt ? ' -c ../serve.json' : ''} -l tcp://127.0.0.1:${port} -C`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
