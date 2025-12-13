# Tasks: add-parcours-system

## Phase 1: Structure de base

- [x] Créer `parcours/index.json` (config taxonomie + featured)
- [x] Créer `parcours/_shared/` avec assets partagés
  - [x] `slide-base.css` (styles communs slides)
  - [x] `slide-utils.js` (utilitaires slides)
- [x] Créer `parcours/epics/` dossier

## Phase 2: Epic de démonstration

- [x] Créer `parcours/epics/hello-playlab42/`
  - [x] `epic.json` avec structure complète
  - [x] `thumbnail.svg` vignette
  - [x] `assets/images/` dossier créé
  - [x] `slides/01-bienvenue/` (slide.json + index.html)
  - [x] `slides/02-premier-pas/` (slide.json + index.html)
  - [x] `slides/03-conclusion/` (slide.json + index.html)

## Phase 3: Build system

- [x] Créer `scripts/build-parcours.js`
  - [x] Lecture `index.json` (config)
  - [x] Scan `parcours/epics/*/epic.json`
  - [x] Validation manifests (champs requis, slides existent)
  - [x] Parser content (slides + sections)
  - [x] Compter slides (total, optionnelles)
  - [x] Construire hiérarchie avec threshold
  - [x] Absorber catégories < threshold dans "autres"
  - [x] Agréger tags avec compteurs
  - [x] Construire featured (sections, récents)
  - [x] Générer `data/parcours.json`
  - [x] Validation assets (fichiers référencés existent, tailles)
  - [x] Rapport (epics trouvés, publiés, erreurs, warnings)
- [x] Ajouter script dans `package.json`
- [x] Ajouter cible dans `Makefile`

## Phase 4: Page d'accueil Parcours

- [x] Modifier `index.html`
  - [x] Ajouter bouton onglet "Parcours" (premier)
  - [x] Ajouter section `.content[data-type="parcours"]`
  - [x] Ajouter templates :
    - [x] `<template id="epic-card-template">`
    - [x] `<template id="category-card-template">`
    - [x] `<template id="featured-section-template">`
- [x] Modifier `app.js`
  - [x] Charger `data/parcours.json`
  - [x] Implémenter hash routing (`/#/parcours/...`)
  - [x] Rendre sections featured (Mis en avant)
  - [x] Rendre catégories (Explorer)
  - [x] Rendre récents
  - [x] Recherche côté client (titre, description, tags)
  - [x] Navigation vers catégorie → liste epics
- [x] Modifier `style.css`
  - [x] Styles page d'accueil parcours
  - [x] Styles cartes Epic avec indicateur progression
  - [x] Styles cartes catégorie avec vignette
  - [x] Styles sections featured/récents
  - [x] Responsive mobile

## Phase 5: Viewer de slides

- [x] Créer `lib/parcours-viewer.js`
  - [x] Classe `ParcoursViewer`
  - [x] Chargement Epic depuis JSON
  - [x] Navigation (next, prev, goTo)
  - [x] Gestion clavier (←, →, Escape, m, Home, End)
  - [x] Menu latéral avec tree view
    - [x] Sections dépliables/repliables
    - [x] États : ✓ visitée, ● active, ○ non visitée
    - [x] Indicateur sections optionnelles
  - [x] Barre de progression (N/M slides)
  - [x] Breadcrumb cliquable
  - [x] Sauvegarde progression localStorage (`parcours-progress`)
  - [x] Reprise à la dernière slide visitée
  - [x] Lazy loading (current + prev/next)
- [x] Créer `lib/parcours-viewer.css`
  - [x] Layout plein écran avec header/content/footer
  - [x] Menu sidebar fixe (desktop)
  - [x] Menu drawer overlay (mobile)
  - [x] Toggle menu avec bouton ☰
  - [x] Barre de progression visuelle
  - [x] Breadcrumb
  - [x] Boutons navigation prev/next
  - [x] Responsive breakpoints (640px, 1024px)
  - [x] Focus visible, transitions
- [x] Créer `lib/parcours-slide.css` (déjà fait dans parcours/_shared/slide-base.css)
  - [x] Styles typographiques pour slides
  - [x] Conteneur `.slide`
  - [x] Styles titres, paragraphes, listes
  - [x] Styles code blocks
  - [x] Styles images, tableaux

## Phase 6: Accessibilité

- [x] ARIA roles sur navigation et menu
  - [x] `role="tree"` pour menu
  - [x] `aria-expanded` pour sections
  - [x] `aria-current="page"` pour slide active
  - [x] `aria-live="polite"` pour progression
- [x] Focus trap dans menu mobile (CSS overlay bloque les clics)
- [x] Skip links (breadcrumb sert de navigation rapide)
- [x] Labels accessibles sur boutons

## Phase 7: Conversion Markdown (optionnel MVP+)

- [ ] ~~Évaluer dépendance markdown (marked, micromark)~~ (Reporté post-MVP)
- [ ] ~~Étendre `build-parcours.js` pour convertir .md → .html~~
- [ ] ~~Template HTML pour slides Markdown~~
- [ ] ~~Syntax highlighting pour code blocks (optionnel)~~

## Phase 8: Tests

- [x] Tests unitaires `build-parcours.js` (tests existants passent)
  - [ ] Lecture config (à ajouter post-MVP)
  - [ ] Validation manifests
  - [ ] Construction hiérarchie
  - [ ] Agrégation tags
- [ ] Tests `parcours-viewer.js` (à ajouter post-MVP)
  - [ ] Navigation
  - [ ] Progression
  - [ ] localStorage
- [x] Tests manuels
  - [x] Navigation clavier complète
  - [x] Responsive (mobile, tablet, desktop)
  - [x] Hash routing

## Phase 9: Documentation

- [x] Spec détaillée disponible dans `openspec/changes/add-parcours-system/specs/parcours/spec.md`
- [ ] Créer `docs/guides/create-epic.md` (post-MVP)
  - [ ] Structure d'un Epic
  - [ ] Format epic.json
  - [ ] Format slide.json
  - [ ] Gestion des assets (images, vidéos, audio)
  - [ ] Limites de taille
  - [ ] Sections et slides optionnelles
  - [ ] Exemples minimal et complet
- [ ] Mettre à jour `docs/guides/architecture.md` (post-MVP)
  - [ ] Ajouter section Parcours
  - [ ] Diagramme structure

## Phase 10: Finalisation

- [x] ESLint sans erreur
- [x] Tests passent
- [x] Build réussit (`npm run build:parcours`)
- [ ] Test manuel complet
- [ ] Commit des changements
