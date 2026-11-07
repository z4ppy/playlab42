# Guide de Démarrage

Bienvenue sur **Playlab42** ! Ce guide vous accompagne dans la configuration de votre environnement de développement et vos premières contributions.

## Table des matières

1. [Prérequis](#prérequis)
2. [Installation](#installation)
3. [Environnement de développement](#environnement-de-développement)
4. [Premiers pas](#premiers-pas)
5. [Workflow de contribution](#workflow-de-contribution)
6. [Commandes utiles](#commandes-utiles)
7. [Prochaines étapes](#prochaines-étapes)

## Prérequis

### Logiciels requis

| Logiciel | Version minimum | Installation |
|----------|-----------------|--------------|
| **Git** | 2.30+ | [git-scm.com](https://git-scm.com/) |
| **Docker** | 20.10+ | [docker.com/get-started](https://www.docker.com/get-started) |
| **Docker Compose** | 2.0+ | Inclus avec Docker Desktop |
| **Make** | 4.0+ | Préinstallé (macOS/Linux) ou [GnuWin32](http://gnuwin32.sourceforge.net/packages/make.htm) (Windows) |

**Note importante** : Tout le développement se fait dans Docker. **Vous n'avez pas besoin de Node.js installé sur votre machine**.

### Vérifier les installations

```bash
# Vérifier Git
git --version
# → git version 2.30.0 ou supérieur

# Vérifier Docker
docker --version
# → Docker version 20.10.0 ou supérieur

# Vérifier Docker Compose
docker compose version
# → Docker Compose version 2.0.0 ou supérieur

# Vérifier Make
make --version
# → GNU Make 4.0 ou supérieur
```

### Compte GitHub

- Créer un compte sur [github.com](https://github.com/) si vous n'en avez pas
- Configurer une clé SSH (recommandé) : [docs.github.com/authentication](https://docs.github.com/fr/authentication/connecting-to-github-with-ssh)

## Installation

### 1. Cloner le dépôt

```bash
# Avec SSH (recommandé)
git clone git@github.com:z4ppy/playlab42.git

# Ou avec HTTPS
git clone https://github.com/z4ppy/playlab42.git

# Se positionner dans le projet
cd playlab42
```

### 2. Initialiser l'environnement Docker

```bash
# Une seule commande pour tout configurer
make init
```

**Ce que fait `make init`** :
1. Build l'image Docker (Node.js 25 Alpine)
2. Démarre le container
3. Installe les dépendances npm (`npm install`)
4. Affiche le statut

**Durée** : 2-5 minutes (selon connexion internet)

### 3. Vérifier l'installation

```bash
# Vérifier que le container tourne
make status

# Sortie attendue :
# ✅ Container 'playlab42-dev' is running
```

**Problèmes ?** Voir [Troubleshooting](#troubleshooting) en fin de document.

## Environnement de développement

### Architecture Docker-first

Tout tourne dans Docker, rien sur le host :

```
┌─────────────────────────────────────┐
│        Votre machine (host)         │
│                                     │
│  ┌───────────────────────────────┐ │
│  │  Container Docker             │ │
│  │  (playlab42-dev)              │ │
│  │                               │ │
│  │  • Node.js 25                 │ │
│  │  • npm dependencies           │ │
│  │  • Tous les outils dev        │ │
│  │                               │ │
│  │  Code monté depuis host       │ │
│  │  (bind mount)                 │ │
│  └───────────────────────────────┘ │
└─────────────────────────────────────┘
```

**Avantages** :
- Environnement identique pour tous les développeurs
- Pas de pollution du système hôte
- Pas de conflits de versions Node.js
- Facile à supprimer/réinitialiser

### Shell de développement

Pour exécuter des commandes dans le container :

```bash
# Ouvrir un shell interactif
make shell

# Vous êtes maintenant dans le container
node@playlab42:/app$ npm --version
node@playlab42:/app$ ls -la
node@playlab42:/app$ exit  # Pour sortir
```

**Alternative** : Exécuter des commandes npm directement depuis le host :

```bash
# Syntaxe : make npm CMD="<commande>"
make npm CMD="install lodash"
make npm CMD="run test"
make npm CMD="run lint"
```

### Serveur de développement

```bash
# Démarrer le serveur statique (port 5242)
make serve

# Ou via npm
make npm CMD="run serve"
```

**Accès** : http://localhost:5242

**Ce qui est servi** :
- Portail principal (`index.html`)
- Tous les tools (`tools/`)
- Tous les games (`games/`)
- Tous les parcours (`parcours/`)

**Arrêter le serveur** : Ctrl+C

## Premiers pas

### 1. Parcourir le code

```bash
# Structure du projet
tree -L 2 -I 'node_modules'

playlab42/
├── index.html              # Portail principal
├── app.js                  # Logique du portail
├── style.css              # Styles globaux
├── lib/                   # Bibliothèques partagées
│   ├── gamekit.js
│   ├── seeded-random.js
│   └── assets.js
├── tools/                 # Outils HTML standalone
├── games/                 # Jeux autonomes
│   └── tic-tac-toe/
├── parcours/              # Contenus pédagogiques
├── data/                  # Catalogues générés
├── docs/                  # Documentation
└── openspec/              # Spécifications
```

### 2. Exécuter les tests

```bash
# Lancer tous les tests
make test

# Mode watch (relance automatiquement)
make test-watch

# Avec coverage
make npm CMD="run test:coverage"
```

### 3. Vérifier la qualité du code

```bash
# Linter (ESLint)
make lint

# Corriger automatiquement
make lint-fix
```

### 4. Builder les catalogues

```bash
# Builder tout
make build

# Ou individuellement
make build-catalogue   # data/catalogue.json
make build-parcours    # data/parcours.json
```

### 5. Tester le portail localement

```bash
# Démarrer le serveur
make serve

# Ouvrir http://localhost:5242 dans le navigateur
```

**Vérifier** :
- [ ] Le portail charge
- [ ] Le catalogue affiche les tools et games
- [ ] Cliquer sur un tool/game ouvre l'iframe
- [ ] Pas d'erreurs dans la console navigateur

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
make build

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

## Commandes utiles

### Docker

```bash
make init          # Initialiser (build + up + install)
make up            # Démarrer le container
make down          # Arrêter le container
make restart       # Redémarrer le container
make status        # Statut du container
make logs          # Voir les logs
make shell         # Shell interactif dans le container
make clean         # Supprimer container et volumes
```

### Développement

```bash
make serve         # Serveur statique (port 5242)
make build         # Build complet (catalogue + parcours + bookmarks)
make build-catalogue   # Build catalogue.json
make build-parcours    # Build parcours.json
```

### Tests et qualité

```bash
make test          # Lancer les tests
make test-watch    # Tests en mode watch
make lint          # Vérifier le code avec ESLint
make lint-fix      # Corriger automatiquement
```

### Sécurité

```bash
make security-audit      # Audit de sécurité complet
make security-npm        # Audit npm seulement
make security-eslint     # ESLint security
```

### npm (via container)

```bash
make npm CMD="install <package>"
make npm CMD="run <script>"
make npm CMD="test"
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
- [docs/guides/architecture.md](./guides/architecture.md) - Architecture système
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
- **Discussions** : https://github.com/z4ppy/playlab42/discussions
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

### Port 5242 déjà utilisé

**Symptôme** : `make serve` échoue (port déjà pris)

**Solution** :

```bash
# Trouver le processus
lsof -i :5242

# Tuer le processus
kill -9 <PID>

# Ou utiliser un autre port
npx serve . -p 3000
```

### Tests échouent

**Symptôme** : `make test` affiche des erreurs

**Solutions** :

```bash
# Réinstaller les dépendances
make npm CMD="ci"

# Vérifier la version Node.js
make shell
node --version  # Devrait être v25.x

# Nettoyer le cache Jest
make npm CMD="run test -- --clearCache"
```

### Build échoue

**Symptôme** : `make build` échoue

**Solutions** :

```bash
# Vérifier les manifests (tool.json, game.json)
# Valider le JSON : https://jsonlint.com/

# Vérifier les logs
make build 2>&1 | tee build.log

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
*Dernière mise à jour : 2025-12-14*
