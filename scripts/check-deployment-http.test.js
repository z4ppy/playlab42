import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { checkDeployment, runCli } from './check-deployment.js';
import { hashFile } from './lib/artifact-inventory.js';
import { getRootDir } from './lib/build-utils.js';

const root = getRootDir(import.meta.url);
const script = join(root, 'scripts', 'check-deployment.js');
const commit = 'a'.repeat(40);
const PREFIX = '/playlab42/';

const inputs = () => ({
  packageLock: hashFile(resolve(root, 'package-lock.json')),
  ogSnapshot: hashFile(resolve(root, 'metadata/bookmarks-og.json')),
});

/** Écrit un site complet et minimal dans un vrai dossier temporaire. */
function writeSite(dir, overrides = {}) {
  const files = {
    'build-info.json': JSON.stringify({ version: '0.2.0', commit }),
    'build-manifest.json': JSON.stringify({
      formatVersion: 1, version: '0.2.0', commit, inputs: inputs(), files: [{ path: 'index.html' }],
    }),
    'index.html': '<!doctype html><html>Portail</html>',
    'docs/site/index.html': '<html>Guides</html>',
    'data/catalogue.json': JSON.stringify({ tools: [{ path: 'tools/x/index.html' }], games: [{ path: 'games/x/index.html' }] }),
    'data/parcours.json': JSON.stringify({ epics: [{
      path: 'parcours/epics/x',
      structure: [{ type: 'section', children: [{ type: 'slide', id: '01-intro' }] }],
    }] }),
    'data/bookmarks.json': JSON.stringify({ categories: [{ id: 'dev', bookmarks: [] }] }),
    'tools/x/index.html': '<html>Outil</html>',
    'games/x/index.html': '<html>Jeu</html>',
    'parcours/epics/x/slides/01-intro/index.html': '<html>Slide</html>',
    ...overrides,
  };
  for (const [name, content] of Object.entries(files)) {
    if (content === null) {continue;}
    mkdirSync(dirname(join(dir, name)), { recursive: true });
    writeFileSync(join(dir, name), content);
  }
}

