# Parcours Specification - Delta

## Changement

Ajout du champ optionnel `bookmarks` dans `EpicManifest`.

```typescript
interface EpicManifest {
  // ...existant
  bookmarks?: Bookmark[];
}
```

## Exemple

```json
{
  "id": "hello-playlab42",
  "title": "Hello PlayLab42",
  "bookmarks": [
    {
      "url": "https://github.com/org/playlab42",
      "title": "Repository GitHub",
      "description": "Code source du projet"
    }
  ]
}
```
