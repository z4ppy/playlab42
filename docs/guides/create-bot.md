# Créer un Bot

Ce guide vous accompagne dans la création d'une intelligence artificielle (bot) pour un jeu Playlab42.

## Objectif

Créer un bot qui :
- Joue automatiquement à la place d'un humain
- Est **déterministe** (même situation = même choix)
- Est **isomorphe** (fonctionne client et serveur)
- Implémente une stratégie documentée

## Prérequis

- [Guide Créer un moteur](create-game-engine.md) lu
- Compréhension des règles du jeu ciblé
- Notion d'algorithmes de base

## Interface Bot

Tous les bots implémentent cette interface :

```javascript
class Bot {
  // Métadonnées
  name = 'MonBot';
  description = 'Description de la stratégie';
  difficulty = 'easy'; // 'easy', 'medium', 'hard', 'expert'

  // Méthode principale
  chooseAction(view, validActions, rng) → action

  // Optionnel
  onGameStart(playerId, config) { }
  onGameEnd(view, won) { }
}
```

### Paramètres de `chooseAction`

| Paramètre | Description |
|-----------|-------------|
| `view` | Vue du jeu (fog of war appliqué) |
| `validActions` | Liste des actions possibles |
| `rng` | Générateur aléatoire (`SeededRandom`) |

**Important** : Toujours utiliser `rng` pour l'aléatoire, jamais `Math.random()`.

## Étapes

### 1. Créer le fichier

```
games/mon-jeu/bots/
├── random.js     # Bot facile
├── smart.js      # Bot intermédiaire
└── perfect.js    # Bot expert
```

### 2. Structure de base

```javascript
/**
 * Mon Bot - Description
 * Stratégie : ...
 */

export class MonBot {
  name = 'MonBot';
  description = 'Description de la stratégie';
  difficulty = 'medium';

  // État interne (optionnel)
  #playerId = null;

  /**
   * Appelé au début de la partie
   */
  onGameStart(playerId, config) {
    this.#playerId = playerId;
  }

  /**
   * Choisit une action à jouer
   * @param {object} view - Vue du jeu
   * @param {Array} validActions - Actions possibles
   * @param {object} rng - Générateur aléatoire
   * @returns {object} Action choisie
   */
  chooseAction(view, validActions, rng) {
    // Votre stratégie ici
    return rng.pick(validActions);
  }
}

export default MonBot;
```

### 3. Déclarer dans game.json

```json
{
  "id": "mon-jeu",
  "bots": {
    "default": "Random",
    "available": [
      { "name": "Random", "file": "bots/random.js", "difficulty": "easy" },
      { "name": "MonBot", "file": "bots/smart.js", "difficulty": "medium" }
    ]
  }
}
```

## Types de bots

### Bot Random (Facile)

Le plus simple : choisit au hasard parmi les actions valides.

```javascript
export class RandomBot {
  name = 'Random';
  description = 'Joue au hasard';
  difficulty = 'easy';

  chooseAction(view, validActions, rng) {
    return rng.pick(validActions);
  }
}
```

**Quand l'utiliser :**
- Bot par défaut
- Baseline pour tester d'autres bots
- Jeux où aucune stratégie n'est nécessaire

### Bot Greedy (Intermédiaire)

Évalue chaque action et choisit la meilleure immédiatement.

```javascript
export class GreedyBot {
  name = 'Greedy';
  description = 'Choisit le meilleur coup immédiat';
  difficulty = 'medium';

  #playerId = null;

  onGameStart(playerId) {
    this.#playerId = playerId;
  }

  chooseAction(view, validActions, rng) {
    let bestScore = -Infinity;
    let bestActions = [];

    for (const action of validActions) {
      const score = this.evaluateAction(view, action);

      if (score > bestScore) {
        bestScore = score;
        bestActions = [action];
      } else if (score === bestScore) {
        bestActions.push(action);
      }
    }

    // En cas d'égalité, choisir au hasard (déterministe)
    return rng.pick(bestActions);
  }

  /**
   * Évalue une action (à implémenter)
   * Score plus élevé = meilleur
   */
  evaluateAction(view, action) {
    // Votre heuristique ici
    return 0;
  }
}
```

**Quand l'utiliser :**
- Difficulté intermédiaire
- Quand on peut évaluer la qualité d'un coup
- Jeux où anticiper n'est pas crucial

### Bot Minimax (Expert)

Anticipe les coups adverses pour trouver le meilleur coup.