describe('Contrôle de publication contre un vrai serveur HTTP', () => {
  let dir;
  let server;
  let base;
  let seen;

  const start = async (overrides) => {
    dir = mkdtempSync(join(tmpdir(), 'playlab-deployment-'));
    writeSite(dir, overrides);
    seen = [];
    server = createServer((request, response) => {
      seen.push(request.url);
      const local = request.url.startsWith(PREFIX) ? request.url.slice(PREFIX.length) : null;
      const target = local === null ? null : join(dir, local);
      if (!target || !existsSync(target) || !statSync(target).isFile()) {
        response.writeHead(404).end('absent');
      } else {
        response.writeHead(200).end(readFileSync(target));
      }
    });
    await new Promise(done => server.listen(0, '127.0.0.1', done));
    base = `http://127.0.0.1:${server.address().port}${PREFIX}`;
  };

  afterEach(async () => {
    if (server) {await new Promise(done => server.close(done));}
    if (dir) {rmSync(dir, { recursive: true, force: true });}
    server = undefined;
    dir = undefined;
  });

  test('vérifier dix ressources réelles dans l’ordre, entrées de fabrication comprises', async () => {
    await start();
    await expect(checkDeployment(base, commit, inputs())).resolves.toEqual({ version: '0.2.0', commit, checked: 10 });
    expect(seen).toEqual([
      'build-info.json', 'build-manifest.json', 'index.html', 'docs/site/index.html',
      'data/catalogue.json', 'data/parcours.json', 'data/bookmarks.json',
      'tools/x/index.html', 'games/x/index.html', 'parcours/epics/x/slides/01-intro/index.html',
    ].map(path => PREFIX + path));
  });

  test('accepter un build local sans commit ni entrées attendues', async () => {
    await start({
      'build-info.json': JSON.stringify({ version: '0.2.0', commit: null }),
      'build-manifest.json': JSON.stringify({ formatVersion: 1, version: '0.2.0', commit: null, files: [{ path: 'a' }] }),
    });
    await expect(checkDeployment(base)).resolves.toEqual({ version: '0.2.0', commit: null, checked: 10 });
  });

  test.each([
    ['ressource absente', { 'games/x/index.html': null }, 'HTTP 404 : '],
    ['JSON illisible', { 'data/bookmarks.json': '{' }, 'JSON invalide'],
    ['page HTML invalide', { 'tools/x/index.html': 'erreur' }, 'Page HTML invalide'],
    ['catalogue vide', { 'data/catalogue.json': '{"tools":[],"games":[]}' }, 'Catalogue invalide ou vide : tools'],
    ['chemin hors site', { 'data/catalogue.json': '{"tools":[{"path":"../secret"}],"games":[{}]}' }, 'Ressource hors du site publié'],
    ['manifeste incohérent', { 'build-manifest.json': '{"formatVersion":2}' }, 'Manifeste de fabrication'],
  ])('échouer explicitement : %s', async (_nom, overrides, message) => {
    await start(overrides);
    await expect(checkDeployment(base, commit, inputs())).rejects.toThrow(message);
  });

  test('refuser des entrées de fabrication différentes de celles publiées', async () => {
    await start();
    await expect(checkDeployment(base, commit, { ...inputs(), packageLock: 'f'.repeat(64) }))
      .rejects.toThrow('Contenu publié différent des sources attendues : packageLock.');
  });

  test('ne jamais requêter hors du serveur ni échouer silencieusement après arrêt du serveur', async () => {
    await start();
    const url = base;
    await new Promise(done => server.close(done));
    server = undefined;
    await expect(checkDeployment(url)).rejects.toThrow(/^Ressource indisponible : .*build-info\.json \(/);
  });

  test('interface CLI : succès, échec, usage et codes de sortie', async () => {
    await start();
    const run = (...args) => new Promise(done => {
      execFile(process.execPath, [script, ...args], { cwd: root }, (error, stdout, stderr) => {
        done({ status: error ? error.code : 0, stdout, stderr });
      });
    });
    const ok = await run(base, commit);
    expect(ok).toMatchObject({ status: 0, stderr: '' });
    expect(ok.stdout).toBe(`Publication vérifiée : 0.2.0, commit ${commit}, 10 ressources.\n`);
    const mismatch = await run(base, 'b'.repeat(40));
    expect(mismatch.status).toBe(1);
    expect(mismatch.stdout).toBe('');
    expect(mismatch.stderr).toBe(`Contrôle de publication échoué : Commit publié différent : attendu ${'b'.repeat(40)}, reçu ${commit}.\n`);
    for (const args of [[], [base, commit, 'extra']]) {
      const usage = await run(...args);
      expect(usage).toMatchObject({ status: 1, stdout: '' });
      expect(usage.stderr).toBe('Usage : node scripts/check-deployment.js <url-du-site> [sha-attendu]\n');
    }
    expect((await run('ftp://x/')).stderr).toContain('URL de publication invalide');
  });

  test('runCli : mêmes sorties et mêmes codes sans sous-processus, SHA vide traité comme local', async () => {
    await start();
    const out = [];
    const err = [];
    const io = { log: message => out.push(message), error: message => err.push(message) };
    await expect(runCli(['node', 'script', base, ''], io)).resolves.toBe(0);
    expect(out).toEqual([`Publication vérifiée : 0.2.0, commit ${commit}, 10 ressources.`]);
    await expect(runCli(['node', 'script', base, 'main'], io)).resolves.toBe(1);
    expect(err).toEqual(['Contrôle de publication échoué : Le commit attendu doit être un SHA Git complet.']);
    await expect(runCli(['node'], io)).resolves.toBe(1);
    expect(err[1]).toBe('Usage : node scripts/check-deployment.js <url-du-site> [sha-attendu]');
    expect(out).toHaveLength(1);
  });

  test('runCli : écrire « local » pour un build sans commit', async () => {
    await start({
      'build-info.json': JSON.stringify({ version: '0.2.0', commit: null }),
      'build-manifest.json': JSON.stringify({ formatVersion: 1, version: '0.2.0', commit: null, inputs: inputs(), files: [{ path: 'a' }] }),
    });
    const out = [];
    await expect(runCli(['node', 'script', base], { log: m => out.push(m), error: () => {} })).resolves.toBe(0);
    expect(out).toEqual(['Publication vérifiée : 0.2.0, commit local, 10 ressources.']);
  });
});
