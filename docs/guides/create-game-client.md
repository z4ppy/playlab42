# Créer un Client de Jeu

Ce guide vous accompagne dans la création d'une interface utilisateur pour un jeu Playlab42.

## Objectif

Créer un client de jeu qui :
- Affiche l'état du jeu de manière visuelle
- Gère les interactions utilisateur
- Communique avec le moteur de jeu
- Intègre les bots pour le mode solo

## Prérequis

- [Guide Architecture](architecture.md) lu
- [Guide Créer un moteur](create-game-engine.md) lu
- Un moteur de jeu fonctionnel

## Structure d'un client

```
games/mon-jeu/
├── index.html     # Client (interface)
├── engine.js      # Moteur (logique)
├── bots/          # Bots disponibles
│   └── random.js
└── game.json      # Manifest
```

## Étapes

### 1. Structure HTML de base

```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mon Jeu - Playlab42</title>
  <link rel="stylesheet" href="/lib/theme.css">
  <style>
    /* Vos styles - utilisez les variables CSS */
    body {
      font-family: var(--font-family);
      background: var(--color-bg);
      color: var(--color-text);
      transition: background-color var(--transition-normal);
    }
  </style>
  <script type="module">
    import { initTheme } from '/lib/theme.js';
    initTheme();
  </script>
</head>
<body>
  <!-- Écran de configuration -->
  <div class="config-screen" id="config-screen">
    <h1>Mon Jeu</h1>
    <!-- Options -->
    <button id="btn-start">Jouer</button>
  </div>

  <!-- Écran de jeu -->
  <div class="game-screen" id="game-screen">
    <div class="status" id="status"></div>
    <div class="board" id="board"></div>
    <div class="controls">
      <button id="btn-restart">Rejouer</button>
      <button id="btn-menu">Menu</button>
    </div>
  </div>

  <script type="module">
    import { $, $$, on } from '/lib/dom.js';
    // Code du client
  </script>
</body>
</html>
```

### 2. Utiliser le système de thèmes

Importez `lib/theme.css` pour avoir accès aux variables de design. Les thèmes dark/light sont gérés automatiquement.

```css
/* Variables principales disponibles */
--color-bg              /* Fond principal */
--color-bg-secondary    /* Fond secondaire */
--color-bg-card         /* Fond des cartes */
--color-text            /* Texte principal */
--color-accent          /* Couleur d'accent */
--color-success         /* Succès (victoire) */
--color-error           /* Erreur (défaite) */
--color-player-x        /* Couleur joueur X */
--color-player-o        /* Couleur joueur O */
--color-win             /* Couleur ligne gagnante */
```

### 3. Importer les dépendances

```javascript
import { $, $$, on } from '/lib/dom.js';
import { MonJeuEngine } from './engine.js';
import { SeededRandom } from '/lib/seeded-random.js';
import { RandomBot } from './bots/random.js';
```

### 4. Gérer l'état du client

```javascript
// État du client
let engine = new MonJeuEngine();
let state = null;
let rng = null;
let bot = null;
let isVsBot = true;
let humanId = 'human';
let opponentId = 'opponent';

// Éléments DOM
const configScreen = document.getElementById('config-screen');
const gameScreen = document.getElementById('game-screen');
const statusEl = document.getElementById('status');
const boardEl = document.getElementById('board');
```

### 5. Démarrer une partie

```javascript
function startGame() {
  // Créer le générateur aléatoire
  rng = new SeededRandom(Date.now());

  // Créer le bot si nécessaire
  const opponentType = document.getElementById('opponent').value;
  isVsBot = opponentType !== 'human';
  bot = isVsBot ? createBot(opponentType) : null;

  // Initialiser le moteur
  state = engine.init({
    seed: rng.getState(),
    playerIds: [humanId, opponentId],
  });

  // Notifier le bot
  if (bot && bot.onGameStart) {
    bot.onGameStart(opponentId, state);
  }

  // Afficher l'écran de jeu
  configScreen.classList.add('hidden');
  gameScreen.classList.add('active');

  // Premier rendu
  render();

  // Si le bot commence
  if (state.currentPlayerId === opponentId && isVsBot) {
    setTimeout(playBot, 500);
  }
}
```

### 6. Afficher l'état (render)

