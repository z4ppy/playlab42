## Diagnostic
- [x] 1. Corriger les deux PR précédentes et constater leur CI native.
- [x] 2. Mesurer les étapes et localiser l'attente après le travail OG.
- [x] 3. Reproduire les corps HTTP abandonnés et le délai de lecture insuffisant.

## Correction
- [x] 4. Borner et libérer les requêtes jusqu'à consommation ou abandon.
- [x] 5. Préserver replis, cache, métadonnées et erreurs visibles.
- [x] 6. Documenter les mesures et les optimisations retenues sans retirer de gates.

## Vérification
- [x] 7. Vérifier tests, lint, sécurité, types, build et OpenSpec dans Docker.

Preuves locales : 88 suites / 1 888 tests avec couverture, gates qualité/sécurité,
types et 25 items OpenSpec strict. Production à cache OG vide : 35 s,
115 pages enrichies et dix échecs explicites. 58 scénarios Chromium sur le site
préconstruit, sommes inchangées ; erreurs HTTP libérées en environ 80–100 ms.
La comparaison native reste à constater, sans confondre environnements.
- [x] 8. Ouvrir une PR distincte et comparer sa CI native à la baseline.

PR #137 empilée sur #136 ; runs natifs `37134037265` (CI) et `37134036978`
(audit) réussis sur `97c2cb0`. Build : 1 min 03 s contre 5 min 40 s ;
commande npm : 39 s contre 315 s. Les workflows ont démarré automatiquement
sur cette base de contribution, avec tous les contrôles conservés.

## Livraison distincte
- [ ] 9. Après autorisation et livraison constatée, décider sync et archive.
