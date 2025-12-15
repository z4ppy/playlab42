# Pipelines CI/CD - Documentation

Ce document décrit tous les workflows automatisés de Playlab42.

## Vue d'ensemble

| Workflow | Déclenchement | Durée | Objectif |
|----------|---------------|-------|----------|
| **CI** | Push/PR vers main | ~2-3 min | Vérifier qualité code (lint, tests, build) |
| **Deploy** | Push vers main | ~1-2 min | Déployer sur GitHub Pages |
| **Security Audit** | Push/PR/Daily 6h UTC | ~5-7 min | Scan de sécurité complet (7 jobs) |

## Workflow 1 : CI (Continuous Integration)

**Fichier** : `.github/workflows/ci.yml`

### Déclenchement

- Push vers `main`
- Pull Request vers `main`
- Manuel (workflow_dispatch)

### Jobs

#### 1.1 Lint

Vérifie la qualité du code avec ESLint.

**Étapes** :
1. Checkout du code
2. Configuration Node.js 20 avec cache npm
3. Installation des dépendances (`npm ci`)
4. Exécution ESLint sur `lib/`, `src/`, `games/`

**Commande** : `npm run lint`

**Échec si** : Erreurs ESLint détectées

#### 1.2 Tests

Exécute les tests unitaires avec coverage.

**Étapes** :
1. Checkout du code
2. Configuration Node.js 20 avec cache npm
3. Installation des dépendances (`npm ci`)
4. Exécution des tests avec coverage (`npm run test:coverage`)
5. Upload du rapport de coverage vers Codecov

**Commande** : `npm run test:coverage`

**Artifacts** :
- Coverage LCOV uploadé vers Codecov
- Flag : `unittests`

**Échec si** : Tests en échec

**Configuration coverage** : Voir `codecov.yml`
- Target : Auto (basé sur historique)
- Patch : 80% minimum sur nouveau code
- Precision : 2 décimales

#### 1.3 Build

Valide que le build fonctionne.

**Étapes** :
1. Checkout du code
2. Configuration Node.js 20 avec cache npm
3. Installation des dépendances (`npm ci`)
4. Build complet (`npm run build`)

**Commande** : `npm run build`

**Ce qui est build** :
- `data/catalogue.json` (via `build-catalogue.js`)
- `data/parcours.json` (via `build-parcours.js`)
- `data/bookmarks.json` (via `build-bookmarks.js`)

**Échec si** : Erreurs de build

### Visualisation

```
┌─────────────┐
│   Push/PR   │
└─────┬───────┘
      │
      ├─────► [Lint] ──────► ✓ Code quality OK
      │
      ├─────► [Tests] ─────► ✓ Tests passing + Coverage
      │
      └─────► [Build] ─────► ✓ Build succeeds
```

### Secrets requis

- `CODECOV_TOKEN` : Token pour uploader le coverage vers Codecov

## Workflow 2 : Deploy (GitHub Pages)

**Fichier** : `.github/workflows/deploy.yml`

### Déclenchement

- Push vers `main` (automatique)
- Manuel (workflow_dispatch)

### Permissions

```yaml
contents: read      # Lire le code
pages: write       # Écrire sur GitHub Pages
id-token: write    # Générer token d'authentification
```

### Concurrency

Un seul déploiement à la fois (`group: "pages"`). Les déploiements concurrents sont annulés.

### Jobs

#### 2.1 Build

Prépare l'artifact pour le déploiement.

**Étapes** :
1. Checkout du code
2. Configuration Node.js 20 avec cache npm
3. Installation des dépendances (`npm ci`)
4. Build complet (`npm run build`)
5. Configuration GitHub Pages
6. Upload de l'artifact (tout le répertoire racine)

**Ce qui est déployé** :
- `index.html` (portail principal)
- `style.css`, `app.js`
- `tools/` (tous les outils)
- `games/` (tous les jeux)
- `parcours/` (contenus pédagogiques)
- `lib/` (bibliothèques)
- `data/` (catalogues générés)
- `assets/` (images, favicons)

