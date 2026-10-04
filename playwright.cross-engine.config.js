import { defineConfig } from '@playwright/test';
import base from './playwright.config.js';

// Smoke ciblé multi-moteurs : la suite complète reste Chromium (playwright.config.js).
const engines = ['chromium', 'firefox', 'webkit'];

export default defineConfig({
  ...base,
  testDir: './e2e',
  testMatch: 'cross-engine-smoke.spec.js',
  testIgnore: [],
  outputDir: 'test-results/cross-engine',
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report/cross-engine' }]],
  projects: engines.map(name => ({
    name,
    use: { browserName: name },
  })),
});
