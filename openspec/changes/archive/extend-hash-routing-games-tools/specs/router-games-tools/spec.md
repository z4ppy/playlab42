# Spec Delta: Hash Router pour Jeux et Outils

**Change ID:** extend-hash-routing-games-tools  
**Spec:** router-games-tools  
**Status:** Draft

## Overview

Étend le hash router existant pour supporter les jeux et outils, en plus des épics (parcours).

**Cross-references:**
- `openspec/specs/portal/spec.md` — Hash Router (section existante)
- `openspec/specs/platform/spec.md` — Architecture générale
- `openspec/changes/archive/2025-12-19-add-hash-router/` — Router fondation (déjà implémenté)

---

## ADDED Requirements

### Requirement: Hash Route for Games

The system SHALL support deeplinks to games via hash routing.

#### Scenario: Navigate to game by hash
- **WHEN** the portal loads with `#/games/tictactoe` in the URL
- **THEN** the game "Tic-Tac-Toe" loads directly (no catalog shown)
- **AND** the game title is displayed in the header

#### Scenario: Validate game ID before loading
- **WHEN** the portal receives `#/games/invalid-game-id`
- **THEN** the game fails to load gracefully
- **AND** the user is returned to the catalog
- **AND** an error message is logged to console

#### Scenario: Game ID format validation
- **WHEN** parsing a game route
- **THEN** the ID must match `[a-z0-9-]+` (lowercase alphanumeric + hyphens)
- **AND** uppercase or special characters are rejected

---

### Requirement: Hash Route for Tools

The system SHALL support deeplinks to tools via hash routing.

#### Scenario: Navigate to tool by hash
- **WHEN** the portal loads with `#/tools/json-formatter` in the URL
- **THEN** the tool loads directly (no catalog shown)
- **AND** the tool title is displayed in the header

#### Scenario: Validate tool ID before loading
- **WHEN** the portal receives `#/tools/nonexistent-tool`
- **THEN** the tool fails to load gracefully
- **AND** the user is returned to the catalog

---

### Requirement: Hash Synchronization on User Action

The system SHALL synchronize the URL hash when the user interacts with the catalog.

#### Scenario: Click on game card
- **WHEN** a user clicks on a game card in the catalog
- **THEN** the URL hash changes to `#/games/:id`
- **AND** the game loads in the view
- **AND** the user can copy the URL and share it

#### Scenario: Click on tool card
- **WHEN** a user clicks on a tool card in the catalog
- **THEN** the URL hash changes to `#/tools/:id`
- **AND** the tool loads in the view

#### Scenario: Refresh page preserves game state
- **WHEN** a user is playing a game and refreshes the page
- **THEN** the same game loads automatically
- **AND** no catalog is shown initially

---

### Requirement: Hash Parsing and Dispatch

The system SHALL parse game/tool routes and dispatch to the appropriate handler.

#### Scenario: Route pattern matching
- **GIVEN** a hash of `#/games/checkers`
- **WHEN** `handleHashRoute()` is called
- **THEN** it matches the pattern `/#\/games\/([a-z0-9-]+)/`
- **AND** extracts `id = "checkers"`
- **AND** calls the game loader with ID "checkers"

#### Scenario: Tool route pattern matching
- **GIVEN** a hash of `#/tools/relativity-lab`
- **WHEN** `handleHashRoute()` is called
- **THEN** it matches the pattern `/#\/tools\/([a-z0-9-]+)/`
- **AND** extracts `id = "relativity-lab"`
- **AND** calls the tool loader with ID "relativity-lab"

#### Scenario: Fallback on unknown hash
- **GIVEN** a hash that doesn't match any known pattern
- **WHEN** `handleHashRoute()` is called
- **THEN** the catalog is displayed by default

---

### Requirement: Game/Tool Loading

The system SHALL load games and tools with proper validation and error handling.

#### Scenario: Load game from hash
- **GIVEN** the hash is `#/games/tictactoe`
- **WHEN** the router dispatches to the game loader
- **THEN** the game loader validates the game exists (HEAD request)
- **AND** the game iframe is created with src `games/tictactoe/index.html`
- **AND** the game view is displayed

#### Scenario: Load tool from hash
- **GIVEN** the hash is `#/tools/json-formatter`
- **WHEN** the router dispatches to the tool loader
- **THEN** the tool loader validates the tool exists
- **AND** the tool iframe is created with src `tools/json-formatter/index.html`
- **AND** the tool view is displayed

#### Scenario: Handle missing game gracefully
- **GIVEN** the hash is `#/games/nonexistent`
- **WHEN** the game loader attempts to load
- **THEN** the HEAD request returns 404
- **AND** an error message is shown: "Game not found"
- **AND** a back button returns to the catalog

---

## MODIFIED Requirements

### Requirement: Hash Router (Modified)

The system SHALL route navigation based on URL hash and support games and tools in addition to parcours.

#### Updated Route Table

