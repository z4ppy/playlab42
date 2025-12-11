# Playlab42 - Concepts et Glossaire

Définitions des termes et concepts utilisés dans le projet.

---

## Entités principales

### Tool (Outil)

Un outil HTML standalone, inspiré des "HTML Tools" de Simon Willison :

- **Un fichier** : HTML + CSS + JS dans un seul fichier
- **Autonome** : Ouvrable directement (double-clic)
- **Sans backend** : Tout tourne dans le navigateur
- **Simple** : Quelques centaines de lignes max

```
tools/json-formatter.html    # Double-clic = ça marche !
```

**Exemples** : JSON formatter, Base64 encoder, Color picker, Regex tester...

#### Tool Manifest (optionnel)

Si le tool est dans un dossier :

```typescript
interface ToolManifest {
  id: string;           // "json-formatter"
  name: string;         // "JSON Formatter"
  description: string;
  author: string;
  tags: string[];       // ["json", "dev-tools"]
  icon?: string;        // Emoji ou URL
}
```

---

### Game (Jeu)

Un jeu est un module complet comprenant :
- Un **moteur** (engine) : logique et règles
- Un **client** : interface utilisateur
- Un **manifest** : métadonnées et configuration

Chaque jeu est identifié par un `gameId` unique (kebab-case).

### Game Engine (Moteur de jeu)

Le moteur contient toute la logique du jeu :
- Règles de validation des actions
- Calcul des états successifs
- Détection de fin de partie

**Propriétés essentielles** :
- **Isomorphe** : tourne côté client ET serveur
- **Pur** : pas d'effets de bord, pas d'I/O
- **Déterministe** : même input = même output
- **Seedé** : utilise un générateur aléatoire fourni

### Game Client (Client de jeu)

L'interface utilisateur du jeu :
- Affiche l'état du jeu
- Capture les inputs utilisateur
- Envoie les actions (localement ou via SDK)

**Important** : Un jeu est **autonome** et peut fonctionner sans la plateforme.

### Game Manifest (Manifest de jeu)

Fichier `game.json` décrivant le jeu :

```typescript
interface GameManifest {
  // Identité
  id: string;                      // "tic-tac-toe"
  name: string;                    // "Tic Tac Toe"
  description: string;
  version: string;
  author: string;

  // Classification
  tags: string[];                  // ["stratégie", "2-joueurs"]
  category: GameCategory;          // "board" | "card" | "arcade" | ...

  // Joueurs
  players: {
    min: number;
    max: number;
    solo: boolean;                 // Jouable seul ?
  };

  // Type
  type: "turnbased" | "realtime";

  // Fichiers
  files: {
    engine: string;                // "./engine.ts"
    client: string;                // "./client/index.html"
    thumbnail: string;
  };

  // Options
  options: {
    recordGames: boolean;          // Enregistrer l'historique ?
    supportsBots: boolean;
    supportsSpectators: boolean;
    allowPause: boolean;
  };

  // Configuration de partie (variantes)
  configSchema?: ConfigSchema;

  // Valeurs par défaut
  defaults: {
    turnTimeoutMs?: number;
    tickRateMs?: number;
    pauseTimeoutMs?: number;
  };
}
```

---

## Utilisateurs

### User (Utilisateur)

Un compte sur la plateforme :

```typescript
interface User {
  id: string;
  pseudo: string;
  avatar: string;              // ID d'avatar prédéfini
  createdAt: Date;
}
```

### Player (Joueur)

Un participant dans une partie :

```typescript
interface Player {
  id: string;
  type: "human" | "bot";
  userId?: string;             // Si humain
  botId?: string;              // Si bot
}
```

### Spectator (Spectateur)

Un utilisateur qui regarde une partie sans y participer.
Reçoit la vue spectateur (`getSpectatorView`).

---

## Sessions et parties

### Lobby (Salle d'attente)

Liste des parties en attente de joueurs.
Un joueur peut :
- Créer une nouvelle partie
- Rejoindre une partie existante
- Rejoindre en spectateur

### Session (Session de jeu)

Une instance de partie :

```typescript
interface GameSession {
  id: string;
  gameId: string;
  state: "waiting" | "playing" | "paused" | "finished";
  players: Player[];
  spectators: string[];
  config: unknown;
  seed: string;
  createdAt: Date;
  startedAt?: Date;
  endedAt?: Date;
}
```

### Game State (État de jeu)

L'état complet du jeu à un instant T.
- Sérialisable en JSON
- Connu uniquement du serveur (source de vérité)
- Les joueurs reçoivent une **vue filtrée**

### Player View (Vue joueur)

Ce qu'un joueur voit de l'état.
Permet le **fog of war** (informations cachées).

Exemple au poker : un joueur voit ses cartes mais pas celles des autres.

---

## Actions et communication

### Action

Un coup joué par un joueur :

```typescript
// Exemple Tic-Tac-Toe
type TicTacToeAction = {
  row: number;
  col: number;
};

// Exemple Snake
type SnakeAction = {
  direction: "up" | "down" | "left" | "right";
};
```

