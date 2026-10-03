import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const biome = resolve(root, 'node_modules/.bin/biome');
const trackedSources = [
  'games/triomino/bots/greedy.ts',
  'games/triomino/bots/random.ts',
  'games/triomino/engine.test.ts',
  'games/triomino/engine.ts',
  'lib/types/game-engine.ts',
  'lib/types/gamekit.test.ts',
  'lib/types/gamekit.ts',
  'lib/types/index.test.ts',
  'lib/types/index.ts',
  'tools/particle-life/__tests__/Simulation.test.ts',
  'tools/particle-life/src/Renderer.ts',
  'tools/particle-life/src/Simulation.ts',
  'tools/particle-life/src/main.ts',
  'tools/particle-life/src/types.ts',
];

function runLint(paths, options = []) {
  const result = spawnSync(biome, [
    'lint', '--error-on-warnings', '--max-diagnostics=none', ...options, ...paths,
  ], { cwd: root, encoding: 'utf8', timeout: 30000 });
  expect(result.error).toBeUndefined();
  expect(result.signal).toBeNull();
  return result;
}

function report(result) {
  const output = JSON.parse(result.stdout);
  expect(output.command).toBe('lint');
  expect(output.summary.skipped).toBe(0);
  expect(output.summary.diagnosticsNotPrinted).toBe(0);
  expect(output.summary.unchanged).toBeGreaterThan(0);
  return output;
}

describe('gate TypeScript avec le vrai CLI Biome', () => {
  let fixture;

  beforeEach(() => {
    fixture = mkdtempSync(resolve(root, 'lib/types/typescript-lint-fixture-'));
  });

  afterEach(() => {
    rmSync(fixture, { recursive: true, force: true });
  });

  function writeFixture(name, source) {
    const path = resolve(fixture, name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, source);
    return path;
  }

  it('accepte une vraie source typée sans ignorer son contenu', () => {
    const path = writeFixture('valid.ts', `
      interface Entry { value: number }
      export function identity<T extends Entry>(entry: T): T { return entry; }
      export const entry = { value: 42 } satisfies Entry;
    `);
    const result = runLint([path], ['--reporter=json']);
    expect(result.status).toBe(0);
    const output = report(result);
    expect(output.summary.unchanged).toBe(1);
    expect(output.diagnostics).toEqual([]);
  });

  it.each([
    ['assignment.ts', 'export let value = 0; export const next = (value = 1);',
      'lint/suspicious/noAssignInExpressions'],
    ['syntax.ts', 'export const value: = 1;', 'parse'],
  ])('échoue avec un diagnostic JSON situé pour %s', (name, source, category) => {
    const path = writeFixture(name, source);
    const result = runLint([path], ['--reporter=json']);
    expect(result.status).not.toBe(0);
    const output = report(result);
    expect(output.summary.errors).toBeGreaterThan(0);
    expect(output.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        severity: 'error',
        category,
        message: expect.any(String),
        location: expect.objectContaining({
          path: expect.stringContaining(name),
          start: expect.objectContaining({ line: 1, column: expect.any(Number) }),
          end: expect.objectContaining({ line: 1, column: expect.any(Number) }),
        }),
      }),
    ]));
  });

  it('fait échouer les warnings réellement activés, même sans erreur', () => {
    const path = writeFixture('warning.ts', 'export const value: any = 1;');
    const result = runLint([path], ['--reporter=json']);
    expect(result.status).not.toBe(0);
    const output = report(result);
    expect(output.summary.errors).toBe(0);
    expect(output.summary.warnings).toBeGreaterThan(0);
    expect(output.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        category: 'lint/suspicious/noExplicitAny',
        severity: 'warning',
      }),
    ]));
    const advisory = spawnSync(biome, ['lint', '--reporter=json', path], {
      cwd: root, encoding: 'utf8', timeout: 30000,
    });
    expect(advisory.error).toBeUndefined();
    expect(advisory.status).toBe(0);
    expect(report(advisory).summary.warnings).toBeGreaterThan(0);
    const gate = spawnSync('npm', ['--silent', 'run', 'lint:ts', '--', '--reporter=json'], {
      cwd: root, encoding: 'utf8', timeout: 30000,
    });
    expect(gate.error).toBeUndefined();
    expect(gate.status).not.toBe(0);
    const gateReport = report(gate);
    expect(gateReport.summary.errors).toBe(0);
    expect(gateReport.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        category: 'lint/suspicious/noExplicitAny',
        location: expect.objectContaining({ path: expect.stringContaining('warning.ts') }),
      }),
    ]));
  });

  it('inclut sources, tests et déclarations, pas JS, dépendances ni sorties', () => {
    const included = [
      writeFixture('source.ts', 'export const value: number = 1;'),
      writeFixture('source.test.ts', 'export const value: number = 1;'),
      writeFixture('source.d.ts', 'export declare const value: number;'),
    ];
    for (const path of [
      'ignored.js', 'node_modules/ignored.ts', 'dist/ignored.ts',
      'site/ignored.ts', 'docs/site/ignored.ts', 'vendor/ignored.ts',
      'assets/vendor/ignored.ts', 'nested/dist/ignored.ts',
      'coverage/ignored.ts', 'data/ignored.ts',
      'nested/coverage/ignored.ts', 'nested/data/ignored.ts',
      'test-results/ignored.ts', 'playwright-report/ignored.ts',
      'nested/test-results/ignored.ts', 'nested/playwright-report/ignored.ts',
    ]) {
      writeFixture(path, 'export const value: = ;');
    }
    const result = runLint([fixture], ['--verbose']);
    expect(result.status).toBe(0);
    const processed = `${result.stdout}\n${result.stderr}`
      .split('\n').filter(line => /^\s+- .*\.ts$/.test(line))
      .map(line => line.trim().slice(2));
    expect(processed.sort()).toEqual(
      included.map(path => path.slice(root.length + 1)).sort(),
    );
  });

  it('vérifie les 14 fichiers TS réels du dépôt, y compris les bots et tests', () => {
    const result = runLint(['.'], ['--verbose']);
    expect(result.status).toBe(0);
    const processed = `${result.stdout}\n${result.stderr}`
      .split('\n').filter(line => /^\s+- .*\.ts$/.test(line))
      .map(line => line.trim().slice(2));
    expect(processed.sort()).toEqual([...trackedSources].sort());
  });

});
