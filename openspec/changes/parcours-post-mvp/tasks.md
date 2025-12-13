# Tasks: parcours-post-mvp

## Phase 1: Conversion Markdown

- [ ] Choisir bibliothèque markdown (marked vs micromark)
- [ ] Installer dépendance npm
- [ ] Modifier `build-parcours.js`
  - [ ] Détecter `index.md` vs `index.html`
  - [ ] Convertir Markdown → HTML
  - [ ] Injecter dans template HTML
- [ ] Créer template `parcours/_shared/slide-template.html`
- [ ] Ajouter syntax highlighting (optionnel)
  - [ ] Choisir lib (Prism.js, highlight.js)
  - [ ] Intégrer au build
- [ ] Tester avec slide Markdown de démo
- [ ] Documenter dans guide

## Phase 2: Tests unitaires

### build-parcours.js

- [ ] Setup jest pour scripts/
- [ ] Test `readJSON()`
- [ ] Test `validateEpic()`
- [ ] Test `extractSlideIds()`
- [ ] Test `countSlides()`
- [ ] Test `buildStructure()`
- [ ] Test `buildHierarchy()` avec threshold
- [ ] Test `aggregateTags()`
- [ ] Test `buildFeatured()`
- [ ] Test intégration (génération complète)

### parcours-viewer.js

- [ ] Setup jest-dom pour tests browser
- [ ] Test `flattenStructure()`
- [ ] Test `showSlide()`
- [ ] Test `prev()` / `next()` / `goTo()`
- [ ] Test `toggleMenu()`
- [ ] Test `loadProgress()` / `saveProgress()`
- [ ] Test `handleKeydown()`
- [ ] Test `handleHashRoute()`

## Phase 3: Documentation

- [ ] Créer `docs/guides/create-epic.md`
  - [ ] Introduction (qu'est-ce qu'un Epic)
  - [ ] Structure de fichiers
  - [ ] Format `epic.json` avec tous les champs
  - [ ] Format `slide.json` avec exemples
  - [ ] Gestion assets (tailles, formats)
  - [ ] Sections et optionnels
  - [ ] Exemple minimal
  - [ ] Exemple complet
  - [ ] Checklist de validation
- [ ] Mettre à jour `docs/guides/architecture.md`
  - [ ] Ajouter section Parcours
  - [ ] Diagramme ASCII structure

## Phase 4: Fonctionnalités avancées (optionnel)

- [ ] Mode présentation
  - [ ] Hotkey `p` pour toggle
  - [ ] Masquer header/footer
  - [ ] Curseur caché après inactivité
- [ ] Thèmes de slides
  - [ ] CSS variables pour variantes
  - [ ] Sélecteur dans settings
- [ ] Analytics localStorage
  - [ ] Temps par slide
  - [ ] Nombre de visites
  - [ ] Dashboard dans l'Epic
