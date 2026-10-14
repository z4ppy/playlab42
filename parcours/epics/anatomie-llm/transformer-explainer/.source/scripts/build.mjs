import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const source = fileURLToPath(new URL('..', import.meta.url));
process.chdir(source);
const localModel = process.argv.find(argument => argument.startsWith('--local-model='));
const localDirectory = localModel ? resolve(localModel.slice('--local-model='.length)) : undefined;
const publicDirectory = resolve('..', 'public');
if (localDirectory && (localDirectory === publicDirectory || localDirectory.startsWith(`${publicDirectory}/`))) {
  throw new Error('La copie source des poids doit être hors de public/, que le build régénère.');
}
rmSync('static/runtime', { recursive: true, force: true });
mkdirSync('static/runtime', { recursive: true });
// Une seule version, servie localement : aucun repli vers jsDelivr.
for (const name of ['ort-wasm-simd-threaded.mjs', 'ort-wasm-simd-threaded.wasm']) {
  cpSync(join('node_modules/onnxruntime-web/dist', name), join('static/runtime', name));
}
const notices = [];
function licenses(folder) {
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) {continue;}
    const path = join(folder, entry.name);
    if (entry.name.startsWith('@')) { licenses(path); continue; }
    const names = readdirSync(path);
    if (!names.includes('package.json')) {continue;}
    const pkg = JSON.parse(readFileSync(join(path, 'package.json'), 'utf8'));
    const texts = readdirSync(path, { withFileTypes: true })
      .filter(entry => entry.isFile() && /license|licence|copying|notice/i.test(entry.name))
      .map(entry => `\n${entry.name}\n${readFileSync(join(path, entry.name), 'utf8')}`).join('\n');
    notices.push(`\n=== ${pkg.name}@${pkg.version} (${pkg.license || 'voir notice'}) ===\n${texts}`);
    if (names.includes('node_modules')) {licenses(join(path, 'node_modules'));}
  }
}
licenses(resolve('node_modules'));
writeFileSync('static/licenses/dependencies.txt', notices.sort().join('\n'));
execFileSync(process.execPath, ['scripts/remove-telemetry.mjs'], { stdio: 'inherit' });
execFileSync('npm', ['run', 'build'], { stdio: 'inherit' });
if (localDirectory) {
  execFileSync(process.execPath, ['scripts/local-model.mjs', '--from', localDirectory], { stdio: 'inherit' });
}
console.log('Fork statique construit dans transformer-explainer/public/.');