#### 2.2 Deploy

Déploie l'artifact sur GitHub Pages.

**Étapes** :
1. Attend la fin du job `build`
2. Déploie via `actions/deploy-pages@v4`

**Environment** : `github-pages`

**URL** : Disponible dans `steps.deployment.outputs.page_url`

### Visualisation

```
┌─────────────────┐
│  Push to main   │
└────────┬────────┘
         │
         ▼
    [Build Job]
         │
         ├─► npm ci
         ├─► npm run build
         ├─► Upload artifact
         │
         ▼
   [Deploy Job]
         │
         └─► Deploy to GitHub Pages
              │
              ▼
         🌐 https://z4ppy.github.io/playlab42/
```

### Rollback

Voir [docs/DEPLOYMENT.md](../../docs/DEPLOYMENT.md) pour la procédure de rollback.

## Workflow 3 : Security Audit

**Fichier** : `.github/workflows/security-audit.yml`

### Déclenchement

- Push vers `main`
- Pull Request vers `main`
- Quotidien à 6h UTC (cron: `0 6 * * *`)
- Manuel (workflow_dispatch)

### Permissions

```yaml
contents: read          # Lire le code
security-events: write  # Uploader résultats SARIF
pull-requests: write    # Commenter les PRs
```

### Jobs (7 jobs en parallèle)

#### 3.1 npm-audit

Détecte les CVE dans les dépendances npm.

**Commande** : `npm audit --audit-level=moderate`

**Seuil** : Moderate, High, Critical

**Échec si** : Vulnérabilités >= moderate détectées

**Artifacts** :
- `npm-audit-results.json` (30 jours)

#### 3.2 eslint-security

Analyse statique de sécurité du code JavaScript.

**Plugins installés** :
- `eslint-plugin-security`
- `eslint-plugin-no-unsanitized`

**Règles activées** :
- `security/detect-object-injection`: warn
- `security/detect-non-literal-regexp`: warn
- `security/detect-unsafe-regex`: error
- `security/detect-buffer-noassert`: error
- `security/detect-eval-with-expression`: error
- `security/detect-no-csrf-before-method-override`: warn
- `security/detect-possible-timing-attacks`: warn
- `no-unsanitized/method`: error
- `no-unsanitized/property`: error

**Cibles** : `lib/`, `src/`, `games/`

**Artifacts** :
- `eslint-security-results.json` (30 jours)

#### 3.3 trivy-scan

Scanner de vulnérabilités Trivy (Aqua Security).

**Scanners activés** :
- `vuln` : Vulnérabilités dans dépendances
- `secret` : Détection de secrets
- `misconfig` : Mauvaises configurations

**Sévérités** : CRITICAL, HIGH, MEDIUM

**Format** : JSON + Table (console)

**Artifacts** :
- `trivy-results.json` (30 jours)

#### 3.4 gitleaks

Détection de secrets dans l'historique Git.

**Action** : `gitleaks/gitleaks-action@v2`

**Scope** : Historique Git complet (`fetch-depth: 0`)

**Échec si** : Secrets détectés (tokens, API keys, passwords)

#### 3.5 outdated-check

Liste les packages obsolètes avec mises à jour disponibles.

**Commandes** :
- `npm outdated` : Packages avec nouvelles versions
- `npm audit --parseable` : Packages avec CVE connues

**Échec** : Non (informatif uniquement)

#### 3.6 docker-security

Analyse du Dockerfile avec Hadolint.

**Action** : `hadolint/hadolint-action@v3.3.0`

**Format** : SARIF (uploadé vers Security tab GitHub)

**Déclenchement** : Uniquement sur push et workflow_dispatch (pas sur PR)

**Règles** : Best practices Docker
- Images de base sécurisées
- Pas de secrets hardcodés
- Layers optimisés
- USER non-root

