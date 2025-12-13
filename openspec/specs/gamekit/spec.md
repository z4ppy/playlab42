# GameKit Specification

## Overview

GameKit est le SDK standardisé pour les jeux Playlab42. Il fournit :

- Communication avec le portail (messages)
- Gestion des assets (images, sons, JSON)
- Persistence (scores, progression)
- Hooks de cycle de vie (pause, resume, dispose)

**Note** : GameKit est pour les jeux standalone HTML. Pour les moteurs de jeu isomorphes, voir [GameEngine Specification](../game-engine/spec.md).

## Requirements

### Requirement: Portal Communication

The system SHALL communicate with the portal via postMessage.

#### Scenario: Ready signal
- **WHEN** the game initializes with `GameKit.init()`
- **THEN** it sends a `ready` message to the portal

#### Scenario: Score reporting
- **WHEN** the game saves a score
- **THEN** it sends a `score` message to the portal

### Requirement: Asset Management

The system SHALL provide centralized asset loading.

#### Scenario: Preload assets
- **WHEN** the game calls `assets.preload(manifest)`
- **THEN** all listed assets are loaded with progress callback

#### Scenario: Asset cleanup
- **WHEN** `GameKit.dispose()` is called
- **THEN** all audio is stopped and assets are released

### Requirement: Lifecycle Hooks

The system SHALL support lifecycle hooks for pause/resume.

#### Scenario: Tab hidden
- **WHEN** the browser tab becomes hidden
- **THEN** `window.onGamePause` is called

#### Scenario: Sound preference
- **WHEN** the portal sends a sound preference change
- **THEN** `window.onSoundChange` is called with the new value

### Requirement: Persistence

The system SHALL provide localStorage helpers scoped by game.

#### Scenario: Save score
- **WHEN** `GameKit.saveScore(1500)` is called
- **THEN** the score is saved to `scores_{gameName}` with timestamp

#### Scenario: Load progress
- **WHEN** `GameKit.loadProgress()` is called
- **THEN** previously saved game data is returned

## Interface

### GameKit API

```typescript
const GameKit = {
  /** Game name (set during init) */
  gameName: string | null;

  /** Asset loader instance */
  assets: AssetLoader | null;

  // ─────────────────────────────────────
  // Initialization
  // ─────────────────────────────────────

  /**
   * Initialize GameKit for this game.
   * MUST be called before using other methods.
   *
   * @param name - Game identifier (matches manifest slug)
   */
  init(name: string): void;

  /**
   * Cleanup all resources.
   * Called automatically when portal sends 'unload'.
   */
  dispose(): void;

  // ─────────────────────────────────────
  // State
  // ─────────────────────────────────────

  /** Is the game currently paused? */
  isPaused(): boolean;

  /** Is sound enabled? */
  isSoundEnabled(): boolean;

  // ─────────────────────────────────────
  // Player
  // ─────────────────────────────────────

  /**
   * Get current player info.
   * @returns Player object with name
   */
  getPlayer(): { name: string };

  // ─────────────────────────────────────
  // Scores
  // ─────────────────────────────────────

  /**
   * Save a new score.
   * Automatically includes timestamp and player name.
   * Keeps top 10 scores only.
   *
   * @param score - Numeric score value
   * @returns true if saved successfully
   */
  saveScore(score: number): boolean;

  /**
   * Get high scores for this game.
   * @returns Array of scores, sorted descending
   */
  getHighScores(): Array<{
    score: number;
    date: number;
    player: string;
  }>;

  // ─────────────────────────────────────
  // Progression
  // ─────────────────────────────────────

  /**
   * Save game progress/state.
   * @param data - Any JSON-serializable data
   */
  saveProgress(data: unknown): boolean;

  /**
   * Load previously saved progress.
   * @returns Saved data or null
   */
  loadProgress<T>(): T | null;

  /**
   * Clear saved progress.
   */
  clearProgress(): void;

  // ─────────────────────────────────────
  // Navigation
  // ─────────────────────────────────────

  /**
   * Request to return to the portal catalog.
   */
  quit(): void;
};
```

