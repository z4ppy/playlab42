/**
 * Calculs purs des forces et du repliement torique de Particle Life
 *
 * Aucune fonction ne modifie ses arguments : Simulation applique les résultats.
 * L'ordre des opérations flottantes est celui de l'implémentation d'origine,
 * les résultats doivent rester identiques bit à bit.
 *
 * @module tools/particle-life/forces
 */

import type { AttractionMatrix, Particle, SimulationConfig } from './types.js';

/** Force appliquée à une particule (somme des interactions) */
export interface Force {
  fx: number;
  fy: number;
}

/** Distance minimale en dessous de laquelle une paire est ignorée */
const MIN_DISTANCE = 1;

/**
 * Fonction de force en fonction de la distance normalisée
 * - répulsive à très courte distance (éviter les collisions)
 * - maximale à mi-distance
 * - décroissante vers zéro à longue distance
 */
export function forceFunction(normalizedDist: number): number {
  if (normalizedDist < 0.3) {
    return normalizedDist / 0.3 - 1;
  }
  return (1 - Math.abs(2 * normalizedDist - 1.3)) * 0.5;
}

/**
 * Écart signé vers l'image la plus proche sur un axe du monde torique
 * (un écart exactement égal à la moitié du monde n'est pas replié).
 */
export function nearestImageDelta(delta: number, size: number): number {
  let wrapped = delta;
  if (wrapped > size / 2) wrapped -= size;
  if (wrapped < -size / 2) wrapped += size;
  return wrapped;
}

/**
 * Force exercée par `other` sur `particle`, ou null si la paire est ignorée
 * (trop loin ou trop proche).
 */
export function pairForce(
  particle: Particle,
  other: Particle,
  attractions: AttractionMatrix,
  config: SimulationConfig,
): Force | null {
  const dx = nearestImageDelta(other.x - particle.x, config.width);
  const dy = nearestImageDelta(other.y - particle.y, config.height);
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist > config.interactionRadius || dist < MIN_DISTANCE) return null;

  const attraction = attractions[particle.group][other.group];
  const normalizedDist = dist / config.interactionRadius;
  const magnitude = forceFunction(normalizedDist) * attraction * config.forceStrength;

  return { fx: (dx / dist) * magnitude, fy: (dy / dist) * magnitude };
}

/**
 * Somme, dans l'ordre des particules, les forces subies par `particles[index]`.
 */
export function totalForce(
  particles: readonly Particle[],
  index: number,
  attractions: AttractionMatrix,
  config: SimulationConfig,
): Force {
  const particle = particles[index];
  let fx = 0;
  let fy = 0;

  for (let j = 0; j < particles.length; j++) {
    if (j === index) continue;
    const force = pairForce(particle, particles[j], attractions, config);
    if (force) {
      fx += force.fx;
      fy += force.fy;
    }
  }

  return { fx, fy };
}

/**
 * Replie une coordonnée dans [0, size[ : un seul tour de monde est corrigé.
 */
export function wrapCoordinate(value: number, size: number): number {
  let wrapped = value;
  if (wrapped < 0) wrapped += size;
  if (wrapped >= size) wrapped -= size;
  return wrapped;
}
