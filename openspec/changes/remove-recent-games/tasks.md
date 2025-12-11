# Tasks: remove-recent-games

## Phase 1: Mise à jour des specs

- [x] Modifier `openspec/specs/portal/spec.md`
  - [x] Mettre à jour le requirement "Recent Games" pour indiquer que le tracking reste actif mais l'affichage est désactivé
  - [x] Retirer la section "Joué récemment" du wireframe Catalog
  - [x] PortalState conserve `recentGames` (pas de modification nécessaire)

## Phase 2: Modifications HTML

- [x] Modifier `index.html`
  - [x] Supprimer la section `#section-recent` et son contenu

## Phase 3: Modifications JavaScript

- [x] Modifier `app.js`
  - [x] Supprimer la fonction `renderRecent()`
  - [x] Supprimer l'appel à `renderRecent()` dans `renderCatalogue()`
  - [x] Supprimer l'appel à `renderRecent()` dans `unloadGame()` et `clearAllData()`
  - [x] Supprimer les références DOM `cardsRecent` et `sectionRecent`
  - [x] **Conservé** `addToRecent()` pour le tracking
  - [x] **Conservé** les clés localStorage pour usage futur

## Phase 4: Validation

- [x] Vérifier que le portail s'affiche correctement sans la section
- [x] Vérifier que les jeux récents sont toujours enregistrés en localStorage (addToRecent conservé)
- [x] Vérifier l'absence d'erreurs console (lint passe)
- [x] Lint passe

## Phase 5: Commit

- [x] Commit des changements avec message descriptif (4c4d48c)