### Valid Actions (Actions valides)

Liste des actions possibles pour un joueur à un instant T.
Fourni par `engine.getValidActions(state, playerId)`.

Essentiel pour les bots.

### Turn (Tour)

En mode **tour par tour** :
- Un seul joueur peut agir à la fois
- Déterminé par `engine.getCurrentPlayer(state)`
- Timeout configurable

### Tick

En mode **temps réel** :
- Unité de temps du game loop
- Intervalle défini par `engine.getTickRateMs()`
- Les actions sont appliquées à chaque tick

---

## Bots et IA

### Bot

Un joueur automatique :

```typescript
interface GameBot<TView, TAction> {
  id: string;
  name: string;
  author: string;
  gameId: string;

  chooseAction(
    view: TView,
    validActions: TAction[],
    context: BotContext
  ): Promise<TAction>;
}
```

### Bot Context

Informations supplémentaires pour le bot :

```typescript
interface BotContext {
  timeRemainingMs: number;     // Temps pour décider
  turnNumber: number;
  gameHistory: HistoryEntry[]; // Historique des coups
}
```

### Training (Entraînement)

Mode accéléré pour jouer N parties bot vs bot :
- Pas de délai réseau
- Pas de WebSocket
- Exécution directe sur le serveur
- Génère des datasets pour ML

---

## Historique et replay

### Game Record (Enregistrement)

Historique complet d'une partie :

```typescript
interface GameRecord {
  id: string;
  gameId: string;
  seed: string;                // Pour replay déterministe
  players: Player[];
  config: unknown;
  history: HistoryEntry[];
  winner: string | null;
  scores: Record<string, number>;
}
```

### History Entry (Entrée historique)

Un coup dans l'historique :

```typescript
interface HistoryEntry {
  turn: number;
  playerId: string;
  action: unknown;
  timestamp: number;           // ms depuis début partie
}
```

### Replay

Rejouer une partie grâce au seed et à l'historique.
Même seed + mêmes actions = même déroulement exact.

---

## Utilitaires

### SeededRandom

Générateur de nombres aléatoires avec seed :

```typescript
interface SeededRandom {
  next(): number;                           // 0-1
  nextInt(min: number, max: number): number;
  shuffle<T>(array: T[]): T[];
  getSeed(): string;
}
```

**Important** : Ne jamais utiliser `Math.random()` dans un moteur.
Toujours utiliser le `SeededRandom` injecté.

### SDK (PlayLabSDK)

API **optionnelle** injectée par la plateforme (`window.playlab`).
Permet à un jeu autonome de se connecter au multi-joueur.

```typescript
interface PlayLabSDK {
  // Contexte
  getUser(): User | null;
  getPlayers(): Player[];
  getConfig(): unknown;

  // Communication (multi-joueur)
  sendAction(action: unknown): void;
  onState(callback: (state: unknown) => void): void;
  onYourTurn(callback: () => void): void;
  onGameOver(callback: (result: GameResult) => void): void;
}
```

**Détection automatique** : Le jeu vérifie `if (window.playlab)` pour savoir s'il est connecté à la plateforme.

---

## Jeux autonomes

### Principe

Chaque jeu est une **mini-application autonome** :
- Ouvrable directement (`index.html`)
- Fonctionne sans serveur ni plateforme
- Intègre son moteur et son UI

### Structure d'un jeu

```
games/tic-tac-toe/
├── index.html      # Point d'entrée (jouable seul)
├── engine.ts       # Moteur pur (optionnel si inline)
├── game.json       # Manifest pour la plateforme
└── assets/         # Images, sons (optionnel)
```

### Mode standalone vs plateforme

```javascript
// Détection automatique du mode
if (window.playlab) {
  // Mode plateforme : multi-joueur via SDK
  playlab.onState(render);
  function play(action) {
    playlab.sendAction(action);
  }
} else {
  // Mode standalone : tout en local
  let state = engine.createInitialState(...);
  function play(action) {
    state = engine.applyAction(state, currentPlayer, action);
    render(state);
  }
}
```

---

## Types de jeux

### Tour par tour (turnbased)

- Un joueur joue à la fois
- `getCurrentPlayer()` détermine qui joue
- Timeout par tour
- Exemples : Tic-Tac-Toe, Échecs, Poker

### Temps réel (realtime)

- Tous les joueurs jouent simultanément
- Game loop avec ticks réguliers
- Actions bufferisées entre ticks
- Exemples : Snake, Pong, course

---

## Modes d'exécution

| Mode | Location | Réseau | Usage |
|------|----------|--------|-------|
| Solo local | Client | Non | Entraînement ML, offline |
| Solo serveur | Serveur | Oui | Anti-triche |
| Multi local | Client | Non | Hot-seat, debug |
| Multi serveur | Serveur | Oui | Jeu en ligne |
| Entraînement | Serveur | Non | Bot vs bot accéléré |
