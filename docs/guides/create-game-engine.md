# Créer un Moteur de Jeu

Ce guide vous accompagne dans la création d'un moteur de jeu isomorphe pour Playlab42.

## Objectif

Créer un moteur de jeu qui :
- Fonctionne **client ET serveur** (isomorphe)
- Produit des résultats **déterministes** (rejouable)
- N'a **aucun effet de bord** (fonction pure)
- A un état **100% sérialisable** (JSON)

## Prérequis

- JavaScript ES modules
- Compréhension des objets et fonctions pures
- [Guide Architecture](architecture.md) lu

## Interface GameEngine

Tous les moteurs implémentent cette interface :

```javascript
class GameEngine {
  // Initialise une nouvelle partie
  init(config) → state

  // Applique une action et retourne le nouvel état
  applyAction(state, action, playerId) → newState

  // Vérifie si une action est valide
  isValidAction(state, action, playerId) → boolean

  // Retourne les actions valides pour un joueur
  getValidActions(state, playerId) → actions[]

  // Retourne la vue d'un joueur (fog of war)
  getPlayerView(state, playerId) → playerView

  // Vérifie si la partie est terminée
  isGameOver(state) → boolean

  // Retourne le(s) gagnant(s)
  getWinners(state) → string[] | null

  // Retourne le joueur actif
  getCurrentPlayer(state) → string
}
```

## Étapes

### 1. Définir les types

Commencez par définir la structure de votre jeu :

```javascript
/**
 * @typedef {Object} MyGameState
 * @property {any} board - Plateau de jeu
 * @property {string} currentPlayerId - Joueur actif
 * @property {boolean} gameOver - Partie terminée ?
 * @property {string[]|null} winners - Gagnant(s)
 * @property {number} turn - Numéro du tour
 * @property {number} rngState - État du RNG
 * @property {string[]} playerIds - Liste des joueurs
 */

/**
 * @typedef {Object} MyGameAction
 * @property {string} type - Type d'action
 * @property {any} data - Données de l'action
 */

/**
 * @typedef {Object} MyGameConfig
 * @property {number} seed - Seed pour l'aléatoire
 * @property {string[]} playerIds - IDs des joueurs
 */
```

### 2. Créer la classe du moteur

```javascript
export class MyGameEngine {
  /**
   * Initialise une nouvelle partie
   * @param {MyGameConfig} config
   * @returns {MyGameState}
   */
  init(config) {
    return {
      board: this.#createEmptyBoard(),
      currentPlayerId: config.playerIds[0],
      gameOver: false,
      winners: null,
      turn: 1,
      rngState: config.seed,
      playerIds: config.playerIds,
    };
  }

  /**
   * Applique une action
   * @param {MyGameState} state
   * @param {MyGameAction} action
   * @param {string} playerId
   * @returns {MyGameState}
   */
  applyAction(state, action, playerId) {
    // 1. Valider l'action
    if (!this.isValidAction(state, action, playerId)) {
      throw new Error('Invalid action');
    }

    // 2. Copier l'état (IMMUTABILITÉ)
    const newState = {
      ...state,
      board: [...state.board], // Copie profonde si nécessaire
      turn: state.turn + 1,
    };

    // 3. Appliquer l'action
    // ... votre logique ici ...

    // 4. Vérifier fin de partie
    if (this.#checkGameOver(newState)) {
      newState.gameOver = true;
      newState.winners = this.#determineWinners(newState);
    } else {
      // Passer au joueur suivant
      newState.currentPlayerId = this.#getNextPlayer(state);
    }

    return newState;
  }

  // ... autres méthodes
}
```

### 3. Implémenter les méthodes obligatoires

#### `isValidAction` - Validation

```javascript
isValidAction(state, action, playerId) {
  // Vérifications de base
  if (state.gameOver) return false;
  if (state.currentPlayerId !== playerId) return false;

  // Vérifications spécifiques au jeu
  // ...

  return true;
}
```

#### `getValidActions` - Actions possibles

```javascript
getValidActions(state, playerId) {
  if (state.gameOver || state.currentPlayerId !== playerId) {
    return [];
  }

  // Générer toutes les actions valides
  const actions = [];
  // ... votre logique ici ...
  return actions;
}
```

#### `getPlayerView` - Fog of War

```javascript
getPlayerView(state, playerId) {
  // Pour un jeu sans information cachée
  return state;

  // Pour un jeu avec fog of war (ex: cartes)
  return {
    ...state,
    hands: {
      [playerId]: state.hands[playerId],
      // Autres joueurs : cartes cachées
    },
  };
}
```

