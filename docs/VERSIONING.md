# Système de versioning

Ce document décrit le système de versioning de Playlab42.

## Vue d'ensemble

Playlab42 utilise **Semantic Versioning (SemVer)** avec **build metadata** pour gérer les versions du projet.

### Format de version

**Version de base (SemVer) :**
```
X.Y.Z

X = MAJOR version (changements incompatibles, breaking changes)
Y = MINOR version (nouvelles fonctionnalités, rétro-compatibles)
Z = PATCH version (corrections de bugs, rétro-compatibles)
```

**Avec build metadata :**
```
Dev local:  v0.1.0-dev+b7dc0ba (commit SHA court)
Production: v0.1.0 build #42 (GitHub Actions run number)
```

### Exemples

- `0.1.0` → `0.1.1` : Correction de bug (PATCH)
- `0.1.0` → `0.2.0` : Nouvelle fonctionnalité (MINOR)
- `0.1.0` → `1.0.0` : Breaking change (MAJOR)

### Pourquoi un build number ?

Avec des déploiements continus sur `main`, le build number permet de :
- ✅ Différencier les déploiements entre deux versions
- ✅ Tracer précisément le code déployé (commit SHA)
- ✅ Identifier rapidement le build en production

## Architecture

### Source unique de vérité

La version est stockée dans **`package.json`** uniquement.

```json
{
  "name": "playlab42",
  "version": "0.1.0"
}
```

### Injection automatique

Le script `scripts/inject-version.js` remplace les placeholders `{{VERSION}}` dans les fichiers HTML par la version depuis `package.json`.

**Fichiers concernés :**
- `index.html` (footer avec badge GitHub)

### Affichage dans le portail

Le footer du portail affiche un badge élégant avec :
- Icône GitHub
- Version actuelle (ex: `v0.1.0`)
- Lien cliquable vers la release GitHub correspondante

**Hover effects :**
- Changement de couleur (accent)
- Animation subtile
- Ombre portée

## Workflow de release

### 1. Bumper la version

Utilisez les commandes npm selon le type de changement :

```bash
# Bug fix (0.1.0 → 0.1.1)
npm run version:patch

# Nouvelle feature (0.1.0 → 0.2.0)
npm run version:minor

# Breaking change (0.1.0 → 1.0.0)
npm run version:major
```

### 2. Ce que fait le script

Le script `scripts/bump-version.js` effectue automatiquement :

1. ✅ Vérification du working directory propre
2. ✅ Bump de la version dans `package.json`
3. ✅ Injection de la version dans les fichiers HTML
4. ✅ Création d'un commit de version
5. ✅ Création d'un tag Git (ex: `v0.1.0`)

### 3. Pusher la version

```bash
# Pusher le commit de version
git push

# Pusher le tag
git push origin v0.1.0
```

### 4. Créer une release GitHub

1. Aller sur https://github.com/z4ppy/playlab42/releases
2. Cliquer sur "Draft a new release"
3. Sélectionner le tag (ex: `v0.1.0`)
4. Ajouter un titre et des notes de version
5. Publier la release

**Template de notes de version :**

```markdown
## 🚀 Nouveautés

- Ajout de...
- Amélioration de...

## 🐛 Corrections

- Fix de...

## 📚 Documentation

- Mise à jour de...

## ⚙️ Technique

- Refactoring de...
```

## Build Metadata

### Comment ça marche

Le script `scripts/inject-version.js` détecte automatiquement l'environnement :

**En développement local :**
- Détecte le commit SHA via `git rev-parse --short HEAD`
- Génère : `v0.1.0-dev+b7dc0ba`
- Permet de savoir quel code est testé localement

**En CI/Production (GitHub Actions) :**
- Récupère `GITHUB_RUN_NUMBER` et `GITHUB_SHA`
- Génère : `v0.1.0 build #42`
- Permet de tracer précisément le déploiement

### Variables d'environnement

| Variable | Source | Usage |
|----------|--------|-------|
| `CI` | GitHub Actions | Détecte si exécuté en CI |
| `GITHUB_RUN_NUMBER` | GitHub Actions | Numéro de build incrémental |
| `GITHUB_SHA` | GitHub Actions | Hash du commit complet |

### Placeholders HTML

Le système utilise deux placeholders :

