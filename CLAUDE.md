# Playlab42 - Instructions pour Claude Code

## À propos du projet

**Playlab42** est une plateforme pédagogique de mini-jeux et outils collaboratifs pour la formation dev assistée par IA.

**Version actuelle** : Standalone (100% frontend, pas de backend).

### Architecture

| Composant | Description |
|-----------|-------------|
| **Tools** | Outils HTML standalone (un fichier, pas de backend) |
| **Games** | Jeux autonomes avec moteur isomorphe et bots |
| **Portal** | Catalogue unifié, charge tools/games en iframe |
| **GameKit** | SDK pour les jeux (assets, scores, hooks) |
| **Lib** | Utilitaires partagés (SeededRandom) |

### Concepts clés

- **Tool** : Outil HTML standalone (un fichier, ouvrable directement)
- **Game** : Mini-app standalone avec moteur de règles et bots
- **GameEngine** : Moteur isomorphe, TypeScript/JS pur, déterministe
- **Bot** : IA pluggable pour remplacer les joueurs humains
- **GameKit** : SDK pour communication portail ↔ jeu

### Objectif pédagogique

Support de formation où les participants créent des outils et jeux avec assistance IA.
Le projet s'enrichit des contributions de chaque session.

**Qualité code** : Ce projet étant un support de cours, le code doit être exemplaire :
- Bien commenté en français
- Nommage explicite
- Tests unitaires systématiques
- Types TypeScript exhaustifs

## Environnement Docker-first

**IMPORTANT** : Tout tourne dans Docker, rien sur le host.

```bash
# Initialiser l'environnement
make init

# Shell de développement
make shell

# Commandes npm (dans le container)
make npm CMD="install lodash"
make npm CMD="run test"

# Serveur de dev
make serve

# Build des catalogues
make build-catalogue    # Génère data/catalogue.json
make build-parcours     # Génère data/parcours.json

# Linting
make lint               # Vérifie lib/, src/, games/
docker compose exec dev npx eslint app.js  # Lint fichier spécifique

# Tests
make test               # Lance les tests Jest
make test-watch         # Mode watch
```

**Ne jamais exécuter npm, node, ou autres outils directement sur le host.**

## Workflow OpenSpec

<!-- OPENSPEC:START -->
Toujours ouvrir `@/openspec/AGENTS.md` quand la requête :
- Mentionne planning ou proposals (mots comme proposal, spec, change, plan)
- Introduit nouvelles capabilities, breaking changes, changements d'architecture
- Semble ambiguë et nécessite la spec officielle avant de coder

Utiliser `@/openspec/AGENTS.md` pour apprendre :
- Comment créer et appliquer des propositions de changement
- Format et conventions des specs
- Structure et guidelines du projet
<!-- OPENSPEC:END -->

## Commandes disponibles

- `/openspec:proposal` - Créer une nouvelle proposition
- `/openspec:apply` - Implémenter un changement approuvé
- `/openspec:archive` - Archiver après déploiement

## Conventions

- **Langue** : Commentaires et commits en français
- **Code** : TypeScript/JavaScript, fonctions pures quand possible
- **Nommage** : camelCase (variables), PascalCase (types), kebab-case (fichiers)
- **Simplicité** : Préférer solutions simples, éviter over-engineering
- **Isomorphisme** : Les moteurs de jeux doivent tourner client ET serveur
- **Docker-first** : Tout dans le container, rien sur le host

## Stack technique

| Aspect | Choix |
|--------|-------|
| Langage | TypeScript / JavaScript |
| Runtime | Node.js 20+ |
| Tests | Jest |
| Infra | Docker |
| Hébergement | GitHub Pages, Netlify, S3 |
| Workflow | OpenSpec |

## Structure du projet

```
playlab42/
├── index.html                # Portail principal
├── style.css                 # Styles du portail
├── app.js                    # Logique du portail
├── lib/                      # Bibliothèques partagées
│   ├── gamekit.js            # SDK pour les jeux
│   ├── assets.js             # Loader d'assets
│   └── seeded-random.js      # PRNG déterministe
├── tools/                    # Outils HTML standalone
│   ├── [tool-name].html      # Un fichier = un outil
│   └── [tool-name].json      # Manifest
├── games/                    # Jeux autonomes
│   └── [game-id]/
│       ├── index.html        # Point d'entrée standalone
│       ├── game.js           # Code du jeu
│       ├── game.json         # Manifest
│       ├── thumb.png         # Vignette
│       └── bots/             # Bots IA
├── data/                     # Données générées
│   └── catalogue.json        # DB des tools/games
├── src/                      # Code source (build)
│   └── scripts/              # Scripts de build
├── docs/                     # Documentation
└── openspec/                 # Specs et proposals
```

## Spécifications techniques

Les specs détaillées sont dans `openspec/specs/` :

| Spec | Description |
|------|-------------|
| [platform](openspec/specs/platform/spec.md) | Architecture, structure projet |
| [catalogue](openspec/specs/catalogue/spec.md) | Format JSON, script de build |
| [seeded-random](openspec/specs/seeded-random/spec.md) | PRNG déterministe Mulberry32 |
| [game-engine](openspec/specs/game-engine/spec.md) | Interface moteur de jeu |
| [bot](openspec/specs/bot/spec.md) | Interface IA, slots joueurs |
| [manifests](openspec/specs/manifests/spec.md) | Formats tool.json, game.json |
| [portal](openspec/specs/portal/spec.md) | Interface utilisateur |
| [gamekit](openspec/specs/gamekit/spec.md) | SDK pour les jeux |

## Références documentation

- `docs/FEATURES.md` - Liste des features MVP par phase
- `docs/CONCEPTS.md` - Définitions et glossaire
- `openspec/project.md` - Conventions du projet

## Contexte utilisateur

- Prénom : Cyrille
- Organisation : BU DAP