```javascript
export class MinimaxBot {
  name = 'Perfect';
  description = 'Anticipe les coups adverses (Minimax)';
  difficulty = 'expert';

  #engine = null;
  #playerId = null;
  #maxDepth = 5;

  constructor(engine, maxDepth = 5) {
    this.#engine = engine;
    this.#maxDepth = maxDepth;
  }

  onGameStart(playerId) {
    this.#playerId = playerId;
  }

  chooseAction(view, validActions, rng) {
    let bestAction = validActions[0];
    let bestScore = -Infinity;

    for (const action of validActions) {
      const newState = this.#engine.applyAction(view, action, this.#playerId);
      const score = this.#minimax(newState, this.#maxDepth - 1, false, -Infinity, Infinity);

      if (score > bestScore) {
        bestScore = score;
        bestAction = action;
      }
    }

    return bestAction;
  }

  #minimax(state, depth, isMaximizing, alpha, beta) {
    // Condition d'arrêt
    if (depth === 0 || this.#engine.isGameOver(state)) {
      return this.evaluateState(state);
    }

    const currentPlayer = this.#engine.getCurrentPlayer(state);
    const validActions = this.#engine.getValidActions(state, currentPlayer);

    if (isMaximizing) {
      let maxScore = -Infinity;
      for (const action of validActions) {
        const newState = this.#engine.applyAction(state, action, currentPlayer);
        const score = this.#minimax(newState, depth - 1, false, alpha, beta);
        maxScore = Math.max(maxScore, score);
        alpha = Math.max(alpha, score);
        if (beta <= alpha) break; // Élagage alpha-beta
      }
      return maxScore;
    } else {
      let minScore = Infinity;
      for (const action of validActions) {
        const newState = this.#engine.applyAction(state, action, currentPlayer);
        const score = this.#minimax(newState, depth - 1, true, alpha, beta);
        minScore = Math.min(minScore, score);
        beta = Math.min(beta, score);
        if (beta <= alpha) break; // Élagage alpha-beta
      }
      return minScore;
    }
  }

  /**
   * Évalue un état (à implémenter)
   * Score positif = favorable au bot
   */
  evaluateState(state) {
    if (!state.gameOver) return 0;
    if (state.winners === null) return 0; // Match nul
    return state.winners.includes(this.#playerId) ? 100 : -100;
  }
}
```

**Quand l'utiliser :**
- Jeux à 2 joueurs à information complète
- Quand on veut un bot imbattable
- Jeux avec peu de possibilités (comme Tic-Tac-Toe)

## Exemple complet : Bot Blocker pour Tic-Tac-Toe

Un bot qui bloque les alignements adverses.

```javascript
/**
 * Bot Blocker - Bloque les alignements adverses
 *
 * Stratégie :
 * 1. Gagner si possible
 * 2. Bloquer l'adversaire
 * 3. Prendre le centre
 * 4. Prendre un coin
 * 5. Jouer au hasard
 */

const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // Lignes
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // Colonnes
  [0, 4, 8], [2, 4, 6],             // Diagonales
];

export class BlockerBot {
  name = 'Blocker';
  description = 'Bloque les alignements adverses';
  difficulty = 'medium';

  #playerId = null;
  #mySymbol = null;
  #opponentSymbol = null;

  onGameStart(playerId) {
    this.#playerId = playerId;
  }

  chooseAction(view, validActions, rng) {
    const board = view.board;

    // Déterminer nos symboles
    this.#mySymbol = view.symbols[this.#playerId];
    this.#opponentSymbol = this.#mySymbol === 'X' ? 'O' : 'X';

    // 1. Gagner si possible
    const winMove = this.#findWinningMove(board, this.#mySymbol, validActions);
    if (winMove) return winMove;

    // 2. Bloquer l'adversaire
    const blockMove = this.#findWinningMove(board, this.#opponentSymbol, validActions);
    if (blockMove) return blockMove;

    // 3. Prendre le centre si libre
    const centerAction = validActions.find((a) => a.position === 4);
    if (centerAction) return centerAction;

    // 4. Prendre un coin si libre
    const corners = [0, 2, 6, 8];
    const cornerActions = validActions.filter((a) => corners.includes(a.position));
    if (cornerActions.length > 0) {
      return rng.pick(cornerActions);
    }

    // 5. Jouer au hasard
    return rng.pick(validActions);
  }

  /**
   * Trouve un coup gagnant (ou bloquant) pour un symbole
   */
  #findWinningMove(board, symbol, validActions) {
    for (const line of LINES) {
      const cells = line.map((i) => board[i]);
      const symbolCount = cells.filter((c) => c === symbol).length;
      const emptyCount = cells.filter((c) => c === null).length;

      // 2 symboles alignés + 1 case vide = coup critique
      if (symbolCount === 2 && emptyCount === 1) {
        const emptyIndex = line.find((i) => board[i] === null);
        const action = validActions.find((a) => a.position === emptyIndex);
        if (action) return action;
      }
    }
    return null;
  }
}

export default BlockerBot;
```

