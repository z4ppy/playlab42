# Playlab42 - Instructions pour agents IA

Ce fichier contient les instructions pour les assistants IA (Claude Code, GitHub Copilot, Cursor, Aider, etc.) travaillant sur ce projet.

## À propos du projet

**Playlab42** est une plateforme pédagogique de mini-jeux et outils collaboratifs pour la formation dev assistée par IA.

**Version actuelle** : Standalone (100% frontend, pas de backend).

### Architecture

| Composant | Description |
|-----------|-------------|
| **Tools** | Outils HTML standalone (un fichier, pas de backend) |
| **Games** | Jeux autonomes avec moteur isomorphe et bots |
| **Parcours** | Contenus pédagogiques en slides HTML (Epics) |
| **Portal** | Catalogue unifié, charge tools/games/parcours |
| **GameKit** | SDK pour les jeux (assets, scores, hooks) |
| **Lib** | Utilitaires partagés (SeededRandom, theme, etc.) |

### Concepts clés

- **Tool** : Outil HTML standalone (un fichier, ouvrable directement)
- **Game** : Mini-app standalone avec moteur de règles et bots
- **GameEngine** : Moteur isomorphe, JavaScript pur, déterministe
- **Bot** : IA pluggable pour remplacer les joueurs humains
- **Epic** : Parcours pédagogique composé de slides HTML
- **GameKit** : SDK pour communication portail ↔ jeu

### Objectif pédagogique

Support de formation où les participants créent des outils, jeux et parcours avec assistance IA.
Le projet s'enrichit des contributions de chaque session.

**Qualité code** : Ce projet étant un support de cours, le code doit être exemplaire :
- Bien commenté en français
- Nommage explicite
- Tests unitaires systématiques
- Documentation JSDoc exhaustive

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

# Linting et qualité
make lint               # Vérifie lib/, games/, scripts/, etc.
make test               # Lance les tests Jest
make test-watch         # Mode watch

# Sécurité
make audit              # Audit npm des dépendances
make security           # Audit complet (npm + Docker)
```

**Ne jamais exécuter npm, node, ou autres outils directement sur le host.**

### Multi-worktree

Le projet supporte le développement parallèle via git worktrees. Chaque worktree obtient automatiquement un nom de projet Docker et un port uniques. Utiliser `make info` pour voir l'instance courante.

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

## Commandes slash disponibles

- `/openspec:proposal` - Créer une nouvelle proposition de changement
- `/openspec:apply` - Implémenter un changement approuvé
- `/openspec:archive` - Archiver après déploiement

## Conventions

- **Langue** : Commentaires et commits en français
- **Code** : JavaScript (ES modules), fonctions pures quand possible
- **Nommage** : camelCase (variables), PascalCase (types), kebab-case (fichiers)
- **Simplicité** : Préférer solutions simples, éviter over-engineering
- **Isomorphisme** : Les moteurs de jeux doivent tourner client ET serveur
- **Docker-first** : Tout dans le container, rien sur le host

## Stack technique

| Aspect | Choix |
|--------|-------|
| Langage | JavaScript (ES2024+) + TypeScript (optionnel) |
| Runtime | Node.js 25+ (Alpine) |
| Build TS | esbuild (transpilation rapide) |
| Tests | Jest + ts-jest |
| Linting | ESLint |
| Infra | Docker, Docker Compose |
| CI/CD | GitHub Actions |
| Hébergement | GitHub Pages |
| Workflow | OpenSpec |

## TypeScript (optionnel)

Le projet supporte TypeScript pour les tools, games et epics complexes. L'utilisation de TypeScript est **optionnelle** - les fichiers JavaScript existants continuent de fonctionner.

### Commandes TypeScript

```bash
make typecheck      # Vérifier les types (tsc --noEmit)
make build-ts       # Transpiler .ts → .js (dans dist/)
```

### Structure d'un tool TypeScript

```
tools/my-tool/
├── index.html          # Importe depuis ./dist/main.js
├── tool.json           # Manifest avec "typescript": true
├── src/
│   ├── main.ts         # Point d'entrée
│   ├── types.ts        # Types et interfaces
│   └── *.ts            # Autres modules
├── dist/               # Fichiers transpilés (généré)
│   ├── main.js
│   └── *.js
└── __tests__/
    └── *.test.ts       # Tests en TypeScript