```javascript
function render() {
  // Mettre à jour l'interface avec l'état actuel
  renderBoard();
  renderStatus();
}

function renderBoard() {
  // Exemple pour une grille
  const cells = document.querySelectorAll('.cell');
  cells.forEach((cell, i) => {
    const value = state.board[i];
    cell.textContent = value || '';
    cell.className = 'cell';
    if (value) cell.classList.add('taken');
    if (state.gameOver) cell.classList.add('game-over');
  });
}

function renderStatus() {
  if (state.gameOver) {
    if (state.winners?.includes(humanId)) {
      statusEl.textContent = 'Vous avez gagné !';
    } else if (state.winners) {
      statusEl.textContent = 'Vous avez perdu';
    } else {
      statusEl.textContent = 'Match nul';
    }
  } else {
    const isMyTurn = state.currentPlayerId === humanId;
    statusEl.textContent = isMyTurn ? 'À vous' : 'Tour adverse...';
  }
}
```

### 7. Gérer les actions du joueur

```javascript
function handlePlayerAction(actionData) {
  // Vérifier que c'est notre tour
  if (state.gameOver) return;
  if (isVsBot && state.currentPlayerId !== humanId) return;

  const currentPlayer = state.currentPlayerId;
  const action = { type: 'play', ...actionData };

  // Valider l'action
  if (!engine.isValidAction(state, action, currentPlayer)) {
    console.warn('Action invalide');
    return;
  }

  // Appliquer l'action
  state = engine.applyAction(state, action, currentPlayer);
  render();

  // Si partie terminée
  if (state.gameOver) {
    onGameEnd();
    return;
  }

  // Tour du bot
  if (isVsBot && state.currentPlayerId === opponentId) {
    setTimeout(playBot, 500);
  }
}
```

### 8. Faire jouer le bot

```javascript
function playBot() {
  if (state.gameOver) return;
  if (state.currentPlayerId !== opponentId) return;

  // Obtenir la vue du bot
  const view = engine.getPlayerView(state, opponentId);
  const validActions = engine.getValidActions(state, opponentId);

  if (validActions.length === 0) return;

  // Demander au bot de choisir
  const action = bot.chooseAction(view, validActions, rng);

  // Appliquer l'action
  state = engine.applyAction(state, action, opponentId);
  render();

  if (state.gameOver) {
    onGameEnd();
  }
}
```

### 9. Event Listeners

```javascript
// Boutons
document.getElementById('btn-start').addEventListener('click', startGame);
document.getElementById('btn-restart').addEventListener('click', restart);
document.getElementById('btn-menu').addEventListener('click', backToMenu);

// Interactions plateau
boardEl.addEventListener('click', (e) => {
  const cell = e.target.closest('.cell');
  if (!cell) return;
  const index = parseInt(cell.dataset.index);
  handlePlayerAction({ position: index });
});

// Raccourcis clavier
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') backToMenu();
  if (e.key === 'r') restart();
});
```

## Exemple complet : Deviner le nombre

Un jeu simple où il faut deviner un nombre entre 1 et 100.

### `games/guess-number/engine.js`

```javascript
export class GuessNumberEngine {
  init(config) {
    // Utiliser le seed pour générer le nombre secret
    const secretNumber = (config.seed % 100) + 1;

    return {
      secretNumber,
      guesses: [],
      maxGuesses: 7,
      currentPlayerId: config.playerIds[0],
      gameOver: false,
      winners: null,
      turn: 1,
      rngState: config.seed,
      playerIds: config.playerIds,
    };
  }

  applyAction(state, action, playerId) {
    if (!this.isValidAction(state, action, playerId)) {
      throw new Error('Invalid action');
    }

    const guess = action.number;
    const newGuesses = [...state.guesses, {
      number: guess,
      hint: guess < state.secretNumber ? 'higher'
          : guess > state.secretNumber ? 'lower'
          : 'correct',
    }];

    const newState = {
      ...state,
      guesses: newGuesses,
      turn: state.turn + 1,
    };

    // Gagné ?
    if (guess === state.secretNumber) {
      newState.gameOver = true;
      newState.winners = [playerId];
    }
    // Perdu ?
    else if (newGuesses.length >= state.maxGuesses) {
      newState.gameOver = true;
      newState.winners = null;
    }

    return newState;
  }

  isValidAction(state, action, playerId) {
    return (
      !state.gameOver &&
      state.currentPlayerId === playerId &&
      action.type === 'guess' &&
      action.number >= 1 &&
      action.number <= 100
    );
  }

  getValidActions(state, playerId) {
    if (state.gameOver || state.currentPlayerId !== playerId) {
      return [];
    }
    // 100 actions possibles (1-100)
    return Array.from({ length: 100 }, (_, i) => ({
      type: 'guess',
      number: i + 1,
    }));
  }

  getPlayerView(state, _playerId) {
    // Cacher le nombre secret
    return {
      ...state,
      secretNumber: undefined,
    };
  }

  isGameOver(state) {
    return state.gameOver;
  }

  getWinners(state) {
    return state.winners;
  }

  getCurrentPlayer(state) {
    return state.currentPlayerId;
  }
}
```

