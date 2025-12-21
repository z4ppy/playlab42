# Delta: platform/spec.md

## Section: Structure des Dossiers

### AVANT

```
playlab42/
├── index.html                # Portail principal
├── style.css                 # Styles du portail
├── app.js                    # Logique du portail
├── .claude/                  # Configuration Claude Code
├── assets/                   # Assets du portail
│   └── default-thumb.png     # Vignette par défaut
├── lib/                      # Bibliothèques partagées
│   ├── gamekit.js            # SDK pour les jeux
│   ├── assets.js             # Loader d'assets
│   └── seeded-random.js      # PRNG déterministe
├── tools/                    # Outils HTML standalone
│   ├── [tool-name].html      # Un fichier = un outil
│   └── [tool-name].json      # Manifest
├── games/                    # Jeux autonomes
│   └── [game-id]/
│       ├── index.html        # Point d'entrée standalone
│       ├── game.js           # Code du jeu
│       ├── game.json         # Manifest
│       ├── thumb.png         # Vignette (200x200)
│       ├── engine.ts         # Moteur isomorphe (optionnel)
│       └── bots/             # Bots IA (optionnel)
│           └── random.js
├── parcours/                 # Parcours pédagogiques
│   ├── index.json            # Configuration des parcours
│   └── epics/                # Epics (modules)
│       └── [epic-id]/
│           ├── epic.json     # Manifest de l'epic
│           └── slides/       # Slides de l'epic
├── data/                     # Données générées
│   ├── catalogue.json        # DB des tools/games
│   └── parcours.json         # DB des parcours
├── src/
│   └── scripts/              # Scripts de build
│       ├── build-catalogue.ts
│       └── build-parcours.js
├── docs/                     # Documentation
├── openspec/                 # Specs et proposals
├── Dockerfile
├── docker-compose.yml
├── Makefile
└── package.json
```

### APRÈS

```
playlab42/
├── index.html                # Portail principal (reste à la racine pour GitHub Pages)
├── portal/                   # Sources du portail
│   ├── app.js                # Point d'entrée du portail
│   ├── style.css             # Styles du portail
│   └── modules/              # Modules JS du portail
│       ├── state.js          # État global
│       ├── catalogue.js      # Gestion catalogue
│       ├── bookmarks.js      # Gestion bookmarks
│       ├── parcours.js       # Gestion parcours
│       ├── events.js         # Événements et bindings
│       ├── settings.js       # Paramètres utilisateur
│       ├── storage.js        # Persistence localStorage
│       ├── tabs.js           # Navigation par onglets
│       ├── router.js         # Routage interne
│       ├── dom-cache.js      # Cache éléments DOM
│       └── game-loader.js    # Chargement des jeux
├── .claude/                  # Configuration Claude Code
├── assets/                   # Assets du portail
│   └── default-thumb.png     # Vignette par défaut
├── lib/                      # Bibliothèques partagées (portail + games + tools)
│   ├── gamekit.js            # SDK pour les jeux
│   ├── dom.js                # Utilitaires DOM
│   ├── theme.js              # Gestion thème clair/sombre
│   ├── router.js             # Hash router
│   ├── parcours-viewer.js    # Viewer de parcours
│   └── seeded-random.js      # PRNG déterministe
├── scripts/                  # Scripts de build (fusionné)
│   ├── build-catalogue.js    # Génère catalogue.json
│   ├── build-parcours.js     # Génère parcours.json
│   ├── build-bookmarks.js    # Génère bookmarks.json
│   ├── parcours-utils.js     # Utilitaires parcours
│   └── og-fetcher.js         # Fetch Open Graph
├── tools/                    # Outils HTML standalone
│   ├── [tool-name].html      # Un fichier = un outil
│   └── [tool-name].json      # Manifest
├── games/                    # Jeux autonomes
│   └── [game-id]/
│       ├── index.html        # Point d'entrée standalone
│       ├── game.js           # Code du jeu
│       ├── game.json         # Manifest
│       ├── thumb.png         # Vignette (200x200)
│       ├── engine.js         # Moteur isomorphe (optionnel)
│       └── bots/             # Bots IA (optionnel)
│           └── random.js
├── parcours/                 # Parcours pédagogiques
│   ├── index.json            # Configuration des parcours
│   └── epics/                # Epics (modules)
│       └── [epic-id]/
│           ├── epic.json     # Manifest de l'epic
│           └── slides/       # Slides de l'epic
├── data/                     # Données générées
│   ├── catalogue.json        # DB des tools/games
│   ├── parcours.json         # DB des parcours
│   └── bookmarks.json        # DB des bookmarks
├── docs/                     # Documentation
├── openspec/                 # Specs et proposals
├── Dockerfile
├── docker-compose.yml
├── Makefile
└── package.json
```

## Justification des changements

1. **`portal/`** : Regroupe tout le code spécifique au portail (app.js, style.css, modules)
2. **`portal/modules/`** : Renommage de `app/` pour plus de clarté
3. **`scripts/`** : Fusion de `scripts/` et `src/scripts/` - un seul endroit pour les scripts de build
4. **`lib/`** reste à la racine car partagé entre portail, games et tools
5. **`index.html`** reste à la racine pour compatibilité GitHub Pages

## Section: Système de Build

### MODIFICATION

```markdown
### Génération du Catalogue

Le script `scripts/build-catalogue.js` :  <!-- Chemin mis à jour -->

1. Scanne `tools/` pour les fichiers `*.json` (manifests)
2. Scanne `games/*/` pour les fichiers `game.json`
3. Valide les manifests
4. Génère `data/catalogue.json`
```
