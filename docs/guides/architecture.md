# Architecture Playlab42

Ce guide présente l'architecture globale de la plateforme Playlab42.

## Vue d'ensemble

Playlab42 est une plateforme modulaire de mini-jeux et outils, conçue pour la formation au développement assisté par IA.

```
┌─────────────────────────────────────────────────────────────────┐
│                         PORTAIL                                  │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌─────────────┐  │
│  │  Parcours │  │   Outils  │  │   Jeux    │  │ Paramètres  │  │
│  │   (tabs)  │  │   (tabs)  │  │  (tabs)   │  │             │  │
│  └───────────┘  └───────────┘  └───────────┘  └─────────────┘  │
└─────────────────────────────────────────────────────────────────┘
         │                  │               │
         ▼                  ▼               ▼
┌─────────────────┐  ┌─────────────┐  ┌──────────────────────────┐
│    PARCOURS     │  │    TOOLS    │  │          GAMES            │
│    (Epics)      │  │(HTML simple)│  │  ┌────────┐ ┌─────────┐ │
│                 │  │             │  │  │ Engine │─│ Client  │ │
│  ┌───────────┐  │  │json-format. │  │  └────────┘ └─────────┘ │
│  │  Slides   │  │  │etc.         │  │  ┌─────────────────────┐ │
│  │ HTML / MD │  │  │             │  │  │        Bots         │ │
│  └───────────┘  │  │             │  │  └─────────────────────┘ │
└─────────────────┘  └─────────────┘  └──────────────────────────┘
```

## Composants principaux

### 1. Portail (`index.html`, `portal/`)

Le point d'entrée de l'application :
- **Catalogue** : Liste les outils et jeux disponibles
- **Onglets** : Sépare Tools et Games
- **Recherche et filtres** : Navigation facile
- **Iframe sandboxé** : Charge les outils/jeux de manière isolée
- **Paramètres** : Pseudo, son, effacement des données

### 2. Parcours (`parcours/`)

Système de contenus pédagogiques structurés en Epics :

```
parcours/
├── index.json                 # Configuration globale
├── _shared/                   # Assets partagés
│   ├── slide-base.css         # Styles de base des slides
│   ├── slide-template.html    # Template pour Markdown
│   └── highlight-theme.css    # Thème coloration syntaxique
└── epics/
    └── mon-epic/
        ├── epic.json          # Manifest de l'epic
        ├── thumbnail.png      # Vignette
        ├── assets/            # Médias de l'epic
        │   └── images/
        └── slides/
            └── 01-intro/
                ├── slide.json # Métadonnées
                └── index.md   # Contenu (ou index.html)
```

**Concepts clés :**
- **Epic** : Collection ordonnée de slides (parcours pédagogique)
- **Slide** : Unité de contenu (HTML ou Markdown)
- **Section** : Groupe de slides dans un epic

**Build :**
```bash
make build-parcours  # Génère data/parcours.json et convertit Markdown
```

Le build :
1. Valide les manifests `epic.json`
2. Convertit les slides Markdown en HTML
3. Agrège les tags et construit la hiérarchie
4. Génère `data/parcours.json`

### 3. Outils (`tools/`)

Fichiers HTML autonomes et simples :
- Un fichier = un outil complet
- Pas de dépendance externe
- Optionnel : `tool.json` pour les métadonnées

```
tools/
├── json-formatter/
│   ├── index.html    # L'outil
│   └── tool.json     # Métadonnées (optionnel)
└── autre-outil/
    └── index.html
```

### 3. Jeux (`games/`)

Structure plus complexe avec séparation des responsabilités :

```
games/
└── tictactoe/
    ├── index.html    # Client (interface utilisateur)
    ├── engine.js     # Moteur (logique de jeu)
    ├── bots.js       # Bots (IA)
    ├── game.json     # Manifest
    └── thumb.png     # Vignette pour le catalogue
```

### 4. Bibliothèques partagées (`lib/`)

Code réutilisable entre les jeux et le portail :

```
lib/
├── dom.js            # Utilitaires DOM ($, $$, on, escapeHtml, cloneTemplate)
├── theme.css         # Système de thèmes (variables CSS, dark/light)
├── theme.js          # Gestion des thèmes (getTheme, setTheme, initTheme)
├── seeded-random.js  # Générateur aléatoire déterministe
├── game-engine.js    # Interface commune des moteurs
├── bot.js            # Interface commune des bots
└── gamekit.js        # SDK pour la communication portail/jeu
```

#### Utilitaires DOM (`lib/dom.js`)

Helpers légers pour manipuler le DOM sans framework :

```javascript
// Chemin relatif depuis votre fichier vers lib/ (ex: depuis tools/ → ../lib/)
import { $, $$, on, delegate, escapeHtml, cloneTemplate, debounce } from '../lib/dom.js';

// Sélecteurs courts
const btn = $('#btn-start');
const cells = $$('.cell');

// Gestion d'événements
on(btn, 'click', handler);
delegate(document, 'click', '.card', (card) => { ... });

// Sécurité XSS
element.textContent = escapeHtml(userInput);

// Templates HTML natifs
const fragment = cloneTemplate('card-template');
```

#### Système de thèmes (`lib/theme.css` + `lib/theme.js`)

Support de thèmes dark/light avec respect des préférences système :

