/**
 * Physics.js - Fonctions de physique relativiste
 *
 * Ce module contient les fonctions pures pour les calculs de relativité restreinte.
 * Toutes les fonctions sont sans effet de bord et testables.
 *
 * Conventions :
 * - Les vitesses sont exprimées en fraction de c (β = v/c)
 * - c = 1 dans les unités de simulation
 * - Les vecteurs utilisent THREE.Vector3
 */

/** Vitesse de la lumière dans les unités de simulation */
export const C = 1.0;

/**
 * Calcule le facteur de Lorentz γ (gamma)
 *
 * γ = 1 / √(1 - β²)
 *
 * @param {number} beta - Vitesse en fraction de c (|v|/c)
 * @returns {number} Facteur gamma (≥ 1)
 */
export function gamma(beta) {
  if (Math.abs(beta) >= 1) {
    return Infinity;
  }
  return 1 / Math.sqrt(1 - beta * beta);
}

/**
 * Calcule γ à partir d'un vecteur vitesse
 *
 * @param {THREE.Vector3} velocity - Vecteur vitesse (en fraction de c)
 * @returns {number} Facteur gamma
 */
export function gammaFromVelocity(velocity) {
  const beta = velocity.length();
  return gamma(beta);
}

/**
 * Calcule le temps dilaté observé
 *
 * Δt' = γ · Δt₀
 *
 * @param {number} properTime - Temps propre Δt₀ (dans le référentiel au repos)
 * @param {number} beta - Vitesse relative en fraction de c
 * @returns {number} Temps dilaté Δt' (observé depuis un autre référentiel)
 */
export function timeDilation(properTime, beta) {
  return properTime * gamma(beta);
}

/**
 * Calcule le temps propre écoulé pour un delta temps lab
 *
 * Δτ = Δt / γ = Δt · √(1 - β²)
 *
 * @param {number} labTime - Delta temps dans le référentiel lab
 * @param {number} beta - Vitesse en fraction de c
 * @returns {number} Delta temps propre
 */
export function properTimeDelta(labTime, beta) {
  if (Math.abs(beta) >= 1) {
    return 0;
  }
  return labTime * Math.sqrt(1 - beta * beta);
}

/**
 * Calcule la longueur contractée
 *
 * L' = L₀ / γ = L₀ · √(1 - β²)
 *
 * La contraction se produit uniquement dans la direction du mouvement.
 *
 * @param {number} properLength - Longueur propre L₀ (mesurée au repos)
 * @param {number} beta - Vitesse relative en fraction de c
 * @returns {number} Longueur contractée L'
 */
export function lengthContraction(properLength, beta) {
  if (Math.abs(beta) >= 1) {
    return 0;
  }
  return properLength * Math.sqrt(1 - beta * beta);
}

/**
 * Transformation de Lorentz 1D pour un événement
 *
 * t' = γ(t - βx/c)
 * x' = γ(x - vt)
 *
 * @param {number} x - Position dans le référentiel S
 * @param {number} t - Temps dans le référentiel S
 * @param {number} beta - Vitesse de S' par rapport à S (en fraction de c)
 * @returns {{x: number, t: number}} Coordonnées dans S'
 */
export function lorentzTransform1D(x, t, beta) {
  const g = gamma(beta);
  return {
    x: g * (x - beta * C * t),
    t: g * (t - beta * x / C),
  };
}

/**
 * Transformation de Lorentz inverse 1D
 *
 * @param {number} xPrime - Position dans S'
 * @param {number} tPrime - Temps dans S'
 * @param {number} beta - Vitesse de S' par rapport à S
 * @returns {{x: number, t: number}} Coordonnées dans S
 */
export function lorentzTransformInverse1D(xPrime, tPrime, beta) {
  // Inverse = même transformation avec -beta
  return lorentzTransform1D(xPrime, tPrime, -beta);
}

/**
 * Addition relativiste des vitesses (1D)
 *
 * w = (u + v) / (1 + uv/c²)
 *
 * @param {number} u - Vitesse dans S' (fraction de c)
 * @param {number} v - Vitesse de S' par rapport à S (fraction de c)
 * @returns {number} Vitesse résultante dans S (fraction de c)
 */
export function velocityAddition(u, v) {
  return (u + v) / (1 + u * v);
}

/**
 * Addition relativiste des vitesses (3D)
 *
 * Pour un boost de vitesse v, la vitesse u dans le référentiel boosté devient :
 * w = [u∥ + v + u⊥/γ] / (1 + u·v/c²)
 *
 * @param {THREE.Vector3} u - Vitesse dans S' (fraction de c)
 * @param {THREE.Vector3} v - Vitesse de S' par rapport à S (fraction de c)
 * @returns {THREE.Vector3} Vitesse résultante dans S
 */
