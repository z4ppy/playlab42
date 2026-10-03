## Implementation

- [x] 1. Collecter l'absence de HTML des outils simples comme erreur bloquante.
- [x] 2. Marquer/reconstruire les sorties Markdown et refuser les sources ambiguës.
- [x] 3. Documenter propriété, migration legacy et conservation des catalogues.
- [x] 4. Ajouter les tests des vrais CLI, seconde exécution et erreurs ciblées.

## Validation

- [x] 5. Tests ciblés Docker : 67 tests réussis, incluant CRLF et commentaires non exacts, dans trois suites
  (`build-review-builders`, `build-input-errors`, `parcours-utils`).
- [x] 6. ESLint standard et sécurité des deux builders et des deux tests CLI,
  warnings bloquants.
- [x] 7. Validation OpenSpec stricte de ce change distinct.

## Delivery

Aucun commit, push, merge, publication ou archivage n'est demandé ni réalisé.
