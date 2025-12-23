# Tâches d'implémentation

## Phase 1 : Infrastructure de communication

- [x] **Ajouter listener de messages dans le viewer**
  - Fichier : `lib/parcours-viewer.js`
  - Écouter `message` events sur `window`
  - Filtrer par type (`slide:toc`, `slide:toc:clear`)
  - Valider l'origine (même domaine ou iframe connue)
  - Valider les limites (max 15 items, niveaux 1-2)

- [x] **Stocker la TOC courante dans l'état**
  - Fichier : `lib/parcours-viewer.js`
  - Ajouter propriété `currentToc: TocItem[] | null`
  - Reset à `null` lors du changement de slide

## Phase 2 : Intégration dans le menu latéral

- [x] **Injecter les items TOC comme enfants de la slide**
  - Fichier : `lib/parcours/ParcoursUI.js`
  - Quand `slide:toc` reçu, ajouter les items sous la slide courante
  - Utiliser structure similaire aux slides : `<li class="pv-menu-anchor">`
  - La slide devient expansible (comme une section)

- [x] **Méthode `injectSlideToc(slideId, items)`**
  - Fichier : `lib/parcours/ParcoursUI.js`
  - Trouver l'élément de la slide dans le menu
  - Ajouter/remplacer les sous-items
  - Gérer l'état expanded/collapsed

- [x] **Méthode `clearSlideToc(slideId)`**
  - Fichier : `lib/parcours/ParcoursUI.js`
  - Retirer les sous-items d'une slide
  - Appelée au changement de slide

- [x] **Styles pour les ancres intra-slide**
  - Fichier : `lib/parcours-viewer.css`
  - Indentation supplémentaire pour les sous-items
  - Icône différente (point ou tiret)
  - Highlight de l'ancre active
  - Troncature : `text-overflow: ellipsis` (corrigé par redimensionnement)

## Phase 3 : Communication viewer → slide

- [x] **Envoyer message `viewer:scroll-to`**
  - Fichier : `lib/parcours-viewer.js`
  - Au clic sur un item TOC, envoyer le message à l'iframe
  - Payload : `{ type: 'viewer:scroll-to', anchor: '#intro' }`

- [x] **Gérer réception dans slide-utils.js**
  - Fichier : `parcours/_shared/slide-utils.js`
  - Écouter `viewer:scroll-to` via `onViewerMessage()`
  - Scroller vers l'ancre avec `element.scrollIntoView()`

## Phase 4 : API côté slide

- [x] **Fonction `sendTOC(items)`**
  - Fichier : `parcours/_shared/slide-utils.js`
  - Envoie `slide:toc` au viewer parent
  - Valide le format des items

- [x] **Fonction `clearTOC()`**
  - Fichier : `parcours/_shared/slide-utils.js`
  - Envoie `slide:toc:clear`

- [x] **Helper `autoDetectTOC(selector)`** (optionnel)
  - Fichier : `parcours/_shared/slide-utils.js`
  - Détecte automatiquement les headings avec id
  - Génère la liste d'items

## Phase 5 : Tests

- [ ] **Tests unitaires slide-utils.js**
  - Fichier : `parcours/_shared/slide-utils.test.js`
  - Tester `sendTOC()`, `clearTOC()`
  - Mock de `window.parent.postMessage`

- [ ] **Tests d'intégration viewer**
  - Fichier : `lib/parcours/ParcoursUI.test.js`
  - Tester réception et affichage de la TOC
  - Tester navigation vers ancres

## Phase 6 : Migration article deep-learning

- [x] **Retirer la navigation custom**
  - Fichier : `parcours/epics/deep-learning-intro/slides/01-retropropagation/index.html`
  - Supprimer la `<nav>` sticky
  - Nettoyer les styles associés

- [x] **Intégrer `sendTOC()`**
  - Fichier : `parcours/epics/deep-learning-intro/slides/01-retropropagation/index.html`
  - Importer `slide-utils.js`
  - Appeler `sendTOC()` avec les chapitres

- [x] **Renommer l'epic**
  - Fichier : `parcours/epics/deep-learning-intro/epic.json`
  - Nouveau titre : "Deep learning pour l'impatient"
  - Mettre à jour la description

## Phase 7 : Menu redimensionnable (Desktop)

- [x] **Ajouter resize handle**
  - Fichier : `lib/parcours/ParcoursUI.js`
  - Élément `<div class="pv-resize-handle">` sur la bordure droite
  - Écouter `mousedown`, `mousemove`, `mouseup`

- [x] **Logique de redimensionnement**
  - Fichier : `lib/parcours/ParcoursUI.js`
  - Min: 200px, Max: 400px
  - Mettre à jour `grid-template-columns` dynamiquement
  - Sauvegarder en localStorage (`parcours-menu-width`)

- [x] **Styles resize handle**
  - Fichier : `lib/parcours-viewer.css`
  - Curseur `col-resize` au survol
  - Highlight au drag (bordure colorée)
  - Masqué sur mobile

## Phase 8 : Documentation

- [x] **Mettre à jour spec parcours**
  - Fichier : `openspec/specs/parcours/spec.md`
  - Ajouter section "Communication slide ↔ viewer"
  - Documenter le protocole, les types et limites
  - Documenter le resize desktop

- [x] **Ajouter exemple dans slide-utils.js**
  - JSDoc avec exemple d'utilisation
