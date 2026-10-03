import { mkdtempSync, readFileSync, writeFileSync, rmSync, mkdirSync, readdirSync, chmodSync, statSync } from 'node:fs';
import { jest } from '@jest/globals';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as build from './lib/build-utils.js';

let directory;
beforeEach(() => { directory = mkdtempSync(join(tmpdir(), 'playlab-build-quality-')); });
afterEach(() => rmSync(directory, { recursive: true, force: true }));

describe('Contrats des utilitaires de fabrication', () => {
  test.each([
    ['file:///work/library-project/scripts/build.js', '/work/library-project'],
    ['file:///work/library-project/scripts/lib/helper.js', '/work/library-project'],
    ['file:///work/project/scripts/build.js', '/work/project'],
  ])('déduire la racine depuis les segments de %s', (url, expected) => {
    expect(build.getRootDir(url)).toBe(expected);
  });

  test('accepter le même objet JSON avec les deux lecteurs', async () => {
    const path = join(directory, 'valid.json');
    writeFileSync(path, '{"id":"valid"}');
    expect(build.readJSONSync(path)).toEqual({ id: 'valid' });
    await expect(build.readJSONAsync(path)).resolves.toEqual({ id: 'valid' });
    await expect(build.fileExistsAsync(path)).resolves.toBe(true);
    expect(build.fileExistsSync(path)).toBe(true);
    expect(build.fileExistsSync(join(directory, 'absent'))).toBe(false);
  });

  test.each(['{', 'null', '[]', '"text"', '42'])('ne pas masquer une entrée JSON critique %s', async content => {
    const path = join(directory, 'invalid.json');
    writeFileSync(path, content);
    expect(() => build.readJSONSync(path)).toThrow(/invalid\.json/);
    await expect(build.readJSONAsync(path)).rejects.toThrow(/invalid\.json/);
    const stats = build.createStats();
    expect(build.readJSONSync(path, stats)).toBeNull();
    await expect(build.readJSONAsync(path, stats)).resolves.toBeNull();
    expect(stats.errors).toHaveLength(2);
    expect(stats.errors.every(message => message.includes('invalid.json'))).toBe(true);
  });

  test('ne pas confondre absence et permission refusée', async () => {
    await expect(build.fileExistsAsync(join(directory, 'absent'))).resolves.toBe(false);
    const parent = join(directory, 'private');
    mkdirSync(parent);
    const path = join(parent, 'input.json');
    writeFileSync(path, '{}');
    chmodSync(parent, 0o000);
    try {
      await expect(build.fileExistsAsync(path)).rejects.toHaveProperty('code', 'EACCES');
    } finally {
      chmodSync(parent, 0o700);
    }
  });

  test('remplacer un JSON complet sans temporaire résiduel', () => {
    expect(typeof build.writeJSONAtomicSync).toBe('function');
    const path = join(directory, 'output.json');
    writeFileSync(path, '{"old":true}');
    chmodSync(path, 0o600);
    build.writeJSONAtomicSync(path, { current: true });
    expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual({ current: true });
    expect(readdirSync(directory)).toEqual(['output.json']);
    expect(statSync(path).mode & 0o777).toBe(0o600);
  });

  test('préserver le fichier précédent sur sérialisation impossible', () => {
    const path = join(directory, 'output.json');
    writeFileSync(path, '{"old":true}');
    const circular = {};
    circular.self = circular;
    expect(() => build.writeJSONAtomicSync(path, circular)).toThrow(/circular/i);
    expect(readFileSync(path, 'utf8')).toBe('{"old":true}');
    expect(readdirSync(directory)).toEqual(['output.json']);
  });

  test('propager un échec de remplacement et nettoyer le seul temporaire possédé', () => {
    expect(typeof build.writeJSONAtomicSync).toBe('function');
    const path = join(directory, 'output.json');
    mkdirSync(path);
    writeFileSync(join(path, 'keep'), 'previous');
    expect(() => build.writeJSONAtomicSync(path, { current: true })).toThrow();
    expect(readFileSync(join(path, 'keep'), 'utf8')).toBe('previous');
    expect(readdirSync(directory)).toEqual(['output.json']);
  });

  test('refuser un chemin appelant hors des scripts et un JSON undefined', () => {
    expect(() => build.getRootDir('file:///work/project/other/file.js')).toThrow(/hors scripts/);
    expect(() => build.writeJSONAtomicSync(join(directory, 'output.json'), undefined)).toThrow(/sérialisable/);
    expect(readdirSync(directory)).toEqual([]);
  });

  test('contextualiser un fichier absent et conserver sa cause', async () => {
    const path = join(directory, 'absent.json');
    expect(() => build.readJSONSync(path)).toThrow(/absent\.json/);
    await expect(build.readJSONAsync(path)).rejects.toHaveProperty('cause.code', 'ENOENT');
  });

  test('valider les IDs, extraire les domaines et conserver le repli explicite', () => {
    expect(build.isValidId('valid-id')).toBe(true);
    expect(build.isValidId('invalid ID')).toBe(false);
    expect(build.extractDomain('https://www.example.test/path')).toBe('example.test');
    expect(build.extractDomain('invalid')).toBe('invalid');
  });

  test('faire un rapport fidèle des succès, warnings, erreurs et compteurs', () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    try {
      expect(build.printReport(build.createStats())).toBe(true);
      const stats = build.createStats({ warnings: ['warning'], errors: ['error'] });
      expect(build.printReport(stats, { counts: { sources: 2 } })).toBe(false);
      expect(log.mock.calls.flat().join('\n')).toContain('sources: 2');
      expect(log.mock.calls.flat().join('\n')).toContain('warning');
      expect(log.mock.calls.flat().join('\n')).toContain('error');
    } finally {
      log.mockRestore();
    }
  });

  test('fixer la date de fabrication depuis l’epoch sans masquer une entrée invalide', () => {
    expect(build.getBuildTimestamp('0')).toBe('1970-01-01T00:00:00.000Z');
    expect(build.getBuildTimestamp('8640000000000')).toBe('+275760-09-13T00:00:00.000Z');
    expect(build.getBuildTimestamp()).toMatch(/^\d{4}-/);
    for (const epoch of ['', '-1', '01', '1.2', 'abc', '9007199254740992', '8640000000001']) {
      expect(() => build.getBuildTimestamp(epoch)).toThrow(/SOURCE_DATE_EPOCH/);
    }
  });
});
