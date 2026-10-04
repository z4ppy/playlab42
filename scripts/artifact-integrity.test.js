import { mkdtempSync, writeFileSync, readFileSync, rmSync, symlinkSync, mkdirSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inventorySite } from './lib/artifact-inventory.js';
import { verifySite } from './verify-site.js';
import { normalizeBuildSBOM } from './build-provenance.js';
import { exerciseArtifactRecovery } from './check-artifact-recovery.js';

let root;
const commit = 'a'.repeat(40);
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'playlab-integrity-'));
  writeFileSync(join(root, 'index.html'), '<html>public</html>');
  mkdirSync(join(root, 'data'));
  writeFileSync(join(root, 'data/bookmarks.json'), '{"categories":[]}');
  writeFileSync(join(root, 'build-info.json'), JSON.stringify({ version: '1.0', commit }));
  writeFileSync(join(root, 'build-manifest.json'), JSON.stringify({
    formatVersion: 1, version: '1.0', commit, files: inventorySite(root),
  }));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

test('vérifier tous les octets et une identité attendue', () => {
  expect(verifySite(root, commit)).toEqual({ version: '1.0', commit, checked: 3 });
  expect(verifySite(root, commit.toUpperCase()).checked).toBe(3);
  expect(() => verifySite(root, 'b'.repeat(40))).toThrow(/Commit différent/);
});

test('conserver stdout, stderr et codes du vrai CLI de vérification', () => {
  const script = fileURLToPath(new URL('./verify-site.js', import.meta.url));
  const run = sha => spawnSync(process.execPath, [script, root], {
    env: { ...process.env, GITHUB_SHA: sha }, encoding: 'utf8', timeout: 5000,
  });
  const valid = run(commit);
  expect(valid.error).toBeUndefined();
  expect(valid.status).toBe(0);
  expect(valid.stdout).toBe(`Artefact vérifié : 3 fichiers, commit ${commit}.\n`);
  expect(valid.stderr).toBe('');
  const invalid = run('b'.repeat(40));
  expect(invalid.error).toBeUndefined();
  expect(invalid.status).toBe(1);
  expect(invalid.stdout).toBe('');
  expect(invalid.stderr).toBe(
    `Vérification du site échouée : Commit différent : attendu ${'b'.repeat(40)}, reçu ${commit}.\n`,
  );
});

test.each([
  ['format', { formatVersion: 2 }, {}],
  ['liste', { files: {} }, {}],
  ['liste vide', { files: [] }, {}],
  ['version absente', {}, { version: '' }],
  ['version non textuelle', {}, { version: 1 }],
  ['versions distinctes', { version: '2.0' }, {}],
  ['commits distincts', { commit: 'b'.repeat(40) }, {}],
  ['commit absent', { commit: undefined }, { commit: undefined }],
  ['commit malformé', { commit: 'main' }, { commit: 'main' }],
  ['commit non textuel', { commit: 1 }, { commit: 1 }],
])('conserver le refus d’identité %s avant contrôle du commit attendu', (_label, manifestFields, identityFields) => {
  const manifest = JSON.parse(readFileSync(join(root, 'build-manifest.json'), 'utf8'));
  const identity = JSON.parse(readFileSync(join(root, 'build-info.json'), 'utf8'));
  writeFileSync(join(root, 'build-manifest.json'), JSON.stringify({ ...manifest, ...manifestFields }));
  writeFileSync(join(root, 'build-info.json'), JSON.stringify({ ...identity, ...identityFields }));
  expect(() => verifySite(root, 'invalid')).toThrow('Manifeste ou identité du build invalide.');
});

test('accepter une identité locale null sans SHA attendu et refuser un SHA invalide', () => {
  writeFileSync(join(root, 'build-info.json'), JSON.stringify({ version: '1.0', commit: null }));
  writeFileSync(join(root, 'build-manifest.json'), JSON.stringify({
    formatVersion: 1, version: '1.0', commit: null, files: inventorySite(root),
  }));
  expect(verifySite(root)).toEqual({ version: '1.0', commit: null, checked: 3 });
  expect(() => verifySite(root, commit)).toThrow(`Commit différent : attendu ${commit}, reçu null.`);
  expect(() => verifySite(root, 'invalid')).toThrow('Commit différent : attendu invalid, reçu null.');
});

