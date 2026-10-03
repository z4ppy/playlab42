/**
 * Caractérisation de Simulation.update avant extraction des forces.
 *
 * Les valeurs attendues viennent de calculs à la main ou du golden
 * `fixtures/seeded-golden.json`, produit par l'implémentation d'origine.
 *
 * @module tools/particle-life/__tests__/Simulation.characterization
 */

import { readFileSync } from 'node:fs';
import { Simulation } from '../src/Simulation';
import type { SimulationConfig } from '../src/types';
import { runSeeded } from './seeded-run';
import type { SeededSnapshot } from './seeded-run';

interface Seed {
  x: number;
  y: number;
  group?: number;
  vx?: number;
  vy?: number;
}

const BASE: Partial<SimulationConfig> = {
  groupCount: 2,
  width: 200,
  height: 100,
  interactionRadius: 50,
  friction: 0,
  forceStrength: 1,
};

function createWorld(
  seeds: Seed[],
  config: Partial<SimulationConfig> = {},
  attractions: number[][] = [
    [1, 1],
    [1, 1],
  ],
): Simulation {
  const sim = new Simulation({ ...BASE, ...config, particleCount: seeds.length });
  sim.getParticles().forEach((p, i) => {
    const seed = seeds[i];
    p.x = seed.x;
    p.y = seed.y;
    p.group = seed.group ?? 0;
    p.vx = seed.vx ?? 0;
    p.vy = seed.vy ?? 0;
  });
  attractions.forEach((row, from) => {
    row.forEach((value, to) => {
      sim.setAttraction(from, to, value);
    });
  });
  return sim;
}

