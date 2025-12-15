# Changelog

Tous les changements notables de ce projet seront documentés dans ce fichier.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/),
et ce projet adhère au [Semantic Versioning](https://semver.org/lang/fr/).

## [Unreleased]

### Added
- Documentation des pipelines CI/CD (`.github/docs/PIPELINES.md`)
- Guide de déploiement et release (`docs/DEPLOYMENT.md`)
- Guide de démarrage pour nouveaux contributeurs (`docs/GETTING_STARTED.md`)
- Guide de résolution de problèmes (`docs/TROUBLESHOOTING.md`)
- Stratégie de tests (`docs/TESTING_STRATEGY.md`)
- Guide de gestion des secrets (`.github/docs/SECRETS_MANAGEMENT.md`)

## [0.1.0] - 2025-12-14

Version initiale MVP de Playlab42.

### Added

#### Plateforme
- Portail principal avec catalogue unifié (tools + games)
- Interface de recherche et filtrage par tags
- Chargement des tools et games en iframe
- Navigation entre tools, games et parcours
- Design responsive avec thème visuel cohérent

#### Tools (Outils standalone)
- Structure de base pour tools HTML standalone
- Manifest `tool.json` pour métadonnées
- Intégration dans le catalogue

#### Games (Jeux)
- Tic-Tac-Toe :
  - Moteur de jeu isomorphe et déterministe
  - Interface utilisateur responsive
  - Bot IA avec algorithme Minimax
  - Support 1 joueur (vs bot) et 2 joueurs
  - Animations et feedback visuel

- Parcours Viewer :
  - Visualisation de parcours pédagogiques (epics)
  - Navigation entre slides
  - Support Markdown avec `marked.js`
  - Code highlighting
  - Interface de progression

#### Bibliothèques partagées
- `lib/seeded-random.js` : PRNG déterministe (Mulberry32)
  - Tests unitaires complets
  - Documentation et exemples
  - Support des ranges et distributions

- `lib/gamekit.js` : SDK pour les jeux
  - Communication portail ↔ jeu via postMessage
  - API scores, assets, lifecycle hooks
  - Documentation complète

#### Parcours pédagogiques
- Structure pour epics (contenus de formation)
- Format JSON pour métadonnées
- Slides en Markdown
- Script de build pour génération du catalogue

#### Infrastructure
- Configuration Docker pour environnement de développement
- Makefile avec commandes développement :
  - `make init` : Initialisation
  - `make shell` : Shell de développement
  - `make serve` : Serveur local
  - `make test` : Exécution des tests
  - `make lint` : Vérification du code
  - `make build` : Build des catalogues

#### CI/CD
- Workflow CI (`.github/workflows/ci.yml`) :
  - Lint avec ESLint
  - Tests avec Jest et coverage Codecov
  - Build validation

- Workflow Deploy (`.github/workflows/deploy.yml`) :
  - Déploiement automatique sur GitHub Pages
  - Build des catalogues (catalogue, parcours, bookmarks)

- Workflow Security Audit (`.github/workflows/security-audit.yml`) :
  - npm audit pour vulnérabilités CVE
  - ESLint security avec plugins
  - Trivy scan (vulnérabilités, secrets, misconfig)
  - GitLeaks pour détection de secrets
  - Analyse Docker avec Hadolint
  - Vérification packages obsolètes
  - Rapport consolidé automatique

- Configuration Dependabot :
  - Mises à jour automatiques npm (dev + prod)
  - Mises à jour GitHub Actions
  - Mises à jour images Docker
  - Groupement et labels automatiques

- Configuration Codecov :
  - Target auto basé sur historique
  - 80% minimum sur nouveau code (patch)
  - Commentaires PR avec diff layout

#### Tests
- Configuration Jest pour tests unitaires
- Tests pour `SeededRandom` avec 100% coverage
- Tests pour `parcours-viewer` avec 90%+ coverage
- Support ES modules
- Scripts npm : `test`, `test:watch`, `test:coverage`

#### Documentation
- README principal avec vue d'ensemble
- CLAUDE.md avec instructions pour Claude Code
- docs/FEATURES.md : Liste features MVP par phase
- docs/CONCEPTS.md : Définitions et glossaire
- docs/guides/ :
  - architecture.md : Design système complet
  - contributing.md : Workflow de contribution
  - create-tool.md : Créer un tool
  - create-game-engine.md : Créer un moteur de jeu
  - create-game-client.md : Créer l'UI d'un jeu
  - create-bot.md : Créer un bot IA
  - create-epic.md : Créer un parcours pédagogique
- docs/SECURITY_*.md : Documentation sécurité (4 fichiers)
- openspec/ : 10 spécifications techniques détaillées

#### Workflow OpenSpec
- Structure de base OpenSpec
- Commandes slash :
  - `/openspec:proposal` : Créer une proposition
  - `/openspec:apply` : Implémenter un changement
  - `/openspec:archive` : Archiver après déploiement
- Spécifications pour tous les composants majeurs
- Archive des proposals complétées

#### Scripts de build
- `src/scripts/build-catalogue.js` : Génération catalogue.json
- `scripts/build-parcours.js` : Génération parcours.json
- `scripts/build-bookmarks.js` : Génération bookmarks.json
- Validation des manifests (tool.json, game.json, epic.json)
- Génération automatique des métadonnées

#### Configuration
- ESLint avec règles strictes
- Prettier pour formatage code
- TypeScript definitions (@types/node, @types/jest)
- Git hooks (à venir)

### Changed
- N/A (version initiale)

### Deprecated
- N/A (version initiale)

### Removed
- N/A (version initiale)

### Fixed
- N/A (version initiale)

### Security
- Scan de sécurité automatique quotidien (6h UTC)
- Détection de secrets avec GitLeaks
- Audit vulnérabilités npm
- Analyse statique de sécurité (ESLint + Trivy)
- Analyse Docker avec Hadolint

---

## Format des versions

Ce projet suit [Semantic Versioning](https://semver.org/lang/fr/) :

```
MAJOR.MINOR.PATCH

Exemples :
1.0.0 - Release stable
0.2.0 - Nouvelle feature (MVP)
0.1.1 - Correction de bug
```

### Types de changements

- **Added** : Nouvelles fonctionnalités
- **Changed** : Modifications de fonctionnalités existantes
- **Deprecated** : Fonctionnalités obsolètes (à supprimer)
- **Removed** : Fonctionnalités supprimées
- **Fixed** : Corrections de bugs
- **Security** : Corrections de vulnérabilités

### Convention de commits

Les commits suivent [Conventional Commits](https://www.conventionalcommits.org/) :

```
feat: Nouvelle fonctionnalité       → Added
fix: Correction de bug               → Fixed
chore: Maintenance                   → Changed
docs: Documentation                  → Changed
refactor: Refactoring                → Changed
perf: Performance                    → Changed
test: Tests                          → (pas dans changelog)
ci: CI/CD                            → (pas dans changelog)
style: Formatage                     → (pas dans changelog)
```

### Liens

- [Documentation complète](./docs/)
- [Guide de contribution](./docs/guides/contributing.md)
- [Dépôt GitHub](https://github.com/z4ppy/playlab42)
- [Site web](https://z4ppy.github.io/playlab42/)

---

*Maintenu par l'équipe Docaposte*
