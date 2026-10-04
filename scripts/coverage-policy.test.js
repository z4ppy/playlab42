import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import config from '../jest.config.js';
import { getRootDir } from './lib/build-utils.js';

const root = getRootDir(import.meta.url);
const floors = {
  './app/events.js': { statements: 95, branches: 95, functions: 100, lines: 95 },
  './app/game-loader.js': { statements: 95, branches: 90, functions: 100, lines: 95 },
  './app/settings.js': { statements: 100, branches: 80, functions: 100, lines: 100 },
  './games/checkers/engine.js': { statements: 95, branches: 90, functions: 100, lines: 95 },
  './games/triomino/engine.ts': { statements: 95, branches: 95, functions: 95, lines: 95 },
  './tools/relativity-lab/src/Simulation.js': { statements: 100, branches: 90, functions: 100, lines: 100 },
  './scripts/coverage-report.js': { statements: 80, branches: 80, functions: 90, lines: 80 },
  './app/keyboard-commands.js': { statements: 100, branches: 100, functions: 100, lines: 100 },
  './app/game-messages.js': { statements: 100, branches: 100, functions: 100, lines: 100 },
  './lib/parcours-viewer.js': { statements: 100, branches: 95, functions: 100, lines: 100 },
  './lib/parcours/{events,keyboard,loading,slide-messages}.js': { statements: 100, branches: 100, functions: 100, lines: 100 },
  './lib/local-data.js': { statements: 100, branches: 85, functions: 100, lines: 100 },
  './lib/local-data/*.js': { statements: 100, branches: 95, functions: 100, lines: 100 },
  './games/diese-et-mat/src/engine/*.js': { statements: 95, branches: 90, functions: 100, lines: 98 },
  './games/go-9x9/engine.js': { statements: 99, branches: 98, functions: 100, lines: 99 },
  './games/tetris/engine.js': { statements: 100, branches: 98, functions: 100, lines: 100 },
  './games/tetris/engine/*.js': { statements: 100, branches: 100, functions: 100, lines: 100 },
  './games/triomino/engine/{placement,scoring}.ts': { statements: 100, branches: 100, functions: 100, lines: 100 },
  './scripts/code-quality-report.js': { statements: 90, branches: 75, functions: 90, lines: 90 },
  './scripts/lib/{build-report,manifest-validation,deployment-resources,deployment-validators}.js': { statements: 100, branches: 100, functions: 100, lines: 100 },
  './games/diese-et-mat/src/AppKeyboard.js': { statements: 100, branches: 100, functions: 100, lines: 100 },
  './tools/particle-life/src/Simulation.ts': { statements: 100, branches: 85, functions: 100, lines: 100 },
  './tools/particle-life/src/forces.ts': { statements: 100, branches: 100, functions: 100, lines: 100 },
  './games/{checkers,triomino}/ui/*.js': { statements: 100, branches: 100, functions: 100, lines: 100 },
  './games/diese-et-mat/src/audio/AudioEngine.js': { statements: 93, branches: 84, functions: 95, lines: 94 },
  './games/diese-et-mat/src/audio/{synth-factory,synth-parameters,effects-config}.js': { statements: 100, branches: 100, functions: 100, lines: 100 },
  './games/diese-et-mat/src/controllers/MenuController.js': { statements: 100, branches: 97, functions: 100, lines: 100 },
  './games/diese-et-mat/src/controllers/SynthController.js': { statements: 96, branches: 86, functions: 96, lines: 98 },
  './games/diese-et-mat/src/controllers/{panel-visibility,synth-slider-specs}.js': { statements: 100, branches: 100, functions: 100, lines: 100 },
};
const concreteSource = selector => selector
  .replace(/\{([^}]+)\}/g, (_, choices) => choices.split(',')[0])
  .replace('*', 'scoring');
