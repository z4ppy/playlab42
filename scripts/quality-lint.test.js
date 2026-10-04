import { spawnSync } from 'node:child_process';
import { ESLint } from 'eslint';
import { getRootDir } from './lib/build-utils.js';

const cwd = getRootDir(import.meta.url);

test.each([
  ['scripts/og-fetcher.js', 10],
  ['scripts/lib/build-utils.js', 10],
  ['scripts/code-quality-report.js', 10],
  ['scripts/check-deployment.js', 10],
  ['scripts/parcours-utils.js', 10],
  ['scripts/build-catalogue.js', 10],
  ['scripts/build-parcours.js', 10],
  ['scripts/build-bookmarks.js', 10],
  ['scripts/build-typescript.js', 10],
  ['scripts/lib/deployment-validators.js', 10],
  ['scripts/lib/deployment-resources.js', 10],
  ['scripts/lib/manifest-validation.js', 10],
  ['scripts/lib/build-report.js', 10],
  ['games/diese-et-mat/src/AppKeyboard.js', 10],
  ['games/diese-et-mat/src/engine/level-progress.js', 10],
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
  ['games/checkers/index.html', 10],
  ['games/checkers/ui/board-view.js', 10],
  ['games/triomino/index.html', 10],
  ['games/triomino/ui/board-view.js', 10],
  ['games/triomino/ui/board-geometry.js', 10],
  ['games/diese-et-mat/src/audio/AudioEngine.js', 10],
  ['games/diese-et-mat/src/audio/synth-factory.js', 10],
  ['games/diese-et-mat/src/audio/synth-parameters.js', 10],
  ['games/diese-et-mat/src/audio/effects-config.js', 10],
  ['games/diese-et-mat/src/controllers/MenuController.js', 10],
  ['games/diese-et-mat/src/controllers/SynthController.js', 15],
  ['games/diese-et-mat/src/controllers/panel-visibility.js', 10],
  ['games/diese-et-mat/src/controllers/synth-slider-specs.js', 10],
])(
  'le vrai gate complexité cible %s à %i sans ignorer son entrée',
  (filename, limit) => {
    const lint = input => spawnSync(process.execPath, [
      'node_modules/eslint/bin/eslint.js', '--stdin', '--stdin-filename', filename,
      '--format', 'json', '--max-warnings=0',
    ], {
      cwd,
      input: filename.endsWith('.html') ? `<script type="module">\n${input}</script>\n` : input,
      encoding: 'utf8',
    });
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

test('les six responsabilités corrigées restent réellement à complexité dix ou moins', async () => {
  const targets = [
    ['games/checkers/index.html', "Function 'render'"],
    ['games/triomino/index.html', "Function 'renderBoard'"],
    ['games/diese-et-mat/src/audio/AudioEngine.js', "Method '_createSynth'"],
    ['games/diese-et-mat/src/audio/AudioEngine.js', "Method 'applySettings'"],
    ['games/diese-et-mat/src/controllers/MenuController.js', "Method 'render'"],
    ['games/diese-et-mat/src/controllers/SynthController.js', "Method '_updateAllSliders'"],
  ];
  const linter = new ESLint({ cwd, overrideConfig: { rules: { complexity: ['warn', 0] } } });
  const results = await linter.lintFiles([...new Set(targets.map(([filename]) => filename))]);
  for (const [filename, name] of targets) {
    const result = results.find(item => item.filePath === `${cwd}/${filename}`);
    expect(result).toBeDefined();
    expect(result.errorCount).toBe(0);
    expect(result.messages.every(message => message.ruleId)).toBe(true);
    const diagnostic = result.messages.find(message =>
      message.ruleId === 'complexity' && message.message.startsWith(`${name} has `));
    expect(diagnostic).toBeDefined();
    expect(diagnostic.message).toMatch(/has a complexity of (?:[1-9]|10)\. Maximum allowed is 0\.$/);
  }
});