```javascript
import { initTheme, setTheme, getTheme, THEMES } from '../lib/theme.js';

// Initialiser au chargement (évite le flash)
initTheme();

// Changer de thème
setTheme(THEMES.DARK);   // Force dark
setTheme(THEMES.LIGHT);  // Force light
setTheme(THEMES.SYSTEM); // Suit prefers-color-scheme
```

Variables CSS disponibles : `--color-bg`, `--color-text`, `--color-accent`, etc.

### 5. Données (`data/`)

Fichiers générés automatiquement :

```
data/
└── catalogue.json    # Liste de tous les tools et games
```

## Flux de données

### Chargement du catalogue

```
1. Portail charge           2. Affiche les cartes      3. Utilisateur clique
   /data/catalogue.json        dans l'onglet actif        sur une carte
         │                           │                          │
         ▼                           ▼                          ▼
   ┌──────────┐              ┌──────────────┐           ┌──────────────┐
   │ fetch()  │──────────────│ renderCards()│───────────│ loadGame()   │
   └──────────┘              └──────────────┘           └──────────────┘
```

### Lancement d'un jeu

```
1. loadGame()         2. Iframe chargé        3. Jeu prêt
      │                      │                      │
      ▼                      ▼                      ▼
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│ Crée iframe  │──────│ onload()     │──────│ postMessage  │
│ sandboxé     │      │ masque loader│      │ { type:ready}│
└──────────────┘      └──────────────┘      └──────────────┘
```

### Communication Portail ↔ Jeu

Le portail et les jeux communiquent via `postMessage` :

```javascript
// Portail → Jeu
iframe.contentWindow.postMessage({ type: 'preference', key: 'sound', value: false }, '*');

// Jeu → Portail
window.parent.postMessage({ type: 'score', game: 'tictactoe', score: 100 }, '*');
```

| Direction | Message | Description |
|-----------|---------|-------------|
| Portail → Jeu | `unload` | Prépare la fermeture |
| Portail → Jeu | `pause` | Met en pause |
| Portail → Jeu | `resume` | Reprend |
| Portail → Jeu | `preference` | Changement de préférence |
| Jeu → Portail | `ready` | Jeu chargé et prêt |
| Jeu → Portail | `score` | Nouveau score |
| Jeu → Portail | `quit` | Demande retour catalogue |

## Technologies

| Composant | Technologie |
|-----------|-------------|
| Frontend | HTML/CSS/JS pur (vanilla) |
| Moteurs de jeu | JavaScript ES modules |
| Tests | Jest |
| Linting | ESLint |
| Environnement | Docker |
| Build | Scripts npm |

## Principes d'architecture

### 1. Isomorphisme

Les moteurs de jeux sont **isomorphes** : ils fonctionnent côté client ET serveur.

```javascript
// Le même code tourne partout
const engine = new TicTacToeEngine();
engine.init({ players: 2 });
engine.applyAction({ player: 0, position: 4 });
```

Contraintes :
- Pas de dépendance DOM
- Pas de `fetch`, `fs`, ou I/O
- État 100% sérialisable en JSON

### 2. Déterminisme

Chaque partie est **rejouable** à l'identique :

```javascript
// Même seed = même résultat
const rng1 = new SeededRandom(12345);
const rng2 = new SeededRandom(12345);
rng1.int(0, 100) === rng2.int(0, 100); // true
```

### 3. Séparation des responsabilités

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT (UI)                          │
│  - Affichage                                                │
│  - Événements utilisateur                                   │
│  - Animations                                               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       ENGINE (Logique)                      │
│  - Règles du jeu                                            │
│  - Validation des actions                                   │
│  - État de la partie                                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                         BOT (IA)                            │
│  - Analyse de l'état                                        │
│  - Choix de l'action                                        │
│  - Stratégies (Random, Greedy, Minimax)                    │
└─────────────────────────────────────────────────────────────┘
```

### 4. Simplicité

- Un fichier HTML = un outil complet
- Pas de framework sans justification
- Vanilla JS/CSS par défaut
- Zéro dépendance externe pour les tools

## Structure des fichiers

```
playlab42/
├── index.html              # Portail principal
├── portal/                 # Sources du portail
│   ├── app.js              # Point d'entrée
│   ├── style.css           # Styles
│   └── modules/            # Modules JS
├── tools/                  # Outils HTML standalone
│   └── [tool]/
│       ├── index.html
│       └── tool.json
├── games/                  # Jeux
│   └── [game]/
│       ├── index.html      # Client
│       ├── engine.js       # Moteur
│       ├── bots.js         # Bots
│       └── game.json       # Manifest
├── lib/                    # Bibliothèques partagées
│   ├── seeded-random.js
│   ├── theme.js
│   └── gamekit.js
├── scripts/                # Scripts de build
│   ├── build-catalogue.js
│   └── build-parcours.js
├── data/                   # Données générées
│   └── catalogue.json
├── docs/                   # Documentation
│   ├── FEATURES.md
│   └── guides/
└── openspec/               # Spécifications
    ├── specs/
    └── changes/
```

## Voir aussi

- [Créer un outil](create-tool.md)
- [Créer un moteur de jeu](create-game-engine.md)
- [Créer un client de jeu](create-game-client.md)
- [Créer un bot](create-bot.md)
