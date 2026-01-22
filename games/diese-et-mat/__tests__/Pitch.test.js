/**
 * Tests unitaires pour Pitch
 *
 * @module __tests__/Pitch.test
 */

import { Pitch } from '../src/core/Pitch.js';

describe('Pitch', () => {
  describe('Constructeur', () => {
    test('crée une note valide', () => {
      const pitch = new Pitch(0, 4);
      expect(pitch.pitchClass).toBe(0);
      expect(pitch.octave).toBe(4);
      expect(pitch.accidental).toBeNull();
    });

    test('crée une note avec dièse', () => {
      const pitch = new Pitch(0, 4, 'sharp');
      expect(pitch.accidental).toBe('sharp');
    });

    test('rejette un pitchClass invalide', () => {
      expect(() => new Pitch(-1, 4)).toThrow('PitchClass invalide');
      expect(() => new Pitch(7, 4)).toThrow('PitchClass invalide');
    });

    test('rejette une octave invalide', () => {
      expect(() => new Pitch(0, -1)).toThrow('Octave invalide');
      expect(() => new Pitch(0, 10)).toThrow('Octave invalide');
    });

    test('rejette une altération invalide', () => {
      expect(() => new Pitch(0, 4, 'invalid')).toThrow('Altération invalide');
    });
  });

  describe('toMidi()', () => {
    test('Do4 = MIDI 60', () => {
      expect(new Pitch(0, 4).toMidi()).toBe(60);
    });

    test('La4 = MIDI 69', () => {
      expect(new Pitch(5, 4).toMidi()).toBe(69);
    });

    test('Do0 = MIDI 12', () => {
      expect(new Pitch(0, 0).toMidi()).toBe(12);
    });

    test('Do#4 = MIDI 61', () => {
      expect(new Pitch(0, 4, 'sharp').toMidi()).toBe(61);
    });

    test('Réb4 = MIDI 61', () => {
      expect(new Pitch(1, 4, 'flat').toMidi()).toBe(61);
    });

    test('Do##4 = MIDI 62', () => {
      expect(new Pitch(0, 4, 'double-sharp').toMidi()).toBe(62);
    });

    test('Rébb4 = MIDI 60', () => {
      expect(new Pitch(1, 4, 'double-flat').toMidi()).toBe(60);
    });
  });

  describe('toFrequency()', () => {
    test('La4 = 440 Hz', () => {
      expect(new Pitch(5, 4).toFrequency()).toBe(440);
    });

    test('La5 = 880 Hz (une octave au-dessus)', () => {
      expect(new Pitch(5, 5).toFrequency()).toBe(880);
    });

    test('La3 = 220 Hz (une octave en-dessous)', () => {
      expect(new Pitch(5, 3).toFrequency()).toBe(220);
    });

    test('Do4 ≈ 261.63 Hz', () => {
      const freq = new Pitch(0, 4).toFrequency();
      expect(freq).toBeCloseTo(261.63, 1);
    });
  });

  describe('toFrench()', () => {
    test('Do4 sans altération', () => {
      expect(new Pitch(0, 4).toFrench()).toBe('Do4');
    });

    test('Sol#5 avec dièse', () => {
      expect(new Pitch(4, 5, 'sharp').toFrench()).toBe('Sol♯5');
    });

    test('Sib3 avec bémol', () => {
      expect(new Pitch(6, 3, 'flat').toFrench()).toBe('Si♭3');
    });

    test('Ré4 sans altération', () => {
      expect(new Pitch(1, 4).toFrench()).toBe('Ré4');
    });
  });

  describe('toEnglish()', () => {
    test('C4 sans altération', () => {
      expect(new Pitch(0, 4).toEnglish()).toBe('C4');
    });

    test('G#5 avec dièse', () => {
      expect(new Pitch(4, 5, 'sharp').toEnglish()).toBe('G#5');
    });

    test('Bb3 avec bémol', () => {
      expect(new Pitch(6, 3, 'flat').toEnglish()).toBe('Bb3');
    });
  });

  describe('toVexFlow()', () => {
    test('c/4 sans altération', () => {
      expect(new Pitch(0, 4).toVexFlow()).toBe('c/4');
    });

    test('g#/5 avec dièse', () => {
      expect(new Pitch(4, 5, 'sharp').toVexFlow()).toBe('g#/5');
    });

    test('b/3 avec bémol', () => {
      expect(new Pitch(6, 3, 'flat').toVexFlow()).toBe('bb/3');
    });
  });

  describe('toTone()', () => {
    test('retourne le format anglais', () => {
      expect(new Pitch(0, 4).toTone()).toBe('C4');
      expect(new Pitch(4, 5, 'sharp').toTone()).toBe('G#5');
    });
  });

  describe('getStaffPosition()', () => {
    describe('clé de sol', () => {
      test('Si4 est sur la ligne du milieu', () => {
        expect(new Pitch(6, 4).getStaffPosition('treble')).toBe(0);
      });

      test('Do5 est un cran au-dessus de Si4', () => {
        expect(new Pitch(0, 5).getStaffPosition('treble')).toBe(1);
      });

      test('La4 est un cran en-dessous de Si4', () => {
        expect(new Pitch(5, 4).getStaffPosition('treble')).toBe(-1);
      });
    });

    describe('clé de fa', () => {
      test('Ré3 est sur la ligne du milieu', () => {
        expect(new Pitch(1, 3).getStaffPosition('bass')).toBe(0);
      });

      test('Mi3 est un cran au-dessus de Ré3', () => {
        expect(new Pitch(2, 3).getStaffPosition('bass')).toBe(1);
      });
    });
  });

  describe('equals()', () => {
    test('deux notes identiques sont égales', () => {
      const p1 = new Pitch(0, 4);
      const p2 = new Pitch(0, 4);
      expect(p1.equals(p2)).toBe(true);
    });

    test('notes différentes ne sont pas égales', () => {
      const p1 = new Pitch(0, 4);
      const p2 = new Pitch(1, 4);
      expect(p1.equals(p2)).toBe(false);
    });

    test('même note avec altérations différentes ne sont pas égales', () => {
      const p1 = new Pitch(0, 4);
      const p2 = new Pitch(0, 4, 'sharp');
      expect(p1.equals(p2)).toBe(false);
    });
  });

  describe('isEnharmonicWith()', () => {
    test('Do# et Réb sont enharmoniques', () => {
      const cSharp = new Pitch(0, 4, 'sharp');
      const dFlat = new Pitch(1, 4, 'flat');
      expect(cSharp.isEnharmonicWith(dFlat)).toBe(true);
    });

    test('Do et Ré ne sont pas enharmoniques', () => {
      const c = new Pitch(0, 4);
      const d = new Pitch(1, 4);
      expect(c.isEnharmonicWith(d)).toBe(false);
    });
  });

  describe('compareTo()', () => {
    test('note plus basse retourne -1', () => {
      const c4 = new Pitch(0, 4);
      const d4 = new Pitch(1, 4);
      expect(c4.compareTo(d4)).toBe(-1);
    });

    test('note plus haute retourne 1', () => {
      const d4 = new Pitch(1, 4);
      const c4 = new Pitch(0, 4);
      expect(d4.compareTo(c4)).toBe(1);
    });

    test('notes égales retournent 0', () => {
      const c4a = new Pitch(0, 4);
      const c4b = new Pitch(0, 4);
      expect(c4a.compareTo(c4b)).toBe(0);
    });
  });

  describe('transpose()', () => {
    test('transposition d\'un demi-ton vers le haut', () => {
      const c4 = new Pitch(0, 4);
      const result = c4.transpose(1);
      expect(result.toMidi()).toBe(61);
    });

    test('transposition d\'une octave vers le haut', () => {
      const c4 = new Pitch(0, 4);
      const result = c4.transpose(12);
      expect(result.toMidi()).toBe(72);
    });

    test('transposition vers le bas', () => {
      const c4 = new Pitch(0, 4);
      const result = c4.transpose(-2);
      expect(result.toMidi()).toBe(58);
    });
  });

  describe('Pitch.fromMidi()', () => {
    test('MIDI 60 = Do4', () => {
      const pitch = Pitch.fromMidi(60);
      expect(pitch.pitchClass).toBe(0);
      expect(pitch.octave).toBe(4);
      expect(pitch.accidental).toBeNull();
    });

    test('MIDI 69 = La4', () => {
      const pitch = Pitch.fromMidi(69);
      expect(pitch.pitchClass).toBe(5);
      expect(pitch.octave).toBe(4);
    });

    test('MIDI 61 = Do#4', () => {
      const pitch = Pitch.fromMidi(61);
      expect(pitch.pitchClass).toBe(0);
      expect(pitch.accidental).toBe('sharp');
    });

    test('rejette MIDI invalide', () => {
      expect(() => Pitch.fromMidi(-1)).toThrow('MIDI invalide');
      expect(() => Pitch.fromMidi(128)).toThrow('MIDI invalide');
    });
  });

  describe('Pitch.fromString()', () => {
    describe('notation française', () => {
      test('parse Do4', () => {
        const pitch = Pitch.fromString('Do4');
        expect(pitch.pitchClass).toBe(0);
        expect(pitch.octave).toBe(4);
      });

      test('parse Sol#5', () => {
        const pitch = Pitch.fromString('Sol#5');
        expect(pitch.pitchClass).toBe(4);
        expect(pitch.octave).toBe(5);
        expect(pitch.accidental).toBe('sharp');
      });

      test('parse Sib3', () => {
        const pitch = Pitch.fromString('Sib3');
        expect(pitch.pitchClass).toBe(6);
        expect(pitch.accidental).toBe('flat');
      });

      test('parse Ré4 avec accent', () => {
        const pitch = Pitch.fromString('Ré4');
        expect(pitch.pitchClass).toBe(1);
      });

      test('parse Re4 sans accent', () => {
        const pitch = Pitch.fromString('Re4');
        expect(pitch.pitchClass).toBe(1);
      });
    });

    describe('notation anglaise', () => {
      test('parse C4', () => {
        const pitch = Pitch.fromString('C4');
        expect(pitch.pitchClass).toBe(0);
        expect(pitch.octave).toBe(4);
      });

      test('parse F#5', () => {
        const pitch = Pitch.fromString('F#5');
        expect(pitch.pitchClass).toBe(3);
        expect(pitch.accidental).toBe('sharp');
      });

      test('parse Bb3', () => {
        const pitch = Pitch.fromString('Bb3');
        expect(pitch.pitchClass).toBe(6);
        expect(pitch.accidental).toBe('flat');
      });

      test('parse C##4 (double dièse)', () => {
        const pitch = Pitch.fromString('C##4');
        expect(pitch.accidental).toBe('double-sharp');
      });

      test('parse Dbb4 (double bémol)', () => {
        const pitch = Pitch.fromString('Dbb4');
        expect(pitch.accidental).toBe('double-flat');
      });
    });

    test('rejette format invalide', () => {
      expect(() => Pitch.fromString('invalid')).toThrow('Format de note invalide');
      expect(() => Pitch.fromString('X4')).toThrow('Format de note invalide');
    });
  });

  describe('Pitch.random()', () => {
    test('génère une note dans la plage', () => {
      const low = new Pitch(0, 4);  // Do4
      const high = new Pitch(0, 5); // Do5
      const pitch = Pitch.random(low, high);

      expect(pitch.toMidi()).toBeGreaterThanOrEqual(60);
      expect(pitch.toMidi()).toBeLessThanOrEqual(72);
    });

    test('génère uniquement des notes naturelles avec naturalOnly', () => {
      const low = new Pitch(0, 4);
      const high = new Pitch(0, 5);

      // Générer plusieurs notes et vérifier qu'elles sont toutes naturelles
      for (let i = 0; i < 20; i++) {
        const pitch = Pitch.random(low, high, true);
        expect(pitch.isNatural()).toBe(true);
      }
    });

    test('utilise la fonction random fournie', () => {
      const low = new Pitch(0, 4);
      const high = new Pitch(0, 5);
      let called = false;
      const mockRandom = () => {
        called = true;
        return 0.5;
      };

      Pitch.random(low, high, false, mockRandom);
      expect(called).toBe(true);
    });
  });

  describe('Propriétés statiques', () => {
    test('frenchNames retourne les 7 noms', () => {
      const names = Pitch.frenchNames;
      expect(names).toEqual(['Do', 'Ré', 'Mi', 'Fa', 'Sol', 'La', 'Si']);
    });

    test('englishNames retourne les 7 noms', () => {
      const names = Pitch.englishNames;
      expect(names).toEqual(['C', 'D', 'E', 'F', 'G', 'A', 'B']);
    });
  });

  describe('isNatural()', () => {
    test('note sans altération est naturelle', () => {
      expect(new Pitch(0, 4).isNatural()).toBe(true);
    });

    test('note avec dièse n\'est pas naturelle', () => {
      expect(new Pitch(0, 4, 'sharp').isNatural()).toBe(false);
    });

    test('note avec altération "natural" est naturelle', () => {
      expect(new Pitch(0, 4, 'natural').isNatural()).toBe(true);
    });
  });

  describe('toNatural()', () => {
    test('retourne la note sans altération', () => {
      const sharp = new Pitch(0, 4, 'sharp');
      const natural = sharp.toNatural();
      expect(natural.accidental).toBeNull();
      expect(natural.pitchClass).toBe(0);
      expect(natural.octave).toBe(4);
    });
  });
});
