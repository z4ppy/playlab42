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

La préparation initiale n'incluait aucun commit, push, merge, publication ou
archivage. L'utilisateur a ensuite demandé l'ouverture de la PR #145 vers main :
commit/push et PR sont réalisés, avec une première validation native datée
sur `a5598b2`. L'utilisateur a ensuite fusionné cette PR à main (`8a643e8`) ;
la publication `37148586787` est constatée réussie sur ce commit. Aucun merge,
déploiement ou archivage n'a été effectué par l'assistant ; l'archivage reste
soumis à une décision distincte.
