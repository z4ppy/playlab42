import { describe, test, expect } from '@jest/globals';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
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
  test('agrège les compteurs, pas les pourcentages, et détaille quatre mesures et priorités', () => {
    const report = buildReport(fixture());
    expect(report).toContain('| app | 18.18% (2/11) | 66.67% (4/6) | 66.67% (2/3) | 18.18% (2/11) |');
    for (const label of ['lib', 'games', 'tools', 'scripts', ...sources.filter(source => source !== 'lib/example.js' && source !== 'scripts/example.js')]) {
      expect(report).toContain(label);
    }
    for (const value of [provenance.sha, '123', '2', 'failure', 'subprocessus', 'HTML', 'E2E']) {
      expect(report).toContain(value);
    }
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
    ['final incohérent', input => { input.finalCoverage[path.join(root, sources[0])].s[0] = 1; }],
    ['final invalide', input => { input.finalCoverage[path.join(root, sources[0])].b[0] = [-1]; }],
    ['provenance absente', input => { input.provenance.sha = ''; }],
    ['run invalide', input => { input.provenance.runId = '123\nspoof'; }],
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
