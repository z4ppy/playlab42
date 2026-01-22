/**
 * Types pour les moteurs de jeu Playlab42
 *
 * Définit l'interface générique GameEngine et les types associés.
 * Tous les moteurs de jeux doivent implémenter cette interface.
 *
 * @see openspec/specs/game-engine/spec.md
 * @module lib/types/game-engine
 */

import type { PlayerId, Seed } from './index.js';

// === Configuration de base ===

/**
 * Configuration de base pour tous les jeux.
 * Les jeux peuvent étendre cette interface avec des options spécifiques.
 */
export interface BaseGameConfig {
  /** Seed pour le générateur aléatoire déterministe */
  seed: Seed;

  /** Liste des IDs des joueurs */
  playerIds: PlayerId[];

  /** Options spécifiques au jeu */
  options?: Record<string, unknown>;
}

// === État de base ===

/**
 * État de base pour tous les jeux.
 * Contient les propriétés communes à tous les états de jeu.
 */
export interface BaseGameState {
  /** État du générateur aléatoire (pour replay déterministe) */
  rngState: number;

  /** ID du joueur actif (null si tous peuvent jouer simultanément) */
  currentPlayerId: PlayerId | null;

  /** La partie est-elle terminée ? */
  gameOver: boolean;

  /** ID(s) du/des gagnant(s) (null si partie en cours ou match nul) */
  winners: PlayerId[] | null;

  /** Numéro du tour actuel */
  turn: number;
}

// === Interface principale ===

/**
 * Interface générique pour tous les moteurs de jeu.
 *
 * Garantit :
 * - **Isomorphisme** : Fonctionne client ET serveur
 * - **Déterminisme** : Même seed + mêmes actions = même résultat
 * - **Pureté** : Pas d'effets de bord, pas d'I/O
 * - **Sérialisation** : État 100% JSON
 *
 * @typeParam TState - Type de l'état complet du jeu
 * @typeParam TAction - Type des actions jouables
 * @typeParam TPlayerView - Type de la vue d'un joueur (fog of war)
 * @typeParam TConfig - Type de la configuration de partie
 *
 * @example
 * ```typescript
 * class TicTacToeEngine implements GameEngine<
 *   TicTacToeState,
 *   TicTacToeAction,
 *   TicTacToeView,
 *   TicTacToeConfig
 * > {
 *   // ... implémentation
 * }
 * ```
 */
export interface GameEngine<
  TState extends BaseGameState,
  TAction,
  TPlayerView,
  TConfig extends BaseGameConfig,
> {
  /**
   * Initialise une nouvelle partie.
   * @param config - Configuration de la partie (joueurs, seed, options)
   * @returns L'état initial du jeu
   */
  init(config: TConfig): TState;

  /**
   * Applique une action et retourne le nouvel état.
   * DOIT être une fonction pure (pas d'effets de bord).
   *
   * @param state - État actuel
   * @param action - Action à appliquer
   * @param playerId - ID du joueur qui joue
   * @returns Nouvel état après l'action
   * @throws Error si l'action est invalide
   */
  applyAction(state: TState, action: TAction, playerId: PlayerId): TState;

  /**
   * Vérifie si une action est valide.
   *
   * @param state - État actuel
   * @param action - Action à valider
   * @param playerId - ID du joueur qui veut jouer
   * @returns true si l'action est valide
   */
  isValidAction(state: TState, action: TAction, playerId: PlayerId): boolean;

  /**
   * Retourne les actions valides pour un joueur.
   *
   * @param state - État actuel
   * @param playerId - ID du joueur
   * @returns Liste des actions possibles
   */
  getValidActions(state: TState, playerId: PlayerId): TAction[];

  /**
   * Retourne la vue d'un joueur (fog of war).
   * Cache les informations que le joueur ne doit pas voir.
   *
   * @param state - État complet
   * @param playerId - ID du joueur
   * @returns Vue partielle pour ce joueur
   */
  getPlayerView(state: TState, playerId: PlayerId): TPlayerView;

  /**
   * Vérifie si la partie est terminée.
   *
   * @param state - État actuel
   * @returns true si la partie est finie
   */
  isGameOver(state: TState): boolean;

  /**
   * Retourne le(s) gagnant(s) ou null si match nul.
   * Ne doit être appelé que si isGameOver() est true.
   *
   * @param state - État final
   * @returns ID(s) du/des gagnant(s), ou null si nul
   */
  getWinners(state: TState): PlayerId[] | null;

  /**
   * Retourne l'ID du joueur dont c'est le tour.
   * Pour les jeux temps réel, peut retourner null.
   *
   * @param state - État actuel
   * @returns ID du joueur actif, ou null si tous peuvent jouer
   */
  getCurrentPlayer(state: TState): PlayerId | null;

  /**
   * Retourne les scores actuels (optionnel).
   *
   * @param state - État actuel
   * @returns Map playerId -> score
   */
  getScores?(state: TState): Record<PlayerId, number>;
}

// === Extensions pour jeux temps réel ===

/**
 * État étendu pour les jeux temps réel.
 */
export interface RealTimeGameState extends BaseGameState {
  /** Pas de tour unique en temps réel */
  currentPlayerId: null;

  /** Timestamp du dernier tick */
  lastTickTime: number;
}

/**
 * Interface étendue pour les moteurs de jeux temps réel.
 *
 * @typeParam TState - Type de l'état (doit étendre RealTimeGameState)
 * @typeParam TAction - Type des actions
 * @typeParam TPlayerView - Type de la vue joueur
 * @typeParam TConfig - Type de la configuration
 */
export interface RealTimeGameEngine<
  TState extends RealTimeGameState,
  TAction,
  TPlayerView,
  TConfig extends BaseGameConfig,
> extends GameEngine<TState, TAction, TPlayerView, TConfig> {
  /**
   * Applique un tick de temps.
   * Traite la physique, les mouvements, etc.
   *
   * @param state - État actuel
   * @param deltaTime - Temps écoulé depuis le dernier tick (ms)
   * @returns Nouvel état
   */
  tick(state: TState, deltaTime: number): TState;

  /**
   * Intervalle entre les ticks (ms).
   * Exemple : 16 pour 60 FPS, 100 pour 10 ticks/s
   */
  readonly tickInterval: number;
}

// === Types pour les Bots ===

/**
 * Interface pour les bots (IA) de jeu.
 *
 * Un bot reçoit la vue du joueur (pas l'état complet)
 * et retourne l'action à jouer.
 *
 * @typeParam TPlayerView - Type de la vue joueur
 * @typeParam TAction - Type des actions
 */
export interface Bot<TPlayerView, TAction> {
  /** Nom du bot (affiché dans l'UI) */
  readonly name: string;

  /** Description du bot */
  readonly description?: string;

  /** Niveau de difficulté (1-5) */
  readonly difficulty?: number;

  /**
   * Choisit une action à jouer.
   *
   * @param view - Vue du joueur (informations visibles)
   * @param validActions - Actions légales disponibles
   * @returns L'action choisie
   */
  chooseAction(view: TPlayerView, validActions: TAction[]): TAction;
}
