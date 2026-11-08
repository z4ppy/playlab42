# Guide de démarrage

Bienvenue sur **Playlab42** ! Ce guide vous accompagne dans la mise en place de votre environnement de développement et vos premières contributions.

Pour simplement utiliser la plateforme, [la démo en ligne](https://z4ppy.github.io/playlab42/) suffit : rien à installer.

## Table des matières

1. [Deux façons de travailler](#deux-façons-de-travailler)
2. [Démarrage avec Node.js](#démarrage-avec-nodejs)
3. [Démarrage avec Docker](#démarrage-avec-docker)
4. [Au quotidien](#au-quotidien)
5. [Éléments optionnels](#éléments-optionnels)
6. [Premiers pas](#premiers-pas)
7. [Workflow de contribution](#workflow-de-contribution)
8. [Prochaines étapes](#prochaines-étapes)

## Deux façons de travailler

| | Node.js local | Docker |
|---|---|---|
| **Prérequis** | Git, Node.js 24 ou plus, environ 1 Go libre | Git, Docker avec Docker Compose, Make |
| **Pour qui** | Découvrir le projet, contribution ponctuelle | Contribution régulière, environnement identique à la CI, plusieurs worktrees |
| **Commandes** | `npm …` | `make …` et `make npm CMD="…"` |

L’environnement de référence du projet reste **Docker-first** : la CI et les agents utilisent le conteneur (Node.js 26). La voie Node.js directe sert le même site et suffit pour découvrir le projet ou proposer une première contribution.

### Vérifier les installations

```bash
git --version             # Git 2.30 ou plus
node --version            # voie Node.js : v24 ou plus
docker compose version    # voie Docker : Docker Compose 2 ou plus
make --version            # voie Docker : GNU Make 4 ou plus
```

Pour proposer vos changements, il vous faut aussi un compte [GitHub](https://github.com/) ; une [clé SSH](https://docs.github.com/fr/authentication/connecting-to-github-with-ssh) est recommandée.

## Démarrage avec Node.js

```bash
git clone https://github.com/z4ppy/playlab42.git && cd playlab42
npm ci
npm start        # puis ouvrir http://localhost:5242
```

- `npm ci` installe les dépendances (environ 1 min 30 ; npm peut signaler des scripts d’installation non approuvés, sans effet sur le build).
- `npm start` lance `build:dev` (TypeScript, catalogues, parcours, liens sans aperçus réseau), puis `serve`, précédé automatiquement de `build:runtime` et `build:guides`. Comptez de 20 secondes à 1 min 30.
- Le serveur écoute sur le port **5242**. Arrêtez-le avec Ctrl+C. Pour relancer sans reconstruire : `npm run serve`.

Ni Docker ni réseau ne sont nécessaires après `npm ci`, sauf pour les [éléments optionnels](#éléments-optionnels).

## Démarrage avec Docker

Les dépendances et les commandes Node.js tournent dans le conteneur ; rien n’est installé sur votre machine en dehors de Docker.

```bash
git clone https://github.com/z4ppy/playlab42.git
cd playlab42

# Construire l’image, démarrer le conteneur et installer les dépendances
make init

# Préparer les contenus, catalogues et guides sans enrichissement réseau
make npm CMD="run build:dev"

# Afficher l’URL locale, puis lancer le serveur
make info
make serve
```

Ouvrez l’URL affichée par `make info`. Le port externe est calculé à partir du nom du dossier, dans la plage **5200–5299** ; `5242` est le port interne du conteneur, celui que le serveur affiche dans ses journaux.

`make init` construit l’image (Node.js 26 Alpine), démarre le conteneur et installe les dépendances : comptez 2 à 5 minutes la première fois, selon la connexion. `make status` indique ensuite si le conteneur tourne.

### Travailler sur plusieurs branches en parallèle

Chaque worktree utilise un nom de projet Docker et un port calculés à partir de son dossier. Initialisez l’environnement dans chaque worktree avec `make init`, puis consultez son URL avec `make info`.

La plage de ports étant limitée, une collision reste possible. Pour choisir explicitement le port d’une instance, utilisez le même réglage pour toutes ses commandes :

```bash
export PLAYLAB_PORT=5280
make init
make info
make serve
```

## Au quotidien

| Docker | Node.js local | Usage |
|--------|---------------|-------|
| `make shell` | — | Ouvrir un shell dans le conteneur |
| `make npm CMD="run build:dev"` | `npm run build:dev` | Reconstruire contenus et catalogues sans enrichissement réseau |
| `make npm CMD="run build"` | `npm run build` | Build de publication complet, avec aperçus des liens (nécessite les poids GPT-2, voir ci-dessous) |
| `make build-ts` | `npm run build:ts` | Transpiler les contenus TypeScript |
| `make npm CMD="run build:ts:watch"` | `npm run build:ts:watch` | Transpiler TypeScript en continu |
| `make serve` | `npm run serve` | Servir le site (avec `build:runtime` et `build:guides` en préalable) |
| `make test` | `npm test` | Exécuter les tests Jest |
| `make test-e2e` | `npm run test:e2e` | Exécuter les parcours navigateur (image Docker dédiée côté `make`) |
| `make lint` | `npm run lint` | Vérifier la qualité du code |
| `make typecheck` | `npm run typecheck` | Vérifier les types |
| `make openspec-validate` | `npm run openspec:validate` | Valider strictement les spécifications |
| `make down` | — | Arrêter les conteneurs |

`make build` construit l’**image Docker**, pas les catalogues. `make clean` supprime conteneurs, volumes et `node_modules`. `make help` liste toutes les cibles.

### Sécurité

```bash
make security-audit      # Audit de sécurité complet
make security-npm        # Audit npm seulement
make security-eslint     # ESLint security
```

## Éléments optionnels

- **Laboratoire GPT-2** (parcours « Anatomie d’un LLM ») : l’étape s’affiche sans rien préparer, mais le modèle ne se charge qu’avec les poids locaux. Préparez-les avec `npm run prepare:gpt2` (ou `make npm CMD="run prepare:gpt2"`) : environ 657 Mo à télécharger.
- **Aperçus des liens** : `build:dev` utilise `--skip-og` et ne récupère pas les aperçus OpenGraph des bookmarks ; `npm run build` les enrichit par le réseau.
- **Archive de publication** : `build:local` et `build` produisent aussi `site/` et sa provenance, l’artefact déployé sur GitHub Pages. Ils exigent les poids GPT-2 : lancez `prepare:gpt2` d’abord. Le serveur local n’utilise pas `site/` : il sert la racine du dépôt.

## Premiers pas

### 1. Parcourir le code

La carte du dépôt est dans [Architecture en bref](./ARCHITECTURE.md#se-repérer-dans-le-dépôt) ; le détail des composants dans le [guide Architecture](./guides/architecture.md).

### 2. Exécuter les tests et les contrôles

```bash
make test                         # ou npm test
make test-watch                   # ou npm run test:watch
make npm CMD="run test:coverage"  # ou npm run test:coverage
make lint                         # ou npm run lint
make lint-fix                     # ou npm run lint:fix
```

### 3. Tester le portail localement

Lancez le serveur (`npm start` ou `make serve`), puis vérifiez :

- [ ] Le portail se charge
- [ ] Les onglets Parcours, Outils, Jeux et Liens affichent leurs cartes
- [ ] Un outil ou un jeu s’ouvre
- [ ] La console du navigateur ne montre pas d’erreur

## Workflow de contribution

### Contribuer à Playlab42

```
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│  Fork   │ →  │ Branch  │ →  │  Code   │ →  │   PR    │
└─────────┘    └─────────┘    └─────────┘    └─────────┘
```

### 1. Fork et clone

**Si vous n'avez pas accès direct au dépôt** :

```bash
# 1. Fork sur GitHub (bouton "Fork")
# 2. Cloner votre fork
git clone git@github.com:VOTRE-USERNAME/playlab42.git
cd playlab42

# 3. Ajouter le remote upstream
git remote add upstream git@github.com:z4ppy/playlab42.git
```

### 2. Créer une branche feature

```bash
# Créer et basculer sur une nouvelle branche
git checkout -b feature/ma-fonctionnalite

# Ou pour un bug fix
git checkout -b fix/correction-bug
```

**Convention de nommage** :
- `feature/description-courte` : Nouvelle fonctionnalité
- `fix/description-courte` : Correction de bug
- `docs/description-courte` : Documentation
- `refactor/description-courte` : Refactoring
- `test/description-courte` : Tests

### 3. Développer

**Créer un tool** :

```bash
# Suivre le guide
# → docs/guides/create-tool.md
```

**Créer un game** :

```bash
# Suivre les guides
# → docs/guides/create-game-engine.md
# → docs/guides/create-game-client.md
```

**Créer un epic (parcours)** :

```bash
# Suivre le guide
# → docs/guides/create-epic.md
```

### 4. Tester

```bash
# Tests unitaires
make test

# Linter
make lint

# Build
make npm CMD="run build:dev"

# Serveur local
make serve
# → Tester manuellement dans le navigateur
```

### 5. Commit

```bash
# Ajouter les fichiers
git add .

# Commit avec message descriptif
git commit -m "feat: ajout du tool JSON Formatter"
```

**Convention de commits** ([Conventional Commits](https://www.conventionalcommits.org/)) :

```
<type>: <description>

Types :
- feat: Nouvelle fonctionnalité
- fix: Correction de bug
- docs: Documentation
- style: Formatage (pas de changement de code)
- refactor: Refactoring
- test: Ajout/modification de tests
- chore: Maintenance (build, config, etc.)
```

**Exemples** :

```bash
git commit -m "feat: ajout du tool Base64 Encoder"
git commit -m "fix: correction bug affichage catalogue"
git commit -m "docs: amélioration README"
git commit -m "test: ajout tests pour SeededRandom"
```

### 6. Push

```bash
# Push vers votre fork (ou branch)
git push origin feature/ma-fonctionnalite
```

### 7. Ouvrir une Pull Request

**Sur GitHub** :

1. Aller sur https://github.com/z4ppy/playlab42
2. Cliquer sur "Pull requests" > "New pull request"
3. Sélectionner votre branche
4. Remplir le template de PR :
   - **Titre** : Description courte et claire
   - **Description** : Contexte, changements, tests
   - **Checklist** : Cocher les cases applicables
5. Cliquer sur "Create pull request"

**Les checks CI vont s'exécuter** :
- Lint
- Tests
- Build
- Security audit

**Attendre la review** :
- Un mainteneur reviewera votre code
- Apporter les modifications demandées si nécessaire
- Une fois approuvée, la PR sera mergée

### 8. Après le merge

```bash
# Mettre à jour votre branche main locale
git checkout main
git pull upstream main  # ou origin main

# Supprimer la branche feature
git branch -d feature/ma-fonctionnalite
```

## Prochaines étapes

### Documentation à lire

**Pour tous** :
- [docs/CONCEPTS.md](./CONCEPTS.md) - Comprendre les concepts clés
- [docs/FEATURES.md](./FEATURES.md) - Voir les features MVP

**Pour créer du contenu** :
- [docs/guides/create-tool.md](./guides/create-tool.md) - Créer un tool
- [docs/guides/create-game-engine.md](./guides/create-game-engine.md) - Créer un moteur de jeu
- [docs/guides/create-game-client.md](./guides/create-game-client.md) - Créer l'UI d'un jeu
- [docs/guides/create-bot.md](./guides/create-bot.md) - Créer un bot IA
- [docs/guides/create-epic.md](./guides/create-epic.md) - Créer un parcours

**Pour contribuer au core** :
- [docs/ARCHITECTURE.md](./ARCHITECTURE.md) - Architecture en bref
- [docs/guides/architecture.md](./guides/architecture.md) - Architecture détaillée
- [docs/guides/contributing.md](./guides/contributing.md) - Guide de contribution complet
- [openspec/project.md](../openspec/project.md) - Conventions du projet

### Exemples de première contribution

**Facile** :
- Ajouter un tool simple (JSON formatter, Base64 encoder)
- Corriger une typo dans la documentation
- Améliorer un test existant

**Moyen** :
- Ajouter un nouveau game simple (Snake, Memory)
- Créer un epic (parcours pédagogique)
- Améliorer l'UI du portail

**Avancé** :
- Créer un bot IA pour un game existant
- Ajouter une fonctionnalité au GameKit
- Améliorer le système de build

### Rejoindre la communauté

- **Issues** : https://github.com/z4ppy/playlab42/issues
- **Questions et idées** : https://github.com/z4ppy/playlab42/issues/new/choose
- **Pull Requests** : https://github.com/z4ppy/playlab42/pulls

### Ressources externes

- [Git - Documentation](https://git-scm.com/doc)
- [Docker - Get Started](https://docs.docker.com/get-started/)
- [JavaScript MDN](https://developer.mozilla.org/fr/docs/Web/JavaScript)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [Jest Documentation](https://jestjs.io/docs/getting-started)

## Troubleshooting

### Docker ne démarre pas

**Symptôme** : `make init` échoue

**Solutions** :

```bash
# Vérifier que Docker est démarré
docker ps

# Redémarrer Docker Desktop (macOS/Windows)
# Ou redémarrer le daemon Docker (Linux)
sudo systemctl restart docker

# Nettoyer et recommencer
make clean
make init
```

### Permissions (Linux)

**Symptôme** : Erreurs de permissions dans le container

**Solution** :

```bash
# Ajouter votre utilisateur au groupe docker
sudo usermod -aG docker $USER

# Se déconnecter/reconnecter pour appliquer
# Ou :
newgrp docker
```

### Port déjà utilisé

**Symptôme** : `make serve` ou `npm run serve` échoue (`EADDRINUSE`).

**Solution** :

```bash
# Docker : choisir un autre port externe pour cette instance
export PLAYLAB_PORT=5280
make init
make info

# Node.js local : identifier le processus qui occupe le port 5242…
lsof -i :5242
# … l’arrêter proprement, ou servir sur un autre port
npx serve . -p 3000 -C
```

### Tests échouent

**Symptôme** : `make test` affiche des erreurs

**Solutions** :

```bash
# Réinstaller les dépendances
make npm CMD="ci"

# Vérifier la version Node.js
make shell
node --version  # v26.x dans le conteneur

# Nettoyer le cache Jest
make npm CMD="run test -- --clearCache"
```

### Build échoue

**Symptôme** : `make npm CMD="run build:dev"` ou `npm run build:dev` échoue

**Solutions** :

```bash
# Vérifier les manifests (tool.json, game.json)
# Valider le JSON : https://jsonlint.com/

# Vérifier les logs
make npm CMD="run build:dev" 2>&1 | tee build.log

# Consulter docs/TROUBLESHOOTING.md
```

Pour plus de problèmes courants, voir [docs/TROUBLESHOOTING.md](./TROUBLESHOOTING.md).

## Aide et support

### Vous avez une question ?

1. **Documentation** : Chercher dans `docs/`
2. **Issues** : Chercher dans les issues existantes
3. **Discussions** : Poser une question dans GitHub Discussions
4. **Mainteneurs** : Mentionner `@z4ppy` dans une issue

### Vous avez trouvé un bug ?

1. Vérifier qu'il n'existe pas déjà dans les issues
2. Ouvrir une nouvelle issue avec :
   - Description claire du bug
   - Steps to reproduce
   - Comportement attendu vs observé
   - Environnement (OS, Docker version, etc.)
   - Logs/screenshots si applicable

### Vous voulez proposer une feature ?

1. Ouvrir une Discussion (pas une issue) pour discuter
2. Si approuvée, créer une proposition OpenSpec : `/openspec:proposal`
3. Implémenter après validation

---

## Bon développement ! 🚀

Vous êtes maintenant prêt à contribuer à Playlab42. N'hésitez pas à explorer le code, poser des questions, et créer du contenu !

---

*Document maintenu par les contributeurs de Playlab42*
*Dernière mise à jour : 2026-11-08*
