/**
 * Contrats avec le vrai Storage de jsdom, sans simuler ses écritures.
 * Ces tests ne remplacent pas une intégration dans Chromium.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll } from '@jest/globals';
import { JSDOM } from 'jsdom';
import {
  BACKUP_FORMAT, LOCAL_DATA_SCHEMA_KEY, LocalDataError,
  readLocalData, writeLocalData, removeLocalData, importLocalData, exportLocalData, clearLocalData,
} from './local-data.js';

const browser = new JSDOM('', { url: 'https://playlab42.test', storageQuota: 1024 });
const { localStorage, DOMException } = browser.window;
const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

function snapshot() {
  return Object.fromEntries(Object.keys(localStorage).map(key => [key, localStorage.getItem(key)]));
}

function backup(entries) {
  return JSON.stringify({ format: BACKUP_FORMAT, version: 1, entries });
}

describe('Données locales avec le Storage réel de jsdom', () => {
  beforeAll(() => {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: localStorage });
  });
  beforeEach(() => { localStorage.clear(); });
  afterAll(() => {
    if (originalDescriptor) { Object.defineProperty(globalThis, 'localStorage', originalDescriptor); }
    else { delete globalThis.localStorage; }
    browser.window.close();
  });

  it('lit, migre, exporte, importe et supprime sans changer les formats historiques', () => {
    localStorage.setItem('player', '{"name":"Ada"}');
    localStorage.setItem('foreign', 'private');
    expect(readLocalData('player', null)).toEqual({ name: 'Ada' });
    expect(localStorage.getItem(LOCAL_DATA_SCHEMA_KEY)).toBeNull();
    const memory = { sound: false };
    writeLocalData('preferences', memory);
    expect(memory).toEqual({ sound: false });
    expect(localStorage.getItem('preferences')).toBe('{"sound":false}');
    expect(localStorage.getItem(LOCAL_DATA_SCHEMA_KEY)).toBe('{"version":1}');
    const exported = exportLocalData();
    removeLocalData('player');
    expect(localStorage.getItem('player')).toBeNull();
    expect(importLocalData(exported)).toEqual({ count: 3 });
    expect(localStorage.getItem('player')).toBe('{"name":"Ada"}');
    expect(clearLocalData()).toEqual({ count: 2 });
    expect(snapshot()).toEqual({ foreign: 'private' });
  });

  it('conserve le vrai QuotaExceededError et le contenu après refus d’une grande valeur', () => {
    localStorage.setItem('player', '{"name":"Ada"}');
    const before = snapshot();
    const value = { text: 'x'.repeat(1024) };
    let error;
    try { writeLocalData('progress_test', value); } catch (caught) { error = caught; }
    expect(error).toBeInstanceOf(LocalDataError);
    expect(error).toMatchObject({ code: 'storage', rollbackFailed: false });
    expect(error.cause).toBeInstanceOf(DOMException);
    expect(error.cause.name).toBe('QuotaExceededError');
    expect(snapshot()).toEqual(before);
    expect(value.text).toHaveLength(1024);
  });

  it('restaure une première écriture réelle quand la suivante dépasse le quota', () => {
    localStorage.setItem('player', '{"name":"Ada"}');
    localStorage.setItem('foreign', 'private');
    const before = snapshot();
    const entries = { player: '{"name":"Grace"}', progress_test: JSON.stringify({ text: 'x'.repeat(1024) }) };
    const saved = { ...entries };
    expect(() => importLocalData(backup(entries))).toThrow(expect.objectContaining({
      code: 'storage', rollbackFailed: false, cause: expect.objectContaining({ name: 'QuotaExceededError' }),
    }));
    expect(entries).toEqual(saved);
    expect(snapshot()).toEqual(before);
    expect(localStorage.getItem(LOCAL_DATA_SCHEMA_KEY)).toBeNull();
  });

  it('remonte le vrai SecurityError d’une origine opaque pour chaque opération', () => {
    const opaque = new JSDOM('', { url: 'about:blank' });
    const deniedStorage = {
      getItem(key) { return opaque.window.localStorage.getItem(key); },
    };
    try {
      expect(() => opaque.window.localStorage).toThrow(expect.objectContaining({ name: 'SecurityError' }));
      for (const operation of [
        () => readLocalData('player', null, deniedStorage),
        () => writeLocalData('player', { name: 'Ada' }, deniedStorage),
        () => removeLocalData('player', deniedStorage),
        () => exportLocalData(deniedStorage),
        () => importLocalData(backup({ player: '{"name":"Ada"}' }), deniedStorage),
        () => clearLocalData(deniedStorage),
      ]) {
        let error;
        try { operation(); } catch (caught) { error = caught; }
        expect(error).toMatchObject({
          code: 'storage', rollbackFailed: false, cause: expect.objectContaining({ name: 'SecurityError' }),
        });
      }
    } finally {
      opaque.window.close();
    }
  });
});
