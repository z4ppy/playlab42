# Tasks: Réorganisation structure portal/

## Phase 1 : Créer la structure portal/

- [x] Créer le dossier `portal/`
- [x] Créer le dossier `portal/modules/`
- [x] Déplacer `app.js` vers `portal/app.js`
- [x] Déplacer `style.css` vers `portal/style.css`
- [x] Déplacer les fichiers de `app/` vers `portal/modules/`
- [x] Supprimer le dossier `app/` vide

## Phase 2 : Fusionner les scripts

- [x] Déplacer `src/scripts/build-catalogue.js` vers `scripts/`
- [x] Supprimer le dossier `src/` (devenu vide)

## Phase 3 : Mettre à jour les imports

- [x] `index.html` : Mettre à jour les chemins vers `portal/`
  - `style.css` → `portal/style.css`
  - `app.js` → `portal/app.js`
- [x] `portal/app.js` : Mettre à jour les imports
  - `./app/` → `./modules/`
- [x] `portal/modules/*.js` : Mettre à jour les imports
  - `../lib/` → `../../lib/`

## Phase 4 : Mettre à jour la configuration

- [x] `package.json` : Mettre à jour les scripts
  - lint : `lib/ portal/ scripts/ games/`
  - build:catalogue : `scripts/build-catalogue.js`
- [x] `Makefile` : Mettre à jour les chemins security-eslint
- [x] Correction automatique des erreurs de lint dans `scripts/`

## Phase 5 : Validation

- [x] Lancer `make test` - 254 tests passent
- [x] Lancer `make lint` - aucune erreur
- [x] Le portail fonctionne correctement

## Phase 6 : Documentation

- [x] Mettre à jour `AGENTS.md` (structure projet)
- [x] Mettre à jour `openspec/project.md` (arborescence)

## Phase 7 : Specs OpenSpec

- [x] Mettre à jour `openspec/specs/platform/spec.md`
- [x] Mettre à jour `openspec/specs/portal/spec.md`

## Phase 8 : Guides et documentation

- [x] Mettre à jour `docs/guides/architecture.md`
- [x] Mettre à jour `docs/GETTING_STARTED.md`
- [x] Mettre à jour `docs/DEPLOYMENT.md`

## Phase 9 : Finalisation

- [x] Marquer les tâches comme terminées
- [x] Commit final avec message descriptif
