# Portal Specification

## Overview

Le portail est l'interface principale de Playlab42. C'est une application 100% frontend (pas de backend) qui permet de :

- Parcourir les parcours pédagogiques (Epics)
- Parcourir le catalogue des tools et games
- Lancer des jeux/outils en iframe
- Consulter les slides de parcours dans le viewer intégré
- Gérer les préférences utilisateur

**Architecture** : HTML/CSS/JS pur, hébergeable sur GitHub Pages, Netlify, ou S3.

## Requirements

### Requirement: Catalog Display

The system SHALL display all tools and games from the catalogue.

#### Scenario: Initial load
- **WHEN** the portal loads
- **THEN** it fetches `catalogue.json` and displays cards for each entry

#### Scenario: Filtering by tags
- **WHEN** a user clicks on a tag filter
- **THEN** only matching entries are displayed

#### Scenario: Search
- **WHEN** a user types in the search field
- **THEN** entries are filtered by name and description

### Requirement: Game Launching

The system SHALL launch games in an isolated iframe.

#### Scenario: Click on game
- **WHEN** a user clicks on a game card
- **THEN** the game loads in an iframe with sandbox restrictions

#### Scenario: Back navigation
- **WHEN** the user presses Escape or clicks the back button
- **THEN** the game is unloaded and the catalog is shown

### Requirement: User Preferences

The system SHALL persist user preferences in localStorage.

#### Scenario: Sound toggle
- **WHEN** a user toggles sound on/off
- **THEN** the preference is saved and communicated to the active game

#### Scenario: Pseudo editing
- **WHEN** a user changes their pseudo
- **THEN** it is saved and used for scores

### Requirement: Recent Games (désactivé)

The system SHALL track recently played games in localStorage for future use, but the UI display is disabled.

#### Scenario: Play a game
- **WHEN** a game is launched
- **THEN** it is added to the `recent_games` localStorage entry
- **AND** no UI section is displayed (désactivé temporairement)

### Requirement: Tab Navigation

The system SHALL provide tab-based navigation with three tabs: Parcours, Outils, Jeux.

#### Scenario: Default tab
- **WHEN** the portal loads for the first time
- **THEN** the "Parcours" tab is active by default

#### Scenario: Tab switching
- **WHEN** a user clicks on a tab
- **THEN** the corresponding content is displayed
- **AND** the other tab content is hidden

#### Scenario: Tab persistence
- **WHEN** a user switches tabs and reloads the page
- **THEN** the previously selected tab is restored

#### Scenario: Tab-specific filters
- **WHEN** a user applies tag filters
- **THEN** filters apply only to the active tab content

### Requirement: Parcours Display

The system SHALL display pedagogical content (Epics) in the Parcours tab.

#### Scenario: Parcours home
- **WHEN** the Parcours tab is active
- **THEN** categories are displayed in order: PlayLab42, Récents, Autres
- **AND** epics already shown in a section are not repeated below
- **AND** empty categories are hidden

#### Scenario: Category filters
- **WHEN** a user clicks on a category filter
- **THEN** only epics from that category are displayed

#### Scenario: Open epic
- **WHEN** a user clicks on an epic card
- **THEN** the parcours viewer opens with the first slide
- **AND** the header and footer are hidden for immersive experience

#### Scenario: Parcours navigation
- **WHEN** viewing a slide
- **THEN** navigation controls (prev/next) are visible
- **AND** keyboard shortcuts work (arrows, Escape)

### Requirement: Hash Routing

The system SHALL use hash-based routing for deep linking and navigation.

#### Scenario: Direct link to game
- **WHEN** a user opens `#/games/checkers`
- **THEN** the game loads directly in the iframe

#### Scenario: Direct link to parcours
- **WHEN** a user opens `#/parcours/hello-playlab42`
- **THEN** the parcours viewer opens at the first slide

#### Scenario: Direct link to slide
- **WHEN** a user opens `#/parcours/hello-playlab42/02-methodologies`
- **THEN** the parcours viewer opens at the specified slide

