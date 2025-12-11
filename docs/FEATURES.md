# Playlab42 - Features MVP

Liste complète des fonctionnalités à implémenter.

## F1. Core Shell (Frontend)

- [ ] Page d'accueil avec catalogue de jeux
- [ ] Recherche par nom, tags, catégorie
- [ ] Filtres (nb joueurs, type tour par tour/temps réel)
- [ ] Chargement d'un jeu dans la page
- [ ] Affichage du profil utilisateur connecté
- [ ] Navigation claire et responsive

## F2. Authentification

- [ ] Inscription (pseudo + avatar prédéfini)
- [ ] Connexion / Déconnexion
- [ ] Profil persistant en base de données
- [ ] Liste d'avatars prédéfinis au choix

## F3. Lobby

- [ ] Liste globale des parties en attente (tous jeux)
- [ ] Filtrer les parties par jeu
- [ ] Affichage : jeu, créateur, joueurs actuels/max, config
- [ ] Créer une partie (choix jeu + config + public/privé)
- [ ] Rejoindre une partie en attente
- [ ] Rejoindre en tant que spectateur
- [ ] Lancer en solo (si le jeu le permet)
- [ ] Lancer la partie quand prêt (créateur uniquement)

## F4. Game Engine (isomorphe)

- [ ] Interface `GameEngine` commune à tous les jeux
- [ ] TypeScript pur, zéro dépendance I/O
- [ ] Tourne côté client ET serveur
- [ ] État 100% sérialisable JSON
- [ ] Fonctions pures et déterministes
- [ ] Random seedé via `SeededRandom` injecté
- [ ] `getValidActions()` pour lister les coups possibles (bots)
- [ ] Sérialisation/désérialisation état et actions
- [ ] Vue par joueur (`getPlayerView`) pour fog of war
- [ ] Vue spectateur (`getSpectatorView`)

## F5. Gestion de partie

- [ ] `askPause` - Un joueur demande une pause
- [ ] `acceptPause` / `rejectPause` - Les autres répondent
- [ ] `resume` - Reprendre la partie
- [ ] État `paused` géré côté serveur
- [ ] Timeout de pause configurable

## F6. Gestion des tours (tour par tour)

- [ ] `getCurrentPlayer()` - Qui doit jouer
- [ ] Timer par tour côté serveur
- [ ] Timeout configurable par jeu
- [ ] Action automatique si timeout (skip/forfait/défaut selon jeu)
- [ ] Notification `yourTurn` au joueur concerné

## F7. Temps réel

- [ ] Game loop serveur avec tick rate configurable
- [ ] Message `tick` avec état + events
- [ ] Actions bufferisées et appliquées au prochain tick
- [ ] `getTickRateMs()` dans le moteur
- [ ] `tick(state, deltaMs)` pour avancer le jeu

## F8. Communication WebSocket

### Client → Serveur

| Message | Payload | Description |
|---------|---------|-------------|
| `action` | `{ action }` | Action de jeu |
| `askPause` | `{ reason? }` | Demande de pause |
| `acceptPause` | `{}` | Accepte la pause |
| `rejectPause` | `{}` | Refuse la pause |
| `resume` | `{}` | Reprendre |

### Serveur → Client

| Message | Payload | Description |
|---------|---------|-------------|
| `state` | `{ state }` | État du jeu (vue joueur) |
| `tick` | `{ tick, state, events }` | Tick temps réel |
| `error` | `{ message }` | Action invalide |
| `yourTurn` | `{ timeoutMs }` | C'est ton tour |
| `turnTimeout` | `{ playerId }` | Timeout d'un joueur |
| `pauseRequested` | `{ by, reason? }` | Demande de pause |
| `paused` | `{}` | Partie en pause |
| `resumed` | `{}` | Partie reprise |
| `gameOver` | `{ winner, scores }` | Fin de partie |

## F9. SDK Client

```typescript
interface PlayLab {
  // Auth
  getUser(): User | null;

  // Lobby
  joinLobby(sessionId: string): Promise<void>;
  joinAsSpectator(sessionId: string): Promise<void>;
  startSolo(gameId: string, config?: unknown): Promise<void>;

  // Jeu
  sendAction(action: unknown): void;
  onState(callback: (state: unknown) => void): void;
  onTick(callback: (tick: TickMessage) => void): void;
  onError(callback: (error: string) => void): void;
  onYourTurn(callback: (timeoutMs: number) => void): void;
  onGameOver(callback: (result: GameResult) => void): void;

  // Pause
  askPause(reason?: string): void;
  acceptPause(): void;
  rejectPause(): void;
  resume(): void;
  onPauseRequested(callback: (by: string, reason?: string) => void): void;
  onPaused(callback: () => void): void;
  onResumed(callback: () => void): void;

  // Scores
  getLeaderboard(): Promise<Score[]>;
}
```

