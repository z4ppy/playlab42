/**
 * Assemble uniquement les distributions 3D épinglées pour l'hébergement statique.
 * Exécuter dans Docker : npm run build:relativity-vendors.
 */
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { copyFile, readFile } from 'node:fs/promises';

const outputDirectory = fileURLToPath(new URL('./dist/vendor/', import.meta.url));
const manifest = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8'));
const distributions = [
  { name: 'three', sourceLicense: 'LICENSE', license: 'THREE-LICENSE.txt' },
  { name: 'lil-gui', sourceLicense: 'LICENSE.md', license: 'LILGUI-LICENSE.txt' },
];
for (const { name } of distributions) {
  const installed = JSON.parse(await readFile(new URL('../package.json', import.meta.resolve(name)), 'utf8'));
  if (installed.version !== manifest.devDependencies[name]) {
    throw new Error(`${name} ${manifest.devDependencies[name]} requis ; ${installed.version} installé. Restaurer le lockfile dans Docker.`);
  }
}

await build({
  entryPoints: {
    'three.module': fileURLToPath(import.meta.resolve('three')),
    OrbitControls: fileURLToPath(import.meta.resolve('three/addons/controls/OrbitControls.js')),
    'lil-gui.esm': fileURLToPath(import.meta.resolve('lil-gui')),
  },
  outdir: outputDirectory,
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  external: ['three'],
  legalComments: 'eof',
});

for (const { name, sourceLicense, license } of distributions) {
  await copyFile(new URL(`../${sourceLicense}`, import.meta.resolve(name)),
    new URL(`./dist/vendor/${license}`, import.meta.url));
}
