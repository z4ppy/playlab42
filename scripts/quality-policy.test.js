import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { ESLint } from 'eslint';
import { parse } from 'yaml';
import config from '../jest.config.js';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

describe('Garde-fous de qualité logicielle', () => {
  test.each([
    ["new Function('return 1');\n", 'no-new-func'],
    ["location.href = 'javascript:alert(1)';\n", 'no-script-url'],
  ])('ESLint refuse %s', async (code, rule) => {
    const [result] = await new ESLint().lintText(code, { filePath: 'lib/quality-probe.js' });
    expect(result.messages.some(message => message.ruleId === rule && message.severity === 2)).toBe(true);
  });

  test('un avertissement seul fait échouer la commande lint', () => {
    expect(JSON.parse(read('package.json')).scripts.lint).toContain('--max-warnings=0');
    expect(JSON.parse(read('package.json')).scripts['lint:fix']).toContain('--max-warnings=0');
    const result = spawnSync(process.execPath, [
      'node_modules/eslint/bin/eslint.js', '--stdin', '--stdin-filename', 'lib/quality-probe.js',
      '--max-warnings=0', '--rule', 'no-console:warn',
    ], { input: "console.log('diagnostic');\n", encoding: 'utf8' });
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('no-console');
    expect(result.stderr).toContain('too many warnings');
  });

  test('les seuils mesurés ciblent les composants critiques sans faux seuil global', () => {
    expect(config.coverageThreshold.global).toBeUndefined();
    expect(config.coverageThreshold['./lib/seeded-random.js'].branches).toBe(100);
    for (const name of ['build-site', 'check-deployment']) {
      expect(config.coverageThreshold[`./scripts/${name}.js`])
        .toEqual({ branches: 80, functions: 100, lines: 80, statements: 80 });
    }
  });

  test('l’audit npm est requis dans la CI et ne masque pas ses erreurs', () => {
    const ci = parse(read('.github/workflows/ci.yml'));
    const job = ci.jobs['dependency-audit'];
    expect(job['continue-on-error']).toBeUndefined();
    expect(job.steps.find(step => step.run === 'npm run audit:dependencies')).toBeDefined();
    expect(JSON.parse(read('package.json')).scripts['audit:dependencies'])
      .toBe('npm audit --audit-level=moderate');
    const workflow = parse(read('.github/workflows/security-audit.yml'));
    expect(workflow.permissions).toEqual({ contents: 'read' });
    expect(workflow.jobs['docker-security'].permissions)
      .toEqual({ contents: 'read', 'security-events': 'write' });
    expect(workflow.jobs['security-report'].permissions)
      .toEqual({ contents: 'read', 'pull-requests': 'write' });
    const report = workflow.jobs['security-report'].steps.find(step => step.env?.SECURITY_JOB_RESULTS);
    expect(report.env.SECURITY_JOB_RESULTS).toBe('${{ toJSON(needs) }}');
    expect(report.run).toBe('node scripts/build-security-report.js > security-report.md');
  });
});
