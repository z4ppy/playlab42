# Delta: portal/spec.md

## Section: Overview

### AJOUT (après le paragraphe Architecture)

```markdown
**Structure des fichiers** :

```
portal/
├── app.js              # Point d'entrée, orchestre les modules
├── style.css           # Styles CSS du portail
└── modules/            # Modules JavaScript
    ├── state.js        # État global de l'application
    ├── catalogue.js    # Affichage du catalogue tools/games
    ├── bookmarks.js    # Gestion des bookmarks
    ├── parcours.js     # Affichage des parcours
    ├── events.js       # Bindings événements et raccourcis clavier
    ├── settings.js     # Écran des paramètres
    ├── storage.js      # Persistence localStorage
    ├── tabs.js         # Navigation par onglets
    ├── router.js       # Routage interne (délègue à lib/router.js)
    ├── dom-cache.js    # Cache des éléments DOM
    └── game-loader.js  # Chargement des jeux en iframe
```

Note : `index.html` reste à la racine du projet pour la compatibilité GitHub Pages.
```

## Section: Data Loading

### MODIFICATION

```javascript
async function loadCatalog() {
  const response = await fetch('./data/catalogue.json');  // Chemin relatif depuis index.html
  const catalogue = await response.json();

  renderGames(catalogue.games);
  renderTools(catalogue.tools);
  renderRecentGames(catalogue);
}
```

## Section: Hash Router

### MODIFICATION

```javascript
import { initRouter, navigate, replaceRoute, getCurrentRoute, buildUrl } from './lib/router.js';
// Note: Le router est dans lib/ car c'est une bibliothèque générique
// Les modules du portail sont dans portal/modules/
```

## Justification

La réorganisation sépare clairement :
- **`portal/`** : Code spécifique au portail (SPA)
- **`lib/`** : Bibliothèques réutilisables (partagées avec games/tools)

Cela facilite :
- La compréhension de l'architecture
- La maintenance du code
- L'ajout de nouveaux modules
