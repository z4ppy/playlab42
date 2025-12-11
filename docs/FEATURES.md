# Playlab42 - Features MVP

Liste complète des fonctionnalités à implémenter, organisées par phase.

> **Specs techniques** : Voir `openspec/specs/` pour les spécifications détaillées.

---

## Phase 1 : Catalogue statique (sans backend) ✅

### F1. Tools (HTML standalone) ✅

> **Spec** : [manifests/spec.md](../openspec/specs/manifests/spec.md)

- [x] Structure `tools/` pour les outils
- [x] Premier tool exemple (JSON formatter)
- [x] Convention : un fichier HTML = un outil
- [x] Manifest `tool.json` pour métadonnées

### F2. Portail et catalogue ✅

> **Specs** : [portal/spec.md](../openspec/specs/portal/spec.md), [catalogue/spec.md](../openspec/specs/catalogue/spec.md)

- [x] Page d'accueil listant Tools + Games
- [x] Filtres par tags
- [x] Recherche par nom, description
- [x] Chargement en iframe sandboxé
- [x] Section "Joué récemment"
- [x] Script de build pour générer `data/catalogue.json`
- [x] 100% statique, déployable sur GitHub Pages

### F3. Préférences utilisateur ✅

> **Spec** : [portal/spec.md](../openspec/specs/portal/spec.md)

- [x] Pseudo éditable
- [x] Son on/off
- [x] Persistence localStorage
- [x] Écran Settings

---

## Phase 2 : Games standalone ✅

### F4. Game Engine (isomorphe) ✅

> **Spec** : [game-engine/spec.md](../openspec/specs/game-engine/spec.md)

- [x] Interface `GameEngine` commune à tous les jeux
- [x] TypeScript/JavaScript pur, zéro dépendance I/O
- [x] Tourne côté client ET serveur
- [x] État 100% sérialisable JSON
- [x] Fonctions pures et déterministes
- [x] Random seedé via `SeededRandom`
- [x] `getValidActions()` pour lister les coups (bots)
- [x] `getPlayerView()` pour fog of war

### F5. SeededRandom ✅

> **Spec** : [seeded-random/spec.md](../openspec/specs/seeded-random/spec.md)

- [x] Implémentation Mulberry32
- [x] Méthodes : `random()`, `int()`, `pick()`, `shuffle()`, `chance()`
- [x] Clone et sérialisation de l'état

### F6. GameKit SDK ✅

> **Spec** : [gamekit/spec.md](../openspec/specs/gamekit/spec.md)

- [x] `GameKit.init(name)`
- [x] Asset Loader (images, sons, JSON)
- [x] `saveScore()` / `getHighScores()`
- [x] `saveProgress()` / `loadProgress()`
- [x] Hooks : `onGamePause`, `onGameResume`, `onSoundChange`, `onGameDispose`
- [x] Communication postMessage avec le portail

### F7. Bots (IA) ✅

> **Spec** : [bot/spec.md](../openspec/specs/bot/spec.md)

- [x] Interface `Bot` abstraite
- [x] Configuration slots joueurs (humain/bot/disabled)
- [x] Bot Random (par défaut)
- [x] Bot Greedy (heuristique) → Blocker
- [x] Bot Minimax (pour jeux 2 joueurs) → Perfect
- [x] Game Runner pour orchestrer humains et bots
- [x] Déclaration des bots dans `game.json`

### F8. Jeu exemple : Tic-Tac-Toe ✅

- [x] Moteur isomorphe complet
- [x] Client UI standalone (grille cliquable)
- [x] Jouable en solo (humain vs bot)
- [x] Jouable en hot-seat (2 humains)
- [x] 3 bots : Random, Blocker, Perfect
- [x] Tests unitaires moteur
- [ ] Documentation règles

---

## Phase 3 : Backend et multi-joueur (future)

> Ces features seront développées dans une version ultérieure.

### F9. Backend API

- [ ] Serveur Node.js (Hono)
- [ ] Auth : register, login, profil
- [ ] Scores et leaderboard partagés
- [ ] Persistence JSON files

### F10. Communication WebSocket

- [ ] Protocole temps réel
- [ ] Sessions de jeu multi-joueurs
- [ ] Gestion des tours et timeout

### F11. PlayLabSDK

- [ ] `window.playlab` injecté par la plateforme
- [ ] Détection auto standalone vs plateforme
- [ ] Communication avec le backend

---

## Phase 4 : Enrichissements (future)

### F12. Jeu exemple 2 : Snake (temps réel)

- [ ] Moteur isomorphe avec tick
- [ ] Client canvas
- [ ] 1-4 joueurs
- [ ] Config : taille terrain, vitesse

### F13. Historique & Records

- [ ] Stockage : seed, joueurs, actions, résultat
- [ ] Replay déterministe
- [ ] Export pour ML

### F14. Entraînement accéléré

- [ ] API bot vs bot
- [ ] Runner CLI
- [ ] Datasets pour ML

---

## Documentation

### Guides

- [x] Architecture générale
- [x] Créer un outil (HTML tool)
- [x] Créer un moteur de jeu
- [x] Créer un client de jeu
- [x] Créer un bot

### Templates

- [ ] Template outil HTML
- [ ] Template moteur tour par tour
- [ ] Template moteur temps réel
- [ ] Template bot

---

## Qualité code

- [x] Code commenté en français
- [x] Tests unitaires (moteurs, SDK)
- [x] ESLint strict configuré
- [ ] Types TypeScript exhaustifs
- [x] Nommage explicite
- [ ] README par module
- [x] Docker-first (tout containerisé)

---

## Références specs

| Spec | Chemin |
|------|--------|
| Platform | [openspec/specs/platform/spec.md](../openspec/specs/platform/spec.md) |
| Catalogue | [openspec/specs/catalogue/spec.md](../openspec/specs/catalogue/spec.md) |
| SeededRandom | [openspec/specs/seeded-random/spec.md](../openspec/specs/seeded-random/spec.md) |
| GameEngine | [openspec/specs/game-engine/spec.md](../openspec/specs/game-engine/spec.md) |
| Bot | [openspec/specs/bot/spec.md](../openspec/specs/bot/spec.md) |
| Manifests | [openspec/specs/manifests/spec.md](../openspec/specs/manifests/spec.md) |
| Portal | [openspec/specs/portal/spec.md](../openspec/specs/portal/spec.md) |
| GameKit | [openspec/specs/gamekit/spec.md](../openspec/specs/gamekit/spec.md) |