#### Scenario: Browser back button
- **WHEN** a user navigates to a game then presses back
- **THEN** the catalog is displayed

#### Scenario: Bookmarkable URLs
- **WHEN** viewing a slide
- **THEN** the URL reflects the current position
- **AND** the URL can be bookmarked or shared

## Interface

### Application State

```typescript
interface PortalState {
  /** Current view */
  currentView: "catalogue" | "game" | "parcours" | "settings";

  /** Active catalog tab */
  activeTab: "parcours" | "tools" | "games";

  /** Currently loaded game (if any) */
  currentGame: string | null;

  /** Catalogue data (games + tools) */
  catalogue: Catalogue | null;

  /** Parcours catalogue data */
  parcoursCatalogue: ParcoursCatalogue | null;

  /** Selected parcours category filter */
  parcoursCategory: string | null;

  /** Parcours viewer instance */
  parcoursViewer: ParcoursViewer | null;

  /** User preferences */
  preferences: UserPreferences;

  /** Recently played games (slugs, max 5) */
  recentGames: string[];

  /** Active tag filter */
  activeFilter: string;
}

interface UserPreferences {
  /** Sound enabled */
  sound: boolean;

  /** User pseudo */
  pseudo: string;
}
```

### Storage Keys

| Key | Content | Description |
|-----|---------|-------------|
| `playlab42.activeTab` | `"parcours"`, `"tools"` ou `"games"` | Onglet actif |
| `player` | `{ name }` | User profile |
| `preferences` | `{ sound }` | User preferences |
| `recent_games` | `["snake", ...]` | Recent game slugs |
| `scores_{game}` | `[{ score, date, player }]` | Scores per game |
| `progress_{game}` | Game-specific | Save data per game |
| `parcours-progress` | `{ [epicId]: EpicProgress }` | Progression des parcours |

## Screens

### Catalog (Home)

Le catalogue utilise un système d'onglets pour séparer Parcours, Outils et Jeux.

```
┌─────────────────────────────────────────────────────────────┐
│  PLAYLAB42                                      [⚙ Settings] │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┬──────────────┬──────────────┐             │
│  │  📚 Parcours │   🔧 Outils  │    🎮 Jeux   │  ← Onglets  │
│  └──────────────┴──────────────┴──────────────┘             │
│                                                              │
│  [Recherche: ___________]                                    │
│                                                              │
│  Filtres: [Tous] [PlayLab42] [Autres]  ← Catégories         │
│                                                              │
│  ─── 🎮 PLAYLAB42 ───────────────────────────────────────   │
│  ┌─────────┐ ┌─────────┐                                    │
│  │  epic1  │ │  epic2  │                                    │
│  └─────────┘ └─────────┘                                    │
│                                                              │
│  ─── 🕐 RÉCEMMENT AJOUTÉS ───────────────────────────────   │
│  ┌─────────┐ ┌─────────┐                                    │
│  │  epic3  │ │  epic4  │                                    │
│  └─────────┘ └─────────┘                                    │
│                                                              │
│  ─── 📚 AUTRES ──────────────────────────────────────────   │
│  ┌─────────┐                                                │
│  │  epic5  │                                                │
│  └─────────┘                                                │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

Note: La section "Joué récemment" des jeux a été retirée de l'interface (tracking localStorage conservé).

#### Tab States

| State | Display |
|-------|---------|
| Tab active | Highlighted, bold text, accent color |
| Tab inactive | Muted text, clickable |
| Tab hover | Slight highlight |

### Game View

Vue immersive : le header et footer du portail sont masqués.

```
┌─────────────────────────────────────────────────────────────┐
│  [✕ Retour]              Snake              [⛶] [🔇/🔊]    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                                                     │    │
│  │                                                     │    │
│  │                    [IFRAME JEU]                     │    │
│  │                                                     │    │
│  │                                                     │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Parcours View

