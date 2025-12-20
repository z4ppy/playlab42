# Synchroniser les specs avec le code implémenté

## Pourquoi

Lors d'un audit de synchronisation entre les spécifications OpenSpec et le code implémenté, plusieurs écarts ont été identifiés :

1. **Système de thèmes** : Le code `lib/theme.js` est complet et fonctionnel mais n'a aucune spec dédiée. La spec portal mentionne juste "Preferences" sans détails.

2. **Parcours Viewer** : L'architecture a évolué vers un système modulaire (`ParcoursProgress.js`, `ParcoursNavigation.js`, `ParcoursUI.js`) non documenté dans la spec. De plus, les champs `completed` et `lastVisited` de l'interface `EpicProgress` ne sont pas implémentés.

3. **SeededRandom** : La spec définit `getSeed()` mais le code implémente `getState()`. La méthode statique `fromState()` a été ajoutée sans mise à jour de la spec.

Ces écarts peuvent créer de la confusion pour les nouveaux contributeurs et les agents IA.

## Quoi

### 1. Créer une spec dédiée pour le système de thèmes

Nouvelle spec `openspec/specs/theme/spec.md` documentant :
- Les trois modes : DARK, LIGHT, SYSTEM
- L'API publique : `getTheme()`, `setTheme()`, `toggleTheme()`, `getEffectiveTheme()`, `initTheme()`, `onThemeChange()`
- La persistence en localStorage
- L'événement custom `themechange`
- Le support de `prefers-color-scheme`

### 2. Mettre à jour la spec parcours

Documenter dans `openspec/specs/parcours/spec.md` :
- L'architecture modulaire avec les 3 classes séparées
- Le rôle de chaque module (Progress, Navigation, UI)
- L'orchestration par `parcours-viewer.js`

### 3. Aligner SeededRandom (spec → code)

Mettre à jour `openspec/specs/seeded-random/spec.md` pour refléter le code actuel :
- Renommer `getSeed()` → `getState()` dans la spec
- Documenter `fromState(state)` pour la restauration d'état

## Impact

| Fichier | Action |
|---------|--------|
| `openspec/specs/theme/spec.md` | **Créer** |
| `openspec/specs/parcours/spec.md` | Modifier (section architecture) |
| `openspec/specs/seeded-random/spec.md` | Modifier (nommage API) |

### Risques

- **Aucun risque sur le code** : Ce changement ne modifie que les specs, pas le code
- Le code reste inchangé et fonctionnel

### Dépendances

Aucune dépendance externe.
