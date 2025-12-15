# Guide de Déploiement

Ce document décrit le processus de déploiement et de release de Playlab42.

## Vue d'ensemble

Playlab42 utilise **GitHub Pages** pour l'hébergement. Le déploiement est **automatique** sur chaque push vers `main`.

```
┌────────────────┐
│  git push main │
└───────┬────────┘
        │
        ▼
┌────────────────┐
│  CI Workflow   │  ← Tests, lint, build
└───────┬────────┘
        │ (si ✅)
        ▼
┌────────────────┐
│ Deploy Workflow│  ← Build + Deploy GitHub Pages
└───────┬────────┘
        │
        ▼
┌────────────────┐
│   🌐 Production│  ← https://z4ppy.github.io/playlab42/
└────────────────┘
```

## Prérequis

### 1. Configuration GitHub Pages

Le dépôt doit avoir GitHub Pages activé :

1. Aller dans **Settings** > **Pages**
2. Source : **GitHub Actions**
3. Branch : N/A (géré par le workflow)

### 2. Secrets GitHub

Configurer les secrets suivants :

| Secret | Usage | Requis |
|--------|-------|--------|
| `CODECOV_TOKEN` | Upload coverage vers Codecov | Oui (CI) |
| `GITHUB_TOKEN` | Déploiement Pages (auto-fourni) | Auto |

Voir [.github/docs/SECRETS_MANAGEMENT.md](../.github/docs/SECRETS_MANAGEMENT.md) pour les détails.

### 3. Permissions du workflow

Le workflow de déploiement nécessite les permissions suivantes (configurées dans le workflow) :

```yaml
permissions:
  contents: read    # Lire le code
  pages: write      # Écrire sur GitHub Pages
  id-token: write   # Authentification
```

## Processus de déploiement

### Déploiement automatique (recommandé)

**Déclencheur** : Push vers `main`

```bash
# 1. Développer sur une branche feature
git checkout -b feature/ma-fonctionnalite

# 2. Faire les modifications
# ... éditer, coder, tester ...

# 3. Commit et push
git add .
git commit -m "feat: ajout de ma fonctionnalité"
git push origin feature/ma-fonctionnalite

# 4. Ouvrir une Pull Request sur GitHub
# → Les checks CI s'exécutent automatiquement

# 5. Merger la PR vers main (après review)
# → Le déploiement se déclenche automatiquement
```

**Étapes automatiques** :

1. **CI Workflow** s'exécute :
   - Lint du code
   - Tests avec coverage
   - Build des catalogues
2. **Deploy Workflow** s'exécute (si CI ✅) :
   - Build des données (catalogue, parcours, bookmarks)
   - Upload de l'artifact
   - Déploiement sur GitHub Pages

**Durée** : 3-5 minutes de la fusion PR à la mise en production

### Déploiement manuel

**Déclencheur** : Manuel via l'interface GitHub Actions

```bash
# Interface GitHub :
1. Aller dans "Actions" > "Deploy to GitHub Pages"
2. Cliquer sur "Run workflow"
3. Sélectionner la branche "main"
4. Cliquer sur "Run workflow"
```

**Cas d'usage** :
- Redéployer après un rollback
- Déployer sans nouveau commit
- Tester le workflow de déploiement

## Ce qui est déployé

### Fichiers statiques

```
/
├── index.html           # Portail principal
├── style.css           # Styles globaux
├── app.js              # Logique du portail
├── favicon.ico
├── assets/             # Images, icônes
├── lib/                # Bibliothèques (gamekit.js, etc.)
├── tools/              # Tous les outils HTML
│   └── [tool-name]/
│       ├── index.html
│       └── tool.json
├── games/              # Tous les jeux
│   └── [game-id]/
│       ├── index.html
│       ├── game.js
│       ├── game.json
│       └── assets/
├── parcours/           # Contenus pédagogiques
│   └── epics/
│       └── [epic-id]/
└── data/               # Catalogues générés (build)
    ├── catalogue.json
    ├── parcours.json
    └── bookmarks.json
```

### Fichiers générés (build)

Le workflow exécute `npm run build`, qui génère :

1. **data/catalogue.json** :
   - Liste de tous les tools et games
   - Métadonnées (titre, description, tags, etc.)
   - Script : `src/scripts/build-catalogue.js`

2. **data/parcours.json** :
   - Liste des parcours pédagogiques (epics)
   - Structure des slides
   - Script : `scripts/build-parcours.js`

3. **data/bookmarks.json** :
   - Liens utiles et ressources
   - Script : `scripts/build-bookmarks.js`

### Fichiers exclus

```
# Pas déployés (listés dans .gitignore) :
node_modules/
.env
.env.local
*.log
coverage/
.DS_Store
```

## Vérification du déploiement

### 1. Vérifier le workflow

