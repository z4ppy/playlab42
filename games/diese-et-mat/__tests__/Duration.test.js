/**
 * Tests unitaires pour Duration
 *
 * @module __tests__/Duration.test
 */

import { Duration } from '../src/core/Duration.js';

describe('Duration', () => {
  describe('Constructeur', () => {
    test('crée une durée valide', () => {
      const duration = new Duration('quarter');
      expect(duration.base).toBe('quarter');
      expect(duration.dots).toBe(0);
      expect(duration.tuplet).toBeNull();
    });

    test('crée une durée pointée', () => {
      const duration = new Duration('quarter', 1);
      expect(duration.dots).toBe(1);
    });

    test('crée une durée avec tuplet', () => {
      const duration = new Duration('eighth', 0, { ratio: [3, 2] });
      expect(duration.tuplet).toEqual({ ratio: [3, 2] });
    });

    test('rejette une durée de base invalide', () => {
      expect(() => new Duration('invalid')).toThrow('Durée de base invalide');
    });

    test('rejette un nombre de points invalide', () => {
      expect(() => new Duration('quarter', -1)).toThrow(
        'Nombre de points invalide',
      );
      expect(() => new Duration('quarter', 3)).toThrow(
        'Nombre de points invalide',
      );
    });
  });

  describe('toTicks()', () => {
    test('noire = 1024 ticks', () => {
      expect(new Duration('quarter').toTicks()).toBe(1024);
    });

    test('blanche = 2048 ticks', () => {
      expect(new Duration('half').toTicks()).toBe(2048);
    });

    test('ronde = 4096 ticks', () => {
      expect(new Duration('whole').toTicks()).toBe(4096);
    });

    test('croche = 512 ticks', () => {
      expect(new Duration('eighth').toTicks()).toBe(512);
    });

    test('double croche = 256 ticks', () => {
      expect(new Duration('sixteenth').toTicks()).toBe(256);
    });

    test('noire pointée = 1536 ticks (1024 * 1.5)', () => {
      expect(new Duration('quarter', 1).toTicks()).toBe(1536);
    });

    test('noire double-pointée = 1792 ticks (1024 * 1.75)', () => {
      expect(new Duration('quarter', 2).toTicks()).toBe(1792);
    });

    test('triolet de croches = 341 ticks (512 * 2/3)', () => {
      const triplet = new Duration('eighth', 0, { ratio: [3, 2] });
      expect(triplet.toTicks()).toBe(341);
    });
  });

  describe('toBeats()', () => {
    test('noire = 1 temps en 4/4', () => {
      expect(new Duration('quarter').toBeats({ beatValue: 4 })).toBe(1);
    });

    test('blanche = 2 temps en 4/4', () => {
      expect(new Duration('half').toBeats({ beatValue: 4 })).toBe(2);
    });

    test('noire = 2 temps en 6/8 (croche = temps)', () => {
      expect(new Duration('quarter').toBeats({ beatValue: 8 })).toBe(2);
    });

    test('croche = 1 temps en 6/8', () => {
      expect(new Duration('eighth').toBeats({ beatValue: 8 })).toBe(1);
    });
  });

  describe('toSeconds()', () => {
    test('noire à 60 BPM = 1 seconde', () => {
      expect(new Duration('quarter').toSeconds(60)).toBe(1);
    });

    test('noire à 120 BPM = 0.5 seconde', () => {
      expect(new Duration('quarter').toSeconds(120)).toBe(0.5);
    });

    test('blanche à 60 BPM = 2 secondes', () => {
      expect(new Duration('half').toSeconds(60)).toBe(2);
    });

    test('croche à 60 BPM = 0.5 seconde', () => {
      expect(new Duration('eighth').toSeconds(60)).toBe(0.5);
    });
  });

  describe('toVexFlow()', () => {
    test('noire = "q"', () => {
      expect(new Duration('quarter').toVexFlow()).toBe('q');
    });

    test('blanche = "h"', () => {
      expect(new Duration('half').toVexFlow()).toBe('h');
    });

    test('ronde = "w"', () => {
      expect(new Duration('whole').toVexFlow()).toBe('w');
    });

    test('croche = "8"', () => {
      expect(new Duration('eighth').toVexFlow()).toBe('8');
    });

    test('noire pointée = "qd"', () => {
      expect(new Duration('quarter', 1).toVexFlow()).toBe('qd');
    });

    test('noire double-pointée = "qdd"', () => {
      expect(new Duration('quarter', 2).toVexFlow()).toBe('qdd');
    });
  });

  describe('toFrench()', () => {
    test('noire = "Noire"', () => {
      expect(new Duration('quarter').toFrench()).toBe('Noire');
    });

    test('noire pointée = "Noire pointée"', () => {
      expect(new Duration('quarter', 1).toFrench()).toBe('Noire pointée');
    });

    test('noire double-pointée = "Noire double-pointée"', () => {
      expect(new Duration('quarter', 2).toFrench()).toBe('Noire double-pointée');
    });

    test('triolet de croches = "Croche (triolet)"', () => {
      const triplet = new Duration('eighth', 0, { ratio: [3, 2] });
      expect(triplet.toFrench()).toBe('Croche (triolet)');
    });

    test('quintolet de croches = "Croche (quintolet)"', () => {
      const quintuplet = new Duration('eighth', 0, { ratio: [5, 4] });
      expect(quintuplet.toFrench()).toBe('Croche (quintolet)');
    });
  });

  describe('equals()', () => {
    test('deux durées identiques sont égales', () => {
      const d1 = new Duration('quarter');
      const d2 = new Duration('quarter');
      expect(d1.equals(d2)).toBe(true);
    });

    test('durées différentes ne sont pas égales', () => {
      const d1 = new Duration('quarter');
      const d2 = new Duration('half');
      expect(d1.equals(d2)).toBe(false);
    });

    test('même base avec points différents ne sont pas égales', () => {
      const d1 = new Duration('quarter');
      const d2 = new Duration('quarter', 1);
      expect(d1.equals(d2)).toBe(false);
    });
  });

  describe('compareTo()', () => {
    test('durée plus courte retourne -1', () => {
      const quarter = new Duration('quarter');
      const half = new Duration('half');
      expect(quarter.compareTo(half)).toBe(-1);
    });

    test('durée plus longue retourne 1', () => {
      const half = new Duration('half');
      const quarter = new Duration('quarter');
      expect(half.compareTo(quarter)).toBe(1);
    });

    test('durées égales retournent 0', () => {
      const d1 = new Duration('quarter');
      const d2 = new Duration('quarter');
      expect(d1.compareTo(d2)).toBe(0);
    });
  });

  describe('Factory methods', () => {
    test('whole() crée une ronde', () => {
      const duration = Duration.whole();
      expect(duration.base).toBe('whole');
    });

    test('half() crée une blanche', () => {
      const duration = Duration.half();
      expect(duration.base).toBe('half');
    });

    test('quarter() crée une noire', () => {
      const duration = Duration.quarter();
      expect(duration.base).toBe('quarter');
    });

    test('eighth() crée une croche', () => {
      const duration = Duration.eighth();
      expect(duration.base).toBe('eighth');
    });

    test('sixteenth() crée une double croche', () => {
      const duration = Duration.sixteenth();
      expect(duration.base).toBe('sixteenth');
    });

    test('triplet() crée un triolet', () => {
      const duration = Duration.triplet('eighth');
      expect(duration.base).toBe('eighth');
      expect(duration.tuplet).toEqual({ ratio: [3, 2] });
    });

    test('factory methods supportent les points', () => {
      expect(Duration.quarter(1).dots).toBe(1);
      expect(Duration.half(2).dots).toBe(2);
    });
  });

  describe('Propriétés statiques', () => {
    test('types retourne les types disponibles', () => {
      const types = Duration.types;
      expect(types).toContain('whole');
      expect(types).toContain('quarter');
      expect(types).toContain('eighth');
    });
  });

  describe('isDotted()', () => {
    test('retourne false pour durée sans point', () => {
      expect(new Duration('quarter').isDotted()).toBe(false);
    });

    test('retourne true pour durée pointée', () => {
      expect(new Duration('quarter', 1).isDotted()).toBe(true);
    });
  });

  describe('isTuplet()', () => {
    test('retourne false pour durée normale', () => {
      expect(new Duration('quarter').isTuplet()).toBe(false);
    });

    test('retourne true pour triolet', () => {
      expect(Duration.triplet('eighth').isTuplet()).toBe(true);
    });
  });
});
