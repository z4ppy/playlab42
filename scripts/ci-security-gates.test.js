import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { runInNewContext } from 'node:vm';
import { parse } from 'yaml';
import { buildSecurityReport } from './build-security-report.js';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const workflow = name => parse(read(`.github/workflows/${name}.yml`));
const ci = workflow('ci');
const audit = workflow('security-audit');
const trivy = workflow('trivy-scan');
const build = ci.jobs.build;
const guard = build.steps[0];
const statuses = ['success', 'failure', 'skipped', 'cancelled'];

describe('Build requis agrège les gates de sécurité sans succès ignoré', () => {
  test('Build attend exactement les deux gates, même après leur échec', () => {
    expect(build.name).toBe('Build');
    expect(build.needs).toEqual(['security-lint', 'trivy-scan']);
    expect(build.if).toBe('always()');
    for (const success of [true, false]) {
      expect(runInNewContext(build.if, { always: () => true, success: () => success })).toBe(true);
    }
    expect(guard.shell).toBe('bash');
    expect(guard.if).toBeUndefined();
    expect(guard.env).toEqual({
      SECURITY_LINT_RESULT: '${{ needs.security-lint.result }}',
      TRIVY_SCAN_RESULT: '${{ needs.trivy-scan.result }}',
    });
    expect(build['continue-on-error']).toBeUndefined();
    expect(build.steps.every(step => !step['continue-on-error'])).toBe(true);
    expect(build.steps.slice(1).every(step => step.if === undefined)).toBe(true);
    expect(ci.jobs['security-lint'].needs).toBeUndefined();
    expect(ci.jobs['trivy-scan'].needs).toBeUndefined();
    for (const id of ['lint', 'test', 'typecheck', 'dependency-audit', 'openspec']) {
      expect(ci.jobs[id].needs).toBeUndefined();
    }
    expect(ci.jobs.browser.needs).toBe('build');
    const deploy = workflow('deploy');
    expect(deploy.jobs.validate.uses).toBe('./.github/workflows/ci.yml');
    expect(deploy.jobs.deploy.needs).toBe('validate');
    expect(deploy.jobs.deploy.if).toBeUndefined();
  });

  test.each(statuses.flatMap(lint => statuses.map(scan => [lint, scan])))(
    'le vrai guard Bash reçoit lint=%s et trivy=%s avant toute fabrication',
    (lint, scan) => {
      const result = spawnSync('bash', ['-e', '-o', 'pipefail', '-c', `${guard.run}\nprintf 'BUILD_ALLOWED\\n'`], {
        env: { ...process.env, SECURITY_LINT_RESULT: lint, TRIVY_SCAN_RESULT: scan },
        encoding: 'utf8',
      });
      const accepted = lint === 'success' && scan === 'success';
      expect(result.status).toBe(accepted ? 0 : 1);
      expect(result.stdout.includes('BUILD_ALLOWED')).toBe(accepted);
      if (!accepted) {
        expect(result.stdout).toContain('::error::');
        expect(result.stdout).toContain(lint !== 'success' ? 'security-lint' : 'trivy-scan');
      }
    },
  );

  test.each(['', 'unknown'])('un statut absent ou inconnu (%s) reste bloquant', status => {
    const result = spawnSync('bash', ['-e', '-c', guard.run], {
      env: { ...process.env, SECURITY_LINT_RESULT: 'success', TRIVY_SCAN_RESULT: status },
      encoding: 'utf8',
    });
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('trivy-scan');
  });
});

