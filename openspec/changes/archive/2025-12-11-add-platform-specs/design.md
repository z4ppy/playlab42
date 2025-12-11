# Design: add-platform-specs

## Scope de cette version

**Version standalone** : Tools et games autonomes uniquement, pas de backend.

## Décisions techniques validées

### Stack technique (version standalone)

| Composant | Choix | Justification |
|-----------|-------|---------------|
| **Frontend catalogue** | HTML pur | Simplicité, pas de build, pédagogique |
| **Frontend jeux/tools** | HTML pur | Standalone, un fichier = une app |
| **Catalogue** | JSON généré | Assemblé au build, liste tous les tools/games |
| **Tests** | Jest | Standard Node.js, déjà configuré |

### Stack technique reportée (version avec backend)

| Composant | Choix prévu | Notes |
|-----------|-------------|-------|
| **Backend** | Hono | Léger, moderne, TypeScript natif, isomorphe |
| **WebSocket** | ws | Standard, pas de dépendance client |
| **Persistance** | JSON files | Pas de BDD, simple |

### Justifications détaillées

#### HTML pur (pas de framework frontend)

- **Standalone** : Les tools et games doivent fonctionner en double-cliquant sur le fichier
- **Pédagogique** : Les participants voient le code sans abstraction
- **Pas de build** : Pas de webpack, vite, etc.
- **Légèreté** : Pas de dépendance à charger

#### Hono (backend)

- **Moderne** : API élégante, TypeScript first
- **Léger** : ~14kb, rapide
- **Isomorphe** : Peut tourner sur Edge, Node, Deno, Bun
- **WebSocket** : Support natif via adapters

### Catalogue JSON

Le catalogue est un fichier `catalogue.json` généré au moment du build :

```json
{
  "tools": [
    {
      "id": "calculator",
      "name": "Calculatrice",
      "description": "Calculatrice simple",
      "path": "tools/calculator.html",
      "tags": ["math", "utility"]
    }
  ],
  "games": [
    {
      "id": "tictactoe",
      "name": "Tic-Tac-Toe",
      "description": "Morpion classique",
      "path": "games/tictactoe/index.html",
      "players": { "min": 2, "max": 2 },
      "tags": ["strategy", "classic"]
    }
  ],
  "generatedAt": "2025-01-15T10:30:00Z"
}
```

#### Script de génération

```bash
# Scan tous les tool.json et game.json
# Assemble le catalogue.json
npm run build:catalogue
```

Le script :
1. Parcourt `tools/` pour trouver les `tool.json`
2. Parcourt `games/*/` pour trouver les `game.json`
3. Assemble tout dans `dist/catalogue.json`

### Mode d'exécution (version standalone)

```
┌─────────────────────────────────────────────────────────────┐
│                    MODE STANDALONE                           │
│  Tools/Games ouvrables directement (file:// ou http://)     │
│  Pas de serveur, localStorage pour persistence locale       │
│  Catalogue JSON généré au build                             │
└─────────────────────────────────────────────────────────────┘
```

### Modes futurs (version avec backend)

```
┌─────────────────────────────────────────────────────────────┐
│                    MODE PLATEFORME                           │
│  Catalogue HTML charge les tools/games en iframe            │
│  SDK injecté pour communication (window.playlab)            │
│  localStorage pour auth/profil                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    MODE SERVEUR                              │
│  Backend Hono (API REST + WebSocket)                        │
│  JSON files pour persistance                                │
│  Multi-joueur, scores partagés, records                     │
└─────────────────────────────────────────────────────────────┘
```

### Évolutions futures possibles

| Actuel | Futur possible |
|--------|----------------|
| JSON files | SQLite / PostgreSQL |
| ws | Socket.io (si besoin rooms) |
| HTML pur | Web Components (si complexité) |
| localStorage | IndexedDB (si gros volumes) |
