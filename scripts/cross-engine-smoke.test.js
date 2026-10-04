import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const ci = parse(read('.github/workflows/ci.yml'));
const crossEngine = parse(read('.github/workflows/ui-cross-engine.yml'));

describe('Contrat du smoke multi-moteurs', () => {
  test('le job Chromium complet et ses noms de contrôle restent inchangés', () => {
    expect(ci.jobs.browser.name).toBe('Browser');
    expect(ci.jobs.browser.uses).toBe('./.github/workflows/ui-e2e.yml');
    expect(parse(read('.github/workflows/ui-e2e.yml')).jobs.browser.name).toBe('Chromium interactions');
    const config = read('playwright.config.js');
    expect(config).toContain("browserName: 'chromium'");
    expect(config).not.toContain('projects');
  });

  test('un job distinct réutilise l’archive construite et vérifiée', () => {
    expect(ci.jobs['cross-engine']).toEqual({
      name: 'Cross-engine',
      needs: 'build',
      uses: './.github/workflows/ui-cross-engine.yml',
      with: { prebuilt: true },
    });
    const steps = crossEngine.jobs.smoke.steps;
    expect(crossEngine.permissions).toEqual({ contents: 'read' });
    expect(steps.find(step => step.uses?.startsWith('actions/download-artifact@')).with.name).toBe('github-pages');
    expect(steps.some(step => step.run === 'npm run verify:site' && step.if === 'inputs.prebuilt')).toBe(true);
    expect(steps.some(step => step.run?.includes('install --with-deps chromium firefox webkit'))).toBe(true);
    const run = steps.find(step => step.run === 'npx playwright test -c playwright.cross-engine.config.js');
    expect(run.env.PLAYWRIGHT_PREBUILT).toContain('inputs.prebuilt');
  });

  test('la configuration cible un seul fichier sur les trois moteurs', () => {
    const config = read('playwright.cross-engine.config.js');
    expect(config).toContain("testMatch: 'cross-engine-smoke.spec.js'");
    expect(config).toContain("['chromium', 'firefox', 'webkit']");
    expect(config).toContain("import base from './playwright.config.js'");
    expect(read('e2e/cross-engine-smoke.spec.js').match(/^test\(/gm)).toHaveLength(3);
  });
});
