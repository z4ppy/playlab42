/**
 * Tests unitaires pour Scale
 *
 * @module __tests__/Scale.test
 */

import { Scale } from '../src/core/Scale.js';
import { Pitch } from '../src/core/Pitch.js';

describe('Scale', () => {
  describe('Constructeur', () => {
    test('crée une gamme valide', () => {
      const root = new Pitch(0, 4);
      const scale = new Scale(root, 'major');
      expect(scale.root).toBe(root);
      expect(scale.type).toBe('major');
    });

    test('rejette un type de gamme invalide', () => {
      const root = new Pitch(0, 4);
      expect(() => new Scale(root, 'invalid')).toThrow('Type de gamme invalide');
    });
  });

  describe('Propriétés', () => {
    test('size retourne le nombre de notes', () => {
      const root = new Pitch(0, 4);
      expect(new Scale(root, 'major').size).toBe(7);
      expect(new Scale(root, 'pentatonic-major').size).toBe(5);
      expect(new Scale(root, 'chromatic').size).toBe(12);
    });

    test('intervals retourne les intervalles', () => {
      const scale = new Scale(new Pitch(0, 4), 'major');
      expect(scale.intervals).toEqual([0, 2, 4, 5, 7, 9, 11]);
    });
  });

  describe('getPitches()', () => {
    test('Do majeur = Do Ré Mi Fa Sol La Si', () => {
      const scale = new Scale(new Pitch(0, 4), 'major');
      const pitches = scale.getPitches();

      expect(pitches.length).toBe(7);
      expect(pitches[0].toFrench()).toBe('Do4');
      expect(pitches[1].toFrench()).toBe('Ré4');
      expect(pitches[2].toFrench()).toBe('Mi4');
      expect(pitches[3].toFrench()).toBe('Fa4');
      expect(pitches[4].toFrench()).toBe('Sol4');
      expect(pitches[5].toFrench()).toBe('La4');
      expect(pitches[6].toFrench()).toBe('Si4');
    });

    test('La mineur = La Si Do Ré Mi Fa Sol', () => {
      const scale = new Scale(new Pitch(5, 4), 'minor');
      const pitches = scale.getPitches();

      expect(pitches[0].toMidi()).toBe(69); // La4
      expect(pitches[2].toMidi()).toBe(72); // Do5
    });

    test('retourne plusieurs octaves si demandé', () => {
      const scale = new Scale(new Pitch(0, 4), 'major');
      const pitches = scale.getPitches(2);

      expect(pitches.length).toBe(14);
      expect(pitches[7].toFrench()).toBe('Do5');
    });
  });

  describe('getDegree()', () => {
    test('1er degré = tonique', () => {
      const scale = new Scale(new Pitch(0, 4), 'major');
      expect(scale.getDegree(1).toEnglish()).toBe('C4');
    });

    test('3e degré = médiante', () => {
      const scale = new Scale(new Pitch(0, 4), 'major');
      expect(scale.getDegree(3).toEnglish()).toBe('E4');
    });

    test('5e degré = dominante', () => {
      const scale = new Scale(new Pitch(0, 4), 'major');
      expect(scale.getDegree(5).toEnglish()).toBe('G4');
    });

    test('supporte le décalage d\'octave', () => {
      const scale = new Scale(new Pitch(0, 4), 'major');
      expect(scale.getDegree(1, 1).toEnglish()).toBe('C5');
    });

    test('rejette un degré invalide', () => {
      const scale = new Scale(new Pitch(0, 4), 'major');
      expect(() => scale.getDegree(0)).toThrow('Degré invalide');
      expect(() => scale.getDegree(8)).toThrow('Degré invalide');
    });
  });

  describe('getDegreeName()', () => {
    test('retourne le nom du degré', () => {
      const scale = new Scale(new Pitch(0, 4), 'major');
      expect(scale.getDegreeName(1)).toBe('tonique');
      expect(scale.getDegreeName(5)).toBe('dominante');
      expect(scale.getDegreeName(7)).toBe('sensible');
    });
  });

  describe('contains()', () => {
    test('les notes de la gamme sont contenues', () => {
      const scale = new Scale(new Pitch(0, 4), 'major');

      expect(scale.contains(new Pitch(0, 4))).toBe(true); // Do
      expect(scale.contains(new Pitch(2, 4))).toBe(true); // Mi
      expect(scale.contains(new Pitch(4, 4))).toBe(true); // Sol
    });

    test('les notes hors gamme ne sont pas contenues', () => {
      const scale = new Scale(new Pitch(0, 4), 'major');

      // Do# n'est pas dans Do majeur
      expect(scale.contains(new Pitch(0, 4, 'sharp'))).toBe(false);
    });

    test('fonctionne dans différentes octaves', () => {
      const scale = new Scale(new Pitch(0, 4), 'major');
      expect(scale.contains(new Pitch(0, 5))).toBe(true); // Do5
      expect(scale.contains(new Pitch(2, 3))).toBe(true); // Mi3
    });
  });

  describe('getDegreeOf()', () => {
    test('retourne le degré d\'une note de la gamme', () => {
      const scale = new Scale(new Pitch(0, 4), 'major');

      expect(scale.getDegreeOf(new Pitch(0, 4))).toBe(1); // Do = 1
      expect(scale.getDegreeOf(new Pitch(2, 4))).toBe(3); // Mi = 3
      expect(scale.getDegreeOf(new Pitch(4, 4))).toBe(5); // Sol = 5
    });

    test('retourne null pour une note hors gamme', () => {
      const scale = new Scale(new Pitch(0, 4), 'major');
      expect(scale.getDegreeOf(new Pitch(0, 4, 'sharp'))).toBeNull();
    });
  });

  describe('toFrench()', () => {
    test('Do majeure', () => {
      const scale = new Scale(new Pitch(0, 4), 'major');
      expect(scale.toFrench()).toBe('Do majeure');
    });

    test('La mineure naturelle', () => {
      const scale = new Scale(new Pitch(5, 4), 'minor');
      expect(scale.toFrench()).toBe('La mineure naturelle');
    });

    test('Ré mineure harmonique', () => {
      const scale = new Scale(new Pitch(1, 4), 'harmonic-minor');
      expect(scale.toFrench()).toBe('Ré mineure harmonique');
    });
  });

  describe('toEnglish()', () => {
    test('C major', () => {
      const scale = new Scale(new Pitch(0, 4), 'major');
      expect(scale.toEnglish()).toBe('C major');
    });

    test('A harmonic minor', () => {
      const scale = new Scale(new Pitch(5, 4), 'harmonic-minor');
      expect(scale.toEnglish()).toBe('A harmonic minor');
    });
  });

  describe('transpose()', () => {
    test('transpose la gamme', () => {
      const scale = new Scale(new Pitch(0, 4), 'major');
      const transposed = scale.transpose(2);

      expect(transposed.root.toEnglish()).toBe('D4');
      expect(transposed.type).toBe('major');
    });
  });

  describe('getRelative()', () => {
    test('relative mineure de Do majeur = La mineur', () => {
      const cMajor = new Scale(new Pitch(0, 4), 'major');
      const relative = cMajor.getRelative();

      expect(relative.root.pitchClass).toBe(5); // La
      expect(relative.type).toBe('minor');
    });

    test('relative majeure de La mineur = Do majeur', () => {
      const aMinor = new Scale(new Pitch(5, 4), 'minor');
      const relative = aMinor.getRelative();

      expect(relative.root.pitchClass).toBe(0); // Do
      expect(relative.type).toBe('major');
    });

    test('rejette pour autres types', () => {
      const blues = new Scale(new Pitch(0, 4), 'blues');
      expect(() => blues.getRelative()).toThrow();
    });
  });

  describe('getParallel()', () => {
    test('parallèle de Do majeur = Do mineur', () => {
      const cMajor = new Scale(new Pitch(0, 4), 'major');
      const parallel = cMajor.getParallel();

      expect(parallel.root.pitchClass).toBe(0); // Do
      expect(parallel.type).toBe('minor');
    });

    test('parallèle de La mineur = La majeur', () => {
      const aMinor = new Scale(new Pitch(5, 4), 'minor');
      const parallel = aMinor.getParallel();

      expect(parallel.root.pitchClass).toBe(5); // La
      expect(parallel.type).toBe('major');
    });
  });

  describe('equals()', () => {
    test('deux gammes identiques sont égales', () => {
      const s1 = new Scale(new Pitch(0, 4), 'major');
      const s2 = new Scale(new Pitch(0, 4), 'major');
      expect(s1.equals(s2)).toBe(true);
    });

    test('gammes différentes ne sont pas égales', () => {
      const s1 = new Scale(new Pitch(0, 4), 'major');
      const s2 = new Scale(new Pitch(0, 4), 'minor');
      expect(s1.equals(s2)).toBe(false);
    });
  });

  describe('Factory methods', () => {
    test('Scale.major() crée une gamme majeure', () => {
      const scale = Scale.major(new Pitch(0, 4));
      expect(scale.type).toBe('major');
    });

    test('Scale.minor() crée une gamme mineure', () => {
      const scale = Scale.minor('A4');
      expect(scale.type).toBe('minor');
    });

    test('Scale.harmonicMinor() crée une gamme mineure harmonique', () => {
      const scale = Scale.harmonicMinor('A4');
      expect(scale.type).toBe('harmonic-minor');
    });

    test('Scale.pentatonicMajor() crée une pentatonique', () => {
      const scale = Scale.pentatonicMajor('C4');
      expect(scale.size).toBe(5);
    });

    test('Scale.blues() crée une gamme blues', () => {
      const scale = Scale.blues('A4');
      expect(scale.type).toBe('blues');
    });
  });

  describe('Propriétés statiques', () => {
    test('types retourne tous les types', () => {
      const types = Scale.types;
      expect(types).toContain('major');
      expect(types).toContain('minor');
      expect(types).toContain('blues');
    });

    test('modes retourne les modes', () => {
      const modes = Scale.modes;
      expect(modes).toContain('dorian');
      expect(modes).toContain('lydian');
      expect(modes.length).toBe(7);
    });
  });
});
