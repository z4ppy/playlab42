import { mkdtempSync, readFileSync, writeFileSync, rmSync, mkdirSync, readdirSync, chmodSync, statSync } from 'node:fs';
import * as fs from 'node:fs';
import { jest } from '@jest/globals';
import { join } from 'node:path';

const atomicIO = {
  openSync: jest.fn(fs.openSync),
  closeSync: jest.fn(fs.closeSync),
  fchmodSync: jest.fn(fs.fchmodSync),
  writeFileSync: jest.fn(fs.writeFileSync),
  renameSync: jest.fn(fs.renameSync),
};
jest.unstable_mockModule('fs', () => ({ ...fs, ...atomicIO }));
const build = await import('./lib/build-utils.js');

let directory;
beforeEach(() => { directory = mkdtempSync(join(process.cwd(), '.playlab-build-quality-')); });
afterEach(() => {
  rmSync(directory, { recursive: true, force: true });
  jest.clearAllMocks();
});

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

  test.each([0o022, 0o077])('préserver explicitement le mode 0664 malgré l’umask %s', mask => {
    const path = join(directory, 'output.json');
    writeFileSync(path, '{"old":true}');
    chmodSync(path, 0o664);
    const previousMask = process.umask(mask);
    try {
      build.writeJSONAtomicSync(path, { current: true });
      expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual({ current: true });
      expect(statSync(path).mode & 0o777).toBe(0o664);
      expect(readdirSync(directory)).toEqual(['output.json']);
      expect(process.umask()).toBe(mask);
    } finally {
      process.umask(previousMask);
    }
  });

  test.each([0o022, 0o077])('respecter l’umask %s pour un fichier nouveau', mask => {
    const path = join(directory, 'nested', 'output.json');
    const previousMask = process.umask(mask);
    try {
      build.writeJSONAtomicSync(path, { current: true });
      expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual({ current: true });
      expect(statSync(path).mode & 0o777).toBe(0o666 & ~mask);
      expect(readdirSync(join(directory, 'nested'))).toEqual(['output.json']);
      expect(atomicIO.fchmodSync).not.toHaveBeenCalled();
      expect(process.umask()).toBe(mask);
    } finally {
      process.umask(previousMask);
    }
  });

  test('ne pas confondre un mode existant 0000 avec un fichier nouveau', () => {
    const path = join(directory, 'output.json');
    writeFileSync(path, '{"old":true}');
    chmodSync(path, 0o000);
    try {
      build.writeJSONAtomicSync(path, { current: true });
      expect(statSync(path).mode & 0o777).toBe(0o000);
      expect(atomicIO.fchmodSync).toHaveBeenCalledWith(expect.any(Number), 0o000);
      expect(readdirSync(directory)).toEqual(['output.json']);
    } finally {
      chmodSync(path, 0o600);
    }
    expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual({ current: true });
  });

  test.each(['fchmodSync', 'writeFileSync', 'renameSync'])(
    'préserver l’ancien contenu et nettoyer après un échec de %s',
    operation => {
      const path = join(directory, 'output.json');
      writeFileSync(path, '{"old":true}');
      chmodSync(path, 0o664);
      const error = new Error(`Échec simulé : ${operation}`);
      atomicIO[operation].mockImplementationOnce(() => { throw error; });
      expect(() => build.writeJSONAtomicSync(path, { current: true })).toThrow(error);
      expect(readFileSync(path, 'utf8')).toBe('{"old":true}');
      expect(statSync(path).mode & 0o777).toBe(0o664);
      expect(readdirSync(directory)).toEqual(['output.json']);
      const descriptor = atomicIO.openSync.mock.results[0].value;
      expect(atomicIO.closeSync).toHaveBeenCalledWith(descriptor);
      expect(() => fs.fstatSync(descriptor)).toThrow(expect.objectContaining({ code: 'EBADF' }));
      if (operation !== 'renameSync') {
        expect(atomicIO.renameSync).not.toHaveBeenCalled();
      }
    },
  );

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