## Bonnes pratiques

### Déterminisme

```javascript
// ❌ MAL : Non déterministe
chooseAction(view, validActions, rng) {
  if (Math.random() > 0.5) {  // INTERDIT !
    return validActions[0];
  }
  return validActions[1];
}

// ✅ BIEN : Déterministe
chooseAction(view, validActions, rng) {
  if (rng.chance(0.5)) {  // Utilise le RNG fourni
    return validActions[0];
  }
  return validActions[1];
}
```

### Pas d'I/O

```javascript
// ❌ MAL : Accès externe
chooseAction(view, validActions, rng) {
  console.log('Bot réfléchit...');  // OK pour debug, mais pas en prod
  const advice = await fetch('/api/help');  // INTERDIT !
  return validActions[0];
}

// ✅ BIEN : Pur
chooseAction(view, validActions, rng) {
  // Calculs purs uniquement
  return this.#findBestMove(view, validActions, rng);
}
```

### Documentation

```javascript
/**
 * Bot Stratégique pour MonJeu
 *
 * Stratégie :
 * 1. Priorité aux coups offensifs
 * 2. Défense si menace détectée
 * 3. Position centrale préférée
 *
 * Faiblesses connues :
 * - Ne gère pas les pièges à 2 menaces
 */
export class StrategicBot {
  // ...
}
```

## Tests

Créez des tests pour valider votre bot :

```javascript
// games/mon-jeu/bots/smart.test.js
import { SmartBot } from './smart.js';
import { MonJeuEngine } from '../engine.js';
import { SeededRandom } from '/lib/seeded-random.js';

describe('SmartBot', () => {
  let bot;
  let engine;
  let rng;

  beforeEach(() => {
    bot = new SmartBot();
    engine = new MonJeuEngine();
    rng = new SeededRandom(12345);
  });

  it('should return valid action', () => {
    const state = engine.init({ seed: 1, playerIds: ['bot', 'human'] });
    bot.onGameStart('bot', state);

    const validActions = engine.getValidActions(state, 'bot');
    const action = bot.chooseAction(state, validActions, rng);

    expect(validActions).toContainEqual(action);
  });

  it('should be deterministic', () => {
    const state = engine.init({ seed: 1, playerIds: ['bot', 'human'] });
    bot.onGameStart('bot', state);

    const validActions = engine.getValidActions(state, 'bot');

    // Même seed = même action
    const rng1 = new SeededRandom(999);
    const rng2 = new SeededRandom(999);

    const action1 = bot.chooseAction(state, validActions, rng1);
    const action2 = bot.chooseAction(state, validActions, rng2);

    expect(action1).toEqual(action2);
  });

  it('should block winning move', () => {
    // Simuler une situation où l'adversaire va gagner
    let state = engine.init({ seed: 1, playerIds: ['bot', 'human'] });
    // ... mettre le jeu dans un état critique ...

    const validActions = engine.getValidActions(state, 'bot');
    const action = bot.chooseAction(state, validActions, rng);

    // Vérifier que le bot bloque
    expect(action.position).toBe(/* position bloquante */);
  });
});
```

## Checklist

Avant de finaliser votre bot :

- [ ] `name`, `description`, `difficulty` renseignés
- [ ] `chooseAction()` retourne toujours une action valide
- [ ] Utilise uniquement `rng` pour l'aléatoire
- [ ] Pas d'accès DOM, réseau ou fichiers
- [ ] Stratégie documentée en commentaires
- [ ] Déclaré dans `game.json`
- [ ] Tests unitaires écrits

## Voir aussi

- [Architecture](architecture.md) - Vue d'ensemble
- [Créer un moteur](create-game-engine.md) - Logique de jeu
- [Créer un client](create-game-client.md) - Interface utilisateur
- [Spec Bot](../../openspec/specs/bot/spec.md) - Spécification complète
- [Bots Tic-Tac-Toe](../../games/tictactoe/bots/) - Exemples réels