## Exemple complet : Pierre-Feuille-Ciseaux

Voici un jeu simple tour par tour.

### `games/rock-paper-scissors/engine.js`

```javascript
/**
 * Rock-Paper-Scissors Engine - Moteur isomorphe
 *
 * Règles :
 * - 2 joueurs
 * - Chaque joueur choisit pierre, feuille ou ciseaux
 * - Pierre > Ciseaux > Feuille > Pierre
 */

const CHOICES = ['rock', 'paper', 'scissors'];

const WINS_AGAINST = {
  rock: 'scissors',
  paper: 'rock',
  scissors: 'paper',
};

/**
 * @typedef {Object} RPSState
 * @property {{[playerId: string]: string|null}} choices - Choix des joueurs
 * @property {string|null} currentPlayerId - null car simultané
 * @property {boolean} gameOver
 * @property {string[]|null} winners
 * @property {number} turn
 * @property {number} rngState
 * @property {string[]} playerIds
 * @property {boolean} revealed - Choix révélés ?
 */

/**
 * @typedef {Object} RPSAction
 * @property {'choose'} type
 * @property {string} choice - 'rock', 'paper', ou 'scissors'
 */

/**
 * @typedef {Object} RPSConfig
 * @property {number} seed
 * @property {[string, string]} playerIds
 */

export class RockPaperScissorsEngine {
  /**
   * Initialise une nouvelle partie
   * @param {RPSConfig} config
   * @returns {RPSState}
   */
  init(config) {
    return {
      choices: {
        [config.playerIds[0]]: null,
        [config.playerIds[1]]: null,
      },
      currentPlayerId: null, // Jeu simultané
      gameOver: false,
      winners: null,
      turn: 1,
      rngState: config.seed,
      playerIds: config.playerIds,
      revealed: false,
    };
  }

  /**
   * Applique une action
   * @param {RPSState} state
   * @param {RPSAction} action
   * @param {string} playerId
   * @returns {RPSState}
   */
  applyAction(state, action, playerId) {
    if (!this.isValidAction(state, action, playerId)) {
      throw new Error('Invalid action');
    }

    // Copier l'état
    const newState = {
      ...state,
      choices: { ...state.choices },
    };

    // Enregistrer le choix
    newState.choices[playerId] = action.choice;

    // Vérifier si les deux joueurs ont choisi
    const allChosen = state.playerIds.every(
      (id) => newState.choices[id] !== null
    );

    if (allChosen) {
      newState.revealed = true;
      newState.gameOver = true;
      newState.winners = this.#determineWinner(newState);
    }

    return newState;
  }

  /**
   * Vérifie si une action est valide
   */
  isValidAction(state, action, playerId) {
    return (
      !state.gameOver &&
      state.playerIds.includes(playerId) &&
      state.choices[playerId] === null && // Pas encore choisi
      action.type === 'choose' &&
      CHOICES.includes(action.choice)
    );
  }

  /**
   * Retourne les actions valides
   */
  getValidActions(state, playerId) {
    if (state.gameOver || state.choices[playerId] !== null) {
      return [];
    }

    return CHOICES.map((choice) => ({
      type: 'choose',
      choice,
    }));
  }

  /**
   * Retourne la vue d'un joueur (cache le choix adverse)
   */
  getPlayerView(state, playerId) {
    if (state.revealed) {
      return state; // Tout visible après révélation
    }

    // Cacher le choix de l'adversaire
    const view = {
      ...state,
      choices: { ...state.choices },
    };

    for (const id of state.playerIds) {
      if (id !== playerId) {
        view.choices[id] = state.choices[id] ? 'hidden' : null;
      }
    }

    return view;
  }

  isGameOver(state) {
    return state.gameOver;
  }

  getWinners(state) {
    return state.winners;
  }

  getCurrentPlayer(state) {
    // Jeu simultané : tous peuvent jouer
    return null;
  }

  /**
   * Détermine le gagnant
   * @private
   */
  #determineWinner(state) {
    const [p1, p2] = state.playerIds;
    const c1 = state.choices[p1];
    const c2 = state.choices[p2];

    if (c1 === c2) {
      return null; // Égalité
    }

    if (WINS_AGAINST[c1] === c2) {
      return [p1]; // Joueur 1 gagne
    }

    return [p2]; // Joueur 2 gagne
  }
}

export default RockPaperScissorsEngine;
```

## Principes clés

### 1. Immutabilité