### Lifecycle Hooks

Games can define these global functions:

```typescript
/**
 * Called when the portal requests game unload.
 * Use for final cleanup (cancel animations, save state).
 */
declare function onGameDispose(): void;

/**
 * Called when the game should pause.
 * Triggers: tab hidden, portal pause button, overlay opened.
 */
declare function onGamePause(): void;

/**
 * Called when the game can resume.
 * Triggers: tab visible, portal resume, overlay closed.
 */
declare function onGameResume(): void;

/**
 * Called when sound preference changes.
 * @param enabled - New sound state
 */
declare function onSoundChange(enabled: boolean): void;
```

## Asset Loader

### Interface

```typescript
class AssetLoader {
  /**
   * Create a new asset loader for a game.
   * @param gameName - Game identifier
   */
  constructor(gameName: string);

  // ─────────────────────────────────────
  // Loading
  // ─────────────────────────────────────

  /**
   * Load a single image.
   * @param src - Image path (relative to game folder)
   * @returns Promise resolving to HTMLImageElement
   */
  loadImage(src: string): Promise<HTMLImageElement>;

  /**
   * Load a single audio file.
   * Returns a clone for independent playback.
   * @param src - Audio path (relative to game folder)
   * @returns Promise resolving to HTMLAudioElement
   */
  loadAudio(src: string): Promise<HTMLAudioElement>;

  /**
   * Load and parse a JSON file.
   * Returns a deep clone to prevent mutation.
   * @param src - JSON path (relative to game folder)
   */
  loadJSON<T>(src: string): Promise<T>;

  /**
   * Preload multiple assets with progress tracking.
   * @param manifest - Array of { type, src } objects
   * @param onProgress - Optional progress callback (0-1)
   * @returns Results with loaded and failed assets
   */
  preload(
    manifest: Array<{ type: 'image' | 'audio' | 'json'; src: string }>,
    onProgress?: (progress: number) => void
  ): Promise<{
    loaded: string[];
    failed: Array<{ src: string; error: string }>;
  }>;

  // ─────────────────────────────────────
  // Retrieval (cached)
  // ─────────────────────────────────────

  /**
   * Get a previously loaded image.
   * @returns Image or undefined if not loaded
   */
  getImage(src: string): HTMLImageElement | undefined;

  /**
   * Get a clone of a previously loaded audio.
   * Returns new clone each time for overlapping playback.
   * @returns Audio clone or null if not loaded
   */
  getAudio(src: string): HTMLAudioElement | null;

  /**
   * Get a clone of previously loaded JSON data.
   * @returns Deep clone of data or null if not loaded
   */
  getData<T>(src: string): T | null;

  // ─────────────────────────────────────
  // Cleanup
  // ─────────────────────────────────────

  /**
   * Release all assets and stop all audio.
   */
  dispose(): void;
}
```

### Preload Manifest Example

```javascript
const manifest = [
  { type: 'image', src: 'sprites/player.png' },
  { type: 'image', src: 'sprites/enemies.png' },
  { type: 'image', src: 'backgrounds/level1.png' },
  { type: 'audio', src: 'sounds/jump.mp3' },
  { type: 'audio', src: 'sounds/collect.mp3' },
  { type: 'audio', src: 'music/theme.mp3' },
  { type: 'json', src: 'data/levels.json' },
];

const result = await GameKit.assets.preload(manifest, (progress) => {
  loadingBar.style.width = `${progress * 100}%`;
});

if (result.failed.length > 0) {
  console.warn('Some assets failed to load:', result.failed);
}
```

## Implementation

### GameKit Core