Vue immersive : le header et footer du portail sont masqués.

```
┌─────────────────────────────────────────────────────────────┐
│  [← Catalogue]  [☰]  Guide Contribution      2/8  ▓▓░░░░░░ │
├────────────────────┬────────────────────────────────────────┤
│ 📑 Sommaire        │                                        │
│                    │  Breadcrumb: Introduction > Prérequis  │
│ ▼ Introduction     │                                        │
│   ├─ ✓ Bienvenue   │  ┌────────────────────────────────┐   │
│   └─ ● Prérequis   │  │                                │   │
│                    │  │      CONTENU SLIDE (HTML)      │   │
│ ▶ Créer contenu    │  │                                │   │
│                    │  └────────────────────────────────┘   │
│ ──────────────     │                                        │
│ Progression: 25%   ├────────────────────────────────────────┤
│                    │ [← Bienvenue]          [Prérequis →]   │
└────────────────────┴────────────────────────────────────────┘
```

Le viewer est implémenté dans `lib/parcours-viewer.js`. Voir [Parcours Specification](../parcours/spec.md) pour les détails.

### Settings

```
┌─────────────────────────────────────────────────────────────┐
│  [✕ Fermer]             Paramètres                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Pseudo: [_______________]                                   │
│                                                              │
│  Son:    [ON] / OFF                                          │
│                                                              │
│  ─────────────────────────────────────────                   │
│                                                              │
│  [🗑 Effacer mes données]                                   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Visual States

| State | Display |
|-------|---------|
| Loading catalog | Skeleton cards |
| Loading game | Spinner + game name |
| Game error | Error message + back button |
| Game playing | Iframe + control bar |
| Empty search | "No results" message |

## Game Loader

### Lifecycle

```
User clicks game card
        │
        ▼
GameLoader.load(slug)
        │
        ├── Show loading spinner
        ├── Verify game exists (HEAD request)
        ├── Create sandboxed iframe
        ├── Set iframe src
        │
        ▼
Wait for iframe load (timeout: 10s)
        │
        ├── On success: hide loading, show controls
        └── On error: show error screen

        ▼
Game running
        │
        ├── Listen for messages (score, quit, error)
        ├── Handle pause/resume on visibility change
        ├── Relay preference changes
        │
        ▼
User exits (ESC or button)
        │
        ▼
GameLoader.unload()
        │
        ├── Send 'unload' message to game
        ├── Wait 100ms for cleanup
        ├── Remove iframe
        └── Show catalog
```

### Iframe Sandbox

```html
<iframe
  src="/games/{slug}/index.html"
  sandbox="allow-scripts allow-same-origin"
></iframe>
```

Sandbox restrictions:
- `allow-scripts` : JavaScript can run
- `allow-same-origin` : Can access localStorage
- NO `allow-popups` : Cannot open new windows
- NO `allow-forms` : Cannot submit forms to external URLs

## Communication Protocol

### Messages: Game → Portal

| Type | Payload | Description |
|------|---------|-------------|
| `ready` | `{ game }` | Game loaded and ready |
| `score` | `{ game, score }` | New score to save |
| `quit` | `{ game }` | Request return to catalog |
| `error` | `{ game, error }` | Error in game |

### Messages: Portal → Game

| Type | Payload | Description |
|------|---------|-------------|
| `unload` | - | Prepare for shutdown |
| `pause` | - | Pause the game |
| `resume` | - | Resume the game |
| `preference` | `{ key, value }` | Preference changed |

### Example Flow

```javascript
// Portal: send preference change
iframe.contentWindow.postMessage({
  type: 'preference',
  key: 'sound',
  value: false
}, '*');

// Game: receive and handle
window.addEventListener('message', (event) => {
  if (event.data.type === 'preference' && event.data.key === 'sound') {
    muteAllSounds();
  }
});

// Game: report score
window.parent.postMessage({
  type: 'score',
  game: 'snake',
  score: 1500
}, '*');

