# Tâches - Synchroniser les specs avec le code

## Checklist d'implémentation

### 1. Créer la spec Theme

- [x] Créer le dossier `openspec/specs/theme/`
- [x] Créer `openspec/specs/theme/spec.md` avec :
  - [x] Overview et objectifs
  - [x] Requirements (persistence, modes, événements)
  - [x] Interface TypeScript complète
  - [x] Exemples d'utilisation
  - [x] Intégration avec le portail

### 2. Mettre à jour la spec Parcours

- [x] Ajouter une section "Architecture modulaire" dans `openspec/specs/parcours/spec.md`
  - [x] Documenter `ParcoursProgress.js` (gestion de la progression)
  - [x] Documenter `ParcoursNavigation.js` (navigation entre slides)
  - [x] Documenter `ParcoursUI.js` (rendu HTML)
  - [x] Documenter `parcours-viewer.js` (orchestrateur)
- [x] Mettre à jour la section "Structure des fichiers" pour refléter l'arborescence `lib/parcours/`

### 3. Mettre à jour la spec SeededRandom

- [x] Renommer `getSeed()` → `getState()` dans l'interface
- [x] Ajouter la méthode statique `fromState(state): SeededRandom`
- [x] Mettre à jour les exemples si nécessaire

### 4. Validation

- [x] Relire chaque spec modifiée pour cohérence
- [x] Vérifier que le code correspond aux specs mises à jour
- [x] Mettre à jour AGENTS.md si nécessaire (table des specs)

## Notes

- Les specs sont en anglais (convention du projet)
- Les commentaires dans les exemples peuvent être en français
- Privilégier la concision tout en restant complet