```javascript
// lib/gamekit.js
const GameKit = {
  gameName: null,
  assets: null,
  _soundEnabled: true,
  _paused: false,

  init(name) {
    this.gameName = name;
    this.assets = new AssetLoader(name);
    this._setupListeners();
    window.parent.postMessage({ type: 'ready', game: name }, '*');
  },

  _setupListeners() {
    // Portal messages
    window.addEventListener('message', (event) => {
      switch (event.data.type) {
        case 'unload':
          this.dispose();
          break;
        case 'preference':
          if (event.data.key === 'sound') {
            this._soundEnabled = event.data.value;
            if (typeof window.onSoundChange === 'function') {
              window.onSoundChange(this._soundEnabled);
            }
          }
          break;
        case 'pause':
          this._paused = true;
          if (typeof window.onGamePause === 'function') {
            window.onGamePause();
          }
          break;
        case 'resume':
          this._paused = false;
          if (typeof window.onGameResume === 'function') {
            window.onGameResume();
          }
          break;
      }
    });

    // Auto-pause on tab hidden
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this._paused = true;
        if (typeof window.onGamePause === 'function') {
          window.onGamePause();
        }
      } else {
        this._paused = false;
        if (typeof window.onGameResume === 'function') {
          window.onGameResume();
        }
      }
    });
  },

  dispose() {
    if (this.assets) {
      this.assets.dispose();
      this.assets = null;
    }
    if (typeof window.onGameDispose === 'function') {
      window.onGameDispose();
    }
  },

  isPaused() {
    return this._paused;
  },

  isSoundEnabled() {
    return this._soundEnabled;
  },

  getPlayer() {
    try {
      return JSON.parse(localStorage.getItem('player')) || { name: 'Anonyme' };
    } catch {
      return { name: 'Anonyme' };
    }
  },

  saveScore(score) {
    try {
      const key = `scores_${this.gameName}`;
      const scores = JSON.parse(localStorage.getItem(key)) || [];
      scores.push({
        score,
        date: Date.now(),
        player: this.getPlayer().name
      });
      scores.sort((a, b) => b.score - a.score);
      localStorage.setItem(key, JSON.stringify(scores.slice(0, 10)));
      window.parent.postMessage({
        type: 'score',
        game: this.gameName,
        score
      }, '*');
      return true;
    } catch (e) {
      console.warn('Cannot save score:', e);
      return false;
    }
  },

  getHighScores() {
    try {
      return JSON.parse(localStorage.getItem(`scores_${this.gameName}`)) || [];
    } catch {
      return [];
    }
  },

  saveProgress(data) {
    try {
      localStorage.setItem(`progress_${this.gameName}`, JSON.stringify(data));
      return true;
    } catch (e) {
      console.warn('Cannot save progress:', e);
      return false;
    }
  },

  loadProgress() {
    try {
      return JSON.parse(localStorage.getItem(`progress_${this.gameName}`));
    } catch {
      localStorage.removeItem(`progress_${this.gameName}`);
      return null;
    }
  },

  clearProgress() {
    localStorage.removeItem(`progress_${this.gameName}`);
  },

  quit() {
    window.parent.postMessage({ type: 'quit', game: this.gameName }, '*');
  }
};
```

## Game Template

### Minimal Game Structure

```html
<!-- games/example/index.html -->
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Example Game</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { overflow: hidden; background: #000; }
    canvas { display: block; }
  </style>
</head>
<body>
  <canvas id="game"></canvas>
  <script src="/lib/assets.js"></script>
  <script src="/lib/gamekit.js"></script>
  <script src="game.js"></script>
</body>
</html>
```