// Portal: receive and save
window.addEventListener('message', (event) => {
  if (event.data.type === 'score') {
    saveScoreToLocalStorage(event.data.game, event.data.score);
    showScoreToast(event.data.score);
  }
});
```

## Catalog Rendering

### Data Loading

```javascript
async function loadCatalog() {
  const response = await fetch('/data/catalogue.json');
  const catalogue = await response.json();

  renderGames(catalogue.games);
  renderTools(catalogue.tools);
  renderRecentGames(catalogue);
}
```

### Filtering

```javascript
function filterCatalog(entries, { tag, search }) {
  let filtered = entries;

  if (tag) {
    filtered = filtered.filter(e => e.tags.includes(tag));
  }

  if (search) {
    const term = search.toLowerCase();
    filtered = filtered.filter(e =>
      e.name.toLowerCase().includes(term) ||
      e.description.toLowerCase().includes(term)
    );
  }

  return filtered;
}
```

### Card Rendering

```javascript
function renderCard(entry, type) {
  return `
    <div class="card" data-type="${type}" data-id="${entry.id}">
      <img
        src="${entry.path.replace('index.html', 'thumb.png')}"
        alt="${entry.name}"
        loading="lazy"
        onerror="this.src='/assets/default-thumb.png'"
      >
      <div class="card-info">
        <h3>${entry.icon || ''} ${entry.name}</h3>
        <p>${entry.description}</p>
        <div class="tags">
          ${entry.tags.map(t => `<span class="tag">${t}</span>`).join('')}
        </div>
      </div>
    </div>
  `;
}
```

## Hash Router

Le portail utilise un hash router (`lib/router.js`) pour la navigation. Cela permet :
- **Deep linking** : URLs partageables vers un jeu, outil ou slide spécifique
- **Bookmarks** : Les favoris fonctionnent correctement
- **Historique** : Le bouton précédent/suivant du navigateur fonctionne
- **Compatibilité GitHub Pages** : Pas de configuration serveur requise

### Routes supportées

| Route | Description |
|-------|-------------|
| `#/` | Catalogue (accueil) |
| `#/games/:id` | Jeu spécifique |
| `#/tools/:id` | Outil spécifique |
| `#/parcours/:epic` | Parcours (premier slide) |
| `#/parcours/:epic/:slide` | Slide spécifique |
| `#/settings` | Paramètres |

### Exemples d'URLs

```
https://example.com/playlab42/#/games/checkers
https://example.com/playlab42/#/tools/json-formatter
https://example.com/playlab42/#/parcours/hello-playlab42
https://example.com/playlab42/#/parcours/hello-playlab42/02-methodologies
https://example.com/playlab42/#/settings
```

### API du Router

```javascript
import { initRouter, navigate, replaceRoute, getCurrentRoute, buildUrl } from './lib/router.js';

// Initialiser avec les handlers
initRouter({
  catalogue: () => showCatalogue(),
  game: (params) => loadGame(params.id),
  tool: (params) => loadTool(params.id),
  parcours: (params) => openParcours(params.epic),
  slide: (params) => openSlide(params.epic, params.slide),
  settings: () => showSettings(),
});

// Naviguer programmatiquement
navigate('/games/checkers');

// Mettre à jour l'URL sans déclencher de navigation
replaceRoute('/parcours/hello/02-slide');

// Construire une URL
const url = buildUrl('game', { id: 'checkers' }); // '#/games/checkers'
```

## Keyboard Shortcuts

| Key | Context | Action |
|-----|---------|--------|
| `Escape` | Game view | Return to catalog |
| `F` | Game view | Toggle fullscreen |
| `M` | Game view | Toggle mute |
| `/` | Catalog | Focus search |
| `1` | Catalog | Switch to Parcours tab |
| `2` | Catalog | Switch to Tools tab |
| `3` | Catalog | Switch to Games tab |
| `4` | Catalog | Switch to Bookmarks tab |

## Responsive Design

### Breakpoints

