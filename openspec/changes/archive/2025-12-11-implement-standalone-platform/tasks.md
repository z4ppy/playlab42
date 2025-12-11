# Tasks: implement-standalone-platform

## Phase 1 : Infrastructure

- [x] Créer `Dockerfile` (Node.js 20, npm)
- [x] Créer `docker-compose.yml` (service dev, volumes, ports)
- [x] Créer `Makefile` (init, dev, shell, npm, build)
- [x] Créer `package.json` (ES modules, scripts)
- [x] Créer `serve.json` (désactiver listing, rewrite index)
- [x] Créer structure de dossiers (`lib/`, `tools/`, `games/`, `data/`, `src/scripts/`)

## Phase 2 : Bibliothèques partagées

- [x] Implémenter `lib/seeded-random.js`
  - Algorithme Mulberry32
  - Méthodes : random, int, pick, shuffle, chance
  - Sérialisation : getState, clone, fromState
- [x] Implémenter `lib/assets.js`
  - loadImage, loadAudio, loadJSON
  - preload avec progression
  - Cache et dispose
- [x] Implémenter `lib/gamekit.js`
  - init, dispose, isPaused, isSoundEnabled
  - saveScore, getHighScores
  - saveProgress, loadProgress
  - Hooks cycle de vie
  - Communication postMessage

## Phase 3 : Portail

- [x] Créer `index.html` (structure HTML5)
- [x] Créer `style.css` (thème sombre, responsive)
- [x] Créer `app.js`
  - Chargement catalogue
  - Affichage cards (tools + games)
  - Filtres par tags
  - Recherche textuelle
  - Chargement iframe sandboxé
  - Section "Joué récemment"
  - Écran Settings (pseudo, son)
  - Communication postMessage

## Phase 4 : Premier outil

- [x] Créer `tools/json-formatter.html`
  - Formatage JSON
  - Minification
  - Validation avec erreurs
  - Coloration syntaxique
- [x] Créer `tools/json-formatter.json` (manifest)

## Phase 5 : Script de build

- [x] Créer `src/scripts/build-catalogue.js`
  - Scan tools/*.json
  - Scan games/*/game.json
  - Validation des manifests
  - Génération data/catalogue.json

## Phase 6 : Premier jeu (Tic-Tac-Toe)

- [x] Créer `games/tictactoe/engine.js`
  - Interface GameEngine complète
  - État immutable
  - Détection victoire/nul
  - getValidActions pour bots
- [x] Créer `games/tictactoe/bots/random.js`
  - Coup aléatoire parmi les valides
- [x] Créer `games/tictactoe/bots/blocker.js`
  - Heuristique : gagner > bloquer > centre > coin > edge
- [x] Créer `games/tictactoe/bots/perfect.js`
  - Minimax avec élagage alpha-beta
- [x] Créer `games/tictactoe/index.html`
  - Écran config (adversaire, premier joueur)
  - Grille interactive
  - Affichage statut et scores
  - Raccourcis clavier (R, Escape)
- [x] Créer `games/tictactoe/game.json` (manifest avec bots)

## Phase 7 : Qualité code

- [x] Configurer ESLint 9 (flat config)
- [x] Installer plugins (@eslint/js, globals)
- [x] Corriger toutes les erreurs de lint
- [x] Écrire tests SeededRandom (21 tests)
- [x] Écrire tests TicTacToeEngine (29 tests)
- [x] Mettre à jour docs/FEATURES.md

## Commits

1. `22ddb70` - Implémentation Phase 1 : Infrastructure de développement
2. `c0bde99` - Ajout du portail et désactivation du listing
3. `7d09517` - Fix: rewrite racine vers index.html
4. `8f0b4f2` - Ajout du jeu Tic-Tac-Toe
5. `e74d353` - Ajout ESLint et tests unitaires