const inherited = {
  './lib/seeded-random.js': { branches: 100, functions: 100, lines: 100, statements: 100 },
  './scripts/build-site.js': { branches: 80, functions: 100, lines: 80, statements: 80 },
  './scripts/check-deployment.js': { branches: 80, functions: 100, lines: 80, statements: 80 },
  './scripts/lib/build-utils.js': { branches: 100, functions: 100, lines: 100, statements: 100 },
  './scripts/og-fetcher.js': { branches: 85, functions: 100, lines: 90, statements: 90 },
  './scripts/lib/artifact-inventory.js': { branches: 85, functions: 100, lines: 100, statements: 100 },
};

describe('Ratchet de couverture mesuré par module', () => {
  test('le vrai CLI collecte les modules extraits et le moteur pédagogique', () => {
    const directory = join(root, 'coverage', `collection-${randomUUID()}`);
    const sources = [
      'games/mastermind/engine.js',
      'games/triomino/engine/geometry.ts',
      'games/tetris/engine/scoring.js',
      'games/diese-et-mat/src/engine/ExerciseEngine.js',
      'games/diese-et-mat/src/AppKeyboard.js',
      'games/checkers/ui/board-renderer.js',
      'games/triomino/ui/board-renderer.js',
      'games/diese-et-mat/src/audio/synth-settings.js',
      'games/diese-et-mat/src/controllers/panel-visibility.js',
    ];
    const fixtureHelper = 'lib/__tests__/engine-contract-helpers.js';
    mkdirSync(directory, { recursive: true });
    try {
      writeFileSync(join(directory, 'package.json'), '{"type":"module"}');
      for (const source of [...sources, fixtureHelper]) {
        const filename = join(directory, source);
        mkdirSync(dirname(filename), { recursive: true });
        writeFileSync(filename, [
          'export function observed(value) {',
          '  if (value) { return 1; }',
          '  return 0;',
          '}',
          '',
        ].join('\n'));
      }
      writeFileSync(join(directory, 'probe.test.js'), [
        "import { observed } from './games/mastermind/engine.js';",
        'test("le moteur historique reste instrumenté", () => {',
        '  expect(observed(true)).toBe(1);',
        '});',
        '',
      ].join('\n'));
      writeFileSync(join(directory, 'jest.config.json'), JSON.stringify({
        rootDir: directory,
        testEnvironment: config.testEnvironment,
        testMatch: ['<rootDir>/probe.test.js'],
        transform: { '^.+\\.ts$': join(root, 'jest.transform.cjs') },
        extensionsToTreatAsEsm: config.extensionsToTreatAsEsm,
        collectCoverageFrom: config.collectCoverageFrom,
        coverageReporters: ['json-summary'],
        coverageDirectory: join(directory, 'results'),
      }));
      const result = spawnSync(process.execPath, [
        '--experimental-vm-modules', join(root, 'node_modules/jest/bin/jest.js'),
        '--config', join(directory, 'jest.config.json'), '--coverage', '--runInBand', '--no-cache',
        '--cacheDirectory', join(directory, 'jest-cache'),
      ], { cwd: directory, encoding: 'utf8', timeout: 20000 });
      expect(result.error).toBeUndefined();
      expect(result.status).toBe(0);
      expect(result.stderr).toContain('Tests:       1 passed');
      const metrics = JSON.parse(readFileSync(join(directory, 'results/coverage-summary.json'), 'utf8'));
      expect(metrics[join(directory, fixtureHelper)]).toBeUndefined();
      for (const source of sources) {
        const data = metrics[join(directory, source)];
        expect({ source, instrumented: Boolean(data) }).toEqual({ source, instrumented: true });
        for (const measure of ['statements', 'branches', 'functions', 'lines']) {
          expect(data[measure].total).toBeGreaterThan(0);
        }
        if (source !== sources[0]) {
          expect(data.statements.covered).toBe(0);
          expect(data.functions.covered).toBe(0);
        }
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }, 30000);

  test('conserver exactement les seuils hérités sans ajouter de seuil global', () => {
    for (const [source, threshold] of Object.entries(inherited)) {
      expect(config.coverageThreshold[source]).toEqual(threshold);
    }
    expect(config.coverageThreshold.global).toBeUndefined();
  });

  test.each(Object.entries(floors))('versionner les quatre floors mesurés de %s', (source, threshold) => {
    expect(config.coverageThreshold[source]).toEqual(threshold);
  });

  test.each(Object.keys(floors))('le vrai CLI Jest refuse une régression instrumentée de %s', selector => {
    const source = concreteSource(selector);
    expect(config.coverageThreshold[selector]).toEqual(floors[selector]);
    const directory = join(root, 'coverage', `ratchet-${randomUUID()}`);
    const filename = join(directory, source);
    mkdirSync(dirname(filename), { recursive: true });
    try {
      writeFileSync(join(directory, 'package.json'), '{"type":"module"}');
      writeFileSync(filename, [
        'export function observed(value) {',
        '  if (value) { return 1; }',
        '  return 0;',
        '}',
        'export function secondary(value) {',
        '  if (value) { return 2; }',
        '  return -1;',
        '}',
        '',
      ].join('\n'));
      const fixtureConfig = {
        rootDir: directory,
        testEnvironment: config.testEnvironment,
        testMatch: ['<rootDir>/probe.test.js'],
        transform: { '^.+\\.ts$': join(root, 'jest.transform.cjs') },
        extensionsToTreatAsEsm: config.extensionsToTreatAsEsm,
        collectCoverageFrom: [source.slice(2)],
        coverageThreshold: { [selector]: config.coverageThreshold[selector] },
        coverageReporters: ['json-summary'],
        coverageDirectory: join(directory, 'results'),
      };
      writeFileSync(join(directory, 'jest.config.json'), JSON.stringify(fixtureConfig));
      const run = exerciseSecondary => {
        writeFileSync(join(directory, 'probe.test.js'), [
          `import { observed, secondary } from '${source}';`,
          'test("assertions réelles et vertes", () => {',
          '  expect(observed(true)).toBe(1);',
          '  expect(observed(false)).toBe(0);',
          ...(exerciseSecondary ? ['  expect(secondary(true)).toBe(2);', '  expect(secondary(false)).toBe(-1);'] : []),
          '});',
          '',
        ].join('\n'));
        return spawnSync(process.execPath, [
          '--experimental-vm-modules', join(root, 'node_modules/jest/bin/jest.js'),
          '--config', join(directory, 'jest.config.json'), '--coverage', '--runInBand', '--no-cache',
          '--cacheDirectory', join(directory, 'jest-cache'),
        ], { cwd: directory, encoding: 'utf8', timeout: 20000 });
      };
      const passing = run(true);
      expect(passing.error).toBeUndefined();
      expect(passing.stderr).toContain('Tests:       1 passed');
      expect(passing.stderr).not.toMatch(/Coverage data for .* was not found|No tests found|Cannot find module/);
      expect(passing.status).toBe(0);
      const readMetrics = () => JSON.parse(readFileSync(join(directory, 'results/coverage-summary.json'), 'utf8'))[filename];
      for (const measure of Object.keys(floors[selector])) {
        expect(readMetrics()[measure].pct).toBe(100);
      }

      const failing = run(false);
      expect(failing.error).toBeUndefined();
      expect(failing.status).toBe(1);
      expect(failing.stderr).toContain('Tests:       1 passed');
      expect(failing.stderr).not.toMatch(/Coverage data for .* was not found|No tests found|Cannot find module/);
      for (const [measure, threshold] of Object.entries(floors[selector])) {
        const metrics = readMetrics()[measure];
        expect(metrics.total).toBeGreaterThan(0);
        expect(metrics.pct).toBeLessThan(threshold);
        expect(failing.stderr).toContain(`Coverage for ${measure}`);
        const diagnosticSource = selector === source ? selector : filename;
        expect(failing.stderr).toContain(`"${diagnosticSource}" threshold (${threshold}%)`);
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }, 30000);
});
