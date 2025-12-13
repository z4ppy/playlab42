# Bookmarks Specification

> Système de liens externes pour PlayLab42.

## Overview

Agrégation de liens depuis :
- Fichiers standalone (`bookmarks/*.json`)
- Manifests des modules (tools, games, parcours)

## Interface

### Bookmark (entrée)

```typescript
interface Bookmark {
  url: string;           // URL du lien (requis)
  title: string;         // Titre - fallback si pas d'OG (requis)
  description?: string;  // Description - fallback si pas d'OG
  icon?: string;         // Emoji
  tags?: string[];       // Tags pour filtrage
}
```

### EnrichedBookmark (sortie)

```typescript
interface EnrichedBookmark extends Bookmark {
  source: "standalone" | "tool" | "game" | "parcours";
  sourceId?: string;
  domain: string;
  displayTitle: string;       // og:title || title
  displayDescription?: string; // og:description || description
  meta?: {
    ogTitle?: string;
    ogDescription?: string;
    ogImage?: string;         // Miniature pour preview
    favicon?: string;
  };
}
```

### BookmarksCatalog

```typescript
interface BookmarksCatalog {
  version: "1.0";
  generatedAt: string;
  categories: BookmarkCategory[];
  tags: Array<{ id: string; count: number }>;
}

interface BookmarkCategory {
  id: string;
  label: string;
  icon?: string;
  order?: number;
  bookmarks: EnrichedBookmark[];
}
```

## Format des fichiers

### Config (`bookmarks/index.json`)

```json
{
  "categories": [
    { "id": "llm-ia", "label": "LLM & IA", "icon": "🤖", "order": 1 },
    { "id": "developpement", "label": "Développement", "icon": "🛠️", "order": 2 }
  ]
}
```

### Standalone (`bookmarks/{category}.json`)

```json
{
  "category": "llm-ia",
  "bookmarks": [
    {
      "url": "https://chat.openai.com",
      "title": "ChatGPT",
      "description": "Assistant IA généraliste",
      "icon": "💬",
      "tags": ["ia", "chat"]
    }
  ]
}
```

### Extension manifests

```json
// Dans tool.json, game.json ou epic.json
{
  "bookmarks": [
    {
      "url": "https://example.com",
      "title": "Exemple",
      "description": "Description du lien"
    }
  ]
}
```

## Build

```bash
make build-bookmarks
```

### Algorithme

1. Scanner `bookmarks/*.json` → source = "standalone"
2. Scanner manifests (tools, games, parcours) → extraire bookmarks
3. Dédupliquer par URL (priorité: standalone > modules)
4. Fetch métadonnées OG (avec cache 7 jours)
5. Enrichir : displayTitle, displayDescription, domain
6. Output `data/bookmarks.json`

### Cache OG (`data/bookmarks-cache.json`)

```json
{
  "https://chat.openai.com": {
    "fetchedAt": "2025-01-15T10:00:00Z",
    "ogTitle": "ChatGPT",
    "ogDescription": "A conversational AI...",
    "ogImage": "https://chat.openai.com/og.png",
    "favicon": "https://chat.openai.com/favicon.ico"
  }
}
```

Fallback sur données manuelles si fetch échoue.

## UI

### Onglet

4ème onglet "🔗 Liens" après Jeux.

### Arborescence

```
🤖 LLM & IA
├── 💬 ChatGPT                    [openai.com]
│   Assistant IA généraliste
└── 🟣 Claude                     [anthropic.com]
    IA conversationnelle Anthropic
```

### Preview au survol

Carte avec :
- og:image (ou emoji agrandi si absent)
- Titre enrichi
- Description enrichie
- Favicon + domaine

Délai 300ms avant affichage, positionnement intelligent.

## Structure fichiers

```
bookmarks/
├── index.json
├── llm-ia.json
└── developpement.json
scripts/
├── build-bookmarks.js
└── og-fetcher.js
data/
├── bookmarks.json
└── bookmarks-cache.json
```
