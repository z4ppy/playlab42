# Changelog

Tous les changements notables de ce projet seront documentés dans ce fichier.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/),
et ce projet adhère au [Semantic Versioning](https://semver.org/lang/fr/).

## [Unreleased]

### Changed
- CI : les workflows s'exécutent sur Node 26 au lieu de Node 20, pour tester
  sur le runtime réellement déployé (`node:26-alpine` au Dockerfile). Node 20
  n'a plus reçu de version depuis mars 2026. Huit occurrences alignées dans
  `ci.yml`, `deploy.yml` et `security-audit.yml`

## [0.2.0] - 2026-09-18

Deuxième itération du MVP : quatre nouveaux jeux, trois nouveaux outils, sept
nouveaux parcours pédagogiques, navigation par hash router et chaîne de build
TypeScript optionnelle.

### Added

#### Jeux
- **Go 9x9** : Plateau de Go en format réduit pour l'initiation
- **Diese & Mat** : Jeu d'apprentissage musical
  - Clavier piano interactif et presets d'instruments générés dynamiquement
  - Métronome, accordeur et synthétiseur avec panneau de contrôle avancé
  - Synthétiseurs spécialisés (guitares, percussions), effets et sustain prolongé
  - Architecture MVC (EventEmitter, controllers, DataManager) et tests unitaires
- **Mastermind** : Jeu de déduction classique (humain décodeur vs ordinateur codeur)
  - Moteur isomorphe avec génération seedée du code secret
  - Interface intuitive avec feedback automatique (pions noirs/blancs)
  - 6 couleurs, 4 pions, 10 tentatives maximum
  - Tests unitaires complets (>90% coverage)
  - Déterminisme garanti pour replay
- **Triomino** : Jeu de tuiles triangulaires avec améliorations UX

#### Tools (Outils standalone)
- **Neural Style Transfer** : Transfert de style neuronal dans le navigateur
- **Relativity Lab** : Laboratoire de relativité en 3D, premier tool « complexe »
  (sous-dossier avec `src/`, `ui/` et tests) — le catalogue supporte désormais
  les tools multi-fichiers en plus des tools mono-fichier
- **Particle Life** : Simulation de vie artificielle par particules

#### Parcours pédagogiques
- Sept nouveaux epics : « Coding Agents en 2025 », « Guide GitHub Copilot »,
  « Guide d'utilisation OpenSpec », « Introduction au Deep Learning »,
  « Le Paradigme As-Code », « Développement parallèle avec des agents IA »,
  « Complexité algorithmique »
- Système de glossaire (`parcours/glossary.json`) : termes cliquables dans les
  slides et page de glossaire dédiée
- Injection automatique d'une table des matières dans les slides
- Sidebar redimensionnable (capture souris fluide)
- Bannières et miniatures pour les epics

#### Plateforme
- Système de navigation par hash router (`app/router.js`) : URLs partageables et
  navigation arrière/avant du navigateur pour les parcours, jeux et tools
- Favicon SVG colibri (style origami)
- Vignettes uniformisées pour l'ensemble des jeux et tools (format 380x180)
- Support TypeScript optionnel pour les tools : `npm run build:ts`,
  `npm run typecheck`, résolveur Jest `.js` → `.ts`, build TS intégré au
  workflow de déploiement

#### Documentation
- Documentation des pipelines CI/CD (`.github/docs/PIPELINES.md`)
- Guide de déploiement et release (`docs/DEPLOYMENT.md`)
- Guide de démarrage pour nouveaux contributeurs (`docs/GETTING_STARTED.md`)
- Guide de résolution de problèmes (`docs/TROUBLESHOOTING.md`)
- Stratégie de tests (`docs/TESTING_STRATEGY.md`)
- Guide de gestion des secrets (`.github/docs/SECRETS_MANAGEMENT.md`)

### Changed
- **Licence : MIT → CC BY-NC-SA 4.0** (`LICENSE`, champ `license` de
  `package.json`). Changement restrictif, pas un ajout de documentation :
  l'usage commercial n'est plus autorisé et les œuvres dérivées doivent être
  partagées dans les mêmes conditions. Les versions jusqu'à 0.1.0 incluse
  restent disponibles sous MIT.
- **Chaîne TypeScript** : `ts-jest` remplacé par `esbuild` et passage à
  TypeScript 7 (builds et tests nettement plus rapides)
- **Architecture modulaire** : `app.js` découpé en 11 modules (`app/`) et
  `ParcoursViewer` refactorisé en composants (`parcours/_shared/`)
- **Catalogues as-code** : scripts de build déplacés de `src/scripts/` vers
  `scripts/` et génération unifiée (catalogue, parcours, bookmarks)
- `escapeHtml()` centralisé dans `lib/dom.js`
- Bookmarks : réorganisation des catégories, amélioration du fetch des
  métadonnées OpenGraph et du positionnement de la popup
- Documentation : `AGENTS.md` agnostique remplace `CLAUDE.md`, organisation
  renommée « Docaposte », badges Security Audit / License / Node.js au README
- Image Docker : `node:25-alpine` → `node:26-alpine`
- Mise à jour des dépendances de développement : ESLint 9 → 10, marked 17 → 18,
  Jest 30.5.2, `@types/node` 26, globals 17, Prettier 3.9.8
- Mise à jour des GitHub Actions : `checkout` 4 → 6, `setup-node` 4 → 6,
  `upload-artifact` 4 → 7, `download-artifact` 4 → 8,
  `upload-pages-artifact` 3 → 5, `configure-pages` 5 → 6, `deploy-pages` 4 → 5,
  `codeql-action` 3 → 4, `codecov-action` 5 → 7, `github-script` 8 → 9
- Couverture de tests étendue (`lib/`, `parcours/`, `router.js`, `checkers`,
  `Physics.js`, scripts de build)

### Fixed
- Chemins absolus corrigés en chemins relatifs : le déploiement sur GitHub Pages
  avec un sous-chemin ne renvoie plus de 404 (portail, checkers, tools)
- Double échappement HTML dans les titres de slides (affichage de `&#039;`)
- Réutilisation du viewer de parcours entre deux ouvertures
- Thème clair/sombre non respecté (checkers, article Deep Learning)
- Triomino : bugs CSS, validation de la rotation et portée ESLint
- Mastermind : règles corrigées pour la version « humain décodeur uniquement »
- `openTool()` : support des chemins simples et complexes
- Erreurs ESLint liées à la compatibilité `@eslint/js` 10
- CI : permissions explicites sur le job `security-report`, `gitleaks-action`
  remplacé par le CLI gratuit
- Routage : les motifs de hash sont ancrés en début et en fin. Un identifiant
  invalide n'est plus tronqué en identifiant valide — `#/games/with_underscore`
  n'ouvre plus le jeu « with ». Trois assertions préexistantes de
  `app/router.test.js` le vérifiaient déjà sans jamais être exécutées
- Preview des bookmarks : l'erreur de chargement d'une image ne remplace plus
  par une icône erronée la preview du bookmark survolé ensuite (la preview est
  un élément unique réutilisé ; le handler `onerror` de l'image précédente
  vivait plus longtemps qu'elle)
- Preview des bookmarks : plus d'attributs `width`/`height` sur l'image OG
  distante, dont les dimensions réelles (640x360, 316x316…) ne sont pas celles
  des vignettes locales 380x180. La place reste réservée par l'`aspect-ratio`
  du conteneur
- Build des bookmarks : les images déjà présentes dans
  `data/bookmarks-images/` ne sont plus re-téléchargées à chaque expiration du
  cache de métadonnées, ce qui écrasait les images optimisées par leur original
  pleine taille. Forçage possible via `OG_REFRESH_IMAGES=1`
- Build des bookmarks : quand une page est injoignable (CI sans réseau
  sortant, site hors ligne, User-Agent bloqué), l'image versionnée de
  `data/bookmarks-images/` prend le relais au lieu d'être ignorée. La preview
  gardait auparavant son emoji de repli alors que le fichier était présent.
  Le rapport de build distingue désormais ces cas
- Build des bookmarks : le minuteur de `fetch` n'était pas libéré quand la
  requête échouait — sur 120 URLs hors ligne, autant de minuteurs de 8 s
  retenaient le processus après la fin du travail
- Tests : les suites de `app/` (catalogue, router, game-loader, bookmarks) sont
  désormais exécutées. Elles étaient exclues de `testMatch` dans
  `jest.config.js` et n'avaient donc jamais tourné

### Security
- Toutes les vulnérabilités npm connues sont corrigées (`npm audit` : 0
  vulnérabilité) : `fast-uri` (high), `js-yaml` (high), `@humanfs/node`
  (moderate)
- Correctifs antérieurs : ReDoS dans `ajv` et `minimatch`, DoS dans `flatted`
- Suppression du bloc `overrides` de `package.json`, devenu inutile après les
  mises à jour amont (chaque retrait validé par `npm audit`)
- CI : `apt-key` (déprécié) remplacé par `gpg --dearmor` + `signed-by` dans
  le workflow d'audit de sécurité (`.github/workflows/security-audit.yml`)
- Conteneur de développement : le service `dev` s'exécute sous l'UID/GID de
  l'utilisateur host (`user:` dans `docker-compose.yml`) et non en root.
  Le bloc `devuser` du Dockerfile reste volontairement désactivé : sur
  `node:26-alpine`, l'UID/GID 1000 est déjà occupé par l'utilisateur `node` et
  sa recréation casse le build (`addgroup: gid '1000' in use`)
- Renforcement de la sécurité et de l'accessibilité côté parcours (protection
  XSS, attributs ARIA)

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
