# Playlab42

[![CI](https://github.com/z4ppy/playlab42/actions/workflows/ci.yml/badge.svg)](https://github.com/z4ppy/playlab42/actions/workflows/ci.yml)
[![Deploy](https://github.com/z4ppy/playlab42/actions/workflows/deploy.yml/badge.svg)](https://github.com/z4ppy/playlab42/actions/workflows/deploy.yml)
[![codecov](https://codecov.io/gh/z4ppy/playlab42/graph/badge.svg)](https://codecov.io/gh/z4ppy/playlab42)

Plateforme pédagogique complète pour la formation au développement assisté par IA : supports de cours, base de connaissance, outils et jeux collaboratifs.

**[Voir la démo live](https://z4ppy.github.io/playlab42/)**

## Vision

**Playlab42** est à la fois un **support de formation**, un **démonstrateur technique** et un **projet collaboratif vivant**.

### 📚 Consulter - Base de connaissance

Le site met à disposition des **ressources pédagogiques** sélectionnées par les formateurs :
- **Parcours thématiques** : Slides et contenus structurés (histoire de l'IA, transformers, agents, etc.)
- **Documentation** : Guides pratiques, howto, tutoriels
- **Concepts clés** : Explications accessibles de notions techniques
- **Bookmarks** : Liens vers des ressources externes de qualité

Les stagiaires peuvent consulter ces contenus pendant et après la formation pour approfondir leurs connaissances.

### 🔍 Apprendre par l'exemple - Le projet comme démonstrateur

Playlab42 n'est pas qu'un catalogue : **son code source illustre les bonnes pratiques** du développement moderne assisté par IA :
- **Prompts pré-configurés** : Instructions pour agents IA (AGENTS.md, CLAUDE.md)
- **OpenSpec** : Workflow de spécification et gestion des changements
- **Agents spécialisés** : Commandes slash pour différents contextes
- **CI/CD** : Intégration continue avec GitHub Actions
- **Qualité** : Linting, tests automatisés, couverture de code
- **Conteneurisation** : Environnement Docker reproductible

En explorant le projet, les participants découvrent une architecture concrète qui fonctionne bien avec les outils d'IA.

### 🚀 Contribuer - Enrichir le projet

Chaque session de formation se conclut par une **contribution réelle** via Pull Request. Les participants peuvent :
- **Créer un mini-jeu** : Morpion, snake, quiz, etc.
- **Développer un outil** : Convertisseur JSON, palette de couleurs, encodeur...
- **Rédiger une documentation** : Présenter un concept, un hobby, un sujet technique (avec l'aide de l'IA)
- **Améliorer l'existant** : Corriger des bugs, enrichir les contenus

Le projet s'enrichit ainsi au fil des sessions, créant une base de connaissances collaborative.

## Fonctionnalités principales

| Feature | Description |
|---------|-------------|
| **Catalogue** | Liste des outils, jeux et parcours avec recherche/filtres |
| **Tools** | Outils HTML standalone (JSON formatter, encodeurs, etc.) |
| **Games** | Mini-jeux avec moteur isomorphe |
| **Parcours** | Contenus pédagogiques en slides HTML (Epics) |
| **Lobby** | Créer ou rejoindre des parties (multi-joueur) |
| **Profils** | Authentification, avatars, scores |
| **Bots** | Interface pour créer des IA joueurs |

## Architecture

### Tools (outils standalone)

Outils simples, un fichier HTML, pas de backend :

```
tools/json-formatter.html    # Tout-en-un, ouvrable directement
```

### Games (jeux autonomes)

Mini-applications avec moteur de règles :

```
games/tic-tac-toe/
├── index.html      # Jouable directement
├── engine.ts       # Moteur isomorphe (pur, déterministe)
└── game.json       # Manifest
```

### Parcours (contenus pédagogiques)

Epics composés de slides HTML pour la formation :

```
parcours/epics/coding-agents-2025/
├── epic.json       # Manifest (titre, tags, structure)
├── thumbnail.svg   # Vignette
└── slides/
    ├── 01-introduction/
    │   ├── slide.json
    │   └── index.html
    └── 02-panorama/
        └── ...
```

Système de taxonomie avec catégories (PlayLab42, Agentique, Autres) et tags pour le filtrage.

### Plateforme

```
┌─────────────────────────────────────────────────────────────┐
│                    PLAYLAB42 (statique)                      │
│  Catalogue unifié : Tools + Games                            │
│  [🔧 Outils]  [🎮 Jeux]  [Recherche...]                     │
└─────────────────────────────────────────────────────────────┘
                              │
                         iframe / lien
                              │
┌─────────────────────────────────────────────────────────────┐
│              TOOLS & GAMES AUTONOMES                         │
│  JSON Formatter │ Base64 │ Tic-Tac-Toe │ Snake │ ...        │
└─────────────────────────────────────────────────────────────┘
```

### Backend (optionnel, multi-joueur)

```
┌─────────────────────────────────────────────────────────────┐
│                       BACKEND                                │
│  Auth │ API REST │ WebSocket │ Sessions │ Scores            │
└─────────────────────────────────────────────────────────────┘
```

Le backend est **virtualisable** : mode localStorage pour fonctionner sans serveur.

## Environnement Docker-first

**Tout tourne dans Docker**, rien sur le host :

```bash
# Initialiser (build + up + install)
make init

# Lancer le shell de développement
make shell

# Commandes npm (dans le container)
make npm CMD="install lodash"
make npm CMD="run build"

# Serveur de dev (TypeScript)
make dev

# Serveur statique (pour tester tools/games)
make serve
```

## Démarrage rapide

```bash
# Cloner et se positionner
cd playlab42

# Initialiser l'environnement Docker
make init

# Lancer Claude Code
make claude

# Créer une nouvelle fonctionnalité
/openspec:proposal
```

## Structure

```
playlab42/
├── tools/              # Outils HTML standalone
│   └── mon-outil/
│       ├── index.html
│       └── tool.json
├── games/              # Jeux autonomes
│   └── mon-jeu/
│       ├── index.html
│       ├── engine.js
│       ├── bots.js
│       └── game.json
├── parcours/           # Contenus pédagogiques
│   ├── index.json      # Config taxonomie et featured
│   └── epics/
│       └── mon-epic/
│           ├── epic.json
│           ├── thumbnail.svg
│           └── slides/
├── lib/                # Bibliothèques partagées (thème, utilitaires)
├── data/               # Données générées (catalogue.json, parcours.json)
├── docs/               # Documentation
├── openspec/           # Spécifications et changes
└── .claude/            # Configuration Claude Code (commandes slash)
```

## Documentation

- [AGENTS.md](./AGENTS.md) - Instructions pour agents IA (Claude Code, Copilot, Cursor, etc.)
- [Features MVP](./docs/FEATURES.md) - Liste complète des fonctionnalités
- [Concepts](./docs/CONCEPTS.md) - Définitions et glossaire
- [Guide création d'outil](./docs/guides/create-tool.md) - Créer un tool
- [Guide création de jeu](./docs/guides/create-game.md) - Créer un game
- [Guide de contribution](./docs/guides/contributing.md) - Contribuer au projet

## Contribuer

PlayLab42 s'enrichit des contributions de chaque session de formation. Vous pouvez contribuer :

- **Tools** : Outils HTML standalone (JSON formatter, encodeurs, etc.)
- **Games** : Mini-jeux avec moteur isomorphe et bots
- **Parcours** : Contenus pédagogiques en slides HTML (Epics)

### Workflow

1. Fork le projet sur GitHub
2. Créez votre contenu selon le type (voir [guide de contribution](./docs/guides/contributing.md))
3. Testez en local avec `make serve`
4. Ouvrez une Pull Request

Consultez le [guide complet de contribution](./docs/guides/contributing.md) pour les détails.

## Le "42"

Référence à Douglas Adams : la réponse à la grande question sur la vie, l'univers et le reste.

---

*Projet collaboratif - Docaposte*
