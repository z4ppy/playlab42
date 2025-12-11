Implémente un changement OpenSpec approuvé.

## Instructions

1. Liste les changes actifs avec `openspec list` ou explore `@/openspec/changes/`
2. Demande à l'utilisateur quel change implémenter
3. Lis dans l'ordre :
   - `proposal.md` - Comprendre le contexte
   - `design.md` - Décisions techniques (si existe)
   - `tasks.md` - Liste des tâches
4. Implémente chaque tâche séquentiellement
5. Coche chaque tâche terminée dans `tasks.md`
6. Mets à jour `design.md` si nouvelles décisions techniques

## Règles

- Une tâche à la fois
- Commit après chaque tâche significative
- Ne pas modifier les specs tant que toutes les tâches ne sont pas terminées
- Signaler tout blocage ou question
