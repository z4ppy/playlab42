import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import { generateQualityReport, normalizeCognitive, normalizeDuplication, selectSources, sourceScope } from './code-quality-report.js';

const root = path.resolve(import.meta.dirname, '..');
// Budget volontairement large : ces tests vérifient la mesure, pas le budget livré.
const measureOnly = { budget: {
  formatVersion: 1,
  production: { cyclomatic: { maxPerFunction: 1000 }, cognitive: { maxPerFunction: 1000 },
    duplication: { maxClones: 1000000, maxDuplicatedLines: 1000000, maxDuplicatedTokens: 1000000 } },
  advisory: ['pedagogy', 'tests'],
} };

test('les scopes séparent pédagogie/tests et gardent JS/HTML/TS/CSS de production', () => {
  const files = [
    'app/main.js', 'lib/types/contracts.ts', 'games/a/index.html', 'lib/ui.css',
    'parcours/epics/a/assets/graph.js', 'docs/assets/viewer.js',
    'e2e/ui.spec.js', 'lib/__tests__/fixture.js', 'games/a/engine.test.ts',
    'site/app.js', 'tools/a/dist/main.js', 'assets/vendor/three.js',
    'node_modules/plugin/index.js', 'vendor/braces/index.js', 'docs/site/main.js',
  ];
  const selected = selectSources(files);
  expect(selected).toHaveLength(9);
  expect(selected.filter(file => sourceScope(file) === 'production')).toHaveLength(4);
  expect(sourceScope('parcours/epics/a/assets/graph.js')).toBe('pedagogy');
  expect(sourceScope('docs/assets/viewer.js')).toBe('pedagogy');
  expect(sourceScope('games/a/engine.test.ts')).toBe('tests');
});

test('les sorties incomplètes ou incohérentes ne deviennent pas des zéros', () => {
  expect(() => normalizeDuplication({}, root)).toThrow('jscpd invalide');
  expect(() => normalizeDuplication({ statistics: { total: { sources: 0 } }, duplicates: [] }, root)).toThrow();
  expect(() => normalizeCognitive({
    command: 'lint', summary: { errors: 0, skipped: 0, diagnosticsNotPrinted: 1, unchanged: 1 }, diagnostics: [],
  }, root, 1)).toThrow('incomplet');
  expect(() => normalizeCognitive({
    command: 'lint', summary: { errors: 0, skipped: 0, diagnosticsNotPrinted: 0, unchanged: 0 }, diagnostics: [],
  }, root, 1)).toThrow('incomplet');
});

test('les positions de clones hors checkout sont refusées', () => {
  const totals = { sources: 2, lines: 12, tokens: 120, clones: 1, duplicatedLines: 6, duplicatedTokens: 60 };
  expect(() => normalizeDuplication({
    statistics: { total: totals },
    duplicates: [{ tokens: 60, firstFile: { name: '../outside.js', start: 1, end: 6 }, secondFile: { name: 'lib/a.js', start: 1, end: 6 } }],
  }, root)).toThrow('hors racine');
});

test('le rapport CI utilise le lockfile, une provenance et un artefact sans échec masqué', () => {
  const workflow = parse(readFileSync(path.join(root, '.github/workflows/ci.yml'), 'utf8'));
  const job = workflow.jobs['code-quality'];
  expect(job['continue-on-error']).toBeUndefined();
  expect(job.steps.some(step => step.run === 'npm ci')).toBe(true);
  expect(job.steps.find(step => step.run === 'npm run quality:report')).toBeDefined();
  expect(job.steps.some(step => step['continue-on-error'])).toBe(false);
  const archive = job.steps.find(step => step.with?.name?.startsWith('code-quality-'));
  expect(archive.with.name).toContain('${{ github.sha }}-${{ github.run_id }}-${{ github.run_attempt }}');
  expect(archive.if).toBe('always()');
  expect(archive['continue-on-error']).toBeUndefined();
  expect(job.steps.indexOf(archive)).toBeGreaterThan(job.steps.findIndex(step => step.run === 'npm run quality:report'));
  expect(archive.with['if-no-files-found']).toBe('error');
  expect(archive.with.path).toContain('code-quality.json');
  expect(archive.with.path).toContain('code-quality.md');
  const manifest = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
  expect(manifest.devDependencies.jscpd).toBe('5.4.0');
});