- `{{VERSION}}` : Version affichée (avec build metadata)
- `{{VERSION_LINK}}` : Version de base pour les liens GitHub (sans metadata)

**Exemple dans index.html :**
```html
<a href="https://github.com/z4ppy/playlab42/releases/tag/v{{VERSION_LINK}}">
  {{VERSION}}
</a>
```

Résultat en dev : `v0.1.0-dev+b7dc0ba` → lien vers `v0.1.0`
Résultat en prod : `v0.1.0 build #42` → lien vers `v0.1.0`

## Déploiement

### GitHub Actions

Le workflow `.github/workflows/deploy.yml` injecte automatiquement la version avant le déploiement :

```yaml
- name: Injection de la version
  env:
    CI: true
    GITHUB_RUN_NUMBER: ${{ github.run_number }}
    GITHUB_SHA: ${{ github.sha }}
  run: npm run inject-version

- name: Build des données
  run: npm run build
```

Cela garantit que :
- La version affichée correspond à `package.json`
- Le build number est incrémental et traçable
- Le commit SHA est disponible pour debug

## Développement local

### Tester l'injection de version

```bash
# Injecter la version manuellement
npm run inject-version

# Vérifier le résultat
grep -n "VERSION" index.html
```

### Remettre les placeholders

Si vous avez besoin de remettre les placeholders `{{VERSION}}` dans le HTML :

```bash
# Restaurer depuis Git
git checkout index.html

# Ou remplacer manuellement
sed -i 's/v[0-9]\+\.[0-9]\+\.[0-9]\+/{{VERSION}}/g' index.html
```

## Bonnes pratiques

### Quand bumper la version ?

| Type | Quand | Exemple |
|------|-------|---------|
| **PATCH** | Correction de bug, typo, petite amélioration | Fix CSS du footer |
| **MINOR** | Nouvelle fonctionnalité, nouveau jeu/outil | Ajout d'un système de filtres |
| **MAJOR** | Breaking change, refonte complète | Migration vers nouveau framework |

### Conventions de commit

Utilisez des messages de commit clairs pour faciliter les releases :

```bash
# Commit automatique du bump
chore: bump version 0.1.0 → 0.2.0

# Commits de features/fixes
feat: ajout du système de bookmarks
fix: correction du bug de thème
docs: mise à jour de VERSIONING.md
```

### Changelog

Pour générer un changelog automatique, utilisez les conventions de commit :

```bash
# Afficher les commits depuis le dernier tag
git log $(git describe --tags --abbrev=0)..HEAD --oneline

# Filtrer par type
git log --oneline --grep="^feat:"
git log --oneline --grep="^fix:"
```

## Troubleshooting

### Erreur : "Le working directory n'est pas propre"

```bash
# Vérifier les changements
git status

# Commiter ou stasher les changements
git add .
git commit -m "..."

# Ou
git stash
```

### Le badge ne s'affiche pas correctement

Vérifiez que :
1. La version a été injectée : `grep VERSION index.html`
2. Les styles CSS sont chargés : vérifier la console du navigateur
3. Le lien GitHub est correct : vérifier l'URL dans le HTML

### La version affichée est incorrecte

```bash
# Réinjecter la version
npm run inject-version

# Vérifier le résultat
cat index.html | grep -A 5 "version-badge"
```

## Scripts disponibles

| Script | Description |
|--------|-------------|
| `npm run inject-version` | Injecte la version dans les fichiers HTML |
| `npm run version:patch` | Bump PATCH (bug fix) |
| `npm run version:minor` | Bump MINOR (feature) |
| `npm run version:major` | Bump MAJOR (breaking) |

## Fichiers du système

```
playlab42/
├── package.json                    # Source de vérité de la version
├── index.html                      # Contient {{VERSION}} remplacé au build
├── style.css                       # Styles du badge de version
├── scripts/
│   ├── inject-version.js          # Script d'injection
│   └── bump-version.js            # Script de bump
├── .github/workflows/
│   └── deploy.yml                 # Workflow avec injection auto
└── docs/
    └── VERSIONING.md              # Cette documentation
```

## Références

- [Semantic Versioning](https://semver.org/)
- [GitHub Releases](https://docs.github.com/en/repositories/releasing-projects-on-github)
- [npm version](https://docs.npmjs.com/cli/v8/commands/npm-version)