describe('Trivy partagé bloque PR et publication', () => {
  test('les appelants partagent le scan mais pas le nom de rapport', () => {
    const callers = [ci.jobs['trivy-scan'], audit.jobs['trivy-scan']];
    for (const caller of callers) {
      expect(caller.uses).toBe('./.github/workflows/trivy-scan.yml');
      expect(caller.steps).toBeUndefined();
      expect(caller['continue-on-error']).toBeUndefined();
    }
    const names = callers.map(caller => caller.with['artifact-name']);
    expect(new Set(names).size).toBe(2);
    expect(trivy.on.workflow_call.inputs['artifact-name'])
      .toMatchObject({ required: true, type: 'string' });
    expect(trivy.permissions).toEqual({ contents: 'read' });
    const scanJob = trivy.jobs.scan;
    expect(scanJob.needs).toBeUndefined();
    expect(scanJob.if).toBeUndefined();
    expect(scanJob['continue-on-error']).toBeUndefined();
    expect(scanJob.steps.every(step => !step['continue-on-error'])).toBe(true);
    expect(scanJob.steps.find(step => step.name === 'Installation de Trivy').run)
      .toBe('bash scripts/install-security-scanner.sh trivy');
    const upload = scanJob.steps.find(step => step.uses?.startsWith('actions/upload-artifact@'));
    expect(upload.if).toBe('always()');
    expect(upload.with.name).toBe('${{ inputs.artifact-name }}');
    expect(upload.with.path).toBe('trivy-results.json');
    expect(upload.with['if-no-files-found']).toBe('error');
    expect(scanJob.steps.find(step => step.env?.SCAN_RESULT).env.SCAN_RESULT)
      .toBe('${{ steps.scan.outcome }}');
  });

  test.each([0, 1, 2])('la commande réelle propage le statut scanner %s', status => {
    const scan = trivy.jobs.scan.steps.find(step => step.id === 'scan');
    const result = spawnSync('bash', ['-e', '-o', 'pipefail', '-c', `
      trivy() { printf '%s\\n' "$@"; return ${status}; }
      ${scan.run}
    `], { encoding: 'utf8', env: { ...process.env, RUNNER_TEMP: '/workspace/.ci-scan-cache' } });
    expect(result.status).toBe(status);
    expect(result.stdout.trim().split('\n')).toEqual([
      'fs', '.', '--db-repository', 'ghcr.io/aquasecurity/trivy-db:2',
      '--scanners', 'vuln,secret', '--include-dev-deps', '--exit-code', '1',
      '--severity', 'CRITICAL,HIGH', '--cache-dir', '/workspace/.ci-scan-cache/trivy-cache',
      '--format', 'json', '--output', 'trivy-results.json',
    ]);
  });

  test.each(statuses)('le rapport reçoit le vrai résultat du job réutilisé : %s', status => {
    const reportJob = audit.jobs['security-report'];
    expect(reportJob.needs).toEqual([
      'npm-audit', 'eslint-security', 'trivy-scan', 'gitleaks', 'outdated-check', 'docker-security',
    ]);
    const needs = Object.fromEntries(reportJob.needs.map(id => [id, { result: 'success' }]));
    needs['trivy-scan'].result = status;
    const report = buildSecurityReport(needs, { commit: 'a'.repeat(40), branch: 'ci-review' });
    const row = report.split('\n').find(line => line.includes('Trivy'));
    expect(row).toContain({
      success: 'Réussi', failure: 'Échec', skipped: 'Non exécuté', cancelled: 'Annulé',
    }[status]);
  });
});

describe('Rapports PR compatibles avec les tokens de forks', () => {
  const reportJob = audit.jobs['security-report'];
  const comment = reportJob.steps.find(step => step.uses?.startsWith('actions/github-script@'));

  test.each([
    ['pull_request', 'owner/repo', true],
    ['pull_request', 'contributor/fork', false],
    ['push', 'owner/repo', false],
    ['workflow_dispatch', 'owner/repo', false],
    ['schedule', 'owner/repo', false],
  ])('événement %s, source %s : commentaire %s', (event, head, expected) => {
    const github = {
      event_name: event,
      repository: 'owner/repo',
      event: event === 'pull_request' ? { pull_request: { head: { repo: { full_name: head } } } } : {},
    };
    expect(runInNewContext(comment.if, { github })).toBe(expected);
  });

  test('artefact et summary restent accessibles sans commentaire ni privilège global', () => {
    expect(audit.on).not.toHaveProperty('pull_request_target');
    expect(audit.permissions).toEqual({ contents: 'read' });
    expect(reportJob.if).toBe('always()');
    expect(reportJob.permissions).toEqual({ contents: 'read', 'pull-requests': 'write' });
    const upload = reportJob.steps.find(step => step.uses?.startsWith('actions/upload-artifact@'));
    const summary = reportJob.steps.find(step => step.run?.includes('GITHUB_STEP_SUMMARY'));
    expect(upload.if).toBeUndefined();
    expect(summary.if).toBeUndefined();
    expect(upload.with.path).toBe('security-report.md');
    expect(summary.run).toContain('cat security-report.md >> "$GITHUB_STEP_SUMMARY"');
  });

  test.each([true, false])('l’appel commentaire est attendu, API disponible : %s', async success => {
    const calls = [];
    const request = { issue_number: 42, owner: 'owner', repo: 'repo', body: 'report' };
    const result = runInNewContext(`(async () => { ${comment.with.script} })()`, {
      require: () => ({ readFileSync: () => 'report' }),
      context: { issue: { number: 42 }, repo: { owner: 'owner', repo: 'repo' } },
      github: { rest: { issues: { createComment: options => {
        calls.push(options);
        return success ? Promise.resolve() : Promise.reject(new Error('API 403'));
      } } } },
    });
    if (success) {
      await expect(result).resolves.toBeUndefined();
    } else {
      await expect(result).rejects.toThrow('API 403');
    }
    expect(calls).toEqual([request]);
  });
});
