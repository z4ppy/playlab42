import { spawnSync } from 'node:child_process';
import { getRootDir } from './lib/build-utils.js';

const cwd = getRootDir(import.meta.url);

test.each([
  ['scripts/og-fetcher.js', 10],
  ['scripts/lib/build-utils.js', 10],
  ['games/checkers/engine.js', 10],
  ['games/go-9x9/engine.js', 10],
  ['games/tetris/engine.js', 10],
  ['games/tetris/engine/commands.js', 10],
  ['app/game-loader.js', 10],
  ['app/keyboard-commands.js', 10],
  ['app/game-messages.js', 10],
  ['lib/parcours-viewer.js', 10],
  ['lib/parcours/ParcoursUI.js', 10],
  ['lib/parcours/loading.js', 10],
  ['lib/local-data.js', 10],
  ['lib/local-data/backup.js', 10],
  ['games/diese-et-mat/src/engine/ExerciseEngine.js', 10],
  ['games/diese-et-mat/src/engine/ProgressTracker.js', 10],
])(
  'le vrai gate complexité cible %s à %i sans ignorer son entrée',
  (filename, limit) => {
    const lint = input => spawnSync(process.execPath, [
      'node_modules/eslint/bin/eslint.js', '--stdin', '--stdin-filename', filename,
      '--format', 'json', '--max-warnings=0',
    ], { cwd, input, encoding: 'utf8' });
    const valid = lint('export function valid(value) { return value; }\n');
    expect(valid.status).toBe(0);
    expect(JSON.parse(valid.stdout)[0].messages).toEqual([]);
    const branchesFor = count => Array.from({ length: count }, (_, index) => `  if (value === ${index}) {return ${index};}`).join('\n');
    const boundary = lint(`export function boundary(value) {\n${branchesFor(limit - 1)}\n  return -1;\n}\n`);
    expect(boundary.status).toBe(0);
    expect(JSON.parse(boundary.stdout)[0].messages).toEqual([]);
    const branches = branchesFor(limit);
    const invalid = lint(`export function excessive(value) {\n${branches}\n  return -1;\n}\n`);
    expect(invalid.status).toBe(1);
    expect(JSON.parse(invalid.stdout)[0].messages).toEqual(expect.arrayContaining([
      expect.objectContaining({ ruleId: 'complexity', severity: 2, message: expect.stringContaining(`Maximum allowed is ${limit}`) }),
    ]));
    expect(JSON.parse(invalid.stdout)[0].messages.every(message => message.ruleId === 'complexity')).toBe(true);
  },
);