```bash
# GitHub Actions > Deploy to GitHub Pages
✅ Build job completed
✅ Deploy job completed
```

### 2. Vérifier l'URL de déploiement

**Production** : https://z4ppy.github.io/playlab42/

**Récupérer l'URL via API** :

```bash
gh api repos/z4ppy/playlab42/pages
```

### 3. Tests post-déploiement

Vérifier manuellement :

- [ ] Page d'accueil charge correctement
- [ ] Catalogue affiche les tools et games
- [ ] Un tool s'ouvre en iframe
- [ ] Un game se lance
- [ ] Pas d'erreurs JavaScript dans la console
- [ ] Vérifier les données : `/data/catalogue.json`

**Checklist automatisée** (à venir) :

```bash
# Smoke tests (TODO : à implémenter)
npm run test:e2e:smoke
```

## Rollback (annuler un déploiement)

Si un déploiement introduit un bug critique :

### Méthode 1 : Rollback via historique GitHub Pages

**Pas disponible** : GitHub Pages ne conserve qu'une version.

### Méthode 2 : Revert du commit

```bash
# 1. Identifier le commit problématique
git log --oneline

# 2. Créer un commit de revert
git revert <commit-hash>

# 3. Pusher le revert
git push origin main

# 4. Le déploiement automatique se déclenche
# → Retour à la version précédente
```

**Durée** : 3-5 minutes

### Méthode 3 : Redéployer une version antérieure

```bash
# 1. Identifier le dernier commit stable
git log --oneline

# 2. Créer une branche de hotfix depuis ce commit
git checkout -b hotfix/rollback <commit-hash-stable>

# 3. Forcer le push vers main (ATTENTION : destructif)
git push origin hotfix/rollback:main --force

# ⚠️ ATTENTION : --force écrase l'historique
# Alternative : Créer une PR depuis le hotfix et merger
```

**⚠️ Risques** :
- `--force` écrase l'historique Git
- Peut causer des conflits pour les contributeurs

**Recommandation** : Préférer la **Méthode 2 (revert)** dans 99% des cas.

## Stratégie de versioning

### Semantic Versioning (SemVer)

