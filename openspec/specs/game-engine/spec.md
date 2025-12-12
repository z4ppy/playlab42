# GameEngine Specification

## Purpose

The GameEngine interface defines the contract that all game implementations must follow to ensure consistency, determinism, and cross-platform compatibility in the Playlab42 platform.

## Overview

Le GameEngine est l'interface abstraite que tous les moteurs de jeu doivent implémenter. Il garantit :

- **Isomorphisme** : Fonctionne client ET serveur
- **Déterminisme** : Même seed + mêmes actions = même résultat
- **Pureté** : Pas d'effets de bord, pas d'I/O
- **Sérialisation** : État 100% JSON

**Voir aussi** : [Bot Specification](../bot/spec.md) pour l'intégration des IA.
## Requirements
### Requirement: Isomorphism

The system SHALL run identically on client and server.

#### Scenario: Client execution
- **WHEN** the engine runs in a browser
- **THEN** it produces the expected game state

#### Scenario: Server execution
- **WHEN** the engine runs in Node.js
- **THEN** it produces the same state as in browser

### Requirement: Determinism

The system SHALL produce identical results for identical inputs.

#### Scenario: Replay
- **WHEN** a game is replayed with same seed and same actions
- **THEN** the final state is identical

### Requirement: Purity

The system SHALL not have side effects.

#### Scenario: No I/O
- **WHEN** the engine processes an action
- **THEN** it only modifies the returned state, no external I/O

#### Scenario: No DOM
- **WHEN** the engine is instantiated
- **THEN** it does not access `window`, `document`, or browser APIs

### Requirement: Serialization

The system SHALL have fully JSON-serializable state.

#### Scenario: Save state
- **WHEN** `JSON.stringify(state)` is called
- **THEN** it succeeds without errors

#### Scenario: Restore state
- **WHEN** `JSON.parse(serializedState)` is called
- **THEN** the engine can continue from that state

### Requirement: Player Views (Fog of War)

The system SHALL support partial information games.

#### Scenario: Hidden information
- **WHEN** a player requests their view
- **THEN** they only see information they should know

### Requirement: Bot Integration

The system SHALL support pluggable bots for non-human players.

#### Scenario: Solo game
- **WHEN** a multiplayer game is started with only one human
- **THEN** bots fill the remaining player slots

#### Scenario: Bot selection
- **WHEN** configuring a game
- **THEN** each slot can be set to human, bot (with choice), or disabled

See [Bot Specification](../bot/spec.md) for full details.

### Requirement: Checkers Game Rules

The system SHALL implement French Checkers (Dames) rules on a 10×10 board.

#### Scenario: Board initialization
- **GIVEN** a new checkers game is created
- **WHEN** the board is initialized
- **THEN** the board is 10×10 with 40 active squares (dark squares)
- **AND** 20 white pawns are placed on rows 0-3 (dark squares)
- **AND** 20 black pawns are placed on rows 6-9 (dark squares)
- **AND** white player starts

#### Scenario: Pawn movement
- **GIVEN** a pawn on the board
- **WHEN** the player moves the pawn
- **THEN** it moves diagonally forward by one square
- **AND** it moves only to dark squares

#### Scenario: Pawn capture
- **GIVEN** a pawn can jump over an opponent's piece
- **WHEN** the player performs a capture
- **THEN** the pawn jumps diagonally over the opponent
- **AND** the opponent's piece is removed
- **AND** the pawn lands on the square immediately after

#### Scenario: Multiple captures
- **GIVEN** a pawn has captured a piece
- **WHEN** another capture is possible from the new position
- **THEN** the pawn must continue capturing
- **AND** all intermediate pieces are removed

#### Scenario: Mandatory capture
- **GIVEN** a player has pieces that can capture
- **WHEN** it is the player's turn
- **THEN** the player must perform a capture
- **AND** non-capturing moves are illegal

