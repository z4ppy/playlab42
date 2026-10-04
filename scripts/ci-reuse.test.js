import { classifyChanges, fingerprint, controls } from './ci-plan.js';
import { applyEvidence, reuseCi } from './ci-reuse.js';
import { createEvidence, decideControl, renderPlan, guardBrowser } from './ci-evidence.js';

const runner = { node: '26.10.0', image: 'ubuntu24-20261001', arch: 'x64' };
const tree = [{ path: 'games/example/engine.js', mode: '100644', oid: 'a'.repeat(40) }];
const commit = 'b'.repeat(40);
const run = {
  id: 123, run_attempt: 1, workflow_id: 42, event: 'pull_request',
  status: 'completed', conclusion: 'success', head_repository: { full_name: 'owner/repo' }, head_branch: 'feature',
  pull_requests: [{ number: 7 }],
};
const makePlan = () => {
  const plan = classifyChanges(['games/example/engine.js']);
  Object.assign(plan, { commit, runner, repository: 'owner/repo', pr: 7, branch: 'feature', reuseAllowed: true });
  for (const id of controls) {
    plan.controls[id].fingerprint = fingerprint(id, tree, runner);
  }
  return plan;
};
const needs = () => Object.fromEntries([
  'impact', 'trivy-scan', 'dependency-audit', 'build', ...controls,
].map(id => [id, { result: 'success', outputs: { mode: makePlan().controls[id]?.mode ?? 'execute', eligible: 'true' } }]));
const makeProof = () => createEvidence(makePlan(), needs(), { runId: 123, attempt: 1 });

describe('Preuves reussies, exactes et non chainees', () => {
  test('une execution originale est reutilisee et cite son run/commit', () => {
    const plan = makePlan();
    applyEvidence(plan, makeProof(), run, tree);
    expect(plan.controls.lint).toMatchObject({
      mode: 'reused', source: { runId: 123, attempt: 1, commit },
    });
    expect(renderPlan(plan)).toContain('123');
    expect(renderPlan(plan)).toContain('reused');
  });

  test.each([
    ['autre PR', proof => { proof.pr = 8; }],
    ['autre depot', proof => { proof.repository = 'fork/repo'; }],
    ['autre run', proof => { proof.runId = 999; }],
    ['autre tentative', proof => { proof.attempt = 2; }],
    ['mauvaise version', proof => { proof.version = 999; }],
    ['empreinte forgee', proof => { proof.controls.lint.fingerprint = '0'.repeat(64); }],
    ['preuve chainee', proof => { proof.controls.lint.mode = 'reused'; }],
    ['non applicable', proof => { proof.controls.lint.mode = 'not-applicable'; }],
    ['image divergente', proof => { proof.runner.image = 'other-image'; }],
    ['execution divergente', proof => { proof.controls.lint.eligible = false; }],
  ])('%s ne peut pas produire de reutilisation lint', (_name, mutate) => {
    const plan = makePlan();
    const proof = makeProof();
    mutate(proof);
    applyEvidence(plan, proof, run, tree);
    expect(plan.controls.lint.mode).toBe('execute');
  });

  test('recalculer Git empeche de croire une empreinte simplement declaree', () => {
    const plan = makePlan();
    applyEvidence(plan, makeProof(), run, [{ ...tree[0], oid: 'c'.repeat(40) }]);
    expect(plan.controls.lint.mode).toBe('execute');
  });

  test('une association API retiree apres rebase conserve la provenance enregistree et verifiee', () => {
    const plan = makePlan();
    applyEvidence(plan, makeProof(), { ...run, pull_requests: [] }, tree);
    expect(plan.controls.lint.mode).toBe('reused');
  });

  test.each([
    { ...run, conclusion: 'failure' },
    { ...run, event: 'push' },
    { ...run, head_repository: { full_name: 'fork/repo' } },
    { ...run, pull_requests: [{ number: 8 }] },
  ])('un run non admissible %j ne reutilise rien', candidate => {
    const plan = makePlan();
    applyEvidence(plan, makeProof(), candidate, tree);
    expect(plan.controls.lint.mode).toBe('execute');
  });

  test('un controle non applicable ne devient pas une execution fictive', () => {
    const plan = makePlan();
    plan.controls.lint.mode = 'not-applicable';
    applyEvidence(plan, makeProof(), run, tree);
    expect(plan.controls.lint.mode).toBe('not-applicable');
  });
});

