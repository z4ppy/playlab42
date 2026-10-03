/**
 * Tests du contrat public, des migrations et des échecs de stockage.
 */
import { jest, describe, it, expect } from '@jest/globals';
import {
  BACKUP_FORMAT, LOCAL_DATA_SCHEMA_KEY, MAX_BACKUP_LENGTH, LocalDataError, isManagedKey,
  readLocalData, writeLocalData, writeLocalValues, removeLocalData,
  validateLocalValue, validateBackup, exportLocalData, importLocalData, clearLocalData,
} from './local-data.js';

function createStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    get length() { return data.size; },
    key: index => [...data.keys()][index] ?? null,
    getItem: jest.fn(key => data.get(key) ?? null),
    setItem: jest.fn((key, value) => data.set(key, String(value))),
    removeItem: jest.fn(key => data.delete(key)),
    snapshot: () => Object.fromEntries(data),
  };
}

function backup(entries, version = 1) {
  return JSON.stringify({ format: BACKUP_FORMAT, version, entries });
}

describe('Contrats caractérisés avant extraction du stockage', () => {
  it.each([null, 1, {}, undefined])('refuse une sauvegarde non textuelle %s', value => {
    expect(() => validateBackup(value)).toThrow(expect.objectContaining({ code: 'invalid-data' }));
  });

  it('refuse les clés inconnues et les tables de valeurs non objets avant tout accès', () => {
    const storage = createStorage();
    expect(isManagedKey(null)).toBe(false);
    expect(() => validateLocalValue('foreign', {})).toThrow('Clé non gérée');
    expect(() => readLocalData('foreign', null, storage)).toThrow('Clé non gérée');
    expect(() => writeLocalValues([], storage)).toThrow('Table de valeurs attendue');
    expect(storage.getItem).not.toHaveBeenCalled();
  });

  it.each([NaN, Infinity, -Infinity, undefined, 1n, () => {}, Symbol('x'), new Map(), new Date()])(
    'refuse une valeur JSON non représentable %s sans modifier son entrée', value => {
      const storage = createStorage();
      expect(() => validateLocalValue('progress_test', value)).toThrow(LocalDataError);
      expect(() => writeLocalData('progress_test', value, storage)).toThrow('non sérialisable');
      expect(storage.snapshot()).toEqual({});
    },
  );

  it('accepte un objet sans prototype et des références partagées, sans mutation mémoire', () => {
    const shared = Object.assign(Object.create(null), { z: 2, a: 1 });
    const value = { right: shared, left: shared };
    const storage = createStorage();
    writeLocalData('progress_test', value, storage);
    expect(value.left).toBe(shared);
    expect(value.right).toBe(shared);
    expect(Object.keys(shared)).toEqual(['z', 'a']);
    expect(storage.getItem('progress_test')).toBe('{"left":{"a":1,"z":2},"right":{"a":1,"z":2}}');
  });

  it('borne la profondeur et refuse les propriétés supplémentaires des tableaux', () => {
    let nested = null;
    for (let index = 0; index < 101; index++) { nested = { nested }; }
    expect(() => validateLocalValue('progress_test', nested)).toThrow('profondément');
    const array = [1];
    array.extra = 2;
    expect(() => validateLocalValue('progress_test', array)).toThrow('supplémentaires');
  });

  it.each([
    ['player', { name: '', extra: 1 }],
    ['preferences', { other: 'historique' }],
    ['recent_games', [{ id: '', type: 'tool', timestamp: 0 }]],
    ['scores_test', [{ score: -2.5, date: 0, player: '' }]],
    ['parcours-progress', { epic: { visited: [], current: null } }],
    ['progress_test', null],
    ['progress_test', [1, false, 'legacy']],
  ])('conserve les valeurs historiques autorisées pour %s', (key, value) => {
    const storage = createStorage();
    expect(validateLocalValue(key, value)).toBeUndefined();
    writeLocalData(key, value, storage);
    expect(readLocalData(key, 'absent', storage)).toEqual(value);
  });

  it.each([
    ['recent_games', [{ id: 'x', type: 'game', timestamp: -1 }]],
    ['scores_test', [{ score: 1, date: -1, player: 'Ada' }]],
    ['parcours-progress', { epic: { visited: [], current: 1 } }],
    ['preferences', { sound: null }],
  ])('refuse un format métier incorrect pour %s', (key, value) => {
    expect(() => validateLocalValue(key, value)).toThrow('Type de données invalide');
  });

  it.each(['{"version":-1}', '{"version":0.5}', '{"version":1,"extra":true}', '[]'])(
    'refuse un schéma mal formé %s sans mutation', raw => {
      const storage = createStorage({ [LOCAL_DATA_SCHEMA_KEY]: raw });
      expect(() => removeLocalData('player', storage)).toThrow('Métadonnées');
      expect(storage.snapshot()).toEqual({ [LOCAL_DATA_SCHEMA_KEY]: raw });
      expect(storage.removeItem).not.toHaveBeenCalled();
    },
  );

  it('distingue les versions futures, le JSON invalide et les erreurs natives de stockage', () => {
    const native = new Error('Permission denied');
    const storage = createStorage();
    storage.getItem.mockImplementation(() => { throw native; });
    let error;
    try { readLocalData('player', null, storage); } catch (caught) { error = caught; }
    expect(error).toMatchObject({ name: 'LocalDataError', code: 'storage', cause: native, rollbackFailed: false });
    expect(() => validateBackup(backup({}, 2))).toThrow(expect.objectContaining({ code: 'future-version' }));
    expect(() => validateBackup('{broken')).toThrow(expect.objectContaining({
      code: 'invalid-data', cause: expect.any(SyntaxError),
    }));
  });

  it.each(['length', 'key'])('remonte une erreur d’énumération %s sans export partiel', method => {
    const storage = createStorage({ player: '{"name":"Ada"}' });
    if (method === 'length') {
      Object.defineProperty(storage, 'length', { get() { throw new Error('denied'); } });
    } else {
      storage.key = () => { throw new Error('denied'); };
    }
    expect(() => exportLocalData(storage)).toThrow(expect.objectContaining({ code: 'storage' }));
    expect(() => clearLocalData(storage)).toThrow(LocalDataError);
    expect(storage.snapshot()).toEqual({ player: '{"name":"Ada"}' });
    expect(storage.removeItem).not.toHaveBeenCalled();
  });

  it('capture toutes les anciennes valeurs avant la première écriture', () => {
    const storage = createStorage({ player: '{"name":"Ada"}' });
    const get = storage.getItem.getMockImplementation();
    storage.getItem.mockImplementation(key => {
      if (key === 'preferences') { throw new Error('denied'); }
      return get(key);
    });
    expect(() => importLocalData(backup({ player: '{"name":"Grace"}', preferences: '{}' }), storage)).toThrow(LocalDataError);
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.snapshot()).toEqual({ player: '{"name":"Ada"}' });
  });

  it('ne réécrit pas les valeurs et métadonnées déjà identiques', () => {
    const storage = createStorage({ player: '{"name":"Ada"}', [LOCAL_DATA_SCHEMA_KEY]: '{"version":1}' });
    writeLocalData('player', { name: 'Ada' }, storage);
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.removeItem).not.toHaveBeenCalled();
  });

  it('restaure en ordre inverse uniquement les opérations réussies', () => {
    const native = new Error('quota');
    const target = createStorage({ 'playlab42.theme': 'dark', progress_test: '{"level":1}' });
    const targetSet = target.setItem.getMockImplementation();
    target.setItem.mockImplementation((key, raw) => {
      if (key === LOCAL_DATA_SCHEMA_KEY) { throw native; }
      targetSet(key, raw);
    });
    expect(() => importLocalData(backup({ 'playlab42.theme': null, progress_test: '{"level":2}' }), target))
      .toThrow(expect.objectContaining({ cause: native, rollbackFailed: false }));
    expect(target.snapshot()).toEqual({ 'playlab42.theme': 'dark', progress_test: '{"level":1}' });
    expect(target.setItem.mock.calls).toEqual([
      ['progress_test', '{"level":2}'], [LOCAL_DATA_SCHEMA_KEY, '{"version":1}'],
      ['progress_test', '{"level":1}'], ['playlab42.theme', 'dark'],
    ]);
  });

  it('signale un échec de lecture pendant rollback mais poursuit les autres restaurations', () => {
    const storage = createStorage({ player: '{"name":"Ada"}', preferences: '{"sound":true}' });
    const get = storage.getItem.getMockImplementation();
    const set = storage.setItem.getMockImplementation();
    let rollback = false;
    storage.getItem.mockImplementation(key => {
      if (rollback && key === 'preferences') { throw new Error('read denied'); }
      return get(key);
    });
    storage.setItem.mockImplementation((key, raw) => {
      if (key === LOCAL_DATA_SCHEMA_KEY) { rollback = true; throw new Error('quota'); }
      set(key, raw);
    });
    expect(() => importLocalData(backup({ player: '{"name":"Grace"}', preferences: '{"sound":false}' }), storage))
      .toThrow(expect.objectContaining({ code: 'storage', rollbackFailed: true }));
    expect(storage.snapshot()).toEqual({ player: '{"name":"Ada"}', preferences: '{"sound":false}' });
  });

  it('ne promet pas de restaurer une opération qui modifie le stockage puis lève une erreur', () => {
    const storage = createStorage({ player: '{"name":"Ada"}' });
    const remove = storage.removeItem.getMockImplementation();
    storage.removeItem.mockImplementation(key => { remove(key); throw new Error('after mutation'); });
    expect(() => removeLocalData('player', storage)).toThrow(expect.objectContaining({ rollbackFailed: false }));
    expect(storage.snapshot()).toEqual({});
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('migre une sauvegarde version 0 sans muter la table validée ni les clés absentes', () => {
    const json = JSON.stringify({ format: BACKUP_FORMAT, version: 0, data: {
      preferences: { sound: false }, 'playlab42.theme': 'system',
    } });
    const entries = validateBackup(json);
    expect(Object.getPrototypeOf(entries)).toBeNull();
    expect(entries).toEqual({ preferences: '{"sound":false}', 'playlab42.theme': null });
    const storage = createStorage({ player: '{"name":"Ada"}' });
    expect(importLocalData(json, storage)).toEqual({ count: 2 });
    expect(storage.getItem('player')).toBe('{"name":"Ada"}');
    expect(entries).toEqual({ preferences: '{"sound":false}', 'playlab42.theme': null });
  });
});