## F10. Scores & Leaderboard

- [ ] Enregistrement automatique des scores en fin de partie
- [ ] Leaderboard par jeu
- [ ] API `GET /games/:id/leaderboard`
- [ ] Affichage top scores dans le catalogue

## F11. Bots

- [ ] Interface `GameBot` commune
- [ ] Exécution côté client (Web Worker)
- [ ] Exécution côté serveur (Node.js)
- [ ] Bot rejoint un lobby comme un joueur normal
- [ ] Même règles de timeout qu'un humain
- [ ] Bots exemple fournis (random, greedy)

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

interface BotContext {
  timeRemainingMs: number;
  turnNumber: number;
  gameHistory: HistoryEntry[];
}
```

## F12. Historique & Records

- [ ] Activation configurable par jeu (`manifest.options.recordGames`)
- [ ] Stockage : seed, joueurs, toutes actions, résultat
- [ ] API `GET /records?gameId=xxx`
- [ ] API `GET /records/:id`
- [ ] Replay déterministe (grâce au seed)
- [ ] Export JSON/CSV pour entraînement ML

```typescript
interface GameRecord {
  id: string;
  sessionId: string;
  gameId: string;
  seed: string;
  players: Player[];
  config: unknown;
  startedAt: Date;
  endedAt: Date;
  history: HistoryEntry[];
  winner: string | null;
  scores: Record<string, number>;
}

interface HistoryEntry {
  turn: number;
  playerId: string;
  action: unknown;
  timestamp: number;  // ms depuis début
}
```

## F13. Entraînement accéléré

- [ ] API `POST /training/run`
- [ ] Paramètres : gameId, botA, botB, iterations, config
- [ ] Exécution sans délai réseau (direct serveur)
- [ ] Retourne statistiques (wins, scores moyens, durée)
- [ ] Option : sauvegarder toutes les parties ou stats seulement
- [ ] Runner CLI pour entraînement local/offline

## F14. API REST Backend

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `POST` | `/auth/register` | Créer un compte |
| `POST` | `/auth/login` | Se connecter |
| `GET` | `/auth/me` | Profil courant |
| `GET` | `/games` | Liste des jeux |
| `GET` | `/games/:id` | Détail d'un jeu |
| `GET` | `/games/:id/leaderboard` | Scores d'un jeu |
| `GET` | `/lobbies` | Parties en attente |
| `POST` | `/lobbies` | Créer une partie |
| `GET` | `/records` | Liste des records |
| `GET` | `/records/:id` | Détail d'un record |
| `POST` | `/training/run` | Lancer entraînement |

## F15. Jeu exemple 1 : Tic-Tac-Toe (tour par tour)

- [ ] Moteur isomorphe complet
- [ ] Client UI (grille cliquable)
- [ ] Config : taille grille (3x3, 4x4, 5x5)
- [ ] 2 joueurs ou 1 vs bot
- [ ] Bot random fourni
- [ ] Tests unitaires moteur
- [ ] Documentation règles

## F16. Jeu exemple 2 : Snake multijoueur (temps réel)

- [ ] Moteur isomorphe avec tick
- [ ] Client canvas
- [ ] Config : taille terrain, vitesse, nb fruits
- [ ] 1-4 joueurs
- [ ] Bot basique fourni
- [ ] Tests unitaires moteur
- [ ] Documentation règles

## F17. Documentation (qualité cours)

### Guides

- [ ] Architecture générale
- [ ] Créer un moteur de jeu (étape par étape)
- [ ] Créer un client de jeu
- [ ] Créer un bot
- [ ] Utiliser le mode entraînement

### Références

- [ ] API SDK client (complète, avec exemples)
- [ ] API REST backend
- [ ] Protocole WebSocket
- [ ] Interface GameEngine
- [ ] Interface GameBot
- [ ] Format GameManifest

### Templates

- [ ] Template moteur tour par tour (commenté)
- [ ] Template moteur temps réel (commenté)
- [ ] Template client (commenté)
- [ ] Template bot (commenté)

### Autres

- [ ] Checklist publication d'un jeu
- [ ] Exemples annotés (Tic-Tac-Toe, Snake)
- [ ] FAQ / Troubleshooting

## F18. Qualité code

- [ ] Code commenté en français
- [ ] Tests unitaires (moteurs, SDK, API)
- [ ] Tests intégration (WebSocket, sessions)
- [ ] ESLint strict configuré
- [ ] Types TypeScript exhaustifs
- [ ] Nommage explicite
- [ ] README par module
