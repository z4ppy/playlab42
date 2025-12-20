# Tâches - Synchroniser les specs avec le code

## Checklist d'implémentation

### 1. Créer la spec Theme

- [ ] Créer le dossier `openspec/specs/theme/`
- [ ] Créer `openspec/specs/theme/spec.md` avec :
  - [ ] Overview et objectifs
  - [ ] Requirements (persistence, modes, événements)
  - [ ] Interface TypeScript complète
  - [ ] Exemples d'utilisation
  - [ ] Intégration avec le portail

### 2. Mettre à jour la spec Parcours

- [ ] Ajouter une section "Architecture modulaire" dans `openspec/specs/parcours/spec.md`
  - [ ] Documenter `ParcoursProgress.js` (gestion de la progression)
  - [ ] Documenter `ParcoursNavigation.js` (navigation entre slides)
  - [ ] Documenter `ParcoursUI.js` (rendu HTML)
  - [ ] Documenter `parcours-viewer.js` (orchestrateur)
- [ ] Mettre à jour la section "Structure des fichiers" pour refléter l'arborescence `lib/parcours/`

### 3. Mettre à jour la spec SeededRandom

- [ ] Renommer `getSeed()` → `getState()` dans l'interface
- [ ] Ajouter la méthode statique `fromState(state): SeededRandom`
- [ ] Mettre à jour les exemples si nécessaire

### 4. Validation

- [ ] Relire chaque spec modifiée pour cohérence
- [ ] Vérifier que le code correspond aux specs mises à jour
- [ ] Mettre à jour AGENTS.md si nécessaire (table des specs)

## Notes

- Les specs sont en anglais (convention du projet)
- Les commentaires dans les exemples peuvent être en français
- Privilégier la concision tout en restant complet
