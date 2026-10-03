import { containedPath, assertVersion, buildRuntimeVendors } from './build-runtime-vendors.js';
import { readFileSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

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
