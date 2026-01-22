/**
 * Tests pour la simulation Particle Life
 *
 * @module tools/particle-life/__tests__/Simulation
 */

import { Simulation } from '../src/Simulation';
import type { SimulationConfig, Particle } from '../src/types';

describe('Simulation Particle Life', () => {
  describe('Initialisation', () => {
    it('crée une simulation avec la configuration par défaut', () => {
      const sim = new Simulation();
      const config = sim.getConfig();

      expect(config.particleCount).toBe(500);
      expect(config.groupCount).toBe(4);
      expect(config.interactionRadius).toBe(80);
      expect(config.friction).toBe(0.05);
    });

    it('accepte une configuration personnalisée', () => {
      const customConfig: Partial<SimulationConfig> = {
        particleCount: 100,
        groupCount: 3,
        friction: 0.1,
      };

      const sim = new Simulation(customConfig);
      const config = sim.getConfig();

      expect(config.particleCount).toBe(100);
      expect(config.groupCount).toBe(3);
      expect(config.friction).toBe(0.1);
      // Les valeurs non spécifiées gardent les défauts
      expect(config.interactionRadius).toBe(80);
    });

    it('crée le bon nombre de particules', () => {
      const sim = new Simulation({ particleCount: 50 });
      const particles = sim.getParticles();

      expect(particles.length).toBe(50);
    });

    it('assigne des groupes valides aux particules', () => {
      const groupCount = 5;
      const sim = new Simulation({ particleCount: 100, groupCount });
      const particles = sim.getParticles();

      for (const p of particles) {
        expect(p.group).toBeGreaterThanOrEqual(0);
        expect(p.group).toBeLessThan(groupCount);
      }
    });

    it('positionne les particules dans les limites du monde', () => {
      const width = 400;
      const height = 300;
      const sim = new Simulation({ particleCount: 100, width, height });
      const particles = sim.getParticles();

      for (const p of particles) {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThan(width);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThan(height);
      }
    });

    it('initialise les vitesses à zéro', () => {
      const sim = new Simulation({ particleCount: 50 });
      const particles = sim.getParticles();

      for (const p of particles) {
        expect(p.vx).toBe(0);
        expect(p.vy).toBe(0);
      }
    });
  });

  describe('Matrice d\'attractions', () => {
    it('crée une matrice de la bonne taille', () => {
      const groupCount = 4;
      const sim = new Simulation({ groupCount });
      const attractions = sim.getAttractions();

      expect(attractions.length).toBe(groupCount);
      for (const row of attractions) {
        expect(row.length).toBe(groupCount);
      }
    });

    it('génère des valeurs entre -1 et 1', () => {
      const sim = new Simulation({ groupCount: 5 });
      const attractions = sim.getAttractions();

      for (const row of attractions) {
        for (const value of row) {
          expect(value).toBeGreaterThanOrEqual(-1);
          expect(value).toBeLessThanOrEqual(1);
        }
      }
    });

    it('permet de modifier une attraction', () => {
      const sim = new Simulation({ groupCount: 3 });
      sim.setAttraction(0, 1, 0.5);
      const attractions = sim.getAttractions();

      expect(attractions[0][1]).toBe(0.5);
    });

    it('clamp les valeurs d\'attraction entre -1 et 1', () => {
      const sim = new Simulation({ groupCount: 3 });

      sim.setAttraction(0, 0, 2);
      expect(sim.getAttractions()[0][0]).toBe(1);

      sim.setAttraction(0, 0, -2);
      expect(sim.getAttractions()[0][0]).toBe(-1);
    });

    it('randomize génère de nouvelles valeurs', () => {
      const sim = new Simulation({ groupCount: 3 });
      const before = JSON.stringify(sim.getAttractions());

      sim.randomizeAttractions();
      const after = JSON.stringify(sim.getAttractions());

      // Très improbable que les valeurs soient identiques
      expect(after).not.toBe(before);
    });
  });

  describe('Mise à jour (update)', () => {
    it('incrémente le tick à chaque update', () => {
      const sim = new Simulation({ particleCount: 10 });

      expect(sim.getState().tick).toBe(0);

      sim.update();
      expect(sim.getState().tick).toBe(1);

      sim.update();
      expect(sim.getState().tick).toBe(2);
    });

    it('met à jour les positions des particules', () => {
      const sim = new Simulation({ particleCount: 10, groupCount: 2 });

      // Forcer des vitesses initiales
      const particles = sim.getParticles() as Particle[];
      particles[0].vx = 5;
      particles[0].vy = 3;
      const initialX = particles[0].x;
      const initialY = particles[0].y;

      sim.update();

      // La position devrait avoir changé
      // (la vitesse est modifiée par friction et forces, donc pas exactement +5/+3)
      expect(particles[0].x).not.toBe(initialX);
      expect(particles[0].y).not.toBe(initialY);
    });

    it('applique le wrapping (monde torique)', () => {
      const sim = new Simulation({ particleCount: 1, width: 100, height: 100 });
      const particles = sim.getParticles() as Particle[];

      // Placer une particule au bord avec vitesse sortante
      particles[0].x = 99;
      particles[0].vx = 10;

      sim.update();

      // La particule devrait réapparaître de l'autre côté
      expect(particles[0].x).toBeLessThan(20); // Wrappée
    });

    it('applique la friction aux vitesses', () => {
      const friction = 0.1;
      const sim = new Simulation({ particleCount: 1, friction, groupCount: 1 });
      const particles = sim.getParticles() as Particle[];

      particles[0].vx = 10;
      particles[0].vy = 10;

      sim.update();

      // La vitesse devrait être réduite par la friction
      // Attention : d'autres forces peuvent s'appliquer, mais globalement elle devrait diminuer
      const speed = Math.sqrt(particles[0].vx ** 2 + particles[0].vy ** 2);
      expect(speed).toBeLessThan(Math.sqrt(200)); // < vitesse initiale de ~14.14
    });
  });

  describe('Statistiques', () => {
    it('calcule l\'énergie cinétique', () => {
      const sim = new Simulation({ particleCount: 2 });
      const particles = sim.getParticles() as Particle[];

      particles[0].vx = 3;
      particles[0].vy = 4; // vitesse = 5, énergie = 12.5
      particles[1].vx = 0;
      particles[1].vy = 0; // vitesse = 0, énergie = 0

      const stats = sim.getStats();

      expect(stats.kineticEnergy).toBe(12.5);
    });

    it('calcule la vitesse moyenne', () => {
      const sim = new Simulation({ particleCount: 2 });
      const particles = sim.getParticles() as Particle[];

      particles[0].vx = 3;
      particles[0].vy = 4; // vitesse = 5
      particles[1].vx = 0;
      particles[1].vy = 5; // vitesse = 5

      const stats = sim.getStats();

      expect(stats.averageSpeed).toBe(5); // (5 + 5) / 2
    });

    it('compte les particules par groupe', () => {
      const sim = new Simulation({ particleCount: 4, groupCount: 2 });
      const particles = sim.getParticles() as Particle[];

      // Forcer la répartition
      particles[0].group = 0;
      particles[1].group = 0;
      particles[2].group = 1;
      particles[3].group = 1;

      const stats = sim.getStats();

      expect(stats.groupCounts).toEqual([2, 2]);
    });
  });

  describe('Reset et configuration', () => {
    it('resetParticles remet les particules à des positions aléatoires', () => {
      const sim = new Simulation({ particleCount: 10 });
      const before = JSON.stringify(sim.getParticles());

      // Faire quelques updates
      sim.update();
      sim.update();

      sim.resetParticles();
      const after = JSON.stringify(sim.getParticles());

      // Les positions devraient être différentes (très improbable qu'elles soient identiques)
      expect(after).not.toBe(before);
      // Le tick devrait être remis à 0
      expect(sim.getState().tick).toBe(0);
    });

    it('updateConfig recrée la simulation avec la nouvelle config', () => {
      const sim = new Simulation({ particleCount: 100 });
      expect(sim.getParticles().length).toBe(100);

      sim.updateConfig({ particleCount: 50 });
      expect(sim.getParticles().length).toBe(50);
    });

    it('resize met à l\'échelle les positions des particules', () => {
      const sim = new Simulation({ particleCount: 1, width: 100, height: 100 });
      const particles = sim.getParticles() as Particle[];

      // Placer au centre
      particles[0].x = 50;
      particles[0].y = 50;

      sim.resize(200, 200);

      // La position devrait être mise à l'échelle
      expect(particles[0].x).toBe(100);
      expect(particles[0].y).toBe(100);

      // La config devrait être mise à jour
      const config = sim.getConfig();
      expect(config.width).toBe(200);
      expect(config.height).toBe(200);
    });
  });
});
