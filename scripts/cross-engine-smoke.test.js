import { existsSync, readFileSync } from 'node:fs';
import { parse } from 'yaml';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const ci = parse(read('.github/workflows/ci.yml'));
const browser = parse(read('.github/workflows/ui-e2e.yml'));

describe('Contrat du smoke multi-moteurs', () => {
  test('le job Chromium complet et ses noms de contrôle restent inchangés', () => {
    expect(ci.jobs.browser.name).toBe('Browser');
    expect(ci.jobs.browser.uses).toBe('./.github/workflows/ui-e2e.yml');
    expect(browser.jobs.browser.name).toBe('Chromium interactions');
    const config = read('playwright.config.js');
    expect(config).toContain("browserName: 'chromium'");
    expect(config).not.toContain('projects');
  });

  test('le job requis Browser exécute le smoke après la suite Chromium sur l’archive vérifiée', () => {
    expect(ci.jobs['cross-engine']).toBeUndefined();
    expect(existsSync(new URL('../.github/workflows/ui-cross-engine.yml', import.meta.url))).toBe(false);
    const steps = browser.jobs.browser.steps;
    expect(steps.some(step => step.run === 'npm run verify:site' && step.if === 'inputs.prebuilt')).toBe(true);
    expect(steps.some(step => step.run === 'npx playwright install --with-deps chromium firefox webkit')).toBe(true);
    const suite = steps.findIndex(step => step.run === 'npm run test:e2e');
    const documentary = steps.findIndex(step => step.run === 'npm run test:e2e -- e2e/guides.spec.js');
    const smoke = steps.findIndex(step => step.run === 'npx playwright test --config playwright.cross-engine.config.js');
    expect(documentary).toBe(suite + 1);
    expect(smoke).toBe(documentary + 1);
    expect(steps[smoke]['continue-on-error']).toBeUndefined();
    expect(steps[smoke].if).toBeUndefined();
    expect(steps[smoke].env.PLAYWRIGHT_PREBUILT).toContain('inputs.prebuilt');
    expect(steps.find(step => step.if === 'failure()').with.path).toContain('playwright-report/');
  });

  test('la configuration cible un seul fichier sur les trois moteurs', () => {
    const config = read('playwright.cross-engine.config.js');
    expect(config).toContain("testMatch: 'cross-engine-smoke.spec.js'");
    expect(config).toContain("['chromium', 'firefox', 'webkit']");
    expect(config).toContain("import base from './playwright.config.js'");
    expect(read('e2e/cross-engine-smoke.spec.js').match(/^test\(/gm)).toHaveLength(3);
  });
});
