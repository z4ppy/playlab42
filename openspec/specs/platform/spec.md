# Platform Specification

## Overview

Playlab42 est une plateforme pédagogique de mini-jeux et outils collaboratifs. Cette spec définit l'architecture technique de la **version standalone** : tools et games autonomes, sans backend.

## Scope

- **Inclus** : Tools HTML, Games standalone, Catalogue statique
- **Exclu** : Backend, WebSocket, multijoueur, authentification

## Requirements

### Requirement: Standalone First

The system SHALL allow tools and games to run without any server.

#### Scenario: Double-click execution
- **WHEN** a user double-clicks on a tool or game HTML file
- **THEN** the application opens in the browser and is fully functional

#### Scenario: File protocol
- **WHEN** a tool/game is opened via `file://` protocol
- **THEN** all features work (localStorage for persistence)

### Requirement: Single File Tools

The system SHALL support single-file HTML tools.

#### Scenario: Tool structure
- **WHEN** a developer creates a tool
- **THEN** everything (HTML, CSS, JS) is in one `.html` file

#### Scenario: No build step
- **WHEN** a tool is modified
- **THEN** it can be tested immediately without compilation

### Requirement: Containerized Development

The system SHALL use Docker for all development tools.

#### Scenario: npm commands
- **WHEN** a developer needs to run npm
- **THEN** they use `make npm CMD="..."` (not `npm` directly)

#### Scenario: Reproducible environment
- **WHEN** a new developer joins
- **THEN** `make init` sets up the complete environment

## Stack Technique

| Composant | Choix | Justification |
|-----------|-------|---------------|
| **Frontend** | HTML pur | Standalone, pas de build, pédagogique |
| **Catalogue** | JSON généré | Assemblé au build, liste tools/games |
| **Tests** | Jest | Standard Node.js |
| **Infra** | Docker | Environnement reproductible |

## Structure des Dossiers

```
playlab42/
├── index.html                # Portail principal (reste à la racine pour GitHub Pages)
├── portal/                   # Sources du portail
│   ├── app.js                # Point d'entrée du portail
│   ├── style.css             # Styles du portail
│   └── modules/              # Modules JS du portail
│       ├── state.js          # État global
│       ├── catalogue.js      # Gestion catalogue
│       ├── bookmarks.js      # Gestion bookmarks
│       ├── parcours.js       # Gestion parcours
│       ├── events.js         # Événements et bindings
│       ├── settings.js       # Paramètres utilisateur
│       ├── storage.js        # Persistence localStorage
│       ├── tabs.js           # Navigation par onglets
│       ├── router.js         # Routage interne
│       ├── dom-cache.js      # Cache éléments DOM
│       └── game-loader.js    # Chargement des jeux
├── .claude/                  # Configuration Claude Code
├── assets/                   # Assets du portail
│   └── default-thumb.png     # Vignette par défaut
├── lib/                      # Bibliothèques partagées (portail + games + tools)
│   ├── gamekit.js            # SDK pour les jeux
│   ├── dom.js                # Utilitaires DOM
│   ├── theme.js              # Gestion thème clair/sombre
│   ├── router.js             # Hash router
│   ├── parcours-viewer.js    # Viewer de parcours
│   └── seeded-random.js      # PRNG déterministe
├── scripts/                  # Scripts de build
│   ├── build-catalogue.js    # Génère catalogue.json
│   ├── build-parcours.js     # Génère parcours.json
│   ├── build-bookmarks.js    # Génère bookmarks.json
│   ├── parcours-utils.js     # Utilitaires parcours
│   └── og-fetcher.js         # Fetch Open Graph
├── tools/                    # Outils HTML standalone
│   ├── [tool-name].html      # Un fichier = un outil
│   └── [tool-name].json      # Manifest
├── games/                    # Jeux autonomes
│   └── [game-id]/
│       ├── index.html        # Point d'entrée standalone
│       ├── game.js           # Code du jeu
│       ├── game.json         # Manifest
│       ├── thumb.png         # Vignette (200x200)
│       ├── engine.js         # Moteur isomorphe (optionnel)
│       └── bots/             # Bots IA (optionnel)
│           └── random.js
├── parcours/                 # Parcours pédagogiques
│   ├── index.json            # Configuration des parcours
│   └── epics/                # Epics (modules)
│       └── [epic-id]/
│           ├── epic.json     # Manifest de l'epic
│           └── slides/       # Slides de l'epic
├── data/                     # Données générées
│   ├── catalogue.json        # DB des tools/games
│   ├── parcours.json         # DB des parcours
│   └── bookmarks.json        # DB des bookmarks
├── docs/                     # Documentation
├── openspec/                 # Specs et proposals
├── Dockerfile
├── docker-compose.yml
├── Makefile
└── package.json
```

## Système de Build

### Commandes Make

```bash
# Initialisation
make init              # Build Docker + npm install

# Développement
make shell             # Shell dans le container
make serve             # Serveur statique (port 5242)
make npm CMD="..."     # Commande npm

# Build
make build             # Génère catalogue.json
make build:catalogue   # Alias pour build
```

### Génération du Catalogue

Le script `scripts/build-catalogue.js` :

1. Scanne `tools/` pour les fichiers `*.json` (manifests)
2. Scanne `games/*/` pour les fichiers `game.json`
3. Valide les manifests
4. Génère `data/catalogue.json`

```bash
# Exécution
make build:catalogue
# ou
npm run build:catalogue
```

## Hébergement

Le portail peut être hébergé sur :

- **GitHub Pages** : Gratuit, intégration Git native
- **Netlify** : Gratuit, déploiement auto
- **S3 + CloudFront** : Scalable, payant
- **Serveur statique** : nginx, Apache, serve

Aucun backend requis - tout est statique.

## Mode d'Exécution

```
┌─────────────────────────────────────────────────────────────┐
│                    MODE STANDALONE                           │
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │   Browser    │    │   Browser    │    │   Browser    │  │
│  │              │    │              │    │              │  │
│  │  Tool.html   │    │  Game.html   │    │ Catalogue    │  │
│  │              │    │              │    │   .html      │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│         │                   │                   │           │
│         ▼                   ▼                   ▼           │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                   localStorage                       │   │
│  │   (préférences, scores locaux, état de jeu)         │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  Pas de serveur - tout est local                            │
└─────────────────────────────────────────────────────────────┘
```

## Conventions

### Langue
- Commentaires : français
- Messages de commit : français
- Documentation : français

### Nommage
| Élément | Convention | Exemple |
|---------|------------|---------|
| Variables/fonctions | camelCase | `getPlayerView` |
| Types/classes | PascalCase | `GameEngine` |
| Fichiers | kebab-case | `game-engine.ts` |
| Constantes | SCREAMING_SNAKE | `MAX_PLAYERS` |

## Évolutions Futures

| Actuel | Futur (version backend) |
|--------|-------------------------|
| localStorage | Backend + JSON files |
| Catalogue statique | API REST |
| Solo uniquement | Multijoueur WebSocket |
| Pas d'auth | Authentification |

## See Also

- [Portal Specification](../portal/spec.md) - Interface utilisateur du portail
- [GameKit Specification](../gamekit/spec.md) - SDK pour les jeux
- [Catalogue Specification](../catalogue/spec.md) - Format du catalogue JSON
- [Manifests Specification](../manifests/spec.md) - Formats des manifests
- [Parcours Specification](../parcours/spec.md) - Structure des parcours pédagogiques
