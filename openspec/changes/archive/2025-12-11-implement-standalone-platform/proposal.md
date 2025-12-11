# Proposal: implement-standalone-platform

## Résumé

Implémentation complète de la plateforme Playlab42 en version standalone (Phase 1 et 2 des features), basée sur les specs définies dans `add-platform-specs`.

## Motivation

Les 8 spécifications techniques ont été définies et validées. Cette proposal couvre leur implémentation concrète pour obtenir une plateforme fonctionnelle avec :
- Un portail de catalogue
- Des outils HTML standalone
- Un premier jeu complet (Tic-Tac-Toe)
- Une infrastructure de développement Docker-first

## Scope

### Inclus

- Infrastructure Docker et scripts de build
- Bibliothèques partagées (SeededRandom, AssetLoader, GameKit)
- Portail web avec catalogue, filtres, recherche
- Premier outil : JSON Formatter
- Premier jeu : Tic-Tac-Toe avec 3 bots (Random, Blocker, Perfect)
- Configuration ESLint
- Tests unitaires

### Exclus

- Backend (Phase 3)
- Multijoueur temps réel (Phase 3)
- Autres jeux (Phase 4)

## Impact

### Specs implémentées

| Spec | Implémentation |
|------|----------------|
| platform | `Dockerfile`, `docker-compose.yml`, `Makefile`, structure dossiers |
| catalogue | `src/scripts/build-catalogue.js`, `data/catalogue.json` |
| seeded-random | `lib/seeded-random.js` |
| game-engine | `games/tictactoe/engine.js` |
| bot | `games/tictactoe/bots/*.js` |
| manifests | `tools/*.json`, `games/*/game.json` |
| portal | `index.html`, `style.css`, `app.js` |
| gamekit | `lib/gamekit.js`, `lib/assets.js` |

### Fichiers créés

```
playlab42/
├── index.html              # Portail
├── style.css               # Styles portail
├── app.js                  # Logique portail
├── serve.json              # Config serveur statique
├── Dockerfile              # Image Node.js
├── docker-compose.yml      # Services dev
├── Makefile                # Commandes make
├── package.json            # Dépendances
├── eslint.config.js        # Config ESLint 9
├── lib/
│   ├── seeded-random.js    # PRNG Mulberry32
│   ├── seeded-random.test.js
│   ├── assets.js           # Asset Loader
│   └── gamekit.js          # SDK jeux
├── tools/
│   ├── json-formatter.html # Outil JSON
│   └── json-formatter.json # Manifest
├── games/
│   └── tictactoe/
│       ├── index.html      # UI du jeu
│       ├── engine.js       # Moteur isomorphe
│       ├── engine.test.js  # 29 tests
│       ├── game.json       # Manifest
│       └── bots/
│           ├── random.js   # Bot facile
│           ├── blocker.js  # Bot moyen
│           └── perfect.js  # Bot expert (minimax)
├── data/
│   └── catalogue.json      # Généré
└── src/
    └── scripts/
        └── build-catalogue.js
```

## Validation

- [x] `make dev` lance le serveur sur http://localhost:5242
- [x] Portail affiche tools et games
- [x] Filtres et recherche fonctionnels
- [x] JSON Formatter fonctionne en iframe
- [x] Tic-Tac-Toe jouable vs bots et hot-seat
- [x] 50 tests unitaires passent
- [x] ESLint passe sans erreur
