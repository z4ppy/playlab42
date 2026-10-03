## Mise en œuvre

- [x] Rapports JSON/LCOV, résumé CI traçable et scopes Codecov cohérents.
- [x] Tests des messages iframe avant correction minimale si nécessaire.
- [x] Tests des courses de chargement/timers avant correction minimale si nécessaire.
- [x] Tests des refus et erreurs du reset avant correction minimale si nécessaire.
- [x] Tests de captures, replay et immutabilité Dames avant correction éventuelle.
- [x] Prise majoritaire : reproduction puis respect du contrat français annoncé.
- [x] Tests de transitions, bonus, modes et reprise Triomino avant correction éventuelle.
- [x] Tests d'horloge, pause, réceptions, pool et reset de Simulation.
- [x] Intégration puis mesure complète ; extractions uniquement justifiées et protégées.
- [x] Seuils ciblés après mesure et reproduction réelle de leur refus de régression.
- [x] Guides et parcours alignés sur l'état effectivement implémenté, non livré.

## Validation et livraison

- [x] Lint qualité/sécurité, types, audit, OpenSpec et tests complets dans Docker.
- [x] Build vérifiable et Chromium sur l'archive intégrée.
- [ ] PR d'implémentation et résultats natifs de son head final consignés.
- [ ] Livraison constatée puis décision explicite d'archivage (hors autorisation actuelle).

## Preuves locales du 3 octobre 2026

Commits tests avant corrections et reproductions conservées par domaine.
Au head `c72afc5` : 109 suites / 2 356 tests avec tous les seuils actifs,
coverage S/B/F/L 76,73/73,19/79,15/76,56 %. Les nouveaux floors et budgets
de complexité échouent réellement sur leurs fixtures CLI, sans baisse des anciens.
La revue indépendante a fait corriger trois transitions croisées supplémentaires
et ne conserve aucun finding qualifié dans son périmètre.

Lint JS/HTML/TS et sécurité, types, audit npm (zéro vulnérabilité), 31 validations
OpenSpec strictes ; deux builds hors réseau identiques, inventaire de 986 fichiers,
corruption refusée et reprise locale restaurée. 65 interactions Chromium passent
sur l'archive extraite readonly avec intégrité vérifiée avant et après, sans rebuild.
La CI native et la livraison restent des preuves distinctes.
