# Proposal: refactor-frontend-code

## Résumé

Refactoriser le code frontend (portail, tools, games) pour le rendre plus performant, élégant et maintenable, tout en restant en vanilla JS.

## Motivation

Le code actuel fonctionne mais présente des axes d'amélioration :

### Problèmes identifiés

1. **innerHTML partout** : Risque XSS, re-render complet à chaque changement
2. **String concatenation** : HTML construit en strings, difficile à lire/maintenir
3. **Pas de templates** : Duplication de code pour les structures HTML
4. **État global mutable** : Difficile à debugger et tester
5. **Event listeners multiples** : Pas toujours de délégation optimale
6. **CSS répété** : Variables dupliquées entre fichiers

### Objectifs

- Code plus lisible et maintenable
- Meilleures performances DOM
- Patterns modernes (templates, delegation, etc.)
- Meilleure séparation des responsabilités
- Zéro dépendance externe (vanilla optimisé)

## Changements proposés

### 1. Templates HTML natifs

Remplacer les strings HTML par des `<template>` :

```html
<!-- Avant -->
<script>
  container.innerHTML = `<div class="card">${item.name}</div>`;
</script>

<!-- Après -->
<template id="card-template">
  <div class="card">
    <div class="card-thumb"></div>
    <div class="card-info">
      <h3></h3>
      <p></p>
    </div>
  </div>
</template>
```

### 2. DOM API au lieu de innerHTML

```javascript
// Avant
element.innerHTML = `<span>${data}</span>`;

// Après
const template = document.getElementById('card-template');
const clone = template.content.cloneNode(true);
clone.querySelector('h3').textContent = data.name;
element.appendChild(clone);
```

### 3. Fonctions utilitaires DOM

Créer `lib/dom.js` avec helpers :

```javascript
export const $ = (sel, ctx = document) => ctx.querySelector(sel);
export const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
export const create = (tag, attrs = {}, children = []) => { ... };
export const on = (el, event, handler, opts) => el.addEventListener(event, handler, opts);
```

### 4. État immutable avec fonctions pures

```javascript
// Avant
state.activeTab = 'games';
renderCatalogue();

// Après
function setState(updates) {
  Object.assign(state, updates);
  render();
}
setState({ activeTab: 'games' });
```

### 5. CSS modernisé avec système de thèmes

- Variables centralisées dans `:root`
- Utilisation de `@layer` pour la cascade
- Container queries où pertinent
- `clamp()` pour les tailles responsives

### 6. Système de thèmes

Créer `lib/theme.css` avec les tokens de design et support multi-thèmes :

```css
/* Thème par défaut (dark) */
:root {
  --color-bg: #1a1a2e;
  --color-bg-secondary: #16213e;
  --color-text: #eee;
  --color-accent: #e94560;
  /* ... */
}

/* Thème clair */
[data-theme="light"] {
  --color-bg: #f5f5f5;
  --color-bg-secondary: #ffffff;
  --color-text: #1a1a2e;
  --color-accent: #e94560;
}

/* Respect des préférences système */
@media (prefers-color-scheme: light) {
  :root:not([data-theme]) {
    /* variables light */
  }
}
```

Le thème sera :
- Stocké dans localStorage (`playlab42.theme`)
- Changeable via les Settings
- Respecte `prefers-color-scheme` par défaut

### 7. Sanitization des données

```javascript
// Helper pour éviter XSS
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
```

## Impact

| Fichier | Changement |
|---------|------------|
| `index.html` | Ajout templates, restructuration, sélecteur thème |
| `app.js` | Refactoring complet avec patterns modernes |
| `style.css` | Modernisation CSS, import theme.css |
| `lib/dom.js` | Nouveau fichier utilitaires |
| `lib/theme.css` | Nouveau fichier tokens + thèmes |
| `tools/json-formatter.html` | Application des patterns + thème |
| `games/tictactoe/index.html` | Application des patterns + thème |

## Risques

- **Moyen** : Refactoring significatif, nécessite tests manuels
- Rétrocompatibilité préservée (même comportement visible)

## Non-objectifs

- Pas d'ajout de framework/librairie
- Pas de changement de fonctionnalités
- Pas de TypeScript (pour l'instant)

## Statut

- [ ] En attente de validation