describe('Données locales', () => {
  it('preserve une progression historique sans slide courante lors du round-trip', () => {
    const raw = '{"epic":{"visited":["a","b"]}}';
    const storage = createStorage({ 'parcours-progress': raw });
    expect(readLocalData('parcours-progress', {}, storage)).toEqual({ epic: { visited: ['a', 'b'] } });
    expect(storage.getItem('parcours-progress')).toBe(raw);
    const restored = createStorage();
    importLocalData(exportLocalData(storage), restored);
    expect(restored.getItem('parcours-progress')).toBe(raw);
  });

  it('lit les scores, préférences et progressions historiques sans mutation', () => {
    const scores = [{ score: 42, date: 1, player: 'Ada' }];
    const storage = createStorage({
      scores_test: JSON.stringify(scores),
      progress_test: '{"level":2}',
      preferences: '{"sound":false}',
      player: '{"name":"Ada"}',
      'parcours-progress': '{"epic":{"visited":["slide"],"current":"slide"}}',
    });
    expect(readLocalData('scores_test', [], storage)).toEqual(scores);
    expect(readLocalData('progress_test', null, storage)).toEqual({ level: 2 });
    expect(readLocalData('preferences', {}, storage)).toEqual({ sound: false });
    expect(readLocalData('player', {}, storage)).toEqual({ name: 'Ada' });
    expect(readLocalData('parcours-progress', {}, storage).epic.current).toBe('slide');
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it.each([undefined, '{"version":0}', '{"version":1}'])('migre le schéma %s sans envelopper le JSON', metadata => {
    const storage = createStorage(metadata ? { [LOCAL_DATA_SCHEMA_KEY]: metadata } : {});
    writeLocalData('progress_test', { level: 2 }, storage);
    expect(JSON.parse(storage.getItem('progress_test'))).toEqual({ level: 2 });
    expect(JSON.parse(storage.getItem(LOCAL_DATA_SCHEMA_KEY))).toEqual({ version: 1 });
  });

  it('utilise le fallback uniquement pour une clé absente', () => {
    const storage = createStorage({ progress_test: 'null' });
    expect(readLocalData('progress_test', 'fallback', storage)).toBeNull();
    expect(readLocalData('progress_other', 'fallback', storage)).toBe('fallback');
  });

  it.each(['{bad', '{}', '[{"score":"42","date":1,"player":"Ada"}]'])('conserve un score invalide : %s', raw => {
    const storage = createStorage({ scores_test: raw });
    expect(() => readLocalData('scores_test', [], storage)).toThrow(LocalDataError);
    expect(() => writeLocalData('scores_test', [], storage)).toThrow(LocalDataError);
    expect(storage.getItem('scores_test')).toBe(raw);
    expect(storage.removeItem).not.toHaveBeenCalled();
  });

  it.each([
    ['preferences', { sound: 'oui' }],
    ['player', { name: 12 }],
    ['recent_games', [{ id: 'test', type: 'game', timestamp: 'hier' }]],
    ['playlab42.activeTab', 'settings'],
    ['parcours-progress', { epic: { visited: 'slide', current: null } }],
    ['parcours-progress', { epic: { visited: [3], current: null } }],
    ['parcours-progress', []],
    ['playlab42.theme', 'inconnu'],
    ['scores_test', [{ score: Infinity, date: 1, player: 'Ada' }]],
    ['progress_test', undefined],
    ['progress_test', new Date()],
    ['progress_test', [undefined]],
  ])('refuse le mauvais type pour %s avant écriture', (key, value) => {
    const storage = createStorage();
    expect(() => writeLocalData(key, value, storage)).toThrow(LocalDataError);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('refuse les structures cycliques et dangereuses', () => {
    const cycle = {};
    cycle.self = cycle;
    const storage = createStorage();
    expect(() => writeLocalData('progress_test', cycle, storage)).toThrow('circulaire');
    expect(() => writeLocalData('progress_test', JSON.parse('{"__proto__":{}}'), storage)).toThrow('interdite');
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('refuse les tableaux troués et propriétés Symbol sans perte silencieuse', () => {
    const storage = createStorage();
    const sparse = new Array(2);
    sparse[0] = 1;
    sparse.extra = 'compensation';
    expect(() => writeLocalData('progress_test', sparse, storage)).toThrow('incomplet');
    expect(() => writeLocalData('progress_test', { [Symbol('private')]: 'data' }, storage)).toThrow('Symbol');
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('n’efface qu’une clé explicitement demandée', () => {
    const storage = createStorage({ progress_test: '{broken', foreign: 'private' });
    removeLocalData('progress_test', storage);
    expect(storage.getItem('progress_test')).toBeNull();
    expect(storage.getItem('foreign')).toBe('private');
    expect(() => removeLocalData('foreign', storage)).toThrow('non gérée');
  });

  it.each(['{"version":2}', '{"version":"1"}', 'null', '{broken'])('refuse les métadonnées invalides ou futures %s', raw => {
    const storage = createStorage({ [LOCAL_DATA_SCHEMA_KEY]: raw, player: '{"name":"Ada"}' });
    const before = storage.snapshot();
    expect(() => readLocalData('player', null, storage)).toThrow(LocalDataError);
    expect(() => writeLocalData('player', { name: 'Grace' }, storage)).toThrow(LocalDataError);
    expect(() => importLocalData(backup({ player: '{"name":"Grace"}' }), storage)).toThrow(LocalDataError);
    expect(() => exportLocalData(storage)).toThrow(LocalDataError);
    expect(storage.snapshot()).toEqual(before);
  });

  it('valide tous les paramètres d’une écriture groupée', () => {
    const storage = createStorage({ player: '{"name":"Ada"}' });
    expect(() => writeLocalValues({ player: { name: 'Grace' }, preferences: [] }, storage)).toThrow();
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('exclut les clés étrangères, les outils exclus et leurs récents sans les modifier', () => {
    const storage = createStorage({
      scores_test: '[]',
      scores_neural_style: '{bad',
      progress_relativity: '{bad',
      'neural-style': 'SECRET',
      'relativity-lab': 'SECRET',
      foreign: 'SECRET',
      'playlab42.sidebarWidth': '300',
      recent_games: JSON.stringify([
        { id: 'neural-style', type: 'tool', timestamp: 1 },
        { id: 'relativity-lab', type: 'tool', timestamp: 2 },
        { id: 'test', type: 'game', timestamp: 3 },
      ]),
    });
    const before = storage.snapshot();
    const json = exportLocalData(storage);
    expect(json).not.toMatch(/SECRET|neural|relativity|sidebarWidth|foreign/);
    expect(JSON.parse(JSON.parse(json).entries.recent_games)).toHaveLength(1);
    expect(storage.snapshot()).toEqual(before);
    expect(isManagedKey('scores_test')).toBe(true);
    expect(isManagedKey('score_test')).toBe(false);
    expect(isManagedKey('progress_relativity-lab')).toBe(false);
  });

  it('signale une donnée corrompue au lieu de produire un export incomplet', () => {
    const storage = createStorage({ preferences: '{bad', foreign: 'private' });
    expect(() => exportLocalData(storage)).toThrow('JSON invalide');
    expect(storage.getItem('preferences')).toBe('{bad');
  });

  it('produit un aller-retour JSON déterministe et restaure le thème système', () => {
    const source = createStorage({ progress_test: '{"z":2,"a":1}', player: '{"name":"Ada"}' });
    const json = exportLocalData(source);
    const target = createStorage({ foreign: 'private', 'playlab42.theme': 'dark' });
    expect(importLocalData(json, target).count).toBe(3);
    expect(target.getItem('playlab42.theme')).toBeNull();
    expect(target.getItem('foreign')).toBe('private');
    expect(exportLocalData(target)).toBe(json);
    expect(exportLocalData(createStorage({ player: '{"name":"Ada"}', progress_test: '{"z":2,"a":1}' }))).toBe(json);
  });

  it('migre seulement la sauvegarde version 0 documentée', () => {
    const json = JSON.stringify({
      format: BACKUP_FORMAT, version: 0,
      data: { player: { name: 'Ada' }, progress_test: { level: 2 }, 'playlab42.theme': 'system' },
    });
    const storage = createStorage();
    importLocalData(json, storage);
    expect(readLocalData('player', null, storage)).toEqual({ name: 'Ada' });
    expect(readLocalData('progress_test', null, storage)).toEqual({ level: 2 });
    expect(storage.getItem('playlab42.theme')).toBeNull();
    expect(JSON.parse(exportLocalData(storage)).version).toBe(1);
  });

  it.each([
    '{bad', '[]', 'null',
    JSON.stringify({ format: 'another-app', version: 1, entries: {} }),
    JSON.stringify({ format: BACKUP_FORMAT, version: '1', entries: {} }),
    backup({}, 2),
    backup({ player: 42 }),
    backup({ player: '[]' }),
    backup({ player: '{"name":"Grace"}', preferences: '{bad' }),
    backup({ foreign: 'private' }),
    backup({ [LOCAL_DATA_SCHEMA_KEY]: '{"version":1}' }),
    backup({ scores_neural_style: '[]' }),
    backup({ progress_relativity: '{}' }),
    backup({ recent_games: '[{"id":"neural-style","type":"tool","timestamp":1}]' }),
    JSON.stringify({ format: BACKUP_FORMAT, version: 1, entries: {}, unexpected: true }),
    JSON.stringify({ format: BACKUP_FORMAT, version: 0, entries: {} }),
  ])('préserve intégralement le stockage pour l’import invalide %s', json => {
    const storage = createStorage({ player: '{"name":"Ada"}', foreign: 'private', progress_test: '{"level":1}' });
    const before = storage.snapshot();
    expect(() => importLocalData(json, storage)).toThrow(LocalDataError);
    expect(storage.snapshot()).toEqual(before);
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.removeItem).not.toHaveBeenCalled();
  });

  it('permet de remplacer explicitement une donnée corrompue par un import validé', () => {
    const storage = createStorage({ player: '{bad', progress_other: '{"level":9}' });
    importLocalData(backup({ player: '{"name":"Ada"}' }), storage);
    expect(storage.getItem('player')).toBe('{"name":"Ada"}');
    expect(storage.getItem('progress_other')).toBe('{"level":9}');
  });

  it.each(['preferences', LOCAL_DATA_SCHEMA_KEY])('annule les seules écritures importées après quota sur %s', failedKey => {
    const storage = createStorage({ player: '{"name":"Ada"}', foreign: 'private', [LOCAL_DATA_SCHEMA_KEY]: '{"version":0}' });
    const before = storage.snapshot();
    const original = storage.setItem.getMockImplementation();
    storage.setItem.mockImplementation((key, raw) => {
      if (key === failedKey) { throw new Error('QuotaExceededError'); }
      original(key, raw);
    });
    expect(() => importLocalData(backup({ player: '{"name":"Grace"}', preferences: '{"sound":false}' }), storage)).toThrow('quota');
    expect(storage.snapshot()).toEqual(before);
    expect(storage.removeItem).not.toHaveBeenCalledWith('foreign');
  });

  it('annule une nouvelle clé ajoutée après un échec ultérieur', () => {
    const storage = createStorage({ foreign: 'private' });
    const original = storage.setItem.getMockImplementation();
    storage.setItem.mockImplementation((key, raw) => {
      if (key === LOCAL_DATA_SCHEMA_KEY) { throw new Error('quota'); }
      original(key, raw);
    });
    expect(() => importLocalData(backup({ player: '{"name":"Ada"}' }), storage)).toThrow();
    expect(storage.snapshot()).toEqual({ foreign: 'private' });
  });

  it('annule aussi une suppression de thème en cas d’échec ultérieur', () => {
    const storage = createStorage({ 'playlab42.theme': 'dark' });
    const original = storage.setItem.getMockImplementation();
    storage.setItem.mockImplementation((key, raw) => {
      if (key === LOCAL_DATA_SCHEMA_KEY) { throw new Error('quota'); }
      original(key, raw);
    });
    expect(() => importLocalData(backup({ 'playlab42.theme': null }), storage)).toThrow();
    expect(storage.snapshot()).toEqual({ 'playlab42.theme': 'dark' });
  });

  it('n’écrase pas une modification concurrente pendant le retour arrière', () => {
    const storage = createStorage({ player: '{"name":"Ada"}' });
    const original = storage.setItem.getMockImplementation();
    storage.setItem.mockImplementation((key, raw) => {
      if (key === 'preferences') {
        original('player', '{"name":"Concurrent"}');
        throw new Error('quota');
      }
      original(key, raw);
    });
    let caught;
    try { importLocalData(backup({ player: '{"name":"Grace"}', preferences: '{"sound":false}' }), storage); }
    catch (error) { caught = error; }
    expect(caught.rollbackFailed).toBe(true);
    expect(storage.getItem('player')).toBe('{"name":"Concurrent"}');
  });

  it('signale explicitement un retour arrière impossible', () => {
    const storage = createStorage({ player: '{"name":"Ada"}' });
    const original = storage.setItem.getMockImplementation();
    storage.setItem.mockImplementation((key, raw) => {
      if (key === 'preferences' || raw === '{"name":"Ada"}') { throw new Error('disabled'); }
      original(key, raw);
    });
    let caught;
    try { importLocalData(backup({ player: '{"name":"Grace"}', preferences: '{"sound":false}' }), storage); }
    catch (error) { caught = error; }
    expect(caught.rollbackFailed).toBe(true);
    expect(caught.message).toMatch(/incomplet/);
  });

  it('remonte le stockage désactivé sans succès apparent', () => {
    const storage = createStorage();
    storage.getItem.mockImplementation(() => { throw new Error('SecurityError'); });
    expect(() => readLocalData('player', null, storage)).toThrow('Stockage inaccessible');
    expect(() => exportLocalData(storage)).toThrow('Stockage inaccessible');
    expect(() => importLocalData(backup({ player: '{"name":"Ada"}' }), storage)).toThrow('Stockage inaccessible');
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('refuse les fichiers dépassant la limite avant parsing', () => {
    expect(() => validateBackup(' '.repeat(5 * 1024 * 1024 + 1))).toThrow('volumineuse');
  });

  it('applique la limite en octets UTF-8 pour produire des exports réimportables', () => {
    const raw = JSON.stringify({ text: 'é'.repeat(3 * 1024 * 1024) });
    const json = backup({ progress_test: raw });
    expect(() => exportLocalData(createStorage({ progress_test: raw }))).toThrow('volumineuse');
    expect(() => validateBackup(json)).toThrow('volumineuse');
  });

  it('accepte exactement 5 Mio UTF-8 Unicode et refuse un seul octet supplémentaire', async () => {
    const empty = exportLocalData(createStorage({ progress_test: '{"text":""}' }));
    const budget = MAX_BACKUP_LENGTH - new Blob([empty]).size;
    const pattern = 'é漢🙂';
    const patternBytes = new Blob([pattern]).size;
    const payload = pattern.repeat(Math.floor(budget / patternBytes))
      + 'x'.repeat(budget % patternBytes);
    const raw = JSON.stringify({ text: payload });
    const json = exportLocalData(createStorage({ progress_test: raw }));
    const file = new File([json], 'playlab42-local-data.json', { type: 'application/json' });
    expect(file.size).toBe(MAX_BACKUP_LENGTH);
    expect(json.length).toBeLessThan(MAX_BACKUP_LENGTH);
    const restored = createStorage({ foreign: 'private' });
    expect(importLocalData(await file.text(), restored)).toEqual({ count: 2 });
    expect(restored.getItem('progress_test')).toBe(raw);
    expect(restored.getItem('foreign')).toBe('private');
    expect(exportLocalData(restored)).toBe(json);
    expect(new File([`${json}\n`], 'too-big.json').size).toBe(MAX_BACKUP_LENGTH + 1);
    expect(() => validateBackup(`${json}\n`)).toThrow('volumineuse');
    expect(() => exportLocalData(createStorage({
      progress_test: JSON.stringify({ text: `${payload}x` }),
    }))).toThrow('volumineuse');
  });

  it('annule l’accès à localStorage quand son getter est désactivé', () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true, get() { throw new Error('SecurityError'); },
    });
    try {
      expect(() => readLocalData('player', null)).toThrow(LocalDataError);
      expect(() => writeLocalData('player', { name: 'Ada' })).toThrow(LocalDataError);
      expect(() => exportLocalData()).toThrow(LocalDataError);
      expect(() => importLocalData(backup({ player: '{"name":"Ada"}' }))).toThrow(LocalDataError);
      expect(() => clearLocalData()).toThrow(LocalDataError);
    } finally {
      if (descriptor) { Object.defineProperty(globalThis, 'localStorage', descriptor); }
      else { delete globalThis.localStorage; }
    }
  });
});

describe('Réinitialisation explicite des seules données gérées', () => {
  it('réinitialise tout le registre et la métadonnée sans toucher aux clés étrangères/exclues', () => {
    const excluded = {
      foreign: 'private', 'playlab42.sidebarWidth': '300', score_test: '42',
      scores_neural_style: '{bad', progress_relativity: '{bad',
      'neural-style': 'opaque', 'relativity-lab': 'opaque',
    };
    const storage = createStorage({
      ...excluded,
      player: '{"name":"Ada"}', preferences: '{"sound":false}',
      recent_games: '[{"id":"test","type":"game","timestamp":1}]',
      'playlab42.activeTab': 'games', 'playlab42.theme': 'dark',
      'parcours-progress': '{"epic":{"visited":["slide"],"current":"slide"}}',
      scores_test: '[{"score":42,"date":1,"player":"Ada"}]', progress_test: '{"level":2}',
      [LOCAL_DATA_SCHEMA_KEY]: '{"version":1}',
    });
    expect(clearLocalData(storage)).toEqual({ count: 8 });
    expect(storage.snapshot()).toEqual(excluded);
    expect(readLocalData('player', null, storage)).toBeNull();
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.getItem).not.toHaveBeenCalledWith('scores_neural_style');
    expect(storage.getItem).not.toHaveBeenCalledWith('progress_relativity');
  });

  it.each([undefined, '{"version":0}', '{"version":1}'])('réinitialise un schéma connu %s', metadata => {
    const storage = createStorage({
      player: '{"name":"Ada"}', ...(metadata ? { [LOCAL_DATA_SCHEMA_KEY]: metadata } : {}),
    });
    expect(clearLocalData(storage)).toEqual({ count: 1 });
    expect(storage.snapshot()).toEqual({});
  });

  it('ne crée aucune métadonnée quand rien ne doit être effacé', () => {
    const storage = createStorage({ foreign: 'private' });
    expect(clearLocalData(storage)).toEqual({ count: 0 });
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.removeItem).not.toHaveBeenCalled();
    expect(storage.snapshot()).toEqual({ foreign: 'private' });
  });

  it('supprime la métadonnée connue même sans autres données', () => {
    const storage = createStorage({ [LOCAL_DATA_SCHEMA_KEY]: '{"version":1}' });
    expect(clearLocalData(storage)).toEqual({ count: 0 });
    expect(storage.snapshot()).toEqual({});
  });

  it('conserve les références récentes des outils exclus et efface uniquement les autres', () => {
    const recent = [
      { id: 'neural-style', type: 'tool', timestamp: 1 },
      { id: 'test', type: 'game', timestamp: 2 },
      { id: 'relativity-lab', type: 'tool', timestamp: 3 },
    ];
    const storage = createStorage({ recent_games: JSON.stringify(recent), player: '{"name":"Ada"}' });
    expect(clearLocalData(storage)).toEqual({ count: 2 });
    expect(JSON.parse(storage.getItem('recent_games'))).toEqual([recent[0], recent[2]]);
    expect(storage.getItem('player')).toBeNull();
  });

  it('préserve octet par octet les récents contenant seulement des références exclues', () => {
    const raw = '[ { "id": "neural-style", "type": "tool", "timestamp": 1 } ]';
    const storage = createStorage({ recent_games: raw });
    expect(clearLocalData(storage)).toEqual({ count: 0 });
    expect(storage.getItem('recent_games')).toBe(raw);
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.removeItem).not.toHaveBeenCalled();
  });

  it.each(['{"version":999}', '{"version":"1"}', '{bad'])(
    'préserve octet par octet un schéma futur ou invalide %s et toutes ses données', metadata => {
      const storage = createStorage({
        [LOCAL_DATA_SCHEMA_KEY]: metadata, player: '{"name":"Ada"}', progress_test: '{"level":2}',
      });
      const before = storage.snapshot();
      expect(() => clearLocalData(storage)).toThrow(LocalDataError);
      expect(storage.snapshot()).toEqual(before);
      expect(storage.removeItem).not.toHaveBeenCalled();
      expect(storage.setItem).not.toHaveBeenCalled();
    },
  );

  it('prévalide toutes les valeurs avant de supprimer et conserve une corruption', () => {
    const storage = createStorage({ player: '{"name":"Ada"}', scores_test: '{bad' });
    const before = storage.snapshot();
    expect(() => clearLocalData(storage)).toThrow('JSON invalide');
    expect(storage.snapshot()).toEqual(before);
    expect(storage.removeItem).not.toHaveBeenCalled();
  });

  it.each(['preferences', LOCAL_DATA_SCHEMA_KEY])('annule les suppressions après un échec sur %s', failedKey => {
    const storage = createStorage({
      player: '{"name":"Ada"}', preferences: '{"sound":false}', [LOCAL_DATA_SCHEMA_KEY]: '{"version":1}',
      foreign: 'private',
    });
    const before = storage.snapshot();
    const original = storage.removeItem.getMockImplementation();
    storage.removeItem.mockImplementation(key => {
      if (key === failedKey) { throw new Error('Storage disabled'); }
      original(key);
    });
    expect(() => clearLocalData(storage)).toThrow('Stockage inaccessible');
    expect(storage.snapshot()).toEqual(before);
    expect(storage.removeItem).not.toHaveBeenCalledWith('foreign');
  });

  it('annule également le filtrage des récents si une suppression ultérieure échoue', () => {
    const raw = '[{"id":"neural-style","type":"tool","timestamp":1},{"id":"test","type":"game","timestamp":2}]';
    const storage = createStorage({ recent_games: raw, player: '{"name":"Ada"}' });
    storage.removeItem.mockImplementation(() => { throw new Error('Storage disabled'); });
    expect(() => clearLocalData(storage)).toThrow(LocalDataError);
    expect(storage.getItem('recent_games')).toBe(raw);
    expect(storage.getItem('player')).toBe('{"name":"Ada"}');
  });

  it('refuse avant toute suppression un quota lors du filtrage des récents', () => {
    const raw = '[{"id":"neural-style","type":"tool","timestamp":1},{"id":"test","type":"game","timestamp":2}]';
    const storage = createStorage({ recent_games: raw, player: '{"name":"Ada"}' });
    storage.setItem.mockImplementation(() => { throw new Error('QuotaExceededError'); });
    expect(() => clearLocalData(storage)).toThrow('quota');
    expect(storage.getItem('recent_games')).toBe(raw);
    expect(storage.removeItem).not.toHaveBeenCalled();
  });

  it('annonce un rollback incomplet sans écraser une écriture concurrente', () => {
    const storage = createStorage({ player: '{"name":"Ada"}', preferences: '{"sound":false}' });
    const originalRemove = storage.removeItem.getMockImplementation();
    const originalSet = storage.setItem.getMockImplementation();
    storage.removeItem.mockImplementation(key => {
      if (key === 'preferences') {
        originalSet('player', '{"name":"Concurrent"}');
        throw new Error('Storage disabled');
      }
      originalRemove(key);
    });
    let caught;
    try { clearLocalData(storage); } catch (error) { caught = error; }
    expect(caught.rollbackFailed).toBe(true);
    expect(caught.message).toMatch(/incomplet/);
    expect(storage.getItem('player')).toBe('{"name":"Concurrent"}');
  });

  it('annonce le stockage désactivé sans suppression', () => {
    const storage = createStorage({ player: '{"name":"Ada"}' });
    storage.getItem.mockImplementation(() => { throw new Error('SecurityError'); });
    expect(() => clearLocalData(storage)).toThrow('Stockage inaccessible');
    expect(storage.removeItem).not.toHaveBeenCalled();
  });
});