export function velocityAddition3D(u, v) {
  const vNorm = v.length();
  if (vNorm < 1e-10) {
    return u.clone();
  }

  const g = gamma(vNorm);
  const vHat = v.clone().normalize();

  // Composantes parallèle et perpendiculaire de u par rapport à v
  const uDotVHat = u.dot(vHat);
  const uParallel = vHat.clone().multiplyScalar(uDotVHat);
  const uPerp = u.clone().sub(uParallel);

  // Dénominateur : 1 + u·v (en unités c=1)
  const denom = 1 + u.dot(v);

  // Numérateur : u∥ + v + u⊥/γ
  const wParallel = uParallel.clone().add(v);
  const wPerp = uPerp.clone().divideScalar(g);

  return wParallel.add(wPerp).divideScalar(denom);
}

/**
 * Effet Doppler relativiste (longitudinal)
 *
 * f_obs / f_source = √[(1 - β) / (1 + β)]  (source s'éloigne)
 * f_obs / f_source = √[(1 + β) / (1 - β)]  (source s'approche)
 *
 * @param {number} sourceFrequency - Fréquence émise f₀
 * @param {number} beta - Vitesse relative (positive = éloignement)
 * @returns {number} Fréquence observée
 */
export function dopplerShift(sourceFrequency, beta) {
  if (Math.abs(beta) >= 1) {
    return beta > 0 ? 0 : Infinity;
  }
  return sourceFrequency * Math.sqrt((1 - beta) / (1 + beta));
}

/**
 * Effet Doppler relativiste général (angle quelconque)
 *
 * f_obs / f_source = 1 / [γ(1 - β·cos(θ))]
 *
 * @param {number} sourceFrequency - Fréquence émise
 * @param {number} beta - Vitesse de la source (fraction de c)
 * @param {number} theta - Angle entre la direction de la lumière et la vitesse
 *                         (θ = 0 : source s'approche directement)
 * @returns {number} Fréquence observée
 */
export function dopplerShiftGeneral(sourceFrequency, beta, theta) {
  if (Math.abs(beta) >= 1) {
    return 0;
  }
  const g = gamma(beta);
  const cosTheta = Math.cos(theta);
  return sourceFrequency / (g * (1 - beta * cosTheta));
}

/**
 * Effet Doppler transverse (θ = π/2)
 *
 * Effet purement relativiste dû à la dilatation du temps.
 * f_obs / f_source = 1/γ = √(1 - β²)
 *
 * @param {number} sourceFrequency - Fréquence émise
 * @param {number} beta - Vitesse de la source
 * @returns {number} Fréquence observée (toujours redshift)
 */
export function dopplerTransverse(sourceFrequency, beta) {
  if (Math.abs(beta) >= 1) {
    return 0;
  }
  return sourceFrequency * Math.sqrt(1 - beta * beta);
}

/**
 * Aberration relativiste
 *
 * Calcule l'angle apparent d'une source lumineuse pour un observateur en mouvement.
 *
 * cos(θ_obs) = [cos(θ_source) - β] / [1 - β·cos(θ_source)]
 *
 * @param {number} thetaSource - Angle dans le référentiel source (radians)
 * @param {number} beta - Vitesse de l'observateur (fraction de c)
 * @returns {number} Angle observé (radians)
 */
export function aberration(thetaSource, beta) {
  if (Math.abs(beta) >= 1) {
    return 0; // Tout concentré vers l'avant
  }
  const cosSource = Math.cos(thetaSource);
  const cosObs = (cosSource - beta) / (1 - beta * cosSource);
  // Clamper pour éviter les erreurs numériques
  return Math.acos(Math.max(-1, Math.min(1, cosObs)));
}

/**
 * Calcule l'intervalle d'espace-temps entre deux événements
 *
 * s² = c²Δt² - Δx² - Δy² - Δz²
 *
 * - s² > 0 : intervalle de type temps (timelike)
 * - s² < 0 : intervalle de type espace (spacelike)
 * - s² = 0 : intervalle de type lumière (lightlike)
 *
 * @param {number} dt - Différence de temps
 * @param {THREE.Vector3} dr - Différence de position
 * @returns {number} Intervalle au carré s²
 */
export function spacetimeInterval(dt, dr) {
  return C * C * dt * dt - dr.lengthSq();
}

/**
 * Classifie un événement par rapport au cône de lumière
 *
 * @param {number} dt - Différence de temps avec l'apex
 * @param {THREE.Vector3} dr - Différence de position avec l'apex
 * @returns {'past' | 'future' | 'elsewhere' | 'lightcone'} Classification
 */
export function classifyEvent(dt, dr) {
  const s2 = spacetimeInterval(dt, dr);
  const epsilon = 1e-10;

  if (Math.abs(s2) < epsilon) {
    return 'lightcone';
  } else if (s2 > 0) {
    // Timelike : causalement connecté
    return dt > 0 ? 'future' : 'past';
  } else {
    // Spacelike : ailleurs
    return 'elsewhere';
  }
}

/**
 * Calcule la période d'une horloge à photon
 *
 * T₀ = 2L/c
 *
 * @param {number} mirrorDistance - Distance entre les miroirs L
 * @returns {number} Période propre de l'horloge
 */