```

### Conventions TypeScript

1. **Imports ESM (code source)** : Utiliser `.js` dans les imports (même pour les fichiers `.ts`)
   ```typescript
   // Dans src/*.ts - pour le navigateur qui charge les .js transpilés
   import { Simulation } from './Simulation.js';  // ✅ Correct
   import { Simulation } from './Simulation';     // ❌ Le navigateur ne trouvera pas le fichier
   ```

2. **Imports dans les tests** : Importer **sans extension** dans les fichiers de test
   ```typescript
   // Dans __tests__/*.test.ts - Jest utilise un resolver personnalisé
   import { Simulation } from '../src/Simulation';  // ✅ Jest résout .ts automatiquement
   import { Simulation } from '../src/Simulation.js';  // ⚠️ Fonctionne aussi mais moins idiomatique
   ```

   > **Pourquoi cette différence ?** Le code source est transpilé vers `.js` et exécuté dans le navigateur qui a besoin du chemin exact. Les tests sont exécutés par Jest qui utilise `jest.resolver.cjs` pour résoudre `.js` → `.ts` automatiquement.

3. **Types partagés** : Utiliser `lib/types/` pour les types communs
   ```typescript
   import type { GameEngine, Bot } from '@lib/types/game-engine.js';
   ```

4. **Strict mode** : Le projet utilise `"strict": true` dans tsconfig.json

### Workflow de développement

```bash
# 1. Développer avec watch
make build-ts:watch     # Transpile automatiquement à chaque modification

# 2. Tester
make test               # Exécute tous les tests (JS + TS)

# 3. Vérifier avant commit
make typecheck          # Vérification des types
make lint               # Lint (exclut dist/)
make build-ts           # Regénérer les fichiers dist/
```

### Déploiement (GitHub Pages)

**IMPORTANT** : Les fichiers `dist/` des tools TypeScript **doivent être versionnés** car GitHub Pages est un hébergement statique sans étape de build.

```bash
# Avant de commiter un tool TypeScript :
make build-ts                           # Générer les fichiers dist/
git add tools/my-tool/dist/*.js         # Ajouter les fichiers JS (pas les .map)
git commit -m "Ajoute mon tool TypeScript"
```

Le `.gitignore` contient une exception pour `tools/*/dist/` afin de permettre le versionnement des fichiers transpilés tout en excluant les autres dossiers `dist/` du projet.

### Types disponibles

Les types pour les APIs du projet sont dans `lib/types/` :

- `PlayerId`, `Seed` - Types de base
- `GameEngine<State, Action, PlayerView, Config>` - Interface moteur de jeu
- `Bot<PlayerView, Action>` - Interface bot IA
- `BaseGameConfig`, `BaseGameState` - Types de base pour les jeux

Exemple :

```typescript
import type { GameEngine, BaseGameConfig, BaseGameState } from '@lib/types/game-engine.js';

interface MyState extends BaseGameState {
  board: string[];
}

