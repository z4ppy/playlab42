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
};
const inherited = {
  './lib/seeded-random.js': { branches: 100, functions: 100, lines: 100, statements: 100 },
  './scripts/build-site.js': { branches: 80, functions: 100, lines: 80, statements: 80 },
  './scripts/check-deployment.js': { branches: 80, functions: 100, lines: 80, statements: 80 },
  './scripts/lib/build-utils.js': { branches: 100, functions: 100, lines: 100, statements: 100 },
  './scripts/og-fetcher.js': { branches: 85, functions: 100, lines: 90, statements: 90 },
  './scripts/lib/artifact-inventory.js': { branches: 85, functions: 100, lines: 100, statements: 100 },
};

describe('Ratchet de couverture mesuré par module', () => {
  test('conserver exactement les seuils hérités sans ajouter de seuil global', () => {
    for (const [source, threshold] of Object.entries(inherited)) {
      expect(config.coverageThreshold[source]).toEqual(threshold);
    }
    expect(config.coverageThreshold.global).toBeUndefined();
  });

  test.each(Object.entries(floors))('versionner les quatre floors mesurés de %s', (source, threshold) => {
    expect(config.coverageThreshold[source]).toEqual(threshold);
  });

  test.each(Object.keys(floors))('le vrai CLI Jest refuse une régression instrumentée de %s', source => {
    expect(config.coverageThreshold[source]).toEqual(floors[source]);
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
        coverageThreshold: { [source]: config.coverageThreshold[source] },
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
      for (const measure of Object.keys(floors[source])) {
        expect(readMetrics()[measure].pct).toBe(100);
      }

      const failing = run(false);
      expect(failing.error).toBeUndefined();
      expect(failing.status).toBe(1);
      expect(failing.stderr).toContain('Tests:       1 passed');
      expect(failing.stderr).not.toMatch(/Coverage data for .* was not found|No tests found|Cannot find module/);
      for (const [measure, threshold] of Object.entries(floors[source])) {
        const metrics = readMetrics()[measure];
        expect(metrics.total).toBeGreaterThan(0);
        expect(metrics.pct).toBeLessThan(threshold);
        expect(failing.stderr).toContain(`Coverage for ${measure}`);
        expect(failing.stderr).toContain(`"${source}" threshold (${threshold}%)`);
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }, 30000);
});