test('refuser un inventaire réordonné ou enrichi même avec les mêmes fichiers', () => {
  const path = join(root, 'build-manifest.json');
  const manifest = JSON.parse(readFileSync(path, 'utf8'));
  for (const files of [
    [...manifest.files].reverse(),
    manifest.files.map(file => ({ ...file, additional: true })),
  ]) {
    writeFileSync(path, JSON.stringify({ ...manifest, files }));
    expect(() => verifySite(root, commit)).toThrow(
      'Intégrité du site invalide : fichiers modifiés, absents, supplémentaires ou inventaire non canonique.',
    );
  }
});

test('restaurer une vraie archive tar sans modifier le site original', () => {
  const before = inventorySite(root);
  expect(exerciseArtifactRecovery(root, commit).checked).toBe(3);
  expect(inventorySite(root)).toEqual(before);
});

test.each(['modified', 'missing', 'extra', 'symlink'])('refuser une altération %s et réussir après restauration', kind => {
  const original = readFileSync(join(root, 'index.html'));
  if (kind === 'modified') {writeFileSync(join(root, 'index.html'), 'modified');}
  if (kind === 'missing') {rmSync(join(root, 'index.html'));}
  if (kind === 'extra') {writeFileSync(join(root, 'extra'), 'extra');}
  if (kind === 'symlink') {
    rmSync(join(root, 'index.html'));
    symlinkSync(join(root, 'build-info.json'), join(root, 'index.html'));
  }
  expect(() => verifySite(root, commit)).toThrow();
  rmSync(join(root, 'index.html'), { force: true });
  rmSync(join(root, 'extra'), { force: true });
  writeFileSync(join(root, 'index.html'), original);
  expect(verifySite(root, commit).checked).toBe(3);
});

test('refuser une référence locale absente même si les hashes de tous les fichiers sont cohérents', () => {
  writeFileSync(join(root, 'data/bookmarks.json'), JSON.stringify({
    categories: [{ bookmarks: [{ meta: { ogImage: 'data/bookmarks-images/missing.png' } }] }],
  }));
  const path = join(root, 'build-manifest.json');
  const manifest = JSON.parse(readFileSync(path, 'utf8'));
  writeFileSync(path, JSON.stringify({ ...manifest, files: inventorySite(root) }));
  expect(() => verifySite(root, commit)).toThrow(/Image bookmark locale indisponible/);
});

test('refuser un manifeste/une identité incomplets ou un inventaire prétendant sortir du site', () => {
  const path = join(root, 'build-manifest.json');
  const manifest = JSON.parse(readFileSync(path, 'utf8'));
  writeFileSync(path, JSON.stringify({ ...manifest, files: [{ path: '../private' }] }));
  expect(() => verifySite(root)).toThrow(/Intégrité/);
  writeFileSync(path, JSON.stringify({ ...manifest, formatVersion: 2 }));
  expect(() => verifySite(root)).toThrow(/Manifeste/);
});

test('inventorier les dossiers imbriqués et refuser racine symbolique et fichier non régulier', () => {
  mkdirSync(join(root, 'nested'));
  writeFileSync(join(root, 'nested/file'), 'public');
  expect(inventorySite(root).map(file => file.path)).toContain('nested/file');
  const link = join(root, 'linked-root');
  symlinkSync(root, link);
  expect(() => inventorySite(link)).toThrow(/symbolique/);
  rmSync(link);
  execFileSync('mkfifo', [join(root, 'named-pipe')]);
  expect(() => inventorySite(root)).toThrow(/non régulière/);
});

test('normaliser la SBOM native sans perdre ses composants ou son graphe', () => {
  const bom = {
    bomFormat: 'CycloneDX', serialNumber: 'random',
    metadata: { component: { name: 'checkout-folder' }, tools: [{ name: 'cli', version: '11' }] },
    components: [{ 'bom-ref': 'b' }, { 'bom-ref': 'a' }],
    dependencies: [{ ref: 'b', dependsOn: ['z', 'a'] }, { ref: 'a', dependsOn: [] }],
  };
  const normalized = normalizeBuildSBOM(bom, 'playlab42', '2026-01-01T00:00:00.000Z');
  expect(normalized.serialNumber).toBeUndefined();
  expect(normalized.metadata.component.name).toBe('playlab42');
  expect(normalized.components.map(component => component['bom-ref'])).toEqual(['a', 'b']);
  expect(normalized.dependencies).toEqual([{ ref: 'a', dependsOn: [] }, { ref: 'b', dependsOn: ['a', 'z'] }]);
  expect(() => normalizeBuildSBOM({}, 'project', 'date')).toThrow(/SBOM/);
});