```javascript
// games/example/game.js
'use strict';

// ─── Setup ───
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

let score = 0;
let paused = false;
let animationId;

// ─── Init ───
GameKit.init('example');

// Resize canvas to fill window
function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resize();
window.addEventListener('resize', resize);

// ─── Game Loop ───
function gameLoop() {
  if (!paused) {
    update();
    render();
  }
  animationId = requestAnimationFrame(gameLoop);
}

function update() {
  // Game logic here
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // Render game here
}

// ─── Game Over ───
function gameOver() {
  cancelAnimationFrame(animationId);
  GameKit.saveScore(score);
  // Show game over screen
}

// ─── Lifecycle Hooks ───
window.onGameDispose = () => {
  cancelAnimationFrame(animationId);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
};

window.onGamePause = () => {
  paused = true;
};

window.onGameResume = () => {
  paused = false;
};

window.onSoundChange = (enabled) => {
  // Mute/unmute all sounds
};

// ─── Controls ───
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    GameKit.quit();
  }
});

// ─── Start ───
gameLoop();
```

## Integration with GameEngine

For games that use the isomorphic GameEngine, GameKit acts as a thin wrapper:

```javascript
// games/tictactoe/game.js
import { TicTacToeEngine, TicTacToeRandomBot } from './engine.js';
import { SeededRandom } from '/lib/seeded-random.js';

GameKit.init('tictactoe');

const engine = new TicTacToeEngine();
const rng = new SeededRandom(Date.now());

// Configure slots: human vs bot
const config = {
  seed: rng.getSeed(),
  playerIds: ['human', 'bot'],
};

let state = engine.init(config);
const bot = new TicTacToeRandomBot();

// Human plays
function humanPlay(position) {
  if (engine.getCurrentPlayer(state) !== 'human') return;

  const action = { type: 'place', position };
  if (engine.isValidAction(state, action, 'human')) {
    state = engine.applyAction(state, action, 'human');
    render();

    // Bot's turn
    if (!engine.isGameOver(state)) {
      setTimeout(botPlay, 500);
    } else {
      handleGameOver();
    }
  }
}

function botPlay() {
  const view = engine.getPlayerView(state, 'bot');
  const validActions = engine.getValidActions(state, 'bot');
  const action = bot.chooseAction(view, validActions, rng);

  state = engine.applyAction(state, action, 'bot');
  render();

  if (engine.isGameOver(state)) {
    handleGameOver();
  }
}

function handleGameOver() {
  const winners = engine.getWinners(state);
  if (winners?.includes('human')) {
    GameKit.saveScore(100);
  }
}
```

## Error Handling

### Game-side Error Catching

```javascript
window.onerror = (message, source, line) => {
  window.parent.postMessage({
    type: 'error',
    game: GameKit.gameName,
    error: { message, source, line }
  }, '*');

  // Show error screen to user
  document.body.innerHTML = `
    <div style="color: white; padding: 20px;">
      <h1>Oops! Something went wrong</h1>
      <p>${message}</p>
      <button onclick="GameKit.quit()">Back to catalog</button>
    </div>
  `;

  return true; // Prevent default error handling
};

window.onunhandledrejection = (event) => {
  window.parent.postMessage({
    type: 'error',
    game: GameKit.gameName,
    error: { message: event.reason?.message || 'Async error' }
  }, '*');
};
```

## Constraints

### Technical Constraints

| Constraint | Value |
|------------|-------|
| Thumbnail size | 380x180px (19:9), < 50KB |
| Total assets | < 5MB recommended |
| Min resolution | 320x480 |
| Audio format | MP3, OGG |
| Image format | PNG, JPG, WebP |
| External deps | None required, lightweight libs OK |

### Required Files

| File | Required | Description |
|------|----------|-------------|
| `index.html` | ✅ | Entry point |
| `game.js` | ✅ | Game code |
| `game.json` | ✅ | Game metadata (see [Manifests](../manifests/spec.md)) |
| `thumb.png` | ✅ | Thumbnail for catalog |

## See Also

- [Portal Specification](../portal/spec.md) - Portal interface
- [GameEngine Specification](../game-engine/spec.md) - Isomorphic engines
- [Bot Specification](../bot/spec.md) - AI players
- [Manifests Specification](../manifests/spec.md) - Game metadata