describe('Simulation.update : caractérisation', () => {
  describe('force selon la distance et le rayon', () => {
    it('attire à mi-distance (distance 30, rayon 50 → 0,45)', () => {
      const sim = createWorld([{ x: 10, y: 10 }, { x: 40, y: 10 }]);
      sim.update();
      const [a, b] = sim.getParticles();
      expect(a.vx).toBeCloseTo(0.45, 12);
      expect(b.vx).toBeCloseTo(-0.45, 12);
      expect(a.vy).toBe(0);
      expect(a.x).toBeCloseTo(10.45, 12);
      expect(b.x).toBeCloseTo(39.55, 12);
    });

    it('repousse à courte distance (distance 6 → -0,6)', () => {
      const sim = createWorld([{ x: 10, y: 10 }, { x: 16, y: 10 }]);
      sim.update();
      const [a, b] = sim.getParticles();
      expect(a.vx).toBeCloseTo(-0.6, 12);
      expect(b.vx).toBeCloseTo(0.6, 12);
    });

    it('projette la force sur les deux axes avec le vecteur unitaire', () => {
      const sim = createWorld([{ x: 10, y: 10 }, { x: 34, y: 42 }]);
      sim.update();
      const [a] = sim.getParticles();
      // distance 40, normalisée 0,8 → force (1 - |1,6 - 1,3|) * 0,5 = 0,35
      expect(a.vx).toBeCloseTo((24 / 40) * 0.35, 12);
      expect(a.vy).toBeCloseTo((32 / 40) * 0.35, 12);
    });

    it('ignore une paire plus proche que 1 mais pas à distance 1', () => {
      const close = createWorld([{ x: 10, y: 10 }, { x: 10.5, y: 10 }]);
      close.update();
      expect(close.getParticles()[0].vx).toBe(0);

      const limit = createWorld([{ x: 10, y: 10 }, { x: 11, y: 10 }]);
      limit.update();
      // normalisée 1/50 = 0,02 → 0,02 / 0,3 - 1
      expect(limit.getParticles()[0].vx).toBeCloseTo(0.02 / 0.3 - 1, 12);
    });

    it('inclut une paire exactement au rayon et exclut au-delà', () => {
      const edge = createWorld([{ x: 10, y: 10 }, { x: 60, y: 10 }]);
      edge.update();
      // normalisée 1 → (1 - |2 - 1,3|) * 0,5 = 0,15
      expect(edge.getParticles()[0].vx).toBeCloseTo(0.15, 12);

      const beyond = createWorld([{ x: 10, y: 10 }, { x: 60.0001, y: 10 }]);
      beyond.update();
      expect(beyond.getParticles()[0].vx).toBe(0);
    });

    it('change de branche de forceFunction à 0,3 (distance 15)', () => {
      const sim = createWorld([{ x: 10, y: 10 }, { x: 25, y: 10 }]);
      sim.update();
      // 0,3 appartient à la branche « normale » : (1 - |0,6 - 1,3|) * 0,5 = 0,15
      expect(sim.getParticles()[0].vx).toBeCloseTo(0.15, 12);
    });

    it('applique forceStrength et la matrice dirigée groupe → groupe', () => {
      const sim = createWorld(
        [{ x: 10, y: 10, group: 0 }, { x: 40, y: 10, group: 1 }],
        { forceStrength: 2 },
        [
          [0, 0.5],
          [-1, 0],
        ],
      );
      sim.update();
      const [a, b] = sim.getParticles();
      expect(a.vx).toBeCloseTo(0.45 * 0.5 * 2, 12);
      // b est repoussée de a : sa vitesse va vers +x
      expect(b.vx).toBeCloseTo(0.45 * 1 * 2, 12);
    });

    it('additionne les forces de tous les voisins', () => {
      const sim = createWorld([
        { x: 50, y: 50 },
        { x: 80, y: 50 },
        { x: 50, y: 20 },
      ]);
      sim.update();
      const [a] = sim.getParticles();
      expect(a.vx).toBeCloseTo(0.45, 12);
      expect(a.vy).toBeCloseTo(-0.45, 12);
    });
  });

  describe('monde torique : image la plus proche', () => {
    it('voit le voisin à travers le bord horizontal', () => {
      const sim = createWorld([{ x: 5, y: 10 }, { x: 195, y: 10 }]);
      sim.update();
      const [a, b] = sim.getParticles();
      // image à -5 : distance 10, force -1/3, donc répulsion vers +x
      expect(a.vx).toBeCloseTo(1 / 3, 12);
      expect(b.vx).toBeCloseTo(-1 / 3, 12);
      expect(a.x).toBeCloseTo(5 + 1 / 3, 12);
      expect(b.x).toBeCloseTo(195 - 1 / 3, 12);
    });

    it('voit le voisin à travers le bord vertical', () => {
      const sim = createWorld([{ x: 10, y: 3 }, { x: 10, y: 97 }]);
      sim.update();
      const [a, b] = sim.getParticles();
      // distance 6 à travers le bord : répulsion -0,6
      expect(a.vy).toBeCloseTo(0.6, 12);
      expect(b.vy).toBeCloseTo(-0.6, 12);
    });

    it('ne replie pas un écart exactement égal à la demi-largeur', () => {
      const sim = createWorld([{ x: 0, y: 10 }, { x: 100, y: 10 }], { interactionRadius: 150 });
      sim.update();
      // dx = 100 reste positif ; normalisée 2/3 → (1 - |4/3 - 1,3|) * 0,5
      expect(sim.getParticles()[0].vx).toBeCloseTo((1 - Math.abs((2 * 100) / 150 - 1.3)) * 0.5, 12);
      expect(sim.getParticles()[0].vx).toBeGreaterThan(0);
    });

    it('replie un écart juste supérieur à la demi-largeur', () => {
      const sim = createWorld([{ x: 0, y: 10 }, { x: 101, y: 10 }], { interactionRadius: 150 });
      sim.update();
      // dx = 101 - 200 = -99 : le voisin est vu à gauche
      expect(sim.getParticles()[0].vx).toBeLessThan(0);
    });

    it('replie les deux axes simultanément', () => {
      const sim = createWorld([{ x: 3, y: 4 }, { x: 197, y: 96 }]);
      sim.update();
      const [a] = sim.getParticles();
      // écart replié (-6, -8) : distance 10, force -1/3 ; vecteur unitaire (-0,6 ; -0,8)
      expect(a.vx).toBeCloseTo(0.6 / 3, 12);
      expect(a.vy).toBeCloseTo(0.8 / 3, 12);
    });
  });

  describe('positions : repliement unique, pas de rebond ni de clamp', () => {
    const solo = (x: number, y: number, vx: number, vy: number, friction = 0) =>
      createWorld([{ x, y, vx, vy }], { friction });

    it('replie une sortie par la droite et le bas', () => {
      const sim = solo(199, 99, 2, 3);
      sim.update();
      const [p] = sim.getParticles();
      expect(p.x).toBe(1);
      expect(p.y).toBe(2);
    });

    it('replie une sortie par la gauche et le haut', () => {
      const sim = solo(1, 2, -3, -5);
      sim.update();
      const [p] = sim.getParticles();
      expect(p.x).toBe(198);
      expect(p.y).toBe(97);
    });

    it('place exactement sur la limite haute à 0 et garde 0 intact', () => {
      const high = solo(199, 99, 1, 1);
      high.update();
      expect([high.getParticles()[0].x, high.getParticles()[0].y]).toEqual([0, 0]);

      const zero = solo(1, 1, -1, -1);
      zero.update();
      expect([zero.getParticles()[0].x, zero.getParticles()[0].y]).toEqual([0, 0]);
    });

    it('conserve la vitesse au repliement (aucun rebond)', () => {
      const sim = solo(199, 50, 5, 0);
      sim.update();
      expect(sim.getParticles()[0].vx).toBe(5);
    });

    it('ne replie qu\'une fois : un déplacement supérieur au monde reste hors limites', () => {
      const sim = solo(10, 10, 450, -250);
      sim.update();
      const [p] = sim.getParticles();
      expect(p.x).toBe(260);
      expect(p.y).toBe(-240 + 100);
    });
  });

  describe('friction', () => {
    it('multiplie la vitesse par (1 - friction) après ajout de la force', () => {
      const sim = createWorld([{ x: 10, y: 10 }, { x: 40, y: 10, vx: 1 }], { friction: 0.5 });
      sim.update();
      const [a, b] = sim.getParticles();
      expect(a.vx).toBeCloseTo(0.45 * 0.5, 12);
      expect(b.vx).toBeCloseTo((1 - 0.45) * 0.5, 12);
    });

    it('s\'applique seule à une particule isolée, pas de pas de temps variable', () => {
      const sim = createWorld([{ x: 50, y: 50, vx: 4, vy: -8 }], { friction: 0.25 });
      sim.update();
      const [p] = sim.getParticles();
      expect(p.vx).toBe(3);
      expect(p.vy).toBe(-6);
      expect(p.x).toBe(53);
      expect(p.y).toBe(44);
    });

    it('friction 1 annule la vitesse', () => {
      const sim = createWorld([{ x: 50, y: 50, vx: 4 }, { x: 70, y: 50 }], { friction: 1 });
      sim.update();
      expect(sim.getParticles()[0].vx).toBe(0);
      expect(sim.getParticles()[0].x).toBe(50);
    });
  });

  describe('contrat de mutation et d\'état', () => {
    it('mute en place les mêmes objets particules, dans le même ordre', () => {
      const sim = createWorld([{ x: 10, y: 10 }, { x: 40, y: 10 }, { x: 90, y: 90, group: 1 }]);
      const before = [...sim.getParticles()];
      const groups = before.map((p) => p.group);
      sim.update();
      const after = sim.getParticles();
      expect(after.length).toBe(3);
      after.forEach((p, i) => {
        expect(p).toBe(before[i]);
        expect(p.group).toBe(groups[i]);
      });
    });

    it('n\'altère ni la matrice ni la configuration', () => {
      const sim = createWorld([{ x: 10, y: 10 }, { x: 40, y: 10 }]);
      const matrix = sim.getAttractions().map((row) => [...row]);
      const config = { ...sim.getConfig() };
      sim.update();
      expect(sim.getAttractions()).toEqual(matrix);
      expect(sim.getConfig()).toEqual(config);
      expect(sim.getState().tick).toBe(1);
    });

    it('tourne à vide sans particule', () => {
      const sim = createWorld([]);
      expect(() => sim.update()).not.toThrow();
      expect(sim.getState().tick).toBe(1);
    });
  });

  describe('golden issu de l\'implémentation d\'origine (graine fixée)', () => {
    const golden = JSON.parse(
      readFileSync(new URL('./fixtures/seeded-golden.json', import.meta.url), 'utf8'),
    ) as Record<string, SeededSnapshot>;

    it.each([
      ['seed42_ticks1', 42, 1],
      ['seed42_ticks25', 42, 25],
      ['seed7_ticks60', 7, 60],
    ])('%s reproduit exactement positions, vitesses, matrice et stats', (name, seed, ticks) => {
      expect(runSeeded(seed, ticks)).toEqual(golden[name]);
    });

    it('couvre bien un corpus de 3 scénarios et 14 particules chacun', () => {
      expect(Object.keys(golden)).toHaveLength(3);
      for (const snapshot of Object.values(golden)) {
        expect(snapshot.particles).toHaveLength(14);
        expect(snapshot.attractions).toHaveLength(3);
      }
    });
  });
});
