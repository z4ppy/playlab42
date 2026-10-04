import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const configName = 'tsconfig.js-contracts.json';
const selected = ['lib/assets.js', 'lib/seeded-random.js', 'lib/local-data/contracts.js'];
const tsc = path.join(root, 'node_modules/.bin/tsc');

describe('checkJs strict sur les corps des modules JavaScript sélectionnés', () => {
  let directory;

  function compile() {
    return spawnSync(tsc, ['-p', configName], { cwd: directory, encoding: 'utf8', timeout: 120000 });
  }

  function mutate(filename, search, replacement) {
    const file = path.join(directory, filename);
    const source = readFileSync(file, 'utf8');
    expect(source).toContain(search);
    writeFileSync(file, source.replace(search, replacement));
  }

  beforeAll(() => {
    mkdirSync(path.join(root, 'coverage'), { recursive: true });
    directory = mkdtempSync(path.join(root, 'coverage', 'application-gates-tsc-'));
    symlinkSync(path.join(root, 'node_modules'), path.join(directory, 'node_modules'), 'dir');
    for (const file of ['tsconfig.json', configName, ...selected]) {
      mkdirSync(path.dirname(path.join(directory, file)), { recursive: true });
      copyFileSync(path.join(root, file), path.join(directory, file));
    }
  });

  afterEach(() => {
    for (const file of selected) {
      copyFileSync(path.join(root, file), path.join(directory, file));
    }
  });

  afterAll(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  test('la configuration cible exactement les modules choisis en strict checkJs', () => {
    const shown = spawnSync(tsc, ['-p', configName, '--showConfig'], { cwd: root, encoding: 'utf8' });
    expect(shown.status).toBe(0);
    const config = JSON.parse(shown.stdout);
    expect(config.compilerOptions).toMatchObject({ allowJs: true, checkJs: true, strict: true, noEmit: true });
    expect([...config.files].sort()).toEqual([...selected].sort().map(file => `./${file}`));
  });

  test('le script typecheck exécute réellement cette passe', () => {
    const scripts = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).scripts;
    expect(scripts['typecheck:js-contracts']).toBe(`tsc --project ${configName}`);
    expect(scripts.typecheck.split(' && ')).toContain('npm run typecheck:js-contracts');
  });

  test('les modules sélectionnés sont acceptés tels que livrés', () => {
    const result = compile();
    expect(result.stderr + result.stdout).toBe('');
    expect(result.status).toBe(0);
  }, 120000);

  test.each([
    ['lib/seeded-random.js', 'this.int(0, array.length - 1)', "this.int('0', array.length - 1)", 'TS2345'],
    ['lib/seeded-random.js', '@param {number} seed - Nombre', '@param {string} seed - Nombre', 'TS2362'],
    ['lib/seeded-random.js', '@returns {number}\n   */\n  random()', '@returns {string}\n   */\n  random()', 'TS2322'],
    ['lib/local-data/contracts.js', '@param {string} key - Clé de stockage.', '@param {number} key - Clé de stockage.', 'TS2345'],
    ['lib/local-data/contracts.js', '.test(id)', '.test(id.length)', 'TS2345'],
    ['lib/assets.js', 'onProgress(completed / total)', "onProgress('terminé')", 'TS2345'],
    ['lib/assets.js', 'this.#images.set(fullPath, img);', 'this.#images.set(fullPath, fullPath);', 'TS2345'],
    ['lib/assets.js', 'return this.#images.get(fullPath);', 'return this.#audio.get(fullPath);', 'TS2322'],
  ])('refuse une invalidation du corps de %s (%#)', (filename, search, replacement, code) => {
    mutate(filename, search, replacement);
    const result = compile();
    expect(result.status).not.toBe(0);
    expect(result.stdout).toContain(filename);
    expect(result.stdout).toContain(code);
  }, 120000);

  test('un paramètre sans contrat est refusé (any implicite) au lieu d’être toléré', () => {
    mutate('lib/local-data/contracts.js', '@param {string} message - Message affichable.\n', '');
    const result = compile();
    expect(result.status).not.toBe(0);
    expect(result.stdout).toContain('TS7006');
  }, 120000);
});
