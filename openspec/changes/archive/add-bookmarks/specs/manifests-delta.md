# Manifests Specification - Delta

## Changement

Ajout du champ optionnel `bookmarks` dans `ToolManifest` et `GameManifest`.

```typescript
interface ToolManifest {
  // ...existant
  bookmarks?: Bookmark[];
}

interface GameManifest {
  // ...existant
  bookmarks?: Bookmark[];
}
```

## Exemple

```json
{
  "id": "json-formatter",
  "name": "JSON Formatter",
  "bookmarks": [
    {
      "url": "https://jsonlint.com",
      "title": "JSONLint",
      "description": "Validateur JSON en ligne"
    }
  ]
}
```
