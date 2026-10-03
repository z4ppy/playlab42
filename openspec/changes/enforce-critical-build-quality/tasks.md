- [x] 1. Constater le lot lint et mesurer la baseline critique.
- [x] 2. Reproduire puis corriger contrats JSON/racine et persistance.
- [x] 3. Reproduire puis corriger cache/entités OG et réduire les responsabilités.
- [x] 4. Ajouter et vérifier seuils ciblés, tests négatifs et documentation.
- [ ] 5. Vérifier les gates/build/browser dans Docker et ouvrir la PR.
- [ ] 6. Constater les contrôles natifs et consigner les limites.
- [ ] 7. Après autorisation/livraison, décider synchronisation et archivage.

Preuves locales Docker : reproduction initiale (13 échecs / 20 scénarios),
puis 96 suites / 2 007 tests et seuils requis réussis. Helpers à 100 % ;
OG statements 93,12 %, branches 87,34 %, fonctions 100 %, lignes 93,60 %.
Complexité extraction 14→8, orchestration 17→6 ; fixture CLI rejetée au-delà de 10.
Lint JS/HTML/TS, sécurité, types, audit et 27 validations OpenSpec réussis.
Vrai build production et 64 scénarios Chromium sur son site préparé réussis.
La PR et ses résultats natifs restent à constater avant cocher 5/6.

PR #142 : CI 37137577950 a révélé un défaut réel d'idempotence de Diese & Mat
(durée 0→1 ms au deuxième `endSession`). Reproduit sans dépendre du hasard
(1 000→9 000 ms), corrigé par conservation du timestamp de fin et réinitialisation
au démarrage suivant ; événement `session-end` unique vérifié.