**Artifacts** :
- SARIF uploadé vers GitHub Security tab

#### 3.7 security-report

Génère un rapport consolidé de tous les scans.

**Dépendances** : Attend la fin des 6 jobs précédents

**Exécution** : Toujours (`if: always()`)

**Étapes** :
1. Download de tous les artifacts
2. Parsing JSON (npm-audit, eslint, trivy)
3. Génération markdown
4. Upload du rapport (90 jours)
5. Affichage console
6. Commentaire PR (si applicable)

**Format du rapport** :

```markdown
# 🔒 Rapport de Sécurité Consolidé

**Date**: 2025-12-14 08:30:15 UTC
**Commit**: abc123def456
**Branch**: main

## 📊 Résultats par outil

### npm audit
✅ Aucune vulnérabilité détectée

### ESLint Security
- Erreurs: 0
- Warnings: 2

### Trivy
- Vulnérabilités: 3 (1 HIGH, 2 MEDIUM)
```

**Artifacts** :
- `security-report.md` (90 jours)

### Visualisation

```
┌──────────────────────────────────────┐
│  Push/PR/Daily 6h UTC                │
└──────────────┬───────────────────────┘
               │
      ┌────────┴────────┐
      │   7 jobs //     │
      └────────┬────────┘
               │
     ┌─────────┼─────────────────────┐
     │         │                     │
     ▼         ▼                     ▼
[npm-audit] [eslint]  ...   [docker-security]
     │         │                     │
     └─────────┴──────┬──────────────┘
                      ▼
              [security-report]
                      │
                      ├─► Upload artifacts
                      ├─► Console output
                      └─► Comment PR
```

### Artifacts consolidés

Tous les artifacts sont disponibles depuis l'interface GitHub Actions :

```
Actions > Security Audit > Run #123 > Artifacts
├── npm-audit-results (30 jours)
├── eslint-security-results (30 jours)
├── trivy-results (30 jours)
└── security-report (90 jours)
```

## Configuration : Dependabot

**Fichier** : `.github/dependabot.yml`

### Mises à jour automatiques

| Écosystème | Fréquence | Limite PR | Groupement |
|------------|-----------|-----------|------------|
| npm | Lundi 6h (Europe/Paris) | 5 PR | dev vs prod dependencies |
| GitHub Actions | Lundi 6h (Europe/Paris) | 3 PR | Toutes actions |
| Docker | Lundi 6h (Europe/Paris) | 2 PR | Base images |

### Groupes de dépendances

**npm-dev-dependencies** :
- Préfixe : `chore(deps-dev):`
- Inclut : Toutes devDependencies

**npm-prod-dependencies** :
- Préfixe : `chore(deps):`
- Inclut : Toutes dependencies

### Labels automatiques

- `dependencies` : Toutes PRs Dependabot
- `javascript` : PRs npm
- `github_actions` : PRs actions
- `docker` : PRs images Docker

### Reviewers