### `games/guess-number/index.html`

```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Deviner le nombre - Playlab42</title>
  <style>
    :root {
      --bg: #1a1a2e;
      --bg-secondary: #16213e;
      --text: #eee;
      --text-muted: #888;
      --accent: #e94560;
      --accent-hover: #ff6b6b;
      --success: #4ade80;
      --error: #ef4444;
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: system-ui, sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 1rem;
    }

    .container {
      background: var(--bg-secondary);
      padding: 2rem;
      border-radius: 12px;
      max-width: 400px;
      width: 100%;
      text-align: center;
    }

    h1 { margin-bottom: 1rem; }

    .info {
      color: var(--text-muted);
      margin-bottom: 1.5rem;
    }

    .input-group {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 1rem;
    }

    input[type="number"] {
      flex: 1;
      padding: 0.75rem;
      background: var(--bg);
      border: 1px solid #333;
      border-radius: 8px;
      color: var(--text);
      font-size: 1.25rem;
      text-align: center;
    }

    input:focus {
      outline: none;
      border-color: var(--accent);
    }

    .btn {
      padding: 0.75rem 1.5rem;
      background: var(--accent);
      border: none;
      border-radius: 8px;
      color: white;
      font-size: 1rem;
      cursor: pointer;
    }

    .btn:hover { background: var(--accent-hover); }

    .guesses {
      margin: 1.5rem 0;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .guess {
      padding: 0.5rem 1rem;
      background: var(--bg);
      border-radius: 4px;
      display: flex;
      justify-content: space-between;
    }

    .guess.correct { background: rgba(74, 222, 128, 0.2); color: var(--success); }
    .hint { font-size: 0.875rem; }
    .hint.higher { color: #f4b752; }
    .hint.lower { color: #4fc3f7; }

    .result {
      font-size: 1.5rem;
      margin: 1rem 0;
    }

    .result.win { color: var(--success); }
    .result.lose { color: var(--error); }

    .hidden { display: none; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔢 Deviner le nombre</h1>
    <p class="info">Trouvez le nombre entre 1 et 100</p>

    <div id="game-area">
      <div class="input-group">
        <input type="number" id="guess-input" min="1" max="100" placeholder="?">
        <button class="btn" id="btn-guess">Deviner</button>
      </div>

      <p id="remaining">7 essais restants</p>

      <div class="guesses" id="guesses"></div>
    </div>

    <div id="result-area" class="hidden">
      <p class="result" id="result"></p>
      <p id="answer"></p>
      <button class="btn" id="btn-restart">Rejouer</button>
    </div>
  </div>

  <script type="module">
    import { GuessNumberEngine } from './engine.js';

    const engine = new GuessNumberEngine();
    let state = null;
    const humanId = 'player1';

    // Éléments
    const guessInput = document.getElementById('guess-input');
    const btnGuess = document.getElementById('btn-guess');
    const guessesEl = document.getElementById('guesses');
    const remainingEl = document.getElementById('remaining');
    const gameArea = document.getElementById('game-area');
    const resultArea = document.getElementById('result-area');
    const resultEl = document.getElementById('result');
    const answerEl = document.getElementById('answer');

    function startGame() {
      state = engine.init({
        seed: Date.now(),
        playerIds: [humanId],
      });

      guessesEl.innerHTML = '';
      guessInput.value = '';
      gameArea.classList.remove('hidden');
      resultArea.classList.add('hidden');
      updateRemaining();
      guessInput.focus();
    }

    function updateRemaining() {
      const left = state.maxGuesses - state.guesses.length;
      remainingEl.textContent = `${left} essai${left > 1 ? 's' : ''} restant${left > 1 ? 's' : ''}`;
    }

    function makeGuess() {
      const num = parseInt(guessInput.value);
      if (isNaN(num) || num < 1 || num > 100) {
        guessInput.classList.add('error');
        return;
      }

      const action = { type: 'guess', number: num };
      if (!engine.isValidAction(state, action, humanId)) return;

      state = engine.applyAction(state, action, humanId);

      // Afficher le résultat
      const lastGuess = state.guesses[state.guesses.length - 1];
      const guessEl = document.createElement('div');
      guessEl.className = 'guess' + (lastGuess.hint === 'correct' ? ' correct' : '');
      guessEl.innerHTML = `
        <span>${lastGuess.number}</span>
        <span class="hint ${lastGuess.hint}">
          ${lastGuess.hint === 'higher' ? '⬆️ Plus grand'
          : lastGuess.hint === 'lower' ? '⬇️ Plus petit'
          : '✅ Correct !'}
        </span>
      `;
      guessesEl.appendChild(guessEl);

      guessInput.value = '';
      updateRemaining();

      if (state.gameOver) {
        showResult();
      } else {
        guessInput.focus();
      }
    }

    function showResult() {
      gameArea.classList.add('hidden');
      resultArea.classList.remove('hidden');

      if (state.winners) {
        resultEl.textContent = '🎉 Bravo !';
        resultEl.className = 'result win';
        answerEl.textContent = `Trouvé en ${state.guesses.length} essai${state.guesses.length > 1 ? 's' : ''}`;
      } else {
        resultEl.textContent = '😔 Perdu !';
        resultEl.className = 'result lose';
        answerEl.textContent = `Le nombre était ${state.secretNumber}`;
      }
    }

    // Events
    btnGuess.addEventListener('click', makeGuess);
    guessInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') makeGuess();
    });
    document.getElementById('btn-restart').addEventListener('click', startGame);

    // Démarrer
    startGame();
  </script>
</body>
</html>
```