describe('Erreurs et agregation bloquante', () => {
  const browserNeeds = () => {
    const jobs = needs();
    jobs.impact.outputs = Object.fromEntries(controls.map(id => [id, makePlan().controls[id].mode]));
    delete jobs.browser;
    return jobs;
  };

  test('le vrai gate Browser accepte tous les amonts coherents', () => {
    expect(() => guardBrowser(browserNeeds())).not.toThrow();
  });

  test.each(['impact', 'trivy-scan', 'dependency-audit', 'build', ...controls.filter(id => id !== 'browser')])(
    'Browser refuse les amonts %s non reussis', id => {
      for (const status of ['failure', 'skipped', 'cancelled', 'unknown', '']) {
        const jobs = browserNeeds();
        jobs[id].result = status;
        expect(() => guardBrowser(jobs)).toThrow(id);
      }
    },
  );

  test('un gate non applicable inattendu fait echouer le check Browser requis', () => {
    const jobs = browserNeeds();
    jobs.test.outputs.mode = 'not-applicable';
    expect(() => guardBrowser(jobs)).toThrow(/contraire au plan/);
  });

  test.each(['failure', 'skipped', 'cancelled', '', 'unknown'])(
    'le statut %s empeche la creation de preuves', result => {
      const jobs = needs();
      jobs.test.result = result;
      expect(() => createEvidence(makePlan(), jobs, { runId: 123, attempt: 1 })).toThrow(/test/);
    },
  );

  test('une preuve incomplete ou un mode impossible est refuse', () => {
    const jobs = needs();
    delete jobs.browser;
    expect(() => createEvidence(makePlan(), jobs, { runId: 123, attempt: 1 })).toThrow(/browser/);
    jobs.browser = { result: 'success', outputs: { mode: 'surprise' } };
    expect(() => createEvidence(makePlan(), jobs, { runId: 123, attempt: 1 })).toThrow(/browser/);
  });

  test('un succes non applicable ne peut pas remplacer une execution requise', () => {
    const jobs = needs();
    jobs.test.outputs.mode = 'not-applicable';
    expect(() => createEvidence(makePlan(), jobs, { runId: 123, attempt: 1 })).toThrow(/contraire au plan/);
  });

  test('un runner different execute de nouveau au lieu de reutiliser', () => {
    const plan = makePlan();
    plan.controls.lint.mode = 'reused';
    expect(decideControl(plan.controls.lint, runner, { ...runner, image: 'new-image' }))
      .toEqual({ mode: 'execute', eligible: false });
    expect(decideControl(plan.controls.lint, runner, runner)).toEqual({ mode: 'reused', eligible: true });
  });

  test('un plan absent ne rend pas un controle non applicable', () => {
    expect(() => decideControl(undefined, runner, runner)).toThrow();
  });

  test('une erreur API est visible et impose de nouvelles executions', async () => {
    const warnings = [];
    const plan = makePlan();
    await reuseCi(plan, {
      github: { rest: { actions: { listWorkflowRuns: () => Promise.reject(new Error('API 403')) } } },
      warn: message => warnings.push(message), root: '/absent', currentRunId: 456,
    });
    expect(plan.controls.lint.mode).toBe('execute');
    expect(warnings.join('\n')).toContain('API 403');
  });

  test('main et les forks ne consultent pas les anciens runs', async () => {
    const plan = makePlan();
    plan.reuseAllowed = false;
    await reuseCi(plan, { github: {}, root: '/absent', currentRunId: 456 });
    expect(plan.controls.lint.mode).toBe('execute');
  });
});
