# Delta: portal/spec.md

## ADDED Requirements

### Requirement: Tab Navigation

The system SHALL provide tab-based navigation to separate games and tools.

#### Scenario: Default tab
- **WHEN** the portal loads for the first time
- **THEN** the "Tools" tab is active by default

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

## MODIFIED Interface

### Application State

```typescript
interface PortalState {
  /** Current view */
  currentView: "catalog" | "game" | "settings";

  /** Active catalog tab */           // ADDED
  activeTab: "games" | "tools";       // ADDED

  /** Currently loaded game (if any) */
  currentGame: string | null;

  /** User preferences */
  preferences: UserPreferences;

  /** Recently played games (slugs, max 5) */
  recentGames: string[];
}
```

## MODIFIED Storage Keys

| Key | Content | Description |
|-----|---------|-------------|
| `playlab42.activeTab` | `"games"` ou `"tools"` | **ADDED** - Onglet actif |
| `player` | `{ name }` | User profile |
| `preferences` | `{ sound }` | User preferences |
| `recent_games` | `["snake", ...]` | Recent game slugs |
| `scores_{game}` | `[{ score, date, player }]` | Scores per game |
| `progress_{game}` | Game-specific | Save data per game |

## MODIFIED Screens

### Catalog (Home) - Updated wireframe

```
┌─────────────────────────────────────────────────────────────┐
│  PLAYLAB42                                      [⚙ Settings] │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┬──────────────┐                            │
│  │   🎮 Jeux    │   🔧 Outils  │  ← Onglets                 │
│  └──────────────┴──────────────┘                            │
│                                                              │
│  [Recherche: ___________]                                    │
│                                                              │
│  Filtres: [Tous] [Tag1] [Tag2] [Tag3]  ← Tags de l'onglet   │
│                                                              │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐           │
│  │  thumb  │ │  thumb  │ │  thumb  │ │  thumb  │           │
│  │─────────│ │─────────│ │─────────│ │─────────│           │
│  │ Item 1  │ │ Item 2  │ │ Item 3  │ │ Item 4  │           │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘           │
│                                                              │
│  ── Joué récemment ── (Games tab only)                      │
│  ┌─────────┐ ┌─────────┐                                    │
│  │ Recent1 │ │ Recent2 │                                    │
│  └─────────┘ └─────────┘                                    │
│                                                              │
│  [Pseudo: Player1]                                           │
└─────────────────────────────────────────────────────────────┘
```

## ADDED Visual States

| State | Display |
|-------|---------|
| Tab active | Highlighted, bold text, accent color |
| Tab inactive | Muted text, clickable |
| Tab hover | Slight highlight |

## ADDED Keyboard Shortcuts

| Key | Context | Action |
|-----|---------|--------|
| `1` | Catalog | Switch to Tools tab |
| `2` | Catalog | Switch to Games tab |

## ADDED Accessibility

### Tab ARIA attributes

```html
<div role="tablist" aria-label="Catalog sections">
  <button role="tab" aria-selected="true" aria-controls="tools-panel">
    🔧 Outils
  </button>
  <button role="tab" aria-selected="false" aria-controls="games-panel">
    🎮 Jeux
  </button>
</div>

<div id="tools-panel" role="tabpanel" aria-labelledby="tools-tab">
  <!-- Tools content -->
</div>

<div id="games-panel" role="tabpanel" aria-labelledby="games-tab" hidden>
  <!-- Games content -->
</div>
```