#### Scenario: King promotion
- **GIVEN** a pawn reaches the opponent's back row
- **WHEN** the move is completed
- **THEN** the pawn is promoted to a king (dame)

#### Scenario: King movement
- **GIVEN** a king on the board
- **WHEN** the king moves
- **THEN** it can move diagonally any number of squares
- **AND** it moves only to unoccupied dark squares

#### Scenario: King capture
- **GIVEN** a king can jump over an opponent's piece
- **WHEN** the king captures
- **THEN** it can land on any empty square beyond the captured piece
- **AND** the captured piece is removed

### Requirement: Game Termination

The system SHALL detect end-of-game conditions.

#### Scenario: Victory by elimination
- **GIVEN** a player has no pieces remaining
- **WHEN** the game state is evaluated
- **THEN** the game status is 'won'
- **AND** the opponent is declared winner

#### Scenario: Victory by stalemate
- **GIVEN** a player has pieces but no legal moves
- **WHEN** it is that player's turn
- **THEN** the game status is 'won'
- **AND** the opponent is declared winner

### Requirement: Move Validation

The system SHALL validate all moves according to checkers rules.

#### Scenario: Legal move validation
- **GIVEN** a player attempts a move
- **WHEN** the move is validated
- **THEN** it checks piece ownership
- **AND** it checks destination is valid
- **AND** it checks move follows piece movement rules
- **AND** it checks mandatory capture rule

#### Scenario: Illegal move rejection
- **GIVEN** a player attempts an illegal move
- **WHEN** the move is processed
- **THEN** the move is rejected
- **AND** the game state is unchanged
- **AND** it remains the same player's turn

### Requirement: Deterministic Gameplay

The system SHALL support deterministic replay of checkers games.

#### Scenario: Seeded game initialization
- **GIVEN** a seed value is provided
- **WHEN** a game is initialized with that seed
- **THEN** any random elements use the seed
- **AND** the same seed produces identical initial state

#### Scenario: Replay consistency
- **GIVEN** a recorded sequence of moves with a seed
- **WHEN** the game is replayed with the same seed and moves
- **THEN** the final state is identical
- **AND** all intermediate states are identical

## Interface

```typescript
/**
 * Interface générique pour tous les moteurs de jeu.
 *
 * @typeParam TState - Type de l'état complet du jeu
 * @typeParam TAction - Type des actions jouables
 * @typeParam TPlayerView - Type de la vue d'un joueur (fog of war)
 * @typeParam TConfig - Type de la configuration de partie
 */
interface GameEngine<TState, TAction, TPlayerView, TConfig> {
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
  applyAction(state: TState, action: TAction, playerId: string): TState;

  /**
   * Vérifie si une action est valide.
   *
   * @param state - État actuel
   * @param action - Action à valider
   * @param playerId - ID du joueur qui veut jouer
   * @returns true si l'action est valide
   */
  isValidAction(state: TState, action: TAction, playerId: string): boolean;

  /**
   * Retourne les actions valides pour un joueur.
   *
   * @param state - État actuel
   * @param playerId - ID du joueur
   * @returns Liste des actions possibles
   */
  getValidActions(state: TState, playerId: string): TAction[];

  /**
   * Retourne la vue d'un joueur (fog of war).
   * Cache les informations que le joueur ne doit pas voir.
   *
   * @param state - État complet
   * @param playerId - ID du joueur
   * @returns Vue partielle pour ce joueur
   */
  getPlayerView(state: TState, playerId: string): TPlayerView;

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
  getWinners(state: TState): string[] | null;

  /**
   * Retourne l'ID du joueur dont c'est le tour.
   * Pour les jeux temps réel, peut retourner null ou tous les joueurs.
   *
   * @param state - État actuel
   * @returns ID du joueur actif, ou null si tous peuvent jouer
   */
  getCurrentPlayer(state: TState): string | null;

  /**
   * Retourne les scores actuels (optionnel).
   *
   * @param state - État actuel
   * @returns Map playerId -> score
   */
  getScores?(state: TState): Record<string, number>;
}
```

