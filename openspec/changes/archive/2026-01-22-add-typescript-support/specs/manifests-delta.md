# Manifests Specification - Delta

## MODIFIED Tool Manifest

### Interface mise à jour

```typescript
interface ToolManifest {
  /** Identifiant unique */
  id: string;

  /** Nom affiché */
  name: string;

  /** Description courte */
  description: string;

  /** Tags pour le filtrage */
  tags: string[];

  /** Auteur (optionnel) */
  author?: string;

  /** Icône emoji (optionnel) */
  icon?: string;

  /** Version (optionnel) */
  version?: string;

  // === NOUVEAU ===

  /** Langage principal du code source (optionnel, défaut: "javascript") */
  language?: "javascript" | "typescript";

  /** Point d'entrée TypeScript (optionnel, défaut: "src/main.ts") */
  entry?: string;
}
```

### ADDED Champs

| Champ | Type | Requis | Description |
|-------|------|--------|-------------|
| `language` | string | ❌ | `"javascript"` (défaut) ou `"typescript"` |
| `entry` | string | ❌ | Point d'entrée pour TypeScript (défaut: `"src/main.ts"`) |

### Exemple Tool TypeScript

```json
{
  "id": "particle-life",
  "name": "Particle Life",
  "description": "Simulateur de vie artificielle avec particules interactives",
  "tags": ["simulation", "physics", "canvas"],
  "author": "Cyrille",
  "icon": "🔮",
  "version": "1.0.0",
  "language": "typescript",
  "entry": "src/main.ts"
}
```

## MODIFIED Game Manifest

### Interface mise à jour

```typescript
interface GameManifest {
  // ... champs existants ...

  // === NOUVEAU ===

  /** Langage du moteur (optionnel, défaut: "javascript") */
  language?: "javascript" | "typescript";

  /** Chemin du moteur (défaut: "engine.js" ou "engine.ts" selon language) */
  engine?: string;
}
```

### ADDED Champs

| Champ | Type | Requis | Description |
|-------|------|--------|-------------|
| `language` | string | ❌ | `"javascript"` (défaut) ou `"typescript"` |

### Logique de résolution du moteur

1. Si `engine` est spécifié → utiliser ce chemin
2. Si `language: "typescript"` → chercher `engine.ts`
3. Sinon → chercher `engine.js`

### Exemple Game TypeScript

```json
{
  "id": "connect4",
  "name": "Puissance 4",
  "description": "Alignez 4 jetons pour gagner",
  "players": { "min": 2, "max": 2 },
  "type": "turn-based",
  "tags": ["strategy", "classic"],
  "author": "Cyrille",
  "icon": "🔴",
  "version": "1.0.0",
  "language": "typescript",
  "bots": {
    "default": "Random",
    "available": [
      { "name": "Random", "file": "bots/random.ts", "difficulty": "easy" },
      { "name": "Minimax", "file": "bots/minimax.ts", "difficulty": "expert" }
    ]
  }
}
```

### MODIFIED Bot Configuration

```typescript
interface BotConfig {
  /** Nom du bot */
  name: string;

  /** Chemin du fichier (accepte .js ou .ts) */
  file: string;

  /** Niveau de difficulté */
  difficulty: "easy" | "medium" | "hard" | "expert";
}
```

**Note** : Le champ `file` accepte désormais les extensions `.ts`. Le système de build transpile automatiquement.

## MODIFIED JSON Schema

### Tool Schema (extrait des modifications)

```json
{
  "properties": {
    "language": {
      "type": "string",
      "enum": ["javascript", "typescript"],
      "default": "javascript",
      "description": "Langage principal du code source"
    },
    "entry": {
      "type": "string",
      "description": "Point d'entrée TypeScript (ex: src/main.ts)"
    }
  }
}
```

### Game Schema (extrait des modifications)

```json
{
  "properties": {
    "language": {
      "type": "string",
      "enum": ["javascript", "typescript"],
      "default": "javascript",
      "description": "Langage du moteur de jeu"
    },
    "engine": {
      "type": "string",
      "description": "Chemin du fichier moteur (engine.js ou engine.ts)"
    }
  }
}
```

## MODIFIED Structure de fichiers

### Tool TypeScript

```
tools/
└── particle-life/
    ├── index.html          # Point d'entrée HTML
    ├── tool.json           # Manifest avec language: "typescript"
    ├── src/                # Code source TypeScript
    │   ├── main.ts
    │   ├── types.ts
    │   └── Simulation.ts
    ├── dist/               # Fichiers transpilés (gitignore, généré au build)
    │   ├── main.js
    │   ├── types.js
    │   └── Simulation.js
    └── __tests__/
        └── Simulation.test.ts
```

### Game TypeScript

```
games/
└── connect4/
    ├── index.html
    ├── game.json           # Manifest avec language: "typescript"
    ├── engine.ts           # Moteur en TypeScript
    ├── dist/               # Fichiers transpilés
    │   └── engine.js
    ├── bots/
    │   ├── random.ts
    │   └── minimax.ts
    └── thumb.png
```

## ADDED Validation

### Règles de validation TypeScript

1. **Cohérence language/extension** : Si `language: "typescript"`, les fichiers référencés doivent exister en `.ts`
2. **Entry valide** : Si `entry` est spécifié, le fichier doit exister
3. **Bots valides** : Les fichiers bots doivent exister (`.js` ou `.ts`)

### Messages d'erreur

```
❌ tools/particle-life/tool.json: entry 'src/main.ts' not found
❌ games/connect4/game.json: bot file 'bots/minimax.ts' not found
⚠️ games/connect4/game.json: language is 'typescript' but engine.ts not found, falling back to engine.js
```

## MODIFIED Build Script

Le script `scripts/build-catalogue.js` doit être mis à jour pour :

1. Lire le champ `language` des manifests
2. Valider l'existence des fichiers `.ts` si `language: "typescript"`
3. Ajouter les informations de langage au catalogue généré

### Catalogue généré

```json
{
  "tools": [
    {
      "id": "particle-life",
      "name": "Particle Life",
      "path": "tools/particle-life/index.html",
      "language": "typescript",
      "entry": "src/main.ts"
    }
  ],
  "games": [
    {
      "id": "connect4",
      "name": "Puissance 4",
      "path": "games/connect4/index.html",
      "language": "typescript",
      "engine": "engine.ts"
    }
  ]
}
```