## Bonnes pratiques

### Architecture

1. **Séparer les responsabilités** : Le client ne contient que l'affichage et les événements, jamais la logique de jeu
2. **Un seul état** : `state` est la source de vérité, toujours obtenu via le moteur
3. **Render explicite** : Appeler `render()` après chaque changement d'état

### UX

1. **Feedback immédiat** : L'interface réagit instantanément aux clics
2. **États visuels** : Hover, disabled, loading clairement indiqués
3. **Messages clairs** : "À vous", "Tour adverse", "Vous avez gagné"

### Performance

1. **Délai pour le bot** : `setTimeout(playBot, 500)` pour que l'utilisateur voie le jeu
2. **Pas de re-render inutile** : Ne mettre à jour que ce qui change
3. **Event delegation** : Un seul listener sur le conteneur plutôt que sur chaque élément

### Accessibilité

1. **Boutons sémantiques** : `<button>` plutôt que `<div onclick>`
2. **Labels** : `aria-label` sur les boutons sans texte
3. **Focus** : `tabindex` et gestion du focus clavier

## Checklist

- [ ] Écran de configuration avec options
- [ ] Écran de jeu avec plateau et statut
- [ ] Import du moteur et des bots
- [ ] Fonction `startGame()` initialise correctement
- [ ] Fonction `render()` affiche l'état complet
- [ ] Les clics déclenchent `handlePlayerAction()`
- [ ] Le bot joue avec délai visible
- [ ] Fin de partie affichée clairement
- [ ] Boutons Rejouer et Menu fonctionnels
- [ ] Raccourcis clavier (Escape, R)

## Voir aussi

- [Architecture](architecture.md) - Vue d'ensemble
- [Créer un moteur](create-game-engine.md) - Logique de jeu
- [Créer un bot](create-bot.md) - Intelligence artificielle
- [Tic-Tac-Toe](../../games/tictactoe/index.html) - Exemple complet