## Types de Base

```typescript
/**
 * Configuration de base pour tous les jeux.
 */
interface BaseGameConfig {
  /** Seed pour le générateur aléatoire */
  seed: number;

  /** Liste des IDs des joueurs */
  playerIds: string[];

  /** Options spécifiques au jeu */
  options?: Record<string, unknown>;
}

/**
 * État de base pour tous les jeux.
 */
interface BaseGameState {
  /** État du générateur aléatoire (pour replay) */
  rngState: number;

  /** ID du joueur actif (null si tous peuvent jouer) */
  currentPlayerId: string | null;

  /** La partie est-elle terminée ? */
  gameOver: boolean;

  /** ID(s) du/des gagnant(s) (si gameOver) */
  winners: string[] | null;

  /** Numéro du tour actuel */
  turn: number;
}
```

## Gestion des Tours

### Tour par tour

Pour les jeux tour par tour (Tic-Tac-Toe, Échecs, Puissance 4) :

```typescript
interface TurnBasedState extends BaseGameState {
  currentPlayerId: string; // Toujours défini
}

// Dans applyAction :
applyAction(state: TState, action: TAction, playerId: string): TState {
  // Vérifier que c'est bien le tour du joueur
  if (state.currentPlayerId !== playerId) {
    throw new Error(`Not ${playerId}'s turn`);
  }

  // Appliquer l'action...
  const newState = { ...state };

  // Passer au joueur suivant
  newState.currentPlayerId = this.getNextPlayer(state, playerId);
  newState.turn++;

  return newState;
}
```

### Temps réel

Pour les jeux temps réel (Snake, Pong) :

```typescript
interface RealTimeState extends BaseGameState {
  currentPlayerId: null; // Tous jouent en même temps

  /** Actions bufferisées pour le prochain tick */
  pendingActions: Map<string, TAction>;

  /** Timestamp du dernier tick */
  lastTickTime: number;
}

// Méthode additionnelle pour les jeux temps réel
interface RealTimeEngine<TState, TAction, TPlayerView, TConfig>
  extends GameEngine<TState, TAction, TPlayerView, TConfig> {

  /**
   * Applique un tick de temps.
   * Traite toutes les actions bufferisées.
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
```

## Gestion du Timeout

Pour les jeux tour par tour avec timeout :

```typescript
interface TimeoutConfig {
  /** Temps par tour en ms (0 = pas de limite) */
  turnTimeout: number;

  /** Action par défaut si timeout */
  defaultAction: TAction | "skip" | "forfeit";
}

interface TimeoutState {
  /** Timestamp du début du tour */
  turnStartTime: number;
}

// Le serveur (ou client en solo) gère le timeout :
function checkTimeout(state: TimeoutState, config: TimeoutConfig): boolean {
  if (config.turnTimeout === 0) return false;
  return Date.now() - state.turnStartTime > config.turnTimeout;
}
```

## Example: Tic-Tac-Toe

```typescript
// Types
type Cell = "X" | "O" | null;
type Board = [Cell, Cell, Cell, Cell, Cell, Cell, Cell, Cell, Cell];

interface TicTacToeState extends BaseGameState {
  board: Board;
  currentPlayerId: string;
}

interface TicTacToeAction {
  type: "place";
  position: number; // 0-8
}

type TicTacToeView = TicTacToeState; // Pas de fog of war

interface TicTacToeConfig extends BaseGameConfig {
  playerIds: [string, string]; // Exactement 2 joueurs
}