| Route | Type | Description | Example |
|-------|------|-------------|---------|
| `#/` | Catalog | Show main catalog | `https://example.com/#/` |
| `#/games/:id` | Game | Load game by ID | `https://example.com/#/games/tictactoe` |
| `#/tools/:id` | Tool | Load tool by ID | `https://example.com/#/tools/json-formatter` |
| `#/parcours/:epicId` | Parcours | Load parcours first slide | `https://example.com/#/parcours/guide-contribution` |
| `#/parcours/:epicId/:slideId` | Parcours | Load parcours specific slide | `https://example.com/#/parcours/guide-contribution/slide-2` |

#### Router Execution Flow

```
1. URL hash changes (manual input, link click, programmatic)
   ↓
2. 'hashchange' event fires
   ↓
3. app/router.js :: handleHashRoute() called
   ↓
4. Pattern matching (in order):
   - Match #/games/:id ?
   - Match #/tools/:id ?
   - Match #/parcours/... ?
   - Else: show catalog
   ↓
5. Dispatch to appropriate handler
   ↓
6. Handler validates and loads content
```

---

## REMOVED Requirements

(None)

---

## Backwards Compatibility

- ✅ Existing game/tool deeplinks still work (direct HTML file access)
- ✅ Catalog view remains default for empty/invalid hash
- ✅ Parcours routes unchanged
- ✅ No breaking changes to game/tool implementation

---

## Implementation Notes

### Router Module (`app/router.js`)

```javascript
/**
 * Parse and dispatch hash-based routes
 */
export function handleHashRoute() {
  const hash = window.location.hash;

  // Games: #/games/:id
  const gameMatch = hash.match(/#\/games\/([a-z0-9-]+)/);
  if (gameMatch) {
    const id = gameMatch[1];
    openGame(id);
    return;
  }

  // Tools: #/tools/:id
  const toolMatch = hash.match(/#\/tools\/([a-z0-9-]+)/);
  if (toolMatch) {
    const id = toolMatch[1];
    openTool(id);
    return;
  }

  // Parcours: #/parcours/:epic or #/parcours/:epic/:slide
  const parcoursMatch = hash.match(/#\/parcours\/([^/]+)(?:\/(.+))?/);
  if (parcoursMatch) {
    const [, epicId, slideId] = parcoursMatch;
    openEpic(epicId, slideId);
    return;
  }

  // Default: show catalog
  closeParcours();
}
```

### Game Loader Module (`app/game-loader.js`)

```javascript
/**
 * Load game from ID with validation
 */
export async function openGame(id) {
  // Don't reload if already loaded
  if (state.currentGame?.id === id) return;

  // Close previous game
  if (state.currentGame) {
    await closeGame();
  }

  const path = `games/${id}/index.html`;

  try {
    // Validate game exists
    const response = await fetch(path, { method: 'HEAD' });
    if (!response.ok) {
      showError(`Game "${id}" not found`);
      return;
    }

    // Load game
    loadGame(path, id /* name */, 'game', id);

    // Sync hash
    window.location.hash = `#/games/${id}`;

  } catch (error) {
    showError(`Error loading game: ${error.message}`);
  }
}

/**
 * Similar for openTool()
 */
export async function openTool(id) {
  // ... same pattern ...
}
```

### Catalog Integration (`app/catalogue.js`)

```javascript
// Cards are clickable links (not onclick handlers)
function renderGameCard(game) {
  return `
    <a href="#/games/${game.id}" class="card game-card">
      <img src="${game.thumb}" alt="${game.name}">
      <h3>${game.name}</h3>
      <p>${game.description}</p>
    </a>
  `;
}

// Event delegation for clicks
document.addEventListener('click', (e) => {
  const link = e.target.closest('a.card');
  if (link && link.hash) {
    // Let the browser update the hash
    // which triggers hashchange → router
  }
});
```

---

## Testing Strategy

### Unit Tests

- Router pattern matching (games, tools, invalid)
- ID format validation
- Route dispatch calls correct function

### Integration Tests

- Click card → hash updates → game loads
- Direct hash → game loads
- Refresh page → game reloads
- Invalid ID → error handling

### E2E Manual Tests

- Share game URL → opens directly in new tab
- Bookmark game URL → bookmark works
- Back button → returns to previous view

---

## Open Questions

1. **Query parameters for future presets?** (e.g., `#/games/tictactoe?players=3`)
   - **Decision:** Reserved for future; not supported in this change
   - **Path forward:** Can be added later without breaking existing routes

2. **Open Graph metadata for social sharing?**
   - **Decision:** Out of scope for this change
   - **Reason:** Requires server-side rendering or service worker
   - **Path forward:** Can be explored separately

---

## Related Specifications

- `openspec/specs/portal/spec.md` — Portal architecture and UI
- `openspec/specs/platform/spec.md` — Platform conventions
- `openspec/specs/manifests/spec.md` — game.json and tool.json formats
