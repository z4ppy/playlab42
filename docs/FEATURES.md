# Playlab42 - Features MVP

Liste complète des fonctionnalités à implémenter, organisées par phase.

---

## Phase 1 : Catalogue statique (sans backend)

### F1. Tools (HTML standalone)

- [ ] Structure `tools/` pour les outils
- [ ] Premier tool exemple (JSON formatter ou autre)
- [ ] Convention : un fichier HTML = un outil
- [ ] Manifest optionnel (`tool.json`) pour métadonnées

### F2. Catalogue statique

- [ ] Page d'accueil listant Tools + Games
- [ ] Onglets ou filtres : [🔧 Outils] [🎮 Jeux]
- [ ] Recherche par nom, tags
- [ ] Chargement d'un tool/game (iframe ou lien)
- [ ] Lecture des manifests pour afficher les métadonnées
- [ ] 100% statique, déployable sur GitHub Pages

---

## Phase 2 : Games standalone

### F3. Game Engine (isomorphe)

- [ ] Interface `GameEngine` commune à tous les jeux
- [ ] TypeScript pur, zéro dépendance I/O
- [ ] Tourne côté client ET serveur
- [ ] État 100% sérialisable JSON
- [ ] Fonctions pures et déterministes
- [ ] Random seedé via `SeededRandom` injecté
- [ ] `getValidActions()` pour lister les coups possibles (bots)
- [ ] Vue par joueur (`getPlayerView`) pour fog of war
- [ ] Vue spectateur (`getSpectatorView`)

### F4. Jeu exemple : Tic-Tac-Toe (tour par tour)

- [ ] Moteur isomorphe complet
- [ ] Client UI standalone (grille cliquable)
- [ ] Jouable en local (2 joueurs même écran)
- [ ] Config : taille grille (3x3, 4x4, 5x5)
- [ ] Tests unitaires moteur
- [ ] Documentation règles

### F5. Authentification (localStorage)

- [ ] Inscription (pseudo + avatar prédéfini)
- [ ] Connexion / Déconnexion
- [ ] Profil persistant en localStorage
- [ ] Liste d'avatars prédéfinis au choix

---

## Phase 3 : Backend et multi-joueur

### F6. Backend API

- [ ] Serveur Node.js (dans Docker)
- [ ] Auth : register, login, profil
- [ ] Liste des jeux (depuis manifests)
- [ ] Scores et leaderboard par jeu

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `POST` | `/auth/register` | Créer un compte |
| `POST` | `/auth/login` | Se connecter |
| `GET` | `/auth/me` | Profil courant |
| `GET` | `/games` | Liste des jeux |
| `GET` | `/games/:id/leaderboard` | Scores d'un jeu |

### F7. Lobby

- [ ] Liste globale des parties en attente
- [ ] Filtrer les parties par jeu
- [ ] Créer une partie (choix jeu + config)
- [ ] Rejoindre une partie en attente
- [ ] Rejoindre en tant que spectateur
- [ ] Lancer en solo (si le jeu le permet)

### F8. Communication WebSocket

#### Client → Serveur

| Message | Payload | Description |
|---------|---------|-------------|
| `action` | `{ action }` | Action de jeu |
| `askPause` | `{ reason? }` | Demande de pause |
| `acceptPause` | `{}` | Accepte la pause |
| `rejectPause` | `{}` | Refuse la pause |
| `resume` | `{}` | Reprendre |

#### Serveur → Client

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

### F9. Gestion de partie

- [ ] `askPause` / `acceptPause` / `rejectPause` / `resume`
- [ ] État `paused` géré côté serveur
- [ ] Timeout de pause configurable

### F10. Gestion des tours (tour par tour)

- [ ] `getCurrentPlayer()` - Qui doit jouer
- [ ] Timer par tour côté serveur
- [ ] Timeout configurable par jeu
- [ ] Action automatique si timeout (skip/forfait/défaut)
- [ ] Notification `yourTurn` au joueur concerné

### F11. Temps réel

- [ ] Game loop serveur avec tick rate configurable
- [ ] Message `tick` avec état + events
- [ ] Actions bufferisées et appliquées au prochain tick

---

## Phase 4 : Enrichissements

### F12. SDK Client (optionnel)

```typescript
interface PlayLabSDK {
  // Contexte
  getUser(): User | null;
  getPlayers(): Player[];

  // Jeu
  sendAction(action: unknown): void;
  onState(callback: (state: unknown) => void): void;
  onYourTurn(callback: () => void): void;
  onGameOver(callback: (result: GameResult) => void): void;

  // Pause
  askPause(reason?: string): void;
  onPauseRequested(callback: (by: string) => void): void;
}
```

### F13. Jeu exemple 2 : Snake (temps réel)

- [ ] Moteur isomorphe avec tick
- [ ] Client canvas
- [ ] Config : taille terrain, vitesse, nb fruits
- [ ] 1-4 joueurs
- [ ] Tests unitaires moteur

### F14. Bots

- [ ] Interface `GameBot` commune
- [ ] Exécution côté client (Web Worker)
- [ ] Exécution côté serveur (Node.js)
- [ ] Bots exemple fournis (random, greedy)

```typescript
interface GameBot<TView, TAction> {
  id: string;
  name: string;
  gameId: string;

  chooseAction(
    view: TView,
    validActions: TAction[],
    context: BotContext
  ): Promise<TAction>;
}
```

### F15. Historique & Records

- [ ] Stockage : seed, joueurs, toutes actions, résultat
- [ ] Replay déterministe (grâce au seed)
- [ ] Export JSON/CSV pour entraînement ML

### F16. Entraînement accéléré

- [ ] API `POST /training/run` (N parties bot vs bot)
- [ ] Exécution sans délai réseau
- [ ] Runner CLI pour entraînement local

---

## Documentation (qualité cours)

### Guides

- [ ] Architecture générale
- [ ] Créer un outil (HTML tool)
- [ ] Créer un moteur de jeu
- [ ] Créer un client de jeu
- [ ] Créer un bot

### Références

- [ ] Interface GameEngine
- [ ] Interface GameBot
- [ ] Format GameManifest / ToolManifest
- [ ] API SDK client
- [ ] API REST backend
- [ ] Protocole WebSocket

### Templates

- [ ] Template outil HTML
- [ ] Template moteur tour par tour
- [ ] Template moteur temps réel
- [ ] Template client
- [ ] Template bot

---

## Qualité code

- [ ] Code commenté en français
- [ ] Tests unitaires (moteurs, SDK, API)
- [ ] ESLint strict configuré
- [ ] Types TypeScript exhaustifs
- [ ] Nommage explicite
- [ ] README par module
- [ ] Docker-first (tout containerisé)
