/**
 * Tests unitaires pour EventEmitter
 *
 * @module __tests__/EventEmitter.test
 */

import { jest } from '@jest/globals';
import { EventEmitter } from '../src/utils/EventEmitter.js';

describe('EventEmitter', () => {
  let emitter;

  beforeEach(() => {
    emitter = new EventEmitter();
  });

  afterEach(() => {
    emitter.dispose();
  });

  describe('on() et emit()', () => {
    test('appelle le callback quand l\'événement est émis', () => {
      const callback = jest.fn();
      emitter.on('test', callback);

      emitter.emit('test', { value: 42 });

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith({ value: 42 });
    });

    test('supporte plusieurs listeners pour le même événement', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      emitter.on('test', callback1);
      emitter.on('test', callback2);

      emitter.emit('test', 'data');

      expect(callback1).toHaveBeenCalledWith('data');
      expect(callback2).toHaveBeenCalledWith('data');
    });

    test('n\'appelle pas les callbacks d\'autres événements', () => {
      const callback = jest.fn();
      emitter.on('event1', callback);

      emitter.emit('event2', 'data');

      expect(callback).not.toHaveBeenCalled();
    });

    test('retourne true si au moins un listener a été appelé', () => {
      emitter.on('test', jest.fn());
      expect(emitter.emit('test')).toBe(true);
    });

    test('retourne false si aucun listener', () => {
      expect(emitter.emit('nonexistent')).toBe(false);
    });

    test('permet le chaînage', () => {
      const result = emitter.on('test', jest.fn());
      expect(result).toBe(emitter);
    });

    test('rejette un callback non-fonction', () => {
      expect(() => emitter.on('test', 'not a function')).toThrow('callback doit être une fonction');
    });
  });

  describe('once()', () => {
    test('appelle le callback une seule fois', () => {
      const callback = jest.fn();
      emitter.once('test', callback);

      emitter.emit('test', 'first');
      emitter.emit('test', 'second');

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith('first');
    });

    test('peut être mélangé avec on()', () => {
      const onceCallback = jest.fn();
      const onCallback = jest.fn();

      emitter.once('test', onceCallback);
      emitter.on('test', onCallback);

      emitter.emit('test', 1);
      emitter.emit('test', 2);

      expect(onceCallback).toHaveBeenCalledTimes(1);
      expect(onCallback).toHaveBeenCalledTimes(2);
    });
  });

  describe('off()', () => {
    test('retire un listener spécifique', () => {
      const callback = jest.fn();
      emitter.on('test', callback);
      emitter.off('test', callback);

      emitter.emit('test', 'data');

      expect(callback).not.toHaveBeenCalled();
    });

    test('ne retire que le listener spécifié', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      emitter.on('test', callback1);
      emitter.on('test', callback2);

      emitter.off('test', callback1);
      emitter.emit('test', 'data');

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).toHaveBeenCalledWith('data');
    });

    test('ne fait rien si le callback n\'existe pas', () => {
      expect(() => {
        emitter.off('test', jest.fn());
      }).not.toThrow();
    });

    test('permet le chaînage', () => {
      const callback = jest.fn();
      emitter.on('test', callback);
      const result = emitter.off('test', callback);
      expect(result).toBe(emitter);
    });
  });

  describe('removeAllListeners()', () => {
    test('retire tous les listeners d\'un événement', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      emitter.on('test', callback1);
      emitter.on('test', callback2);

      emitter.removeAllListeners('test');
      emitter.emit('test', 'data');

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).not.toHaveBeenCalled();
    });

    test('retire tous les listeners de tous les événements', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      emitter.on('event1', callback1);
      emitter.on('event2', callback2);

      emitter.removeAllListeners();
      emitter.emit('event1');
      emitter.emit('event2');

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).not.toHaveBeenCalled();
    });
  });

  describe('listenerCount()', () => {
    test('retourne le nombre de listeners', () => {
      expect(emitter.listenerCount('test')).toBe(0);

      emitter.on('test', jest.fn());
      expect(emitter.listenerCount('test')).toBe(1);

      emitter.on('test', jest.fn());
      expect(emitter.listenerCount('test')).toBe(2);
    });
  });

  describe('eventNames()', () => {
    test('retourne les noms des événements avec des listeners', () => {
      emitter.on('event1', jest.fn());
      emitter.on('event2', jest.fn());

      const names = emitter.eventNames();
      expect(names).toContain('event1');
      expect(names).toContain('event2');
      expect(names.length).toBe(2);
    });

    test('retourne un tableau vide si aucun listener', () => {
      expect(emitter.eventNames()).toEqual([]);
    });
  });

  describe('gestion des erreurs', () => {
    test('ne propage pas les erreurs des callbacks', () => {
      const errorCallback = jest.fn(() => {
        throw new Error('Test error');
      });
      const normalCallback = jest.fn();

      emitter.on('test', errorCallback);
      emitter.on('test', normalCallback);

      // Ne devrait pas throw
      expect(() => emitter.emit('test', 'data')).not.toThrow();

      // Le deuxième callback devrait quand même être appelé
      expect(normalCallback).toHaveBeenCalled();
    });
  });

  describe('dispose()', () => {
    test('nettoie tous les listeners', () => {
      emitter.on('test', jest.fn());
      emitter.once('test2', jest.fn());

      emitter.dispose();

      expect(emitter.listenerCount('test')).toBe(0);
      expect(emitter.listenerCount('test2')).toBe(0);
    });
  });
});
