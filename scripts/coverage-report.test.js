import { describe, test, expect } from '@jest/globals';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { parse } from 'yaml';
import jestConfig from '../jest.config.js';
import { buildReport } from './coverage-report.js';

const root = process.cwd();
const sources = [
  'app/events.js', 'app/game-loader.js', 'app/settings.js',
  'lib/example.js', 'games/checkers/engine.js', 'games/triomino/engine.ts',
  'tools/relativity-lab/src/Simulation.js', 'scripts/example.js',
];
const provenance = { sha: 'a'.repeat(40), runId: '123', runAttempt: '2', tests: 'failure' };

function fixture() {
  const summary = {};
  const finalCoverage = {};
  for (const [index, source] of sources.entries()) {
    const count = index === 0 ? 9 : 1;
    const hits = index === 0 ? 0 : 1;
    const file = path.join(root, source);
    const s = {};
    const statementMap = {};
    for (let id = 0; id < count; id++) {
      s[id] = hits;
      statementMap[id] = { start: { line: id + 1, column: 0 }, end: { line: id + 1, column: 1 } };
    }
    finalCoverage[file] = { path: file, s, statementMap, f: { 0: hits }, fnMap: { 0: {} }, b: { 0: [hits, hits] }, branchMap: { 0: {} } };
    const metric = (total, covered) => ({ total, covered, skipped: 0, pct: total ? covered / total * 100 : 100 });
    summary[file] = {
      statements: metric(count, hits * count), lines: metric(count, hits * count),
      functions: metric(1, hits), branches: metric(2, hits * 2),
    };
  }
  summary.total = {};
  for (const measure of ['statements', 'branches', 'functions', 'lines']) {
    const values = Object.values(summary).filter(value => value[measure]).map(value => value[measure]);
    const total = values.reduce((sum, value) => sum + value.total, 0);
    const covered = values.reduce((sum, value) => sum + value.covered, 0);
    summary.total[measure] = { total, covered, skipped: 0, pct: covered / total * 100 };
  }
  return { summary, finalCoverage, provenance: { ...provenance }, root };
}

