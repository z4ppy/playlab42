# Tasks: refactor-frontend-code

## Phase 1: Utilitaires DOM

- [x] Créer `lib/dom.js`
  - [x] `$()` et `$$()` - sélecteurs courts
  - [x] `create()` - création d'éléments
  - [x] `on()` - ajout d'événements
  - [x] `escapeHtml()` - sanitization
  - [x] `cloneTemplate()` - clonage de templates

## Phase 1b: Système de thèmes

- [x] Créer `lib/theme.css`
  - [x] Variables de design tokens dans `:root`
  - [x] Thème dark (défaut)
  - [x] Thème light via `[data-theme="light"]`
  - [x] Support `prefers-color-scheme`
- [x] Créer `lib/theme.js`
  - [x] `getTheme()` - lire le thème actuel
  - [x] `setTheme(theme)` - changer le thème
  - [x] `initTheme()` - initialiser au chargement
  - [x] Persistence localStorage (`playlab42.theme`)

## Phase 2: Portail - Templates HTML

- [x] Modifier `index.html`
  - [x] Ajouter `<template id="card-template">`
  - [x] Ajouter `<template id="filter-template">`
  - [x] Ajouter `<template id="tag-template">`

## Phase 3: Portail - JavaScript

- [x] Refactoriser `app.js`
  - [x] Importer les utilitaires DOM
  - [x] Remplacer innerHTML par cloneTemplate
  - [x] Centraliser la gestion d'état avec setState()
  - [x] Améliorer la délégation d'événements
  - [x] Ajouter escapeHtml() pour les données utilisateur
  - [x] Intégrer initTheme() au chargement
  - [x] Ajouter sélecteur de thème dans Settings

## Phase 4: Portail - CSS

- [x] Moderniser `style.css`
  - [x] Importer `lib/theme.css`
  - [x] Migrer les variables vers theme.css
  - [x] Utiliser variables CSS partout
  - [x] Ajouter transitions subtiles
  - [x] Support des deux thèmes

## Phase 5: JSON Formatter Tool

- [x] Refactoriser `tools/json-formatter.html`
  - [x] Importer lib/theme.css et lib/dom.js
  - [x] Améliorer la structure du code JS
  - [x] Sanitizer les entrées utilisateur (escapeHtml)
  - [x] Intégrer le système de thèmes

## Phase 6: Tic-Tac-Toe Game

- [x] Refactoriser `games/tictactoe/index.html`
  - [x] Importer lib/theme.css et lib/dom.js
  - [x] Améliorer la structure du code JS
  - [x] Utiliser les utilitaires DOM ($, $$, on)
  - [x] Intégrer le système de thèmes

## Phase 7: Validation

- [x] Vérifier ESLint (0 erreurs)
- [x] Vérifier les tests existants (50/50)
- [ ] Tests manuels (portail, JSON Formatter, Tic-Tac-Toe)

## Phase 8: Documentation

- [x] Mettre à jour `docs/guides/architecture.md`
  - [x] Documenter lib/dom.js et lib/theme.js
  - [x] Ajouter section sur le système de thèmes
- [x] Mettre à jour `docs/guides/create-tool.md`
  - [x] Utiliser les nouveaux patterns (templates, DOM API)
  - [x] Intégrer le système de thèmes
- [x] Mettre à jour `docs/guides/create-game-client.md`
  - [x] Utiliser les nouveaux patterns
  - [x] Intégrer le système de thèmes

## Phase 9: Commit

- [x] Commit des changements (ea2d40a)
