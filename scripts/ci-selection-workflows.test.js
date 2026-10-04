import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { parse } from 'yaml';
import { controls, documentaryTests } from './ci-plan.js';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const workflow = name => parse(read(`.github/workflows/${name}.yml`));
const ci = workflow('ci');
const ui = workflow('ui-e2e');

describe('Checks stables, selection explicite et preuves', () => {
  test('aucun filtre de workflow ne laisse de checks requis en attente', () => {
    expect(ci.on.pull_request).toEqual({});
    for (const id of controls.filter(id => id !== 'browser')) {
      const job = ci.jobs[id];
      expect(job.if).toBeUndefined();
      expect(job.needs).toBe('impact');
      expect(job['continue-on-error']).toBeUndefined();
      const decision = job.steps.find(step => step.id === 'decision');
      expect(decision.run).toBe('node scripts/ci-evidence.js start');
      expect(decision.env.CI_RUNNER).toBe('${{ needs.impact.outputs.runner }}');
      expect(job.outputs.mode).toBe('${{ steps.decision.outputs.mode }}');
      const setup = job.steps.find(step => step.uses?.startsWith('actions/setup-node@'));
      expect(setup.with['node-version']).toBe('${{ needs.impact.outputs.node-version }}');
    }
  });

  test('les analyses ne s’executent que pour une decision execute', () => {
    for (const id of ['lint', 'security-lint', 'code-quality', 'typecheck', 'openspec']) {
      const commands = ci.jobs[id].steps.filter(step => step.run?.startsWith('npm '));
      expect(commands.length).toBeGreaterThan(1);
      expect(commands.every(step => step.if === "steps.decision.outputs.mode == 'execute'")).toBe(true);
    }
    const coverage = ci.jobs.test.steps.find(step => step.id === 'jest');
    expect(coverage.if).toBe("steps.decision.outputs.mode == 'execute'");
    for (const step of ci.jobs.test.steps.filter(step => step.if?.startsWith('always()'))) {
      expect(step.if).toBe("always() && steps.decision.outputs.mode == 'execute'");
    }
    const docs = ci.jobs.test.steps.find(step => step.if === "steps.decision.outputs.mode == 'documentation'");
    expect(docs.run).toContain('...documentaryTests');
    expect(docs.run).toContain('--runTestsByPath');
    for (const path of documentaryTests) {
      expect(read(path)).toBeTruthy();
    }
  });

  test('Browser documentaire ou reutilise verifie la nouvelle archive et les smokes', () => {
    expect(ci.jobs.browser.name).toBe('Browser');
    expect(ui.jobs.browser.name).toBe('Chromium interactions');
    expect(ci.jobs.browser.needs).toContain('build');
    expect(ci.jobs.browser.with.mode).toBe('${{ needs.impact.outputs.browser }}');
    expect(ui.on.workflow_call.outputs.mode.value).toBe('${{ jobs.browser.outputs.mode }}');
    const full = ui.jobs.browser.steps.find(step => step.run === 'npm run test:e2e');
    const docs = ui.jobs.browser.steps.find(step => step.run === 'npm run test:e2e -- e2e/guides.spec.js');
    for (const mode of ['execute', 'documentation', 'reused']) {
      const context = { steps: { decision: { outputs: { mode } } } };
      expect(runInNewContext(full.if, context)).toBe(mode === 'execute');
      expect(runInNewContext(docs.if, context)).toBe(mode !== 'execute');
    }
    expect(ui.jobs.browser.steps.find(step => step.run === 'npm run verify:site').if).toBe('inputs.prebuilt');
    expect(ui.jobs.browser.steps.find(step => step.run?.includes('--config playwright.cross-engine.config.js')).if).toBeUndefined();
  });

  test('seule la planification lit les anciens runs et aucune preuve ne vient du cache npm', () => {
    expect(ci.jobs.impact.permissions).toEqual({ contents: 'read', actions: 'read' });
    const script = ci.jobs.impact.steps.find(step => step.id === 'plan').with.script;
    expect(script).toContain('commit: context.sha');
    expect(script).toContain('context.payload');
    expect(script).toContain('reuseCi(plan');
    expect(script).toContain("CI_NODE_VERSION.replace(/^v/, '')");
    expect(ci.jobs.impact.steps.some(step => step.run === 'npm ci')).toBe(false);
    const aggregate = ci.jobs.browser;
    expect(aggregate.if).toBe('always()');
    expect(aggregate.needs).toEqual(expect.arrayContaining(['impact', 'build', 'trivy-scan', 'dependency-audit', ...controls.filter(id => id !== 'browser')]));
    expect(aggregate.with.gates).toBe('${{ toJSON(needs) }}');
    const steps = ui.jobs.browser.steps;
    expect(steps.findIndex(step => step.run === 'node scripts/ci-evidence.js guard'))
      .toBeLessThan(steps.findIndex(step => step.run === 'npm ci'));
    const finish = steps.findIndex(step => step.run === 'node scripts/ci-evidence.js finish');
    expect(finish).toBeGreaterThan(steps.findIndex(step => step.run?.includes('--config playwright.cross-engine.config.js')));
    expect(steps[finish].if).toBe('inputs.prebuilt');
    const archive = steps.find(step => step.with?.name?.startsWith('ci-evidence-'));
    expect(archive.if).toBe('inputs.prebuilt');
    expect(archive.with['if-no-files-found']).toBe('error');
  });

  test('les audits evolutifs, la publication complete et l’annulation PR restent distincts', () => {
    expect(ci.jobs['dependency-audit'].needs).toBeUndefined();
    expect(ci.jobs['trivy-scan'].needs).toBeUndefined();
    expect(workflow('security-audit').on.schedule).toEqual([{ cron: '0 6 * * *' }]);
    expect(workflow('deploy').jobs.validate.permissions).toEqual({ contents: 'read', actions: 'read' });
    const expression = ci.concurrency['cancel-in-progress'].slice(3, -2).trim();
    expect(runInNewContext(expression, { github: { event_name: 'pull_request' } })).toBe(true);
    expect(runInNewContext(expression, { github: { event_name: 'push' } })).toBe(false);
  });
});
