import { existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const repository = resolve(import.meta.dirname, '..');
const root = join(repository, `.core-rng-build-fixture-${process.pid}`);

function write(path, content) {
  const target = join(root, path);
  mkdirSync(join(target, '..'), { recursive: true });
  writeFileSync(target, content);
}

beforeAll(() => {
  mkdirSync(root);
  write('package.json', '{"type":"module"}');
  write('scripts/build-typescript.js', readFileSync(join(repository, 'scripts/build-typescript.js'), 'utf8'));
  write('lib/seeded-random.js', readFileSync(join(repository, 'lib/seeded-random.js'), 'utf8'));
  symlinkSync(join(repository, 'node_modules'), join(root, 'node_modules'));
  write('games/example/engine.ts', `
    export { roll, loadSibling } from './engine/random.js';
    export { marker } from './marker.js';
  `);
  write('games/example/engine/random.ts', `
    import { SeededRandom } from '../../../lib/seeded-random.js';
    export const roll = () => new SeededRandom(42).random();
    export const loadSibling = async () => (await import('./sibling.js')).sibling;
  `);
  write('games/example/engine/sibling.ts', 'export const sibling: string = "sibling";');
  write('games/example/marker.js', 'export const marker = "local-js";');
  // Import historique exprimé depuis bots/dist/, pas depuis le fichier source.
  write('games/example/bots/greedy.ts', 'export { marker } from "../../dist/engine.js";');
  write('tools/example/src/main.ts', 'export { value } from "./nested/value.js";');
  write('tools/example/src/nested/value.ts', 'export const value: number = 17;');
  write('smoke.mjs', `
    import { roll, marker, loadSibling } from './games/example/dist/engine.js';
    import { marker as botMarker } from './games/example/bots/dist/greedy.js';
    import { value } from './tools/example/dist/main.js';
    console.log(JSON.stringify([roll(), marker, await loadSibling(), botMarker, value]));
  `);
});

afterAll(() => rmSync(root, { recursive: true, force: true }));

test('les modules TS émis chargent le vrai JS partagé et préservent les arbres internes et imports historiques', () => {
  const build = spawnSync(process.execPath, ['scripts/build-typescript.js'], {
    cwd: root, encoding: 'utf8', timeout: 10000,
  });
  expect(build.error).toBeUndefined();
  expect(build.status).toBe(0);
  const smoke = spawnSync(process.execPath, ['smoke.mjs'], {
    cwd: root, encoding: 'utf8', timeout: 10000,
  });
  expect(smoke.error).toBeUndefined();
  expect(smoke.stderr).toBe('');
  expect(smoke.status).toBe(0);
  expect(JSON.parse(smoke.stdout)).toEqual([
    0.6011037519201636, 'local-js', 'sibling', 'local-js', 17,
  ]);
  const emitted = readFileSync(join(root, 'games/example/dist/engine/random.js'), 'utf8');
  expect(emitted).toContain('../../../../lib/seeded-random.js');
  expect(emitted).not.toContain('class SeededRandom');
  expect(readFileSync(join(root, 'games/example/dist/engine.js'), 'utf8')).toContain('./engine/random.js');
});

test('le mode watch utilise les mêmes sorties sans créer de JS dans les sources', async () => {
  const child = spawn(process.execPath, ['scripts/build-typescript.js', '--watch'], {
    cwd: root, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', data => { output += data; });
  child.stderr.on('data', data => { output += data; });
  const exited = new Promise(resolveExit => child.on('exit', resolveExit));
  const waitFor = async predicate => {
    const deadline = Date.now() + 5000;
    while (!predicate()) {
      if (child.exitCode !== null || Date.now() > deadline) {
        throw new Error(`Watch indisponible : ${output}`);
      }
      await new Promise(resolveWait => setTimeout(resolveWait, 50));
    }
  };
  try {
    await waitFor(() => output.includes('fichier(s) transpilé(s)'));
    write('games/example/engine/sibling.ts', 'export const sibling: string = "updated";');
    await waitFor(() => readFileSync(join(root, 'games/example/dist/engine/sibling.js'), 'utf8').includes('updated'));
    write('games/example/engine/sibling.ts', 'export const sibling: string = "watched";');
    await waitFor(() => readFileSync(join(root, 'games/example/dist/engine/sibling.js'), 'utf8').includes('watched'));
    expect(existsSync(join(root, 'games/example/engine.js'))).toBe(false);
    expect(existsSync(join(root, 'games/example/engine/sibling.js'))).toBe(false);
    const smoke = spawnSync(process.execPath, ['smoke.mjs'], {
      cwd: root, encoding: 'utf8', timeout: 10000,
    });
    expect(smoke.status).toBe(0);
    expect(JSON.parse(smoke.stdout)).toEqual([
      0.6011037519201636, 'local-js', 'watched', 'local-js', 17,
    ]);
  } finally {
    child.kill('SIGINT');
    await exited;
  }
});