export function lightClockPeriod(mirrorDistance) {
  return 2 * mirrorDistance / C;
}

/**
 * Énergie relativiste totale
 *
 * E = γmc²
 *
 * @param {number} restMass - Masse au repos m₀
 * @param {number} beta - Vitesse (fraction de c)
 * @returns {number} Énergie totale (en unités mc²)
 */
export function relativisticEnergy(restMass, beta) {
  return gamma(beta) * restMass * C * C;
}

/**
 * Impulsion relativiste
 *
 * p = γmv
 *
 * @param {number} restMass - Masse au repos m₀
 * @param {number} beta - Vitesse (fraction de c)
 * @returns {number} Impulsion (en unités mc)
 */
export function relativisticMomentum(restMass, beta) {
  return gamma(beta) * restMass * beta * C;
}

/**
 * Calcule la rapidity (rapidité)
 *
 * φ = arctanh(β)
 *
 * La rapidity est additive contrairement aux vitesses :
 * φ_total = φ_1 + φ_2
 *
 * @param {number} beta - Vitesse (fraction de c)
 * @returns {number} Rapidity
 */
export function rapidity(beta) {
  if (Math.abs(beta) >= 1) {
    return beta > 0 ? Infinity : -Infinity;
  }
  return Math.atanh(beta);
}

/**
 * Calcule β à partir de la rapidity
 *
 * β = tanh(φ)
 *
 * @param {number} phi - Rapidity
 * @returns {number} Vitesse (fraction de c)
 */
export function betaFromRapidity(phi) {
  return Math.tanh(phi);
}

// =============================================================================
// Fusée à photons (Photon Rocket)
// =============================================================================

/**
 * Calcule le delta-v d'une fusée à photons
 *
 * Pour une fusée à photons idéale (100% d'efficacité) :
 * Δv = c × tanh(ln(m₀/m₁))
 *
 * @param {number} m0 - Masse initiale
 * @param {number} m1 - Masse finale (m1 < m0)
 * @returns {number} Delta-v en fraction de c
 */
export function photonRocketDeltaV(m0, m1) {
  if (m1 >= m0 || m1 <= 0) return 0;
  const rapidityGain = Math.log(m0 / m1);
  return Math.tanh(rapidityGain);
}

/**
 * Calcule la masse finale après un delta-v donné
 *
 * m₁ = m₀ × exp(-atanh(Δv))
 *
 * @param {number} m0 - Masse initiale
 * @param {number} deltaV - Delta-v souhaité (fraction de c, < 1)
 * @returns {number} Masse finale requise
 */
export function photonRocketMassRequired(m0, deltaV) {
  if (Math.abs(deltaV) >= 1) return 0;
  const rapidityNeeded = Math.atanh(deltaV);
  return m0 * Math.exp(-rapidityNeeded);
}

/**
 * Calcule la masse de propergol nécessaire pour un delta-v
 *
 * @param {number} m0 - Masse initiale
 * @param {number} deltaV - Delta-v souhaité (fraction de c)
 * @returns {number} Masse de propergol à éjecter
 */
export function photonRocketFuelRequired(m0, deltaV) {
  const m1 = photonRocketMassRequired(m0, deltaV);
  return m0 - m1;
}

// =============================================================================
// Effet Doppler - Couleurs
// =============================================================================

/**
 * Calcule la couleur Doppler (redshift/blueshift)
 *
 * Retourne une couleur RGB basée sur le décalage Doppler :
 * - Blueshift (approche) : vers le bleu
 * - Redshift (éloignement) : vers le rouge
 *
 * @param {number} beta - Vitesse radiale (positive = éloignement)
 * @returns {{r: number, g: number, b: number, hex: string}} Couleur
 */
export function dopplerColor(beta) {
  // Facteur Doppler : z = sqrt((1+β)/(1-β)) - 1
  // z > 0 : redshift, z < 0 : blueshift
  const clampedBeta = Math.max(-0.99, Math.min(0.99, beta));
  const dopplerFactor = Math.sqrt((1 + clampedBeta) / (1 - clampedBeta));

  // Mapper sur une échelle de couleur
  // dopplerFactor = 1 : pas de shift (blanc/vert)
  // dopplerFactor > 1 : redshift
  // dopplerFactor < 1 : blueshift

  let r, g, b;

  if (dopplerFactor >= 1) {
    // Redshift : vert → jaune → rouge
    const t = Math.min(1, (dopplerFactor - 1) / 2); // normaliser
    r = 1;
    g = 1 - t;
    b = 0;
  } else {
    // Blueshift : vert → cyan → bleu
    const t = Math.min(1, (1 - dopplerFactor) / 0.5); // normaliser
    r = 0;
    g = 1 - t * 0.5;
    b = t;
  }

  const toHex = (v) => Math.round(v * 255).toString(16).padStart(2, '0');
  const hex = `#${toHex(r)}${toHex(g)}${toHex(b)}`;

  return { r, g, b, hex };
}
