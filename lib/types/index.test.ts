/**
 * Tests pour lib/types/index.ts
 *
 * Ces tests valident l'intégration TypeScript avec Jest.
 */

import type { PlayerId, Seed } from './index.js';

describe('Types TypeScript', () => {
  describe('PlayerId', () => {
    it('accepte une chaîne comme identifiant de joueur', () => {
      const playerId: PlayerId = 'player-1';
      expect(typeof playerId).toBe('string');
    });
  });

  describe('Seed', () => {
    it('accepte un nombre comme seed', () => {
      const seed: Seed = 12345;
      expect(typeof seed).toBe('number');
    });
  });

  describe('Validation de la configuration Jest/TypeScript', () => {
    it('peut utiliser les types TypeScript dans les tests', () => {
      // Ce test valide que esbuild-jest transpile correctement le TypeScript
      const testValue: string = 'TypeScript fonctionne !';
      expect(testValue).toBe('TypeScript fonctionne !');
    });

    it('supporte les fonctions fléchées typées', () => {
      const add = (a: number, b: number): number => a + b;
      expect(add(2, 3)).toBe(5);
    });

    it('supporte les interfaces', () => {
      interface Player {
        id: PlayerId;
        name: string;
        score: number;
      }

      const player: Player = {
        id: 'p1',
        name: 'Alice',
        score: 100,
      };

      expect(player.id).toBe('p1');
      expect(player.name).toBe('Alice');
      expect(player.score).toBe(100);
    });
  });
});