class MyEngine implements GameEngine<MyState, MyAction, MyView, MyConfig> {
  // ...
}
```

## Conventions de tests

### Patterns de fichiers

| Type | Pattern | Exemple |
|------|---------|---------|
| Lib simple | `lib/module.test.{js,ts}` | `lib/seeded-random.test.js` |
| Lib complexe | `lib/module/__tests__/*.test.{js,ts}` | `lib/parcours/__tests__/progress.test.js` |
| Lib TypeScript | `lib/types/*.test.ts` | `lib/types/index.test.ts` |
| Games | `games/[id]/engine.test.{js,ts}` | `games/tictactoe/engine.test.js` |
| Tools JS | `tools/[id]/__tests__/*.test.js` | `tools/relativity-lab/__tests__/Physics.test.js` |
| Tools TS | `tools/[id]/__tests__/*.test.ts` | `tools/particle-life/__tests__/Simulation.test.ts` |
| Scripts | `scripts/*.test.js` | `scripts/parcours-utils.test.js` |

### Mocks pour les dépendances CDN

Les tools peuvent utiliser des librairies CDN (Three.js, lil-gui...). Les mocks sont dans `tools/__mocks__/` :

- `three.js` - Mock minimal de Three.js (Vector3, Color, Scene...)
- `three-addons.js` - Mock des addons (OrbitControls...)
- `lil-gui.js` - Mock de lil-gui

Ces mocks sont automatiquement utilisés par Jest via `moduleNameMapper` dans `jest.config.js`.

### Bonnes pratiques

- Nommer les tests en français avec des descriptions claires
- Inclure la formule/comportement attendu dans les commentaires
- Utiliser `describe` pour grouper les tests par fonction/comportement
- Prévoir les cas limites (valeurs extrêmes, erreurs...)

## Structure du projet

```
playlab42/
├── index.html                # Portail principal
├── style.css                 # Styles du portail
├── app.js                    # Logique du portail
├── lib/                      # Bibliothèques partagées
│   ├── gamekit.js            # SDK pour les jeux
│   ├── theme.js              # Gestion thème clair/sombre
│   ├── seeded-random.js      # PRNG déterministe
│   ├── parcours-viewer.js    # Viewer de parcours (orchestration)
│   └── parcours/             # Modules du viewer de parcours
│       ├── ParcoursProgress.js    # Gestion progression
│       ├── ParcoursNavigation.js  # Navigation entre slides
│       └── ParcoursUI.js          # Rendu HTML
├── app/                      # Modules du portail (en cours de refactoring)
│   ├── state.js              # État global
│   ├── storage.js            # Persistence localStorage
│   └── dom-cache.js          # Cache éléments DOM
├── tools/                    # Outils HTML standalone
│   ├── [tool-name]/
│   │   ├── index.html        # Un fichier = un outil
│   │   └── tool.json         # Manifest
├── games/                    # Jeux autonomes
│   └── [game-id]/
│       ├── index.html        # Point d'entrée standalone
│       ├── engine.js         # Moteur isomorphe
│       ├── game.json         # Manifest
│       ├── thumb.png         # Vignette
│       └── bots/             # Bots IA
├── parcours/                 # Contenus pédagogiques
│   ├── index.json            # Config taxonomie
│   └── epics/
│       └── [epic-id]/
│           ├── epic.json     # Manifest de l'epic
│           ├── thumbnail.svg # Vignette
│           └── slides/       # Slides HTML
├── data/                     # Données générées (par build, non versionnées)
│   ├── catalogue.json        # DB des tools/games
│   ├── parcours.json         # DB des parcours
│   └── bookmarks.json        # DB des bookmarks
├── scripts/                  # Scripts de build
│   ├── build-catalogue.js    # Génère catalogue.json
│   ├── build-parcours.js     # Génère parcours.json
│   ├── build-bookmarks.js    # Génère bookmarks.json
│   └── lib/                  # Utilitaires partagés
│       └── build-utils.js    # Fonctions communes aux scripts
├── docs/                     # Documentation
└── openspec/                 # Spécifications et proposals
    ├── specs/                # Specs techniques
    ├── changes/              # Proposals en cours
    └── archive/              # Changes archivés
```

## Spécifications techniques

Les specs détaillées sont dans `openspec/specs/` :

| Spec | Description |
|------|-------------|
| [platform](openspec/specs/platform/spec.md) | Architecture, structure projet |
| [catalogue](openspec/specs/catalogue/spec.md) | Format JSON, script de build |
| [parcours](openspec/specs/parcours/spec.md) | Système de parcours pédagogiques |
| [seeded-random](openspec/specs/seeded-random/spec.md) | PRNG déterministe Mulberry32 |
| [game-engine](openspec/specs/game-engine/spec.md) | Interface moteur de jeu |
| [bot](openspec/specs/bot/spec.md) | Interface IA, slots joueurs |
| [manifests](openspec/specs/manifests/spec.md) | Formats tool.json, game.json |
| [portal](openspec/specs/portal/spec.md) | Interface utilisateur |
| [gamekit](openspec/specs/gamekit/spec.md) | SDK pour les jeux |
| [theme](openspec/specs/theme/spec.md) | Système de thèmes clair/sombre |

## Références documentation

- `docs/FEATURES.md` - Liste des features MVP par phase
- `docs/CONCEPTS.md` - Définitions et glossaire
- `docs/CATALOGUE-BUILD.md` - Workflow de build des catalogues
- `openspec/project.md` - Conventions du projet

## Guidelines pour agents IA

### Bonnes pratiques

1. **Lire avant de modifier** : Toujours lire un fichier avant de le modifier
2. **Tests** : Lancer `make test` après toute modification de code
3. **Lint** : Vérifier avec `make lint` avant de commiter
4. **Docker** : Ne jamais exécuter de commandes npm/node directement sur le host
5. **Commits** : Messages en français, descriptifs et concis
6. **Branches** : Créer une branche pour chaque feature/fix

### Workflow recommandé

```bash
# 1. Créer une branche
git checkout -b feature/ma-feature

# 2. Développer avec Docker
make shell
# ou
docker compose exec dev npm run ...

# 3. Vérifier la qualité
make lint
make test
make audit

# 4. Commiter
git add .
git commit -m "Description en français"

# 5. Push et PR
git push -u origin feature/ma-feature
```

### Points d'attention

- Les fichiers `data/*.json` sont générés au build et **non versionnés** (dans `.gitignore`)
- Toujours lancer `npm run build` ou `make build` pour régénérer les catalogues
- Les parcours utilisent un système de taxonomie avec threshold (min 3 epics par catégorie)
- Les moteurs de jeux doivent être déterministes (utiliser SeededRandom)
- Le projet est 100% statique, pas de backend requis

## Contexte utilisateur

- Prénom : Cyrille
- Organisation : Docaposte
