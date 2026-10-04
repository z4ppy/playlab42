import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { QualityBudgetError, evaluateBudget, loadBudget, parseBudget } from './quality-budget.js';

const root = path.resolve(import.meta.dirname, '..');
const validBudget = () => JSON.parse(readFileSync(path.join(root, 'scripts/quality-budgets.json'), 'utf8'));
const permissive = {
  formatVersion: 1,
  production: { cyclomatic: { maxPerFunction: 1000 }, cognitive: { maxPerFunction: 1000 },
    duplication: { maxClones: 1000000, maxDuplicatedLines: 1000000, maxDuplicatedTokens: 1000000 } },
  advisory: ['pedagogy', 'tests'],
};

function withBudget(change) {
  const budget = validBudget();
  change(budget);
  return budget;
}

describe('budget versionné de production', () => {
  test('le budget livré porte les seuils explicites et laisse pédagogie/tests consultatifs', () => {
    expect(loadBudget()).toEqual({
      formatVersion: 1,
      production: {
        cyclomatic: { maxPerFunction: 10 },
        cognitive: { maxPerFunction: 15 },
        duplication: { maxClones: 15, maxDuplicatedLines: 146, maxDuplicatedTokens: 1398 },
      },
      advisory: ['pedagogy', 'tests'],
    });
  });

  test.each([
    ['null', () => null],
    ['tableau', () => []],
    ['version absente', budget => { delete budget.formatVersion; return budget; }],
    ['version future', budget => { budget.formatVersion = 2; return budget; }],
    ['version textuelle', budget => { budget.formatVersion = '1'; return budget; }],
    ['clé inconnue', budget => { budget.production.extra = 1; return budget; }],
    ['scope consultatif inconnu', budget => { budget.advisory = ['pedagogy']; return budget; }],
    ['métrique cyclomatique absente', budget => { delete budget.production.cyclomatic; return budget; }],
    ['maximum cyclomatique nul', budget => { budget.production.cyclomatic.maxPerFunction = 0; return budget; }],
    ['maximum cognitif décimal', budget => { budget.production.cognitive.maxPerFunction = 15.5; return budget; }],
    ['clones textuels', budget => { budget.production.duplication.maxClones = '58'; return budget; }],
    ['lignes négatives', budget => { budget.production.duplication.maxDuplicatedLines = -1; return budget; }],
    ['tokens infinis', budget => { budget.production.duplication.maxDuplicatedTokens = Infinity; return budget; }],
    ['ratio à la place du compteur', budget => { delete budget.production.duplication.maxClones; budget.production.duplication.maxPercentage = 2; return budget; }],
  ])('refuse un budget corrompu : %s', (_name, change) => {
    expect(() => parseBudget(change(validBudget()))).toThrow('Budget qualité invalide');
  });

  test('un fichier absent ou un JSON illisible ne deviennent pas un budget par défaut', () => {
    expect(() => loadBudget(path.join(root, 'coverage/application-gates-absent.json'))).toThrow('Budget qualité invalide');
    mkdirSync(path.join(root, 'coverage'), { recursive: true });
    const directory = mkdtempSync(path.join(root, 'coverage', 'application-gates-budget-'));
    try {
      writeFileSync(path.join(directory, 'budget.json'), '{"formatVersion":');
      expect(() => loadBudget(path.join(directory, 'budget.json'))).toThrow('illisible');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

describe('évaluation exacte aux limites', () => {
  const production = (cyclomatic, cognitive, totals) => ({
    cyclomatic: cyclomatic.map((value, line) => ({ file: 'lib/a.js', line: line + 1, name: 'f', value })),
    cognitive: cognitive.map((value, line) => ({ file: 'lib/a.ts', line: line + 1, value })),
    duplication: { totals: { clones: 15, duplicatedLines: 146, duplicatedTokens: 1398, lines: 47639, tokens: 248829, ...totals }, clones: [] },
  });

  test('accepte exactement 10 / 15 / 15 / 146 / 1398 et refuse la valeur suivante', () => {
    const budget = loadBudget();
    expect(evaluateBudget(production([10], [15], {}), budget)).toMatchObject({ status: 'passed', violations: [] });
    const cases = [
      ['cyclomatic', production([11, 10], [15], {})],
      ['cognitive', production([10], [16], {})],
      ['duplication.clones', production([10], [15], { clones: 16 })],
      ['duplication.duplicatedLines', production([10], [15], { duplicatedLines: 147 })],
      ['duplication.duplicatedTokens', production([10], [15], { duplicatedTokens: 1399 })],
    ];
    for (const [metric, data] of cases) {
      const result = evaluateBudget(data, budget);
      expect(result.status).toBe('failed');
      expect(result.violations.map(violation => violation.metric)).toEqual([metric]);
    }
  });

  test('chaque métrique dépassée est nommée avec sa valeur et sa limite', () => {
    const result = evaluateBudget(production([20, 11], [16], { clones: 60, duplicatedLines: 700, duplicatedTokens: 5000 }), loadBudget());
    expect(result.violations.map(violation => violation.metric)).toEqual([
      'cyclomatic', 'cognitive', 'duplication.clones', 'duplication.duplicatedLines', 'duplication.duplicatedTokens',
    ]);
    expect(result.violations[0]).toMatchObject({ actual: 2, limit: 10 });
    expect(result.violations[0].message).toContain('maximum mesuré 20');
    expect(result.violations[2].message).toBe('clones de production : 60 > 15');
  });

  test('un grand volume de code neuf ne dilue pas une dette absolue', () => {
    const result = evaluateBudget(production([], [], { clones: 16, lines: 10000000, tokens: 100000000 }), loadBudget());
    expect(result.violations.map(violation => violation.metric)).toEqual(['duplication.clones']);
  });

  test("l'erreur de budget conserve le rapport mesuré", () => {
    const error = new QualityBudgetError([{ metric: 'cyclomatic', message: 'complexité cyclomatique : 1 fonction' }], { measured: true });
    expect(error.report).toEqual({ measured: true });
    expect(error.message).toContain('Budget qualité dépassé');
  });
});

describe('vrai CLI sur dépôt fixture', () => {
  let directory;

  function write(filename, contents) {
    const absolute = path.join(directory, filename);
    mkdirSync(path.dirname(absolute), { recursive: true });
    writeFileSync(absolute, contents);
  }

  function cli(budget, name) {
    if (budget !== undefined) {
      write('scripts/quality-budgets.json', typeof budget === 'string' ? budget : JSON.stringify(budget));
    }
    const output = path.join(directory, 'coverage', name);
    const env = { ...process.env };
    for (const key of ['GITHUB_SHA', 'GITHUB_RUN_ID', 'GITHUB_RUN_ATTEMPT', 'GITHUB_STEP_SUMMARY']) {
      delete env[key];
    }
    const result = spawnSync(process.execPath, ['scripts/code-quality-report.js', output], { cwd: directory, env, encoding: 'utf8', timeout: 120000 });
    const jsonFile = path.join(output, 'code-quality.json');
    return { ...result, output, report: existsSync(jsonFile) ? JSON.parse(readFileSync(jsonFile, 'utf8')) : null };
  }

  function branches(count) {
    return Array.from({ length: count }, (_, i) => `  if (value === ${i}) {return ${i};}`);
  }

  beforeAll(() => {
    mkdirSync(path.join(root, 'coverage'), { recursive: true });
    directory = mkdtempSync(path.join(root, 'coverage', 'application-gates-'));
    symlinkSync(path.join(root, 'node_modules'), path.join(directory, 'node_modules'), 'dir');
    write('package.json', '{"type":"module"}');
    write('.gitignore', 'node_modules\ncoverage/\n');
    for (const file of ['eslint.config.js', 'biome.json', 'scripts/lint-source-policy.js', 'scripts/code-quality-report.js', 'scripts/quality-budget.js']) {
      mkdirSync(path.dirname(path.join(directory, file)), { recursive: true });
      copyFileSync(path.join(root, file), path.join(directory, file));
    }
    const duplicate = ['export function boundary(value) {', ...branches(9), '  return -1;', '}', ''].join('\n');
    write('lib/first.js', duplicate);
    write('lib/second.js', duplicate);
    write('tools/probe/src/force.ts', [
      'export function force(values: number[][]): number {', '  let total = 0;', '  for (const row of values) {',
      '    for (const value of row) {', '      if (value > 0) { total += value; }', '    }', '  }', '  return total;', '}',
    ].join('\n'));
    write('parcours/epics/probe/assets/lesson.js', ['export function advisory(value) {', ...branches(24), '  return -1;', '}', ''].join('\n'));
    write('lib/probe.test.js', "test('probe', () => { expect(1).toBe(1); });\n");
    execFileSync('git', ['init', '--quiet'], { cwd: directory });
    execFileSync('git', ['add', '.gitignore', 'package.json', 'eslint.config.js', 'biome.json', 'scripts/lint-source-policy.js', 'lib', 'tools', 'parcours'], { cwd: directory });
    execFileSync('git', ['-c', 'user.name=Quality fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--quiet', '-m', 'fixture'], { cwd: directory });
  });

  afterAll(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  test('la fixture isole la provenance et le résumé du véritable job GitHub', () => {
    const keys = ['GITHUB_SHA', 'GITHUB_RUN_ID', 'GITHUB_RUN_ATTEMPT', 'GITHUB_STEP_SUMMARY'];
    const environment = { ...process.env };
    const summary = path.join(directory, 'coverage', 'host-summary.md');
    write('coverage/host-summary.md', 'Résumé du job parent\n');
    try {
      process.env.GITHUB_SHA = 'b'.repeat(40);
      process.env.GITHUB_RUN_ID = '123';
      process.env.GITHUB_RUN_ATTEMPT = '1';
      process.env.GITHUB_STEP_SUMMARY = summary;
      const measured = cli(permissive, 'isolated');
      expect({ status: measured.status, stderr: measured.stderr }).toEqual({ status: 0, stderr: '' });
      expect(measured.report.provenance).toMatchObject({ runId: null, runAttempt: null });
      expect(measured.report.provenance.sha).not.toBe(process.env.GITHUB_SHA);
      expect(readFileSync(summary, 'utf8')).toBe('Résumé du job parent\n');
    } finally {
      for (const key of keys) {
        if (environment[key] === undefined) { delete process.env[key]; } else { process.env[key] = environment[key]; }
      }
    }
  }, 30000);

  test('accepte exactement les valeurs mesurées et reste consultatif hors production', () => {
    const measured = cli(permissive, 'measure');
    expect(measured.status).toBe(0);
    expect(measured.report.budget).toMatchObject({ status: 'passed', violations: [] });
    const production = measured.report.scopes.production;
    const limits = {
      cyclomatic: Math.max(...production.cyclomatic.map(fn => fn.value)),
      cognitive: Math.max(...production.cognitive.map(fn => fn.value)),
      ...production.duplication.totals,
    };
    expect(limits.cyclomatic).toBe(10);
    expect(limits.cognitive).toBeGreaterThan(1);
    expect(limits.clones).toBeGreaterThan(0);
    expect(measured.report.scopes.pedagogy.cyclomatic.some(fn => fn.value === 25)).toBe(true);

    const exact = cli(withBudget(budget => {
      budget.production.cyclomatic.maxPerFunction = limits.cyclomatic;
      budget.production.cognitive.maxPerFunction = limits.cognitive;
      budget.production.duplication = { maxClones: limits.clones, maxDuplicatedLines: limits.duplicatedLines, maxDuplicatedTokens: limits.duplicatedTokens };
    }), 'exact');
    expect(exact.status).toBe(0);
    expect(exact.stdout).toContain('Rapport qualité');
    expect(exact.report.budget.status).toBe('passed');
    expect(readFileSync(path.join(exact.output, 'code-quality.md'), 'utf8')).toContain('Budgets de production');

    const metrics = {
      cyclomatic: [budget => { budget.production.cyclomatic.maxPerFunction = limits.cyclomatic - 1; }, 'complexité cyclomatique'],
      cognitive: [budget => { budget.production.cognitive.maxPerFunction = limits.cognitive - 1; }, 'complexité cognitive'],
      'duplication.clones': [budget => { budget.production.duplication.maxClones = limits.clones - 1; }, 'clones de production'],
      'duplication.duplicatedLines': [budget => { budget.production.duplication.maxDuplicatedLines = limits.duplicatedLines - 1; }, 'lignes dupliquées'],
      'duplication.duplicatedTokens': [budget => { budget.production.duplication.maxDuplicatedTokens = limits.duplicatedTokens - 1; }, 'tokens dupliqués'],
    };
    for (const [metric, [change, label]] of Object.entries(metrics)) {
      const rejected = cli(withBudget(change), `reject-${metric}`);
      expect(rejected.status).toBe(1);
      expect(rejected.stderr).toContain('Rapport qualité échoué : Budget qualité dépassé');
      expect(rejected.stderr).toContain(label);
      expect(rejected.stdout).toBe('');
      expect(rejected.report.budget.status).toBe('failed');
      expect(rejected.report.budget.violations.map(violation => violation.metric)).toEqual([metric]);
      expect(readFileSync(path.join(rejected.output, 'code-quality.md'), 'utf8')).toContain(label);
    }
  }, 180000);

  test.each([
    ['JSON illisible', '{"formatVersion":'],
    ['version inconnue', { ...permissive, formatVersion: 99 }],
    ['seuil textuel', withBudget(budget => { budget.production.cyclomatic.maxPerFunction = '10'; })],
  ])('un budget corrompu (%s) échoue sans rapport ni preuve périmée', (_name, budget) => {
    mkdirSync(path.join(directory, 'coverage/corrupt'), { recursive: true });
    writeFileSync(path.join(directory, 'coverage/corrupt/code-quality.json'), '{"stale":true}');
    const result = cli(budget, 'corrupt');
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Budget qualité invalide');
    expect(result.stdout).toBe('');
    expect(result.report).toBeNull();
  }, 60000);
});
