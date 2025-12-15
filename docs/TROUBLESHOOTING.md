# Guide de Dépannage

Ce guide répertorie les problèmes courants et leurs solutions.

## Table des matières

1. [Problèmes Docker](#problèmes-docker)
2. [Problèmes npm](#problèmes-npm)
3. [Problèmes de tests](#problèmes-de-tests)
4. [Problèmes de build](#problèmes-de-build)
5. [Problèmes de déploiement](#problèmes-de-déploiement)
6. [Problèmes de serveur local](#problèmes-de-serveur-local)
7. [Problèmes Git](#problèmes-git)
8. [Problèmes de sécurité](#problèmes-de-sécurité)
9. [Problèmes de performance](#problèmes-de-performance)

---

## Problèmes Docker

### Container ne démarre pas

**Symptôme** :

```bash
make up
# ERROR: Cannot start service dev: ...
```

**Causes possibles** :

1. **Docker n'est pas démarré**

```bash
# Vérifier
docker ps
# → Cannot connect to Docker daemon

# Solution : Démarrer Docker Desktop (macOS/Windows)
# Ou démarrer le daemon (Linux)
sudo systemctl start docker
```

2. **Port déjà utilisé**

```bash
# Vérifier les ports dans docker-compose.yml
# Modifier le port si nécessaire
```

3. **Image corrompue**

```bash
# Rebuild l'image
make down
docker compose build --no-cache
make up
```

### Permissions (Linux uniquement)

**Symptôme** :

```bash
make shell
# permission denied while trying to connect to the Docker daemon socket
```

**Solution** :

```bash
# Ajouter votre utilisateur au groupe docker
sudo usermod -aG docker $USER

# Se déconnecter/reconnecter
# Ou recharger le groupe
newgrp docker

# Vérifier
docker ps
```

### Container tourne mais commandes échouent

**Symptôme** :

```bash
make npm CMD="test"
# sh: npm: not found
```

**Solution** :

```bash
# Rebuild le container
make down
make init
```

### Volumes ne se montent pas correctement

**Symptôme** : Les modifications de fichiers locaux ne sont pas visibles dans le container

**Solution** :

```bash
# Vérifier le bind mount dans docker-compose.yml
# Redémarrer le container
make restart

# Si ça persiste (Windows/WSL)
# Vérifier les permissions et line endings
git config core.autocrlf false
```

### Nettoyer complètement Docker

**Symptôme** : Comportement bizarre, problèmes persistants

**Solution** :

```bash
# Arrêter tout
make down

# Supprimer volumes
docker volume prune

# Supprimer images
docker image prune -a

# Recommencer
make init
```

---

## Problèmes npm

### Installation échoue

**Symptôme** :

```bash
npm install
# ERR! code ERESOLVE
```

**Solutions** :

```bash
# 1. Nettoyer node_modules
rm -rf node_modules package-lock.json

# 2. Installer avec force
npm install --force

# 3. Ou ignorer conflicts
npm install --legacy-peer-deps

# 4. Vérifier la version Node.js
node --version  # Devrait être v20+ ou v25+
```

### Package obsolète ou vulnérable

**Symptôme** :

```bash
npm audit
# found 5 vulnerabilities (2 moderate, 3 high)
```

**Solutions** :

```bash
# 1. Mettre à jour automatiquement
npm audit fix

# 2. Forcer les mises à jour majeures
npm audit fix --force

# 3. Ignorer une vulnérabilité spécifique (temporaire)
npm audit --production  # Ignorer devDependencies

# 4. Mettre à jour un package spécifique
npm update <package-name>

# 5. Upgrade à la dernière version
npm install <package-name>@latest
```

### Scripts npm échouent

**Symptôme** :

```bash
npm run build
# Command not found: node
```

**Solutions** :

```bash
# Vérifier que vous êtes dans le container
make shell

# Ou utiliser make npm
make npm CMD="run build"

# Vérifier package.json
cat package.json | grep scripts
```

---

## Problèmes de tests

### Tous les tests échouent

**Symptôme** :

```bash
npm test
# FAIL lib/seeded-random.test.js
# Cannot find module 'jest'
```

**Solutions** :

```bash
# 1. Réinstaller les dépendances
npm ci

# 2. Nettoyer le cache Jest
npm test -- --clearCache

# 3. Vérifier la configuration Jest
cat jest.config.js
```

### Tests passent localement mais échouent en CI

**Symptôme** : Tests ✅ localement, ❌ dans GitHub Actions

**Causes possibles** :

1. **Différences d'environnement**

```bash
# Vérifier Node version
node --version  # En local
# vs version dans .github/workflows/ci.yml
```

2. **Tests dépendent de l'ordre d'exécution**

```bash
# Exécuter les tests en mode aléatoire
npm test -- --randomize
```

3. **Tests dépendent de timings**

```javascript
// ❌ Mauvais : timeout trop court
setTimeout(() => expect(value).toBe(true), 10);

// ✅ Bon : utiliser fake timers
jest.useFakeTimers();
```

### Coverage baisse

**Symptôme** : Codecov reporte une baisse de coverage

**Solutions** :

```bash
# 1. Vérifier le coverage localement
npm run test:coverage

# 2. Voir les fichiers non couverts
open coverage/lcov-report/index.html

# 3. Ajouter des tests pour nouveau code
# Voir docs/TESTING_STRATEGY.md
```

### Tests timeout

**Symptôme** :

```bash
FAIL: Timeout - Async callback was not invoked within the 5000 ms timeout
```

**Solutions** :

```javascript
// 1. Augmenter le timeout pour un test spécifique
test('long operation', async () => {
  // ...
}, 10000); // 10 secondes

// 2. Ou globalement dans jest.config.js
export default {
  testTimeout: 10000
};

// 3. Vérifier les promesses non résolues
// S'assurer que tous les async/await sont corrects
```

---

## Problèmes de build

### Build échoue : Erreur JSON

**Symptôme** :

```bash
npm run build
# SyntaxError: Unexpected token } in JSON
```

**Solutions** :

```bash
# 1. Trouver le fichier JSON invalide
# Vérifier tous les manifests
find . -name "*.json" -type f -not -path "./node_modules/*" | while read file; do
  echo "Checking $file"
  jq empty "$file" 2>&1 || echo "❌ Invalid: $file"
done

# 2. Valider avec jq
jq . tools/mon-tool/tool.json

# 3. Ou utiliser un validator en ligne
# https://jsonlint.com/
```

### Build échoue : Fichier manquant

**Symptôme** :

```bash
npm run build:catalogue
# Error: ENOENT: no such file or directory, open 'games/mon-jeu/game.json'
```

**Solutions** :

```bash
# 1. Vérifier que le fichier existe
ls -la games/mon-jeu/game.json

# 2. Vérifier les permissions
chmod 644 games/mon-jeu/game.json

# 3. Vérifier le .gitignore
# S'assurer que le fichier n'est pas ignoré
cat .gitignore
```

### Catalogue vide après build

**Symptôme** : `data/catalogue.json` contient `[]`

**Solutions** :

```bash
# 1. Vérifier les manifests
ls -la tools/*/tool.json
ls -la games/*/game.json

# 2. Vérifier le format des manifests
cat tools/mon-tool/tool.json
# Doit contenir au minimum : id, title, description, type

# 3. Relancer le build avec logs
node src/scripts/build-catalogue.js
```

### Build lent

**Symptôme** : `npm run build` prend plusieurs minutes

**Solutions** :

```bash
# 1. Identifier le goulot
time npm run build:catalogue
time npm run build:parcours
time npm run build:bookmarks

# 2. Paralléliser (déjà fait dans package.json)
# Vérifier package.json :
# "build": "npm run build:catalogue && npm run build:parcours && ..."

# 3. Optimiser les scripts
# Éviter de relire les mêmes fichiers plusieurs fois
```

---

## Problèmes de déploiement

### Workflow Deploy échoue

**Symptôme** : GitHub Actions > Deploy to GitHub Pages ❌

**Solutions** :

1. **Vérifier les logs du workflow**

```bash
# GitHub Actions > Deploy to GitHub Pages > Run #123
# Cliquer sur le job en échec
# Lire les logs
```

2. **Permissions GitHub Pages**

```bash
# Aller dans Settings > Pages
# Source : GitHub Actions (pas "Deploy from branch")
```

3. **Permissions du workflow**

```yaml
# Vérifier .github/workflows/deploy.yml
permissions:
  contents: read
  pages: write
  id-token: write
```

### Site inaccessible après déploiement

**Symptôme** : 404 sur https://z4ppy.github.io/playlab42/

**Solutions** :

```bash
# 1. Vérifier que le workflow est terminé
# GitHub Actions > Deploy to GitHub Pages > ✅

# 2. Attendre 1-2 minutes (propagation CDN)

# 3. Vider le cache navigateur
# Ctrl+Shift+R (Chrome/Firefox)
# Cmd+Shift+R (macOS)

# 4. Vérifier le statut GitHub Pages
# Settings > Pages > "Your site is live at..."

# 5. Tester en mode incognito
```

### Fichiers manquants en production

**Symptôme** : Fichiers visibles localement mais 404 en production

**Causes** :

1. **Fichier dans .gitignore**

```bash
# Vérifier
git ls-files | grep "mon-fichier.js"
# Si vide → fichier ignoré

# Solution : Retirer du .gitignore et commit
git add -f mon-fichier.js
git commit -m "fix: ajout fichier manquant"
```

2. **Path absolu vs relatif**

```javascript
// ❌ Mauvais (chemin absolu)
fetch('/data/catalogue.json')

// ✅ Bon (chemin relatif)
fetch('./data/catalogue.json')
```

3. **Fichier généré non committé**

```bash
# data/catalogue.json est généré par le build
# Vérifier qu'il est bien créé dans le workflow
# .github/workflows/deploy.yml doit contenir :
# - run: npm run build
```

### Rollback urgent

**Symptôme** : Déploiement a introduit un bug critique

**Solution rapide** :

```bash
# Voir docs/DEPLOYMENT.md section "Rollback"

# TL;DR : Revert du commit
git log --oneline  # Identifier le commit problématique
git revert <commit-hash>
git push origin main  # Déclenche redéploiement automatique
```

---

## Problèmes de serveur local

### Port 5242 déjà utilisé

**Symptôme** :

```bash
make serve
# Error: listen EADDRINUSE: address already in use :::5242
```

**Solutions** :

```bash
# 1. Trouver le processus
lsof -i :5242
# ou (Linux)
netstat -tulpn | grep 5242

# 2. Tuer le processus
kill -9 <PID>

# 3. Ou utiliser un autre port
npx serve . -p 3000
```

### CORS errors

**Symptôme** : Console affiche `CORS policy: No 'Access-Control-Allow-Origin' header`

**Solutions** :

```bash
# 1. Utiliser le serveur avec CORS activé
npx serve . -p 5242 -C  # -C active CORS

# 2. Ou ajouter --cors au script package.json
# "serve": "npx serve . -p 5242 -C"

# 3. Pour développement : désactiver CORS dans le navigateur
# Chrome : --disable-web-security --user-data-dir=/tmp/chrome
# ⚠️ Seulement pour dev, jamais en production
```

### Modifications pas visibles

**Symptôme** : Éditer un fichier mais pas de changement dans le navigateur

**Solutions** :

```bash
# 1. Vider le cache navigateur
# Ctrl+Shift+R (hard reload)

# 2. Désactiver le cache en DevTools
# F12 > Network > Disable cache

# 3. Vérifier que le fichier est bien modifié
cat mon-fichier.js | head

# 4. Redémarrer le serveur
# Ctrl+C puis make serve
```

### Page blanche (index.html)

**Symptôme** : http://localhost:5242 affiche une page blanche

**Solutions** :

```bash
# 1. Vérifier la console navigateur (F12)
# Lire les erreurs JavaScript

# 2. Vérifier que index.html existe
ls -la index.html

# 3. Vérifier le contenu
cat index.html | head

# 4. Vérifier les imports JavaScript
# S'assurer que tous les <script src="..."> pointent vers des fichiers existants
```

---

## Problèmes Git

### Conflicts lors du merge

**Symptôme** :

```bash
git pull origin main
# CONFLICT (content): Merge conflict in file.js
```

**Solutions** :

```bash
# 1. Voir les fichiers en conflit
git status

# 2. Résoudre manuellement
# Ouvrir le fichier et chercher :
# <<<<<<< HEAD
# votre code
# =======
# code distant
# >>>>>>> branch-name

# 3. Éditer pour garder la bonne version

# 4. Marquer comme résolu
git add file.js

# 5. Terminer le merge
git commit
```

### Push rejeté (non-fast-forward)

**Symptôme** :

```bash
git push origin main
# error: failed to push some refs
# hint: Updates were rejected because the tip of your current branch is behind
```

**Solutions** :

```bash
# 1. Récupérer les changements distants
git pull origin main

# 2. Résoudre les conflits si nécessaire (voir ci-dessus)

# 3. Push à nouveau
git push origin main

# ⚠️ NE JAMAIS FAIRE : git push --force (sauf cas exceptionnel)
```

### Commit sur mauvaise branche

**Symptôme** : J'ai committé sur `main` au lieu de ma branche feature

**Solutions** :

```bash
# Option 1 : Déplacer le commit vers une nouvelle branche
git branch feature/ma-branche  # Crée la branche
git reset --hard HEAD~1        # Recule main d'un commit
git checkout feature/ma-branche

# Option 2 : Cherry-pick
git checkout -b feature/ma-branche
git cherry-pick <commit-hash>
git checkout main
git reset --hard HEAD~1
```

### Fichier volumineux (>100MB)

**Symptôme** :

```bash
git push
# error: GH001: Large files detected
# error: File big-file.zip is 150.00 MB; this exceeds GitHub's file size limit of 100.00 MB
```

**Solutions** :

```bash
# 1. Retirer le fichier du commit
git rm --cached big-file.zip
git commit --amend

# 2. Ajouter au .gitignore
echo "big-file.zip" >> .gitignore
git add .gitignore
git commit -m "chore: ignore large files"

# 3. Si fichier déjà dans l'historique (utiliser BFG Repo Cleaner)
# https://rtyley.github.io/bfg-repo-cleaner/
```

---

## Problèmes de sécurité

### npm audit trouve des vulnérabilités

**Symptôme** :

```bash
npm audit
# found 5 vulnerabilities (2 moderate, 3 high)
```

**Solutions** :

```bash
# 1. Mettre à jour automatiquement
npm audit fix

# 2. Forcer les mises à jour (breaking changes)
npm audit fix --force

# 3. Ignorer temporairement (devDependencies seulement)
npm audit --production

# 4. Voir détails
npm audit

# 5. Voir le workflow Security Audit dans GitHub Actions
```

### GitLeaks détecte un secret

**Symptôme** : Security Audit workflow échoue (GitLeaks)

**Solutions** :

```bash
# 1. Identifier le secret détecté
# Voir les logs GitHub Actions > Security Audit > gitleaks

# 2. Supprimer le secret du code
# Éditer le fichier et supprimer la clé

# 3. Commit
git add .
git commit -m "fix: remove leaked secret"

# 4. Révoquer le secret exposé
# Si API key : la régénérer sur le service
# Si password : le changer

# 5. Si secret dans l'historique Git
# Utiliser git-filter-repo ou BFG Repo Cleaner
```

### ESLint security warnings

**Symptôme** : Security Audit workflow rapporte des warnings ESLint

**Solutions** :

```bash
# 1. Voir les détails
make security-eslint

# 2. Corriger les problèmes
# Exemples courants :

# eval() détecté
# ❌ eval(userInput)
# ✅ Éviter eval, utiliser Function constructor si vraiment nécessaire

# innerHTML avec données non sanitisées
# ❌ element.innerHTML = userInput
# ✅ element.textContent = userInput

# RegExp non-littéral
# ❌ new RegExp(userInput)
# ✅ Valider userInput d'abord
```

---

## Problèmes de performance

### Build très lent

**Symptôme** : `npm run build` prend >30 secondes

**Solutions** :

```bash
# 1. Profiler
time npm run build:catalogue
time npm run build:parcours

# 2. Optimiser les scripts
# Éviter de lire les mêmes fichiers plusieurs fois
# Utiliser un cache si nécessaire

# 3. Vérifier le nombre de fichiers
find tools -name "*.json" | wc -l
find games -name "*.json" | wc -l
```

### Tests très lents

**Symptôme** : `npm test` prend >10 secondes

**Solutions** :

```bash
# 1. Exécuter en parallèle (par défaut avec Jest)
# Vérifier jest.config.js :
# maxWorkers: '50%'

# 2. Filtrer les tests
npm test -- seeded-random  # Seulement seeded-random.test.js

# 3. Utiliser mode watch
npm run test:watch

# 4. Désactiver coverage (plus rapide)
npm test -- --coverage=false
```

### Serveur local lent

**Symptôme** : http://localhost:5242 met du temps à charger

**Solutions** :

```bash
# 1. Vérifier le nombre de fichiers servis
find . -type f -not -path "./node_modules/*" | wc -l

# 2. Optimiser les assets
# Compresser les images (PNG → WebP, etc.)
# Minifier JS/CSS (en production)

# 3. Utiliser un autre serveur
npm install -g http-server
http-server . -p 5242 -c-1  # Pas de cache
```

---

## Problèmes spécifiques

### Tic-Tac-Toe bot ne fonctionne pas

**Symptôme** : Bot fait des moves invalides

**Solutions** :

```bash
# 1. Vérifier les logs console (F12)

# 2. Tester le moteur isolément
npm test -- tic-tac-toe

# 3. Vérifier l'implémentation du bot
cat games/tic-tac-toe/bot-minimax.js

# 4. Débugger avec console.log
# Ajouter des logs dans le bot
```

### Parcours ne charge pas

**Symptôme** : Parcours viewer affiche une erreur

**Solutions** :

```bash
# 1. Vérifier epic.json
jq . parcours/epics/mon-epic/epic.json

# 2. Vérifier les slides
ls -la parcours/epics/mon-epic/slides/

# 3. Rebuild le parcours
npm run build:parcours

# 4. Vérifier data/parcours.json
jq . data/parcours.json
```

### Catalogue ne trouve pas un item

**Symptôme** : Tool/game visible localement mais pas dans le catalogue

**Solutions** :

```bash
# 1. Rebuild le catalogue
npm run build:catalogue

# 2. Vérifier data/catalogue.json
jq . data/catalogue.json | grep "mon-item"

# 3. Vérifier le manifest
# tools/mon-tool/tool.json doit contenir :
# - id (unique)
# - title
# - description
# - type: "tool"

# 4. Vérifier le chemin
# Doit être tools/<id>/tool.json (pas tools/<id>/index.html)
```

---

## Obtenir de l'aide

Si votre problème persiste :

### 1. Chercher dans la documentation

```bash
# Grep dans tous les docs
grep -r "votre-probleme" docs/
```

### 2. Chercher dans les issues GitHub

- Issues ouvertes : https://github.com/z4ppy/playlab42/issues
- Issues fermées : peut contenir la solution

### 3. Ouvrir une issue

**Avant d'ouvrir** :
- Vérifier qu'elle n'existe pas déjà
- Préparer les informations nécessaires

**Template d'issue** :

```markdown
## Description
[Description claire du problème]

## Steps to reproduce
1.
2.
3.

## Comportement attendu
[Ce qui devrait se passer]

## Comportement observé
[Ce qui se passe réellement]

## Environnement
- OS: [macOS 13, Ubuntu 22.04, Windows 11, etc.]
- Docker version: [docker --version]
- Node version (dans container): [node --version]
- Navigateur: [Chrome 120, Firefox 121, etc.]

## Logs
```
[Coller les logs pertinents]
```

## Screenshots
[Si applicable]
```

### 4. Contacter les mainteneurs

- Mentionner `@z4ppy` dans une issue
- Ouvrir une Discussion GitHub

---

## Commandes de diagnostic

### Vérifier l'environnement complet

```bash
#!/bin/bash
echo "=== Diagnostic Playlab42 ==="
echo ""

echo "1. Docker:"
docker --version
docker ps | grep playlab42

echo ""
echo "2. Node.js (dans container):"
make npm CMD="--version"

echo ""
echo "3. Dépendances:"
make npm CMD="list --depth=0"

echo ""
echo "4. Git:"
git status
git log --oneline -5

echo ""
echo "5. Build:"
ls -la data/*.json

echo ""
echo "6. Tests:"
make test 2>&1 | tail -10

echo ""
echo "=== Fin diagnostic ==="
```

Sauvegarder dans `scripts/diagnose.sh` et exécuter :

```bash
chmod +x scripts/diagnose.sh
./scripts/diagnose.sh > diagnostic.log 2>&1
```

Partager `diagnostic.log` lors de l'ouverture d'une issue.

---

## Ressources

- [Documentation Docker](https://docs.docker.com/)
- [Documentation npm](https://docs.npmjs.com/)
- [Documentation Jest](https://jestjs.io/)
- [Documentation Git](https://git-scm.com/doc)
- [Guide de déploiement](./DEPLOYMENT.md)
- [Documentation pipelines](../.github/docs/PIPELINES.md)

---

*Document maintenu par l'équipe Docaposte*
*Dernière mise à jour : 2025-12-14*