**Ne jamais modifier l'état directement.** Toujours retourner un nouvel objet.

```javascript
// ❌ MAL
applyAction(state, action, playerId) {
  state.board[0] = 'X'; // Mutation !
  return state;
}

// ✅ BIEN
applyAction(state, action, playerId) {
  const newBoard = [...state.board];
  newBoard[0] = 'X';
  return { ...state, board: newBoard };
}
```

### 2. Pas d'I/O

Le moteur ne doit **jamais** :
- Accéder au DOM (`document`, `window`)
- Faire des requêtes (`fetch`)
- Lire/écrire des fichiers
- Utiliser `Date.now()` dans la logique

### 3. Aléatoire déterministe

Utilisez **toujours** `SeededRandom` au lieu de `Math.random()` :

```javascript
import { SeededRandom } from '../../lib/seeded-random.js';

init(config) {
  const rng = new SeededRandom(config.seed);
  return {
    // ...
    deck: rng.shuffle([...CARDS]),
    rngState: rng.getState(),
  };
}
```

### 4. Sérialisation

L'état doit être 100% JSON :

```javascript
// ✅ OK : primitifs, objets, tableaux
const state = {
  board: [null, 'X', 'O'],
  players: ['p1', 'p2'],
  scores: { p1: 10, p2: 5 },
};

// ❌ INTERDIT : fonctions, classes, références circulaires
const badState = {
  callback: () => {},           // Fonction
  engine: this,                 // Référence
  date: new Date(),             // Instance de classe
};
```

## Tests

Créez un fichier de tests pour votre moteur :

```javascript
// games/rock-paper-scissors/engine.test.js
import { RockPaperScissorsEngine } from './engine.js';

describe('RockPaperScissorsEngine', () => {
  let engine;

  beforeEach(() => {
    engine = new RockPaperScissorsEngine();
  });

  describe('init', () => {
    it('should create initial state', () => {
      const state = engine.init({
        seed: 12345,
        playerIds: ['p1', 'p2'],
      });

      expect(state.choices.p1).toBeNull();
      expect(state.choices.p2).toBeNull();
      expect(state.gameOver).toBe(false);
    });
  });

  describe('applyAction', () => {
    it('should record player choice', () => {
      let state = engine.init({ seed: 1, playerIds: ['p1', 'p2'] });

      state = engine.applyAction(
        state,
        { type: 'choose', choice: 'rock' },
        'p1'
      );

      expect(state.choices.p1).toBe('rock');
      expect(state.gameOver).toBe(false);
    });

    it('should end game when both chose', () => {
      let state = engine.init({ seed: 1, playerIds: ['p1', 'p2'] });

      state = engine.applyAction(state, { type: 'choose', choice: 'rock' }, 'p1');
      state = engine.applyAction(state, { type: 'choose', choice: 'scissors' }, 'p2');

      expect(state.gameOver).toBe(true);
      expect(state.winners).toEqual(['p1']); // Rock > Scissors
    });
  });

  describe('getPlayerView', () => {
    it('should hide opponent choice before reveal', () => {
      let state = engine.init({ seed: 1, playerIds: ['p1', 'p2'] });
      state = engine.applyAction(state, { type: 'choose', choice: 'rock' }, 'p1');

      const view = engine.getPlayerView(state, 'p2');

      expect(view.choices.p1).toBe('hidden');
      expect(view.choices.p2).toBeNull();
    });
  });
});
```

Exécutez les tests :

```bash
make npm CMD="test games/rock-paper-scissors"
```

## Checklist

Avant de finaliser votre moteur :

- [ ] `init()` retourne un état valide
- [ ] `applyAction()` ne mute jamais l'état
- [ ] `isValidAction()` rejette les actions invalides
- [ ] `getValidActions()` liste toutes les actions possibles
- [ ] `getPlayerView()` cache les infos secrètes
- [ ] `isGameOver()` détecte la fin de partie
- [ ] `getWinners()` retourne le bon résultat
- [ ] L'état est 100% JSON sérialisable
- [ ] Pas de `Math.random()` (utiliser SeededRandom)
- [ ] Pas d'accès DOM ou I/O
- [ ] Tests unitaires écrits

## Voir aussi

- [Architecture](architecture.md) - Vue d'ensemble
- [Créer un client](create-game-client.md) - Interface utilisateur
- [Créer un bot](create-bot.md) - Intelligence artificielle
- [Spec GameEngine](../../openspec/specs/game-engine/spec.md) - Spécification complète