Aucun reviewer configuré (à ajouter selon l'équipe)

## Configuration : Code Coverage

**Fichier** : `codecov.yml`

### Paramètres globaux

- **Precision** : 2 décimales
- **Round** : Down
- **Range** : 70-100%

### Status checks

**Project** :
- Target : Auto (basé sur historique)
- Threshold : 1%
- Base : Auto

**Patch** :
- Target : 80%
- Base : Auto

### Commentaires PR

- **Layout** : Diff (affiche uniquement les changements)
- **Require changes** : false
- **Behavior** : default

### Fichiers ignorés

```yaml
ignore:
  - "node_modules/**/*"
  - "tests/**/*"
  - "**/*.test.js"
  - "**/*.spec.js"
  - "jest.config.js"
  - "eslint.config.js"
```

## Monitoring et dashboards

### GitHub Actions

- **Workflows** : https://github.com/z4ppy/playlab42/actions
- **Security** : https://github.com/z4ppy/playlab42/security

### Codecov

- **Dashboard** : https://codecov.io/gh/z4ppy/playlab42
- **Badge** : ![codecov](https://codecov.io/gh/z4ppy/playlab42/graph/badge.svg)

### Status badges (README)

```markdown
[![CI](https://github.com/z4ppy/playlab42/actions/workflows/ci.yml/badge.svg)](https://github.com/z4ppy/playlab42/actions/workflows/ci.yml)
[![Deploy](https://github.com/z4ppy/playlab42/actions/workflows/deploy.yml/badge.svg)](https://github.com/z4ppy/playlab42/actions/workflows/deploy.yml)
[![codecov](https://codecov.io/gh/z4ppy/playlab42/graph/badge.svg)](https://codecov.io/gh/z4ppy/playlab42)
```

## Temps d'exécution estimés

| Workflow | Durée moyenne | Cache hit | Cache miss |
|----------|---------------|-----------|------------|
| CI (lint) | 45s | 30s | 1m15s |
| CI (tests) | 1m30s | 1m | 2m |
| CI (build) | 1m | 45s | 1m45s |
| **CI Total** | **2-3 min** | **2 min** | **4-5 min** |
| Deploy | 1m30s | 1m | 2m30s |
| Security Audit | 5-7 min | 4-5 min | 8-10 min |

**Note** : Les durées dépendent de la charge GitHub Actions et de l'efficacité du cache npm.

## Bonnes pratiques

### Pour les contributeurs

1. **Avant de pusher** :
   ```bash
   make lint        # Vérifie le code
   make test        # Lance les tests
   make build       # Vérifie le build
   ```

2. **Suivre les workflows** :
   - Vérifier le statut des checks sur la PR
   - Corriger les erreurs lint avant merge
   - Maintenir coverage >= 80% sur nouveau code

3. **Sécurité** :
   - Ne jamais committer de secrets
   - Lire le rapport de sécurité sur les PRs
   - Corriger les vulnérabilités CRITICAL/HIGH avant merge

### Pour les mainteneurs

1. **Merge uniquement si** :
   - ✅ Tous les checks CI sont verts
   - ✅ Coverage >= seuils configurés
   - ✅ Pas de vulnérabilités bloquantes
   - ✅ Code review approuvée

2. **Après merge vers main** :
   - Le déploiement est automatique
   - Vérifier le déploiement sur GitHub Pages
   - Surveiller les erreurs dans les logs

3. **Gestion des alertes** :
   - Dependabot : Review hebdomadaire des PRs
   - Security Audit : Review quotidienne du rapport (si échecs)
   - Codecov : Investiguer les chutes de coverage

## Dépannage

Voir [docs/TROUBLESHOOTING.md](../../docs/TROUBLESHOOTING.md) pour les problèmes courants.

### Liens rapides

- **CI échoue** : Vérifier les logs dans Actions > CI
- **Deploy échoue** : Vérifier les permissions GitHub Pages
- **Coverage baisse** : Consulter Codecov dashboard
- **Vulnérabilités** : Voir docs/SECURITY_AUDIT.md

## Évolution des pipelines

Pour proposer des modifications aux workflows :

1. Créer une proposition OpenSpec : `/openspec:proposal`
2. Documenter les changements dans la spec
3. Tester localement avec Act (si applicable)
4. Ouvrir une PR avec les modifications
5. Mettre à jour cette documentation

## Ressources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Dependabot Documentation](https://docs.github.com/en/code-security/dependabot)
- [Codecov Documentation](https://docs.codecov.com/)
- [Trivy Documentation](https://aquasecurity.github.io/trivy/)
- [GitLeaks Documentation](https://github.com/gitleaks/gitleaks)
- [Hadolint Documentation](https://github.com/hadolint/hadolint)

---

*Document maintenu par l'équipe Docaposte*
*Dernière mise à jour : 2025-12-14*
