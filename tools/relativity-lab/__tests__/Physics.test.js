/**
 * Tests unitaires pour Physics.js - Fonctions de physique relativiste
 *
 * Ces tests valident les formules de relativité restreinte avec des valeurs
 * canoniques et des cas limites. Chaque test inclut la formule vérifiée.
 */

import { Vector3 } from 'three';
import * as Physics from '../src/Physics.js';

// Tolérance pour les comparaisons de nombres flottants
const EPSILON = 1e-10;

/**
 * Helper pour comparer des nombres avec tolérance
 */
function expectClose(actual, expected, tolerance = EPSILON) {
  expect(Math.abs(actual - expected)).toBeLessThan(tolerance);
}

describe('Physics.js - Relativité restreinte', () => {
  describe('Constante c', () => {
    it('c = 1 dans les unités de simulation', () => {
      expect(Physics.C).toBe(1.0);
    });
  });

  // ===========================================================================
  // Facteur de Lorentz γ
  // ===========================================================================

  describe('gamma() - Facteur de Lorentz', () => {
    /**
     * γ = 1 / √(1 - β²)
     */

    it('γ = 1 pour β = 0 (repos)', () => {
      expect(Physics.gamma(0)).toBe(1);
    });

    it('γ ≈ 1.155 pour β = 0.5 (50% c)', () => {
      // γ = 1/√(1 - 0.25) = 1/√0.75 ≈ 1.1547
      expectClose(Physics.gamma(0.5), 1 / Math.sqrt(0.75), 1e-4);
    });

    it('γ ≈ 1.414 pour β = √2/2 ≈ 0.707 (cas classique)', () => {
      // γ = 1/√(1 - 0.5) = √2 ≈ 1.414
      const beta = Math.SQRT2 / 2;
      expectClose(Physics.gamma(beta), Math.SQRT2, 1e-4);
    });

    it('γ = 2 pour β = √3/2 ≈ 0.866', () => {
      // γ = 1/√(1 - 3/4) = 1/√(1/4) = 2
      const beta = Math.sqrt(3) / 2;
      expectClose(Physics.gamma(beta), 2, 1e-10);
    });

    it('γ ≈ 7.089 pour β = 0.99 (quasi-lumière)', () => {
      // γ = 1/√(1 - 0.9801) = 1/√0.0199 ≈ 7.089
      expectClose(Physics.gamma(0.99), 1 / Math.sqrt(0.0199), 1e-3);
    });

    it('γ = ∞ pour β = 1 (lumière)', () => {
      expect(Physics.gamma(1)).toBe(Infinity);
    });

    it('γ = ∞ pour β > 1 (superluminique)', () => {
      expect(Physics.gamma(1.1)).toBe(Infinity);
    });

    it('γ est symétrique pour ±β', () => {
      expect(Physics.gamma(0.5)).toBe(Physics.gamma(-0.5));
      expect(Physics.gamma(0.8)).toBe(Physics.gamma(-0.8));
    });
  });

  describe('gammaFromVelocity() - γ depuis vecteur vitesse', () => {
    it('γ = 1 pour vecteur nul', () => {
      const v = new Vector3(0, 0, 0);
      expect(Physics.gammaFromVelocity(v)).toBe(1);
    });

    it('calcule correctement pour vitesse selon X', () => {
      const v = new Vector3(0.5, 0, 0);
      expectClose(Physics.gammaFromVelocity(v), Physics.gamma(0.5));
    });

    it('calcule correctement pour vitesse diagonale', () => {
      // v = (0.3, 0.4, 0) → |v| = 0.5
      const v = new Vector3(0.3, 0.4, 0);
      expectClose(Physics.gammaFromVelocity(v), Physics.gamma(0.5));
    });

    it('calcule correctement pour vitesse 3D', () => {
      // v = (0.2, 0.3, 0.6) → |v| = √(0.04 + 0.09 + 0.36) = 0.7
      const v = new Vector3(0.2, 0.3, 0.6);
      expectClose(Physics.gammaFromVelocity(v), Physics.gamma(0.7), 1e-10);
    });
  });

  // ===========================================================================
  // Dilatation du temps
  // ===========================================================================

  describe('timeDilation() - Dilatation du temps', () => {
    /**
     * Δt' = γ · Δt₀
     * Le temps observé est plus long que le temps propre.
     */

    it('pas de dilatation au repos (β = 0)', () => {
      expect(Physics.timeDilation(10, 0)).toBe(10);
    });

    it('Δt\' = γ·Δt₀ pour β = 0.6', () => {
      // γ = 1/√(1-0.36) = 1/0.8 = 1.25
      const gamma = 1 / Math.sqrt(1 - 0.36);
      expectClose(Physics.timeDilation(10, 0.6), 10 * gamma);
    });

    it('le temps double pour β = √3/2 (γ = 2)', () => {
      const beta = Math.sqrt(3) / 2;
      expectClose(Physics.timeDilation(10, beta), 20);
    });
  });

  describe('properTimeDelta() - Delta temps propre', () => {
    /**
     * Δτ = Δt / γ = Δt · √(1 - β²)
     * Le temps propre écoulé est plus court que le temps lab.
     */

    it('pas de changement au repos (β = 0)', () => {
      expect(Physics.properTimeDelta(10, 0)).toBe(10);
    });

    it('Δτ = Δt/γ pour β = 0.6', () => {
      // Δτ = 10 · √(1 - 0.36) = 10 · 0.8 = 8
      expectClose(Physics.properTimeDelta(10, 0.6), 8);
    });

    it('le temps propre est divisé par 2 pour β = √3/2', () => {
      const beta = Math.sqrt(3) / 2;
      expectClose(Physics.properTimeDelta(10, beta), 5);
    });

    it('Δτ = 0 pour β = 1 (photon)', () => {
      expect(Physics.properTimeDelta(10, 1)).toBe(0);
    });
  });

  // ===========================================================================
  // Contraction des longueurs
  // ===========================================================================

  describe('lengthContraction() - Contraction des longueurs', () => {
    /**
     * L' = L₀ / γ = L₀ · √(1 - β²)
     */

    it('pas de contraction au repos (β = 0)', () => {
      expect(Physics.lengthContraction(10, 0)).toBe(10);
    });

    it('L\' = L₀·√(1-β²) pour β = 0.6', () => {
      // L' = 10 · √(0.64) = 10 · 0.8 = 8
      expectClose(Physics.lengthContraction(10, 0.6), 8);
    });

    it('la longueur est divisée par 2 pour β = √3/2', () => {
      const beta = Math.sqrt(3) / 2;
      expectClose(Physics.lengthContraction(10, beta), 5);
    });

    it('L\' = 0 pour β = 1', () => {
      expect(Physics.lengthContraction(10, 1)).toBe(0);
    });
  });

  // ===========================================================================
  // Transformations de Lorentz
  // ===========================================================================

  describe('lorentzTransform1D() - Transformation de Lorentz', () => {
    /**
     * t' = γ(t - βx/c)
     * x' = γ(x - vt) = γ(x - βct)
     */

    it('identité pour β = 0', () => {
      const result = Physics.lorentzTransform1D(5, 10, 0);
      expect(result.x).toBe(5);
      expect(result.t).toBe(10);
    });

    it('transformation correcte pour β = 0.6', () => {
      // γ = 1.25, β = 0.6
      // x = 10, t = 20
      // x' = 1.25 * (10 - 0.6 * 1 * 20) = 1.25 * (10 - 12) = -2.5
      // t' = 1.25 * (20 - 0.6 * 10 / 1) = 1.25 * (20 - 6) = 17.5
      const result = Physics.lorentzTransform1D(10, 20, 0.6);
      expectClose(result.x, -2.5, 1e-10);
      expectClose(result.t, 17.5, 1e-10);
    });

    it('l\'origine reste à l\'origine', () => {
      const result = Physics.lorentzTransform1D(0, 0, 0.5);
      expect(result.x).toBe(0);
      expect(result.t).toBe(0);
    });
  });

  describe('lorentzTransformInverse1D() - Transformation inverse', () => {
    it('inverse annule la transformation', () => {
      const x0 = 5, t0 = 10, beta = 0.6;
      const transformed = Physics.lorentzTransform1D(x0, t0, beta);
      const restored = Physics.lorentzTransformInverse1D(transformed.x, transformed.t, beta);

      expectClose(restored.x, x0);
      expectClose(restored.t, t0);
    });
  });

  // ===========================================================================
  // Addition relativiste des vitesses
  // ===========================================================================

  describe('velocityAddition() - Addition des vitesses 1D', () => {
    /**
     * w = (u + v) / (1 + uv/c²)
     */

    it('addition classique pour petites vitesses', () => {
      // Pour u, v << c, w ≈ u + v
      expectClose(Physics.velocityAddition(0.01, 0.01), 0.02, 1e-4);
    });

    it('0.5c + 0.5c ≠ 1c (relativiste)', () => {
      // w = (0.5 + 0.5) / (1 + 0.25) = 1/1.25 = 0.8
      expectClose(Physics.velocityAddition(0.5, 0.5), 0.8);
    });

    it('0.9c + 0.9c < c', () => {
      // w = 1.8 / 1.81 ≈ 0.9945
      const result = Physics.velocityAddition(0.9, 0.9);
      expect(result).toBeLessThan(1);
      expectClose(result, 1.8 / 1.81, 1e-4);
    });

    it('c + v = c (la lumière reste à c)', () => {
      expectClose(Physics.velocityAddition(1, 0.5), 1);
      expectClose(Physics.velocityAddition(0.5, 1), 1);
    });

    it('v + 0 = v', () => {
      expect(Physics.velocityAddition(0.6, 0)).toBe(0.6);
      expect(Physics.velocityAddition(0, 0.6)).toBe(0.6);
    });

    it('gère les vitesses négatives (sens opposé)', () => {
      // u = 0.5, v = -0.5 → w = 0
      expectClose(Physics.velocityAddition(0.5, -0.5), 0);
    });
  });

  describe('velocityAddition3D() - Addition des vitesses 3D', () => {
    it('se réduit au cas 1D pour vecteurs colinéaires', () => {
      const u = new Vector3(0.5, 0, 0);
      const v = new Vector3(0.3, 0, 0);
      const w = Physics.velocityAddition3D(u, v);

      const expected = Physics.velocityAddition(0.5, 0.3);
      expectClose(w.x, expected, 1e-10);
      expectClose(w.y, 0, 1e-10);
      expectClose(w.z, 0, 1e-10);
    });

    it('retourne u si v = 0', () => {
      const u = new Vector3(0.3, 0.4, 0);
      const v = new Vector3(0, 0, 0);
      const w = Physics.velocityAddition3D(u, v);

      expectClose(w.x, 0.3);
      expectClose(w.y, 0.4);
      expectClose(w.z, 0);
    });

    it('la norme résultante est < c pour u, v < c', () => {
      const u = new Vector3(0.5, 0.3, 0);
      const v = new Vector3(0.2, 0.4, 0.3);
      const w = Physics.velocityAddition3D(u, v);

      expect(w.length()).toBeLessThan(1);
    });
  });

  // ===========================================================================
  // Effet Doppler
  // ===========================================================================

  describe('dopplerShift() - Effet Doppler longitudinal', () => {
    /**
     * f_obs/f_source = √[(1-β)/(1+β)] pour source s'éloignant (β > 0)
     * f_obs/f_source = √[(1+β)/(1-β)] pour source s'approchant (β < 0)
     */

    it('pas de shift pour β = 0', () => {
      expect(Physics.dopplerShift(100, 0)).toBe(100);
    });

    it('redshift pour source s\'éloignant (β > 0)', () => {
      // β = 0.5 → f_obs = f_source · √(0.5/1.5) = f_source · √(1/3) ≈ 0.577
      const result = Physics.dopplerShift(100, 0.5);
      expectClose(result, 100 * Math.sqrt(1 / 3), 1e-4);
      expect(result).toBeLessThan(100);
    });

    it('blueshift pour source s\'approchant (β < 0)', () => {
      // β = -0.5 → f_obs = f_source · √(1.5/0.5) = f_source · √3 ≈ 1.732
      const result = Physics.dopplerShift(100, -0.5);
      expectClose(result, 100 * Math.sqrt(3), 1e-4);
      expect(result).toBeGreaterThan(100);
    });

    it('f_obs = 0 pour β = 1 (source s\'éloigne à c)', () => {
      expect(Physics.dopplerShift(100, 1)).toBe(0);
    });

    it('f_obs = ∞ pour β = -1 (source s\'approche à c)', () => {
      expect(Physics.dopplerShift(100, -1)).toBe(Infinity);
    });
  });

  describe('dopplerShiftGeneral() - Effet Doppler angle quelconque', () => {
    /**
     * f_obs/f_source = 1 / [γ(1 - β·cos(θ))]
     * θ = 0 : source s'approche directement
     * θ = π : source s'éloigne directement
     */

    it('équivalent au Doppler longitudinal pour θ = 0 (approche)', () => {
      const beta = 0.5;
      const longitudinal = Physics.dopplerShift(100, -beta);
      const general = Physics.dopplerShiftGeneral(100, beta, 0);
      expectClose(general, longitudinal, 1e-4);
    });

    it('équivalent au Doppler longitudinal pour θ = π (éloignement)', () => {
      const beta = 0.5;
      const longitudinal = Physics.dopplerShift(100, beta);
      const general = Physics.dopplerShiftGeneral(100, beta, Math.PI);
      expectClose(general, longitudinal, 1e-4);
    });

    it('Doppler transverse pour θ = π/2', () => {
      const beta = 0.5;
      const transverse = Physics.dopplerTransverse(100, beta);
      const general = Physics.dopplerShiftGeneral(100, beta, Math.PI / 2);
      expectClose(general, transverse, 1e-4);
    });
  });

  describe('dopplerTransverse() - Effet Doppler transverse', () => {
    /**
     * f_obs/f_source = 1/γ = √(1 - β²)
     * Effet purement relativiste (dilatation du temps)
     */

    it('pas d\'effet pour β = 0', () => {
      expect(Physics.dopplerTransverse(100, 0)).toBe(100);
    });

    it('toujours redshift (f_obs < f_source)', () => {
      expect(Physics.dopplerTransverse(100, 0.3)).toBeLessThan(100);
      expect(Physics.dopplerTransverse(100, 0.6)).toBeLessThan(100);
      expect(Physics.dopplerTransverse(100, 0.9)).toBeLessThan(100);
    });

    it('f_obs = f_source / γ pour β = 0.6', () => {
      // f_obs = 100 · √(1 - 0.36) = 100 · 0.8 = 80
      expectClose(Physics.dopplerTransverse(100, 0.6), 80);
    });

    it('f_obs = 0 pour β = 1', () => {
      expect(Physics.dopplerTransverse(100, 1)).toBe(0);
    });
  });

  // ===========================================================================
  // Aberration
  // ===========================================================================

  describe('aberration() - Aberration relativiste', () => {
    /**
     * cos(θ_obs) = [cos(θ_source) - β] / [1 - β·cos(θ_source)]
     */

    it('pas d\'aberration pour β = 0', () => {
      expect(Physics.aberration(Math.PI / 4, 0)).toBe(Math.PI / 4);
    });

    it('aberration correcte pour source latérale à haute vitesse', () => {
      // θ_source = π/2 (source émettant perpendiculairement)
      // β = 0.9 (observateur se déplace vers +x)
      // cos(θ_obs) = (0 - 0.9) / (1 - 0) = -0.9
      // θ_obs = arccos(-0.9) ≈ 154° (source semble venir de l'arrière)
      const thetaSource = Math.PI / 2;
      const thetaObs = Physics.aberration(thetaSource, 0.9);
      expectClose(thetaObs, Math.acos(-0.9), 1e-10);
    });

    it('θ_obs = 0 pour β = 1 (tout concentré à l\'avant)', () => {
      expect(Physics.aberration(Math.PI / 3, 1)).toBe(0);
    });

    it('formule classique pour β = 0.5, θ = π/2', () => {
      // cos(θ_obs) = (0 - 0.5) / (1 - 0) = -0.5
      // θ_obs = 2π/3 = 120°
      expectClose(Physics.aberration(Math.PI / 2, 0.5), 2 * Math.PI / 3);
    });
  });

  // ===========================================================================
  // Intervalle d'espace-temps
  // ===========================================================================

  describe('spacetimeInterval() - Intervalle d\'espace-temps', () => {
    /**
     * s² = c²Δt² - Δx² - Δy² - Δz²
     */

    it('s² > 0 pour intervalle de type temps (timelike)', () => {
      // Δt = 10, |Δr| = 5 → s² = 100 - 25 = 75 > 0
      const dr = new Vector3(3, 4, 0); // |dr| = 5
      expect(Physics.spacetimeInterval(10, dr)).toBeGreaterThan(0);
    });

    it('s² < 0 pour intervalle de type espace (spacelike)', () => {
      // Δt = 5, |Δr| = 10 → s² = 25 - 100 = -75 < 0
      const dr = new Vector3(6, 8, 0); // |dr| = 10
      expect(Physics.spacetimeInterval(5, dr)).toBeLessThan(0);
    });

    it('s² = 0 pour intervalle de type lumière (lightlike)', () => {
      // Δt = 10, |Δr| = 10 (= c·Δt) → s² = 100 - 100 = 0
      const dr = new Vector3(6, 8, 0); // |dr| = 10
      expectClose(Physics.spacetimeInterval(10, dr), 0);
    });
  });

  describe('classifyEvent() - Classification dans le cône de lumière', () => {
    it('futur pour s² > 0 et Δt > 0', () => {
      const dr = new Vector3(1, 0, 0);
      expect(Physics.classifyEvent(10, dr)).toBe('future');
    });

    it('passé pour s² > 0 et Δt < 0', () => {
      const dr = new Vector3(1, 0, 0);
      expect(Physics.classifyEvent(-10, dr)).toBe('past');
    });

    it('ailleurs pour s² < 0 (spacelike)', () => {
      const dr = new Vector3(10, 0, 0);
      expect(Physics.classifyEvent(5, dr)).toBe('elsewhere');
    });

    it('cône de lumière pour s² ≈ 0', () => {
      const dr = new Vector3(10, 0, 0);
      expect(Physics.classifyEvent(10, dr)).toBe('lightcone');
    });
  });

  // ===========================================================================
  // Horloge à photon
  // ===========================================================================

  describe('lightClockPeriod() - Période de l\'horloge à photon', () => {
    /**
     * T₀ = 2L/c
     */

    it('T = 2L pour c = 1', () => {
      expect(Physics.lightClockPeriod(5)).toBe(10);
      expect(Physics.lightClockPeriod(1)).toBe(2);
    });
  });

  // ===========================================================================
  // Énergie et impulsion relativistes
  // ===========================================================================

  describe('relativisticEnergy() - Énergie totale', () => {
    /**
     * E = γmc² (avec c = 1)
     */

    it('E = m au repos (γ = 1)', () => {
      expect(Physics.relativisticEnergy(1, 0)).toBe(1);
    });

    it('E = γm pour β = √3/2 (γ = 2)', () => {
      const beta = Math.sqrt(3) / 2;
      expectClose(Physics.relativisticEnergy(1, beta), 2);
    });
  });

  describe('relativisticMomentum() - Impulsion', () => {
    /**
     * p = γmv = γmβc (avec c = 1)
     */

    it('p = 0 au repos', () => {
      expect(Physics.relativisticMomentum(1, 0)).toBe(0);
    });

    it('p = γmβ pour β = √3/2 (γ = 2)', () => {
      const beta = Math.sqrt(3) / 2;
      // p = 2 * 1 * (√3/2) * 1 = √3 ≈ 1.732
      expectClose(Physics.relativisticMomentum(1, beta), Math.sqrt(3));
    });
  });

  // ===========================================================================
  // Rapidity
  // ===========================================================================

  describe('rapidity() - Rapidité', () => {
    /**
     * φ = arctanh(β)
     */

    it('φ = 0 pour β = 0', () => {
      expect(Physics.rapidity(0)).toBe(0);
    });

    it('φ = ±∞ pour β = ±1', () => {
      expect(Physics.rapidity(1)).toBe(Infinity);
      expect(Physics.rapidity(-1)).toBe(-Infinity);
    });

    it('φ est additive (φ_total = φ_1 + φ_2)', () => {
      const beta1 = 0.5;
      const beta2 = 0.3;
      const betaSum = Physics.velocityAddition(beta1, beta2);

      const phi1 = Physics.rapidity(beta1);
      const phi2 = Physics.rapidity(beta2);
      const phiSum = Physics.rapidity(betaSum);

      expectClose(phi1 + phi2, phiSum, 1e-10);
    });
  });

  describe('betaFromRapidity() - β depuis rapidity', () => {
    /**
     * β = tanh(φ)
     */

    it('β = 0 pour φ = 0', () => {
      expect(Physics.betaFromRapidity(0)).toBe(0);
    });

    it('inverse de rapidity()', () => {
      const beta = 0.6;
      const phi = Physics.rapidity(beta);
      expectClose(Physics.betaFromRapidity(phi), beta);
    });
  });

  // ===========================================================================
  // Fusée à photons
  // ===========================================================================

  describe('photonRocketDeltaV() - Delta-v fusée à photons', () => {
    /**
     * Δv = c · tanh(ln(m₀/m₁))
     */

    it('Δv = 0 si m₁ ≥ m₀', () => {
      expect(Physics.photonRocketDeltaV(100, 100)).toBe(0);
      expect(Physics.photonRocketDeltaV(100, 150)).toBe(0);
    });

    it('Δv < c même pour grand ratio de masse', () => {
      // m₀/m₁ = 10 → Δv = tanh(ln(10)) ≈ 0.9
      const deltaV = Physics.photonRocketDeltaV(1000, 100);
      expect(deltaV).toBeLessThan(1);
      expectClose(deltaV, Math.tanh(Math.log(10)), 1e-10);
    });

    it('Δv = tanh(ln(e)) = tanh(1) ≈ 0.762 pour m₀/m₁ = e', () => {
      const m0 = Math.E * 100;
      const m1 = 100;
      expectClose(Physics.photonRocketDeltaV(m0, m1), Math.tanh(1), 1e-10);
    });
  });

  describe('photonRocketMassRequired() - Masse finale requise', () => {
    /**
     * m₁ = m₀ · exp(-atanh(Δv))
     */

    it('m₁ = m₀ pour Δv = 0', () => {
      expectClose(Physics.photonRocketMassRequired(100, 0), 100, 1e-10);
    });

    it('m₁ = 0 pour Δv ≥ c', () => {
      expect(Physics.photonRocketMassRequired(100, 1)).toBe(0);
      expect(Physics.photonRocketMassRequired(100, 1.1)).toBe(0);
    });

    it('inverse de photonRocketDeltaV', () => {
      const m0 = 1000;
      const m1 = 100;
      const deltaV = Physics.photonRocketDeltaV(m0, m1);
      const m1Computed = Physics.photonRocketMassRequired(m0, deltaV);
      expectClose(m1Computed, m1, 1e-8);
    });
  });

  describe('photonRocketFuelRequired() - Masse de propergol', () => {
    it('fuel = m₀ - m₁', () => {
      const m0 = 1000;
      const deltaV = 0.5;
      const m1 = Physics.photonRocketMassRequired(m0, deltaV);
      const fuel = Physics.photonRocketFuelRequired(m0, deltaV);
      expectClose(fuel, m0 - m1, 1e-10);
    });
  });

  // ===========================================================================
  // Couleur Doppler
  // ===========================================================================

  describe('dopplerColor() - Couleur Doppler', () => {
    it('retourne un objet avec r, g, b et hex', () => {
      const color = Physics.dopplerColor(0);
      expect(color).toHaveProperty('r');
      expect(color).toHaveProperty('g');
      expect(color).toHaveProperty('b');
      expect(color).toHaveProperty('hex');
    });

    it('neutre (vert/jaune) pour β = 0', () => {
      const color = Physics.dopplerColor(0);
      // Devrait être proche de jaune/vert
      expect(color.g).toBeGreaterThan(0.5);
    });

    it('redshift (rouge) pour β > 0 (éloignement)', () => {
      const color = Physics.dopplerColor(0.5);
      expect(color.r).toBeGreaterThan(color.b);
    });

    it('blueshift (bleu) pour β < 0 (approche)', () => {
      const color = Physics.dopplerColor(-0.5);
      expect(color.b).toBeGreaterThan(color.r);
    });

    it('hex est un format valide', () => {
      const color = Physics.dopplerColor(0.3);
      expect(color.hex).toMatch(/^#[0-9a-f]{6}$/);
    });

    it('gère les valeurs extrêmes sans erreur', () => {
      expect(() => Physics.dopplerColor(0.99)).not.toThrow();
      expect(() => Physics.dopplerColor(-0.99)).not.toThrow();
    });
  });
});
