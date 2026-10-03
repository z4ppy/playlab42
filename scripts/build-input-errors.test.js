import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { getRootDir } from './lib/build-utils.js';

test.each([
  ['catalogue', 'tools', 'broken.json', '{}'],
  ['bookmarks', 'bookmarks', 'index.json', '{'],
  ['parcours', 'parcours', 'index.json', 'null'],
])('le vrai builder %s échoue explicitement sans remplacer son dernier catalogue', (builder, folder, filename, content) => {
  const root = mkdtempSync(join(tmpdir(), 'playlab-library-input-quality-'));
  try {
    mkdirSync(join(root, 'scripts'));
    mkdirSync(join(root, folder), { recursive: true });
    mkdirSync(join(root, 'data'));
    for (const source of [`build-${builder}.js`, 'og-fetcher.js', 'parcours-utils.js']) {
      cpSync(fileURLToPath(new URL(source, import.meta.url)), join(root, 'scripts', source));
    }
    cpSync(fileURLToPath(new URL('lib', import.meta.url)), join(root, 'scripts', 'lib'), { recursive: true });
    symlinkSync(join(getRootDir(import.meta.url), 'node_modules'), join(root, 'node_modules'));
    writeFileSync(join(root, 'package.json'), '{"type":"module"}');
    writeFileSync(join(root, folder, filename), content);
    const output = join(root, 'data', `${builder}.json`);
    writeFileSync(output, '{"previous":true}');
    const result = spawnSync(process.execPath, [`scripts/build-${builder}.js`, '--skip-og'], {
      cwd: root, encoding: 'utf8', timeout: 10000,
    });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).toContain(filename);
    expect(result.stdout).not.toMatch(/terminé avec succès|Catalogue généré|Catalogue written/);
    expect(readFileSync(output, 'utf8')).toBe('{"previous":true}');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
