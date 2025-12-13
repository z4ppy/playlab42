# Portal Specification - Delta

## Changements

### Onglets

4 onglets : Parcours, Outils, Jeux, **Liens**

### State

```typescript
interface PortalState {
  // ...existant
  activeTab: "parcours" | "tools" | "games" | "bookmarks";
  bookmarksCatalogue: BookmarksCatalog | null;
}
```

### Raccourcis clavier

- `4` : Onglet Liens
