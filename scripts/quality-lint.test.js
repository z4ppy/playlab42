import { spawnSync } from 'node:child_process';
import { getRootDir } from './lib/build-utils.js';

const cwd = getRootDir(import.meta.url);

test.each(['scripts/og-fetcher.js', 'scripts/lib/build-utils.js'])(
  'le vrai gate complexité cible %s sans ignorer son entrée',
  filename => {
    const lint = input => spawnSync(process.execPath, [
      'node_modules/eslint/bin/eslint.js', '--stdin', '--stdin-filename', filename,
      '--format', 'json', '--max-warnings=0',
    ], { cwd, input, encoding: 'utf8' });
    const valid = lint('export function valid(value) { return value; }\n');
    expect(valid.status).toBe(0);
    expect(JSON.parse(valid.stdout)[0].messages).toEqual([]);
    const branches = Array.from({ length: 10 }, (_, index) => `  if (value === ${index}) {return ${index};}`).join('\n');
    const invalid = lint(`export function excessive(value) {\n${branches}\n  return -1;\n}\n`);
    expect(invalid.status).toBe(1);
    expect(JSON.parse(invalid.stdout)[0].messages).toEqual(expect.arrayContaining([
      expect.objectContaining({ ruleId: 'complexity', severity: 2 }),
    ]));
  },
);
