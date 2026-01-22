/**
 * Types pour le simulateur Particle Life
 *
 * @module tools/particle-life/types
 */

/**
 * Représente une particule dans la simulation
 */
export interface Particle {
  /** Position X */
  x: number;
  /** Position Y */
  y: number;
  /** Vitesse X */
  vx: number;
  /** Vitesse Y */
  vy: number;
  /** Index du groupe de couleur (0-N) */
  group: number;
}

/**
 * Couleur HSL pour l'affichage
 */
export interface HSLColor {
  h: number; // 0-360
  s: number; // 0-100
  l: number; // 0-100
}

/**
 * Configuration de la simulation
 */
export interface SimulationConfig {
  /** Nombre de particules */
  particleCount: number;
  /** Nombre de groupes de couleurs */
  groupCount: number;
  /** Rayon d'interaction maximum */
  interactionRadius: number;
  /** Coefficient de friction (0-1) */
  friction: number;
  /** Force maximale d'attraction/répulsion */
  forceStrength: number;
  /** Largeur du monde */
  width: number;
  /** Hauteur du monde */
  height: number;
}

/**
 * Matrice d'interactions entre groupes
 * attraction[i][j] = force du groupe i vers le groupe j
 * Positif = attraction, Négatif = répulsion
 */
export type AttractionMatrix = number[][];

/**
 * État complet de la simulation
 */
export interface SimulationState {
  /** Liste des particules */
  particles: Particle[];
  /** Matrice d'attractions entre groupes */
  attractions: AttractionMatrix;
  /** Configuration active */
  config: SimulationConfig;
  /** Temps écoulé (ticks) */
  tick: number;
}

/**
 * Statistiques de la simulation
 */
export interface SimulationStats {
  /** Énergie cinétique totale */
  kineticEnergy: number;
  /** Vitesse moyenne */
  averageSpeed: number;
  /** Nombre de particules par groupe */
  groupCounts: number[];
}

/**
 * Configuration du rendu
 */
export interface RenderConfig {
  /** Rayon des particules (pixels) */
  particleRadius: number;
  /** Afficher les traînées */
  showTrails: boolean;
  /** Opacité des traînées (0-1) */
  trailOpacity: number;
  /** Couleurs des groupes */
  colors: HSLColor[];
}

/**
 * Configuration par défaut de la simulation
 */
export const DEFAULT_CONFIG: SimulationConfig = {
  particleCount: 500,
  groupCount: 4,
  interactionRadius: 80,
  friction: 0.05,
  forceStrength: 1,
  width: 800,
  height: 600,
};

/**
 * Configuration par défaut du rendu
 */
export const DEFAULT_RENDER_CONFIG: RenderConfig = {
  particleRadius: 3,
  showTrails: true,
  trailOpacity: 0.1,
  colors: [
    { h: 0, s: 80, l: 60 },     // Rouge
    { h: 120, s: 80, l: 50 },   // Vert
    { h: 220, s: 80, l: 60 },   // Bleu
    { h: 50, s: 90, l: 55 },    // Jaune
    { h: 280, s: 70, l: 60 },   // Violet
    { h: 180, s: 70, l: 50 },   // Cyan
  ],
};