test.each([
  'tools/particle-life/src/Simulation.ts',
  'tools/particle-life/src/forces.ts',
])('le vrai budget cognitif protège %s à 10 et refuse 11', filename => {
  mkdirSync(path.join(root, 'coverage'), { recursive: true });
  const directory = mkdtempSync(path.join(root, 'coverage', 'cognitive-budget-'));
  try {
    copyFileSync(path.join(root, 'biome.json'), path.join(directory, 'biome.json'));
    symlinkSync(path.join(root, 'node_modules'), path.join(directory, 'node_modules'), 'dir');
    const source = path.join(directory, filename);
    mkdirSync(path.dirname(source), { recursive: true });
    const run = count => {
      writeFileSync(source, [
        'export function boundary(value: number): number {',
        ...Array.from({ length: count }, (_, i) => `  if (value === ${i}) { return ${i}; }`),
        '  return -1;',
        '}',
        '',
      ].join('\n'));
      return spawnSync(path.join(root, 'node_modules/.bin/biome'), [
        'lint', `--config-path=${directory}`, '--reporter=json', source,
      ], { cwd: directory, encoding: 'utf8' });
    };
    const valid = run(10);
    expect(valid.status).toBe(0);
    expect(JSON.parse(valid.stdout).summary.unchanged).toBe(1);
    expect(JSON.parse(valid.stdout).summary.errors).toBe(0);
    const invalid = run(11);
    expect(invalid.status).toBe(1);
    expect(JSON.parse(invalid.stdout).diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ category: 'lint/complexity/noExcessiveCognitiveComplexity', severity: 'error' }),
    ]));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('mesure intégrée avec les vrais scanners', () => {
  let directory;
  let environment;

  function write(filename, contents) {
    const absolute = path.join(directory, filename);
    mkdirSync(path.dirname(absolute), { recursive: true });
    writeFileSync(absolute, contents);
  }

  beforeEach(() => {
    mkdirSync(path.join(root, 'coverage'), { recursive: true });
    directory = mkdtempSync(path.join(root, 'coverage', 'quality-fixture-'));
    environment = { ...process.env };
    delete process.env.GITHUB_SHA;
    delete process.env.GITHUB_RUN_ID;
    delete process.env.GITHUB_RUN_ATTEMPT;
    delete process.env.GITHUB_STEP_SUMMARY;
    symlinkSync(path.join(root, 'node_modules'), path.join(directory, 'node_modules'), 'dir');
    write('package.json', '{"type":"module"}');
    write('.gitignore', 'node_modules\ncoverage/\n');
    copyFileSync(path.join(root, 'eslint.config.js'), path.join(directory, 'eslint.config.js'));
    write('scripts/lint-source-policy.js', readFileSync(path.join(root, 'scripts/lint-source-policy.js'), 'utf8'));
    const duplicate = [
      'export function boundary(value) {',
      ...Array.from({ length: 11 }, (_, i) => `  if (value === ${i}) {return ${i};}`),
      '  return -1;',
      '}',
      '',
    ].join('\n');
    write('lib/first.js', duplicate);
    write('lib/second.js', duplicate);
    write('lib/probe.mjs', 'export function esm(value) { if (value) { return 1; } return 0; }\n');
    write('lib/probe.cjs', 'module.exports = function common(value) { if (value) { return 1; } return 0; };\n');
    write('tools/probe/src/force.ts', [
      'export function force(values: number[][]): number {',
      '  let total = 0;',
      '  for (const row of values) {',
      '    for (const value of row) {',
      '      if (value > 0) { total += value; }',
      '    }',
      '  }',
      '  return total;',
      '}',
    ].join('\n'));
    write('games/probe/index.html', '<!doctype html><script>\nfunction render(value) { if (value) { return 1; } return 0; } console.log(render(true));\n</script>\n');
    write('parcours/epics/probe/assets/lesson.js', 'export const lesson = 1;\n');
    write('lib/probe.test.js', "test('probe', () => { expect(1).toBe(1); });\n");
    execFileSync('git', ['init', '--quiet'], { cwd: directory });
    execFileSync('git', ['add', '.gitignore', 'package.json', 'eslint.config.js', 'scripts', 'lib', 'tools', 'games', 'parcours'], { cwd: directory });
    execFileSync('git', ['-c', 'user.name=Quality fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--quiet', '-m', 'fixture'], { cwd: directory });
  });

  afterEach(() => {
    for (const name of ['GITHUB_SHA', 'GITHUB_RUN_ID', 'GITHUB_RUN_ATTEMPT', 'GITHUB_STEP_SUMMARY']) {
      if (environment[name] === undefined) { delete process.env[name]; } else { process.env[name] = environment[name]; }
    }
    rmSync(directory, { recursive: true, force: true });
  });

  test('mesure des clones, fonctions JS/HTML et cognitif TS avec provenance réelle', async () => {
    const report = await generateQualityReport(directory, undefined, measureOnly);
    expect(execFileSync('git', ['status', '--porcelain'], { cwd: directory, encoding: 'utf8' })).toBe('');
    expect(report.provenance).toMatchObject({ runId: null, runAttempt: null, workingTree: 'clean' });
    expect(report.provenance.sha).toMatch(/^[a-f0-9]{40}$/);
    expect(report.scopes.production.duplication.totals.clones).toBeGreaterThan(0);
    expect(report.scopes.production.cyclomatic).toEqual(expect.arrayContaining([
      expect.objectContaining({ file: 'lib/first.js', value: 12 }),
      expect.objectContaining({ file: 'games/probe/index.html', value: 2 }),
      expect.objectContaining({ file: 'lib/probe.mjs', value: 2 }),
      expect.objectContaining({ file: 'lib/probe.cjs', value: 2 }),
    ]));
    expect(report.scopes.production.cognitive).toEqual(expect.arrayContaining([
      expect.objectContaining({ file: 'tools/probe/src/force.ts', value: expect.any(Number) }),
    ]));
    expect(report.scopes.pedagogy.files).toContain('parcours/epics/probe/assets/lesson.js');
    expect(report.scopes.tests.files).toEqual(['lib/probe.test.js']);
    const markdown = readFileSync(path.join(directory, 'coverage/code-quality/code-quality.md'), 'utf8');
    expect(markdown).toContain('pas sa complexité cyclomatique');
    expect(markdown).toContain('Budgets de production');
    expect(markdown).toContain('N/A (aucun TS)');
  }, 30000);

  test('la provenance CI valide conserve run, tentative et résumé natif', async () => {
    process.env.GITHUB_SHA = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: directory, encoding: 'utf8' }).trim();
    process.env.GITHUB_RUN_ID = '123';
    process.env.GITHUB_RUN_ATTEMPT = '2';
    process.env.GITHUB_STEP_SUMMARY = path.join(directory, 'coverage/summary.md');
    const report = await generateQualityReport(directory, undefined, measureOnly);
    expect(report.provenance).toEqual({
      sha: process.env.GITHUB_SHA, runId: '123', runAttempt: '2', workingTree: 'clean',
    });
    expect(readFileSync(process.env.GITHUB_STEP_SUMMARY, 'utf8'))
      .toBe(readFileSync(path.join(directory, 'coverage/code-quality/code-quality.md'), 'utf8'));
  }, 30000);

  test('refuse une provenance CI ne correspondant pas au checkout', async () => {
    process.env.GITHUB_SHA = 'a'.repeat(40);
    process.env.GITHUB_RUN_ID = '123';
    process.env.GITHUB_RUN_ATTEMPT = '1';
    await expect(generateQualityReport(directory, undefined, measureOnly)).rejects.toThrow('SHA de provenance différent');
    expect(existsSync(path.join(directory, 'coverage/code-quality/code-quality.json'))).toBe(false);
  }, 30000);

  test('un fichier ignoré par le vrai ESLint ne devient pas zéro fonction', async () => {
    write('eslint.config.js', "export default [{ ignores: ['lib/first.js'] }];\n");
    await expect(generateQualityReport(directory, undefined, measureOnly)).rejects.toThrow('Source ignorée ou non analysée');
    expect(existsSync(path.join(directory, 'coverage/code-quality/code-quality.json'))).toBe(false);
  }, 30000);

  test.each([
    ['lib/first.js', 'export const broken = ;\n'],
    ['tools/probe/src/force.ts', 'export const broken: = 1;\n'],
  ])('un vrai scanner refuse une source invalide (%s) et supprime les preuves précédentes', async (filename, source) => {
    const output = path.join(directory, 'coverage/code-quality');
    mkdirSync(output, { recursive: true });
    writeFileSync(path.join(output, 'code-quality.json'), '{"stale":true}');
    write(filename, source);
    await expect(generateQualityReport(directory, undefined, measureOnly)).rejects.toThrow();
    expect(existsSync(path.join(output, 'code-quality.json'))).toBe(false);
    expect(existsSync(path.join(output, 'code-quality.md'))).toBe(false);
  }, 30000);
});
