import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, relative } from 'node:path';
import { randomUUID } from 'node:crypto';
import { getRootDir } from './lib/build-utils.js';

const root = getRootDir(import.meta.url);
const compiler = join(root, 'node_modules/typescript/bin/tsc');

test('le contrôle de types CI compile les signatures des six moteurs réels', () => {
  const result = spawnSync('npm', ['run', 'typecheck:engine-contracts'], {
    cwd: root, encoding: 'utf8', timeout: 30000,
  });
  expect(result.error).toBeUndefined();
  expect(result.status).toBe(0);
  const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  expect(manifest.scripts.typecheck).toContain('npm run typecheck:engine-contracts');
  const project = JSON.parse(readFileSync(join(root, 'tsconfig.engine-contracts.json'), 'utf8'));
  expect(project.files).toEqual(expect.arrayContaining([
    'lib/types/game-engine.contract.test.ts',
    'lib/seeded-random.types.test.ts',
    'games/triomino/engine/api.types.test.ts',
  ]));
});

test('le vrai compilateur refuse un moteur dont une méthode du contrat manque', () => {
  const directory = join(root, 'coverage', `engine-types-${randomUUID()}`);
  mkdirSync(directory, { recursive: true });
  try {
    const source = join(directory, 'probe.ts');
    const contract = relative(dirname(source), join(root, 'lib/types/game-engine.js')).replaceAll('\\', '/');
    const project = join(directory, 'tsconfig.json');
    writeFileSync(project, JSON.stringify({
      extends: join(root, 'tsconfig.engine-contracts.json'),
      files: [source],
    }));
    const run = includeActions => {
      writeFileSync(source, [
        `import type { GameEngine } from '${contract}';`,
        'type State = { turn: number };',
        'const engine: GameEngine<State, { type: "move" }, State, { seed: number }> = {',
        '  init: () => ({ turn: 0 }),',
        '  applyAction: state => ({ turn: state.turn + 1 }),',
        '  isValidAction: () => true,',
        ...(includeActions ? ['  getValidActions: () => [],'] : []),
        '  getPlayerView: state => state,',
        '  isGameOver: () => false,',
        '  getWinners: () => null,',
        '  getCurrentPlayer: () => null,',
        '};',
        'export { engine };',
        '',
      ].join('\n'));
      return spawnSync(process.execPath, [compiler, '--project', project], {
        cwd: root, encoding: 'utf8', timeout: 30000,
      });
    };
    const valid = run(true);
    expect(valid.error).toBeUndefined();
    expect(valid.status).toBe(0);
    const invalid = run(false);
    expect(invalid.error).toBeUndefined();
    expect(invalid.status).not.toBe(0);
    expect(invalid.stdout).toContain('getValidActions');
    expect(invalid.stdout).toContain('is missing');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
