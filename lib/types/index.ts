/**
 * Types partagés pour Playlab42
 *
 * Ce fichier exporte les types communs utilisés par les tools, games et epics.
 * @module lib/types
 */

// === Types de base ===

/**
 * Identifiant unique d'un joueur
 */
export type PlayerId = string;

/**
 * Seed pour le générateur aléatoire déterministe
 */
export type Seed = number;

/**
 * Vecteur 2D pour les positions et vitesses
 */
export interface Vector2D {
  x: number;
  y: number;
}

/**
 * Couleur RGB normalisée (0-1)
 */
export interface Color {
  r: number;
  g: number;
  b: number;
}

// === Réexport des types de modules ===

export type {
  BaseGameConfig,
  BaseGameState,
  GameEngine,
  RealTimeGameState,
  RealTimeGameEngine,
  Bot,
} from './game-engine.js';