| Breakpoint | Cards per row | Layout |
|------------|---------------|--------|
| < 480px | 2 | Stack controls |
| 480-768px | 3 | Side controls |
| 768-1024px | 4 | Standard |
| > 1024px | 5-6 | Wide |

### Mobile Considerations

- Touch-friendly card sizes (min 44x44px touch targets)
- Swipe to close game (optional)
- No hover states on touch devices
- Fullscreen auto-enabled on game start

## Error Handling

### Catalog Errors

```javascript
async function loadCatalog() {
  try {
    const response = await fetch('/data/catalogue.json');
    if (!response.ok) throw new Error('Catalog not found');
    // ...
  } catch (error) {
    showError('Unable to load catalog. Please refresh.');
  }
}
```

### Game Errors

```javascript
// Listen for errors from game iframe
window.addEventListener('message', (event) => {
  if (event.data.type === 'error') {
    console.error(`[${event.data.game}]`, event.data.error);
    // Optionally show toast notification
  }
});

// Handle iframe load timeout
const loadPromise = new Promise((resolve, reject) => {
  const timeout = setTimeout(() => {
    reject(new Error('Game took too long to load'));
  }, 10000);

  iframe.onload = () => {
    clearTimeout(timeout);
    resolve();
  };
});
```

## Accessibility

### ARIA Labels

```html
<button aria-label="Return to catalog">✕</button>
<button aria-label="Toggle fullscreen">⛶</button>
<button aria-label="Toggle sound">🔊</button>
```

### Focus Management

- Focus trap in settings modal
- Return focus to game card after closing game
- Visible focus indicators on all interactive elements

### Tab Accessibility

```html
<div role="tablist" aria-label="Catalog sections">
  <button role="tab" aria-selected="true" aria-controls="parcours-panel" id="parcours-tab">
    📚 Parcours
  </button>
  <button role="tab" aria-selected="false" aria-controls="tools-panel" id="tools-tab">
    🔧 Outils
  </button>
  <button role="tab" aria-selected="false" aria-controls="games-panel" id="games-tab">
    🎮 Jeux
  </button>
</div>

<div id="parcours-panel" role="tabpanel" aria-labelledby="parcours-tab">
  <!-- Parcours content -->
</div>

<div id="tools-panel" role="tabpanel" aria-labelledby="tools-tab" hidden>
  <!-- Tools content -->
</div>

<div id="games-panel" role="tabpanel" aria-labelledby="games-tab" hidden>
  <!-- Games content -->
</div>
```

### Screen Reader

- Announce game loading state
- Announce score achievements
- Describe game cards properly

## Implementation Status

### Hash Routing for Games and Tools (2026-01-14)

✅ **IMPLEMENTED** - Hash routing fully implemented for games and tools

**Routes supported:**
- `#/games/:id` - Load specific game directly
- `#/tools/:id` - Load specific tool directly
- `#/parcours/:id` - Open parcours viewer
- `#/parcours/:id/:slideId` - Open specific slide

**Features:**
- 2-level validation: format check (regex) + existence check (HEAD request)
- Hash synchronization when loading games/tools
- Card links automatically generate hash routes
- 100% backward compatible
- 50+ unit tests covering all scenarios
- 345 total workspace tests (100% pass)

**Implementation files:**
- `app/router.js` - Hash pattern matching and dispatch
- `app/game-loader.js` - openGame/openTool functions with validation
- `app/catalogue.js` - Card elements as hash links
- `style.css` - Card link styles
- Test files: `app/router.test.js`, `app/game-loader.test.js`, `app/catalogue.test.js`

**Merged:** feat/portal-links (2026-01-14)

## See Also

- [Parcours Specification](../parcours/spec.md) - Système de parcours pédagogiques
- [GameKit Specification](../gamekit/spec.md) - SDK for games
- [Catalogue Specification](../catalogue/spec.md) - Data format
- [Manifests Specification](../manifests/spec.md) - Game/tool manifests