// Implémentation
class TicTacToeEngine
  implements GameEngine<TicTacToeState, TicTacToeAction, TicTacToeView, TicTacToeConfig>
{
  init(config: TicTacToeConfig): TicTacToeState {
    return {
      board: [null, null, null, null, null, null, null, null, null],
      currentPlayerId: config.playerIds[0],
      gameOver: false,
      winners: null,
      turn: 1,
      rngState: config.seed,
    };
  }

  applyAction(
    state: TicTacToeState,
    action: TicTacToeAction,
    playerId: string
  ): TicTacToeState {
    if (!this.isValidAction(state, action, playerId)) {
      throw new Error("Invalid action");
    }

    const newBoard = [...state.board] as Board;
    newBoard[action.position] = playerId === state.currentPlayerId ? "X" : "O";

    const newState: TicTacToeState = {
      ...state,
      board: newBoard,
      currentPlayerId: this.getNextPlayer(state),
      turn: state.turn + 1,
    };

    // Vérifier fin de partie
    const winner = this.checkWinner(newBoard);
    if (winner) {
      newState.gameOver = true;
      newState.winners = [winner === "X" ? state.currentPlayerId : this.getNextPlayer(state)];
    } else if (newBoard.every((cell) => cell !== null)) {
      newState.gameOver = true;
      newState.winners = null; // Match nul
    }

    return newState;
  }

  isValidAction(
    state: TicTacToeState,
    action: TicTacToeAction,
    playerId: string
  ): boolean {
    return (
      !state.gameOver &&
      state.currentPlayerId === playerId &&
      action.type === "place" &&
      action.position >= 0 &&
      action.position <= 8 &&
      state.board[action.position] === null
    );
  }

  getValidActions(state: TicTacToeState, playerId: string): TicTacToeAction[] {
    if (state.gameOver || state.currentPlayerId !== playerId) {
      return [];
    }

    return state.board
      .map((cell, i) => (cell === null ? { type: "place" as const, position: i } : null))
      .filter((action): action is TicTacToeAction => action !== null);
  }

  getPlayerView(state: TicTacToeState, _playerId: string): TicTacToeView {
    // Pas de fog of war dans Tic-Tac-Toe
    return state;
  }

  isGameOver(state: TicTacToeState): boolean {
    return state.gameOver;
  }

  getWinners(state: TicTacToeState): string[] | null {
    return state.winners;
  }

  getCurrentPlayer(state: TicTacToeState): string {
    return state.currentPlayerId;
  }

  private getNextPlayer(state: TicTacToeState): string {
    // Alterner entre les 2 joueurs
    return state.currentPlayerId === "player1" ? "player2" : "player1";
  }

  private checkWinner(board: Board): Cell {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8], // Lignes
      [0, 3, 6], [1, 4, 7], [2, 5, 8], // Colonnes
      [0, 4, 8], [2, 4, 6],             // Diagonales
    ];

    for (const [a, b, c] of lines) {
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        return board[a];
      }
    }
    return null;
  }
}
```

## Bonnes Pratiques

### ✅ À faire

- Toujours utiliser `SeededRandom` pour l'aléatoire
- Retourner un nouvel objet dans `applyAction` (immutabilité)
- Valider les actions avant de les appliquer
- Documenter les règles du jeu dans le README
- Écrire des tests unitaires exhaustifs

### ❌ À éviter

- Ne jamais utiliser `Math.random()`
- Ne jamais muter l'état directement
- Ne jamais accéder au DOM ou aux APIs navigateur
- Ne jamais faire de `fetch` ou d'I/O
- Ne jamais stocker de fonctions dans l'état (non sérialisable)

## Tests

Chaque moteur de jeu doit avoir des tests couvrant :

1. **Initialisation** : `init()` retourne un état valide
2. **Actions valides** : Les actions légales sont acceptées
3. **Actions invalides** : Les actions illégales sont rejetées
4. **Fin de partie** : `isGameOver()` détecte correctement la fin
5. **Gagnants** : `getWinners()` retourne le bon résultat
6. **Déterminisme** : Même seed + actions = même état final
7. **Sérialisation** : L'état peut être JSON.stringify/parse