describe('rapport de preuves Jest', () => {
  test('la CI collecte après échec sans neutraliser Tests et conserve Codecov consultatif', () => {
    const workflow = parse(readFileSync('.github/workflows/ci.yml', 'utf8'));
    const steps = workflow.jobs.test.steps;
    const tests = steps.find(step => step.id === 'jest');
    expect(tests.run).toBe('npm run test:coverage');
    expect(tests['continue-on-error']).toBeUndefined();
    const report = steps.find(step => step.run?.includes('node scripts/coverage-report.js'));
    expect(report.if).toBe('always()');
    expect(report.env.TEST_OUTCOME).toBe('${{ steps.jest.outcome }}');
    expect(report['continue-on-error']).toBeUndefined();
    const artifact = steps.find(step => step.with?.name?.startsWith('jest-coverage-'));
    expect(artifact.if).toBe('always()');
    expect(artifact.with.name).toContain('${{ github.sha }}-${{ github.run_id }}-${{ github.run_attempt }}');
    for (const file of ['coverage-summary.json', 'coverage-final.json', 'lcov.info', 'provenance.json', 'coverage-report.md']) {
      expect(artifact.with.path).toContain(`coverage/${file}`);
    }
    expect(artifact.with['if-no-files-found']).toBe('error');
    const codecov = steps.find(step => step.uses?.startsWith('codecov/'));
    expect(codecov.if).toBe('always()');
    expect(codecov['continue-on-error']).toBe(true);
    expect(codecov.with.fail_ci_if_error).toBe(false);
    expect(parse(readFileSync('codecov.yml', 'utf8')).flags.unittests.paths).toEqual(['app/', 'lib/', 'games/', 'tools/', 'scripts/']);
    expect(jestConfig.coverageReporters).toEqual(expect.arrayContaining(['json', 'json-summary', 'lcov']));
    expect(jestConfig.coverageThreshold.global).toBeUndefined();
  });

  test('agrège les compteurs, pas les pourcentages, et détaille quatre mesures et priorités', () => {
    const report = buildReport(fixture());
    expect(report).toContain('| app | 18.18% (2/11) | 66.66% (4/6) | 66.66% (2/3) | 18.18% (2/11) |');
    expect(report).toContain('|---|---|---|---|---|\n| Total instrumenté');
    for (const label of ['lib', 'games', 'tools', 'scripts', ...sources.filter(source => source !== 'lib/example.js' && source !== 'scripts/example.js')]) {
      expect(report).toContain(label);
    }
    for (const value of [provenance.sha, '123', '2', 'failure', 'subprocessus', 'HTML', 'E2E']) {
      expect(report).toContain(value);
    }
  });

  test('préserver la priorité des refus avant extraction des entrées', () => {
    const input = fixture();
    input.summary.total = null;
    input.finalCoverage[path.join(root, sources[0])].s[0] = -1;
    expect(() => buildReport(input)).toThrow('total : objet attendu');
    const second = fixture();
    second.finalCoverage[path.join(root, 'scripts/extra.js')] = {};
    second.summary.total.lines.covered = 1000;
    expect(() => buildReport(second)).toThrow('coverage-final.json : fichiers incohérents');
  });

  test('ne pas normaliser une source hors racine ni ignorer son erreur de chemin', () => {
    const input = fixture();
    const file = path.join(root, 'scripts/example.js');
    input.summary['relative.js'] = input.summary[file];
    input.finalCoverage['relative.js'] = { ...input.finalCoverage[file], path: 'relative.js' };
    delete input.summary[file];
    delete input.finalCoverage[file];
    expect(() => buildReport(input)).toThrow('relative.js : source hors racine');
  });

  test.each([
    [77, 78, 'app/events.js', '98.71% (77/78)'],
    [2521, 3452, 'Total instrumenté', '73.13% (2535/3466)'],
  ])('tronque comme Istanbul sans changer les compteurs de %s/%s', (covered, total, label, expected) => {
    const input = fixture();
    const file = path.join(root, 'app/events.js');
    input.finalCoverage[file].b[0] = Array.from({ length: total }, (_, index) => index < covered ? 1 : 0);
    input.summary[file].branches = { total, covered, skipped: 0, pct: Math.floor(covered / total * 10000) / 100 };
    input.summary.total.branches.total += total - 2;
    input.summary.total.branches.covered += covered;
    input.summary.total.branches.pct = Math.floor(input.summary.total.branches.covered / input.summary.total.branches.total * 10000) / 100;
    const before = JSON.stringify(input);
    const report = buildReport(input);
    const row = report.split('\n').find(line => line.startsWith(`| ${label} |`));
    expect(row.split(' | ')[2]).toBe(expected);
    expect(JSON.stringify(input)).toBe(before);
  });

  test('distingue le rapport sans gate des seuils versionnés appliqués par Jest', () => {
    const report = buildReport(fixture());
    expect(report).toContain('Ce rapport n’applique pas de seuil ; Jest applique les seuils versionnés. Aucune certification globale.');
    expect(report).not.toContain('Aucun seuil nouveau');
  });

  test('un dénominateur nul est non applicable, pas une preuve à 100%', () => {
    const input = fixture();
    const file = path.join(root, 'lib/example.js');
    input.finalCoverage[file].f = {};
    input.finalCoverage[file].fnMap = {};
    input.summary[file].functions = { total: 0, covered: 0, skipped: 0, pct: 100 };
    input.summary.total.functions.total--;
    input.summary.total.functions.covered--;
    input.summary.total.functions.pct = 6 / 7 * 100;
    expect(buildReport(input)).toContain('N/A (0/0)');
  });

  test('les lignes partagées prennent le hit maximal sans compter deux lignes', () => {
    const input = fixture();
    const file = path.join(root, 'lib/example.js');
    const final = input.finalCoverage[file];
    final.s[0] = 0;
    final.s[1] = 1;
    final.statementMap[1] = final.statementMap[0];
    input.summary[file].statements = { total: 2, covered: 1, skipped: 0, pct: 50 };
    input.summary.total.statements.total++;
    input.summary.total.statements.pct = input.summary.total.statements.covered / input.summary.total.statements.total * 100;
    expect(buildReport(input)).toContain('| lib | 50.00% (1/2) | 100.00% (2/2) | 100.00% (1/1) | 100.00% (1/1) |');
  });

  test.each([
    ['résumé absent', input => { input.summary = null; }],
    ['final absent', input => { input.finalCoverage = {}; }],
    ['famille absente', input => { delete input.summary[path.join(root, 'lib/example.js')]; }],
    ['priorité absente', input => { delete input.summary[path.join(root, 'app/events.js')]; }],
    ['compteur manquant', input => { delete input.summary.total.lines; }],
    ['compteur négatif', input => { input.summary.total.lines.total = -1; }],
    ['compteur fractionnaire', input => { input.summary.total.lines.covered = 0.5; }],
    ['compteur excessif', input => { input.summary.total.lines.covered = 1000; }],
    ['pourcentage invalide', input => { input.summary.total.lines.pct = 'unknown'; }],
    ['total incohérent', input => { input.summary.total.lines.total++; }],
    ['skipped incohérent', input => { input.summary.total.lines.skipped++; }],
    ['final incohérent', input => { input.finalCoverage[path.join(root, sources[0])].s[0] = 1; }],
    ['final invalide', input => { input.finalCoverage[path.join(root, sources[0])].b[0] = [-1]; }],
    ['provenance absente', input => { input.provenance.sha = ''; }],
    ['run invalide', input => { input.provenance.runId = '123\nspoof'; }],
    ['run avec saut final', input => { input.provenance.runId = '123\n'; }],
    ['SHA avec saut final', input => { input.provenance.sha += '\n'; }],
    ['statut invalide', input => { input.provenance.tests = 'unknown'; }],
    ['source hors racine', input => { input.summary['/outside/source.js'] = input.summary[path.join(root, sources[0])]; }],
  ])('refuse %s explicitement', (_name, mutate) => {
    const input = fixture();
    mutate(input);
    expect(() => buildReport(input)).toThrow();
  });

  test('échappe le Markdown et HTML des chemins supplémentaires maîtrisés', () => {
    const input = fixture();
    const from = path.join(root, 'scripts/example.js');
    const to = path.join(root, 'scripts/a|<img> `[link].js');
    input.summary[to] = input.summary[from];
    input.finalCoverage[to] = { ...input.finalCoverage[from], path: to };
    delete input.summary[from];
    delete input.finalCoverage[from];
    const report = buildReport(input);
    expect(report).not.toContain('<img>');
    expect(report).not.toContain('a|');
    expect(report).toContain('a&#124;&lt;img&gt;');
    expect(report).toContain('&#96;&#91;link&#93;');
  });

  test.each(['success', 'failure'])('le vrai CLI conserve provenance et statut %s', tests => {
    const directory = path.join(root, 'coverage', `report-test-${randomUUID()}`);
    mkdirSync(directory, { recursive: true });
    const input = fixture();
    for (const [name, data] of [['coverage-summary.json', input.summary], ['coverage-final.json', input.finalCoverage]]) {
      writeFileSync(path.join(directory, name), JSON.stringify(data));
    }
    writeFileSync(path.join(directory, 'lcov.info'), 'TN:\nSF:app/events.js\nDA:1,0\nend_of_record\n');
    const env = { ...process.env, GITHUB_SHA: provenance.sha, GITHUB_RUN_ID: '123', GITHUB_RUN_ATTEMPT: '2', TEST_OUTCOME: tests, GITHUB_STEP_SUMMARY: path.join(directory, 'step.md') };
    try {
      const result = spawnSync(process.execPath, ['scripts/coverage-report.js', directory], { env, encoding: 'utf8' });
      expect(result.stderr).toBe('');
      expect(result.status).toBe(0);
      expect(JSON.parse(readFileSync(path.join(directory, 'provenance.json'), 'utf8'))).toEqual({ ...provenance, tests });
      expect(readFileSync(env.GITHUB_STEP_SUMMARY, 'utf8')).toContain(tests);
      writeFileSync(path.join(directory, 'lcov.info'), '');
      const invalid = spawnSync(process.execPath, ['scripts/coverage-report.js', directory], { env, encoding: 'utf8' });
      expect(invalid.status).toBe(1);
      expect(invalid.stderr).toContain('lcov.info');
      rmSync(path.join(directory, 'lcov.info'));
      const missing = spawnSync(process.execPath, ['scripts/coverage-report.js', directory], { env, encoding: 'utf8' });
      expect(missing.status).toBe(1);
      expect(missing.stderr).toContain('lcov.info');
      expect(readFileSync(env.GITHUB_STEP_SUMMARY, 'utf8')).toContain('ERREUR');
      expect(readFileSync(path.join(directory, 'coverage-report.md'), 'utf8')).toContain('ERREUR');
      writeFileSync(path.join(directory, 'coverage-summary.json'), '{invalid');
      expect(spawnSync(process.execPath, ['scripts/coverage-report.js', directory], { env }).status).toBe(1);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
