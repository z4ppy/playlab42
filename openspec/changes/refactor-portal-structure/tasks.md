# Tasks: Réorganisation structure portal/

## Phase 1 : Créer la structure portal/

- [ ] Créer le dossier `portal/`
- [ ] Créer le dossier `portal/modules/`
- [ ] Déplacer `app.js` vers `portal/app.js`
- [ ] Déplacer `style.css` vers `portal/style.css`
- [ ] Déplacer les fichiers de `app/` vers `portal/modules/`
- [ ] Supprimer le dossier `app/` vide

## Phase 2 : Fusionner les scripts

- [ ] Déplacer `src/scripts/build-catalogue.js` vers `scripts/`
- [ ] Supprimer le dossier `src/` (devenu vide)

## Phase 3 : Mettre à jour les imports

- [ ] `index.html` : Mettre à jour les chemins vers `portal/`
  - `style.css` → `portal/style.css`
  - `app.js` → `portal/app.js`
- [ ] `portal/app.js` : Mettre à jour les imports
  - `./app/` → `./modules/`
- [ ] `portal/modules/*.js` : Mettre à jour les imports
  - `../lib/` → `../../lib/`

## Phase 4 : Mettre à jour la configuration

- [ ] `package.json` : Mettre à jour les scripts
  - lint : ajouter `portal/` aux dossiers vérifiés
  - build:catalogue : nouveau chemin du script
- [ ] `Makefile` : Vérifier les chemins des scripts
- [ ] `eslint.config.js` : Vérifier la configuration si nécessaire

## Phase 5 : Validation

- [ ] Lancer `make serve` et vérifier que le portail fonctionne
- [ ] Lancer `make test` et vérifier que les tests passent
- [ ] Lancer `make lint` et vérifier que le lint passe
- [ ] Tester la navigation entre onglets
- [ ] Tester le chargement des games/tools/parcours

## Phase 6 : Documentation

- [ ] Mettre à jour `AGENTS.md` (structure projet)
- [ ] Mettre à jour `openspec/project.md` (arborescence)
- [ ] Mettre à jour `README.md` (structure si mentionnée)

## Phase 7 : Specs OpenSpec

- [ ] Mettre à jour `openspec/specs/platform/spec.md`
- [ ] Mettre à jour `openspec/specs/portal/spec.md`
- [ ] Vérifier les autres specs pour références obsolètes

## Phase 8 : Guides et documentation

- [ ] Mettre à jour `docs/guides/architecture.md` si existant
- [ ] Mettre à jour `docs/guides/contributing.md` si existant
- [ ] Vérifier les autres guides pour références obsolètes

## Phase 9 : Finalisation

- [ ] Commit final avec message descriptif
- [ ] Vérifier le déploiement GitHub Pages (si applicable)
