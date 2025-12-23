# Proposal: Réorganisation structure portal/

## Résumé

Réorganiser la structure du projet en créant un dossier `portal/` pour regrouper les sources du portail, éliminer les doublons de dossiers scripts, et clarifier l'architecture globale.

## Pourquoi ?

### Problèmes actuels

1. **Structure confuse** : Les fichiers du portail sont éparpillés entre la racine (`app.js`, `style.css`) et `app/` (modules)

2. **Doublons de dossiers** : Deux dossiers `scripts/` existent :
   - `scripts/` à la racine (build-parcours, build-bookmarks, etc.)
   - `src/scripts/` (build-catalogue)

3. **Dossier `src/` quasi-vide** : Ne contient qu'un sous-dossier `scripts/` avec un seul fichier

4. **Manque de cohérence** : Difficile de comprendre quelle partie du code appartient au portail vs aux bibliothèques partagées

### Objectifs

- Clarifier la séparation entre portail et bibliothèques partagées
- Éliminer les doublons et le dossier `src/` inutile
- Faciliter la navigation dans le projet
- Améliorer la maintenabilité

## Quoi ?

### Structure proposée

```
playlab42/
├── index.html              # Reste à la racine (GitHub Pages)
├── portal/                 # NOUVEAU - Sources du portail
│   ├── app.js              # Point d'entrée (déplacé depuis racine)
│   ├── style.css           # Styles (déplacé depuis racine)
│   └── modules/            # Modules JS (renommé depuis app/)
│       ├── state.js
│       ├── catalogue.js
│       ├── bookmarks.js
│       ├── parcours.js
│       ├── events.js
│       ├── settings.js
│       ├── storage.js
│       ├── tabs.js
│       ├── router.js
│       ├── dom-cache.js
│       └── game-loader.js
├── lib/                    # Inchangé - Partagé entre portail, games, tools
├── scripts/                # Fusionné - Tous les scripts de build
│   ├── build-catalogue.js  # (déplacé depuis src/scripts/)
│   ├── build-parcours.js
│   ├── build-bookmarks.js
│   ├── parcours-utils.js
│   └── og-fetcher.js
├── games/                  # Inchangé
├── tools/                  # Inchangé
├── parcours/               # Inchangé
└── data/                   # Inchangé
```

### Changements clés

1. **Créer `portal/`** avec `app.js`, `style.css`, et `modules/`
2. **Renommer `app/` en `portal/modules/`**
3. **Fusionner `src/scripts/` dans `scripts/`**
4. **Supprimer `src/`** (devenu vide)
5. **Garder `lib/` à la racine** car partagé avec games/ et tools/
6. **Garder `index.html` à la racine** pour compatibilité GitHub Pages

## Impact

### Fichiers à modifier (~25 fichiers)

| Catégorie | Fichiers | Type de modification |
|-----------|----------|---------------------|
| **index.html** | 1 | Chemins src/href vers portal/ |
| **portal/app.js** | 1 | Imports `./app/` → `./modules/` |
| **portal/modules/*.js** | 11 | Imports `../lib/` → `../../lib/` |
| **package.json** | 1 | Script lint, chemins |
| **Makefile** | 1 | Chemins scripts |

### Documentation à mettre à jour

| Document | Modifications |
|----------|---------------|
| **AGENTS.md** | Structure du projet, conventions |
| **openspec/project.md** | Arborescence fichiers |
| **openspec/specs/platform/spec.md** | Architecture |
| **openspec/specs/portal/spec.md** | Structure portail |
| **docs/guides/*.md** | Exemples et chemins |
| **README.md** | Structure projet |

### Risques

- **Faible** : Pas de changement de logique, uniquement déplacement de fichiers
- **CI/CD** : Vérifier que le déploiement GitHub Pages fonctionne toujours
- **Tests** : Les tests existants devraient continuer à fonctionner après mise à jour des chemins

## Critères d'acceptation

- [ ] Tous les fichiers sont déplacés aux bons emplacements
- [ ] Les imports sont mis à jour et fonctionnent
- [ ] Le portail s'affiche correctement (`make serve`)
- [ ] Les tests passent (`make test`)
- [ ] Le lint passe (`make lint`)
- [ ] La documentation reflète la nouvelle structure
- [ ] Les specs OpenSpec sont à jour
