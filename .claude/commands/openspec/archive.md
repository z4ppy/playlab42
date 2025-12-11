Archive un changement OpenSpec déployé et met à jour les specs.

## Instructions

1. Vérifie que le change est entièrement implémenté (toutes tâches cochées)
2. Demande confirmation à l'utilisateur
3. Déplace le dossier :
   ```
   openspec/changes/[change-id]/
   → openspec/changes/archive/YYYY-MM-DD-[change-id]/
   ```
4. Fusionne les deltas de specs dans `openspec/specs/`
5. Commit le tout

## Vérifications avant archivage

- [ ] Toutes les tâches de `tasks.md` sont cochées
- [ ] Le code est testé et fonctionnel
- [ ] Les specs delta sont cohérentes

## Format de la date

Utilise le format ISO : `YYYY-MM-DD` (ex: 2025-12-11)