Playlab42 suit [Semantic Versioning 2.0.0](https://semver.org/) :

```
MAJOR.MINOR.PATCH
0.1.0
```

- **MAJOR** : Breaking changes (incompatibilité API)
- **MINOR** : Nouvelles fonctionnalités (rétrocompatible)
- **PATCH** : Corrections de bugs (rétrocompatible)

### Version actuelle

Voir `package.json` :

```json
{
  "version": "0.1.0"
}
```

**Phase actuelle** : MVP (v0.x.x)
- Pas de garantie de stabilité API
- Peut introduire breaking changes entre versions mineures

### Créer une release

**Après un déploiement majeur** :

```bash
# 1. Mettre à jour la version dans package.json
npm version minor  # ou major, patch

# 2. Mettre à jour CHANGELOG.md
# Voir section "Changelog" ci-dessous

# 3. Commit et tag
git add package.json CHANGELOG.md
git commit -m "chore: release v0.2.0"
git tag v0.2.0

# 4. Push avec tags
git push origin main --tags

# 5. Créer une GitHub Release
gh release create v0.2.0 \
  --title "Version 0.2.0" \
  --notes "Voir CHANGELOG.md pour les détails"
```

**GitHub Release** :

1. Aller dans **Releases** > **Draft a new release**
2. Tag : `v0.2.0`
3. Title : `Version 0.2.0`
4. Description : Copier depuis CHANGELOG.md
5. Publier

## Changelog

Tenir à jour le fichier `CHANGELOG.md` :

**Format** : [Keep a Changelog](https://keepachangelog.com/)

**Exemple** :

```markdown
# Changelog

## [Unreleased]

### Added
- Nouveau tool : JSON Formatter
- Support des parcours pédagogiques

### Changed
- Amélioration UI du catalogue

### Fixed
- Correction bug chargement iframe

## [0.1.0] - 2025-12-14

### Added
- Version initiale MVP
- Catalogue tools et games
- Portail principal
```

**Convention de commits** :

```
feat: Nouvelle fonctionnalité       → Added
fix: Correction de bug               → Fixed
chore: Maintenance                   → Changed
docs: Documentation                  → Changed
refactor: Refactoring                → Changed
perf: Performance                    → Changed
test: Tests                          → (pas dans changelog)
```

## Environnements

| Environnement | URL | Branch | Déploiement |
|---------------|-----|--------|-------------|
| **Production** | https://z4ppy.github.io/playlab42/ | `main` | Automatique |
| **Staging** | N/A | N/A | Pas configuré |
| **Local** | http://localhost:5242 | Toutes | Manuel (`make serve`) |

### Staging (optionnel, à configurer)

Pour ajouter un environnement de staging :

**Option 1 : Branche staging + GitHub Pages**

```yaml
# .github/workflows/deploy-staging.yml
on:
  push:
    branches: [staging]

# Déploie sur gh-pages-staging
```

**Option 2 : Netlify/Vercel**

```bash
# netlify.toml
[build]
  command = "npm run build"
  publish = "."
```

## Monitoring et logs

### Logs de déploiement

**Accéder aux logs** :

1. GitHub Actions > Deploy to GitHub Pages > Run #123
2. Cliquer sur le job (Build ou Deploy)
3. Lire les logs étape par étape

**Logs typiques** :

```
Run npm ci
npm ci
added 123 packages in 15s

Run npm run build
> playlab42@0.1.0 build
> npm run build:catalogue && ...

✅ Catalogue généré : 12 items
✅ Parcours générés : 3 epics

Run actions/upload-pages-artifact@v3
Artifact Size: 2.3 MB
```

### Monitoring post-déploiement

**Outils disponibles** :

1. **GitHub Pages Status** :
   - Settings > Pages > "Your site is live at..."
   - Indicateur vert/rouge

2. **Uptime monitoring** (à configurer) :
   - [UptimeRobot](https://uptimerobot.com/)
   - [Pingdom](https://www.pingdom.com/)
   - Configuration : Ping https://z4ppy.github.io/playlab42/ toutes les 5 min

3. **Analytics** (optionnel) :
   - Google Analytics
   - Plausible (privacy-focused)

### Alertes

**Configurées** :
- Notifications GitHub Actions (par défaut sur échec)

**À configurer** :
- Slack/Discord notifications
- Email sur échec de déploiement

## Sécurité du déploiement

### Bonnes pratiques

1. **Ne jamais déployer directement vers main** :
   ```bash
   # ❌ Mauvais
   git push origin main

   # ✅ Bon
   git push origin feature/ma-feature
   # → Ouvrir PR → Review → Merge
   ```

2. **Vérifier les checks CI avant merge** :
   - ✅ Lint passing
   - ✅ Tests passing
   - ✅ Build succeeds
   - ✅ Security audit OK

3. **Review obligatoire** :
   - Au moins 1 review requise (configurer branch protection)

4. **Pas de secrets dans le code** :
   - Vérifier avec `make security-audit`
   - GitLeaks scan automatique dans CI

### Branch Protection Rules (recommandé)

Configurer dans **Settings** > **Branches** > **Branch protection rules** :

```yaml
Branch: main
☑ Require pull request before merging
  ☑ Require approvals (1)
☑ Require status checks to pass
  ☑ lint
  ☑ test
  ☑ build
☑ Require conversation resolution
☐ Require signed commits
☐ Require linear history
☑ Include administrators
```

## Troubleshooting

### Déploiement échoue

**Symptôme** : Deploy workflow en échec

**Solutions** :

1. Vérifier les logs du workflow
2. Vérifier les permissions GitHub Pages (Settings > Pages)
3. Vérifier que le build local fonctionne :
   ```bash
   make build
   ```
4. Consulter [docs/TROUBLESHOOTING.md](./TROUBLESHOOTING.md)

### Site inaccessible après déploiement

**Symptôme** : 404 sur https://z4ppy.github.io/playlab42/

**Solutions** :

1. Vérifier que le workflow Deploy est terminé (✅)
2. Attendre 1-2 minutes (propagation DNS/CDN)
3. Vider le cache navigateur (Ctrl+Shift+R)
4. Vérifier le statut GitHub Pages (Settings > Pages)

### Fichiers manquants en production

**Symptôme** : Fichiers présents localement mais pas en production

**Causes** :

1. Fichier dans `.gitignore` → Pas committé
2. Fichier non build → Vérifier `npm run build`
3. Path incorrect → Vérifier chemins relatifs

**Solution** :

```bash
# Vérifier que le fichier est committé
git ls-files | grep "mon-fichier.js"

# Vérifier le build local
make build
ls -la data/
```

### Erreurs JavaScript en production

**Symptôme** : Console affiche des erreurs

**Causes** :

1. Chemin absolu au lieu de relatif
2. Fichier manquant (voir ci-dessus)
3. CORS (chargement ressources externes)

**Solution** :

```javascript
// ❌ Mauvais (chemin absolu)
fetch('/data/catalogue.json')

// ✅ Bon (chemin relatif depuis racine GitHub Pages)
fetch('./data/catalogue.json')
```

## Ressources

- [GitHub Pages Documentation](https://docs.github.com/en/pages)
- [GitHub Actions Deployment](https://docs.github.com/en/actions/deployment)
- [Semantic Versioning](https://semver.org/)
- [Keep a Changelog](https://keepachangelog.com/)
- Pipeline Documentation : [.github/docs/PIPELINES.md](../.github/docs/PIPELINES.md)

---

*Document maintenu par l'équipe Docaposte*
*Dernière mise à jour : 2025-12-14*
