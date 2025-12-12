# Catalogue Specification

## Purpose

The catalogue provides a centralized registry of all available tools and games in the Playlab42 platform. It is generated at build time by scanning manifest files and serves as the data source for the portal interface.

## Overview

Le catalogue est une base de données JSON statique qui référence tous les tools et games disponibles. Il est généré au moment du build en scannant les manifests (`tool.json`, `game.json`).
## Requirements
### Requirement: Build-time Generation

The system SHALL generate the catalogue at build time.

#### Scenario: Manifest scanning
- **WHEN** `npm run build:catalogue` is executed
- **THEN** all `tool.json` and `game.json` files are scanned and assembled

#### Scenario: Output file
- **WHEN** the build completes
- **THEN** `data/catalogue.json` contains all tools and games

### Requirement: Manifest Validation

The system SHALL validate manifests during build.

#### Scenario: Invalid manifest
- **WHEN** a manifest is missing required fields
- **THEN** the build fails with a descriptive error

#### Scenario: Valid manifest
- **WHEN** all manifests are valid
- **THEN** they are included in the catalogue

### Requirement: Frontend Consumption

The system SHALL provide the catalogue for frontend consumption.

#### Scenario: Fetch catalogue
- **WHEN** the catalogue HTML page loads
- **THEN** it fetches `catalogue.json` and displays tools/games

### Requirement: Checkers Game Entry

The system SHALL include a checkers game in the game catalogue.

#### Scenario: Game metadata
- **GIVEN** the catalogue is loaded
- **WHEN** the checkers game entry is retrieved
- **THEN** it has id "checkers"
- **AND** it has name "Dames" or "Checkers"
- **AND** it has a French description
- **AND** it specifies 2 players (min and max)
- **AND** it is tagged as "strategy" and "classic"

#### Scenario: Bot configuration
- **GIVEN** the checkers game entry
- **WHEN** bot configuration is accessed
- **THEN** it lists at least 2 available bots
- **AND** it includes a "Random" bot (easy difficulty)
- **AND** it includes a "Smart" bot (medium or hard difficulty)
- **AND** each bot specifies its file path

#### Scenario: Game asset paths
- **GIVEN** the checkers game entry
- **WHEN** the game is loaded
- **THEN** it points to "games/checkers/index.html"
- **AND** it points to "games/checkers/engine.js"
- **AND** all referenced files exist

## Interface

### Catalogue JSON Structure

```typescript
interface Catalogue {
  /** Liste des outils */
  tools: ToolEntry[];

  /** Liste des jeux */
  games: GameEntry[];

  /** Date de génération ISO 8601 */
  generatedAt: string;

  /** Version du format du catalogue */
  version: "1.0";
}

interface ToolEntry {
  /** Identifiant unique (nom du fichier sans extension) */
  id: string;

  /** Nom affiché */
  name: string;

  /** Description courte */
  description: string;

  /** Chemin relatif vers le fichier HTML */
  path: string;

  /** Tags pour le filtrage */
  tags: string[];

  /** Auteur (optionnel) */
  author?: string;

  /** Icône emoji (optionnel) */
  icon?: string;
}

interface GameEntry {
  /** Identifiant unique (nom du dossier) */
  id: string;

  /** Nom affiché */
  name: string;

  /** Description courte */
  description: string;

  /** Chemin relatif vers index.html */
  path: string;

  /** Configuration joueurs */
  players: {
    min: number;
    max: number;
  };

  /** Tags pour le filtrage */
  tags: string[];

  /** Type de jeu */
  type: "turn-based" | "real-time";

  /** Auteur (optionnel) */
  author?: string;

  /** Icône emoji (optionnel) */
  icon?: string;
}
```

## Format JSON

### Exemple complet

```json
{
  "version": "1.0",
  "generatedAt": "2025-01-15T10:30:00.000Z",
  "tools": [
    {
      "id": "calculator",
      "name": "Calculatrice",
      "description": "Calculatrice scientifique simple",
      "path": "tools/calculator.html",
      "tags": ["math", "utility"],
      "icon": "🧮"
    },
    {
      "id": "json-formatter",
      "name": "JSON Formatter",
      "description": "Formate et valide du JSON",
      "path": "tools/json-formatter.html",
      "tags": ["dev", "utility"],
      "author": "Cyrille",
      "icon": "📋"
    }
  ],
  "games": [
    {
      "id": "tictactoe",
      "name": "Tic-Tac-Toe",
      "description": "Le classique morpion",
      "path": "games/tictactoe/index.html",
      "players": { "min": 2, "max": 2 },
      "tags": ["strategy", "classic"],
      "type": "turn-based",
      "icon": "⭕"
    },
    {
      "id": "snake",
      "name": "Snake",
      "description": "Le serpent qui mange des pommes",
      "path": "games/snake/index.html",
      "players": { "min": 1, "max": 1 },
      "tags": ["arcade", "classic"],
      "type": "real-time",
      "icon": "🐍"
    }
  ]
}
```

## Script de Génération

### Algorithme

```
1. SCAN tools/*.json
   - Pour chaque fichier trouvé :
     - Lire et parser le JSON
     - Valider contre ToolManifest
     - Ajouter à tools[]

2. SCAN games/*/game.json
   - Pour chaque fichier trouvé :
     - Lire et parser le JSON
     - Valider contre GameManifest
     - Ajouter à games[]

3. GENERATE catalogue
   - Créer l'objet Catalogue
   - Ajouter timestamp
   - Écrire data/catalogue.json

4. REPORT
   - Afficher nombre de tools trouvés
   - Afficher nombre de games trouvés
   - Lister les erreurs éventuelles
```

### Gestion des erreurs

| Erreur | Comportement |
|--------|--------------|
| Manifest invalide | Build échoue, erreur affichée |
| Fichier JSON malformé | Build échoue, erreur affichée |
| Manifest sans fichier HTML correspondant | Warning, entry ignorée |
| Aucun manifest trouvé | Build réussit, catalogue vide |

### Commande

```bash
# Via Make
make build:catalogue

# Via npm (dans le container)
npm run build:catalogue
```

## Utilisation Frontend

### Chargement du catalogue

```javascript
// Dans le catalogue HTML
async function loadCatalogue() {
  const response = await fetch('data/catalogue.json');
  const catalogue = await response.json();

  displayTools(catalogue.tools);
  displayGames(catalogue.games);
}

function displayTools(tools) {
  const container = document.getElementById('tools');
  tools.forEach(tool => {
    const card = createCard(tool);
    container.appendChild(card);
  });
}

function displayGames(games) {
  const container = document.getElementById('games');
  games.forEach(game => {
    const card = createCard(game);
    container.appendChild(card);
  });
}
```

### Filtrage par tags

```javascript
function filterByTag(items, tag) {
  return items.filter(item => item.tags.includes(tag));
}

// Exemple : afficher uniquement les jeux de stratégie
const strategyGames = filterByTag(catalogue.games, 'strategy');
```

## Évolutions Futures

| Actuel | Futur possible |
|--------|----------------|
| JSON statique | API REST dynamique |
| Build manuel | Watch mode automatique |
| Validation basique | JSON Schema complet |
