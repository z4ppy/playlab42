import { containedPath, assertVersion, buildRuntimeVendors } from './build-runtime-vendors.js';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { hashFile } from './lib/artifact-inventory.js';

describe('Contrat des distributions runtime', () => {
  test('épingler seulement les distributions autorisées', () => {
    const config = JSON.parse(readFileSync(new URL('./runtime-vendors.json', import.meta.url)));
    expect(config.libraries.map(({ package: name, version }) => `${name}@${version}`)).toEqual([
      'tone@15.1.22',
      'vexflow@5.0.0',
      'mathjax@4.1.3',
      '@mathjax/mathjax-newcm-font@4.1.3',
      'three@0.186.1',
      'lil-gui@0.21.0',
    ]);
  });

  describe('Fabrication runtime caractérisée avant extraction', () => {
    let root;
    const put = async (name, content) => {
      const filename = join(root, name);
      await mkdir(resolve(filename, '..'), { recursive: true });
      await writeFile(filename, content);
    };
    const packageFixture = async (name, files, license = 'MIT') => {
      await put(`node_modules/${name}/package.json`, JSON.stringify({
        name, version: '1.0.0', license, type: 'module', main: 'index.js',
      }));
      for (const [nameInPackage, content] of Object.entries(files)) {
        await put(`node_modules/${name}/${nameInPackage}`, content);
      }
    };
    beforeEach(async () => {
      root = await mkdtemp(join(resolve('scripts'), '.runtime-contract-'));
      await put('package.json', '{"type":"module"}');
    });
    afterEach(async () => {await rm(root, { recursive: true, force: true });});

    test('bundler réellement une dépendance scopée et inventorier copies, licences et notices', async () => {
      await packageFixture('@fixture/dependency', {
        'index.js': 'export const value = 3;',
        LICENSE: 'Licence de la dépendance de test',
        AUTHORS: 'Auteurs de la fixture',
      });
      await packageFixture('fixture-bundle', {
        'index.js': "/*! Fixture pédagogique. */\nimport { value } from '@fixture/dependency';\nimport { increment } from '../../project-local.js';\nexport const result = value + increment;",
        LICENSE: 'Licence du bundle de test',
        NOTICE: 'Notice du bundle de test',
      });
      await put('project-local.js', 'export const increment = 1;');
      await packageFixture('fixture-copy', {
        'nested/runtime.js': 'export const copied = true;',
        'nested/node_modules/private/index.js': 'ne pas distribuer',
        LICENSE: 'Licence de la copie de test',
      });
      const config = { libraries: [
        { package: 'fixture-bundle', version: '1.0.0', bundle: 'index.js', destination: 'bundle/index.js' },
        { package: 'fixture-copy', version: '1.0.0', copy: ['nested'], destination: 'copied' },
      ] };
      const manifest = await buildRuntimeVendors({ root, config });
      const output = join(root, 'assets/vendor');
      const bytes = await readFile(join(output, 'manifest.json'), 'utf8');
      expect(bytes).toBe(`${JSON.stringify(manifest, null, 2)}\n`);
      expect(manifest.libraries).toEqual([
        { package: 'fixture-bundle', version: '1.0.0', destination: 'bundle/index.js' },
        { package: 'fixture-copy', version: '1.0.0', destination: 'copied' },
      ]);
      expect(manifest.licenses.map(item => [item.package, item.notices])).toEqual([
        ['@fixture/dependency', ['AUTHORS', 'LICENSE']],
        ['fixture-bundle', ['LICENSE', 'NOTICE']],
        ['fixture-copy', ['LICENSE']],
      ]);
      expect(await readFile(join(output, 'bundle/index.js'), 'utf8')).toContain('Fixture pédagogique.');
      expect(execFileSync(process.execPath, ['--input-type=module', '-e',
        "import { result } from './assets/vendor/bundle/index.js'; process.stdout.write(String(result));",
      ], { cwd: root, encoding: 'utf8' })).toBe('4');
      expect(await readFile(join(output, 'copied/nested/runtime.js'), 'utf8')).toBe('export const copied = true;');
      await expect(readFile(join(output, 'copied/nested/node_modules/private/index.js')))
        .rejects.toMatchObject({ code: 'ENOENT' });
      const paths = manifest.files.map(file => file.path);
      expect(paths).toEqual([...paths].sort((a, b) => a.localeCompare(b)));
      for (const file of manifest.files) {
        expect(file.bytes).toBe((await readFile(join(output, file.path))).length);
        expect(file.sha256).toBe(hashFile(join(output, file.path)));
      }
      await buildRuntimeVendors({ root, config });
      expect(await readFile(join(output, 'manifest.json'), 'utf8')).toBe(bytes);
    });

    test('préserver la licence de remplacement Apache et sa notice exacte', async () => {
      await packageFixture('fixture-font', { 'font.js': 'export const font = true;' }, 'Apache-2.0');
      await packageFixture('fixture-license', { LICENSE: 'Texte de licence de la fixture' }, 'Apache-2.0');
      const manifest = await buildRuntimeVendors({ root, config: { libraries: [{
        package: 'fixture-font', version: '1.0.0', copy: ['font.js'],
        destination: 'font', licenseFrom: 'fixture-license',
      }] } });
      const output = join(root, 'assets/vendor/licenses/fixture-font');
      expect(await readFile(join(output, 'LICENSE'), 'utf8')).toBe('Texte de licence de la fixture');
      expect(await readFile(join(output, 'NOTICE.txt'), 'utf8')).toBe(
        'fixture-font@1.0.0 déclare Apache-2.0 dans son package.json.\n' +
        'Le paquet ne fournit pas de fichier LICENSE ; le texte Apache-2.0 est conservé depuis fixture-license@1.0.0.\n' +
        'Les fontes originales et leurs métadonnées sont distribuées sans modification.\n',
      );
      expect(manifest.licenses[0].notices).toEqual(['LICENSE', 'NOTICE.txt']);
    });

    test.each([
      ['version', { version: '2.0.0' }, 'fixture-copy : attendu 2.0.0, installé 1.0.0. Exécutez npm ci dans Docker.'],
      ['destination', { destination: '.' }, 'Répertoire vendor réservé ou trop large : .'],
      ['licences', { destination: 'licenses/fixture-copy' }, 'Répertoire vendor réservé ou trop large : licenses/fixture-copy'],
      ['manifest', { destination: 'manifest.json' }, 'Répertoire vendor réservé ou trop large : manifest.json'],
      ['chemin', { destination: '../outside' }, 'Chemin vendor hors périmètre : ../outside'],
    ])('refuser %s avant nettoyage de la première distribution', async (_label, invalid, message) => {
      await packageFixture('fixture-first', { LICENSE: 'Licence', 'first.js': 'premier' });
      await packageFixture('fixture-copy', { LICENSE: 'Licence', 'copy.js': 'second' });
      await put('assets/vendor/first/preserved.js', 'octets antérieurs');
      await put('assets/vendor/manifest.json', 'manifeste antérieur');
      await expect(buildRuntimeVendors({ root, config: { libraries: [
        { package: 'fixture-first', version: '1.0.0', copy: ['first.js'], destination: 'first' },
        { package: 'fixture-copy', version: '1.0.0', copy: ['copy.js'], destination: 'copy', ...invalid },
      ] } })).rejects.toThrow(message);
      expect(await readFile(join(root, 'assets/vendor/first/preserved.js'), 'utf8')).toBe('octets antérieurs');
      expect(await readFile(join(root, 'assets/vendor/manifest.json'), 'utf8')).toBe('manifeste antérieur');
    });

    test.each([null, 'fixture-license', 'fixture-license-mit'])('refuser une licence absente ou incompatible (%s)', async licenseFrom => {
      await packageFixture('fixture-copy', { 'copy.js': 'copie' });
      await packageFixture('fixture-license', { LICENSE: 'Licence de la fixture' }, 'Apache-2.0');
      await packageFixture('fixture-license-mit', { LICENSE: 'Licence de la fixture' });
      await expect(buildRuntimeVendors({ root, config: { libraries: [{
        package: 'fixture-copy', version: '1.0.0', copy: ['copy.js'], destination: 'copy', licenseFrom,
      }] } })).rejects.toThrow(licenseFrom
        ? 'Licence de remplacement incompatible pour fixture-copy'
        : 'Licence absente du paquet fixture-copy');
    });
  });

  test('aligner les versions 3D, le lockfile et les imports locaux du consommateur', () => {
    const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url)));
    const config = read('./runtime-vendors.json');
    const packages = read('../package.json').devDependencies;
    const lock = read('../package-lock.json');
    for (const name of ['three', 'lil-gui']) {
      const library = config.libraries.find(item => item.package === name);
      expect(library).toBeDefined();
      expect(packages[name]).toBe(library.version);
      expect(lock.packages[`node_modules/${name}`].version).toBe(library.version);
    }
    const html = readFileSync(new URL('../tools/relativity-lab/index.html', import.meta.url), 'utf8');
    const { imports } = JSON.parse(html.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]);
    expect(imports).toEqual({
      three: '../../assets/vendor/three/build/three.module.js',
      'three/addons/': '../../assets/vendor/three/examples/jsm/',
      'lil-gui': '../../assets/vendor/lil-gui/dist/lil-gui.esm.js',
    });
  });

  test('refuser une version installée différente', () => {
    expect(() => assertVersion({ package: 'tone', version: '15.1.22' },
      { name: 'tone', version: '14.7.77' })).toThrow('attendu 15.1.22');
    expect(() => assertVersion({ package: 'tone', version: '15.1.22' },
      { name: 'tone', version: '15.1.22' })).not.toThrow();
  });

  test('ne pas sortir des dossiers sources et destinations', () => {
    const root = resolve('assets/vendor');
    expect(containedPath(root, 'tone/tone.js')).toBe(resolve(root, 'tone/tone.js'));
    expect(() => containedPath(root, '../neural-style.html')).toThrow('hors périmètre');
    expect(() => containedPath(root, resolve('tools/neural-style.html'))).toThrow('hors périmètre');
  });

  test('préserver les distributions et licences tierces lors de deux builds runtime', async () => {
    const root = await mkdtemp(join(resolve('scripts'), '.runtime-vendor-test-'));
    const output = join(root, 'assets/vendor');
    const packageRoot = join(root, 'node_modules/test-runtime');
    const config = {
      libraries: [{
        package: 'test-runtime', version: '1.0.0',
        copy: ['runtime.js'], destination: 'tone',
      }],
    };
    try {
      await mkdir(packageRoot, { recursive: true });
      await writeFile(join(packageRoot, 'package.json'), JSON.stringify({
        name: 'test-runtime', version: '1.0.0', license: 'MIT',
      }));
      await writeFile(join(packageRoot, 'LICENSE'), 'Licence du paquet de test');
      await writeFile(join(packageRoot, 'runtime.js'), 'export const version = "1.0.0";');
      const preserved = {
        'three/three.module.js': 'three indépendant',
        'lil-gui/lil-gui.esm.js': 'gui indépendant',
        'licenses/three/LICENSE': 'licence three indépendante',
        'manifest-3d.json': '{"owner":"astra"}',
      };
      for (const [path, bytes] of Object.entries(preserved)) {
        const destination = join(output, path);
        await mkdir(resolve(destination, '..'), { recursive: true });
        await writeFile(destination, bytes);
      }
      await mkdir(join(output, 'tone'), { recursive: true });
      await writeFile(join(output, 'tone/stale.js'), 'ancienne distribution');
      await mkdir(join(output, 'licenses/test-runtime'), { recursive: true });
      await writeFile(join(output, 'licenses/test-runtime/stale.txt'), 'ancienne notice');

      await expect(buildRuntimeVendors({
        root,
        config: { libraries: [{ ...config.libraries[0], destination: '.' }] },
      })).rejects.toThrow('Répertoire vendor réservé ou trop large');
      const first = await buildRuntimeVendors({ root, config });
      const firstBytes = await readFile(join(output, 'manifest.json'), 'utf8');
      await buildRuntimeVendors({ root, config });
      expect(await readFile(join(output, 'manifest.json'), 'utf8')).toBe(firstBytes);
      for (const [path, bytes] of Object.entries(preserved)) {
        expect(await readFile(join(output, path), 'utf8')).toBe(bytes);
        expect(first.files.some((file) => file.path === path)).toBe(false);
      }
      await expect(readFile(join(output, 'tone/stale.js'))).rejects.toMatchObject({ code: 'ENOENT' });
      await expect(readFile(join(output, 'licenses/test-runtime/stale.txt'))).rejects.toMatchObject({ code: 'ENOENT' });
      expect(first.files.map((file) => file.path)).toContain('tone/runtime.js');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
