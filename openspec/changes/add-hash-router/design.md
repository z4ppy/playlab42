# Design: Système de Navigation Hash Router

## Décisions techniques

### Pourquoi Hash Router vs History API ?

| Critère | Hash Router | History API |
|---------|-------------|-------------|
| Config serveur | Aucune | Nécessite 404.html |
| GitHub Pages | Natif | Hack avec redirection |
| Compatibilité | Tous navigateurs | Moderne uniquement |
| URLs | `#/path` | `/path` |
| Complexité | Simple | Moyenne |

**Décision** : Hash Router pour sa simplicité et compatibilité native avec GitHub Pages.

### Architecture du Router

```javascript
// lib/router.js

/**
 * Définition des routes avec patterns
 * :param = paramètre dynamique
 */
const routes = [
  { pattern: '/', handler: 'catalogue' },
  { pattern: '/games/:id', handler: 'game' },
  { pattern: '/tools/:id', handler: 'tool' },
  { pattern: '/parcours/:epic', handler: 'parcours' },
  { pattern: '/parcours/:epic/:slide', handler: 'slide' },
  { pattern: '/settings', handler: 'settings' },
];

/**
 * API publique
 */
export function initRouter(handlers) { ... }
export function navigate(path) { ... }
export function getCurrentRoute() { ... }
```

### Intégration avec app.js

```javascript
// app.js

import { initRouter, navigate } from './lib/router.js';

// Initialisation
initRouter({
  catalogue: () => showCatalogue(),
  game: (params) => loadGame(params.id),
  tool: (params) => loadTool(params.id),
  parcours: (params) => loadParcours(params.epic),
  slide: (params) => loadSlide(params.epic, params.slide),
  settings: () => showSettings(),
});

// Navigation programmatique
function onGameClick(gameId) {
  navigate(`/games/${gameId}`);
}
```

### Gestion des liens

```html
<!-- Avant -->
<a href="#" onclick="loadGame('checkers')">Dames</a>

<!-- Après -->
<a href="#/games/checkers">Dames</a>
```

Les liens `href="#/..."` sont gérés nativement par le navigateur, déclenchant `hashchange`.

### Synchronisation Parcours

Le viewer de parcours met à jour le hash lors de la navigation :

```javascript
// parcours-viewer.js
function goToSlide(index) {
  // ... logique existante ...

  // Mise à jour du hash sans déclencher de re-navigation
  history.replaceState(null, '', `#/parcours/${epicId}/${index}`);
}
```

### Fallback et compatibilité

```javascript
// Si hash vide ou invalide → catalogue
if (!window.location.hash || !matchRoute(hash)) {
  navigate('/');
}

// Les jeux standalone restent fonctionnels
// (accès direct à games/checkers/index.html)
```

## Alternatives considérées

### 1. Import Maps
```html
<script type="importmap">
{ "imports": { "/lib/": "./lib/" } }
</script>
```
**Rejeté** : Ne résout pas le problème de navigation/deep linking.

### 2. Build-time transformation
```bash
sed -i 's|/lib/|/playlab42/lib/|g' *.html
```
**Rejeté** : Ajoute complexité au build, ne résout pas le deep linking.

### 3. Framework SPA (Vue/React)
**Rejeté** : Trop lourd pour un projet pédagogique vanilla JS.

## Métriques de succès

- Temps de chargement : identique ou meilleur
- Lignes de code ajoutées : < 100
- Couverture de tests : 100% sur le router
