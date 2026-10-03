import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const ci = parse(read('.github/workflows/ci.yml'));
const deploy = parse(read('.github/workflows/deploy.yml'));
const browser = parse(read('.github/workflows/ui-e2e.yml'));

describe('Contrat des workflows de livraison', () => {
  test('une CI réutilisée et aucune double CI automatique sur push main', () => {
    expect(ci.on).toHaveProperty('workflow_call');
    expect(ci.on.pull_request).toEqual({});
    expect(ci.on.push).toBeUndefined();
    expect(deploy.on.push.branches).toEqual(['main']);
    expect(deploy.jobs.validate.uses).toBe('./.github/workflows/ci.yml');
    expect(deploy.jobs.validate.needs).toBe('check-ref');
    expect(deploy.jobs['check-ref'].steps[0].run).toContain('exit 1');
    expect(deploy.jobs['check-ref'].steps[0].run).toContain('refs/heads/main');
  });

  test('attendre tous les contrôles et réutiliser le même artefact sans reconstruire', () => {
    expect(Object.keys(ci.jobs)).toEqual(expect.arrayContaining(['lint', 'test', 'typecheck', 'build', 'openspec', 'browser']));
    expect(ci.jobs.openspec.steps.some(step => step.run === 'npm run openspec:validate')).toBe(true);
    expect(ci.jobs.browser.needs).toBe('build');
    expect(ci.jobs.browser.uses).toBe('./.github/workflows/ui-e2e.yml');
    expect(ci.jobs.browser.with.prebuilt).toBe(true);
    expect(ci.jobs.typecheck.steps.some(step => step.run === 'npm run build:ts')).toBe(false);
    const archive = ci.jobs.build.steps.find(step => step.uses?.startsWith('actions/upload-pages-artifact@'));
    expect(archive.with.path).toBe('site');
    expect(deploy.jobs.deploy.needs).toBe('validate');
    expect(deploy.jobs.deploy.steps.some(step => step.run?.includes('npm run build'))).toBe(false);
    expect(deploy.jobs.deploy.steps.some(step => step.uses?.startsWith('actions/deploy-pages@'))).toBe(true);
  });

  test('extraire l’archive dans site et activer le mode navigateur sans rebuild', () => {
    expect(browser.concurrency['cancel-in-progress']).toBe('${{ !inputs.prebuilt }}');
    const job = browser.jobs.browser;
    const download = job.steps.find(step => step.uses?.startsWith('actions/download-artifact@'));
    expect(download.if).toBe('inputs.prebuilt');
    expect(download.with.name).toBe('github-pages');
    expect(job.steps.some(step => step.run?.includes('tar -xf') && step.run.includes('-C site'))).toBe(true);
    expect(job.steps.find(step => step.run === 'npm run test:e2e').env.PLAYWRIGHT_PREBUILT)
      .toContain('inputs.prebuilt');
    const config = read('playwright.config.js');
    expect(config).toContain("process.env.PLAYWRIGHT_PREBUILT === '1'");
    expect(config).toContain("prebuilt ? 'site' : '.'");
    expect(config).toContain("prebuilt ? ' -c ../serve.json' : ''");
    const server = JSON.parse(read('serve.json'));
    expect(server.public).toBe('.');
    expect(server.cleanUrls).toBe(false);
    expect(server.trailingSlash).toBe(false);
  });

  test('réserver les permissions de publication au seul job de publication', () => {
    expect(ci.permissions).toEqual({ contents: 'read' });
    expect(browser.permissions).toEqual({ contents: 'read' });
    expect(deploy.permissions).toEqual({ contents: 'read' });
    expect(deploy.jobs.deploy.permissions).toEqual({ contents: 'read', pages: 'write', 'id-token': 'write' });
  });

  test('contrôler ensuite la publication avec le SHA du run et des réessais bornés', () => {
    expect(deploy.jobs.smoke.needs).toBe('deploy');
    const probe = deploy.jobs.smoke.steps.find(step => step.env?.DEPLOYMENT_URL);
    expect(probe.env.DEPLOYMENT_URL).toContain('needs.deploy.outputs.page_url');
    expect(probe.run).toContain('scripts/check-deployment.js "$DEPLOYMENT_URL" "$GITHUB_SHA"');
    expect(probe.run).toContain('for attempt in 1 2 3 4 5');
    expect(probe.run.trim()).toMatch(/exit 1$/);
  });

  test('construire TypeScript et préparer le site dans les deux modes de build', () => {
    const { scripts } = JSON.parse(read('package.json'));
    for (const key of ['build', 'build:local']) {
      expect(scripts[key]).toMatch(/^npm run build:ts &&/);
      expect(scripts[key]).toMatch(/&& npm run build:site$/);
    }
    expect(scripts['build:local']).toContain('--skip-og');
    expect(scripts.build).not.toContain('--skip-og');
  });
});
